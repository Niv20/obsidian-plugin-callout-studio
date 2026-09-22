import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	createSourceMenuTitle,
	formatIconCount,
} from "../src/settings/iconpicker/sourceMenuPresentation";
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

describe("icon source download status", () => {
	it("renders a visible, labelled status only when artwork is missing", () => {
		const host = createDiv();
		host.appendChild(
			createSourceMenuTitle({
				label: "Tabler Icons",
				description: "clean and consistent UI icons",
				count: 5_130,
				locale: "en-US",
				exactCount: false,
				notDownloaded: true,
				notDownloadedLabel: "Not downloaded",
				selected: false,
			}),
		);

		const badge = host.querySelector<HTMLElement>(
			".cs-source-download-badge",
		);
		assert.equal(badge?.textContent, "Not downloaded");
		assert.equal(badge?.getAttribute("aria-label"), null);
		assert.equal(badge?.dataset.csTooltip, undefined);
		assert.equal(badge?.querySelector('[aria-hidden="true"]'), null);

		const available = createSourceMenuTitle({
			label: "Lucide",
			description: "Obsidian's own set",
			count: 1_640,
			locale: "he",
			exactCount: false,
			notDownloaded: false,
			notDownloadedLabel: "Not downloaded",
			selected: false,
		});
		assert.equal(available.querySelector(".cs-source-download-badge"), null);
		assert.match(
			available.querySelector(".cs-source-desc")?.textContent ?? "",
			/\u2068.+\u2069/u,
		);
	});
});
