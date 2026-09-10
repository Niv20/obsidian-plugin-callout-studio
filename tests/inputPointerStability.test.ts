/**
 * tests/inputPointerStability.test.ts — a field must not flinch at the mouse.
 *
 * Obsidian paints every text field on hover:
 *
 *   input[type='text']:hover { border-color: var(--background-modifier-border-hover);
 *                              background-color: var(--background-modifier-form-field-hover) }
 *
 * That selector is **(0,2,1)**, and it is the one number every rule in this
 * plugin that repaints a field's box has to clear. A rule that paints its own
 * border and background but scores at or below (0,2,1) does not get a field of
 * its own — it gets a field Obsidian repaints from under it the moment the
 * pointer crosses it, while the rows above and below (whose rules do clear it)
 * sit still. That is not a colour bug, it is two controls in one column
 * disagreeing about whether the mouse is worth reacting to.
 *
 * Three fields have fallen into this, one for the opposite reason of the
 * other two:
 *
 * - **The Callout IDs field** painted its own box and lost.
 *   `.cs-tag-input-row > .cs-tag-input-field` was two classes, (0,2,0), one
 *   short of (0,2,1). It repainted its border on hover; the display name field
 *   directly above it — (0,4,1) — did not, and the two are deliberately styled
 *   as one control. Fixed by adding `input[type="text"]` to the selector.
 * - **The palette editor's Name field** and **the icon picker's search box**
 *   painted no box at all. Both are bare `input[type="text"]` with no plugin
 *   rule of their own, so each fell straight through to Obsidian's hover rule
 *   and repainted every time — while the callout editor's fields, opened
 *   moments earlier or later in the same session, sat still. Fixed the other
 *   way round: giving each a scoped rule that clears the bar, rather than
 *   removing one that didn't. Two separate fixes on two separate visits, not
 *   one pass over every bare field in the plugin — see the icon picker's own
 *   describe block below for the fields still left that way on purpose, and
 *   why that is now an open question rather than a closed one.
 *
 * Either shape reads the same way from the arithmetic, so the test is the
 * arithmetic rather than the text: every rule that claims a field's box has to
 * outrank the hover rule, and each state layer has to outrank the base it
 * refines. Written that way, it also catches the second half of the trap —
 * raising a base rule above hover without raising `:focus` with it silently
 * hands the base the focused border too, and a state carved out with `:not()`
 * (the palette Name field's `.cs-input-invalid` — see below) has to be raised
 * on *its own* terms rather than inheriting the base's.
 *
 * What this file cannot see is the cascade actually running; it is arithmetic
 * over the stylesheet, not a rendering test. The rendering was checked by hand
 * against real `app.css` in headless Chrome, forcing `:hover`/`:focus` on the
 * fields and diffing their computed styles in both themes.
 *
 * A tooling footnote worth recording here rather than only in a commit: the
 * file this test's second case lives in, `src/settings/PaletteEditorModal.ts`,
 * is flagged `data` rather than `ASCII text` by `file(1)` — something in it
 * (not a NUL byte; never isolated further) makes BSD `grep` silently treat it
 * as binary and return zero matches for a plain `grep -rn` with no "Binary
 * file matches" notice, no error, nothing. That is what hid `.cs-input-invalid`
 * being wired up to `nameInputEl` in the first place — a repo-wide grep for
 * it during earlier work came back empty and was taken as proof the class was
 * an orphan. `grep -a` (or `ripgrep`, which does not binary-sniff `.ts` files)
 * goes through it fine. If a future search of `src/` comes back suspiciously
 * clean, checking `file` on the files it should have matched is cheap and this
 * is the second time it has mattered.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compareSpecificity, specificityOf } from "../src/utils/cssSpecificity";

const css = readFileSync(join(process.cwd(), "styles.css"), "utf8").replace(
	/\/\*[\s\S]*?\*\//g,
	"",
);

/** Obsidian's own hover rule for a text field — the bar every rule below clears. */
const OBSIDIAN_INPUT_HOVER = specificityOf("input[type='text']:hover");

