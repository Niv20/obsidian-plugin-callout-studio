/**
 * tests/lightPalette.test.ts — the light palette, and the single gate it hangs on.
 *
 * On macOS Obsidian points `--interactive-normal` at `--background-modifier-border`
 * (#e4e4e4), and every field, dropdown and list in this plugin's windows draws its
 * face from it: a borderless grey slab, with a heavy shadow under the list and a
 * mid-grey selected row. The palette (`styles.css`, "The light palette") gives
 * light mode a white face, a soft line, a firmer line when engaged and a pale
 * accent tint for the chosen row — and steps aside for any community theme.
 *
 * What is pinned here is the *shape* of that arrangement, because the cascade
 * itself is not observable from `node:test`:
 *
 * - **One gate, one place.** Every `--cs-light-*` swatch is declared in a single
 *   rule, and its selector asks for the light scheme and for Obsidian's Default
 *   theme. Dark mode and a community theme therefore never see a swatch.
 * - **A swatch that is absent changes nothing.** Every token that reads one reads
 *   it *in front of* what it was before the palette existed, so "no swatch" is
 *   the old look to the byte. These fallbacks are the regression guard for dark
 *   mode and for every theme, which is why they are spelled out literally.
 * - **The numbers** are the palette's design, stated as the properties they are
 *   meant to have (visible but not heavy, stronger when engaged, soft shadow)
 *   rather than as hex codes, so retuning a swatch does not need this file
 *   rewritten — but a retune that stops it reading as a light field does.
 *
 * Checked in headless Chrome against the real `app.css` when it was written, for
 * body classes `theme-light`/`theme-dark`, `mod-macos`/`mod-windows` and
 * `is-mobile is-phone`, with and without `cs-default-theme`: every computed
 * background, border and shadow in five real windows was identical to the
 * pre-palette stylesheet whenever the gate was shut (dark, or a theme), and the
 * white face and soft line appeared whenever it was open.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compareSpecificity, specificityOf } from "../src/utils/cssSpecificity";
import { DEFAULT_THEME_CLASS } from "../src/manager/theme/defaultThemeClass";

interface Rule {
	selectors: string[];
	decls: Map<string, string>;
	/** Source offset, for "declared before" questions. */
	at: number;
}

/** Whitespace inside `color-mix(` … `)` depends on how the source is wrapped. */
function tidy(value: string): string {
	return value.replace(/\s+/g, " ").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")").trim();
}

const css = readFileSync(join(process.cwd(), "styles.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, (m) =>
	m.replace(/[^\n]/g, " "),
);
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
		at: match.index,
	});
}

/** The one rule declaring `property` for a selector list that includes `selector`. */
function valueOf(selector: string, property: string): string {
	const hits = rules.filter((rule) => rule.selectors.includes(selector) && rule.decls.has(property));
	assert.strictEqual(hits.length, 1, `expected one rule setting ${property} for ${selector}, found ${hits.length}`);
	return hits[0]!.decls.get(property)!;
}

/** `var(<swatch>, <fallback>)` → `<fallback>`, asserting the swatch comes first. */
function fallbackOf(value: string, swatch: string): string {
	const prefix = `var(${swatch}, `;
	assert.ok(value.startsWith(prefix) && value.endsWith(")"), `expected ${swatch} first, then the old value, in: ${value}`);
	return value.slice(prefix.length, -1);
}

const GATE = ":where(body.theme-light.cs-default-theme)";
const SWATCHES = [
	"--cs-light-face",
	"--cs-light-face-hover",
	"--cs-light-line",
	"--cs-light-line-strong",
	"--cs-light-row-selected",
	"--cs-light-row-selected-active",
	"--cs-light-menu-shadow",
];

const palette = rules.filter((rule) => SWATCHES.some((name) => rule.decls.has(name)));
const swatch = (name: string): string => {
	const value = palette[0]?.decls.get(name);
	assert.ok(value, `${name} is not declared in the palette rule`);
	return value;
};

describe("the swatches are declared once, behind one gate", () => {
	it("declares every --cs-light-* property in a single rule", () => {
		assert.strictEqual(palette.length, 1, "the palette must live in one rule — a second declaration site is a second gate");
		const declared = [...palette[0]!.decls.keys()].filter((name) => name.startsWith("--cs-light-")).sort();
		assert.deepStrictEqual(declared, [...SWATCHES].sort());
	});

	it("declares no --cs-light-* property anywhere else, so dark mode and a theme never see one", () => {
		const stray = rules
			.filter((rule) => !palette.includes(rule))
			.filter((rule) => [...rule.decls.keys()].some((name) => name.startsWith("--cs-light-")));
		assert.deepStrictEqual(stray.map((rule) => rule.selectors.join(", ")), []);
	});

	it("gates on the light scheme and on the class the plugin sets for the Default theme", () => {
		assert.deepStrictEqual(palette[0]!.selectors, [GATE]);
		assert.ok(GATE.includes("theme-light"), "light scheme only");
		assert.ok(!GATE.includes("theme-dark"), "the dark scheme has no palette");
		// A rename in either place would silently switch the palette off — or,
		// worse, leave it on under a theme.
		assert.ok(GATE.includes(`.${DEFAULT_THEME_CLASS}`), `the gate must name the class defaultThemeClass.ts sets (${DEFAULT_THEME_CLASS})`);
	});

	it("adds no specificity, so a later snippet can retune a swatch with a plain `body { … }`", () => {
		assert.deepStrictEqual(specificityOf(GATE), [0, 0, 0]);
		assert.ok(compareSpecificity(specificityOf("body"), specificityOf(GATE)) > 0);
	});
});

