/**
 * tests/cssInjectorInject.test.ts — the pass as a whole: what `generateCalloutCSS`
 * emits for representative definitions, the re-entrancy latch, the no-op guard
 * that keeps repeat injects cheap, and the one place the injector interpolates
 * untrusted text into a selector without escaping it.
 *
 * Two of these need a document, which Node has none of. `injectHarness()` below
 * builds the smallest fake that `inject()` actually touches — deliberately a
 * *recorder*, not a DOM: it counts writes and hands back the text, and pretends
 * to lay nothing out. `adoptedStyleSheets` is left off it on purpose, which
 * takes `ensureStyleSheet` down its early return and leaves the `<style>`
 * element as the single observable target. That is the honest half to observe
 * anyway: it is the one Obsidian's PDF export reads.
 *
 * ── Two findings are recorded here rather than asserted ──────────────────────
 *
 * **There is no `scheduleInject` and no debounce.** The item this file was
 * written against asks for "N changes ⇒ one inject". That is not what the code
 * does, and not by accident: `main.ts` documents that scheduling a debounced
 * inject *and* triggering `css-change` ran the whole pass twice per mutation —
 * the trigger landed in the plugin's own `css-change` listener, which injects
 * immediately, and the debounced timer then repeated it 300ms later. The
 * debounce was removed. What collapses repeat work now is `lastCssText`: every
 * change injects, and every inject whose output is byte-identical stops before
 * the stylesheet swap, the localStorage write and the `css-change`. That is the
 * property pinned below — and, since the two docs that still named the removed
 * method were what made this look like a missing feature rather than a decision,
 * the last describe block keeps them honest as text.
 *
 * **A callout id is interpolated into a CSS selector unescaped.** See the last
 * describe block. Its tests are `todo`, so they report without failing the
 * suite — the fix belongs in `calloutSel`, not here.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { CSSInjector } from "../src/manager/CSSInjector";
import { definition, outline, parseRules } from "./support/cssInjectorHarness";
import { pluginSourceFiles, readRepoFile } from "./support/sourceScan";
import type { CalloutDefinition } from "../src/types";

/* ────────────────────────────────────────────────────────────────────────────
 * A fake just wide enough for inject()
 * ──────────────────────────────────────────────────────────────────────────── */

interface FakeStyleEl {
	id: string;
	textContent: string;
	isConnected: boolean;
	remove(): void;
}

interface Recorder {
	registry: CalloutRegistry;
	injector: CSSInjector;
	/** Text writes that actually reached the <style> element. */
	writes: string[];
	/** Every `workspace.trigger` name, in order. */
	triggers: string[];
	/** localStorage writes (the startup snapshot). */
	persists: string[];
	/** The text currently installed. */
	css(): string;
	restore(): void;
}

/**
 * Run `body` against a fresh recorder, restoring the ambient globals afterwards
 * whatever happens.
 *
 * A wrapper rather than `t.after()`: the pinned `@types/node@16` types
 * `node:test`'s callback parameter as a `done` function and its `TestContext`
 * without `after`, so the hook form does not typecheck even though it runs.
 * Wrapping is also stricter — the globals come back on a thrown assertion too.
 */
function withInjector(body: (h: Recorder) => void): void {
	const h = injectHarness();
	try {
		body(h);
	} finally {
		h.restore();
	}
}

