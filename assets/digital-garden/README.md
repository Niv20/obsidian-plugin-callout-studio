# Digital Garden gallery picture

`screenshot.png` is the picture Digital Garden's list of community garden plugins
(**Publication Center → Site → Plugins → Browse & install**) shows for the Callout Studio
garden plugin. It is published at the top of the plugin's own repository,
[`Callout-Studio/digital-garden`](https://github.com/Callout-Studio/digital-garden), and the
plugin's entry in `community-plugins.json` (`oleeskild/digitalgarden-plugins`) names it as
`"screenshot": "screenshot.png"`. It is not part of the Obsidian plugin and is not shipped in
its release.

It shows the same page twice, side by side: once as Digital Garden draws it on its own (the
heading and inline callouts stay as typed, the block callout gets Digital Garden's default
look) and once with the garden plugin (all three in the callout's own color and icon). The
page's text is the store picture's Idea copy (`scripts/store-screenshots/scenes.mjs`), and
the Idea callout is seeded the same way.

Nothing in it is a mockup: both halves are real builds of the Digital Garden template, the
plugin is the one `npm run garden:build` builds, and the note it reads is written by the
Obsidian plugin's own Digital Garden export.

## Regenerate

By hand only: no build, test, hook or CI step runs it.

Once, a copy of the Digital Garden template with its packages (the published picture was made
from commit `af6a9ec`):

```sh
git clone https://github.com/oleeskild/digitalgarden.git ~/digitalgarden-template
(cd ~/digitalgarden-template && npm ci --ignore-scripts)
```

Then, from the repository root, with Obsidian installed (its Lucide table is read from the
installed archive) and an existing Playwright install:

```sh
GARDEN_TEMPLATE=~/digitalgarden-template \
PLAYWRIGHT_MODULE=/path/to/node_modules/playwright-core \
node assets/digital-garden/generator/build.mjs
```

`PLAYWRIGHT_MODULE`, `BROWSER_EXECUTABLE` and `OBSIDIAN_ASAR` work as for the
[user-guide renderer](../../docs/internals-docs/20-build-test-release.md#user-guide-svg-renders).
`OUT` writes the picture elsewhere instead of over `screenshot.png`; `KEEP_WORK=1` keeps the
temporary folder with both built sites. The template is only read: each build is a copy of it
in a temporary folder, with its `node_modules` linked.

No network request is made by the run. The template's pages ask CDNs for their scripts (Alpine,
Prism, search, graph); those requests fail, and the note's content does not need them. The one
that shows is Lucide, which Digital Garden uses to draw a block callout's icon: it is answered
with a stand-in that draws the same icon from Obsidian's Lucide table.

The picture is a full-color PNG, about 700 KB. Reducing it to 256 colors turned Digital
Garden's teal block callout grey, so it is not reduced.

## Publish

A separate step, never done by the generator: copy `screenshot.png` to the top of
`Callout-Studio/digital-garden` and commit it to `main`. No release is needed, since the list
reads the picture from the repository's default branch. A garden plugin release replaces that
repository's files with `dist/garden-plugin/`, which does not include the picture: keep it.

## The generator

In `generator/`:

- `build.mjs` runs the steps below and writes the picture.
- `note-scene.mjs` seeds the Idea callout on the documentation host (`scripts/user-guide/`) and
  runs the plugin's Digital Garden export; `note.mjs` runs it in Chromium and returns the note.
- `gardens.mjs` builds the template twice, without and with the garden plugin and the note, and
  checks that only the second draws Callout Studio's callouts and that the plugin logged no
  complaint.
- `capture.mjs` serves each build to Chromium offline and captures the note's content.
- `frame.mjs` places both captures in two windows on the README banner's ground.
- `page.md` is the page's text.
