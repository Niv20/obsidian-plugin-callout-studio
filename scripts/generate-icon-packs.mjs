/**
 * scripts/generate-icon-packs.mjs — Builds the icon-pack data from upstream npm packages.
 *
 * Run with `npm run icons:generate` (optionally `-- --pack=octicons`). Never
 * part of `npm run build`: CI stays hermetic, and the generated artefacts are
 * committed so a normal build needs neither these devDependencies nor a network.
 *
 * Two artefacts per pack:
 *
 * - `src/icons/data/<id>.index.ts` — names, keywords and categories, packed by
 *   scripts/lib/encodeIndex.mjs. Bundled into main.js so search works offline
 *   from the first launch.
 * - `packs/<id>.json` — the path data, downloaded on demand and cached to disk.
 *   Committed here and served from jsDelivr at a pinned tag.
 *
 * And a third for the one pack whose licence is not a single licence: Simple
 * Icons' logos carry terms of their own, one brand at a time, so its builder
 * also writes `docs/SIMPLE-ICONS-LICENSES.md` — who is credited for which logo,
 * and which logos were left out. Generated rather than written, because it has
 * to describe exactly the file beside it and nothing else.
 *
 * Path data is stored as bare `d` strings, never markup, and every one is
 * validated against a path grammar at build time and again at load time. That
 * is what lets the runtime skip SVG sanitization for these packs entirely:
 * there is no element or attribute in the file that could carry a payload.
 */
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { encodeIndex, encodedIndexLiteral } from "./lib/encodeIndex.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PACK_DIR = join(ROOT, "packs");
const DATA_DIR = join(ROOT, "src", "icons", "data");
/** Upstream tables that ship with the generator rather than with a package. */
const GENERATOR_DATA_DIR = join(ROOT, "scripts", "data");

/** The on-disk pack format. Bumping this invalidates every cached pack file. */
const PACK_FORMAT = 1;

/**
 * Legal SVG path-data characters. Anything outside this set means the upstream
 * package changed shape, and the build should stop rather than ship it.
 */
const PATH_DATA_RE = /^[MmLlHhVvCcSsQqTtAaZz0-9eE+\-.,\s]+$/;

function assertPathData(d, where) {
	if (typeof d !== "string" || d.length === 0 || !PATH_DATA_RE.test(d)) {
		throw new Error(`invalid path data at ${where}: ${JSON.stringify(d)?.slice(0, 120)}`);
	}
}

/**
 * Upstream search terms, as the index should hold them: whitespace collapsed,
 * blanks dropped, repeats dropped, otherwise in the order upstream gave them.
 *
 * Applied to every pack in `main()` rather than left to each builder, because
 * "the upstream data has debris in it" is not a property of any one library.
 * Octicons tags `eye-closed` with an empty string, which buys a whole
 * dictionary slot and a reference on the entry carrying it in exchange for
 * matching nothing at all — the search filters empty words out of a query
 * before it ever looks. Font Awesome lists `replicate` on `copy` three times
 * and `plume` on `feather` four; a repeat costs a reference apiece and cannot
 * match anything the first one did not, since matching is a membership test.
 */
function cleanTerms(values) {
	return [
		...new Set(
			values
				.map((value) => String(value).replace(/\s+/g, " ").trim())
				.filter((value) => value.length > 0),
		),
	];
}

/** One index entry with its upstream text put through `cleanTerms`. */
function cleanEntry(entry) {
	return {
		...entry,
		categories: cleanTerms(entry.categories),
		keywords: cleanTerms(entry.keywords),
	};
}

// ── Octicons ────────────────────────────────────────────────────────────

/**
 * Heights worth shipping. Octicons draws 16px and 24px art for almost
 * everything; 12px exists for nine icons and 48/96 for one. An icon that has
 * none of the preferred heights keeps whatever it does have, so every icon
 * stays renderable (`no-entry-fill` is 12-only, `copilot` is 48/96-only).
 */
const OCTICON_PREFERRED_HEIGHTS = [12, 16, 24];

/**
 * Pull the `<path>` elements out of one Octicon variant.
 *
 * Upstream stores inner markup rather than structured data, and 203 of the 741
 * variants hold more than one path. `fill-rule="evenodd"` (and its `clip-rule`
 * twin) must survive: dropping it fills the holes in donut-shaped icons like
 * `issue-opened` solid — including through a CSS mask, which reads alpha.
 */
function parseOcticonPaths(markup, where) {
	const paths = [];
	const elementRe = /<path\b([^>]*)>/g;
	let match;
	while ((match = elementRe.exec(markup)) !== null) {
		const attrs = match[1];
		const d = /\bd="([^"]*)"/.exec(attrs)?.[1];
		assertPathData(d, where);
		const path = { d };
		if (/\bfill-rule="evenodd"/.test(attrs)) path.r = 1;
		if (/\bclip-rule="evenodd"/.test(attrs)) path.c = 1;
		paths.push(path);
	}
	if (paths.length === 0) throw new Error(`no <path> found at ${where}`);

	// Anything other than <path> would be silently dropped above, which would
	// render a wrong icon rather than fail. Catch it here instead.
	const elements = [...markup.matchAll(/<([a-zA-Z-]+)/g)].map((m) => m[1]);
	const unexpected = elements.filter((e) => e !== "path");
	if (unexpected.length > 0) {
		throw new Error(`unexpected elements at ${where}: ${unexpected.join(", ")}`);
	}
	return paths;
}

