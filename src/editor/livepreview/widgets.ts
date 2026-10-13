/**
 * editor/livepreview/widgets.ts — CodeMirror widget for `[!id]` tokens.
 *
 * CalloutTokenWidget serves the inline callout, the in-heading token, and the
 * in-link ref token; its DOM comes from the shared builder
 * (renderShared.buildCalloutTokenDom), so Live Preview and reading view
 * render identically. CalloutContentPillWidget replaces a whole content pill
 * (`[!id]{…}`), payload included, which is what makes that pill a single
 * indivisible element. HeadingRefLinkWidget replaces a whole title-less
 * reference link (`[[#[!id]]]`) with a link-styled icon + display name.
 * HeadingFoldArrowWidget is a separate end-of-line chevron for heading
 * callouts (when the core "Fold heading" setting is on) that trails the title
 * text and toggles Obsidian's native heading fold for the section.
 */
import { WidgetType } from "@codemirror/view";
import type { EditorView } from "@codemirror/view";
import { EditorSelection } from "@codemirror/state";
import { Component, Keymap, setIcon } from "obsidian";
import type { App } from "obsidian";
import type { CalloutRegistry } from "../../manager/CalloutRegistry";
import { contentPayloadStart, findWikilinkCalloutRefs } from "../calloutTokens";
import { calloutTokenLabel } from "../../utils/calloutId";
import { t } from "../../i18n";
import {
	CSS_ANIM_IN,
	CSS_CM_WIDGET,
	CSS_FOLD_ARROW,
	CSS_REF_LINK,
	CSS_REF_TOKEN_LINK,
	buildCalloutTokenDom,
	buildContentPillDom,
	isStartupEntranceActive,
	tokenIconKey,
	VARIANT_ROLE,
	resolveCalloutDef,
	type CalloutTokenVariant,
} from "../renderShared";
import { resolveMarkdownView } from "../headingFold";
import { renderPayloadInto } from "./contentPillRender";
import { toggleHeadingFold } from "./fold";
import { calloutStudioCaretDrop } from "./refresh";

export class CalloutTokenWidget extends WidgetType {
	/**
	 * Snapshot of everything that affects the rendered DOM, taken at build
	 * time. eq() compares snapshots so CodeMirror reuses the DOM while
	 * nothing visible changed, and swaps it after icon/name/registry edits
	 * (the refresh effect rebuilds decorations, producing new snapshots).
	 */
	private readonly renderKey: string;

	constructor(
		private readonly app: App,
		private readonly rawId: string,
		private readonly registry: CalloutRegistry,
		private readonly variant: CalloutTokenVariant,
		private readonly showName: boolean,
		/** Raw `|metadata` for this occurrence; "" when the token carried none. */
		private readonly metadata = "",
		/**
		 * Width of the token's source span (`[!…]`), `|metadata` included. Only
		 * the inline branch of toDOM reads it — a ref token is never followed by
		 * offset math — but it must be the real span, never `rawId.length + 3`:
		 * `rawId` is the type alone, so on `[!note|purple]` that would place the
		 * caret short by the metadata's width.
		 */
		private readonly sourceLen = rawId.length + 3,
	) {
		super();
		this.renderKey = this.computeRenderKey();
	}

	private computeRenderKey(): string {
		const { def, unknown } = resolveCalloutDef(this.registry, this.rawId);
		const iconKey = tokenIconKey(
			def,
			this.registry,
			VARIANT_ROLE[this.variant],
		);
		return [
			this.variant,
			this.showName ? "n" : "",
			this.rawId,
			// Two pills of the same type with different metadata render
			// different DOM, so they must not share a cached node.
			this.metadata,
			// And `sourceLen`, which no other field implies: `[!x]` and `[!x|]`
			// agree on rawId AND on metadata (both ""), so without this they
			// share a key, eq() reuses the widget, and the mousedown closure
			// keeps a span width one short of the token it now stands for —
			// putting the caret in the wrong place after a `|` is typed.
			String(this.sourceLen),
			unknown ? "u" : "",
			def?.id ?? "",
			// The label the name span draws, not `displayName`: an alias token
			// does not show the NAME, so only what it does show belongs here.
			calloutTokenLabel(unknown ? undefined : def, this.rawId),
			iconKey,
			// buildCalloutTokenDom stamps CSS_ANIM_IN from the startup-entrance
			// flag (see renderShared), and it reads it at build time — so a
			// widget built inside the entrance window would otherwise compare
			// equal to one built after it closed, and CodeMirror would keep the
			// old DOM with a stale animation class on it.
			this.variant !== "ref" && isStartupEntranceActive() ? "a" : "",
		].join("|");
	}

