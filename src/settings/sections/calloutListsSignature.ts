/**
 * settings/sections/calloutListsSignature.ts — would drawing the callout lists
 * again show anything different?
 *
 * Who calls it. The settings tab's signature (declarative/declarativeSettings.ts),
 * and the Built-in and theme pages, which draw their own rows
 * (declarative/calloutListPage.ts). Both skip a redraw when it would draw the
 * same thing: `css-change` fires for any theme, snippet or other plugin in the
 * vault, and `registry.onChange` on every sync round trip.
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
 * locale (id sort order), the fallback id (the *Default fallback* tag), and
 * the theme's styles switch.
 *
 * ## Two inputs are deliberately absent
 *
 * Both are answered with a forced redraw instead, because no amount of reading
 * the registry can see them:
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
 * nothing did costs one redraw. One that *fails* to change leaves a stale row
 * on screen — so where the two are in tension, this errs toward including more.
 */
import type { CalloutDefinition } from "../../types";
import type { RowKind } from "./rowOwnership";
import type { SettingsContext } from "./types";

/** The three lists, already partitioned, in the order they are drawn. */
export type CalloutListRows = Record<RowKind, CalloutDefinition[]>;

/**
 * The three lists as one string, with what their rows read besides the
 * definitions. Equal strings mean drawing the lists again would change nothing.
 */
export function calloutListsSignature(
	ctx: SettingsContext,
	themeLabel: string,
	locale: string,
	rows: CalloutListRows,
): string {
	const parts: unknown[] = [
		activeDocument.body.classList.contains("theme-dark"),
		themeLabel,
		locale,
		ctx.plugin.settings.fallbackCalloutId,
		// The theme's styles switch: with no theme rows, nothing else here
		// would move when it is flipped.
		ctx.plugin.registry.settings.themeCalloutStyles.enabled,
	];
	const add = (kind: RowKind): void => {
		const defs = rows[kind];
		parts.push(kind, defs.length);
		for (const def of defs) {
			parts.push(def);
			// Only the theme list draws it — see `drawCalloutRow`.
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
