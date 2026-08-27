/**
 * tests/welcomeSample.test.ts — the splash screen's self-describing sample.
 *
 * The welcome modal is the one place in the plugin whose *content* is a claim
 * about the plugin. It renders a markdown sample through a real embedded
 * editor, and that sample is supposed to show all three render roles at once —
 * so if the sample stops parsing as three roles, the splash silently starts
 * advertising two, or one, and nothing else in the suite notices.
 *
 * It shipped that way twice over:
 *
 * - The three examples used `tip`, `warning` and `note`. Those are real
 *   built-ins and exactly the ids a theme restyles by name, so on several
 *   popular themes the heading and inline examples were unreadable. Worse, the
 *   plugin hands an *unmodified* built-in to Obsidian's own `--callout-tip`
 *   variable rather than a hex, so the splash was advertising the theme's
 *   colours rather than its own. They are now one demo id of the splash's own.
 * - The inline example was a bare `[!warning]` pill, written before the `{…}`
 *   payload existed. It demonstrated syntax rather than the syntax users get.
 *
 * Both halves are pinned as facts about the string, plus the two structural
 * invariants that are easy to break while translating and impossible to see in
 * review: the payload brace must touch its `]`, and the sample must end outside
 * a block callout.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { en } from "../src/i18n/en";
import { RESERVED_DEMO_IDS, WELCOME_DEMO_ID } from "../src/constants";
import { sanitizeCalloutIdInput } from "../src/utils/calloutId";
import { buildWelcomeDemoDefinition } from "../src/settings/welcomeDemo";
import {
	scanLineForCalloutTokens,
	type LineCalloutToken,
} from "../src/editor/calloutTokens";

const RAW = en["welcome.sample"] as string;

/** The sample as the modal renders it. */
const SAMPLE = RAW.replace(/\{\{id\}\}/g, WELCOME_DEMO_ID).replace(
	/\{\{repoUrl\}\}/g,
	"https://github.com/Niv20/obsidian-plugin-callout-studio",
);

/** Every callout token in the sample, in document order. */
function tokens(): LineCalloutToken[] {
	return SAMPLE.split("\n").flatMap((line) =>
		scanLineForCalloutTokens(line, { inlineContent: true }),
	);
}

/* -------------------------------------------------------------------------- */
/* The copy                                                                   */
/* -------------------------------------------------------------------------- */

