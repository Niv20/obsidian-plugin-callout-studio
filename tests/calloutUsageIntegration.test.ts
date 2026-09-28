import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { App, Menu, MenuItem, Plugin, TFile } from "obsidian";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { getCalloutOccurrenceIndex } from "../src/usage/occurrenceService";
import { addUsageMenuItem } from "../src/usage/usageMenuItem";
import { scanVaultCalloutStatistics } from "../src/utils/vaultCalloutStats";
import { registerOccurrenceIndex } from "../src/usage/registerOccurrenceIndex";
import { getOccurrenceMetrics } from "../src/usage/occurrenceMetrics";
import { t } from "../src/i18n";
import "./support/fakeDom";

// Async index scheduling needs real timers rather than the fake DOM's queue.
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
before(() => { Object.defineProperty(globalThis, "window", { configurable: true, value: globalThis }); });
after(() => {
	if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
	else Reflect.deleteProperty(globalThis, "window");
});

function harness(contents: Record<string, string>) {
	const files = Object.keys(contents).map((path) => ({ path, stat: { mtime: 1, size: contents[path]!.length } }));
	let reads = 0;
	const app = { vault: {
		getMarkdownFiles: () => files,
		getAbstractFileByPath: (path: string) => files.find((file) => file.path === path),
		cachedRead: (file: TFile) => { reads++; return Promise.resolve(contents[file.path]!); },
	} } as unknown as App;
	return { app, reads: () => reads };
}

function fakeMenu() {
	let title: string | DocumentFragment = "";
	let click: (() => unknown) | undefined;
	let hide = (): void => {};
	const item = {
		setTitle(value: string | DocumentFragment) { title = value; return this; },
		setIcon() { return this; },
		onClick(callback: () => unknown) { click = callback; return this; },
	};
	const menu = {
		setUseNativeMenu() { return this; },
		onHide(callback: () => void) { hide = callback; },
		addItem(callback: (value: MenuItem) => void) { callback(item as unknown as MenuItem); return this; },
	} as unknown as Menu;
	return {
		menu,
		title: () => typeof title === "string" ? title : title.textContent,
		countNode: () => typeof title === "string" ? undefined : Array.from(title.childNodes)
			.find((node) => node.nodeType === Node.ELEMENT_NODE &&
				(node as HTMLElement).classList.contains("cs-usage-menu-count")),
		hide: () => hide(), click: () => click?.(),
	};
}

