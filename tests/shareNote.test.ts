/**
 * tests/shareNote.test.ts — callouts on a page shared with Share Note.
 *
 * Share Note serves a note's reading view as it stands: its DOM, and every
 * stylesheet in the document. So almost everything Callout Studio draws
 * arrives on the page with nothing done for it. The exception is a block
 * callout's icon: Share Note empties the `<svg>` in `.callout-icon` down to a
 * name and draws that name with its server's own Lucide, which is older than
 * Obsidian's. These suites run the generated sheet and the painted DOM through
 * `support/shareNoteSim.ts` — Share Note's own lines, ported — and ask whether
 * every name that comes out of it has a drawing waiting on the page
 * (`manager/css/shareNoteCSS.ts`).
 *
 * What these cannot see is a browser: whether the mask paints, and whether
 * Share Note's Lucide fills a name. That was checked against a real Share Note
 * and its server; `docs/internals-docs/20-build-test-release.md` says how.
 */
import assert from "node:assert";
import { afterEach, beforeEach, describe, it } from "node:test";
// Listed first: importing it installs the DOM globals before anything under
// test loads (see tests/support/fakeDom.ts).
import { asEl, el, type FakeElement } from "./support/fakeDom";
import { definition, parseRules, type CssRule } from "./support/cssInjectorHarness";
import { cssAttachments, fixCalloutIcons, reachesPage } from "./support/shareNoteSim";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { CSSInjector } from "../src/manager/CSSInjector";
import { CSS_FALLBACK_ICON, nameFallbackDrawing } from "../src/manager/css/fallbackIcon";
import {
	SHARE_NOTE_BODY_CLASS,
	SHARE_NOTE_FALLBACK_CLASS,
	SHARE_NOTE_FALLBACK_NAME,
	isShareNoteEnabled,
	shareNoteIconCSS,
	watchShareNote,
} from "../src/manager/css/shareNoteCSS";
import { svgToDataUri } from "../src/icons/svg";
import type { App } from "obsidian";
import type { CalloutIcon } from "../src/types";

/* -------------------------------------------------------------------------- */
/* What Obsidian draws                                                        */
/* -------------------------------------------------------------------------- */

const svg = (cls: string, body: string): string =>
	`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" ` +
	`stroke="currentColor" stroke-width="2" class="svg-icon ${cls}">${body}</svg>`;

/**
 * `getIcon(id)` as Obsidian 1.15 answers it, for the ids these suites use.
 * The bare `pencil` is the one that surprises: it is Obsidian's own internal
 * drawing, whose class is `lucide-edit-3` — a name Share Note's Lucide 0.287
 * does not have. `lucide-pencil` is core's real pencil, which the untouched
 * `[!note]` wears (as core's own rule says) and Share Note can name.
 */
const OBSIDIAN = {
	"lucide-pencil": svg("lucide-pencil", '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>'),
	pencil: svg("lucide-edit-3", '<path d="M12 20h9"/><path d="M16.5 3.5l4 4L7 19l-4 1 1-4Z"/>'),
	"circle-help": svg("lucide-circle-help", '<circle cx="12" cy="12" r="10"/><path d="M12 17h.01"/>'),
	flame: svg("lucide-flame", '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12"/>'),
	"triangle-alert": svg("lucide-triangle-alert", '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14"/>'),
	// An icon another plugin registered with addIcon(): no `lucide-` class.
	"remix-Spark":
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="svg-icon remix-Spark"><path d="M2 2h20"/></svg>',
} as const;

type Seams = { __CS_ICONS__?: Record<string, { outerHTML: string }> };
const seams = globalThis as unknown as Seams;
beforeEach(() => {
	seams.__CS_ICONS__ = Object.fromEntries(Object.entries(OBSIDIAN).map(([id, outerHTML]) => [id, { outerHTML }]));
});
afterEach(() => {
	delete seams.__CS_ICONS__;
});

const lucide = (value: string): CalloutIcon => ({ type: "lucide", value });
const EMOJI: CalloutIcon = { type: "emoji", value: "🌵" };

