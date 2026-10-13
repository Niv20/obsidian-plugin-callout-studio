/**
 * tests/metadataSuggest.test.ts — the dropdown after `[!type|`, and the two
 * new ways into it from the type dropdown (Tab and `|`).
 *
 * What the user sees, pinned in three layers:
 *
 * 1. **Which rows, in which order** (`buildMetadataSuggestions`) — colours
 *    first until one is named, then the styling's own words first and every
 *    colour a replacement; words that could not work where the cursor is are
 *    not offered; **Done** on an empty word after a separator; **Use "…"**
 *    for a word nothing matches.
 * 2. **What a pick writes** (`applyMetadataPick`) — a colour swaps the one
 *    already there instead of stacking a second; a word a theme matches with
 *    `~=` gets spaces around it, because a `|` hides it from that operator.
 * 3. **The keys and the landing** (`CalloutMetadataSuggest`, `AutoComplete`)
 *    — Tab stays in the brackets and the dropdown does not re-offer the word
 *    it just wrote; Enter finishes the header exactly as Enter on a type does.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
// Listed first: importing it installs the DOM globals (see fakeDom.ts).
import { fakeDom } from "./support/fakeDom";
import { asEditor, editor, type FakeEditor } from "./support/fakeEditor";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { CSSInjector } from "../src/manager/CSSInjector";
import { CalloutAutoComplete } from "../src/editor/AutoComplete";
import { CalloutMetadataSuggest } from "../src/editor/CalloutMetadataSuggest";
import {
	applyMetadataPick,
	buildMetadataSuggestions,
	metadataRowHeadings,
	slotAt,
	type MetadataSuggestion,
} from "../src/editor/metadataSuggestions";
import { metadataColorEntries } from "../src/utils/calloutMetadata";
import { acceptOnKey } from "../src/editor/suggestKeys";
import type { ThemeMetadataWord } from "../src/manager/theme/themeMetadataScan";
import type { CustomPalette } from "../src/types";

/* -------------------------------------------------------------------------- */
/* Layer 1 — the rows                                                         */
/* -------------------------------------------------------------------------- */

const palette = (name: string): CustomPalette => ({
	id: `cp-${name}`,
	name,
	colorLight: "#aa0000",
	colorDark: "#ff5555",
	bgColorLight: "#ffeeee",
	bgColorDark: "#331111",
	textColorLight: "#111111",
	textColorDark: "#eeeeee",
});

const word = (
	w: string,
	placement: ThemeMetadataWord["placement"] = "anywhere",
	guards: ThemeMetadataWord["guards"] = null,
): ThemeMetadataWord => ({ word: w, placement, guards });

/** `metadata` with `⎸` at the cursor → the rows. */
function rows(
	metadata: string,
	opts: {
		palettes?: CustomPalette[];
		words?: ThemeMetadataWord[];
		calloutId?: string;
		themeOwned?: boolean;
	} = {},
): MetadataSuggestion[] {
	const cursor = metadata.indexOf("⎸");
	return buildMetadataSuggestions({
		slot: slotAt(metadata.replace("⎸", ""), cursor),
		calloutId: opts.calloutId ?? "mark",
		themeOwned: opts.themeOwned ?? false,
		colors: metadataColorEntries(opts.palettes ?? []),
		sources: opts.words ? [{ label: "Fixture theme", words: opts.words }] : [],
		locale: "en",
	});
}

/** A row as one short string, for readable assertions. */
const label = (r: MetadataSuggestion): string => {
	switch (r.kind) {
		case "finish": return "<done>";
		case "typed": return `<use ${r.text}>`;
		case "theme": return `theme:${r.word.word}`;
		case "color": return `${r.entry.key}${r.replaces ? `>${r.replaces.text}` : ""}`;
	}
};
const labels = (rs: MetadataSuggestion[]): string[] => rs.map(label);

