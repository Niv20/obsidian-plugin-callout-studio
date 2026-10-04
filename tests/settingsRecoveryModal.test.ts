/**
 * Version history: every earlier setup in one timeline, newest first, whether
 * it was kept on this device, in the vault's backups folder, or left behind by
 * a sync service. A setup kept in several places is one row with one timeline dot; each
 * row is named by why it was kept, and says how far it
 * is from now. Restoring asks first and is unavailable while saving is paused;
 * viewing and deleting remain available.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { setImmediate } from "node:timers/promises";
import type { App } from "obsidian";
import { Notice } from "./support/obsidianStub";
import type { PluginData } from "../src/types";
import { SettingsRecoveryModal, type RecoveryModalPlugin } from "../src/settings/SettingsRecoveryModal";
import type { RecoverySource, SettingsRecoveryService } from "../src/manager/settingsRecoveryService";
import { mergeVersions, type SetupVersion } from "../src/manager/setupVersions";
import { en } from "../src/i18n/en";
import { he } from "../src/i18n/he";
import { getLocale, registerLocale, setLocale, t } from "../src/i18n";
import { versionDay, versionName, versionTime } from "../src/settings/versionRow";
import { fakeDom, type FakeElement } from "./support/fakeDom";
import { TestKeymap, TestScope } from "./support/fakeKeymap";
import { stubConfirm } from "./support/importSafetyStubs";
import { readRepoFile } from "./support/sourceScan";

const older: Partial<PluginData> = { callouts: [] };
const same: Partial<PluginData> = { version: 5 };

interface Options {
	frozen?: boolean;
	locale?: "en" | "he";
	/** What deleting answers: whether every copy went. */
	removes?: boolean;
}

function open(sources: RecoverySource[], options: Options = {}) {
	fakeDom.light();
	const previousLocale = getLocale();
	if (options.locale === "he") registerLocale("he", he);
	setLocale(options.locale ?? "en");
	const restored: unknown[] = [];
	const removed: SetupVersion[] = [];
	let listed = 0;
	const recovery = {
		listVersions: () => { listed++; return Promise.resolve(mergeVersions(sources)); },
		difference: (data: unknown) => ({ callouts: 1, changed: data === same ? 0 : 2 }),
		restore: (data: unknown) => { restored.push(data); return Promise.resolve("restored" as const); },
		removeVersion: (version: SetupVersion) => { removed.push(version); return Promise.resolve(options.removes ?? true); },
	} as unknown as SettingsRecoveryService;
	const keymap = new TestKeymap(), scope = new TestScope();
	const app = { keymap, scope } as unknown as App;
	const plugin: RecoveryModalPlugin = { recovery, settingsWriter: { isFrozen: options.frozen ?? false } };
	const modal = new SettingsRecoveryModal(app, plugin);
	const containerEl = fakeDom.document.body.createDiv({ cls: "modal-container" });
	const modalEl = containerEl.createDiv({ cls: "modal" });
	const titleEl = modalEl.createDiv({ cls: "modal-header" }).createDiv({ cls: "modal-title" });
	const contentEl = modalEl.createDiv({ cls: "modal-content" });
	let closed = false;
	// What Obsidian's Modal does with Escape: close, from the scope it pushed.
	scope.register([], "Escape", () => { closed = true; return false; });
	keymap.pushScope(scope);
	Object.assign(modal, { containerEl, modalEl, titleEl, contentEl, app, scope,
		setTitle: (title: string) => { titleEl.setText(title); return modal; },
		close: () => { closed = true; modal.onClose(); } });
	modal.onOpen();
	const rows = (): FakeElement[] => contentEl.querySelectorAll(".cs-recovery-row");
	const icons = (tooltip: string, within: FakeElement = contentEl): FakeElement[] =>
		within.querySelectorAll(".clickable-icon").filter(el => el.dataset.csTooltip === tooltip);
	const buttons = (label: string): FakeElement[] =>
		contentEl.querySelectorAll(".clickable-icon").filter(el => el.dataset.csText === label);
	const name = (row: FakeElement) => row.querySelector(".cs-version-name");
	const press = (key: string) => keymap.handle({ key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false,
		isComposing: false, preventDefault() {}, stopPropagation() {} } as unknown as KeyboardEvent);
	return { contentEl, titleEl, restored, removed, rows, icons, buttons, name, press,
		listed: () => listed, isClosed: () => closed,
		destroy: () => { modal.onClose(); containerEl.remove(); setLocale(previousLocale); } };
}

