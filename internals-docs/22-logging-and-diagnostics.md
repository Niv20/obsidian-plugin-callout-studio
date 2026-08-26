# Logging and diagnostics

A from-source catalog of every `console.debug` / `console.warn` / `console.error`
call site in `src/`, and the policy behind which one a given failure gets —
plus when a `Notice` is the right answer instead. Unlike most chapters here,
this one is cross-cutting rather than one subsystem: it exists because the
question "debug, warn, error, or Notice?" comes up in nearly every new
try/catch, and the answer is a house convention, not something derivable from
any one file. Read this before adding a new failure path anywhere in the
plugin.

Call sites below are named by file and enclosing function, not by line
number — functions move less than lines do. Line numbers are correct at the
time of writing but are not re-verified on every unrelated edit to these
files; if one has drifted, search the named function instead of trusting the
number.

## There is no dev/production split

`esbuild.config.mjs` minifies the production build (`minify: prod`) but does
**not** set `drop: ["console"]`. Minification only compresses syntax — every
`console.*` call in the source ships, unchanged in behavior, inside the
`main.js` every installed copy of the plugin runs. There is no build-time
flag, no `NODE_ENV` check, and no separate "developer build" that strips or
gates any of this. Whatever a call site logs, it logs in production, for
every user, every time the code path runs — the only thing standing between
a line and a real user's console is Obsidian's own devtools shortcut, and
whoever happens to have it open.

This is why the level a new call site picks actually matters here in a way it
might not in a project with a real dev/production split: there is no second
chance to promote a forgotten `console.log` out of shipped code, and no way
to make `console.debug` quieter than `console.warn` at runtime — both write
to the same devtools console with no build-time or runtime gate between them.
(No call site currently uses `console.log` or `console.info` at all — every
one of the ~40 sites below is `debug`, `warn`, or `error`.)

## The four signals, and when each is right

> [!IMPORTANT]
> **`console.debug`** — a background, self-healing, or one-time-migration
> trace that no user can act on, where some UI surface already shows the
> *effect* (a shorter callout list, a new fallback row, a merged id). The
> catch around it must already be a documented no-op — if the catch isn't
> already "log and quietly continue," the call site isn't a debug trace, it's
> a bug you haven't classified yet.

> [!IMPORTANT]
> **`console.warn`** — a recoverable failure on a fetch/cache/disk path,
> where either (a) an independent UI consequence already exists (a `Notice`,
> a retry button, a persistent error icon) and the warn only supplies the raw
> error for whoever is debugging a report, or (b) the very next step
> self-heals (an automatic re-download, a fallback render) and the warn is
> the only trace that anything was ever wrong.

> [!IMPORTANT]
> **`console.error`** — reserved for a genuine, unrecoverable programming
> defect, not an environmental or network condition. An environmental
> failure (a vault read error, a download that exhausted every mirror) that
> gets caught and handled gracefully is a `console.warn` with a `Notice`, not
> a `console.error` — `console.error` on a recoverable path just misclassifies
> "the internet is down" as "the code is broken."

