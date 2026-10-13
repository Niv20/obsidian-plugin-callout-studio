/**
 * manager/theme/ThemeClaimCheck.ts — does the theme really draw the callouts
 * it names?
 *
 * The text scan says which callout ids a theme's stylesheet names. Naming is
 * not drawing, and the difference decides whose design a reader sees: a
 * callout the theme owns gets nothing from this plugin. Over the 65 installed
 * themes that name a callout, 451 of the 1,292 rows they listed changed
 * nothing on screen (see `themeClaimEffect.ts` for what those rules were). For
 * a built-in or a callout the user made, that hid their design for nothing.
 *
 * Two checks, both against the browser's parsed copy of the theme in the main
 * window:
 *
 * - **Page conditions** ({@link ThemeClaimCheck.pageRootOff}), synchronous,
 *   for every id. A rule that asks `<body>` or `<html>` for a class the page
 *   does not have draws nothing — Retroma's 312 types sit behind one such
 *   option. Style Settings fires `css-change` when an option flips, and the
 *   sweep asks again.
 * - **A measured difference** ({@link ThemeClaimCheck.check}), asynchronous,
 *   only for ids that carry a design of their own here: a built-in, a callout
 *   the user or another plugin made. Each one is rendered
 *   offscreen, read, read again with exactly the theme rules that name it
 *   switched off, and both rules and this plugin's own CSS are back before the
 *   task ends — nothing is ever painted without them.
 *
 * Only those ids are measured because a type the theme invents has no design
 * here to lose, and many of them are drawn only where a lone render cannot
 * reach: Ukiyo's `col` inside a `cont`, Dune's `[!leer|l]`, Kakano's column
 * children. Measured alone they would leave the list and pick up the fallback's
 * look inside the theme's own layout — which is also why a saved scan row,
 * a copy of the fallback's look, is left as it was.
 *
 * Every doubt resolves the way ownership always did, to the theme: no parsed
 * sheet, a rule the browser would not rewrite, a render that failed, an id no
 * parsed rule names.
 */
import { Component, MarkdownRenderer, Platform, type App } from "obsidian";
import { obsidianCalloutAttrId } from "../../utils/calloutId";
import { reparseTheme, themeCss, themeSheet, themeSignature } from "./customCssApi";
import { localClaimVerdicts, type ClaimVerdictStore } from "./themeClaimCache";
import { domReader, type ComputedStyleReader } from "./readCalloutStyle";
import { changesVisibly, sampledStyle, type CalloutStyle } from "./themeClaimEffect";
import { namesInSelector, styleSettingsClasses, withoutName } from "./themeClaimSelectors";
import {
	indexRules,
	optionGatedRule,
	pageRootTest,
	ruleInForce,
	type RuleIndex,
} from "./themeClaimRules";

/** Kept in sync with the probe container rule in `styles.css`. */
const HOST_CLASS = "cs-theme-probe";

/** The two places a callout is drawn, as rendered for one id. */
interface Rendered {
	reading: HTMLElement;
	live: HTMLElement;
}

export interface ThemeClaimCheckOptions {
	/** Computed-style reader; injected by tests, which have no cascade. */
	read?: ComputedStyleReader;
	/** The property names to compare. Defaults to every computed longhand. */
	properties?: (doc: Document) => readonly string[];
	/** Waits for a task of its own; tests, whose timers never fire, resolve it at once. */
	nextTask?: () => Promise<void>;
	/** Where verdicts outlive the session; device `localStorage` by default. */
	store?: ClaimVerdictStore;
	/** Ids judged in one synchronous pass; defaults to all of them, 8 on a phone or tablet. */
	batchSize?: number;
}

/** What a caller hands {@link ThemeClaimCheck.check}. */
export interface ClaimCheckRequest {
	/** Attribute-form ids of built-ins and of callouts the user or a plugin made. */
	ids: readonly string[];
	/** Switch this plugin's generated CSS off; the returned function restores it. */
	suspendStudioCss: () => () => void;
	/** Called when an id moved between "drawn" and "not drawn". */
	onChange: () => void;
}

