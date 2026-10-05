/**
 * tests/iconPickerLibraries.test.ts — Pick an icon, as the Icon libraries
 * window shapes it.
 *
 * The source menu lists All sources and then the libraries the window shows
 * above its line, in that order, each group under its own heading, and closes
 * with how many libraries are left to download there. The library of the icon
 * being edited, when the picker does not offer it — deleted, never downloaded
 * here, or hidden — comes first under a heading of its own: re-editing an icon
 * must always be able to show where it lives.
 *
 * When the window closes having changed something, the picker takes it in: a
 * library that was offered and no longer is gives way to All sources, and an
 * icon from it stops being the selection (confirming it would download that
 * library again). The panel is rebuilt only when what it shows changed, so the
 * grid does not jump back to the selected icon over an unrelated change.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { setImmediate } from "node:timers/promises";
import { DEFAULT_SETTINGS } from "../src/constants";
import { t } from "../src/i18n";
import { PACK_MANIFEST } from "../src/icons/data/packManifest";
import { libraryFiles } from "../src/icons/iconLibraries";
import { ICON_SOURCE_IDS, getSource } from "../src/icons/registry";
import type { IconIndex } from "../src/icons/types";
import { createAllSourcesPack } from "../src/settings/iconpicker/allSources";
import { IconLibrariesModal } from "../src/settings/iconpicker/IconLibrariesModal";
import { IconPicker, type IconPickerPlugin } from "../src/settings/iconpicker/IconPickerModal";
import { PackPanel, type PackPanelHost } from "../src/settings/iconpicker/PackPanel";
import type { CalloutIcon, IconPackId, IconSourceId, PluginSettings } from "../src/types";
import type { IconLibrariesHost } from "../src/settings/iconpicker/IconLibrariesModal";
import { blankLiterals, readRepoFile } from "./support/sourceScan";
import { asEl, fakeDom, type FakeElement } from "./support/fakeDom";
import { TestKeymap, TestScope } from "./support/fakeKeymap";

const emptyIndex: IconIndex = { entries: [], categories: [] };

interface Picker {
	selectSource(id: IconSourceId | "all"): void;
	menuLibraries(): { current: IconSourceId | null; libraries: IconSourceId[]; toDownload: IconSourceId[] };
	activeSource: string;
	selectedIcon: CalloutIcon | null;
	openLibraries(): Promise<void>;
}

function harness(
	current: CalloutIcon,
	prepare: (settings: PluginSettings) => void = () => {},
	ready = new Set<string>(),
	editing?: { id: string | null; name: string },
	loadIndex: (id: IconSourceId) => IconIndex = () => emptyIndex,
) {
	fakeDom.light();
	const originals = ICON_SOURCE_IDS.map((id) => {
		const pack = getSource(id);
		const descriptor = Object.getOwnPropertyDescriptor(pack, "loadIndex")!;
		pack.loadIndex = () => Promise.resolve(loadIndex(id));
		return { pack, descriptor };
	});
	const settings = structuredClone(DEFAULT_SETTINGS);
	prepare(settings);
	const plugin = {
		app: { keymap: new TestKeymap(), scope: new TestScope() }, settings,
		saveSettings: () => Promise.resolve(),
		registry: { getUserImages: () => [], getAll: () => [], getCommitted: () => [] },
		settingsWriter: { isFrozen: false },
		icons: {
			packs: {
				loadAllFromDisk: () => Promise.resolve(),
				onChange: () => () => {},
				state: (id: string) => (ready.has(id) ? "ready" : "unavailable"),
				info: (id: string) => PACK_MANIFEST[id as IconPackId],
			},
			deleteLibrary: () => Promise.resolve(false),
		},
	} as unknown as IconPickerPlugin;
	const modal = new IconPicker(plugin, current, editing);
	const containerEl = fakeDom.document.body.createDiv({ cls: "modal-container" });
	const modalEl = containerEl.createDiv({ cls: "modal" });
	const contentEl = modalEl.createDiv({ cls: "modal-content" });
	Object.assign(modal, {
		containerEl, modalEl, titleEl: modalEl.createDiv({ cls: "modal-title" }), contentEl,
		app: plugin.app, scope: plugin.app.scope,
	});
	return {
		modal, contentEl, settings, ready, plugin,
		picker: modal as unknown as Picker,
		sourceInput: (): FakeElement => contentEl.querySelector(".icon-picker-source-dropdown .cs-combobox-input")!,
		destroy: () => {
			modal.onClose();
			containerEl.remove();
			for (const { pack, descriptor } of originals) Object.defineProperty(pack, "loadIndex", descriptor);
		},
	};
}

/**
 * Stand in for the window: apply `change` — to the settings, or to the pack
 * files on the device through `ready` — and close.
 */
