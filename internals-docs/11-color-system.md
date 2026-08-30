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
instead. For an untouched built-in it follows Obsidian's own variable
(`OBSIDIAN_CALLOUT_VAR[def.id]`, e.g. `--callout-info`) rather than a baked
hex, by way of the `<color>`-typed `--cs-accent-theme` — which is what keeps a
theme that still writes ≤1.12 bare triplets from resolving `--cs-accent` to a
non-colour and taking every `color-mix()` reading it down at once. The moment
the user edits the callout — even just a colour tweak — the hex wins from then
on. See
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

**The derivation is not idempotent, and `CustomPalette.baseColor` is what
keeps that from mattering.** The backgrounds are tints of the *original* hex,
but the accents are then run through `ensureContrast` against those tints, so
`colorLight` is the function's **output**, not something you can feed back in:
`#ffff00` scores 1.06:1 on its own pale tint and comes back `#8c8c00`. The
palette editor used to seed its Base colour swatch from the saved
`colorLight`, having nowhere else to look — so reopening a palette and nudging
the Intensity slider one step re-derived all six colours from a colour the
user never picked, collapsing a yellow palette's dark accent to olive and
draining the hue out of both backgrounds. It read as the slider jumping.

`baseColor` stores the pick itself. Nothing paints it —
`bakePaletteColors` never looks at it, `palettesVisuallyEqual` ignores it (two
palettes that render identically are duplicates however they were reached) —
it exists purely so re-deriving starts where the user did.
`seedBaseColor` (`settings/paletteBaseColorRow.ts`) owns the fallback ladder:
a palette saved before the field existed, or a seed built by
`paletteSeedFromDefinition` from a baked callout, has nothing better than
`colorLight`, because the correction is not invertible.

The correction itself stays **silent**, and that is a deliberate call rather
than an oversight. Simple mode is the "pick one colour and let us handle it"
route, so it auto-fixes and says nothing; the advanced per-channel grid — one
link away, from the hint already on this row — stores what you pick verbatim
and shows a warning badge instead. The way to see and override the correction
therefore exists and is reachable; it just isn't volunteered.

A version that announced it in the row was built and then withdrawn. It is
worth knowing why, because the reasoning is about *how* and not *whether*: a
disclosure that rewrites the standing hint in place is worse than none, since
text mutating under the cursor while the user drags the Intensity slider gives
no clue which words moved or why, and reads as a rendering glitch. If this is
ever revisited, the shape to use is an added sentence that fades in beside the
hint, never a swapped one — and the swatch showing `#ffff00` while titles paint
`#8c8c00` is the fact any such sentence would have to state.

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

## Accent dialect: version drift **and** theme drift

Obsidian 1.13 changed `--callout-color` from a bare RGB triplet (`"255, 0, 0"`,
which core itself wraps in `rgb(...)`) to a full CSS colour string. For a long
time this plugin answered "which spelling do I write?" from
`requireApiVersion("1.13.0")` alone, and that was only ever half the question:

> **`--callout-color` is read by whoever wrote the rules that consume it, and
> once a theme is active that is usually the theme, not core.**

A theme written before 1.13 and never updated still writes
`rgba(var(--callout-color), 0.1)`. Handed a hex, that declaration is *invalid at
computed-value time* and the property silently unsets — the background vanishes,
and a `border-left` shorthand unsets all the way to `border-left-style: none`,
so a side accent disappears entirely. Handed a triplet, a theme written after
1.13 loses every `color-mix()` the same way. **No single value serves both.**

So the spelling is chosen per theme, from the theme's own text.
[`manager/theme/accentDialectScan.ts`](../src/manager/theme/accentDialectScan.ts)
reads one sheet;
[`accentDialect.ts`](../src/manager/theme/accentDialect.ts) folds the active
theme and every enabled snippet into **two** answers —
collapsing them into one is the mistake that module is shaped around:

| | Question | Scope | Decides |
| --- | --- | --- | --- |
| `read` | what do the `var(--callout-…)` **read sites** expect? | one answer per sheet, by majority | `calloutColorValue()` — what we write *into* `--callout-color` |
| `declared` | what does the theme's own `--callout-info` **hold**? | per variable **and per mode**, following `var()` hops | `calloutAccentVarRef()` — `var(X)` vs `rgb(var(X))` into `--cs-accent-theme` |

They demonstrably disagree. **Composer** declares `--callout-error: 158, 48, 57`
while reading `color-mix(in srgb, var(--callout-color) …)`; six more themes
(Reshi, Nebula, Novadust, Nightfox, RetroNotes, …) declare triplets they never
read at all, which a read-only detector cannot see — and since `--cs-accent-theme`
is registered `<color>`, an unseen triplet falls back to its grey initial value
and quietly greys every heading bar, inline pill and icon tint on an unmodified
built-in.

### `declared` is per mode, and three ways a value can hide

Grey is the entire failure mode here, and it is silent, so the `declared` half
is shaped by the three ways a theme can put an accent value somewhere a naive
scan reads wrongly. Each is a measurement over the 257 themes in the dev vault,
and each has a test in `tests/accentDialect.test.ts` naming the theme.

| Hiding place | Themes | Answer |
| --- | --- | --- |
| declared in **one mode only** | 10 — Nier declares all thirteen under `.theme-dark`, as triplets, leaving light mode on core's colours | two fields, `{ light, dark }`. `undefined` in the other mode means "core supplies it there", not "unknown" |
| the `var()` chain **leaves the sheet** | 4 — Arcane ends on core's `--color-blue` (a colour), Aura/Nier/Vicious on `--color-*-rgb` (triplets) | fall back to the sheet's **own `read`** spelling. A stylesheet is consistent with itself; Arcane is why this is not a `-rgb` name check |
| declared only behind a **theme option** | 2 — Aura's `.aura-origin-layout` (one layout of three, not the default), TerraFlow's `.academia-theme` (one palette of eleven) | ignore it. In the state almost everyone is in the class is absent and the variable still holds core's value. A `:not()` guard is the opposite case and *is* trusted — Velocity's `body:not(.disable-callout-styling)` is its normal styling |

The mode split follows the cascade: the light view is the unscoped declarations
with `.theme-light`'s on top, the dark view the same with `.theme-dark`'s, and a
`var()` hop resolves inside its own view. When the two views disagree,
`accentDeclarations.needsDarkBlock()` returns true even though the colours are
identical — that is the one caller that has to know the spelling can split
without the colour splitting.

`coreAccentDialect()` — still the cached `requireApiVersion` check — is what the
running Obsidian expects, and is the fallback wherever the active styling has no
opinion. That is 196 of the 257 themes in the dev vault, and it is what keeps
this machinery invisible in those vaults: their generated CSS is byte-identical
to what it was before any of it existed.

Measured across all 257: **36** themes read a triplet, **25** read a colour,
**0** tie. See [21-theme-callout-discovery.md](21-theme-callout-discovery.md)
for the scan itself, the per-theme matrix and the known limitations.

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
