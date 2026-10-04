/**
 * tests/iconLibraries.test.ts — which libraries Pick an icon offers, and in
 * what order.
 *
 * `icons/iconLibraries.ts` is the one place that combines the synced half of
 * the answer (`settings.iconLibraries`: the user's order and the built-in
 * libraries they hid) with the per-device half (which library files this device
 * has). The picker's menu, its All sources pool and the Icon libraries window
 * all ask it, so a disagreement here would show up as a library that is in the
 * window but missing from the menu, or the other way round.
 *
 * The two rules worth holding on to:
 *
 * - A downloadable library is offered exactly when **every** file it is made of
 *   is on the device. Font Awesome with only Brands downloaded is not offered —
 *   its Solid and Regular names would be blank cells.
 * - Saving an order rearranges only the libraries the device shows, each into a
 *   slot one of them already held, so a library downloaded on another device
 *   keeps the place it was given there.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	FALLBACK_LIBRARY,
	calloutNamesUsingLibrary,
	calloutsUsingLibrary,
	editedUsingLibrary,
	formatBytes,
	isDownloadable,
	isDownloaded,
	isInPicker,
	isInstalled,
	libraryBytes,
	libraryFiles,
	libraryOrder,
	menuLibraries,
	pickerSources,
	reorderShown,
	savedLibraryOrder,
	type EditedCallout,
	type PackStates,
} from "../src/icons/iconLibraries";
import { ICON_SOURCE_IDS } from "../src/icons/registry";
import { PACK_MANIFEST } from "../src/icons/data/packManifest";
import type {
	CalloutDefinition,
	IconLibrarySettings,
	IconPackId,
	IconSourceId,
} from "../src/types";

/** A device holding exactly these pack files. */
function device(ready: readonly IconPackId[] = []): PackStates {
	return {
		state: (id: IconPackId) => (ready.includes(id) ? "ready" : "unavailable"),
		info: (id: IconPackId) => PACK_MANIFEST[id],
	} as PackStates;
}

function prefs(over: Partial<IconLibrarySettings> = {}): IconLibrarySettings {
	return { order: [], hidden: [], ...over };
}

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

const CATALOG: readonly IconSourceId[] = [
	"lucide", "tabler", "material", "emoji", "octicons", "fa", "rpg-awesome", "simple-icons", "image",
];

describe("the catalog these helpers are written against", () => {
	it("is the order the registry declares", () => {
		// The tests below spell the catalog out; if the registry gains or
		// reorders a library, they have to be read again, not silently pass.
		assert.deepEqual(ICON_SOURCE_IDS, CATALOG);
	});

	it("splits into libraries to download and libraries that ship with the plugin", () => {
		assert.deepEqual(CATALOG.filter(isDownloadable),
			["tabler", "octicons", "fa", "rpg-awesome", "simple-icons"]);
		assert.deepEqual(libraryFiles("fa"), ["fa-solid", "fa-regular", "fa-brands"]);
		assert.deepEqual(libraryFiles("tabler"), ["tabler-outline", "tabler-filled"]);
		assert.deepEqual(libraryFiles("lucide"), []);
		assert.deepEqual(libraryFiles("material"), [], "Material is fetched per icon, never as files");
	});
});