function injectHarness(): Recorder {
	const writes: string[] = [];
	const triggers: string[] = [];
	const persists: string[] = [];

	const styleEl: FakeStyleEl = {
		id: "",
		isConnected: true,
		remove() {
			this.isConnected = false;
		},
		get textContent() {
			return writes.at(-1) ?? "";
		},
		set textContent(value: string) {
			writes.push(value);
		},
	};

	// `head.appendChild` is where the element becomes findable; before that
	// `getElementById` must miss, exactly as a real head does.
	let attached = false;
	const doc = {
		head: {
			appendChild(el: FakeStyleEl) {
				attached = true;
				el.isConnected = true;
			},
		},
		getElementById: (id: string) =>
			attached && id === styleEl.id ? styleEl : null,
		querySelectorAll: () => [],
		body: { classList: { contains: () => false } },
	};

	const app = {
		appId: "test-vault",
		workspace: {
			containerEl: { ownerDocument: doc },
			iterateAllLeaves: () => {},
			trigger: (name: string) => triggers.push(name),
		},
	} as unknown as App;

	const g = globalThis as Record<string, unknown>;
	const saved = {
		activeDocument: g.activeDocument,
		createEl: g.createEl,
		HTMLStyleElement: g.HTMLStyleElement,
		window: g.window,
	};

	// `activeDocument`, `createEl` and `HTMLStyleElement` are ambient globals in
	// the Obsidian renderer; esbuild leaves them as free identifiers, so seeding
	// globalThis is all it takes. Note the LACK of `adoptedStyleSheets` — that
	// sends ensureStyleSheet down its early return and leaves the <style>
	// element as the one observable target.
	g.activeDocument = doc;
	g.createEl = (tag: string) => {
		assert.strictEqual(tag, "style");
		return styleEl;
	};
	g.HTMLStyleElement = class {} as unknown;
	g.window = {
		localStorage: {
			getItem: () => null,
			setItem: (_k: string, v: string) => persists.push(v),
		},
	};

	const registry = new CalloutRegistry();
	registry.load(null);
	// A clean install hands an unconfigured built-in to the theme; these
	// suites are about what the plugin emits when it IS painting. The
	// default itself lives in tests/styleMode.test.ts.
	const injector = new CSSInjector(app, registry);

	return {
		registry,
		injector,
		writes,
		triggers,
		persists,
		css: () => writes.at(-1) ?? "",
		restore() {
			Object.assign(g, saved);
		},
	};
}

/* ────────────────────────────────────────────────────────────────────────────
 * The structural snapshot
 * ──────────────────────────────────────────────────────────────────────────── */

