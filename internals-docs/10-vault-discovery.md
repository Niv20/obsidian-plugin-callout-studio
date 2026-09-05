# Manual discovery, statistics, replace, and delete

## One discovery entry point

The single **Discover now** button beside **My callout types** and **Add new callout** calls `plugin.runVaultScan()` →
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

## Vault scanners — one shared tokenizer for every consumer

[`src/utils/vaultCalloutScanner.ts`](../src/utils/vaultCalloutScanner.ts)
holds every function that reads or writes callout tokens across the whole
vault — both the **read-only** scanners (statistics, unknown-id discovery,
usage counting) and the **write** operations (bulk replace, convert-to-plain-
text). All of them funnel through `editor/calloutTokens.ts`'s shared grammar,
which is explicitly called out as the reason "3 uses in 2 files" (statistics)
and "3 references updated" (replace) never disagree with each other.

| Function | Purpose |
| --- | --- |
| `scanVaultCalloutStatistics(app)` | Full vault pass, grouped by id: file count + total count per type |
| `scanStringForUnknownCallouts` | Ids in one string not in a known-id set — the discovery primitives |
| `countCalloutUsages` / `countCalloutUsagesMap` | Usage counts for a specific set of ids — used before delete/replace, and by explicit maintenance actions |
| `convertCalloutsToPlainTextInVault` | Strips callout markup, keeping content as plain paragraphs — see below |
| `replaceCalloutIdsInVault` | Bulk id swap, with optional title rewrite |

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

All targeted callout tokens are removed by this explicit operation. A later manual scan can only rediscover an id if a note or the active theme still supplies it.

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
4. "delete", usage.fileCount > 0 → convertCalloutsToPlainTextInVault() first
6. registry.remove(def.id)
7. registry.cleanupUnusedIconSvgs()
8. await plugin.saveSettings()                  ← awaited explicitly, see below
9. ctx.display()                                 ← re-renders settings only
```

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