describe("libraryOrder — the user's order, made complete", () => {
	it("is the catalog order while nothing has been arranged", () => {
		assert.deepEqual(libraryOrder(prefs()), CATALOG);
	});

	it("keeps the saved order and skips ids this build does not know", () => {
		const saved = ["emoji", "phosphor", "image", "lucide", "tabler", "material", "octicons", "fa",
			"rpg-awesome", "simple-icons"];
		assert.deepEqual(libraryOrder(prefs({ order: saved })),
			["emoji", "image", "lucide", "tabler", "material", "octicons", "fa", "rpg-awesome", "simple-icons"]);
	});

	it("puts a library the saved list lacks right after its catalog neighbour", () => {
		// What a release adding a library meets: a full order without it.
		const saved = ["emoji", "lucide", "tabler", "material", "octicons", "fa", "rpg-awesome", "image"];
		assert.deepEqual(libraryOrder(prefs({ order: saved })),
			["emoji", "lucide", "tabler", "material", "octicons", "fa", "rpg-awesome", "simple-icons", "image"]);
	});

	it("puts a missing first library first", () => {
		const saved = CATALOG.filter((id) => id !== "lucide");
		assert.deepEqual(libraryOrder(prefs({ order: [...saved] })), CATALOG);
	});

	it("counts a library listed twice once, where it first appears", () => {
		const order = libraryOrder(prefs({ order: ["fa", "lucide", "fa"] }));
		assert.equal(order.filter((id) => id === "fa").length, 1);
		assert.equal(order[0], "fa");
		assert.equal(order.length, CATALOG.length);
	});
});

describe("isInPicker — what this device offers", () => {
	it("offers a built-in library unless it was hidden", () => {
		assert.equal(isInPicker("emoji", prefs(), device()), true);
		assert.equal(isInPicker("emoji", prefs({ hidden: ["emoji"] }), device()), false);
		assert.equal(isInPicker("material", prefs({ hidden: ["material"] }), device()), false);
	});

	it("offers a downloadable library only once every file of it is here", () => {
		assert.equal(isInPicker("fa", prefs(), device()), false);
		assert.equal(isInPicker("fa", prefs(), device(["fa-brands"])), false,
			"Brands alone would leave Solid and Regular as blank cells");
		assert.equal(isDownloaded("fa", device(["fa-brands"])), false);
		assert.equal(isInPicker("fa", prefs(), device(["fa-solid", "fa-regular", "fa-brands"])), true);
	});

	it("ignores a downloadable library in the hidden list: deleting is how it leaves", () => {
		const offered = isInPicker("octicons", prefs({ hidden: ["octicons"] }), device(["octicons"]));
		assert.equal(offered, true);
	});
});

describe("pickerSources and menuLibraries — the picker's lists", () => {
	it("offers the built-in libraries in catalog order on a device with no downloads", () => {
		assert.deepEqual(pickerSources(prefs(), device()), ["lucide", "material", "emoji", "image"]);
	});

	it("follows the saved order and leaves out what is hidden or not downloaded", () => {
		const settings = prefs({
			order: ["octicons", "image", "lucide", "tabler", "material", "emoji", "fa", "rpg-awesome", "simple-icons"],
			hidden: ["emoji"],
		});
		assert.deepEqual(pickerSources(settings, device(["octicons"])),
			["octicons", "image", "lucide", "material"]);
	});

	it("falls back to Lucide when nothing at all would be offered", () => {
		// Settings synced from a device with downloads can hide every built-in
		// library on one that has none.
		const settings = prefs({ hidden: ["lucide", "material", "emoji", "image"] });
		assert.deepEqual(pickerSources(settings, device()), [FALLBACK_LIBRARY]);
		assert.equal(FALLBACK_LIBRARY, "lucide");
	});

	it("lists exactly what the picker offers, and counts the downloadable rest", () => {
		const bare = menuLibraries(prefs(), device());
		assert.deepEqual(bare.libraries, ["lucide", "material", "emoji", "image"]);
		assert.deepEqual(bare.toDownload, ["tabler", "octicons", "fa", "rpg-awesome", "simple-icons"]);
		assert.equal(bare.current, null);
		assert.deepEqual(bare.libraries, pickerSources(prefs(), device()), "the menu is the pool's list");

		// Downloading one moves it across, into the slot the order gives it.
		const withTabler = menuLibraries(prefs(), device(["tabler-outline", "tabler-filled"]));
		assert.deepEqual(withTabler.libraries, ["lucide", "tabler", "material", "emoji", "image"]);
		assert.deepEqual(withTabler.toDownload, ["octicons", "fa", "rpg-awesome", "simple-icons"]);
	});

	it("has nothing left to download once every library is on the device", () => {
		const everything = device([
			"tabler-outline", "tabler-filled", "octicons", "fa-solid", "fa-regular", "fa-brands",
			"rpg-awesome", "simple-icons",
		]);
		assert.deepEqual(menuLibraries(prefs(), everything).toDownload, []);
		assert.deepEqual(menuLibraries(prefs(), everything).libraries, CATALOG);
	});

	it("leaves out a library with only some of its files, and counts it as left to download", () => {
		const partial = menuLibraries(prefs(), device(["fa-brands"]));
		assert.ok(partial.toDownload.includes("fa"));
		assert.ok(!partial.libraries.includes("fa"));
	});

	it("leaves out a hidden built-in library, which is not one to download either", () => {
		const menu = menuLibraries(prefs({ hidden: ["emoji"] }), device());
		assert.ok(!menu.libraries.includes("emoji"));
		assert.ok(!menu.toDownload.includes("emoji"));
	});
});

