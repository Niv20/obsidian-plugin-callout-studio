/**
 * tests/cssInjectorIcon.test.ts — how an icon reaches the screen and the printer.
 *
 * Four emitters and one selector table, and the split between them is the whole
 * design:
 *
 * - **`iconMaskOverrideCSS`** — the default. Every library icon is a
 *   monochrome glyph, so it is drawn as a mask tinted with the callout's colour.
 * - **`imageOverrideCSS`** — a picture the user supplied may be neither
 *   monochrome nor a glyph. A mask is a stencil: running a logo or a photograph
 *   through one throws its colours away and leaves a silhouette. Those get a
 *   `background-image` instead. Same reasoning that already keeps emoji out of
 *   the mask path.
 * - **`emojiOverrideCSS`** — emoji carry their own colours, so no mask and
 *   no `background-color`.
 * - **`iconOverrideCSS`** — the router between the first two.
 *
 * The three take a finished selector rather than a callout id: they are shared
 * by every style mode, and the mode is what decides how heavy that selector is
 * (see `manager/styleMode.ts`). Passing `calloutSel(id)` here is the weight-1
 * form every mode but force emits.
 *
 * All three ::after rules are wrapped in `@media screen`, and that is not
 * decoration: PDF export drops the adopted stylesheet, so in print the CSS icon
 * disappears and the hidden DOM copy `paintIcons` bakes becomes the visible one.
 * An inline SVG renders far more reliably in Chromium's print pipeline than a
 * CSS mask does. The one rule that is deliberately NOT screen-scoped is
 * `iconHiddenCSS` — there is nothing to take over, and an icon the user turned
 * off has to be just as absent in a PDF (pinned in tests/hideIcon.test.ts).
 *
 * `iconTransformSelector` is a table with one entry per `CalloutRenderRole`, and
 * per-role is the point: nudging the heading token must not shift the blockquote
 * icon — that shared-value coupling is exactly what the per-role model replaced.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import {
	definition,
	harness,
	must,
	parseRules,
	ruleFor,
	valueOf,
} from "./support/cssInjectorHarness";
import { readRepoFile } from "./support/sourceScan";
import {
	emojiOverrideCSS,
	iconMaskOverrideCSS,
	iconOverrideCSS,
	imageOverrideCSS,
} from "../src/manager/css/iconOverrides";
import { calloutIconProp } from "../src/manager/css/calloutIconProp";
import { calloutSel } from "../src/utils/calloutSelector";
import { CALLOUT_RENDER_ROLES } from "../src/types";
import type { CalloutDefinition, UserImageIcon } from "../src/types";

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"/>';

/**
 * A stored user picture. `followsCalloutColor` is the pair `format === "svg"`
 * (the capability) AND `icon.recolor === true` (the callout's choice) — a raster
 * cannot be stencilled however the callout is set, which is why both halves are
 * exercised below.
 */
function picture(over: Partial<UserImageIcon> = {}): UserImageIcon {
	return {
		id: "pic",
		name: "logo.svg",
		format: "svg",
		svg: SVG,
		width: 24,
		height: 24,
		monochrome: false,
		rev: 1,
		addedAt: 0,
		...over,
	};
}

/**
 * A thin alias kept so the suite below reads as testing "what goes in
 * `--callout-icon` for this callout" rather than a bare import.
 */
function iconProp(def: CalloutDefinition): string {
	return calloutIconProp(def);
}

describe("calloutIconProp — the --callout-icon value", () => {
	it("emits Lucide's id verbatim, without re-resolving it", () => {
		// Lucide is Obsidian's own set, so the stored id is already what core CSS
		// wants. Deliberately NOT put through `resolveLucideId` first: that
		// repair asks whether an id is core Lucide, and this runs during plugin
		// load — before a plugin that registered its own ids with addIcon() has
		// necessarily loaded. A wrong answer here would be baked into the
		// stylesheet AND into the localStorage startup snapshot.
		assert.strictEqual(
			iconProp(definition({ icon: { type: "lucide", value: "lucide-star" } })),
			"lucide-star",
		);
	});

	it("hands every other pack a valid Lucide placeholder", () => {
		// So Obsidian renders *something* at first paint; the real glyph is
		// painted into the DOM by paintIcons, which is also what makes it survive
		// PDF export.
		for (const icon of [
			{ type: "emoji" as const, value: "🌟" },
			{ type: "material" as const, value: "star" },
			{ type: "tabler-outline" as const, value: "star" },
		]) {
			assert.strictEqual(
				iconProp(definition({ icon })),
				"lucide-pencil",
				`${icon.type} should fall back to the placeholder`,
			);
		}
	});

	it("emits nothing for an icon type no pack claims", () => {
		assert.strictEqual(
			iconProp(
				definition({
					icon: { type: "not-a-pack", value: "x" } as never,
				}),
			),
			"",
		);
	});
});

