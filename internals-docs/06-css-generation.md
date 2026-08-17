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
5. generateFallbackCSS(callouts)   — styles any data-callout Obsidian rendered that this
                                       plugin does not recognize
```

### The three accent variables (`accentProps`)

Every per-callout light/dark block writes up to three custom properties, and
the reason there are three (not one) is version drift plus a deliberate
hand-off point:

| Variable | Owner | Behaviour |
| --- | --- | --- |
| `--callout-color` | Obsidian core | Format changed in **Obsidian 1.13** (full colour string; a bare RGB triplet before) — `calloutColorValue()` resolves the right shape. **Omitted entirely for an untouched built-in** — that's what lets core's own rule (and any theme overriding it) keep deciding the accent. |
| `--cs-accent` | This plugin | Always a real colour on every Obsidian version, so it can feed `color-mix()`. On an untouched built-in it follows the same core variable (`--callout-info` etc.) so the plugin's own surfaces (heading bars, inline pills, borders, icon tints) move with the active theme in lockstep with the block callout itself. |
| `--cs-accent-theme` | This plugin | What makes "always a real colour" true rather than merely intended. Registered `<color>` via `@property` in `styles.css`; a theme's value passes through it on the way to `--cs-accent`, so a theme still writing ≤1.12 bare triplets degrades to that registration's grey instead of resolving to a non-colour and dropping every declaration downstream. Emitted **only** when there is a theme value to launder — the plugin's own hexes are validated into and out of storage and go direct. Deliberately a separate name, not a registration of `--cs-accent` itself: a registered property is never "undefined", which would kill the `var(--cs-accent, currentColor)` fallback the global border rule relies on. |
| `--cs-color-rgb` | Legacy | Bare triplet, kept one release for external consumers still reading it. Cannot follow a theme (a triplet can't be derived from a `var()`), so on an untouched built-in it's a best-effort snapshot of the shipped default. Nothing inside this plugin depends on it anymore. |

`themeAccentVar(def)` returns the Obsidian variable name
(`OBSIDIAN_CALLOUT_VAR[def.id]`, e.g. `--callout-info`) **only** when
`registry.isUnmodifiedBuiltIn(def)` is true. The instant a user edits a
built-in — even just recolouring it — `isUnmodifiedBuiltIn` returns `false`
and the hex wins from then on.

The **fallback block** is the one place `imposed = true` is passed: dropping
`--callout-color` there would leave an unrecognized callout on core's own
default rather than on the fallback's colour, silently breaking the "Default
fallback callout" setting. It gets the variable spelled out explicitly
instead — `var(--callout-error)` etc. — which still follows the theme AND
still imposes the intended hue on every unrecognized id.

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
[Render roles](08-render-roles.md#the-cs_cm_widget-marker)).

> [!WARNING]
> **Restoring a callout back to the theme is not just "stop emitting CSS."**
> Obsidian resolves a block callout's icon **once**, the first time it renders
> the element, and never looks at `--callout-icon` again — its own
> post-processor bails early if the icon element already has a child. If this
> plugin already painted a callout's icon and the user later marks it
> `externalStyle`, the plugin's baked SVG would sit there forever unless
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
equal specificity. That is the whole reason `externalStyle` has to exist: load
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

## The style-mode ladder

`externalStyle` alone could only say "all or nothing", which is the wrong shape
for the split-render problem above. [`src/manager/styleMode.ts`](../src/manager/styleMode.ts)
resolves three states out of two persisted fields:

| Mode | Persisted as | Emits |
| ---- | ------------ | ----- |
| `theme` | `externalStyle: true` | nothing (except `hideIcon`) |
| `standard` | neither field | everything, at `(0,2,0)` — unchanged |
| `force` | `styleMode: "force"` | everything, at `(0,9,0)` |

**Two fields rather than one, deliberately.** `data.json` syncs between devices
that may run different builds. A build too old to know `styleMode` ignores it —
and ignoring `"force"` costs nothing (the callout renders as it always did),
while ignoring a hypothetical `styleMode: "theme"` would mean *restyling a
callout its owner handed to their theme*. Keeping the old spelling for the old
state also means zero migration: every existing row already reads correctly.

`applyStyleMode` writes at most one field and deletes the other, so no row can
claim two states; `styleModeOf` resolves `externalStyle` first if hand-edited
data manages both.

### How force escalates

`calloutSelAt(id, weight)` repeats `.callout`, so weight *w* lands the rule at
`(0, w+1, 0)`. Everything routes through `CSSInjector.sel()`, which reads an
ambient `emitWeight` set once per callout — a parameter would have had to thread
through a dozen emitters. `calloutSel` is now `calloutSelAt(id, 1, …)`, which is
why standard-mode output is **byte-identical** to what shipped; `tests/styleMode.test.ts`
asserts exactly that, and it is the property that made this safe to land.

`FORCE_WEIGHT_DEFAULT` is 8 because it was measured, not guessed:
`themeCalloutScan` reports a worst case of 7 class-units across the themes on
hand (ITS Theme on `[!quote]` and `[!recite]`; Baseline and Cupertino peak at
6). Weight 8 puts the light rule at 9. An earlier draft used 6, which merely
*tied* ITS.

**Force never reaches for `!important`,** and the reason is not squeamishness.
This plugin's CSS already cascades after every snippet, so at equal importance
it beats the user's own CSS too. Adding `!important` would leave a user wanting
to correct one property in their own snippet unable to — they could only answer
with `!important` and would still lose on source order. A high-specificity rule
always leaves one more class as an escape hatch. The corollary is that force
cannot beat a theme that shipped `!important`, and the report says so out loud
rather than letting the user discover it by trying.

## Detecting what the theme claims

[`src/manager/theme/`](../src/manager/theme/) answers "which callouts does the
active styling also style?" — three small modules, no network, no disk.

- **`customCssApi.ts`** is the only place `app.customCss` is named. None of it
  is in `obsidian.d.ts`, so every field is optional and every reader degrades to
  "no theme information" instead of throwing. Note `extraStyleEls` is index-
  aligned to the *enabled* snippet subset, not to `snippets`.
- **`themeCalloutScan.ts`** is a pure text scanner: no DOM, no `CSSStyleSheet`.
  The tempting implementation is `replaceSync()` into an unadopted sheet and a
  `cssRules` walk — but that type does not exist in this repo's test DOM, and a
  scanner nobody can test is how a false conflict badge ships. It counts only
  `=` and `^=` matchers; `*=` would read ITS's `[data-callout*=column]` as a
  callout named "column" that nobody has, and `^=` is a *prefix*, matched with
  `startsWith` rather than treated as an id. Blocks are found by depth-matched
  braces so a rule inside `@media` is not swallowed. ~7 ms over ITS's 846 KB.
- **`ThemeConflictStore.ts`** caches by theme name + version + enabled snippet
  names, and is created by the **settings tab**, not by `main.ts`. The report is
  only ever shown in settings, and hanging an 850 KB parse off `css-change` —
  an event that already costs a full editor rebuild — would tax every user to
  populate something almost none of them are looking at.

A claim is "the theme is winning" when its class count exceeds 2, the weight of
a standard per-callout rule. Strictly greater: an equal count is a tie, and a
tie is one this plugin wins on source order.

## `externalStyle` — the opt-out, and why it needs three separate exclusion mechanisms

A callout marked `externalStyle: true` is meant to be invisible to this
plugin's generated CSS. Because the generated CSS operates on several
different scopes, "no styling" needs enforcement in three places:

1. **`generateCalloutCSS(def)` returns almost immediately** for such a
   definition — the one exception is `hideIcon` (a theme can't express "no
   icon" on the user's behalf, so that one rule survives).
2. **`generateGlobalStyleCSS()`'s vault-wide rules exclude it by selector** via
   `externalExclusion()`, which builds a `:not(:where(...))` suffix listing
   every externally-styled callout's attribute form. The `:where()` wrapper is
   deliberate: a plain `:not()` chain takes the specificity of its argument,
   so a naive chain would make these global rules progressively *harder* for
   the theme to override as more callouts opt out — exactly backwards.
   `:where()` contributes zero specificity, so the rules stay exactly as easy
   to override no matter how many rows carry the flag. (`generateFallbackCSS`'s
   own `:not()` chain deliberately does the **opposite** — there the growing
   specificity is what lets the catch-all outrank every per-callout rule.)
3. **The heading-bar / inline-pill / ref-token render paths skip the token
   entirely** (`shouldRenderToken()` in `renderShared.ts`) — those are the
   plugin's own invented syntax, so there's no theme fallback for them to
   defer to; rendering a half-styled token would just look broken.

The row **stays in the registry** deliberately — `generateFallbackCSS` builds
its `:not()` exclusion chain from every *known* id including external ones, so
removing an external-style row from the registry would hand it to the
`!important` catch-all instead, which is the opposite of "hands off."

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
