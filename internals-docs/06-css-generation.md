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

Writing `source: "theme"` onto a matching row is the obvious "real" migration.
It loses data three ways:

- `getUserDefined()` excludes `source: "theme"`, and it feeds
  `getExportableDefinitions` → every backup. The row would **silently stop being
  exported**.
- `syncThemeProvidedRows`'s `stale` branch calls `registry.remove()` on an
  uncustomized theme row the moment the theme stops declaring the id.
- `importValidator` re-stamps `source: "user"` on every import, so the flip
  would not even stay done.

Deriving is idempotent, survives import, and is a **no-op in the safe direction**
when the stylesheet reads empty at startup — `CalloutRegistry` takes no `App`
and cannot see the theme when `load()` runs, so the default owned-set is empty
and the plugin styles everything until told otherwise. Standing *down* on a bad
read would strip a user's callouts; standing up cannot.

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

`toSaveData()` skips `source: "theme"`. Such a row is minted from the active
theme's stylesheet on every launch and on every `css-change`, and written to
`data.json` by nothing at all.

That single line is the whole lifecycle model, and it buys two things.

**"The theme stopped supplying this, so it is gone" needs nothing to undo it.**
A persisted row would outlive the theme that justified it — a row for a callout
nothing supplies any more, which the next sweep would have to recognise as its
own and delete.

**Provenance becomes structural rather than a flag.** The sweep's `claimed` set
already refuses to mint over any existing row or alias, so the overlay only ever
holds ids nothing else defines. A definition that survives the retire pass is,
by construction, one that existed before the theme claimed it. No
`introducedByTheme` boolean, nothing to migrate, nothing to get out of step.

| | while the theme claims it | when it lets go |
|---|---|---|
| theme-invented (`recite`) | overlay row, theme section | **gone** |
| pre-existing user callout | theme section, stands down | back to *My callout types*, field for field |
| built-in the theme repaints | theme section | back to *Built-in callouts*, customizations intact |
| discovered fallback row | theme section | back as a fallback row |

Switching straight from theme A to theme B is one sweep and needs no special
case. An id both declare appears in neither list — not stale, because the set
still has it; not fresh, because a row already claims it — so it stays owned
throughout, with no delete-and-remint in the middle.

### What the overlay needs beside it

The notes do not change when the theme does. They still say `> [!recite]`, and
`CalloutDiscovery` reads exactly that and auto-creates rows for ids nothing
defines — so without help, the row the theme switch just removed returns one
file-open later as an uncustomized fallback row: a callout the user never made,
styled by nobody, filed under the callouts they did make.

So the sweep records what it retired into `settings.retiredThemeIds`
([`manager/theme/retiredThemeIds.ts`](../src/manager/theme/retiredThemeIds.ts)),
and `RediscoveryHold`
([`manager/rediscoveryHold.ts`](../src/manager/rediscoveryHold.ts)) answers that
and the seconds-long hold after an explicit delete as **one** question, because
every automatic path asks them in the same breath. Four properties keep it from
becoming a place where ids go to be forgotten:

- **It gates automatic discovery only.** `canUseCalloutId` never reads it, so
  creating the id explicitly still works and is the way to take it over.
- **A user-requested vault scan clears it**, which is the doctrine
  `suppressRediscovery` already followed.
- **The sweep prunes it** — an id something defines again, or that the active
  theme declares again, drops straight back out — so it self-cleans instead of
  growing with every theme the user tries. It is capped as a backstop.
- **An import does not carry it.** It records which callout types *this* vault's
  themes stopped supplying; another vault's history says nothing about this one,
  and adopting it would hold back ids the reader does want discovered.

One more thing the sweep now does: it publishes ownership **inside** the batch.
A theme that starts claiming a built-in mints and retires nothing, yet changes
who paints it, which section the row sits in, whether the editor opens it and
whether a heading command may run. `setThemeOwnedIds` therefore notifies when
the set moves, and everything downstream re-derives from one `onChange`.

## Reading the theme back

