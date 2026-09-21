/**
 * tests/iconRegistry.test.ts — the two icon id spaces, and the seams that keep
 * them apart.
 *
 * `IconSourceId` is a library as the user meets it: one row in the picker's
 * source menu, one toolbar, one Download button — eight of them. `IconPackId`
 * is one body of artwork: one `CalloutIcon.type`, one pack manifest entry, one
 * downloaded file, one SVG cache key — eleven of them. They differ for exactly
 * two libraries, Font Awesome (three files behind one source) and Tabler (two),
 * and every bug this file guards against is the same bug: treating a source id
 * as though it were an artwork id.
 *
 * The consequence is not cosmetic. `iconCacheKey` keys a cached drawing; feed it
 * `pack.id` and Solid, Regular and Brands collapse onto one entry — the last
 * style written wins for all three, and every drawing already cached under the
 * real type is orphaned, which on a device with no network means the icons
 * simply stop appearing. So the keying is tested by the property that makes it
 * matter (three styles, three keys) rather than by its string format.
 *
 * The rest of the file covers what the picker asks a pack: which entries a
 * variant actually draws (`entryMatches`), which variants raise a standing
 * notice (`pickerNotice`), and how a chosen icon is described back to the user.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import {
	ICON_PACK_IDS,
	ICON_SOURCES,
	ICON_SOURCE_IDS,
	getSource,
	iconCacheKey,
	packFor,
} from "../src/icons/registry";
import type { CalloutIcon, IconPackId, IconSourceId } from "../src/types";
import { CALLOUT_RENDER_ROLES } from "../src/types";
import type { IconEntry } from "../src/icons/types";
import { PACK_MANIFEST } from "../src/icons/data/packManifest";
import { decodeIndex } from "../src/icons/data/codec";
import { FA_SOLID_INDEX } from "../src/icons/data/fa-solid.index";
import { FA_REGULAR_INDEX } from "../src/icons/data/fa-regular.index";
import { FA_BRANDS_INDEX } from "../src/icons/data/fa-brands.index";
import { TABLER_OUTLINE_INDEX } from "../src/icons/data/tabler-outline.index";
import { TABLER_FILLED_INDEX } from "../src/icons/data/tabler-filled.index";
import { faPack, FA_DATA_PACKS, faStyleOf } from "../src/icons/packs/fontAwesome";
import {
	tablerPack,
	TABLER_DATA_PACKS,
	tablerStyleOf,
} from "../src/icons/packs/tabler";
import { describeIcon } from "../src/icons/describeIcon";
import { en } from "../src/i18n/en";
import type { UserImageIcon } from "../src/types";

/** Which source each body of artwork belongs to. The record under test, stated
 *  independently here so a change to `registry.ts` has to be a change to both. */
const EXPECTED_SOURCE_OF_TYPE: Readonly<Record<IconPackId, IconSourceId>> = {
	lucide: "lucide",
	"tabler-outline": "tabler",
	"tabler-filled": "tabler",
	material: "material",
	emoji: "emoji",
	octicons: "octicons",
	"fa-solid": "fa",
	"fa-regular": "fa",
	"fa-brands": "fa",
	"rpg-awesome": "rpg-awesome",
	image: "image",
};

const icon = (type: IconPackId, value = "x"): CalloutIcon => ({ type, value });

/* ------------------------------------------------------------------ *
 * Completeness of the two records
 * ------------------------------------------------------------------ */

