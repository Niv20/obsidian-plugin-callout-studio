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
	resolveFold,
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

	it("stores a fold state only when it is not the default", () => {
		// Absence already means "none", so writing it would add a key to every
		// command in every existing data.json — a synced file — to record
		// nothing. `tests/upgradeFromAutoDiscovery.test.ts` is what holds this
		// to a released version's saved commands byte for byte.
		const [plain, explicit, folded, headingWithFold] =
			sanitizeCustomCommands([
				{ id: "a", calloutId: "note", role: "regular" },
				{ id: "b", calloutId: "note", role: "regular", fold: "none" },
				{ id: "c", calloutId: "note", role: "regular", fold: "collapsed" },
				{ id: "d", calloutId: "note", role: "heading", fold: "collapsed" },
			]);
		assert.strictEqual(plain?.fold, undefined);
		assert.strictEqual(explicit?.fold, undefined);
		assert.strictEqual(folded?.fold, "collapsed");
		// The heading role has no fold syntax, so the field is dropped rather
		// than carried where it would later be read as a title character.
		assert.strictEqual(headingWithFold?.fold, undefined);
	});

	it("degrades an unusable fold state instead of dropping the command", () => {
		const result = sanitizeCustomCommands([
			{ id: "a", calloutId: "note", role: "regular", fold: "sideways" },
		]);
		assert.deepStrictEqual(result, [
			{ id: "a", calloutId: "note", role: "regular", action: "insert" },
		]);
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

	it("treats a missing fold state as non-foldable", () => {
		// This is the backward-compatibility guarantee in one assertion: every
		// command saved before the field existed has no `fold`, and a command
		// that writes no mark is exactly what those users already have bound.
		assert.strictEqual(resolveFold({}), "none");
		assert.strictEqual(resolveFold({ fold: undefined }), "none");
	});

	it("keeps only the two fold states that mean something", () => {
		assert.strictEqual(resolveFold({ fold: "none" }), "none");
		assert.strictEqual(resolveFold({ fold: "expanded" }), "expanded");
		assert.strictEqual(resolveFold({ fold: "collapsed" }), "collapsed");
		// Degrades rather than throwing, like every other resolver here.
		assert.strictEqual(
			resolveFold({ fold: "banana" as CustomCommand["fold"] }),
			"none",
		);
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

	it("separates the three fold states", () => {
		// Without this the builder would refuse the second of them as a
		// duplicate, even though they are two entries in the palette writing
		// two different headers.
		const signatures = (["none", "expanded", "collapsed"] as const).map(
			(fold) =>
				commandSignature({
					role: "regular",
					calloutId: "note",
					action: "wrap",
					fold,
				}),
		);
		assert.strictEqual(new Set(signatures).size, 3);
		// An absent fold is the same command as an explicit "none".
		assert.strictEqual(
			commandSignature({ role: "regular", calloutId: "note", action: "wrap" }),
			signatures[0],
		);
	});

	it("ignores a fold state on the roles that have no fold syntax", () => {
		for (const role of ["heading", "inline"] as const) {
			assert.strictEqual(
				commandSignature({ role, calloutId: "note" }),
				commandSignature({ role, calloutId: "note", fold: "collapsed" }),
			);
		}
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
	{ calloutId: "warning", role: "regular", action: "wrap", fold: "expanded" },
	{ calloutId: "warning", role: "regular", action: "wrap", fold: "collapsed" },
	{ calloutId: "warning", role: "regular", action: "insert", fold: "expanded" },
	{
		calloutId: "warning",
		role: "regular",
		action: "insert",
		fold: "collapsed",
	},
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

	it("names the fold state only when there is one", () => {
		// The unfolded names above must stay exactly as they were: syncAll
		// re-registers a command when its rendered name changes, and every
		// command stored before this field existed resolves to "none".
		assert.strictEqual(
			describeCommand(
				{ calloutId: "warning", role: "regular", action: "wrap", fold: "none" },
				def(),
			),
			"Wrap in Warning block callout",
		);
		assert.strictEqual(
			describeCommand(
				{
					calloutId: "warning",
					role: "regular",
					action: "wrap",
					fold: "expanded",
				},
				def(),
			),
			"Wrap in Warning block callout (expanded)",
		);
		assert.strictEqual(
			describeCommand(
				{
					calloutId: "warning",
					role: "regular",
					action: "wrap",
					fold: "collapsed",
				},
				def(),
			),
			"Wrap in Warning block callout (collapsed)",
		);
		assert.strictEqual(
			describeCommand(
				{
					calloutId: "warning",
					role: "regular",
					action: "insert",
					fold: "collapsed",
				},
				def(),
			),
			"Insert Warning block callout (collapsed)",
		);
	});

	it("never names a fold state on a role that has none", () => {
		// A stale fold on a heading or inline command must not reach the
		// palette label, the same way it must not reach the markdown.
		assert.strictEqual(
			describeCommand(
				{
					calloutId: "warning",
					role: "heading",
					headingLevel: 3,
					fold: "collapsed",
				},
				def(),
			),
			"Insert H3 Warning heading callout",
		);
		assert.strictEqual(
			describeCommand(
				{ calloutId: "warning", role: "inline", fold: "collapsed" },
				def(),
			),
			"Insert Warning inline callout",
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
			// A block command may add one parenthesised fold word after the
			// format; nothing else may follow it.
			assert.ok(
				/ (block|heading|inline) callout( \((expanded|collapsed)\))?$/.test(
					name,
				),
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
