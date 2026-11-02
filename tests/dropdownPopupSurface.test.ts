/**
 * tests/dropdownPopupSurface.test.ts — a picker's list is Obsidian's combobox
 * popover.
 *
 * What this pins: the list a picker (`ListboxPopup`) opens is Obsidian's own
 * popover, the one its combobox opens in Bases and in its Settings' file
 * pickers: a `.suggestion-container` (with `.combobox` when it holds a search
 * box), and the list inside it a `.suggestion`. app.css draws its frame, so
 * styles.css paints none of it, and only names the ground once
 * (`--cs-menu-face`) for the few things inside that must repaint it. The rows
 * are laid out like `.menu-item`, and the chosen row is marked with a ✓
 * instead of a fill. (A plain choice opens a real Obsidian `Menu`, which needs
 * no rule at all.)
 *
 * Why read `styles.css` as text: the cascade itself cannot be observed in the
 * fake DOM these tests run in. So the tests check that the rules name the
 * right tokens. The values were checked against Obsidian 1.14.5's real
 * `app.css` (see `docs/internals-docs/16-settings-ui-and-modals.md`, "A
 * picker's popover").
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readRepoFile } from "./support/sourceScan";

/** One CSS rule: its selectors, and its declarations as property → value. */
interface Rule {
	selectors: string[];
	decls: Map<string, string>;
}

/** Whitespace inside `color-mix(` … `)` depends on how the source is wrapped. */
function tidy(value: string): string {
	return value.replace(/\s+/g, " ").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")").trim();
}