describe("shared callout usage surfaces", () => {
	it("keeps statistics, source navigation, roles and menu counts in agreement without saving types", async () => {
		const { app, reads } = harness({
			"one.md": "> [!note]\n\n## [!note]\n[!note] [!never-saved|blue]\n%% [!note] %%",
			"two.md": "[!never-saved] [!note]",
		});
		const registry = new CalloutRegistry();
		registry.load(null);
		const before = JSON.stringify(registry.toSaveData());
		const stats = await scanVaultCalloutStatistics(app);
		const index = getCalloutOccurrenceIndex(app);
		assert.equal(stats.totalCount, 6);
		assert.equal(stats.totalCount, index.query().occurrences.length);
		assert.deepEqual(getOccurrenceMetrics(index), { totalCount: 6, typeCount: 2, fileCount: 2, scannedFileCount: 2 });
		const metrics = getOccurrenceMetrics(index);
		index.query(["note"], "regular");
		assert.equal(getOccurrenceMetrics(index), metrics, "filtering reuses global metrics without rereading notes");
		assert.equal(stats.roleTotals.regular + stats.roleTotals.heading + stats.roleTotals.inline, stats.totalCount);
		for (const entry of stats.types) {
			const results = index.query([entry.id]);
			assert.equal(entry.totalCount, results.totalCount);
			assert.equal(entry.fileCount, results.fileCount);
			assert.deepEqual(entry.roles, results.roles);
		}
		const menu = fakeMenu();
		addUsageMenuItem(menu.menu, app, ["note"]);
		assert.equal(menu.title(), t("usage.menuCount", { count: 4 }), "menu shows usages without a file count");
		assert.equal(menu.countNode(), undefined, "a count ready at opening appears immediately");
		await scanVaultCalloutStatistics(app);
		assert.equal(reads(), 2, "repeat report and menu reuse parsed files");
		assert.equal(registry.has("never-saved"), false);
		assert.equal(JSON.stringify(registry.toSaveData()), before);
		index.invalidateEditor("one.md");
		assert.equal(getOccurrenceMetrics(index), metrics, "typing schedules parsing without recomputing vault metrics");
		menu.hide();
		index.dispose();
	});

	it("unions definition aliases without double-counting files or merging fallback identities", async () => {
		const { app } = harness({ "one.md": "[!note] [!alias] [!not-saved]", "two.md": "[!alias]" });
		const index = getCalloutOccurrenceIndex(app);
		await index.ensureFresh();
		const query = index.query(["note", "alias", "alias"]);
		assert.equal(query.totalCount, 3);
		assert.equal(query.fileCount, 2);
		assert.equal(index.query(["note"]).totalCount, 1);
		assert.equal(index.query(["not-saved"]).totalCount, 1);
		index.dispose();
	});

	it("opens a cold menu quietly, fades in only its count, and detaches on hide", async () => {
		const { app } = harness({ "a.md": "[!note]" });
		let release!: (content: string) => void;
		app.vault.cachedRead = () => new Promise<string>((resolve) => { release = resolve; });
		const menu = fakeMenu();
		assert.equal(addUsageMenuItem(menu.menu, app, ["note"]), undefined);
		assert.equal(menu.title(), t("usage.menu"));
		assert.equal(menu.countNode(), undefined);
		const index = getCalloutOccurrenceIndex(app);
		const running = index.ensureFresh();
		await Promise.resolve();
		assert.equal(index.status, "loading");
		assert.equal(menu.title(), t("usage.menu"), "loading never flashes progress copy");
		release("[!note]");
		await running;
		assert.equal(menu.title(), t("usage.menuCount", { count: 1 }));
		assert.equal(menu.countNode()?.textContent, " (1)", "only the added count and its punctuation fade");
		const countNode = menu.countNode();
		await index.ensureFresh();
		assert.equal(menu.countNode(), countNode, "an unchanged count keeps its existing element");
		menu.hide();
		index.invalidate("a.md");
		assert.equal(menu.title(), t("usage.menuCount", { count: 1 }));
		index.dispose();
	});

	it("does not reveal a count after its menu was dismissed during the scan", async () => {
		const { app } = harness({ "a.md": "[!note]" });
		let release!: (content: string) => void;
		app.vault.cachedRead = () => new Promise<string>((resolve) => { release = resolve; });
		const menu = fakeMenu();
		addUsageMenuItem(menu.menu, app, ["note"]);
		const index = getCalloutOccurrenceIndex(app);
		const running = index.ensureFresh();
		await Promise.resolve();
		menu.hide();
		release("[!note]");
		await running;
		assert.equal(menu.title(), t("usage.menu"));
		assert.equal(menu.countNode(), undefined);
		index.dispose();
	});

	it("never presents read failure as an exact zero in menus or reports", async () => {
		const { app } = harness({ "locked.md": "[!note]" });
		app.vault.cachedRead = () => Promise.reject(new Error("unreadable"));
		const menu = fakeMenu();
		addUsageMenuItem(menu.menu, app, ["note"]);
		const index = getCalloutOccurrenceIndex(app);
		await index.ensureFresh();
		assert.equal(menu.title(), t("usage.menuIncomplete"));
		const stats = await scanVaultCalloutStatistics(app);
		assert.equal(stats.incomplete, true);
		assert.equal(stats.failedFileCount, 1);
		menu.hide();
		index.dispose();
	});

	it("registers invalidations without a startup read and disposes on unload", () => {
		const { app, reads } = harness({ "a.md": "[!unknown]" });
		const events: string[] = [];
		const workspaceEvents: string[] = [];
		const disposers: Array<() => void> = [];
		app.vault.on = ((event: string) => { events.push(event); return {}; }) as typeof app.vault.on;
		app.workspace = { on: (event: string) => { workspaceEvents.push(event); return {}; } } as unknown as App["workspace"];
		registerOccurrenceIndex({ app, registerEvent() {}, register: (cb: () => void) => disposers.push(cb) } as unknown as Plugin);
		const index = getCalloutOccurrenceIndex(app);
		assert.equal(index.status, "idle");
		assert.equal(reads(), 0);
		assert.deepEqual(events, ["create", "modify", "delete", "rename"]);
		assert.deepEqual(workspaceEvents, ["editor-change", "file-open", "layout-change"]);
		disposers.forEach((dispose) => dispose());
		assert.equal(index.status, "disposed");
	});
});
