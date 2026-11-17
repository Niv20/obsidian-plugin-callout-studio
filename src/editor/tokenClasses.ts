/**
 * editor/tokenClasses.ts — the class names of the heading-callout and
 * inline-callout DOM.
 *
 * Their own module, with no import at all, because three builders have to
 * agree on them letter for letter: Live Preview's widgets, the reading-view
 * post-processor, and the web renderer (`web/core.ts`) that draws the same
 * DOM on a published site. The first two reach them through `renderShared`,
 * which re-exports this file; the web renderer cannot, because `renderShared`
 * pulls in the icon painter and with it `obsidian`, which exists neither in a
 * browser nor in a site's build. Anything added here must stay a plain string.
 */

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