describe("buildMetadataSuggestions — rows and their order", () => {
	it("right after the first pipe: every colour A→Z, palettes among them, no Done", () => {
		const got = labels(rows("⎸", { palettes: [palette("Zebra"), palette("Comic Red")] }));
		assert.deepStrictEqual(got, [...got].sort((a, b) => a.localeCompare(b, "en")));
		assert.ok(got.indexOf("blue") < got.indexOf("comic-red"), "a palette is not put first");
		assert.ok(got.indexOf("comic-red") < got.indexOf("zebra"));
		assert.ok(!got.includes("<done>"));
	});

	it("sorts by how well a row matches before A→Z", () => {
		const got = labels(rows("re⎸"));
		assert.ok(got.indexOf("red") < got.indexOf("green"), "a prefix match leads");
	});

	it("sorts each source's words A→Z on their own, never together", () => {
		const got = buildMetadataSuggestions({
			slot: slotAt("", 0),
			calloutId: "mark",
			themeOwned: true,
			colors: [],
			sources: [
				{ label: "Theme", words: [word("zeta"), word("alpha")] },
				{ label: "Snippet", words: [word("mid"), word("beta")] },
			],
			locale: "en",
		});
		assert.deepStrictEqual(labels(got), ["theme:alpha", "theme:zeta", "theme:beta", "theme:mid"]);
	});

	it("after a separator: Done comes first", () => {
		assert.strictEqual(labels(rows("wide ⎸"))[0], "<done>");
		assert.strictEqual(labels(rows("wide|⎸"))[0], "<done>");
	});

	it("a typed alias finds its preset and needs no Use row", () => {
		const got = rows("grey⎸");
		const first = got[0];
		assert.ok(first?.kind === "color" && first.entry.key === "gray");
		assert.strictEqual(first.viaAlias, "grey");
		assert.ok(!labels(got).includes("<use grey>"));
	});

	it("Obsidian's own colour names are rows of their own, not aliases", () => {
		for (const name of ["purple", "pink", "yellow"]) {
			const first = rows(`${name}⎸`)[0];
			assert.ok(first?.kind === "color" && first.entry.key === name, name);
			assert.strictEqual(first.viaAlias, null, name);
		}
	});

	it("a word nothing matches gets a Use row", () => {
		assert.deepStrictEqual(labels(rows("zz9⎸")), ["<use zz9>"]);
	});

	it("the Use row is always last", () => {
		// Even when `50` only turns up inside `width-50`.
		assert.deepStrictEqual(labels(rows("50⎸", { words: [word("width-50")] })), ["theme:width-50", "<use 50>"]);
		assert.deepStrictEqual(labels(rows("wid⎸", { words: [word("width-50")] })), ["theme:width-50", "<use wid>"]);
	});

	it("once a colour is named, the styling's words lead and colours replace it", () => {
		const got = labels(rows("pink ⎸", { words: [word("wide")] }));
		assert.deepStrictEqual(got.slice(0, 2), ["<done>", "theme:wide"]);
		assert.ok(got.includes("purple>pink"));
		assert.ok(!got.some((l) => l.split(">")[0] === "pink"), "the colour already there is not offered");
	});

	it("offers no colour on a callout the theme owns", () => {
		const got = labels(rows("⎸", { themeOwned: true, words: [word("wide")] }));
		assert.deepStrictEqual(got, ["theme:wide"]);
	});

	it("hides words that could not work where the cursor is", () => {
		const words = [
			word("solo", "alone"),
			word("lead", "first"),
			word("kin", "alone", [{ op: "", value: "kith" }]),
			word("wide", "spaced"),
		];
		assert.deepStrictEqual(
			labels(rows("⎸", { words, themeOwned: true })),
			["theme:lead", "theme:solo", "theme:wide"],
		);
		assert.deepStrictEqual(
			labels(rows("x ⎸", { words, themeOwned: true })),
			["<done>", "theme:wide"],
		);
		assert.ok(labels(rows("⎸", { words, calloutId: "kith", themeOwned: true })).includes("theme:kin"));
	});

	it("does not offer a word already in the metadata", () => {
		assert.ok(!labels(rows("wide ⎸", { words: [word("wide")], themeOwned: true })).includes("theme:wide"));
	});

	it("says when the theme also reacts to a colour word, and drops the duplicate row", () => {
		const got = rows("re⎸", { words: [word("red", "spaced")] });
		const red = got.find((r) => r.kind === "color" && r.entry.key === "red");
		assert.ok(red?.kind === "color" && red.themeAlso);
		assert.ok(!labels(got).includes("theme:red"));
	});

	it("forgives a name's joints: no dash, an underscore", () => {
		const palettes = [palette("Comic Red")];
		assert.strictEqual(labels(rows("comicr⎸", { palettes }))[0], "comic-red");
		assert.strictEqual(labels(rows("comic_r⎸", { palettes }))[0], "comic-red");
	});

	it("reads a name typed with spaces for its dashes, and puts it first", () => {
		const palettes = [palette("Comic Red")];
		const got = rows("wide comic re⎸", { palettes });
		const first = got[0];
		assert.ok(first?.kind === "color" && first.entry.key === "comic-red");
		assert.strictEqual(first.joinedFrom, 5, "from the start of `comic`");
		// A `|` is a separator the user chose, never read across.
		const piped = rows("comic|re⎸", { palettes }).find((r) => label(r) === "comic-red");
		assert.ok(piped?.kind === "color" && piped.joinedFrom === undefined);
	});

	it("groups the styling's words by where they come from", () => {
		const got = buildMetadataSuggestions({
			slot: slotAt("", 0),
			calloutId: "mark",
			themeOwned: true,
			colors: [],
			sources: [
				{ label: "Theme", words: [word("wide"), word("wider")] },
				{ label: "Snippet", words: [word("wild")] },
			],
			locale: "en",
		});
		assert.deepStrictEqual(labels(got), ["theme:wide", "theme:wider", "theme:wild"]);
	});
});

