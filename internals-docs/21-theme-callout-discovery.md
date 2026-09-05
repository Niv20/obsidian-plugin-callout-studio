# Theme callout discovery

How Callout Studio finds out which callout types the **active Obsidian theme**
supplies, what those callouts look like, and what it then does with that
knowledge for an existing or manually discovered type: a row under *Callouts from your theme*, an entry in *Quick insert
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

Six stages, plus one question answered off to the side. Each is a separate
module because each has its own failure mode, and several of them have to
happen in this order.

| # | Stage | Module | Output |
| --- | --- | --- | --- |
| 1 | Find the active theme and its CSS text | [`customCssApi.ts`](../src/manager/theme/customCssApi.ts) | theme name, stylesheet text, snippet texts, a cheap signature |
| 2 | Scan that text for callout claims | [`cssBlocks.ts`](../src/manager/theme/cssBlocks.ts) → [`themeCalloutScan.ts`](../src/manager/theme/themeCalloutScan.ts), cached by [`ThemeCalloutStore.ts`](../src/manager/theme/ThemeCalloutStore.ts) | `Map<attrId, ThemeClaim>` + family patterns |
| 3 | Publish ownership | [`ThemeFacts.ts`](../src/manager/theme/ThemeFacts.ts), via `CalloutRegistry.setThemeOwnedIds` | `registry.themeOwns(def)` |
| 4 | Add missing ids only after a manual request | [`ManualCalloutDiscovery.ts`](../src/manager/ManualCalloutDiscovery.ts) | Durable fallback rows |
| 5 | Measure what the theme actually draws | [`ThemeAppearanceProbe.ts`](../src/manager/theme/ThemeAppearanceProbe.ts) + [`readCalloutStyle.ts`](../src/manager/theme/readCalloutStyle.ts) + [`themeAppearance.ts`](../src/manager/theme/themeAppearance.ts) / [`themeIcon.ts`](../src/manager/theme/themeIcon.ts) | `ThemeAppearance` per id |
| 6 | Reproduce it wherever the plugin lists callouts | [`renderThemeIcon.ts`](../src/manager/theme/renderThemeIcon.ts), [`calloutListIcon.ts`](../src/manager/theme/calloutListIcon.ts) | icons and swatches on rows, menus, pickers |
| — | Decide how the theme **spells** a callout accent | [`accentDialectScan.ts`](../src/manager/theme/accentDialectScan.ts) + [`accentDialect.ts`](../src/manager/theme/accentDialect.ts) + [`accentValueFormat.ts`](../src/manager/theme/accentValueFormat.ts), cached alongside stage 2 | `AccentDialect` — see [The accent dialect](#the-accent-dialect) |

Scheduling — when the whole thing runs and in which order — is
[`themeAppearanceSync.ts`](../src/manager/theme/themeAppearanceSync.ts), covered under
[When theme appearance refreshes](#when-theme-appearance-refreshes).

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

Cutting the sheet into rules is its own module,
[`cssBlocks.ts`](../src/manager/theme/cssBlocks.ts), which hands the scanner one
`(selector, declarations)` pair per rule. It resolves **native CSS nesting**
first, so a nested sheet is read exactly as its flat equivalent would be — same
ids, same property names, same specificity. That is not a nicety: nesting is a
choice about source formatting, and the browser resolves it away before anything
this plugin cares about happens.

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
| Native CSS nesting — a rule that names an id **and** nests child rules | read as its flat equivalent: the parent's own declarations are its claim, and each nested rule is resolved against it (`&`, or the implied descendant) |
| A nested `@media` / `@supports` inside a style rule | its declarations belong to the rule around it, exactly as the browser reads them |

**Keys are the attribute form** (`obsidianCalloutAttrId`: trimmed, lower-cased,
whitespace dasherized), never the text as written. This is load-bearing rather
than tidy. ITS writes `[data-callout~=Metadata i]` in 24 rules; keyed as
written, that entry matches nothing any caller can ask for, so
manual discovery and rendering ownership would disagree about which id
the theme claims.

### The bare `.callout` rule the claim scanner never sees

`scanCalloutClaims` opens with `if (!prelude.includes("data-callout")) return;`,
so a theme rule that styles *every* callout without naming one is invisible to
it. That is correct for its own question — such a rule claims no id — but it is
exactly the rule the core accent shim has to know about: Obsidian gruvbox's
entire callout section is `.callout { background-color: rgba(var(--callout-color), 0.2) }`
at `(0,1,0)`, which ties the shim and would lose on source order alone.

`accentDialect.ts` therefore runs its **own** walk rather than extending this
one, pre-filtered on `.callout` rather than `data-callout`, and records the
properties declared on a compound that is `.callout` (optionally repeated) **and
nothing else**. Anything with a guard on it — a body class, a
`[data-callout-metadata*=…]`, an id — is deliberately not recorded: it is
conditional, so it says nothing about callouts in general, and when it does
apply its extra class-unit already beats the shim.

### The generic callout surface

A third question off the same text, and the mirror image of ownership: **what
does the active styling say about a callout it has never heard of?** Every
callout this plugin invents is one of those, and sixteen of the 257 installed
themes answer with some form of "a callout has no background of its own".

[`calloutSurfaceTarget.ts`](../src/manager/theme/calloutSurfaceTarget.ts) reads
the selector, [`calloutSurfaceScan.ts`](../src/manager/theme/calloutSurfaceScan.ts)
reads the declarations, and
[`calloutSurface.ts`](../src/manager/theme/calloutSurface.ts) folds several
sheets into the answer `StudioWeightCache.surface()` memoises beside the dialect.
`ThemeCalloutStore.refresh()` runs it on the theme **and** every enabled snippet,
for the same reason the dialect does: what has to work is what is on the page,
whoever wrote it.

Two facts come out, both keyed by the **guard** the theme wrote them under:

| Fact | Recorded when | Themes |
| --- | --- | --- |
| `neutralBackground` | a generic `.callout` rule sets `background`/`background-color` to `transparent`, `unset`, `initial`, `revert`, `rgba(0,0,0,0)`, or (shorthand only) `none` | 16 |
| `colorlessFrame` | a generic `.callout-title` / `.callout-content` rule uses a `border` shorthand with a line style and **no colour token** | 4, after the veto |

`background-color: none` is deliberately *not* accepted: it is invalid and the
parser drops it, so reading it as "no background" would be believing a
declaration that never applied.

The **guard** is every selector step before the callout compound, verbatim — the
guard stops at the *last* `.callout` step, because that is the step this plugin's
own selector replaces. Qualifiers *on* that compound
(`:not(.cg-note-toolbar-callout)`, `.is-collapsible`) are dropped, the same call
`reachable()` makes in `accentDialectScan.ts`, and it is safe in both directions
here: a background cancel is what the theme asked for in the state it named, and
a `border-color` on a box with no border width draws nothing.

A guard is only recorded when every step is a plain compound — an element name,
classes, and `:not()`. A child combinator, an id, an attribute, a universal
selector or a pseudo-element **drops the fact entirely**, because the guard is
re-stated in front of a selector this plugin writes, and a guard that means
something different there is worse than no fact at all. Nothing in the corpus
needs any of them.

What the emitter does with the pair, the global veto that Shiba Inu justifies,
and why this is a *cancel* rule rather than a suppression is
[06-css-generation.md § The theme-owned surface](06-css-generation.md#the-theme-owned-surface).

The corpus, for anyone re-measuring it: unguarded (Cyber Glow, Notation 2,
Polka); behind a `body:not(…)` the reader opts out of (Prism, Cybertron, LYT
Mode, Ultra Lobster); behind an opt-in class (GitHub Theme `callout-on`, Minimal
and Oxygen `callouts-outlined`, Composer, Glass Robo, Iridium, ITS Theme, Shiba
Inu, Typomagical, Underwater).

### The accent dialect

A separate question from ownership, answered from the same text: **which
spelling of `--callout-*` does this theme expect?** Obsidian 1.13 changed its
own accent variables from a bare RGB triplet to a full CSS colour, and a theme
that predates that change still reads `rgba(var(--callout-color), 0.1)` — which
a hex makes invalid at computed-value time, so the declaration silently unsets.
The consequences are visible and confusing: a missing background, a side accent
that does not draw at all.

Two answers, not one, because themes disagree with themselves:

- **`read`** — one answer per sheet, by majority of `var(--callout-…)` read
  sites. Decides what goes *into* `--callout-color`.
- **`declared`** — per variable **and per mode**, from the theme's own
  declarations, following `var()` hops and fallbacks. Decides whether
  `--cs-accent-theme` takes `var(--callout-info)` or `rgb(var(--callout-info))`.

Composer declares `--callout-error: 158, 48, 57` while reading
`color-mix(in srgb, var(--callout-color) …)`; Reshi, Nebula, Novadust, Nightfox
and RetroNotes declare triplets they never read at all. A single answer is wrong
for all six.

Three **read** rules earn their place by measurement rather than caution, and
each has a test that freezes it:

| Rule | Why |
| --- | --- |
| a pass-through alias (`--callout-color: var(--callout-default)`) counts for neither side | it forwards whatever it was handed. Counting them flips SALEM, Sandstorm and Serenity from triplet to colour |
| the innermost wrapper decides | `color-mix(…, rgb(var(--callout-color)) 25%, …)` is a triplet read despite the outer `color-mix` |
| relative colour is a **colour** read | `hsl(from var(--callout-color) h s l / .1)` (Baseline, Cupertino) and `oklch(from …)` (Iridium) look legacy and are not |

And three **declaration** rules, each for a place a value hides from a naive
scan. Getting one wrong is not a near-miss — `--cs-accent-theme` is registered
`<color>`, so the wrong wrapper falls back to its grey initial and takes every
heading bar, inline pill, ref token and icon tint on that built-in with it:

| Rule | Why |
| --- | --- |
| the answer is **per mode** | 10 themes declare an accent variable in one mode only. Nier puts all thirteen under `.theme-dark`, as triplets, leaving light mode on core's colours. `undefined` for a mode means "core supplies it there" |
| a chain that **leaves the sheet** falls back to the sheet's own `read` | Arcane ends on core's `--color-blue` (a colour); Aura, Nier and Vicious on `--color-*-rgb` (triplets). A stylesheet is consistent with itself — and Arcane is why this is the read dialect, not a `-rgb` name check |
| a declaration behind a **theme option** is ignored | Aura's `.aura-origin-layout` is one layout of three and not the default; TerraFlow's `.academia-theme` one palette of eleven. In the state almost everyone is in, the variable still holds core's value. A `:not()` guard is trusted — Velocity's `body:not(.disable-callout-styling)` is its *normal* styling — and so is `.callout` itself, where RetroNotes puts all fourteen |

Across the 257 themes in the dev vault: **36** read a triplet, **25** read a
colour, **0** tie. The remaining 196 never touch these variables and fall back
to core's own spelling, which makes their generated CSS byte-identical to what
it was before any of this existed.

See [Colour system § accent dialect](11-color-system.md#accent-dialect-version-drift-and-theme-drift)
for what is done with the answer, and
[CSS generation § the core accent shim](06-css-generation.md#the-core-accent-shim)
for the rule that pays for it.

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

## Stage 4 — Adding theme types manually

`ManualCalloutDiscovery` includes the current theme's declared ids when the user
presses **Discover now**. Missing ids become durable fallback rows, checked against
existing definitions, aliases and reserved ids. No theme event adds, retires or
recreates a row. The same saved type can follow a theme on one device and fallback
styling on another without either device rewriting its definition.


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

## When theme appearance refreshes

`registerThemeAppearance` in `themeAppearanceSync.ts` publishes theme ownership and
measured appearance at startup, settings adoption and CSS changes. It never adds
or removes definitions. Its fingerprint includes the CSS text, so an in-place edit
with unchanged name, version and text length is still recognized. Rendering updates
are deduplicated and do not emit another CSS event when reinjecting.

## Representation and persistence

Manually discovered types have `source: "fallback"` and are saved in `data.json`.
Theme ownership remains a runtime fact derived from the active theme. Changing a
theme can change grouping and available render roles; it cannot erase a saved
callout. There is no retired-theme-id store. Legacy `source: "theme"` rows found
in saved data are preserved as durable fallback definitions.



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
a Block-only live preview that **writes nothing at all**. The saved definition
remains intact while its current theme owns the appearance. Its `⋯` menu
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
> selector, set `--callout-color` for the accent and `--callout-icon` for the
> artwork, and Callout Studio will list your callout with the right id, the
> right colour and the right icon — and then get out of your way. Nest or don't;
> both are read the same.

### What the plugin does with what it finds

| It found | Result for you |
| --- | --- |
| Your theme names a callout id | Callout Studio emits **no** CSS aimed at `.callout` for it. Your rules apply exactly as they would with the plugin uninstalled |
| Your theme invents a new id | It gets a row under *Callouts from your theme*, appears in autocomplete and Quick insert, and is removed cleanly when a user switches away |
| Your theme names no id (only `.callout {}`) | Nothing changes; the plugin keeps styling the user's callouts, and yours are not listed |

### Patterns that are read reliably

```css
/* Best: one id, a colour hook and an icon hook. */
.callout[data-callout="recite"] {
	--callout-color: 174, 129, 255;      /* R, G, B — core's pre-1.13 format */
	--callout-icon: lucide-quote;        /* any Lucide id core knows */
}

/* Native nesting is read as its flat equivalent — declarations on the rule
   itself, `&`, an implied descendant, and any depth of either. */
body.theme-dark .callout[data-callout="recite"] {
	background: rgba(174, 129, 255, 0.1);
	& .callout-title { font-variant: small-caps; }
	.callout-content { padding-block: 0.5rem; }
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

> [!IMPORTANT]
> **`--callout-color` changed format in Obsidian 1.13**: before it, a bare
> `R, G, B` triplet that core wraps in `rgb(…)`; from 1.13 on, a full CSS
> colour string. Discovery does not care either way — it reads the *computed*
> result — but everything else does.
>
> Callout Studio hands your theme **whichever spelling your own stylesheet uses**.
> It works that out by reading your CSS: if your rules say
> `rgba(var(--callout-color), …)` you get a triplet, and if they say
> `color-mix(…, var(--callout-color) …)` you get a colour, on the same Obsidian
> either way. So a theme that predates 1.13 keeps working, and one written for
> 1.13 is not held back by it.
>
> Two things to know if you are writing a theme today:
>
> - **Be consistent.** The read spelling is decided by majority across your whole
>   sheet, so a handful of rules in the other convention will break — and they
>   break silently, because an unparseable `var()` substitution unsets the
>   property rather than raising anything.
> - **A bare `.callout { background-color: … }`** — no guard, no id — tells the
>   plugin you are painting every callout's background yourself, and it will stop
>   supplying its own. Put a guard on it (a body class, a `[data-callout=…]`) if
>   you meant it as a default rather than a decision.

- **Case and spacing do not matter.** `[data-callout~=Metadata i]` is read as
  `metadata`; `[data-callout="my note"]` as `my-note` — the same normalisation
  Obsidian applies when it writes the attribute.
- **`@media`, `@supports` and `@layer` wrappers are descended into.**
- **A rule that sets nothing still claims the id.** `[data-callout="x"] {}` is a
  claim, and so is one whose body holds nothing but nested rules.
- **Nesting costs nothing.** A nested selector is resolved against its parent
  before anything is read, so `.callout-icon { … }` inside your callout rule is
  scanned as `…[data-callout="x"] .callout-icon`, at that selector's real
  specificity. Nested `@media` and `@supports` blocks hand their declarations
  back to the rule around them.
- **Body-class scoping still claims.** `body.my-style-settings-class
  [data-callout="y"]` claims `y` whether or not that class is currently applied.
- **Light and dark variants both claim the same id**, so a callout styled only
  in `.theme-dark` is still owned in light mode. What the *swatch* shows is the
  current appearance mode only — see
  [Limitations](#limitations-and-edge-cases).

### Patterns that prevent discovery

| Pattern | Effect |
| --- | --- |
| `[data-callout*="col"]`, `^=`, `$=`, `\|=` | Kept as a family pattern, never listed as a callout type — a pattern names no id. Intended, and the editor warns a user whose id would be caught |
| `:not([data-callout="note"])` | An anti-claim; dropped |
| `.callout-recite`, or any class-only convention | Not a `data-callout` claim; invisible |
| `[data-callout]` alone | Names nothing |
| Callout CSS delivered by `@import`, or injected by a companion plugin | Not in the theme's `<style>` element, so not scanned |
| Callout ids produced at runtime (e.g. `--callout-icon: attr(data-callout)`) | Unbounded id space; nothing static can enumerate it |

> [!NOTE]
> **Native CSS nesting used to be on this list, and is not any more.** The
> walker treated any body containing a `{` as a wrapper and descended past the
> rule that owned it, so a rule that both declared something and nested a child
> lost its claim outright. Measured across the 257 themes installed in the dev
> vault, seven write callout rules that way, and *Minimal Dracula* — which
> nests all of them — was read as having no callout rules at all. Resolving
> nesting recovered 16 callout ids across three themes (Minimal Dracula's 13,
> Brainhack's `brainhack` and `1`, Underwater's `box`) and four family
> patterns, and corrected the `!important` escalation measurement for five
> themes. Nothing that was already detected changed. If you support an older
> Callout Studio, a flat rule per id is still the safest spelling.

### Backgrounds you deliberately remove

If your theme gives callouts no background of their own — a flat or outlined
design where the colour lives in the icon, the title and a frame — write it on a
selector that names no id and Callout Studio will follow it for the callouts its
users invent:

```css
/* read, and followed */
.callout                       { background-color: transparent; }
body.my-flat-callouts .callout { background-color: unset; }
```

The guard is kept and re-stated, so a Style Settings `class-toggle` works live in
both directions with nothing to reload. Four things stop it being read: a child
combinator (`body > .callout`), an id or attribute in the guard, a value that is
not one of `transparent` / `unset` / `initial` / `revert` / `rgba(0,0,0,0)` — or
`background: none` for the shorthand — and naming a `data-callout` id, which says
nothing about a callout you have never heard of.

If you also frame the callout through `.callout-title` / `.callout-content`
borders and leave the colour to `currentColor`, Callout Studio supplies the
callout's own accent so your frame is coloured rather than drawn in body text.
**State a colour yourself and it will not touch it** — `border-color:
color-mix(in srgb, var(--callout-color) 40%, transparent)` beside your
`border: 2px solid` is enough, reads better in your own callouts too, and is
what Shiba Inu does.

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
- **Style Settings' own `<style id="css-settings-manager">` is invisible** to
  `themeCss()` and `enabledSnippetCss()`, so the accent dialect is not re-derived
  when an option changes. That is correct rather than a gap: Style Settings
  changes body classes and variable *values*, never read sites. Two themes in the
  dev vault expose a `--callout-<type>` as a settable variable — Iridium, and
  Tokyo Night, which offers a `variable-themed-color` picker for all thirteen —
  and both are colour-dialect with colour pickers, so the spelling stays
  consistent whatever the reader picks. It does fire `css-change`, so the pass
  runs and comes out byte-identical — which is the point: the theme's guarded
  rules take effect live, with nothing re-injected.

  Verified end to end in the cascade harness: overriding Tokyo Night's
  `--callout-default` to `#00cc44` moves an unmodified built-in's box, title,
  `--cs-accent` and heading bar to that green, on the same generated sheet, while
  a user-coloured callout beside it does not move at all. That split is the whole
  contract — the theme's variables stay the theme's, the user's colour stays the
  user's.
- **The accent dialect's `read` is one answer per sheet, while ownership is per
  id.** A theme that mixes both spellings loses its minority: Aura 1 read of 18,
  Cyber Glow 1 of 16, Ultra Lobster 3 of 36. There is no per-callout answer
  available from a text scan and no plan to invent one.
- **An HSL triplet satisfies neither dialect.** Slytherin and Buena Vista read
  `hsla(var(--callout-color), …)`; sQdthOne never mentions a callout variable at
  all but redefines Obsidian's own `--color-blue` &c as bare HSL triplets, which
  breaks core's `--callout-default: var(--color-blue)` chain from underneath.
  An HSL read is counted as triplet evidence, the closer of the two, and
  `--cs-accent-theme` degrades to its registered grey.

  Both were swept in the browser with the generated sheet **and without it**, and
  the computed styles are identical: the box, the border and the title colour are
  already broken on stock Obsidian 1.13, and this plugin neither causes that nor
  makes it worse. The same is true of **Shiba Inu**'s `failure`, whose
  `--color-red: rgb(var(--red))` fails two hops above anything a callout scan can
  see. A third `hsl-triplet` spelling would fix the first group — `hexToHsl` is
  already in `colorUtils` — but it changes what goes *into* `--callout-color`, so
  it is a design decision rather than a patch, and it is deliberately not taken
  here. Nothing else in the 257 greys out.
- **A runtime probe could answer `declared` exactly.** `ThemeAppearanceProbe`
  already reads computed styles through an injectable reader; registering a
  sentinel `@property`, assigning the theme's variable to it and reading it back
  would see Style Settings, snippets and `var()` chains for free. It is rejected
  for now because it is asynchronous and cannot answer `read` at all — that would
  still need the text scan — but it is the documented upgrade path if the scan
  ever proves too coarse.

## Checking a theme against the real cascade

`npm test` cannot see this. Its DOM is a stand-in and its `obsidian` module is a
stub, so it can assert **what CSS is emitted** but never **which declaration
wins** — and every question in this chapter is a cascade question. The answer is
to replay the cascade in headless Chrome and read computed values. It takes
minutes, needs no Obsidian launch, and is what every measurement above was
settled with.

The page is built from real files, in the order Obsidian puts them in `<head>`:

```
app.css  →  the plugin's styles.css  →  theme.css  →  enabled snippets
         →  <style id="css-settings-manager">  →  the generated sheet
```

Eight things that are easy to get wrong, and each one silently invalidates the
result:

- **Extract `app.css` from the *running* asar** — `~/Library/Application Support/obsidian/obsidian-<v>.asar`, not the copy inside `Obsidian.app`, which lags badly. The two disagree about whether `--callout-color` is a triplet or a colour, which is the whole subject.
- **Link every sheet, never inline it into a `<style>`.** Several installed themes — Border, NeuBorder, Tokyo Night, Poimandres Extended, Glass Robo and Olivier's Theme — carry a literal `</style>` inside their Style Settings YAML comment; inlined, that ends the element early and Chrome parses 301 of Border's rules and silently drops the rest, including the entire `callout-style-N` family. It is not only a callout question: inlined, Glass Robo lost the `--modal-background` its whole window is painted with, and read as a theme with no surface at all. Obsidian assigns theme CSS through `styleEl.textContent`, which never re-enters the HTML parser.
- **Publish theme ownership.** `registerThemeAppearance` hands `registry.setThemeOwnedIds` every id the theme names, built-ins included, so `standsDown` silences the plugin for them. Measuring without it measures a configuration that cannot occur.
- **Model Style Settings exactly.** Class toggles and class selects add classes to `<body>`; variables land in `body.css-settings-manager` and `body.theme-{light,dark}.css-settings-manager`, in a `<style>` appended last to `<head>`. Read them out of the theme's own `/* @settings */` YAML rather than guessing.
- **Read numbers, not pixels.** Without real CodeMirror the layout collapses, so a screenshot lies where `getComputedStyle` does not. (Settings-pane questions are the exception: that DOM is plain markup and a screenshot of it is real — which is how the sticky band's paint was verified pixel-identical before and after a change.)
- **Put only the classes a default install has on `<body>`.** `is-translucent` is a setting that is off by default, and a theme is free to key its whole see-through look off it; measuring with it on measures somebody else's install. `theme-{dark,light}`, `mod-macos`, `is-focused` — and `is-mobile is-tablet` / `is-mobile is-phone` when the question is a mobile one, which for anything painted per device it usually is.
- **Do not use `--virtual-time-budget`.** Virtual time does not advance while an animation is running, so any theme with one hangs the run until it is killed, and a sweep across every installed theme will hit several. The page has no async work of its own: `--dump-dom` after the load event is enough, with a wall-clock timeout per run.
- **A rule walk needs a `try` around every rule, and still cannot see a nested one.** Reading `document.styleSheets` to find *which* declaration won is the natural follow-up to a surprising computed value, and it has two traps: one unusual rule type throws and takes the rest of that sheet's rules with it unless each is caught on its own, and `el.matches(rule.selectorText)` throws outright on a nested rule, whose `selectorText` starts with `&`. A theme written with CSS nesting then looks like it has no opinion at all — Lagom's `background-color: transparent !important` on settings headings, nested under `.mod-settings`, was invisible that way, and it is the reason the band's paint could not be fixed with an `!important`.

Three assertions carry most of the value:

| Check | What a failure means |
| --- | --- |
| no built-in's `--cs-accent-theme` computes to `rgb(125, 125, 125)` | the `@property` grey initial — the spelling handed to it did not parse. Skip rows with no `--cs-color-rgb`: those are theme-owned, where the plugin emits nothing by design |
| `--cs-accent` agrees with the `--callout-color` the page computed | this plugin's own surfaces have drifted from the box the theme painted. Compare rounded channels, not strings — Maple serialises `rgba(5.202, 132.8822, 168.198, 1)` for the same colour |
| render the same DOM with the generated sheet **and without it**, and diff | every property that moved should be one the user chose. Anything else is an over-reach; anything expected and missing is an under-reach |

That last one is the sharpest instrument in this chapter: it turns "does this
theme still look right?" into a list of named properties, and it is how the
`PAINTERS` and per-mode bugs above were both found and proved fixed.

## What the most-tested themes do

Measured from each theme's own CSS, not from screenshots. "Read dialect" is what
the accent scan concludes; "neutral" means the theme never reads or declares a
callout accent variable, so nothing about this machinery is visible in it.

| Theme | Callout rules | Read dialect | Guard classes (Style Settings) | Notes |
| --- | --- | --- | --- | --- |
| AnuPpuccin | ~25 | **triplet** | `anp-callout-{vanilla-normal,vanilla-plus,sleek,block}`, `anp-callout-color-toggle` | layout rules generic, colour rules a 28-id allowlist. Sets `--callout-blend-mode: normal` globally. Carries one `!important` callout rule, which lifts the studio weight to 5 |
| Obsidian gruvbox | 2 | **triplet** | none | unguarded `.callout` background at `(0,1,0)` — the suppression case. Declares `--callout-<type>` through a triplet `var()` chain — the grey-accent case |
| Blue Topaz | ~120 | colour | `admonition-bg-color-same`, `border-callout-style`, `shade-callout-style`, `full-width-callout` | `.callout` background is `var(--admonition-bg-color)` (`#11111100`), not accent-derived |
| ITS Theme | ~300 | colour | `callout-{original,block,alternate-line,bordered}`, `callout-no-metadata` | selectors up to `.callout×6` = `(0,6,0)`; private palette; large `[data-callout-metadata~=…]` grammar |
| Minimal | 4 | neutral | `callouts-outlined`, `callout-blend-mode` | never reads `--callout-color` at all |
| Wasp | 0 | neutral | none | sets `--callout-title-color` and nothing else |
| Obsidian Nord | 0 | neutral | none | no callout rules |
| Typewriter | 1 | neutral | none | list padding inside callouts only |
| Things | 0 | neutral | none | no callout rules |
| Atom | 0 | neutral | none | predates callouts entirely |

A second round, measured the same way and verified in the browser against the
real cascade (`app.css` → `styles.css` → theme → snippets →
`<style id="css-settings-manager">` → the generated sheet):

| Theme | Callout rules | Read dialect | Style Settings that reach callouts | Notes |
| --- | --- | --- | --- | --- |
| Primary | 36 | **triplet** | none | reads `rgba(var(--callout-color))` and sets `--callout-color: var(--callout-rgb-<id>)` **per id**, so it names all 28 and owns them. Unguarded `.callout` background, padding and box-shadow — all three suppressed in the shim |
| Sanctum | 81 | **triplet** | `callout-border-width`, `callout-border-opacity` (`format: '%'`) | one bare `.callout` rule carrying `border` **and** `background-color`. The `border` shorthand is why `PAINTERS` exists — see [06](06-css-generation.md#the-core-accent-shim) |
| Catppuccin | 27 | colour | none (its 8 blocks are accent/flavour) | `.callout` at `(0,1,0)`: 10% background, 60% border, both from `--callout-color`. Follows a chosen accent exactly |
| Willemstad | 358 | colour | 43 options — `ssopt-callout-style` (Willemstad / IBM Carbon), `ssopt-callout-standard`, `callout-border-left-extra`, infobox / aside / columns / gallery families | per-side border colours (its left stripe) all follow the accent; 12.5% tint |
| Prism | 47 | colour, **0 reads** | `pt-disable-callout-styling` | `background-color: unset` on every callout at `(0,3,1)`, then paints `.callout-title` / `.callout-content` from its own palette per id. A preset colour leaves that alone; a Saved Palette wins it, as designed |
| Border | 9 | colour, 0 reads | `callout-style-select` (`callout-style-1…4`) + 11 layout variables | the style classes land on `<body>`, so `--callout-border-width: 0 0 0 4px` with opacity 1 gives a 4px left stripe **in the user's colour** |
| Tokyo Night | 9 | colour, 0 reads | same `callout-style-select` family, plus `variable-themed-color` for all 13 `--callout-<type>` | the live-update case above |
| GitHub Theme | 5 | colour, 0 reads | `callout-on` (**default true**) | `body.callout-on .callout` at `(0,2,1)`: transparent background, grey `border-left`. A preset colour keeps both; only the accent-derived properties move |
| Shimmering Focus | 21 | colour | none callout-named | tints `.callout-title` at 15% and its bottom border at 25% from the accent — both follow the user's colour |
| Cybertron | 7 | colour, 0 reads | none | nothing accent-derived of its own; core's defaults carry the colour |
| Everforest | 0 | colour | none | palette only: declares all 13 `--callout-<type>`, which an unmodified built-in follows through `--cs-accent-theme` |
| Dracula for Obsidian | 0 | colour, 0 reads | none | no callout CSS at all — the pure-neutral case, byte-identical to a vault with no theme |

## Where the code lives

| File | Responsibility |
| --- | --- |
| [`manager/theme/customCssApi.ts`](../src/manager/theme/customCssApi.ts) | The only place `app.customCss` is named |
| [`manager/theme/cssBlocks.ts`](../src/manager/theme/cssBlocks.ts) | Cutting the sheet into rules, with native CSS nesting resolved |
| [`manager/theme/themeCalloutScan.ts`](../src/manager/theme/themeCalloutScan.ts) | Pure text scanner: claims, patterns, weights |
| [`manager/theme/themeClaimLookup.ts`](../src/manager/theme/themeClaimLookup.ts) | "Does this sheet style the id I already have?" |
| [`manager/theme/accentDialectScan.ts`](../src/manager/theme/accentDialectScan.ts) | Reading ONE sheet: reads, declarations per mode, what it paints unguarded |
| [`manager/theme/accentDialect.ts`](../src/manager/theme/accentDialect.ts) | Folding every sheet's evidence into the one answer the emitters consult |
| [`manager/theme/accentValueFormat.ts`](../src/manager/theme/accentValueFormat.ts) | Is one declared value a colour or a triplet, following `var()` |
| [`manager/css/coreAccentShim.ts`](../src/manager/css/coreAccentShim.ts) | Core's own declarations, restated when the spelling breaks them |
| [`manager/theme/ThemeCalloutStore.ts`](../src/manager/theme/ThemeCalloutStore.ts) | Caching + the enumeration/weight split |
| [`manager/theme/ThemeFacts.ts`](../src/manager/theme/ThemeFacts.ts) | Owned ids + measured appearances, held behind the registry |
| [`manager/theme/themeAppearanceSync.ts`](../src/manager/theme/themeAppearanceSync.ts) | Scheduling, ordering, the fingerprint, the probe's lifetime |
| [`manager/theme/ThemeAppearanceProbe.ts`](../src/manager/theme/ThemeAppearanceProbe.ts) | Offscreen render + cache |
| [`manager/theme/readCalloutStyle.ts`](../src/manager/theme/readCalloutStyle.ts) | Which node answers which property |
| [`manager/theme/themeAppearance.ts`](../src/manager/theme/themeAppearance.ts) | Accent/background interpretation |
| [`manager/theme/themeIcon.ts`](../src/manager/theme/themeIcon.ts) | The five-rung icon ladder |
| [`manager/theme/renderThemeIcon.ts`](../src/manager/theme/renderThemeIcon.ts) | Reproducing a measured icon |
| [`manager/theme/calloutListIcon.ts`](../src/manager/theme/calloutListIcon.ts) | One answer for every small callout list |
| [`manager/theme/studioWeight.ts`](../src/manager/theme/studioWeight.ts) / [`StudioWeightCache.ts`](../src/manager/theme/StudioWeightCache.ts) | How hard the plugin pushes on what it *does* own |
| [`manager/theme/themeReport*.ts`](../src/manager/theme/themeReport.ts) | The `themes:report` worksheet — not bundled into `main.js` |
| [`settings/sections/rowOwnership.ts`](../src/settings/sections/rowOwnership.ts) | Which of the three lists a row belongs in |
| [`settings/sections/themeRowActions.ts`](../src/settings/sections/themeRowActions.ts), [`themeRowUsage.ts`](../src/settings/sections/themeRowUsage.ts) | The theme row's controls and its cached use counts |
| [`settings/ThemeCalloutPreviewModal.ts`](../src/settings/ThemeCalloutPreviewModal.ts) | The read-only window behind the pencil |

Suites: `themeCalloutScan`, `themeOwnership`, `manualDiscovery`,
`themeRowSync`, `themeAppearance`, `themeAppearanceProbe`, `themeRowActions`,
`themeReport`, `cssSpecificity`.

---
Next chapter: [00-index.md](00-index.md)
