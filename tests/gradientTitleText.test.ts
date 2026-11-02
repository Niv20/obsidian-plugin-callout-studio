/**
 * tests/gradientTitleText.test.ts — the per-grapheme print fallback for swept
 * titles.
 *
 * Chromium's print engine does not support `-webkit-background-clip: text`, so
 * a gradient title exports as garbage. The workaround is to wrap every grapheme
 * of the title in its own span carrying a solid colour sampled along the sweep,
 * which a print-only rule switches to. On screen the spans are inert.
 *
 * That makes this module a rewriter of *someone else's* DOM, and the assertions
 * below are about the three ways that can go wrong:
 *
 * - **The sample must match what CSS paints.** Colours are taken by grapheme
 *   index, never by measured geometry, because Obsidian's PDF export renders
 *   into a DOM that was never laid out. A single grapheme takes the midpoint
 *   rather than a bare start colour, and an RTL title flips the ramp — CSS
 *   gradient angles are physical, so every preset direction runs left→right
 *   while an RTL title's first logical character sits on the right.
 * - **A grapheme is a grapheme, not a code unit.** Splitting an emoji in half
 *   would put half a surrogate pair in each of two spans and print mojibake.
 *   `Intl.Segmenter` does the work; the fallback for a realm without it splits
 *   by code point, which is weaker (a skin-tone modifier separates) but still
 *   cannot break a pair.
 * - **Nothing that already has a sweep of its own may be touched.** A nested
 *   inline pill inside a swept heading title has its own colours and its own
 *   pass; icons stay solid. Those glyphs are excluded from the wrap, from the
 *   ramp, and from the clear.
 *
 * `applyTitleGradient` is the one decision point both render surfaces share, so
 * its cascade is pinned here too — in particular that dark mode reuses the
 * *whole* light pair when the palette never set a dark end colour, rather than
 * pairing a dark start with a light end.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
// Listed first: importing it installs the DOM globals (`createSpan`,
// `createFragment`) before anything under test loads.
import { fakeDom, html, asEl, type FakeElement } from "./support/fakeDom";
import {
	CSS_GRAD_CHAR,
	applyTitleGradient,
	clearGradientChars,
	paintGradientChars,
} from "../src/reading/gradientTitleText";
import type { BgGradient, CalloutDefinition } from "../src/types";

/* -------------------------------------------------------------------------- */
/* Harness                                                                    */
/* -------------------------------------------------------------------------- */

/** The char spans of `root`, in document order. */
const spans = (root: FakeElement): FakeElement[] => root.querySelectorAll(`.${CSS_GRAD_CHAR}`);

/** What each char span holds — one grapheme apiece. */
const letters = (root: FakeElement): string[] => spans(root).map((span) => span.textContent);

/** The sampled colour on each char span, in order. */
const colors = (root: FakeElement): string[] => spans(root).map((span) => span.style.getPropertyValue("--cs-gch"));

/** Paint a plain text title and hand the element back. */
function painted(text: string, from = "#000000", to = "#ffffff"): FakeElement {
	const root = html(`<span class="cs-heading-title">${text}</span>`);
	paintGradientChars(asEl(root), from, to);
	return root;
}

function definition(over: Partial<CalloutDefinition> = {}): CalloutDefinition {
	return {
		id: "quiet",
		displayName: "Quiet",
		icon: { type: "lucide", value: "pencil" },
		colorLight: "#112233",
		colorDark: "#445566",
		foldable: false,
		defaultFolded: false,
		builtIn: false,
		source: "user",
		...over,
	};
}

/** A gradient with the text sweep switched on — the only state that paints. */
function sweep(over: Partial<BgGradient> = {}): BgGradient {
	return {
		angleDeg: 90,
		toColorLight: "#eeeeee",
		toColorDark: "#222222",
		textGradient: true,
		textToColorLight: "#aabbcc",
		...over,
	};
}

/** Run `fn` with `<body>` in dark mode, and put the theme back afterwards. */
function inDark<T>(fn: () => T): T {
	fakeDom.dark();
	try {
		return fn();
	} finally {
		fakeDom.light();
	}
}

/* -------------------------------------------------------------------------- */
/* paintGradientChars — the wrapping                                          */
/* -------------------------------------------------------------------------- */

