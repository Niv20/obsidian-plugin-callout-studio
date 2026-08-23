/**
 * tests/customCommands.test.ts — the user-built command shape in isolation.
 *
 * Covers the two pieces the rest of the feature trusts blindly: the load-time
 * sanitizer (a corrupt entry must not take the whole list down with it) and the
 * name/signature derivation that decides when a command is re-registered and
 * when it is a duplicate.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import {
	commandSignature,
	describeCommand,
	generateCommandId,
	obsidianCommandId,
	resolveAction,
	resolveHeadingLevel,
	sanitizeCustomCommands,
} from "../src/utils/customCommands";
import type { CalloutDefinition, CustomCommand } from "../src/types";

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

describe("sanitizeCustomCommands", () => {
	it("returns an empty list for anything that is not an array", () => {
		assert.deepStrictEqual(sanitizeCustomCommands(undefined), []);
		assert.deepStrictEqual(sanitizeCustomCommands(null), []);
		assert.deepStrictEqual(sanitizeCustomCommands("nope"), []);
		assert.deepStrictEqual(sanitizeCustomCommands({}), []);
	});

	it("keeps a well-formed entry", () => {
		assert.deepStrictEqual(
			sanitizeCustomCommands([
				{ id: "cc-1", calloutId: "warning", role: "regular", action: "wrap" },
			]),
			[{ id: "cc-1", calloutId: "warning", role: "regular", action: "wrap" }],
		);
	});

	it("drops only the broken entries, never the whole list", () => {
		const result = sanitizeCustomCommands([
			{ id: "cc-1", calloutId: "warning", role: "regular" },
			{ id: "cc-2", calloutId: "note", role: "banana" },
			{ id: "cc-3", role: "inline" },
			{ calloutId: "tip", role: "inline" },
			{ id: "", calloutId: "tip", role: "inline" },
			null,
			"nonsense",
			{ id: "cc-7", calloutId: "tip", role: "inline" },
		]);
		assert.deepStrictEqual(
			result.map((c) => c.id),
			["cc-1", "cc-7"],
		);
	});

	it("dedupes by id, first wins", () => {
		const result = sanitizeCustomCommands([
			{ id: "cc-1", calloutId: "warning", role: "inline" },
			{ id: "cc-1", calloutId: "note", role: "inline" },
		]);
		assert.strictEqual(result.length, 1);
		assert.strictEqual(result[0]?.calloutId, "warning");
	});

	it("repairs a bad heading level instead of dropping the entry", () => {
		const result = sanitizeCustomCommands([
			{ id: "a", calloutId: "note", role: "heading", headingLevel: 99 },
			{ id: "b", calloutId: "note", role: "heading", headingLevel: 0 },
			{ id: "c", calloutId: "note", role: "heading", headingLevel: 2.5 },
			{ id: "d", calloutId: "note", role: "heading" },
			{ id: "e", calloutId: "note", role: "heading", headingLevel: 4 },
		]);
		assert.deepStrictEqual(
			result.map((c) => c.headingLevel),
			[2, 2, 2, 2, 4],
		);
	});

	it("only stores the field its role actually reads", () => {
		const [heading, inline, block] = sanitizeCustomCommands([
			{
				id: "a",
				calloutId: "note",
				role: "heading",
				headingLevel: 3,
				action: "wrap",
			},
			{ id: "b", calloutId: "note", role: "inline", headingLevel: 3 },
			{ id: "c", calloutId: "note", role: "regular", headingLevel: 3 },
		]);
		assert.strictEqual(heading?.headingLevel, 3);
		assert.strictEqual(heading?.action, undefined);
		assert.strictEqual(inline?.headingLevel, undefined);
		assert.strictEqual(inline?.action, undefined);
		assert.strictEqual(block?.headingLevel, undefined);
		assert.strictEqual(block?.action, "insert");
	});
});

describe("resolve helpers", () => {
	it("defaults an unusable heading level to H2", () => {
		assert.strictEqual(resolveHeadingLevel({}), 2);
		assert.strictEqual(resolveHeadingLevel({ headingLevel: 7 }), 2);
		assert.strictEqual(resolveHeadingLevel({ headingLevel: 1 }), 1);
		assert.strictEqual(resolveHeadingLevel({ headingLevel: 6 }), 6);
	});

	it("treats anything but an explicit wrap as insert", () => {
		assert.strictEqual(resolveAction({}), "insert");
		assert.strictEqual(resolveAction({ action: "wrap" }), "wrap");
		assert.strictEqual(resolveAction({ action: "insert" }), "insert");
	});
});

describe("commandSignature", () => {
	it("ignores the fields a role does not read", () => {
		// Two inline commands for the same callout are the same command even
		// if stale level/action data is hanging off one of them.
		assert.strictEqual(
			commandSignature({ role: "inline", calloutId: "note" }),
			commandSignature({
				role: "inline",
				calloutId: "note",
				headingLevel: 4,
				action: "wrap",
			}),
		);
	});

	it("separates heading levels and block actions", () => {
		const h2 = commandSignature({
			role: "heading",
			calloutId: "note",
			headingLevel: 2,
		});
		const h4 = commandSignature({
			role: "heading",
			calloutId: "note",
			headingLevel: 4,
		});
		assert.notStrictEqual(h2, h4);

		const wrap = commandSignature({
			role: "regular",
			calloutId: "note",
			action: "wrap",
		});
		const insert = commandSignature({
			role: "regular",
			calloutId: "note",
			action: "insert",
		});
		assert.notStrictEqual(wrap, insert);
	});

	it("separates roles and callouts", () => {
		assert.notStrictEqual(
			commandSignature({ role: "inline", calloutId: "note" }),
			commandSignature({ role: "regular", calloutId: "note" }),
		);
		assert.notStrictEqual(
			commandSignature({ role: "inline", calloutId: "note" }),
			commandSignature({ role: "inline", calloutId: "tip" }),
		);
	});
});

/** One draft per (role, action) the builder can produce. */
const EVERY_SHAPE: Omit<CustomCommand, "id">[] = [
	{ calloutId: "warning", role: "regular", action: "wrap" },
	{ calloutId: "warning", role: "regular", action: "insert" },
	{ calloutId: "warning", role: "heading", headingLevel: 3 },
	{ calloutId: "warning", role: "inline" },
];

