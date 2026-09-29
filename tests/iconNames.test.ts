/**
 * tests/iconNames.test.ts — Lucide's two spellings, and "does this name draw
 * anything?"
 *
 * `getIconIds()` hands back three different things under one list and only the
 * first is prefixed: Obsidian's own Lucide (`lucide-book`), ids other plugins
 * registered with `addIcon()` (`remix-FireFill`), and ~44 icons internal to
 * Obsidian (`dice`, `help`). `getIcon()` reads that prefix as an instruction,
 * not as decoration — with it, it looks in the core Lucide table and nowhere
 * else; without it, it tries the plugin table, the internal table, the
 * deprecated aliases and core Lucide in turn. So a `lucide-` glued onto an id
 * that is not core Lucide names *nothing at all*, which is exactly what v2.7.0
 * did to every bare value on the way into the registry.
 *
 * The rule that replaced it — store what `getIconIds()` said, normalize only
 * when comparing — is what the two halves of this file test. `resolveLucideId`
 * repairs a value already written the wrong way; `canonicalIconValue` and
 * `iconsEqual` are the comparison side, and they matter because `constants.ts`
 * writes `pencil` while the picker writes `lucide-pencil`: a diff that could not
 * see those as one icon would report a change the user never made, on a
 * built-in, forever.
 *
 * `nameCheck` is the import side of the same story, plus one deliberate
 * imprecision: Font Awesome's three styles and Tabler's two share one search
 * index, so the test is a superset for those. It catches names that exist
 * nowhere, never names that exist in the other style — and it says "yes" to
 * anything it cannot check, so a caller only ever acts on a definite "no".
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import {
	bareLucideName,
	canonicalIconValue,
	iconsEqual,
	resolveLucideId,
} from "../src/icons/lucideId";
import { HELP_ICON_ID } from "../src/constants";
import { createIconNameCheck, createLucideNameCheck } from "../src/icons/nameCheck";
import type { CalloutIcon, IconPackId } from "../src/types";
import { literals, pluginSourceFiles } from "./support/sourceScan";

/**
 * What `getIconIds()` answers in these tests.
 *
 * All three kinds of id are represented, because the whole point is that they
 * are not interchangeable. Seeded before anything calls it: `lucideId.ts`
 * snapshots the prefixed half on first use — safe in the app because Obsidian's
 * own table is complete before any plugin loads — so this list is fixed for the
 * file.
 */
const ICON_IDS = [
	// Obsidian's core Lucide table — the only ids that carry the prefix.
	"lucide-pencil",
	"lucide-star",
	"lucide-book",
	// Obsidian's own internal icons, bare.
	"dice",
	"help",
	// Another plugin's, registered with addIcon() at runtime. Also bare.
	"remix-QuestionnaireFill",
];

(globalThis as unknown as { __CS_ICON_IDS__?: string[] }).__CS_ICON_IDS__ =
	ICON_IDS;

const icon = (over: Partial<CalloutIcon> = {}): CalloutIcon => ({
	type: "lucide",
	value: "pencil",
	...over,
});

/* ------------------------------------------------------------------ *
 * bareLucideName
 * ------------------------------------------------------------------ */

describe("bareLucideName", () => {
	it("drops the core-Lucide prefix", () => {
		assert.equal(bareLucideName("lucide-pencil"), "pencil");
	});

	it("leaves a bare name alone", () => {
		assert.equal(bareLucideName("pencil"), "pencil");
		assert.equal(bareLucideName("dice"), "dice");
		assert.equal(bareLucideName("remix-QuestionnaireFill"), "remix-QuestionnaireFill");
	});

	it("only strips it from the front, and only once", () => {
		assert.equal(bareLucideName("lucide-lucide-pencil"), "lucide-pencil");
		assert.equal(bareLucideName("my-lucide-pencil"), "my-lucide-pencil");
	});

	it("leaves the word `lucide` alone without its hyphen", () => {
		assert.equal(bareLucideName("lucide"), "lucide");
	});

	it("does not trim — that is the caller's decision", () => {
		assert.equal(bareLucideName(" lucide-pencil"), " lucide-pencil");
	});
});

/* ------------------------------------------------------------------ *
 * resolveLucideId
 * ------------------------------------------------------------------ */

