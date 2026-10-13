/**
 * tests/calloutWriter.test.ts — the token text each render role is written as.
 *
 * These builders are the one place a callout definition becomes markdown, so
 * both the autocomplete popover and the user-built commands inherit whatever
 * they get wrong. The fold mark, the title policy and the `|metadata` carry-over
 * are the three rules worth pinning down.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import {
	buildBlockHeaderToken,
	buildHeadingToken,
	buildInlineContentToken,
	buildInlineToken,
	foldMarkFor,
	isGeneratedTitle,
	metadataSuffixOf,
} from "../src/editor/calloutWriter";
import type { CalloutDefinition } from "../src/types";

const def = (over: Partial<CalloutDefinition> = {}): CalloutDefinition => ({
	id: "warning",
	displayName: "Warning",
	icon: { type: "lucide", value: "alert-triangle" },
	colorLight: "#ff0000",
	colorDark: "#ff0000",
	foldable: false,
	defaultFolded: false,
	builtIn: true,
	source: "builtin",
	...over,
});

describe("foldMarkFor", () => {
	it("writes nothing unless the callout folds", () => {
		assert.strictEqual(foldMarkFor(def()), "");
		assert.strictEqual(
			foldMarkFor(def({ foldable: false, defaultFolded: true })),
			"",
		);
	});

	it("writes + when open and - when folded by default", () => {
		assert.strictEqual(foldMarkFor(def({ foldable: true })), "+");
		assert.strictEqual(
			foldMarkFor(def({ foldable: true, defaultFolded: true })),
			"-",
		);
	});
});

describe("buildBlockHeaderToken", () => {
	it("titles a fresh header with the display name", () => {
		assert.strictEqual(buildBlockHeaderToken(def()), "[!warning] Warning");
	});

	it("carries the fold mark", () => {
		assert.strictEqual(
			buildBlockHeaderToken(def({ foldable: true, defaultFolded: true })),
			"[!warning]- Warning",
		);
	});

	it("lets a caller's fold mark beat the definition's default", () => {
		// A user-built command carries its own fold state, so it must be able
		// to add a mark to a callout that has none...
		assert.strictEqual(
			buildBlockHeaderToken(def(), { foldMark: "+" }),
			"[!warning]+ Warning",
		);
		// ...and, the case that actually matters, take one away. `""` is a real
		// answer here, not an absent one, which is why the builder reads the
		// option with `??` and must never be changed to `||`.
		assert.strictEqual(
			buildBlockHeaderToken(def({ foldable: true, defaultFolded: true }), {
				foldMark: "",
			}),
			"[!warning] Warning",
		);
	});

	it("still follows the definition when no caller says otherwise", () => {
		assert.strictEqual(
			buildBlockHeaderToken(def({ foldable: true }), {
				foldMark: undefined,
			}),
			"[!warning]+ Warning",
		);
	});

	it("keeps a title the user actually wrote", () => {
		assert.strictEqual(
			buildBlockHeaderToken(def(), { existingTitle: "  Read this  " }),
			"[!warning] Read this",
		);
	});

	it("replaces a title that is only another callout's display name", () => {
		// Switching type must not leave the old type's name behind.
		assert.strictEqual(
			buildBlockHeaderToken(def(), {
				existingTitle: "Note",
				isKnownDisplayName: (title) => title === "Note",
			}),
			"[!warning] Warning",
		);
	});

	it("writes the alias the user typed, titled as Obsidian titles it", () => {
		assert.strictEqual(
			buildBlockHeaderToken(def({ aliases: ["warn"] }), { matchedId: "warn" }),
			"[!warn] Warn",
		);
	});

	it("gives a replaced generated title the alias's label too", () => {
		// The "only another callout's name" branch must land on the same label
		// as an empty title does, or switching type by alias would write the
		// NAME after all.
		assert.strictEqual(
			buildBlockHeaderToken(def({ aliases: ["warn"] }), {
				matchedId: "warn",
				existingTitle: "Note",
				isKnownDisplayName: (title) => title === "Note",
			}),
			"[!warn] Warn",
		);
	});

	it("titles the id itself, in any spelling, with the NAME", () => {
		// A NAME that differs from Obsidian's default title ("Library voice") is
		// exactly what the written title is for; only aliases changed.
		const voice = def({ id: "library-voice", displayName: "Library Voice" });
		assert.strictEqual(buildBlockHeaderToken(voice), "[!library-voice] Library Voice");
		assert.strictEqual(
			buildBlockHeaderToken(voice, { matchedId: "library voice" }),
			"[!library voice] Library Voice",
		);
	});

	it("keeps metadata attached to the type", () => {
		assert.strictEqual(
			buildBlockHeaderToken(def(), { metaSuffix: "|purple" }),
			"[!warning|purple] Warning",
		);
	});
});

describe("buildHeadingToken", () => {
	it("invents no title — the rendered widget shows the name", () => {
		assert.strictEqual(buildHeadingToken(def()), "[!warning]");
	});

	it("never writes a fold mark, which this role has no syntax for", () => {
		assert.strictEqual(
			buildHeadingToken(def({ foldable: true, defaultFolded: true })),
			"[!warning]",
		);
		// Not even when a caller asks for one: `### [!warning]- Title` is this
		// callout titled "- Title", so the mark would be a character the user
		// never typed appearing in their heading.
		assert.strictEqual(
			buildHeadingToken(def(), { foldMark: "-" }),
			"[!warning]",
		);
		assert.strictEqual(
			buildInlineToken(def(), { foldMark: "-" }),
			"[!warning]",
		);
	});

	it("keeps the line's own text as the title", () => {
		assert.strictEqual(
			buildHeadingToken(def(), { existingTitle: "  Chapter one " }),
			"[!warning] Chapter one",
		);
	});

	it("drops a title that is only another callout's display name", () => {
		assert.strictEqual(
			buildHeadingToken(def(), {
				existingTitle: "Note",
				isKnownDisplayName: (title) => title === "Note",
			}),
			"[!warning]",
		);
	});
});

describe("inline tokens", () => {
	it("writes a bare pill", () => {
		assert.strictEqual(buildInlineToken(def()), "[!warning]");
		assert.strictEqual(
			buildInlineToken(def(), { metaSuffix: "|purple" }),
			"[!warning|purple]",
		);
	});

	it("wraps content in braces", () => {
		assert.strictEqual(
			buildInlineContentToken(def(), "read this"),
			"[!warning]{read this}",
		);
	});
});

describe("metadataSuffixOf", () => {
	it("returns the piped metadata, with its bar", () => {
		assert.strictEqual(metadataSuffixOf("> [!note|purple] Hi", 2), "|purple");
	});

	it("returns nothing when there is no metadata", () => {
		assert.strictEqual(metadataSuffixOf("> [!note] Hi", 2), "");
	});

	it("returns nothing for an unterminated token", () => {
		assert.strictEqual(metadataSuffixOf("> [!note", 2), "");
	});
});

describe("isGeneratedTitle", () => {
	const defs = [
		def({ aliases: ["caution", "attention"] }),
		def({ id: "library-voice", displayName: "Library Voice" }),
	];

	it("recognises any definition's NAME, whatever its case", () => {
		assert.strictEqual(isGeneratedTitle(defs, "Warning"), true);
		assert.strictEqual(isGeneratedTitle(defs, "library VOICE"), true);
	});

	it("recognises the title an alias is written with", () => {
		// What a pick of `[!attention]` writes, so a later type switch replaces
		// it rather than keeping it as if the user had chosen the word.
		assert.strictEqual(isGeneratedTitle(defs, "Attention"), true);
		assert.strictEqual(isGeneratedTitle(defs, "caution"), true);
	});

	it("recognises Obsidian's default title for an id", () => {
		assert.strictEqual(isGeneratedTitle(defs, "Library voice"), true);
	});

	it("leaves the user's own words alone", () => {
		assert.strictEqual(isGeneratedTitle(defs, "Mind the gap"), false);
		assert.strictEqual(isGeneratedTitle(defs, "Attention please"), false);
	});
});
