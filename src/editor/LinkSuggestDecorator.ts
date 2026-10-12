/**
 * editor/LinkSuggestDecorator.ts — Clean heading-callout titles in the link
 * suggestion popup.
 *
 * Typing `[[#` opens Obsidian's built-in link suggester, which renders each
 * heading suggestion's raw text — so `# [!tip] My Title` shows up as
 * `[!tip] My Title`. The suggester is not part of the typed API; like
 * AutoComplete.triggerNow we reach into `workspace.editorSuggest` (fully
 * guarded, so a changed internal shape simply disables the cleanup) and wrap
 * every registered suggester's renderSuggestion. The wrapper lets the
 * original render run, then — only for heading-type suggestion values whose
 * text starts with a callout token — strips the token from the rendered
 * title and prepends the callout's colored icon.
 *
 * Selecting a suggestion still inserts the full raw heading text, so the
 * produced link resolves normally — with one addition. A title-less heading
 * (`## [!tip]`) would produce `[[#[!tip]]]`, whose `]]]` run Obsidian's own
 * parser cuts at the first `]]`: Live Preview then shows a half-parsed
 * `#[!tip]` beside the caret and the raw link inside it. So the wrapped
 * selectSuggestion appends the callout's display name as the link's alias —
 * `[[#[!tip]|Tip]]` — which Obsidian parses, displays and follows natively,
 * like a link to a heading that has its own title.
 */
import type { App } from "obsidian";
import type { PluginSettings } from "../types";
import type { CalloutRegistry } from "../manager/CalloutRegistry";
import {
	findWikilinkCalloutRefs,
	parseOutlineHeadingText,
} from "./calloutTokens";
import {
	buildCalloutTokenDom,
	resolveCalloutDef,
	shouldRenderToken,
} from "./renderShared";
import { normalizeCalloutId } from "../utils/calloutId";

/** Narrow structural host type (avoids importing the concrete plugin class). */
export interface LinkSuggestHost {
	app: App;
	registry: CalloutRegistry;
	settings: PluginSettings;
}

type RenderSuggestionFn = (
	value: unknown,
	el: unknown,
	...rest: unknown[]
) => unknown;

type SelectSuggestionFn = (
	value: unknown,
	evt: unknown,
	...rest: unknown[]
) => unknown;

interface SuggestLike {
	renderSuggestion?: RenderSuggestionFn;
	selectSuggestion?: SelectSuggestionFn;
	/** EditorSuggest.context — where the query sits in which editor. */
	context?: unknown;
}

/** The slice of Obsidian's `Editor` the alias rewrite uses (duck-typed). */
interface EditorLike {
	getLine(line: number): string;
	getCursor(): { line: number; ch: number };
	replaceRange(text: string, from: { line: number; ch: number }): void;
	setSelection(
		anchor: { line: number; ch: number },
		head?: { line: number; ch: number },
	): void;
}

export class LinkSuggestDecorator {
	/** Undo thunks for every wrapped renderSuggestion, in wrap order. */
	private restores: Array<() => void> = [];

	constructor(private readonly host: LinkSuggestHost) {}

	/**
	 * Wrap renderSuggestion and selectSuggestion on every suggester registered
	 * at call time, except the instances in `skip` (our own autocomplete). Call
	 * once on layout-ready — the core link suggester exists by then; suggesters
	 * other plugins register later are simply left alone.
	 */
	install(skip: readonly object[]): void {
		const suggests = (
			this.host.app.workspace as unknown as {
				editorSuggest?: { suggests?: unknown[] };
			}
		).editorSuggest?.suggests;
		if (!Array.isArray(suggests)) return;

		const host = this.host;
		for (const entry of suggests) {
			if (!entry || typeof entry !== "object") continue;
			if ((skip as unknown[]).includes(entry)) continue;
			const suggest = entry as SuggestLike;
			const original = suggest.renderSuggestion;
			if (typeof original === "function") {
				suggest.renderSuggestion = function (
					this: unknown,
					value: unknown,
					el: unknown,
					...rest: unknown[]
				): unknown {
					const out = original.call(this, value, el, ...rest);
					try {
						decorateHeadingSuggestion(host, value, el);
					} catch {
						// Never break core's (or another plugin's) popup render.
					}
					return out;
				};
				this.restores.push(() => {
					suggest.renderSuggestion = original;
				});
			}
			const originalSelect = suggest.selectSuggestion;
			if (typeof originalSelect === "function") {
				suggest.selectSuggestion = function (
					this: SuggestLike | undefined,
					value: unknown,
					evt: unknown,
					...rest: unknown[]
				): unknown {
					// Read before the original runs: core's link suggester
					// closes itself, clearing its context, before inserting.
					const context = this?.context;
					const out = originalSelect.call(this, value, evt, ...rest);
					try {
						aliasTitlelessHeadingLink(host, value, evt, context);
					} catch {
						// The link is already in; never break the pick itself.
					}
					return out;
				};
				this.restores.push(() => {
					suggest.selectSuggestion = originalSelect;
				});
			}
		}
	}

	/** Restore every wrapped method (plugin unload). */
	uninstall(): void {
		for (const restore of this.restores) restore();
		this.restores = [];
	}
}

/**
 * Rewrite one rendered suggestion in place. Heading suggestions are
 * recognized by value shape (`{ type: "heading", heading: string }` — what
 * the core link suggester emits); everything else passes through untouched,
 * so wrapping unrelated suggesters is harmless.
 */