	override eq(other: CalloutTokenWidget): boolean {
		return other.renderKey === this.renderKey;
	}

	override toDOM(view: EditorView): HTMLElement {
		const el = buildCalloutTokenDom({
			rawId: this.rawId,
			metadata: this.metadata,
			registry: this.registry,
			variant: this.variant,
			showName: this.showName,
		});
		// This node is CodeMirror's from here on: it is rebuilt when the
		// decoration set changes and never touched by the icon sweep, which
		// reads this marker to know that (see CSS_CM_WIDGET).
		el.classList.add(CSS_CM_WIDGET);
		// LP ref tokens always sit inside a wikilink, so they carry the
		// click-to-navigate class (outline/popup tokens never do).
		if (this.variant === "ref") el.classList.add(CSS_REF_TOKEN_LINK);

		// Inline pills give no editing feedback on click. Left-clicking one
		// drops the caret just before the id's first char (right after `[!`),
		// which reveals the raw `[!id]` — the decoration is skipped while the
		// selection touches the token.
		if (this.variant === "inline") {
			el.addEventListener("mousedown", (evt) => {
				if (evt.button !== 0) return; // left click only; right-click → context menu
				const from = this.resolveFrom(view, el, evt);
				// Unplaceable: hand the click back to CodeMirror rather than
				// swallow it (see resolveFrom and ignoreEvent).
				if (from === null) return;
				evt.preventDefault(); // take over focus/selection ourselves
				dropCaret(view, from + 2);
			});
		}

		// Heading tokens: clicking the icon/name drops the caret at the start
		// of the callout id. Rather than offset math against the replaced
		// range, locate the `[!` on the line — exact, because the heading token
		// is always the first `[!` (HEADING_CALLOUT_RE anchors it right after
		// the hashes). The event is NOT stopped from bubbling:
		// Obsidian's livePreviewState must see the mousedown so the raw-syntax
		// reveal stays deferred to mouseup, in the same paint as the `#` marks.
		if (this.variant === "heading") {
			el.addEventListener("mousedown", (evt) => {
				if (evt.button !== 0) return; // left click only; right-click → context menu
				evt.preventDefault(); // take over focus/selection ourselves
				const pos = view.posAtDOM(el);
				const line = view.state.doc.lineAt(pos);
				const idx = line.text.indexOf("[!");
				if (idx === -1) return;
				view.dispatch({
					selection: EditorSelection.cursor(line.from + idx + 2),
				});
				view.focus();
			});
		}

		// Ref tokens (inside wikilinks): clicking the icon follows the link,
		// like clicking the link itself (editing stays available through the
		// title text around the icon, which reveals the raw link on click).
		// The target is re-derived from the live document at click time, from
		// whichever link holds the icon: posAtDOM may resolve to either edge
		// of a replaced token, and an aliased link's icon is not on its token
		// at all but in front of the alias. Stopped from bubbling: nothing may
		// move the caret, we fully take over the click.
		if (this.variant === "ref") {
			el.addEventListener("mousedown", (evt) => {
				if (evt.button !== 0) return; // left click only; right-click → context menu
				evt.preventDefault();
				evt.stopPropagation();
				const pos = view.posAtDOM(el);
				const line = view.state.doc.lineAt(pos);
				const rel = pos - line.from;
				const ref = findWikilinkCalloutRefs(line.text).find(
					(r) => rel > r.linkFrom && rel < r.linkTo,
				);
				if (!ref) return;
				const inner = line.text.slice(ref.linkFrom + 2, ref.linkTo - 2);
				const pipeIdx = inner.indexOf("|");
				const target =
					pipeIdx === -1 ? inner : inner.slice(0, pipeIdx);
				const mdView = resolveMarkdownView(this.app, view);
				void this.app.workspace.openLinkText(
					target,
					mdView?.file?.path ?? "",
					Keymap.isModEvent(evt),
				);
			});
		}
		return el;
	}