/* -------------------------------------------------------------------------- */
/* The assembled sheet                                                        */
/* -------------------------------------------------------------------------- */

/**
 * The live sheet `inject()` writes, for a vault where Share Note is on or off.
 * A recorder in place of a DOM, as in `printMediaIcons.test.ts`.
 */
function sheet(shareNoteOn: boolean, build: (registry: CalloutRegistry) => void = () => {}): string {
	const writes: string[] = [];
	const styleEl = {
		id: "",
		isConnected: true,
		remove(): void {
			this.isConnected = false;
		},
		get textContent(): string {
			return writes.at(-1) ?? "";
		},
		set textContent(value: string) {
			writes.push(value);
		},
	};
	let attached = false;
	const doc = {
		head: {
			appendChild(): void {
				attached = true;
			},
		},
		getElementById: (id: string) => (attached && id === styleEl.id ? styleEl : null),
		querySelectorAll: () => [],
		body: { classList: { contains: () => false } },
	};
	const app = {
		appId: "test-vault",
		plugins: { enabledPlugins: new Set(shareNoteOn ? ["share-note"] : ["dataview"]) },
		workspace: {
			containerEl: { ownerDocument: doc },
			iterateAllLeaves: () => {},
			trigger: () => {},
		},
	} as unknown as App;

	const g = globalThis as Record<string, unknown>;
	const saved = {
		activeDocument: g.activeDocument,
		createEl: g.createEl,
		HTMLStyleElement: g.HTMLStyleElement,
		window: g.window,
	};
	g.activeDocument = doc;
	g.createEl = () => styleEl;
	g.HTMLStyleElement = class {} as unknown;
	g.window = { localStorage: { getItem: () => null, setItem: () => {} } };
	try {
		const registry = new CalloutRegistry();
		registry.load(null);
		build(registry);
		new CSSInjector(app, registry).inject(false);
		return writes.at(-1) ?? "";
	} finally {
		Object.assign(g, saved);
	}
}

/** The rules a shared page gets that draw a placeholder named `name`. */
const drawingsFor = (css: string, name: string): CssRule[] =>
	parseRules(css).filter((rule) => rule.selector.includes(`[data-share-note-lucide="${name}"]`));

/**
 * A block callout as reading view leaves it, its icon slot holding `drawing`,
 * and that callout after Share Note is done with it against `css`.
 */
function shared(css: string, id: string, drawing: string): { placeholder: FakeElement | null; name: string } {
	const root = el();
	const callout = root.createDiv({ cls: "callout", attr: { "data-callout": id } });
	const icon = callout.createDiv({ cls: "callout-title" }).createDiv({ cls: "callout-icon" });
	const cls = /class="([^"]*)"/.exec(drawing)?.[1] ?? "";
	icon.appendChild(el({ tag: "svg", cls: cls.split(" ").filter(Boolean) }));
	fixCalloutIcons(root, parseRules(css));
	const placeholder = icon.querySelector("svg");
	return { placeholder, name: placeholder?.getAttribute("data-share-note-lucide") ?? "" };
}

/* -------------------------------------------------------------------------- */

