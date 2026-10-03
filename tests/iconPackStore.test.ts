/**
 * tests/iconPackStore.test.ts — PackDataStore, and the promise that makes
 * downloading four megabytes of third-party artwork defensible.
 *
 * The plugin knows each pack's exact byte count and SHA-256 before it asks for
 * anything (see packManifest.ts), and refuses whatever does not match. The part
 * that is easy to under-build is *where* that check runs: verifying on download
 * alone would be a check on the CDN, and the CDN is not the only thing between
 * the bytes and the renderer. A cached file can be truncated by a failed sync,
 * rewritten by a sync conflict, edited by hand, or dropped in deliberately —
 * `packPath()` is a documented install route for a machine with no network. So
 * the checksum is re-read from disk on **every** launch that loads a pack, and
 * that is what most of this file is about.
 *
 * The cost of getting it wrong is not a crash. `parsePackFile` would still
 * accept a file whose path data is well-formed, so a tampered pack renders —
 * silently, with whatever shapes it now contains, on every launch, forever.
 *
 * WHAT IS NOT COVERED. The download leg needs `requestUrl`, which the test
 * harness stubs as a rejection because tests must not touch the network; and
 * `fetchWithTimeout` reaches for `window`, which Node has not got. So the tests
 * below exercise the *disk* leg of `verify()` — the same method, the same
 * manifest, the same rejection — plus the request de-duplication around it, and
 * stop where the socket would begin.
 */
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { App, PluginManifest } from "obsidian";
import { PackDataStore } from "../src/icons/PackDataStore";
import { isPackLoaded, getPackData } from "../src/icons/packData";
import { PACK_MANIFEST } from "../src/icons/data/packManifest";
import type { IconPackId } from "../src/types";

const PACKS_DIR = join(process.cwd(), "packs");
const real = (id: IconPackId): string =>
	readFileSync(join(PACKS_DIR, `${id}.json`), "utf8");

/** Every path the store asked about, in order, so a test can see what it read. */
interface Harness {
	store: PackDataStore;
	files: Map<string, string>;
	existsCalls: string[];
	readCalls: string[];
	writes: Map<string, string>;
	/** Paths whose read must throw, standing in for an unreadable file. */
	unreadable: Set<string>;
	/** Paths whose deletion must throw, standing in for a locked file. */
	undeletable: Set<string>;
	removeCalls: string[];
	notifications: number;
}

function harness(): Harness {
	const files = new Map<string, string>();
	const writes = new Map<string, string>();
	const existsCalls: string[] = [];
	const readCalls: string[] = [];
	const unreadable = new Set<string>();
	const undeletable = new Set<string>();
	const removeCalls: string[] = [];
	const dirs = new Set<string>();

	const adapter = {
		exists(path: string): Promise<boolean> {
			existsCalls.push(path);
			return Promise.resolve(files.has(path) || dirs.has(path));
		},
		read(path: string): Promise<string> {
			readCalls.push(path);
			if (unreadable.has(path)) return Promise.reject(new Error("EIO"));
			const text = files.get(path);
			return text === undefined
				? Promise.reject(new Error("ENOENT"))
				: Promise.resolve(text);
		},
		write(path: string, text: string): Promise<void> {
			writes.set(path, text);
			return Promise.resolve();
		},
		mkdir(path: string): Promise<void> {
			dirs.add(path);
			return Promise.resolve();
		},
		remove(path: string): Promise<void> {
			removeCalls.push(path);
			if (undeletable.has(path)) return Promise.reject(new Error("EPERM"));
			files.delete(path);
			return Promise.resolve();
		},
	};

	const app = { vault: { adapter, configDir: ".obsidian" } } as unknown as App;
	const manifest = {
		id: "callout-studio",
		dir: ".obsidian/plugins/callout-studio",
	} as PluginManifest;

	const h: Harness = {
		store: new PackDataStore(app, manifest),
		files,
		existsCalls,
		readCalls,
		writes,
		unreadable,
		undeletable,
		removeCalls,
		notifications: 0,
	};
	h.store.onChange(() => {
		h.notifications++;
	});
	return h;
}

/** Put a pack file on the fake disk, optionally after damaging it. */
function place(
	h: Harness,
	id: IconPackId,
	damage?: (text: string) => string,
): void {
	const text = real(id);
	h.files.set(h.store.packPath(id), damage ? damage(text) : text);
}

