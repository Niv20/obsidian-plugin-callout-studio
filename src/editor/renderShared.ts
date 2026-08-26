/**
 * editor/renderShared.ts — Shared DOM builders for heading/inline callouts.
 *
 * The Live Preview widgets (editor/livepreview/) and the reading-view
 * post-processor (reading/) both render the same token DOM through
 * buildCalloutTokenDom, so the two surfaces stay visually identical and the
 * CSSInjector icon sweep can repaint both with one selector.
 *
 * Icons are always baked into the DOM as visible inline SVG / text colored
 * via CSS `currentColor` (no ::after masks), which makes them survive PDF
 * export with zero extra machinery.
 */
import type { CalloutDefinition, CalloutRenderRole } from "../types";
import type { CalloutRegistry } from "../manager/CalloutRegistry";
import { normalizeCalloutId } from "../utils/calloutId";

/** Class names shared between Live Preview widgets and reading-view DOM. */
export const CSS_INLINE_TOKEN = "cs-inline-callout";
export const CSS_HEADING_LINE = "cs-heading-callout";
/**
 * Live Preview only: added to the bar for exactly as long as the `[!id]` token
 * is collapsed behind its widget, so the CSS rule that hides the ATX `###` runs
 * off the SAME predicate the widget does.
 *
 * Obsidian hides the hashes with a replace decoration of its own, on its own
 * rebuild schedule — one that skips entirely while the mouse is held (on mobile
 * that is a 700ms window after EVERY caret move), while an IME is composing,
 * and while the syntax tree sits behind the viewport. This plugin's rebuilds
 * have no such skips, so the two pipelines can disagree for a frame or longer
 * and the raw `###` surfaces in front of a fully rendered bar. Owning the
 * hashes here makes that disagreement unreachable.
 */
export const CSS_HEADING_HIDE_MARKS = "cs-heading-hide-marks";
export const CSS_HEADING_TOKEN = "cs-heading-token";
/**
 * The heading's own title text (everything after the `[!id]` token), wrapped
 * so it has an inline box that hugs the words. The heading callout itself is a
 * full-width block, so a gradient title sweep declared on the bar would only
 * ever show its opening slice through the text; declared on this span, the
 * sweep starts on the first letter and finishes on the last one. Both render
 * surfaces produce it: reading view wraps the trailing nodes, Live Preview
 * marks the title range.
 */
export const CSS_HEADING_TITLE = "cs-heading-title";
/**
 * Reading view only, and only when the source really had a separating space
 * after `]`: reading view consumes that space while stripping the token prefix,
 * so the gap has to come back as a margin. `## [!id]-title` has no space to
 * consume — its title starts at the bracket — and must stay glued to the icon,
 * exactly as Live Preview renders it.
 */
export const CSS_HEADING_TITLE_GAP = "cs-heading-title-gap";
export const CSS_TOKEN_ICON = "cs-callout-icon";
export const CSS_TOKEN_NAME = "cs-callout-name";
/**
 * A token that ended up with nothing to draw: a callout set to `hideIcon` whose
 * variant also shows no name (the ref token, and the content pill's lead, which
 * is nothing but an icon). The span still has to exist — callers insert it at a
 * known position and the accent rules key on `[data-callout]` — but as a flex
 * item it would still claim the container's `gap`, which reads as a stray space
 * before the text it precedes, so the class takes it out of flow outright.
 */
export const CSS_TOKEN_EMPTY = "cs-token-empty";
export const CSS_UNKNOWN = "cs-unknown";
/**
 * Modifier on an inline pill carrying `{…}` content (`[!warning]{be careful}`).
 * The root keeps CSS_INLINE_TOKEN so every per-callout accent, background and
 * gradient CSSInjector emits for `.cs-inline-callout[data-callout]` still lands,
 * and so the context menu keeps resolving it.
 *
 * The two pills are the SAME box — one inline-flex badge, the payload standing
 * where the plain pill's display name stands — so this modifier is down to the
 * two things a payload needs and a one-word name does not: a width ceiling, and
 * permission to wrap inside (see styles.css).
 */
