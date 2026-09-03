# Plugin lifecycle

All of this happens in [`src/main.ts`](../src/main.ts)'s `onload()`, which is
long but linear. This document walks it top to bottom in the actual order the
code runs, because that order encodes real constraints — several steps exist
specifically *because* of what runs before or after them.

## `onload()`, step by step

```text
1. Read workspace.layoutReady (before any await)
2. new CalloutRegistry()
3. new CSSInjector(app, registry); cssInjector.injectFromCache()   ← synchronous, pre-await
4. await loadData(); registry.load(savedData)
5. if registry.needsSaveAfterLoad(): await saveSettings()
6. compute isFreshInstall
7. new LocaleStore(); await locales.prepare(settings.language); setLocale(...)
8. surface any palette-merge notice (registry.takePaletteMerges())
9. cssInjector.initialize()                                        ← full inject, first real CSS
10. registerMarkdownPostProcessor: paintIcons(el)
11. registerMarkdownPostProcessor: createCalloutReadingPostProcessor(this)
12. registerEditorExtension: createCalloutViewPlugin(this)
13. registerEditorExtension: createHeadingGapField(this)
14. maybe open the startup entrance animation window
15. setMaterialFontStore(app, manifest)
16. new IconService(...), new CalloutDiscovery(...)
17. workspace.onLayoutReady: removeLegacyStartupSnippet(app)         ← deferred, non-blocking
18. new OutlineDecorator(this); attach on layout-ready; subscribe to layout-change
19. new CustomCommandManager(this); registry.onChange(syncAll); syncAll()
20. registry.onChange(inject + outlineRefresh + saveSettings)
21. workspace.on("css-change", () => cssInjector.inject(false))
22. new CalloutStudioSettingsTab(this); addSettingTab(...)
23. registerObsidianProtocolHandler("callout-studio-welcome", ...)
24. registerCalloutCommands(this, ...)                               ← the 5 fixed commands
25. new CalloutAutoComplete(this); registerEditorSuggest(...)
26. workspace.onLayoutReady: linkSuggestDecorator.install(...)
27. registerContextMenu(this)
28. new CalloutStudioAPI(this)
29. void icons.initialize()                                          ← background, non-blocking
30. void ensureLocale()                                              ← background, non-blocking
31. workspace.onLayoutReady: maybeShowWelcomeOnLaunch, then first-run discovery or scheduled prune,
    then registerIncrementalWatchers()
```

### Why the very first line reads `layoutReady` before any `await`

```ts
const uiWasVisible = this.app.workspace.layoutReady;
```

On mobile, Obsidian renders the restored note **before** community plugins
finish loading — so by the time this plugin's code runs, `layoutReady` is
already `true` and the user is already looking at unstyled callouts. On
desktop, `layoutReady` is normally `false` at this point (a fresh app launch),
and only becomes relevant for a mid-session enable/reload or a lazy-loaded
plugin. The captured value decides whether to open the "startup entrance"
animation window (step 14) — the cases where the plugin's DOM transforms arrive
*after* the raw text was already painted are exactly the cases where snapping
the transformation in looks jarring and animating it in looks intentional. It
has to be read before any `await`, because an `await` yields to the event loop
and layout could become ready during the wait.

### Step 3: the startup CSS fast path

