/**
 * tests/admonitionIcons.test.ts — "what drawing did they mean?"
 *
 * The libraries line up better than they have any right to: Admonition offers
 * Obsidian's own icons plus five downloadable packs, and this plugin carries
 * every one of them. Most names match, except two legacy RPG glyph names that
 * our generator spells according to the library's stylesheet.
 *
 * What is not a rename is the guessing, and that is the other half of these
 * tests. The icon field has three spellings in the wild, and the legacy
 * `"font-awesome"` pack was split into three files upstream, so an unlabelled
 * name has to be probed against a list in a specific order. Lucide comes first
 * because Admonition's own `getIconType()` starts there too. The remaining order
 * is a deterministic fallback: upstream's downloaded-pack installation order
 * is not available in a shared export.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import {
	iconCandidates,
	isAdmonitionImage,
	readAdmonitionIcon,
	resolveIcon,
} from "../src/utils/admonitionIcons";

const types = (raw: unknown): string[] => {
	const icon = readAdmonitionIcon(raw);
	assert.ok(icon, `expected an icon from ${JSON.stringify(raw)}`);
	return iconCandidates(icon).map((c) => c.type);
};

describe("readAdmonitionIcon — the bare string form", () => {
	it("reads a plain name, as upstream's own docs/import.md shows", () => {
		assert.deepStrictEqual(readAdmonitionIcon("globe"), { name: "globe" });
	});

	it("trims it", () => {
		assert.deepStrictEqual(readAdmonitionIcon("  globe  "), { name: "globe" });
	});

	it("treats a blank string as no icon", () => {
		assert.equal(readAdmonitionIcon(""), undefined);
		assert.equal(readAdmonitionIcon("   "), undefined);
	});
});

describe("readAdmonitionIcon — the object form", () => {
	it("keeps the pack when the file names one", () => {
		assert.deepStrictEqual(readAdmonitionIcon({ type: "fas", name: "star" }), {
			type: "fas",
			name: "star",
		});
	});

	it("omits the pack entirely when the file names none", () => {
		// `{ name }` and `{ type: undefined, name }` are different objects; the
		// candidate list branches on `type` being absent.
		assert.deepStrictEqual(readAdmonitionIcon({ name: "star" }), { name: "star" });
		assert.ok(!("type" in readAdmonitionIcon({ name: "star" })!));
	});

	it("treats a blank or non-string pack as absent", () => {
		assert.deepStrictEqual(readAdmonitionIcon({ type: "", name: "star" }), {
			name: "star",
		});
		assert.deepStrictEqual(readAdmonitionIcon({ type: "  ", name: "star" }), {
			name: "star",
		});
		assert.deepStrictEqual(readAdmonitionIcon({ type: 42, name: "star" }), {
			name: "star",
		});
	});

	it("trims both halves", () => {
		assert.deepStrictEqual(readAdmonitionIcon({ type: " fas ", name: " star " }), {
			type: "fas",
			name: "star",
		});
	});

	it("needs a name — a pack alone is not an icon", () => {
		assert.equal(readAdmonitionIcon({ type: "fas" }), undefined);
		assert.equal(readAdmonitionIcon({ type: "fas", name: "" }), undefined);
		assert.equal(readAdmonitionIcon({ type: "fas", name: "   " }), undefined);
		assert.equal(readAdmonitionIcon({ type: "fas", name: 42 }), undefined);
	});
});

describe("readAdmonitionIcon — no icon at all", () => {
	it("returns undefined rather than throwing on untrusted JSON", () => {
		for (const junk of [null, undefined, 42, true, [], [{ name: "x" }], {}]) {
			assert.equal(readAdmonitionIcon(junk), undefined, JSON.stringify(junk));
		}
	});
});

describe("isAdmonitionImage", () => {
	it("recognizes an uploaded picture", () => {
		assert.equal(isAdmonitionImage({ type: "image", name: "data:image/png,x" }), true);
	});

	it("is false for every named pack, and for a typeless icon", () => {
		for (const type of ["fas", "far", "fab", "obsidian", "octicons", "rpg"]) {
			assert.equal(isAdmonitionImage({ type, name: "star" }), false, type);
		}
		assert.equal(isAdmonitionImage({ name: "star" }), false);
	});
});

describe("iconCandidates — a named pack is a straight rename", () => {
	it("maps each of Admonition's pack ids onto ours", () => {
		assert.deepStrictEqual(types({ type: "obsidian", name: "pencil" }), ["lucide"]);
		assert.deepStrictEqual(types({ type: "fas", name: "star" }), ["fa-solid"]);
		assert.deepStrictEqual(types({ type: "far", name: "star" }), ["fa-regular"]);
		assert.deepStrictEqual(types({ type: "fab", name: "github" }), ["fa-brands"]);
		assert.deepStrictEqual(types({ type: "octicons", name: "accessibility" }), [
			"octicons",
		]);
		assert.deepStrictEqual(types({ type: "rpg", name: "acid" }), ["rpg-awesome"]);
	});

	it("carries the name through untouched — the ids differ, the names do not", () => {
		const icon = readAdmonitionIcon({ type: "rpg", name: "acid" })!;
		assert.deepStrictEqual(iconCandidates(icon), [
			{ type: "rpg-awesome", value: "acid" },
		]);
	});

	it("offers exactly one candidate when the pack is known", () => {
		assert.equal(iconCandidates({ type: "fas", name: "star" }).length, 1);
	});

	it("maps the two RPG glyph spellings onto the names our artwork uses", () => {
		assert.deepStrictEqual(iconCandidates({ type: "rpg", name: "montains" }), [
			{ type: "rpg-awesome", value: "mountains" },
		]);
		assert.deepStrictEqual(iconCandidates({ type: "rpg", name: "perspective-dice-six-two" }), [
			{ type: "rpg-awesome", value: "perspective-dice-two" },
		]);
		assert.deepStrictEqual(iconCandidates({ type: "fas", name: "montains" }), [
			{ type: "fa-solid", value: "montains" },
		]);
	});
});

describe("iconCandidates — the guessing", () => {
	const INFERENCE_ORDER = [
		"lucide",
		"fa-solid",
		"fa-regular",
		"fa-brands",
		"octicons",
		"rpg-awesome",
	];

	it("probes every library, Obsidian's own first, when no pack is named", () => {
		// Lucide wins in both plugins; otherwise use our stable fallback order.
		assert.deepStrictEqual(types("globe"), INFERENCE_ORDER);
		assert.deepStrictEqual(types({ name: "globe" }), INFERENCE_ORDER);
	});

	it("expands the legacy `font-awesome` pack into its three files, in order", () => {
		// One pack upstream, three downloads here. Without this, an icon stored
		// under the old id would resolve nowhere.
		assert.deepStrictEqual(types({ type: "font-awesome", name: "star" }), [
			"fa-solid",
			"fa-regular",
			"fa-brands",
		]);
	});

	it("guesses rather than refuses for a pack this build never heard of", () => {
		// Most likely one Admonition added after this was written. The name is
		// still a name, and if nothing has it the report says so.
		assert.deepStrictEqual(types({ type: "some-new-pack", name: "x" }), INFERENCE_ORDER);
	});

	it("treats Object.prototype names as unknown pack strings", () => {
		for (const type of ["__proto__", "constructor", "toString", "valueOf", "hasOwnProperty"]) {
			assert.deepStrictEqual(types({ type, name: "star" }), INFERENCE_ORDER, type);
		}
	});

	it("always offers at least one candidate for a named icon", () => {
		// So a name that exists nowhere produces a definite "no such icon" in
		// the report rather than silence.
		for (const raw of [
			"anything",
			{ name: "anything" },
			{ type: "fas", name: "anything" },
			{ type: "made-up", name: "anything" },
		]) {
			assert.ok(types(raw).length >= 1, JSON.stringify(raw));
		}
	});

	it("refuses oversized names even when an index cannot validate names", async () => {
		const raw = { type: "fas", name: "x".repeat(201) };
		assert.deepStrictEqual(iconCandidates(raw), []);
		assert.equal(await resolveIcon(raw, () => true), undefined);
	});

	it("offers nothing for a picture — it travels its own way", () => {
		assert.deepStrictEqual(
			iconCandidates({ type: "image", name: "data:image/png;base64,AAAA" }),
			[],
		);
	});

	it("gives every candidate the same name", () => {
		const candidates = iconCandidates({ name: "globe" });
		assert.ok(candidates.every((c) => c.value === "globe"));
	});
});
