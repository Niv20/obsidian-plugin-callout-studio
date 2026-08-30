/**
 * tests/modalSurfaces.test.ts — what a Callout Studio window is painted with.
 *
 * Inside a chromed modal, a surface meant to read as flush with the window
 * paints `var(--cs-surface, var(--background-primary))`, and anything meant to
 * read as *raised off* it paints `var(--cs-surface-raised,
 * var(--background-secondary))`. Never the raw variables.
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
 * The tokens are a **pair** and must move together: `--background-secondary` is
 * the raised shade only while `--modal-background` is `--background-primary`,
 * and mobile dark is where that stops being true. Setting one alone is how the
 * group boxes regressed — the body moved onto `--cs-surface` while the header
 * strip stayed pinned to `--background-secondary`, which on that platform IS
 * the window, so the strip disappeared into it.
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
						/var\(\s*--cs-surface-raised\s*,\s*var\(\s*--background-secondary\s*\)\s*\)/g,
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
			rules.some((r) => r.selector === ".is-mobile.theme-dark .modal.cs-modal"),
			"the mobile-dark override was not reached",
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
				"use var(--cs-surface-raised, var(--background-secondary)) instead",
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
	it("only ever inside a chromed window", () => {
		// Defined nowhere else on purpose: outside one, both are undefined and
		// every call site falls through to the old behaviour — which is what the
		// settings tab, painted `--background-primary` by Obsidian itself, wants.
		for (const rule of definingRules) {
			assert.ok(
				rule.selector.includes("cs-modal"),
				`${rule.selector} defines a surface token outside a window`,
			);
		}
	});

	it("introduced together, in exactly one place", () => {
		const both = definingRules.filter(
			(r) => defines(r, "--cs-surface") && defines(r, "--cs-surface-raised"),
		);
		assert.deepStrictEqual(
			both.map((r) => r.selector),
			[".modal.cs-modal"],
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

	it("re-derives the raised half off the surface rather than naming a colour", () => {
		// The one override that redefines a single token. It steps off
		// `--cs-surface` — which it is guaranteed to inherit, being scoped inside
		// the same window — so it reproduces the desktop's own step on whatever
		// the window turns out to be, and survives a theme repointing
		// `--modal-background` again.
		const alone = definingRules.filter(
			(r) => defines(r, "--cs-surface-raised") && !defines(r, "--cs-surface"),
		);
		assert.deepStrictEqual(alone.map((r) => r.selector), [
			".is-mobile.theme-dark .modal.cs-modal",
		]);
		for (const rule of alone) {
			assert.match(rule.declarations, /var\(\s*--cs-surface\s*[),]/);
		}
	});
});

describe("every call site carries its own half's fallback", () => {
	// The fallback is not decoration: it is what keeps the tokens invisible
	// outside a window. Pairing the wrong one would repaint the settings tab.
	const callSites = css
		.split(";")
		.filter((decl) => /var\(\s*--cs-surface/.test(decl))
		.filter((decl) => !/--cs-surface(-raised)?\s*:/.test(decl));

	it("found the call sites", () => {
		assert.ok(callSites.length >= 20, `only ${callSites.length} found`);
	});

	for (const [index, decl] of callSites.entries()) {
		const flat = decl.replace(/\s+/g, " ").trim();
		it(`#${index + 1} ${flat.slice(0, 60)}`, () => {
			const surface = flat.match(/var\(\s*--cs-surface\s*,[^)]*\)[^)]*\)/g);
			const raised = flat.match(
				/var\(\s*--cs-surface-raised\s*,[^)]*\)[^)]*\)/g,
			);
			for (const use of raised ?? []) {
				assert.match(use, /var\(--cs-surface-raised, var\(--background-secondary\)\)/);
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

describe("a disabled text field stays raised off the window", () => {
	// The greyed-out state of the editor's two text fields — the display name of
	// a built-in, and the IDs field while the name is linked to the id. Disabled
	// is meant to read as "a control you cannot use", so the fill has to stay a
	// step *above* whatever is behind it. `--background-secondary` is that step
	// only while `--modal-background` is `--background-primary`; mobile dark
	// points the modal AT `--background-secondary`, so the fill landed on the
	// window and the field read as a hole rather than as a control.
	const RAISED = "var(--cs-surface-raised, var(--background-secondary))";

	it("the display-name field in the callout editor", () => {
		assert.strictEqual(
			declaration(
				ruleFor(
					'.callout-studio-editor .setting-item-control input[type="text"]:not(.cs-tag-input-field):disabled',
				),
				"background",
			),
			`background: ${RAISED}`,
		);
	});

	it("the Callout IDs field directly below it", () => {
		// Asserted separately rather than looped over, because the pairing is the
		// point: these two fields were given matching box models on purpose (see
		// the comment on `.cs-tag-input-field`), and fixing one without the other
		// would make them disagree on mobile dark alone — the hardest place to
		// notice and the only place it shows.
		assert.strictEqual(
			declaration(
				ruleFor(".cs-tag-input-row > .cs-tag-input-field:disabled"),
				"background",
			),
			`background: ${RAISED}`,
		);
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

	// Deliberate, and the settings tab again — but for the opposite reason to
	// the entry above. This is the last layer of the floor under the three
	// pinned section bands (see 166 in `modalBodyLayers.test.ts`), painted
	// *under* `--modal-background`, which is itself under the band's own
	// inherited paint. So it is never what anyone sees unless a theme has made
	// both of the surfaces above it see-through — and being the layer that
	// cannot itself be transparent is the whole of its job. A window token
	// would be undefined in this scope in any case.
	"body:not(.is-phone) .callout-studio-settings .cs-sticky-heading.setting-item::before | background-color",
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
 * The same review list for the raised half — and it is **empty**, which is a
 * stronger statement than the flush list can make.
 *
 * There is no equivalent of the settings tab here. A surface wanting the raised
 * shade wants it *relative to whatever it is sitting on*, and
 * `--background-secondary` only answers that while `--modal-background` is
 * `--background-primary` — so unlike `--background-primary`, which is genuinely
 * the right answer for a note or for the settings tab, there is no context in
 * which naming this one raw is correct. An entry here would be a bug awaiting
 * triage, not a decision; the empty list says so.
 */
const KNOWN_RAW_SECONDARY: string[] = [];

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
