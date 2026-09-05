/**
 * tests/autoComplete.test.ts — the `[!` popover.
 *
 * `CalloutAutoComplete` is three decisions wearing an `EditorSuggest`:
 *
 * 1. **`onTrigger` classifies a position into a render role.** Where the `[!`
 *    sits on the line is the *only* input: after a blockquote prefix it is a
 *    block header, after heading hashes a heading callout, anywhere else an
 *    inline pill. Getting that wrong does not merely show the wrong list — the
 *    role decides what `selectSuggestion` writes and where the cursor lands
 *    afterwards, so a misclassification rewrites the user's line as the wrong
 *    kind of callout.
 *    It also decides *whether* there is a callout to classify at all: a `[!`
 *    inside inline code or a fenced block is code, and opening there is how a
 *    note that documents callout syntax gets rewritten into one that uses it.
 * 2. **It stops filtering once the cursor leaves the id.** The dropdown has no
 *    say over metadata, the fold mark or the title, so it closes rather than
 *    matching on them — and it reads the token body to its `]` rather than to
 *    the cursor, so a cursor parked mid-token still filters on the whole id.
 * 3. **`getSuggestions` is the same usable-callout list AutoComplete shares with
 *    the public API**, plus one synthetic "Create new" row that appears only
 *    when the typed text names nothing that already exists.
 *
 * `selectSuggestion` is checked through the text it writes, per role, including
 * the two carry-overs that are easy to lose: a `|metadata` the user already
 * typed belongs to the occurrence rather than to the type, and an alias the user
 * typed is the spelling that should be written back.
 *
 * Not covered here, deliberately: the deferred cursor placement in `close()`
 * (a `requestAnimationFrame` + 50ms `setTimeout` chain), and the "Create new"
 * round trip, which opens a real modal. Both are wiring around the decisions
 * above rather than decisions of their own.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
// Listed first: importing it installs the DOM globals before anything under
// test loads (see tests/support/fakeDom.ts).
import { asEl, el, fakeDom } from "./support/fakeDom";
import { asEditor, editor, FakeEditor } from "./support/fakeEditor";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { CalloutAutoComplete } from "../src/editor/AutoComplete";
import { CSS_ICON_NONE } from "../src/icons/renderIcon";

type Registry = InstanceType<typeof CalloutRegistry>;
type Suggest = InstanceType<typeof CalloutAutoComplete>;

/* -------------------------------------------------------------------------- */
/* Harness                                                                    */
/* -------------------------------------------------------------------------- */

interface Harness {
	registry: Registry;
	settings: Registry["settings"];
	suggest: Suggest;
	/** Fallback ids Discovery has confirmed are used nowhere in the vault. */
	zeroUsage: Set<string>;
}

function harness(): Harness {
	const registry = new CalloutRegistry();
	registry.load(null);
	const zeroUsage = new Set<string>();
	const plugin = {
		app: { workspace: { getLeavesOfType: () => [] } },
		registry,
		settings: registry.settings,
		isKnownZeroUsageFallback: (id: string) => zeroUsage.has(id),
	};
	return {
		registry,
		settings: registry.settings,
		suggest: new CalloutAutoComplete(plugin as never),
		zeroUsage,
	};
}

function addCallout(
	registry: Registry,
	over: Partial<Parameters<Registry["add"]>[0]> = {},
): void {
	registry.add({
		id: "quiet",
		displayName: "Quiet",
		icon: { type: "lucide", value: "pencil" },
		colorLight: "#336699",
		colorDark: "#88bbee",
		foldable: false,
		defaultFolded: false,
		builtIn: false,
		source: "user",
		...over,
	});
}

/**
 * Run `onTrigger` for a document with `⎸` marking the cursor. Most sources here
 * are a single line, but the code-context guard reads the lines above the
 * cursor, so `⎸` is located in the whole buffer rather than assumed to be on
 * line 0. Returns the trigger info, or null when the popover would not open.
 */
