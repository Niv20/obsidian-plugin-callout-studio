/**
 * tests/themeCalloutStrip.test.ts — taking a theme's callout styling out of
 * its parsed copy.
 *
 * The repo's test DOM has no CSSOM, so the sheet here is a fake one shaped
 * like the browser's: rule lists with `deleteRule`, a `selectorText` that a
 * "browser" may refuse to change, declarations with `item`/`removeProperty`,
 * group rules, nesting, `@keyframes`, `@property` and `@import`. Which
 * selectors go is `themeCalloutRules.test.ts`; this pins the walk.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import {
	pinCoreCalloutDefaults,
	stripCalloutRules,
	type RuleContainer,
} from "../src/manager/theme/themeCalloutStrip";

interface FakeStyle {
	readonly length: number;
	item(index: number): string;
	removeProperty(name: string): string;
	getPropertyValue(name: string): string;
}

function style(declarations: Record<string, string> = {}): FakeStyle {
	const props = new Map(Object.entries(declarations));
	return {
		get length() {
			return props.size;
		},
		item: (index) => [...props.keys()][index] ?? "",
		removeProperty: (name) => {
			const was = props.get(name) ?? "";
			props.delete(name);
			return was;
		},
		getPropertyValue: (name) => props.get(name) ?? "",
	};
}

type FakeRule = Record<string, unknown>;

/** A rule list, deletable by index — a sheet, a group rule, a style rule with nesting. */
function list(rules: FakeRule[]): RuleContainer & { cssRules: FakeRule[] } {
	return {
		cssRules: rules,
		deleteRule(index: number) {
			rules.splice(index, 1);
		},
	} as unknown as RuleContainer & { cssRules: FakeRule[] };
}

function styleRule(selectorText: string, declarations: Record<string, string> = {}, nested?: FakeRule[]): FakeRule {
	const rule: FakeRule = { selectorText, style: style(declarations) };
	if (nested) Object.assign(rule, list(nested));
	return rule;
}

/** A rule whose selector the "browser" will not change. */
function stubbornRule(selectorText: string): FakeRule {
	return {
		get selectorText() {
			return selectorText;
		},
		set selectorText(_ignored: string) {
			/* a selector the parser rejected keeps the old one */
		},
		style: style(),
	};
}

const selectors = (rules: FakeRule[]): unknown[] => rules.map((r) => r.selectorText);

