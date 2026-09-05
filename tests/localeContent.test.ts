/**
 * tests/localeContent.test.ts — what is *inside* the 31 translations.
 *
 * `tests/locales.test.ts` covers the delivery contract: that `locales/*.json`
 * is byte-for-byte what the manifest compiled into `main.js` expects, and that
 * every locale *code* resolves to a file that exists. This covers the strings
 * themselves, read from `src/i18n/*.ts` rather than from the generated JSON —
 * see `tests/support/localeTables.ts` for why that distinction matters.
 *
 * Three properties, and each has a specific failure it exists to prevent:
 *
 * - **No key English lacks.** The reverse is normal and deliberate: `en.ts` is
 *   edited alone, and `t()` fills the gap per key, so a locale trailing the
 *   newest strings is the ordinary state between a change and its translation
 *   pass. A key with no English counterpart is different — nothing can ever
 *   look it up, so it is dead weight that gets downloaded forever. It is also
 *   the fingerprint of a rename done in one file and not the others.
 *
 * - **`{{placeholder}}` parity.** `t()` interpolates by literal name, so a
 *   translator who writes `{{Name}}`, `{{ name }}` or drops the token entirely
 *   ships a string with a raw `{{name}}` visible in the UI — or, worse, silently
 *   loses the one number the sentence was about. Nothing at runtime notices:
 *   `String.replace` on an absent token is a no-op. Compared as a multiset, so
 *   a sentence that legitimately reorders `{{oldIds}}`/`{{newId}}` for its own
 *   grammar still passes, and one that uses a token twice must use it twice.
 *
 * - **No stray bidi controls.** Invisible characters are the one class of
 *   translation damage that survives every review: they cannot be seen in a
 *   diff, in a code review, or in the running UI. An unbalanced isolate does
 *   not stop at the end of the string — it reorders whatever the surrounding
 *   layout happens to put after it, so the visible breakage appears somewhere
 *   the string is not. The one control the plugin does use on purpose (an LRM
 *   pinning the leading dot of "`.json`" out of a Hebrew run) is legitimate and
 *   passes all of these; what fails them is the torn-off kind.
 *
 * Every bidi character below is written as a `\u` escape and never as itself.
 * A test that hunts invisible characters must not contain any, or its own
 * source becomes unreviewable by exactly the argument that motivates it.
 *
 * The arrow suite at the bottom is the RTL half of the same idea, for the one
 * piece of punctuation that carries direction as *meaning* rather than as
 * style: `→` in a navigation path.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { en } from "../src/i18n/en";
import { LOCALE_MANIFEST } from "../src/i18n/localeManifest";
import {
	LOCALE_TABLES,
	RTL_LOCALES,
	localeEntries,
	type LocaleTable,
} from "./support/localeTables";

const entries = localeEntries();

/** `{{name}}`-style interpolation tokens, in the exact form `t()` looks for. */
const PLACEHOLDER = /\{\{[a-zA-Z0-9_]+\}\}/g;

/** Every token that *looks* like one, so a malformed spelling is visible. */
const LOOSE_PLACEHOLDER = /\{\{[^}]*\}\}/g;

/** The shape `t()` will actually substitute, anchored. */
const WELL_FORMED = /^\{\{[a-zA-Z0-9_]+\}\}$/;

const tokensOf = (value: string): string[] =>
	(value.match(PLACEHOLDER) ?? []).sort();

function malformedTokens(table: LocaleTable): string[] {
	const found: string[] = [];
	for (const [key, value] of Object.entries(table)) {
		for (const token of value.match(LOOSE_PLACEHOLDER) ?? []) {
			if (!WELL_FORMED.test(token)) found.push(`${key}: ${JSON.stringify(token)}`);
		}
	}
	return found;
}

/* -------------------------------------------------------------------------- */
/* Bidirectional-text controls                                                */
/* -------------------------------------------------------------------------- */