function triggerAt(
	h: Harness,
	source: string,
): {
	info: ReturnType<Suggest["onTrigger"]>;
	editor: FakeEditor;
	line: number;
	ch: number;
} {
	const marker = source.indexOf("⎸");
	assert.notStrictEqual(marker, -1, "the source needs a ⎸ cursor mark");
	const before = source.slice(0, marker);
	const line = (before.match(/\n/g) ?? []).length;
	const ch = before.length - (before.lastIndexOf("\n") + 1);
	const ed = editor(source.replace("⎸", ""));
	const info = h.suggest.onTrigger({ line, ch }, asEditor(ed), null);
	return { info, editor: ed, line, ch };
}

/** `onTrigger`, then `selectSuggestion` on one definition. Returns the buffer. */
function pick(h: Harness, source: string, calloutId: string): FakeEditor {
	const { info, editor: ed, line, ch } = triggerAt(h, source);
	assert.ok(info, "expected the popover to open");
	const def = h.registry.get(calloutId);
	assert.ok(def, `no callout "${calloutId}"`);

	(h.suggest as unknown as { context: unknown }).context = {
		editor: asEditor(ed),
		file: null,
		start: info.start,
		end: { line, ch },
		query: info.query,
	};
	// The fake `MouseEvent` takes no arguments; only `instanceof KeyboardEvent`
	// is a live branch in selectSuggestion, and this must not satisfy it.
	const MouseEventCtor = (
		globalThis as unknown as { MouseEvent: new () => MouseEvent }
	).MouseEvent;
	h.suggest.selectSuggestion(def, new MouseEventCtor());
	return ed;
}

/* -------------------------------------------------------------------------- */
/* onTrigger — role classification                                             */
/* -------------------------------------------------------------------------- */

describe("onTrigger — when it opens at all", () => {
	it("stays shut while the feature is off", () => {
		const h = harness();
		h.settings.autocomplete.enabled = false;
		assert.strictEqual(triggerAt(h, "> [!⎸").info, null);
	});

	it("stays shut on a line with no token", () => {
		const h = harness();
		assert.strictEqual(triggerAt(h, "just prose⎸").info, null);
		assert.strictEqual(triggerAt(h, "> quoted⎸").info, null);
	});

	it("stays shut for an escaped token", () => {
		const h = harness();
		assert.strictEqual(triggerAt(h, "\\[!⎸").info, null);
	});

	it("stays shut inside a wikilink", () => {
		const h = harness();
		assert.strictEqual(triggerAt(h, "[[!⎸").info, null);
		assert.strictEqual(triggerAt(h, "see [[!note⎸").info, null);
	});

	it("anchors `start` on the `[!` it matched", () => {
		// Every rewrite below replaces from here, so an anchor off by one eats a
		// character of the user's own text.
		const h = harness();
		const { info } = triggerAt(h, "> [!no⎸");
		assert.deepStrictEqual(info?.start, { line: 0, ch: 2 });
		assert.strictEqual(info?.end.ch, 6);
	});
});

describe("onTrigger — the three roles", () => {
	it("treats a blockquote prefix as a block header", () => {
		const h = harness();
		// Observable through what a pick then writes: a block header is the only
		// role that carries a title.
		assert.strictEqual(pick(h, "> [!⎸", "note").getValue(), "> [!note] Note");
		assert.strictEqual(pick(h, ">> [!⎸", "note").getValue(), ">> [!note] Note");
		assert.strictEqual(
			pick(h, "> > [!⎸", "note").getValue(),
			"> > [!note] Note",
		);
	});

	it("treats heading hashes as a heading callout", () => {
		const h = harness();
		// No title text and no fold mark — the rendered token shows the name.
		assert.strictEqual(pick(h, "## [!⎸", "note").getValue(), "## [!note]");
		assert.strictEqual(pick(h, "###### [!⎸", "note").getValue(), "###### [!note]");
	});

	it("keeps the popover shut for a heading while the role is off", () => {
		const h = harness();
		h.settings.headingCallouts.enabled = false;
		assert.strictEqual(triggerAt(h, "## [!⎸").info, null);
	});

	it("treats a bare token at line start as an inline pill", () => {
		const h = harness();
		assert.strictEqual(pick(h, "[!⎸", "note").getValue(), "[!note] ");
	});

	it("falls back to the block reading at line start when inline is off", () => {
		// The pre-inline behaviour exactly: `[!` alone used to mean a block
		// callout, and turning the role off must not change what that line does.
		const h = harness();
		h.settings.inlineCallouts.enabled = false;
		assert.strictEqual(pick(h, "[!⎸", "note").getValue(), "[!note] Note");
	});

	it("treats a mid-line token as an inline pill", () => {
		const h = harness();
		assert.strictEqual(
			pick(h, "text before [!⎸", "note").getValue(),
			"text before [!note] ",
		);
	});

	it("keeps the popover shut mid-line while the inline role is off", () => {
		const h = harness();
		h.settings.inlineCallouts.enabled = false;
		assert.strictEqual(triggerAt(h, "text before [!⎸").info, null);
	});

	it("requires whitespace after the hashes to read as a heading", () => {
		// `##[!` is not a heading in markdown, so it falls through to inline.
		const h = harness();
		assert.strictEqual(pick(h, "##[!⎸", "note").getValue(), "##[!note] ");
	});
});