describe("metadataRowHeadings — a heading over each group, when there are two", () => {
	const names = (rs: MetadataSuggestion[]) =>
		metadataRowHeadings(rs).map((h) => (h === null ? null : h.kind === "colors" ? "Colors" : h.label));

	it("heads the colours and the theme's words", () => {
		const got = rows("⎸", { words: [word("wide")] });
		const heads = names(got);
		assert.strictEqual(heads[0], "Colors");
		assert.strictEqual(heads[labels(got).indexOf("theme:wide")], "Fixture theme");
		assert.strictEqual(heads.filter((h) => h !== null).length, 2);
	});

	it("draws none when one group is all there is", () => {
		assert.ok(names(rows("⎸")).every((h) => h === null), "colours alone, no theme");
		assert.ok(
			names(rows("⎸", { themeOwned: true, words: [word("wide")] })).every((h) => h === null),
			"a theme's words alone",
		);
	});

	it("never heads Done or Use", () => {
		const got = rows("pink ⎸", { words: [word("wide")] });
		assert.strictEqual(names(got)[0], null);
	});
});

/* -------------------------------------------------------------------------- */
/* Layer 2 — what a pick writes                                               */
/* -------------------------------------------------------------------------- */

/** Pick the row labelled `which` in `metadata`; returns the result with `⎸`. */
function pickIn(metadata: string, which: string, words: ThemeMetadataWord[] = []): string {
	const cursor = metadata.indexOf("⎸");
	const slot = slotAt(metadata.replace("⎸", ""), cursor);
	const row = rows(metadata, { words }).find((r) => label(r) === which);
	assert.ok(row, `no row ${which} in ${labels(rows(metadata, { words })).join(", ")}`);
	const edit = applyMetadataPick(slot, row);
	return `${edit.metadata.slice(0, edit.cursor)}⎸${edit.metadata.slice(edit.cursor)}`;
}