describe("paintGradientChars — wrapping", () => {
	it("gives every grapheme its own span", () => {
		const root = painted("abc");

		assert.deepStrictEqual(letters(root), ["a", "b", "c"]);
		assert.strictEqual(root.textContent, "abc");
	});

	it("wraps the spaces too, so the ramp advances across them", () => {
		// The sweep CSS paints across the whole box; skipping the gaps would make
		// the printed ramp step at a different rate than the screen one.
		assert.deepStrictEqual(letters(painted("a b")), ["a", " ", "b"]);
	});

	it("is idempotent — a second paint re-colours rather than re-wraps", () => {
		const root = painted("abc");
		paintGradientChars(asEl(root), "#ff0000", "#ff0000");

		assert.deepStrictEqual(letters(root), ["a", "b", "c"]);
		assert.deepStrictEqual(colors(root), ["#ff0000", "#ff0000", "#ff0000"]);
	});

	it("re-wraps whatever a name rewrite stripped", () => {
		// The token's name span is rewritten wholesale when a display name
		// changes, which throws the char spans away. The next paint has to
		// rebuild them rather than assume they survived.
		const root = painted("abc");
		root.textContent = "De";
		paintGradientChars(asEl(root), "#000000", "#ffffff");

		assert.deepStrictEqual(letters(root), ["D", "e"]);
	});

	it("reaches text inside ordinary inline markup", () => {
		// `## [!tip] a **b**` — the bold is part of the title and is swept with
		// the rest of it.
		const root = html(`<span class="cs-heading-title">a<strong>b</strong>c</span>`);
		paintGradientChars(asEl(root), "#000000", "#ffffff");

		assert.deepStrictEqual(letters(root), ["a", "b", "c"]);
		assert.deepStrictEqual(colors(root), ["#000000", "#808080", "#ffffff"]);
	});

	it("does nothing at all to an element with no text", () => {
		const root = html(`<span class="cs-heading-title"></span>`);
		assert.doesNotThrow(() => paintGradientChars(asEl(root), "#000", "#fff"));
		assert.strictEqual(spans(root).length, 0);
	});
});

/* -------------------------------------------------------------------------- */
/* paintGradientChars — the ramp                                              */
/* -------------------------------------------------------------------------- */

describe("paintGradientChars — the ramp", () => {
	it("samples by index, from the first grapheme to the last", () => {
		assert.deepStrictEqual(colors(painted("abcd")), ["#000000", "#555555", "#aaaaaa", "#ffffff"]);
	});

	it("gives a single grapheme the midpoint, not the start colour", () => {
		// `i / (n - 1)` is 0/0 for one span. The start colour would read as "the
		// gradient never applied", which is the one thing a print fallback must
		// not look like.
		assert.deepStrictEqual(colors(painted("x")), ["#808080"]);
	});

	it("ends exactly on the end colour, never short of it", () => {
		const ramp = colors(painted("abcdefghij"));
		assert.strictEqual(ramp[0], "#000000");
		assert.strictEqual(ramp.at(-1), "#ffffff");
	});

	it("runs the ramp backwards for an RTL title", () => {
		// CSS gradient angles are physical: the preset directions all run
		// left→right, and an RTL title's first logical character is on the right.
		assert.deepStrictEqual(colors(painted("אבג")), ["#ffffff", "#808080", "#000000"]);
	});

	it("lets the first strong character decide, not the first character", () => {
		// A leading digit, quote or space is directionally neutral.
		assert.deepStrictEqual(colors(painted("1 א")).at(0), "#ffffff");
		assert.deepStrictEqual(colors(painted("1 a")).at(0), "#000000");
	});

	it("treats a title with no strong character as LTR", () => {
		assert.deepStrictEqual(colors(painted("123")), ["#000000", "#808080", "#ffffff"]);
	});

	it("reads Latin, Greek and Cyrillic as strong LTR", () => {
		for (const text of ["ab", "αβ", "аб"]) {
			assert.deepStrictEqual(colors(painted(text)), ["#000000", "#ffffff"], text);
		}
	});

	it("reads Hebrew and Arabic as strong RTL", () => {
		for (const text of ["אב", "ابت"]) {
			assert.strictEqual(colors(painted(text))[0], "#ffffff", text);
		}
	});
});

/* -------------------------------------------------------------------------- */
/* Graphemes                                                                  */
/* -------------------------------------------------------------------------- */