function decorateHeadingSuggestion(
	host: LinkSuggestHost,
	value: unknown,
	el: unknown,
): void {
	const { headingCallouts } = host.settings;
	if (!headingCallouts.enabled || !headingCallouts.refCleanTitles) return;
	if (!value || typeof value !== "object") return;
	const v = value as { type?: unknown; heading?: unknown };
	if (v.type !== "heading" || typeof v.heading !== "string") return;
	// Duck-typed, not instanceof — popout windows live in another JS realm.
	const root = el as HTMLElement | null;
	if (!root || typeof root !== "object" || !("querySelector" in root)) {
		return;
	}

	// The outline parser fits here too, but only its bracketed branch: unlike
	// the outline pane, HeadingCache.heading is the raw source text, so a real
	// callout heading always arrives as `[!id]`. A bracketless match could then
	// only come from a heading literally written `# !id Title` — not a callout.
	const token = parseOutlineHeadingText(v.heading, (raw) => {
		const id = normalizeCalloutId(raw);
		return !!(host.registry.get(id) ?? host.registry.findByAlias(id));
	});
	if (!token?.bracketed) return;

	const titleEl =
		root.querySelector<HTMLElement>(".suggestion-title") ??
		root.querySelector<HTMLElement>(".suggestion-content") ??
		root;

	// The title's leading text node must start with the exact prefix we
	// parsed off the heading. A search-highlight span inside the token, or a
	// renderer that shows something other than the heading text, breaks that
	// invariant — leave those untouched.
	const consumed = v.heading.length - token.title.length;
	const head = v.heading.slice(0, consumed);
	const textNode = titleEl.firstChild;
	if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return;
	const text = textNode.nodeValue ?? "";
	if (!text.startsWith(head)) return;

	const resolved = resolveCalloutDef(host.registry, token.rawId);
	// Theme-owned: the suggestion keeps the heading's raw text.
	if (!shouldRenderToken(resolved)) return;
	const { def, unknown } = resolved;
	if (token.title.trim() !== "") {
		textNode.nodeValue = text.slice(consumed);
	} else {
		// Titleless heading: show the callout's display name, like the
		// outline pane does (what the user wrote when the id is unknown).
		textNode.nodeValue = unknown || !def ? token.rawId.trim() : def.displayName;
	}
	if (headingCallouts.refShowIcon && def) {
		const iconEl = buildCalloutTokenDom({
			rawId: token.rawId,
			registry: host.registry,
			variant: "ref",
			showName: false,
		});
		titleEl.insertBefore(iconEl, titleEl.firstChild);
	}
}

/**
 * After a heading suggestion was inserted, turn `[[…#[!id]]]` into
 * `[[…#[!id]|Name]]` when the heading is a title-less callout heading (see the
 * file comment for why). Anything else is left exactly as core inserted it.
 *
 * The link is located from the suggest context, not the caret: core opens it
 * two characters before the query (`[[`), and the caret is wherever the
 * accepting key put it. It must still be the shape the link grammar calls a
 * title-less reference closing its link — the same test Live Preview uses —
 * so a `#` pressed to continue into a sub-heading, or an alias core kept from
 * the text after the caret, never matches.
 */
function aliasTitlelessHeadingLink(
	host: LinkSuggestHost,
	value: unknown,
	evt: unknown,
	context: unknown,
): void {
	const { headingCallouts } = host.settings;
	if (!headingCallouts.enabled || !headingCallouts.refCleanTitles) return;
	if (!value || typeof value !== "object") return;
	const v = value as { type?: unknown; heading?: unknown };
	if (v.type !== "heading" || typeof v.heading !== "string") return;
	// `|` was pressed to write an alias of the user's own.
	const key = (evt as { key?: unknown } | null)?.key;
	if (key === "|") return;

	const token = parseOutlineHeadingText(v.heading.trim());
	if (!token?.bracketed || token.title.trim() !== "") return;
	const resolved = resolveCalloutDef(host.registry, token.rawId);
	// Theme-owned: the heading is plain text to this plugin, so is the link.
	if (!shouldRenderToken(resolved)) return;
	const { def, unknown } = resolved;
	const name = (unknown || !def ? token.rawId : def.displayName).trim();
	// A name the alias cannot carry as written would rebuild the problem
	// (`]` before `]]`) or split the link; leave core's link alone then.
	if (!name || /\||\[\[|\]\]|\n/.test(name) || name.endsWith("]")) return;

	const ctx = context as { editor?: unknown; start?: unknown } | null;
	const editor = ctx?.editor as EditorLike | undefined;
	const start = ctx?.start as { line?: unknown; ch?: unknown } | undefined;
	if (
		!editor ||
		typeof editor.getLine !== "function" ||
		typeof editor.replaceRange !== "function" ||
		typeof start?.line !== "number" ||
		typeof start.ch !== "number"
	) {
		return;
	}
	const line = start.line;
	const lineText = editor.getLine(line);
	const ref = findWikilinkCalloutRefs(lineText).find(
		(r) => r.linkFrom === (start.ch as number) - 2,
	);
	if (!ref || ref.hasAlias || ref.hasTitle || ref.to !== ref.linkTo - 2) {
		return;
	}

	const at = { line, ch: ref.linkTo - 2 };
	const alias = `|${name}`;
	const caret = editor.getCursor();
	editor.replaceRange(alias, at);
	if (key === "Tab") {
		// Core's Tab selects an alias it inserted, ready to overtype.
		editor.setSelection(
			{ line, ch: at.ch + 1 },
			{ line, ch: at.ch + alias.length },
		);
	} else if (caret.line === line && caret.ch >= at.ch) {
		const ch = caret.ch + alias.length;
		editor.setSelection({ line, ch }, { line, ch });
	}
}
