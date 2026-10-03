/**
 * tests/iconLibraryDeletion.test.ts — deleting a downloaded icon library from
 * the Icon libraries window, and what it must not cost the callouts using it.
 *
 * The promise the window makes is "they keep their icons", and it rests on the
 * copy of every drawing in `data.json`. `IconService.deleteLibrary` therefore
 * copies what the callouts need out of the still-loaded pack *before* deleting
 * a file: without the copy, a callout would go blank here and on every synced
 * device, and the next launch's repair would download the library straight
 * back — undoing the deletion without anyone pressing anything.
 *
 * The second half is the guard in `fetchArtwork`: confirming an icon whose
 * drawings are all saved must not download its library either, or simply
 * re-confirming a callout's own icon in the picker would bring a deleted
 * library back.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { App, PluginManifest } from "obsidian";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import type { CSSInjector } from "../src/manager/CSSInjector";
import { IconService } from "../src/icons/IconService";
import { isPackLoaded } from "../src/icons/packData";
import type { CalloutDefinition, IconPackId } from "../src/types";

const realPackText = (id: IconPackId): string =>
	readFileSync(join(process.cwd(), "packs", `${id}.json`), "utf8");

function callout(id: string, over: Partial<CalloutDefinition> = {}): CalloutDefinition {
	return {
		id,
		displayName: id,
		icon: { type: "lucide", value: "star" },
		colorLight: "#3b82f6",
		colorDark: "#3b82f6",
		foldable: true,
		defaultFolded: false,
		builtIn: false,
		source: "user",
		...over,
	};
}

interface Harness {
	service: IconService;
	registry: CalloutRegistry;
	files: Map<string, string>;
	/** Every path the store asked about. */
	looked: string[];
	removed: string[];
	saves: number;
	injects: number;
}

function harness(): Harness {
	const registry = new CalloutRegistry();
	registry.load(null);
	const h: Harness = {
		service: undefined as unknown as IconService,
		registry,
		files: new Map(),
		looked: [],
		removed: [],
		saves: 0,
		injects: 0,
	};
	const adapter = {
		exists: (path: string) => {
			h.looked.push(path);
			return Promise.resolve(h.files.has(path));
		},
		read: (path: string) => {
			const text = h.files.get(path);
			return text === undefined ? Promise.reject(new Error("ENOENT")) : Promise.resolve(text);
		},
		write: () => Promise.resolve(),
		mkdir: () => Promise.resolve(),
		remove: (path: string) => {
			h.removed.push(path);
			h.files.delete(path);
			return Promise.resolve();
		},
	};
	h.service = new IconService({
		app: { vault: { adapter, configDir: ".obsidian" } } as unknown as App,
		manifest: { id: "callout-studio", dir: "plugins/cs" } as PluginManifest,
		registry,
		cssInjector: { inject: () => { h.injects++; } } as unknown as CSSInjector,
		saveSettings: () => {
			h.saves++;
			return Promise.resolve();
		},
	});
	return h;
}

/** Put a library's files on the fake disk and load them, as a download would have. */
async function downloaded(h: Harness, ...ids: IconPackId[]): Promise<void> {
	for (const id of ids) {
		h.files.set(h.service.packs.packPath(id), realPackText(id));
		assert.equal(await h.service.packs.loadFromDisk(id), "ready");
	}
}

