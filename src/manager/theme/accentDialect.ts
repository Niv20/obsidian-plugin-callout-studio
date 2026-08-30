/**
 * manager/theme/accentDialect.ts — which spelling of `--callout-*` the ACTIVE
 * STYLING expects.
 *
 * Obsidian 1.13 changed its own callout accent variables from a bare RGB
 * triplet (`8, 109, 221`, meaningful only once wrapped in `rgb()`) to a full
 * CSS colour (`#086ddd`). `utils/calloutColorFormat.ts` has always answered
 * that from the running version — and that is only half the question, because
 * **`--callout-color` is read by whoever wrote the rules that consume it, and
 * once a theme is active that is usually the theme, not core.**
 *
 * A theme written before 1.13 and never updated still writes
 * `rgba(var(--callout-color), 0.1)`. Handed a hex, that declaration is invalid
 * at computed-value time and the property silently unsets — the background
 * vanishes, and a `border-left` shorthand unsets all the way to
 * `border-left-style: none`, so a side accent disappears entirely. Handed a
 * triplet, a theme written after 1.13 loses every `color-mix()` the same way.
 * No single value serves both: `rgba(X, .1)` needs a triplet, `color-mix(… X …)`
 * needs a colour, and relative colour (`rgb(from X r g b)`) cannot be spelled
 * with the legacy comma form. So the format is chosen per theme, from the
 * theme's own text.
 *
 * ## Two questions, not one
 *
 * Collapsing them is the mistake this module is shaped around, and one theme
 * proves it alone: **Composer** declares `--callout-error: 158, 48, 57`
 * (triplet) while reading `color-mix(in srgb, var(--callout-color) …)` (colour).
 * Either single answer is wrong for half of it.
 *
 * - {@link AccentDialect.read} — *what do the read sites expect?* Global, from
 *   `var(--callout-…)` occurrences. Decides what we write INTO `--callout-color`.
 * - {@link AccentDialect.declared} — *what does the theme's own `--callout-info`
 *   HOLD?* Per variable, from declarations. Decides whether `--cs-accent-theme`
 *   takes `var(--callout-info)` or `rgb(var(--callout-info))`. Six themes
 *   (Reshi, Nebula, Novadust, Nightfox, RetroNotes, …) declare triplets and
 *   never read them, so a read-only detector cannot see them at all — and since
 *   `--cs-accent-theme` is registered `<color>`, an unseen triplet falls back to
 *   its grey initial value and quietly greys every heading bar and pill.
 *
 * Reading one sheet is `accentDialectScan.ts`; this file folds what several of
 * them said into the one answer the emitters consult. A runtime
 * probe (a sentinel `@property`, assigned the theme's variable, read back
 * computed) could answer `declared` exactly and would see Style Settings and
 * `var()` chains for free; it is rejected here for being asynchronous and for
 * not answering `read` at all, which would still need this scan. That is the
 * upgrade path if this one ever proves too coarse.
 */
import { resolveDeclaredSpelling } from "./accentValueFormat";
import { ACCENT_VARS } from "./accentDialectScan";

/** How a `--callout-*` accent value is spelled. */
export type AccentSpelling = "triplet" | "color";

/**
 * What one `--callout-<type>` holds in each theme mode, `undefined` where the
 * active styling does not declare it there at all — which is not "unknown" but
 * "core's, in core's spelling", and is what `accentVarSpelling` falls back to.
 *
 * Two fields rather than one because **a theme can declare an accent variable
 * in only one mode**, and ten of the 257 installed themes do. Nier declares all
 * thirteen under `.theme-dark` alone, as triplets; in light mode the same names
 * still resolve — to *core's* values, which on 1.13 are colours. One answer for
 * both modes is therefore wrong in one of them, and being wrong is not a
 * near-miss: `--cs-accent-theme` is registered `<color>`, so the mismatched
 * mode falls back to its grey initial and every heading bar, inline pill, ref
 * token and icon tint on those built-ins turns grey.
 */
export interface ModeSpelling {
	light: AccentSpelling | undefined;
	dark: AccentSpelling | undefined;
}

/** What the active styling expects, resolved. */
export interface AccentDialect {
	/** Spelling the read sites expect for `--callout-color`. */
	read: AccentSpelling;
	/** Spelling of the theme's own `--callout-<type>` values, per variable and mode. */
	declared: ReadonlyMap<string, ModeSpelling>;
	/**
	 * Properties declared on a **bare** `.callout` — the only theme selector
	 * light enough for the derived-surface rule to outrank by accident. See
	 * `isBareCallout` in `accentDialectScan.ts`.
	 *
	 * Declaration names exactly as the theme wrote them: `border` stays
	 * `border`, not the four colours it sets. The reader expands them, because
	 * the reader is the one that knows what it is about to emit — see
	 * `PAINTERS` in `manager/css/coreAccentShim.ts`.
	 */
	unguarded: ReadonlySet<string>;
}