	/**
	 * Document offset of this token's `[`, or null when no reading of the DOM
	 * can be trusted.
	 *
	 * `posAtDOM` reports EITHER edge of a replaced range, so the two readings
	 * have to be told apart by what the document actually holds there — and the
	 * answer can also be neither. Obsidian's fork of `posFromDOM` does not throw
	 * for a node it cannot place in its tile tree (upstream CodeMirror does): it
	 * quietly returns 0 or the document length. Subtracting `sourceLen` from
	 * that used to hand `EditorSelection.cursor()` a negative offset, which
	 * throws INSIDE this listener — so the click did nothing at all, while
	 * arrow keys still revealed the pill because they never come this way.
	 *
	 * Hence: test every candidate against the text, and fall back to the point
	 * that was actually clicked before giving up.
	 */
	private resolveFrom(
		view: EditorView,
		el: HTMLElement,
		evt: MouseEvent,
	): number | null {
		const doc = view.state.doc;
		const candidates: number[] = [];
		try {
			const pos = view.posAtDOM(el);
			candidates.push(pos, pos - this.sourceLen);
		} catch {
			// Nothing to add; the coordinate reading below may still answer.
		}
		const at = view.posAtCoords({ x: evt.clientX, y: evt.clientY });
		if (at !== null) candidates.push(at, at - this.sourceLen);
		for (const from of candidates) {
			if (from < 0 || from + this.sourceLen > doc.length) continue;
			if (doc.sliceString(from, from + 2) === "[!") return from;
		}
		return null;
	}

	override ignoreEvent(event: Event): boolean {
		// The editor never handles events on the token; right-clicks reach
		// the document-level context-menu listener regardless — and must keep
		// reaching it with the pill still under the pointer, which is why a
		// non-left press stays ignored rather than moving the caret (that would
		// re-render the line and pull the pill out from under the menu).
		//
		// The left press is CodeMirror's FALLBACK. Our listener normally takes
		// it and calls preventDefault, which stops core dead (`handleEvent`
		// bails on a prevented event), so this only engages when the listener
		// could not place the click — and then CodeMirror's own handling puts
		// the caret at the widget's edge, which `selectionTouches` counts as a
		// touch, so the pill opens for editing anyway.
		return event.type !== "mousedown" || (event as MouseEvent).button !== 0;
	}
}

/**
 * Put the caret at `pos` on behalf of a clicked pill, and open that pill.
 *
 * Two details, both of which the pill's reveal depends on and neither of which
 * is obvious from the call site:
 *
 * - **Focus first.** The reveal predicate is "the editor is focused AND the
 *   selection touches the token" (`selectionTouches` in calloutViewPlugin), and
 *   it reads `view.hasFocus` off the update this dispatch produces. Focusing
 *   afterwards means that update sees an unfocused editor, so a click into an
 *   editor that did not already have focus would move the caret and leave the
 *   pill shut. `focus()` dispatches nothing itself — it re-applies the current
 *   selection to the DOM — so nothing is racing the dispatch below.
 * - **Tagged as ours**, which opts it out of the reveal freeze; see
 *   `calloutStudioCaretDrop`.
 *
 * Deliberately not used by the heading token or the ref link: both reveal
 * markup CORE also owns (the `###` marks, the `[[…]]` brackets), and core
 * reveals its half on mouse release. Opening ours a beat earlier is the
 * two-stage flash the freeze was added to prevent.
 */
function dropCaret(view: EditorView, pos: number): void {
	view.focus();
	view.dispatch({
		selection: EditorSelection.cursor(pos),
		effects: calloutStudioCaretDrop.of(null),
	});
}