describe("generateCalloutCSS — structural snapshot", () => {
	/**
	 * Compared as an *outline*: one line per rule, at-rules, then the selector,
	 * then the property names alone — never the values.
	 *
	 * A snapshot over raw text would turn every colour tweak into a failed test
	 * and teach whoever hits it to re-bless without reading. What must not move
	 * silently is which selectors are emitted, in what order, carrying which
	 * properties. Values are pinned by the other four suites, on the unit that
	 * decides each one.
	 */
	const snap = (def: Partial<CalloutDefinition>) => {
		const registry = new CalloutRegistry();
		registry.load(null);
		const injector = new CSSInjector({} as App, registry);
		const css = injector as unknown as {
			generateCalloutCSS(d: ReturnType<typeof definition>): string;
		};
		return outline(css.generateCalloutCSS(definition(def)));
	};

	it("an unmodified built-in: two accent rules and nothing else", () => {
		const registry = new CalloutRegistry();
		registry.load(null);
		const injector = new CSSInjector({} as App, registry);
		const note = registry.get("note");
		assert.ok(note);
		const got = outline(
			(
				injector as unknown as {
					generateCalloutCSS(d: typeof note): string;
				}
			).generateCalloutCSS(note),
		);
		// --cs-accent-theme rides along wherever the accent is a theme variable
		// rather than our own hex: it is the `<color>`-typed hand-off that keeps
		// a malformed theme value out of the color-mix() calls downstream.
		assert.deepStrictEqual(got, [
			'.callout[data-callout="note"] { --cs-accent-theme, --cs-accent, --cs-color-rgb, --callout-icon }',
			'.theme-dark .callout[data-callout="note"] { --cs-accent-theme, --cs-accent, --cs-color-rgb }',
			'.cs-inline-callout[data-callout="note"], .cs-heading-callout[data-callout="note"], .cs-ref-token[data-callout="note"] { --cs-accent-theme, --cs-accent, --cs-color-rgb }',
			'.theme-dark .cs-inline-callout[data-callout="note"], .theme-dark .cs-heading-callout[data-callout="note"], .theme-dark .cs-ref-token[data-callout="note"] { --cs-accent-theme, --cs-accent, --cs-color-rgb }',
		]);
	});

	it("a plain user callout: the same shape, plus core's own variable", () => {
		assert.deepStrictEqual(snap({}), [
			'.callout[data-callout="quiet"] { --callout-color, --cs-accent, --cs-color-rgb, --callout-icon }',
			'.theme-dark .callout[data-callout="quiet"] { --callout-color, --cs-accent, --cs-color-rgb }',
			'.cs-inline-callout[data-callout="quiet"], .cs-heading-callout[data-callout="quiet"], .cs-ref-token[data-callout="quiet"] { --cs-accent, --cs-color-rgb }',
			'.theme-dark .cs-inline-callout[data-callout="quiet"], .theme-dark .cs-heading-callout[data-callout="quiet"], .theme-dark .cs-ref-token[data-callout="quiet"] { --cs-accent, --cs-color-rgb }',
		]);
	});

	it("a solid background reaches the block and both painted token roles", () => {
		assert.deepStrictEqual(snap({ bgColorLight: "#eef4fa", bgColorDark: "#16202b" }), [
			'.callout[data-callout="quiet"] { --callout-color, --cs-accent, --cs-color-rgb, --callout-icon, background-color }',
			'.theme-dark .callout[data-callout="quiet"] { --callout-color, --cs-accent, --cs-color-rgb, background-color }',
			'.cs-inline-callout[data-callout="quiet"], .cs-heading-callout[data-callout="quiet"], .cs-ref-token[data-callout="quiet"] { --cs-accent, --cs-color-rgb }',
			'.theme-dark .cs-inline-callout[data-callout="quiet"], .theme-dark .cs-heading-callout[data-callout="quiet"], .theme-dark .cs-ref-token[data-callout="quiet"] { --cs-accent, --cs-color-rgb }',
			'.cs-inline-callout[data-callout="quiet"], .cs-heading-callout[data-callout="quiet"] { background-color }',
			'.theme-dark .cs-inline-callout[data-callout="quiet"], .theme-dark .cs-heading-callout[data-callout="quiet"] { background-color }',
		]);
	});

	it("a transparent callout adds the outline half, light rule only", () => {
		assert.deepStrictEqual(snap({ transparentBg: true }), [
			'.callout[data-callout="quiet"] { --callout-color, --cs-accent, --cs-color-rgb, --callout-icon, background-color, background-image, box-shadow, border-color }',
			'.theme-dark .callout[data-callout="quiet"] { --callout-color, --cs-accent, --cs-color-rgb, background-color, background-image }',
			'.cs-inline-callout[data-callout="quiet"], .cs-heading-callout[data-callout="quiet"], .cs-ref-token[data-callout="quiet"] { --cs-accent, --cs-color-rgb }',
			'.theme-dark .cs-inline-callout[data-callout="quiet"], .theme-dark .cs-heading-callout[data-callout="quiet"], .theme-dark .cs-ref-token[data-callout="quiet"] { --cs-accent, --cs-color-rgb }',
			'.cs-inline-callout[data-callout="quiet"], .cs-heading-callout[data-callout="quiet"] { background-color, background-image }',
		]);
	});

	it("a swept gradient: 8 print rules, 6 sweeps, 2 chevrons", () => {
		const lines = snap({
			bgColorLight: "#eef4fa",
			bgColorDark: "#16202b",
			bgGradient: {
				angleDeg: 90,
				toColorLight: "#fdf0e6",
				toColorDark: "#2b1f16",
				textGradient: true,
				textToColorLight: "#cc5500",
				textToColorDark: "#ffaa66",
			},
		});
		// Counted rather than spelled out: the exact 30 lines are pinned by the
		// four value suites, and what matters at this altitude is that no role
		// silently loses its print repaint or its sweep.
		const printed = lines.filter((l) => l.startsWith("@media print"));
		const before = lines.filter((l) => l.includes("::before"));
		// Screen sweeps only — each one is answered by a print rule that resets
		// `-webkit-text-fill-color` back to currentColor, and counting those too
		// would hide a lost sweep behind its own undo.
		const sweeps = lines.filter(
			(l) => !l.startsWith("@media print") && l.includes("-webkit-text-fill-color"),
		);
		const chevrons = lines.filter((l) => l.includes(".callout-fold"));
		// One ::before pair per painted role: block callout, heading bar, pill.
		assert.strictEqual(before.length, 6, lines.join("\n"));
		assert.ok(printed.length >= before.length);
		// One light + one dark sweep per swept element: title-inner, pill, heading.
		assert.strictEqual(sweeps.length, 6, lines.join("\n"));
		assert.strictEqual(chevrons.length, 2);
	});

	it("a callout handed to the user's own CSS emits nothing whatsoever", () => {
		assert.deepStrictEqual(snap({ externalStyle: true }), []);
	});

	it("with no exception, not even for hideIcon", () => {
		// This used to emit the single `display: none`, on the argument that a
		// theme has no way to say "draw no icon". Under an absolute rule that is
		// an override like any other — and the one most likely to read as the
		// plugin breaking someone's theme. The flag is kept on the row.
		assert.deepStrictEqual(snap({ externalStyle: true, hideIcon: true }), []);
	});

	it("every alias gets a full copy of the block rules", () => {
		const lines = snap({
			aliases: ["hush"],
			bgColorLight: "#eef4fa",
			bgColorDark: "#16202b",
			textColorLight: "#111111",
			textColorDark: "#eeeeee",
		});
		for (const shape of [
			'.callout[data-callout="hush"] {',
			'.theme-dark .callout[data-callout="hush"] {',
			'.callout[data-callout="hush"] > .callout-content {',
			'.theme-dark .callout[data-callout="hush"] > .callout-content {',
		]) {
			assert.ok(
				lines.some((l) => l.startsWith(shape)),
				`missing alias rule ${shape}\n${lines.join("\n")}`,
			);
		}
	});

	it("skips the dark content-colour rule when it would repeat the light one", () => {
		const lines = snap({ textColorLight: "#111111", textColorDark: "#111111" });
		assert.strictEqual(
			lines.filter((l) => l.includes("callout-content")).length,
			1,
		);
	});

	it("every generated rule is balanced and non-empty", () => {
		const cases: Partial<CalloutDefinition>[] = [
			{},
			{ transparentBg: true },
			{ hideIcon: true },
			{ aliases: ["hush", "still"] },
			{ textColorLight: "#111111" },
		];
		for (const def of cases) {
			const rules = parseRules(
				(() => {
					const registry = new CalloutRegistry();
					registry.load(null);
					const injector = new CSSInjector({} as App, registry);
					return (
						injector as unknown as {
							generateCalloutCSS(d: ReturnType<typeof definition>): string;
						}
					).generateCalloutCSS(definition(def));
				})(),
			);
			for (const rule of rules) {
				assert.ok(rule.selector.length > 0, JSON.stringify(def));
				assert.ok(rule.decls.length > 0, `${rule.selector} is empty`);
			}
		}
	});
});

