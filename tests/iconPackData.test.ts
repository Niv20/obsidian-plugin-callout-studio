/**
 * tests/iconPackData.test.ts — downloaded pack artwork: what is accepted, what
 * is drawn from it, and whether the files in `packs/` still are the files this
 * build expects.
 *
 * Three things meet here, and the first is the reason the other two are safe.
 *
 * **`parsePackFile` is the whole sanitizer.** Pack files skip SVG sanitization
 * entirely — there is no `sanitizePackFile` to call — and that is defensible for
 * exactly one reason: the file has no elements and no attributes, only `d`
 * strings and 1s, and every `d` is checked against a path grammar with no
 * character in it that could open an element, a quote or a URL. Which makes this
 * check the security boundary for every downloaded megabyte, and the rejection
 * cases below the test that says so. It is a table and a loop rather than the
 * grammar's own expression — a pack is megabytes of path data, checked on every
 * load — so the cases below also hold it to that expression, character for
 * character. Rejection is whole-file on the first bad
 * path, never per-icon: a file that fails this is corrupt or is not what it
 * claims to be, and neither is something to render around.
 *
 * **`buildPackSvg` is the only place that markup gets built**, by string
 * concatenation with no escaping — which is only sound because of the above.
 * The stroked branch is Tabler's: an outline is defined by the ink it
 * *withholds*, so the root has to say `fill="none"` and stroke in `currentColor`
 * while individual glyphs opt back in (`f`) or out (`n`). None of that is in the
 * downloaded file; it is declared in `packs/tabler.ts`, in our own source. That
 * separation is what keeps the file free of anything but path data, so it is
 * asserted from both ends — the paint appears in the output, and the word
 * "stroke" appears nowhere in the file as anything but an icon's name.
 *
 * **The checksums** are the same contract `locales.test.ts` keeps for
 * translations: `packManifest.ts` is compiled into the build, `PackDataStore`
 * refuses any file that does not match it byte for byte, and jsDelivr caches a
 * tag permanently. So a `packs/` file edited without a new tag and new checksums
 * does not degrade — every download of it fails, on every device, forever.
 */
import assert from "node:assert";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
	buildPackSvg,
	getPackData,
	isPackLoaded,
	parsePackFile,
	pickSizeKey,
	setPackData,
	type PackFile,
	type PackStroke,
} from "../src/icons/packData";
import {
	PACKS_TAG,
	PACK_FORMAT,
	PACK_MANIFEST,
	packUrls,
} from "../src/icons/data/packManifest";
import type { IconPackId } from "../src/types";
import { tablerPack } from "../src/icons/packs/tabler";
import { octiconsPack } from "../src/icons/packs/octicons";
import { faPack } from "../src/icons/packs/fontAwesome";

const PACKS_DIR = join(process.cwd(), "packs");

const readPack = (id: IconPackId): string =>
	readFileSync(join(PACKS_DIR, `${id}.json`), "utf8");

/**
 * Load the packs whose artwork the drawing tests need, out of the real files.
 *
 * `packData`'s store is module-level and has no eviction, so which packs are
 * loaded is a property of this whole file: `tabler-*` and `octicons` are in,
 * and `fa-brands` is deliberately left out so the "not downloaded yet" branch
 * has something honest to answer for.
 */
for (const id of ["tabler-outline", "tabler-filled", "octicons"] as const) {
	const result = parsePackFile(JSON.parse(readPack(id)), id, PACK_FORMAT);
	assert.ok(result.ok, `packs/${id}.json did not parse: ${JSON.stringify(result)}`);
	setPackData(id, result.file);
}

/** A minimal well-formed pack file, as a starting point to break. */
function packFile(over: Partial<PackFile> = {}): unknown {
	return {
		format: PACK_FORMAT,
		pack: "octicons",
		packVersion: "1.0.0",
		icons: { alert: { "16": { w: 16, p: [{ d: "M1 1L2 2Z" }] } } },
		...over,
	};
}

/* ------------------------------------------------------------------ *
 * parsePackFile
 * ------------------------------------------------------------------ */

