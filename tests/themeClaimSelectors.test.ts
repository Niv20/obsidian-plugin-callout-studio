/**
 * tests/themeClaimSelectors.test.ts — the pure halves of the theme claim check.
 *
 * `ThemeClaimCheck` asks the browser's parsed copy of a theme whether the rules
 * naming a callout change anything, and everything it judges with is here:
 * which ids a parsed selector names, that selector with one id switched off,
 * whether a `<body>`/`<html>` condition fails, and whether two readings differ
 * where a reader can see it. Each case below is a shape the 65 installed themes
 * that name a callout actually write.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import {
	classesIn,
	namesInSelector,
	optionGated,
	pageRootFails,
	resolveNested,
	stripPseudoElements,
	styleSettingsClasses,
	type PageRoot,
	withoutName,
} from "../src/manager/theme/themeClaimSelectors";
import { changesVisibly, sampledStyle } from "../src/manager/theme/themeClaimEffect";

describe("which ids a parsed selector names", () => {
	it("reads = and ~=, in the attribute form, as the browser serializes them", () => {
		assert.deepStrictEqual(
			[...namesInSelector('.callout[data-callout="note"], .callout[data-callout~="infobox" i]')],
			["note", "infobox"],
		);
	});

	it("reads a name inside :is() and ignores one inside :not()", () => {
		// Baseline writes `.callout:not([data-callout=note-toolbar])` for every
		// callout except that one; reading it as a name is backwards.
		assert.deepStrictEqual(
			[...namesInSelector('.callout:is([data-callout="a"], [data-callout="b"]):not([data-callout="c"])')],
			["a", "b"],
		);
	});

	it("never reads a family pattern or the metadata attribute", () => {
		assert.strictEqual(
			namesInSelector('.callout[data-callout*="col"], .callout[data-callout-metadata="wide"]').size,
			0,
		);
	});

	it("drops an uppercase value without the i flag, which no rendered callout carries", () => {
		// Serenity: `.callout[data-callout="idea"], .callout[data-callout="I"]`.
		assert.deepStrictEqual(
			[...namesInSelector('.callout[data-callout="idea"], .callout[data-callout="I"]')],
			["idea"],
		);
		assert.deepStrictEqual([...namesInSelector('[data-callout="Metadata" i]')], ["metadata"]);
	});

	it("reads an escaped value as the characters it stands for", () => {
		assert.deepStrictEqual([...namesInSelector('[data-callout="tl\\;dr"]')], ["tl;dr"]);
		assert.deepStrictEqual([...namesInSelector('[data-callout="\\31 "]')], ["1"]);
	});
});

describe("the same selector with one id switched off", () => {
	it("replaces only that id, everywhere it is named", () => {
		const out = withoutName(
			'.callout[data-callout="note"], .callout[data-callout="tip"] .callout-title, [data-callout="note"] p',
			"note",
		);
		assert.ok(!namesInSelector(out).has("note"));
		assert.ok(namesInSelector(out).has("tip"));
		assert.ok(out.includes(".callout-title"));
	});

	it("leaves a negation alone, so the rule keeps excluding what it excluded", () => {
		const sel = '.callout:not([data-callout="note"]) .callout-title';
		assert.strictEqual(withoutName(sel, "note"), sel);
	});

	it("switches to a value no rendered callout can carry", () => {
		// Obsidian dasherizes whitespace, so a value with a space never matches.
		assert.match(withoutName('[data-callout="note"]', "note"), /\[data-callout="[^"]* [^"]*"\]/);
	});
});

describe("a <body> or <html> condition that fails right now", () => {
	const page = (body: string[], html: string[] = []) =>
		(compound: string, root: PageRoot): boolean => {
			const classes = root === "body" ? body : html;
			const want = compound.match(/\.[\w-]+/g)?.map((c) => c.slice(1)) ?? [];
			const banned = /:not\(\.([\w-]+)\)/.exec(compound)?.[1];
			return want.every((c) => classes.includes(c) || c === banned) &&
				(banned === undefined || !classes.includes(banned));
		};

	it("fails a rule wrapped in an option that is off — Retroma's 312 types", () => {
		assert.strictEqual(pageRootFails("body.rtm-ss-retro-callout", page([])), true);
		assert.strictEqual(pageRootFails("body.rtm-ss-retro-callout", page(["rtm-ss-retro-callout"])), false);
	});

	it("passes a condition the page meets, such as Velocity's opt-out", () => {
		assert.strictEqual(
			pageRootFails('body:not(.disable-callout-styling) .callout[data-callout="math-red"]', page([])),
			false,
		);
	});

	it("never holds a bare class against a rule: it may sit on the note, not the page", () => {
		assert.strictEqual(pageRootFails('.aura-callouts .callout[data-callout="note"]', page([])), false);
	});

	it("fails a list only when every selector in it fails", () => {
		assert.strictEqual(pageRootFails("body.a .callout, .callout.x", page([])), false);
		assert.strictEqual(pageRootFails("body.a .callout, html.b .callout", page([], [])), true);
	});

	it("reads :root and html as the document element", () => {
		assert.strictEqual(pageRootFails(":root.dark .callout", page([], [])), true);
		assert.strictEqual(pageRootFails("html.dark .callout", page([], ["dark"])), false);
	});

	it("leaves a condition that moves without an event unjudged", () => {
		// `:has()` follows the whole document and `:hover`/`:focus*` the pointer;
		// a page that fails them now may meet them a moment later with nothing
		// telling the theme sync, so they never take a callout from the theme.
		const never = (): boolean => false;
		for (const selector of [
			'body:has(.mod-active .is-live-preview) .callout[data-callout="note"]',
			"body:hover .callout",
			":root:focus-within .callout",
			"body.opt:has(.x) .callout",
			"html:not(:focus) .callout",
		]) {
			assert.strictEqual(pageRootFails(selector, never), false, selector);
		}
		assert.strictEqual(pageRootFails("body.opt .callout", never), true, "a class is still judged");
	});

	it("treats a condition it cannot evaluate as met", () => {
		const throws = (): boolean => {
			throw new Error("SyntaxError");
		};
		assert.strictEqual(pageRootFails("body:unknown-pseudo .callout", throws), false);
	});

	it("leaves a nested rule's & to the rule around it", () => {
		assert.strictEqual(pageRootFails('& .callout[data-callout="polaroid-1"]', page([])), false);
	});
});

/** A reading as plain data: `{ box: { prop: value } }`. */
function reading(icon: string, boxes: Record<string, Record<string, string>>) {
	return sampledStyle(
		icon,
		new Map(Object.entries(boxes).map(([box, values]) => [box, new Map(Object.entries(values))])),
	);
}