async function withLibraryWindow(
	change: ((settings: PluginSettings, ready: Set<string>) => void) | null,
	body: () => Promise<void>,
	ready = new Set<string>(),
	seeHost: (host: IconLibrariesHost) => void = () => {},
): Promise<void> {
	const original = Object.getOwnPropertyDescriptor(IconLibrariesModal.prototype, "openAndWait")!;
	IconLibrariesModal.prototype.openAndWait = function (this: IconLibrariesModal) {
		const host = (this as unknown as { host: IconLibrariesHost }).host;
		seeHost(host);
		change?.(host.settings, ready);
		return Promise.resolve(change !== null);
	};
	try {
		await body();
	} finally {
		Object.defineProperty(IconLibrariesModal.prototype, "openAndWait", original);
	}
}

describe("Pick an icon — the library menu", () => {
	const open = (h: ReturnType<typeof harness>): void =>
		h.sourceInput().fire("keydown", { key: "ArrowDown", preventDefault: () => {}, stopPropagation: () => {} });
	const headings = (h: ReturnType<typeof harness>): string[] =>
		h.contentEl.querySelectorAll(".cs-combobox-group-label").map((el) => el.textContent);
	const closingLine = (h: ReturnType<typeof harness>): string | undefined =>
		h.contentEl.querySelector(".cs-combobox-footer-note")?.textContent;

	it("lists only the offered libraries, in the saved order, and counts the rest", async () => {
		const h = harness({ type: "lucide", value: "star" }, (settings) => {
			settings.iconLibraries = {
				order: ["image", "material", "lucide", "tabler", "emoji", "octicons", "fa", "rpg-awesome", "simple-icons"],
				hidden: ["emoji"],
			};
		});
		try {
			h.modal.onOpen();
			await setImmediate();
			// No pack files on this device: every downloadable library is left to
			// download, and none of them is in the menu.
			const { current, libraries, toDownload } = h.picker.menuLibraries();
			assert.equal(current, null);
			assert.deepEqual(libraries, ["image", "material", "lucide"]);
			assert.deepEqual(toDownload, ["tabler", "octicons", "fa", "rpg-awesome", "simple-icons"]);
			open(h);
			const rows = h.contentEl.querySelectorAll(".icon-picker-source-menu-item");
			assert.equal(rows.length, 1 + 3, "All sources and the three on offer");
			assert.deepEqual(headings(h), [t("iconPicker.groupSearch"), t("iconPicker.groupLibraries")]);
			assert.equal(closingLine(h), "5 more libraries available for download");
		} finally { h.destroy(); }
	});

	it("sets the edited icon's library apart when it is not on this device", async () => {
		// The callout's Tabler icon outlived the library: it was deleted here, or
		// downloaded only on another device.
		const h = harness({ type: "tabler-outline", value: "bulb" });
		try {
			h.modal.onOpen();
			await setImmediate();
			assert.equal(h.picker.activeSource, "tabler", "the picker opens on the icon's own library");
			assert.equal((h.sourceInput() as unknown as HTMLInputElement).value, t("iconPicker.tabler"));
			open(h);
			assert.deepEqual(headings(h), [t("iconPicker.groupDeleted"), t("iconPicker.groupSearch"), t("iconPicker.groupLibraries")]);
			const first = h.contentEl.querySelector(".icon-picker-source-menu-item")!;
			assert.ok(first.textContent.includes(t("iconPicker.tabler")));
			assert.equal(closingLine(h), "5 more libraries available for download", "the retained icon does not install Tabler");
			// The panel offers the download, in place of the grid.
			assert.equal(h.contentEl.querySelector(".icon-picker-notice-title")?.textContent,
				t("iconPack.downloadTitle", { name: getSource("tabler").attribution.title }));
		} finally { h.destroy(); }
	});

	it("still counts the edited icon's library when it is the only one left to download", async () => {
		const ready = new Set<string>(ICON_SOURCE_IDS
			.filter((id) => id !== "tabler")
			.flatMap((id) => [...libraryFiles(id)]));
		const h = harness({ type: "tabler-outline", value: "bulb" }, () => {}, ready);
		try {
			h.modal.onOpen();
			await setImmediate();
			open(h);
			assert.deepEqual(h.picker.menuLibraries().toDownload, ["tabler"]);
			assert.equal(closingLine(h), t("iconPicker.moreToDownloadOne"));
			assert.equal(headings(h)[0], t("iconPicker.groupDeleted"));
		} finally { h.destroy(); }
	});

	it("counts a deleted current library while preserving the callout's icon", async () => {
		const ready = new Set<string>(libraryFiles("tabler"));
		const icon: CalloutIcon = { type: "tabler-outline", value: "bulb" };
		const h = harness(icon, () => {}, ready);
		try {
			h.modal.onOpen();
			await setImmediate();
			open(h);
			assert.equal(closingLine(h), t("iconPicker.moreToDownload", { count: 4 }));
			assert.equal(h.picker.menuLibraries().current, null);
			await withLibraryWindow((_settings, files) => {
				for (const file of libraryFiles("tabler")) files.delete(file);
			}, async () => { await h.picker.openLibraries(); }, ready);
			assert.equal(h.picker.activeSource, "tabler");
			assert.deepEqual(h.picker.selectedIcon, icon, "the callout retains its stored icon");
			assert.equal(h.picker.menuLibraries().current, "tabler");
			assert.deepEqual(headings(h), [t("iconPicker.groupDeleted"), t("iconPicker.groupSearch"), t("iconPicker.groupLibraries")]);
			assert.equal(closingLine(h), t("iconPicker.moreToDownload", { count: 5 }));
		} finally { h.destroy(); }
	});

	it("sets a hidden library of the edited icon apart the same way", async () => {
		const h = harness({ type: "lucide", value: "star" }, (settings) => { settings.iconLibraries.hidden = ["lucide"]; });
		try {
			h.modal.onOpen();
			await setImmediate();
			assert.equal(h.picker.menuLibraries().current, "lucide");
			assert.ok(!h.picker.menuLibraries().libraries.includes("lucide"));
			open(h);
			assert.equal(headings(h)[0], t("iconPicker.groupCurrent"), "hiding a built-in library does not delete it");
		} finally { h.destroy(); }
	});

	it("says nothing about downloads once every library is on the device", async () => {
		const everything = new Set<string>(ICON_SOURCE_IDS.flatMap((id) => [...libraryFiles(id)]));
		const h = harness({ type: "lucide", value: "star" }, () => {}, everything);
		try {
			h.modal.onOpen();
			await setImmediate();
			open(h);
			assert.equal(closingLine(h), undefined);
			assert.equal(h.picker.menuLibraries().toDownload.length, 0);
			assert.deepEqual(headings(h), [t("iconPicker.groupSearch"), t("iconPicker.groupLibraries")]);
		} finally { h.destroy(); }
	});

	it("does not count libraries to download before the pack files have been read", async () => {
		// Until then a library downloaded in an earlier session reads as missing,
		// and the line would quote a number about to drop.
		const h = harness({ type: "lucide", value: "star" });
		let release: () => void = () => {};
		const gate = new Promise<void>((resolve) => { release = resolve; });
		(h.plugin.icons.packs as unknown as { loadAllFromDisk: () => Promise<void> }).loadAllFromDisk = () => gate;
		try {
			h.modal.onOpen();
			await setImmediate();
			open(h);
			assert.equal(closingLine(h), undefined, "still reading");
			release();
			await setImmediate();
			assert.equal(closingLine(h), "5 more libraries available for download", "the open menu catches up");
		} finally { h.destroy(); }
	});

	it("ends the source row with a Manage libraries button in words", async () => {
		const h = harness({ type: "lucide", value: "star" });
		try {
			h.modal.onOpen();
			await setImmediate();
			const row = h.contentEl.querySelector(".icon-picker-source-row")!;
			const button = row.querySelector("button.icon-picker-manage-libraries");
			assert.ok(button);
			assert.equal(button.textContent, t("iconPicker.manageLibraries"));
			assert.equal(t("iconPicker.manageLibraries"), "Manage libraries");
			assert.equal(button.querySelector("svg, .svg-icon"), null, "no gear left");
			// The words name it; an aria-label would only add a tooltip.
			assert.equal(button.getAttribute("aria-label"), null);
			assert.equal(row.children[row.children.length - 1], button);
		} finally { h.destroy(); }
	});
});

