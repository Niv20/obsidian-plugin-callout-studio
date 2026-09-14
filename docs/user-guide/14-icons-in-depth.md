# Icons in depth

Callout Studio combines seven icon libraries and your uploaded images in one picker. Search offline, adjust an icon's size and position, or remove it entirely.

## The icon picker and its sources

When you open the icon picker from the callout editor, you can search across every library at once by leaving the source on **All sources**, or open the source menu and pick a single library to search within just that one. The seven built-in libraries are:

- **Lucide:** around 1,600 icons. This is Obsidian's built-in icon set, so it is always available offline and requires no download.
- **Tabler Icons:** 5,130 icons in **Outline** style, with 1,054 also available as **Filled**. You can filter them by 41 categories.
- **Material Symbols:** 3,870 icons in **Outlined**, **Filled**, **Rounded**, or **Sharp** styles, with weights from 100 to 700.
- **Emoji:** around 1,900 Unicode emoji, with a skin-tone selector.
- **Font Awesome:** 1,992 icons in **Solid**, **Regular**, or **Brands** styles, with 68 categories.
- **Octicons:** 383 icons from GitHub's icon set.
- **RPG Awesome:** 495 icons designed for fantasy and tabletop themes.

## Searching is offline, artwork is downloaded once

Names, keywords, and categories for all seven libraries are included with the plugin, so search works offline, including **All sources**. Artwork for some libraries is downloaded separately. Press **Download** once for a source, and its artwork remains available offline afterward. Lucide requires no download.

## Fine-tuning size and position

Once you've picked an icon for a callout, you can fine-tune it further: adjust its size, and nudge it with a horizontal offset and a vertical offset, independently of each other. This lets you correct an icon that looks slightly too big, small, or off-center next to your title text.

## The icon tile is the button

In the callout editor, the square showing the current icon is also the button.
Press it to open the picker on the icon you are about to replace.

On a computer, hover over the tile to reveal two arrows and highlight its frame.
Focusing it with the keyboard shows the same state.

On a phone or tablet, the tile continues to show the icon and highlights while
your finger is down. If your system uses reduced motion, the arrows appear on
hover without moving.

## Choosing no icon at all

You do not have to show an icon. Hover over the icon tile to reveal a small **✕**; on phones and tablets it is always visible. Press it to remove the icon from Block, Heading, and Inline Callouts, including PDF exports.

With the icon gone, the title moves over to sit flush at the callout's own edge. If you've turned on the global **Align content with title** option, the body text follows the title over there too, instead of staying indented as if there were still an icon holding it in place.

Turning the icon back on is instant: the icon you had picked before is remembered, so pressing the tile again reopens the picker already showing that exact same drawing, ready to use again.

## Your images: using your own icons

The eighth source, **Your images**, lets you upload an SVG, PNG, JPEG, or WebP file and use it as a callout icon.

SVG shapes, gradients, clipping, and ordinary class-based colors are preserved.
Imported stylesheets, animations, global CSS rules, external references, and CSS
variables are removed. Files that depend on those features may look different;
export them with literal colors and embedded shapes for predictable results.
On older rendering engines without stylesheet parsing support, SVG style blocks
are omitted while colors written directly on shapes remain available.

Disabling the plugin stops icon retries and discards late download results, so
an unfinished download does not restore icon styling after the plugin is off.

For an uploaded SVG, you can choose whether it follows the callout's own color or keeps its original colors. Following the callout's color is useful for a simple, flat, single-color logo or symbol, so it tints along with the rest of the callout. Callout Studio makes a sensible guess about which of these you probably want as soon as you add the file, and the picker always gives you a toggle to switch it either way. Photos and other multi-color raster images (PNG, JPEG, WebP) always keep their own original colors, since tinting wouldn't make sense for them.

Exactly what happens to an uploaded picture on disk, and how network requests for the downloadable libraries work, is covered in [Privacy & permissions](16-privacy-and-permissions.md).

---
**Next:** [Language and localization](15-language-and-localization.md)
