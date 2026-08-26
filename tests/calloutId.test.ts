/**
 * tests/calloutId.test.ts — the one funnel every raw-markdown path goes through.
 *
 * These six helpers are small enough to look obviously correct and are wired
 * into so many call sites that a change to any of them is a change to the whole
 * plugin. Three invariants are what the tests are really guarding:
 *
 * - **A piped id is structurally unreachable.** `normalizeCalloutId` drops the
 *   metadata, so `note|purple` resolves to the `note` callout and never mints a
 *   row of its own. Nothing else in the codebase re-implements the split.
 * - **The pipe is a separator only in a token body.** `sanitizeCalloutIdInput`
 *   deliberately does NOT split — its input is a display name, where a pipe is
 *   a character the user typed. `Q|A` has to become `qa`, never `q`.
 * - **Dash and space are one spelling to Obsidian.** It dasherizes both into the
 *   same `data-callout`, so `mergeDashSpaceVariants` has to fold them, and
 *   `sanitizeCalloutIdInput` has to refuse to create the pair in the first place.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import {
	calloutIdentity,
	mergeDashSpaceVariants,
	normalizeCalloutId,
	obsidianCalloutAttrId,
	obsidianDefaultTitle,
	sanitizeCalloutIdInput,
	splitCalloutMetadata,
} from "../src/utils/calloutId";

describe("splitCalloutMetadata", () => {
	it("splits at the first pipe", () => {
		assert.deepStrictEqual(splitCalloutMetadata("note|purple"), {
			id: "note",
			metadata: "purple",
			hasMetadata: true,
		});
	});

	it("reports no metadata when there is no pipe", () => {
		assert.deepStrictEqual(splitCalloutMetadata("note"), {
			id: "note",
			metadata: "",
			hasMetadata: false,
		});
	});

	it("keeps `[!x|]` distinguishable from `[!x]`", () => {
		// Both have an empty metadata string; only `hasMetadata` tells them apart,
		// which is why the flag exists at all rather than testing `metadata !== ""`.
		const piped = splitCalloutMetadata("note|");
		const bare = splitCalloutMetadata("note");
		assert.equal(piped.metadata, "");
		assert.equal(bare.metadata, "");
		assert.equal(piped.hasMetadata, true);
		assert.equal(bare.hasMetadata, false);
	});

	it("gives a second pipe to the metadata, not to a third field", () => {
		assert.deepStrictEqual(splitCalloutMetadata("note||purple"), {
			id: "note",
			metadata: "|purple",
			hasMetadata: true,
		});
		assert.deepStrictEqual(splitCalloutMetadata("note|a|b"), {
			id: "note",
			metadata: "a|b",
			hasMetadata: true,
		});
	});

	it("returns the metadata verbatim — Obsidian neither trims nor lowercases it", () => {
		const parts = splitCalloutMetadata("note|  Purple Left  ");
		assert.equal(parts.metadata, "  Purple Left  ");
	});

	it("leaves the type verbatim too — normalization is normalizeCalloutId's job", () => {
		const parts = splitCalloutMetadata("  My Note  |x");
		assert.equal(parts.id, "  My Note  ");
	});

	it("handles a leading pipe as an empty type", () => {
		assert.deepStrictEqual(splitCalloutMetadata("|purple"), {
			id: "",
			metadata: "purple",
			hasMetadata: true,
		});
	});

	it("handles the empty string", () => {
		assert.deepStrictEqual(splitCalloutMetadata(""), {
			id: "",
			metadata: "",
			hasMetadata: false,
		});
	});
});

describe("normalizeCalloutId", () => {
	it("lowercases and trims", () => {
		assert.equal(normalizeCalloutId("  MyNote  "), "mynote");
	});

	it("collapses any whitespace run to a single space", () => {
		assert.equal(normalizeCalloutId("My   Multi\tWord\nNote"), "my multi word note");
	});

	it("drops the metadata, so a piped id can never reach the registry", () => {
		// The whole point: these three all resolve to the ONE `note` callout.
		assert.equal(normalizeCalloutId("note|purple"), "note");
		assert.equal(normalizeCalloutId("NOTE|Purple"), "note");
		assert.equal(normalizeCalloutId("note|"), "note");
	});

	it("trims and collapses AFTER the split, not before", () => {
		assert.equal(normalizeCalloutId("  My  Note  |  purple  "), "my note");
	});

	it("preserves every other character, so unusual stored ids still resolve", () => {
		assert.equal(normalizeCalloutId("My-Note"), "my-note");
		assert.equal(normalizeCalloutId("café_2"), "café_2");
		assert.equal(normalizeCalloutId("שָׁלוֹם"), "שָׁלוֹם");
	});

	it("returns an empty string for input with nothing in it", () => {
		assert.equal(normalizeCalloutId(""), "");
		assert.equal(normalizeCalloutId("   "), "");
		assert.equal(normalizeCalloutId("|purple"), "");
	});

	it("is idempotent", () => {
		for (const raw of ["  My  Note ", "note|purple", "A-B", ""]) {
			const once = normalizeCalloutId(raw);
			assert.equal(normalizeCalloutId(once), once, raw);
		}
	});
});

describe("sanitizeCalloutIdInput", () => {
	it("lowercases and drops disallowed characters", () => {
		assert.equal(sanitizeCalloutIdInput("My Note!"), "my note");
		assert.equal(sanitizeCalloutIdInput("Tip #1 (best)"), "tip 1 best");
	});

	it("does NOT split on a pipe — its input is a display name", () => {
		// Splitting would silently throw away the second half of a name the user
		// typed. The pipe falls out as a disallowed character instead.
		assert.equal(sanitizeCalloutIdInput("Q|A"), "qa");
		assert.equal(sanitizeCalloutIdInput("note|purple"), "notepurple");
	});

	it("folds dash runs into the same single space as whitespace", () => {
		// Obsidian's own title generation runs `type.replace(/-/g, " ")`, so a
		// literal hyphen could never survive rendering as a distinct character.
		assert.equal(sanitizeCalloutIdInput("my-note"), "my note");
		assert.equal(sanitizeCalloutIdInput("my---note"), "my note");
		assert.equal(sanitizeCalloutIdInput("my - note"), "my note");
		assert.equal(sanitizeCalloutIdInput("my \t\n note"), "my note");
	});

	it("trims leading and trailing separators", () => {
		assert.equal(sanitizeCalloutIdInput("  -a-  "), "a");
		assert.equal(sanitizeCalloutIdInput("---"), "");
	});

	it("keeps letters and numbers from any script", () => {
		assert.equal(sanitizeCalloutIdInput("שלום עולם"), "שלום עולם");
		assert.equal(sanitizeCalloutIdInput("Привет Мир"), "привет мир");
		assert.equal(sanitizeCalloutIdInput("注意 2"), "注意 2");
		assert.equal(sanitizeCalloutIdInput("Ärger"), "ärger");
	});

	it("drops emoji and punctuation entirely", () => {
		assert.equal(sanitizeCalloutIdInput("note 🎉"), "note");
		assert.equal(sanitizeCalloutIdInput("a.b,c;d"), "abcd");
	});

	it("may return an empty string — callers reject that themselves", () => {
		assert.equal(sanitizeCalloutIdInput("!!!"), "");
		assert.equal(sanitizeCalloutIdInput("🎉"), "");
		assert.equal(sanitizeCalloutIdInput(""), "");
	});

	it("is idempotent", () => {
		for (const raw of ["My-Note", "Q|A", "  a - b  ", "!!!"]) {
			const once = sanitizeCalloutIdInput(raw);
			assert.equal(sanitizeCalloutIdInput(once), once, raw);
		}
	});

	it("never produces a dash, so it cannot create a dash/space collision", () => {
		for (const raw of ["a-b", "a b", "a--b", "-a-b-"]) {
			assert.ok(!sanitizeCalloutIdInput(raw).includes("-"), raw);
		}
	});
});

describe("obsidianCalloutAttrId", () => {
	it("dasherizes whitespace, exactly as Obsidian's own parser does", () => {
		assert.equal(obsidianCalloutAttrId("My Multi Word"), "my-multi-word");
		assert.equal(obsidianCalloutAttrId("a \t b"), "a-b");
	});

	it("is the identity for an id without whitespace", () => {
		assert.equal(obsidianCalloutAttrId("my-note"), "my-note");
		assert.equal(obsidianCalloutAttrId("note"), "note");
	});

	it("collapses the dash and space spellings onto one attribute", () => {
		assert.equal(obsidianCalloutAttrId("a b"), obsidianCalloutAttrId("a-b"));
	});

	it("is idempotent", () => {
		for (const raw of ["My Multi Word", "my-note", "  a  b  ", ""]) {
			const once = obsidianCalloutAttrId(raw);
			assert.equal(obsidianCalloutAttrId(once), once, raw);
		}
	});

	it("does NOT strip metadata, unlike normalizeCalloutId", () => {
		// Stripping here would let a stray piped id collapse onto a real
		// callout's selector and hijack its CSS rule.
		assert.equal(obsidianCalloutAttrId("note|purple"), "note|purple");
	});
});

describe("calloutIdentity", () => {
	it("is Obsidian's own rule: trim, lowercase, whitespace runs to one dash", () => {
		// Its blockquote tokenizer runs exactly this on the bracket body, and
		// the result is what lands in `data-callout`.
		assert.equal(calloutIdentity("  Banner   Icon  "), "banner-icon");
		assert.equal(calloutIdentity("My\tMulti\nWord"), "my-multi-word");
	});

	it("makes every spelling of one callout the same string", () => {
		const forms = [
			"banner icon",
			"banner   icon",
			"Banner Icon",
			"BANNER-ICON",
			"  banner-icon  ",
			"banner\ticon",
		];
		for (const form of forms) {
			assert.equal(calloutIdentity(form), "banner-icon", form);
		}
	});

	it("leaves an id with no whitespace and no pipe exactly as it is", () => {
		assert.equal(calloutIdentity("note"), "note");
		assert.equal(calloutIdentity("banner-icon"), "banner-icon");
		assert.equal(calloutIdentity("café_2"), "café_2");
		assert.equal(calloutIdentity("שָׁלוֹם"), "שָׁלוֹם");
	});

	it("drops `|metadata`, unlike obsidianCalloutAttrId", () => {
		// The difference is deliberate. Identity has to fold a stray stored pipe
		// onto its base; a CSS selector must not, or it hijacks a real callout's
		// rule. See both functions' docs.
		assert.equal(calloutIdentity("note|purple"), "note");
		assert.equal(obsidianCalloutAttrId("note|purple"), "note|purple");
	});

	it("is empty only when there is nothing to name", () => {
		assert.equal(calloutIdentity(""), "");
		assert.equal(calloutIdentity("   "), "");
		assert.equal(calloutIdentity("|purple"), "");
	});

	it("is idempotent", () => {
		for (const raw of ["  A  B ", "a-b", "note|x", "a   b", ""]) {
			const once = calloutIdentity(raw);
			assert.equal(calloutIdentity(once), once, raw);
		}
	});

	it("agrees with obsidianCalloutAttrId on everything the editor can produce", () => {
		// `sanitizeCalloutIdInput` never emits a pipe and never emits a
		// whitespace run, so the two are the same function over stored ids —
		// which is why swapping the comparison to identity changed no behaviour
		// for an ordinary vault.
		for (const raw of ["my note", "note", "tip 1 best", "שלום עולם"]) {
			const stored = sanitizeCalloutIdInput(raw);
			assert.equal(
				calloutIdentity(stored),
				obsidianCalloutAttrId(stored),
				stored,
			);
		}
	});
});

describe("obsidianDefaultTitle", () => {
	it("turns dashes into spaces and capitalizes the first letter", () => {
		assert.equal(obsidianDefaultTitle("my-note"), "My note");
		assert.equal(obsidianDefaultTitle("my-multi-word"), "My multi word");
	});

	it("lowercases the rest — only the first letter is capital", () => {
		assert.equal(obsidianDefaultTitle("MY NOTE"), "My note");
		assert.equal(obsidianDefaultTitle("McDonald"), "Mcdonald");
	});

	it("trims first, so the capital lands on a real letter", () => {
		assert.equal(obsidianDefaultTitle("  note  "), "Note");
	});

	it("gives the same title to both spellings of one id", () => {
		assert.equal(obsidianDefaultTitle("a b"), obsidianDefaultTitle("a-b"));
	});

	it("survives an empty or non-letter first character", () => {
		assert.equal(obsidianDefaultTitle(""), "");
		assert.equal(obsidianDefaultTitle("   "), "");
		assert.equal(obsidianDefaultTitle("2fa"), "2fa");
	});
});

describe("mergeDashSpaceVariants", () => {
	it("folds two spellings of one callout into a single row", () => {
		assert.deepStrictEqual(mergeDashSpaceVariants(["a b", "a-b"]), ["a b"]);
	});

	it("prefers the spaced spelling whichever order it was seen in", () => {
		// The spaced form is what the ID field and display-name derivation produce.
		assert.deepStrictEqual(mergeDashSpaceVariants(["a-b", "a b"]), ["a b"]);
		assert.deepStrictEqual(mergeDashSpaceVariants(["a b", "a-b"]), ["a b"]);
	});

	it("keeps a dash-only spelling verbatim — it is not a typo to repair", () => {
		assert.deepStrictEqual(mergeDashSpaceVariants(["a-b"]), ["a-b"]);
		assert.deepStrictEqual(mergeDashSpaceVariants(["a-b", "a-b"]), ["a-b"]);
	});

	it("keeps the original array order, even when a later spelling wins", () => {
		// Re-setting a Map key does not move it, which is what makes preferring
		// the spaced spelling free of reordering.
		assert.deepStrictEqual(
			mergeDashSpaceVariants(["zebra", "a-b", "yak", "a b"]),
			["zebra", "a b", "yak"],
		);
	});

	it("leaves unrelated ids alone", () => {
		assert.deepStrictEqual(mergeDashSpaceVariants(["one", "two", "three"]), [
			"one",
			"two",
			"three",
		]);
	});

	it("drops ids that dasherize to nothing", () => {
		assert.deepStrictEqual(mergeDashSpaceVariants(["", "   ", "x"]), ["x"]);
	});

	it("folds case as well, since the attribute form is lowercased", () => {
		assert.deepStrictEqual(mergeDashSpaceVariants(["A B", "a-b"]), ["A B"]);
	});

	it("handles the empty list", () => {
		assert.deepStrictEqual(mergeDashSpaceVariants([]), []);
	});

	it("is idempotent", () => {
		const once = mergeDashSpaceVariants(["a-b", "a b", "c", "C"]);
		assert.deepStrictEqual(mergeDashSpaceVariants(once), once);
	});
});
