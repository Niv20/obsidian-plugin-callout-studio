/**
 * tests/modalSurfaces.test.ts — what a Callout Studio window is painted with.
 *
 * Inside a chromed modal, a surface meant to read as flush with the window
 * paints `var(--cs-surface, var(--background-primary))`, and anything meant to
 * read as *raised off* it paints `var(--cs-surface-raised,
 * var(--setting-items-background))`. Never the raw variables.
 *
 * The raised half is Obsidian's own box colour, `--setting-items-background`,
 * so a plugin box and an Obsidian settings box in one window are one grey.
 *
 * The two are the same colour on the desktop, which is exactly what hid the bug
 * for so long. Mobile dark redefines `--color-base-00` to a true `#000` for
 * OLED, and `.is-mobile.theme-dark` — phone *and* tablet — moves
 * `--modal-background` off it onto `--background-secondary`. So every band
 * painted `--background-primary` matched the window on every machine anyone
 * looked at, and came out as a pure-black stripe across an iPad in dark mode.
 * Nothing here reproduces on a desktop, which is why it is a source rule rather
 * than a rendering test.
 *
 * The tokens are a **pair** and must move together. Setting one alone is how
 * the group boxes once regressed — the body moved onto `--cs-surface` while the
 * header strip stayed pinned to `--background-secondary`, which on mobile dark
 * IS the window, so the strip disappeared into it. Obsidian's box colour has no
 * such trap: it steps itself off the window on every device.
 *
 * What this file can and cannot see is worth being exact about. A CSS selector
 * says where a rule applies, not where the element ends up: `.cs-color-circle`
 * is rendered both in the settings tab and inside the callout editor, and its
 * selector cannot tell you which. So the invariant is checked three ways —
 * rules *scoped* to `.cs-modal` are checked outright; the handful whose selector
 * straddles the boundary are named one at a time in the middle of this file,
 * with the reasoning for each written beside it; and every other rule of this
 * plugin's that paints a raw variable is pinned in one of the two review lists
 * near the bottom. What those lists buy is that a new one cannot appear without
 * somebody deciding whether it is deliberate.
 */
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

/* -------------------------------------------------------------------------- */
/* A very small stylesheet reader                                             */
/* -------------------------------------------------------------------------- */

type Rule = { selector: string; declarations: string };

/**
 * Every style rule in the file, flattened — `@media` and `@supports` blocks are
 * descended into rather than treated as one rule, or a declaration nested in
 * one would be invisible to every assertion below and the suite would pass by
 * not looking.
 *
 * Comments are stripped first. `styles.css` explains itself at length, and it
 * names variables in prose that the rules deliberately no longer use.
 */
function parseRules(css: string): Rule[] {
	const out: Rule[] = [];
	let depth = 0;
	let buffer = "";
	let selector = "";
	let blockStart = 0;

	for (let i = 0; i < css.length; i++) {
		const char = css[i];
		if (char === "{") {
			if (depth === 0) {
				selector = buffer.trim();
				blockStart = i + 1;
			}
			depth++;
		} else if (char === "}") {
			depth--;
			if (depth === 0) {
				const body = css.slice(blockStart, i);
				if (selector.startsWith("@")) out.push(...parseRules(body));
				else out.push({ selector, declarations: body });
				buffer = "";
				continue;
			}
		}
		if (depth === 0) buffer += char;
	}
	return out;
}

const css = readFileSync(join(process.cwd(), "styles.css"), "utf8").replace(
	/\/\*[\s\S]*?\*\//g,
	"",
);
const rules = parseRules(css);

const RAW_PRIMARY = /var\(\s*--background-primary\s*\)/;
const RAW_SECONDARY = /var\(\s*--background-secondary\s*\)/;

/** The token declarations themselves, which name the raw variable by design. */
const IS_TOKEN_DECL = /^--cs-surface(-raised)?\s*:/;

/**
 * The properties in `rule` that paint `raw` directly.
 *
 * Two things are deliberately not counted. The sanctioned
 * `var(--cs-surface, var(--background-primary))` form mentions the raw variable
 * as its *fallback*, which is the whole point of it; and the two token
 * declarations name it as their value, which is where the indirection is set up
 * in the first place. Counting either would make the rule unsatisfiable.
 */
