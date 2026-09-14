# Import, export & sharing

Export your Callout Studio setup to move it to another vault, use it on a published site, or keep a backup. You can also import a previous backup, settings from another plugin, or callouts found in your vault's CSS snippets.

Importing a backup replaces the appearance of matching callout types, including
clearing optional colors, icon adjustments and palette links absent from the
backup. Existing aliases are retained alongside imported aliases so notes using
those names keep working. To remove an old alias and update its note usages, edit
the callout type after importing.

## Exporting your setup

Export offers two formats, and they serve different purposes:

- **Callout Studio backup:** a JSON file containing your callout definitions, saved color palettes, and settings. Use this format to move the complete setup to another vault.
- **CSS snippet:** a plain CSS copy of your styling, saved in the vault's snippets folder. Use it where Callout Studio is not running, such as another vault, Obsidian Publish, or a static site.

## What the CSS snippet covers

The CSS snippet is a snapshot of your styling at the time of export. It does not update when you later change a color or icon, so export it again when you need a fresh copy. Re-exporting replaces only that file, and Callout Studio asks before overwriting a copy you edited by hand.

The snippet covers the classic **Block Callout** form only:

- Colors in both light and dark mode
- Background style, including gradients and transparency
- Icon artwork
- Your global style settings
- Aliases

It does not cover **Heading Callouts** or **Inline Callouts**, since those are built by the plugin itself rather than by plain CSS. It also does not cover any callout set to **Theme style** (more on that in the next chapter), since that one is already left to your theme.

The exported snippet is never turned on for you automatically. Inside this vault, the plugin is already styling those callouts live, so there's nothing to switch on here. You enable the snippet yourself, under Settings → Appearance → CSS snippets, only once you actually need it somewhere else.

## Importing a Callout Studio backup

Icon text from backups is treated as text when styles are generated. Lucide
icon IDs containing punctuation other than dashes or underscores use a pencil
placeholder; ordinary icon names and emoji keep their usual appearance.
After upgrading, the old local startup style snapshot is ignored and regenerated
from your settings. Your callout definitions and recovery data are preserved.

To import a Callout Studio JSON backup from this vault or another one:

1. The importer checks every entry in the file.
2. It reports any problems row by row, so you can see exactly what didn't pass.
3. You choose to bring in just the valid ones.
4. Any imported color palettes are merged into your existing palettes rather than overwriting them.

## Importing from other plugins

Callout Studio can also import your work from two other well-known callout plugins.

**Callout Manager**

This brings over your customized callouts, icons and colors from Callout Manager. You can import it in either of two ways:

- Reading Callout Manager's settings directly out of this vault.
- Using the styles its own **Copy** button puts on your clipboard.

Imported colors use Obsidian's or your theme's normal callout background, so
nested custom callouts no longer receive a stronger background just because
they were imported. If you imported them with an older version and still see
overly bright backgrounds, import from Callout Manager again after updating.
Matching callout types are updated in place; their IDs, aliases and note content
are preserved. Re-importing reapplies the source's colors and icons, so any
later color or icon edits to those types are replaced. Existing styles are not
reset automatically when you upgrade.

Anything that has no equivalent in Callout Studio is listed before the import runs, so you know exactly what did and didn't come across.

**Admonition**

This imports custom admonition names, icons, and colors from the Admonition plugin. You can import them in any of these ways:

- Reading that plugin's settings directly out of this vault.
- An `admonitions.json` file.
- Pasted JSON.

Pictures you'd uploaded to Admonition come across into Callout Studio's own image icons.

## Importing from your vault's CSS snippets

Callout Studio can also detect callout definitions in your vault's CSS snippets folder and offer to import them. This lets you reuse existing hand-written styles without starting over.

---
**Next:** [Using Callout Studio with your theme](12-using-callout-studio-with-your-theme.md)
