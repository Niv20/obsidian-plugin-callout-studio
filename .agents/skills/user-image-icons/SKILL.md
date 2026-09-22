---
name: user-image-icons
description: >-
    Explains the "Your images" icon source (icon.type === "image") —
    storage as SVG markup, sanitizeUserSvg, followsCalloutColor,
    recolor/monochrome, and registry.setUserImages(). Use when touching
    icons/userImageImport.ts, ImagePanel, CalloutIcon.recolor,
    UserImageIcon, or debugging why an uploaded picture won't tint, won't
    render, or is missing after import.
---

# Your images (`icon.type === "image"`)

The one icon source the user writes to. `CalloutIcon.value` is a `UserImageIcon.id`, not artwork — the import validator caps `value` at 200 chars.

- **Everything is stored as SVG markup.** An uploaded SVG stays vector; a PNG/JPEG/WebP is canvas-scaled to ≤128px and wrapped in `<svg><image href="data:…"></svg>` (`icons/userImageImport.ts`). That single representation is why `IconResolver`, `renderIconInto`, the settings list and the PDF-export path needed no changes — `resolver.ts` already falls back to `pack.buildSvg()`.
- **`sanitizeUserSvg` (`icons/svg.ts`) is an allow-list**, separate from `sanitizeSVG` (Material's deny-list, for one trusted vendor). It re-runs on every read via `sanitizeUserImages`, because `data.json` syncs and can be hand-edited.
- **Whether a picture follows the callout's colour is the *callout's* choice, not the picture's** — `CalloutIcon.recolor`, so one logo can be tinted in `[!bug]` and left alone in `[!note]`. The picture only carries `monochrome`, detected on import, which seeds that flag in `makeIcon`. `followsCalloutColor(icon, image)` holds both halves (the callout's choice *and* the SVG-only capability) so the three call sites can't drift.
- **Three production paths branch on `followsCalloutColor`.** `manager/css/iconOverrides.ts` routes the callout's own screen icon through `imageOverrideCSS` (keep its colours as a `background-image`) or `iconMaskOverrideCSS` (tint it as a stencil). `manager/css/fallbackCSS.ts` mirrors that split for unknown callout ids painted from the fallback definition. In the DOM, `icons/renderIcon.ts` uses `stencilSvg` when the picture follows the callout colour and otherwise preserves the artwork's own paints; this covers headings, inline callouts, references, and the copy used for PDF export. `cacheVariant` keys on `icon.recolor` for the same reason — two callouts sharing a picture must not share a render key.
- **`registry.setUserImages()` is the single writer**, which re-syncs the pack's module-level snapshot (`buildSvg` is synchronous by contract, so it cannot read settings itself).
- **The picker uses `ImagePanel`, not `PackPanel`** — add and delete are affordances the `IconPack` contract deliberately has no room for. The "Follow callout color" toggle is *not* there; it lives in `CalloutEditor`'s Picture section, beside the icon's size and offsets, because it belongs to the callout.