describe("stripping a theme's callout styling", () => {
	it("deletes callout rules, narrows mixed lists, and leaves the rest as written", () => {
		const sheet = list([
			styleRule(".markdown-rendered p", { color: "red" }),
			styleRule("body.callout-on .callout", { "background-color": "transparent" }),
			styleRule(".callout-content, .blockquote", { padding: "0" }),
			styleRule("blockquote:not(.callout)", { "border-left": "2px solid" }),
		]);
		const counts = stripCalloutRules(sheet);
		assert.deepStrictEqual(selectors(sheet.cssRules), [".markdown-rendered p", ".blockquote", "blockquote:not(.callout)"]);
		assert.deepStrictEqual(counts, { removed: 1, narrowed: 1, variables: 0 });
	});

	it("removes the callout variables from every rule that stays, and nothing else", () => {
		const body = styleRule("body", { "--callout-radius": "0", "--callout-default": "1, 2, 3", "--color-blue": "#00f" });
		const sheet = list([body]);
		const counts = stripCalloutRules(sheet);
		const kept = body.style as FakeStyle;
		assert.strictEqual(kept.length, 1);
		assert.strictEqual(kept.getPropertyValue("--color-blue"), "#00f");
		assert.strictEqual(counts.variables, 2);
	});

	it("walks into group rules and nested rules", () => {
		const nested = [styleRule("& > .callout-title", { color: "red" }), styleRule("&:hover", { color: "blue" })];
		const media = list([styleRule(".callout", { margin: "0" }), styleRule(".markdown-rendered", {}, nested)]);
		Object.assign(media, { media: { mediaText: "(max-width: 400px)" } });
		const sheet = list([media as unknown as FakeRule]);
		const counts = stripCalloutRules(sheet);
		assert.deepStrictEqual(selectors(media.cssRules), [".markdown-rendered"]);
		assert.deepStrictEqual(selectors(nested), ["&:hover"]);
		assert.strictEqual(counts.removed, 2);
	});

	it("deletes a selector it could not narrow rather than leave it styling callouts", () => {
		const sheet = list([stubbornRule(".callout-content, .blockquote")]);
		assert.deepStrictEqual(stripCalloutRules(sheet), { removed: 1, narrowed: 0, variables: 0 });
		assert.strictEqual(sheet.cssRules.length, 0);
	});

	it("takes a theme's registration of a callout variable, and no other", () => {
		const sheet = list([
			{ name: "--callout-color", syntax: "<color>", inherits: false },
			{ name: "--cs-accent-theme", syntax: "<color>", inherits: false },
		]);
		stripCalloutRules(sheet);
		assert.deepStrictEqual(sheet.cssRules.map((r) => r.name), ["--cs-accent-theme"]);
	});

	it("leaves @keyframes alone, whose deleteRule takes a keyframe's text", () => {
		let deleted = 0;
		const keyframes: FakeRule = {
			name: "callout-pulse",
			cssRules: [{ keyText: "0%", style: style({ opacity: "0" }) }],
			deleteRule: () => deleted++,
			appendRule: () => {},
		};
		stripCalloutRules(list([keyframes]));
		assert.strictEqual(deleted, 0);
	});

	it("follows an @import it can read, and skips one it cannot", () => {
		const imported = list([styleRule(".callout", { margin: "0" })]);
		const foreign = {
			get cssRules(): never {
				throw new Error("SecurityError: cannot access rules");
			},
			deleteRule: () => {},
		};
		const sheet = list([{ styleSheet: imported }, { styleSheet: foreign }]);
		assert.strictEqual(stripCalloutRules(sheet).removed, 1);
		assert.strictEqual(imported.cssRules.length, 0);
	});

	it("never lets one unusual rule stop the walk", () => {
		const odd: FakeRule = {
			get selectorText(): never {
				throw new Error("unsupported rule");
			},
		};
		const sheet = list([styleRule(".callout"), odd, styleRule(".callout-title")]);
		assert.strictEqual(stripCalloutRules(sheet).removed, 2);
		assert.strictEqual(sheet.cssRules.length, 1);
	});

	it("ends the sheet with Obsidian's own callout values, after everything the theme kept", () => {
		const inserted: string[] = [];
		const sheet = Object.assign(list([styleRule(".markdown-rendered p", { color: "red" })]), {
			insertRule(rule: string, index = 0) {
				assert.strictEqual(index, sheet.cssRules.length, "a pin went in before the end of the theme");
				inserted.push(rule);
				sheet.cssRules.push({ selectorText: rule.slice(0, rule.indexOf("{")).trim() });
				return index;
			},
		});
		assert.strictEqual(pinCoreCalloutDefaults(sheet), 6);
		assert.ok(inserted[0]?.startsWith("body {") && inserted[0].includes("--callout-radius: 4px"));
		assert.ok(inserted.some((rule) => rule.startsWith(".mod-rtl, .is-rtl, .rtl {") && rule.includes("12px 24px 12px 12px")));
		assert.ok(inserted.some((rule) => rule === ".theme-dark { --callout-blend-mode: lighten; }"));
		assert.ok(inserted.some((rule) => rule.startsWith("@media print")));
		assert.ok(inserted.some((rule) => rule === ".callout-icon { --icon-size: 16px; --icon-stroke: 2px; }"));
	});

	it("leaves to the theme a value whose rule the browser refuses", () => {
		const sheet = Object.assign(list([]), {
			insertRule(rule: string) {
				if (rule.startsWith("@media")) throw new Error("SyntaxError");
				return 0;
			},
		});
		assert.strictEqual(pinCoreCalloutDefaults(sheet), 5);
	});

	it("finds nothing more to take the second time", () => {
		const sheet = list([styleRule(".callout-content, .blockquote", { "--callout-padding": "0" }), styleRule(".callout")]);
		stripCalloutRules(sheet);
		assert.deepStrictEqual(stripCalloutRules(sheet), { removed: 0, narrowed: 0, variables: 0 });
	});
});
