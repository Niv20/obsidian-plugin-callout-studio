# Render roles and rendering surfaces

Heading callouts and inline callouts are the plugin's own invented syntax -
Obsidian has no idea what `## [!note]` or `text [!note] text` mean. This
document covers how the plugin recognizes, parses, and renders them across
Live Preview, Reading view and the Outline pane, and how it stays in sync with
the registry.

## The token grammar - one parser, every consumer

[`src/editor/calloutTokens.ts`](../../src/editor/calloutTokens.ts) (~840 lines)
is the **single source of truth** for what counts as a callout token. Every
consumer - Live Preview's decoration builder, the reading-view post-processor,
vault discovery, statistics, the autocomplete trigger, the vault rewriters
(replace/convert-to-plain-text) - calls into this file rather than writing its
own regex. That's what keeps "3 uses in 2 files" (statistics), "3 references
updated" (replace), and "this note has an unknown callout" (discovery) all in
agreement.

### The three role regexes

```ts
HEADING_CALLOUT_RE   = /^(#{1,6})[ \t]+\[!([^\]\n\r]+)\][ \t]?(.*)$/
BLOCKQUOTE_CALLOUT_HEADER_RE = /^([ \t]*(?:>[ \t]*)+)\[!([^\]\n\r]+)\]/
// inline: no single regex - a manual indexOf scan (see below)
```

`scanLineForCalloutTokens(rawLine, options?)` classifies eligible `[!name]` tokens
by role after resolving source masks and container prefixes:

- **Block role**: the line matches `BLOCKQUOTE_CALLOUT_HEADER_RE`. Returns a
  single token; everything after is title text Obsidian itself renders - no
  inline scanning happens inside a block header.
- **Heading role**: the line matches `HEADING_CALLOUT_RE` (`[!` is the first
  content after 1 - 6 `#` marks and at least one space/tab). `# [!text](url)` is
  explicitly excluded - a markdown link at heading start, not a callout.
  Scanning continues *after* the heading token for inline tokens inside the
  heading's own title text.
- **Inline role**: everything else, found by a manual `indexOf("[!", ...)`
  scan rather than a regex - this handles adjacent tokens, escapes, and link
  syntax exactly and cheaply. An escaped `\[!name]` and a wikilink's contents
  (`[[!name]]`, blanked by `stripWikilinks` first) are never tokens. `[!name](url)`
 - an inline markdown link whose text happens to start with `!` - is
  explicitly skipped.

### Metadata is split off at the tokenizer, not downstream

Every token carries `rawId` (the type alone) **and** `metadata`/`hasMetadata`
separately - `splitCalloutMetadata` runs inside the tokenizer itself. `from`/`to`
on every token span the **whole** `[!…]` bracket including the metadata, which
is why nothing may derive a token's length from `rawId` alone; a rewriter that
tried would corrupt offsets on any token carrying `|metadata`.

The heading and inline DOM stamp that metadata as `data-callout-metadata`
(omitted when empty), exactly as Obsidian does on a block callout. It is not
decoration: the metadata colour rules (`css/metadataColorCSS.ts`) select on it
for all three roles, and themes hook it the same way. Ref tokens never carry
it, so an Outline or link icon keeps the callout's own colour. The two paths
that bake a colour into the DOM for PDF export - the regular icon in
`CSSInjector.paintIcon` and the per-letter title colours of
`applyTitleGradient` - read the element's own metadata through
`definitionWithMetadataColor`, with the same colour list the stylesheet emits
(`CSSInjector.metadataColorEntries`, which the reading post-processor reaches
through its host's `cssInjector`) and the same word test
(`metadataNamesWord`), so print matches the screen. That includes a colour
without a title sweep over a callout whose own definition has one: the
stylesheet clears the sweep, and the painter, given a definition without one,
leaves the title unwrapped.

### The `{…}` content payload (inline pills only)

`[!warning]{be careful}` renders the braces' content as the pill's label,
dropping the token's own one (the display name, or an alias's title). A `{` only opens a payload when it
sits **directly** against the token's `]` - `[!warning] {x}` (with a space) is
a plain pill followed by literal text, because prose uses braces freely and a
looser rule would eat them. `token.contentOpen = true` marks a payload that
never closed on the line (mid-typing) - renderers must skip building a pill
for it (flashing a half-typed payload would be noise), but discovery/statistics
must still count the token, which is why the parser *reports* it and lets
renderers decide, mirroring `shouldRenderToken`'s split.