describe("resolveLucideId — the spelling Obsidian can actually draw", () => {
	it("keeps the prefix when core Lucide really has that icon", () => {
		assert.equal(resolveLucideId("lucide-pencil"), "lucide-pencil");
		assert.equal(resolveLucideId("lucide-star"), "lucide-star");
	});

	it("drops a prefix core Lucide does not answer to", () => {
		// The v2.7.0 repair: the prefix can only have come from that build
		// rewriting a bare id, and dropping it hands the id back to the three
		// other tables that might know it.
		assert.equal(resolveLucideId("lucide-dice"), "dice");
		assert.equal(
			resolveLucideId("lucide-remix-QuestionnaireFill"),
			"remix-QuestionnaireFill",
		);
	});

	it("leaves a bare id untouched — it is already the forgiving spelling", () => {
		assert.equal(resolveLucideId("pencil"), "pencil");
		assert.equal(resolveLucideId("dice"), "dice");
		assert.equal(resolveLucideId("remix-QuestionnaireFill"), "remix-QuestionnaireFill");
	});

	it("trims first, so whitespace cannot hide the prefix", () => {
		assert.equal(resolveLucideId("  lucide-pencil  "), "lucide-pencil");
		assert.equal(resolveLucideId("\tlucide-dice\n"), "dice");
	});

	it("still repairs a prefixed id that names nothing at all", () => {
		// Handing back "no-such-icon" is not a fix, but it is the id the other
		// tables would be asked about — which is strictly better than an id only
		// one table is ever consulted for.
		assert.equal(resolveLucideId("lucide-no-such-icon"), "no-such-icon");
	});
});

/* ------------------------------------------------------------------ *
 * canonicalIconValue
 * ------------------------------------------------------------------ */

describe("canonicalIconValue — for comparison, never for storage", () => {
	it("reduces both Lucide spellings to one", () => {
		assert.equal(canonicalIconValue(icon({ value: "lucide-pencil" })), "pencil");
		assert.equal(canonicalIconValue(icon({ value: "pencil" })), "pencil");
	});

	it("trims a Lucide value", () => {
		assert.equal(canonicalIconValue(icon({ value: "  lucide-pencil " })), "pencil");
	});

	it("leaves every other pack's value exactly as stored", () => {
		// An emoji glyph, a user-image id and a pack icon name are not names in
		// a table with two spellings; touching them would be inventing a rule.
		assert.equal(canonicalIconValue({ type: "emoji", value: "😀" }), "😀");
		assert.equal(
			canonicalIconValue({ type: "octicons", value: "lucide-alert" }),
			"lucide-alert",
		);
	});

	it("does not even trim a non-Lucide value", () => {
		assert.equal(canonicalIconValue({ type: "octicons", value: " alert " }), " alert ");
	});
});

/* ------------------------------------------------------------------ *
 * iconsEqual
 * ------------------------------------------------------------------ */

describe("iconsEqual", () => {
	it("is true for the same object", () => {
		const a = icon();
		assert.equal(iconsEqual(a, a), true);
	});

	it("handles either side being absent", () => {
		assert.equal(iconsEqual(undefined, undefined), true);
		assert.equal(iconsEqual(icon(), undefined), false);
		assert.equal(iconsEqual(undefined, icon()), false);
	});

	it("calls a built-in's bare name and the picker's prefixed one one icon", () => {
		// The reason the whole module exists: `isModified` and the editor's
		// revert affordance both diff icons, and neither may report a change the
		// user never made.
		assert.equal(
			iconsEqual(icon({ value: "pencil" }), icon({ value: "lucide-pencil" })),
			true,
		);
	});

	it("separates two different Lucide icons", () => {
		assert.equal(iconsEqual(icon({ value: "pencil" }), icon({ value: "star" })), false);
	});

	it("separates the same name in two different libraries", () => {
		assert.equal(
			iconsEqual(
				{ type: "octicons", value: "alert" },
				{ type: "fa-solid", value: "alert" },
			),
			false,
		);
	});

	it("ignores the order the fields were written in", () => {
		// Two icons built by different code paths spell the same object with
		// different key orders, and a plain JSON.stringify diff would call that a
		// difference.
		assert.equal(
			iconsEqual(
				{ type: "material", value: "home", style: "filled", weight: 700 },
				{ type: "material", value: "home", weight: 700, style: "filled" },
			),
			true,
		);
	});

	it("treats an explicit undefined as an absent field", () => {
		// Which is what a round-trip through data.json produces.
		assert.equal(
			iconsEqual(
				{ type: "material", value: "home", style: undefined },
				{ type: "material", value: "home" },
			),
			true,
		);
	});

	it("sees a difference in any other field, without being told about it", () => {
		// Structural on purpose, so a field added to CalloutIcon later is covered
		// without anyone remembering to come back here.
		assert.equal(
			iconsEqual(
				{ type: "material", value: "home", weight: 400 },
				{ type: "material", value: "home", weight: 700 },
			),
			false,
		);
		assert.equal(
			iconsEqual(
				{ type: "image", value: "img-1", recolor: true },
				{ type: "image", value: "img-1" },
			),
			false,
		);
	});

	it("normalizes only Lucide's spelling, not everyone's", () => {
		assert.equal(
			iconsEqual(
				{ type: "octicons", value: "alert" },
				{ type: "octicons", value: "lucide-alert" },
			),
			false,
		);
	});
});

