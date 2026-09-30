/**
 * tests/simpleIconsPack.test.ts — the brand-logo pack, and the promises made
 * about it.
 *
 * Every other downloadable library is somebody's icon set under somebody's one
 * licence. Simple Icons is thousands of other people's marks, and its licence
 * is CC0 *for the collection* while individual logos carry terms of their own —
 * upstream says so itself, and records the terms per icon. So what ships is a
 * decision made logo by logo in `scripts/generate-icon-packs.mjs`, and three
 * things are then said about the result in places a reader will take at their
 * word: that no logo under a licence the pack cannot honour is in the file, that
 * the ones under a licence it can honour are credited by name, and that no
 * outline was altered.
 *
 * None of that is visible in the file. `packs/simple-icons.json` is path data;
 * it carries no licences, and a logo that should not be there looks exactly
 * like one that should. `iconPackData.test.ts` proves the file is the one the
 * build expects and `repoGenerated.test.ts` that it is what the generator
 * writes — both of which a generator with the wrong policy passes. What follows
 * goes back to upstream's own records in `node_modules` and re-derives the
 * answer from a policy stated here a second time, so the rule and the file have
 * to agree with something other than each other.
 */
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
	PACKS_TAG,
	PACK_FORMAT,
	PACK_MANIFEST,
} from "../src/icons/data/packManifest";
import { parsePackFile, setPackData } from "../src/icons/packData";
import { simpleIconsPack } from "../src/icons/packs/simpleIcons";
import { ICON_SOURCE_IDS, getSource, packFor } from "../src/icons/registry";
import { filterIcons } from "../src/icons/search";
import { PackPanel, type PackPanelHost } from "../src/settings/iconpicker/PackPanel";
import { CALLOUT_RENDER_ROLES } from "../src/types";
import type { IconPackId } from "../src/types";
import { t } from "../src/i18n";
import { en } from "../src/i18n/en";
import { asEl, el, fakeDom } from "./support/fakeDom";
import { REPO_ROOT, readRepoFile } from "./support/sourceScan";

/** One brand, as upstream's `data/simple-icons.json` records it. */
interface UpstreamBrand {
	title: string;
	slug: string;
	source: string;
	license?: { type: string; url?: string };
}

const UPSTREAM_DIR = join(REPO_ROOT, "node_modules", "simple-icons");

const UPSTREAM = JSON.parse(
	readFileSync(join(UPSTREAM_DIR, "data", "simple-icons.json"), "utf8"),
) as UpstreamBrand[];

const UPSTREAM_VERSION = (
	JSON.parse(readFileSync(join(UPSTREAM_DIR, "package.json"), "utf8")) as {
		version: string;
	}
).version;

const BY_SLUG = new Map(UPSTREAM.map((brand) => [brand.slug, brand]));

const parsed = parsePackFile(
	JSON.parse(readRepoFile("packs/simple-icons.json")),
	"simple-icons",
	PACK_FORMAT,
);
assert.ok(parsed.ok, parsed.ok ? "" : parsed.reason);
const PACK = parsed.file;
setPackData("simple-icons", PACK);

const SHIPPED = new Set(Object.keys(PACK.icons));

const PER_LOGO_NOTICES = readRepoFile("docs/SIMPLE-ICONS-LICENSES.md");
const THIRD_PARTY_NOTICES = readRepoFile("docs/THIRD-PARTY-NOTICES.md");

/**
 * The licences a shipped logo may carry, stated independently of the generator
 * so that loosening the rule there has to be a decision made here as well.
 *
 * What they share: everything each asks of someone passing a logo on unchanged
 * is met by naming the work, naming the licence and linking both.
 */
const HONOURED = new Set([
	"CC0-1.0",
	"Unlicense",
	"Apache-2.0",
	"MPL-2.0",
	"CC-BY-2.5",
	"CC-BY-3.0",
	"CC-BY-4.0",
	"CC-BY-SA-2.0",
	"CC-BY-SA-2.5",
	"CC-BY-SA-3.0",
	"CC-BY-SA-4.0",
]);

/** The terms a downloaded pack cannot promise to meet on its users' behalf. */
function isWithheld(license: string): boolean {
	return (
		license === "custom" ||
		license === "MIT" ||
		license === "BSD-3-Clause" ||
		/-NC(?:-|$)/.test(license) ||
		/-ND(?:-|$)/.test(license) ||
		/^A?GPL-/.test(license)
	);
}

