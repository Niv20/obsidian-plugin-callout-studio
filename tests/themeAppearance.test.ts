/**
 * tests/themeAppearance.test.ts — reading a theme's callout back off the page.
 *
 * The promise this file holds is one sentence: **a theme-owned callout is drawn
 * from what was measured, or from a neutral placeholder, and never from the
 * artwork and colours stored on its row.** Those stored values describe a design
 * the plugin is not painting, so showing them is the specific bug this whole
 * module exists to remove — and it is a bug that looks like a feature, because
 * a wrong icon is indistinguishable from a right one until you compare.
 *
 * The five icon rungs are ordered by how definitive the evidence is rather than
 * by how common the mechanism is, and two of those orderings are load-bearing.
 * `hidden` outranks `svg` because a theme that hides the icon may leave the
 * markup in place. `svg` outranks `mask` because a mask sitting behind real
 * markup is decoration on top of the drawing, not the drawing.
 *
 * Counts below are measured over the 257 installed themes, and the two families
 * that made this file grow are named where they appear: themes that colour a
 * title through core's `--callout-title-color` hook without ever setting
 * `--callout-color`, and themes that hide core's drawing and paint their own on
 * `.callout-icon::before`.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import {
	firstGradientColor,
	readThemeAppearance,
	readThemeIcon,
	UNKNOWN_APPEARANCE,
	type ProbeReadout,
} from "../src/manager/theme/themeAppearance";

/**
 * A readout of a plain callout that core painted and nobody interfered with.
 *
 * The defaults are core's own used values, which is what makes the additions to
 * `ProbeReadout` provable as no-ops: `--callout-title-color` is `inherit`, so
 * `titleTextColor` matches `titleColor`; the drawing inside the slot is laid
 * out; and core paints no `::before` at all, so every pseudo field is blank.
 */
function readout(over: Partial<ProbeReadout> = {}): ProbeReadout {
	return {
		titleColor: "rgb(8, 109, 221)",
		titleTextColor: "rgb(8, 109, 221)",
		background: "rgba(8, 109, 221, 0.1)",
		backgroundImage: "none",
		iconDisplay: "flex",
		iconMarkup: "<svg class='svg-icon lucide-pencil'></svg>",
		iconChildDisplay: "inline",
		iconMask: "none",
		iconPseudoContent: "none",
		iconPseudoFont: "",
		iconPseudoMask: "none",
		iconPseudoBackground: "rgba(0, 0, 0, 0)",
		iconPseudoColor: "rgb(8, 109, 221)",
		...over,
	};
}

/** The base64 stencil the theme names in `--callout-icon-mask`. */
const THEME_MASK = 'url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0i")';

/**
 * A callout as the `--callout-title-color` / masked-`::before` family really
 * renders it, of which Lumines is the one installed here.
 *
 * Three things at once, and each was enough on its own to produce a wrong row:
 * the theme hides **the drawing** rather than the slot, draws its own on the
 * pseudo-element with a mask (`content` is the empty string, so it is not a
 * glyph), and never sets `--callout-color` — so `.callout-title` keeps core's
 * default blue while the title the reader sees carries the theme's hue.
 */
function luminesReadout(over: Partial<ProbeReadout> = {}): ProbeReadout {
	return readout({
		titleColor: "rgb(8, 109, 221)",
		titleTextColor: "rgb(224, 108, 117)",
		background: "rgba(224, 108, 117, 0.1)",
		iconDisplay: "flex",
		iconMarkup: "<svg class='svg-icon lucide-pencil'></svg>",
		iconChildDisplay: "none",
		iconMask: "none",
		iconPseudoContent: '""',
		iconPseudoMask: THEME_MASK,
		iconPseudoBackground: "rgb(224, 108, 117)",
		...over,
	});
}

