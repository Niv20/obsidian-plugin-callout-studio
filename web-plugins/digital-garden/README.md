# Callout Studio for Digital Garden

A [Digital Garden](https://github.com/oleeskild/digitalgarden) plugin that draws the heading callouts and inline callouts of the [Callout Studio](https://github.com/Niv20/obsidian-plugin-callout-studio) Obsidian plugin while your garden is built.

Without it, a heading callout such as `## [!tip] Title` or an inline callout such as `[!warning]` shows on your garden as the text you typed. Digital Garden draws block callouts itself, and this plugin's stylesheet gives them the colors and icons you set up in Callout Studio.

The callouts are drawn into the page while it is built, so readers without JavaScript, your garden's search and its feed all get them. Nothing runs in the reader's browser.

## What you need

- The Callout Studio plugin, with its **Publish to the web** panel, in the Obsidian vault you publish your garden from.
- A version of the Digital Garden plugin that installs garden plugins. Its **Publication Center** has a **Site** tab with a **Plugins** section.

## Set it up

1. In Obsidian, run **Callout Studio: Publish to the web** from the command palette, or open **Settings → Callout Studio**, scroll to **Website** and select **Open** beside **Publish to the web**. In the panel, choose **Digital Garden**.
2. Under **Create the note**, select **Create note**. Callout Studio writes the note `callout-studio-web.md` at the top of your vault, which carries your callouts.
3. Under **Install the garden plugin**, select **Open garden plugins**. Digital Garden's **Publication Center** opens at **Site → Plugins → Browse & install**. If Digital Garden asks, turn on community plugins.
4. Search for **Callout Studio** and select **Install**. If it is not in the list, paste this repository's address under **Install from GitHub** and select **Install**.
5. Under **Publish the note**, select **Open Publication Center**. Under **Notes**, select `callout-studio-web` and publish it.

Your garden rebuilds by itself. When it finishes, open a note that has a heading callout and check it.

Install this plugin before you publish the note. Without it, the note is published as a page of its own.

## After you change a callout

Callout Studio rewrites the note by itself. Publish it again from the **Publication Center**, like any other note that changed. If your garden looks the same afterwards, do a hard refresh in your browser.

## How it works

The plugin is the same for every garden, and holds nobody's callouts. While your garden is built, it looks through `src/site/notes/` for a note with the `callout-studio-web` property, checks it, and draws your callouts with what it carries. It keeps that note off your site: the note is data, not a page.

If something is wrong, the build log says so in a line that starts with `[Callout Studio]`, and the callouts stay as text. The build never fails because of this plugin. The usual causes:

- **No note was found.** Create it in Obsidian (step 2) and publish it (step 5).
- **The note was changed by hand.** In Obsidian, select **Update now** in the **Publish to the web** panel, then publish the note again.
- **The note was written by a newer Callout Studio.** Update this plugin from Digital Garden's plugin list.
- **More than one note has the property.** The plugin uses the one at the top of your vault, `callout-studio-web.md`, if it is one of them, and otherwise the first by path. Delete the others.

## Privacy

The plugin makes no network requests. It reads only your garden's notes, and writes nothing to your repository.

## Source

This repository holds the built plugin. Its source is in the Callout Studio repository, under [`src/web/`](https://github.com/Niv20/obsidian-plugin-callout-studio/tree/master/src/web), and the full guide is [Publish to the web](https://github.com/Niv20/obsidian-plugin-callout-studio/blob/master/docs/user-guide/19-publish-to-the-web.md).

Released under the license in [LICENSE](LICENSE).
