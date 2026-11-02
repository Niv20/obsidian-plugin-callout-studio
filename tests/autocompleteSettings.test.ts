/**
 * tests/autocompleteSettings.test.ts — Settings → Editor → Autocomplete and
 * metadata, and what each of its switches does to the two lists that open while a callout
 * is typed.
 *
 * Five layers:
 *
 * 1. **The saved settings** (`settingsMerge.ts`, `metadataWordInput.ts`): the
 *    switches come back as saved, a missing group is the defaults, a list of
 *    words is cleaned the way typing cleans one, and the old `autocomplete`
 *    group — which released builds rewrite — decides nothing.
 * 2. **The `[!` list** (`AutoComplete.ts`): off, typing opens nothing, but the
 *    Insert and Wrap commands still open it on the `[!]` they wrote; the
 *    theme's callouts can be left out, and their names still count as taken.
 * 3. **The `|` list** (`CalloutMetadataSuggest.ts`, `metadataSuggestions.ts`):
 *    on and off apart from the `[!` list; the user's words as a group of their
 *    own, first; the theme's words left out on request, while a colour still
 *    says the theme reacts to its word; **Use "…"** below a line of its own.
 * 4. **The words field** (`ui/TagInput.ts` with `separators`): a space or `|`
 *    ends a word, several words typed or pasted at once become several pills,
 *    and the messages talk about words, not IDs.
 * 5. **The settings** (`declarative/autocompletePage.ts`, built from
 *    `autocompleteRows.ts` and `metadataRows.ts`): which rows show when, and
 *    that the words are saved — and refused while saving is paused.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
// Listed first: importing it installs the DOM globals (see fakeDom.ts).
import { fakeDom, type FakeElement } from "./support/fakeDom";
import { asEditor, editor } from "./support/fakeEditor";
import type { App } from "obsidian";
import { DeclarativeHarness, type LooseDef } from "./support/declarativeRenderer";
import { DEFAULT_SETTINGS, MAX_METADATA_WORD_LENGTH, MAX_METADATA_WORDS } from "../src/constants";
import { t } from "../src/i18n";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { CSSInjector } from "../src/manager/CSSInjector";
import { CalloutAutoComplete } from "../src/editor/AutoComplete";
import { CalloutMetadataSuggest } from "../src/editor/CalloutMetadataSuggest";
import {
	buildMetadataSuggestions,
	metadataRowHeadings,
	slotAt,
	type MetadataSuggestion,
} from "../src/editor/metadataSuggestions";
import type { MetadataWordSource } from "../src/manager/theme/ThemeMetadataCatalog";
import { CalloutStudioSettingsTab } from "../src/settings/SettingsTab";
import { AUTOCOMPLETE_ROWS } from "../src/settings/declarative/autocompleteRows";
import { autocompletePage } from "../src/settings/declarative/autocompletePage";
import { METADATA_ROWS } from "../src/settings/declarative/metadataRows";
import { PersistentParts } from "../src/settings/declarative/persistentParts";
import { RowRegistry } from "../src/settings/declarative/rowRegistry";
import { toObsidianItems, type TreeContext } from "../src/settings/declarative/types";
import type { SettingsTabPlugin } from "../src/settings/sections/types";
import { resetInventory } from "../src/settings/resetInventory";
import { metadataColorEntries } from "../src/utils/calloutMetadata";
import { mergeSavedSettings } from "../src/utils/settingsMerge";
import { sanitizeMetadataWords } from "../src/utils/metadataWordInput";
import type { CalloutDefinition } from "../src/types";

/* -------------------------------------------------------------------------- */
/* 1 — the saved settings                                                     */
/* -------------------------------------------------------------------------- */

