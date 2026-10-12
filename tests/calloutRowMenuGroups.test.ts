/**
 * The `⋯` menu on a callout row, as it is drawn: four groups, top to bottom.
 *
 *   Find callouts
 *   ──────────
 *   Replace in vault… · Convert uses to plain text
 *   ──────────
 *   Duplicate · Reset to default · Use default fallback style
 *   ──────────
 *   Delete (red)
 *
 * Obsidian draws a divider between two sections and none for a section that
 * has no items, so what these suites check is the section each item carries
 * and the order the builders add them in: Obsidian orders sections by their
 * first item, and an item with no section would sink below all of them.
 *
 * A count that proves the callout unused greys out what cannot help: Find
 * callouts, and Replace / Convert when the count lands after the menu opened.
 * *Use default fallback style* asks nothing, so its notice carries Undo.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { setImmediate } from "node:timers/promises";
import type { App, Menu as ObsidianMenu } from "obsidian";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { buildBuiltInRowMenu, buildUserRowMenu } from "../src/settings/sections/CalloutRowActions";
import { buildThemeRowMenu } from "../src/settings/sections/themeRowActions";
import { applyDefaultFallbackStyle } from "../src/settings/sections/fallbackStyleAction";
import { ROW_MENU_SECTION } from "../src/settings/sections/rowMenuSections";
import type { SettingsSectionContext } from "../src/settings/sections/types";
import { getCalloutOccurrenceIndex } from "../src/usage/occurrenceService";
import type { CalloutDefinition } from "../src/types";
import { t } from "../src/i18n";
import { stableKeyOrder } from "../src/utils/stableJson";
import { Menu, Notice, type MenuItemRecord } from "./support/obsidianStub";
import { definition } from "./support/discoveryHarness";
import { savingWriter } from "./support/importSafetyStubs";
import { fakeDom, FakeElement, type FakeDocumentFragment } from "./support/fakeDom";

fakeDom.light();

const SECTION_ORDER: readonly string[] = Object.values(ROW_MENU_SECTION);

function vault(notes: Record<string, string>) {
	const contents = new Map(Object.entries(notes));
	const files = [...contents.keys()].map((path) => ({ path, stat: { mtime: 1, size: 1 } }));
	const app = { vault: {
		getMarkdownFiles: () => files,
		getAbstractFileByPath: (path: string) => files.find((file) => file.path === path) ?? null,
		cachedRead: (file: { path: string }) => Promise.resolve(contents.get(file.path)!),
	} } as unknown as App;
	const registry = new CalloutRegistry(); registry.load(null);
	registry.add(definition({ id: "owned", displayName: "Owned" }));
	const writer = savingWriter();
	const ctx = {
		app, display: () => {}, registerDisposer: () => {},
		plugin: {
			app, registry, settings: registry.settings, settingsWriter: writer,
			saveSettings: () => Promise.resolve(), refreshCallouts: () => {},
		},
	} as unknown as SettingsSectionContext;
	const index = getCalloutOccurrenceIndex(app);
	return {
		app, registry, ctx, index, writer,
		/** Rewrite a note the way Obsidian reports it: new mtime, invalidated path. */
		write(path: string, text: string) {
			contents.set(path, text);
			files.find((file) => file.path === path)!.stat.mtime++;
			index.invalidate(path);
		},
	};
}

type Build = (menu: ObsidianMenu, ctx: SettingsSectionContext, def: CalloutDefinition) => void;

function open(h: ReturnType<typeof vault>, build: Build, id: string): Menu {
	const menu = new Menu();
	build(menu as unknown as ObsidianMenu, h.ctx, h.registry.get(id)!);
	return menu;
}

function label(item: MenuItemRecord): string {
	const title = typeof item.title === "string" ? item.title : item.title.textContent ?? "";
	return title + (item.disabled ? " [grey]" : "") + (item.warning ? " [red]" : "");
}

