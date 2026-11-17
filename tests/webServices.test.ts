/**
 * tests/webServices.test.ts — the parts of the website export that decide
 * *whether* and *for whom* something is written: guessing the service, the
 * block this plugin owns inside `publish.js`, and the automatic refresh.
 *
 * What each must not do is the point of the file:
 *
 * - **Detection only suggests.** It reads the vault and nothing outside it,
 *   ranks what it found, and is wrong gracefully — an unreadable list is an
 *   empty one, and a hint is labelled as a hint.
 * - **A managed block never reaches past its markers.** The rest of
 *   `publish.js` is the user's; a block that was edited is recognised as
 *   edited, and one with no end is not guessed at.
 * - **The refresh touches only what was written by hand before, and writes
 *   only when something changed.** It is on for every target and remembers
 *   nothing: what is in the vault is the whole answer, and a vault with none
 *   of the files is answered without building anything.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
// Listed first among the project imports: it installs the DOM globals,
// `window.setTimeout` among them (see tests/support/fakeDom.ts).
import { fakeDom } from "./support/fakeDom";
import type { App } from "obsidian";
import { CSSInjector } from "../src/manager/CSSInjector";
import { WebAutoUpdate } from "../src/manager/web/autoUpdate";
import {
	rankServices,
	readServiceSignals,
	type Detection,
	type ServiceSignals,
} from "../src/manager/web/detectService";
import { buildBlock, findBlock, spliceBlock } from "../src/manager/web/managedBlock";
import {
	GARDEN_NOTE_PATH,
	PUBLISH_CSS,
	PUBLISH_JS,
	QUARTZ_NOTE_NAME,
	WEB_TARGET_IDS,
	targetFiles,
	targetPaths,
} from "../src/manager/web/targets";
import { buildWebBundleData, type WebExportPlugin } from "../src/manager/web/webData";
import { exportWebTarget } from "../src/manager/web/writeTarget";
import { definition } from "./support/cssInjectorHarness";
import { readingHarness } from "./support/readingHarness";
import { webFileMemory } from "./support/webFileMemory";

/* -------------------------------------------------------------------------- */
/* Guessing the service                                                       */
/* -------------------------------------------------------------------------- */

const NOTHING: ServiceSignals = {
	publishFiles: false,
	publishSite: false,
	publishPlugin: false,
	gardenPlugin: false,
	gardenNotes: false,
	quartzSyncer: false,
	quartzConfig: null,
	contentVault: false,
};

const rank = (found: Partial<ServiceSignals>): Detection[] => rankServices({ ...NOTHING, ...found });

describe("ranking what was found in a vault", () => {
	it("detects nothing in a vault that points nowhere", () => {
		assert.deepStrictEqual(rank({}), []);
	});

	it("takes a publisher's own plugin, or its files, as a strong sign", () => {
		assert.deepStrictEqual(rank({ gardenPlugin: true }), [
			{ id: "garden", strength: "strong", reason: "gardenPlugin" },
		]);
		assert.deepStrictEqual(rank({ quartzSyncer: true }), [
			{ id: "quartz", strength: "strong", reason: "quartzSyncer" },
		]);
		assert.deepStrictEqual(rank({ publishFiles: true }), [
			{ id: "publish", strength: "strong", reason: "publishFiles" },
		]);
	});

	it("reads the Quartz generation off the configuration file, and that the vault is the repository", () => {
		assert.deepStrictEqual(rank({ quartzConfig: 5 }), [
			{ id: "quartz", strength: "strong", reason: "quartzConfig", quartzVersion: 5, quartzInVault: true },
		]);
		assert.strictEqual(rank({ quartzConfig: 4 })[0]?.quartzVersion, 4);
	});

	it("labels a hint as a hint, and lists it after anything it is sure of", () => {
		const found = rank({ contentVault: true, publishPlugin: true, gardenNotes: true, publishSite: true });
		assert.deepStrictEqual(
			found.map((d) => `${d.id}:${d.strength}:${d.reason}`),
			["publish:strong:publishSite", "garden:weak:gardenNotes", "quartz:weak:contentVault"],
		);
	});

	it("names a service once, by its strongest sign", () => {
		const found = rank({ gardenPlugin: true, gardenNotes: true, quartzSyncer: true, contentVault: true });
		assert.deepStrictEqual(
			found.map((d) => `${d.id}:${d.reason}`),
			["garden:gardenPlugin", "quartz:quartzSyncer"],
		);
	});
});