/** Every selector in `styles.css`, flattened out of any `@media` wrappers. */
function selectors(): string[] {
	const out: string[] = [];
	let depth = 0;
	let buffer = "";
	for (const ch of css) {
		if (ch === "{") {
			depth++;
			if (depth === 1 || buffer.trim().startsWith("@")) {
				// keep scanning; at-rule preludes are not selectors
			}
			if (!buffer.trim().startsWith("@")) out.push(buffer.trim());
			buffer = "";
		} else if (ch === "}") {
			depth--;
			buffer = "";
		} else {
			buffer += ch;
		}
	}
	return out.filter((sel) => sel.length > 0 && !sel.startsWith("@"));
}

const ALL = selectors();

/** The one rule in the file whose selector is exactly `sel`. */
function ruleFor(sel: string): string {
	const hit = ALL.filter((s) => s.replace(/\s+/g, " ") === sel);
	assert.strictEqual(
		hit.length,
		1,
		`expected exactly one rule for \`${sel}\`, found ${hit.length}`,
	);
	const [only] = hit;
	assert.ok(only, `no rule for \`${sel}\``);
	return only;
}

/**
 * The IDs field's three rules, base first. Base has to clear Obsidian's hover;
 * each state layer has to clear the base, or the base takes the state back.
 */
const TAG_FIELD_BASE = '.cs-tag-input-row > input[type="text"].cs-tag-input-field';
const TAG_FIELD_STATES = [":focus", ":disabled"];

describe("the IDs field does not repaint when the pointer crosses it", () => {
	it("its base rule outranks Obsidian's input:hover", () => {
		const base = specificityOf(ruleFor(TAG_FIELD_BASE));
		assert.ok(
			compareSpecificity(base, OBSIDIAN_INPUT_HOVER) > 0,
			`${TAG_FIELD_BASE} is ${JSON.stringify(base)}, which does not ` +
				`outrank input[type='text']:hover ${JSON.stringify(OBSIDIAN_INPUT_HOVER)}. ` +
				`Obsidian will repaint this field's border and background on hover.`,
		);
	});

	for (const state of TAG_FIELD_STATES) {
		it(`its ${state} rule outranks its own base rule`, () => {
			const base = specificityOf(ruleFor(TAG_FIELD_BASE));
			const layered = specificityOf(ruleFor(TAG_FIELD_BASE + state));
			assert.ok(
				compareSpecificity(layered, base) > 0,
				`${TAG_FIELD_BASE}${state} is ${JSON.stringify(layered)} and the ` +
					`base is ${JSON.stringify(base)} — the base wins, so the field ` +
					`keeps its resting box in the ${state} state.`,
			);
		});
	}

	it("the display-name field it is matched to still clears the same bar", () => {
		// The two sit one on top of the other in the callout editor and are
		// deliberately styled as one control. If this one ever drops below the
		// hover rule the pair splits apart again, just the other way round.
		const name = ALL.find((s) =>
			/^\.callout-studio-editor\s+\.setting-item-control\s+input\[type="text"\]:not\([^)]*\)$/.test(
				s.replace(/\s+/g, " "),
			),
		);
		assert.ok(name, "the callout editor's display-name rule went missing");
		assert.ok(
			compareSpecificity(specificityOf(name), OBSIDIAN_INPUT_HOVER) > 0,
			`the display-name rule ${JSON.stringify(specificityOf(name))} no ` +
				`longer outranks Obsidian's hover rule`,
		);
	});
});

/**
 * The palette editor's Name field, opened from "Saved color palettes" in
 * settings. Unlike the tag field above, this one started with *no* rule of
 * its own — a bare `input[type="text"]` styled entirely by Obsidian — so it
 * had nothing to lose to the hover rule until a rule was added. The fix and
 * the test are both about that new rule clearing the bar, and about the one
 * state it deliberately does not touch.
 */
const PALETTE_NAME_BASE =
	'.callout-studio-palette-editor .cs-palette-name-setting .setting-item-control input[type="text"]:not(.cs-input-invalid)';

