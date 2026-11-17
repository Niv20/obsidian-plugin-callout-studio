/**
 * tests/webBlockCSS.test.ts — a block callout's look on a published site.
 *
 * A published site draws `> [!tip]` itself, and for a long while that was
 * taken to mean the website export had nothing to say about it. It does: a
 * site knows Obsidian's thirteen callouts and nobody's own, so a callout the
 * user made came out as a plain note, in the site's blue with the site's
 * pencil. The export now ends with rules for that element, written in each
 * site's own terms (`src/manager/css/webBlockCSS.ts`).
 *
 * What is held here:
 *
 * - **Each site is told the colour the way it reads one.** Quartz's three
 *   variables, Obsidian's one as a colour (Publish) or as a bare triplet
 *   (Digital Garden), and plain properties where no variable can be trusted.
 * - **The icon goes where that site keeps one.** Quartz masks an empty box
 *   with a URL; an Obsidian-shaped site holds an `<svg>` to draw over.
 * - **The site keeps what is the site's.** A built-in nobody changed gets no
 *   colour and no icon from here, a callout the vault does not define is
 *   reached only by the fallback, and nothing is `!important`.
 * - **Every rule outweighs the site's own for that callout,** wherever the
 *   stylesheet lands in the page.
 *
 * The rules are tested as text. That they paint the page they are for was
 * checked in a browser against a real Quartz 5 build and against Obsidian's
 * and Digital Garden's own stylesheets; nothing here can repeat that.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
// Listed first among the project imports: it installs the DOM globals before
// anything under test loads (see tests/support/fakeDom.ts).
import "./support/fakeDom";
import type { App } from "obsidian";
import { CSSInjector } from "../src/manager/CSSInjector";
import {
	WEB_BLOCK_WEIGHT,
	webBlockCSS,
	type WebBlockArtwork,
	type WebBlockCssContext,
	type WebBlockSite,
} from "../src/manager/css/webBlockCSS";
import { quartzCss, WEB_TARGET_IDS, type WebTargetId } from "../src/manager/web/targets";
import { buildWebBundleData, type WebExportPlugin } from "../src/manager/web/webData";
import type { CalloutDefinition, UserImageIcon } from "../src/types";
import { compareSpecificity, specificityOf } from "../src/utils/cssSpecificity";
import {
	definition,
	flattenNesting,
	harness,
	must,
	parseRules,
	ruleFor,
	valueOf,
	type CssRule,
} from "./support/cssInjectorHarness";

const SITES: readonly WebBlockSite[] = ["quartz", "publish", "garden"];
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M2 2h20v20H2z"/></svg>';
const MASK: WebBlockArtwork = { kind: "mask", svg: SVG };

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

/** The pure generator, with the artwork and the built-in question answered by hand. */
function sheet(
	defs: CalloutDefinition[],
	site: WebBlockSite,
	over: Partial<Omit<WebBlockCssContext, "settings">> & {
		settings?: (s: WebBlockCssContext["settings"]) => void;
	} = {},
): string {
	const { registry } = harness();
	over.settings?.(registry.settings);
	return webBlockCSS(defs, site, {
		settings: registry.settings,
		artwork: over.artwork ?? (() => MASK),
		followsSite: over.followsSite ?? (() => false),
		textSweepRules: over.textSweepRules ?? (() => []),
	});
}

const quiet = '.callout.callout[data-callout="quiet"]';

/** The declarations of the rule whose selector is exactly `selector`. */
const declsOf = (css: string, selector: string): string[] => ruleFor(css, selector).decls;

/* --- The colour, in each site's own terms ---------------------------------- */