describe("applyMetadataPick — the text a pick leaves", () => {
	it("a colour replaces the word under the cursor", () => {
		assert.strictEqual(pickIn("wide pu⎸", "purple"), "wide purple⎸");
		assert.strictEqual(pickIn("pu⎸rp wide", "purple"), "purple⎸ wide");
	});

	it("a colour takes the old colour's place, and the typed word leaves", () => {
		assert.strictEqual(pickIn("pink wide pu⎸", "purple>pink"), "purple⎸ wide");
		assert.strictEqual(pickIn("pu⎸|pink", "purple>pink"), "purple⎸");
		assert.strictEqual(pickIn("pink|⎸", "purple>pink"), "purple⎸");
	});

	it("a spaced word turns a touching | into a space", () => {
		const wide = [word("wide", "spaced")];
		assert.strictEqual(pickIn("pink|wi⎸", "theme:wide", wide), "pink wide⎸");
		assert.strictEqual(pickIn("wi⎸|pink", "theme:wide", wide), "wide⎸ pink");
		// An `anywhere` word keeps the user's separator.
		assert.strictEqual(pickIn("pink|wi⎸", "theme:wide", [word("wide")]), "pink|wide⎸");
	});

	it("Done drops the separator just typed, and nothing else", () => {
		assert.strictEqual(pickIn("pink ⎸", "<done>"), "pink⎸");
		assert.strictEqual(pickIn("pink | ⎸", "<done>"), "pink⎸");
		assert.strictEqual(pickIn("pink ⎸ wide", "<done>"), "pink ⎸ wide");
	});

	it("a name typed with spaces is written whole, with its dashes", () => {
		const palettes = [palette("Comic Red")];
		const cursor = "wide comic re⎸".indexOf("⎸");
		const slot = slotAt("wide comic re", cursor);
		const row = rows("wide comic re⎸", { palettes })[0];
		assert.ok(row);
		const edit = applyMetadataPick(slot, row);
		assert.strictEqual(edit.metadata, "wide comic-red");
		assert.strictEqual(edit.cursor, edit.metadata.length);
		assert.strictEqual(pickIn("c re⎸", "theme:c-red", [word("c-red", "spaced")]), "c-red⎸");
	});

	it("Use keeps the word exactly as typed", () => {
		assert.strictEqual(pickIn("50|zz9⎸", "<use zz9>"), "50|zz9⎸");
	});
});

/* -------------------------------------------------------------------------- */
/* Layer 3 — the suggest itself                                               */
/* -------------------------------------------------------------------------- */

interface Harness {
	registry: CalloutRegistry;
	meta: CalloutMetadataSuggest;
	auto: CalloutAutoComplete;
	/** The injector both suggests read their colours and theme words from. */
	injector: CSSInjector;
	/** Every call the type dropdown made to Obsidian's manager. */
	triggered: number;
}

function harness(): Harness {
	const registry = new CalloutRegistry();
	registry.load(null);
	const h = { triggered: 0 } as Harness;
	const app = {
		workspace: {
			getLeavesOfType: () => [],
			editorSuggest: { trigger: () => void h.triggered++ },
		},
	};
	const plugin = {
		app,
		registry,
		settings: registry.settings,
		isKnownZeroUsageFallback: () => false,
		cssInjector: new CSSInjector(app as never, registry),
	};
	h.registry = registry;
	h.injector = plugin.cssInjector;
	h.meta = new CalloutMetadataSuggest(plugin as never);
	h.auto = new CalloutAutoComplete(plugin as never);
	return h;
}

/**
 * A buffer with `⎸` at the cursor → editor + cursor. (`valueWithCursor()`
 * marks the cursor with `|`, so `[!note||]` below reads "a pipe, then the
 * cursor".)
 */
function at(source: string): { ed: FakeEditor; line: number; ch: number } {
	const marker = source.indexOf("⎸");
	const before = source.slice(0, marker);
	const line = (before.match(/\n/g) ?? []).length;
	const ch = before.length - (before.lastIndexOf("\n") + 1);
	const ed = editor(source.replace("⎸", ""));
	ed.setCursor({ line, ch });
	return { ed, line, ch };
}

function settle(): void {
	fakeDom.window.flushFrames();
	fakeDom.window.flushTimers();
}

const key = (k: string): KeyboardEvent =>
	new (globalThis as unknown as {
		KeyboardEvent: new (t: string, i: { key: string }) => KeyboardEvent;
	}).KeyboardEvent("keydown", { key: k });

