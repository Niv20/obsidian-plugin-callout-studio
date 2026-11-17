/**
 * tests/webTwoDevices.test.ts — the website files on two devices that share a
 * vault through a sync service.
 *
 * The files are in the vault, so they reach every device, and every device
 * that has them keeps them current. What must never happen is one device
 * putting its own version over another's: each of these was seen to happen
 * before `src/manager/web/fileMemory.ts`, when a file that was ours and
 * differed was reason enough to replace it.
 *
 * - **Other callouts.** A community plugin's settings are not synced by
 *   Obsidian Sync unless the user asks, and the Digital Garden note, being a
 *   note, is. A second device with the plugin's own defaults rewrote every
 *   file at each start, and the first rewrote them back at its next one.
 * - **Settings that are behind.** A device that started before its
 *   `data.json` had arrived put the previous callouts back, and adopting the
 *   file afterwards repaired nothing: an adoption announces no registry
 *   change.
 * - **Another build.** Two versions of the plugin write other bytes for the
 *   same callouts, and each start replaced the other's.
 * - **Settings that are not the user's.** With `data.json` unreadable the
 *   registry holds the defaults; the plugin writes no settings then, and
 *   wrote the website files all the same.
 *
 * A device here is a registry, a memory and a disk; "sync" is a copy of the
 * files from one disk to another, which is all a sync service does with a
 * file it does not merge. The devices that adopt settings are real launches
 * (`tests/support/launchWorld.ts`), so what an adoption does and does not
 * announce is the production code's answer, and their memory is a real
 * `DeviceLocalStore`.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
// Listed first among the project imports: it installs the DOM globals before
// anything under test loads (see tests/support/fakeDom.ts).
import "./support/fakeDom";
import { installFakeDomParser } from "./support/fakeDomParser";
import type { App } from "obsidian";
import { CSSInjector } from "../src/manager/CSSInjector";
import type { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { sha256 } from "../src/manager/cssSnippetFile";
import { WebAutoUpdate } from "../src/manager/web/autoUpdate";
import type { WebFileMemory } from "../src/manager/web/fileMemory";
import {
	GARDEN_NOTE_PATH,
	GARDEN_NOTE_SLOT,
	PUBLISH_CSS,
	PUBLISH_JS,
	QUARTZ_NOTE_NAME,
	WEB_TARGET_IDS,
	type WebTargetId,
} from "../src/manager/web/targets";
import type { WebExportPlugin } from "../src/manager/web/webData";
import { exportWebTarget, webTargetStatus, type WebTargetStatus } from "../src/manager/web/writeTarget";
import { readGardenNoteBody, splitFrontmatter } from "../src/web/static/gardenNote";
import { definition } from "./support/cssInjectorHarness";
import { launchDevice, newWorld, usedWorld, type World } from "./support/launchWorld";
import { readingHarness } from "./support/readingHarness";
import { readRepoFile } from "./support/sourceScan";
import { webFileMemory } from "./support/webFileMemory";

installFakeDomParser();

/* --- A device, and the sync between two ------------------------------------ */

interface Device {
	app: App;
	plugin: WebExportPlugin;
	disk: Map<string, string>;
	/** Every path written, in order. */
	writes: string[];
	auto: WebAutoUpdate;
}

function appOver(disk: Map<string, string>, writes: string[]): App {
	const folders = new Set<string>();
	const hasProperty = (text: string): boolean => /^---\n[\s\S]*?^callout-studio-web:/m.test(text);
	return {
		vault: {
			configDir: ".obsidian",
			getMarkdownFiles: () => [...disk.keys()].filter((path) => path.endsWith(".md")).map((path) => ({ path })),
			adapter: {
				exists: (path: string): Promise<boolean> =>
					Promise.resolve(
						disk.has(path) ||
							folders.has(path) ||
							[...disk.keys()].some((file) => file.startsWith(`${path}/`)),
					),
				read: (path: string): Promise<string> => Promise.resolve(disk.get(path) ?? ""),
				write(path: string, data: string): Promise<void> {
					writes.push(path);
					disk.set(path, data);
					return Promise.resolve();
				},
				mkdir(path: string): Promise<void> {
					folders.add(path);
					return Promise.resolve();
				},
			},
		},
		metadataCache: {
			getFileCache: (file: { path: string }) =>
				hasProperty(disk.get(file.path) ?? "") ? { frontmatter: { "callout-studio-web": 1 } } : {},
		},
	} as unknown as App;
}