describe("a block callout's colour, as each site reads one", () => {
	it("is said once, in this plugin's own accent, on every site", () => {
		for (const site of SITES) {
			const decls = declsOf(sheet([definition()], site), quiet);
			assert.deepStrictEqual(decls.slice(0, 2), ["--cs-accent: #336699", "--cs-color-rgb: 51, 102, 153"], site);
		}
	});

	it("Quartz: points its three variables at the accent, and Obsidian's for a converted theme", () => {
		const rule = ruleFor(sheet([definition()], "quartz"), quiet);
		assert.strictEqual(valueOf(rule, "--color"), "var(--cs-accent)");
		assert.match(valueOf(rule, "--border") ?? "", /^color-mix\(in srgb, var\(--cs-accent\) 27%, transparent\)$/);
		assert.match(valueOf(rule, "--bg") ?? "", /^color-mix\(in srgb, var\(--cs-accent\) 6%, transparent\)$/);
		// Quartz 5's `obsidian` template wears a converted Obsidian theme: its
		// title reads this one, and it paints a callout it has no rule for as a
		// plain quotation, so the fill and the frame are set outright.
		assert.strictEqual(valueOf(rule, "--callout-color"), "var(--cs-accent)");
		assert.strictEqual(valueOf(rule, "background-color"), "var(--bg)");
		assert.strictEqual(valueOf(rule, "border-color"), "var(--border)");
	});

	it("Obsidian Publish: gives Obsidian's variable a colour", () => {
		const rule = ruleFor(sheet([definition()], "publish"), quiet);
		assert.strictEqual(valueOf(rule, "--callout-color"), "var(--cs-accent)");
		assert.ok(!rule.props.includes("background-color"), "Publish derives the fill from the variable itself");
	});

	it("Digital Garden: gives Obsidian's variable a bare triplet, which its stylesheet wraps in rgb()", () => {
		const rule = ruleFor(sheet([definition()], "garden"), quiet);
		assert.strictEqual(valueOf(rule, "--callout-color"), "var(--cs-color-rgb)");
	});

	it("leaves the title's colour to the site, which reads it from the variable", () => {
		for (const site of SITES) {
			const css = sheet([definition()], site);
			assert.ok(!parseRules(css).some((rule) => rule.selector.includes(" > .callout-title,")), site);
			assert.ok(!css.includes("> .callout-title > .callout-icon svg"), site);
		}
	});

	it("restates only the accent in dark mode, so the site's line follows by itself", () => {
		for (const site of SITES) {
			const dark = declsOf(sheet([definition()], site), `.theme-dark ${quiet}`);
			assert.deepStrictEqual(dark, ["--cs-accent: #88bbee", "--cs-color-rgb: 136, 187, 238"], site);
		}
	});

	it("writes no dark rule for a callout that is the same in both modes", () => {
		const css = sheet([definition({ colorDark: "#336699" })], "quartz");
		assert.ok(!parseRules(css).some((rule) => rule.selector.startsWith(".theme-dark")));
	});

	it("covers every name a callout goes by, in both spellings a site may write", () => {
		const css = sheet([definition({ id: "my idea", aliases: ["hush"] })], "quartz");
		const selector = must(parseRules(css)[0], "first rule").selector;
		// Obsidian, Publish and Digital Garden dasherize a spaced id; Quartz 5 does not.
		for (const name of ["my-idea", "my idea", "hush"]) {
			assert.ok(selector.includes(`[data-callout="${name}"]`), `no selector for ${name}`);
		}
	});
});

/* --- The background and the text ------------------------------------------- */

