/**
 * The top of the two vault sidebars (finding S10-05), as Obsidian draws the
 * top of its own panes: the pane's field in a `.search-row`; one small icon
 * button at the end of the pane's first row (help beside Convert selected, the
 * format filter beside the type field), not in a row of its own; and the count
 * over one line (`.search-results-info`). No title or sentence of the plugin's
 * own, and nothing of it scrolls with the results.
 *
 * And what each note's group in them can do (ui/sidebarResults.ts): fold its
 * results away with Obsidian's own triangle, and stay folded through a redraw.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { t } from "../src/i18n";
import { en } from "../src/i18n/en";
import { createOccurrencesFrame } from "../src/usage/occurrencesViewFrame";
import { createPortableConversionFrame, splitSelectionSummary, updatePortableSelection } from "../src/portable/portableConversionFrame";
import { addSidebarIconButton } from "../src/ui/sidebarFrame";
import { SidebarFold } from "../src/ui/sidebarFold";
import { createSidebarFileGroup, revealSidebarCard } from "../src/ui/sidebarResults";
import { fakeDom } from "./support/fakeDom";
import { localeEntries } from "./support/localeTables";

describe("shared sidebar headers", () => {
	it("keeps the field, the Convert row and the count line outside the scrolling results", () => {
		fakeDom.light();
		const occurrences = fakeDom.document.body.createDiv();
		const conversion = fakeDom.document.body.createDiv();
		const usage = createOccurrencesFrame(occurrences as unknown as HTMLElement, () => {});
		const portable = createPortableConversionFrame(conversion as unknown as HTMLElement, () => {});
		try {
			for (const root of [occurrences, conversion]) {
				assert.equal(root.querySelector("h2"), null, "no title of its own: the tab names the pane");
				assert.equal(root.querySelector(".cs-sidebar-subtitle"), null);
				assert.equal(root.querySelector(".nav-header"), null, "no row of its own for the pane's one icon");
				const toolbar = root.querySelector(".cs-sidebar-toolbar")!;
				const info = toolbar.querySelector(".search-results-info");
				assert.ok(info, "Obsidian's count line");
				assert.equal(info.querySelectorAll(".search-results-result-count").length, 1);
			}
			// Find callouts: the type field fills Search's field row, with the format filter at its end.
			const picker = occurrences.querySelector(".cs-occurrences-picker");
			assert.ok(picker);
			const searchRow = occurrences.querySelector(".search-row")!;
			assert.equal(searchRow.contains(picker), true);
			assert.equal(searchRow.children.length, 2, "the field and the filter button, nothing else");
			assert.equal(searchRow.children[0], picker);
			assert.equal(searchRow.children[1] as unknown, usage.filter as unknown, "the filter comes after the field");
			assert.equal(usage.filter.getAttribute("aria-label"), t("usage.filterFormat"));
			assert.equal(usage.scroll.contains(usage.results), true);
			assert.equal(usage.scroll.contains(usage.pickerHost), false);
			assert.equal(occurrences.querySelector(".cs-select-dropdown"), null, "the format is an icon button, not a field");
			// Review conversion: Convert with the help button at its end, in a row of its own.
			const convertRow = portable.convert.parentElement!;
			assert.ok(convertRow.hasClass("cs-portable-convert-row"));
			assert.equal(convertRow.children[0], portable.convert as unknown);
			assert.equal(convertRow.children[1], portable.help as unknown, "help comes after Convert selected");
			assert.equal(portable.help.getAttribute("aria-label"), t("portable.help"));
			assert.equal(portable.scroll.contains(portable.results), true);
			assert.equal(portable.scroll.contains(portable.convert), false);
			// The select-all box and the selection's two lines share the count line.
			assert.equal(portable.summary.parentElement, portable.links.parentElement, "one under the other");
			assert.equal(portable.summary.parentElement?.parentElement, portable.all.parentElement);
			assert.equal(portable.all.getAttribute("type"), "checkbox");
			assert.equal(conversion.querySelector('button[data-action="help"]'), null);
			assert.equal(occurrences.querySelector(".cs-occurrences-metrics"), null);
		} finally {
			occurrences.remove(); conversion.remove();
		}
	});

	it("draws a labelled icon button that takes a Tab stop, and Enter or Space", () => {
		fakeDom.light();
		const row = fakeDom.document.body.createDiv();
		try {
			let presses = 0;
			const button = addSidebarIconButton(row as unknown as HTMLElement, { icon: "filter", label: t("usage.filterFormat"), onPress: () => { presses++; } });
			const button_ = button as unknown as typeof row;
			assert.ok(button_.hasClass("clickable-icon") && button_.hasClass("cs-sidebar-icon-button"));
			assert.equal(button_.getAttribute("aria-label"), t("usage.filterFormat"), "read out, and Obsidian's tooltip");
			assert.equal(button_.getAttribute("role"), "button");
			assert.equal(button_.getAttribute("tabindex"), "0");
			button_.fire("click");
			let prevented = false;
			button_.fire("keydown", { key: "Enter", preventDefault: () => { prevented = true; } });
			assert.equal(presses, 2);
			assert.equal(prevented, true);
		} finally {
			row.remove();
		}
	});
});

describe("the selection line of Review conversion", () => {
	/** A plan with only what the selection line reads. */
	const plan = (selected: number, total: number, links: number): never =>
		({ selectedIds: new Array(selected).fill("x"), changes: new Array(total).fill({}), linkCount: links }) as never;

	it("puts the replacements and the heading links on two lines of their own", () => {
		fakeDom.light();
		const root = fakeDom.document.body.createDiv();
		const frame = createPortableConversionFrame(root as unknown as HTMLElement, () => {});
		try {
			updatePortableSelection(frame, plan(74, 74, 3), true);
			assert.equal(frame.summary.textContent, "74 of 74 replacements selected");
			assert.equal(frame.links.textContent, "3 heading links to update");
			assert.equal(frame.links.hidden, false);
			// No link to update is no news: the second line goes, not "0".
			updatePortableSelection(frame, plan(2, 5, 0), true);
			assert.equal(frame.summary.textContent, "2 of 5 replacements selected");
			assert.equal(frame.links.textContent, "");
			assert.equal(frame.links.hidden, true);
			// Nothing to review yet: both lines empty.
			updatePortableSelection(frame, undefined, false);
			assert.equal(frame.summary.textContent, "");
			assert.equal(frame.links.hidden, true);
		} finally {
			root.remove();
		}
	});

	it("cuts a sentence at the separator every language uses, and keeps a sentence without one whole", () => {
		assert.deepEqual(splitSelectionSummary("74 of 74 replacements selected · 3 heading links to update"), ["74 of 74 replacements selected", "3 heading links to update"]);
		assert.deepEqual(splitSelectionSummary("74 of 74 replacements selected"), ["74 of 74 replacements selected", ""]);
	});

	it("finds two lines in the sentence of every translation, so no language shows it as one", () => {
		const all: [string, string | undefined][] = [["en", en["portable.selectionSummary"]], ...localeEntries()
			.map(([id, table]): [string, string | undefined] => [id, table["portable.selectionSummary"]])];
		// A language that has not translated the sentence yet falls back to English, which is checked too.
		const sentences = all.filter((entry): entry is [string, string] => typeof entry[1] === "string");
		assert.ok(sentences.length > 30, "English and every language");
		for (const [id, sentence] of sentences) {
			const [replacements, links] = splitSelectionSummary(sentence);
			assert.ok(replacements.length > 0 && links.length > 0, `${id}: "${sentence}" has no " · " between its two halves`);
			assert.ok(replacements.includes("{{selected}}") && links.includes("{{links}}"), `${id}: the halves hold the right numbers`);
		}
	});
});

