/**
 * settings/declarative/autocompletePage.ts — the Autocomplete and metadata
 * settings page: the lists that open as a callout is typed, and the colours a
 * callout takes from its metadata.
 *
 * Who calls it. The settings tab, for the main page's Editor box
 * (settingsTree.ts).
 *
 * The main idea. One page, two boxes, one for each place in the callout's
 * first line, each under a heading (Callouts, Metadata):
 *
 *   after `[!`    Callout autocomplete, Include your theme's callouts
 *                 (autocompleteRows.ts)
 *   after `|`     Metadata colors, Metadata autocomplete, Include your theme's
 *                 words, Your words (metadataRows.ts)
 *
 * The two lists are turned on and off apart: neither box's switches read the
 * other's.
 */
import { t } from "../../i18n";
import { autocompleteRows } from "./autocompleteRows";
import { metadataRows } from "./metadataRows";
import type { CsPage, TreeContext } from "./types";

/** The ids of the page and its two boxes: they key them, so they never change. */
export const AUTOCOMPLETE_PAGE = {
	page: "autocomplete-and-metadata",
	calloutsBox: "callout-autocomplete-settings",
	metadataBox: "metadata-settings",
} as const;

/**
 * The row that opens the page, and the page. The second heading reuses the
 * name the Metadata page had (`settings.metadataPage`), translated already.
 */
export function autocompletePage(ctx: TreeContext): CsPage {
	return {
		type: "page",
		id: AUTOCOMPLETE_PAGE.page,
		name: t("settings.autocompleteAndMetadata"),
		desc: t("settings.autocompleteAndMetadataDesc"),
		items: [
			{
				type: "group",
				id: AUTOCOMPLETE_PAGE.calloutsBox,
				items: autocompleteRows(ctx),
			},
			{
				type: "group",
				id: AUTOCOMPLETE_PAGE.metadataBox,
				heading: t("settings.metadataPage"),
				items: metadataRows(ctx),
			},
		],
	};
}