export const CSS_INLINE_HAS_CONTENT = "cs-inline-has-content";
/**
 * The icon opening a content pill — it stands in for the `[!id]{` the user
 * typed. Its own element rather than a bare icon span because Live Preview
 * builds it as a CodeMirror widget while reading view builds it inline, and one
 * class keeps both looking the same.
 *
 * It carries no background and no corner radius: those belong to the pill box,
 * which is a single unbroken element on both surfaces. Reading view builds that
 * element directly; Live Preview replaces the whole `[!id]{…}` with one widget
 * holding this same DOM, so nothing foreign can get inside it there either.
 */
export const CSS_CALLOUT_LEAD = "cs-callout-lead";
/**
 * Everything inside a content pill's braces, in one element.
 *
 * **This wrapper is load-bearing and must never be removed.** The pill is a flex
 * container, and CSS Flexbox §4 wraps each contiguous run of child text in its
 * OWN anonymous flex item — so appending the payload's nodes to the pill root
 * would turn `text with **bold**` into three items, each taking the container's
 * `gap`. That is precisely the "the pill looks split into pieces" bug, arriving
 * by a new route. With the wrapper the pill is permanently two items, lead and
 * payload, whatever markdown the payload holds, and the formatting inside it is
 * back in an ordinary inline formatting context where flex never sees it.
 */
export const CSS_CALLOUT_PAYLOAD = "cs-callout-payload";
/**
 * The fold chevron trailing a heading callout in Live Preview. Reading view
 * uses Obsidian's own `.heading-collapse-indicator` instead, so both surfaces
 * are tinted together (see CSSInjector's fold-arrow rules).
 */
export const CSS_FOLD_ARROW = "cs-fold-arrow";
/**
 * Token shown where a heading callout is REFERENCED: Outline-pane items,
 * rendered internal links (incl. TOC plugins), and the link suggestion popup.
 */
export const CSS_REF_TOKEN = "cs-ref-token";
/**
 * Extra class on a ref token that sits inside a rendered internal link —
 * marks the icon as a click-to-navigate surface (pointer cursor).
 * Outline/popup tokens never carry it.
 */
export const CSS_REF_TOKEN_LINK = "cs-ref-token-link";
/**
 * Live Preview widget replacing a whole title-less reference link
 * (`[[#[!id]]]`) — styled like an internal link (color + underline).
 */
export const CSS_REF_LINK = "cs-ref-link";

/**
 * Class stamped on freshly built inline callouts / heading tokens / reading-view
 * heading callouts / fold chevrons while the startup entrance window is open,
 * so
 * they animate in (see styles.css). Never stamped once the window has closed —
 * ordinary file opens, scrolling and typing must not animate.
 */
export const CSS_ANIM_IN = "cs-anim-in";

/**
 * Marker on token DOM built inside a CodeMirror widget (see widgets.ts). Not a
 * style hook — it exists so the CSSInjector icon sweep can tell the DOM
 * CodeMirror OWNS from the byte-identical DOM the reading post-processor
 * produces, which it must repaint.
 *
 * The sweep used to tell them apart by where they sat: skip anything under
 * `.cm-content`. That is wrong for a `![[note]]` transclusion, whose rendered
 * content lives under the editor's own `.cm-content` and is repainted by
 * nothing else. Narrowing the test to Obsidian's embed classes only moves the
 * guess — those are undocumented internals, and the editable table/canvas
 * editors nest a real `.cm-content` *inside* rendered containers, so both
 * directions of the ancestry test have a counter-example. Only the builder
 * knows for sure, so the builder says so.
 */
export const CSS_CM_WIDGET = "cs-cm-widget";

/**
 * Startup entrance state. When the plugin loads while the UI is already
 * visible (mobile FOUC, or a desktop enable/reload where a note is on screen),
 * the callout DOM transforms arrive AFTER the raw text was painted, so we let
 * them animate in gently instead of snapping. The window is time-boxed; once
 * it closes, rendering is instantaneous again.
 */
let startupEntranceActive = false;

/** True while the startup entrance window is open (see beginStartupEntranceWindow). */
export function isStartupEntranceActive(): boolean {
	return startupEntranceActive;
}

