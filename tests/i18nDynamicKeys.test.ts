/**
 * tests/i18nDynamicKeys.test.ts — the translation keys `t()` builds at runtime.
 *
 * Almost every key is written out in full where it is read, so searching for a
 * key finds its reader. A handful of call sites build the key instead —
 * `t(`colorName.${key}`)` — and for those a search finds nothing. That is how a
 * cleanup pass came to call 204 live keys "impossible to verify without running
 * the plugin": `colorName.teal` appears nowhere but in the locale tables.
 *
 * They are not unverifiable. Every hole is filled from a list that sits in the
 * code: the recovery field table, the colour anchors, the categories packed into
 * each bundled icon index. This suite reads those same lists and holds the
 * English table to them in both directions:
 *
 * - **Missing** — a value the code can produce with no English key behind it.
 *   `t()` falls back to the key itself, so the UI would show
 *   `iconPicker.cat.Animals` where it meant "Animals".
 * - **Dead** — a key under one of these prefixes that neither a hole nor a
 *   literal call site can reach. Safe to delete, from `en.ts` and every locale.
 *
 * The lists move. `npm run icons:generate` can add or drop an upstream icon
 * category, and a new settings field may need a recovery label; either one
 * fails here, naming the key.
 *
 * And a guard over the whole idea: every template literal in the plugin that
 * builds a key must be listed below, so a new one fails until someone writes
 * down where its values come from.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { en } from "../src/i18n/en";
import { ICON_SOURCES } from "../src/icons/registry";
import { FIELDS } from "../src/settings/recoveryDetailFields";
import type { RecoveryItemKind } from "../src/settings/recoveryModel";
import { MATERIAL_WEIGHTS, SIDES } from "../src/settings/recoveryValues";
import { COLOR_ANCHORS } from "../src/utils/colorNames";
import { literals, pluginSourceFiles } from "./support/sourceScan";
import type { Literal } from "./support/sourceScan";

/** Total over the union, so a new kind fails to compile until it is added here. */
const KIND_SET: Record<RecoveryItemKind, true> = { added: true, changed: true, removed: true };
const KINDS = Object.keys(KIND_SET);

interface Family {
	/** The template's text before its first `${`, exactly as written at the call site. */
	prefix: string;
	/** Where the key is built, for the reader of a failure. */
	site: string;
	/** Every value the hole can take, read from the list the code itself uses. */
	values: () => Promise<readonly string[]>;
	/**
	 * Every key under `prefix` belongs to this family alone, so one that nothing
	 * reaches is dead. False for `portable.`, which is a whole namespace that
	 * merely happens to contain the two keys built here.
	 */
	owned: boolean;
}

const FAMILIES: readonly Family[] = [
	{
		prefix: "recovery.details.field.",
		site: "recoveryDetailFields.ts (FIELDS) and recoveryValues.ts (SIDES)",
		values: () => Promise.resolve([...Object.values(FIELDS), ...SIDES]),
		owned: true,
	},
	{
		prefix: "recovery.details.count.",
		site: "recoveryDetailsView.ts, one count per RecoveryItemKind",
		values: () => Promise.resolve(KINDS),
		owned: true,
	},
	{
		prefix: "recovery.details.calloutState.",
		site: "recoveryComparisonTable.ts, one badge per RecoveryItemKind",
		values: () => Promise.resolve(KINDS),
		owned: true,
	},
	{
		prefix: "iconPicker.cat.",
		site: "PackToolbarFilters.setCategories, fed by each pack's loadIndex()",
		values: async () => {
			const indexes = await Promise.all(Object.values(ICON_SOURCES).map((pack) => pack.loadIndex()));
			return indexes.flatMap((index) => index.categories);
		},
		owned: true,
	},
	{
		prefix: "colorName.",
		site: "colorNames.ts (COLOR_ANCHORS)",
		values: () => Promise.resolve(COLOR_ANCHORS.map((anchor) => anchor.key)),
		owned: true,
	},
	{
		prefix: "iconPicker.materialWeight",
		site: "recoveryValues.ts (MATERIAL_WEIGHTS)",
		values: () => Promise.resolve(MATERIAL_WEIGHTS.map(String)),
		owned: true,
	},
	{
		prefix: "portable.",
		site: "portableConversionRows.ts, the before/after diff labels",
		values: () => Promise.resolve(["before", "after"]),
		owned: false,
	},
];