/**
 * A callout as the **Sanctum** family really renders one: the stencil is on
 * `.callout-icon` *itself*, painted with `background-color: currentColor`, and
 * core's `<svg>` is left in the slot, displayed, because the mask disposes of
 * it anyway.
 *
 * That last detail is the whole bug. The slot is laid out, the child is laid
 * out, and the markup is real — so an `svg`-over-`mask` ladder reproduced
 * core's default `lucide-pencil` on every row while the note showed the
 * theme's Carbon drawing. `spelling` is a parameter because Sanctum writes
 * only `-webkit-mask-image` and Sanctum reborn only `mask-image`, and
 * `readCalloutStyle.maskOf` folds the two into this one field.
 */
function sanctumReadout(over: Partial<ProbeReadout> = {}): ProbeReadout {
	return readout({
		titleColor: "rgb(104, 145, 181)",
		titleTextColor: "rgb(104, 145, 181)",
		background: "rgba(104, 145, 181, 0.2)",
		iconDisplay: "flex",
		iconMarkup: "<svg class='svg-icon lucide-pencil'></svg>",
		iconChildDisplay: "block",
		iconMask: THEME_MASK,
		iconPseudoContent: "none",
		iconPseudoMask: "none",
		iconPseudoBackground: "rgba(0, 0, 0, 0)",
		...over,
	});
}