describe("iconMaskOverrideCSS — the default path", () => {
	it("hides core's own <svg> and paints an ::after in the accent", () => {
		const out = iconMaskOverrideCSS(calloutSel("quiet"), SVG);
		const hide = ruleFor(
			out,
			'.callout[data-callout="quiet"] > .callout-title > .callout-icon > svg',
		);
		assert.deepStrictEqual(hide.decls, ["display: none"]);

		const after = ruleFor(
			out,
			'.callout[data-callout="quiet"] > .callout-title > .callout-icon::after',
		);
		assert.strictEqual(valueOf(after, "background-color"), "var(--cs-accent)");
		assert.strictEqual(valueOf(after, "mask-size"), "contain");
		assert.strictEqual(valueOf(after, "mask-repeat"), "no-repeat");
	});

	it("lives inside @media screen, so print falls through to the DOM copy", () => {
		for (const rule of parseRules(iconMaskOverrideCSS(calloutSel("quiet"), SVG))) {
			assert.deepStrictEqual(rule.at, ["@media screen"]);
		}
	});

	it("declares the data URI once, into a custom property", () => {
		const after = ruleFor(
			iconMaskOverrideCSS(calloutSel("quiet"), SVG),
			'.callout[data-callout="quiet"] > .callout-title > .callout-icon::after',
		);
		// The whole stylesheet is written to localStorage on every inject and an
		// inlined SVG is by far the largest thing in it, so halving each
		// occurrence is worth the indirection.
		const uri = valueOf(after, "--cs-icon-mask");
		assert.ok(uri?.startsWith('url("data:image/svg+xml,'));
		assert.strictEqual(valueOf(after, "mask-image"), "var(--cs-icon-mask)");
		assert.strictEqual(
			valueOf(after, "-webkit-mask-image"),
			"var(--cs-icon-mask)",
		);
	});

	it("keeps both the prefixed and unprefixed spellings of every mask property", () => {
		const after = ruleFor(
			iconMaskOverrideCSS(calloutSel("quiet"), SVG),
			'.callout[data-callout="quiet"] > .callout-title > .callout-icon::after',
		);
		for (const prop of ["mask-image", "mask-size", "mask-repeat"]) {
			assert.ok(after.props.includes(prop), prop);
			assert.ok(after.props.includes(`-webkit-${prop}`), `-webkit-${prop}`);
		}
	});

	it("keeps the box square for a square picture and for no picture at all", () => {
		const square = "var(--icon-size, 1.2em)";
		for (const arg of [undefined, picture({ width: 24, height: 24 })]) {
			const after = ruleFor(
				iconMaskOverrideCSS(calloutSel("quiet"), SVG, arg),
				'.callout[data-callout="quiet"] > .callout-title > .callout-icon::after',
			);
			assert.strictEqual(valueOf(after, "width"), square);
			assert.strictEqual(valueOf(after, "height"), square);
		}
	});

	it("widens the box for a wide picture rather than shrinking its height", () => {
		// `contain` inside a square box shrinks a wide logo until its WIDTH fits,
		// so a 3:1 banner would render a third of the height of every other
		// callout's icon. Widening keeps the height constant, which is what makes
		// a row of callouts line up.
		const after = ruleFor(
			iconMaskOverrideCSS(calloutSel("quiet"),
				SVG,
				picture({ width: 90, height: 30 }),
			),
			'.callout[data-callout="quiet"] > .callout-title > .callout-icon::after',
		);
		assert.strictEqual(
			valueOf(after, "width"),
			"calc(var(--icon-size, 1.2em) * 3.000)",
		);
		assert.strictEqual(valueOf(after, "height"), "var(--icon-size, 1.2em)");
	});

	it("clamps a pathological aspect ratio at 4:1 in both directions", () => {
		const read = (w: number, h: number) =>
			valueOf(
				ruleFor(
					iconMaskOverrideCSS(calloutSel("quiet"), SVG, picture({ width: w, height: h })),
					'.callout[data-callout="quiet"] > .callout-title > .callout-icon::after',
				),
				"width",
			);
		// Unclamped, a 40:1 banner would push the title clean off the line.
		assert.strictEqual(read(400, 10), "calc(var(--icon-size, 1.2em) * 4.000)");
		assert.strictEqual(read(10, 400), "calc(var(--icon-size, 1.2em) * 0.250)");
	});

	it("ignores a picture with no usable height", () => {
		const after = ruleFor(
			iconMaskOverrideCSS(calloutSel("quiet"), SVG, picture({ height: 0 })),
			'.callout[data-callout="quiet"] > .callout-title > .callout-icon::after',
		);
		assert.strictEqual(valueOf(after, "width"), "var(--icon-size, 1.2em)");
	});
});