const englishKeys = Object.keys(en);

/** True when `head` could be the start of a key: dotted words, and English has one. */
function isKeyHead(head: string): boolean {
	return /^[a-z][A-Za-z]*\.[A-Za-z0-9.]*$/.test(head) && englishKeys.some((key) => key.startsWith(head));
}

/**
 * The scanner reports a template as its text pieces between holes, so a piece
 * is the whole literal only when a backtick sits on both sides of it.
 */
function isWhole(text: string, lit: Literal): boolean {
	return lit.kind === "string" || (lit.kind === "template" && text[lit.start - 1] === "`" && text[lit.end] === "`");
}

/** The opening piece of a template with a hole: `colorName.` out of `colorName.${key}`. */
function isTemplateHead(text: string, lit: Literal): boolean {
	return lit.kind === "template" && text[lit.start - 1] === "`" && text.startsWith("${", lit.end);
}

/** Every key written out in full anywhere in the plugin — the literal readers. */
function literalKeys(): Set<string> {
	const out = new Set<string>();
	for (const file of pluginSourceFiles()) {
		for (const lit of literals(file.text)) {
			if (isWhole(file.text, lit) && Object.hasOwn(en, lit.value)) out.add(lit.value);
		}
	}
	return out;
}

describe("keys built at runtime match what English defines", () => {
	const literal = literalKeys();

	it("found the literal readers it compares against", () => {
		// An empty set would make every owned key look dead; a broken scan should say so.
		assert.ok(literal.size > 500, `only ${literal.size} literal keys found`);
	});

	for (const family of FAMILIES) {
		describe(`${family.prefix}*`, () => {
			it("every value the code can produce has an English key", async () => {
				const values = await family.values();
				assert.ok(values.length > 0, `${family.site} produced no values`);
				const missing = [...new Set(values)].filter((value) => !Object.hasOwn(en, family.prefix + value));
				assert.deepStrictEqual(
					missing.map((value) => family.prefix + value),
					[],
					`built by ${family.site}, but en.ts has no such key — the UI would show the raw key`,
				);
			});

			if (!family.owned) return;
			it("every English key under the prefix is reachable", async () => {
				const built = new Set((await family.values()).map((value) => family.prefix + value));
				const dead = englishKeys.filter(
					(key) => key.startsWith(family.prefix) && !built.has(key) && !literal.has(key),
				);
				assert.deepStrictEqual(
					dead,
					[],
					`neither ${family.site} nor any literal call site can reach these — delete them from en.ts and every locale`,
				);
			});
		});
	}
});

describe("every key the plugin builds is listed here", () => {
	it("no template literal builds a key this suite does not check", () => {
		const known = new Set(FAMILIES.map((family) => family.prefix));
		const unlisted: string[] = [];
		const seen = new Set<string>();
		for (const file of pluginSourceFiles()) {
			for (const lit of literals(file.text)) {
				if (!isTemplateHead(file.text, lit) || !isKeyHead(lit.value)) continue;
				seen.add(lit.value);
				if (!known.has(lit.value)) unlisted.push(`${file.path}: \`${lit.value}\${…}\``);
			}
		}
		assert.deepStrictEqual(unlisted, [], "add each one to FAMILIES, with the list its values come from");
		// The other half: a family whose call site is gone is checking nothing.
		assert.deepStrictEqual([...known].filter((prefix) => !seen.has(prefix)), [], "no call site builds these any more");
	});
});
