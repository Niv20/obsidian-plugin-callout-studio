/**
 * tests/cssSpecificity.test.ts — the number that decides who wins.
 *
 * This exists because the three regexes it replaced were *plausible*. They
 * ranked the three themes that happened to be installed when they were written
 * and mis-ranked five of the next fifty. So the centre of this suite is not the
 * synthetic cases — it is `REAL`, a set of selectors copied verbatim out of the
 * themes in the development vault, each pinned to a hand-computed specificity.
 * A future "simplification" that reintroduces either old bug fails here rather
 * than in a bug report about a badge that lies.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import {
	STUDIO_WEIGHT_BASE,
	STUDIO_WEIGHT_MAX,
	studioWeightFor,
} from "../src/manager/theme/studioWeight";
import {
	classCountOf,
	compareSpecificity,
	specificityOf,
	type Specificity,
} from "../src/utils/cssSpecificity";
import { blankNegations, splitSelectorList } from "../src/utils/selectorText";
import { calloutSelAt } from "../src/utils/calloutSelector";

describe("specificityOf — the three components", () => {
	it("counts classes, attributes and pseudo-classes as b", () => {
		assert.deepStrictEqual(specificityOf(".callout[data-callout=x]"), [
			0, 2, 0,
		]);
		assert.deepStrictEqual(specificityOf(".a.b.c"), [0, 3, 0]);
		assert.deepStrictEqual(specificityOf("li:first-child"), [0, 1, 1]);
	});

	it("counts elements and pseudo-elements as c, ids as a", () => {
		assert.deepStrictEqual(specificityOf("body div .callout"), [0, 1, 2]);
		assert.deepStrictEqual(specificityOf(".callout::before"), [0, 1, 1]);
		assert.deepStrictEqual(specificityOf("#app .callout"), [1, 1, 0]);
		assert.deepStrictEqual(specificityOf("* > .callout"), [0, 1, 0]);
	});

	it("treats a single-colon legacy pseudo-element as an element", () => {
		// `:before` is `c`, not `b`. Themes still write it.
		assert.deepStrictEqual(specificityOf(".callout:before"), [0, 1, 1]);
		assert.deepStrictEqual(specificityOf(".callout:hover"), [0, 2, 0]);
	});

	it("does not read a dot or colon inside an attribute value", () => {
		// The old regex counted `.b` here as a class.
		assert.deepStrictEqual(specificityOf('[data-callout="a.b"]'), [0, 1, 0]);
		assert.deepStrictEqual(
			specificityOf('[data-callout="a:hover"]'),
			[0, 1, 0],
		);
	});
});

describe("functional pseudo-classes", () => {
	it("gives :where() zero, contents included", () => {
		assert.strictEqual(classCountOf(".callout:where(.a.b.c)"), 1);
	});

	it("gives :where() zero even when the contents are nested", () => {
		// The exact bug: `:where\([^()]*\)` cannot match this, so the inner
		// attribute survived the strip and scored. Willemstad writes it.
		assert.strictEqual(
			classCountOf(':where(:is([data-callout="success"]))'),
			0,
		);
	});

	it("takes the max of :is() / :not() arguments, not the sum", () => {
		assert.strictEqual(classCountOf(":is(.a, .b.c, .d)"), 2);
		assert.strictEqual(classCountOf(":not(.a, .b.c)"), 2);
	});

	it("adds nothing for the functional pseudo-class itself", () => {
		// The other half of the old over-count: `:not(.x)` scored 2 (the
		// pseudo-class plus its contents) where CSS says 1.
		assert.strictEqual(classCountOf(":not(.x)"), 1);
		assert.strictEqual(classCountOf(".callout:not(.x)"), 2);
	});

	it("still counts a non-selector functional pseudo-class as one", () => {
		assert.strictEqual(classCountOf(":nth-child(2n + 1)"), 1);
		assert.strictEqual(classCountOf(".a:nth-of-type(3)"), 2);
	});

	it("descends into :has()", () => {
		assert.strictEqual(classCountOf(".callout:has(> .callout-title)"), 2);
	});
});

describe("splitSelectorList", () => {
	it("splits a plain list", () => {
		assert.deepStrictEqual(splitSelectorList(".a, .b"), [".a", " .b"]);
	});

	it("does not split inside a functional pseudo-class", () => {
		// ITS Theme's real selector. A plain `.split(",")` tears this in two and
		// scores a fragment that was never written.
		const its =
			"body:not(.default-callout-quote, .callout-no-quote) " +
			".callout.callout[data-callout=quote]";
		assert.deepStrictEqual(splitSelectorList(its), [its]);
	});

	it("does not split inside brackets or strings", () => {
		assert.strictEqual(splitSelectorList('[title="a,b"] .x').length, 1);
	});
});

describe("blankNegations", () => {
	it("blanks the contents of :not() and nothing else", () => {
		const out = blankNegations('*:not([data-callout="kanban"]) .callout');
		assert.ok(!out.includes("data-callout"));
		assert.ok(out.includes(".callout"));
		// Offsets are preserved so a caller can still index into the original.
		assert.strictEqual(out.length, '*:not([data-callout="kanban"]) .callout'.length);
	});

	it("leaves :is(), :where() and :has() alone", () => {
		for (const fn of ["is", "where", "has"]) {
			const sel = `.callout:${fn}([data-callout="x"])`;
			assert.ok(blankNegations(sel).includes("data-callout"), fn);
		}
	});

	it("handles a nested :not() inside :is()", () => {
		const out = blankNegations(':is(.a, :not([data-callout="x"]))');
		assert.ok(!out.includes("data-callout"));
	});
});

/**
 * Verbatim from the themes installed in the development vault, with the
 * specificity worked out by hand. The second number in each pair is what the
 * regexes this module replaced produced — kept in the comment, not asserted,
 * so the drift stays visible to whoever reads this next.
 */
