# Build, test, and release

## npm scripts

```bash
npm run dev       # i18n:generate, then esbuild watch mode (inline sourcemaps)
npm run build      # i18n:generate (prebuild), typecheck with scripts/tsconfig.json, then esbuild production (minified)
npm run lint       # eslint with scripts/eslint.config.mts (obsidianmd recommended config + project rules)
npm test           # scripts/run-tests.mjs
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
```

Obsidian and CodeMirror packages are externals - the app itself supplies
them at runtime, so bundling them would both bloat `main.js` and risk a
duplicate/mismatched CodeMirror instance. Production builds strip
sourcemaps entirely (dev builds inline them for fast iteration).

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

The renderer reads `app.css` and the Lucide geometry table from locally installed
Obsidian. On macOS it prefers the newest installed update archive in
`~/Library/Application Support/obsidian/`, falling back to
`/Applications/Obsidian.app/Contents/Resources/obsidian.asar`. Set `OBSIDIAN_ASAR`
for another location, or supply `OBSIDIAN_APP_CSS`, `OBSIDIAN_ICON_DATA`, and
`OBSIDIAN_VERSION` together to use extracted assets. The host uses that version
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
copies of them.

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
npm ci → npm run build → verify locales/ has no diff → npm run lint → npm test
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
4. Check main.js is under the 2 MiB + 300 KiB bundle-size budget (2,404,352 bytes)
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
> **The bundle-size budget (2 MiB + 300 KiB) is deliberately tight against the current
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

## Husky / pre-commit

A single pre-commit hook (`scripts/hooks/pre-commit: npx nano-staged`) runs ESLint
against staged `*.ts`/`*.mts` files only - most style issues are caught
before a push ever reaches CI.

`npm install`/`npm ci` runs `prepare` (`husky scripts/hooks`) to install the
hooks at their configured location. Run `npm run prepare` once after switching
an existing checkout to this layout. The staged lint command, like `npm run
lint`, selects `scripts/eslint.config.mts` explicitly. ESLint integrations in
editors must also select that file if they rely on automatic root-config
discovery; for the VS Code ESLint extension, set
`eslint.options.overrideConfigFile` to `scripts/eslint.config.mts`.

## Repository layout

Public API documentation, contribution guidance, and third-party notices live
in `docs/`. README and the plugin's contribution/credits links point to those
paths. Development configuration and hooks live in `scripts/` alongside the
build tools. `README.md`, `LICENSE`, the package and plugin manifests,
`versions.json`, `.editorconfig`, `.npmrc`, and `.gitignore` remain at the
root for their conventional consumers. `styles.css` remains the maintained
root stylesheet and the release artifact.

---
Next chapter: [21-public-api.md](21-public-api.md)
