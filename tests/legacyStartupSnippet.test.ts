/**
 * tests/legacyStartupSnippet.test.ts — undoing the second CSS copy that
 * versions up to 2.5.0 wrote into the vault.
 *
 * Those versions kept the whole generated stylesheet at
 * `.obsidian/snippets/callout-studio-do-not-delete.css` and switched it on
 * through Obsidian's internal `app.customCss`, so callout colours were right in
 * the frame before community plugins loaded. Nothing ever removed it:
 * uninstalling the plugin left a ~100KB orphan still styling the vault, plus a
 * dangling name in `appearance.json`. `StartupStyleCache` replaced the layer;
 * this pass cleans up after it, and is marked for deletion in 3.0.0.
 *
 * It runs on EVERY launch rather than once behind a flag, which is what makes
 * the properties below the ones worth pinning — a cleanup that runs unattended,
 * forever, over a folder the user owns:
 *
 * - **It is idempotent, and cheap when there is nothing to do.** The normal path
 *   after the first cleanup is one `exists()` stat and an early return, with no
 *   write and no `requestLoadSnippets()`. A flag in `data.json` would have been
 *   cheaper still and was rejected: it syncs, so it could reach a second device
 *   before the file itself does and that device would then never clean up.
 * - **It disables before it deletes.** Doing it in that order means a delete
 *   that fails — vault open read-only, sync holding the file — still leaves the
 *   stale rules switched off rather than live and un-deletable.
 * - **It touches exactly one path**, derived from `app.vault.configDir`, and
 *   nothing else in the snippets folder.
 * - **It never throws.** It is awaited during `onLayoutReady`; a vault that
 *   refuses the write is not a reason to fail load.
 *
 * Every member of `app.customCss` is probed before use (`?.`), because the whole
 * API is undocumented — so the fakes below deliberately include one with the
 * pieces missing.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { removeLegacyStartupSnippet } from "../src/manager/legacyStartupSnippet";

const SNIPPET = "callout-studio-do-not-delete";
const CONFIG_DIR = ".obsidian";
const SNIPPET_PATH = `${CONFIG_DIR}/snippets/${SNIPPET}.css`;

function deferred() {
	let resolve!: () => void;
	const promise = new Promise<void>(done => { resolve = done; });
	return { promise, resolve };
}

interface Vault {
	/** Every path `exists()` was asked about. */
	stats: string[];
	/** Every path `remove()` was asked to delete. */
	removed: string[];
	/** Paths the adapter reports as present. */
	present: Set<string>;
	/** Make `remove()` reject, as a read-only or sync-locked vault does. */
	failRemove: boolean;
	/** Make `exists()` reject. */
	failExists: boolean;
	content: Map<string, string>;
	failArchiveWrite: boolean;
	corruptArchive: boolean;
	changeSource: boolean;
}

interface CustomCss {
	/** `["disable:name", "reload"]`, in the order the calls happened. */
	calls: string[];
	enabled: Set<string>;
}

interface Fake {
	app: App;
	vault: Vault;
	css: CustomCss;
}

/**
 * An app with the snippet in whichever state the test needs.
 *
 * `customCss: false` drops the internal API entirely — the case a future
 * Obsidian could produce, where the file must still be deleted (Obsidian
 * ignores an `enabledCssSnippets` entry whose file is missing).
 */