`themeCalloutScan` keeps property *names* only, so it can say a theme declares
`--callout-color` for `[!note]` and never what colour that is — and no amount of
parsing fixes that, because the answer is whatever the cascade computes through
variables, `color-mix()`, inheritance or a Style Settings body class.

So [`ThemeAppearanceProbe`](../src/manager/theme/ThemeAppearanceProbe.ts) renders
every theme-owned callout once, offscreen, and reads **used values** off it.
Three things about that are load-bearing:

- **The ancestry.** `.markdown-preview-view > .markdown-rendered`, the same chain
  `quickInsertPreview.ts` rebuilds, because core's and every theme's callout CSS
  is written against reading view.
- **`visibility: hidden`, never `display: none`.** A display-none subtree has no
  used values for the properties that matter; masks and backgrounds come back
  empty and every theme reads as unknown.
- **One batch per theme change**, cached on `stylingSignature` plus the
  light/dark mode, dropped on `css-change`. A request that arrives while a pass
  is still rendering is **held in one slot and re-run**, not dropped: the one
  request that is never redundant is the one `css-change` makes, and dropping it
  left the running pass free to write the *outgoing* theme's readings into the
  cache it had just been cleared of, with nothing scheduled to correct them.

### Which node is asked

[`readCalloutStyle.ts`](../src/manager/theme/readCalloutStyle.ts) owns this and
nothing else, because it is a real question with non-obvious answers — and
getting it wrong is invisible. **Reading one node where the theme spoke on
another is indistinguishable from the theme having said nothing**, so the whole
family of themes that does so simply rendered as *core's defaults* in the
settings list, while looking perfectly right in the Quick Insert window and the
preview modal (which render a real callout and so never ask).

Two such families, and Obsidian's own stylesheet explains both:

```css
.callout             { --callout-color: var(--callout-default); }  /* blue */
.callout-title       { color: rgb(var(--callout-color)); }
.callout-title-inner { color: var(--callout-title-color); }
:root                { --callout-title-color: inherit; }
```

`--callout-title-color` is core's documented hook for a callout title's colour,
and **25 of the 257 installed themes use it — 13 of them without ever setting
`--callout-color`**. For those, `.callout-title` keeps core's default hue
forever while the title the reader actually sees carries the theme's. And **21
themes hide the *drawing* rather than the slot** — `.callout-icon > svg
{ display: none }`, or the descendant form — painting their own artwork on
`.callout-icon::before` with a mask instead.

The ladder in [`themeIcon.ts`](../src/manager/theme/themeIcon.ts) is ordered by
how definitive the evidence is rather than how common the mechanism is:

| Rung | Evidence |
|---|---|
| `hidden` | computed `display: none` on `.callout-icon` |
| `svg` | real child markup **that is itself displayed** |
| `mask` | computed `mask-image` on `.callout-icon` **or its `::before`** — a stencil, no SVG to clone |
| `glyph` | a `::before` with `content`, copied with its font |
| `unknown` | nothing legible; callers draw a neutral placeholder |

`hidden` outranks `svg` because a theme that hides the icon may leave core's
markup in place; `svg` outranks `mask` because a mask behind real markup is
decoration on top of the drawing. The `svg` rung asks whether the child is
*displayed* for the very same reason as the first of those, one node deeper:
testing `display` on `.callout-icon` alone reproduced the exact icon the theme
had switched off, so every row drew core's default pencil.

The accent ladder in
[`themeAppearance.ts`](../src/manager/theme/themeAppearance.ts) follows from the
same evidence-first ordering:

1. **The `::before`'s own paint**, when the `::before` is what draws the icon —
   its `background-color` under a mask, its `color` under a glyph. Core paints no
   `::before` at all, so a painted one is always a theme saying so.
2. **`.callout-title-inner`'s colour** — the hook above. Safe to add precisely
   because it defaults to `inherit`, so it is byte-identical to rung 3 for every
   theme that ignores it.
3. **`.callout-title`'s colour** — `rgb(var(--callout-color))`.