/**
 * The per-logo rows of one section of the generated notices, keyed by slug.
 *
 * A row is `| title | \`slug\` | licence | last |`, so the slug is what tells a
 * logo's row from the licence summary above it, whose second cell is a count.
 */
function tableRows(heading: string): Map<string, string[]> {
	const start = PER_LOGO_NOTICES.indexOf(`## ${heading}`);
	assert.ok(start >= 0, `the notices have no "${heading}" section`);
	const next = PER_LOGO_NOTICES.indexOf("\n## ", start + 1);
	const section = PER_LOGO_NOTICES.slice(start, next < 0 ? undefined : next);
	const rows = new Map<string, string[]>();
	for (const line of section.split("\n")) {
		const cells = line.split(" | ");
		const slug = /^`([a-z0-9_]+)`$/.exec(cells[1] ?? "")?.[1];
		if (slug) rows.set(slug, cells);
	}
	return rows;
}

/** A title as the notices print it, with the Markdown escaping taken back off. */
const unescaped = (cell: string | undefined): string =>
	(cell ?? "").replace(/\\(.)/g, "$1");

const CREDITED = tableRows("Logos shipped under their own licence");
const LEFT_OUT = tableRows("Logos left out");

/* ------------------------------------------------------------------ *
 * What is in the file
 * ------------------------------------------------------------------ */

describe("the Simple Icons pack holds only logos whose licence it can honour", () => {
	it("is built from the upstream release it says it is", () => {
		assert.equal(PACK.packVersion, UPSTREAM_VERSION);
		assert.equal(PACK_MANIFEST["simple-icons"]?.version, UPSTREAM_VERSION);
	});

	it("holds no logo upstream does not have", () => {
		const strangers = [...SHIPPED].filter((slug) => !BY_SLUG.has(slug));
		assert.deepStrictEqual(strangers, []);
	});

	it("holds no non-commercial, no-derivatives, GPL-family or brand-specific logo", () => {
		const offenders = UPSTREAM.filter(
			(brand) =>
				brand.license && isWithheld(brand.license.type) && SHIPPED.has(brand.slug),
		).map((brand) => `${brand.slug} (${brand.license?.type})`);
		assert.deepStrictEqual(offenders, []);
	});

	it("holds no logo under a licence nobody has read", () => {
		// The case the generator throws on. Asserted here too because the throw
		// protects the *next* regeneration, and this protects the file as
		// committed — including from a rule widened to get past the throw.
		const unread = UPSTREAM.filter(
			(brand) =>
				brand.license && SHIPPED.has(brand.slug) && !HONOURED.has(brand.license.type),
		).map((brand) => `${brand.slug} (${brand.license?.type})`);
		assert.deepStrictEqual(unread, []);
	});

	it("puts every licence upstream uses on exactly one side of the line", () => {
		// A licence both honoured and withheld would be shipped or not depending
		// on the order two checks happen to run in.
		const types = new Set(
			UPSTREAM.flatMap((brand) => (brand.license ? [brand.license.type] : [])),
		);
		for (const type of types) {
			assert.notEqual(
				HONOURED.has(type),
				isWithheld(type),
				`"${type}" is on ${HONOURED.has(type) ? "both sides" : "neither side"}`,
			);
		}
		assert.ok(types.size > 10, "upstream records almost no licences — wrong file?");
	});

	it("leaves out nothing it does not account for", () => {
		// The other direction: a logo that quietly went missing is a defect too.
		// Whatever is absent has to be in the notices' own list, with a reason.
		const absent = UPSTREAM.map((brand) => brand.slug).filter((slug) => !SHIPPED.has(slug));
		assert.deepStrictEqual(absent.sort(), [...LEFT_OUT.keys()].sort());
		for (const slug of absent) {
			const license = BY_SLUG.get(slug)?.license?.type;
			const reason = LEFT_OUT.get(slug)?.[3] ?? "";
			if (license && isWithheld(license)) continue;
			assert.match(
				reason,
				/withdrawn at the owner's request/,
				`${slug} is left out with no licence reason and no withdrawal`,
			);
		}
	});

	it("still ships the overwhelming majority of the set", () => {
		// A guard on the guards: a policy that kept everything out would satisfy
		// every assertion above.
		assert.ok(SHIPPED.size > UPSTREAM.length * 0.95, `only ${SHIPPED.size} logos`);
		assert.equal(SHIPPED.size, PACK_MANIFEST["simple-icons"]?.iconCount);
	});
});