describe("describeCommand", () => {
	// The English table is the fallback for every locale, so these are the
	// strings a user sees unless a translation overrides them.
	it("names each role and action", () => {
		assert.strictEqual(
			describeCommand({ calloutId: "warning", role: "regular", action: "wrap" }, def()),
			"Wrap in Warning block callout",
		);
		assert.strictEqual(
			describeCommand(
				{ calloutId: "warning", role: "regular", action: "insert" },
				def(),
			),
			"Insert Warning block callout",
		);
		assert.strictEqual(
			describeCommand({ calloutId: "warning", role: "inline" }, def()),
			"Insert Warning inline callout",
		);
		assert.strictEqual(
			describeCommand(
				{ calloutId: "warning", role: "heading", headingLevel: 3 },
				def(),
			),
			"Insert H3 Warning heading callout",
		);
	});

	it("says which format every command writes", () => {
		// The point of the wording: one callout can carry a command in all
		// three formats at once, so a name that omits its own format reads as
		// the generic option rather than as the block one. Asserted over the
		// whole set rather than per string, so a fourth render role cannot be
		// added with an unqualified name.
		const named = EVERY_SHAPE.map((shape) => describeCommand(shape, def()));
		for (const name of named) {
			assert.ok(
				/ (block|heading|inline) callout$/.test(name),
				`${name} does not name its format`,
			);
		}
		assert.strictEqual(new Set(named).size, named.length);
	});

	it("follows the callout's current display name", () => {
		// This is what makes a rename update the palette label: the name is
		// re-derived on every sweep rather than stored with the command.
		const command: CustomCommand = {
			id: "cc-1",
			calloutId: "warning",
			role: "inline",
		};
		assert.strictEqual(
			describeCommand(command, def({ displayName: "Careful" })),
			"Insert Careful inline callout",
		);
	});
});

describe("command identity", () => {
	it("mints distinct ids", () => {
		const ids = new Set(
			Array.from({ length: 200 }, () => generateCommandId()),
		);
		assert.strictEqual(ids.size, 200);
	});

	it("builds a command id with no second colon", () => {
		// Obsidian prefixes `callout-studio:`; a nested colon in our half would
		// make the full id ambiguous to anything that splits on it.
		const id = obsidianCommandId(generateCommandId());
		assert.ok(id.startsWith("custom-"));
		assert.ok(!id.includes(":"));
	});
});