Nested `{…}` payloads (`[!a]{outer [!b]{inner}}`) are **not a supported
syntax**, but `nestedInlineTokens()` still needs the scanner to report the
inner token - omitting it would desync the reading-view escape-pairing logic,
which matches rendered DOM candidates to source `[!` occurrences by *ordinal
position*. Renderers filter nested tokens out via `nestedInlineTokens()`
instead of the scanner refusing to find them.

### Whole-document exclusions and source positions

`documentCallouts.ts` exposes `iterateDocumentCallouts` (full token, line index,
line offset) and `iterateDocumentCalloutLines` (every line, including excluded
ones). `iterateDocumentCalloutSteps` also yields preparation checkpoints so
indexing can yield while preparing large documents, even without any callouts.
`forEachCalloutToken` is the compatibility
callback over the same iterator. Vault scanners and writers use these interfaces.

`markdownExclusions.ts` coordinates fenced/indented code, exact backtick-run code
spans, YAML frontmatter and same-line/multiline Obsidian `%%` comments. Delimiters
inside code cannot start comments; fences inside comments cannot start code.
Exclusion masks preserve original offsets and cannot manufacture valid tokens.
`markdownContainers.ts` resolves quote/list prefixes and indentation before role
classification. Repeated quote-header spaces and 0 - 3-space heading indentation
are accepted where they are not code. A quoted heading-leading token retains the
existing inline-role behavior; finding `#` inside prose does not create a heading.

The line scanner also applies same-line exclusions. Live Preview's
`livepreview/sourceTokens.ts` additionally checks CodeMirror's ancestor context
and parse frontier; unparsed regions remain raw until the tree advances.
Language-free previews use document exclusions cached by immutable document
identity. Autocomplete asks the document lexer before offering a trigger.
Native Reading view suppresses code/comments; source pairing for escaped pills
uses shared exclusions as well.

### References inside links and the Outline pane