/**
 * A task of its own, in a moment the window is idle. The check starts from a
 * `css-change` or from the plugin loading, which already pay for a sweep and a
 * full CSS pass, and Obsidian itself is busiest right then; run in the same
 * task, they read as one long freeze. `requestIdleCallback` waits for a gap,
 * at most a second; a webview without it gets the next macrotask.
 */
const nextIdleTask = (): Promise<void> =>
	new Promise((resolve) => {
		const win = window as Window & {
			requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
		};
		if (typeof win.requestIdleCallback === "function") {
			win.requestIdleCallback(() => resolve(), { timeout: 1000 });
		} else {
			window.setTimeout(resolve, 0);
		}
	});

/** Every class carried by `root` or an element under it. */
function classesUnder(root: Element): Set<string> {
	const out = new Set<string>();
	const walk = (el: Element): void => {
		// On the icon's SVG `className` is an object; its attribute is the text.
		const raw = typeof el.className === "string" ? el.className : (el.getAttribute("class") ?? "");
		for (const cls of raw.split(/\s+/)) if (cls) out.add(cls);
		for (const child of Array.from(el.children)) walk(child);
	};
	walk(root);
	return out;
}

/**
 * Jump every CSS transition running in `el`'s subtree, pseudo-elements
 * included, to its end, so a computed value read now is the one the rules
 * settle on and not a frame of the way there.
 *
 * A theme's `transition` on a callout would otherwise answer the switch with
 * the value it had a moment ago and hide the very difference being measured.
 * `styles.css` already turns transitions off inside the probe, but a theme
 * rule with `!important` and more weight wins that. Keyframe animations are
 * left alone: an infinite one cannot finish, and it reads the same both ways.
 */
function finishTransitions(el: Element): void {
	const running =
		(el as Element & { getAnimations?: (options?: { subtree?: boolean }) => Animation[] })
			.getAnimations?.({ subtree: true }) ?? [];
	for (const animation of running) {
		if (typeof (animation as Animation & { transitionProperty?: unknown }).transitionProperty !== "string") {
			continue;
		}
		try {
			animation.finish();
		} catch {
			/* one that cannot finish keeps running; the read errs toward the theme */
		}
	}
}

/** Ids per synchronous pass on a phone or tablet - see {@link ThemeClaimCheck.compare}. */
const MOBILE_BATCH = 8;

/**
 * Every computed longhand, custom properties left out: `changesVisibly` never
 * counts one (what it changes shows up in the properties that read it), and a
 * theme can define a thousand of them on `<body>`, each read off every box.
 */
export function everyComputedProperty(doc: Document): readonly string[] {
	const style = (doc.defaultView ?? window).getComputedStyle(doc.body);
	const out: string[] = [];
	for (let i = 0; i < style.length; i++) {
		const name = style.item(i);
		if (!name.startsWith("--")) out.push(name);
	}
	return out;
}

export class ThemeClaimCheck {
	private readonly indexes = new WeakMap<CSSStyleSheet, RuleIndex>();
	/** Per parsed sheet: the class names its Style Settings block can put on `<body>`. */
	private readonly optionClassSets = new WeakMap<CSSStyleSheet, Set<string>>();
	private readonly read: ComputedStyleReader;
	private readonly properties: (doc: Document) => readonly string[];
	private readonly nextTask: () => Promise<void>;
	private readonly batchSize: number;
	private readonly store: ClaimVerdictStore;
	private propertyList: readonly string[] | null = null;
	/** Per id: did switching the theme's rules off change what is drawn? */
	private verdicts = new Map<string, boolean>();
	/**
	 * The theme the verdicts describe (`themeSignature`: name and version, no
	 * snippets). Another theme's verdicts mean nothing; a snippet switched on
	 * or off leaves the theme's own rules as they were, so it keeps them.
	 */
	private verdictSignature: string | null = null;
	/**
	 * Ids a pass has been asked about for {@link verdictSignature}, whether or
	 * not it could judge them - so {@link hasUnmeasured} asks once for an id
	 * that cannot be measured (no rule the browser parsed, a failed render),
	 * not at every css-change.
	 */
	private asked = new Set<string>();
	private generation = 0;
	private running = false;
	private pending: ClaimCheckRequest | null = null;
	private destroyed = false;