/**
 * The two spellings of "which text position is under this point", behind one
 * name — declared locally on purpose.
 *
 * `caretPositionFromPoint` is the standard, and it only reached Safari in 17.4;
 * `caretRangeFromPoint` is the older WebKit spelling every engine still answers,
 * and it is formally deprecated. This plugin is not desktop-only, so it needs
 * both: the standard where it exists, the old one everywhere else. Typing them
 * here rather than reaching for the lib.dom declarations is what keeps the
 * deprecated half from being a lint suppression.
 */
interface CaretPointDocument {
	caretPositionFromPoint?: (
		x: number,
		y: number,
	) => { offsetNode: Node; offset: number } | null;
	caretRangeFromPoint?: (x: number, y: number) => Range | null;
}

/** The text position under a viewport point, or null when there is none. */
function caretFromPoint(
	doc: Document,
	x: number,
	y: number,
): { node: Node; offset: number } | null {
	const api = doc as unknown as CaretPointDocument;
	const position = api.caretPositionFromPoint?.(x, y);
	if (position) return { node: position.offsetNode, offset: position.offset };
	const range = api.caretRangeFromPoint?.(x, y);
	return range ? { node: range.startContainer, offset: range.startOffset } : null;
}

/**
 * A whole content pill (`[!warning]{be careful}`) in Live Preview: the token,
 * the braces and the payload, all replaced by one widget.
 *
 * It is one widget rather than a mark around live document text, and that is the
 * entire point. A mark's box is only a single DOM element for as long as
 * CodeMirror never has to split it around someone else's decoration — and inside
 * a pill it always does, because Obsidian decorates the payload's own markdown
 * (`**bold**`, backticks, links) from its own decoration set and styles inline
 * code as a chip with its own background and rounded caps. Two rounds of
 * precedence tuning did not make that reliable. A replace decoration ends the
 * question: `SpanCursor.next` skips every decoration that ends inside a replaced
 * range, so nothing foreign can reach in and the pill is indivisible by
 * construction.
 *
 * The payload is rendered here instead (contentPillRender.ts), which is also
 * what keeps this identical to reading view, where the pill is built by moving
 * Obsidian's already-rendered nodes.
 *
 * The trade is that the payload is not editable in place — clicking reveals the
 * raw `[!id]{…}` and edits happen there, exactly as a plain pill has always
 * behaved.
 */
export class CalloutContentPillWidget extends WidgetType {
	/** Snapshot for eq(); same strategy as CalloutTokenWidget.renderKey. */
	private readonly renderKey: string;
	/** Owns whatever the payload render registers; unloaded in destroy(). */
	private component: Component | null = null;

	constructor(
		private readonly app: App,
		private readonly rawId: string,
		/** Raw `|metadata` for this occurrence; "" when the token carried none. */
		private readonly metadata: string,
		private readonly registry: CalloutRegistry,
		/** Payload source, braces excluded — the markdown to render. */
		private readonly payload: string,
		/** Owning file, for link/embed resolution inside the payload. */
		private readonly sourcePath: string,
		/**
		 * Width of the whole replaced span (`[!…]{…}`), so the click handler can
		 * find the `[` from either edge of the replaced range. Must be the real
		 * span: neither `rawId` nor `payload` implies it on their own.
		 */
		private readonly sourceLen: number,
	) {
		super();
		const { def, unknown } = resolveCalloutDef(registry, rawId);
		const iconKey = tokenIconKey(def, registry, "inline");
		this.renderKey = [
			this.rawId,
			this.metadata,
			// The payload is rendered content, so it belongs in the key: without
			// it, editing the text inside the braces would leave CodeMirror
			// reusing a widget that still shows the old words.
			this.payload,
			// And the path, because the same payload resolves its links
			// differently in a different note.
			this.sourcePath,
			String(this.sourceLen),
			unknown ? "u" : "",
			def?.id ?? "",
			iconKey,
			isStartupEntranceActive() ? "a" : "",
		].join("|");
	}

	override eq(other: CalloutContentPillWidget): boolean {
		return other.renderKey === this.renderKey;
	}