describe("a block callout's background and text on a site", () => {
	it("paints the user's own background over the site's, after the site's line", () => {
		for (const site of SITES) {
			const rule = ruleFor(sheet([definition({ bgColorLight: "#ffeecc", bgColorDark: "#332200" })], site), quiet);
			const fills = rule.decls.filter((decl) => decl.startsWith("background-color:"));
			assert.ok(
				must(fills[fills.length - 1], "fill").includes("color-mix(in oklch"),
				`${site}: ${fills.join(" | ")}`,
			);
		}
	});

	it("keeps a light-only background in dark mode: the dark rule names no fill", () => {
		// Quartz's light rule sets a fill of its own, which a dark one restating
		// it would paint over the user's light-only background with.
		for (const site of SITES) {
			const css = sheet([definition({ bgColorLight: "#ffeecc" })], site);
			assert.ok(!ruleFor(css, `.theme-dark ${quiet}`).props.includes("background-color"), site);
		}
	});

	it("carries a gradient as the vault paints it", () => {
		const def = definition({
			bgColorLight: "#ffeecc",
			bgColorDark: "#332200",
			bgGradient: { toColorLight: "#ccddff", toColorDark: "#001133", angleDeg: 135 },
		});
		assert.match(valueOf(ruleFor(sheet([def], "publish"), quiet), "background-image") ?? "", /^linear-gradient\(/);
	});

	it("clears the fill and the frame of a transparent callout", () => {
		const rule = ruleFor(sheet([definition({ transparentBg: true })], "quartz"), quiet);
		const fills = rule.decls.filter((decl) => decl.startsWith("background-color:"));
		assert.strictEqual(fills[fills.length - 1], "background-color: transparent");
		const frames = rule.decls.filter((decl) => decl.startsWith("border-color:"));
		assert.strictEqual(frames[frames.length - 1], "border-color: transparent");
	});

	it("carries a text colour the user chose, and not the default a palette bakes", () => {
		const chosen = sheet([definition({ textColorLight: "#102030", textColorDark: "#f0e0d0" })], "garden");
		assert.deepStrictEqual(declsOf(chosen, `${quiet} > .callout-content`), ["color: #102030"]);
		assert.deepStrictEqual(declsOf(chosen, `.theme-dark ${quiet} > .callout-content`), ["color: #f0e0d0"]);

		const baked = sheet([definition({ textColorLight: "#1a1a1a", textColorDark: "#e0e0e0" })], "garden");
		assert.ok(!parseRules(baked).some((rule) => rule.selector.includes(".callout-content")));
	});
});

/* --- The icon ---------------------------------------------------------------- */

describe("a block callout's icon on a site", () => {
	const icon = `${quiet} > .callout-title > .callout-icon`;

	it("Quartz: hands a one-colour drawing to the mask Quartz already paints", () => {
		const css = sheet([definition()], "quartz");
		assert.ok(valueOf(ruleFor(css, quiet), "--callout-icon")?.startsWith('url("data:image/svg+xml,'));
		assert.ok(!parseRules(css).some((rule) => rule.selector.includes(".callout-icon")), "nothing more is needed");
	});

	it("Quartz: switches the mask off for a picture that keeps its colours", () => {
		const css = sheet([definition()], "quartz", {
			artwork: () => ({ kind: "image", svg: SVG, picture: picture() }),
		});
		const rule = ruleFor(css, icon);
		assert.strictEqual(valueOf(rule, "mask-image"), "none");
		assert.strictEqual(valueOf(rule, "background-color"), "transparent");
		assert.ok(valueOf(rule, "background-image")?.startsWith('url("data:'));
		assert.ok(!ruleFor(css, quiet).props.includes("--callout-icon"));
	});

	it("Quartz: widens the box for a picture that is not square", () => {
		const wide = picture({ width: 48, height: 24 });
		const css = sheet([definition()], "quartz", { artwork: () => ({ kind: "image", svg: SVG, picture: wide }) });
		const rule = ruleFor(css, icon);
		assert.match(valueOf(rule, "width") ?? "", /\* 2\.000\)$/);
		assert.strictEqual(valueOf(rule, "flex-basis"), valueOf(rule, "width"));
	});

	it("Quartz: draws an emoji as text in the box", () => {
		const css = sheet([definition()], "quartz", { artwork: () => ({ kind: "text", text: "🔥" }) });
		assert.strictEqual(valueOf(ruleFor(css, icon), "mask-image"), "none");
		assert.strictEqual(valueOf(ruleFor(css, `${icon}::before`), "content"), '"🔥"');
	});

	it("an Obsidian-shaped site: hides the site's drawing and paints its own after it", () => {
		for (const site of ["publish", "garden"] as const) {
			const rules = parseRules(sheet([definition()], site));
			const hidden = must(
				rules.find((rule) => rule.selector === `${icon} > svg`),
				`${site}: hidden svg`,
			);
			assert.deepStrictEqual(hidden.decls, ["display: none"]);
			const after = must(
				rules.find((rule) => rule.selector === `${icon}::after`),
				`${site}: ::after`,
			);
			assert.strictEqual(valueOf(after, "background-color"), "var(--cs-accent)");
			assert.ok(valueOf(after, "--cs-icon-mask")?.startsWith('url("data:'));
			assert.ok(!ruleFor(sheet([definition()], site), quiet).props.includes("--callout-icon"), site);
		}
	});

	it("takes a hidden icon out of the title on every site", () => {
		for (const site of SITES) {
			const css = sheet([definition()], site, { artwork: () => ({ kind: "hidden" }) });
			assert.deepStrictEqual(declsOf(css, icon), ["display: none"], site);
		}
	});

	it("leaves the site's icon where the artwork is not here", () => {
		for (const site of SITES) {
			const css = sheet([definition()], site, { artwork: () => ({ kind: "site" }) });
			// Nothing hides it, draws over it or names another.
			assert.ok(!css.includes("display: none") && !css.includes("::") && !css.includes("--callout-icon"), site);
		}
	});

	it("carries the block callout's own icon nudge", () => {
		const def = definition({ iconAdjust: { regular: { offsetX: 1, offsetY: -2, size: 1.2 } } });
		assert.deepStrictEqual(declsOf(sheet([def], "quartz"), icon), [
			"transform: translate(1px, -2px) scale(1.2)",
			"transform-origin: center",
		]);
	});
});

