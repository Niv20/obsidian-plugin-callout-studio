/**
 * manager/theme/calloutSurface.ts — what the ACTIVE STYLING says about the
 * surface of a callout it has never heard of.
 *
 * `calloutSurfaceScan.ts` reads one sheet; this folds what several of them said
 * into the one answer the emitter consults, exactly as `accentDialect.ts` folds
 * `accentDialectScan.ts`. Two facts come out, and each one exists because a
 * theme can be right about callouts in general while saying nothing at all about
 * the callout the user just invented.
 *
 * ## Fact one: the surface is the theme's
 *
 * Several themes in the development vault blank the callout background
 * generically. Three do it unconditionally (Cyber Glow, Notation 2,
 * Polka); the rest sit behind a class — Prism, Cybertron, LYT Mode and Ultra
 * Lobster behind a `body:not(…)` the reader has to opt *out* of, GitHub Theme's
 * `callout-on`, Minimal's and Oxygen's `callouts-outlined`, and one each from
 * Composer, Glass Robo, Iridium, ITS, Shiba Inu, Typomagical and Underwater.
 *
 * AnuPpuccin's Vanilla variants do the same behind metadata conditions; its
 * Sleek variant instead paints a neutral root and an accent-tinted title. In
 * each case this plugin's `!important` tint would make the body the only
 * accent-coloured box in the note. It restores the theme's root colour only
 * under the original guard and root conditions, so Style Settings works live.
 *
 * ## Fact two: where the colour went instead
 *
 * A theme that takes the colour off the root usually puts it somewhere else —
 * AnuPpuccin Sleek and Vanilla on a title stripe, Cyber Glow on both boxes.
 * Restoring the root alone left an authored background with nowhere to go, so
 * a gradient read as the theme's flat accent tint and "transparent" kept a
 * coloured title. The boxes the sheet fills from the accent, under conditions
 * a neutral root also holds under, are where the authored background moves to.
 * A theme that neutralises the root and fills nothing (GitHub Theme, Prism,
 * Minimal's outlined style) has no such box, and the callout stays as flat as
 * the theme draws its own.
 *
 * ## Fact three: the frame's ink is `currentColor`
 *
 * Four themes build the callout's visible box out of `.callout-title` and
 * `.callout-content` borders and never state a colour for them, so the frame
 * draws in `currentColor`. That is fine for the theme, whose own text colour is
 * a deliberate choice, and wrong for this plugin, which sets `color` on
 * `.callout-content` and so silently repaints the frame in a text grey.
 *
 * **The veto is global, not per guard**, and that is the interesting line. Shiba
 * Inu writes `border: 2px solid` and `border-color: color-mix(in srgb,
 * var(--callout-color) 40%, transparent)` in the *same* rule: it colours its
 * frame, from the very variable this plugin already sets, so it works today and
 * must be left alone. A per-guard veto would have caught that one, but not the
 * general shape — a theme that states the colour in a *separate* rule under a
 * different guard would slip through, and the cost of being wrong is painting
 * over a colour the theme chose. One coloured generic frame anywhere in the
 * active styling is enough to keep this plugin's hands off all of them.
 */
import type { SurfaceBackground, SurfaceEvidence, SurfaceFill } from "./calloutSurfaceScan";

/** What the active styling says, resolved. */
export interface CalloutSurface {
	/**
	 * Theme root surfaces to restore under the exact conditions the theme used.
	 * Empty means the plugin paints as it always has.
	 */
	neutralBackground: readonly SurfaceBackground[];
	/**
	 * Boxes that carry the callout's colour wherever the root is neutral, with
	 * the conditions each one applies under — where an authored background goes
	 * instead of the root. Empty when the theme leaves the colour on the root, or
	 * removes it without filling anything else.
	 */
	relocations: readonly SurfaceFill[];
	/**
	 * Every condition under which the theme's title ink was chosen against the
	 * title's fill — an opaque fill, or one whose rule also picks the ink. A
	 * transparent callout loses that fill; Glass Robo and flexcyon write the
	 * title in the page colour on an opaque badge, so the title's ink goes back
	 * to the accent too. A translucent stripe under the theme's ordinary ink
	 * (AnuPpuccin Sleek) keeps the theme's.
	 */
	inkedTitles: readonly SurfaceFill[];
	/**
	 * Pseudo-elements laid over a whole box, accent or not: the rest of what a
	 * transparent callout has to clear once its three boxes are clear.
	 */
	surfaceLayers: readonly SurfaceFill[];
	/** Guards under which this plugin supplies the frame's ink from its accent. */
	colorlessFrame: readonly string[];
}

/** Nothing to defer to — the answer for themes with no surface claim. */
export const NO_SURFACE_CLAIM: CalloutSurface = {
	neutralBackground: [],
	relocations: [],
	inkedTitles: [],
	surfaceLayers: [],
	colorlessFrame: [],
};

/**
 * Collapse one guard set into the list the emitter iterates.
 *
 * Sorted, because the generated stylesheet is compared byte-for-byte against the
 * last one to decide whether to pay for a `css-change` (see
 * `CSSInjector.injectNow`), and an unordered set would make that comparison
 * depend on scan order. An unguarded rule swallows every guarded one: it already
 * applies in every state they name.
 */
function collapse(guards: ReadonlySet<string>): string[] {
	if (guards.size === 0) return [];
	if (guards.has("")) return [""];
	return [...guards].sort();
}