describe("the saved Autocomplete settings", () => {
	it("are all on, with no words, when the file has none", () => {
		assert.deepEqual(mergeSavedSettings({}).suggestions, DEFAULT_SETTINGS.suggestions);
		assert.deepEqual(DEFAULT_SETTINGS.suggestions, {
			callouts: true,
			themeCallouts: true,
			metadata: true,
			themeMetadata: true,
			metadataWords: [],
		});
	});

	it("come back as saved", () => {
		const saved = {
			callouts: false,
			themeCallouts: false,
			metadata: false,
			themeMetadata: false,
			metadataWords: ["wide", "50"],
		};
		assert.deepEqual(mergeSavedSettings({ suggestions: saved }).suggestions, saved);
	});

	it("are not decided by the old autocomplete group, which released builds rewrite to true", () => {
		const legacy = { enabled: false } as unknown as typeof DEFAULT_SETTINGS.autocomplete;
		const merged = mergeSavedSettings({ autocomplete: legacy });
		assert.equal(merged.suggestions.callouts, true);
		assert.equal(merged.autocomplete.enabled, true, "the old group still says true, for those builds");
	});

	it("clean a list of words the way typing does", () => {
		assert.deepEqual(
			sanitizeMetadataWords([
				"wide",
				" [50] ",
				"a|b c",
				"wide",
				7,
				null,
				"",
				"x".repeat(MAX_METADATA_WORD_LENGTH + 1),
				"Wide",
			]),
			["wide", "50", "a", "b", "c", "Wide"],
		);
		assert.deepEqual(sanitizeMetadataWords("wide"), [], "not a list: no words");
		const many = Array.from({ length: MAX_METADATA_WORDS + 5 }, (_, i) => `w${i}`);
		assert.equal(sanitizeMetadataWords(many).length, MAX_METADATA_WORDS);
	});

	it("go back to the defaults on Reset everything, and the reset says so first", () => {
		const registry = new CalloutRegistry();
		registry.load(null);
		const label = "settings.resetItemAutocomplete";
		assert.ok(!resetInventory(registry).restored.some((row) => row.labelKey === label));
		registry.settings.suggestions.metadataWords = ["wide"];
		assert.ok(resetInventory(registry).restored.some((row) => row.labelKey === label));
		registry.settings.suggestions.metadataWords = [];
		registry.settings.metadataColors.enabled = false;
		assert.ok(
			resetInventory(registry).restored.some((row) => row.labelKey === label),
			"metadata colours count too",
		);
		registry.settings.suggestions.callouts = false;
		registry.resetAll();
		assert.deepEqual(registry.settings.suggestions, DEFAULT_SETTINGS.suggestions);
		assert.equal(registry.settings.metadataColors.enabled, true);
	});
});

/* -------------------------------------------------------------------------- */
/* Shared harness for the two lists                                           */
/* -------------------------------------------------------------------------- */

const THEMED: CalloutDefinition = {
	id: "themed",
	displayName: "Themed",
	icon: { type: "lucide", value: "pencil" },
	colorLight: "#336699",
	colorDark: "#88bbee",
	foldable: false,
	defaultFolded: false,
	builtIn: false,
	source: "theme",
};

function harness(sources: MetadataWordSource[] = []) {
	const registry = new CalloutRegistry();
	registry.load(null);
	let triggered = 0;
	const app = { workspace: { getLeavesOfType: () => [], editorSuggest: { trigger: () => void triggered++ } } };
	const plugin = {
		app,
		registry,
		settings: registry.settings,
		isKnownZeroUsageFallback: () => false,
		cssInjector: new CSSInjector(app as never, registry),
	};
	(plugin.cssInjector as unknown as { metadataCatalog: unknown }).metadataCatalog = {
		sourcesNow: () => sources,
		snippetWords: () => new Set<string>(),
	};
	return {
		registry,
		settings: registry.settings,
		auto: new CalloutAutoComplete(plugin as never),
		meta: new CalloutMetadataSuggest(plugin as never),
		triggered: () => triggered,
	};
}
type Harness = ReturnType<typeof harness>;

/** A buffer with `⎸` at the cursor (one line). */
function at(source: string) {
	const ch = source.indexOf("⎸");
	assert.notEqual(ch, -1);
	return { ed: editor(source.replace("⎸", "")), line: 0, ch };
}

/** The `[!` list's rows for `source`, or null when it would not open. */
function typeRows(h: Harness, source: string): string[] | null {
	const { ed, line, ch } = at(source);
	const info = h.auto.onTrigger({ line, ch }, asEditor(ed), null);
	if (!info) return null;
	const rows = h.auto.getSuggestions({
		editor: asEditor(ed),
		file: null,
		start: info.start,
		end: info.end,
		query: info.query,
	} as never);
	return rows.map((row) => ("__createNew" in row ? `<create ${row.query}>` : row.id));
}

