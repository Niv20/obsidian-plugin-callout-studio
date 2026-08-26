# Theme callout discovery

How Callout Studio finds out which callout types the **active Obsidian theme**
supplies, what those callouts look like, and what it then does with that
knowledge: a row under *Callouts from your theme*, an entry in *Quick insert
block callout*, and — deliberately — no CSS of its own.

This chapter has two audiences, and they want different halves of it:

- **Contributors** touching `src/manager/theme/`, the registry's ownership
  facts, or any surface that draws a callout it does not paint. Read straight
  through.
- **Theme authors** who only need to know how to write callout CSS that
  Callout Studio reads correctly. Skip to
  [For theme authors](#for-theme-authors); everything before it is the
  derivation behind that advice.

Everything here is *discovery* — finding and reading the theme. What the plugin
**emits** (or refuses to emit) once ownership is decided is
[06-css-generation.md](06-css-generation.md), which owns the emission gate, the
`!important` argument and the selector-weight arithmetic.

The whole subsystem answers one rule, and the rule is not a setting:

> **If the active theme names a callout's id, the theme owns that callout.**
> Callout Studio emits nothing aimed at `.callout` for it, lists it under
> *Callouts from your theme*, shows what the theme actually draws, and offers
> it in the Block format only.

## The pipeline, end to end

Six stages. Each is a separate module because each has its own failure mode,
and several of them have to happen in this order.

| # | Stage | Module | Output |
| --- | --- | --- | --- |
| 1 | Find the active theme and its CSS text | [`customCssApi.ts`](../src/manager/theme/customCssApi.ts) | theme name, stylesheet text, snippet texts, a cheap signature |
| 2 | Scan that text for callout claims | [`themeCalloutScan.ts`](../src/manager/theme/themeCalloutScan.ts), cached by [`ThemeCalloutStore.ts`](../src/manager/theme/ThemeCalloutStore.ts) | `Map<attrId, ThemeClaim>` + family patterns |
| 3 | Publish ownership | [`ThemeFacts.ts`](../src/manager/theme/ThemeFacts.ts), via `CalloutRegistry.setThemeOwnedIds` | `registry.themeOwns(def)` |
| 4 | Mint / retire rows for ids the theme invents | [`themeProvidedRows.ts`](../src/manager/theme/themeProvidedRows.ts) | `source: "theme"` rows |
| 5 | Measure what the theme actually draws | [`ThemeAppearanceProbe.ts`](../src/manager/theme/ThemeAppearanceProbe.ts) + [`readCalloutStyle.ts`](../src/manager/theme/readCalloutStyle.ts) + [`themeAppearance.ts`](../src/manager/theme/themeAppearance.ts) / [`themeIcon.ts`](../src/manager/theme/themeIcon.ts) | `ThemeAppearance` per id |
| 6 | Reproduce it wherever the plugin lists callouts | [`renderThemeIcon.ts`](../src/manager/theme/renderThemeIcon.ts), [`calloutListIcon.ts`](../src/manager/theme/calloutListIcon.ts) | icons and swatches on rows, menus, pickers |

Scheduling — when the whole thing runs and in which order — is
[`themeRowSync.ts`](../src/manager/theme/themeRowSync.ts), covered under
[When discovery re-runs](#when-discovery-re-runs).

Two of these stages are deliberately split into a **pure half and an
impure half**, the same way twice: `themeCalloutScan` (pure text) sits under
`ThemeCalloutStore` (caching), and `themeAppearance` + `themeIcon` (pure data)
sit under `ThemeAppearanceProbe` (DOM). The pure halves carry all of the
judgement and all of the unit tests; the repo's test DOM has neither a
`CSSStyleSheet` nor a cascade, so anything that needed one would be untestable.

## Stage 1 — Finding the active theme

[`customCssApi.ts`](../src/manager/theme/customCssApi.ts) is the **only** place
`app.customCss` is named. None of it is in `obsidian.d.ts`: it is real and
stable in practice (the shape read there is what ships in 1.13.7, and most of it
predates 1.0), but it is somebody else's private field, so every access is
optional and every reader degrades to *no theme information* rather than
throwing. A plugin that crashes because Obsidian renamed an internal is worse
than one that quietly stops offering a convenience.

| Reader | Returns |
| --- | --- |
| `activeThemeName(app)` | The theme's name, or `null` for Obsidian's default |
| `themeCss(app)` | The theme's stylesheet text (`styleEl.textContent`), or `""` |
| `enabledSnippetNames(app)` | Enabled snippet names, in load order |
| `enabledSnippetCss(app)` | Each enabled snippet's text |
| `stylingSignature(app)` | `name@version` + the enabled snippet names — a cheap identity for "the styling currently loaded" |

Two traps this module exists to absorb:

- **`extraStyleEls` is index-aligned to the *enabled* subset**, not to
  `snippets`. A vault with snippets `[a, b, c]` and only `c` enabled has a
  single element at index 0.
- **`stylingSignature` is deliberately not a hash of the CSS.** It is used to
  decide whether a re-scan is needed, and hashing a megabyte to find out costs
  about as much as re-scanning it. The miss is a theme *edited in place* and
  reloaded, which moves neither name nor version — see
  [the fingerprint](#the-fingerprint-that-catches-a-reload).

> [!NOTE]
> Only the text inside that one `<style>` element is ever scanned. Anything a
> theme brings in some other way — an `@import`, a stylesheet a companion
> plugin injects — is invisible to enumeration, though the
> [appearance probe](#stage-5--reading-the-colours-and-the-icon-back) still
> measures its effect, because that reads the rendered page rather than the
> text.

## Stage 2 — Scanning the stylesheet for callout claims

[`themeCalloutScan.ts`](../src/manager/theme/themeCalloutScan.ts) is pure text
in, plain data out. The obvious implementation is to `replaceSync()` the theme
into an unadopted `CSSStyleSheet` and walk `cssRules` — which is what Callout
Manager does — but `CSSStyleSheet` does not exist in this repo's test DOM, and a
scanner nobody can test is how a wrong answer ships. Comments are stripped up
front and blocks are walked by brace depth, which is what the CSSOM was really
buying.

### What a claim records

```ts
interface ThemeClaim {
	weight: Specificity;      // heaviest [a,b,c] among selectors matching this id
	props: Set<string>;       // declared property names, lower-cased
	important: Set<string>;   // the subset marked !important
	certain: boolean;         // named outright, vs reached by a family pattern
}
```

`props` holds **names only**. The scan can say a theme declares
`--callout-color` for `[!note]`; it can never say what colour that is. That
limitation is not a gap to be closed by better parsing — it is why
[stage 5](#stage-5--reading-the-colours-and-the-icon-back) exists.

### Which operators name a callout

Enumeration may only read the operators that name **exactly one** id.

| Selector | Enumerated as an id? | Why |
| --- | --- | --- |
| `[data-callout="recite"]` | **yes** | Names one callout |
| `[data-callout~="infobox"]` | **yes** | Matches a whitespace-separated word list, and Obsidian writes only the *type* into `data-callout` (metadata goes to `data-callout-metadata`), so that list is always one word |
| `[data-callout*="column"]` | no — a *family pattern* | Says "everything containing this"; reading it as an id invents a callout named *column* that nobody has |
| `[data-callout^="col"]`, `[data-callout$="-md"]`, `[data-callout\|="col"]` | no — family patterns | Same reason |
| `[data-callout]` | no | Names nothing |
| `.callout`, `.callout-recite` | no | Not an attribute claim at all |

Including `~=` was a **measured** decision, not a liberty: ITS Theme declares
`infobox`, `cards`, `timeline`, `aside` and `kanban` that way and no other way,
so excluding it hid the five types its users reach for most.

Family patterns are kept — in `ThemeScan.patterns`, with `certain: false` — but
they are never enumerated. They are read by exactly one production surface: the
callout editor's ID field, which warns (never blocks) that a family selector
would also catch the id you are typing.

### What the scanner does and does not see

Confirmed against the scanner itself; every row here is behaviour, not intent.

| Input | Result |
| --- | --- |
| `@media`, `@supports`, `@layer` wrappers | descended into; inner claims found |
| A selector list, including one split across lines or containing `(` `)` | each part scored separately (`splitSelectorList`) |
| `:is([data-callout="a"], [data-callout="b"])` | both ids claimed |
| `:not([data-callout="note"])` | **dropped** — an anti-claim is not a claim (`blankNegations`) |
| `[data-callout=recite i]` | claimed; the case-insensitivity flag is tolerated |
| `[data-callout~=Metadata]` | claimed as `metadata` — keys are normalised |
| `[data-callout="my note"]` | claimed as `my-note` |
| `[data-callout="x"] { }` | **claimed** — an empty rule body still names the id |
| `body.some-style-settings-class [data-callout="y"]` | **claimed**, whether or not that class is currently on `<body>` |
| Anything inside a `/* … */` comment | not claimed |
| A rule that names an id **and** contains a nested child rule (`&`, or native CSS nesting) | **the outer claim is lost entirely** — see [Patterns that prevent discovery](#patterns-that-prevent-discovery) |

**Keys are the attribute form** (`obsidianCalloutAttrId`: trimmed, lower-cased,
whitespace dasherized), never the text as written. This is load-bearing rather
than tidy. ITS writes `[data-callout~=Metadata i]` in 24 rules; keyed as
written, that entry matches nothing any caller can ask for, so
`themeProvidedRows` would mint a row for it, fail to recognise its own row on
the next sweep, delete it, and mint it again — forever, on every `css-change`.

### Two questions, not one

The same scan feeds two questions with deliberately different inputs, and
collapsing them breaks both.

| | *Which callouts does the theme add?* | *How hard must Callout Studio push?* |
| --- | --- | --- |
| Entry point | `ThemeCalloutStore.themeDefinedIds()` | `ThemeCalloutStore.maxImportantClasses()` |
| Input | the **theme's** stylesheet only | theme **and every enabled snippet** |
| Operators | `=` and `~=` only | every operator |
| Why | *Callouts from your theme* has to mean it — a snippet the user wrote is their own work, and a family pattern names no callout | The emitted CSS has to outrank whatever is on the page, whoever wrote it |

A third, laxer question — *does this stylesheet style the callout I already
have?* — is [`themeClaimLookup.ts`](../src/manager/theme/themeClaimLookup.ts).
It is allowed to consult every operator because it is only ever handed an id the
registry already holds, so there is nothing left to invent. `patternMatches()`
is its production export (the editor's fuzzy warning); `claimForId()` is
exercised by the suites.

Both answers are memoised on `stylingSignature`, because parsing ITS Theme is
~850 KB of text.

## Stage 3 — Ownership

[`ThemeFacts.ts`](../src/manager/theme/ThemeFacts.ts) holds the two derived
theme facts — which ids are owned, and what they look like — and both are read
back through `CalloutRegistry`, because every surface that draws a callout
already has the registry. Threading a theme store through the eight surfaces
that draw an icon is eight chances for one of them to keep drawing the stored
one, which is exactly the bug this replaced.

```ts
registry.themeOwns(def)   // does the ACTIVE THEME name this callout's id?
registry.standsDown(def)  // themeOwns(def) || def.externalStyle === true
```

| | Reason | Listed under | Editable | Emits CSS |
| --- | --- | --- | --- | --- |
| `themeOwns(def)` | the active theme names the id | *Callouts from your theme* | no | no |
| `def.externalStyle === true` | the user styles it in their own snippet | their own section, **External CSS** label | yes | no |

`standsDown` is the **emission** gate, so every CSS path asks it. Anything
deciding where a row is *listed*, or whether it is read-only, must ask
`themeOwns` — an External CSS row is still the user's.

Three properties of ownership, each of which was a decision:

**Every id form counts.** `ThemeFacts.owns` walks `registry.vaultIdFormsFor(def)`
— the id, its aliases, and each one's dasherized attribute form where no other
definition owns it. A theme that styles `[data-callout="tldr"]` but not
`abstract` owns the whole callout. Letting the two halves render differently is
precisely the split this model exists to abolish.

**A generic `.callout {}` rule owns nothing.** Of the 257 themes installed in
the dev vault, only 63 name a callout id in `theme.css`; a large group styles
callouts without naming one. Counting those would hand the plugin's entire job
to the theme for rules that mostly set a radius.

**Derived, never stored — and the empty state is the safe one.** `CalloutRegistry`
takes no `App` and cannot see the theme when `load()` runs, so for the first
moments of a session — and forever in a test, an import or a headless run —
nothing is owned and the plugin styles everything. Standing *down* on that blank
would silently strip the styling from every callout the user has configured;
standing up cannot hurt anyone, because the worst case is painting a callout the
theme would also have painted, for one frame.

Writing `source: "theme"` onto a matching row instead would lose data three
ways: `getUserDefined()` excludes theme rows and feeds every backup, so the row
would silently stop being exported; the sweep's `stale` branch **deletes** an
uncustomized theme row on the next theme switch; and `importValidator` re-stamps
`source: "user"` on every import, so the flip would not even stay done.

## Stage 4 — Minting rows for the types a theme invents

A theme like AnuPpuccin or ITS does not only repaint `note` and `warning`; it
declares callout ids Obsidian has never heard of. Before this subsystem those
were invisible to the plugin — no row, so no settings entry, no autocomplete, no
quick insert, and the only way to use one was to type it from memory.

`syncThemeProvidedRows(registry, store)`
([`themeProvidedRows.ts`](../src/manager/theme/themeProvidedRows.ts)) is one
idempotent sweep over the enumerated id set. It works out three sets against the
current registry, then applies them inside a single `registry.batch()`:

- **`claimed`** — every attribute form already spoken for, **aliases included**.
- **`stale`** — existing `source: "theme"` rows the id set no longer holds.
- **`fresh`** — enumerated ids not in `claimed`.

Inside the batch, in this order:

1. **Publish ownership** (`setThemeOwnedIds`), unconditionally and *first*, so a
   row minted this round is already known to be the theme's by the time anything
   renders it. It is unconditional because a theme that starts claiming a
   built-in mints and retires nothing yet changes who paints it, which section
   the row sits in, whether the editor opens it, and whether a heading command
   may run.
2. **Retire the `stale` rows** — removed, or *re-homed* to `source: "user"` if
   somehow customized, and each removal recorded for
   `settings.retiredThemeIds`.
3. **Mint the `fresh` rows.**
4. **Record and prune `retiredThemeIds`** together, so the list only ever holds
   ids that are still retired.

A minted row is `buildDiscoveredRow(id, fallbackSource)` with
`source: "theme"` stamped over it — modelled on the configured **Fallback
callout** so the row has *something* to show in the pickers, where a colourless
entry reads as broken. None of that styling is emitted and none of it is saved;
the row's real appearance comes from the probe.

Three rules keep the sweep from destroying anything, and each is covered by
`tests/themeProvidedRows.test.ts`:

1. **It never touches a row it did not mint.** The `claimed` check skips any id
   that already has a row or is somebody's alias.
2. **A row the user adopted is re-homed, not deleted.**
3. **It is idempotent.** Two runs on the same stylesheet write nothing, which is
   what makes the `css-change` chain terminate.

`claimed` also makes provenance **structural** rather than a flag: the overlay
only ever holds ids nothing else defines, so a definition that survives the
retire pass is, by construction, one that existed before the theme claimed it.
There is no `introducedByTheme` boolean to migrate or get out of step.

### Collisions

| The theme names… | What happens |
| --- | --- |
| A built-in id (`note`) | No row is minted. The built-in moves into *Callouts from your theme*, keeps every stored customization, and gets it all back when the theme lets go |
| An id the user already created | No row is minted. It stays `source: "user"`, keeps its colours, aliases and backups, and is simply listed under the theme while the theme paints it |
| An id that is somebody's **alias** | No row is minted — the alias owner is already `claimed`, and that owner becomes theme-owned via `vaultIdFormsFor` |
| An id a discovered fallback row holds | No row is minted; the fallback row is listed under the theme and returns to its own section afterwards |
| An id nothing holds | A fresh `source: "theme"` row |
| The same id as the outgoing theme, on a theme switch | In neither `stale` nor `fresh` — it stays owned throughout, with no delete-and-remint in the middle |

Creating a callout whose id the theme supplies is **blocked** in the editor,
because the sweep has already minted a row and `canUseCalloutId` rejects the
duplicate. The message is the part that matters: `updateIdWarning` says the
theme supplies it (`editor.idFromTheme`) rather than *already exists*, which
would send the user looking for a callout of their own that is not there. A
*fuzzy* family match warns without blocking — whether the plugin wins is a live
cascade question no static read settles.

## Stage 5 — Reading the colours and the icon back

The scan knows property names; the user needs to see a swatch and an icon. The
gap cannot be closed by parsing, because the answer is whatever the cascade
computes — through variables, `color-mix()`, inheritance, or a Style Settings
body class the user toggled ten minutes ago.

So [`ThemeAppearanceProbe`](../src/manager/theme/ThemeAppearanceProbe.ts)
renders every theme-owned callout once, offscreen, and reads **used values** off
it. Three things about that rendering are load-bearing:

- **The ancestry.** Callouts are rendered inside
  `.markdown-preview-view > .markdown-rendered`, exactly as
  `settings/quickInsertPreview.ts` rebuilds it, because core's callout CSS and
  every theme's are written against reading view. A callout lifted out of that
  chain loses the very styling being measured.
- **`visibility: hidden`, never `display: none`.** A display-none subtree has no
  layout and no used values for masks or backgrounds; every theme would read as
  unknown. The host is parked at `left: -10000px` with `contain: layout style`
  (`.cs-theme-probe` in `styles.css`).
- **One batch per theme change.** Every wanted id goes into a single
  `MarkdownRenderer.render` call as `> [!id] ` lines — the header alone, never
  the user's display name, because a name carrying a newline would split into two
  blockquotes and shift every callout after it onto the wrong id.

Each rendered callout is matched by **its own `data-callout`**, not by index:
reading `rendered[index]` assumes the renderer produced exactly one `.callout`
per line in written order, and every id after the first place that stops being
true would be silently attributed to its neighbour. A wrong colour looks
plausible, so nothing would ever report it.

The cache is keyed on `stylingSignature` + light/dark + the sorted id set, and
dropped outright on `css-change`. A request arriving mid-pass is **held in one
slot and re-run**, never dropped — the one request that is never redundant is
`css-change`'s, and dropping it left the running pass free to write the
*outgoing* theme's readings into a cache that had just been cleared. A failed
read clears both the cache and the signature, so the next repaint tries again
and every row falls to a neutral placeholder in the meantime.

### Which node is asked

[`readCalloutStyle.ts`](../src/manager/theme/readCalloutStyle.ts) owns this and
nothing else, because **reading one node where the theme spoke on another is
indistinguishable from the theme having said nothing**. Two whole families of
theme rendered as *core's defaults* in the settings list for exactly that
reason, while looking right everywhere a real callout is drawn.

Obsidian's own stylesheet explains both:

```css
.callout             { --callout-color: var(--callout-default); }  /* blue */
.callout-title       { color: rgb(var(--callout-color)); }
.callout-title-inner { color: var(--callout-title-color); }
:root                { --callout-title-color: inherit; }
```

`--callout-title-color` is core's documented hook for a callout title's colour,
and 25 of the 257 installed themes use it — 13 of them without ever setting
`--callout-color`, so `.callout-title` keeps core's default hue forever while
the title the reader sees carries the theme's. Separately, 21 themes hide the
*drawing* rather than the slot (`.callout-icon > svg { display: none }`) and
paint their own artwork on `.callout-icon::before`.

The readout therefore takes six readings — five elements and one
pseudo-element: `.callout`, `.callout-title`, `.callout-title-inner`,
`.callout-icon`, that slot's first element child, and `.callout-icon::before`. Both mask spellings (`mask-image` and
`-webkit-mask-image`) are asked of every node that could carry one, because
browsers do not mirror one onto the other.

### The icon ladder

[`themeIcon.ts`](../src/manager/theme/themeIcon.ts), ordered by how **definitive**
the evidence is rather than by how common the mechanism is:

| Rung | Evidence | Reproduced as |
| --- | --- | --- |
| `hidden` | computed `display: none` on `.callout-icon` | nothing — a genuinely empty slot |
| `mask` (slot) | `mask-image` on `.callout-icon` **itself** | a painted box under the same stencil |
| `svg` | real child markup **that is itself displayed** | the markup, cloned and sanitized |
| `mask` (pseudo) | `mask-image` on `.callout-icon::before` | a painted box under that stencil |
| `glyph` | a `::before` with `content` | the text, in a real span, carrying its `font-family` |
| `unknown` | nothing legible | a neutral dashed placeholder |

Three orderings in that table are decisions, not accidents:

- **`hidden` outranks everything**, because a theme that hides the icon may
  leave core's markup in place; testing for markup first reproduces an icon the
  reader cannot see.
- **`svg` asks whether the *child* is displayed**, not just present. Testing
  `display` on `.callout-icon` alone is one node too shallow for the 21 themes
  above, and reproduced the very icon the theme had switched off.
- **The two masks sit on opposite sides of `svg`**, because CSS does not treat
  them as one thing. A mask on `.callout-icon` itself clips the element *and
  every descendant*, so core's `<svg>` is inside the stencil and cannot be what
  the reader sees. A mask on the `::before` paints a separate box and leaves a
  displayed child alongside it. Collapsing the two below `svg` is what made
  Sanctum and Sanctum reborn draw core's default `lucide-pencil` on every row.
  Measured over the 66 installed themes that name a callout id (1,278 rendered
  rows): 94 rows carry a slot mask and 60 a `::before`-only mask, and splitting
  the rung moves those 94 and no row in any other theme.

`iconKey()` folds each rung's **payload** into the identity, not just its kind —
two themes both reaching `mask` draw different pictures, and a comparison on
kinds alone would call that "unchanged" and keep the outgoing theme's artwork.

### The accent ladder

[`themeAppearance.ts`](../src/manager/theme/themeAppearance.ts), same
evidence-first ordering:

1. **The `::before`'s own paint**, when the `::before` is what drew the icon —
   its `background-color` under a mask, its `color` under a glyph. Core paints
   no `::before` at all, so a painted one is always a theme saying so.
2. **`.callout-title-inner`'s colour** — the hook above. Safe to add precisely
   because it defaults to `inherit`, making it byte-identical to rung 3 for
   every theme that ignores it.
3. **`.callout-title`'s colour** — `rgb(var(--callout-color))`.

The child `<svg>`'s own colour is deliberately **not** a rung: core paints it
`rgb(var(--callout-color))`, so it would duplicate rung 3 while letting the
handful of themes that neutralise their icon artwork (`--text-muted`,
`transparent`) drain the colour out of a swatch that is currently right.

The background is `.callout`'s computed `background-color`, falling back to the
first concrete colour stop inside its `background-image` — a theme that paints
callouts with a gradient leaves `background-color` transparent, so the swatch
would come out empty for exactly the themes that put the most work in. One stop
is not the gradient, but it is a colour the reader can genuinely see.

Blank readings become `null`, and *blank* is named rather than guessed at:
`ZERO_ALPHA_RE` matches the alpha component specifically. The regex it replaced
let its lazy head slide onto the **blue** channel, so every opaque colour whose
last channel is zero — `rgb(184, 131, 0)`, Sanctum's amber, and so its
`warning`, `caution`, `attention`, `alarm`, `idea` and `win` — came back
transparent and drew no swatch at all.

> [!IMPORTANT]
> **The fallback is never the row's stored icon or colour.** `null` accent,
> `null` background and `{ kind: "unknown" }` mean *draw a neutral placeholder*.
> A caller that substitutes `def.icon` or `def.colorLight` there has
> reintroduced the exact bug this module exists to remove — confidently naming
> a design that is not on screen, which is indistinguishable from a right answer
> until you compare.

## Stage 6 — Reproducing what was measured

[`renderThemeIcon.ts`](../src/manager/theme/renderThemeIcon.ts) is the **only**
code allowed to draw a *theme's* callout icon, exactly as
`icons/renderIcon.ts` is the only code allowed to draw a *Callout Studio* one.
Each rung reproduces what was measured rather than interpreting it again:

- `svg` — parsed as `image/svg+xml` (no scripting context), sanitized through
  `icons/svgSafety.ts` and isolated before insertion.
- `mask` — `.cs-theme-icon-mask` with `--cs-theme-mask`; there is no drawing to
  copy, so the painted box under the stencil is what gets reproduced.
- `glyph` — a real span carrying the measured `font-family`, because a
  pseudo-element cannot be cloned.
- `hidden` → nothing; `unknown` → `renderNoIcon`'s dashed placeholder. The
  distinction matters: `hidden` is the theme's decision, `unknown` is our
  ignorance.

Both colour-dependent rungs inherit `currentColor`, so a caller that sets the
accent on the container gets a matching drawing without this function knowing
anything about colour.

[`calloutListIcon.ts`](../src/manager/theme/calloutListIcon.ts) is the single
answer for every list that draws a callout *small* — autocomplete, *Replace in
vault*, vault stats, the command builder. Those four had drifted into three
different answers, two with no ownership check at all:

| Who paints the callout | Icon | Accent |
| --- | --- | --- |
| The theme | measured (`renderThemeIconInto`) | measured, else `var(--text-muted)` |
| The user's own CSS | dashed placeholder | `var(--text-muted)` |
| Callout Studio | the stored icon | the stored colour for the current mode |

**Quick Insert is deliberately not a caller.** It renders a *real* callout
through `MarkdownRenderer`, so the theme paints the row directly and there is
nothing to reproduce — the better mechanism wherever a full callout fits. The
settings row uses the same measured pair for its two swatches
(`CalloutRowRenderer.ts`), and shows no swatch at all when the accent came back
`null`.

## When discovery re-runs

[`themeRowSync.ts`](../src/manager/theme/themeRowSync.ts) owns the whole
lifecycle. It is registered from `main.ts` **before the first inject**, so the
theme's rows are in the sheet from the start, and it runs its first sweep and
probe immediately.

| Trigger | What happens |
| --- | --- |
| Plugin load | `sweep(true)` then `probe()` |
| `workspace.on("css-change")` — theme switch, snippet toggle, appearance change, another plugin's restyle | drop the readings → sweep → `inject(false)` → probe → `inject(false)` |

The `css-change` order is the load-bearing part, which is why it lives here and
not in `main.ts`:

```
appearance.invalidate()                 // the probe's own cache
registry.batch(() => {
    registry.setThemeAppearances(new Map())   // the PUBLISHED readings
    sweep()                                   // ownership + rows
})
cssInjector.inject(false)               // rows are in the sheet
probe()                                 // measure, then inject again
```

**Dropping the published readings is not the same as invalidating the probe.**
`invalidate()` clears the probe's cache, but nothing draws from that cache —
every row reads `ThemeFacts`, which the probe only rewrites when its next pass
lands, and the sweep's own `onChange` repaints the settings tab a turn earlier.
Without the explicit clear, every row came up wearing the **outgoing** theme's
artwork. The clear rides inside the sweep's `batch()`, so it *removes* a repaint
rather than adding one.

The re-inject passes `emitCssChange = false`: re-emitting `css-change` in
response to `css-change` loops with other plugins that also listen and re-emit
(Style Settings, for one), and the external event has already re-rendered open
notes.

### Why the chain terminates

- **Round 1** — the theme really changed: the fingerprint differs, rows are
  minted or pruned inside one `batch()`, one `onChange` fires, `inject()`
  produces different text, swaps it in and triggers `css-change`.
- **Round 2** — the listener re-injects with `emitCssChange = false`, the text
  is byte-identical so `injectNow` returns before the stylesheet swap, and the
  sweep finds an unchanged fingerprint and writes nothing.

The probe lands after both and announces its readings — a third `onChange` — and
still cannot cycle, on two counts: nothing that generates CSS reads an
appearance, so that inject is byte-identical and never reaches the trigger; and
`ThemeFacts.setAppearances` stays silent unless the readings actually moved.
Both `setOwnedIds` and `setAppearances` compare before notifying, because
announcing a no-op costs a CSS regeneration, a `data.json` write and a full
settings-tab repaint.

### The fingerprint that catches a reload

`stylingSignature` is name + version + enabled snippets, and **none of those
move when a theme is edited in place and reloaded** — so a callout id added that
way would never get a row, however many `css-change` events went by. The sweep's
own memo is that signature plus `themeCss(app).length`, and when it moves it
calls `ThemeCalloutStore.invalidate()` so the store re-scans despite its own
signature being unchanged.

The length is deliberately *not* folded into `stylingSignature`: that function
is asked on every inject by `StudioWeightCache`, and reading `styleEl.textContent`
allocates the entire stylesheet — hundreds of kilobytes for exactly the
callout-heavy themes this matters for. The sweep reads it twice per theme
change, which is where that cost is affordable.

> [!WARNING]
> `StudioWeightCache.resolve()` advances `ThemeCalloutStore`'s signature memo as
> a side effect of asking it anything, and it runs *before* the sweep on the
> `css-change` path. Any new consumer that wants to know "did the theme change
> since I last looked?" must keep its own memo, exactly as this file does.

## Representation and persistence

A row minted for a callout type the theme invented is an **ephemeral overlay**.
`CalloutRegistry.toSaveData()` skips `source: "theme"`, so such a row is minted
from the stylesheet on every launch and on every `css-change`, and written to
`data.json` by nothing at all.

That single line is the whole lifecycle model, and it buys two things: *"the
theme stopped supplying this, so it is gone"* needs nothing to undo it, and
provenance stays structural (see [stage 4](#stage-4--minting-rows-for-the-types-a-theme-invents)).

| | While the theme claims it | When it lets go |
| --- | --- | --- |
| Theme-invented (`recite`) | overlay row, theme section | **gone**; the notes are untouched |
| Pre-existing user callout | theme section, stands down | back to *My callout types*, field for field |
| Built-in the theme repaints | theme section | back to *Built-in callouts*, customizations intact |
| Discovered fallback row | theme section | back as a fallback row |

Which registry view a caller wants is therefore a real question:

| View | Includes theme rows? | Used by |
| --- | --- | --- |
| `getAll()` | yes | autocomplete's raw list, the injector's sweeps |
| `getThemeProvided()` | only theme rows | the settings list, `committedDefinitions` |
| `getUserDefined()` | **no** | backups, `getExportableDefinitions`, *Reset everything* |
| `committedDefinitions()` | yes | "what may be written in a note" — quick insert, the public API |

`CalloutDetails.themeStyled` is the public API's read of the same fact
(additive; `externalStyle` keeps its released meaning, which is the broader
"the plugin emits nothing"). See [18-public-api.md](18-public-api.md).

### Retired ids

The notes do not change when the theme does. They still say `> [!recite]`, and
`CalloutDiscovery` auto-creates rows for ids nothing defines — so without help
the row a theme switch just removed returns one file-open later as an
uncustomized fallback row: a callout the user never made, styled by nobody,
filed under the callouts they did make.

So the sweep records what it retired into `settings.retiredThemeIds`
([`retiredThemeIds.ts`](../src/manager/theme/retiredThemeIds.ts)) and
[`RediscoveryHold`](../src/manager/rediscoveryHold.ts) answers that and the
seconds-long hold after an explicit delete as **one** question, because every
automatic path asks them in the same breath. Four properties keep the list from
becoming a place where ids go to be forgotten:

- **It gates automatic discovery only.** `canUseCalloutId` never reads it, so
  creating the id explicitly still works and is the way to take it over.
- **A user-requested vault scan clears it** — the same doctrine
  `suppressRediscovery` already followed.
- **The sweep prunes it.** An id something defines again, or that the active
  theme declares again, drops straight back out.
- **An import does not carry it.** It is this vault's theme history, not
  configuration — see [14-import-export.md](14-import-export.md).

It is capped at `RETIRED_THEME_ID_CAP` (200), oldest first, as a backstop
against a pathological switching history growing `data.json` without bound.

## Where theme callouts appear — and why Block only

| Surface | Theme callouts appear? |
| --- | --- |
| Settings → *Callouts from your theme* | yes, one row each, read-only |
| *Quick insert block callout* | yes — rendered by Obsidian, so the theme draws the row itself |
| The `[!` autocomplete, **block** position | yes |
| The `[!` autocomplete, **heading / inline** position | no (`suggestableCallouts`) |
| *Replace in vault*, vault stats, command builder lists | yes, drawn through `calloutListIcon` |
| The command builder's **format** dropdown | Block only (`offerableRoles`) |
| Backups / export JSON | no (`getUserDefined` excludes them) |

**A theme callout has exactly one format.** Heading callouts (`## [!recite]`)
and inline callouts (`word [!recite] word`) are Callout Studio's own invented
`.cs-*` DOM, which no theme selector can match — so painting them would override
nothing, and an earlier build did exactly that on that argument. It was the
wrong call: it offers two formats the theme has no design for and cannot follow,
beside a Block callout the theme draws itself. Three renderings of one callout,
two of them invented, is worse than one rendering and some literal text — and
literal text is at least legible *as syntax*, which is what tells the user the
format is unavailable.

One gate enforces it, and every surface that builds token DOM funnels through
it:

```ts
// editor/renderShared.ts
export function shouldRenderToken(resolved: ResolvedCalloutDef): boolean {
	return !resolved.external && !resolved.themeOwned;
}
```

Three consequences downstream, each handled rather than left to fall out:

- **Autocomplete** narrows by role (`utils/usableCallouts.suggestableCallouts`).
- **The command builder** drops the two options rather than disabling them, with
  a line saying why (`settings/command/commandRoles.ts`).
- **An existing heading/inline command is *suspended*, never deleted**
  (`isSuspendedByTheme`): unregistered from the palette, left untouched in
  `settings.customCommands`, re-registered at the same id when the theme lets
  go — so the user's own hotkey survives the round trip. The gate is on
  `desiredNames` and never on `kept`, because `kept` is written straight back to
  settings.

A pre-existing callout that becomes theme-owned loses the two formats for
exactly as long as the theme claims it, and gets them back with no migration:
nothing left the definition, only what the renderer acts on.

**The row itself is read-only**, and the refusal lives in
[`openCalloutEditor.ts`](../src/settings/openCalloutEditor.ts) because the
settings row, the context menu, quick insert and the public API all reach the
editor through it. The pencil opens
[`ThemeCalloutPreviewModal`](../src/settings/ThemeCalloutPreviewModal.ts), which
states who owns the callout, that Heading and Inline are unavailable, and shows
a Block-only live preview — and **writes nothing at all**, which is what keeps a
theme row an ephemeral overlay rather than a row with a hidden way to become
permanent. Its `⋯` menu
([`themeRowActions.ts`](../src/settings/sections/themeRowActions.ts)) carries
usage information, and — only when the callout is actually written somewhere —
*Replace in vault* and *Clear uses in your notes*. Never *Delete*, which would
be a lie since the theme keeps supplying the type; `deleteRemovesRow`
([`rowOwnership.ts`](../src/settings/sections/rowOwnership.ts)) is the single
predicate behind that wording, and it answers the same way for a built-in.

The use count lives in that menu rather than on the row, and the row carries no
*Default fallback* tag either: both describe a callout the user cannot act on.
Counting is a whole-vault read, so it is cached at module scope in
[`themeRowUsage.ts`](../src/settings/sections/themeRowUsage.ts) — one pass per
visit to the settings tab, dropped in `SettingsTab.hide()`. It must never move
inside `refresh()`, which is subscribed to `registry.onChange`: that would scan
every markdown file on every drag of a colour picker.

## For theme authors

Everything below follows from the scanner and the probe described above. The
short version:

> Name each callout with a plain `[data-callout="id"]` (or `~=`) attribute
> selector in a **flat** rule, set `--callout-color` for the accent and
> `--callout-icon` for the artwork, and Callout Studio will list your callout
> with the right id, the right colour and the right icon — and then get out of
> your way.

### What the plugin does with what it finds

| It found | Result for you |
| --- | --- |
| Your theme names a callout id | Callout Studio emits **no** CSS aimed at `.callout` for it. Your rules apply exactly as they would with the plugin uninstalled |
| Your theme invents a new id | It gets a row under *Callouts from your theme*, appears in autocomplete and Quick insert, and is removed cleanly when a user switches away |
| Your theme names no id (only `.callout {}`) | Nothing changes; the plugin keeps styling the user's callouts, and yours are not listed |

### Patterns that are read reliably

```css
/* Best: a flat rule, one id, a colour hook and an icon hook. */
.callout[data-callout="recite"] {
	--callout-color: 174, 129, 255;      /* R, G, B — core's pre-1.13 format */
	--callout-icon: lucide-quote;        /* any Lucide id core knows */
}

/* Word-list form, read identically. */
[data-callout~="infobox"] { --callout-color: 90, 160, 240; }

/* Selector lists, appearance scoping, at-rule wrappers, :is() — all fine. */
.callout[data-callout="tip"],
.callout[data-callout="hint"] { --callout-color: 120, 200, 120; }

.theme-dark .callout[data-callout="recite"] {
	--callout-color: 200, 170, 255;
}

@media print {
	.callout:is([data-callout="a"], [data-callout="b"]) { --callout-color: 1, 2, 3; }
}
```

> [!NOTE]
> `--callout-color` changed format in Obsidian 1.13: before it, a bare `R, G, B`
> triplet that core wraps in `rgb(…)`; from 1.13 on, a full CSS colour string.
> Discovery does not care either way — it reads the *computed* result — but the
> appearance the user sees does, so use whichever your `minAppVersion` implies.

- **Case and spacing do not matter.** `[data-callout~=Metadata i]` is read as
  `metadata`; `[data-callout="my note"]` as `my-note` — the same normalisation
  Obsidian applies when it writes the attribute.
- **`@media`, `@supports` and `@layer` wrappers are descended into.**
- **A rule that sets nothing still claims the id.** `[data-callout="x"] {}` is a
  claim.
- **Body-class scoping still claims.** `body.my-style-settings-class
  [data-callout="y"]` claims `y` whether or not that class is currently applied.
- **Light and dark variants both claim the same id**, so a callout styled only
  in `.theme-dark` is still owned in light mode. What the *swatch* shows is the
  current appearance mode only — see
  [Limitations](#limitations-and-edge-cases).

### Patterns that prevent discovery

| Pattern | Effect |
| --- | --- |
| **Native CSS nesting on a callout selector** — `[data-callout="x"] { color: red; & .callout-title { … } }` | **The whole outer claim is lost.** The block walker treats a body containing `{` as a wrapper and descends into it, so the outer prelude is never visited |
| `[data-callout*="col"]`, `^=`, `$=`, `\|=` | Kept as a family pattern, never listed as a callout type — a pattern names no id. Intended, and the editor warns a user whose id would be caught |
| `:not([data-callout="note"])` | An anti-claim; dropped |
| `.callout-recite`, or any class-only convention | Not a `data-callout` claim; invisible |
| `[data-callout]` alone | Names nothing |
| Callout CSS delivered by `@import`, or injected by a companion plugin | Not in the theme's `<style>` element, so not scanned |
| Callout ids produced at runtime (e.g. `--callout-icon: attr(data-callout)`) | Unbounded id space; nothing static can enumerate it |

The nesting case is the one that bites in practice, and it is measured: of the
257 themes installed in the dev vault, **7 nest a rule inside a selector that
names a callout id**, and for one of them — *Minimal Dracula*, which styles
callouts exclusively that way — the scanner sees **no ids at all**. Its callouts
are therefore treated as the plugin's to paint, and its `!important`
declarations are invisible to the escalation arithmetic as well.

If you write nested CSS, keep one flat rule per callout id alongside it:

```css
/* ❌ invisible to discovery */
.callout[data-callout="todo"] {
	background: var(--red-2) !important;
	a { color: var(--text); }
}

/* ✅ same result, discoverable */
.callout[data-callout="todo"] {
	background: var(--red-2) !important;
}
.callout[data-callout="todo"] a {
	color: var(--text);
}
```

### Colours

The accent is read as a **used value** off a rendered callout, in this order:
the `::before`'s own paint (when the `::before` draws the icon) →
`.callout-title-inner`'s `color` → `.callout-title`'s `color`. In practice that
means:

- Setting `--callout-color` works, because core resolves it onto
  `.callout-title`.
- Setting `--callout-title-color` works, because that is the node actually asked.
- `color-mix()`, `var()` chains, `oklch()` — all fine. The probe reads the
  computed result, not your source text.
- Painting **only** the child `<svg>`'s colour will *not* register as an accent,
  by design.

Backgrounds are read from `.callout`'s `background-color`, falling back to the
first colour stop in `background-image` for gradient-painted themes.

### Icons

Ranked by how well they reproduce on the plugin's own small surfaces:

| Mechanism | Rung | Reproduces as |
| --- | --- | --- |
| `--callout-icon: lucide-quote` | `svg` | The real drawing — best supported. Core injects the `<svg>`, and it is cloned |
| `--callout-icon: '<svg …>'` | `svg` | Same, after sanitizing |
| `mask-image` on `.callout-icon` | `mask` (slot) | A `currentColor` box under your stencil — accurate, and it inherits the row's accent |
| `mask-image` on `.callout-icon::before` | `mask` (pseudo) | The same, as long as the child `<svg>` is hidden or absent |
| An icon-font glyph in `::before { content: "\f0eb" }` | `glyph` | The character, carrying your `font-family` — correct only if that font is loaded where the plugin draws it |
| `.callout-icon { display: none }` | `hidden` | An empty slot, faithfully |
| Anything else | `unknown` | A neutral dashed placeholder, never your row's stored icon |

> [!TIP]
> If you paint on `.callout-icon::before` **and** leave core's `<svg>` visible,
> the `svg` rung wins and small surfaces will show core's drawing rather than
> yours. Hide the child (`.callout-icon > svg { display: none }`) or mask the
> slot itself — which is what the themes that get this right already do.

### Testing your theme against Callout Studio

`npm run themes:report` reads every theme installed in a vault, runs each one
through **the plugin's own scanner**, and writes a Markdown worksheet next to
the vault root. Reusing the real scanner is the point: the *callout types it
adds* column is literally the set the settings tab will list, not an
approximation, so a disagreement is a plugin bug rather than a reporting one.
It is deliberately **not** part of `npm run build` — its output goes into a
vault, not the repo, and it depends on which themes happen to be installed.

The columns worth checking for your own theme:

- **Callout types it adds** — should be exactly the ids you intended. An empty
  column on a theme that styles callouts means a discovery-blocking pattern
  above.
- **Fuzzy** — family selectors, listed as `*=col` strings. These capture users'
  own ids silently.
- **`!important` count** and **heaviest selector** — the inputs to the plugin's
  escalation. The ceiling is 14 class units.
- **Style Settings classes** and **`:has()`** — flagged because a static scan
  cannot predict them; those rows need a human.

## Limitations and edge cases

- **Only the current appearance mode can be probed.** Wrapping the probe in a
  `.theme-light` div does not flip a theme that writes `body.theme-dark …`, and
  flipping the real body would repaint the user's screen. Readings are re-taken
  on the `css-change` that an appearance switch fires.
- **A claim does not mean the rule is active.** The scanner reads text, so an id
  named only behind a Style Settings body class is owned even while that class
  is off. The plugin stands down; the probe then measures whatever *is* on
  screen, which may be core's defaults.
- **Ownership is per id, not per property.** A theme that sets one variable for
  `note` owns `note` entirely. This is the whole point — a partial override is
  the split the model exists to abolish — but it does mean a very light touch
  costs the theme the full callout.
- **Layout is not undone.** The plugin wins the properties it sets; it does not
  reverse `display: grid` or a `transform` a theme adds.
- **Enumeration reads the theme only.** A user snippet that declares
  `[data-callout="foo"]` does *not* create a theme row and does not make the
  plugin stand down — snippets count only toward the `!important` escalation
  measurement. Handing a callout to a snippet is the explicit *Style with my own
  CSS* choice instead.
- **Quick Insert's source filter partitions on `builtIn`**, so a theme-invented
  row appears under the *user* filter. There is no theme filter.
- **`source: "theme"` in an imported file is not authority.** `importValidator`
  re-stamps `source: "user"`; only the live sweep can make a row a theme row.
- **A `"` or `\` can reach a callout id** without the user typing it, so every
  emitted selector escapes through `utils/calloutSelector.ts` — see
  [06-css-generation.md](06-css-generation.md#calloutsel-vs-tokenattrsel--the-selector-escaping-rule).

## Where the code lives

| File | Responsibility |
| --- | --- |
| [`manager/theme/customCssApi.ts`](../src/manager/theme/customCssApi.ts) | The only place `app.customCss` is named |
| [`manager/theme/themeCalloutScan.ts`](../src/manager/theme/themeCalloutScan.ts) | Pure text scanner: claims, patterns, weights |
| [`manager/theme/themeClaimLookup.ts`](../src/manager/theme/themeClaimLookup.ts) | "Does this sheet style the id I already have?" |
| [`manager/theme/ThemeCalloutStore.ts`](../src/manager/theme/ThemeCalloutStore.ts) | Caching + the enumeration/weight split |
| [`manager/theme/ThemeFacts.ts`](../src/manager/theme/ThemeFacts.ts) | Owned ids + measured appearances, held behind the registry |
| [`manager/theme/themeProvidedRows.ts`](../src/manager/theme/themeProvidedRows.ts) | The mint/retire/re-home sweep |
| [`manager/theme/themeRowSync.ts`](../src/manager/theme/themeRowSync.ts) | Scheduling, ordering, the fingerprint, the probe's lifetime |
| [`manager/theme/ThemeAppearanceProbe.ts`](../src/manager/theme/ThemeAppearanceProbe.ts) | Offscreen render + cache |
| [`manager/theme/readCalloutStyle.ts`](../src/manager/theme/readCalloutStyle.ts) | Which node answers which property |
| [`manager/theme/themeAppearance.ts`](../src/manager/theme/themeAppearance.ts) | Accent/background interpretation |
| [`manager/theme/themeIcon.ts`](../src/manager/theme/themeIcon.ts) | The five-rung icon ladder |
| [`manager/theme/renderThemeIcon.ts`](../src/manager/theme/renderThemeIcon.ts) | Reproducing a measured icon |
| [`manager/theme/calloutListIcon.ts`](../src/manager/theme/calloutListIcon.ts) | One answer for every small callout list |
| [`manager/theme/retiredThemeIds.ts`](../src/manager/theme/retiredThemeIds.ts) | What a theme took with it |
| [`manager/theme/studioWeight.ts`](../src/manager/theme/studioWeight.ts) / [`StudioWeightCache.ts`](../src/manager/theme/StudioWeightCache.ts) | How hard the plugin pushes on what it *does* own |
| [`manager/theme/themeReport*.ts`](../src/manager/theme/themeReport.ts) | The `themes:report` worksheet — not bundled into `main.js` |
| [`settings/sections/rowOwnership.ts`](../src/settings/sections/rowOwnership.ts) | Which of the three lists a row belongs in |
| [`settings/sections/themeRowActions.ts`](../src/settings/sections/themeRowActions.ts), [`themeRowUsage.ts`](../src/settings/sections/themeRowUsage.ts) | The theme row's controls and its cached use counts |
| [`settings/ThemeCalloutPreviewModal.ts`](../src/settings/ThemeCalloutPreviewModal.ts) | The read-only window behind the pencil |

Suites: `themeCalloutScan`, `themeOwnership`, `themeProvidedRows`,
`themeRowSync`, `themeAppearance`, `themeAppearanceProbe`, `themeRowActions`,
`themeReport`, `retiredThemeIds`, `cssSpecificity`.

---
Next chapter: [00-index.md](00-index.md)