describe("no logo's outline is altered", () => {
	it("carries each path exactly as upstream publishes it", () => {
		// The claim made in the credits and in both notices files, and the one a
		// brand cares about most: a logo redrawn, even by a rounding, is no longer
		// the brand's logo. Byte for byte, all of them.
		const altered: string[] = [];
		for (const slug of SHIPPED) {
			const svg = readFileSync(join(UPSTREAM_DIR, "icons", `${slug}.svg`), "utf8");
			const upstream = /<path d="([^"]*)"\/>/.exec(svg)?.[1];
			if (PACK.icons[slug]?.["24"]?.p[0]?.d !== upstream) altered.push(slug);
		}
		assert.deepStrictEqual(altered, []);
	});

	it("draws every logo as one path on the one 24-unit square", () => {
		for (const [slug, sizes] of Object.entries(PACK.icons)) {
			assert.deepStrictEqual(Object.keys(sizes), ["24"], slug);
			const drawing = sizes["24"];
			assert.equal(drawing?.w, 24, slug);
			assert.equal(drawing?.p.length, 1, slug);
			assert.deepStrictEqual(Object.keys(drawing?.p[0] ?? {}), ["d"], slug);
		}
	});
});

/* ------------------------------------------------------------------ *
 * What is said about it
 * ------------------------------------------------------------------ */

describe("every logo with a licence of its own is credited by name", () => {
	const licensed = UPSTREAM.filter(
		(brand) => brand.license && SHIPPED.has(brand.slug),
	);

	it("credits exactly the licensed logos the pack holds", () => {
		assert.ok(licensed.length > 100, `only ${licensed.length} licensed logos`);
		assert.deepStrictEqual(
			[...CREDITED.keys()].sort(),
			licensed.map((brand) => brand.slug).sort(),
		);
	});

	it("names each one's owner, licence and source as upstream records them", () => {
		for (const brand of licensed) {
			const cells = CREDITED.get(brand.slug) ?? [];
			const where = `the row for ${brand.slug}`;
			assert.ok(
				unescaped(cells[0]).includes(brand.title),
				`${where} does not name ${brand.title}`,
			);
			assert.ok(
				cells[2]?.startsWith(`[${brand.license?.type}](`),
				`${where} names the wrong licence: ${cells[2]}`,
			);
			assert.ok(
				cells[3]?.includes(`(<${brand.source}>)`),
				`${where} does not link ${brand.source}`,
			);
		}
	});

	it("carries the words of each licence that asks for them to travel with the work", () => {
		// A link satisfies the Creative Commons licences and MPL, which say so.
		// Apache wants its prescribed notice — so a logo under one of those is only
		// credited properly while its licence's text is in the same file.
		const clauses: Record<string, string> = {
			"Apache-2.0": "http://www.apache.org/licenses/LICENSE-2.0",
		};
		const flat = PER_LOGO_NOTICES.replace(/\s+/g, " ");
		const inUse = new Set(licensed.map((brand) => brand.license?.type));
		for (const [license, clause] of Object.entries(clauses)) {
			assert.ok(inUse.has(license), `no shipped logo is ${license} — drop it from this test`);
			assert.ok(flat.includes(clause), `the ${license} text is missing from the notices`);
		}
	});

	it("says which upstream release it describes", () => {
		assert.ok(PER_LOGO_NOTICES.includes(`\`simple-icons\` ${UPSTREAM_VERSION}`));
	});

	it("is reachable from the notices file the plugin links to", () => {
		// The settings credits and the README both send a reader to
		// THIRD-PARTY-NOTICES.md; the per-logo list is only a credit if that
		// page names the same release and leads on to it.
		assert.ok(
			THIRD_PARTY_NOTICES.includes(`## Simple Icons ${UPSTREAM_VERSION}`),
			"THIRD-PARTY-NOTICES.md has no section for this Simple Icons release",
		);
		assert.ok(THIRD_PARTY_NOTICES.includes("(SIMPLE-ICONS-LICENSES.md)"));
	});
});

