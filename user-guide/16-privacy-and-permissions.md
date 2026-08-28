# Privacy & permissions

Callout Studio never sends your vault content anywhere, and it collects no telemetry or analytics of any kind — it has no idea how you use it, and it doesn't want to know. This chapter lists every network request the plugin ever makes, in full, along with exactly what is stored on your device and why.

## Permissions

Callout Studio asks for a small number of permissions, and all of them stay local to your machine:

- **Vault file enumeration.** The plugin reads note contents using Obsidian's own read APIs, for things like vault discovery's optional initial scan and its **Scan now** button, callout statistics, **Replace in vault**, **Convert to plain text**, and warning you before you delete a callout type that's still in use somewhere. Whatever it reads is used only to do that one job — it is never sent anywhere.
- **Vault file modification.** The plugin only writes to your notes when you explicitly ask it to — by running **Replace in vault**, **Convert to plain text**, or one of the wrap/unwrap commands. Nothing is rewritten in the background.
- **Clipboard access**, narrowly, for two things only: the **Copy callout Markdown** menu action writes to your clipboard when you click it, and the callout ID/alias input field can read a pasted block of comma- or space-separated text so you can paste several IDs at once. The clipboard is never read at any other time.

No vault content, clipboard data, or usage information is ever transmitted off your device.

## What's fetched, and when

Nothing is fetched just by opening a note, and nothing is fetched just by opening the icon picker. Searching and browsing every icon source works offline from the moment you install the plugin, because the names, keywords and categories for every icon ship with the plugin itself. The only thing ever downloaded is artwork, and only for icons you actually choose.

There is exactly one exception that isn't tied to pressing a button: downloading the interface's own translation, and only when your language isn't already saved on your device. See [Language and localization](15-language-and-localization.md) for how that works from your side.

## Downloadable icon libraries

Tabler Icons, Font Awesome, Octicons and RPG Awesome ship their artwork as files. Each one downloads the first time you press the **Download** button on that source in the icon picker — after that, it works fully offline. Approximate download sizes:

- **Tabler Icons** — 1.7 MB total (Outline 1.14 MB, Filled 503 KB)
- **Font Awesome** — 1.4 MB total (Solid 794 KB, Regular 105 KB, Brands 559 KB)
- **Octicons** — 375 KB
- **RPG Awesome** — 625 KB

These files come from the plugin's own GitHub repository, pinned to a fixed release tag. Every download is checked against a built-in checksum and rejected outright if it doesn't match exactly, so a compromised network or a corrupted download can never substitute different artwork. The same check runs again every time the file is later read from disk, so a copy that becomes damaged or tampered with afterwards is never trusted either.

Two situations download a source automatically, without you pressing the button — and both happen only because you already asked for those exact icons:

1. Importing callouts that reference icons your vault doesn't have yet.
2. Automatically repairing a downloaded pack file that's gone missing or no longer matches its checksum, but only if a callout would otherwise be undrawable.

## Material Symbols

Material Symbols is the exception to the "one file per source" pattern, because it offers over 100,000 style and weight combinations — there's no single file that could cover it. While its tab is open in the icon picker, a Google Fonts stylesheet loads so the grid can preview icons, and the font file it points to is saved locally, so future launches preview from disk and this source works offline too from then on. Expect roughly 1.0–1.5 MB per style you open; it's safe to delete and gets refetched on demand. When you actually pick an icon, that one SVG drawing is downloaded.

If the preview font can't be reached, the grid falls back to showing icon names instead of pictures, and a **Try again** button lets you retry once you're back online. None of this happens unless you open the Material source yourself.

## Translations

The language chapter, [Language and localization](15-language-and-localization.md), covers this from your side — here's the privacy angle. This is the one request Callout Studio makes entirely on its own, without any button press, and only when your own language isn't already saved on your device. It happens in the background after the plugin has already loaded, so it never delays startup, and if it fails the interface simply stays in English and retries at the next launch. Translation files come from the plugin's own repository, pinned to the release you have installed, and are checksum-verified the same way icon packs are.

## Your own pictures

Pictures you add from your own computer are the one icon source that downloads nothing, ever — they stay on your device.

- An **SVG** stays an SVG, so it's sharp at any size, but it's filtered through a strict allow-list first and every time it's read afterward: scripts, event handlers, and anything that could reach the network are stripped out, while shapes, gradients and clipping survive intact.
- A **PNG, JPEG or WebP** is re-encoded: decoded, scaled down so its longest side is at most 128 pixels, and only the resulting pixels are kept. Nothing of the original file survives to be interpreted later.

These pictures live in the plugin's own data file alongside the rest of your settings, so they travel wherever that file syncs and are included in a JSON export.

## What's stored on the device

- **Artwork of icons actually in use**, plus your own uploaded pictures — both inside the plugin's data file, so callouts keep rendering even on a device that synced your settings but never downloaded a source.
- **The commands you've built** — a few bytes each. The shortcut itself is Obsidian's own and lives in Obsidian's hotkeys file, so it survives a command being edited.
- **Downloaded icon library files** — safe to delete, since callouts keep rendering from the copy already saved in the plugin's data file.
- **The interface's own translation file**, one language only — safe to delete; it falls back to English and re-downloads.
- **The Material Symbols preview font** — used only to draw the icon picker's grid, never your notes.
- **A small local snapshot of the plugin's generated CSS**, purely to shorten the flash of unstyled callouts on a slow startup (mainly on mobile). It lives in the app's own local storage, never in the vault, and never leaves the device.
- **A short list of the callout IDs this device has noticed in your notes**, so your discovered callouts are still listed after a restart without re-reading every note. It holds IDs only — no colours, no icons, no note content — and it lives in the app's own local storage, never in the vault, so it never syncs to your other devices and never leaves this one. Deleting it costs nothing: the list is rebuilt from your notes.
- **The exported CSS snippet file**, only if you've explicitly asked for one (see [Import, export & sharing](11-import-export-and-sharing.md)). It's never turned on automatically, and it's safe to delete.

---
**Next:** [Back to the guide overview](README.md)
