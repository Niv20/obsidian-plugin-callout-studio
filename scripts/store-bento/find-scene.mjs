/** Production Find controls and results, reflowed for the image 05 tall tile. */
import { installDomHelpers } from "obsidian";
import { setLocale, t } from "../../src/i18n/index.ts";
import { CalloutCombobox } from "../../src/settings/calloutCombobox.ts";
import { createOccurrencesFrame } from "../../src/usage/occurrencesViewFrame.ts";
import { OccurrenceResults } from "../../src/usage/occurrenceResults.ts";
import { OccurrenceTypeChoices, occurrencePickerChoices, ALL_TYPES_ID } from "../../src/usage/occurrenceTypeChoices.ts";
import { scanCalloutOccurrences } from "../../src/usage/scanCalloutOccurrences.ts";
import { makeHost, seedExample } from "../user-guide/fixture-host.mjs";

export async function mountFind() {
	installDomHelpers();
	setLocale("en");
	document.body.className = "theme-dark is-desktop";
	const plugin = makeHost();
	seedExample(plugin);
	const sources = {
		"Launch plan.md": "# [!project] Launch plan\n\nThe first milestone is ready.\n\n## Checklist\n\nReview the release.\n\n> [!note] Next steps\n> Invite the design team.\n",
		"Design review.md": "# Design review\n\n## [!tip] Keep it simple\n",
		"Team notes.md": "# Team notes\n\n## Monday\n\nDiscuss the next release.\n\nOur [!info]{key decisions}.\n",
	};
	const occurrences = Object.entries(sources).flatMap(([path, source]) => scanCalloutOccurrences(path, source));
	const fileCount = Object.keys(sources).length;
	const index = { dataRevision: 1, query: () => ({ occurrences, fileCount }) };
	const types = new OccurrenceTypeChoices(plugin.registry, index);
	const panel = document.body.createDiv({ cls: "view-content cs-occurrences-view", attr: { id: "bento-find" } });
	const frame = createOccurrencesFrame(panel);
	new CalloutCombobox(frame.pickerHost, {
		registry: plugin.registry, choices: () => occurrencePickerChoices(types, ALL_TYPES_ID), value: ALL_TYPES_ID,
		ariaLabel: t("vaultStats.columnType"), labelOf: def => def.id === ALL_TYPES_ID ? t("usage.allTypes") : def.id,
		iconlessOptionId: ALL_TYPES_ID, hideSingleGroup: true, showSingleGroupKey: "browse", onChange() {},
	});
	const summary = t("usage.summary", { count: occurrences.length, files: fileCount });
	frame.summary.textContent = summary;
	new OccurrenceResults(100).render(frame.results, occurrences, 100, true, () => {}, () => {});
	await document.fonts.ready;
	await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
	return {
		selector: "#bento-find", title: "Find callouts across your notes",
		description: "Production All types and All formats selectors, a plain summary of four occurrences in three files, and actual scanner-generated heading, block, and inline references from three synthetic Markdown notes. Spacing is tailored for the store artwork.",
		count: occurrences.length, files: fileCount, summary,
		locations: [...frame.results.querySelectorAll(".cs-occurrences-location")].map(row => row.textContent),
	};
}