const history: RecoverySource = { kind: "history", time: Date.UTC(2026, 8, 20, 9), path: null, historyHash: "h1", origin: "this-device", data: older, reason: "edit" };
const unchanged: RecoverySource = { kind: "backup", time: Date.UTC(2026, 8, 21, 9), path: "b/data-x.json", historyHash: null, origin: "other-device", data: same, reason: "before-import" };
const unreadable: RecoverySource = { kind: "copy", time: null, path: ".obsidian/plugins/callout-studio/data 2.json", historyHash: null, origin: null, data: null };

describe("Version history", () => {
	it("lists every version in one timeline, newest first, each with one decorative dot", async () => {
		const h = open([history, unchanged, unreadable]);
		try {
			await setImmediate();
			assert.equal(h.titleEl.textContent, en["versions.title"]);
			assert.equal(h.contentEl.querySelectorAll(".cs-recovery-group").length, 0, "no groups by where a copy lives");
			const rows = h.rows();
			assert.deepEqual(rows.map(row => h.name(row)?.textContent),
				[en["versions.reason.beforeImport"], en["versions.reason.edit"], en["versions.category.syncCopy"]],
				"newest first; a copy with no time last");
			assert.equal(h.contentEl.querySelectorAll(".cs-version-badge").length, 0, "no visible location labels in the timeline");
			for (const row of rows) {
				assert.equal(row.querySelectorAll(".cs-version-marker").length, 1);
				const marker = row.querySelector(".cs-version-marker")!;
				assert.equal(marker.children.length, 0);
				assert.equal(marker.textContent, "");
				assert.equal(marker.getAttribute("aria-hidden"), "true");
				assert.equal(marker.getAttribute("aria-label"), null);
				assert.equal(marker.dataset.csTooltip, undefined);
			}
			const text = h.contentEl.textContent;
			for (const key of ["recovery.same", "recovery.unreadable"]) assert.ok(text.includes(en[key]!), key);
			assert.ok(!rows[2]!.textContent.includes("data 2.json"), "internal filenames are not shown");
			assert.equal(h.buttons(en["recovery.restore"]!).length, 2, "an unreadable copy offers nothing to restore");
			assert.equal(h.icons(en["recovery.delete"]!).length, 3, "every version can be deleted, even an unreadable one");
			assert.equal(h.contentEl.querySelectorAll("button.cs-version-name").length, 0, "version titles are plain text");
			assert.equal(h.contentEl.querySelectorAll(".cs-recovery-row.callout-studio-row").length, 3);
		} finally { h.destroy(); }
	});

	it("shows a setup kept on this device and in the vault once, with one timeline dot", async () => {
		const backup: RecoverySource = { kind: "backup", time: Date.UTC(2026, 8, 20, 10), path: "b/data-y.json", historyHash: null,
			origin: "this-device", data: { callouts: [] }, reason: "before-import" };
		const h = open([history, backup]);
		try {
			await setImmediate();
			const rows = h.rows();
			assert.equal(rows.length, 1, "one setup, one row");
			assert.equal(rows[0]!.querySelectorAll(".cs-version-marker").length, 1);
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

	it("groups by local calendar day across midnight and puts times outside the summaries", async () => {
		const times = [new Date(2026, 8, 22, 13).getTime(), new Date(2026, 8, 22, 0, 1).getTime(), new Date(2026, 8, 21, 23, 59).getTime()];
		const sources = times.map((time, index) => ({ ...history, time, historyHash: `day-${index}`, data: { version: index } }));
		const h = open([...sources, unreadable]);
		try {
			await setImmediate();
			const headings = h.contentEl.querySelectorAll(".cs-recovery-day");
			assert.deepEqual(headings.map(el => el.textContent), [
				versionDay(times[0]!),
				versionDay(times[2]!),
				en["recovery.details.unknownTime"],
			]);
			for (const [index, time] of times.entries()) {
				const clock = h.rows()[index]!.querySelector(".cs-recovery-time");
				assert.equal(clock?.textContent, new Date(time).toLocaleTimeString("en", { timeStyle: "short" }));
				assert.equal(clock?.getAttribute("datetime"), new Date(time).toISOString());
				const summary = h.rows()[index]!.querySelector(".setting-item-description")!;
				assert.equal(summary.querySelector(".cs-recovery-time"), null);
				const counts = summary.querySelector(".cs-recovery-summary-counts")!;
				assert.deepEqual(counts.children.map(el => el.textContent), [
					t("recovery.summaryCallouts", { callouts: 1 }), t("recovery.summaryChanges", { count: 2 }),
				], "both counts share a layout group without the date or time");
				assert.ok(summary.children.every(el => el.tagName === "DIV"));
			}
			assert.equal(h.rows()[3]!.querySelector(".cs-recovery-time"), null, "unknown times are not invented");
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

	it("keeps titles read-only on click and keyboard, with no extra Escape layer", async () => {
		const h = open([history]);
		try {
			await setImmediate();
			const name = h.name(h.rows()[0]!)!;
			assert.equal(name.tagName, "SPAN");
			name.fire("click");
			name.fire("keydown", { key: "Enter" });
			assert.equal(h.contentEl.querySelectorAll("input").length, 0);
			assert.equal(name.textContent, en["versions.reason.edit"]);
			h.press("Escape");
			assert.equal(h.isClosed(), true);
		} finally { h.destroy(); }
	});

	it("restores only after a yes, then closes", async () => {
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
			assert.ok((message as string).includes(`“${en["versions.reason.edit"]}”`), "the confirmation names the version");
			assert.ok(h.isClosed());
			assert.ok(String(Notice.last?.message).startsWith(`Restored “${en["versions.reason.edit"]}” from`));
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
				t("versions.deleteAvailableBody", { name: versionName(version), when: versionTime(version.time) }),
				t("versions.deleteSyncedFiles"), t("versions.deleteFinal"),
			].join("\n"));
			assert.ok(!message.includes("data 2.json"), "internal filenames are not shown");
			assert.equal(h.removed.length, 1);
			assert.equal(h.removed[0]!.copies.length, 3, "one row, one version: every copy goes");
			assert.ok(!h.isClosed(), "deleting does not close the window the way restoring does");
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
			assert.equal(h.contentEl.querySelectorAll("button.cs-version-name").length, 0, "titles stay plain text while saving is paused");
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

	// The row wears `.callout-studio-row`, a size container. Obsidian's unnamed
	// `@container (max-width: 400px)` settings rules then pinned its control to
	// the full row width in any narrow window, collapsing the text column to 0px.
	it("keeps its rows out of Obsidian's narrow-container settings rules", () => {
		const css = readRepoFile("styles.css").replace(/\/\*[\s\S]*?\*\//g, "");
		assert.match(css, /\.cs-recovery-row\.callout-studio-row\s*\{\s*container-type:\s*normal;/);
		const rowRules = css.match(/[^{}]*\.cs-recovery-row[^{}]*\{[^{}]*\}/g) ?? [];
		assert.ok(!rowRules.some(rule => /overflow-wrap:\s*anywhere/.test(rule)),
			"`anywhere` lets the text column shrink to a letter per line");
	});

});
