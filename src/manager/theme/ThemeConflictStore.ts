/**
 * manager/theme/ThemeConflictStore.ts — "which of my callouts does the active
 * theme also style?", answered lazily and cached.
 *
 * ## Where this deliberately does *not* live
 *
 * Not in `main.ts`, and not on the `css-change` listener the plugin already
 * has. Parsing ITS Theme is ~850 KB of text, and `css-change` already costs a
 * full editor rebuild — adding a scan to it would tax every user on every theme
 * tweak to populate a report almost none of them are looking at. The report is
 * only ever *shown* in the settings tab, so the settings tab is what asks, and
 * a vault whose owner never opens settings never pays anything at all.
 *
 * The cache means the scan is one pass per theme/snippet change rather than one
 * per settings render, and `refresh()` is a no-op when the signature matches.
 */
import type { App } from "obsidian";
import type { CalloutDefinition } from "../../types";
import { obsidianCalloutAttrId } from "../../utils/calloutId";
import { styleModeOf } from "../styleMode";
import { enabledSnippetCss, stylingSignature, themeCss } from "./customCssApi";
import {
	claimForId,
	mergeScans,
	scanCalloutClaims,
	type ThemeClaim,
	type ThemeScan,
} from "./themeCalloutScan";

/** One callout the active styling has an opinion about. */
export interface ThemeConflict {
	id: string;
	displayName: string;
	/** What the theme declares for it, and how hard. */
	claim: ThemeClaim;
	/**
	 * True when the theme outranks a *standard* per-callout rule, which sits at
	 * two class-units (`.callout` + the attribute). This is the difference
	 * between "the theme also has an opinion" and "the theme is winning".
	 */
	themeWins: boolean;
	/** Properties the theme marked `!important`, which force cannot beat. */
	unbeatable: string[];
}

export class ThemeConflictStore {
	private signature: string | null = null;
	private scan: ThemeScan = { byId: new Map(), prefixes: new Map() };

	constructor(private readonly app: App) {}

	/**
	 * Re-scan if the active theme or snippet set has changed since last time.
	 * Returns true when the index actually moved.
	 */
	refresh(): boolean {
		const signature = stylingSignature(this.app);
		if (signature === this.signature) return false;
		this.signature = signature;
		this.scan = mergeScans([
			scanCalloutClaims(themeCss(this.app)),
			...enabledSnippetCss(this.app).map(scanCalloutClaims),
		]);
		return true;
	}

	/** Drop the cache, so the next `refresh()` re-reads even if nothing moved. */
	invalidate(): void {
		this.signature = null;
	}

	/**
	 * The conflicts among `defs`, worst first.
	 *
	 * A callout already handed to the theme is not a conflict — the user
	 * settled it. One already forced is still listed, because the report is
	 * also how they check that the fix took.
	 */
	conflicts(defs: CalloutDefinition[]): ThemeConflict[] {
		this.refresh();
		const out: ThemeConflict[] = [];
		for (const def of defs) {
			if (styleModeOf(def) === "theme") continue;
			const claim = claimForId(this.scan, obsidianCalloutAttrId(def.id));
			if (!claim) continue;
			out.push({
				id: def.id,
				displayName: def.displayName,
				claim,
				// `.callout[data-callout="x"]` is two class-units. Strictly
				// greater, because an equal count is a tie, and a tie is one
				// this plugin wins on source order (adoptedStyleSheets last).
				themeWins: claim.maxClasses > 2,
				unbeatable: [...claim.important].sort(),
			});
		}
		out.sort(
			(a, b) =>
				Number(b.themeWins) - Number(a.themeWins) ||
				b.claim.maxClasses - a.claim.maxClasses ||
				a.id.localeCompare(b.id),
		);
		return out;
	}
}
