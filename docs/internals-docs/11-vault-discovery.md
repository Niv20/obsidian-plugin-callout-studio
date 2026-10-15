# Manual discovery, statistics, replace, and delete

## One discovery entry point

The single **Scan for callouts** button beside **My callout types**, just inside **Add new callout**, calls `plugin.runVaultScan()` →
`ManualCalloutDiscovery.run()`. There are no note listeners, startup scans,
open-editor sweeps, pruning passes, ignored-id settings, completion flags,
rediscovery suppression or local discovery storage.

The operation reads saved Markdown files and the current theme's declared ids.
The shared tokenizer ignores code and frontmatter, recognizes block/heading/inline
roles, and folds equivalent spellings. `buildKnownCalloutIds` includes saved
ids, aliases and reserved demo ids. Before publication, the staged registry also
checks attribute-id collisions. A scan only adds unknown rows; it never rewrites
existing definitions or removes rows that have no usages.
Closing code fences must contain only the matching marker and whitespace;
another marker line with a language label remains part of the code block.

File identity, modification time, size, Markdown-file membership and the theme's
usable declared ids are checked. A failure, added/changed/deleted/renamed note or
changed theme-id set cancels the whole pass. Settings and all scan inputs are
checked after scanning and again after the asynchronous disk freshness check,
immediately before the write. Theme attribute values that cannot form a Markdown
callout token (including brackets, metadata pipes and CSS escapes) are skipped.
A successful save precedes the one registry batch that publishes the new rows.
Failed saves leave no partial rows. Another click joins the same promise;
unloading invalidates the scan.

A local edit during an already-started write keeps priority: publication skips
ids/aliases it has since claimed, and uses the latest fallback selection and
appearance. The normal queued save persists that combined state. The completion
count includes only definitions actually added to the live registry.