> [!IMPORTANT]
> **`Notice`** — the only signal an ordinary user ever sees. Raise one
> whenever a failure would otherwise leave **no other trace** the user could
> discover, **and** a real remedy exists for them to act on. Pair it with a
> `console.warn`/`console.error` carrying the raw error for diagnosis — never
> replace one with the other, and never raise a Notice a user has no way to
> act on (that's noise, not help). See
> [Common pitfalls § UI strings that must go through i18n](20-common-pitfalls.md#ui-strings-that-must-go-through-i18n)
> — every `Notice` string goes through `t()`, mechanically enforced.

## Full catalog

### Background discovery and load-time migrations — `console.debug`

Self-healing background passes (an incremental vault scan, a debounced
prune) and gated one-time migrations at load. Every catch here is already a
documented no-op; every success trace reports an effect visible elsewhere in
the UI. None of these are user-actionable, so none raise a `Notice`.

| File | Function | Fires when |
| --- | --- | --- |
| [CalloutDiscovery.ts](../src/manager/CalloutDiscovery.ts) | `pruneUnused()` | the usage-count scan throws (a vault read failure mid-scan) — logs the caught exception |
| [CalloutDiscovery.ts](../src/manager/CalloutDiscovery.ts) | `pruneUnused()` | it actually removes ≥1 unused fallback row — logs the removed count |
| [CalloutDiscovery.ts](../src/manager/CalloutDiscovery.ts) | `scanFileNow()` | the 300ms-debounced per-file incremental scan throws for one file — logs `file.path` and the caught exception |
| [CalloutDiscovery.ts](../src/manager/CalloutDiscovery.ts) | `scanFileNow()` | it auto-adds ≥1 unknown id as a fallback row — logs `file.path` and the new ids |
| [CalloutRegistry.ts](../src/manager/CalloutRegistry.ts) | `load()` → `stripMetadataFromIds()` | it actually removed/renamed a legacy piped id — logs `{removed, renamed}` |
| [CalloutRegistry.ts](../src/manager/CalloutRegistry.ts) | `load()` → `reconcileIdCollisions()` | it actually merged ≥1 colliding row — logs the merged ids |
| [CustomCommandManager.ts](../src/editor/CustomCommandManager.ts) | `syncAll()` | it drops ≥1 structurally malformed stored command — logs the dropped count |
| [CustomCommandManager.ts](../src/editor/CustomCommandManager.ts) | `syncAll()` | its **first** sweep only drops a command whose callout no longer exists — logs the dropped count |

`CustomCommandManager.ts`'s pair implements a split written into the code's
own comments: nothing in the UI exists for the user to fix a malformed
`data.json` entry, so that one stays `console.debug` forever; a command
orphaned by a deleted callout is debug-only on the *first* sweep (expected
startup housekeeping) but escalates to a real `Notice` on every later sweep,
once dropping it would be news rather than routine. See
[Callout registry § load-time migrations](05-callout-registry.md#load-time-migrations).

### First-run vault scan — `console.error` + `Notice`

Covered in depth in
[Plugin lifecycle § step 31](03-plugin-lifecycle.md#step-31-welcome-then-first-run-discovery-then-incremental-watchers--in-that-exact-order-deferred-to-layout-ready)
and
[Vault discovery § first-run vault scan](10-vault-discovery.md#first-run-vault-scan).
These are the only two `console.error` calls in the codebase, and the only
two call sites this chapter's audit changed: both used to fail with zero
trace a user could see, even though `firstRunCompleted` is still marked done
either way (no automatic retry). Both now pair the existing `console.error`
with a `Notice` pointing at the real remedy (Settings → Vault insights &
maintenance → Re-scan vault).

| File | Function | Fires when | Notice shown |
| --- | --- | --- | --- |
| [firstRunDiscovery.ts](../src/manager/firstRunDiscovery.ts) | `runFirstRunDiscovery()` | the silent small-vault auto-scan throws | `firstRun.autoScanFailed` |
| [FirstRunScanModal.ts](../src/utils/FirstRunScanModal.ts) | `handleScan()` | the user clicks "Scan now" on the large-vault modal and the scan throws | `firstRun.scanFailed` |

### Icon pack and webfont pipeline — `console.warn`

Network fetch, disk cache, and integrity verification for icon packs and
Material Symbols webfonts (`IconFetchManager`, `PackDataStore`,
`materialFontStore`, `IconService`, `packs/materialFont.ts`). Every warn here
sits behind an existing `Notice`, a retry UI, or an automatic self-heal — see
[Icons](12-icons.md).

| File | Function | Fires when |
| --- | --- | --- |
| [IconFetchManager.ts](../src/icons/IconFetchManager.ts) | `notify()` | a subscriber to the change event throws (pub/sub error boundary) |
| [IconFetchManager.ts](../src/icons/IconFetchManager.ts) | `runFetch()` | all retries of a Material Symbol SVG download are exhausted — **paired with a `Notice`** (`notice.iconDownloadFailed`), raised immediately before this warn |
| [PackDataStore.ts](../src/icons/PackDataStore.ts) | `notify()` | a pack-change listener throws (pub/sub error boundary) |
| [PackDataStore.ts](../src/icons/PackDataStore.ts) | `loadFromDisk()` | reading an already-downloaded pack file off disk throws |
| [PackDataStore.ts](../src/icons/PackDataStore.ts) | `persist()` | writing a freshly-verified pack to disk fails — **paired with a one-time `Notice`** (`iconPack.diskWriteFailed`, gated by `diskWriteBroken`), the same pattern as `LocaleStore.persist()` below |
| [PackDataStore.ts](../src/icons/PackDataStore.ts) | `runDownload()` | every mirror URL for a pack download has failed — no direct Notice, but sets pack state to `"failed"`, which `PackPanel` reads via `state(id)` to swap its button to a persistent **Retry** label |
| [PackDataStore.ts](../src/icons/PackDataStore.ts) | `verify()` | a downloaded pack's byte length doesn't match the manifest |
| [PackDataStore.ts](../src/icons/PackDataStore.ts) | `verify()` | a downloaded pack's SHA-256 doesn't match after the length already did (tamper/corruption signal) |
| [PackDataStore.ts](../src/icons/PackDataStore.ts) | `accept()` | `JSON.parse` fails on bytes that already passed verification |
| [PackDataStore.ts](../src/icons/PackDataStore.ts) | `accept()` | a verified pack fails schema validation |
| [materialFontStore.ts](../src/icons/materialFontStore.ts) | `read()` | a cached `.woff2` fails its magic-number check |
| [materialFontStore.ts](../src/icons/materialFontStore.ts) | `read()` | reading a cached webfont off disk throws (outer catch) |
| [materialFontStore.ts](../src/icons/materialFontStore.ts) | `write()` | best-effort disk-caching a webfont fails after the network render already succeeded |
| [IconService.ts](../src/icons/IconService.ts) | `notify()` | an icon-change listener throws (pub/sub error boundary) |
| [IconService.ts](../src/icons/IconService.ts) | `initialize()` | a pack found on disk at startup fails its own corruption check, right before it's automatically re-downloaded |
| [packs/materialFont.ts](../src/icons/packs/materialFont.ts) | `addFromCache()` | `FontFace` construction fails on cached bytes that already passed the magic-number check |
| [packs/materialFont.ts](../src/icons/packs/materialFont.ts) | `cacheToDisk()` | fire-and-forget disk-caching a webfont fails after the grid already rendered from the network |

### Locale downloads — `console.warn`

`LocaleStore`'s download/verify/cache pipeline for the background
UI-translation fetch — the one network call in this codebase that runs
without an explicit per-use user action, disclosed for exactly that reason.
See [Localization § LocaleStore](16-i18n.md#localestore--download-verify-cache)
and
[§ what happens when a translation download fails](16-i18n.md#what-happens-when-a-translation-download-fails).

| File | Function | Fires when |
| --- | --- | --- |
| [LocaleStore.ts](../src/i18n/LocaleStore.ts) | `notify()` | a change listener throws (pub/sub error boundary — currently dead code, nothing subscribes in production) |
| [LocaleStore.ts](../src/i18n/LocaleStore.ts) | `loadFromDisk()` | a cached locale file on disk exceeds `MAX_LOCALE_BYTES` |
| [LocaleStore.ts](../src/i18n/LocaleStore.ts) | `loadFromDisk()` | reading a cached locale file off disk throws |
| [LocaleStore.ts](../src/i18n/LocaleStore.ts) | `persist()` | writing a verified download to disk fails — **paired with a one-time `Notice`** (`locale.diskWriteFailed`), the one call site that was already the surfaced case before this chapter existed |
| [LocaleStore.ts](../src/i18n/LocaleStore.ts) | `runDownload()` | a downloaded locale file fails its checksum, before falling through to the next mirror URL |
| [LocaleStore.ts](../src/i18n/LocaleStore.ts) | `runDownload()` | every mirror URL for a locale download has failed |
| [LocaleStore.ts](../src/i18n/LocaleStore.ts) | `accept()` | `JSON.parse` fails on a locale file |
| [LocaleStore.ts](../src/i18n/LocaleStore.ts) | `accept()` | a locale file fails shape validation |

### Settings, preview and export — `console.warn`

| File | Function | Fires when |
| --- | --- | --- |
| [LiveCalloutPreview.ts](../src/settings/LiveCalloutPreview.ts) | `build()` | constructing the undocumented `EmbeddableMarkdownEditor` internal API throws; falls back to a static render |
| [IconPickerModal.ts](../src/settings/iconpicker/IconPickerModal.ts) | `loadSourceCounts()` | one icon source's `loadIndex()` fails while counting icons per source |
| [CalloutEditorSave.ts](../src/settings/editor/CalloutEditorSave.ts) | `performCalloutEditorSave()` | an on-demand icon prefetch fails after the callout definition already saved |
| [cssSnippetExport.ts](../src/manager/cssSnippetExport.ts) | `readExisting()` | reading an existing CSS snippet file (for the overwrite-confirmation check) throws |
| [cssSnippetExport.ts](../src/manager/cssSnippetExport.ts) | `runExport()` | building the exported snippet throws |
| [cssSnippetExport.ts](../src/manager/cssSnippetExport.ts) | `runExport()` | writing the exported snippet to disk throws |
| [legacyStartupSnippet.ts](../src/manager/legacyStartupSnippet.ts) | `removeLegacyStartupSnippet()` | removing the legacy startup CSS snippet throws on launch |

`LiveCalloutPreview.ts`'s `build()` guards an undocumented internal Obsidian
API with a working fallback — see
[Common pitfalls § Obsidian APIs with special lifecycle requirements](20-common-pitfalls.md#obsidian-apis-with-special-lifecycle-requirements).
`legacyStartupSnippet.ts` is marked for deletion once vaults finish migrating
past the file it cleans up — not a candidate for further logging investment.

## Why not a centralized logger

At roughly 40 call sites spread thinly across 16 files, every one already
follows the same `"[CalloutStudio] ..."` prefix convention by hand, and the
audit behind this chapter found only two sites that were actually
misclassified (both fixed above). A logger module would mainly buy two
things: de-duplicating the prefix string, and one place to gate
`console.debug` behind a settings flag so the two highest-frequency traces
(`CalloutDiscovery.ts`'s `pruneUnused()`/`scanFileNow()` success logs, which
can fire on nearly every callout a user types) don't spam anyone who opens
devtools for an unrelated reason. That is a real but narrow win, not worth a
new abstraction layer at this scale — and since there is no dev/production
build split (see above), any such gate would have to be a persisted settings
flag, not an environment check. Revisit this if the call-site count grows
substantially (roughly 75–100), if `console.debug` noise starts showing up in
real bug reports as confusing, or if more than two modules start hand-rolling
their own ad hoc "should I log this" logic.

---
Next chapter: [00-index.md](00-index.md)