/* -------------------------------------------------------------------------- */
/* onTrigger — the query                                                       */
/* -------------------------------------------------------------------------- */

describe("onTrigger — the query", () => {
	it("is empty right after the `[!`", () => {
		const h = harness();
		assert.strictEqual(triggerAt(h, "> [!⎸").info?.query, "");
	});

	it("is whatever has been typed into the id", () => {
		const h = harness();
		assert.strictEqual(triggerAt(h, "> [!warn⎸").info?.query, "warn");
	});

	it("reads the whole token body, not just up to the cursor", () => {
		// `[!dang⎸aaaaa]` must offer "Create new: dangaaaaa", not match "Danger".
		const h = harness();
		assert.strictEqual(triggerAt(h, "> [!dang⎸aaaaa]").info?.query, "dangaaaaa");
	});

	it("stops at the pipe — metadata is not part of the type", () => {
		const h = harness();
		assert.strictEqual(triggerAt(h, "> [!note⎸|purple]").info?.query, "note");
	});

	it("closes once the cursor moves past the id", () => {
		const h = harness();
		assert.strictEqual(triggerAt(h, "> [!note]⎸").info, null, "past the `]`");
		assert.strictEqual(triggerAt(h, "> [!note|pu⎸rple]").info, null, "in metadata");
		assert.strictEqual(triggerAt(h, "> [!note] Ti⎸tle").info, null, "in the title");
		assert.strictEqual(triggerAt(h, "> [!note]-⎸").info, null, "on the fold mark");
	});

	it("stays open with the cursor exactly at the end of the id", () => {
		const h = harness();
		assert.strictEqual(triggerAt(h, "> [!note⎸]").info?.query, "note");
	});

	it("reads to end-of-line when the token was never closed", () => {
		const h = harness();
		assert.strictEqual(triggerAt(h, "> [!warn⎸").info?.query, "warn");
	});

});

/* -------------------------------------------------------------------------- */
/* onTrigger — code is not callout syntax                                      */
/* -------------------------------------------------------------------------- */

/**
 * The popover used to be the one surface that read a `[!` in code as callout
 * syntax. That is worse than a stray dropdown: picking a row rewrites the token
 * *and* `close()` then pushes a `> ` prefix onto the following line, so a note
 * documenting callout syntax gets edited into one that uses it.
 *
 * It now asks the same two questions the rest of the codebase asks —
 * `stripInlineCode` for the line, `createDocumentLineFilter` for the document —
 * so the answers cannot drift from what discovery, the statistics scan and the
 * vault rewriters see.
 */