/**
 * Invisible characters that change how text is ordered.
 *
 * Split into three groups because they fail in different ways:
 *
 * - **marks** (ALM/LRM/RLM) are self-contained. They nudge one neighbouring
 *   character and stop, so they are safe anywhere except at a string boundary,
 *   where they nudge nothing of this string's and leak into the next.
 * - **isolates** (LRI/RLI/FSI … PDI) are the modern, scoped form. They must be
 *   balanced; an unclosed one runs to the end of the paragraph, not the string.
 * - **embeddings and overrides** (LRE/RLE/LRO/RLO … PDF) are the deprecated
 *   form isolates replaced. Unicode advises against them in new text, and in a
 *   translation file they are almost always paste damage from a source that
 *   had its own layout. Rejected outright rather than balance-checked.
 */
/** Spell a control by code point, never by pasting the character itself. */
const u = (cp: number): string => String.fromCodePoint(cp);

const ALM = u(0x061c); // Arabic letter mark
const LRM = u(0x200e); // Left-to-right mark
const RLM = u(0x200f); // Right-to-left mark
const BIDI_MARKS = ALM + LRM + RLM;

const LRI = u(0x2066); // Left-to-right isolate
const RLI = u(0x2067); // Right-to-left isolate
const FSI = u(0x2068); // First-strong isolate
const PDI = u(0x2069); // Pop directional isolate
const ISOLATE_OPEN = LRI + RLI + FSI;

/**
 * LRE, RLE, PDF, LRO, RLO — the deprecated, unscoped form isolates replaced.
 */
const EMBEDDING = [0x202a, 0x202b, 0x202c, 0x202d, 0x202e].map(u).join("");

const ANY_BIDI = new RegExp(`[${BIDI_MARKS}${ISOLATE_OPEN}${PDI}${EMBEDDING}]`);

const isBidi = (ch: string | undefined): boolean =>
	ch !== undefined && ANY_BIDI.test(ch);

const codePoint = (ch: string): string =>
	`U+${(ch.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, "0")}`;

/** `null` when the isolates balance, else a description of how they do not. */
function isolateFault(value: string): string | null {
	let depth = 0;
	for (const c of value) {
		if (ISOLATE_OPEN.includes(c)) depth++;
		else if (c === PDI) {
			depth--;
			// A PDI with nothing open pops the *enclosing* layout's isolate, so
			// the damage lands outside the string entirely.
			if (depth < 0) return "closes an isolate it never opened";
		}
	}
	return depth > 0 ? `leaves ${depth} isolate(s) open` : null;
}

/* -------------------------------------------------------------------------- */
/* Key completeness                                                           */
/* -------------------------------------------------------------------------- */

describe("every locale source is covered by these tests", () => {
	it("lists exactly the locales the manifest ships", () => {
		// Without this, adding a 32nd language and forgetting `localeTables.ts`
		// would leave it untested while the suite still reported all green.
		assert.deepStrictEqual(
			Object.keys(LOCALE_TABLES).sort(),
			Object.keys(LOCALE_MANIFEST).sort(),
		);
	});

	it("does not treat English as a downloadable locale", () => {
		assert.ok(!("en" in LOCALE_TABLES));
		assert.ok(!("en" in LOCALE_MANIFEST));
	});

	it("names only locales that exist for the RTL list", () => {
		for (const fileId of RTL_LOCALES) {
			assert.ok(fileId in LOCALE_TABLES, `${fileId} has no table`);
		}
	});
});