/** The `|` list's rows for `source`, or null when it would not open. */
function metaRows(h: Harness, source: string): MetadataSuggestion[] | null {
	const { ed, line, ch } = at(source);
	const info = h.meta.onTrigger({ line, ch }, asEditor(ed), null);
	if (!info) return null;
	return h.meta.getSuggestions({
		editor: asEditor(ed),
		file: null,
		start: info.start,
		end: info.end,
		query: info.query,
	} as never);
}

const word = (w: string) => ({ word: w, placement: "anywhere" as const, guards: null });
const themeSource = (...words: string[]): MetadataWordSource => ({
	label: "Fixture theme",
	origin: "theme",
	words: words.map(word),
});
const label = (row: MetadataSuggestion): string =>
	row.kind === "theme" ? `${row.origin}:${row.word.word}` : row.kind === "color" ? row.entry.key : `<${row.kind}>`;

/* -------------------------------------------------------------------------- */
/* 2 — the `[!` list                                                          */
/* -------------------------------------------------------------------------- */

describe("the [! list and its switches", () => {
	it("opens as you type while on, and not at all while off", () => {
		const h = harness();
		assert.ok(typeRows(h, "> [!no⎸")?.includes("note"));
		h.settings.suggestions.callouts = false;
		assert.equal(typeRows(h, "> [!no⎸"), null);
		assert.equal(typeRows(h, "## [!no⎸"), null);
		assert.equal(typeRows(h, "text [!no⎸"), null);
	});

	it("still opens, while off, on the [!] an Insert or Wrap command wrote", () => {
		const h = harness();
		h.settings.suggestions.callouts = false;
		const ed = editor("> [!]");
		ed.setCursor({ line: 0, ch: 4 });
		h.auto.triggerNow(asEditor(ed), {} as never, true);
		fakeDom.window.flushFrames();
		assert.equal(h.triggered(), 1);
		// As the type is typed there, the list keeps following it.
		assert.ok(h.auto.onTrigger({ line: 0, ch: 4 }, asEditor(ed), null));
		ed.replaceRange("no", { line: 0, ch: 4 });
		assert.ok(h.auto.onTrigger({ line: 0, ch: 6 }, asEditor(ed), null));
		// Anywhere else it stays shut, and once left, that spot is forgotten.
		const other = editor("> [!a]\n> [!no");
		assert.equal(h.auto.onTrigger({ line: 1, ch: 6 }, asEditor(other), null), null);
		assert.equal(h.auto.onTrigger({ line: 0, ch: 6 }, asEditor(ed), null), null);
	});

	it("is not opened, while off, by a triggerNow that is not a command's (a pick's own `|`)", () => {
		const h = harness();
		h.settings.suggestions.callouts = false;
		const ed = editor("> [!no]");
		ed.setCursor({ line: 0, ch: 6 });
		h.auto.triggerNow(asEditor(ed), {} as never);
		fakeDom.window.flushFrames();
		assert.equal(h.auto.onTrigger({ line: 0, ch: 6 }, asEditor(ed), null), null, "not a command: still off");
	});

	it("leaves the theme's callouts out on request, and still never offers to create one", () => {
		const h = harness();
		h.registry.add(THEMED);
		assert.ok(typeRows(h, "> [!them⎸")?.includes("themed"));
		h.settings.suggestions.themeCallouts = false;
		assert.deepEqual(typeRows(h, "> [!them⎸"), ["<create them>"]);
		assert.deepEqual(typeRows(h, "> [!themed⎸"), [], "the full name is taken: no Create row");
		assert.ok(typeRows(h, "> [!no⎸")?.includes("note"), "the other callouts stay");
	});
});

/* -------------------------------------------------------------------------- */
/* 3 — the `|` list                                                           */
/* -------------------------------------------------------------------------- */

