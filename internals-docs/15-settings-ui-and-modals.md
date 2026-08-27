# Settings UI and modals

Covers [`src/settings/SettingsTab.ts`](../src/settings/SettingsTab.ts), the
section modules under `src/settings/sections/`, the shared modal chrome, and
the individual modals not already covered by
[Callout editor](13-callout-editor.md) or [Icons](12-icons.md).

## `SettingsTab` — composition and refresh plumbing

`CalloutStudioSettingsTab.display()` renders 11 sections in a fixed order
into one scrollable tab: callout lists → fallback → custom palettes → global
settings → autocomplete → context menu → hotkeys → import/export → language →
reset → credits → footer.

### `getSettingDefinitions()` returns `[]` — deliberately, and only for now

```ts
getSettingDefinitions(): unknown[] { return []; }
```

This is Obsidian 1.13+'s declarative-settings hook, which powers the
in-app settings search index. **Returning an empty array is what keeps
`display()` running on every Obsidian version**: on <1.13 the method doesn't
exist and is never called; on 1.13+, an *empty* result falls back to
`display()` (a **non-empty** result would disable `display()` entirely and
render only from the declared definitions). Defining the method at all —
even empty — is the sanctioned way to satisfy the `obsidianmd/settings-tab/
prefer-setting-definitions` lint rule without actually re-architecting the
tab. Populating real per-setting entries would mean reproducing all 11
sections declaratively, verified on a real 1.13 build — deliberately
deferred (see the [`settings-getsettingdefinitions`](#) memory note if one
exists in this project's history; functionally, this is a `[]` returned on
purpose, not a stub someone forgot).

### Three subscriptions, one coalesced refresh

```ts
registry.onChange(sub)         → scheduleListRefresh()
registry.onPreviewChange(sub)   → scheduleListRefresh()
plugin.onIconCacheChange(cb)     → scheduleListRefresh()
workspace.on("css-change", cb)    → scheduleListRefresh()   // theme-mode swatch colours
```

All four funnel into one `requestAnimationFrame`-coalesced refresh
(`scheduleListRefresh`), so a burst of related events (a registry mutation
that *also* triggers `css-change`) costs exactly one re-render, landing on
the very next paint rather than a beat later. The `onPreviewChange`
subscription specifically is what keeps a row's swatch tracking the callout
editor's in-progress colour picks live, without the preview reaching
`saveSettings()` or forcing a document-wide re-render — see
[Callout registry § the transient live-preview slot](05-callout-registry.md#the-transient-live-preview-slot).

### `display()` also does two side-effecting things before rendering anything

```ts
this.scanOpenEditorsForUnknownCallouts();
this.plugin.schedulePruneUnusedFallbacks(0);
```

Opening the settings tab **scans every open editor's in-memory buffer** for
unknown callout ids (not just what's on disk — an unsaved buffer counts) and
immediately schedules a prune pass. This is exactly the scan that
`CalloutDiscovery.suppressRediscovery()` exists to protect a just-deleted
row from — see
[Vault discovery § rediscovery suppression](10-vault-discovery.md#rediscovery-suppression--the-delete-race).

### Section disposers

Each section that registers a resource needing cleanup (an event listener, a
timer) returns a disposer via `ctx.registerDisposer(fn)`; `display()` runs
every previously-registered disposer **before** rebuilding, and `hide()`
runs them on tab close. This is what keeps a section's `MutationObserver` or
subscription from silently accumulating across repeated `display()` calls.

## Folding and paging — the callout lists, and Saved color palettes

[`CalloutListsSection.ts`](../src/settings/sections/CalloutListsSection.ts)
builds *Callouts from your theme*, *My callout types* and *Built-in
callouts*, in that order, from one pass over one combined list (see
[Theme callout discovery](21-theme-callout-discovery.md) for who lands
where). Two behaviours sit on top of that split, each in its own helper —
and [`CustomPalettesSection.ts`](../src/settings/sections/CustomPalettesSection.ts)'s
*Saved color palettes* heading is a fourth member of the same family rather
than a parallel implementation: it calls the identical `attachPersistedFold`
and `renderPagedList` helpers, just keyed `"palettes"` instead of a `RowKind`.
Its "Unlinked colors" sub-section — offering to rebuild a palette a deletion
orphaned — neither folds nor pages on its own, and lives in a sibling module,
[`PaletteOrphanGroups.ts`](../src/settings/sections/PaletteOrphanGroups.ts),
so `CustomPalettesSection.ts` itself stayed under the repo's line-count
ratchet instead of raising it.

### `sectionDisclosure.ts` — a heading you can fold

`attachSectionDisclosure(setting, bodyEl, initiallyExpanded = true, onToggle?)`
gives a heading the same chevron the credits block has had since it shipped,
and returns `{ setName, setExpanded, isExpanded }`. `onToggle`, if given,
fires with the new state on a user-driven click or keypress only — not when a
caller drives the returned `setExpanded` — which is what lets a caller
persist just the user's own choice; see
[Where the state lives, and how long](#where-the-state-lives-and-how-long)
for the one caller that does.

Three things about it are decisions, not incidentals:

- **It is not `<details>`/`<summary>`.** The credits block is, and gets its
  state, its toggle and its AT mapping free from the browser. These headings
  are `Setting` rows, and *My callout types* carries the **Add new callout**
  CTA in its control slot — a `<summary>` wrapping a button is a button that
  folds the section every time it is pressed. So the state, the keyboard
  (`Enter`, `Space`) and the aria contract are written out here.
- **The control is `setting.nameEl`, not `settingEl`.** The name element
  spans the title line and stops short of `.setting-item-control`, which is
  what keeps that CTA pressable without a target check. It also keeps the
  button's accessible name to `"My callout types (4)"` rather than the whole
  row including a paragraph of description. `role="button"`, `tabindex="0"`,
  `aria-expanded` and `aria-controls` all live on it; the chevron is
  `aria-hidden`, because `aria-expanded` already says what it says.
- **`setName` is wrapped.** Each list rewrites its heading on every render to
  update the `(N)`, and Obsidian's `setName` *replaces* `nameEl`'s children —
  which is where the chevron lives. Attributes survive that; elements do not.
  Callers therefore go through `fold.setName(...)`, never
  `setting.setName(...)`.

Folding toggles `is-collapsed` on the heading and on the body. That is
deliberately **not** `cs-hidden`: the theme *section* hides itself with
`cs-hidden` when it has no rows, and one class toggled for two reasons means
whichever ran last decides — a fold would reopen an empty section, or an
empty section would reopen a folded one. The two now sit on different
elements as well (the section wrapper hides, the body folds), which makes the
collision impossible rather than merely avoided.

A user-driven toggle is wrapped in
[`foldAnchor.keepHeadingInPlace`](../src/settings/sections/foldAnchor.ts) —
see [Folding a pinned heading](#folding-a-pinned-heading).

Note also that *Built-in callouts* does **not** get `cs-subheader-row` to
reach the chevron styling: that class also sets the smaller type the other
two headings use, and this one is a size larger. The layout rides on
`cs-collapsible-heading`, which all three headings get from the helper.

### The three sections pin their headings

Each of the three callout lists is built into a `div.cs-sticky-section` by
[`stickySection.ts`](../src/settings/sections/stickySection.ts), with its
heading carrying `cs-sticky-heading`. The wrapper *is* the feature: a sticky
box cannot be shifted outside its containing block, so a heading wrapped
together with its own rows is pinned to the top of the settings pane for
exactly as long as those rows last — it is pushed off by the next section's
heading, and the last one lets go with its own last row instead of hanging
over the eight sections below. No scroll listener and no measurement.

The three used to be flat siblings of each other and of everything under
them, and that is the one arrangement that cannot work: one containing block
between them, so all three would pin at the same offset, stack, and never let
go. Un-wrapping them leaves every CSS rule parsing and applying, and silently
removes the behaviour — which is why the structure is asserted in
`tests/calloutListsSectionDisclosure.test.ts` rather than left to the
stylesheet.

Eight consequences are written into `styles.css` beside the rules, and are
worth knowing before touching any of them:

- **The pane's `padding-top` is zeroed and handed to the title row.** A
  sticky `top` is measured from the scrollport's *content* box, so Obsidian's
  `padding-top: var(--size-4-12)` would park the band 48px down with rows
  scrolling visibly through the strip above it. Obsidian's own sticky
  settings header does the same thing one line away —
  `.setting-page.vertical-tab-content { padding-top: 0 }` beside
  `.setting-page-titlebar { position: sticky; top: 0 }`.
- **The band paints `background-color: inherit`, not the `--cs-surface`
  pair.** That pair is defined inside `.cs-modal` and nowhere else, so on the
  settings tab it falls through to `--background-primary` — and that is what
  Obsidian paints this pane on the *desktop only*: `--settings-background`
  under `.is-mobile`, `--modal-background` on a dark tablet. Measured, a dark
  tablet's pane is `rgb(17,17,17)` while `--background-primary` there is
  `#000`; the token would have made the band a visible stripe, which is the
  exact failure `modalSurfaces.test.ts` exists for. `inherit` cannot disagree
  with the pane on any platform. It is a chain: the wrapper declares it too,
  because `background-color` is not an inherited property and the band would
  otherwise inherit `transparent`.
- **The gap under a section lives on that section's own body, and nothing
  else contributes to it.** Space outside a wrapper's content box is space
  with no heading pinned to it, so a 36px margin between wrappers would be
  36px where one heading has let go and the next has not yet caught — the band
  blinks out and back instead of handing over. So `--cs-section-gap` (40px) is
  spent on `.cs-section-body` and only there, the divider between two sections
  is a hairline `border-top` on the wrapper and nothing more, and folded
  sections carry no gap at all — the body is `display: none`, so the gap goes
  with the content it was spacing. (A gap on the heading could not do that
  anyway: a sticky box is constrained by its *margin* box, so a bottom margin
  travels with it and buys no pinned distance.) Three details make "and only
  there" true, and each was a visible bug before it was:
  - The **last** section spends the same variable as `margin-bottom` rather
    than `padding-bottom`. Padding would extend the containing block its
    heading is clamped to and pin the band over its own trailing space; a
    bottom margin on the last in-flow child collapses out through the wrapper
    instead, so the space lands outside and the heading lets go with its last
    row. That gap used to live on the `margin-top` of the plain heading below
    (Fallback callout), which cannot see a fold — collapsed, "Built-in
    callouts" carried 40px of empty space no content justified. That heading
    now sets `margin-top: 0` and keeps only `padding-top:
    var(--cs-sticky-heading-pad-top)`, which is what puts its title as far
    below the hairline as a sticky band's is.
  - **Nothing a section ends with carries trailing space of its own.** A
    scoped rule zeroes `.callout-studio-callout-list`'s 24px `margin-bottom`
    and `.callout-studio-empty-state`'s 12px `padding-bottom` inside a section
    body. Both are correct for a list that ends *mid-*section (Saved color
    palettes, with the Unlinked colors groups under it; the Quick insert
    window), which is why they are dropped here rather than at the source.
  - Both of those rules reach through a **child combinator**, so a wrapper
    element between a section body and its list would silently stop them
    matching. `sectionTrailingGap.test.ts` guards the arithmetic against
    `styles.css` and that structure against the rendered DOM.

  Measured in headless Chrome against Obsidian's real `app.css`, every section
  in every state now ends 40px above its divider — full list, `Load more`
  button, or empty state — and every folded one sits on its divider with only
  the band's own 24px of bottom padding between them.
- **Not on a phone.** `.is-phone` sets `position: static`, and Obsidian makes
  the same call for its own header (`.is-phone .setting-page-titlebar {
  display: none }`). There the pane sits at the top of the modal and reserves
  the band over it — for the floating back and close buttons at
  `--layer-modal` — with `padding-top` rather than by starting lower. Padding
  does not clip, so a band pinned below that strip has rows scrolling through
  it *above* the heading; pinning flush instead only trades that for a title
  under the ✕.
- **The band is square, not rounded.** Obsidian's own `.setting-item-heading`
  carries a corner radius; the plain headings reset it to `0` through the
  `:not(.cs-sticky-heading)` divider rule, which these three are excluded
  from, so they need their own `border-radius: 0` or they are the one rounded
  bar in a pane of square ones — and a round top corner on a box pinned flush
  against the pane's own edge reads as a gap the content behind it peeks
  through.
- **"Callouts from your theme"'s description is a sibling of the heading, not
  part of it.** `renderThemeList` used to write the active theme's name onto
  the heading's own `Setting.setDesc`, which pinned the sentence along with
  the title for as long as the section was on screen. It is now a plain
  `<p class="cs-theme-desc">` next to the heading in the wrapper — written
  from the same place, still folded away with the rest of the section (via a
  `.cs-collapsible-heading.is-collapsed + .cs-theme-desc` sibling rule, since
  it is no longer a descendant of the heading that folds) — so it scrolls out
  from behind the band like any other row instead of staying glued beside the
  title.
- **A row's colour circles need their own stacking context, or they float
  above the band.** `.cs-color-circle-l/-r/-r2` stack front-to-back with
  `z-index: 2/1/0` so the three overlap correctly, but nothing between that
  widget and the pane establishes a stacking context of its own — so those
  values aren't scoped to the widget, they're compared directly against
  whatever else shares the nearest real one, which for a row inside these
  three sections is the pinned heading's `z-index: 1`. Left alone, the front
  circle (`z-index: 2`) outranks the header it's supposed to scroll under, and
  every row's circles paint on top of the band as they pass beneath it.
  `.cs-color-circles` carries `isolation: isolate` to contain its own 0/1/2
  stack — chosen over `position: relative; z-index: 0` because it changes
  nothing about layout or the scrollport, which matters next to a wrapper
  that is deliberately forbidden from setting anything that would (see the
  "nothing between the band and the scroller" test in
  `modalBodyLayers.test.ts`). The same shared class renders in the *Saved
  color palettes* section and inside the callout editor's palette trigger,
  where nothing else is pinned and the fix is a no-op.
- **Folded, the heading's bottom padding is bumped to match its top.** Open,
  the band's top padding is deliberately larger than its bottom — nothing but
  a hairline sits above the title, while the first row below carries its own
  visual weight. Folded, `.cs-section-body` is `display: none`, so that row is
  gone: the next thing down is another folded heading's divider (or, for the
  last section, an unrelated one) — the same "hairline with nothing else
  beside it" the top padding exists for, now on both sides. `.cs-sticky-heading.is-collapsed`
  sets `padding-bottom` to `--cs-sticky-heading-pad-top` so a folded title
  stays centred between the two dividers instead of sitting closer to the
  bottom one. The two padding-tuning spots are asserted to reference the same
  variable in `modalBodyLayers.test.ts`, not just resolve to equal pixels, so
  a future re-tuning of one can't silently pull them back apart.

### Folding a pinned heading

Folding a section whose heading is pinned takes the content out from under
it: the heading stops being stuck, drops back to its own place above the
fold, and everything below jumps up by the height of what went away.
`keepHeadingInPlace` reads the heading's box on both sides of the fold and
hands the difference back to the scroller — two reads and one write, on a
click, with nothing on the scroll path.

It is applied unconditionally on the shared toggle because it is a no-op
everywhere else: only a *stuck* box reports a different top before and after
a change made below it, so the *Saved color palettes* heading that shares the
helper measures zero and the scroller is never touched. The measurement is
guarded rather than assumed — the test DOM has no layout and therefore no
`getBoundingClientRect`, and that absence is what makes the anchor inert
there instead of throwing on every fold.

### The chevron hangs in the gutter

A chevron inserted before the title would push the title along, and three
section headings that shift right the day a fold arrives read as a
regression, not a feature. So the chevron does not take space from the title:
`.cs-collapsible-heading .setting-item-name` carries a
`margin-inline-start` of `calc(-1 * (var(--cs-disclosure-size) +
var(--cs-disclosure-gap)))`, moving the whole title line start-ward by
exactly the chevron's footprint. The chevron fills the space that opens up,
and the first glyph of the title — and the `(N)` after it — lands back on the
x it had before there was anything to fold.

Two properties, `--cs-disclosure-size` and `--cs-disclosure-gap`, are the
single source for that: declared once on `.cs-collapsible-heading` (and on
`.callout-studio-credits`, whose chevron shares the class), read back by the
chevron, which is sized to them, and by the heading, which offsets itself by
their sum. Because a custom property is substituted where it is *used*, the
`1em` size resolves against each heading's own font-size — 15.75px under
`cs-subheader-row`, 15px for *Built-in callouts* — so one rule serves all
three sections and no section carries an offset of its own. The chevron's box
is pinned to the token (`inline-size`/`block-size`) rather than left to the
SVG, because that is what keeps the offset and the thing it offsets in step
whatever `--icon-size` Obsidian or a theme hands the icon.

The chevron hangs into the row's own `--size-4-4` padding, not into content,
and nothing between there and the settings pane clips it: `.setting-item-name`
has `overflow: hidden` in Obsidian's own CSS, but the box is *moved* rather
than overflowed, so the chevron sits inside it; `.setting-item-info` has no
overflow of its own. `margin-inline-start` also means RTL needs nothing extra
— the title's inline-start edge is preserved there the same way.

### `listPaging.ts` — the first 20 rows, then a button

`renderPagedList(host, items, state, renderItem, onLoadMore)` renders at most
`LIST_PAGE_SIZE` (20) rows and, when anything is left over, appends
`.callout-studio-load-more` **as the last child of the list element** — the
list is already a column flex box, so whatever trailing space it sits in (its
own margin mid-section, the section's `--cs-section-gap` when it ends one)
falls under the button exactly as it would under a last row. A sibling would
need spacing of its own, and one more number to keep in step.

One press reveals everything rather than another page: these sections are
tens of rows, not thousands, and a second press would only be a second chance
to lose your place. (`iconpicker/IconGrid.ts` pages repeatedly, per segment,
because its grids run to thousands — a different problem, deliberately not
shared code.)

The button's label is `t("iconPicker.loadMore")` with the hidden count
appended in code — `Load more (14)`. That is the same trick `headingWithCount`
uses for the `(N)`: a numeric suffix on whatever `t()` returns, so it needs
no key of its own in any of the 31 translated locales. Both `headingWithCount`
and `focusFirstRevealed` (below) are exports of `listPaging.ts` rather than
per-section helpers, which is what lets `CustomPalettesSection.ts` reuse them
verbatim instead of reimplementing the same "(N)" and focus-on-reveal logic.

Nothing above the button is faded. The rows carry an icon, two colour
swatches and two buttons, and dimming an interactive row to hint that more
follow lowers its contrast and reads as *disabled*. The count on the button
states the fact a gradient could only gesture at.

Because the button is removed by the repaint that reveals the rest, focus
would otherwise fall to the document body; `focusFirstRevealed` sends it to
the first row that just appeared, with `tabindex="-1"` so the row is a target
for that jump and not a stop on the way through the tab. It finds that row by
querying for `.callout-studio-callout-list` inside whatever host it is given,
so it works for any paged section — Saved color palettes included — not just
the callout lists it was written for.

### Where the state lives, and how long

Both the fold and the page cursor are closure variables on the controller —
one `PagingState` and one `SectionDisclosure` per section — which is what
makes the sections independent and what makes them survive a repaint.
`CalloutListsSection.ts`'s `refresh()` rebuilds every callout row on a
registry change or a theme switch, and `CustomPalettesSection.ts`'s own
`renderList()` does the same for palettes on a create, edit, delete or theme
flip; in both cases a list the user expanded must not fold back up under them.

The page cursor is session-only: rebuilding a section — `SettingsTab.display()`
on every settings-tab visit, or opening `CustomPalettesSection.ts` fresh —
starts a new `PagingState`, so every section reopens uncapped, behind its
`Load more` button again if it was ever pressed. Nobody has asked to keep a
whole vault's icon grid, or a whole vault's saved palettes, on screen by
default, and paging past the cap is a cheap habit to reform.

The **fold** is not session-only. `settings/sections/calloutListsFold.ts`
mirrors each section's `SectionDisclosure` into
`PluginSettings.calloutListsExpanded` (`{ theme, user, builtin, palettes }` —
the first three keyed the same way as `RowKind`, `palettes` added for Saved
color palettes) the moment the user folds or unfolds it by hand —
`attachSectionDisclosure`'s `onToggle` fires only on that user gesture, never
when a caller drives `setExpanded` programmatically, so a save only happens
for a choice the user actually made. `attachPersistedFold` takes any
`keyof CalloutListsFoldState` (not a bare `RowKind`), which is what let
`CustomPalettesSection.ts` become a fourth caller without widening `RowKind`
itself to a concept it has nothing to do with. Both `createCalloutListsController`
and `renderCustomPalettesSection` read the relevant field back as their
heading's `initiallyExpanded` on render, so a folded section stays folded
across a settings-tab reopen and a plugin reload alike; an install upgrading
from before a given key existed merges in `true` for it
(`mergeSavedSettings`, `DEFAULT_SETTINGS.calloutListsExpanded`), so the tab
looks exactly as it did before the upgrade.

The heading count is always the full list a section has — the partitioned
length for a callout list, `settings.customPalettes.length` for Saved color
palettes — never the visible slice. Folding a section, or leaving 20 of 34
rows on screen, changes what is drawn — not how many the user has.

## Modal chrome — the one shell every window wears

[`src/settings/modalChrome.ts`](../src/settings/modalChrome.ts) is a small
file with an outsized effect on the whole UI's consistency. Before it
existed, different modals had independently reinvented a sticky title, a
pinned button bar, or neither — "two carried a sticky title with a rule
under it and a pinned button bar, one drew its rule on a toolbar instead of
the title, and the rest had neither."

```ts
applyModalChrome(modal, { footer?: boolean, wide?: boolean }): HTMLElement | null
removeModalChrome(modal): void
```

Three fixed bands:

```text
┌───────────────────────────────┐
│ title                       ✕ │  header — fixed, rule along its bottom
├───────────────────────────────┤
│ content …                     │  body — the ONLY scroll container
├───────────────────────────────┤
│              [Cancel] [Save]  │  footer — fixed, rule along its top; optional
└───────────────────────────────┘
```

Both rules run **edge to edge**, which is why the geometry lives in this one
module rather than per-modal CSS: `.modal` gives up its own 16px padding to
`.cs-modal`, redistributed to each band as `--cs-modal-inset`, so a rule can
reach the window's sides while text still lines up with the inset. **A new
modal must never re-add padding to `.modal` or `.modal-content` directly** —
that would double the inset.

> [!IMPORTANT]
> **Every window wearing this chrome must set a title, with no opt-out.**
> The two windows that used to skip the header band (a generic confirmation
> dialog and the replace-callout picker) read as unlabelled boxes — Obsidian
> still renders an empty, padded `.modal-title` band even with no text set,
> so *skipping* the title doesn't remove the band, it just leaves it blank
> and confusing. This is enforced structurally, not just by convention:
> `ConfirmModal`'s constructor takes `title` as a **required** parameter
> specifically because it's a generic, reusable dialog — only the caller
> knows what's being confirmed, and a compiler-enforced parameter is what
> keeps a future caller from shipping a headerless one. `ReplaceCalloutModal`
> defaults its title from its `mode` for the same reason.
>
> **`WelcomeModal` is the one deliberate exception** — it's a splash screen,
> opts out of the chrome entirely (`this.titleEl.remove()`), and carries its
> own name as a hero heading in a dedicated left column instead of a
> generic title bar.

`applyModalChrome` is safe to call again on a reopened modal — Obsidian
reuses `modalEl` across open/close cycles, so a stale footer from a previous
open is detached rather than duplicated. It also stamps `cs-modal-stacked`
on the container when another modal is already open underneath it (used by
`styles.css` to paint the correct backdrop dimming for stacked modals on
mobile, where Obsidian's own backdrop layering can't be relied on) — the
open count check is reliable specifically because `Modal.open()` appends
`containerEl` to the document **before** calling `onOpen()`, so this modal is
already counted by the time the check runs.

## Two theme-aware surface tokens

Defined **only** on `.modal.cs-modal` (never redefined per-modal), so
falling through to the bare CSS variable keeps the plain settings tab —
which Obsidian itself paints `--background-primary` — visually unchanged:

```css
.modal.cs-modal { --cs-surface: var(--modal-background); --cs-surface-raised: var(--background-secondary); }
```

- **`--cs-surface`** (fallback `--background-primary`) — anything meant to
  read as flush with the modal window itself: fixed bands, panels, popup
  menus, the ring cut around an icon tile's ✕.
- **`--cs-surface-raised`** (fallback `--background-secondary`) — anything
  meant to read as *raised off* that surface: a group-box header strip, a
  card, a control, a row pill.

> [!IMPORTANT]
> **The two tokens are a pair and must always move together.** Setting one
> alone is precisely how the group boxes broke once: `--background-secondary`
> is only the correct "raised" shade *while* `--modal-background` equals
> `--background-primary` — and mobile dark theme is exactly where that
> relationship stops holding. `.is-mobile.theme-dark` (phone and tablet)
> repoints `--modal-background` **onto** `--background-secondary` itself
> (for OLED-friendly true-black elsewhere), which means a strip painted with
> the naive `--background-secondary` fallback lands on the exact surface
> it's meant to sit *above*, and visually disappears. The fix,
> `.is-mobile.theme-dark .modal.cs-modal` re-derives `--cs-surface-raised` as
> a `color-mix()` step **off `--cs-surface`** rather than naming a fixed
> replacement colour — reproducing the same visual step desktop gets
> (`#1C1C1C` → `#282828`) on whatever the window turns out to be, and
> surviving yet another theme repointing `--modal-background` again in the
> future.

**Deliberately not covered**: `.cs-live-preview-body` and `.cs-gap-demo`,
which are meant to emulate an actual **note** surface inside the modal (the
callout editor's live preview, the spacing-demo widget) — those genuinely
want `--background-primary` regardless of what the surrounding modal chrome
is doing.

> [!TIP]
> Any sticky element must sit at `top: 0`, never a positive offset — a
> positive offset parks an opaque layer *below* the header's rule, which
> visually eats scrolling text passing behind it. See
> `.callout-studio-preview-col` in `styles.css` for the enforced example, and
> `STICKY_LAYERS` in `tests/modalBodyLayers.test.ts`, which every sticky rule
> in the stylesheet has to be registered in with the scroller it sticks
> inside.
>
> Two things the settings-tab band added to that contract. The offset is
> measured from the scrollport's **content** box, so a scroller with its own
> `padding-top` needs that padding moved onto the content before `top: 0`
> means the top of the pane. And `background-color: inherit` is the third
> sanctioned paint beside the two surface tokens — it is the only one
> available to a band sitting *on* a pane whose colour the plugin does not
> choose. See [The three sections pin their headings](#the-three-sections-pin-their-headings).

## Notable individual modals

### `ConfirmModal` — the generic yes/no dialog

Resolves `Promise<boolean>`. Required `title` (see above), optional
`confirmLabel`/`cancelLabel`/`confirmClass` (defaults to
`"mod-warning"` — a destructive action reads as one by default unless the
caller overrides it). Used throughout for anything destructive that isn't
specific enough to warrant its own modal (bulk vault edits, full reset).

### `DeleteCalloutModal` and the replace/delete pivot

Covered in depth in [Vault discovery § delete flow](10-vault-discovery.md#delete-flow).
UI-wise: two body copy variants (in-use vs. unused), and an in-use callout's
footer offers **three** buttons (Cancel, "Replace instead…", Delete) rather
than the usual two — the replace pivot exists specifically because deleting
an in-use callout is presented as a choice, not a single destructive action.

### `PaletteEditorModal` — simple vs. advanced, two background styles

Two-column layout mirroring the per-role global-style popups: a sticky live
preview on the left, titled control cards on the right. **Simple mode**: one
base colour, and the full six-value palette (light/dark accent, background,
text) is auto-derived with contrast correction
(`derivePaletteFromColor` — see [Colour system](11-color-system.md)).
**Advanced mode** exposes independent accent/background/text rows per theme
mode directly, each edit inferring the opposite mode's value
(`inferOppositeModeColor`) — but is only offered while the background style
is **Solid**; a Gradient palette has no advanced per-colour view.

Background style is a further 3-way choice: Solid, Gradient (two-stop linear,
preset direction, an off-by-default "Gradient title text" toggle), or None
(transparent — see [Colour system](11-color-system.md#preset-palettes--hue-named-not-role-named)
for why this is the *only* route to a transparent palette).

The preview renders on a **reserved demo id** (`PALETTE_DEMO_ID =
"palette-demo"`), registered through the same registry preview slot the
callout editor uses — and, notably, **deliberately not**
`PREVIEW_PLACEHOLDER_ID` (the callout editor's own reserved id), because two
concurrently-open demo previews (opening the palette editor from inside the
callout editor) must not collide on one registry slot.

### `GlobalStyleModal` — the three per-role style popups

Also uses a reserved demo id (`STYLE_DEMO_ID = "global-style-demo"`) and the
same live-preview-on-a-registered-row pattern, letting the border/radius/
scale/spacing sliders for block, heading, or inline style show their effect
on a real rendered callout as the user drags them.

### `CommandBuilderModal` — fixed + custom commands, one window

Two lists in one modal: the five fixed commands (plain rows — nothing to
configure but a hotkey), and the user's own built commands (full rows with
add/edit/delete). Both kinds display the same two pieces of information side
by side, deliberately kept separate:

- **A hotkey chip** that only *reads* what Obsidian has bound
  (`hotkeyLink.ts`'s `hotkeysForCommand`), because a shortcut is a fact
  about the row, not something this window can set directly.
- **A button** that *opens* Obsidian's own hotkeys pane, filtered to that
  command (`openHotkeySettings`), because binding a key is Obsidian's job.

The list **subscribes to the registry while open** — deleting a callout from
another surface (the settings row menu) prunes any command depending on it
(via `CustomCommandManager.syncAll()`, see
[Editor integrations](09-editor-integrations.md#customcommandmanager--one-idempotent-sweep)),
and this window has to stop showing a now-deleted command in the same
moment rather than offering a dead row. Everything here **saves itself
immediately** on every change — there's no separate OK/Cancel, matching the
plugin's general save-on-change convention.

### `hotkeyLink.ts` — reading a binding Obsidian doesn't expose a public API for

`printHotkeyForCommand` goes through the undocumented `app.hotkeyManager`,
guarded structurally (an unreadable binding reads as `""`/unassigned rather
than throwing — every internal API access in this codebase follows this
pattern). Because that helper only ever formats the **first** binding on a
command bound to more than one shortcut, showing every binding means
re-implementing Obsidian's own key-formatting tables by hand
(`MODIFIER_GLYPHS`, platform-specific: `⌘⌃⌥⇧` stacked with no separator on
macOS, `Ctrl + Alt + Shift` spelled out with `+` elsewhere) — duplicated
rather than simplified, specifically so the same shortcut can never read two
different ways in two different windows of this plugin.

### `WelcomeModal` — the one chrome opt-out

Covered above under Modal chrome. Shown automatically exactly once, gated by
`settings.welcomeSeen`, only for a genuinely fresh install (no
pre-existing `data.json`) — a user who merely updates into a new version
never sees it. Reopenable any time via the info icon in settings, or the
dev-convenience protocol handler `obsidian://callout-studio-welcome`
registered in `main.ts`.

#### It demonstrates itself with a demo callout of its own

The right column is a real `LiveCalloutPreview` rendering `welcome.sample`,
which shows all three render roles at once. It used to show them with the real
built-ins `tip`, `warning` and `note`, and that was wrong twice over:

- Those are exactly the ids a theme restyles **by name**, so on several popular
  themes the heading and inline examples were unreadable.
- For an *unmodified* built-in, `CSSInjector` deliberately hands the accent to
  Obsidian's own `--callout-tip` variable rather than a hex (see
  [CSS generation](06-css-generation.md)) — so the splash was advertising the
  theme's colours rather than the plugin's.

It now uses `WELCOME_DEMO_ID` (`demo`) and registers its own violet definition
into the registry's transient preview slot via `beforeRender` —
[`welcomeDemo.ts`](../src/settings/welcomeDemo.ts).

##### Why this one id is *not* reserved

`demo` is deliberately **absent** from `RESERVED_DEMO_IDS`, and that is the
single respect in which it differs from the other two demo ids. The splash
sample is copy a user reads, and `> [!global-style-demo]` puts plumbing in the
middle of the one screen whose whole job is to teach the syntax — so this id is
spelled the way a person would write it.

The price is exactly what reservation buys, and it is not worth paying here.
`new-callout-preview` and `global-style-demo` are spelled with a dash, which
`sanitizeCalloutIdInput` folds to a space, so **no user can mint them** and
reserving them costs nothing. `demo` is an ordinary word the editor does
produce (`"Demo"` → `demo`), so reserving it would quietly cripple a callout
somebody legitimately named "Demo": filtered out of the autocomplete, dropped
from their export, rejected by their own re-import — with nothing in the editor
telling them the name was taken. A reserved id has to be one nobody can reach.

What stands in for reservation is that the definition exists **only while the
splash is open**, which is all the isolation it needs: `setPreviewDefinition`
never persists and never notifies, `definitionsForLists()` hides it from every
settings list, and if the user *does* own a real `demo` the preview slot
shadows it and hands the real row back on close (`previewShadowedDef`). The one
residue is cosmetic and transient — their own `[!demo]` callouts in a note
behind the modal repaint violet until it closes. `tests/welcomeSample.test.ts`
pins the non-reservation so a later tidy-up cannot undo the reasoning.

Two halves are needed, and only together:

1. **The id**, which removes the by-name attack — no theme has a rule for an id
   it has never heard of.
2. **A scoped hardening block in `styles.css`**, which handles what an id change
   structurally cannot: a theme's *generic* selectors. `.callout { … !important }`
   still reaches the block role, and plain heading rules still reach the heading
   role — the injected `.cs-heading-callout` / `.cs-inline-callout` rules carry
   no `!important` at all, on purpose, so a theme wins those without a fight.
   The block restates the same values under `.cs-welcome-modal`, keyed on the
   demo id, with repeated compounds for weight (the trick
   `manager/theme/studioWeight.ts` uses). Among `!important` author declarations
   the higher specificity wins, so it survives; and because it is scoped to the
   modal and the id, it can reach nothing else — load-bearing here rather than
   tidiness, since a user may own a real `demo`.

   It restates, and does not invent. All three roles carry
   `color-mix(in oklch, <accent> 12%, transparent)`, which is
   `.cs-heading-callout`'s and `.cs-inline-callout`'s own default formula copied
   verbatim: the hardening changes the *weight* of the plugin's answer, never
   the answer. That is also why the inline example is a tint and not the solid
   violet lozenge it was for one revision — a solid pill is a look the plugin
   gives no other inline callout, so the splash was demonstrating something
   users could not reproduce.

`onDestroy` clears the slot and re-injects. That inject is not just tidying: on
a fresh install this modal holds a preview definition during the very first
launch, and `injectNow` skips the startup CSS snapshot for as long as one is
live — so this is the inject that writes it.

The demo never becomes a real callout. `isDemo` keeps it out of the settings
lists and out of `data.json`, and the slot is cleared on close — see
[Callout registry](05-callout-registry.md#reserved-demo-ids) for the permanent
guarantees the other two demo ids get on top of that, and the section above for
why this one does not take them.

---
Next chapter: [16-i18n.md](16-i18n.md)