describe("no locale carries a key English lacks", () => {
	for (const [fileId, table] of entries) {
		it(`${fileId}.ts`, () => {
			const orphans = Object.keys(table).filter((key) => !(key in en));
			assert.deepStrictEqual(
				orphans,
				[],
				`${fileId}.ts has keys with no English counterpart — they are ` +
					`unreachable, and usually the leftovers of a key renamed in ` +
					`en.ts alone: ${orphans.join(", ")}`,
			);
		});
	}

	it("reports how far each locale trails en.ts, and gates on nothing", (t) => {
		// This used to *assert* that some locale was behind en.ts, on the
		// reasoning that a fully translated set would leave `t()`'s per-key
		// fallback untested. That reasoning was wrong, and the assertion was a
		// trap: it made finishing the last translation fail the build. The
		// fallback is asserted directly, against a synthetic one-key table, in
		// `tests/locales.test.ts` ("fills a missing key from English rather
		// than showing the key") — which holds whether the shipped tables are
		// complete or not, so nothing here needs the gap to exist. Trailing is
		// a normal state, not a required one; both ends of the range are fine,
		// and this only says which end we are at.
		const trailing = entries
			.map(([fileId, table]) => ({
				fileId,
				missing: Object.keys(en).filter((key) => !(key in table)).length,
			}))
			.filter((row) => row.missing > 0);
		t.diagnostic(
			trailing.length === 0
				? `all ${entries.length} locales are level with en.ts`
				: trailing
						.map((row) => `${row.fileId} is missing ${row.missing}`)
						.join(", "),
		);
	});
});

/* -------------------------------------------------------------------------- */
/* Placeholders                                                               */
/* -------------------------------------------------------------------------- */

describe("placeholders match English", () => {
	for (const [fileId, table] of entries) {
		it(`${fileId}.ts interpolates the same tokens`, () => {
			const drift: string[] = [];
			for (const [key, value] of Object.entries(table)) {
				const source = en[key];
				if (source === undefined) continue; // covered by the orphan suite
				const expected = tokensOf(source);
				const actual = tokensOf(value);
				if (expected.join(" ") !== actual.join(" ")) {
					drift.push(
						`${key}: en has [${expected.join(", ")}], ` +
							`${fileId} has [${actual.join(", ")}]`,
					);
				}
			}
			assert.deepStrictEqual(drift, []);
		});

		it(`${fileId}.ts spells every token the way t() reads it`, () => {
			// `{{ name }}` and `{{Name}}` would slip past the parity check only
			// if English were malformed in the same way; this catches the shape
			// itself, so the failure names the real problem instead of an
			// inequality between two lists.
			assert.deepStrictEqual(malformedTokens(table), []);
		});
	}

	it("English itself is well-formed, since it is the reference", () => {
		assert.deepStrictEqual(malformedTokens(en), []);
	});

	it("covers strings that really do interpolate", () => {
		// Guards the guard: a regex that stopped matching would turn every
		// assertion above into a comparison of two empty arrays.
		const withTokens = Object.values(en).filter(
			(value) => tokensOf(value).length > 0,
		);
		assert.ok(withTokens.length > 50, `only ${withTokens.length} en strings`);
	});
});

/* -------------------------------------------------------------------------- */
/* Bidi hygiene                                                               */
/* -------------------------------------------------------------------------- */