describe("the palette editor's Name field does not repaint when the pointer crosses it", () => {
	it("its base rule outranks Obsidian's input:hover", () => {
		const base = specificityOf(ruleFor(PALETTE_NAME_BASE));
		assert.ok(
			compareSpecificity(base, OBSIDIAN_INPUT_HOVER) > 0,
			`${PALETTE_NAME_BASE} is ${JSON.stringify(base)}, which does not ` +
				`outrank input[type='text']:hover ${JSON.stringify(OBSIDIAN_INPUT_HOVER)}.`,
		);
	});

	it("its :focus rule outranks its own base rule", () => {
		const base = specificityOf(ruleFor(PALETTE_NAME_BASE));
		const layered = specificityOf(ruleFor(PALETTE_NAME_BASE + ":focus"));
		assert.ok(
			compareSpecificity(layered, base) > 0,
			`${PALETTE_NAME_BASE}:focus is ${JSON.stringify(layered)} and the ` +
				`base is ${JSON.stringify(base)} — the base wins, so the field ` +
				`keeps its resting border while focused.`,
		);
	});

	it("its own rules leave `.cs-input-invalid` alone to win the duplicate-name state", () => {
		// `updateValidity()` (PaletteEditorModal.ts) toggles `cs-input-invalid`
		// on this same input to turn its border red for a taken name. The base
		// rule above excludes it with `:not()`, which only works if nothing in
		// *this* describe block also happens to match a `.cs-input-invalid`
		// element — confirming the `:not()` is present in both rules' selector
		// text is what actually proves that, rather than assuming the literal
		// string survived a copy-paste.
		for (const sel of [PALETTE_NAME_BASE, PALETTE_NAME_BASE + ":focus"]) {
			assert.ok(
				sel.includes(":not(.cs-input-invalid)"),
				`${sel} must exclude .cs-input-invalid or it will outrank the ` +
					`duplicate-name error's own border-color`,
			);
		}
	});
});

/**
 * The icon picker's search box — the toolbar at the top of every source panel
 * (PackPanel: Lucide, Tabler, Material, Font Awesome, emoji, the pooled "All
 * sources" list; ImagePanel: "Your images"), all sharing one
 * `.icon-picker-search-input` class. Same shape of bug as the palette Name
 * field: no rule of its own, so it fell straight through to Obsidian's hover
 * rule and repainted mid-search, unfocused, while the callout editor's fields
 * sat still beside it.
 */
const ICON_SEARCH_BASE =
	'.icon-picker-toolbar input[type="text"].icon-picker-search-input';

describe("the icon picker's search box does not repaint when the pointer crosses it", () => {
	it("its base rule outranks Obsidian's input:hover", () => {
		const base = specificityOf(ruleFor(ICON_SEARCH_BASE));
		assert.ok(
			compareSpecificity(base, OBSIDIAN_INPUT_HOVER) > 0,
			`${ICON_SEARCH_BASE} is ${JSON.stringify(base)}, which does not ` +
				`outrank input[type='text']:hover ${JSON.stringify(OBSIDIAN_INPUT_HOVER)}.`,
		);
	});

	it("its :focus rule outranks its own base rule", () => {
		const base = specificityOf(ruleFor(ICON_SEARCH_BASE));
		const layered = specificityOf(ruleFor(ICON_SEARCH_BASE + ":focus"));
		assert.ok(
			compareSpecificity(layered, base) > 0,
			`${ICON_SEARCH_BASE}:focus is ${JSON.stringify(layered)} and the ` +
				`base is ${JSON.stringify(base)} — the base wins, so the field ` +
				`keeps its resting border while focused.`,
		);
	});
});

/**
 * `.cs-input-invalid` — the duplicate-name error state on the same field. It
 * carries the plugin's own red border and ring, but at its original,
 * undoubled specificity that border lost to Obsidian's hover rule exactly
 * like the two fields above did: hovering a field already flagged as a
 * duplicate name faded its red border to Obsidian's ordinary hover grey for
 * as long as the pointer sat over it. Tripling the class (see styles.css) is
 * what clears the bar outright instead of tying it and leaning on stylesheet
 * load order.
 */
