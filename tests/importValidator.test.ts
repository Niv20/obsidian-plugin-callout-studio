/**
 * tests/importValidator.test.ts — the id and display-name bars an import clears.
 *
 * `validateIdString` is shared with the Admonition importer rather than restated
 * there, so a change here changes both doors into the registry at once. The one
 * rule worth stating loudly is the pipe: `note|purple` is the `note` callout
 * carrying metadata, so accepting it as an id would repaint the reader's real
 * `note` with a style they never chose, and every metadata value in the file
 * would collide on the same base id. It is rejected, never stripped.
 *
 * The display-name limit is tested through both importers on purpose, because
 * they deliberately disagree about it: the JSON importer *rejects* a too-long
 * name (the file is our own format and should not have produced one), while the
 * Admonition importer *truncates* it (another plugin's file, and the entry is
 * still worth having).
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import {
	MAX_DISPLAY_NAME,
	type ValidationIssue,
	validateIdString,
	validateImportPayload,
} from "../src/utils/importValidator";
import { MAX_TAG_LENGTH } from "../src/constants";
import { normalizeCalloutId } from "../src/utils/calloutId";
import type { CalloutRegistry } from "../src/manager/CalloutRegistry";

type PartialIssue = Omit<ValidationIssue, "index" | "entryLabel">;

/** Run validateIdString and collect what it pushed. */
function check(
	id: string,
	raw?: string,
): { ok: boolean; issues: PartialIssue[] } {
	const issues: PartialIssue[] = [];
	const ok = validateIdString(
		id,
		(issue) => issues.push(issue),
		"id",
		raw ?? id,
	);
	return { ok, issues };
}

const keys = (issues: PartialIssue[]): string[] =>
	issues.map((issue) => issue.messageKey);

describe("validateIdString — what passes", () => {
	it("accepts an ordinary id with no issues at all", () => {
		const { ok, issues } = check("note");
		assert.equal(ok, true);
		assert.deepStrictEqual(issues, []);
	});

	it("accepts spaces — multi-word labels are legal ids", () => {
		assert.equal(check("my multi word callout").ok, true);
	});

	it("accepts letters from any script", () => {
		assert.equal(check("שלום").ok, true);
		assert.equal(check("注意").ok, true);
		assert.equal(check("café").ok, true);
	});

	it("accepts dashes, underscores and digits", () => {
		assert.equal(check("my-note_2").ok, true);
	});

	it("accepts an id of exactly MAX_TAG_LENGTH", () => {
		assert.equal(check("a".repeat(MAX_TAG_LENGTH)).ok, true);
	});
});

describe("validateIdString — length and emptiness", () => {
	it("rejects an empty id and stops there", () => {
		const { ok, issues } = check("");
		assert.equal(ok, false);
		// Returns immediately: there is nothing else worth saying about "".
		assert.deepStrictEqual(keys(issues), ["import.err.idEmpty"]);
	});

	it("rejects one character over the limit, and says by how much", () => {
		const id = "a".repeat(MAX_TAG_LENGTH + 1);
		const { ok, issues } = check(id);
		assert.equal(ok, false);
		assert.deepStrictEqual(keys(issues), ["import.err.idTooLong"]);
		assert.deepStrictEqual(issues[0]?.params, {
			value: id,
			max: MAX_TAG_LENGTH,
			length: MAX_TAG_LENGTH + 1,
		});
	});

	it("tags every issue with the field it was given", () => {
		const issues: PartialIssue[] = [];
		validateIdString("", (issue) => issues.push(issue), "aliases[0]");
		assert.equal(issues[0]?.field, "aliases[0]");
	});
});

describe("validateIdString — the pipe", () => {
	it("rejects a piped id rather than accepting the half before the pipe", () => {
		// Skipping the entry is what the importer did before the pipe was
		// understood, and it is still the right answer.
		const raw = "note|purple";
		const { ok, issues } = check(normalizeCalloutId(raw), raw);
		assert.equal(ok, false);
		assert.deepStrictEqual(keys(issues), ["import.err.idMetadata"]);
		// Both halves are reported: what the file said, and what it would have
		// collided with.
		assert.deepStrictEqual(issues[0]?.params, { value: raw, id: "note" });
	});

	it("rejects a trailing pipe too", () => {
		assert.deepStrictEqual(keys(check("note", "note|").issues), [
			"import.err.idMetadata",
		]);
	});

	it("rejects a pipe wherever it sits", () => {
		for (const raw of ["|note", "no|te", "a|b|c"]) {
			assert.equal(check(normalizeCalloutId(raw) || "x", raw).ok, false, raw);
		}
	});

	it("reports the pipe INSTEAD of the bad-character message, not as well", () => {
		// They are one else-if: a piped id has a specific, actionable reason.
		const { issues } = check("note", "note|[purple]");
		assert.deepStrictEqual(keys(issues), ["import.err.idMetadata"]);
	});

	it("still reports a length problem alongside the pipe", () => {
		const id = "a".repeat(MAX_TAG_LENGTH + 1);
		const { ok, issues } = check(id, `${id}|purple`);
		assert.equal(ok, false);
		assert.deepStrictEqual(keys(issues), [
			"import.err.idTooLong",
			"import.err.idMetadata",
		]);
	});
});

