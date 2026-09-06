/**
 * tests/iconArtwork.test.ts — how a drawing gets found, kept, and repaired.
 *
 * Four pieces of one story, in the order a drawing meets them.
 *
 * **The resolver** answers "what markup should I paint?" from whatever is local,
 * and its resolution order is load-bearing: the copy in `data.json` first, then
 * whatever the pack can build. The `data.json` copy is the one that *syncs*, so
 * a device that never downloaded a pack still renders the icons the vault
 * actually uses — and a device that has both must prefer the synced copy, or
 * two machines showing one vault can draw the same callout differently.
 *
 * **`ensureArtworkFor` is the only repair path.** An import and a startup both
 * arrive with icons whose artwork this device may not have, and both come as a
 * *set*. Handling them one at a time would download Font Awesome Brands once per
 * Brands icon; skipping nothing would re-download packs a synced `data.json`
 * already made unnecessary. Both are tested here by what they cost, not by what
 * they return.
 *
 * **`cleanupUnusedIconSvgs`** is the counterweight — `data.json` is rewritten on
 * every save, so artwork nothing references cannot be allowed to accumulate.
 * Two things it must not drop: the other render roles' drawings (a pack can draw
 * one icon differently per surface), and the icon of a callout with `hideIcon`
 * set — which is precisely the artwork that makes turning the icon back on
 * instant and offline.
 *
 * **`IconFetchManager`** is Material's per-icon route. Note the shape of its
 * offline behaviour: the startup sweep takes one attempt per icon and records
 * the failure *in memory only*, so a vault that was merely offline gets a clean
 * chance on the next launch rather than a permanent error.
 *
 * `cacheOne` de-duplicates concurrent callers the way `PackDataStore` does for
 * a whole pack, and is tested the same way: by promise identity, which is the
 * only evidence that the second caller joined the first request rather than
 * starting a second one that happens to fetch the same bytes.
 */
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { App, PluginManifest } from "obsidian";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import type { CSSInjector } from "../src/manager/CSSInjector";
import { IconService } from "../src/icons/IconService";
import { IconFetchManager } from "../src/icons/IconFetchManager";
import { createIconResolver, createStatusIconResolver } from "../src/icons/resolver";
import type { IconSvgLookup } from "../src/icons/resolver";
import { parsePackFile, setPackData } from "../src/icons/packData";
import { PACK_FORMAT } from "../src/icons/data/packManifest";
import { iconCacheKey } from "../src/icons/registry";
import type {
	CalloutDefinition,
	CalloutIcon,
	CalloutRenderRole,
	IconPackId,
} from "../src/types";
import { CALLOUT_RENDER_ROLES } from "../src/types";

const PACKS_DIR = join(process.cwd(), "packs");

/** The committed pack file, verbatim — checksum and all, as a device would hold it. */
const realPackText = (id: IconPackId): string =>
	readFileSync(join(PACKS_DIR, `${id}.json`), "utf8");

/** Load a real pack into the module-level store, as a download would. */
function loadRealPack(id: IconPackId): void {
	const result = parsePackFile(
		JSON.parse(realPackText(id)),
		id,
		PACK_FORMAT,
	);
	assert.ok(result.ok, `packs/${id}.json did not parse`);
	setPackData(id, result.file);
}

// `packData`'s store is module-level and has no eviction, so which packs are
// loaded is a property of this whole file rather than of one test. Octicons and
// both Tabler styles start out "already downloaded"; the Font Awesome files are
// handed to individual tests through the fake disk; and `rpg-awesome` is never
// made available anywhere, which is what gives the "cannot be got at all"
// branches something honest to answer for.
loadRealPack("octicons");
loadRealPack("tabler-outline");
loadRealPack("tabler-filled");

