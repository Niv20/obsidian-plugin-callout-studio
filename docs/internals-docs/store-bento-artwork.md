# Store artwork: image 05

Image 05 is a bento overview of actual production UI components. It complements
images 01–04 and does not change plugin behavior. The linked user-guide chapters
remain the source of truth for the features it depicts.

## Reproduce and review

Run `node scripts/render-store-bento.mjs` from the repository root. It writes
only `assets/store-screenshots/desktop/svg/05-more.svg`. Open the SVG directly
for review.

The composition is independent of `render-store-screenshots.mjs` and
`store-screenshots/`. It never regenerates images 01–04 or changes their
scenes or shared composition, so work on those images can continue
concurrently. The existing four-image renderer does not regenerate image 05.

The bento embeds production-generated SVG components from
`assets/user-guide/`, plus dedicated captures in
`assets/store-screenshots/desktop/components/`. Shared guide assets are reused
directly; only image-specific captures need a file in `components/`. The final
SVG embeds all fragments and is self-contained. It preserves their original
text, paths, controls, and styles, using bounded crops, scaling, and occasional
rearrangement of separate fragments to omit descriptions and unused whitespace.
The outer tiles, headlines, central message, crystal facets, rounded crop
framing, shortcut command box, and three keycaps are editorial artwork. The
command box reads **Wrap this text in Idea block callout (collapsed)** in two
lines with the same font, size, weight, and color. Its keys illustrate
a user-assigned Command–Shift–C shortcut, not a default binding. All fixture
content is synthetic, never real vault data. Feature tiles contain headings and
component content without additional marketing captions.

Five components have isolated captures. To refresh them before rendering the
composition, run:

```sh
node scripts/render-store-bento-autocomplete.mjs
node scripts/render-store-bento-find.mjs
node scripts/render-store-bento-ribbon.mjs
node scripts/render-store-bento-context-menu.mjs
node scripts/render-store-bento-saved-palettes.mjs
```

