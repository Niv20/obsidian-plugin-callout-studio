/**
 * tests/themeCalloutsOff.test.ts — the setting that switches the active
 * theme's callout styling off.
 *
 * The repo's test DOM has no CSSOM, so a theme here is a `<style>` whose
 * "parsed copy" is a fake rule list built from its text — built afresh
 * whenever the text is written, as a browser parses a `<style>` again. That
 * is the property the way back stands on. Which rules go is
 * `themeCalloutRules.test.ts` and the walk `themeCalloutStrip.test.ts`; this
 * pins when, where and how the switch acts, and what the theme's facts read
 * while it is off.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import type { App, EventRef, MarkdownPostProcessor } from "obsidian";
import { FakeDocument, FakeElement, FakeWindow, installFakeDom } from "./support/fakeDom";
import {
	registerThemeCalloutsOff,
	type ThemeCalloutsOffHost,
} from "../src/manager/theme/themeCalloutsOff";
import { ThemeCalloutStore } from "../src/manager/theme/ThemeCalloutStore";
import { ThemeMetadataCatalog } from "../src/manager/theme/ThemeMetadataCatalog";
import { ThemeClaimCheck } from "../src/manager/theme/ThemeClaimCheck";

installFakeDom();

/* ── A theme as a browser holds it ─────────────────────────────────────────── */

interface FakeStyle {
	readonly length: number;
	item(index: number): string;
	removeProperty(name: string): string;
	getPropertyValue(name: string): string;
}

interface FakeRule {
	selectorText: string;
	style: FakeStyle;
}

interface FakeSheet {
	cssRules: FakeRule[];
	deleteRule(index: number): void;
	insertRule(rule: string, index?: number): number;
}

function style(declarations: string): FakeStyle {
	const props = new Map(
		declarations
			.split(";")
			.filter((d) => d.includes(":"))
			.map((d) => [d.slice(0, d.indexOf(":")).trim(), d.slice(d.indexOf(":") + 1).trim()] as const),
	);
	return {
		get length() {
			return props.size;
		},
		item: (index) => [...props.keys()][index] ?? "",
		removeProperty: (name) => {
			const was = props.get(name) ?? "";
			props.delete(name);
			return was;
		},
		getPropertyValue: (name) => props.get(name) ?? "",
	};
}

/** One rule per line, `selector | declarations` — parsed afresh every time. */
function parse(text: string): FakeSheet {
	const cssRules = text
		.split("\n")
		.filter((line) => line.trim().length > 0)
		.map((line) => {
			const [selector = "", declarations = ""] = line.split("|");
			return { selectorText: selector.trim(), style: style(declarations) };
		});
	return {
		cssRules,
		deleteRule: (index) => {
			cssRules.splice(index, 1);
		},
		insertRule: (rule, index = 0) => {
			const open = rule.indexOf("{");
			cssRules.splice(index, 0, { selectorText: rule.slice(0, open).trim(), style: style(rule.slice(open + 1)) });
			return index;
		},
	};
}

type StyleEl = FakeElement & { readonly sheet: FakeSheet };

const TEXT = Object.getOwnPropertyDescriptor(FakeElement.prototype, "textContent") as {
	get(this: FakeElement): string;
	set(this: FakeElement, value: string): void;
};

/** A `<style>` in `doc`'s head whose sheet is parsed again whenever its text is written. */
function styleIn(doc: FakeDocument, text: string, id = ""): StyleEl {
	const el = doc.createElement("style");
	if (id) el.id = id;
	let sheet = parse(text);
	TEXT.set.call(el, text);
	Object.defineProperty(el, "textContent", {
		configurable: true,
		get: () => TEXT.get.call(el),
		set: (value: string) => {
			TEXT.set.call(el, value);
			sheet = parse(value);
		},
	});
	Object.defineProperty(el, "sheet", { get: () => sheet });
	doc.head.appendChild(el);
	el.isConnected = true;
	return el as StyleEl;
}

