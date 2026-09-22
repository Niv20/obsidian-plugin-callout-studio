/**
 * tests/calloutListIcon.test.ts — the shared compact callout painter follows
 * the only two live ownership states: Callout Studio or the active theme.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { installFakeDom } from "./support/fakeDom";
import { readRepoFile } from "./support/sourceScan";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { paintCalloutListIcon } from "../src/manager/theme/calloutListIcon";
import type { CalloutDefinition } from "../src/types";

installFakeDom();

function definition(
	over: Partial<CalloutDefinition> = {},
): CalloutDefinition {
	return {
		id: "quiet",
		displayName: "Quiet",
		icon: { type: "emoji", value: "📌" },
		colorLight: "#336699",
		colorDark: "#88bbee",
		foldable: false,
		defaultFolded: false,
		builtIn: false,
		source: "user",
		...over,
	};
}

describe("paintCalloutListIcon", () => {
	it("draws a Studio-owned callout from its stored definition", () => {
		const registry = new CalloutRegistry();
		registry.load(null);
		const def = definition();
		const iconEl = createDiv();
		assert.equal(
			paintCalloutListIcon(iconEl, def, registry, false),
			"#336699",
		);
		assert.equal(iconEl.textContent, "📌");
	});

	it("uses the active theme's measured accent when the theme owns the id", () => {
		const registry = new CalloutRegistry();
		registry.load(null);
		const def = definition();
		registry.setThemeOwnedIds(new Set([def.id]));
		registry.setThemeAppearances(
			new Map([
				[
					def.id,
					{
						accent: "rgb(1, 2, 3)",
						background: "rgb(4, 5, 6)",
						icon: { kind: "unknown" as const },
					},
				],
			]),
		);
		assert.equal(
			paintCalloutListIcon(createDiv(), def, registry, false),
			"rgb(1, 2, 3)",
		);
	});

	it("contains no retired personal-CSS branch", () => {
		const source = readRepoFile("src/manager/theme/calloutListIcon.ts");
		assert.ok(!source.includes("externalStyle"));
	});
});
