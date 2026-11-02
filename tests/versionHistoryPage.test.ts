/**
 * Version history: every earlier setup, newest first, whether it was kept on
 * this device, in the vault's backups folder, or left behind by a sync
 * service, drawn as a timeline on a page of the settings (declarative/
 * versionHistoryPage.ts). Each local day is a heading on the rail, and each
 * version a card after it with its time and dot; a setup kept in several places
 * is one card. Each card is named by why it was kept, and says how far it is
 * from now. Restoring asks first and is unavailable while saving is paused;
 * viewing and deleting remain available.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { setImmediate } from "node:timers/promises";
import type { App } from "obsidian";
import { Notice } from "./support/obsidianStub";
import type { PluginData } from "../src/types";
import { VERSION_HISTORY_PAGE, VersionHistoryPage, versionHistoryRow } from "../src/settings/declarative/versionHistoryPage";
import type { TreeContext } from "../src/settings/declarative/types";
import { canOpenSettingsPage } from "../src/settings/declarative/jumpToRow";
import type { RecoverySource, SettingsRecoveryService } from "../src/manager/settingsRecoveryService";
import { mergeVersions, type SetupVersion } from "../src/manager/setupVersions";
import { en } from "../src/i18n/en";
import { he } from "../src/i18n/he";
import { getLocale, registerLocale, setLocale, t } from "../src/i18n";
import { versionDay, versionName, versionTime } from "../src/settings/versionRow";
import { fakeDom, type FakeElement } from "./support/fakeDom";
import { stubConfirm } from "./support/importSafetyStubs";
import { readRepoFile } from "./support/sourceScan";

const older: Partial<PluginData> = { callouts: [] };
const same: Partial<PluginData> = { version: 5 };

interface Options {
	frozen?: boolean;
	locale?: "en" | "he";
	/** What deleting answers: whether every copy went. */
	removes?: boolean;
	/** Whether the host keeps versions at all. */
	recovery?: boolean;
}

/** The context the page is built with: only the plugin's recovery service and writer matter to it. */
function context(sources: RecoverySource[], options: Options = {}) {
	const restored: unknown[] = [];
	const removed: SetupVersion[] = [];
	let listed = 0;
	const recovery = {
		listVersions: () => { listed++; return Promise.resolve(mergeVersions(sources)); },
		differences: () => (data: unknown) => ({ callouts: 1, changed: data === same ? 0 : 2 }),
		restore: (data: unknown) => { restored.push(data); return Promise.resolve("restored" as const); },
		removeVersion: (version: SetupVersion) => { removed.push(version); return Promise.resolve(options.removes ?? true); },
	} as unknown as SettingsRecoveryService;
	const plugin = { recovery: options.recovery === false ? undefined : recovery, settingsWriter: { isFrozen: options.frozen ?? false } };
	const ctx = { app: {} as App, plugin } as unknown as TreeContext;
	return { ctx, restored, removed, listed: () => listed };
}

function open(sources: RecoverySource[], options: Options = {}) {
	fakeDom.light();
	const previousLocale = getLocale();
	if (options.locale === "he") registerLocale("he", he);
	setLocale(options.locale ?? "en");
	const host = context(sources, options);
	const page = new VersionHistoryPage(host.ctx);
	page.display();
	const contentEl = page.containerEl as unknown as FakeElement;
	fakeDom.document.body.appendChild(page.rootEl as unknown as FakeElement);
	const rows = (): FakeElement[] => contentEl.querySelectorAll(".cs-recovery-row");
	const icons = (tooltip: string, within: FakeElement = contentEl): FakeElement[] =>
		within.querySelectorAll(".clickable-icon").filter(el => el.dataset.csTooltip === tooltip);
	const buttons = (label: string): FakeElement[] =>
		contentEl.querySelectorAll(".clickable-icon").filter(el => el.dataset.csText === label);
	const name = (row: FakeElement) => row.querySelector(".cs-version-name");
	/** The timeline's parts in order: each day's heading text, then its cards. */
	const timeline = () => contentEl.querySelector(".cs-recovery-rows")?.children.map(child =>
		child.hasClass("cs-recovery-day") ? child.textContent : "row") ?? [];
	return { page, contentEl, restored: host.restored, removed: host.removed, rows, icons, buttons, name, timeline,
		listed: host.listed,
		destroy: () => { page.hide(); (page.rootEl as unknown as FakeElement).remove(); setLocale(previousLocale); } };
}