They write `05-autocomplete.svg`, `05-find.svg`, `05-ribbon.svg`,
`05-context-menu.svg`, and `05-saved-palettes.svg` in
`assets/store-screenshots/desktop/components/`. These captures require the same
installed Obsidian assets and existing Playwright runtime as
[the user-guide renderer](20-build-test-release.md#user-guide-svg-renders).
`PLAYWRIGHT_MODULE`, `BROWSER_EXECUTABLE`, and the Obsidian asset overrides apply.
No new dependency is installed and no network requests are permitted.

`scripts/store-bento/autocomplete-scene.mjs` uses real CodeMirror and
`CalloutAutoComplete` with the documentation fixture host. It types `> [!i`,
asks production code for its matches, and renders their actual names, IDs,
icons, and match highlights. The seven visible rows are Failure, Idea,
Info, Meeting, Question, Quote, and Tip, in production order. Idea is selected.
The native suggestion viewport crops subsequent rows. The renderer verifies that choosing
Idea completes `> [!idea]+ Idea` and moves the cursor to the next content line.
The captured component is 233 × 406 and appears at its native scale in the tile.

`scripts/store-bento/find-scene.mjs` renders the production Find callouts
selectors and occurrence cards with synthetic notes. **All types** and
**All formats** share the first row. The summary uses uniform, normal-weight text
for **4 occurrences in 3 files**, with grouped source results below. Its divider
sits closer to the summary, leaving more clearance above the first file name.
The results
include heading, block, and inline examples. A compact summary leaves more
space between file groups in the tall, narrow store tile.

`scripts/store-bento/ribbon-scene.mjs` calls `registerUiIcons` and
`registerQuickInsertRibbon` in a small offline host. A scoped bridge preserves
the production `addIcon` registrations without altering the shared guide host.
The real brush-and-plus icon sits between two core Obsidian icons above and two
below. Installed Obsidian CSS paints the ribbon, highlighted button, and tooltip;
the tooltip text comes from the production registration: **Quick insert block
callout**. Abstract rounded bars form a subdued explorer backdrop, matching the
file-list treatment in image 01. The bars start at x = 63 in the capture,
shifted 10 pixels right to leave more clearance from the ribbon divider, with
no folder arrows or file names.
The tooltip's left-pointing arrow is an explicit 6 × 12 SVG triangle in the
native message color, slightly larger than Obsidian's CSS border triangle.
The tooltip starts at x = 50, four pixels farther left, so its arrow spans
x = 44–50 and overlaps the ribbon divider. This scoped vector equivalent
avoids the exporter's rectangular border-strip rendering.
The ribbon has rounded left corners and square right corners against its
divider. Shell positioning and explorer framing are editorial. The capture
verifies the five-button order, middle selection, tooltip, and click handler.

`scripts/store-bento/context-menu-scene.mjs` captures the production block
context-menu actions over the same purple, lightbulb **Idea** callout used in
the other store images. The composition raises the callout and menu together,
preserving clearance below the tile heading and 24 pixels below the menu.
The shared user-guide context-menu asset remains unchanged.
The menu fragment is clipped to its exact native shell at (405, 150), sized
215.53 × 139.5 with an 8-pixel corner radius. This excludes the original scene's
purple callout and dark background from the menu's edges and rounded corners.
It is placed at (30.5, 79) in the tile, preserving the menu's existing position.

`scripts/store-bento/saved-palettes-scene.mjs` renders the production
**Saved color palettes** rows with three synthetic examples, sorted in the
native alphabetical order: **Coral** has a warm solid background, **Mint glass**
has a mint accent and transparent background, and **Twilight** has a violet-blue
gradient. Twilight uses a brighter violet accent and 55% background intensity
at both stops so all three swatches remain distinct at storefront size.
Native 18-pixel overlapping circles show the accent and background;
the gradient adds a third circle for its second stop. The transparent
background uses a dark checkerboard, represented by an equivalent local SVG
pattern because the vector exporter does not support the production CSS conic
gradient. Palette names and the pencil and trash controls come from the real
settings section. The compact three-row arrangement is scoped to this store
fixture; it does not change plugin behavior or user-guide illustrations. The
233 × 166 capture is embedded at (22, 58), below the tile's editorial heading,
without the settings section's duplicate heading or unused whitespace.

The composition preserves the SVG IDs by prefixing every embedded fragment.
It checks finite geometry, canvas containment, unique IDs, local paint
references, and vector-only content. The capture checks XML, geometry, matching
results, completion behavior, browser errors, and absence of network requests.
The full composition still needs visual review for fit and readability.

For temporary visual QA, outside the deliverable folder:

```sh
rsvg-convert -o /private/tmp/callout-bento-05-native-review-v2.png assets/store-screenshots/desktop/svg/05-more.svg
```

The editable SVG remains the deliverable for this stage. The temporary PNG is
only a preview; final store raster exports are separate work.

## Portrait adaptation

Run `node scripts/render-store-bento-mobile.mjs` after refreshing the desktop
composition to generate only `assets/store-screenshots/mobile/svg/05-more.svg`.
It does not regenerate any other artwork. The 900 × 1600 canvas uses the same ambient purple background
and first headline baseline as portrait images 01–04. **And so much more...**
fits on a single line, with 60-pixel text at baseline 121.

Six features appear; version history is omitted from the portrait composition.
Two 390-pixel columns have a 20-pixel gutter and equal 50-pixel left, right, and
bottom margins. The board runs from y = 170 to 1550. Find callouts occupies the upper-left 680-pixel tall
tile, with two 330-pixel tiles for saved palettes and Quick insert at the right;
shortcuts and the context menu sit below Find, beside the tall autocomplete tile.
Removing version history and the second headline line makes every remaining
tile taller. The wider tiles leave more room around the centered components.
The central desktop message tile is replaced by the headline.

Feature headings are centered at 30 pixels with a baseline 50 pixels below each
tile's top edge, leaving additional space above the letters. The content area
begins at y = 72 inside each tile. Every component uses a uniform
1.3 scale on both axes, preserving controls, text, and icon proportions. All
component crops use the same horizontal centering, including the right-click
menu; the partial Idea block remains behind it. Each crop follows the component's
actual vertical extent and is centered between the heading area and the tile's
24-pixel bottom inset.

The renderer embeds the desktop SVG once and reuses its content with local
`use` references and bounded viewports. Original outer backgrounds, tile shells,
and headings are replaced by the portrait framing. All complete UI rows of the
six displayed features are retained. Source geometry assertions flag desktop layout
changes that require the crop map to be reviewed; other assertions check tile
overlap, canvas and crop containment, unique IDs, finite geometry, and inactive,
local, vector-only content.

This image is a portrait arrangement of the desktop feature illustrations, not
a fresh phone UI capture: the ribbon, Command shortcut, and right-click menu
retain their desktop appearance. Fine UI text is smaller than in the individual
phone screenshots so all six tiles fit. No plugin behavior or user-guide
workflow changes; the feature links below remain authoritative. A temporary
preview can be rendered with `rsvg-convert -w 540 -o /private/tmp/callout-store-mobile-05-review.png assets/store-screenshots/mobile/svg/05-more.svg`.

## Composition and feature sources

The canvas is 1200 × 800. There is no separate headline; the board fills the
canvas with 28-pixel outer padding and 12-pixel gutters. The three rows are
244, 232, and 244 pixels high. Every feature tile uses the same flat background,
`#1C1C1C`: the installed default-dark Obsidian settings pane's
`--background-primary` / `--color-base-00`. Native controls retain their own
authentic surface colors. The surrounding ambient background stays dark purple.

The double-width center uses a purple-to-blue gradient with two Obsidian-inspired
faceted crystals from `scripts/store-bento/hero-crystal.mjs`. Compact silhouettes
are partly cropped at the side and bottom edges, exposing enough of each contour
to remain recognizable. Five small, irregular shards with two colored faces
sit in the empty space around the text, with varied sizes and angles. Low
opacity keeps the central text dominant. It reads
**Callout Studio has** above **so much more to offer...** Find callouts spans the top and
middle rows at the left; autocomplete spans the middle and bottom rows at the
right. Version history spans the first two columns along the bottom, with
the right-click menu to its right. Saved color palettes occupies the upper
middle-left tile, with its three complete native rows beneath the heading.
Custom shortcuts occupies the upper-right tile.

| Position | Feature | Genuine component source and scope |
| --- | --- | --- |
| Left, tall | [Find callouts](../user-guide/12-find-callouts.md) | Type and format selectors, uniform summary text, file grouping, and heading, block, and inline source references from `05-find.svg`. |
| Upper middle-left | [Saved color palettes](../user-guide/03-custom-color-palettes.md) | Three native palette rows from `05-saved-palettes.svg`: Coral (solid), Mint glass (transparent checkerboard), and Twilight (three-circle gradient), with pencil and trash controls. |
| Upper middle-right | [Quick insert](../user-guide/15-quick-insert.md) | Native-styled ribbon, real selected plugin icon, production tooltip, and nearby abstract file bars without arrows from `05-ribbon.svg`. |
| Upper right | [Custom shortcuts](../user-guide/09-commands-and-hotkeys.md) | Editorial collapsed Idea command box and Command, Shift, and C keycaps representing a possible user-assigned shortcut. No default hotkey is implied. |
| Right, tall | [Autocomplete](../user-guide/01-the-three-callout-types.md#picking-from-the-autocomplete-menu) | Real CodeMirror input and production suggestions in the dedicated capture. |
| Lower left, double-width | [Version history](../user-guide/13-syncing-and-backups.md) | Crops from `version-history.svg` retain complete rows, eye/delete/Restore actions, left-hand times, day heading, and timeline. The date has extra clearance above the first row, and the timeline continues to the tile's bottom edge. This restores plugin settings, not note history. |
| Lower middle-right | [Right-click menu](../user-guide/08-the-right-click-menu.md) | The actual five block-callout actions and icons from `05-context-menu.svg`, centered over a partial Idea block that continues beyond the tile's right edge. The block sits at y = 53 so the raised menu overlaps the lower portion of its Idea title, with extra space below the menu. |