describe("Share Note: when the rules are written", () => {
	it("reads Share Note's switch from Obsidian's own lists", () => {
		const app = (enabled: string[], loaded: string[] = []) =>
			({
				plugins: {
					enabledPlugins: new Set(enabled),
					plugins: Object.fromEntries(loaded.map((id) => [id, {}])),
				},
			}) as unknown as App;
		assert.strictEqual(isShareNoteEnabled({} as App), false);
		assert.strictEqual(isShareNoteEnabled(app(["dataview"], ["dataview"])), false);
		assert.strictEqual(isShareNoteEnabled(app(["share-note"], ["share-note"])), true);
		// While it loads: its stylesheet is in the page, the enabled list not yet updated.
		assert.strictEqual(isShareNoteEnabled(app([], ["share-note"])), true);
	});

	it("looks again when the page's head changes, and says so only when the answer moved", () => {
		const observers: { callback: () => void; target: unknown; options: unknown }[] = [];
		const g = globalThis as Record<string, unknown>;
		const saved = g.MutationObserver;
		g.MutationObserver = class {
			constructor(private readonly callback: () => void) {}
			observe(target: unknown, options: unknown): void {
				observers.push({ callback: this.callback, target, options });
			}
			disconnect(): void {
				observers.length = 0;
			}
		};
		try {
			const plugins = { enabledPlugins: new Set<string>(), plugins: {} as Record<string, unknown> };
			const head = {};
			let calls = 0;
			const stop = watchShareNote({ plugins } as unknown as App, { head } as unknown as Document, () => calls++);
			const [watch] = observers;
			assert.ok(watch);
			assert.strictEqual(watch.target, head);
			assert.deepStrictEqual(watch.options, { childList: true }, "the head's own children only");

			watch.callback(); // a theme's stylesheet came: nothing to do
			assert.strictEqual(calls, 0);
			plugins.plugins["share-note"] = {};
			watch.callback(); // Share Note's stylesheet came, while it loads
			assert.strictEqual(calls, 1);
			plugins.enabledPlugins.add("share-note");
			watch.callback(); // a snippet: still on
			assert.strictEqual(calls, 1);
			plugins.enabledPlugins.clear();
			delete plugins.plugins["share-note"];
			watch.callback(); // switched off
			assert.strictEqual(calls, 2);

			stop();
			assert.strictEqual(observers.length, 0, "unload stops watching");
		} finally {
			g.MutationObserver = saved;
		}
	});

	it("writes nothing while Share Note is off: the sheet is what it was", () => {
		const off = sheet(false);
		assert.ok(off.length > 0, "the sheet was assembled");
		assert.ok(!off.includes(SHARE_NOTE_BODY_CLASS));
		assert.ok(!off.includes("data-share-note-lucide"));
	});

	it("only adds to the end of the sheet while Share Note is on", () => {
		const off = sheet(false);
		const on = sheet(true);
		assert.ok(on.startsWith(off), "nothing before the Share Note rules moved");
		const added = on.slice(off.length);
		assert.ok(added.includes("data-share-note-lucide"));
		for (const rule of parseRules(added)) {
			assert.ok(rule.selector.startsWith(`:where(body.${SHARE_NOTE_BODY_CLASS}) `), rule.selector);
		}
	});
});