describe("the | list and its switches", () => {
	it("turns on and off apart from the [! list", () => {
		const h = harness();
		assert.ok(metaRows(h, "> [!note|⎸"));
		h.settings.suggestions.callouts = false;
		assert.ok(metaRows(h, "> [!note|⎸"), "the [! list off leaves this one on");
		h.settings.suggestions.callouts = true;
		h.settings.suggestions.metadata = false;
		assert.equal(metaRows(h, "> [!note|⎸"), null);
		assert.ok(typeRows(h, "> [!no⎸"), "and this one off leaves the [! list on");
	});

	it('draws Use "…" below a line of its own, apart from the group above it', () => {
		const h = harness([themeSource("wide")]);
		h.settings.metadataColors.enabled = false;
		const rows = metaRows(h, "> [!note|wid⎸") ?? [];
		assert.deepEqual(rows.map(label), ["theme:wide", "<typed>"]);
		const list = fakeDom.document.body.createDiv({ cls: "suggestion-container" }).createDiv({ cls: "suggestion" });
		const items = rows.map((row) => {
			const el = list.createDiv({ cls: "suggestion-item" });
			h.meta.renderSuggestion(row, el as unknown as HTMLElement);
			return el;
		});
		assert.ok(items[1]?.previousElementSibling?.hasClass("cs-meta-suggestion-separator"));
		assert.equal(list.querySelectorAll(".cs-meta-suggestion-separator").length, 1);
	});

	it('draws no line above Use "…" when it is the only row', () => {
		const h = harness();
		h.settings.metadataColors.enabled = false;
		const rows = metaRows(h, "> [!note|zzz⎸") ?? [];
		assert.deepEqual(rows.map(label), ["<typed>"]);
		const list = fakeDom.document.body.createDiv({ cls: "suggestion-container" }).createDiv({ cls: "suggestion" });
		const el = list.createDiv({ cls: "suggestion-item" });
		h.meta.renderSuggestion(rows[0]!, el as unknown as HTMLElement);
		assert.equal(list.querySelectorAll(".cs-meta-suggestion-separator").length, 0);
	});

	it("offers the user's words in a group of their own, ahead of the theme's", () => {
		const h = harness([themeSource("wide")]);
		h.settings.suggestions.metadataWords = ["50", "center"];
		h.settings.metadataColors.enabled = false;
		const rows = metaRows(h, "> [!note|⎸") ?? [];
		assert.deepEqual(rows.map(label), ["user:50", "user:center", "theme:wide"]);
		const headings = metadataRowHeadings(rows).map((heading) =>
			heading?.kind === "source" ? heading.label : heading,
		);
		assert.deepEqual(headings, [t("metadataSuggest.yourWords"), null, "Fixture theme"]);
	});

	it("draws a word of the user's with its own icon", () => {
		const h = harness();
		h.settings.suggestions.metadataWords = ["50"];
		h.settings.metadataColors.enabled = false;
		const rows = metaRows(h, "> [!note|5⎸") ?? [];
		const list = fakeDom.document.body.createDiv({ cls: "suggestion-container" }).createDiv({ cls: "suggestion" });
		const el = list.createDiv({ cls: "suggestion-item" });
		const own = rows.find((row) => row.kind === "theme");
		assert.ok(own);
		h.meta.renderSuggestion(own, el as unknown as HTMLElement);
		assert.ok(el.querySelector(".suggestion-icon"));
		assert.equal(el.querySelector(".suggestion-title")?.textContent, "50");
	});

	it("leaves the theme's words out on request, keeping a snippet's", () => {
		const snippet: MetadataWordSource = { label: "my-snippet", origin: "snippet", words: [word("tight")] };
		const h = harness([themeSource("wide"), snippet]);
		h.settings.metadataColors.enabled = false;
		h.settings.suggestions.themeMetadata = false;
		assert.deepEqual((metaRows(h, "> [!note|⎸") ?? []).map(label), ["snippet:tight"]);
	});

	it("still says the theme reacts to a colour's word when the theme's words are left out", () => {
		const h = harness([themeSource("red")]);
		h.settings.suggestions.themeMetadata = false;
		const red = (metaRows(h, "> [!note|re⎸") ?? []).find((row) => row.kind === "color" && row.entry.key === "red");
		assert.ok(red?.kind === "color" && red.themeAlso);
	});

	it("shows a word that is also a colour once, as the colour; the user's own word styles nothing", () => {
		const own: MetadataWordSource = { label: "Your words", origin: "user", words: [word("red"), word("wide")] };
		const rows = buildMetadataSuggestions({
			slot: slotAt("", 0),
			calloutId: "note",
			themeOwned: false,
			colors: metadataColorEntries([]),
			sources: [own],
			locale: "en",
		});
		assert.equal(rows.filter((row) => label(row) === "red" || label(row) === "user:red").length, 1);
		const red = rows.find((row) => row.kind === "color" && row.entry.key === "red");
		assert.ok(red?.kind === "color" && !red.themeAlso, "a word of the user's is not the theme's");
	});
});