describe("onTrigger — code is not callout syntax", () => {
	it("stays shut inside an inline code span", () => {
		const h = harness();
		assert.strictEqual(triggerAt(h, "`> [!no⎸`").info, null);
		assert.strictEqual(triggerAt(h, "prose `[!no⎸te]` prose").info, null);
	});

	it("still opens beside one, on the same line", () => {
		// The span is blanked in place, so the guard has to answer for the
		// token's own offset rather than for the line as a whole.
		const h = harness();
		assert.ok(triggerAt(h, "`code` then [!no⎸").info);
	});

	it("stays shut inside a fenced block", () => {
		const h = harness();
		assert.strictEqual(
			triggerAt(h, "```markdown\n> [!no⎸\n```").info,
			null,
			"backtick fence",
		);
		assert.strictEqual(
			triggerAt(h, "~~~\n> [!no⎸\n~~~").info,
			null,
			"tilde fence",
		);
		assert.strictEqual(
			triggerAt(h, "> ```\n> > [!no⎸\n> ```").info,
			null,
			"fence nested in a blockquote",
		);
	});

	it("opens again below a fence that closed", () => {
		const h = harness();
		assert.ok(triggerAt(h, "```\ncode\n```\n\n> [!no⎸").info);
	});

	it("takes the longer marker run to close a fence", () => {
		// ``` inside a ```` block is content, not the closer — so the line after
		// it is still code.
		const h = harness();
		assert.strictEqual(
			triggerAt(h, "````\n```\n> [!no⎸").info,
			null,
		);
	});

	it("stays shut in YAML frontmatter", () => {
		const h = harness();
		assert.strictEqual(triggerAt(h, "---\ntag: [!no⎸\n---").info, null);
	});

	it("does not read indentation as code", () => {
		// Four spaces is an indented code block only at the top level; the same
		// line under a list item is an ordinary blockquote, and nothing else that
		// reads this syntax treats indentation as code either. Suppressing here
		// would create the asymmetry rather than remove it.
		const h = harness();
		assert.ok(triggerAt(h, "- item\n    > [!no⎸").info);
	});
});

/* -------------------------------------------------------------------------- */
/* getSuggestions                                                              */
/* -------------------------------------------------------------------------- */

describe("getSuggestions", () => {
	const context = (query: string) =>
		({ query }) as Parameters<Suggest["getSuggestions"]>[0];

	const ids = (h: Harness, query: string): string[] =>
		h.suggest
			.getSuggestions(context(query))
			.map((item) =>
				"__createNew" in item ? `+${item.query}` : item.id,
			);

	it("offers every usable callout for an empty query", () => {
		const h = harness();
		const offered = ids(h, "");
		assert.ok(offered.includes("note"));
		assert.ok(offered.includes("warning"));
		assert.ok(!offered.some((id) => id.startsWith("+")), "no create-new row");
	});

	it("matches on the id, the display name and any alias", () => {
		const h = harness();
		addCallout(h.registry, {
			id: "hushed",
			displayName: "Library Voice",
			aliases: ["shh"],
		});

		assert.ok(ids(h, "hush").includes("hushed"));
		assert.ok(ids(h, "library").includes("hushed"));
		assert.ok(ids(h, "shh").includes("hushed"));
	});

	it("matches anywhere in the string, not only at the start", () => {
		const h = harness();
		addCallout(h.registry, { id: "hushed", displayName: "Hushed" });
		assert.ok(ids(h, "ush").includes("hushed"));
	});

	it("ignores case on both sides", () => {
		const h = harness();
		addCallout(h.registry, { id: "hushed", displayName: "Hushed" });
		assert.ok(ids(h, "HUSH").includes("hushed"));
	});

	it("sorts by display name", () => {
		const h = harness();
		const names = h.suggest
			.getSuggestions(context(""))
			.filter((item) => !("__createNew" in item))
			.map((item) => (item as { displayName: string }).displayName);

		assert.deepStrictEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
	});

	it("appends a Create-new row when nothing matches the typed id exactly", () => {
		const h = harness();
		const offered = ids(h, "brandnew");
		assert.strictEqual(offered.at(-1), "+brandnew");
	});

	it("appends nothing when the query names an existing id or alias", () => {
		const h = harness();
		addCallout(h.registry, { id: "hushed", aliases: ["shh"] });

		assert.ok(!ids(h, "note").some((id) => id.startsWith("+")));
		assert.ok(!ids(h, "NOTE").some((id) => id.startsWith("+")));
		assert.ok(!ids(h, "shh").some((id) => id.startsWith("+")));
	});

	it("still appends one when the query only matched a display name", () => {
		// A display-name match is not a usable id, so the user may well be
		// naming something new.
		const h = harness();
		addCallout(h.registry, { id: "hushed", displayName: "Library Voice" });
		assert.ok(ids(h, "library voice").includes("+library voice"));
	});

	it("trims the name it would create, but filters on the raw query", () => {
		const h = harness();
		assert.strictEqual(ids(h, "  spaced  ").at(-1), "+spaced");
	});

	it("appends nothing for a whitespace-only query", () => {
		const h = harness();
		assert.ok(!ids(h, "   ").some((id) => id.startsWith("+")));
	});

	it("offers a manually discovered row even when unused", () => {
		const h = harness();
		h.registry.add({
			id: "ghost",
			displayName: "Ghost",
			icon: { type: "lucide", value: "pencil" },
			colorLight: "#000",
			colorDark: "#fff",
			foldable: false,
			defaultFolded: false,
			builtIn: false,
			source: "fallback",
		});

		assert.ok(ids(h, "ghost").includes("ghost"), "used somewhere: still offered");
		h.zeroUsage.add("ghost");
		assert.ok(ids(h, "ghost").includes("ghost"), "saved rows stay available");
	});
});