describe("the icon ladder", () => {
	it("clones the rendered SVG — the great majority of themes", () => {
		// Most themes leave the icon to core, and the rest set `--callout-icon`;
		// either way core's post-processor has put real markup in the element,
		// so the drawing can simply be copied whatever produced it.
		const icon = readThemeIcon(readout());
		assert.strictEqual(icon.kind, "svg");
		assert.ok(icon.kind === "svg" && icon.markup.includes("lucide-pencil"));
	});

	it("draws nothing when the theme hides the icon — 22 themes", () => {
		const icon = readThemeIcon(readout({ iconDisplay: "none" }));
		assert.strictEqual(icon.kind, "hidden");
	});

	it("prefers hidden over markup the reader cannot see", () => {
		// The ordering that matters: a theme can hide the slot and leave core's
		// SVG sitting inside it, and reproducing that icon would put artwork on
		// the row that appears nowhere in the note.
		const icon = readThemeIcon(
			readout({ iconDisplay: "none", iconMarkup: "<svg></svg>" }),
		);
		assert.strictEqual(icon.kind, "hidden");
	});

	it("reproduces a mask when there is no SVG", () => {
		const icon = readThemeIcon(
			readout({ iconMarkup: null, iconMask: 'url("data:image/svg+xml,x")' }),
		);
		assert.strictEqual(icon.kind, "mask");
		assert.ok(icon.kind === "mask" && icon.image.startsWith("url("));
	});

	it("prefers real markup over a mask on the ::before behind it", () => {
		// A pseudo-element paints its own box, so a stencil there sits *beside*
		// the drawing and leaves it legible. The slot's own mask is the opposite
		// case and is pinned below.
		const icon = readThemeIcon(readout({ iconPseudoMask: "url(x)" }));
		assert.strictEqual(icon.kind, "svg");
	});

	it("reproduces a stencil on the slot over the child it clips — Sanctum", () => {
		// The reported bug. Sanctum and Sanctum reborn mask `.callout-icon`
		// itself and leave core's SVG displayed inside it; a mask on the element
		// clips every descendant, so that SVG is *inside* the stencil and cannot
		// be what the reader sees. Ranking `svg` first drew core's default
		// `lucide-pencil` on all 47 rows of each theme.
		const icon = readThemeIcon(sanctumReadout());
		assert.strictEqual(icon.kind, "mask", "the stencil, not the clipped svg");
		assert.strictEqual(icon.kind === "mask" && icon.image, THEME_MASK);
	});

	it("reads the stencil in either spelling — Sanctum and Sanctum reborn", () => {
		// Sanctum writes only `-webkit-mask-image`, Sanctum reborn only
		// `mask-image`. `readCalloutStyle.maskOf` asks for both and hands over
		// whichever answered, so the ladder must not care which it was.
		for (const image of ['url("data:image/svg+xml,webkit")', THEME_MASK]) {
			const icon = readThemeIcon(sanctumReadout({ iconMask: image }));
			assert.strictEqual(icon.kind === "mask" && icon.image, image);
		}
	});

	it("keeps the slot's stencil out of the accent ladder", () => {
		// `drawnByPseudo` must stay false for a mask on the slot: that node wears
		// the colour core gave the title, so reading its paint as the accent
		// would dress up an inherited value as the theme having spoken.
		const out = readThemeAppearance(
			sanctumReadout({ iconPseudoBackground: "rgb(1, 2, 3)" }),
		);
		assert.strictEqual(out.accent, "rgb(104, 145, 181)");
	});

	it("does not reproduce a drawing the theme switched off — 21 themes", () => {
		// The reported bug, at its narrowest. `.callout-icon > svg { display:
		// none }` leaves the slot laid out, so testing `display` on the slot
		// alone looks one level too shallow — and the rung then reproduced the
		// exact icon the theme had just hidden.
		const icon = readThemeIcon(luminesReadout());
		assert.notStrictEqual(icon.kind, "svg");
		assert.ok(
			!(icon.kind === "svg") ||
				!icon.markup.includes("lucide-pencil"),
			"core's default pencil must not survive being hidden",
		);
	});

	it("falls through to the mask the theme drew on the ::before instead", () => {
		const icon = readThemeIcon(luminesReadout());
		assert.strictEqual(icon.kind, "mask");
		assert.strictEqual(icon.kind === "mask" && icon.image, THEME_MASK);
	});

	it("prefers a mask on the slot itself over one on its ::before", () => {
		// Both spellings can be present; the node that carries the drawing is
		// the one whose paint the accent ladder then reads, so the two rungs
		// have to agree on which won.
		const icon = readThemeIcon(
			luminesReadout({ iconMask: "url(own)", iconPseudoMask: "url(pseudo)" }),
		);
		assert.strictEqual(icon.kind === "mask" && icon.image, "url(own)");
	});

	it("keeps a displayed child even when a mask sits behind it", () => {
		// The `svg`-over-`mask` ordering is unchanged: the guard only fires on
		// positive evidence that the child is switched off.
		const icon = readThemeIcon(
			readout({ iconPseudoMask: THEME_MASK, iconChildDisplay: "block" }),
		);
		assert.strictEqual(icon.kind, "svg");
	});

	it("treats an unanswerable display as displayed, not as hidden", () => {
		// A reader that cannot answer returns "". Standing the rung down on that
		// would drop every theme to the placeholder on the strength of no
		// evidence at all.
		const icon = readThemeIcon(readout({ iconChildDisplay: "" }));
		assert.strictEqual(icon.kind, "svg");
	});

	it("copies a ::before glyph — Sandstorm, TerraFlow", () => {
		// A pseudo-element cannot be cloned, so its content becomes real text
		// carrying the font that made it a glyph rather than three letters.
		const icon = readThemeIcon(
			readout({
				iconMarkup: null,
				iconPseudoContent: '"\\f0eb"',
				iconPseudoFont: '"Font Awesome 6 Free"',
			}),
		);
		assert.strictEqual(icon.kind, "glyph");
		// Spelled as an escape, not pasted: the decoded character is a
		// private-use codepoint that renders as nothing in most editors, and a
		// test whose expectation is invisible is a test nobody can review.
		assert.strictEqual(
			icon.kind === "glyph" && icon.text,
			"\u{F0EB}",
			"the CSS escape is decoded, not shown as backslash-f-0-e-b",
		);
		assert.ok(icon.kind === "glyph" && icon.fontFamily.includes("Font Awesome"));
	});

	it("unwraps a plain quoted glyph too", () => {
		const icon = readThemeIcon(
			readout({ iconMarkup: null, iconPseudoContent: '"★"' }),
		);
		assert.strictEqual(icon.kind === "glyph" && icon.text, "★");
	});

	it("treats content: normal and empty strings as no glyph", () => {
		for (const content of ["normal", "none", '""', "''", ""]) {
			const icon = readThemeIcon(
				readout({ iconMarkup: null, iconPseudoContent: content }),
			);
			assert.strictEqual(icon.kind, "unknown", `content: ${content}`);
		}
	});

	it("gives up rather than guessing when nothing is legible", () => {
		// `unknown` is the caller's cue to draw the neutral placeholder. It must
		// never become a licence to fall back to `def.icon`.
		const icon = readThemeIcon(readout({ iconMarkup: null }));
		assert.strictEqual(icon.kind, "unknown");
	});
});