describe("ICON_SOURCES and SOURCE_OF_TYPE are total over their unions", () => {
	it("offers eight sources and knows eleven bodies of artwork", () => {
		assert.equal(ICON_SOURCE_IDS.length, 8);
		assert.equal(ICON_PACK_IDS.length, 11);
	});

	it("gives every source the id it is filed under", () => {
		// The record's key and the pack's own `id` are two spellings of one
		// thing, and only one of them is what `packFor` returns.
		for (const id of ICON_SOURCE_IDS) {
			assert.equal(ICON_SOURCES[id].id, id, `${id} is filed under the wrong key`);
		}
	});

	it("maps every pack id onto the source stated here", () => {
		for (const [type, source] of Object.entries(EXPECTED_SOURCE_OF_TYPE)) {
			assert.equal(
				packFor(icon(type as IconPackId))?.id,
				source,
				`${type} should belong to ${source}`,
			);
		}
	});

	it("declares exactly the pack ids listed here, no more and no fewer", () => {
		assert.deepStrictEqual(
			[...ICON_PACK_IDS].sort(),
			Object.keys(EXPECTED_SOURCE_OF_TYPE).sort(),
		);
	});

	it("leaves no source without artwork to draw", () => {
		// The reverse direction: a source nothing maps onto would be a row in the
		// picker that can never produce a storable icon.
		const claimed = new Set(Object.values(EXPECTED_SOURCE_OF_TYPE));
		for (const id of ICON_SOURCE_IDS) {
			assert.ok(claimed.has(id), `${id} owns no IconPackId`);
		}
	});

	it("resolves every source through getSource", () => {
		for (const id of ICON_SOURCE_IDS) {
			assert.strictEqual(getSource(id), ICON_SOURCES[id]);
		}
	});

	it("returns undefined for a type this build has never heard of", () => {
		// Data read off disk cannot be vouched for by the type system — an import
		// from a newer version, or a hand-edited data.json.
		assert.equal(packFor({ type: "nope" as IconPackId, value: "x" }), undefined);
	});
});

describe("dataPacks line up with the pack manifest", () => {
	it("lists only pack ids that belong to the source listing them", () => {
		for (const id of ICON_SOURCE_IDS) {
			for (const type of ICON_SOURCES[id].dataPacks ?? []) {
				assert.equal(
					EXPECTED_SOURCE_OF_TYPE[type],
					id,
					`${id} claims ${type}, which belongs to another source`,
				);
			}
		}
	});

	it("gives every downloadable pack a manifest entry, and nothing else one", () => {
		const downloadable = new Set(
			ICON_SOURCE_IDS.flatMap((id) =>
				ICON_SOURCES[id].kind === "bundledRemote"
					? [...(ICON_SOURCES[id].dataPacks ?? [])]
					: [],
			),
		);
		assert.deepStrictEqual(
			[...downloadable].sort(),
			(Object.keys(PACK_MANIFEST) as IconPackId[]).sort(),
		);
	});

	it("gives a pack that is not downloaded whole no dataPacks at all", () => {
		for (const id of ICON_SOURCE_IDS) {
			const pack = ICON_SOURCES[id];
			if (pack.kind === "bundledRemote") {
				assert.ok(
					(pack.dataPacks?.length ?? 0) > 0,
					`${id} is downloadable but names no file`,
				);
			} else {
				assert.equal(pack.dataPacks, undefined, `${id} names a file it never fetches`);
			}
		}
	});

	it("splits Font Awesome into three files and Tabler into two", () => {
		assert.deepStrictEqual([...FA_DATA_PACKS], [
			"fa-solid",
			"fa-regular",
			"fa-brands",
		]);
		assert.deepStrictEqual([...TABLER_DATA_PACKS], [
			"tabler-outline",
			"tabler-filled",
		]);
	});
});

/* ------------------------------------------------------------------ *
 * iconCacheKey
 * ------------------------------------------------------------------ */

describe("iconCacheKey — keyed by artwork, never by source", () => {
	it("gives Font Awesome's three styles three different keys", () => {
		const keys = FA_DATA_PACKS.map((type) => iconCacheKey(type, "star", ""));
		assert.equal(new Set(keys).size, 3);
	});

	it("gives Tabler's two styles two different keys", () => {
		const keys = TABLER_DATA_PACKS.map((type) => iconCacheKey(type, "home", ""));
		assert.equal(new Set(keys).size, 2);
	});

	it("would have collapsed those styles onto one key if given the source id", () => {
		// The mistake this exists to prevent, spelled out: all five of those
		// types answer to two source ids, so keying by `pack.id` is not a
		// near-miss — it is five drawings sharing two cache entries.
		const faSource = FA_DATA_PACKS.map((type) => packFor(icon(type))?.id);
		assert.deepStrictEqual(faSource, ["fa", "fa", "fa"]);
		const tablerSource = TABLER_DATA_PACKS.map((type) => packFor(icon(type))?.id);
		assert.deepStrictEqual(tablerSource, ["tabler", "tabler"]);
	});

	it("separates two names in one pack, and two variants of one name", () => {
		assert.notEqual(
			iconCacheKey("material", "home", "outlined|400"),
			iconCacheKey("material", "house", "outlined|400"),
		);
		assert.notEqual(
			iconCacheKey("material", "home", "outlined|400"),
			iconCacheKey("material", "home", "filled|400"),
		);
	});

	it("is stable — the same three parts always give the same key", () => {
		assert.equal(
			iconCacheKey("octicons", "alert", "16"),
			iconCacheKey("octicons", "alert", "16"),
		);
	});

	it("separates on a separator no id, name or variant contains", () => {
		// The parts are joined by a space; if one could contain a space the
		// grouping would be ambiguous and two drawings could share a key.
		for (const type of ICON_PACK_IDS) {
			assert.ok(!type.includes(" "), `${type} contains the separator`);
		}
		for (const id of ICON_SOURCE_IDS) {
			const pack = ICON_SOURCES[id];
			for (const role of CALLOUT_RENDER_ROLES) {
				const variant = pack.cacheVariant(icon("lucide"), role);
				assert.ok(!variant.includes(" "), `${id}'s variant contains the separator`);
			}
		}
	});
});

