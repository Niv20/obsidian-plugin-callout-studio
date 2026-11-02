/**
 * tests/licenseModal.test.ts — the License window (finding S8-17).
 *
 * A sentence that the plugin is open source, ending in a link to the license on
 * GitHub, and the icon libraries. The libraries are one Obsidian setting group, a row per
 * library, the way Installed plugins lists plugins: the name as a link with its
 * version in Obsidian's small muted type, and a line per licence under it.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { LicenseModal } from "../src/settings/LicenseModal";
import { ICON_SOURCE_IDS, getSource } from "../src/icons/registry";
import { asEl, el, installFakeDom, type FakeElement } from "./support/fakeDom";

installFakeDom();

function open() {
	const app = {} as App;
	const modal = new LicenseModal(app);
	const container = el({ cls: "modal-container" });
	const modalEl = container.createDiv({ cls: "modal" });
	const content = modalEl.createDiv({ cls: "modal-content" });
	const titleEl = modalEl.createDiv();
	// The stub Modal keeps nothing, so the window gets what Obsidian's would hold.
	Object.assign(modal, {
		app,
		containerEl: asEl(container),
		modalEl: asEl(modalEl),
		contentEl: asEl(content),
		titleEl: asEl(titleEl),
		setTitle: (text: string) => titleEl.setText(text),
	});
	modal.onOpen();
	return { modal, content, titleEl };
}

describe("License", () => {
	it("is titled License", () => {
		const { modal, titleEl } = open();
		try {
			assert.equal(titleEl.textContent, "License");
		} finally {
			modal.onClose();
		}
	});

	it("promises the plugin stays open source, and links the license on GitHub", () => {
		const { modal, content } = open();
		try {
			const promise = content.querySelectorAll("p")[0]!;
			assert.equal(
				promise.textContent,
				"Callout Studio is open source, and it will stay that way. You can find its license here.",
			);
			const link = promise.querySelector("a")!;
			assert.equal(link.textContent, "here");
			assert.equal(
				link.getAttribute("href"),
				"https://github.com/Niv20/obsidian-plugin-callout-studio/blob/master/LICENSE",
			);
			assert.equal(link.getAttribute("target"), "_blank");
		} finally {
			modal.onClose();
		}
	});

	it("has no mascot, and no row of its own for the plugin's license", () => {
		const { modal, content } = open();
		try {
			assert.equal(content.querySelectorAll(".cs-mascot-box").length, 0);
			assert.equal(content.querySelectorAll(".setting-group").length, 1, "only the icons' box");
		} finally {
			modal.onClose();
		}
	});

	it("lists every library with artwork to attribute, one row each, in one Obsidian box", () => {
		const { modal, content } = open();
		try {
			const group = content.querySelector(".setting-group")!;
			const rows = group.querySelectorAll(".setting-item");
			const credited = ICON_SOURCE_IDS.filter((id) => getSource(id).attribution.licenses.length > 0);
			assert.equal(rows.length, credited.length);
			assert.equal(group.querySelector(".setting-items")!.getAttribute("role"), "list");
			for (const row of rows) assert.equal(row.getAttribute("role"), "listitem");
		} finally {
			modal.onClose();
		}
	});

	it("names each library with a link and its version, and its licences under it", () => {
		const { modal, content } = open();
		try {
			const pack = getSource("lucide");
			const row = content
				.querySelectorAll(".setting-item")
				.find(
					(r: FakeElement) => r.querySelector(".setting-item-name a")?.textContent === pack.attribution.title,
				);
			assert.ok(row, "a row for Lucide");
			const version = row.querySelector(".setting-item-name .u-muted");
			assert.equal(version?.textContent, pack.attribution.version);
			assert.ok(
				version?.hasClass("u-small"),
				"Obsidian's small muted type, as Installed plugins prints a version",
			);
			const desc = row.querySelector(".setting-item-description")!;
			for (const license of pack.attribution.licenses) {
				assert.ok(desc.textContent.includes(license.holder), license.holder);
				assert.ok(
					desc.querySelectorAll("a").some((a) => a.textContent === license.name),
					license.name,
				);
			}
		} finally {
			modal.onClose();
		}
	});
});