	constructor(
		private readonly app: App,
		options: ThemeClaimCheckOptions = {},
	) {
		this.read = options.read ?? domReader;
		this.properties = options.properties ?? everyComputedProperty;
		this.nextTask = options.nextTask ?? nextIdleTask;
		this.batchSize = Math.max(1, options.batchSize ?? (Platform.isMobile ? MOBILE_BATCH : Infinity));
		this.store = options.store ?? localClaimVerdicts(app);
	}

	/**
	 * The styling may have changed (`css-change`). A pass in flight stops
	 * counting; verdicts for another theme are swapped for that theme's, and
	 * verdicts for this one are kept until a new pass replaces them, so a Style
	 * Settings toggle or a snippet does not hand every callout back to the
	 * theme for the length of a render.
	 */
	invalidate(): void {
		this.generation++;
		this.syncVerdicts();
	}

	/**
	 * Make {@link verdicts} the active theme's: kept when they already are,
	 * else the ones this device remembers for it (`themeClaimCache.ts`), else
	 * none. Remembered verdicts are what keep a launch, or a switch back to a
	 * theme used before, from flashing every callout the theme names but does
	 * not draw; the next pass replaces them.
	 */
	private syncVerdicts(): void {
		const signature = themeSignature(this.app);
		if (this.verdictSignature === signature) return;
		this.verdicts = this.store.load(signature) ?? new Map<string, boolean>();
		this.verdictSignature = signature;
		this.asked = new Set(this.verdicts.keys());
	}

	/**
	 * Whether any of `ids` has never been put to a pass for the active theme.
	 * A name added since the last pass - a callout imported, made by another
	 * plugin, given an alias the theme names - would otherwise count as the
	 * theme's until the theme next fired a css-change.
	 */
	hasUnmeasured(ids: Iterable<string>): boolean {
		if (this.destroyed) return false;
		this.syncVerdicts();
		for (const id of ids) if (!this.asked.has(id)) return true;
		return false;
	}

	/**
	 * The ids, of `ids`, that every parsed rule naming them keeps behind a
	 * `<body>`/`<html>` condition the page fails right now.
	 */
	pageRootOff(ids: ReadonlySet<string>): Set<string> {
		const out = new Set<string>();
		const index = this.currentIndex();
		if (!index || ids.size === 0) return out;
		const ruleOff = pageRootTest(this.mainDocument());
		for (const id of ids) {
			const rules = index.get(id);
			// No parsed rule names it: nothing to judge, so it stays the theme's.
			if (rules && rules.length > 0 && rules.every(ruleOff)) out.add(id);
		}
		return out;
	}

	/** The ids, of `ids`, last measured to look the same without the theme's rules. */
	unstyled(ids: Iterable<string>): Set<string> {
		const out = new Set<string>();
		if (this.destroyed) return out;
		this.syncVerdicts();
		for (const id of ids) if (this.verdicts.get(id) === false) out.add(id);
		return out;
	}

