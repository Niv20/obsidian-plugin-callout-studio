/**
 * settings/declarative/autocompleteRows.ts — the two switches for the list of
 * callouts that opens after `[!`.
 *
 * Who calls it. The Autocomplete and metadata page (autocompletePage.ts), for
 * its first box.
 *
 * The main idea. Two of Obsidian's switches:
 *
 *   Callout autocomplete            suggestions.callouts
 *   Include your theme's callouts   suggestions.themeCallouts
 *
 * The second is hidden while it would change nothing: while the list is off,
 * and while the theme adds no callouts of its own. Once the user turns it off
 * it stays in sight, so it can be turned back on after a theme change. (The
 * tab redraws on `css-change`, so it comes and goes with the theme.)
 *
 * The list after `|` has its own switch, in the page's second box
 * (metadataRows.ts): the two lists are turned on and off apart.
 */
import { toggleRow } from "./rowParts";
import type { CsSetting, TreeContext } from "./types";

/** The rows' ids: they key the rows, so they never change. */
export const AUTOCOMPLETE_ROWS = {
	callouts: "callout-autocomplete",
	themeCallouts: "suggest-theme-callouts",
} as const;

export function autocompleteRows(ctx: TreeContext): CsSetting[] {
	const suggestions = () => ctx.plugin.settings.suggestions;
	const writer = ctx.plugin.settingsWriter;
	return [
		toggleRow({
			id: AUTOCOMPLETE_ROWS.callouts,
			name: "settings.calloutAutocomplete",
			desc: "settings.calloutAutocompleteDesc",
			key: "suggestions.callouts",
			writer,
		}),
		toggleRow({
			id: AUTOCOMPLETE_ROWS.themeCallouts,
			name: "settings.suggestThemeCallouts",
			desc: "settings.suggestThemeCalloutsDesc",
			key: "suggestions.themeCallouts",
			writer,
			visible: () =>
				suggestions().callouts &&
				(ctx.plugin.registry.getThemeProvided().length > 0 || !suggestions().themeCallouts),
		}),
	];
}