/* --- What stays the site's -------------------------------------------------- */

describe("what a published site keeps for itself", () => {
	const note = definition({ id: "note", displayName: "Note", builtIn: true, source: "builtin" });
	const untouched = { followsSite: (def: CalloutDefinition) => def.id === "note" };

	it("gives a built-in nobody changed no colour, no fill and no icon of its own", () => {
		for (const site of SITES) {
			const css = sheet([note], site, untouched);
			assert.ok(!css.includes("#336699"), `${site}: the stored colour reached the site`);
			assert.ok(!css.includes("callout-icon"), `${site}: an icon rule`);
		}
	});

	it("only says what the site's colour is", () => {
		const follow = (site: WebBlockSite): string[] =>
			parseRules(sheet([note], site, untouched)).flatMap((rule) => rule.decls);
		assert.deepStrictEqual(follow("quartz"), ["--cs-accent: var(--callout-color, var(--color))"]);
		assert.deepStrictEqual(follow("publish"), ["--cs-accent: var(--callout-color)"]);
		assert.deepStrictEqual(follow("garden"), ["--cs-accent: rgb(var(--callout-color))"]);
	});

	it("reaches a callout the vault does not define only through the fallback", () => {
		const defs = [definition(), definition({ id: "spare", displayName: "Spare", colorLight: "#aa0000" })];
		const none = sheet(defs, "quartz");
		assert.ok(!none.includes(":not("), "no fallback is set, so nothing names an unknown callout");

		const css = sheet(defs, "quartz", {
			settings: (s) => {
				s.fallbackCalloutId = "spare";
			},
		});
		const unknown = '.callout.callout[data-callout]:not(:where([data-callout="quiet"],[data-callout="spare"]))';
		assert.strictEqual(valueOf(ruleFor(css, unknown), "--cs-accent"), "#aa0000");
	});

	it("paints no fallback over the site's default when the fallback is an untouched built-in", () => {
		const css = sheet([note, definition()], "publish", {
			...untouched,
			settings: (s) => {
				s.fallbackCalloutId = "note";
			},
		});
		assert.ok(!css.includes(":not("));
	});

	it("is never !important, so the site's owner can still restyle a callout", () => {
		for (const target of WEB_TARGET_IDS) {
			const css = buildWebBundleData(plugin(), target).css;
			const blocks = flattenNesting(css.slice(css.indexOf(".callout.callout")));
			for (const rule of parseRules(blocks)) {
				if (!rule.selector.includes(".callout.callout")) continue;
				// The children of a transparent metadata colour are the one
				// place the snippet's cut is important; they clear, never paint.
				const loud = rule.decls.filter((decl) => decl.includes("!important") && !decl.includes("transparent"));
				assert.deepStrictEqual(
					loud.filter((decl) => !decl.startsWith("background-image: none")),
					[],
					`${target}: ${rule.selector}`,
				);
			}
		}
	});
});

