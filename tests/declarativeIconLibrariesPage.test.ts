/**
 * tests/declarativeIconLibrariesPage.test.ts — the Icon libraries page of the
 * Colors and icons box (settings/declarative/iconLibrariesPage.ts).
 *
 * The page shows the list Pick an icon's Manage libraries window shows, drawn
 * by the same code (settings/iconpicker/IconLibrariesView.ts, whose behaviour
 * iconLibrariesModal.test.ts holds through the window). Drawn through the test
 * renderer (tests/support/declarativeRenderer.ts), what is checked here is the
 * page's own part: the row that opens it and what the settings search finds it
 * by; that opening it reads the pack files and counts the icons before anything
 * is drawn, and that a page left meanwhile draws nothing; that the list on it
 * is live (a press saves) and leaving the page takes it away; and that while a
 * callout editor is open, which the page cannot see into, no library is deleted
 * and a press says why.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { setImmediate } from "node:timers/promises";
import { DEFAULT_SETTINGS } from "../src/constants";
import { t } from "../src/i18n";
import { PACK_MANIFEST } from "../src/icons/data/packManifest";
import { libraryFiles } from "../src/icons/iconLibraries";
import { ICON_SOURCE_IDS } from "../src/icons/registry";
import {
	ICON_LIBRARIES_PAGE,
	iconLibrariesPage,
	type IconLibrariesPage,
} from "../src/settings/declarative/iconLibrariesPage";
import { PersistentParts } from "../src/settings/declarative/persistentParts";
import { RowRegistry } from "../src/settings/declarative/rowRegistry";
import { toObsidianItems, type TreeContext } from "../src/settings/declarative/types";
import type { IconPackId, IconSourceId } from "../src/types";
import { ConfirmModal } from "../src/utils/ConfirmModal";
import { DeclarativeHarness, searchSettings } from "./support/declarativeRenderer";
import { installFakeDom, type FakeElement } from "./support/fakeDom";
import { stubSourceIndexes } from "./support/iconLibrariesDoors";
import { Notice, PluginSettingTab } from "./support/obsidianStub";

installFakeDom();
// Reduced motion: reorders apply at once instead of sliding.
Object.assign(window, { matchMedia: () => ({ matches: true }) });

interface Options {
	/** Pack files on this device. */
	ready?: IconPackId[];
	/** A callout editor is open (`plugin.settingsEditOpen`). */
	editorOpen?: boolean;
	/** Reading the pack files back waits until the test calls `finishDisk()`. */
	holdDisk?: boolean;
	/** The pack folder has not been looked at yet (`isOnDevice` answers undefined). */
	diskUnknown?: boolean;
}

/** A context whose plugin has only what the page and its list read. */
function setup(options: Options = {}) {
	const steps: string[] = [];
	const ready = new Set<IconPackId>(options.ready ?? []);
	const listeners = new Set<() => void>();
	const notify = (): void => {
		for (const cb of [...listeners]) cb();
	};
	let finishDisk = (): void => {};
	const disk = options.holdDisk
		? new Promise<void>((resolve) => {
				finishDisk = resolve;
			})
		: Promise.resolve();
	const deleted: IconSourceId[] = [];
	const packs = {
		state: (id: IconPackId) => (ready.has(id) ? "ready" : "unavailable"),
		info: (id: IconPackId) => PACK_MANIFEST[id],
		loadAllFromDisk: () => {
			steps.push("read");
			return disk;
		},
		isOnDevice: (id: IconPackId): boolean | undefined =>
			ready.has(id) ? true : options.diskUnknown === true ? undefined : false,
		lookOnDisk: () => Promise.resolve(),
		onChange: (cb: () => void) => {
			listeners.add(cb);
			return () => {
				listeners.delete(cb);
			};
		},
		download: (id: IconPackId) => {
			ready.add(id);
			notify();
			return Promise.resolve(true);
		},
	};
	const plugin = {
		app: { name: "app" },
		settings: structuredClone(DEFAULT_SETTINGS),
		settingsEditOpen: options.editorOpen === true,
		settingsWriter: { isFrozen: false },
		saves: 0,
		saveSettings(): Promise<void> {
			plugin.saves++;
			return Promise.resolve();
		},
		registry: { getCommitted: () => [], getUserImages: () => [] },
		icons: {
			packs,
			deleteLibrary: (id: IconSourceId) => {
				deleted.push(id);
				for (const file of libraryFiles(id)) ready.delete(file);
				notify();
				return Promise.resolve(true);
			},
		},
	};
	const ctx: TreeContext = {
		app: {} as never,
		plugin: plugin as never,
		redraw: () => {},
		registerDisposer: () => {},
		rows: new RowRegistry(),
		parts: new PersistentParts(() => {}),
		jumpTo: () => {},
	};
	return { ctx, plugin, steps, deleted, listeners, finishDisk: () => finishDisk() };
}