/** A vault with these files, these notes' properties, and this name. */
function vault(
	files: Record<string, string>,
	notes: Array<Record<string, unknown> | null> = [],
	name = "My vault",
): App {
	const asked: string[] = [];
	const app = {
		asked,
		vault: {
			configDir: ".obsidian",
			getName: () => name,
			getMarkdownFiles: () => notes.map((_, i) => ({ path: `n${i}.md` })),
			adapter: {
				exists(path: string): Promise<boolean> {
					asked.push(path);
					return Promise.resolve(path in files);
				},
				read: (path: string): Promise<string> => Promise.resolve(files[path] ?? ""),
			},
		},
		metadataCache: {
			getFileCache: (file: { path: string }) => {
				const frontmatter = notes[Number(file.path.slice(1, -3))];
				return frontmatter ? { frontmatter } : null;
			},
		},
	};
	return app as unknown as App;
}

describe("looking at a vault", () => {
	it("reads both spellings of Obsidian's plugin lists", async () => {
		const asArray = await readServiceSignals(
			vault({
				".obsidian/core-plugins.json": '["file-explorer","publish"]',
				".obsidian/community-plugins.json": '["digitalgarden","quartz-syncer"]',
			}),
		);
		assert.deepStrictEqual([asArray.publishPlugin, asArray.gardenPlugin, asArray.quartzSyncer], [true, true, true]);

		const asMap = await readServiceSignals(
			vault({ ".obsidian/core-plugins.json": '{"publish":false,"sync":true}' }),
		);
		assert.strictEqual(asMap.publishPlugin, false);
	});

	it("finds Publish by its files and its site", async () => {
		const signals = await readServiceSignals(vault({ "publish.css": "", ".obsidian/publish.json": "{}" }));
		assert.deepStrictEqual([signals.publishFiles, signals.publishSite], [true, true]);
	});

	it("finds a garden by a note's property only when the plugin did not settle it", async () => {
		const byNote = await readServiceSignals(vault({}, [null, { title: "x" }, { "dg-publish": true }]));
		assert.strictEqual(byNote.gardenNotes, true);

		const byPlugin = await readServiceSignals(
			vault({ ".obsidian/community-plugins.json": '["digitalgarden"]' }, [{ "dg-publish": true }]),
		);
		assert.deepStrictEqual([byPlugin.gardenPlugin, byPlugin.gardenNotes], [true, false]);
	});

	it("tells Quartz 5 from Quartz 4 by which configuration file is there", async () => {
		assert.strictEqual((await readServiceSignals(vault({ "quartz.config.yaml": "" }))).quartzConfig, 5);
		assert.strictEqual((await readServiceSignals(vault({ "quartz.config.ts": "" }))).quartzConfig, 4);
		assert.strictEqual((await readServiceSignals(vault({}))).quartzConfig, null);
	});

	it("takes a vault named content as a hint, whatever its case", async () => {
		assert.strictEqual((await readServiceSignals(vault({}, [], "Content"))).contentVault, true);
		assert.strictEqual((await readServiceSignals(vault({}, [], "Notes"))).contentVault, false);
	});

	it("never asks about a path outside the vault", async () => {
		const app = vault({});
		await readServiceSignals(app);
		const asked = (app as unknown as { asked: string[] }).asked;
		assert.ok(asked.length > 0);
		for (const path of asked) {
			assert.ok(!path.startsWith("/") && !path.includes(".."), `looked outside the vault: ${path}`);
		}
	});

	it("treats a list it cannot parse as an empty one", async () => {
		const signals = await readServiceSignals(vault({ ".obsidian/community-plugins.json": "{not json" }));
		assert.strictEqual(signals.gardenPlugin, false);
	});
});

/* -------------------------------------------------------------------------- */
/* A block in somebody else's file                                            */
/* -------------------------------------------------------------------------- */