/* ------------------------------------------------------------------ *
 * cacheVariant
 * ------------------------------------------------------------------ */

describe("cacheVariant — what varies the artwork, per pack", () => {
	it("says nothing for a pack whose style is already its type", () => {
		// Font Awesome and Tabler encode the style in `icon.type`, which is
		// already part of every key — a variant would be saying it twice.
		for (const role of CALLOUT_RENDER_ROLES) {
			assert.equal(faPack.cacheVariant(icon("fa-solid"), role), "");
			assert.equal(tablerPack.cacheVariant(icon("tabler-outline"), role), "");
		}
	});

	it("carries Material's style and weight, which its type does not", () => {
		const material = ICON_SOURCES.material;
		assert.equal(
			material.cacheVariant({ type: "material", value: "home" }, "regular"),
			"outlined|400",
		);
		assert.equal(
			material.cacheVariant(
				{ type: "material", value: "home", style: "filled", weight: 700 },
				"regular",
			),
			"filled|700",
		);
	});

	it("carries the size Octicons draws for each surface", () => {
		const octicons = ICON_SOURCES.octicons;
		const alert = icon("octicons", "alert");
		assert.equal(octicons.cacheVariant(alert, "inline"), "16");
		assert.equal(octicons.cacheVariant(alert, "regular"), "24");
		assert.equal(octicons.cacheVariant(alert, "heading"), "24");
	});
});

/* ------------------------------------------------------------------ *
 * entryMatches
 * ------------------------------------------------------------------ */

describe("entryMatches — which icons a style actually draws", () => {
	const faNames = {
		solid: new Set(decodeIndex(FA_SOLID_INDEX).entries.map((e) => e.name)),
		regular: new Set(decodeIndex(FA_REGULAR_INDEX).entries.map((e) => e.name)),
		brands: new Set(decodeIndex(FA_BRANDS_INDEX).entries.map((e) => e.name)),
	} as const;
	const tablerNames = {
		outline: new Set(decodeIndex(TABLER_OUTLINE_INDEX).entries.map((e) => e.name)),
		filled: new Set(decodeIndex(TABLER_FILLED_INDEX).entries.map((e) => e.name)),
	} as const;

	const matching = async (
		pack: typeof faPack,
		variants: Parameters<NonNullable<typeof faPack.entryMatches>>[1],
	): Promise<IconEntry[]> => {
		const index = await pack.loadIndex();
		return index.entries.filter((e) => pack.entryMatches?.(e, variants) ?? true);
	};

	it("shows exactly Tabler's 1,054 filled drawings under Filled", async () => {
		// The number that makes the control worth having: showing all 5,130 names
		// under Filled would leave four cells in five empty.
		const filled = await matching(tablerPack, { tablerStyle: "filled" });
		assert.equal(filled.length, 1054);
	});

	it("shows all 5,130 names under Tabler Outline", async () => {
		const outline = await matching(tablerPack, { tablerStyle: "outline" });
		assert.equal(outline.length, 5130);
	});

	it("defaults Tabler to Outline when the toolbar has said nothing", async () => {
		assert.equal((await matching(tablerPack, {})).length, 5130);
	});

	it("lets no Tabler style show a name the other one draws alone", async () => {
		for (const style of ["outline", "filled"] as const) {
			const shown = await matching(tablerPack, { tablerStyle: style });
			assert.deepStrictEqual(
				new Set(shown.map((e) => e.name)),
				tablerNames[style],
				`${style} shows a name it has no drawing of`,
			);
		}
	});

	it("shows each Font Awesome style exactly its own icons", async () => {
		// 1,422 + 169 + 572 across 1,992 distinct names, so the three overlap —
		// which is precisely why "everything in the merged index" is the wrong
		// answer for any one style.
		const expected = { solid: 1422, regular: 169, brands: 572 } as const;
		for (const style of ["solid", "regular", "brands"] as const) {
			const shown = await matching(faPack, { faStyle: style });
			assert.equal(shown.length, expected[style], style);
			assert.deepStrictEqual(
				new Set(shown.map((e) => e.name)),
				faNames[style],
				`${style} leaked an icon from another style`,
			);
		}
	});

	it("defaults Font Awesome to Solid when the toolbar has said nothing", async () => {
		const shown = await matching(faPack, {});
		assert.deepStrictEqual(new Set(shown.map((e) => e.name)), faNames.solid);
	});

	it("merges the three Font Awesome files into 1,992 names", async () => {
		const index = await faPack.loadIndex();
		assert.equal(index.entries.length, 1992);
		assert.equal(
			new Set([...faNames.solid, ...faNames.regular, ...faNames.brands]).size,
			1992,
		);
	});

	it("gives every other source no filter at all", () => {
		// Absent means "every entry always shows" — a `() => true` here would be
		// the same answer written more expensively on every keystroke.
		for (const id of ICON_SOURCE_IDS) {
			if (id === "fa" || id === "tabler") continue;
			assert.ok(
				!("entryMatches" in ICON_SOURCES[id]),
				`${id} filters its grid for no reason`,
			);
		}
	});
});