/** Trigger the metadata dropdown, pick the row labelled `which` with `how`. */
function pickMeta(h: Harness, source: string, which: string, how: "Enter" | "Tab"): FakeEditor {
	const { ed, line, ch } = at(source);
	const info = h.meta.onTrigger({ line, ch }, asEditor(ed), null);
	assert.ok(info, `expected the dropdown to open on ${source}`);
	const ctx = { editor: asEditor(ed), file: null, start: info.start, end: info.end, query: info.query };
	(h.meta as unknown as { context: unknown }).context = ctx;
	const chosen = h.meta.getSuggestions(ctx as never).find((r) => label(r) === which);
	assert.ok(chosen, `no row ${which}`);
	h.meta.selectSuggestion(chosen, key(how));
	settle();
	return ed;
}

describe("CalloutMetadataSuggest — when it opens", () => {
	const opens = (source: string): boolean => {
		const h = harness();
		const { ed, line, ch } = at(source);
		return h.meta.onTrigger({ line, ch }, asEditor(ed), null) !== null;
	};

	it("opens past the first pipe, in every role", () => {
		assert.ok(opens("> [!mark|⎸"));
		assert.ok(opens("> [!mark|pi⎸]"));
		assert.ok(opens("## [!mark|⎸]"));
		assert.ok(opens("text [!mark|⎸] more"));
	});

	it("stays shut in the type, past the bracket, and in code", () => {
		assert.ok(!opens("> [!ma⎸rk|pink]"));
		assert.ok(!opens("> [!mark]⎸"));
		assert.ok(!opens("> [!mark|pink] Ti⎸tle"));
		assert.ok(!opens("`[!mark|⎸]`"));
		assert.ok(!opens("\\[!mark|⎸]"));
	});
});

describe("CalloutMetadataSuggest — a name the theme claims", () => {
	/** Does the dropdown offer any colour for `source`? */
	const offersColours = (h: Harness, source: string): boolean => {
		const { ed, line, ch } = at(source);
		const info = h.meta.onTrigger({ line, ch }, asEditor(ed), null);
		assert.ok(info, `expected the dropdown to open on ${source}`);
		const ctx = { editor: asEditor(ed), file: null, start: info.start, end: info.end, query: info.query };
		return h.meta.getSuggestions(ctx as never).some((r) => r.kind === "color");
	};

	it("offers no colour for that name's block callout, which the theme draws", () => {
		// Quote stays ours: the theme names `quote` but not the `цитата` the
		// user added. A colour on `> [!quote|…]` would never paint.
		const h = harness();
		h.registry.update("quote", { aliases: ["cite", "цитата"] });
		h.registry.setThemeOwnedIds(new Set(["quote"]));
		assert.strictEqual(h.registry.themeOwns(h.registry.get("quote")!), false);

		assert.strictEqual(offersColours(h, "> [!quote|⎸"), false);
		assert.strictEqual(offersColours(h, "> [!цитата|⎸"), true);
		assert.strictEqual(offersColours(h, "## [!quote|⎸]"), true, "the heading is ours");
	});
});