function definition(over: Partial<CalloutDefinition> = {}): CalloutDefinition {
	return {
		id: "sample",
		displayName: "Sample",
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

function registry(): CalloutRegistry {
	const reg = new CalloutRegistry();
	// `load(null)` is what seeds the live map with the 13 shipped callouts,
	// exactly as a first run does.
	reg.load(null);
	return reg;
}

/* ------------------------------------------------------------------ *
 * createIconResolver
 * ------------------------------------------------------------------ */

describe("createIconResolver — resolution order", () => {
	const lookup = (entries: Record<string, string>): IconSvgLookup => ({
		findIconSvg(pack, name, variant) {
			const svg = entries[iconCacheKey(pack, name, variant)];
			return svg === undefined ? undefined : { svg };
		},
	});

	it("prefers the copy in data.json over anything the pack could build", () => {
		// The synced copy wins on purpose: it is the one two devices share, so a
		// machine that also has the pack must not draw something different.
		const resolver = createIconResolver(
			lookup({ [iconCacheKey("octicons", "alert", "24")]: "<svg id='synced'/>" }),
		);
		assert.equal(
			resolver.resolveSvg({ type: "octicons", value: "alert" }, "regular"),
			"<svg id='synced'/>",
		);
	});

	it("falls back to the pack when data.json has no copy", () => {
		const resolver = createIconResolver(lookup({}));
		const svg = resolver.resolveSvg({ type: "octicons", value: "alert" }, "regular");
		assert.ok(svg?.includes(`viewBox="0 0 24 24"`), String(svg).slice(0, 80));
	});

	it("returns null when neither has it", () => {
		const resolver = createIconResolver(lookup({}));
		assert.equal(
			resolver.resolveSvg({ type: "octicons", value: "no-such-icon" }, "regular"),
			null,
		);
		// Font Awesome is not loaded in this file — the "pack not downloaded yet"
		// case, which the renderer paints as a placeholder.
		assert.equal(
			resolver.resolveSvg({ type: "fa-solid", value: "star" }, "regular"),
			null,
		);
	});

	it("returns null for a library this build does not know", () => {
		const resolver = createIconResolver(lookup({}));
		assert.equal(
			resolver.resolveSvg({ type: "future" as IconPackId, value: "x" }, "regular"),
			null,
		);
	});

	it("looks the cache up under the icon's own type, not its source", () => {
		// One source can own several bodies of artwork, and each keeps its own
		// entry — a Brands drawing must never be served for a Solid icon.
		const resolver = createIconResolver(
			lookup({ [iconCacheKey("fa-brands", "star", "")]: "<svg id='brands'/>" }),
		);
		assert.equal(
			resolver.resolveSvg({ type: "fa-brands", value: "star" }, "regular"),
			"<svg id='brands'/>",
		);
		assert.equal(
			resolver.resolveSvg({ type: "fa-solid", value: "star" }, "regular"),
			null,
		);
	});

	it("asks a different cache entry per surface where the pack draws per surface", () => {
		const resolver = createIconResolver(
			lookup({
				[iconCacheKey("octicons", "alert", "16")]: "<svg id='small'/>",
				[iconCacheKey("octicons", "alert", "24")]: "<svg id='large'/>",
			}),
		);
		const alert: CalloutIcon = { type: "octicons", value: "alert" };
		assert.equal(resolver.resolveSvg(alert, "inline"), "<svg id='small'/>");
		assert.equal(resolver.resolveSvg(alert, "regular"), "<svg id='large'/>");
		assert.equal(resolver.resolveSvg(alert, "heading"), "<svg id='large'/>");
	});

	it("memoizes the plain resolver, which the repaint sweep asks for per token", () => {
		const shared = lookup({});
		assert.strictEqual(createIconResolver(shared), createIconResolver(shared));
		assert.notStrictEqual(createIconResolver(shared), createIconResolver(lookup({})));
	});

	it("does not memoize a failure-aware resolver onto the plain one", () => {
		// They answer `hasFailed` differently, so handing one out for the other
		// would make the settings list spin forever or show a phantom error.
		const shared = lookup({});
		const aware = createIconResolver(shared, () => true);
		assert.notStrictEqual(aware, createIconResolver(shared));
		assert.equal(createIconResolver(shared).hasFailed({ type: "lucide", value: "x" }, "regular"), false);
	});
});

describe("createIconResolver — failure state", () => {
	const lookup: IconSvgLookup = { findIconSvg: () => undefined };

	it("reports no failure when the caller has no failure state to show", () => {
		// Most surfaces paint a placeholder either way; only the settings list
		// and the editor preview tell "still downloading" from "gave up".
		const resolver = createIconResolver(lookup);
		assert.equal(resolver.hasFailed({ type: "material", value: "home" }, "regular"), false);
	});

	it("passes the icon and the role through to the caller's predicate", () => {
		const seen: Array<[string, CalloutRenderRole]> = [];
		const resolver = createIconResolver(lookup, (icon, role) => {
			seen.push([icon.value, role]);
			return icon.value === "broken";
		});
		assert.equal(resolver.hasFailed({ type: "material", value: "broken" }, "inline"), true);
		assert.equal(resolver.hasFailed({ type: "material", value: "fine" }, "regular"), false);
		assert.deepStrictEqual(seen, [
			["broken", "inline"],
			["fine", "regular"],
		]);
	});

	it("wires createStatusIconResolver to the host's own answer", () => {
		let asked = 0;
		const resolver = createStatusIconResolver({
			registry: lookup,
			hasIconFetchFailed: () => {
				asked++;
				return true;
			},
		});
		assert.equal(resolver.hasFailed({ type: "material", value: "home" }, "regular"), true);
		assert.equal(asked, 1);
	});
});

/* ------------------------------------------------------------------ *
 * cleanupUnusedIconSvgs
 * ------------------------------------------------------------------ */

describe("cleanupUnusedIconSvgs", () => {
	const seed = (reg: CalloutRegistry, pack: IconPackId, name: string, variant: string) => {
		reg.addIconSvg({ pack, name, variant, svg: `<svg id='${name}-${variant}'/>` });
	};

	it("keeps artwork a callout still points at", () => {
		const reg = registry();
		reg.add(definition({ id: "kept", icon: { type: "octicons", value: "alert" } }));
		seed(reg, "octicons", "alert", "24");
		reg.cleanupUnusedIconSvgs();
		assert.ok(reg.findIconSvg("octicons", "alert", "24"));
	});

	it("drops artwork nothing points at any more", () => {
		const reg = registry();
		seed(reg, "octicons", "orphan", "24");
		reg.cleanupUnusedIconSvgs();
		assert.equal(reg.findIconSvg("octicons", "orphan", "24"), undefined);
	});

	it("keeps EVERY render role's drawing, not only the block callout's", () => {
		// Octicons draws `alert` at 16 and at 24, and inline callouts render from
		// the 16. A sweep that collected one variant would evict the other on
		// every save, and the inline copies would silently stop drawing.
		const reg = registry();
		reg.add(definition({ id: "roles", icon: { type: "octicons", value: "alert" } }));
		seed(reg, "octicons", "alert", "16");
		seed(reg, "octicons", "alert", "24");
		reg.cleanupUnusedIconSvgs();
		assert.ok(reg.findIconSvg("octicons", "alert", "16"), "the inline drawing went");
		assert.ok(reg.findIconSvg("octicons", "alert", "24"), "the block drawing went");
	});

	it("KEEPS the artwork of a callout whose icon is hidden", () => {
		// `hideIcon` is a display flag, not an icon: `icon` still holds the last
		// drawing, and that is what makes turning the icon back on instant and
		// offline. Counting a hidden icon as unused would mean re-downloading a
		// pack to undo a checkbox.
		const reg = registry();
		reg.add(
			definition({
				id: "quiet",
				hideIcon: true,
				icon: { type: "octicons", value: "alert" },
			}),
		);
		seed(reg, "octicons", "alert", "16");
		seed(reg, "octicons", "alert", "24");
		reg.cleanupUnusedIconSvgs();
		assert.ok(reg.findIconSvg("octicons", "alert", "24"));
		assert.ok(reg.findIconSvg("octicons", "alert", "16"));
	});

	it("drops artwork whose library this build no longer knows", () => {
		// `packFor` cannot produce a cache key for it, so there is no way to say
		// it is in use — and no way to render it either.
		const reg = registry();
		reg.add(definition({ id: "future", icon: { type: "future" as IconPackId, value: "x" } }));
		seed(reg, "future" as IconPackId, "x", "");
		reg.cleanupUnusedIconSvgs();
		assert.equal(reg.findIconSvg("future" as IconPackId, "x", ""), undefined);
	});

	it("keeps a built-in's artwork, which is in the map whether saved or not", () => {
		const reg = registry();
		const note = reg.get("note");
		assert.ok(note);
		reg.update("note", { icon: { type: "octicons", value: "alert" } });
		seed(reg, "octicons", "alert", "24");
		reg.cleanupUnusedIconSvgs();
		assert.ok(reg.findIconSvg("octicons", "alert", "24"));
	});

	it("keeps one entry per drawing when two callouts share an icon", () => {
		const reg = registry();
		reg.add(definition({ id: "a", icon: { type: "octicons", value: "alert" } }));
		reg.add(definition({ id: "b", icon: { type: "octicons", value: "alert" } }));
		seed(reg, "octicons", "alert", "24");
		reg.cleanupUnusedIconSvgs();
		assert.equal(
			reg.iconSvgCache.filter((e) => e.name === "alert" && e.variant === "24").length,
			1,
		);
	});
});

/* ------------------------------------------------------------------ *
 * IconService.ensureArtworkFor
 * ------------------------------------------------------------------ */

interface ServiceHarness {
	service: IconService;
	registry: CalloutRegistry;
	injects: number;
	saves: number;
	notifications: number;
	/** Every pack path the store looked for, so a test can count downloads. */
	looked: string[];
	/** Pack files this device already has, keyed by the path the store uses. */
	files: Map<string, string>;
}

function service(): ServiceHarness {
	const reg = registry();
	const h: ServiceHarness = {
		service: undefined as unknown as IconService,
		registry: reg,
		injects: 0,
		saves: 0,
		notifications: 0,
		looked: [],
		files: new Map(),
	};

	const adapter = {
		exists: (path: string) => {
			h.looked.push(path);
			return Promise.resolve(h.files.has(path));
		},
		read: (path: string) => {
			const text = h.files.get(path);
			return text === undefined
				? Promise.reject(new Error("ENOENT"))
				: Promise.resolve(text);
		},
		write: () => Promise.resolve(),
		mkdir: () => Promise.resolve(),
	};

	h.service = new IconService({
		app: { vault: { adapter, configDir: ".obsidian" } } as unknown as App,
		manifest: { id: "callout-studio", dir: "plugins/cs" } as PluginManifest,
		registry: reg,
		// `inject()` is the only member reached, and only to repaint.
		cssInjector: {
			inject: () => {
				h.injects++;
			},
		} as unknown as CSSInjector,
		saveSettings: () => {
			h.saves++;
			return Promise.resolve();
		},
	});
	h.service.onChange(() => {
		h.notifications++;
	});
	return h;
}

describe("ensureArtworkFor — the one repair path", () => {
	it("copies a downloaded pack's artwork into data.json, every role at once", async () => {
		// Every role, not just the one on screen: enabling inline callouts later
		// must not require the pack to still be around.
		const h = service();
		await h.service.ensureArtworkFor([{ type: "octicons", value: "alert" }]);
		assert.ok(h.registry.findIconSvg("octicons", "alert", "16"));
		assert.ok(h.registry.findIconSvg("octicons", "alert", "24"));
	});

	it("collapses two roles that share one drawing into one entry", async () => {
		// Tabler's cacheVariant is "" for every role — one picture, one drawing.
		const h = service();
		await h.service.ensureArtworkFor([{ type: "tabler-outline", value: "dice-3" }]);
		assert.equal(
			h.registry.iconSvgCache.filter((e) => e.name === "dice-3").length,
			1,
		);
	});

	it("repaints and saves once for the whole batch, not once per icon", async () => {
		// The reason `fetchArtwork` is split out of `ensureArtwork`: a 40-icon
		// import must not rewrite data.json 40 times.
		const h = service();
		await h.service.ensureArtworkFor([
			{ type: "octicons", value: "alert" },
			{ type: "octicons", value: "bell" },
			{ type: "tabler-outline", value: "dice-3" },
		]);
		assert.equal(h.saves, 1);
		assert.equal(h.injects, 1);
		assert.equal(h.notifications, 1);
	});

	it("does nothing at all when everything is already drawable", async () => {
		// What keeps a second device that synced data.json from re-downloading
		// packs it never needed.
		const h = service();
		await h.service.ensureArtworkFor([{ type: "octicons", value: "alert" }]);
		const saves = h.saves;
		await h.service.ensureArtworkFor([{ type: "octicons", value: "alert" }]);
		assert.equal(h.saves, saves, "a second pass must cost nothing");
	});

	it("returns immediately when the batch is empty", async () => {
		const h = service();
		await h.service.ensureArtworkFor([]);
		assert.equal(h.saves, 0);
		assert.equal(h.injects, 0);
	});

	it("fetches a pack once however many of its icons are in the batch", async () => {
		// The grouping that matters: twenty Font Awesome Brands icons are one
		// download, and Brands and Solid are two. The first icon of a group pulls
		// the pack in; the rest only copy artwork out of it.
		const h = service();
		h.files.set(h.service.packs.packPath("fa-brands"), realPackText("fa-brands"));
		h.files.set(h.service.packs.packPath("fa-solid"), realPackText("fa-solid"));
		await h.service.ensureArtworkFor([
			{ type: "fa-brands", value: "github" },
			{ type: "fa-brands", value: "twitter" },
			{ type: "fa-brands", value: "apple" },
			{ type: "fa-solid", value: "star" },
		]);
		assert.equal(
			h.looked.filter((p) => p.endsWith("fa-brands.json")).length,
			1,
			"Brands was fetched more than once",
		);
		assert.equal(
			h.looked.filter((p) => p.endsWith("fa-solid.json")).length,
			1,
			"Solid was fetched more than once",
		);
		assert.ok(h.registry.findIconSvg("fa-brands", "apple", ""));
	});

	it("gives up on the group, not once per icon, when the pack cannot be got", async () => {
		// The other half of "one download per group": the property has to hold
		// when the pack is *unobtainable* too, which is exactly when it costs
		// something. `fetchArtwork` re-checks `state !== "ready"` for every icon
		// and a failed pack is never "ready", so the group loop has to carry the
		// `hasFailed` test itself — the filter before it ran before anything had
		// had the chance to fail. Offline, twenty Brands icons must be one
		// answer, not twenty × two URLs behind a 30-second timeout.
		const h = service();
		await h.service.ensureArtworkFor([
			{ type: "rpg-awesome", value: "acid" },
			{ type: "rpg-awesome", value: "anvil" },
			{ type: "rpg-awesome", value: "arrow-cluster" },
		]);
		assert.equal(h.looked.filter((p) => p.endsWith("rpg-awesome.json")).length, 1);
	});

	it("still tries every other library after one of them fails", async () => {
		// Giving up is per pack, never per batch: an import mixing a source that
		// cannot be reached with one already on disk must still repair the
		// second.
		const h = service();
		h.files.set(h.service.packs.packPath("fa-solid"), realPackText("fa-solid"));
		await h.service.ensureArtworkFor([
			{ type: "rpg-awesome", value: "acid" },
			{ type: "rpg-awesome", value: "anvil" },
			{ type: "fa-solid", value: "star" },
		]);
		assert.equal(h.looked.filter((p) => p.endsWith("rpg-awesome.json")).length, 1);
		assert.ok(h.registry.findIconSvg("fa-solid", "star", ""));
	});

	it("does not pull down the other styles of a library it did not ask for", async () => {
		// Picking one Brands icon must not fetch Solid and Regular as well —
		// which is what `dataPacks` being a list rather than a source id is for.
		const h = service();
		h.files.set(h.service.packs.packPath("fa-regular"), realPackText("fa-regular"));
		await h.service.ensureArtworkFor([{ type: "fa-regular", value: "star" }]);
		assert.deepStrictEqual(
			h.looked.filter((p) => p.includes("fa-")),
			[h.service.packs.packPath("fa-regular")],
		);
	});

	it("asks for nothing on behalf of a library with no artwork to fetch", async () => {
		// Lucide ships inside Obsidian, emoji is a glyph, and a user's own
		// picture is already sitting in settings — none has anything a download
		// could add, so none may cost a disk hit or a request.
		const h = service();
		await h.service.ensureArtworkFor([
			{ type: "lucide", value: "star" },
			{ type: "emoji", value: "😀" },
			{ type: "image", value: "img-1" },
		]);
		assert.deepStrictEqual(h.looked, []);
		assert.equal(h.saves, 0);
	});

	it("skips a library it has already given up on this session", async () => {
		// Retrying inside one batch would just repeat the wait; the failure is
		// in memory only, so the next launch tries again.
		const h = service();
		await h.service.ensureArtworkFor([{ type: "rpg-awesome", value: "acid" }]);
		assert.equal(h.service.hasFailed({ type: "rpg-awesome", value: "acid" }, "regular"), true);
		const before = h.looked.length;
		await h.service.ensureArtworkFor([{ type: "rpg-awesome", value: "anvil" }]);
		assert.equal(h.looked.length, before, "it asked again after giving up");
	});

	it("reports a pack whose download gave up as permanently failed", async () => {
		// Without this the settings list spins forever on an imported icon from
		// a source that simply cannot be fetched.
		const h = service();
		assert.equal(h.service.hasFailed({ type: "rpg-awesome", value: "acid" }, "regular"), false);
		await h.service.ensureArtworkFor([{ type: "rpg-awesome", value: "acid" }]);
		assert.equal(h.service.hasFailed({ type: "rpg-awesome", value: "acid" }, "regular"), true);
	});
});

describe("IconService — resolving through the service", () => {
	it("draws from the pack once the artwork has been copied in", async () => {
		const h = service();
		await h.service.ensureArtworkFor([{ type: "octicons", value: "alert" }]);
		const svg = h.service.resolveSvg({ type: "octicons", value: "alert" }, "inline");
		assert.ok(svg?.includes(`viewBox="0 0 16 16"`), String(svg).slice(0, 80));
	});

	it("announces when either supply route finishes", async () => {
		const h = service();
		let seen = 0;
		const off = h.service.onChange(() => {
			seen++;
		});
		await h.service.ensureArtworkFor([{ type: "octicons", value: "bell" }]);
		assert.ok(seen > 0);
		off();
		await h.service.ensureArtworkFor([{ type: "octicons", value: "alert" }]);
		assert.equal(seen, 1);
	});
});

describe("IconService.initialize — what a launch actually reads", () => {
	it("leaves a hidden icon's pack on disk, unread", async () => {
		// A callout drawing no icon still stores one, but nothing paints it — so
		// it must not pull a whole pack off disk, or further down, off the
		// network. Its cached SVG survives the sweep, so turning the icon back on
		// needs neither.
		const h = service();
		h.registry.add(
			definition({
				id: "quiet",
				hideIcon: true,
				icon: { type: "rpg-awesome", value: "acid" },
			}),
		);
		await h.service.initialize();
		assert.deepStrictEqual(
			h.looked.filter((p) => p.includes("rpg-awesome")),
			[],
		);
	});

	it("does read the pack of a callout that is drawing its icon", async () => {
		const h = service();
		h.registry.add(
			definition({ id: "loud", icon: { type: "rpg-awesome", value: "acid" } }),
		);
		await h.service.initialize();
		assert.ok(
			h.looked.some((p) => p.includes("rpg-awesome")),
			"a visible icon's pack was never looked for",
		);
	});
});

/* ------------------------------------------------------------------ *
 * IconFetchManager
 * ------------------------------------------------------------------ */

describe("IconFetchManager", () => {
	interface FetchHarness {
		fetch: IconFetchManager;
		registry: CalloutRegistry;
		injects: number;
		saves: number;
		notifications: number;
	}

	function fetchHarness(): FetchHarness {
		const reg = registry();
		const h: FetchHarness = {
			fetch: undefined as unknown as IconFetchManager,
			registry: reg,
			injects: 0,
			saves: 0,
			notifications: 0,
		};
		h.fetch = new IconFetchManager({
			registry: reg,
			cssInjector: {
				inject: () => {
					h.injects++;
				},
			} as unknown as CSSInjector,
			saveSettings: () => {
				h.saves++;
				return Promise.resolve();
			},
		});
		h.fetch.onChange(() => {
			h.notifications++;
		});
		return h;
	}

	it("reports nothing as failed before anything has been tried", () => {
		const h = fetchHarness();
		assert.equal(h.fetch.hasFailed({ type: "material", value: "home" }), false);
	});

	it("keys the failure by style and weight, not by name alone", async () => {
		// 3,870 icons across 4 styles and 7 weights are over 100,000 drawings;
		// one of them being unavailable says nothing about the others.
		const h = fetchHarness();
		h.registry.add(
			definition({
				id: "m",
				icon: { type: "material", value: "home", style: "filled", weight: 700 },
			}),
		);
		await h.fetch.ensureAll();
		assert.equal(
			h.fetch.hasFailed({ type: "material", value: "home", style: "filled", weight: 700 }),
			true,
		);
		assert.equal(
			h.fetch.hasFailed({ type: "material", value: "home", style: "outlined", weight: 400 }),
			false,
		);
		assert.equal(h.fetch.hasFailed({ type: "material", value: "house" }), false);
	});

	it("records an offline failure without writing anything", async () => {
		// Nothing was fetched, so nothing is saved — but the UI is still told,
		// because the row has to stop showing a spinner.
		const h = fetchHarness();
		h.registry.add(definition({ id: "m", icon: { type: "material", value: "home" } }));
		await h.fetch.ensureAll();
		assert.equal(h.saves, 0);
		assert.equal(h.injects, 0);
		assert.equal(h.notifications, 1);
	});

	it("keeps the failure in memory only, so the next launch tries again", () => {
		// A fresh manager over the same registry is what a reload looks like.
		const h = fetchHarness();
		const reloaded = new IconFetchManager({
			registry: h.registry,
			cssInjector: { inject: () => undefined } as unknown as CSSInjector,
			saveSettings: () => Promise.resolve(),
		});
		assert.equal(reloaded.hasFailed({ type: "material", value: "home" }), false);
	});

	it("does nothing when no callout is missing artwork", async () => {
		const h = fetchHarness();
		await h.fetch.ensureAll();
		assert.equal(h.notifications, 0, "an empty sweep must not repaint");
	});

	it("leaves every pack that is not fetched per icon alone", async () => {
		// Only `perIconRemote` goes through here. A Lucide or Octicons icon
		// reaching this class would mean a whole pack fetched one drawing at a
		// time from a vendor that does not serve them that way.
		const h = fetchHarness();
		for (const icon of [
			{ type: "lucide", value: "star" },
			{ type: "octicons", value: "alert" },
			{ type: "emoji", value: "😀" },
			{ type: "fa-solid", value: "star" },
			{ type: "image", value: "img-1" },
		] as CalloutIcon[]) {
			await h.fetch.cacheOne(icon);
			assert.equal(h.fetch.hasFailed(icon), false, icon.type);
		}
		assert.equal(h.notifications, 0);
		assert.equal(h.saves, 0);
	});

	it("does not fetch a Material icon whose artwork is already cached", async () => {
		const h = fetchHarness();
		const icon: CalloutIcon = { type: "material", value: "home" };
		h.registry.addIconSvg({
			pack: "material",
			name: "home",
			variant: "outlined|400",
			svg: "<svg/>",
		});
		await h.fetch.cacheOne(icon);
		assert.equal(h.fetch.hasFailed(icon), false);
		assert.equal(h.notifications, 0);
	});

	it("keeps sweeping after one icon fails", async () => {
		const h = fetchHarness();
		h.registry.add(definition({ id: "a", icon: { type: "material", value: "home" } }));
		h.registry.add(definition({ id: "b", icon: { type: "material", value: "house" } }));
		await h.fetch.ensureAll();
		assert.equal(h.fetch.hasFailed({ type: "material", value: "home" }), true);
		assert.equal(h.fetch.hasFailed({ type: "material", value: "house" }), true);
	});

	it("can be unsubscribed, and survives a listener that throws", async () => {
		const h = fetchHarness();
		let reached = false;
		h.fetch.onChange(() => {
			throw new Error("boom");
		});
		const off = h.fetch.onChange(() => {
			reached = true;
		});
		h.registry.add(definition({ id: "m", icon: { type: "material", value: "home" } }));
		await h.fetch.ensureAll();
		assert.ok(reached);
		off();
	});

	it("asks nothing on behalf of an icon whose role variant it cannot key", async () => {
		const h = fetchHarness();
		const unknown: CalloutIcon = { type: "future" as IconPackId, value: "x" };
		await h.fetch.cacheOne(unknown);
		assert.equal(h.fetch.hasFailed(unknown), false);
	});

	it("uses `regular` as the role when none is named", () => {
		// Every caller but the two status surfaces asks without one, and a
		// different default would look up a cache entry nothing ever writes.
		const h = fetchHarness();
		const icon: CalloutIcon = { type: "material", value: "home" };
		assert.equal(h.fetch.hasFailed(icon), h.fetch.hasFailed(icon, "regular"));
	});
});

describe("IconFetchManager.cacheOne — one request per drawing", () => {
	interface FetchSeams {
		__CS_REQUEST_URL__?: (url: string) => Promise<{ text: string }>;
		window?: unknown;
	}
	const seams = globalThis as unknown as FetchSeams;

	/**
	 * Count every request and refuse all of them, so what a test reads is the
	 * number of attempts rather than what came back.
	 *
	 * The `window` here is not a fake DOM — `cacheOne`'s retry wait reaches for
	 * exactly one member of it, and what it wants from that member is to be
	 * called back later. A resolved promise is later enough, and costs the three
	 * attempts no wall clock at all.
	 */
	function offline(): { requests: () => number; restore: () => void } {
		const savedServe = seams.__CS_REQUEST_URL__;
		const savedWindow = seams.window;
		let requests = 0;
		seams.__CS_REQUEST_URL__ = () => {
			requests++;
			return Promise.reject(new Error("offline"));
		};
		seams.window = {
			setTimeout: (fn: () => void) => {
				void Promise.resolve().then(fn);
				return 0;
			},
			clearTimeout: () => {},
		};
		return {
			requests: () => requests,
			restore: () => {
				seams.__CS_REQUEST_URL__ = savedServe;
				seams.window = savedWindow;
			},
		};
	}

	function manager(): IconFetchManager {
		return new IconFetchManager({
			registry: registry(),
			cssInjector: { inject: () => undefined } as unknown as CSSInjector,
			saveSettings: () => Promise.resolve(),
		});
	}

	it("hands two concurrent callers the very same request", async () => {
		// Identity, not a count, is the property: an `async` method returns a
		// fresh promise every call, so sharing one is only observable this way.
		// The picker's confirm and the editor's save can land on the same icon
		// in the same tick, and two fetches of one drawing is two rounds of
		// three attempts, two waits apiece, racing to store identical bytes.
		const net = offline();
		try {
			const fetch = manager();
			const icon: CalloutIcon = { type: "material", value: "home" };
			const first = fetch.cacheOne(icon);
			const second = fetch.cacheOne(icon);
			assert.strictEqual(first, second, "the second caller started its own");
			await first;
			assert.equal(net.requests(), 3, "one round of attempts, not two");
		} finally {
			net.restore();
		}
	});

	it("keeps two different drawings on their own requests", async () => {
		// The other half of the same property: de-duplication is keyed the way
		// the cache is, so `home` joining `house` would be a bug of its own.
		const net = offline();
		try {
			const fetch = manager();
			const home = fetch.cacheOne({ type: "material", value: "home" });
			const house = fetch.cacheOne({ type: "material", value: "house" });
			assert.notStrictEqual(home, house);
			await Promise.all([home, house]);
			assert.equal(net.requests(), 6);
		} finally {
			net.restore();
		}
	});

	it("keys the sharing by style and weight, not by name alone", async () => {
		// One name is over a hundred drawings; two of them are two fetches.
		const net = offline();
		try {
			const fetch = manager();
			const a = fetch.cacheOne({ type: "material", value: "home", weight: 400 });
			const b = fetch.cacheOne({ type: "material", value: "home", weight: 700 });
			assert.notStrictEqual(a, b);
			await Promise.all([a, b]);
			assert.equal(net.requests(), 6);
		} finally {
			net.restore();
		}
	});

	it("lets the next caller try again once the request has settled", async () => {
		// The map is cleared in a `finally`, so this shares *concurrent* callers
		// rather than locking the icon out for the session. Retrying is what the
		// picker's second press has to be able to do.
		const net = offline();
		try {
			const fetch = manager();
			const icon: CalloutIcon = { type: "material", value: "home" };
			await fetch.cacheOne(icon);
			const after = net.requests();
			const again = fetch.cacheOne(icon);
			assert.equal(net.requests() > after, true, "it refused to try again");
			await again;
		} finally {
			net.restore();
		}
	});

	it("asks for nothing at all when the drawing is already cached", async () => {
		const net = offline();
		try {
			const fetch = manager();
			const reg = registry();
			reg.addIconSvg({
				pack: "material",
				name: "home",
				variant: "outlined|400",
				svg: "<svg/>",
			});
			const cached = new IconFetchManager({
				registry: reg,
				cssInjector: { inject: () => undefined } as unknown as CSSInjector,
				saveSettings: () => Promise.resolve(),
			});
			await cached.cacheOne({ type: "material", value: "home" });
			assert.equal(net.requests(), 0);
			await fetch.cacheOne({ type: "lucide", value: "star" });
			assert.equal(net.requests(), 0, "a builtin pack asked for artwork");
		} finally {
			net.restore();
		}
	});
});

describe("the render roles this all sweeps over", () => {
	it("is every role there is", () => {
		// `cleanupUnusedIconSvgs` and `copyPackArtwork` both walk this list; a
		// role missing from it is artwork that is copied but never kept, or kept
		// but never copied.
		assert.deepStrictEqual([...CALLOUT_RENDER_ROLES], ["regular", "heading", "inline"]);
	});
});
