/**
 * tests/themeClaimCheck.test.ts — measuring whether a theme draws what it names.
 *
 * The repo's test DOM has no cascade, so the theme here is a fake parsed sheet
 * whose rules carry the one declaration each sets, and the reader answers from
 * whichever of those rules still names the callout. That is exactly the part
 * `ThemeClaimCheck` owns — switching named rules off and back, reading before
 * and after, keeping its own CSS out of the way — and the cascade it cannot
 * own was measured instead, over all 65 installed themes that name a callout,
 * in a real Obsidian 1.14.4.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { Component, MarkdownRenderer } from "obsidian";
import type { App } from "obsidian";
import { FakeElement, installFakeDom } from "./support/fakeDom";
import {
	everyComputedProperty,
	ThemeClaimCheck,
	type ClaimCheckRequest,
} from "../src/manager/theme/ThemeClaimCheck";
import { namesInSelector } from "../src/manager/theme/themeClaimSelectors";
import type { ComputedStyleReader } from "../src/manager/theme/readCalloutStyle";
import { isOwnCssChange, OWN_CSS_CHANGE } from "../src/manager/ownCssChange";
import type { ClaimVerdictStore } from "../src/manager/theme/themeClaimCache";

installFakeDom();

/** One parsed rule: its selector, and the declaration it applies when it matches. */
interface FakeRule {
	selectorText: string;
	parentRule: FakeRule | null;
	cssRules?: FakeRule[];
	/** `[box class, property, value]`, applied to callouts the rule still names. */
	sets?: [string, string, string];
	/** Applies only under this ancestor class (a Live Preview-only rule). */
	under?: string;
}

function rule(selectorText: string, sets?: FakeRule["sets"], under?: string): FakeRule {
	return { selectorText, parentRule: null, sets, under };
}

/** A rule whose selector the "browser" refuses to change. */
function stubbornRule(selectorText: string, sets?: FakeRule["sets"]): FakeRule {
	return {
		get selectorText() {
			return selectorText;
		},
		set selectorText(_ignored: string) {
			/* a selector the parser rejected keeps the old one */
		},
		parentRule: null,
		sets,
	};
}

interface Harness {
	app: App;
	rules: FakeRule[];
	studio: { on: boolean; suspended: number; restored: number };
	setTheme(name: string): void;
	setSnippets(names: string[]): void;
}

function harness(rules: FakeRule[], themeText = "x"): Harness {
	const customCss = {
		theme: "Theme",
		themes: { Theme: { version: "1" }, Other: { version: "1" } } as Record<string, { version: string }>,
		snippets: [] as string[],
		enabledSnippets: new Set<string>(),
		styleEl: { textContent: themeText, sheet: { cssRules: rules } },
		extraStyleEls: [],
	};
	return {
		app: { customCss, workspace: { containerEl: document.body } } as unknown as App,
		rules,
		studio: { on: true, suspended: 0, restored: 0 },
		setTheme: (name) => {
			customCss.theme = name;
		},
		setSnippets: (names) => {
			customCss.snippets = names;
			customCss.enabledSnippets = new Set(names);
		},
	};
}

/** A device store held in memory, as `localStorage` would hold it across launches. */
function memoryStore(): ClaimVerdictStore & { held: Map<string, Map<string, boolean>> } {
	const held = new Map<string, Map<string, boolean>>();
	return {
		held,
		load: (theme) => {
			const found = held.get(theme);
			return found ? new Map(found) : null;
		},
		save: (theme, verdicts) => {
			held.set(theme, new Map(verdicts));
		},
	};
}

/** Every rule, nested ones included. */
function allRules(rules: readonly FakeRule[]): FakeRule[] {
	return rules.flatMap((r) => [r, ...allRules(r.cssRules ?? [])]);
}

/**
 * Answers from the fake theme: a box takes the value of the first rule that
 * still names its callout and targets it, else "base". While this plugin's CSS
 * is on it paints every title "studio", over the theme — the masking a check
 * that forgot to switch it off would measure.
 */
function reader(h: Harness): ComputedStyleReader {
	return (el, pseudo) => ({
		getPropertyValue: (prop: string) => {
			if (pseudo) return prop === "content" ? "none" : "";
			const callout = el.closest(".callout");
			const id = callout?.getAttribute("data-callout") ?? "";
			if (prop === "--callout-icon") return "lucide-pencil";
			if (h.studio.on && el.classList.contains("callout-title") && prop === "color") return "studio";
			for (const r of allRules(h.rules)) {
				if (!r.sets || !namesInSelector(r.selectorText).has(id)) continue;
				if (r.under && !el.closest(`.${r.under}`)) continue;
				const [cls, p, value] = r.sets;
				if (p === prop && el.classList.contains(cls)) return value;
			}
			return "base";
		},
	});
}

