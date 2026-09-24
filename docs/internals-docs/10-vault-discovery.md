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
writes after the final check, cannot be excluded by this API. Recovery and
two-device limitations remain described in the persistence chapter.

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
local definitions; see [Multi-device sync](07-persistence-and-caching.md#multi-device-sync).

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
and no role filter. **Find usages** supplies a specific type and clears the role
filter, including when it reuses an existing sidebar. Workspace state holds
filters, never the index.

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
updates selection and active-file highlighting without moving the clicked card,
including when Obsidian emits editor activation events during navigation. A
later editor tab change made outside the sidebar scrolls to that file's group.
If the group lies beyond the current page, it reveals enough results before
scrolling. An active file without a matching group does not move the list.
Switching documents clears a selected card from the previous file immediately;
focusing the sidebar preserves the current document and its selected card.
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
and sticky within its section. `ui/sidebarNavigation.ts` owns opening and
selecting a validated source range; each consumer supplies its source resolver.
A card's identity includes its path, source fingerprint, token coordinates,
identity, and role; array offsets are presentation data only. A `WeakMap` maps
current buttons directly to occurrences, so detached buttons cannot open a
different result after a refresh. Selection updates `aria-current` in place
without rebuilding the cards. After a query update, focus follows the same
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
DOM menus update counts while the index loads and unsubscribe when hidden.
Views unsubscribe from both index and registry changes when closed.
The list starts with 100 results and adds 100 per **Show more** action. Per-file
heading counts cover the complete filtered query, including unloaded cards.
The native right-sidebar tab is the sole visible occurrences control. The fixed
command and **Find usages** menu reopen it after its tab is closed; the plugin
does not add an occurrences button to Obsidian's left ribbon.

Navigation uses public workspace/editor APIs, opens a document leaf in editing
mode and revalidates source tokens against the current editor. When a note has
multiple open editors, it prefers the most recent matching main-pane editor.
A document
fingerprint (normalized for CRLF/LF) permits exact coordinates only while the
source is unchanged. After edits, unique unchanged source lines can be relocated;
ambiguous or missing occurrences trigger an automatic refresh. The editor is checked again
after asynchronous parsing so navigation cannot select from an obsolete buffer
or steal focus after a document switch. A caller generation guard also cancels
selection after filters change or the occurrences view closes and reopens.
`sidebarNavigation.ts` also opens a file from its group heading at the top of the
note without selecting a result. File headings display their counts in parentheses
beside the name. Both sidebars use `sidebarSelection.ts` to tie active-card styling
to the exact selected range: a collapsed, moved or additional editor selection,
or a document edit, clears the purple state. The existing CodeMirror extension
forwards selection transactions to per-editor subscribers; there is no polling.
Subscriptions are removed when the tracked range is cleared or its view closes.
Navigation never inserts block IDs or modifies notes. The one isolated optional host seam
is `openFromSettings.ts`: existing Obsidian `app.setting.close()` is called only
when present to dismiss the settings overlay after explicit navigation. Hosts
without that method receive a notice to close Settings themselves; opening and
navigating the ItemView use public APIs.

## Shared parsing and vault operations

`editor/documentCallouts.ts` exposes a token iterator and a line iterator. Both
preserve original source spans and use `markdownExclusions.ts` and
`markdownContainers.ts` for comments, code and container context. Every whole-note
consumer uses this path: discovery, statistics/indexing and note rewrites.
Excluded characters are masked without changing offsets or creating whitespace
that could turn invalid syntax into a token.

| Function | Purpose |
| --- | --- |
| `scanVaultCalloutStatistics(app)` in `vaultCalloutStats.ts` | Aggregate the shared index by written ID, role, and distinct file |
| `getOccurrenceMetrics(index)` | Cache the current snapshot's aggregate totals for statistics consumers |
| `scanStringForUnknownCallouts` | Unknown source IDs after shared parsing; discovery primitive |
| `countCalloutUsages` / `countCalloutUsagesMap` | Fresh direct scans for maintenance/confirmation, independent of cached menu counts |
| `convertCalloutsToPlainTextInVault` | Strip markup while keeping content |
| `replaceCalloutIdsInVault` | Bulk ID swap with optional title rewrite |
| `preparePortableCalloutConversion` / `applyPortableCalloutConversion` | Reviewed, single-use heading/inline migration to standard Markdown |

The writers still use fresh file contents and complete-pass checks. Cached usage
counts never authorize destructive operations. A statistics refresh never calls
`runVaultScan`, mutates the registry, or saves `data.json`.

### Portable Markdown conversion

`portableCallouts.ts` is the pure converter used by **Danger zone → Convert to
standard Markdown**. It uses the shared source lexer and token grammar, with
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

`portableReplacementEditor.ts` exposes exactly one value for a source card. An
inline value has up to three read-only words on each side, taken from the current
source line. A heading value excludes its fixed prefix, heading-level markers and
optional closing hashes. `PortableCustomReplacementModal` renders a read-only
**Before** row and editable **After** row, without per-format legends or an
introductory paragraph. Every input is single-line; Enter, newline insertion and
multiline paste cannot alter the source-line structure.
Validation also rejects custom text that changes quote/list nesting or indentation
into a code block, preventing an edited token from reinterpreting neighboring prose.
The context menu uses
Obsidian's HTML menu (`setUseNativeMenu(false)`) so the edit and restore icons are
visible consistently.

Conversion cards never clamp or ellipsize their source/replacement text. File
headings remain sticky, show counts in parentheses after the name, and open the
note when clicked. Source-card navigation selects its precise token or heading
range; purple active styling is cleared when that exact editor selection no longer
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

### `convertCalloutsToPlainTextInVault` — role-specific stripping

Converts every occurrence of a set of ids into plain text, with different
rules per role:

- **Block (`regular`)**: only the **outermost** block (single `>`) is fully
  unwrapped (header keeps its title text, body lines lose their leading
  `> `). A **nested** `>> [!id] Title` (a callout inside a parent callout)
  keeps its blockquote depth — that depth belongs to the parent — and loses
  only the token: `>> Title`.
- **Heading**: `### [!id] Title` → `### Title`; `### [!id]` (no title of its
  own) → `### <displayName>` — the fallback exists because a title-less
  heading callout carries no other text at all, and dropping the token
  outright would leave the line empty.
- **Inline**: `[!id]` → `<displayName>`; a content pill's payload survives,
  reformatted as `<displayName>: <payload>` so the note still reads
  sensibly once the plugin's own rendering is gone.

`calloutPlainText.ts` plans conversion from the original document lines. It
processes matching nested blocks and body/title tokens even when an outer block
is unwrapped. Nested payload edits are composed into their parent's source span,
so edits never overlap and generated display names are never scanned again.
Frontmatter, fences, inline code and escaped tokens retain their source exclusions;
payloads inside a surviving other-type pill remain literal payloads.
A later manual scan can only rediscover an id if a note or the active theme still supplies it.

The editor's id/title/fold rewrites use the same document filter, so examples in
frontmatter or fenced code remain untouched. They request complete success from
the vault rewrite helper: it visits every available file, reports failures and
then rejects an incomplete pass. The editor retains its unfinished work for an
explicit Save retry and keeps old ids as saved aliases until all files succeed.

## Delete flow

The delete flow, end to end (`CalloutRowActions.ts: handleCalloutDelete`):

```text
1. count vault usages across every id form the row owns (vaultIdFormsFor)
2. DeleteCalloutModal.prompt() → "cancel" | "delete" | "replace"
     - in use:   warns about conversion to plain text, offers "Replace instead"
     - unused:   simpler "this callout has no usages" copy
3. "replace" → hands off to the Replace flow (below); return
4. "delete" → convertCalloutsToPlainTextInVault(..., requireComplete = true)
5. an incomplete conversion reports failure and returns, retaining the definition
6. registry.remove(def.id)
7. registry.cleanupUnusedIconSvgs()
8. await plugin.saveSettings()                  ← awaited explicitly, see below
9. ctx.display()                                 ← re-renders settings only
```

Conversion is retried even when the earlier menu count was zero, because notes
may arrive while confirmation is open. Successful file conversions are retained;
the definition and its styling remain available until a complete retry succeeds.
Clear-usages actions also request complete success and report unfinished work.

> [!WARNING]
> Step 8's `await` is not tidiness. `cleanupUnusedIconSvgs()` mutates
> `registry.iconSvgCache` directly and does **not** call `notifyChange()` —
> so without an explicit save right here, the trimmed cache would only reach
> disk whenever some *unrelated* future mutation happened to trigger a save,
> leaving orphaned icon SVGs in `data.json` in the meantime.

A **built-in** callout follows a narrower path
(`handleBuiltInCalloutDelete`) — it can only be "deleted" when it has vault
usages (there's nothing to convert or replace otherwise, since a built-in
always exists in the registry), and there's no `registry.remove()` step at
all: built-ins can never actually be removed, only reset or converted away
from in the vault. `handleBuiltInReset` additionally warns before dropping
**custom aliases** a built-in has accumulated, if any of them are still in
vault use — a plain reset would silently orphan those references.

## Replace flow

`handleCalloutReplace` counts usages, opens `ReplaceCalloutModal` (a dropdown
of every *other* registered callout), and on confirmation calls
`replaceCalloutIdsInVault`. If the replacement target's display name differs
from the callout being replaced, the title rewrite rides along too — because
a header this plugin wrote carries the callout's display name as literal
title text (`> [!danger] Warning`), so swapping only the id would leave a
stale title behind. **Only a title that exactly matches the old display name
is touched** — a title the user wrote themselves is never touched.

---
Next chapter: [11-color-system.md](11-color-system.md)