	override toDOM(view: EditorView): HTMLElement {
		const { root: el, payload } = buildContentPillDom({
			rawId: this.rawId,
			metadata: this.metadata,
			registry: this.registry,
		});
		// CodeMirror's DOM from here on — keeps the CSSInjector icon sweep off it
		// (see CSS_CM_WIDGET); CM rebuilds it on the refresh effect instead.
		el.classList.add(CSS_CM_WIDGET);
		// Obsidian styles rendered inline markup through a `.markdown-rendered`
		// ANCESTOR (`.markdown-rendered code`, `… a`, `… mark`, app.css) — which
		// reading view has and a CodeMirror widget does not. Without this the
		// same payload would come out unstyled here and styled there. The class
		// is the one this plugin's other MarkdownRenderer hosts already use
		// (GlobalStyleModal's gap demo, LiveCalloutPreview's fallback), and the
		// unwrap guard keeps block content out, so only inline rules can apply.
		el.classList.add("markdown-rendered");

		// A widget can be re-rendered without an intervening destroy(); never
		// leave the previous render's registrations behind.
		this.component?.unload();
		const component = new Component();
		component.load();
		this.component = component;
		renderPayloadInto(
			this.app,
			payload,
			this.payload,
			this.sourcePath,
			component,
		);

		// Clicking reveals the raw `[!id]{…}` for editing (the decoration is
		// skipped while the selection touches the pill) and puts the caret on
		// the character that was clicked — see clickOffset.
		el.addEventListener("mousedown", (evt) => {
			if (evt.button !== 0) return; // left click only; right-click → context menu
			// A link in the payload is a real link: let Obsidian's own handler
			// have the click rather than swallowing it to move the caret. The
			// right-click path is guarded the same way (contextmenu/resolve.ts).
			//
			// Narrowed by nodeType rather than `instanceof Element`: in a pop-out
			// window the nodes come from that window's constructors, so an
			// instanceof against this one's silently answers false and the guard
			// would quietly stop working there.
			const node = evt.target as Node | null;
			const target =
				node?.nodeType === Node.ELEMENT_NODE
					? (node as Element)
					: (node?.parentElement ?? null);
			if (target?.closest("a")) return;
			// Both measurements are taken before the caret moves: clickOffset
			// hit-tests the rendered payload, which this dispatch replaces with
			// the raw source.
			const from = this.resolveFrom(view, el, evt);
			// Unplaceable: hand the click back to CodeMirror rather than
			// swallow it (see resolveFrom and ignoreEvent).
			if (from === null) return;
			evt.preventDefault(); // take over focus/selection ourselves
			const offset = this.clickOffset(payload, evt);
			dropCaret(view, this.payloadStart(from) + offset);
		});
		return el;
	}

	/** Document offset of the payload's first character (see the shared formula). */
	private payloadStart(from: number): number {
		return contentPayloadStart(from, this.sourceLen, this.payload.length);
	}

	/**
	 * Document offset of this pill's `[`, or null when no reading of the DOM
	 * can be trusted (same contract, and the same Obsidian-fork hazard, as
	 * CalloutTokenWidget.resolveFrom — a `posFromDOM` that answers 0 instead of
	 * throwing used to turn into a negative caret offset and an exception).
	 *
	 * `posAtDOM` may report either edge of a replaced range, so the answer has
	 * to be checked. Checking for a leading `[!` is not enough: two pills
	 * written back to back (`[!warning]{a}[!warning]{b}`) put a `[!` right after
	 * the first one, so an end-edge resolution reads as a start and the caret
	 * lands in the neighbouring pill. The payload is what actually identifies
	 * THIS pill, so that is what gets tested.
	 */
	private resolveFrom(
		view: EditorView,
		el: HTMLElement,
		evt: MouseEvent,
	): number | null {
		const doc = view.state.doc;
		const candidates: number[] = [];
		try {
			const pos = view.posAtDOM(el);
			candidates.push(pos, pos - this.sourceLen);
		} catch {
			// Nothing to add; the coordinate reading below may still answer.
		}
		const at = view.posAtCoords({ x: evt.clientX, y: evt.clientY });
		if (at !== null) candidates.push(at, at - this.sourceLen);
		for (const from of candidates) {
			if (from < 0 || from + this.sourceLen > doc.length) continue;
			const start = this.payloadStart(from);
			if (
				doc.sliceString(start, start + this.payload.length) ===
				this.payload
			) {
				return from;
			}
		}
		return null;
	}

