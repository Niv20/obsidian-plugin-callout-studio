/**
 * tests/calloutHeaderMetadata.test.ts — 166: the `|` in a callout header, and the
 * offsets that have to survive it.
 *
 * Obsidian splits a callout header at the **first `|`**: everything before it is
 * the type, everything after is `data-callout-metadata`. So `> [!note|purple]`
 * is the `note` callout carrying the metadata `purple` — not a callout named
 * `note|purple`, which is a thing that cannot exist. `splitCalloutMetadata` /
 * `normalizeCalloutId` are the one funnel every raw-markdown path goes through,
 * which is what makes a piped id structurally unreachable by the registry.
 *
 * `calloutId.test.ts` owns the funnel itself. What this file is about is the
 * **tokenizer**, and one consequence that is easy to get wrong in a way nothing
 * catches:
 *
 * **`from`/`to` span the whole `[!…]`, metadata included — so nothing may derive
 * a length from `rawId` alone.** `rawId` is the type with the metadata already
 * removed, and `to - from` is `2 + body.length + 1` where `body` is everything
 * between the brackets. The two differ by exactly the length of `|metadata`.
 * Code that reconstructs the bracket from `rawId` is off by that much and eats
 * the characters after it — and it looks perfectly correct on every unpiped
 * token, which is nearly all of them.
 *
 * The positive form of the same rule is the property pinned at the bottom: a
 * token carries enough to put the bracket back byte for byte. `rawId`,
 * `metadata` and `hasMetadata` reconstruct `line.slice(from, to)` for every
 * role, which is precisely what every rewriter needs in order to keep the
 * metadata across an edit.
 *
 * The block header is where this had never been asserted — the inline role was
 * covered and the other two were not, even though the block header is the form
 * users actually write metadata in.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { scanLineForCalloutTokens, tokenEnd, type LineCalloutToken } from "../src/editor/calloutTokens";
import { metadataSuffixOf } from "../src/editor/calloutWriter";
import { normalizeCalloutId } from "../src/utils/calloutId";
import { resolveCalloutDef } from "../src/editor/renderShared";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";

/** The one token on a line, or a thrown assertion naming the line. */
function only(line: string): LineCalloutToken {
	const tokens = scanLineForCalloutTokens(line);
	assert.strictEqual(tokens.length, 1, `expected one token in ${line}`);
	return tokens[0] as LineCalloutToken;
}

/** The bracket the offsets actually select. */
const bracket = (line: string, token: LineCalloutToken): string => line.slice(token.from, token.to);

/* -------------------------------------------------------------------------- */
/* The block header, the form metadata is written in                          */
/* -------------------------------------------------------------------------- */

describe("`> [!note|purple]` is the note callout", () => {
	const LINE = "> [!note|purple] Title";

	it("reports the type alone as the id", () => {
		const token = only(LINE);
		assert.strictEqual(token.role, "regular");
		assert.strictEqual(token.rawId, "note");
	});

	it("reports the metadata beside it, not inside it", () => {
		const token = only(LINE);
		assert.strictEqual(token.metadata, "purple");
		assert.strictEqual(token.hasMetadata, true);
	});

	it("spans the whole bracket, the metadata included", () => {
		// The offsets are what the Live Preview decorations and every vault
		// rewriter are built from. A `to` that stopped at the pipe would leave
		// `|purple]` behind on the line after a type swap.
		const token = only(LINE);
		assert.strictEqual(bracket(LINE, token), "[!note|purple]");
		assert.strictEqual(LINE[token.to - 1], "]");
	});

	it("spans more than the id — the length nothing may assume", () => {
		const token = only(LINE);
		assert.strictEqual(token.to - token.from, "[!note|purple]".length);
		assert.notStrictEqual(token.to - token.from, token.rawId.length + 3);
	});

	it("puts `from` after the quote prefix, at any depth", () => {
		for (const line of [
			"> [!note|purple] Title",
			">> [!note|purple] Title",
			"> > [!note|purple] Title",
			">>> [!note|purple]",
		]) {
			const token = only(line);
			assert.strictEqual(bracket(line, token), "[!note|purple]");
		}
	});

	it("ends where a fold mark would start, so the two never overlap", () => {
		const line = "> [!note|purple]- Title";
		const token = only(line);
		assert.strictEqual(bracket(line, token), "[!note|purple]");
		assert.strictEqual(line[token.to], "-");
	});
});

