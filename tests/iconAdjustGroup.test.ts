/**
 * The built-in editor's role-level icon-adjust reset. One action owns the
 * three sliders in its card: it appears only after that role diverges, restores
 * both form state and slider thumbs, and reports one change to the preview.
 */
import { asEl, fakeDom, type FakeElement } from "./support/fakeDom";
import assert from "node:assert";
import { describe, it } from "node:test";
import { createdSliders, type SliderComponent } from "./support/obsidianStub";
import { renderIconAdjustGroup } from "../src/settings/editor/iconAdjustGroup";
import {
	DEFAULT_ICON_ADJUST,
	type ResolvedIconAdjust,
} from "../src/utils/iconAdjust";
import { readRepoFile } from "./support/sourceScan";

const css = readRepoFile("styles.css")
	.replace(/\/\*[\s\S]*?\*\//g, "")
	.replace(/\s+/g, " ");

/** Declarations for one exact, unnested selector in the flattened stylesheet. */
function cssRule(selector: string): string {
	const start = css.indexOf(`${selector} {`);
	assert.notStrictEqual(start, -1, `missing CSS rule for ${selector}`);
	const open = css.indexOf("{", start);
	const close = css.indexOf("}", open);
	return css.slice(open + 1, close);
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

describe("renderIconAdjustGroup — reset affordance", () => {
	it("matches the Live preview header until a reset button is visible", () => {
		const preview = cssRule(".callout-studio-preview-header");
		const adjustment = cssRule(".callout-studio-adjust-header");
		const iconAdjustment = cssRule(".cs-icon-adjust-header");

		for (const property of ["padding", "font-size", "font-weight"]) {
			assert.strictEqual(
				cssValue(adjustment, property),
				cssValue(preview, property),
				`${property} must keep both idle header strips the same height`,
			);
		}
		for (const property of [
			"height",
			"min-height",
			"padding",
			"padding-block",
			"padding-top",
			"padding-bottom",
		]) {
			assert.strictEqual(
				cssValue(iconAdjustment, property),
				undefined,
				`${property} makes the icon-adjustment header taller while reset is hidden`,
			);
		}

		assert.strictEqual(cssValue(cssRule(".cs-hidden"), "display"), "none");
		assert.strictEqual(cssValue(cssRule(".cs-icon-adjust-reset"), "height"), "28px");
	});

	it("does not offer reset when the caller has no built-in defaults", () => {
		const { box } = build({ ...DEFAULT_ICON_ADJUST });
		assert.strictEqual(box.querySelector(".cs-icon-adjust-reset"), null);
	});

	it("starts hidden when the role still matches its shipped values", () => {
		const { box } = build(
			{ ...DEFAULT_ICON_ADJUST },
			{ ...DEFAULT_ICON_ADJUST },
		);
		const button = resetButton(box);
		assert.ok(button.hasClass("cs-hidden"));
		assert.match(
			button.getAttribute("aria-label") ?? "",
			/Icon adjustment.*Heading callout/,
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
		assert.ok(!resetButton(box).hasClass("cs-hidden"));
		assert.strictEqual(changes(), 2);

		resetButton(box).fire("click");
		assert.deepStrictEqual(adjust, DEFAULT_ICON_ADJUST);
		assert.deepStrictEqual(
			sliders().map((slider) => slider.getValue()),
			[100, 0, 0],
		);
		assert.ok(resetButton(box).hasClass("cs-hidden"));
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