	/**
	 * Measure `request.ids` and call `onChange` when one moved. A request that
	 * arrives mid-pass waits in one slot and runs next, as the appearance probe
	 * does, so a burst of `css-change` events costs one extra pass.
	 */
	async check(request: ClaimCheckRequest): Promise<void> {
		if (this.destroyed) return;
		if (this.running) {
			this.pending = request;
			return;
		}
		this.running = true;
		const generation = this.generation;
		const signature = themeSignature(this.app);
		this.syncVerdicts();
		for (const id of request.ids) this.asked.add(id);
		let measured: Map<string, boolean> | null = null;
		try {
			measured = await this.measure(request, generation);
		} catch {
			measured = null;
		} finally {
			this.running = false;
		}
		if (
			measured &&
			!this.destroyed &&
			generation === this.generation &&
			themeSignature(this.app) === signature
		) {
			this.syncVerdicts();
			let moved = false;
			for (const [id, drawn] of measured) {
				if ((this.verdicts.get(id) === false) !== !drawn) moved = true;
				this.verdicts.set(id, drawn);
			}
			this.store.save(signature, this.verdicts);
			if (moved) request.onChange();
		}
		const next = this.pending;
		this.pending = null;
		if (next && !this.destroyed) await this.check(next);
	}

	destroy(): void {
		this.destroyed = true;
		this.pending = null;
		this.verdicts = new Map();
		this.verdictSignature = null;
		this.asked = new Set();
	}

	/** The main window's document — see `ThemeAppearanceProbe.mainDocument`. */
	private mainDocument(): Document {
		return this.app.workspace.containerEl.ownerDocument;
	}

	private currentIndex(): RuleIndex | null {
		const sheet = themeSheet(this.app);
		if (!sheet) return null;
		const cached = this.indexes.get(sheet);
		if (cached) return cached;
		const index = indexRules(sheet);
		if (index) this.indexes.set(sheet, index);
		return index;
	}

	private async measure(
		request: ClaimCheckRequest,
		generation: number,
	): Promise<Map<string, boolean> | null> {
		await this.nextTask();
		if (this.destroyed || generation !== this.generation) return null;
		const index = this.currentIndex();
		if (!index) return null;
		const wanted = [...new Set(request.ids)]
			.filter((id) => (index.get(id)?.length ?? 0) > 0 && !/[[\]\r\n|]/.test(id))
			.sort();
		if (wanted.length === 0) return new Map();

		const doc = this.mainDocument();
		const host = doc.body.createDiv({ cls: HOST_CLASS });
		host.setAttribute("aria-hidden", "true");
		// One owner per pass for whatever the render attaches (post-processor
		// children), unloaded with the host rather than kept for the session.
		const component = new Component();
		component.load();
		try {
			const rendered = await this.render(host, wanted, component);
			if (this.destroyed || generation !== this.generation) return null;
			// An id with a rule the measurement cannot see in force stays the
			// theme's whatever the comparison says - see `rulesSeen`.
			const seen = this.rulesSeen(wanted, index, rendered, doc, host);
			const judged = wanted.filter((id) => seen.has(id));
			const out = new Map<string, boolean>();
			if (judged.length > 0) {
				this.propertyList ??= this.properties(doc);
				const compared = await this.compare(judged, index, rendered, this.propertyList, request, generation);
				if (compared === null) return null;
				for (const [id, drawn] of compared) out.set(id, drawn);
			}
			for (const id of wanted) {
				if (rendered.has(id) && !seen.has(id)) out.set(id, true);
			}
			return out;
		} finally {
			host.remove();
			component.unload();
		}
	}

