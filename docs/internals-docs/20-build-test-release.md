# Build, test, and release

## npm scripts

```bash
npm run dev       # i18n:generate, then esbuild watch mode (inline sourcemaps)
npm run build      # i18n:generate (prebuild), typecheck with scripts/tsconfig.json, then esbuild production (minified)
npm run lint       # eslint with scripts/eslint.config.mts (obsidianmd recommended config + project rules)
npm run format     # prettier --write over src/ and tests/ (format:check is the read-only CI form)
npm test           # scripts/run-tests.mjs
npm run garden:build      # the Callout Studio garden plugin → dist/garden-plugin/ (see The Digital Garden plugin)
npm run quartz:build      # the Callout Studio Quartz plugin → dist/quartz-plugin/ (see The Quartz plugin)
npm run icons:generate    # regenerate icon pack search indexes + manifest - NEVER auto-run
npm run i18n:generate      # regenerate locales/*.json + localeManifest.ts - runs as `prebuild`
```

While `npm run dev` is running, `main.js` on disk is the ~10 MiB inline-sourcemap
dev bundle, and the watcher rewrites it after every source or locale write -
including the `prebuild` step of a fresh `npm run build`. The bundle-budget test
recognises a dev bundle by its inline sourcemap and skips it with a warning
(locally; in CI it fails, because only a production build exists there). To
actually measure the production bundle, stop the watcher, run `npm run build`,
then `npm test`.

## Manual installation from a release