/** Render every `[!id]` as a callout with a title, an icon and some content. */
function emitCallouts(): () => void {
	const renderer = MarkdownRenderer as unknown as {
		render: (app: unknown, markdown: string, el: HTMLElement) => Promise<void>;
	};
	const original = renderer.render;
	renderer.render = (_app, markdown, el) => {
		for (const [, id] of markdown.matchAll(/\[!([^\]]+)\]/g)) {
			const callout = el.createDiv({ cls: "callout", attr: { "data-callout": id ?? "" } });
			const title = callout.createDiv({ cls: "callout-title" });
			title.createDiv({ cls: "callout-icon" });
			title.createDiv({ cls: "callout-title-inner" });
			callout.createDiv({ cls: "callout-content" }).createEl("p");
		}
		return Promise.resolve();
	};
	return () => {
		renderer.render = original;
	};
}

function check(
	h: Harness,
	nextTask = () => Promise.resolve(),
	store?: ClaimVerdictStore,
	batchSize?: number,
): ThemeClaimCheck {
	return new ThemeClaimCheck(h.app, {
		read: reader(h),
		properties: () => ["color", "cursor", "display", "content"],
		nextTask,
		store,
		batchSize,
	});
}

function request(h: Harness, ids: string[], onChange = () => {}): ClaimCheckRequest {
	return {
		ids,
		suspendStudioCss: () => {
			h.studio.on = false;
			h.studio.suspended++;
			return () => {
				h.studio.on = true;
				h.studio.restored++;
			};
		},
		onChange,
	};
}

async function withCallouts(body: () => Promise<void>): Promise<void> {
	const restore = emitCallouts();
	try {
		await body();
	} finally {
		restore();
	}
}

describe("what the theme draws", () => {
	it("keeps a callout whose title the theme recolours", () =>
		withCallouts(async () => {
			const h = harness([rule('.callout[data-callout="note"]', ["callout-title", "color", "violet"])]);
			const claims = check(h);
			let changes = 0;
			await claims.check(request(h, ["note"], () => changes++));
			assert.strictEqual(h.studio.suspended, 1, "it was measured, not skipped");
			assert.deepStrictEqual([...claims.unstyled(["note"])], []);
			assert.strictEqual(changes, 0, "a callout that stays the theme's moves nothing");
		}));

	it("hands back a callout whose rule changes nothing that is drawn", () =>
		withCallouts(async () => {
			const h = harness([rule('.callout[data-callout="note"]', ["callout-title", "cursor", "pointer"])]);
			const claims = check(h);
			let changes = 0;
			await claims.check(request(h, ["note"], () => changes++));
			assert.deepStrictEqual([...claims.unstyled(["note"])], ["note"]);
			assert.strictEqual(changes, 1);
		}));

	it("keeps a callout the theme styles only in Live Preview", () =>
		withCallouts(async () => {
			const h = harness([
				rule('.callout[data-callout="warning"]', ["callout-title", "color", "amber"], "markdown-source-view"),
			]);
			const claims = check(h);
			await claims.check(request(h, ["warning"]));
			assert.strictEqual(h.studio.suspended, 2, "measured in Reading view, then in Live Preview");
			assert.deepStrictEqual([...claims.unstyled(["warning"])], []);
		}));
});

describe("where the callouts are drawn", () => {
	it("mirrors Obsidian's Live Preview widget, a .markdown-rendered child of .cm-embed-block.cm-callout", () =>
		withCallouts(async () => {
			// Obsidian draws a Live Preview callout as
			// `div.cm-embed-block.cm-callout > div.markdown-rendered > div.callout`
			// (snippets in the wild select `.cm-callout:has(> div.markdown-rendered
			// > [data-callout…])`), so a theme's `.cm-callout > .markdown-rendered
			// > .callout` must reach the clone the check reads.
			const h = harness([rule('.callout[data-callout="note"]', ["callout-title", "cursor", "x"])]);
			const chains = new Set<string>();
			const base = reader(h);
			const claims = new ThemeClaimCheck(h.app, {
				read: (el, pseudo) => {
					const callout = el.closest(".callout");
					const parent = callout?.parentElement;
					const widget = parent?.parentElement;
					if (callout && parent && widget?.classList.contains("cm-callout")) {
						chains.add(
							[widget, parent, callout]
								.map((node) => `${node.tagName.toLowerCase()}.${node.className.trim().split(/\s+/).join(".")}`)
								.join(" > "),
						);
					}
					return base(el, pseudo);
				},
				properties: () => ["color", "cursor", "display", "content"],
				nextTask: () => Promise.resolve(),
			});
			await claims.check(request(h, ["note"]));
			assert.deepStrictEqual([...chains], [
				"div.cm-embed-block.cm-callout > div.markdown-rendered > div.callout",
			]);
		}));
});