/**
 * Open the startup entrance window: tag `<body>` with `cs-anim-window` (arms
 * the Live Preview heading-bar transition, which needs a class on an ancestor
 * because the bar element already exists) and flip the module flag so newly
 * built token/bar/chevron DOM gets `cs-anim-in`. Returns a cleanup that closes
 * the window; call it from both the auto-close timeout and plugin unload.
 * Idempotent-safe: cleanup only clears state it set.
 */
export function beginStartupEntranceWindow(doc: Document): () => void {
	startupEntranceActive = true;
	doc.body?.classList.add("cs-anim-window");
	let closed = false;
	return () => {
		if (closed) return;
		closed = true;
		startupEntranceActive = false;
		doc.body?.classList.remove("cs-anim-window");
	};
}

export interface ResolvedCalloutDef {
	/** Definition to render with (fallback def when the id is unrecognized). */
	def: CalloutDefinition | undefined;
	/** True when the id matched neither a definition nor an alias. */
	unknown: boolean;
	/**
	 * True when the user has handed this callout to their own CSS — render
	 * nothing at all for it (see {@link shouldRenderToken}). Read off
	 * `externalStyle`, not `standsDown`: the two suppress the same DOM here but
	 * are different facts, and a row can be one without being the other.
	 *
	 * Deliberately separate from `unknown`, which stays false: an unknown token
	 * gets `.cs-unknown` styling and keeps the raw id as its label — both of
	 * which are still this plugin painting something.
	 */
	external: boolean;
	/** True when the active theme owns this callout. See {@link shouldRenderToken}. */
	themeOwned: boolean;
}

/**
 * Whether the heading-callout / inline-callout / ref-token DOM should be built
 * for a resolved token at all.
 *
 * These three surfaces are Callout Studio's own invented syntax, and neither
 * kind of stand-down gets them. **The user's own CSS** (`external`): there is
 * nothing here for them to style. **The theme** (`themeOwned`): a theme callout
 * is Block only. The plugin could paint `.cs-heading-token` — no theme selector
 * can match it, and an earlier version did — but that offers two formats the
 * theme has no design for beside a Block callout it draws itself, three
 * renderings of one callout with two invented. Literal text is the honest
 * answer, and it makes "nothing is emitted for a theme callout" literal.
 *
 * A pre-existing callout that becomes theme-owned loses the two formats for as
 * long as the theme claims it, then gets them back with no migration.
 *
 * Every consumer of {@link resolveCalloutDef} that builds DOM calls this first.
 */
export function shouldRenderToken(resolved: ResolvedCalloutDef): boolean {
	return !resolved.external && !resolved.themeOwned;
}

/**
 * Resolve a raw `[!id]` token id to a definition: direct id → alias →
 * `data-callout` attribute form → the configured fallback callout. Mirrors
 * CSSInjector.resolveDef so DOM icons and CSS colors always agree.
 *
 * The attribute-form step is what keeps the three roles consistent: a
 *   block callout `> [!a-b]` already picks up `a b`'s styling, because Obsidian
 * renders both spellings as `data-callout="a-b"` and the generated CSS
 *   selectors are built from that form. Heading callouts and inline callouts carry our
 * own space-preserving id, so without this step the same spelling would render
 * here as an unknown callout.
 */
export function resolveCalloutDef(
	registry: CalloutRegistry,
	rawId: string,
): ResolvedCalloutDef {
	const id = normalizeCalloutId(rawId);
	const direct =
		registry.get(id) ?? registry.findByAlias(id) ?? registry.findByAttrId(id);
	if (direct)
		return {
			def: direct,
			unknown: false,
			external: direct.externalStyle === true,
			themeOwned: registry.themeOwns(direct),
		};
	// An unrecognized id is NOT external even when the fallback callout it
	// borrows happens to be: `external` describes the token's own callout.
	return {
		def: registry.get(registry.settings.fallbackCalloutId),
		unknown: true,
		external: false,
		themeOwned: false,
	};
}

/**
 * The id our OWN DOM stamps into `data-callout` (heading callouts, inline callouts,
 * ref tokens) for a raw token id.
 *
 * Per-callout CSS is emitted for a definition's own id and for each of its
 * aliases, in those exact spellings, so the attribute has to carry one of them.
 * A token that resolved only through its attribute form — `[!a-b]` written for
 * the callout `a b`, which Obsidian renders identically — matches none of those
 * selectors, so it is stamped with the definition's id instead. Without this it
 * renders with its icon painted but no colour: the icon comes from JS, which
 * resolves the definition, while the colour comes from CSS, which does not.
 * The block callout has never had the problem — its selector is built from
 * the attribute form to begin with.
 *
 * Unknown tokens keep the raw spelling, which is what `.cs-unknown` styling and
 * the raw-id label expect.
 */