/* -------------------------------------------------------------------------- */
/* 4 and 5 — the page, and its words field                                    */
/* -------------------------------------------------------------------------- */

/** The page drawn by the real settings tab, around a fake plugin with a real registry. */
function drawPage(options: { themeCallouts?: boolean; themeWords?: boolean; paused?: boolean } = {}) {
	const registry = new CalloutRegistry();
	registry.load(null);
	if (options.themeCallouts) registry.add(THEMED);
	const state = { paused: options.paused ?? false, changes: 0 };
	registry.onChange(() => void state.changes++);
	const plugin = {
		registry,
		get settings() {
			return registry.settings;
		},
		settingsWriter: {
			get isFrozen() {
				return state.paused;
			},
		},
		cssInjector: { metadataCatalog: { sourcesNow: () => (options.themeWords ? [themeSource("wide")] : []) } },
	};
	const app = {} as App;
	const ctx: TreeContext = {
		app,
		plugin: plugin as unknown as SettingsTabPlugin,
		redraw: () => tab.update(),
		registerDisposer: () => {},
		rows: new RowRegistry(),
		parts: new PersistentParts(() => {}),
		jumpTo: () => {},
	};
	const tab = new CalloutStudioSettingsTab(app, plugin as unknown as SettingsTabPlugin);
	const page = autocompletePage(ctx);
	tab.getSettingDefinitions = () => toObsidianItems(page.items ?? []);
	const harness = new DeclarativeHarness(tab as never);
	tab.update();
	/** Whether the row with this id is drawn and shown. */
	const shown = (id: string): boolean => {
		const row = harness.rows().find((r) => r.def.id === id);
		return row !== undefined && (row.settingEl as unknown as FakeElement).isShown();
	};
	/** The words field's input. */
	const input = () => {
		const row = harness.rows().find((r) => r.def.id === METADATA_ROWS.words);
		assert.ok(row);
		return (row.settingEl as unknown as FakeElement).querySelector(
			".cs-tag-input-field",
		) as unknown as FakeElement & { value: string };
	};
	return { registry, state, page, tab, harness, shown, input };
}

/** Every row id that is shown now: the page's first box, then its second. */
function shownIds(h: ReturnType<typeof drawPage>): string[] {
	return [...Object.values(AUTOCOMPLETE_ROWS), ...Object.values(METADATA_ROWS)].filter((id) => h.shown(id));
}

describe("the Autocomplete and metadata page", () => {
	it("hides what would change nothing right now", () => {
		const h = drawPage();
		// No theme callouts, no theme words: no theme switches.
		assert.deepEqual(shownIds(h), [
			"callout-autocomplete",
			"metadata-colors",
			"metadata-autocomplete",
			"metadata-words",
		]);

		const themed = drawPage({ themeCallouts: true, themeWords: true });
		assert.deepEqual(shownIds(themed), [
			"callout-autocomplete",
			"suggest-theme-callouts",
			"metadata-colors",
			"metadata-autocomplete",
			"suggest-theme-metadata",
			"metadata-words",
		]);

		// Each list's off switch hides only its own rows.
		themed.registry.settings.suggestions.metadata = false;
		themed.tab.update();
		assert.deepEqual(shownIds(themed), [
			"callout-autocomplete",
			"suggest-theme-callouts",
			"metadata-colors",
			"metadata-autocomplete",
		]);
		themed.registry.settings.suggestions.metadata = true;
		themed.registry.settings.suggestions.callouts = false;
		themed.tab.update();
		assert.deepEqual(shownIds(themed), [
			"callout-autocomplete",
			"metadata-colors",
			"metadata-autocomplete",
			"suggest-theme-metadata",
			"metadata-words",
		]);
	});

	it("keeps a theme switch the user turned off in sight, so it can be turned back on", () => {
		const h = drawPage();
		h.registry.settings.suggestions.themeCallouts = false;
		h.registry.settings.suggestions.themeMetadata = false;
		h.tab.update();
		assert.ok(h.shown("suggest-theme-callouts"));
		assert.ok(h.shown("suggest-theme-metadata"));
	});

	it("saves the switches at their own keys, never in the old autocomplete group", () => {
		const keys = (h: LooseDef[]): string[] =>
			h.flatMap((item) => [...(item.control ? [item.control.key] : []), ...keys(item.items ?? [])]);
		const h = drawPage();
		assert.deepEqual(keys(h.tab.settingItems as LooseDef[]), [
			"suggestions.callouts",
			"suggestions.themeCallouts",
			"metadataColors.enabled",
			"suggestions.metadata",
			"suggestions.themeMetadata",
		]);
	});
});

