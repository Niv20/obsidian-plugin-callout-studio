import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createSourceMenuTitle, formatIconCount } from "../src/settings/iconpicker/sourceMenuPresentation";
import { readRepoFile } from "./support/sourceScan";
import { installFakeDom } from "./support/fakeDom";

installFakeDom();

describe("icon source menu counts", () => {
	it('shows a pooled library\'s count as a faint count, not a translated "(N)"', () => {
		// The heading is the library's name and a `cs-faint-count` (ui/faintCount.ts),
		// so no language's word order or brackets are involved any more.
		const panel = readRepoFile("src/settings/iconpicker/PackPanel.ts");
		assert.doesNotMatch(panel, /iconPicker\.sourceGroup/);
		assert.match(readRepoFile("src/settings/iconpicker/IconGrid.ts"), /appendFaintCount\(header, heading\.count\)/);
	});

	it("keeps small and user-owned collections exact", () => {
		assert.equal(formatIconCount(42, "en-US", false), "42");
		assert.equal(formatIconCount(3_870, "en-US", true), "3,870");
	});

	it("shows large fixed catalogs as compact lower bounds", () => {
		assert.equal(formatIconCount(383, "en-US", false), "300+");
		assert.equal(formatIconCount(3_870, "en-US", false), "3.8K+");
	});
});

describe("icon source menu rows", () => {
	it("draws the name over the description and its isolated count, and nothing else", () => {
		const row = createSourceMenuTitle({
			label: "Lucide",
			description: "Obsidian's own set",
			count: 1_640,
			locale: "he",
			exactCount: false,
		});
		const text = row.querySelector(".cs-source-text");
		assert.deepEqual(
			Array.from(text?.children ?? [], (child) => child.className),
			["cs-source-name", "cs-source-desc"],
		);
		assert.equal(row.querySelector(".cs-source-name")?.textContent, "Lucide");
		assert.match(row.querySelector(".cs-source-desc")?.textContent ?? "", /⁨.+⁩/u);
		// The ✓ for the chosen library is the shared dropdown's, added to the
		// committed row by `renderComboboxRows` (see iconSourceInteraction).
		assert.equal(row.querySelector(".cs-combobox-check"), null);
	});

	it("has no check of its own left, in the markup or the stylesheet", () => {
		// It used to draw a private `.cs-source-check`, a smaller check in the
		// row's own colour. Every list now marks its choice with one shared ✓.
		assert.doesNotMatch(
			readRepoFile("src/settings/iconpicker/sourceMenuPresentation.ts"),
			/cs-source-check|setIcon/,
		);
		assert.doesNotMatch(readRepoFile("styles.css"), /cs-source-check/);
	});

	it("has no download badge left, in the markup or the stylesheet", () => {
		// The menu lists only libraries this device can draw from, plus the
		// edited icon's own under its own heading, so a per-row status would only
		// repeat a heading. The badge is gone on purpose — not just unstyled.
		const source = readRepoFile("src/settings/iconpicker/sourceMenuPresentation.ts");
		assert.doesNotMatch(source, /download-badge|notDownloaded/);
		assert.doesNotMatch(readRepoFile("styles.css"), /cs-source-download-badge/);
	});
});