describe("menuLibraries — the library of the icon being edited", () => {
	// A callout keeps its icon when its library is deleted, and a synced one can
	// use a library this device never downloaded. Editing it opens the picker on
	// that library, so the menu must show it — apart from the libraries on offer.

	it("sets a library that is not on the device apart, and still counts it to download", () => {
		const menu = menuLibraries(prefs(), device(), "tabler");
		assert.equal(menu.current, "tabler");
		assert.ok(!menu.libraries.includes("tabler"), "it is not one of the libraries on offer");
		assert.deepEqual(menu.toDownload, ["tabler", "octicons", "fa", "rpg-awesome", "simple-icons"],
			"its retained icon does not make the library downloaded");
	});

	it("does the same for one with only some of its files", () => {
		const menu = menuLibraries(prefs(), device(["fa-brands"]), "fa");
		assert.equal(menu.current, "fa");
		assert.ok(menu.toDownload.includes("fa"), "the library still needs its missing files");
	});

	it("sets a hidden built-in library apart too, so the menu lists exactly what is offered", () => {
		const settings = prefs({ hidden: ["material"] });
		const menu = menuLibraries(settings, device(), "material");
		assert.equal(menu.current, "material");
		assert.deepEqual(menu.libraries, ["lucide", "emoji", "image"]);
		assert.deepEqual(menu.toDownload, menuLibraries(settings, device()).toDownload,
			"a built-in library was never one to download");
	});

	it("leaves it among the others when the picker offers it", () => {
		const menu = menuLibraries(prefs(), device(["tabler-outline", "tabler-filled"]), "tabler");
		assert.equal(menu.current, null);
		assert.ok(menu.libraries.includes("tabler"));
		assert.equal(menuLibraries(prefs(), device(), "lucide").current, null);
	});

	it("leaves Lucide among the others when it is offered only as the last resort", () => {
		// Every built-in hidden and nothing downloaded: the picker falls back to
		// Lucide, which is then offered — not set apart.
		const settings = prefs({ hidden: ["lucide", "material", "emoji", "image"] });
		const menu = menuLibraries(settings, device(), "lucide");
		assert.equal(menu.current, null);
		assert.deepEqual(menu.libraries, [FALLBACK_LIBRARY]);
	});

	it("always lists the edited icon's library, and never any library twice", () => {
		for (const id of ICON_SOURCE_IDS) {
			for (const files of [[], ["tabler-outline", "tabler-filled", "octicons"]] as IconPackId[][]) {
				const menu = menuLibraries(prefs({ hidden: ["emoji"] }), device(files), id);
				const listed = [...(menu.current ? [menu.current] : []), ...menu.libraries];
				const where = `${id} with ${files.join(",") || "nothing"} downloaded`;
				assert.ok(listed.includes(id), `${where}: the edited icon's library is listed`);
				assert.equal(new Set(listed).size, listed.length, `${where}: no library twice`);
			}
		}
	});

	it("counts the same downloads regardless of the icon being edited", () => {
		const settings = prefs({ hidden: ["emoji"] });
		const states: IconPackId[][] = [
			[],
			["fa-brands", "tabler-outline"],
			["tabler-outline", "tabler-filled", "octicons"],
			ICON_SOURCE_IDS.flatMap((id) => [...libraryFiles(id)]),
		];
		for (const files of states) {
			const packs = device(files);
			const expected = menuLibraries(settings, packs).toDownload;
			for (const current of ICON_SOURCE_IDS) {
				assert.deepEqual(menuLibraries(settings, packs, current).toDownload, expected,
					`${current} with ${files.join(",") || "nothing"} downloaded`);
			}
		}
	});
});