describe("CalloutMetadataSuggest — Tab stays, Enter finishes", () => {
	it("Tab writes the word, closes, and keeps the cursor in the brackets", () => {
		const h = harness();
		const ed = pickMeta(h, "> [!note|pu⎸]", "purple", "Tab");
		assert.strictEqual(ed.valueWithCursor(), "> [!note|purple|]");
		assert.strictEqual((h.meta as unknown as { closedCount: number }).closedCount, 1);
	});

	it("does not re-offer the word Tab just wrote, until something moves", () => {
		const h = harness();
		const ed = pickMeta(h, "> [!note|pu⎸]", "purple", "Tab");
		const cursor = ed.getCursor();
		assert.strictEqual(h.meta.onTrigger(cursor, asEditor(ed), null), null);
		ed.replaceRange(" ", cursor);
		const after = { line: cursor.line, ch: cursor.ch + 1 };
		assert.ok(h.meta.onTrigger(after, asEditor(ed), null));
	});

	it("Enter finishes a new block callout like Enter on a type", () => {
		const h = harness();
		assert.strictEqual(
			pickMeta(h, "> [!note|pu⎸]", "purple", "Enter").valueWithCursor(),
			"> [!note|purple] Note\n> |",
		);
		// Unclosed: the bracket is closed on the way.
		assert.strictEqual(
			pickMeta(h, "> [!note|pu⎸", "purple", "Enter").valueWithCursor(),
			"> [!note|purple] Note\n> |",
		);
	});

	it("Enter keeps a title and a fold mark the user wrote", () => {
		const h = harness();
		assert.strictEqual(
			pickMeta(h, "> [!note|pu⎸]- Page break", "purple", "Enter").valueWithCursor(),
			"> [!note|purple]- Page break|",
		);
	});

	it("Enter on a heading and an inline callout lands as their own Enter does", () => {
		const h = harness();
		assert.strictEqual(
			pickMeta(h, "## [!note|pu⎸]", "purple", "Enter").valueWithCursor(),
			"## [!note|purple]\n|",
		);
		assert.strictEqual(
			pickMeta(h, "a [!note|pu⎸]b", "purple", "Enter").valueWithCursor(),
			"a [!note|purple] |b",
		);
		assert.strictEqual(
			pickMeta(h, "a [!note|pu⎸]{text} b", "purple", "Enter").valueWithCursor(),
			"a [!note|purple]{text} |b",
		);
	});

	it("Done finishes without writing a word", () => {
		const h = harness();
		assert.strictEqual(
			pickMeta(h, "> [!note|purple ⎸]", "<done>", "Enter").valueWithCursor(),
			"> [!note|purple] Note\n> |",
		);
	});
});