describe("a managed block", () => {
	const PROSE = ["", "What this is."];

	it("is a comment, a fingerprint, the body, and an end marker", async () => {
		const block = await buildBlock(PROSE, "body {}\n");
		assert.match(
			block,
			/^\/\* callout-studio:start — .*\n \*\n \* What this is\.\n \* fingerprint: [0-9a-f]{64} \*\/\nbody \{\}\n\/\* callout-studio:end \*\/\n$/,
		);
	});

	it("is found again, as ours, wherever it sits in a file", async () => {
		const block = await buildBlock(PROSE, "var a = 1;");
		const file = `// above\n\n${block}\n// below\n`;
		const state = await findBlock(file);
		assert.strictEqual(state.kind, "ours");
		if (state.kind !== "ours") return;
		assert.strictEqual(file.slice(state.from, state.to), block);
	});

	it("is recognised as edited when its body or its header was changed", async () => {
		const block = await buildBlock(PROSE, "var a = 1;");
		assert.strictEqual((await findBlock(block.replace("var a = 1;", "var a = 2;"))).kind, "edited");
		assert.strictEqual(
			(await findBlock(block.replace(/fingerprint: [0-9a-f]{4}/, "fingerprint: zzzz"))).kind,
			"edited",
		);
	});

	it("is not guessed at when its end marker is gone", async () => {
		const block = await buildBlock(PROSE, "var a = 1;");
		assert.strictEqual((await findBlock(block.replace("/* callout-studio:end */", ""))).kind, "broken");
		assert.strictEqual((await findBlock("no block here")).kind, "none");
	});

	it("is added after a blank line, or stands alone in an empty file", async () => {
		const block = await buildBlock(PROSE, "x");
		assert.strictEqual(spliceBlock(null, { kind: "none" }, block), block);
		assert.strictEqual(spliceBlock("  \n", { kind: "none" }, block), block);
		assert.strictEqual(spliceBlock("mine();\n\n\n", { kind: "none" }, block), `mine();\n\n${block}`);
	});

	it("is replaced in place, leaving what surrounds it", async () => {
		const first = await buildBlock(PROSE, "old");
		const next = await buildBlock(PROSE, "new");
		const file = `above\n\n${first}below\n`;
		assert.strictEqual(spliceBlock(file, await findBlock(file), next), `above\n\n${next}below\n`);
	});
});

/* -------------------------------------------------------------------------- */
/* Keeping files up to date                                                   */
/* -------------------------------------------------------------------------- */

interface Bench {
	app: App;
	plugin: WebExportPlugin;
	writes: string[];
	/** Every path the vault was asked about or read, in order. */
	asked: string[];
	files: Map<string, string>;
	auto: WebAutoUpdate;
}

function bench(): Bench {
	const files = new Map<string, string>();
	const folders = new Set<string>();
	const writes: string[] = [];
	const asked: string[] = [];
	const app = {
		vault: {
			configDir: ".obsidian",
			adapter: {
				exists(path: string): Promise<boolean> {
					asked.push(path);
					return Promise.resolve(files.has(path) || folders.has(path));
				},
				read(path: string): Promise<string> {
					asked.push(path);
					return Promise.resolve(files.get(path) ?? "");
				},
				write(path: string, data: string): Promise<void> {
					writes.push(path);
					files.set(path, data);
					return Promise.resolve();
				},
				mkdir(path: string): Promise<void> {
					folders.add(path);
					return Promise.resolve();
				},
			},
		},
	} as unknown as App;
	const { registry } = readingHarness();
	registry.add(definition({ id: "quiet", displayName: "Quiet" }));
	// One device: what it writes by hand it may refresh by itself afterwards.
	const plugin = { registry, cssInjector: new CSSInjector(app, registry), webFiles: webFileMemory() };
	return { app, plugin, writes, asked, files, auto: new WebAutoUpdate(app, plugin) };
}

const byHand = (b: Bench, target: (typeof WEB_TARGET_IDS)[number], quartzInVault = false) =>
	exportWebTarget(b.app, b.plugin, target, { confirmOverwrite: () => Promise.resolve(true), quartzInVault });

/** Let the debounce fire, then wait for the refresh it started. */
async function settle(b: Bench): Promise<void> {
	fakeDom.window.flushTimers();
	// Exports run one at a time, and the refresh queues its next only when the
	// one before is done, so each wait here lets it take one more step: more
	// waits than it has steps, and it is over. No test that waits this way
	// wrote the garden's note, and a target that is not there is the one an
	// automatic export cannot write.
	for (let step = 0; step < 8; step++) await exportWebTarget(b.app, b.plugin, "garden", { auto: true });
}

