# Privacy & permissions

Callout Studio never sends your vault content anywhere and collects no telemetry or analytics. This chapter lists every network request the plugin makes, along with what it stores on your device and why.

## Permissions

Callout Studio asks for a small number of permissions, and all of them stay local to your machine:

- **Vault file enumeration.** The plugin reads note contents through Obsidian's APIs for **Scan for callouts**, callout statistics, **Replace in vault**, **Convert to plain text**, **Convert to standard Markdown**, and warnings about deleting a type that is still in use. It uses that content locally and never sends it anywhere. Statistics, the occurrences sidebar and usage menus share a lazy, in-memory index of Markdown, preferring current editor text for open notes. After the first usage request, vault and editor changes refresh affected entries; there is no unconditional startup scan. Source positions, excerpts and counts are discarded when the plugin unloads and never register callout types or enter plugin settings.
- **Vault file modification.** The plugin writes to notes only when you run **Replace in vault**, **Convert to plain text**, **Convert to standard Markdown**, or a wrap/unwrap command, or when you choose to change them in an **Update your notes?** window: the callout editor asks it before saving a removed ID or a new name that notes use, the palette editor before saving a palette under a new name whose old word notes use, and a built-in's **Reset to default** before removing IDs you added that notes use. It does not rewrite notes in the background.
- **A guess at your publishing service**, when you open Callout Studio's settings and when you open its **Publish to the web** page. To offer the website export to a vault that looks published, and to list the likely service first, the plugin checks whether a few named files exist in the vault's top folder (`publish.js`, `publish.css`, a Quartz configuration file), reads which plugins are switched on from the two lists in the vault's own configuration folder, and looks for a `dg-publish` property on your notes. For a service it finds, it also checks whether that service's exported files are already there, so it does not offer what you have set up. It reads nothing outside the vault, sends nothing anywhere, and chooses nothing for you.
- **Clipboard access**, narrowly: the **Copy callout Markdown**, **Copy heading section** and **Cut heading section** actions write to your clipboard when you click them. The callout ID/alias input field can read a pasted block of comma- or space-separated text so you can paste several IDs at once. The Callout Manager importer reads your clipboard only when you press its **Paste** button, and puts what it read in its text box for you to see; you can also paste into that box yourself. The clipboard is never read at any other time.

No vault content, clipboard data, or usage information is ever transmitted off your device.

The standard Markdown conversion sidebar keeps a local, in-memory preview while
open and refreshes it after note changes. Only explicit confirmation writes the
selected conversions and their heading-link repairs. A partially completed
conversion retains its expected remaining bytes in memory until completed or the
plugin unloads; it does not create a backup or recovery file on disk.

## What's fetched, and when

Nothing is fetched just by opening a note, and nothing is fetched just by opening the icon picker. Searching and browsing every icon source works offline from the moment you install the plugin, because the names, keywords and categories for every icon ship with the plugin itself. The only thing ever downloaded is artwork, and only for icons you actually choose.

There is exactly one exception that isn't tied to pressing a button: downloading the interface's own translation, and only when your language isn't already saved on your device. See [Languages](../user-guide/11-languages.md) for how that works from the user's side.

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

## Translations

