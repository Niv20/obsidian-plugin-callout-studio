/**
 * tests/calloutManagerImport.test.ts — interpreting what the format layer read,
 * and the two-hex palette split it needs.
 *
 * Two things here are easy to break and invisible when they are:
 *
 * - **The light/dark collapse.** Only a genuine disagreement is worth carrying
 *   as two accents. A source that stated the same hex twice must come out
 *   single-coloured, or it stops matching the palettes it used to match and
 *   mints a duplicate instead.
 * - **The derivation refactor.** `derivePaletteFromColor` is now a wrapper
 *   around `derivePaletteFromColors`, so it has to keep returning exactly what
 *   it always did — every existing callout's colours are downstream of it.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { toCalloutManagerEntries } from "../src/utils/calloutManagerImport";
import { parseCalloutManagerExport } from "../src/utils/calloutCssParse";
import type { CalloutManagerRaw } from "../src/utils/calloutManagerFormat";
import {
	derivePaletteFromColor,
	derivePaletteFromColors,
} from "../src/utils/colorUtils";

function raw(over: Partial<CalloutManagerRaw> = {}): CalloutManagerRaw {
	return { id: "x", declared: false, notes: [], ...over };
}

describe("toCalloutManagerEntries — the light/dark collapse", () => {
	it("carries two accents when the source really stated two", () => {
		const [entry] = toCalloutManagerEntries([
			raw({ colorLight: "255, 0, 0", colorDark: "0, 0, 255" }),
		]);
		assert.equal(entry?.color, "#ff0000");
		assert.equal(entry?.colorDark, "#0000ff");
	});

	it("collapses an identical pair to one accent", () => {
		const [entry] = toCalloutManagerEntries([
			raw({ colorLight: "255, 0, 0", colorDark: "rgb(255, 0, 0)" }),
		]);
		assert.equal(entry?.color, "#ff0000");
		assert.equal(entry?.colorDark, undefined);
	});

	it("promotes a scheme-only accent to the single colour", () => {
		const [dark] = toCalloutManagerEntries([raw({ colorDark: "0, 0, 255" })]);
		assert.equal(dark?.color, "#0000ff");
		assert.equal(dark?.colorDark, undefined);

		const [light] = toCalloutManagerEntries([raw({ colorLight: "255, 0, 0" })]);
		assert.equal(light?.color, "#ff0000");
		assert.equal(light?.colorDark, undefined);
	});

	it("leaves a colourless entry colourless", () => {
		const [entry] = toCalloutManagerEntries([raw({ declared: true })]);
		assert.equal(entry?.color, undefined);
		assert.equal(entry?.declared, true);
	});

	it("drops an unparseable colour rather than passing it through", () => {
		const [entry] = toCalloutManagerEntries([raw({ colorLight: "not a colour" })]);
		assert.equal(entry?.color, undefined);
	});

	it("strips only the lucide- prefix from an icon id", () => {
		const [core] = toCalloutManagerEntries([raw({ icon: "lucide-bike" })]);
		assert.deepEqual(core?.icon, { type: "lucide", value: "bike" });

		// A foreign id another plugin registered stays intact — whether it draws
		// here is the planner's name check to decide, not this step's.
		const [foreign] = toCalloutManagerEntries([raw({ icon: "remix-FireFill" })]);
		assert.deepEqual(foreign?.icon, { type: "lucide", value: "remix-FireFill" });
	});

	it("maps one-to-one, so report row numbers keep lining up", () => {
		const raws = [raw({ id: "a" }), raw({ id: "b" }), raw({ id: "c" })];
		assert.deepEqual(
			toCalloutManagerEntries(raws).map((entry) => entry.id),
			["a", "b", "c"],
		);
	});
});

describe("derivePaletteFromColors", () => {
	it("is identical to the single-hex form when both sides match", () => {
		for (const hex of ["#448aff", "#9e9e9e", "#000000", "#ffffff", "#fb464c"]) {
			assert.deepEqual(
				derivePaletteFromColors(hex, hex),
				derivePaletteFromColor(hex),
				`${hex} must derive the same palette either way`,
			);
		}
	});

	it("derives each mode from its own accent", () => {
		const split = derivePaletteFromColors("#ff0000", "#0000ff");
		const red = derivePaletteFromColor("#ff0000");
		const blue = derivePaletteFromColor("#0000ff");
		assert.equal(split.colorLight, red.colorLight);
		assert.equal(split.bgColorLight, red.bgColorLight);
		assert.equal(split.colorDark, blue.colorDark);
		assert.equal(split.bgColorDark, blue.bgColorDark);
	});
});

describe("parseCalloutManagerExport — recovering from generated CSS", () => {
	it("reads back a stylesheet this plugin wrote", async () => {
		// The recovery route offered to anyone whose settings file was lost:
		// the startup snapshot in localStorage is the whole generated
		// stylesheet, and the paste box is what turns it back into callouts.
		// Every custom property in that sheet is `!important`, so this is also
		// the regression test for parsing around it.
		const { harness, definition } = await import(
			"./support/cssInjectorHarness"
		);
		const h = harness();
		const def = definition({
			id: "insight",
			displayName: "Insight",
			icon: { type: "lucide", value: "lightbulb" },
			colorLight: "#aa3366",
			colorDark: "#ff88bb",
		});
		h.registry.add(def);

		const entries = parseCalloutManagerExport(h.css.generateCalloutCSS(def));
		const insight = entries.find((e) => e.id === "insight");

		assert.ok(insight, "the callout was not recoverable from its own CSS");
		assert.deepEqual(
			insight.icon,
			{ type: "lucide", value: "lightbulb" },
			"`!important` leaked into the icon name",
		);
		assert.equal(
			insight.color,
			"#ff88bb",
			"no colour survived; the dark block wins the per-property merge",
		);
	});

	it("tolerates !important on either declaration", () => {
		const entries = parseCalloutManagerExport(
			`.callout[data-callout="tip"] {
				--callout-color: rgb(255, 0, 0) !important;
				--callout-icon: lucide-star !important;
			}`,
		);
		assert.deepEqual(entries, [
			{ id: "tip", icon: { type: "lucide", value: "star" }, color: "#ff0000" },
		]);
	});
});