/* -------------------------------------------------------------------------- */
/* The heading role                                                            */
/* -------------------------------------------------------------------------- */

describe("`### [!note|purple]` is the same callout in the heading role", () => {
	const LINE = "### [!note|purple] Chapter";

	it("splits the same way", () => {
		const token = only(LINE);
		assert.strictEqual(token.role, "heading");
		assert.strictEqual(token.rawId, "note");
		assert.strictEqual(token.metadata, "purple");
		assert.strictEqual(token.headingLevel, 3);
	});

	it("spans the whole bracket and stops there", () => {
		const token = only(LINE);
		assert.strictEqual(bracket(LINE, token), "[!note|purple]");
		assert.strictEqual(token.hasTitle, true);
	});

	it("leaves the title untouched, whatever it starts with", () => {
		// The heading grammar consumes one separator and nothing else — see
		// headingFoldSyntax.test.ts. A piped id must not change that.
		const line = "### [!note|purple]- Chapter";
		const token = only(line);
		assert.strictEqual(bracket(line, token), "[!note|purple]");
		assert.strictEqual(line.slice(token.to), "- Chapter");
	});

	it("still finds the pills in a piped heading's title", () => {
		const tokens = scanLineForCalloutTokens("## [!info|left] see [!tip|red] here");
		assert.deepStrictEqual(
			tokens.map((t) => [t.role, t.rawId, t.metadata]),
			[
				["heading", "info", "left"],
				["inline", "tip", "red"],
			],
		);
	});
});

/* -------------------------------------------------------------------------- */
/* The pipe as a separator, exactly as Obsidian reads it                       */
/* -------------------------------------------------------------------------- */

describe("where the split falls", () => {
	it("is the FIRST pipe; the rest belongs to the metadata", () => {
		const token = only("> [!note|a|b] Title");
		assert.strictEqual(token.rawId, "note");
		assert.strictEqual(token.metadata, "a|b");
	});

	it("keeps the metadata verbatim — Obsidian neither trims nor lowercases it", () => {
		const token = only("> [!note|  Purple Left  ] Title");
		assert.strictEqual(token.rawId, "note");
		assert.strictEqual(token.metadata, "  Purple Left  ");
	});

	it("tells `[!note|]` from `[!note]`, which only the flag can", () => {
		// Both carry an empty metadata string. The flag is what lets a rewriter
		// put the bare pipe back rather than silently dropping a character the
		// user wrote.
		assert.strictEqual(only("> [!note|] Title").hasMetadata, true);
		assert.strictEqual(only("> [!note|] Title").metadata, "");
		assert.strictEqual(only("> [!note] Title").hasMetadata, false);
	});

	it("names no callout at all when the type half is empty", () => {
		// Obsidian renders `[!|purple]` with an empty `data-callout`; there is
		// nothing here to resolve, so no token is reported in any role.
		assert.deepStrictEqual(scanLineForCalloutTokens("> [!|purple] Title"), []);
		assert.deepStrictEqual(scanLineForCalloutTokens("### [!|purple] Title"), []);
		assert.deepStrictEqual(scanLineForCalloutTokens("a [!|purple] b"), []);
	});

	it("is not a separator in a title", () => {
		// Only the bracket body is split. A pipe in the title — a table row
		// pasted into a callout, most often — is ordinary text.
		const line = "> [!note] a | b | c";
		const token = only(line);
		assert.strictEqual(token.rawId, "note");
		assert.strictEqual(token.hasMetadata, false);
		assert.strictEqual(bracket(line, token), "[!note]");
	});
});

/* -------------------------------------------------------------------------- */
/* Resolution: a piped id cannot reach the registry                            */
/* -------------------------------------------------------------------------- */

