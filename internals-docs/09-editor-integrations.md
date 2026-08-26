# Editor integrations

This covers everything that lets a user *write* callouts and *act* on them:
autocomplete, wrap/unwrap/insert, the five fixed commands, custom commands,
the right-click context menu, and the two decorators that clean up callout
syntax outside the editor (Outline pane, link suggestions).

## `calloutWriter.ts` — the only place a definition becomes markdown

[`src/editor/calloutWriter.ts`](../src/editor/calloutWriter.ts) is deliberately
narrow: it turns a `CalloutDefinition` into token text for one role, and
**nothing else writes tokens**. Both `AutoComplete` (which knows the id from
what the user picked) and `CustomCommandManager` (which knows it from stored
config) write through here, so the fold mark, the title policy and the
`|metadata` carry-over cannot drift apart between the two entry points.

```ts
buildBlockHeaderToken(def, opts?)   // "[!warning]- Warning" — always titled
buildHeadingToken(def, opts?)        // "[!note]" or "[!note] Title" — no fold mark, keeps existing title
buildInlineToken(def, opts?)          // "[!important]" — never titled, the pill draws itself
buildInlineContentToken(def, content, opts?)  // "[!important]{content}"
foldMarkFor(def): "" | "+" | "-"
splitFoldMark(afterBracket, role)     // the READING half — only "regular" has fold syntax
```

`resolveTitle()` decides whether an existing title survives a type change: an
empty title, or one that merely echoes some *other* callout's display name
(`isKnownDisplayName` callback), is replaced by the new callout's own name —
otherwise a genuine user-authored title is preserved verbatim. This is what
lets picking a different type from autocomplete's dropdown update a
still-default title while leaving a custom one alone.

> [!IMPORTANT]
> **`splitFoldMark` takes `role` as an explicit argument, not an assumption
> baked into the call site.** Only the block role has fold syntax at all —
> `### [!tip]- Title` is the `tip` callout titled `- Title`, and `[!tip]-`
> written inline is a plain pill followed by a literal dash. Reading a fold
> mark off any other role would silently delete a character the user typed.
> Both call sites used to enforce this by *where the call happened to sit* (a
> `token.role` test in one, two early returns in the other) rather than by a
> signature the compiler checks — a rule that lived nowhere and that
> refactoring the returns could quietly undo.

## `CalloutBlockTools.ts` — wrap, unwrap, insert

[`src/editor/CalloutBlockTools.ts`](../src/editor/CalloutBlockTools.ts) holds
the pure editor-manipulation functions behind both the five fixed commands and
custom commands. All of it is careful about structure that has nothing to do
with callouts: fenced code blocks, math blocks (`$$`), YAML frontmatter, and
existing nesting.

### `wrapSelectionInCallout`

