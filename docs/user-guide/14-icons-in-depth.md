# Icons in depth

Every callout type shows an icon by default, and Callout Studio gives you a lot of room to choose exactly the right one. One picker brings together seven built-in icon libraries plus your own uploaded images, all searchable offline, with fine control over size, position, and whether an icon appears at all.

## The icon picker and its sources

When you open the icon picker from the callout editor, you can search across every library at once by leaving the source on **All sources**, or open the source menu and pick a single library to search within just that one. The seven built-in libraries are:

- **Lucide** — around 1,600 icons. This is Obsidian's own built-in icon set, so it's always available and always works offline, with nothing to download.
- **Tabler Icons** — 5,130 icons, with a selectable style: **Outline** (available for all of them) or **Filled** (available for 1,054). You can also filter by 41 categories.
- **Material Symbols** — 3,870 icons, with a selectable style (**Outlined**, **Filled**, **Rounded**, or **Sharp**) and a selectable weight from 100 to 700.
- **Emoji** — around 1,900 icons, covering any Unicode emoji, with a skin-tone selector.
- **Font Awesome** — 1,992 icons, with a selectable style (**Solid**, **Regular**, or **Brands**) and 68 categories to filter by.
- **Octicons** — 383 icons, GitHub's icon set.
- **RPG Awesome** — 495 icons, aimed at fantasy and tabletop themes.

## Searching is offline, artwork is downloaded once

Names, keywords, and categories for all seven libraries ship with the plugin, so searching any of them — or **All sources** at once — works fully offline from the moment you install Callout Studio. The only thing that isn't included upfront is the artwork itself. The first time you press **Download** on a source in the picker, its icon drawings are fetched; after that, the whole library works offline too, just like Lucide always has.

## Fine-tuning size and position

Once you've picked an icon for a callout, you can fine-tune it further: adjust its size, and nudge it with a horizontal offset and a vertical offset, independently of each other. This lets you correct an icon that looks slightly too big, small, or off-center next to your title text.

## The icon tile is the button

In the callout editor, the small square showing the current icon isn't a
preview sitting next to a button — it *is* the button. Press it and the picker
opens on the drawing you're about to replace.

On a computer, moving the mouse over it says so: the drawing fades out, two
arrows fade in and drift gently apart and back, and the tile's frame picks up
the same grey highlight the **Display name** and **Callout IDs** fields above it
show when you click into them. Tabbing to it with the keyboard does the same
thing.

On a phone or tablet there's no pointer to hover with, so the tile keeps showing
your icon — the drawing is the thing you came to look at — and the frame lights
up for as long as your finger is down instead. If you've asked your system to
reduce motion, the arrows still appear on hover but hold still.

## Choosing no icon at all

You don't have to show an icon. Hover over the icon tile in the callout editor and a small **✕** appears in its corner — on phone and tablet it's shown all the time rather than only on hover, since there's no hover there. Press it and the callout renders with no icon anywhere: in a Block Callout, a Heading Callout, an Inline Callout, and in an exported PDF alike.

With the icon gone, the title moves over to sit flush at the callout's own edge. If you've turned on the global **Align content with title** option, the body text follows the title over there too, instead of staying indented as if there were still an icon holding it in place.

Turning the icon back on is instant: the icon you had picked before is remembered, so pressing the tile again reopens the picker already showing that exact same drawing, ready to use again.

## Your images: using your own icons

Beyond the seven libraries, there's an eighth source: **Your images**. From the same picker, you can upload your own SVG, PNG, JPEG, or WebP files from your computer and use them as a callout's icon.

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