/* --- Global callout style ---------------------------------------------------- */

describe("Global callout style on a site's block callouts", () => {
	it("says nothing while every setting is at its default", () => {
		assert.ok(!sheet([definition()], "quartz").includes("Global callout style"));
	});

	it("carries a frame, a radius and the two scales the user changed", () => {
		const css = sheet([definition()], "publish", {
			settings: (s) => {
				s.globalStyle.borderRadius = 12;
				s.globalStyle.borderSides = { top: false, right: false, bottom: false, left: true };
				s.globalStyle.borderWidth = 3;
				s.globalStyle.titleScale = 1.2;
				s.globalStyle.contentScale = 0.9;
			},
		});
		const frame = must(parseRules(css)[0], "frame rule");
		assert.strictEqual(frame.selector, quiet);
		assert.strictEqual(valueOf(frame, "border-radius"), "12px");
		assert.strictEqual(valueOf(frame, "border"), "none");
		assert.match(valueOf(frame, "border-left") ?? "", /^3px solid color-mix\(/);
		assert.deepStrictEqual(declsOf(css, `${quiet} > .callout-title > .callout-title-inner`), ["font-size: 1.2em"]);
		assert.deepStrictEqual(declsOf(css, `${quiet} > .callout-content`), ["font-size: 0.9em"]);
	});

	it("indents the content under the title where the site's title is known", () => {
		const aligned = (site: WebBlockSite): CssRule[] =>
			parseRules(
				sheet([definition()], site, {
					settings: (s) => {
						s.globalStyle.alignContentWithTitle = true;
					},
				}),
			).filter((rule) => rule.props.includes("padding-inline-start"));
		assert.match(valueOf(must(aligned("quartz")[0], "quartz"), "padding-inline-start") ?? "", /18px\) \+ 5px\)$/);
		assert.match(
			valueOf(must(aligned("garden")[0], "garden"), "padding-inline-start") ?? "",
			/--cs-align-title-gap/,
		);
		assert.match(
			valueOf(must(aligned("publish")[0], "publish"), "padding-inline-start") ?? "",
			/--cs-align-title-gap/,
		);
	});
});

/* --- Through the exporter ----------------------------------------------------- */

function plugin(): WebExportPlugin {
	const { registry, injector } = harness();
	registry.add(definition({ aliases: ["hush"] }));
	return { registry, cssInjector: injector };
}