describe("how the measuring is spread out", () => {
	// Each pass - one view, one batch - is one synchronous run. Between passes
	// the page is whole again: every rule back and this plugin's CSS on, so a
	// frame painted there shows nothing switched off.
	function watched(h: Harness, originals: string[]) {
		const between: Array<{ rulesBack: boolean; studioOn: boolean }> = [];
		const nextTask = (): Promise<void> => {
			between.push({
				rulesBack: h.rules.every((r, i) => r.selectorText === originals[i]),
				studioOn: h.studio.on,
			});
			return Promise.resolve();
		};
		return { between, nextTask };
	}

	it("gives Live Preview its own task, with the page whole in between", () =>
		withCallouts(async () => {
			const h = harness([rule('.callout[data-callout="note"]', ["callout-title", "cursor", "x"])]);
			const originals = h.rules.map((r) => r.selectorText);
			const { between, nextTask } = watched(h, originals);
			const claims = check(h, nextTask);
			await claims.check(request(h, ["note"]));
			assert.strictEqual(between.length, 2, "one wait before measuring, one between the views");
			assert.ok(between.every((b) => b.rulesBack && b.studioOn));
			assert.deepStrictEqual([...claims.unstyled(["note"])], ["note"]);
		}));

	it("cuts a long list into batches, each its own task, and judges it the same", () =>
		withCallouts(async () => {
			const rules = [
				rule('.callout[data-callout="a"]', ["callout-title", "color", "violet"]),
				rule('.callout[data-callout="b"]', ["callout-title", "cursor", "x"]),
				rule('.callout[data-callout="c"]', ["callout-title", "color", "teal"]),
			];
			const whole = harness(rules);
			const all = check(whole);
			await all.check(request(whole, ["a", "b", "c"]));

			const h = harness(rules);
			const originals = h.rules.map((r) => r.selectorText);
			const { between, nextTask } = watched(h, originals);
			const batched = check(h, nextTask, undefined, 1);
			await batched.check(request(h, ["a", "b", "c"]));
			// Reading view: a, b, c one at a time; Live Preview: b alone.
			assert.strictEqual(h.studio.suspended, 4);
			assert.ok(between.every((b) => b.rulesBack && b.studioOn));
			assert.deepStrictEqual([...batched.unstyled(["a", "b", "c"])], [...all.unstyled(["a", "b", "c"])]);
			assert.deepStrictEqual([...batched.unstyled(["a", "b", "c"])], ["b"]);
		}));

	it("drops the passes a css-change overtook between them", () =>
		withCallouts(async () => {
			const h = harness([rule('.callout[data-callout="note"]', ["callout-title", "cursor", "x"])]);
			let waits = 0;
			let claims: ThemeClaimCheck | null = null;
			const nextTask = (): Promise<void> => {
				// The second wait sits between the two views.
				if (++waits === 2) claims?.invalidate();
				return Promise.resolve();
			};
			claims = check(h, nextTask);
			let changes = 0;
			await claims.check(request(h, ["note"], () => changes++));
			assert.strictEqual(changes, 0);
			assert.deepStrictEqual([...claims.unstyled(["note"])], []);
			assert.strictEqual(h.studio.on, true);
		}));
});