describe("the duplicate-name error state does not fade when the pointer crosses it", () => {
	it("every branch of its selector list outranks Obsidian's input:hover", () => {
		// A comma-joined rule, found by pattern rather than `ruleFor` because
		// `ruleFor` expects an exact-match query and this rule's two branches
		// (rest, `:focus`) would have to be reproduced whitespace-for-whitespace
		// to query as one string. Each branch is checked on its own: a merely
		// hovered, not-yet-focused field matches only the rest branch, so that
		// one losing is exactly the bug this rule exists to prevent.
		const rule = ALL.find((s) =>
			/^input\.cs-input-invalid\.cs-input-invalid\.cs-input-invalid(,\s*input\.cs-input-invalid\.cs-input-invalid\.cs-input-invalid:focus)?$/.test(
				s.replace(/\s+/g, " "),
			),
		);
		assert.ok(rule, "the duplicate-name error rule went missing or changed shape");
		const branches = rule.split(",").map((one) => specificityOf(one.trim()));
		assert.ok(branches.length >= 1, "expected at least one selector branch");
		for (const spec of branches) {
			assert.ok(
				compareSpecificity(spec, OBSIDIAN_INPUT_HOVER) > 0,
				`a branch of \`${rule}\` is ${JSON.stringify(spec)}, which does not ` +
					`outrank input[type='text']:hover ${JSON.stringify(OBSIDIAN_INPUT_HOVER)}. ` +
					`A duplicate-name field would fade to grey on hover.`,
			);
		}
	});
});

describe("no rule paints a field's box from below Obsidian's hover rule", () => {
	/**
	 * The same trap, swept across the file. The scope is a **named list of this
	 * plugin's text fields** rather than a pattern over selectors, and that is
	 * deliberate: the first version of this test matched any selector with
	 * `input` or `field` in it and immediately flagged three things that are not
	 * text fields at all — a `<label>` wrapper, an `input[type="color"]`, and a
	 * `<code>` element in the import report. None of them can be touched by a
	 * rule aimed at `input[type='text']`, so all three were noise, and noise in a
	 * ratchet is how a ratchet stops being read.
	 *
	 * A list has to be maintained, which is the point: a new text field is a
	 * deliberate addition here, and adding it is when someone decides whether it
	 * paints its own box or falls through to Obsidian.
	 *
	 * `.cs-combobox-input` is exempt by construction rather than by score. It
	 * paints itself down to *nothing* so its wrapper can be the visible box, and
	 * it neutralises `:hover` explicitly in the same rule list — losing to
	 * Obsidian's hover is impossible when the declarations are `border: 0;
	 * background: transparent`.
	 *
	 * `.cs-input-invalid` is IN the list, not exempt from it — it was believed
	 * to be an orphan rule (a repo-wide `grep -r cs-input-invalid src/` came
	 * back empty) until the "does not fade" describe block above was written
	 * and found it wired up in `PaletteEditorModal.ts` all along; see the file
	 * header for why that grep lied. Its own selector doesn't literally contain
	 * `input[type="text"]`, so this substring-based sweep would not have caught
	 * it even now — it stays named here mainly so a reader scanning this list
	 * for "which fields does this file know about" finds it, and the real
	 * coverage is the dedicated describe block above, which checks every
	 * branch of its (comma-joined) selector rather than one substring match.
	 */
	const TEXT_FIELDS = [
		".cs-tag-input-field",
		".cs-quick-insert-search",
		".icon-picker-search-input",
		".callout-studio-replace-search",
		".cs-input-invalid",
		'input[type="text"]',
	];
	const EXEMPT = [".cs-combobox-input"];

	it("every rule that paints one of the plugin's text fields clears (0,2,1)", () => {
		const rules: { selector: string; body: string }[] = [];
		const re = /([^{}]+)\{([^{}]*)\}/g;
		let m: RegExpExecArray | null;
		while ((m = re.exec(css)) !== null) {
			const selector = (m[1] ?? "").trim().replace(/\s+/g, " ");
			if (!selector || selector.startsWith("@")) continue;
			rules.push({ selector, body: m[2] ?? "" });
		}

		const offenders = rules.filter(({ selector, body }) => {
			if (!TEXT_FIELDS.some((cls) => selector.includes(cls))) return false;
			if (EXEMPT.some((cls) => selector.includes(cls))) return false;
			// Only the two properties Obsidian's hover rule sets can be taken
			// away by it; a rule that sets neither cannot lose anything visible.
			if (!/(?:^|;|\s)(?:border|background)(?:-color)?\s*:/.test(body)) {
				return false;
			}
			return selector
				.split(",")
				.map((one) => specificityOf(one.trim()))
				.some((spec) => compareSpecificity(spec, OBSIDIAN_INPUT_HOVER) <= 0);
		});

		assert.deepStrictEqual(
			offenders.map((o) => o.selector),
			[],
			"these rules paint a text field's border or fill but lose to " +
				"Obsidian's input[type='text']:hover, so the pointer repaints them",
		);
	});
});