describe("the source as the picker and the credits present it", () => {
	const { attribution } = simpleIconsPack;

	it("is one downloadable file behind one source", () => {
		assert.equal(simpleIconsPack.kind, "bundledRemote");
		assert.deepStrictEqual([...(simpleIconsPack.dataPacks ?? [])], ["simple-icons"]);
		assert.equal(packFor({ type: "simple-icons", value: "github" }), simpleIconsPack);
	});

	it("credits the collection under CC0 and the release the file was built from", () => {
		assert.equal(attribution.version, UPSTREAM_VERSION);
		assert.equal(attribution.licenses[0]?.spdx, "CC0-1.0");
	});

	it("links the per-logo credits at the tag the pack file is served from", () => {
		// Pinned to that tag rather than to the default branch: at the tag the
		// list and the file were generated together, so they describe each other
		// whatever a later refresh adds or drops.
		const perLogo = attribution.licenses[1];
		assert.ok(perLogo, "the credits no longer link the per-logo licences");
		assert.ok(
			perLogo.url.endsWith(`/blob/${PACKS_TAG}/docs/SIMPLE-ICONS-LICENSES.md`),
			perLogo.url,
		);
	});

	it("keeps the trademark notice up for the whole source, always", () => {
		// Font Awesome's applies to one style and is conditional. Here every
		// icon is somebody's mark, so there is no toolbar state it could be off in.
		assert.equal(attribution.noticeKey, "iconPack.simpleIconsNotice");
		assert.ok(!("pickerNotice" in simpleIconsPack));
		assert.match(en["iconPack.simpleIconsNotice"] ?? "", /trademarks/);
		assert.match(en["iconPack.simpleIconsNotice"] ?? "", /endorsement/);
	});

	it("has a label, a description and a search prompt that exist", () => {
		assert.equal(en[simpleIconsPack.labelKey], "Simple Icons");
		assert.ok(en[simpleIconsPack.descriptionKey]);
		assert.ok(en[simpleIconsPack.searchPlaceholderKey]);
	});

	it("stores a logo under upstream's slug and one cache entry", () => {
		const icon = simpleIconsPack.makeIcon(
			{ name: "nodedotjs", categories: [], keywords: [] },
			{},
		);
		assert.deepStrictEqual(icon, { type: "simple-icons", value: "nodedotjs" });
		for (const role of CALLOUT_RENDER_ROLES) {
			assert.equal(simpleIconsPack.cacheVariant(icon, role), "");
		}
	});

	it("draws a logo with no paint of its own, so it takes the callout's colour", () => {
		const svg = simpleIconsPack.buildSvg?.(
			{ type: "simple-icons", value: "github" },
			"regular",
		);
		assert.ok(svg?.startsWith(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">`));
		assert.ok(!svg?.includes("fill="), svg?.slice(0, 120));
		assert.ok(!svg?.includes("stroke="), svg?.slice(0, 120));
	});

	it("draws nothing for a logo that was left out", () => {
		const leftOut = [...LEFT_OUT.keys()][0];
		assert.ok(leftOut, "nothing is left out — the policy is not being applied");
		assert.equal(
			simpleIconsPack.buildSvg?.({ type: "simple-icons", value: leftOut }, "regular"),
			null,
		);
	});
});

describe("the picker panel, before the pack is on the device", () => {
	/** A panel whose pack store has the manifest but no file. */
	async function mount(): Promise<{
		container: ReturnType<typeof el>;
		downloads: IconPackId[];
		dispose: () => void;
	}> {
		fakeDom.light();
		const container = el();
		const downloads: IconPackId[] = [];
		const host = {
			packs: {
				state: () => "unavailable",
				info: (id: IconPackId) => PACK_MANIFEST[id],
				download: async (id: IconPackId) => {
					downloads.push(id);
					return false;
				},
			},
			variantsFor: () => ({}),
			saveVariants: () => {},
			lastCategoryFor: () => "",
			saveCategory: () => {},
			selectedIcon: () => null,
			onSelect: () => {},
		} as unknown as PackPanelHost;
		const panel = new PackPanel(asEl(container), simpleIconsPack, host);
		await panel.render();
		return { container, downloads, dispose: () => panel.dispose() };
	}

	it("asks first, and says how many logos and how many megabytes", async () => {
		// The largest download the plugin offers, four times the next one. The
		// number is the manifest's, so the prompt cannot understate the file.
		const h = await mount();
		try {
			assert.deepStrictEqual(h.downloads, [], "opening the source fetched something");
			assert.equal(
				h.container.querySelector(".icon-picker-notice-title")?.textContent,
				t("iconPack.downloadTitle", { name: "Simple Icons" }),
			);
			assert.equal(
				h.container.querySelector(".icon-picker-notice-detail")?.textContent,
				t("iconPack.downloadDetail", {
					count: String(PACK_MANIFEST["simple-icons"]?.iconCount),
					size: "4.4 MB",
				}),
			);
			assert.equal(h.container.querySelector(".icon-picker-search-input")?.disabled, true);
		} finally {
			h.dispose();
		}
	});

	it("shows the trademark notice and the credit before anything is downloaded", async () => {
		// Read before the choice to download is made, not discovered after it.
		const h = await mount();
		try {
			const notice = h.container.querySelector(".icon-picker-pack-notice");
			assert.equal(notice?.textContent, en["iconPack.simpleIconsNotice"]);
			assert.equal(notice?.hasClass("is-hidden"), false);

			const credit = h.container.querySelector(".icon-picker-pack-credit");
			assert.ok(
				credit?.textContent.includes("Simple Icons — CC0-1.0, various"),
				credit?.textContent,
			);
			assert.equal(
				credit?.querySelector("a")?.getAttribute("href"),
				"https://simpleicons.org",
			);
		} finally {
			h.dispose();
		}
	});
});

describe("every downloadable source credits the release its file was built from", () => {
	it("names the version its manifest entries name", () => {
		// The credit is typed into each pack module and the manifest is pasted
		// from the generator, so a refresh has two places to update and nothing
		// but this to notice when only one was.
		let checked = 0;
		for (const id of ICON_SOURCE_IDS) {
			const source = getSource(id);
			for (const type of source.dataPacks ?? []) {
				assert.equal(
					source.attribution.version,
					PACK_MANIFEST[type]?.version,
					`${id} credits a different release than ${type}.json was built from`,
				);
				checked++;
			}
		}
		assert.equal(checked, Object.keys(PACK_MANIFEST).length);
	});
});

/* ------------------------------------------------------------------ *
 * Finding a logo
 * ------------------------------------------------------------------ */

describe("a brand is found by the names people actually type", () => {
	const find = async (query: string): Promise<string[]> => {
		const index = await simpleIconsPack.loadIndex();
		return filterIcons(index, query).map((entry) => entry.name);
	};

	it("indexes exactly the logos the pack file can draw", async () => {
		const index = await simpleIconsPack.loadIndex();
		assert.deepStrictEqual(
			index.entries.map((entry) => entry.name).sort(),
			[...SHIPPED].sort(),
		);
	});

	it("offers no logo that was left out", async () => {
		const index = await simpleIconsPack.loadIndex();
		const names = new Set(index.entries.map((entry) => entry.name));
		for (const slug of LEFT_OUT.keys()) assert.ok(!names.has(slug), slug);
	});

	it("puts a slug typed exactly first", async () => {
		assert.equal((await find("github"))[0], "github");
	});

	it("answers to a title whose punctuation the slug spells out", async () => {
		// `nodedotjs` is upstream's id for Node.js. Nobody types that.
		assert.ok((await find("node.js")).includes("nodedotjs"));
		assert.ok((await find("nodejs")).includes("nodedotjs"));
		assert.ok((await find("node js")).includes("nodedotjs"));
		assert.ok((await find("at&t")).includes("atandt"));
		assert.ok((await find("c++")).includes("cplusplus"));
	});

	it("answers to a brand's other names", async () => {
		// Upstream's aliases: X is still looked for as Twitter.
		assert.ok((await find("twitter")).includes("x"));
	});

	it("keeps a title only where it says something the slug does not", async () => {
		const index = await simpleIconsPack.loadIndex();
		const labelOf = (name: string) =>
			index.entries.find((entry) => entry.name === name)?.label;
		assert.equal(labelOf("nodedotjs"), "Node.js");
		assert.equal(labelOf("atandt"), "AT&T");
		// "GitHub" is `github` in capitals, which the search ignores anyway.
		assert.equal(labelOf("github"), undefined);
	});

	it("has no categories to filter by", async () => {
		assert.equal(simpleIconsPack.hasCategories, false);
		assert.deepStrictEqual((await simpleIconsPack.loadIndex()).categories, []);
	});
});
