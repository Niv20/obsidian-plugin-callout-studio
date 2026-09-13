import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { setLocale } from "../src/i18n";
import { en } from "../src/i18n/en";
import { reportLegacyDiscoveryMigration } from "../src/manager/legacyDiscoveryNotices";

const notices: string[] = [];
(globalThis as unknown as { __CS_NOTICES__: string[] }).__CS_NOTICES__ = notices;
setLocale("en");

afterEach(() => {
	notices.length = 0;
	setLocale("en");
});

describe("legacy discovery migration reporting", () => {
	it("keeps a successful recovery copy silent and logs its exact path", (test) => {
		const debug = test.mock.method(console, "debug", () => undefined);
		const path = ".obsidian/plugins/callout-studio/backups/legacy-discovery-v1-abc.json";

		reportLegacyDiscoveryMigration({ kind: "archived", path });

		assert.deepEqual(notices, []);
		assert.equal(debug.mock.callCount(), 1);
		assert.deepEqual(debug.mock.calls[0]?.arguments, [
			"[callout-studio] legacy discovery recovery copy saved",
			path,
		]);
	});

	it("shows one localized notice when the recovery copy fails", (test) => {
		const debug = test.mock.method(console, "debug", () => undefined);

		reportLegacyDiscoveryMigration({ kind: "failed" });

		assert.deepEqual(notices, [en["notice.legacyDiscoveryArchiveFailed"]]);
		assert.equal(debug.mock.callCount(), 0);
	});

	it("reports nothing when no legacy discovery migration was needed", (test) => {
		const debug = test.mock.method(console, "debug", () => undefined);

		reportLegacyDiscoveryMigration({ kind: "none" });

		assert.deepEqual(notices, []);
		assert.equal(debug.mock.callCount(), 0);
	});
});