/* -------------------------------------------------------------------------- */
/* selectSuggestion                                                            */
/* -------------------------------------------------------------------------- */

describe("selectSuggestion — block header", () => {
	it("writes the token, the fold mark and the display name", () => {
		const h = harness();
		addCallout(h.registry, {
			id: "quiet",
			displayName: "Quiet",
			foldable: true,
			defaultFolded: true,
		});
		assert.strictEqual(pick(h, "> [!qu⎸", "quiet").getValue(), "> [!quiet]- Quiet");
	});

	it("replaces to the end of the line, not just the token", () => {
		const h = harness();
		assert.strictEqual(
			pick(h, "> [!no⎸te] Note", "warning").getValue(),
			"> [!warning] Warning",
		);
	});

	it("keeps a title the user wrote themselves", () => {
		const h = harness();
		assert.strictEqual(
			pick(h, "> [!no⎸] My own words", "note").getValue(),
			"> [!note] My own words",
		);
	});

	it("reads a fold mark already on the line as syntax, not as title", () => {
		// The blockquote half of what `splitFoldMark` decides: here the `-` is
		// Obsidian's fold syntax, so it is consumed and reissued from the picked
		// callout's own defaults — a `-` kept as text would render as a title
		// beginning with a dash. The heading role does the opposite; see the
		// heading suite below.
		const h = harness();
		assert.strictEqual(
			pick(h, "> [!no⎸]- My own words", "note").getValue(),
			"> [!note] My own words",
		);
		addCallout(h.registry, { foldable: true, defaultFolded: true });
		assert.strictEqual(
			pick(h, "> [!qu⎸]+ My own words", "quiet").getValue(),
			"> [!quiet]- My own words",
		);
	});

	it("replaces a title that is only some other callout's display name", () => {
		const h = harness();
		assert.strictEqual(
			pick(h, "> [!no⎸] Warning", "note").getValue(),
			"> [!note] Note",
		);
	});

	it("carries the metadata the occurrence already had", () => {
		const h = harness();
		assert.strictEqual(
			pick(h, "> [!no⎸|purple]", "note").getValue(),
			"> [!note|purple] Note",
		);
	});

	it("writes the alias the user typed, not the canonical id", () => {
		const h = harness();
		addCallout(h.registry, { id: "hushed", displayName: "Hushed", aliases: ["shh"] });
		assert.strictEqual(pick(h, "> [!shh⎸", "hushed").getValue(), "> [!shh] Hushed");
	});

	it("matches an alias by prefix as well as exactly", () => {
		const h = harness();
		addCallout(h.registry, { id: "hushed", displayName: "Hushed", aliases: ["shh"] });
		assert.strictEqual(pick(h, "> [!sh⎸", "hushed").getValue(), "> [!shh] Hushed");
	});

	it("falls back to the definition's own id when the query matched neither", () => {
		const h = harness();
		addCallout(h.registry, { id: "hushed", displayName: "Hushed", aliases: ["shh"] });
		assert.strictEqual(pick(h, "> [!zz⎸", "hushed").getValue(), "> [!hushed] Hushed");
	});
});

