# CSS generation

[`src/manager/CSSInjector.ts`](../src/manager/CSSInjector.ts) (~1,950 lines,
one of the frozen oversized-file exceptions) reads every `CalloutDefinition`
from the registry and writes one CSS stylesheet that restyles Obsidian's block
callouts and paints the plugin's own heading/inline DOM. It also paints icon
DOM directly (not just via CSS) — see [Icon painting](#icon-painting) below.

## Two write targets, and why both are necessary

```ts
private ensureStyleSheet(): void   // document.adoptedStyleSheets — one per window
private ensureStyleEl(): void      // a real <style id="callout-studio-dynamic-css"> in <head>
```

Every inject writes the same CSS text to **both**:

1. **`adoptedStyleSheets`** — the fast path for live Reading view and Live
   Preview, and for any pop-out window (`ensureStyleSheet` registers a
   per-`window` singleton via `window.__calloutStudioStyleSheet` so a second
   plugin instance in the same window realm adopts the existing sheet rather
   than fighting over it).
2. **A real `<style>` element in `<head>`** — because Obsidian's "Export to
   PDF" renders in a context that honours `<style>`/snippet CSS but **ignores
   `adoptedStyleSheets` entirely**. Without this element, callout colours and
   Material/emoji icons simply would not appear in an exported PDF.

`ensureStyleSheet` constructs the `CSSStyleSheet` using the *target document's*
`defaultView`, not the global constructor — using the global one when
`activeDocument` belongs to a pop-out window throws
`"Sharing constructed stylesheets in multiple documents"` in some Electron
builds, because sheet construction and adoption are realm-scoped.

## `inject()` — the re-entrancy latch

```ts
inject(emitCssChange = true): void {
  if (this.injecting) return;
  this.injecting = true;
  try { this.injectNow(emitCssChange); }
  finally { this.injecting = false; }
}
```

Emitting `workspace.trigger("css-change")` at the end of a pass lands back on
this same class through the plugin's own `css-change` listener
(`main.ts: workspace.on("css-change", () => cssInjector.inject(false))`). The
latch makes that re-entrant call a no-op instead of a second full pass. The
`try/finally` is load-bearing, not defensive boilerplate: a throw anywhere in
the generation pass (a malformed colour, a `setIcon` call in an export realm
that lacks it) would otherwise leave the latch stuck `true` and silently drop
**every subsequent inject for the rest of the session**.

`inject(false)` is what the external `css-change` handler passes — re-emitting
`css-change` in response to hearing it would create a feedback loop with any
other plugin that also listens and re-emits (Style Settings is named
explicitly in the source as an example), and would cost a full editor cache
wipe for CSS that never moved.

## Byte-identical short-circuit

```text
generate CSS text
  → compare against this.lastCssText
      ├─ unchanged → skip: stylesheet swap, <style> textContent write,
      │              localStorage persist, css-change trigger
      └─ changed   → do all four, then set lastCssText = new text
  → paintIcons() runs regardless (artwork can land with unchanged CSS text)
  → refreshAllCalloutEditors() runs regardless
```

Most injects arrive with output byte-identical to what's already installed —
an icon download landing that changes nothing about *this* callout, a prune
pass that removed zero rows, another plugin's unrelated `css-change`, most
steps of a multi-row import. `workspace.trigger("css-change")` is not free:
core answers it by dispatching a clear-cache effect and calling
`editor.refresh()` on **every** open CodeMirror instance and re-rendering
every open reading view — on mobile that's the visible "screen jumps" symptom.
Comparing text first keeps that cost tied to actual changes.

`lastCssText` is explicitly nulled whenever a style target is rebound
(`ensureStyleSheet` adopting someone else's existing sheet, `ensureStyleEl`
binding to a freshly-created or pre-existing element, `destroy()`), because in
those cases the target may hold text this instance didn't write and can't be
trusted as a comparison baseline.

## `injectFromCache()` — the startup fast path

```ts
injectFromCache(): void   // called once, synchronously, before loadData() is even awaited
```

Reads a CSS snapshot from `localStorage` via `StartupStyleCache` (see
[Persistence and caching](07-persistence-and-caching.md#the-startup-css-snapshot))
and writes it directly to both targets, with the registry still empty and
**no** `css-change` emitted. It exists purely to shrink the flash-of-unstyled
window on a slow mobile launch; `initialize()` (called moments later, once the
registry actually holds data) replaces it with a real generated pass.

## Structure of the generated stylesheet

`injectNow` assembles, in order:

```text
1. header comment
2. generateGlobalStyleCSS()        — vault-wide border/radius/scale + icon gap default
3. @media screen { .cs-export-icon { display: none } }   — hides the PDF-only DOM icon copies on screen
4. generateCalloutCSS(def) for every callout in registry.getAll()
     └─ within it, coreAccentShimCSS(def) — only when the active theme spells the
        accent differently from core; see "The core accent shim" below
5. generateFallbackCSS(callouts)   — styles any data-callout Obsidian rendered that this
                                       plugin does not recognize
```

### The three accent variables (`accentProps`)

Every per-callout light/dark block writes up to three custom properties, and
the reason there are three (not one) is version drift plus a deliberate
hand-off point:

| Variable | Owner | Behaviour |
| --- | --- | --- |
| `--callout-color` | Obsidian core | Spelled the way the **active theme's** read sites expect, not the way the running Obsidian does — `calloutColorValue(hex, dialect)`, see [Accent dialect](11-color-system.md#accent-dialect-version-drift-and-theme-drift). **Omitted entirely for an untouched built-in** — that's what lets core's own rule (and any theme overriding it) keep deciding the accent. |
| `--cs-accent` | This plugin | Always a real colour on every Obsidian version, so it can feed `color-mix()`. On an untouched built-in it follows the same core variable (`--callout-info` etc.) so the plugin's own surfaces (heading bars, inline pills, borders, icon tints) move with the active theme in lockstep with the block callout itself. |
| `--cs-accent-theme` | This plugin | What makes "always a real colour" true rather than merely intended. Registered `<color>` via `@property` in `styles.css`; a theme's value passes through it on the way to `--cs-accent`. The registration is the *last* line of defence, not the first: `calloutAccentVarRef` wraps the read in `rgb()` when the dialect says that theme declares the variable as a triplet, so the value arrives already a colour. Degrading to the registration's grey is what happens when that fails, and it is why the per-variable half of the dialect exists at all. Emitted **only** when there is a theme value to launder — the plugin's own hexes are validated into and out of storage and go direct. Deliberately a separate name, not a registration of `--cs-accent` itself: a registered property is never "undefined", which would kill the `var(--cs-accent, currentColor)` fallback the global border rule relies on. |
| `--cs-color-rgb` | Legacy | Bare triplet, kept one release for external consumers still reading it. Cannot follow a theme (a triplet can't be derived from a `var()`), so on an untouched built-in it's a best-effort snapshot of the shipped default. Nothing inside this plugin depends on it anymore. |

`themeAccentVar(def)` returns the Obsidian variable name
(`OBSIDIAN_CALLOUT_VAR[def.id]`, e.g. `--callout-info`) **only** when
`registry.isUnmodifiedBuiltIn(def)` is true. The instant a user edits a
built-in — even just recolouring it — `isUnmodifiedBuiltIn` returns `false`
and the hex wins from then on.

The **fallback block** is the one place `imposed = true` is passed: dropping
`--callout-color` there would leave an unrecognized callout on core's own
default rather than on the fallback's colour, silently breaking the "Default
fallback callout" setting. It gets the variable spelled out explicitly instead,
in one of three shapes depending on the dialect:

| Dialect | Emitted | Why |
| --- | --- | --- |
| reads a colour | `var(--cs-accent-theme)` | the `<color>`-typed hand-off, so a theme writing triplets cannot reach core through us |
| reads a triplet, theme declares one | `var(--callout-error)` | forward it; the accent keeps following the theme |
| reads a triplet, theme declares a colour | a spelled-out triplet | no spelling both follows the theme and parses. This block paints *every* unknown id at an `!important` nothing outranks, so forwarding an unparseable value would take all of them down at once — better to lose the theme-following for these rows than lose the rows |

### The core accent shim

Writing a triplet into `--callout-color` on an Obsidian that wants a colour
costs something precise and enumerable: core's own `app.css` reads that variable
in exactly **eight** declarations, and all eight go invalid at computed-value
time. [`manager/css/coreAccentShim.ts`](../src/manager/css/coreAccentShim.ts)
restates seven of them, re-spelled so they parse. The eighth,
`.callout-icon .svg-icon { color }`, is deliberately absent: it is the only
`color` reaching that element, so when it unsets it *inherits* from
`.callout-title`, which the shim does set.

Three properties of that rule are the whole design, and each is load-bearing:

- **It reads back the variable the plugin itself wrote, where it wrote one.**
  For any callout but an unmodified built-in, `--callout-color` is ours and its
  spelling is known by construction, so reading it back makes the rule a
  *transliteration* of core's rather than a second opinion about the colour —
  and it stays in step with a theme's per-id override, which AnuPpuccin's
  `anp-callout-color-toggle` applies to all 13 built-ins. For an unmodified
  built-in the plugin deliberately writes nothing, so the spelling belongs to
  core or the theme and is a guess; that branch reads `--cs-accent` instead,
  which is guaranteed a real colour. Guessing wrong there would not give a
  near-miss — an unparseable `var()` substitution unsets the property outright.
- **No `!important`, and the selector is `calloutSelDeferring`** —
  `:where(.callout)[data-callout="x"]`, specificity `(0,1,0)`. These are core's
  defaults restated, not the user's choices, so any theme rule must still win.
  Building it from `CSSInjector.sel()` instead would land it at the *studio*
  weight — 5 under AnuPpuccin — and paint an opaque box over the Style Settings
  option the user deliberately chose, which is worse than the bug it fixes.
- **It suppresses any property the active styling already paints
  unconditionally** — a bare `.callout` rule (Obsidian gruvbox's entire callout
  section is one, with a deliberate 20% tint that ties this rule and would lose
  on source order), or a `[data-callout*=…]` family claim, which names no
  callout and so never makes the row theme-owned. The suppression asks
  `PAINTERS`, a table of every declaration name that reaches each property this
  shim emits, because **a theme does not have to name the longhand to own the
  colour**. Sanctum's whole callout section is one bare rule carrying
  `background-color` and `border`; reading only `border-color` suppressed the
  first and missed the second. What that cost was not a colour swap — Sanctum
  sets `--callout-border-opacity: 30%`, so core's `calc(var(--callout-border-opacity)
  * 100%)`, which this shim transliterates, multiplies two percentages and is
  invalid; the declaration unset and the border fell back to `currentColor`.
  Raising Sanctum's **Callout border width** drew a black frame where the theme
  asked for a 30% tint of the accent — and it only became reachable *because*
  writing the triplet dialect had repaired the `rgba()` underneath it. The table
  lives beside the declarations it guards rather than in the scanners: the
  scanners report what a stylesheet says, and only the emitter knows what it is
  about to emit. It also covers both claim sources at once, which two
  recording-site fixes would not.

It is emitted only when `dialect.read !== coreAccentDialect()`, and never for a
row `standsDown` covers. **The fallback block deliberately gets no shim**: its
selector is a `:not()` chain already at `(0,26,1)` in a modest vault, so a
non-important rule on it would still outrank every theme — the opposite of what
this is for. Unknown ids under a legacy theme keep a correct `--callout-color`,
so the theme's own rules work; only core's default background is missing, and
registering the callout is the fix.

### Backgrounds are always translucent tints — never the authored hex

```ts
private bgProps(def, mode, important = false): string[]
```

The colour written to `background-color` is **never** the raw
`bgColorLight`/`bgColorDark` hex. It's `tintCss(tintColorAt(bg, isDark, alpha),
alpha)` — a translucent colour computed so that composited over the theme's
own background it *renders as* the authored hex. See
[Colour system](11-color-system.md#the-nesting-invariant-in-full)
for the actual alpha math (`translucentTintFor` / `minTintAlpha` /
`resolveTintAlpha`) and why this is not optional (the nesting invariant).

`bgAlphaFor()` is a one-line delegation to `resolveBgAlpha()`
([`utils/bgTintAlpha.ts`](../src/utils/bgTintAlpha.ts)), which owns the
*choice* of alpha rather than the maths of the tint: every alpha at or above
the minimum renders this callout identically, so what it decides is how
saturated a colour anything nested inside converges toward. It caps that at
the callout's own accent — and drops a cap it cannot meet rather than let the
background fall back to an opaque fill. See
[Which alpha, and why it isn't simply the smallest](11-color-system.md#which-alpha-and-why-it-isnt-simply-the-smallest).

`transparentBg` short-circuits this entirely: `background-color: transparent`
+ `background-image: none`, checked **before** the "no background hex → emit
nothing" fallthrough, because a transparent definition genuinely carries no
`bgColor*` at all and would otherwise fall through to emitting nothing — and
"nothing" means "hand the callout back to core's own default tint," which is
not the same as transparent.

### Gradients

A gradient adds a `background-image` layer on top of the flat colour (which
still serves as the fallback if a renderer somehow drops the image, and as
`print-color-adjust: exact` insurance). Both stops go through the **same**
tint-alpha solve as the flat colour, at one shared alpha — a gradient can't
ramp alpha across its sweep without tilting it, so the alpha is picked to
clear whichever stop sits further from the page.

`textGradient` sweeps the *title text* separately, through
`textSweepProps()`/`textSweepRules()` — using a **background-clip: text**
technique with a two-layer `background-image` (the text sweep clipped to
text, the callout's own background clipped normally underneath, because
`background-clip` governs `background-color` too via its last layer and a
lone `text` clip would erase the callout's own background along with it). This
technique **does not survive Chromium's print pipeline**
(`background-clip: text` isn't honoured there), so `@media print` explicitly
drops the sweep and falls back to per-grapheme solid colours baked by
`gradientTitleText.ts` instead — see `printGradientCSS` further down for the
matching fix to the *background* gradient itself, which has its own,
unrelated print-pipeline problem (a degenerate gradient box on inline-level
elements, and macOS Preview truncating vector shadings).

### Icon painting

Icons reach the screen through **two separate mechanisms**, and understanding
why both exist matters for anyone touching icon rendering:

1. **CSS `::after` mask/background-image** (`generateIconMaskOverride` /
   `generateImageOverride`), wrapped in `@media screen` — the live-view path.
   A library icon (monochrome glyph) is drawn as a `mask-image` tinted with
   `--cs-accent`; a user-uploaded picture that keeps its own colours is drawn
   as a plain `background-image` instead (a mask is a stencil — running a
   photo through one would flatten it to a silhouette).
2. **A visible inline-SVG (or text) node baked directly into the DOM**
   (`paintIcon()`, called from `paintIcons()`), hidden on screen via the same
   `@media screen` rule that hides the CSS icon in print. This DOM copy is
   what actually shows in exported PDFs, because Obsidian's PDF export drops
   `adoptedStyleSheets` (see the two-target section above) — a CSS mask alone
   would simply be invisible there. The colour is baked as an **inline style
   with `!important`** on the root and every shape, since a presentation
   `fill` attribute loses to core/theme CSS.

```ts
paintIcons(root?: ParentNode): void
```

Called from `injectNow()` on every inject, and separately registered as a
`registerMarkdownPostProcessor` in `main.ts` so newly rendered notes get their
icons painted too. Omitting `root` sweeps **every open window**, not just
`activeDocument` — with a pop-out window focused, `activeDocument` is the
pop-out's document, so a naive default would silently skip the main window (or
vice versa). It handles four separate surfaces per pass: `.callout[data-callout]`
elements (block callouts — via `resolveDef`, which falls back to the
configured fallback callout for unknown ids), heading-bar title spans (for
gradient sync only, not icons — Live Preview's heading bars are CodeMirror's
own DOM and are explicitly skipped), and heading/inline **token** DOM shared
between Live Preview widgets and reading view — with CodeMirror-owned widget
DOM (marked `CSS_CM_WIDGET`) explicitly excluded, because CM rebuilds those
itself when the decoration set changes (see
[Render roles](08-render-roles.md#the-css_cm_widget-marker)).

> [!WARNING]
> **Restoring a callout back to the theme is not just "stop emitting CSS."**
> Obsidian resolves a block callout's icon **once**, the first time it renders
> the element, and never looks at `--callout-icon` again — its own
> post-processor bails early if the icon element already has a child. If this
> plugin already painted a callout's icon and the user later hands it
> to the theme, the plugin's baked SVG would sit there forever unless
> something puts Obsidian's own icon back. `restoreCoreIcon()` exists
> specifically for this: it re-derives what core *would* draw
> (`data-callout-icon` attribute, or `--callout-icon` computed style,
> unwrapped the same way core's renderer unwraps CSS string quoting) and draws
> that instead. It runs **unconditionally**, every pass, for every externally
> styled callout — there's no "did we already fix this one" flag, because
> Live Preview's native callout widget has no forced-rebuild hook this plugin
> can reach, so re-deriving and comparing is cheaper than tracking state.

## Where the generated CSS actually lands in the cascade

Worth getting exactly right, because the answer is more interesting than
"plugins lose to themes" *and* more interesting than "we always win".

Obsidian orders `document.head` deliberately. `Plugin.prototype.loadCSS` does
`document.head.insertBefore(styleEl, app.customCss.styleEl)` — so a plugin's
static `styles.css` is inserted **before** the theme, and loses every tie to
it by design. Snippets go the other way: `loadSnippets` does
`insertAfter(previous)` starting from the theme's own element, so they cluster
immediately behind it and beat it. The full order, later winning ties:

1. `app.css`
2. every plugin's `styles.css`
3. the theme (`app.customCss.styleEl`)
4. enabled snippets (`app.customCss.extraStyleEls`)
5. `document.adoptedStyleSheets` — per CSSOM, after *all* document stylesheets

This plugin's generated CSS is (5), so it beats a theme **and** a snippet at
equal specificity. That is the whole reason theme mode has to exist: load
order cannot save a theme, so something else has to.

**But source order only breaks ties at equal specificity, and the themes that
motivate this flag do not write at equal specificity.** Measured against ITS
Theme (14,856 lines, 718 selectors mentioning callouts), against this plugin's
per-callout `.callout[data-callout="x"]` at `(0,2,0)`:

| ITS selector specificity | count |
| ------------------------ | ----- |
| higher than `(0,2,0)`    | 450 (63%) |
| equal                    | 70 |
| lower                    | 198 |

ITS routinely writes `.callout.callout[data-callout=recite]` `(0,3,0)`,
`.callout.callout.callout.callout:is(…)` `(0,4,0)`, and
`body:not(.default-callout-quote, .callout-no-quote) .callout.callout[data-callout=quote]`
≈ `(0,4,1)`. So against such a theme the outcome is neither side winning
cleanly — it is a **split render**, this plugin carrying the properties the
theme did not escalate and the theme carrying the rest. That is why the
symptom reads as broken rather than merely overridden.

### The three registers this sheet writes in

Everything the generated stylesheet emits sits in one of exactly three bands,
and which band a declaration belongs in is a question about **whose choice it
is**, not about how badly we want it to apply:

| Band | Emitted as | Beats | Loses to |
| --- | --- | --- | --- |
| **Theme-owned row** (`registry.standsDown`) | nothing at all | — | everything |
| **Derived surface** — core's own defaults, restated because the accent spelling broke them | `:where(.callout)[data-callout="x"]` = `(0,1,0)`, **no `!important`** | core, on source order | every theme rule from `(0,2,0)` up |
| **Explicit Studio choice** — chosen accent, authored background, gradient, transparency, icon, global style | `CSSInjector.sel()` at the studio weight, **`!important`** | theme and snippets | a user snippet at `!important` plus one more class-unit |
| **Theme-owned surface** — the active styling says a callout has no background, or frames it in `currentColor` | the theme's own guard + `.callout` at **`weight + 2`**, `!important` | the row above, which is the point | nothing this sheet emits |

The line between the middle two rows is the one that is easy to get wrong: **a
chosen accent colour is not a chosen background.** A background *derived* from
the accent defers to the theme; a background the user authored — a Saved
Palette, a custom colour, a gradient, "transparent" — wins, for that one
property and no other.

And the fourth band inverts the third: **an authored background is still not a
claim on a surface the theme has taken away.** See
[The theme-owned surface](#the-theme-owned-surface) below.

Two consequences worth keeping in mind before touching any of this:

- A rule emitted here is *not* guaranteed to apply. Anything that must hold
  needs either specificity above what the active theme writes, or the
  `!important` register `generateFallbackCSS` speaks in.
- Core's own contract is the cheapest thing to win, because core declares at
  `(0,2,0)` and derives everything else from two custom properties. On
  Obsidian 1.13+, `--callout-color` alone drives the accent, the border, the
  title colour, the icon colour **and** the background
  (`background-color: color-mix(in oklch, var(--callout-color) 10%, transparent)`),
  so deferring to it is both the most compatible and the least code.

### The theme-owned surface

Sixteen of the 257 themes in the dev vault blank the callout background on a
selector that names no id — `body.callout-on .callout { background-color:
transparent }` (GitHub Theme), `body:not(.pt-disable-callout-styling) .callout
{ background-color: unset }` (Prism, Cybertron), `.callouts-outlined .callout`
(Minimal, Oxygen) — and then draw the visible box out of `.callout-title` and
`.callout-content` instead. Four of them leave those two borders **colourless**,
so the frame draws in `currentColor`.

A studio callout is painted at the studio weight with `!important`, so it wins
both declarations and is the only filled box in the note. In Prism it is worse
than a mismatch: `.callout` there carries `--callout-padding: 4px` and a radius
of its own while the *visible* frame is its two children, so a background painted
on it is a 4px halo in the wrong radius — measured as a colour "spilling" out of
the bottom-right corner, because the palette's 135° gradient puts its far stop
there. And the plugin's `.callout-content { color }` reaches the frame through
`currentColor`: on Cybertron, whose built-ins frame themselves in the theme's
cyan `--text-normal`, the studio callout's frame measured `rgb(224,224,224)` —
`#e0e0e0`, which is `DEFAULT_TEXT_COLOR_DARK`.

So [`manager/theme/calloutSurface.ts`](../src/manager/theme/calloutSurface.ts)
resolves two facts and
[`manager/css/themeSurfaceCSS.ts`](../src/manager/css/themeSurfaceCSS.ts) emits
what they cost. Four properties of that block are the whole design:

- **The guard travels with the fact, and is re-stated in the selector.** Twelve
  of the sixteen hide this behind a Style Settings class, and Style Settings'
  `setSetting` only calls `removeClasses()/initClasses()` — **it fires no
  `css-change`**, so a decision taken in JS would never be revisited. Putting the
  theme's own ancestor compound in front of our selector hands the decision back
  to the cascade: one stylesheet carries both states and the browser picks,
  instantly, with no re-inject and no MutationObserver. It is also why this is
  emitted as a *cancel* rather than by suppressing `bgProps` at the source — one
  block covers the light rule, the dark rule, every alias, and the print
  `::before` that `printGradientCSS` paints a second copy of the surface onto.
- **`weight + 2`, not `weight + 1`.** The heaviest thing being cancelled is the
  dark block, whose `.theme-dark` is a class of its own. `weight + 1` would only
  tie it and win on source order.
- **The frame rule never touches `.callout`.** All four colourless-frame themes
  put those borders on the title and the content, and the callout root is where
  `generateGlobalStyleCSS` paints the plugin's own border setting — so the two
  features cannot collide. It also stands down entirely for `transparentBg`,
  whose `transparentBorderProps` already asked for `border-color: transparent`.
- **The content-colour cancel is gated on the value being invented, not on the
  field being set.** `DEFAULT_TEXT_COLOR_LIGHT`/`_DARK` are what the editor fills
  a swatch with; a colour the user picked survives in every theme. Same line
  `hasAuthoredTextColors` draws in `settings/editor/authoredStyle.ts` and
  `dropDerivedBackgrounds` applies retroactively to backgrounds.

One veto, and it is deliberately **global rather than per guard**: if the active
styling colours a generic callout frame *anywhere*, the frame half stands down
entirely. Shiba Inu writes `border: 2px solid` and `border-color: color-mix(in
srgb, var(--callout-color) 40%, transparent)` in the same rule — it colours its
frame from the very variable this plugin sets, so it already works. A per-guard
veto would catch that one and miss a theme that states the colour in a separate
rule under a different guard.

> [!WARNING]
> `generateFallbackCSS` writes `body .callout<chain>`, and every guard the
> scanner accepts is a compound on `<body>` itself — so the guard **replaces**
> that `body` rather than sitting in front of it. `body.callout-on body .callout`
> asks for a body inside a body and matches nothing, silently.

240 of the 257 installed themes resolve to no claim at all and emit
byte-identical text to before this existed.

## One rule, and why there is no setting

`externalStyle` alone could only say "all or nothing", which looked like the
whole answer until the corpus was measured. A callout-heavy theme does not lose
quietly: it takes the properties it escalated and leaves the rest, and the user
sees a **split**, which reads as this plugin being broken.

An intermediate mode cannot fix that, because a mode that wins *some* properties
**is** the failure. A *manual* mode could not fix it either, for a different
reason: it asks the user to answer a question about CSS specificity that they
have no way to evaluate, on a per-callout basis, and to re-answer it every time
they change theme.

So ownership is derived, absolute, and not the user's to set:

```
registry.themeOwns(def)   the active theme NAMES this callout's id
                          → the theme paints it; this plugin emits nothing
                            aimed at .callout
otherwise                 → this plugin paints it, outright, with !important
                            at the derived weight
```

*How* the theme is read, which selectors count as naming an id, and what happens
to the rows on a theme switch is its own chapter:
[21-theme-callout-discovery.md](21-theme-callout-discovery.md). This section is
only what the injector does once that question has an answer.

Three consequences worth stating separately, because each was a decision.

**Every id form counts.** `ThemeFacts.owns` walks `vaultIdFormsFor(def)` — the
id, its aliases, and each one's attribute form. A theme that styles
`[data-callout="tldr"]` but not `abstract` owns the whole callout; letting the
two halves render differently is the split all of this exists to abolish.

**A generic `.callout {}` rule owns nothing.** 55 of the 257 themes in the dev
vault style callouts without naming a single id. Counting those would hand the
plugin's entire job to the theme on half the corpus, for rules that mostly set a
radius.

**`standsDown` is the emission gate and is deliberately broader than
`themeOwns`:**

| | reason | listed under | editable |
|---|---|---|---|
| `themeOwns(def)` | the active theme names the id | *Callouts from your theme* | no |
| `def.externalStyle === true` | the user styles it in their own CSS | their own section, **External CSS** label | yes |

Both mean "emit nothing", so every CSS path asks `standsDown`. Anything deciding
where a row is *listed*, or whether it is read-only, must ask `themeOwns` — an
External CSS row is still the user's.

### Nothing is stored, and that is the design

Ownership is **derived on every read**, never written onto the row. Writing
`source: "theme"` onto a matching row is the obvious "real" migration and it
loses data three ways — the row stops being exported, the next theme switch
deletes it, and an import re-stamps it back. The derivation, and why the empty
owned-set at startup is the safe direction rather than a gap, is
[21-theme-callout-discovery.md § Stage 3](21-theme-callout-discovery.md#stage-3--ownership).

`source` moves in exactly one place: a one-shot re-home of pre-existing
`source: "theme"` rows in
[`manager/styleModeMigration.ts`](../src/manager/styleModeMigration.ts), gated on
`PluginData.version < 4`. That value was inert in every released build, and
without the re-home the sweep would treat such a row as its own and delete it.
The version gate is the marker, because a re-homed row and a row that was always
the user's are indistinguishable afterwards — the neighbouring migrations key on
content instead, deliberately, but this one cannot.

### What the retirement removed

`CalloutDefinition.styleMode` and `PluginSettings.defaultStyleMode` were both
branch-only, never released. Every value `styleMode` held — `"studio"` and the
retired rungs `blend`, `force`, `standard` — meant "this plugin paints it",
which is what its absence means now, so the migration deletes and does not
translate. It stamps **nothing** onto a row: `styleMode` was compared by the
full-strength `isCalloutModified`, so a stamped built-in would be written to
`data.json`, enter exports, and grow a spurious *Reset to default*.

`externalStyle` survives, because it never belonged to that model. It shipped in
2.11.0 and is translated into all 32 locales, and it means something still true
and still the user's: *I style this one myself.* Deleting it would make the
plugin start overriding those users' snippets, with `!important`, on upgrade.

### The one exception that was removed

`hideIcon` used to keep emitting its `display: none` even in theme mode, on the
argument that a theme cannot express "draw no icon" on the owner's behalf. Under
an absolute rule that does not survive: it is an override like any other, and
the one a user is most likely to read as the plugin breaking their theme. The
flag is preserved on the row and applies again the moment the plugin owns the
callout.

### What it emits for a theme callout: nothing, literally

There was one exception for a release. Heading callouts and inline callouts are
the plugin's own `.cs-*` DOM, which no theme selector can match, so painting
them overrides nothing — and a dedicated `themeTokenCSS.ts` emitted the probed
accent for them so that `## [!recite]` would not sit as raw text two lines above
a block callout the theme paints.

That was the wrong trade, and the module is gone. Drawing those two formats
means offering the reader two renderings the theme has no design for and cannot
follow, beside a third the theme draws itself. Three renderings of one callout,
two of them invented by the plugin, is a worse answer than one rendering and
some literal text — and the literal text is at least *legible as syntax*, which
is what tells the user the format is unavailable here.

So a theme callout is **Block only**, and the sentence at the top of this
section is now exact rather than nearly-exact. One gate enforces it:

```ts
// editor/renderShared.ts
export function shouldRenderToken(resolved: ResolvedCalloutDef): boolean {
	return !resolved.external && !resolved.themeOwned;
}
```

Every surface that builds token DOM funnels through it — the Live Preview view
plugin, the reading-view post-processor, the outline decorator, the link-suggest
decorator — so there is no second place for the rule to be got wrong.

Three consequences downstream, each of which had to be handled rather than left
to fall out:

- **Autocomplete** must not offer a theme callout where a heading or a pill is
  being typed. `onTrigger` already classifies the position into a role, so
  `utils/usableCallouts.suggestableCallouts` narrows the list by it.
- **The command builder** must not let one be *built*. The format dropdown is
  rebuilt from the chosen callout (`settings/command/commandRoles.ts`), and the
  two options are absent rather than disabled — with a line saying why, because
  a dropdown that silently loses two entries reads as a bug.
- **An existing command** must not fire and write dead syntax. `syncAll()`
  **suspends** it: unregistered from the palette, left untouched in
  `settings.customCommands`, re-registered at the same id when the theme lets
  go — so the user's own hotkey survives the round trip. The gate is on
  `desiredNames` and never on `kept`, because `kept` is written straight back to
  settings and would delete the command for good.

A pre-existing callout that becomes theme-owned loses the two formats for
exactly as long as the theme claims it, and gets them back with no migration:
nothing left the definition, only what the renderer acts on.

### A theme-invented callout type is an ephemeral overlay

`toSaveData()` skips `source: "theme"`, so a row minted from the theme's
stylesheet is re-derived on every launch and written to `data.json` by nothing.
That is what makes "the theme stopped supplying this, so it is gone" true with
nothing having to undo it, and it is why the sweep has to record what it retired
(`settings.retiredThemeIds`) so vault discovery does not hand the row straight
back one file-open later.

The full lifecycle — the four row kinds and what a theme switch does to each,
`RediscoveryHold`, and why the sweep publishes ownership inside its `batch()` —
is [21-theme-callout-discovery.md § Representation and persistence](21-theme-callout-discovery.md#representation-and-persistence).

## Reading the theme back

`themeCalloutScan` keeps property *names* only, so it can say a theme declares
`--callout-color` for `[!note]` and never what colour that is — and no amount of
parsing fixes that, because the answer is whatever the cascade computes through
variables, `color-mix()`, inheritance or a Style Settings body class. So
`ThemeAppearanceProbe` renders every theme-owned callout once, offscreen, and
reads **used values** off it.

Nothing in the generated stylesheet consumes those readings. They exist for the
surfaces that *list* a callout this plugin does not paint — the settings row's
two swatches and its icon, the small-list icon, the preview window. The probe's
scheduling, the node ladder (`readCalloutStyle.ts`), the accent ladder and the
five-rung icon ladder are all
[21-theme-callout-discovery.md § Stage 5](21-theme-callout-discovery.md#stage-5--reading-the-colours-and-the-icon-back).

One rule from there that everything else depends on: **the fallback is never the
row's stored icon or colour.** Those describe a design that is not on screen.

### Why studio mode uses `!important`

This file used to argue the opposite, and the argument was: our sheet already
cascades after the user's own snippets, so `!important` would leave a user
unable to correct us at all. That was the wrong trade. The common case is not a
user writing a snippet against us; it is a theme quietly taking half of a
callout the user explicitly asked this plugin to style.

The two levers answer different attacks, and studio needs both:

- **`!important`** beats a theme's ordinary declaration at *any* specificity.
- **Selector weight** is what decides between two declarations that are *both*
  `!important`, since the cascade compares specificity again within that group.

Which is why `studioWeightFor` measures only the theme's **`!important`**
callout selectors (`ThemeCalloutStore.maxImportantClasses`). Measuring every
selector would put most vaults near the ceiling for nothing — only 23 of the dev
vault's 257 themes carry `!important` on a callout rule at all, so ordinary
importance already beats the other 234 whatever they weigh, including
AnuPpuccin's ten class-units — while measuring none would lose to the 23 that do
reach for it. The heaviest of those is Elegance at twelve. **No theme in the
corpus both exceeds the ceiling and uses `!important`**, which is the property
that makes 14 a safe number rather than a hopeful one.
Most themes have none, so most vaults stay at `STUDIO_WEIGHT_BASE` (1) and the
emitted selectors are exactly the shape they always were, plus the suffix.
`STUDIO_WEIGHT_MAX` (14) is the ceiling: past that a theme is doing something
pathological and an arms race lengthens every selector in the sheet for
everyone.

Deliberately **not** covered: the `.cs-*` DOM this plugin invents for heading and
inline callouts. No theme selector can match it, so there is nothing to beat and
the user's ability to restyle it in a snippet is the only thing marking it would
cost. The escape hatch for the rest is `!important` plus one more class-unit
than the emitted weight — which at weight 1 is one extra `.callout`, readable
straight off the generated CSS.

The print resets are the subtle half. `textSweepRules`' `@media print` block and
`printGradientCSS`'s `background-image: none` cancel screen declarations at
*identical* specificity, winning only on source order — so they carry the same
importance as what they cancel. An `!important` sweep above an ordinary reset
would print the unclipped block over the title that the reset exists to undo.

## Detecting what the theme claims

Emission needs two answers out of `manager/theme/`, and they come from one text
scan asked two different questions:

- **Which ids does the theme name?** (`ThemeCalloutStore.themeDefinedIds()` —
  the theme's own stylesheet, and only the operators that name exactly one
  callout.) This decides `themeOwns`, and therefore whether anything is emitted
  at all.
- **What is the heaviest `!important` callout selector?**
  (`maxImportantClasses()` — theme **plus** every enabled snippet, every
  operator.) This decides the weight everything else is emitted at.

Collapsing the two breaks both. The scanner itself, the operator rules, what it
can and cannot see, and the row-minting sweep built on top of it are
[21-theme-callout-discovery.md § Stage 2](21-theme-callout-discovery.md#stage-2--scanning-the-stylesheet-for-callout-claims)
and
[§ Stage 4](21-theme-callout-discovery.md#stage-4--minting-rows-for-the-types-a-theme-invents);
when the scan re-runs is
[§ When discovery re-runs](21-theme-callout-discovery.md#when-discovery-re-runs).

> [!WARNING]
> `StudioWeightCache.resolve()` advances `ThemeCalloutStore`'s signature memo as
> a side effect of asking it anything, and it runs *before* the theme sweep on
> the `css-change` path. A caller that wants "did the theme change since I last
> looked?" must keep its own memo.

### The specificity arithmetic

[`utils/cssSpecificity.ts`](../src/utils/cssSpecificity.ts) and
[`utils/selectorText.ts`](../src/utils/selectorText.ts) own it. The regexes they
replaced mis-ranked five of the 53 themes surveyed, and over-counting is the
dangerous direction: it makes the plugin emit heavier selectors than it needs.

## Standing down — why "emit nothing" needs three separate mechanisms

Because the generated CSS operates on several different scopes, "no styling"
needs enforcement in three places:

1. **`generateCalloutCSS(def)` returns immediately**, before the first
   declaration, and there is **no exception**. `hideIcon` used to keep emitting
   its `display: none`, on the argument that a theme cannot express "draw no
   icon" on the owner's behalf; under an absolute rule that is an override like
   any other, and the one a user is most likely to read as the plugin breaking
   their theme. The flag is preserved on the row and applies again the moment
   the plugin is painting the callout.
2. **`generateGlobalStyleCSS()`'s vault-wide rules exclude it by selector** via
   `externalExclusion()`, which builds a `:not(:where(...))` suffix listing every
   theme-styled callout's attribute form. The `:where()` wrapper is deliberate: a
   plain `:not()` chain takes the specificity of its argument, so a naive chain
   would make these global rules progressively *harder* for the theme to
   override as more callouts opt out — exactly backwards. `:where()` contributes
   zero specificity, so the rules stay exactly as easy to override no matter how
   many rows carry the flag. (`generateFallbackCSS`'s own `:not()` chain
   deliberately does the **opposite** — there the growing specificity is what
   lets the catch-all outrank every per-callout rule.) This is also what makes
   the global frame settings part of what "Callout Studio style" *means*: a
   callout handed to the theme is handed over whole, geometry included.
3. **The heading-bar / inline-pill / ref-token render paths skip the token
   entirely** (`shouldRenderToken()` in `renderShared.ts`). Those are the
   plugin's own invented syntax: for an External CSS row there is nothing there
   for the user's snippet to style, and for a theme-owned callout the two
   formats are withdrawn outright — see *What it emits for a theme callout*
   above. This is a real cost, and the UI states it rather than hiding it.

The row **stays in the registry** deliberately — `generateFallbackCSS` builds its
`:not()` exclusion chain from every *known* id including theme-owned ones, so
removing one would hand it to the `!important` catch-all instead, which is the
opposite of "hands off." That catch-all also asks the fallback *template*
whether it stands down and emits nothing when it does, so the fallback target
needs no special case of its own.

## `calloutSel` vs. `tokenAttrSel` — the selector escaping rule

[`src/utils/calloutSelector.ts`](../src/utils/calloutSelector.ts) is the
**only** place selectors are built, specifically because the escaping rule has
to hold for every builder or it's not actually a rule:

```ts
calloutSel(id, themePrefix?)   // Obsidian's own DOM — dasherized attr form
tokenAttrSel(id)                // the plugin's OWN DOM — space-preserving normalized form
cssAttrValue(raw)                // the shared escaper both call
```

> [!IMPORTANT]
> **A `"` or `\` can reach a callout id without the user ever typing it.**
> Vault discovery's header regex (`\[!([^\]\n\r]+)\]`) allows both characters
> — opening a shared note containing `> [!ev"il]` is enough to auto-create a
> row with that literal id. The JSON importer's `ID_BAD_CHAR_RE` also permits
> both (it only rejects pipes, brackets, and raw tab/newline/CR). An unescaped `"` closes the
> attribute selector's string early, corrupting that rule; a *trailing* `\`
> escapes the closing quote the selector itself writes, leaving the string
> token open and swallowing every rule generated after it in the same
> stylesheet. `cssAttrValue` escapes backslash first (order matters — escaping
> quotes first would double the backslashes just added), then quotes, then
> raw newlines as hex escapes.

---
Next chapter: [07-persistence-and-caching.md](07-persistence-and-caching.md)
