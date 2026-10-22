# Personal website artwork (private use)

These nine SVGs are artwork for the **Callout Studio page on Niv's personal website**
(`~/Documents/GitHub/my-website`, the project page at `/projects/programming/callout-studio`).
They are **not part of the plugin**: nothing in `src/`, the README, the user guide or the
store listing refers to them, and they are not shipped in a release.

The images are real plugin UI, rendered offline from this repository's own source and Obsidian's
installed CSS, then framed for the page. Nothing in them is a screenshot, a bitmap or a note from a
real vault; all content is synthetic.

| File | Where it appears on the page | Size (viewBox) |
| --- | --- | --- |
| `three-forms.svg` | "One callout, three ways to use it" section | 660 × 519 |
| `callout-editor.svg` | "Design it once, without touching CSS" section | 700 × 866 |
| `carousel_autocomplete.svg` | Carousel: typing `> [!` with the suggestion list open | 620 × 480 |
| `carousel_quick-insert.svg` | Carousel: the Quick insert window over a note with the ribbon button | 620 × 480 |
| `carousel_wrap.svg` | Carousel: a selected table and the Wrap in callout command | 620 × 480 |
| `carousel_context-menu.svg` | Carousel: the block-callout and heading-callout right-click menus | 620 × 480 |
| `carousel_find-callouts.svg` | Carousel: the Find callouts sidebar beside a note | 620 × 480 |
| `carousel_outline.svg` | Carousel: heading callouts in the Outline and in `[[#` link suggestions | 620 × 480 |
| `carousel_version-history.svg` | Carousel: the Version history window | 620 × 480 |

The carousel images are 620:480 to match the site's carousel card. Palette and framing copy the
site's hero artwork (`#14101e` → `#1c142b` ground, `#39265f` glow, `#6b47c2` bloom, violet rim).
The two section images have no backdrop: the window sits on a transparent canvas with only a
neutral drop shadow and a faint light edge, so it reads on both the light and the black page.
The icons are Lucide (ISC); the notice is kept inside each SVG.

## Regenerate

From the repository root, with Obsidian installed (its `app.css` and Lucide table are read from the
installed archive) and an existing Playwright install:

```sh
PLAYWRIGHT_MODULE=/path/to/node_modules/playwright-core \
BROWSER_EXECUTABLE=/path/to/chrome-headless-shell \
node assets/website/generator/build.mjs
```

`PLAYWRIGHT_MODULE` and `BROWSER_EXECUTABLE` work exactly as for the
[user-guide renderer](../../docs/internals-docs/20-build-test-release.md#user-guide-svg-renders).
No network request is made. The build overwrites the nine SVGs in this folder; copy them into the
website repo afterwards:

```sh
cp assets/website/*.svg ~/Documents/GitHub/my-website/src/assets/projects/callout-studio/
```

The generator, in `generator/`:

- `scenes.mjs` mounts each scene from production plugin code on the shared documentation host
  (`scripts/user-guide/`). It reuses the store's Create callout form and the guide's Version history.
- `render.mjs` exports every scene to vector parts in `$WEBSITE_PARTS`
  (default: a temp folder), using `scripts/user-guide/vector-exporter.mjs`.
- `compose.mjs` places the parts in the framed window on the hero background and writes the nine SVGs.
  `OUT` overrides the destination folder.
- `build.mjs` runs `render.mjs`, then `compose.mjs`.
- `preview.mjs` rasterizes SVGs to PNG, loaded as `<img>` the way the website shows them, for review.

Rendering is deterministic: the Version history scene pins its clock, so "(today)" always reads
the same, and a rebuild is byte-identical.

## Website notes

- The website's image checker and optimizer only cover `.webp`, so SVGs have no `@<width>w`
  variants; they are served as they are.
- Section images render at most 448 px wide, so keep their text large enough to read at that size.
- The two section images carry their own shadow, so their `img` entries leave out the site's
  `border` and `shadow` flags; those would frame the transparent canvas, not the window.
- Safari masks each element of a masked group on its own, so the carousel's bottom fade flattens
  the window into one layer first (`compose.mjs`, `panel()`). Without it, the note lines under the
  Quick insert window showed through it. Check a faded image in WebKit, not only in Chrome.
- On the website, the page's data file references these by bare filename (`"three-forms.svg"`).
