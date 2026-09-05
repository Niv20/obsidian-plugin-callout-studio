/**
 * manager/theme/ThemeCalloutStore.ts — what the active styling says about
 * callouts, scanned once per theme/snippet change and cached.
 *
 * Two questions, and they take deliberately different inputs:
 *
 * - **"Which callouts does the theme claim?"** ({@link themeDefinedIds}) —
 *   the theme's own stylesheet only. A callout listed under *Callouts from your
 *   theme* has to actually come from the theme; a snippet the user wrote is
 *   their own work and belongs in their own list.
 * - **"How hard do I have to push to win?"** ({@link maxClaimClasses}) — theme
 *   **and** every enabled snippet, because studio mode has to outrank whatever
 *   is actually on the page, whoever wrote it.
 *
 * The scan itself is `themeCalloutScan.ts`, which is pure text-in/data-out and
 * knows nothing about caching. Parsing ITS Theme is ~850 KB of text, so both
 * answers are computed once per `stylingSignature` and reused.
 */
import type { App } from "obsidian";
import { enabledSnippetCss, stylingSignature, themeCss } from "./customCssApi";
import {
	mergeScans,
	scanCalloutClaims,
	type ThemeClaim,
	type ThemeScan,
} from "./themeCalloutScan";
import { claimForId } from "./themeClaimLookup";
import {
	resolveAccentDialect,
	type AccentDialect,
	type AccentSpelling,
} from "./accentDialect";
import { scanAccentDialect } from "./accentDialectScan";
import {
	emptySurfaceEvidence,
	scanCalloutSurface,
	type SurfaceEvidence,
} from "./calloutSurfaceScan";
import { resolveCalloutSurface, type CalloutSurface } from "./calloutSurface";

const EMPTY_SCAN: ThemeScan = { byId: new Map(), patterns: [] };
const EMPTY_PROPS: ReadonlySet<string> = new Set();

export class ThemeCalloutStore {
	private signature: string | null = null;
	/** The theme's stylesheet alone — the enumeration source. */
	private themeScan: ThemeScan = EMPTY_SCAN;
	/** Theme plus snippets — the specificity source. */
	private allScan: ThemeScan = EMPTY_SCAN;
	/** Theme plus snippets — the accent-spelling source. See {@link accentDialect}. */
	private dialectEvidence = [scanAccentDialect("")];
	/** Theme plus snippets — the surface source. See {@link calloutSurface}. */
	private surfaceEvidence: SurfaceEvidence[] = [emptySurfaceEvidence()];

	constructor(private readonly app: App) {}

	/**
	 * Drop the memo, so the next question re-scans whatever the signature says.
	 *
	 * {@link refresh} keys on `stylingSignature`, which is theme name, theme
	 * version and enabled snippets — none of which move when a theme is
	 * *reloaded* after being edited in place. A theme that gained a callout id
	 * that way would never get a row. `registerThemeAppearance` notices the reload
	 * by a route this class deliberately does not take (see the note there about
	 * why the CSS text is not in the signature) and calls this.
	 */
	invalidate(): void {
		this.signature = null;
	}

	/**
	 * Re-scan if the active theme or snippet set has changed since last time.
	 * Returns true when the index actually moved.
	 */
	refresh(): boolean {
		const signature = stylingSignature(this.app);
		if (signature === this.signature) return false;
		this.signature = signature;
		const css = themeCss(this.app);
		this.themeScan = scanCalloutClaims(css);
		const snippets = enabledSnippetCss(this.app);
		this.allScan = mergeScans([
			this.themeScan,
			...snippets.map(scanCalloutClaims),
		]);
		// Theme AND snippets, for the same reason `maxImportantClasses` takes
		// both: the spelling that has to work is the one on the page, whoever
		// wrote it.
		this.dialectEvidence = [css, ...snippets].map(scanAccentDialect);
		// Theme AND snippets again, and for a third reason: a snippet that blanks
		// the callout background is exactly as binding as a theme that does.
		this.surfaceEvidence = [css, ...snippets].map(scanCalloutSurface);
		return true;
	}