describe("a piped id resolves to the real callout and mints nothing", () => {
	const loaded = (): CalloutRegistry => {
		const registry = new CalloutRegistry();
		registry.load(null);
		return registry;
	};

	it("is not a key in the map", () => {
		// `get` is a raw lookup, so this is the structural claim: there is no
		// row under the piped spelling and nothing can create one.
		assert.strictEqual(loaded().get("note|purple"), undefined);
	});

	it("normalizes down to the type before anything looks it up", () => {
		assert.strictEqual(normalizeCalloutId("note|purple"), "note");
	});

	it("renders as the note callout, not as an unknown one", () => {
		const registry = loaded();
		const resolved = resolveCalloutDef(registry, "note|purple");

		assert.strictEqual(resolved.unknown, false);
		assert.strictEqual(resolved.def?.id, "note");
	});

	it("resolves identically whether the split already happened or not", () => {
		// The tokenizer hands `rawId` over already split, and `resolveCalloutDef`
		// splits again. Both orders have to land in the same place, or a surface
		// that resolves from raw text would disagree with one that resolves from
		// a token.
		const registry = loaded();
		const fromToken = resolveCalloutDef(registry, only("> [!note|purple]").rawId);
		const fromRaw = resolveCalloutDef(registry, "note|purple");

		assert.strictEqual(fromToken.def?.id, fromRaw.def?.id);
	});

	it("still resolves an unknown type to the fallback, metadata or not", () => {
		const registry = loaded();
		const resolved = resolveCalloutDef(registry, "mystery|purple");
		assert.strictEqual(resolved.unknown, true);
	});
});

/* -------------------------------------------------------------------------- */
/* The reconstruction property                                                 */
/* -------------------------------------------------------------------------- */

describe("a token carries enough to put its bracket back", () => {
	/**
	 * The rule every rewriter depends on, stated once for every role: the
	 * bracket the offsets select is exactly what `rawId` + `metadata` +
	 * `hasMetadata` spell. Anything that rebuilds from `rawId` alone drops the
	 * metadata; anything that measures from `rawId` alone eats the text after
	 * the bracket.
	 */
	const CASES = [
		"> [!note] Title",
		"> [!note|purple] Title",
		"> [!note|] Title",
		"> [!note|a|b] Title",
		"> [!note|purple]- Title",
		">> [!note|purple] Title",
		"### [!note|purple] Chapter",
		"# [!note|purple]",
		"before [!note|purple] after",
		"[!note|purple]{payload}",
		"[!note|  spaced  ] x",
	];

	for (const line of CASES) {
		it(`${line}`, () => {
			const token = only(line);
			const rebuilt = `[!${token.rawId}${token.hasMetadata ? `|${token.metadata}` : ""}]`;

			assert.strictEqual(bracket(line, token), rebuilt);
			assert.strictEqual(
				token.to - token.from,
				rebuilt.length,
				"the span and the reconstruction have to agree in length too",
			);
		});
	}

	it("holds for every token on a line at once", () => {
		const line = "## [!info|left] see [!tip|red] and [!note] here";
		for (const token of scanLineForCalloutTokens(line)) {
			assert.strictEqual(
				bracket(line, token),
				`[!${token.rawId}${token.hasMetadata ? `|${token.metadata}` : ""}]`,
			);
		}
	});

	it("leaves an inline payload outside the bracket, where it belongs", () => {
		// `tokenEnd` is the other end — the bracket plus `{…}` — and the two must
		// not be confused: only `from`/`to` name the part a type swap replaces.
		const line = "[!note|purple]{payload}";
		const token = only(line);

		assert.strictEqual(bracket(line, token), "[!note|purple]");
		assert.strictEqual(line.slice(token.from, tokenEnd(token)), line);
	});

	it("agrees with what the writer carries over", () => {
		// `metadataSuffixOf` is the writer's half of the same claim: it reads
		// the suffix straight off the line and hands it back with its bar, so
		// the rebuilt token spells the bracket the same way.
		for (const [line, suffix] of [
			["> [!note|purple] Title", "|purple"],
			["> [!note|] Title", "|"],
			["> [!note] Title", ""],
			["> [!note|a|b] Title", "|a|b"],
		] as const) {
			assert.strictEqual(metadataSuffixOf(line, 2), suffix, line);
		}
	});
});
