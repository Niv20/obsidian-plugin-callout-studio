# Vault discovery, statistics, replace, and delete

This covers everything that keeps the registry synced with what's actually
written in the vault: auto-discovery of unknown callout IDs, pruning stale
auto-created rows, the statistics modal, bulk replace, and the delete flow.

## `CalloutDiscovery` — the coordinator

[`src/manager/CalloutDiscovery.ts`](../src/manager/CalloutDiscovery.ts) is
destroyed via `destroy()` on plugin unload. It does not scan the vault itself —
the scanning primitives live in `utils/vaultCalloutScanner.ts` (shared with
statistics and replace, see below); this class decides *which ids* and *what
guards* apply.

It has been split twice, both times because a question with its own failure
modes was hiding inside it. It owns an instance of each and forwards to it:

- The **whole-vault** half — which rows nothing references any more — lives in
  [`manager/CalloutPrune.ts`](../src/manager/CalloutPrune.ts): discovery reads
  one file, the prune reads every file. `schedulePrune` / `pruneUnused` /
  `pruneSuspended` forward there.
- The ***when*** half — the triggers, the per-file debounce and the memo that
  keeps the `file-open` trigger cheap — lives in
  [`manager/discoveryScheduler.ts`](../src/manager/discoveryScheduler.ts).
  `registerIncrementalWatchers` and `scheduleFileScan` forward there.