const history: RecoverySource = { kind: "history", time: Date.UTC(2026, 8, 20, 9), path: null, historyHash: "h1", origin: "this-device", data: older, reason: "edit" };
const unchanged: RecoverySource = { kind: "backup", time: Date.UTC(2026, 8, 21, 9), path: "b/data-x.json", historyHash: null, origin: "other-device", data: same, reason: "before-import" };
const unreadable: RecoverySource = { kind: "copy", time: null, path: ".obsidian/plugins/callout-studio/data 2.json", historyHash: null, origin: null, data: null };

describe("Version history, the row that opens the page", () => {
	it("is a page named Restore an earlier version, and shows only where versions are kept", () => {
		const row = versionHistoryRow(context([history]).ctx);
		assert.equal(row.type, "page");
		assert.equal(row.id, VERSION_HISTORY_PAGE);
		assert.equal(row.name, en["settings.versionHistory"]);
		assert.equal(row.desc, en["settings.versionsDesc"]);
		assert.equal((row.visible as () => boolean)(), true);
		assert.equal((versionHistoryRow(context([history], { recovery: false }).ctx).visible as () => boolean)(), false);
		assert.ok(row.page?.() instanceof VersionHistoryPage, "the page is the plugin's own, drawn by itself");
	});

	it("can be opened by code only where Obsidian can open a page", () => {
		assert.equal(canOpenSettingsPage({ setting: { openPagePath() {} } } as unknown as App), true);
		assert.equal(canOpenSettingsPage({ setting: {} } as unknown as App), false, "Obsidian 1.13.x");
		assert.equal(canOpenSettingsPage({} as unknown as App), false);
	});
});