describe("paintGradientChars — graphemes", () => {
	it("keeps a surrogate-pair emoji whole", () => {
		const root = painted("a👍b");
		assert.deepStrictEqual(letters(root), ["a", "👍", "b"]);
	});

	it("keeps a skin-tone emoji whole", () => {
		assert.deepStrictEqual(letters(painted("👍🏽")), ["👍🏽"]);
	});

	it("keeps a ZWJ sequence whole", () => {
		// A family emoji is five code points and one drawing; split, it prints as
		// three separate people.
		assert.deepStrictEqual(letters(painted("👨‍👩‍👧")), ["👨‍👩‍👧"]);
	});

	it("keeps a combining mark with the letter it modifies", () => {
		assert.deepStrictEqual(letters(painted("éx")), ["é", "x"]);
	});

	it("still never splits a surrogate pair without Intl.Segmenter", () => {
		// The fallback is code points, which is weaker — a skin-tone modifier
		// becomes its own span — but a half-emoji is impossible either way, and
		// that is the property that matters for what gets printed.
		const intl = Intl as unknown as { Segmenter?: unknown };
		const saved = intl.Segmenter;
		delete intl.Segmenter;
		try {
			assert.deepStrictEqual(letters(painted("a👍b")), ["a", "👍", "b"]);
			assert.deepStrictEqual(letters(painted("👍🏽")), ["👍", "🏽"]);
		} finally {
			intl.Segmenter = saved;
		}
	});
});

/* -------------------------------------------------------------------------- */
/* Nested tokens                                                              */
/* -------------------------------------------------------------------------- */

describe("paintGradientChars — what it refuses to touch", () => {
	/** A swept heading title with a nested inline pill inside it. */
	const withPill = (): FakeElement =>
		html(
			`<span class="cs-heading-title">a<span class="cs-inline-callout">` +
				`<span class="cs-callout-icon">i</span>` +
				`<span class="cs-callout-name">Tip</span></span>b</span>`,
		);

	it("leaves a nested pill's glyphs out of the wrap", () => {
		const root = withPill();
		paintGradientChars(asEl(root), "#000000", "#ffffff");

		assert.deepStrictEqual(letters(root), ["a", "b"]);
	});

	it("leaves them out of the ramp, so the sweep spans only its own text", () => {
		const root = withPill();
		paintGradientChars(asEl(root), "#000000", "#ffffff");

		assert.deepStrictEqual(colors(root), ["#000000", "#ffffff"]);
	});

	it("leaves an icon's glyph alone even outside a pill", () => {
		const root = html(
			`<span class="cs-heading-token">` +
				`<span class="cs-callout-icon">•</span>` +
				`<span class="cs-callout-name">Tip</span></span>`,
		);
		paintGradientChars(asEl(root), "#000000", "#ffffff");

		assert.deepStrictEqual(letters(root), ["T", "i", "p"]);
	});

	it("leaves a nested pill's already-painted spans exactly as they were", () => {
		// The pill runs its own pass. Read straight off the DOM — every char span
		// under `root`, the pill's included — the parent's paint must show up as
		// the two ends of the list and nothing in between: its ramp is `n = 2`,
		// not `n = 5` with three colours it does not own.
		const root = withPill();
		const pill = root.querySelector(".cs-callout-name");
		assert.ok(pill);
		paintGradientChars(asEl(pill), "#ff0000", "#00ff00");
		paintGradientChars(asEl(root), "#000000", "#ffffff");

		assert.deepStrictEqual(letters(root), ["a", "T", "i", "p", "b"]);
		assert.deepStrictEqual(colors(root), ["#000000", "#ff0000", "#808000", "#00ff00", "#ffffff"]);
	});
});

/* -------------------------------------------------------------------------- */
/* clearGradientChars                                                         */
/* -------------------------------------------------------------------------- */

describe("clearGradientChars", () => {
	it("unwraps every span and puts the text back", () => {
		const root = painted("abc");
		clearGradientChars(asEl(root));

		assert.strictEqual(spans(root).length, 0);
		assert.strictEqual(root.textContent, "abc");
	});

	it("normalizes back to one text node, not one per grapheme", () => {
		// Stale text nodes are not a cosmetic issue: the reading post-processor
		// splits text nodes by offset, and a title left in fragments would make
		// every later offset land somewhere else.
		const root = painted("abc");
		clearGradientChars(asEl(root));

		assert.strictEqual(root.childNodes.length, 1);
	});

	it("takes the sampled colours with it", () => {
		// A stale span would keep printing a gradient the screen no longer shows.
		const root = painted("abc");
		clearGradientChars(asEl(root));

		assert.strictEqual(root.textContent.includes("--cs-gch"), false);
		assert.strictEqual(spans(root).length, 0);
	});

	it("is a no-op on an element that was never painted", () => {
		const root = html(`<span class="cs-heading-title">abc</span>`);
		clearGradientChars(asEl(root));

		assert.strictEqual(root.textContent, "abc");
		assert.strictEqual(root.childNodes.length, 1);
	});

	it("leaves a nested pill's spans for that pill's own pass", () => {
		const root = html(
			`<span class="cs-heading-title">a<span class="cs-inline-callout">` +
				`<span class="cs-callout-name">Tip</span></span></span>`,
		);
		const pill = root.querySelector(".cs-callout-name");
		assert.ok(pill);
		paintGradientChars(asEl(pill), "#ff0000", "#00ff00");
		paintGradientChars(asEl(root), "#000000", "#ffffff");

		clearGradientChars(asEl(root));

		assert.strictEqual(letters(pill).length, 3);
		assert.strictEqual(root.textContent, "aTip");
	});

	it("survives being called twice", () => {
		const root = painted("abc");
		clearGradientChars(asEl(root));
		clearGradientChars(asEl(root));

		assert.strictEqual(root.textContent, "abc");
	});
});