/* ────────────────────────────────────────────────────────────────────────────
 * inject()
 * ──────────────────────────────────────────────────────────────────────────── */

describe("inject — the re-entrancy latch", () => {
	it("makes a nested inject a no-op instead of a second full pass", () =>
		withInjector((h) => {
			// The real shape of this: inject() ends in `workspace.trigger("css-change")`,
			// and the plugin's own css-change listener answers that by injecting
			// again. What the latch has to stop is the *generation pass* running a
			// second time, which is counted here rather than inferred from the
			// output — the lastCssText guard would swallow the duplicate write and
			// make a missing latch look identical from outside.
			const internals = h.injector as unknown as {
				generateFallbackCSS(callouts: unknown[]): string;
			};
			const real = internals.generateFallbackCSS.bind(internals);
			let passes = 0;
			internals.generateFallbackCSS = (callouts) => {
				passes++;
				return real(callouts);
			};

			const app = h.injector as unknown as {
				app: { workspace: { trigger(name: string): void } };
			};
			const realTrigger = app.app.workspace.trigger.bind(app.app.workspace);
			let reentered = 0;
			app.app.workspace.trigger = (name: string) => {
				realTrigger(name);
				reentered++;
				h.injector.inject();
			};

			h.injector.inject();
			assert.strictEqual(reentered, 1, "the listener must have fired once");
			assert.strictEqual(passes, 1, "the nested call ran a second full pass");
		}));

	it("clears the latch even when the pass throws", () =>
		withInjector((h) => {
			// `finally` is load-bearing: a throw anywhere in the pass (a malformed
			// colour, an export realm without setIcon) would otherwise leave the
			// latch stuck on and silently drop every later inject for the rest of the
			// session.
			const internals = h.injector as unknown as {
				generateGlobalStyleCSS(): string;
			};
			const real = internals.generateGlobalStyleCSS.bind(internals);
			internals.generateGlobalStyleCSS = () => {
				throw new Error("boom");
			};
			assert.throws(() => h.injector.inject(), /boom/);

			internals.generateGlobalStyleCSS = real;
			h.injector.inject();
			assert.ok(h.writes.length > 0, "the latch stayed on after a throw");
		}));
});

