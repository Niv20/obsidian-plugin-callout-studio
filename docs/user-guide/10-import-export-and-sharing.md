# Import, export & sharing

Callout Studio can migrate data from other callout plugins, create a complete backup, or export block-callout styling as plain CSS.

## Import from another plugin

On first installation, Callout Studio checks whether the vault contains **Callout Manager** or **Admonition**. If it finds either one, a welcome banner appears at the top of the settings with a shortcut to the importer.

The importer brings over the available custom callout names, colors, icons, and uploaded images.

- If the other plugin's data is in the current vault, select that source and use the enabled **Import** button.
- If the data is in another vault, export or copy it from the old plugin first. For Admonition, upload its JSON file or paste the JSON into the importer.
- Callout Manager can be read directly from the current vault or imported from the styles copied by its own export action.

The importer reports unsupported or invalid entries before applying the valid data.
It does not scan, import, enable, disable, or modify existing files in the
vault's CSS snippets folder.

## Export a complete backup

Choose the Callout Studio backup format to save your full setup as JSON, including callout definitions, saved color palettes, and plugin settings. This is the recommended and only supported way to fully restore a Callout Studio setup or transfer it to another vault where the plugin is installed.

When importing a Callout Studio backup, matching entries are updated and valid saved palettes are merged into the destination setup without overwriting unrelated palettes.

## Export a CSS snippet

Choose the CSS option to generate a standalone copy of your Block callout styles. Callout Studio saves the file in the vault's CSS snippets folder.

The CSS file is a one-way styling snapshot, **not a Callout Studio backup**. Callout Studio cannot import this snapshot directly from a CSS file and does not scan the snippets folder for it. To restore or move an editable Callout Studio setup, use the JSON backup instead.

Use the snippet for Obsidian Publish, a static website, or another place where the plugin itself is not running. The export is a snapshot: export it again after changing your designs.

The CSS export covers Block callouts. Heading and Inline callouts depend on the plugin's renderer and are not reproduced by the standalone snippet.

---
**Next:** [Languages](11-languages.md)
