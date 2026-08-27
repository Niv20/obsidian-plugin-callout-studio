# Vault discovery, statistics, replace, and delete

This covers everything that keeps the registry synced with what's actually
written in the vault: auto-discovery of unknown callout IDs, pruning stale
auto-created rows, the statistics modal, bulk replace, and the delete flow.

## `CalloutDiscovery` — the coordinator

[`src/manager/CalloutDiscovery.ts`](../src/manager/CalloutDiscovery.ts) owns
its own debounce timers and is destroyed via `destroy()` on plugin unload. It
does not scan the vault itself — the scanning primitives live in
`utils/vaultCalloutScanner.ts` (shared with statistics and replace, see
below); this class decides *which ids*, *when*, and *what guards* apply.

### Where events come from

```ts
registerIncrementalWatchers(): void   // called from main.ts's onLayoutReady
```

Two Obsidian events, both registered through `this.host.registerEvent(...)`
(so they're torn down automatically on unload):

- `metadataCache.on("changed", file)` — a markdown file's metadata was
  re-parsed (essentially: it was saved or its content otherwise settled).
- `vault.on("create", file)` — a new markdown file appeared.

Both route through `scheduleFileScan(file)`, a **per-file** 300ms debounce
(`Map<path, timerId>`) — so a burst of keystrokes in one file collapses into
one scan.

### Skipping tokens still being typed

```ts
private getActiveTypingCalloutIds(file: TFile): Set<string> | null
```

Before discovering an id from a file scan, it checks whether the **active
editor**'s cursor currently sits on a line containing that id. If so, the id
is filtered out of the "unknown" list for this pass — feeding a half-typed
name straight into the autocomplete dropdown would be jarring. Discovery picks
it up on the *next* scan, once the cursor has moved off the line (i.e. the
user has effectively committed it).

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
suppressRediscovery(ids: string[]): void
private isRediscoverySuppressed(id: string): boolean
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
> The suppression window is `REDISCOVERY_SUPPRESS_MS = 5000` — just long
> enough to outlast the async catch-up, not a permanent block. It answers a
> **race**, not a policy: typing that same id again a minute later gets a
> brand-new fallback row, exactly as discovery is meant to do.

`runVaultScan()` (a user-requested scan) explicitly calls
`clearRediscoverySuppression()` first — a user asking for a scan means nothing
should be held back from it, even something deleted seconds ago.

### Pruning unused fallback rows

```ts
schedulePrune(delayMs?: number): void   // debounced, see below
async pruneUnused(): Promise<number>
```

Candidates: `source === "fallback"` **and** `customized !== true` **and**
`externalStyle !== true`. For each candidate, every id form it owns
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
`settings.firstRunCompleted` is only persisted **after** the chosen path
completes — an interrupted startup (crash, reload mid-scan) safely re-runs the
whole first-run flow on the next launch. See
[Plugin lifecycle](03-plugin-lifecycle.md#step-31-welcome-then-first-run-discovery-then-incremental-watchers--in-that-exact-order-deferred-to-layout-ready).

A caught scan failure (`app.vault.cachedRead` throwing mid-scan, say) is not
that crash-mid-await case: both paths mark `firstRunCompleted = true` right
after their `try`/`catch`, whether the scan threw or not, so a failure here
never retries on its own. Both paths now pair their `console.error` with a
`Notice` (`firstRun.autoScanFailed` for the silent path,
`firstRun.scanFailed` for the modal's "Scan now" button) pointing the user at
the manual remedy — Settings → Vault insights & maintenance → Re-scan vault —
since that's the only recovery a caught failure gets. See
[Logging and diagnostics § first-run vault scan](22-logging-and-diagnostics.md#first-run-vault-scan--consoleerror--notice)
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
### Replace flow

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