const PROPS = [
	"color",
	"display",
	"content",
	"cursor",
	"border-left-color",
	"border-left-style",
	"border-left-width",
	"fill",
	"top",
	"position",
];

describe("whether a difference reaches the screen", () => {
	it("counts a title that changes colour — Agate's whole callout section", () => {
		assert.strictEqual(
			changesVisibly(
				PROPS,
				reading("lucide-pencil", { title: { color: "rgb(55, 0, 255)" } }),
				reading("lucide-pencil", { title: { color: "rgb(8, 109, 221)" } }),
			),
			true,
		);
	});

	it("counts an icon swap, which Obsidian reads off --callout-icon at render time", () => {
		assert.strictEqual(changesVisibly(PROPS, reading("lucide-flame", {}), reading("lucide-pencil", {})), true);
	});

	it("does not count an identical reading — Catppuccin restating core's own icons", () => {
		const same = { title: { color: "red" } };
		assert.strictEqual(changesVisibly(PROPS, reading("lucide-info", same), reading("lucide-info", same)), false);
	});

	it("does not count a border colour on a box that draws no border — Brainhack's `1`", () => {
		const box = (c: string) => ({
			title: { "border-left-color": c, "border-left-style": "none", "border-left-width": "0px" },
		});
		assert.strictEqual(changesVisibly(PROPS, reading("i", box("black")), reading("i", box("grey"))), false);
	});

	it("counts the same border colour once the border is drawn", () => {
		const box = (c: string) => ({
			title: { "border-left-color": c, "border-left-style": "solid", "border-left-width": "2px" },
		});
		assert.strictEqual(changesVisibly(PROPS, reading("i", box("black")), reading("i", box("grey"))), true);
	});

	it("does not count interaction-only properties", () => {
		assert.strictEqual(
			changesVisibly(PROPS, reading("i", { title: { cursor: "pointer" } }), reading("i", { title: { cursor: "auto" } })),
			false,
		);
	});

	it("ignores a pseudo-element that draws nothing either way", () => {
		const none = (color: string) => ({ "title::before": { content: "none", color } });
		assert.strictEqual(changesVisibly(PROPS, reading("i", none("red")), reading("i", none("blue"))), false);
	});

	it("counts a pseudo-element that starts drawing", () => {
		assert.strictEqual(
			changesVisibly(
				PROPS,
				reading("i", { "callout::after": { content: '"“"' } }),
				reading("i", { "callout::after": { content: "none" } }),
			),
			true,
		);
	});

	it("ignores a box hidden both ways, except for being hidden", () => {
		const hidden = (color: string) => ({ icon: { display: "none", color } });
		assert.strictEqual(changesVisibly(PROPS, reading("i", hidden("red")), reading("i", hidden("blue"))), false);
	});

	it("counts SVG paint on the drawing and nowhere else", () => {
		assert.strictEqual(
			changesVisibly(PROPS, reading("i", { title: { fill: "red" } }), reading("i", { title: { fill: "none" } })),
			false,
		);
		assert.strictEqual(
			changesVisibly(PROPS, reading("i", { svg: { fill: "red" } }), reading("i", { svg: { fill: "none" } })),
			true,
		);
	});

	it("counts an offset only on a positioned box", () => {
		const at = (top: string, position: string) => ({ icon: { top, position } });
		assert.strictEqual(changesVisibly(PROPS, reading("i", at("2px", "static")), reading("i", at("0px", "static"))), false);
		assert.strictEqual(changesVisibly(PROPS, reading("i", at("2px", "relative")), reading("i", at("0px", "relative"))), true);
	});
});