describe("parsePackFile — what a pack file has to be", () => {
	const reject = (raw: unknown, id: IconPackId = "octicons"): string => {
		const result = parsePackFile(raw, id, PACK_FORMAT);
		assert.equal(result.ok, false, "expected this file to be rejected");
		return result.ok ? "" : result.reason;
	};

	it("accepts a well-formed file", () => {
		const result = parsePackFile(packFile(), "octicons", PACK_FORMAT);
		assert.ok(result.ok);
		assert.equal(result.file.pack, "octicons");
	});

	it("refuses anything that is not an object", () => {
		for (const junk of [null, undefined, 42, "{}", true, []]) {
			// An array is an object to `typeof`, so it survives the first gate and
			// is caught by the missing `icons` instead — either way it is refused.
			assert.equal(parsePackFile(junk, "octicons", PACK_FORMAT).ok, false);
		}
	});

	it("refuses a file written in another format version", () => {
		// Bumping PACK_FORMAT is how a cached file in the old shape is forced to
		// be re-downloaded rather than misread.
		assert.match(reject(packFile({ format: 99 })), /format 99 != 1/);
		assert.match(reject(packFile({ format: undefined })), /format undefined/);
	});

	it("refuses a file that claims to be a different pack", () => {
		// Which is what stops a mis-served or mis-copied response from landing in
		// another library's slot and orphaning everything cached under it.
		assert.match(reject(packFile({ pack: "fa-solid" })), /"fa-solid" != "octicons"/);
	});

	it("refuses a file with no icons in it", () => {
		assert.match(reject(packFile({ icons: undefined })), /missing icons/);
		assert.match(reject(packFile({ icons: null as never })), /missing icons/);
		assert.match(reject(packFile({ icons: {} })), /no icons/);
	});

	it("refuses a drawing with no usable geometry", () => {
		assert.match(
			reject(packFile({ icons: { alert: null as never } })),
			/bad record for "alert"/,
		);
		assert.match(
			reject(packFile({ icons: { alert: { "16": { w: "16", p: [{ d: "M1 1" }] } } } as never })),
			/bad drawing for "alert@16"/,
		);
		assert.match(
			reject(packFile({ icons: { alert: { "16": { w: Number.NaN, p: [{ d: "M1 1" }] } } } as never })),
			/bad drawing for "alert@16"/,
		);
		assert.match(
			reject(packFile({ icons: { alert: { "16": { w: 16, p: [] } } } })),
			/bad drawing for "alert@16"/,
		);
		assert.match(
			reject(packFile({ icons: { alert: { "16": { w: 16, p: "M1 1" } } } as never })),
			/bad drawing for "alert@16"/,
		);
	});

	it("refuses path data outside the grammar — the security boundary", () => {
		// `d` is the only free-form string in the file and it goes into an
		// attribute unescaped, so every character that could end that attribute,
		// open an element or name a URL has to be unrepresentable here.
		const hostile = [
			`M1 1"/><script>alert(1)</script><path d="`,
			"M1 1Z</path><script>",
			"url(javascript:alert(1))",
			"M1 1 #fff",
			"M1 1 &#x3c;",
			"M1 1'",
			"M1 1`",
			"M1 1;",
			"M1 1{}",
			"M1 1\\",
			"data:text/html,<b>",
		];
		for (const d of hostile) {
			assert.match(
				reject(packFile({ icons: { alert: { "16": { w: 16, p: [{ d }] } } } })),
				/bad path data/,
				`accepted ${JSON.stringify(d)}`,
			);
		}
	});

	it("refuses an empty or missing path string", () => {
		assert.match(
			reject(packFile({ icons: { alert: { "16": { w: 16, p: [{ d: "" }] } } } })),
			/bad path data/,
		);
		assert.match(
			reject(packFile({ icons: { alert: { "16": { w: 16, p: [{} as never] } } } })),
			/bad path data/,
		);
	});

	it("accepts the whole path grammar and nothing beyond it", () => {
		const legal = "M1.5-2e3 mLlHhVvCcSsQqTtAaZz 0,0 +1.5 \t\n";
		const result = parsePackFile(
			packFile({ icons: { alert: { "16": { w: 16, p: [{ d: legal }] } } } }),
			"octicons",
			PACK_FORMAT,
		);
		assert.ok(result.ok);
	});

	/** The grammar as the generator states it, and as `packData.ts` quotes it. */
	const GRAMMAR = /^[MmLlHhVvCcSsQqTtAaZz0-9eE+\-.,\s]+$/;

	const accepts = (d: string): boolean =>
		parsePackFile(
			packFile({ icons: { alert: { "16": { w: 16, p: [{ d }] } } } }),
			"octicons",
			PACK_FORMAT,
		).ok;

	it("agrees with the grammar's own expression on every character there is", () => {
		// The check is a lookup table and a loop, for speed, so its claim to be
		// "the same grammar" is only as good as this. A path is accepted exactly
		// when each of its characters is, independently of the others — which
		// makes the one-character strings the whole input space, and all 65,536
		// code units cheap enough to ask about rather than sample.
		const disagreements: string[] = [];
		for (let code = 0; code <= 0xffff; code++) {
			const d = String.fromCharCode(code);
			if (accepts(d) !== GRAMMAR.test(d)) {
				disagreements.push(`U+${code.toString(16).padStart(4, "0")}`);
			}
		}
		assert.deepStrictEqual(disagreements, []);
	});

	it("checks the last character of a path as carefully as the first", () => {
		// What the exhaustive test above cannot see: a loop that stops one short.
		const legal = "M1 1L2 2Z".repeat(200);
		assert.equal(accepts(legal), true);
		for (const hostile of ['"', "<", ">", "&", "#", "\u0000"]) {
			assert.equal(accepts(hostile + legal), false, `leading ${JSON.stringify(hostile)}`);
			assert.equal(accepts(legal + hostile), false, `trailing ${JSON.stringify(hostile)}`);
			assert.equal(
				accepts(legal + hostile + legal),
				false,
				`embedded ${JSON.stringify(hostile)}`,
			);
		}
	});

	it("is the grammar the generator holds every path to at build time", () => {
		// Two halves of one promise — "checked when the file is built and again
		// when it is loaded" — kept in two languages. The expression is quoted
		// here a third time so that editing either half alone fails something.
		const generator = readFileSync(
			join(process.cwd(), "scripts", "generate-icon-packs.mjs"),
			"utf8",
		);
		assert.ok(
			generator.includes(`const PATH_DATA_RE = ${String(GRAMMAR)};`),
			"scripts/generate-icon-packs.mjs no longer declares this grammar",
		);
	});

	it("rejects the whole file on the first bad path, not just that icon", () => {
		// A file that fails this check is corrupt or is not what it claims to be;
		// rendering the good half of it would be rendering half of something
		// unknown.
		const result = parsePackFile(
			packFile({
				icons: {
					good: { "16": { w: 16, p: [{ d: "M1 1Z" }] } },
					bad: { "16": { w: 16, p: [{ d: "<script/>" }] } },
				},
			}),
			"octicons",
			PACK_FORMAT,
		);
		assert.equal(result.ok, false);
	});
});

