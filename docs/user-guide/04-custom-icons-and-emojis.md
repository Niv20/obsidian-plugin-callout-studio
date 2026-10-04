# Custom icons & emojis

Open a callout for editing and click its current icon to open the icon picker. You can search every source at once or select one library first.
The source selector and search field stay aligned as search results change, even when there are no matches.
On desktop, the available search field is ready for typing when an icon source opens, including **Custom Icons**. On a phone or tablet, tap the search field when you want to type; opening the picker or changing sources does not open the keyboard.

**Confirm** stays dimmed while no icon is selected, which includes right after you switch to another source, because that clears the selection. Press it and a message asks you to select an icon.

## Built-in sources

The picker can offer Lucide, Tabler Icons, Material Symbols, Emoji, Font Awesome, Octicons, RPG Awesome, and Simple Icons.

The source menu lists only what you can pick from right now. Under **Search** is **All sources**, which searches every library at once. Under **Libraries** are the libraries on this device, in the order you set in **Manage icon libraries** (see below), with rounded counts such as **3.8K+** that keep catalog sizes easy to scan. Each heading stays pinned to the top of the menu while its rows scroll underneath it. A line at the bottom, such as **3 more libraries available for download**, tells you how many more you can get. It isn't a button: you download libraries with **Manage libraries**, next to the menu. Once every library is on this device the line goes away, and it comes back as soon as you delete one. On a phone, the menu leaves out its **Choose source** caption to keep room for the library's name.

If you edit a callout whose icon comes from a library this device doesn't have - you deleted it, or you downloaded it only on another device - the callout keeps its icon, and the picker opens on that library. The source menu names it, and when you open the menu it is listed first, under its own **Deleted library** heading. It stays there while you look through other libraries, so you can always go back to it. It still counts toward the libraries available for download: keeping the icon does not keep the full library. That library shows its one-time download prompt, in the middle of the picker, where its icons would be: download it to choose a new icon from it, or choose from another library instead. The library of the icon you are editing is listed under **Current icon** if you hid it.

A library's license and credit line stays at the bottom of the picker, even when a search leaves only a few icons.

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

## Manage icon libraries

Click **Manage libraries** at the end of the source row to open **Manage icon libraries**. This is also where you download a library: the source menu lists only the libraries already on this device. The window works like **Customize menu items**: one list, divided by lines, under these headings.

- **Available libraries** are the ones the picker offers, in the order it offers them. Drag a row by its handle - or focus the handle and press the up and down arrow keys - to change that order. While you drag, a grey slot that follows the active palette shows where the row will land. The reset arrow sits on this heading.
- **Libraries to download** are the ones not downloaded on this device yet. Their rows are dimmed and have no handle, because their order can't change anything until they're downloaded.
- **Hidden libraries** appears only while you have hidden one of the libraries that come with the plugin, and lists it so you can show it again.

The three headings are as large as **Built-in commands** in **Commands and shortcuts**.

Each row has one button:

- A library you download has a **trash** button above the line and a **download** button below it. Under its name you see how many icons it has and its size, so you know what a download costs and what deleting frees.
- **Lucide, Material, Emoji, and Custom Icons** come with the plugin and can't be deleted, so their button hides them from the picker instead, and shows them again from below the line. Hiding **Material** also stops the picker from loading its preview font from Google.

Some libraries can be downloaded and deleted; **Lucide**, **Emoji** and **Material** come with the plugin, so they can only be hidden. A library you download takes its place in your order rather than jumping to the end. The picker always keeps at least one library, so the last one above the line can't be removed.

The window scrolls only when the library you pressed moves to a place you can't see. Delete or hide one and it drops below the line; the window scrolls down with it, so you see where it went. Download one and, the moment the download finishes, the row rises into **Available libraries**; the window scrolls up with it. In every other case - dragging, the arrow keys, the reset arrow, a download that is still running or fails, a question you decline, a library that lands in view anyway - the window stays where it is.

The arrow on the **Available libraries** heading resets everything to how the plugin came: the default order, every library shown, and none of the libraries you downloaded. If any are on the device, it lists them and asks before it deletes them; callouts that use their icons keep them, as with any delete. It never downloads anything. The arrow shows only while something differs from that, so it is also the quickest way to see whether a library is still taking up space.

If callouts use icons from a library you delete, Callout Studio first lists them by name. That includes the callout you're editing right now: an icon you've just picked from the library counts even before you save the callout. They keep their icons - a copy of each is saved with your settings - and you only need the library again to pick new icons from it. A library nothing uses is deleted at once, with no question. While saving is paused, a library that callouts use can't be deleted.

Your order and the libraries you hid sync with the rest of your settings. Downloads don't: each device keeps its own, so a library downloaded on one device appears under **Libraries to download** on another until you download it there too.

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