function rawPaints(rule: Rule, raw: RegExp): string[] {
	return rule.declarations
		.split(";")
		.map((decl) => decl.trim())
		.filter((decl) => decl.length > 0 && !IS_TOKEN_DECL.test(decl))
		.filter((decl) =>
			raw.test(
				decl
					.replace(
						/var\(\s*--cs-surface\s*,\s*var\(\s*--background-primary\s*\)\s*\)/g,
						"",
					)
					.replace(
						/var\(\s*--cs-surface-raised\s*,\s*var\(\s*--setting-items-background\s*\)\s*\)/g,
						"",
					),
			),
		)
		.map((decl) => decl.split(":")[0]?.trim() ?? "");
}

describe("the stylesheet reader itself", () => {
	// Guards every assertion below: a parser that found nothing would make the
	// whole file vacuously green.
	it("found a substantial number of rules", () => {
		assert.ok(rules.length > 500, `only ${rules.length} rules parsed`);
	});

	it("descends into media queries", () => {
		assert.ok(
			rules.some((r) => r.selector === ".callout-studio-row-buttons button:not(.clickable-icon):hover"),
			"a rule nested in @media (hover: hover) was not reached",
		);
		assert.strictEqual(
			rules.some((r) => r.selector.startsWith("@")),
			false,
		);
	});
});

/* -------------------------------------------------------------------------- */
/* Rules that say, in their own selector, that they are inside a window        */
/* -------------------------------------------------------------------------- */

const scopedRules = rules.filter((r) => r.selector.includes("cs-modal"));

describe("a rule scoped to a chromed window never paints the raw variables", () => {
	it("found the scoped rules", () => {
		assert.ok(scopedRules.length >= 10, `only ${scopedRules.length} found`);
	});

	for (const rule of scopedRules) {
		const label = rule.selector.replace(/\s+/g, " ");

		it(`${label} does not paint --background-primary`, () => {
			assert.deepStrictEqual(
				rawPaints(rule, RAW_PRIMARY),
				[],
				"use var(--cs-surface, var(--background-primary)) instead",
			);
		});

		it(`${label} does not paint --background-secondary`, () => {
			// The raised half of the pair, and the one that actually regressed:
			// on mobile dark that variable IS the window.
			assert.deepStrictEqual(
				rawPaints(rule, RAW_SECONDARY),
				[],
				"use var(--cs-surface-raised, var(--setting-items-background)) instead",
			);
		});
	}
});

/* -------------------------------------------------------------------------- */
/* The pair                                                                   */
/* -------------------------------------------------------------------------- */

const defines = (rule: Rule, token: string): boolean =>
	new RegExp(`${token}\\s*:`).test(rule.declarations);

const definingRules = rules.filter(
	(r) => defines(r, "--cs-surface") || defines(r, "--cs-surface-raised"),
);

describe("--cs-surface and --cs-surface-raised are defined as a pair", () => {
	it("only ever inside a chromed window or one of Obsidian's settings boxes", () => {
		// Defined nowhere else on purpose: outside these, both are undefined and
		// every call site falls through to its fallback. In a settings box the
		// surface is the box (finding S7-03), so a colour dot's ring matches it.
		for (const rule of definingRules) {
			assert.ok(
				rule.selector.includes("cs-modal") || rule.selector === ".setting-group .setting-items",
				`${rule.selector} defines a surface token outside a window or a settings box`,
			);
		}
	});

	it("introduced together, in exactly those two places", () => {
		const both = definingRules.filter(
			(r) => defines(r, "--cs-surface") && defines(r, "--cs-surface-raised"),
		);
		assert.deepStrictEqual(
			both.map((r) => r.selector),
			[".modal.cs-modal", ".setting-group .setting-items"],
		);
	});

	it("never has the flush half moved on its own", () => {
		// Moving `--cs-surface` while the raised one stays pinned to
		// `--background-secondary` is precisely the group-box regression.
		const alone = definingRules.filter(
			(r) => defines(r, "--cs-surface") && !defines(r, "--cs-surface-raised"),
		);
		assert.deepStrictEqual(alone.map((r) => r.selector), []);
	});

	it("takes the raised half from Obsidian's own box colour, with no device override", () => {
		// Obsidian steps `--setting-items-background` off the window on every
		// device itself (on mobile dark it is `--color-secondary-2`, a shade off
		// the `--background-secondary` that there IS the window), so there is no
		// override of the raised half left to keep in step.
		const alone = definingRules.filter(
			(r) => defines(r, "--cs-surface-raised") && !defines(r, "--cs-surface"),
		);
		assert.deepStrictEqual(alone.map((r) => r.selector), []);
		const pair = definingRules.find((r) => r.selector === ".modal.cs-modal");
		assert.ok(pair);
		assert.match(pair.declarations, /--cs-surface-raised\s*:\s*var\(--setting-items-background\)/);
	});
});