/* ------------------------------------------------------------------ *
 * Where packs live
 * ------------------------------------------------------------------ */

describe("PackDataStore — where a pack file lives", () => {
	it("keeps packs inside the plugin's own folder, so uninstalling takes them", () => {
		const { store } = harness();
		assert.equal(
			store.packPath("octicons"),
			".obsidian/plugins/callout-studio/icon-packs/octicons.json",
		);
	});

	it("reconstructs the folder when the manifest does not state one", () => {
		// `manifest.dir` is typed optional, and a store that fell over there
		// would take every downloaded pack with it.
		const adapter = {
			exists: () => Promise.resolve(false),
			read: () => Promise.reject(new Error("ENOENT")),
			write: () => Promise.resolve(),
			mkdir: () => Promise.resolve(),
		};
		const app = { vault: { adapter, configDir: ".obsidian" } } as unknown as App;
		const store = new PackDataStore(app, { id: "callout-studio" } as PluginManifest);
		assert.equal(
			store.packPath("octicons"),
			".obsidian/plugins/callout-studio/icon-packs/octicons.json",
		);
	});

	it("reports what the picker shows before anything is downloaded", () => {
		const { store } = harness();
		assert.deepStrictEqual(store.info("octicons"), PACK_MANIFEST.octicons);
		// Material is fetched one icon at a time and has no pack file at all.
		assert.equal(store.info("material"), undefined);
	});
});

/* ------------------------------------------------------------------ *
 * Reading from disk
 * ------------------------------------------------------------------ */

describe("loadFromDisk — a pack that is not there", () => {
	it("reports `missing`, which is not an error", () => {
		const h = harness();
		return h.store.loadFromDisk("octicons").then((result) => {
			assert.equal(result, "missing");
			assert.equal(h.store.state("octicons"), "unavailable");
			assert.deepStrictEqual(h.readCalls, [], "nothing should have been read");
		});
	});

	it("reports `corrupt` when the file is there but cannot be read", () => {
		const h = harness();
		place(h, "octicons");
		h.unreadable.add(h.store.packPath("octicons"));
		return h.store.loadFromDisk("octicons").then((result) => {
			assert.equal(result, "corrupt");
			assert.equal(isPackLoaded("octicons"), false);
		});
	});
});

describe("loadFromDisk — an intact pack", () => {
	it("accepts the real file and makes its artwork available", async () => {
		const h = harness();
		place(h, "octicons");
		assert.equal(await h.store.loadFromDisk("octicons"), "ready");
		assert.equal(h.store.state("octicons"), "ready");
		assert.ok(isPackLoaded("octicons"));
		assert.equal(getPackData("octicons")?.pack, "octicons");
	});

	it("short-circuits once the pack is in memory", async () => {
		// A second launch-time sweep, or the picker opening, must not re-read and
		// re-hash 384 KB that is already parsed.
		const h = harness();
		assert.ok(isPackLoaded("octicons"), "the previous test loaded it");
		assert.equal(await h.store.loadFromDisk("octicons"), "ready");
		assert.deepStrictEqual(h.existsCalls, []);
		assert.deepStrictEqual(h.readCalls, []);
	});
});

describe("loadFromDisk — a file that is not the one this build expects", () => {
	it("refuses a file whose bytes were edited, even at the same length", () => {
		// The case a size check alone would wave through: same length, different
		// content. Only the digest can tell.
		const h = harness();
		place(h, "fa-regular", (text) =>
			// Swap one path command for another of equal width. Still legal path
			// data, so `parsePackFile` would happily accept the result.
			`${text.slice(0, text.length - 1)} `,
		);
		return h.store.loadFromDisk("fa-regular").then((result) => {
			assert.equal(result, "corrupt");
			assert.equal(isPackLoaded("fa-regular"), false, "nothing may be published");
			assert.equal(getPackData("fa-regular"), null);
		});
	});

	it("refuses a truncated file", () => {
		const h = harness();
		place(h, "fa-brands", (text) => text.slice(0, text.length - 10));
		return h.store.loadFromDisk("fa-brands").then((result) => {
			assert.equal(result, "corrupt");
			assert.equal(isPackLoaded("fa-brands"), false);
		});
	});

	it("refuses a file padded to the right length by something else", () => {
		const h = harness();
		const expected = PACK_MANIFEST["rpg-awesome"];
		assert.ok(expected);
		h.files.set(h.store.packPath("rpg-awesome"), "x".repeat(expected.bytes));
		return h.store.loadFromDisk("rpg-awesome").then((result) => {
			assert.equal(result, "corrupt");
			assert.equal(isPackLoaded("rpg-awesome"), false);
		});
	});

	it("refuses one pack's file dropped in under another pack's name", () => {
		// The hand-install route is real (`packPath` is documented for it), so a
		// copy-paste slip is a real way to get here. Caught by the checksum long
		// before `parsePackFile` gets to disagree about `pack`.
		const h = harness();
		h.files.set(h.store.packPath("tabler-filled"), real("tabler-outline"));
		return h.store.loadFromDisk("tabler-filled").then((result) => {
			assert.equal(result, "corrupt");
			assert.equal(isPackLoaded("tabler-filled"), false);
		});
	});

	it("leaves a rejected pack unavailable rather than failed", () => {
		// `failed` means a download gave up, which the settings list paints as a
		// permanent error. A bad file on disk is still recoverable by fetching.
		const h = harness();
		assert.equal(h.store.state("fa-regular"), "unavailable");
	});
});