/** The main page with the row in a box of its own, as the Colors and icons box holds it. */
function drawSettings(ctx: TreeContext) {
	const tab = new PluginSettingTab({}, {});
	tab.getSettingDefinitions = () =>
		toObsidianItems([
			{
				type: "group",
				id: "colors-and-icons",
				heading: t("settings.colorsAndIcons"),
				items: [iconLibrariesPage(ctx)],
			},
		]);
	const harness = new DeclarativeHarness(tab);
	tab.update();
	return { tab, harness };
}

/** Open the page from the main page, and reach into what it drew. */
function openPage(ctx: TreeContext) {
	const { harness } = drawSettings(ctx);
	harness.openPage([ICON_LIBRARIES_PAGE]);
	const page = harness.customPage as unknown as IconLibrariesPage;
	const content = page.containerEl as unknown as FakeElement;
	const groupRows = (group: "available" | "download" | "hidden"): string[] =>
		(content.querySelector(".cs-icon-library-list")?.children ?? [])
			.filter((child) => child.dataset.csGroup === group)
			.flatMap((child) => child.querySelectorAll(".cs-icon-library-row"))
			.map((row) => row.dataset.csItemId ?? "");
	const row = (id: IconSourceId): FakeElement => {
		const found = content.querySelectorAll(".cs-icon-library-row").find((el) => el.dataset.csItemId === id);
		assert.ok(found, `no row for ${id}`);
		return found;
	};
	return {
		harness,
		page,
		content,
		groupRows,
		row,
		button: (id: IconSourceId): FakeElement => row(id).querySelector(".cs-icon-library-action")!,
		reset: (): FakeElement => content.querySelector(".cs-icon-library-reset")!,
		/** Let the page read the disk, count, and draw. */
		settle: () => setImmediate(),
	};
}

/** Answer the reset's question with yes, and report whether it was asked. */
async function confirmingYes(body: (asked: () => boolean) => Promise<void>): Promise<void> {
	const original = Object.getOwnPropertyDescriptor(ConfirmModal.prototype, "confirm")!;
	let asked = false;
	ConfirmModal.prototype.confirm = function () {
		asked = true;
		return Promise.resolve(true);
	};
	try {
		await body(() => asked);
	} finally {
		Object.defineProperty(ConfirmModal.prototype, "confirm", original);
	}
}

const isDimmed = (el: FakeElement): boolean => el.getAttribute("aria-disabled") === "true";