The child `<svg>`'s own colour is deliberately *not* a rung. Core paints it
`rgb(var(--callout-color))`, so it would only duplicate rung 3 — while letting
the handful of themes that neutralise their icon artwork (`--text-muted`,
`transparent`) drain the colour out of a swatch that is currently right.

**The fallback is never the row's stored icon or colour.** Those describe a
design that is not on screen, and showing them is the exact bug this replaces —
one that looks like a feature, because a wrong icon is indistinguishable from a
right one until you compare.

One honest limit: only the current appearance mode can be read. A nested
`.theme-light` wrapper does not flip a theme that writes `body.theme-dark …`,
and flipping the real body would repaint the user's screen.

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
selector would put most vaults near the ceiling for nothing — across the dev
vault's 257 themes the heaviest callout selectors run to twelve class-units
(Elegance, Faded) and AnuPpuccin to ten, and none of those carries
`!important`, so ordinary importance already beats every one of them — while
measuring none would lose to the themes that do reach for it. **No theme in the
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

`manager/theme/` answers two different questions from the same scan, and
collapsing them would break both.

### Two questions, not one

**Enumeration** — *which callout types does the theme add?* — reads the theme's
stylesheet only, and only the operators that name **one** callout: `=` and
`~=`. A family operator names no callout at all: `[data-callout*="column"]`
says "everything containing this", and inventing a type called *column* out of
it would put an id in the user's settings list that neither their vault nor
their theme ever declared. Snippets are excluded too: the section is called
*Callouts from your theme* and has to mean it — a snippet the user wrote is
their own work.

`~=` looks like a family operator and is not one here. It matches a
whitespace-separated word list, and Obsidian writes only the callout *type*
into `data-callout` — metadata goes to `data-callout-metadata` — so that list
always holds exactly one word and `~=infobox` matches precisely what
`=infobox` matches. Leaving it out was a measured false negative rather than a
conservative choice: ITS Theme declares `infobox`, `cards`, `timeline`,
`aside`, `kanban` and `caption` that way and no other way, so six of the types
its users reach for most never appeared in the list at all.

The keys are the **attribute form** (`obsidianCalloutAttrId`), not the text as
written, and that is load-bearing rather than tidy. ITS writes
`[data-callout~=Metadata i]` in 24 rules; keyed as written, that entry matches
nothing any caller can ask for, so `themeProvidedRows` mints a row for it,
fails to recognise its own row on the next sweep, deletes it, and mints it
again — forever, on every `css-change`.

A third, looser question sits beside these: **does the theme style callouts at
all?** (`themeStylesCallouts`). A bare `.callout { … }` makes no claim on any
id, so the scan records nothing for it, yet the theme is unmistakably styling
callouts — 54 of the 257 themes in the dev vault are exactly that shape, and
another 134 leave callouts alone entirely. Telling those two apart is what
stops the settings list filing every built-in under a theme that is not
touching them.

**Weight** — *how hard must studio push?* — reads the theme **and** every
enabled snippet, through every operator, because studio has to outrank whatever
is actually on the page whoever wrote it. Deliberately one number for the whole
sheet rather than per callout: a per-id number would be tighter, but it would
mean trusting the scanner's attribution of every selector to decide whether a
callout the user explicitly asked to be styled actually gets styled, and being
wrong there is silent.

A claim inside `:not()` is an **anti**-claim and is dropped.

### Theme-provided rows

[`manager/theme/themeProvidedRows.ts`](../src/manager/theme/themeProvidedRows.ts)
turns the enumeration into real registry rows (`source: "theme"`, defaulting to
theme mode, so nothing is emitted for them). Three properties keep the sweep
from destroying anything, and each is tested:

1. **It never touches a row it did not mint.** The mint step skips any id that
   already has a row or is somebody's alias.
2. **A row the user adopted is re-homed, not deleted.** A customized
   `source: "theme"` row whose type the theme stops declaring becomes
   `source: "user"` and moves down into *My callout types* intact.
3. **It is idempotent.** Two runs on the same stylesheet write nothing.

