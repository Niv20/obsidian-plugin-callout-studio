# Persistence and caching

## `data.json` — the persisted settings file

Every user-defined and manually discovered callout is durable configuration.
`CalloutRegistry.toSaveData()` includes uncustomized `source: "fallback"` rows.
Only unchanged built-ins and live previews are excluded; legacy theme overlay
rows found in saved data are migrated to durable fallback rows. Both JSON export
formats include manual results. Settings data format **5** prevents compatible
older builds from silently applying their old ephemeral-row persistence policy.

`SettingsWriter` serializes/coalesces writes, takes an isolated snapshot, skips
identical content, and re-reads the file immediately before writing. A missing
previously read file, unreadable file, changed baseline, or frozen writer blocks
that write. Adoption re-seeds the canonical baseline rather than clearing it.
A write that changes nothing does not create a sync event.
A loaded file becomes the baseline only after the registry rebuild succeeds.
A failed rebuild freezes writes and leaves the failed file eligible for retry.
Unloading destroys the writer and reload queue, cancels pending stale notices,
and invalidates queued or pre-write operations. A physical adapter write that has
already begun cannot be cancelled, but it cannot launch another save or publish
manual results into the unloaded instance.

## Saving status and explicit recovery

`SettingsSaveStatus` separates a frozen session's reason from the most recent
failed operation. File absence, malformed settings, newer data, recovery reads,
recovery writes, required backups, primary writes and external changes have
separate messages. The settings page and callout editor subscribe to just the
status banner; status changes do not rebuild the form or reset settings scroll.
Subscriptions are disposed when those surfaces close. Error wrappers preserve the
original exception for console diagnosis. Persistence errors always use English
copy, independent of the UI locale; raw adapter errors and paths stay in the console.
Known storage codes distinguish exhausted space/quota from denied write access.
`settingsSaveReporter.ts` shares a single notice across background writes, the editor,
and deferred guards; recovery clears it. Status observer failures cannot interrupt
persistence. Successful retry/adoption cancels queued stale notifications and
invalidates unfinished freshness checks. When an identical primary file returns
after a transient missing/unreadable read, its obsolete warning is cleared without
a settings rewrite.

`settingsRecoveryActions.ts` provides explicit retries, including unchanged valid
primary files after a recovery-store failure. Only an explicit retry bypasses the
normal echo fast path; background retries retain it to avoid a failed-write loop.
A checkpoint failure during initial adoption freezes saving while still loading
the validated settings and allowing the plugin UI to finish opening.

Reinstallation can leave a prior-use marker after the settings file is deleted.
It remains protected until settings arrive or the user confirms creating a new
file. That action is available persistently in settings, rechecks stable absence,
preserves a readable previous checkpoint in a vault backup, and uses the writer's
ordinary before/after-checkpoint freshness checks. It reports success only after
persistence. Missing-file protection remains in place after a failed attempt.
Missing-file startup also reads the checkpoint before deciding that this is a new
installation: the first attempted primary write may have failed after checkpointing,
without setting the initialized marker. Such a copy is displayed while saving remains
protected; confirmed recreation keeps the displayed definitions. A boot-time failure
to read that copy can be retried even while the primary file remains absent.
Checkpoints from a newer build cannot be replaced through the new-file action.

A migration's primary-write failure leaves the plugin UI available for retry.
If the adapter rejects after actually replacing the primary file, the writer accepts
success only after reading back the exact intended payload. An unchanged save still
retries a previously failed final checkpoint rather than silently skipping it.

## Manual discovery transaction

`ManualCalloutDiscovery.run()` snapshots saved settings, scans saved notes and
collects current theme ids, then stages new rows in a separate registry. It
checks aliases, equivalent id spellings and reserved preview ids. Nothing touches
notes. A failed/changing note or concurrent settings change cancels the scan.
`SettingsWriter.commit(data, isCurrent, publish)` checks disk freshness, saves,
and publishes accepted rows in one batch only after the write succeeds. Another
click joins the operation. No results are locally cached or automatically pruned.

## Multi-device sync

There are no discovery-specific synchronization settings.
The ordinary settings file carries manual results to another device; opening it
never discovers additional rows. A subsequent explicit scan adds missing ids,
leaving existing definitions and commands intact. Different themes affect only
rendering ownership; they cannot alter the stored list in the background.