describe("isInstalled — any file on the device", () => {
	it("is true for a library with only some of its files, which isDownloaded is not", () => {
		assert.equal(isInstalled("fa", device(["fa-brands"])), true);
		assert.equal(isDownloaded("fa", device(["fa-brands"])), false);
		assert.equal(isInstalled("fa", device()), false);
	});

	it("is never true for a library that ships with the plugin", () => {
		assert.equal(isInstalled("lucide", device()), false);
		assert.equal(isInstalled("material", device()), false);
	});
});

describe("reorderShown and savedLibraryOrder — saving a drag", () => {
	it("moves only the shown libraries, each into a slot one of them held", () => {
		const shownNow: IconSourceId[] = ["emoji", "lucide", "material", "image"];
		assert.deepEqual(reorderShown(CATALOG, shownNow),
			["emoji", "tabler", "lucide", "material", "octicons", "fa", "rpg-awesome", "simple-icons", "image"]);
	});

	it("leaves the order alone when nothing moved", () => {
		assert.deepEqual(reorderShown(CATALOG, ["lucide", "material", "emoji", "image"]), CATALOG);
	});

	it("saves the catalog order as an empty list, which means the same", () => {
		assert.deepEqual(savedLibraryOrder([], CATALOG), []);
		assert.deepEqual(savedLibraryOrder(["fa", ...CATALOG], CATALOG), []);
	});

	it("keeps an id a newer build wrote, after this build's own", () => {
		const arranged: IconSourceId[] = ["emoji", ...CATALOG.filter((id) => id !== "emoji")];
		assert.deepEqual(savedLibraryOrder(["phosphor", ...CATALOG], arranged), [...arranged, "phosphor"]);
		assert.deepEqual(savedLibraryOrder(["phosphor"], CATALOG), [...CATALOG, "phosphor"],
			"the catalog order cannot be written as empty while an unknown id rides along");
	});
});

describe("libraryBytes and formatBytes — what a library costs", () => {
	const bytes = (id: IconPackId) => PACK_MANIFEST[id]?.bytes ?? 0;

	it("adds up every file of a library, or only what this device still lacks", () => {
		const all = bytes("fa-solid") + bytes("fa-regular") + bytes("fa-brands");
		assert.equal(libraryBytes("fa", device()), all);
		assert.equal(libraryBytes("fa", device(["fa-solid"]), true), bytes("fa-regular") + bytes("fa-brands"));
		assert.equal(libraryBytes("lucide", device()), 0);
	});

	it("speaks in the units the download prompt has always used", () => {
		assert.equal(formatBytes(384_490), "375 KB");
		assert.equal(formatBytes(1_708_526), "1.6 MB");
	});
});

describe("calloutsUsingLibrary — who has to keep drawing", () => {
	it("finds callouts using any file of the library, an icon turned off included", () => {
		const defs = [
			callout("bug", { icon: { type: "fa-brands", value: "github" } }),
			callout("quote", { icon: { type: "fa-solid", value: "quote-left" }, hideIcon: true }),
			callout("note", { icon: { type: "lucide", value: "pencil" } }),
			callout("tip", { icon: { type: "tabler-outline", value: "bulb" } }),
		];
		assert.deepEqual(calloutsUsingLibrary(defs, "fa").map((def) => def.id), ["bug", "quote"]);
		assert.deepEqual(calloutsUsingLibrary(defs, "tabler").map((def) => def.id), ["tip"]);
	});

	it("leaves out theme rows, which are rebuilt on every load and never saved", () => {
		const defs = [callout("theme-row", { source: "theme", icon: { type: "octicons", value: "alert" } })];
		assert.deepEqual(calloutsUsingLibrary(defs, "octicons"), []);
	});
});