describe("every call site carries its own half's fallback", () => {
	// The fallback is not decoration: it is what keeps the tokens invisible
	// outside a window. Pairing the wrong one would repaint the settings tab.
	const callSites = css
		.split(";")
		.filter((decl) => /var\(\s*--cs-surface/.test(decl))
		.filter((decl) => !/--cs-surface(-raised)?\s*:/.test(decl));

	// A floor, so a parser that found nothing cannot pass vacuously. It falls
	// as windows move onto Obsidian's own surfaces (22 → 19 when the import
	// cards lost their fill, 2026-10-24); lower it with them, never to zero.
	it("found the call sites", () => {
		assert.ok(callSites.length >= 12, `only ${callSites.length} found`);
	});

	for (const [index, decl] of callSites.entries()) {
		const flat = decl.replace(/\s+/g, " ").trim();
		it(`#${index + 1} ${flat.slice(0, 60)}`, () => {
			const surface = flat.match(/var\(\s*--cs-surface\s*,[^)]*\)[^)]*\)/g);
			const raised = flat.match(
				/var\(\s*--cs-surface-raised\s*,[^)]*\)[^)]*\)/g,
			);
			for (const use of raised ?? []) {
				assert.match(use, /var\(--cs-surface-raised, var\(--setting-items-background\)\)/);
			}
			for (const use of surface ?? []) {
				if (use.startsWith("var(--cs-surface-raised")) continue;
				assert.match(use, /var\(--cs-surface, var\(--background-primary\)\)/);
			}
		});
	}
});

/* -------------------------------------------------------------------------- */
/* Rules whose selector cannot place them, resolved one at a time             */
/* -------------------------------------------------------------------------- */

/** The one rule written exactly as `selector`, with its whitespace flattened. */
function ruleFor(selector: string): Rule {
	const found = rules.filter(
		(r) => r.selector.replace(/\s+/g, " ") === selector,
	);
	assert.strictEqual(
		found.length,
		1,
		`expected exactly one \`${selector}\` rule, found ${found.length}`,
	);
	return found[0] as Rule;
}

/** `rule`'s declaration for `property`, flattened, or "" when it sets none. */
function declaration(rule: Rule, property: string): string {
	const decl = rule.declarations
		.split(";")
		.map((d) => d.trim())
		.find((d) => d.split(":")[0]?.trim() === property);
	return (decl ?? "").replace(/\s+/g, " ");
}