describe("imageOverrideCSS — a picture keeps its own colours", () => {
	it("paints a background-image instead of a mask", () => {
		const after = ruleFor(
			imageOverrideCSS(calloutSel("quiet"), SVG, picture()),
			'.callout[data-callout="quiet"] > .callout-title > .callout-icon::after',
		);
		assert.ok(valueOf(after, "background-image")?.startsWith('url("data:'));
		assert.strictEqual(valueOf(after, "background-size"), "contain");
		assert.strictEqual(valueOf(after, "background-position"), "center");
		// A mask is a stencil: it would throw the picture's colours away.
		assert.ok(!after.props.some((p) => p.includes("mask")));
		assert.ok(!after.props.includes("background-color"));
	});

	it("is screen-scoped like the mask rule", () => {
		for (const rule of parseRules(
			imageOverrideCSS(calloutSel("quiet"), SVG, picture()),
		)) {
			assert.deepStrictEqual(rule.at, ["@media screen"]);
		}
	});
});

describe("iconOverrideCSS — the router", () => {
	it("stencils a library icon", () => {
		const out = iconOverrideCSS(
			calloutSel("quiet"),
			{ type: "lucide", value: "lucide-star" },
			SVG,
		);
		assert.ok(out.includes("--cs-icon-mask:"));
	});

	it("stencils a user picture the callout asked to recolour", () => {
		const { registry } = harness();
		registry.setUserImages([picture({ monochrome: true })]);
		const out = iconOverrideCSS(
			calloutSel("quiet"),
			{ type: "image", value: "pic", recolor: true },
			SVG,
		);
		assert.ok(out.includes("--cs-icon-mask:"));
		assert.ok(out.includes("background-color: var(--cs-accent)"));
	});

	it("paints a user picture that keeps its own colours", () => {
		const { registry } = harness();
		registry.setUserImages([picture()]);
		const out = iconOverrideCSS(
			calloutSel("quiet"),
			{ type: "image", value: "pic" },
			SVG,
		);
		assert.ok(!out.includes("--cs-icon-mask:"));
		assert.ok(out.includes("background-image:"));
	});

	it("paints a raster even when the callout asked to recolour it", () => {
		const { registry } = harness();
		registry.setUserImages([picture({ format: "png", monochrome: true })]);
		// The capability half of followsCalloutColor: a raster has no stencil to
		// take, so `recolor` alone cannot put it on the mask path.
		const out = iconOverrideCSS(
			calloutSel("quiet"),
			{ type: "image", value: "pic", recolor: true },
			SVG,
		);
		assert.ok(!out.includes("--cs-icon-mask:"));
		assert.ok(out.includes("background-image:"));
	});
});

describe("emojiOverrideCSS", () => {
	it("draws the glyph via content, with no mask and no tint", () => {
		const after = ruleFor(
			emojiOverrideCSS(calloutSel("quiet"), "🌟"),
			'.callout[data-callout="quiet"] > .callout-title > .callout-icon::after',
		);
		assert.strictEqual(valueOf(after, "content"), '"🌟"');
		assert.strictEqual(valueOf(after, "font-size"), "var(--icon-size, 1.2em)");
		assert.strictEqual(valueOf(after, "line-height"), "1");
		assert.ok(!after.props.includes("background-color"));
	});

	it("escapes the CSS string literal", () => {
		// Emoji contain neither backslashes nor quotes; this is defensive against
		// future data changes, and it is the ONE place the injector escapes what
		// it interpolates (see cssInjectorInject.test.ts for the selector, which
		// does not).
		assert.ok(emojiOverrideCSS(calloutSel("quiet"), 'a"b').includes('content: "a\\"b"'));
		assert.ok(
			emojiOverrideCSS(calloutSel("quiet"), "a\\b").includes('content: "a\\\\b"'),
		);
	});

	it("is screen-scoped", () => {
		for (const rule of parseRules(emojiOverrideCSS(calloutSel("quiet"), "🌟"))) {
			assert.deepStrictEqual(rule.at, ["@media screen"]);
		}
	});
});