describe("calloutNamesUsingLibrary — who has to keep drawing, the unsaved edit included", () => {
	// The registry holds only saved callouts; the callout editor keeps the icon
	// it was just given until Save. Download a library, pick one of its icons,
	// and the only callout using it is that edit — which is exactly when the
	// person goes to delete the library and expects to be told.
	const edit = (over: Partial<EditedCallout> = {}): EditedCallout => ({
		id: null,
		name: "My new callout",
		icon: { type: "octicons", value: "rocket" },
		...over,
	});

	it("is the saved callouts using the library, by the name the person knows them by", () => {
		const defs = [
			callout("a", { displayName: "Alpha", icon: { type: "octicons", value: "alert" } }),
			callout("b", { displayName: "", icon: { type: "octicons", value: "bell" } }),
			callout("c"),
		];
		assert.deepEqual(calloutNamesUsingLibrary(defs, "octicons"), ["Alpha", "b"]);
		assert.deepEqual(calloutNamesUsingLibrary(defs, "tabler"), []);
	});

	it("counts a new callout whose unsaved icon comes from the library", () => {
		assert.deepEqual(calloutNamesUsingLibrary([], "octicons", edit()), ["My new callout"]);
	});

	it("counts the edit of a saved callout whose saved icon is from somewhere else", () => {
		const saved = [callout("note", { displayName: "Note" })];
		assert.deepEqual(calloutNamesUsingLibrary(saved, "octicons", edit({ id: "note", name: "Note" })), ["Note"]);
	});

	it("counts a saved callout once when its saved icon and its edit both use the library", () => {
		const saved = [callout("note", { displayName: "Note", icon: { type: "octicons", value: "alert" } })];
		assert.deepEqual(calloutNamesUsingLibrary(saved, "octicons", edit({ id: "note", name: "Note" })), ["Note"]);
	});

	it("still counts a saved callout whose edit has moved to another library", () => {
		// Until Save, the saved version is what every note is drawing.
		const saved = [callout("note", { displayName: "Note", icon: { type: "octicons", value: "alert" } })];
		const moved = edit({ id: "note", name: "Note", icon: { type: "lucide", value: "star" } });
		assert.deepEqual(calloutNamesUsingLibrary(saved, "octicons", moved), ["Note"]);
	});

	it("lists the edit after the saved callouts, and counts two different callouts twice", () => {
		const saved = [callout("a", { displayName: "Alpha", icon: { type: "octicons", value: "alert" } })];
		assert.deepEqual(calloutNamesUsingLibrary(saved, "octicons", edit()), ["Alpha", "My new callout"]);
	});

	it("ignores an edit whose icon is from another library", () => {
		const other = edit({ icon: { type: "tabler-outline", value: "bulb" } });
		assert.deepEqual(calloutNamesUsingLibrary([], "octicons", other), []);
		assert.deepEqual(calloutNamesUsingLibrary([], "octicons", undefined), []);
		assert.deepEqual(calloutNamesUsingLibrary([], "octicons", null), []);
	});

	it("counts an edit whose icon is turned off: the icon is still stored", () => {
		// The editor hands the picker `this.icon` even while the icon is hidden.
		assert.deepEqual(calloutNamesUsingLibrary([], "octicons", edit()), ["My new callout"]);
	});
});

describe("editedUsingLibrary — the edit, when it is the library's", () => {
	it("returns the edit for any file of the library, and nothing for another library", () => {
		const edit: EditedCallout = { id: null, name: "N", icon: { type: "fa-brands", value: "github" } };
		assert.equal(editedUsingLibrary(edit, "fa"), edit);
		assert.equal(editedUsingLibrary(edit, "tabler"), null);
		assert.equal(editedUsingLibrary(undefined, "fa"), null);
		assert.equal(editedUsingLibrary(null, "fa"), null);
	});
});