	/**
	 * Every wanted id once in reading view's ancestry and once in Live
	 * Preview's, because a theme may style either alone.
	 */
	private async render(
		host: HTMLElement,
		ids: readonly string[],
		component: Component,
	): Promise<Map<string, Rendered>> {
		// A note's own ancestry, both views under one leaf as in a real pane,
		// so a theme rule scoped to `.markdown-reading-view` or to a markdown
		// leaf is in force here as it is on the page.
		const view = host
			.createDiv({ cls: "workspace-leaf-content", attr: { "data-type": "markdown" } })
			.createDiv({ cls: "view-content" });
		const section = view
			.createDiv({ cls: "markdown-reading-view" })
			.createDiv({ cls: "markdown-preview-view markdown-rendered" })
			.createDiv({ cls: "markdown-preview-sizer markdown-preview-section" });
		const lines = view
			.createDiv({ cls: "markdown-source-view cm-s-obsidian mod-cm6 is-live-preview" })
			.createDiv({ cls: "cm-editor" })
			.createDiv({ cls: "cm-scroller" })
			.createDiv({ cls: "cm-sizer" })
			.createDiv({ cls: "cm-contentContainer" })
			.createDiv({ cls: "cm-content" });
		// The header alone plus a line of body and a list item, so content rules
		// have something to land on. Never a display name: one with a newline
		// would split the blockquote.
		await MarkdownRenderer.render(
			this.app,
			ids.map((id) => `> [!${id}]\n> x\n> - x`).join("\n\n"),
			section,
			"",
			component,
		);
		const wanted = new Set(ids);
		const out = new Map<string, Rendered>();
		for (const reading of Array.from(section.querySelectorAll<HTMLElement>(".callout"))) {
			const id = obsidianCalloutAttrId(reading.getAttribute("data-callout") ?? "");
			if (!wanted.has(id) || out.has(id)) continue;
			const live = reading.cloneNode(true) as HTMLElement;
			// Obsidian's own widget: `.markdown-rendered` is a child of
			// `.cm-embed-block.cm-callout`, not a class on it (snippets in the
			// wild select `.cm-callout:has(> div.markdown-rendered > …)`).
			lines
				.createDiv({ cls: "cm-embed-block cm-callout" })
				.createDiv({ cls: "markdown-rendered" })
				.appendChild(live);
			out.set(id, { reading, live });
		}
		return out;
	}

	/**
	 * The ids, of `ids`, whose every theme rule the measurement can see: in
	 * force on a box of the rendered callout in either view, or switched off
	 * by the page - a `<body>`/`<html>` condition it fails or a Style Settings
	 * option class it lacks (`themeClaimRules.ts`).
	 *
	 * Only those can be judged "not drawn". A rule the offscreen render does
	 * not satisfy - scoped to a note's `cssclasses`, an embed, a hover, a
	 * folded state, a narrow window, a container query - may well draw on the
	 * page, and a comparison that never saw it in force says nothing about it.
	 * Such an id stays the theme's, as every id was before the check existed.
	 */
	private rulesSeen(
		ids: readonly string[],
		index: RuleIndex,
		rendered: ReadonlyMap<string, Rendered>,
		doc: Document,
		host: HTMLElement,
	): Set<string> {
		const pageOff = pageRootTest(doc);
		// A class the rendered note carries is structure, not an option, whatever
		// a Style Settings block happens to call one of its entries.
		const carried = classesUnder(host);
		const options = new Set([...this.optionClasses()].filter((cls) => !carried.has(cls)));
		const out = new Set<string>();
		for (const id of ids) {
			const views = rendered.get(id);
			if (!views) continue;
			const boxes = new Set<Element>(
				[...this.boxesOf(views.reading), ...this.boxesOf(views.live)].map(([, el]) => el),
			);
			const rules = index.get(id) ?? [];
			const seen = (rule: (typeof rules)[number]): boolean =>
				pageOff(rule) || optionGatedRule(rule, options, doc) || ruleInForce(rule, boxes, doc);
			if (rules.every(seen)) {
				out.add(id);
			}
		}
		return out;
	}

	/** The active theme's Style Settings classes, read once per parsed sheet. */
	private optionClasses(): Set<string> {
		const sheet = themeSheet(this.app);
		if (!sheet) return new Set();
		let known = this.optionClassSets.get(sheet);
		if (!known) {
			known = styleSettingsClasses(themeCss(this.app));
			this.optionClassSets.set(sheet, known);
		}
		return known;
	}

