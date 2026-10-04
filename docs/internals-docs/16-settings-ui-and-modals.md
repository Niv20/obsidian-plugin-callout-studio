# Settings UI and modals

Covers [`src/settings/SettingsTab.ts`](../../src/settings/SettingsTab.ts), the
section modules under `src/settings/sections/`, the shared modal chrome, and
the individual modals not already covered by
[Callout editor](14-callout-editor.md) or [Icons](13-icons.md).

## `SettingsTab` — composition and refresh plumbing

`CalloutStudioSettingsTab.display()` renders its sections in a fixed order into
one scrollable tab: callout lists → fallback → custom palettes → global settings
→ context menu → hotkeys → import/export → language → danger zone → footer.

**Danger zone** contains **Convert to standard Markdown** first and
**Reset everything** second. Its **Review conversion** button opens the registered
`PortableConversionView` directly in the right sidebar and closes settings.
The question-mark button sits at the far trailing edge of the sidebar's title
row. It opens `PortableConversionHelpModal`: an **About conversion** explanation
with one four-row **Before**/**After** table, isolated LTR source text, and a
backup recommendation. Heading and inline examples share the table without
separate subheadings.
The help modal performs no vault reads and has no conversion action.
The **Review conversion** tab is created only by this action, rather than at
startup. A tab restored by Obsidian from an earlier session is closed during
plugin startup, so the review does not remain open across launches.

**Review conversion** groups before/after replacements and dependent
link repairs by file, using the shared `ui/sidebarResults.ts` components. Each
card shows its format and line number, with muted interface-font labels beside
the monospace **Before** source and **After** replacement. Only the separate
checkbox changes inclusion; the format/line label and **Before** text form the
source-navigation button, while **After** starts inline editing. Source and link
changes on the same selected heading line share one card. Each inline token,
including its optional payload, has a separate card and selection; headings show
their complete source line. Both previews wrap without truncation. Rows paginate in batches of
100; all remain available. `ui/sidebarFrame.ts` supplies the identical heading,
short subtitle, and result-summary components to both sidebars. The conversion
subtitle sits opposite the red conversion button. A master checkbox before the
summary has empty, indeterminate and checked states. Clicking an empty or partial
selection selects all; clicking the fully checked state clears all choices.
The indeterminate dash uses Obsidian's checkbox fill and marker colors so it
matches the checked mark across themes.
Occurrence filters have localized accessible names without visible labels.
Each fixed toolbar sits outside its own results scrollport, so controls
stay visible without a measured sticky offset; file headings stick at zero
inside the scroller. Keyboard focus has an outline; a pointer press adds none.
The shared summary owns equal block padding between its top rule and the toolbar's
bottom rule; the toolbar adds no trailing padding. The conversion checkbox shares
the summary's center alignment and clears the host's positional checkbox offset.
Both sidebars use a centered, maximum-1000px layout and a row-major, left-to-right
two-column card grid at 680px pane width, while file headings span both columns.

`portableConversionNavigation.ts` shares active-file tracking and source opening
with occurrences via `ui/sidebarActiveFile.ts` and `ui/sidebarNavigation.ts`.
Fingerprint plus source-line validation preserves repeated-line identity;
changed documents may relocate only a unique unchanged line. Navigation never
modifies text or conversion choices, and stale asynchronous selections cancel.
Both sidebars open a note at its beginning when its file heading is clicked;
counts appear in parentheses after the file name, drawn like every other
heading count (see [Heading counts](#heading-counts--one-n-everywhere)). The
shared file-heading button uses its visible name and count as its accessible
label, without a redundant hover tooltip. The shared
`ui/sidebarSelection.ts` observes selection transactions forwarded by the existing
CodeMirror extension. Moving or collapsing the selection, adding another selection,
or changing the document clears the active card without polling. Subscriptions
are released when the active card changes or the sidebar closes.

`portableConversionWatch.ts` listens only while open, debounces changes by 350 ms
and invalidates affected cache entries. Stale previews immediately disable
conversion. Progress appears as an overlay only after 600 ms, so brief refreshes
do not move the toolbar or flash status text. Persistent errors/recovery guidance
have their own region in the result scrollport. Exact unchanged row identities preserve
selection; new or edited rows require fresh selection. Closing releases events,
timers and preview state. Locale changes redraw the view without losing choices.

Each editable source card has a pencil at its upper trailing corner. It fades
in on hover or focus within the card and remains visible for touch input. The
pencil, the replacement text, and the source card's icon-bearing Obsidian context
menu all start the same inline edit through `portableConversionCustom.ts`.
The `rotate-ccw` restore button beside the pencil is available only when the
current replacement differs from the automatic default. During editing its
visibility follows each keystroke, so returning to the default immediately
hides it. It discards a dirty draft and restores the last saved value, or
restores the default when the current value is already saved.
`portableInlineReplacement.ts` edits **After** inside the card and keeps the
read-only **Before** row visible, without separate Save or Cancel buttons.
Entry selects all editable text and keeps the field focused without opening or
scrolling the note. The card receives its own purple editing highlight;
the previous source-navigation highlight clears so only one card stays purple.
Checkbox inclusion is unchanged. Source navigation remains on the format/line
label and **Before** text.
The monospace input inherits the card background and removes the host's input
border, shadow and outline. Both diff rows use the same explicit font sizing
and label column so their source text aligns. Hover and editing states use a
soft accent tint derived from the active theme.
`portableReplacementEditor.ts` exposes one value for the selected inline token,
without surrounding source words. Replacement text wraps in full; heading rows
expose only the title for editing, keeping the visible container prefix, heading
level, and closing markers fixed. These fixed markers cannot shrink away.

Enter or clicking outside saves, and Escape cancels. Enter and Escape are ignored
while an input method is composing; clicking outside commits the final composed
input before closing the field.
Newline insertion and multiline pastes are blocked; save validates the values
again before rebuilding the reviewed proposal. The editor snapshots the opening
value; finishing an unchanged draft exits editing without mutating the review.
Escape or the active card's return-arrow button on a dirty draft restores its
last saved/default preview. An outside click closes an invalid draft and shows
a notice rather than leaving the input's editing appearance active. Convert
stays dimmed until the active draft is saved or cancelled; pressing it says so
and leaves the draft open (see [Blocked main buttons say why](#blocked-main-buttons-say-why)).
Drafts survive redraws; they are cancelled when the current review becomes stale or closes.
A purple **Custom** badge sits beside the format/line label. Outside an
active edit, the return-arrow button restores the default replacement, as does
the context-menu action; both rebuild dependent heading-link repairs. Saved
edits remain in the review until the separate conversion confirmation is accepted.

A separate `ConfirmModal` describes irreversible changes and partial-failure
behavior. Revision guards prevent a stale or reopened view's confirmation from
writing. Closing after conversion starts does not cancel writes; a notice still
reports the outcome. Partial writes retain an exact recovery plan with fixed
choices, including pending link-only changes. See
[the conversion contract](11-vault-discovery.md#portable-markdown-conversion).

The footer owns the contact and project links: one friendly sentence embeds an
inline GitHub issue link for either a bug or an idea and an inline email link.
Contact links use the basic `text-decoration` shorthand: no underline at rest,
and a solid, current-color underline on hover. Its thickness comes from the
browser/font rather than a fixed 1px declaration; only the text color transitions.
The footer's leading padding and the metadata row's leading margin both use
`--size-4-4` (16px by default), giving the contact text equal space to the rules
above and below. The metadata row's leading padding and the footer's trailing
padding remain `--size-4-3` (12px), keeping the final row compact.
An inset rule separates the contact sentence from
the quieter row, which links to the source, contribution guide, plugin license
and the GitHub release matching the displayed plugin version. The
**Icon licenses** control opens `IconCreditsModal`; that modal renders
the registry-backed icon attributions and links to the full third-party notices
without reserving a long disclosure row at the bottom of the settings page.

### Manual discovery in the callout-list heading

`calloutListsScaffold.ts` places the single **Scan for callouts** action beside
**Add new callout** in the **My callout types** heading. Both are siblings of
the disclosure control, so clicking an action never folds the list.

Discovery is written into `controlEl` **first** and the CTA last, which puts the
CTA on the row's outer edge — its right end under LTR, its left under RTL — the
side every other section in the tab puts its primary button on.

Colour is what separates them, not size. Add wears `.mod-cta`; **Discover
now** wears `.cs-settings-neutral-btn`, the tab's grey secondary button. The
class rather than a bare `<button>` for a mobile reason: there
`--interactive-normal` resolves to `--background-secondary`, which *is* the
settings pane, and `--input-shadow` is `none` — so Obsidian's plain grey button
is the pane colour with nothing to separate it from the pane. The class's
hairline border is what keeps it a button on a phone. (**Load more** is bare and
does vanish there.)

Both take their height from `--input-height` — already 30px on desktop and 44px
(`--touch-size-m`) on mobile — so they match **New palette** and every other
button in the tab on each platform; a hardcoded 44px minimum used to sit there
and made these the only oversized buttons on desktop. It is a *minimum*, so a
long translation still wraps to a second line rather than spilling out.

Everything about how the row reflows is stated in logical properties against the
*pane*, never a viewport query, so narrow desktop panes, phones, RTL and larger
text are one code path rather than four. Three declarations carry it, and they
are guarded by `tests/subheaderRowWrapping.test.ts`:

- **`flex-wrap: wrap` on `.cs-subheader-row`**, shared with the palettes heading
  rather than written per row. Obsidian's `.setting-item` is `nowrap`, so its
  answer to a narrow pane is to shrink the info box while the buttons hold their
  width — at a phone width that left *Saved color palettes (1)* stacking a word
  per line beside a button that had not moved. Wrapping picks the other answer:
  the action group drops whole to the next line and the title takes the width
  back. Line breaking measures each item at its max-content size, so the break
  lands exactly where crushing would otherwise begin — no breakpoint to pick, and
  none to keep in step with a translation.
- **`margin-inline-start: auto` on the control**, because a wrapped flex item
  starts its new line at the *leading* edge — the buttons reappeared under the
  first letter of the title instead of out where they had been a pixel earlier.
  The auto margin is inert on the unwrapped line (flexing has already taken the
  free space), so one declaration covers both states.
- **`flex-wrap: wrap-reverse` on the callout-list control**, which is what stacks
  **Add new callout** above **Scan for callouts** when even a line of their own
  is too narrow for both. It hangs the *last* line at the top, so it is true only
  while the CTA is last in the DOM — the same ordering that lands it on the row's
  outer edge horizontally. Swapping the two `addButton` calls looks like nothing
  and silently inverts the stack; the test's DOM half exists for that.
  `justify-content: flex-end` is restated on the control rather than inherited
  from Obsidian, since it is per-line and is what holds the lower button to the
  trailing edge.

The button rule that supplies `min-inline-size: 0` and `overflow-wrap: anywhere`
is scoped to `.cs-subheader-row`, not to the callout-list heading alone. Obsidian's
`button` is `white-space: nowrap` with a fixed `height`, so its min-content width
is the whole label: scoped narrowly, a long translation of **New palette**
("Neue Farbpalette erstellen") ran off the trailing edge of the pane instead of
wrapping inside its own box — before this row could wrap and after.

`manualDiscoveryButton.ts` shares only transient running state per plugin through
a `WeakMap`. Settings redraws and reopenings reuse that state and remove obsolete
DOM listeners through `registerDisposer`; repeated or detached-button clicks do
nothing. The button catches scan failures, restores its label/disabled state, and
never calls `display()` or focuses a control after completion. Existing registry
subscriptions refresh rows and counts while preserving paging and scroll.

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

### Four subscriptions, one coalesced refresh

They live in `settings/sections/tabSubscriptions.ts`, wired on the first
`display()` and undone by the single disposer it returns:

```ts
registry.onChange(sub)          → scheduleListRefresh(false)
registry.onPreviewChange(sub)    → scheduleListRefresh(true)
plugin.onIconCacheChange(cb)      → scheduleListRefresh(true)
workspace.on("css-change", cb)     → scheduleListRefresh(false)  // theme-mode swatch colours
```

All four funnel into one `requestAnimationFrame`-coalesced refresh
(`scheduleListRefresh`), so a burst of related events (a registry mutation
that *also* triggers `css-change`) costs exactly one re-render, landing on
the very next paint rather than a beat later. The `onPreviewChange`
subscription specifically is what keeps a row's swatch tracking the callout
editor's in-progress colour picks live, without the preview reaching
`saveSettings()` or forcing a document-wide re-render — see
[Callout registry § the transient live-preview slot](05-callout-registry.md#the-transient-live-preview-slot).

Subscribed **once per visit, not per render.** `display()` re-runs for things
the reader never asked for (see below), and re-subscribing on each would stack
duplicate listeners for the life of the session.

#### `force`, and why only two of the four carry it

`refresh` compares a signature of everything it would draw
(`sections/calloutListsSignature.ts`) and skips the rebuild when nothing moved.
Two of the four signals describe changes that signature reads for itself; the
other two describe changes it structurally **cannot** see, and those pass
`force`:

| Signal | `force` | Why |
| --- | --- | --- |
| `registry.onChange` | no | A real mutation, read straight off the registry |
| `workspace.on("css-change")` | no | Moves the colour scheme, the theme's name and its measured appearances — all in the signature |
| `registry.onPreviewChange` | **yes** | Registered transiently and *without* a registry mutation, by contract, so it may not be visible from the signature at all |
| `plugin.onIconCacheChange` | **yes** | Artwork lives in a download cache keyed by icon name, so a definition naming a not-yet-downloaded icon is byte-identical to the one naming it a second later — guarding this would leave every spinner spinning for good |

`force` is sticky across the coalescing frame: a frame that coalesced an icon
landing with an unrelated `css-change` still honours the icon.

The signature serialises **whole definitions**, not the fields a row happens to
read today, and the module says why at length: a curated list is how the tenth
field added later goes stale on screen. Both directions of failure are named
there too — a signature that changes when nothing did costs one repaint the
scroll anchor already hides, while one that fails to change leaves a stale row
with nothing to catch it, so it errs toward including more.

### The repaint must not move the page under the reader

The tab renders **into Obsidian's own scroller** — `containerEl` *is*
`.vertical-tab-content` — and the four sections that repaint asynchronously all
sit above the other eleven. So every repaint above happens above the fold for
anyone reading a section below it: rows appear and vanish, the whole theme
section comes and goes with `cs-hidden`, and a theme row grows when the
appearance probe lands it a swatch. Where the transient page comes out shorter
than the offset the reader was at, the browser clamps it and the place is lost
outright rather than merely shifted.

Both async repaint paths therefore run inside
`sections/foldAnchor.ts`'s `keepScrollAnchored` — `SettingsTab.refreshLists`
and `CustomPalettesSection`'s 60 ms `css-change` debounce. It measures the
topmost *direct child* of the container still on screen, runs the mutation, and
hands the difference back to the scroller. Direct children are the right depth
because they outlive the mutation: the repaints empty and refill containers
nested inside the section wrappers, never the wrappers themselves.

It is the same two-reads-and-one-write shape as `keepHeadingInPlace`
([Folding a pinned heading](#folding-a-pinned-heading)), differing in two ways
that matter — the anchor is chosen rather than handed in, and the correction
runs in **both** directions, because content above the fold here can grow as
well as shrink. It does not double-count Chromium's own scroll anchoring:
reading the second measurement forces layout, so any adjustment the browser
made has already landed and the drift measured is only the residual.

Two things it deliberately does not touch: the **Load more** jump
(`focusFirstRevealed`), which is an intended move, and the user-driven fold,
which `keepHeadingInPlace` already anchors.

### Opening settings does not discover callouts

`display()` builds the settings page and subscribes once per visit. It neither
scans open editors for unknown types nor schedules pruning. The one **Discover
now** button lives in the **My callout types** heading; it disables itself while its promise
is pending, catches failures and reports success only after persistence.
The occurrence sidebar owns read-only statistics and navigation; Settings has no separate statistics modal or second discovery button.


### `display()` is not only run by someone opening the tab

`manager/settingsBoot.ts`'s `adoptExternalSettings` re-runs it whenever another
device's `data.json` lands — i.e. on every sync round trip — and
`applyLocaleChange` does the same when a locale finishes downloading. Neither is
a gesture the reader made, and `display()` empties the container, so both used
to drop them at the top of a fifteen-section page mid-scroll **and** fold every
list back to its first 20 rows. Two things answer that:

- **Scroll.** `display()` reads `containerEl.scrollTop` on entry and writes it
  back after the last section renders — last, because assigning past the end of
  a still-short page would be clamped and lost. It is self-limiting rather than
  stateful: a freshly opened pane is already at 0, so a genuine open restores
  nothing and behaves exactly as it always has.

  `scrollRestore.ts` retries on the next frame only if that initial assignment
  was clamped. Any intervening scroll, up or down, cancels the retry. A newer
  capture invalidates the older frame so an obsolete display cannot move a
  newly opened or redrawn pane back to its previous position.

  > [!NOTE]
  > `containerEl` **is** the scroller, on phones as much as anywhere else, so
  > reading `scrollTop` off it directly is right and does not need
  > `foldAnchor`'s `scrollParentOf`. Verified against Obsidian 1.13.7: the tab's
  > container is `createDiv("vertical-tab-content")`, the only two overflow
  > rules on the pair are `.vertical-tab-content-container { overflow: hidden }`
  > and `.vertical-tab-content { overflow-y: auto; height: 100% }` with no
  > mobile override, and `vertical-tab-content-inner` — which `foldAnchor` used
  > to warn "could move the overflow up to the container" — appears **zero**
  > times in `app.js` and only ever as a *descendant* of the scroller in
  > `app.css`, for the phone's rounded-card look. That warning was wrong in both
  > halves and is corrected in place, because it points a reader at the wrong
  > element when they go looking for a scroll bug.
- **Paging.** The cursors moved out of the controller closure and onto
  `SettingsTab` — see
  [Where the state lives, and how long](#where-the-state-lives-and-how-long).

### Section disposers

Each section that registers a resource needing cleanup (an event listener, a
timer) returns a disposer via `ctx.registerDisposer(fn)`; `display()` runs
every previously-registered disposer **before** rebuilding, and `hide()`
runs them on tab close. This is what keeps a section's `MutationObserver` or
subscription from silently accumulating across repeated `display()` calls.

## Folding and paging — the callout lists, and Saved color palettes

[`CalloutListsSection.ts`](../../src/settings/sections/CalloutListsSection.ts)
builds *Callouts from your theme*, *My callout types* and *Built-in
callouts*, in that order, from one pass over one combined list (see
[Theme callout discovery](18-theme-callout-discovery.md) for who lands
where). Two behaviours sit on top of that split, each in its own helper —
and [`CustomPalettesSection.ts`](../../src/settings/sections/CustomPalettesSection.ts)'s
*Saved color palettes* heading is a fourth member of the same family rather than
a parallel implementation: it calls the identical `attachPersistedFold` and
`renderPagedList` helpers, just keyed `"palettes"` instead of a `RowKind`, and
wraps itself in the same `createStickySection` the trio uses so the heading pins
too (see [The three sections pin their headings](#the-three-sections-pin-their-headings) —
palettes is the standalone fourth). Unlike the other sections, it keeps only the
list of saved palettes and no additional orphan groups.

The row's **Use default fallback style** action uses the Lucide `rotate-ccw`
icon, matching the built-in **Reset to default** action. It calls
`CalloutRegistry.convertToFallback()` to follow the current fallback and
subsequent changes to its style.

### Duplicating a saved custom callout

The row's three-dot menu offers **Duplicate** with the Lucide `copy` icon for
persisted, non-built-in definitions. Theme-only definitions are excluded; a
saved custom definition remains eligible when the theme controls its preview.
Duplication reads the stored definition, not the theme's rendered appearance
or a reconstructed editor form, and deep-copies its complete state. Apart from
the new display name, primary ID and aliases, nested styling, flags, metadata
and palette references remain unchanged. In particular, a stale `paletteId`
and its baked colors survive, preserving the editor's **Deleted color** state.

New IDs pass through `sanitizeCalloutIdInput`, so suffixes are `copy`,
`copy 2`, and so on with spaces rather than hyphens. The generated primary ID
and aliases must not collide with any existing primary ID, alias or equivalent
Obsidian attribute spelling, or with one another. Display names are also
unique. Base text is truncated before adding the suffix to stay within the
200-code-unit ID limit and 80-code-unit display-name limit without splitting
a surrogate pair.

The action validates and commits an isolated settings snapshot through
`SettingsWriter.commit`, publishing the registry definition only from its
after-write callback. A completed commit triggers the success `Notice` and
`revealCallout`, which expands the destination section and its pagination
before rendering so a duplicate beyond the first 20 rows is visible too.
Validation and pre-write failures leave the registry unchanged and show an
error `Notice`. If a final recovery-checkpoint failure occurs after the valid
copy has reached disk and the registry, the action keeps that durable copy,
refreshes the list and shows the error `Notice`. No vault tokens are rewritten.

### `sectionDisclosure.ts` — a heading you can fold

`attachSectionDisclosure(setting, bodyEl, initiallyExpanded = true, onToggle?)`
gives a heading a compact rotating chevron and returns
`{ setName, setExpanded, isExpanded }`. `onToggle`, if given,
fires with the new state on a user-driven click or keypress only — not when a
caller drives the returned `setExpanded` — which is what lets a caller
persist just the user's own choice; see
[Where the state lives, and how long](#where-the-state-lives-and-how-long)
for the one caller that does.

Three things about it are decisions, not incidentals:

- **It is not `<details>`/`<summary>`.** These headings are `Setting` rows, and
  *My callout types* carries the **Add new callout** CTA in its control slot —
  a `<summary>` wrapping a button is a button that folds the section every time
  it is pressed. So the state, the keyboard (`Enter`, `Space`) and the aria
  contract are written out here.
- **The control is `setting.nameEl`, not `settingEl`.** The name element
  spans the title line and stops short of `.setting-item-control`, which is
  what keeps that CTA pressable without a target check. It also keeps the
  button's accessible name to `"My callout types (4)"` rather than the whole
  row including a paragraph of description. `role="button"`, `tabindex="0"`,
  `aria-expanded` and `aria-controls` all live on it; the chevron is
  `aria-hidden`, because `aria-expanded` already says what it says.
- **`setName` is wrapped.** Each list rewrites its heading on every render to
  update the `(N)` — the fragment `headingWithCount` builds (see
  [Heading counts](#heading-counts--one-n-everywhere)) — and Obsidian's
  `setName` *replaces* `nameEl`'s children, which is where the chevron lives.
  Attributes survive that; elements do not. Callers therefore go through
  `fold.setName(...)`, never `setting.setName(...)`.

Folding toggles `is-collapsed` on the heading and on the body. That is
deliberately **not** `cs-hidden`: the theme *section* hides itself with
`cs-hidden` when it has no rows, and one class toggled for two reasons means
whichever ran last decides — a fold would reopen an empty section, or an
empty section would reopen a folded one. The two now sit on different
elements as well (the section wrapper hides, the body folds), which makes the
collision impossible rather than merely avoided.

A user-driven toggle is wrapped in
[`foldAnchor.keepHeadingInPlace`](../../src/settings/sections/foldAnchor.ts) —
see [Folding a pinned heading](#folding-a-pinned-heading).

Note also that *Built-in callouts* does **not** get `cs-subheader-row` to
reach the chevron styling: that class also sets the smaller type, and this
heading is a size larger. It is the only one of the four — *Callouts from your
theme*, *My callout types* and *Saved color palettes* all carry it, for the
smaller type and the tighter box its CTA-bearing rows need. The chevron layout
itself rides on `cs-collapsible-heading`, which every foldable heading gets
from the helper regardless.

### The three sections pin their headings

Each of the three callout lists is built into a `div.cs-sticky-section` by
[`stickySection.ts`](../../src/settings/sections/stickySection.ts), with its
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

**A fourth section pins the same way: *Saved color palettes*.** It is built to
be a clone of *My callout types* — the same `createStickySection` wrapper, the
same `cs-subheader-row` heading box (tight, borderless, laid out for a CTA
button, and wrapping that button below the title on a narrow pane), the same `cs-sticky-heading` / `cs-section-body` classes — so almost
everything below applies to it unchanged. It is not one of the contiguous
three, though: *Fallback callout* sits between *Built-in callouts* and it, so
two things differ, both carried on its wrapper:

- **`cs-sticky-section-last`**, because nothing sticky follows it either. That
  class is now on two wrappers, and the `cs-sticky-section-last + heading` rule
  now also spaces the *Global settings* heading below it — the same
  `margin-top: 0; padding-top: var(--cs-sticky-heading-pad-top)` treatment
  *Fallback callout* gets under *Built-in callouts*.
- **`cs-palettes-section`**, for the one thing the stylesheet must special-case.
  The section above it is not pinned, so no body hands a `--cs-section-gap`
  down to its divider the way *My callout types*' body does for *Built-in
  callouts*. The wrapper makes up the gap with its own `margin-top:
  calc(var(--cs-section-gap) - 0.75em)` — the only place a sticky wrapper is
  allowed a margin, safe because nothing hands over to it (the space just
  scrolls). It tracks `--cs-section-gap` rather than a number of its own so it
  never drifts out of step with the trio; the `0.75em` subtracted is Obsidian's
  `.setting-item` block padding, which the Fallback dropdown row directly above
  already spends below its own text, so the two land the last-row-to-divider gap
  on the same 40px. It is written on the wrapper, not spent on the body through
  `--cs-section-gap`, because it is *leading* space and has to survive a fold —
  a folded palettes section still has to clear *Fallback callout* above it.
  `sectionTrailingGap.test.ts` holds both halves.

There is also a `margin-block: 0` on the shared `.cs-sticky-heading` rule that
this fourth section is the reason for. Obsidian gives a `.setting-item-heading`
a `0.75em` top margin whenever it follows a `.setting-item` sibling *or* sits in
a `<div>` immediately after one (`.setting-item + div > .setting-item-heading`)
— which is exactly where the palettes wrapper lands, under the Fallback dropdown
row. On a band meant to sit flush against its divider hairline, that margin
opens an 11px strip of bare pane between the line and the paint. The trio never
trips it (each of their wrappers follows another `<div>`), but zeroing it on the
shared rule covers the fourth and any later reordering; *Callouts from your
theme*'s own 4px top nudge is higher-specificity and unaffected.

This section's list scrolls under the band like any other row.
The `.callout-studio-callout-list` 24px-margin zeroing now reaches the palette
list too (it is inside a `cs-sticky-section` now), trimming 24px between it and
the heading — which is fine, the heading carries its own full divider.

Nine consequences are written into `styles.css` beside the rules, and are
worth knowing before touching any of them:

- **The pane's `padding-top` is zeroed and handed to the title row, at a
  weight that survives a theme.** A sticky `top` is measured from the
  scrollport's *content* box, so Obsidian's `padding-top: var(--size-4-12)`
  would park the band 48px down with rows scrolling visibly through the strip
  above it. Obsidian's own sticky settings header does the same thing one line
  away — `.setting-page.vertical-tab-content { padding-top: 0 }` beside
  `.setting-page-titlebar { position: sticky; top: 0 }`.

  The weight is the part that was missing, and it is not defensive padding.
  `containerEl` **is** `.vertical-tab-content`, so the reset lands on the very
  element a theme styles, at the same `(0,1,0)` a bare `.vertical-tab-content`
  carries — and the theme sheet loads after this plugin's. Measured over the
  257 themes installed in the development vault, **26 declare padding on that
  element and 20 put a non-zero top inset back**, from `(0,1,0)` (ITS Theme's
  `padding: 35px`, NotSwift's `padding-top: 60px`, Kakano, Terminal, Sandstorm,
  Subtlegold, TerraFlow, Cybertron, Ono Sendai, Suddha, Pine Forest Berry)
  through `(0,7,1)` (Maple), one of them — Elegance — with `!important`. Every
  one of them un-sticks all four bands identically, at whatever distance it
  chose. So the reset is written
  `body:not(.is-phone) .callout-studio-settings×3 { padding-top: 0 !important }`:
  `!important` because nothing else outranks Elegance's, the class tripled to
  `(0,4,1)` for headroom over a future important rule, and the phone excluded
  *explicitly* — with an `!important` in play it would otherwise have beaten
  Obsidian's own `(0,5,0)` phone rule, whose padding is reserving the top of the
  screen for the floating back and close buttons. `padding-block-start`
  (flexcyon's spelling) cascades in the same slot and needs no separate
  declaration; a `border-top` on the pane (TerraFlow's 1px glass frame) insets
  the content box the same way and is deliberately left alone. Section **165**
  of `modalBodyLayers.test.ts` resolves that cascade against the theme rules
  verbatim.
- **The band paints `background-color: inherit`, not the `--cs-surface`
  pair.** That pair is defined inside `.cs-modal` and nowhere else, so on the
  settings tab it falls through to `--background-primary` — and that is what
  Obsidian paints this pane on the *desktop only*: under `.is-mobile` the pane
  takes `--settings-background`, which is itself `--background-secondary`,
  `--background-primary` or `--background-primary-alt` depending on phone,
  tablet and colour scheme. Measured, a dark tablet's pane is `rgb(17,17,17)`
  while `--background-primary` there is `#000`; the token would have made the
  band a visible stripe, which is the exact failure `modalSurfaces.test.ts`
  exists for. `inherit` cannot disagree with the pane on any platform. It is a chain:
  the wrapper declares it too, because `background-color` is not an inherited
  property and the band would otherwise inherit `transparent`.
- **Under that paint is a floor, because `inherit` is only as opaque as what
  it copies.** Replayed through a headless Chrome against the running
  Obsidian's own `app.css`, this stylesheet and one theme at a time — the 257
  installed in the development vault, in both colour schemes — the band
  computes **transparent under a good many of them**. Most of those leave the
  pane itself see-through (Sodalite paints `.vertical-tab-content` `transparent` and puts the surface
  on the container behind it; TerraFlow's dark pane is glass; Velocity's whole
  window is, `--modal-background` included, at `oklch(… / 0.625)`), so the
  chain has nothing opaque to carry down. Three others beat the band's own
  declaration: Elegance and Lagom write `background-color: transparent
  !important` on `.setting-item-heading` — at `(0,2,0)` and, nested under
  `.mod-settings`, at the band rule's own `(0,3,0)` — and Micro Mike wins a
  `(0,3,0)` tie through `.modal.mod-settings :is(h1, …,
  .setting-item-heading)`. Either way rows scroll visibly through a heading
  that is pinned exactly right.

  The fix is a floor rather than a fight, because `!important` is not
  available: Lagom's is already at the band rule's specificity, so winning
  means out-specifying the *next* theme rather than that one. So
  `.cs-sticky-heading::before` lays an opaque base — `--background-primary`
  with `var(--settings-background, var(--modal-background))` over it, the
  theme's own surface tokens and never a colour named here; the top layer is
  the token core paints this pane *with*, so measured on desktop, tablet and
  phone in both schemes it comes out the pane's own colour every time — and
  `.cs-sticky-heading::after` repaints the band's whole
  background over that with `background: inherit`, image included, so a theme's
  heading gradient still paints. Both sit at `z-index: -1` inside the band's
  own stacking context, so they are above its background and below its title,
  and both are scoped `body:not(.is-phone)`, where the band is `position:
  static` and so not a containing block. Where the band's paint is opaque — the
  great majority of themes, and every platform with no theme installed — the
  `::after` covers the floor completely and nothing changes: with no theme the
  rendered pane is pixel-identical before and after.

  It reaches all but a few. The ones left over are the themes that name no
  opaque surface anywhere — see the rules' own comment in `styles.css` for the
  roll call and the reason each one is out of reach. That is deliberately where it stops: the only floor
  that could not itself be see-through is a colour named here, and on a theme
  whose every surface is transparent on purpose it would be the one opaque
  thing in the window. Section **166** of `modalBodyLayers.test.ts` pins the
  arrangement and the cascade behind it.
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
    body. Both are still wanted at the source for a list that ends *mid-*view
    (the Quick insert window), which is why they are dropped here in a
    `cs-sticky-section`-scoped rule rather than removed outright. Inside the
    palettes section the zeroing does now reach a list that ends mid-section
    — the palette list inside its section — which is
    harmless: that sub-heading carries its own full divider.
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
  color palettes* section — where the heading pins too, so the fix carries its
  weight there as well — and inside the callout editor's palette trigger,
  where nothing is pinned and it is a no-op.
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
wherever the heading is not actually stuck: only a *stuck* box reports a
different top before and after a change made below it, so a heading folded
from its resting place — one below the fold, or any heading on a phone, where
`position: static` — measures zero and the scroller is never touched. All four
sticky headings share the helper, so all four are corrected when folded while
pinned. The measurement is guarded rather than assumed — the test DOM has no
layout and therefore no `getBoundingClientRect`, and that absence is what
makes the anchor inert there instead of throwing on every fold.

`foldAnchor.ts` has a second export built on the same three lines,
`keepScrollAnchored`, which anchors the *asynchronous repaints* rather than the
click — see
[The repaint must not move the page under the reader](#the-repaint-must-not-move-the-page-under-the-reader).
The two differ in the direction they correct, and deliberately: this one returns
early on a negative drift, because the browser's own `scrollTop` clamp has
already handled the page getting shorter, while the repaint case has to correct
both ways.

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
single source for that: declared once on `.cs-collapsible-heading`, read back
by the chevron, which is sized to them, and by the heading, which offsets itself
by their sum. Because a custom property is substituted where it is *used*, the
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

Which way the chevron points is RTL's one catch. Obsidian marks a
right-to-left interface with `.mod-rtl` on the body — never `dir="rtl"` — and
already mirrors every `svg.svg-icon` under it, so a folded chevron points along
the title with no help. An open one must then turn *against* that mirror, or a
fixed +90° turns the mirrored `<` into `^`. The open rule therefore turns by
`calc(var(--direction, 1) * 90deg)`: core's `--direction` is 1, or -1 under
`.mod-rtl`, and core's own fold indicators turn by it too. The folded rule
must not read it, because core resets `--direction` to 1 on every
`.is-collapsed:dir(ltr)` — which, with no `dir` attribute in the interface, is
every folded heading. The icon picker's group chevron follows the same two
rules.

Its stroke is set, not inherited. Every fold chevron in the plugin's own UI
sits beside a semibold heading — the settings lists, the sections of
**Version details**, and the icon picker's source groups — and
Obsidian's default icon stroke (1.75 of the icon's 24 units) is a
regular-weight line that reads as a hairline there. One rule,
`.cs-disclosure-chevron svg, .icon-picker-group-chevron svg`, draws both at
`stroke-width: 2.5px`; with the icon at `1em` that is about `0.1em` at any
heading size, a semibold stem. A callout's own fold arrow (heading callout,
block callout, and their previews) is deliberately left out — it follows
Obsidian's look for callouts.

### Heading counts — one "(N)" everywhere

Every heading that counts what it holds ends the same way: the four settings
lists (*Callouts from your theme*, *My callout types*, *Built-in callouts*,
*Saved color palettes*), the section titles of the setup comparison in
**Version details**, and the file headings of the **Find
callouts** and **Review conversion** sidebars.
[`ui/headingCount.ts`](../../src/ui/headingCount.ts) builds all of them, and
`.cs-heading-count` in `styles.css` is the one rule that places and colours
them. They used to be four implementations, sitting one space, a space and a
margin, or a flex gap and a margin from the title, in the heading's colour in
one place and grey in the next.

- `appendHeadingCount(heading, count)` appends
  `<span class="cs-heading-count"> (N)</span>`, the number formatted with
  `toLocaleString(getLocale())`. The space before "(" is part of the text, so
  the heading reads — and is announced as — "My callout types (4)".
- `headingWithCount(title, count)` returns the same thing as a fragment for a
  `Setting` heading's `setName`, with the title and its count wrapped in one
  span. A foldable heading's `nameEl` is a flex row (chevron, then title);
  unwrapped, title and count would be two flex items — the row's gap between
  them, and a long title wrapping beside its count instead of carrying it to
  the end of its last line.
- The setup comparison's title row keeps the count as its own flex item beside
  `.cs-recovery-section-title`, so a title cut short with an ellipsis still
  shows its count. That row therefore has no flex `gap` — its chevron carries
  `margin-inline-end: var(--cs-disclosure-gap)` instead — because a gap would
  open between the title and its count as well.

The rule is the count's own word space plus `margin-inline-start: 0.3em` —
about half an em in all, in `em` so it scales with each heading's type —
`--text-muted`, `font-size: 0.85em` (a step below the heading, whatever size
that is), `font-weight: var(--font-medium)`, `tabular-nums`, and
`white-space: pre`. The margin is 0.3em rather than 0.25em because it is
measured in the count's own, smaller em. Medium keeps the small digits from
looking thin beside the title; where the interface font has no 500 cut the
browser uses its regular one (its rule for a requested 500 is 400 first, then
lighter, then heavier), so the count degrades to differing by size and colour
alone, and a variable font simply renders 500. `pre` rather than `nowrap` because the comparison row's
count opens a flex item, and `nowrap` drops a space at the start of one. On
mobile, Obsidian paints settings headings in `--text-muted` themselves
(`--setting-group-heading-color`), so
`.is-mobile .setting-item-heading .cs-heading-count` steps down to
`--text-faint` to stay distinct from its title.

Not every "(N)" is a heading count. **Find callouts (134)** in a callout's menu,
**Load more (14)**, **Import valid only (3)** and the icon total in an icon
source's description are part of a label, and stay plain text in that label's
colour. `tests/headingCount.test.ts` pins the helpers and the rule; each
surface's own suite checks that it goes through them.

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
appended in code — `Load more (14)` — the same trick the heading counts use: a
numeric suffix on whatever `t()` returns, so it needs no key of its own in any
of the 31 translated locales. Unlike a heading's count it stays plain text in
the button's colour, because it is part of the label (see
[Heading counts](#heading-counts--one-n-everywhere)). `focusFirstRevealed`
(below) is an export of `listPaging.ts` rather than a per-section helper,
which is what lets `CustomPalettesSection.ts` reuse it verbatim instead of
reimplementing the same focus-on-reveal logic.

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

One `PagingState` and one `SectionDisclosure` per section is what makes the
sections independent and what makes them survive a repaint.
`CalloutListsSection.ts`'s `refresh()` rebuilds every callout row on a
registry change or a theme switch, and `CustomPalettesSection.ts`'s own
`renderList()` does the same for palettes on a create, edit, delete or theme
flip; in both cases a list the user expanded must not fold back up under them.

The page cursor is session-only, and *which* lifetime that means was a bug
report: **"it keeps jumping back to the top and re-collapsing the view more
callouts list."** The three callout-list cursors used to be closure variables on
the controller — and a controller lives exactly one `display()`, which re-runs
for things nobody asked for (above). Pressing **Load more** and then having
another device's settings file land was enough to lose it.

They are held by `SettingsTab` now (`freshPaging()`, in
`sections/calloutListsSignature.ts`) and handed to the controller through
`CreateCalloutListsControllerOptions.paging`, so a rebuild inherits them.
`hide()` calls `freshPaging()` again, which is what keeps the cursor
session-only in the sense that was always meant: a genuine reopen still starts
every section back behind its `Load more` button. Nobody has asked to keep a
whole vault's saved palettes on screen by default, and paging past the cap is a
cheap habit to reform — but losing your place to a repaint you did not cause is
not that. (Saved color palettes keeps its own single cursor in
`CustomPalettesSection.ts`, which is rebuilt by the same `display()`; its
`Load more` is one press on a much shorter list.)

The **fold** is not session-only. `settings/sections/calloutListsFold.ts`
mirrors each section's `SectionDisclosure` into
`DeviceLocalStore.listsExpanded` (`{ theme, user, builtin, palettes }` — the
first three keyed the same way as `RowKind`, `palettes` added for Saved color
palettes) the moment the user folds or unfolds it by hand —
`attachSectionDisclosure`'s `onToggle` fires only on that user gesture, never
when a caller drives `setExpanded` programmatically, so a save only happens
for a choice the user actually made. `attachPersistedFold` takes any
`keyof CalloutListsFoldState` (not a bare `RowKind`), which is what let
`CustomPalettesSection.ts` become a fourth caller without widening `RowKind`
itself to a concept it has nothing to do with. Both `createCalloutListsController`
and `renderCustomPalettesSection` read the relevant field back as their
heading's `initiallyExpanded` on render, so a folded section stays folded
across a settings-tab reopen and a plugin reload alike; a device whose stored
blob predates a given key defaults it to `true` field by field
(`DeviceLocalStore.read`), so the tab looks exactly as it did before the
upgrade.

It lives in `localStorage` rather than `data.json` precisely because it is
per-device: folding a section away used to rewrite the synced settings file,
which on a synced vault is one more file event for the sync client to
reconcile, and what is folded on a phone has nothing to say to a desktop. See
[Persistence § the device-local store](07-persistence-and-caching.md).

The heading count is always the full list a section has — the partitioned
length for a callout list, `settings.customPalettes.length` for Saved color
palettes — never the visible slice. Folding a section, or leaving 20 of 34
rows on screen, changes what is drawn — not how many the user has.

## Modal chrome — the one shell every window wears

[`src/settings/modalChrome.ts`](../../src/settings/modalChrome.ts) is a small
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

## Where the cursor lands when a window opens

[`src/settings/modalAutofocus.ts`](../../src/settings/modalAutofocus.ts)
centralizes the rule for text fields when a window opens:
`autofocusOnDesktop(input)` focuses only when `Platform.isMobile` is false.
That flag covers phones and tablets. A null or undefined field is a no-op, so
a caller can reach through an optional field. Focus uses
`{ preventScroll: true }` to refuse the DOM's own scroll-into-view. There is
nothing to dispose of.

### Rule 1: only a *new* name field takes the cursor in a create/edit window

A **new** callout or palette opens on an empty name that must be filled in
before anything can be saved, so on desktop the cursor belongs there. An **edit** opens on
a filled-in form the user came to change some other part of; taking the name
field there costs a tap to get back out, and on a phone would throw the keyboard
over the form they opened the window to look at.

The gate is the caller's, and is deliberately the **same expression the window's
own title asks**:

| Window | Gate | Title |
| --- | --- | --- |
| `CalloutEditor` | `!this.existingId` | `editor.newCallout` / `editor.editCallout` |
| `PaletteEditorModal` | `!this.existing` | `palette.newTitle` / `palette.editTitle` |

> [!IMPORTANT]
> `CalloutEditor` used to ask **`!this.isBuiltIn`**, which is a different
> question — whether the name field is *editable*, not whether the window is
> *creating* anything. Every edit of a custom callout therefore grabbed the name
> field too. `tests/modalAutofocus.test.ts` pins the guard against the title key
> so the two cannot drift apart again.

For `PaletteEditorModal` the gate is `existing`, **not** the seeded state: the
`seed` option pre-fills every colour but stays a *new* palette (it rebuilds one
deleted out from under a callout, so the user "only has to type a name") — which
is the case that most wants the cursor.

`CommandEditorModal` is the third create/edit window and is deliberately *not*
wired up: its first control is a dropdown, not a text field, so there is no
keyboard to raise and nothing to focus.

### Rule 2: no window automatically focuses a text field on mobile

`autofocusOnDesktop` returns without doing anything when `Platform.isMobile`,
which is true for phones **and** tablets. Create windows, Quick Insert, the
replacement picker, and every icon-picker search leave their text fields
unfocused there. The user taps a field when ready to type. On desktop, Quick
Insert and the replacement picker focus search on open. The icon picker focuses
the enabled search field after its source panel loads; the Custom Icons panel
does the same when selected. A source awaiting download has a disabled search
field and cannot focus it.

The reason is the jump, and it is not a scroll the plugin asks for, so
`preventScroll` has no say over it: the WebView shrinks the visual viewport as
the keyboard slides up, then scrolls to keep the caret inside what is left. A
window the user has not read yet moves while they are looking at it.

> [!IMPORTANT]
> An earlier implementation focused a create window on mobile, then held the
> scroller's `scrollTop` at its pre-focus value
> for `KEYBOARD_SETTLE_MS` (400ms, covering the ~250-300ms iOS slide-in),
> releasing early on `pointerdown`, `touchstart` or `wheel`. It did not work
> well — it read as a delayed, clunky lurch rather than as no jump at all — and
> it cost every window a scroll listener plus a disposer to run from `onClose()`,
> for a problem no desktop user has. **It has been removed rather than tuned;
> don't reach for it again.** `tests/modalAutofocus.test.ts` fails if a timer, a
> listener or a `scrollTop` reappears in `modalAutofocus.ts`.

### Search windows use the same device rule

`QuickInsertModal`, `ReplaceCalloutModal`, `PackPanel`, and `ImagePanel` focus
their search fields on desktop only. They have no create/edit gate, but opening
them on a phone or tablet must not summon the soft keyboard. This applies to
an icon source change and to asynchronous panel loading as well as the first
open. Tests in `modalAutofocus.test.ts` and `iconPickerLifecycle.test.ts` cover
the platform behavior.

`hotkeyLink.ts` can also open Obsidian's Hotkeys settings. Its DOM fallback
fills the search query and dispatches input/change on every device; it focuses
and selects the text only on desktop. The normal `setQuery` path is supplied by
Obsidian, so this plugin does not programmatically focus a field there.

The search field's keyboard handling is also why `ReplaceCalloutModal`'s **Enter only chooses**
(the top row, when nothing is chosen yet) and never confirms. Confirming rewrites
every note that uses the callout, and its Undo is brief and in memory only, so it takes the confirm button,
which is `mod-warning` in both modes. `tests/replaceCalloutModal.test.ts` pins
both.

## Two theme-aware surface tokens

Defined **only** on `.modal.cs-modal` (never redefined per-modal), so
falling through to the bare CSS variable keeps the plain settings tab —
which Obsidian itself paints `--background-primary` — visually unchanged:

```css
.modal.cs-modal { --cs-surface: var(--modal-background); --cs-surface-raised: var(--background-secondary); }
```

- **`--cs-surface`** (fallback `--background-primary`) — anything meant to
  read as flush with the modal window itself: fixed bands, panels, the ring
  cut around an icon tile's ✕. Not dropdown lists: those wear the face of the
  control that opened them (see
  [Dropdown popups wear their control's face](#dropdown-popups-wear-their-controls-face)).
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
> means the top of the pane — and where that scroller is Obsidian's rather
> than this plugin's, the rule doing the moving has to outrank the active
> theme, which is a second question and the one that actually regressed. And
> `background-color: inherit` is the third sanctioned paint beside the two
> surface tokens — it is the only one available to a band sitting *on* a pane
> whose colour the plugin does not choose. See [The three sections pin their headings](#the-three-sections-pin-their-headings).
>
> Quick Insert applies the same padding rule inside the modal chrome: its
> `.modal-content` top padding is zero, the introductory paragraph owns the
> resting inset that scrolls away, and the toolbar owns a painted top inset that
> gives the search field breathing room while stuck and contains its focus ring.
> Putting the inset back on the scroller reopens a transparent strip above the
> sticky toolbar, allowing list rows to show through it.

## How an input field focuses

Editable text fields use the same chrome as the
[shared dropdown controls](#shared-dropdown-controls). Their opt-in
`cs-text-control` class keeps the rule scoped to Callout Studio's own fields;
it must not style Obsidian's editor or the transparent input inside a combobox.
Single-line fields share the dropdowns' 36px minimum height (or
`--input-height` when larger), 6px by 10px padding, Obsidian's own
[field corners](#field-corners-follow-obsidians-input-tokens), 1px border, and
small UI font. Each screen retains its own control width.

| State | Text fields and dropdown controls |
| --- | --- |
| Rest | `--cs-btn-face`, falling back to `--interactive-normal`; 1px `--cs-btn-border`; no shadow |
| Pointer hover | **The fill does not change.** The 1px border steps to `--cs-field-border-hover`, falling back to `--background-modifier-border-hover` |
| Focus, press, or an open list | **The same edge as hover**: same fill, same 1px border colour, no thicker border and no ring. Clicking a hovered field changes nothing |
| Disabled | No interactive hover or press feedback; the field retains its disabled appearance |

### A field answers with its edge, not its fill

Buttons change fill under the pointer (`--cs-btn-face-hover`, see
[Why the hover is a `color-mix`](#why-the-hover-is-a-color-mix-and-not---background-modifier-hover));
fields never do. A field has two looks: at rest, and **engaged** — hovered,
focused, pressed, or with its list open — and the engaged look is one thin edge.
There is deliberately no third, stronger state: an earlier version gave focus a
`--background-modifier-border-focus` border plus a 2px ring, and the jump from
the hover edge to that on every click was the thing to lose.

Two more reasons for the edge. The list that opens from a dropdown wears the
field's own face ([Dropdown popups wear their control's face](#dropdown-popups-wear-their-controls-face)),
and a field that repainted itself would be a different grey from its own list
whenever the pointer was on it. And in dark — and in macOS light wherever the
[light palette](#the-light-palette) is not in force — the resting border *is* the
face's colour, so the field is a borderless grey slab at rest, which leaves the
edge free to carry the state.

`--cs-field-border-hover` is declared with the other `--cs-btn-*` tokens as
`var(--cs-light-line-strong, color-mix(in srgb, var(--background-modifier-border-focus) 60%, var(--background-modifier-border)))`:
the light palette's engaged line where there is one, otherwise the `color-mix`,
which is not Obsidian's `--background-modifier-border-hover` because that is a
step nobody sees on these faces. Measured against the real `app.css`, edge
against face:

| | rest → engaged edge | Obsidian's own hover border |
| --- | --- | --- |
| Dark (face `#333333`) | `#333333` → `#474747` (1.36:1) | `#3f3f3f`, 1.20:1 |
| Light, palette off, macOS (face `#e4e4e4`) | `#e4e4e4` → `#cdcdcd` (1.25:1) | `#dadada`, 1.10:1 |
| Light, palette off, Windows/Linux (face `#ffffff`) | `#e4e4e4` → `#cdcdcd` (1.59:1) | `#dadada`, 1.40:1 |
| Light, Default theme, every platform (palette; face `#ffffff`) | `#d4d4d4` → `#a6a6a6` (1.48:1 → 2.43:1) | — |

"Palette off" is a community theme, or the plugin not being able to tell. Both
ends of the `color-mix` are Obsidian's tokens, so a theme that moves either
moves the edge with it; a theme that invalidates the `color-mix` falls back to
Obsidian's own hover border. The cost of one edge for every engaged state is that keyboard focus and
hover look the same; a text field still shows its caret, and a dropdown its open
list. If that ever needs to change, add a `:focus-visible` rule for keyboard focus
alone rather than giving the pointer a stronger border again.

The standalone fields are the callout editor's **Display name** and **Callout
IDs**,The standalone fields are the callout editor's **Display name** and **Callout
IDs**, the palette editor's **Name**, the Quick Insert and replacement-dialog
searches, the search box in every icon source, and the text box on Callout
Manager's import window's paste card — a `<textarea>` of one fixed height on
the same `cs-text-control` face (see
[Import and export](15-import-export.md#the-plugin-import-window)).
Searchable callout and color pickers remain comboboxes: their outer
`cs-dropdown-control` paints the box, and their inner `cs-combobox-input`
stays transparent in every state.
`ListboxPopup.setDisabled()` mirrors the input's disabled state onto its
painted control as `cs-dropdown-disabled` (and keeps `is-disabled` on the root).
The hover/focus selectors read that component state without a parent `:has()`
query. Callers must use `setDisabled()` rather than disabling the inner input
directly; native standalone controls still use `:disabled`.
Select-only combobox inputs remain readonly. File inputs and native color
swatches are separate controls and do not receive text-field styling.

There are three cascade constraints:

- Shared field rules must outrank Obsidian's
  `input[type='text']:not(:disabled):hover` selector, whose specificity is
  `(0,3,1)`. The state rules must also win over the base they refine.
  This preserves the plugin's intentional edge instead of allowing the host's
  form-field tokens to win. Hover, focus, press and open all set the *same*
  colour, so they cannot undo one another and there is no specificity to balance
  between them (the text hover is `(0,4,0)`, level with its base and after it in
  the file; the focus rule is higher).
- The palette name's `cs-input-invalid` state must keep its red border and
  error ring during hover and focus. Shared colors must not hide validation:
  the red rule is `(0,4,1)`, above the text rules, and the focus rule excludes
  `.cs-input-invalid`. `.is-open` is part of the engaged rule because a tap on a
  phone does not focus a `<button>` trigger (the Fold selector), and Obsidian's
  press class, `.mobile-tap`, is listed there too since a phone has no hover.
- The Callout IDs field reserves trailing space for its **+** button.
  `cs-tag-add-slot` overlays the field and paints the same `--cs-tag-field-bg`,
  declared once on the row as the resting face — a field's fill never changes —
  so its background never becomes a separate rectangular patch. Preserve the
  trailing padding and the row's existing width when adjusting the shared
  chrome. The edge is set from the row's `:hover`, not only the input's: the
  **+** button re-enables pointer events, so over it the input is not the
  hovered element and its own `:hover` would let go. Native `:disabled` and
  `:focus` remain the source of truth, without pointer-state listeners or
  parent `:has()` queries.

Text fields and dropdown triggers do not show hover tooltips. Their accessible
names still identify the controls to assistive technology; suppressing hover
popups must not remove those names. Obsidian turns `aria-label` into a tooltip,
so `buildComboboxSkeleton` uses a unique hidden text node referenced through
`aria-labelledby`. Tooltips on unrelated action buttons keep their own behavior.

Check these rules against the actual cascade, including light and dark modes,
invalid and disabled fields, and the IDs field with its **+** visible. The
harness in [17 — Checking a theme against the real
cascade](18-theme-callout-discovery.md#checking-a-theme-against-the-real-cascade)
explains how to compare `styles.css` with Obsidian's `app.css`; reading either
stylesheet alone does not prove the computed result.

### Field corners follow Obsidian's input tokens

The shared chrome takes its corners from `var(--input-radius, var(--radius-s))`
and `var(--input-corner-shape, round)`, never from a fixed `--radius-s` and
`round`. Those are the tokens behind Obsidian's own `input`, `select` and
`.dropdown` rules, and they are platform- and theme-dependent (Obsidian 1.13):

| Environment | `--input-radius` (= `--button-radius`) | `--corner-shape` |
| --- | --- | --- |
| Default (Windows, Linux) | 5px | `round` |
| `.mod-macos` | `--radius-m`, 8px | `superellipse(1.33)` |
| `.is-mobile` | `--touch-radius-m`, 44px (a pill) | as the desktop above |

A native `textarea` reads `--textarea-radius` first and only mobile defines it
(24px), so the import window's paste box repeats that fallback rather than
becoming a pill 132px tall. Native `button` rules read `--button-radius`, which
is `var(--input-radius)` unless a theme splits the two; plain buttons are left
to Obsidian, so they and the fields match by construction.

Two things draw a corner inside a field and must follow it: the **+** end-cap
(`.cs-tag-add-slot`) rounds one pixel *inside* the field's radius with the same
`corner-shape`, and its button inherits both, so a hover tint cannot square off
the field's corner. Anything new that overlays a field edge should derive its
radius from `--input-radius` the same way. The combobox's inner input stays at
`border-radius: 0`; its wrapper owns the corner.

`tests/inputPointerStability.test.ts` pins the declarations. To confirm the
computed numbers, render a native `button`, `input`, `select` and `textarea`
beside the plugin's fields under the harness linked above, with body classes
`mod-macos`, `mod-windows` and `is-mobile is-phone`, and compare
`border-top-left-radius` and `corner-shape`.

### The one control that is not a field but focuses like one

The **icon tile** in the callout editor (`.cs-icon-tile` — the 44px box that
*is* the icon picker's button, with the ⓧ badge straddling its corner) sits
directly under the Display name and Callout IDs fields, and it is the third row
of the same form, so it answers the pointer exactly as they do ([see
above](#a-field-answers-with-its-edge-not-its-fill)): hover, `:focus-visible` and
press all set `border-color` to `--cs-field-border-hover` and `box-shadow: none`,
and the fill never changes. (It used to take a 3px focus border and a
`--background-modifier-hover` fill, which read as a darker box with a heavy
edge next to its neighbours.)

Three things about it are easy to get wrong a second time:

- **The box needs four classes.** `box-shadow` is contested
  three ways — `button:not(.clickable-icon)` (0,1,1) sets `--input-shadow`,
  `button:hover` (0,1,1) sets `--input-shadow-hover`, and
  `button:not(.clickable-icon).mobile-tap` (0,2,1) sets it again the moment a
  finger lands — so `box-shadow: none` is written at (0,4,1), the same count and
  the same reason as the ⓧ badge. The fill is not repainted at all, so the
  empty state's transparent "add one" box stays hollow under the pointer.
- **`border-color`, never the `border` shorthand.** The empty state swaps
  `border-style` to dashed at (0,2,0); a shorthand at (0,4,1) would silently
  solidify it.
- **The resting shadow is still Obsidian's.** `.cs-icon-tile` declares
  `box-shadow: none` at (0,1,0) and loses to `button:not(.clickable-icon)`, so
  at rest the tile wears `--input-shadow` while the fields above it wear
  nothing. That is left as it was.

#### Hover is desktop-only, and the press is the touch half

Every hover-driven change the tile makes — the edge, fading the
artwork out, revealing the swap arrows, the ⓧ badge appearing — lives in one
`@media (hover: hover) and (pointer: fine)` block. The `hover: hover` half is
old and load-bearing: iOS Safari applies `:hover` on the first tap of an element
that has hover styles ("sticky hover"), which here blanked the artwork and left
the arrows showing on the way into the picker. `pointer: fine` is the newer
half, and it excludes the stylus and the hybrid laptops that answer
`hover: hover` from a touchscreen.

Touch gets the complement, written as `@media (hover: none), (pointer: coarse)`
rather than `not ((hover: hover) and (pointer: fine))` — Safari only learned
that boolean form in 16.4, and this is the block whose whole job is the phone.
There the press carries the box instead: the same thin edge on `:active`
**and** on `.mobile-tap`, Obsidian's own press class (it adds it to every
`a, button, .tappable, …` on touchstart and removes it on release), which is the
dependable half on iOS where `:active` fires only for elements the engine has
already decided are tappable. Both are self-clearing, so nothing stays lit
behind a tap that opened a picker on top of it. The artwork is deliberately
*not* swapped for the arrows on touch: a finger has nothing to reveal with, only
something to commit with, and the drawing is the content.

The ⓧ badge's own pair moved with it, and has to stay its exact complement — a
coarse pointer that also reports `hover: hover` must land in one of the two
blocks, and the one it should land in is the permanent, 22px, tappable badge.

#### The swap arrows drift

The glyph revealed on hover is Lucide's `arrow-left-right`, and Obsidian builds
a lucide icon as bare shape children of the `<svg>` with no `<g>` wrapper — for
this one, four `<path>`s in drawing order: the top arrow's head and shaft
(pointing left), then the bottom arrow's head and shaft (pointing right). That
is what lets a plain `:nth-child(-n + 2)` / `:nth-child(n + 3)` split hand one
arrow to each of two keyframe sets and slide them apart, each in the direction
it already points, and back — 3.5 user units on a 24-unit viewBox drawn at
18px, about 2.6 device pixels, on a 1.05s `ease-in-out infinite` loop.

- It is scoped off `.is-empty` because the glyph there is `plus`, whose two
  paths would take the same split as one arrow each and pull the `+` apart.
- `translateX` on an SVG child resolves in that child's own user coordinate
  system, so there is no `transform-box` or `transform-origin` to get wrong; a
  pure translation has no origin.
- Reduced motion is handled by putting `prefers-reduced-motion: no-preference`
  **in the query** rather than an `animation: none` in the `reduce` block beside
  it. Those selectors are (0,6,1) and an override would have to restate every
  one of them to outrank it. A loop that never starts needs no stopping.

## How a secondary button paints

The companion to the section above, and it went wrong the same way: four
places each answering "what does a grey button look like" for themselves.

Everything that is not a call to action — the settings tab's
`.cs-settings-neutral-btn` row (Discover, Import, Export, Reset, and the two in
Data management), the bare `<button>`s a window's `.cs-modal-footer` carries
(Cancel), and the two segmented rows, `.cs-border-side-btn`
(All/Top/Right/Bottom/Left) and `.cs-gradient-dir-btn` — now reads one pair of
tokens, declared once near the top of `styles.css`:

```css
--cs-btn-face: var(--cs-light-face, var(--interactive-normal));
--cs-btn-face-hover: var(
	--cs-light-face-hover,
	color-mix(
		in srgb,
		var(--interactive-normal) 92%,
		rgb(var(--mono-rgb-100))
	)
);
```

(The `--cs-light-*` swatch in front is the [light palette](#the-light-palette);
it is declared only in light mode under the Default theme, so everywhere else
these read exactly as they did before it existed. The prose below describes
that fallback.)

`--interactive-normal` is Obsidian's own button face — white
(`--color-base-00`) in light on Windows and Linux, `#363636` (`--color-base-30`)
in dark, and `#e4e4e4` on macOS, where `.mod-macos` points it at
`--background-modifier-border` — so the resting look is unchanged and stays
whatever a theme makes it. In light mode with Obsidian's Default theme the two
tokens are replaced by the [light palette](#the-light-palette)'s swatches and
fall back to exactly the expressions above everywhere else.

### Why the hover is a `color-mix` and not `--background-modifier-hover`

Because **that token is not a colour**. It is a translucent mono overlay,
`rgba(var(--mono-rgb-100), 0.067)` — black at 6.7% under `.theme-light`, white
at 6.7% under `.theme-dark`. Two things follow, and both shipped:

- **It composites against what is behind the button, not against the button's
  own fill.** Discover rested on `--background-modifier-form-field` — an
  *input* token, `--color-base-25` (`#2a2a2a`) — over a `#1e1e1e` pane, and
  hovered to `#2d2d2d`. That is a luminance change of 0.3%: **no hover at all
  in dark mode**, while the very same rule in light moved `#ffffff` → `#eeeeee`
  and looked correct. One rule, one theme broken.
- **Its direction flips with the theme**, because it always moves *away* from
  the background. The segmented rows rest on `--interactive-normal` (`#363636`
  in dark) but hovered to that overlay composited over the group box behind
  them (`#1e1e1e`), landing at `#2d2d2d` — *darker than the button*. That is
  the "these get darker" report, and it is the same trap reached from the
  other side.

Mixing the step into the resting fill fixes both: the result is opaque, so it
cannot be pulled around by whatever the button happens to sit on, and
`--mono-rgb-100` supplies the direction the active theme reads as "more
contrast". Measured in headless Chrome against real `app.css`:

| | rest → hover | Δlum |
| --- | --- | --- |
| light | `#ffffff` → `#ebebeb` | −16.9% |
| dark | `#363636` → `#464646` | +2.4% |

identical for all four, against `#ffffff` → `#fafafa` (−4.4%) and `#363636` →
`#3f3f3f` (+1.3%) for a native Obsidian button, which is deliberately left
alone — every rule here is scoped to `.callout-studio-settings` or
`.cs-modal > .cs-modal-footer`, so nothing reaches a core dialog. The coloured
variants keep their own faces: the footer rule carves out `.mod-cta`,
`.mod-warning` and `.mod-destructive` with a `:not()` **list**, which takes the
specificity of its most specific argument and so leaves the selector at (0,3,1).

### The specificity half, which is the half that gets lost

Obsidian paints every button from

```css
button:not(.clickable-icon) { background-color: var(--interactive-normal) }
```

which is **(0,1,1)**. A single-class rule is (0,1,0) and *does not get the
resting fill at all* — which is why the `background: transparent` the
border-side buttons carried for their whole life never once took effect, and
why their hover looked like it was darkening from a transparent base when it
was really darkening from Obsidian's grey one. Both segmented rows double their
class to clear the bar, the same trick `.cs-gradient-dir-btn` already used
against the mobile core rules.

Doubling was not enough for that mobile rule itself, which is a cautionary
tale: Obsidian 1.13's `.is-phone .modal .setting-item-control
button:not(.clickable-icon) { width: 100% }` is **(0,4,1)**, so
`.is-mobile .cs-gradient-dir-row .cs-gradient-dir-btn.cs-gradient-dir-btn`
(0,4,0) lost `width: 26px` on the element tie-break and now carries a third
copy of the class. Chrome hid the loss — `flex: 0 0 26px` still sized the
buttons — but WebKit sizes the shrink-wrapped control column from `width`, got
56px for three 26px arrows, and the last one spilled out of the card on iOS.
`tests/gradientDirectionMobileSize.test.ts` pins the specificity; check a phone
override in WebKit as well as Chrome (see "Checking a theme against the real
cascade" in `21-theme-callout-discovery.md` for the harness).

Two more consequences worth keeping:

- **`.is-active` is declared *before* `:hover`.** They tie at (0,2,0), so the
  later rule wins; with the order reversed a selected segment swallowed its own
  hover and was the one dead control in the row. A hovered selection steps
  within the accent (`--interactive-accent-hover`) so it can never be mistaken
  for an unselected segment.
- **`box-shadow: none` must not eat the focus ring.** `:focus-visible` used to
  be grouped in with `:hover` on the neutral buttons, and at (0,3,0) that
  `box-shadow: none` beat Obsidian's (0,1,1) `button:focus-visible` — so six
  buttons focused invisibly. Each now restates the ring itself, in the grey
  described in [How an input field focuses](#how-an-input-field-focuses).

`tests/secondaryButtons.test.ts` pins all of it: the shared tokens, the four
faces reading them, the specificity bar, the `.is-active`/`:hover` ordering,
and the two tokens that must never come back to a button face.

> [!NOTE]
> The overlay is still right for a **list row, an icon button or a chip** —
> anything that sits on the surface behind it rather than owning a face — so
> `--background-modifier-hover` is deliberately untouched on
> `.cs-combobox-option`, `.callout-studio-row-buttons button`, `.cs-icon-tile`,
> `.cs-drag-handle` and friends. The rule is about which of the two a control
> is, not about banning a variable.

> [!TIP]
> When measuring this with the headless-Chrome harness, **disable transitions
> first**. These buttons carry `transition: background 0.12s`, and
> `getComputedStyle` immediately after forcing the hover state returns the
> *interpolating* value — which Chrome reports in `oklab`. A first pass at the
> harness measured the resting colour twice that way and reported the fix as
> broken.

### The red half: a hover rule that resolves to nothing

The footer carve-out hands `.mod-cta`, `.mod-warning` and `.mod-destructive`
back to Obsidian on the grounds that they own their own faces. The red variants
only appear to own a useful hover, and the reason is worth writing down because
nothing in either stylesheet looks wrong.

Obsidian ships the rule you would expect:

```css
button.mod-warning       { background-color: var(--background-modifier-error) }
button.mod-warning:hover { background-color: var(--background-modifier-error-hover) }
```

and then, under `body`, defines both of those tokens as the same colour:

```css
--background-modifier-error: var(--color-red);
--background-modifier-error-hover: var(--color-red);
```

So the hover matches, fires, and paints the colour that is already there. Read
out of headless Chrome against the real `app.css`, both tokens resolve to
`rgb(233, 49, 71)` in light and `rgb(251, 70, 76)` in dark — **identical**,
where the accent pair beside them genuinely differs. Delete, Replace and
"Reset everything" were never missing a hover rule; they were running a no-op,
Δlum 0.0% in both themes, which is why the gap outlived the grey-button pass
sitting directly above it.

This reaches the settings tab as well as the windows. The class produced by
`ButtonComponent.setWarning()` has changed across Obsidian versions: older
versions and themes use `.mod-warning`, while the live DOM in Obsidian 1.13.7
gives "Reset everything" both `.mod-destructive` and `.mod-cta`. That dual
classification caused a second regression when the accent hover was fixed:
the generic `.mod-cta` rule won and turned the red button purple. The accent
selector therefore excludes both red classes, and the danger selector accepts
either of them.

`--cs-btn-danger-face-hover` is declared beside `--cs-btn-face` and mixed the
same way, at the same 92%, with `--mono-rgb-100` for direction:

| | rest → hover | ΔE00 | white text |
| --- | --- | --- | --- |
| light | `#e93147` → `#d62d41` | 4.19 | 4.20:1 → 4.87:1 |
| dark | `#fb464c` → `#fb555a` | 2.84 | 3.45:1 → 3.20:1 |

against the grey face's 4.10 and 5.26. Light matches almost exactly; dark is
deliberately the smaller step, because a saturated red is already the most
prominent thing on the surface and driving it to the grey's ΔE00 needs ~86%,
which costs white-text contrast (3.01:1) on a fill Obsidian already ships below
AA.

> [!WARNING]
> Measure a step like this in **CIEDE2000**. Plain CIE76 ΔE scores the two rows
> above 6.5 and 7.4 — "already matched" — and it is wrong in exactly the
> saturated region a red button lives in. The greys above are near-neutral,
> which is the case where the two measures happen to agree.

Three constraints shape the rule itself:

- **It sets the hover only.** A theme that restyles `.mod-warning` or
  `.mod-destructive` keeps its own red, and because the mix reads
  `--background-modifier-error`, a theme that retunes *that* gets a hover
  derived from its colour. Claiming the resting fill at this weight would beat
  a theme painting either class directly.
- **`body:not(.is-mobile)`**, because Obsidian's mobile warning/destructive
  treatment drops the red fill for grey-with-red-text, and a tablet with a
  pointer attached satisfies `hover: hover` while still carrying `.is-mobile`.
- **(0,5,2) against Obsidian's (0,2,1)**, so it lands without `!important`.

> [!NOTE]
> `.cs-icon-tile-clear` — the small red ✕ on an icon tile — is the one red
> control that does **not** follow this, and that is deliberate. It mixes toward
> a hardcoded `black` in both themes, so it darkens in dark mode against the
> house direction rule. It also carries a hardcoded white glyph, and darkening
> is what keeps that glyph legible: `color-mix(… black)` holds it at 6.08:1
> light and 5.10:1 dark, where switching to `--mono-rgb-100` would drop the dark
> pair to 2.80:1. The direction rule serves contrast; here it would cost it.

Do not infer the runtime class from a search for literal `.mod-destructive`
call sites in `src/`: it is added inside Obsidian's `ButtonComponent`. The
regression test intentionally covers the real `mod-destructive mod-cta`
combination so a future accent change cannot capture warning buttons again.

## The light palette

In light mode, with Obsidian's Default theme, the plugin's windows draw their
controls from a small palette of their own instead of from Obsidian's button
colour. Under a community theme they do not: the theme's colours reach the
windows exactly as they did before the palette existed.

### Why it exists

Every field, dropdown and list draws its face from `--cs-btn-face`, which reads
`--interactive-normal`. On macOS Obsidian sets that to
`--background-modifier-border` (`.mod-macos { --interactive-normal:
var(--background-modifier-border) }`, `#e4e4e4` in light): a flat grey that
suits a native-looking *button* and nothing else. Obsidian's own text boxes do
not use it — `input[type='text']` paints `--background-modifier-form-field`,
white in light — but this plugin deliberately gives text fields, dropdowns and
the list that opens from them one shared face, so on macOS all of them came out
as the same borderless grey slab, with a heavy shadow under the list and a
mid-grey selected row. Windows and Linux never had it (there the token is white),
and phones had a milder version (`#f6f6f6`).

Measured in five real windows against Obsidian 1.13.7's `app.css`, the elements
painted `#e4e4e4` before the palette were: every text control, the Callout IDs
field and its **+** end-cap, the icon tile, every dropdown control and its open
list and group headings, every window footer button, the settings tab's neutral
buttons and the gradient-direction buttons. After it, the only neutral
non-white backgrounds left are the cards behind rows (`#fafafa`, `#f6f6f6`),
which are surfaces and not control faces.

### The swatches

Declared once, in one rule near the top of `styles.css`:

| Swatch | Value | Paints |
| --- | --- | --- |
| `--cs-light-face` | `#ffffff` | the face of every control, list and popup |
| `--cs-light-face-hover` | 92% face, 8% `--mono-rgb-100` → `#ebebeb` | a hovered button |
| `--cs-light-line` | `#d4d4d4` (1.48:1 on white, 1.37:1 on a `#f6f6f6` card) | a field's or button's edge at rest, and the divider between popup groups |
| `--cs-light-line-strong` | `#a6a6a6` (2.43:1 on white, 2.25:1 on a card) | the one edge a field draws when engaged, and a hovered button's border |
| `--cs-light-row-selected` | accent 12% over the face | the committed row of a list |
| `--cs-light-row-selected-active` | accent 20% over the face | that row while it is also the highlighted one |
| `--cs-light-menu-shadow` | `0 8px 24px rgba(0,0,0,.12), 0 2px 6px rgba(0,0,0,.08)` | under a popup |

The resting line is a notch firmer than Obsidian's own `#e4e4e4` (1.27:1 on
white), which is what made a white field there look borderless; the engaged line
is the *rest → engaged* step of [A field answers with its edge](#a-field-answers-with-its-edge-not-its-fill),
now `#d4d4d4 → #a6a6a6`. The selected row is a tint of `--interactive-accent`
rather than a step toward the text colour, so it follows the user's accent and
stays at ~14:1 for the text on it.

### How it is wired

- **The swatches are declared once, on `<body>`, behind one gate**:
  `:where(body.theme-light.cs-default-theme)`. `theme-light` is Obsidian's colour
  scheme class. `cs-default-theme` is the plugin's, below.
- **Every consumer reads a swatch in front of what it used to be.** The five
  `--cs-btn-*` / `--cs-field-border-hover` declarations, the popups'
  `--cs-menu-divider`, `--cs-menu-row-selected(-active)` and `box-shadow` all read
  `var(--cs-light-x, <the old value>)`. A swatch that is not declared therefore
  changes nothing, which is the whole off switch: dark mode and every community
  theme resolve to the pre-palette expressions, byte for byte. Checked by
  comparing computed `background-color`, the four border colours, `box-shadow`,
  `color`, `outline-color` and `opacity` of every element in five windows
  (editor with a callout list open, editor with the colour list open, settings
  tab, palette editor, import window) for the pre-palette stylesheet against this
  one: identical in dark, identical in light with the class absent, and
  identical in light under a stand-in community theme that sets its own
  `--interactive-normal` and border tokens — with that theme's colours visibly
  reaching the fields, which is the point.
- **The gate is inside `:where()` so it adds no specificity.** The swatch rule
  is (0,0,0): a user's snippet can retune one with a plain
  `body { --cs-light-line: #ccc }` and no `!important`.
- **The icon tile is the one consumer that needed a rule of its own.** It is a
  `<button>`, so Obsidian paints it `--interactive-normal` through
  `button:not(.clickable-icon)` (0,1,1), which beats the tile's own
  `background-color` (the form-field token, 0,1,0): it was a grey slab beside two
  white-ish fields. A gated rule `.cs-icon-tile-wrap:not(.is-empty) .cs-icon-tile`
  (0,3,0) gives it the face and the resting line. That is above Obsidian's
  button fills (at most (0,2,1)) and below the tile's own hover, focus and press
  rules ((0,4,1) and up), so the engaged edge still wins; the empty tile's
  hollow dashed box is left out.

### `cs-default-theme` — why a class, and why it is the positive one

CSS cannot ask which theme is active: Obsidian marks the colour scheme on
`<body>` but never the community theme, which is a name in `app.customCss` and a
`<style>` element. [`registerDefaultThemeClass`](../../src/manager/theme/defaultThemeClass.ts)
mirrors the one fact needed — `app.customCss.theme === ""`, Obsidian's Default —
onto the main window's `<body>`, at once and again on every `css-change`
(Obsidian writes `customCss.theme` first and triggers the event once the new
theme's CSS is in place, so the name read there is already the new one), and
removes it on unload.

It is the *positive* statement on purpose. `usesDefaultTheme()` returns true only
when the field is present and is the empty string; a missing or renamed
`customCss` is not "no theme", and the class stays off. If the module never ran
or Obsidian changed the field, the failure is the windows keeping the look they
had before the palette — not the plugin painting over a theme it could not see.
`activeThemeName()` cannot serve here: it returns `null` for both "default" and
"cannot tell".

Pop-out windows need nothing extra: Obsidian copies the main body's classes onto
every pop-out's own `<body>` and keeps them in step (a `MutationObserver` on the
main body's `class` attribute), and clones the plugin's stylesheet. The class is
therefore set on the main renderer document
(`app.workspace.containerEl.ownerDocument`, as `CSSInjector` finds it), never on
`activeDocument`.

### Not part of it

Dark mode; callouts as they are drawn in a note; Obsidian's own widgets; the
cards behind rows (`--background-secondary`), which are surfaces; and the tag
chips, which are a translucent overlay on whatever they sit on. The palette also
applies on phone and tablet (`is-mobile`), where it replaces a borderless
`#f6f6f6` pill with a white one that has the same soft line — one palette for the
light scheme rather than a per-device variant. A **user setting** to switch it
off was deliberately not added: choosing a theme is the switch.

`tests/lightPalette.test.ts` pins the shape (one declaration site, the gate's
selector and zero specificity, every fallback equal to the pre-palette value, no
bare read outside the gate, the swatches' contrast figures stated as properties
rather than hex codes, the tile's specificity band) and
`tests/defaultThemeClass.test.ts` the class (positive statement, live updates,
`registerEvent`, removal on unload). To look at it, render the real widgets
(`SelectDropdown`, `ListboxPopup`, `TagInput`, the colour swatch input, the
direction picker, the option boxes) on `tests/support/fakeDom.ts` inside the
real modal shell (`.modal.cs-modal` → header, `.modal-content`,
`.cs-modal-footer`), serialise `outerHTML`, and put it in a page that links
Obsidian's `app.css` and `styles.css` with body classes
`theme-light mod-macos cs-default-theme`; then repeat without
`cs-default-theme`, with a stand-in theme file linked after `styles.css`, and
with `mod-windows` and `is-mobile is-phone`. Use the *headless shell* binary
(`chrome-headless-shell`) for screenshots — the full headless Chrome returned a
black frame for a page this size — and read the real `app.css` out of the
running version's `.asar` (see [Checking a theme against the real
cascade](18-theme-callout-discovery.md#checking-a-theme-against-the-real-cascade)).

## Blocked main buttons say why

A button that cannot act must not go quiet. A `disabled` button swallows the
click, so the user is left looking at a dimmed control that never says what it
is waiting for — a name still to be typed, a row still to be chosen, a draft
still to be confirmed with Enter. Every *main* button that can be blocked for a
reason the screen does not already show is therefore **dimmed instead of
disabled**, and answers a press with a notice naming the one thing in the way.

[`ui/blockedButton.ts`](../../src/ui/blockedButton.ts) is the whole mechanism:
two functions over one reason string.

- **`paintBlocked(button, reason)`** sets `aria-disabled` and `cs-btn-disabled`
  while `reason` is non-null and clears both otherwise. Obsidian's own
  stylesheet draws `button[aria-disabled="true"]` exactly like
  `button[disabled]` (`opacity: 0.7`, `cursor: not-allowed`);
  `cs-btn-disabled` is what the plugin's own rules key on — the accent and red
  hover rules skip it, and the modal footer dims it further (`opacity: 0.4`).
- **`explainIfBlocked(reason)`** is the first line of the click handler:
  `if (explainIfBlocked(this.saveBlockedReason())) return;`. It returns true
  after showing the reason, so the handler stops. The notice stays up for
  Obsidian's five seconds, stretched at about 60 ms a character (to 12 s) for a
  longer sentence, and a second press *replaces* it rather than stacking
  another.

Each button owns a private `…BlockedReason(): string | null` that returns the
translated sentence for the first thing in the way, or `null`. The same method
paints and answers, so the dimmed look and the words cannot disagree, and the
click recomputes it instead of trusting the last paint — a state that changed
without a redraw is still answered truthfully. The sentences name what to do
(*Choose a replacement callout…*), not the button; a sentence that has to name
another control takes its label as a `{{placeholder}}` so it cannot drift from
the label.

| Button | Reason method | Blocked while → notice |
| --- | --- | --- |
| **Convert selected** / **Finish conversion** (Review conversion) | `PortableConversionView.convertBlockedReason()` | a conversion is running → `portable.blockedConverting`; pending link updates unrecoverable → `portable.recoveryUnavailable`; the review failed → the error already on its status line; the review is updating → `portable.blockedUpdating`; a replacement draft is open → `portable.blockedEditing`; every replacement unchecked → `portable.blockedNothingSelected`; nothing eligible → `portable.empty` |
| **Save** (command editor) | `CommandEditorModal.saveBlockedReason()` | no callout exists or is chosen → `commandBuilder.noCallouts` / `commandBuilder.noCalloutChosen`; the same command already exists → `commandBuilder.duplicate` |
| **Save** (palette editor) | `PaletteEditorModal.saveBlockedReason()` | the name is taken → `palette.saveBlockedName`; the colours duplicate another palette → `palette.colorExists` |
| **Replace** / **Confirm** (replacement picker) | `ReplaceCalloutModal.confirmBlockedReason()` | no row chosen → `replaceModal.chooseFirst` (delete mode names "delete without replacing") / `replaceModal.chooseFirstReplace` |
| **Import valid only (N)** (import report) | `ImportReportModal` | N is 0 → `import.nothingValid` |
| **Confirm** (icon picker) | `IconPicker.confirmBlockedReason()` | no icon selected, which is also what switching source does → `iconPicker.chooseFirst` |
| **Restore** (Version history) | `SettingsRecoveryModal.restoreBlockedReason()` | saving is paused → `notice.blockedWhilePaused`; the version equals the current setup → `versions.restoreSame` |

The callout editor's **Save** (`showSaveBlockedNotice`), the quick-insert
**Insert** (`quickInsertNotice`) and the plugin import's **Import**
(`noticeFillFirst`) were the first three to work this way and keep their own
copy; **Reset everything**'s acknowledgement answers a press with a nudge on
the checkbox instead (see [`ConfirmModal`](#confirmmodal--the-generic-yesno-dialog)).

**Where `disabled` stays right.** A button that is merely *busy* and whose
label already says so: **Saving…** and **Importing…**, the discovery button's
**Scanning…**, the saving banner's **Working on it…**, and the icon picker's
Confirm while its artwork downloads. Pressing one of those teaches nothing.

**Two consequences to keep.** A dimmed button is focusable, so Enter and Space
answer too. And a press on one is *not* "clicking away": while a Review
conversion replacement draft is open, a document-level handler commits it on
any outside click, so `PortableConversionCustom.outsideClick` ignores a press
on an `aria-disabled` control, and the view puts the caret back in the draft
(`focusDraft`) — the notice says *press Enter*, and focus would otherwise sit
on the very button that just refused.

## Button labels and the ellipsis

A trailing `…` on a button or menu item says one thing: **pressing this does not
act yet, and the next step asks for a detail the label does not name.** The reader
learns to trust it — a plain label acts, a dotted one asks first — so it only works
if it is spent narrowly. Before it was written down, four labels out of some sixty
carried it, and two of those for the wrong reason: **Convert selected…** opened
only a yes/no confirmation, like **Delete** and **Reset everything**, which had
none, while **Import**, **Export** and **Replace in vault** each opened a step that
asks for a source, a format or a replacement, and had none either.

Ask three questions, in order:

1. **Does pressing it act at once?** No dots. (**Duplicate**, **Scan for
   callouts**, **Retry**.)
2. **Is the next step only "sure?", or the form or window the label already
   names?** No dots. (**Delete**, **Reset everything**, **Convert selected**,
   **Add new callout**, **New palette**, **Manage commands**, **Review
   conversion**.)
3. **Does the next step ask for something the label does not say** — a source, a
   format, a file, a replacement, the text itself? Dots. (**Import…**,
   **Export…**, **Upload…**, **Replace in vault…**, **Custom replacement…**.)

The boundary cases, and why they fall where they do:

- **A confirmation is not a missing detail.** A destructive button's red styling
  and its dialog already carry the weight; dots on **Delete…** would add noise,
  not information. Obsidian's own **Delete** has none either.
- **A window that is the destination is not a missing detail.** **Manage
  commands**, **Customize**, **Review conversion** and **Restore an earlier
  setup** open the thing the label names; nothing is left to ask. (The last is
  the closest call: its window lists setups to choose from, but it carries the
  label's own title and is as often opened to compare as to restore.)
- **A form the label names is not a missing detail.** **Add new callout** opens
  the callout editor, which is what it said.
- **The last step of a dialog never has dots.** **Replace**, **Import** and
  **Delete** inside their dialogs are the action itself. Their keys are often
  shared with the button that opened the dialog, so a trigger that needs dots
  gets a key of its own first.
- **Icon-only buttons never have dots.** Their string is an `aria-label`, not a
  visible label. A button that opens a dropdown wears the chevron instead.

Other `…` in the strings keep their own meaning and are not action labels:
progress text (**Saving…**, **Scanning…**), placeholders (**Search callouts…**)
and a cut-short list (*…and 3 more*). A busy button may show progress dots where
its action label had none, or in its place: **Importing…** stands in for **Import…**
while the work runs.

Three habits go with the rule:

- **One character.** The mark is `…` (U+2026), never `...` and never preceded by a
  space; GNOME's and KDE's guidelines ask for the same, and all of `en.ts`
  already did it. (Obsidian's own strings use three ASCII periods; this plugin
  deliberately does not follow.)
- **Documentation names a button without its dots**: **Import**, not *Import…*.
  The label can change; the instruction should not.
- **Translations mirror English.** A locale ends a label in its language's
  ellipsis exactly when the English label does. A dots-only edit leaves every
  translation true, so none needs retiring (see [Localization](17-i18n.md)).

[`tests/uiCopyEllipsis.test.ts`](../../tests/uiCopyEllipsis.test.ts) is the
executable form. Every English string with a `…` must be filed under what its dots
mean (asks for a detail, in progress, placeholder, cut-short list);
the asking actions must end in it; a list of the near misses must not; and `...`
is rejected. Adding a dotted string therefore means choosing a meaning, which is
the step that used to be skipped.

## Notable individual modals

### `ConfirmModal` — the generic yes/no dialog

Resolves `Promise<boolean>`. Required `title` (see above), optional
`confirmLabel`/`cancelLabel`/`confirmClass` (defaults to
`"mod-warning"` — a destructive action reads as one by default unless the
caller overrides it). Used throughout for anything destructive that isn't
specific enough to warrant its own modal (bulk vault edits, full reset).

An optional last argument, `acknowledgement`, is for a confirmation that
cannot be taken back. It draws a checkbox with that label, in a bordered box,
as the last line of the message (`.cs-confirm-acknowledge`; the tick and the
box's outline turn red once it is ticked) and keeps the confirm button locked
(`aria-disabled`, not `disabled`, so it still receives the click) until the box
is ticked. Pressing the locked button shakes the box and turns its text, its
outline and the empty tick square's outline red, then fades them back to their
normal colour (its weight never changes; under reduced motion only the colour
fade plays), and scrolls the body to its very end
(`contentEl.scrollTo({ top: scrollHeight })`): the window's body is the
scroller, so a long message pushes the box off screen. It is not
`label.scrollIntoView()`, which lines the label's edge up with the body's and
so stops one bottom padding (16px) short of the end. **Reset everything** is
the only caller that passes it (`confirm.acknowledge`).

Its message is built from `settings/resetInventory.ts`, which reads the
registry and returns two lists: what the reset deletes (custom callouts,
pictures, commands, palettes, each with a count) and what it puts back to
defaults (changed built-ins with a count, then each setting group that differs
from `DEFAULT_SETTINGS`). A row that would change nothing is left out. Each
list is drawn as a plain `<ul>` with no rules between the lines, and each
counted row's sentence opens with its number (`{{count}} custom callout
type(s)`). Reading the registry cannot say how many notes use the custom types
that go, so the button handler scans the vault and appends that as the last
row of `deleted` (`settings.resetItemReferences`, just the count) rather than
as a paragraph above the lists. The first list is introduced by two paragraphs
of its own, a reminder (`settings.resetIntro`) and the lead-in
(`settings.resetDeletes`), drawn only when something is deleted; blocks are
spaced by `--p-spacing`, with the lead-in kept close to its list. An empty
inventory means there is nothing to reset, and the button answers with a notice
(`settings.resetNothing`) instead of opening the window. The inventory mirrors
`CalloutRegistry.resetAll()`: a group added to one belongs in the other.

### `DeleteCalloutModal` and the replace/delete pivot

Covered in depth in [Vault discovery § delete flow](11-vault-discovery.md#delete-flow).
UI-wise: two body copy variants (in-use vs. unused), and an in-use callout's
footer offers **three** buttons (Cancel, "Replace instead…", Delete) rather
than the usual two — the replace pivot exists specifically because deleting
an in-use callout is presented as a choice, not a single destructive action.

### `PaletteEditorModal` — simple vs. advanced, two background styles

Two-column layout mirroring the per-role global-style popups: a sticky live
preview on the left, titled control cards on the right. **Simple mode**: one
base colour, and the full six-value palette (light/dark accent, background,
text) is auto-derived with contrast correction
(`derivePaletteFromColor` — see [Colour system](12-color-system.md)).
**Advanced mode** exposes independent accent/background/text rows per theme
mode directly, each edit inferring the opposite mode's value
(`inferOppositeModeColor`) — but is only offered while the background style
is **Solid**; a Gradient palette has no advanced per-colour view.

Background style is a further 3-way choice: Solid, Gradient (two-stop linear,
preset direction, an off-by-default "Gradient title text" toggle), or None
(transparent — see [Colour system](12-color-system.md#preset-palettes--hue-named-not-role-named)
for why this is the *only* route to a transparent palette).

The palette card keeps **Name** and **Style** at the same control-column width.
Name is a 36px text field; Style uses the nonsearchable `ListboxPopup` rather
than a native `<select>`. Both use the shared field radius and the same
hover/focus edge. The popup is destroyed when the modal closes.

The preview renders on a **reserved demo id** (`PALETTE_DEMO_ID =
"palette-demo"`), registered through the same registry preview slot the
callout editor uses — and, notably, **deliberately not**
`PREVIEW_PLACEHOLDER_ID` (the callout editor's own reserved id), because two
concurrently-open demo previews (opening the palette editor from inside the
callout editor) must not collide on one registry slot.

### Scoped reset controls

The conditional `rotate-ccw` controls use the shared `settings.resetAction`
label. They are hidden when their scope already matches its canonical default.
Settings resets save immediately through the usual settings path; the built-in
callout editor's field resets still change its draft until Save.

**Default fallback callout** restores `DEFAULT_SETTINGS.fallbackCalloutId`
(`note`). **Language** restores `DEFAULT_SETTINGS.language` (`auto`), following
Obsidian's language through the same locale-change path as a manual selection.
Their reset buttons occupy the trailing edge of the existing control column;
the picker shrinks to make room, as in the callout editor's color row.

The **Language** column is sized from its content, not the fixed 260px the other
reset rows use. The picker's menu is exactly as wide as the picker, so the
column has to fit the longest option. `LanguageSection` measures a hidden stack
of every language name and adds the reset arrow's width plus the gap.
It un-hides the arrow for that one synchronous read, because a picker showing
Obsidian's language keeps it `display: none`. The sum becomes
`--cs-language-control-width`. The column never shrinks (`flex: 0 0 auto`): in
a narrow pane the description wraps, and Obsidian stacks the row below 400px.
Before this, a shrinking column and an arrow that took its room from the picker
cut "Bahasa Indonesia" short.

The menu lists languages only, each under its own native name, with no flags
and no regional grouping. Flags stand for countries, not languages (W3C i18n
Best Practice 16), and Windows' emoji font draws flag emoji as two letters.
There is **no Automatic row**. The saved value still has two kinds, `"auto"` to
follow Obsidian and a locale code to pin one, but the picker never names the
first. It shows the language a preference renders in instead (`shownLanguage`,
matched by locale *file*):

- `"auto"` shows Obsidian's language, or English when the plugin lacks it.
- An alias (`no`, `zh-hk`) shows the row that serves it.
- A code no row offers shows English, since that is what renders. That covers
  a value from another version on a synced device, or one typed by hand.

The arrow shows exactly while that language differs from Obsidian's
(`showsObsidianLanguage`). A pick saves by these rules (`preferenceFor`):

| Picked row | Saved |
| --- | --- |
| The row already shown | Nothing. No save, no redraw; if its file has not downloaded, the pick retries it. |
| Obsidian's language | `"auto"`, exactly as the reset arrow does. |
| Any other row | That code, pinned. |

**Nothing is migrated, and "the same as Obsidian" is never written back.**
Obsidian's language belongs to the device, while `data.json` syncs. Take a
pin saved under the old Automatic row that equals Obsidian's language here.
It loads unchanged and shows no arrow. On a synced device whose Obsidian is in
another language, it is still a pin, with the arrow. Rewriting it to `"auto"`
on load, or on a re-pick of the row already shown, would silently change that
other device. Older versions read the same two kinds of value, so mixed
versions across devices keep working.

When the language a preference asks for has not downloaded, the warning below
the picker names it after the row the picker shows, so `zh-hk` reads as 繁體中文.

Colored option headers reserve space at their trailing edge for the compact
reset control without increasing the header's original height. The rule also
applies to the callout editor's icon-adjustment headers. Menu-category and
built-in-command resets sit at the trailing edge of their headings, above the
toggle rows.

### `GlobalStyleModal` — the three per-role style popups

Also uses a reserved demo id (`STYLE_DEMO_ID = "global-style-demo"`) and the
same live-preview-on-a-registered-row pattern, letting the border/radius/
scale/spacing sliders for block, heading, or inline style show their effect
on a real rendered callout as the user drags them. Its three modal titles are
separate translation keys rather than a concatenation of “Global callout
style” and a role name, so each locale can put the words in its natural order.

Every option box owns one scoped reset. It restores only the fields represented
by that box from `DEFAULT_SETTINGS`, including nested border-side flags and the
heading-fold setting outside `globalStyle`. Resets refresh the affected controls,
generated styles and preview; heading settings that affect decorations also
refresh open callout editors. Default objects remain unchanged so subsequent
edits cannot alter a later reset target.

The inline sample places a localized content pill between two localized sample
sentences. In the embedded Live Preview, clicking the pill reveals its source
syntax for inspection. The callout id stays fixed across locales; its visible
label follows the selected language. The
inline corner-radius slider reaches 25px for the 1.5× text scale. The settings
guard still accepts previously saved values up to 64px.

### `MenuCustomizationModal` — reorder without replacing a grabbed row

Each render role has one persistent list container with a banded list from
[`ui/bandedSortList.ts`](../../src/ui/bandedSortList.ts) attached — the same
list the Manage icon libraries window uses (below). It owns the band line, the
handles with their ArrowUp/ArrowDown moves, and the one `makeDragSortable`
attachment whose `groupOf` keeps each band to itself; the modal supplies each
row's label and toggle. A caller may also caption its groups (`captionOf`, used
only by the libraries window): the caption is a sibling element like the line,
so a drag never carries it. It may hand over the window's scroller (`scroller`,
likewise only the libraries window), which lets `animate(change, follow)`
scroll to a row it is told to follow; without one the list never scrolls
itself. Every rebuild swaps the whole list in with one `replaceChildren()`
(see the libraries window, below, for why). Enabled and disabled items occupy separate bands,
divided by a sibling separator. Pointer and keyboard moves stay within the
item's band; only its toggle changes bands. Every completed move updates the
settings array and requests a save immediately.

Each category heading also owns a reset that replaces only that role's array
with fresh entries from `DEFAULT_CONTEXT_MENU_ITEMS[role]`. This restores both
the shipped order and every enabled flag. Visibility compares both fields, so
reordering an otherwise fully enabled category still exposes the reset. Reset
rebuilds that role's rows and saves through the same path as other edits.

`ui/DragSortList.ts` moves the existing row nodes as the pointer crosses their
neighbours. On release it reports the final indices synchronously, and the modal
keeps those nodes: rebuilding them after a drop could detach the target of the
next drag. The row's short settling animation is cosmetic and never owns a
delayed model update or list rebuild. A new gesture cancels that settle and any
FLIP slide on its row through `cancelReorderAnimation`, preserving the row's
current visual position before pointer tracking takes over. Otherwise the Web
Animations transform can override the pointer-following transform, making a
row appear stuck even though its handle shows the drag cursor.

Pointer capture belongs to the stable container. Move/end events must match
the active pointer, and release, cancellation, or lost capture detach the
gesture listeners and clear its state before releasing capture. Closing the
modal also cancels settle/slide animations and removes transient drag styles.
Reduced motion skips the visual animations without changing when a move is
committed.

Toggle and keyboard changes still rebuild their role's rows and animate them
by stable item id. Since pointer moves preserve rows and their handlers, the
handle's ArrowUp/ArrowDown listener looks up the item's current array index on
every key press; a render-time index would become stale after the first drag.
Keyboard moves return focus to the moved item's handle.

The row label uses all width left by the drag handle and toggle. It deliberately
drops the shared callout-name `22ch` cap, while retaining overflow ellipsis, so
long actions such as **Fold defaults (open / closed / none)** are complete when
the window has room and shorten only at a real narrow-width limit. The saved
`edit` row is labelled **Create or edit callout** because it is one toggle for
both runtime outcomes, not two mutually visible actions.

#### The drop placeholder

While a row is dragged, `DragSortList.ts` marks the slot it lands in if let go
now: an empty `div.cs-drag-placeholder` (`aria-hidden`), the row's exact size,
filled with `--background-modifier-border`, the theme's neutral resting
border shade. In Obsidian's default palette this grey is darker in dark mode
and lighter in light mode than the hover-border shade. Reading the semantic
token directly follows the theme's UI palette without a plugin-defined
colour or mixing ratio.

- **The slot is the dragged row's own box.** The row never leaves the flow —
  it sits in its slot with a `translateY` floating it under the pointer — so
  `coverSlot()` reads its `getBoundingClientRect()` less `currentTransform`,
  relative to the list's, and hands top, left, width and height over as
  `--cs-drag-placeholder-*` properties, which `styles.css` turns into an
  absolutely positioned box. `.cs-menu-customize-list` is `position: relative`
  for that. Measured rather than styled, so a taller library row gets a taller
  slot; the corners are `.callout-studio-row`'s 8px.
- **It moves inside the FLIP.** When the row changes slot, the placeholder is
  re-covered within the same `animateReorder` mutation that moves the row, so
  the FLIP slides it to the new slot in step with the neighbours trading places
  with it (same 180ms ease, same cancel-and-restart on a fast drag). It is
  placed with `top`, never `transform`, because the slide is a `transform`
  animation.
- **Paint order.** It is the list's first child, so a row sliding past it is
  painted after it and passes over it, and the dragged row's `z-index: 1` lifts
  that row above everything. The list is deliberately not made a stacking
  context (`isolation`, a `z-index`): that would confine the dragged row's
  z-index to its own list, and a later list in the same window would paint over
  a row dragged onto it. Being absolutely positioned, the box takes no flex
  `gap` and no row index — `rows()` matches `rowSelector` and never sees it.
- **Entrance.** It fades in and opens out from 97% over 200ms
  (`cs-drag-placeholder-in`, behind `prefers-reduced-motion: no-preference`),
  mostly under the lifted row. The keyframes animate the `scale` property,
  not `transform`, so a slide that starts mid-entrance is not overridden.
- **It leaves with the settle.** A released row keeps its placeholder until
  its settle finishes, is cut short by the next grab, or the window closes;
  then the `is-dragging` look and the placeholder go together, unseen, since
  the row now covers the box exactly. A row let go in its own slot loses both
  at once. A rebuild that lands mid-settle — the libraries window's deferred
  refresh — takes the placeholder out with the old rows; the later removal is
  a no-op.
- **Reduced motion draws none.** The row never leaves its slot then, so it
  marks the slot itself.

#### Why this is not Obsidian's own list component

Obsidian 1.13's **Settings → Appearance → Ribbon menu configuration** looks like
the same job: a list you reorder and remove from. It was checked against the
1.13.7 `app.js` and the 1.13.1 typings, and it cannot be borrowed here.

It is a declarative settings page. `buildRibbonPage()` returns two
`type: "list"` definitions — the public `SettingDefinitionList` (1.13.0+, with
`onReorder`, `onDelete`, `emptyState` and `addItem`). Visible items get an X
(tooltip **Delete**) and a handle; hidden ones sit in an **Other ribbon items**
list as click-to-restore rows.

- **No way in from a modal.** A definition list is reachable only through
  `getSettingDefinitions()` (or a `SettingDefinitionPage`'s `items`). Nothing
  public renders definitions into a `Modal`.
- **All or nothing.** A non-empty `getSettingDefinitions()` turns `display()`
  off for the whole tab (see "`getSettingDefinitions()` returns `[]`" above), so
  using it means moving all 11 sections at once.
- **Version.** It needs Obsidian 1.13; `minAppVersion` is 1.7.2.
- **The behaviour is private.** The drag engine is a function inside `app.js`,
  not one of the `obsidian` module's exports. `SettingGroup.onDeleteItem`,
  `onReorderItem` and `focusNearestItem` exist at runtime but not in the
  typings, so they may change without notice. `SettingGroup` (1.11+) is the only
  public piece, and the `mod-list` class is just CSS in the app's stylesheet;
  both are the look, not the drag.

The delete-versus-toggle model is not what rules it out. A declarative row can
carry a toggle (`control: { type: "toggle" }`, which `mod-list` draws smaller on
desktop), two lists could stand in for the enabled and disabled bands as the
Ribbon page does, and `extraButtons` could host the per-category reset. What a
rebuild would inherit is Obsidian's drag engine as it is: a touch drag starts
only after a 250 ms press-and-hold, the keyboard reorder is Alt+↑/↓ on a focused
row (rows and handles are `tabIndex -1`, so the handle is not a Tab stop), and
neither `app.js` nor `app.css` mentions `prefers-reduced-motion`. This modal's
handle starts a touch drag at once (`touch-action: none`), is a Tab stop that
moves its row with ↑/↓, and honours reduced motion. Obsidian's engine does
auto-scroll while dragging, which lists of two to five rows never need.

Revisit this only if `minAppVersion` reaches 1.13 *and* the settings tab moves
to `getSettingDefinitions()`. Until then `MenuCustomizationModal` and
`ui/DragSortList.ts` stay.

### `IconLibrariesModal` — libraries in two bands

Opened by the **Manage libraries** text button at the end of Pick an icon's
source row; titled **Manage icon libraries** — the button's words with "icon"
put back, since the button is read inside a window already about icons and the
title has to stand on its own
([`iconpicker/IconLibrariesModal.ts`](../../src/settings/iconpicker/IconLibrariesModal.ts)).
It is the Customize menu items list with a different control on each row;
`ui/bandedSortList.ts` draws both. Above the line are the libraries the picker
offers, in its order. Below it are the rest, in catalog order and without
handles — reordering libraries the picker does not show would change nothing —
with a `cs-drag-handle-spacer` keeping every name in one column.

This window is also the only place a new library is downloaded: the Choose
source menu lists only the libraries the picker offers (see
[Callout editor](14-callout-editor.md#the-icon-picker)), and closes with a line
counting the ones left to download here.

The groups' headings are keyed `iconPicker.librariesAvailable` and
`iconPicker.librariesToDownload` — keys the Choose source menu shared until it
stopped listing libraries to download; they are now this window's alone:

| Heading | Holds | Order |
| --- | --- | --- |
| **Available libraries** | what the picker offers here | the user's order; the only draggable rows |
| **Libraries to download** | downloadable libraries this device lacks | catalog order |
| **Hidden libraries** | built-in libraries the person hid | catalog order |

A hidden library cannot sit under *Libraries to download* — there is nothing to
download — and the window has to list it to offer **Show**, hence the third
group. Its caption appears only while a built-in library is hidden, after the
to-download group. `computeRows()`
therefore returns the shown libraries, then the downloadable ones that are not
offered, then the hidden ones, and `groupOf(row)` names each row's group for
`captionOf`; a caption comes with a line above it, except at the very top.

The headings are not drawn like the menu's small muted capitals. All three —
**Available libraries**, **Libraries to
download** and **Hidden libraries** — are drawn exactly as **Built-in commands**
is in Commands and shortcuts: same size, weight, colour and line height, no
capitals, and the same spacing — 36px, a rule, 36px before a later heading, 24px
under the description for the first, 16px before the list. The description is a
plain `p.setting-item-description`, as that window's is, so the first gap also
matches on a phone, where a paragraph carries a margin a settings row does not.
The list's 4px gap is allowed for in the caption's and line's margins, and the
reset arrow's 26px box is pulled out of the heading's height so it never changes
the spacing. The rule that styles `.cs-menu-band-caption` and the first heading's
name reads Obsidian's own `--setting-group-heading-size`, `-weight` and `-color`
(with `--font-ui-medium`, `--font-semibold` and `--text-normal` as fallbacks)
and `--line-height-tight`, the variables that heading is drawn with, rather than
numbers copied from it, so the three follow a theme that restyles setting
headings and the phone's own scale (15px on the desktop, 14.99px on a phone,
where the variables also point at a muted colour — read from a browser, against
Obsidian's `app.css`). `iconLibrariesModal.test.ts` pins the variables, and pins
the premise — that **Built-in commands** is a plain `setHeading()` row nothing in
`styles.css` resizes — so a size given to that heading shows up as a failure
there.

**Available libraries** is a row of its own *above* the list rather than a
caption inside it, because the reset arrow lives on it and the list is rebuilt
on every change (`addFieldResetButton` returns a `sync` bound to one button
element, which a rebuild would orphan). The row is a `Setting` used as a plain
line: Obsidian pads every settings row in a window with 16px above and below and
a rule along the top (`.modal:not(.mod-settings) .setting-item:not(…)`, specificity
(0,4,0)), so the heading doubles its class under `.modal` to outrank it. The
arrow's box is taller than the heading's line, so it is pulled out of the row's
height with a negative margin: its appearing or disappearing moves nothing.
Obsidian also gives
`.setting-item-name` `unicode-bidi: plaintext`, which would pin an English
heading to the left of a right-to-left window; the heading sets `isolate` and
follows the window like the captions. The arrow is centred over the rows'
button column (32px, 12px in from the row's edge).

The description is a single translated string with one `\n` per sentence,
rendered by `descriptionLines()` as text and `<br>` in a fragment (the Callout
IDs row in the editor does the same), so each sentence sits on its own line and
a translation keeps the breaks by keeping the `\n`. It says three things: drag
to reorder, that some libraries can be downloaded and deleted, and that Lucide,
Emoji and Material come with the plugin so they can only be hidden. That
deleting a library leaves its callouts alone is told by the delete dialog, where
it matters, and not repeated here.

Each row has exactly one icon button, and which one says what kind of library
it is:

| Library | Above the line | Below the line |
| --- | --- | --- |
| Downloadable: Tabler, Font Awesome, Octicons, RPG Awesome, Simple Icons | `trash-2`: delete its files | `download` |
| Ships with the plugin: Lucide, Material, Emoji, Custom Icons | `eye-off`: hide | `eye`: show |

The line under each name says what the library costs: its icon count and, for a
downloadable library, its size — above the line the space it takes, below it
what a download would fetch (only the missing files, so Font Awesome with Brands
already on disk quotes Solid and Regular). Built-in libraries say "no download
needed"; Material says "each icon downloads when picked". The count and the
size sit in FSI…PDI isolates, as the source menu's counts do, so a
right-to-left interface keeps "1.6K+" whole, and a size keeps a no-break space
between number and unit so a phone row never parts "625" from "KB".

Behaviour to keep in mind before changing it:

- **Rows are recomputed, not kept.** Hiding, showing, a deletion, or a
  download finishing — here or in the picker's own prompt, heard through
  `packs.onChange` — rebuilds both bands from settings and pack state inside
  `animate()`, so rows slide into their new band. A change that arrives
  mid-drag waits for the drag's `pointerup`, `pointercancel` or
  `lostpointercapture`: rebuilding under the pointer would detach the dragged
  row.
- **The window scrolls in exactly one case: the library whose button was
  pressed changed band and landed out of view.** Then the list scrolls with the
  row, just far enough to show where it went — down to **Libraries to download**
  or **Hidden libraries** for a delete or a hide, up into **Available
  libraries** for a download that has *finished* or a show. Nothing else moves
  it: not a drag, an arrow key, the reset arrow, a download still running
  (the row only shows its spinner in place), a press that was refused, declined
  or failed, a library that arrives from the picker's own prompt, or a move
  that lands in view anyway. The window keeps a set, `following`, of the
  libraries whose button is being pressed through (`run()` adds the id and
  removes it in a `finally`, so a press that ends without the row moving is
  forgotten and a later move of that library by someone else scrolls nothing).
  Every refresh asks `takeMovedFollowed()` whether one of them has changed band
  since the last rows — a hide at once, a delete when its first file is gone, a
  download when its last file has arrived — and hands that key to
  `list.animate(change, follow)`. There, after the rebuild and before the slide
  is measured, `scrollToReveal()` (`ui/scrollToReveal.ts`) moves the window's
  body — `contentEl`, the one scroll container of the chrome
  ([Modal chrome](#modal-chrome--the-one-shell-every-window-wears)) — by the least that puts the row inside it with
  `REVEAL_MARGIN_PX` (40px, room for a group's caption and line above its first
  row) to spare, and not at all when it is already in. Because the scroll is
  instant and happens *before* `animateReorder` reads where the rows now are,
  its slide runs from where each row was on screen to where it now is on
  screen: the list visibly scrolls with the row, in the same 180ms, with no
  second animation to keep in step. Reduced motion skips the slide but still
  scrolls. A list attached without a `scroller` option (Customize menu items)
  never scrolls itself.
- **A rebuild never leaves the list empty.** `render()` builds the rows in a
  detached element and puts them in with one `replaceChildren()`; it used to
  `empty()` the list and append. The row whose button was just pressed has
  focus, and Chromium lays the page out on the spot when it takes focus off a
  node being removed — with the rows after it already gone, since Obsidian's
  `empty()` removes from the last child. The scroller is then too short for
  where it was scrolled, clamps, and stays clamped once the rows are back: with
  this window's list being most of its content, pressing a button on a row near
  the top threw the whole window to the top (measured 196px → 0; a press on the
  last row lost nothing, which is why it looked erratic). `replaceChildren`
  removes and inserts in one step, so the layout it forces sees the full list.
  `.click()` from a script never reproduces this, because it does not focus the
  button — use real pointer input. Customize menu items shares the list and was
  checked too; its lists are short next to the rest of its window, so the same
  press there never clamped.
- **A download writes no settings.** The library lands in its saved slot.
  Hiding, showing, reordering and the reset each save at once, like the menu
  customization.
- **The last library cannot leave the picker.** Its button is dimmed with
  `paintBlocked` and explains itself through `explainIfBlocked`.
- **Deleting asks only when something uses the library.** The `ConfirmModal`
  names the callouts — up to ten, then "and N more" — and says they keep their
  icons, which `IconService.deleteLibrary` makes true
  ([Icons](13-icons.md#deleting-a-library-keeps-its-callouts-icons)). "Something"
  includes the callout being edited whose picked-but-unsaved icon is from the
  library (`host.editing`, [Icons](13-icons.md#the-callout-being-edited-counts-as-a-user)):
  the registry cannot see it, and it is exactly what someone has just
  downloaded and applied. The users are worked out when the button is pressed,
  not when the window opens. An unused library is deleted at once; one in use
  is refused while saving is paused (`blockedWhilePaused`), and the editor's
  icon is passed to `deleteLibrary` so its drawings are sealed too.
- **The reset arrow** sits on the **Available libraries** row
  (`addFieldResetButton`), level with the heading and centred over the button
  column. It puts everything back the way the plugin
  came, so it shows while *any* of three things differs: the order, a hidden
  built-in library, or a downloadable library with any file on the device
  (`isInstalled`, so a partial download counts). Pressing it restores the order
  and the hidden list at once, then deletes the installed libraries one by one
  through the same `deleteFiles()` a row's trash button uses, each row showing
  its spinner and sliding below the line as its files go. It never downloads.
  When something would be deleted it asks first, naming the libraries and
  saying callouts keep their icons; with nothing to delete it does not ask. It
  is refused while saving is paused if a callout — or the edit — uses one of
  the libraries (the same seal as a single delete), and a library that cannot
  be deleted raises its own notice, leaves the arrow showing, and does not stop
  the rest. Obsidian stacks a phone's setting rows; a phone-scoped rule keeps
  the heading a row.
- **`openAndWait()` resolves with whether anything changed** when the window
  closes, which is what tells the picker to take it in: it rebuilds its menu
  and, only if what the panel shows changed, the panel
  ([The icon picker](14-callout-editor.md#the-icon-picker)). A deletion still
  running when the window is closed — a reset's last libraries included — is
  seen through first (`deletions`), because the picker reads the pack files
  when it hears back and a half-deleted library would still look downloaded.

### `CommandBuilderModal` — fixed + custom commands, one window

Two lists in one modal: the built-in commands (plain rows — nothing to
configure but a hotkey), and the user's own built commands (full rows with
add/edit/delete). Both kinds display the same two pieces of information side
by side, deliberately kept separate:

- **A hotkey chip** that only *reads* what Obsidian has bound
  (`hotkeyLink.ts`'s `hotkeysForCommand`), because a shortcut is a fact
  about the row, not something this window can set directly. On a disabled
  built-in row the chip is hidden and returns when the command is re-enabled;
  the saved Obsidian binding itself is preserved.
- **A button** that *opens* Obsidian's own hotkeys pane, filtered to that
  command (`openHotkeySettings`), because binding a key is Obsidian's job.

The **Built-in commands** heading reset is available while any
`FIXED_COMMAND_IDS` entry is disabled. It re-enables those commands through the
existing command-registration path and leaves custom commands untouched.
Assigned hotkeys are preserved: Obsidian exposes no public API for deleting
user bindings, and this reset does not write its undocumented hotkey store.

The list **subscribes to the registry while open** — deleting a callout from
another surface (the settings row menu) prunes any command depending on it
(via `CustomCommandManager.syncAll()`, see
[Editor integrations](10-editor-integrations.md#customcommandmanager--one-idempotent-sweep)),
and this window has to stop showing a now-deleted command in the same
moment rather than offering a dead row. Everything here **saves itself
immediately** on every change — there's no separate OK/Cancel, matching the
plugin's general save-on-change convention.

#### `CommandEditorModal` — the rows, and where each one's rule lives

The form is *Callout type*, *Callout format*, *Heading level*, *Action*, *Fold
state*, then a live preview of the command name. Every row is built
unconditionally and hidden with `cs-row-hidden`; one `syncVisibility()` decides
all of it, so the controls can never disagree about the current format. Every
configuration row also carries `cs-command-field`: all five pickers share one
control-column width. The four format-specific choices use `SelectDropdown`, while the callout picker is searchable. All five show
the same field shape and hover, press, focus and open feedback. The controls
become full-width when Obsidian stacks rows on a phone.

New commands select the built-in `note` type when available, then the first
registered type with a visible name. This avoids selecting a discovered fallback
whose display name contains only whitespace. Choices come from committed
definitions, excluding theme-only rows and transient previews; persisted
scan-created definitions are registered choices too. Existing commands retain
their saved callout id and can still edit a pinned legacy theme choice.

The choice rows live under `settings/command/` rather than in the modal, which
keeps each control beside its option rule and supplies one popup teardown path:

- **`commandRoles.ts`** — the format list refills itself per callout
  (a theme-owned callout has only Block), with a line explaining the absence.
- **`calloutRow.ts`** — the *Callout type* picker, over the shared
  [combobox](#the-shared-callout-picker). This was a `<select>` whose every
  option read `Abstract (abstract)`; the id is now shown only on a row it
  actually explains. Registered choices form one flat list without headings.
- **`optionRows.ts`** — the fixed Heading level and Action choices.
- **`foldStateRow.ts`** — the three fold states, shown only for Block. Heading
  and inline are not narrower versions of the same choice, they have no fold
  syntax at all, so the row hides rather than greying out. Both block *actions*
  show it: Wrap selection and Insert new write the same header line.

`SelectDropdown` mounts the four nonsearchable lists through the same
`ListboxPopup` used by the searchable callout picker. It exposes selection and
option refresh methods so the modal can sync dependent rows, and returns a
disposer for every popup.

`draft()` mirrors the sanitizer's shape, including omitting `fold` when it is
`"none"` — otherwise a command saved from this window and the same command
reloaded would differ by a key that means nothing. See
[`CustomCommand`](04-data-model.md#customcommand).

### Shared dropdown controls

All list-selection triggers carry `cs-dropdown-control`: the shared callout,
color, and language listboxes; plain selectors in commands, palettes, Quick
Insert, the icon picker, and occurrences; and the custom icon-source and Fold
selectors. They share a 36px minimum height (or `--input-height` when larger),
6px by 10px padding, Obsidian's own
[field corners](#field-corners-follow-obsidians-input-tokens), a 1px
`--background-modifier-border`, and the same `chevrons-up-down` indicator.
The face uses `--cs-btn-face` with `--interactive-normal` as its fallback,
hover, focus, press, and the open state use `--cs-btn-face-hover`, and the
resting control has no shadow. Text-entry fields share these surface states
through `cs-text-control`; see [How an input field focuses](#how-an-input-field-focuses).
Widths remain specific to each layout.

[`ui/dropdownControl.ts`](../../src/ui/dropdownControl.ts) exposes
`appendDropdownCaret` for the inert, `aria-hidden` indicator. Both triggers and
open lists follow the plugin's theme; none of these value selectors uses an
OS-native `<select>` menu. Action buttons, confirmation buttons, modal
launchers, and three-dot action menus keep their own behavior and styling.

[`ui/selectDropdown.ts`](../../src/ui/selectDropdown.ts) adapts
`ListboxPopup` with `searchable: false` for finite `{ value, label }` choices.
It owns the options and committed value, supports silent programmatic changes
and dynamic option replacement, and calls `onChange` only for a changed user
selection. Replacing options retains a still-valid value or chooses the first
option. There is no hidden native select. `cs-select-dropdown` adds a hidden
`cs-dropdown-width-sizer` grid of translated labels to preserve intrinsic
longest-option width, while fixed-width setting rows can still shrink it.
Callers destroy the adapter before rebuilding its row or closing its owner.

Select-only controls stay closed on Tab focus. Click, Space, Enter, or an arrow
opens the list; arrows, Home/End, and Page Up/Down move its active row. Typing a
label prefix finds an option, and repeating one character cycles matching
options. Click, Enter, and Space commit; Escape, Tab, and blur dismiss without
changing the value. Escape on an already closed list remains available to its
modal. The readonly input avoids opening a mobile text keyboard. Searchable
callout and color pickers retain their editable query behavior.

### Dropdown popups wear their control's face

The two popups that open from a `cs-dropdown-control` — `.cs-combobox-menu`
(every `ListboxPopup`, so every `SelectDropdown` too) and the Fold selector's
`.cs-palette-menu` — are painted from four tokens declared once on both:

| Token | Value | Paints |
| --- | --- | --- |
| `--cs-menu-face` | `var(--cs-btn-face, var(--interactive-normal))`, the control's own face | the popup, its sticky group heading, and the ring around overlapping colour circles |
| `--cs-menu-divider` | `var(--cs-light-line, var(--cs-field-border-hover, var(--background-modifier-border-hover)))` | the line between two groups |
| `--cs-menu-row-selected` | `var(--cs-light-row-selected, color-mix(in srgb, var(--cs-menu-face) 88%, var(--text-normal)))` | the committed row |
| `--cs-menu-row-selected-active` | the same shape, at 80% | the committed row while the pointer or keyboard is on it |

The `--cs-light-*` swatch in front of each of the last three is the [light
palette](#the-light-palette): an accent tint for the two rows and the soft resting
line for the divider, since under the palette the resting line is no longer the
face's own colour. The popups' `box-shadow` likewise reads
`var(--cs-light-menu-shadow, <the two-layer shadow below>)`. The prose from here
on describes the fallback, which dark mode and every community theme keep using
unchanged.

They used to be `--cs-surface` with a fixed `--radius-s`, which under a grey,
8px field read as a second object stuck onto it: near black beneath a `#333333`
field in the default dark theme, and square-shouldered beside a macOS
`superellipse` corner. Now the popup and its control share fill, corners and
outline:

- **Fill.** The popup is defined as the expression the field itself rests on, and
  the field never repaints it — it answers the pointer and focus with its edge
  ([A field answers with its edge, not its fill](#a-field-answers-with-its-edge-not-its-fill)) —
  so the two are one grey in every state, not just at the moment the list opens.
  Tests pin both halves: the popup's face is the control's, and nothing but the
  shared base paints a fill on a field. An earlier version wore the field's
  lighter *hover* fill instead (`#434343` in dark); it read as too light for a
  list and matched the field only while the field was hovered.
- **Corners.** `var(--textarea-radius, var(--input-radius, var(--radius-s)))`
  with `corner-shape: var(--input-corner-shape, round)`. A list is taller than a
  line, so it takes the radius Obsidian gives such a box: `--textarea-radius`
  where defined (mobile only, 24px, because `--input-radius` there is a 44px
  pill that would clip the first row's text), otherwise the field's own — 5px by
  default, 8px superellipse on macOS. The import window's paste box uses the
  same expression.
- **Outline.** `--cs-field-border-hover`, the colour an engaged field draws its
  border in, so the edge carries on from the field into the list. An open field
  carries that edge itself (`.is-open` is in the engaged rule alongside
  `:focus-within`), so the pair reads as one joined object.

Five things leaned on the old dark ground and are re-derived from the face:

- *Selected rows* were `--background-secondary-alt`, which in `.theme-dark` is
  `--interactive-normal` — the face itself, so a selection would vanish. They mix
  from the face toward `--text-normal`, which steps away in whichever direction
  the theme reads as "more contrast", as `--cs-btn-face-hover` does.
- *Group headings* use `--text-muted`: `--text-faint` is 2.2:1 on the dark face.
  The heading stays opaque and paints exactly the menu's face.
- *The divider between groups* cannot be `--background-modifier-border`: that is
  the face's own colour in dark and in macOS light, so the line would not show.
  It is the field's hover edge.
- *Dimmed id characters* in a callout row (`callout-studio-suggestion-id-dim`)
  are a 60% mix of `--text-muted` inside `.cs-combobox-menu` only; the `[!`
  popover keeps the faint original.
- *The colour circles' cut-out ring and transparent-swatch checkerboard* are both
  drawn from the ground behind the circles, which inside a popup is the face.

**The cost.** A callout's own colour, painted on its name and icon in the callout
picker, now sits on a lighter ground than the window. Contrast against the popup
for the built-in accents, worst case: dark (default theme) Note/Info/Todo blue
`#027aff` falls from 4.2:1 to 3.1:1 and Danger red from 4.9:1 to 3.7:1; light
teal `#00bfbc` (already 2.3:1 on white) is unchanged on Windows/Linux, where the
face is white, and falls to 1.8:1 on macOS, where the light field is itself grey.
(Painting the popup the field's hover fill instead would have cost 2.5:1, 2.9:1
and 1.9:1/1.5:1 — the reason that version was dropped.) Under the [light
palette](#the-light-palette) the macOS light case is gone: the face is white
there too, so the teal sits on the same ground as on Windows. The figures above
remain what a community theme in light mode on macOS gets.

`tests/dropdownPopupSurface.test.ts` pins the links (face = the control's face,
corners, outline, every derived state); `tests/modalBodyLayers.test.ts` allows the
sticky heading to paint `--cs-menu-face` instead of the window surface. To check
it against the real cascade, render each popup open beside its field in the
harness linked under [How an input field focuses](#how-an-input-field-focuses),
with body classes `theme-dark`/`theme-light` × `mod-macos`/`mod-windows`/`is-mobile
is-phone`. The open field needs no stand-in for `:focus-within`: `.is-open`
carries the edge. For hover, drive a real pointer (Chrome's
`Input.dispatchMouseEvent` over the DevTools protocol) rather than a forced
class, so Obsidian's own `:hover` rules take part — and read
`getComputedStyle(...).borderTopColor` as `color(srgb r g b)` with components in
0–1 when it comes from a `color-mix`, not as `rgb()`: parsing it as 0–255 reads
every mixed colour as black.

### Option rows are padded once

A `SelectDropdown` row is `.cs-combobox-option > .cs-dropdown-option-label`, and
the **label** owns the padding (`6px 12px`): text starts 13px inside the popup,
28.9px rows, the same in the language list, the occurrence **Format** filter,
the command editor and the palette editor. The command editor's four selects and
the palette editor's **Style** select used to add `padding: 8px 12px` to the
*row* as well, on top of the label's, which put their text 25px in — the field's
own text starts 11px in — and made their rows 45px tall. That rule is gone;
`tests/dropdownOptionRows.test.ts` fails if a row-level padding comes back.

### The id line under a callout's name

`renderCalloutIdLine` (shared by the picker and the `[!` popover) draws one
`.callout-studio-suggestion-id-item` per id, each carrying its own trailing
`", "` (the last has none), inside `.callout-studio-suggestion-id`. The line is
cut by the browser and by nothing else: `text-overflow: ellipsis` on the line
hides atomic inline boxes whole, so a line that does not fit always ends
`abstract, …` — cut between ids, the native `…` after a comma and a space,
identical on every row. A single id longer than the whole line ellipsizes inside
its own item.

It used to work out how many ids fit with a canvas measurement and append a
literal `...`, *and* carried the native ellipsis as a fallback. The measurement
ran while the rows were being built, before the list overflowed and a scrollbar
(12–17px) narrowed every row, so rows that had just fit now overflowed and got
the browser's `…` on top of the typed `...` — in one list, `check, ...`
(three monospace cells wide), a glued `…` and the two overlapping. Never measure
this line. The id line is also `direction: ltr` in any window, right-aligned under
`.mod-rtl` so it lines up with the name above it: ids are code, and in an RTL
window the bidi algorithm reordered the run and stranded the commas.

### The shared callout picker

Every place the user picks one callout out of a list is the same control:
[`calloutCombobox.ts`](../../src/settings/calloutCombobox.ts), over
[`ui/listboxPopup.ts`](../../src/ui/listboxPopup.ts). It replaced two native
`<select>`s — *Default fallback callout*
([`FallbackSection.ts`](../../src/settings/sections/FallbackSection.ts)) and
*Callout type* above — neither of which could be typed into or showed a callout's
icon or colour, while the `[!` popover in the editor had done both for a long
time. The fallback picker uses the shared field face and interaction rules;
there is no fallback-specific button styling.

The rows are literally the popover's markup
([`calloutComboboxRow.ts`](../../src/settings/calloutComboboxRow.ts) reuses the
`callout-studio-suggestion*` classes), and the id/alias second line is the same
function in both — `renderCalloutIdLine`, which `AutoComplete.renderSuggestion`
calls too, so a callout cannot describe itself one way in the editor and another
way in settings. Matching goes through the same `calloutMatchesQuery` — id,
display name and **aliases**, substring rather than fuzzy — ordered by
`matchRank`'s four tiers (exact, name-prefix, id/alias-prefix, anywhere) so that
typing `no` answers `Note` rather than `Annotation`.

An optional `groupOf` callback supplies a stable group key, translated label,
and numeric order. When supplied, groups take priority over search ranking,
while rows within each group keep the normal match/name order. Only the
**Find callouts** picker enables this for registered and unregistered
choices; other callout pickers keep their existing flat lists and choices.
Headings and dividers reuse the palette picker's rendering, and filtering out
all rows in a group removes its heading too. Each contiguous group is wrapped
in a `role="group"` element with `cs-combobox-group`; its opaque
`cs-combobox-group-label` is sticky at the menu's top until the next group
replaces it. Group containment handles the handoff without scroll listeners.
The occurrence picker sets `hideSingleGroup` to suppress redundant headings,
while `showSingleGroupKey` keeps the Browse heading when All types is the only
matching group.
The All types scope is iconless and remains separate from registry definitions.
Color pickers retain their headings even with only one matching group.
`renderComboboxRows()` sets `cs-combobox-menu-grouped` only when it actually
creates a group, clearing it before every rebuild. That class owns the menu's
top padding and sticky-heading scroll allowance, including transitions to
ungrouped, empty, or create-only results.

Two options add something after the rows, and they are opposites. `footerRow`
is an action (the palette picker's Create "name"): it answers the pointer and
runs on click, though the arrow keys skip it. `footerNote()` is information —
plain text asked on every rebuild, nothing when it returns `""` — drawn last as
`cs-combobox-footer-note` with no role and no listener, outside `rowEls`, so
nothing highlights it and a press on it is swallowed by the menu's
`mousedown`. A rule above it, the same as between groups, marks the end of the
list. Pick an icon's source menu uses it to count the libraries left to
download.

The occurrence **Format** filter and the command editor's Format, Heading level,
Action and Fold state rows use `SelectDropdown`, backed by the same shared
listbox. Their readonly input displays the chosen value without filtering.

A query that matches nothing does **not** dead-end. When the call site supplies
`onCreate`, the empty state is replaced by a real, keyboard-reachable row
offering to create the callout under that name — the same offer, and the same
`callout-studio-suggestion-create-new` markup, as the `[!` popover. The picker
then adopts what comes back, which is why `choices` is a *function*: the list is
re-read after the editor closes, so the new row is simply there.

Two rules in `listboxPopup.ts` carry the searchable mode and are worth reading
before changing it:

- **The query is separate state from `input.value`.** Opening does not search
  for the committed label (that would list exactly one row); it starts empty and
  selects the text so the first keystroke replaces it.
- **Blur never commits.** Leaving with half a word typed reverts. `fallbackCalloutId`
  is persisted *and* synced, so a picker that guessed "probably the first match"
  would write an id the user never chose onto every device.

`setSelected(key, missingLabel)` can supply a display label when no list item
resolves. The value remains `undefined`, but the field retains that label and
keeps its leading swatches visible; dismissing a search returns to the same
label. `PaletteCombobox.setSelection` uses this for **Deleted color**, so a
missing palette does not mark the control `is-empty` or fall back to the search
placeholder. Opening that unresolved selection leaves every option inactive;
once open, pointer hover or keyboard navigation establishes the active row.
This prevents the first saved colour from looking preselected when none is
selected.

Pointer highlights and keyboard highlights have separate origins. Leaving a
row or the menu clears a pointer highlight and the temporary colour preview;
the committed value stays unchanged. Arrow-key highlights survive pointer
exit. The last active input method owns the one visual highlight: an arrow key
suppresses `:hover` on a stationary pointer row, and actual pointer movement
returns the highlight to the row beneath it, even without another `mouseenter`.
Hover never scrolls a row into view; keyboard navigation does. The icon-source
menu and pack filters use this same component. Quick Insert follows the same pointer/keyboard
distinction through its single `is-active` highlight. A row that is both
`is-selected` and `is-active` gets a visible active treatment while retaining
its selected state; hovering the committed option must not look inert.

Callers **must** call `destroy()` — a modal from `onClose`, a settings section
through `registerDisposer` — because the popup holds a document-level click
listener. Destruction also disables the detached input permanently so stale
DOM events cannot reopen a menu and attach new listeners.

`ui/menuEscape.ts` registers a keyboard host at each plugin modal and settings
surface. A menu pushes a temporary public Obsidian `Scope` only while open and
pops it on close; the first Escape dismisses the menu, while the next reaches
the original host. A DOM key listener alone is too late for Obsidian's keymap,
and a permanent child scope would swallow Escape even when the menu is closed.
The icon-source menu shares this lifecycle. No global app lookup is needed.

Every custom dropdown menu carries `cs-scrollable-dropdown-menu`, whose 320px
maximum and vertical scrolling are the common fallback. Shared listboxes and
the icon-source picker use `listboxPopupLayout.ts` to fit the visual viewport
and all clipping ancestors, including inner scroll bodies and sidebar panes.
Menus normally open below the trigger; when their content will not fit and
there is more room above, they open above. Horizontal bounds also account for
RTL and viewport offsets. Layout runs after rendering/filtering and updates
on viewport resize, surrounding scroll, and control/container resizing. Closing
removes these listeners, observers, and temporary layout properties. The hidden
three-item Fold menu needs only the shared static cap.
Shared listboxes have no vertical menu inset; the first and last rows meet
its inside edge. Selection-only command choices use 8px vertical and 12px
horizontal row padding.

Two details in [`listboxPopupEvents.ts`](../../src/ui/listboxPopupEvents.ts) are
load-bearing and have already been bugs. Selecting the label on click has to
happen on `click`, not on `focus`: the browser fires mousedown → focus →
mouseup → click, and mouseup places a caret that undoes an earlier `select()`.
And the menu's `mousedown` `preventDefault()` is what lets a mouse selection
commit at all — a click on a row is also a blur, and blur lands first.

Field names are assigned by `fieldAccessibleName.ts`, using a hidden sibling
label referenced through `aria-labelledby`. The label has the `hidden`
attribute, with `opacity: 0` and `pointer-events: none` as a CSS fallback if a
theme overrides its display. This keeps accessible names without the hover
tooltip Obsidian derives from `aria-label`.

The control itself uses the [shared dropdown styling](#shared-dropdown-controls),
matching the other listbox triggers. The input inside is
painted down to nothing, and **its rules are descendant-
qualified on purpose**: Obsidian styles `input[type='text']` at specificity
(0,1,1), which beats a lone class — a bare `.cs-combobox-input` rule loses, and
that is how the field first came to look like a second box drawn inside the
control.

The Color row uses the same popup through
[`paletteCombobox.ts`](../../src/settings/paletteCombobox.ts), which adds group
headings (*Custom* / *Obsidian* / *Presets*, emitted per run so a group filtered
to nothing leaves no stranded heading). A query with no match offers a
keyboard-reachable action to create a color under that name.
Only the *control* moved out of `CalloutEditor`: which palette the form's colours
resolve to, the "Deleted color" state when they resolve to none, and the
save-state baseline that feeds all stayed, because they read and write editor
state.

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

Covered above under Modal chrome. Automatic onboarding requires confirmed
fresh-install eligibility and checks both `settings.welcomeSeen` and the
device-local welcome marker. An absent `data.json` alone is insufficient; see
the [startup decisions](08-settings-sync-and-recovery.md#launch-decision-table).
The welcome screen can be reopened via the info icon in settings or the
dev-convenience protocol handler `obsidian://callout-studio-welcome`
registered in `main.ts`.

Only the automatic first-launch welcome (`new WelcomeModal(plugin, true)`) adds
`welcome.syncNote` below the tagline: a user joining from another device should
let sync finish, and their setup appears once it arrives. It is informational;
the [genesis rule](08-settings-sync-and-recovery.md#a-devices-first-file-and-the-shipped-defaults)
is what keeps this device's defaults from overwriting that setup.

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
[`welcomeDemo.ts`](../../src/settings/welcomeDemo.ts).

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

## Saving-status banner

`saveStatusBanner.ts` is shared by the settings page and the callout editor.
It subscribes to `SettingsWriter.status` and redraws only its own slot, preserving
scroll position and form fields.

On the settings page the slot is `CalloutListsScaffold.bannerSlotEl` — an empty
div the lists scaffold creates directly under the **Callout Studio** title row,
which is why `SettingsTab.display()` renders the banner *after*
`calloutLists.render()` rather than first. It is still ahead of every section,
since it is the reason nothing below it will be saved; above the title it read
as a message about the settings window rather than about this plugin.

Each redraw builds the same three parts: a header (`alert-triangle` plus a title
row), the message paragraphs, and `.cs-readonly-banner-actions` holding whatever
actions apply. The title is chosen from the writer, not from the message —
`isFrozen || status.frozenReason` reads as *Saving is paused*, a bare
`status.failure` as *Settings were not saved* — so a frozen session that also
fails a retry still says it is paused. The card is outlined on all four sides
rather than barred down one edge, which is also what makes it read the same way
in an RTL locale; the action row is `flex-start`-aligned with the prose and
stacks full width under 600px.

The action choices, before/after behavior, confirmation policy, failure reasons
and editor restrictions are owned by
[Saving status and recovery actions](08-settings-sync-and-recovery.md#saving-status-and-recovery-actions).
Keep this UI as a subscriber to that state rather than inferring write authority
from a label or from whether callouts happen to be visible.

Buttons are disabled while their action is running. A completed missing-file
check leaves explicit feedback in the same slot. Disposers run on tab
hide/re-render and editor close. Action text uses `t()`, and so does the paused
copy below; a one-off failure's message uses the shared saving-message contract
described in the canonical chapter.

For an unreadable file the banner asks `actions.diagnose()` once per paused
episode, and again after each action. **Replace settings file** appears only
for causes waiting cannot fix, and **Discard recovery copy** only for a
`recovery-read` freeze. Both are `mod-warning` and run only after a
`ConfirmModal`. The one exception to the red is a `combined` file: replacing
it keeps every setting, so **Replace settings file** is the main button
(`mod-cta`), its confirmation's button is too, and after the yes the banner
diagnoses the file once more and replaces nothing if it is no longer `combined`
(or readable), because keeping everything was the promise. The retry button
reads **Try again** (**Check again** for a missing file). **Go to version history**
is offered in every state on the settings page (below). The settings page passes `plugin.recovery`'s methods in
`ReadOnlyBanner.ts`; the callout editor passes only its retry.

### What a paused banner says

Whoever reads a paused banner has usually just seen "missing" next to their
settings and assumed the worst, so every paused state — frozen for `missing`,
`unreadable`, `recovery-read` or `newer-version` — reads the same way, in two
or three short paragraphs chosen by `pausedCopy()` in
[`saveStatusCopy.ts`](../../src/settings/saveStatusCopy.ts):

1. **Calm.** "First of all, take a deep breath — everything is going to be
   okay", then what is safe, then why the page is read-only (`pausedNote`,
   because `SettingsTab` makes every edit `inert`; see
   `sections/pausedReadOnly.ts`). The editor gets the same paragraph without
   the page sentence.
2. **What happened**, from `status.reason` (latest failure, else the frozen
   reason). After a manual **Check again** finds the file still missing, it
   gets more specific and names the cloud-storage "keep it downloaded" setting
   that most often keeps a synced file away.
3. **What to do**, from `status.frozenReason` — the field that decides the
   buttons. A known cause of an unreadable file goes here, as the existing
   `saveStatus.diagnosis.*` text.

While an action runs, the calm paragraph stays and "Working on it…" replaces
the other two, so the card does not collapse. A one-off
*Settings were not saved* failure (not frozen) keeps its single message and,
for an unreadable file, the diagnosis as a muted `.cs-readonly-banner-detail`.

Two rules keep the words honest, and `tests/saveStatusCopy.test.ts` checks both
across every paused state, failure, surface and diagnosis:

- **A sentence that names a button appears only with that button.** The banner
  decides its buttons once (`PausedButtons`) and passes the same answers to
  `pausedCopy()`, and each "choose X" sentence is a key of its own. A reason
  whose usual message names a button the paused banner may be labelling
  differently gets paused wording of its own: `changed`'s message names
  **Try again**, which reads **Check again** for a missing file.
- **A comforting claim needs a fact.** "Your callouts are still here on this
  device" only when `writer.hasRecoveryState`, never over a page of built-ins.
  "Checks again every minute" only where `rechecksWhilePaused()` — the same
  function `pausedRecheck.ts` runs on — says the timer covers the state.

### Guided order for a missing file

With a missing file on the settings page, the next step is the main button:

| When | Buttons |
| --- | --- |
| Nobody has checked yet | **Check again** (`mod-cta`) · **Restore these settings** / **Create settings file** · **Go to version history** |
| A manual check came back empty | **Restore these settings** (`mod-cta`) or **Create settings file** · **Check again** · **Go to version history** |

`checkedMissing` holds the second state for the rest of the missing episode, so
the order does not flip back while an action runs or after a cancelled
confirmation; `stillMissing`, which only colours the message after a check, is
separate. **Create settings file** is never the main button: what is shown may
be only the built-ins. Every other state, and the editor, keep one order.

### Go to version history, and scrolling to a row

**Go to version history** (`showBackup`) does not open the Version history
window. It scrolls to **Version history › Earlier versions** and highlights that
row, the way the
first-install import prompt takes the reader to the **Import** row: while
saving is paused the window can only be browsed, and the banner is what says
why. `renderBackupSection` returns the row, `SettingsTab.display()` passes it
to `renderReadOnlyBanner`, and the row keeps `cs-paused-allowed`, so it stays
usable and unfaded on a paused page.

Both notices share [`targetHighlighter.ts`](../../src/settings/targetHighlighter.ts).
`createTargetHighlighter(row)` marks the row `cs-scroll-target`; `run()` scrolls
it smoothly to the centre, waits until 80% of it is in view (an
`IntersectionObserver`, with a one-second fallback), then adds
`cs-scroll-target-highlight`, a 1.5 s accent pulse that starts and ends on the
row's own computed background and shadow (`--cs-scroll-target-rest-*`), so a
theme's grey row does not flash. `dispose()` is registered with the tab and runs
on every re-render and on `hide()`.

Keyboard focus goes with the reader, before the scroll starts and with
`preventScroll`, so the glide is not cut short and a screen reader announces
the destination at once. Obsidian 1.13 makes every settings row focusable
(`tabindex="-1"`) and moves between rows itself — the arrow keys go row to row,
Enter reaches the row's button — so the row takes focus; older Obsidian rows
cannot, and there the row's first usable control does. An inert row (Import,
while saving is paused) is left alone. `run(fromKeyboard)` passes `focusVisible`:
the buttons report a click with `event.detail === 0` (Enter or Space) as from
the keyboard, so a key press shows the focus ring and a mouse click does not.
With `prefers-reduced-motion: reduce` the scroll jumps (`behavior: "auto"`,
via `prefersReducedMotion()` in `ui/flip.ts`); the pulse only fades a colour and
stays.

## `SettingsRecoveryModal` — Version history

Opened from **Earlier versions** in the **Version history** section
(`renderBackupSection`, between **Import and export** and **Language**), whose
button reads **View versions**. The saving banner's **Go to version history**
scrolls to that row rather than opening the window itself. Its help text is one
continuous paragraph via `setDesc(string)`; translation newlines are replaced with
spaces so older locale tables also wrap naturally. The window asks `recovery.listVersions()` once per open
(a generation counter drops a late answer after close) and draws one timeline,
newest first, grouped by local calendar day. The day headings start with the
localized date (`dateStyle: "long"`), then **today**, **yesterday** or **N days ago**
in parentheses, including for versions older than a week. Relative wording uses
`Intl.RelativeTimeFormat`, with `numeric: "auto"` for today and yesterday and
`"always"` for earlier days; day differences use local calendar dates so DST and
time of day cannot shift the age. Future dates have no relative suffix. A continuous
vertical line connects one small decorative dot per version across the groups. Day
headings have padding above and below, with twice as much above as below
(normally 32px and 16px), to separate them from the preceding versions,
except the first heading, whose top padding is `--size-4-1` (normally 4px)
because no versions precede it. Each has a short horizontal connector from the rail to the centre of its first
text line. The connector and the first rail segment share a position calculated
from that padding and half the heading's line height, so spacing does not shift
the connector away from the text. Spacing derives from `--size-4-4`, with a 16px
fallback, so an undefined spacing token cannot erase the padding or invalidate
the connector position; logical inline positions also mirror it in RTL. Unknown
dates have their own final group. This display grouping does not change stored
timestamps or retention rules. A setup kept in two places is one row; the merge rule and
where the reasons behind its automatic name are stored are in
[Recovery without file surgery](08-settings-sync-and-recovery.md#recovery-without-file-surgery).

Each row is an ordinary `Setting`:

- **Time:** a separate `<time>` element (`.cs-recovery-time`) displays the
  short time in the interface locale across the timeline from the card, using
  `--text-faint` and a font one pixel below `--font-ui-smaller`. It sits
  outside the summary text; the group heading provides the date. Logical
  positioning mirrors the time, marker and card together in right-to-left UIs.
- **Timeline marker:** every version has the same small decorative dot on the
  line, using `--background-modifier-border` to match the rail and day connectors.
  It is hidden from assistive technology and has no source icon, accessible
  source label, or tooltip. Storage location and category do not affect it.
  Hovering the card, time or marker highlights the card background, changes the
  time to `--text-normal` and the marker to `--text-muted`. A transparent row
  pseudo-element extends the hover area across the timeline gutter; the time
  sits above it so its text remains selectable.
- **Name line** (`renderVersionName()` in [`versionRow.ts`](../../src/settings/versionRow.ts)):
  plain text naming why the version was kept. If the reason is absent or unknown,
  `versionCategory()` selects **Automatic backup** when any `history` or `backup`
  source is present, or **Sync copy** for a version made entirely of `copy`
  sources. This category is only a fallback title; known reason titles are
  unchanged. The name has no edit button or field.
- **Summary** (the description): "Same as your current setup", "Can't be read
  as settings", or the callout-type and difference counts. The callout-type count and difference count always
  occupy separate lines while the controls sit beside the text, and share a
  wrapping horizontal group when the controls drop below it; identical or unreadable versions
  retain their single status line. Sync-copy filenames are not displayed.
- **Controls:** **View details** (eye; every row, including a version identical
  to now, which shows **Same as your current setup**), **Delete** (trash, red only on hover or focus) and, for a
  readable version, **Restore**.

**Delete** confirms removal of the available copies once, adding a warning about
file deletion syncing only when the version includes backup or sync-copy files.
Another device's private history may retain the version. Then
`recovery.removeVersion()` deletes every available copy; the list is read again
either way. **Restore** is `mod-warning`, dimmed (not disabled — a press says
why, see [Blocked main buttons say why](#blocked-main-buttons-say-why)) while
saving is paused or when the version equals the current setup, and confirms
before calling `recovery.restore()`; both confirmations and their notices quote
the version's name. There is no per-entry export action; the settings page's
ordinary **Export** continues to export the displayed setup.

The row floor for the text column is `12rem` (`min(12rem, 100%)`): about what a
version name needs before it breaks a word per line. On a desktop window
the controls sit beside the text; on a phone there is no room for the floor
beside them, so the control cluster wraps onto its own line under the text and
stays at the end — still compact, never Obsidian's full-width phone button.
`versionRowLayout.ts` observes the rows and their info/control boxes with the
owning window's `ResizeObserver`, and toggles `.cs-recovery-controls-wrapped`
when the controls are below the info box. This follows actual flex wrapping
instead of a viewport breakpoint, including translated button widths. In that
state the two counts share a line where space allows. The observer is disconnected
before a list reload and on modal close, with the ordinary stacked counts as the
fallback without it.

`SettingsRecoveryDetailsModal` (**Version details**) opens over that list as a
read-only report, including while saving is paused. The source's saved date and
time appear in parentheses beside the modal title, in smaller, muted text within
the same header; a missing time uses localized `recovery.details.unknownTime`. The
version's automatic name remains in the history list rather than appearing again
in this window. Details starts directly with **What changed**, without a category
badge, source explanation, storage card, or sync-copy filenames. Underlying source
metadata, dates, grouping, retention, and deletion behavior are unchanged.

The bordered **What changed** panel has a smaller, muted heading
on a full-width row. Below the heading, the
difference total and comparison context (such as **24 differences from your
current setup**) and removed/changed/added pill badges share one row where
space allows. The flex layout wraps on narrower screens or with longer translations.
The total uses smaller, muted text; the pills retain their red/yellow/green fills.
An equal version uses **Same as your current setup** with no counters.
An unreadable version uses **Comparison unavailable**, with its explanation
on a full-width row below.
`recovery.details(source, version)` captures the source and current setup when opened;
rendering does not load that version into the active registry. The report stays
on that snapshot until closed; reopening details captures a new comparison.

`recoveryComparisonTable.ts` lays the report out as one table per settings section,
in the settings page's order, each with four columns: **No.**, **Item**, **Current
setup** and **After restoring this version**. A table's head has two rows — the
section title, a `<button>` that folds the section down to that row, and the column
headings — and the whole `<thead>` is the sticky layer at `top: 0`, so the two pin
as one block and let go with the section's last row. The window body's top padding
moves into the report, so nothing shows above a pinned head (the rules are in
`tests/modalBodyLayers.test.ts`). Tables use the theme's `--radius-m` for their
outer corners. `clip-path: inset(0 round var(--radius-m))` clips the cell backgrounds
without the scroll container that `overflow: hidden` would introduce and that
would break the sticky header. Each item is one `<tbody>`: a number cell spanning
all of its rows (numbers run on across sections), its title with a
Changed/Added/Removed badge, a drawing of the whole item per side where one exists,
then one row per changed field with the label in the Item column. An absent side
says so explicitly. Below 600px the rows become two-column grids: number and title
on one line, the two sides beneath, each field's label on a line of its own.

`recoverySections.ts` and `recoveryCollections.ts` build the sections from
`SetupDetails`, matching each callout type, palette, custom icon, command and
context-menu entry by id so all of its changes stay in one item;
`recoveryModel.ts` holds the shapes and the shared `recordFields()` diff. Effective
definitions include shipped built-ins, so resetting a built-in override is a change
to its default rather than a deletion. A global style change appears once, as
heading/inline/block items with previews from `recoveryRolePreview.ts`, not on
every callout it restyles. The comparison has no row cap.

Rendering yields between batches of eight items. A loading message is delayed
by 250 ms and, once shown, stays visible for at least 250 ms to avoid a flash on
fast comparisons. A generation check and component-owned timers stop stale work
after close or reopen. The comparison is published only when the current render
finishes; a rendering failure leaves an error message instead of a partial table.

`recoveryPreview.ts` provides `renderRecoveryPreview()` for a representative regular
block and `renderRecoveryImage()` for an uploaded image. Both sides use their own
snapshot's artwork; missing cached artwork gets a placeholder. Blocks use sample
content in the current light/dark mode, not historical theme CSS or real note
Markdown. The renderer does not change the live registry or image pack and does
not install a generated stylesheet. Snapshot images are sanitized and isolated as
data images or stencil masks. Folding events belong to the modal's component and
are removed when the report is rebuilt or closed.

`recoveryValues.ts` draws every value: colors as swatches, icons from that side's
own saved artwork with their library and style, gradients, border frames, orders as
numbered lists, switches as On/Off, and palette or callout references as what they
name on that side. Known labels use `t()`; unknown field names remain literal and
unknown values render as nested labelled lists. Nothing sits behind a disclosure:
text over 160 characters shows an excerpt and its length. Values are inserted as
text, including SVG and other markup; visual previews use sanitized artwork
separately. There are no full-setup, provenance, retention or
raw-data sections, and an unreadable source shows that comparison is unavailable.
The details window makes no network, save or restore calls and has no restore
button.

## Reduced motion

The plugin has no setting for this and never stores a choice. It reads the
operating system's preference, which Obsidian's Chromium exposes as the
`prefers-reduced-motion` media feature (macOS **Reduce motion**, Windows
**Animation effects** off). Obsidian itself has no reduced-motion option and
most of its own animations ignore the preference, so everything below is the
plugin's own doing. To test without changing the system setting, use the
developer tools' **Rendering → Emulate CSS media feature
prefers-reduced-motion**.

There are two entry points, and a new animation uses whichever matches how it
is driven.

**From JavaScript** — `prefersReducedMotion()` in
[`ui/flip.ts`](../../src/ui/flip.ts) is the only function; it is a fresh
`matchMedia` read on every call, so a change in the system setting applies to
the next animation without a reload. It is exported from `flip.ts` for
historical reasons, not because the check belongs to FLIP. Its callers:

- `flip.ts` itself — row reorders skip the FLIP animation and just land.
- `DragSortList.ts` (and so `bandedSortList.ts`, which drags through it) — read once when a drag starts; the settle and slide
  animations are skipped and no drop placeholder is drawn (see the drag section above).
- `settings/targetHighlighter.ts` — `scrollIntoView` uses `behavior: "auto"`
  instead of `"smooth"`; the pulse only fades a colour.

**From CSS** — `@media (prefers-reduced-motion: …)` blocks in
[`styles.css`](../../styles.css). They take two shapes:

- **`reduce` blocks** turn something off: `transition: none` on the portable
  cards and footer contact link, `animation-duration: 1ms` on the plugin
  import window's "checking" vault card, the icon tile transitions, and the heading callout's entrance
  transition (which also never animates into a print or PDF snapshot).
- **`no-preference` queries** switch something on only when motion is
  allowed: the usage menu's count fade, the drop placeholder's entrance, and
  the icon swap arrows' drift loop with its hover trigger. Use this shape when the selectors are so specific
  that an `animation: none` in a `reduce` block could not outrank them; a
  loop that never starts needs no stopping. The `reduce` block beside the
  icon tiles says so and deliberately leaves the arrows alone.

The vault-scan fade is the same idea, documented with its feature in
[Vault discovery](11-vault-discovery.md).

---
Next chapter: [17-i18n.md](17-i18n.md)
