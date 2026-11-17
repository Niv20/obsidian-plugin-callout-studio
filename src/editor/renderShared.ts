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
import { calloutIdentity, calloutTokenLabel, normalizeCalloutId } from "../utils/calloutId";

// The class names live in `./tokenClasses` so the web runtime can share them
// without importing this module's icon painter. Re-exported, so every other
// consumer keeps one import point for the token surfaces.
export * from "./tokenClasses";
import {
	CSS_ANIM_IN,
	CSS_CALLOUT_LEAD,
	CSS_CALLOUT_PAYLOAD,
	CSS_HEADING_TOKEN,
	CSS_INLINE_HAS_CONTENT,
	CSS_INLINE_TOKEN,
	CSS_REF_TOKEN,
	CSS_TOKEN_EMPTY,
	CSS_TOKEN_ICON,
	CSS_TOKEN_NAME,
	CSS_UNKNOWN,
} from "./tokenClasses";

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
	/** True when the active theme owns this callout. See {@link shouldRenderToken}. */
	themeOwned: boolean;
}

/**
 * Whether the heading-callout / inline-callout / ref-token DOM should be built
 * for a resolved token at all.
 *
 * These three surfaces are Callout Studio's own invented syntax. A
 * theme-owned callout is Block only: the plugin could paint
 * `.cs-heading-token`, but no theme selector can match it, producing two
 * invented renderings beside the block the theme actually designed. Literal
 * text is the honest answer and makes "nothing is emitted for a theme
 * callout" literal.
 *
 * A pre-existing callout that becomes theme-owned loses the two formats for as
 * long as the theme claims it, then gets them back with no migration.
 *
 * Every consumer of {@link resolveCalloutDef} that builds DOM calls this first.
 */
export function shouldRenderToken(resolved: ResolvedCalloutDef): boolean {
	return !resolved.themeOwned;
}

/**
 * Resolve a raw `[!id]` token id to a definition: direct id → alias →
 * `data-callout` attribute form → the configured fallback callout. Native
 * blocks use the same lookup order before CSSInjector applies the weak
 * unknown-id fallback.
 *
 * The attribute-form step is what keeps the three roles consistent: a
 *   block callout `> [!a-b]` already picks up `a b`'s styling, because Obsidian
 * renders both spellings as `data-callout="a-b"` and the generated CSS
 *   selectors are built from that form. Heading callouts and inline callouts carry our
 * own space-preserving id, so without this step the same spelling would render
 * here as an unknown callout.
 */
export function resolveCalloutDef(registry: CalloutRegistry, rawId: string): ResolvedCalloutDef {
	const id = normalizeCalloutId(rawId);
	const direct = registry.get(id) ?? registry.findByAlias(id) ?? registry.findByAttrId(id);
	if (direct)
		return {
			def: direct,
			unknown: false,
			themeOwned: registry.themeOwns(direct),
		};
	return {
		def: registry.get(registry.settings.fallbackCalloutId),
		unknown: true,
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
 * The attribute form of an *alias* (`[!banner-icon]` for the alias
 * `banner icon`) is stamped with that alias, not the id: it is just as covered
 * by the CSS, and it keeps the token an alias token for the icon sweep, which
 * re-reads its label from this attribute alone (see calloutTokenLabel). Stamped
 * with the id, the sweep would repaint "Banner icon" as the callout's NAME.
 *
 * Unknown tokens keep the raw spelling, which is what `.cs-unknown` styling and
 * the raw-id label expect.
 */
export function calloutDomId(rawId: string, resolved: ResolvedCalloutDef): string {
	const id = normalizeCalloutId(rawId);
	const { def, unknown } = resolved;
	if (!def || unknown) return id;
	if (id === def.id || def.aliases?.includes(id)) return id;
	const typed = calloutIdentity(id);
	if (typed === calloutIdentity(def.id)) return def.id;
	return def.aliases?.find((alias) => calloutIdentity(alias) === typed) ?? def.id;
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
export function buildCalloutTokenDom(options: CalloutTokenDomOptions): HTMLElement {
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
		// The typed word decides: the NAME for the id, Obsidian's own title for
		// an alias, what the user wrote for an unknown id.
		nameEl.textContent = calloutTokenLabel(unknown ? undefined : def, rawId);
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
export function buildCalloutLeadDom(rawId: string, registry: CalloutRegistry): HTMLElement {
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
export function buildContentPillDom(options: { rawId: string; metadata?: string; registry: CalloutRegistry }): {
	root: HTMLElement;
	payload: HTMLElement;
} {
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