function fake(
	opts: {
		fileExists?: boolean;
		snippetEnabled?: boolean;
		customCss?: false | "partial";
		otherFiles?: string[];
	} = {},
): Fake {
	const vault: Vault = {
		stats: [],
		removed: [],
		present: new Set(opts.otherFiles ?? []),
		failRemove: false,
		failExists: false,
		content: new Map([[SNIPPET_PATH, "/* personal changes */ body { color: red; }"]]),
		failArchiveWrite: false,
		corruptArchive: false,
		changeSource: false,
	};
	if (opts.fileExists) vault.present.add(SNIPPET_PATH);

	const css: CustomCss = {
		calls: [],
		enabled: new Set(opts.snippetEnabled ? [SNIPPET] : []),
	};

	const customCss =
		opts.customCss === false
			? undefined
			: opts.customCss === "partial"
				? // Only the membership probe, so `setCssEnabledStatus?.()` and
					// `requestLoadSnippets?.()` both fall through their optional
					// calls. Nothing may explode on that.
					{ enabledSnippets: css.enabled }
				: {
						enabledSnippets: css.enabled,
						setCssEnabledStatus(name: string, on: boolean) {
							css.calls.push(`${on ? "enable" : "disable"}:${name}`);
							if (on) css.enabled.add(name);
							else css.enabled.delete(name);
						},
						requestLoadSnippets() {
							css.calls.push("reload");
						},
					};

	const app = {
		vault: {
			configDir: CONFIG_DIR,
			adapter: {
				async read(path: string): Promise<string> {
					if (vault.corruptArchive && path.endsWith(".txt")) return "truncated";
					const text = vault.content.get(path);
					if (text === undefined) throw new Error("ENOENT");
					return text;
				},
				async mkdir(path: string): Promise<void> { vault.present.add(path); },
				async write(path: string, text: string): Promise<void> {
					if (vault.failArchiveWrite) throw new Error("ENOSPC");
					vault.content.set(path, text); vault.present.add(path);
					if (vault.changeSource) vault.content.set(SNIPPET_PATH, "new edit during backup");
				},
				exists(path: string): Promise<boolean> {
					vault.stats.push(path);
					if (vault.failExists) {
						return Promise.reject(new Error("EIO"));
					}
					return Promise.resolve(vault.present.has(path));
				},
				remove(path: string): Promise<void> {
					vault.removed.push(path);
					if (vault.failRemove) {
						return Promise.reject(new Error("EPERM"));
					}
					vault.present.delete(path);
					return Promise.resolve();
				},
			},
		},
		customCss,
	} as unknown as App;

	return { app, vault, css };
}

/** Run `body` with `console.warn` swallowed, and hand back what it was told. */
async function withQuietWarnings(
	body: () => Promise<void>,
): Promise<unknown[][]> {
	const seen: unknown[][] = [];
	const real = console.warn;
	console.warn = (...args: unknown[]) => {
		seen.push(args);
	};
	try {
		await body();
	} finally {
		console.warn = real;
	}
	return seen;
}

describe("removeLegacyStartupSnippet — the vault that still has one", () => {
	it("preserves user edits in a verified inactive archive before deleting", async () => {
		const f = fake({ fileExists: true, snippetEnabled: true });
		const original = f.vault.content.get(SNIPPET_PATH);
		await removeLegacyStartupSnippet(f.app);
		const copies = [...f.vault.content].filter(([path]) => path.endsWith(".txt"));
		assert.strictEqual(copies.length, 1);
		assert.strictEqual(copies[0]?.[1], original);
		assert.ok(copies[0]?.[0].startsWith(`${CONFIG_DIR}/snippets/callout-studio-recovery/`));
		assert.deepStrictEqual(f.vault.removed, [SNIPPET_PATH]);
	});
	for (const fault of ["failArchiveWrite", "corruptArchive", "changeSource"] as const) {
		it(`preserves the source and enabled state when ${fault} prevents safe archival`, async () => {
			const f = fake({ fileExists: true, snippetEnabled: true }); f.vault[fault] = true;
			await withQuietWarnings(() => removeLegacyStartupSnippet(f.app));
			assert.deepStrictEqual(f.vault.removed, []);
			assert.strictEqual(f.css.enabled.has(SNIPPET), true);
			assert.strictEqual(f.vault.present.has(SNIPPET_PATH), true);
			f.vault[fault] = false;
			await removeLegacyStartupSnippet(f.app);
			assert.deepStrictEqual(f.vault.removed, [SNIPPET_PATH]);
		});
	}
	it("deletes the file and takes the name out of the enabled list", async () => {
		const f = fake({ fileExists: true, snippetEnabled: true });
		await removeLegacyStartupSnippet(f.app);

		assert.deepStrictEqual(f.vault.removed, [SNIPPET_PATH]);
		assert.strictEqual(f.css.enabled.has(SNIPPET), false);
	});

	it("disables BEFORE deleting, so a failed delete still leaves it switched off", async () => {
		// Order is the whole design here: disabling drops the snippet's <style>
		// out of the live cascade AND takes the name out of appearance.json, so
		// doing it first means the stale rules stop applying even when the file
		// itself cannot be removed.
		const f = fake({ fileExists: true, snippetEnabled: true });
		await removeLegacyStartupSnippet(f.app);

		assert.deepStrictEqual(f.css.calls, [`disable:${SNIPPET}`, "reload"]);
	});

	it("still disables when the delete is refused outright", async () => {
		const f = fake({ fileExists: true, snippetEnabled: true });
		f.vault.failRemove = true;

		const warnings = await withQuietWarnings(() =>
			removeLegacyStartupSnippet(f.app),
		);

		assert.strictEqual(f.css.enabled.has(SNIPPET), false, "switched off anyway");
		assert.strictEqual(warnings.length, 1, "and the user is told to remove it");
	});

	it("asks Obsidian to reload its snippets once the file is gone", async () => {
		const f = fake({ fileExists: true, snippetEnabled: true });
		await removeLegacyStartupSnippet(f.app);
		assert.strictEqual(f.css.calls.at(-1), "reload");
	});

	it("deletes a file that was never enabled, without touching the enabled list", async () => {
		// The state left by a device that synced the file but never ran the
		// version that switched it on.
		const f = fake({ fileExists: true, snippetEnabled: false });
		await removeLegacyStartupSnippet(f.app);

		assert.deepStrictEqual(f.vault.removed, [SNIPPET_PATH]);
		assert.deepStrictEqual(f.css.calls, ["reload"], "nothing to disable");
	});

	it("disables a dangling name whose file is already gone", async () => {
		// The other half of the same split: `appearance.json` synced but the
		// snippet did not. Left alone, the name sits in `enabledCssSnippets`
		// forever.
		const f = fake({ fileExists: false, snippetEnabled: true });
		await removeLegacyStartupSnippet(f.app);

		assert.deepStrictEqual(f.vault.removed, [], "nothing to delete");
		assert.deepStrictEqual(f.css.calls, [`disable:${SNIPPET}`, "reload"]);
	});
});