To install a release manually, download `manifest.json`, `main.js`, and
`styles.css` from the [latest GitHub release](https://github.com/Niv20/obsidian-plugin-callout-studio/releases/latest).
Copy the files into `<Vault>/.obsidian/plugins/callout-studio/`, restart
Obsidian, then enable **Callout Studio** in **Settings → Community plugins**.
The plugin needs Obsidian 1.13.4 or later (`minAppVersion`; see
[Raising `minAppVersion`](#raising-minappversion)).

> [!IMPORTANT]
> **`repo-is-live-plugin-folder`**: this repository *is* the plugin's
> installed folder inside the vault (`.obsidian/plugins/obsidian-Plugin-Callout-Studio`).
> `npm run build`/`dev` write `main.js` straight into place - there is no
> separate "install" or copy step. When a fix "doesn't seem to work" after a
> rebuild, check `main.js`'s modification time and check for a duplicate
> plugin folder with the same id before assuming the code is wrong.

## Build (`scripts/esbuild.config.mjs`)

```js
entryPoints: ["src/main.ts"]
bundle: true
external: ["obsidian", "electron", "@codemirror/*", "@lezer/*", ...builtinModules]
format: "cjs"
target: "es2018"
outfile: "main.js"
minify: prod
sourcemap: prod ? false : "inline"
charset: "utf8"
```

Obsidian and CodeMirror packages are externals - the app itself supplies
them at runtime, so bundling them would both bloat `main.js` and risk a
duplicate/mismatched CodeMirror instance. Production builds strip
sourcemaps entirely (dev builds inline them for fast iteration).

`charset: "utf8"` makes esbuild write non-ASCII characters as themselves
instead of its default `\uXXXX` / `\u{XXXXX}` escapes. It is purely a
spelling change - the two builds parse to identical syntax trees - and it is
worth 41 KiB, 97% of it the emoji picker's dataset (`src/data/emojiData.ts`),
where an escaped emoji costs up to 10 bytes against UTF-8's 4. Obsidian reads
`main.js` as UTF-8 on every path: desktop serves the file to a `<script>` in a
`<meta charset="utf-8">` page, and the fallback (and mobile) path reads it as
text through the vault adapter. `tests/repoRelease.test.ts` fails if the
option is removed.

### The web renderer: four bundles

`main.js` is not the only thing esbuild compiles. The website export writes
code that runs where neither Obsidian nor this plugin exists - in a visitor's
browser, or inside a Quartz or Digital Garden build - so
[`scripts/lib/webAssets.mjs`](../../scripts/lib/webAssets.mjs) compiles that
code on its own and hands it to the plugin as text through a virtual module:

```ts
import {
	WEB_CORE_JS, WEB_CORE_GLOBAL,       // src/web/core.ts          the renderer
	WEB_BROWSER_JS, WEB_BROWSER_GLOBAL, // src/web/browser.ts       host: a browser
	WEB_STATIC_JS, WEB_STATIC_GLOBAL,   // src/web/static/index.ts  host: Quartz (the Quartz plugin)
	WEB_GARDEN_JS, WEB_GARDEN_GLOBAL,   // src/web/static/gardenPlugin.ts  hooks: Digital Garden
	WEB_STRUCTURAL_CSS,
} from "virtual:callout-studio-web-assets";
```

Each `*_JS` is one script - `format: "iife"`, `platform: "neutral"`,
minified, with **no** `obsidian` external - that assigns the global named
beside it.

Four bundles rather than one per service, so that the renderer exists once.
A host imports the core **for its types only** and takes it as the first
argument of every function it exports; the exporter then joins text
(`manager/web/targets.ts`): `core + browser + one call` for a browser. The
two build-time hosts are joined the same way, but not by the plugin: nothing
in `src/` imports the static or the garden bundle, so the production build
tree-shakes both out of `main.js`, and only the Callout Studio Quartz plugin
and garden plugin are made of them (`core + static + one export`,
`core + garden + one export`; see [The Quartz plugin](#the-quartz-plugin) and
[The Digital Garden plugin](#the-digital-garden-plugin)). A vault is only ever
written their data: a file for Quartz, a note for a garden. The grammar exists
once however many hosts there are, and a reader on Obsidian Publish downloads
no build-time code. `buildWebBundle` enforces it: each host declares the sources
it may be built from (`only`), and a host whose bundle reaches outside them -
which is what a value import of the core would do - fails the build. So does
any bundle that ends up needing `require()`: reaching one is a build failure
here, not a runtime error on someone's site.

`WEB_STRUCTURAL_CSS` is the slice of `styles.css` between the
`/* @cs-web:start */` and `/* @cs-web:end */` markers, comments stripped: the
structural rules for the heading bar and the inline pill, which a published
page needs and which exist nowhere else. A rule inside the markers must stand
on its own (a `var()` with a fallback, never one of Obsidian's variables bare).

It is a virtual module rather than a generated file checked into `src/`
because the renderer shares its grammar with the editor, and a generated copy
could go stale against it. The same plugin is installed in `run-tests.mjs`, so
the suites evaluate the bytes that ship, and in
`scripts/user-guide/guideRuntime.mjs`, because every picture renderer that
draws the settings bundles the Export chooser and would otherwise fail to
resolve the import. The types for the specifier are in
`src/web/webAssets.d.ts`; `tests/tsconfig.json` lists that file too, since the
linter resolves each tree's own project.

The two `main.js` embeds cost it about 14 KiB (core 12.3, browser 1.8) and
the stylesheet slice about 2.5 KiB, against the budget `release.yml`
enforces. The static and garden bundles are not among them: the static one
was, until it went to the Quartz plugin on 2026-11-17.

#### Checking a host against the real thing

The suites can prove that a host has the shape a platform's source asks for;
they cannot prove the platform accepts it. That is checked by hand, against a
checkout of each, whenever a host or `targets.ts` changes:

- **Quartz 4** (`v4` branch) and **Quartz 5** (`v5`): run `npm run
  quartz:build`, make `dist/quartz-plugin/` a Git repository with one commit,
  and install it the way [the user guide](../user-guide/19-publish-to-the-web.md#quartz)
  says, with its address in place of GitHub's: `npx quartz plugin add
  git+file://<that folder>` on Quartz 5, `npm install git+file://<that folder>`
  and the two lines on Quartz 4 (a local folder works too: `npx quartz
  plugin add <folder>` links it, and `npm pack` gives npm a copy). Put the
  vault's `callout-studio-quartz.md`, as **Create note** wrote it, in the
  content folder, run `npx quartz build`, and look at `public/`: a heading
  has `cs-heading-callout` and the id it had before; `index.xml`,
  `sitemap.xml` and `static/contentIndex.json` hold no `[!` outside code and
  no `READ THIS`; no page was made of the note ("Filtered out" counts it);
  the contents list is clean; the page's `<style>` holds the sheet with its
  quotes intact. Then the ways the note reaches a site: with its properties
  replaced by `title:` only (what Pressroom sends), renamed into a subfolder,
  and on a site that publishes its drafts (Quartz 5:
  `configuration.drafts.publish: true`, still left out; Quartz 4: no
  `RemoveDrafts()`, left out only with `CalloutStudio()` in `filters`) or
  only `publish: true` notes (Quartz 4 `ExplicitPublish()`). Change a value
  in the data and delete the note: one `[Callout Studio]` line each in the
  log, a clean build, `[!tip]` as text. Build once with a theme too: Quartz
  5's `@quartz-themes/core` and, on Quartz 4, a Quartz Themes `_index.scss`
  in `quartz/styles/themes/` with `@use "themes";`, and look at dark mode.
  Then build the way a host does: commit the site, clone it into a new
  folder (no `.quartz/`, no `node_modules/`), and run `npm ci`, then
  `npx quartz plugin install && npx quartz build` (Quartz 5) or `npx quartz
  build` (Quartz 4) with `CI` set. Do it once with the files the user guide
  says to push, where the callouts are drawn, and once with each left out.
  Quartz 5 still draws them without `quartz.lock.json` or without `plugin
  install`, since its build installs what `quartz.config.yaml` lists; without
  `quartz.config.yaml` the build is clean and silent, `[!tip]` as text. On
  Quartz 4, `package.json` and `package-lock.json` without `quartz.config.ts`
  are the same; `quartz.config.ts` without them stops the build, and
  `package.json` without `package-lock.json` stops `npm ci`. What
  [the guide's *When the callouts don't show*](../user-guide/19-publish-to-the-web.md#when-the-callouts-dont-show)
  says has to match.
- **Quartz Syncer**: in an isolated Obsidian with Quartz Syncer set to
  publish to a local folder (`publishTarget: "local"`, `quartzRepoPath` a
  Quartz 5 checkout), write the note from the panel, publish it with Syncer
  (its Publication Center, or `getPublisher().publishBatch` from the console),
  and build: Syncer drops the `callout-studio-quartz` property and rewrites
  the body, and the data block must still read.
- **Digital Garden**: run `npm run garden:build` and copy
  `dist/garden-plugin/` to `src/plugins/callout-studio/` of a garden checkout.
  Publish the note from a vault with the Digital Garden plugin (or copy it to
  `src/site/notes/callout-studio-web.md` with the front matter
  rewritten as that plugin's compiler writes it - one-line JSON, the user's
  properties under `dg-note-properties`). Run the Eleventy build and look at
  `dist/`: the same for a note's page, `feed.xml` and `searchIndex.json`; a
  `> [!tip]` block callout is still the garden's own; the note has no page, no
  file-tree entry and no search entry;
  `plugins/callout-studio/callout-studio.css` exists and every page's `<head>`
  links it. Then delete the note and build again: one `[Callout Studio]` line
  in the log, a clean build, `[!tip]` as text.
- **Block callouts**, on each of them: a callout of the user's own wears its
  colour, background and icon in both modes; a built-in nobody changed looks
  as the site draws it; a note written `> [!tip|pink]` is pink. This is a
  claim about a page, so it is looked at in a browser, not asserted: load the
  built page, or a fixture of the site's own block markup under the site's own
  stylesheet, with the target's stylesheet from `buildWebBundleData`.

Four things a real build shows that the sources do not: a Quartz 5 site from
the `obsidian` template wears a converted Obsidian theme in cascade layers,
which reads `--callout-color` and gives a callout it has no rule for a
quotation's background (see [Import & export § Block
callouts](15-import-export.md#block-callouts-a-stylesheet-in-each-sites-own-terms));
Quartz escapes an inline `css` resource (so the sheet travels as a head
element - see `web/static/quartz.ts`); a garden plugin is on unless its registry entry
says otherwise, so it needs no registration; and Quartz 5 builds its typed
plugin index (`.quartz/plugins/index.ts`) from each plugin's
`dist/index.d.ts`, printing *Skipping <name>: no dist/index.d.ts found* for a
plugin without one, which is why the Quartz plugin ships one.

### The Digital Garden plugin

The Callout Studio garden plugin is a product of its own, released apart from
this plugin: one plugin, the same for every garden, holding nobody's
callouts. What it is and why is in
[Import & export § Digital Garden: the snapshot as a note](15-import-export.md#digital-garden-the-snapshot-as-a-note).

- **Source.** The hand-written files are in `web-plugins/digital-garden/`: the
  manifest (`garden-plugin.json`, which carries the plugin's version),
  `head.njk` and the README the Digital Garden plugin shows. `index.js` is generated: the core
  bundle, the garden bundle, and one line handing the hooks Node's `fs`,
  `path` and `crypto` (`scripts/lib/gardenPluginIndex.mjs`). Unminified, since
  a garden owner is told to read a plugin before letting it run in their build.
- **Build.** `npm run garden:build` writes `dist/garden-plugin/` - the
  manifest, `head.njk`, the README, `index.js` and `LICENSE`
  (`GARDEN_PLUGIN_STATIC_FILES` in `scripts/lib/gardenPlugin.mjs`). It does
  not write `screenshot.png`, which lives in the plugin's repository
  beside them.
- **Gallery picture.** `screenshot.png` at the top of the plugin's repository
  is the picture Digital Garden's list of community garden plugins shows; the
  list reads it from the repository's default branch, so it needs no release.
  Its source is `assets/digital-garden/screenshot.png`, rendered by hand with
  `node assets/digital-garden/generator/build.mjs` from two real builds of the
  Digital Garden template, without and with this plugin. What it needs and how
  to publish it is in `assets/digital-garden/README.md`.
- **Where it is published.** Its own public repository,
  `GARDEN_PLUGIN_REPO_URL` in `manager/web/targets.ts`
  (`github.com/Callout-Studio/digital-garden`), with `garden-plugin.json`
  at the top. Not this repository: the Digital Garden plugin's installer copies
  every file of the repository it is given, except `.git*`, `.github` and
  `node_modules`. The repository's name does not matter to it: it installs
  the files under the manifest's `id` and records the repository's address
  to update from. Until 2026-11-17 the repository was
  `Niv20/garden-plugin-callout-studio`, an address GitHub now forwards.
- **Releasing it.** Bump `version` in
  `web-plugins/digital-garden/garden-plugin.json`, build, replace the
  repository's files with `dist/garden-plugin/` - keeping
  `screenshot.png`, which the build does not write - and publish a
  GitHub release tagged `v` plus that version (`v1.0.0`), the way Digital
  Garden's own plugins are tagged - unlike this plugin's tags, which carry no
  `v`. The installer installs the latest release, and the default branch only
  when there is none. Users update from the Digital Garden plugin's list of
  garden plugins.
- **When.** Whenever what it is built from changes in a way a garden would
  see: `web/core.ts`, anything under `web/static/` that the garden bundle
  pulls in, or the note's format. Changing the note's format in a way an
  installed plugin cannot read means raising `GARDEN_NOTE_FORMAT`, releasing
  the garden plugin first, and only then the Obsidian plugin: an installed
  plugin refuses a newer format and says so in the build log, rather than
  misreading it.
- **The community directory.** Listing it in Digital Garden's directory is a
  pull request adding one entry to `community-plugins.json` in
  `oleeskild/digitalgarden-plugins`. Until then it is installed from its
  address. The Publish to the web panel and the guide are worded for both:
  search Digital Garden's list for it, and paste the address if it is not
  there. The manifest's name stays **Callout Studio**, without "for Digital
  Garden": every entry of that list is for Digital Garden, its own companion
  plugins are named after what they pair with (**Charts**), and it is the
  name a user of this plugin searches for. Only the repository's README title
  says "for Digital Garden", where the page is read out of that context.

`tests/webGarden.test.ts` builds the same `index.js` from the bundles
`npm test` already has and runs it on a pretend garden.

### The Quartz plugin

The Callout Studio Quartz plugin is the garden plugin's twin for Quartz,
released apart from this plugin: one plugin, the same for every site, holding
nobody's callouts. What it is and why is in
[Import & export § Quartz: the snapshot as a note](15-import-export.md#quartz-the-snapshot-as-a-note).

- **Source.** The hand-written files are in `web-plugins/quartz/`: `package.json`
  (which carries the plugin's version, and its `quartz` manifest:
  `category: ["transformer", "filter"]` - the filter keeps the note off a
  site that publishes its drafts, and Quartz 5 uses the same default export
  for both -, `defaultOrder: 65` - after GitHub Flavored
  Markdown at 30, which gives headings their ids, and before Description at
  70, in Quartz 5.1's default configuration), the README a site owner reads,
  and `index.d.ts`. `dist/index.js` is generated: an ES module that imports
  `node:fs`, `node:path` and `node:crypto`, then the core bundle, the static
  bundle, and one line handing the host those three
  (`scripts/lib/quartzPluginIndex.mjs`). Unminified, for the same reason as the
  garden plugin. ESLint skips `web-plugins/quartz/`: its files are published as
  they are.
- **Build.** `npm run quartz:build` writes `dist/quartz-plugin/` - those files,
  `dist/index.js`, `dist/index.d.ts` and `LICENSE` - ready to be the whole
  content of the plugin's repository.
- **Why its shape.** Quartz 5 clones a `github:` source into
  `.quartz/plugins/<repository name>/`, uses a committed `dist/` as it is
  (building nothing, and installing nothing), imports the `import` entry of
  `exports["."]`, and refuses an entry point that imports a package it does not
  provide unless the plugin bundles it (`validatePluginExternals`; Node's own
  modules are always allowed). It builds its typed plugin index from
  `dist/index.d.ts`. Quartz 4 has no plugin installer: npm installs the same
  repository as a package (`files` lists what it takes), the site's
  configuration imports it by its package name, and `index.d.ts` keeps
  Quartz 4's own type check, and an editor open on `quartz.config.ts`, from
  calling it an untyped module (TS7016). The package has no dependency of any
  kind, so neither installer fetches anything else.
- **Where it is published.** Its own public repository,
  `QUARTZ_PLUGIN_REPO_URL` in `manager/web/targets.ts`
  (`github.com/Callout-Studio/quartz`). Not this repository: both
  installers take the whole repository they are given. Quartz 5 names the
  plugin after the repository's name, `quartz`: its folder
  (`.quartz/plugins/quartz/`), its `quartz.lock.json` entry, and the name
  `plugin install --latest` is given. npm names it after the package's name,
  `quartz-plugin-callout-studio` (`QUARTZ_PLUGIN_PACKAGE`), which is what
  Quartz 4's configuration imports, so the two names differ. Until
  2026-11-17 the repository was `Niv20/quartz-plugin-callout-studio`, its
  name the package's; GitHub forwards that address, and a Quartz 5 site that
  added it from there has the plugin under that name.
- **Releasing it.** Bump `version` in `web-plugins/quartz/package.json`, build,
  replace the repository's files with `dist/quartz-plugin/`, commit to `main`,
  and tag `v` plus that version with a GitHub release, as the garden plugin is
  tagged. The tag is for people: Quartz 5 installs the default branch's latest
  commit and pins it in the site's `quartz.lock.json`, and npm pins it in
  `package-lock.json`, so a site moves to a new version only when its owner
  runs `npx quartz plugin install --latest quartz` (Quartz 5) or `npm install
  github:Callout-Studio/quartz` again (Quartz 4).
- **When.** Whenever what it is built from changes in a way a site would see:
  `web/core.ts`, anything under `web/static/` that the static bundle pulls in,
  or the note's format. The note's format is `WebBundleData.version`; changing
  it in a way an installed plugin cannot read means releasing the Quartz plugin
  first, and only then the Obsidian plugin: an installed plugin refuses a newer
  format and says so in the build log, rather than misreading it. Since sites
  pin a commit, a release of the Quartz plugin does not reach them by itself:
  the Obsidian plugin's release notes say when one is needed.
- **The marketplace.** Quartz's plugin marketplace
  (`quartz-community/marketplace`, which Quartz Syncer's plugin browser reads)
  lists every public repository with the `quartz-plugin` topic and a `quartz`
  field in its `package.json`, within six hours, taking the README's first
  heading and paragraph. The topic is not set yet: the plugin does nothing
  without the note a released Callout Studio writes, so it waits for that
  release, as the garden plugin's directory entry does.

`tests/webQuartzPlugin.test.ts` builds the same `dist/index.js` from the
bundles `npm test` already has, writes it and the package's `package.json` into
a temporary site, imports it as Quartz does, and draws a page from the note the
real exporter wrote - once as the vault sends it, once with its properties
replaced and renamed into a folder, as a publishing plugin sends it - and asks
its filter about the note and a page.

Both the plugin's Obsidian API package and the linter's copy pin Moment
2.29.4. The npm override resolves both to 2.31.0, which fixes
[GHSA-4p3w-j4w9-5jqw](https://github.com/advisories/GHSA-4p3w-j4w9-5jqw).
This changes the installed dependency tree, not Obsidian's runtime copy:
Callout Studio does not bundle Moment and only reads the host's current
locale through `window.moment.locale()` as an older-Obsidian language fallback.

## TypeScript config

The canonical configuration lives in `scripts/tsconfig.json`. The build
selects it explicitly with `tsc -p scripts/tsconfig.json -noEmit
-skipLibCheck`; both the plugin and test bundlers select it explicitly too.
The small `src/tsconfig.json` and `tests/tsconfig.json` files extend it so
editors continue to discover the project's compiler settings for each tree.

```json
{ "target": "ES6", "moduleResolution": "bundler", "strictNullChecks": true,
  "strictBuiltinIteratorReturn": true, "noUncheckedIndexedAccess": true,
  "include": ["../src/**/*.ts", "../tests/**/*.ts"] }
```

`strictBuiltinIteratorReturn` keeps a built-in iterator's exhausted `.value`
typed as `undefined` instead of `any`. It lets callers handle empty collections
without type assertions and affects type checking only, not emitted JavaScript.

> [!IMPORTANT]
> **`tests/` is included in the same typecheck as `src/`.** `npm run
> build`'s `tsc -noEmit` gate checks both trees together - a test suite that
> no longer compiles fails the *build*, not just `npm test`. This is
> deliberate: the suites assert against real production signatures, and one
> that's drifted off them is worth stopping the build for.
>
> **`target: ES6` rules out top-level `await` in a test file** - a dynamic
> import has to be awaited *inside* a test body instead.
> `tests/repoTestGate.test.ts` holds both of these rules to account
> mechanically (see below).

## Test runner (`scripts/run-tests.mjs`)

`npm test` **bundles** every `tests/*.test.ts` with esbuild into `.test-out/`
before handing the result to Node's built-in test runner - it does not run
the TypeScript source directly. Two reasons, both structural:

1. `scripts/tsconfig.json` uses `moduleResolution: "bundler"`, so the whole codebase
   imports without file extensions (`../utils/calloutId`). Node's own ESM
   resolver requires them, and the flag that used to relax that requirement
   was removed in Node 20.
2. Several modules under test transitively import `obsidian`, which only
   exists inside the running app. esbuild's `alias` config swaps in
   [`tests/support/obsidianStub.ts`](../../tests/support/obsidianStub.ts)
   instead - a minimal, hand-maintained stand-in kept in `tests/` rather than
   inlined, specifically because it needs to import `@codemirror/state` for
   `editorLivePreviewField` to be a real `StateField`.

The bundle step also installs `webAssetsPlugin`, so a suite that imports
`virtual:callout-studio-web-assets` gets the bundles the build embeds (see
[The web renderer](#the-web-renderer-four-bundles)). Eight suites cover the
website export:

- `webRuntime.test.ts` drives the renderer's passes directly - and runs every
  case over `web/static/liteDom.ts` as well as the fake DOM, comparing the two
  results. That comparison is what holds "`liteDom` implements exactly what
  the renderer calls": a DOM member the renderer starts using and `liteDom`
  lacks fails there.
- `webStatic.test.ts` covers the build-time side: the fragment parser's
  byte-for-byte round trip, the HAST bridge, and the Quartz and Digital Garden
  hosts.
- `webExport.test.ts` covers what is written into the vault for each target,
  by hand and automatically, and evaluates the generated files.
- `webBlockCSS.test.ts` covers the block callout's rules for each site: the
  colour in that site's own variable, the icon where that site keeps one,
  what stays the site's (an untouched built-in, an unknown id without a
  fallback, no `!important`), and that nothing of the active theme reaches
  them.
- `webServices.test.ts` covers service detection, the managed block and the
  automatic refresh: on for every target with no switch, nothing created,
  nothing built for a target that is not in the vault, an edited file left
  alone.
- `webTwoDevices.test.ts` covers the website files on two devices over one
  synced vault: a device with other callouts, with settings that are behind
  or not the user's, or with another build leaves the files alone; two
  devices with the same callouts both keep them current without being told;
  a device adopting settings while running is refreshed; the Digital Garden
  note is compared by its data, repaired after a merge, and its sync copies
  kept current. The devices that adopt settings are real launches.
- `webPanel.test.ts` drives the Publish to the web panel: a detected service
  first in the list (Obsidian's menu, each service with its icon and a
  triangle while it needs the user, in the menu and in the field), nothing
  written before **Create files**; each row a number with a period and a
  name, with no sign of done and no box to tick anywhere, and none held back;
  every row on one page in its place, ending with **All done**; a row's words
  the same before and after it is done, and after the files are rewritten;
  no way to fold a row (a heading is plain text with no role, no `tabindex`,
  and no stop for the keyboard, and every box stays open); the keyboard kept
  where its control is drawn again, and on the first control of the steps
  when it went; Digital Garden's note step with its button first and its
  sentence beside it, in each state of the note; every Copy button working,
  at the end of its well;
  smaller steps as lines of a row's box, unnumbered; each button that leads
  elsewhere (Digital Garden's plugins and Publication Center, an older
  Digital Garden's command, Publish changes, Reveal in Finder, and for
  Quartz's configuration the vault's own folder in a vault named `content`) offered only
  where it can run, said in words otherwise, and telling when its plugin went
  away; the panel reading the vault again for its own files only, and
  releasing its listeners once closed; and that opening it ends the settings
  page's offer. How each row stands is `webChecklist.test.ts`'s.
- `svgCopyToken.test.ts` covers the tag a copy of an uploaded picture is
  fenced with: a number of its own on screen, the caller's inside
  `withSvgCopyToken`, which is what makes a website file the same bytes for
  the same callouts.
- `webOffer.test.ts` covers which services the settings page offers to set
  up: nothing before the vault was looked at, every service in one answer,
  each offered once, one whose files are already there not at all, and one
  that turns up later offered then. The offer's row - one at a time, behind
  the saving notice and the import offer - is in
  `declarativeBannerRows.test.ts`.
- `webGarden.test.ts` follows the Digital Garden note from the vault to the
  garden build: its format, the writer's rules (found by its property, the
  body replaced and the properties kept, a note that only has the name left
  alone), the garden hooks on a pretend garden, through Digital Garden's
  rewrite of the front matter, and the garden plugin's `index.js` as bytes.
  It needs a dropdown, so `obsidianStub.ts` has a `DropdownComponent`.

The suites that run the renderer as a browser does install
`tests/support/fakeDomParser.ts`, a `DOMParser` stand-in that is deliberately
*not* part of `fakeDom.ts`: Node has none, and other suites pin what the icon
painter and the SVG sanitiser do without one.

Test files are named **explicitly**, not discovered via `--test <dir>` or a
glob - Node's test walker silently skips dot-prefixed directories
(`.test-out`) and then mistakes the directory itself for a single test file;
glob arguments to `node --test` only arrived in Node 22, while CI also runs
20. Naming every bundled file avoids all three failure modes at once.

## What the test harness can and cannot see

`tests/support/fakeDom.ts` and `tests/support/obsidianStub.ts` stand in for
the DOM and the `obsidian` module respectively. This is explicitly the
boundary of the automated test suite - anything that has to *look* right
(actual rendering, real theme interaction, real Obsidian internals like
`app.hotkeyManager` or `app.customCss`) is **not** covered and must be
verified by hand: copy `main.js`, `manifest.json`, `styles.css` into
`<Vault>/.obsidian/plugins/callout-studio/` and reload Obsidian. `npm test`
is a gate, not a substitute for that - it covers the pure utilities, the
registry, the CSS it generates, both editor surfaces, the public API, and
the repo's own conventions (below).

The declarative settings tree has a test renderer of its own,
[`tests/support/declarativeRenderer.ts`](../../tests/support/declarativeRenderer.ts):
Obsidian 1.14.4's renderer rebuilt step for step, so a test can draw the tree,
redraw it, open its pages and run the settings search
([26 § Testing the tree](26-declarative-settings.md#testing-the-tree)).

### Waiting for asynchronous work

Most code under test awaits only promises the fakes resolve at once, so a
fixed number of `await Promise.resolve()` or `setImmediate` turns is
deterministic. Code that awaits **Web Crypto** (`sha256` in
`manager/cssSnippetFile.ts`, used by the web export's fingerprints, pack and
locale checks) or a `Blob`'s contents is not: that work finishes on another
thread in wall-clock time, while an idle turn takes microseconds. A test of
such code waits for a condition with a **time** limit, as `until()` in
`tests/webPanel.test.ts` does, never for a count of turns - its 500-turn limit
came to about 8 ms and once failed on a busy CI runner.

To find a test that depends on that timing, run the built suite with those
APIs slowed down, for example by a `--import` preload that delays
`crypto.subtle.digest` and `Blob.prototype.arrayBuffer` by 25-100 ms (through
the real `setTimeout`, captured before `fakeDom` loads). Every suite passes
that way as of 2026-11-17.

### Recovery table browser check

`node scripts/test-recovery-table-corners.mjs` renders the real comparison table
and its callout previews in an isolated Chromium page. Set `OBSIDIAN_APP_CSS` to
a local copy of Obsidian's `app.css`, and `PLAYWRIGHT_MODULE` to an existing
Playwright installation when it is not available through normal resolution.
`BROWSER_EXECUTABLE` optionally selects an installed Chromium executable.
All page network requests are blocked.

The check covers wide and narrow layouts, both text directions and color modes,
the different final-row shapes, sticky header pinning and release, pointer and
keyboard section folding, focus outlines, and callout preview controls. Set
`RECOVERY_BASELINE_CSS` to a saved earlier stylesheet for a before/after comparison;
the candidate defaults to the current `styles.css`. `RECOVERY_SCREENSHOTS` names
an optional output directory for visual review. This remains a browser fixture,
not a substitute for checking the window in Obsidian and on an iPhone.

### User-guide SVG renders

`node scripts/render-user-guide.mjs` generates the local illustrations for
user-guide chapters 01 and 03–17. Pass scene names to regenerate selected assets;
`--all` also regenerates the approved chapter 02 examples. It bundles the production
settings, editors, pickers, context actions, sidebar components, decorators,
registry, CSS injector, and Reading view postprocessor into isolated Chromium
pages. The pages use dark mode and synthetic sample data; they cannot open a
vault or save settings. All page network requests are blocked and fail the run.

`scripts/user-guide/obsidian-runtime.ts` supplies Obsidian's DOM helpers and
basic modal/control shells. The embedded Obsidian editor is unavailable in this
host, so `LiveCalloutPreview` takes its existing Reading view fallback. A small
Markdown host constructs its sample document, and the production postprocessor
and CSS injector render its heading, inline, and block callouts. The autocomplete
fixtures use real CodeMirror editors; their popover placement and native Outline,
link-suggestion, and menu shells belong to the documentation host. The plugin's
actual decorators and action builders populate those shells. Recovery versions,
note scans, and conversion plans come from synthetic data; destructive actions
are never confirmed. These are source-rendered illustrations, not a complete
Obsidian session or a check of its Live Preview internals.

The sidebar views (`find-results`, `find-picker`, `conversion-review`) are not
drawn as a window of their own. `scripts/user-guide/sidebarWindow.mjs` pictures
the slice of Obsidian's window they live in: the view at a real sidebar's width
(340px) in the right sidebar, under the tab row Obsidian draws there (Backlinks,
Outgoing links, Tags, Outline, and the plugin's own tab selected, then the collapse
button), beside the open note, drawn as placeholder lines that begin at the
window's left edge. The sidebar's elements carry Obsidian's own class names, so
its stylesheet draws them; `.guide-window` in `render-user-guide.mjs` lays the
window out. The window is a bordered, rounded card in the picture's usual 24px
frame, as a modal is in the other guide images.

The renderer reads `app.css`, the Lucide geometry table, and the table of icons
Obsidian draws itself (the sidebar's Backlinks and Outgoing links tabs, its collapse
button) from locally installed
Obsidian. On macOS it prefers the newest installed update archive in
`~/Library/Application Support/obsidian/`, falling back to
`/Applications/Obsidian.app/Contents/Resources/obsidian.asar`. Set `OBSIDIAN_ASAR`
for another location, or supply `OBSIDIAN_APP_CSS`, `OBSIDIAN_ICON_DATA`, and
`OBSIDIAN_VERSION` together to use extracted assets (add `OBSIDIAN_GLYPH_DATA`, a
JSON object of that icon table, for the three sidebar scenes, which fail without
it). The host uses that version
for API checks, so the callout color format matches the loaded core stylesheet.
`PLAYWRIGHT_MODULE` selects an existing Playwright
installation and `BROWSER_EXECUTABLE` optionally selects Chromium. No additional
production dependency or network download is introduced.

Theme scenes load the locally installed AnuPpuccin stylesheet from
`<Vault>/.obsidian/themes/AnuPpuccin/theme.css`; set `GUIDE_THEME_CSS` to its path
on another machine. They apply the theme's dark Mocha and Sleek classes, and use
the real theme scanner, overlay reconciliation, and appearance probe. External
font declarations and imports are omitted from this isolated offline fixture;
the theme's callout and control rules remain intact. The user's active theme is
never changed.

`vector-exporter.mjs` converts computed browser geometry, text, colors, and SVG
icon paths into ordinary SVG primitives. The language selector additionally
passes its non-Latin labels through the locally installed `rsvg-convert` tool
(or the executable named by `GUIDE_RSVG_CONVERT`) so Hebrew, Chinese, and other
scripts remain readable when the SVG is viewed on a machine without those
fonts. The committed assets in
`assets/user-guide/` contain no screenshots, embedded bitmap images,
`foreignObject`, scripts, or external resources. Markdown embeds them with
relative image paths. Regenerate them after changing the illustrated components;
check their vector output visually as well as checking the runner's assertions.
New illustrations have a maximum height of 760 SVG pixels including padding.
Their window body scrolls or clips within 704 pixels, retaining the production
header and footer instead of expanding long forms. Text uses local font fallbacks;
emoji remain Unicode text and follow the viewer's emoji font. The exporter keeps
each line in logical text order for bidirectional shaping, preserves uppercase
transforms and letter spacing, and adjusts spacing without stretching glyphs.
Modern color spaces and gradient stops are converted to portable sRGB values.
A hard `box-shadow` ring (`0 0 0 1px colour`: no offset, no blur) is drawn as a
stroke outside the box, which is how Obsidian outlines a note's card in the
Find callouts and Review conversion sidebars; soft and inset shadows are left
out. Those two scenes also give their pane Obsidian's sidebar surface
(`--background-secondary`) and cut the picture to it (`sidebarPanel` in
`scenes-sidebars.mjs`), since the cards are the primary colour on it: on the
page's own colour they would not show; the view fills the pane, since Obsidian
takes its 40px header off the view's height and the picture has none.
A gradient layer is painted where its `background-size` and position put it,
so a checkbox's tick bar (`0% 2px` when unticked) stays empty; a `::before` or
`::after` that is a flex container's only box is placed by the container's
alignment (a search field's clear button, ✕ centred in the button). A
background image that is an SVG data URL is drawn as a vector at its size and
position (Obsidian's up-down chevrons on every dropdown), and a list item's
disc, circle or square bullet (`::marker`, which is not an element) is drawn
beside its first line, so a bulleted list shows its bullets and not only the
indent they leave. A numbered list's marker is drawn the same way, as text
(`1.`, from the item's place in its list and the list's `start`), ending a
space before the item.
The render page sets `scrollbar-width: none` on everything: a browser that
reserves a classic scrollbar's gutter makes the icon picker inset its content
by 15px on both sides, and the picture shows no scrollbar.
The brush mascot is drawn (`createSvg` is in the guide runtime, which is what
`canDrawMascot` asks) but never runs on real frames:
`scripts/user-guide/mascotStill.mjs` makes it ask for none, so a scene that
wants a mood moves its clock with `settleMascots(ms)` and the picture is the
same on every render (the saving-paused banner rests on its still "paused"
face; the Reset everything window is 700ms into its scared one). The footer's
version comes from `manifest.json`.
An element that lies wholly behind an opaque `position: sticky` bar in a scrolled
container is not exported: the browser never shows it (the icon picker opens
with its chosen icon centred, which tucks a row or two of icons under the search
bar), and the bar's box starts at the very edge of the container's clip, so at a
fractional scale the one pixel row both only half cover let a hairline of those
icons through under the line above. It is an SVG-only artifact; Obsidian draws
the bar over the grid.
The context menu and fallback picker use measured bottom margins; the Outline
preview uses compact, vertically centered rows.

**Settings scenes** draw the declarative tree the plugin hands Obsidian
(`settingsTree`), through `scripts/user-guide/settingsPage.mjs`: it builds the
tree's context as the settings tab does and hands the tree to the test renderer
(`tests/support/declarativeRenderer.ts`, Obsidian 1.14.4's renderer rebuilt
step for step), inside a frame shaped like the settings window
(`.modal.mod-settings`). Every renderer sizes that frame through
`scripts/user-guide/settingsPageLayout.mjs`, each with its own picture's width
(the guide 850, the store 780, the phone 430 × 684): left to app.css it would
be a 560-pixel dialog, narrow enough that a callout row keeps fewer of its ids
and cuts its name sooner, as it does in a narrow tab. On the phone, Obsidian names a page in the
window's header, which the frame does not draw, so the store's phone picture
shows the page's own title bar instead. A scene names a sub-page by its page ids, as
`openPagePath` does; the paused-saving example keeps only the main page's
notices box and Version history box (`boxes`), and the language selector opens
Obsidian's own menu inside the frame. The renderer imports the test stub by its
path, so `scripts/user-guide/guideRuntime.mjs` (used by every render script)
points that import at the runtime as well as aliasing `obsidian`; the runtime's
`Setting`, `SettingGroup`, extra button and slider build the DOM app.js builds
(icon slot, chevron, `mod-action`, components a disabled row switches off, the
slider's value, the heading row only while it has something in it). Its Markdown
host gives a callout the icon its CSS names (`--callout-icon`), as Obsidian
does, so the theme probe measures real icons. The Version history fixture is
dated the day the guide is drawn and the day before, so its headings read
"today" and "yesterday".

**What the exporter draws as the browser does** (each was a picture that came
out wrong): a pseudo-element's size counts its border and padding (a settings
row's divider is a 0-high `::before` drawn by its top border); a positioned
`::before` paints above in-flow children (a search field's magnifier over its
input); a mask image with a viewBox and no size of its own is drawn as large as
fits, like `contain`; a mask shape without a fill inherits its parent's (Lucide
says `fill="none"` once, on the `<svg>`); an element that is not displayed
lifts nothing in the paint order (a closed picker's list, z-index 1000, once
buried an open menu); a colour input is a circle of its value; a radio's or
checkbox's value ("on") is not text on screen; each corner keeps its own radius
(a list box under its search field rounds only its bottom two, and the field's
box only its top two). Absolutely positioned
pseudo-elements are exported relative to their parent's padding box, preserving
the native checkbox marker alignment. Outlined language labels keep their
proportions: one scale, from the width, because the outline's font is not the
page's. File-group headings in the find and conversion illustrations have
transparent backgrounds. These framing overrides are confined to the
documentation fixtures.

Three pictures in the folder are not scenes: `metadata-color-scope.svg`,
`metadata-menu.svg` and `metadata-separators.svg` (user guide chapter 18) were
made by hand and are not regenerated.

### README illustrations

`assets/readme/00-banner.svg` is the editable brand banner, maintained directly
and independently of the fixture renders below. Its 670 × 214 viewBox contains
the paintbrush logo and text at the center, with abstract block callouts on
both edges: four body lines in the left block and three in the right, each
below a title bar. There are three inline callouts on the left and two on the
right. The
speech-bubble inline sits below the left block, and the star inline extends
slightly past the right edge. A single heading callout sits at the upper right
with a thin outline and downward
chevron. Edge callouts use distinct icons, gentle rotations, and gaps between
their outlines. It retains outlined Lucide geometry with its ISC notice; it
has no bitmap, active content, or external resources. The README embeds
separate Shields.io badges for GitHub stars,
Obsidian downloads, and the latest release, with custom Lucide logos. Their
values update automatically (subject to caching); downloads come from the
official `obsidianmd/obsidian-releases` community-plugin statistics, rather than
the sum of GitHub release-file downloads. No counters are baked into the banner.

`node scripts/render-readme-images.mjs` writes two self-contained SVGs in
`assets/readme/`, embedded by the root README. It uses the same local Obsidian
assets, offline fixture host, vector exporter, and browser overrides as the
user-guide renderer. It leaves all store artwork unchanged.

`01-settings.svg` extracts just the settings window from desktop store image
01, removing the surrounding workspace and promotional heading. It is 960
pixels wide with 8 pixels of transparent margin, and as tall as the window
comes out. Refresh the store source first with
`node scripts/render-store-screenshots.mjs 01-settings` if its settings content
changes.
`02-syntax.svg` is 1080 × 666: a full-width dark syntax reference compares
default and custom content for Heading, Inline, and Block using the exact
`[!note]` snippets from the README. Below it, two adjacent dark panels show an
actual Purple Idea heading, inline, and block callout beside their exact
Markdown. The fixed reference rows and English example live in
`scripts/readme/scene.mjs`; production Reading view
processors, icon painting, and generated CSS render the preview. The panel
headers, source highlighting, and spacing are illustration framing.
Source groups retain at least one blank line between them, including after
**inside a sentence.**, even when the preview fits that paragraph on one line.
The inline source's first line ends with **right**, and the block body's first
line ends with **Keep**, filling the available panel width before continuing.

Both backgrounds are transparent outside the windows. The runner checks all
three production render formats, exact reference snippets and Markdown
correspondence, overflow, XML, local paint references, unique IDs, and absence of bitmap or active/external
content. It blocks network requests. Review the SVGs visually at README width;
temporary raster previews belong outside the asset directory.

`03-more-features.svg` is the transparent 1200 × 556 feature grid (the bento of
desktop image 05 without its central tile). `node scripts/render-readme-features.mjs`
composes it, with no browser, from the fragments image 05 uses: the five captures
in `assets/store-screenshots/desktop/components/` and the guide's Version history
picture. Refresh those first (the five `render-store-bento-*.mjs` captures, and
`node scripts/render-user-guide.mjs version-history`), because the grid embeds
copies of them. Two tiles are cut on purpose so the list reads as continuing:
Find callouts ends between the two lines of its second result, and Version
history shows a third version cut by the tile's bottom edge. The Version history
crop is the same code as the store image's, in `scripts/store-bento/history-tile.mjs`,
so change it there. The result boxes are `#232323` because the Find component's
capture sets them so (see `store-bento-artwork.md`); re-render that capture before
the grid, or the grid keeps the old fill.

### Store screenshots

`node scripts/render-store-screenshots.mjs` generates four 1200 × 800 desktop
SVGs in `assets/store-screenshots/desktop/svg/`. Pass scene names such as
`01-settings` to regenerate selected images. `scripts/store-screenshots/`
contains the scene data and purple promotional framing. Production settings,
editors, pickers, and rendered callouts use the shared documentation host with
synthetic data; the simplified surrounding Obsidian workspace and headings are
editorial artwork. No real vault is opened or changed, and browser network
requests are blocked and fail the run.

The framing uses one short headline and gives the central UI most of the
canvas. The abstract Obsidian workspace is centered behind it; only the file
list at left has synthetic name bars and small downward chevrons on folder
rows. The space behind the foreground window is blank. In the notes scene, the
workspace and reading area behind the note use `#17161d`; the note canvas
keeps its `#1c1c1c` fill. Neither window has a black drop shadow. There are no
subtitles, outer corner brand labels, bottom taglines, or per-image navigation
counters. The narrower settings scene
enables Obsidian's native settings background so the real rounded row surfaces
are visible. Its three synthetic custom callouts each show a primary ID and an
alias: Idea (`idea`, `spark`), Meeting (`meeting`, `sync`), and Research
(`research`, `study`); Meeting uses the Plum preset. The notes scene uses a
moderately narrower reading area and longer English copy to fill its height,
with **The Three Callout Types** rendered through Obsidian's native
`inline-title` styling above `idea` as a real heading, inline, and block
callout. The creation scene shows
the same Idea IDs and uses a taller native modal to reveal more of **Live
preview**. The icon picker is the fourth scene; the former color scene has been
removed.

`node scripts/render-store-icons-04b.mjs` generates the separate alternative
`04B-icons.svg`. Its dedicated scene and composition modules leave the original
`04-icons.svg` in place. The production icon picker is placed on the left and
**Manage icon libraries** on the right, with equal displayed heights and a
narrower management window. The offline fixture shows the window as someone who
has used it, so all three of its groups appear: Emoji is hidden, Octicons and
RPG Awesome are not on the device (the downloadable packs are marked locally
ready except those two) and are listed under **Libraries to download**, and the
rest stay under **Available libraries** in the requested order. It does not
download pack files. The renderer asserts each group's rows, the button each row
carries (hide, delete, download, show), and that every management row fits
without scrolling.

The renderer reuses the installed Obsidian assets and vector exporter described
above, including `PLAYWRIGHT_MODULE`, `BROWSER_EXECUTABLE`, `OBSIDIAN_ASAR`, and
the extracted-asset overrides. Each SVG is self-contained vector artwork with
no embedded bitmap, script, `foreignObject`, or external resource. Ordinary
SVG text remains editable and uses local font fallbacks. The exporter maps
CSS geometry and text to SVG elements. The runner checks XML, canvas size,
unique IDs, finite geometry, and inactive local
content; visual review still checks framing and legibility.

`node scripts/render-store-mobile.mjs` generates the four 900 × 1600 portrait
SVG drafts in `assets/store-screenshots/mobile/svg/`. It supports the same optional scene
names and asset/browser overrides. It shares the synthetic scenes with desktop,
but mounts them with `is-mobile is-phone`, a 430 × 684 logical viewport, and
touch input so Obsidian and plugin phone layouts apply. Dialog widths, rounded
corners, form stacking, and the icon grid come from production CSS. Only the
host geometry is constrained, plus one paint: the settings pane is black, as
Obsidian 1.13's dark phone settings were. 1.14 greys it to the colour of the row
pills, which would vanish into it, and 01 would stop matching 02-05. Desktop and
4B outputs are not regenerated.

The portrait composition retains the purple background and English headlines,
but has no simulated workspace, file bars, device bezel, or invented navigation.
The headlines have 30 pixels of additional top inset. The note uses a fixed
English sample with real heading, inline, and block callouts and their syntax,
followed by longer explanations that continue past the screen's lower edge;
the renderer verifies that the note overflows vertically. The creation form
opens at the top to show its name and IDs before the color and icon controls;
the live preview can continue below the viewport, above the fixed action
footer. The icon grid is scrolled to a complete row below its
native sticky search toolbar, with Lightbulb selected. Settings keep all thirteen
built-ins in their scroller; on a phone a row shows the IDs that fit, whole,
with a `+N` for the rest, its name on one line, and its color in the icon tile
and the name (no circles, at any width). SVG validation also checks horizontal overflow and
local paint references. This is an offline production-component illustration,
not a capture of the full native mobile app.

The requested desktop images 01–04 plus 04B and mobile images 01–04 also
have lossless WebP exports in their respective `webp/` directories for web
and GitHub display. Exports retain the native 1200 × 800 or 900 × 1600 canvas
and are individually below 5 MB. Each decoded WebP was checked against the
source raster for pixel equality; WebP was smaller than PNG in eight of the
nine comparison exports and smaller across the set overall. The source raster is
a Chromium screenshot of the SVG at its own size and a device scale of 1 (not
`rsvg-convert`, whose text differs), encoded with `cwebp -lossless -z 9`.
`node scripts/export-store-webp.mjs` does exactly this for every image that
already has a WebP (names such as `desktop/01-settings` select a few; it needs
`cwebp`). Re-export after re-rendering an SVG. The renderers write
SVG artwork only; open the SVGs directly for review. Temporary raster previews
for visual QA belong outside the deliverable directory.

Desktop image 05 is an independent feature overview. Run
`node scripts/render-store-bento.mjs` to regenerate its self-contained
`desktop/svg/05-more.svg`. It reuses guide
SVGs and five dedicated Find callouts, ribbon, autocomplete, right-click menu,
and saved-palettes captures without
regenerating the other desktop or mobile images. See
[Store artwork: image 05](store-bento-artwork.md) for capture commands, source
components, layout, and visual review instructions.

`node scripts/render-store-bento-mobile.mjs` adapts that saved desktop SVG into
the separate 900 × 1600 `mobile/svg/05-more.svg`.
Six features fit in two 390-pixel columns with 50-pixel outer margins;
version history is omitted. The single-line headline **And so much more...**
leaves room for taller tiles with centered headings and larger, centered UI
fragments. The UI fragments keep
uniform proportions and their desktop appearance; this is portrait artwork,
not a new phone UI capture. The renderer leaves images 01–04 unchanged.
See the [portrait adaptation](store-bento-artwork.md#portrait-adaptation)
for the layout, source dependencies, and validation.

## Repo-convention tests - the automated rules that hold the codebase together

Several test files check the **repository itself**, not runtime behaviour -
these are the project's coding conventions turned into assertions rather
than left as unenforced prose in `AGENTS.md`. Notable ones, by what they
check (not exhaustive - see each file directly for the full list):

| File | Enforces |
| --- | --- |
| `repoSourceRules.test.ts` | No bare English UI-copy literal handed to a text setter or `Notice`; every `workspace`/`vault`/`metadataCache` listener is `registerEvent`'d or `offref`'d; nothing listens on `document`/`window` without an unregister; no interval outside `registerInterval`; no `any` without an explicit ESLint-disable; `main.ts` exists; the network surface is exactly what the README discloses; **handwritten source files stay at or below 500 nonblank, non-comment-only lines unless their exact path is explicitly exempted** |
| `repoStyles.test.ts` | Every CSS custom property read with a fallback has a writer somewhere in `src/`; every class the code applies has a matching rule in `styles.css` and vice versa; no rule scoped to `.cs-modal` paints a raw `--background-primary` (see [Settings UI § surface tokens](16-settings-ui-and-modals.md)) |
| `repoGenerated.test.ts` | `locales/*.json` and `src/icons/data/*` regenerate **byte-for-byte** identical to what's committed |
| `i18nDynamicKeys.test.ts` | Every key built at runtime (`` t(`colorName.${key}`) `` and the rest) has an English entry, no key under those prefixes is unreachable, and every key-building template is listed - see [Localization § Keys built at runtime](17-i18n.md#keys-built-at-runtime) |
| `repoRelease.test.ts` | `manifest.json`/`package.json`/`versions.json` agree on one version; the plugin id can never change; `manifest.json` has every required field and no unknown ones; built-in command ids match the released set; bundle-size limit is still declared where CI reads it |
| `repoTestGate.test.ts` | `scripts/tsconfig.json` includes `tests/`; the build actually runs that typecheck; no test file uses top-level `await`; test setup/teardown hooks run in the right order |
| `repoLicenseDocs.test.ts` | `LICENSE` is the plain 0BSD grant with no conditions attached; README/CONTRIBUTING both state the "don't republish as a new plugin" ask is *not* a license term |
| `repoSourceRules.test.ts` ("AGENTS.md describes the checks that exist") | `AGENTS.md` doesn't claim the repo is untested, lists `npm test`, and still describes what the suite structurally cannot see |

> [!TIP]
> `npm test`'s output is the single source of truth for whether a
> proposed change violates one of these conventions - don't try to
> re-derive "is this file over 500 counted lines" or "is this listener registered
> correctly" by inspection when the corresponding repo test will simply tell
> you.

### Personal website artwork

`assets/website/` holds nine SVGs for the Callout Studio page on the maintainer's personal website.
They are private-use artwork, not plugin content: no plugin file or public document links to them.
`node assets/website/generator/build.mjs` regenerates them from production plugin code on the same
offline documentation host as the user-guide renderer, with the same `PLAYWRIGHT_MODULE` and
`BROWSER_EXECUTABLE` variables. The folder's `README.md` lists each image, where it appears on the
site, and how to copy the result into the website repo. The generator is plain Node `.mjs`, like `scripts/`: it is in the ESLint ignore list
(`scripts/eslint.config.mts`) and `npm test` does not scan it.

### Source file size

The size check covers handwritten TypeScript under `src/`, including
`src/main.ts`. It excludes blank lines and lines containing only comments;
lines containing code with a trailing comment still count. The existing data
and generated-tree exclusions remain: `src/i18n/`, `src/icons/data/`, and
`src/data/` are outside this check's scope.

**500 counted lines is the single limit.** A non-exempt file at 500 passes;
at 501 it fails `npm test`, including the GitHub Actions test step. Files at or
below the limit and exempt files produce no size warning. Keeping `main.ts`
limited to lifecycle and wiring remains architectural guidance; its size check
uses the same limit as other source files.

[`scripts/source-size-exceptions.json`](../../scripts/source-size-exceptions.json)
is a JSON array of exact repository-relative file paths, for example:

```json
[
  "src/manager/CalloutRegistry.ts",
  "src/settings/CalloutEditor.ts"
]
```

An entry exempts that file from the size limit entirely. There are no per-file
numbers, growth caps, or required updates when a file gets shorter; an entry may
remain after the file drops below 500. Use the full path rather than only its
basename so another file with the same name is not accidentally exempted.
Choose responsibility boundaries when splitting code, rather than adding
helpers solely to lower a line count.

## Regenerating icon and locale data

Both are code-generation steps with **opposite** automation policies, and
mixing them up is a real trap:

- **`npm run i18n:generate` is automatic** (`prebuild`), fast (local, no
  network, sub-second), and CI-enforced on every push (`git diff --exit-code`
  against `locales/` and `localeManifest.ts`).
- **`npm run icons:generate` is deliberately manual and never runs as part of
  `npm run build`.** It reads from `node_modules` (Tabler, Font Awesome,
  Octicons, RPG Awesome and Simple Icons packages, plus generated
  Material/emoji data) and writes both the search-index files
  (`src/icons/data/*.index.ts`, committed and bundled into `main.js`) and
  the downloadable pack files
  (`packs/*.json`, committed - **this repo is the CDN origin** for those
  files, served via jsDelivr at the pinned `packs-v3` tag). For Simple Icons
  it also writes `docs/SIMPLE-ICONS-LICENSES.md`, the per-logo credit that
  pack's licences ask for. Regenerating
  artwork content (not just the search index) requires **minting a new
  pinned tag** and updating the checksums in
  `src/icons/data/packManifest.ts` - jsDelivr caches a tag's contents
  permanently, so re-pushing to the *same* tag would not actually refresh
  anything a user's cached copy sees. See
  [Adding or modifying features](22-extending.md#refreshing-icon-pack-artwork).

## CI

Two workflows, `.github/workflows/`:

### `lint.yml` - pushes to `master` and all pull requests, Node 20.x and 22.x

```text
npm ci → npm run build → verify locales/ has no diff → npm run lint → npm run format:check → npm test
```

The locale-sync check runs **right after the build** (which already ran
`i18n:generate` as `prebuild`) - its whole purpose is catching a translation
edited without the regenerated output committed alongside it, which would
otherwise fail every download's checksum for the next release, discovered
only in users' vaults instead of here.

`.github/dependabot.yml` also watches `eslint-plugin-obsidianmd` (weekly)
and opens a PR on each new release, which `lint.yml` then runs against.

### `release.yml` - triggered by pushing a bare-semver tag (`[0-9]+.[0-9]+.[0-9]+`, no `v`)

```text
1. Verify manifest.json / package.json / versions.json all agree with the pushed tag exactly
2. npm ci, npm run build, npm run lint, npm test (all required on the tagged commit)
3. Re-verify locales/ has no diff (same reasoning as lint.yml, but against the release build)
4. Check main.js is under the 2 MiB + 364 KiB bundle-size budget (2,469,888 bytes)
5. Attest build provenance for main.js and styles.css
6. Wait (poll, up to 15×2s) for the tag to be visible via the GitHub API
 - the tag-push webhook can fire before the tag itself propagates
7. Create a DRAFT GitHub release carrying main.js, styles.css, manifest.json
```

> [!CAUTION]
> **Step 1 is a hard gate**: Obsidian's own community-plugin update
> mechanism requires the release tag to equal `manifest.json`'s version
> **exactly** (no leading `v`), or the release ships a version Obsidian
> can't correctly resolve as an update.

> [!NOTE]
> **The bundle-size budget (2 MiB + 364 KiB) is deliberately tight against the current
> size**, not generously padded - "a careless import trips it here rather
> than in users' vaults; raise it consciously when a feature earns it." The
> ceiling's own history is documented right in the workflow file: it moved
> from 3 MiB (added for Tabler's search indexes) up to 4 MiB (custom
> commands, Callout Manager import, Palette Editor work), then back **down**
> to 2 MiB the moment the 31 non-English locales moved out of the bundle
> entirely and became downloads - which alone took `main.js` from 3.70 MiB
> to 1.70 MiB. The settings-safety work after 2.14.1 added verified backups,
> device history, recovery UI and paused-saving safeguards, taking the bundle
> just over 2 MiB; its allowance increased by 64 KiB. The calmer paused-saving
> flow (three-paragraph banner, guided buttons, Go to backups with keyboard
> focus, the saving-resumed notice) went 24 bytes past that, and the allowance
> grew by another 8 KiB. Simple Icons then added the search index for 3,410
> brand logos - 45 KB of the bundle - and the allowance grew by 44 KiB to match,
> leaving the headroom where it had been. Theme-surface relocation (7.4 KB) took
> another 8 KiB, and the Manage icon libraries window - reordering, hiding,
> downloading and deleting libraries, the drag list it shares with Customize menu
> items, and the dialog that names the callouts keeping their icons - 11.7 KB,
> for which the allowance grew by 12 KiB, the headroom again about where it was.
> The Version history allowance grew by 14 KiB for the timeline that merges
> identical copies, automatic names based on saved reasons, storage markers and
> their details, and localized window copy. The current interface uses place
> icons inside the timeline markers and relative day headings; version names
> are automatic. Colours from callout metadata (`[!mark|pink]`) - the colour
> rules keyed on the metadata word, the dropdown after `|` and the Tab and `|`
> keys in the type dropdown, the scan of a theme's own metadata words, and the
> offer to carry a renamed palette's notes along - came to 20.2 KB, and the
> allowance grew by 20 KiB, the headroom again about where it was. Retiring
> Amber, Lime and Crimson from the menu without repainting anybody's callouts,
> together with the fixes that made metadata colours safe on upgrade (Tab and
> `|` that never rewrite the `]`, colours that clear a callout's own gradient
> and title sweep, the nested metadata stylesheet, the snippet stand-down, the
> palette-word and rename guards), took the bundle 2.2 KB further, and the
> allowance grew by 4 KiB. Links to a title-less heading callout - the
> callout's name written as the link's alias on a pick, the icon in front of an
> aliased link in both views, and the old `]]]` widget drawn above Obsidian's
> link hiding - took it 2.3 KB further, and the allowance grew by 4 KiB again.
> The Find callouts round trip - a result opening its callout scrolled into
> view and flashing instead of selecting its raw Markdown, and the sidebar
> marking the card for the callout the caret is in - came to 7.6 KB, and the
> allowance grew by 8 KiB, the headroom again about where it was. Theme
> ownership per name - the claim check that measures whether the theme really
> draws the built-ins and the user's callouts it names, a callout the theme
> claims only in part, and the cheaper `css-change` - came to 13.3 KB, and the
> allowance grew by 13 KiB, the headroom again about where it was. Its
> follow-ups - verdicts kept on the device per theme, a callout judged only
> when every rule naming it was seen in force, the editor reading the published
> claim and the export keeping every name - came to 4.4 KB, and the allowance
> grew by 5 KiB. The rest of them and their review (the page-class watcher,
> idle and batched passes, stock aliases, names measured on arrival, finished
> transitions, mode and platform classes, real Style Settings option classes,
> the editor naming the aliases Obsidian draws) came to 3.8 KB, and it grew by
> 3 KiB more, the headroom again about where it was. Wrap in callout, Insert
> empty callout and Unwrap from callout learning the heading and inline formats
> - the form chosen from the cursor's place, the pill-shape check, the shared
> plain-text conversion for unwrapping - and Wrap or Insert on heading and
> inline custom commands came to 5.7 KB, and the allowance grew by 7 KiB.
> Later raises are listed beside the limit in `release.yml`, newest last. The
> native-look refactor added 8 KiB for its *Native Parts* (Obsidian's own
> controls in every window). It also raised the limit by 32 KiB at the switch
> to the declarative settings tab, while the old page still shipped beside the
> new tree (about 26 KB), and its *Clean Sweep* lowered it by the same 32 KiB
> once the old page was deleted: the bundle came out at 2,348,600 bytes, about
> 6.4 KiB under the limit. The brush mascot (the paintbrush icon's face, its
> twenty animations and the places that show it) came to 21.6 KB, and the
> allowance grew by 20 KiB: 2,370,199 bytes, about 5.4 KiB under the limit. The
> pointer playing with it (blink and look, the dent of a press, the ring of
> paint, `notice`, `ouch` and `angry`), Version history as a page with its
> restored timeline, and a long menu that scrolls with the wheel came to 6.6 KB,
> and the allowance grew by 8 KiB: 2,380,334 bytes, about 3.5 KiB under the limit.
> Writing `main.js` as UTF-8 (`charset: "utf8"`, see Build above) then took a
> build that was 4.8 KiB *over* the limit, at 2,409,217 bytes, down to
> 2,367,031 bytes - about 36.4 KiB under it - with the limit left alone.
> The website export then took most of that back and more: a renderer, two
> sets of hosts and a small DOM embedded as text (see
> [The web renderer](#the-web-renderer-four-bundles)), the setup window, the
> service detection and the automatic refresh. The allowance grew by 32 KiB:
> 2,423,328 bytes, about 13.5 KiB under the limit. Moving Digital Garden's
> hooks out of `main.js` into the garden plugin, with a note written in their
> place, then came to 3.6 KB: 2,427,029 bytes, about 9.9 KiB under it.
> Later work on the export took the build to 2,435,243 bytes, and the offer
> on the settings page (about 1.8 KB) to 53 bytes under the limit. The
> allowance grew by another 8 KiB on 2026-11-15, when the setup window became
> a page of the settings: 2,437,739 bytes, about 7.4 KiB under the limit.
> Further work on that page took it to 2,442,398 bytes, and each device
> keeping only its own version of the website files current
> ([Import and export § Two devices](15-import-export.md#two-devices)) came to
> 3.0 KB, 127 bytes past the limit. The allowance grew by 4 KiB the same day:
> 2,445,439 bytes, about 3.9 KiB under the limit.

> [!NOTE]
> **The release is created as a `draft`, on purpose.** The `$release` skill
> (`.agents/skills/release/SKILL.md`) is what writes the user-facing release
> notes and flips it public - a workflow failure partway through therefore
> leaves a harmless draft rather than a half-published, half-broken public
> release.

## Versioning

Bumping `manifest.json`/`package.json`/`versions.json` happens together, via
`npm version <bump>` (wired through `scripts/version-bump.mjs`, which reads the new
`npm_package_version` and syncs `manifest.json` and appends an entry to
`versions.json` keyed to the *current* `manifest.json`'s `minAppVersion`).

> [!IMPORTANT]
> **Never bump or tag by hand, and never do it inside a feature/fix PR.**
> Both `AGENTS.md` and `docs/CONTRIBUTING.md` say releases are cut separately -
> use the `$release` skill, which bumps all four version-bearing files
> together, tags, pushes, waits for the CI build, writes release notes, and
> publishes. Tags are bare semver (`1.5.0`), never `v1.5.0`.

### Raising `minAppVersion`

`minAppVersion` changes in its own commit, just before the release that needs
it, and only after the plugin was checked on a real install of that version.
`npm version` then writes the matching `versions.json` entry. Three checks
keep the two files honest in between:

- `tests/repoRelease.test.ts` lets `manifest.json` be *ahead* of the last
  released entry (a raise waiting for its release), never behind it.
- `release.yml` refuses a tag whose `versions.json` entry differs from
  `manifest.json`'s `minAppVersion`, since Obsidian reads the map to decide
  which app builds may take the update.
- `obsidianmd/no-unsupported-api` reads the manifest's value, so the lint
  flags any API newer than the minimum.

Code that needs a newer API before the raise has two choices: guard the call
(`typeof … === "function"`, with a fallback), or point the lint rule at the
target version in `scripts/eslint.config.mts` until the raise commit deletes
that override. The `obsidian` typings in `devDependencies` are pinned to an
exact version no newer than the minimum, so the compiler cannot offer an API
the minimum lacks.

The minimum went from 1.7.2 to **1.13.4** for the declarative settings tab
(`getSettingDefinitions`, `SettingGroup`, `setErrorMessage`,
`addDisplayValue`, `ConfirmationModal`); 1.13.4 was the first public 1.13
build. The typings stay at 1.13.1, the version they were written against. One
API the plugin uses is newer still and is guarded:
`app.setting.openPagePath` (1.14), which opens a settings sub-page for a
jump (26 § Jumping to a row).

## Code formatting

Prettier owns layout - indentation, line breaks, quotes, trailing commas - for
the TypeScript in `src/` and `tests/`; ESLint owns correctness. The options sit
in `package.json`'s `prettier` key (tabs at width 4, 120 columns, otherwise
Prettier's defaults), matching `.editorconfig`.

`.prettierignore` is the single definition of scope, read by every way of
running Prettier: `npm run format`, the pre-commit hook, and an editor's format
on save. It ignores everything at the root except `src/` and `tests/`, any JSON
inside them, and the generated files - the icon search indexes,
`localeManifest.ts` and `emojiData.ts` - whose generators own their layout. A
new generated file under `src/` belongs on that list.

Formatting is automatic at three points, each a backstop for the one before:

1. **On save, in VS Code.** The committed `.vscode/settings.json` makes the
   Prettier extension the `[typescript]` formatter with `editor.formatOnSave`,
   and `.vscode/extensions.json` recommends that extension (and ESLint's) when
   the folder is first opened. Auto-save counts as a save when it is
   `onFocusChange` or `onWindowChange`; VS Code skips formatting for
   `afterDelay` auto-saves, so with that setting a file is formatted on an
   explicit save or at commit. `prettier.requireConfig` keeps the extension
   from formatting with its own defaults where no config applies.
2. **On commit.** The pre-commit hook rewrites staged files
   ([Husky / pre-commit](#husky--pre-commit)), so another editor, or none,
   still commits formatted code.
3. **In CI.** `npm run format:check` fails `lint.yml` when a commit skipped the
   hook (`--no-verify`, a web edit).

Only `settings.json` and `extensions.json` are tracked under `.vscode/`; the
`.gitignore` keeps anything else there (launch configs, personal settings)
local.

The width is 120 rather than Prettier's default 80 because narrower widths push
several handwritten files over the [500-line limit](#source-file-size); check
that suite before lowering it.

A commit that only reformats goes into a commit of its own, and its full hash
into `.git-blame-ignore-revs`, so `git blame` attributes each line to the change
that last meant something. GitHub reads that file by itself; a local checkout
needs `git config blame.ignoreRevsFile .git-blame-ignore-revs` once.

`no-unexpected-multiline` stays on even though `eslint-config-prettier` would
turn it off: with semicolons it only fires when Prettier breaks a chain before
`[index]`, and the fix is to name the intermediate value rather than drop a
rule that catches real ASI bugs.

## Husky / pre-commit

A single pre-commit hook (`scripts/hooks/pre-commit: npx nano-staged`) runs
Prettier and then ESLint against staged `*.ts`/`*.mts` files only, re-staging
whatever Prettier rewrote - most style issues are fixed or caught before a push
ever reaches CI. Both commands share one nano-staged pattern on purpose:
separate patterns run in parallel, and ESLint must see Prettier's output.

`npm install`/`npm ci` runs `prepare` (`husky scripts/hooks`) to install the
hooks at their configured location. Run `npm run prepare` once after switching
an existing checkout to this layout. The staged lint command, like `npm run
lint`, selects `scripts/eslint.config.mts` explicitly. ESLint integrations in
editors must also select that file if they rely on automatic root-config
discovery; for the VS Code ESLint extension the committed
`.vscode/settings.json` sets `eslint.options.overrideConfigFile` to
`scripts/eslint.config.mts`. The Prettier extension finds its options and
`.prettierignore` without help.

## Repository layout

Public API documentation, contribution guidance, and third-party notices live
in `docs/`. README and the plugin's contribution/credits links point to those
paths. Development configuration and hooks live in `scripts/` alongside the
build tools. `web-plugins/` holds the hand-written files of the plugins
Callout Studio publishes for site generators, each released from a repository
of its own: `web-plugins/quartz/` for Quartz (see
[The Quartz plugin](#the-quartz-plugin)) and `web-plugins/digital-garden/` for
Digital Garden (see [The Digital Garden plugin](#the-digital-garden-plugin)).
Each folder is named after its repository (`Callout-Studio/quartz`,
`Callout-Studio/digital-garden`). `README.md`,
`LICENSE`, the package and plugin manifests,
`versions.json`, `.editorconfig`, `.prettierignore`, `.git-blame-ignore-revs`,
`.vscode/`, `.npmrc`, and `.gitignore` remain at the root for their conventional
consumers. `styles.css` remains the maintained root stylesheet and the release
artifact.

---
Next chapter: [21-public-api.md](21-public-api.md)