describe("a theme's transitions", () => {
	// Switching a rule off starts the theme's transition, and a value read
	// right then is the one it had a moment ago - which hides the difference.
	// The fake: any selector change starts a transition on every callout, and
	// until it is finished the reader answers with the value read before.
	function transitioningTheme(withFinish: boolean) {
		let running = false;
		const r = rule('.callout[data-callout="note"]', ["callout-title", "color", "violet"]);
		let selector = r.selectorText;
		Object.defineProperty(r, "selectorText", {
			get: () => selector,
			set: (value: string) => {
				if (value !== selector) running = true;
				selector = value;
			},
		});
		const h = harness([r]);
		const fresh = reader(h);
		const seen = new WeakMap<Element, Map<string, string>>();
		const read: ComputedStyleReader = (el, pseudo) => ({
			getPropertyValue: (prop: string) => {
				const known = seen.get(el) ?? new Map<string, string>();
				seen.set(el, known);
				const key = `${pseudo ?? ""}|${prop}`;
				const before = known.get(key);
				if (running && before !== undefined) return before;
				const value = fresh(el, pseudo).getPropertyValue(prop);
				known.set(key, value);
				return value;
			},
		});
		const proto = FakeElement.prototype as unknown as { getAnimations?: unknown };
		proto.getAnimations = withFinish
			? () => (running ? [{ transitionProperty: "color", finish: () => void (running = false) }] : [])
			: undefined;
		const claims = new ThemeClaimCheck(h.app, {
			read,
			properties: () => ["color", "cursor", "display", "content"],
			nextTask: () => Promise.resolve(),
		});
		return { h, claims, restore: () => delete proto.getAnimations };
	}

	it("finishes them before reading, so a callout the theme recolours stays the theme's", () =>
		withCallouts(async () => {
			const { h, claims, restore } = transitioningTheme(true);
			try {
				await claims.check(request(h, ["note"]));
				assert.deepStrictEqual([...claims.unstyled(["note"])], []);
			} finally {
				restore();
			}
		}));

	it("would have handed it back with the transition left running", () =>
		withCallouts(async () => {
			// The same theme with no animation API: the fake's stale read hides the
			// recolour - the false "not drawn" the finishing exists to prevent.
			const { h, claims, restore } = transitioningTheme(false);
			try {
				await claims.check(request(h, ["note"]));
				assert.deepStrictEqual([...claims.unstyled(["note"])], ["note"]);
			} finally {
				restore();
			}
		}));

	it("leaves a keyframe animation alone - an infinite one cannot finish", async () => {
		const proto = FakeElement.prototype as unknown as { getAnimations?: unknown };
		let asked = 0;
		let finished = 0;
		proto.getAnimations = () => {
			asked++;
			return [{ animationName: "pulse", finish: () => { finished++; throw new Error("InvalidStateError"); } }];
		};
		try {
			await withCallouts(async () => {
				const h = harness([rule('.callout[data-callout="note"]', ["callout-title", "cursor", "x"])]);
				await check(h).check(request(h, ["note"]));
			});
			assert.ok(asked > 0, "the running animations were looked at");
			assert.strictEqual(finished, 0);
		} finally {
			delete proto.getAnimations;
		}
	});
});