	/**
	 * How many characters into the payload the click landed.
	 *
	 * Answerable exactly only while the rendered payload is character-for-
	 * character its source — which is to say, while the payload holds no
	 * markdown. `**bold**` renders four characters shorter than it is written,
	 * and recovering that mapping would mean diffing source against rendered
	 * text on every click; the payload's start is the honest answer there, and
	 * still far better than the old "caret after `[!`". A click on the icon
	 * lands here as 0 for the same reason — it is not a text position at all.
	 *
	 * Everything is inside one try: a click that resolves to a node outside the
	 * widget (the pill's own padding, a hit-test near its edge) can then only
	 * ever degrade to the payload start.
	 *
	 * `host` is the payload element, so the icon is out of the picture from the
	 * start — measuring from it rather than from "after the pill's first child"
	 * is also what keeps this right for a callout that hides its icon, whose
	 * lead is still the first child and still empty.
	 */
	private clickOffset(host: HTMLElement, evt: MouseEvent): number {
		const doc = host.ownerDocument;
		try {
			if ((host.textContent ?? "") !== this.payload) return 0;

			const caret = caretFromPoint(doc, evt.clientX, evt.clientY);
			if (!caret) return 0;
			const upto = doc.createRange();
			upto.selectNodeContents(host);
			// An end BEFORE the start collapses the range, so a click on the
			// icon measures as an empty string rather than throwing.
			upto.setEnd(caret.node, caret.offset);
			return Math.min(upto.toString().length, this.payload.length);
		} catch {
			return 0;
		}
	}

	override destroy(): void {
		this.component?.unload();
		this.component = null;
	}

	override ignoreEvent(event: Event): boolean {
		// CodeMirror never handles events on the widget — they still reach the
		// document, which is where Obsidian's link handling lives — with one
		// exception: the left press, which is left to CodeMirror as the
		// caret-placing fallback when our own listener cannot place the click.
		// Same reasoning as CalloutTokenWidget.ignoreEvent.
		return event.type !== "mousedown" || (event as MouseEvent).button !== 0;
	}
}

/**
 * Whole-link replacement for a title-less heading-callout reference
 * (`[[#[!id]]]`) or for a bare-token alias (`[[#[!id]|[!id]]]`, the shape
 * TOC plugins generate). Obsidian's own parsers mishandle the trailing `]]]`
 * run (both the CM6 tokenizer and the reading parser cut the link at the
 * FIRST `]]`), so decorating just the token inside the link is not enough —
 * the entire link is replaced with this widget: prefix (`Note#`; a same-file
 * `#` is dropped, and an alias token has none), the callout's icon, and its
 * display name, styled like an internal link. Reading view produces the same
 * display via transformHeadingRefLinks.
 */
export class HeadingRefLinkWidget extends WidgetType {
	/** Snapshot for eq(); same strategy as CalloutTokenWidget.renderKey. */
	private readonly renderKey: string;

	constructor(
		private readonly app: App,
		private readonly rawId: string,
		private readonly registry: CalloutRegistry,
		/** Displayed link text before the token (`Note#`, …; "" when the
		 * raw prefix was a bare same-file `#`, which is hidden). */
		private readonly prefix: string,
		/** Full untruncated link target, for mod-click navigation. */
		private readonly target: string,
		private readonly showIcon: boolean,
	) {
		super();
		const { def, unknown } = resolveCalloutDef(registry, rawId);
		// A reference token is a compact copy of the inline callout, so it draws
		// from the same artwork.
		const iconKey = tokenIconKey(def, registry, "inline");
		this.renderKey = [
			this.prefix,
			this.target,
			this.showIcon ? "i" : "",
			this.rawId,
			unknown ? "u" : "",
			def?.id ?? "",
			calloutTokenLabel(unknown ? undefined : def, this.rawId),
			iconKey,
		].join("|");
	}

