/**
 * tests/cssInjectorPreviewLayer.test.ts — a demo preview's rules ride in a sheet
 * of their own, so a colour drag does not rewrite the stylesheet of the vault.
 *
 * The palette editor repaints its stand-in callout on every step of a colour
 * drag. The ordinary pass writes every callout's rules, twice (the adopted
 * sheet and the `<style>` copy), and Obsidian copies that `<style>` text into
 * each pop-out window, Settings included: about 25 ms a step in a vault with
 * 750 callouts. `CSSInjector.repaintDemoPreview` lifts the demo's rules out of
 * that text into `PreviewLayer`, which is a few hundred bytes.
 *
 * What is pinned here is the contract that makes that safe:
 *
 * - **Nothing of the demo stays in the big sheet**, or a rule it no longer
 *   needs (a gradient left from the style before) would outlive the step that
 *   removed it, under the layer's own rules.
 * - **A step writes only the layer.** That is the whole saving.
 * - **Any other pass leaves the demo where it is**, and brings the layer up to
 *   date, because a theme switch can change what the demo's rules should say.
 * - **Whatever is not a lone demo takes the ordinary pass.** A preview that
 *   shadows a real callout sits in that callout's place in the sheet and
 *   cannot be lifted out of it.
 * - **Releasing the preview takes the layer away**, element and sheet both.
 *
 * `{} as App` will not do here: the layer touches `app.workspace`, and the
 * injector wants a document with adopted sheets. The fake below records every
 * write to either sheet or either `<style>` element so a test can count them.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { CSSInjector } from "../src/manager/CSSInjector";
import type { CalloutDefinition } from "../src/types";
import { definition } from "./support/cssInjectorHarness";

class FakeSheet {
	disabled = false;
	/** Every text `replaceSync` was handed, in order. */
	writes: string[] = [];
	get text(): string {
		return this.writes.at(-1) ?? "";
	}
	replaceSync(text: string): void {
		this.writes.push(text);
	}
}

class FakeStyleEl {
	id = "";
	disabled = false;
	isConnected = false;
	writes: string[] = [];
	get textContent(): string {
		return this.writes.at(-1) ?? "";
	}
	set textContent(text: string) {
		this.writes.push(text);
	}
	remove(): void {
		this.isConnected = false;
	}
}

const MAIN_EL_ID = "callout-studio-dynamic-css";
const LAYER_EL_ID = "callout-studio-preview-css";
const DEMO_ID = "palette-demo";

interface Env {
	registry: CalloutRegistry;
	injector: CSSInjector;
	/**
	 * Adopted sheets in adoption order: the main one first, the layer after.
	 * Read fresh each time: the injector assigns a new array on every adoption.
	 */
	readonly sheets: FakeSheet[];
	mainEl(): FakeStyleEl;
	layerEl(): FakeStyleEl | null;
}

function withEnv(body: (env: Env) => void): void {
	const g = globalThis as Record<string, unknown>;
	const saved = {
		activeDocument: g.activeDocument,
		createEl: g.createEl,
		HTMLStyleElement: g.HTMLStyleElement,
		window: g.window,
	};
	const elements = new Map<string, FakeStyleEl>();
	const adopted: FakeSheet[] = [];
	const doc = {
		adoptedStyleSheets: adopted,
		defaultView: { CSSStyleSheet: FakeSheet },
		head: {
			appendChild(el: FakeStyleEl) {
				el.isConnected = true;
				elements.set(el.id, el);
			},
		},
		getElementById: (id: string) => {
			const el = elements.get(id);
			return el?.isConnected ? el : null;
		},
		querySelectorAll: () => [],
		body: { classList: { contains: () => false } },
	};
	const app = {
		appId: "test-vault",
		workspace: {
			containerEl: { ownerDocument: doc },
			iterateAllLeaves: () => {},
			trigger: () => {},
		},
	} as unknown as App;

	g.activeDocument = doc;
	g.createEl = () => new FakeStyleEl();
	g.HTMLStyleElement = FakeStyleEl;
	g.window = { localStorage: { getItem: () => null, setItem: () => {} } };
	try {
		const registry = new CalloutRegistry();
		registry.load(null);
		const injector = new CSSInjector(app, registry);
		body({
			registry,
			injector,
			get sheets() {
				return doc.adoptedStyleSheets;
			},
			mainEl: () => elements.get(MAIN_EL_ID) as FakeStyleEl,
			layerEl: () => doc.getElementById(LAYER_EL_ID),
		});
	} finally {
		Object.assign(g, saved);
	}
}