describe("iconTransformSelector — one entry per render role", () => {
	it("uses Obsidian's dasherized attr for the block role only", () => {
		const { css } = harness();
		const id = "multi word callout";
		assert.strictEqual(
			css.iconTransformSelector(id, "regular"),
			'.callout[data-callout="multi-word-callout"] > .callout-title > .callout-icon',
		);
		// The two token DOMs are ours and carry the space-preserving form.
		assert.ok(css.iconTransformSelector(id, "heading").includes(`"${id}"`));
		assert.ok(css.iconTransformSelector(id, "inline").includes(`"${id}"`));
	});

	it("names the heading token's own icon element", () => {
		const { css } = harness();
		assert.strictEqual(
			css.iconTransformSelector("quiet", "heading"),
			'.cs-heading-token[data-callout="quiet"] > .cs-callout-icon',
		);
	});

	it("spells the inline role's two depths out, rather than using a descendant combinator", () => {
		const { css } = harness();
		const sel = css.iconTransformSelector("quiet", "inline");
		// A plain pill holds its icon directly; a content pill (`[!id]{…}`) holds
		// it inside the lead that stands in for `[!id]{`. Without the second
		// selector the user's inline adjustment silently skipped every content
		// pill — and a descendant combinator would cover both AND reach the icon
		// of a pill NESTED in another pill's payload, applying the outer
		// callout's offset to the inner callout's icon.
		assert.strictEqual(
			sel,
			'.cs-inline-callout[data-callout="quiet"] > .cs-callout-icon, ' +
				'.cs-inline-callout[data-callout="quiet"] > .cs-callout-lead > .cs-callout-icon',
		);
		assert.ok(!sel.includes('"quiet"] .cs-callout-icon'));
	});

	it("lands on the icon, never on the lead itself", () => {
		const { css } = harness();
		// The lead is the pill's first flex item and is what the pill's own
		// `align-items: center` positions; a transform written onto it would
		// fight that, while on the icon inside it it composes cleanly.
		const sel = css.iconTransformSelector("quiet", "inline");
		for (const part of sel.split(", ")) {
			assert.ok(part.trim().endsWith(".cs-callout-icon"), part);
		}
	});

	it("has an entry for every declared role", () => {
		const { css } = harness();
		for (const role of CALLOUT_RENDER_ROLES) {
			assert.ok(
				css.iconTransformSelector("quiet", role).length > 0,
				`no selector for role ${role}`,
			);
		}
	});

	it("leaves ref tokens out entirely", () => {
		const { css } = harness();
		// They are too small for pixel offsets to mean anything, so they keep the
		// shared sizing from styles.css whatever the user does.
		for (const role of CALLOUT_RENDER_ROLES) {
			assert.ok(!css.iconTransformSelector("quiet", role).includes("cs-ref-token"));
		}
	});
});

describe("getIconTransformCSS — per-role rules", () => {
	/** The single rule `def` produces, or a thrown assertion. */
	const soleRule = (over: Partial<CalloutDefinition>) => {
		const { css } = harness();
		const rules = parseRules(css.getIconTransformCSS(definition(over)));
		assert.strictEqual(rules.length, 1, "expected exactly one role rule");
		return must(rules[0], "transform rule");
	};

	it("emits nothing while every role sits at its defaults", () => {
		const { css } = harness();
		assert.strictEqual(css.getIconTransformCSS(definition()), "");
	});

	it("emits one rule for one touched role, and leaves the others alone", () => {
		const { css } = harness();
		// This is the coupling the per-role model replaced: nudging the heading
		// token must not shift the blockquote icon.
		const out = css.getIconTransformCSS(
			definition({ iconAdjust: { heading: { offsetY: 3 } } }),
		);
		const rules = parseRules(out);
		assert.strictEqual(rules.length, 1);
		assert.strictEqual(
			must(rules[0], "rule").selector,
			'.cs-heading-token[data-callout="quiet"] > .cs-callout-icon',
		);
	});

	it("re-bakes the heading's static optical nudge from styles.css", () => {
		// This selector outranks the styles.css default, so it would otherwise
		// silently cancel the nudge the moment a heading slider is touched. The
		// fallback here (0.1em) must stay in step with the one in styles.css —
		// they disagreed (0.06em vs 0.1em) until the per-role rewrite, which made
		// any slider move lift the heading icon by the 0.04em difference.
		const rule = soleRule({ iconAdjust: { heading: { offsetY: 3 } } });
		assert.strictEqual(
			valueOf(rule, "transform"),
			"translate(0px, calc(3px + var(--cs-heading-icon-offset, 0.1em)))",
		);
	});

	it("emits the heading rule for a size-only change too, so the nudge survives", () => {
		const rule = soleRule({ iconAdjust: { heading: { size: 1.3 } } });
		assert.strictEqual(
			valueOf(rule, "transform"),
			"translate(0px, calc(0px + var(--cs-heading-icon-offset, 0.1em))) scale(1.3)",
		);
	});

	it("composes translate and scale in that order, around the centre", () => {
		const rule = soleRule({
			iconAdjust: { regular: { offsetX: 2, offsetY: -1, size: 1.2 } },
		});
		assert.strictEqual(
			valueOf(rule, "transform"),
			"translate(2px, -1px) scale(1.2)",
		);
		assert.strictEqual(valueOf(rule, "transform-origin"), "center");
	});

	it("drops the translate when only the size moved (block and inline roles)", () => {
		const rule = soleRule({ iconAdjust: { regular: { size: 1.4 } } });
		assert.strictEqual(valueOf(rule, "transform"), "scale(1.4)");
	});

	it("clamps values past the slider limits", () => {
		const rule = soleRule({
			iconAdjust: { regular: { offsetX: 999, offsetY: -999, size: 99 } },
		});
		assert.strictEqual(
			valueOf(rule, "transform"),
			"translate(10px, -10px) scale(1.5)",
		);
	});

	it("falls back to the flat per-definition values when a role is absent", () => {
		const { css } = harness();
		const rules = parseRules(
			css.getIconTransformCSS(definition({ iconOffsetX: 3 })),
		);
		// No `iconAdjust` at all → every role inherits the flat value.
		assert.strictEqual(rules.length, 3);
	});

	it("gives each alias its own transform rule", () => {
		const { css } = harness();
		const out = css.generateCalloutCSS(
			definition({
				aliases: ["hush"],
				iconAdjust: { regular: { offsetX: 2 } },
			}),
		);
		assert.ok(
			out.includes(
				'.callout[data-callout="hush"] > .callout-title > .callout-icon',
			),
		);
	});
});

