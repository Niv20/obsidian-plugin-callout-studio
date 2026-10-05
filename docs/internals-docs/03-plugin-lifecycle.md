# Plugin lifecycle

`src/main.ts` owns lifecycle and wiring. No startup, file-open, note-change,
settings-display, theme-change, or modal-close hook runs callout discovery.

## Startup

1. Register the two bundled UI icons and their unload cleanup synchronously.
   Mirror "Obsidian's Default theme is in use" onto `<body>` as
   `cs-default-theme` (`registerDefaultThemeClass`) - the gate of the light
   palette, kept in step on every `css-change` and removed on unload; see
   [The light palette](16-settings-ui-and-modals.md#the-light-palette).
   Read `workspace.layoutReady`, create the registry and inject the previous
   startup CSS snapshot synchronously before the first await.
2. Create `SettingsWriter`, `DeviceLocalStore`, `ReloadQueue` and the
   `SettingsRecoveryService` (`plugin.recovery`). Apply history and backup retention
   before adoption, including existing excess left by older builds. This best-effort
   cleanup has a bounded wait and does not write settings or the checkpoint.
   Read and validate `data.json`
   through `loadSettingsSafely()`; load definitions and ordinary settings. A
   legacy `autocomplete.enabled: false` is normalized to `true` and flushed
   through the ordinary migration-save path. Unreadable, unsupported or
   unexpectedly missing settings freeze writes, and so does any other error
   while loading: the built-ins are shown and `onload` continues, so the
   settings tab stays reachable. A first install stays provisionally frozen
   until the layout-ready check.
3. Prepare the saved language, report any palette consolidation, publish the
   active theme's rendering ownership, and initialize real CSS. Theme inspection
   only affects appearance and grouping of existing definitions.
4. Register reading-view and Live Preview renderers, heading spacing, and the
   startup entrance animation when appropriate. Initialize icons and instantiate
   `ManualCalloutDiscovery`; constructing it reads no notes and registers no events.
5. Register Outline integration, custom commands, registry change listeners,
   the paused-saving indicator and once-a-minute recheck
   (`registerPausedIndicator`, `registerPausedRecheck`),
   settings UI, fixed commands, the Quick insert ribbon button,
   autocomplete, context menu and public API.
   Register the occurrence ItemView/command and vault/editor invalidations. Index construction
   reads no notes; its first usage request starts indexing. Subsequent Markdown
   changes are debounced independently of manual discovery.
   Missing custom-command targets are paused, never deleted as part of startup.
6. Begin existing icon/locale preparation. At layout-ready, release the startup
   migration notices and run `runLaunchSequence`. After confirming whether this
   is a fresh install, it runs `initializeSidebarTabs` before checking the
   one-time tutorial welcome. The tutorials open automatically on a fresh install
   or an existing installation's first upgrade to them, unless the separate
   `tutorialWelcomeSeen` marker is already set. Later upgrades do not reset it.
   Frozen recovery sessions and failed local marker writes skip the automatic
   popup. Every opening loads thumbnails and video-duration metadata, selects
   the first video and requests autoplay with sound, including the automatic popup.
   Legacy `welcomeSeen` still governs first-install import-prompt eligibility.
   Sidebar initialization detaches any restored
   **Review conversion** leaf on every launch. It offers **Find callouts** only
   once on a confirmed first install, recording `occurrencesTabOffered` in the
   device-local store before adding an inactive, unrevealed tab. Existing welcome
   markers exclude older untouched installs that have no `data.json`. Existing
   leaves anywhere in the workspace are preserved; later launches and upgrades
   leave an absent tab absent. If the local marker cannot be saved, automatic
   creation is skipped. Neither this offer nor the welcome writes a settings
   file. The affected-user-only autocomplete notice is released only
   after the writer proves the normalized settings are durable.
   A successful settings load or actual write marks the installation initialized.
   Startup does not scan solely to add the inactive tab; restoring an already
   open usage view can start the occurrence index.

The registry change loop remains mutation → CSS/repaint → save. The manual
scan stages results outside that loop, saves once using `SettingsWriter.commit`,
and only then adds them in one registry batch. Its notification's ordinary save
request is deduplicated against the committed file.

## External settings changes

Desktop settings events pass through `ReloadQueue`. Foreground checks use the
same queue on the real plugin. `onExternalSettingsChange` first waits for launch
to finish loading settings: boot rebuilds the registry under a hold, and an
adoption started meanwhile would rebuild it again underneath. Calls arriving during an adoption request another
read after it; calls arriving during a preview or settings write are deferred.
Closing a modal, clearing a preview, or finishing a write releases a pending reload.

Successful adoption refreshes theme appearance, command registration and the
settings view without re-discovering callouts. The complete read/merge/backup,
ownership, and missing-file behavior is owned by
[Settings saving, synchronization, and recovery](08-settings-sync-and-recovery.md#multi-device-sync).
This chapter describes when those operations are wired into the plugin lifecycle.

## Unload

Close the settings writer first (`SettingsWriter.close()`): from that moment it
reports itself destroyed and refuses new saves, but a write already under way
finishes and one last pass writes any change made since, before the writer is
destroyed. Destroying it at once used to cancel the pass carrying a change made a
moment before closing. Then close the icon/locale services, manual discovery,
reload queue and CSS injector. Shutdown is terminal: deferred asset reads and
downloads cannot publish artwork/translations, start cache writes, repaint or
notify after their service has been destroyed. Already-started adapter writes and
Obsidian HTTP requests cannot be cancelled; their later results are ignored.
The CSS injector cannot recreate styles after destruction. Layout-ready callbacks
check that the plugin remains active before installing decorators or starting work.
Occurrence-index disposal also clears its debounce, source records and subscribers;
in-flight reads cannot publish after disposal. Registered event
and DOM listeners are removed through Obsidian's plugin lifecycle, along with
the two custom UI icon registrations. There are no
discovery timers, note watchers, prune queues or rediscovery holds to clean up.

The startup CSS snapshot is derived presentation state only. Local storage
holds UI folds, installation markers and the one-time sidebar offer; it never
restores callout definitions.
Disabling and re-enabling the plugin follows the same saved-settings load path.

---
Next chapter: [04-data-model.md](04-data-model.md)