	/**
	 * Which ids look different without the theme's rules for them; `null`
	 * when a `css-change` overtook the passes.
	 *
	 * Reading view first; only an id it shows no difference for is read again
	 * in Live Preview's ancestry. Each pass is {@link comparePass}, one
	 * synchronous run, and the passes are separate tasks: Live Preview's waits
	 * for the next idle moment, and on a phone or tablet a long list is cut into
	 * batches of {@link MOBILE_BATCH}, so no single freeze has to hold them all.
	 * Between passes every rule and this plugin's CSS are back; a pass a
	 * `css-change` overtook is dropped with the rest.
	 */
	private async compare(
		ids: readonly string[],
		index: RuleIndex,
		rendered: ReadonlyMap<string, Rendered>,
		props: readonly string[],
		request: ClaimCheckRequest,
		generation: number,
	): Promise<Map<string, boolean> | null> {
		const out = new Map<string, boolean>();
		let open = ids;
		let first = true;
		for (const view of ["reading", "live"] as const) {
			const still: string[] = [];
			for (let at = 0; at < open.length; at += this.batchSize) {
				if (!first) {
					await this.nextTask();
					if (this.destroyed || generation !== this.generation) return null;
				}
				first = false;
				const batch = open.slice(at, at + this.batchSize);
				const restoreStudioCss = request.suspendStudioCss();
				let pass: Map<string, boolean> | null;
				try {
					pass = this.comparePass(batch, index, rendered, props, view);
				} finally {
					restoreStudioCss();
				}
				for (const id of batch) {
					// A batch whose rules the browser would not rewrite cannot be
					// weighed: those ids stay the theme's.
					if (pass === null || pass.get(id) === true) out.set(id, true);
					else still.push(id);
				}
			}
			open = still;
		}
		for (const id of open) out.set(id, false);
		return out;
	}

	/**
	 * One view, one batch: does each id look different without the theme's
	 * rules for it? `null` when the browser would not take a rewritten
	 * selector.
	 *
	 * One synchronous run, so no frame is painted with any rule or this
	 * plugin's CSS switched off (the caller holds it off around this). Batched
	 * rather than one id at a time: every switch makes the browser lay the
	 * whole window out again on the next read, and per id that cost AnuPpuccin
	 * a 1.5 s freeze. Here it is two layouts per pass however many ids there
	 * are.
	 *
	 * Switching all of them off together can only add a difference — a rule
	 * naming another id that also reached this callout — never hide one, so it
	 * errs toward the theme.
	 */
	private comparePass(
		ids: readonly string[],
		index: RuleIndex,
		rendered: ReadonlyMap<string, Rendered>,
		props: readonly string[],
		view: keyof Rendered,
	): Map<string, boolean> | null {
		const callouts = ids.flatMap((id) => rendered.get(id)?.[view] ?? []);
		const settle = (): void => {
			for (const callout of callouts) finishTransitions(callout);
		};
		const without = this.withRulesOff(ids, index, settle, (id) => {
			const callout = rendered.get(id)?.[view];
			return callout ? this.sample(callout, props) : null;
		});
		if (without === null) return null;
		// The rules are back: let what they start settle before the other side.
		settle();
		const out = new Map<string, boolean>();
		for (const id of ids) {
			const before = without.get(id);
			const callout = rendered.get(id)?.[view];
			out.set(id, Boolean(before && callout && changesVisibly(props, before, this.liveStyle(callout))));
		}
		return out;
	}

