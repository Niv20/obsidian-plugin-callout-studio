/**
 * Recovery copies must pass the same validation as the file they preserve.
 *
 * The loaded sync envelope used to ride along in every registry snapshot as a
 * "foreign field", so a device that edited after loading carried an envelope
 * certifying a body it no longer had. The pre-adoption backup inherited it:
 * two of five real backups failed their integrity check, and copying one back
 * over `data.json` — the documented recovery — froze saving on every device.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pair } from "./support/syncReplicaHarness";
import { hasSafeSettingsFileShape } from "../src/manager/settingsFileShape";
import { SYNC_KEY } from "../src/manager/syncTree";

describe("recovery copies of local settings", () => {
	it("carry no stale sync envelope and pass their own validation", async () => {
		await pair(async (a, b) => {
			a.registry.update("shared", { colorLight: "#111111" }); await a.host.saveSettings();
			await b.deliver(await a.read());
			// b now describes a newer body than the envelope it loaded.
			b.registry.update("shared", { colorDark: "#222222" }); await b.host.saveSettings();
			assert.ok(!(SYNC_KEY in b.registry.toSaveData()), "a registry snapshot carries a sync envelope");
			// a replaces b's row, so b preserves its own state before adopting.
			a.registry.update("shared", { displayName: "Replaced" }); await a.host.saveSettings();
			await b.deliver(await a.read());
			const backups = await b.backups();
			assert.ok(backups.length > 0, "no recovery copy was written");
			for (const copy of backups) {
				assert.ok(!(SYNC_KEY in (copy as object)), "a recovery copy kept a sync envelope");
				assert.ok(hasSafeSettingsFileShape(copy as Record<string, unknown>), "a recovery copy fails its own validation");
			}
			assert.equal(b.registry.get("shared")?.colorDark, "#222222");
			assert.equal(b.registry.get("shared")?.displayName, "Replaced");
		});
	});
});