That third one is what makes the `css-change` chain terminate. Round 1: the
signature moved, rows change inside one `registry.batch()`, one `onChange`,
`inject()` produces different text and triggers `css-change`. Round 2: the
listener re-injects with `emitCssChange = false`, the text is byte-identical so
`injectNow` returns before the swap, and the sweep finds an unchanged signature.
Two rounds, then quiet.

[`manager/theme/themeRowSync.ts`](../src/manager/theme/themeRowSync.ts) is the
scheduling half, and owns the whole `css-change` response — drop the published
readings, sweep, re-inject, then probe and re-inject — because the *order* is
the load-bearing part and `main.ts` is wiring, not the place to keep a rule
about which of two theme-dependent passes goes first. The split is the same one
`themeCalloutScan`/`ThemeCalloutStore` and `themeAppearance`/`ThemeAppearanceProbe`
already use: the sweep is a function of a registry and a store, and *when* to
run it is a separate question with its own failure modes.

Two of those failure modes are worth stating outright, because both look
correct from the end state and only go wrong in the timing.

**Dropping the readings is not the same as invalidating the probe.**
`ThemeAppearanceProbe.invalidate()` clears the probe's own cache, but nothing
draws from that cache — every row reads `ThemeFacts`, which the probe rewrites
only when its next pass lands. The sweep's `setThemeOwnedIds` fires an
`onChange` a turn earlier, and the settings tab repaints on it, so every row
came up wearing the **outgoing** theme's artwork and colours. So the response
clears `setThemeAppearances(new Map())` too, inside the sweep's own
`registry.batch()` — which makes it free: the clear and the sweep collapse into
the one `onChange` the sweep was going to fire anyway, and callers already have
to handle `UNKNOWN_APPEARANCE` for the window before the probe lands.

**The memo has to notice a reload.** `stylingSignature` is theme name, theme
version and enabled snippets, and a theme edited in place and reloaded moves
none of the three — so a callout id added that way never got a row, however
many `css-change` events went by. The memo here is that signature plus
`themeCss(app).length`, and when it moves the sweep calls
`ThemeCalloutStore.invalidate()` so the store re-scans despite its own
signature being unchanged. The length is deliberately *not* folded into
`stylingSignature`: that function is asked on every inject, by
`StudioWeightCache`, and reading `styleEl.textContent` allocates the entire
stylesheet — hundreds of kilobytes for exactly the callout-heavy themes this
matters for. This memo is read twice per theme change.

One trap for anyone adding a second consumer: `StudioWeightCache.resolve()`
advances `ThemeCalloutStore`'s signature memo as a side effect of asking it
anything, and it runs *before* the sweep on the `css-change` path. A caller that
wants "did the theme change since I last looked?" must keep its own memo.

### The specificity arithmetic

[`utils/cssSpecificity.ts`](../src/utils/cssSpecificity.ts) and
[`utils/selectorText.ts`](../src/utils/selectorText.ts) own it. The regexes they
replaced mis-ranked five of the 53 themes surveyed, and over-counting is the
dangerous direction: it makes the plugin emit heavier selectors than it needs.

## Theme mode — why "emit nothing" needs three separate mechanisms

Because the generated CSS operates on several different scopes, "no styling"
needs enforcement in three places:

1. **`generateCalloutCSS(def)` returns almost immediately.** The one exception
   is `hideIcon` — a theme cannot express "no icon" on the user's behalf, so
   that single rule survives, and stays *un*-`!important`, since the promise of
   theme mode is that nothing of ours competes with the theme's own positioning.
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
   entirely** (`shouldRenderToken()` in `renderShared.ts`) — those are the
   plugin's own invented syntax, so there is no theme styling for them to defer
   to, and rendering a half-styled token would just look broken. This is a real
   cost of theme mode, and the UI states it rather than hiding it.

The row **stays in the registry** deliberately — `generateFallbackCSS` builds its
`:not()` exclusion chain from every *known* id including theme-styled ones, so
removing one would hand it to the `!important` catch-all instead, which is the
opposite of "hands off." That catch-all also asks the fallback *template's* own
mode and emits nothing when it stands down, which is what let `setStyleMode`
drop its old special case for the fallback target.

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