export function calloutDomId(
	rawId: string,
	resolved: ResolvedCalloutDef,
): string {
	const id = normalizeCalloutId(rawId);
	const { def, unknown } = resolved;
	if (!def || unknown) return id;
	if (id === def.id || def.aliases?.includes(id)) return id;
	return def.id;
}

/**
 * The two role-icon helpers live in `./roleIcon.ts` — they are the one place
 * that has to know a theme-owned callout wears the theme's own artwork, and
 * that belongs beside the theme icon renderer rather than in the middle of the
 * token DOM builder. Re-exported because eight consumers already import them
 * from here, and one import point for the token surfaces is worth keeping.
 */
export { paintRoleIcon, tokenIconKey } from "./roleIcon";
import { paintRoleIcon } from "./roleIcon";

/** Where a callout token DOM is rendered — decides its root class. */
export type CalloutTokenVariant = "inline" | "heading" | "ref";

const VARIANT_CLASS: Record<CalloutTokenVariant, string> = {
	inline: CSS_INLINE_TOKEN,
	heading: CSS_HEADING_TOKEN,
	ref: CSS_REF_TOKEN,
};

/**
 * Render role a token variant draws at. A reference token is a compact copy of
 * the inline callout — same size, so same artwork.
 */
export const VARIANT_ROLE: Record<CalloutTokenVariant, CalloutRenderRole> = {
	inline: "inline",
	heading: "heading",
	ref: "inline",
};

export interface CalloutTokenDomOptions {
	/** Callout type, metadata already split off (see splitCalloutMetadata). */
	rawId: string;
	/**
	 * Raw `|metadata` for this occurrence, stamped as `data-callout-metadata`
	 * exactly as Obsidian does on a block callout. "" (the default) leaves
	 * the attribute off entirely. Ref tokens always pass "": a `|` inside a
	 * wikilink is its alias separator, so a reference can never carry metadata.
	 */
	metadata?: string;
	registry: CalloutRegistry;
	/**
	 * "inline" renders the pill; "heading" renders the in-heading token;
	 * "ref" renders the compact icon(+name) used where a heading callout is
	 * referenced (outline pane, links, suggestion popup).
	 */
	variant: CalloutTokenVariant;
	/**
	 * Heading/ref tokens hide the display name when a custom title renders
	 * after the token.
	 */
	showName: boolean;
}

/**
 * Build the shared token DOM:
 * `<span class="cs-inline-callout|cs-heading-token [cs-unknown]"
 *        data-callout="<normalized id>">
 *    <span class="cs-callout-icon">…</span>
 *    <span class="cs-callout-name">…</span>?
 *  </span>`
 * `data-callout` carries the normalized id so per-callout CSS (including
 * alias selectors) and the context menu can target it on both surfaces, and
 * `data-callout-metadata` mirrors what Obsidian stamps on a block callout
 * so a theme can style these two roles by the same hook.
 */
export function buildCalloutTokenDom(
	options: CalloutTokenDomOptions,
): HTMLElement {
	const { rawId, metadata = "", registry, variant, showName } = options;
	const resolved = resolveCalloutDef(registry, rawId);
	const { def, unknown } = resolved;

	const root = createSpan();
	root.classList.add(VARIANT_CLASS[variant]);
	if (unknown) root.classList.add(CSS_UNKNOWN);
	// Animate the pill / heading token in during the startup entrance window.
	// Ref tokens (outline, links) load late and are excluded by design.
	if (variant !== "ref" && startupEntranceActive) {
		root.classList.add(CSS_ANIM_IN);
	}
	root.setAttribute("data-callout", calloutDomId(rawId, resolved));
	if (metadata) root.setAttribute("data-callout-metadata", metadata);

	// Drawn with no icon: build no span at all, rather than an empty one. The
	// token roots are flex boxes, so an empty item would still claim the `gap`
	// between icon and name — the same reason `refShowIcon` suppresses the ref
	// token's icon by omission instead of by hiding it.
	const hidesIcon = def?.hideIcon === true;
	if (!hidesIcon) {
		const iconEl = createSpan();
		iconEl.classList.add(CSS_TOKEN_ICON);
		root.appendChild(iconEl);
		if (def) paintRoleIcon(iconEl, def, registry, VARIANT_ROLE[variant]);
	} else if (!showName) {
		root.classList.add(CSS_TOKEN_EMPTY);
	}

	if (showName) {
		const nameEl = createSpan();
		nameEl.classList.add(CSS_TOKEN_NAME);
		// Unknown ids show what the user wrote; known ids show the display name.
		nameEl.textContent = unknown || !def ? rawId.trim() : def.displayName;
		root.appendChild(nameEl);
	}

	return root;
}

