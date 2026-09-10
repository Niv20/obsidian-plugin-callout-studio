/**
 * settings/calloutComboboxRow.ts — one callout in a picker's popup.
 *
 * Deliberately the *same markup* as the `[!` popover's rows
 * (`editor/AutoComplete.ts`), class for class: the two lists offer the same
 * choice and should be the same thing to look at, and reusing those classes
 * means the settings popup needs no row CSS of its own.
 *
 * The id/alias line is drawn by {@link renderCalloutIdLine}, which the popover
 * shares, so a callout cannot describe itself one way in the editor and another
 * way in settings.
 */
import { getLocale } from "../i18n";
import { paintCalloutListIcon } from "../manager/theme/calloutListIcon";
import type { CalloutRegistry } from "../manager/CalloutRegistry";
import type { CalloutDefinition } from "../types";
import { getSortedCalloutIds } from "../utils/sorting";

export interface CalloutComboboxRowOptions {
	isDark: boolean;
	/** Raw query as typed; lowercased here. */
	query: string;
}

/** For many IDs, render what fits on one line and show the rest as an ellipsis. */
const ID_ELLIPSIS = "...";
const ID_SEPARATOR = ", ";

export function renderCalloutComboboxRow(
	rowEl: HTMLElement,
	def: CalloutDefinition,
	registry: CalloutRegistry,
	options: CalloutComboboxRowOptions,
): void {
	rowEl.addClass("callout-studio-suggestion");

	// Icon and accent both come from whoever actually paints this callout — the
	// theme's measured pair when the theme owns the id, a neutral placeholder
	// when a user snippet does. Naming an appearance the callout will not have
	// is the one thing a picker must not do.
	const iconEl = rowEl.createDiv({ cls: "callout-studio-suggestion-icon" });
	const color = paintCalloutListIcon(iconEl, def, registry, options.isDark);
	iconEl.style.color = color;

	const textEl = rowEl.createDiv({ cls: "callout-studio-suggestion-text" });
	const nameEl = textEl.createDiv({
		cls: "callout-studio-suggestion-name",
		text: def.displayName,
	});
	nameEl.style.color = color;

	renderCalloutIdLine(textEl, def, options.query);
}

/**
 * The second line: the callout's id and its aliases.
 *
 * Always drawn, which is the point — the ids are how you find a callout you
 * only half remember, and a line that appears and disappears depending on what
 * you typed is a line you cannot rely on. When a query is present, only the
 * ids/aliases containing it are listed and everything around the matched run is
 * faded; with no query, all of them show unfaded.
 *
 * Shared with the `[!` popover (`editor/AutoComplete.ts`) so the two lists
 * cannot say different things about the same callout.
 */
export function renderCalloutIdLine(
	textEl: HTMLElement,
	def: CalloutDefinition,
	rawQuery: string,
): void {
	const query = rawQuery.trim().toLowerCase();
	const allIds = getSortedCalloutIds(def, getLocale());
	const matches =
		query.length > 0
			? allIds.filter((id) => id.toLowerCase().includes(query))
			: [];
	const toShow = matches.length > 0 ? matches : allIds;
	const highlight = query.length > 0 && matches.length > 0;
	if (toShow.length === 0) return;

	const idEl = textEl.createDiv({ cls: "callout-studio-suggestion-id" });
	idEl.addClass("callout-studio-suggestion-id-truncated");
	const fade = (text: string): void => {
		if (text) {
			idEl.createSpan({
				cls: "callout-studio-suggestion-id-dim",
				text,
			});
		}
	};

	const canvas = createEl("canvas");
	const ctx = canvas.getContext("2d");
	if (ctx) {
		ctx.font = getComputedStyle(idEl).font;
	}
	const measure = (value: string): number =>
		ctx ? ctx.measureText(value).width : value.length * 8;
	const available = Math.max(64, textEl.clientWidth - 8);

	const idsToShow = available === 0
		? toShow
		: (() => {
			const visible: string[] = [];
			toShow.forEach((id, index) => {
				const next = visible.length === 0 ? id : `${visible.join(ID_SEPARATOR)}${ID_SEPARATOR}${id}`;
				const withEllipsis =
					index < toShow.length - 1 ? `${next}${ID_SEPARATOR}${ID_ELLIPSIS}` : next;
				if (measure(withEllipsis) <= available) {
					visible.push(id);
					return;
				}
				if (visible.length === 0) {
					visible.push(id);
				}
				return;
			});
			if (visible.length < toShow.length) {
				visible.push(ID_ELLIPSIS);
			}
			return visible;
		})();

	const appendId = (id: string): void => {
		if (id === ID_ELLIPSIS) {
			idEl.appendText(ID_ELLIPSIS);
			return;
		}
		if (!highlight) {
			idEl.appendText(id);
			return;
		}
		// Matched run stays at normal weight wherever it falls, not only at the
		// start; everything around it fades.
		const at = id.toLowerCase().indexOf(query);
		fade(id.slice(0, at));
		idEl.appendText(id.slice(at, at + query.length));
		fade(id.slice(at + query.length));
	};
	idsToShow.forEach((id, i) => {
		if (i > 0) idEl.appendText(ID_SEPARATOR);
		appendId(id);
	});
}
