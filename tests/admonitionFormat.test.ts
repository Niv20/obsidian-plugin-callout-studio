/**
 * tests/admonitionFormat.test.ts — reading another plugin's file.
 *
 * Three containers reach us and all three are accepted, because somebody handing
 * over their admonitions has no reason to know which one they have: the
 * documented array, the bare `Record<type, Admonition>` that Admonition's
 * `userAdmonitions` setting is, and the whole `data.json` with that record
 * inside it.
 *
 * The bare-record branch is the delicate one, and the tests below are mostly
 * about its guard. It has to accept a pasted `userAdmonitions` while rejecting
 * an unrelated JSON object — otherwise any object the user happens to open
 * imports as a pile of empty callouts. The guard is "every value is a record",
 * and both halves of it are load-bearing.
 *
 * Nothing here validates. An entry is read as far as its shape allows and every
 * judgement about it is the planner's, so that all of them can be reported
 * together — which is why a typeless entry comes back with `type: ""` rather
 * than being dropped.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { parseAdmonitionExport } from "../src/utils/admonitionFormat";
import { ImportLimitError, MAX_IMPORT_COLLECTION, MAX_IMPORT_DEPTH } from "../src/utils/importLimits";

const one = {
	type: "my-type",
	title: "My Type",
	icon: { type: "fas", name: "star" },
	color: "200, 50, 50",
};

describe("parseAdmonitionExport — the documented array", () => {
	it("reads every entry", () => {
		const entries = parseAdmonitionExport([one, { type: "second" }]);
		assert.deepStrictEqual(entries?.map((e) => e.type), ["my-type", "second"]);
	});

	it("carries the fields the planner will need", () => {
		const [entry] = parseAdmonitionExport([one]) ?? [];
		assert.equal(entry?.title, "My Type");
		assert.deepStrictEqual(entry?.icon, { type: "fas", name: "star" });
		assert.equal(entry?.color, "200, 50, 50");
	});

	it("carries iconWithCss for the missing-styles warning", () => {
		const [entry] = parseAdmonitionExport([{ type: "x", iconWithCss: true }]) ?? [];
		assert.equal(entry?.iconWithCss, true);
	});

	it("preserves unsupported behavior flags for the import report", () => {
		const [entry] = parseAdmonitionExport([{
			type: "x", command: true, copy: true, noTitle: true, injectColor: false,
		}]) ?? [];
		assert.equal(entry?.command, true);
		assert.equal(entry?.copy, true);
		assert.equal(entry?.noTitle, true);
		assert.equal(entry?.injectColor, false);
	});

	it("drops non-object members in silence", () => {
		// A stray null in an array says nothing about a callout, and the count
		// in the report already comes from what survived.
		const entries = parseAdmonitionExport([null, 42, "x", one, [], undefined]);
		assert.deepStrictEqual(entries?.map((e) => e.type), ["my-type"]);
	});

	it("keeps a typeless entry, with an empty type for the planner to reject", () => {
		// Reading is not validating: the planner is what says
		// `import.err.admTypeMissing`, so that it lands in the same report.
		const entries = parseAdmonitionExport([{ title: "No type" }]);
		assert.deepStrictEqual(entries?.map((e) => e.type), [""]);
	});

	it("trims the type", () => {
		const entries = parseAdmonitionExport([{ type: "  spaced  " }]);
		assert.equal(entries?.[0]?.type, "spaced");
	});

	it("treats a non-string type as absent", () => {
		const entries = parseAdmonitionExport([{ type: 42 }]);
		assert.equal(entries?.[0]?.type, "");
	});

	it("returns an empty array, not null, for an empty array", () => {
		// A vault whose Admonition has no custom types parses fine and simply
		// has nothing to import; only an unrecognizable shape is null.
		assert.deepStrictEqual(parseAdmonitionExport([]), []);
	});
});

describe("parseAdmonitionExport — a whole data.json", () => {
	it("finds the admonitions under userAdmonitions", () => {
		const entries = parseAdmonitionExport({
			userAdmonitions: { alpha: { title: "Alpha" }, beta: { title: "Beta" } },
			someOtherSetting: true,
		});
		assert.deepStrictEqual(entries?.map((e) => e.type), ["alpha", "beta"]);
	});

	it("uses the record key as the type when the entry does not repeat it", () => {
		// This is exactly how Admonition's own `userAdmonitions` is written.
		const entries = parseAdmonitionExport({
			userAdmonitions: { "my-type": { title: "My Type" } },
		});
		assert.equal(entries?.[0]?.type, "my-type");
		assert.equal(entries?.[0]?.title, "My Type");
	});

	it("prefers the entry's own type over the key", () => {
		const entries = parseAdmonitionExport({
			userAdmonitions: { key: { type: "own" } },
		});
		assert.equal(entries?.[0]?.type, "own");
	});

	it("falls back to the key when the entry's own type is blank", () => {
		const entries = parseAdmonitionExport({
			userAdmonitions: { key: { type: "   " } },
		});
		assert.equal(entries?.[0]?.type, "key");
	});

	it("trims the key too", () => {
		const entries = parseAdmonitionExport({ userAdmonitions: { "  k  ": {} } });
		assert.equal(entries?.[0]?.type, "k");
	});

	it("returns an empty array for an empty userAdmonitions", () => {
		assert.deepStrictEqual(parseAdmonitionExport({ userAdmonitions: {} }), []);
	});

	it("wins over a top-level type field", () => {
		const entries = parseAdmonitionExport({
			type: "decoy",
			userAdmonitions: { real: {} },
		});
		assert.deepStrictEqual(entries?.map((e) => e.type), ["real"]);
	});

	it("skips non-object members of the record", () => {
		const entries = parseAdmonitionExport({
			userAdmonitions: { good: {}, bad: null, worse: "x" },
		});
		assert.deepStrictEqual(entries?.map((e) => e.type), ["good"]);
	});
});

describe("parseAdmonitionExport — a single admonition on its own", () => {
	it("wraps it in a list", () => {
		const entries = parseAdmonitionExport(one);
		assert.deepStrictEqual(entries?.map((e) => e.type), ["my-type"]);
	});

	it("needs a non-blank type to take that branch", () => {
		// With a blank type there is nothing to file it under, so it falls
		// through to the bare-record guard — which rejects it.
		assert.equal(parseAdmonitionExport({ type: "   ", title: "x" }), null);
	});
});

describe("parseAdmonitionExport — a bare Record<type, Admonition>", () => {
	it("accepts a pasted userAdmonitions without its wrapper", () => {
		const entries = parseAdmonitionExport({
			alpha: { title: "Alpha" },
			beta: { icon: "star" },
		});
		assert.deepStrictEqual(entries?.map((e) => e.type), ["alpha", "beta"]);
	});

	it("rejects an object whose values are not all records", () => {
		// The guard that stops an unrelated JSON file from importing as a pile
		// of empty callouts.
		assert.equal(parseAdmonitionExport({ a: 1, b: 2 }), null);
		assert.equal(parseAdmonitionExport({ good: {}, bad: "string" }), null);
		assert.equal(parseAdmonitionExport({ a: {}, b: null }), null);
		assert.equal(parseAdmonitionExport({ a: {}, b: [] }), null);
	});

	it("rejects an empty object — there is nothing to recognize it by", () => {
		assert.equal(parseAdmonitionExport({}), null);
	});

	it("accepts a record of empty objects, keying every type off the key", () => {
		const entries = parseAdmonitionExport({ a: {}, b: {} });
		assert.deepStrictEqual(entries?.map((e) => e.type), ["a", "b"]);
	});
});

describe("parseAdmonitionExport — not Admonition data at all", () => {
	it("applies resource limits even when called with already-parsed JSON", () => {
		assert.throws(() => parseAdmonitionExport(
			Array.from({ length: MAX_IMPORT_COLLECTION + 1 }, () => ({ type: "x" })),
		), ImportLimitError);
		let nested: unknown = { type: "x" };
		for (let i = 0; i < MAX_IMPORT_DEPTH; i++) nested = { nested };
		assert.throws(() => parseAdmonitionExport(nested), ImportLimitError);
	});

	it("returns null for a value that is not an object or array", () => {
		for (const junk of [null, undefined, "text", 42, true]) {
			assert.equal(parseAdmonitionExport(junk), null, String(junk));
		}
	});

	it("distinguishes null (unrecognizable) from [] (nothing to import)", () => {
		// The planner says two different things about these, so the parser has
		// to keep them apart.
		assert.equal(parseAdmonitionExport("nonsense"), null);
		assert.deepStrictEqual(parseAdmonitionExport([]), []);
		assert.deepStrictEqual(parseAdmonitionExport({ userAdmonitions: {} }), []);
	});

	it("never throws on hostile input", () => {
		assert.doesNotThrow(() => parseAdmonitionExport({ userAdmonitions: [] }));
		assert.doesNotThrow(() => parseAdmonitionExport([[[[]]]]));
		assert.doesNotThrow(() => parseAdmonitionExport(Object.create(null)));
	});
});
