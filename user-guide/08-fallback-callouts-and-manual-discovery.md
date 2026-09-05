# Fallback callouts and manual discovery

Callout Studio creates discovered callout types only when you press **Discover now** in **Settings → Callout Studio → My callout types**, beside **Add new callout**. Opening notes or settings, editing notes, starting Obsidian, and changing themes never add or remove callout definitions.

The button performs one scan of saved Markdown notes and the current theme's declared callout types. Save your notes first. New types receive the selected fallback style; existing types, aliases, customizations, and commands are preserved. Repeating a scan does not duplicate existing types. A scan does not edit your notes or remove unused types.

On narrow panes and phones, the actions wrap below the heading and, when necessary, onto separate lines. Both retain their text labels and remain available when the list is folded. During a scan, **Discover now** shows progress and cannot start a second scan; reopening settings preserves this state.

## Fallback styling

An unrecognized callout can still use the configured **Fallback callout** appearance without becoming a saved definition. Changing that appearance also updates saved fallback rows that you have not customized. Theme-owned callouts continue to use the active theme's appearance.

## Saving and recovery

Results become visible after their settings write succeeds. If a note cannot be read, a note changes during the scan, settings change during the scan, or saving fails, the scan is cancelled without publishing partial results. Wait for synchronization and note edits to finish, then press the button again.

Every manually discovered type is saved in `data.json`, included in JSON exports, and restored on the next launch. There is no active discovery index or discovery completion flag in local storage. Previously saved definitions remain; one manual scan can recover ids still present in saved notes or the active theme.

## Upgrading from the automatic-discovery versions

Before resuming sync or editing, install this build on **both devices** and keep a copy of each device's existing plugin folder. The released versions **2.12.0, 2.12.1 and 2.12.2** write settings format 4 and do not have the later protection against newer settings formats. An old device can therefore remove new manually discovered definitions on its next save even after the other device has upgraded.

On the first upgraded launch, the plugin saves a verified recovery file named `backups/legacy-discovery-v1-<hash>.json` inside its plugin folder. It contains the exact previous local discovery payload and the previous startup CSS. Only after that copy is verified does it remove the old local discovery fields. Reopening or retrying the same upgrade reuses that copy. This recovery file is never automatically imported and is not removed by the routine rotation of settings backups.

If the archive fails, the old local payload and startup CSS stay untouched. Discovery does not use them; the plugin retries the archive on its next launch. Normal rendering continues, but the startup CSS cache is not overwritten until this evidence is protected. If synchronized `data.json` has not arrived, a device with existing local state stays read-only until a readable settings file arrives.

The old discovery cache contained **ids, not custom styles**. The saved settings are authoritative when an old cached id conflicts with a saved custom type. Archived CSS may help recover colors and icon references after earlier damage, but it is not a complete settings backup: names, aliases, commands, and other metadata may already be missing. If every copy of the original settings and CSS was overwritten before the upgrade, the plugin cannot reconstruct that lost information.

## Two devices

Use this build on both devices and allow their settings to synchronize before scanning or editing. Discover on device A, wait for synchronization, then device B loads those definitions without scanning. Device B may run its own manual scan to add types from its saved notes or its different theme. A theme change affects appearance and grouping, not which definitions are saved.

If settings arriving from another device would remove or replace local callout definitions or saved preferences (including palettes, pictures and commands), Callout Studio saves a recovery copy in the plugin's `backups` folder before adopting them. This includes same-count lists and edits to the same id. If that backup cannot be saved, adoption is deferred and a notice explains why. Five recovery copies are retained; the copy just written is kept even if the devices' clocks disagree.

An empty or incomplete settings file is protected rather than replaced with defaults. On a new device, the welcome screen does not create a settings file; saving your first real change checks again for settings that may have arrived through synchronization. Until a real change is saved, the welcome may appear again after a restart. Settings arriving while an editor is open wait until it closes.

Independent offline edits can still conflict at the file-sync layer: there is no shared lock between devices. The incoming readable settings file is adopted after the recovery copy; there is no automatic field-by-field merge. To restore a recovery copy, close Obsidian on both devices, preserve the current settings file, and replace `data.json` with the chosen backup. Let synchronization finish before reopening.

A command whose callout is temporarily absent is paused and retained with its identity, so discovering or restoring its callout can reactivate the command and its existing hotkey.

The settings data format is now version 5. Only later development builds with the newer-format guard become read-only when they encounter it; released 2.12.x builds lack that guard. Update both devices before continuing. This is a local development build based on plugin version 2.12.2, not a published release.

---
**Next:** [Deleting and replacing callouts](09-deleting-and-replacing-callouts.md)