describe("what the check leaves behind", () => {
	it("puts every rule back exactly as it was", () =>
		withCallouts(async () => {
			const rules = [
				rule('.callout[data-callout="note"], .callout[data-callout="tip"]', ["callout-title", "color", "v"]),
				rule('.callout[data-callout="tip"] .callout-content', ["callout-content", "cursor", "x"]),
			];
			const before = rules.map((r) => r.selectorText);
			const h = harness(rules);
			await check(h).check(request(h, ["note", "tip"]));
			assert.deepStrictEqual(rules.map((r) => r.selectorText), before);
		}));

	it("measures with this plugin's CSS off, and turns it back on", () =>
		withCallouts(async () => {
			// While this plugin paints a callout the theme names, its title would
			// read "studio" both ways and the theme's colour would never show — a
			// callout handed back once could then never be won back.
			const h = harness([rule('.callout[data-callout="note"]', ["callout-title", "color", "violet"])]);
			const claims = check(h);
			await claims.check(request(h, ["note"]));
			assert.deepStrictEqual([...claims.unstyled(["note"])], []);
			assert.strictEqual(h.studio.suspended, 1);
			assert.strictEqual(h.studio.restored, 1);
			assert.strictEqual(h.studio.on, true);
		}));

	it("puts every rule and this plugin's CSS back when a read throws", () =>
		withCallouts(async () => {
			const rules = [rule('.callout[data-callout="note"]', ["callout-title", "cursor", "x"])];
			const before = rules.map((r) => r.selectorText);
			const h = harness(rules);
			const claims = new ThemeClaimCheck(h.app, {
				read: () => {
					throw new Error("a read the browser refused");
				},
				properties: () => ["color"],
				nextTask: () => Promise.resolve(),
			});
			let changes = 0;
			await claims.check(request(h, ["note"], () => changes++));
			assert.deepStrictEqual(rules.map((r) => r.selectorText), before);
			assert.strictEqual(h.studio.on, true);
			assert.strictEqual(h.studio.suspended, h.studio.restored);
			assert.strictEqual(changes, 0, "a failed pass publishes nothing");
			assert.deepStrictEqual([...claims.unstyled(["note"])], []);
		}));

	it("re-reads the theme from its text if a rule will not switch back on", () =>
		withCallouts(async () => {
			// The browser's own serialisation always parses back, so this is a
			// last resort - but a rule left off would stay off until Obsidian
			// reloaded the theme.
			let selector = '.callout[data-callout="note"]';
			let rewrites = 0;
			const sticky: FakeRule = {
				get selectorText() {
					return selector;
				},
				set selectorText(value: string) {
					if (rewrites++ === 0) selector = value;
				},
				parentRule: null,
				sets: ["callout-title", "cursor", "x"],
			};
			const h = harness([sticky], "the theme's own text");
			const styleEl = (h.app as unknown as { customCss: { styleEl: { textContent: string } } }).customCss.styleEl;
			const written: string[] = [];
			let text = styleEl.textContent;
			Object.defineProperty(styleEl, "textContent", {
				get: () => text,
				set: (value: string) => {
					written.push(value);
					text = value;
				},
			});
			await check(h).check(request(h, ["note"]));
			assert.deepStrictEqual(written, ["the theme's own text"]);
		}));

	it("gives each pass's render its own owner and lets it go after", () =>
		withCallouts(async () => {
			// Fields typed as plain functions, so saving and restoring them is
			// not an unbound-method read.
			const proto = Component.prototype as unknown as {
				load: (this: Component) => void;
				unload: (this: Component) => void;
			};
			const load = proto.load;
			const unload = proto.unload;
			let live = 0;
			proto.load = function (this: Component) {
				live++;
				load.call(this);
			};
			proto.unload = function (this: Component) {
				live--;
				unload.call(this);
			};
			try {
				const h = harness([rule('.callout[data-callout="note"]', ["callout-title", "cursor", "x"])]);
				const claims = check(h);
				await claims.check(request(h, ["note"]));
				await claims.check(request(h, ["note", "tip"]));
				assert.strictEqual(live, 0, "nothing the renders attached outlives them");
			} finally {
				proto.load = load;
				proto.unload = unload;
			}
		}));

	it("compares every computed longhand but no custom property", () => {
		const names = ["color", "--anuppuccin-accent", "display", "--callout-color"];
		const doc = {
			body: {},
			defaultView: {
				getComputedStyle: () => ({ length: names.length, item: (i: number) => names[i] ?? "" }),
			},
		} as unknown as Document;
		assert.deepStrictEqual(everyComputedProperty(doc), ["color", "display"]);
	});

	it("leaves the offscreen callouts nowhere in the document", () =>
		withCallouts(async () => {
			const h = harness([rule('.callout[data-callout="note"]', ["callout-title", "color", "v"])]);
			await check(h).check(request(h, ["note"]));
			assert.strictEqual(document.body.querySelector(".cs-theme-probe"), null);
		}));
});

describe("every doubt goes to the theme", () => {
	it("keeps a callout whose rule the browser would not rewrite", () =>
		withCallouts(async () => {
			const h = harness([stubbornRule('.callout[data-callout="note"]', ["callout-title", "cursor", "x"])]);
			const claims = check(h);
			await claims.check(request(h, ["note"]));
			assert.strictEqual(h.studio.suspended, 1, "it was measured, not skipped");
			assert.deepStrictEqual([...claims.unstyled(["note"])], []);
		}));

	it("never judges an id no parsed rule names", () =>
		withCallouts(async () => {
			const h = harness([rule('.callout[data-callout="tip"]', ["callout-title", "cursor", "x"])]);
			const claims = check(h);
			await claims.check(request(h, ["note"]));
			assert.deepStrictEqual([...claims.unstyled(["note"])], []);
			assert.strictEqual(h.studio.suspended, 0, "nothing to measure, nothing switched off");
		}));

	it("publishes nothing from a pass a css-change overtook", () =>
		withCallouts(async () => {
			const h = harness([rule('.callout[data-callout="note"]', ["callout-title", "cursor", "x"])]);
			let release = (): void => {};
			const claims = check(h, () => new Promise<void>((resolve) => {
				release = resolve;
			}));
			const pass = claims.check(request(h, ["note"]));
			claims.invalidate();
			release();
			await pass;
			assert.deepStrictEqual([...claims.unstyled(["note"])], []);
		}));
});