function buildOcticons() {
	const data = JSON.parse(
		readFileSync(
			join(ROOT, "node_modules/@primer/octicons/build/data.json"),
			"utf8",
		),
	);
	const version = JSON.parse(
		readFileSync(join(ROOT, "node_modules/@primer/octicons/package.json"), "utf8"),
	).version;

	const icons = {};
	const entries = [];

	for (const name of Object.keys(data).sort()) {
		const record = data[name];
		const available = Object.keys(record.heights).map(Number);
		const wanted = available.filter((h) => OCTICON_PREFERRED_HEIGHTS.includes(h));
		const heights = wanted.length > 0 ? wanted : available;

		const sizes = {};
		for (const height of heights.sort((a, b) => a - b)) {
			const variant = record.heights[String(height)];
			sizes[height] = {
				w: variant.width,
				p: parseOcticonPaths(variant.path, `octicons/${name}@${height}`),
			};
		}
		icons[name] = sizes;

		entries.push({
			name,
			categories: [], // Octicons has no taxonomy upstream.
			keywords: record.keywords ?? [],
		});
	}

	return {
		id: "octicons",
		version,
		file: { icons },
		entries,
		// Names are the only reliable search term for the 160 icons with no
		// upstream keywords, and they are already descriptive ("git-branch").
		note: `${entries.length} icons`,
	};
}

// ── Font Awesome Free ───────────────────────────────────────────────────

const FA_DIR = join(ROOT, "node_modules/@fortawesome/fontawesome-free");

/**
 * Font Awesome's icons are all 512 units tall but vary in width, so the height
 * is the size key and the width rides along — the same shape every other pack
 * uses, where the viewBox is `0 0 {w} {key}`.
 */
const FA_HEIGHT = "512";

/**
 * Read one Font Awesome SVG.
 *
 * These are single-path files with the colour already set to `currentColor`,
 * which is dropped: the plugin applies its own fill so the icon tracks the
 * callout's colour on screen and carries a baked one into PDF export.
 *
 * Note this discards the `<!--! Font Awesome Free ... -->` attribution comment
 * embedded in every file. That is what moves us off Font Awesome's "the files
 * already carry sufficient attribution" footing and onto plain CC BY 4.0, which
 * the credits surfaces and THIRD-PARTY-NOTICES.md satisfy explicitly.
 */
function readFontAwesomeSvg(style, name) {
	const where = `fa-${style}/${name}`;
	const raw = readFileSync(join(FA_DIR, "svgs", style, `${name}.svg`), "utf8");
	const body = raw.replace(/<!--[\s\S]*?-->/g, "");

	const viewBox = /viewBox="0 0 (\d+) 512"/.exec(body);
	if (!viewBox) throw new Error(`unexpected viewBox at ${where}: ${raw.slice(0, 120)}`);

	const paths = [...body.matchAll(/<path\b([^>]*)\/?>/g)];
	if (paths.length !== 1) {
		throw new Error(`expected exactly one <path> at ${where}, got ${paths.length}`);
	}
	const attrs = paths[0][1];
	const d = /\bd="([^"]*)"/.exec(attrs)?.[1];
	assertPathData(d, where);

	const glyph = { d };
	if (/\bfill-rule="evenodd"/.test(attrs)) glyph.r = 1;
	if (/\bclip-rule="evenodd"/.test(attrs)) glyph.c = 1;

	return { w: Number(viewBox[1]), p: [glyph] };
}

/**
 * A label is only worth its bytes when it says something the name does not.
 * "heart" → "Heart" adds nothing, since search already treats separators as
 * spaces and ignores case.
 */
function labelAddsMeaning(name, label) {
	if (!label) return false;
	const normalize = (s) => s.toLowerCase().replace(/[\s_-]+/g, "");
	return normalize(name) !== normalize(label);
}

function buildFontAwesome(style) {
	const YAML = faYaml();
	const version = JSON.parse(
		readFileSync(join(FA_DIR, "package.json"), "utf8"),
	).version;

	const icons = YAML.parse(
		readFileSync(join(FA_DIR, "metadata/icons.yml"), "utf8"),
	);
	// categories.yml maps a category to its icons; the index needs the reverse.
	const categoriesByIcon = new Map();
	const categoryData = YAML.parse(
		readFileSync(join(FA_DIR, "metadata/categories.yml"), "utf8"),
	);
	for (const key of Object.keys(categoryData)) {
		const { label, icons: members } = categoryData[key];
		for (const member of members ?? []) {
			if (!categoriesByIcon.has(member)) categoriesByIcon.set(member, []);
			categoriesByIcon.get(member).push(label);
		}
	}

	const names = Object.keys(icons)
		.filter((name) => (icons[name].styles ?? []).includes(style))
		.sort();

	const packIcons = {};
	const entries = [];
	for (const name of names) {
		packIcons[name] = { [FA_HEIGHT]: readFontAwesomeSvg(style, name) };
		const label = icons[name].label;
		entries.push({
			name,
			...(labelAddsMeaning(name, label) ? { label } : {}),
			categories: (categoriesByIcon.get(name) ?? []).sort(),
			keywords: (icons[name].search?.terms ?? []).map(String),
		});
	}

	return {
		id: `fa-${style}`,
		version,
		file: { icons: packIcons },
		entries,
		note: `${entries.length} icons`,
	};
}

/** Lazily required so packs that do not need YAML can build without it. */
let yamlModule = null;
function faYaml() {
	if (!yamlModule) {
		yamlModule = createRequire(import.meta.url)("yaml");
	}
	return yamlModule;
}

// ── RPG Awesome ─────────────────────────────────────────────────────────

const RA_DIR = join(ROOT, "node_modules/rpg-awesome");

/**
 * RPG Awesome publishes a webfont and nothing else — no per-icon SVGs, no
 * metadata — so the artwork comes out of the SVG font's `<glyph>` elements.
 *
 * Font space is not SVG space: the y axis points *up*, and the origin sits on
 * the baseline rather than at the top-left. The em square is 1024 units with an
 * ascent of 960, so the mapping is y' = 960 - y, giving a 1024×1024 viewBox.
 *
 * The flip is baked into the coordinates here rather than emitted as a
 * `<g transform>` wrapper, so the pack file keeps its "path data only"
 * property and the runtime needs no special case for this one source. It is
 * done with svgpath rather than a regex because relative commands (`v`, `c`,
 * `s` — all of which this font uses) need their deltas negated too, and
 * svgpath also handles arc sweep inversion should a future version add arcs.
 */
const RA_UNITS_PER_EM = 1024;
const RA_ASCENT = 960;
const RA_SIZE = String(RA_UNITS_PER_EM);