describe("validateIdString — forbidden characters", () => {
	it("rejects brackets, which would break the token they live in", () => {
		for (const raw of ["[note", "note]", "[note]"]) {
			const { ok, issues } = check("x", raw);
			assert.equal(ok, false, raw);
			assert.deepStrictEqual(keys(issues), ["import.err.idBadChar"], raw);
		}
	});

	it("rejects non-space whitespace", () => {
		for (const raw of ["a\tb", "a\nb", "a\rb"]) {
			assert.equal(check("a b", raw).ok, false, JSON.stringify(raw));
		}
	});

	it("checks the RAW spelling, not the normalized one", () => {
		// normalizeCalloutId folds tabs into spaces and drops the metadata, so
		// running the character checks on the canonical form would pass anything.
		assert.equal(normalizeCalloutId("a\tb"), "a b");
		assert.equal(check("a b", "a\tb").ok, false);
		assert.equal(check("a b", "a b").ok, true);
	});

	it("defaults `raw` to the id when the caller had no separate value", () => {
		const issues: PartialIssue[] = [];
		const ok = validateIdString("a\tb", (issue) => issues.push(issue), "id");
		assert.equal(ok, false);
		assert.deepStrictEqual(keys(issues), ["import.err.idBadChar"]);
	});
});

/* ------------------------------------------------------------------ *
 * MAX_DISPLAY_NAME, through the whole payload validator
 * ------------------------------------------------------------------ */

/** The registry members validateImportPayload actually reaches for. */
function fakeRegistry(): CalloutRegistry {
	return {
		getUserImages: () => [],
		findByAlias: () => undefined,
		findByIdentity: () => undefined,
		get: () => undefined,
		// The reader's own default decides whether an imported row needs its
		// style mode spelled out at all — see utils/importStyleMode.ts.
		settings: { defaultStyleMode: "theme" },
	} as unknown as CalloutRegistry;
}

function entry(over: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		id: "test",
		displayName: "Test",
		icon: { type: "lucide", value: "star" },
		colorLight: "#ff0000",
		colorDark: "#ff0000",
		foldable: true,
		defaultFolded: false,
		builtIn: false,
		source: "user",
		...over,
	};
}

describe("MAX_DISPLAY_NAME", () => {
	it("is 80", () => {
		assert.equal(MAX_DISPLAY_NAME, 80);
	});

	it("lets a name of exactly the limit through", async () => {
		const result = await validateImportPayload(
			[entry({ displayName: "n".repeat(MAX_DISPLAY_NAME) })],
			fakeRegistry(),
		);
		assert.equal(result.validDefs.length, 1);
		assert.equal(
			result.issues.filter((i) => i.level === "error").length,
			0,
			JSON.stringify(result.issues),
		);
	});

	it("REJECTS a longer name — this format is our own, so it should not occur", async () => {
		const result = await validateImportPayload(
			[entry({ displayName: "n".repeat(MAX_DISPLAY_NAME + 1) })],
			fakeRegistry(),
		);
		assert.equal(result.validDefs.length, 0);
		const issue = result.issues.find(
			(i) => i.messageKey === "import.err.displayNameTooLong",
		);
		assert.ok(issue, JSON.stringify(result.issues));
		assert.equal(issue.level, "error");
		assert.deepStrictEqual(issue.params, {
			length: MAX_DISPLAY_NAME + 1,
			max: MAX_DISPLAY_NAME,
		});
	});

	it("measures the TRIMMED name, so padding alone cannot fail an entry", async () => {
		const padded = ` ${"n".repeat(MAX_DISPLAY_NAME)} `;
		const result = await validateImportPayload(
			[entry({ displayName: padded })],
			fakeRegistry(),
		);
		assert.equal(result.validDefs.length, 1);
		assert.equal(result.validDefs[0]?.displayName.length, MAX_DISPLAY_NAME);
	});

	it("rejects a name that is only whitespace", async () => {
		const result = await validateImportPayload(
			[entry({ displayName: "   " })],
			fakeRegistry(),
		);
		assert.equal(result.validDefs.length, 0);
		assert.ok(
			result.issues.some(
				(i) => i.messageKey === "import.err.displayNameEmpty",
			),
		);
	});
});

describe("validateImportPayload — a piped id is refused at the door", () => {
	it("drops the entry and keeps the rest of the file", async () => {
		const result = await validateImportPayload(
			[entry({ id: "note|purple" }), entry({ id: "keep" })],
			fakeRegistry(),
		);
		assert.deepStrictEqual(
			result.validDefs.map((d) => d.id),
			["keep"],
		);
		assert.ok(
			result.issues.some((i) => i.messageKey === "import.err.idMetadata"),
			JSON.stringify(result.issues),
		);
		assert.equal(result.fatal, false);
	});

	it("never lets the piped entry through as its base id", async () => {
		// The failure this guards: importing `note|purple` as `note` and
		// repainting the reader's real Note callout.
		const result = await validateImportPayload(
			[entry({ id: "note|purple" })],
			fakeRegistry(),
		);
		assert.deepStrictEqual(result.validDefs, []);
	});

	it("refuses a piped alias too", async () => {
		const result = await validateImportPayload(
			[entry({ aliases: ["ok", "bad|meta"] })],
			fakeRegistry(),
		);
		assert.ok(
			result.issues.some((i) => i.messageKey === "import.err.idMetadata"),
			JSON.stringify(result.issues),
		);
	});
});