describe("names no pass has been asked about", () => {
	it("are told apart from names asked once, judged or not", () =>
		withCallouts(async () => {
			const h = harness([rule('.callout[data-callout="note"]', ["callout-title", "cursor", "x"])]);
			const claims = check(h);
			assert.strictEqual(claims.hasUnmeasured(["note"]), true);
			// `ghost` has no parsed rule, so the pass cannot judge it - but it
			// was asked about, and asking again at every css-change buys nothing.
			await claims.check(request(h, ["note", "ghost"]));
			assert.strictEqual(claims.hasUnmeasured(["note", "ghost"]), false);
			assert.strictEqual(claims.hasUnmeasured(["note", "new"]), true);
		}));

	it("start over for another theme, and count what the device remembers", () =>
		withCallouts(async () => {
			const store = memoryStore();
			store.held.set("Other@1", new Map([["note", false]]));
			const h = harness([rule('.callout[data-callout="note"]', ["callout-title", "cursor", "x"])]);
			const claims = check(h, undefined, store);
			await claims.check(request(h, ["tip"]));
			assert.strictEqual(claims.hasUnmeasured(["tip"]), false);
			h.setTheme("Other");
			claims.invalidate();
			assert.strictEqual(claims.hasUnmeasured(["tip"]), true, "another theme's pass");
			assert.strictEqual(claims.hasUnmeasured(["note"]), false, "remembered for this one");
		}));
});