describe("makeIcon lands on a style that actually draws the name", () => {
	it("falls back to a style that has the drawing", async () => {
		// The pooled "All sources" grid shows every name at once with no style
		// control, so a Brands-only name can be picked while Solid is selected.
		const index = await faPack.loadIndex();
		const brandsOnly = index.entries.find(
			(e) => faPack.entryMatches?.(e, { faStyle: "brands" }) &&
				!faPack.entryMatches?.(e, { faStyle: "solid" }),
		);
		assert.ok(brandsOnly, "expected at least one Brands-only name");
		assert.equal(faPack.makeIcon(brandsOnly, { faStyle: "solid" }).type, "fa-brands");
	});

	it("keeps the chosen style when it does draw the name", async () => {
		const index = await faPack.loadIndex();
		const regular = index.entries.find((e) =>
			faPack.entryMatches?.(e, { faStyle: "regular" }),
		);
		assert.ok(regular);
		assert.equal(faPack.makeIcon(regular, { faStyle: "regular" }).type, "fa-regular");
	});

	it("falls Tabler back to Outline, which draws everything", async () => {
		const index = await tablerPack.loadIndex();
		const outlineOnly = index.entries.find(
			(e) => !tablerPack.entryMatches?.(e, { tablerStyle: "filled" }),
		);
		assert.ok(outlineOnly);
		assert.equal(
			tablerPack.makeIcon(outlineOnly, { tablerStyle: "filled" }).type,
			"tabler-outline",
		);
	});

	it("reads the style back off a stored icon, for reopening the picker", () => {
		assert.equal(faStyleOf(icon("fa-brands")), "brands");
		assert.equal(faStyleOf(icon("octicons")), undefined);
		assert.equal(tablerStyleOf(icon("tabler-filled")), "filled");
		assert.equal(tablerStyleOf(icon("fa-solid")), undefined);
	});
});

/* ------------------------------------------------------------------ *
 * pickerNotice
 * ------------------------------------------------------------------ */

describe("pickerNotice — the standing note, and only where it applies", () => {
	it("raises the trademark note for Brands", () => {
		assert.equal(faPack.pickerNotice?.({ faStyle: "brands" }), "iconPack.faBrandsNotice");
	});

	it("raises nothing for the styles the note does not cover", () => {
		// The icons are CC BY; the trademark question is Brands' alone, and a
		// notice shown everywhere is a notice nobody reads.
		assert.equal(faPack.pickerNotice?.({ faStyle: "solid" }), undefined);
		assert.equal(faPack.pickerNotice?.({ faStyle: "regular" }), undefined);
	});

	it("raises nothing before a style has been chosen", () => {
		assert.equal(faPack.pickerNotice?.({}), undefined);
	});

	it("ignores another pack's variant state", () => {
		assert.equal(faPack.pickerNotice?.({ tablerStyle: "filled" }), undefined);
	});

	it("keeps the note on the attribution too, where it is always shown", () => {
		// The picker's copy is conditional; the settings credits are not.
		assert.equal(faPack.attribution.noticeKey, "iconPack.faBrandsNotice");
	});

	it("names a string that exists", () => {
		assert.ok(en["iconPack.faBrandsNotice"]);
	});

	it("gives every other source no conditional notice", () => {
		for (const id of ICON_SOURCE_IDS) {
			if (id === "fa") continue;
			assert.ok(!("pickerNotice" in ICON_SOURCES[id]), id);
		}
	});
});

