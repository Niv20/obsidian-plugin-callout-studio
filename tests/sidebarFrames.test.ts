/**
 * The top of the two vault sidebars (finding S10-05), as Obsidian draws the
 * top of its own panes: a nav header of icon buttons in the view itself,
 * before its content; the pane's field in a `.search-row`; and the count over
 * one line (`.search-results-info`). No title or sentence of the plugin's own,
 * and nothing of it scrolls with the results.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { t } from "../src/i18n";
import { createOccurrencesFrame } from "../src/usage/occurrencesViewFrame";
import { createPortableConversionFrame } from "../src/portable/portableConversionFrame";
import { addSidebarNavButton, createSidebarNavHeader } from "../src/ui/sidebarFrame";
import { fakeDom } from "./support/fakeDom";

describe("shared sidebar headers", () => {
	it("keeps the field, the Convert row and the count line outside the scrolling results", () => {
		fakeDom.light();
		const occurrences = fakeDom.document.body.createDiv();
		const conversion = fakeDom.document.body.createDiv();
		const usage = createOccurrencesFrame(occurrences as unknown as HTMLElement);
		const portable = createPortableConversionFrame(conversion as unknown as HTMLElement);
		try {
			for (const root of [occurrences, conversion]) {
				assert.equal(root.querySelector("h2"), null, "no title of its own: the tab names the pane");
				assert.equal(root.querySelector(".cs-sidebar-subtitle"), null);
				const toolbar = root.querySelector(".cs-sidebar-toolbar")!;
				const info = toolbar.querySelector(".search-results-info");
				assert.ok(info, "Obsidian's count line");
				assert.equal(info.querySelectorAll(".search-results-result-count").length, 1);
			}
			// Find callouts: the type field fills Search's field row.
			const picker = occurrences.querySelector(".cs-occurrences-picker");
			assert.ok(picker);
			assert.equal(occurrences.querySelector(".search-row")?.contains(picker), true);
			assert.equal(usage.scroll.contains(usage.results), true);
			assert.equal(usage.scroll.contains(usage.pickerHost), false);
			assert.equal(occurrences.querySelector(".cs-select-dropdown"), null, "the format is a nav button now, not a field");
			// Review conversion: Convert in a row of its own, the select-all box on the count line.
			assert.ok(portable.convert.parentElement?.hasClass("cs-portable-convert-row"));
			assert.equal(portable.scroll.contains(portable.results), true);
			assert.equal(portable.scroll.contains(portable.convert), false);
			assert.equal(portable.summary.parentElement, portable.all.parentElement);
			assert.equal(portable.all.getAttribute("type"), "checkbox");
			assert.equal(conversion.querySelector('button[data-action="help"]'), null, "help is in the nav header");
			assert.equal(occurrences.querySelector(".cs-occurrences-metrics"), null);
		} finally {
			occurrences.remove(); conversion.remove();
		}
	});

	it("puts Obsidian's nav header first in the view, with labelled icon buttons", () => {
		fakeDom.light();
		const view = fakeDom.document.body.createDiv({ cls: "workspace-leaf-content" });
		const content = view.createDiv({ cls: "view-content" });
		try {
			const { header, buttons } = createSidebarNavHeader(view as unknown as HTMLElement);
			const header_ = header as unknown as typeof view;
			assert.equal(view.children[0], header_, "before the content, as Obsidian's panes have it");
			assert.equal(view.children[1], content);
			assert.ok(header_.hasClass("nav-header"));
			let presses = 0;
			const button = addSidebarNavButton(buttons, { icon: "filter", label: t("usage.filterFormat"), onPress: () => { presses++; } });
			const button_ = button as unknown as typeof view;
			assert.ok(button_.hasClass("clickable-icon") && button_.hasClass("nav-action-button"));
			assert.equal(button_.getAttribute("aria-label"), t("usage.filterFormat"), "read out, and Obsidian's tooltip");
			assert.equal(button_.getAttribute("role"), "button");
			assert.equal(button_.getAttribute("tabindex"), "0");
			button_.fire("click");
			let prevented = false;
			button_.fire("keydown", { key: "Enter", preventDefault: () => { prevented = true; } });
			assert.equal(presses, 2);
			assert.equal(prevented, true);
		} finally {
			view.remove();
		}
	});
});