describe("a rule the measurement cannot see in force", () => {
	// Only a callout whose every rule was in force on the offscreen render -
	// or switched off by the page - can be judged not drawn. Anything else
	// stays the theme's, as every callout did before the check existed.
	it("keeps a callout a rule draws only under a note's cssclass", () =>
		withCallouts(async () => {
			const h = harness([
				rule('.callout[data-callout="note"]', ["callout-title", "cursor", "x"]),
				rule('.my-cssclass .callout[data-callout="note"]', ["callout-title", "color", "red"]),
			]);
			const claims = check(h);
			await claims.check(request(h, ["note"]));
			assert.deepStrictEqual([...claims.unstyled(["note"])], []);
			assert.strictEqual(h.studio.suspended, 0, "nothing it could judge, nothing switched off");
		}));

	it("keeps a callout with a rule in a @media the window does not meet", () =>
		withCallouts(async () => {
			const media = { selectorText: undefined, media: { mediaText: "(max-width: 400px)" }, parentRule: null, cssRules: [] as FakeRule[] };
			const inner: FakeRule = {
				selectorText: '.callout[data-callout="note"]',
				parentRule: media as unknown as FakeRule,
				sets: ["callout-title", "color", "red"],
				// The fake cascade has no media queries: a class nothing carries
				// stands in for the narrow window this is not.
				under: "narrow-window",
			};
			media.cssRules = [inner];
			const h = harness([
				rule('.callout[data-callout="note"]', ["callout-title", "cursor", "x"]),
				media as unknown as FakeRule,
			]);
			const claims = check(h);
			await claims.check(request(h, ["note"]));
			assert.deepStrictEqual([...claims.unstyled(["note"])], []);
		}));

	it("judges a callout whose rules sit in a note's own ancestry", () =>
		withCallouts(async () => {
			// `.markdown-reading-view` and the markdown leaf are rendered too, so
			// a rule scoped to them is seen, and one that changes nothing is
			// handed back.
			const h = harness([
				rule('.markdown-reading-view .callout[data-callout="note"]', ["callout-title", "cursor", "x"]),
				rule('.workspace-leaf-content .callout[data-callout="note"]', ["callout-title", "cursor", "x"]),
			]);
			const claims = check(h);
			await claims.check(request(h, ["note"]));
			assert.deepStrictEqual([...claims.unstyled(["note"])], ["note"]);
		}));

	const SETTINGS = `/* @settings
name: Aura
id: aura
settings:
    -
        id: aura-callouts
        type: class-toggle
*/`;

	it("judges past a rule behind a Style Settings option that is off", () =>
		withCallouts(async () => {
			const h = harness(
				[
					rule('.callout[data-callout="note"]', ["callout-title", "cursor", "x"]),
					// `under`: the fake cascade applies it only inside that class.
					rule('.aura-callouts .callout[data-callout="note"]', ["callout-title", "color", "red"], "aura-callouts"),
				],
				SETTINGS,
			);
			const claims = check(h);
			await claims.check(request(h, ["note"]));
			assert.deepStrictEqual([...claims.unstyled(["note"])], ["note"]);
		}));

	it("keeps a callout whose rule nests a hover the render cannot see", () =>
		withCallouts(async () => {
			// `.callout[…]:hover` written flat stays the theme's; the same written as
			// `&:hover` inside the id's rule used to be handed back.
			const parent: FakeRule = {
				selectorText: '.callout[data-callout="note"]',
				parentRule: null,
				sets: ["callout-title", "cursor", "x"],
				cssRules: [],
			};
			parent.cssRules = [{ selectorText: "&:hover", parentRule: parent, sets: ["callout-title", "color", "red"], under: "hovered" }];
			const h = harness([parent]);
			const claims = check(h);
			await claims.check(request(h, ["note"]));
			assert.deepStrictEqual([...claims.unstyled(["note"])], []);
		}));

	it("judges past a nested rule the page switches off", () =>
		withCallouts(async () => {
			const parent: FakeRule = {
				selectorText: '.callout[data-callout="note"]',
				parentRule: null,
				sets: ["callout-title", "cursor", "x"],
				cssRules: [],
			};
			parent.cssRules = [{ selectorText: "body.opt-off &", parentRule: parent, sets: ["callout-title", "color", "red"], under: "opt-off" }];
			const h = harness([parent]);
			const claims = check(h);
			await claims.check(request(h, ["note"]));
			assert.deepStrictEqual([...claims.unstyled(["note"])], ["note"]);
		}));

	it("judges past a rule for the other appearance mode, and measures it in its own", () =>
		withCallouts(async () => {
			// `.theme-dark …` draws nothing in light mode - written bare as often as
			// `body.theme-dark`. Before the in-force rule this was handed back in
			// light mode; leaving it unseen kept it with the theme in both modes.
			const rules = [
				rule('.callout[data-callout="note"]', ["callout-title", "cursor", "x"]),
				rule('.theme-dark .callout[data-callout="note"]', ["callout-title", "color", "red"], "theme-dark"),
			];
			document.body.classList.add("theme-light");
			try {
				const light = harness(rules);
				const inLight = check(light);
				await inLight.check(request(light, ["note"]));
				assert.deepStrictEqual([...inLight.unstyled(["note"])], ["note"], "light: the theme draws nothing");
			} finally {
				document.body.classList.remove("theme-light");
			}
			document.body.classList.add("theme-dark");
			try {
				const dark = harness(rules);
				const inDark = check(dark);
				await inDark.check(request(dark, ["note"]));
				assert.deepStrictEqual([...inDark.unstyled(["note"])], [], "dark: the theme draws it");
			} finally {
				document.body.classList.remove("theme-dark");
			}
		}));

	it("never takes a class the rendered note carries for an option, whatever the block calls it", () =>
		withCallouts(async () => {
			// A Style Settings heading with the id `callout`: `.callout` is on the
			// rendered callout itself, so the cssclass rule below must stay unseen
			// and keep Note with the theme.
			const settings = `/* @settings
name: T
id: t
settings:
    -
        id: callout
        type: class-toggle
*/`;
			const h = harness(
				[
					rule('.callout[data-callout="note"]', ["callout-title", "cursor", "x"]),
					rule('.my-cssclass .callout[data-callout="note"]', ["callout-title", "color", "red"], "my-cssclass"),
				],
				settings,
			);
			const claims = check(h);
			await claims.check(request(h, ["note"]));
			assert.deepStrictEqual([...claims.unstyled(["note"])], []);
		}));

	it("does not take a bare class the theme never offers as an option for one", () =>
		withCallouts(async () => {
			const h = harness(
				[
					rule('.callout[data-callout="note"]', ["callout-title", "cursor", "x"]),
					rule('.not-an-option .callout[data-callout="note"]', ["callout-title", "color", "red"], "not-an-option"),
				],
				SETTINGS,
			);
			const claims = check(h);
			await claims.check(request(h, ["note"]));
			assert.deepStrictEqual([...claims.unstyled(["note"])], []);
		}));
});