/** The groups Obsidian draws, checking the builder added them in drawing order. */
function groups(menu: Menu): string[][] {
	const drawn: Array<{ section: string; labels: string[] }> = [];
	for (const item of menu.items) {
		const section = item.section;
		assert.ok(section, `"${label(item)}" has no section, so Obsidian would sink it below every group`);
		const last = drawn.at(-1);
		if (last?.section === section) { last.labels.push(label(item)); continue; }
		assert.ok(!drawn.some((group) => group.section === section), `${section} is split in two`);
		if (last) {
			assert.ok(SECTION_ORDER.indexOf(section) > SECTION_ORDER.indexOf(last.section),
				`${section} is added after ${last.section}, so Obsidian would draw it there`);
		}
		drawn.push({ section, labels: [label(item)] });
	}
	return drawn.map((group) => group.labels);
}

const find = (count: number): string => t("usage.menuCount", { count });
const REPLACE = t("settings.replaceAction");
const CONVERT = t("settings.convertUsesAction");
const DUPLICATE = t("settings.duplicateAction");
const RESET = t("settings.resetAction");
const FALLBACK = t("settings.makeFallbackAction");
const DELETE = `${t("settings.deleteAction")} [red]`;

describe("the row menu's four groups", () => {
	it("draws a custom callout in use as find ‖ notes ‖ callout ‖ danger", async () => {
		const h = vault({ "a.md": "> [!owned] One\n\n> [!owned] Two" });
		await h.index.ensureFresh();
		assert.deepEqual(groups(open(h, buildUserRowMenu, "owned")), [
			[find(2)], [REPLACE, CONVERT], [DUPLICATE, FALLBACK], [DELETE],
		]);
		h.index.dispose();
	});

	it("keeps the groups of an unused custom callout, with Find callouts greyed out", async () => {
		const h = vault({ "a.md": "plain text" });
		await h.index.ensureFresh();
		assert.deepEqual(groups(open(h, buildUserRowMenu, "owned")), [
			[`${find(0)} [grey]`], [DUPLICATE, FALLBACK], [DELETE],
		]);
		h.index.dispose();
	});

	it("offers no fallback style on the fallback callout itself or on a row already following it", async () => {
		const h = vault({ "a.md": "plain text" });
		h.registry.add(definition({ id: "follower", displayName: "Follower", source: "fallback" }));
		h.registry.settings.fallbackCalloutId = "owned";
		await h.index.ensureFresh();
		for (const id of ["owned", "follower"]) {
			assert.deepEqual(groups(open(h, buildUserRowMenu, id)), [
				[`${find(0)} [grey]`], [DUPLICATE], [DELETE],
			], id);
		}
		h.index.dispose();
	});

	it("puts Reset to default in the callout group of a modified built-in", async () => {
		const h = vault({ "a.md": "> [!note] Hi" });
		h.registry.update("note", { colorLight: "#ff0000" });
		await h.index.ensureFresh();
		assert.deepEqual(groups(open(h, buildBuiltInRowMenu, "note")), [
			[find(1)], [REPLACE, CONVERT], [RESET],
		]);
		h.index.dispose();
	});

	it("leaves an untouched, unused built-in a single greyed line and no divider", async () => {
		const h = vault({ "a.md": "plain text" });
		await h.index.ensureFresh();
		assert.deepEqual(groups(open(h, buildBuiltInRowMenu, "note")), [[`${find(0)} [grey]`]]);
		h.index.dispose();
	});

	it("draws a theme row as find ‖ notes, plus Duplicate only for a saved definition", async () => {
		const h = vault({ "a.md": "> [!recite] Hi\n\n> [!owned] Hi" });
		h.registry.add(definition({ id: "recite", displayName: "Recite", source: "theme" }));
		await h.index.ensureFresh();
		assert.deepEqual(groups(open(h, buildThemeRowMenu, "recite")), [[find(1)], [REPLACE, CONVERT]]);
		assert.deepEqual(groups(open(h, buildThemeRowMenu, "owned")), [[find(1)], [REPLACE, CONVERT], [DUPLICATE]]);
		h.index.dispose();
	});
});