describe("Share Note: the names it carries have a drawing", () => {
	it("leaves the untouched [!note] to Share Note: its pencil has a name Share Note's Lucide knows", () => {
		const css = sheet(true);
		const { name } = shared(css, "note", OBSIDIAN["lucide-pencil"]);
		assert.strictEqual(name, "pencil");
	});

	it("draws a [!note] saved with the bare `pencil`, whose Obsidian drawing Share Note's Lucide cannot name", () => {
		const css = sheet(true, (r) => r.update("note", { icon: lucide("pencil") }));
		const { placeholder, name } = shared(css, "note", OBSIDIAN.pencil);
		assert.strictEqual(name, "edit-3");
		assert.deepStrictEqual(placeholder?.children, [], "the placeholder is empty, so :empty matches it");
		const [rule, ...more] = drawingsFor(css, name);
		assert.ok(rule, "a drawing waits for edit-3");
		assert.strictEqual(more.length, 0);
		assert.strictEqual(
			rule.selector,
			`:where(body.${SHARE_NOTE_BODY_CLASS}) .callout-icon > svg[data-share-note-lucide="edit-3"]:empty`,
		);
		assert.ok(rule.decls.includes(`--cs-share-icon: ${svgToDataUri(OBSIDIAN.pencil)}`));
		assert.ok(rule.decls.includes("mask-image: var(--cs-share-icon)"));
		assert.ok(rule.decls.includes("background-color: currentColor"), "in the icon's own colour");
	});

	it("draws a Lucide name that is newer than Share Note's Lucide", () => {
		const css = sheet(true, (r) => {
			r.add(definition({ id: "faq-2", icon: lucide("circle-help") }));
			r.update("tip", { icon: lucide("triangle-alert") });
		});
		for (const [id, drawing] of [
			["faq-2", OBSIDIAN["circle-help"]],
			["tip", OBSIDIAN["triangle-alert"]],
		] as const) {
			const { name } = shared(css, id, drawing);
			assert.strictEqual(drawingsFor(css, name).length, 1, `${id} → ${name}`);
		}
	});

	it("names another plugin's icon the way Share Note does: from the callout's --callout-icon", () => {
		const css = sheet(true, (r) => r.add(definition({ id: "spark", icon: lucide("remix-Spark") })));
		const { name } = shared(css, "spark", OBSIDIAN["remix-Spark"]);
		assert.strictEqual(name, "remix-Spark");
		assert.strictEqual(drawingsFor(css, name).length, 1);
	});

	it("writes one drawing per name, however many callouts wear it", () => {
		const css = sheet(true, (r) => {
			r.add(definition({ id: "one", icon: lucide("flame") }));
			r.add(definition({ id: "two", icon: lucide("flame") }));
		});
		// `tip` wears it too, untouched.
		assert.strictEqual(drawingsFor(css, "flame").length, 1);
	});

	it("leaves out a hidden icon and a callout the theme draws", () => {
		const css = sheet(true, (r) => {
			r.add(definition({ id: "quiet", icon: lucide("circle-help"), hideIcon: true }));
			r.add(definition({ id: "themed", icon: lucide("triangle-alert") }));
			r.setThemeOwnedIds(new Set(["themed"]));
		});
		assert.strictEqual(drawingsFor(css, "circle-help").length, 0);
		assert.strictEqual(drawingsFor(css, "triangle-alert").length, 0);
	});

	it("needs nothing for a pack glyph, a picture or an emoji: their own rule already hides the slot", () => {
		const css = sheet(true, (r) => r.add(definition({ id: "cactus", icon: EMOJI })));
		const hides = parseRules(css).filter(
			(rule) =>
				rule.selector.includes('[data-callout="cactus"] > .callout-title > .callout-icon > svg') &&
				rule.decls.some((d) => d.startsWith("display: none")),
		);
		assert.strictEqual(hides.length, 1);
		assert.ok(reachesPage(hides[0] as CssRule), "@media screen reaches the page; only @media print is dropped");
	});

	it("draws nothing for an id Obsidian has no drawing for", () => {
		const css = sheet(true, (r) => r.add(definition({ id: "ghost", icon: lucide("not-an-icon") })));
		assert.ok(!css.includes('"not-an-icon"'));
	});
});

