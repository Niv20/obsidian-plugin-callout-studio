/**
 * tests/readingStructureWatch.test.ts — which registry changes re-render an
 * open reading view, and which open notes they re-render.
 *
 * Reading view bakes part of the registry into a note's DOM: `.cs-unknown`, the
 * `data-callout` spelling, whether a token has an icon span, whether a token is
 * built at all. Nothing re-ran that when the registry changed — `css-change`
 * only refreshes the editors — so `## [!new]` kept the fallback's look after
 * its type was created, until the note was reopened. The watch fixes that, and
 * the two properties that keep it cheap are pinned here:
 *
 * - **A colour, an icon or a name re-renders nothing.** The stylesheet and the
 *   icon sweep already carry those, and they are most registry rounds.
 * - **Only the notes that mention a moved name re-render.** A theme switch
 *   hands hundreds of names to the theme; the note using two of them pays,
 *   the others do not.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { MarkdownView } from "obsidian";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { ReadingStructureWatch, refreshCallouts } from "../src/editor/renderRefresh";
import type { CalloutDefinition } from "../src/types";

function def(over: Partial<CalloutDefinition> = {}): CalloutDefinition {
	return {
		id: "fresh",
		displayName: "Fresh",
		icon: { type: "lucide", value: "star" },
		colorLight: "#336699",
		colorDark: "#88bbee",
		foldable: true,
		defaultFolded: false,
		builtIn: false,
		source: "user",
		...over,
	};
}

/** An open note: its text, and how often its reading view re-rendered. */
interface Note {
	text: string;
	rerenders: number;
}

function harness(...texts: string[]) {
	const registry = new CalloutRegistry();
	registry.load(null);
	const notes: Note[] = texts.map((text) => ({ text, rerenders: 0 }));
	const leaves = notes.map((note) => ({
		view: Object.assign(Object.create(MarkdownView.prototype) as object, {
			getViewData: () => note.text,
			previewMode: { rerender: () => { note.rerenders++; } },
		}),
	}));
	const app = { workspace: { getLeavesOfType: () => leaves } } as unknown as App;
	const watch = new ReadingStructureWatch(app, registry);
	return { registry, notes, watch, rerenders: () => notes.map((n) => n.rerenders) };
}

describe("ReadingStructureWatch — what moves it", () => {
	it("a colour, an icon or a name re-renders nothing", () => {
		const h = harness("## [!note] Title");
		h.registry.update("note", { colorLight: "#ff0000", displayName: "Renamed", icon: { type: "lucide", value: "pencil" } });
		h.watch.check();
		assert.deepStrictEqual(h.rerenders(), [0]);
	});

	it("a new type re-renders the note that already wrote it", () => {
		const h = harness("## [!fresh] Written first", "> [!note]\n> unrelated");
		h.registry.add(def());
		h.watch.check();
		assert.deepStrictEqual(h.rerenders(), [1, 0]);
	});

	it("a deleted type re-renders the notes that still write it", () => {
		const h = harness("text [!fresh] inline");
		h.registry.add(def());
		h.watch.check();
		h.notes[0]!.rerenders = 0;
		h.registry.remove("fresh");
		h.watch.check();
		assert.deepStrictEqual(h.rerenders(), [1]);
	});

	it("hiding an icon re-renders, since the token's icon span is omitted", () => {
		const h = harness("## [!fresh] Title");
		h.registry.add(def());
		h.watch.check();
		h.notes[0]!.rerenders = 0;
		h.registry.update("fresh", { hideIcon: true });
		h.watch.check();
		assert.deepStrictEqual(h.rerenders(), [1]);
	});

	it("a new alias re-renders the note written with it", () => {
		const h = harness("## [!hush] Quiet");
		h.registry.add(def());
		h.watch.check();
		h.registry.update("fresh", { aliases: ["hush"] });
		h.watch.check();
		assert.deepStrictEqual(h.rerenders(), [1]);
	});

	it("matches the name as Obsidian does, whatever its spelling", () => {
		const h = harness("## [!My Type] Spelled apart");
		h.registry.add(def({ id: "my-type" }));
		h.watch.check();
		assert.deepStrictEqual(h.rerenders(), [1]);
	});

	it("a theme taking a callout re-renders the notes using it, and only those", () => {
		const h = harness("## [!note] Mine", "## [!warning] Other");
		h.registry.setThemeOwnedIds(new Set(["note"]));
		h.watch.check();
		assert.deepStrictEqual(h.rerenders(), [1, 0]);
	});

	it("a different fallback re-renders the notes holding an unknown id", () => {
		const h = harness("## [!nobody] Unknown", "## [!note] Known");
		h.registry.settings.fallbackCalloutId = "warning";
		h.watch.check();
		assert.deepStrictEqual(h.rerenders(), [1, 0]);
	});

	it("checks twice, re-renders once", () => {
		const h = harness("## [!fresh] Title");
		h.registry.add(def());
		h.watch.check();
		h.watch.check();
		assert.deepStrictEqual(h.rerenders(), [1]);
	});
});

describe("refreshCallouts — asks the watch after the repaint", () => {
	it("so a registry reloaded from disk reaches reading view too", () => {
		const calls: string[] = [];
		refreshCallouts({
			cssInjector: { inject: () => { calls.push("inject"); } },
			readingStructure: { check: () => { calls.push("check"); } },
		});
		assert.deepStrictEqual(calls, ["inject", "check"]);
	});
});