/* ------------------------------------------------------------------ *
 * Which packs get read at all
 * ------------------------------------------------------------------ */

describe("loadUsed — only what the vault actually references", () => {
	it("reads the packs it is given and no others", async () => {
		const h = harness();
		place(h, "fa-solid");
		await h.store.loadUsed(["fa-solid"]);
		assert.deepStrictEqual(h.readCalls, [h.store.packPath("fa-solid")]);
		assert.ok(isPackLoaded("fa-solid"));
	});

	it("ignores libraries that have no pack file to read", async () => {
		// Lucide ships inside Obsidian, emoji is a glyph, `image` is the user's
		// own — none of the three has a file, and asking about one would be a
		// pointless disk hit on every launch.
		const h = harness();
		await h.store.loadUsed(["lucide", "emoji", "image", "material"]);
		assert.deepStrictEqual(h.existsCalls, []);
	});

	it("asks about a pack once however many icons use it", async () => {
		const h = harness();
		await h.store.loadUsed(["octicons", "octicons", "octicons"]);
		assert.ok(h.existsCalls.length <= 1);
	});

	it("reports per pack, so the caller can say which file was damaged", async () => {
		const h = harness();
		place(h, "tabler-outline");
		place(h, "tabler-filled", (text) => text.slice(1));
		const results = await h.store.loadUsed(["tabler-outline", "tabler-filled"]);
		assert.equal(results.get("tabler-outline"), "ready");
		assert.equal(results.get("tabler-filled"), "corrupt");
	});

	it("announces once for the whole sweep", async () => {
		const h = harness();
		const before = h.notifications;
		await h.store.loadUsed(["octicons", "fa-solid"]);
		assert.equal(h.notifications, before + 1);
	});
});

describe("loadAllFromDisk — what the picker needs to know", () => {
	it("looks at every downloadable pack still unaccounted for", async () => {
		// `loadUsed` only warms packs a callout references, so one downloaded in
		// an earlier session but never assigned still reads as unavailable — and
		// the picker would offer to download it again.
		const h = harness();
		await h.store.loadAllFromDisk();
		const asked = new Set(h.existsCalls);
		for (const id of Object.keys(PACK_MANIFEST) as IconPackId[]) {
			if (h.store.state(id) === "ready") continue;
			assert.ok(asked.has(h.store.packPath(id)), `never looked for ${id}`);
		}
	});

	it("does not look again at a pack already in memory", async () => {
		const h = harness();
		await h.store.loadAllFromDisk();
		assert.ok(
			!h.existsCalls.includes(h.store.packPath("octicons")),
			"octicons is already loaded",
		);
	});
});

/* ------------------------------------------------------------------ *
 * Downloading
 * ------------------------------------------------------------------ */