External adoption is serialized even when explicit recovery bypasses `ReloadQueue`.
It rechecks disk content, registry ownership, and local edits after the checkpoint
await before replacing the registry. Storage preflight checkpoints only previously accepted data; the incoming merge
is checkpointed after adoption. Cancellation or unload during preflight cannot
make speculative incoming data a later recovery baseline.
A frozen writer remains frozen until these checks pass. Legacy recovery copies
without sync stamps are joined as older baselines; they cannot replace a newer
unstamped primary file and remove newly received rows.
External adoption uses `ReloadQueue` and waits while a settings editor, preview,
or file write owns the registry. Incoming events during a read cause a subsequent
read, so the later state is not dropped. Before adopting a file that changes or
removes any local callout row, or replaces saved preferences, palettes, commands
or image artwork, `settingsConflictBackup.ts` stores the current
configuration in `backups/data-<timestamp>-<uuid>.json`. The id prevents two devices
creating a backup in the same millisecond from overwriting each other. Keep the
latest five copies, always preserving the copy just written even if another
device's clock is ahead. Only the exact generated filename patterns are pruned.
Recovery bytes are captured before awaited adapter operations, so edits while a
folder is being created cannot change the copy. Failure to create a required backup defers adoption; a local
edit during the backup also defers it. Backup locations are logged to the console; individual copies do not each produce a popup.

Startup, fresh-install confirmation, and changed external files require two
matching content reads 150 ms apart, with at most three additional reads. A
continuously changing file is treated as unavailable; metadata and wall-clock
ordering are not used to establish its baseline. Canonical equality skips local
write echoes without adding a settling delay. Missing or unreadable external
files get up to three queued retries after 250, 750, and 2000 ms. A new event or
foreground starts a new retry budget. There is no continuous polling, and unload
cancels queued retries. Backup failures remain deferred without automatic retry
notices. A save or editor release during an adoption is retained even before the
pending flag is set, so that wakeup cannot be lost during a recovery backup.
Once a settling cycle has observed a file or an unreadable state, later absence
cannot turn it into a fresh installation; only stable loaded content can recover it.

`settingsSync.ts` adds a versioned `calloutStudioSync` envelope to `data.json`
on the first actual edit. It records Lamport counters and random session actor
ids for changed JSON paths; wall clocks do not decide conflicts. `syncTree.ts`
represents callouts, palettes, images, custom commands, menu items and icon cache
entries as keyed lists. Objects merge by field; ordinary arrays (including aliases)
and complete icon identities remain atomic. Legacy icon-subfield clocks are folded
into the icon identity clock, avoiding a pack/name combination that neither user chose. List ordering has a deterministic winner and concurrently added
ids are retained. A deleted row keeps path tombstones, so delayed snapshots cannot
resurrect it. Deletion wins over concurrent edits inside that deleted row; explicit
recreation after observing the deletion uses a later counter. Tombstones are not
pruned because a device may remain offline indefinitely.

The production `SettingsWriter` stamps writes only after building an isolated
snapshot. It advances committed sync state only after the write succeeds. During
external adoption, it combines the incoming snapshot with its last adopted/saved
state and any unsaved in-memory changes. Both the local and incoming versions are
checked for lost content; any losing version requires a recovery copy before the
registry changes. The merged registry adopts the actual incoming disk bytes as
its freshness baseline, then writes the merged result through the ordinary guard.
A failed merged write remains retryable and is never reported as durable to an
editor. Duplicate deliveries and no-op saves do not cause further writes.

Both devices must run a build with this merge protocol. An unstamped legacy file
cannot undo stamped edits or tombstones; changes made by older builds may therefore
require recovery from the incoming backup. Before either side has stamped state,
unsaved local changes merge relative to the last observed snapshot, while an
incoming-only change follows ordinary adoption. Unknown
or malformed sync envelope versions are unreadable and cannot authorize a rewrite.
The envelope is carried by the existing foreign-field preservation, and ignored
when deciding whether metadata alone needs a recovery backup.

Envelope version 2 fingerprints both the content and the stamp map, excluding the
fingerprint itself. `syncFingerprint.ts` is a deterministic corruption checksum,
not cryptographic authentication. A provider-combined body/stamp map or an external
manual edit retaining stale metadata fails validation. Version 1 remains readable
for migration but has no such integrity check. Update both devices: older builds
cannot understand version 2. A fingerprint failure preserves the file and defers
adoption; it must not be silently restamped as a legitimate user edit.

