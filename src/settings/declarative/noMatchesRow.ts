/**
 * settings/declarative/noMatchesRow.ts — what a callout list says while its
 * search finds nothing.
 *
 * Who calls it. calloutListPage.ts (Built-in callouts and Callouts from your
 * theme, whose search the plugin draws) and calloutPages.ts (My callout types,
 * whose search Obsidian draws).
 *
 * The main idea. A list's search only hides the rows that do not match, so a
 * search for something that is not there leaves an empty box and nothing says
 * why. This is the grey row Obsidian draws for an empty list
 * (`mod-empty-state`), with the brush mascot over the words: it looks around
 * while the query is being typed, then is sad that nothing matches
 * (`SearchMascot`, ui/mascot/mascotPlaces.ts).
 *
 * The row only knows how to say "nothing matches" and how to put the mascot
 * away. When it is shown is the owner's call, because the two kinds of list
 * show and hide their rows in different ways.
 */
import type { Setting } from "obsidian";
import { t } from "../../i18n";
import { SearchMascot } from "../../ui/mascot/mascotPlaces";

/** Marks the row, for styles.css and for the tests. */
export const NO_MATCHES_CLASS = "cs-no-matches";

export class NoMatchesRow {
	private readonly mascot = new SearchMascot();
	/** The words, kept apart from the mascot so a new query changes only them. */
	private readonly textEl: HTMLElement;

	/**
	 * @param setting The row, already in the list. Its owner shows and hides
	 *   the row itself; this only fills it.
	 */
	constructor(private readonly setting: Setting) {
		setting.setClass("mod-empty-state");
		setting.settingEl.addClass(NO_MATCHES_CLASS);
		// Obsidian puts the words in `nameEl`; clear what is there, and keep
		// the words in a span of our own that the mascot is drawn beside.
		setting.setName("");
		this.textEl = setting.nameEl.createSpan();
	}

	/** The row's element, for its owner to show and hide. */
	get el(): HTMLElement {
		return this.setting.settingEl;
	}

	/** Nothing matches `query`: say so, with the mascot over the words, sad. */
	show(query: string): void {
		this.textEl.setText(t("calloutPicker.noMatches", { query }));
		// The words may have been wiped by a redraw of the row (Obsidian empties
		// the name before it draws a row again); put them back.
		if (this.textEl.parentElement !== this.setting.nameEl) this.setting.nameEl.appendChild(this.textEl);
		this.mascot.showEmpty(this.setting.nameEl);
	}

	/** Something matches again, or nothing is searched for: put the mascot away. */
	hide(): void {
		this.mascot.hide();
	}

	/** The query changed: the mascot glances around. Call it once the list is filtered. */
	typed(): void {
		this.mascot.typed();
	}

	/** The row is going away: stop the mascot. */
	dispose(): void {
		this.mascot.hide();
	}
}
