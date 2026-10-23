# Settings UI and modals

Covers [`src/settings/SettingsTab.ts`](../../src/settings/SettingsTab.ts), the
section modules under `src/settings/sections/`, the shared modal chrome, and
the individual modals not already covered by
[Callout editor](14-callout-editor.md) or [Icons](13-icons.md).

## `SettingsTab` - composition and refresh plumbing

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
separate subheadings. The table is one rounded box with a line between rows, as
a settings group is drawn, and the recommendation is a plain line of the
window's text rather than a box.
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
its count appears as a faint number at the end of the file's line, drawn like
every other count (see [Faint counts](#faint-counts---how-many-as-obsidians-search-shows-it)). The
shared file-heading button uses its visible name and count as its accessible
label, without a redundant hover tooltip. Navigation scrolls a source into view
and flashes it without selecting it or focusing the editor (see the occurrence
navigation notes in [Vault discovery](11-vault-discovery.md)); the conversion
leaf passes itself as the `origin`, so its drawer closes on a phone. The shared
`ui/sidebarSelection.ts` keeps the clicked card current until the editor's
selection differs from the one it landed on, or the document changes, without
polling. Subscriptions are released when the active card changes or the sidebar
closes. Both sidebars follow the caret through the shared `ui/sidebarCursorSync.ts`
(see "Cursor-follow" in [Vault discovery](11-vault-discovery.md#cursor-follow));
Review conversion's lookup is `portable/portableRowAtCursor.ts`, and
`PortableConversionNavigation` owns its hold, its drawn-rows map and the mark.
The summary line drops its heading-link half when `plan.linkCount` is 0
(`portable.selectionSummaryNoLinks`), rather than saying "0 heading links".

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
A **Custom** tag sits beside the format/line label. It is Obsidian's flat flair (`.flair.mod-flat`), the same tag as **Default** on callout rows. Outside an
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
CTA on the row's outer edge - its right end under LTR, its left under RTL - the
side every other section in the tab puts its primary button on.

Colour is what separates them, not size. Add wears `.mod-cta`; **Discover
now** is Obsidian's own grey button, with no face of the plugin's (decision 14
of the native-look plan). On a phone that grey (`--background-secondary`) is
also the colour of the settings pane these rows sit on today, so the button
reads flat there until the tab moves into Obsidian's setting boxes, which are
white on a phone.

Both take their height from `--input-height` - already 30px on desktop and 44px
(`--touch-size-m`) on mobile - so they match **New palette** and every other
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
  width - at a phone width that left *Saved color palettes (1)* stacking a word
  per line beside a button that had not moved. Wrapping picks the other answer:
  the action group drops whole to the next line and the title takes the width
  back. Line breaking measures each item at its max-content size, so the break
  lands exactly where crushing would otherwise begin - no breakpoint to pick, and
  none to keep in step with a translation.
- **`margin-inline-start: auto` on the control**, because a wrapped flex item
  starts its new line at the *leading* edge - the buttons reappeared under the
  first letter of the title instead of out where they had been a pixel earlier.
  The auto margin is inert on the unwrapped line (flexing has already taken the
  free space), so one declaration covers both states.
- **`flex-wrap: wrap-reverse` on the callout-list control**, which is what stacks
  **Add new callout** above **Scan for callouts** when even a line of their own
  is too narrow for both. It hangs the *last* line at the top, so it is true only
  while the CTA is last in the DOM - the same ordering that lands it on the row's
  outer edge horizontally. Swapping the two `addButton` calls looks like nothing
  and silently inverts the stack; the test's DOM half exists for that.
  `justify-content: flex-end` is restated on the control rather than inherited
  from Obsidian, since it is per-line and is what holds the lower button to the
  trailing edge.

**When the line has no room, Scan leaves the heading - on every device.** While
the title and both buttons fit on the heading's one line, they stay there. When
they do not - a phone, an iPad in portrait, a narrow settings window, a long
translation, larger text - **Add new callout** keeps the title's line at the
trailing edge and **Scan for callouts** goes to the foot of the list, under
**Load more** when there is one. The heading therefore never splits its two
buttons over lines of their own; the `wrap-reverse` stack above is only what
shows where nothing has measured (no `ResizeObserver`). The order at the foot is
not arbitrary: Load more is the list's own last child and continues it, so it
must stay against the last row, while a scan is about the section, not one row
of it - with Scan above Load more, the revealed rows would appear below a scan
button.

The switch is **measured, not keyed to `.is-phone` or to a width**, in
`sections/scanPlacement.ts`. It used to be `.is-phone` alone, which left an iPad
in portrait and a narrow desktop window with two lines of buttons under the
title. The width it takes is three translated, font-dependent boxes, so only the
layout can answer it:

- The heading is read **as it would be with Scan**, never as it is. With Scan
  gone the line has room by construction, and an answer read off that state
  brings Scan straight back - a flip on every frame. So the heading gets
  `cs-scan-measure` (the hiding rule skips it), its info and control boxes are
  read, and the class comes off again in one synchronous turn, before paint.
  "Fits" is the control on the title's flex line. The title is `flex: 1 1 auto`
  (it used to reserve 12rem), so the line breaks exactly when the full title and
  both full buttons stop fitting side by side.
- The measuring class is on the heading and nothing below it. The footer keeps
  its state while the heading is read, so the body never shrinks for a moment
  and the pane's scroller has nothing to clamp.
- The answer is `.cs-scan-below` on the section wrapper; the stylesheet hides
  the heading's copy and shows the footer under it.
- It is asked again when the pane's width changes, through a `ResizeObserver` on
  the tab's title row ("Callout Studio"), whose box follows the pane and nothing
  this toggle does. Observing the heading itself would loop: moving Scan changes
  its height inside the observer's own callback, which ends in "ResizeObserver
  loop completed with undelivered notifications". It is also asked when the
  painter rewrites the heading's count (`placeScan`), from a **microtask**: the
  painter runs inside `display()` too, before the sections under it exist, and a
  layout read there flushes half a page, so the scroller clamps and the reader
  loses their place. A language change rebuilds the tab and the observer with it.
  The label turning into "Scanning…" deliberately does not re-ask: moving the
  button just pressed is worse than a line a word short for the length of a scan.

`tests/scanPlacement.test.ts` drives the measurement against a fake layout
(including the flip-every-frame trap); `tests/subheaderRowWrapping.test.ts`
guards that no rule places either copy by platform.

Scan is built **twice**, on every platform: once in the heading's control and
once in `.cs-discover-footer`, the last child of the section body. Both come
from the one `addManualDiscoveryButton`, which keeps one progress state for all
copies, so a scan started from either greys both
(`tests/manualDiscoveryButton.test.ts`).

The footer is **inside the body and the painter never rebuilds it.** Inside,
because the body owns the section's whole trailing gap and folds with it
(`tests/sectionTrailingGap.test.ts` fails on a second spender or on anything
after the body), so the footer needs no gap and no fold rule of its own - which
also means a folded section with Scan at its foot shows no Scan until it is
unfolded. Kept, because a scan is followed by exactly the repaint that rebuilds
the rows, and the button that started it holds focus: a focused node removed
from a body that is half empty makes Chromium flush layout, the pane's scroller
clamps and the page jumps. `renderUserList` therefore removes every child but the
footer, renders (the new rows land after it) and moves the *rows* in front of
it, so the footer never leaves the DOM. Measured in Obsidian 1.14.4 phone
emulation with the footer focused and a repaint adding a row: `scrollTop` stayed
constant on every frame and the same element kept focus. (A real scan still
drops focus, because the button is `disabled` while it runs and Chromium blurs a
disabled control; that is the button, not the repaint.)

Why a phone needs its own button sizes: Obsidian's
`.is-phone .modal .setting-item-control button:not(.clickable-icon)` is
`width: 100%; margin: 0` at (0,4,1), and its exclusion list covers the control's
width but not the buttons'. In a real phone window each button took the control's
whole width - two full-width bars (170px) under a lone title - and a button that
wide fits beside no title, so the measurement would send Scan down even on a
phone turned sideways. A bare-pane harness, including the store-screenshot
renderer, does not show it because it mounts the settings outside `.modal`. The
phone rules restate `width`, `margin` and `padding` for **both** heading buttons
at (0,5,1), and `tests/subheaderRowWrapping.test.ts` compares them to that
selector with `specificityOf`.

English fits the title and the CTA on one phone line from a 370px window up.
Below that (the common 360px Android width) or with a long translation, Add falls
to a line of its own at the trailing edge; that is the existing wrap rather than
a case of its own. The column gap and the buttons' side padding are 12px on a
phone for this reason - the 16px used elsewhere needs 381px.

Verified in Obsidian 1.14.4 (English, dark, empty title count unless noted): the
desktop settings window keeps all three on one line down to a 720px window and
moves Scan from 715px (every width from 730 to 690 checked against an
independent "would it fit" reading, plus a fast drag, with no observer errors);
phone emulation moves it at 320-430px portrait and keeps it at 568-932px
landscape; tablet emulation moves it at 744-834px portrait (iPad mini to iPad
Pro 11") and keeps it at 1024px and wider; `mod-rtl` mirrors both states; and at
the narrowest width where "(3)" fits, adding callouts to "(11)" moves Scan.

The button rule that supplies `min-inline-size: 0` and `overflow-wrap: anywhere`
is scoped to `.cs-subheader-row`, not to the callout-list heading alone. Obsidian's
`button` is `white-space: nowrap` with a fixed `height`, so its min-content width
is the whole label: scoped narrowly, a long translation of **New palette**
("Neue Farbpalette erstellen") ran off the trailing edge of the pane instead of
wrapping inside its own box - before this row could wrap and after.

`manualDiscoveryButton.ts` shares only transient running state per plugin through
a `WeakMap`. Settings redraws and reopenings reuse that state and remove obsolete
DOM listeners through `registerDisposer`; repeated or detached-button clicks do
nothing. The button catches scan failures, restores its label/disabled state, and
never calls `display()` or focuses a control after completion. Existing registry
subscriptions refresh rows and counts while preserving paging and scroll.

### `getSettingDefinitions()` returns `[]` - deliberately, and only for now

```ts
getSettingDefinitions(): SettingDefinitionItem[] { return []; }
```

This is Obsidian 1.13+'s declarative-settings hook, which powers the
in-app settings search index. **Returning an empty array is what keeps
`display()` running on every Obsidian version**: on <1.13 the method doesn't
exist and is never called; on 1.13+, an *empty* result falls back to
`display()` (a **non-empty** result would disable `display()` entirely and
render only from the declared definitions). Defining the method at all -
even empty - is the sanctioned way to satisfy the `obsidianmd/settings-tab/
prefer-setting-definitions` lint rule without actually re-architecting the
tab. Populating real per-setting entries would mean reproducing all 11
sections declaratively, verified on a real 1.13 build - deliberately
deferred (see the [`settings-getsettingdefinitions`](#) memory note if one
exists in this project's history; functionally, this is a `[]` returned on
purpose, not a stub someone forgot).

The tab also sets `icon` to `PLUGIN_ICON_ID` (Lucide `paintbrush`, the mark
that stands for Callout Studio). Obsidian draws a tab's icon beside its rows in
the settings search results, as it does for every core tab; the sidebar list
hides every community plugin's icon, so nothing changes there.

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
the very next paint rather than a beat later. The frame is the **tab's own
window's** (`requestFrameFor(this.containerEl, …)`, `utils/elementFrame.ts`):
in Obsidian 1.14 the settings are a window of their own, and a frame asked of
the main window is held back while it is hidden behind them - the lists then
stayed stale until the settings window closed. The callout editor's two
frames and the global style sliders follow the same rule. The `onPreviewChange`
subscription specifically is what keeps a row's swatch tracking the callout
editor's in-progress colour picks live, without the preview reaching
`saveSettings()` or forcing a document-wide re-render - see
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
| `workspace.on("css-change")` | no | Moves the colour scheme, the theme's name and its measured appearances - all in the signature |
| `registry.onPreviewChange` | **yes** | Registered transiently and *without* a registry mutation, by contract, so it may not be visible from the signature at all |
| `plugin.onIconCacheChange` | **yes** | Artwork lives in a download cache keyed by icon name, so a definition naming a not-yet-downloaded icon is byte-identical to the one naming it a second later - guarding this would leave every spinner spinning for good |

`force` is sticky across the coalescing frame: a frame that coalesced an icon
landing with an unrelated `css-change` still honours the icon.

The signature serialises **whole definitions**, not the fields a row happens to
read today, and the module says why at length: a curated list is how the tenth
field added later goes stale on screen. Both directions of failure are named
there too - a signature that changes when nothing did costs one repaint the
scroll anchor already hides, while one that fails to change leaves a stale row
with nothing to catch it, so it errs toward including more.

### The repaint must not move the page under the reader

The tab renders **into Obsidian's own scroller** - `containerEl` *is*
`.vertical-tab-content` - and the four sections that repaint asynchronously all
sit above the other eleven. So every repaint above happens above the fold for
anyone reading a section below it: rows appear and vanish, the whole theme
section comes and goes with `cs-hidden`, and a theme row grows when the
appearance probe lands it a swatch. Where the transient page comes out shorter
than the offset the reader was at, the browser clamps it and the place is lost
outright rather than merely shifted.

Both async repaint paths therefore run inside
`sections/foldAnchor.ts`'s `keepScrollAnchored` - `SettingsTab.refreshLists`
and `CustomPalettesSection`'s 60 ms `css-change` debounce. It measures the
topmost *direct child* of the container still on screen, runs the mutation, and
hands the difference back to the scroller. Direct children are the right depth
because they outlive the mutation: the repaints empty and refill containers
nested inside the section wrappers, never the wrappers themselves.

It is the same two-reads-and-one-write shape as `keepHeadingInPlace`
([Folding a pinned heading](#folding-a-pinned-heading)), differing in two ways
that matter - the anchor is chosen rather than handed in, and the correction
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
device's `data.json` lands - i.e. on every sync round trip - and
`applyLocaleChange` does the same when a locale finishes downloading. Neither is
a gesture the reader made, and `display()` empties the container, so both used
to drop them at the top of a fifteen-section page mid-scroll **and** fold every
list back to its first 20 rows. Two things answer that:

- **Scroll.** `display()` reads `containerEl.scrollTop` on entry and writes it
  back after the last section renders - last, because assigning past the end of
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
  > mobile override, and `vertical-tab-content-inner` - which `foldAnchor` used
  > to warn "could move the overflow up to the container" - appears **zero**
  > times in `app.js` and only ever as a *descendant* of the scroller in
  > `app.css`, for the phone's rounded-card look. That warning was wrong in both
  > halves and is corrected in place, because it points a reader at the wrong
  > element when they go looking for a scroll bug.
- **Paging.** The cursors moved out of the controller closure and onto
  `SettingsTab` - see
  [Where the state lives, and how long](#where-the-state-lives-and-how-long).

### Section disposers

Each section that registers a resource needing cleanup (an event listener, a
timer) returns a disposer via `ctx.registerDisposer(fn)`; `display()` runs
every previously-registered disposer **before** rebuilding, and `hide()`
runs them on tab close. This is what keeps a section's `MutationObserver` or
subscription from silently accumulating across repeated `display()` calls.

## Folding and paging - the callout lists, and Saved color palettes

[`CalloutListsSection.ts`](../../src/settings/sections/CalloutListsSection.ts)
builds *Callouts from your theme*, *My callout types* and *Built-in
callouts*, in that order, from one pass over one combined list (see
[Theme callout discovery](18-theme-callout-discovery.md) for who lands
where). Two behaviours sit on top of that split, each in its own helper -
and [`CustomPalettesSection.ts`](../../src/settings/sections/CustomPalettesSection.ts)'s
*Saved color palettes* heading is a fourth member of the same family rather than
a parallel implementation: it calls the identical `attachPersistedFold` and
`renderPagedList` helpers, just keyed `"palettes"` instead of a `RowKind`, and
wraps itself in the same `createStickySection` the trio uses so the heading pins
too (see [The three sections pin their headings](#the-three-sections-pin-their-headings) -
palettes is the standalone fourth). Unlike the other sections, it keeps only the
list of saved palettes and no additional orphan groups.

The row's **Use default fallback style** action uses the Lucide `rotate-ccw`
icon, matching the built-in **Reset to default** action. It calls
`CalloutRegistry.convertToFallback()` to follow the current fallback and
subsequent changes to its style. The action asks nothing first, so
`settings/sections/fallbackStyleAction.ts` ends it with a notice carrying
**Undo**, as Delete does. Undo restores a clone of the row taken before the
conversion. Because `registry.update` merges, it clears by name every field the
fallback brought that the old row lacked, such as a gradient or text colors.
It does nothing while saving is paused, and nothing once the row has moved on:
deleted, renamed, edited (`customized`), or made the fallback itself.

### The theme section opens with its switch

**Use your theme's callout styles** (`settings.themeCalloutStyles.enabled`,
see [18 § Switching the theme's callout styling off](18-theme-callout-discovery.md#switching-the-themes-callout-styling-off))
is the first row of *Callouts from your theme*'s body, under the heading and
its description and above the rows. `calloutListsScaffold.ts` builds it once
per `display()`, and `renderThemeList` rebuilds every other child of the body
around it, as the user list does around Scan's footer - the switch is what is
pressed right before that repaint. Being inside the body, it folds with the
section, and the body's trailing gap still falls under whatever comes last.

Turned off, the switch empties its own section: the theme names nothing, so
no row is the theme's. The section therefore stays on screen with no rows
while the switch is off and a community theme is active, and the description,
which describes rows, hides on its own. In Obsidian's default theme the
switch has nothing to take away, and the section stays hidden as before. With
no rows, nothing in the signature moves when the switch is flipped, so the
signature carries `themeCalloutStyles.enabled` itself; and every repaint
re-reads the saved value into the toggle (`ThemeStylesSwitch.sync`), since
another device's settings or a Reset can change it under an open tab.

It used to be the last row of *Global settings*, put there because this
section disappears with its last row. The section's visibility rule is what
moved instead: a theme that styles callouts without naming any id lists no
rows, and there the switch is not on screen.

### List rows and hover

A list row is not clickable; only its buttons are. So, as in every Obsidian
list, the row itself never changes on hover: no fill, and no transition to one.

That holds for every row that wears `.callout-studio-row`:
- callouts and saved palettes;
- commands;
- the right-click menu and icon library lists;
- versions, which add `.cs-recovery-row`.

Pointing anywhere on a row only sharpens that row's own icon buttons, through
one shared rule. It sets `--icon-opacity: var(--icon-opacity-hover)` on the
row's `.clickable-icon`s, row buttons and drag handle, and skips any that are
disabled or `aria-disabled`. Obsidian's own `.clickable-icon svg` already reads
`--icon-opacity`, and the plugin's row buttons and drag-handle svgs read it too.

Every row hover, the button fills and the red delete included, sits behind
`@media (hover: hover)`. On touch, WebKit replays the last tap's hover onto
whatever row lands under it after a re-render, which is how a dragged row on an
iPhone used to light up. `tests/rowHoverStyles.test.ts` holds all of this.

The callout and palette rows' buttons are Obsidian's own icon buttons:
`<button class="clickable-icon">`, which keeps the `<button>` semantics.
Obsidian supplies their size, corners, colour, gated hover, 3px focus ring
and dimmed state.

- **The menu button** is `more-vertical` (⋮), Obsidian's "More options" icon.
- **The drag handle** of the menu and library lists is a `.clickable-icon` too,
  and so are the library action and the image panel's add button.
- **Quick insert's Edit and Insert** are `.clickable-icon`s too. A blocked
  Insert wears Obsidian's dimmed icon state. Its keyboard- or pointer-active row
  is ringed the way Obsidian rings a focused setting row (2px of
  `--background-modifier-border-focus`), and its cursor is Obsidian's
  `--cursor`.
- **Rows that have not moved keep the plugin's 32px square,** narrowed to
  `button:not(.clickable-icon)`. Those are the command rows.

### Corners

The plugin rounds its chrome the way Obsidian does: from tokens, never from px.
A box, card, row, banner or panel takes `--radius-m`, and a small chip or
badge takes `--radius-s`. A plain button takes `--button-radius` with
`--button-corner-shape`, and a field keeps the input tokens. Every rule with a
radius also sets a `corner-shape` (`--corner-shape` unless the component has
its own). That gives superellipse corners on macOS, and the touch radii on
mobile.

A few things are exempt:
- 0 and 50% (circles);
- callout rendering in notes;
- Obsidian's own literal 5px drop slot;
- the two chips that later become Obsidian's own components.

`tests/cornerShapeStyles.test.ts` holds this. Its exception list can only
shrink.

### Callout row menu groups

All three row menus are built by plain functions: `buildBuiltInRowMenu` and
`buildUserRowMenu` in `CalloutRowActions.ts`, and `buildThemeRowMenu` in
`themeRowActions.ts`. Every item carries one of the four sections in
`rowMenuSections.ts`, in this order:

| Section | Items |
| --- | --- |
| `find` | **Find callouts** with its faint count, alone: the one item that leaves Settings |
| `notes` | **Replace in vault…**, **Convert uses to plain text** |
| `callout` | **Duplicate**, **Reset to default**, **Use default fallback style** |
| `danger` | **Delete**, with `setWarning(true)` |

Obsidian's `Menu.sort()` (read from 1.14.4) draws a divider between two
top-level sections and keeps no empty section, so a row that offers nothing in
a group gets no stray line. It orders sections by the first item added to
each, so the builders add items in drawing order. A plain `addSeparator()` and
an item with no section both land in an unsectioned bucket that sorts below
every section, with no divider before it. That is why these menus use no
`addSeparator()` and why `tests/calloutRowMenuGroups.test.ts` fails on an item
without a section.

When a finished scan shows that no note uses the callout, the usage item is
greyed out with `setDisabled(true)`, keeping its "(0)" readable. A partial scan
never counts as unused. **Replace in vault…** and **Convert uses to plain text**
are left out when the count is already known to be zero. When they were added
while the count was still unknown, `disableWhenUnused` (`usageMenuItem.ts`)
attaches them to the usage item's subscription, which greys them out if the
count lands on zero and lights them again if a use appears. Nothing is ever
removed or regrouped once the menu is shown.

### Callout row menu lifetime

Custom, built-in and theme row actions all use
`settings/sections/calloutRowMenu.ts`. `openCalloutRowMenu(ctx, trigger, build)`
takes a `RowMenuTrigger`, which says how the menu was asked for and so where it
opens (findings S2-11, S2-12):

- **`{ kind: "button", button }`** - the row's ⋮ was pressed (mouse, Enter or
  Space). The menu opens as Obsidian opens **More options** in Installed
  plugins: `menu.setParentElement(button).showAtPosition({ x: rect.x, y:
  rect.bottom, width: rect.width, overlap: true, left: true })`. Obsidian then
  marks the button `has-active-menu` (the pressed look of a `.clickable-icon`)
  while the menu is open, and ignores a press on it as a click outside. So a
  second press is a toggle: the opener sees `has-active-menu` and returns, and
  Obsidian's own click handling closes the menu. Without `setParentElement` the
  press closed the menu and the click opened a new one, a visible flicker.
- **`{ kind: "pointer", row, x, y }`** - the row was right-clicked
  (`contextmenu` on `.callout-studio-row`, with `preventDefault`). The menu opens
  at the pointer with `showAtPosition({ x, y })`, as on Obsidian's Community
  plugins rows, and has no parent element.

The opener captures the anchor (the button or the row) and its owner
document/window synchronously, before `prepareUsageMenu(app, anchor, …)` can
await the usage index. One temporary `Component` owns both the pending opening and
the visible menu. A newer row-menu request closes the previous one for that app;
Settings hide/redraw also disposes it.

The document's passive capture listener observes non-bubbling scroll events,
but only changed scroll offsets on the trigger's captured ancestors dismiss
the menu. A scroll event queued before opening, the menu's own scroll area,
submenus and unrelated scrollports do not close it. No wheel/touch gesture is
cancelled, and dismissal never focuses or scrolls the trigger back into view.
This uses actual scroll movement for mouse, touch, trackpad and keyboard alike,
including horizontal/RTL scrolling and momentum. Window resize and
visual-viewport resize/pan also cancel a pending opening or dismiss an open
popup on desktop and tablet. A temporary child-list observer detects a
detached, reparented or moved trigger during incremental list refreshes. The
trigger is rechecked immediately before showing a delayed menu.

On `Platform.isPhone` none of the positional checks exist, for a pending
opening or a shown menu: Obsidian presents a bottom sheet that ignores the tap
position, so nothing positional can make it stale. The scroll, resize and
visual-viewport listeners are not registered, and the trigger is compared by
structure only, never by its rectangle. A real scroll of the list starts with a
touch, and that `pointerdown` already cancels a pending opening
(`prepareUsageMenu`). The phone presentation also hides the keyboard, which
resizes/pans the viewport and moves the trigger. Earlier the checks were only
skipped once the sheet was shown, so a sheet still waiting for its counts could
be cancelled by the keyboard closing under it.

Window blur cancels a pending opening and closes a desktop or tablet popup, but
not a phone sheet once `showAtPosition` has begun. The phone branch of
Obsidian's `Menu.showAtPosition` calls Capacitor's `Keyboard.hide()` (only when
`Platform.isMobileApp`). On iOS that ends editing in the web view, the web view
gives up first responder, and WebKit blurs the window while the sheet is still
sliding in; closing on that made the sheet vanish a moment after it opened on a
real iPhone. Desktop mobile emulation is not `isMobileApp`, never calls
`Keyboard.hide()`, and cannot reproduce it - check on a device. Structural
removal or reparenting of the trigger, orientation changes, pagehide, Settings
disposal and a newer menu request still close the sheet.

Cleanup is idempotent and immediate on explicit dismissal. Obsidian's `Menu`
unloads its old component lifetime while showing, so the unload cleanup is
registered **after** `showAtPosition`. `ui/menuOnHide.ts` also composes cleanup
with the usage item's index unsubscribe: Obsidian's public `onHide` setter
replaces its callback rather than adding one. That callback covers dismissal
before the menu's deferred component load; the unload hook handles normal
closure immediately even when phone hide animations delay `onHide`. Closed
sessions release their references from the Settings disposer and cannot close
a later menu. A stable local menu reference and an active-session check also
allow the host to dismiss synchronously during presentation without dereferencing
the cleared session reference or registering cleanup on a closed menu. No custom
mobile presentation replaces Obsidian's menu.

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

### `sectionDisclosure.ts` - a heading you can fold

`attachSectionDisclosure(setting, bodyEl, initiallyExpanded = true, onToggle?)`
gives a heading a compact rotating chevron and returns
`{ setName, setExpanded, isExpanded }`. `onToggle`, if given,
fires with the new state on a user-driven click or keypress only - not when a
caller drives the returned `setExpanded` - which is what lets a caller
persist just the user's own choice; see
[Where the state lives, and how long](#where-the-state-lives-and-how-long)
for the one caller that does.

Three things about it are decisions, not incidentals:

- **It is not `<details>`/`<summary>`.** These headings are `Setting` rows, and
  *My callout types* carries the **Add new callout** CTA in its control slot -
  a `<summary>` wrapping a button is a button that folds the section every time
  it is pressed. So the state, the keyboard (`Enter`, `Space`) and the aria
  contract are written out here.
- **The control is `setting.nameEl`, not `settingEl`.** The name element
  spans the title line and stops short of `.setting-item-control`, which is
  what keeps that CTA pressable without a target check. It also keeps the
  button's accessible name to `"My callout types 4"` rather than the whole
  row including a paragraph of description. `role="button"`, `tabindex="0"`,
  `aria-expanded` and `aria-controls` all live on it; the chevron is
  `aria-hidden`, because `aria-expanded` already says what it says.
- **`setName` is wrapped.** Each list rewrites its heading on every render to
  update its count - the fragment `headingWithCount` builds (see
  [Faint counts](#faint-counts---how-many-as-obsidians-search-shows-it)) - and Obsidian's
  `setName` *replaces* `nameEl`'s children, which is where the chevron lives.
  Attributes survive that; elements do not. Callers therefore go through
  `fold.setName(...)`, never `setting.setName(...)`.

Folding toggles `is-collapsed` on the heading and on the body. That is
deliberately **not** `cs-hidden`: the theme *section* hides itself with
`cs-hidden` when it has no rows (unless its switch is off - see
[The theme section opens with its switch](#the-theme-section-opens-with-its-switch)),
and one class toggled for two reasons means
whichever ran last decides - a fold would reopen an empty section, or an
empty section would reopen a folded one. The two now sit on different
elements as well (the section wrapper hides, the body folds), which makes the
collision impossible rather than merely avoided.

A user-driven toggle is wrapped in
[`foldAnchor.keepHeadingInPlace`](../../src/settings/sections/foldAnchor.ts) -
see [Folding a pinned heading](#folding-a-pinned-heading).

Note also that *Built-in callouts* does **not** get `cs-subheader-row` to
reach the chevron styling: that class also sets the smaller type, and this
heading is a size larger. It is the only one of the four - *Callouts from your
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
exactly as long as those rows last - it is pushed off by the next section's
heading, and the last one lets go with its own last row instead of hanging
over the eight sections below. No scroll listener and no measurement.

The three used to be flat siblings of each other and of everything under
them, and that is the one arrangement that cannot work: one containing block
between them, so all three would pin at the same offset, stack, and never let
go. Un-wrapping them leaves every CSS rule parsing and applying, and silently
removes the behaviour - which is why the structure is asserted in
`tests/calloutListsSectionDisclosure.test.ts` rather than left to the
stylesheet.

**A fourth section pins the same way: *Saved color palettes*.** It is built to
be a clone of *My callout types* - the same `createStickySection` wrapper, the
same `cs-subheader-row` heading box (tight, borderless, laid out for a CTA
button, and wrapping that button below the title on a narrow pane), the same `cs-sticky-heading` / `cs-section-body` classes - so almost
everything below applies to it unchanged. It is not one of the contiguous
three, though: *Fallback callout* sits between *Built-in callouts* and it, so
two things differ, both carried on its wrapper:

- **`cs-sticky-section-last`**, because nothing sticky follows it either. That
  class is now on two wrappers, and the `cs-sticky-section-last + heading` rule
  now also spaces the *Global settings* heading below it - the same
  `margin-top: 0; padding-top: var(--cs-sticky-heading-pad-top)` treatment
  *Fallback callout* gets under *Built-in callouts*.
- **`cs-palettes-section`**, for the one thing the stylesheet must special-case.
  The section above it is not pinned, so no body hands a `--cs-section-gap`
  down to its divider the way *My callout types*' body does for *Built-in
  callouts*. The wrapper makes up the gap with its own `margin-top:
  calc(var(--cs-section-gap) - 0.75em)` - the only place a sticky wrapper is
  allowed a margin, safe because nothing hands over to it (the space just
  scrolls). It tracks `--cs-section-gap` rather than a number of its own so it
  never drifts out of step with the trio; the `0.75em` subtracted is Obsidian's
  `.setting-item` block padding, which the Fallback dropdown row directly above
  already spends below its own text, so the two land the last-row-to-divider gap
  on the same 40px. It is written on the wrapper, not spent on the body through
  `--cs-section-gap`, because it is *leading* space and has to survive a fold -
  a folded palettes section still has to clear *Fallback callout* above it.
  `sectionTrailingGap.test.ts` holds both halves.

There is also a `margin-block: 0` on the shared `.cs-sticky-heading` rule that
this fourth section is the reason for. Obsidian gives a `.setting-item-heading`
a `0.75em` top margin whenever it follows a `.setting-item` sibling *or* sits in
a `<div>` immediately after one (`.setting-item + div > .setting-item-heading`)
 - which is exactly where the palettes wrapper lands, under the Fallback dropdown
row. On a band meant to sit flush against its divider hairline, that margin
opens an 11px strip of bare pane between the line and the paint. The trio never
trips it (each of their wrappers follows another `<div>`), but zeroing it on the
shared rule covers the fourth and any later reordering; *Callouts from your
theme*'s own 4px top nudge is higher-specificity and unaffected.

This section's list scrolls under the band like any other row.
The `.callout-studio-callout-list` 24px-margin zeroing now reaches the palette
list too (it is inside a `cs-sticky-section` now), trimming 24px between it and
the heading - which is fine, the heading carries its own full divider.

Nine consequences are written into `styles.css` beside the rules, and are
worth knowing before touching any of them:

- **The pane's `padding-top` is zeroed and handed to the title row, at a
  weight that survives a theme.** A sticky `top` is measured from the
  scrollport's *content* box, so Obsidian's `padding-top: var(--size-4-12)`
  would park the band 48px down with rows scrolling visibly through the strip
  above it. Obsidian's own sticky settings header does the same thing one line
  away - `.setting-page.vertical-tab-content { padding-top: 0 }` beside
  `.setting-page-titlebar { position: sticky; top: 0 }`.

  The weight is the part that was missing, and it is not defensive padding.
  `containerEl` **is** `.vertical-tab-content`, so the reset lands on the very
  element a theme styles, at the same `(0,1,0)` a bare `.vertical-tab-content`
  carries - and the theme sheet loads after this plugin's. Measured over the
  257 themes installed in the development vault, **26 declare padding on that
  element and 20 put a non-zero top inset back**, from `(0,1,0)` (ITS Theme's
  `padding: 35px`, NotSwift's `padding-top: 60px`, Kakano, Terminal, Sandstorm,
  Subtlegold, TerraFlow, Cybertron, Ono Sendai, Suddha, Pine Forest Berry)
  through `(0,7,1)` (Maple), one of them - Elegance - with `!important`. Every
  one of them un-sticks all four bands identically, at whatever distance it
  chose. So the reset is written
  `body:not(.is-phone) .callout-studio-settings×3 { padding-top: 0 !important }`:
  `!important` because nothing else outranks Elegance's, the class tripled to
  `(0,4,1)` for headroom over a future important rule, and the phone excluded
  *explicitly* - with an `!important` in play it would otherwise have beaten
  Obsidian's own `(0,5,0)` phone rule, whose padding is reserving the top of the
  screen for the floating back and close buttons. `padding-block-start`
  (flexcyon's spelling) cascades in the same slot and needs no separate
  declaration; a `border-top` on the pane (TerraFlow's 1px glass frame) insets
  the content box the same way and is deliberately left alone. Section **165**
  of `modalBodyLayers.test.ts` resolves that cascade against the theme rules
  verbatim.
- **The band paints `background-color: inherit`, not the `--cs-surface`
  pair.** That pair is defined inside `.cs-modal` and nowhere else, so on the
  settings tab it falls through to `--background-primary` - and that is what
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
  Obsidian's own `app.css`, this stylesheet and one theme at a time - the 257
  installed in the development vault, in both colour schemes - the band
  computes **transparent under a good many of them**. Most of those leave the
  pane itself see-through (Sodalite paints `.vertical-tab-content` `transparent` and puts the surface
  on the container behind it; TerraFlow's dark pane is glass; Velocity's whole
  window is, `--modal-background` included, at `oklch(… / 0.625)`), so the
  chain has nothing opaque to carry down. Three others beat the band's own
  declaration: Elegance and Lagom write `background-color: transparent
  !important` on `.setting-item-heading` - at `(0,2,0)` and, nested under
  `.mod-settings`, at the band rule's own `(0,3,0)` - and Micro Mike wins a
  `(0,3,0)` tie through `.modal.mod-settings :is(h1, …,
  .setting-item-heading)`. Either way rows scroll visibly through a heading
  that is pinned exactly right.

  The fix is a floor rather than a fight, because `!important` is not
  available: Lagom's is already at the band rule's specificity, so winning
  means out-specifying the *next* theme rather than that one. So
  `.cs-sticky-heading::before` lays an opaque base - `--background-primary`
  with `var(--settings-background, var(--modal-background))` over it, the
  theme's own surface tokens and never a colour named here; the top layer is
  the token core paints this pane *with*, so measured on desktop, tablet and
  phone in both schemes it comes out the pane's own colour every time - and
  `.cs-sticky-heading::after` repaints the band's whole
  background over that with `background: inherit`, image included, so a theme's
  heading gradient still paints. Both sit at `z-index: -1` inside the band's
  own stacking context, so they are above its background and below its title,
  and both are scoped `body:not(.is-phone)`, where the band is `position:
  static` and so not a containing block. Where the band's paint is opaque - the
  great majority of themes, and every platform with no theme installed - the
  `::after` covers the floor completely and nothing changes: with no theme the
  rendered pane is pixel-identical before and after.

  It reaches all but a few. The ones left over are the themes that name no
  opaque surface anywhere - see the rules' own comment in `styles.css` for the
  roll call and the reason each one is out of reach. That is deliberately where it stops: the only floor
  that could not itself be see-through is a colour named here, and on a theme
  whose every surface is transparent on purpose it would be the one opaque
  thing in the window. Section **166** of `modalBodyLayers.test.ts` pins the
  arrangement and the cascade behind it.
- **The gap under a section lives on that section's own body, and nothing
  else contributes to it.** Space outside a wrapper's content box is space
  with no heading pinned to it, so a 36px margin between wrappers would be
  36px where one heading has let go and the next has not yet caught - the band
  blinks out and back instead of handing over. So `--cs-section-gap` (40px) is
  spent on `.cs-section-body` and only there, the divider between two sections
  is a hairline `border-top` on the wrapper and nothing more, and folded
  sections carry no gap at all - the body is `display: none`, so the gap goes
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
    (Fallback callout), which cannot see a fold - collapsed, "Built-in
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
 - the palette list inside its section - which is
    harmless: that sub-heading carries its own full divider.
  - Both of those rules reach through a **child combinator**, so a wrapper
    element between a section body and its list would silently stop them
    matching. `sectionTrailingGap.test.ts` guards the arithmetic against
    `styles.css` and that structure against the rendered DOM.

  Measured in headless Chrome against Obsidian's real `app.css`, every section
  in every state now ends 40px above its divider - full list, `Load more`
  button, or empty state - and every folded one sits on its divider with only
  the band's own 24px of bottom padding between them.
- **Not on a phone.** `.is-phone` sets `position: static`, and Obsidian makes
  the same call for its own header (`.is-phone .setting-page-titlebar {
  display: none }`). There the pane sits at the top of the modal and reserves
  the band over it - for the floating back and close buttons at
  `--layer-modal` - with `padding-top` rather than by starting lower. Padding
  does not clip, so a band pinned below that strip has rows scrolling through
  it *above* the heading; pinning flush instead only trades that for a title
  under the ✕.
- **The band is square, not rounded.** Obsidian's own `.setting-item-heading`
  carries a corner radius; the plain headings reset it to `0` through the
  `:not(.cs-sticky-heading)` divider rule, which these three are excluded
  from, so they need their own `border-radius: 0` or they are the one rounded
  bar in a pane of square ones - and a round top corner on a box pinned flush
  against the pane's own edge reads as a gap the content behind it peeks
  through.
- **"Callouts from your theme"'s description is a sibling of the heading, not
  part of it.** `renderThemeList` used to write the active theme's name onto
  the heading's own `Setting.setDesc`, which pinned the sentence along with
  the title for as long as the section was on screen. It is now a plain
  `<p class="cs-theme-desc">` next to the heading in the wrapper - written
  from the same place, still folded away with the rest of the section (via a
  `.cs-collapsible-heading.is-collapsed + .cs-theme-desc` sibling rule, since
  it is no longer a descendant of the heading that folds) - so it scrolls out
  from behind the band like any other row instead of staying glued beside the
  title.
- **A row's colour circles need their own stacking context, or they float
  above the band.** `.cs-color-circle-l/-r/-r2` stack front-to-back with
  `z-index: 2/1/0` so the three overlap correctly, but nothing between that
  widget and the pane establishes a stacking context of its own - so those
  values aren't scoped to the widget, they're compared directly against
  whatever else shares the nearest real one, which for a row inside these
  three sections is the pinned heading's `z-index: 1`. Left alone, the front
  circle (`z-index: 2`) outranks the header it's supposed to scroll under, and
  every row's circles paint on top of the band as they pass beneath it.
  `.cs-color-circles` carries `isolation: isolate` to contain its own 0/1/2
  stack - chosen over `position: relative; z-index: 0` because it changes
  nothing about layout or the scrollport, which matters next to a wrapper
  that is deliberately forbidden from setting anything that would (see the
  "nothing between the band and the scroller" test in
  `modalBodyLayers.test.ts`). The same shared class renders in the *Saved
  color palettes* section - where the heading pins too, so the fix carries its
  weight there as well - and inside the callout editor's palette trigger,
  where nothing is pinned and it is a no-op.
- **Folded, the heading's bottom padding is bumped to match its top.** Open,
  the band's top padding is deliberately larger than its bottom - nothing but
  a hairline sits above the title, while the first row below carries its own
  visual weight. Folded, `.cs-section-body` is `display: none`, so that row is
  gone: the next thing down is another folded heading's divider (or, for the
  last section, an unrelated one) - the same "hairline with nothing else
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
hands the difference back to the scroller - two reads and one write, on a
click, with nothing on the scroll path.

It is applied unconditionally on the shared toggle because it is a no-op
wherever the heading is not actually stuck: only a *stuck* box reports a
different top before and after a change made below it, so a heading folded
from its resting place - one below the fold, or any heading on a phone, where
`position: static` - measures zero and the scroller is never touched. All four
sticky headings share the helper, so all four are corrected when folded while
pinned. The measurement is guarded rather than assumed - the test DOM has no
layout and therefore no `getBoundingClientRect`, and that absence is what
makes the anchor inert there instead of throwing on every fold.

`foldAnchor.ts` has a second export built on the same three lines,
`keepScrollAnchored`, which anchors the *asynchronous repaints* rather than the
click - see
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
and the first glyph of the title - and the count after it - lands back on the
x it had before there was anything to fold.

Two properties, `--cs-disclosure-size` and `--cs-disclosure-gap`, are the
single source for that: declared once on `.cs-collapsible-heading`, read back
by the chevron, which is sized to them, and by the heading, which offsets itself
by their sum. Because a custom property is substituted where it is *used*, the
`1em` size resolves against each heading's own font-size - 15.75px under
`cs-subheader-row`, 15px for *Built-in callouts* - so one rule serves all
three sections and no section carries an offset of its own. The chevron's box
is pinned to the token (`inline-size`/`block-size`) rather than left to the
SVG, because that is what keeps the offset and the thing it offsets in step
whatever `--icon-size` Obsidian or a theme hands the icon.

The chevron hangs into the row's own `--size-4-4` padding, not into content,
and nothing between there and the settings pane clips it: `.setting-item-name`
has `overflow: hidden` in Obsidian's own CSS, but the box is *moved* rather
than overflowed, so the chevron sits inside it; `.setting-item-info` has no
overflow of its own. `margin-inline-start` also means RTL needs nothing extra
 - the title's inline-start edge is preserved there the same way.

Which way the chevron points is RTL's one catch. Obsidian marks a
right-to-left interface with `.mod-rtl` on the body - never `dir="rtl"` - and
already mirrors every `svg.svg-icon` under it, so a folded chevron points along
the title with no help. An open one must then turn *against* that mirror, or a
fixed +90° turns the mirrored `<` into `^`. The open rule therefore turns by
`calc(var(--direction, 1) * 90deg)`: core's `--direction` is 1, or -1 under
`.mod-rtl`, and core's own fold indicators turn by it too. The folded rule
must not read it, because core resets `--direction` to 1 on every
`.is-collapsed:dir(ltr)` - which, with no `dir` attribute in the interface, is
every folded heading. The icon picker's group chevron follows the same two
rules.

Its stroke is set, not inherited. Every fold chevron in the plugin's own UI
sits beside a semibold heading - the settings lists, the sections of
**Version details**, and the icon picker's source groups - and
Obsidian's default icon stroke (1.75 of the icon's 24 units) is a
regular-weight line that reads as a hairline there. One rule,
`.cs-disclosure-chevron svg, .icon-picker-group-chevron svg`, draws both at
`stroke-width: 2.5px`; with the icon at `1em` that is about `0.1em` at any
heading size, a semibold stem. A callout's own fold arrow (heading callout,
block callout, and their previews) is deliberately left out - it follows
Obsidian's look for callouts.

### Faint counts - how many, as Obsidian's Search shows it

Every heading or line that counts what it holds ends the same way, the way
Obsidian's Search pane ends a file's line with its match count
(`.tree-item-flair`): a small number in faint text at the end of the row, with
no brackets. Niv asked on 2026-10-22 for this everywhere in the plugin (item 57
of the native-look plan); until 2026-10-23 these were a muted "(N)" just after
the title. The places:

- the four settings lists (*Callouts from your theme*, *My callout types*,
  *Built-in callouts*, *Saved color palettes*);
- the section titles of the setup comparison in **Version details**;
- the file headings of the **Find callouts** and **Review conversion** sidebars;
- the library headings in Pick an icon's **All sources** grid ("Lucide", with
  its matches after it);
- **Find callouts** in a callout row's menu.

[`ui/faintCount.ts`](../../src/ui/faintCount.ts) builds all of them, and
`.cs-faint-count` in `styles.css` is the one rule that places and colours them:

- `appendFaintCount(parent, count)` appends `<span class="cs-faint-count"> N</span>`,
  the number formatted with `toLocaleString(getLocale())`. The space before
  the number is part of the text, so the heading reads - and is announced as -
  "My callout types 4".
- `headingWithCount(title, count)` returns a fragment for a `Setting`
  heading's `setName`: the title and its count as **siblings**, so in a
  foldable heading's `nameEl` (a row: chevron, title, count) the count goes to
  the row's end.
- The rule is Obsidian's `.tree-item-flair-outer` + `.tree-item-flair`:
  `margin-inline-start: auto` (to the end of a heading that is a flex row; in
  running text it simply follows the words), `padding-inline-start:
  var(--size-4-1)`, `--text-faint`, `--font-ui-smaller`, `line-height: 1`,
  `tabular-nums`, `flex-shrink: 0`, and `white-space: pre` (keeps the leading
  space in a flex row, and the number on one line).
- A settings heading keeps its count beside its title
  (`.setting-item-heading .cs-faint-count { margin-inline-start: 0 }`): some
  share their row with buttons (Scan, Add), and pushed to the end the count
  would land against them. Searchable Settings turns these headings into page
  rows, with the count as the row's value at its end.
- In a menu row the count floats to the end of Obsidian's `.menu-item-title`
  (`float: inline-end`), which is a block, not a row. The row menu's title is a
  fragment (`usageTitle` in `usage/usageMenuItem.ts`): "Find callouts" and the
  count; a count that arrives after the menu opened fades in
  (`cs-usage-menu-count`). The old `usage.menuCount` key is no longer used.
- Pick an icon's grid takes `groupLabelFor` → `{ name, count }`
  (`GridGroupHeading` in `IconGrid.ts`) and draws the count with the same
  helper; the old `iconPicker.sourceGroup` key ("{{name}} ({{count}})") is no
  longer used.
- The setup comparison's title row keeps the count as its own flex item beside
  `.cs-recovery-section-title`, so a title cut short with an ellipsis still
  shows its count. That row has no flex `gap` - its chevron carries
  `margin-inline-end: var(--cs-disclosure-gap)` instead.

Not every count is drawn this way. **Load more (14)**, **Import valid only
(3)** and the icon total in an icon source's description are part of a
button's or a line's own words, and stay plain text in that label's colour.
`tests/faintCount.test.ts` pins the helpers and the rule; each surface's own
suite checks that it goes through them.

### `listPaging.ts` - the first 20 rows, then a button

`renderPagedList(host, items, state, renderItem, onLoadMore)` renders at most
`LIST_PAGE_SIZE` (20) rows and, when anything is left over, appends
`.callout-studio-load-more` **as the last child of the list element** - the
list is already a column flex box, so whatever trailing space it sits in (its
own margin mid-section, the section's `--cs-section-gap` when it ends one)
falls under the button exactly as it would under a last row. A sibling would
need spacing of its own, and one more number to keep in step.

One press reveals everything rather than another page: these sections are
tens of rows, not thousands, and a second press would only be a second chance
to lose your place. (`iconpicker/IconGrid.ts` pages repeatedly, per segment,
because its grids run to thousands - a different problem, deliberately not
shared code.)

The button's label is `t("iconPicker.loadMore")` with the hidden count
appended in code - `Load more (14)` - a numeric suffix on whatever `t()`
returns, so it needs no key of its own in any of the 31 translated locales.
Unlike a heading's faint count it stays plain text in the button's colour,
because it is part of the label (see
[Faint counts](#faint-counts---how-many-as-obsidians-search-shows-it)). `focusFirstRevealed`
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
so it works for any paged section - Saved color palettes included - not just
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
the controller - and a controller lives exactly one `display()`, which re-runs
for things nobody asked for (above). Pressing **Load more** and then having
another device's settings file land was enough to lose it.

They are held by `SettingsTab` now (`freshPaging()`, in
`sections/calloutListsSignature.ts`) and handed to the controller through
`CreateCalloutListsControllerOptions.paging`, so a rebuild inherits them.
`hide()` calls `freshPaging()` again, which is what keeps the cursor
session-only in the sense that was always meant: a genuine reopen still starts
every section back behind its `Load more` button. Nobody has asked to keep a
whole vault's saved palettes on screen by default, and paging past the cap is a
cheap habit to reform - but losing your place to a repaint you did not cause is
not that. (Saved color palettes keeps its own single cursor in
`CustomPalettesSection.ts`, which is rebuilt by the same `display()`; its
`Load more` is one press on a much shorter list.)

The **fold** is not session-only. `settings/sections/calloutListsFold.ts`
mirrors each section's `SectionDisclosure` into
`DeviceLocalStore.listsExpanded` (`{ theme, user, builtin, palettes }` - the
first three keyed the same way as `RowKind`, `palettes` added for Saved color
palettes) the moment the user folds or unfolds it by hand -
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

The heading count is always the full list a section has - the partitioned
length for a callout list, `settings.customPalettes.length` for Saved color
palettes - never the visible slice. Folding a section, or leaving 20 of 34
rows on screen, changes what is drawn - not how many the user has.

## Modal chrome - the one shell every window wears

[`src/settings/modalChrome.ts`](../../src/settings/modalChrome.ts) dresses
every Callout Studio window in **Obsidian's own shell for long dialogs**, the
one Obsidian uses for Publish, the attachment cleanup and Keychain. Before the
module existed, different windows had reinvented a sticky title, a pinned
button bar, or neither.

```ts
applyModalChrome(modal, { footer?: boolean }): HTMLElement | null
addCancelButton(bar, label, onClick): HTMLButtonElement
removeModalChrome(modal): void
```

```text
┌───────────────────────────────┐
│ title                       ✕ │  header - fixed, no line under it
│ content …                     │  body - the ONLY scroll container
├───────────────────────────────┤
│              [Cancel] [Save]  │  button bar - fixed, a line over it; optional
└───────────────────────────────┘
```

Two of Obsidian's classes do all of it, so the look comes from Obsidian's
stylesheet (and a theme's):

- **`mod-scrollable-content`** on `.modal` takes the window's padding off,
  gives the title `16px 16px 0`, makes `.modal-content` the one scroller with
  `0 16px 16px`, and pins the bar under a line.
- **`modal-button-container`** is the button bar, built as a child of `.modal`
  after `.modal-content`, as `ConfirmationModal` builds it. On a computer it
  lines the buttons up at the end. On a phone or tablet (`.is-mobile`) it
  stacks them full-width in reverse: the main action on top, then Cancel
  (`mod-cancel`, `order: -1`), then a `mod-secondary` item (`order: -2`). On a
  phone it also clears the home indicator.

**Every Cancel is made by `addCancelButton`**, which adds `mod-cancel` (what
Obsidian's own `setCancel()` does). A hand-made Cancel would miss it and stack
above the main action on a phone; `tests/modalChrome.test.ts` fails if a
source file builds one itself. Pick an icon's preview ("Lucide: book-open")
shares the bar as its `mod-secondary` item: at the start on a computer, under
the buttons on a phone.

**The width is Obsidian's dialog width** (`--dialog-width`, 560px, capped by
`--dialog-max-width`) for every window except the callout and palette editors,
whose two columns need 720px (`.callout-studio-editor-modal`, off phones
only), and three that
keep their own for now: the welcome splash, and Commands and shortcuts and the
style windows, which become settings pages later. The import chooser, the
export chooser, the plugin import window, the import report, the icon credits
and the conversion help used to set 520-700px each (finding S9-V3, GAP-06); their
classes stay as hooks a user's snippet may target.

**On a phone, the two editors are Obsidian's large-form sheet.** They carry
`mod-lg`, Obsidian's mark for a large form: on a phone its stylesheet makes
the window full width and full height, rounded only at the top, as its own
large forms (Keychain, Publish) are, and keeps the side safe areas. On a
computer or a tablet the class changes nothing (finding S5-09,
`tests/editorPhoneSheet.test.ts`).

**The buttons are Obsidian's**, with no size, padding, outline or dim of the
plugin's own: Obsidian's `button` height and padding, its grey 3px focus ring,
and for a blocked button (`aria-disabled`, see
[Blocked main buttons say why](#blocked-main-buttons-say-why)) its 70% dim.

**What the plugin adds** is only what Obsidian leaves to each dialog
(`styles.css`, "Modal chrome"):

- the surface tokens `--cs-surface` / `--cs-surface-raised` on `.modal.cs-modal`
  (see [Two theme-aware surface tokens](#two-theme-aware-surface-tokens));
- `--cs-modal-inset` (16px, Obsidian's), read by the few bands inside a body
  that reach the window's sides (Pick an icon's source row and grid), and
  narrowed by the setup-details window on a phone;
- **room for the first row's focus ring.** Obsidian's long dialog starts its
  body with no top padding, and a focused field's ring is drawn outside the
  field (2px; 3px for a dropdown), so a scroller would clip it. 4px of the
  title's 12px margin moves inside the body
  (`margin-bottom: calc(0.75em - var(--size-2-2))` on `.modal-header`,
  `padding-top: var(--size-2-2)` on `.modal-content`): the gap stays Obsidian's
  12px and the ring has room. Windows with a sticky band at the top of the
  body (Quick insert, the setup details) set it back to 0 and put it on their
  first child instead, with a selector that repeats the shell's classes to
  outrank it. Pick an icon turns the body's padding and scrolling off
  altogether, since its own grid scrolls under a fixed source row.

**History.** Until 2026-10-23 the plugin drew its own shell: a title band with a
line under it, a wider inset (34-40px) in the editors through a `wide` option,
its own `cs-modal-footer` row whose buttons it resized, outlined in purple and
dimmed to 40% when blocked. Decision 15 of the native-look plan (findings
S5-16, S5-06, S5-03, S6-01, S6-V4) replaced all of it with Obsidian's. The
callout editor's preview panel now gives its preview column `1fr`, so the
adjustment column ends flush with the 16px inset under the control column.
The editor's four form rows are one Obsidian `SettingGroup` box above it, and
the preview's title and the adjustments beside it are Obsidian group headings
and groups too (see
[Callout editor](14-callout-editor.md#the-form-box-and-the-groups-beside-the-preview)).

> [!IMPORTANT]
> **Every window wearing this chrome must set a title, with no opt-out.**
> The two windows that used to skip it (a generic confirmation dialog and the
> replace-callout picker) read as unlabelled boxes. This is enforced
> structurally, not just by convention: `ConfirmModal`'s constructor takes
> `title` as a **required** parameter specifically because it's a generic,
> reusable dialog - only the caller knows what's being confirmed, and a
> compiler-enforced parameter is what keeps a future caller from shipping a
> headerless one. `ReplaceCalloutModal` defaults its title to **Replace in
> vault** for the same reason.
>
> **`WelcomeModal` is the one deliberate exception** - it's a splash screen,
> opts out of the chrome entirely (`this.titleEl.remove()`), and carries its
> own name as a hero heading in a dedicated left column instead of a
> generic title bar.

`applyModalChrome` is safe to call again on a reopened modal - Obsidian
reuses `modalEl` across open/close cycles, so a stale button bar from a
previous open is detached rather than duplicated. It also installs the
window's keyboard scope, so an open dropdown gets the first Escape
(`ui/menuEscape.ts`), and stamps `cs-modal-stacked` on the container when
another modal is already open underneath it (used by `styles.css` to paint the
correct backdrop dimming for stacked modals on mobile, where Obsidian's own
backdrop layering can't be relied on) - the open count check is reliable
specifically because `Modal.open()` appends `containerEl` to the document
**before** calling `onOpen()`, so this modal is already counted by the time the
check runs.

### Rows and slider values inside a window

- **Rows sit at the top, as Obsidian's do.** Core 1.14 lays a `.setting-item`
  out with `align-items: flex-start`; only headings, navigable rows, action
  rows and list rows are centred. The windows used to pin every row to
  `center` "against themes that top-align", which by 1.14 meant against core
  itself: adding an ID in the callout editor pushed the **Callout IDs** label
  down to stay centred against the growing chips. Nothing pins it now. The IDs
  row's reset arrow keeps its own `align-self: flex-start`, because it sits
  inside `.setting-item-control`, which core still centres. (The settings tab
  keeps its centring pin until it is rebuilt from Obsidian's own groups.)
- **A slider's value is Obsidian's readout.** `span.slider-value` takes core's
  face, size and weight. The plugin adds only a `min-width: 7ch` reserve
  (`flex: 0 0 auto`, `text-align: end`) and restates `tabular-nums`, so a value
  that gains or loses a digit does not resize the track and jump the thumb.
  The reserve used to be exact because the value was monospace; now the digits
  are 1ch each and only `-`, `.`, `e`, `m` and `×` are proportional. Measured
  in the macOS UI font at 13px, every value spans 6.5ch or less and "0.75em",
  the longest, 6.5ch to within a fifth of a pixel - hence 7ch, so a wider UI
  face still fits. After a UI font or theme change, drag "0.75em", "×1.25" and
  "-4px" and watch the track.

### Links look like Obsidian's

A hint's link (`renderInlineLinkHint`: "clicking here", **Revert**,
**Restore**, "move it here", "use it instead") is a `<button>`, but it is
painted as Obsidian paints an `a`: `--link-color`, underlined with
`--link-decoration`, `--link-color-hover` under a pointer. Obsidian's
`.setting-item-description` redefines those tokens to muted and normal, so in a
description the link is the grey underlined one Obsidian's own descriptions
use; elsewhere it is the accent. Inside a red `.cs-tag-error` line the tokens
are set back to the accent, so the link stays findable in the sentence. The
reset that strips Obsidian's button face also strips its focus ring, so the
link gets back the 2px `--background-modifier-border-focus` ring Obsidian draws
on a link in a setting row.

The credits window and Pick an icon's credit line use plain `<a>`s with no
colour or underline of their own, only that same keyboard ring. (The settings
footer's contact links keep their own no-underline look until the footer
becomes the About group.)

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
> question - whether the name field is *editable*, not whether the window is
> *creating* anything. Every edit of a custom callout therefore grabbed the name
> field too. `tests/modalAutofocus.test.ts` pins the guard against the title key
> so the two cannot drift apart again.

For `PaletteEditorModal` the gate is `existing`, **not** the seeded state: the
`seed` option pre-fills every colour but stays a *new* palette (it rebuilds one
deleted out from under a callout, so the user "only has to type a name") - which
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
> well - it read as a delayed, clunky lurch rather than as no jump at all - and
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

The chosen row in `ReplaceCalloutModal`'s list wears Obsidian's selected-item
tint (`--nav-item-background-selected`, a tree row's `.is-selected`) and, at its
end, the check Obsidian's menus put beside the current value. Every row draws
the check and `.is-selected` shows it. A hover is plain grey, mouse only, so the
choice still reads under the pointer.

The search field's keyboard handling is also why `ReplaceCalloutModal`'s **Enter only chooses**
(the top row, when nothing is chosen yet) and never confirms. Confirming rewrites
every note that uses the callout, and its Undo is brief and in memory only, so it takes the confirm button,
which is Obsidian's red destructive confirmation (`mod-destructive mod-cta`, see
[Red and purple buttons are Obsidian's](#red-and-purple-buttons-are-obsidians)) on
every device. `tests/replaceCalloutModal.test.ts` pins both.

## Two theme-aware surface tokens

Defined **only** on `.modal.cs-modal` (never redefined per-modal or per
device). Every call site names its half's fallback, so outside a window - the
settings tab - each half falls through to the colour Obsidian itself uses
there:

```css
.modal.cs-modal { --cs-surface: var(--modal-background); --cs-surface-raised: var(--setting-items-background); }
```

- **`--cs-surface`** (fallback `--background-primary`) - anything meant to
  read as flush with the modal window itself: fixed bands, panels, the ring
  cut around an icon tile's ✕. Not dropdown lists: those stand on Obsidian's
  menu ground (see
  [Dropdown popups look like Obsidian's menus](#dropdown-popups-look-like-obsidians-menus)).
- **`--cs-surface-raised`** (fallback `--setting-items-background`) - anything
  meant to read as *raised off* that surface: a group-box header strip, a
  card, a control, a row pill. It is Obsidian's own settings-box colour, so a
  plugin box and an Obsidian `SettingGroup` box in the same window, or on the
  settings tab, are one grey.

Obsidian steps that box colour off the window on every device by itself:

| Where | Window / pane | Box (`--setting-items-background`) |
|---|---|---|
| Desktop | `--background-primary` | `--background-primary-alt` |
| Mobile, light | `--background-primary` (a window), `--background-secondary` (the settings pane) | `--background-primary` |
| Mobile, dark | `--background-secondary` | `--color-secondary-2` (4% white over `--background-secondary`) |

So on a phone or tablet in light mode a box inside a window is white on white,
exactly like Obsidian's own grouped rows in a window: the lines and headings
carry the shape. A borderless plugin pill (`.callout-studio-row`,
`.cs-option-box`) reads faint there until it is drawn as a box with lines.

> [!IMPORTANT]
> **The two tokens are a pair and must always move together.** Setting one
> alone is precisely how the group boxes broke once: the body moved onto
> `--cs-surface` while the header strip stayed pinned to
> `--background-secondary`, and `.is-mobile.theme-dark` (phone and tablet)
> repoints `--modal-background` **onto** `--background-secondary` itself, so
> the strip landed on the exact surface it was meant to sit *above* and
> disappeared. The plugin used to answer that with its own `color-mix()` step
> off `--cs-surface` on mobile dark. Obsidian's box colour already makes that
> step (`--color-secondary-2`), so the override is gone; a raw
> `--background-secondary` inside a window is still a bug
> (`tests/modalSurfaces.test.ts`).

**Vault sidebars are not settings.** Find callouts and Review conversion live
in workspace panes, not windows, so they never use the raised half: a result
card is `--search-result-background`, Obsidian's colour for a Search pane's
file box, and the sticky file heading and the refresh overlay name the pane's
own `--background-secondary` (listed, with that reason, in
`KNOWN_RAW_SECONDARY` in `tests/modalSurfaces.test.ts`).

**Deliberately not covered**: `.cs-live-preview-body` and `.cs-gap-demo`,
which are meant to emulate an actual **note** surface inside the modal (the
callout editor's live preview, the spacing-demo widget) - those genuinely
want `--background-primary` regardless of what the surrounding modal chrome
is doing.

> [!TIP]
> Any sticky element must sit at `top: 0`, never a positive offset - a
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
> means the top of the pane - and where that scroller is Obsidian's rather
> than this plugin's, the rule doing the moving has to outrank the active
> theme, which is a second question and the one that actually regressed. And
> `background-color: inherit` is the third sanctioned paint beside the two
> surface tokens - it is the only one available to a band sitting *on* a pane
> whose colour the plugin does not choose. See [The three sections pin their headings](#the-three-sections-pin-their-headings).
>
> Quick Insert applies the same padding rule inside the modal chrome: its
> `.modal-content` top padding is zero, the introductory paragraph owns the
> resting inset that scrolls away, and the toolbar owns a painted top inset that
> gives the search field breathing room while stuck and contains its focus ring.
> Putting the inset back on the scroller reopens a transparent strip above the
> sticky toolbar, allowing list rows to show through it.

## How an input field focuses

**Text fields are Obsidian's own.** A field marked `cs-text-control` - the
callout editor's **Display name** and **Callout IDs**, the palette editor's
**Name**, the Quick Insert and replacement-dialog searches, the search box in
every icon source, and the paste box on the plugin import window - gets no
face, edge, size or focus ring from the plugin. Obsidian's own
`input[type='text']` and `textarea` rules draw them, so they look and answer
exactly like the fields in Obsidian's own Settings, and a theme that restyles
those restyles these (decision 14 of the native-look plan). The class stays as
the opt-in hook for per-screen layout: widths, the IDs field's **+** cap, and
the paste box's fixed height. It must never style Obsidian's editor or the
transparent input inside a combobox.

| State | A text field (Obsidian's rules) |
| --- | --- |
| Rest | `--background-modifier-form-field` (white in light on every desktop, `#2e2e2e` in dark); 1px `--background-modifier-border`; `--input-height` (30px) |
| Pointer hover (mouse only) | `--background-modifier-form-field-hover`, edge `--background-modifier-border-hover` |
| Focus, also after a click | edge `--background-modifier-border-focus` plus a 2px ring in the same colour |
| Disabled | Obsidian's field at half opacity |
| Phone and tablet | a borderless pill in `--interactive-normal` (`#f6f6f6` in light) |

The focus ring on a click is deliberate. An earlier version of the plugin drew
one thin edge for every engaged state so that a click changed nothing; Niv
chose Obsidian's behaviour instead (decision 14, 2026-10-22).

**Dropdowns are drawn like Obsidian's combobox button.** Every trigger that
opens a list (`.cs-dropdown-control`: the searchable pickers, the plain choices
built on them, and the editor's Fold selector) keeps the plugin's own element,
because it opens the plugin's list, but reads Obsidian's dropdown tokens and
goes through Obsidian's states:

| State | A dropdown control |
| --- | --- |
| Rest | `--dropdown-background` (= `--interactive-normal`: white on Windows/Linux light, `#e4e4e4` on macOS light, `#333` in dark); no border; `--input-shadow`; `--input-height` |
| Pointer hover (mouse only), and a press (`.mobile-tap`) | `--dropdown-background-hover` and `--input-shadow-hover` (on macOS both equal the resting ones, so nothing moves, as with Obsidian's own) |
| Focus, also after a click | the 3px `--background-modifier-border-focus` ring |
| Open | `--metadata-label-background-active` plus the ring, like Obsidian's open combobox (`.combobox-button.has-focus`) |
| Disabled | half opacity |

The states form a small ladder in `styles.css`: rest (0,3,0), then hover and
press (0,5,0), then focus and open (0,5,0) written after them, so hovering a
focused or open control never hides its ring. Padding is Obsidian's combobox
padding (8px before the text, 6px after the caret; 16px each side on mobile),
kept in three variables (`--cs-dropdown-pad-start`, `--cs-dropdown-pad-end`,
`--cs-dropdown-gap`) that the hidden width-sizer of a plain choice reads too,
so a plain choice is always exactly as wide as its longest translated option
plus the control's own room.

A plain choice (`.cs-select-dropdown`) is Obsidian's `select.dropdown` rather
than a combobox, so in Obsidian's macOS settings window it follows the two
tokens Obsidian sets there: `--dropdown-text-align` puts its text at the end,
and `--dropdown-icon-background` sits its chevrons on a small dot. Everywhere
else those are `start` and `transparent`.

Searchable callout and color pickers are comboboxes: their outer
`cs-dropdown-control` paints the box, and their inner `cs-combobox-input` stays
transparent in every state (otherwise Obsidian's input rules would draw a
second box inside it). `ListboxPopup.setDisabled()` mirrors the input's
disabled state onto its painted control as `cs-dropdown-disabled` (and keeps
`is-disabled` on the root), so the hover and focus selectors read that state
without a parent `:has()` query. Callers must use `setDisabled()` rather than
disabling the inner input directly. Select-only combobox inputs remain
readonly. File inputs and native color swatches are separate controls and do
not receive field styling.

There are three cascade constraints:

- **Validation wins.** An invalid value (`cs-input-invalid`, the palette name
  and the IDs field) keeps its red edge and 1px red ring, hovered or focused:
  `input.cs-input-invalid` with four classes is `(0,5,1)`, above Obsidian's
  `input[type='text']:focus` `(0,2,1)`.
- **A dropdown's ring wins over its hover.** Focus and open are at least as
  specific as hover and come after it. `.is-open` draws the ring itself because
  a tap on a phone does not focus a `<button>` trigger (the Fold selector), and
  Obsidian's press class, `.mobile-tap`, stands in for hover on a phone.
- **The Callout IDs field and its + cap stay one colour.** `cs-tag-add-slot`
  lies over the field's trailing edge and paints `--cs-tag-field-bg`, which the
  row declares as Obsidian's `--background-modifier-form-field` and moves to
  `--background-modifier-form-field-hover` while the pointer is on the row, as
  Obsidian does to the field itself. The row also repeats Obsidian's hover edge
  while the pointer is over the **+** button (the button takes the pointer, so
  the input's own `:hover` would let go), except on a focused field, which
  keeps Obsidian's focus edge, and an invalid one, which keeps its red.

Text fields and dropdown triggers do not show hover tooltips. Their accessible
names still identify the controls to assistive technology; suppressing hover
popups must not remove those names. Obsidian turns `aria-label` into a tooltip,
so `buildComboboxSkeleton` uses a unique hidden text node referenced through
`aria-labelledby`. Tooltips on unrelated action buttons keep their own behavior.

`tests/inputPointerStability.test.ts` pins both contracts. Check them against
the actual cascade too, in light and dark, with invalid and disabled fields and
the IDs field with its **+** visible: the harness in [Checking a theme against
the real cascade](18-theme-callout-discovery.md#checking-a-theme-against-the-real-cascade)
explains how to compare `styles.css` with Obsidian's `app.css`; reading either
stylesheet alone does not prove the computed result.

### Field corners follow Obsidian's input tokens

The dropdown chrome takes its corners from `var(--input-radius, var(--radius-s))`
and `var(--input-corner-shape, round)`, never from a fixed `--radius-s` and
`round`. Those are the tokens behind Obsidian's own `input`, `select` and
`.dropdown` rules, and they are platform- and theme-dependent (Obsidian 1.13):

| Environment | `--input-radius` (= `--button-radius`) | `--corner-shape` |
| --- | --- | --- |
| Default (Windows, Linux) | 5px | `round` |
| `.mod-macos` | `--radius-m`, 8px | `superellipse(1.33)` |
| `.is-mobile` | `--touch-radius-m`, 44px (a pill) | as the desktop above |

A native `textarea` reads `--textarea-radius` first and only mobile defines it
(24px), so the import window's paste box, which is Obsidian's own textarea,
never becomes a pill 132px tall. Native `button` rules read `--button-radius`, which
is `var(--input-radius)` unless a theme splits the two; plain buttons are left
to Obsidian, so they and the fields match by construction.

Two things draw a corner inside a field and must follow it: the **+** end-cap
(`.cs-tag-add-slot`) rounds one pixel *inside* the field's radius with the same
`corner-shape`, and its button inherits both, so a hover tint cannot square off
the field's corner. Both subtract `--input-border-width` (1px on the desktop, 0
on mobile, where Obsidian's fields have no border). Anything new that overlays
a field edge should derive its radius from `--input-radius` the same way. The combobox's inner input stays at
`border-radius: 0`; its wrapper owns the corner.

The IDs under the IDs field are Obsidian's own pills, on every device
(finding S5-11, decision 16): `TagInput.renderTag` builds the DOM Obsidian
builds for a list value in Properties (`div.multi-select-pill[tabindex=0] >
.multi-select-pill-content + .multi-select-pill-remove-button`), and app.css
draws them from the `--pill-*` tokens: an outline, round ends (`2em`), muted
text, a small x that turns accent on hover. The plugin adds three things only:
the focus ring re-aimed onto the pill's border (`--pill-focus-width: 100%`,
`--pill-focus-left-adjust: 0`; Obsidian's default suits the borderless pills
of a property value), end room for a pill without an x (a built-in's own IDs),
and the 140px ellipsis cap. The pinned ID's lock sits in the x's slot. A theme
that restyles `.multi-select-pill` for Properties restyles these too, which is
the point.

The keys are Obsidian's multi-select keys: Backspace (and Delete) removes the
focused pill and focuses the one before it, or the field when none is left;
←/→ move in reading order (flipped in a right-to-left language), ↑ goes to
the first pill, ↓ and Escape back to the field; Backspace in the empty field
steps onto the last pill. Enter (edit in place, in Properties) is not offered.
The pinned pill answers Backspace with the same Notice as its lock; a
built-in's own ID does nothing, as it has no x. Until 2026-10-23 the IDs were
small grey-filled chips (`--radius-s` on the desktop, the field's pill under
`.is-mobile`) with a bold × that only the mouse could reach.
`tests/idPills.test.ts` covers the DOM, the keys and the CSS.

`tests/inputPointerStability.test.ts` pins the declarations. To confirm the
computed numbers, render a native `button`, `input`, `select` and `textarea`
beside the plugin's fields under the harness linked above, with body classes
`mod-macos`, `mod-windows` and `is-mobile is-phone`, and compare
`border-top-left-radius` and `corner-shape`.

### The one control that is not a field but focuses like one

The **icon tile** in the callout editor (`.cs-icon-tile` - the 44px box that
*is* the icon picker's button, with the ⓧ badge straddling its corner) stays
as it was (decision 16 of the native-look plan): a box the user edits without
typing into, it answers the pointer with one thin edge: hover, `:focus-visible` and
press all set `border-color` to `--cs-field-border-hover` and `box-shadow: none`,
and the fill never changes. (It used to take a 3px focus border and a
`--background-modifier-hover` fill, which read as a darker box with a heavy
edge next to its neighbours.)

Three things about it are easy to get wrong a second time:

- **The box needs four classes.** `box-shadow` is contested
  three ways - `button:not(.clickable-icon)` (0,1,1) sets `--input-shadow`,
  `button:hover` (0,1,1) sets `--input-shadow-hover`, and
  `button:not(.clickable-icon).mobile-tap` (0,2,1) sets it again the moment a
  finger lands - so `box-shadow: none` is written at (0,4,1), the same count and
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

Every hover-driven change the tile makes - the edge, fading the
artwork out, revealing the swap arrows, the ⓧ badge appearing - lives in one
`@media (hover: hover) and (pointer: fine)` block. The `hover: hover` half is
old and load-bearing: iOS Safari applies `:hover` on the first tap of an element
that has hover styles ("sticky hover"), which here blanked the artwork and left
the arrows showing on the way into the picker. `pointer: fine` is the newer
half, and it excludes the stylus and the hybrid laptops that answer
`hover: hover` from a touchscreen.

Touch gets the complement, written as `@media (hover: none), (pointer: coarse)`
rather than `not ((hover: hover) and (pointer: fine))` - Safari only learned
that boolean form in 16.4, and this is the block whose whole job is the phone.
There the press carries the box instead: the same thin edge on `:active`
**and** on `.mobile-tap`, Obsidian's own press class (it adds it to every
`a, button, .tappable, …` on touchstart and removes it on release), which is the
dependable half on iOS where `:active` fires only for elements the engine has
already decided are tappable. Both are self-clearing, so nothing stays lit
behind a tap that opened a picker on top of it. The artwork is deliberately
*not* swapped for the arrows on touch: a finger has nothing to reveal with, only
something to commit with, and the drawing is the content.

The ⓧ badge's own pair moved with it, and has to stay its exact complement - a
coarse pointer that also reports `hover: hover` must land in one of the two
blocks, and the one it should land in is the permanent, 22px, tappable badge.

#### The swap arrows drift

The glyph revealed on hover is Lucide's `arrow-left-right`, and Obsidian builds
a lucide icon as bare shape children of the `<svg>` with no `<g>` wrapper - for
this one, four `<path>`s in drawing order: the top arrow's head and shaft
(pointing left), then the bottom arrow's head and shaft (pointing right). That
is what lets a plain `:nth-child(-n + 2)` / `:nth-child(n + 3)` split hand one
arrow to each of two keyframe sets and slide them apart, each in the direction
it already points, and back - 3.5 user units on a 24-unit viewBox drawn at
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

**Obsidian paints the plain grey buttons.** A window's Cancel (a
`<button class="mod-cancel">` in Obsidian's `.modal-button-container`), the settings tab's secondary buttons
(Discover, Import, Export, Reset, and the two in Data management), Pick an
icon's **Manage libraries** and the import window's Upload/Paste get no face,
edge, hover or focus ring from the plugin: Obsidian's `button` rules draw them,
so they look exactly like Obsidian's own buttons (decision 14 of the
native-look plan). On macOS that is a flat grey (`#e4e4e4` light, `#333` dark)
that does not change under the pointer, which is how Cancel looks in Obsidian's
own dialogs there; on Windows and Linux it is white with Obsidian's hairline
shadow and a small hover step.

**Two kinds still wear the plugin's shared grey face**, until they are rebuilt
as Obsidian controls later in the plan: the two segmented rows,
`.cs-border-side-btn` (All/Top/Right/Bottom/Left in the style windows) and
`.cs-gradient-dir-btn` (the palette's gradient direction). They read one pair
of tokens, declared once near the top of `styles.css`:

```css
--cs-btn-face: var(--interactive-normal);
--cs-btn-face-hover: color-mix(
	in srgb,
	var(--interactive-normal) 92%,
	rgb(var(--mono-rgb-100))
);
```

`--interactive-normal` is Obsidian's own button face - white
(`--color-base-00`) in light on Windows and Linux, `#333333` (`--color-base-30`)
in dark, and `#e4e4e4` on macOS, where `.mod-macos` points it at
`--background-modifier-border` - so the resting look stays whatever a theme
makes it. The list a dropdown opens does not: it is drawn like Obsidian's own
menus (see
[Dropdown popups look like Obsidian's menus](#dropdown-popups-look-like-obsidians-menus)).

### Why the hover is a `color-mix` and not `--background-modifier-hover`

Because **that token is not a colour**. It is a translucent mono overlay,
`rgba(var(--mono-rgb-100), 0.067)` - black at 6.7% under `.theme-light`, white
at 6.7% under `.theme-dark`. Two things follow, and both shipped:

- **It composites against what is behind the button, not against the button's
  own fill.** Discover rested on `--background-modifier-form-field` - an
  *input* token, `--color-base-25` (`#2a2a2a`) - over a `#1e1e1e` pane, and
  hovered to `#2d2d2d`. That is a luminance change of 0.3%: **no hover at all
  in dark mode**, while the very same rule in light moved `#ffffff` → `#eeeeee`
  and looked correct. One rule, one theme broken.
- **Its direction flips with the theme**, because it always moves *away* from
  the background. The segmented rows rest on `--interactive-normal` (`#363636`
  in dark) but hovered to that overlay composited over the group box behind
  them (`#1e1e1e`), landing at `#2d2d2d` - *darker than the button*. That is
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
alone - the face is only ever worn by the plugin's own segmented rows, so
nothing reaches a core dialog, and the coloured variants keep Obsidian's own
faces and hovers. (Window footers used to wear it too, through a
`.cs-modal > .cs-modal-footer` rule that carved out `.mod-cta` and
`.mod-destructive` with a `:not()` list; since 2026-10-23 a window's buttons
are Obsidian's, in Obsidian's `.modal-button-container`.)

### The specificity half, which is the half that gets lost

Obsidian paints every button from

```css
button:not(.clickable-icon) { background-color: var(--interactive-normal) }
```

which is **(0,1,1)**. A single-class rule is (0,1,0) and *does not get the
resting fill at all* - which is why the `background: transparent` the
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
copy of the class. Chrome hid the loss - `flex: 0 0 26px` still sized the
buttons - but WebKit sizes the shrink-wrapped control column from `width`, got
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
- **`box-shadow: none` must not eat the focus ring.** A segment's own
  `box-shadow: none` outranks Obsidian's (0,1,1) `button:focus-visible`, so
  each segment restates the ring itself, in the grey described in
  [How an input field focuses](#how-an-input-field-focuses).

`tests/secondaryButtons.test.ts` pins all of it: that no rule paints the plain
grey buttons, the shared tokens, the two faces reading them, the specificity
bar, the `.is-active`/`:hover` ordering, and the two tokens that must never come
back to a button face.

> [!NOTE]
> The overlay is still right for a **list row, an icon button or a chip** -
> anything that sits on the surface behind it rather than owning a face - so
> `--background-modifier-hover` is deliberately untouched on
> `.cs-combobox-option`, `.callout-studio-row-buttons button`, `.cs-icon-tile`,
> `.cs-drag-handle` and friends. The rule is about which of the two a control
> is, not about banning a variable.

> [!TIP]
> When measuring this with the headless-Chrome harness, **disable transitions
> first**. These buttons carry `transition: background 0.12s`, and
> `getComputedStyle` immediately after forcing the hover state returns the
> *interpolating* value - which Chrome reports in `oklab`. A first pass at the
> harness measured the resting colour twice that way and reported the fix as
> broken.

### Red and purple buttons are Obsidian's

**One red.** A destructive action is Obsidian's destructive confirmation,
`mod-destructive mod-cta`: `setDestructive().setCta()` on a `ButtonComponent`,
`DESTRUCTIVE_BUTTON_CLASSES` (`ui/destructiveButton.ts`) on a raw `<button>`.
Obsidian paints it solid red on every device. That covers every
`ConfirmModal` yes that destroys something (its default `confirmKind`,
`"destructive"`; a yes that loses nothing passes `"cta"`), **Replace in vault**,
the paused-saving banner's **Replace settings file** and **Discard recovery
copy**, **Convert selected**, **Reset everything** and a version's **Restore**.
A destructive *secondary* action would be `mod-destructive` alone, Obsidian's
10% red tint with red text; there is none today.

Never the older `mod-warning`. Obsidian still styles it, but under
`.is-mobile` it is a grey button with bold red text, so the same button was red
on a desktop and grey on a phone or tablet. Never `ButtonComponent.setWarning()`
either: 1.13 deprecates it, and it is only `setDestructive().setCta()` anyway.
(`MenuItem.setWarning(true)`, a red menu item, is a different API and stays.)

**No hover of ours.** Obsidian's hover for a red button paints
`--background-modifier-error-hover`, which it defines as the same
`--color-red` as the resting `--background-modifier-error`, so a red button does
not change under the pointer, exactly like Obsidian's own **Delete** buttons. A
purple button (`mod-cta`) hovers to `--interactive-accent-hover`, a lighter
purple in both modes. The plugin used to override both: a red stepped darker in
light and lighter in dark (`--cs-btn-danger-face-hover`), and a purple derived
from the resting accent, darker in light (`--cs-btn-accent-face-hover`). Both
tokens and their rules are gone, so these buttons look and behave exactly like
Obsidian's. The two segmented rows' selected segment takes the same
`--interactive-accent-hover`.

`tests/dangerButtons.test.ts` fails on a `mod-warning` string in `src/`, an
argument-less `.setWarning()`, any `styles.css` rule that names `.mod-warning`
or selects `.mod-destructive`, and the old red token.
`tests/accentButtons.test.ts` fails on any rule that repaints a `.mod-cta`
under the pointer.

> [!NOTE]
> `.cs-icon-tile-clear` - the small red ✕ on an icon tile - is not a button
> face and keeps a hover of its own. It mixes toward a hardcoded `black` in both
> themes, so it darkens in dark mode against the house direction rule. It also
> carries a hardcoded white glyph, and darkening is what keeps that glyph
> legible: `color-mix(… black)` holds it at 6.08:1 light and 5.10:1 dark, where
> switching to `--mono-rgb-100` would drop the dark pair to 2.80:1. The
> direction rule serves contrast; here it would cost it.

## Controls take Obsidian's colours

The plugin's fields, dropdowns, buttons and lists take their colours from
Obsidian's own tokens in every theme and both colour schemes. On macOS in light
mode that means Obsidian's grey (`#e4e4e4`) on buttons and dropdowns, as
Obsidian's own Settings show them.

Until refactor-1.13 there was a **light palette**: seven swatches of white and
grey lines, applied only in light mode under the Default theme, behind a
`cs-default-theme` class that `main.ts` kept on `<body>`. It was deleted on
purpose (decision 14 of the native-look plan), together with that class, its
module and its two test suites, so the windows look like Obsidian's own in every
case. Do not bring it back to fix one control: restyle that control from
Obsidian's tokens instead.

## Blocked main buttons say why

A button that cannot act must not go quiet. A `disabled` button swallows the
click, so the user is left looking at a dimmed control that never says what it
is waiting for - a name still to be typed, a row still to be chosen, a draft
still to be confirmed with Enter. Every *main* button that can be blocked for a
reason the screen does not already show is therefore **dimmed instead of
disabled**, and answers a press with a notice naming the one thing in the way.

[`ui/blockedButton.ts`](../../src/ui/blockedButton.ts) is the whole mechanism:
two functions over one reason string.

- **`paintBlocked(button, reason)`** sets `aria-disabled` and `cs-btn-disabled`
  while `reason` is non-null and clears both otherwise. Obsidian's own
  stylesheet draws `button[aria-disabled="true"]` exactly like
  `button[disabled]` (`opacity: 0.7`, `cursor: not-allowed`);
  `cs-btn-disabled` is a hook for tests; no rule of the plugin's styles it.
  (Until 2026-10-23 a window's footer dimmed it further, to `opacity: 0.4`,
  fainter than any disabled button in Obsidian; finding S6-01 removed that.)
- **`explainIfBlocked(reason)`** is the first line of the click handler:
  `if (explainIfBlocked(this.saveBlockedReason())) return;`. It returns true
  after showing the reason, so the handler stops. The notice stays up for
  Obsidian's five seconds, stretched at about 60 ms a character (to 12 s) for a
  longer sentence, and a second press *replaces* it rather than stacking
  another.

Each button owns a private `…BlockedReason(): string | null` that returns the
translated sentence for the first thing in the way, or `null`. The same method
paints and answers, so the dimmed look and the words cannot disagree, and the
click recomputes it instead of trusting the last paint - a state that changed
without a redraw is still answered truthfully. The sentences name what to do
(*Choose a replacement callout…*), not the button; a sentence that has to name
another control takes its label as a `{{placeholder}}` so it cannot drift from
the label.

| Button | Reason method | Blocked while → notice |
| --- | --- | --- |
| **Convert selected** / **Finish conversion** (Review conversion) | `PortableConversionView.convertBlockedReason()` | a conversion is running → `portable.blockedConverting`; pending link updates unrecoverable → `portable.recoveryUnavailable`; the review failed → the error already on its status line; the review is updating → `portable.blockedUpdating`; a replacement draft is open → `portable.blockedEditing`; every replacement unchecked → `portable.blockedNothingSelected`; nothing eligible → `portable.empty` |
| **Save** (command editor) | `CommandEditorModal.saveBlockedReason()` | no callout exists or is chosen → `commandBuilder.noCallouts` / `commandBuilder.noCalloutChosen`; the same command already exists → `commandBuilder.duplicate` |
| **Save** (palette editor) | `PaletteEditorModal.saveBlockedReason()` | the name is taken → `palette.saveBlockedName`; the colours duplicate another palette → `palette.colorExists` |
| **Replace** / **Confirm** (replacement picker) | `ReplaceCalloutModal.confirmBlockedReason()` | no row chosen → `replaceModal.chooseFirstReplace` |
| **Import valid only (N)** (import report) | `ImportReportModal` | N is 0 → `import.nothingValid` |
| **Confirm** (icon picker) | `IconPicker.confirmBlockedReason()` | no icon selected, which is also what switching source does → `iconPicker.chooseFirst` |
| **Restore** (Version history) | `SettingsRecoveryModal.restoreBlockedReason()` | saving is paused → `notice.blockedWhilePaused`; the version equals the current setup → `versions.restoreSame` |

The callout editor's **Save** (`showSaveBlockedNotice`), the quick-insert
**Insert** (`quickInsertNotice`) and the plugin import's **Import**
(`noticeFillFirst`) were the first three to work this way and keep their own
copy; **Reset everything**'s acknowledgement answers a press with a nudge on
the checkbox instead (see [`ConfirmModal`](#confirmmodal---the-generic-yesno-dialog)).

**Where `disabled` stays right.** A button that is merely *busy* and already
says so: **Importing…**, the discovery button's **Scanning…**, the saving
banner's **Working on it…**, and two that show Obsidian's own busy button,
`mod-loading` (a spinner in place of the label, at the same width, with
`aria-busy`): the icon picker's Confirm while its artwork downloads, and the
callout editor's Save while a save runs (it used to read **Saving…**, finding
S5-V3). Pressing one of those teaches nothing.

**Two consequences to keep.** A dimmed button is focusable, so Enter and Space
answer too. And a press on one is *not* "clicking away": while a Review
conversion replacement draft is open, a document-level handler commits it on
any outside click, so `PortableConversionCustom.outsideClick` ignores a press
on an `aria-disabled` control, and the view puts the caret back in the draft
(`focusDraft`) - the notice says *press Enter*, and focus would otherwise sit
on the very button that just refused.

## Button labels and the ellipsis

A trailing `…` on a button or menu item says one thing: **pressing this does not
act yet, and the next step asks for a detail the label does not name.** The reader
learns to trust it - a plain label acts, a dotted one asks first - so it only works
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
3. **Does the next step ask for something the label does not say** - a source, a
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
progress text (**Scanning…**, **Importing…**), placeholders (**Search callouts…**)
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

### `ConfirmModal` - the generic yes/no dialog

Resolves `Promise<boolean>`. Required `title` (see above), optional
`confirmLabel`/`cancelLabel`/`confirmKind` (`"destructive"` by default, Obsidian's
red `mod-destructive mod-cta` - a destructive action reads as one by default
unless the caller passes `"cta"`, the accent, for a yes that loses nothing). Used throughout for anything destructive that isn't
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

The existing checkbox change handler mirrors the checked state onto the label's
`is-checked` class while updating the button lock. CSS reads that class for the
red outline, so checking and unchecking stay in sync without a parent `:has()`
selector.

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

### Delete and Convert uses to plain text - two items, two plain dialogs

Covered in depth in [Vault discovery § delete flow](11-vault-discovery.md#delete-flow)
and [§ convert flow](11-vault-discovery.md#convert-flow).

There used to be a `DeleteCalloutModal` with three outcomes: Cancel, "Replace
instead…" and "Delete (convert to plain text)". It existed because Delete did
two things at once, and the in-use dialog had to offer a way out of the
destructive half.

Splitting the action removed the reason for it:

- **Delete** removes only the definition.
- **Convert uses to plain text** only rewrites notes. It is its own `⋮` item
  (`addConvertUsesItem` in `rowOwnership.ts`).
- **Replace in vault…** was already in the same menu (`addReplaceItem`, next to
  it in the `notes` group; see
  [Callout row menu groups](#callout-row-menu-groups)).

Each is now a plain two-button `ConfirmModal`: Cancel plus a red **Delete** or
**Convert**. The body is short sentences, one per line, joined with `\n`;
`ConfirmModal` turns each into its own `<p>`.

A callout nothing uses, unless it is the default fallback, is deleted with no
dialog at all. The notice's **Undo** stands in for the question.

### `NoteChangesModal` - "Update your notes?"

Asked by the callout editor's Save, before anything is saved, when the save
would change something notes hold: an id leaving the callout, titles reading
its old name, fold marks after a **Foldable** change. The rule and the flow are
in [Callout editor](14-callout-editor.md#notes-change-only-after-asking); this is
the window.

- **One question**: the changes Save would make - one line, or a `<ul>` when
  there are several - then how many callouts they reach and the question, one
  sentence per line (`\n` in the string, `<br>` in the window), over a
  `role="radiogroup"` of two answer cards: **Leave them as they are**, first and
  preselected, and **Change them to**, which rewrites every old id to one of
  this callout's own ids.
- **One frame for both questions**: each window wears the chrome and sets its
  title itself (every modal file must, see `tests/modalChrome.test.ts`), then
  `renderNoteQuestion` (`noteQuestion.ts`) draws the changes, the count and
  question, the radiogroup and the footer's two buttons, and hands back
  `answer()` for each card and `repaint()`. The palette
  editor's question (`PaletteNotesModal`, below) is drawn by it too, so the two
  cannot drift apart. Each window adds its own answers and decides what Save
  changes resolves with.
- **The cards are the plugin import window's**: `renderOptionBox` without an
  icon tile, `addOptionRadio` for the dot and `paintOptionRadio` for the chosen
  / choosable state, all from `optionBox.ts` and shared with the import window.
  With more than one id to pick from, Change carries a `SelectDropdown` at its
  trailing edge, just before the dot - where the import card keeps its button
  (`.cs-note-change-picking`; on a narrow window the dropdown and dot wrap to a
  line of their own, still at the trailing edge). Here a click anywhere on a
  card chooses it, a click into its dropdown included; the import window
  exempts its own buttons and text box.
- **Footer**: **Cancel** and **Save changes** (`mod-cta`). Cancel, Escape and
  the close button resolve `null` - back to the editor, nothing saved. The
  promise resolves exactly once; `onClose` destroys the dropdown.
- **Another action**: a built-in row's **Reset to default** opens this window
  too (`sections/builtInResetAction.ts`). `input.action` gives it its own line
  for the removed ids (`noteChanges.changeResetRemoved`, or `…RemovedMany`
  listing several in one line) and its own button
  (`settings.resetAction` in place of **Save changes**). Everything else is the
  editor's: the count, Leave first and preselected, Change to one of the
  built-in's own ids.

### `PaletteNotesModal` - the palette editor's "Update your notes?"

Asked by the palette editor's Save, through its `beforeSave` hook, when a new
name changes the palette's word in callout metadata and notes still use the old
word (the rule is in [Colour system](12-color-system.md)). The same frame as
`NoteChangesModal`: one line saying what changed (`palette.renameNotesChange`),
the count and question, then **Leave them as they are** (preselected) and
**Change them to "new-word"**. No dropdown: there is only one word to change
to. It resolves `false` for Leave, `true` for Change, and `null` for Cancel,
Escape or the close button, which keep the palette editor open with nothing
saved. The title, count, question and answer titles reuse the `noteChanges.*`
strings; only the change line and the two descriptions are the palette's own.

### `PaletteEditorModal` - simple vs. advanced, two background styles

Two-column layout mirroring the per-role global-style popups: a sticky live
preview on the left, titled control cards on the right. **Simple mode**: one
base colour, and the full six-value palette (light/dark accent, background,
text) is auto-derived with contrast correction
(`derivePaletteFromColor` - see [Colour system](12-color-system.md)).
**Advanced mode** exposes independent accent/background/text rows per theme
mode directly, each edit inferring the opposite mode's value
(`inferOppositeModeColor`) - but is only offered while the background style
is **Solid**; a Gradient palette has no advanced per-colour view.

Background style is a further 3-way choice: Solid, Gradient (two-stop linear,
preset direction, an off-by-default "Gradient title text" toggle), or None
(transparent - see [Colour system](12-color-system.md#preset-palettes---hue-named-not-role-named)
for why this is the *only* route to a transparent palette).

The palette card keeps **Name** and **Style** at the same control-column width.
Name is Obsidian's own text field; Style uses the nonsearchable `ListboxPopup`
rather than a native `<select>`, drawn like Obsidian's dropdown. Both are
`--input-height` tall with Obsidian's field corners. The popup is destroyed when
the modal closes.

The preview renders on a **reserved demo id** (`PALETTE_DEMO_ID =
"palette-demo"`), registered through the same registry preview slot the
callout editor uses - and, notably, **deliberately not**
`PREVIEW_PLACEHOLDER_ID` (the callout editor's own reserved id), because two
concurrently-open demo previews (opening the palette editor from inside the
callout editor) must not collide on one registry slot.

**`beforeSave`** is an optional hook the caller passes: Save builds the result,
then awaits `beforeSave(draft, stillOpen)` before it closes. `false` keeps the
window open with nothing saved; that is how the settings list asks
`PaletteNotesModal` first, and how its Cancel comes back here. A second press
while the hook is still answering is the same Save (`confirming`). Closing the
window meanwhile resolves `null` as usual; `stillOpen()` then turns false, so
the question is not opened, and a late `true` saves nothing.

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
reset control without increasing the header's original height. (The callout
editor's icon-adjustment groups no longer have such headers: they are Obsidian
`SettingGroup`s whose ↺ is the heading's extra button; see
[Callout editor](14-callout-editor.md#the-form-box-and-the-groups-beside-the-preview).) Menu-category and
built-in-command resets sit at the trailing edge of their headings, above the
toggle rows.

### `GlobalStyleModal` - the three per-role style popups

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

### `MenuCustomizationModal` - reorder without replacing a grabbed row

Each render role has one persistent list container with a banded list from
[`ui/bandedSortList.ts`](../../src/ui/bandedSortList.ts) attached - the same
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
the window has room and shorten only at a real narrow-width limit. It is set in
Obsidian's setting-name type (`--setting-item-name-size`, `-weight`, `-color`),
like every row in Obsidian's settings.

In the settings tab the callout and palette lists go one step further. A
name there wraps onto a second line instead of being cut, like a native
setting's name. Because nothing is cut, the name spans carry no `aria-label`
tooltip.

The `[!id]` chips are `direction: ltr; unicode-bidi: isolate`, so a
right-to-left interface still shows `[!note]` and not `[note!]`. The row icon
is a muted list icon at `--icon-s`, and the callout's colour lives in its
swatches. Empty states are upright, as Obsidian's are. The saved
`edit` row is labelled **Create or edit callout** because it is one toggle for
both runtime outcomes, not two mutually visible actions.

#### The drop placeholder

While a row is dragged, `DragSortList.ts` marks the slot it lands in if let go
now: an empty `div.cs-drag-placeholder` (`aria-hidden`), the row's exact size.
It is Obsidian's own drop slot (`.drag-ghost-hidden:before`): the accent at 30%
(`color-mix(in oklch, var(--interactive-accent) 30%, transparent)`) with 5px
corners, as when a ribbon item is dragged in Settings → Appearance.

The lifted row is Obsidian's drag ghost: a solid card on `--drag-item-background`
with `--drag-item-shadow`. For the length of the gesture `DragSortList` puts
Obsidian's own `is-grabbing` class on the window's `body`, which gives a grabbing
cursor everywhere and keeps tooltips from opening. Every way a gesture ends
clears it: a drop, a cancel, a lost capture, or the window closing. The handle
ends the row (after the row's own control) and draws Obsidian's three-bar icon
(`menu`, with `mod-drag-handle`). ↑/↓ on it moves the row, and so does Alt+↑/↓,
Obsidian's key, because no modifier is checked.

- **The slot is the dragged row's own box.** The row never leaves the flow -
  it sits in its slot with a `translateY` floating it under the pointer - so
  `coverSlot()` reads its `getBoundingClientRect()` less `currentTransform`,
  relative to the list's, and hands top, left, width and height over as
  `--cs-drag-placeholder-*` properties, which `styles.css` turns into an
  absolutely positioned box. `.cs-menu-customize-list` is `position: relative`
  for that. Measured rather than styled, so a taller library row gets a taller
  slot.
- **It moves inside the FLIP.** When the row changes slot, the placeholder is
  re-covered within the same `animateReorder` mutation that moves the row, so
  the FLIP slides it to the new slot in step with the neighbours trading places
  with it (the same slide, Obsidian's 300ms `cubic-bezier(0.2, 0, 0, 1)` from
  `ui/flip.ts`, and the same cancel-and-restart on a fast drag). It is
  placed with `top`, never `transform`, because the slide is a `transform`
  animation.
- **Paint order.** It is the list's first child, so a row sliding past it is
  painted after it and passes over it, and the dragged row's `z-index: 1` lifts
  that row above everything. The list is deliberately not made a stacking
  context (`isolation`, a `z-index`): that would confine the dragged row's
  z-index to its own list, and a later list in the same window would paint over
  a row dragged onto it. Being absolutely positioned, the box takes no flex
  `gap` and no row index - `rows()` matches `rowSelector` and never sees it.
- **Entrance.** It fades in and opens out from 97% over 200ms
  (`cs-drag-placeholder-in`, behind `prefers-reduced-motion: no-preference`),
  mostly under the lifted row. The keyframes animate the `scale` property,
  not `transform`, so a slide that starts mid-entrance is not overridden.
- **It leaves with the settle.** A released row keeps its placeholder until
  its settle finishes, is cut short by the next grab, or the window closes;
  then the `is-dragging` look and the placeholder go together, unseen, since
  the row now covers the box exactly. A row let go in its own slot loses both
  at once. A rebuild that lands mid-settle - the libraries window's deferred
  refresh - takes the placeholder out with the old rows; the later removal is
  a no-op.
- **Reduced motion draws none.** The row never leaves its slot then, so it
  marks the slot itself.

#### Why this is not Obsidian's own list component

Obsidian 1.13's **Settings → Appearance → Ribbon menu configuration** looks like
the same job: a list you reorder and remove from. It was checked against the
1.13.7 `app.js` and the 1.13.1 typings, and it cannot be borrowed here.

It is a declarative settings page. `buildRibbonPage()` returns two
`type: "list"` definitions - the public `SettingDefinitionList` (1.13.0+, with
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

### `IconLibrariesModal` - libraries in two bands

Opened by the **Manage libraries** text button at the end of Pick an icon's
source row; titled **Manage icon libraries** - the button's words with "icon"
put back, since the button is read inside a window already about icons and the
title has to stand on its own
([`iconpicker/IconLibrariesModal.ts`](../../src/settings/iconpicker/IconLibrariesModal.ts)).
It is the Customize menu items list with a different control on each row;
`ui/bandedSortList.ts` draws both. Above the line are the libraries the picker
offers, in its order. Below it are the rest, in catalog order and without
handles - reordering libraries the picker does not show would change nothing -
with a `cs-drag-handle-spacer` keeping every name in one column.

This window is also the only place a new library is downloaded: the Choose
source menu lists only the libraries the picker offers (see
[Callout editor](14-callout-editor.md#the-icon-picker)), and closes with a line
counting the ones left to download here.

The groups' headings are keyed `iconPicker.librariesAvailable` and
`iconPicker.librariesToDownload` - keys the Choose source menu shared until it
stopped listing libraries to download; they are now this window's alone:

| Heading | Holds | Order |
| --- | --- | --- |
| **Available libraries** | what the picker offers here | the user's order; the only draggable rows |
| **Libraries to download** | downloadable libraries this device lacks | catalog order |
| **Hidden libraries** | built-in libraries the person hid | catalog order |

A hidden library cannot sit under *Libraries to download* - there is nothing to
download - and the window has to list it to offer **Show**, hence the third
group. Its caption appears only while a built-in library is hidden, after the
to-download group. `computeRows()`
therefore returns the shown libraries, then the downloadable ones that are not
offered, then the hidden ones, and `groupOf(row)` names each row's group for
`captionOf`; a caption comes with a line above it, except at the very top.

The headings are not drawn like the menu's small muted labels. All three -
**Available libraries**, **Libraries to
download** and **Hidden libraries** - are drawn exactly as **Built-in commands**
is in Commands and shortcuts: same size, weight, colour and line height, no
capitals, and the same spacing - 36px, a rule, 36px before a later heading, 24px
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
where the variables also point at a muted colour - read from a browser, against
Obsidian's `app.css`). `iconLibrariesModal.test.ts` pins the variables, and pins
the premise - that **Built-in commands** is a plain `setHeading()` row nothing in
`styles.css` resizes - so a size given to that heading shows up as a failure
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
downloadable library, its size - above the line the space it takes, below it
what a download would fetch (only the missing files, so Font Awesome with Brands
already on disk quotes Solid and Regular). Built-in libraries say "no download
needed"; Material says "each icon downloads when picked". The count and the
size sit in FSI…PDI isolates, as the source menu's counts do, so a
right-to-left interface keeps "1.6K+" whole, and a size keeps a no-break space
between number and unit so a phone row never parts "625" from "KB".

Behaviour to keep in mind before changing it:

- **Rows are recomputed, not kept.** Hiding, showing, a deletion, or a
  download finishing - here or in the picker's own prompt, heard through
  `packs.onChange` - rebuilds both bands from settings and pack state inside
  `animate()`, so rows slide into their new band. A change that arrives
  mid-drag waits for the drag's `pointerup`, `pointercancel` or
  `lostpointercapture`: rebuilding under the pointer would detach the dragged
  row.
- **The window scrolls in exactly one case: the library whose button was
  pressed changed band and landed out of view.** Then the list scrolls with the
  row, just far enough to show where it went - down to **Libraries to download**
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
  since the last rows - a hide at once, a delete when its first file is gone, a
  download when its last file has arrived - and hands that key to
  `list.animate(change, follow)`. There, after the rebuild and before the slide
  is measured, `scrollToReveal()` (`ui/scrollToReveal.ts`) moves the window's
  body - `contentEl`, the one scroll container of the chrome
  ([Modal chrome](#modal-chrome---the-one-shell-every-window-wears)) - by the least that puts the row inside it with
  `REVEAL_MARGIN_PX` (40px, room for a group's caption and line above its first
  row) to spare, and not at all when it is already in. Because the scroll is
  instant and happens *before* `animateReorder` reads where the rows now are,
  its slide runs from where each row was on screen to where it now is on
  screen: the list visibly scrolls with the row, in the same 300ms, with no
  second animation to keep in step. Reduced motion skips the slide but still
  scrolls. A list attached without a `scroller` option (Customize menu items)
  never scrolls itself.
- **A rebuild never leaves the list empty.** `render()` builds the rows in a
  detached element and puts them in with one `replaceChildren()`; it used to
  `empty()` the list and append. The row whose button was just pressed has
  focus, and Chromium lays the page out on the spot when it takes focus off a
  node being removed - with the rows after it already gone, since Obsidian's
  `empty()` removes from the last child. The scroller is then too short for
  where it was scrolled, clamps, and stays clamped once the rows are back: with
  this window's list being most of its content, pressing a button on a row near
  the top threw the whole window to the top (measured 196px → 0; a press on the
  last row lost nothing, which is why it looked erratic). `replaceChildren`
  removes and inserts in one step, so the layout it forces sees the full list.
  `.click()` from a script never reproduces this, because it does not focus the
  button - use real pointer input. Customize menu items shares the list and was
  checked too; its lists are short next to the rest of its window, so the same
  press there never clamped.
- **A download writes no settings.** The library lands in its saved slot.
  Hiding, showing, reordering and the reset each save at once, like the menu
  customization.
- **The last library cannot leave the picker.** Its button is dimmed with
  `paintBlocked` and explains itself through `explainIfBlocked`.
- **Deleting asks only when something uses the library.** The `ConfirmModal`
  names the callouts - up to ten, then "and N more" - and says they keep their
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
  is refused while saving is paused if a callout - or the edit - uses one of
  the libraries (the same seal as a single delete), and a library that cannot
  be deleted raises its own notice, leaves the arrow showing, and does not stop
  the rest. Obsidian stacks a phone's setting rows; a phone-scoped rule keeps
  the heading a row.
- **`openAndWait()` resolves with whether anything changed** when the window
  closes, which is what tells the picker to take it in: it rebuilds its menu
  and, only if what the panel shows changed, the panel
  ([The icon picker](14-callout-editor.md#the-icon-picker)). A deletion still
  running when the window is closed - a reset's last libraries included - is
  seen through first (`deletions`), because the picker reads the pack files
  when it hears back and a half-deleted library would still look downloaded.

### `CommandBuilderModal` - fixed + custom commands, one window

Two lists in one modal: the built-in commands (plain rows - nothing to
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

The list **subscribes to the registry while open** - deleting a callout from
another surface (the settings row menu) prunes any command depending on it
(via `CustomCommandManager.syncAll()`, see
[Editor integrations](10-editor-integrations.md#customcommandmanager---one-idempotent-sweep)),
and this window has to stop showing a now-deleted command in the same
moment rather than offering a dead row. Everything here **saves itself
immediately** on every change - there's no separate OK/Cancel, matching the
plugin's general save-on-change convention.

#### `CommandEditorModal` - the rows, and where each one's rule lives

The form is *Callout type*, *Callout format*, *Heading level*, *Action*, *Fold
state*, then a live preview of the command name. Every row is built
unconditionally and hidden with `cs-row-hidden`; one `syncVisibility()` decides
all of it, so the controls can never disagree about the current format. Every
configuration row also carries `cs-command-field`: all five pickers share one
control-column width. The four format-specific choices are `SelectDropdown`s,
which open Obsidian's own menu, while the callout picker is searchable. All five
show the same field shape and hover, press, focus and open feedback. The
controls become full-width when Obsidian stacks rows on a phone.

New commands select the built-in `note` type when available, then the first
registered type with a visible name. This avoids selecting a discovered fallback
whose display name contains only whitespace. Choices come from committed
definitions, excluding theme-only rows and transient previews; persisted
scan-created definitions are registered choices too. Existing commands retain
their saved callout id and can still edit a pinned legacy theme choice.

The choice rows live under `settings/command/` rather than in the modal, which
keeps each control beside its option rule and supplies one popup teardown path:

- **`commandRoles.ts`** - the format list refills itself per callout
  (a theme-owned callout has only Block), with a line explaining the absence.
- **`calloutRow.ts`** - the *Callout type* picker, over the shared
  [combobox](#the-shared-callout-picker). This was a `<select>` whose every
  option read `Abstract (abstract)`; the id is now shown only on a row it
  actually explains. Registered choices form one flat list without headings.
- **`optionRows.ts`** - the fixed Heading level and Action choices.
- **`foldStateRow.ts`** - the three fold states, shown only for Block. Heading
  and inline are not narrower versions of the same choice, they have no fold
  syntax at all, so the row hides rather than greying out. Both block *actions*
  show it: Wrap selection and Insert new write the same header line.

`SelectDropdown` builds the four plain lists as Obsidian menus (see
[Shared dropdown controls](#shared-dropdown-controls)). It exposes selection and
option refresh methods so the modal can sync dependent rows, and a `destroy()`
for every field. Heading level shows Lucide's `heading-1` … `heading-6` beside
each level, and Fold state the fold icons of a note's right-click menu.

`draft()` mirrors the sanitizer's shape, including omitting `fold` when it is
`"none"` - otherwise a command saved from this window and the same command
reloaded would differ by a key that means nothing. See
[`CustomCommand`](04-data-model.md#customcommand).

### Shared dropdown controls

All list-selection triggers carry `cs-dropdown-control`: the searchable
callout, colour, icon-source and skin-tone pickers; the plain choices in
commands, palettes, Quick Insert, the icon picker, occurrences and the
**Language** row; and the callout editor's hidden Fold selector. They are drawn
like Obsidian's combobox button - `--input-height` tall, Obsidian's combobox
padding and [field corners](#field-corners-follow-obsidians-input-tokens), no
border, `--input-shadow`, and the same `chevrons-up-down` indicator - with
Obsidian's hover, focus and open states; see
[How an input field focuses](#how-an-input-field-focuses). Text-entry fields
are Obsidian's own fields. Widths remain specific to each layout.
[`ui/dropdownControl.ts`](../../src/ui/dropdownControl.ts) exposes
`appendDropdownCaret` for the inert, `aria-hidden` indicator.

What opens differs by kind, and is the rule since 2026-10-23 (decision 25 of
the native-look plan: "every menu should look the same as Obsidian's"):

| Kind | The list | Why |
| --- | --- | --- |
| A plain choice (`SelectDropdown`) | Obsidian's own `Menu`, drawn as HTML | a few fixed options: exactly what Obsidian's menus are for |
| A picker you search in (`ListboxPopup`) | the plugin's popup, drawn like `.menu` (see the next section) | a menu cannot hold a search field |
| The icon-source and skin-tone pickers (`ListboxPopup`, select-only) | the same popup | their rows carry what a menu item cannot: a second line with a count, and emoji samples |

None of them uses the operating system's `<select>` list.

**`SelectDropdown`** ([`ui/selectDropdown.ts`](../../src/ui/selectDropdown.ts))
is a `<button class="cs-select-button cs-dropdown-control">` showing the
current option's words (`.cs-select-value`) and the caret, inside a
`.cs-select-dropdown` wrapper. A click, or ↓/↑, builds a `Menu`:

- `setUseNativeMenu(false)`, so it is drawn as HTML and can show icons (and is
  the same on every platform; on a phone it is Obsidian's bottom sheet);
- one item per option, `setChecked(true)` on the current one;
- an option's `icon` when **every** option has one, otherwise `setNoIcon()`, so
  the words start at the row's edge. Today only *Heading level* (`heading-1` …
  `heading-6`) and *Fold state* (`ban`, `plus`, `minus`, the icons of the fold
  choices in a note's right-click menu) carry icons;
- `setParentElement(button)`: Obsidian marks the button `has-active-menu`,
  treats a press on it as not "outside" (so a second click closes the menu
  instead of reopening it) and closes the menu if the button disappears;
- `showAtPosition({ x, y: bottom, width, overlap: true, left: rtl })`, the
  position Obsidian itself uses for a menu under a button.

While open the button carries `is-open` (Obsidian's open-combobox look) and
`aria-expanded="true"`; `onHide` clears both. If a click on a menu row left
focus nowhere, focus returns to the button. Inside the menu the keyboard is
Obsidian's: its arrows, Enter and Escape come from the menu's own key scope, so
the plugin's Escape handling (`ui/menuEscape.ts`) is not involved. The field's
accessible name is a hidden label plus the value (`aria-labelledby="<label>
<value>"`), because a button has no value to announce, and `aria-label` would
show as an Obsidian tooltip.

The adapter owns the options and the value: `setValue` is silent, `onChange`
fires only for a user's pick of a different option, and `onPick` for every pick
(the language row retries a pending download when its own language is picked
again). `setOptions` keeps a still-valid value or takes the first option, and
closes an open menu, which would otherwise offer the old options; a pick of an
option that is gone is ignored. A hidden `cs-dropdown-width-sizer` grid of every
label gives the field the width of its longest option, so it does not resize
when the value changes. Callers destroy the adapter when its row or owner goes;
`destroy()` closes an open menu and disables the field for good.

### Dropdown popups look like Obsidian's menus

The two popups that open from a `cs-dropdown-control` - `.cs-combobox-menu`
(every `ListboxPopup`, so every `SelectDropdown` too) and the callout editor's
Fold selector, `.cs-palette-menu` - are drawn like Obsidian's own `.menu`: the
menu behind ⋮ **More options**, or a file's right-click menu. Niv decided on
2026-10-22 that every menu in the plugin should look the same as Obsidian's
(decision 14, finding S6-04 in the refactor plan).

**The list.** One shared rule paints both popups from Obsidian's `--menu-*`
tokens, so a theme that restyles Obsidian's menus restyles these lists too.
The fallbacks are Obsidian 1.14's defaults, read from its `app.css`:

| Property | Value | Obsidian 1.14 default |
| --- | --- | --- |
| ground | `--cs-menu-face` = `var(--menu-background, var(--background-secondary))` | `--background-secondary` |
| edge | `var(--menu-border-width, 1px) solid var(--menu-border-color, …)` | 1px of `--background-modifier-border-hover` |
| corners | `var(--menu-radius, var(--radius-m))`, `corner-shape: var(--menu-corner-shape, …)` | 8px on a computer |
| shadow | `var(--menu-shadow, var(--shadow-s))` | `--shadow-s` |
| blur | `backdrop-filter: var(--menu-backdrop-filter)` | `none`; a blur on mobile |
| inner padding | `var(--size-2-3)` | 6px, what `.menu-scroll` gets on a computer |

The padding is not read from `--menu-padding`, because a phone redefines that
token for its menus' bottom sheets (16px at the sides, plus the room under the
home indicator). These lists stay attached to their field on a phone, so they
keep the computer's 6px.

On a phone or tablet Obsidian draws its menus without an edge, 90% opaque over
a blurred view of what is behind them (`.is-mobile .menu`). The lists do the
same: `.is-mobile` drops the border and mixes the ground with
`--blur-opacity-m`, and the blur arrives through `--menu-backdrop-filter`,
which Obsidian sets for mobile.

**The rows.** `.cs-combobox-option` (and the Fold menu's `.cs-palette-menu-item`,
which the colour picker's rows also wear) is laid out like `.menu-item`: flex,
an 8px gap, `4px 8px` of padding, `--radius-s` corners, Obsidian's `--cursor`,
13px text on a computer and 15px under `.is-mobile`. The size lives on the row;
the words inside inherit it. The row under the pointer or the arrow keys
(`.is-active`) is `--background-modifier-hover`, as `.menu-item.selected` is,
so the highlight is a rounded pill inside the list's padding.

**The chosen row has no fill.** It carries a ✓ at the end of the row instead,
which is what Obsidian's `MenuItem.setChecked(true)` draws.
`appendComboboxCheck()` in `ui/listboxPopupDom.ts` appends
`span.cs-combobox-check` (Lucide `check`, `aria-hidden`, since the row's
`aria-selected` already says it is chosen). `renderComboboxRows` calls it for the
committed row of every list after the caller's `renderRow`, so the ✓ always
lands last; the Fold menu calls it for its own current state. The check is
muted and at `--icon-s`, as `.menu-item-icon` is, and `margin-inline-start:
auto` pushes it to the end even when the row's content is short. The icon-source
menu's own smaller check (`.cs-source-check`) is gone: it uses the shared one.

The list keeps its trigger's width (both inline edges pinned, see
`.cs-palette-menu`), so the ✓ takes its 24px from the chosen row's words. A
long name is cut a little earlier on that one row. Obsidian's own menus are
shrink-to-fit instead, which is why the plain choices open a real Obsidian
`Menu` rather than this popup (see
[Shared dropdown controls](#shared-dropdown-controls)).

**Groups.** A `.cs-combobox-group` reaches across the list's 6px side padding
(negative margin, the same padding put back inside), so that:

- the line between two groups spans the whole list, as `.menu-separator` does:
  one `--background-modifier-border` line with 6px of air on each side;
- the sticky heading (`.cs-combobox-group-label`) can span it too, edge to edge,
  and hide the rows scrolling under it. It paints the opaque `--cs-menu-face`
  (also on mobile, where the list itself is 90% opaque: a translucent heading
  would let the hidden rows show through). Its padding puts its words where the
  rows' words start, 14px from the edge. Its type is the S6-05 one: small,
  semibold, `--text-muted`, sentence case.

The source menu's closing note (`.cs-combobox-footer-note`) draws the same
full-width line above it.

**Things that repaint the ground** read `--cs-menu-face`: the sticky heading,
the ring cut around overlapping colour circles, and the transparent swatch's
checkerboard.

**Dimmed id characters** (`callout-studio-suggestion-id-dim`) are no longer
overridden inside a list. The override brightened them because the list stood
on the lighter control face; on Obsidian's menu ground the `[!` popover's own
`--text-faint` is right, as it is for `.menu-item-desc`.

**History.** Until 2026-10-23 the lists wore their control's grey face
(`--cs-btn-face`) with a field-coloured edge (`--cs-field-border-hover`), a heavy
two-layer shadow and a filled stripe behind the chosen row
(`--cs-menu-row-selected`, mixed from the face toward the text colour). That look
was chosen on 2026-09-30, because a list in the window's colour read as "a second
object stuck onto" its field. The menu look replaces it on purpose. Please do
not bring the control's face back.

`tests/dropdownPopupSurface.test.ts` pins the menu tokens, the mobile treatment,
the row layout, the absence of any fill on a chosen row, the ✓, the separators
and every repaint of the ground. `tests/listboxPresentationState.test.ts`
checks that only the committed row carries the ✓, as its last child, and that it
moves with the choice. `tests/modalBodyLayers.test.ts` allows the sticky heading
to paint `--cs-menu-face`, and `tests/modalSurfaces.test.ts` lists the ground's
`--background-secondary` fallback as reviewed. To check it against the real
cascade, render each popup open in the harness linked under
[How an input field focuses](#how-an-input-field-focuses), beside a hand-built
Obsidian `.menu > .menu-scroll > .menu-group > .menu-item` (one `.selected`,
one `.mod-checked` with its trailing check), with body classes
`theme-dark`/`theme-light` × `mod-macos`, `is-mobile is-tablet` and
`is-mobile is-phone`.

### Option rows are padded once

Every row of a popup list is padded in one place: the shared row rule
(`.cs-combobox-option`, with the Fold menu's `.cs-palette-menu-item`), `4px 8px`
as on Obsidian's `.menu-item`. The plain choices draw no rows at all any more:
their list is Obsidian's `Menu`.

Until 2026-10-23 a plain choice's label owned the padding (`6px 12px`). Before that, the
command editor's four selects and the palette editor's **Style** select also
added `padding: 8px 12px` to the *row*, on top of the label's, which put their
text 25px in and made their rows 45px tall. The icon picker's filters, its skin
tone picker, its source menu and the Find callouts "every type" row each padded
their rows themselves too; all of those rules are gone.
`tests/dropdownOptionRows.test.ts` fails if the old label rules come back, or if
any rule reaches a row through another class and pads it a second time.

### The id line under a callout's name

`renderCalloutIdLine` (shared by the picker and the `[!` popover) draws one
`.callout-studio-suggestion-id-item` per id, each carrying its own trailing
`", "` (the last has none), inside `.callout-studio-suggestion-id`. The line is
cut by the browser and by nothing else: `text-overflow: ellipsis` on the line
hides atomic inline boxes whole, so a line that does not fit always ends
`abstract, …` - cut between ids, the native `…` after a comma and a space,
identical on every row. A single id longer than the whole line ellipsizes inside
its own item.

It used to work out how many ids fit with a canvas measurement and append a
literal `...`, *and* carried the native ellipsis as a fallback. The measurement
ran while the rows were being built, before the list overflowed and a scrollbar
(12 - 17px) narrowed every row, so rows that had just fit now overflowed and got
the browser's `…` on top of the typed `...` - in one list, `check, ...`
(three monospace cells wide), a glued `…` and the two overlapping. Never measure
this line. The id line is also `direction: ltr` in any window, right-aligned under
`.mod-rtl` so it lines up with the name above it: ids are code, and in an RTL
window the bidi algorithm reordered the run and stranded the commas.

### The shared callout picker

Every place the user picks one callout out of a list is the same control:
[`calloutCombobox.ts`](../../src/settings/calloutCombobox.ts), over
[`ui/listboxPopup.ts`](../../src/ui/listboxPopup.ts). It replaced two native
`<select>`s - *Default fallback callout*
([`FallbackSection.ts`](../../src/settings/sections/FallbackSection.ts)) and
*Callout type* above - neither of which could be typed into or showed a callout's
icon or colour, while the `[!` popover in the editor had done both for a long
time. The fallback picker uses the shared field face and interaction rules;
there is no fallback-specific button styling.

The rows are literally the popover's markup
([`calloutComboboxRow.ts`](../../src/settings/calloutComboboxRow.ts) reuses the
`callout-studio-suggestion*` classes), and the id/alias second line is the same
function in both - `renderCalloutIdLine`, which `AutoComplete.renderSuggestion`
calls too, so a callout cannot describe itself one way in the editor and another
way in settings. Matching goes through the same `calloutMatchesQuery` - id,
display name and **aliases**, substring rather than fuzzy - ordered by
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
The type follows Obsidian's own suggestions. A group heading is small,
semibold and muted in sentence case, like `.search-suggest-item.mod-group`
(Obsidian uppercases only badges). A name is the field's 13px
(`--font-ui-small`), as `.combobox .suggestion-item` is, while the `[!` popover
in a note keeps Obsidian's 15px suggestion size. A query that matches nothing
reads upright and centred, like `.suggestion-empty`.
The All types scope is iconless and remains separate from registry definitions.
Color pickers retain their headings even with only one matching group.
`renderComboboxRows()` sets `cs-combobox-menu-grouped` only when it actually
creates a group, clearing it before every rebuild. That class owns the menu's
top padding and sticky-heading scroll allowance, including transitions to
ungrouped, empty, or create-only results.

One option adds something after the rows. `footerNote()` is information -
plain text asked on every rebuild, nothing when it returns `""` - drawn last as
`cs-combobox-footer-note` with no role and no listener, outside `rowEls`, so
nothing highlights it and a press on it is swallowed by the menu's
`mousedown`. A rule above it, the same as between groups, marks the end of the
list. Pick an icon's source menu uses it to count the libraries left to
download.

The occurrence **Format** filter and the command editor's Format, Heading level,
Action and Fold state rows are not this picker: they are `SelectDropdown`s,
which open Obsidian's own menu (see
[Shared dropdown controls](#shared-dropdown-controls)).

A query that matches nothing does **not** dead-end. When the call site supplies
`onCreate`, the empty state is replaced by a real, keyboard-reachable row
offering to create the callout under that name - the same offer, and the same
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
`is-selected` and `is-active` shows the ordinary highlight under its ✓: a
chosen row has no fill of its own, so hovering the committed option never looks
inert.

Callers **must** call `destroy()` - a modal from `onClose`, a settings section
through `registerDisposer` - because the popup holds a document-level click
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
commit at all - a click on a row is also a blur, and blur lands first.

Field names are assigned by `fieldAccessibleName.ts`, using a hidden sibling
label referenced through `aria-labelledby`. The label has the `hidden`
attribute, with `opacity: 0` and `pointer-events: none` as a CSS fallback if a
theme overrides its display. This keeps accessible names without the hover
tooltip Obsidian derives from `aria-label`.

The control itself uses the [shared dropdown styling](#shared-dropdown-controls),
matching the other listbox triggers. The input inside is
painted down to nothing, and **its rules are descendant-
qualified on purpose**: Obsidian styles `input[type='text']` at specificity
(0,1,1), which beats a lone class - a bare `.cs-combobox-input` rule loses, and
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

### `hotkeyLink.ts` - reading a binding Obsidian doesn't expose a public API for

`printHotkeyForCommand` goes through the undocumented `app.hotkeyManager`,
guarded structurally (an unreadable binding reads as `""`/unassigned rather
than throwing - every internal API access in this codebase follows this
pattern). Because that helper only ever formats the **first** binding on a
command bound to more than one shortcut, showing every binding means
re-implementing Obsidian's own key-formatting tables by hand
(`MODIFIER_GLYPHS`, platform-specific: `⌘⌃⌥⇧` stacked with no separator on
macOS, `Ctrl + Alt + Shift` spelled out with `+` elsewhere) - duplicated
rather than simplified, specifically so the same shortcut can never read two
different ways in two different windows of this plugin.

### `WelcomeModal` - the one chrome opt-out

Covered above under Modal chrome. The hero name takes the size and weight
Obsidian gives a plugin's name in its details window (`--h2-size`, semibold,
`--line-height-tight`). The removed title leaves an empty `.modal-header`, and
it is kept on purpose: its 0.75em bottom margin on the desktop (its padding on a
phone) is what holds the columns clear of the absolutely positioned close
button. Hidden, the ✕ lands on the corner of the **See it in action** box. The
left column aligns to `start`, so it mirrors under a right-to-left interface. Automatic onboarding requires confirmed
fresh-install eligibility and checks both `settings.welcomeSeen` and the
device-local welcome marker. An absent `data.json` alone is insufficient; see
the [startup decisions](08-settings-sync-and-recovery.md#launch-decision-table).
The welcome screen can be reopened via the info icon in settings or the
dev-convenience protocol handler `obsidian://callout-studio-welcome`
registered in `main.ts`.

The sample's **Learn more** link uses `USER_GUIDE_URL` in `WelcomeModal.ts`,
passed through the existing `repoUrl` translation placeholder. It targets
`docs/user-guide` on GitHub at revision `fa1c8e29aa1f9a40b7a90226d12197c6fe96f1f4`.

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
  [CSS generation](06-css-generation.md)) - so the splash was advertising the
  theme's colours rather than the plugin's.

It now uses `WELCOME_DEMO_ID` (`demo`) and registers its own violet definition
into the registry's transient preview slot via `beforeRender` -
[`welcomeDemo.ts`](../../src/settings/welcomeDemo.ts).

##### Why this one id is *not* reserved

`demo` is deliberately **absent** from `RESERVED_DEMO_IDS`, and that is the
single respect in which it differs from the other two demo ids. The splash
sample is copy a user reads, and `> [!global-style-demo]` puts plumbing in the
middle of the one screen whose whole job is to teach the syntax - so this id is
spelled the way a person would write it.

The price is exactly what reservation buys, and it is not worth paying here.
`new-callout-preview` and `global-style-demo` are spelled with a dash, which
`sanitizeCalloutIdInput` folds to a space, so **no user can mint them** and
reserving them costs nothing. `demo` is an ordinary word the editor does
produce (`"Demo"` → `demo`), so reserving it would quietly cripple a callout
somebody legitimately named "Demo": filtered out of the autocomplete, dropped
from their export, rejected by their own re-import - with nothing in the editor
telling them the name was taken. A reserved id has to be one nobody can reach.

What stands in for reservation is that the definition exists **only while the
splash is open**, which is all the isolation it needs: `setPreviewDefinition`
never persists and never notifies, `definitionsForLists()` hides it from every
settings list, and if the user *does* own a real `demo` the preview slot
shadows it and hands the real row back on close (`previewShadowedDef`). The one
residue is cosmetic and transient - their own `[!demo]` callouts in a note
behind the modal repaint violet until it closes. `tests/welcomeSample.test.ts`
pins the non-reservation so a later tidy-up cannot undo the reasoning.

Two halves are needed, and only together:

1. **The id**, which removes the by-name attack - no theme has a rule for an id
   it has never heard of.
2. **A scoped hardening block in `styles.css`**, which handles what an id change
   structurally cannot: a theme's *generic* selectors. `.callout { … !important }`
   still reaches the block role, and plain heading rules still reach the heading
   role - the injected `.cs-heading-callout` / `.cs-inline-callout` rules carry
   no `!important` at all, on purpose, so a theme wins those without a fight.
   The block restates the same values under `.cs-welcome-modal`, keyed on the
   demo id, with repeated compounds for weight (the trick
   `manager/theme/studioWeight.ts` uses). Among `!important` author declarations
   the higher specificity wins, so it survives; and because it is scoped to the
   modal and the id, it can reach nothing else - load-bearing here rather than
   tidiness, since a user may own a real `demo`.

   It restates, and does not invent. All three roles carry
   `color-mix(in oklch, <accent> 12%, transparent)`, which is
   `.cs-heading-callout`'s and `.cs-inline-callout`'s own default formula copied
   verbatim: the hardening changes the *weight* of the plugin's answer, never
   the answer. That is also why the inline example is a tint and not the solid
   violet lozenge it was for one revision - a solid pill is a look the plugin
   gives no other inline callout, so the splash was demonstrating something
   users could not reproduce.

`onDestroy` clears the slot and re-injects. That inject is not just tidying: on
a fresh install this modal holds a preview definition during the very first
launch, and `injectNow` skips the startup CSS snapshot for as long as one is
live - so this is the inject that writes it.

The demo never becomes a real callout. `isDemo` keeps it out of the settings
lists and out of `data.json`, and the slot is cleared on close - see
[Callout registry](05-callout-registry.md#reserved-demo-ids) for the permanent
guarantees the other two demo ids get on top of that, and the section above for
why this one does not take them.

## Saving-status banner

`saveStatusBanner.ts` is shared by the settings page and the callout editor.
It subscribes to `SettingsWriter.status` and redraws only its own slot, preserving
scroll position and form fields.

On the settings page the slot is `CalloutListsScaffold.bannerSlotEl` - an empty
div the lists scaffold creates directly under the **Callout Studio** title row,
which is why `SettingsTab.display()` renders the banner *after*
`calloutLists.render()` rather than first. It is still ahead of every section,
since it is the reason nothing below it will be saved; above the title it read
as a message about the settings window rather than about this plugin.

Each redraw builds the same three parts: a header (`alert-triangle` plus a title
row), the message paragraphs, and `.cs-readonly-banner-actions` holding whatever
actions apply. The title is chosen from the writer, not from the message -
`isFrozen || status.frozenReason` reads as *Saving is paused*, a bare
`status.failure` as *Settings were not saved* - so a frozen session that also
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
`recovery-read` freeze. Both are red (`mod-destructive mod-cta`) and run only after a
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
settings and assumed the worst, so every paused state - frozen for `missing`,
`unreadable`, `recovery-read` or `newer-version` - reads the same way, in two
or three short paragraphs chosen by `pausedCopy()` in
[`saveStatusCopy.ts`](../../src/settings/saveStatusCopy.ts):

1. **Calm.** "First of all, take a deep breath - everything is going to be
   okay", then what is safe, then why the page is read-only (`pausedNote`,
   because `SettingsTab` makes every edit `inert`; see
   `sections/pausedReadOnly.ts`). The editor gets the same paragraph without
   the page sentence.
2. **What happened**, from `status.reason` (latest failure, else the frozen
   reason). After a manual **Check again** finds the file still missing, it
   gets more specific and names the cloud-storage "keep it downloaded" setting
   that most often keeps a synced file away.
3. **What to do**, from `status.frozenReason` - the field that decides the
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
  "Checks again every minute" only where `rechecksWhilePaused()` - the same
  function `pausedRecheck.ts` runs on - says the timer covers the state.

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
(`tabindex="-1"`) and moves between rows itself - the arrow keys go row to row,
Enter reaches the row's button - so the row takes focus; older Obsidian rows
cannot, and there the row's first usable control does. An inert row (Import,
while saving is paused) is left alone. `run(fromKeyboard)` passes `focusVisible`:
the buttons report a click with `event.detail === 0` (Enter or Space) as from
the keyboard, so a key press shows the focus ring and a mouse click does not.
With `prefers-reduced-motion: reduce` the scroll jumps (`behavior: "auto"`,
via `prefersReducedMotion()` in `ui/flip.ts`); the pulse only fades a colour and
stays.

## `SettingsRecoveryModal` - Version history

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
  Hovering a row changes neither the card, the time nor the marker; it only
  sharpens the row's own icon buttons (see "List rows and hover").
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
either way. **Restore** is red (`setDestructive().setCta()`), dimmed (not disabled - a press says
why, see [Blocked main buttons say why](#blocked-main-buttons-say-why)) while
saving is paused or when the version equals the current setup, and confirms
before calling `recovery.restore()`; both confirmations and their notices quote
the version's name. There is no per-entry export action; the settings page's
ordinary **Export** continues to export the displayed setup.

The row floor for the text column is `12rem` (`min(12rem, 100%)`): about what a
version name needs before it breaks a word per line. On a desktop window
the controls sit beside the text; on a phone there is no room for the floor
beside them, so the control cluster wraps onto its own line under the text and
stays at the end - still compact, never Obsidian's full-width phone button.
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
setup** and **After restoring this version**. A table's head has two rows - the
section title, a `<button>` that folds the section down to that row, and the column
headings - and the whole `<thead>` is the sticky layer at `top: 0`, so the two pin
as one block and let go with the section's last row. The window body's top padding
moves into the report, so nothing shows above a pinned head (the rules are in
`tests/modalBodyLayers.test.ts`). Tables use the theme's `--radius-m` for their
outer corners. An opaque `mask-image: linear-gradient(#fff, #fff)` uses the
default `mask-clip: border-box` to clip the table and cell backgrounds to that
rounded frame. The prefixed `-webkit-mask-image` declaration preserves this on
older iOS versions supported by earlier Obsidian builds. The mask creates no
scroll container, so the modal body remains the sticky header's scrollport;
`overflow: hidden` on the table would break that relationship. The same rule
applies when the table becomes a block on narrow screens. Masking changes painting
rather than pointer hit-testing: the full-width heading button remains clickable
in the tiny transparent areas inside its rectangular bounds at the rounded corners.
Each item is one `<tbody>`: a number cell spanning
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

**From JavaScript** - `prefersReducedMotion()` in
[`ui/flip.ts`](../../src/ui/flip.ts) is the only function; it is a fresh
`matchMedia` read on every call, so a change in the system setting applies to
the next animation without a reload. It is exported from `flip.ts` for
historical reasons, not because the check belongs to FLIP. Its callers:

- `flip.ts` itself - row reorders skip the FLIP animation and just land.
- `DragSortList.ts` (and so `bandedSortList.ts`, which drags through it) - read once when a drag starts; the settle and slide
  animations are skipped and no drop placeholder is drawn (see the drag section above).
- `settings/targetHighlighter.ts` - `scrollIntoView` uses `behavior: "auto"`
  instead of `"smooth"`; the pulse only fades a colour.

**From CSS** - `@media (prefers-reduced-motion: …)` blocks in
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