describe("selectSuggestion — heading callout", () => {
	it("writes the bare token — the widget already shows the name", () => {
		const h = harness();
		assert.strictEqual(pick(h, "## [!⎸", "note").getValue(), "## [!note]");
	});

	it("keeps a title the user already wrote", () => {
		const h = harness();
		assert.strictEqual(
			pick(h, "## [!no⎸] My section", "note").getValue(),
			"## [!note] My section",
		);
	});

	it("writes no fold mark, whatever the callout's own default is", () => {
		// A heading callout folds through Obsidian's own heading fold; the `+`/`-`
		// syntax belongs to the blockquote form alone.
		const h = harness();
		addCallout(h.registry, { foldable: true, defaultFolded: true });
		assert.strictEqual(pick(h, "## [!qu⎸", "quiet").getValue(), "## [!quiet]");
	});

	it("carries metadata", () => {
		const h = harness();
		assert.strictEqual(
			pick(h, "## [!no⎸|purple]", "note").getValue(),
			"## [!note|purple]",
		);
	});

	it("keeps a title that starts with a dash", () => {
		// The heading role has no fold syntax, so the `-` is the first character
		// of the user's title. `selectSuggestion` reads the mark off through
		// `splitFoldMark`, which is told the role — until it was, the rule lived
		// only in the fact that this role `return`s before the read. See
		// `headingFoldSyntax.test.ts` for the property on its own.
		const h = harness();
		assert.strictEqual(
			pick(h, "## [!no⎸]- My section", "note").getValue(),
			"## [!note] - My section",
		);
	});
});

describe("selectSuggestion — inline pill", () => {
	it("replaces only the token and leaves the rest of the line alone", () => {
		const h = harness();
		assert.strictEqual(
			pick(h, "before [!no⎸] after", "note").getValue(),
			"before [!note] after",
		);
	});

	it("guarantees exactly one space after the pill", () => {
		const h = harness();
		assert.strictEqual(pick(h, "a [!no⎸]", "note").getValue(), "a [!note] ");
		// …and does not add a second one when there already is a space.
		assert.strictEqual(
			pick(h, "a [!no⎸] b", "note").getValue(),
			"a [!note] b",
		);
	});

	it("parks the cursor after that space, so Enter keeps writing on this line", () => {
		const h = harness();
		const ed = pick(h, "a [!no⎸]", "note");
		assert.strictEqual(ed.valueWithCursor(), "a [!note] |");
	});

	it("covers the whole token when the cursor sits mid-id", () => {
		const h = harness();
		assert.strictEqual(pick(h, "a [!n⎸ote] b", "note").getValue(), "a [!note] b");
	});

	it("stops at the cursor when the token was never closed", () => {
		// No `]` to find, so the replacement ends at the trigger-time cursor and
		// the rest of the line is untouched — the space it needs is already there.
		const h = harness();
		assert.strictEqual(pick(h, "a [!no⎸ rest", "note").getValue(), "a [!note] rest");
	});

	it("carries metadata", () => {
		const h = harness();
		assert.strictEqual(
			pick(h, "a [!no⎸|purple] b", "note").getValue(),
			"a [!note|purple] b",
		);
	});
});

/* -------------------------------------------------------------------------- */
/* renderSuggestion                                                            */
/* -------------------------------------------------------------------------- */