describe("download — one request per pack", () => {
	it("hands concurrent callers the very same promise", () => {
		// Two picker panels, or a picker and a startup repair, must not fetch the
		// same megabyte twice. The de-duplication is promise identity, not a
		// second request that happens to be discarded.
		const h = harness();
		assert.equal(isPackLoaded("rpg-awesome"), false);
		const first = h.store.download("rpg-awesome");
		const second = h.store.download("rpg-awesome");
		assert.strictEqual(first, second);
		return Promise.all([first, second]).then(([a, b]) => {
			// No network in tests, so both resolve to "not available".
			assert.equal(a, false);
			assert.equal(b, false);
			assert.equal(h.store.state("rpg-awesome"), "failed");
		});
	});

	it("lets the next attempt start fresh once the first has settled", async () => {
		const h = harness();
		const first = h.store.download("rpg-awesome");
		await first;
		assert.notStrictEqual(h.store.download("rpg-awesome"), first);
	});

	it("asks for nothing when the pack is already in memory", async () => {
		const h = harness();
		assert.ok(isPackLoaded("octicons"));
		assert.equal(await h.store.download("octicons"), true);
	});

	it("refuses to fetch a pack the build has no checksum for", async () => {
		// Without a manifest entry there is nothing to verify against, so there
		// is no safe way to accept a response at all.
		const h = harness();
		assert.equal(await h.store.download("material"), false);
	});
});

describe("listeners", () => {
	it("can be unsubscribed", async () => {
		const h = harness();
		let seen = 0;
		const off = h.store.onChange(() => {
			seen++;
		});
		await h.store.loadUsed(["octicons"]);
		assert.equal(seen, 1);
		off();
		await h.store.loadUsed(["octicons"]);
		assert.equal(seen, 1);
	});

	it("keeps going when one listener throws", async () => {
		// A repaint that fails must not stop the pack from being published to
		// every other surface waiting on it.
		const h = harness();
		let reached = false;
		h.store.onChange(() => {
			throw new Error("boom");
		});
		h.store.onChange(() => {
			reached = true;
		});
		await h.store.loadUsed(["octicons"]);
		assert.ok(reached);
	});
});

/* ------------------------------------------------------------------ *
 * Deleting a pack — the Icon libraries window's Delete
 * ------------------------------------------------------------------ */

// Simple Icons, because no other suite in this file touches it: the store of
// loaded artwork is module-level, so what one test unloads, the next one sees.
describe("remove — deleting a downloaded pack", () => {
	it("deletes the file, forgets the artwork, and says so", async () => {
		const h = harness();
		place(h, "simple-icons");
		assert.equal(await h.store.loadFromDisk("simple-icons"), "ready");
		const before = h.notifications;

		assert.equal(await h.store.remove("simple-icons"), true);
		assert.deepStrictEqual(h.removeCalls, [h.store.packPath("simple-icons")]);
		assert.equal(h.files.has(h.store.packPath("simple-icons")), false);
		assert.equal(isPackLoaded("simple-icons"), false, "the artwork must leave memory with the file");
		assert.equal(h.store.state("simple-icons"), "unavailable");
		assert.equal(h.notifications, before + 1);
	});

	it("succeeds when there was no file to delete, and leaves nothing loaded", async () => {
		// A pack held for the session only — its disk write failed — has no file,
		// and deleting it still has to take it out of the picker.
		const h = harness();
		assert.equal(await h.store.remove("simple-icons"), true);
		assert.deepStrictEqual(h.removeCalls, [], "nothing was there to delete");
		assert.equal(h.store.state("simple-icons"), "unavailable");
	});

	it("keeps the pack when the file cannot be deleted", async () => {
		const h = harness();
		place(h, "simple-icons");
		assert.equal(await h.store.loadFromDisk("simple-icons"), "ready");
		h.undeletable.add(h.store.packPath("simple-icons"));

		assert.equal(await h.store.remove("simple-icons"), false);
		assert.ok(isPackLoaded("simple-icons"), "a file still on disk is still a downloaded pack");
		assert.equal(h.store.state("simple-icons"), "ready");
	});

	it("refuses while the same pack is still downloading", async () => {
		// The download would write the file straight back afterwards.
		const h = harness();
		// The previous test left the pack loaded, and a loaded pack downloads
		// nothing at all; delete it first so the download really starts.
		place(h, "simple-icons");
		assert.equal(await h.store.remove("simple-icons"), true);
		const pending = h.store.download("simple-icons");
		assert.equal(await h.store.remove("simple-icons"), false);
		await pending;
	});

	it("does nothing once the store has been destroyed", async () => {
		const h = harness();
		place(h, "simple-icons");
		h.store.destroy();
		assert.equal(await h.store.remove("simple-icons"), false);
		assert.deepStrictEqual(h.removeCalls, []);
	});
});