const REAL: Array<{ theme: string; selector: string; expect: Specificity }> = [
	{
		// The heaviest callout selector in the vault, and the one that beats a
		// fixed STUDIO_WEIGHT_BASE of 8. AnuPpuccin repeats a class exactly
		// the way force mode does. (old scanner: b=11)
		theme: "AnuPpuccin",
		selector:
			".anp-callout-toggle.anp-callout-toggle.anp-callout-toggle" +
			".anp-callout-sleek.anp-callout-normal-toggle div.callout" +
			":not([data-callout-metadata*=revert])[data-callout=capacities-prop]" +
			" > .callout-title > .callout-title-inner",
		expect: [0, 10, 1],
	},
	{
		// AnuPpuccin's Vanilla Normal, the Style Settings option that draws the
		// vertical accent line. Measured because the core accent shim has to
		// LOSE to it — see manager/css/coreAccentShim.ts. Four class-units on
		// the box, five once the `> .callout-title` half is counted.
		theme: "AnuPpuccin (Vanilla Normal)",
		selector:
			".anp-callout-vanilla-normal .callout" +
			":not([data-callout-metadata*=anp-sleek],[data-callout-metadata*=anp-block])" +
			":not([data-callout-metadata*=revert],[data-callout=multi-column])" +
			" > .callout-title",
		expect: [0, 5, 0],
	},
	{
		// The lightest callout rule in the vault, and the whole reason the shim
		// suppresses a property a theme declares on a bare `.callout`: it ties
		// this exactly, and a tie goes to whoever comes last in the document.
		theme: "Obsidian gruvbox",
		selector: ".callout",
		expect: [0, 1, 0],
	},
	{
		// One class of guard — Minimal's "Outlined", Aura's origin layout. The
		// shim is deliberately one class-unit BELOW this, so these win outright
		// instead of tying and losing on source order.
		theme: "Minimal (Outlined)",
		selector: ".callouts-outlined .callout",
		expect: [0, 2, 0],
	},
	{
		// (old scanner: b=9 — it counted both :not()s twice over)
		theme: "Prism",
		selector:
			"body:not(.pt-disable-callout-styling) .callout" +
			":not(.cg-note-toolbar-callout)[data-callout=note]" +
			" > .callout-title .callout-icon .svg-icon",
		expect: [0, 7, 1],
	},
	{
		// The nested-:where() case. (old scanner: b=8)
		theme: "Willemstad",
		selector:
			'body:not(.ssopt-callout-standard).theme-dark .callout' +
			':where(:is([data-callout="success"])) .callout-title-inner',
		expect: [0, 4, 1],
	},
	{
		// Reached correctly rather than by luck: the old scanner arrived at 7
		// for ITS only because its `.split(",")` cut this selector in half.
		theme: "ITS Theme",
		selector:
			"body:not(.default-callout-quote, .callout-no-quote) " +
			".callout.callout[data-callout=quote][data-callout-metadata~=author]" +
			" .callout-content p:first-child",
		expect: [0, 7, 2],
	},
	{
		theme: "ITS Theme",
		selector:
			".callout.callout[data-callout=recite][data-callout-metadata*=bg-]" +
			":not([data-callout-metadata*=bg-c]) .callout-title",
		expect: [0, 6, 0],
	},
];

