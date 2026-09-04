/**
 * settings/sections/calloutListsSignature.ts — would this repaint draw anything
 * different?
 *
 * Four subscriptions funnel into the callout lists' refresh and two of them are
 * noisy: `css-change` fires for any theme, snippet or other plugin in the vault,
 * and `registry.onChange` fires on every sync round trip. Each one tore all
 * three lists down and rebuilt them byte-identically. Comparing first is what
 * stops a repaint that had nothing to repaint — and a repaint above the fold is
 * never free, because ten sections and a reader sit below it.
 *
 * ## The whole definition goes in, not the fields a row reads today
 *
 * `CalloutRowRenderer` reads nine fields off a definition plus all four colour
 * pairs, and a curated list here is exactly how the tenth one added later goes
 * stale on screen with nothing to catch it. Serialising the object cannot fall
 * behind the renderer, and the cost is a `JSON.stringify` over tens of rows.
 *
 * Around that go the inputs a row reads that are *not* in a definition: the
 * colour scheme (swatches show the current mode), the theme's name and what the
 * appearance probe measured (theme rows only — the one list that draws it), the
 * locale (id sort order), and the fallback id (the *Default fallback* tag).
 *
 * The paging cursors are in it too, and they have to be: **Load more** changes
 * what is drawn without changing a single definition, so leaving them out would
 * make pressing the button do nothing at all.
 *
 * ## Two inputs are deliberately absent
 *
 * Both are answered with the refresh's `force` flag instead, because no amount
 * of reading the registry can see them:
 *
 * - **Icon artwork.** It lives in a download cache keyed by icon name, so the
 *   definition naming a not-yet-downloaded icon is byte-identical to the one
 *   naming it a second later. A signature alone would freeze every row that came
 *   up on a spinner, spinning, for good.
 * - **A preview definition.** The callout editor registers one transiently and
 *   *without* a registry mutation, by contract, so it may not be visible from
 *   here at all — and following the editor's colour picker live is the entire
 *   reason that signal exists.
 *
 * Both directions of failure are worth naming. A signature that changes when
 * nothing did costs one repaint that the scroll anchor already makes invisible.
 * One that *fails* to change leaves a stale row on screen — so where the two are
 * in tension, this errs toward including more.
 */
import type { CalloutDefinition } from "../../types";
import type { PagingState } from "./listPaging";
import type { RowKind } from "./rowOwnership";
import type { SettingsSectionContext } from "./types";

/** The three lists, already partitioned, in the order they are drawn. */
export type CalloutListRows = Record<RowKind, CalloutDefinition[]>;

/** Every list back to its first page. See `SettingsTab.paging` for the owner. */
export const freshPaging = (): Record<RowKind, PagingState> => ({
	theme: { expanded: false },
	user: { expanded: false },
	builtin: { expanded: false },
});

export function calloutListsSignature(
	ctx: SettingsSectionContext,
	paging: Record<RowKind, PagingState>,
	themeLabel: string,
	locale: string,
	rows: CalloutListRows,
): string {
	const parts: unknown[] = [
		activeDocument.body.classList.contains("theme-dark"),
		themeLabel,
		locale,
		ctx.plugin.settings.fallbackCalloutId,
	];
	const add = (kind: RowKind): void => {
		const defs = rows[kind];
		parts.push(kind, paging[kind].expanded, defs.length);
		for (const def of defs) {
			parts.push(def);
			// Only the theme list draws it — see `renderCalloutRow`.
			if (kind === "theme") {
				parts.push(ctx.plugin.registry.themeAppearanceOf(def));
			}
		}
	};
	add("theme");
	add("user");
	add("builtin");
	return JSON.stringify(parts);
}
