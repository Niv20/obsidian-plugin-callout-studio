import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MAX_TAG_LENGTH } from "../src/constants";
import { createDuplicateCalloutDefinition } from "../src/manager/duplicateCalloutDefinition";
import type { CalloutDefinition } from "../src/types";
import { calloutIdentity, sanitizeCalloutIdInput } from "../src/utils/calloutId";
import { MAX_DISPLAY_NAME } from "../src/utils/importValidator";

function definition(
	id = "my style",
	changes: Partial<CalloutDefinition> = {},
): CalloutDefinition {
	return {
		id,
		displayName: "My style",
		icon: { type: "lucide", value: "lucide-star" },
		colorLight: "#112233",
		colorDark: "#aabbcc",
		foldable: true,
		defaultFolded: false,
		builtIn: false,
		source: "user",
		...changes,
	};
}

describe("createDuplicateCalloutDefinition", () => {
	it("deeply copies every stored field, including a deleted palette reference and unknown state", () => {
		const original = {
			...definition("my style", {
				icon: { type: "image", value: "img-missing", recolor: false },
					iconAdjust: { regular: { offsetX: 3 }, heading: { size: 0.75 } },
				iconOffsetY: -2,
				iconSize: 1.3,
				hideIcon: true,
				bgColorLight: "#234567",
				bgColorDark: "#765432",
				bgGradient: {
						angleDeg: 30,
					toColorLight: "#abcdef",
					toColorDark: "#fedcba",
					textGradient: true,
					textToColorLight: "#223344",
					textToColorDark: "#445566",
				},
				textColorLight: "#121212",
				textColorDark: "#efefef",
				paletteId: "cp-deleted-palette",
				metadata: { origin: "plugin", paletteStatus: "deleted" },
				customized: false,
				source: "plugin",
				aliases: ["alternate style", "another style"],
			}),
			futureState: { colors: ["#123456", "#654321"], enabled: false },
			explicitlyUnset: undefined,
		};
		const before = structuredClone(original);
		const copy = createDuplicateCalloutDefinition(original, [original]) as typeof original;
		assert.deepEqual(copy, {
			...original,
			id: "my style copy",
			displayName: "My style copy",
			aliases: ["alternate style copy", "another style copy"],
		});
		assert.equal(copy.paletteId, "cp-deleted-palette");
		assert.ok(Object.hasOwn(copy, "explicitlyUnset"));
		copy.icon.value = "changed";
		copy.iconAdjust!.heading!.size = 1;
			copy.bgGradient!.angleDeg = 90;
		copy.metadata!.origin = "changed";
		copy.futureState.colors.push("#000000");
			copy.aliases.push("changed");
		assert.deepEqual(original, before);
	});

	it("retains absent fields, explicit empty aliases, transparency and fallback status", () => {
		const source = definition("quiet", {
			source: "fallback",
			transparentBg: true,
			aliases: [],
		});
		const copy = createDuplicateCalloutDefinition(source, []);
		assert.deepEqual(copy, { ...source, id: "quiet copy", displayName: "My style copy" });
		assert.notEqual(copy.aliases, source.aliases);
		assert.equal(Object.hasOwn(copy, "paletteId"), false);
		assert.equal(Object.hasOwn(copy, "customized"), false);
		assert.equal(Object.hasOwn(createDuplicateCalloutDefinition(definition(), []), "aliases"), false);
	});

	it("uses the first suffix free across names, primary IDs and aliases", () => {
		const source = definition();
		const occupied = [
			source,
			definition("MY-STYLE-COPY", { displayName: "unrelated" }),
			definition("second", { aliases: ["MY  STYLE   COPY 2"], displayName: "other" }),
			definition("third", { displayName: "MY-STYLE-COPY-3" }),
		];
		const copy = createDuplicateCalloutDefinition(source, occupied);
		assert.equal(copy.id, "my style copy 4");
		assert.equal(copy.displayName, "My style copy 4");
	});

	it("reserves original identities even if the provided list omits the source", () => {
		const source = definition("my style", { aliases: ["my style copy"] });
		const copy = createDuplicateCalloutDefinition(source, []);
		assert.equal(copy.id, "my style copy 2");
		assert.deepEqual(copy.aliases, ["my style copy copy 2"]);
	});

	it("keeps alias count and order while resolving each alias collision independently", () => {
		const source = definition("main", { aliases: ["short", "other"] });
		const copy = createDuplicateCalloutDefinition(source, [
			source,
			definition("SHORT-COPY", { aliases: ["short copy 2"] }),
		]);
		assert.equal(copy.id, "main copy");
		assert.deepEqual(copy.aliases, ["short copy 3", "other copy"]);
	});

	it("truncates long names, IDs and aliases while preserving the suffix and uniqueness", () => {
		const shared = "a".repeat(MAX_TAG_LENGTH);
		const source = definition(shared, {
			displayName: "N".repeat(MAX_DISPLAY_NAME),
			aliases: [shared + " first", shared + " second"],
		});
		const first = createDuplicateCalloutDefinition(source, [source]);
		const second = createDuplicateCalloutDefinition(source, [source, first]);
		assert.equal(first.id, "a".repeat(195) + " copy");
		assert.equal(first.displayName, "N".repeat(75) + " copy");
		assert.equal(second.id, "a".repeat(193) + " copy 4");
		assert.deepEqual(first.aliases, [
			"a".repeat(193) + " copy 2",
			"a".repeat(193) + " copy 3",
		]);
		for (const copy of [first, second]) {
			const identifiers = [copy.id, ...copy.aliases!];
			assert.equal(new Set(identifiers.map(calloutIdentity)).size, identifiers.length);
			assert.ok(identifiers.every((id) => id.length <= MAX_TAG_LENGTH));
			assert.ok(copy.displayName.length <= MAX_DISPLAY_NAME);
		}
	});

	it("keeps supplementary Unicode characters whole at UTF-16 length boundaries", () => {
		const source = definition("𐐨".repeat(100), { displayName: "𐐀".repeat(40) });
		const first = createDuplicateCalloutDefinition(source, [source]);
		assert.equal(first.id, "𐐨".repeat(97) + " copy");
		assert.equal(first.displayName, "𐐀".repeat(37) + " copy");
		assert.equal(first.id, sanitizeCalloutIdInput(first.id));
		assert.ok(first.id.length <= MAX_TAG_LENGTH);
		assert.ok(first.displayName.length <= MAX_DISPLAY_NAME);
	});

	it("follows creation's sanitizer while preserving punctuation in display names", () => {
		const source = definition("Q|A-שלום!", { displayName: "Q|A 🎉 שלום" });
		const first = createDuplicateCalloutDefinition(source, [source]);
		const second = createDuplicateCalloutDefinition(source, [source, first]);
		assert.equal(first.id, "qa שלום copy");
		assert.equal(first.displayName, "Q|A 🎉 שלום copy");
		assert.equal(second.displayName, "Q|A 🎉 שלום copy 2");
	});

	it("treats a copy's current name as the base for another copy", () => {
		const original = definition();
		const first = createDuplicateCalloutDefinition(original, [original]);
		const second = createDuplicateCalloutDefinition(first, [original, first]);
		assert.equal(second.id, "my style copy copy");
		assert.equal(second.displayName, "My style copy copy");
	});

	it("rejects missing sources, noncustom rows and names with no usable identity", () => {
		const invalid = [
			undefined,
			null,
			definition("built in", { builtIn: true }),
			definition("built in", { source: "builtin" }),
			definition("theme only", { source: "theme" }),
			definition("!!!"),
			definition("valid", { displayName: "   " }),
			definition("valid", { aliases: ["🎉"] }),
			{ ...definition(), aliases: "wrong" },
		];
		for (const source of invalid) {
			assert.throws(() => createDuplicateCalloutDefinition(source as CalloutDefinition, []));
		}
	});

	it("propagates a cloning failure without touching the source or existing definitions", () => {
		const original = { ...definition(), cannotClone: () => "unexpected state" };
		const existing = [original];
		assert.throws(() => createDuplicateCalloutDefinition(original, existing));
		assert.equal(original.id, "my style");
		assert.equal(existing.length, 1);
		assert.equal(existing[0], original);
	});
});