describe("inject — the no-op guard that replaced the debounce", () => {
	it("writes once, then stops before the swap for identical output", () =>
		withInjector((h) => {
			h.injector.inject();
			assert.strictEqual(h.writes.length, 1);
			assert.strictEqual(h.triggers.length, 1);
			assert.strictEqual(h.persists.length, 1);

			// Injects are far more frequent than actual CSS changes: an icon download
			// landing, a prune that removed nothing, another plugin's css-change, and
			// every step of a multi-callout import all arrive with byte-identical
			// output. Answering each with a full stylesheet swap, a synchronous
			// localStorage write and a css-change is what made the mobile view jump —
			// core answers that event by rebuilding EVERY open editor.
			for (let i = 0; i < 5; i++) h.injector.inject();
			assert.strictEqual(h.writes.length, 1, "re-wrote unchanged CSS");
			assert.strictEqual(h.triggers.length, 1, "re-emitted css-change for nothing");
			assert.strictEqual(h.persists.length, 1, "re-persisted unchanged CSS");
		}));

	it("writes again as soon as the output really moves", () =>
		withInjector((h) => {
			h.injector.inject();
			h.registry.add(definition({ id: "fresh" }));
			h.injector.inject();

			assert.strictEqual(h.writes.length, 2);
			assert.strictEqual(h.triggers.length, 2);
			assert.ok(h.css().includes('data-callout="fresh"'));
		}));

	it("N distinct changes are N injects — there is no debounce to collapse them", () =>
		withInjector((h) => {
			// Recorded rather than lamented: see the suite header. The dedup is by
			// OUTPUT, not by time, which is what makes it correct for the case a
			// timer got wrong — an import that touches ten callouts produces one
			// stylesheet swap per real change and none for the passes in between.
			for (let i = 0; i < 4; i++) {
				h.registry.add(definition({ id: `row ${i}` }));
				h.injector.inject();
			}
			assert.strictEqual(h.writes.length, 4);
			assert.strictEqual(
				typeof (h.injector as unknown as Record<string, unknown>).scheduleInject,
				"undefined",
				"a scheduleInject would need its own debounce tests — see the suite header",
			);
		}));

	it("never emits css-change when reacting to someone else's", () =>
		withInjector((h) => {
			// Re-emitting would loop with other plugins that also listen and re-emit
			// (Style Settings' own settings UI flickers endlessly).
			h.injector.inject(false);
			assert.strictEqual(h.writes.length, 1);
			assert.strictEqual(h.triggers.length, 0);
		}));

	it("keeps an unsaved live-preview draft out of the startup snapshot", () =>
		withInjector((h) => {
			h.injector.inject();
			const before = h.persists.length;

			h.registry.setPreviewDefinition(
				definition({ id: "note", colorLight: "#ff0000", builtIn: true }),
			);
			h.injector.inject();

			// The CSS still lands (the user is looking at it), but nothing describing
			// a draft reaches disk — toSaveData() already goes out of its way to keep
			// it off, and hovering a colour in the palette menu would otherwise cost a
			// synchronous localStorage write per swatch.
			assert.ok(h.writes.length > 1, "the preview CSS must still be installed");
			assert.strictEqual(h.persists.length, before);
		}));

	it("leaves the snapshot on disk matching the committed CSS across a preview", () =>
		withInjector((h) => {
			h.injector.inject();
			const committed = h.css();

			h.registry.setPreviewDefinition(
				definition({ id: "note", colorLight: "#ff0000", builtIn: true }),
			);
			h.injector.inject();
			h.registry.setPreviewDefinition(null);
			h.injector.inject();

			// Clearing the preview re-injects, and the CSS returns to exactly what
			// was persisted before it — so `StartupStyleCache`'s own dedupe skips a
			// second write rather than the snapshot going stale. Both halves matter:
			// nothing extra reached disk, and what is on disk is the committed CSS.
			assert.strictEqual(h.css(), committed);
			assert.deepStrictEqual(h.persists, [committed]);
		}));
});

