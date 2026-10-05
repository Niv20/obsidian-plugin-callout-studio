# Privacy & permissions

Callout Studio never sends your vault content anywhere and collects no telemetry or analytics of its own. YouTube may collect viewing activity when you use the tutorial player. This chapter lists every network request the plugin makes, along with what it stores on your device and why.

## Permissions

Callout Studio asks for a small number of permissions, and all of them stay local to your machine:

- **Vault file enumeration.** The plugin reads note contents through Obsidian's APIs for **Scan for callouts**, callout statistics, **Replace in vault**, **Convert to plain text**, **Convert to standard Markdown**, and warnings about deleting a type that is still in use. It uses that content locally and never sends it anywhere. Statistics, the occurrences sidebar and usage menus share a lazy, in-memory index of Markdown, preferring current editor text for open notes. After the first usage request, vault and editor changes refresh affected entries; there is no unconditional startup scan. Source positions, excerpts and counts are discarded when the plugin unloads and never register callout types or enter plugin settings.
- **Vault file modification.** The plugin writes to notes only when you run **Replace in vault**, **Convert to plain text**, **Convert to standard Markdown**, or a wrap/unwrap command. It does not rewrite notes in the background.
- **Clipboard access**, narrowly: the **Copy callout Markdown**, **Copy heading section** and **Cut heading section** actions write to your clipboard when you click them. The callout ID/alias input field can read a pasted block of comma- or space-separated text so you can paste several IDs at once. The Callout Manager importer reads your clipboard only when you press its **Paste** button, and puts what it read in its text box for you to see; you can also paste into that box yourself. The clipboard is never read at any other time.

No vault content, clipboard data, settings, or note-usage index is transmitted off your device by the plugin.

The standard Markdown conversion sidebar keeps a local, in-memory preview while
open and refreshes it after note changes. Only explicit confirmation writes the
selected conversions and their heading-link repairs. A partially completed
conversion retains its expected remaining bytes in memory until completed or the
plugin unloads; it does not create a backup or recovery file on disk.

## What's fetched, and when

Nothing is fetched just by opening a note, and nothing is fetched just by opening the icon picker. Searching and browsing every icon source works offline from the moment you install the plugin, because the names, keywords and categories for every icon ship with the plugin itself. Remote icon artwork is loaded only for sources or icons you choose. The tutorial screen loads YouTube thumbnails, video-duration metadata and its first embedded video whenever it opens, including the automatic opening described below.

Two features can connect without an explicit action: downloading the interface's own translation when your language isn't already saved on your device, and loading the tutorial screen's thumbnails, duration metadata and first video when that screen opens automatically after installation or the first upgrade to the tutorials. See [Languages](../user-guide/11-languages.md) for translation behavior and [YouTube tutorials](#youtube-tutorials) below for the player.

## Downloadable icon libraries

Tabler Icons, Font Awesome, Octicons, RPG Awesome, and Simple Icons provide their artwork as downloadable files. After you press **Download** for a source once - in the **Manage icon libraries** window, opened from **Manage libraries** beside the source menu, or in the icon picker's own prompt when the icon you are editing comes from a library this device does not have - it works offline. Approximate sizes:

- **Tabler Icons:** 1.7 MB total (Outline 1.14 MB, Filled 503 KB)
- **Font Awesome:** 1.4 MB total (Solid 794 KB, Regular 105 KB, Brands 559 KB)
- **Octicons:** 375 KB
- **RPG Awesome:** 625 KB
- **Simple Icons:** 4.5 MB

These files come from the plugin's own GitHub repository, pinned to a fixed release tag. Every download is checked against a built-in checksum and rejected outright if it doesn't match exactly, so a compromised network or a corrupted download can never substitute different artwork. The same check runs again every time the file is later read from disk, so a copy that becomes damaged or tampered with afterwards is never trusted either.

Two situations can download a source automatically, both involving icons you already chose:

1. Importing callouts that reference icons your vault doesn't have yet.
2. Automatically repairing a downloaded pack file that's gone missing or no longer matches its checksum, but only if a callout would otherwise be undrawable.

