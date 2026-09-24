import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { DEFAULT_SETTINGS } from "../src/constants";
import { t } from "../src/i18n";
import type { PackDataStore } from "../src/icons/PackDataStore";
import { ImagePanel, type ImagePanelHost } from "../src/settings/iconpicker/ImagePanel";
import { IconPicker, type IconPickerPlugin } from "../src/settings/iconpicker/IconPickerModal";
import type { CalloutIcon, UserImageIcon } from "../src/types";
import { ConfirmModal } from "../src/utils/ConfirmModal";
import { asEl, fakeDom, type FakeElement } from "./support/fakeDom";

function picture(id: string, name: string, addedAt: number): UserImageIcon {
	return {
		id, name, addedAt, format: "svg", svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>',
		width: 24, height: 24, monochrome: false, rev: 1,
	};
}

function panelHarness(initial: UserImageIcon[] = []) {
	let images = [...initial];
	const selections: CalloutIcon[] = [];
	const deletions: string[] = [];
	const saves: string[][] = [];
	const root = fakeDom.document.body.createDiv();
	const host: ImagePanelHost = {
		app: {} as App,
		allCallouts: () => [],
		images: () => images,
		saveImages: (next) => {
			images = [...next];
			saves.push(images.map((image) => image.id));
		},
		selectedIcon: () => null,
		onSelect: (icon) => { selections.push(icon); },
		onDelete: (id) => { deletions.push(id); },
	};
	const panel = new ImagePanel(asEl(root), host);
	return { root, panel, images: () => images, selections, deletions, saves,
		destroy: () => { panel.dispose(); root.remove(); } };
}

function wrapperFor(root: FakeElement, name: string): FakeElement {
	const wrapper = root.querySelectorAll(".icon-picker-cell-wrap").find((candidate) =>
		candidate.querySelector(".icon-picker-cell")?.getAttribute("aria-label") === name,
	);
	assert.ok(wrapper, `missing grid cell for ${name}`);
	return wrapper;
}

describe("custom icon picker actions", () => {
	it("keeps the upload control icon only and accessible even when the grid is empty", async () => {
		const h = panelHarness();
		try {
			await h.panel.render();
			const upload = h.root.querySelector(".icon-picker-image-add");
			const fileInput = h.root.querySelector(".icon-picker-image-input");
			assert.ok(upload);
			assert.ok(fileInput);
			assert.equal(upload.tagName, "BUTTON");
			assert.equal(upload.getAttribute("aria-label"), t("iconPicker.uploadCustom"));
			assert.equal(upload.textContent, "", "the upload button has no visible label");
			assert.equal(h.root.querySelector(".icon-picker-image-delete"), null,
				"deletion belongs to each image, not the toolbar");
			assert.equal(h.root.querySelector(".icon-picker-image-empty-title")?.textContent,
				t("iconPicker.customEmptyTitle"));
			assert.equal(h.root.querySelector(".icon-picker-image-empty-hint")?.textContent,
				t("iconPicker.customEmptyHint"));
			assert.equal(h.root.querySelector(".icon-picker-image-empty-formats")?.textContent,
				t("iconPicker.customEmptyFormats"));

			let chooserOpens = 0;
			(fileInput as unknown as { click: () => void }).click = () => { chooserOpens++; };
			upload.fire("click");
			assert.equal(chooserOpens, 1);
		} finally { h.destroy(); }
	});

	it("deletes the hovered image only after confirmation without selecting its cell", async () => {
		const first = picture("img-first", "first.svg", 2);
		const second = picture("img-second", "second.svg", 1);
		const h = panelHarness([first, second]);
		const originalConfirm = Object.getOwnPropertyDescriptor(ConfirmModal.prototype, "confirm")!;
		let answer!: (confirmed: boolean) => void;
		let prompts = 0;
		try {
			ConfirmModal.prototype.confirm = () => {
				prompts++;
				return new Promise<boolean>((resolve) => { answer = resolve; });
			};
			await h.panel.render();
			assert.equal(h.root.querySelectorAll(".icon-picker-cell-wrap").length, 2);
			const wrapper = wrapperFor(h.root, "first.svg");
			const cell = wrapper.querySelector(".icon-picker-cell");
			const remove = wrapper.querySelector("button");
			assert.ok(cell);
			assert.ok(remove);
			assert.equal(cell.parentElement, wrapper);
			assert.equal(remove.parentElement, wrapper, "the X is a sibling of the selectable cell");
			assert.equal(remove.getAttribute("aria-label"),
				t("iconPicker.customDeleteConfirm", { name: first.name }),
				"the icon-only X names the image it will delete");

			remove.fire("click");
			assert.equal(prompts, 1);
			assert.deepEqual(h.selections, [], "clicking X must not choose the image");
			assert.deepEqual(h.saves, [], "the image remains while confirmation is open");
			answer(false);
			await Promise.resolve();
			assert.deepEqual(h.images().map((image) => image.id), [first.id, second.id]);

			remove.fire("click");
			assert.equal(prompts, 2);
			answer(true);
			await Promise.resolve();
			assert.deepEqual(h.saves, [[second.id]]);
			assert.deepEqual(h.deletions, [first.id]);
			assert.deepEqual(h.selections, []);
			assert.equal(h.root.querySelectorAll(".icon-picker-cell-wrap").length, 1);
			assert.ok(wrapperFor(h.root, "second.svg"));
		} finally {
			Object.defineProperty(ConfirmModal.prototype, "confirm", originalConfirm);
			h.destroy();
		}
	});

	it("clears the picker preview when the selected custom icon is deleted", async () => {
		const selected = picture("img-selected", "selected.svg", 1);
		let images = [selected];
		const plugin = {
			app: {} as App,
			settings: structuredClone(DEFAULT_SETTINGS),
			registry: {
				getUserImages: () => images,
				setUserImages: (next: readonly UserImageIcon[]) => { images = [...next]; },
				getAll: () => [],
			},
			saveSettings: async () => {},
			ensureIconArtwork: async () => {},
			icons: { packs: {} as PackDataStore },
		} as IconPickerPlugin;
		const picker = new IconPicker(plugin, { type: "image", value: selected.id });
		const root = fakeDom.document.body.createDiv();
		const panelHostEl = root.createDiv();
		const previewEl = root.createDiv();
		const confirmBtn = root.createEl("button");
		Object.assign(picker, {
			panelHostEl: asEl(panelHostEl),
			previewEl: asEl(previewEl),
			confirmBtn: asEl(confirmBtn),
		});
		const privatePicker = picker as unknown as {
			showPanel(): Promise<void>;
			updatePreview(): void;
			panel: { dispose(): void } | null;
		};
		const originalConfirm = Object.getOwnPropertyDescriptor(ConfirmModal.prototype, "confirm")!;
		try {
			ConfirmModal.prototype.confirm = async () => true;
			privatePicker.updatePreview();
			assert.match(previewEl.textContent, /selected\.svg/);
			await privatePicker.showPanel();
			const remove = wrapperFor(panelHostEl, selected.name).querySelector("button");
			assert.ok(remove);
			remove.fire("click");
			await Promise.resolve();
			assert.deepEqual(images, []);
			assert.equal(previewEl.textContent, t("iconPicker.noIconSelected"));
			assert.equal(confirmBtn.hasClass("is-disabled"), true);
		} finally {
			Object.defineProperty(ConfirmModal.prototype, "confirm", originalConfirm);
			privatePicker.panel?.dispose();
			root.remove();
		}
	});
});