describe("the swatch widget follows the surface it is drawn on", () => {
	// `renderColorCircles` (src/ui/ColorCircles.ts) has four call sites, and they
	// straddle the boundary this file is about: the settings rows and the custom
	// palettes section are in the settings tab, while the callout editor's
	// trigger swatch and every one of its palette-menu items are inside a chromed
	// window. One rule serves all four, so it has to name the token rather than
	// either concrete colour — the fallback is what keeps the settings tab
	// unchanged.
	it("the ring around a circle is a cut-out of the window, not of the note", () => {
		// A `box-shadow` cut-out that paints something other than what is behind
		// it stops being a cut-out and becomes a halo. On mobile dark
		// `--background-primary` is a true `#000` while the modal is not, so the
		// raw variable drew exactly that halo, in black, around every swatch in
		// the editor.
		assert.strictEqual(
			declaration(ruleFor(".cs-color-circle"), "box-shadow"),
			"box-shadow: 0 0 0 1.5px var(--cs-surface, var(--background-primary))",
		);
	});

	it('the "no background" checkerboard is woven out of that same surface', () => {
		// Both tones: the pale square is a `color-mix` toward the surface and the
		// other square IS the surface. Fixing one alone would leave the pattern
		// mixing a colour from one window against a colour from another.
		const decl = declaration(
			ruleFor(".cs-color-circle.is-transparent"),
			"background-image",
		);
		assert.match(decl, /^background-image: repeating-conic-gradient\(/);
		assert.strictEqual(
			decl.match(/var\(--cs-surface, var\(--background-primary\)\)/g)?.length,
			2,
			`both stops must name the token — got: ${decl}`,
		);
	});
});

describe("a disabled text field is Obsidian's own", () => {
	// The greyed-out state of the editor's two text fields — the display name of
	// a built-in, and the IDs field while the name is linked to the id. These
	// used to paint a raised fill of their own. Text fields are now Obsidian's
	// (decision 14 of the native-look plan), and Obsidian draws a disabled field
	// as its normal field at half opacity, so no rule of ours may fill one.
	it("is not filled by any rule of the plugin", () => {
		// A selector that styles a disabled `input` element itself — not one that
		// merely says `:not(:disabled)` or names "input" inside a class.
		const disabledInput = /(?:^|[\s>])input\b[^\s>,]*(?<!:not\():disabled/;
		const fills = rules.filter(
			(r) => disabledInput.test(r.selector)
				&& !/cs-combobox|cs-dropdown/.test(r.selector)
				&& /^(background|background-color)$/m.test(
					r.declarations.split(";").map((d) => d.split(":")[0]?.trim() ?? "").join("\n"),
				),
		);
		assert.deepStrictEqual(fills.map((r) => r.selector.replace(/\s+/g, " ")), []);
	});
});

/* -------------------------------------------------------------------------- */
/* Everything else that paints the raw surface colour                          */
/* -------------------------------------------------------------------------- */

/**
 * Every rule of this plugin's own that paints `--background-primary` raw, as
 * `selector | property`.
 *
 * This is a review list, not a ban. A rule reaches it because its selector does
 * not say whether the element is inside a window, so only a person can answer
 * whether the raw variable is right — and the list is here so that a fourth
 * entry has to be added by hand, with a reason, rather than appearing.
 *
 * Every entry left is deliberate. The two that were not — the swatch ring and
 * its transparency checkerboard — are fixed, and are now asserted positively
 * above rather than merely tolerated here.
 */
const KNOWN_RAW_PRIMARY = [
	// Deliberate. Both emulate a NOTE surface rather than the window, and a note
	// really is painted `--background-primary` — the live preview would stop
	// being 1:1 with the editor if it followed the modal instead.
	".cs-live-preview-body | background",
	".cs-gap-demo | background",

	// Deliberate. The settings tab only, which Obsidian itself paints
	// `--background-primary`; there is no `--cs-surface` in scope there and the
	// fallback would resolve to the same colour anyway.
	".callout-studio-row-syntax | background",
];

describe("nothing else paints --background-primary unexamined", () => {
	const found = rules
		// This plugin's own rules. A bare Obsidian selector here would be a rule
		// about the app's surfaces, which is a different question.
		.filter((r) => /\.(cs-|callout-studio-)/.test(r.selector))
		.flatMap((r) =>
			rawPaints(r, RAW_PRIMARY).map(
				(prop) => `${r.selector.replace(/\s+/g, " ")} | ${prop}`,
			),
		);

	it("matches the reviewed list exactly", () => {
		assert.deepStrictEqual(found.sort(), [...KNOWN_RAW_PRIMARY].sort());
	});
});

/**
 * The same review list for `--background-secondary`. Inside a window naming it
 * raw is never right — the raised half is Obsidian's box colour — so every
 * entry here is outside one, or is not a window surface at all, and says why.
 */
const KNOWN_RAW_SECONDARY: string[] = [
	// Deliberate, and not a window surface: a dropdown's list is drawn as
	// Obsidian draws its menus, on `--menu-background`. `--background-secondary`
	// is only the fallback, and it is the value Obsidian itself gives that
	// token, so a list looks like Obsidian's menus even inside a window.
	".cs-combobox-menu, .cs-palette-menu | --cs-menu-face",
];

describe("nothing else paints --background-secondary unexamined", () => {
	const found = rules
		.filter((r) => /\.(cs-|callout-studio-)/.test(r.selector))
		.flatMap((r) =>
			rawPaints(r, RAW_SECONDARY).map(
				(prop) => `${r.selector.replace(/\s+/g, " ")} | ${prop}`,
			),
		);

	it("matches the reviewed list exactly", () => {
		assert.deepStrictEqual(found.sort(), [...KNOWN_RAW_SECONDARY].sort());
	});
});
