# Persistence and caching

This document is a map of every place the plugin keeps state, whether it's
saved, cached, or purely in memory, and what happens when it's missing.

## `data.json` — the one persisted settings file

Written by `plugin.saveSettings()` → `SettingsWriter` →
`this.saveData(this.registry.toSaveData())`, Obsidian's standard per-plugin
JSON file at
`<Vault>/.obsidian/plugins/callout-studio/data.json`. Its shape is `PluginData`
(see [Data model](04-data-model.md#plugindata--the-shape-of-datajson)). Nothing
else in the plugin writes to disk except:

- The icon-pack cache (`icon-packs/`), a separate mechanism — see below.
- The Material Symbols preview webfont cache (`icon-fonts/`).
- Downloaded locale files (`translations/`).
- The user-requested CSS snippet export (`.obsidian/snippets/callout-studio-custom.css`).
- **The user's own vault notes**, via `app.vault.process()` — not a
  plugin-owned file at all, and the most consequential write the plugin
  makes since it touches arbitrary user content. The vault rewriters
  (`src/utils/vaultCalloutScanner.ts` — rename/replace-id, convert-to-plain-
  text) and the delete flow's cleanup (`CalloutDiscovery`) both go through
  this path. See [Vault discovery](10-vault-discovery.md).

  How that pass is walked lives in
  [`utils/vaultRewrite.ts`](../src/utils/vaultRewrite.ts), and the three rules
  there are what make a whole-vault write safe rather than merely correct on a
  quiet vault:

  - **`process()`, not `read()` + `modify()`.** A bulk pass runs for seconds on
    a large vault while the user keeps typing and Sync keeps landing changes.
    `process` does the read, the transform and the write under the vault's own
    lock, so an edit arriving mid-pass is rewritten on top of rather than
    overwritten by a stale snapshot. The pair it replaced left exactly that
    window open on every file.
  - **A probe first, off `cachedRead`.** `process` writes whatever its callback
    returns, so "does this file change at all" has to be settled before it is
    opened — otherwise every note in the vault takes a write, and every write
    is a sync event. Only affected files are opened.
  - **Failures are per file, not per pass.** A note that cannot be read is
    logged and skipped, and the pass continues; a bare loop over `await`s
    unwound on the first rejection and left the vault half-rewritten with
    nothing said. What was skipped is reported in one `Notice` at the end.

  `getMarkdownFiles()` is a snapshot, so each file is also re-resolved by path
  before it is touched — the same `getAbstractFileByPath(...) !== file` guard
  `CalloutDiscovery` makes before acting on a queued scan.

Every write to `data.json` happens through `registry.toSaveData()` — never a
partial patch — so understanding what that method includes/excludes (see
[Callout registry § which rows are persisted](05-callout-registry.md#which-rows-are-persisted-the-built-in-rule))
is understanding the whole persistence contract.

### When is it saved?

Every `registry.onChange` fires `void this.saveSettings()` (see
[Architecture § the data-flow loop](02-architecture.md#the-data-flow-loop)),
and roughly forty UI call sites do so directly. Because `onChange` fires at
most once per `batch()`, a multi-row import or a rename is one save, not
several.

Every one of them goes through
[`manager/SettingsWriter.ts`](../src/manager/SettingsWriter.ts), which applies
four rules the raw `saveData` call did not:

- **Concurrent saves are coalesced, not raced.** Most callers are
  `void saveSettings()`, so two could be in flight at once, each carrying a
  snapshot taken at its own moment, and the file was left to whichever finished
  last. A request made during a write now joins a single follow-up pass that
  **builds its payload when it runs** — so the file always ends up holding the
  final state, whatever order the callers arrived in.
- **A byte-identical payload is not written at all**
  ([`utils/saveGuard.ts`](../src/utils/saveGuard.ts)). The same argument
  `cssSnippetExport` already makes for the CSS snippet: every write is a sync
  event. The baseline is **the bytes we believe `data.json` holds**, and two
  events establish that belief: `commit()` after a write of ours lands, and
  `adopt()` when we have just read a file somebody else wrote. It moves only
  after a write *succeeds*, so a failed write is retried rather than suppressed
  forever.

  > [!IMPORTANT]
  > An external change **re-seeds** the baseline; it must never *clear* it.
  > `SaveGuard` used to expose `invalidate()` for exactly that, on the reasoning
  > that a baseline describing our own last write is a lie once another device
  > has written the file. The reasoning is right and the remedy was wrong — we
  > have just *read* that file, so the baseline can be corrected instead of
  > discarded. Clearing it meant the reload's own `onChange` wrote the incoming
  > file straight back at the device that sent it, and that device did the same
  > in return: an unbounded exchange, seconds apart, with no user action
  > anywhere in it. See [Multi-device sync](#multi-device-sync) property 4.
- **A whole reload writes at most once.** `SettingsWriter.hold(body)` collects
  the saves a reload provokes — `registry.load`, the discovered-row restore, the
  theme sweep, the command re-sync, each arriving as its own fire-and-forget
  `void saveSettings()` — and performs one pass at the end, which builds its
  payload then. Without it, whichever save won the race could publish an
  *intermediate* state; most sharply the window after the callout map was
  cleared and before the theme's rows were swept back, in which every
  theme-owned custom command looks orphaned and gets pruned. Re-entrant, like
  `CalloutRegistry.batch`, and a body that throws flushes nothing.
- **A session that could not read the file never writes it.**
  `SettingsWriter.freeze()`, set by the startup path alone. See
  [A file we cannot read](#a-file-we-cannot-read).

That guard only works because `mergeSavedSettings` names its fields in
`DEFAULT_SETTINGS`' order: `JSON.stringify` writes keys in insertion order, so
while the two lists disagreed, a freshly constructed registry and a reloaded one
serialized the same settings into byte-different files.

### Multi-device sync

`data.json` sits inside `.obsidian/`, so on a vault synced with Syncthing (or
any file-level sync) **both devices write the same file**. Five properties
decide whether that is safe. Issue #41 was the first three going the wrong way;
the report that followed v2.12.0 was the last two.

**1. Only user intent is written.** A row automatic discovery minted and nobody
claimed is *an observation this machine made*, not configuration. Writing it
meant a second device edited the settings file — differently — merely by
opening a synced note, seconds after the first device wrote its own version.
`selectPersistedRows`
([`manager/discoveredRowPersistence.ts`](../src/manager/discoveredRowPersistence.ts))
now excludes those rows, the same way `source: "theme"` rows have always been
excluded.

**2. What is derived, or per machine, lives outside the file.**
[`manager/DeviceLocalStore.ts`](../src/manager/DeviceLocalStore.ts) is one
`localStorage` blob, vault-scoped exactly like `StartupStyleCache`, holding:

| Field | Why it is not settings |
| --- | --- |
| `discovered` | The ids this device has seen written in notes. A cache of a vault-derived fact — the notes sync, so both devices reach the same answer on their own. Losing it costs one background scan. |
| `firstRunCompleted` | A claim about a machine. Synced, it told a second device it had already scanned when it never had. |
| `retiredThemeIds` | Derived from the *active theme*, which routinely differs between a phone and a desktop. |
| `listsExpanded` | Pure per-device UI state — folding a settings section used to rewrite the synced file. |

Only ids are kept, never a style: what a discovered callout looks like is
resolved from the current fallback at load time by the same
`buildDiscoveredRow` discovery itself uses.

**3. An external change is adopted, not clobbered.** `onExternalSettingsChange`
is implemented (`manager/settingsBoot.ts: adoptExternalSettings`); without it,
`Plugin.loadData` does not even track the file's mtime, and the plugin's
in-memory snapshot would overwrite whatever a sync client had just delivered.
It re-reads, rebuilds the registry, restores the discovered rows, **re-sweeps
the theme's overlay rows** (`registry.load()` clears them and they are never
persisted), re-syncs the custom commands and re-seeds the write guard. It is
**deferred** while a modal owns the registry, so a reload can never change the
row being edited underneath the user — and `pruneSuspended`, the flag that says
so, is the only seam that re-runs a deferred reload, which is why the two
previewing modals raise it too ([`settings/previewOwnership.ts`](../src/settings/previewOwnership.ts))
rather than leaving `pendingExternalReload` latched for the session.

The order inside it is load bearing twice over: the theme sweep runs **before**
`customCommands.syncAll()`, because `syncAll` drops any command whose callout
`registry.has()` cannot find, and the sweep is what puts the theme's callouts
back. (The sweep is also *forced* — a settings reload does not move the theme
fingerprint, so an unforced one returns having done nothing.)

> [!WARNING]
> The hook has two limits, and neither can be worked around from inside a
> plugin. The config-folder watcher behind it is **desktop only** — the mobile
> adapter has no `fs.watch`. And Obsidian's own gate is
> `_lastDataModifiedTime < stat.mtime`, strictly; Syncthing preserves the
> *source* file's mtime, so a file written on a device whose clock or write
> order put it earlier than our last local save does not fire it at all.
>
> This is why the real fix is property 1 — a passive device that writes nothing
> gives the sync client nothing to reconcile. The hook is the second line of
> defence, not the first.
>
> A third quirk is worth knowing because it looks like a bug in *our* code:
> `Plugin._onConfigFileChange` assigns `_lastDataModifiedTime = <the mtime it
> read before awaiting us>` **after** the handler returns, rolling back the
> stamp `saveData` set during it. So Obsidian re-fires the hook for our own
> saves. `adoptExternalSettings` answers that by comparing the incoming file
> against the guard's baseline and returning before it rebuilds anything.

**4. Adopting a file must not provoke a write.** This is the one v2.12.0 got
wrong, and it was worse than the bug it replaced: a device rewrote `data.json`
on *every* external change it received, so two devices ping-ponged the file
between them every few seconds until it was destroyed. The chain was
`invalidate()` → `restoreDiscoveredRows` re-adds this device's rows → `onChange`
→ `void saveSettings()` → a guard that had just been switched off. Every link
was reasonable on its own. Re-seeding the baseline (above) breaks it, and
`hold()` makes "a reload writes at most once" structural rather than incidental.

**5. Two devices holding the same state must serialize the same bytes.** The
guard compares serialized output, so any field whose order depends on *this*
machine's history is a permanent source of real, meaningless differences that no
write suppression can suppress. `mergeSavedSettings` already handles the settings
object by naming its fields in `DEFAULT_SETTINGS`' order. `iconSvgCache` did not:
it is appended to in fetch order, so two devices with identical artwork wrote
byte-different files forever. It is now sorted on the way out by
`(pack, name, variant)` — the same triple `addIconSvg` dedupes on, so the order
is total — in
[`manager/iconSvgCacheOrder.ts`](../src/manager/iconSvgCacheOrder.ts), with a
code-unit comparison rather than `localeCompare`, which would put a Turkish
phone and an English desktop back into disagreement.

### A file we cannot read

`Plugin.loadData()` returns a nullish value for two situations that could not be
more different, and conflating them is how a sync conflict became data loss.
[`manager/settingsFile.ts`](../src/manager/settingsFile.ts) separates them:

| Verdict | How it is reached | What happens |
| --- | --- | --- |
| `absent` | nullish, and the adapter says there is no file | A fresh install — but only on a device with no index of its own, and only until the second look confirms it. See below. |
| `loaded` | a parsed object | Normal. Its re-serialized form seeds the guard. |
| `unreadable` | nullish (or a non-object) while the adapter says the file **is** there — or the adapter itself throws | Change nothing. |

Obsidian does distinguish the two internally — `Vault.readJson` returns `null`
only for `ENOENT` and `undefined` for every other read or parse failure — but
that is private behaviour of a minified bundle, not an API promise, so the
adapter is asked the question that *is* stable.

The two callers answer `unreadable` differently, and both answers matter:

- **The reload path** returns immediately: no `registry.load`, no re-seed, no
  write. The state in memory is the last thing known to be good.
- **The startup path** has no earlier state to protect, so the registry does come
  up holding only the built-ins — but `SettingsWriter.freeze()` takes the file
  off the table for the session and the user is told, because otherwise the very
  next save replaces a file we failed to understand with one we know is wrong.
  It also registers `watchForLateSettings`, because "unreadable" is a transfer
  still in progress far more often than it is corruption, and on a phone nothing
  else is going to notice when it finishes. Until that was added, a mobile
  launch that landed mid-write showed no callouts for the whole session and
  could do nothing about it but wait for the user to restart the app.

This is not hypothetical. The reporter's screenshot showed alternating conflict
copies where every copy from one device was exactly **0 bytes**, and
`JSON.parse("")` throws.

### A file that is not there yet

`absent` had the opposite failure, and issue #53 is what it costs. A sync client
delivers a plugin folder as files, not as a transaction, so `main.js` can be in
place and running while `data.json` is still on its way — and it renames the
local copy aside while swapping in a remote one, leaving a window in which the
file genuinely does not exist. Read as "a fresh install", both windows end with
the shipped defaults written over settings that were about to arrive, and the
sync client carries that loss to every other device.

On mobile there is nothing downstream to catch it. Obsidian's config-folder
watcher is desktop-only, so `onExternalSettingsChange` never fires on a phone: it
reads `data.json` once, at `onload`, and never again.

Two things separate a fresh install from a file in flight, and neither is
available at the moment of the read:

- **The device's own memory.** `DeviceLocalStore.hasIndex` is false only where
  this plugin has never completed a launch in this vault, because every launch
  writes the discovery index back. A device that *has* an index and no
  `data.json` is not new — its settings file has gone missing since it last ran,
  and `loadSettingsInto` freezes the writer exactly as it does for an unreadable
  one.
- **Time.** A first launch has no index either, so nothing at load time can rule
  out a device the vault has only just reached. What rules it out is looking
  again later: [`manager/settingsLateArrival.ts`](../src/manager/settingsLateArrival.ts)
  re-reads once the workspace is ready, and adopts a file that has turned up
  instead of replacing it.

So the session **writes nothing until that second look**. `loadSettingsInto`
freezes the writer on this branch too, and `confirmFreshInstall` — called from
[`manager/launchSequence.ts`](../src/manager/launchSequence.ts) at
`onLayoutReady` — ends the freeze one way or the other: `thaw()` if the folder is
still empty, or an adoption if the file arrived. The welcome screen then creates
`data.json` exactly as it always has, and `maybeShowWelcomeOnLaunch` takes the
answer as an argument rather than re-reading anything itself.

> [!IMPORTANT]
> The freeze is the point, and guarding the *creating write* instead is what
> shipped in 2.12.1 and left #53 open. `welcomeSeen` is the first write a fresh
> install makes, so re-checking there looks sufficient — but it is not the only
> write that can happen first. `void icons.initialize()` and any `css-change`
> theme sweep reach `saveSettings` on their own schedule, unordered against
> `onLayoutReady`, and on this branch `SaveGuard`'s baseline is still `null`, so
> nothing suppresses them. Whichever fires first publishes the shipped defaults,
> and the sync client carries that to every other device.
>
> A pre-write check inside `SettingsWriter` is the obvious repair and it
> **deadlocks**. `runPass` is what `inFlight` holds; a check that adopts calls
> `reloadFrom`, whose `hold()` releases with `await this.save()`, and that
> `save()` — seeing `inFlight` set — returns a `followUp` chained on the very
> `runPass` awaiting it. A closed promise cycle, on exactly the path the check
> exists for. `frozen` is the only writer-level gate that is safe here, because
> it is a synchronous boolean read at the top of `save()`: a re-entrant save
> resolves immediately instead of joining a promise the gate is awaiting.
>
> Nothing is lost by suppressing rather than deferring — `runPass` builds its
> payload at write time, so anything mutated during the freeze rides the first
> write after it.

There is one asymmetry worth keeping in mind: `confirmFreshInstall` must be
called **only** for this freeze. The `absent && hasIndex` freeze reports "still
nothing there" too, and thawing it would write the built-ins over settings that
have merely gone missing.

`watchForLateSettings`
covers the rest of the session, which on mobile is otherwise not covered at all:
it listens for the app returning to the foreground — the moment a sync client has
most likely just run — and adopts a settings file that has appeared since. Every
launch that came up without usable settings registers it — missing, missing-on-a
-known-device, and unreadable alike — so a frozen device recovers on its own
rather than waiting for a restart. It stops at the first file it **adopts**,
stays silent while there is still nothing there, and defers while the callout
editor owns the registry.

> [!IMPORTANT]
> Seeing *our own* file on disk is not a reason to stop watching. The watcher
> used to treat `matchesLastWrite` as "settled", and on the one path where the
> baseline is not null — a fresh install that has written its own `data.json` —
> that is precisely the session still waiting on a sync client. Syncthing's floor
> is a ten-second scan delay with an hourly rescan behind it, so "nothing has
> landed yet" is the normal state for a long time, and retiring the watcher on it
> disarmed the only mechanism a phone has.

**Adopting is what ends a freeze**, and `reloadFrom` does it as its first act, so
both adoption paths get it — the desktop watcher and the mobile foreground check.
It is reached only with a `loaded` read in hand: the baseline it then seeds
describes what is on disk, so saving asserts nothing the file does not already
say. The thaw comes **before** the hold rather than after, because
`applySettingsRead`'s convergence flush runs inside that hold and a writer still
frozen at that moment would drop a load-time migration on the very path that just
recovered.

Without that thaw, a session that recovered went on *looking* right — the
callouts come back and the settings tab repaints — while every edit the user made
from then on was discarded at the `frozen` check. On desktop that is the whole
session after a single mid-write launch, announced by nothing.

Neither check is a `SettingsWriter` pre-write hook, which is the other obvious
home for both — see the deadlock above. Adopting a file rebuilds the registry, a
rebuild asks for saves of its own, and those saves do not merely *queue* behind
the write pass waiting on the check: `hold()` awaits its own release, so they
close a cycle with it. At a seam between writes there is no such knot.

**The freeze carries its own way out.** "The file is coming back" is true of a
sync client mid-swap and false of a user who deleted `data.json` themselves to
start over, and for that second user a freeze with no escape would mean every
launch from here on silently discarding their work. So the notice announcing a
missing file offers **Start fresh on this device** — see
[`manager/settingsNotices.ts`](../src/manager/settingsNotices.ts). That button
and `reloadFrom` are the only two callers of `SettingsWriter.thaw()`, and they
are the only two things that can answer the guess: the user saying the file is
gone for good, or the file itself turning up. What still never happens is a thaw
on a hunch — no timer, no retry count, no "it has probably finished by now".

`tests/syncMobileWipe.test.ts` holds all of this, with the device shape the rest
of the sync suite could not express: no `adoptExternalSettings`, startup as the
only entry point.

### Settings merge — never a raw spread

```ts
mergeSavedSettings(savedSettings: LegacySavedSettings): PluginSettings
```

[`src/utils/settingsMerge.ts`](../src/utils/settingsMerge.ts) rebuilds
`PluginSettings` from possibly-partial, possibly-ancient saved data by naming
**every field explicitly** against `DEFAULT_SETTINGS`, all the way down into
nested sections (`globalStyle` has its own module,
[`globalStyleMerge.ts`](../src/utils/globalStyleMerge.ts), because it's deep
enough to warrant one).

> [!WARNING]
> This is deliberately *not* `{...DEFAULT_SETTINGS, ...saved}`. A spread is
> total in *shape* but blind to anything **extra** the saved file carries — a
> key the current version knows nothing about would ride straight through
> unchanged, and because settings are written back wholesale by both
> `toSaveData()` and `exportToJSONv2()`, it would then be re-saved forever and
> copied into every export made from then on. Retiring a field by `delete`ing
> it by name only cleans up the one field someone remembered to name. Naming
> every field that *stays* here is what makes "unknown fields are dropped"
> actually true at every depth, not just the top level.

The same function is shared by two callers that ask the identical question —
"what does this possibly-partial, possibly-ancient blob mean under the current
version" — the registry's `load()` on startup, and `settingsValidator` on
every JSON import.

`mergeMenuItems()` inside the same file is the other notable piece: it merges
a saved per-role context-menu item **list** (order matters) against that
role's defaults — unknown ids dropped, duplicates dropped, items introduced by
a *newer* plugin version appended at the end — and folds in the pre-1.2.2
three-boolean "popup" toggles (`legacyMenuState()`) so an upgrade from that era
doesn't silently switch a hidden menu item back on.

## In-memory-only state (never persisted)

| State | Owner | Rebuilt from |
| --- | --- | --- |
| `CalloutDiscovery`'s debounce timers | `CalloutDiscovery` | N/A — pure runtime scheduling |
| The rediscovery-suppression map (`RediscoveryHold.deleted`) | `CalloutDiscovery` | N/A — a 5-second window after an explicit delete |
| The "known zero usage" fallback-id set | `CalloutPrune` | Recomputed by the next `pruneUnused()` scan |
| Rows for discovered ids nobody has claimed | `CalloutRegistry` | Rebuilt at startup from `DeviceLocalStore`'s id list — no vault read |
| `SettingsWriter`'s belief about what is on disk | `SettingsWriter` | Seeded by the load at startup, and re-seeded whenever an external change is adopted |
| `CSSInjector.lastCssText` | `CSSInjector` | Recomputed by the next `inject()` |
| The registry's transient live-preview slot | `CalloutRegistry` | Cleared automatically when the editor modal closes |
| `IconFetchManager`/`PackDataStore` in-flight promise maps | `IconService` | Nothing to rebuild — just de-duplicates concurrent requests |
| `LocaleStore`'s per-file load state and in-flight map | `LocaleStore` | Re-derived by `prepare()`/`ensure()` on next launch |
| The `i18n/index.ts` module-level locale table map | `i18n/index.ts` | Re-populated by `registerLocaleFile` when a file is read/downloaded again |
| `startupEntranceActive` flag | `renderShared.ts` | Reset every launch; closes itself after `STARTUP_ENTRANCE_MS` |
| The Live Preview content-pill render cache | `contentPillRender.ts` | Cleared on unload and by `plugin.refreshCallouts()` — **not** by every registry change; the generic `registry.onChange` listener in `main.ts` only re-injects CSS, it never calls `refreshCallouts()`. An ordinary `CalloutEditor` save does not clear this cache. Explicit callers include the external-style toggle, fallback-callout changes, row delete/reset, and discovery's prune. |

All of these share one property: losing them costs nothing but a moment of
recomputation. None of them is a source of truth for anything the user would
notice missing after a restart.

## Generated/derived state

- **The adopted stylesheet and `<style>` element text** — entirely derived
  from the registry; regenerated on every `inject()`.
- **DOM icon artwork** (the `::after` mask images in CSS, and the baked
  `<svg>`/`<span>` copies in the DOM) — derived from `iconSvgCache` +
  whatever's on disk; repainted by `paintIcons()`.
- **The Outline pane's cleaned heading titles** — derived by `OutlineDecorator`
  from the registry's current definitions; recomputed on `layout-change` and
  on every registry change.
- **CodeMirror's Live Preview widget DOM** for heading/inline tokens — rebuilt
  by `refreshAllCalloutEditors()` whenever the registry changes (registry
  mutations don't touch the document text, so CodeMirror has no reason to
  rebuild its own decorations without being asked).

## The device-local store

[`src/manager/DeviceLocalStore.ts`](../src/manager/DeviceLocalStore.ts) is the
second `localStorage` layer, alongside the CSS snapshot below and keyed the same
way. What it holds and why none of it belongs in `data.json` is in
[§ multi-device sync](#multi-device-sync); the mechanics are deliberately the
same as `StartupStyleCache`'s, down to advancing the write memo **only after the
write lands** so a refused write is retried rather than remembered as a success.

One asymmetry is load bearing: a blob that is missing, corrupt, or from a
version this build does not know reads as **absent**, never as empty. "Absent"
asks for a scan; "empty" would say this vault genuinely uses no discovered
callouts, and getting that wrong hides every row with no way back but the
settings button.

## The startup CSS snapshot

[`src/manager/StartupStyleCache.ts`](../src/manager/StartupStyleCache.ts) is
**one layer, `localStorage`, per device**, deliberately with no settings
toggle (the README states this explicitly under "What is stored locally").

```ts
loadCachedCss(): string | null    // synchronous read
persist(cssText: string): void     // called at the end of every inject() whose text changed
```

The key is vault-scoped:
`${appId ?? vault.getName()}-callout-studio-css` — `App.loadLocalStorage`'s
own `${appId}-${key}` convention, replicated by hand because that public API
requires Obsidian ≥1.8.7 while this plugin's `minAppVersion` is lower.

The snapshot holds the **exact text** the adopted stylesheet gets, so the
handoff from cached-snapshot to freshly-generated CSS is invisible — there's
no partial or summarized form. `CSSInjector.injectFromCache()` reads it as the
literal first statement of `onload()`, before `loadData()` is even awaited
(see [Plugin lifecycle](03-plugin-lifecycle.md#step-3-the-startup-css-fast-path)).
A stale snapshot self-heals automatically: the very next `inject()` (once the
registry is populated) persists fresh CSS over it.

> [!NOTE]
> `persist()` is skipped while a transient live-preview definition is
> registered (`registry.hasPreviewDefinition()`). That CSS describes an unsaved
> draft — `toSaveData()` already goes out of its way to keep drafts off disk —
> and hovering a colour swatch in the palette menu would otherwise cost a
> synchronous `localStorage` write on every hover. Closing the preview
> re-injects the committed state, which persists normally.

`persist()` also memoizes on `lastPersisted` to skip redundant writes, and —
notably — only updates that memo **after** the write actually succeeds (a
`try` failure due to quota leaves the memo unchanged, so a later session where
storage frees up will retry rather than silently never writing again for the
rest of the session).

### What this deliberately does not cover

The window **before the plugin loads at all** — nothing running inside a
plugin can affect that. Versions up to 2.5.0 covered *that* window with a
second copy of the CSS written into the vault as an auto-enabled snippet
(`.obsidian/snippets/callout-studio-do-not-delete.css`), switched on through
Obsidian's internal `app.customCss`. That layer cost a ~100 KB file (and a
sync event) per style change, and — because nothing ever cleaned it up —
outlived the plugin on uninstall, leaving a dangling name in
`appearance.json` forever.

### Cleaning up the old snippet layer

[`src/manager/legacyStartupSnippet.ts`](../src/manager/legacyStartupSnippet.ts)
deletes that leftover file (and disables its name in `appearance.json` via the
undocumented `app.customCss` API) on **every launch**, deferred to
`workspace.onLayoutReady` so its one `exists()` stat never sits on the startup
path.

> [!CAUTION]
> This runs on every launch — not once behind a `data.json` flag — because a
> flag would *sync*: it could reach a second device before the orphan file
> itself synced there, and that device would then never clean up. It also
> covers a device still literally running 2.5.0 that keeps re-creating the
> file. The whole module (plus its one call site in `main.ts`) is marked for
> deletion in version 3.0.0, once every vault has launched a version that
> cleans up.

## The user-requested CSS snippet export

A completely different, **current** feature — see the file-header comment in
`cssSnippetExport.ts` for the explicit contrast with the legacy auto-snippet
above. Key properties:

- **Written only on request** (`Settings → Import/export → Export → CSS
  snippet`), to `.obsidian/snippets/callout-studio-custom.css`, and **never
  enabled** by the plugin.
- **A snapshot, not a live link.** Nothing updates the file after export;
  re-export to bring it current.
- **Byte-identical re-export writes nothing at all** — `classifyExisting()`
  hashes the file's own body (SHA-256, stored in its header as a
  `fingerprint:` line) and compares against a freshly rebuilt body. If they
  match, the write is skipped entirely, because every vault write is a sync
  event.
- **A foreign or hand-edited file triggers a confirmation** before
  overwriting — `classifyExisting()` returns `"foreign"` for anything that
  doesn't start with the exact marker comment, doesn't have a parseable
  fingerprint line, or whose fingerprint doesn't match its own body.
- **`isSnippetEnabled()` can report `true` on the very first export of a
  session**, which reads as a bug but isn't: Obsidian's `enabledCssSnippets`
  is a list of *names*, and nothing prunes a name whose file has been deleted.
  If the user enabled this snippet once and later deleted the file, the very
  next export brings the name back to life — already switched on. The
  plugin surfaces this as a warning rather than silently enabling or
  disabling anything.

## Icon artwork storage — three layers

Icon persistence spans three genuinely different mechanisms, covered in full
in [Icons](12-icons.md), summarized here for the "what's stored where" view:

| Layer | Where | Persisted? | Verified how |
| --- | --- | --- | --- |
| `iconSvgCache` (per-icon, in use) | `data.json` | Yes — syncs with the rest of settings | Trusted (it's this plugin's own settings file) |
| Downloaded pack files (Tabler, FA, Octicons, RPG Awesome) | `<plugin-dir>/icon-packs/*.json` | On disk, outside `data.json` | SHA-256 checked on download **and on every disk read** |
| Material Symbols preview webfont | `<plugin-dir>/icon-fonts/*` | On disk | Not integrity-checked (a rendering aid, not artwork of record) |

`iconSvgCache` is the layer that makes a callout keep rendering correctly on a
device that synced settings but never downloaded the pack, and after a cached
pack file is deleted from disk — the SVG the callout actually needs is
already sitting in `data.json`.

## Locale file storage

Covered fully in [Localization](16-i18n.md). Summary for this document's
purpose: downloaded locale JSON lives at
`<plugin-dir>/translations/<file-id>.json`, outside `data.json`, SHA-256
verified against a manifest baked into the build. A hash **mismatch on disk**
is treated as *staleness* (an older build's copy, missing newer strings) and
used anyway while a background refresh runs — deliberately different from a
hash mismatch **from the network**, which is discarded outright. English never
needs a file at all; it's bundled in `main.js`.

---
Next chapter: [08-render-roles.md](08-render-roles.md)
