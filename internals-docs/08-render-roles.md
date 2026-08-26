# Render roles and rendering surfaces

Heading callouts and inline callouts are the plugin's own invented syntax —
Obsidian has no idea what `## [!note]` or `text [!note] text` mean. This
document covers how the plugin recognizes, parses, and renders them across
Live Preview, Reading view and the Outline pane, and how it stays in sync with
the registry.

## The token grammar — one parser, every consumer

[`src/editor/calloutTokens.ts`](../src/editor/calloutTokens.ts) (~840 lines)
is the **single source of truth** for what counts as a callout token. Every
consumer — Live Preview's decoration builder, the reading-view post-processor,
vault discovery, statistics, the autocomplete trigger, the vault rewriters
(replace/convert-to-plain-text) — calls into this file rather than writing its
own regex. That's what keeps "3 uses in 2 files" (statistics), "3 references
updated" (replace), and "this note has an unknown callout" (discovery) all in
agreement.

### The three role regexes

```ts
HEADING_CALLOUT_RE   = /^(#{1,6})[ \t]+\[!([^\]\n\r]+)\][ \t]?(.*)$/
BLOCKQUOTE_CALLOUT_HEADER_RE = /^(\s*(?:>[ \t]?)+)\[!([^\]\n\r]+)\]/
// inline: no single regex — a manual indexOf scan (see below)
```

`scanLineForCalloutTokens(rawLine, options?)` classifies every `[!name]` on a
line by role:

- **Block role**: the line matches `BLOCKQUOTE_CALLOUT_HEADER_RE`. Returns a
  single token; everything after is title text Obsidian itself renders — no
  inline scanning happens inside a block header.
- **Heading role**: the line matches `HEADING_CALLOUT_RE` (`[!` is the first
  content after 1–6 `#` marks and at least one space/tab). `# [!text](url)` is
  explicitly excluded — a markdown link at heading start, not a callout.
  Scanning continues *after* the heading token for inline tokens inside the
  heading's own title text.
- **Inline role**: everything else, found by a manual `indexOf("[!", ...)`
  scan rather than a regex — this handles adjacent tokens, escapes, and link
  syntax exactly and cheaply. An escaped `\[!name]` and a wikilink's contents
  (`[[!name]]`, blanked by `stripWikilinks` first) are never tokens. `[!name](url)`
  — an inline markdown link whose text happens to start with `!` — is
  explicitly skipped.

### Metadata is split off at the tokenizer, not downstream

Every token carries `rawId` (the type alone) **and** `metadata`/`hasMetadata`
separately — `splitCalloutMetadata` runs inside the tokenizer itself. `from`/`to`
on every token span the **whole** `[!…]` bracket including the metadata, which
is why nothing may derive a token's length from `rawId` alone; a rewriter that
tried would corrupt offsets on any token carrying `|metadata`.

### The `{…}` content payload (inline pills only)

`[!warning]{be careful}` renders the braces' content as the pill's label,
dropping the callout's own display name. A `{` only opens a payload when it
sits **directly** against the token's `]` — `[!warning] {x}` (with a space) is
a plain pill followed by literal text, because prose uses braces freely and a
looser rule would eat them. `token.contentOpen = true` marks a payload that
never closed on the line (mid-typing) — renderers must skip building a pill
for it (flashing a half-typed payload would be noise), but discovery/statistics
must still count the token, which is why the parser *reports* it and lets
renderers decide, mirroring `shouldRenderToken`'s split.

Nested `{…}` payloads (`[!a]{outer [!b]{inner}}`) are **not a supported
syntax**, but `nestedInlineTokens()` still needs the scanner to report the
inner token — omitting it would desync the reading-view escape-pairing logic,
which matches rendered DOM candidates to source `[!` occurrences by *ordinal
position*. Renderers filter nested tokens out via `nestedInlineTokens()`
instead of the scanner refusing to find them.

### Whole-document scanning skips frontmatter and fenced code