/** What the switch writes after the theme: Obsidian's own callout values. */
const PINS = ["body", ".mod-rtl, .is-rtl, .rtl", ".theme-light", ".theme-dark", "@media print", ".callout-icon"];

/** The theme's own rules, the switch's pins left out. */
const selectors = (el: StyleEl): string[] => {
	const all = el.sheet.cssRules.map((r) => r.selectorText);
	const pinned = all.length >= PINS.length && PINS.every((p, i) => all[all.length - PINS.length + i] === p);
	return pinned ? all.slice(0, -PINS.length) : all;
};
const pinned = (el: StyleEl): boolean => el.sheet.cssRules.length > selectors(el).length;

/** Obsidian, or Style Settings, writing a `<style>` anew. */
function rewrite(el: StyleEl, text: string): void {
	el.textContent = text;
}

const THEME = [
	".markdown-rendered p | color: red",
	"body.callout-on .callout | background-color: transparent",
	".callout-content, .blockquote | padding: 0",
	"body | --callout-radius: 0; --color-blue: #00f",
].join("\n");

/* ── A host just wide enough for the switch ────────────────────────────────── */

interface Harness {
	host: ThemeCalloutsOffHost;
	doc: FakeDocument;
	theme: StyleEl;
	/** What the injector was told: is the theme's callout styling off? */
	gate(): boolean;
	setOff(off: boolean): void;
	fire(event: string, ...args: unknown[]): void;
	postProcess(el: FakeElement): void;
	refreshes: number;
	unload(): void;
}

function harness(options: { startedOff?: boolean; noThemeElement?: boolean } = {}): Harness {
	const doc = new FakeDocument(new FakeWindow());
	(globalThis as { activeDocument?: unknown }).activeDocument = doc;
	const theme = styleIn(doc, THEME);
	const handlers = new Map<string, Array<(...args: unknown[]) => void>>();
	const changes: Array<() => void> = [];
	const disposers: Array<() => void> = [];
	const processors: MarkdownPostProcessor[] = [];
	let gate: () => boolean = () => false;
	const app = {
		customCss: options.noThemeElement ? undefined : { theme: "Fixture", styleEl: theme },
		workspace: {
			containerEl: doc.body,
			on: (name: string, callback: (...args: unknown[]) => void) => {
				handlers.set(name, [...(handlers.get(name) ?? []), callback]);
				return {} as EventRef;
			},
			iterateAllLeaves: () => {},
		},
	} as unknown as App;
	const settings = { themeCalloutStyles: { enabled: true } };
	const h: Harness = {
		host: {
			app,
			registry: { settings, onChange: (callback) => changes.push(callback) },
			cssInjector: {
				startedWithThemeCalloutsOff: () => options.startedOff === true,
				setThemeCalloutsOff: (active) => {
					gate = active;
				},
			},
			register: (callback) => disposers.push(callback),
			registerEvent: () => {},
			registerMarkdownPostProcessor: (processor) => {
				processors.push(processor);
				return processor;
			},
			registerEditorExtension: () => {},
		},
		doc,
		theme,
		gate: () => gate(),
		setOff: (off) => {
			settings.themeCalloutStyles.enabled = !off;
			for (const change of changes) change();
		},
		fire: (event, ...args) => {
			for (const callback of handlers.get(event) ?? []) callback(...args);
		},
		postProcess: (el) => {
			for (const processor of processors) void processor(el as unknown as HTMLElement, {} as never);
		},
		refreshes: 0,
		unload: () => {
			for (const dispose of disposers) dispose();
		},
	};
	h.host.refreshThemeAppearance = () => {
		h.refreshes++;
	};
	return h;
}

/* ── When and where it acts ────────────────────────────────────────────────── */