	/**
	 * Which spelling of `--callout-*` the active styling expects — see
	 * `accentDialect.ts` for why the running Obsidian version is only half the
	 * answer, and why "read" and "declared" are two questions rather than one.
	 *
	 * `core` is the spelling the running Obsidian itself uses, and is the
	 * fallback wherever the active styling has no opinion — which is 196 of the
	 * 257 themes in the dev vault, and is what keeps this change invisible in
	 * those vaults.
	 */
	accentDialect(core: AccentSpelling): AccentDialect {
		this.refresh();
		return resolveAccentDialect(this.dialectEvidence, core);
	}

	/**
	 * What the active styling says about the surface of a callout it does not
	 * name — see `calloutSurface.ts` for the two facts and the veto between them.
	 *
	 * Unlike {@link themeDefinedIds} this reads snippets too, and unlike
	 * {@link claimedProps} it never asks about an id: the whole question is what
	 * happens to a callout the styling has never heard of, which is every callout
	 * this plugin invents.
	 */
	calloutSurface(): CalloutSurface {
		this.refresh();
		return resolveCalloutSurface(this.surfaceEvidence);
	}

	/**
	 * The callout ids the active theme names outright, in Obsidian's own
	 * attribute form.
	 *
	 * Enumeration reads only the operators that name one callout —
	 * `[data-callout="definition"]` and `[data-callout~="definition"]` count,
	 * `[data-callout*="column"]` does not — because a family match names no
	 * callout: it says "everything containing this", and inventing a callout
	 * called *column* out of it would put a type in the user's list that
	 * nothing in their vault or their theme ever declared. That asymmetry is
	 * `themeCalloutScan`'s central rule; this is the surface that depends on it.
	 *
	 * Callers must compare against `obsidianCalloutAttrId(def.id)`, never the
	 * raw id: what is written in CSS is the dasherized attribute form.
	 */
	themeDefinedIds(): ReadonlySet<string> {
		this.refresh();
		return new Set(this.themeScan.byId.keys());
	}

	/**
	 * The theme's **family** selectors — `[data-callout*="col"]` and friends —
	 * which name no callout but would catch one.
	 *
	 * Deliberately separate from {@link themeDefinedIds}, and read only by the
	 * editor's ID field. A family match cannot mint a row (there is no id to
	 * mint) and cannot decide ownership (whether this plugin wins is a live
	 * cascade question). What it can do is warn someone about to name a callout
	 * `two-column` in a vault whose theme styles everything matching `column`.
	 */
	patternClaims(): readonly { op: string; value: string }[] {
		this.refresh();
		return this.themeScan.patterns.map(({ op, value }) => ({ op, value }));
	}

	/**
	 * Every property the active styling declares on this callout id, family
	 * matchers included.
	 *
	 * Theme **and** snippets, and deliberately laxer than {@link themeDefinedIds}:
	 * this answers "is somebody already painting this?", not "whose callout is
	 * this?". A `[data-callout*="col"]` rule names no callout and mints no row,
	 * but it does paint one — see `themeClaimLookup.ts` for why that question is
	 * allowed to read the operators enumeration refuses.
	 */
	claimedProps(attrId: string): ReadonlySet<string> {
		this.refresh();
		return claimForId(this.allScan, attrId)?.props ?? EMPTY_PROPS;
	}

	/**
	 * The heaviest class-count any callout selector in the active styling uses
	 * **on a rule that carries `!important`** — which is the only thing studio
	 * mode's selector weight has to clear. See `studioWeightFor` for why the
	 * ordinary rules do not count: an `!important` declaration beats them at
	 * any specificity, so climbing over them would make every selector in the
	 * sheet longer to win a contest that was already won.
	 *
	 * Deliberately the maximum over the **whole** sheet rather than per callout.
	 * A per-id number would be tighter, but it would also mean trusting this
	 * scanner's attribution of every selector to decide whether a callout the
	 * user explicitly asked this plugin to style actually gets styled — and the
	 * cost of being wrong there (studio silently loses a property) is far worse
	 * than a few extra `.callout` repetitions in the emitted CSS. One number
	 * per theme is also one number to read off the sheet when debugging.
	 */
	maxImportantClasses(): number {
		this.refresh();
		let max = 0;
		const consider = (claim: ThemeClaim): void => {
			if (claim.important.size === 0) return;
			if (claim.weight[1] > max) max = claim.weight[1];
		};
		for (const claim of this.allScan.byId.values()) consider(claim);
		for (const { claim } of this.allScan.patterns) consider(claim);
		return max;
	}
}