describe("inject — what lands in the stylesheet", () => {
	it("opens with the generated-file banner and carries every callout", () =>
		withInjector((h) => {
			h.injector.inject();

			const css = h.css();
			assert.ok(css.startsWith("/* Auto-generated by Callout Studio"));
			for (const def of h.registry.getAll()) {
				assert.ok(
					css.includes(`data-callout="${def.id}"`),
					`${def.id} missing from the stylesheet`,
				);
			}
		}));

	it("hides the baked export icons on screen, and only on screen", () =>
		withInjector((h) => {
			h.injector.inject();

			// The DOM copies paintIcons bakes are what PDF export shows. Hiding them
			// inside @media screen is what reveals them in print, where an inline SVG
			// renders far more reliably than a CSS mask.
			const hide = parseRules(h.css()).find((r) =>
				r.selector.includes(".cs-export-icon"),
			);
			assert.ok(hide);
			assert.deepStrictEqual(hide.at, ["@media screen"]);
		}));

	it("destroy() drops the element and forgets what was installed", () =>
		withInjector((h) => {
			h.injector.inject();
			h.injector.destroy();
			h.injector.inject();
			// Both targets are gone, so the next pass must write unconditionally
			// rather than trusting a cached copy of text nobody is showing.
			assert.strictEqual(h.writes.length, 2);
		}));
});

/* ────────────────────────────────────────────────────────────────────────────
 * Security: the id in the selector
 * ──────────────────────────────────────────────────────────────────────────── */