/* ------------------------------------------------------------------ *
 * createLucideNameCheck
 * ------------------------------------------------------------------ */

describe("createLucideNameCheck", () => {
	it("accepts both spellings of a core Lucide icon", () => {
		// A check that did not normalize would declare one half of the vault's
		// icons imaginary — `constants.ts` and the Callout Manager importer both
		// store the bare name.
		const known = createLucideNameCheck();
		assert.equal(known("pencil"), true);
		assert.equal(known("lucide-pencil"), true);
	});

	it("accepts an id that is only ever spelled bare", () => {
		const known = createLucideNameCheck();
		assert.equal(known("dice"), true);
		assert.equal(known("remix-QuestionnaireFill"), true);
	});

	it("rejects a name nothing in the app answers to", () => {
		const known = createLucideNameCheck();
		assert.equal(known("no-such-icon"), false);
		assert.equal(known("lucide-no-such-icon"), false);
	});

	it("trims before looking", () => {
		const known = createLucideNameCheck();
		assert.equal(known("  pencil  "), true);
	});

	it("is a NAME check, not a spelling check", () => {
		// `lucide-dice` names nothing (see resolveLucideId), yet passes here —
		// deliberately. This answers "is there a drawing called that?", and the
		// repair for the spelling is a separate function with a separate job.
		const known = createLucideNameCheck();
		assert.equal(known("lucide-dice"), true);
	});

	it("re-reads the list on every call, because plugins keep adding to it", () => {
		const seeded = globalThis as unknown as { __CS_ICON_IDS__?: string[] };
		const before = createLucideNameCheck();
		assert.equal(before("late-arrival"), false);
		seeded.__CS_ICON_IDS__ = [...ICON_IDS, "late-arrival"];
		try {
			assert.equal(createLucideNameCheck()("late-arrival"), true);
			// The already-built check keeps its own snapshot, which is the point
			// of building one per batch.
			assert.equal(before("late-arrival"), false);
		} finally {
			seeded.__CS_ICON_IDS__ = ICON_IDS;
		}
	});
});

/* ------------------------------------------------------------------ *
 * createIconNameCheck
 * ------------------------------------------------------------------ */