	/**
	 * Switch off every theme rule naming one of `ids`, read each callout, and
	 * switch them back. `null` when the browser would not take a rewritten
	 * selector: a rule that is still on cannot be weighed.
	 */
	private withRulesOff(
		ids: readonly string[],
		index: RuleIndex,
		settle: () => void,
		read: (id: string) => CalloutStyle | null,
	): Map<string, CalloutStyle> | null {
		const off = new Set(ids);
		const rules = [...new Set(ids.flatMap((id) => index.get(id) ?? []))];
		const original = rules.map((rule) => rule.selectorText);
		try {
			rules.forEach((rule, i) => {
				let selector = original[i] ?? rule.selectorText;
				for (const id of namesInSelector(selector)) {
					if (off.has(id)) selector = withoutName(selector, id);
				}
				rule.selectorText = selector;
			});
			if (rules.some((rule, i) => rule.selectorText === original[i])) return null;
			settle();
			const out = new Map<string, CalloutStyle>();
			for (const id of ids) {
				const style = read(id);
				if (style) out.set(id, style);
			}
			return out;
		} finally {
			rules.forEach((rule, i) => {
				rule.selectorText = original[i] ?? rule.selectorText;
			});
			// The browser's own serialisation always parses back, so this should
			// never fire; if it ever did, a theme rule would stay switched off
			// until Obsidian reloaded the theme. Re-reading the theme's own text
			// is the one way back to exactly what it wrote.
			if (rules.some((rule, i) => rule.selectorText !== original[i])) {
				reparseTheme(this.app);
			}
		}
	}

	/** The boxes a callout is read from, with the pseudo-element each names. */
	private boxesOf(callout: HTMLElement): Array<[string, Element, string | null]> {
		const title = callout.querySelector(":scope > .callout-title");
		const content = callout.querySelector(":scope > .callout-content");
		const icon = title?.querySelector(".callout-icon") ?? null;
		const svg = icon?.firstElementChild ?? null;
		const inner = title?.querySelector(".callout-title-inner") ?? null;
		const out: Array<[string, Element, string | null]> = [];
		const add = (name: string, el: Element | null | undefined): void => {
			if (el) out.push([name, el, null]);
		};
		add("callout", callout);
		add("title", title);
		add("icon", icon);
		add("svg", svg);
		add("svg path", svg?.querySelector("path"));
		add("title-inner", inner);
		add("content", content);
		add("p", content?.querySelector("p"));
		add("li", content?.querySelector("li"));
		for (const [name, el] of [
			["callout", callout],
			["title", title],
			["icon", icon],
			["title-inner", inner],
			["content", content],
		] as const) {
			if (!el) continue;
			out.push([`${name}::before`, el, "::before"], [`${name}::after`, el, "::after"]);
		}
		return out;
	}

	/** Every box read up front — the side of a comparison taken with rules off. */
	private sample(callout: HTMLElement, props: readonly string[]): CalloutStyle {
		const boxes = new Map<string, ReadonlyMap<string, string>>();
		for (const [name, el, pseudo] of this.boxesOf(callout)) {
			const style = this.read(el, pseudo);
			if (pseudo) {
				// Most pseudo-elements draw nothing; reading 400 values off each
				// would be most of the cost. `content` alone settles that.
				const drawn = style.getPropertyValue("content");
				if (drawn === "" || drawn === "none" || drawn === "normal") {
					boxes.set(name, new Map([["content", drawn]]));
					continue;
				}
			}
			boxes.set(name, new Map(props.map((prop) => [prop, style.getPropertyValue(prop)])));
		}
		return sampledStyle(this.read(callout).getPropertyValue("--callout-icon").trim(), boxes);
	}

	/** The same boxes, read only as far as a comparison asks. */
	private liveStyle(callout: HTMLElement): CalloutStyle {
		const boxes = new Map(this.boxesOf(callout).map(([name, el, pseudo]) => [name, { el, pseudo }]));
		const styles = new Map<string, Pick<CSSStyleDeclaration, "getPropertyValue">>();
		return {
			icon: () => this.read(callout).getPropertyValue("--callout-icon").trim(),
			boxes: () => boxes.keys(),
			value: (box, prop) => {
				let style = styles.get(box);
				if (!style) {
					const target = boxes.get(box);
					if (!target) return undefined;
					style = this.read(target.el, target.pseudo);
					styles.set(box, style);
				}
				return style.getPropertyValue(prop);
			},
		};
	}
}