describe("how long a verdict lasts", () => {
	it("survives a re-check of the same theme, and not a switch to another", () =>
		withCallouts(async () => {
			const h = harness([rule('.callout[data-callout="note"]', ["callout-title", "cursor", "x"])]);
			const claims = check(h);
			await claims.check(request(h, ["note"]));
			claims.invalidate();
			assert.deepStrictEqual([...claims.unstyled(["note"])], ["note"], "kept until a new pass lands");
			h.setTheme("Other");
			claims.invalidate();
			assert.deepStrictEqual([...claims.unstyled(["note"])], []);
		}));

	it("survives a snippet switched on or off: the theme's own rules did not move", () =>
		withCallouts(async () => {
			// A snippet toggle used to drop every verdict, so each callout the
			// theme names but does not draw flashed to the theme's look until
			// the re-check landed.
			const h = harness([rule('.callout[data-callout="note"]', ["callout-title", "cursor", "x"])]);
			const claims = check(h);
			await claims.check(request(h, ["note"]));
			h.setSnippets(["my-snippet"]);
			claims.invalidate();
			assert.deepStrictEqual([...claims.unstyled(["note"])], ["note"]);
		}));

	it("is remembered on the device for the next launch of the same theme", () =>
		withCallouts(async () => {
			// The first stylesheet of a launch is built before any pass can land;
			// without this every launch flashed the callout to the theme's look.
			const store = memoryStore();
			const h = harness([rule('.callout[data-callout="note"]', ["callout-title", "cursor", "x"])]);
			await check(h, undefined, store).check(request(h, ["note"]));
			assert.deepStrictEqual([...(store.held.get("Theme@1") ?? [])], [["note", false]]);

			const nextLaunch = check(h, undefined, store);
			assert.deepStrictEqual([...nextLaunch.unstyled(["note"])], ["note"], "before any pass");

			h.setTheme("Other");
			nextLaunch.invalidate();
			assert.deepStrictEqual([...nextLaunch.unstyled(["note"])], [], "not another theme's");
		}));

	it("corrects a remembered verdict the theme no longer earns", () =>
		withCallouts(async () => {
			const store = memoryStore();
			store.held.set("Theme@1", new Map([["note", false]]));
			const h = harness([rule('.callout[data-callout="note"]', ["callout-title", "color", "violet"])]);
			const claims = check(h, undefined, store);
			assert.deepStrictEqual([...claims.unstyled(["note"])], ["note"]);
			let changes = 0;
			await claims.check(request(h, ["note"], () => changes++));
			assert.deepStrictEqual([...claims.unstyled(["note"])], []);
			assert.strictEqual(changes, 1);
			assert.deepStrictEqual([...(store.held.get("Theme@1") ?? [])], [["note", true]]);
		}));
});

describe("a page condition the theme's rules depend on", () => {
	function nested(parent: string, child: string): FakeRule {
		const outer: FakeRule = { selectorText: parent, parentRule: null, cssRules: [] };
		outer.cssRules = [{ selectorText: child, parentRule: outer }];
		return outer;
	}

	it("takes an id away while the option wrapping all its rules is off", () => {
		const h = harness([nested("body.rtm-ss-retro-callout", '& .callout[data-callout="polaroid-1"]')]);
		const claims = check(h);
		assert.deepStrictEqual([...claims.pageRootOff(new Set(["polaroid-1"]))], ["polaroid-1"]);
		document.body.classList.add("rtm-ss-retro-callout");
		try {
			assert.deepStrictEqual([...claims.pageRootOff(new Set(["polaroid-1"]))], []);
		} finally {
			document.body.classList.remove("rtm-ss-retro-callout");
		}
	});

	it("keeps an id that one unguarded rule still names", () => {
		const h = harness([
			nested("body.option", '& .callout[data-callout="aside"]'),
			rule('.callout[data-callout="aside"]'),
		]);
		assert.deepStrictEqual([...check(h).pageRootOff(new Set(["aside"]))], []);
	});

	it("keys which rules of each id the page switches off right now", () => {
		const h = harness([
			rule('.callout[data-callout="note"]'),
			rule('body.is-fullscreen .callout[data-callout="note"]'),
		]);
		const claims = check(h);
		assert.strictEqual(claims.pageStateKey(["note"]), "note:-p");
		document.body.classList.add("is-fullscreen");
		try {
			assert.strictEqual(claims.pageStateKey(["note"]), "note:--");
		} finally {
			document.body.classList.remove("is-fullscreen");
		}
	});

	it("keeps an id no parsed rule names", () => {
		const h = harness([]);
		assert.deepStrictEqual([...check(h).pageRootOff(new Set(["aside"]))], []);
	});
});

describe("this plugin's own css-change", () => {
	it("is told apart from the theme's and from Style Settings'", () => {
		// The claim check measures with this plugin's CSS off, so its own CSS
		// moving cannot change a verdict; re-checking on it cost a whole pass.
		assert.strictEqual(isOwnCssChange(OWN_CSS_CHANGE), true);
		assert.strictEqual(isOwnCssChange(undefined), false);
		assert.strictEqual(isOwnCssChange({ source: "style-settings" }), false);
	});
});