`createDocumentLineFilter()` produces a **stateful, single-use** per-line
predicate — every whole-document consumer (vault scanners, discovery,
statistics) shares it, feeding it every line **in order**, none skipped, or
the fence/frontmatter state desyncs. It correctly handles fences nested inside
blockquotes and the frontmatter-must-be-line-0 rule.

### References inside links and the Outline pane

Three more parsers in the same file cover callout tokens that appear
**referenced** rather than written: `findWikilinkCalloutRefs` (a heading
reference inside `[[#[!id] Title]]`), `parseHeadingRefDisplayText` (the same
reference as it appears in an already-*rendered* internal link's display
text, which Obsidian may have truncated at the first `]]`), and
`parseOutlineHeadingText` (the Outline pane's bracket-stripped display —
`!id Title` — which is genuinely ambiguous with a heading that literally
starts with `!id`, hence the `bracketed` flag callers must check before
trusting it). See [Outline pane and link cleanup](09-editor-integrations.md#outline-pane-and-link-suggestions).

## `renderShared.ts` — the shared DOM builder

[`src/editor/renderShared.ts`](../src/editor/renderShared.ts) is what makes
Live Preview and Reading view produce **byte-identical DOM** for the same
token, which is what lets `CSSInjector`'s icon-repaint sweep target both with
one selector.

```ts
resolveCalloutDef(registry, rawId): ResolvedCalloutDef  // { def, unknown, external }
shouldRenderToken(resolved): boolean                      // false ⟺ externalStyle
buildCalloutTokenDom(options): HTMLElement                 // the pill / heading-token DOM
buildContentPillDom(options): { root, payload }             // the empty shell for a {…} pill
```

`resolveCalloutDef` mirrors `CSSInjector`'s own resolution ladder exactly (id
→ alias → `data-callout` attribute form → configured fallback), which is what
keeps DOM icons and generated CSS colours from disagreeing about which
definition a token means.

### `shouldRenderToken` — the two cutoffs

```ts
export function shouldRenderToken(resolved: ResolvedCalloutDef): boolean {
  return !resolved.external && !resolved.themeOwned;
}
```

Every renderer of the heading/inline/ref surfaces calls this **first**, and two
quite different facts land here.

**`external`** — the user styles this callout in their own snippet. These three
roles get **no DOM at all**, and the `[!id]` stays literal text: unlike the
block role, there is nothing here for a snippet to style, so a half-painted
token would just look broken.

**`themeOwned`** — the active theme supplies this callout, and a theme callout is
**Block only**. The plugin *could* paint `.cs-heading-token` (no theme selector
can match it, and an earlier build did exactly that), but it would be offering
two formats the theme has no design for and cannot follow, beside a Block
callout the theme draws itself — three renderings of one callout with two
invented. The withdrawal is temporary and reversible: nothing leaves the
definition, only what the renderer acts on. Downstream, autocomplete stops
offering theme callouts in those positions, the command builder drops the two
options, and an existing heading/inline command is *suspended* rather than
deleted.

