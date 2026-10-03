import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	createSourceMenuTitle,
	formatIconCount,
} from "../src/settings/iconpicker/sourceMenuPresentation";
import { readRepoFile } from "./support/sourceScan";
import { installFakeDom } from "./support/fakeDom";

installFakeDom();

describe("icon source menu counts", () => {
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
			selected: false,
		});
		const text = row.querySelector(".cs-source-text");
		assert.deepEqual(
			Array.from(text?.children ?? [], (child) => child.className),
			["cs-source-name", "cs-source-desc"],
		);
		assert.equal(row.querySelector(".cs-source-name")?.textContent, "Lucide");
		assert.match(row.querySelector(".cs-source-desc")?.textContent ?? "", /⁨.+⁩/u);
		assert.equal(row.querySelector(".cs-source-check"), null);
	});

	it("checks the chosen library", () => {
		const row = createSourceMenuTitle({
			label: "Tabler Icons",
			description: "clean and consistent UI icons",
			count: 5_130,
			locale: "en-US",
			exactCount: false,
			selected: true,
		});
		assert.ok(row.querySelector(".cs-source-check"));
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