`SettingsCheckpoint` stores one complete recovery snapshot per vault/config-profile/
plugin in the app's `CalloutStudioRecovery` IndexedDB database. It never writes a
recovery sidecar into the synced folder. Read/write transactions request strict
durability and wait for transaction completion rather than request success. Abort,
quota, blocked-open and unavailable-storage errors propagate. Opens time out after
five seconds; late connections are closed and open connections close on version-change
requests. A TypeError rejecting transaction options retries without the options for
older embedded browsers; permission and storage errors do not use that fallback.
Both transaction paths wait for completion. Snapshots are checked by the same shape and
integrity gate as `data.json`. Disabling/uninstalling does not erase this device-local
copy; clearing app data does, and an explicit plugin reset updates the copy.
Recovery-store opening is bounded at five seconds and transactions at ten seconds.
A timed-out transaction is aborted and its connection closed. Late success events
cannot revive a failed operation; later saves can retry. Request success alone
still does not count as a committed transaction.

For ordinary registry saves, the writer saves the checkpoint before writing `data.json`, then repeats its
freshness/cancellation checks because external state can change during the local
transaction. A failed primary-file write leaves the intended state recoverable.
Isolated manual commits preflight storage with the currently accepted registry,
then write and publish the candidate before checkpointing it. A cancelled candidate
cannot reappear through recovery. Failure of this final checkpoint is reported after
publication, since the primary file already changed; a crash between those two writes
can leave the checkpoint one isolated commit behind.
Incoming adoption also remembers validated snapshots. `settingsRecovery.ts` joins
the checkpoint on startup, making closed-plugin replacements recoverable. Reloads
also consult it, including after a launch inside a missing-file window. Lost local,
incoming, checkpoint or conflict-file content must be backed up before replacement.
If a recovery read fails, saving is frozen and its bytes are not overwritten. A
foreground check can recover the session after storage becomes readable even when
the primary file has not changed. A corrupt primary file can display a readable
checkpoint while keeping all writes frozen.

`settingsConflictFiles.ts` reads explicitly recognized Syncthing and Conflicted-copy
filenames in this plugin directory. It requires two identical reads, settings shape
validation and a supported envelope, and never deletes copies. Unstamped or damaged
copies remain available for manual recovery. Primary-file echoes still scan for
new conflict copies; an already incorporated copy creates no extra data writes.
Only startup/external/foreground events drive this; there is no claim that every
provider generates config change events for every conflict filename.

An open editor/preview still defers background registry adoption. The explicit
editor recovery action uses an editor-scoped adoption option while retaining editor
ownership, so the background queue cannot race it. Preview and in-flight writer
ownership still block adoption. The form is preserved for review and another Save.
Pending note work can reject an incoming merge that changes its required definition. Unsaved form state is not
a durable settings write. These mechanisms do not control note synchronization,
provider exclusions, file-size limits, storage eviction, OS power failures, account
availability or permanent loss of every surviving copy. They are not a distributed
filesystem lock or proof of compatibility with all cloud sync providers.

Tests include field/identity conflicts, deletion and recreation, legacy clocks,
300 seeded four-replica runs with 70 scheduled operations each, duplicate/reordered
messages, restarts and a large Unicode payload. Filesystem integration uses the
production registry/writer/loader/queue with injected independent checkpoint storage;
it covers closed-plugin overwrite, primary-write failure, missing-file startup,
quota/read failures, copy-file recovery and integrity mismatch. The actual IndexedDB
driver is also exercised by transaction-boundary unit tests; a separate local browser
smoke test verified persistence over page reload and vault isolation. None of these
is a live end-to-end test of two physical devices or a provider's cloud service.

## Missing or unsupported settings

`settingsFile.ts` distinguishes absence from unreadable/malformed data and catches
adapter read failures. Startup freezes an unreadable/newer file. An unreadable primary file displays
a valid recovery copy when available; otherwise it seeds built-ins for display. A missing file on a previously initialized device remains protected.
A new device uses `confirmFreshInstall` before enabling edits; this is a second
read, not proof that sync has finished. The welcome only marks `welcomeSeen` in
memory and never creates `data.json`. The first real settings write rechecks
disk freshness, and only a successful write or load marks the device initialized.
An exceptional confirmation stays frozen rather than authorizing a blind write.
Foreground checks continue looking for files that arrive later. On the real
plugin, even a foreground while an editor is open reaches the reload queue and
is retained until the editor closes. A readable,
supported file can thaw the writer; a newer data version stays read-only.

The settings-file shape gate checks callout icons/names/aliases, optional text
fields, metadata, finite gradient angles, duplicate row ids, and both icon-cache
formats before a rebuild. Malformed rows
are not silently dropped; the whole file is preserved for recovery. Partial
built-in overrides and unknown future fields remain supported.
Canonical comparison and foreign-field retention preserve JSON keys such as
`__proto__` as own data properties, so they neither change a temporary object's
prototype nor disappear from the freshness comparison. Observed non-object JSON
stays unreadable even if a later existence check would see the file disappear.
An explicit data version must be a finite number before migrations run; older
files without a version and numeric future versions retain their existing handling.