describe("CalloutAutoComplete — Tab and | on a type", () => {
	/** Trigger the type dropdown and accept `id` with `k`. */
	function accept(source: string, id: string, k: "Tab" | "|"): { ed: FakeEditor; h: Harness } {
		const h = harness();
		const { ed, line, ch } = at(source);
		const info = h.auto.onTrigger({ line, ch }, asEditor(ed), null);
		assert.ok(info);
		(h.auto as unknown as { context: unknown }).context = {
			editor: asEditor(ed),
			file: { path: "note.md" },
			start: info.start,
			end: { line, ch },
			query: info.query,
		};
		const def = h.registry.get(id);
		assert.ok(def);
		h.auto.selectSuggestion(def, key(k));
		settle();
		return { ed, h };
	}

	it("Tab writes the type alone and parks before the bracket", () => {
		assert.strictEqual(accept("> [!no⎸]", "note", "Tab").ed.valueWithCursor(), "> [!note|]");
		assert.strictEqual(accept("### [!no⎸]", "note", "Tab").ed.valueWithCursor(), "### [!note|]");
		assert.strictEqual(accept("a [!no⎸]{t} b", "note", "Tab").ed.valueWithCursor(), "a [!note|]{t} b");
	});

	it("Tab leaves an unclosed token unclosed — a `]` the user did not type would double", () => {
		assert.strictEqual(accept("> [!no⎸", "note", "Tab").ed.valueWithCursor(), "> [!note|");
	});

	it("Tab keeps the metadata, fold mark and title, parking after the metadata", () => {
		assert.strictEqual(
			accept("> [!no⎸|pink]- Title", "note", "Tab").ed.valueWithCursor(),
			"> [!note|pink|]- Title",
		);
	});

	it("| completes the type, types the pipe, and opens the metadata dropdown", () => {
		const { ed, h } = accept("> [!no⎸]", "note", "|");
		assert.strictEqual(ed.valueWithCursor(), "> [!note||]");
		// The dropdown opens a frame after the cursor settles (triggerNow).
		settle();
		assert.strictEqual(h.triggered, 1);
		assert.strictEqual(accept("> [!no⎸", "note", "|").ed.valueWithCursor(), "> [!note||");
	});

	it("| steps over a pipe that already follows the type", () => {
		assert.strictEqual(accept("> [!no⎸|pink]", "note", "|").ed.valueWithCursor(), "> [!note||pink]");
	});

	it("neither key ever rewrites the `]` — Obsidian's bracket pairing stops tracking a `]` that was rewritten", () => {
		// Typed by hand with Auto pair brackets on: `> [` gives `> []`, and a `]`
		// typed at the end steps over the tracked one. Rewrite that `]` and the
		// typed one is inserted instead: `> [!note|wide]]`.
		for (const [source, k] of [["> [!no⎸]", "|"], ["> [!no⎸]", "Tab"], ["> [!no⎸|pink]", "|"]] as const) {
			const { ed } = accept(source, "note", k);
			const close = ed.getLine(0).indexOf("]");
			for (const edit of ed.edits) {
				const to = edit.to?.ch ?? edit.from.ch;
				assert.ok(to <= close, `${source} + ${k}: an edit reached the \`]\` at ${close}: ${JSON.stringify(edit)}`);
			}
		}
	});

	it("| keeps a name the user is typing when the highlighted id only contains it", () => {
		// "Note" is offered for `ote` (the search matches anywhere in an id),
		// but the user was not typing `note`: the pipe goes after their text.
		assert.strictEqual(accept("> [!ote⎸", "note", "|").ed.valueWithCursor(), "> [!ote||");
	});

	it("| under Cmd, or under Ctrl without Alt, is a hotkey and is left alone", () => {
		let handler: ((evt: KeyboardEvent) => boolean | void) | null = null;
		let picks = 0;
		const suggest = {
			scope: { register: (_m: unknown, _k: string, fn: (evt: KeyboardEvent) => boolean | void) => { handler = fn; } },
			suggestions: { useSelectedItem: () => { picks++; return true; } },
		};
		acceptOnKey(suggest as never, null, "|");
		const press = (mods: Partial<KeyboardEvent>) =>
			(handler as unknown as (evt: KeyboardEvent) => boolean)({ key: "|", isComposing: false, metaKey: false, ctrlKey: false, altKey: false, ...mods } as KeyboardEvent);
		assert.strictEqual(press({ metaKey: true }), true);
		assert.strictEqual(press({ ctrlKey: true }), true);
		assert.strictEqual(picks, 0);
		// Plain, Shift and AltGr (Ctrl+Alt) are typing.
		assert.strictEqual(press({}), false);
		assert.strictEqual(press({ ctrlKey: true, altKey: true }), false);
		assert.strictEqual(picks, 2);
	});

	it("| is only typed when there is nothing to complete", () => {
		// The whole type already typed: kept exactly as spelled.
		assert.strictEqual(accept("> [!NOTE⎸]", "note", "|").ed.valueWithCursor(), "> [!NOTE||]");
		// Nothing typed yet: no row is chosen for the user.
		assert.strictEqual(accept("> [!⎸]", "note", "|").ed.valueWithCursor(), "> [!||]");
		// Mid-word: a pipe there splits nothing it was not asked to.
		assert.strictEqual(accept("> [!no⎸te]", "note", "|").ed.valueWithCursor(), "> [!no||te]");
	});
});