describe("no stray bidirectional controls", () => {
	const all: [string, LocaleTable][] = [["en", en], ...entries];

	for (const [fileId, table] of all) {
		it(`${fileId} balances every isolate`, () => {
			const faults: string[] = [];
			for (const [key, value] of Object.entries(table)) {
				const fault = isolateFault(value);
				if (fault) faults.push(`${key}: ${fault}`);
			}
			assert.deepStrictEqual(faults, []);
		});

		it(`${fileId} uses no deprecated embedding or override`, () => {
			// LRE/RLE/LRO/RLO/PDF. Isolates do the same job with a scope that
			// ends; these do not, which is why Unicode deprecated them and why
			// one appearing in a translation is paste damage rather than intent.
			const found: string[] = [];
			for (const [key, value] of Object.entries(table)) {
				for (const ch of value) {
					if (EMBEDDING.includes(ch)) found.push(`${key}: ${codePoint(ch)}`);
				}
			}
			assert.deepStrictEqual(found, []);
		});

		it(`${fileId} puts no bidi control at a string boundary`, () => {
			// The torn-off case. A mark at the very start or end orders nothing
			// of this string's — the character it was meant to pin sits in
			// whatever the layout concatenates next, which is not this string's
			// to reorder.
			const dangling: string[] = [];
			for (const [key, value] of Object.entries(table)) {
				const chars = [...value];
				if (isBidi(chars[0])) dangling.push(`${key}: leading`);
				if (isBidi(chars.at(-1))) dangling.push(`${key}: trailing`);
			}
			assert.deepStrictEqual(dangling, []);
		});

		it(`${fileId} never doubles a bidi control`, () => {
			// Two in a row is the signature of a copy-paste round trip; the
			// second one cannot do anything the first did not.
			const doubled: string[] = [];
			for (const [key, value] of Object.entries(table)) {
				const chars = [...value];
				for (let i = 1; i < chars.length; i++) {
					if (isBidi(chars[i]) && isBidi(chars[i - 1])) {
						doubled.push(key);
						break;
					}
				}
			}
			assert.deepStrictEqual(doubled, []);
		});

		it(`${fileId} keeps bidi controls out of placeholders`, () => {
			// An invisible character inside `{{name}}` makes the token stop
			// matching, so the raw `{{name}}` renders — with the control still
			// in it, and no visible clue why.
			const broken: string[] = [];
			for (const [key, value] of Object.entries(table)) {
				for (const token of value.match(LOOSE_PLACEHOLDER) ?? []) {
					if (ANY_BIDI.test(token)) broken.push(`${key}: ${token}`);
				}
			}
			assert.deepStrictEqual(broken, []);
		});
	}

	it("does not reject the marks that are there on purpose", () => {
		// he/ar pin the leading dot of ".json" with an LRM so it does not render
		// as "json." inside the RTL run. That is exactly the correct use, and a
		// rule that forbade every control would have to be suppressed for it —
		// so this asserts the rules above still let it through, rather than
		// leaving "no failures" ambiguous between "clean" and "nothing to find".
		for (const fileId of ["he", "ar"] as const) {
			const value = LOCALE_TABLES[fileId]["import.sourceStudioDesc"];
			assert.ok(value !== undefined, `${fileId} lost import.sourceStudioDesc`);
			assert.ok(value.includes(LRM), `${fileId} lost its deliberate LRM`);
			assert.strictEqual(isolateFault(value), null);
			const chars = [...value];
			assert.ok(!isBidi(chars[0]) && !isBidi(chars.at(-1)));
		}
	});

	it("would notice a control if one appeared", () => {
		// The detector, tested against text this repo does not contain — so a
		// green run above means "checked and clean", not "the regex broke".
		assert.strictEqual(isolateFault(`a${RLI}b`), "leaves 1 isolate(s) open");
		assert.strictEqual(
			isolateFault(`a${PDI}b`),
			"closes an isolate it never opened",
		);
		assert.strictEqual(isolateFault(`${FSI}x${PDI}`), null);
		assert.strictEqual(isolateFault(`${LRI}a${PDI}${RLI}b${PDI}`), null);
		assert.ok(isBidi(RLM) && isBidi(ALM) && isBidi(LRM));
		assert.ok(!isBidi("a") && !isBidi(" ") && !isBidi(undefined));
	});
});

/* -------------------------------------------------------------------------- */
/* Navigation arrows                                                          */
/* -------------------------------------------------------------------------- */

/**
 * `Settings → Vault insights → Re-scan vault` is a *path*, so its arrows are
 * the sentence's structure rather than decoration: each one is one step the
 * user has to take. Two things follow, and only the first is direction-free.
 */
