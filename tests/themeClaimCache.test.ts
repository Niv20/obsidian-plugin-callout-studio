/**
 * tests/themeClaimCache.test.ts — the claim check's verdicts, kept on the device.
 *
 * What they are for: a callout the theme names but does not draw is this
 * plugin's, and until the check has measured that, it counts as the theme's.
 * Without a remembered answer that meant one stylesheet without the callout's
 * design at every launch - a flash in any open note.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import {
	THEME_CLAIMS_STORAGE_KEY,
	localClaimVerdicts,
} from "../src/manager/theme/themeClaimCache";

interface FakeStorage {
	held: Map<string, string>;
	writes: number;
	failWrite: boolean;
	failRead: boolean;
}

function storage(): FakeStorage {
	return { held: new Map(), writes: 0, failWrite: false, failRead: false };
}

/** Run `body` with `window.localStorage` backed by `store`, or absent. */
function withStorage(store: FakeStorage | null, body: () => void): void {
	const g = globalThis as Record<string, unknown>;
	const saved = g.window;
	g.window = store
		? {
				localStorage: {
					getItem(key: string): string | null {
						if (store.failRead) throw new Error("SecurityError");
						return store.held.get(key) ?? null;
					},
					setItem(key: string, value: string): void {
						store.writes++;
						if (store.failWrite) throw new Error("QuotaExceededError");
						store.held.set(key, value);
					},
				},
			}
		: {};
	try {
		body();
	} finally {
		g.window = saved;
	}
}

const app = (appId = "vault-a"): App => ({ appId }) as unknown as App;

describe("verdicts kept on this device", () => {
	it("gives back what was saved for the same theme, and nothing for another", () => {
		const store = storage();
		withStorage(store, () => {
			const cache = localClaimVerdicts(app());
			cache.save("Catppuccin@1.0", new Map([["note", false], ["tip", true]]));
			assert.deepStrictEqual(
				[...(cache.load("Catppuccin@1.0") ?? [])],
				[["note", false], ["tip", true]],
			);
			assert.strictEqual(cache.load("Catppuccin@1.1"), null, "a new version measures again");
			assert.strictEqual(cache.load("Minimal@7.0"), null);
		});
	});

	it("seeds a theme whose version is not read yet from its newest entry", () => {
		// Early in a launch Obsidian may not have loaded the theme's manifest,
		// and the signature reads `Name@`.
		const store = storage();
		withStorage(store, () => {
			const cache = localClaimVerdicts(app());
			cache.save("Catppuccin@1.0", new Map([["note", true]]));
			cache.save("Catppuccin@1.1", new Map([["note", false]]));
			cache.save("Minimal@7.0", new Map([["tip", false]]));
			assert.deepStrictEqual([...(cache.load("Catppuccin@") ?? [])], [["note", false]]);
			assert.strictEqual(cache.load("Cat@"), null, "a name, not a prefix of one");
		});
	});

	it("is scoped to the vault, like every other key this plugin keeps there", () => {
		const store = storage();
		withStorage(store, () => {
			localClaimVerdicts(app("vault-a")).save("T@1", new Map([["note", false]]));
			assert.deepStrictEqual([...store.held.keys()], [`vault-a-${THEME_CLAIMS_STORAGE_KEY}`]);
			assert.strictEqual(localClaimVerdicts(app("vault-b")).load("T@1"), null);
		});
	});

	it("writes nothing when a re-check found what the last one found", () => {
		const store = storage();
		withStorage(store, () => {
			const cache = localClaimVerdicts(app());
			cache.save("T@1", new Map([["note", false]]));
			cache.save("T@1", new Map([["note", false]]));
			localClaimVerdicts(app()).save("T@1", new Map([["note", false]]));
			assert.strictEqual(store.writes, 1);
		});
	});

	it("keeps the last eight themes, dropping the one measured longest ago", () => {
		const store = storage();
		withStorage(store, () => {
			const cache = localClaimVerdicts(app());
			for (let i = 0; i < 9; i++) cache.save(`T${i}@1`, new Map([["note", false]]));
			assert.strictEqual(cache.load("T0@1"), null);
			assert.ok(cache.load("T1@1"));
			assert.ok(cache.load("T8@1"));
		});
	});

	it("reads anything it cannot trust as nothing remembered", () => {
		for (const raw of ["{", "null", '{"v":2,"themes":[]}', '{"v":1,"themes":[["T@1",[["note","no"]]]]}']) {
			const store = storage();
			store.held.set(`vault-a-${THEME_CLAIMS_STORAGE_KEY}`, raw);
			withStorage(store, () => {
				assert.strictEqual(localClaimVerdicts(app()).load("T@1"), null, raw);
			});
		}
	});

	it("degrades to nothing remembered when storage refuses or is missing", () => {
		const refusing = storage();
		refusing.failRead = true;
		refusing.failWrite = true;
		withStorage(refusing, () => {
			const cache = localClaimVerdicts(app());
			assert.doesNotThrow(() => cache.save("T@1", new Map([["note", false]])));
			assert.strictEqual(cache.load("T@1"), null);
		});
		withStorage(null, () => {
			const cache = localClaimVerdicts(app());
			assert.doesNotThrow(() => cache.save("T@1", new Map([["note", false]])));
			assert.strictEqual(cache.load("T@1"), null);
		});
		// No app id and no vault (a test, a headless run): no key at all.
		withStorage(storage(), () => {
			const cache = localClaimVerdicts({} as App);
			cache.save("T@1", new Map([["note", false]]));
			assert.strictEqual(cache.load("T@1"), null);
		});
	});
});
