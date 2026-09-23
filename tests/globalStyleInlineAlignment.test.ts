import assert from "node:assert";
import { it } from "node:test";
import { harness, ruleFor, valueOf } from "./support/cssInjectorHarness";
import { readRepoFile } from "./support/sourceScan";

it("emits a scale-cancelled optical lift for every inline font scale", () => {
	const staticPill = ruleFor(readRepoFile("styles.css"), ".cs-inline-callout");
	assert.strictEqual(valueOf(staticPill, "vertical-align"), "middle");
	assert.strictEqual(
		valueOf(staticPill, "--cs-inline-center-lift"),
		"0.1em",
	);
	assert.strictEqual(
		valueOf(staticPill, "top"),
		"calc(-1 * var(--cs-inline-lift) - var(--cs-inline-center-lift))",
	);

	for (const [scale, centerLift] of [
		[0.1, "1.000em"],
		[0.5, "0.200em"],
		[0.75, "0.133em"],
		[1, undefined],
		[1.5, "0.067em"],
	] as const) {
		const { registry, css } = harness();
		registry.settings.globalStyle.inline.fontScale = scale;
		registry.settings.globalStyle.inline.borderRadius = 20;
		const pill = ruleFor(css.generateGlobalStyleCSS(), ".cs-inline-callout");
		assert.strictEqual(
			valueOf(pill, "--cs-inline-scale"),
			scale === 1 ? undefined : String(scale),
			`inline font scale ${scale}`,
		);
		assert.strictEqual(
			valueOf(pill, "--cs-inline-center-lift"),
			centerLift,
			`inline font scale ${scale}`,
		);
	}
});
