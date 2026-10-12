# Editor integrations

This covers everything that lets a user *write* callouts and *act* on them:
autocomplete, wrap/unwrap/insert, the built-in commands, custom commands,
the right-click context menu, the two decorators that clean up callout
syntax outside the editor (Outline pane, link suggestions), and the landing
flash a sidebar result plays on the callout it opens.

## `calloutWriter.ts` - the only place a definition becomes markdown

[`src/editor/calloutWriter.ts`](../../src/editor/calloutWriter.ts) is deliberately
narrow: it turns a `CalloutDefinition` into token text for one role, and
**nothing else writes tokens**. Both `AutoComplete` (which knows the id from
what the user picked) and `CustomCommandManager` (which knows it from stored
config) write through here, so the fold mark, the title policy and the
`|metadata` carry-over cannot drift apart between the two entry points.

```ts
buildBlockHeaderToken(def, opts?)   // "[!warning]- Warning" - always titled
buildHeadingToken(def, opts?)        // "[!note]" or "[!note] Title" - no fold mark, keeps existing title
buildInlineToken(def, opts?)          // "[!important]" - never titled, the pill draws itself
buildInlineContentToken(def, content, opts?)  // "[!important]{content}"
foldMarkFor(def): "" | "+" | "-"
splitFoldMark(afterBracket, role)     // the READING half - only "regular" has fold syntax
```

`TokenBuildOptions.foldMark` overrides `foldMarkFor(def)` for one call, and is
read with `??` rather than `||` because `""` is a real answer meaning *no mark,
whatever the definition says*. Only `CustomCommandManager` passes it - a
user-built command carries its own fold state; every other caller leaves it
`undefined` and keeps following the definition. `buildHeadingToken` and
`buildInlineToken` ignore the option entirely, for the reason the note below
gives.

`resolveTitle()` decides whether an existing title survives a type change: an
empty title, or one that merely echoes some *other* callout's display name
(`isKnownDisplayName` callback), is replaced by the new callout's own name -
otherwise a genuine user-authored title is preserved verbatim. This is what
lets picking a different type from autocomplete's dropdown update a
still-default title while leaving a custom one alone.

> [!IMPORTANT]
> **`splitFoldMark` takes `role` as an explicit argument, not an assumption
> baked into the call site.** Only the block role has fold syntax at all -
> `### [!tip]- Title` is the `tip` callout titled `- Title`, and `[!tip]-`
> written inline is a plain pill followed by a literal dash. Reading a fold
> mark off any other role would silently delete a character the user typed.
> Both call sites used to enforce this by *where the call happened to sit* (a
> `token.role` test in one, two early returns in the other) rather than by a
> signature the compiler checks - a rule that lived nowhere and that
> refactoring the returns could quietly undo.

## `CalloutBlockTools.ts` - wrap, unwrap, insert

[`src/editor/CalloutBlockTools.ts`](../../src/editor/CalloutBlockTools.ts) holds
the pure editor-manipulation functions behind the three fixed editor commands and
custom commands. All of it is careful about structure that has nothing to do
with callouts: fenced code blocks, math blocks (`$$`), YAML frontmatter, and
existing nesting.

### `wrapSelectionInCallout` and `wrapRange.ts`

