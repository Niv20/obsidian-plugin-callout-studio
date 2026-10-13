# Theme callout discovery

How Callout Studio finds out which callout types the **active Obsidian theme**
supplies, what those callouts look like, and what it then does with that
knowledge for an existing or manually discovered type: a row under *Callouts from your theme*, an entry in *Quick insert
block callout*, and - deliberately - no CSS of its own.

This chapter has two audiences, and they want different halves of it:

- **Contributors** touching `src/manager/theme/`, the registry's ownership
  facts, or any surface that draws a callout it does not paint. Read straight
  through.
- **Theme authors** who only need to know how to write callout CSS that
  Callout Studio reads correctly. Skip to
  [For theme authors](#for-theme-authors); everything before it is the
  derivation behind that advice.

Everything here is *discovery* - finding and reading the theme. What the plugin
**emits** (or refuses to emit) once ownership is decided is
[06-css-generation.md](06-css-generation.md), which owns the emission gate, the
`!important` argument and the selector-weight arithmetic.

The whole subsystem answers one rule, and the rule is not a setting:

> **If the active theme names a callout's id, the theme owns that callout.**
> Callout Studio emits nothing aimed at `.callout` for it, lists it under
> *Callouts from your theme*, shows what the theme actually draws, and offers
> it in the Block format only.

For a callout with aliases, "names its id" means every one of its names - a
built-in's stock aliases excepted. A theme that names only some of them gets
those names' block callouts and nothing more; see
[Stage 3](#stage-3---ownership).

"Names" is checked against the page, not just the text: a name counts only
while a rule naming it is in force, and a built-in or one of the user's
callouts moves to the theme only while that rule visibly changes it. See
[Naming is not drawing](#naming-is-not-drawing---the-claim-check).

## The pipeline, end to end

Six stages, plus one question answered off to the side. Each is a separate
module because each has its own failure mode, and several of them have to
happen in this order.

| # | Stage | Module | Output |
| --- | --- | --- | --- |
| 1 | Find the active theme and its CSS text | [`customCssApi.ts`](../../src/manager/theme/customCssApi.ts) | theme name, stylesheet text, snippet texts, a cheap signature |
| 2 | Scan that text for callout claims | [`cssBlocks.ts`](../../src/manager/theme/cssBlocks.ts) → [`themeCalloutScan.ts`](../../src/manager/theme/themeCalloutScan.ts), cached by [`ThemeCalloutStore.ts`](../../src/manager/theme/ThemeCalloutStore.ts) | `Map<attrId, ThemeClaim>` + family patterns |
| 3 | Check the names against the page, then publish ownership | [`ThemeClaimCheck.ts`](../../src/manager/theme/ThemeClaimCheck.ts) + [`themeClaimRules.ts`](../../src/manager/theme/themeClaimRules.ts) + [`themeClaimSelectors.ts`](../../src/manager/theme/themeClaimSelectors.ts) + [`themeClaimEffect.ts`](../../src/manager/theme/themeClaimEffect.ts), then [`ThemeFacts.ts`](../../src/manager/theme/ThemeFacts.ts) via `CalloutRegistry.setThemeOwnedIds` | `registry.themeOwns(def)` |
| 4 | List theme ids locally; persist only explicit scans/imports | [`themeOverlayRows.ts`](../../src/manager/theme/themeOverlayRows.ts), [`ManualCalloutDiscovery.ts`](../../src/manager/ManualCalloutDiscovery.ts) | Ephemeral theme rows or durable definitions |
| 5 | Measure what the theme actually draws | [`ThemeAppearanceProbe.ts`](../../src/manager/theme/ThemeAppearanceProbe.ts) + [`readCalloutStyle.ts`](../../src/manager/theme/readCalloutStyle.ts) + [`themeAppearance.ts`](../../src/manager/theme/themeAppearance.ts) / [`themeIcon.ts`](../../src/manager/theme/themeIcon.ts) | `ThemeAppearance` per id |
| 6 | Reproduce it wherever the plugin lists callouts | [`renderThemeIcon.ts`](../../src/manager/theme/renderThemeIcon.ts), [`calloutListIcon.ts`](../../src/manager/theme/calloutListIcon.ts) | icons and swatches on rows, menus, pickers |
| - | Decide how the theme **spells** a callout accent | [`accentDialectScan.ts`](../../src/manager/theme/accentDialectScan.ts) + [`accentDialect.ts`](../../src/manager/theme/accentDialect.ts) + [`accentValueFormat.ts`](../../src/manager/theme/accentValueFormat.ts), cached alongside stage 2 | `AccentDialect` - see [The accent dialect](#the-accent-dialect) |

Scheduling - when the whole thing runs and in which order - is
[`themeAppearanceSync.ts`](../../src/manager/theme/themeAppearanceSync.ts), covered under
[When theme appearance refreshes](#when-theme-appearance-refreshes).

Two of these stages are deliberately split into a **pure half and an
impure half**, the same way twice: `themeCalloutScan` (pure text) sits under
`ThemeCalloutStore` (caching), and `themeAppearance` + `themeIcon` (pure data)
sit under `ThemeAppearanceProbe` (DOM). The pure halves carry all of the
judgement and all of the unit tests; the repo's test DOM has neither a
`CSSStyleSheet` nor a cascade, so anything that needed one would be untestable.

## Stage 1 - Finding the active theme

[`customCssApi.ts`](../../src/manager/theme/customCssApi.ts) is the **only** place
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
| `stylingSignature(app)` | `name@version` + the enabled snippet names - a cheap identity for "the styling currently loaded" |

Two traps this module exists to absorb:

- **`extraStyleEls` is index-aligned to the *enabled* subset**, not to
  `snippets`. A vault with snippets `[a, b, c]` and only `c` enabled has a
  single element at index 0.
- **`stylingSignature` is deliberately not a hash of the CSS.** It is used to
  decide whether a re-scan is needed, and hashing a megabyte to find out costs
  about as much as re-scanning it. The miss is a theme *edited in place* and
  reloaded, which moves neither name nor version - see
  [the fingerprint](#when-theme-appearance-refreshes).

> [!NOTE]
> Only the text inside that one `<style>` element is ever scanned. Anything a
> theme brings in some other way - an `@import`, a stylesheet a companion
> plugin injects - is invisible to enumeration, though the
> [appearance probe](#stage-5---reading-the-colours-and-the-icon-back) still
> measures its effect, because that reads the rendered page rather than the
> text.

## Stage 2 - Scanning the stylesheet for callout claims

[`themeCalloutScan.ts`](../../src/manager/theme/themeCalloutScan.ts) is pure text
in, plain data out. The obvious implementation is to `replaceSync()` the theme
into an unadopted `CSSStyleSheet` and walk `cssRules` - which is what Callout
Manager does - but `CSSStyleSheet` does not exist in this repo's test DOM, and a
scanner nobody can test is how a wrong answer ships. Comments are stripped up
front and blocks are walked by brace depth, which is what the CSSOM was really
buying.

Comment removal and brace boundaries respect quoted strings and escaped
punctuation. Literal braces in `content`, attribute selectors or SVG data URLs
do not hide later rules or become false nested blocks.

Cutting the sheet into rules is its own module,
[`cssBlocks.ts`](../../src/manager/theme/cssBlocks.ts), which hands the scanner one
`(selector, declarations)` pair per rule. It resolves **native CSS nesting**
first, so a nested sheet is read exactly as its flat equivalent would be - same
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
limitation is not a gap to be closed by better parsing - it is why
[stage 5](#stage-5---reading-the-colours-and-the-icon-back) exists.

### Which operators name a callout

Enumeration may only read the operators that name **exactly one** id.

| Selector | Enumerated as an id? | Why |
| --- | --- | --- |
| `[data-callout="recite"]` | **yes** | Names one callout |
| `[data-callout~="infobox"]` | **yes** | Matches a whitespace-separated word list, and Obsidian writes only the *type* into `data-callout` (metadata goes to `data-callout-metadata`), so that list is always one word |
| `[data-callout*="column"]` | no - a *family pattern* | Says "everything containing this"; reading it as an id invents a callout named *column* that nobody has |
| `[data-callout^="col"]`, `[data-callout$="-md"]`, `[data-callout\|="col"]` | no - family patterns | Same reason |
| `[data-callout]` | no | Names nothing |
| `.callout`, `.callout-recite` | no | Not an attribute claim at all |

Including `~=` was a **measured** decision, not a liberty: ITS Theme declares
`infobox`, `cards`, `timeline`, `aside` and `kanban` that way and no other way,
so excluding it hid the five types its users reach for most.

Family patterns are kept - in `ThemeScan.patterns`, with `certain: false` - but
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
| `:not([data-callout="note"])` | **dropped** - an anti-claim is not a claim (`blankNegations`) |
| `[data-callout=recite i]` | claimed; the case-insensitivity flag is tolerated |
| `[data-callout~=Metadata]` | claimed as `metadata` - keys are normalised |
| `[data-callout="my note"]` | claimed as `my-note` |
| `[data-callout="x"] { }` | **claimed** - an empty rule body still names the id |
| `body.some-style-settings-class [data-callout="y"]` | **claimed** by the text scan; while `<body>` lacks the class, [the claim check](#naming-is-not-drawing---the-claim-check) drops it |
| `[data-callout="I"]` (uppercase, no `i` flag) | **not claimed** - Obsidian lower-cases the type, and the attribute compares case-sensitively, so no rendered callout matches (Serenity writes `"I"` and `"S"`) |
| Anything inside a `/* … */` comment | not claimed |
| A string a raw newline cuts short (Blue Topaz's `content: '\A\9\9'';`) | ends at the newline, as in the browser (`skipString`) - before, it swallowed the rest of the theme and no later rule was read (see *Blue Topaz, read to the end* below) |
| An escaped newline inside a string (`\` then LF, or CRLF from a theme saved on Windows) | a line continuation: the string goes on, CRLF counting as one newline as CSS preprocesses it |
| Native CSS nesting - a rule that names an id **and** nests child rules | read as its flat equivalent: the parent's own declarations are its claim, and each nested rule is resolved against it (`&`, or the implied descendant) |
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
it. That is correct for its own question - such a rule claims no id - but it is
exactly the rule the core accent shim has to know about: Obsidian gruvbox's
entire callout section is `.callout { background-color: rgba(var(--callout-color), 0.2) }`
at `(0,1,0)`, which ties the shim and would lose on source order alone.

`accentDialect.ts` therefore runs its **own** walk rather than extending this
one, pre-filtered on `.callout` rather than `data-callout`, and records the
properties declared on a compound that is `.callout` (optionally repeated) **and
nothing else**. Anything with a guard on it - a body class, a
`[data-callout-metadata*=…]`, an id - is deliberately not recorded: it is
conditional, so it says nothing about callouts in general, and when it does
apply its extra class-unit already beats the shim.

### The generic callout surface

A third question off the same text, and the mirror image of ownership: **what
does the active styling say about a callout it has never heard of?** Every
callout this plugin invents is one of those, and several installed themes
answer with some form of "a callout has no background of its own".

[`calloutSurfaceTarget.ts`](../../src/manager/theme/calloutSurfaceTarget.ts) reads
the selector, [`calloutSurfaceScan.ts`](../../src/manager/theme/calloutSurfaceScan.ts)
reads the declarations, and
[`calloutSurface.ts`](../../src/manager/theme/calloutSurface.ts) folds several
sheets into the answer `StudioWeightCache.surface()` memoises beside the dialect.
`ThemeCalloutStore.refresh()` runs it on the theme **and** every enabled snippet,
for the same reason the dialect does: what has to work is what is on the page,
whoever wrote it.

Three kinds of fact come out. Background and fill claims keep the **guard** and
conditions on the callout root; frame claims keep the ancestor guard:

| Fact | Recorded when | Examples |
| --- | --- | --- |
| `neutralBackground` | a generic `.callout` rule removes the root background, or paints a neutral root while a matching title rule uses `--callout-color`; the root's CSS value is retained | GitHub Theme, Prism, AnuPpuccin Vanilla Normal/Plus/Sleek, Soft Paper |
| `fills` | a generic rule fills the title or content box, or lays a pseudo-element over a whole box; each records whether it reads the accent, whether it is opaque or picks the title's ink, and whether it carries its own `opacity` | AnuPpuccin's stripe, Cyber Glow's two boxes, Glass Robo's badges, Ultra Lobster's `::after` layer |
| `colorlessFrame` | a generic `.callout-title` / `.callout-content` rule uses a `border` shorthand with a line style and **no colour token** | Prism, Cybertron |

`fills` reads [`boxFillTargetOf`](../../src/manager/theme/calloutSurfaceTarget.ts):
the child box after a child or descendant combinator, or with no callout root
above it at all (Composer writes `.composer--WindowPanelCallout .callout-title`),
plus an optional `::before`/`::after` in either spelling. A child qualified any
other way - `:hover`, `:active`, `:empty` - is refused: Cyber Glow brightens its
title on hover, and a background moved onto the title because of that would be
painted permanently. A pseudo-element counts only when its own rule pins it over
the whole box - `inset: 0`, `100%` × `100%`, every side zero, or TerraFlow's
`inset-block-start` / `inset-inline` / `inset-block-end` - so a 3px accent bar, a
dot or a dog-eared corner never reads as a fill. `calloutSurface.ts` folds them
into the three lists the emitter uses (`relocations`, `inkedTitles`,
`surfaceLayers`); see
[06-css-generation.md § The theme-owned surface](06-css-generation.md#the-theme-owned-surface).

`background-color: none` is deliberately *not* accepted: it is invalid and the
parser drops it, so reading it as "no background" would be believing a
declaration that never applied.

The **guard** is every selector step before the callout compound, verbatim - it
stops at the *last* `.callout` step, because this plugin replaces that step with
its own selector. Conditions on the callout root are kept on the generated
cancel. AnuPpuccin's Vanilla Normal rule excludes callouts marked
`anp-sleek`, `anp-vanilla-plus`, `anp-block`, or `revert`, while another branch
opts a callout into Vanilla Normal through metadata. Keeping those conditions
lets the theme's neutral content surface show only in the matching layout.

An ancestor guard is only recorded when every step is a plain compound - an
element name, classes, and `:not()`. A child combinator, an id, an attribute on
an ancestor, a universal selector or a pseudo-element **drops the fact
entirely**, because the guard is re-stated in front of a selector this plugin
writes. A positive callout-id condition also names a specific type rather than
a generic surface; callout metadata conditions can apply to any type and remain
attached to the root selector. This also covers themed metadata variants in
ITS Theme, Ukiyo, Willemstad, and flexcyon without affecting unrelated callouts.

What the emitter does with the pair, the global veto that Shiba Inu justifies,
and why this is a *cancel* rule rather than a suppression is
[06-css-generation.md § The theme-owned surface](06-css-generation.md#the-theme-owned-surface).

The corpus, for anyone re-measuring it: unguarded (Cyber Glow, Notation 2,
Polka); behind a `body:not(…)` the reader opts out of (Prism, Cybertron, LYT
Mode, Ultra Lobster); behind an opt-in class (GitHub Theme `callout-on`, Minimal
and Oxygen `callouts-outlined`, Composer, Glass Robo, Iridium, ITS Theme, Shiba
Inu, Typomagical, Underwater); behind a class and callout metadata conditions
(AnuPpuccin Vanilla Normal/Plus/Sleek). AnuPpuccin Sleek and Soft Paper also
provide neutral root colours paired with accent-tinted titles.

Where the colour goes instead, measured over every installed theme and every
callout-related Style Settings option alone and in pairs: a title stripe
(AnuPpuccin Sleek, Vanilla Normal, Vanilla Plus; Soft Paper; Composer's
WindowPanel; Iridium's default; Shiba Inu's first style), both boxes (Cyber
Glow), or a whole-callout `::after` (Ultra Lobster's line style, Glass Robo's
glow style). The rest of the neutral-root themes fill nothing else.

### The accent dialect

A separate question from ownership, answered from the same text: **which
spelling of `--callout-*` does this theme expect?** Obsidian 1.13 changed its
own accent variables from a bare RGB triplet to a full CSS colour, and a theme
that predates that change still reads `rgba(var(--callout-color), 0.1)` - which
a hex makes invalid at computed-value time, so the declaration silently unsets.
The consequences are visible and confusing: a missing background, a side accent
that does not draw at all.

Two answers, not one, because themes disagree with themselves:

- **`read`** - one answer per sheet, by majority of `var(--callout-…)` read
  sites. Decides what goes *into* `--callout-color`.
- **`declared`** - per variable **and per mode**, from the theme's own
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
scan. Getting one wrong is not a near-miss - `--cs-accent-theme` is registered
`<color>`, so the wrong wrapper falls back to its grey initial and takes every
heading bar, inline pill, ref token and icon tint on that built-in with it:

| Rule | Why |
| --- | --- |
| the answer is **per mode** | 10 themes declare an accent variable in one mode only. Nier puts all thirteen under `.theme-dark`, as triplets, leaving light mode on core's colours. `undefined` for a mode means "core supplies it there" |
| a chain that **leaves the sheet** falls back to the sheet's own `read` | Arcane ends on core's `--color-blue` (a colour); Aura, Nier and Vicious on `--color-*-rgb` (triplets). A stylesheet is consistent with itself - and Arcane is why this is the read dialect, not a `-rgb` name check |
| a declaration behind a **theme option** is ignored | Aura's `.aura-origin-layout` is one layout of three and not the default; TerraFlow's `.academia-theme` one palette of eleven. In the state almost everyone is in, the variable still holds core's value. A `:not()` guard is trusted - Velocity's `body:not(.disable-callout-styling)` is its *normal* styling - and so is `.callout` itself, where RetroNotes puts all fourteen |

Across the 257 themes in the dev vault: **36** read a triplet, **25** read a
colour, **0** tie. The remaining 196 never touch these variables and fall back
to core's own spelling, which makes their generated CSS byte-identical to what
it was before any of this existed.

See [Colour system § accent dialect](12-color-system.md#accent-dialect-version-drift-and-theme-drift)
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
| Operators | `=` and `~=` only | every operator - and generic rules that name no id but force, with `!important`, what the plugin forces on the callout's own boxes (`ThemeScan.genericImportant`) |
| Why | *Callouts from your theme* has to mean it - a snippet the user wrote is their own work, and a family pattern names no callout | The emitted CSS has to outrank whatever is on the page, whoever wrote it |

A third, laxer question - *does this stylesheet style the callout I already
have?* - is [`themeClaimLookup.ts`](../../src/manager/theme/themeClaimLookup.ts).
It is allowed to consult every operator because it is only ever handed an id the
registry already holds, so there is nothing left to invent. `patternMatches()`
is its production export (the editor's fuzzy warning); `claimForId()` is
exercised by the suites.

Both answers are memoised on `stylingSignature`, because parsing ITS Theme is
~850 KB of text.

### Metadata words

A fourth question has its own scanner, because it reads a different attribute:
*which `[!type|word]` words does the styling react to?* The `|` dropdown offers
them (see [10-editor-integrations.md](10-editor-integrations.md#metadata-suggestions-after-the-pipe)).
[`themeMetadataScan.ts`](../../src/manager/theme/themeMetadataScan.ts) reads every
`[data-callout-metadata<op>=word]` in the theme and the enabled snippets, through
the same `cssBlocks` walk; [`ThemeMetadataCatalog.ts`](../../src/manager/theme/ThemeMetadataCatalog.ts)
caches the result per `stylingSignature`, labelled with the theme's or the
snippet's name.

The operator is the point - it decides where the word may stand:

| Operator | Placement | Example |
| --- | --- | --- |
| `*=` | `anywhere`, either separator | flexcyon, Blue Topaz, Notation 2 |
| `~=` | `spaced` - a `\|` hides it | ITS Theme, Dune, Ribbons, Sanctum |
| `^=` / `$=` | `first` / `last` | Blue Topaz's `noicon`, Faded's `large` |
| `=` / `\|=` | `alone` | MagicUser, Ebullientworks |

A word matched several ways takes the most forgiving placement. A
`[data-callout…]` condition at the **top level of the same compound** guards the
word to that callout (ITS Theme's `friend` only on `[!kith]`); one inside
`:is()` is an alternative, not a requirement (Blue Topaz's
`:is([data-callout-metadata*=indent], [data-callout*=indent])`), and one on an
ancestor guards nothing. Family fragments (`bg-`, `-large`), empties and words
with whitespace are dropped; opt-outs named inside `:not()` are kept, and the
spelling is kept exactly, since no installed theme uses the `i` flag on
metadata.

The catalog answers one more question: which words the user's own snippets
style (`snippetWords()`, ASCII case folded). The metadata colours leave those
to the snippet - see [06-css-generation.md](06-css-generation.md#metadata-colours-typecolour).
Callout Studio's own exported snippet (`callout-studio-custom`) is skipped, as
its words are this plugin's colours, not the user's. Because a snippet edited in
place keeps its name, the catalog's freshness key adds each enabled snippet's
text length to `stylingSignature`.

### Blue Topaz, read to the end

Blue Topaz ships `content: '\A\9\9'';` - one quote too many - 85.6% of the way
into its theme. Before `skipString` ended a string at a raw newline, the scan
read that quote as opening a string that ran to the next `'`, unbalanced every
brace after it, and never reached the rest of the file. Run over all 257 themes
in the development vault, the fix changed exactly one theme's scan, Blue
Topaz's, and it changes what a Blue Topaz user sees on upgrade - correctly,
since it is what the theme always declared:

- It now **declares** `timeline`, `cloze`, `icon`, `stickies`, `stickies2` and
  `stickies3`. They become theme-owned (Stage 3): Callout Studio stops painting
  a callout of its own by those ids and leaves the theme's design, and heading
  and inline callouts of those ids stop rendering, as for every theme-owned
  callout. The user's rows stay saved; they come back if the theme stops
  claiming the ids.
- The ones the user has no row for are listed under **Callouts from your
  theme** (overlay rows).
- The heaviest `!important` rule the theme has reaches further, so studio mode
  emits at `.callout` x11 instead of x5 under Blue Topaz.

## Stage 3 - Ownership

[`ThemeFacts.ts`](../../src/manager/theme/ThemeFacts.ts) holds the two derived
theme facts - which ids are owned, and what they look like - and both are read
back through `CalloutRegistry`, because every surface that draws a callout
already has the registry. Threading a theme store through the eight surfaces
that draw an icon is eight chances for one of them to keep drawing the stored
one, which is exactly the bug this replaced.

```ts
registry.themeOwns(def)          // does the ACTIVE THEME name all of this callout?
registry.themeClaimsName(name)   // ...or this one spelling of it?
```

| | Reason | Listed under | Editable | Emits CSS |
| --- | --- | --- | --- | --- |
| `themeOwns(def)` | the active theme names every name | *Callouts from your theme* | no | no |
| some names claimed | the theme names some of them | the user's own lists | yes | block rules for the unclaimed names; token rules for all |

`themeOwns` is both the ownership fact and the emission gate for the callout;
`themeClaimsName` is the gate for each of its names. A saved personal-CSS flag
is no longer part of the definition model; ordinary snippets participate
through the cascade rather than by changing registry ownership.

Three properties of ownership, each of which was a decision:

**Ownership is per name.** `ThemeFacts.owns` walks `registry.vaultIdFormsFor(def)`
 - the id, its aliases, and each one's dasherized attribute form where no other
definition owns it - and needs the theme to name **every** one. A name it does
not name stays this plugin's, because nobody else would draw it: a theme that
styles `[data-callout="description"]` says nothing about the `[!описание]` the
user gave the same callout. Until issue #84 one claimed name handed over the
whole callout, which left such a name with no theme rule, no Studio rule, and
no fallback either (the name is known, so the fallback's `:not()` chain skips
it). The split this model abolishes is two painters on *one* rendered callout;
two names of one callout drawn by two painters is not that.

The exception is a built-in's **stock aliases** - `cite`, `tldr`, `hint` and the
rest of Obsidian's own synonyms, read from the shipped defaults, so an alias the
user added does not count as one. `CalloutRegistry.themeOwns` leaves them out of
the forms it hands `ThemeFacts`, so a theme that restyles `quote` owns Quote
without naming `cite`: once this plugin stands down, Obsidian's `app.css` still
draws `[!cite]`, exactly as before. It matters: of the 50 installed themes that
restyle a built-in by name, 22 leave out at least one of its synonyms (ITS
Theme names `quote` and never `cite`; Agate names nine of the thirteen ids
and no alias), and without the exception every one of those rows would leave
*Callouts from your theme*. A stock alias the theme names on its own
(Elegance's `tldr`) is still claimed: that block callout is the theme's, and
the rest of the built-in is this plugin's. The exception holds per name too
(`registry.leavesBlockName`): while the theme claims a built-in's id, its stock
aliases are left to Obsidian even when the user has added a name of their own
and the callout is no longer the theme's outright - adding `q` to Quote must
not start painting `[!cite]`.

A name the theme claims on a callout it does not own is the theme's in the
block format only. The heading and inline formats are this plugin's DOM, which
no theme selector reaches, so they keep the callout's design under every name;
the metadata dropdown follows the same split (`CalloutMetadataSuggest` offers no
colour for a claimed name's block callout). The callout editor says which names
the theme draws (`editor.namesFromTheme`), without blocking the save. It asks
the published claim (`registry.themeClaimsName`), never the text scan: a name
kept behind an option that is off, or one the claim check measured the theme
not to draw, is painted by this plugin, and saying otherwise would be false.
The same question picks the reason a taken primary id is refused - "your theme
supplies it" (`editor.idFromTheme`) only while the theme really draws it,
"already exists" (`editor.idExists`) when the row is the user's to edit.

**A generic `.callout {}` rule owns nothing.** Of the 257 themes installed in
the dev vault, only 63 name a callout id in `theme.css`; a large group styles
callouts without naming one. Counting those would hand the plugin's entire job
to the theme for rules that mostly set a radius.

**Derived, never stored - and the empty state is the safe one.** `CalloutRegistry`
takes no `App` and cannot see the theme when `load()` runs, so for the first
moments of a session - and forever in a test, an import or a headless run -
nothing is owned and the plugin styles everything. Standing *down* on that blank
would silently strip the styling from every callout the user has configured;
standing up cannot hurt anyone, because the worst case is painting a callout the
theme would also have painted, for one frame.

Writing `source: "theme"` onto a matching row instead would lose data three
ways: `getUserDefined()` excludes theme rows and feeds every backup, so the row
would silently stop being exported; the sweep's `stale` branch **deletes** an
uncustomized theme row on the next theme switch; and `importValidator` re-stamps
`source: "user"` on every import, so the flip would not even stay done.

### Naming is not drawing - the claim check

[`ThemeClaimCheck`](../../src/manager/theme/ThemeClaimCheck.ts) checks the
names the text scan found against the theme as the browser parsed it, in the
main window, every time the sweep runs: at startup, on every `css-change` the
theme, a snippet or Style Settings fires, and on `refreshThemeAppearance`.

It exists because naming is not drawing. Measured over the 65 installed themes
that name a callout - real Obsidian 1.14.4, each listed id's rules switched off
and the callout compared, light and dark, Reading view and Live Preview - 451
of the 1,292 rows those themes listed changed nothing on screen:

| Why the rule changed nothing | Rows | Examples |
| --- | --- | --- |
| behind a theme option that is off | 358 | Retroma (312, all inside `body.rtm-ss-retro-callout { … }`), Aura, Ultra Lobster, Shiba Inu, AnuPpuccin's Capacities types, Typomagical's quote |
| dead since Obsidian 1.13 made `--callout-color` a full colour | 31 | Origami's `rgb(var(--callout-color))`, Vicious, Velocity's `math-*` |
| restates what is already drawn | 29 | Catppuccin and Sandstorm re-declare core's own icons; PLN |
| drawn only in a context a lone callout lacks | 14 | Kakano's column children, Ukiyo's `col`, Dune's metadata variants, `note-toolbar` |
| named only through a synonym | 13 | the per-name rule above |
| not a callout at all | 4 | Velocity's `.lc-list-callout[data-callout="!"]`, the List Callouts plugin's markers |
| an uppercase value with no `i` flag | 1 | Serenity's `"I"` - now refused by the scan itself |
| only an invisible property | 1 | Brainhack's border colour on a borderless title |

Two checks, aimed where a wrong answer costs something:

- **Page conditions, for every id, synchronously inside the sweep.** An id
  whose every parsed rule asks `<body>` or `<html>` for something the page
  lacks right now (`pageRootFails`; a nested rule inherits its parent's) is
  dropped from what the theme declares - no ownership, no overlay row. Only a
  compound that *is* the page root is judged: a bare class such as
  `.aura-callouts` may come from the note's `cssclasses`, so it is never held
  against a rule here (the measurement below reads it as an option only when
  the theme's Style Settings block offers it). Style Settings fires
  `css-change` when an option flips, so Retroma's 312 types come back the
  moment its option is turned on. Not every class on `<body>` moves with an
  event - Obsidian toggles `is-focused` and `is-fullscreen` itself, and a
  plugin may set one of its own - so the sync also watches the `class`
  attribute of `<body>` and `<html>` (`watchPageClasses`, a `MutationObserver`
  on those two elements only) and re-derives ownership when the set of ids a
  page condition keeps off moves. A condition that moves with no event at all -
  `:has()`, which follows the whole document, and the user-action
  pseudo-classes (`:hover`, `:focus-within`, …) - is never judged: it cannot
  take a callout from the theme.
- **A measured difference, for ids that carry a design of their own** -
  built-ins, and callouts the user or another plugin made. Each is rendered offscreen
  in a note's ancestry - `.workspace-leaf-content[data-type="markdown"] >
  .view-content`, then `.markdown-reading-view > .markdown-preview-view` for
  Reading view - and cloned into Live Preview's (Obsidian's widget
  is `div.cm-embed-block.cm-callout > div.markdown-rendered > div.callout`;
  `.markdown-rendered` is a child there, not a class on the widget), read with every
  theme rule naming it switched off (`withoutName` rewrites the parsed
  `selectorText` to a value no callout can carry), read again with them back,
  and compared (`changesVisibly`). An id whose rules change nothing is
  published as not owned (`syncThemeOverlayRows`' `notDrawn`), so this plugin
  keeps painting it.
- **Only rules the measurement saw count** (`rulesSeen`). An id is judged at
  all only when every parsed rule naming it is either *in force* on a box of
  the rendered callout - its selector, nesting folded in (`resolveNested`) and
  pseudo-elements stripped (`stripPseudoElements`), matches one in either view,
  under every `@media`/`@supports` around it holding - or *switched off by the
  page*: a `<body>`/`<html>` condition it fails, or a class the theme's own
  Style Settings block offers (`styleSettingsClasses`, `optionGated`) that
  `<body>` does not carry. Any other rule may well draw where the offscreen
  render cannot reach - under a note's `cssclasses`, in an embed or a hover,
  on a folded callout, in a narrow window, in a `@container` - and a
  comparison that never saw it in force says nothing about it, so the id stays
  the theme's. Every category the measurement found (an option that is off, a
  dead `rgb(var(--callout-color))`, a restated icon, an invisible property) is
  a rule in force or an option off, so none of them is lost.

Theme-invented ids are not measured: they have no design here to lose, and many
are drawn only where a lone render cannot reach - Ukiyo's `col` inside a
`cont`, Dune's `[!leer|l]`. Measured alone they would leave the list and pick up
the fallback's look inside the theme's own layout. A saved scan row
(`source: "fallback"`) is left alone for the same reason: it is a copy of the
fallback's look, usually of exactly such a type.

Decisions in the measurement:

- **This plugin's CSS is off while it measures** (`CSSInjector.suspendOwnStyles`).
  A callout handed back is one this plugin paints; measured with that paint on,
  the theme's colour could never show, and the callout could never be won back
  when the user turns the option on.
- **Each pass is one synchronous run, batched** (`comparePass`). Every rule is
  back, and this plugin's CSS on, before the task ends, so no frame is painted
  without them. All ids of a pass are switched off together: one at a time made
  the browser lay the whole window out twice per id, a 1.5 s freeze on
  AnuPpuccin. Together can only add a difference (a rule naming one id that
  reaches another's callout), never hide one. Reading view first; only an id it
  shows no difference for is read again in Live Preview's ancestry, and the
  "rules on" side is read lazily, stopping at the first visible difference.
- **A theme's transitions are finished before each read** (`finishTransitions`).
  Switching a rule off starts any `transition` the theme put on the callout,
  and a value read right then is the one it had a moment ago - the difference
  hidden, the callout wrongly handed back. `styles.css` turns transitions off
  inside `.cs-theme-probe`, but a theme rule with `!important` and more weight
  wins that, so every CSS transition in the rendered callouts (pseudo-elements
  included, `getAnimations({ subtree: true })`) is jumped to its end after the
  rules go off and again after they come back. Keyframe animations are left
  alone: an infinite one cannot finish, and it reads the same both ways.
- **Passes are tasks of their own, in idle time** (`compare`, `nextIdleTask`).
  The check waits for an idle moment (`requestIdleCallback`, at most a second;
  a macrotask where a webview lacks it) after the `css-change` or the launch
  that started it, so the sweep's CSS pass and the check do not merge into one
  freeze, and Live Preview's pass waits for another. On a phone or tablet
  (`Platform.isMobile`) a pass holds at most eight ids, each batch its own task:
  more layouts in all, but no single freeze holding every built-in on a slow
  device. A `css-change` between passes drops the whole check (the generation
  moved), and between passes the page is whole. On a desktop theme switch the
  longest task stays at or below what it was before the check: AnuPpuccin 490 →
  321 ms, Retroma 13.6 s → 337 ms (its 312 overlay rows are no longer minted),
  measured before the passes were split, so now at most that.
- **Every doubt goes to the theme** - no parsed sheet, an id no parsed rule
  names, a rule the measurement could not see in force, a rewritten selector
  the browser refuses (it silently keeps the old one), a failed render. That is
  how ownership behaved before the check.
- **Verdicts belong to the theme, not to the styling.** They are keyed on
  `themeSignature` (name and version, no snippets), outlive any `css-change` of
  the same theme and are re-measured after it, so neither a Style Settings
  toggle nor a snippet switched on or off hands everything back for the length
  of a render; a theme switch swaps them for that theme's. This plugin's own
  `css-change` (`OWN_CSS_CHANGE` in `manager/ownCssChange.ts`) starts no check:
  the check switches this plugin's CSS off, so that CSS cannot change a verdict.
- **A name no pass has been asked about is measured on arrival**
  (`hasUnmeasured`). This plugin's own `css-change` starts no re-check of the
  styling, but a callout imported, made by another plugin, or given an alias
  the theme names is a new id with a design to lose, and it would count as the
  theme's until the theme next fired an event. The sync asks after every
  `css-change` and preview change whether any id it would measure was never put
  to a pass for the active theme - asked ids are remembered per theme, judged or
  not, so an id that cannot be measured is asked about once - and then requests
  a pass without invalidating one already in flight (`claimsNew`).
- **Verdicts are remembered on the device**
  ([`themeClaimCache.ts`](../../src/manager/theme/themeClaimCache.ts)). The
  first stylesheet of a launch is built before any pass can land, and with no
  verdicts every callout the theme names counts as the theme's - so a built-in
  Catppuccin names but does not draw lost its design at every launch until the
  check handed it back. Each completed pass saves its verdicts to vault-scoped
  `localStorage` (`<appId>-callout-studio-theme-claims-v1`, the last eight
  themes, callout ids only, written only when they moved), and `syncVerdicts`
  seeds from them whenever the active theme changes, including the first time
  `unstyled` is asked at startup. A signature whose version is not read yet
  (`Name@`) takes the newest entry for that name. The check still runs and
  corrects anything that moved.
- **A burst is one question, asked again when it quiets.** Dragging a slider
  or a Style Settings colour fires `css-change` once per step. The check is
  asked through the same `QuietGate`
  ([`utils/quietGate.ts`](../../src/utils/quietGate.ts)) that gates the
  appearance probe's re-read, so the two answer together: the first event of
  a burst is judged at once, so a theme switch lands the moment it happens;
  the rest fold into one more pass after 250 ms of quiet, or 2 s into a burst
  that never stops. A restyle (the theme or snippet text moved) and this
  plugin's own `css-change` are urgent and never wait. Measured over 180
  `css-change` events on Catppuccin in a real Obsidian: 10.5 s before the
  check existed, 26.7 s with a pass per event, 2.5 s with the gate.
  [When theme appearance refreshes](#when-theme-appearance-refreshes) has the
  rest of what a `css-change` costs.
- **Nothing outlives a pass.** Every rule and this plugin's CSS are restored
  in `finally`, a read that throws included; and since a rule left switched
  off would stay off until Obsidian reloaded the theme, a rule whose restored
  `selectorText` does not read back as written makes the check re-parse the
  theme from its own text (`reparseTheme`) - a last resort, as the browser's
  own serialisation always parses back. The render's owner (`Component`) is
  one per pass in both the claim check and the appearance probe, unloaded
  with the host, so whatever post-processors attach is not kept for the
  session. Custom properties are left out of the compared list
  (`everyComputedProperty`): `changesVisibly` never counts one, and a theme can
  define a thousand on `<body>`.
- **The probe hosts are left unpainted.** `CSSInjector.paintIcons` skips
  callouts inside `.cs-theme-probe`; painting there re-read a computed value
  after each DOM write, a style recalc per callout.

`changesVisibly` does not count: interaction and timing properties;
`--callout-color` itself (what it changes shows up in what reads it, and PLN's
triplet is another spelling of the same colour); a border colour on a side with
no border; SVG paint off the drawing; offsets of an unpositioned box; a
pseudo-element with no content either way; anything on a box hidden both ways.
`tests/themeClaimSelectors.test.ts` pins that judgement and the selector
rewriting, `tests/themeClaimCheck.test.ts` the switching.

## Stage 4 - The overlay, and adding theme types permanently

A theme-declared id with **no row at all** is also treated as unknown by
`generateFallbackCSS`, whose exclusion list is built from `getAll()`. The
fallback is deliberately weak now, so the theme's exact selector wins; however,
the fallback could still fill properties the theme leaves open, and the id would
remain absent from settings, autocomplete and the public API.

[`syncThemeOverlayRows`](../../src/manager/theme/themeOverlayRows.ts) closes that.
A sweep on startup, CSS events, or settings adoption mints an in-memory row in
`source: "theme"` for each declared id nothing else claims, and retires the ones
the theme has stopped declaring. It runs inside the same `registry.batch` that
publishes ownership, so listeners never see the two halves apart. An unchanged
stylesheet reuses the cached scan but still reconciles missing rows. Closing an
unsaved callout draft also reconciles the overlay: a theme enabled while the draft
was open must retain its type after the draft is cancelled, even with fallback CSS
disabled. The preview listener is removed on plugin unload.

**The overlay is add-or-remove only, and it never reaches `data.json`:**

| Guard | Where |
|---|---|
| Dropped from the saved payload, unconditionally | `discoveredRowPersistence.ts` |
| Out of `getUserDefined`, so out of exports | `CalloutRegistry.getUserDefined` |
| Never counted as "known", so a scan still sees the id | `knownCalloutIds.ts` |
| Never offered as the fallback target - that id **is** persisted | `settings/sections/FallbackSection.ts` |
| Never a merge base for an import | `utils/importedCallout.ts` |
| Never fetches artwork | `IconService.initialize`, `IconFetchManager.ensureAll` |
| Never keeps an `iconSvgCache` entry alive | `CalloutRegistry.cleanupUnusedIconSvgs` |
| Rebuilt by `resetAll` from the current owned ids and reset defaults | `CalloutRegistry.resetAll` |

Reset clears saved customizations, then rebuilds all current theme ids in one
notification. This includes ids previously held by saved user/fallback rows or
aliases. Temporary rows are rebuilt from defaults so they cannot retain references
to pictures or palettes that reset removed.

Because ownership is derived per machine, a laptop with a different theme holds
a different overlay and still writes the same settings body - the property
`syncThemeOverlay.test.ts` exists to pin. `tests/themeOverlayRows.test.ts` adds
a source-scan assertion that `themeOverlayRows.ts` is the **only** file in
`src/` that constructs a `source: "theme"` row, which is what makes "no other
path can mint machine-local state" a failing test rather than a claim.

**Making one permanent.** `ManualCalloutDiscovery` seeds its found-set with the
same declared ids, so **Scan for callouts** promotes them to durable
`source: "fallback"` rows - retiring the ephemeral row first, since `add` would
otherwise refuse the id. JSON, Callout Manager and Admonition imports can also
create durable definitions. Their planners ignore temporary rows; replacement
checks all id/alias conflicts before removing any overlay and publishes one
batched change. A planned create never overwrites a saved row added in the meantime.
These explicit actions sync like other settings; theme ownership remains local.

### Why a theme overlay cannot be the default fallback

The **Default fallback callout** is not an alias or a request for Obsidian to
pretend that every unknown id has another `data-callout` value. It is a
persisted `fallbackCalloutId` whose durable `CalloutDefinition` is used by
`generateFallbackCSS` and by the plugin's own Heading/Inline renderers as a
template. For a target to act as a portable appearance template, it therefore
has to satisfy three invariants:

1. its definition exists on every device that reads the synced setting;
2. Callout Studio owns enough of its appearance to reproduce it for a different
   id; and
3. choosing it cannot let a machine-local theme fact change `data.json`.

A `source: "theme"` overlay satisfies none of them. The row exists only on the
machine whose active theme declares the id, is omitted from saved data and
exports, and is removed when that declaration disappears. Persisting its id in
`fallbackCalloutId` would therefore create a setting whose target is absent on a
second device, after a cold start with another theme, or after importing the
backup without that theme. `CalloutRegistry.load()` does not invent a missing
definition, and `generateFallbackCSS` deliberately returns an empty string for
a missing target, so the result would be a blank picker and no Studio fallback
CSS rather than a portable theme fallback.

Nor can the active theme's rule be reused for unknown ids. Theme CSS names the
original attribute, for example `[data-callout="recite"]`; an unknown callout
keeps its own `data-callout`, so that selector does not match it. CSS has no
"extend this unrelated selector" operation. More importantly, a theme-owned
definition makes `registry.themeOwns(def)` true, and `generateFallbackCSS`
returns before emitting either the Block fallback or `fallbackTokenCSS`. Merely
removing the picker filter would therefore expose a choice that disables the
Studio fallback without making unknown callouts look like the selected theme
callout. `tests/themeOwnership.test.ts` pins that stand-down behaviour.

The fields stored on the overlay row are not a hidden portable copy of the
theme. `syncThemeOverlayRows` seeds them from the fallback that existed when the
row was minted only to construct a complete `CalloutDefinition`. Those fields
are inert placeholders: theme-aware UI uses `ThemeAppearance` (or a neutral
placeholder when measurement is unavailable), and every CSS emitter stands
down. The probe captures only the current mode's accent, one surface colour (or
one gradient stop), and an icon representation for compact UI; it is not a
portable callout design. It does not capture descendant layout, borders,
spacing, fonts, hover/fold states, pseudo-elements, metadata selectors, Style
Settings guards or the other colour mode. Nor can its computed surface be
copied naively into `bgColor*`: the persisted model needs an authored colour
that the injector can re-solve as a translucent tint, while a used value does
not carry enough intent to preserve nested-callout compositing. Calling
`restyleUncustomizedFallbackRows` with the overlay as its source would copy the
placeholder into durable rows, making synced data depend on which fallback the
local machine happened to have when it first saw the theme.

The lifecycle failures are deliberately avoided rather than repaired after the
fact:

| Event | Failure if an overlay id were selectable |
| --- | --- |
| Another device uses a different theme | The persisted id has no definition there; repairing it to `note` would sync back and erase the first device's choice. |
| The active theme stops declaring the id through a switch, disable, removal or update | A live overlay removal resets the target to `note`; if the plugin was not running, the next load instead starts with a dangling target. |
| A new theme or theme update still declares the same id | The saved choice silently acquires a different appearance and possibly a different meaning. |
| An in-place CSS reload removes the selector | It is indistinguishable from the theme relinquishing the id and has the same reset/dangling split. |
| Scan, import or another durable create promotes the id | Promotion first retires the overlay; allowing it to be the target would make that maintenance action reset the fallback mid-operation. |
| The fallback is needed for Heading or Inline | Theme callouts are Block-only, so the theme has no design that can be reproduced on those plugin-owned DOM surfaces. |

This is why `FallbackSection` filters on `source !== "theme"`, rather than
showing theme rows disabled after selection, and why a theme row carries no
*Default fallback* badge. `tests/calloutCombobox.test.ts` pins the picker
boundary; `tests/themeRowActions.test.ts` pins the missing badge; and
`tests/syncThemeOverlay.test.ts` pins the stronger cross-device rule that
changing a theme on one machine never changes the synced settings body.

There is one related but different case: a built-in, user or manually discovered
row may be durable while the active theme temporarily owns its id. Such a row is
eligible for the picker because its definition survives on every device, but
while `themeOwns` is true the emission gate still stands down; the theme's live
CSS is not converted into a fallback template. When the theme releases the id,
the stored Studio definition becomes active again. Core's `note` target remains
a natural default because Obsidian itself renders unsupported block types with
the Note appearance, but that native behaviour must not be generalized into a
promise that an arbitrary theme-owned type can be spread.

**The supported durable routes stay explicit.** **Scan for callouts** can
promote a theme id to a saved `source: "fallback"` definition, but it preserves
the id by copying the current Studio fallback appearance; it does not copy the
theme's CSS. While the active theme still claims that id, the emission gate
continues to stand down. For a stable selectable target, use a built-in or
create/import a Callout Studio-owned type under an id the theme does not claim.
If the goal is only to keep a theme look across theme changes, maintain the
complete rules in a vault-owned CSS snippet; the snippet styles its selectors
directly and is not a **Default fallback callout** template. A future *copy
theme appearance* feature would need to create a new durable definition and
disclose that it is only a partial snapshot; it cannot be implemented as a live
reference from `fallbackCalloutId` to the overlay.


## Stage 5 - Reading the colours and the icon back

The scan knows property names; the user needs to see a swatch and an icon. The
gap cannot be closed by parsing, because the answer is whatever the cascade
computes - through variables, `color-mix()`, inheritance, or a Style Settings
body class the user toggled ten minutes ago.

So [`ThemeAppearanceProbe`](../../src/manager/theme/ThemeAppearanceProbe.ts)
renders every theme-owned callout once, offscreen, and reads **used values** off
it. Four things about that rendering are load-bearing:

- **The ancestry.** Callouts are rendered inside
  `.markdown-preview-view > .markdown-rendered`, exactly as
  `settings/quickInsertPreview.ts` rebuilds it, because core's callout CSS and
  every theme's are written against reading view. A callout lifted out of that
  chain loses the very styling being measured.
- **The main window, never `activeDocument`.** Since Obsidian 1.14 Settings
  is a window of its own, and while it has focus it is `activeDocument`.
  Obsidian copies the main window's stylesheets into a pop-out but skips any
  `<style>` containing `ͼ1` (how it leaves CodeMirror's own sheets behind), and
  Agate's theme writes `.ͼ1 .cm-lineWrapping`. A pass started from the settings
  tab therefore read all ten callouts Agate recolours in core's colours. The
  probe takes the main document the way `CSSInjector` does,
  `app.workspace.containerEl.ownerDocument`.
- **`visibility: hidden`, never `display: none`.** A display-none subtree has no
  layout and no used values for masks or backgrounds; every theme would read as
  unknown. The host is parked at `left: -10000px` with `contain: layout style`
  (`.cs-theme-probe` in `styles.css`).
- **One batch per theme change.** Every wanted id goes into a single
  `MarkdownRenderer.render` call as `> [!id] ` lines - the header alone, never
  the user's display name, because a name carrying a newline would split into two
  blockquotes and shift every callout after it onto the wrong id.

Each rendered callout is matched by **its own `data-callout`**, not by index:
reading `rendered[index]` assumes the renderer produced exactly one `.callout`
per line in written order, and every id after the first place that stops being
true would be silently attributed to its neighbour. A wrong colour looks
plausible, so nothing would ever report it.

The cache is keyed on `stylingSignature` + light/dark + the sorted id set, and
dropped on `css-change` - **outright** when the theme or snippet text moved, and
**signature only** (`invalidate({ keepAnswers: true })`) when it did not: the
answers on hand are then the same theme's own, a beat behind at worst, and the
rows and pills keep wearing them until the pass replaces them instead of
flashing placeholders. The pass is forced and one already in flight still stops
counting either way. A request arriving mid-pass is **held in one
slot and re-run**, never dropped - the one request that is never redundant is
`css-change`'s, and dropping it left the running pass free to write the
*outgoing* theme's readings into a cache that had just been cleared. A failed
read clears both the cache and the signature, so the next repaint tries again
and every row falls to a neutral placeholder in the meantime.

An invalidation generation also guards asynchronous results. A render started
before a CSS change cannot publish or satisfy the cache after that change, even
when the name/version/id signature is unchanged (an in-place CSS reload or rapid
A → B → A). A destroyed probe never repopulates its cache.

### Which node is asked

[`readCalloutStyle.ts`](../../src/manager/theme/readCalloutStyle.ts) owns this and
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
and 25 of the 257 installed themes use it - 13 of them without ever setting
`--callout-color`, so `.callout-title` keeps core's default hue forever while
the title the reader sees carries the theme's. Separately, 21 themes hide the
*drawing* rather than the slot (`.callout-icon > svg { display: none }`) and
paint their own artwork on `.callout-icon::before`.

The readout therefore takes six readings - five elements and one
pseudo-element: `.callout`, `.callout-title`, `.callout-title-inner`,
`.callout-icon`, that slot's first element child, and `.callout-icon::before`. Both mask spellings (`mask-image` and
`-webkit-mask-image`) are asked of every node that could carry one, because
browsers do not mirror one onto the other.

### The icon ladder

[`themeIcon.ts`](../../src/manager/theme/themeIcon.ts), ordered by how **definitive**
the evidence is rather than by how common the mechanism is:

| Rung | Evidence | Reproduced as |
| --- | --- | --- |
| `hidden` | computed `display: none` on `.callout-icon` | nothing - a genuinely empty slot |
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

`iconKey()` folds each rung's **payload** into the identity, not just its kind -
two themes both reaching `mask` draw different pictures, and a comparison on
kinds alone would call that "unchanged" and keep the outgoing theme's artwork.

### The accent ladder

[`themeAppearance.ts`](../../src/manager/theme/themeAppearance.ts), same
evidence-first ordering:

1. **The `::before`'s own paint**, when the `::before` is what drew the icon -
   its `background-color` under a mask, its `color` under a glyph. Core paints
   no `::before` at all, so a painted one is always a theme saying so.
2. **`.callout-title-inner`'s colour** - the hook above. Safe to add precisely
   because it defaults to `inherit`, making it byte-identical to rung 3 for
   every theme that ignores it.
3. **`.callout-title`'s colour** - `rgb(var(--callout-color))`.

The child `<svg>`'s own colour is deliberately **not** a rung: core paints it
`rgb(var(--callout-color))`, so it would duplicate rung 3 while letting the
handful of themes that neutralise their icon artwork (`--text-muted`,
`transparent`) drain the colour out of a swatch that is currently right.

The background is `.callout`'s computed `background-color`, falling back to the
first concrete colour stop inside its `background-image` - a theme that paints
callouts with a gradient leaves `background-color` transparent, so the swatch
would come out empty for exactly the themes that put the most work in. One stop
is not the gradient, but it is a colour the reader can genuinely see.

Blank readings become `null`, and *blank* is named rather than guessed at:
`ZERO_ALPHA_RE` matches the alpha component specifically. The regex it replaced
let its lazy head slide onto the **blue** channel, so every opaque colour whose
last channel is zero - `rgb(184, 131, 0)`, Sanctum's amber, and so its
`warning`, `caution`, `attention`, `alarm`, `idea` and `win` - came back
transparent and drew no swatch at all.

> [!IMPORTANT]
> **The fallback is never the row's stored icon or colour.** `null` accent,
> `null` background and `{ kind: "unknown" }` mean *draw a neutral placeholder*.
> A caller that substitutes `def.icon` or `def.colorLight` there has
> reintroduced the exact bug this module exists to remove - confidently naming
> a design that is not on screen, which is indistinguishable from a right answer
> until you compare.

## Stage 6 - Reproducing what was measured

[`renderThemeIcon.ts`](../../src/manager/theme/renderThemeIcon.ts) is the **only**
code allowed to draw a *theme's* callout icon, exactly as
`icons/renderIcon.ts` is the only code allowed to draw a *Callout Studio* one.
Each rung reproduces what was measured rather than interpreting it again:

- `svg` - parsed as `image/svg+xml` (no scripting context), sanitized through
  `icons/svgSafety.ts` and isolated before insertion.
- `mask` - `.cs-theme-icon-mask` with `--cs-theme-mask`; there is no drawing to
  copy, so the painted box under the stencil is what gets reproduced.
- `glyph` - a real span carrying the measured `font-family`, because a
  pseudo-element cannot be cloned.
- `hidden` → nothing; `unknown` → `renderNoIcon`'s dashed placeholder. The
  distinction matters: `hidden` is the theme's decision, `unknown` is our
  ignorance.

Both colour-dependent rungs inherit `currentColor`, so a caller that sets the
accent on the container gets a matching drawing without this function knowing
anything about colour.

[`calloutListIcon.ts`](../../src/manager/theme/calloutListIcon.ts) is the single
answer for every list that draws a callout *small* - autocomplete, *Replace in
vault*, vault stats, the command builder, and the settings callout picker
([`calloutComboboxRow.ts`](../../src/settings/calloutComboboxRow.ts)). These
surfaces once drifted into different answers, some with no ownership check at
all:

| Who paints the callout | Icon | Accent |
| --- | --- | --- |
| The theme | measured (`renderThemeIconInto`) | measured, else `var(--text-muted)` |
| Callout Studio | the stored icon | the stored colour for the current mode |

**Quick Insert is deliberately not a caller.** It renders a *real* callout
through `MarkdownRenderer`, so the theme paints the row directly and there is
nothing to reproduce - the better mechanism wherever a full callout fits. The
settings row uses the same measured pair for its two swatches
(`CalloutRowRenderer.ts`), and shows no swatch at all when the accent came back
`null`.

## When theme appearance refreshes

`registerThemeAppearance` in `themeAppearanceSync.ts` publishes theme ownership and
measured appearance at startup, settings adoption and CSS changes. It never adds
or removes definitions. Its fingerprint includes the theme and enabled snippet CSS
texts, so an in-place edit with unchanged name, version and text length is still
recognized. Snippet edits refresh cascade claims without discovering theme types. Rendering updates
are deduplicated and do not emit another CSS event when reinjecting.

### A restyle, and a nudge

Obsidian fires `css-change` for a theme switch and for a font-size step alike,
and a drag fires one per step; Style Settings fires it (with
`{ source: "style-settings" }`) for every option and every step of a colour
picker. The handler tells three kinds of event apart, because what each owes is
different:

| Event | What it is | What the handler does |
| --- | --- | --- |
| **Restyle** | the theme or enabled-snippet *text* moved (`restyled()`, the fingerprint) | drops the cached scan, the probe's answers and the registry's readings, re-derives ownership, and re-reads **at once** |
| **Nudge** | the text is the same - a font size, an accent, a mode flip, a Style Settings option, from outside | keeps the readings on hand; re-reads **at once for the first event of a burst**, and once more when the burst has been quiet 250 ms (or 2 s into one that never stops) |
| **Own** | this plugin's `css-change` (`OWN_CSS_CHANGE`), after its own CSS moved | re-reads at once, as it always did; starts no claim check |

What a nudge does *not* do any more is the interesting part, because it is where
the time went:

- **It does not clear the readings.** The handler used to publish an empty map
  and then, a pass later, the same readings back - two registry rounds, each an
  `inject()`, an outline refresh and a settings save, and a flash of neutral
  placeholders in the settings rows and the Live Preview pills. The clear exists
  so the settings tab cannot repaint the *outgoing* theme's artwork during a
  switch; for the same theme there is nothing outgoing.
- **It announces only a move.** `setThemeAppearances` returns whether the
  readings differed, and the regeneration that follows runs only when they did.
  Readings and ownership announce `persists: false`
  ([Callout registry § RegistryChange](05-callout-registry.md#registrychange---does-this-round-need-a-save)),
  so not even a move costs a settings save.
- **It does not discard a read already in flight for a step that is folded
  away.** The invalidation a nudge owes is applied when the read runs
  (`nudged`), not when the event arrives, so a drag does not keep cancelling
  the pass that would have published.

`inject(false)` still runs per event, and so does the sweep of rows (it is
what repaints icons core re-rendered on the same event); both are byte-compared
and cheap for a nudge.

**Why the chain terminates.** The handler injects; an inject that changes the
generated text emits this plugin's own `css-change`; that is heard here too.
Every hop stands on a comparison that goes quiet: ownership is announced only
when the set moved (`ThemeFacts.setOwnedIds`), readings only when they differ
(`setAppearances`), and `CSSInjector.inject` emits only when the text differs
from what is installed. The generated text depends on ownership but never on the
readings, so publishing a reading cannot emit a `css-change` at all, and an
ownership change emits exactly one, whose handler finds the text unchanged and
the set already published.

#### What it costs, measured

Obsidian 1.14.4, a note of sixty callouts open in Reading view and in Live
Preview, a 1.2 MB `data.json`, forty `css-change` events one per frame;
**core alone spends 13 ms an event** with this plugin disabled. Milliseconds per
event:

| Theme (callouts it owns) | Git HEAD before this work | Now |
| --- | --- | --- |
| Catppuccin (0) | 89 | 17 |
| AnuPpuccin (9) | about 320 | 19 |
| MagicUser (114) | 146 | 16 |
| Lumines (90) | 351 | 20 |
| Serenity (95) | about 540 | 73 |

A theme switch is unchanged: the same single pass, one frame drawn in the
interim ownership. The numbers are spread over three changes - the settings save
(about 18 ms, twice an event), the clear-and-republish, and the per-step read -
plus one in the icon painter (`restoreCoreIcon` writes a slot only when it
differs, see [CSS generation](06-css-generation.md)). The end state was compared
before and after in a real Obsidian across five theme switches, a dark/light
flip, an accent colour, font sizes and a thirty-step burst ending on an accent
change: ownership, readings, the generated CSS text and every icon slot in the
DOM were identical at every step.

**What is left.** Serenity's 73 ms is `paintIcon()` re-rendering the icon of
each of the eighteen Studio-owned callouts in the DOM on every sweep - about
2.7 ms apiece, because each new node costs a style resolution against a very
large stylesheet. With the render switched off the whole sweep takes 0.2 ms.
It is unrelated to theme ownership and scales with the theme's weight, so it is
a follow-up of its own: skip the render when `iconRenderKey()` (the contract
the Live Preview widgets already compare, including "artwork that was pending
has since arrived") and the baked colour are unchanged for the slot - with the
care that other painters (`restoreCoreIcon`, the token painters, a rebuilt
widget) must invalidate whatever remembers a slot.

## Representation and persistence

Manually discovered types have `source: "fallback"` and are saved in `data.json`.
Theme ownership remains a runtime fact derived from the active theme. Changing a
theme can change grouping and available render roles; it cannot erase a saved
callout. There is no retired-theme-id store. Legacy `source: "theme"` rows found
in saved data are preserved as durable fallback definitions.



## Where theme callouts appear - and why Block only

| Surface | Theme callouts appear? |
| --- | --- |
| Settings → *Callouts from your theme* | yes, one row each, read-only |
| *Quick insert block callout* | yes - rendered by Obsidian, so the theme draws the row itself, and grouped under a named filter that appears only while at least one theme-owned row exists |
| The `[!` autocomplete, **block** position | yes |
| The `[!` autocomplete, **heading / inline** position | no (`suggestableCallouts`) |
| *Replace in vault*, vault stats, command builder and settings pickers | yes, drawn through `calloutListIcon` |
| The command builder's **format** dropdown | Block only (`offerableRoles`) |
| Backups / export JSON | no (`getUserDefined` excludes them) |

**A theme callout has exactly one format.** Heading callouts (`## [!recite]`)
and inline callouts (`word [!recite] word`) are Callout Studio's own invented
`.cs-*` DOM, which no theme selector can match - so painting them would override
nothing, and an earlier build did exactly that on that argument. It was the
wrong call: it offers two formats the theme has no design for and cannot follow,
beside a Block callout the theme draws itself. Three renderings of one callout,
two of them invented, is worse than one rendering and some literal text - and
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
  go - so the user's own hotkey survives the round trip. The gate is on
  `desiredNames` and never on `kept`, because `kept` is written straight back to
  settings.

A pre-existing callout that becomes theme-owned loses the two formats for
exactly as long as the theme claims it, and gets them back with no migration:
nothing left the definition, only what the renderer acts on.

**The row itself is read-only**, and the refusal lives in
[`openCalloutEditor.ts`](../../src/settings/openCalloutEditor.ts) because the
settings row, the context menu, quick insert and the public API all reach the
editor through it. The eye icon opens
[`ThemeCalloutPreviewModal`](../../src/settings/ThemeCalloutPreviewModal.ts), which
states who owns the callout, that Heading and Inline are unavailable, and shows
a Block-only live preview that **writes nothing at all**. The saved definition
remains intact while its current theme owns the appearance. This theme-only
preview visually collapses its terminal blank editor row so the box ends with
content, while retaining the underlying line as a safe caret target; every
ordinary preview remains unchanged. Its `⋯` menu
([`themeRowActions.ts`](../../src/settings/sections/themeRowActions.ts)) carries
usage information, then - only when the callout is actually written somewhere -
*Replace in vault* and *Convert uses to plain text*, then *Duplicate* for a saved
custom definition, each group behind its own divider (see
[Callout row menu groups](16-settings-ui-and-modals.md#callout-row-menu-groups)).
Never *Delete*, which would
be a lie since the theme keeps supplying the type; `deleteRemovesRow`
([`rowOwnership.ts`](../../src/settings/sections/rowOwnership.ts)) is the single
predicate behind that, and it answers the same way for a built-in. The convert
item is the shared `addConvertUsesItem`, and its confirmation names the theme as
the reason the type stays.

The use count lives in that menu rather than on the row, and the row carries no
*Default fallback* tag either: both describe a callout the user cannot act on.
[`usageMenuItem.ts`](../../src/usage/usageMenuItem.ts) reads the shared
[`CalloutOccurrenceIndex`](../../src/usage/CalloutOccurrenceIndex.ts), subscribes
while the menu is open. `prepareUsageMenu` requests freshness only when needed
and waits at most 200 ms before the menu is built; after that, a pending count
fades in when ready. Ready counts open immediately without a new scan.
The index owns source invalidation and reuse; settings-row refreshes must not
start an independent whole-vault scan on every colour-picker change.

## For theme authors

Everything below follows from the scanner and the probe described above. The
short version:

> Name each callout with a plain `[data-callout="id"]` (or `~=`) attribute
> selector, set `--callout-color` for the accent and `--callout-icon` for the
> artwork, and Callout Studio will list your callout with the right id, the
> right colour and the right icon - and then get out of your way. Nest or don't;
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
	--callout-color: 174, 129, 255;      /* R, G, B - core's pre-1.13 format */
	--callout-icon: lucide-quote;        /* any Lucide id core knows */
}

/* Native nesting is read as its flat equivalent - declarations on the rule
   itself, `&`, an implied descendant, and any depth of either. */
body.theme-dark .callout[data-callout="recite"] {
	background: rgba(174, 129, 255, 0.1);
	& .callout-title { font-variant: small-caps; }
	.callout-content { padding-block: 0.5rem; }
}

/* Word-list form, read identically. */
[data-callout~="infobox"] { --callout-color: 90, 160, 240; }

/* Selector lists, appearance scoping, at-rule wrappers, :is() - all fine. */
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
> colour string. Discovery does not care either way - it reads the *computed*
> result - but everything else does.
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
>   sheet, so a handful of rules in the other convention will break - and they
>   break silently, because an unparseable `var()` substitution unsets the
>   property rather than raising anything.
> - **A bare `.callout { background-color: … }`** - no guard, no id - tells the
>   plugin you are painting every callout's background yourself, and it will stop
>   supplying its own. Put a guard on it (a body class, a `[data-callout=…]`) if
>   you meant it as a default rather than a decision.

- **Spacing does not matter; case does, unless you add `i`.**
  `[data-callout~=Metadata i]` is read as `metadata`, and `[data-callout="my note"]`
  as `my-note` - the normalisation Obsidian applies when it writes the
  attribute. But Obsidian writes the type in lower case and the attribute
  compares case-sensitively, so `[data-callout="Metadata"]` matches nothing and
  claims nothing.
- **`@media`, `@supports` and `@layer` wrappers are descended into.**
- **A rule that sets nothing still claims a type you add.** `[data-callout="x"] {}`
  lists `x` as one of your theme's callouts, and so does one whose body holds
  nothing but nested rules. For a built-in, or a callout the user made, it
  claims nothing: those move to your theme only while your rules visibly change
  them - see [Naming is not drawing](#naming-is-not-drawing---the-claim-check).
- **Nesting costs nothing.** A nested selector is resolved against its parent
  before anything is read, so `.callout-icon { … }` inside your callout rule is
  scanned as `…[data-callout="x"] .callout-icon`, at that selector's real
  specificity. Nested `@media` and `@supports` blocks hand their declarations
  back to the rule around them.
- **Body-class scoping claims only while the class is on.**
  `body.my-style-settings-class [data-callout="y"]` claims `y` while `<body>`
  has that class; Style Settings fires `css-change` when it changes, and the
  claim follows. Write `body` (or `html`, `:root`) into the selector for this to
  apply: a bare `.my-style-settings-class` may come from a note's `cssclasses`,
  so it is never held against your rule.
- **A callout styled in one appearance mode only** is listed in both modes when
  your theme adds it - unless the selector writes `body.theme-dark`, which the
  body rule above reads - and, for a built-in, only in the mode you style. What the *swatch*
  shows is the current appearance mode only - see
  [Limitations](#limitations-and-edge-cases).

### Patterns that prevent discovery

| Pattern | Effect |
| --- | --- |
| `[data-callout*="col"]`, `^=`, `$=`, `\|=` | Kept as a family pattern, never listed as a callout type - a pattern names no id. Intended, and the editor warns a user whose id would be caught |
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
> vault, seven write callout rules that way, and *Minimal Dracula* - which
> nests all of them - was read as having no callout rules at all. Resolving
> nesting recovered 16 callout ids across three themes (Minimal Dracula's 13,
> Brainhack's `brainhack` and `1`, Underwater's `box`) and four family
> patterns, and corrected the `!important` escalation measurement for five
> themes. Nothing that was already detected changed. If you support an older
> Callout Studio, a flat rule per id is still the safest spelling.

### Backgrounds you deliberately remove

If your theme gives callouts no background of their own - a flat or outlined
design where the colour lives in the icon, the title and a frame - write it on a
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
not one of `transparent` / `unset` / `initial` / `revert` / `rgba(0,0,0,0)` - or
`background: none` for the shorthand - and naming a `data-callout` id, which says
nothing about a callout you have never heard of.

If you also frame the callout through `.callout-title` / `.callout-content`
borders and leave the colour to `currentColor`, Callout Studio supplies the
callout's own accent so your frame is coloured rather than drawn in body text.
**State a colour yourself and it will not touch it** - `border-color:
color-mix(in srgb, var(--callout-color) 40%, transparent)` beside your
`border: 2px solid` is enough, reads better in your own callouts too, and is
what Shiba Inu does.

If the colour moves to a stripe or a panel instead - a neutral root with the
accent on the title, as AnuPpuccin's Sleek style does - fill that box from
`--callout-color` under the same guard as the root rule:

```css
/* read: the user's background (solid or gradient) moves to the title */
.my-stripes .callout                 { background-color: var(--background-secondary); }
.my-stripes .callout > .callout-title { background-color: rgba(var(--callout-color), 0.1); }
```

A callout with a Saved Palette then shows that palette's background on the
stripe, and a transparent one shows none. A pseudo-element works too, if its
rule pins it over the whole box (`position: absolute; inset: 0`). Writing the
stripe *without* a matching root rule tells Callout Studio the root keeps its
colour, and the stripe stays yours.

### Colours

The accent is read as a **used value** off a rendered callout, in this order:
the `::before`'s own paint (when the `::before` draws the icon) →
`.callout-title-inner`'s `color` → `.callout-title`'s `color`. In practice that
means:

- Setting `--callout-color` works, because core resolves it onto
  `.callout-title`.
- Setting `--callout-title-color` works, because that is the node actually asked.
- `color-mix()`, `var()` chains, `oklch()` - all fine. The probe reads the
  computed result, not your source text.
- Painting **only** the child `<svg>`'s colour will *not* register as an accent,
  by design.

Backgrounds are read from `.callout`'s `background-color`, falling back to the
first colour stop in `background-image` for gradient-painted themes.

### Icons

Ranked by how well they reproduce on the plugin's own small surfaces:

| Mechanism | Rung | Reproduces as |
| --- | --- | --- |
| `--callout-icon: lucide-quote` | `svg` | The real drawing - best supported. Core injects the `<svg>`, and it is cloned |
| `--callout-icon: '<svg …>'` | `svg` | Same, after sanitizing |
| `mask-image` on `.callout-icon` | `mask` (slot) | A `currentColor` box under your stencil - accurate, and it inherits the row's accent |
| `mask-image` on `.callout-icon::before` | `mask` (pseudo) | The same, as long as the child `<svg>` is hidden or absent |
| An icon-font glyph in `::before { content: "\f0eb" }` | `glyph` | The character, carrying your `font-family` - correct only if that font is loaded where the plugin draws it |
| `.callout-icon { display: none }` | `hidden` | An empty slot, faithfully |
| Anything else | `unknown` | A neutral dashed placeholder, never your row's stored icon |

> [!TIP]
> If you paint on `.callout-icon::before` **and** leave core's `<svg>` visible,
> the `svg` rung wins and small surfaces will show core's drawing rather than
> yours. Hide the child (`.callout-icon > svg { display: none }`) or mask the
> slot itself - which is what the themes that get this right already do.

### Testing your theme against Callout Studio

`npm run themes:report` reads every theme installed in a vault, runs each one
through **the plugin's own scanner**, and writes a Markdown worksheet next to
the vault root. Reusing the real scanner is the point: the *callout types it
adds* column is literally the set the settings tab will list, not an
approximation, so a disagreement is a plugin bug rather than a reporting one.
It is deliberately **not** part of `npm run build` - its output goes into a
vault, not the repo, and it depends on which themes happen to be installed.

The columns worth checking for your own theme:

- **Callout types it adds** - should be exactly the ids you intended. An empty
  column on a theme that styles callouts means a discovery-blocking pattern
  above.
- **Fuzzy** - family selectors, listed as `*=col` strings. These capture users'
  own ids silently.
- **`!important` count** and **heaviest selector** - the inputs to the plugin's
  escalation. The ceiling is 14 class units.
- **Style Settings classes** and **`:has()`** - flagged because a static scan
  cannot predict them; those rows need a human.

## Limitations and edge cases

- **Only the current appearance mode can be probed.** Wrapping the probe in a
  `.theme-light` div does not flip a theme that writes `body.theme-dark …`, and
  flipping the real body would repaint the user's screen. Readings are re-taken
  on the `css-change` that an appearance switch fires.
- **A claim is checked only against the page as it is.** An id named only
  behind a bare class (`.my-option .callout[…]`, no `body`) stays claimed while
  that class is off, if the theme invented it. A built-in or a user callout in
  the same position stays claimed too - the class may come from a note's
  `cssclasses` - unless your theme's Style Settings block offers that class as
  an option: then it is handed back while the option is off. A saved scan row is
  not measured. A theme-invented type drawn
  only inside another callout, or only with metadata, stays listed because it
  cannot be measured alone.
- **Ownership is per name, not per property.** A theme that sets one variable
  for `note`, and so visibly changes it, owns `note` entirely. This is the whole point - a partial override
  is the split the model exists to abolish - but it does mean a very light touch
  costs the theme the full callout. The cut runs between names, never inside
  one: the claimed names of a callout the theme does not own are the theme's
  as block callouts, and the rest stay this plugin's.
- **Layout is not undone.** The plugin wins the properties it sets; it does not
  reverse `display: grid` or a `transform` a theme adds.
- **Enumeration reads the theme only.** A user snippet that declares
  `[data-callout="foo"]` does *not* create a theme row and does not make the
  plugin stand down - snippets count only toward the `!important` escalation
  measurement. For an unrecognized native Block callout, the generated fallback
  deliberately has only one class of specificity and no `!important`, so an
  ordinary exact snippet definition wins without being inferred as registry
  ownership. A known Studio definition remains Studio-owned and uses the
  measured `!important` register.
- **Quick Insert partitions by live style owner**, using `themeOwns` before
  `builtIn`, so theme-invented rows, restyled built-ins and temporarily claimed
  saved rows all appear under the active-theme filter and nowhere else. The
  filter is omitted entirely when that live theme-owned set is empty.
- **`source: "theme"` in an imported file is not authority.** `importValidator`
  re-stamps `source: "user"`; only the live sweep can make a row a theme row.
- **A `"` or `\` can reach a callout id** without the user typing it, so every
  emitted selector escapes through `utils/calloutSelector.ts` - see
  [06-css-generation.md](06-css-generation.md#calloutsel-vs-tokenattrsel---the-selector-escaping-rule).
- **Style Settings' own `<style id="css-settings-manager">` is invisible** to
  `themeCss()` and `enabledSnippetCss()`, so the accent dialect is not re-derived
  when an option changes. That is correct rather than a gap: Style Settings
  changes body classes and variable *values*, never read sites. Two themes in the
  dev vault expose a `--callout-<type>` as a settable variable - Iridium, and
  Tokyo Night, which offers a `variable-themed-color` picker for all thirteen -
  and both are colour-dialect with colour pickers, so the spelling stays
  consistent whatever the reader picks. It does fire `css-change`, so the pass
  runs and comes out byte-identical - which is the point: the theme's guarded
  rules take effect live, with nothing re-injected.

  Verified end to end in the cascade harness: overriding Tokyo Night's
  `--callout-default` to `#00cc44` moves an unmodified built-in's box, title,
  `--cs-accent` and heading bar to that green, on the same generated sheet, while
  a user-coloured callout beside it does not move at all. That split is the whole
  contract - the theme's variables stay the theme's, the user's colour stays the
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
  see. A third `hsl-triplet` spelling would fix the first group - `hexToHsl` is
  already in `colorUtils` - but it changes what goes *into* `--callout-color`, so
  it is a design decision rather than a patch, and it is deliberately not taken
  here. Nothing else in the 257 greys out.
- **A runtime probe could answer `declared` exactly.** `ThemeAppearanceProbe`
  already reads computed styles through an injectable reader; registering a
  sentinel `@property`, assigning the theme's variable to it and reading it back
  would see Style Settings, snippets and `var()` chains for free. It is rejected
  for now because it is asynchronous and cannot answer `read` at all - that would
  still need the text scan - but it is the documented upgrade path if the scan
  ever proves too coarse.

## Checking a theme against the real cascade

`npm test` cannot see this. Its DOM is a stand-in and its `obsidian` module is a
stub, so it can assert **what CSS is emitted** but never **which declaration
wins** - and every question in this chapter is a cascade question. The answer is
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

- **Extract `app.css` from the *running* asar** - `~/Library/Application Support/obsidian/obsidian-<v>.asar`, not the copy inside `Obsidian.app`, which lags badly. The two disagree about whether `--callout-color` is a triplet or a colour, which is the whole subject.
- **Link every sheet, never inline it into a `<style>`.** Several installed themes - Border, NeuBorder, Tokyo Night, Poimandres Extended, Glass Robo and Olivier's Theme - carry a literal `</style>` inside their Style Settings YAML comment; inlined, that ends the element early and Chrome parses 301 of Border's rules and silently drops the rest, including the entire `callout-style-N` family. It is not only a callout question: inlined, Glass Robo lost the `--modal-background` its whole window is painted with, and read as a theme with no surface at all. Obsidian assigns theme CSS through `styleEl.textContent`, which never re-enters the HTML parser.
- **Publish theme ownership.** `registerThemeAppearance` hands `registry.setThemeOwnedIds` every id the theme names, built-ins included, so the emission gates silence the plugin for them. Measuring without it measures a configuration that cannot occur.
- **Model Style Settings exactly.** Class toggles and class selects add classes to `<body>`; variables land in `body.css-settings-manager` and `body.theme-{light,dark}.css-settings-manager`, in a `<style>` appended last to `<head>`. Read them out of the theme's own `/* @settings */` YAML rather than guessing.
- **Read numbers, not pixels.** Without real CodeMirror the layout collapses, so a screenshot lies where `getComputedStyle` does not. (Settings-pane questions are the exception: that DOM is plain markup and a screenshot of it is real - which is how the sticky band's paint was verified pixel-identical before and after a change.)
- **A width question needs the modal chain's own widths overridden.** `.modal` is `width: var(--dialog-width)` with a `max-width`, and `.vertical-tab-content` adds `padding-inline: var(--size-4-12)` and `container-type: inline-size`. So sizing the *host* element proves nothing: a sweep from 900px down to 220px reports byte-identical geometry at every step, because the pane never actually narrowed. Set `width: 100% !important; max-width: none; min-width: 0` on `.modal`, `.vertical-tab-content-container` and `.vertical-tab-content`, then size the wrapper - that is what makes a responsive question measurable. Read logical edges, too: `getBoundingClientRect` is physical, so an assertion written as "16px from the right" passes in LTR and fails in RTL for a layout that is correct in both.
- **Put only the classes a default install has on `<body>`.** `is-translucent` is a setting that is off by default, and a theme is free to key its whole see-through look off it; measuring with it on measures somebody else's install. `theme-{dark,light}`, `mod-macos`, `is-focused` - and `is-mobile is-tablet` / `is-mobile is-phone` when the question is a mobile one, which for anything painted per device it usually is.
- **Do not use `--virtual-time-budget`.** Virtual time does not advance while an animation is running, so any theme with one hangs the run until it is killed, and a sweep across every installed theme will hit several. The page has no async work of its own: `--dump-dom` after the load event is enough, with a wall-clock timeout per run.
- **A rule walk needs a `try` around every rule, and still cannot see a nested one.** Reading `document.styleSheets` to find *which* declaration won is the natural follow-up to a surprising computed value, and it has two traps: one unusual rule type throws and takes the rest of that sheet's rules with it unless each is caught on its own, and `el.matches(rule.selectorText)` throws outright on a nested rule, whose `selectorText` starts with `&`. A theme written with CSS nesting then looks like it has no opinion at all - Lagom's `background-color: transparent !important` on settings headings, nested under `.mod-settings`, was invisible that way, and it is the reason the band's paint could not be fixed with an `!important`.

Three assertions carry most of the value:

| Check | What a failure means |
| --- | --- |
| no built-in's `--cs-accent-theme` computes to `rgb(125, 125, 125)` | the `@property` grey initial - the spelling handed to it did not parse. Skip rows with no `--cs-color-rgb`: those are theme-owned, where the plugin emits nothing by design |
| `--cs-accent` agrees with the `--callout-color` the page computed | this plugin's own surfaces have drifted from the box the theme painted. Compare rounded channels, not strings - Maple serialises `rgba(5.202, 132.8822, 168.198, 1)` for the same colour |
| render the same DOM with the generated sheet **and without it**, and diff | every property that moved should be one the user chose. Anything else is an over-reach; anything expected and missing is an under-reach |

That last one is the sharpest instrument in this chapter: it turns "does this
theme still look right?" into a list of named properties, and it is how the
`PAINTERS` and per-mode bugs above were both found and proved fixed.

### Sweeping every theme and Style Settings state for backgrounds

The relocation and transparent work above was verified by a sweep rather than
by sampling, because the bug it fixed lived in one Style Settings option of one
theme. The shape is worth keeping:

- **States, not themes.** Read every theme's `/* @settings */` YAML, keep the
  `class-toggle` and `class-select` entries whose classes appear in a selector
  mentioning `callout`, and measure the default install, each option alone, each
  pair of options from two different settings, and the vault's own saved
  `obsidian-style-settings/data.json` - light and dark, Reading view and the Live
  Preview chain. Flipping `<body>` classes on one loaded page per theme is
  exactly what Style Settings does, and measures thousands of states in seconds.
- **Generate the sheet per theme** with `themedHarness(themeCss)` and the same
  assembly as `injectNow`, for a fixed set of definitions: accent only, solid,
  gradient (an unusual angle, so its computed `background-image` is
  recognisable), gradient with title text, and transparent.
- **Read every box**: root, title, content, and the `::before`/`::after` of each,
  with their sizes, so a pseudo-element can be told apart as a surface (most of
  its box, full opacity) or a decoration.
- **Two invariants, and their honest exceptions.** *Transparent*: no fill on any
  box or surface. *Gradient*: visible on some box, never replaced by a solid
  accent fill, never under an opaque surface. A missing gradient is a bug only
  when the solid definition shows its colour somewhere in the same state - when
  it does not, the theme draws that state flat for everyone. A content card or
  an opaque title badge partly covering the gradient is the theme's own design,
  reported rather than failed.

Measured on 2026-10-01 over the 257 installed themes and 4,732 states (theme × Style Settings state × mode, each in Reading view and Live Preview): 2,528
failures in 35 themes before, none after. What remains by design is flat
styles (GitHub Theme, Prism and Cybertron for unnamed ids, Minimal's and
Oxygen's outlined style, Notation 2, Polka, Typomagical, Ultra Lobster's default),
content cards (Willemstad, Serenity, Border, Vicious, Primary and others) and
title badges (Glass Robo, flexcyon).

## What the most-tested themes do

Measured from each theme's own CSS, not from screenshots. "Read dialect" is what
the accent scan concludes; "neutral" means the theme never reads or declares a
callout accent variable, so nothing about this machinery is visible in it.

| Theme | Callout rules | Read dialect | Guard classes (Style Settings) | Notes |
| --- | --- | --- | --- | --- |
| AnuPpuccin | ~25 | **triplet** | `anp-callout-{vanilla-normal,vanilla-plus,sleek,block}`, `anp-callout-color-toggle` | layout rules generic, colour rules a 28-id allowlist. Sets `--callout-blend-mode: normal` globally. Carries one `!important` callout rule, which lifts the studio weight to 5 |
| Obsidian gruvbox | 2 | **triplet** | none | unguarded `.callout` background at `(0,1,0)` - the suppression case. Declares `--callout-<type>` through a triplet `var()` chain - the grey-accent case |
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
| Primary | 36 | **triplet** | none | reads `rgba(var(--callout-color))` and sets `--callout-color: var(--callout-rgb-<id>)` **per id**, so it names all 28 and owns them. Unguarded `.callout` background, padding and box-shadow - all three suppressed in the shim |
| Sanctum | 81 | **triplet** | `callout-border-width`, `callout-border-opacity` (`format: '%'`) | one bare `.callout` rule carrying `border` **and** `background-color`. The `border` shorthand is why `PAINTERS` exists - see [06](06-css-generation.md#the-core-accent-shim) |
| Catppuccin | 27 | colour | none (its 8 blocks are accent/flavour) | `.callout` at `(0,1,0)`: 10% background, 60% border, both from `--callout-color`. Follows a chosen accent exactly |
| Willemstad | 358 | colour | 43 options - `ssopt-callout-style` (Willemstad / IBM Carbon), `ssopt-callout-standard`, `callout-border-left-extra`, infobox / aside / columns / gallery families | per-side border colours (its left stripe) all follow the accent; 12.5% tint |
| Prism | 47 | colour, **0 reads** | `pt-disable-callout-styling` | `background-color: unset` on every callout at `(0,3,1)`, then paints `.callout-title` / `.callout-content` from its own palette per id. A preset colour leaves that alone; a Saved Palette wins it, as designed |
| Border | 9 | colour, 0 reads | `callout-style-select` (`callout-style-1…4`) + 11 layout variables | the style classes land on `<body>`, so `--callout-border-width: 0 0 0 4px` with opacity 1 gives a 4px left stripe **in the user's colour** |
| Tokyo Night | 9 | colour, 0 reads | same `callout-style-select` family, plus `variable-themed-color` for all 13 `--callout-<type>` | the live-update case above |
| GitHub Theme | 5 | colour, 0 reads | `callout-on` (**default true**) | `body.callout-on .callout` at `(0,2,1)`: transparent background, grey `border-left`. A preset colour keeps both; only the accent-derived properties move |
| Shimmering Focus | 21 | colour | none callout-named | tints `.callout-title` at 15% and its bottom border at 25% from the accent - both follow the user's colour |
| Cybertron | 7 | colour, 0 reads | none | nothing accent-derived of its own; core's defaults carry the colour |
| Everforest | 0 | colour | none | palette only: declares all 13 `--callout-<type>`, which an unmodified built-in follows through `--cs-accent-theme` |
| Dracula for Obsidian | 0 | colour, 0 reads | none | no callout CSS at all - the pure-neutral case, byte-identical to a vault with no theme |

## Where the code lives

| File | Responsibility |
| --- | --- |
| [`manager/theme/customCssApi.ts`](../../src/manager/theme/customCssApi.ts) | The only place `app.customCss` is named |
| [`manager/theme/cssBlocks.ts`](../../src/manager/theme/cssBlocks.ts) | Cutting the sheet into rules, with native CSS nesting resolved |
| [`manager/theme/themeCalloutScan.ts`](../../src/manager/theme/themeCalloutScan.ts) | Pure text scanner: claims, patterns, weights |
| [`manager/theme/themeClaimLookup.ts`](../../src/manager/theme/themeClaimLookup.ts) | "Does this sheet style the id I already have?" |
| [`manager/theme/accentDialectScan.ts`](../../src/manager/theme/accentDialectScan.ts) | Reading ONE sheet: reads, declarations per mode, what it paints unguarded |
| [`manager/theme/accentDialect.ts`](../../src/manager/theme/accentDialect.ts) | Folding every sheet's evidence into the one answer the emitters consult |
| [`manager/theme/accentValueFormat.ts`](../../src/manager/theme/accentValueFormat.ts) | Is one declared value a colour or a triplet, following `var()` |
| [`manager/css/coreAccentShim.ts`](../../src/manager/css/coreAccentShim.ts) | Core's own declarations, restated when the spelling breaks them |
| [`manager/theme/ThemeCalloutStore.ts`](../../src/manager/theme/ThemeCalloutStore.ts) | Caching + the enumeration/weight split |
| [`manager/theme/ThemeFacts.ts`](../../src/manager/theme/ThemeFacts.ts) | Owned ids + measured appearances, held behind the registry |
| [`manager/theme/themeAppearanceSync.ts`](../../src/manager/theme/themeAppearanceSync.ts) | Scheduling, ordering, the fingerprint, the probe's lifetime |
| [`manager/theme/ThemeClaimCheck.ts`](../../src/manager/theme/ThemeClaimCheck.ts) | Page conditions and the measured "does the theme draw it?" pass |
| [`manager/theme/themeClaimSelectors.ts`](../../src/manager/theme/themeClaimSelectors.ts) / [`themeClaimEffect.ts`](../../src/manager/theme/themeClaimEffect.ts) | Reading and rewriting a parsed selector; what counts as a visible difference |
| [`manager/theme/themeClaimRules.ts`](../../src/manager/theme/themeClaimRules.ts) | The theme's parsed rules: which name an id, which the page switches off, which are in force on the rendered callout |
| [`manager/theme/themeClaimCache.ts`](../../src/manager/theme/themeClaimCache.ts) | The claim check's verdicts, remembered on the device per theme |
| [`utils/quietGate.ts`](../../src/utils/quietGate.ts) | Act at once, then once more when a burst of `css-change` has ended |
| [`manager/ownCssChange.ts`](../../src/manager/ownCssChange.ts) | The payload that marks this plugin's own `css-change` |
| [`manager/theme/themeOverlayRows.ts`](../../src/manager/theme/themeOverlayRows.ts) | Minting and retiring the ephemeral `source: "theme"` rows |
| [`manager/theme/ThemeAppearanceProbe.ts`](../../src/manager/theme/ThemeAppearanceProbe.ts) | Offscreen render + cache |
| [`manager/theme/readCalloutStyle.ts`](../../src/manager/theme/readCalloutStyle.ts) | Which node answers which property |
| [`manager/theme/themeAppearance.ts`](../../src/manager/theme/themeAppearance.ts) | Accent/background interpretation |
| [`manager/theme/themeIcon.ts`](../../src/manager/theme/themeIcon.ts) | The five-rung icon ladder |
| [`manager/theme/renderThemeIcon.ts`](../../src/manager/theme/renderThemeIcon.ts) | Reproducing a measured icon |
| [`manager/theme/calloutListIcon.ts`](../../src/manager/theme/calloutListIcon.ts) | One answer for every small callout list |
| [`manager/theme/studioWeight.ts`](../../src/manager/theme/studioWeight.ts) / [`StudioWeightCache.ts`](../../src/manager/theme/StudioWeightCache.ts) | How hard the plugin pushes on what it *does* own |
| [`manager/theme/themeReport*.ts`](../../src/manager/theme/themeReport.ts) | The `themes:report` worksheet - not bundled into `main.js` |
| [`settings/sections/rowOwnership.ts`](../../src/settings/sections/rowOwnership.ts) | Which of the three lists a row belongs in, and whether its menu offers Delete or only Convert uses to plain text |
| [`settings/sections/themeRowActions.ts`](../../src/settings/sections/themeRowActions.ts), [`usage/usageMenuItem.ts`](../../src/usage/usageMenuItem.ts) | The theme row's controls and its shared occurrence-index menu |
| [`settings/ThemeCalloutPreviewModal.ts`](../../src/settings/ThemeCalloutPreviewModal.ts) | The read-only window behind the eye icon |

Suites: `themeCalloutScan`, `themeOwnership`, `manualDiscovery`,
`themeOverlayRows`, `themeRowSync`, `syncThemeOverlay`, `themeAppearance`,
`themeAppearanceProbe`, `themeClaimCheck`, `themeClaimCache`, `themeClaimSelectors`, `quietGate`,
`registryChangeKinds`, `restoreCoreIcon`, `themeRowActions`, `themeReport`,
`cssSpecificity`.

---
Next chapter: [19-upgrading-manual-discovery.md](19-upgrading-manual-discovery.md)
