# Colour system

Covers [`src/utils/colorUtils.ts`](../src/utils/colorUtils.ts) (the maths),
[`src/utils/colorPalettes.ts`](../src/utils/colorPalettes.ts) (presets, custom
palettes, baking), [`src/utils/globalStyleMerge.ts`](../src/utils/globalStyleMerge.ts),
and [`src/utils/iconAdjust.ts`](../src/utils/iconAdjust.ts).

## The nesting invariant, in full

This is the single most consequential piece of colour math in the codebase.
It's derived in depth in the `callout-color-nesting` skill; this section
summarizes it for the docs.

**Obsidian gives nested callouts their stacked look purely by compositing.**
Core paints every `.callout` background as
`color-mix(in oklch, var(--callout-color) 10%, transparent)` under
`mix-blend-mode: darken` (light theme) / `lighten` (dark theme). Each nesting
level therefore lays another translucent 10% layer over whatever is beneath
it, and the compounded opacity across `n` levels climbs as `1 - 0.9ⁿ` —
unbounded in depth, always visibly distinct.

**An opaque background breaks this completely.** If a callout's own background
were painted as its authored hex directly, it would hide everything behind
it — and under `mix-blend-mode: darken`, a colour composited over *itself* is
`min(x, x) = x`: a step of exactly zero. Two callouts of the same colour
nested inside each other would be visually indistinguishable.

**CSS cannot count nesting depth**, so there is no way to write a rule that
"only apply this fill at the outermost level." (A self-incrementing custom
property is a dependency cycle; `:has()` is a predicate, not a counter;
`counter()` only reaches the `content` property.) The plugin actually shipped
an explicit per-level rule once — approximating a few levels — and it was
deleted, because it could never be more than an approximation.

**The only real fix: re-express every background as a translucent tint that
composites to the authored colour.** `translucentTintFor()` solves, per RGB
channel:

```text
alpha * colour + (1 - alpha) * backdrop === authored_hex
```

against the theme's actual `--background-primary`
(`BG_PRIMARY_LIGHT = "#ffffff"`, `BG_PRIMARY_DARK = "#1c1c1c"` — taken from
Obsidian's shipped `app.css`, not guessed; an earlier `#1e1e1e` guess put
every derived dark tint a uniform +1.64/255 off). The identity holds exactly
in both themes despite the blend-mode difference: over white, `darken` gives
`min(255, S) = S`; over `#1c1c1c`, `lighten` gives `max(B, S) = S` for any
tint at least as light as the page — which a callout background always is,
since `lighten` forbids painting darker than the page.

`minTintAlpha` is the **smallest** alpha that keeps every solved channel
inside `[0, 255]` (plus 2% headroom for hex-rounding), clamped to
`[MIN_TINT_ALPHA = 0.1, MAX_TINT_ALPHA = 0.6]`. A colour closer to the page
background needs a smaller alpha (a fainter wash still reproduces it); a
colour far from the page needs more. **Past `MAX_TINT_ALPHA`, `translucentTintFor`
returns `null`** — the caller then falls back to painting that one callout
opaque, accepting no nesting step for it rather than distorting the colour.

A gradient's two stops **share one alpha** (`resolveTintAlpha` takes the max
of both stops' minima) — ramping alpha across a gradient sweep would visibly
tilt it.

### Which alpha, and why it isn't simply the smallest

[`src/utils/bgTintAlpha.ts`](../src/utils/bgTintAlpha.ts) picks the alpha a
callout's background is actually painted at. It is a separate file, and a
separate decision, because the minimum above is a *floor*, not an answer:

**Every alpha at or above `minTintAlpha` renders the callout identically.**
The source colour `S` is re-solved along with the alpha, so `alpha·S +
(1 − alpha)·backdrop` stays pinned to the authored hex whichever one is
picked. What moves is everything stacked *inside* it — nesting depth `n`
renders

