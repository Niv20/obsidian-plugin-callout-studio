# Callout Studio for Quartz

A [Quartz](https://quartz.jzhao.xyz) plugin that draws the heading callouts and inline callouts of the [Callout Studio](https://github.com/Niv20/obsidian-plugin-callout-studio) Obsidian plugin while your site is built.

Without it, a heading callout such as `## [!tip] Title` or an inline callout such as `[!warning]` shows on your site as the text you typed. Quartz draws block callouts itself, and this plugin's stylesheet gives them the colors and icons you set up in Callout Studio.

The callouts are drawn into the page while it is built, so readers without JavaScript, your site's search and its RSS feed all get them. Nothing runs in the reader's browser.

## What you need

- The Callout Studio plugin, in the Obsidian vault your site is built from.
- Quartz 5, or Quartz 4.

## Set it up

1. In Obsidian, run **Callout Studio: Publish to the web** from the command palette, choose **Quartz**, and select **Create note**. Callout Studio writes the note `callout-studio-quartz.md` in your vault, with your callouts in it.
2. Install this plugin in your site, as below.
3. Publish as usual. If a plugin publishes your notes, such as Quartz Syncer or Enveloppe, publish the new note with it too.

### Quartz 5

In a terminal, in your site's folder, run:

```bash
npx quartz plugin add github:Callout-Studio/quartz
```

This adds the plugin to `quartz.config.yaml` and `quartz.lock.json`. Commit and push both files, so your site's own build installs the plugin too.

### Quartz 4

In a terminal, in your site's folder, run:

```bash
npm install github:Callout-Studio/quartz
```

Then, in `quartz.config.ts`, add this line after the other `import` lines:

```ts
import { CalloutStudio } from "quartz-plugin-callout-studio"
```

and add `CalloutStudio(),` to the `transformers` list, on the line just before `Plugin.Description()`:

```ts
      Plugin.CrawlLinks({ markdownLinkResolution: "shortest" }),
      CalloutStudio(),
      Plugin.Description(),
```

After `Plugin.Description()`, the callouts are still drawn, but search and RSS show `[!tip]`. The build log says so when it happens.

Commit and push `package.json`, `package-lock.json` and `quartz.config.ts`.

## After you change a callout

Callout Studio updates the note by itself, and your next build reads it. If a plugin publishes your notes, publish the note again.

## Updating the plugin

- Quartz 5: `npx quartz plugin install --latest quartz`, then commit `quartz.lock.json`. Quartz names the plugin after its repository, `quartz`.
- Quartz 4: `npm install github:Callout-Studio/quartz` again, then commit `package-lock.json`.

## How it works

The plugin is the same for every site, and holds nobody's callouts. While your site is built, it finds the note in your content folder, checks it, and draws your callouts with what it carries. You can rename the note and move it to any folder that is published.

The note never becomes a page of your site. Its properties say `draft: true`, the plugin marks it a draft again while your site is built, and on Quartz 5 the plugin also leaves it out. If your Quartz 4 site publishes its drafts, add `CalloutStudio()` to `filters` in `quartz.config.ts` too.

If something is wrong, the build log says so in a line that starts with `[Callout Studio]`, and the callouts stay as text. The build never fails because of this plugin. The usual causes:

- **No note was found.** Create it in Obsidian (step 1), and check that it reaches the folder your site is built from. If a plugin publishes your notes, publish the note with it.
- **The note was changed by hand.** In Obsidian, select **Update now** in the **Quartz** steps of **Publish to the web**, then publish the note again if a plugin publishes your notes.
- **The note was written by a newer Callout Studio.** Update this plugin, as above.
- **More than one note carries your callouts.** Delete the ones the build log names.

## Privacy

The plugin makes no network requests. It reads the notes in your content folder to find the one with your callouts, and writes nothing.

## Source

This repository holds the built plugin. Its source is in the Callout Studio repository, under [`src/web/`](https://github.com/Niv20/obsidian-plugin-callout-studio/tree/master/src/web), and the full guide is [Publish to the web](https://github.com/Niv20/obsidian-plugin-callout-studio/blob/master/docs/user-guide/19-publish-to-the-web.md).

Released under the license in [LICENSE](LICENSE).