**Delete** in the Manage icon libraries window removes only that library's own file from the plugin's `icon-packs` folder, and nothing else. Before it does, the artwork of every icon your callouts use from that library - including one you have just picked in a callout you are still editing - is saved into the plugin's data file, so those callouts keep their icons and the repair above has nothing to download. Picking new icons from a deleted library needs the library downloaded again. The window's reset arrow does the same for every downloaded library at once, after listing them and asking; it also touches nothing outside `icon-packs`.

## Material Symbols

Material Symbols does not use one file for the whole source because it offers more than 100,000 style and weight combinations. While its tab is open, the picker loads a Google Fonts stylesheet to preview the grid and saves the referenced font locally for future offline use. Expect roughly 1.0 - 1.5 MB for each style you open. The cached font is safe to delete and will be downloaded again when needed. Selecting an icon downloads that individual SVG.

If the preview font can't be reached, the grid falls back to showing icon names instead of pictures, and a **Try again** button lets you retry once you're back online. None of this happens unless you open the Material source yourself, or the **All sources** list while Material is part of it. Hiding Material in the Icon libraries window takes it out of both, so its font is never requested.

## YouTube tutorials

The welcome screen displays a local catalog of 17 tutorial topics, with
translated titles and descriptions based on the tutorial scripts. All entries
temporarily use the same YouTube sample URL until the published tutorial links
are available. It never queries the YouTube Data API and requires no API key.
Thumbnail URLs are derived from each video's validated
YouTube ID and load from `i.ytimg.com`.

- **Every welcome opening:** thumbnails load immediately, the first video is
  selected and its `youtube-nocookie.com` iframe requests autoplay with sound. This
  also happens on the automatic appearance after installation or the first
  upgrade to the tutorial screen, before any click. Reopening it manually from
  settings or its protocol link repeats the same behavior.
- **Duration badges:** the plugin uses Obsidian's `requestUrl` to read public
  `www.youtube.com/watch?v=<id>` pages and parse their embedded duration JSON.
  The page's scripts are never executed or inserted into Obsidian. Each distinct
  video ID is fetched once while pending, with at most three concurrent requests
  per modal. Successful durations stay in memory until the plugin unloads and
  remain available offline;
  failures can retry when the window reopens. No watch-page HTML is saved in the
  vault. This is a best-effort reading of public page metadata, rather than a
  stable YouTube API: if YouTube changes it, restricts a video or cannot be
  reached, the duration badge is omitted and the rest of the screen still works.
- **Video selection:** selecting a list row loads that video and requests
  autoplay with sound. The embedded player can connect to other YouTube/Google
  services for playback. Your browser or Obsidian webview may require another
  press of the player's play button, including for the initial automatic playback.
- **Further reading:** the link below each video's description opens its matching
  user-guide chapter on GitHub only when clicked. The guide URLs and link labels
  are local catalog data; displaying them does not request the pages.

The thumbnail, duration-metadata and playback requests expose ordinary connection information, including your IP
address, to YouTube/Google, and the player may collect viewing activity under
its own policies. The privacy-enhanced embed hostname does not mean the player
makes no Google connections or guarantees no cookies. No note text, note paths,
callout definitions or plugin settings are included in the requests. The plugin
does not download or execute a YouTube API script in Obsidian's host page;
YouTube runs its player inside the iframe.

Closing the modal removes the iframe and stops playback. Opening or closing the
screen never saves plugin settings. Offline, the local text and numbered tiles
remain available; failed images use those tiles, and selecting a video again
retries it. Callout Studio does not cache video files or thumbnail files in the
vault. The webview may use its ordinary web cache and third-party storage.

## Translations

Callout Studio may download its interface translation without an explicit action when your language is not already saved on the device. The request runs after the plugin loads, so it does not delay startup. If it fails, the interface stays in English and retries at the next launch. Translation files come from the plugin's repository, are pinned to the installed release, and use the same checksum verification as icon packs. See [Languages](../user-guide/11-languages.md) for the related settings.

## Your own pictures

Pictures added from your computer require no download and stay on your device.

- An **SVG** stays an SVG, so it's sharp at any size, but it's filtered through a strict allow-list first and every time it's read afterward: scripts, event handlers, and anything that could reach the network are stripped out, while shapes, gradients and clipping survive intact.
- A **PNG, JPEG or WebP** is re-encoded: decoded, scaled down so its longest side is at most 128 pixels, and only the resulting pixels are kept. Nothing of the original file survives to be interpreted later.

