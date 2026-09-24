# Persistence and caching

## `data.json` — the persisted settings file

Every user-defined and manually discovered callout is durable configuration.
`CalloutRegistry.toSaveData()` includes uncustomized `source: "fallback"` rows.
Only unchanged built-ins and live previews are excluded; legacy theme overlay
rows found in saved data are migrated to durable fallback rows. Both JSON export
formats include manual results. Settings data format **5** prevents compatible
older builds from silently applying their old ephemeral-row persistence policy.

The write protocol is documented in
[Settings saving, synchronization, and recovery](08-settings-sync-and-recovery.md).
That chapter owns the startup decisions, verified writes, missing-file recovery,
external adoption, merge history, checkpoints, backups, and failure boundaries.
This chapter keeps the storage inventory and cache-specific behavior.

## Recovery storage inventory

| Store | Location and purpose |
| --- | --- |
| Primary configuration | `<plugin-dir>/data.json`; durable definitions, preferences, in-use artwork and sync metadata. |
| Device recovery checkpoint | App IndexedDB, separate from the vault; one snapshot per vault/configuration-profile/plugin. |
| Recovery backups | `<plugin-dir>/backups/`; retained versions produced by guarded replacement/recovery. |
| Device UI/prior-use state | Vault-scoped `localStorage`; folds and onboarding/migration markers, never a live definitions cache. |

See the canonical chapter's
[state distinctions](08-settings-sync-and-recovery.md#safety-rules-and-the-different-kinds-of-state)
and [checkpoint/backup contracts](08-settings-sync-and-recovery.md#device-checkpoints-and-vault-backups)
for their authority, lifetime, verification and retention. Manual discovery uses
[isolated commits](08-settings-sync-and-recovery.md#isolated-commits-and-manual-discovery);
its scan results are ordinary saved configuration, not a local cache.

## Settings normalization

Settings always come from the current `registry.settings` object; adoption can
replace that object, so managers must not retain an earlier settings reference.

### Settings merge — never a raw spread

```ts
mergeSavedSettings(savedSettings: LegacySavedSettings): PluginSettings
```

[`src/utils/settingsMerge.ts`](../../src/utils/settingsMerge.ts) rebuilds
`PluginSettings` from possibly-partial, possibly-ancient saved data by naming
**every field explicitly** against `DEFAULT_SETTINGS`, all the way down into
nested sections (`globalStyle` has its own module,
[`globalStyleMerge.ts`](../../src/utils/globalStyleMerge.ts), because it's deep
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
> plugin share — see [Causal merge history and integrity](08-settings-sync-and-recovery.md#causal-merge-history-and-integrity), where
> the top-level settings keys this build does not recognise are set aside by
> [`manager/foreignFields.ts`](../../src/manager/foreignFields.ts) and handed back
> on save. That quarantine sits *beside* this function, never inside it, so the
> import path keeps the promise above unchanged.

The same function is shared by two callers that ask the identical question —
"what does this possibly-partial, possibly-ancient blob mean under the current
version" — the registry's `load()` on startup, and `settingsValidator` on
every JSON import.

`autocomplete.enabled` is a deliberate forced field in this merge. A historical
`false` is read only as migration evidence; the resulting settings object and
the next serialized snapshot both carry `true`. `CalloutAutoComplete` does not
read the field, so neither a stale object nor an older synced snapshot can turn
the core editor integration off in memory.

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
| The Live Preview content-pill render cache | `contentPillRender.ts` | Cleared on unload and by `plugin.refreshCallouts()` — **not** by every registry change; the generic `registry.onChange` listener in `main.ts` only re-injects CSS, it never calls `refreshCallouts()`. An ordinary `CalloutEditor` save does not clear this cache. Explicit callers include fallback-callout changes and row delete/reset. |

Derived render/cache state can be rebuilt. Writer baselines and sync-session state
must instead be re-established from accepted settings/recovery history; do not
clear them as a way to force a save. Unsaved editor drafts are not durable just
because their previews appear here. See
[the state distinctions](08-settings-sync-and-recovery.md#safety-rules-and-the-different-kinds-of-state).

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

`DeviceLocalStore` v3 stores section folds, prior-install/welcome markers, and
optional `pending | seen` markers for the one-time personal-CSS-retirement and
autocomplete-migration notices in vault-scoped browser storage. Each marker is
absent for unaffected users and carries no callout id or appearance. `pending`
is only displayed once the settings writer proves the cleaned registry snapshot
is durable; it can survive a restart before the UI is ready, and `seen`
suppresses a repeat if an older synced file later reintroduces the migrated
field. See
[Callout registry § Retiring personal-CSS ownership](05-callout-registry.md#retiring-personal-css-ownership-without-losing-the-saved-design)
and [Editor integrations § Autocomplete](10-editor-integrations.md#autocomplete).

The store never holds scan results or theme ownership. A failed local-storage
write does not advance the write memo, allowing retry. Notice markers are
best-effort UI state: failed persistence can lose a pending notice at unload or
repeat it on a later launch; it does not change the synchronized settings result.
Unknown/corrupt storage is conservative prior-use evidence. See
[startup decisions](08-settings-sync-and-recovery.md#startup-and-file-classification)
and [legacy archival](19-upgrading-manual-discovery.md) for the recovery policies.

## The startup CSS snapshot

[`src/manager/StartupStyleCache.ts`](../../src/manager/StartupStyleCache.ts) is
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
(see [Plugin lifecycle](03-plugin-lifecycle.md#startup)).
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

[`src/manager/legacyStartupSnippet.ts`](../../src/manager/legacyStartupSnippet.ts)
deletes that leftover file (and disables its name in `appearance.json` via the
undocumented `app.customCss` API) on **every launch**, deferred to
`workspace.onLayoutReady` so its one `exists()` stat never sits on the startup
path.

Before disabling/removing an existing file, `legacySnippetArchive.ts` writes its
exact bytes to `snippets/callout-studio-recovery/legacy-startup-<sha256>.txt` under
the configured vault folder. It verifies the copy, never overwrites a mismatched
copy, and rechecks the source before deletion. Failed archival or a changed
source leaves the original and enabled state intact for the next launch. Copies
are inert text files and are not pruned automatically, so personal edits survive
even when the old generated filename was reused.

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
- **A one-way deployment artifact, not a backup.** No Callout Studio importer
  reads this file, and nothing scans the snippets folder to restore it. The v2
  JSON backup is the only supported full-fidelity restore and cross-vault
  transfer format.
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
in [Icons](13-icons.md), summarized here for the "what's stored where" view:

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

Covered fully in [Localization](17-i18n.md). Summary for this document's
purpose: downloaded locale JSON lives at
`<plugin-dir>/translations/<file-id>.json`, outside `data.json`, SHA-256
verified against a manifest baked into the build. A hash **mismatch on disk**
is treated as *staleness* (an older build's copy, missing newer strings) and
used anyway while a background refresh runs — deliberately different from a
hash mismatch **from the network**, which is discarded outright. English never
needs a file at all; it's bundled in `main.js`.

---
Next chapter: [08-settings-sync-and-recovery.md](08-settings-sync-and-recovery.md)