/**
 * The injector used to carry an `updateMaterialFontLinks`, and `injectNow`
 * called it once per pass with a `Set` it had just built and never added to —
 * so it iterated nothing, warmed nothing, and its own doc ("Fires on every
 * inject") described a behaviour that had stopped existing. It was removed
 * rather than wired up, and these tests are why the wiring would have been the
 * wrong repair: a Material glyph never reaches a rendered callout as a glyph at
 * all, and warming its family per inject would have meant a fonts.gstatic.com
 * request on every startup, with no user action, for artwork the stylesheet
 * does not use.
 *
 * The picker is where a Material font legitimately belongs — `PackPanel` asks
 * for one when the user opens that source — and nothing here should ever start
 * that fetch again.
 */
describe("no webfont path through the injector", () => {
	it("draws a Material icon as a mask over its cached SVG, not as a glyph", () => {
		// The premise for everything below: if this ever became a font glyph
		// (`font-family` + a codepoint in `content`), the injector really would
		// need the family loaded, and deleting the warm-up would be a bug.
		const rule = ruleFor(
			iconMaskOverrideCSS(calloutSel("starred"), SVG),
			".callout[data-callout=\"starred\"] > .callout-title > .callout-icon::after",
		);
		assert.ok(valueOf(rule, "mask-image"));
		assert.ok(
			!rule.props.some((p) => p.startsWith("font")),
			"a Material icon must not be drawn from a webfont",
		);
	});

	it("emits no font-family and no @font-face for a Material callout", () => {
		const { registry, css } = harness();
		registry.add(
			definition({
				id: "starred",
				icon: { type: "material", value: "star", style: "rounded" } as never,
			}),
		);
		const sheet = registry
			.getAll()
			.map((def) => css.generateCalloutCSS(def))
			.join("\n\n");
		assert.ok(!/Material Symbols/.test(sheet), sheet);
		assert.ok(!/@font-face/.test(sheet), sheet);
	});

	it("has no updateMaterialFontLinks left to call", () => {
		const { injector } = harness();
		// The dead method itself. Present, it iterates an empty set on every
		// inject; wired up, it fetches a font nothing draws. Neither is wanted.
		assert.strictEqual(
			(injector as unknown as Record<string, unknown>)
				.updateMaterialFontLinks,
			undefined,
		);
	});

	it("does not even import the font loader", () => {
		// The import is the network surface: a later edit that reaches for
		// `ensureMaterialFontLoaded` from here would put a fonts.gstatic.com
		// request back on the startup path, which is exactly what the removal
		// bought. Read as text because an absent import has no runtime trace.
		const source = readRepoFile("src/manager/CSSInjector.ts");
		assert.ok(
			!/ensureMaterialFontLoaded/.test(source),
			"CSSInjector reaches for the Material webfont again",
		);
	});
});