describe("switching the theme's callout styling off", () => {
	it("touches nothing while the theme styles callouts, which is the default", () => {
		const h = harness();
		const off = registerThemeCalloutsOff(h.host);
		off.settingsReady();
		h.postProcess(h.doc.body);
		h.fire("css-change");
		assert.strictEqual(h.gate(), false);
		assert.deepStrictEqual(selectors(h.theme), selectors(styleIn(new FakeDocument(), THEME)));
		assert.strictEqual(h.refreshes, 0);
	});

	it("takes the theme's callout rules out, keeps the rest, and re-derives the theme's facts", () => {
		const h = harness();
		registerThemeCalloutsOff(h.host).settingsReady();
		h.setOff(true);
		assert.strictEqual(h.gate(), true);
		assert.deepStrictEqual(selectors(h.theme), [".markdown-rendered p", ".blockquote", "body"]);
		const body = h.theme.sheet.cssRules[2];
		assert.strictEqual(body?.style.getPropertyValue("--callout-radius"), "");
		assert.strictEqual(body?.style.getPropertyValue("--color-blue"), "#00f");
		// …and Obsidian's own corners where the theme's general tokens would reach.
		assert.ok(pinned(h.theme));
		assert.strictEqual(h.theme.sheet.cssRules[3]?.style.getPropertyValue("--callout-radius"), "4px");
		assert.strictEqual(h.refreshes, 1);
	});

	it("puts the theme back from its own text when switched on again", () => {
		const h = harness();
		registerThemeCalloutsOff(h.host).settingsReady();
		h.setOff(true);
		const stripped = h.theme.sheet;
		h.setOff(false);
		assert.notStrictEqual(h.theme.sheet, stripped);
		assert.strictEqual(h.theme.sheet.cssRules.length, 4);
		assert.ok(!pinned(h.theme));
		assert.strictEqual(h.gate(), false);
		assert.strictEqual(h.refreshes, 2);
	});

	it("takes the rules out of a theme written anew before anything reads it", () => {
		const h = harness();
		registerThemeCalloutsOff(h.host).settingsReady();
		h.setOff(true);
		// Obsidian switching themes: new text, then `css-change` in the same task.
		rewrite(h.theme, ".callout-title | color: red\n.workspace | color: blue");
		h.fire("css-change");
		assert.deepStrictEqual(selectors(h.theme), [".workspace"]);
	});

	it("takes the callout variables out of Style Settings' sheet too", () => {
		const h = harness();
		const styleSettings = styleIn(h.doc, "body.css-settings-manager | --callout-border-width: 4px; --anp-x: 1", "css-settings-manager");
		registerThemeCalloutsOff(h.host).settingsReady();
		h.setOff(true);
		const vars = styleSettings.sheet.cssRules[0]?.style;
		assert.ok(!pinned(styleSettings), "the pins belong to the theme's sheet alone");
		assert.strictEqual(vars?.getPropertyValue("--callout-border-width"), "");
		assert.strictEqual(vars?.getPropertyValue("--anp-x"), "1");
		// Style Settings writing its sheet anew is caught before it is painted.
		rewrite(styleSettings, "body.css-settings-manager | --callout-padding: 0");
		h.doc.flushMutations();
		assert.strictEqual(styleSettings.sheet.cssRules[0]?.style.length, 0);
	});

	it("reaches a window no event announces, where a callout is drawn in it", () => {
		const h = harness();
		registerThemeCalloutsOff(h.host).settingsReady();
		h.setOff(true);
		// The Settings window, or a PDF export's: a clone of the theme, parsed on its own.
		const other = new FakeDocument(new FakeWindow());
		const clone = styleIn(other, THEME);
		h.postProcess(other.createElement("div"));
		assert.deepStrictEqual(selectors(clone), [".markdown-rendered p", ".blockquote", "body"]);
		// Obsidian's relay replacing the clone after the theme changed.
		clone.remove();
		const fresh = styleIn(other, THEME);
		other.flushMutations();
		assert.deepStrictEqual(selectors(fresh), [".markdown-rendered p", ".blockquote", "body"]);
	});

	it("follows the replayed snapshot until settings load, then the setting", () => {
		const h = harness({ startedOff: true });
		const off = registerThemeCalloutsOff(h.host);
		assert.strictEqual(h.gate(), true);
		assert.strictEqual(selectors(h.theme).length, 3);
		off.settingsReady();
		assert.strictEqual(h.gate(), false);
		assert.strictEqual(h.theme.sheet.cssRules.length, 4);
	});

	it("does nothing, and gates nothing, without Obsidian's theme element", () => {
		const h = harness({ noThemeElement: true });
		registerThemeCalloutsOff(h.host).settingsReady();
		h.setOff(true);
		assert.strictEqual(h.gate(), false);
		assert.strictEqual(h.theme.sheet.cssRules.length, 4);
		assert.strictEqual(h.refreshes, 0);
	});

	it("puts the theme back when the plugin unloads", () => {
		const h = harness();
		registerThemeCalloutsOff(h.host).settingsReady();
		h.setOff(true);
		h.unload();
		assert.strictEqual(h.theme.sheet.cssRules.length, 4);
		assert.ok(!pinned(h.theme));
		assert.strictEqual(h.gate(), false);
	});
});