Three more parsers in the same file cover callout tokens that appear
**referenced** rather than written: `findWikilinkCalloutRefs` (a heading
reference inside `[[#[!id] Title]]`), `parseHeadingRefDisplayText` (the same
reference as it appears in an already-*rendered* internal link's display
text, which Obsidian may have truncated at the first `]]`), and
`parseOutlineHeadingText` (the Outline pane's bracket-stripped display -
`!id Title` - which is genuinely ambiguous with a heading that literally
starts with `!id`, hence the `bracketed` flag callers must check before
trusting it). See [Outline pane and link cleanup](10-editor-integrations.md#outline-pane-and-link-suggestions).

## `renderShared.ts` - the shared DOM builder

[`src/editor/renderShared.ts`](../../src/editor/renderShared.ts) is what makes
Live Preview and Reading view produce **byte-identical DOM** for the same
token, which is what lets `CSSInjector`'s icon-repaint sweep target both with
one selector.

```ts
resolveCalloutDef(registry, rawId): ResolvedCalloutDef  // { def, unknown, themeOwned }
shouldRenderToken(resolved): boolean                    // false ⟺ themeOwned
buildCalloutTokenDom(options): HTMLElement                 // the pill / heading-token DOM
buildContentPillDom(options): { root, payload }             // the empty shell for a {…} pill
```

`resolveCalloutDef` owns the plugin-token resolution ladder (id → alias →
`data-callout` attribute form → configured fallback). Native Blocks now take a
different final route: `paintIcons` resolves registered ids directly, while an
unrecognized id is governed by the weak fallback CSS and its computed icon
sentinel. Both routes still agree on which exact definitions are known and
which unresolved ids use the configured fallback; the split exists so native
theme/snippet CSS can outrank that baseline without being turned into registry
ownership.

### Resolving a token

Two more answers come off a resolved token, and both stay with the spelling
that was typed:

- **The label** is `calloutTokenLabel(def, rawId)` from
  [`utils/calloutId.ts`](../../src/utils/calloutId.ts): the NAME for the
  definition's own id, Obsidian's default title for one of its aliases
  (`[!attention]` draws "Attention", as Obsidian's untitled block does), what
  was typed for an unknown id. Every drawn label goes through it - see
  [editor integrations § the typed word decides the title](10-editor-integrations.md#the-typed-word-decides-the-title).
- **`data-callout`** is `calloutDomId(rawId, resolved)`: the typed spelling
  when it is the id or an alias exactly, the definition's id when the token
  only matched the id's attribute form (`[!a-b]` for `a b` - no generated
  selector carries the dashed spelling), and the alias itself when it matched
  an alias's attribute form (`[!banner-icon]` for the alias `banner icon`).
  That last case is not cosmetic: `CSSInjector`'s icon sweep repaints a token's
  name from this attribute alone, so a token stamped with the id there would
  be repainted with the NAME the next time the sweep ran.

### `shouldRenderToken` - the theme-ownership cutoff

```ts
export function shouldRenderToken(resolved: ResolvedCalloutDef): boolean {
  return !resolved.themeOwned;
}
```

Every renderer of the heading/inline/ref surfaces calls this **first**.
`themeOwned` means the active theme supplies this callout, and a theme callout is
**Block only**. The plugin *could* paint `.cs-heading-token` (no theme selector
can match it, and an earlier build did exactly that), but it would be offering
two formats the theme has no design for and cannot follow, beside a Block
callout the theme draws itself - three renderings of one callout with two
invented. The withdrawal is temporary and reversible: nothing leaves the
definition, only what the renderer acts on. Downstream, autocomplete stops
offering theme callouts in those positions, the command builder drops the two
options, and an existing heading/inline command is *suspended* rather than
deleted.

See [CSS generation § standing down](06-css-generation.md#standing-down---why-emit-nothing-needs-three-separate-mechanisms) and
[Theme callout discovery § Block only](18-theme-callout-discovery.md#where-theme-callouts-appear---and-why-block-only).

### `hideIcon` and flex-gap collapse

When a definition has `hideIcon: true`, `buildCalloutTokenDom` builds **no
icon span at all** - not a hidden one. The token root is a flex container, so
an empty (zero-size) icon item would still claim the container's `gap`,
reading as a stray leading space. Building nothing collapses that gap for
free. The `CSS_TOKEN_EMPTY` class handles the edge case where the icon *and*
the name are both absent (the ref-token variant, and a content pill's lead) -
without it the token root would still be a flex item claiming space in its
parent.

### Inline pill alignment and scale

Both inline pill forms use the same `.cs-inline-callout` flex box. An optional
icon or icon lead sits beside the token's label or `{…}` payload. The root uses
`vertical-align: middle` at every font scale, so changing the scale contracts
or expands the whole pill around the surrounding line's vertical center
instead of pinning its bottom to the text baseline. CSS
`middle` aligns to the parent's x-height midpoint, which sits slightly below
the line box's visual center, so the pill is also moved upward by about `0.09em`
of the surrounding text. The icon and text remain centered inside the pill
through `align-items: center` and the icon box's own flex centering.

The pill's `--cs-inline-scale` multiplies its `0.9em` base font size. Padding,
gap, and SVG size use `em`, while the unitless line height scales with that
font size. The centering correction therefore uses `0.1 / fontScale` em of the
pill, keeping it at about `0.09em` of the paragraph as the pill changes size.
`--cs-inline-lift` remains available to CSS snippets as an optional additional
visual offset, with a neutral `0em` default.

## Live Preview: `calloutViewPlugin.ts`

A single CodeMirror `ViewPlugin`
([`src/editor/livepreview/calloutViewPlugin.ts`](../../src/editor/livepreview/calloutViewPlugin.ts))
recomputes decorations for **visible ranges only**, triggered by doc changes,
viewport changes, selection/focus changes, fold changes, and an explicit
no-payload refresh effect.

### Why the heading-line "gap above the bar" is a separate `StateField`

In CodeMirror 6, **block decorations may not come from a `ViewPlugin`** - the
content-drawing code consumes block decorations before layout, while a
plugin's decorations are read afterward; supplying one from a plugin throws
`"Block decorations may not be specified via plugins"`. So
[`headingGapField.ts`](../../src/editor/livepreview/headingGapField.ts) is a
standalone `StateField` that scans the **whole document** (block decorations
affect the whole height map, so viewport-limiting isn't an option) but is
gated hard: nothing runs unless the feature is genuinely on (`marginTop > 0`
and heading callouts enabled), and it stops at the syntax tree's **parse
frontier** rather than the document end - Lezer parses incrementally under a
time budget, and past the frontier `resolveInner()` would misreport a line
inside an unparsed fenced block as ordinary text, potentially adding a gap
inside a code fence. The field rebuilds automatically when the parse worker
advances the tree (detected by tree-object identity change) as well as on
document changes and the refresh effect.

### `visibleRanges` is not the viewport - the "line split across two spans" trap

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
selection touches it - that's the token's only editing affordance. But the
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
refresh if nothing else cleared the freeze - covering drags that end outside
the editor or over a widget that swallowed the event.

`calloutStudioCaretDrop` is a separate, narrower effect for exactly one case:
a click **on an inline pill itself**, whose only editing affordance is
revealing raw source under the caret it just placed. That transaction must
bypass the freeze entirely - deferring it (rather than ignoring the freeze)
can **lose the reveal outright**, not just delay it, if core's own mousedown
flag hasn't cleared by the time the safety-net timer fires.

### Title-less and aliased reference links

A link to a title-less heading, `[[#[!tip]]]`, ends in a `]]]` run that
Obsidian's parser cuts at the first `]]`. Left alone, it reads three ways: the
raw link while the caret is inside it, a half-parsed `#[!tip]` (core rendering
the link it thinks ends one `]` early) while the caret sits just after it, and
the rendered link elsewhere. So the link suggester never writes that shape
any more: picking a title-less heading writes `[[#[!tip]|Tip]]`, the
token's label as an alias (see
[`LinkSuggestDecorator`](10-editor-integrations.md#linksuggestdecorator)).
Obsidian parses, shows and follows that link natively, with the same two
states as any link.

An aliased link shows only its alias; Obsidian hides the target and the `|`.
When the target's last segment opens with a callout token, Live Preview puts a
zero-width `CalloutTokenWidget` ("ref" variant) at the alias start, and reading
view's `decorateAliasedHeadingRef` prepends the same icon inside the anchor.
That gives icon + text, matching a titled reference. Reading view has to run
this pass even for a block whose text has no `[!`, since the token lives only
in the anchor's `data-href`. A TOC-style alias that opens with a token of its
own is drawn by its alias-side ref, so it never gets two icons. The ref icon's
click handler matches its link by the link's whole range, not the token's,
because the alias icon does not sit on the token.

A `[[#[!tip]]]` written by hand, or by an older version, still gets the old
treatment. Live Preview replaces the **whole link** with one
`HeadingRefLinkWidget` (icon + label). That replace
opens at the link's `[[`, the same offset where core's own replace hides the
brackets. Two replaced ranges that start together are tie-broken by
precedence, and core's decorations come before a plugin's at the same level.

Core winning that tie is not merely cosmetic. A full redraw of the line still
draws the widget after core's hidden `[[`. A partial redraw starts at the end
of core's hide and treats the widget as already drawn. That happens when only
this plugin's set changed, such as the caret leaving the link with Enter right
after a link-suggest pick. Nothing was drawn and the line went blank until the
caret moved in and back out.

The same tie hit pills and heading tokens. Core reads `[!a] [!b]` as a
reference link (`[text] [label]`) and hides the `[` and `]` of both, so its
hide opens exactly where each pill does. Restyling the callout in the editor
redraws only this plugin's set. Every pill followed by another token went
blank, and only the last one on the line (`[!c]`, with nothing after it to
make it a link) kept its pill until the caret went in and back out.

So `buildDecorations` returns two sets. Every replace widget over a token goes
in `raised`, which the plugin `provide`s at `Prec.highest`: the heading token,
both kinds of pill, and the whole-link replacement. Marks, line decorations,
the in-link ref icons and the fold chevron stay in `decorations` at default
precedence. The widgets then always open their range, and core's hides inside
them are skipped. Marks stay at default precedence because precedence also
decides how mark decorations nest. Raising the heading title mark, for
example, would wrap it outside core's header spans.

### `refreshAllCalloutEditors()` - why registry edits need an explicit nudge

Registry mutations (colour edits, renames, new definitions, settings toggles)
never touch document text, so CodeMirror has no organic reason to rebuild
this plugin's decorations. [`refresh.ts`](../../src/editor/livepreview/refresh.ts)
tracks **every** `EditorView` this plugin's `ViewPlugin` is currently mounted
in - not just top-level markdown-leaf editors, but table cells, canvas cards,
editable transclusions, and the settings tab's own live preview - and
dispatches a no-op `calloutStudioRefresh` effect to all of them on demand.
This replaced an earlier approach that only found the single editor per
markdown *leaf*, which silently starved every nested editor's inline/heading
DOM of a refresh path.

### The `CSS_CM_WIDGET` marker

CodeMirror-owned widget DOM (drawn by the `ViewPlugin`'s replace widgets)
must **never** be touched by `CSSInjector.paintIcons`'s repaint sweep - CM
rebuilds it itself when the decoration set changes, via the refresh effect
above. Token DOM built by the reading-view post-processor (including one
embedded *inside* an editor, e.g. a `![[note]]` transclusion) is the opposite
 - nothing else will ever repaint it, so it must stay in the sweep. The two
are told apart by an explicit class the widget-building code stamps on
itself, **never** by DOM ancestry: a transclusion's rendered content lives
under the editor's own `.cm-content`, and an editable table/canvas cell nests
a *real* `.cm-content` inside rendered containers - so no ancestry test gets
both directions right. Only the code that built the element knows for sure.

## Reading view: `calloutPostProcessor.ts`

[`src/reading/calloutPostProcessor.ts`](../../src/reading/calloutPostProcessor.ts)
is registered as a `registerMarkdownPostProcessor`, with two cheap bail-outs
(both roles disabled; block text contains no `[!`) that keep per-render cost
negligible.

- **Heading blocks are restyled in place** - the `<hN>` element itself is
  kept (so Outline, TOC plugins, and anchor links keep working), gaining the
  bar class while its `[!id]±` text prefix is swapped for the shared token
  DOM.
- **Inline occurrences** anywhere else are replaced with pill spans, with an
  opaque-subtree exclusion list (`code`, `pre`, `.math`, existing internal
  links/embeds, other pill/heading-token DOM) kept in **explicit parity** with
  what Live Preview's content-matching blanks out (`blankInlineMath`,
  `stripWikilinks`, `stripInlineCode`) - so a `{…}` payload closes at the same
  place on both surfaces.
- **Source lines are consulted lazily**, at most once per rendered block, only
  when a candidate match makes it necessary - this is what rejects
  false-positive matches like `# \[!id]` (escaped) or `> # [!id]` (a heading
  line *inside* a block callout, which is really an inline token) without
  paying the cost on every ordinary heading.
- **A single-heading block trusts its source; a multi-heading block
  (`getSectionInfo` returns null - export/print paths) trusts the rendered
  text instead.**

### Escapes and the pairing problem

Markdown rendering consumes the backslash of `\[!id]`, so the *rendered* text
of an escaped token looks byte-identical to a real one. The post-processor
builds one source mapping before either inline pass mutates the DOM, pairing
candidate order and token identity (including metadata). `inlineEscapePlan.ts`
keeps each escape decision attached to its text node and moves offsets when
content or plain pills split that node. Both passes consult the same plan.

The full pairing runs only when source contains `\[!`. If supplied source and
rendered candidates disagree, the block's inline tokens remain literal rather
than ignoring a possible escape. When source is unavailable (some embeds and
exports), the existing DOM-only rendering remains available.

### What reading view bakes

A rendered note keeps what the post-processor decided until it renders again,
and a registry change does not render it again: `css-change` refreshes the
editors only. Colours ride the stylesheet and `paintIcons` repaints icons and
names in place, but four things are structure:

- whether a name is a callout at all - `.cs-unknown` on the token and the
  heading, and the `data-callout` spelling `calloutDomId` chose;
- whether a token has an icon span - `hideIcon` omits it rather than hiding it;
- whether a token is built in the first place - `shouldRenderToken`;
- which callout an unknown token borrows from - the fallback, and whether it
  hides its icon.

So a `## [!new]` written before its type existed kept the fallback's look after
the type was created, until the note was reopened.
`ReadingStructureWatch` ([`editor/renderRefresh.ts`](../../src/editor/renderRefresh.ts))
closes that, and stays off the hot path: on every registry round (and every
`refreshCallouts`, which is how a reloaded `data.json` arrives) it compares
one signature of the committed rows - ids, aliases, `hideIcon`, theme
ownership, the fallback - so a colour, icon or name edit costs a string
compare. When the signature moved it works out which names did, in
`calloutIdentity` form, and calls `previewMode.rerender(true)` only on the open
notes whose text mentions one. A theme switch that hands hundreds of names to
the theme re-renders the note using two of them, not every open note.

Two things it does not reach: a `![[transclusion]]` inside another note's
reading view (the host's text does not mention the embedded note's tokens),
and a hover preview, which renders fresh each time anyway.

## A published site: one renderer, three hosts

Obsidian Publish, Quartz and Digital Garden render a vault without running its
plugins, so there a heading or inline token is literal text. The third render
surface is [`src/web/core.ts`](../../src/web/core.ts): it finds the tokens in
finished HTML and builds the same DOM the two surfaces above build.

The services differ in *where* code may run, not in what a callout looks like,
and where it runs decides what a feed reader, a search index and a reader with
JavaScript off get to see. So there is one renderer and a **host** per place:

| Host | Runs | Used for | A reader without JavaScript sees |
| --- | --- | --- | --- |
| [`web/browser.ts`](../../src/web/browser.ts) | in the visitor's browser | Obsidian Publish | the text as typed |
| [`web/static/quartz.ts`](../../src/web/static/quartz.ts) | in the Quartz build, on the HAST tree | Quartz 4 and 5, as the Callout Studio Quartz plugin | the callout |
| [`web/static/eleventy.ts`](../../src/web/static/eleventy.ts), wrapped by [`web/static/garden.ts`](../../src/web/static/garden.ts) | in the Digital Garden build, on markdown-it's HTML | Digital Garden, as the Callout Studio garden plugin | the callout |

A host carries no renderer. It imports `core.ts` for its types only and takes
the core as an argument, so each is compiled without it and the exporter joins
the pieces as text (for Quartz and Digital Garden, the release does: each
plugin is built once, not per vault, and reads the vault's snapshot while the
site is built) - see
[Build § The web renderer](20-build-test-release.md#the-web-renderer-four-bundles)
for the bundles and
[Import and export § Three export formats](15-import-export.md#three-export-formats)
for what each service is given.

### What the renderer shares, and what it cannot

It is a port of the reading-view post-processor, not a second copy of the
rules:

- **The grammar is imported.** `RENDERED_HEADING_TOKEN_RE`, the inline scan,
  `matchContentParts`, `parseOutlineHeadingText`, `splitCalloutMetadata`,
  `calloutIdentity` and `calloutTokenLabel` are the same functions. The inline
  scan is reached through `scanVisibleLineForCalloutTokens`, the half of
  `scanLineForCalloutTokens` that takes the visible line as an argument:
  rendered text is its own visible line, so the Markdown lexer stays out of
  the bundle.
- **The class names are imported** from
  [`editor/tokenClasses.ts`](../../src/editor/tokenClasses.ts), a module with no
  imports at all. `renderShared` re-exports it, so nothing else changed; the
  renderer cannot import `renderShared` itself, because that pulls in the icon
  painter and with it `obsidian`.
- **The registry and the icon painter are replaced by a snapshot**
  (`WebBundleData` in [`web/webBundleData.ts`](../../src/web/webBundleData.ts)):
  each callout's id, name, aliases and its icon already painted to markup. The
  renderer rebuilds the registry's three lookups from it - id, alias, attribute
  form, most literal first - and ports `calloutDomId`, so a token resolves, is
  labelled and is stamped exactly as `resolveCalloutDef` does it.

`tests/webExport.test.ts` runs the same markup through reading view (with no
section source) and through the renderer and compares whole elements. That
suite, not this page, is what keeps the two from drifting.

Four things differ, each because of where the code runs:

- **There is no source line.** Reading view asks `getSectionInfo` whether a
  token was escaped. Finished HTML has only rendered text, in which `\[!id]`
  and `[!id]` are the same characters, so an escaped token is drawn as a
  callout - on every host, build-time ones included, since they too run after
  the Markdown was parsed. Inline code is the way to show the literal text.
  This is a documented limitation, not an oversight.
- **The theme is not consulted at all.** `shouldRenderToken` stands down for a
  callout the active theme owns; on a published site that theme is not there,
  so every callout is drawn - with its own definition's icon and colours, not
  the theme's. The export also leaves out the rows only the theme adds, which
  the site then draws as unknown ids. Theme state is a runtime reading of one
  device; see [Import and export § The website export](15-import-export.md#one-snapshot-four-targets)
  for why the files must not depend on it.
- **The page belongs to someone else.** Quartz appends an anchor link to every
  heading and styles it as `h2[id] > a`, and Publish appends a copy-link button.
  `isChrome` recognises that furniture: it never counts as a title, and the
  `cs-heading-title` wrapper stops before it instead of swallowing everything
  after the token, so the child combinator still matches.
- **A block callout may not be a callout yet.** Publish and Quartz have turned
  `> [!tip] Title` into their own element before the renderer runs. Digital
  Garden converts it *later* in its build, by finding that text at the top of
  a `<blockquote>`. So the token that opens a blockquote is never a pill
  (`isBlockCalloutLead`), on any host: by Obsidian's own syntax that position
  is a block callout's header.
- **The block callout is styled, never built.** The renderer leaves the
  site's element exactly as the site made it. The user's colours and icons
  reach it through the stylesheet alone, written per site - see
  [Import and export § Block callouts](15-import-export.md#block-callouts-a-stylesheet-in-each-sites-own-terms).

### Running without a DOM: `web/static/`

The renderer is written against the DOM, and a build has none. Rather than a
dependency every site would have to install, or a second renderer written
against an abstract tree, the build-time hosts give it
[`liteDom.ts`](../../src/web/static/liteDom.ts): a DOM cut down to exactly the
members `core.ts` calls. Selectors are a tag, classes or both, in a comma
list, and anything else throws; a tree walker yields text nodes from a
snapshot.

> [!IMPORTANT]
> **Every DOM member used in `core.ts` must exist in `liteDom`.**
> `tests/webRuntime.test.ts` runs each renderer case over both DOMs and
> compares the results, so using a new member fails there. Add it to
> `liteDom` in the same change.

Two modules stand between `liteDom` and a platform's own tree, and both keep
what they were given so that **a node the renderer did not touch goes back out
exactly as it came in**:

- [`htmlFragment.ts`](../../src/web/static/htmlFragment.ts) turns HTML into a
  `liteDom` tree and back (Digital Garden, and every baked icon). It is not an
  HTML parser in the specification's sense - no implied end tags, no
  namespaces - and does not need to be: an element remembers its own opening
  and closing tags, a text node its own spelling, a comment or a stray
  `</div>` is carried whole. A misreading can cost a callout that stays text;
  it cannot damage the page around it. Text is decoded only as far as it can
  be re-encoded (the entities markdown-it writes, and numeric ones); a text
  node with any other `&` is kept verbatim.
- [`hastBridge.ts`](../../src/web/static/hastBridge.ts) does the same for
  Quartz's HAST. An untouched node is handed back as the very object Quartz
  supplied, with its `position` and `data`; only changed children and the
  properties the renderer set are written. `class`, `data-*` and `aria-*` are
  translated to HAST's `className`, `dataX` and `ariaX`; an icon's SVG
  attributes go out as written, which HAST's own lookups accept.

### Quartz

`quartz(core, node)` returns the factory a site calls - the Callout Studio
Quartz plugin's, holding nobody's callouts. The instance has the shape Quartz
4 and 5 both read (`name`, `htmlPlugins`, `externalResources`), and a filter's
`shouldPublish` beside it, so one plugin serves both; they differ only in how
a site names the plugin. It finds the snapshot in the note Callout Studio
writes, wherever in the content folder it is and whatever a publishing tool
did to its properties, and keeps that note off the site
([Import & export § Quartz: the snapshot as a note](15-import-export.md#quartz-the-snapshot-as-a-note)).

- **Position in the pipeline is the site's to set, and matters.** After the
  plugin that assigns heading ids, so `#tip-title` still derives from the text
  the author wrote and links to the heading keep working. Before Description,
  which computes the search text, the RSS description and the link-preview
  text from the same tree. Placed after it, the host logs one warning.
- **The contents list** is built earlier, from the Markdown, into
  `file.data.toc`. Each entry's `text` is cleaned with the renderer's
  `outlineTitle`; its `slug` is left alone.
- **The stylesheet** goes out through `additionalHead`, as an element built by
  hand (`styleElement`). Not as an inline `css` resource: Quartz renders that
  as the text of a `<style>`, and Preact escapes text, which turns every `"`
  and `&` of the sheet into an entity inside an element that does not decode
  entities.
- **Dark mode** needs no script: `targets.ts` rewrites `.theme-dark` to
  `[saved-theme="dark"]`, Quartz's own attribute, which weighs the same in the
  cascade. The heading band's own rule is weighed up there too, against the
  heading rules of a Quartz 4 theme.

### Digital Garden

Two files. `eleventy(core, data)` is the drawing: given a snapshot, it returns
a `setupMarkdown` that wraps the site's one markdown-it instance's `render`, so
the HTML of every note passes through the renderer.

[`garden.ts`](../../src/web/static/garden.ts) is the Callout Studio garden
plugin's hooks - the one plugin every garden installs, with nobody's callouts
in it - and it finds the snapshot first. The snapshot reaches a garden as a
note ([Import & export § Digital Garden: the snapshot as a note](15-import-export.md#digital-garden-the-snapshot-as-a-note)),
so at config time, before Eleventy reads a note, `garden(core, node)`:

1. walks `src/site/notes/` (from the hook context's `pluginDir`, so a garden
   under a content base folder works too) for notes whose front matter carries
   `callout-studio-web` - at the top or under `dg-note-properties`;
2. tries them in the shared order (the usual path, then by path), skipping one
   whose format is newer than it reads or whose data does not match its
   fingerprint, and takes the first that passes;
3. in `setupMarkdown`, hands that snapshot to `eleventy`;
4. in `setupEleventy`, adds **every** such note to `eleventyConfig.ignores` -
   the note is data, not a page, whether or not it could be read - and, when
   there is a snapshot, publishes its stylesheet: global data
   `calloutStudio = { stylesheet, css }`, plus a virtual template whose only
   output is `{{ calloutStudio.css | safe }}` at
   `/plugins/callout-studio/callout-studio.css`. The rules are data there, so
   Nunjucks never parses a byte of them. The plugin's `head.njk`, in the
   `common.head` slot, links the file when the global is set.

Node is passed in rather than required (`fs`, `path`, `crypto`, the working
directory), because this file is bundled for no platform; the last line of
the plugin's `index.js` passes the real modules. Every outcome that leaves the
callouts as text - no note, a note changed by hand, a newer format - is one
`[Callout Studio]` line in the build log, said once however many hooks run.

That early, rather than as an Eleventy transform on the finished page, because
the garden's feed and search index are both built from the rendered note
before the layout and its transforms run. Heading ids are assigned on
markdown-it's tokens, before any HTML exists, so they still derive from the
original text.

One thing happens before the renderer can see it: the garden's
`markdown-it-attrs` reads `{…}` at the very end of a paragraph, a heading or a
list item as attributes and removes it. `[!note]{my text}` in that position
therefore reaches the renderer as `[!note]` and shows the callout's name. This
is a documented limitation.

A build never fails because of either file: anything thrown is logged once,
and the note - or the garden - goes out as it would have without them.

### In a browser

`browser.ts` adds what a browser needs and a build does not: time.

Tokens are turned only inside a content root - `article`, `main`,
`.markdown-rendered`, `.markdown-preview-view`. A site's navigation, search
results and file tree show note text too, and rewriting a platform's own
widgets is a different promise. A page with no such element gets its whole
body, rather than nothing.

A table of contents (`.toc`, Publish's `.outline-view`) is never pilled. Its
entries are cleaned as text instead: the token is dropped when a title follows
it and replaced by the callout's label when none does. Publish's outline shows
the bracketless form (`!id Title`), which is accepted only when the id names a
real callout - the same ambiguity `OutlineDecorator` resolves against the
file's headings, resolved here against the snapshot.

Every pass is idempotent: a processed subtree holds no token left to turn. That
is what lets one `MutationObserver` on `<body>` stand in for every platform's
event - Publish's lazily rendered sections, its navigation between notes -
with no bookkeeping. It watches text changes as well as inserted nodes, because
a navigation that morphs the page in place rewrites a text node rather than
replacing its element. On Publish the host also registers with
`publish.registerMarkdownPostProcessor`, so a block is turned before it is
painted.

The host styles nothing. The Publish export leaves the stylesheet out of the
script: its rules are in `publish.css`, which the site loads before it paints,
and Publish puts `.theme-dark` on the page itself. Until 2026-11-16 the host
also served a script for any other site, which carried the stylesheet; it
injected it as a `<style>`, and mirrored Quartz's `saved-theme` onto
`.theme-dark` for a Quartz site that loaded that script by hand. Both went
with that target - see [The Another site target](web-target-another-site.md).

## The Outline pane, PDF export, and gradient text

- **`OutlineDecorator`** - see
  [Editor integrations § Outline pane](10-editor-integrations.md#outline-pane-and-link-suggestions).
- **PDF export** clones the rendered DOM but drops the adopted stylesheet, so
  icon artwork for anything but Lucide has to already be baked as **visible**
  DOM (not a CSS mask) - see
  [CSS generation § icon painting](06-css-generation.md#icon-painting).
- **`gradientTitleText.ts`** bakes per-grapheme solid colours for `@media print`,
  because Chromium's print pipeline doesn't honour `background-clip: text` -
  see [CSS generation § gradients](06-css-generation.md#gradients).

## The startup entrance animation

`renderShared.ts` exports a tiny piece of shared state:

```ts
isStartupEntranceActive(): boolean
beginStartupEntranceWindow(doc): () => void   // returns a close/cleanup fn
```

`main.ts` opens this window (for `STARTUP_ENTRANCE_MS = 3000` ms) only when the
UI was **already visible** at load time (mobile, always; desktop, only a
mid-session enable/reload) - see
[Plugin lifecycle](03-plugin-lifecycle.md#startup).
While open, freshly built inline pills, heading bars, and fold chevrons get the
`cs-anim-in` class so they animate in rather than snap. Ref tokens (outline,
links) are deliberately excluded - they render late, well outside any window
where a snap would be visible as a flash.

---
Next chapter: [10-editor-integrations.md](10-editor-integrations.md)