/* ------------------------------------------------------------------ *
 * describeIcon
 * ------------------------------------------------------------------ */

describe("describeIcon", () => {
	const image = (over: Partial<UserImageIcon> = {}): UserImageIcon => ({
		id: "img-1",
		name: "logo.svg",
		format: "svg",
		svg: "<svg/>",
		width: 24,
		height: 24,
		monochrome: true,
		rev: 1,
		addedAt: 0,
		...over,
	});

	it("names the library and the icon", () => {
		assert.equal(describeIcon(icon("octicons", "alert"), []), "Octicons: alert");
		assert.equal(describeIcon(icon("lucide", "pencil"), []), "Lucide: pencil");
		assert.equal(
			describeIcon(icon("rpg-awesome", "acid"), []),
			"RPG Awesome: acid",
		);
	});

	it("spells out Material's style and weight, which the name does not carry", () => {
		assert.equal(
			describeIcon(
				{ type: "material", value: "home", style: "filled", weight: 700 },
				[],
			),
			"Material: home (filled, 700)",
		);
	});

	it("fills Material's defaults in when the icon omits them", () => {
		// Pre-2.0 data and imports both arrive without these, and the summary has
		// to say what will actually be fetched rather than leave a blank.
		assert.equal(
			describeIcon({ type: "material", value: "home" }, []),
			"Material: home (outlined, 400)",
		);
	});

	it("says which of Font Awesome's three styles is about to be saved", () => {
		assert.equal(
			describeIcon(icon("fa-brands", "github"), []),
			"Font Awesome: github (brands)",
		);
		assert.equal(
			describeIcon(icon("fa-solid", "star"), []),
			"Font Awesome: star (solid)",
		);
	});

	it("resolves a user's picture to the name they gave it", () => {
		assert.equal(
			describeIcon(icon("image", "img-1"), [image()]),
			"Custom Icons: logo.svg",
		);
	});

	it("falls back to the id when the picture has been deleted", () => {
		// The id is not useful, but it is honest — and it is what the row still
		// points at, so it is what has to be fixed.
		assert.equal(describeIcon(icon("image", "img-1"), []), "Custom Icons: img-1");
	});

	it("names an emoji rather than only showing it", () => {
		assert.equal(describeIcon(icon("emoji", "😀"), []), "Emoji: grinning face");
	});

	it("falls back to the glyph for an emoji it has no name for", () => {
		assert.equal(describeIcon(icon("emoji", "\u{1F9FF}\u{1F9FF}"), []),
			"Emoji: \u{1F9FF}\u{1F9FF}");
	});

	it("uses the raw type when the library is one this build does not know", () => {
		assert.equal(
			describeIcon({ type: "future-pack" as IconPackId, value: "x" }, []),
			"future-pack: x",
		);
	});

	it("says which of Tabler's two styles is about to be saved", () => {
		// The same reason Font Awesome gets a suffix: one source, one name, two
		// different drawings the picker can both produce. A summary that reads
		// the same for either is a summary that answers nothing.
		assert.equal(
			describeIcon(icon("tabler-outline", "home"), []),
			"Tabler Icons: home (outline)",
		);
		assert.equal(
			describeIcon(icon("tabler-filled", "home"), []),
			"Tabler Icons: home (filled)",
		);
	});

	it("names a style for every source that has more than one", () => {
		// The bug was one library left off the list, so the guard is the list
		// rather than the two entries on it: a source whose `dataPacks` holds
		// more than one file draws one name several ways, and the summary has to
		// say which — for a style control added later just as much as for these.
		for (const id of ICON_SOURCE_IDS) {
			const packs = ICON_SOURCES[id].dataPacks ?? [];
			if (packs.length < 2) continue;
			const described = packs.map((type) => describeIcon(icon(type, "home"), []));
			assert.equal(
				new Set(described).size,
				packs.length,
				`${id} describes two of its styles the same way: ${described.join(" / ")}`,
			);
		}
	});
});