Translations are the only files Callout Studio may request without a button press, and only when your language is not already saved on the device. The request runs after the plugin loads, so it does not delay startup. If it fails, the interface stays in English and retries at the next launch. Translation files come from the plugin's repository, are pinned to the installed release, and use the same checksum verification as icon packs. See [Languages](../user-guide/11-languages.md) for the related settings.

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
  [Restore an earlier version](../user-guide/13-syncing-and-backups.md#version-history).
- **Recovery backup files** inside the plugin's vault directory. These can sync
  through your chosen provider and can be removed with that directory. They are
  distinct from the device-only checkpoint; see the same chapter for retention.
  Beside them, one small `labels-<device>.json` per device holds why each of that
  device's backups was taken. These reasons supply the automatic names in
  **Restore an earlier version**; the file syncs like the backups do.
- **The most recent note rewrite**, kept only in memory for **Undo** after
  replacing callouts, converting a type's uses to plain text, or changing notes
  from an **Update your notes?** window. The journal
  holds note paths and their before/after text within a size budget; it creates
  no file and sends no note content anywhere.
- **Artwork for icons in use**, plus your uploaded pictures, inside the plugin's data file. This keeps callouts rendering on a device that synced settings without downloading the original source.

  Stored SVG artwork is filtered again before it is displayed as part of a note
  or the plugin interface, including copies received through sync. Unsafe markup
  is removed; a damaged drawing uses the usual missing-icon display.

  **View details** in **Restore an earlier version** displays a selected version's
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
- **Which callouts your recent themes really draw**: callout IDs and theme names for the last eight themes and light/dark modes, so a callout your theme names without drawing keeps your design from the first moment of a launch instead of flashing. It lives in the app's own local storage, never in the vault, and never leaves the device.
- **Local interface preferences and installation markers.** Folded-section states and the one-time **Find callouts** tab offer stay on this device, scoped to the vault. The installation marker protects settings when an existing installation temporarily cannot find its settings file. Discovery has no local cache; manually saved results live in `data.json`.
- **The exported CSS snippet file**, only if you've explicitly asked for one (see [Import, export & sharing](../user-guide/10-import-export-and-sharing.md)). It's a one-way styling snapshot rather than a Callout Studio backup, is never turned on automatically, and is safe to delete.
- **The exported website files**, only if you've explicitly asked for them in the **Publish to the web** panel (see [Publish to the web](../user-guide/19-publish-to-the-web.md)). Depending on the service you choose, that is the note `callout-studio-quartz.md` or `callout-studio-web.md` at the top of the vault (for Quartz, in the folder Quartz Syncer publishes from where it is on), or a marked section inside `publish.js` and `publish.css` - all in the vault. They hold your callouts' names, icons and colors, and `publish.js` also the code that draws heading and inline callouts on a published site. On Quartz and Digital Garden that code is a plugin of the site's, which you install there yourself from its own public repository (`Callout-Studio/quartz`, `Callout-Studio/digital-garden`) with that service's own tools; Callout Studio downloads nothing for it, and the plugin makes no network request and writes nothing. Nothing in Obsidian loads them, they make no network request of their own, and they are safe to delete. Once you have written them, Callout Studio rewrites them by itself when a callout changes, on every device that has the plugin and the files: only files that are already there, only when they would be different, never a file you edited, and never a version another device wrote with other callouts or another version of the plugin. Deleting a file stops it for that file. The two notes are the one exception to "never a file you edited": a note's body - nothing but your callouts, under a text saying so - is rewritten even when it was edited. Its properties are kept as you set them.
- **The Quartz note reaches your site the way your notes do**: with the vault itself, through Git or a sync service, or, where a plugin such as Quartz Syncer or Enveloppe publishes your notes, when you publish it with that plugin. To set the note up for such a plugin, the panel reads that plugin's own settings file inside the vault's configuration folder (`.obsidian/plugins/quartz-syncer/data.json`, `.obsidian/plugins/obsidian-mkdocs-publisher/data.json`): the name of the property it publishes by and the folders it publishes from, nothing else, and nothing leaves the device. The Callout Studio Quartz plugin makes no network request: during your site's build it reads the notes of the content folder to find that one, and writes nothing.
- **The note reaches your garden only when you publish it** with the Digital Garden plugin, like any other note. The code that reads it there is the Callout Studio garden plugin, which you install yourself from the Digital Garden plugin's own plugin list; that download is the Digital Garden plugin's, from GitHub, and Callout Studio makes no request for it. The garden plugin makes no network request either: during your garden's build it reads the notes in `src/site/notes/`, and writes nothing to the repository.
- **The panel's buttons that lead elsewhere make no request of their own.** **Open garden plugins** and **Open Publication Center** open the Digital Garden plugin's own windows, which load your garden and its plugin list as they do when you open them yourself, or Quartz Syncer's Publication Center, as its own command does; **Open Publish changes** opens Obsidian Publish's own window; **Reveal in Finder** shows a file of your vault, or your vault's own folder, in your computer's file manager, and reads nothing outside the vault; **How to set up a custom domain** opens Obsidian's help page in your browser. Each happens only when you select it.
- **A note you share with the Share Note plugin** carries Callout Studio's styles because Share Note uploads the styles of your Obsidian window with it; that upload, and the page it makes, are Share Note's (see [Publish to the web § Share Note](../user-guide/19-publish-to-the-web.md#share-note)). Callout Studio makes no request for it and writes no file. It only asks Obsidian whether Share Note is switched on, and while it is, adds to the styles it already keeps in your Obsidian window the drawings of the icons your callouts use, so the shared page can show them. Those rules do nothing inside Obsidian.
- **Where the Publish to the web panel was left on this device**: the service you chose, the Quartz version, and which services the settings page has already offered to set up. Beside it, a fingerprint of each website file this device wrote, so that it never replaces another device's version by itself. Both live in the app's own local storage, never in the vault, so they do not travel in a backup or to another device.
- **Recovery copies of the old startup snippet**, if upgrading from a version
  that created `callout-studio-do-not-delete.css`. Cleanup preserves its exact
  contents, including personal edits, as `.txt` files in
  `.obsidian/snippets/callout-studio-recovery/` (or your configured equivalent).
  These copies do not apply CSS and remain until you remove them. If a copy
  cannot be verified, the original snippet is left alone for a later retry.

---
**Next:** [Back to the internals overview](README.md)