No discovery cache is used to decide this. `DeviceLocalStore` v2 keeps only
`initialized` and `listsExpanded`. A recognized v1 blob and the old startup CSS
are copied to a verified, content-addressed recovery archive before v2 cleanup
removes `discovered`, `firstRunCompleted` and `retiredThemeIds`. Neither is a
source of live definitions. Failed archive/verification keeps the old local
data and protects the old CSS from replacement. Unknown/corrupt or unavailable
local storage is treated as evidence of prior use, so missing `data.json`
cannot silently become a fresh writable installation. None of these paths scans
notes. Released 2.12.x builds lack the newer-format guard; upgrade both devices
before resuming work, since schema 5 cannot control an old device's writes.

Settings always come from the current `registry.settings` object; adoption replaces
that object, so managers must not retain an earlier settings reference.

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
>
> Dropped is right for an **import file**, which is a document this version is
> being asked to read. It is wrong for `data.json`, which two versions of this
> plugin share — see [Multi-device sync](#multi-device-sync) property 6, where
> the top-level settings keys this build does not recognise are set aside by
> [`manager/foreignFields.ts`](../src/manager/foreignFields.ts) and handed back
> on save. That quarantine sits *beside* this function, never inside it, so the
> import path keeps the promise above unchanged.

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
| `SettingsWriter`'s belief about what is on disk | `SettingsWriter` | Seeded by the load at startup, and re-seeded whenever an external change is adopted |
| `CSSInjector.lastCssText` | `CSSInjector` | Recomputed by the next `inject()` |
| The registry's transient live-preview slot | `CalloutRegistry` | Cleared automatically when the editor modal closes |
| `IconFetchManager`/`PackDataStore` in-flight promise maps | `IconService` | Nothing to rebuild — just de-duplicates concurrent requests |
| `LocaleStore`'s per-file load state and in-flight map | `LocaleStore` | Re-derived by `prepare()`/`ensure()` on next launch |
| The `i18n/index.ts` module-level locale table map | `i18n/index.ts` | Re-populated by `registerLocaleFile` when a file is read/downloaded again |
| `startupEntranceActive` flag | `renderShared.ts` | Reset every launch; closes itself after `STARTUP_ENTRANCE_MS` |
| The Live Preview content-pill render cache | `contentPillRender.ts` | Cleared on unload and by `plugin.refreshCallouts()` — **not** by every registry change; the generic `registry.onChange` listener in `main.ts` only re-injects CSS, it never calls `refreshCallouts()`. An ordinary `CalloutEditor` save does not clear this cache. Explicit callers include the external-style toggle, fallback-callout changes, row delete/reset. |

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

`DeviceLocalStore` v2 stores only section folds and the prior-install marker in
vault-scoped browser storage. It never holds callout ids, scan status or theme
retirement state. A failed write does not advance the write memo, allowing retry.

## The startup CSS snapshot

[`src/manager/StartupStyleCache.ts`](../src/manager/StartupStyleCache.ts) is
**one layer, `localStorage`, per device**, deliberately with no settings
toggle (the README states this explicitly under "What is stored locally").

```ts
loadCachedCss(): string | null    // synchronous read
persist(cssText: string): void     // called at the end of every inject() whose text changed
```

The key is vault-scoped:
`${appId ?? vault.getName()}-callout-studio-css-v2` — `App.loadLocalStorage`'s
own `${appId}-${key}` convention, replicated by hand because that public API
requires Obsidian ≥1.8.7 while this plugin's `minAppVersion` is lower.

The snapshot holds the **exact text** the adopted stylesheet gets, so the
handoff from cached-snapshot to freshly-generated CSS is invisible — there's
no partial or summarized form. `CSSInjector.injectFromCache()` reads it as the
literal first statement of `onload()`, before `loadData()` is even awaited
(see [Plugin lifecycle](03-plugin-lifecycle.md#step-3-the-startup-css-fast-path)).
A stale snapshot self-heals automatically: the very next `inject()` (once the
registry is populated) persists fresh CSS over it.

The versioned key deliberately never falls back to the old
`callout-studio-css` key, whose text may contain icon CSS generated before the
string-escaping security fixes. The first launch after upgrading generates fresh
styles after settings load. The old key remains untouched for the existing
legacy-discovery recovery archive; it is never installed as a stylesheet.

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
