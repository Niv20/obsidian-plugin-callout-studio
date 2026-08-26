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

const EMPTY_SCAN: ThemeScan = { byId: new Map(), patterns: [] };

export class ThemeCalloutStore {
	private signature: string | null = null;
	/** The theme's stylesheet alone — the enumeration source. */
	private themeScan: ThemeScan = EMPTY_SCAN;
	/** Theme plus snippets — the specificity source. */
	private allScan: ThemeScan = EMPTY_SCAN;

	constructor(private readonly app: App) {}

	/**
	 * Drop the memo, so the next question re-scans whatever the signature says.
	 *
	 * {@link refresh} keys on `stylingSignature`, which is theme name, theme
	 * version and enabled snippets — none of which move when a theme is
	 * *reloaded* after being edited in place. A theme that gained a callout id
	 * that way would never get a row. `registerThemeRowSync` notices the reload
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
		this.allScan = mergeScans([
			this.themeScan,
			...enabledSnippetCss(this.app).map(scanCalloutClaims),
		]);
		return true;
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
