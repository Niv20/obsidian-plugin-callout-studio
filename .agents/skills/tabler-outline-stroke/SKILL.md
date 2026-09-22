---
name: tabler-outline-stroke
description: >-
    Explains how Tabler's outline icon set is drawn (stroke + fill="none")
    and how the plugin paints and colors it without ever storing the stroke
    in the downloaded pack file. Use when touching src/icons/packs/tabler.ts,
    PackStroke, buildPackSvg, isStroked/paintSvgIcon, stencilSvg, or the
    PackGlyph f/n flags — or debugging why a Tabler outline icon renders
    filled, colorless, or with the wrong pips/eyes.
---

# Tabler outline stroke artwork

Every other downloadable pack is solid artwork the renderer fills. Tabler's outline set is drawn with a stroke and `fill="none"`, which the drawing has to state for itself — so **the stroke lives in `src/icons/packs/tabler.ts` as a `PackStroke` constant, never in the downloaded file**, which stays path data and 1s and therefore still skips SVG sanitization. `buildPackSvg` takes it as an optional argument and puts it on the root; `PackGlyph`'s `f`/`n` flags let the 77 solid details inside an outline (dice pips, `brand-reddit`'s eyes) opt out, and are flags rather than values for the same reason. **`PACK_FORMAT` was deliberately not bumped** — the additions are optional and appear only in a pack no older build can name.

Two consumers see that paint and neither needed changing: a CSS `mask-image` reads alpha only, and `currentColor` inside a data URI resolves to black there (the behaviour `renderIcon.ts`'s `SVG_INITIAL_COLOR` already documents). In the DOM, `paintSvgIcon` recognises a stroked drawing by the `stroke` on its root (`isStroked`) and leaves it alone on screen — `currentColor` already tracks the surrounding colour, as `builtin` Lucide does — while a baked export colour goes through the existing `stencilSvg`, which rewrites declared paint without ever colouring a `none`.