describe("Your words", () => {
	const enter = (input: FakeElement) => input.fire("keydown", { key: "Enter", preventDefault: () => undefined });

	it("turns what is typed into words and saves them", () => {
		const h = drawPage();
		const input = h.input();
		input.value = "wide no-title";
		enter(input);
		assert.deepEqual(h.registry.settings.suggestions.metadataWords, ["wide", "no-title"]);
		assert.ok(h.state.changes > 0, "the registry's change round saves it");
		assert.equal(input.value, "");
	});

	it("ends a word at a space or a | as it is typed", () => {
		const h = drawPage();
		const input = h.input();
		for (const key of [" ", "|"]) {
			input.value = key === " " ? "fifty" : "[center]";
			let prevented = false;
			input.fire("keydown", {
				key,
				preventDefault: () => {
					prevented = true;
				},
			});
			assert.ok(prevented, `${JSON.stringify(key)} is not typed into the word`);
		}
		assert.deepEqual(h.registry.settings.suggestions.metadataWords, ["fifty", "center"]);
	});

	it("splits a paste on spaces, pipes and commas", () => {
		const h = drawPage();
		h.input().fire("paste", { preventDefault: () => undefined, clipboardData: { getData: () => "a b|c,d\ne" } });
		assert.deepEqual(h.registry.settings.suggestions.metadataWords, ["a", "b", "c", "d", "e"]);
	});

	it("talks about words, not IDs", () => {
		const h = drawPage();
		const input = h.input();
		input.value = "wide";
		enter(input);
		input.value = "wide";
		enter(input);
		const row = h.harness.rows().find((r) => r.def.id === METADATA_ROWS.words);
		const text = (row?.settingEl as unknown as FakeElement).textContent;
		assert.match(text, new RegExp(t("settings.metadataWordAlreadyHere")));
		assert.doesNotMatch(text, /ID/);
		assert.equal(input.value, "wide", "the refused word stays to be fixed");
	});

	it("refuses a change while saving is paused, and shows the saved words again", () => {
		const h = drawPage({ paused: true });
		const input = h.input();
		input.value = "wide";
		enter(input);
		assert.deepEqual(h.registry.settings.suggestions.metadataWords, []);
		const row = h.harness.rows().find((r) => r.def.id === METADATA_ROWS.words);
		assert.equal((row?.settingEl as unknown as FakeElement).querySelectorAll(".cs-tag-chip").length, 0);
	});

	it("shows words that arrived from another device on the next draw", () => {
		const h = drawPage();
		h.registry.settings.suggestions.metadataWords = ["synced"];
		h.tab.update();
		const row = h.harness.rows().find((r) => r.def.id === METADATA_ROWS.words);
		const pills = (row?.settingEl as unknown as FakeElement).querySelectorAll(".cs-tag-chip");
		assert.deepEqual(
			pills.map((pill) => pill.textContent),
			["synced"],
		);
	});

	it("keeps the field beside the row's controls, where a redraw never moves it", () => {
		const h = drawPage();
		const before = h.input();
		h.tab.update();
		assert.equal(h.input(), before, "the same field, not a new one");
		const wrapper = before.closest(".cs-tag-wrapper");
		assert.ok(wrapper && !wrapper.parentElement?.hasClass("setting-item-control"));
	});
});
