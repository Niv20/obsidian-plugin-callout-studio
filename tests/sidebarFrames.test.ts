import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { t } from "../src/i18n";
import { createOccurrencesFrame } from "../src/usage/occurrencesViewFrame";
import { createPortableConversionFrame } from "../src/portable/portableConversionFrame";
import { fakeDom } from "./support/fakeDom";

describe("shared sidebar headers", () => {
	it("keeps both titles, subtitles, controls and summaries outside scrolling results", () => {
		fakeDom.light();
		const occurrences = fakeDom.document.body.createDiv();
		const conversion = fakeDom.document.body.createDiv();
		const usage = createOccurrencesFrame(occurrences as unknown as HTMLElement);
		const portable = createPortableConversionFrame(conversion as unknown as HTMLElement);
		try {
			for (const root of [occurrences, conversion]) {
				const toolbar = root.querySelector(".cs-sidebar-toolbar")!;
				assert.equal(toolbar.querySelectorAll("h2.cs-sidebar-title").length, 1);
				assert.equal(toolbar.querySelectorAll(".cs-sidebar-subtitle").length, 1);
				assert.equal(toolbar.querySelectorAll(".cs-sidebar-summary").length, 1);
				assert.equal(toolbar.querySelector(".cs-sidebar-grid"), null);
			}
			assert.equal(usage.scroll.contains(usage.results), true);
			assert.equal(usage.scroll.contains(usage.pickerHost), false);
			assert.equal(portable.scroll.contains(portable.results), true);
			assert.equal(portable.scroll.contains(portable.convert), false);
			assert.ok(portable.convert.parentElement?.querySelector(".cs-sidebar-subtitle"));
			assert.equal(portable.summary.parentElement, portable.all.parentElement);
			assert.equal(portable.all.getAttribute("type"), "checkbox");
			assert.equal(conversion.querySelector('button[data-action="all"]'), null);
			assert.equal(conversion.querySelector('button[data-action="none"]'), null);
			assert.equal(occurrences.querySelector(".cs-occurrences-metrics"), null);
			assert.equal(occurrences.querySelector(".cs-sidebar-filter-label"), null);
			assert.equal(occurrences.querySelectorAll(".cs-sidebar-filter").length, 2);
			const formatInput = occurrences.querySelector(".cs-select-dropdown .cs-combobox-input");
			assert.equal(occurrences.querySelector(`#${formatInput?.getAttribute("aria-labelledby")}`)?.textContent,
				t("commandBuilder.format"));
		} finally {
			usage.roleSelect.destroy();
			occurrences.remove(); conversion.remove();
		}
	});
});