describe("keeping website files up to date", () => {
	it("says where each target's files are without building them, the same paths it then writes", () => {
		const { plugin } = bench();
		for (const id of WEB_TARGET_IDS) {
			for (const options of [{}, { quartzInVault: true }, { notePath: "moved/elsewhere.md" }]) {
				assert.deepStrictEqual(
					targetPaths(id, options),
					targetFiles(id, buildWebBundleData(plugin, id), options).map((file) => file.path),
					`${id} ${JSON.stringify(options)}`,
				);
			}
		}
	});

	it("creates nothing in a vault that has none of the files, and builds nothing to find that out", async () => {
		const b = bench();
		let built = 0;
		const generate = b.plugin.cssInjector.generateWebTokenCSS.bind(b.plugin.cssInjector);
		b.plugin.cssInjector.generateWebTokenCSS = (...args) => {
			built++;
			return generate(...args);
		};
		b.plugin.registry.update("quiet", { colorLight: "#aa0000" });
		b.auto.schedule();
		await settle(b);
		await b.auto.catchUp();
		assert.deepStrictEqual(b.writes, []);
		assert.strictEqual(built, 0, "no snapshot is built for a target that is not there");
		// Every place a file of ours could be was asked about, and none was read.
		for (const path of [
			PUBLISH_JS,
			PUBLISH_CSS,
			QUARTZ_NOTE_NAME,
			`content/${QUARTZ_NOTE_NAME}`,
			GARDEN_NOTE_PATH,
		]) {
			assert.ok(b.asked.includes(path), path);
		}
	});

	it("rewrites what was written by hand, once the change has settled, with no switch to turn on", async () => {
		const b = bench();
		await byHand(b, "quartz");
		const before = b.writes.length;

		b.plugin.registry.update("quiet", { colorLight: "#aa0000" });
		// A burst of edits is one rewrite: each call restarts the wait.
		b.auto.schedule();
		b.auto.schedule();
		b.auto.schedule();
		assert.strictEqual(b.writes.length, before, "nothing is written before the wait is over");
		await settle(b);
		assert.deepStrictEqual(b.writes.slice(before), [QUARTZ_NOTE_NAME], "and only the target that is there");
	});

	it("keeps every target that was written, each where it is", async () => {
		const b = bench();
		await byHand(b, "publish");
		await byHand(b, "garden");
		await byHand(b, "quartz", true);
		const before = b.writes.length;
		b.plugin.registry.update("quiet", { colorLight: "#aa0000" });
		await b.auto.catchUp();
		// A colour is in the stylesheet, so `publish.js` — the renderer and the
		// callouts' names — has nothing new to say and is left alone. Quartz's
		// note is found under `content/` though nothing remembers that it was
		// put there: a device that never opened the page keeps it too.
		assert.deepStrictEqual(b.writes.slice(before), [PUBLISH_CSS, `content/${QUARTZ_NOTE_NAME}`, GARDEN_NOTE_PATH]);
	});

	it("writes nothing when the callouts did not change", async () => {
		const b = bench();
		for (const id of WEB_TARGET_IDS) await byHand(b, id);
		const before = b.writes.length;
		await b.auto.catchUp();
		await b.auto.catchUp();
		assert.strictEqual(b.writes.length, before);
	});

	it("leaves a file the user edited, and a file the user deleted stays deleted", async () => {
		const b = bench();
		await byHand(b, "publish");
		await byHand(b, "quartz");
		await byHand(b, "garden");
		// An edit inside our block of publish.css: the block is no longer ours to replace.
		b.files.set(PUBLISH_CSS, (b.files.get(PUBLISH_CSS) ?? "").replace("inline-flex", "flex"));
		b.files.delete(QUARTZ_NOTE_NAME);
		const before = b.writes.length;
		b.plugin.registry.update("quiet", { colorLight: "#aa0000" });
		await b.auto.catchUp();
		assert.deepStrictEqual(b.writes.slice(before), [GARDEN_NOTE_PATH], "the rest is still refreshed");
		assert.ok(!b.files.has(QUARTZ_NOTE_NAME));
		assert.ok(!(b.files.get(PUBLISH_CSS) ?? "").includes("#aa0000"), "the edited block was left as it was");
	});

	it("tells whoever listens after a refresh that rewrote something, and only then", async () => {
		const b = bench();
		await byHand(b, "quartz");
		let told = 0;
		const stop = b.auto.onDidWrite(() => told++);
		await b.auto.catchUp();
		assert.strictEqual(told, 0, "nothing changed, nothing to tell");
		b.plugin.registry.update("quiet", { colorLight: "#aa0000" });
		await b.auto.catchUp();
		assert.strictEqual(told, 1);
		stop();
		b.plugin.registry.update("quiet", { colorLight: "#00aa00" });
		await b.auto.catchUp();
		assert.strictEqual(told, 1, "no longer listening");
	});

	it("stops for good once the plugin unloads", async () => {
		const b = bench();
		await byHand(b, "quartz");
		const before = b.writes.length;
		b.plugin.registry.update("quiet", { colorLight: "#aa0000" });
		b.auto.schedule();
		b.auto.destroy();
		await settle(b);
		b.auto.schedule();
		await settle(b);
		await b.auto.catchUp();
		assert.strictEqual(b.writes.length, before);
	});
});