These checks use Obsidian's file objects and metadata, not a filesystem lock.
An external writer that changes bytes without updating observed metadata, or
writes after the final check, cannot be excluded by this API. See the canonical
[settings recovery and sync boundaries](08-settings-sync-and-recovery.md#verification-and-remaining-boundaries).

Discovered fallback rows are saved normally and exported. Appearance continues to
follow the selected fallback until customized, except where the current theme owns
the type. There is no discovery state to restore at startup. Old cached ids can
be recovered only with an explicit scan. See [Persistence](07-persistence-and-caching.md).

## Commands and device conflicts

Missing command targets are paused while their configuration and identity remain
saved. A manual discovery or synced definition can reactivate them. No command
is deleted merely because one device has not discovered its target.

A settings change detected during discovery cancels publication. For external
file adoption, generic conflict protection preserves a backup before replacing
local definitions; see [Multi-device sync](08-settings-sync-and-recovery.md#multi-device-sync).

## Read-only occurrence index and navigation

`src/usage/CalloutOccurrenceIndex.ts` owns an in-memory index of Markdown source,
preferring current editor buffers for open notes and saved content for closed notes.
It has no registry or settings-writer dependency. `getCalloutOccurrenceIndex(app)`
shares one index per App, and disposal clears records/listeners. Constructing it
registers no discovery and reads no notes. `registerOccurrenceIndex` installs
lifecycle-owned vault and workspace invalidation events; after first use, a
150 ms debounce coalesces note changes into incremental reads. `editor-change`
invalidates affected source, while file/layout changes reconcile open editors.
Editor values are sampled at scan boundaries rather than every keystroke.
The most recently edited view remains authoritative if a duplicate view briefly
lags after focus moves to the sidebar. Closed editor handles are pruned even
before the first usage scan; unchanged layout events do not reparse notes.
Non-Markdown file changes do not trigger a scan. Folder changes invalidate the index.

`ensureFresh` coalesces concurrent requests, reads closed notes with `cachedRead`, and reuses
unchanged file records. File identity, path, mtime, size and invalidation versions
are validated before publication. Enumeration is checked again at completion.
A changed snapshot becomes stale; unreadable files produce an incomplete result.
Failures never become a successful zero and do not start an automatic retry loop.
An invalidation subscription schedules updates even when navigation detects an
obsolete occurrence. A stale pass can retry once per observed change revision;
read failures alone do not reschedule. Large passes yield between
files and document lines. Parsed occurrences retain source identity, role,
zero-based line/columns, and text for navigation validation.

Statistics, menus and the sidebar query these same occurrences. Equivalent
case/whitespace/dash spellings group with `calloutIdentity`; metadata never becomes
part of identity. Vault-wide metrics include unknown source IDs and are cached
by `dataRevision`, which advances for published or removed results, rather than
every typing notification. Result DOM uses the same distinction. Definition-menu
queries union `vaultIdFormsFor(def)` including aliases and
count distinct files, rather than summing alias file counts. The menu label
shows only the total occurrence count; the file count remains available to
other consumers. Registry resolution
provides appearance/status only; fallback artwork never changes usage ownership.

`CalloutOccurrencesView` is a registered ItemView with a searchable
`CalloutCombobox`, role filters, counted file groups and paged results. A summary
below the controls reports the filtered occurrence and distinct-file counts;
the vault-wide metric tiles are not displayed. The shared sidebar heading,
subtitles, filters and summary stay above a separate result scroll container.
File headings stick to the top of that container while their own result section
remains in view, then yield to the next section's heading. Its picker combines committed, non-theme-only
definitions with unregistered identities observed by the read-only index. Saved
definitions include their aliases; equivalent identities and registered aliases
are deduplicated before unknown options are added. A sidebar-local adapter supplies
temporary display choices to the existing combobox, without changing the registry,
settings, discovery, or other picker callers. Only this caller enables the
combobox's optional grouping: an iconless **All types** choice is the first row
under a sticky **Browse** heading, then registered choices precede unregistered
choices, with the shared palette group heading and divider styles. **All types**
removes the ID restriction from the index query while retaining any role filter;
it is not a registry definition. Search ranking applies within each type group.
Membership is tracked by the local adapter, independently of fallback artwork
or definition provenance. Unregistered display definitions reuse
`fallbackSourceFor` and `buildDiscoveredRow`, the same appearance builders as
manual discovery, with the committed fallback definition from `getReal`.
They retain the observed ID, sidebar label and equivalent-spelling aliases;
the fallback's ID and aliases never become usage filters. This also applies to
a retained zero-result selection. The shared `paintCalloutListIcon` paints both
popup rows and the selected icon, including the fallback's hidden-icon setting;
theme-owned IDs still use their measured theme appearance. These definitions
remain local display data and never enter the registry or saved settings.
Theme-only types become options only when present in source.
Choice aggregation is cached by the index's `dataRevision` and committed
fallback reference, and invalidated on registry changes, so typing does not
rescan the vault. The fallback settings picker also calls
`refreshOccurrencesViewAppearance` to repaint open sidebars while preserving
their selection and typed query. This explicit refresh is needed even when no
saved fallback rows change and the generated CSS stays identical, such as
switching between two emoji fallbacks with the same colors.
The selected source identity is retained as a local choice through an initial
scan or deletion of its last occurrence; it can therefore show zero results
without silently falling back to a different type. Selecting another type removes
that retained choice if it no longer occurs. Registering a selected identity or
claiming it as an alias promotes selection to its committed owner.
The view keeps the picker DOM stable during index updates and destroys its
listeners on close. A general command opening starts with the all-types scope
and no role filter. **Find callouts** in a type's menu supplies that specific type and clears the role
filter, including when it reuses an existing sidebar. Workspace state holds
filters, never the index.

After layout-ready fresh-install confirmation, **Find callouts** is offered
once in the right sidebar. The device/vault-local `occurrencesTabOffered` marker
is saved before creation; if it cannot be saved, no automatic tab is added.
Existing `welcomeSeen` or local `hasSeenWelcome` evidence excludes older
untouched installs even when they have no settings file. Existing leaves are
preserved wherever they are, and subsequent launches and upgrades never recreate
an absent tab. A newly created leaf is inactive and unrevealed, so it does not
open the deferred view or start an occurrence scan; selecting it does.

Obsidian's workspace owns the tab's presence, position and filters after that
initial offer. Closing it stays effective across ordinary restarts; restoring a
saved workspace can bring it back. There is no close-event preference to confuse
plugin unloading with an explicit close, and no synced settings write for this
behavior. **Review conversion** still has no startup tab: any leaf restored by
Obsidian is closed on every launch, and a new review opens only when requested
from Settings.

The type and format controls have no visible labels; each keeps a localized
accessible name. They share one grid row until the sidebar container is 440px
wide, then stack in one column. The format filter uses the shared
`SelectDropdown` with the same menu keyboard and pointer behavior as other
finite-choice controls. The view registers a menu
scope host so Escape first closes an open picker, and releases the host and both
pickers when the frame is rebuilt or the view closes.

The shared `SidebarActiveFile` (`ui/sidebarActiveFile.ts`) tracks the most recent
document in the main workspace for both occurrences and conversion review.
It ignores `file-open` notifications from embedded notes and Markdown sidebar
panes by restricting document lookup to `rootSplit`, and follows `TFile.path` when
the active note is renamed. It highlights that file's heading in the current
filtered results. Initial opening leaves the sidebar at the top, without
expanding pages or scrolling to the active file. Navigating through a result
marks the clicked card and highlights the active file without moving the card,
including when Obsidian emits editor activation events during navigation. A
later editor tab change made outside the sidebar scrolls to that file's group.
If the group lies beyond the current page, it reveals enough results before
scrolling. An active file without a matching group does not move the list.
Switching documents clears a marked card from the previous file immediately and
hands the mark to the new document's caret (see "Cursor-follow" below);
focusing the sidebar preserves the current document and its marked card.
This synchronization does not change the selected callout type or role. Committing either filter
resets pagination and selection while preserving the sidebar's scroll offset
within the updated results. A shorter list may clamp that offset to its end.
The active-file highlight remains in place. Filter changes do not reveal extra
results or scroll to that file's section; an actual active-editor change may
still request those actions.

`OccurrenceResults` owns card rendering, selection, and focus restoration. A
file group and its row-major grid come from `ui/sidebarResults.ts`, shared with
the conversion sidebar. CSS bounds both panes' content at 1000px, switches cards
to two columns at 680px container width, and keeps each file heading full-width
and sticky within its section. `ui/sidebarNavigation.ts` owns opening a note and
revealing a validated source range; each consumer supplies its source resolver.
A card's identity includes its path, source fingerprint, token coordinates,
identity, and role; array offsets are presentation data only. A `WeakMap` maps
current buttons directly to occurrences, so detached buttons cannot open a
different result after a refresh. Marking a card updates `aria-current` in place
without rebuilding the cards, and writes only the card losing the mark and the
one gaining it. After a query update, focus follows the same
occurrence rather than its old list position. A changed source snapshot clears
selection instead of transferring it to a replacement at the same coordinates.
Per-file counts are cached by result-array identity and reused for pagination.

The former statistics screen's four vault-wide metric tiles are no longer part
of the sidebar. Filters and the filtered result summary share the same fixed
header layout as conversion review, with results scrolling beneath them.
The loading/stale live region stays mounted but empty for
the first two seconds of one continuous idle/loading/stale episode, so ordinary
navigation and incremental refreshes do not flash progress copy. One cancellable
timer spans those status transitions; a long-running episode is announced, while
completion or view closure clears it. Partial and failed states remain immediate.
`VaultCalloutStatisticsModal` and its row renderer have been removed, along with
the Settings action and styles. Result cards omit redundant type labels and
clamp excerpts to two lines while preserving raw Markdown syntax; block excerpts
prefer a header line and a line of body content. Preview formatting does not
change source coordinates or token exclusions. Fine-pointer hover changes only a
result card's border to the theme's focus-border colour; selected and
keyboard-focus treatments remain distinct.
`prepareUsageMenu` gives the shared occurrence scan up to 200 ms before any
custom, built-in or theme row menu is constructed. A ready index bypasses both
the wait and a freshness request. Concurrent requests share one scan; the latest
menu request supersedes earlier ones. A temporary `Component` owns the timeout,
index subscription and owner-document/window listeners. Clicking elsewhere,
Escape/Tab, window blur, Settings hide/redraw or index disposal cancels the
pending opening; a detached trigger cannot open a delayed menu. Every settlement
cleans up the temporary resources.
The settings row's surrounding `openCalloutRowMenu` lifetime remains active
through this wait and after the menu opens. Pending menus and open desktop/tablet
popups also cancel on actual ancestor scrolling, viewport resize/pan and a moved
trigger, including changes between index readiness and the awaiting continuation.
An open phone sheet lets Obsidian dismiss the keyboard and adjust the page without
closing for these positional changes. Orientation changes and trigger removal or
reparenting still dismiss it on every device.
See [settings menu lifetime](16-settings-ui-and-modals.md#callout-row-menu-lifetime).
Fast scans show the exact count from the menu's first frame. On timeout, DOM
menus open with the plain localized **Find callouts** label and observe the existing
scan without requesting another. Once ready, the added count fades in over
180 ms using a document-fragment title; the action label stays visible. Counts
already ready at opening do not animate, unchanged titles are not replaced, and
reduced-motion preferences disable the fade. Partial scans retain an explicit
incomplete label and are not retried within the same opening. A ready count of
zero greys the item out (`setDisabled`), along with the note-rewriting items
that were added before the count was known; see
[settings menu groups](16-settings-ui-and-modals.md#callout-row-menu-groups).
Menus unsubscribe when hidden.
Views unsubscribe from both index and registry changes when closed.
The list starts with 100 results and adds 100 per **Show more** action. Per-file
heading counts cover the complete filtered query, including unloaded cards.
The native sidebar tab is the sole visible occurrences control. It is offered
once on first install, and the fixed command and **Find callouts** menu reopen
it after its tab is closed. The plugin does not add an occurrences
button to Obsidian's left ribbon.

Navigation uses public workspace/editor APIs, opens a document leaf in editing
mode and revalidates source tokens against the current editor. When a note has
multiple open editors, it prefers the most recent matching main-pane editor.
A leaf already in editing mode is opened with `{ mode: "source" }` and keeps
Live Preview or Source as its user left it. Any other leaf (Reading view, a new
tab, another view type) also gets `source` from the vault's **Default editing
mode** (`getConfig("livePreview")`, read defensively). Given only `mode`, core's
`MarkdownView.setState` keeps whichever flavour the pane last edited in, which
took a Reading-view note into Source mode.
The leaf is opened with `active: false` and then activated with
`setActiveLeaf(leaf, { focus: false })`: core's `focusLeaf` is what moves focus
into the editor, and on iOS that raises the keyboard. Navigation never calls
`setSelection`, `editor.focus()` or `setEphemeralState({ line })` (which moves the
caret too), because a caret anywhere inside a callout makes Live Preview show its
raw Markdown. It calls `revealCalloutInEditor` (`editor/calloutFlash.ts`, see
[Editor integrations](10-editor-integrations.md#landing-flash)) to scroll the
callout into view and flash it. On `Platform.isMobile` it first collapses the
drawer holding the sidebar (the `origin` leaf's root, when that is `leftSplit` or
`rightSplit`), as core's `focusLeaf` would have, and the flash waits 280 ms for
the drawer to slide away.

**Known and expected: the note's header title blinks grey on a click.**
Pressing a card makes the sidebar's own leaf the active one, so core dims the
title of the note's pane. A moment later `setActiveLeaf(leaf, { focus: false })`
hands the active leaf back to the note and the title turns normal again. The two
happen within one click, so the title looks like it blinks grey beside the flash.
It is core's own activation of the sidebar, not the flash (which never touches
the header), and the plugin has no way to avoid it: the press runs before any
plugin code. Do not chase it as a flash bug.
A document
fingerprint (normalized for CRLF/LF) permits exact coordinates only while the
source is unchanged. After edits, unique unchanged source lines can be relocated;
ambiguous or missing occurrences trigger an automatic refresh. The editor is checked again
after asynchronous parsing so navigation cannot reveal from an obsolete buffer
or act after a document switch. A caller generation guard also cancels
the reveal after filters change or the occurrences view closes and reopens.
`sidebarNavigation.ts` also opens a file from its group heading scrolled to the
top (`editor.scrollTo(null, 0)`), leaving the caret alone. File headings display
their counts in parentheses beside the name. Both sidebars use
`sidebarSelection.ts`'s `SidebarSourceSelection` to keep a clicked card marked
until the user acts in its editor: it records `listSelections()` when the result
lands and clears on the first selection that differs, or on any edit. A cursor
restore that lands on the same selection is not the user acting. The existing
CodeMirror extension forwards selection transactions to per-editor subscribers;
there is no polling. Subscriptions are removed when the card is released or its
view closes.

### Cursor-follow

Find callouts marks the card for the callout under the caret, as the core Outline
marks the heading under the caret. Obsidian 1.14.4's Outline follows the cursor in
editing mode (`editor-selection-change`, 20 ms debounce) and uses scroll only in
Reading view. The plugin follows the cursor for the same reasons and one more: the
signal is already there. `calloutViewPlugin.update` calls
`notifySidebarEditorSelection` on every `selectionSet` or `docChanged`, and
`onSidebarEditorSelection` lets a sidebar hear every editor through it. With no
sidebar open the listener set is empty and a transaction costs one size check.
A scroll-driven design would need a listener per editor firing on every frame of
a fling, geometry reads while scrolling, and a rule for which of several visible
callouts counts.

`usage/occurrenceCursorSync.ts` subscribes while the view is open, ignores every
editor but the one `SidebarActiveFile.currentView()` follows (embedded editors,
canvas cards and settings previews never reach it), and coalesces notifications
into one lookup per animation frame. `OccurrenceResults.follow` writes to the DOM
only when the marked card changes, and scrolls the list with `scrollToReveal`
only when that card is out of sight and the scroller is laid out (a hidden
sidebar tab has zero height). The card's own file heading is sticky at the top
of the scroller, so its height is passed as `coveredTop`: a card whose top edge
sits under that heading counts as out of sight, and lands 8 px below it. It never moves focus or expands **Show more**.

`usage/occurrenceAtCursor.ts` resolves the caret against the **drawn** cards of
that note (`OccurrenceResults.linesOf`), innermost first: an inline pill the caret
touches, payload included; a heading callout on the caret's line; then the
nearest block callout above whose quote holds the caret, walking up only through
quoted lines and tracking the shallowest depth on the way. A header's own token
supplies its depth, so a callout under a list item (`- > [!x]`) is found too. A
filtered-out inner callout passes the mark to the one around it. A card whose
`lineText` no longer equals the live line never matches: while the index lags
behind typing the mark drops out rather than landing on the wrong card, and the
next index render (which always reschedules the lookup) restores it. Block extent
follows `editor/calloutExtent.ts`, shared with the landing flash.

A click holds the mark: `openResult` calls `hold()` before navigating, so neither a
note switch nor a queued frame can mark another card, and `landedIn(editor)` once
the result is in view. The first real selection change or edit releases it.
Filter changes and `setState` reset the hold; closing the view unsubscribes.
Navigation never inserts block IDs or modifies notes. The one isolated optional host seam
is `openFromSettings.ts`: existing Obsidian `app.setting.close()` is called only
when present to dismiss the settings overlay after explicit navigation. Hosts
without that method receive a notice to close Settings themselves; opening and
navigating the ItemView use public APIs.

## Shared parsing and vault operations

`editor/documentCallouts.ts` exposes a token iterator and a line iterator. Both
preserve original source spans and use `markdownExclusions.ts` and
`markdownContainers.ts` for comments, code and container context. Every whole-note
consumer uses this path: discovery, statistics/indexing, the callout editor's
pre-save count and note rewrites.
Excluded characters are masked without changing offsets or creating whitespace
that could turn invalid syntax into a token.

| Function | Purpose |
| --- | --- |
| `scanVaultCalloutStatistics(app)` in `vaultCalloutStats.ts` | Aggregate the shared index by written ID, role, and distinct file |
| `getOccurrenceMetrics(index)` | Cache the current snapshot's aggregate totals for statistics consumers |
| `scanStringForUnknownCallouts` | Unknown source IDs after shared parsing; discovery primitive |
| `countCalloutUsages` / `countCalloutUsagesMap` | Fresh direct scans for maintenance/confirmation, independent of cached menu counts |
| `scanIdNoteStats` in `idNoteStats.ts` | One fresh pass for the callout editor's question: uses, differing fold marks and old-name titles per ID, with the notes each was found in |
| `convertCalloutsToPlainTextInVault` | Strip markup while keeping content |
| `replaceCalloutIdsInVault` | Bulk ID swap with optional title rewrite |
| `replaceCalloutTitlesInVault` / `normalizeFoldMarkersInVault` | Titles reading an old name; block fold marks. The callout editor's title and fold passes |
| `preparePortableCalloutConversion` / `applyPortableCalloutConversion` | Reviewed, single-use heading/inline migration to standard Markdown |

The writers still use fresh file contents and complete-pass checks. Cached usage
counts never authorize destructive operations. A statistics refresh never calls
`runVaultScan`, mutates the registry, or saves `data.json`.

**Undo.** `rewriteVaultFiles` takes an optional `NoteRewriteJournal`
(`utils/noteRewriteUndo.ts`), which records each note's text before and after,
once its write has succeeded. **Replace in vault**, **Convert uses to plain
text**, a renamed palette's **Update notes** and the callout editor's Save,
when its **Update your notes?** answers chose a rewrite, pass one and end with
`noticeWithUndo` (`settings/rewriteUndoNotice.ts`): a notice with an **Undo**
link.

- Only the most recent rewrite is kept, in memory. It is kept only whole: over
  about 64 MB of text it is dropped rather than kept in part.
- Undo writes back a note only while it holds exactly what the rewrite left.
  Moved, deleted and edited notes are skipped and counted.
- One journal can span several passes. The editor's Save rewrites IDs, then
  titles, then fold marks into one journal, so a note can be recorded more
  than once. `record()` chains a later pass onto that note's earlier record
  (looked up by path): the first `before` stays and `after` moves on, so Undo
  goes from the last pass's text straight back to the first pass's. Two
  separate records would each find the note holding something other than what
  they expect. When a later pass's `before` is not the earlier `after`, the
  note was typed into between passes; the record is marked `broken`, and Undo
  skips and counts it, as it does a note edited after the rewrite. The size
  budget counts the first `before` and the latest `after`.

**Delete** rewrites no note, so it has no journal. Its notice comes from
`noticeWithUndoAction` instead, the same fragment and link around a plain
callback; see [the delete flow](#delete-flow).

The portable Markdown conversion below has its own reviewed, confirmed
irreversible flow and does not use the journal.

### Portable Markdown conversion

`portableCallouts.ts` is the pure converter used by **Danger zone → Convert to
standard Markdown**. What each token becomes is `convertCalloutLine`
(`calloutPlainTextLine.ts`), shared with
[Convert uses to plain text](#convertcalloutstoplaintextinvault---role-specific-stripping);
this file adds the export's own masks and reparse check. It uses the shared
source lexer and token grammar, with
additional conservative masks in `portableCalloutExclusions.ts` for math, HTML
and links. These export-only masks do not change what the existing renderer or
usage index recognizes. Protected source retains its bytes and original offsets.
Only original source tokens are rewritten; generated output is not scanned again.

Bare inline tokens use the trimmed written type, with metadata removed, regardless
of definitions, aliases, fallback settings or feature toggles. A complete inline
payload is unwrapped without a type prefix; empty payloads disappear. Literal
labels and newly exposed block markers are escaped where necessary to preserve
text semantics. Malformed or unsupported nested payloads remain for manual review.
This is a recognition boundary, not a best-effort text replacement: an incomplete
`[!note]{unfinished` or nested `[!note]{outer [!tip]{inner}}` is left byte-exact.
The converter never guesses a closing delimiter or strips a partly understood
payload. Unknown type IDs are still valid tokens; they do not require a registered
definition. Only recognized source spans enter the selectable conversion plan.
Block-preserving escapes also cover a newly exposed reference definition; a
conversion that would expose a raw HTML block is skipped for manual review.

In a valid unquoted ATX heading, bare tokens are decorations when other title
text remains, including tokens following that text. If only tokens remain, their
written types provide the title. Closing ATX hashes do not count as title text.
Literal heading `+`/`-` and heading braces remain title text. Quoted headings retain
the parser's inline-role behavior. Native block headers and their titles are not
rewritten, while body inline tokens remain eligible.

`portableCalloutVault.ts` prepares a frozen public plan containing every eligible
replacement and its exact source identity. `portableCalloutUnits.ts` derives these
review units from the safe converter's approved edits. An ordinary inline token,
including its complete payload, is one independently selectable unit; an unquoted
ATX heading remains one full-line unit because its decorations depend on the
whole title. Each public change retains `sourceLine`, the original `from`/`to`
range within it, and `headingLine`, while `before`/`after` contain only that unit's
display text. Unit IDs include the path, source line number, range, complete source
line and default replacement, distinguishing repeated tokens on the same line.

`portableCalloutPlan.ts` derives proposed content from selected units and computes
dependent heading references. Source edits on one line are composed in source
order, preserving all other source bytes and recomputing the converter's
block-preserving escapes for the chosen subset. The planner tracks each unit's
range in the proposal so its after-text includes link repairs within that range.
`replacement` and `defaultReplacement` retain the current subset's bytes before
link repairs, with and without custom text, so the editor and its no-op detection
agree with the reviewed proposal even when selecting a subset changes an escape.
Automatic link-repair cards retain complete source lines and follow heading
choices, rather than becoming independently selectable units.
A private WeakMap binds approval to the app, file objects, paths, metadata, exact
original bytes and proposed bytes. All Markdown files are read with `vault.read`;
incomplete reads reject the preview. `portableCalloutPreviewCache.ts` reuses
unchanged reads and pure conversions only within the open review session; events
invalidate affected paths. Apply never trusts this cache. Every open MarkdownView,
including duplicate tabs, must agree with saved content (CRLF/LF normalized only
for this editor comparison). No registry, settings or editor buffer is mutated.

`portableHeadingLinks.ts`, `portableHeadingLinksHeadings.ts` and
`portableHeadingLinksScan.ts` explicitly retarget internal wiki/Markdown links,
embeds and reference definitions. Obsidian's `vault.process` writes and refreshes
file caches; it does not invoke the separate native heading-rename command.
Callout Studio therefore computes these repairs itself, without relying on the
user's automatic file-link-update setting. Both formats documented in
[Obsidian's internal-link guide](https://obsidian.md/help/links) are covered:

| Source form | Heading change example |
| --- | --- |
| Wiki link or embed | `[[Note#Report note\|label]]` / `![[Note#Report note]]` → heading `Report` |
| Markdown link or image | `[label](Note.md#Report%20note)` / `![label](Note.md#Report%20note)` → fragment `#Report` |
| Markdown reference definition | `[id]: <Note.md#Report note> "title"` → destination `<Note.md#Report>` |

Targets are resolved with `metadataCache.getFirstLinkpathDest` and Obsidian's
`stripHeading`/`stripHeadingForLink` normalization. Top-level ATX and setext
headings retain source-line identity. Paths, aliases and titles remain intact;
wiki targets preserve literal percent sequences, while Markdown URI targets
follow native decoding. Same-note fragments, relative paths, encoded spaces and
Unicode, escaped punctuation, balanced destination parentheses, and ordered
parent/child heading fragments all participate. Reference titles can span lines;
their text is not scanned as nested links. A complete destination may start on the
following line, including angle-delimited folder paths, but not after a blank line.
Malformed destinations and definition tails are left untouched. External schemes,
block references, unresolved files and unmatched headings never acquire guessed
repairs. Protected code, comments, math, frontmatter and raw HTML
are excluded. A bounded fixed-point pass handles links inside headings that
change other referenced headings. Unsafe collisions or unrepresentable targets
exclude the responsible source conversion and surface a reason in the review.
This includes duplicate old anchors, two proposed headings collapsing to the same
anchor, loss of a setext heading, and link-induced heading cycles that do not
settle within twelve passes. Reparsing is based on the selected proposal, so
deselecting a heading also removes its dependent repairs.
Custom replacement values use the same proposed-content path: heading titles are
not patched after link planning. The complete candidate is validated before its
approval plan is committed, and any repaired destination is included in the final
preview and exact approved output. Automatic link rows cannot be independently
overridden, which prevents a manual replacement from detaching them from the
heading selection that requires them.

`portableCalloutSegments.ts` maps the converter's approved source edits to output
ranges and fixed fragments; it never scans token-like text a second time. Each
inline review unit owns its exact token/payload range and default converted value.
Fixed fragments reconstruct all bytes outside the selected replacements. The
converter's block-preserving escape belongs to the replacement when it escapes
that value, and otherwise stays in a fixed fragment. Unsupported mappings fail
closed. Multiple inline tokens on one line can be selected and customized
independently without guessing delimiters inside custom text.

`portableReplacementEditor.ts` exposes exactly one value for a source card.
Inline editing shows only that replacement, without surrounding source words.
A heading value excludes its fixed prefix, heading-level markers and optional
closing hashes, which remain visible and read-only. The source card's pencil,
replacement text and context-menu
edit action open `portableInlineReplacement.ts` through
`portableConversionCustom.ts`. Cards keep their paired **Before**/**After**
labels and original source preview; only the **After** text becomes editable.
Its single-line field blends into the card without separate Save or Cancel
buttons. Entry selects all editable text without opening or scrolling the note
or changing conversion inclusion. The card gains an editing highlight; the
previous source-navigation highlight clears, and the format/line label and
**Before** text remain the source-navigation controls.
Enter or clicking outside saves; Escape cancels. Enter and Escape are ignored
during input method composition; clicking outside commits the final composed
input before closing the field.
Finishing an unchanged draft exits editing without changing the review. The
`rotate-ccw` button appears only when the live value differs from the automatic
replacement and updates as the user types. With an unsaved change it restores
the last saved/default preview; with no unsaved change it restores the automatic
replacement. Invalid outside-click saves discard the draft and show a notice so
the field does not remain visibly active after focus leaves it.
Newline insertion and multiline paste cannot alter the source-line structure.
A draft is scoped to the active review: redraws preserve its text, while a stale
or closed review cancels it.
Convert is dimmed until the draft is saved or cancelled, and pressing it says so. Only a validated
save rebuilds the proposal; editing never writes notes directly.
Validation also rejects custom text that changes quote/list nesting or indentation
into a code block, preventing an edited token from reinterpreting neighboring prose.
The context menu uses
Obsidian's HTML menu (`setUseNativeMenu(false)`) so the edit and restore icons are
visible consistently. When a customized card is not being edited, the `rotate-ccw`
button beside the pencil exposes the same restore-default action.

Conversion cards never clamp or ellipsize their source/replacement text. File
headings remain sticky, show counts in parentheses after the name, and open the
note when clicked. The source card's format/line label and **Before** text
navigate to its precise token or heading range; **After** starts inline editing.
Purple active styling is cleared when that exact editor selection no longer
exists. The fixed header places the conversion action beside the description.
A single summary checkbox uses the native indeterminate state for partial
selection, with a horizontal dash. Clicking an empty or partial state selects
all; clicking the checked state clears all. Its count measures review units rather than source
lines. These controls do not change selection while a frozen recovery plan is
pending.

Custom-text retention is scoped to the customized source segment, not the entire
note. The private approval snapshots retain the original `TFile` object and exact
source/default replacement bytes. After an unrelated edit, insertion or rename,
the old and new segment must have an unambiguous exact correspondence. Matching
uses unchanged file coordinates, unique complete source lines, unique token
spans in both snapshots, or unchanged prefix/suffix positions. A single changed
line bounded by unchanged lines can retain a uniquely matching token even when
words on both sides change. An identical token elsewhere does not invalidate a
uniquely mapped source line; deletion of duplicate identical lines cannot transfer
their custom values to the survivor. The current note supplies unchanged
surrounding text when a retained inline value is reconstructed. Changed, missing
or ambiguous segments lose only their own override and selection, so a refresh
cannot silently approve the default in place of discarded custom text. A native
Obsidian `Notice` reports those invalidations. Retained overrides are validated
again against the refreshed proposal and its heading-reference plan; retaining
text does not bypass final snapshot checks. If surrounding Markdown changes make
retained text unsafe, the text remains visible but its selection is cleared for
review rather than replacing it with a default.

Applying consumes the approval plan and checks the complete vault snapshot and
editor buffers before the first write. Each changed file then goes through
`vault.process` with another byte-exact comparison and identity/editor guards
inside the atomic callback. There is no cached-read overwrite or `modify` fallback.
A per-app lock rejects concurrent scans or conversions. A failure stops immediately
and returns confirmed write counts; completed files stay converted. The service
retains a frozen recovery plan per app for the exact pending outputs, even when
only links remain after their target headings were already written. Reopening the
sidebar returns that plan rather than rescanning away the old-to-new mapping.
Retry choices are fixed and still require all expected bytes, file identities,
membership and editor buffers to agree. This memory-only recovery state does not
survive plugin unload. The UI must never describe a stopped operation as rolled
back or wholly successful.

`portableHeadingLinksCache.ts` retains up to three exact-content parses per path
within the review session, shared across selection revisions and automatic
rescans. It caches headings and link destinations, prunes removed paths and clears
on close. No parsed note content is stored in a global cache. This keeps repeated
checkbox changes from reparsing the entire vault. The source lexer's optional
`hasInlineCode` flag and heading-only inline-math mask keep code/math-only setext
titles in the collision check while their contents remain protected from rewriting.

The API is atomic per file, not across the vault. External writers can still act
after a successful callback; it is not a filesystem lock. There is no automatic
backup or undo. The UI asks users to back up notes and pause editing/sync, and
separates read-only review from the irreversible final confirmation.

### `convertCalloutsToPlainTextInVault` - role-specific stripping

Converts every occurrence of a set of ids into plain text. The block role is
this flow's own. Heading and inline tokens go through `convertCalloutLine`
(`calloutPlainTextLine.ts`), the same code the
[portable conversion](#portable-markdown-conversion) runs, so the two never
leave different text behind; `tests/calloutPlainTextParity.test.ts` holds them
to it. Per role:

- **Block (`regular`)**: only the **outermost** block (single `>`) is fully
  unwrapped (header keeps its title text, body lines lose their leading
  `> `). When the line above the header is visible text outside any quote
  (not blank, not frontmatter or code), a blank line goes before the title.
  Without it, the title would become that paragraph's next line. A title-less
  header turns into a blank line of its own, so it needs no separator. The
  editor's unwrap command keeps titles and separates them the same way. A
  **nested** `>> [!id] Title` (a callout inside a parent callout)
  keeps its blockquote depth - that depth belongs to the parent - and loses
  only the token: `>> Title`, or `>> id` when it had no title.
- **Heading**: `### [!id] Title` → `### Title`; `### [!id]` (no title of its
  own) → `### id`, since a title-less heading callout carries no other text.
- **Inline**: `[!id]` → `id`; `[!id]{text}` → `text`. The pill drew only its
  icon and that text, never the callout's name, so no name is added.

Where a token leaves its type, it is the type as the note writes it - trimmed,
metadata removed, escaped by `plainTextLabel` so it stays literal - never the
display name, so neither flow depends on the registry. The portable section's
per-token rules apply here word for word: empty payloads disappear, payload
spaces stay, newly exposed block markers are escaped, heading decorations go,
and an ambiguous payload (another pill inside it, or `{` that never closes)
stays byte-exact.

`calloutPlainText.ts` plans conversion from the original document lines. A
matching header is removed first and what is left of the line is scanned again
as prose, since native header scanning never looks inside a title; its tokens
then convert like body tokens. Matching nested blocks and body tokens convert
even when an outer block is unwrapped, and generated labels are never scanned
again. Frontmatter, fences, inline code and escaped tokens retain their source
exclusions. The portable masks for math, HTML and links do not apply: they
decide what the irreversible export may touch, while this flow takes the
tokens `countCalloutUsages` counted for its dialog, short of the ambiguous ones.
A later manual scan can only rediscover an id if a note or the active theme
still supplies it - which, after a [Delete](#delete-flow), a note usually does.

The editor's id/title/fold rewrites run only when the user chose them in
**Update your notes?** (see
[Callout editor](14-callout-editor.md#notes-change-only-after-asking)); its
count before asking, `scanIdNoteStats`, reads the same tokens these writers
change. They use the same document filter, so examples in frontmatter or fenced
code remain untouched. They request complete success from the vault rewrite
helper: it visits every available file, reports failures and then rejects an
incomplete pass. The editor retains its unfinished work for an explicit Save
retry and keeps the old ids it is rewriting as saved aliases until all files
succeed.

## Delete flow

Delete removes a definition and never touches a note. Turning the uses into
plain text is the separate [convert flow](#convert-flow) below. The two used
to run as one action, whose dialog had to offer three outcomes; split, each is
a plain yes/no `ConfirmModal`.

Which rows offer Delete is `deleteRemovesRow` (`rowOwnership.ts`): neither a
built-in nor an id the active theme names, since something outside the plugin
keeps declaring those and the row would come straight back. Built-ins get
**Reset to default** instead (`handleBuiltInReset`, which warns before
dropping custom aliases still in vault use).

`handleCalloutDelete` (`settings/sections/calloutVaultActions.ts`), end to end:

```text
1. blockedWhilePaused → return                    ← nothing starts while paused
2. countCalloutUsages over vaultIdFormsFor(def)   ← fresh, never the menu's count
     an incomplete scan rejects; its notice is already up → return
3. in use, or the default fallback callout → ConfirmModal (Cancel / Delete)
     in use:    deleteModal.bodyInUse + deleteModal.notesUntouched
     fallback:  deleteModal.fallbackTarget (alone when nothing uses it)
   otherwise no dialog at all
4. declined → return; blockedWhilePaused again → return
5. snapshot registry.get(def.id): a clone, its cached artwork, wasFallback
6. registry.remove(id)        ← resets fallbackCalloutId to "note" if it was it
7. registry.cleanupUnusedIconSvgs()
8. await plugin.saveSettings()                    ← awaited explicitly, see below
9. plugin.refreshCallouts()   ← notes keep [!id] and now look different
10. ctx.display(); notice "Deleted …" with Undo (noticeWithUndoAction)
```

- **Failed count.** A partial count is never taken for "unused", which here
  would skip the question. `scanVaultFiles` reports the unreadable notes, and
  the delete stops.
- **Fallback callout.** `remove()` resets the fallback to Note and re-mirrors
  every uncustomized `source: "fallback"` row onto it. That changes how unknown
  callouts look across the vault, used or not, so it always asks.
- **Snapshot.** The snapshot is taken from the registry rather than the menu's
  `def`, which is the list as it was drawn. Undo has to put back what was
  actually removed.

> [!WARNING]
> Step 8's `await` is not tidiness. `cleanupUnusedIconSvgs()` mutates
> `registry.iconSvgCache` directly and does **not** call `notifyChange()` -
> so without an explicit save right here, the trimmed cache would only reach
> disk whenever some *unrelated* future mutation happened to trigger a save,
> leaving orphaned icon SVGs in `data.json` in the meantime.

**Undo** (`restoreDeletedCallout`) runs once, from the notice:

- It does nothing while saving is paused, or if the id has a row again, from a
  new callout or a scan. That row is the user's now.
- Inside one `registry.batch`, it re-adds the cached artwork that is missing,
  then the definition. If `add` refuses, it drops the artwork again.
- If the callout was the fallback and the fallback is still Note, it makes it
  the fallback again and re-runs `restyleUncustomizedFallbackRows`.
- It saves, refreshes, and redraws.

Notes keep `[!id]` after a delete, so the id is ordinary vault content again.
It draws in the fallback style, and the Find callouts view lists it under
**Unregistered callouts**. A later **Scan for callouts** adds it back as an
uncustomized fallback row, and re-importing it, for example from Callout
Manager, creates it again. Both are deliberate: there is no list of deleted
ids. Custom commands that target it are suspended, not deleted, and come back
with it.

## Convert flow

`handleClearCalloutUsages` behind the `⋯` item **Convert uses to plain text**
(`addConvertUsesItem`). Every row kind offers it: user, built-in and theme. It
shows whenever the menu's count is not known to be zero, and is greyed out if
that count lands on zero after the menu opened.

```text
1. countCalloutUsages, fresh; incomplete scan or zero → return
2. ConfirmModal (Cancel / Convert):
     deleteModal.bodyInUse + convertModal.explain + who keeps the type
3. convertCalloutsToPlainTextInVault(..., requireComplete = true, journal)
4. incomplete → notice.calloutDeleteIncomplete; converted files stay converted
5. noticeWithUndo(journal); ctx.display()
```

The definition is never touched, and nothing is saved. The last line of the
dialog says who keeps the type, decided explicitly:

- **A built-in:** `keepsRowBuiltIn`, because Obsidian keeps it.
- **A theme's type:** `keepsRowTheme`, naming the theme. This applies only when
  `registry.themeOwns(def)` and a theme name is known.
- **Anything else:** `convertModal.typeStays`.

A user's own callout must never read as the theme's or as a built-in merely
because a community theme happens to be active. A retry after a failed pass
finishes the remaining notes, since conversion is idempotent.

## Replace flow

`handleCalloutReplace` counts usages, opens `ReplaceCalloutModal` (a dropdown
of every *other* registered callout), and on confirmation calls
`replaceCalloutIdsInVault`. If the replacement target's display name differs
from the callout being replaced, the title rewrite rides along too - because
a header this plugin wrote carries the callout's display name as literal
title text (`> [!danger] Warning`), so swapping only the id would leave a
stale title behind. **Only a title that exactly matches the old display name
is touched** - a title the user wrote themselves is never touched. Neither is a
header written from an alias, which carries the alias's own title
(`> [!attention] Attention`, see
[editor integrations § the typed word decides the title](10-editor-integrations.md#the-typed-word-decides-the-title)):
the swap matches the display name only, so that title stays after the id is
replaced.

---
Next chapter: [12-color-system.md](12-color-system.md)