/** A device over `registry`, with its own disk and its own memory. */
function deviceWith(registry: CalloutRegistry, memory: WebFileMemory = webFileMemory(), held?: () => boolean): Device {
	const disk = new Map<string, string>();
	const writes: string[] = [];
	const app = appOver(disk, writes);
	const plugin: WebExportPlugin = { registry, cssInjector: new CSSInjector(app, registry), webFiles: memory };
	return { app, plugin, disk, writes, auto: new WebAutoUpdate(app, plugin, held ? { held } : {}) };
}

function device(setup: (registry: CalloutRegistry) => void = () => {}): Device {
	const { registry } = readingHarness();
	setup(registry);
	return deviceWith(registry);
}

/** The callouts of the device that set the site up: one of its own, and a built-in recoloured. */
const mine = (registry: CalloutRegistry): void => {
	registry.add(definition({ id: "recipe", displayName: "Recipe", colorLight: "#00aa55", colorDark: "#55ffaa" }));
	registry.update("tip", { colorLight: "#ff00ff" });
};

/** The sync service: every file of `from` reaches `to` as it is. */
function sync(from: Device, to: Device): void {
	for (const [path, text] of from.disk) to.disk.set(path, text);
}

const writeByHand = async (d: Device, targets: readonly WebTargetId[] = WEB_TARGET_IDS): Promise<void> => {
	for (const target of targets) {
		const outcome = await exportWebTarget(d.app, d.plugin, target, {
			confirmOverwrite: () => Promise.resolve(true),
		});
		assert.strictEqual(outcome.status, "written", target);
	}
};

/** One automatic refresh — what a start does, and a change once it has settled. The paths it rewrote. */
async function refresh(d: Device): Promise<string[]> {
	const before = d.writes.length;
	await d.auto.catchUp();
	return d.writes.slice(before);
}

const statuses = async (d: Device): Promise<WebTargetStatus[]> =>
	Promise.all(WEB_TARGET_IDS.map((target) => webTargetStatus(d.app, d.plugin, target)));

const all = (status: WebTargetStatus): WebTargetStatus[] => WEB_TARGET_IDS.map(() => status);

const snapshot = (d: Device): [string, string][] => [...d.disk].sort(([a], [b]) => (a < b ? -1 : 1));

/** The files a colour reaches: every stylesheet, and every file that carries one. */
const COLOUR_FILES = [PUBLISH_CSS, QUARTZ_NOTE_NAME, GARDEN_NOTE_PATH];

const recolour = (d: Device, colour: string): void => {
	d.plugin.registry.update("recipe", { colorLight: colour });
};

/** A stand-in for another build of the plugin: the same callouts, other bytes. */
function otherBuild(d: Device): Device {
	const injector = d.plugin.cssInjector as unknown as { generateWebTokenCSS(defs: unknown): string };
	const generate = injector.generateWebTokenCSS.bind(injector);
	injector.generateWebTokenCSS = (defs) => `${generate(defs)}\n/* another build */`;
	return d;
}

/* --- The case the design is for -------------------------------------------- */

describe("two devices with the same callouts and the same build", () => {
	it("the second writes nothing, and answers for the files from then on", async () => {
		const a = device(mine);
		const b = device(mine);
		await writeByHand(a);
		sync(a, b);
		assert.deepStrictEqual(await refresh(b), []);
		assert.deepStrictEqual(await statuses(b), all("current"));

		// The change is made on the second device, which never wrote by hand.
		recolour(b, "#123456");
		assert.deepStrictEqual(await refresh(b), COLOUR_FILES);
		sync(b, a);
		recolour(a, "#123456");
		assert.deepStrictEqual(await refresh(a), [], "the first finds it already there");
		assert.deepStrictEqual(await statuses(a), all("current"));
	});

	it("writes the same bytes itself when the settings arrive before the files", async () => {
		const a = device(mine);
		const b = device(mine);
		await writeByHand(a);
		sync(a, b);
		await refresh(b);

		recolour(a, "#123456");
		await refresh(a);
		// The settings reached the second device; the first's files have not yet.
		recolour(b, "#123456");
		assert.deepStrictEqual(await refresh(b), COLOUR_FILES);
		assert.deepStrictEqual(snapshot(b), snapshot(a), "what a sync service then finds is no change at all");
	});

	it("writes a change made here though an earlier file was still on its way at the start", async () => {
		const a = device(mine);
		const b = device(mine);
		await writeByHand(a);
		sync(a, b);
		await refresh(b);

		// The first device changes twice. The second has the settings of the
		// second change and, when it looks, only the files of the first.
		recolour(a, "#111111");
		await refresh(a);
		const first = new Map(a.disk);
		recolour(a, "#222222");
		await refresh(a);
		for (const [path, text] of first) b.disk.set(path, text);
		recolour(b, "#222222");
		assert.deepStrictEqual(await refresh(b), [], "neither its own nor what it would write: left alone");
		// Then the files arrive, which runs nothing, and a change is made here.
		sync(a, b);
		recolour(b, "#333333");
		assert.deepStrictEqual(await refresh(b), COLOUR_FILES);
	});
});

