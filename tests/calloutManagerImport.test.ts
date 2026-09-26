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
import { planCalloutManagerImport, toCalloutManagerEntries } from "../src/utils/calloutManagerImport";
import { parseCalloutManagerExport } from "../src/utils/calloutCssParse";
import { parseCalloutManagerData, type CalloutManagerRaw } from "../src/utils/calloutManagerFormat";
import { ImportLimitError, MAX_IMPORT_BYTES, MAX_IMPORT_COLLECTION, MAX_IMPORT_VALUES } from "../src/utils/importLimits";
import { harness } from "./support/cssInjectorHarness";
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

	it("uses the last declaration inside the same block, as CM's settings cascade does", () => {
		const [entry] = parseCalloutManagerExport(`.callout[data-callout="note"] {
			--callout-color: rgb(255, 0, 0); --callout-icon: lucide-star;
			--callout-color: rgb(0, 0, 255); --callout-icon: lucide-moon;
		}`);
		assert.equal(entry?.color, "#0000ff");
		assert.equal(entry?.icon?.value, "moon");
	});

	it("does not merge invalid metadata or multiline IDs into a valid callout", () => {
		for (const invalid of ["note|malicious", "note\n"]) {
			const entries = parseCalloutManagerExport(`
				.callout[data-callout="${invalid}"] { --callout-color: rgb(255, 0, 0); }
				.callout[data-callout="note"] { --callout-icon: lucide-star; }
			`);
			assert.equal(entries.length, 2);
			assert.equal(entries.find(entry => entry.id === "note")?.color, undefined);
			const { toApply, issues } = planCalloutManagerImport(entries, harness().registry);
			assert.ok(issues.some(issue => issue.level === "error" && issue.entryLabel === invalid));
			assert.ok(toApply.every(item => item.entry.color === undefined));
		}
	});

	it("handles large brace-free and unterminated CSS without regex backtracking", () => {
		// Each input drove a quadratic regex before the bounded scanner. Keep
		// these substantial enough to expose that regression without timing gates.
		assert.deepEqual(parseCalloutManagerExport("x".repeat(150_000)), []);
		assert.deepEqual(parseCalloutManagerExport("/*".repeat(75_000)), []);
		assert.deepEqual(parseCalloutManagerExport('.callout[data-callout="note"] {' + "x".repeat(150_000)), []);
	});

	it("discards unfinished comments rather than importing fake rules inside them", () => {
		assert.deepEqual(parseCalloutManagerExport('/* .callout[data-callout="note"] { --callout-color: 1,2,3; }'), []);
	});

	it("does not treat quoted text or function arguments as declarations", () => {
		const [entry] = parseCalloutManagerExport(`.callout[data-callout="note"] {
			content: "; --callout-color: rgb(255,0,0);";
			background: url(data:ignored; --callout-color: rgb(255,0,0));
			--callout-icon: lucide-star;
		}`);
		assert.equal(entry?.color, undefined);
		assert.equal(entry?.icon?.value, "star");
	});

	it("enforces size, entry and token budgets before returning a partial import", () => {
		assert.throws(() => parseCalloutManagerExport("x".repeat(MAX_IMPORT_BYTES + 1)), ImportLimitError);
		assert.throws(() => parseCalloutManagerExport(Array.from({ length: MAX_IMPORT_COLLECTION + 1 }, (_, i) =>
			`.callout[data-callout="x${i}"] { --callout-color: 1,2,3; }`).join("\n")), ImportLimitError);
		assert.throws(() => parseCalloutManagerExport("{}".repeat(MAX_IMPORT_VALUES)), ImportLimitError);
	});
});

describe("planCalloutManagerImport — reports match applied work", () => {
	it("rejects duplicate identities within the batch before minting extra palettes", () => {
		const h = harness();
		const { toApply, issues } = planCalloutManagerImport([
			{ id: "batch callout", color: "#ff0000" },
			{ id: "BATCH-CALLOUT", color: "#0000ff" },
		], h.registry);
		assert.equal(toApply.length, 1);
		assert.equal(issues[0]?.messageKey, "import.err.cmDuplicateId");
		assert.deepEqual(h.registry.applyCalloutManagerImport(toApply), { created: 1, updated: 0 });
		assert.equal(h.registry.settings.customPalettes.length, 1);
	});

	it("rejects duplicate updates as well as duplicate creations", () => {
		const { toApply, issues } = planCalloutManagerImport([
			{ id: "note", color: "#ff0000" },
			{ id: " NOTE ", color: "#0000ff" },
		], harness().registry);
		assert.equal(toApply.length, 1);
		assert.equal(issues[0]?.messageKey, "import.err.cmDuplicateId");
	});

	it("reports unsupported-only existing rows without offering an empty update", () => {
		const entries = parseCalloutManagerData({ settings: { note: [{ changes: { customStyles: "color: red;" } }] } });
		assert.ok(entries);
		const { toApply, issues } = planCalloutManagerImport(toCalloutManagerEntries(entries), harness().registry);
		assert.equal(toApply.length, 0);
		assert.equal(issues[0]?.messageKey, "import.warn.cmCustomStylesSkipped");
	});

	it("does not hide invalid boundary whitespace by trimming it before validation", () => {
		const entries = parseCalloutManagerData({ custom: ["note\n"], settings: { "note\n": [{ changes: { color: "1, 2, 3" } }] } });
		assert.ok(entries);
		const { toApply, issues } = planCalloutManagerImport(toCalloutManagerEntries(entries), harness().registry);
		assert.equal(toApply.length, 0);
		assert.equal(issues[0]?.messageKey, "import.err.idBadChar");
	});
});
