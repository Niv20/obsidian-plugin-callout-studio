# Import, export & sharing

Callout Studio can migrate data from other callout plugins, import a Callout Studio backup, or export block-callout styling as plain CSS.

## Import from another plugin

On first installation, Callout Studio checks whether the vault contains **Callout Manager** or **Admonition**. If it finds either one, a welcome banner appears at the top of the settings with a shortcut to the importer.

The importer brings over the available custom callout names, colors, icons, and uploaded images. The Callout Manager and Admonition importers work the same way. The window lists three options, one under another, and has one **Import** button at the bottom. **Import** always acts on the option with the purple border.

- **This vault** reads the other plugin's data straight from the current vault. If it finds some, it shows how many custom callouts it found, carries a **Recommended** badge, and is already selected when the window opens. If the plugin's folder is missing, it says the plugin isn't installed. If the folder exists but contains no custom callouts, it says none were found. In both cases, the option stays visible with greyed-out text and a not-allowed cursor. An unreadable settings file shows a separate warning.
- **A file**: select the box and pick the data you exported or copied from the old plugin, or drag a file onto the box and drop it there. Either way, the file is selected without importing it straight away. The option shows the file's name until you select **Import**.
- **Copied JSON** (Admonition) or **Copied styles** (Callout Manager): copy the data from the old plugin, then select the box. The option reads your clipboard and confirms that the text was pasted. If the clipboard is empty or can't be read, the option says so.

Picking or dropping a file selects **A file**; pasting selects the copied-data option. To switch, select another option's box. Whatever you chose, dropped, or pasted in the other options is kept until you close the window, so you can switch back to it, but only the selected option is imported. To pick a different file, select the box that's already selected or drop another file onto it; to paste again, select the paste box. The new file or text replaces the old one. If the clipboard is empty or can't be read, the text you pasted before is kept.

The import and export choosers use the same option boxes as this window.
Click anywhere on an available box, or focus it and press **Enter** or
**Space**. Hovering adds a subtle background tint and a clearer border.
The **Recommended** badge darkens slightly while you hover over an unselected
box. A selected box keeps the badge's usual color.
The Callout Studio backup option uses the same paintbrush icon in both
choosers.

- **Admonition:** choose its exported `admonitions.json` or a shared pack, or paste the JSON. A `data.json` copied from another vault works too.
- **Callout Manager:** choose its `data.json` from another vault, or its copied styles saved as a file. You can also paste the styles its **Copy** button produces.

The importer reports unsupported or invalid entries before applying the valid data.
It does not scan, import, enable, disable, or modify existing files in the
vault's CSS snippets folder.

Before applying anything, Callout Studio saves a copy of your current setup to
its [backups folder](17-syncing-and-backups.md#automatic-backups). While saving
is paused, the import is refused and the window stays open, so you can try again
once saving works.

### What transfers

| Source | Transferred | Limitations |
| --- | --- | --- |
| Callout Manager `data.json` | Custom types, supported icons, separate light/dark accent colors, and types with no explicit style | Per-theme rules and custom CSS do not transfer. Callout Studio uses one icon for both color schemes; differences are reported. |
| Callout Manager copied CSS | Recognized callout ids, icons, and one accent color | This is a partial styling snapshot. It does not carry the complete settings or unstyled custom types. |
| Admonition JSON | Custom types, explicit titles, colors, supported library icons, and supported uploaded pictures | Custom CSS, hidden titles, copy buttons, command registration, and color-injection options do not transfer. Active per-type options that are lost are reported. Global plugin settings are not restored. |

Admonition's `ad-*` code blocks are not converted when you import its types.
Those notes still need Admonition or a separate conversion to native callouts.
An icon with an explicit library is more predictable than a library-free name
that exists in several libraries.

Imports are limited to **16 MiB**, **1,000 entries per list or object**,
**50,000 values in total**, and **32 levels of JSON nesting**. Larger setups
must be split into smaller imports. Oversized or overly complex input is
rejected before anything is imported. A long issue report shows its first
200 issues and the full count. Uploaded raster images also have a decoded
size limit, so a small compressed file can still be rejected.

## Import a Callout Studio backup

Choose the Callout Studio backup format when you want to bring back a setup that was previously exported from Callout Studio. To return to a version saved automatically, [Restore an earlier setup](17-syncing-and-backups.md#restore-an-earlier-setup) is simpler: it lists those versions for you.

Before anything changes, Callout Studio shows what the file will do: how many callout types it adds, how many existing ones it replaces with the file's version, and how many groups of settings it restores. If the file has problems, the report lists them instead. Then a copy of your current setup is saved to the backups folder.

- Callouts with the same id are replaced by the file's version; others are added.
- Only the setting groups the file contains are restored. A backup made before a newer setting existed leaves that setting as it is.
- Saved palettes, uploaded pictures and custom commands are merged by id, so your other ones stay.
- While saving is paused, **Import** is unavailable. If the import is displayed but could not be saved, a message says so.

For sync guidance and recovery steps, see [Syncing & backups](17-syncing-and-backups.md).

## Export a CSS snippet

Choose the CSS option to generate a standalone copy of your Block callout styles. Callout Studio saves the file in the vault's CSS snippets folder.

The CSS file is a one-way styling snapshot, **not a Callout Studio backup**. The Callout Studio backup import can't restore it, and Callout Studio doesn't scan the snippets folder for it. To restore or move an editable Callout Studio setup, use the JSON backup instead.

If the snapshot is all you have, the Callout Manager importer can still read it: choose the file, or paste its contents. That recovers each callout's name, icon, and one color, and nothing else.

Use the snippet for Obsidian Publish, a static website, or another place where the plugin itself is not running. The export is a snapshot: export it again after changing your designs.

The CSS export covers Block callouts. Heading and Inline callouts depend on the plugin's renderer and are not reproduced by the standalone snippet.

---
**Next:** [Languages](11-languages.md)