describe("matching a parsed rule against the callout the check rendered", () => {
	it("drops pseudo-elements, keeping the element they hang off", () => {
		assert.strictEqual(
			stripPseudoElements('.callout[data-callout="x"] .callout-title::before'),
			'.callout[data-callout="x"] .callout-title',
		);
		assert.strictEqual(stripPseudoElements(".a:after, .b::marker"), ".a, .b");
		assert.strictEqual(stripPseudoElements(".a::part(x) .b"), ".a .b");
		// Pseudo-classes are kept: a :hover the render cannot see is a doubt.
		assert.strictEqual(stripPseudoElements(".a:hover::before"), ".a:hover");
		// Text inside an attribute value is not a pseudo-element.
		assert.strictEqual(stripPseudoElements('[title="a::before"]'), '[title="a::before"]');
	});

	it("folds a nested selector into its parent's", () => {
		assert.strictEqual(
			resolveNested('& .callout[data-callout="x"]', "body.opt"),
			':is(body.opt) .callout[data-callout="x"]',
		);
		assert.strictEqual(resolveNested("&.is-collapsed", ".callout"), ":is(.callout).is-collapsed");
		assert.strictEqual(resolveNested("> .callout-title", ".callout"), ":is(.callout) > .callout-title");
		assert.strictEqual(
			resolveNested(".a, & .b", ".p"),
			":is(.p) .a, :is(.p) .b",
		);
		assert.strictEqual(resolveNested('[title="&"]', ".p"), ':is(.p) [title="&"]');
	});

	it("lists the classes a selector requires, never those it negates", () => {
		assert.deepStrictEqual(
			[...classesIn('body.opt .callout[data-callout="a.b"]:not(.off) .x\\.y')],
			["opt", "callout", "x.y"],
		);
	});
});

describe("a theme option switched off", () => {
	const off = (cls: string): boolean => cls === "aura-callouts";

	it("gates a selector only when every branch requires an off option class", () => {
		assert.strictEqual(optionGated('.aura-callouts .callout[data-callout="note"]', off), true);
		assert.strictEqual(
			optionGated('.aura-callouts .callout[data-callout="note"], .callout[data-callout="note"]', off),
			false,
		);
		assert.strictEqual(optionGated('.callout[data-callout="note"]:not(.aura-callouts)', off), false);
	});

	it("reads the class names a theme's Style Settings block can set", () => {
		const css = `
/* @settings
name: Aura
id: aura-theme
settings:
    -
        id: aura-callouts
        title: Aura callouts
        type: class-toggle
    -
        id: aura-style
        type: class-select
        options:
            - aura-flat
            -
                label: Rounded
                value: aura-round
*/
.aura-callouts .callout[data-callout="note"] { color: red; }`;
		const classes = styleSettingsClasses(css);
		for (const cls of ["aura-callouts", "aura-style", "aura-flat", "aura-round"]) {
			assert.ok(classes.has(cls), cls);
		}
		assert.ok(!classes.has("Rounded"));
		assert.ok(!classes.has("callout"));
		assert.deepStrictEqual([...styleSettingsClasses(".a { color: red }")], []);
	});
});