describe("real theme selectors", () => {
	for (const { theme, selector, expect } of REAL) {
		it(`${theme}: ${expect[1]} class-units`, () => {
			assert.deepStrictEqual(specificityOf(selector), expect);
		});
	}

	it("studio clears every one of them, were they !important", () => {
		// The property the whole model rests on: at weight w the light rule is
		// (0, w+1, 0), and b is compared before c, so clearing b is enough.
		// These selectors are measured as if the theme had marked them
		// `!important` — the only case weight has to answer, since ordinary
		// declarations lose to importance whatever their specificity.
		for (const { theme, selector } of REAL) {
			const b = classCountOf(selector);
			const w = studioWeightFor(b);
			assert.ok(
				w + 1 > b,
				`studio at weight ${w} does not clear ${theme}'s ${b}`,
			);
			assert.ok(w <= STUDIO_WEIGHT_MAX, theme);
		}
	});

	it("clears them ON TOP of !important, which is the point of both", () => {
		// The two levers answer different attacks, and the model only holds if
		// each does its own job:
		//
		//   theme rule, ordinary   → our `!important` wins at ANY specificity
		//   theme rule, !important → the cascade compares specificity again,
		//                            and the derived weight is what wins there
		//
		// So for every real theme selector, our rule has to be BOTH important
		// and heavier. Anything less loses one property out of several, which
		// is the split the two-mode model exists to eliminate.
		for (const { theme, selector } of REAL) {
			const b = classCountOf(selector);
			const ours = specificityOf(calloutSelAt("x", studioWeightFor(b)));
			assert.ok(
				compareSpecificity(ours, specificityOf(selector)) > 0,
				`${theme}: ${JSON.stringify(ours)} does not outrank ` +
					`${JSON.stringify(specificityOf(selector))}`,
			);
		}
	});

	it("a fixed weight of 8 would NOT have cleared AnuPpuccin", () => {
		// Pinning the bug the derivation replaced, so nobody reinstates a
		// constant.
		const b = classCountOf(REAL[0]?.selector ?? "");
		assert.ok(8 + 1 <= b, "AnuPpuccin no longer outranks weight 8");
		assert.ok(studioWeightFor(b) + 1 > b);
	});
});

describe("compareSpecificity", () => {
	it("orders a before b before c", () => {
		assert.ok(compareSpecificity([1, 0, 0], [0, 9, 9]) > 0);
		assert.ok(compareSpecificity([0, 3, 0], [0, 2, 9]) > 0);
		assert.ok(compareSpecificity([0, 2, 1], [0, 2, 0]) > 0);
		assert.strictEqual(compareSpecificity([0, 2, 0], [0, 2, 0]), 0);
	});
});

describe("studioWeightFor", () => {
	it("stays at the base when no theme rule is !important", () => {
		// The common case. `!important` alone beats every ordinary theme rule,
		// so a heavier selector would cost every vault sheet size to win a
		// contest already won — see STUDIO_WEIGHT_BASE.
		assert.strictEqual(studioWeightFor(0), STUDIO_WEIGHT_BASE);
	});

	it("clears the theme by two once it matters", () => {
		assert.strictEqual(studioWeightFor(5), 6);
		assert.strictEqual(studioWeightFor(8), 9);
		assert.strictEqual(studioWeightFor(10), 11);
	});

	it("clamps at the ceiling", () => {
		assert.strictEqual(studioWeightFor(999), STUDIO_WEIGHT_MAX);
	});
});