describe("the block rules inside each target's stylesheet", () => {
	const blockRules = (target: WebTargetId, p: WebExportPlugin = plugin()): CssRule[] =>
		parseRules(buildWebBundleData(p, target).css).filter((rule) => rule.selector.includes(".callout.callout"));

	it("are written for the site the target is", () => {
		const read = (target: WebTargetId): string | undefined =>
			valueOf(
				must(
					blockRules(target).find((rule) => rule.selector.includes('[data-callout="quiet"]')),
					target,
				),
				"--callout-color",
			);
		assert.strictEqual(read("quartz"), "var(--cs-accent)");
		assert.strictEqual(read("publish"), "var(--cs-accent)");
		assert.strictEqual(read("garden"), "var(--cs-color-rgb)");
	});

	it("leave Obsidian's thirteen to the site until one is changed", () => {
		const p = plugin();
		const names = (): string =>
			blockRules("publish", p)
				.map((rule) => rule.selector)
				.join("\n");
		const own = (id: string): boolean => new RegExp(`\\[data-callout="${id}"\\] > `).test(names());
		assert.ok(
			!own("warning") && !blockRules("publish", p).some((rule) => rule.decls.includes("--cs-accent: #ec7500")),
		);
		p.registry.update("warning", { colorLight: "#123456" });
		assert.ok(
			blockRules("publish", p).some(
				(rule) =>
					rule.selector.includes('[data-callout="warning"]') && rule.decls.includes("--cs-accent: #123456"),
			),
			"a recoloured built-in is carried",
		);
	});

	it("draw an emoji and a hidden icon as the definition says", () => {
		const p = plugin();
		p.registry.add(definition({ id: "spark", displayName: "Spark", icon: { type: "emoji", value: "🔥" } }));
		p.registry.add(definition({ id: "bare", displayName: "Bare", hideIcon: true }));
		const css = buildWebBundleData(p, "quartz").css;
		const spark = '.callout.callout[data-callout="spark"] > .callout-title > .callout-icon';
		assert.strictEqual(valueOf(ruleFor(css, `${spark}::before`), "content"), '"🔥"');
		assert.deepStrictEqual(declsOf(css, '.callout.callout[data-callout="bare"] > .callout-title > .callout-icon'), [
			"display: none",
		]);
	});

	it("draw a picture of the user's own in its own colours", () => {
		const p = plugin();
		p.registry.setUserImages([picture()]);
		p.registry.add(definition({ id: "logo", displayName: "Logo", icon: { type: "image", value: "pic" } }));
		const css = buildWebBundleData(p, "garden").css;
		const after = must(
			parseRules(css).find(
				(rule) =>
					rule.selector === '.callout.callout[data-callout="logo"] > .callout-title > .callout-icon::after',
			),
			"picture rule",
		);
		assert.ok(valueOf(after, "background-image")?.startsWith('url("data:'));
		assert.ok(!after.props.includes("mask-image"));
	});

	it("Quartz: dark mode is written against Quartz's own attribute", () => {
		const css = quartzCss(buildWebBundleData(plugin(), "quartz").css);
		assert.ok(css.includes('[saved-theme="dark"] .callout.callout[data-callout="hush"]'));
		assert.ok(!css.includes(".theme-dark"));
	});

	it("colour one callout from its metadata, known to the vault or not", () => {
		const p = plugin();
		const css = flattenNesting(buildWebBundleData(p, "quartz").css);
		const coloured = parseRules(css).filter(
			(rule) =>
				rule.selector.includes(".callout.callout[data-callout]:is(") && rule.props.includes("--cs-accent"),
		);
		assert.ok(coloured.length > 0, "no metadata colour reached the block callouts");
		// It moves the accent and restates the site's line, for a callout no
		// rule of its own gave one to.
		assert.ok(coloured.some((rule) => rule.props.includes("--color")));
	});

	it("leave the title of a callout its metadata coloured to the site's variable", () => {
		for (const target of WEB_TARGET_IDS) {
			const css = buildWebBundleData(plugin(), target).css;
			assert.ok(!css.includes("> .callout-title > .callout-icon svg {"), target);
		}
	});

	it("are the same on every device: nothing of the active theme is read", () => {
		const themed = (css: string): WebExportPlugin => {
			const app = {
				customCss: {
					theme: "Fixture",
					themes: { Fixture: { version: "1.0.0" } },
					styleEl: { textContent: css },
				},
			} as unknown as App;
			const { registry } = harness();
			registry.add(definition({ aliases: ["hush"] }));
			return { registry, cssInjector: new CSSInjector(app, registry) };
		};
		const loud = '.callout[data-callout="note"] { --callout-color: 1, 2, 3; background: red !important; }';
		for (const target of WEB_TARGET_IDS) {
			assert.strictEqual(
				buildWebBundleData(themed(loud), target).css,
				buildWebBundleData(plugin(), target).css,
				target,
			);
		}
	});
});

/* --- Weight ------------------------------------------------------------------ */

describe("the weight of a block rule on a site", () => {
	it("repeats .callout, so it outranks the site's own rule for that callout", () => {
		assert.strictEqual(WEB_BLOCK_WEIGHT, 2);
		// Quartz and Obsidian both write `.callout[data-callout="tip"]`.
		const theirs = specificityOf('.callout[data-callout="tip"]');
		assert.ok(compareSpecificity(specificityOf(quiet), theirs) > 0, "a site's own rule ties or wins");
	});

	it("is the same for every callout rule in the sheet", () => {
		for (const site of SITES) {
			for (const rule of parseRules(sheet([definition({ aliases: ["hush"] })], site))) {
				for (const selector of rule.selector.split(",")) {
					assert.ok(selector.includes(".callout.callout["), `${site}: ${selector}`);
				}
			}
		}
	});
});