// The stylesheet with its comments removed, split into flat rules. The regex
// takes "selectors { declarations }" with no nested braces, which is enough:
// a rule inside `@media (…) { … }` is still found, only without its media
// condition.
const rawCss = readFileSync(join(process.cwd(), "styles.css"), "utf8");
const css = rawCss.replace(/\/\*[\s\S]*?\*\//g, "");
const rules: Rule[] = [];
const pattern = /([^{}]+)\{([^{}]*)\}/g;
let match: RegExpExecArray | null;
while ((match = pattern.exec(css)) !== null) {
	const decls = new Map<string, string>();
	for (const declaration of (match[2] ?? "").split(";")) {
		const colon = declaration.indexOf(":");
		if (colon < 0) continue;
		decls.set(declaration.slice(0, colon).trim(), tidy(declaration.slice(colon + 1)));
	}
	rules.push({
		selectors: (match[1] ?? "").trim().split(/,\s*\n/).map((s) => tidy(s)),
		decls,
	});
}

/** The value `selector` gets for `property`, asserting exactly one rule sets it. */
function valueOf(selector: string, property: string): string {
	const hits = rules.filter((rule) => rule.selectors.includes(selector) && rule.decls.has(property));
	assert.strictEqual(hits.length, 1, `expected one rule setting ${property} for ${selector}, found ${hits.length}`);
	// `!` tells TypeScript "this is not undefined". The assertion above has
	// just proved that there is exactly one hit, and that it has the property.
	return hits[0]!.decls.get(property)!;
}

const ROWS = [".cs-combobox-option"];
const FACE = "var(--cs-menu-face)";

describe("a picker's list is Obsidian's combobox popover", () => {
	const dom = readRepoFile("src/ui/listboxPopupDom.ts");

	it("is built from Obsidian's own popover classes", () => {
		assert.match(dom, /cls: "suggestion-container cs-combobox-popup cs-combobox-popup-hidden"/);
		assert.match(dom, /popup\.addClass\("combobox"\)/, "a search box makes it Obsidian's combobox popover");
		assert.match(dom, /cls: "suggestion cs-combobox-menu"/, "and its list Obsidian's scrolling list");
	});

	it("names the popover's ground once, for what must repaint it", () => {
		assert.strictEqual(valueOf(".cs-combobox-popup", "--cs-menu-face"), "var(--suggestion-background, var(--background-primary))");
	});

	it("paints none of the frame: app.css draws the ground, edge, corners, shadow and padding", () => {
		const PAINT = /^(background(-[a-z-]+)?|box-shadow|border(-[a-z-]+)?|corner-shape|padding(-[a-z-]+)?|backdrop-filter)$/;
		const subject = (selector: string) => selector.split(/\s*[\s>+~]\s*/).pop() ?? "";
		for (const rule of rules) {
			for (const selector of rule.selectors) {
				if (!/\.cs-combobox-(popup|menu)(?![-\w])/.test(subject(selector))) continue;
				for (const property of rule.decls.keys()) {
					if (selector.includes("cs-combobox-menu-grouped") && property.startsWith("padding-block-start")) continue;
					assert.ok(!PAINT.test(property), `${selector} sets ${property}: that is app.css's to draw`);
				}
			}
		}
	});
});

describe("rows are laid out like Obsidian's menu items", () => {
	it("pad, space and round every row as `.menu-item` does", () => {
		for (const row of ROWS) {
			assert.strictEqual(valueOf(row, "display"), "flex", row);
			assert.strictEqual(valueOf(row, "gap"), "var(--size-4-2)", row);
			assert.strictEqual(valueOf(row, "padding"), "var(--size-4-1) var(--size-4-2)", row);
			assert.strictEqual(valueOf(row, "border-radius"), "var(--radius-s)", row);
			assert.strictEqual(valueOf(row, "cursor"), "var(--cursor)", row);
		}
	});

	it("set the text size on the row: 13px on a computer, 15px on a phone or tablet", () => {
		for (const row of ROWS) {
			assert.strictEqual(valueOf(row, "font-size"), "var(--font-ui-small)", row);
			assert.strictEqual(valueOf(`.is-mobile ${row}`, "font-size"), "var(--font-ui-medium)", row);
		}
		// A callout's name takes that size from its row: no rule sizes the name
		// itself, here or in the `[!` popover, where Obsidian's suggestion row
		// sets 15px (S10-16).
		assert.ok(
			!rules.some((rule) => rule.selectors.some((sel) => sel.includes("callout-studio-suggestion-name")) && rule.decls.has("font-size")),
			"the name has no size of its own",
		);
	});

	it("highlight the row under the pointer or the arrow keys in Obsidian's hover grey", () => {
		for (const row of ROWS) {
			assert.strictEqual(valueOf(`${row}.is-active`, "background-color"), "var(--background-modifier-hover)", row);
		}
	});

	it("never fill the chosen row: it carries a ✓ instead", () => {
		const fills = rules.filter((rule) =>
			rule.selectors.some((s) => /\.is-selected\b/.test(s) && ROWS.some((row) => s.includes(row)))
			&& (rule.decls.has("background") || rule.decls.has("background-color")),
		);
		assert.deepStrictEqual(fills.map((rule) => rule.selectors), []);
		// The two tokens that painted the old fill are gone with it.
		assert.doesNotMatch(rawCss, /--cs-menu-row-selected/);
	});

	it("draws the ✓ where Obsidian's `setChecked(true)` draws it: last, muted, at the menu icon size", () => {
		assert.strictEqual(valueOf(".cs-combobox-check", "margin-inline-start"), "auto");
		assert.strictEqual(valueOf(".cs-combobox-check", "flex"), "0 0 auto");
		assert.strictEqual(valueOf(".cs-combobox-check", "color"), "var(--text-muted)");
		assert.strictEqual(valueOf(".cs-combobox-check", "--icon-size"), "var(--icon-s)");
		assert.strictEqual(valueOf(".cs-combobox-check", "--icon-stroke"), "var(--icon-s-stroke-width)");
	});
});

describe("groups, headings and the things that repaint the ground", () => {
	it("draws the line between groups as Obsidian's menu separator: one border line, 6px of air each side", () => {
		const between = ".cs-combobox-group + .cs-combobox-group";
		assert.strictEqual(valueOf(between, "border-top"), "var(--border-width, 1px) solid var(--background-modifier-border)");
		assert.strictEqual(valueOf(between, "margin-top"), "var(--size-2-3)");
		assert.strictEqual(valueOf(between, "padding-top"), "var(--size-2-3)");
		// The token that used to colour it, the field's hover edge, is gone.
		assert.doesNotMatch(rawCss, /--cs-menu-divider/);
	});

	it("lets a group reach across the list's side padding, so its line spans the whole list", () => {
		assert.strictEqual(valueOf(".cs-combobox-group", "margin-inline"), "calc(var(--size-2-3) * -1)");
		assert.strictEqual(valueOf(".cs-combobox-group", "padding-inline"), "var(--size-2-3)");
	});

	it("keeps the sticky group heading on the list's ground, edge to edge, in muted text", () => {
		assert.strictEqual(valueOf(".cs-combobox-group-label", "background"), FACE);
		assert.strictEqual(valueOf(".cs-combobox-group-label", "margin-inline"), "calc(var(--size-2-3) * -1)");
		assert.strictEqual(valueOf(".cs-combobox-group-label", "color"), "var(--text-muted)");
	});

	it("repaints the colour circles' cut-out ring with the ground", () => {
		assert.strictEqual(valueOf(".cs-combobox-menu .cs-color-circle", "box-shadow"), `0 0 0 1.5px ${FACE}`);
	});

	it("draws the transparent-swatch checkerboard from the ground it sits on", () => {
		// The base rule derives both tones from the window surface; a swatch in a
		// popup would otherwise be a checker of the wrong grey.
		const checker = valueOf(".cs-combobox-menu .cs-color-circle.is-transparent", "background-image");
		assert.match(checker, /var\(--cs-menu-face\) 0% 50%\)$/);
		assert.ok(!checker.includes("--cs-surface"), "the popup checkerboard must not name the window surface");
	});

	it("marks the typed run bold, as Obsidian does, instead of fading the rest", () => {
		// Until 2026-10-24 the characters around the typed run were faded. The
		// run is Obsidian's `.suggestion-highlight` now, which app.css draws bold
		// in a picker and in the `[!` popover alike, so no rule of ours is left.
		assert.ok(!css.includes("callout-studio-suggestion-id-dim"));
		assert.ok(!rules.some((rule) => rule.selectors.some((sel) => sel.includes("suggestion-highlight"))));
	});
});
