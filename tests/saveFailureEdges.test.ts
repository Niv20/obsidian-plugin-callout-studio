import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SettingsWriter } from "../src/manager/SettingsWriter";
import { StaleWriteGuard } from "../src/manager/staleWriteGuard";
import { SaveGuard } from "../src/utils/saveGuard";
import { SettingsSaveStatus } from "../src/manager/settingsSaveStatus";
import { saveSettingsWithFeedback } from "../src/manager/settingsSaveFeedback";
import { reportSettingsSaveFailure } from "../src/manager/settingsSaveReporter";
import { settingsSaveMessage } from "../src/manager/settingsSaveMessage";
import { registerLocale, setLocale } from "../src/i18n";
import { EditorSaveSession } from "../src/settings/editor/EditorSaveSession";
import { recoveryActionHarness } from "./support/recoveryActionHarness";
import { definition } from "./support/discoveryHarness";
import { installFakeDom } from "./support/fakeDom";

const dom = installFakeDom();
const notices = (globalThis as { __CS_NOTICES__?: string[] });

describe("save failures remain retryable and accurately reported", () => {
	it("cancels a queued stale notice when recovery succeeds before the timer runs", async () => {
		let notified = 0;
		const guard = new StaleWriteGuard({ readCurrent: async () => '{"n":2}', onStaleWrite: () => { notified++; } });
		const base = new SaveGuard(); base.adopt('{"n":1}');
		assert.equal(await guard.blocks(base), true);
		guard.clear(); dom.window.flushTimers(); assert.equal(notified, 0);
		assert.equal(await guard.blocks(base), true);
		dom.window.flushTimers(); assert.equal(notified, 1);
		guard.destroy();
	});
	for (const invalidate of ["clear", "destroy"] as const) {
		it(`ignores a failed stale read that finishes after ${invalidate}`, async () => {
			let reject!: (error: Error) => void, blocked = 0, notified = 0;
			const guard = new StaleWriteGuard({
				readCurrent: () => new Promise((_resolve, fail) => { reject = fail; }),
				onBlocked: () => { blocked++; }, onStaleWrite: () => { notified++; },
			});
			const base = new SaveGuard(); base.adopt('{}');
			const pending = guard.blocks(base); guard[invalidate](); reject(new Error("Read failed"));
			assert.equal(await pending, true); dom.window.flushTimers();
			assert.equal(blocked, 0); assert.equal(notified, 0); guard.destroy();
		});
	}
	it("confirms a completed replacement when the adapter rejects after writing it", async () => {
		let disk = '{"n":1}', writes = 0;
		const writer = new SettingsWriter({ build: () => ({ n: 2 }), readCurrent: async () => disk,
			write: async data => { disk = JSON.stringify(data); writes++; throw new Error("Post-write notification failed"); },
		});
		writer.adopt(disk); await writer.save(); await writer.save();
		assert.equal(writes, 1); assert.equal(writer.status.reason, null);
		assert.equal(writer.matchesLastWrite(disk), true); writer.destroy();
	});
	for (const [code, reason] of [["EACCES", "write-permission"], ["ENOSPC", "write-space"], ["EIO", "write"]] as const) {
		it(`classifies ${code} without leaking the adapter path`, async () => {
			const writer = new SettingsWriter({ build: () => ({ n: 2 }), readCurrent: async () => '{"n":1}',
				write: async () => { throw Object.assign(new Error(`${code}: /private/vault/data.json`), { code }); },
			});
			writer.adopt('{"n":1}'); await assert.rejects(writer.save());
			assert.equal(writer.status.reason, reason);
			assert.doesNotMatch(settingsSaveMessage(writer.status.reason), /private|data\.json|EACCES|ENOSPC|EIO/);
			writer.destroy();
		});
	}
	it("does not let a broken banner listener prevent writes or other listeners", async () => {
		const status = new SettingsSaveStatus(); let updates = 0;
		status.subscribe(() => { throw new Error("Detached UI"); }); status.subscribe(() => { updates++; });
		assert.doesNotThrow(() => status.fail("write"));
		assert.doesNotThrow(() => status.clear()); assert.equal(updates, 2);
	});
	it("reports only one English error for the background write and awaiting editor", async () => {
		const h = recoveryActionHarness(); await h.boot();
		const messages: string[] = []; notices.__CS_NOTICES__ = messages;
		registerLocale("test-save", { "saveStatus.write": "שגיאה", "editor.saveFailed": "שגיאה" }); setLocale("test-save");
		try {
			h.host.saveSettings = () => saveSettingsWithFeedback(h.host, () => {});
			h.state.failWrite = true;
			const draft = definition({ id: "personal" }); const session = new EditorSaveSession();
			assert.equal(await session.run(h.editor, async () => { h.host.registry.add(draft); return draft; }, () => {}), null);
			assert.equal(messages.length, 1); assert.match(messages[0]!, /settings file could not be saved/);
			reportSettingsSaveFailure(h.host.settingsWriter); assert.equal(messages.length, 1);
			h.state.failWrite = false;
			assert.ok(await session.run(h.editor, async () => draft, () => {}));
			h.state.failWrite = true; h.host.registry.update("personal", { displayName: "Changed" });
			assert.equal(await session.run(h.editor, async () => draft, () => {}), null);
			assert.equal(messages.length, 2, "a later independent failure is reported again");
		} finally { setLocale("en"); delete notices.__CS_NOTICES__; h.host.settingsWriter.destroy(); }
	});
});

it("retries a failed final checkpoint even when the current settings already match disk", async () => {
	let state = { n: 1 }, checkpoints = 0, fail = true;
	const writer = new SettingsWriter({ build: () => state,
		checkpoint: { read: async () => null, write: async () => { if (++checkpoints > 1 && fail) throw new Error("Checkpoint full"); } },
		write: async () => {},
	});
	writer.adopt(JSON.stringify(state));
	await assert.rejects(writer.commit({ n: 2 }, () => true, () => { state = { n: 2 }; }));
	await assert.rejects(writer.save()); assert.equal(writer.status.reason, "recovery-write");
	fail = false; await writer.save(); assert.equal(writer.status.reason, null);
	assert.equal(checkpoints, 4); writer.destroy();
});