> [!IMPORTANT]
> **A discovered row nobody has claimed is never written to `data.json`.**
> It lives in the registry for the session; its *id* goes to
> [`DeviceLocalStore`](../src/manager/DeviceLocalStore.ts), and
> [`discoveryIndexBoot`](../src/manager/discoveryIndexBoot.ts) rebuilds the row
> at startup through the same `buildDiscoveredRow` discovery itself uses — so
> the restored row wears whatever the fallback looks like *today*, and a
> restart costs no vault read at all. This is the fix for issue #41: a second
> device that merely opened a synced note used to edit the settings file, and
> edit it differently from the first. See
> [Persistence § multi-device sync](07-persistence-and-caching.md#multi-device-sync).

### The automatic-discovery toggle

`settings.autoDiscoverCallouts` (default **on**) gates the three automatic
paths and nothing else: `scheduleFileScan`, the first-run scan, and the
settings tab's sweep of open editor buffers. **Re-scan vault** and every other
action the user takes still work, and turning it off takes nothing away — the
rows already discovered stay exactly where they are. The gate sits inside each
of the three rather than around the event registration, so an inert listener
costs nothing and the toggle takes effect immediately in both directions.

Turning it off deliberately does **not** mark the first run complete: turning
it back on still gets the one scan that populates this device's index.

### Where events come from

```ts
registerIncrementalWatchers(): void   // called from main.ts's onLayoutReady
```

Everything about *which* file gets looked at and *when* lives in
[`manager/discoveryScheduler.ts`](../src/manager/discoveryScheduler.ts) —
the same split as `CalloutPrune`, and `CalloutDiscovery` only forwards to it.
Three Obsidian events, all registered through `this.host.registerEvent(...)`
(so they're torn down automatically on unload):

- `metadataCache.on("changed", file)` — a markdown file's metadata was
  re-parsed (essentially: it was saved or its content otherwise settled).
- `vault.on("create", file)` — a new markdown file appeared.
- `workspace.on("file-open", file)` — a note was opened.

All three route through `schedule(file, reason)`, a **per-file** 300ms debounce
(`Map<path, {timerId, reason}>`) — so a burst of keystrokes in one file
collapses into one scan. `vault.on("modify")` is still not among them, which
this chapter and the module's own docblock both used to claim.

> [!important] Opening a note is a trigger, and used not to be.
> The first two events both mean *the file was written*, so pasting a callout
> into a note discovered it and **opening a note that already contained one
> discovered nothing at all**. The settings tab's own open-buffer sweep was the
> only thing standing in for a trigger, and it reads
> `getLeavesOfType("markdown")` — one *visible* note per leaf. Opening five
> notes in a single tab and then opening settings therefore found the fifth
> callout and none of the other four: they had already been replaced in the
> only leaf that ever existed. `file-open` is what makes each of the five its
> own scan, and the registry is what accumulates them.

**The catch-up sweep.** `registerTriggers()` also queues one scan per note
already showing in a markdown leaf. It runs from `onLayoutReady`, which is
*after* the workspace has restored the previous session's tabs — so those
notes' own `file-open` events have already been and gone, and without the sweep
a restored tab is the one note discovery never looks at.

A leaf restored but not yet activated is a **deferred view** (Obsidian 1.7.2+):
it reports as a markdown leaf but its view is not loaded and carries no `file`
at all. Reading `view.file` alone therefore skipped exactly the tabs the sweep
exists for, so `leafFile()` falls back to `leaf.getViewState().state.file` —
serialized state, which a deferred leaf has by definition — and resolves that
path back to a handle, so the scan receives the same object every other trigger
passes it.

**The `mtime` memo.** A note is opened far more often than it is edited — every
tab switch is one — and each scan is a `cachedRead` plus a tokenizer pass. So
`markScanned(file)` records `path → stat.mtime` after any scan that ran out of
things to find, and an **open** of a file already scanned at exactly that mtime
queues nothing at all. Three rules keep it honest:

- Only opens are deduped. A write path is left alone deliberately, because it
  is also what schedules the prune (below) and a memo hit would skip that too.
- A scan that **withheld a half-typed id** is not recorded — it has not
  finished with the file, and memoizing it would make the open that commits
  the id the one open that never looks.
- `suppressRediscovery` clears the memo outright. The rediscovery hold lasts
  five seconds *and is then meant to lapse*; a memoized note is one the next
  open would not re-read, which would silently make a deletion permanent.

The memo is capped at `SCAN_MEMO_MAX_ENTRIES` (500), evicting least-recently
marked, so a long session walking a whole vault cannot hold an entry for every
note ever opened — including every note deleted since.

**Reason survives the debounce.** `"change"` beats `"open"` whichever order the
two arrive in, because only the write is owed a prune.

### Skipping tokens still being typed

```ts
activeTypingCalloutIds(app: App, file: TFile): Set<string> | null
```

Lives in [`editor/activeTypingIds.ts`](../src/editor/activeTypingIds.ts),
under `editor/` because everything it touches is an editor concern —
`workspace.activeEditor`, a cursor, and the same line tokenizer the editor
surfaces use.

Before discovering an id from a file scan, it checks whether the **active
editor**'s cursor currently sits on a line containing that id. If so, the id
is filtered out of the "unknown" list for this pass — feeding a half-typed
name straight into the autocomplete dropdown would be jarring. Discovery picks
it up on the *next* scan, once the cursor has moved off the line (i.e. the
user has effectively committed it).

> [!WARNING]
> **`scanFileNow` asks this on the `"change"` path only, and that qualifier is
> load-bearing.** "The cursor is on the line" is evidence of typing *only when
> something was just written*. Opening a note also makes it
> `workspace.activeEditor`, with the cursor at line 0 — so for the ordinary
> note, one that **starts** with `> [!alpha]`, the id sits on the cursor's line
> through no act of the user's.
>
> Asking on the open path is what made `file-open` discovery look broken while
> working perfectly: the scan ran, found the id, filtered it out as "in
> progress", and discarded it. Every note whose callout was on the line the
> cursor happened to land on was silently skipped — which is most notes — and
> the only id still reaching the settings list was whichever one that tab's own
> *unfiltered* sweep of the visible leaf could see. That is the whole of "only
> the last note's callout is discovered".
>
> Nothing is lost by not asking: the half-typed id this protects is one the
> user is still editing, and editing it produces a write, which is the path
> that does ask.

### Ids that are never unknown

`buildKnownCalloutIds` ([`manager/knownCalloutIds.ts`](../src/manager/knownCalloutIds.ts))
seeds the reserved demo ids — `new-callout-preview` and `global-style-demo` —
unconditionally, on top of everything `getAll()` reports.

It answered purely from `getAll()` before, which meant a demo id counted as
known only *while a modal held it in the preview slot*. A note that happens to
contain `[!global-style-demo]` — pasted from a screenshot, or left behind by a
crash — would then be discovered the moment that modal closed, and appear as a
row the user never made and cannot explain. See
[Callout registry § Reserved demo ids](05-callout-registry.md#reserved-demo-ids)
for the other three surfaces that reserve them.

The welcome splash's demo id (`demo`) is **not** seeded, and that is not an
oversight: it is a name a user may own, so a note writing `[!demo]` must stay
discoverable — see
[the third demo id](05-callout-registry.md#the-third-demo-id-and-why-it-is-not-in-the-set).

Both spellings are seeded, as for any known id: `scanStringForUnknownCallouts`
tests a *found* id's literal form and its identity against the set, so the pair
together is what makes `[!global style demo]` recognised too.

### Adding unknown ids as fallback rows

```ts
addUnknownCalloutsAsFallback(unknownIds: string[]): number
```

For each id, in order: skip if already registered; skip if
**rediscovery-suppressed** (see below); skip if it collides with an existing
callout under `calloutIdentity` (`findAttrIdConflict` — `registry.add()` refuses
such a row anyway, this only keeps the count honest); otherwise
build a row via `discoveredRow.ts`'s `buildDiscoveredRow(id, fallback)` and
`registry.add()` it. The whole batch is wrapped in `registry.batch()` — one
`onChange` for the entire set of new rows, not one per id, which matters a
lot when a pasted template introduces half a dozen unknown ids at once (see
[Architecture § coalescing](02-architecture.md#coalescing-why-a-single-edit-is-not-four-full-passes)).

`buildDiscoveredRow` (in
[`src/manager/discoveredRow.ts`](../src/manager/discoveredRow.ts)) is a small,
deliberately isolated module: it's the **one place** that decides what
"mirror the fallback callout's look" means, because two different code paths
build/rebuild such rows from opposite ends (a brand-new row here, and
`restyleUncustomizedFallbackRows` re-styling *existing* rows when the fallback
changes — see [Callout registry](05-callout-registry.md)) and letting them
disagree about which fields get copied was a real bug class. It spreads the
fallback's entire appearance but explicitly clears `customized`,
`externalStyle`, and `aliases`, and **deep-clones** every object field
(`icon`, `bgGradient`, `iconAdjust`) rather than copying the reference — a
naive spread would have every discovered row *and* the live fallback
definition sharing one mutable `CalloutIcon` object.

### Rediscovery suppression — the delete race

```ts
suppressRediscovery(ids: string[]): void   // CalloutDiscovery
holds(id: string): boolean                  // RediscoveryHold
```

> [!IMPORTANT]
> **This exists to fix a specific, real race.** Deleting a callout rewrites
> its vault usages with `vault.modify()` — but an *open* editor's CodeMirror
> buffer catches up with that write **asynchronously**. `SettingsTab.display()`,
> which the delete flow calls on the very next line
> (`CalloutRowActions.ts: handleCalloutDelete`), immediately scans every open
> editor's *in-memory buffer* for unknown callout ids
> (`scanOpenEditorsForUnknownCallouts`). Without suppression, that scan finds
> the just-deleted id still sitting in a buffer that hasn't caught up yet,
> and re-creates it — **one tick after it was removed** — as a fresh,
> *uncustomized* fallback row. From the user's perspective, a delete of a row
> they'd carefully customized appears to instead reset it to default styling.
>
> The fix: `suppressCalloutRediscovery(allIds)` is called **before**
> `registry.remove()`, using every id form the row owns (`vaultIdFormsFor`).
> The hold itself is keyed by `calloutIdentity`, so a leftover `[!my-id]` in
> some open buffer is the *same* key as `my id` and cannot walk past a hold
> placed on the other spelling — keyed per spelling, it did exactly that and
> re-created the row under the dash form. Passing every form still matters for
> a real alias, which is not a dash/space variant of the id.
> The suppression window is `SUPPRESS_MS = 5000` — just long
> enough to outlast the async catch-up, not a permanent block. It answers a
> **race**, not a policy: typing that same id again a minute later gets a
> brand-new fallback row, exactly as discovery is meant to do.

`suppressRediscovery` also drops the ids from the **discovery index**
(`DeviceLocalStore.forget`), and that half is not housekeeping: the hold lasts
five seconds, the index is read on every launch, so a row left in it would be
rebuilt the next time Obsidian opened — the same resurrection made permanent.

[`RediscoveryHold`](../src/manager/rediscoveryHold.ts) carries a **second**
hold with no expiry: `retiredThemeIds`, the callout types the active theme
stopped supplying. It lives in the device-local store rather than in settings —
which theme is active is a property of a machine, not of a vault, and two
devices on different themes used to rewrite that array in the same synced file.
See [`theme/retiredThemeIds.ts`](../src/manager/theme/retiredThemeIds.ts).

`runVaultScan()` (a user-requested scan) explicitly calls
`clearRediscoverySuppression()` first — a user asking for a scan means nothing
should be held back from it, even something deleted seconds ago.

### Pruning unused fallback rows

```ts
schedulePrune(delayMs?: number): void   // debounced, see below
async pruneUnused(): Promise<number>
```

Candidates: `source === "fallback"` **and** `customized !== true` **and**
`standsDown(d) === false` (which is broader than `externalStyle` alone — it
covers theme ownership too). For each candidate, every id form it owns
(`vaultIdFormsFor`) is checked against a single whole-vault usage scan
(`countCalloutUsagesMap`); a row with zero usages across every form it owns is
removed, again inside `registry.batch()`.

> [!NOTE]
> **`externalStyle` is as sticky as `customized`, for a sharper reason than
> "the user made a choice."** Pruning the row would take the flag with it,
> and the id would fall straight back under `generateFallbackCSS`'s
> `!important` catch-all — so a theme-owned callout the user explicitly
> handed back would silently start being repainted again the moment its last
> vault usage disappeared.

> [!NOTE]
> **A custom command referencing the row also blocks pruning**
> (`settings.customCommands.some(c => c.calloutId === id)`) — building a
> command for a callout is a deliberate claim on it, exactly like editing the
> row through the callout editor. Pruning here would silently delete both the
> command and any hotkey bound to it the moment the last note using the
> callout was edited away.

#### A scan schedules one only when it followed a write

`scanFileNow` ends in `pruneAfter(reason)`, which does nothing for a
`reason` of `"open"`. The question a prune answers is *"did that edit remove
the last usage of a row"*, and an open removes nothing — so with notes opened
far more often than they are written, pruning after one would have put a
whole-vault read behind every tab switch. The settings tab
(`schedulePruneUnusedFallbacks(0)`) and startup (`schedulePrune(2000)`) still
ask for their own.

#### The debounce delay is tuned for mobile, not just "feels responsive"

```ts
private static readonly PRUNE_DELAY_MS = Platform.isMobile ? 10000 : 1500;
```

A prune pass reads **every** markdown file in the vault through `cachedRead`
and tokenizes it, on the main thread. The comment in the source is explicit
about why the delay is this long, especially on mobile: "the real pattern is
one whole-vault pass shortly after the user stops typing — i.e. at the exact
moment they stop and look at the screen. On a phone, with a few thousand
notes, that reads as the editor freezing." Nothing about the pass is urgent;
the only user-visible cost of waiting longer is an orphaned row lingering a
few extra seconds in the settings list before it disappears.

`pruneSuspended` (a public field, toggled by `plugin.pruneSuspended`) is
checked at the top of both `schedulePrune` and `pruneUnused` — the callout
editor modal sets this while open, so editing a callout doesn't race a
background prune deleting the very row being edited.

### `isKnownZeroUsageFallback`

```ts
isKnownZeroUsageFallback(id: string): boolean
```

Distinct from "unknown" — an id that was **never scanned**, or was scanned
and found in use, is *not* zero-usage. Only an id a completed prune scan
explicitly confirmed has zero usages counts. This asymmetry matters:
`filterUsableCallouts` (shared by autocomplete, the public API, and the
callout-list filters) treats "might still be real" and "confirmed gone" very
differently — see [Public API](18-public-api.md#which-callouts-are-included).

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
| `scanFileForUnknownCallouts` / `scanStringForUnknownCallouts` | Ids in one file/buffer not in a known-id set — the discovery primitives |
| `countCalloutUsages` / `countCalloutUsagesMap` | Usage counts for a specific set of ids — used before delete/replace, and by the prune pass |
| `convertCalloutsToPlainTextInVault` | Strips callout markup, keeping content as plain paragraphs — see below |
| `replaceCalloutIdsInVault` | Bulk id swap, with optional title rewrite |

### First-run vault scan

Threshold: `HEAVY_VAULT_FILE_THRESHOLD = 500` markdown files
(`src/constants.ts`), a pure UX cutoff with no effect on what the scan itself
does. Below it, `main.ts`'s `runFirstRunDiscovery()` scans **silently** in
the background; at or above it, `FirstRunScanModal` asks first. Either way,
the first-run flag is only persisted **after** the chosen path completes — an
interrupted startup (crash, reload mid-scan) safely re-runs the whole first-run
flow on the next launch. See
[Plugin lifecycle](03-plugin-lifecycle.md#step-31-welcome-then-first-run-discovery-then-incremental-watchers--in-that-exact-order-deferred-to-layout-ready).

A caught scan failure (`app.vault.cachedRead` throwing mid-scan, say) is not
that crash-mid-await case: both paths call `localState.completeFirstRun()`
right after their `try`/`catch`, whether the scan threw or not, so a failure here
never retries on its own. Both paths now pair their `console.error` with a
`Notice` (`firstRun.autoScanFailed` for the silent path,
`firstRun.scanFailed` for the modal's "Scan now" button) pointing the user at
the manual remedy — Settings → Vault insights & maintenance → Re-scan vault —
since that's the only recovery a caught failure gets. See
[Logging and diagnostics § first-run vault scan](22-logging-and-diagnostics.md#first-run-vault-scan--consoleerror--notice)

> [!IMPORTANT]
> **The flag is per device**, in `DeviceLocalStore`, not in `data.json`. It was
> a claim about a vault and it is a claim about a machine: synced, it told a
> second device it had already scanned when it never had, and an imported
> profile carrying `true` suppressed that device's first run permanently.
>
> That also makes this pass double as **index recovery**. A machine joining an
> existing synced vault, or one whose local storage was cleared, has no record
> of the discovered ids — and needs exactly this scan to rebuild it, sized by
> the same threshold and asking with the same modal. There is no separate
> recovery path, because there does not need to be one.
for the full `console`/`Notice` catalog and the policy behind it.

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

No `[!id]` survives anywhere afterward — this is deliberate and load-bearing:
a live reference left behind is exactly what discovery would re-create a row
for on its next scan, silently undoing the delete.

## Delete flow

The delete flow, end to end (`CalloutRowActions.ts: handleCalloutDelete`):

```text
1. count vault usages across every id form the row owns (vaultIdFormsFor)
2. DeleteCalloutModal.prompt() → "cancel" | "delete" | "replace"
     - in use:   warns about conversion to plain text, offers "Replace instead"
     - unused:   simpler "this callout has no usages" copy
3. "replace" → hands off to the Replace flow (below); return
4. "delete", usage.fileCount > 0 → convertCalloutsToPlainTextInVault() first
5. plugin.suppressCalloutRediscovery(allIds)   ← BEFORE the remove, see above
6. registry.remove(def.id)
7. registry.cleanupUnusedIconSvgs()
8. await plugin.saveSettings()                  ← awaited explicitly, see below
9. ctx.display()                                 ← re-renders settings, scans open buffers
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

