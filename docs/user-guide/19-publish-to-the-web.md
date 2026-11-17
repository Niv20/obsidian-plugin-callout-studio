# Publish to the web

Obsidian Publish, Quartz and Digital Garden turn a vault into a website, but none of them runs plugins. Two things go wrong there:

- A heading callout or an inline callout is Callout Studio's own format, so on the site it shows as the text you typed, such as `[!tip]`.
- A block callout is drawn by the site itself, but the site knows only Obsidian's built-in callouts. A callout you made yourself is drawn as a plain note, and a built-in you changed keeps the site's color and icon.

Callout Studio fixes both, in a different way for each service, because each service gives a different place to do it. Your notes stay exactly as they are.

## Which way for which service

| Your site | Where the callouts are drawn | Readers without JavaScript, search, RSS | After you change a callout |
| --- | --- | --- | --- |
| **Quartz** 4 or 5 | While the site is built | See the callouts | Nothing to do. The next build reads the new note. If a plugin such as Quartz Syncer publishes your notes, publish one note again. |
| **Digital Garden** | While the garden is built | See the callouts | Publish one note again. |
| **Obsidian Publish** | In the reader's browser | See the text you typed | Publish two files again. |

The table is about heading and inline callouts. Quartz and Digital Garden build your site on a computer before anyone visits it. Callout Studio joins that build, so the callouts are ordinary parts of every page. Obsidian Publish has no such step, so there the callouts are drawn when a reader opens the page.