describe("colour", () => {
	it("takes both from used values, so any mechanism works", () => {
		// Neither is read out of the theme's CSS. Whatever produced them —
		// a variable, `color-mix()`, inheritance, a Style Settings class — the
		// browser has already resolved it by the time we look.
		const out = readThemeAppearance(readout());
		assert.strictEqual(out.accent, "rgb(8, 109, 221)");
		assert.strictEqual(out.background, "rgba(8, 109, 221, 0.1)");
	});

	it("falls back to a gradient stop when the background is transparent", () => {
		// The themes that put the most work into their callouts are exactly the
		// ones that paint them with a gradient, leaving `background-color`
		// transparent — so without this they would be the ones with no swatch.
		const out = readThemeAppearance(
			readout({
				background: "rgba(0, 0, 0, 0)",
				backgroundImage: "linear-gradient(90deg, rgb(10, 20, 30), #ffffff)",
			}),
		);
		assert.strictEqual(out.background, "rgb(10, 20, 30)");
	});

	it("keeps an opaque colour whose last channel is zero", () => {
		// The transparency test used to be a lazy scan for a trailing zero, so it
		// slid onto the **blue** channel and called every one of these fully
		// transparent. `colorOrNull` then returned null, and a row with a null
		// accent is drawn with no swatch at all — so a theme's amber `warning`
		// read as "the probe found nothing", not as a bug in one regex.
		for (const color of [
			"rgb(184, 131, 0)", // Sanctum's amber
			"rgb(255, 0, 0)",
			"rgb(255, 255, 0)",
			"rgb(0, 128, 0)",
			"rgb(184 131 0)",
		]) {
			const out = readThemeAppearance(
				readout({ titleColor: color, titleTextColor: color, background: color }),
			);
			assert.strictEqual(out.accent, color, `accent for ${color}`);
			assert.strictEqual(out.background, color, `background for ${color}`);
		}
	});

	it("still reads a genuinely zero alpha as nothing painted", () => {
		// Both serializations, because the fix names the fourth component rather
		// than hunting for a zero and so has to know where that component is.
		for (const color of [
			"rgba(0, 0, 0, 0)",
			"rgba(184, 131, 12, 0)",
			"rgba(255, 0, 0, 0.00)",
			"rgb(0 0 0 / 0)",
			"transparent",
		]) {
			const out = readThemeAppearance(
				readout({
					titleColor: color,
					titleTextColor: color,
					background: color,
					backgroundImage: "none",
				}),
			);
			assert.strictEqual(out.accent, null, `accent for ${color}`);
			assert.strictEqual(out.background, null, `background for ${color}`);
		}
	});

	it("keeps a partly transparent colour", () => {
		const out = readThemeAppearance(
			readout({ titleColor: "rgba(255, 0, 0, 0.5)", titleTextColor: "rgba(255, 0, 0, 0.5)" }),
		);
		assert.strictEqual(out.accent, "rgba(255, 0, 0, 0.5)");
	});

	it("reports null rather than a guess when nothing is painted", () => {
		const out = readThemeAppearance(
			readout({
				titleColor: "rgba(0, 0, 0, 0)",
				titleTextColor: "rgba(0, 0, 0, 0)",
				background: "transparent",
				backgroundImage: "none",
			}),
		);
		assert.strictEqual(out.accent, null);
		assert.strictEqual(out.background, null);
	});

	it("takes the accent the theme painted the ::before with", () => {
		// The reported bug's other half. `.callout-title` is core's element and
		// keeps `rgb(var(--callout-color))` — the default blue — so reading only
		// it named a colour that appears nowhere on the callout.
		const out = readThemeAppearance(luminesReadout());
		assert.strictEqual(out.accent, "rgb(224, 108, 117)");
		assert.notStrictEqual(out.accent, "rgb(8, 109, 221)");
	});

	it("takes it from --callout-title-color when core draws the icon — 13 themes", () => {
		// A theme that uses core's documented title hook without ever setting
		// `--callout-color`. There is no `::before` to read, so the title text
		// itself is the most deliberate evidence there is.
		const out = readThemeAppearance(
			readout({ titleTextColor: "rgb(180, 142, 173)" }),
		);
		assert.strictEqual(out.accent, "rgb(180, 142, 173)");
	});

	it("is unchanged for a theme that leaves that hook alone", () => {
		// `--callout-title-color: inherit` is core's default, which is what makes
		// the new rung a no-op for the rest of the corpus: the inner title
		// resolves to the band's colour, so the answer cannot move.
		assert.strictEqual(readThemeAppearance(readout()).accent, "rgb(8, 109, 221)");
	});

	it("ignores the ::before's paint when core's markup is the drawing", () => {
		// A pseudo-element can be painted decoratively while core's SVG is what
		// the reader sees. Only the node that actually won the icon rung may
		// speak for the accent.
		const out = readThemeAppearance(
			readout({ iconPseudoBackground: "rgb(1, 2, 3)" }),
		);
		assert.strictEqual(out.accent, "rgb(8, 109, 221)");
	});

	it("takes a glyph's own colour", () => {
		const out = readThemeAppearance(
			readout({
				iconMarkup: null,
				iconPseudoContent: '"★"',
				iconPseudoColor: "rgb(9, 9, 9)",
			}),
		);
		assert.strictEqual(out.icon.kind, "glyph");
		assert.strictEqual(out.accent, "rgb(9, 9, 9)");
	});

	it("falls past an unpainted ::before rather than reporting nothing", () => {
		// A mask with no paint of its own is drawn in `currentColor`. Stopping at
		// the transparent reading would lose a swatch the ladder can still fill.
		const out = readThemeAppearance(
			luminesReadout({ iconPseudoBackground: "rgba(0, 0, 0, 0)" }),
		);
		assert.strictEqual(out.accent, "rgb(224, 108, 117)", "the title text");
	});

	it("draws no swatch at all rather than a wrong one", () => {
		// `CalloutRowRenderer` guards on `if (accent)`. A theme whose metadata is
		// missing or unreadable has to reach that guard, never `def.colorLight`.
		const out = readThemeAppearance(
			readout({
				titleColor: "",
				titleTextColor: "",
				iconMarkup: null,
				iconChildDisplay: "",
				iconPseudoContent: "none",
				iconPseudoMask: "none",
				iconPseudoBackground: "transparent",
				iconPseudoColor: "",
				background: "transparent",
				backgroundImage: "none",
			}),
		);
		assert.strictEqual(out.accent, null);
		assert.strictEqual(out.background, null);
		assert.strictEqual(out.icon.kind, "unknown");
	});

	it("recognises every spelling of fully transparent", () => {
		for (const value of [
			"transparent",
			"rgba(0, 0, 0, 0)",
			"rgba(255, 255, 255, 0)",
			"rgba(1, 2, 3, 0.0)",
			"",
		]) {
			assert.strictEqual(
				readThemeAppearance(readout({ background: value, backgroundImage: "none" }))
					.background,
				null,
				value,
			);
		}
	});

	it("keeps a translucent colour, which is the normal case", () => {
		// Core paints callout backgrounds as a tint. Treating "has alpha" as
		// "transparent" would throw away almost every real background there is.
		assert.strictEqual(
			readThemeAppearance(readout({ background: "rgba(8, 109, 221, 0.1)" }))
				.background,
			"rgba(8, 109, 221, 0.1)",
		);
	});

	it("finds no gradient colour in a gradient that has none", () => {
		assert.strictEqual(firstGradientColor("none"), null);
		assert.strictEqual(firstGradientColor("url(x.png)"), null);
	});
});
describe("the unknown appearance", () => {
	it("names no colour and no icon", () => {
		// What every surface gets before the probe has run, and after it fails.
		assert.strictEqual(UNKNOWN_APPEARANCE.accent, null);
		assert.strictEqual(UNKNOWN_APPEARANCE.background, null);
		assert.strictEqual(UNKNOWN_APPEARANCE.icon.kind, "unknown");
	});
});