/* -------------------------------------------------------------------------- */
/* applyTitleGradient — the cascade                                           */
/* -------------------------------------------------------------------------- */

describe("applyTitleGradient — when it paints", () => {
	it("paints from the callout's accent to the sweep's end colour", () => {
		const root = html(`<span class="cs-heading-title">ab</span>`);
		applyTitleGradient(asEl(root), definition({ bgGradient: sweep() }));

		assert.deepStrictEqual(colors(root), ["#112233", "#aabbcc"]);
	});

	it("uses the dark pair in dark mode when the palette set one", () => {
		const root = html(`<span class="cs-heading-title">ab</span>`);
		inDark(() => applyTitleGradient(asEl(root), definition({ bgGradient: sweep({ textToColorDark: "#ddeeff" }) })));

		assert.deepStrictEqual(colors(root), ["#445566", "#ddeeff"]);
	});

	it("reuses the WHOLE light pair in dark mode when it did not", () => {
		// Both halves, not just the end: a dark start against a light end is a
		// pair the CSS never draws, so the print colours would not match the
		// screen. This is the cascade CSSInjector emits, mirrored here.
		const root = html(`<span class="cs-heading-title">ab</span>`);
		inDark(() => applyTitleGradient(asEl(root), definition({ bgGradient: sweep() })));

		assert.deepStrictEqual(colors(root), ["#112233", "#aabbcc"]);
	});

	it("bakes for the theme the document is in right now", () => {
		// The same "current theme wins" compromise the exported material and
		// emoji icons make — a PDF is one document, and it has one theme.
		const def = definition({
			bgGradient: sweep({ textToColorDark: "#ddeeff" }),
		});
		const light = html(`<span class="cs-heading-title">ab</span>`);
		applyTitleGradient(asEl(light), def);
		const dark = html(`<span class="cs-heading-title">ab</span>`);
		inDark(() => applyTitleGradient(asEl(dark), def));

		assert.notDeepStrictEqual(colors(light), colors(dark));
	});
});

describe("applyTitleGradient — when it clears instead", () => {
	/** Paint a title, then apply `def` to it, and report what is left. */
	function reapply(def: CalloutDefinition): FakeElement {
		const root = painted("ab");
		applyTitleGradient(asEl(root), def);
		return root;
	}

	it("clears when the definition has no gradient at all", () => {
		const root = reapply(definition());
		assert.strictEqual(spans(root).length, 0);
		assert.strictEqual(root.textContent, "ab");
	});

	it("clears when the background sweeps but the text does not", () => {
		// `textGradient` is off by default — the background gradient alone must
		// not colour a single glyph.
		const root = reapply(definition({ bgGradient: sweep({ textGradient: false }) }));
		assert.strictEqual(spans(root).length, 0);
	});

	it("clears when the sweep is on but has no end colour to run to", () => {
		const root = reapply(definition({ bgGradient: sweep({ textToColorLight: undefined }) }));
		assert.strictEqual(spans(root).length, 0);
	});

	it("clears in dark mode too, on the light end colour's absence", () => {
		// `textToColorDark` alone is not a valid sweep: the light value is the
		// one the cascade is anchored on.
		const root = painted("ab");
		inDark(() =>
			applyTitleGradient(
				asEl(root),
				definition({
					bgGradient: sweep({
						textToColorLight: undefined,
						textToColorDark: "#ddeeff",
					}),
				}),
			),
		);
		assert.strictEqual(spans(root).length, 0);
	});
});