describe("a note's group in the sidebars", () => {
	/** A group for `path`, in a fresh host, drawn with `fold`. */
	function drawGroup(fold: SidebarFold, path = "Projects/Launch plan.md") {
		fakeDom.light();
		const host = fakeDom.document.body.createDiv();
		const group = createSidebarFileGroup(host as unknown as HTMLElement, { path, count: 2, fold });
		const section = group.section as unknown as typeof host;
		const foldButton = section.querySelector(".cs-sidebar-fold")!;
		return { host, group, section, foldButton };
	}

	it("has Obsidian's fold triangle beside the name, which still opens the note", () => {
		const { host, group, section, foldButton } = drawGroup(new SidebarFold());
		try {
			assert.ok(section.hasClass("tree-item") && section.hasClass("search-result"));
			assert.ok(foldButton.hasClass("tree-item-icon") && foldButton.hasClass("collapse-icon"), "Obsidian's own triangle, which it turns by the window's direction");
			assert.equal(foldButton.hasClass("is-collapsed"), false);
			assert.equal(foldButton.getAttribute("aria-expanded"), "true");
			assert.equal(foldButton.getAttribute("role"), "button");
			assert.equal(foldButton.getAttribute("tabindex"), "0");
			// Named by the note it folds, not by a label that would also be a tooltip.
			const name = section.querySelector(".cs-sidebar-file-name")!;
			assert.equal(foldButton.getAttribute("aria-labelledby"), name.getAttribute("id"));
			assert.equal(foldButton.getAttribute("aria-label"), null);
			// The name is a separate button, as before.
			const link = group.link as unknown as typeof host;
			assert.equal(link.getAttribute("data-action"), "file");
			assert.equal(link.getAttribute("data-path"), "Projects/Launch plan.md");
			assert.equal(link.contains(foldButton), false, "the triangle is not inside the note's button");
			assert.equal(name.textContent, "Projects/Launch plan");
			assert.ok(group.head.contains(foldButton as never) && group.head.contains(group.link));
		} finally {
			host.remove();
		}
	});

	it("folds and unfolds in place, by click and by keyboard, keeping the memory in step", () => {
		const fold = new SidebarFold();
		const { host, section, foldButton } = drawGroup(fold);
		try {
			foldButton.fire("click");
			assert.equal(section.hasClass("is-collapsed"), true);
			assert.equal(foldButton.hasClass("is-collapsed"), true, "Obsidian turns the triangle by this class");
			assert.equal(foldButton.getAttribute("aria-expanded"), "false");
			assert.equal(fold.isFolded("Projects/Launch plan.md"), true);
			let prevented = false;
			foldButton.fire("keydown", { key: " ", preventDefault: () => { prevented = true; } });
			assert.equal(prevented, true, "Space does not also scroll the pane");
			assert.equal(section.hasClass("is-collapsed"), false);
			assert.equal(foldButton.getAttribute("aria-expanded"), "true");
			assert.equal(fold.isFolded("Projects/Launch plan.md"), false);
			// Other keys do nothing.
			foldButton.fire("keydown", { key: "a", preventDefault: () => {} });
			assert.equal(section.hasClass("is-collapsed"), false);
		} finally {
			host.remove();
		}
	});

	it("is drawn folded again after a redraw, until the user unfolds it", () => {
		const fold = new SidebarFold();
		const first = drawGroup(fold);
		first.foldButton.fire("click");
		first.host.remove();
		// The sidebar draws every group again from scratch whenever anything changes.
		const again = drawGroup(fold);
		try {
			assert.equal(again.section.hasClass("is-collapsed"), true);
			assert.equal(again.foldButton.hasClass("is-collapsed"), true);
			assert.equal(again.foldButton.getAttribute("aria-expanded"), "false");
			// Another note is not affected.
			const other = drawGroup(fold, "Inbox/Ideas.md");
			assert.equal(other.section.hasClass("is-collapsed"), false);
			other.host.remove();
			// A new search starts with everything showing.
			fold.clear();
			const cleared = drawGroup(fold);
			assert.equal(cleared.section.hasClass("is-collapsed"), false);
			cleared.host.remove();
		} finally {
			again.host.remove();
		}
	});

	it("scrolls to the title row, not to a result nobody can see, when the caret is in a folded note", () => {
		const fold = new SidebarFold();
		const { host, group, section, foldButton } = drawGroup(fold);
		try {
			const row = group.matches.createDiv() as unknown as typeof host;
			// Laid out as a scroller 100px tall at the top of the page, with the group's title row at 300px
			// and its (hidden, so zero-sized) result at the top-left corner.
			const scroller = fakeDom.document.body.createDiv() as unknown as HTMLElement;
			Object.assign(scroller, { clientHeight: 100, clientTop: 0, scrollTop: 0, getBoundingClientRect: () => ({ top: 0, bottom: 100 }) });
			Object.assign(group.head, { getBoundingClientRect: () => ({ top: 300, bottom: 320 }) });
			Object.assign(row, { getBoundingClientRect: () => ({ top: 0, bottom: 0 }) });
			foldButton.fire("click");
			assert.equal(section.hasClass("is-collapsed"), true);
			revealSidebarCard(scroller, row as unknown as HTMLElement);
			assert.ok(scroller.scrollTop > 0, "scrolled down to the title row");
			scroller.remove();
		} finally {
			host.remove();
		}
	});
});
