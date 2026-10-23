/**
 * ui/faintCount.ts — the small, faint number that says how many things a
 * heading or a line holds, as Obsidian shows it.
 *
 * What it is for. Obsidian's Search pane ends each file's line with how many
 * matches it holds: a small number in faint text at the end of the line, with
 * no brackets (`.tree-item-flair`). Niv asked on 2026-10-22 for the plugin's
 * "(N)" counts to look like that everywhere (item 57 of the native-look plan):
 *
 * - the file headings of the Find callouts and Review conversion sidebars;
 * - the settings tab's lists ("My callout types 4");
 * - the sections of the setup comparison in Version history;
 * - the library headings in Pick an icon's "All sources" grid;
 * - "Find callouts 12" in a callout row's menu.
 *
 * The main idea. One element, `span.cs-faint-count`, and one rule in
 * `styles.css` that places and colours it: wherever the heading is a row of
 * its own (a flex container), the count is pushed to the row's end, as in
 * Search; elsewhere it simply follows the words.
 *
 * The number keeps a space in front of it, in its text, so a screen reader
 * (and a copy and paste) still reads "My callout types 4", not "types4".
 */
import { getLocale } from "../i18n";

/**
 * Append `count` to `parent` as a faint count.
 *
 * @param parent The heading or line the count belongs to.
 * @param count How many things it holds.
 * @returns The new `span.cs-faint-count`, for a caller that adds a class.
 */
export function appendFaintCount(parent: Node, count: number): HTMLSpanElement {
	return parent.createSpan({
		cls: "cs-faint-count",
		// `toLocaleString` writes the number the way the interface language
		// does: "1,234" in English, "1.234" in German.
		text: ` ${count.toLocaleString(getLocale())}`,
	});
}

/**
 * A title and its count, for a heading that is named in one go — an Obsidian
 * `Setting` heading, whose `setName` replaces its name element's children.
 *
 * The two are siblings, so where the name element is a row of its own (the
 * foldable headings lay it out as one: chevron, then title) the count goes to
 * the row's end, as in Obsidian's Search pane.
 */
export function headingWithCount(title: string, count: number): DocumentFragment {
	const fragment = createFragment();
	fragment.createSpan({ text: title });
	appendFaintCount(fragment, count);
	return fragment;
}