describe("navigation arrows survive translation", () => {
	/** Non-global on purpose — `.test()` on a `/g/` regex carries lastIndex. */
	const HAS_ARROW = /[→←]/;
	const ARROWS = /[→←]/g;

	const arrowCount = (value: string): number =>
		(value.match(ARROWS) ?? []).length;

	const arrowKeys = Object.keys(en).filter((key) =>
		HAS_ARROW.test(en[key] ?? ""),
	);

	it("has arrows in English to compare against", () => {
		assert.ok(arrowKeys.length > 0, "no en string uses an arrow any more");
		assert.ok(arrowKeys.includes("manualDiscovery.failed"));
	});

	for (const [fileId, table] of entries) {
		it(`${fileId}.ts keeps every step of the path`, () => {
			// Direction-agnostic on purpose: an RTL language *should* mirror the
			// glyph. What no language may do is drop a step, which turns
			// "Settings → X → Y" into an instruction that skips a screen.
			const dropped: string[] = [];
			for (const key of arrowKeys) {
				const translated = table[key];
				if (translated === undefined) continue;
				const expected = arrowCount(en[key] ?? "");
				const actual = arrowCount(translated);
				if (expected !== actual) {
					dropped.push(`${key}: en has ${expected}, ${fileId} has ${actual}`);
				}
			}
			assert.deepStrictEqual(dropped, []);
		});
	}

	for (const fileId of RTL_LOCALES) {
		it(`${fileId}.ts mirrors the arrow in a translated path`, () => {
			// `manualDiscovery.failed` is prose: the arrows sit between translated
			// words, so the whole run is RTL and a "→" would point back the way
			// the reader came. Only this key is asserted — see the block comment
			// below for the two where the answer is genuinely different.
			const value = LOCALE_TABLES[fileId]["manualDiscovery.failed"];
			assert.ok(value !== undefined, "manualDiscovery.failed is untranslated");
			assert.ok(value.includes("←"), "expected ← in an RTL path");
			assert.ok(!value.includes("→"), "found an unmirrored →");
		});
	}

	/**
	 * The other half, and the reason the suite above is direction-agnostic.
	 *
	 * `vault.idsUpdated` / `vault.titlesUpdated` read `{{oldIds}} → {{newId}}`,
	 * and both placeholders are callout ids — normally Latin. The Unicode bidi
	 * algorithm resolves a neutral character between two left-to-right runs as
	 * left-to-right too (UAX #9, rule N1), so that fragment renders LTR *inside*
	 * an RTL sentence, and `→` is the glyph that points from the old id to the
	 * new one there. Mirroring it to `←` renders "old ← new": an arrow pointing
	 * from the replacement back to the thing it replaced, which is the opposite
	 * of what the sentence says. Hebrew already had this right; Arabic and
	 * Persian did not, and this is what pins it for all three.
	 *
	 * The distinction against `manualDiscovery.failed` is the whole point: there the
	 * arrows sit between *translated words*, the run is RTL, and `←` is correct.
	 * Direction here is decided by what surrounds the arrow, not by the language.
	 */
	for (const fileId of RTL_LOCALES) {
		it(`${fileId}.ts leaves the id-transition arrow pointing forward`, () => {
			for (const key of ["vault.idsUpdated", "vault.titlesUpdated"]) {
				const value = LOCALE_TABLES[fileId][key];
				if (value === undefined) continue;
				assert.ok(
					value.includes("→"),
					`${fileId}.${key} lost the forward arrow between two LTR runs`,
				);
				assert.ok(
					!value.includes("←"),
					`${fileId}.${key} mirrors an arrow between two LTR runs, so it ` +
						`renders "old ← new" — pointing from the new id to the old`,
				);
			}
		});
	}

	it("keeps the two arrow rules from collapsing into one", () => {
		// If every RTL string mirrored, or none did, one of the two suites above
		// would be vacuous and could be deleted without a failure. English is the
		// control: it uses `→` in both places, so the split really is about
		// direction and not about the two keys being different sentences.
		for (const fileId of RTL_LOCALES) {
			assert.ok(LOCALE_TABLES[fileId]["manualDiscovery.failed"]?.includes("←"));
			assert.ok(LOCALE_TABLES[fileId]["vault.idsUpdated"]?.includes("→"));
		}
		assert.ok(en["manualDiscovery.failed"]?.includes("→"));
		assert.ok(en["vault.idsUpdated"]?.includes("→"));
	});
});