/**
 * Bounding box of the drawn outline.
 *
 * Curves are flattened rather than bounded by their control points: control
 * points routinely sit well outside the curve they shape, and here that
 * difference decides whether a glyph looks misplaced or not. Commands are read
 * with their real arity too — `H` and `V` carry a single coordinate, so
 * treating a path's numbers as x,y pairs gives nonsense.
 */
function pathBounds(d, svgpath) {
	let minX = Infinity;
	let maxX = -Infinity;
	let minY = Infinity;
	let maxY = -Infinity;
	const point = (x, y) => {
		if (x < minX) minX = x;
		if (x > maxX) maxX = x;
		if (y < minY) minY = y;
		if (y > maxY) maxY = y;
	};
	const cubic = (x0, y0, x1, y1, x2, y2, x3, y3) => {
		const steps = 24;
		for (let i = 0; i <= steps; i++) {
			const t = i / steps;
			const u = 1 - t;
			point(
				u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
				u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
			);
		}
	};

	svgpath(d)
		.abs()
		.unshort()
		.unarc()
		.iterate((seg, _index, x, y) => {
			switch (seg[0]) {
				case "M":
				case "L":
					point(seg[1], seg[2]);
					break;
				case "H":
					point(seg[1], y);
					break;
				case "V":
					point(x, seg[1]);
					break;
				case "C":
					cubic(x, y, seg[1], seg[2], seg[3], seg[4], seg[5], seg[6]);
					break;
				case "Q":
					cubic(
						x,
						y,
						x + (2 / 3) * (seg[1] - x),
						y + (2 / 3) * (seg[2] - y),
						seg[3] + (2 / 3) * (seg[1] - seg[3]),
						seg[4] + (2 / 3) * (seg[2] - seg[4]),
						seg[3],
						seg[4],
					);
					break;
				default:
					break;
			}
		});

	return { minX, maxX, minY, maxY };
}

function buildRpgAwesome() {
	const svgpath = createRequire(import.meta.url)("svgpath");
	const version = JSON.parse(
		readFileSync(join(RA_DIR, "package.json"), "utf8"),
	).version;

	const font = readFileSync(
		join(RA_DIR, "fonts/rpgawesome-webfont.svg"),
		"utf8",
	);
	const scss = readFileSync(join(RA_DIR, "scss/_variables.scss"), "utf8");

	// The documented ids, keyed by codepoint. Used only to check that
	// `glyph-name` still agrees with what the stylesheet calls each icon.
	const namesByCode = new Map(
		[...scss.matchAll(/\$ra-var-icon-([a-z0-9-]+):\s*'\\([0-9a-fA-F]+)'/g)].map(
			(m) => [parseInt(m[2], 16), m[1]],
		),
	);
	if (namesByCode.size === 0) {
		throw new Error("rpg-awesome: no icon names found in _variables.scss");
	}

	const icons = {};
	const entries = [];

	for (const attrs of [...font.matchAll(/<glyph ([^>]*?)\/>/g)].map((m) => m[1])) {
		const d = /\sd="([^"]*)"/.exec(attrs)?.[1];
		// The font carries a space glyph with no outline; it is not an icon.
		if (!d) continue;

		const glyphName = /glyph-name="([^"]*)"/.exec(attrs)?.[1];
		const code = parseInt(
			/unicode="&#x([0-9a-fA-F]+);"/.exec(attrs)?.[1] ?? "",
			16,
		);
		// The stylesheet's name wins where the two disagree: it is the one
		// upstream documents and ships as a CSS class, so it is what anyone
		// looking an icon up will have seen. Two glyphs differ in 0.2.0 —
		// `montains` is a typo for `mountains`, and `perspective-dice-six-two`
		// is shortened to `perspective-dice-two`.
		const name = namesByCode.get(code) ?? glyphName;
		if (!name) {
			throw new Error(`rpg-awesome: unnamed glyph at codepoint ${code}`);
		}

		// This font declares one advance width for every glyph; a per-glyph
		// override would mean the em square below is the wrong frame.
		if (/horiz-adv-x=/.test(attrs)) {
			throw new Error(`rpg-awesome: "${name}" overrides horiz-adv-x`);
		}

		const flipped = svgpath(d)
			.scale(1, -1)
			.translate(0, RA_ASCENT)
			.abs()
			.round(2)
			.toString();
		assertPathData(flipped, `rpg-awesome/${name}`);

		// The flip is the one thing here that could fail silently — a wrong sign
		// or a missed offset produces a valid path that simply draws upside
		// down or off-frame. Every glyph in this font sits inside the em square
		// once flipped, so checking that is a real test of the transform: get
		// it wrong and the coordinates land outside immediately.
		const box = pathBounds(flipped, svgpath);
		const slack = 1;
		if (
			box.minX < -slack ||
			box.minY < -slack ||
			box.maxX > RA_UNITS_PER_EM + slack ||
			box.maxY > RA_UNITS_PER_EM + slack
		) {
			throw new Error(
				`rpg-awesome: "${name}" falls outside the em square after the ` +
					`Y-flip — x ${box.minX.toFixed(1)}…${box.maxX.toFixed(1)}, ` +
					`y ${box.minY.toFixed(1)}…${box.maxY.toFixed(1)}, ` +
					`expected 0…${RA_UNITS_PER_EM} on both axes`,
			);
		}

		icons[name] = {
			[RA_SIZE]: { w: RA_UNITS_PER_EM, p: [{ d: flipped }] },
		};
		// No keywords upstream, but the names are compound and descriptive, so
		// their parts make usable search terms: "crossed-swords" becomes
		// findable by "swords". Where the font spells a name differently from
		// the stylesheet, keep its spelling searchable too.
		const keywords = name.split("-").filter((part) => part.length > 1);
		if (glyphName && glyphName !== name) {
			for (const part of glyphName.split("-")) {
				if (part.length > 1 && !keywords.includes(part)) {
					keywords.push(part);
				}
			}
		}

		entries.push({
			name,
			categories: [], // RPG Awesome has no taxonomy upstream.
			keywords,
		});
	}

	entries.sort((a, b) => (a.name < b.name ? -1 : 1));
	const sorted = {};
	for (const entry of entries) sorted[entry.name] = icons[entry.name];

	return {
		id: "rpg-awesome",
		version,
		file: { icons: sorted },
		entries,
		note: `${entries.length} icons`,
	};
}