Block callouts are the same on every service: the site draws them, and the files Callout Studio writes hold the styles that give them your colors and icons. See [Block callouts](#block-callouts).

## Open the panel

Open **Settings → Callout Studio**, scroll to **Website**, and select **Open** beside **Publish to the web**. The row carries a **Beta** tag: this feature is new, so how it works and what the panel says may still change. The settings close, and the panel opens in the right sidebar, so you can follow its steps while you work elsewhere in Obsidian. You can also run **Callout Studio: Publish to the web** from the command palette.

The panel is for setting up, so it doesn't stay: close its tab when you're done. It doesn't open again by itself when Obsidian starts.

At the top of the panel, under the caption **Website hosting service**, choose your service: **Obsidian Publish**, **Quartz** or **Digital Garden**, each with its icon. Until you choose one, the panel shows the mascot in the middle and a line asking for a service. A service that needs your attention has a warning sign after its name. Callout Studio looks at your vault and lists the service it finds first. The first time you open the panel, it shows that service. This is only a suggestion, and it writes nothing. Callout Studio reads only your vault for this, and sends nothing anywhere.

![The Publish to the web panel in the right sidebar: under the caption Website hosting service, the list of services shows Obsidian Publish, and under a line across the panel come the numbered steps, each a heading over its own box: 1. Create the files, with its Create files button, 2. Custom domain, with a button to Obsidian's help, then 3. Publish the two files and 4. All done](../../assets/user-guide/web-setup.svg)

### The steps

All the steps are on one page, numbered in the order you do them. Each step is a heading with its number and name, and a box under it with what to do, one thing per line. The panel doesn't mark steps as done: most of them happen on your site, which Callout Studio can't see. The last step, **All done**, says what happens from then on.

A step says the same before and after you do it; only its button changes, for example from **Create note** to **Open note**.

If something is wrong, for example when you edit the note by hand, the step says so in its box.

**Nothing is written until you select Create files** (**Create note** for Quartz and Digital Garden). After that, Callout Studio keeps the files up to date by itself (see [The files stay up to date](#the-files-stay-up-to-date)). If the files ever need it, the button comes back as **Update now**, with a line that says why.

Where a step can be done with a button, the panel has one:

- **Open garden plugins** and **Open Publication Center** open Digital Garden's own windows. For Quartz, **Open Publication Center** opens Quartz Syncer's.
- **Open Publish changes** opens Obsidian Publish's window for publishing.
- **Reveal in Finder** (**Show in system explorer** on Windows and Linux) shows `publish.js` and `publish.css`, which Obsidian's file list doesn't show. For Quartz it shows your site's folder, where Obsidian can (see [Quartz](#quartz)).
- A line of configuration is in a box, with a **Copy** button at the end of the line.

If the plugin a button needs is turned off, or you are on a phone or tablet, the step says the same in words. Every step is available at any time, and you can select and copy its words.

You can set up more than one service: choose another one in the list. The panel remembers the service you chose last.

### The notice at the top of the settings

When your vault looks published, Callout Studio says so at the top of its settings: a notice names the service it found, for example *It looks like this vault is published with Quartz*. If it found more than one service, one notice names them all.

- Select **Show me** to scroll to the **Publish to the web** row, which flashes so you can see where it is.
- Select **✕** to dismiss the notice. It does not come back for those services.

The notice also goes away once you open the **Publish to the web** panel, and it does not show for a service whose files are already in your vault. If you start publishing the vault later, or add a second service, the notice shows once for the new one. It waits while another notice is showing at the top of the settings.

When heading callouts and inline callouts are both turned off, the files are still worth writing: they carry the styles for your block callouts.

## The files stay up to date

The files are a copy of your callouts. After you change a callout's name, icon or color, or a setting under **Global callout style**, Callout Studio writes them again by itself, a moment after the change. There is no switch for this: writing the files once is what turns it on.

- It checks when Obsidian starts, after a callout changes, and when changes arrive from another device, and writes only when the files would be different.
- It never creates a file. If you delete a file, it stays deleted. **To stop the updates for a service, delete its files.**
- It never replaces a file you edited. The panel then says **Out of date.**, and **Update now** asks before it replaces your edits. The notes for Quartz and Digital Garden are the exception: they hold nothing but your callouts (see [The Quartz note](#the-quartz-note) and [The note](#the-note) for Digital Garden).
- It works on every device that has Callout Studio and these files, for example through Obsidian Sync. Devices with the same callouts write the same files, so a second device finds nothing to write.
- A device that would write the files differently never replaces them by itself. That happens when Callout Studio's settings don't sync to that device (Obsidian Sync syncs community plugins only if you turn that on), when its settings haven't arrived yet, or when it runs another version of Callout Studio or Obsidian. Its panel then says **Written on another device**. Select **Update now** there only if that device's callouts are the ones you want on your site: from then on, that device keeps the files up to date, and the other one leaves them alone.
- While Callout Studio can't read its settings and has paused saving, it doesn't write the files either.
- While an icon is still downloading, it waits for the icon instead of writing a placeholder.

Every file starts with a short text that says what the file contains, what not to do with it, and what you can do. A note says it under the heading **READ THIS**.

What is left for you to do after a change depends on the service. See the last column of the table above.

## Quartz

Quartz draws your callouts with the **Callout Studio Quartz plugin**, which you install in your site once, from its own repository: [Callout-Studio/quartz](https://github.com/Callout-Studio/quartz). The plugin holds nobody's callouts. Yours are in a note Callout Studio writes in your vault, `callout-studio-quartz`, and the plugin reads it every time your site is built.

1. In the **Publish to the web** panel, choose **Quartz**. Under **Create the note**, select **Create note**. The note opens in a tab beside the panel.
2. Under **Install the Quartz plugin**, set **Quartz version**, then install the plugin in your site, as below, once. Point at the **?** beside it to see how to tell: if your site has a `quartz.config.yaml` file, it is Quartz 5. Otherwise it is Quartz 4. The panel shows the same lines, each with a **Copy** button.
3. Publish your site as usual. The note goes with your other notes.

The steps can be done in either order. A site with the plugin and no note yet builds as it did before, and its build log says the note is missing.

The note is created at the top of your vault. If your vault is the whole Quartz repository, it goes in `content/`.

If your vault is the whole Quartz repository, the configuration file is in your vault. The panel then knows your version, checks whether the file loads the plugin, and says what is missing.

On a computer, the panel helps you find your site's folder:

- If your vault's folder is named `content`, a **Reveal in Finder** button (**Show in system explorer** on Windows and Linux) comes just above the step that opens a terminal. It shows your vault's folder, inside your site's folder.
- If your vault is the whole Quartz repository, the button shows the configuration file.
- Otherwise, for example when your site reaches the vault through a link, there is no button: nothing in the vault says where the site is.

On a phone or tablet there is no such button. The plugin is installed on the computer that builds your site, or in its repository.

![The Publish to the web panel with Quartz chosen, on a Mac, after the note was written: step 1, Create the note, with an Open note button, a line asking to read the note and a line about plugins that publish only chosen notes, then step 2, Install the Quartz plugin, whose box asks for the Quartz version, set to Quartz 5, then a Reveal in Finder button, then says to open a terminal in the site's folder, to run npx quartz plugin add with a Copy button, and to commit two files](../../assets/user-guide/web-setup-quartz.svg)

### Quartz 5

In a terminal, in your site's folder, run:

```bash
npx quartz plugin add github:Callout-Studio/quartz
```

This adds the plugin to `quartz.config.yaml`, in its place among the plugins, and to `quartz.lock.json`, which pins its version. Commit and push both files. Your site is built from what you push, not from your computer, and its build installs the plugins `quartz.config.yaml` lists, so you don't need to change how your site is built.

### Quartz 4

In a terminal, in your site's folder, run:

```bash
npm install github:Callout-Studio/quartz
```

Then open `quartz.config.ts` and add this line after the other `import` lines:

```ts
import { CalloutStudio } from "quartz-plugin-callout-studio"
```

In the same file, add `CalloutStudio(),` to the `transformers` list, on the line just before `Plugin.Description()`:

```ts
      Plugin.CrawlLinks({ markdownLinkResolution: "shortest" }),
      CalloutStudio(),
      Plugin.Description(),
```

The place matters. After `Plugin.Description()`, the callouts are still drawn on the page, but search and RSS show `[!tip]`. Quartz prints a warning when this happens.

Commit and push `package.json`, `package-lock.json` and `quartz.config.ts`, all three together. Your site is built from what you push, not from your computer, and its build installs the plugin from `package-lock.json` along with Quartz's own packages, so you don't need to change how your site is built. If `quartz.config.ts` is pushed without the other two, or `package.json` without `package-lock.json`, the build stops with an error that names `quartz-plugin-callout-studio`.

### If a plugin publishes your notes

Some sites get their notes from a plugin that sends only the notes you choose. The note has to be sent too.

- **Quartz Syncer** and **Enveloppe**: Callout Studio recognizes them. It creates the note with the property they publish by turned on (`publish` or `share`, or the name you set), and, for Quartz Syncer, in the folder it publishes from. The panel has a step more, **Publish the note**. For Quartz Syncer, select **Open Publication Center**, then select `callout-studio-quartz` and publish it. For Enveloppe, open the note and run **Enveloppe: Upload single current active note**. If the property is off, or the note is in a folder the plugin doesn't publish, the step says so.
- **Any other plugin**: under **Create the note**, the panel reminds you to publish the note with it too.

### The Quartz note

The note starts with the heading **READ THIS** and three callouts that say the same as this list.

- **It is not a page on your site.** Its properties say `draft: true`, and the Quartz plugin also keeps it out of your pages, search, RSS and sitemap, even when a publishing plugin dropped its properties on the way. Leave `draft: true` as it is. If your Quartz 4 site publishes its drafts on purpose, add `CalloutStudio(),` to `filters` in `quartz.config.ts` too.
- **Don't edit it.** Callout Studio writes the note from your callouts, and replaces its content the next time Obsidian starts or a callout changes. If it was changed, the panel says **Changed by hand**. Select **Update now** to replace it right away.
- **Its properties are yours.** Callout Studio keeps any property you add, such as tags. Keep the `callout-studio-quartz` property, and don't add it to another note.
- **You can move or rename it.** Keep it in a folder that is published. Callout Studio finds the note by its property, and the Quartz plugin by what is in it.
- **One note only.** If more than one note carries your callouts, the Quartz plugin reads the one named `callout-studio-quartz`, at the top of your content folder first, and the build log names the others. Delete them.

### After you change a callout

Callout Studio rewrites the note by itself, and it reaches your site with your next build, the same way your notes do. If a plugin publishes your notes, publish the note again: it is listed with the notes that changed.

### Updating the Quartz plugin

The plugin is updated on its own, not with Callout Studio. A note written by a newer Callout Studio than the plugin knows is not read, and the build log says to update the plugin.

- Quartz 5: run `npx quartz plugin install --latest quartz`, then commit `quartz.lock.json`. Quartz names the plugin after its repository, `quartz`.
- Quartz 4: run `npm install github:Callout-Studio/quartz` again, then commit `package-lock.json`.

### When the callouts don't show

Look in your site's build log for a line that starts with `[Callout Studio]`. The Quartz plugin writes it while your site is built, says why, and lets the build go on with the callouts as text:

- **No note was found.** Create it in the panel, and check that it reaches the folder your site is built from. If a plugin publishes your notes, publish the note with it.
- **The note was changed by hand.** Select **Update now** in the panel, then publish the note again if a plugin publishes your notes.
- **The note was written by a newer Callout Studio.** Update the Quartz plugin, as above.
- **More than one note carries your callouts.** Delete the ones the build log names.

**No such line** means the plugin wasn't part of the build. That is the usual reason the callouts look right on your computer, at `localhost` with `npx quartz build --serve`, but not on your live site. The plugin you installed in a terminal is on your computer only, and your site gets it from the files you push. A build that never got them goes on without a word, with the callouts as text. Check that your site's repository has them, as [Quartz 5](#quartz-5) or [Quartz 4](#quartz-4) says: `quartz.config.yaml` that lists `github:Callout-Studio/quartz`, or `quartz.config.ts` with `CalloutStudio(),`.

To build your site the way its host does, clone its repository into a new, empty folder. There, run `npm ci`, then `npx quartz build --serve`, and open the address it prints. If your callouts show as text there, and not in your own folder, something wasn't pushed. `git status` in your own folder shows what.

Tested with Quartz 4.5.2 and Quartz 5.1.0, with and without a theme from Quartz Themes, and with Quartz Syncer 2.2.0.

## Digital Garden

Digital Garden publishes notes, so Callout Studio sends your callouts to your garden as a note: `callout-studio-web`, at the top of your vault. A small garden plugin, also called **Callout Studio**, reads that note while your garden is built and draws your callouts with it. You install the garden plugin once, from inside Obsidian, and never copy a file by hand.

You need a version of the Digital Garden plugin that installs garden plugins. Its **Publication Center** has a **Site** tab with a **Plugins** section.

If the Digital Garden plugin isn't installed and turned on yet, the panel shows a box called **Before you start** above the steps, with no number. Select **Install Digital Garden** to open its page in Obsidian's community plugins, then install and turn it on. The box goes away once it's on, and the steps keep their numbers.

1. In the **Publish to the web** panel, choose **Digital Garden**. Under **Create the note**, select **Create note**. The note opens in a tab beside the panel. Under the button, the panel says the note is required for your callouts to work, and asks you to read it.
2. Under **Install the garden plugin**, select **Open garden plugins**. Digital Garden's **Publication Center** opens at **Site → Plugins → Browse & install**.
3. Search for **Callout Studio** and select **Install**.

If Callout Studio isn't in the list yet, the panel shows a line under the steps with the plugin's GitHub address. Scroll down to **Install from GitHub URL** in the same tab, paste the address, and install from there.
4. Under **Publish the note**, select **Open Publication Center**. Under **Notes**, select `callout-studio-web` and publish it.

Your site rebuilds by itself, as it does when you publish a note. When it finishes, open a note that has a heading callout and check it.

Install the garden plugin before you publish the note. Without the plugin, the note is published as a page of its own. The panel doesn't stop you, so do the steps in their order.

### The note

The note starts with the heading **READ THIS** and three callouts that say the same as this list: what the note contains, what not to do, and what you can do. Writing the note with **Create note** or **Update now** opens it in Reading view.

- **Don't edit it.** Callout Studio writes the note from your callouts, and replaces its content the next time Obsidian starts or a callout changes.
- **Its properties are yours.** Callout Studio keeps any property you add, such as tags. Leave `dg-publish` on `true`, keep the `callout-studio-web` property, and don't add that property to another note.
- **You can move or rename it.** Callout Studio finds the note by its `callout-studio-web` property, not by its name. So does the garden plugin.
- **One note only.** If more than one note has the property, the garden plugin reads the one at the top of your vault, or else the first by path, and the panel lists the others. A copy of the note that a sync service made is kept up to date along with it, so your garden is right whichever one it reads. Delete the others.
- **It is not a page on your site.** The garden plugin leaves it out of your garden, its search and its feed.

Unlike the other services' files, the note is rewritten even if it was changed by hand: it holds nothing but your callouts, so nothing of yours is lost. If it was changed, the panel says **Changed by hand**. Select **Update now** to replace it right away.

### After you change a callout

Callout Studio rewrites the note by itself, but your site shows the change only after you publish the note again. Select **Open Publication Center**, where the note is listed with the other notes that changed, and publish it. If your site looks the same afterwards, do a hard refresh in your browser. The last step of the panel, **All done**, says the same.

### If the callouts don't show

The garden plugin never stops your garden from building. When it can't draw your callouts, they stay as text, and your site's build log says why in a line that starts with `[Callout Studio]`:

- **No note was found.** Publish the note `callout-studio-web`.
- **The note was changed by hand.** Select **Update now** in the **Publish to the web** panel, then publish the note again.
- **The note was written by a newer Callout Studio.** Update the Callout Studio garden plugin from Digital Garden's list of garden plugins.

## Obsidian Publish

Obsidian Publish loads two files from your vault: `publish.js` and `publish.css`. Callout Studio writes a marked section into each. If you already have these files, everything else in them is left as it is.

Obsidian Publish loads `publish.js` only on a site with a **custom domain**. On an address that starts with `publish.obsidian.md`, heading and inline callouts stay as text. This is Obsidian's rule, and there is no way around it. Block callouts don't need `publish.js`: their colors and icons are in `publish.css`, which Publish loads on any address.

To give your site a custom domain, see [Custom domains](https://obsidian.md/help/publish/domains) in Obsidian's help. The panel's **Custom domain** step opens that page too, with **How to set up a custom domain**.

1. In the **Publish to the web** panel, choose **Obsidian Publish** and select **Create files**.
2. If your site's address starts with `publish.obsidian.md`, connect a custom domain. You need to do this only once.
3. Select **Open Publish changes**, select `publish.js` and `publish.css`, and publish them. They are listed there even though the file list doesn't show them.
4. Reload your site. If nothing changed, clear the browser's cache and reload.

You can publish the files before you have a custom domain: block callouts work on any address.

Don't edit the text between `callout-studio:start` and `callout-studio:end`. If you do, Callout Studio asks before it replaces that section.

### After you change a callout

Callout Studio rewrites its section of `publish.js` and `publish.css` by itself. The files show as changed in **Publish changes**: select **Open Publish changes** and publish them again.

## Block callouts

The site draws its block callouts itself. Callout Studio adds styles on top, so that each one looks the way you set it up:

- **Carried to the site:** the callout's color in light and dark mode, its background (plain, gradient or none), the text color you chose, its icon and the icon's size and position, and a gradient title.
- **Global callout style:** only the settings you changed. A border, a corner radius, a title size or a content size you set is carried. A setting you left alone stays as the site draws it.
- **Metadata colors:** a callout written `> [!tip|pink]` is pink on the site too (see [Callout metadata](18-callout-metadata.md)).
- **Left to the site:** its spacing, its fonts and its fold arrow.

Two kinds of callout keep the site's own look:

- **A built-in callout you never changed.** `[!note]` and the others look the way your site draws them. As soon as you change one in Callout Studio, the site shows your version.
- **A callout type that isn't in your callout list.** It looks the way your site draws an unknown callout. If you set a fallback callout, it takes that callout's look instead, as it does in your notes.

Nothing here needs JavaScript. The styles are part of the files Callout Studio already writes for your service, so there is no extra step.

## What to expect

- **Light and dark.** The callouts follow the site's own light or dark mode.
- **Tables of contents.** A heading callout shows its title without the `[!tip]` in front. A heading with no title shows the callout's name.
- **Links to headings keep working.** The heading's address on the page does not change.
- **Only the note's content is changed.** Text in the site's navigation and file list is left as it is.
- **Your Obsidian theme is not on the site.** A callout your theme restyles is drawn as you set it up in Callout Studio. A callout type that only your theme adds is unknown to the site, so it is drawn with your fallback callout's look.
- **A block callout is the site's, so its details can differ.** Quartz gives a callout a thin border and a lighter background than Obsidian does. Callout Studio keeps that frame and puts your colors in it.
- **The files are not a Callout Studio backup.** To move your setup to another vault, use the JSON backup (see [Import, export & sharing](10-import-export-and-sharing.md)).

## Limitations

- **An escaped callout is drawn as a callout.** In a note, `\[!note]` stays as text. A finished web page no longer has the backslash, so the site cannot tell the two apart. To show the text itself, put it in inline code: `` `[!note]` ``. This is true for every service.
- **Digital Garden: text in braces at the very end of a paragraph.** The garden reads `{…}` at the end of a paragraph, a heading or a list item as its own syntax, and removes it. An inline callout such as `[!note]{my text}` then shows the callout's name instead of your text. Put any character after the closing brace, such as a period, and it works.
- **Quartz: the note has to reach the folder your site is built from.** It does when your vault is that folder, or the whole Quartz repository, and through Obsidian Sync or Git. A plugin that copies only the notes you choose sends it only if you publish it (see [If a plugin publishes your notes](#if-a-plugin-publishes-your-notes)).
- **Quartz: a theme can restyle block callouts.** A Quartz theme draws block callouts its own way, for example their titles in its text color. Your colors, backgrounds and icons stay. Heading and inline callouts look as you set them up.
- **Only these three services.** Callout Studio writes files for Obsidian Publish, Quartz and Digital Garden only. On a site made some other way, heading and inline callouts show as the text you typed.
- **Obsidian Publish needs a custom domain**, as described above. On Obsidian Publish, a reader with JavaScript off sees `[!tip]` as text. So do search results and link previews.
- **The text of a link to a heading callout is not changed.** A link such as `[[Note#[!tip] Title]]` shows the heading as you typed it. Give the link its own text: `[[Note#[!tip] Title|Title]]`. Quartz 4 does not turn such a link into a link at all.
- **A block callout whose name isn't plain letters.** Quartz and Digital Garden recognize a block callout only when its name is made of English letters, digits, hyphens and underscores. A name in another script, such as `[!הערה]`, stays a quotation there, and styles cannot change that. Obsidian Publish has no such limit.
- **Digital Garden: the icon appears a moment late.** A garden adds the icon to a block callout after the page has loaded. Your icon appears at that moment.
- **Printing a page.** Obsidian Publish and Digital Garden print a block callout with the site's own icon instead of yours. The colors print.
- **Pictures make the files larger.** A callout whose icon is a picture you uploaded carries that picture in the styles. A few large pictures can double the size of the files.