describe("CalloutMetadataSuggest — what a row looks like", () => {
	/** Open the dropdown on `source` and render every row into a fake list. */
	function render(h: Harness, source: string) {
		const { ed, line, ch } = at(source);
		const info = h.meta.onTrigger({ line, ch }, asEditor(ed), null);
		assert.ok(info);
		const ctx = { editor: asEditor(ed), file: null, start: info.start, end: info.end, query: info.query };
		const container = fakeDom.document.body.createDiv({ cls: "suggestion-container" });
		const list = container.createDiv({ cls: "suggestion" });
		const got = h.meta.getSuggestions(ctx as never);
		const items = got.map((row) => {
			const el = list.createDiv({ cls: "suggestion-item" });
			h.meta.renderSuggestion(row, el as unknown as HTMLElement);
			return el;
		});
		return { got, container, list, items };
	}

	const withTheme = (h: Harness) => {
		(h.injector as unknown as { metadataCatalog: unknown }).metadataCatalog = {
			sourcesNow: () => [{ label: "Fixture theme", words: [word("wide", "spaced")] }],
			snippetWords: () => new Set<string>(),
		};
	};

	it("a colour row is its word and its circles — a third circle for a gradient", () => {
		const h = harness();
		h.registry.settings.customPalettes = [
			{ ...palette("Sunset"), bgGradient: { angleDeg: 90, toColorLight: "#ffcc00", toColorDark: "#664400" } },
		];
		const { got, items } = render(h, "> [!mark|⎸]");
		const sunset = items[labels(got).indexOf("sunset")];
		assert.ok(sunset);
		assert.strictEqual(sunset.querySelectorAll(".cs-color-circle").length, 3);
		assert.strictEqual(sunset.querySelector(".callout-studio-suggestion-name")?.textContent, "sunset");
		const blue = items[labels(got).indexOf("blue")];
		assert.strictEqual(blue?.querySelectorAll(".cs-color-circle").length, 2);
		assert.strictEqual(blue?.querySelector(".callout-studio-suggestion-id"), null, "no second line");
	});

	it("puts sticky headings between groups, outside the rows", () => {
		const h = harness();
		withTheme(h);
		const { list } = render(h, "> [!mark|⎸]");
		const headings = list.querySelectorAll(".cs-meta-suggestion-heading");
		assert.deepStrictEqual(headings.map((el) => el.textContent), ["Colors", "Fixture theme"]);
		assert.ok(headings.every((el) => !el.classList.contains("suggestion-item")));
	});

	it("says a row's needs once, at the bottom, for the highlighted row", () => {
		const h = harness();
		withTheme(h);
		const { got, container } = render(h, "> [!mark|pink ⎸]");
		const footer = container.querySelector(".cs-meta-suggestion-footer");
		assert.ok(footer);
		assert.strictEqual(container.lastElementChild, footer);
		const wide = got.find((r) => label(r) === "theme:wide");
		h.meta.onSelectedChange(wide);
		assert.strictEqual(footer.textContent, "Separate it with spaces, not |");
		h.meta.onSelectedChange(got.find((r) => label(r) === "purple>pink"));
		assert.strictEqual(footer.textContent, "Replaces pink");
		h.meta.onSelectedChange(got.find((r) => r.kind === "finish"));
		assert.strictEqual(footer.textContent, "");
	});

	it("beside a theme's words, a colour says where it may stand", () => {
		const h = harness();
		withTheme(h);
		const { got, container } = render(h, "> [!mark|⎸]");
		const footer = container.querySelector(".cs-meta-suggestion-footer");
		assert.ok(footer);
		assert.strictEqual(got[0]?.kind, "color");
		h.meta.onSelectedChange(got[0]);
		assert.strictEqual(footer.textContent, "Separate it with spaces or |");
	});

	it("among colours alone, says nothing about separators and drops the empty line", () => {
		const h = harness();
		const { got, container } = render(h, "> [!mark|⎸]");
		assert.ok(got.every((r) => r.kind !== "theme"));
		const footer = container.querySelector(".cs-meta-suggestion-footer");
		assert.ok(footer);
		for (const row of got) {
			h.meta.onSelectedChange(row);
			assert.strictEqual(footer.textContent, "");
		}
		assert.ok(footer.classList.contains("cs-meta-suggestion-footer-unused"));
	});

	it("among colours alone, keeps the line when a row has something else to say", () => {
		const h = harness();
		const { got, container } = render(h, "> [!mark|pink ⎸]");
		assert.ok(got.every((r) => r.kind !== "theme"));
		const footer = container.querySelector(".cs-meta-suggestion-footer");
		assert.ok(footer);
		assert.ok(!footer.classList.contains("cs-meta-suggestion-footer-unused"));
		h.meta.onSelectedChange(got.find((r) => label(r) === "purple>pink"));
		assert.strictEqual(footer.textContent, "Replaces pink");
		h.meta.onSelectedChange(got.find((r) => r.kind === "color" && !r.replaces && !r.themeAlso));
		assert.strictEqual(footer.textContent, "");
	});
});