describe("Pick an icon — what it tells the Icon libraries window about the edit", () => {
	// The registry knows only saved callouts. The callout editor holds the icon
	// it was just given until Save, so the picker — opened on that icon — passes
	// it on, with the callout's name, and the window can count it as a user.
	const current: CalloutIcon = { type: "octicons", value: "rocket" };

	it("hands over the callout being edited, with the icon the picker was opened on", async () => {
		const h = harness(current, () => {}, new Set(["octicons"]), { id: "note", name: "Note" });
		try {
			h.modal.onOpen();
			await setImmediate();
			let seen: IconLibrariesHost["editing"] = undefined;
			await withLibraryWindow(null, async () => {
				await h.picker.openLibraries();
			}, new Set(), (host) => { seen = host.editing; });
			assert.deepEqual(seen, { id: "note", name: "Note", icon: current });
		} finally { h.destroy(); }
	});

	it("hands over a new callout as one with no id", async () => {
		const h = harness(current, () => {}, new Set(["octicons"]), { id: null, name: "Untitled callout" });
		try {
			h.modal.onOpen();
			await setImmediate();
			let seen: IconLibrariesHost["editing"] = undefined;
			await withLibraryWindow(null, async () => {
				await h.picker.openLibraries();
			}, new Set(), (host) => { seen = host.editing; });
			assert.deepEqual(seen, { id: null, name: "Untitled callout", icon: current });
		} finally { h.destroy(); }
	});

	it("hands over nothing when the picker was not opened for a callout", async () => {
		const h = harness(current, () => {}, new Set(["octicons"]));
		try {
			h.modal.onOpen();
			await setImmediate();
			let called = false;
			let seen: IconLibrariesHost["editing"] = { id: "x", name: "x", icon: current };
			await withLibraryWindow(null, async () => {
				await h.picker.openLibraries();
			}, new Set(), (host) => { called = true; seen = host.editing; });
			assert.equal(called, true);
			assert.equal(seen, undefined);
		} finally { h.destroy(); }
	});

	it("is told by the callout editor, which opens the picker with its own name and id", () => {
		// The editor's picker call is a closure inside its render, out of reach
		// of a unit test, so the wiring is pinned in the source: drop the third
		// argument and a freshly picked library deletes without a word again.
		const code = blankLiterals(readRepoFile("src/settings/CalloutEditor.ts"));
		const call = code.match(/new IconPicker\(([\s\S]*?)\);/);
		assert.ok(call, "the editor opens the picker");
		assert.match(call[1]!, /this\.plugin,\s*this\.icon,\s*\{[\s\S]*\bid:\s*this\.existingId\b[\s\S]*\bname\b/);
	});
});

describe("Pick an icon — opening the window before the disk has been read", () => {
	// A library downloaded in an earlier session reads as missing until its file
	// has been read back, and the picker reads them all when it opens. A quick tap
	// on the gear on a slow device can come first: the window must wait, rather
	// than list a library the person already has under "to download".
	const current: CalloutIcon = { type: "lucide", value: "star" };
	const gated = (h: ReturnType<typeof harness>) => {
		let release: () => void = () => {};
		const gate = new Promise<void>((resolve) => { release = resolve; });
		(h.plugin.icons.packs as unknown as { loadAllFromDisk: () => Promise<void> }).loadAllFromDisk = () => gate;
		return release;
	};

	it("waits for the disk read, then opens", async () => {
		const h = harness(current, () => {}, new Set(["octicons"]));
		try {
			h.modal.onOpen();
			await setImmediate();
			const release = gated(h);
			let opened = false;
			await withLibraryWindow(null, async () => {
				const pending = h.picker.openLibraries();
				await setImmediate();
				assert.equal(opened, false, "the files are still being read");
				release();
				await pending;
				assert.equal(opened, true);
			}, new Set(), () => { opened = true; });
		} finally { h.destroy(); }
	});

	it("does not open at all when the picker was closed in the meantime", async () => {
		const h = harness(current, () => {}, new Set(["octicons"]));
		try {
			h.modal.onOpen();
			await setImmediate();
			const release = gated(h);
			let opened = false;
			await withLibraryWindow(null, async () => {
				const pending = h.picker.openLibraries();
				h.modal.onClose();
				release();
				await pending;
				assert.equal(opened, false);
			}, new Set(), () => { opened = true; });
		} finally { h.destroy(); }
	});
});

describe("Pick an icon — after the Icon libraries window", () => {
	it("falls back to All sources when the active library was hidden, and drops its icon", async () => {
		const h = harness({ type: "lucide", value: "star" });
		try {
			h.modal.onOpen();
			await setImmediate();
			h.picker.selectSource("emoji");
			h.picker.selectedIcon = { type: "emoji", value: "😀" };
			// Material goes too, so the pool All sources falls back to has no
			// webfont to load in a test.
			await withLibraryWindow((settings) => { settings.iconLibraries.hidden = ["emoji", "material"]; }, async () => {
				await h.picker.openLibraries();
			});
			assert.equal(h.picker.activeSource, "all");
			assert.equal(h.picker.selectedIcon, null, "confirming it would bring the library back");
			assert.equal((h.sourceInput() as unknown as HTMLInputElement).value, t("iconPicker.allSources"));
		} finally { h.destroy(); }
	});

	it("keeps the edited icon's library and selection, hidden or not", async () => {
		const h = harness({ type: "lucide", value: "star" });
		try {
			h.modal.onOpen();
			await setImmediate();
			await withLibraryWindow((settings) => { settings.iconLibraries.hidden = ["lucide"]; }, async () => {
				await h.picker.openLibraries();
			});
			assert.equal(h.picker.activeSource, "lucide");
			assert.deepEqual(h.picker.selectedIcon, { type: "lucide", value: "star" });
		} finally { h.destroy(); }
	});

	it("leaves everything as it was when the window changed nothing", async () => {
		const h = harness({ type: "lucide", value: "star" });
		try {
			h.modal.onOpen();
			await setImmediate();
			h.picker.selectSource("emoji");
			const panel = h.contentEl.querySelector(".icon-picker-panel");
			await withLibraryWindow(null, async () => {
				await h.picker.openLibraries();
			});
			assert.equal(h.picker.activeSource, "emoji");
			assert.equal(h.contentEl.querySelector(".icon-picker-panel"), panel, "the panel was not rebuilt");
		} finally { h.destroy(); }
	});
});

describe("Pick an icon — the panel after the Icon libraries window", () => {
	const TABLER = ["tabler-outline", "tabler-filled"];
	const panelOf = (h: ReturnType<typeof harness>) => h.contentEl.querySelector(".icon-picker-panel");

	it("is not rebuilt when the change was about some other library", async () => {
		// A rebuild sends the grid back to the selected icon, or to the top.
		const h = harness({ type: "lucide", value: "star" });
		try {
			h.modal.onOpen();
			await setImmediate();
			const panel = panelOf(h);
			assert.ok(panel);
			await withLibraryWindow((settings) => { settings.iconLibraries.hidden = ["emoji"]; }, async () => {
				await h.picker.openLibraries();
			});
			assert.equal(panelOf(h), panel, "Lucide's grid stayed where it was");
			assert.equal(h.picker.activeSource, "lucide");
		} finally { h.destroy(); }
	});

	// Material is hidden from the start in the two tests below: a pool that holds
	// it loads Google's webfont, which a test has no network for.
	const withoutMaterial = (settings: PluginSettings): void => { settings.iconLibraries.hidden = ["material"]; };

	const searchableIndex: IconIndex = {
		entries: ["star", "moon"].map((name) => ({ name, categories: [], keywords: [] })),
		categories: [],
	};
	const changes: { name: string; downloaded: boolean; change: (settings: PluginSettings, files: Set<string>) => void }[] = [
		{ name: "reordering", downloaded: false, change: (settings) => { settings.iconLibraries.order = ["emoji", "lucide"]; } },
		{ name: "hiding", downloaded: false, change: (settings) => { settings.iconLibraries.hidden.push("emoji"); } },
		{ name: "downloading", downloaded: false, change: (_settings, files) => { TABLER.forEach((file) => files.add(file)); } },
		{ name: "deleting", downloaded: true, change: (_settings, files) => { TABLER.forEach((file) => files.delete(file)); } },
	];
	for (const { name, downloaded, change } of changes) {
		it(`keeps the search and filtered results after ${name} a pooled library`, async () => {
			const ready = new Set(downloaded ? TABLER : []);
			const h = harness({ type: "lucide", value: "star" }, withoutMaterial, ready, undefined,
				(id) => id === "image" ? emptyIndex : searchableIndex);
			try {
				h.modal.onOpen();
				await setImmediate();
				h.picker.selectSource("all");
				await setImmediate();
				const search = h.contentEl.querySelector(".icon-picker-search-input")!;
				search.value = "star";
				search.fire("input");
				await withLibraryWindow(change, () => h.picker.openLibraries(), ready);
				const refreshedSearch = h.contentEl.querySelector(".icon-picker-search-input")!;
				assert.notEqual(refreshedSearch, search, "the changed pool required a new panel");
				assert.equal(refreshedSearch.value, "star");
				const cells = h.contentEl.querySelectorAll(".icon-picker-cell");
				assert.ok(cells.length > 0);
				assert.ok(cells.every((cell) => cell.getAttribute("aria-label")?.startsWith("star — ")));
				const headings = h.contentEl.querySelectorAll(".icon-picker-group-text").map((el) => el.textContent);
				const sources = h.picker.menuLibraries().libraries.filter((id) => id !== "image");
				assert.deepEqual(headings, sources.map((id) => `${t(getSource(id).labelKey)} (1)`));
			} finally { h.destroy(); }
		});
	}

	for (const source of ["emoji", "image"] as const) {
		it(`keeps the ${source} search when hiding its active panel returns to All sources`, async () => {
			const h = harness({ type: "lucide", value: "star" }, withoutMaterial, new Set(), undefined,
				(id) => id === "lucide" ? searchableIndex : emptyIndex);
			try {
				h.modal.onOpen();
				await setImmediate();
				h.picker.selectSource(source);
				await setImmediate();
				const search = h.contentEl.querySelector(".icon-picker-search-input")!;
				search.value = "star";
				search.fire("input");
				await withLibraryWindow((settings) => { settings.iconLibraries.hidden.push(source); }, () => h.picker.openLibraries());
				assert.equal(h.picker.activeSource, "all");
				assert.equal(h.contentEl.querySelector(".icon-picker-search-input")?.value, "star");
				assert.equal(h.contentEl.querySelectorAll(".icon-picker-cell").length, 1);
				h.picker.selectSource("lucide");
				await setImmediate();
				assert.equal(h.contentEl.querySelector(".icon-picker-search-input")?.value, "", "choosing a source starts a fresh search");
			} finally { h.destroy(); }
		});
	}

	it("is rebuilt in All sources when the pool changed", async () => {
		const h = harness({ type: "lucide", value: "star" }, withoutMaterial);
		try {
			h.modal.onOpen();
			await setImmediate();
			h.picker.selectSource("all");
			const panel = panelOf(h);
			await withLibraryWindow((settings) => { settings.iconLibraries.hidden = ["material", "emoji"]; }, async () => {
				await h.picker.openLibraries();
			});
			assert.equal(h.picker.activeSource, "all");
			assert.notEqual(panelOf(h), panel, "the pool lost a library");
		} finally { h.destroy(); }
	});

	it("is rebuilt in All sources when the order changed, since the pool follows it", async () => {
		const h = harness({ type: "lucide", value: "star" }, withoutMaterial);
		try {
			h.modal.onOpen();
			await setImmediate();
			h.picker.selectSource("all");
			const panel = panelOf(h);
			await withLibraryWindow((settings) => {
				settings.iconLibraries.order = ["emoji", "lucide", "tabler", "material", "octicons", "fa", "rpg-awesome", "simple-icons", "image"];
			}, async () => { await h.picker.openLibraries(); });
			assert.notEqual(panelOf(h), panel);
		} finally { h.destroy(); }
	});

	it("shows the grid of a library the window just downloaded", async () => {
		const ready = new Set<string>();
		const h = harness({ type: "lucide", value: "star" }, () => {}, ready);
		try {
			h.modal.onOpen();
			await setImmediate();
			h.picker.selectSource("tabler");
			const prompt = panelOf(h);
			assert.ok(prompt);
			await withLibraryWindow((_settings, files) => { for (const file of TABLER) files.add(file); }, async () => {
				await h.picker.openLibraries();
			}, ready);
			assert.notEqual(panelOf(h), prompt, "the prompt gave way to the grid");
			assert.equal(h.picker.activeSource, "tabler");
		} finally { h.destroy(); }
	});

	it("stays on a library to download when the window changed something else", async () => {
		const h = harness({ type: "lucide", value: "star" });
		try {
			h.modal.onOpen();
			await setImmediate();
			h.picker.selectSource("tabler");
			const prompt = panelOf(h);
			await withLibraryWindow((settings) => { settings.iconLibraries.hidden = ["emoji"]; }, async () => {
				await h.picker.openLibraries();
			});
			assert.equal(h.picker.activeSource, "tabler", "it was never on offer, so it did not leave");
			assert.equal(panelOf(h), prompt, "the download prompt is still the one on screen");
		} finally { h.destroy(); }
	});

	it("gives way to All sources, and drops its icon, when the library on screen was deleted", async () => {
		const ready = new Set<string>(TABLER);
		const h = harness({ type: "lucide", value: "star" }, () => {}, ready);
		try {
			h.modal.onOpen();
			await setImmediate();
			h.picker.selectSource("tabler");
			h.picker.selectedIcon = { type: "tabler-outline", value: "bulb" };
			await withLibraryWindow((_settings, files) => { for (const file of TABLER) files.delete(file); }, async () => {
				await h.picker.openLibraries();
			}, ready);
			assert.equal(h.picker.activeSource, "all");
			assert.equal(h.picker.selectedIcon, null, "confirming it would download the library again");
		} finally { h.destroy(); }
	});
});

describe("All sources — Material's font only when Material is pooled", () => {
	function panelFor(members: readonly IconSourceId[]): { showsMaterialCells(): boolean } {
		const host = { variantsFor: () => ({}), lastCategoryFor: () => "" } as unknown as PackPanelHost;
		const pack = createAllSourcesPack(members.map(getSource));
		return new PackPanel(asEl(fakeDom.document.body.createDiv()), pack, host) as unknown as {
			showsMaterialCells(): boolean;
		};
	}

	it("loads Google's font for a pool that holds Material", () => {
		assert.equal(panelFor(["lucide", "material"]).showsMaterialCells(), true);
	});

	it("never fetches it for a pool the user took Material out of", () => {
		assert.equal(panelFor(["lucide", "emoji"]).showsMaterialCells(), false);
	});
});