describe("a count that lands after the menu opened", () => {
	it("greys out Find, Replace and Convert once it proves the callout unused, and lights them on a use", async () => {
		const h = vault({ "a.md": "plain text" });
		const menu = open(h, buildUserRowMenu, "owned");
		const titles = (): string[] => menu.items.map(label);
		assert.deepEqual(titles().slice(0, 3), [t("usage.menu"), REPLACE, CONVERT],
			"an unknown count offers both rewrites");
		await h.index.ensureFresh();
		assert.deepEqual(titles().slice(0, 3), [`${find(0)} [grey]`, `${REPLACE} [grey]`, `${CONVERT} [grey]`]);
		assert.equal(titles()[3], DUPLICATE, "only the items that need a use are greyed");
		h.write("a.md", "> [!owned] Now used");
		await h.index.ensureFresh();
		assert.deepEqual(titles().slice(0, 3), [find(1), REPLACE, CONVERT]);
		h.index.dispose();
	});

	it("never takes a partial scan for unused", async () => {
		const h = vault({ "a.md": "plain text" });
		(h.app.vault as unknown as { cachedRead: () => Promise<string> }).cachedRead =
			() => Promise.reject(new Error("EIO"));
		const menu = open(h, buildUserRowMenu, "owned");
		const warn = console.warn; console.warn = () => {};
		try { await h.index.ensureFresh(); } finally { console.warn = warn; }
		assert.equal(h.index.status, "partial");
		assert.deepEqual(menu.items.slice(0, 3).map((item) => item.disabled), [false, false, false]);
		h.index.dispose();
	});

	it("stops following the count once the menu is hidden", async () => {
		const h = vault({ "a.md": "plain text" });
		const menu = open(h, buildUserRowMenu, "owned");
		menu.hide();
		await h.index.ensureFresh();
		assert.deepEqual(menu.items.slice(0, 3).map((item) => item.disabled), [false, false, false]);
		h.index.dispose();
	});
});

/** Press the Undo link in the most recent notice. */
async function undo(): Promise<void> {
	const message = Notice.last?.message as FakeDocumentFragment | undefined;
	const link = message?.childNodes.find((node): node is FakeElement =>
		node instanceof FakeElement && node.hasClass("cs-notice-action"));
	assert.ok(link, "the notice offers no Undo");
	link.fire("click", { type: "click", preventDefault: () => {} });
	for (let i = 0; i < 5; i++) await setImmediate();
}

function noticeText(): string {
	const message = Notice.last?.message;
	if (typeof message === "string") return message;
	return (message as FakeDocumentFragment | undefined)?.childNodes
		.map((node) => node.textContent ?? "").join(" ") ?? "";
}

describe("Use default fallback style", () => {
	/** A fallback that brings fields the callout never had. */
	function withRichFallback() {
		const h = vault({});
		h.registry.add(definition({
			id: "base", displayName: "Base", icon: { type: "lucide", value: "lucide-info" },
			colorLight: "#aa0000", colorDark: "#ff4444", bgColorLight: "#ffeeee", bgColorDark: "#330000",
			bgGradient: { angleDeg: 90, toColorLight: "#ffffff", toColorDark: "#000000" },
			textColorLight: "#111111", textColorDark: "#eeeeee",
		}));
		h.registry.settings.fallbackCalloutId = "base";
		h.registry.update("owned", { customized: true });
		return h;
	}

	it("says what it did and Undo puts the callout's own look back, field for field", async () => {
		const h = withRichFallback();
		const before = structuredClone(h.registry.get("owned")!);
		Notice.last = null;
		await applyDefaultFallbackStyle(h.ctx, before);
		const after = h.registry.get("owned")!;
		assert.equal(after.source, "fallback");
		assert.equal(after.colorLight, "#aa0000");
		assert.ok(after.bgGradient, "the fallback's gradient came with it");
		assert.ok(noticeText().includes(t("notice.fallbackStyleApplied", { name: "Owned" })));
		await undo();
		const stable = (value: unknown): string => JSON.stringify(stableKeyOrder(value));
		assert.equal(stable(h.registry.get("owned")), stable(before),
			"every field back, and nothing the fallback brought left behind");
		h.index.dispose();
	});

	it("leaves a row edited since alone", async () => {
		const h = withRichFallback();
		await applyDefaultFallbackStyle(h.ctx, h.registry.get("owned")!);
		h.registry.update("owned", { colorLight: "#00aa00", customized: true });
		await undo();
		assert.equal(h.registry.get("owned")!.colorLight, "#00aa00");
		h.index.dispose();
	});

	it("refuses Undo while saving is paused", async () => {
		const h = withRichFallback();
		await applyDefaultFallbackStyle(h.ctx, h.registry.get("owned")!);
		h.writer.isFrozen = true;
		await undo();
		assert.equal(h.registry.get("owned")!.source, "fallback");
		h.index.dispose();
	});
});