describe("Version history page", () => {
	it("lists every version newest first, as cards on a timeline", async () => {
		const h = open([history, unchanged, unreadable]);
		try {
			await setImmediate();
			assert.ok(h.contentEl.hasClass("cs-recovery-page"));
			assert.equal(h.contentEl.querySelector(".cs-recovery-intro")?.textContent, en["versions.intro"]!.replace(/\n/g, ""));
			assert.equal(h.contentEl.querySelectorAll(".cs-recovery-group").length, 0, "no groups by where a copy lives");
			const rows = h.rows();
			assert.deepEqual(rows.map(row => h.name(row)?.textContent),
				[en["versions.reason.beforeImport"], en["versions.reason.edit"], en["versions.category.syncCopy"]],
				"newest first; a copy with no time last");
			assert.equal(h.contentEl.querySelectorAll(".cs-version-badge").length, 0, "no visible location labels");
			assert.equal(h.contentEl.querySelectorAll(".cs-version-marker").length, 3, "a dot on the rail for every version");
			for (const row of rows) {
				assert.ok(row.parentElement!.hasClass("cs-recovery-rows"), "every card sits on the one timeline");
				assert.ok(row.hasClass("setting-item") && row.hasClass("cs-row-inline"), "Obsidian's own row, kept on one line on a phone");
				assert.ok(row.querySelector(".cs-version-marker")?.getAttribute("aria-hidden") === "true", "the dot is decoration");
			}
			const text = h.contentEl.textContent;
			for (const key of ["recovery.same", "recovery.unreadable"]) assert.ok(text.includes(en[key]!), key);
			assert.ok(!rows[2]!.textContent.includes("data 2.json"), "internal filenames are not shown");
			assert.equal(h.buttons(en["recovery.restore"]!).length, 2, "an unreadable copy offers nothing to restore");
			assert.equal(h.icons(en["recovery.delete"]!).length, 3, "every version can be deleted, even an unreadable one");
			assert.equal(h.contentEl.querySelectorAll("button.cs-version-name").length, 0, "version titles are plain text");
			assert.equal(h.contentEl.querySelectorAll(".callout-studio-row").length, 0,
				"not a settings-list row: its pill, padding and size container stay out of the card");
		} finally { h.destroy(); }
	});

	it("shows a setup kept on this device and in the vault once", async () => {
		const backup: RecoverySource = { kind: "backup", time: Date.UTC(2026, 8, 20, 10), path: "b/data-y.json", historyHash: null,
			origin: "this-device", data: { callouts: [] }, reason: "before-import" };
		const h = open([history, backup]);
		try {
			await setImmediate();
			const rows = h.rows();
			assert.equal(rows.length, 1, "one setup, one row");
			assert.equal(h.name(rows[0]!)?.textContent, en["versions.reason.beforeImport"], "named by the newest copy that says why");
		} finally { h.destroy(); }
	});

	for (const locale of ["en", "he"] as const) {
		it(`uses the automatic category for an unexplained mixed version whose newest copy is from sync, in ${locale}`, async () => {
			const table = locale === "he" ? he : en;
			const local: RecoverySource = { ...history, reason: undefined };
			const copy: RecoverySource = { ...unreadable, time: history.time! + 1000, data: older };
			const h = open([local, copy], { locale });
			try {
				await setImmediate();
				assert.equal(h.rows().length, 1);
				assert.equal(h.name(h.rows()[0]!)?.textContent, table["versions.category.automatic"]);
				assert.ok(!h.contentEl.textContent.includes("data 2.json"));
				assert.equal(h.rows()[0]!.querySelector(".cs-recovery-time")?.getAttribute("datetime"), new Date(copy.time!).toISOString());
			} finally { h.destroy(); }
		});
	}

	it("puts a heading on the rail for each local calendar day, across midnight, and a time beside each dot", async () => {
		const times = [new Date(2026, 8, 22, 13).getTime(), new Date(2026, 8, 22, 0, 1).getTime(), new Date(2026, 8, 21, 23, 59).getTime()];
		const sources = times.map((time, index) => ({ ...history, time, historyHash: `day-${index}`, data: { version: index } }));
		const h = open([...sources, unreadable]);
		try {
			await setImmediate();
			assert.deepEqual(h.timeline(), [
				versionDay(times[0]!), "row", "row",
				versionDay(times[2]!), "row",
				en["recovery.details.unknownTime"], "row",
			], "00:01 and 13:00 are one day; 23:59 the day before; no time last");
			assert.equal(h.contentEl.querySelectorAll("h3.cs-recovery-day").length, 3, "a heading is an <h3>");
			for (const [index, time] of times.entries()) {
				const row = h.rows()[index]!;
				const clock = row.querySelector(".cs-recovery-time")!;
				assert.equal(clock.tagName, "TIME");
				assert.equal(clock.parentElement, row, "the time stands beside the dot, not inside the name");
				assert.equal(clock.textContent, new Date(time).toLocaleTimeString("en", { timeStyle: "short" }));
				assert.equal(clock.getAttribute("datetime"), new Date(time).toISOString());
				const summary = row.querySelector(".setting-item-description")!;
				assert.equal(summary.querySelector(".cs-recovery-time"), null);
				assert.deepEqual(summary.querySelectorAll(".cs-recovery-summary-part").map(el => el.textContent), [
					t("recovery.summaryCallouts", { callouts: 1 }), t("recovery.summaryChanges", { count: 2 }),
				], "the two counts, a line each, without the date or time");
				assert.ok(summary.querySelector(".cs-recovery-summary-counts"), "the counts share one block, so they can share a line when the buttons wrap");
			}
			assert.equal(h.rows()[3]!.querySelector(".cs-recovery-time"), null, "unknown times are not invented");
			assert.ok(h.rows()[3]!.querySelector(".cs-version-marker"), "but the dot is still there");
		} finally { h.destroy(); }
	});

	it("says it is loading, then that there is nothing", async () => {
		const h = open([]);
		try {
			const status = () => h.contentEl.querySelectorAll(".cs-recovery-status").map(line => line.textContent);
			assert.deepEqual(status(), [en["versions.loading"]], "before the versions arrive");
			await setImmediate();
			assert.deepEqual(status(), [en["versions.empty"]]);
			assert.equal(h.rows().length, 0);
		} finally { h.destroy(); }
	});

	it("draws nothing when a late answer arrives after the page was left", async () => {
		const h = open([history]);
		h.page.hide();
		await setImmediate();
		assert.equal(h.rows().length, 0, "the list is gone with the page, and the answer finds nowhere to go");
		h.destroy();
	});

	it("draws again from nothing when the page is opened a second time", async () => {
		const h = open([history]);
		try {
			await setImmediate();
			h.page.display();
			await setImmediate();
			assert.equal(h.contentEl.querySelectorAll(".cs-recovery-intro").length, 1);
			assert.equal(h.rows().length, 1);
		} finally { h.destroy(); }
	});

	it("gives Restore the red it had before the 1.13 rewrite: the whole setup is replaced", async () => {
		const h = open([history]);
		try {
			await setImmediate();
			const restore = h.buttons(en["recovery.restore"]!)[0]!;
			// Obsidian's red button (`setDestructive()`), never the deprecated `mod-warning`.
			assert.equal(restore.hasClass("mod-destructive"), true);
			assert.equal(restore.hasClass("mod-cta"), false);
			assert.equal(restore.hasClass("mod-warning"), false);
		} finally { h.destroy(); }
	});

	it("names a version by why it was kept", async () => {
		const at = (hour: number) => Date.UTC(2026, 8, 22, hour);
		const sources: RecoverySource[] = [
			{ ...history, time: at(9), data: { callouts: [], n: 1 } as Partial<PluginData>, reason: undefined },
			{ ...history, time: at(8), historyHash: "h2", data: { callouts: [], n: 2 } as Partial<PluginData>, reason: "from-a-later-build" },
			{ ...history, time: at(7), historyHash: "h3", data: { callouts: [], n: 3 } as Partial<PluginData>, reason: "load" },
			{ ...unchanged, time: at(6), data: { callouts: [], n: 4 } as Partial<PluginData>, reason: null },
		];
		const h = open(sources);
		try {
			await setImmediate();
			const names = h.rows().map(h.name);
			assert.deepEqual(names.map(el => el?.textContent), [
				en["versions.category.automatic"], en["versions.category.automatic"], en["versions.reason.load"],
				en["versions.category.automatic"],
			]);
		} finally { h.destroy(); }
	});

	it("keeps titles read-only on click and keyboard", async () => {
		const h = open([history]);
		try {
			await setImmediate();
			const name = h.name(h.rows()[0]!)!;
			assert.equal(name.tagName, "SPAN");
			name.fire("click");
			name.fire("keydown", { key: "Enter" });
			assert.equal(h.contentEl.querySelectorAll("input").length, 0);
			assert.equal(name.textContent, en["versions.reason.edit"]);
		} finally { h.destroy(); }
	});

	it("restores only after a yes, then reads the versions again (they are compared with a new 'now')", async () => {
		const confirm = stubConfirm(true);
		const h = open([history]);
		try {
			await setImmediate();
			h.buttons(en["recovery.restore"]!)[0]!.fire("click");
			await setImmediate();
			assert.deepEqual(h.restored, [older]);
			assert.deepEqual(confirm.asked, [en["versions.restoreTitle"]]);
			const message = confirm.messages[0];
			assert.equal(typeof message, "string");
			assert.ok(confirm.subtitles[0]?.startsWith(`“${en["versions.reason.edit"]}”`), "the heading names the version, in quotes");
			assert.ok(!(message as string).includes(en["versions.reason.edit"]!), "and the message does not say it again");
			assert.ok(String(Notice.last?.message).startsWith(`Restored “${en["versions.reason.edit"]}” from`));
			assert.equal(h.listed(), 2, "the list is read again");
			assert.equal(h.rows().length, 1, "and the page stays open");
		} finally { confirm.restore(); h.destroy(); }
	});

	it("deletes every available copy only after a yes, warning when file deletion may sync", async () => {
		const confirm = stubConfirm(true);
		const backup: RecoverySource = { ...unchanged, data: { callouts: [] } };
		const copy: RecoverySource = { ...unreadable, time: Date.UTC(2026, 8, 19), data: { callouts: [] } };
		const h = open([history, backup, copy]);
		try {
			await setImmediate();
			assert.equal(h.rows().length, 1);
			h.icons(en["recovery.delete"]!)[0]!.fire("click");
			await setImmediate();
			assert.deepEqual(confirm.asked, [en["versions.deleteTitle"]]);
			const message = confirm.messages[0] as string;
			assert.equal(typeof message, "string");
			const version = mergeVersions([history, backup, copy])[0]!;
			assert.equal(message, [
				t("versions.deleteAvailableBody"),
				t("versions.deleteSyncedFiles"), t("versions.deleteFinal"),
			].join("\n"));
			assert.deepEqual(confirm.subtitles, [t("versions.subtitle", { name: versionName(version), when: versionTime(version.time) })]);
			assert.ok(!message.includes("data 2.json"), "internal filenames are not shown");
			assert.equal(h.removed.length, 1);
			assert.equal(h.removed[0]!.copies.length, 3, "one row, one version: every copy goes");
			assert.ok(String(Notice.last?.message).startsWith("Deleted “"));
			assert.equal(h.listed(), 2, "the list is read again");
		} finally { confirm.restore(); h.destroy(); }
	});

	for (const [source, warns] of [[history, false], [unchanged, true], [unreadable, true]] as const) {
		it(`includes a sync-deletion warning only when deleting files: ${source.kind}`, async () => {
			const confirm = stubConfirm(true);
			const h = open([source]);
			try {
				await setImmediate();
				h.icons(en["recovery.delete"]!)[0]!.fire("click");
				await setImmediate();
				assert.equal((confirm.messages[0] as string).includes(en["versions.deleteSyncedFiles"]!), warns);
				assert.equal(h.removed.length, 1);
			} finally { confirm.restore(); h.destroy(); }
		});
	}

	it("says what was left when some copies could not be deleted", async () => {
		const confirm = stubConfirm(true);
		const h = open([history], { removes: false });
		try {
			await setImmediate();
			h.icons(en["recovery.delete"]!)[0]!.fire("click");
			await setImmediate();
			assert.equal(String(Notice.last?.message), en["versions.deleteFailed"]);
			assert.equal(h.listed(), 2);
		} finally { confirm.restore(); h.destroy(); }
	});

	it("deletes nothing on a no", async () => {
		const confirm = stubConfirm(false);
		const h = open([history]);
		try {
			await setImmediate();
			h.icons(en["recovery.delete"]!)[0]!.fire("click");
			await setImmediate();
			assert.deepEqual(h.removed, []);
		} finally { confirm.restore(); h.destroy(); }
	});

	it("never separates automatic backups by the device that saved them", async () => {
		const myBackup: RecoverySource = { kind: "backup", time: Date.UTC(2026, 8, 22, 9), path: "b/data-y.json", historyHash: null, origin: "this-device", data: older };
		const h = open([unchanged, myBackup]);
		try {
			await setImmediate();
			for (const label of ["This device", "Another device", "Saved by an older version"]) {
				assert.ok(!h.contentEl.textContent.includes(label), `should not surface "${label}"`);
			}
			assert.deepEqual(h.rows().map(row => h.name(row)?.textContent), [en["versions.category.automatic"], en["versions.reason.beforeImport"]]);
		} finally { h.destroy(); }
	});

	it("offers nothing to restore while saving is paused, and says why", async () => {
		const h = open([history], { frozen: true });
		try {
			await setImmediate();
			assert.ok(h.contentEl.textContent.includes(en["versions.pausedHint"]!));
			const restore = h.buttons(en["recovery.restore"]!)[0]!;
			assert.equal(restore.getAttribute("aria-disabled"), "true");
			restore.fire("click");
			await setImmediate();
			assert.deepEqual(h.restored, []);
			assert.equal(String(Notice.last?.message), en["notice.blockedWhilePaused"], "the dimmed button says why");
			assert.equal(h.icons(en["recovery.details.view"]!).length, 1, "viewing details still works");
		} finally { h.destroy(); }
	});

	it("dims restoring a version that is the same as now, and says so when it is pressed", async () => {
		const confirm = stubConfirm(true);
		const h = open([unchanged]);
		try {
			await setImmediate();
			const restore = h.buttons(en["recovery.restore"]!)[0]!;
			assert.equal(restore.getAttribute("aria-disabled"), "true");
			restore.fire("click");
			await setImmediate();
			assert.equal(String(Notice.last?.message), en["versions.restoreSame"]);
			assert.deepEqual(h.restored, [], "nothing was restored, and nobody was asked");
		} finally { confirm.restore(); h.destroy(); }
	});

	it("leaves a restorable version undimmed", async () => {
		const confirm = stubConfirm(true);
		const h = open([history]);
		try {
			await setImmediate();
			const restore = h.buttons(en["recovery.restore"]!)[0]!;
			assert.equal(restore.getAttribute("aria-disabled"), "false");
			restore.fire("click");
			await setImmediate();
			assert.deepEqual(h.restored, [older]);
		} finally { confirm.restore(); h.destroy(); }
	});

	// The rows once wore `.callout-studio-row`, a size container, and Obsidian's
	// unnamed `@container (max-width: 400px)` settings rules then pinned the
	// control to the full row width, collapsing the text column to 0px. The card
	// is a plain `.setting-item` now, and the stylesheet keeps a floor under the
	// text column.
	it("styles a rail, dots, times and cards, and keeps the text column from collapsing", () => {
		const css = readRepoFile("styles.css").replace(/\/\*[\s\S]*?\*\//g, "");
		for (const wanted of ["cs-version-marker", "cs-recovery-rows", "cs-recovery-controls-wrapped", "--cs-timeline-gutter", "cs-recovery-time", "cs-recovery-day"]) {
			assert.ok(css.includes(wanted), `${wanted} is styled`);
		}
		const rowRules = css.match(/[^{}]*\.cs-recovery-row[^{}]*\{[^{}]*\}/g) ?? [];
		assert.ok(!rowRules.some(rule => /container-type:\s*inline-size/.test(rule)), "the card is not a size container");
		assert.ok(!rowRules.some(rule => /overflow-wrap:\s*anywhere/.test(rule)),
			"`anywhere` lets the text column shrink to a letter per line");
		assert.ok(rowRules.some(rule => /min-width:\s*min\(12rem,\s*100%\)/.test(rule)), "the text column has a floor");
		// A 12rem flex-basis is a HEIGHT once Obsidian's narrow-row rule stacks the card into a
		// column: the text kept 12rem and left a blank gap above the buttons.
		assert.ok(!rowRules.some(rule => /flex:\s*1 1 12rem/.test(rule)),
			"the floor is the min-width, not a flex-basis that becomes a height in a column");
		assert.ok(rowRules.some(rule => /flex:\s*1 1 0;/.test(rule)), "the text column's basis is 0");
	});

	// Obsidian's sticky title bar has z-index 1, and so do the absolutely placed
	// times; with a tie the later one wins, so the clock digits were drawn over
	// the bar while the cards went behind it. The page's box is its own stacking
	// context, which puts all of it (the times too) under the bar.
	it("keeps the times under the sticky title bar", () => {
		const css = readRepoFile("styles.css").replace(/\/\*[\s\S]*?\*\//g, "");
		const pageRules = css.match(/(?:^|\})\s*\.cs-recovery-page\s*\{[^{}]*\}/g) ?? [];
		assert.ok(pageRules.some(rule => /isolation:\s*isolate/.test(rule)),
			"`.cs-recovery-page` is a stacking context of its own");
		assert.ok(/\.cs-recovery-list\s+\.cs-recovery-time\s*\{[^{}]*z-index:\s*1;/.test(css),
			"the times keep their z-index above the row's hover area, which is why the page isolates");
	});
});
