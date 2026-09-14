# Privacy & permissions

Callout Studio never sends your vault content anywhere and collects no telemetry or analytics. This chapter lists every network request the plugin makes, along with what it stores on your device and why.

## Permissions

Callout Studio asks for a small number of permissions, and all of them stay local to your machine:

- **Vault file enumeration.** The plugin reads note contents through Obsidian's APIs for **Scan for callouts**, callout statistics, **Replace in vault**, **Convert to plain text**, and warnings about deleting a type that is still in use. It uses that content only for the requested action and never sends it anywhere.
- **Vault file modification.** The plugin writes to notes only when you run **Replace in vault**, **Convert to plain text**, or a wrap/unwrap command. It does not rewrite notes in the background.
- **Clipboard access**, narrowly, for two things only: the **Copy callout Markdown** menu action writes to your clipboard when you click it, and the callout ID/alias input field can read a pasted block of comma- or space-separated text so you can paste several IDs at once. The clipboard is never read at any other time.

No vault content, clipboard data, or usage information is ever transmitted off your device.

## What's fetched, and when

Nothing is fetched just by opening a note, and nothing is fetched just by opening the icon picker. Searching and browsing every icon source works offline from the moment you install the plugin, because the names, keywords and categories for every icon ship with the plugin itself. The only thing ever downloaded is artwork, and only for icons you actually choose.

There is exactly one exception that isn't tied to pressing a button: downloading the interface's own translation, and only when your language isn't already saved on your device. See [Language and localization](15-language-and-localization.md) for how that works from your side.

## Downloadable icon libraries

Tabler Icons, Font Awesome, Octicons, and RPG Awesome provide their artwork as downloadable files. After you press **Download** for a source once, it works offline. Approximate sizes:

- **Tabler Icons:** 1.7 MB total (Outline 1.14 MB, Filled 503 KB)
- **Font Awesome:** 1.4 MB total (Solid 794 KB, Regular 105 KB, Brands 559 KB)
- **Octicons:** 375 KB
- **RPG Awesome:** 625 KB

These files come from the plugin's own GitHub repository, pinned to a fixed release tag. Every download is checked against a built-in checksum and rejected outright if it doesn't match exactly, so a compromised network or a corrupted download can never substitute different artwork. The same check runs again every time the file is later read from disk, so a copy that becomes damaged or tampered with afterwards is never trusted either.

Two situations can download a source automatically, both involving icons you already chose:

1. Importing callouts that reference icons your vault doesn't have yet.
2. Automatically repairing a downloaded pack file that's gone missing or no longer matches its checksum, but only if a callout would otherwise be undrawable.

## Material Symbols

Material Symbols does not use one file for the whole source because it offers more than 100,000 style and weight combinations. While its tab is open, the picker loads a Google Fonts stylesheet to preview the grid and saves the referenced font locally for future offline use. Expect roughly 1.0–1.5 MB for each style you open. The cached font is safe to delete and will be downloaded again when needed. Selecting an icon downloads that individual SVG.

If the preview font can't be reached, the grid falls back to showing icon names instead of pictures, and a **Try again** button lets you retry once you're back online. None of this happens unless you open the Material source yourself.

## Translations

Translations are the only files Callout Studio may request without a button press, and only when your language is not already saved on the device. The request runs after the plugin loads, so it does not delay startup. If it fails, the interface stays in English and retries at the next launch. Translation files come from the plugin's repository, are pinned to the installed release, and use the same checksum verification as icon packs. See [Language and localization](15-language-and-localization.md) for the related settings.

## Your own pictures

Pictures added from your computer require no download and stay on your device.

- An **SVG** stays an SVG, so it's sharp at any size, but it's filtered through a strict allow-list first and every time it's read afterward: scripts, event handlers, and anything that could reach the network are stripped out, while shapes, gradients and clipping survive intact.
- A **PNG, JPEG or WebP** is re-encoded: decoded, scaled down so its longest side is at most 128 pixels, and only the resulting pixels are kept. Nothing of the original file survives to be interpreted later.

These pictures live in the plugin's own data file alongside the rest of your settings, so they travel wherever that file syncs and are included in a JSON export.

## What's stored on the device

- **A recovery copy of plugin settings**, including callout definitions, palettes, commands, and stored icon artwork, in the app's IndexedDB storage. It is separate from the vault and is not synced or sent to a server by this plugin. Callout Studio updates it before writing settings and when valid incoming settings are accepted, allowing an offline branch to survive a later replacement of `data.json`. It remains until replaced or the app's local data is cleared; disabling or uninstalling the plugin does not remove it. **Reset everything** replaces it with the reset state. If the recovery copy cannot be written, the settings write is stopped.

- **Artwork for icons in use**, plus your uploaded pictures, inside the plugin's data file. This keeps callouts rendering on a device that synced settings without downloading the original source.

Stored SVG artwork is filtered again before it is displayed as part of a note
or the plugin interface, including copies received through sync. Unsafe markup
is removed; a damaged drawing uses the usual missing-icon display.
- **The commands you've built:** a few bytes each. Shortcuts live in Obsidian's hotkeys file, so they survive when you edit a command.
- **Downloaded icon library files:** safe to delete because in-use artwork is also saved in the plugin's data file.
- **The interface translation file:** one language only and safe to delete. The plugin falls back to English and downloads it again when needed.
- **The Material Symbols preview font:** used only for the icon picker's grid, never for your notes.
- **A small local snapshot of the plugin's generated CSS**, purely to shorten the flash of unstyled callouts on a slow startup (mainly on mobile). It lives in the app's own local storage, never in the vault, and never leaves the device.
- **Local interface preferences and an installation marker.** Folded-section states stay on this device. The marker protects settings when an existing installation temporarily cannot find its settings file. Discovery has no local cache; manually saved results live in `data.json`.
- **The exported CSS snippet file**, only if you've explicitly asked for one (see [Import, export & sharing](11-import-export-and-sharing.md)). It's never turned on automatically, and it's safe to delete.
- **Recovery copies of the old startup snippet**, if upgrading from a version
  that created `callout-studio-do-not-delete.css`. Cleanup preserves its exact
  contents, including personal edits, as `.txt` files in
  `.obsidian/snippets/callout-studio-recovery/` (or your configured equivalent).
  These copies do not apply CSS and remain until you remove them. If a copy
  cannot be verified, the original snippet is left alone for a later retry.

---
**Next:** [Back to the guide overview](README.md)