These pictures live in the plugin's own data file alongside the rest of your settings, so they travel wherever that file syncs and are included in a JSON export.

## What's stored on the device

- **A recovery copy of plugin settings**, including callout definitions, palettes,
  commands and stored icon artwork, in the app's IndexedDB storage. It is separate
  from the vault and is not synced or sent to a server by this plugin. The plugin
  does not erase it on ordinary unload/uninstall, but clearing app data or OS
  storage removal can lose it. **Reset everything** can replace it with reset
  state. The exact write ordering, failure boundaries and scoped lifetime are
  documented in [Device checkpoints and vault backups](08-settings-sync-and-recovery.md#device-checkpoints-and-vault-backups).
- **Earlier settings history**, also in device-only IndexedDB, in a separate
  database from the recovery copy. It contains accepted versions of the same
  plugin settings and artwork, deduplicated and retained within a size budget.
  It survives unload/uninstall, but clearing app data can remove it. Each entry
  also holds why it was recorded, which supplies its automatic display name. It is never synced or
  sent to a server by this plugin; see
  [Version history](../user-guide/13-syncing-and-backups.md#version-history).
- **Recovery backup files** inside the plugin's vault directory. These can sync
  through your chosen provider and can be removed with that directory. They are
  distinct from the device-only checkpoint; see the same chapter for retention.
  Beside them, one small `labels-<device>.json` per device holds why each of that
  device's backups was taken. These reasons supply the automatic names in
  **Version history**; the file syncs like the backups do.
- **The most recent note rewrite**, kept only in memory for **Undo** after
  replacing callouts or deleting a type and converting its notes. The journal
  holds note paths and their before/after text within a size budget; it creates
  no file and sends no note content anywhere.
- **Artwork for icons in use**, plus your uploaded pictures, inside the plugin's data file. This keeps callouts rendering on a device that synced settings without downloading the original source.

  Stored SVG artwork is filtered again before it is displayed as part of a note
  or the plugin interface, including copies received through sync. Unsafe markup
  is removed; a damaged drawing uses the usual missing-icon display.

  **View details** in **Version history** displays a selected version's
  changed fields and current/after-restoring visual previews entirely within the
  app. Only differences are displayed; there is no full-backup or original-file-text
  view. It does not send data, fetch assets, write a file, or restore the setup.
  Markup in changed fields remains text; visual previews use sanitized artwork
  from the corresponding snapshot and do not execute stored content or substitute
  the live image pack. Unlike the sync diagnostics report (see
  [08-settings-sync-and-recovery.md](08-settings-sync-and-recovery.md)), this
  comparison contains user-authored setup content; review it before sharing it.

- **The commands you've built:** a few bytes each. Shortcuts live in Obsidian's hotkeys file, so they survive when you edit a command.
- **Downloaded icon library files:** safe to delete because in-use artwork is also saved in the plugin's data file. **Delete** in the Manage icon libraries window does it for you, and its reset arrow does it for all of them.
- **The interface translation file:** one language only and safe to delete. The plugin falls back to English and downloads it again when needed.
- **The Material Symbols preview font:** used only for the icon picker's grid, never for your notes.
- **A small local snapshot of the plugin's generated CSS**, purely to shorten the flash of unstyled callouts on a slow startup (mainly on mobile). It lives in the app's own local storage, never in the vault, and never leaves the device.
- **Local interface preferences and installation markers.** Folded-section states and the one-time **Find callouts** tab offer stay on this device, scoped to the vault. The installation marker protects settings when an existing installation temporarily cannot find its settings file. Discovery has no local cache; manually saved results live in `data.json`.
- **The exported CSS snippet file**, only if you've explicitly asked for one (see [Import, export & sharing](../user-guide/10-import-export-and-sharing.md)). It's a one-way styling snapshot rather than a Callout Studio backup, is never turned on automatically, and is safe to delete.
- **Recovery copies of the old startup snippet**, if upgrading from a version
  that created `callout-studio-do-not-delete.css`. Cleanup preserves its exact
  contents, including personal edits, as `.txt` files in
  `.obsidian/snippets/callout-studio-recovery/` (or your configured equivalent).
  These copies do not apply CSS and remain until you remove them. If a copy
  cannot be verified, the original snippet is left alone for a later retry.

---
**Next:** [Back to the internals overview](README.md)