/** A stand-in callout whose accent is easy to tell apart in the text. */
function demo(accent: string, over: Partial<CalloutDefinition> = {}): CalloutDefinition {
	return definition({ id: DEMO_ID, colorLight: accent, colorDark: accent, ...over });
}

/** Register `def` as the demo preview and repaint, as the palette editor does. */
function step(env: Env, def: CalloutDefinition): void {
	env.registry.setPreviewDefinition(def, true);
	env.injector.repaintDemoPreview();
}

describe("a demo preview in the preview layer", () => {
	it("leaves the demo's rules out of the main sheet and puts them in the layer", () => {
		withEnv((env) => {
			step(env, demo("#a1b2c3"));
			const [main, layer] = env.sheets;
			assert.ok(main && layer, "a second sheet is adopted after the main one");
			assert.ok(layer.text.includes("#a1b2c3"), "the demo's accent is in the layer");
			assert.ok(!main.text.includes("#a1b2c3"), "and not in the big sheet");
			assert.ok(!env.mainEl().textContent.includes("#a1b2c3"), "nor in its <style> copy");
			assert.ok(env.layerEl()?.textContent.includes("#a1b2c3"), "the layer's own <style> copy carries it");
		});
	});

	it("rewrites only the layer on a later step", () => {
		withEnv((env) => {
			step(env, demo("#a1b2c3"));
			const [main] = env.sheets as [FakeSheet];
			const mainWrites = main.writes.length;
			const mainElWrites = env.mainEl().writes.length;

			step(env, demo("#c3b2a1"));
			step(env, demo("#112233"));

			assert.equal(main.writes.length, mainWrites, "the big sheet is not touched");
			assert.equal(env.mainEl().writes.length, mainElWrites, "nor its <style> copy");
			const layer = env.sheets[1] as FakeSheet;
			assert.ok(layer.text.includes("#112233"));
			assert.ok(!layer.text.includes("#a1b2c3"), "the old accent is gone, not left beside the new");
		});
	});

	it("takes the old step's rules away whole, so a gradient does not outlive its style", () => {
		withEnv((env) => {
			// The first stop of a gradient is the callout's own background colour.
			step(env, demo("#a1b2c3", {
				bgColorLight: "#eef0f6",
				bgColorDark: "#202433",
				bgGradient: { angleDeg: 135, toColorLight: "#ddeeff", toColorDark: "#112244" },
			}));
			const layer = env.sheets[1] as FakeSheet;
			assert.match(layer.text, /linear-gradient/);

			step(env, demo("#a1b2c3"));
			assert.doesNotMatch(layer.text, /linear-gradient/);
		});
	});

	it("keeps the demo out of the main sheet through any other pass, and refreshes the layer", () => {
		withEnv((env) => {
			step(env, demo("#a1b2c3"));
			const main = env.sheets[0] as FakeSheet;

			// What an icon download landing, or a theme switch, does.
			env.injector.inject(false);
			assert.ok(!main.text.includes("#a1b2c3"), "still out of the big sheet");
			const layer = env.sheets[1] as FakeSheet;
			assert.ok(layer.text.includes("#a1b2c3"), "still in the layer");
			assert.equal(env.sheets.length, 2, "one layer, not a second one per pass");
		});
	});

	it("makes a big sheet that does not depend on the demo's colours at all", () => {
		withEnv((env) => {
			step(env, demo("#a1b2c3"));
			const main = env.sheets[0] as FakeSheet;
			const before = main.text;
			const writes = main.writes.length;

			// The step above only moved the layer. A whole pass over a different
			// demo must come out byte-identical, or `repaintDemoPreview` skipping
			// the whole pass would be skipping something it owed.
			env.registry.setPreviewDefinition(demo("#112233", { hideIcon: true, transparentBg: true }), true);
			env.injector.inject(false);

			assert.equal(main.text, before);
			assert.equal(main.writes.length, writes, "nothing was rewritten");
		});
	});

	it("takes the layer away, sheet and element, when the preview is released", () => {
		withEnv((env) => {
			step(env, demo("#a1b2c3"));
			assert.equal(env.sheets.length, 2);

			env.registry.setPreviewDefinition(null);
			env.injector.inject(false);

			assert.equal(env.sheets.length, 1, "only the main sheet is left adopted");
			assert.equal(env.layerEl(), null);
			assert.ok(!env.sheets[0]?.text.includes("#a1b2c3"));
		});
	});

	it("starts over cleanly when the same demo comes back", () => {
		withEnv((env) => {
			step(env, demo("#a1b2c3"));
			env.registry.setPreviewDefinition(null);
			env.injector.inject(false);

			step(env, demo("#445566"));
			assert.equal(env.sheets.length, 2);
			assert.ok((env.sheets[1] as FakeSheet).text.includes("#445566"));
			assert.ok(!(env.sheets[0] as FakeSheet).text.includes("#445566"), "the big sheet was rebuilt without it");
		});
	});

	it("sweeps only the given root for painted icons, since an icon is DOM and not CSS", () => {
		withEnv((env) => {
			const swept: Array<ParentNode | undefined> = [];
			env.injector.paintIcons = (root) => void swept.push(root);
			const pane = {} as ParentNode;

			// The first call is the ordinary pass, which sweeps everything.
			env.registry.setPreviewDefinition(demo("#a1b2c3"), true);
			env.injector.repaintDemoPreview(pane);
			assert.deepEqual(swept, [undefined]);

			// A later step touches the layer and sweeps just the pane.
			swept.length = 0;
			env.registry.setPreviewDefinition(demo("#445566", { icon: { type: "lucide", value: "lucide-star" } }), true);
			env.injector.repaintDemoPreview(pane);
			assert.deepEqual(swept, [pane]);

			// A caller that never changes its icon (the palette editor) asks for none.
			swept.length = 0;
			env.registry.setPreviewDefinition(demo("#778899"), true);
			env.injector.repaintDemoPreview();
			assert.deepEqual(swept, []);
		});
	});

	it("takes the ordinary pass for a preview that shadows a real callout", () => {
		withEnv((env) => {
			const note = env.registry.get("note");
			assert.ok(note);
			// The callout editor's own preview: the real id, not a demo of its own.
			env.registry.setPreviewDefinition({ ...note, colorLight: "#a1b2c3", colorDark: "#a1b2c3" }, true);
			env.injector.repaintDemoPreview();

			assert.equal(env.sheets.length, 1, "no layer: the callout keeps its place in the big sheet");
			assert.ok(env.sheets[0]?.text.includes("#a1b2c3"));
		});
	});

	it("takes the ordinary pass when there is no preview at all", () => {
		withEnv((env) => {
			env.injector.repaintDemoPreview();
			assert.equal(env.sheets.length, 1);
			assert.ok(env.sheets[0]?.text.includes("Auto-generated by Callout Studio"));
		});
	});

	it("is switched off with the rest of the plugin's styles by suspendOwnStyles", () => {
		withEnv((env) => {
			step(env, demo("#a1b2c3"));
			const restore = env.injector.suspendOwnStyles();
			assert.equal((env.sheets[1] as FakeSheet).disabled, true);
			assert.equal(env.layerEl()?.disabled, true);
			restore();
			assert.equal((env.sheets[1] as FakeSheet).disabled, false);
			assert.equal(env.layerEl()?.disabled, false);
		});
	});

	it("is removed with the injector", () => {
		withEnv((env) => {
			step(env, demo("#a1b2c3"));
			env.injector.destroy();
			assert.equal(env.layerEl(), null);
			assert.ok(!env.sheets.some((s) => s.text.includes("#a1b2c3")) || env.sheets.length < 2);
		});
	});
});