describe("SECURITY — a callout id in a selector is escaped, not concatenated", () => {
	/**
	 * `calloutSel` builds `.callout[data-callout="<id>"]`, and
	 * `obsidianCalloutAttrId` — which is all it used to run the id through —
	 * only trims, lowercases and dasherizes whitespace. It escapes nothing, so
	 * a `"` or a `\` in the id used to reach the stylesheet verbatim.
	 *
	 * Both characters get there without the user typing them into the ID field
	 * (`sanitizeCalloutIdInput` does strip them, which is what hid this):
	 *
	 * - **Vault discovery.** The scanner's header regex is `\[!([^\]\n\r]+)\]`,
	 *   so a note containing `> [!ev"il]` yields the id `ev"il`, and
	 *   `CalloutDiscovery` auto-creates a fallback row for it. Opening a shared
	 *   note is enough.
	 * - **Import.** `ID_BAD_CHAR_RE` is `/[|\][\t\n\r]/` — it rejects pipes,
	 *   brackets and non-space whitespace, and permits `"` and `\`.
	 *
	 * What it cost: `]` IS filtered on both paths, so an attacker cannot close
	 * the attribute selector and open a declaration block of their own — this
	 * was never arbitrary rule injection. What they got is parser corruption. A
	 * bare `"` makes the selector invalid, and CSS error recovery discards the
	 * whole rule; a TRAILING `\` escapes the closing quote the selector wrote,
	 * so the string token runs on and swallows the text after it. Either way a
	 * callout the user did define silently loses its styling, and the blast
	 * radius is the rest of the generated sheet.
	 *
	 * The fix is one function — `cssAttrValue` in `CSSInjector.ts` — reached
	 * from both selector builders (`calloutSel` for Obsidian's own DOM,
	 * `tokenAttrSel` for the heading/pill/ref DOM that is ours), which is why
	 * the last two tests here drive the token emitters rather than only
	 * `generateCalloutCSS`.
	 */
	const generate = (id: string): string => {
		const registry = new CalloutRegistry();
		registry.load(null);
		const injector = new CSSInjector({} as App, registry);
		return (
			injector as unknown as {
				generateCalloutCSS(d: ReturnType<typeof definition>): string;
			}
		).generateCalloutCSS(definition({ id }));
	};

	/**
	 * How many `{` land INSIDE a CSS string token — i.e. how many rule bodies a
	 * real parser would swallow instead of applying.
	 *
	 * A deliberately literal model of CSS string tokenization, because the
	 * harness's own `parseRules` counts braces and ignores quoting and so cannot
	 * see this class of damage at all: `"` opens a string, `\` escapes whatever
	 * follows it, and a raw newline ends a bad-string token (which is what bounds
	 * the blast radius to the line rather than the file). Zero is the only
	 * acceptable answer for any id.
	 */
	const bracesInsideStrings = (css: string): number => {
		let inString = false;
		let count = 0;
		for (let i = 0; i < css.length; i++) {
			const ch = css[i];
			if (inString) {
				if (ch === "\\") i++;
				else if (ch === '"') inString = false;
				else if (ch === "\n") inString = false;
				else if (ch === "{") count++;
			} else if (ch === '"') {
				inString = true;
			}
		}
		return count;
	};

	it("the model agrees that an ordinary id is clean", () => {
		// Guards the guard: a scanner that reported zero for everything would
		// make the three checks below vacuous.
		assert.strictEqual(bracesInsideStrings(generate("plain")), 0);
		assert.strictEqual(
			bracesInsideStrings(generate("multi word callout")),
			0,
		);
	});

	it("a double quote in the id does not break out of the attribute selector", () => {
		const css = generate('ev"il');
		assert.ok(
			!css.includes('data-callout="ev"il"'),
			"the id closed the attribute selector early",
		);
		assert.ok(
			css.includes('data-callout="ev\\"il"'),
			"the quote should survive as an escape, not be dropped",
		);
		assert.strictEqual(
			bracesInsideStrings(css),
			0,
			"rule bodies ended up inside a string token",
		);
	});

	it("a trailing backslash does not escape the closing quote", () => {
		// The nastier of the two: `[data-callout="back\"]` leaves the string
		// token open, so the parser eats whatever the generator wrote next.
		const css = generate("back\\");
		assert.ok(
			!css.includes('data-callout="back\\"'),
			"the id escaped its own closing quote",
		);
		assert.ok(css.includes('data-callout="back\\\\"'));
		assert.strictEqual(bracesInsideStrings(css), 0);
	});

	it("a hostile id cannot cost a neighbouring callout its rules", () => {
		const registry = new CalloutRegistry();
		registry.load(null);
		const injector = new CSSInjector({} as App, registry);
		const css = injector as unknown as {
			generateCalloutCSS(d: ReturnType<typeof definition>): string;
		};
		// One discovered row is enough to reach the rest of the sheet: the
		// blast radius is what makes this worth fixing rather than a curiosity
		// about one broken selector.
		const sheet = [
			css.generateCalloutCSS(definition({ id: "back\\" })),
			css.generateCalloutCSS(definition({ id: "innocent" })),
		].join("\n\n");
		assert.strictEqual(bracesInsideStrings(sheet), 0);
		// Not just "no braces got swallowed": the innocent row's own rule has to
		// still be there to apply, which is the damage a reader would notice.
		assert.ok(sheet.includes('data-callout="innocent"'));
	});

	it("escapes an alias and the plugin's own token DOM too", () => {
		// calloutSel is not the only builder — the heading bar, the inline pill
		// and the ref token carry the space-preserving id through tokenAttrSel,
		// and an alias reaches both. Fixing only the `.callout[…]` selector
		// would leave every one of these open.
		const registry = new CalloutRegistry();
		registry.load(null);
		const injector = new CSSInjector({} as App, registry);
		const css = (
			injector as unknown as {
				generateTokenColorCSS(d: CalloutDefinition): string;
			}
		).generateTokenColorCSS(
			definition({ id: "plain", aliases: ['ev"il', "back\\"] }),
		);
		assert.strictEqual(bracesInsideStrings(css), 0);
		assert.ok(!css.includes('data-callout="ev"il"'));
		assert.ok(!css.includes('data-callout="back\\"'));
	});

	it("keeps the fallback's :not() chain from swallowing the sheet", () => {
		// The catch-all lists every known id, so ONE hostile row breaks the
		// exclusion for all of them — and these rules carry `!important`, so a
		// broken chain repaints callouts the user did define.
		const registry = new CalloutRegistry();
		registry.load(null);
		registry.add(definition({ id: "back\\" }));
		registry.settings.fallbackCalloutId = "note";
		const injector = new CSSInjector({} as App, registry);
		const css = (
			injector as unknown as {
				generateFallbackCSS(c: CalloutDefinition[]): string;
			}
		).generateFallbackCSS(registry.getAll());
		assert.strictEqual(bracesInsideStrings(css), 0);
		assert.ok(css.includes(':not([data-callout="back\\\\"])'));
	});

	it("the two ways such an id reaches the registry are both open", () => {
		// This one is NOT todo — it asserts current, verifiable behaviour, and is
		// what makes the three above worth fixing rather than theoretical.
		const registry = new CalloutRegistry();
		registry.load(null);
		assert.strictEqual(
			registry.add(definition({ id: 'ev"il' })),
			true,
			"the registry accepts a quoted id",
		);
		assert.strictEqual(
			registry.add(definition({ id: "back\\" })),
			true,
			"the registry accepts a backslashed id",
		);
	});

	it("a colour, by contrast, is hex-validated before it can reach a declaration", () => {
		// The adjacent surface, and the reason this is a selector bug rather than
		// a general injection: `textColorLight` is emitted raw into
		// `color: …`, and it is safe only because the import validator rejects
		// anything that is not #rgb / #rrggbb.
		const css = generate("plain");
		assert.ok(!css.includes(";}"), css);
	});
});