`wrapSelectionInCallout` only writes. What it wraps is decided by `planWrap` in
[`src/editor/wrapRange.ts`](../../src/editor/wrapRange.ts), which returns a
`WrapPlan`: the line range, the container `level` the callout opens inside,
whether the callout is born empty, and whether a blank separator line goes
above or below it. The fixed **Wrap in callout** command, the Quick insert
window, and block custom commands with the wrap action all call it, so they
share every rule below. The user-facing version of these rules is in
[Commands & hotkeys](../user-guide/09-commands-and-hotkeys.md#what-gets-wrapped).

The earlier implementation grew the range through adjacent non-blank lines
with no regard to depth. It then enclosed the result from the outside when
its first line happened to be a callout header. So the cursor in a callout's
first paragraph wrapped the callout from the outside, the cursor in any later
paragraph wrapped from the inside, and a selection in the first paragraph of a
multi-paragraph callout moved the other paragraphs out of it. The rules below
replace that with one model.

**1. The target.** A selection's lines, except that a last line it reaches
only at column 0 is dropped, and so is a first line it leaves at its very end
(both are what dragging over whole lines or Shift+Down leaves). A bare
cursor's line, grown to its paragraph in step 3. A target that starts inside
frontmatter starts after it. A fence under either edge is taken whole. Blank
lines at the edges are dropped. A target made only of blank lines is the
empty case: the callout is written over its first line, at that line's depth.

**2. The level.** A line's level is its `>` depth, minus one when the line is
a callout header, because the header stands for its whole callout, which lives
one level up. The minimum over the target, with interior blank lines
included, is the depth of the innermost quote that holds every target line.
The callout opens inside that quote, and its header gets `level + 1` markers.
A root-level blank line between two callouts is what brings the minimum down
to 0. A header is `[!…]` on the first line of its quote, meaning the line
above is shallower. That rule is `opensCallout` in `quotePrefix.ts`, and
unwrap and `insertEmptyCallout` apply it too. A `[!…]` further down a quote is an inline pill in its
body. So the cursor in a callout's text nests the new callout inside it, and
the cursor on its header encloses it. A plain blockquote has no header, so
wrapping inside one stays inside it.

**3. Growth.** Each edge grows on its own:

- An edge inside a quote nested in the container (depth > level) grows over
  the whole run of deeper lines, which is exactly one nested callout or quote.
  A nested block is never split.
- A bare cursor grows to its paragraph: the run of non-blank lines at the
  container's depth. The run stops at the container's own header and at an
  ATX heading. A heading never belongs to the paragraph under it, and this is
  also what keeps a heading callout written directly above a paragraph out of
  the wrap.
- A selection edge stays where it is if the paragraph may be cut there.
  Otherwise it moves outwards to the nearest line where it may. A cut is
  refused before a line inside a fence, an indented line (a list item's
  sub-items, a footnote's continuation), and a setext underline. It is also
  refused before any line of a table (from its header row to the end of the
  run, since GFM takes every later line as a row) or of an HTML block (after
  its opening tag, to the end of the run).

**4. Separators.** The separator is a blank line at the container's depth:
`buildPrefix(level).trimEnd()`, which is an empty line in the note itself and
`>` inside a callout. It goes above the callout when the line above is
non-blank content of the container (anything except the container's own
header). It goes below when the line below is non-blank at depth ≥ level.
Without them, lazy continuation glues a following paragraph into the callout,
and a header written straight after a line of its own depth becomes a line of
that line's quote. That second failure is the inline-pill bug. A neighbour
shallower than the container is left alone. That is a lazy line after the
container ends, and it stays exactly as lazy as it was.

**5. Requoting.** Every line of the range moves one level below the container:
its first `level` markers become `level + 1`. A blank line gets
`max(depth, level) + 1` markers. So a blank `>` inside a wrapped callout
becomes `> >` and stays inside it, and a blank line between wrapped callouts
becomes the new callout's own paragraph break.

Depth is read by `splitQuoteMarkers` (`quotePrefix.ts`) throughout. It
counts the `>` markers from column 0, each following straight on after at
most one space. A tab or an indented `>` belongs to the list item above it,
so it travels as content instead of setting the line's depth. A line inside a
fence takes the fence's own depth, so callout syntax inside code is never
read as structure. `fenceBlocks.ts` closes a fence only with a marker at its
own depth, and ends it where its quote ends. Without that, a ``` left open
inside a callout would swallow the rest of the note. The lenient
`stripLeadingQuoteTokens` reading is unchanged, because unwrap depends on it
to reach callouts indented under list items.

Not handled: an Obsidian `%%` comment block is not a unit, so an edge can cut
one when the comment contains a blank line. A callout inside a list item
(`- > [!x]`, or an indented `>`) is list content, not a container. Lines are
read by their own `>` count, so a lazy continuation line with fewer markers
ends its quote rather than continuing it.

With no `def` passed, the header is the deliberately unfinished `[!` - the
generic "Wrap in callout" command parks the cursor right there and triggers
the autocomplete popup (see `triggerNow` below). A user-built custom command
already knows its type, so it gets the finished header and no popup.

### `insertEmptyCallout`

On a blank line, the callout replaces that line. On a line with content, it
goes on new lines *below* it. Either way, a blank separator line at the
container's depth goes wherever the callout would otherwise touch a
neighbour:

- **Below**, whenever the next line has content, however shallow it is. The
  bare `[!` header is a paragraph line, so the line after it would join it
  as a lazy continuation. The blank-line case used to skip this, and the
  paragraph under the cursor ended up inside the callout.
- **Above**, always after a line with content. In place of a blank line,
  only when the line above is content of the same container or deeper. The
  container's own header is the exception, because a nested callout may open
  straight under it. Otherwise a callout written over the `>` between two
  sibling callouts would fuse all three into one quote.

A next line that is already blank (`>` counts) gets no second separator.
Depth is read strictly (`splitQuoteMarkers`), the same way wrap reads it,
so a tab-indented list line is not taken as quoted. Frontmatter is never
written into. From inside it, the callout goes onto the first body line when
that line is blank, or else on a new line after the closing delimiter, with a
separator before the body text. A note that is all frontmatter gets the
callout appended.

### `insertHeadingCallout`

Turns the cursor's line into `## [!note] Title` - re-leveling and re-typing an
existing heading in place rather than nesting a second token, and donating a
plain line's text as the title. **Quoted lines are never rewritten** - heading
syntax is column-0-anchored (`HEADING_CALLOUT_RE` is anchored), so a heading
callout inside a blockquote is impossible; the command instead inserts the
new heading *below* the blockquote. Re-typing keeps the heading's own
`|metadata` - a colour written there belongs to the heading, not its old type.

`frontmatter.ts` owns the protected property range. A note containing only
frontmatter gets a new body after its closing `---` or `...`; insertion never
clamps the requested first body line back onto the closing delimiter.

### `insertInlineCallout`

Inserts a plain pill at the cursor, or - when `allowContent` is on, the
selection is non-empty, single-line, and its braces balance - wraps the
selection as the pill's `{…}` label instead. A multi-line or brace-unbalanced
selection deliberately falls back to the plain-pill path rather than producing
a broken pill, because braces cannot span lines or nest with no escape (see
[Render roles § the `{…}` content payload](09-render-roles.md#the--content-payload-inline-pills-only)).
The cursor always lands **after** the pill on the same line - pressing Enter
on an inline suggestion must never break the surrounding paragraph.

### `unwrapCalloutAtSelection`

Walks upward from the cursor's line to find the header of the *innermost*
callout containing it (`findContainingCallout`), strips exactly one `>` level
from every line of its body, and replaces the whole block. Fails with a
`Notice` if the cursor isn't inside any callout.

The header's title stays, as its own line at the container's depth. Only the
`[!type]` token and its fold mark go, which matches what
`calloutsToPlainText` leaves when **Convert uses to plain text** runs on a type.
A header with no title is dropped. `removeQuoteLevel` takes off the first `>`
but keeps whatever indents it, so a callout indented under a list item stays
inside the item. When the line above the header is non-blank text of the same
container, a blank separator is written first; the container's own header is
the exception. Without the separator, the callout's first line would join that
paragraph. This is the mirror of the separators wrap writes.

A header is decided by `isHeaderAt`. It is `opensCallout` on the first line of
its quote, where the line above has fewer `>` markers. Those are counted by
`countQuoteMarkers`, which does not take a bare tab for one. A line inside a
fence is never a header. A `[!…]` further down a callout is body text: taken
for a header, it used to be deleted, and the real callout was left half
unwrapped. The walk itself still reads depth leniently
(`countLeadingQuoteTokens`), so a callout indented under a list item stays
reachable.

## Autocomplete

[`src/editor/AutoComplete.ts`](../../src/editor/AutoComplete.ts) extends
Obsidian's `EditorSuggest`, triggered by typing `[!` in any of the three role
positions.

Historically, autocomplete could be toggled off by the user. As of 2.14.1, this
UI toggle was removed and autocomplete is permanently enabled. The legacy saved
field is normalized to `true` during load, but the trigger path itself does not
consult settings; only the heading and inline role switches can suppress their
respective non-block suggestions.

### Trigger classification

`onTrigger` scans backward from the cursor for the most recent `[!`, then
classifies its position into a role by looking at what precedes it on the
line:

| Text before `[!` | Role |
| --- | --- |
| `>`, `>>`, … (optionally with spaces) | `regular` - native block header |
| 1 - 6 `#` + whitespace, nothing else | `heading` (popup suppressed if `headingCallouts.enabled` is false) |
| nothing (bare line start) | `inline` if enabled, else legacy `regular` fallback |
| any other text | `inline` (popup suppressed if `inlineCallouts.enabled` is false) |

The classification is `readCalloutTrigger` in
[`calloutTriggerContext.ts`](../../src/editor/calloutTriggerContext.ts), shared
with the metadata dropdown. It captures the **whole token body**, independent of exactly where the cursor
sits inside it - reading only up to the cursor would mis-filter a mid-token
cursor (`[!dang⎸aaaaa]` would otherwise match "Danger" instead of offering
"Create new: dangaaaaa"). The popup **closes** once the cursor moves past the
id into metadata, the fold mark, or title text - none of those are the type
dropdown's business; the metadata has a dropdown of its own (below). A code-context check (`isCalloutTokenInCode`) runs
**last**, deliberately, since it's the only check that reads past the current
line and by that point the cursor is already known to sit inside a token.

### Suggestions and "Create new"

`getSuggestions` filters `registry.getAll()` by id/display-name/alias
substring match, excluding fallback rows the last prune scan **confirmed**
have zero vault usage (`isKnownZeroUsageFallback`) - a row that's genuinely in
use elsewhere but never adopted through the editor still autocompletes
normally. A non-empty query with no exact id/alias match appends a synthetic
"Create new: …" row.

Picking "Create new" opens `CalloutEditor` pre-filled with the typed name and
awaits the result. Both block and heading creation preserve the current title
after the token, including metadata and titles edited while the modal is open;
only block titles strip the old fold marker before applying the new defaults.
Because the modal can sit open for an arbitrary amount of
time (minutes, if the user steps away), every position captured before that
`await` is treated as **stale** and re-validated against the *live* document
via `liveTriggerLine()` - checking the editor still belongs to the same file
and that the `[!` is still exactly where it was. If not, a Notice explains the
target moved rather than silently corrupting an unrelated part of the note
(or a different note entirely, if the leaf was reused). This mirrors the same
"recompute from the live document" discipline the context-menu section
operations follow.

### Where the cursor lands after a pick

`selectSuggestion` writes the token and then hands the cursor to
[`autoCompleteCursor.ts`](../../src/editor/autoCompleteCursor.ts). The rule is
the one Enter follows at the end of the line, and it depends only on the role
and on whether the pick finished a new callout. The callout's source (built-in,
user, theme, fallback) and the characters in its id play no part:

| Pick | Cursor lands |
| --- | --- |
| Block, no title yet | on a **new** `> ` line under the header, at the header's own depth |
| Block, body already on the next line (what **Wrap in callout** leaves) | at the start of that body |
| Heading, no title yet | on a **new** plain line under the heading (a heading callout has no body) |
| Block or heading whose type was changed (a title was already there) | at the end of that line |
| Inline | after the pill and one space, on the same line |

The line under a new block or heading callout is always *opened*, never
borrowed. Quoting the blank line that separates the callout from the next
paragraph would leave the two touching, and the first word typed would pull
that paragraph in as a lazy blockquote continuation. For the same reason a
shallower or unquoted line below is never re-prefixed into the callout.
"Create new" lands exactly like a picked row once the modal returns.

The block and heading placements are deferred a frame plus 50 ms: Obsidian
restores its own selection as the popover closes and would otherwise overwrite
them. The inline placement is synchronous.

> [!IMPORTANT]
> **`selectSuggestion` closes the popover itself.** Obsidian's suggest manager
> re-runs every registered suggest on the rewritten line and closes the current
> one only if *none* claims it. Another plugin's can: Admonition's `> [!`
> suggest matches ids as `\w+`, so `[!בדיקה]` or `[!my-note]` still looks
> like an open token to it. While the placement waited for that close, callouts
> with such ids kept the popover open and left the cursor where the rewrite
> dropped it, just before `[!`. ASCII-only ids (every built-in) were unaffected.

### Tab and `|` - accepting without finishing

Enter finishes the callout; most people never write metadata, and that stays
untouched. Two more keys accept the highlighted row, bound on the popover's
`scope` exactly as Obsidian's own link suggest binds Tab, `#` and `^` (verified
in its bundled `app.js`): the binding hands the event to the internal
suggestion list's `useSelectedItem`, so `selectSuggestion` sees `evt.key`
(`editor/suggestKeys.ts`). `suggestions` is not in `obsidian.d.ts` and is read
optionally - without it the keys fall through to what they would have done.
`|` is registered under any modifiers (it is Shift+\\, Option+7 or AltGr
depending on the layout) but declines under Cmd, or under Ctrl without Alt:
that is a hotkey, not typing.

| Key | Writes | Cursor |
| --- | --- | --- |
| Tab | the id's own characters only (`replaceTypeText`) - existing metadata, fold mark, title and `]` untouched; an unclosed token stays unclosed | before the `]`, after any metadata; without a `]`, after the id and its metadata (`parkCursor`) |
| `\|` | completes a half-typed id the same way, then types a `\|` after it - or steps over the `\|` already there; `triggerNow` opens the metadata dropdown | after the `\|` |
| `\|` with nothing to complete - **Create new**, a row whose id does not start with the typed text, an id already typed in full (its spelling kept), nothing typed yet, a cursor mid-id | nothing but the `\|`, exactly as without the dropdown | after the `\|` |

Neither key ever rewrites the `]`. Obsidian's bracket pairing (CodeMirror's
`closeBrackets`, on by default as **Auto pair brackets**) steps over a typed `]`
only while it still tracks the `]` it inserted itself, and replacing that
character - even with an identical one - drops the tracking: a user typing
`> [!note|wide]` by hand got `> [!note|wide]]`. For the same reason neither key
adds a missing `]`; the user is about to type it.

`parkCursor` sets the cursor at once and re-asserts it after the popover's
close-and-restore frame, but only while the line is unchanged, so a fast next
keystroke keeps both its text and its cursor. Neither dropdown sets
`setInstructions`: the keys are in the user guide, not in a footer. Tab on
**Create new** lands the way Tab on a row does once the modal returns.

### Metadata suggestions after the pipe

[`CalloutMetadataSuggest`](../../src/editor/CalloutMetadataSuggest.ts) is a second
`EditorSuggest`. Both read the token through one reader,
[`calloutTriggerContext.ts`](../../src/editor/calloutTriggerContext.ts), so role
classification, escapes and the code check cannot disagree. Their claims are
disjoint by construction - the type dropdown answers up to the end of the id,
this one past the first `|` and up to the `]` - so Obsidian's manager, which
asks every suggest in order, only ever finds one. Both are skipped by
`LinkSuggestDecorator`.

What it offers and what each pick writes is pure
([`metadataSuggestions.ts`](../../src/editor/metadataSuggestions.ts)):

- **Colours** - saved palettes, Obsidian's and the extras together, filtered on
  the word, the translated name and the aliases. None for a theme-owned
  callout.
- **Order**: each group (the colours, then each source's words) is sorted on
  its own - a prefix match before a match inside the word, then A→Z by the word
  written (`textComparator` from `utils/sorting.ts`, built once per call since
  a theme can bring hundreds of words). Groups are never merged into one A→Z.
- Matching forgives a name's joints: dashes, underscores and spaces are ignored
  when comparing, and a *joined reading* takes in up to three words before the
  cursor when only spaces part them, so `comic re` finds `comic-red`, ranks
  ahead of every plain match, and the pick (`joinedFrom`) rewrites all of it. A
  `|` is never read across.
- **The styling's words**, grouped by source, from `ThemeMetadataCatalog` (the
  active theme, then enabled snippets - see
  [18-theme-callout-discovery.md](18-theme-callout-discovery.md#metadata-words)),
  minus any that could not work at the cursor: `alone` beside other words,
  `first` anywhere but first, a word guarded to another callout id, a word
  already present. A word a colour row already writes is not repeated; the
  colour row says the theme reacts too.
- Once the metadata names a colour, the styling's words lead and every colour
  row **replaces** it (`applyMetadataPick` swaps the old word in place and drops
  the typed one with its separator), so the UI never stacks two colours.
- **Done** heads the list on an empty word after a separator that follows a
  word, so Enter there finishes (dropping the trailing separator) instead of
  breaking the line inside `[!…]`. **Use "…"** appears for a word nothing matches
  exactly, always last - even when the typed text only turns up inside a
  longer word (`width-50` for `50`), the matching rows come first.
- **The colours and the styling's words come from the injector**
  (`cssInjector.metadataColorEntries()`, `cssInjector.metadataCatalog`), the
  same list and scan the stylesheet uses, so a colour the stylesheet stands down
  on (a word the user's own snippet styles) is never offered as one.
- A `spaced` word (one the stylesheet matches with `~=`) turns a `|` touching
  it into a space - that operator never sees across a pipe. The first `|` is
  outside the metadata and never touched.

Each row is one line: a colour's word in its accent beside the editor's
`renderColorCircles` (a third circle for a gradient), a styling word in code
type. `metadataRowHeadings` puts a sticky heading over each group - **Colors**,
the theme's name, each snippet's - but only when the visible rows (after the
50-row cut) come from two groups or more. The headings are siblings of the
rows inside Obsidian's `.suggestion` list, which only walks the elements it
created, so arrow keys pass them by. What a row needs (spacing, first/last,
alone, which colour it replaces, the theme reacting too - and for a colour
with nothing more pressing, that spaces and `|` both work) is not on the row: a
line at the bottom of the popup shows it for the highlighted row only, fed by
the undeclared `onSelectedChange` hook Obsidian's list calls on its owner (by
key, by hover and on opening). The line is always there, with its top border,
and stays one line tall when the row needs nothing (`:empty::before` holds a
zero-width space), so the popup does not jump as the highlight moves onto
**Done** or a word with no rule. It is our own element, appended
to the suggestion container, so phones (which hide `.prompt-instructions`)
show it too.

Tab writes the word and parks in the brackets; the spot is remembered
(`lastPick`) and passed over until the line or cursor moves, so the very next
check does not re-offer the word just written. Enter writes it and finishes
through the same writers and `placeCursorAfterPick` landing as Enter on a type,
keeping a title and fold mark the user wrote. Like the type dropdown, it closes
itself before writing (the Admonition note above).

### `triggerNow` - opening the popup for a programmatically-inserted `[!`

The "Insert empty callout" and "Wrap in callout" commands insert `[!` and want
the suggestion popup to open immediately - but Obsidian's `EditorSuggest`
manager only calls `onTrigger` on real keystrokes. `triggerNow` routes through
the workspace's internal `editorSuggest.trigger(editor, file, true)` (rather
than calling `this.open()` directly) specifically so the popup registers as
the manager's `currentSuggest` and behaves exactly like a natively-typed `!`
 - it follows scroll and auto-closes on delete, neither of which a
directly-opened popover would do.

## Built-in commands and availability

[`src/editor/commands.ts`](../../src/editor/commands.ts) owns every built-in
command id and the list rendered by **Manage commands**. It deliberately does
not register one command per callout type, which would flood the command palette
with hundreds of entries. `show-callout-occurrences` is included in that same
list even though its view and navigation implementation live under `src/usage/`.
The ids are the source of the `FixedCommandId` type; the total name-key record
and the command builder's exhaustive switch make a missing label or
implementation a TypeScript error. A source rule in
`tests/customCommandSync.test.ts` also restricts built-in `addCommand()` calls
to this module, so a new static registration cannot silently bypass the list.

```ts
FIXED_COMMAND_IDS = [
  "open-settings", "create-callout", "insert-empty-callout",
  "callout-wrap", "callout-unwrap", "open-quick-insert",
  "show-callout-occurrences",
]
```

Obsidian only offers a command with `editorCallback` in the Command Palette
when an active Markdown editor is available. The three text-editing commands
use that callback: **Insert empty callout**, **Wrap in callout**, and **Unwrap
from callout**. They therefore disappear in Reading view and when focus is in
a surface without an active note editor. The settings command-builder's
embedded preview deliberately reports preview mode, so these editor commands
are unavailable while focus is in that preview too; treating it as an editor
would let a command write into the preview instead of the user's note. Open a
note in Live Preview or Source mode and focus its text to make them available.

The other built-ins use plain `callback`s and can appear without an active
editor: **Open settings**, **Create new callout type**, **Quick insert block
callout**, and the **Find callouts** command (shown as
**Callout Studio: Find callouts** in the Command Palette).
**Manage commands** lists all built-ins regardless of whether Obsidian currently
considers their execution context available. Hotkeys are also bound independently
of the active editor context.

> [!IMPORTANT]
> **These ids are a stable API - never rename one.** Users may have hotkeys
> bound to them; a rename orphans the binding. `tests/repoRelease.test.ts`
> pins the exact set and order.

Each user can individually disable a built-in command
(`settings.disabledFixedCommands`); `setFixedCommandEnabled()` calls
`plugin.removeCommand()` / `plugin.addCommand()` directly, immediately, rather
than merely hiding the command - this is what removes it from the command
palette *and* the hotkeys pane, not just from view. Obsidian only clears a
removed command's **default** hotkeys on `removeCommand`, never the user's own
binding, so re-enabling restores it instantly.

Because Obsidian keeps a user's binding under the command id while the command
is removed, disabling a command does not free its shortcut. If the same key is
assigned to another command while it is off, re-enabling restores both saved
bindings. The plugin does not rewrite Obsidian's hotkey store; users who want to
reuse a key should clear the old binding in Obsidian's Hotkeys settings before
assigning it elsewhere.

`refreshFixedCommandNames()` re-registers a command **at the same id** whenever
its rendered name changes (a locale arriving mid-session, or the user changing
language) - same-id re-registration is what keeps the hotkey bound, since
Obsidian keys bindings by command id, not by the registered object.

## Quick Insert targets

Quick Insert captures the `MarkdownView`, `Editor` and `TFile` together.
Before inserting, all identities and leaf membership must still match; a
reused view, closed leaf or replaced editor produces a refusal instead of
redirecting the edit to the active note. A mode-only change retains the
specific Reading view message. With no captured note, normal resolution applies.

The first modal starts with the default `all` source filter. Changing the
source is remembered on this device (`localState.setQuickInsertSource`), never
saved to the synced settings, and later modals restore that choice; a device
with no memory starts from the synced `settings.quickInsertSource`. The filters use the same style-owner precedence as the settings lists:

```text
registry.themeOwns(def) → theme
otherwise def.builtIn   → builtin
otherwise               → user
```

The toolbar includes `theme` only when
`usable.some((def) => registry.themeOwns(def))`. If `theme` is remembered while
that option is unavailable, the modal uses `all` as its effective filter without
overwriting the saved preference.

The live ownership check is essential: `source: "theme"` finds a row minted
from a stylesheet, but cannot find a built-in or saved row the active theme has
temporarily taken over. The three buckets are therefore mutually exclusive,
and switching themes can move a row without mutating its definition. With a
blank query, an empty visible bucket gets a source-specific explanation; once a
query is present, every empty result uses the ordinary no-match message.

## `CustomCommandManager` - one idempotent sweep

[`src/editor/CustomCommandManager.ts`](../../src/editor/CustomCommandManager.ts)
is worth understanding in depth because its whole design follows from one
constraint: `registry.onChange` carries **no payload**, and a callout id
"rename" is really `remove()` followed by `add()` - so no per-event handler
can distinguish a delete from a rename from an unrelated colour tweak.

```ts
syncAll(): void
```

`syncAll()` **re-derives the entire desired command set from scratch** every
time it runs, rather than reacting incrementally to what changed. This single
design choice is what makes delete, manual discovery, edit, import, startup, and
plugin re-enable all fall out of the *same* code path with no special-casing:

1. Sanitize the stored list (`sanitizeCustomCommands` - drops structurally
   malformed entries).
2. Keep valid commands whose `calloutId` is temporarily absent in saved settings,
   but pause their registration until the target is restored.
3. Compute the desired Obsidian command name for every available target
   (`describeCommand`, built from the callout's **current** display name).
4. Unregister anything currently registered that's no longer desired.
5. Register (or **re**-register) anything whose desired name differs from
   what it's currently registered under.

`run()` resolves the command's fold state at *run* time, alongside its action,
and passes the resulting mark to `wrapSelectionInCallout` /
`insertEmptyCallout` as `foldMark`. It is passed even when it is `""`, which is
the point: that is what overrides a callout whose stored `foldable` would
otherwise add a `+` the command's own dropdown says it does not want. Both block
actions get it - they write the same header line - and neither of the other two
roles does. See [`CustomCommand`](04-data-model.md#customcommand) for the
absence-means-`"none"` rule that keeps older commands writing what they always
wrote.

> [!IMPORTANT]
> **Three invariants make this correct, and each one had to be deliberately
> engineered:**
> - **A command's `id` is minted once and never derived from its content**
>   (`generateCommandId()` - a timestamp+random string). Obsidian keys the
>   user's hotkey by the *command id*, and `removeCommand` only clears
>   *default* hotkeys - so editing a command's callout, role, or heading level
>   must never touch this id, or the binding orphans.
> - **Only a changed rendered name triggers re-registration.** An icon or
>   colour edit leaves the command's name identical, so it costs nothing; a
>   `displayName` edit changes the name, so the palette label stays accurate.
>   This matters because `addCommand` **mutates its argument in place** and
>   appends its own unload callback - calling it needlessly accumulates
>   garbage.
> - **Rename is the one thing a sweep genuinely can't infer**, because by the
>   time `syncAll()` runs, the old id is simply gone from the registry - there's
>   nothing left pointing commands at it. `CalloutEditorSave` wraps its rename
>   (`remove` + `add`) inside `registry.batch()` and calls
>   `customCommands.migrateCalloutId(oldId, newId)` **inside that same batch**,
>   before the batched `onChange` fires - so the sweep that follows sees a
>   consistent world where every command already points at the new id.

Discovery's prune pass explicitly checks `hasCommandFor(id)` before removing
an unused fallback row - a custom command referencing a callout is a
deliberate claim on it, exactly like `customized: true`. See
[Vault discovery](11-vault-discovery.md).

## The right-click context menu

[`src/editor/contextmenu/`](../../src/editor/contextmenu/) is split into three
concerns: **injection** (`index.ts`), **target resolution** (`resolve.ts`),
and **item construction** (`items.ts` + `sectionOps.ts`).

### Injection: three independent paths into Obsidian's `Menu`

```ts
registerContextMenu(plugin): void
```

Because Obsidian doesn't expose one reliable hook for "user right-clicked a
callout," this hooks **three** paths simultaneously, all funneling into the
same `maybeAddItems` guard (deduplicated per-menu via a `WeakSet`):

1. **`workspace.on("editor-menu")`** - the primary, most reliable path for
   Source mode and Live Preview.
2. **A monkey-patched `Menu.prototype.showAtMouseEvent`** - catches menus
   opened outside the `editor-menu` event, notably Reading view.
3. **A monkey-patched `Menu.prototype.showAtPosition`** - catches
   touch/keyboard-opened menus, matched against the most recent captured
   pointer event by **position tolerance (12px) and age (750ms)**, since a
   position-only call carries no target element of its own.

A capture-phase `contextmenu` listener on `activeDocument` keeps a
`lastTrigger` snapshot (target element, click coordinates, timestamp) fresh
for all three paths to consult. The monkey-around patch is uninstalled via
`plugin.register(uninstallPatch)`, so it never survives unload.

### Resolution: three roles, most-specific-first

```ts
resolveContext(plugin, trigger) =
  resolveInlinePillContext(...) ?? resolveHeadingContext(...) ?? resolveRegularContext(...)
```

Inline pills are checked first (their DOM - `.cs-inline-callout` - is
identical between Live Preview and Reading view), then heading callouts, then
the native block callout (which itself tries the CodeMirror widget, editor
coordinates, and reading-view DOM, in that order - unchanged from the
pre-multi-role implementation). A content pill's own links get special
treatment: `resolveInlinePillContext` explicitly bails if the click landed on
an `<a>` inside the pill's payload, so right-clicking a link *inside*
`[!warning]{see [docs](url)}` opens Obsidian's own link menu, not the callout
menu.

### Item construction: config-driven, per role

```ts
BUILDERS: Record<CalloutRenderRole, Partial<Record<ContextMenuItemId, ItemBuilder>>>
```

`addItems()` walks `settings.contextMenu.items[role]` (the user's saved order
+ enabled flags - see `DEFAULT_CONTEXT_MENU_ITEMS` in `constants.ts` and the
merge logic in `settingsMerge.ts`) and invokes whichever builder exists for
each id on that role. An id with no builder for a given role (e.g.
`copyMarkdown` on `heading`) is simply skipped - one config shape covers ids
that only make sense for some roles.

- **`edit`** is the stable persisted id for one adaptive create/edit action.
  It resolves through `resolveCalloutDef` (the same ladder the renderer uses)
  rather than a plain lookup - so right-clicking `[!a-b]` written for the
  callout `a b` edits that definition. A genuinely unknown id merely borrows
  the fallback's *appearance*, not its identity, so the same configured action
  instead opens a new editor seeded with the token's exact normalized id.
- **Block-role `foldDefaults`** offers the *other two* fold states (never the
  current one) - open / closed / non-collapsible - by rewriting the header's
  fold mark in place.
- **Heading-role section operations** (`cutSection`/`copySection`/`deleteSection`)
  compute the section range via `getHeadingSectionRange` in
  [`sectionOps.ts`](../../src/editor/contextmenu/sectionOps.ts): the heading line
  through everything up to (not including) the next heading of the same-or-higher
  level. `sectionBoundary.ts` uses the current document's native fold service
  when available; the source-only fallback excludes frontmatter, length-aware
  code fences, raw HTML, math and comments, and recognizes indented ATX/setext boundaries.
  A hash-prefixed line inside a code fence never cuts a section in half.
  Without a following section it reaches end-of-document. Cut first awaits clipboard success, then checks
  that the complete document and captured file/editor/leaf ownership still match;
  a clipboard error or intervening change leaves the note untouched. These
  are single editor transactions - undo works
  through the editor's own history, no confirmation modal needed (unlike
  converting every use of a callout type to plain text, a vault-wide rewrite
  guarded elsewhere - see [Vault discovery](11-vault-discovery.md#convert-flow)).

### The context menu inside a read-only preview

The settings previews host a *real* embedded Obsidian editor, so they get
Obsidian's real editor context menu - and none of its editing commands was ever
stopped by `EditorState.readOnly` (see
[Callout editor](14-callout-editor.md#why-read-only-needed-two-layers)). A user
could right-click the splash screen and turn its sample into a bulleted list, an
H1, a table or a code block.

[`readOnlyPreview.ts`](../../src/editor/contextmenu/readOnlyPreview.ts) handles the
menu half. `maybeAddItems` asks `isReadOnlyPreviewTarget(trigger.targetEl)`
first, and when it answers yes:

- `stripEditingItems(menu)` removes every item whose section is editing-only -
  `selection-link`, `insert`, `correction`, `spellcheck`, and anything under
  `selection.format`, `selection.paragraph` or `selection.insert`. That is the
  whole Format / Paragraph / Insert set.
- **None of this plugin's own items are added.** The fold-marker and
  cut/delete-section builders write through `context.editor`, which in a preview
  is the preview's own editor - and the block-callout resolver reaches inside
  one regardless of `view`, via the `.cm-callout` widget path, so this is a real
  route rather than a hypothetical one.

Three details are load-bearing:

- **The check runs *before* the `settings.contextMenu.enabled` gate.** Whether
  this plugin adds menu items and whether a preview is immutable are unrelated
  questions; answering them in the other order would make immutability
  something a user could switch off by accident.
- **Sections, not titles.** The section strings are Obsidian's own identifiers,
  so the filter holds in every language. A rename in a future Obsidian version
  degrades to the menu showing items that no longer do anything - never to a
  crash, and never to a mutable preview, because the transaction filter is the
  guarantee.
- **`Menu.sort()` runs inside `showAtPosition()`**, i.e. *after* the
  `showAtMouseEvent` / `showAtPosition` patches above. At that moment `items` is
  complete and nothing has been rendered, so filtering the array in place is
  enough - no DOM surgery, and a section left empty takes its submenu header
  with it.

`clipboard` is kept whole on purpose. Copy and Select all are exactly what a
read-only preview should still offer; Cut and Paste stay visible and are now
inert, so they explain themselves with "The live preview can't be edited"
rather than sitting greyed out. `selection` (Edit link / Edit tag) only moves
the selection, and the link/open/info/view sections are what make the splash
screen's **Learn more** link work.

Everything keys off `.cs-live-preview-editable`, the class `LiveCalloutPreview`
adds only on the embedded-editor path. Notes, and the preview's own static
fallback, are untouched by construction.

## Outline pane and link suggestions

Two decorators clean up how heading-callout tokens appear **outside** the note
that contains them.

### `OutlineDecorator`

[`src/outline/OutlineDecorator.ts`](../../src/outline/OutlineDecorator.ts)
rewrites Obsidian's Outline pane, whose `HeadingCache`-based rendering shows
`## [!tip] My Title` as the raw `!tip My Title` (brackets stripped, nothing
else). Because the Outline view has no typed public API, this attaches **one
`MutationObserver` per open outline leaf** rather than patching anything, and
treats the pane's own re-renders (file switch, metadata change, search
filter, virtual-tree churn) as the signal to reprocess
(`attachAll()`/`refreshAll()`, coalesced into one pass per animation frame via
`schedulePass`).

Every rewrite stamps the item with `data-cs-orig`, the untouched original
text - this is what makes disabling the feature, or unloading the plugin,
restore the pane to exactly what core would have shown, rather than leaving
stale decorated text behind. `destroy()` runs a restore-only pass on every
attached leaf before disconnecting its observer.

Ambiguity handling: an outline item's bracketless text (`!bug Title`) is
inherently ambiguous between a real `# [!bug] Title` heading and a heading
literally written `# !bug Title` - `parseOutlineHeadingText` reports a
`bracketed` flag, and this file only trusts a bracketless match after
confirming it against the file's own raw heading text
(`SourceHeadings.bracketedIds`/`literalIds`), computed once per file.

### `LinkSuggestDecorator`

Installed on `workspace.onLayoutReady` (so Obsidian's core link suggester
already exists) and explicitly **excludes this plugin's own two suggests** (the
type dropdown and the metadata dropdown) from the suggesters it wraps, because that one already renders callout
suggestions itself and doesn't need cleanup. It cleans the `[[#` heading-link
popup the same way the Outline pane is cleaned - stripping the raw `[!id]`
token from the displayed suggestion text.

It also wraps `selectSuggestion`, for one case: a title-less heading
(`## [!tip]`). Core would insert `[[#[!tip]]]`, whose `]]]` run its own parser
cuts at the first `]]` (see
[Title-less and aliased reference links](09-render-roles.md#title-less-and-aliased-reference-links)).
So after core's insert, the wrapper adds the callout's display name as the
alias: `[[#[!tip]|Tip]]`.

- It reads the suggest's `context` before calling the original, because core's
  link suggester closes itself, clearing it, before it inserts.
- It finds the link by the context's start minus two (the `[[`), not by the
  caret, which sits wherever the accepting key left it.
- It requires the exact shape `findWikilinkCalloutRefs` calls a title-less
  reference closing its link. A `#` pressed to continue into a sub-heading, or
  an alias core kept from the text after the caret, never matches.
- Tab selects the inserted name, as core does for an alias it inserts. Enter or
  a click leaves the caret after the link. A `|` key press is left alone, since
  the user is about to write an alias of their own.
- It does nothing while title cleaning is off, for a theme-owned callout, or for
  a name an alias cannot carry: one containing `|`, `[[`, `]]` or a newline, or
  ending in `]`. That last one would rebuild the `]]]` run.

Core and wrapper write in two transactions, but one Undo takes back both.

## Landing flash

[`src/editor/calloutFlash.ts`](../../src/editor/calloutFlash.ts) is how Find
callouts and Review conversion show where a result landed. Navigation
(`ui/sidebarNavigation.ts`, see [Vault discovery](11-vault-discovery.md)) leaves
the selection alone, because a caret anywhere inside a callout makes Live Preview
show its raw Markdown. `revealCalloutInEditor(editor, lines, range, delayed)`
scrolls to the callout and lights it up instead.

**Extent.** [`editor/calloutExtent.ts`](../../src/editor/calloutExtent.ts) turns
the result's token range into what the callout covers:

- an inline pill: its token plus any `{…}` payload (`tokenEnd`);
- a heading callout: its line;
- a block callout: its header down to the first blank line, or the first line
  quoted shallower than the header (the rule `findContainingCallout` in
  `CalloutBlockTools.ts` uses);
- a range that is no callout token (a link a conversion repairs): a plain span.

Cursor-follow uses the same module, so "what the flash covers" and "the caret is
inside it" cannot disagree.

**One dispatch.** The function sends three things in a single transaction:

1. `unfoldEffect` for any fold hiding the callout's start. The target's own fold
   is left alone, so a folded heading callout stays folded.
2. `EditorView.scrollIntoView(EditorSelection.range(end, start), { y: "center" })`.
   With the head before the anchor, CodeMirror centres a range that fits and
   aligns a taller one by its top; core's own search highlight passes its range
   reversed for the same reason.
3. `setCalloutFlash`.

An editor without `editor.cm` falls back to `editor.scrollIntoView` with the same
reversed range, and gets no flash.

**Two ways to reach the rendered callout**, because CodeMirror owns one kind of
DOM and Obsidian the other:

- `calloutFlashField` (a `StateField`, mapped through edits) decorates lines and
  inline ranges. It puts `cs-callout-flash-line` on each line and
  `cs-callout-flash-mark` over an inline span. CodeMirror's mark wraps an inline
  pill's replace widget, so `.cs-callout-flash-mark > .cs-inline-callout` reaches
  the pill. **Never add a class to a `.cm-line` by hand**: CodeMirror rewrites
  line attributes it did not set.
- A Live Preview block callout is Obsidian's own block widget
  (`.cm-embed-block.cm-callout`), which line decorations cannot reach. The
  companion view plugin waits up to about 20 frames for the scrolled-to widget to
  be drawn. `renderedBlockCallout` then picks the nearest widget above the target
  and checks that the target lies within it. It indexes the target's nested
  `.callout` by counting headers (`isBlockHeaderLine`) in between, and confirms
  the match against `data-callout` (`obsidianCalloutAttrId`). On a mismatch it
  falls back to the outer callout. The view plugin adds `cs-callout-flash`
  directly to that element, since CodeMirror ignores DOM changes inside a widget.

The same view plugin owns the clear timer: `FLASH_MS`, plus `FLASH_DELAY_MS` when
a phone's drawer is closing. It removes the widget class when a flash ends or a
new one replaces it. A second reveal while a flash still shows clears it, then
sets it again two animation frames later. The first frame paints the element
without the class; otherwise the browser would never see the class go and would
not replay the animation.

**CSS** (`styles.css`, "Landing flash") is paint-only:

- A ring: an *inset* outline, so core's `.cm-embed-block:hover { overflow: hidden }`
  cannot clip it.
- A tint: an inset `box-shadow`. A callout whose border style pins
  `box-shadow: none !important` (`css/transparentBorder.ts`) keeps the ring alone.
- No pop. A `transform: scale()` swell was tried and dropped: a wide block grew
  past the editor's edges and was clipped, and a heading bar, being a measured
  `.cm-line`, could only pop a `::after` overlay whose growth nobody could see,
  so only its ring showed. A ring and a tint change no box's size or position,
  so the same two layers sit directly on a block's `.callout`, a heading's
  `.cm-line` and an inline pill. Do not add a transform back to any of them:
  CodeMirror measures the block widget's root and every `.cm-line`.
- The colour is `--cs-accent`, then `--callout-color` (a full colour in 1.14),
  then the accent.
- A phone's delay is the `--cs-flash-delay` variable that every `animation`
  shorthand reads. An `animation-delay` would be reset by those heavier shorthands.
- Reduced motion needs no rule: nothing moves, and the colour fade is what says
  where you landed.

`FLASH_MS` and `FLASH_DELAY_MS` must stay equal to the keyframe durations in the
stylesheet.

The note's header title may also blink grey for an instant when a card is
clicked. That is not part of the flash: core dims the title while the sidebar's
leaf is active, and navigation hands the leaf back to the note a moment later.
It is expected; see
[Vault discovery](11-vault-discovery.md#read-only-occurrence-index-and-navigation)
for why it has no fix.

---
Next chapter: [11-vault-discovery.md](11-vault-discovery.md)
