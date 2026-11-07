/**
 * tests/cssInjectorPreviewLayer.test.ts — a preview's rules ride in a sheet of
 * their own, so a colour drag or a retyped name does not rewrite the
 * stylesheet of the vault.
 *
 * The palette editor repaints its stand-in callout on every step of a colour
 * drag, and the callout editor its draft on every slider step and every typed
 * name. The ordinary pass writes every callout's rules, twice (the adopted
 * sheet and the `<style>` copy), and Obsidian copies that `<style>` text into
 * each pop-out window, Settings included: about 25 ms a step in a vault with
 * 750 callouts. `CSSInjector.repaintPreview` lifts the preview's rules out of
 * that text into `PreviewLayer`, which is a few hundred bytes.
 *
 * What is pinned here is the contract that makes that safe:
 *
 * - **Nothing of the preview stays in the big sheet**, or a rule it no longer
 *   needs (a gradient left from the style before) would outlive the step that
 *   removed it, under the layer's own rules.
 * - **A step writes only the layer.** That is the whole saving.
 * - **Any other pass leaves the preview where it is**, and brings the layer up
 *   to date, because a theme switch can change what its rules should say.
 * - **A demo on a reserved id never touches the big sheet** — the callout
 *   editor's draft of any callout: up, every step and down write its layer
 *   alone, and a pass with it up writes the big sheet it would without. A
 *   built-in's draft still takes the theme's colour for that built-in.
 * - **A demo raised over a real callout takes the ordinary pass.**
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
import { PREVIEW_PLACEHOLDER_ID, RESERVED_DEMO_IDS } from "../src/constants";
import type { CalloutDefinition } from "../src/types";
import { definition, parseRules } from "./support/cssInjectorHarness";

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
	/** The page's other stylesheets (`document.styleSheets`): a theme's, a snippet's. */
	readonly pageSheets: unknown[];
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
	const pageSheets: unknown[] = [];
	const doc = {
		adoptedStyleSheets: adopted,
		styleSheets: pageSheets,
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
			pageSheets,
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
	env.injector.repaintPreview();
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
			step(
				env,
				demo("#a1b2c3", {
					bgColorLight: "#eef0f6",
					bgColorDark: "#202433",
					bgGradient: { angleDeg: 135, toColorLight: "#ddeeff", toColorDark: "#112244" },
				}),
			);
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
			// demo must come out byte-identical, or `repaintPreview` skipping
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
			env.injector.repaintPreview(pane);
			assert.deepEqual(swept, [undefined]);

			// A later step touches the layer and sweeps just the pane.
			swept.length = 0;
			env.registry.setPreviewDefinition(
				demo("#445566", { icon: { type: "lucide", value: "lucide-star" } }),
				true,
			);
			env.injector.repaintPreview(pane);
			assert.deepEqual(swept, [pane]);

			// A caller that never changes its icon (the palette editor) asks for none.
			swept.length = 0;
			env.registry.setPreviewDefinition(demo("#778899"), true);
			env.injector.repaintPreview();
			assert.deepEqual(swept, []);
		});
	});

	it("takes the ordinary pass for a demo raised over a real callout", () => {
		withEnv((env) => {
			const note = env.registry.get("note");
			assert.ok(note);
			// A demo on a real id rather than one of its own. (The callout
			// editor's draft of a real callout is not a demo: see the suite below.)
			env.registry.setPreviewDefinition({ ...note, colorLight: "#a1b2c3", colorDark: "#a1b2c3" }, true);
			env.injector.repaintPreview();

			assert.equal(env.sheets.length, 1, "no layer: the callout keeps its place in the big sheet");
			assert.ok(env.sheets[0]?.text.includes("#a1b2c3"));
		});
	});

	it("takes the ordinary pass when there is no preview at all", () => {
		withEnv((env) => {
			env.injector.repaintPreview();
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

/** A callout of the user's own, in an accent easy to find in the text. */
function mine(over: Partial<CalloutDefinition> = {}): CalloutDefinition {
	return definition({ id: "mine", displayName: "Mine", colorLight: "#102030", colorDark: "#102030", ...over });
}

/* -------------------------------------------------------------------------- */
/* A demo on a reserved id: the callout editor's draft of a callout of yours  */
/* -------------------------------------------------------------------------- */

/** The editor's draft as it registers it: under the placeholder id, as a demo. */
function placeholderDraft(over: Partial<CalloutDefinition> = {}): CalloutDefinition {
	return mine({ id: PREVIEW_PLACEHOLDER_ID, colorLight: "#a1b2c3", colorDark: "#a1b2c3", ...over });
}

describe("a demo on a reserved id", () => {
	it("leaves the big sheet as it is, up, through every step, and down", () => {
		withEnv((env) => {
			env.registry.add(mine());
			env.injector.inject(false);
			const main = env.sheets[0] as FakeSheet;
			const before = main.text;
			const writes = main.writes.length;

			// A gradient too: the metadata colours must not read it into the big sheet.
			const gradient = { angleDeg: 90, toColorLight: "#ddeeff", toColorDark: "#112244" };
			env.registry.setPreviewDefinition(placeholderDraft({ bgGradient: gradient }), true);
			env.injector.repaintPreview();
			env.registry.setPreviewDefinition(placeholderDraft({ colorLight: "#445566" }), true);
			env.injector.repaintPreview();
			assert.equal(main.writes.length, writes, "no pass on the way up or through a step");

			env.injector.inject(false);
			assert.equal(main.text, before, "a pass with the demo up writes the same big sheet");

			env.registry.setPreviewDefinition(null);
			env.injector.releasePreview();
			assert.equal(main.writes.length, writes, "nor on the way down");
			assert.equal(env.sheets.length, 1, "the layer is taken away");
			assert.equal(env.layerEl(), null);
		});
	});

	it("puts the demo's own rules and its share of the global rules in the layer", () => {
		withEnv((env) => {
			env.injector.inject(false); // the plugin's first pass, made on load
			env.registry.setPreviewDefinition(placeholderDraft(), true);
			env.injector.repaintPreview();
			const layer = env.sheets[1] as FakeSheet;
			const attr = `[data-callout="${PREVIEW_PLACEHOLDER_ID}"]`;

			assert.ok(layer.text.includes("#a1b2c3"));
			assert.ok(layer.text.includes(`.callout${attr} > .callout-title > .callout-icon`), "its global share");
			assert.ok(
				!(env.sheets[0] as FakeSheet).text.includes(`.callout${attr}`),
				"and none of it in the big sheet",
			);
		});
	});

	it("keeps the fallback off every reserved id, with a demo up or not", () => {
		withEnv((env) => {
			env.injector.inject(false);
			const [fallback] = parseRules((env.sheets[0] as FakeSheet).text).filter((rule) =>
				rule.selector.startsWith(".callout:not(:where("),
			);
			assert.ok(fallback, "the fallback rule is there");
			for (const id of RESERVED_DEMO_IDS) {
				assert.ok(fallback.selector.includes(`[data-callout="${id}"]`), `${id} would take the fallback`);
			}
		});
	});

	it("keeps the pane's rules through a save's pass while the draft is up", () => {
		// The callout editor's Save: the registry change runs an ordinary pass
		// with the draft still registered, and the pane must keep showing it
		// until the window closes. Taken down first, the pass would find no
		// preview and clear the layer, and the pane would fall back to
		// Obsidian's default callout.
		withEnv((env) => {
			env.registry.add(mine());
			env.injector.inject(false);
			env.registry.setPreviewDefinition(placeholderDraft(), true);
			env.injector.repaintPreview();

			env.registry.update("mine", { colorLight: "#a1b2c3", colorDark: "#a1b2c3" });
			env.injector.inject(false);

			assert.ok((env.sheets[1] as FakeSheet).text.includes("#a1b2c3"), "the pane lost its draft");
			assert.ok((env.sheets[0] as FakeSheet).text.includes("#a1b2c3"), "the save reached the notes");
		});
	});

	it("leaves a reserved demo out of a pass that nothing asked to", () => {
		withEnv((env) => {
			env.injector.inject(false);
			const before = (env.sheets[0] as FakeSheet).text;

			// What the style pages do: register, then an ordinary pass.
			env.registry.setPreviewDefinition(placeholderDraft(), true);
			env.injector.inject(false);

			assert.equal((env.sheets[0] as FakeSheet).text, before);
			assert.ok((env.sheets[1] as FakeSheet).text.includes("#a1b2c3"));
		});
	});

	it("sweeps only the pane for painted icons, since no note can show it", () => {
		withEnv((env) => {
			env.injector.inject(false);
			const swept: Array<ParentNode | undefined> = [];
			env.injector.paintIcons = (root) => void swept.push(root);
			const pane = {} as ParentNode;

			env.registry.setPreviewDefinition(placeholderDraft(), true);
			env.injector.repaintPreview(pane);
			assert.deepEqual(swept, [pane]);
		});
	});
});

/* -------------------------------------------------------------------------- */
/* A built-in's draft under the placeholder                                   */
/* -------------------------------------------------------------------------- */

describe("a built-in's draft under the placeholder id", () => {
	// An untouched built-in takes its accent from Obsidian's rule for its id,
	// which the theme's `--callout-*` variable feeds — 74 of 257 themes colour
	// the built-ins that way without naming one. Under the placeholder that
	// rule does not reach, so the layer has to say the same thing itself.

	/** The editor's draft of `id`, as it registers it: the form's fields on the placeholder. */
	function draftOf(env: Env, id: string, over: Partial<CalloutDefinition> = {}): CalloutDefinition {
		const real = env.registry.get(id);
		assert.ok(real);
		return { ...real, id: PREVIEW_PLACEHOLDER_ID, aliases: [], builtIn: false, source: "user", ...over };
	}

	function layerFor(env: Env, draft: CalloutDefinition, savedId: string | null): string {
		env.injector.inject(false);
		env.registry.setPreviewDefinition(draft, true, true, savedId === null ? null : { savedId, id: savedId });
		env.injector.repaintPreview();
		return (env.sheets[1] as FakeSheet).text;
	}

	it("takes the theme's colour for an untouched built-in, spelled out for the placeholder", () => {
		withEnv((env) => {
			const layer = layerFor(env, draftOf(env, "warning"), "warning");
			assert.match(layer, /--callout-warning/, "the theme's variable for warning");
			assert.match(
				layer,
				/--callout-color:/,
				"imposed, since core's rule for warning does not reach the placeholder",
			);
		});
	});

	it("takes the draft's own colour once the built-in is edited", () => {
		withEnv((env) => {
			const layer = layerFor(
				env,
				draftOf(env, "warning", { colorLight: "#a1b2c3", colorDark: "#a1b2c3" }),
				"warning",
			);
			assert.doesNotMatch(layer, /--callout-warning/);
			assert.ok(layer.includes("#a1b2c3"));
		});
	});

	it("knows nothing of the built-in when the draft does not say whose it is", () => {
		withEnv((env) => {
			const layer = layerFor(env, draftOf(env, "warning"), null);
			assert.doesNotMatch(layer, /--callout-warning/);
		});
	});

	it("still leaves the big sheet as it is", () => {
		withEnv((env) => {
			env.injector.inject(false);
			const main = env.sheets[0] as FakeSheet;
			const before = main.text;
			const writes = main.writes.length;

			env.registry.setPreviewDefinition(draftOf(env, "warning"), true, true, {
				savedId: "warning",
				id: "warning",
			});
			env.injector.repaintPreview();
			env.injector.inject(false);

			assert.equal(main.writes.length, writes);
			assert.equal(main.text, before);
		});
	});
});

/* -------------------------------------------------------------------------- */
/* What the draft borrows from the rest of the page                           */
/* -------------------------------------------------------------------------- */

describe("the draft and the rules the page aims at its name", () => {
	// A snippet's border on `[!mine]` reaches every note that writes it. The
	// draft is previewed under the placeholder, so the layer carries a copy of
	// that rule aimed at the placeholder instead (css/borrowedCalloutRules.ts).

	/** A page stylesheet, owned by `owner`, holding one rule. */
	function pageSheet(selectorText: string, owner: unknown = {}): unknown {
		return {
			ownerNode: owner,
			disabled: false,
			media: { mediaText: "" },
			cssRules: [{ selectorText, style: { cssText: "border: 3px dashed purple;" } }],
		};
	}

	function previewOf(env: Env, id: string): string {
		env.registry.setPreviewDefinition(placeholderDraft(), true, true, { savedId: "mine", id });
		env.injector.repaintPreview();
		return (env.sheets[1] as FakeSheet).text;
	}

	it("borrows a snippet's rule for the draft's name, aimed at the placeholder", () => {
		withEnv((env) => {
			env.registry.add(mine());
			env.pageSheets.push(pageSheet('.callout[data-callout="mine"]'));
			env.injector.inject(false);
			const main = env.sheets[0] as FakeSheet;
			const writes = main.writes.length;

			const layer = previewOf(env, "mine");

			assert.ok(
				layer.includes(`.callout[data-callout="${PREVIEW_PLACEHOLDER_ID}"] { border: 3px dashed purple; }`),
			);
			assert.ok(layer.indexOf("dashed purple") < layer.indexOf("#a1b2c3"), "before the draft's own rules");
			assert.equal(main.writes.length, writes, "the big sheet is not touched");
		});
	});

	it("follows the name being typed", () => {
		withEnv((env) => {
			env.registry.add(mine());
			env.pageSheets.push(pageSheet('.callout[data-callout="mine"]'));
			env.pageSheets.push(pageSheet('.callout[data-callout="plan"]'));
			env.injector.inject(false);

			const layer = previewOf(env, "plan");
			assert.equal(layer.split("dashed purple").length - 1, 1, "the rule for the new name, not the old one");
		});
	});

	it("never borrows from this plugin's own stylesheet, which holds the saved callout", () => {
		withEnv((env) => {
			env.registry.add(mine());
			env.injector.inject(false);
			env.pageSheets.push(pageSheet('.callout[data-callout="mine"]', env.mainEl()));
			env.injector.inject(false);

			assert.doesNotMatch(previewOf(env, "mine"), /dashed purple/);
		});
	});

	it("reads the page again after a pass, not on every step", () => {
		withEnv((env) => {
			env.registry.add(mine());
			env.injector.inject(false);
			assert.doesNotMatch(previewOf(env, "mine"), /dashed purple/);

			// A snippet switched on: Obsidian fires css-change, which runs a pass.
			env.pageSheets.push(pageSheet('.callout[data-callout="mine"]'));
			assert.doesNotMatch(previewOf(env, "mine"), /dashed purple/, "a step reuses what was read");
			env.injector.inject(false);
			assert.match((env.sheets[1] as FakeSheet).text, /dashed purple/);
		});
	});
});
