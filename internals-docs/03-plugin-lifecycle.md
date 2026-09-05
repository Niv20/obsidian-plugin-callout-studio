# Plugin lifecycle

`src/main.ts` owns lifecycle and wiring. No startup, file-open, note-change,
settings-display, theme-change, or modal-close hook runs callout discovery.

## Startup

1. Read `workspace.layoutReady`, create the registry and inject the previous
   startup CSS snapshot synchronously before the first await.
2. Create `SettingsWriter`, `DeviceLocalStore` and `ReloadQueue`. Read and
   validate `data.json`; load definitions and ordinary settings. Unreadable,
   unsupported or unexpectedly missing settings freeze writes. A first install
   stays provisionally frozen until the layout-ready check.
3. Prepare the saved language, report any palette consolidation, publish the
   active theme's rendering ownership, and initialize real CSS. Theme inspection
   only affects appearance and grouping of existing definitions.
4. Register reading-view and Live Preview renderers, heading spacing, and the
   startup entrance animation when appropriate. Initialize icons and instantiate
   `ManualCalloutDiscovery`; constructing it reads no notes and registers no events.
5. Register Outline integration, custom commands, registry change listeners,
   settings UI, fixed commands, ribbon, autocomplete, context menu and public API.
   Missing custom-command targets are paused, never deleted as part of startup.
6. Begin existing icon/locale preparation. At layout-ready,
   `runLaunchSequence` confirms whether this is a fresh install, shows the welcome
   screen where appropriate, and writes no welcome-only settings file. A successful
   settings load or actual write marks the installation initialized. It does not scan.

The registry change loop remains mutation → CSS/repaint → save. The manual
scan stages results outside that loop, saves once using `SettingsWriter.commit`,
and only then adds them in one registry batch. Its notification's ordinary save
request is deduplicated against the committed file.

## External settings changes

Desktop settings events pass through `ReloadQueue`. Foreground checks use the
same queue on the real plugin. Calls arriving during an adoption request another
read after it; calls arriving during a preview or settings write are deferred.
Closing a modal, clearing a preview, or finishing a write releases a pending reload.

Before replacing or removing local definitions or saved preferences, adoption writes a recovery copy.
An unreadable file, failed required backup, or concurrent local edit leaves the
registry intact. Successful adoption refreshes theme appearance, command
registration and the settings view without re-discovering any callouts.

See [Persistence](07-persistence-and-caching.md) and
[Manual discovery](10-vault-discovery.md) for the conflict contract.

## Unload

Destroy manual discovery, the settings writer and the reload queue so unfinished
work cannot publish new results or start queued saves;
destroy the CSS injector and existing renderer/icon resources. Registered event
and DOM listeners are removed through Obsidian's plugin lifecycle. There are no
discovery timers, note watchers, prune queues or rediscovery holds to clean up.

The startup CSS snapshot is derived presentation state only. Local storage
holds UI folds and an installation marker; it never restores callout definitions.
Disabling and re-enabling the plugin follows the same saved-settings load path.
