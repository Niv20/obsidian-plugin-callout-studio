/**
 * The block title and content share one inline offset. These tests inspect the
 * CSS contract rather than pretending the fake DOM can measure text: the icon
 * width, its trailing margin, and the title gap must be the same lengths the
 * content uses in either writing direction.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { buildSnippetCss } from "../src/manager/cssSnippetExport";
import type { UserImageIcon } from "../src/types";
import {
	definition,
	harness,
	parseRules,
	ruleFor,
	valueOf,
	type CssRule,
} from "./support/cssInjectorHarness";

const ALIGN_LENGTHS = [
	"--cs-align-icon-inline-size",
	"--cs-align-icon-gap",
	"--cs-align-title-gap",
] as const;

function onlyRuleWith(css: string, property: string): CssRule {
	const rules = parseRules(css).filter((rule) => rule.props.includes(property));
	assert.strictEqual(rules.length, 1, `expected one ${property} rule`);
	const rule = rules[0];
	assert.ok(rule);
	return rule;
}

function assertRegisteredLengths(css: string): void {
	for (const name of ALIGN_LENGTHS) {
		const block = css.match(new RegExp(`@property ${name} \\{([^}]*)\\}`))?.[1];
		assert.ok(block, `missing registration for ${name}`);
		assert.match(block, /syntax:\s*"<length>";/);
		assert.match(block, /inherits:\s*true;/);
		assert.match(block, /initial-value:\s*0px;/);
	}
}

function picture(): UserImageIcon {
	return {
		id: "img-banner",
		name: "banner.svg",
		format: "svg",
		svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 30"/>',
		width: 90,
		height: 30,
		monochrome: false,
		rev: 1,
		addedAt: 1,
	};
}

describe("Align content with title", () => {
	it("leaves native title and content geometry alone while disabled", () => {
		const { css } = harness();
		const out = css.generateGlobalStyleCSS();
		assert.doesNotMatch(out, /@property --cs-align-/);
		assert.ok(!parseRules(out).some((rule) =>
			rule.props.some((property) => property.startsWith("--cs-align-")) ||
			rule.props.includes("padding-inline-start") ||
			rule.props.includes("column-gap") ||
			rule.props.includes("inline-size"),
		));
		assert.strictEqual(
			valueOf(onlyRuleWith(out, "margin-inline-end"), "margin-inline-end"),
			"var(--cs-regular-icon-gap, 0.15em) !important",
		);
	});

	it("shares root-computed lengths between title and content at a different content scale", () => {
		const { registry, css } = harness();
		registry.settings.globalStyle.alignContentWithTitle = true;
		registry.settings.globalStyle.contentScale = 0.75;
		const out = css.generateGlobalStyleCSS();
		assertRegisteredLengths(out);

		const root = onlyRuleWith(out, ALIGN_LENGTHS[0]);
		const icon = onlyRuleWith(out, "inline-size");
		const title = onlyRuleWith(out, "column-gap");
		const content = onlyRuleWith(out, "padding-inline-start");
		assert.ok(root.selector.includes('[data-callout="note"]'));
		assert.strictEqual(valueOf(root, ALIGN_LENGTHS[0]), "var(--icon-size, 1.2em) !important");
		assert.strictEqual(valueOf(root, ALIGN_LENGTHS[1]), "var(--cs-regular-icon-gap, 0.15em) !important");
		assert.strictEqual(valueOf(root, ALIGN_LENGTHS[2]), "var(--size-4-1, 4px) !important");
		assert.strictEqual(valueOf(content, "font-size"), undefined);
		assert.strictEqual(
			valueOf(onlyRuleWith(out, "font-size"), "font-size"),
			"0.75em !important",
		);

		// These are logical properties. The browser maps inline-start to left
		// for LTR and right for RTL; both directions use these same three lengths.
		assert.strictEqual(valueOf(icon, "inline-size"), `var(${ALIGN_LENGTHS[0]}) !important`);
		assert.strictEqual(valueOf(icon, "margin-inline-end"), `var(${ALIGN_LENGTHS[1]}) !important`);
		assert.strictEqual(valueOf(title, "column-gap"), `var(${ALIGN_LENGTHS[2]}) !important`);
		assert.strictEqual(
			valueOf(content, "padding-inline-start"),
			`calc(${ALIGN_LENGTHS.map((name) => `var(${name})`).join(" + ")}) !important`,
		);
		for (const direction of ["ltr", "rtl"] as const) {
			const physicalStart = direction === "ltr" ? "left" : "right";
			const physicalEnd = direction === "ltr" ? "right" : "left";
			for (const rule of [icon, title, content]) {
				assert.ok(!rule.props.includes(`margin-${physicalEnd}`));
				assert.ok(!rule.props.includes(`padding-${physicalStart}`));
			}
		}
	});

	it("matches a wide picture's painted width for its id and alias", () => {
		const { registry, css } = harness();
		registry.settings.globalStyle.alignContentWithTitle = true;
		registry.setUserImages([picture()]);
		const def = definition({
			id: "banner",
			aliases: ["wide alias"],
			icon: { type: "image", value: "img-banner" },
		});
		registry.add(def);
		const out = css.generateCalloutCSS(def);
		const expectedWidth = "calc(var(--icon-size, 1.2em) * 3.000)";
		for (const id of ["banner", "wide-alias"]) {
			const base = `.callout[data-callout="${id}"]`;
			assert.strictEqual(
				valueOf(ruleFor(out, base), ALIGN_LENGTHS[0]),
				`${expectedWidth} !important`,
			);
			const paintedRules = parseRules(out).filter((rule) =>
				rule.selector === `${base} > .callout-title > .callout-icon::after` &&
				rule.at.includes("@media screen") &&
				rule.props.includes("width"),
			);
			assert.strictEqual(paintedRules.length, 1);
			const painted = paintedRules[0];
			assert.ok(painted);
			assert.strictEqual(valueOf(painted, "width"), `${expectedWidth} !important`);
		}
	});

	it("removes the indent for a hidden icon, including an alias", () => {
		const { registry, css } = harness();
		registry.settings.globalStyle.alignContentWithTitle = true;
		registry.setUserImages([picture()]);
		const def = definition({
			id: "bare",
			aliases: ["bare alias"],
			icon: { type: "image", value: "img-banner" },
			hideIcon: true,
		});
		const out = css.generateCalloutCSS(def);
		for (const id of ["bare", "bare-alias"]) {
			const base = `.callout[data-callout="${id}"]`;
			assert.strictEqual(valueOf(ruleFor(out, base), ALIGN_LENGTHS[0]), undefined);
			assert.strictEqual(
				valueOf(ruleFor(out, `${base} > .callout-content`), "padding-inline-start"),
				"0 !important",
			);
		}
	});

	it("includes the typed lengths in standalone CSS exports", () => {
		const { registry, injector } = harness();
		registry.settings.globalStyle.alignContentWithTitle = true;
		registry.add(definition({ id: "exported" }));
		const out = buildSnippetCss({ registry, cssInjector: injector });
		assertRegisteredLengths(out);
		assert.ok(parseRules(out).some((rule) =>
			rule.selector.includes('[data-callout="exported"] > .callout-content') &&
			rule.props.includes("padding-inline-start"),
		));
	});
});