/* --- What used to put a site's files back ---------------------------------- */

describe("a device whose callouts are other callouts", () => {
	it("leaves the files alone at every start, and says whose they are", async () => {
		const a = device(mine);
		const b = device(); // the plugin as installed: its settings do not sync by default
		await writeByHand(a);
		sync(a, b);
		const written = snapshot(a);

		for (let start = 0; start < 3; start++) assert.deepStrictEqual(await refresh(b), [], `start ${start}`);
		assert.deepStrictEqual(snapshot(b), written);
		assert.deepStrictEqual(await statuses(b), all("elsewhere"));
		// A change made there does not reach them either: they are not its files.
		b.plugin.registry.update("tip", { colorLight: "#000001" });
		assert.deepStrictEqual(await refresh(b), []);
		assert.deepStrictEqual(snapshot(b), written);

		sync(b, a);
		assert.deepStrictEqual(await refresh(a), []);
		assert.deepStrictEqual(await statuses(a), all("current"));
	});

	it("takes them over when they are written from there by hand, and the first device then stands back", async () => {
		const a = device(mine);
		const b = device();
		await writeByHand(a);
		sync(a, b);
		await refresh(b);

		await writeByHand(b);
		assert.deepStrictEqual(await statuses(b), all("current"));
		const theirs = snapshot(b);
		sync(b, a);
		assert.deepStrictEqual(await statuses(a), all("elsewhere"));
		for (let start = 0; start < 3; start++) assert.deepStrictEqual(await refresh(a), [], `start ${start}`);
		assert.deepStrictEqual(snapshot(a), theirs, "no device puts its own back by itself");

		// And the second device keeps them current from now on.
		b.plugin.registry.update("tip", { colorLight: "#000001" });
		assert.deepStrictEqual(await refresh(b), COLOUR_FILES);
	});
});

describe("two builds of the plugin", () => {
	it("neither replaces the other's files, whichever starts", async () => {
		const a = device(mine);
		const b = otherBuild(device(mine));
		await writeByHand(a);
		sync(a, b);
		const written = snapshot(a);
		for (let round = 0; round < 3; round++) {
			assert.deepStrictEqual(await refresh(b), [], `the other build, round ${round}`);
			sync(b, a);
			assert.deepStrictEqual(await refresh(a), [], `the build that wrote them, round ${round}`);
			sync(a, b);
		}
		assert.deepStrictEqual(snapshot(b), written);
		// What the two agree on is not held against either: the types and the manifest.
		assert.deepStrictEqual(await statuses(b), all("elsewhere"));
	});

	it("leaves a change made on the other build to the device that answers for the files", async () => {
		const a = device(mine);
		const b = otherBuild(device(mine));
		await writeByHand(a);
		sync(a, b);
		await refresh(b);

		recolour(b, "#123456");
		assert.deepStrictEqual(await refresh(b), []);
		// The settings reach the device that wrote the files, and it writes.
		recolour(a, "#123456");
		assert.deepStrictEqual(await refresh(a), COLOUR_FILES);
		sync(a, b);
		assert.deepStrictEqual(await refresh(b), []);
	});

	it("an update of the plugin on the only device replaces what the older build wrote", async () => {
		const a = device(mine);
		await writeByHand(a);
		otherBuild(a);
		assert.deepStrictEqual(await refresh(a), COLOUR_FILES);
		assert.deepStrictEqual(await statuses(a), all("current"));
	});
});