/* ── What the theme's facts read while it is off ───────────────────────────── */

describe("the theme's facts while its callout styling is off", () => {
	const themed = (themeText: string, snippets: string[] = []) =>
		({
			customCss: {
				theme: "Fixture",
				themes: { Fixture: { version: "1" } },
				styleEl: { textContent: themeText },
				snippets: snippets.map((_, i) => `snippet-${i}`),
				enabledSnippets: new Set(snippets.map((_, i) => `snippet-${i}`)),
				extraStyleEls: snippets.map((text) => ({ textContent: text })),
			},
		}) as unknown as App;

	it("names no callout for the theme, and still reads the user's snippets", () => {
		const app = themed('.callout[data-callout="kanban"] { color: red; }', [
			'.callout[data-callout="note"] { color: blue !important; }',
		]);
		let off = false;
		const store = new ThemeCalloutStore(app, () => off);
		assert.deepStrictEqual([...store.themeDefinedIds()], ["kanban"]);
		off = true;
		assert.deepStrictEqual([...store.themeDefinedIds()], []);
		assert.ok(store.maxImportantClasses() > 0, "a snippet's !important no longer counted");
	});

	it("offers none of the theme's metadata words, and keeps the snippets'", () => {
		const app = themed('.callout[data-callout-metadata~="wide"] { width: 100%; }', [
			'.callout[data-callout-metadata~="tall"] { height: 10em; }',
		]);
		let off = false;
		const catalog = new ThemeMetadataCatalog(app, () => off);
		assert.deepStrictEqual(catalog.sourcesNow().map((s) => s.label), ["Fixture", "snippet-0"]);
		off = true;
		assert.deepStrictEqual(catalog.sourcesNow().map((s) => s.label), ["snippet-0"]);
	});

	it("never measures, or remembers, a theme that has lost its callout rules", async () => {
		const saved: string[] = [];
		const app = {
			customCss: { theme: "Fixture", themes: {}, styleEl: { textContent: "", sheet: { cssRules: [] } } },
			workspace: { containerEl: document.body },
		} as unknown as App;
		const check = new ThemeClaimCheck(app, {
			paused: () => true,
			nextTask: () => Promise.resolve(),
			store: { load: () => null, save: (theme) => saved.push(theme) },
		});
		let suspended = 0;
		await check.check({
			ids: ["note"],
			suspendStudioCss: () => {
				suspended++;
				return () => {};
			},
			onChange: () => assert.fail("a paused check reported a move"),
		});
		assert.strictEqual(suspended, 0);
		assert.deepStrictEqual(saved, []);
	});
});