`cssInjector.injectFromCache()` runs **synchronously, before `loadData()` is
even awaited**. It reads a CSS snapshot out of `localStorage` (see
`StartupStyleCache`) — the exact text the adopted stylesheet held at the end of
the *previous* session — and writes it straight into both the adopted
stylesheet and the `<style>` element. The registry is still empty at this
point; nothing here reads it. The point is purely to shorten the "flash of
unstyled callouts" window on a slow mobile launch. See
[Persistence and caching](07-persistence-and-caching.md#the-startup-css-snapshot).

### Steps 4–5: load and flush migrations

All of this is `loadSettingsInto(this)`
([`manager/settingsBoot.ts`](../src/manager/settingsBoot.ts)) rather than
inline code, because `onExternalSettingsChange` has to do the identical thing
when another device's settings file arrives mid-session — and a reload that is
a shortened copy of the startup path is how a reload quietly skips a migration.

`registry.load(savedData)` seeds the 13 built-ins unconditionally, folds saved
rows over them, and runs a chain of content-keyed migrations (metadata-pipe
IDs, derived backgrounds, stale transparency flags, dash/space collisions,
duplicate palettes…). If any of them rewrote something,
`needsSaveAfterLoad()` returns `true` and `onload` flushes a save **immediately**
— not waiting for whatever incidental mutation happens to come next. Without
this, a cleaned-up shape would be recomputed identically on every launch but
never actually written back, and an export taken between launches would still
carry the pre-migration shape. Full migration list in
[Callout registry](05-callout-registry.md#load-time-migrations).

`bootDiscoveryIndex` runs in the same breath, before the first inject: it
rebuilds this device's discovered rows from
[`DeviceLocalStore`](../src/manager/DeviceLocalStore.ts)'s id list — no vault
read — and folds in any such rows an older `data.json` still lists, which is
the one write-back that retires them from the file. See
[Vault discovery](10-vault-discovery.md) and
[Persistence § multi-device sync](07-persistence-and-caching.md#multi-device-sync).

### `onExternalSettingsChange()`

Not part of `onload`, but the same sequence. Obsidian calls it when `data.json`
is rewritten by something other than us, and **only because the method exists**
— `Plugin.loadData` starts tracking the file's mtime only when it is defined.
It re-runs the load above, re-sweeps the theme's overlay rows (`registry.load()`
clears them and they are never persisted — and the sweep is *forced*, because a
settings reload does not move the theme fingerprint), re-syncs the custom
commands, re-injects, and **re-seeds** the write guard's baseline with the file
it just read, so a save that would merely reproduce that file is suppressed.

Three things it declines to do, each of which was a bug:

- It does not adopt a read it could not make sense of, or one that found no file
  at all — both are transient far more often than they are meant.
- It does not rebuild anything for a write of *ours* arriving back through the
  watcher, which Obsidian re-fires for every save we make.
- It does not clear the write guard. Clearing it made the reload write the
  incoming file straight back at the device that sent it.

It is deferred while a modal owns the registry, so a reload never changes the row
being edited underneath the user. Limits — desktop only, and mtime-gated — are in
[Persistence § multi-device sync](07-persistence-and-caching.md#multi-device-sync).

### Step 7: locale preparation blocks, on purpose

`await this.locales.prepare(this.settings.language)` is the one blocking
locale step. It is a single read of a ~50 KB file already on disk (the
ordinary case) and never touches the network — `prepare()` only reads what
LocaleStore already has cached, it never fetches. It has to finish before the
first translated string is shown (the palette-merge notice a few lines later
is the earliest one). Downloading a *missing or stale* locale is a separate,
non-blocking step at the very end (`ensureLocale()`, step 30) — see
[Localization](16-i18n.md).

### Step 9: the real inject, replacing the snapshot

`cssInjector.initialize()` calls `ensureStyleSheet()` then `inject()` — this is
the first inject that reads the now-populated registry, and it replaces
whatever the step-3 snapshot had painted. Between step 3 and step 9 the user
may briefly see last session's styling rather than this session's (if
something changed while the plugin was unloaded); the window is normally
milliseconds.

### Steps 10–13: render surfaces register themselves

Two Reading-view post processors and two editor extensions are registered here.
`paintIcons(el)` runs on **every** markdown render (it is what bakes Lucide,
Material, emoji and image icons into the DOM as visible artwork rather than a
CSS-only mask — see [CSS generation](06-css-generation.md#icon-painting) for
why: PDF export drops `adoptedStyleSheets`, so a mask-only icon would be
invisible in an exported PDF). The heading-callout/inline-callout post
processor and the Live Preview `ViewPlugin` are the two surfaces that render
the plugin's own invented syntax — see
[Render roles and rendering surfaces](08-render-roles.md). `createHeadingGapField`
is a **separate `StateField`**, not folded into the `ViewPlugin`, because block
decorations (which a margin-like gap needs) cannot come from a view plugin in
CodeMirror 6.

### Step 19: command sync is subscribed *before* the save listener, and that order is load-bearing

```ts
this.customCommands = new CustomCommandManager(this);
this.registry.onChange(() => this.customCommands.syncAll());
this.customCommands.syncAll();

this.registry.onChange(() => {
    this.cssInjector.inject();
    this.outlineDecorator.refreshAll();
    void this.saveSettings();
});
```

Deleting a callout invalidates any custom command that used it. Both listeners
fire on the *same* `onChange` round, and `saveSettings()` snapshots
`registry.settings` (which includes `customCommands`) at the moment it runs. If
the save listener ran first, it would snapshot the settings **including** the
commands about to be pruned by the sync listener — two competing writes of
different content, decided by whichever finishes last. Registering the sync
first means both listeners see the already-pruned list, so there's nothing to
race over. See [Editor integrations](09-editor-integrations.md#customcommandmanager--one-idempotent-sweep).

### Step 24 vs step 20: commands are registered here, `settings` is read from `this.registry.settings` via a getter

`registerCalloutCommands` reads `plugin.settings.disabledFixedCommands` to
decide which of the five fixed commands to actually call `addCommand` for.
`CalloutStudioPlugin.settings` is a getter that forwards to
`this.registry.settings` — there is no separate settings object on the plugin
itself.

### Step 31: welcome, then first-run discovery, then incremental watchers — in that exact order, deferred to layout-ready

```ts
this.app.workspace.onLayoutReady(async () => {
    try {
        await this.maybeShowWelcomeOnLaunch(isFreshInstall);
        if (!this.settings.firstRunCompleted) {
            await this.runFirstRunDiscovery();
        } else {
            this.discovery.schedulePrune(2000);
        }
    } finally {
        this.discovery.registerIncrementalWatchers();
    }
});
```

- **Welcome first**, so it never stacks visually on top of the first-run scan
  consent modal (which only large vaults see).
- **`firstRunCompleted` is only persisted after the chosen path finishes** — a
  crash or reload mid-scan safely re-runs the whole first-run flow on the next
  launch, rather than leaving the vault half-scanned and marked "done."
- **Incremental watchers are registered last, unconditionally, in a `finally`**
  — even if welcome or first-run discovery throws, ongoing vault-change
  watching still starts.

`runFirstRunDiscovery` re-checks `firstRunCompleted` at its very first line —
`onLayoutReady` can fire after some *other* flow (an import, for instance)
already ran a scan and flipped the flag, so the re-check exists to avoid a
redundant second scan racing the first.

"Safely re-runs on the next launch" above is about a process crash landing
mid-`await`, before the flag write is ever reached — not about the scan
merely throwing. Both `runFirstRunDiscovery`'s silent path and
`FirstRunScanModal`'s "Scan now" handler catch that exception, `console.error`
it, and still mark `firstRunCompleted = true` right after, so a caught failure
does not retry automatically. Each catch also raises a `Notice` pointing at
Settings → Vault insights & maintenance → Re-scan vault, since that manual
re-scan is the only recovery once first-run has moved on. See
[Vault discovery](10-vault-discovery.md#first-run-vault-scan) and
[Logging and diagnostics § first-run vault scan](22-logging-and-diagnostics.md#first-run-vault-scan--consoleerror--notice)
for the full `console`/`Notice` catalog and the policy behind it.

> [!NOTE]
> The vault-size threshold that decides silent-scan vs. consent-modal is
> `HEAVY_VAULT_FILE_THRESHOLD = 500` (`src/constants.ts`), purely a UX
> threshold with no effect on what the scan itself does. See
> [Vault discovery](10-vault-discovery.md).

## `onunload()`

```ts
onunload() {
    this.discovery?.destroy();
    this.cssInjector?.destroy();
    clearMaterialFontStore();
    clearContentPillCache();
}
```

Short, and deliberately so — almost everything else was registered through
`this.register(...)` / `this.registerEvent(...)` / `this.registerDomEvent(...)`
/ `this.registerInterval(...)`, which Obsidian tears down automatically on
unload. `tests/repoSourceRules.test.ts` enforces this convention across the
whole `src/` tree ("every workspace/vault/metadataCache listener is registered
or offref'd," "nothing listens on a document or window without taking it
back," "no interval runs outside registerInterval").

What `onunload` handles by hand is exactly the state that isn't an Obsidian
event subscription:

- `discovery.destroy()` clears its own debounce timers (file-scan timers, the
  prune timer) — these are raw `window.setTimeout` handles, not Obsidian
  events.
- `cssInjector.destroy()` removes the adopted stylesheet from every open
  document and removes the `<style>` element, so a disabled-then-re-enabled
  plugin doesn't accumulate a second sheet.
- `clearMaterialFontStore()` and `clearContentPillCache()` clear module-level
  caches that would otherwise survive a disable/re-enable cycle holding stale
  references.

> [!WARNING]
> If you add a new module-level cache or a raw timer/listener anywhere in the
> plugin, it needs an explicit teardown here (or must go through
> `registerEvent`/`registerInterval`/`registerDomEvent`/`register`). Nothing
> else clears it on unload.

## What happens on disable → re-enable (not a restart)

Obsidian's disable/enable cycle calls `onunload()` then, on re-enable,
`onload()` again — a fresh plugin instance, fresh `CalloutRegistry`, fresh
everything, exactly as at Obsidian startup. The interesting edge cases are the
ones covered above: `injectFromCache()` still runs first (so re-enabling
repaints instantly from the last-known-good CSS rather than flashing
unstyled), `registry.load()` re-runs every migration (idempotent — see
[Callout registry](05-callout-registry.md)), and `CustomCommandManager.syncAll()`
re-registers every custom command **at the same ids**, so hotkeys survive
because Obsidian keys them by command id, not by object identity.

---
Next chapter: [04-data-model.md](04-data-model.md)