describe("Share Note: the fallback", () => {
	const picture = (recolor: boolean) => (registry: CalloutRegistry) => {
		registry.setUserImages([
			{
				id: "img-pic",
				name: "logo.svg",
				format: "svg",
				svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30"><rect width="30" height="30" fill="#f00"/></svg>',
				width: 30,
				height: 30,
				monochrome: false,
				rev: 1,
				addedAt: 1,
			},
		]);
		registry.add(definition({ id: "fallback", icon: { type: "image", value: "img-pic", recolor } }));
		registry.settings.fallbackCalloutId = "fallback";
	};

	it("names the drawing it paints, so Share Note keeps it", () => {
		const iconEl = el({ cls: "callout-icon" });
		iconEl.appendChild(el({ tag: "svg", cls: CSS_FALLBACK_ICON }));
		nameFallbackDrawing(asEl(iconEl), "painted");
		assert.ok(iconEl.children[0]?.classList.contains(SHARE_NOTE_FALLBACK_CLASS));
		assert.strictEqual(SHARE_NOTE_FALLBACK_CLASS, `lucide-${SHARE_NOTE_FALLBACK_NAME}`);
	});

	it("leaves a placeholder and an emoji unnamed", () => {
		const placeholder = el({ cls: "callout-icon" });
		placeholder.appendChild(el({ tag: "svg", cls: "lucide-pencil" }));
		nameFallbackDrawing(asEl(placeholder), "placeholder");
		assert.ok(!placeholder.children[0]?.classList.contains(SHARE_NOTE_FALLBACK_CLASS));

		const emoji = el({ cls: "callout-icon" });
		emoji.appendChild(el({ tag: "span", cls: CSS_FALLBACK_ICON, text: "🌵" }));
		nameFallbackDrawing(asEl(emoji), "painted");
		assert.ok(!emoji.children[0]?.classList.contains(SHARE_NOTE_FALLBACK_CLASS));
	});

	it("comes out of Share Note under that name, with a drawing waiting for it", () => {
		const css = sheet(true, picture(true));
		const { name } = shared(
			css,
			"mystery",
			`<svg class="${CSS_FALLBACK_ICON} ${SHARE_NOTE_FALLBACK_CLASS}"></svg>`,
		);
		assert.strictEqual(name, SHARE_NOTE_FALLBACK_NAME);
		const [rule] = drawingsFor(css, name);
		assert.ok(rule?.decls.includes("mask-image: var(--cs-share-icon)"), "a recoloured picture is a mask");
	});

	it("draws a picture that keeps its colours as itself, not as a mask", () => {
		const [rule] = drawingsFor(sheet(true, picture(false)), SHARE_NOTE_FALLBACK_NAME);
		assert.ok(rule?.decls.some((d) => d.startsWith("background-image: url(")));
		assert.ok(!rule?.decls.some((d) => d.startsWith("mask-image")));
	});

	it("needs no name for a Lucide fallback, an emoji fallback or a hidden one", () => {
		const fallback =
			(icon: CalloutIcon, hideIcon = false) =>
			(registry: CalloutRegistry) => {
				registry.add(definition({ id: "fallback", icon, hideIcon }));
				registry.settings.fallbackCalloutId = "fallback";
			};
		assert.strictEqual(drawingsFor(sheet(true, fallback(lucide("flame"))), SHARE_NOTE_FALLBACK_NAME).length, 0);
		assert.strictEqual(drawingsFor(sheet(true, fallback(EMOJI)), SHARE_NOTE_FALLBACK_NAME).length, 0);
		const hiddenPicture = (registry: CalloutRegistry): void => {
			picture(false)(registry);
			registry.update("fallback", { hideIcon: true });
		};
		assert.strictEqual(drawingsFor(sheet(true, hiddenPicture), SHARE_NOTE_FALLBACK_NAME).length, 0);
	});
});

describe("Share Note: the drawings survive the upload", () => {
	it("each data URI is uploaded whole or left as it is, never cut short", () => {
		const css = sheet(true, (r) => r.add(definition({ id: "faq-2", icon: lucide("circle-help") })));
		const added = css.slice(sheet(false).length);
		const found = cssAttachments(added);
		assert.ok(found.length > 0);
		for (const { found: text, uploaded } of found) {
			if (uploaded === null) continue;
			assert.ok(added.includes(`url("${uploaded}")`), `uploaded whole: ${text.slice(0, 60)}`);
		}
	});

	it("an Obsidian drawing has no ')' in its URI, so it is always uploaded", () => {
		for (const drawing of Object.values(OBSIDIAN)) {
			const uri = svgToDataUri(drawing);
			const [found] = cssAttachments(uri);
			assert.strictEqual(found?.uploaded, uri.slice('url("'.length, -'")'.length));
		}
	});

	it("nothing here is dropped with Share Note's @media print", () => {
		const rules = parseRules(sheet(true)).filter((rule) => rule.selector.includes("data-share-note-lucide"));
		assert.ok(rules.length > 0);
		for (const rule of rules) assert.ok(reachesPage(rule) && rule.at.length === 0, rule.selector);
	});
});

describe("Share Note: the rule text", () => {
	it("escapes a name the way an attribute value needs", () => {
		const css = shareNoteIconCSS([{ name: 'a"b\\c', svg: OBSIDIAN.flame }]);
		assert.ok(css.includes('[data-share-note-lucide="a\\"b\\\\c"]'));
	});

	it("is empty with nothing to draw", () => {
		assert.strictEqual(shareNoteIconCSS([]), "");
	});
});