```text
S + (1 - alpha)ⁿ · (backdrop - S)
```

which converges on `S`, and `‖S − backdrop‖` is `‖bg − backdrop‖ / alpha`.
So the alpha is one knob between two things wanted at once: a **low** alpha
gives the boldest step per level, exactly `(1 − alpha)·(bg − backdrop)`, at
the cost of a wildly saturated `S` that a deep stack drifts toward; a **high**
alpha keeps a deep stack near the colour that was actually authored, at a
smaller step per level. Taking the smallest viable alpha unconditionally — all
this plugin used to do — is what made a red callout's nested levels pile up
into a red nobody picked.

`accentAnchorAlpha(accent, bg, isDark)` raises the floor: it returns the
blend strength `bg` would have been derived at *if it were a tint of the
accent*, so solving at that alpha lands `S` exactly as far from the page as
the accent itself, and the stack can converge no further than the colour the
user chose. Intensity is measured as **one straight-line distance** in sRGB,
never per channel — a tint is a straight line toward the backdrop, so the
distance scales by exactly the blend amount, while a channel where the accent
sits a few levels from the page has a near-zero denominator and turns one hex
level of rounding into a demand for alpha 1.5. (`#4287f5` sits 10 levels below
white on blue; a background nudged 3 levels there asked 0.51 in place of 0.14.)

> [!IMPORTANT]
> **The cap is a preference, not a constraint, and `resolveBgAlpha` applies it
> *over* the un-capped answer rather than alongside the minima.** Handed to
> `resolveTintAlpha` as if it were a minimum, a cap past `MAX_TINT_ALPHA`
> returns `null` — and `null` is the opaque fallback, so a cap that exists to
> protect nesting would be destroying it. A background genuinely bolder than
> its own accent (a grey accent over a darker grey fill) asks for 0.75 and
> simply cannot have it; the cap is dropped and the colour's own minimum
> stands. Caps are applied one at a time for the same reason: an unsatisfiable
> cap on one gradient stop must not take the other's down with it.

A gradient's far stop is anchored against its own `textToColor*` — the second
colour the title sweep runs to — and never against the primary accent as a
stand-in. That stop is deliberately a *different* hue (the palette editor's
suggested default rotates it), so the primary accent says nothing about how
intense it is allowed to be; with no `textToColor*` it carries no cap at all.

Nothing here bounds nesting **depth**, and that is deliberate. The alpha can
only act through a `background-color` this plugin emits, and it emits none for
an untouched built-in — deferring to the theme is the point — so core's
`1 - 0.9ⁿ` ladder still runs there. Bounding it would need a `.callout
.callout` rule restating core's tint with `--background-primary` pre-mixed in,
which is dilution by construction: the stack stops piling up and every level
comes out desaturated instead of staying itself. Fixing the colour the ladder
converges *on* leaves core's compositing untouched.

> [!CAUTION]
> **There is no opt-out.** The `solidBackground` flag that used to offer one
> was retired specifically because an opaque fill breaks nesting for *every
> callout stacked inside it*, not just the one that requested it.
> `CalloutRegistry.dropSolidBackgroundFlags()` deletes the field from old
> `data.json` data on load; `importValidator`'s `RETIRED_FIELDS` silently
> drops it from old export files.

## Built-ins: no `--callout-color` at all, until edited