/** One stylesheet's raw evidence, before the vote. */
export interface AccentEvidence {
	tripletReads: number;
	colorReads: number;
	/**
	 * Custom properties declared under **no** mode guard, for resolving `var()`
	 * chains. They apply in both modes.
	 */
	customProps: Map<string, string>;
	/** The same, for declarations only a `.theme-light` selector reaches. */
	lightProps: Map<string, string>;
	/** The same, for `.theme-dark`. See {@link ModeSpelling}. */
	darkProps: Map<string, string>;
	unguarded: Set<string>;
}

/**
 * Fold every sheet's evidence into one answer.
 *
 * `core` is the spelling the running Obsidian itself uses, and it is the
 * fallback in both directions: no evidence at all (196 of the 257 installed
 * themes) and a tie both land there, so a vault with an opinion-free theme
 * emits exactly what it emitted before this module existed. The tie is cold
 * code — there is not one across the dev vault — which is why it is pinned by a
 * test rather than tuned.
 *
 * Later sheets win for `declared`, matching the cascade: snippets load after
 * the theme.
 */
export function resolveAccentDialect(
	evidence: readonly AccentEvidence[],
	core: AccentSpelling,
): AccentDialect {
	let triplet = 0;
	let color = 0;
	const props = new Map<string, string>();
	const lightOnly = new Map<string, string>();
	const darkOnly = new Map<string, string>();
	const unguarded = new Set<string>();
	for (const ev of evidence) {
		triplet += ev.tripletReads;
		color += ev.colorReads;
		for (const [k, v] of ev.customProps) props.set(k, v);
		for (const [k, v] of ev.lightProps) lightOnly.set(k, v);
		for (const [k, v] of ev.darkProps) darkOnly.set(k, v);
		for (const p of ev.unguarded) unguarded.add(p);
	}

	const read = triplet > color ? "triplet" : color > triplet ? "color" : core;

	// A declaration whose chain runs off the end of this stylesheet falls back
	// to the sheet's OWN read spelling, not core's — because a stylesheet is
	// consistent with itself, and the chain usually leaves it by design.
	//
	// Four installed themes end a `--callout-<type>` on a variable Obsidian
	// declares and they do not, which `resolveDeclaredSpelling` can only report
	// as "don't know":
	//
	//     Arcane   --callout-info: var(--color-blue)       core: #086ddd   colour
	//     Aura     --callout-info: var(--color-cyan-rgb)   core: 0,191,188 triplet
	//     Nier     --callout-info: var(--color-blue-rgb)   core: 8,109,221 triplet
	//     Vicious  --callout-info: var(--C005-RGB)         its own palette, triplet
	//
	// Read dialect gets all four right, and Arcane is why it rather than the
	// `-rgb` suffix those three share: Arcane needs *colour* and has no suffix
	// to read. Before this, all four fell through to core's spelling — which on
	// 1.13 is `colour`, so the three triplet themes handed a bare triplet to
	// `--cs-accent-theme`, failed its `<color>` registration, and greyed every
	// heading bar and inline pill on an unmodified built-in.
	//
	// A no-op wherever it cannot help: a theme with no reads has `read === core`
	// already, which is 196 of the 257 installed themes.
	//
	// Resolved once per mode, against the declarations that mode can actually
	// see — the unscoped ones with the mode's own on top, which is what the
	// cascade does with a `.theme-dark` rule and a `body` one. A variable the
	// mode does not declare stays `undefined`: core supplies it there, and
	// `accentVarSpelling` knows to ask core rather than guess. See
	// {@link ModeSpelling}.
	const lightView = new Map([...props, ...lightOnly]);
	const darkView = new Map([...props, ...darkOnly]);
	const declared = new Map<string, ModeSpelling>();
	for (const name of new Set([
		...props.keys(),
		...lightOnly.keys(),
		...darkOnly.keys(),
	])) {
		if (!ACCENT_VARS.has(name)) continue;
		declared.set(name, {
			light: lightView.has(name)
				? (resolveDeclaredSpelling(name, lightView) ?? read)
				: undefined,
			dark: darkView.has(name)
				? (resolveDeclaredSpelling(name, darkView) ?? read)
				: undefined,
		});
	}

	return { read, declared, unguarded };
}