// ── Material Symbols ────────────────────────────────────────────────────

/**
 * Material Symbols has no pack file: its artwork is fetched one drawing at a
 * time from Google, because 3,870 icons across 4 styles and 7 weights is over
 * 100,000 variants and no bulk file exists to ship. Only the index is built.
 *
 * The source is the metadata table Google publishes, held as generator input at
 * scripts/data/material-metadata.json. Packing it costs nothing in fidelity —
 * every name, tag and category survives, as the round-trip check asserts — and
 * takes the bundled form to well under a third of its size.
 */
async function buildMaterial() {
	// The other eight packs read their upstream out of `node_modules`; Material
	// has no such package, because the tags and categories live behind Google's
	// web metadata endpoint rather than in anything published to npm. So the
	// table is committed here, beside the generator that consumes it — outside
	// `src/`, which keeps it out of `main.js` and out of the build's typecheck,
	// the two costs that got the original 2.24 MB TypeScript copy deleted.
	const { icons } = JSON.parse(
		readFileSync(join(GENERATOR_DATA_DIR, "material-metadata.json"), "utf8"),
	);

	// Google's table carries a little editorial debris — one tag on `moving`
	// reads "potential tags could relate to:\n\nmoving". `cleanTerms` collapses
	// that whitespace, which keeps the tag searchable without letting a newline
	// break the line-per-icon framing the index format relies on. It is called
	// here rather than only in `main()` because the categories are sorted after
	// it, and sorting the raw strings would sort the debris.
	const entries = icons.map((icon) => ({
		name: icon.name,
		categories: cleanTerms(icon.categories).sort(),
		keywords: cleanTerms(icon.tags),
	}));

	return {
		id: "material",
		version: "Material Symbols",
		file: null, // per-icon fetch; nothing to publish
		entries,
		note: `${entries.length} icons`,
	};
}

// ── Tabler Icons ────────────────────────────────────────────────────────

const TABLER_DIR = join(ROOT, "node_modules/@tabler/icons");

/** Every Tabler drawing is on the same 24-unit square, so there is one size. */
const TABLER_SIZE = "24";

/**
 * The transparent square every Tabler SVG opens with. It exists to pin the
 * icon's bounds in a browser and draws nothing, but through a CSS mask — which
 * reads alpha, not colour — it would blot out the whole box. Dropped.
 */
const TABLER_BOUNDS_PATH = "M0 0h24v24H0z";

/**
 * The paint a path is allowed to declare for itself, and the flag it becomes.
 *
 * Outline icons are stroked from the root, and 77 of their 20,706 paths opt out
 * of that for a detail drawn solid — the pips on `dice-3`, the eyes on
 * `brand-reddit`. Both flags are booleans, never values: what `f` and `n` mean
 * is written in src/icons/packData.ts, so the file still holds nothing but path
 * data and 1s.
 */
const TABLER_GLYPH_FLAGS = [
	{ attr: "fill", value: "currentColor", flag: "f" },
	{ attr: "stroke", value: "none", flag: "n" },
];

/**
 * Read one Tabler SVG into a drawing.
 *
 * Strict on purpose, in the same way parseOcticonPaths is: an element or an
 * attribute this does not expect means upstream changed shape, and a build that
 * quietly dropped it would ship a wrong icon. As of 3.46.0 the only attribute
 * outside `d` and the two flags above is an `opacity=".5"` on one path of
 * `brand-parsinta`, which is allowed through and dropped — recorded in the
 * pack's `modifications`, since it renders that one path fully opaque.
 */
function readTablerSvg(style, name) {
	const where = `tabler-${style}/${name}`;
	const raw = readFileSync(join(TABLER_DIR, "icons", style, `${name}.svg`), "utf8");
	const body = raw.slice(raw.indexOf(">") + 1);

	const elements = [...body.matchAll(/<([a-zA-Z-]+)/g)].map((m) => m[1]);
	const unexpected = elements.filter((e) => e !== "path");
	if (unexpected.length > 0) {
		throw new Error(`unexpected elements at ${where}: ${unexpected.join(", ")}`);
	}
	if (!/\bviewBox="0 0 24 24"/.test(raw)) {
		throw new Error(`unexpected viewBox at ${where}: ${raw.slice(0, 160)}`);
	}

	const p = [];
	for (const match of body.matchAll(/<path\b([^>]*?)\/?>/g)) {
		const attrs = match[1];
		const d = /\bd="([^"]*)"/.exec(attrs)?.[1];
		assertPathData(d, where);
		if (d === TABLER_BOUNDS_PATH) continue;

		const glyph = { d };
		for (const { attr, value, flag } of TABLER_GLYPH_FLAGS) {
			// Filled icons declare `fill="currentColor"` on the root already, so the
			// 16 paths that repeat it are saying nothing and need no flag.
			if (style === "outline" && new RegExp(`\\b${attr}="${value}"`).test(attrs)) {
				glyph[flag] = 1;
			}
		}

		const declared = [...attrs.matchAll(/([a-z-]+)="/g)].map((m) => m[1]);
		const unknown = declared.filter(
			(a) => !["d", "fill", "stroke", "opacity"].includes(a),
		);
		if (unknown.length > 0) {
			throw new Error(`unexpected attributes at ${where}: ${unknown.join(", ")}`);
		}
		p.push(glyph);
	}
	if (p.length === 0) throw new Error(`no drawable <path> at ${where}`);

	return { w: 24, p };
}

/**
 * Build one Tabler style.
 *
 * Upstream ships one metadata record per name covering both styles, so `styles`
 * is what says whether this style draws it: every one of the 5,130 names has an
 * outline drawing, 1,054 also have a filled one.
 */