`CSSInjector.accentProps` + `CalloutRegistry.isUnmodifiedBuiltIn` conspire to
leave `--callout-color` **entirely unset** for a built-in the user hasn't
touched, so core's own rule (and any theme overriding it) keeps deciding the
accent. `--cs-accent` — the plugin's own variable, always a real colour on
every Obsidian version — is what the plugin's own `color-mix()` calls read
instead. For an untouched built-in it points at Obsidian's own variable
(`OBSIDIAN_CALLOUT_VAR[def.id]`, e.g. `--callout-info`) rather than a baked
hex. The moment the user edits the callout — even just a colour tweak — the
hex wins from then on. See
[CSS generation § the three accent variables](06-css-generation.md#the-three-accent-variables-accentprops).

The fallback CSS block deliberately passes `imposed: true`, which **does**
emit `--callout-color` — because its job is to paint callouts *other than*
the one it copied its style from, and omitting the variable there would
silently disable the "Default fallback callout" setting.

## Two migrations that clean up old colour data

Both are described in more depth in
[Callout registry § load-time migrations](05-callout-registry.md#load-time-migrations),
summarized here for the colour angle:

- **`dropDerivedBackgrounds`** retires a stored background that
  `derivedBgAmount()` can prove IS just the accent tinted at some strength —
  such a value carries no information the accent doesn't already carry.
  `derivedBgAmount` solves for the tint *strength* the stored hex was
  produced at (rather than comparing against one fixed default amount),
  because tints are produced at any intensity between `MIN_BG_COLOR_AMOUNT`
  (0.1) and `MAX_BG_COLOR_AMOUNT` (0.3) via the palette editor's slider — a
  fixed-amount comparison would only catch the ones that happened to land on
  the default. It also checks against the *legacy* dark-mode base
  (`LEGACY_BG_PRIMARY_DARK = "#1e1e1e"`) as a second candidate, because every
  dark tint on disk from before the `#1c1c1c` correction was computed against
  the wrong base.
- The write sites that used to produce these derived backgrounds are fixed at
  the source (`CalloutEditorSave` no longer writes one back unconditionally,
  and `restyleUncustomizedFallbackRows` mirrors the flag alongside the
  colours) — the migration only retires what was already written before the
  fix landed.

## Custom palettes: simple vs. advanced, and the baking contract

A `CustomPalette` (see [Data model](04-data-model.md#custompalette)) always
carries six concrete hexes, even when `transparentBg` is set — that's
deliberate, so switching a palette back from "None" to "Solid" in the editor
has real values to restore rather than having to re-derive them from
scratch.

### Deriving from one base colour ("Simple" mode)

`derivePaletteFromColor` / `derivePaletteFromColors`
(`colorUtils.ts`) derive light+dark accent, background, and text colours from
a single user-picked base — this is what powers the palette editor's "Simple"
mode: pick one colour, get a full six-value palette with auto-corrected
contrast.

### `bakePaletteColors` — the one place a palette becomes callout fields

```ts
bakePaletteColors(palette: ColorPalette): CalloutManagerBakedColors
```

Every field is set **explicitly, `undefined` included** — this is what makes
`CalloutRegistry.applyPaletteColors` correct: it spreads the result directly
over an existing definition (`{...def, ...colors}`), so an explicit
`undefined` on `bgGradient`/`transparentBg` genuinely *clears* whatever the
previous palette left behind. Omitting the key instead would leave a stale
gradient or transparency flag standing after switching to a palette that
doesn't have one.

A `transparentBg` palette bakes to **the flag alone** — `bgColorLight`/
`bgColorDark`/`bgGradient` are explicitly `undefined`, deliberately skipping
the tint-derivation fallback that would otherwise hand the callout an opaque
colour the palette never had.

### Editing and deleting a palette

- **Editing** cascades onto every linked callout via
  `CalloutRegistry.applyPaletteColors(paletteId, colors)` — every
  `def.paletteId === paletteId` row is repainted in one `batch()`.
- **Deleting** a palette leaves linked callouts with their last-baked colours,
  **unlinked** — `paletteId` goes dangling rather than being cleared, which
  is what lets `listOrphanPaletteGroups()` reconstitute the group later (the
  UI can offer to "revive" a deleted palette from one surviving member, and
  `relinkPalette` regroups the rest). See
  [Callout registry](05-callout-registry.md) for the mechanics.
- **Consolidation on load**: `consolidateDuplicatePalettes()` merges any two
  saved palettes with identical colours (by the same equality test the
  editor's dropdown and the paletteId-adoption migration use), relinking
  every affected callout to the survivor. This is surfaced to the user as a
  one-time notice (`registry.takePaletteMerges()`, consumed once in
  `main.ts`) — losing a duplicate palette's *name* is worth mentioning even
  though no callout's appearance changes.

### `bgIntensity` — palette-editor-only, not read at render time

`CustomPalette.bgIntensity` only steers **derivation inside the palette
editor** (the slider that controls how much accent is mixed into the derived
background). The resulting strength is baked into concrete
`bgColorLight`/`bgColorDark` (and gradient stops) the moment the palette is
applied — `CSSInjector` never reads `bgIntensity` itself.

## Preset palettes — hue-named, not role-named

`getObsidianPalettes()` names presets by **hue** ("Blue", "Cyan") rather than
by the built-in callout role they happen to match ("Info", "Abstract") — so
the same dropdown entry reads sensibly whether it's applied to `[!bug]` or
`[!failure]`. Six presets carry Obsidian's own per-theme hexes exactly; two
(`teal`, `crimson`) deliberately keep **different** Material-derived values,
because Obsidian itself collapses `tip` onto the same cyan as `abstract` and
`danger` onto the same red as `failure` — following that exactly would put
two visually-identical entries in the dropdown.

`legacyIds` on a preset records the **old callout-name-based id** it used to
be saved under (e.g. `"note"` for what is now the `"blue"` preset) — a
callout picked before the rename still resolves to the right preset by
checking `legacyIds` *before* falling through to hex-matching, rather than
appearing as an unmatched "Deleted color."

> [!NOTE]
> There is deliberately **no "Transparent" preset**. A preset is a *colour*,
> and every consumer of the preset list (the dropdown, its swatches,
> `resolveCalloutManagerColor`'s hex matching) reads it as one — transparency
> is the *absence* of a background, and the only route to it is a **named,
> user-saved custom palette** created from the palette editor's "None"
> background style, which is the one place the user can find and re-select it
> later.

## Obsidian version drift: `--callout-color` format

`calloutColorValue(hex)` and `calloutAccentVarRef(cssVar)` both branch on a
**cached** `requireApiVersion("1.13.0")` check (computed once, not per
callout, per inject): Obsidian 1.13 changed `--callout-color` from a bare RGB
triplet (`"255, 0, 0"`, which core itself wraps in `rgb(...)`) to a full CSS
colour string. The plugin emits whichever format the *running* Obsidian
expects, so one release works correctly on both sides of that line.
`parseCssColorToHex()` is the inverse — used by CSS-snippet import — and
handles hex, `rgb()`/`rgba()`, and the bare pre-1.13 triplet, returning `null`
(caller skips the entry) for anything else (named colours, `oklch()`, …).

## `globalStyleMerge.ts` and `iconAdjust.ts`

`mergeGlobalStyle()` rebuilds `GlobalStyleSettings` from saved/imported data
the same explicit-field-by-field way `settingsMerge.ts` does for the rest of
`PluginSettings` — deep enough (the nested `heading`/`inline` frame-style
objects) to warrant its own module. `clampGlobalStyle()` (in
`settingsGuards.ts`) then clamps every numeric field into sane bounds so a
hand-edited or imported `data.json` can't put a border 500px wide.

`resolveIconAdjust(def, role)` is the **required** entry point for reading a
per-role icon adjustment — never read `iconAdjust` or the legacy flat trio
(`iconOffsetX`/`iconOffsetY`/`iconSize`) directly. A role missing from
`iconAdjust`, or a single field missing inside one role's entry, falls back
to the flat trio, which is exactly what that trio meant before `iconAdjust`
existed — this two-layer fallback is what lets pre-existing data and older
exports keep rendering identically with no migration pass required.

---
Next chapter: [12-icons.md](12-icons.md)