describe("a swatch that is absent changes nothing", () => {
	const ROOTS = ".callout-studio-settings";
	const edge = "color-mix(in srgb, var(--background-modifier-border-focus) 60%, var(--background-modifier-border))";

	// What each token was before the palette existed. Dark mode and every
	// community theme get exactly this, because they never declare the swatch.
	const TOKENS: Array<[string, string, string]> = [
		["--cs-btn-face", "--cs-light-face", "var(--interactive-normal)"],
		[
			"--cs-btn-face-hover",
			"--cs-light-face-hover",
			"color-mix(in srgb, var(--interactive-normal) 92%, rgb(var(--mono-rgb-100)))",
		],
		["--cs-btn-border", "--cs-light-line", "var(--background-modifier-border)"],
		["--cs-btn-border-hover", "--cs-light-line-strong", "var(--background-modifier-border-hover)"],
		["--cs-field-border-hover", "--cs-light-line-strong", edge],
	];

	for (const [token, name, before] of TOKENS) {
		it(`${token} falls back to its old value behind ${name}`, () => {
			assert.strictEqual(fallbackOf(valueOf(ROOTS, token), name), before);
		});
	}

	it("the popups' selected rows and divider fall back to the face-derived mixes and the hover edge", () => {
		for (const popup of [".cs-combobox-menu", ".cs-palette-menu"]) {
			assert.strictEqual(
				fallbackOf(valueOf(popup, "--cs-menu-row-selected"), "--cs-light-row-selected"),
				"color-mix(in srgb, var(--cs-menu-face) 88%, var(--text-normal))",
				popup,
			);
			assert.strictEqual(
				fallbackOf(valueOf(popup, "--cs-menu-row-selected-active"), "--cs-light-row-selected-active"),
				"color-mix(in srgb, var(--cs-menu-face) 80%, var(--text-normal))",
				popup,
			);
			assert.strictEqual(
				fallbackOf(valueOf(popup, "--cs-menu-divider"), "--cs-light-line"),
				"var(--cs-field-border-hover, var(--background-modifier-border-hover))",
				popup,
			);
		}
	});

	it("both popups' shadow falls back to the two-layer shadow they always had", () => {
		for (const popup of [".cs-combobox-menu", ".cs-palette-menu"]) {
			assert.strictEqual(
				fallbackOf(valueOf(popup, "box-shadow"), "--cs-light-menu-shadow"),
				"0 10px 28px rgba(0, 0, 0, 0.34), 0 3px 8px rgba(0, 0, 0, 0.24)",
				popup,
			);
		}
	});

	it("every read of a swatch has a fallback, except inside the gate itself", () => {
		// `var(--cs-light-x)` with nothing after it resolves to nothing the moment
		// the swatch is not declared, and drops the declaration that reads it —
		// i.e. dark mode and a theme would lose the property, not keep the old one.
		const bare: string[] = [];
		for (const rule of rules) {
			for (const [property, value] of rule.decls) {
				for (const read of value.matchAll(/var\((--cs-light-[a-z-]+)\s*([,)])/g)) {
					if (read[2] === ")" && !rule.selectors.every((s) => s.startsWith(GATE))) {
						bare.push(`${rule.selectors[0]} { ${property} } reads ${read[1]} with no fallback`);
					}
				}
			}
		}
		assert.deepStrictEqual(bare, []);
	});

	it("every swatch that is read is one the gate declares", () => {
		const read = new Set<string>();
		for (const m of css.matchAll(/var\((--cs-light-[a-z-]+)/g)) read.add(m[1]!);
		assert.deepStrictEqual([...read].filter((name) => !SWATCHES.includes(name)), [], "a typo here reads as an undeclared swatch, and silently falls back");
	});
});

/* -------------------------------------------------------------------------- */
/* The numbers                                                                */
/* -------------------------------------------------------------------------- */

function channel(c: number): number {
	const s = c / 255;
	return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
function luminance(hex: string): number {
	const m = /^#([0-9a-f]{6})$/i.exec(hex);
	assert.ok(m, `not a 6-digit hex colour: ${hex}`);
	const n = parseInt(m[1]!, 16);
	return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}
/** WCAG contrast ratio. */
function contrast(a: string, b: string): number {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi! + 0.05) / (lo! + 0.05);
}

describe("the palette reads as an ordinary light field", () => {
	const face = (): string => swatch("--cs-light-face");

	it("has a white face — the thing a text box, a dropdown and the list under it share", () => {
		assert.strictEqual(face().toLowerCase(), "#ffffff");
	});

	it("draws a resting line that is visible on the face without being heavy", () => {
		// Obsidian's own #e4e4e4 is 1.27:1 against white, which is why a white
		// field there looks borderless; a grey firmer than ~2:1 reads as a frame.
		const ratio = contrast(swatch("--cs-light-line"), face());
		assert.ok(ratio >= 1.4 && ratio <= 2, `resting line ${ratio.toFixed(2)}:1`);
	});

	it("draws a firmer line when engaged, clearly stepped up from the resting one", () => {
		const rest = contrast(swatch("--cs-light-line"), face());
		const engaged = contrast(swatch("--cs-light-line-strong"), face());
		assert.ok(engaged >= 2.2, `engaged line ${engaged.toFixed(2)}:1`);
		assert.ok(engaged - rest >= 0.7, `rest ${rest.toFixed(2)}:1 → engaged ${engaged.toFixed(2)}:1 is too small a step to see`);
	});

	it("hovers a button a perceptible but modest step darker than its face", () => {
		const mix = /^color-mix\(in srgb, var\(--cs-light-face\) (\d+)%, rgb\(var\(--mono-rgb-100\)\)\)$/.exec(swatch("--cs-light-face-hover"));
		assert.ok(mix, "the hover is mixed from the face toward the theme's own contrast direction");
		const percent = Number(mix[1]);
		assert.ok(percent >= 88 && percent <= 96, `${percent}% of the face is either invisible or heavy`);
	});

	it("tints the chosen row from the accent, and the highlighted chosen row more", () => {
		const tint = /^color-mix\(in srgb, var\(--interactive-accent\) (\d+)%, var\(--cs-light-face\)\)$/;
		const selected = tint.exec(swatch("--cs-light-row-selected"));
		const active = tint.exec(swatch("--cs-light-row-selected-active"));
		assert.ok(selected && active, "both fills are an accent tint over the face, so they follow the user's accent colour");
		assert.ok(Number(selected[1]) >= 8 && Number(active[1]) <= 25, "a tint, not a fill: text must stay far above 4.5:1");
		assert.ok(Number(active[1]) > Number(selected[1]));
	});

	it("casts a soft shadow under a popup — the dark-tuned 0.34 is what made the list look smudged", () => {
		const alphas = [...swatch("--cs-light-menu-shadow").matchAll(/rgba\(0, 0, 0, ([\d.]+)\)/g)].map((m) => Number(m[1]));
		assert.ok(alphas.length >= 2, "a long soft layer and a tight one");
		assert.ok(Math.max(...alphas) <= 0.2, `strongest layer ${Math.max(...alphas)}`);
	});
});

/* -------------------------------------------------------------------------- */
/* The icon tile                                                              */
/* -------------------------------------------------------------------------- */

describe("the icon tile joins the palette", () => {
	// The tile is a <button>, so Obsidian paints it `--interactive-normal` through
	// `button:not(.clickable-icon)` (0,1,1) — the base rule's own form-field fill
	// never wins. That is the grey slab beside two white-ish fields.
	const TILE = `${GATE} .cs-icon-tile-wrap:not(.is-empty) .cs-icon-tile`;

	it("paints the palette's face and resting line, and nothing else", () => {
		assert.strictEqual(valueOf(TILE, "background-color"), "var(--cs-light-face)");
		assert.strictEqual(valueOf(TILE, "border-color"), "var(--cs-light-line)");
		const rule = rules.find((r) => r.selectors.includes(TILE))!;
		assert.deepStrictEqual([...rule.decls.keys()].sort(), ["background-color", "border-color"]);
	});

	it("outranks Obsidian's button fills and stays under the tile's own engaged-edge rules", () => {
		const specificity = specificityOf(TILE);
		for (const obsidian of ["button:not(.clickable-icon)", "button:hover", "button:not(.clickable-icon).mobile-tap"]) {
			assert.ok(compareSpecificity(specificity, specificityOf(obsidian)) > 0, `${JSON.stringify(specificity)} must beat ${obsidian}`);
		}
		const engaged = ".callout-studio-editor .setting-item .setting-item-control button.cs-icon-tile:hover";
		assert.ok(compareSpecificity(specificity, specificityOf(engaged)) < 0, "the hover edge must still win over the resting line");
	});

	it("leaves the empty tile's hollow, dashed box alone", () => {
		assert.ok(TILE.includes(":not(.is-empty)"));
	});
});