/* ------------------------------------------------------------------ *
 * pickSizeKey
 * ------------------------------------------------------------------ */

describe("pickSizeKey", () => {
	it("takes the first preference the icon actually has", () => {
		assert.equal(pickSizeKey(["16", "24"], ["24", "16"]), "24");
		assert.equal(pickSizeKey(["16", "24"], ["16", "24"]), "16");
	});

	it("skips a preference the icon does not draw", () => {
		assert.equal(pickSizeKey(["16"], ["24", "16"]), "16");
	});

	it("falls back to whatever the icon does have", () => {
		// Octicons draws nine icons at 12px only and `bookmark-fill` at 24px
		// only; a strict lookup would render nothing at all for them.
		assert.equal(pickSizeKey(["12"], ["16", "24"]), "12");
	});

	it("returns null only when there is nothing to choose from", () => {
		assert.equal(pickSizeKey([], ["16"]), null);
		assert.equal(pickSizeKey([], []), null);
	});

	it("falls back even when no preference was expressed", () => {
		assert.equal(pickSizeKey(["96"], []), "96");
	});
});

/* ------------------------------------------------------------------ *
 * buildPackSvg
 * ------------------------------------------------------------------ */

describe("buildPackSvg — solid artwork", () => {
	it("draws nothing for a pack that has not been loaded this session", () => {
		assert.equal(isPackLoaded("fa-brands"), false);
		assert.equal(buildPackSvg("fa-brands", "github", ["512"]), null);
		assert.equal(getPackData("fa-brands"), null);
	});

	it("draws nothing for a name the pack does not hold", () => {
		assert.equal(buildPackSvg("octicons", "no-such-icon", ["24"]), null);
	});

	it("takes the viewBox height from the size key and the width from `w`", () => {
		const svg = buildPackSvg("octicons", "alert", ["16"]);
		assert.ok(svg?.startsWith(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"`));
	});

	it("declares no paint at all, so the caller decides the colour", () => {
		// A solid pack's glyph takes `fill="currentColor"` on screen and a baked
		// literal for PDF export; baking one in here would pin it to a theme.
		const svg = buildPackSvg("octicons", "alert", ["24"]) ?? "";
		assert.ok(!svg.includes("fill="), svg.slice(0, 120));
		assert.ok(!svg.includes("stroke="), svg.slice(0, 120));
	});

	it("emits the even-odd rules only for the paths that carry them", () => {
		setPackData("rpg-awesome", {
			format: PACK_FORMAT,
			pack: "rpg-awesome",
			packVersion: "test",
			icons: {
				holes: {
					"24": {
						w: 24,
						p: [{ d: "M0 0Z", r: 1 }, { d: "M1 1Z", c: 1 }, { d: "M2 2Z" }],
					},
				},
			},
		});
		const svg = buildPackSvg("rpg-awesome", "holes", ["24"]) ?? "";
		assert.ok(svg.includes(`<path d="M0 0Z" fill-rule="evenodd"/>`));
		assert.ok(svg.includes(`<path d="M1 1Z" clip-rule="evenodd"/>`));
		assert.ok(svg.includes(`<path d="M2 2Z"/>`));
	});

	it("ignores the stroke-only flags when the pack is not stroked", () => {
		// `f` and `n` mean "fill this one anyway" and "leave this one unstroked",
		// and in a solid pack the root fills nothing either — so a per-path
		// override would have nothing to say.
		setPackData("rpg-awesome", {
			format: PACK_FORMAT,
			pack: "rpg-awesome",
			packVersion: "test",
			icons: { flags: { "24": { w: 24, p: [{ d: "M0 0Z", f: 1, n: 1 }] } } },
		});
		assert.equal(
			buildPackSvg("rpg-awesome", "flags", ["24"]),
			`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0Z"/></svg>`,
		);
	});
});

describe("buildPackSvg — stroked artwork (Tabler Outline)", () => {
	const STROKE: PackStroke = { width: 2, linecap: "round", linejoin: "round" };

	it("declares fill:none and strokes in currentColor on the root", () => {
		// The whole definition of an outline: without `fill="none"` the shape
		// floods solid, and without `currentColor` it cannot follow the callout.
		const svg = buildPackSvg("tabler-outline", "dice-3", ["24"], STROKE) ?? "";
		assert.ok(
			svg.startsWith(
				`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"` +
					` fill="none" stroke="currentColor" stroke-width="2"` +
					` stroke-linecap="round" stroke-linejoin="round">`,
			),
			svg.slice(0, 200),
		);
	});

	it("fills the pips of dice-3 back in, which `f` is for", () => {
		// Tabler draws the pips on `dice-3` and the eyes on `brand-reddit` as
		// solids inside an outline; without `f` they come out as three rings.
		const svg = buildPackSvg("tabler-outline", "dice-3", ["24"], STROKE) ?? "";
		assert.ok(svg.includes(`fill="currentColor"`), "no pip was filled");
		assert.equal(
			(svg.match(/fill="currentColor"/g) ?? []).length,
			3,
			"dice-3 has three pips",
		);
	});

	it("draws the very same icon with no paint when the stroke is withheld", () => {
		// The paint is entirely the caller's, which is what proves it is not in
		// the file: same pack, same name, no PackStroke, no attributes.
		const bare = buildPackSvg("tabler-outline", "dice-3", ["24"]) ?? "";
		assert.ok(!bare.includes("stroke"), bare.slice(0, 160));
		assert.ok(!bare.includes("fill"), bare.slice(0, 160));
	});

	it("lets a path opt out of the stroke with `n`", () => {
		setPackData("fa-solid", {
			format: PACK_FORMAT,
			pack: "fa-solid",
			packVersion: "test",
			icons: { mix: { "24": { w: 24, p: [{ d: "M0 0Z", n: 1 }, { d: "M1 1Z", f: 1 }] } } },
		});
		const svg = buildPackSvg("fa-solid", "mix", ["24"], STROKE) ?? "";
		assert.ok(svg.includes(`<path d="M0 0Z" stroke="none"/>`));
		assert.ok(svg.includes(`<path d="M1 1Z" fill="currentColor"/>`));
	});

	it("draws Tabler Filled with no stroke at all", () => {
		// Filled is ordinary solid artwork; only Outline passes a PackStroke.
		const svg = tablerPack.buildSvg?.({ type: "tabler-filled", value: "accessible" }, "regular") ?? "";
		assert.ok(svg.length > 0);
		assert.ok(!svg.includes("stroke"), svg.slice(0, 160));
		assert.ok(!svg.includes(`fill="none"`), svg.slice(0, 160));
	});

	it("routes Tabler Outline through the stroked branch", () => {
		const svg = tablerPack.buildSvg?.({ type: "tabler-outline", value: "dice-3" }, "regular") ?? "";
		assert.ok(svg.includes(`stroke="currentColor"`));
		assert.ok(svg.includes(`stroke-width="2"`));
	});

	it("refuses to aim a pack's builder at another pack's file", () => {
		// Hand-edited data.json is the case: without the guard, `tabler-outline`
		// styling would be applied to whatever file the type named.
		assert.equal(
			tablerPack.buildSvg?.({ type: "octicons", value: "alert" }, "regular"),
			null,
		);
		assert.equal(
			faPack.buildSvg?.({ type: "tabler-outline", value: "dice-3" }, "regular"),
			null,
		);
	});
});

describe("buildPackSvg — Octicons picks a drawing per surface", () => {
	it("draws the 16px art inline and the 24px art everywhere else", () => {
		const inline = octiconsPack.buildSvg?.({ type: "octicons", value: "alert" }, "inline");
		const block = octiconsPack.buildSvg?.({ type: "octicons", value: "alert" }, "regular");
		assert.ok(inline?.includes(`viewBox="0 0 16 16"`), inline?.slice(0, 80));
		assert.ok(block?.includes(`viewBox="0 0 24 24"`), block?.slice(0, 80));
		assert.notEqual(inline, block, "these are different drawings, not one scaled");
	});

	it("still draws an icon that exists at one odd size only", () => {
		// `no-entry-fill` is 12px-only and `bookmark-fill` 24px-only; a strict
		// preference would leave both blank on some surface.
		for (const role of ["inline", "regular", "heading"] as const) {
			for (const name of ["no-entry-fill", "bookmark-fill"]) {
				assert.ok(
					octiconsPack.buildSvg?.({ type: "octicons", value: name }, role),
					`${name} drew nothing for ${role}`,
				);
			}
		}
	});

	it("keys the cache by the size asked for, not the size drawn", () => {
		// The key has to be computable before the pack data is present — its
		// whole job is to find artwork saved in data.json on a device that never
		// downloaded the pack.
		const odd = { type: "octicons" as const, value: "no-entry-fill" };
		assert.equal(octiconsPack.cacheVariant(odd, "inline"), "16");
		assert.ok(
			octiconsPack.buildSvg?.(odd, "inline")?.includes(`viewBox="0 0 12 12"`),
			"the 12px drawing is what actually exists",
		);
	});
});

/* ------------------------------------------------------------------ *
 * packs/ vs. the compiled manifest
 * ------------------------------------------------------------------ */

describe("packs/ matches the manifest compiled into the build", () => {
	const manifestIds = (Object.keys(PACK_MANIFEST) as IconPackId[]).sort();

	it("has a file for every manifest entry and vice versa", () => {
		const files = readdirSync(PACKS_DIR)
			.filter((f) => f.endsWith(".json"))
			.map((f) => f.slice(0, -5))
			.sort();
		assert.deepStrictEqual(files, manifestIds);
		assert.ok(files.length > 0, "no pack files are committed");
	});

	for (const id of manifestIds) {
		const expected = PACK_MANIFEST[id];
		assert.ok(expected);

		it(`${id}.json is byte-for-byte what the build expects`, () => {
			// PackDataStore checks both of these on download AND on every read
			// from disk, so a drifted file is not a degraded pack — it is a pack
			// that can never load again, on any device.
			const raw = readFileSync(join(PACKS_DIR, `${id}.json`));
			assert.strictEqual(
				raw.byteLength,
				expected.bytes,
				"size drifted — regenerate, push a NEW packs tag, and update packManifest.ts",
			);
			assert.strictEqual(
				createHash("sha256").update(raw).digest("hex"),
				expected.sha256,
				"checksum drifted — regenerate, push a NEW packs tag, and update packManifest.ts",
			);
		});

		it(`${id}.json carries the shape the runtime accepts`, () => {
			const result = parsePackFile(
				JSON.parse(readPack(id)),
				id,
				PACK_FORMAT,
			);
			assert.ok(result.ok, result.ok ? "" : result.reason);
			assert.equal(result.file.pack, id);
			assert.equal(result.file.format, PACK_FORMAT);
		});

		it(`${id}.json holds the ${expected.iconCount} icons the manifest promises`, () => {
			// The download prompt shows this number before anything is fetched.
			const result = parsePackFile(JSON.parse(readPack(id)), id, PACK_FORMAT);
			assert.ok(result.ok);
			assert.equal(Object.keys(result.file.icons).length, expected.iconCount);
		});

		it(`${id}.json says which upstream release it came from`, () => {
			const result = parsePackFile(JSON.parse(readPack(id)), id, PACK_FORMAT);
			assert.ok(result.ok);
			assert.equal(result.file.packVersion, expected.version);
		});

		it(`${id}.json carries path data and 1s, and nothing else`, () => {
			// The property that lets these files skip SVG sanitization. Asserted
			// structurally rather than by grepping for "stroke", because several
			// packs have icons *named* things like `mars-stroke`.
			const raw = JSON.parse(readPack(id)) as PackFile;
			assert.deepStrictEqual(Object.keys(raw).sort(), [
				"format",
				"icons",
				"pack",
				"packVersion",
			]);
			for (const [name, sizes] of Object.entries(raw.icons)) {
				for (const [key, size] of Object.entries(sizes)) {
					assert.deepStrictEqual(
						Object.keys(size).sort(),
						["p", "w"],
						`${name}@${key} carries an unexpected field`,
					);
					for (const glyph of size.p) {
						for (const field of Object.keys(glyph)) {
							assert.ok(
								["d", "r", "c", "f", "n"].includes(field),
								`${name}@${key} carries "${field}" — paint belongs in source`,
							);
						}
					}
				}
			}
		});
	}

	it("gives the stroked pack no stroke of its own", () => {
		// Stated once more from the other end: Tabler Outline's paint lives in
		// `packs/tabler.ts`, so a file that started carrying it would mean the
		// generator had begun baking presentation into downloadable data.
		const raw = JSON.parse(readPack("tabler-outline")) as PackFile;
		const fields = new Set<string>();
		for (const sizes of Object.values(raw.icons)) {
			for (const size of Object.values(sizes)) {
				for (const glyph of size.p) {
					for (const field of Object.keys(glyph)) fields.add(field);
				}
			}
		}
		assert.deepStrictEqual([...fields].sort(), ["d", "f", "n"]);
	});
});

describe("where pack files are fetched from", () => {
	it("pins to a dedicated tag, not to the plugin version", () => {
		// jsDelivr caches a tagged URL permanently, so an ordinary patch release
		// must not invalidate every user's cached pack. Refreshing pack data is
		// then an explicit act: new tag, new checksums.
		assert.equal(PACKS_TAG, "packs-v3");
		for (const url of packUrls("octicons")) {
			assert.ok(url.includes(PACKS_TAG), url);
			assert.ok(url.endsWith("/packs/octicons.json"), url);
		}
	});

	it("offers a fallback host, in the order they are tried", () => {
		const [primary, fallback] = packUrls("fa-solid");
		assert.ok(primary?.startsWith("https://cdn.jsdelivr.net/"), primary);
		assert.ok(fallback?.startsWith("https://raw.githubusercontent.com/"), fallback);
	});

	it("fetches over HTTPS only", () => {
		for (const id of Object.keys(PACK_MANIFEST) as IconPackId[]) {
			for (const url of packUrls(id)) assert.ok(url.startsWith("https://"), url);
		}
	});
});