/* ────────────────────────────────────────────────────────────────────────────
 * The docs describe the injector that exists
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * A text check rather than a behavioural one, because the defect is textual:
 * `scheduleInject` was removed from the injector, and two documents kept
 * naming it — `CLAUDE.md`'s data-flow step 2 and the header of
 * `settings/styleControls.ts`. Both read as a promise of a debounce that no
 * caller can get, which is exactly how the absence of one came to look like an
 * oversight instead of the deliberate reversal `main.ts` records.
 *
 * Scoped to the identifier alone: prose may (and now does) say there *is* no
 * `scheduleInject`, so the rule is about naming it as something the code
 * offers, not about the word appearing. Hence the call/member forms below
 * rather than a bare substring.
 */
describe("nothing documents a scheduleInject the injector does not have", () => {
	/** `scheduleInject(` or `.scheduleInject` — the two ways a doc names it as API. */
	const NAMED_AS_API = /\.scheduleInject\b|\bscheduleInject\s*\(/;

	it("the injector really has no such member", () => {
		// The premise. If this ever fails, the rule below is wrong rather than the
		// docs, and the debounce needs tests of its own (see the suite header).
		const registry = new CalloutRegistry();
		registry.load(null);
		const injector = new CSSInjector({} as App, registry);
		assert.strictEqual(
			(injector as unknown as Record<string, unknown>).scheduleInject,
			undefined,
		);
	});

	it("no source file names it as a call or a member", () => {
		const offenders = pluginSourceFiles()
			.filter((f) => NAMED_AS_API.test(f.text))
			.map((f) => f.path);
		assert.deepStrictEqual(
			offenders,
			[],
			"these still describe cssInjector.scheduleInject(); it was removed",
		);
	});

	it("CLAUDE.md's data-flow step names inject() instead", () => {
		const doc = readRepoFile("CLAUDE.md");
		assert.ok(
			!NAMED_AS_API.test(doc),
			"CLAUDE.md still documents cssInjector.scheduleInject()",
		);
		assert.ok(
			/`cssInjector\.inject\(\)`/.test(doc),
			"CLAUDE.md's data flow no longer names the method that does exist",
		);
	});
});