describe("createIconNameCheck", () => {
	const check = (icons: CalloutIcon[]) => createIconNameCheck(icons);

	it("knows a real Octicons name from an invented one", async () => {
		const real: CalloutIcon = { type: "octicons", value: "alert" };
		const fake: CalloutIcon = { type: "octicons", value: "no-such-icon" };
		const known = await check([real, fake]);
		assert.equal(known(real), true);
		assert.equal(known(fake), false);
	});

	it("checks Material, Tabler and RPG Awesome off their bundled indexes", async () => {
		// Bundled, so an import works offline — which matters, because an import
		// that needed the network would fail on exactly the machines that most
		// need to be told a name is wrong.
		const icons: CalloutIcon[] = [
			{ type: "material", value: "home" },
			{ type: "material", value: "no-such-icon" },
			{ type: "tabler-outline", value: "dice-3" },
			{ type: "rpg-awesome", value: "acid" },
			{ type: "rpg-awesome", value: "no-such-icon" },
		];
		const known = await check(icons);
		assert.equal(known(icons[0]!), true);
		assert.equal(known(icons[1]!), false);
		assert.equal(known(icons[2]!), true);
		assert.equal(known(icons[3]!), true);
		assert.equal(known(icons[4]!), false);
	});

	it("normalizes Lucide on both sides", async () => {
		const icons: CalloutIcon[] = [
			{ type: "lucide", value: "pencil" },
			{ type: "lucide", value: "lucide-pencil" },
			{ type: "lucide", value: "no-such-icon" },
		];
		const known = await check(icons);
		assert.equal(known(icons[0]!), true);
		assert.equal(known(icons[1]!), true);
		assert.equal(known(icons[2]!), false);
	});

	it("says yes to emoji and to a user's own picture, which it cannot check", async () => {
		// `emoji` stores the glyph itself, and `image` stores a UserImageIcon id
		// the JSON importer reports on separately when the picture did not travel
		// with the file. Guessing at either would be inventing a verdict.
		const icons: CalloutIcon[] = [
			{ type: "emoji", value: "😀" },
			{ type: "emoji", value: "not an emoji at all" },
			{ type: "image", value: "img-does-not-exist" },
		];
		const known = await check(icons);
		for (const i of icons) assert.equal(known(i), true);
	});

	it("says yes to a library this build has never heard of", async () => {
		// Returning "cannot check" as true is what keeps the caller acting only
		// on a definite no — an import from a newer version must not have its
		// icons stripped by an older one.
		const future: CalloutIcon = { type: "future-pack" as IconPackId, value: "x" };
		const known = await check([future]);
		assert.equal(known(future), true);
	});

	it("is a superset for Font Awesome's three styles, deliberately", async () => {
		// The styles share one merged index, so this catches a name that exists
		// nowhere in Font Awesome — never a name that exists in the other style.
		// `faTypeForName` is what corrects the style; this is not it.
		const brandsAsSolid: CalloutIcon = { type: "fa-solid", value: "42-group" };
		const nowhere: CalloutIcon = { type: "fa-solid", value: "no-such-icon" };
		const known = await check([brandsAsSolid, nowhere]);
		assert.equal(known(brandsAsSolid), true);
		assert.equal(known(nowhere), false);
	});

	it("is a superset for Tabler's two styles, for the same reason", async () => {
		// `a-b` is drawn in Outline only, and passes as Filled. Rendering falls
		// back to the style that has the drawing, so the name is still right.
		const outlineAsFilled: CalloutIcon = { type: "tabler-filled", value: "a-b" };
		const nowhere: CalloutIcon = { type: "tabler-filled", value: "no-such-icon" };
		const known = await check([outlineAsFilled, nowhere]);
		assert.equal(known(outlineAsFilled), true);
		assert.equal(known(nowhere), false);
	});

	it("loads only the libraries the batch actually names", async () => {
		// An empty batch must not decode 617 KB of Material metadata to answer
		// nothing; the check is built per import, not per session.
		const known = await check([]);
		assert.equal(known({ type: "octicons", value: "no-such-icon" }), true);
	});
});

/**
 * The one icon whose Lucide spelling changes what the user sees. A
 * right-to-left interface mirrors every icon, and in Hebrew Obsidian un-mirrors
 * the question mark only under its older name, `help-circle` — `circle-help`
 * draws the same "?" and stays backwards. Measured against the real `app.css`;
 * what can be checked here is that the plugin never draws it under the name
 * that misses the exemption.
 */
describe("the question-mark icon keeps the name Hebrew un-mirrors", () => {
	it("is help-circle", () => {
		assert.equal(HELP_ICON_ID, "help-circle");
	});

	it("is never drawn as circle-help", () => {
		const hits = pluginSourceFiles().flatMap((file) =>
			literals(file.text)
				.filter((lit) => /^(?:lucide-)?circle-help$/.test(lit.value))
				.map(() => file.path),
		);
		assert.deepEqual(hits, [], "use HELP_ICON_ID from src/constants.ts");
	});
});
