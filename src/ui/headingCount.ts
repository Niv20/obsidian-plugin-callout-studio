/**
 * ui/headingCount.ts — the "(N)" after a heading's title.
 *
 * Four surfaces title a list with how many things it holds: the settings tab's
 * lists ("My callout types (4)"), the groups in Restore an earlier setup, the
 * sections of the setup comparison, and the file headings of both vault
 * sidebars (Find callouts, Review conversion). Each used to build its own
 * suffix — one space from the title, a space and a margin, or a flex gap and a
 * margin — so the count sat at three different distances, in the heading's
 * colour in one place and grey in the next. They all come through here now,
 * and `.cs-heading-count` in `styles.css` is the one rule that places and
 * colours it.
 *
 * The space before "(" is part of the span's text rather than left to layout,
 * so a heading still reads — and is announced as — "My callout types (4)"
 * however it is laid out; `styles.css` keeps that space even where the count
 * opens a flex item of its own.
 *
 * Only for a count that annotates a heading. A count that is part of a label —
 * "Find usages (134)" in a callout's menu, "Load more (14)", "Import valid
 * only (3)", the icon total in an icon source's description — reads as one
 * piece of text and stays in that text's colour and spacing.
 */
import { getLocale } from "../i18n";

/** Append `count` to a heading as its "(N)"; returns the span. */
export function appendHeadingCount(heading: Node, count: number): HTMLSpanElement {
	return heading.createSpan({
		cls: "cs-heading-count",
		text: ` (${count.toLocaleString(getLocale())})`,
	});
}

/**
 * A title and its count, for a heading that is named in one go — an Obsidian
 * `Setting` heading, whose `setName` replaces its name element's children.
 *
 * The two come wrapped in one span because the foldable headings lay their
 * name element out as a flex row, chevron then title. Left unwrapped, the
 * title and its count would be two flex items: the flex gap would join the
 * space between them, and a title long enough to wrap would wrap beside its
 * count instead of carrying it to the end of its last line.
 */
export function headingWithCount(title: string, count: number): DocumentFragment {
	const fragment = createFragment();
	const label = fragment.createSpan({ text: title });
	appendHeadingCount(label, count);
	return fragment;
}