describe("IconService.deleteLibrary — the callouts keep their icons", () => {
	it("saves every drawing its callouts need before the file goes", async () => {
		const h = harness();
		await downloaded(h, "octicons");
		h.registry.add(callout("alerts", { icon: { type: "octicons", value: "alert" } }));
		// Icon turned off: still stored, and back the moment it is turned on.
		h.registry.add(callout("bells", { icon: { type: "octicons", value: "bell" }, hideIcon: true }));
		assert.equal(h.registry.findIconSvg("octicons", "alert", "16"), undefined, "nothing copied yet");

		assert.equal(await h.service.deleteLibrary("octicons"), true);

		// Octicons draws small surfaces from its 16px art and large ones from
		// its 24px art: both have to survive the file.
		for (const name of ["alert", "bell"]) {
			assert.ok(h.registry.findIconSvg("octicons", name, "16"), `${name} at 16px`);
			assert.ok(h.registry.findIconSvg("octicons", name, "24"), `${name} at 24px`);
		}
		assert.equal(h.saves, 1, "the copy is saved once, before the deletion");
		assert.equal(h.injects, 1);
		assert.deepEqual(h.removed, [h.service.packs.packPath("octicons")]);
		assert.equal(isPackLoaded("octicons"), false);
		assert.equal(h.service.packs.state("octicons"), "unavailable");
		const svg = h.service.resolveSvg({ type: "octicons", value: "alert" }, "inline");
		assert.ok(svg?.includes("<path"), "the callout still draws from data.json");
	});

	it("writes nothing when every drawing was saved already", async () => {
		// The usual case: confirming the icon in the picker made the copy.
		const h = harness();
		await downloaded(h, "octicons");
		h.registry.add(callout("alerts", { icon: { type: "octicons", value: "alert" } }));
		await h.service.ensureArtworkFor([{ type: "octicons", value: "alert" }]);
		const saves = h.saves;

		assert.equal(await h.service.deleteLibrary("octicons"), true);
		assert.equal(h.saves, saves);
		assert.deepEqual(h.removed, [h.service.packs.packPath("octicons")]);
	});

	it("deletes every file of a library made of several", async () => {
		const h = harness();
		await downloaded(h, "fa-solid", "fa-regular", "fa-brands");
		h.registry.add(callout("repo", { icon: { type: "fa-brands", value: "github" } }));

		assert.equal(await h.service.deleteLibrary("fa"), true);
		assert.ok(h.registry.findIconSvg("fa-brands", "github", ""));
		assert.deepEqual(h.removed, ["fa-solid", "fa-regular", "fa-brands"].map(
			(id) => h.service.packs.packPath(id as IconPackId)));
		for (const id of ["fa-solid", "fa-regular", "fa-brands"] as const) {
			assert.equal(isPackLoaded(id), false, id);
		}
	});

	it("does not read the callout editor's draft out of the registry on its own", async () => {
		// The registry's preview slot holds a half-typed callout under a
		// placeholder id; it is a rendering aid, not a record of what the person
		// chose. The editor says what it holds by handing the icon in (next test).
		const h = harness();
		await downloaded(h, "octicons");
		h.registry.setPreviewDefinition(callout("draft", { icon: { type: "octicons", value: "rocket" } }));
		assert.deepEqual(h.registry.getCommitted().filter((def) => def.id === "draft"), []);

		assert.equal(await h.service.deleteLibrary("octicons"), true);
		assert.equal(h.registry.findIconSvg("octicons", "rocket", "16"), undefined);
		h.registry.setPreviewDefinition(null);
	});

	it("also keeps the drawings of an icon the callout editor holds but has not saved", async () => {
		// Download a library, pick one of its icons in the editor, delete the
		// library before saving the callout: Save must still find the drawing in
		// `data.json`, or it would download the library straight back.
		const h = harness();
		await downloaded(h, "octicons");
		const unsaved = { type: "octicons" as const, value: "rocket" };

		assert.equal(await h.service.deleteLibrary("octicons", [unsaved]), true);

		assert.ok(h.registry.findIconSvg("octicons", "rocket", "16"), "rocket at 16px");
		assert.ok(h.registry.findIconSvg("octicons", "rocket", "24"), "rocket at 24px");
		assert.equal(h.saves, 1, "saved once, before the file went");
		assert.deepEqual(h.removed, [h.service.packs.packPath("octicons")]);
		assert.ok(h.service.resolveSvg(unsaved, "inline")?.includes("<path"), "it still draws");
	});

	it("keeps an unsaved icon alongside the saved callouts' and writes nothing extra", async () => {
		const h = harness();
		await downloaded(h, "octicons");
		h.registry.add(callout("alerts", { icon: { type: "octicons", value: "alert" } }));

		assert.equal(await h.service.deleteLibrary("octicons", [{ type: "octicons", value: "rocket" }]), true);

		assert.ok(h.registry.findIconSvg("octicons", "alert", "16"));
		assert.ok(h.registry.findIconSvg("octicons", "rocket", "16"));
		assert.equal(h.saves, 1, "one write covers both");
	});

	it("leaves an unsaved icon from another library alone", async () => {
		const h = harness();
		await downloaded(h, "octicons", "rpg-awesome");

		assert.equal(await h.service.deleteLibrary("octicons", [{ type: "rpg-awesome", value: "dragon" }]), true);

		assert.equal(h.registry.findIconSvg("rpg-awesome", "dragon", ""), undefined);
		assert.equal(h.saves, 0);
		assert.equal(h.service.packs.state("rpg-awesome"), "ready", "the other library stays");
	});

	it("skips an unsaved icon whose drawings are already saved", async () => {
		// The usual case: Confirm in the picker made the copy.
		const h = harness();
		await downloaded(h, "octicons");
		await h.service.ensureArtworkFor([{ type: "octicons", value: "rocket" }]);
		const saves = h.saves;

		assert.equal(await h.service.deleteLibrary("octicons", [{ type: "octicons", value: "rocket" }]), true);
		assert.equal(h.saves, saves);
	});

	it("refuses a library that ships with the plugin: there is no file to delete", async () => {
		const h = harness();
		assert.equal(await h.service.deleteLibrary("lucide"), false);
		assert.equal(await h.service.deleteLibrary("material"), false);
		assert.deepEqual(h.removed, []);
		assert.equal(h.saves, 0);
	});
});

describe("IconService.ensureArtwork — a saved icon needs no library", () => {
	it("downloads nothing for an icon whose every drawing is already saved", async () => {
		// Confirming a callout's own icon in the picker, after its library was
		// deleted on this device, must not bring the library back.
		const h = harness();
		await downloaded(h, "octicons");
		h.registry.add(callout("alerts", { icon: { type: "octicons", value: "alert" } }));
		assert.equal(await h.service.deleteLibrary("octicons"), true);
		const looked = h.looked.length;
		const saves = h.saves;

		await h.service.ensureArtwork({ type: "octicons", value: "alert" });
		assert.equal(h.looked.length, looked, "the disk was not even asked");
		assert.equal(h.saves, saves);
		assert.equal(h.service.packs.state("octicons"), "unavailable");
	});

	it("still fetches an icon that has no saved drawing", async () => {
		// The guard is for saved icons only: a new pick from a library that is
		// on disk is copied in as before.
		const h = harness();
		h.files.set(h.service.packs.packPath("octicons"), realPackText("octicons"));
		await h.service.ensureArtwork({ type: "octicons", value: "flame" });
		assert.ok(h.registry.findIconSvg("octicons", "flame", "16"));
		assert.ok(h.looked.includes(h.service.packs.packPath("octicons")));
	});
});