describe("the welcome sample's copy", () => {
	it("calls the heading example 'Heading Callout', with no 'As a' prefix", () => {
		assert.ok(
			SAMPLE.includes("Heading Callout"),
			"the heading example lost its name",
		);
		assert.ok(
			!/As a Heading Callout/i.test(SAMPLE),
			"the retired 'As a' prefix is back",
		);
	});

	it("names all three roles", () => {
		for (const name of [
			"Heading Callout",
			"Inline Callout",
			"Block Callout",
		]) {
			assert.ok(SAMPLE.includes(name), name);
		}
	});

	it("still links to the repo through the interpolated placeholder", () => {
		// Hard-coding the URL in the string would put it in 31 translations,
		// where a stale copy of it would outlive every rename of the repo.
		assert.ok(
			RAW.includes("{{repoUrl}}"),
			"welcome.sample lost {{repoUrl}}",
		);
		assert.ok(/\[Learn more\]\(https:\/\/github\.com\//.test(SAMPLE));
	});
});

/* -------------------------------------------------------------------------- */
/* The demo id                                                                */
/* -------------------------------------------------------------------------- */

describe("the welcome sample styles itself with its own demo id", () => {
	it("interpolates the id rather than spelling it", () => {
		// A copy of the id inside a translated string is a copy that cannot be
		// found when it changes — and it would be 31 copies.
		assert.ok(RAW.includes("{{id}}"), "welcome.sample lost {{id}}");
		assert.ok(
			!RAW.includes(`[!${WELCOME_DEMO_ID}]`),
			"the demo id is spelled out in the string as well as interpolated",
		);
	});

	// >>> REGRESSION: `demo` is a name a user may already own <<<
	it("is deliberately NOT one of the reserved demo ids", () => {
		// The other two demo ids are spelled with a dash, which
		// `sanitizeCalloutIdInput` folds to a space, so no user can ever mint
		// one and reserving them costs nothing. `demo` is an ordinary word the
		// editor DOES produce, so reserving it would quietly cripple a callout
		// somebody legitimately named "Demo": filtered out of the autocomplete,
		// dropped from their export, rejected by their own re-import — with
		// nothing in the editor telling them the name was taken.
		//
		// The splash gives up permanent reservation and relies on the preview
		// slot instead, which only exists while the modal is open. If someone
		// later "tidies" this into RESERVED_DEMO_IDS, this is the test that
		// should stop them.
		assert.strictEqual(
			RESERVED_DEMO_IDS.has(WELCOME_DEMO_ID),
			false,
			"WELCOME_DEMO_ID was added to RESERVED_DEMO_IDS — read its comment",
		);
		assert.strictEqual(
			sanitizeCalloutIdInput("Demo"),
			WELCOME_DEMO_ID,
			"the premise above changed: the editor no longer mints this id",
		);
	});

	it("uses that id for every one of the three examples", () => {
		const found = tokens().map((t) => t.rawId);
		assert.deepStrictEqual(
			[...new Set(found)],
			[WELCOME_DEMO_ID],
			`sample references ${found.join(", ")}`,
		);
	});

	// >>> REGRESSION: the theme-override report <<<
	it("references none of the built-ins it used to borrow", () => {
		// Stated against the raw string, not the token scan: a stray `[!tip]`
		// inside inline code or prose would still read as an example to a user
		// even though the tokenizer skips it.
		for (const builtIn of ["tip", "warning", "note"]) {
			assert.ok(
				!RAW.includes(`[!${builtIn}]`),
				`welcome.sample still demonstrates the built-in \`${builtIn}\`, ` +
					"which any theme may restyle by name",
			);
		}
	});

	it("is demonstrated by a definition that is not a real callout", () => {
		const demo = buildWelcomeDemoDefinition();
		assert.strictEqual(demo.id, WELCOME_DEMO_ID);
		assert.strictEqual(demo.builtIn, false);
		// A collapsible splash that opens collapsed has stopped demonstrating
		// anything.
		assert.strictEqual(demo.foldable, false);
		// Distinct colours per mode: one mid-violet cannot clear contrast
		// against both a white and a near-black surface.
		assert.notStrictEqual(demo.colorLight, demo.colorDark);
		for (const colour of [demo.colorLight, demo.colorDark]) {
			assert.match(colour, /^#[0-9a-fA-F]{6}$/, colour);
		}
	});
});

/* -------------------------------------------------------------------------- */
/* The syntax it demonstrates                                                 */
/* -------------------------------------------------------------------------- */

describe("the welcome sample parses as all three roles", () => {
	it("yields exactly one heading, one inline and one regular token", () => {
		const byRole = tokens().reduce<Record<string, number>>((acc, t) => {
			acc[t.role] = (acc[t.role] ?? 0) + 1;
			return acc;
		}, {});
		assert.deepStrictEqual(byRole, { heading: 1, inline: 1, regular: 1 });
	});

	// >>> REGRESSION: the inline example predated the `{…}` payload <<<
	it("gives the inline example a `{…}` payload", () => {
		const inline = tokens().find((t) => t.role === "inline");
		assert.ok(inline, "no inline token in the sample");
		assert.ok(
			inline.content !== undefined,
			"the inline example is still a bare pill, not `[!id]{text}`",
		);
	});

	it("also shows the bare `[!type]{text}` form as literal text", () => {
		// The sentence teaches the syntax as well as showing it; the literal
		// form lives in inline code, so the tokenizer must not have counted it
		// as a fourth token above.
		assert.ok(SAMPLE.includes("`[!type]{text}`"));
	});

	it("puts no space between `]` and `{`", () => {
		// `matchInlineContent` requires them to touch. A translator who adds a
		// space turns the payload into literal prose, and the splash then shows
		// a bare pill followed by a stray `{Inline Callout}`.
		assert.ok(
			!/\]\s+\{/.test(SAMPLE),
			"a space crept between `]` and `{`, which makes the payload literal",
		);
	});
});

/* -------------------------------------------------------------------------- */
/* The structural invariant the preview depends on                            */
/* -------------------------------------------------------------------------- */

describe("the welcome sample ends where the caret can be parked", () => {
	// `EmbeddableMarkdownEditor.parkCursor` moves the caret to the end of the
	// document on build, reseed and blur, and it must not land inside a `> [!id]`
	// block: Obsidian then caches a hanging-indent width measured against the
	// collapsed widget and applies it to the raw source lines, squeezing every
	// wrapped row to about one character. So the sample has to end outside one.
	it("has a last non-empty line that is not part of a block callout", () => {
		const lines = SAMPLE.split("\n").filter((l) => l.trim().length > 0);
		const last = lines[lines.length - 1] as string;
		assert.ok(
			!/^\s*>/.test(last),
			`sample ends inside a block callout: ${JSON.stringify(last)}`,
		);
	});
});
