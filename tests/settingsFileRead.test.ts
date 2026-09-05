/**
 * tests/settingsFileRead.test.ts — telling "no file" apart from "no luck".
 *
 * `Plugin.loadData()` answers with a nullish value for both, and the two could
 * not be more different: one is a fresh install and starting from the shipped
 * defaults is right, the other is a file we failed to read and starting from the
 * defaults means the next save destroys it.
 *
 * Issue #41's second half is the second case happening for real. On a Syncthing
 * vault the reporter's plugin folder filled with alternating conflict copies,
 * every copy from one device exactly 0 bytes — and `JSON.parse("")` throws.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import type { App, PluginManifest } from "obsidian";
import { readSettingsFile } from "../src/manager/settingsFile";
import type { SettingsFileHost } from "../src/manager/settingsFile";
import { definition } from "./support/discoveryHarness";

/**
 * A host whose `loadData` answers exactly as Obsidian's `Vault.readJson` does:
 * `null` for `ENOENT` alone, `undefined` for every other read or parse failure.
 */
function host(opts: {
	raw: unknown;
	exists?: boolean | (() => never);
	dir?: string | undefined;
}): SettingsFileHost & { asked: string[] } {
	const asked: string[] = [];
	return {
		asked,
		app: {
			vault: {
				configDir: ".obsidian",
				adapter: {
					exists: (path: string) => {
						asked.push(path);
						if (typeof opts.exists === "function") opts.exists();
						return Promise.resolve(opts.exists ?? false);
					},
				},
			},
		} as unknown as App,
		manifest: {
			id: "callout-studio",
			dir: opts.dir,
		} as unknown as PluginManifest,
		loadData: () => Promise.resolve(opts.raw),
	};
}

describe("readSettingsFile", () => {
	it("reads a missing file as absent", async () => {
		const read = await readSettingsFile(host({ raw: null, exists: false }));
		assert.strictEqual(read.kind, "absent");
	});

	it("reads a present-but-unparseable file as unreadable, not absent", async () => {
		// The whole bug. `undefined` used to be cast to `null` and handed to
		// `CalloutRegistry.load`, which clears the map for a nullish argument.
		const read = await readSettingsFile(host({ raw: undefined, exists: true }));
		assert.strictEqual(read.kind, "unreadable");
	});

	it("does not trust loadData's nullish value on its own", async () => {
		// If Obsidian ever stopped distinguishing null from undefined, the
		// adapter still knows whether the file is there — which is the stable
		// question, and the reason this module asks it at all.
		const read = await readSettingsFile(host({ raw: null, exists: true }));
		assert.strictEqual(read.kind, "unreadable");
	});

	it("assumes the worse of the two when the adapter itself throws", async () => {
		// A wrong "absent" overwrites the user's settings; a wrong "unreadable"
		// costs one session of not writing them.
		const read = await readSettingsFile(
			host({
				raw: undefined,
				exists: () => {
					throw new Error("adapter is not answering");
				},
			}),
		);
		assert.strictEqual(read.kind, "unreadable");
	});

	it("reads an object as loaded, and re-serializes it for the guard", async () => {
		const raw = { version: 4, callouts: [], settings: { language: "auto" } };
		const read = await readSettingsFile(host({ raw }));
		assert.strictEqual(read.kind, "loaded");
		assert.strictEqual(
			read.kind === "loaded" ? read.json : null,
			JSON.stringify(raw),
		);
	});

	it("reads an empty object as loaded — a file somebody wrote", async () => {
		const read = await readSettingsFile(host({ raw: {} }));
		assert.strictEqual(read.kind, "loaded");
	});

	for (const [label, raw] of [
		["an array", []],
		["a number", 3],
		["a string", "hello"],
	] as const) {
		it(`reads ${label} as unreadable`, async () => {
			// These parse fine and are not settings. They also prove the file
			// exists, so they must never be handed on as `Partial<PluginData>`.
			const read = await readSettingsFile(host({ raw, exists: true }));
			assert.strictEqual(read.kind, "unreadable");
		});
	}

	it("asks about the plugin's own data.json", async () => {
		const h = host({ raw: null, dir: ".obsidian/plugins/callout-studio" });
		await readSettingsFile(h);
		assert.deepStrictEqual(h.asked, [
			".obsidian/plugins/callout-studio/data.json",
		]);
	});

	it("reconstructs the path when the manifest carries no dir", async () => {
		// `manifest.dir` is typed optional — the same fallback PackDataStore and
		// LocaleStore make.
		const h = host({ raw: null, dir: undefined });
		await readSettingsFile(h);
		assert.deepStrictEqual(h.asked, [
			".obsidian/plugins/callout-studio/data.json",
		]);
	});

	for (const [name, patch] of [
		["a missing icon", { icon: undefined }],
		["a null icon", { icon: null }],
		["a numeric icon value", { icon: { type: "lucide", value: 12 } }],
		["an object icon type", { icon: { type: {}, value: "pen" } }],
		["a missing name", { displayName: undefined }],
		["a non-string name", { displayName: {} }],
		["aliases stored as an object", { aliases: {} }],
		["a null alias", { aliases: ["valid", null] }],
		["a non-string background", { bgColorLight: {} }],
		["malformed metadata", { metadata: [] }],
		["an empty gradient", { bgGradient: {} }],
		["a non-string gradient end color", { bgGradient: { angleDeg: 45, toColorLight: 2, toColorDark: "#ffffff" } }],
		["a non-string text-gradient end color", { bgGradient: { angleDeg: 45, toColorLight: "#000000", toColorDark: "#ffffff", textToColorDark: {} } }],
	] as const) {
		it(`rejects ${name} before a partial registry rebuild`, async () => {
			const raw = { callouts: [{ ...definition({ id: "authored" }), ...patch }] };
			assert.strictEqual((await readSettingsFile(host({ raw }))).kind, "unreadable");
		});
	}

	for (const raw of [
		{ iconSvgCache: [null] },
		{ iconSvgCache: [{ name: "star", svg: 12, pack: "material" }] },
		{ materialSvgCache: [null] },
		{ materialSvgCache: { length: 1 } },
		{ settings: { fallbackCalloutId: {} } },
	]) {
		it(`rejects unsafe nested saved content ${JSON.stringify(raw)}`, async () => {
			assert.strictEqual((await readSettingsFile(host({ raw }))).kind, "unreadable");
		});
	}

	it("continues accepting partial built-in rows and unknown future fields", async () => {
		const raw = { callouts: [{ id: "note", colorLight: "rgb(1, 2, 3)" }], futureSetting: { value: true } };
		assert.strictEqual((await readSettingsFile(host({ raw }))).kind, "loaded");
	});
	it("accepts supported gradient shapes with legacy or future metadata intact", async () => {
		const raw = { callouts: [{ ...definition({ id: "gradient" }), bgGradient: {
			angleDeg: 45, toColorLight: "#ffffff", toColorDark: "#000000", type: "radial", futureGradientHint: true,
		} }] };
		const read = await readSettingsFile(host({ raw }));
		assert.strictEqual(read.kind, "loaded");
		assert.deepStrictEqual(read.kind === "loaded" && read.data, raw);
	});
});
