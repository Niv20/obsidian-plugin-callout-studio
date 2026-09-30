# Custom icons & emojis

Open a callout for editing and click its current icon to open the icon picker. You can search every source at once or select one library first.
The source selector and search field stay aligned as search results change, even when there are no matches.
On desktop, the available search field is ready for typing when an icon source opens, including **Custom Icons**. On a phone or tablet, tap the search field when you want to type; opening the picker or changing sources does not open the keyboard.

## Built-in sources

The picker includes Lucide, Tabler Icons, Material Symbols, Emoji, Font Awesome, Octicons, RPG Awesome, and Simple Icons.

The source menu keeps catalog sizes easy to scan with rounded counts such as **3.8K+**. A grey outlined **Not downloaded** badge marks whole-library packs that are not stored on this device yet; selecting one opens its one-time download prompt.

The menu fits the available window height and scrolls internally, including
with larger interface text. Moving the pointer away clears its hover highlight;
keyboard navigation and the selected library remain available. Arrow keys
highlight only the keyboard's row, even if the pointer rests over another.
Moving the pointer again highlights the row under it.

- **Lucide and Emoji** are available immediately and need no download.
- **Most third-party libraries** need one quick download, after which they work offline.
- **Material Symbols** downloads only the specific SVG you select, keeping its stored footprint small.

Search works offline. Depending on the selected source, the filters at the top can narrow icons by category, style, stroke weight, or emoji skin tone.
Across all libraries, filters expand to use the available row width, including when they wrap below the search field.
For Tabler Icons, the search field is slightly narrower to leave more room for the style and category filters.
For Material Symbols, search sits above the style, weight, and category filters so their choices stay readable.
The source and filters use matching selection fields and menus. The emoji skin tone menu shows a
sample hand beside each tone, so you can see the choice before selecting it.

## Brand logos

**Simple Icons** holds the logos of companies, products, and open-source projects, such as GitHub, Docker, Python, and Notion. It is a single download of about 4.5 MB and works offline afterward.

Each logo is listed under the short name Simple Icons gives it, which spells punctuation out: Node.js is `nodedotjs` and C++ is `cplusplus`. Search understands the usual spellings too, so `node.js`, `nodejs`, and `twitter` (for X) all find their logo.

Three things are worth knowing before you use one:

- **Logos are trademarks of their owners.** Use a logo only to represent the company, product, or service it belongs to, and follow its owner's brand guidelines. The picker keeps this reminder on screen while the source is selected.
- **Some logos are missing on purpose.** Simple Icons itself no longer carries some well-known brands, and Callout Studio leaves out the few logos whose own license restricts how they may be used or passed on. If you have the right to use such a logo, add its file under **Custom Icons** instead.
- **Some logos have a license of their own that asks for credit.** **Icon licenses & credits**, at the bottom of the plugin settings, links to the full list, which also names every logo that was left out and why.

## Use your own graphic

Select **Custom Icons**, then use the picture-plus icon beside the search field to upload an SVG, PNG, JPEG, or WebP file. You can also drop files into the panel.
To delete an uploaded icon, hover over its tile and click the **X**. If a callout uses that icon, the picker warns you before deleting it.

For SVG files, choose whether the artwork keeps its original colors or inherits the callout color. Inheriting the callout color works especially well for flat icons and monochrome logos. Raster images keep their original colors.

Source files are limited to 5 MiB. Raster pictures must also fit within
16,777,216 pixels, with neither side above 16,384 pixels, before they are reduced
to an icon. SVG files have separate size and complexity limits; scripts,
external references, and unsafe embedded pictures are removed or rejected.
The saved picture collection has a shared decoded raster-pixel budget, so a
collection of unusually large embedded pictures may be only partially accepted.
It also has a shared SVG complexity limit. A backup import that would exceed
the limits after combining with your existing pictures is rejected. An
Admonition import reports new pictures it cannot add and keeps existing ones.

Uploaded files remain on your device and are stored with the plugin settings. See [Privacy & permissions](../internals-docs/25-privacy-and-permissions.md) for the storage and download details.

## Adjust or remove the icon

After choosing an icon, adjust its size and horizontal or vertical offset separately for the Block, Heading, and Inline previews.

If you do not want an icon, hover over the icon tile and click the **X**. The title and content realign automatically.

---
**Next:** [Fallback styles & discovery](05-fallback-styles-and-discovery.md)
