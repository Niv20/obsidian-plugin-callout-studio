# Import, export & sharing

Callout Studio can migrate data from other callout plugins, import a Callout Studio backup, or export block-callout styling as plain CSS.

## Import from another plugin

On first installation, Callout Studio checks whether the vault contains **Callout Manager** or **Admonition**. If it finds either one, a welcome banner appears at the top of the settings with a shortcut to the importer.

To open the importer yourself, go to **Settings → Callout Studio → Import and export → Import**. The **Import from** window lists **Callout Studio** first, for your own backups, and then **Callout Manager** and **Admonition** under **From another plugin**.

The importer brings over the available custom callout names, colors, icons, and uploaded images. The Callout Manager and Admonition importers work the same way. The window has one **Import** button at the bottom, and it always imports the selected option: the one with the purple ring and the filled dot.

- **This vault** reads the other plugin's data straight from the current vault. If it finds some, it shows how many custom callouts it found, carries a **Recommended** badge, and is already selected. This is the most complete route, and nothing has to be exported from the other plugin first. If the other plugin isn't in this vault, or has nothing to import, this option doesn't appear at all.
- The second option depends on the plugin you are moving from, and matches what that plugin gives you:
  - **Admonition → A file.** In Admonition's settings, under **Import & export**, use **Download all** in the **Export custom types as JSON** row. Then select **Upload** here and pick that file, or drag the file onto the box. A notice confirms the upload, the box shows the file's name, and the button changes to **Replace**, which you can use to pick a different file. A shared pack in the same format, or a `data.json` taken from another vault, works too.
  - **Callout Manager → Copied styles.** Use Callout Manager's **Copy** button, then select **Paste** here, or paste into the text box yourself. The box keeps one height and scrolls when the text is long. A `data.json` from another vault works too: open it, copy its contents, and paste them. Callout Studio reads your clipboard only when you select **Paste**; if the clipboard is empty or can't be read, a notice says so.

Uploading a file, or pasting or typing text, selects that option. To switch, select the other option's box or its dot. What you uploaded or pasted is kept until you close the window, so you can switch back to it, but nothing is imported until you select **Import**, and only the selected option is imported. If you select **Import**, or the second option's box or dot, before uploading a file or pasting text, a notice tells you to do that first.

The import and export choosers use the same rounded grey boxes as this window:
an icon, a title, and a line of description. In a chooser, click anywhere on a
box, or focus it and press **Enter** or **Space**; it ends in a small arrow
because selecting it opens the next step straight away. In an importer, a box
ends in a dot instead, because selecting it only chooses what **Import** will
act on.
The Callout Studio backup option uses the same paintbrush icon in both
choosers.

The importer reports unsupported or invalid entries before applying the valid data.
When no entry is valid, **Import valid only** stays dimmed and a message says there is nothing to import; cancel, fix the problems the report lists, and import again.
It does not scan, import, enable, disable, or modify existing files in the
vault's CSS snippets folder.

Before applying anything, Callout Studio saves a copy of your current setup to
its [backups folder](13-syncing-and-backups.md#automatic-backups). While saving
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

Choose the Callout Studio backup format when you want to bring back a setup that was previously exported from Callout Studio. To return to a version saved automatically, [Restore an earlier setup](13-syncing-and-backups.md#restore-an-earlier-setup) lists those versions in collapsible groups. Its **View details** eye button compares your current setup with what would change after restoring that version, including visual previews of affected callouts. Earlier versions are compared and restored there; **Export** in settings saves the setup currently displayed.

Before anything changes, Callout Studio shows what the file will do: how many callout types it adds, how many existing ones it replaces with the file's version, and how many groups of settings it restores. If the file has problems, the report lists them instead. Then a copy of your current setup is saved to the backups folder.

- Callouts with the same id are replaced by the file's version; others are added.
- Only the setting groups the file contains are restored. A backup made before a newer setting existed leaves that setting as it is.
- Uploaded pictures and custom commands are merged by id, so your other ones stay.
- Saved palettes are merged by id and by name, so your other ones stay. A palette in the file that has the same name as one of yours replaces it instead of becoming a second palette with that name, and the callouts that use it take on the file's colors. Names are compared ignoring capitals and spaces around them.
- While saving is paused, **Import** is unavailable. If the import is displayed but could not be saved, a message says so.

For sync guidance and recovery steps, see [Syncing & backups](13-syncing-and-backups.md).

## Export a CSS snippet

Choose the CSS option to generate a standalone copy of your Block callout styles. Callout Studio saves the file in the vault's CSS snippets folder.

The CSS file is a one-way styling snapshot, **not a Callout Studio backup**. The Callout Studio backup import can't restore it, and Callout Studio doesn't scan the snippets folder for it. To restore or move an editable Callout Studio setup, use the JSON backup instead.

If the snapshot is all you have, the Callout Manager importer can still read it: open the file, copy its contents, and select **Copied styles**. That recovers each callout's name, icon, and one color, and nothing else.

Use the snippet for Obsidian Publish, a static website, or another place where the plugin itself is not running. The export is a snapshot: export it again after changing your designs.

The CSS export covers Block callouts. Heading and Inline callouts depend on the plugin's renderer and are not reproduced by the standalone snippet.

---
**Next:** [Languages](11-languages.md)