describe("removeLegacyStartupSnippet — the vault that never had one", () => {
	it("is one stat and an early return", async () => {
		// This is the path every launch takes from the second one onwards, and
		// forever in a vault that never ran 2.5.0. It has to stay free: no write,
		// no snippet reload, nothing that could make Obsidian re-read the folder.
		const f = fake();
		await removeLegacyStartupSnippet(f.app);

		assert.deepStrictEqual(f.vault.stats, [SNIPPET_PATH]);
		assert.deepStrictEqual(f.vault.removed, []);
		assert.deepStrictEqual(f.css.calls, []);
	});

	it("is idempotent — a second run after a real cleanup does nothing", async () => {
		const f = fake({ fileExists: true, snippetEnabled: true });
		await removeLegacyStartupSnippet(f.app);
		const callsAfterFirst = [...f.css.calls];

		await removeLegacyStartupSnippet(f.app);

		assert.deepStrictEqual(f.vault.removed, [SNIPPET_PATH], "deleted once");
		assert.deepStrictEqual(f.css.calls, callsAfterFirst, "and quiet after");
	});

	it("leaves every other snippet in the folder alone", async () => {
		// It removes by path, never by listing the folder — so the user's own
		// snippets are not merely spared, they are never even looked at.
		const others = [
			`${CONFIG_DIR}/snippets/my-theme-tweaks.css`,
			`${CONFIG_DIR}/snippets/callout-studio-do-not-delete.css.bak`,
			`${CONFIG_DIR}/snippets/callout-studio.css`,
		];
		const f = fake({ fileExists: true, snippetEnabled: true, otherFiles: others });
		await removeLegacyStartupSnippet(f.app);

		assert.deepStrictEqual(f.vault.removed, [SNIPPET_PATH]);
		for (const path of others) {
			assert.ok(f.vault.present.has(path), `${path} survived`);
		}
	});

	it("derives the path from the vault's own configDir", async () => {
		// A vault may be opened with a non-default config folder
		// (`--config-dir`), and hard-coding `.obsidian` would silently clean up
		// nothing there.
		const f = fake();
		(f.app.vault as unknown as { configDir: string }).configDir = ".obsidian-beta";
		await removeLegacyStartupSnippet(f.app);

		assert.deepStrictEqual(f.vault.stats, [
			`.obsidian-beta/snippets/${SNIPPET}.css`,
		]);
	});
});