function buildTabler(style) {
	const version = JSON.parse(
		readFileSync(join(TABLER_DIR, "package.json"), "utf8"),
	).version;
	const metadata = JSON.parse(
		readFileSync(join(TABLER_DIR, "icons.json"), "utf8"),
	);

	const names = Object.keys(metadata)
		.filter((name) => metadata[name].styles?.[style])
		.sort();
	if (names.length === 0) throw new Error(`no icons for style "${style}"`);

	const icons = {};
	const entries = [];
	for (const name of names) {
		icons[name] = { [TABLER_SIZE]: readTablerSvg(style, name) };

		// Tags are the whole reason a search for "warning" finds `alert-triangle`.
		// A few are numbers upstream ("a-b-2" is tagged 2), hence the cast.
		const keywords = [
			...new Set(
				(metadata[name].tags ?? [])
					.map((tag) => String(tag).replace(/\s+/g, " ").trim().toLowerCase())
					.filter((tag) => tag.length > 0),
			),
		];
		const category = metadata[name].category;
		entries.push({
			name,
			// No label: Tabler's names are already the display text, and omitting
			// them lets the index skip its label block entirely.
			categories: category ? [category] : [],
			keywords,
		});
	}

	return {
		id: `tabler-${style}`,
		version,
		file: { icons },
		entries,
		note: `${entries.length} icons`,
	};
}

// ── Simple Icons ────────────────────────────────────────────────────────

const SI_DIR = join(ROOT, "node_modules/simple-icons");

/** Every Simple Icons drawing is a single path on the same 24-unit square. */
const SI_SIZE = "24";

/** Where the per-logo licence notices go, relative to the repository root. */
const SI_NOTICES_FILE = join("docs", "SIMPLE-ICONS-LICENSES.md");

/**
 * The one shape every Simple Icons file takes: a root carrying only the
 * viewBox, a title, and a single path with nothing on it but `d`.
 *
 * Matched whole rather than picked apart, for the reason parseOcticonPaths and
 * readTablerSvg are strict: a second path, a `fill-rule`, a transform — anything
 * this does not expect — means upstream changed shape, and a build that read
 * only the `d` it recognised would ship a wrong drawing. For somebody's
 * trademark that is a worse mistake than for an arrow.
 */
const SI_SVG_RE =
	/^<svg role="img" viewBox="0 0 24 24" xmlns="http:\/\/www\.w3\.org\/2000\/svg"><title>[^<]*<\/title><path d="([^"]*)"\/><\/svg>\s*$/;

/**
 * The licences a logo may carry and still ship.
 *
 * Simple Icons releases its collection under CC0, and says in the same breath
 * that this "doesn't mean to imply that all icons within the project are also
 * CC0" (its DISCLAIMER.md). Where a brand published its logo under a licence of
 * its own, upstream records that on the icon, and that licence is the one that
 * binds whoever passes the drawing on — which, since `packs/` is served from
 * this repository, is us.
 *
 * So this is an allow-list, and what is on it has one thing in common:
 * everything the licence asks of someone redistributing the logo *unchanged*
 * can be met with a notice — name the work, name the licence, link both.
 * docs/SIMPLE-ICONS-LICENSES.md, written below, is that notice. ShareAlike and
 * MPL belong here for the same reason: their copyleft attaches to a modified
 * logo, and the pack carries every path exactly as published, as one separate
 * work among thousands.
 */