describe("the row that opens Icon libraries", () => {
	it("is a page with a name and no sentence, under the box's heading", () => {
		const { ctx } = setup();
		const { harness } = drawSettings(ctx);
		const box = harness.rendered[0]!;
		assert.equal(box.def.heading, "Colors and icons");
		assert.deepEqual(
			box.children.map((row) => row.def.name),
			["Icon libraries"],
		);
		const row = harness.row("Icon libraries")!;
		assert.equal(row.def.type, "page");
		assert.equal(row.def.desc, undefined, "no sentence, like Saved color palettes above it");
		assert.equal(
			ICON_LIBRARIES_PAGE,
			"icon-libraries",
			"the id names the page in a page path, so it never changes",
		);
		assert.deepEqual(harness.duplicateKeys, []);
	});

	it("ends with how many libraries Pick an icon offers here, out of all of them", () => {
		const total = ICON_SOURCE_IDS.length;
		const builtIn = ICON_SOURCE_IDS.filter((id) => libraryFiles(id).length === 0).length;
		const value = (options: Options): unknown => iconLibrariesPage(setup(options).ctx).displayValue;
		assert.equal(value({}), t("settings.iconLibrariesCount", { available: builtIn, total }));
		assert.equal(
			value({ ready: ["octicons"] }),
			t("settings.iconLibrariesCount", { available: builtIn + 1, total }),
		);
		const every = ICON_SOURCE_IDS.flatMap((id) => [...libraryFiles(id)]);
		assert.equal(value({ ready: every }), t("settings.iconLibrariesAll", { total }));
		assert.equal(
			value({ diskUnknown: true }),
			undefined,
			"nothing, rather than a number that changes a moment later",
		);
	});

	it("counts a library the user hid as not available", () => {
		const { ctx, plugin } = setup();
		plugin.settings.iconLibraries.hidden = ["emoji"];
		const builtIn = ICON_SOURCE_IDS.filter((id) => libraryFiles(id).length === 0).length;
		assert.equal(
			iconLibrariesPage(ctx).displayValue,
			t("settings.iconLibrariesCount", { available: builtIn - 1, total: ICON_SOURCE_IDS.length }),
		);
	});

	it("is found by the settings search, by its name", () => {
		const { ctx } = setup();
		const { tab } = drawSettings(ctx);
		assert.deepEqual(
			searchSettings(tab.settingItems, "icon libraries").map((hit) => [hit.name, hit.kind]),
			[["Icon libraries", "page"]],
		);
	});
});

describe("opening the Icon libraries page", () => {
	it("reads the pack files and counts the icons, then draws the list under the page's sentence", async () => {
		const { ctx, steps } = setup({ ready: ["octicons"] });
		const restoreIndexes = stubSourceIndexes((id) => ICON_SOURCE_IDS.indexOf(id) + 100);
		try {
			const h = openPage(ctx);
			await h.settle();
			assert.equal(steps[0], "read", "the disk is read before the list is drawn");
			assert.equal(h.page.title, "Icon libraries");
			const desc = h.content.querySelector(".setting-page-desc");
			assert.ok(desc, "the description is Obsidian's own page sentence");
			assert.equal(desc.textContent, t("iconLibraries.desc").split("\n").join(""));
			assert.ok(h.content.hasClass("cs-icon-libraries"), "the hook the window's body wears too");
			assert.ok(h.groupRows("available").includes("octicons"), "a library on this device is above the line");
			assert.ok(h.groupRows("download").includes("tabler"));
			const lucide = ICON_SOURCE_IDS.indexOf("lucide") + 100;
			assert.ok(
				h.row("lucide").querySelector(".setting-item-description")!.textContent.includes(String(lucide)),
				"the counts made before drawing are in the rows",
			);
		} finally {
			restoreIndexes();
		}
	});

	it("draws nothing until the pack files have been read back", async () => {
		const { ctx, finishDisk } = setup({ holdDisk: true });
		const restoreIndexes = stubSourceIndexes(() => 1);
		try {
			const h = openPage(ctx);
			await h.settle();
			assert.equal(h.content.querySelector(".cs-icon-library-list"), null);
			finishDisk();
			await h.settle();
			assert.ok(h.content.querySelector(".cs-icon-library-list"));
		} finally {
			restoreIndexes();
		}
	});

	it("draws nothing, and follows nothing, when the page was left while the disk was read", async () => {
		const { ctx, finishDisk, listeners } = setup({ holdDisk: true });
		const restoreIndexes = stubSourceIndexes(() => 1);
		try {
			const h = openPage(ctx);
			h.page.hide();
			finishDisk();
			await h.settle();
			assert.equal(h.content.querySelector(".cs-icon-library-list"), null);
			assert.equal(listeners.size, 0);
		} finally {
			restoreIndexes();
		}
	});
});

