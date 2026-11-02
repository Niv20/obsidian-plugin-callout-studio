/**
 * tests/iconAdjustGroup.test.ts — one render role's icon-adjustment group in
 * the callout editor (`settings/editor/iconAdjustGroup.ts`).
 *
 * The group is an Obsidian `SettingGroup` (finding S5-14): a heading, one box,
 * a stacked row per slider. For a built-in its heading holds one ↺ that owns
 * all three sliders: invisible until the role diverges, it restores both the
 * form state and the slider thumbs, and reports one change to the preview.
 */
import { asEl, fakeDom, type FakeElement } from "./support/fakeDom";
import assert from "node:assert";
import { describe, it } from "node:test";
import { createdSliders, type SliderComponent } from "./support/obsidianStub";
import { renderIconAdjustGroup } from "../src/settings/editor/iconAdjustGroup";
import { t } from "../src/i18n";
import { DEFAULT_ICON_ADJUST, type ResolvedIconAdjust } from "../src/utils/iconAdjust";
import { readRepoFile } from "./support/sourceScan";

const css = readRepoFile("styles.css")
	.replace(/\/\*[\s\S]*?\*\//g, "")
	.replace(/\s+/g, " ");

/** Declarations for an exact selector, including shared comma-separated rules. */
function cssRule(selector: string): string {
	const rule = Array.from(css.matchAll(/([^{}]+)\{([^{}]*)\}/g)).find((match) =>
		match[1]!.split(",").some((entry) => entry.trim() === selector),
	);
	assert.ok(rule, `missing CSS rule for ${selector}`);
	return rule[2]!;
}

function cssValue(rule: string, property: string): string | undefined {
	return new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`).exec(rule)?.[1]?.trim();
}

function build(
	adjust: ResolvedIconAdjust,
	defaults?: ResolvedIconAdjust,
): {
	box: FakeElement;
	changes: () => number;
} {
	createdSliders.length = 0;
	fakeDom.document.body.empty();
	let count = 0;
	const box = renderIconAdjustGroup(
		asEl(fakeDom.document.body),
		"heading",
		adjust,
		() => count++,
		defaults,
	) as unknown as FakeElement;
	return { box, changes: () => count };
}

function resetButton(box: FakeElement): FakeElement {
	const button = box.querySelector(".cs-icon-adjust-reset");
	assert.ok(button, "expected a role-level reset button");
	return button;
}

function sliders(): SliderComponent[] {
	return createdSliders as unknown as SliderComponent[];
}

describe("renderIconAdjustGroup — an Obsidian group", () => {
	it("is a SettingGroup with the role's heading and a row per slider", () => {
		const { box } = build({ ...DEFAULT_ICON_ADJUST });
		assert.ok(box.hasClass("setting-group"));
		assert.ok(box.hasClass("cs-editor-group"), "rows share the editor's 16px inset");
		const heading = box.querySelector(".setting-item-heading .setting-item-name");
		assert.strictEqual(heading?.textContent, t("editor.headingIconAdjustments"));
		const rows = Array.from(box.querySelectorAll(".setting-item")).filter(
			(row) => !row.hasClass("setting-item-heading"),
		);
		assert.strictEqual(rows.length, 3);
		for (const row of rows) {
			assert.ok(!row.hasClass("cs-stacked-slider"));
			assert.ok(row.closest(".setting-items"), "each slider is a row in the group's box");
		}
	});

	it("keeps the heading one height whether the reset shows or not", () => {
		// Invisible, not `display: none`: the button keeps its room.
		assert.strictEqual(cssValue(cssRule(".cs-reset-idle"), "visibility"), "hidden");
		assert.strictEqual(cssValue(cssRule(".cs-reset-idle"), "display"), undefined);
		// The old grey header strips are gone with the boxes they topped.
		assert.ok(!css.includes(".cs-icon-adjust-header"));
		assert.ok(!css.includes(".callout-studio-preview-header"));
	});
});

describe("renderIconAdjustGroup — reset affordance", () => {
	it("does not offer reset when the caller has no built-in defaults", () => {
		const { box } = build({ ...DEFAULT_ICON_ADJUST });
		assert.strictEqual(box.querySelector(".cs-icon-adjust-reset"), null);
	});

	it("starts hidden when the role still matches its shipped values", () => {
		const { box } = build({ ...DEFAULT_ICON_ADJUST }, { ...DEFAULT_ICON_ADJUST });
		const button = resetButton(box);
		assert.ok(button.hasClass("cs-reset-idle"));
		assert.ok(button.closest(".setting-item-heading"), "the reset sits in the group's heading");
		assert.strictEqual(
			button.getAttribute("aria-label") ?? "",
			`${t("settings.resetAction")}: ${t("editor.headingIconAdjustments")}`,
		);
	});

	it("appears after a slider moves and resets the whole role once", () => {
		const adjust = { ...DEFAULT_ICON_ADJUST };
		const { box, changes } = build(adjust, { ...DEFAULT_ICON_ADJUST });
		const [sizeSlider, xSlider] = sliders();
		assert.ok(sizeSlider);
		assert.ok(xSlider);

		sizeSlider.commit(125);
		xSlider.commit(4);
		assert.deepStrictEqual(adjust, { size: 1.25, offsetX: 4, offsetY: 0 });
		assert.ok(!resetButton(box).hasClass("cs-reset-idle"));
		assert.strictEqual(changes(), 2);

		resetButton(box).fire("click");
		assert.deepStrictEqual(adjust, DEFAULT_ICON_ADJUST);
		assert.deepStrictEqual(
			sliders().map((slider) => slider.getValue()),
			[100, 0, 0],
		);
		assert.ok(resetButton(box).hasClass("cs-reset-idle"));
		assert.strictEqual(changes(), 3);
	});

	it("uses the shipped role values rather than hard-coded neutral values", () => {
		const adjust = { offsetX: -3, offsetY: 5, size: 0.75 };
		const defaults = { offsetX: 2, offsetY: -1, size: 1.1 };
		const { box } = build(adjust, defaults);

		resetButton(box).fire("click");
		assert.deepStrictEqual(adjust, defaults);
		assert.deepStrictEqual(
			sliders().map((slider) => slider.getValue()),
			[110, 2, -1],
		);
	});
});