See [Callout registry § externalStyle](05-callout-registry.md),
[CSS generation § standing down](06-css-generation.md#standing-down--why-emit-nothing-needs-three-separate-mechanisms), and
[Theme callout discovery § Block only](21-theme-callout-discovery.md#where-theme-callouts-appear--and-why-block-only).

### `hideIcon` and flex-gap collapse

When a definition has `hideIcon: true`, `buildCalloutTokenDom` builds **no
icon span at all** — not a hidden one. The token root is a flex container, so
an empty (zero-size) icon item would still claim the container's `gap`,
reading as a stray leading space. Building nothing collapses that gap for
free. The `CSS_TOKEN_EMPTY` class handles the edge case where the icon *and*
the name are both absent (the ref-token variant, and a content pill's lead) —
without it the token root would still be a flex item claiming space in its
parent.

## Live Preview: `calloutViewPlugin.ts`

A single CodeMirror `ViewPlugin`
([`src/editor/livepreview/calloutViewPlugin.ts`](../src/editor/livepreview/calloutViewPlugin.ts))
recomputes decorations for **visible ranges only**, triggered by doc changes,
viewport changes, selection/focus changes, fold changes, and an explicit
no-payload refresh effect.

### Why the heading-line "gap above the bar" is a separate `StateField`

In CodeMirror 6, **block decorations may not come from a `ViewPlugin`** — the
content-drawing code consumes block decorations before layout, while a
plugin's decorations are read afterward; supplying one from a plugin throws
`"Block decorations may not be specified via plugins"`. So
[`headingGapField.ts`](../src/editor/livepreview/headingGapField.ts) is a
standalone `StateField` that scans the **whole document** (block decorations
affect the whole height map, so viewport-limiting isn't an option) but is
gated hard: nothing runs unless the feature is genuinely on (`marginTop > 0`
and heading callouts enabled), and it stops at the syntax tree's **parse
frontier** rather than the document end — Lezer parses incrementally under a
time budget, and past the frontier `resolveInner()` would misreport a line
inside an unparsed fenced block as ordinary text, potentially adding a gap
inside a code fence. The field rebuilds automatically when the parse worker
advances the tree (detected by tree-object identity change) as well as on
document changes and the refresh effect.

### `visibleRanges` is not the viewport — the "line split across two spans" trap

```ts
// CodeMirror subtracts every state-level point decoration ≥20 chars from
// visibleRanges, which can split ONE line across two ranges (a fold ending
// mid-line, or a line-gap inside a >20,000-char line). Decorating it twice
// throws "Ranges must be added sorted".
let lastLineFrom = -1;
for (const range of view.visibleRanges) { ... if (line.from <= lastLineFrom) { skip } ... }
```

A single high-water-mark check (`lastLineFrom`) is the entire fix, because the
ranges are strictly ordered.

### The raw-syntax reveal and the mousedown freeze

A heading token or inline pill collapses to its widget **except** while the
selection touches it — that's the token's only editing affordance. But the
selection used to build decorations is a **frozen snapshot**, not a live
`view.state.selection` read, and the freeze is held while the left mouse
button is down:

> Obsidian's own `#`-heading-mark reveal is deferred to `mouseup`. Without
> matching that, this plugin's raw `[!id]` reveal would land a beat earlier
> than core's own reveal, producing a visible two-stage flash as the user
> clicks into a heading.

On mobile, this window is wider than a physical tap: core arms the same
`mousedown` flag on *every* caret move and clears it on a 700 ms debounce, so
almost any tap is followed by two-thirds of a second during which the plugin
must not rebuild from a live selection either. A `mouseup` listener on the
owning document, with a same-tick safety-net timer, force-dispatches a no-op
refresh if nothing else cleared the freeze — covering drags that end outside
the editor or over a widget that swallowed the event.

`calloutStudioCaretDrop` is a separate, narrower effect for exactly one case:
a click **on an inline pill itself**, whose only editing affordance is
revealing raw source under the caret it just placed. That transaction must
bypass the freeze entirely — deferring it (rather than ignoring the freeze)
can **lose the reveal outright**, not just delay it, if core's own mousedown
flag hasn't cleared by the time the safety-net timer fires.

### `refreshAllCalloutEditors()` — why registry edits need an explicit nudge

Registry mutations (colour edits, renames, new definitions, settings toggles)
never touch document text, so CodeMirror has no organic reason to rebuild
this plugin's decorations. [`refresh.ts`](../src/editor/livepreview/refresh.ts)
tracks **every** `EditorView` this plugin's `ViewPlugin` is currently mounted
in — not just top-level markdown-leaf editors, but table cells, canvas cards,
editable transclusions, and the settings tab's own live preview — and
dispatches a no-op `calloutStudioRefresh` effect to all of them on demand.
This replaced an earlier approach that only found the single editor per
markdown *leaf*, which silently starved every nested editor's inline/heading
DOM of a refresh path.

### The `CSS_CM_WIDGET` marker

CodeMirror-owned widget DOM (drawn by the `ViewPlugin`'s replace widgets)
must **never** be touched by `CSSInjector.paintIcons`'s repaint sweep — CM
rebuilds it itself when the decoration set changes, via the refresh effect
above. Token DOM built by the reading-view post-processor (including one
embedded *inside* an editor, e.g. a `![[note]]` transclusion) is the opposite
— nothing else will ever repaint it, so it must stay in the sweep. The two
are told apart by an explicit class the widget-building code stamps on
itself, **never** by DOM ancestry: a transclusion's rendered content lives
under the editor's own `.cm-content`, and an editable table/canvas cell nests
a *real* `.cm-content` inside rendered containers — so no ancestry test gets
both directions right. Only the code that built the element knows for sure.

## Reading view: `calloutPostProcessor.ts`

[`src/reading/calloutPostProcessor.ts`](../src/reading/calloutPostProcessor.ts)
is registered as a `registerMarkdownPostProcessor`, with two cheap bail-outs
(both roles disabled; block text contains no `[!`) that keep per-render cost
negligible.

- **Heading blocks are restyled in place** — the `<hN>` element itself is
  kept (so Outline, TOC plugins, and anchor links keep working), gaining the
  bar class while its `[!id]±` text prefix is swapped for the shared token
  DOM.
- **Inline occurrences** anywhere else are replaced with pill spans, with an
  opaque-subtree exclusion list (`code`, `pre`, `.math`, existing internal
  links/embeds, other pill/heading-token DOM) kept in **explicit parity** with
  what Live Preview's content-matching blanks out (`blankInlineMath`,
  `stripWikilinks`, `stripInlineCode`) — so a `{…}` payload closes at the same
  place on both surfaces.
- **Source lines are consulted lazily**, at most once per rendered block, only
  when a candidate match makes it necessary — this is what rejects
  false-positive matches like `# \[!id]` (escaped) or `> # [!id]` (a heading
  line *inside* a block callout, which is really an inline token) without
  paying the cost on every ordinary heading.
- **A single-heading block trusts its source; a multi-heading block
  (`getSectionInfo` returns null — export/print paths) trusts the rendered
  text instead.**

### Escapes and the pairing problem

Markdown rendering consumes the backslash of `\[!id]`, so the *rendered* text
of an escaped token looks byte-identical to a real one. The post-processor
resolves this by pairing rendered candidate matches against the block's raw
**source** by ordinal position, and only runs that full pairing pass when the
source actually contains a literal `\[!` — the common case (no escapes) skips
it entirely.

## The Outline pane, PDF export, and gradient text

- **`OutlineDecorator`** — see
  [Editor integrations § Outline pane](09-editor-integrations.md#outline-pane-and-link-suggestions).
- **PDF export** clones the rendered DOM but drops the adopted stylesheet, so
  icon artwork for anything but Lucide has to already be baked as **visible**
  DOM (not a CSS mask) — see
  [CSS generation § icon painting](06-css-generation.md#icon-painting).
- **`gradientTitleText.ts`** bakes per-grapheme solid colours for `@media print`,
  because Chromium's print pipeline doesn't honour `background-clip: text` —
  see [CSS generation § gradients](06-css-generation.md#gradients).

## The startup entrance animation

`renderShared.ts` exports a tiny piece of shared state:

```ts
isStartupEntranceActive(): boolean
beginStartupEntranceWindow(doc): () => void   // returns a close/cleanup fn
```

`main.ts` opens this window (for `STARTUP_ENTRANCE_MS = 3000` ms) only when the
UI was **already visible** at load time (mobile, always; desktop, only a
mid-session enable/reload) — see
[Plugin lifecycle](03-plugin-lifecycle.md#why-the-very-first-line-reads-layoutready-before-any-await).
While open, freshly built inline pills, heading bars, and fold chevrons get the
`cs-anim-in` class so they animate in rather than snap. Ref tokens (outline,
links) are deliberately excluded — they render late, well outside any window
where a snap would be visible as a flash.

---
Next chapter: [09-editor-integrations.md](09-editor-integrations.md)