describe("the list on the page", () => {
	it("is live: a press saves at once and moves the row", async () => {
		const { ctx, plugin } = setup();
		const restoreIndexes = stubSourceIndexes(() => 1);
		try {
			const h = openPage(ctx);
			await h.settle();
			h.button("emoji").fire("click");
			assert.deepEqual(plugin.settings.iconLibraries.hidden, ["emoji"]);
			assert.equal(plugin.saves, 1);
			assert.deepEqual(h.groupRows("hidden"), ["emoji"]);
		} finally {
			restoreIndexes();
		}
	});

	it("is taken away when the page is left, and stops following the pack files", async () => {
		const { ctx, listeners } = setup();
		const restoreIndexes = stubSourceIndexes(() => 1);
		try {
			const h = openPage(ctx);
			await h.settle();
			assert.equal(listeners.size, 1, "the list follows downloads and deletions while it is shown");
			h.page.hide();
			assert.equal(h.content.querySelector(".cs-icon-library-list"), null);
			assert.equal(h.content.querySelector(".setting-page-desc"), null);
			assert.equal(listeners.size, 0);
		} finally {
			restoreIndexes();
		}
	});

	it("starts clean when the page is opened a second time", async () => {
		const { ctx, listeners } = setup();
		const restoreIndexes = stubSourceIndexes(() => 1);
		try {
			const h = openPage(ctx);
			await h.settle();
			h.page.display();
			await h.settle();
			assert.equal(h.content.querySelectorAll(".cs-icon-library-list").length, 1);
			assert.equal(h.content.querySelectorAll(".setting-page-desc").length, 1);
			assert.equal(listeners.size, 1);
		} finally {
			restoreIndexes();
		}
	});
});

describe("the page while a callout editor is open", () => {
	it("deletes no library, dims the button, and says why", async () => {
		const { ctx, deleted } = setup({ ready: ["octicons"], editorOpen: true });
		const restoreIndexes = stubSourceIndexes(() => 1);
		try {
			const h = openPage(ctx);
			await h.settle();
			assert.equal(isDimmed(h.button("octicons")), true);
			h.button("octicons").fire("click");
			await h.settle();
			assert.deepEqual(deleted, []);
			assert.equal(String(Notice.last?.message), t("settings.iconLibrariesEditorOpen"));
			assert.ok(h.groupRows("available").includes("octicons"), "the library is still here");
		} finally {
			restoreIndexes();
		}
	});

	it("asks again at the press, so an editor closed since the page was drawn no longer blocks", async () => {
		const { ctx, plugin, deleted } = setup({ ready: ["octicons"], editorOpen: true });
		const restoreIndexes = stubSourceIndexes(() => 1);
		try {
			const h = openPage(ctx);
			await h.settle();
			plugin.settingsEditOpen = false;
			h.button("octicons").fire("click");
			await h.settle();
			assert.deepEqual(deleted, ["octicons"]);
		} finally {
			restoreIndexes();
		}
	});

	it("still hides and shows a library that ships with the plugin: nothing is deleted", async () => {
		const { ctx, plugin } = setup({ editorOpen: true });
		const restoreIndexes = stubSourceIndexes(() => 1);
		try {
			const h = openPage(ctx);
			await h.settle();
			assert.equal(isDimmed(h.button("emoji")), false);
			h.button("emoji").fire("click");
			assert.deepEqual(plugin.settings.iconLibraries.hidden, ["emoji"]);
		} finally {
			restoreIndexes();
		}
	});

	it("refuses a reset that would delete a library, without asking", async () => {
		const { ctx, plugin, deleted } = setup({ ready: ["octicons"], editorOpen: true });
		plugin.settings.iconLibraries.hidden = ["emoji"];
		const restoreIndexes = stubSourceIndexes(() => 1);
		try {
			const h = openPage(ctx);
			await h.settle();
			await confirmingYes(async (asked) => {
				h.reset().fire("click");
				await h.settle();
				assert.equal(asked(), false);
			});
			assert.deepEqual(deleted, []);
			assert.deepEqual(plugin.settings.iconLibraries.hidden, ["emoji"], "nothing was put back either");
			assert.equal(String(Notice.last?.message), t("settings.iconLibrariesEditorOpen"));
		} finally {
			restoreIndexes();
		}
	});

	it("lets a reset that deletes nothing go ahead", async () => {
		const { ctx, plugin } = setup({ editorOpen: true });
		plugin.settings.iconLibraries.hidden = ["emoji"];
		const restoreIndexes = stubSourceIndexes(() => 1);
		try {
			const h = openPage(ctx);
			await h.settle();
			h.reset().fire("click");
			await h.settle();
			assert.deepEqual(plugin.settings.iconLibraries.hidden, []);
		} finally {
			restoreIndexes();
		}
	});
});