const SI_SHIPPED_LICENSES = new Set([
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

/**
 * The licences that keep a logo out of the pack, and why.
 *
 * `reason` is printed beside the logo in the notices and `because` once above
 * the table, so an icon someone goes looking for and does not find has an
 * explanation. The GPL entry has one more reason than it states there: upstream
 * does not record the owner's copyright notice, so the notice the licence wants
 * delivered could not be reproduced even by a download that was shaped for it.
 */
const SI_WITHHELD_LICENSES = [
	{
		test: /^custom$/,
		reason: "brand-specific terms",
		because:
			"the brand's own conditions, behind the link, which have to be read and " +
			"accepted one brand at a time",
	},
	{
		test: /-NC(?:-|$)/,
		reason: "non-commercial use only",
		because:
			"the licence binds everyone downstream, and an icon picker cannot know " +
			"what a vault is used for",
	},
	{
		test: /-ND(?:-|$)/,
		reason: "no derivatives",
		because:
			"a logo drawn in a callout's colour and shared in an exported note is " +
			"arguably an altered copy",
	},
	{
		test: /^(?:MIT|BSD-3-Clause)$/,
		reason: "copyright notice not recorded upstream",
		because:
			"the licence wants the owner's copyright line delivered with every copy, " +
			"and Simple Icons keeps the licence per logo but not that line",
	},
	{
		test: /^A?GPL-/,
		reason: "GPL-family copyleft",
		because:
			"the licence wants its full text and the owner's copyright notice " +
			"delivered with every copy",
	},
];

/**
 * Logos withdrawn at their owner's request, by slug.
 *
 * Upstream drops a brand from its next major release when asked to; this is the
 * same courtesy without the wait. Add the slug, regenerate, and publish under a
 * new packs tag — the old tag stays cached on the CDN for good, so what ends the
 * distribution is a build that no longer points at it.
 */
const SI_WITHDRAWN = new Set([]);

const SI_WITHDRAWN_RULE = {
	reason: "withdrawn at the owner's request",
	because: "the brand asked for its logo not to be distributed",
};

/**
 * Whether a logo ships, and under which rules it does not.
 *
 * A licence on neither list stops the build. Upstream adds licence data every
 * week, and a kind of term this has not met has to be read by a person before
 * it is either promised or refused — never waved through by default, and never
 * dropped without a word either.
 */
function classifySimpleIcon(brand) {
	if (SI_WITHDRAWN.has(brand.slug)) return { ship: false, rules: [SI_WITHDRAWN_RULE] };

	const type = brand.license?.type;
	if (type === undefined) return { ship: true };
	if (typeof type !== "string" || type.length === 0) {
		throw new Error(`simple-icons: "${brand.slug}" has a malformed licence`);
	}

	const rules = SI_WITHHELD_LICENSES.filter((rule) => rule.test.test(type));
	if (rules.length > 0) return { ship: false, rules };
	if (SI_SHIPPED_LICENSES.has(type)) return { ship: true };

	throw new Error(
		`simple-icons: "${brand.slug}" carries the licence "${type}", which is on ` +
			`neither SI_SHIPPED_LICENSES nor SI_WITHHELD_LICENSES. Read the licence, ` +
			`then add it to the list it belongs on.`,
	);
}

/** Read one Simple Icons file down to its path data. */
function readSimpleIconSvg(slug) {
	const where = `simple-icons/${slug}`;
	const raw = readFileSync(join(SI_DIR, "icons", `${slug}.svg`), "utf8");
	const match = SI_SVG_RE.exec(raw);
	if (!match) throw new Error(`unexpected markup at ${where}: ${raw.slice(0, 160)}`);
	const d = match[1];
	assertPathData(d, where);
	return { w: 24, p: [{ d }] };
}

/**
 * Search terms for one brand beyond its slug and its title.
 *
 * Upstream's aliases are the whole reason a search for "twitter" finds `x`:
 * other names the brand goes by, names it used to have, names in other
 * languages, and the other brands that share its drawing. Lower-cased, since
 * the search ignores case and one spelling per term keeps the dictionary small.
 *
 * One term is derived rather than read. A slug spells punctuation out
 * (`nodedotjs`, `atandt`) and a title keeps it (`Node.js`, `AT&T`), so neither
 * answers to the spelling people actually type — `nodejs`, `att`. The title
 * with its punctuation closed up does, and is added only when the slug does not
 * already contain it, which is what keeps it from being a second copy of most
 * names.
 */
function simpleIconKeywords(brand) {
	const aliases = brand.aliases ?? {};
	const duplicates = aliases.dup ?? [];
	const terms = [
		...(aliases.aka ?? []),
		...(aliases.old ?? []),
		...Object.values(aliases.loc ?? {}),
		...duplicates.map((duplicate) => duplicate.title),
		...duplicates.flatMap((duplicate) => Object.values(duplicate.loc ?? {})),
	].map((term) => String(term).toLowerCase());

	const closedUp = brand.title
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "");
	if (closedUp.length > 2 && !brand.slug.replace(/_/g, "").includes(closedUp)) {
		terms.push(closedUp);
	}
	return terms;
}

/** The page a licence's own text lives on, for an SPDX identifier. */
function licenseUrl(spdx) {
	if (spdx === "CC0-1.0") return "https://creativecommons.org/publicdomain/zero/1.0/";
	const cc = /^CC-(BY(?:-[A-Z]{2})*)-(\d\.\d)$/.exec(spdx);
	if (cc) {
		return `https://creativecommons.org/licenses/${cc[1].toLowerCase()}/${cc[2]}/`;
	}
	return `https://spdx.org/licenses/${spdx}.html`;
}

/**
 * The licences that ask for their own words to travel with the work, and those
 * words.
 *
 * A link is enough for the Creative Commons licences and for MPL, which say so
 * themselves. Apache 2.0 gets the notice it prescribes and a link to its full
 * text, the way THIRD-PARTY-NOTICES.md already treats Material Symbols. MIT and
 * BSD are absent on purpose: they want the owner's copyright line delivered with
 * every copy, upstream records a licence per logo and not that line, so those
 * logos are withheld (see SI_WITHHELD_LICENSES).
 */
const SI_LICENSE_TEXTS = [
	{
		spdx: "Apache-2.0",
		title: "Apache License 2.0",
		text: [
			`Licensed under the Apache License, Version 2.0 (the "License"); you may not use`,
			`these files except in compliance with the License. You may obtain a copy of the`,
			`License at`,
			``,
			`    http://www.apache.org/licenses/LICENSE-2.0`,
			``,
			`Unless required by applicable law or agreed to in writing, software distributed`,
			`under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR`,
			`CONDITIONS OF ANY KIND, either express or implied. See the License for the`,
			`specific language governing permissions and limitations under the License.`,
		],
	},
];

/** Escape text for a Markdown table cell. */
function markdownText(value) {
	return String(value).replace(/[\\`*_[\]<>|]/g, (char) => `\\${char}`);
}

/**
 * A Markdown link for a table cell. The destination goes in angle brackets so a
 * parenthesis in it cannot end the link early, and a pipe is percent-encoded so
 * it cannot end the cell.
 */
function markdownLink(text, url) {
	return `[${markdownText(text)}](<${String(url).replace(/\|/g, "%7C")}>)`;
}

/**
 * Write the per-logo notices: who is credited for which logo, under what, and
 * which logos were left out.
 *
 * This is the attribution the licences on SI_SHIPPED_LICENSES ask for, so it
 * has to describe the pack file exactly — hence built here, from the same pass
 * that built the file, rather than maintained by hand beside it.
 */
function simpleIconsNotices({ version, total, shippedCount, licensed, withheld }) {
	const byLicense = new Map();
	for (const brand of licensed) {
		byLicense.set(brand.license.type, (byLicense.get(brand.license.type) ?? 0) + 1);
	}
	const summary = [...byLicense.entries()].sort(
		(a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1),
	);

	const licenseCell = (brand) => {
		const license = brand.license;
		if (!license) return "—";
		return markdownLink(license.type, license.url ?? licenseUrl(license.type));
	};
	// Grouped the way the rest of the documentation writes a count ("5,130").
	const count = (value) => value.toLocaleString("en-US");

	const lines = [
		`# Simple Icons — per-logo licences`,
		``,
		`> **Generated file — do not edit.** Written by`,
		`> \`scripts/generate-icon-packs.mjs\` from \`simple-icons\` ${version}. Regenerate`,
		`> with \`npm run icons:generate -- --pack=simple-icons\`.`,
		``,
		`[Simple Icons](https://simpleicons.org) releases its collection under`,
		`[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/), and adds that this`,
		`"doesn't mean to imply that all icons within the project are also CC0": where a`,
		`brand has published its logo under a licence of its own, Simple Icons records`,
		`that licence on the icon. This file is the per-logo half of the Simple Icons`,
		`section of [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md). It describes the`,
		`Simple Icons pack Callout Studio offers for download, \`packs/simple-icons.json\`:`,
		`${count(shippedCount)} of the ${count(total)} logos in Simple Icons ${version}.`,
		``,
		`Three things hold for every logo in that pack, whether or not it is listed`,
		`below:`,
		``,
		`- **It is a trademark of its owner.** No licence on this page grants trademark`,
		`  rights. Use a logo only to refer to the company, product or service it`,
		`  belongs to, and follow its owner's brand guidelines — Simple Icons links the`,
		`  ones it knows of from each icon at <https://simpleicons.org>.`,
		`- **Its outline is unmodified.** The path data is copied exactly as Simple`,
		`  Icons publishes it. The SVG wrapper and its \`<title>\` element are dropped,`,
		`  and the colour is applied when the icon is drawn.`,
		`- **The licence data is upstream's**, and upstream calls it an ongoing`,
		`  project: "the absence of license data for a particular icon does not imply`,
		`  that the icon is not released under a license." A logo that is not listed`,
		`  here is one Simple Icons records no licence for, not one that is known to`,
		`  have none.`,
		``,
		`## Logos shipped under their own licence`,
		``,
		`${count(licensed.length)} logos in the pack carry a licence that Simple Icons records. Each`,
		`one is credited here to the brand it belongs to, under the licence named, from`,
		`the source linked. The copyright in a logo is its owner's, as stated at that`,
		`source.`,
		``,
		`| Licence | Logos |`,
		`| --- | ---: |`,
		...summary.map(
			([type, logos]) => `| ${markdownLink(type, licenseUrl(type))} | ${count(logos)} |`,
		),
		``,
		`An adapted version of a logo under a ShareAlike licence (the CC BY-SA family)`,
		`may itself only be shared under that licence, or one it declares compatible.`,
		``,
		`| Logo | Name in the pack | Licence | Source |`,
		`| --- | --- | --- | --- |`,
		...licensed.map(
			(brand) =>
				`| ${markdownText(brand.title)} | \`${brand.slug}\` | ${licenseCell(brand)} | ` +
				`${markdownLink(new URL(brand.source).hostname, brand.source)} |`,
		),
		``,
		// Only the texts some shipped logo actually answers to, in declared order.
		...SI_LICENSE_TEXTS.filter(({ spdx }) => byLicense.has(spdx)).flatMap(
			({ spdx, title, text }, position) => [
				...(position === 0
					? [
							`### Licence texts`,
							``,
							`The texts below apply to each logo marked with that licence in the table`,
							`above. The copyright notice each one refers to is the logo owner's own, as`,
							`stated at the source linked from the logo's row.`,
							``,
						]
					: []),
				`**${title}** (\`${spdx}\`)`,
				``,
				"```",
				...text,
				"```",
				``,
			],
		),
		`## Logos left out`,
		``,
		...(withheld.length === 0
			? [`Every logo in Simple Icons ${version} is in the pack.`, ``]
			: [
					`${count(withheld.length)} logos in Simple Icons ${version} are not in the pack. The reasons, each`,
					`of them something a downloaded icon pack cannot settle on its users' behalf:`,
					``,
					// Only the rules that actually kept something out, in the order
					// they are declared, so the list never explains a reason the
					// table below it does not use.
					...[...SI_WITHHELD_LICENSES, SI_WITHDRAWN_RULE]
						.filter((rule) => withheld.some((entry) => entry.rules.includes(rule)))
						.map((rule) => `- **${rule.reason}** — ${rule.because}.`),
					``,
					`Any of them can still be used in a callout by someone who has read its terms:`,
					`download the logo from its owner and add it under **Custom Icons**.`,
					``,
					`| Logo | Name upstream | Licence | Left out because |`,
					`| --- | --- | --- | --- |`,
					...withheld.map(
						({ brand, rules }) =>
							`| ${markdownText(brand.title)} | \`${brand.slug}\` | ${licenseCell(brand)} | ` +
							`${rules.map((rule) => rule.reason).join(", ")} |`,
					),
					``,
				]),
	];
	return lines.join("\n");
}

/**
 * Build the Simple Icons pack: brand logos, one path each.
 *
 * The slug is the icon's name — it is upstream's file name and its stable id,
 * the thing anyone who has used Simple Icons elsewhere already knows a logo by.
 * The title rides along as a label only where it says something the slug does
 * not (`Node.js` for `nodedotjs`, `AT&T` for `atandt`); for most brands the two
 * differ by capitals and spaces alone, which the search ignores anyway.
 */
function buildSimpleIcons() {
	const version = JSON.parse(
		readFileSync(join(SI_DIR, "package.json"), "utf8"),
	).version;
	const brands = JSON.parse(
		readFileSync(join(SI_DIR, "data/simple-icons.json"), "utf8"),
	);
	if (!Array.isArray(brands) || brands.length === 0) {
		throw new Error("simple-icons: data/simple-icons.json holds no brands");
	}

	const sorted = [...brands].sort((a, b) => (a.slug < b.slug ? -1 : 1));
	const known = new Set(sorted.map((brand) => brand.slug));
	for (const slug of SI_WITHDRAWN) {
		// A withdrawal that names nothing is a typo, or a logo upstream has since
		// dropped — either way the list is no longer saying what it seems to.
		if (!known.has(slug)) {
			throw new Error(`simple-icons: SI_WITHDRAWN names "${slug}", which upstream does not have`);
		}
	}

	const icons = {};
	const entries = [];
	const licensed = [];
	const withheld = [];

	for (const brand of sorted) {
		const { slug, title } = brand;
		if (typeof slug !== "string" || typeof title !== "string" || !title) {
			throw new Error(`simple-icons: malformed brand record ${JSON.stringify(brand).slice(0, 120)}`);
		}
		if (slug in icons) throw new Error(`simple-icons: duplicate slug "${slug}"`);

		const verdict = classifySimpleIcon(brand);
		if (!verdict.ship) {
			withheld.push({ brand, rules: verdict.rules });
			continue;
		}
		if (brand.license) licensed.push(brand);

		icons[slug] = { [SI_SIZE]: readSimpleIconSvg(slug) };
		entries.push({
			name: slug,
			...(labelAddsMeaning(slug, title) ? { label: title } : {}),
			categories: [], // Simple Icons has no taxonomy upstream.
			keywords: simpleIconKeywords(brand),
		});
	}

	return {
		id: "simple-icons",
		version,
		file: { icons },
		entries,
		note: `${entries.length} icons, ${withheld.length} more left out`,
		notices: {
			path: SI_NOTICES_FILE,
			text: simpleIconsNotices({
				version,
				total: sorted.length,
				shippedCount: entries.length,
				licensed,
				withheld,
			}),
		},
	};
}

// ── Emit ────────────────────────────────────────────────────────────────

function writePackFile(pack) {
	mkdirSync(PACK_DIR, { recursive: true });
	const body = {
		format: PACK_FORMAT,
		pack: pack.id,
		packVersion: pack.version,
		...pack.file,
	};
	// Compact: this file is downloaded over the network and parsed on device.
	const json = JSON.stringify(body);
	const path = join(PACK_DIR, `${pack.id}.json`);
	writeFileSync(path, json);
	const sha256 = createHash("sha256").update(json, "utf8").digest("hex");
	return { path, bytes: Buffer.byteLength(json, "utf8"), sha256 };
}

function writeIndexFile(pack, encoded) {
	mkdirSync(DATA_DIR, { recursive: true });
	const constant = `${pack.id.replace(/-/g, "_").toUpperCase()}_INDEX`;
	const source =
		`/**\n` +
		` * GENERATED FILE — do not edit.\n` +
		` *\n` +
		` * ${pack.id} search index (${pack.note}), packed by\n` +
		` * scripts/generate-icon-packs.mjs from upstream ${pack.version}.\n` +
		` * Decoded lazily by src/icons/data/codec.ts the first time the source is\n` +
		` * opened; until then it is inert string data.\n` +
		` *\n` +
		` * Regenerate with: npm run icons:generate -- --pack=${pack.id}\n` +
		` */\n` +
		`import type { EncodedIndex } from "./codec";\n\n` +
		`export const ${constant}: EncodedIndex = ${encodedIndexLiteral(encoded)};\n`;
	const path = join(DATA_DIR, `${pack.id}.index.ts`);
	writeFileSync(path, source);
	return { path, bytes: Buffer.byteLength(source, "utf8") };
}

/** Write a pack's licence notices, for the packs that have any to write. */
function writeNoticesFile(notices) {
	const path = join(ROOT, notices.path);
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, notices.text);
	return { path, bytes: Buffer.byteLength(notices.text, "utf8") };
}

/**
 * Decode what was just encoded and compare it to the source entries. The
 * encoder and decoder live in different files and different languages; this is
 * what keeps them honest.
 */
async function assertRoundTrip(entries, encoded) {
	const { createJiti } = await import("jiti");
	const jiti = createJiti(import.meta.url);
	const { decodeIndex } = await jiti.import(join(DATA_DIR, "codec.ts"));

	const decoded = decodeIndex(encoded);
	// A label identical to its name is dropped on the way in, deliberately —
	// see encodeIndex. Normalising both sides the same way keeps that from
	// reading as the encoder and decoder disagreeing, without excusing any
	// other difference.
	const normalize = (list) =>
		JSON.stringify(
			list.map((e) => ({
				name: e.name,
				label: e.label && e.label !== e.name ? e.label : undefined,
				categories: [...e.categories],
				keywords: [...e.keywords],
			})),
		);
	if (normalize(decoded.entries) !== normalize(entries)) {
		throw new Error("index round-trip mismatch: encoder and decoder disagree");
	}
	return decoded;
}

const BUILDERS = {
	material: buildMaterial,
	octicons: buildOcticons,
	"tabler-outline": () => buildTabler("outline"),
	"tabler-filled": () => buildTabler("filled"),
	"fa-solid": () => buildFontAwesome("solid"),
	"fa-regular": () => buildFontAwesome("regular"),
	"fa-brands": () => buildFontAwesome("brands"),
	"rpg-awesome": buildRpgAwesome,
	"simple-icons": buildSimpleIcons,
};

async function main() {
	const requested = process.argv
		.filter((a) => a.startsWith("--pack="))
		.map((a) => a.slice("--pack=".length));
	const ids = requested.length > 0 ? requested : Object.keys(BUILDERS);

	const manifest = {};
	for (const id of ids) {
		const build = BUILDERS[id];
		if (!build) throw new Error(`unknown pack "${id}"`);

		const pack = await build();
		pack.entries = pack.entries.map(cleanEntry);
		const encoded = encodeIndex(pack.entries);
		await assertRoundTrip(pack.entries, encoded);

		const packFile = pack.file ? writePackFile(pack) : null;
		const indexFile = writeIndexFile(pack, encoded);
		const noticesFile = pack.notices ? writeNoticesFile(pack.notices) : null;

		if (packFile) {
			manifest[id] = {
				version: pack.version,
				iconCount: pack.entries.length,
				bytes: packFile.bytes,
				sha256: packFile.sha256,
			};
		}

		const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
		console.log(
			`${id}: ${pack.entries.length} icons\n` +
				(packFile
					? `  pack  ${kb(packFile.bytes)}  ${packFile.path}\n`
					: `  pack  (none — artwork is fetched per icon)\n`) +
				`  index ${kb(indexFile.bytes)}  ${indexFile.path}` +
				(noticesFile
					? `\n  notices ${kb(noticesFile.bytes)}  ${noticesFile.path}`
					: "") +
				(packFile ? `\n  sha256 ${packFile.sha256}` : ""),
		);
	}

	if (Object.keys(manifest).length > 0) {
		console.log(`\nAdd/refresh these in src/icons/data/packManifest.ts:`);
		console.log(JSON.stringify(manifest, null, 2));
	}
}

await main();