describe("renderSuggestion", () => {
	const row = () => asEl(el({ tag: "div" }));

	/** Classes on an element, as an array. */
	const classes = (element: unknown): string[] =>
		(element as { classList: { toArray(): string[] } }).classList.toArray();

	const children = (element: unknown): unknown[] =>
		(element as { children: unknown[] }).children;

	it("paints the Create-new row with its own marker class", () => {
		const h = harness();
		const el = row();
		h.suggest.renderSuggestion({ __createNew: true, query: "brand new" }, el);

		assert.ok(classes(el).includes("callout-studio-suggestion"));
		assert.ok(classes(el).includes("callout-studio-suggestion-create-new"));
		assert.ok(
			(el as unknown as { textContent: string }).textContent.includes(
				"brand new",
			),
		);
	});

	it("paints a callout row as icon + name + ids", () => {
		const h = harness();
		addCallout(h.registry, { aliases: ["hush"] });
		const el = row();
		h.suggest.renderSuggestion(h.registry.get("quiet")!, el);

		const [icon, text] = children(el);
		assert.deepStrictEqual(classes(icon), ["callout-studio-suggestion-icon"]);
		assert.deepStrictEqual(classes(text), ["callout-studio-suggestion-text"]);
		const [name, idsEl] = children(text);
		assert.strictEqual((name as { textContent: string }).textContent, "Quiet");
		// Id and aliases share one sorted list (getSortedCalloutIds), so the
		// second line does not depend on the order the aliases were stored in.
		assert.strictEqual(
			(idsEl as { textContent: string }).textContent,
			"hush, quiet",
		);
	});

	it("draws the muted no-icon ring for a callout that hides its icon", () => {
		// A blank slot in a column of rows reads as an icon still downloading.
		const h = harness();
		addCallout(h.registry, { hideIcon: true });
		const el = row();
		h.suggest.renderSuggestion(h.registry.get("quiet")!, el);

		assert.ok(classes(children(el)[0]).includes(CSS_ICON_NONE));
	});

	it("follows the theme for the row's colour", () => {
		const h = harness();
		addCallout(h.registry, { colorLight: "#111111", colorDark: "#eeeeee" });
		const def = h.registry.get("quiet")!;

		fakeDom.light();
		const light = row();
		h.suggest.renderSuggestion(def, light);
		assert.strictEqual(
			(children(light)[0] as { style: { color: string } }).style.color,
			"#111111",
		);

		fakeDom.dark();
		const dark = row();
		h.suggest.renderSuggestion(def, dark);
		assert.strictEqual(
			(children(dark)[0] as { style: { color: string } }).style.color,
			"#eeeeee",
		);
		fakeDom.light();
	});

	it("names no colour at all for a callout handed to the theme", () => {
		// It keeps its place in the list — still a real id worth inserting — but
		// naming a colour the callout will not have on the page is the one thing
		// the row must not do.
		const h = harness();
		addCallout(h.registry, { externalStyle: true, colorLight: "#111111" });
		const el = row();
		h.suggest.renderSuggestion(h.registry.get("quiet")!, el);

		assert.strictEqual(
			(children(el)[0] as { style: { color: string } }).style.color,
			"var(--text-muted)",
		);
	});

	it("shows only the ids that match, once something has been typed", () => {
		const h = harness();
		addCallout(h.registry, { aliases: ["hush", "silent"] });
		(h.suggest as unknown as { context: unknown }).context = { query: "hu" };

		const el = row();
		h.suggest.renderSuggestion(h.registry.get("quiet")!, el);
		const idsEl = children(children(el)[1])[1] as { textContent: string };
		assert.strictEqual(idsEl.textContent, "hush");
	});

	it("keeps the matched run at full strength and fades the rest", () => {
		const h = harness();
		addCallout(h.registry, { id: "hushed", displayName: "Hushed" });
		(h.suggest as unknown as { context: unknown }).context = { query: "ush" };

		const el = row();
		h.suggest.renderSuggestion(h.registry.get("hushed")!, el);
		const idsEl = children(children(el)[1])[1];
		// `h` before and `ed` after are dimmed spans; `ush` is a bare text node.
		const dimmed = (idsEl as { children: { textContent: string }[] }).children;
		assert.deepStrictEqual(
			dimmed.map((span) => span.textContent),
			["h", "ed"],
		);
		assert.strictEqual((idsEl as { textContent: string }).textContent, "hushed");
	});

	it("shows every id unfaded when only the display name matched", () => {
		const h = harness();
		addCallout(h.registry, { displayName: "Library Voice", aliases: ["shh"] });
		(h.suggest as unknown as { context: unknown }).context = { query: "library" };

		const el = row();
		h.suggest.renderSuggestion(h.registry.get("quiet")!, el);
		const idsEl = children(children(el)[1])[1];
		assert.strictEqual((idsEl as { children: unknown[] }).children.length, 0);
		assert.strictEqual((idsEl as { textContent: string }).textContent, "quiet, shh");
	});
});
