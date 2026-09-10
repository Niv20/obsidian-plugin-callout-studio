import { ConfirmModal } from "../src/utils/ConfirmModal";
import { confirmFreshStart, offerFreshStart } from "../src/manager/settingsNotices";
import type { Notice } from "obsidian";
// The value, not the type: `last` is the stub's own, and esbuild aliases both
// specifiers to this one module (see scripts/run-tests.mjs).
import { Notice as StubNotice } from "./support/obsidianStub";
import { FakeElement, type FakeDocumentFragment } from "./support/fakeDom";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { retrySettingsRecovery, startFreshSettings } from "../src/manager/settingsRecoveryActions";
import { tryAdoptExternalSettings } from "../src/manager/settingsAdopt";
import { EditorSaveSession } from "../src/settings/editor/EditorSaveSession";
import { definition } from "./support/discoveryHarness";
import { recoveryActionHarness } from "./support/recoveryActionHarness";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import type { PluginData } from "../src/types";
import { renderSaveStatusBanner } from "../src/settings/saveStatusBanner";

describe("explicit saving recovery", () => {
	it("canceling the new-file confirmation never runs the destructive action", async () => {
		const h = recoveryActionHarness({ missing: true, legacy: true }); await h.boot();
		const original = Object.getOwnPropertyDescriptor(ConfirmModal.prototype, "confirm")!; let calls = 0;
		try {
			ConfirmModal.prototype.confirm = () => Promise.resolve(false);
			assert.equal(await confirmFreshStart(h.host.app, null, async () => { calls++; return true; }), false);
			assert.equal(calls, 0); assert.equal(h.state.disk, null);
		} finally { Object.defineProperty(ConfirmModal.prototype, "confirm", original); h.host.settingsWriter.destroy(); }
	});
	it("keeps the notice visible until replacement persistence succeeds", async () => {
		const h = recoveryActionHarness(); const original = Object.getOwnPropertyDescriptor(ConfirmModal.prototype, "confirm")!;
		let hidden = 0, release!: (saved: boolean) => void;
		const pending = new Promise<boolean>(resolve => { release = resolve; });
		const notice = { hide: () => { hidden++; } } as unknown as Notice;
		try {
			ConfirmModal.prototype.confirm = () => Promise.resolve(true);
			const action = confirmFreshStart(h.host.app, notice, () => pending);
			await Promise.resolve(); assert.equal(hidden, 0); release(false);
			assert.equal(await action, false); assert.equal(hidden, 0);
			assert.equal(await confirmFreshStart(h.host.app, notice, async () => true), true);
			assert.equal(hidden, 1);
		} finally { Object.defineProperty(ConfirmModal.prototype, "confirm", original); h.host.settingsWriter.destroy(); }
	});
	it("keeps a reinstallation protected until an intentional new-file action succeeds", async () => {
		const h = recoveryActionHarness({ missing: true, legacy: true }); await h.boot();
		assert.equal(h.host.settingsWriter.status.reason, "missing");
		assert.equal(await retrySettingsRecovery(h.host), false); assert.equal(h.state.writes, 0);
		assert.equal(await startFreshSettings(h.host), true);
		h.host.registry.add(definition({ id: "personal" })); await h.host.saveSettings();
		const restart = new CalloutRegistry(); restart.load(JSON.parse(h.state.disk!) as PluginData);
		assert.equal(restart.get("personal")?.colorLight, "#336699");
		h.host.settingsWriter.destroy();
	});
	it("does not offer the new-file action for an unreadable settings file", async () => {
		const h = recoveryActionHarness(); h.state.disk = "broken"; await h.boot();
		assert.equal(await startFreshSettings(h.host), false);
		assert.equal(h.state.disk, "broken"); assert.equal(h.state.writes, 0);
		h.host.settingsWriter.destroy();
	});
	it("rechecks a file arriving while the reset confirmation was open", async () => {
		const h = recoveryActionHarness({ missing: true, legacy: true }); await h.boot();
		const remote = new CalloutRegistry(); remote.load(null); remote.add(definition({ id: "remote" }));
		h.state.disk = JSON.stringify(remote.toSaveData());
		assert.equal(await startFreshSettings(h.host), true);
		assert.ok(h.host.registry.get("remote"));
		assert.ok((JSON.parse(h.state.disk) as PluginData).callouts.some(row => row.id === "remote"));
		h.host.settingsWriter.destroy();
	});
	it("does not overwrite a file arriving during the new-file checkpoint", async () => {
		const h = recoveryActionHarness({ missing: true, legacy: true }); await h.boot();
		const remote = JSON.stringify({ callouts: [definition({ id: "arrived-late" })] });
		h.state.beforeCheckpoint = () => { h.state.disk = remote; };
		assert.equal(await startFreshSettings(h.host), false);
		assert.equal(h.state.disk, remote); assert.equal(h.state.writes, 0);
		h.host.settingsWriter.destroy();
	});
	it("preserves the old recovery copy before an intentional new file replaces it", async () => {
		const h = recoveryActionHarness({ missing: true, legacy: true }); await h.boot();
		const old = { callouts: [definition({ id: "old-personal" })] }; h.state.checkpoint = old;
		assert.equal(await startFreshSettings(h.host), true);
		assert.ok([...h.files.values()].some(text => JSON.stringify(JSON.parse(text)) === JSON.stringify(old)));
		h.host.settingsWriter.destroy();
	});
	it("does not replace the recovery copy if its reset backup cannot be verified", async () => {
		const h = recoveryActionHarness({ missing: true, legacy: true }); await h.boot();
		const saved = { callouts: [definition({ id: "only-copy" })] }; h.state.checkpoint = saved;
		h.host.app.vault.adapter.read = () => Promise.resolve("truncated backup");
		assert.equal(await startFreshSettings(h.host), false);
		assert.equal(h.host.settingsWriter.status.reason, "backup");
		assert.deepEqual(h.state.checkpoint, saved); assert.equal(h.state.writes, 0);
		h.host.settingsWriter.destroy();
	});
	it("keeps reset retryable after a failed checkpoint and does not claim success", async () => {
		const h = recoveryActionHarness({ missing: true, legacy: true }); await h.boot(); h.state.failCheckpoint = true;
		assert.equal(await startFreshSettings(h.host), false); assert.equal(h.state.writes, 0);
		assert.equal(h.host.settingsWriter.status.frozenReason, "missing");
		assert.equal(h.host.settingsWriter.status.reason, "recovery-write");
		h.state.failCheckpoint = false; assert.equal(await startFreshSettings(h.host), true);
		h.host.settingsWriter.destroy();
	});
	it("recovers a transient checkpoint read failure without restarting or replacing the data file", async () => {
		const h = recoveryActionHarness(); const original = h.state.disk; h.state.failRead = true; await h.boot();
		assert.equal(h.host.settingsWriter.status.reason, "recovery-read");
		assert.equal(h.host.settingsWriter.isFrozen, true); assert.equal(h.state.disk, original);
		h.state.failRead = false; assert.equal(await retrySettingsRecovery(h.host), true);
		assert.equal(h.host.settingsWriter.status.reason, null); assert.equal(h.host.settingsWriter.isFrozen, false);
		h.host.settingsWriter.destroy();
	});
	it("keeps the UI available after a launch checkpoint write failure and recovers when storage returns", async () => {
		const h = recoveryActionHarness(); h.state.failCheckpoint = true;
		await assert.doesNotReject(() => h.boot());
		assert.equal(h.host.settingsWriter.status.reason, "recovery-write"); assert.equal(h.state.writes, 0);
		h.state.failCheckpoint = false; assert.equal(await retrySettingsRecovery(h.host), true);
		h.host.settingsWriter.destroy();
	});
	it("distinguishes primary storage failure and successfully retries the unsaved edit", async () => {
		const h = recoveryActionHarness(); await h.boot(); h.state.failWrite = true;
		h.host.registry.add(definition({ id: "disk-failed" }));
		await assert.rejects(h.host.saveSettings()); assert.equal(h.host.settingsWriter.status.reason, "write");
		h.state.failWrite = false; assert.equal(await retrySettingsRecovery(h.host), true);
		assert.ok((JSON.parse(h.state.disk!) as PluginData).callouts.some(row => row.id === "disk-failed"));
		h.host.settingsWriter.destroy();
	});
	it("retries a failed checkpoint even when the primary settings already match", async () => {
		const h = recoveryActionHarness(); await h.boot();
		h.state.failCheckpoint = true;
		await assert.rejects(h.host.settingsWriter.remember(h.host.registry.toSaveData()));
		assert.equal(await retrySettingsRecovery(h.host), false);
		assert.equal(h.host.settingsWriter.status.reason, "recovery-write");
		h.state.failCheckpoint = false;
		assert.equal(await retrySettingsRecovery(h.host), true);
		assert.equal(h.host.settingsWriter.status.reason, null);
		h.host.settingsWriter.destroy();
	});
	it("retains editor ownership while an explicit action loads sync, then Save succeeds", async () => {
		const h = recoveryActionHarness(); await h.boot(); h.host.settingsEditOpen = true;
		const incoming = JSON.parse(h.state.disk!) as PluginData; incoming.callouts.push(definition({ id: "remote" }));
		h.state.disk = JSON.stringify(incoming);
		const session = new EditorSaveSession(); const draft = definition({ id: "draft" });
		const save = () => session.run(h.editor, async () => { h.host.registry.add(draft); return draft; }, () => {});
		assert.equal(await save(), null); assert.equal(h.host.settingsWriter.status.reason, "changed");
		assert.equal(await tryAdoptExternalSettings(h.host), "deferred");
		assert.equal(await session.recover(h.editor, () => {}), true);
		assert.equal(h.host.settingsEditOpen, true); assert.ok(h.host.registry.get("remote"));
		assert.ok(await save()); assert.ok(h.host.registry.get("draft"));
		h.host.settingsWriter.destroy();
	});
	it("does not run unfinished note updates after their required definition changes", async () => {
		const h = recoveryActionHarness(); await h.boot(); h.host.settingsEditOpen = true;
		const session = new EditorSaveSession(); const draft = definition({ id: "renamed" });
		h.host.registry.add(draft); h.state.failWrite = true; let rewrites = 0;
		await assert.rejects(session.applyVaultChanges(h.editor, async () => { rewrites++; }, draft));
		h.host.registry.update("renamed", { colorLight: "#000000" }); h.state.failWrite = false;
		assert.equal(await session.run(h.editor, async () => draft, () => {}), null);
		assert.equal(h.host.settingsWriter.status.reason, "sync-conflict"); assert.equal(rewrites, 0);
		h.host.settingsWriter.destroy();
	});
	it("the startup notice opens the settings tab rather than replacing the file itself", () => {
		// The one destructive action this plugin has does not belong on a
		// transient surface people dismiss by clicking at. The notice navigates;
		// the banner it lands on is where the choice is actually made.
		const h = recoveryActionHarness();
		const opened: string[] = []; let panes = 0;
		(h.host.app as unknown as { setting: unknown }).setting = {
			open: () => { panes++; },
			openTabById: (id: string) => { opened.push(id); return null; },
		};
		offerFreshStart(h.host.app, h.host.manifest.id);
		const notice = StubNotice.last!;
		// The link is a direct child of the notice fragment, which has no
		// `querySelector` of its own — a fragment is a bag of nodes, not a tree.
		const link = (notice.message as FakeDocumentFragment).childNodes
			.find((node): node is FakeElement => node instanceof FakeElement && node.hasClass("cs-notice-action"));
		assert.ok(link, "the notice carries no action link");
		assert.equal(link.textContent, "Open Callout Studio settings");
		const click = { type: "click", preventDefault: () => {} };
		link.dispatchEvent(click);
		assert.equal(panes, 1);
		assert.deepStrictEqual(opened, ["callout-studio"]);
		assert.equal(notice.hidden, true);
		assert.equal(h.state.disk !== null, true, "navigating must not touch the settings file");
		h.host.settingsWriter.destroy();
	});
	it("updates a persistent banner without rebuilding the form and disposes its listener", async () => {
		const h = recoveryActionHarness(); await h.boot();
		const container = h.dom.document.createElement("div"); const input = container.createEl("input"); input.value = "My draft";
		const dispose = renderSaveStatusBanner(h.host, container as unknown as HTMLElement, { retry: async () => true, startFresh: async () => true });
		h.host.settingsWriter.freeze("missing");
		assert.equal(container.querySelectorAll("button").length, 2);
		// Both actions belong to the banner's own action row, and the row is what
		// stacks them full width on a phone — a button left as a sibling of the
		// prose would sit outside that and lay out on its own.
		assert.equal(container.querySelectorAll(".cs-readonly-banner-actions button").length, 2);
		assert.equal(container.querySelector(".cs-readonly-banner-title")?.textContent, "Saving is paused");
		assert.equal(input.value, "My draft");
		h.host.settingsWriter.freeze("recovery-read");
		assert.equal(container.querySelectorAll("button").length, 1);
		assert.match(container.textContent, /local recovery copy/);
		dispose(); const text = container.textContent; h.host.settingsWriter.thaw();
		assert.equal(container.textContent, text); h.host.settingsWriter.destroy();
	});
});