describe("removeLegacyStartupSnippet — nothing here may throw", () => {
	it("copes with no `customCss` at all", async () => {
		// Every member is probed rather than assumed, so a future Obsidian that
		// renames or drops the internal API still gets the file deleted — and
		// Obsidian ignores an `enabledCssSnippets` entry whose file is missing.
		const f = fake({ fileExists: true, customCss: false });
		await removeLegacyStartupSnippet(f.app);
		assert.deepStrictEqual(f.vault.removed, [SNIPPET_PATH]);
	});

	it("copes with a `customCss` missing the two methods", async () => {
		const f = fake({
			fileExists: true,
			snippetEnabled: true,
			customCss: "partial",
		});
		await removeLegacyStartupSnippet(f.app);

		assert.deepStrictEqual(f.vault.removed, [SNIPPET_PATH]);
		assert.deepStrictEqual(f.css.calls, [], "there was nothing to call");
	});

	it("swallows a failing stat and says so once", async () => {
		const f = fake({ fileExists: true });
		f.vault.failExists = true;

		const warnings = await withQuietWarnings(() =>
			removeLegacyStartupSnippet(f.app),
		);

		assert.strictEqual(warnings.length, 1);
		assert.match(String(warnings[0]?.[0]), /callout-studio-do-not-delete\.css/);
	});

	it("resolves rather than rejecting when the delete fails", async () => {
		// It is awaited inside `onLayoutReady`; a rejection there is an unhandled
		// error in the console on every launch of a vault whose snippets folder
		// happens to be read-only.
		const f = fake({ fileExists: true });
		f.vault.failRemove = true;

		await withQuietWarnings(async () => {
			await assert.doesNotReject(() => removeLegacyStartupSnippet(f.app));
		});
	});

	it("names the file in the warning, so the user can finish the job by hand", async () => {
		const f = fake({ fileExists: true });
		f.vault.failRemove = true;

		const warnings = await withQuietWarnings(() =>
			removeLegacyStartupSnippet(f.app),
		);

		assert.match(String(warnings[0]?.[0]), /snippets folder manually/);
	});
});

describe("removeLegacyStartupSnippet — unload during cleanup", () => {
	it("does no work when the plugin is already inactive", async () => {
		const f = fake({ fileExists: true, snippetEnabled: true });
		await removeLegacyStartupSnippet(f.app, () => false);
		assert.deepStrictEqual(f.vault.stats, []);
		assert.deepStrictEqual(f.css.calls, []);
	});

	for (const stage of ["first-read", "mkdir", "write", "final-read"] as const) {
		it(`preserves the active source if unloaded during ${stage}`, async () => {
			const f = fake({ fileExists: true, snippetEnabled: true });
			const entered = deferred(), resume = deferred();
			const adapter = f.app.vault.adapter;
			const read = adapter.read.bind(adapter), mkdir = adapter.mkdir.bind(adapter), write = adapter.write.bind(adapter);
			let sourceReads = 0, active = true;
			const pause = async () => { entered.resolve(); await resume.promise; };
			adapter.read = async path => {
				const result = await read(path);
				if (path === SNIPPET_PATH) {
					sourceReads++;
					if ((stage === "first-read" && sourceReads === 1) || (stage === "final-read" && sourceReads === 2)) await pause();
				}
				return result;
			};
			adapter.mkdir = async path => { await mkdir(path); if (stage === "mkdir") await pause(); };
			adapter.write = async (path, text) => { await write(path, text); if (stage === "write") await pause(); };
			const pending = removeLegacyStartupSnippet(f.app, () => active);
			await entered.promise;
			active = false;
			resume.resolve();
			await pending;
			assert.deepStrictEqual(f.vault.removed, []);
			assert.deepStrictEqual(f.css.calls, []);
			assert.strictEqual(f.css.enabled.has(SNIPPET), true);
			assert.strictEqual(f.vault.present.has(SNIPPET_PATH), true);
			if (stage === "first-read" || stage === "mkdir") assert.strictEqual(f.vault.content.size, 1);
		});
	}

	it("does not reload snippets when an already-started removal completes after unload", async () => {
		const f = fake({ fileExists: true, snippetEnabled: true });
		const entered = deferred(), resume = deferred();
		const adapter = f.app.vault.adapter, remove = adapter.remove.bind(adapter);
		let active = true;
		adapter.remove = async path => { await remove(path); entered.resolve(); await resume.promise; };
		const pending = removeLegacyStartupSnippet(f.app, () => active);
		await entered.promise;
		active = false;
		resume.resolve();
		await pending;
		assert.deepStrictEqual(f.css.calls, [`disable:${SNIPPET}`]);
	});
});
