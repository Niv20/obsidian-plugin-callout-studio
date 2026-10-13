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
import { MarkdownRenderer } from "obsidian";
import type { App } from "obsidian";
import { installFakeDom } from "./support/fakeDom";
import { ThemeClaimCheck, type ClaimCheckRequest } from "../src/manager/theme/ThemeClaimCheck";
import { namesInSelector } from "../src/manager/theme/themeClaimSelectors";
import type { ComputedStyleReader } from "../src/manager/theme/readCalloutStyle";
import { isOwnCssChange, OWN_CSS_CHANGE } from "../src/manager/ownCssChange";

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
}

function harness(rules: FakeRule[]): Harness {
	const customCss = {
		theme: "Theme",
		themes: { Theme: { version: "1" }, Other: { version: "1" } } as Record<string, { version: string }>,
		snippets: [],
		enabledSnippets: new Set<string>(),
		styleEl: { textContent: "x", sheet: { cssRules: rules } },
		extraStyleEls: [],
	};
	return {
		app: { customCss, workspace: { containerEl: document.body } } as unknown as App,
		rules,
		studio: { on: true, suspended: 0, restored: 0 },
		setTheme: (name) => {
			customCss.theme = name;
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

function check(h: Harness, nextTask = () => Promise.resolve()): ThemeClaimCheck {
	return new ThemeClaimCheck(h.app, {
		read: reader(h),
		properties: () => ["color", "cursor", "display", "content"],
		nextTask,
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
			assert.strictEqual(h.studio.suspended, 1, "it was measured, not skipped");
			assert.deepStrictEqual([...claims.unstyled(["warning"])], []);
		}));
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