/* --- Settings that arrive by sync: real launches --------------------------- */

interface Launched {
	d: Device;
	launched: ReturnType<typeof launchDevice>;
	/** How often the registry announced a change since the launch. */
	changes(): number;
}

/** One launch of the plugin over `world`, as a device with that world's own memory. */
async function launchOver(world: World, disk?: Map<string, string>): Promise<Launched> {
	const launched = launchDevice(world);
	const boot = await launched.boot();
	const writer = launched.host.settingsWriter;
	const d = deviceWith(launched.registry, launched.host.localState, () => writer.isFrozen);
	for (const [path, text] of disk ?? []) d.disk.set(path, text);
	await launched.layoutReady(boot);
	let changes = 0;
	launched.registry.onChange(() => changes++);
	return { d, launched, changes: () => changes };
}

/** A second device that starts from the first's `data.json`. */
const worldBeside = (world: World): World => ({ ...newWorld(), disk: world.disk });

describe("a device that starts with settings behind the files", () => {
	it("leaves the newer files alone, and agrees with them once its settings arrive", async () => {
		const worldB = await usedWorld("recipe");
		const worldA = worldBeside(worldB);
		const a = await launchOver(worldA);
		const b = await launchOver(worldB);
		await writeByHand(a.d);
		sync(a.d, b.d);
		assert.deepStrictEqual(await refresh(b.d), []);
		const bDisk = b.d.disk;
		b.launched.close();

		recolour(a.d, "#abcdef");
		await a.launched.host.saveSettings();
		assert.deepStrictEqual(await refresh(a.d), COLOUR_FILES);
		const newer = snapshot(a.d);

		// The second device starts: the files have arrived, `data.json` has not.
		const again = await launchOver(worldB, bDisk);
		sync(a.d, again.d);
		assert.deepStrictEqual(await refresh(again.d), []);
		assert.deepStrictEqual(snapshot(again.d), newer, "the previous callouts are not put back");

		// The settings arrive and are adopted. Nothing is announced by the
		// registry — which is why `main.ts` schedules a refresh on a repaint.
		worldB.disk = worldA.disk;
		const before = again.changes();
		await again.launched.returnToApp();
		assert.strictEqual(again.d.plugin.registry.get("recipe")?.colorLight, "#abcdef", "the settings were adopted");
		assert.strictEqual(again.changes(), before, "an adoption announces no registry change");
		assert.deepStrictEqual(await refresh(again.d), []);
		assert.deepStrictEqual(await statuses(again.d), all("current"));

		// It answers for them again: a change made here is written.
		recolour(again.d, "#fedcba");
		assert.deepStrictEqual(await refresh(again.d), COLOUR_FILES);
		a.launched.close();
		again.launched.close();
	});

	it("catches up at its next start with what it adopted while the files were its own", async () => {
		// The callout is changed on a device that does not hold the files —
		// Obsidian Sync carries no .js or .css unless asked. The device that
		// does hold them was closed, and remembers them across the restart.
		const world = await usedWorld("recipe");
		const phoneWorld = worldBeside(world);
		const phone = await launchOver(phoneWorld);
		const desk = await launchOver(world);
		await writeByHand(desk.d);
		const files = desk.d.disk;
		desk.launched.close();

		recolour(phone.d, "#abcdef");
		await phone.launched.host.saveSettings();
		assert.deepStrictEqual(await refresh(phone.d), [], "it holds none of the files");
		world.disk = phoneWorld.disk;

		const again = await launchOver(world, files);
		assert.deepStrictEqual(await refresh(again.d), COLOUR_FILES);
		assert.deepStrictEqual(await statuses(again.d), all("current"));
		phone.launched.close();
		again.launched.close();
	});

	it("is refreshed while running, by the repaint an adoption ends in", async () => {
		const world = await usedWorld("recipe");
		const phoneWorld = worldBeside(world);
		const phone = await launchOver(phoneWorld);
		const desk = await launchOver(world);
		await writeByHand(desk.d);

		recolour(phone.d, "#abcdef");
		await phone.launched.host.saveSettings();
		world.disk = phoneWorld.disk;
		const before = desk.changes();
		await desk.launched.returnToApp();
		assert.strictEqual(desk.changes(), before, "an adoption announces no registry change");
		assert.deepStrictEqual(await statuses(desk.d), all("stale"), "its own files, behind its new settings");
		// What `main.ts` does at the end of every adoption and restore.
		assert.deepStrictEqual(await refresh(desk.d), COLOUR_FILES);
		phone.launched.close();
		desk.launched.close();
	});

	it("main.ts schedules a refresh where an adoption repaints, never while saving is paused, with the device's own memory", () => {
		const main = readRepoFile("src/main.ts");
		const repaint = /\trefreshCallouts\(\): void \{([\s\S]*?)\n\t\}/.exec(main)?.[1] ?? "";
		assert.match(repaint, /this\.webAutoUpdate\?\.schedule\(\)/);
		assert.match(main, /new WebAutoUpdate\(this\.app, this, \{ held: \(\) => this\.settingsWriter\.isFrozen \}\)/);
		assert.match(main, /get webFiles\(\): DeviceLocalStore \{\s*return this\.localState;/);
		// Every way the registry is replaced after launch ends in that repaint.
		for (const file of ["src/manager/settingsAdopt.ts", "src/manager/settingsRecoveryService.ts"]) {
			assert.match(readRepoFile(file), /host\.refreshCallouts\(\)/, file);
		}
	});
});

describe("a device whose settings are not the user's", () => {
	it("writes nothing where the plugin started before any data.json arrived", async () => {
		const a = device(mine);
		await writeByHand(a);
		const b = await launchOver(newWorld(), a.disk);
		assert.ok(!b.d.plugin.registry.has("recipe"), "the plugin's defaults");
		assert.deepStrictEqual(await refresh(b.d), []);
		assert.deepStrictEqual(snapshot(b.d), snapshot(a));
		b.launched.close();
	});

	it("writes nothing while saving is paused, though the files are its own", async () => {
		const world = await usedWorld("recipe");
		const first = await launchOver(world);
		await writeByHand(first.d);
		const files = first.d.disk;
		const written = snapshot(first.d);
		first.launched.close();

		// The file cannot be read at this start and the device has no recovery
		// copy of it, so the registry holds the plugin's defaults: no `recipe`.
		const good = world.disk;
		world.disk = "{ not the settings";
		world.checkpoint = undefined;
		const b = await launchOver(world, files);
		assert.ok(b.launched.host.settingsWriter.isFrozen, "saving is paused");
		assert.ok(!b.d.plugin.registry.has("recipe"), "and the callouts in memory are not the user's");
		assert.deepStrictEqual(await refresh(b.d), []);
		assert.deepStrictEqual(snapshot(b.d), written);

		// Without the hold this device would have carried its defaults to the site.
		const unheld = new WebAutoUpdate(b.d.app, b.d.plugin);
		await unheld.catchUp();
		assert.notDeepStrictEqual(snapshot(b.d), written, "which is what the hold is for");
		world.disk = good;
		b.launched.close();
	});
});

/* --- The Digital Garden note ------------------------------------------------ */

const note = (d: Device, path = GARDEN_NOTE_PATH): string => d.disk.get(path) ?? "";
const noteData = (text: string): string | undefined => readGardenNoteBody(splitFrontmatter(text).body)?.json;
const gardenStatus = (d: Device): Promise<WebTargetStatus> => webTargetStatus(d.app, d.plugin, "garden");

/** `text` with a few lines of its data gone: what a text merge of two versions leaves. */
function damaged(text: string): string {
	const lines = text.split("\n");
	lines.splice(lines.findIndex((line) => line.startsWith("sha256:")) + 3, 2);
	return lines.join("\n");
}

describe("the Digital Garden note on two devices", () => {
	it("is repaired after a merge by a device that answers for it, and by no other", async () => {
		const a = device(mine);
		const b = device();
		await writeByHand(a, ["garden"]);
		const written = note(a);
		a.disk.set(GARDEN_NOTE_PATH, damaged(written));
		sync(a, b);

		assert.strictEqual(await gardenStatus(b), "edited");
		assert.deepStrictEqual(await refresh(b), [], "a device with other callouts cannot know they are the garden's");
		assert.strictEqual(await gardenStatus(a), "edited");
		assert.deepStrictEqual(await refresh(a), [GARDEN_NOTE_PATH]);
		assert.strictEqual(note(a), written);
	});

	it("is current where only the words around the data differ, and still follows the next change", async () => {
		const a = device(mine);
		await writeByHand(a, ["garden"]);
		// A formatter passed over the note, or another build has another wording.
		const reworded = note(a).replace("> [!question] What does this file contain?", "> [!question] What is this?");
		assert.notStrictEqual(reworded, note(a));
		a.disk.set(GARDEN_NOTE_PATH, reworded);
		assert.strictEqual(await gardenStatus(a), "current");
		assert.deepStrictEqual(await refresh(a), [], "the garden reads the same data: nothing to write");
		assert.strictEqual(note(a), reworded);

		recolour(a, "#123456");
		assert.deepStrictEqual(await refresh(a), [GARDEN_NOTE_PATH]);
		assert.ok(note(a).includes("> [!question] What does this file contain?"), "the body is ours again");
	});

	it("has its words replaced by the device that wrote them", async () => {
		const a = device(mine);
		await writeByHand(a, ["garden"]);
		const reworded = note(a).replace("> [!question] What does this file contain?", "> [!question] What is this?");
		a.disk.set(GARDEN_NOTE_PATH, reworded);
		// As after an update of the plugin: the words on disk are the ones this
		// device wrote, with a build that worded the note differently.
		a.plugin.webFiles?.setWebFile(GARDEN_NOTE_SLOT, await sha256(splitFrontmatter(reworded).body));
		assert.strictEqual(await gardenStatus(a), "stale");
		assert.deepStrictEqual(await refresh(a), [GARDEN_NOTE_PATH]);
		assert.strictEqual(await gardenStatus(a), "current");
	});

	it("keeps a sync service's copy of a renamed note current too, whichever a garden reads", async () => {
		const a = device(mine);
		await writeByHand(a, ["garden"]);
		const mineNow = "My callouts.md";
		const copy = "My callouts (Conflicted copy Phone 202611151200).md";
		a.disk.set(mineNow, note(a));
		a.disk.set(copy, note(a));
		a.disk.delete(GARDEN_NOTE_PATH);
		assert.ok(copy < mineNow, "the copy sorts first, so it is the one that counts here");

		recolour(a, "#123456");
		assert.deepStrictEqual((await refresh(a)).sort(), [copy, mineNow].sort());
		assert.strictEqual(note(a, mineNow), note(a, copy));
		assert.strictEqual(await gardenStatus(a), "current");
		assert.ok(!a.disk.has(GARDEN_NOTE_PATH), "and none is made at the usual path");

		// By hand as well.
		recolour(a, "#654321");
		await writeByHand(a, ["garden"]);
		assert.strictEqual(note(a, mineNow), note(a, copy));
		assert.ok(noteData(note(a, mineNow))?.includes("#654321"));
	});

	it("never touches a note that has the property and no data of ours", async () => {
		const a = device(mine);
		await writeByHand(a, ["garden"]);
		const theirs = "---\ncallout-studio-web: 1\n---\nA note of my own that borrowed the property.\n";
		a.disk.set("Archive/notes.md", theirs);
		recolour(a, "#123456");
		assert.deepStrictEqual(await refresh(a), [GARDEN_NOTE_PATH]);
		await writeByHand(a, ["garden"]);
		assert.strictEqual(a.disk.get("Archive/notes.md"), theirs);
	});
});

/* --- A device with no memory ------------------------------------------------ */

describe("a stand-in for the plugin that has no memory", () => {
	it("refreshes nothing by itself, writes by hand as ever, and calls its files out of date", async () => {
		const d = device(mine);
		delete d.plugin.webFiles;
		await writeByHand(d, ["quartz"]);
		recolour(d, "#123456");
		assert.deepStrictEqual(await refresh(d), []);
		assert.strictEqual(await webTargetStatus(d.app, d.plugin, "quartz"), "stale");
		await writeByHand(d, ["quartz"]);
		assert.strictEqual(await webTargetStatus(d.app, d.plugin, "quartz"), "current");
	});

	it("leaves publish.js alone where only the stylesheet has news", async () => {
		// Pins what COLOUR_FILES assumes: a colour is in the stylesheet, and
		// `publish.js` carries none.
		const a = device(mine);
		await writeByHand(a, ["publish"]);
		recolour(a, "#123456");
		assert.deepStrictEqual(await refresh(a), [PUBLISH_CSS]);
		assert.ok(!COLOUR_FILES.includes(PUBLISH_JS));
	});
});