	override eq(other: HeadingRefLinkWidget): boolean {
		return other.renderKey === this.renderKey;
	}

	override toDOM(view: EditorView): HTMLElement {
		const doc = view.dom.ownerDocument;
		const { def, unknown } = resolveCalloutDef(this.registry, this.rawId);
		const el = createSpan();
		el.className = CSS_REF_LINK;
		el.appendChild(doc.createTextNode(this.prefix));
		if (this.showIcon && def) {
			const iconEl = buildCalloutTokenDom({
				rawId: this.rawId,
				registry: this.registry,
				variant: "ref",
				showName: false,
			});
			iconEl.classList.add(CSS_CM_WIDGET);
			iconEl.classList.add(CSS_REF_TOKEN_LINK);
			// The icon is the click-to-navigate surface (the name text keeps
			// the caret-drop editing behavior of the widget handler below).
			iconEl.addEventListener("mousedown", (evt) => {
				if (evt.button !== 0) return; // left click only; right-click → context menu
				evt.preventDefault();
				evt.stopPropagation();
				this.follow(view, evt);
			});
			el.appendChild(iconEl);
		}
		// The name is plain text inside the link-styled span (not a
		// cs-callout-name), mirroring reading view where it is ordinary
		// anchor text — link color, native underline.
		el.appendChild(
			doc.createTextNode(
				calloutTokenLabel(unknown ? undefined : def, this.rawId),
			),
		);

		el.addEventListener("mousedown", (evt) => {
			if (evt.button !== 0) return; // left click only; right-click → context menu
			evt.preventDefault(); // take over focus/selection ourselves
			// Mod-click follows the link like a native internal link.
			if (evt.metaKey || evt.ctrlKey) {
				evt.stopPropagation();
				this.follow(view, evt);
				return;
			}
			// Plain click: caret into the id, which reveals the whole raw
			// link (the decoration is skipped while the selection touches
			// it). posAtDOM may resolve to either edge of the replaced
			// range; the widget starts at `[[`, so a position on `[[` means
			// the start edge (search forward), anything else the end edge
			// (search backward). Not stopped from bubbling: livePreviewState
			// must see the mousedown so the reveal defers to mouseup.
			const pos = view.posAtDOM(el);
			const line = view.state.doc.lineAt(pos);
			const rel = pos - line.from;
			const idx = line.text.startsWith("[[", rel)
				? line.text.indexOf("[!", rel)
				: line.text.lastIndexOf("[!", rel);
			if (idx === -1) return;
			view.dispatch({
				selection: EditorSelection.cursor(line.from + idx + 2),
			});
			view.focus();
		});
		return el;
	}

	/**
	 * Follow the reference using the untruncated target (Obsidian's own parse
	 * of the `]]]` run cuts the subpath short, so native navigation is broken
	 * here). Mod held opens a new tab, like a native link.
	 */
	private follow(view: EditorView, evt: MouseEvent): void {
		const mdView = resolveMarkdownView(this.app, view);
		void this.app.workspace.openLinkText(
			this.target,
			mdView?.file?.path ?? "",
			Keymap.isModEvent(evt),
		);
	}

	override ignoreEvent(): boolean {
		// Same contract as CalloutTokenWidget: the editor never handles
		// events on the widget; our own listener does.
		return true;
	}
}

/**
 * Standalone fold chevron for a heading callout, rendered as an end-of-line
 * widget so it trails the whole heading (icon + name/title) — mirroring a
 * block callout's disclosure arrow, which follows the label. Built only when
 * the core "Fold heading" setting is on; clicking it folds the same section
 * Obsidian's native pre-heading arrow folds.
 */
export class HeadingFoldArrowWidget extends WidgetType {
	/**
	 * The two build-time globals toDOM also reads, snapshotted here rather than
	 * consulted from eq(). eq() must be pure and cheap, and comparing against a
	 * live global is worse than not comparing at all: two widgets built at
	 * different times would read the same value and match, while a widget would
	 * stop matching itself once the global moved.
	 */
	private readonly entrance = isStartupEntranceActive();
	private readonly label = t("heading.toggleFold");