Given a selection (or, with none, the cursor's line), it:

1. Skips past frontmatter if the selection starts inside it.
2. **Expands** the selection to cover whole fenced code/math blocks it
   partially overlaps — you cannot wrap half a fence.
3. **Further expands** outward (`expandStartLine`/`expandEndLine`) through
   adjacent non-blank lines, again respecting fence boundaries — this is what
   lets running the command with the cursor merely *inside* a paragraph wrap
   the whole paragraph, not just the cursor's line.
4. Detects the surrounding quote-nesting depth and whether the target is
   *already* a callout header (nesting one callout inside another, one `>`
   level deeper).
5. Rewrites every line with the appropriate `>` prefix depth, inserting the
   new header line.

With no `def` passed, the header is the deliberately unfinished `[!` — the
generic "Wrap in callout" command parks the cursor right there and triggers
the autocomplete popup (see `triggerNow` below). A user-built custom command
already knows its type, so it gets the finished header and no popup.

### `insertEmptyCallout`

On a blank line, drops the header **in place**. On a line with content,
appends the callout *below*, separated by a blank line so it renders as its
own block — guarding both the leading separator (keeps current quote depth)
and the trailing one (a following non-blank line would otherwise be swallowed
into the new empty callout as a lazy blockquote continuation).

### `insertHeadingCallout`

Turns the cursor's line into `## [!note] Title` — re-leveling and re-typing an
existing heading in place rather than nesting a second token, and donating a
plain line's text as the title. **Quoted lines are never rewritten** — heading
syntax is column-0-anchored (`HEADING_CALLOUT_RE` is anchored), so a heading
callout inside a blockquote is impossible; the command instead inserts the
new heading *below* the blockquote.

### `insertInlineCallout`

Inserts a plain pill at the cursor, or — when `allowContent` is on, the
selection is non-empty, single-line, and its braces balance — wraps the
selection as the pill's `{…}` label instead. A multi-line or brace-unbalanced
selection deliberately falls back to the plain-pill path rather than producing
a broken pill, because braces cannot span lines or nest with no escape (see
[Render roles § the `{…}` content payload](08-render-roles.md#the--content-payload-inline-pills-only)).
The cursor always lands **after** the pill on the same line — pressing Enter
on an inline suggestion must never break the surrounding paragraph.

### `unwrapCalloutAtSelection`

Walks upward from the cursor's line to find the header of the *innermost*
callout containing it (`findContainingCallout`), strips exactly one `>` level
from every line of its body, and replaces the whole block. Fails with a
`Notice` if the cursor isn't inside any callout.

## Autocomplete

[`src/editor/AutoComplete.ts`](../src/editor/AutoComplete.ts) extends
Obsidian's `EditorSuggest`, triggered by typing `[!` in any of the three role
positions.

### Trigger classification

`onTrigger` scans backward from the cursor for the most recent `[!`, then
classifies its position into a role by looking at what precedes it on the
line:

| Text before `[!` | Role |
| --- | --- |
| `>`, `>>`, … (optionally with spaces) | `regular` — native block header |
| 1–6 `#` + whitespace, nothing else | `heading` (popup suppressed if `headingCallouts.enabled` is false) |
| nothing (bare line start) | `inline` if enabled, else legacy `regular` fallback |
| any other text | `inline` (popup suppressed if `inlineCallouts.enabled` is false) |

It captures the **whole token body**, independent of exactly where the cursor
sits inside it — reading only up to the cursor would mis-filter a mid-token
cursor (`[!dang⎸aaaaa]` would otherwise match "Danger" instead of offering
"Create new: dangaaaaa"). The popup **closes** once the cursor moves past the
id into metadata, the fold mark, or title text — none of those are the type
dropdown's business. A code-context check (`isCalloutTokenInCode`) runs
**last**, deliberately, since it's the only check that reads past the current
line and by that point the cursor is already known to sit inside a token.

### Suggestions and "Create new"

`getSuggestions` filters `registry.getAll()` by id/display-name/alias
substring match, excluding fallback rows the last prune scan **confirmed**
have zero vault usage (`isKnownZeroUsageFallback`) — a row that's genuinely in
use elsewhere but never adopted through the editor still autocompletes
normally. A non-empty query with no exact id/alias match appends a synthetic
"Create new: …" row.

Picking "Create new" opens `CalloutEditor` pre-filled with the typed name and
awaits the result. Because the modal can sit open for an arbitrary amount of
time (minutes, if the user steps away), every position captured before that
`await` is treated as **stale** and re-validated against the *live* document
via `liveTriggerLine()` — checking the editor still belongs to the same file
and that the `[!` is still exactly where it was. If not, a Notice explains the
target moved rather than silently corrupting an unrelated part of the note
(or a different note entirely, if the leaf was reused). This mirrors the same
"recompute from the live document" discipline the context-menu section
operations follow.

### `triggerNow` — opening the popup for a programmatically-inserted `[!`

The "Insert empty callout" and "Wrap in callout" commands insert `[!` and want
the suggestion popup to open immediately — but Obsidian's `EditorSuggest`
manager only calls `onTrigger` on real keystrokes. `triggerNow` routes through
the workspace's internal `editorSuggest.trigger(editor, file, true)` (rather
than calling `this.open()` directly) specifically so the popup registers as
the manager's `currentSuggest` and behaves exactly like a natively-typed `!`
— it follows scroll and auto-closes on delete, neither of which a
directly-opened popover would do.

## The five fixed commands

[`src/editor/commands.ts`](../src/editor/commands.ts) registers exactly five
command ids, and **deliberately does not register one command per callout
type** — a design choice, not an oversight — which would flood the command
palette with hundreds of entries.

```ts
FIXED_COMMAND_IDS = [
  "open-settings", "create-callout", "insert-empty-callout",
  "callout-wrap", "callout-unwrap",
]
```

> [!IMPORTANT]
> **These ids are a stable API — never rename one.** Users may have hotkeys
> bound to them; a rename orphans the binding. `tests/repoRelease.test.ts`
> pins the exact set and order.

Each user can individually disable a fixed command
(`settings.disabledFixedCommands`); `setFixedCommandEnabled()` calls
`plugin.removeCommand()` / `plugin.addCommand()` directly, immediately, rather
than merely hiding the command — this is what removes it from the command
palette *and* the hotkeys pane, not just from view. Obsidian only clears a
removed command's **default** hotkeys on `removeCommand`, never the user's own
binding, so re-enabling restores it instantly.

`refreshFixedCommandNames()` re-registers a command **at the same id** whenever
its rendered name changes (a locale arriving mid-session, or the user changing
language) — same-id re-registration is what keeps the hotkey bound, since
Obsidian keys bindings by command id, not by the registered object.

## `CustomCommandManager` — one idempotent sweep

[`src/editor/CustomCommandManager.ts`](../src/editor/CustomCommandManager.ts)
is worth understanding in depth because its whole design follows from one
constraint: `registry.onChange` carries **no payload**, and a callout id
"rename" is really `remove()` followed by `add()` — so no per-event handler
can distinguish a delete from a rename from an unrelated colour tweak.

```ts
syncAll(): void
```

`syncAll()` **re-derives the entire desired command set from scratch** every
time it runs, rather than reacting incrementally to what changed. This single
design choice is what makes delete, auto-prune, edit, import, startup, and
plugin re-enable all fall out of the *same* code path with no special-casing:

1. Sanitize the stored list (`sanitizeCustomCommands` — drops structurally
   malformed entries).
2. Drop any command whose `calloutId` no longer exists in the registry.
3. Compute the desired Obsidian command name for every survivor
   (`describeCommand`, built from the callout's **current** display name).
4. Unregister anything currently registered that's no longer desired.
5. Register (or **re**-register) anything whose desired name differs from
   what it's currently registered under.

> [!IMPORTANT]
> **Three invariants make this correct, and each one had to be deliberately
> engineered:**
> - **A command's `id` is minted once and never derived from its content**
>   (`generateCommandId()` — a timestamp+random string). Obsidian keys the
>   user's hotkey by the *command id*, and `removeCommand` only clears
>   *default* hotkeys — so editing a command's callout, role, or heading level
>   must never touch this id, or the binding orphans.
> - **Only a changed rendered name triggers re-registration.** An icon or
>   colour edit leaves the command's name identical, so it costs nothing; a
>   `displayName` edit changes the name, so the palette label stays accurate.
>   This matters because `addCommand` **mutates its argument in place** and
>   appends its own unload callback — calling it needlessly accumulates
>   garbage.
> - **Rename is the one thing a sweep genuinely can't infer**, because by the
>   time `syncAll()` runs, the old id is simply gone from the registry — there's
>   nothing left pointing commands at it. `CalloutEditorSave` wraps its rename
>   (`remove` + `add`) inside `registry.batch()` and calls
>   `customCommands.migrateCalloutId(oldId, newId)` **inside that same batch**,
>   before the batched `onChange` fires — so the sweep that follows sees a
>   consistent world where every command already points at the new id.

Discovery's prune pass explicitly checks `hasCommandFor(id)` before removing
an unused fallback row — a custom command referencing a callout is a
deliberate claim on it, exactly like `customized: true`. See
[Vault discovery](10-vault-discovery.md).

## The right-click context menu

[`src/editor/contextmenu/`](../src/editor/contextmenu/) is split into three
concerns: **injection** (`index.ts`), **target resolution** (`resolve.ts`),
and **item construction** (`items.ts` + `sectionOps.ts`).

### Injection: three independent paths into Obsidian's `Menu`

```ts
registerContextMenu(plugin): void
```

Because Obsidian doesn't expose one reliable hook for "user right-clicked a
callout," this hooks **three** paths simultaneously, all funneling into the
same `maybeAddItems` guard (deduplicated per-menu via a `WeakSet`):

1. **`workspace.on("editor-menu")`** — the primary, most reliable path for
   Source mode and Live Preview.
2. **A monkey-patched `Menu.prototype.showAtMouseEvent`** — catches menus
   opened outside the `editor-menu` event, notably Reading view.
3. **A monkey-patched `Menu.prototype.showAtPosition`** — catches
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

Inline pills are checked first (their DOM — `.cs-inline-callout` — is
identical between Live Preview and Reading view), then heading callouts, then
the native block callout (which itself tries the CodeMirror widget, editor
coordinates, and reading-view DOM, in that order — unchanged from the
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
+ enabled flags — see `DEFAULT_CONTEXT_MENU_ITEMS` in `constants.ts` and the
merge logic in `settingsMerge.ts`) and invokes whichever builder exists for
each id on that role. An id with no builder for a given role (e.g.
`copyMarkdown` on `heading`) is simply skipped — one config shape covers ids
that only make sense for some roles.

- **`edit`** resolves through `resolveCalloutDef` (the same ladder the
  renderer uses) rather than a plain lookup — this is what lets right-clicking
  `[!a-b]` written for the callout `a b` offer "Edit," and what correctly
  refuses to offer editing for a genuinely unknown id (which merely borrows
  the fallback's *appearance*, not its identity).
- **Block-role `foldDefaults`** offers the *other two* fold states (never the
  current one) — open / closed / non-collapsible — by rewriting the header's
  fold mark in place.
- **Heading-role section operations** (`cutSection`/`copySection`/`deleteSection`)
  compute the section range via `getHeadingSectionRange` in
  [`sectionOps.ts`](../src/editor/contextmenu/sectionOps.ts): the heading line
  through everything up to (not including) the next heading of the same-or-higher
  level, or end-of-document. These are single editor transactions — undo works
  through the editor's own history, no confirmation modal needed (unlike
  deleting a callout *definition*, which is a destructive, harder-to-reverse
  action guarded elsewhere — see [Vault discovery](10-vault-discovery.md#delete-flow)).

## Outline pane and link suggestions

Two decorators clean up how heading-callout tokens appear **outside** the note
that contains them.

### `OutlineDecorator`

[`src/outline/OutlineDecorator.ts`](../src/outline/OutlineDecorator.ts)
rewrites Obsidian's Outline pane, whose `HeadingCache`-based rendering shows
`## [!tip] My Title` as the raw `!tip My Title` (brackets stripped, nothing
else). Because the Outline view has no typed public API, this attaches **one
`MutationObserver` per open outline leaf** rather than patching anything, and
treats the pane's own re-renders (file switch, metadata change, search
filter, virtual-tree churn) as the signal to reprocess
(`attachAll()`/`refreshAll()`, coalesced into one pass per animation frame via
`schedulePass`).

Every rewrite stamps the item with `data-cs-orig`, the untouched original
text — this is what makes disabling the feature, or unloading the plugin,
restore the pane to exactly what core would have shown, rather than leaving
stale decorated text behind. `destroy()` runs a restore-only pass on every
attached leaf before disconnecting its observer.

Ambiguity handling: an outline item's bracketless text (`!bug Title`) is
inherently ambiguous between a real `# [!bug] Title` heading and a heading
literally written `# !bug Title` — `parseOutlineHeadingText` reports a
`bracketed` flag, and this file only trusts a bracketless match after
confirming it against the file's own raw heading text
(`SourceHeadings.bracketedIds`/`literalIds`), computed once per file.

### `LinkSuggestDecorator`

Installed on `workspace.onLayoutReady` (so Obsidian's core link suggester
already exists) and explicitly **excludes this plugin's own autocomplete**
from the suggesters it wraps, because that one already renders callout
suggestions itself and doesn't need cleanup. It cleans the `[[#` heading-link
popup the same way the Outline pane is cleaned — stripping the raw `[!id]`
token from the displayed suggestion text.

---
Next chapter: [10-vault-discovery.md](10-vault-discovery.md)