/** Fold every sheet's evidence into one answer. */
export function resolveCalloutSurface(
	evidence: readonly SurfaceEvidence[],
): CalloutSurface {
	const neutral = new Map<string, SurfaceBackground>();
	const colorless = new Set<string>();
	let painted = false;
	for (const ev of evidence) {
		for (const bg of ev.neutralBackground) {
			neutral.set(`${bg.guard}\u0000${bg.rootQualifier}`, bg);
		}
		for (const g of ev.colorlessFrame) colorless.add(g);
		if (ev.framePainted.size > 0) painted = true;
	}
	const backgrounds = [...neutral.values()];
	// An unconditional claim makes only identical-colour narrower claims
	// redundant. A guarded neutral colour still has to override a transparent
	// default when the theme's Style Settings class or metadata selects it.
	const unconditional = neutral.get("\u0000");
	const relocations = new FillSet();
	const inkedTitles = new FillSet();
	const surfaceLayers = new FillSet();
	for (const ev of evidence) {
		for (const fill of ev.fills) {
			if (fill.pseudo !== "") surfaceLayers.add(fill);
			if (fill.box === "title" && fill.pseudo === "" && fill.inked) inkedTitles.add(fill);
			if (
				fill.accent &&
				!fill.ownOpacity &&
				backgrounds.some((root) => neutralWhenFilled(root, fill))
			) {
				relocations.add(fill);
			}
		}
	}
	return {
		neutralBackground: backgrounds
			.filter((bg) => bg === unconditional || bg.color !== unconditional?.color)
			.sort((a, b) =>
				`${a.guard}\u0000${a.rootQualifier}`.localeCompare(`${b.guard}\u0000${b.rootQualifier}`),
			),
		relocations: relocations.sorted(),
		inkedTitles: inkedTitles.sorted(),
		surfaceLayers: surfaceLayers.sorted(),
		colorlessFrame: painted ? [] : collapse(colorless),
	};
}

/**
 * Fills keyed by where they land and when, so the same rule seen in two sheets —
 * or one rule's two selector branches — is emitted once. Sorted for the same
 * byte-for-byte reason as the guards.
 */
class FillSet {
	private readonly byKey = new Map<string, SurfaceFill>();

	add(fill: SurfaceFill): void {
		this.byKey.set([fill.box, fill.pseudo, fill.guard, fill.rootQualifier].join("\u0000"), fill);
	}

	sorted(): SurfaceFill[] {
		return [...this.byKey.entries()]
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([, fill]) => fill);
	}
}

/**
 * Whether `root` is guaranteed to hold whenever `fill` does — the condition for
 * moving the callout's background onto that child box.
 *
 * Deliberately one-directional and conservative. A fill that applies in a state
 * the root claim does not cover would put the authored background on the title
 * while the root still carries it too, and the title would show it twice. So
 * this answers yes only for the shapes that are provably nested:
 *
 * - the root claim has no condition at all (Cyber Glow, Notation 2, Polka);
 * - both name the same guard, and the root's own conditions are absent or the
 *   same (AnuPpuccin's Style Settings classes and metadata, Composer, Soft Paper);
 * - both guards are one `:not()`-qualified compound, and the fill's excludes
 *   everything the root's does (Iridium: the title tint is
 *   `body:not(.i-callout-outlined, .i-callout-filled, …)`, the transparent root
 *   `body:not(.i-callout-filled, …)`).
 */
function neutralWhenFilled(root: SurfaceBackground, fill: SurfaceFill): boolean {
	if (root.rootQualifier !== "" && root.rootQualifier !== fill.rootQualifier) return false;
	return root.guard === "" || root.guard === fill.guard || compoundImplies(fill.guard, root.guard);
}

/** One guard compound read as: element, required classes, excluded classes. */
interface GuardCompound {
	element: string;
	classes: Set<string>;
	excluded: Set<string>;
}

/** `body.x:not(.y, .z)` → its parts, or `null` for anything richer. */
function readGuardCompound(guard: string): GuardCompound | null {
	const m = /^([a-z][\w-]*)?((?:\.[\w-]+|:not\(\s*\.[\w-]+(?:\s*,\s*\.[\w-]+)*\s*\))*)$/i.exec(guard.trim());
	if (m === null) return null;
	const out: GuardCompound = { element: (m[1] ?? "").toLowerCase(), classes: new Set(), excluded: new Set() };
	for (const part of (m[2] ?? "").matchAll(/:not\(([^)]*)\)|\.([\w-]+)/g)) {
		if (part[2] !== undefined) out.classes.add(part[2]);
		else for (const cls of (part[1] ?? "").matchAll(/\.([\w-]+)/g)) out.excluded.add(cls[1] ?? "");
	}
	return out;
}

/** Whether every element matching compound `a` also matches compound `b`. */
function compoundImplies(a: string, b: string): boolean {
	const ca = readGuardCompound(a);
	const cb = readGuardCompound(b);
	if (ca === null || cb === null) return false;
	if (cb.element !== "" && cb.element !== ca.element) return false;
	for (const cls of cb.classes) if (!ca.classes.has(cls)) return false;
	for (const cls of cb.excluded) if (!ca.excluded.has(cls)) return false;
	return true;
}

/**
 * One guard as a selector prefix: `""` for an unguarded rule, otherwise the
 * theme's own ancestor compound plus the descendant combinator it implied.
 */
export function guardPrefix(guard: string): string {
	return guard === "" ? "" : `${guard} `;
}