	constructor(
		/** Normalized callout id — part of eq() so id edits refresh the arrow. */
		private readonly rawId: string,
		/** Current fold state — rotates the chevron. */
		private readonly folded: boolean,
	) {
		super();
	}

	override eq(other: HeadingFoldArrowWidget): boolean {
		return (
			this.folded === other.folded &&
			this.rawId === other.rawId &&
			this.entrance === other.entrance &&
			this.label === other.label
		);
	}

	override toDOM(view: EditorView): HTMLElement {
		const arrow = createSpan();
		arrow.className = CSS_FOLD_ARROW;
		if (this.folded) arrow.classList.add("cs-collapsed");
		// Fade the chevron in during the startup entrance window (trails the
		// bar and token — see the staggered delays in styles.css).
		if (this.entrance) arrow.classList.add(CSS_ANIM_IN);
		setIcon(arrow, "chevron-down");
		arrow.setAttribute("aria-label", this.label);
		// mousedown takes the event over so the caret never lands on the line
		// (which would reveal the raw heading syntax) — but it does NOT fold.
		// click does, exactly as Obsidian's own pre-heading `cm-fold-indicator`
		// splits the two.
		//
		// The split is what keeps a tap on a phone from folding and instantly
		// unfolding again. WebKit synthesises mousedown → mouseup → click from
		// one tap and re-hit-tests in between; folding from mousedown rebuilds
		// the DOM under the still-moving finger — this chevron is replaced (its
		// eq() flips on `folded`) and CodeMirror drops the fold placeholder in
		// right beside it. That placeholder is a live, visible `…` whose own
		// onclick UNFOLDS (core ships codeFolding() unconfigured, and its CSS
		// paints the default widget in --text-faint), and it lands inside the
		// generous mobile tap target below this chevron. Folding on click
		// instead means nothing moves until the whole gesture is over.
		arrow.addEventListener("mousedown", (evt) => {
			if (evt.button !== 0) return; // left click only
			evt.preventDefault();
			evt.stopPropagation();
		});
		arrow.addEventListener("click", (evt) => {
			if (evt.button !== 0) return; // left click only
			evt.preventDefault();
			evt.stopPropagation();
			this.toggleFold(view, arrow);
		});
		return arrow;
	}

	/**
	 * Toggle the fold of the heading section this arrow trails. No refresh
	 * effect follows: the ViewPlugin already rebuilds on the fold transaction
	 * itself (foldsChanged, see calloutViewPlugin's `foldChanged` trigger), so
	 * dispatching one bought a second transaction per tap whose only real work
	 * was making headingGapField re-scan the WHOLE document and swap its entire
	 * block-widget set — a second height-map/measure pass one frame after the
	 * fold's own, which is what nudged the view on every toggle. The settings
	 * preview is covered too: `toggleHeadingFold` appends the fold field and
	 * re-dispatches there, and foldedRanges() answers with the RangeSet.empty
	 * singleton while the field is missing, so the identity check still moves.
	 */
	private toggleFold(view: EditorView, el: HTMLElement): void {
		// posAtDOM throws for a node outside the editor, and the chevron can be
		// gone by the time the click lands: a caret that reached the heading
		// line first (on a phone the tap moves it before the synthetic mouse
		// events run) reveals the raw syntax, and the chevron is only built
		// while the token is collapsed. Nothing to toggle then.
		if (!el.isConnected) return;
		let pos: number;
		try {
			pos = view.posAtDOM(el);
		} catch {
			return;
		}
		const headingLine = view.state.doc.lineAt(pos).number - 1; // 0-based
		// Touch hit-testing can resolve the trailing widget to a neighboring
		// line; only fold when the resolved line really is an ATX heading.
		if (!/^#{1,6}\s/.test(view.state.doc.line(headingLine + 1).text)) {
			return;
		}
		toggleHeadingFold(view, headingLine);
	}

	override ignoreEvent(): boolean {
		return true;
	}
}