/**
 * Class list for the root of a content pill (`[!warning]{be careful}`).
 *
 * Live Preview applies these to a CM6 mark and reading view to a real element,
 * so both must be built here or the two surfaces drift apart.
 */
export function contentPillClasses(resolved: ResolvedCalloutDef): string[] {
	const classes = [CSS_INLINE_TOKEN, CSS_INLINE_HAS_CONTENT];
	if (resolved.unknown) classes.push(CSS_UNKNOWN);
	return classes;
}

/**
 * The icon that opens a content pill — it stands in for the `[!id]{` the user
 * typed. No display name: the whole point of the payload is that it *is* the
 * label, and repeating "Warning" before the author's own words reads as noise
 * (see CSS_CALLOUT_LEAD for why it is a separate element at all).
 */
export function buildCalloutLeadDom(
	rawId: string,
	registry: CalloutRegistry,
): HTMLElement {
	const lead = createSpan();
	lead.classList.add(CSS_CALLOUT_LEAD);
	const { def } = resolveCalloutDef(registry, rawId);
	// The lead is nothing but the icon, so with no icon there is nothing left to
	// draw — and its own `margin-inline-end` would open a gap before the payload.
	if (def?.hideIcon === true) {
		lead.classList.add(CSS_TOKEN_EMPTY);
		return lead;
	}
	const iconEl = createSpan();
	iconEl.classList.add(CSS_TOKEN_ICON);
	lead.appendChild(iconEl);
	if (def) paintRoleIcon(iconEl, def, registry, "inline");
	return lead;
}

/**
 * The empty shell of a content pill:
 * `<span class="cs-inline-callout cs-inline-has-content" data-callout="…">
 *    <span class="cs-callout-lead">…icon…</span>
 *    <span class="cs-callout-payload"></span>
 *  </span>`
 *
 * Both surfaces fill `payload` themselves, and it is returned rather than left
 * to be rediscovered by position — the lead is still there when the callout
 * hides its icon (empty, and hidden by CSS_TOKEN_EMPTY), so "the last child" and
 * "the second child" are not reliably the same element.
 *
 * Reading view moves in the nodes Obsidian already rendered — never re-rendered,
 * which is what keeps the author's `**bold**`, links and code spans intact. Live
 * Preview has only the raw source at that point, so it renders the payload
 * itself (livepreview/contentPillRender.ts) into this same shape.
 */
export function buildContentPillDom(options: {
	rawId: string;
	metadata?: string;
	registry: CalloutRegistry;
}): { root: HTMLElement; payload: HTMLElement } {
	const { rawId, metadata = "", registry } = options;
	const resolved = resolveCalloutDef(registry, rawId);

	const root = createSpan();
	root.classList.add(...contentPillClasses(resolved));
	if (startupEntranceActive) root.classList.add(CSS_ANIM_IN);
	root.setAttribute("data-callout", calloutDomId(rawId, resolved));
	if (metadata) root.setAttribute("data-callout-metadata", metadata);

	root.appendChild(buildCalloutLeadDom(rawId, registry));
	// One element for the whole payload, always — see CSS_CALLOUT_PAYLOAD for
	// why the pill breaks apart without it.
	const payload = createSpan();
	payload.classList.add(CSS_CALLOUT_PAYLOAD);
	root.appendChild(payload);
	return { root, payload };
}
