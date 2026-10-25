# Declarative settings - the tab as a tree Obsidian draws

Since Obsidian 1.13 a settings tab can describe itself as data instead of
drawing itself: `getSettingDefinitions()` returns a tree of rows, boxes, lists
and pages, and Obsidian draws it, keeps it up to date, and indexes every row
for the **Search settings…** field. Callout Studio's whole tab is that tree,
so a search for "palette", "fallback" or one of the user's own callouts lands
on the right row (the plan's *Searchable Settings* stage).

**Status.** The tab draws from the tree, built under
[`src/settings/declarative/`](../../src/settings/declarative/)
(§ The tab and its tree). `display()` is still there, as the fallback
Obsidian calls when the tree comes back empty, which happens only when
building it threw (see
[16 § `getSettingDefinitions()` returns the tab's tree](16-settings-ui-and-modals.md#getsettingdefinitions-returns-the-tabs-tree));
the *Clean Sweep* deletes it. Each part is tested through a copy of
Obsidian's renderer (§ Testing the tree), and the whole was checked in
Obsidian 1.14.5 on a computer and in phone and tablet emulation.

## How Obsidian draws the tree

Read from `app.js` 1.14.4 (the research notes name the minified functions).
These are the rules every part of the tree is written against.

- **Loose rows are boxed.** A run of rows that are not inside a `group` or
  `list` is wrapped in a box without a heading. So every row ends up in a
  rounded box.
- **Everything is keyed.** A box's key is its `id`, else its heading, else its
  position; a row's is its `id`, else its control's key, else its name, else
  its position. Two siblings with one key make Obsidian log "duplicate setting
  key" and reuse the wrong element. Rows that stand for user data (a callout,
  a palette, a command) therefore always carry an `id` that does not change
  when the user renames them.
- **`update()` redraws the open page, row by row.** It stores the new tree,
  re-indexes the search and draws the page on screen again. A row whose key
  is still there keeps its element, but its cleanup (what its `render`
  returned) runs, its controls are emptied (`setting.clear()`), and the row is
  drawn again from scratch: name, description, `render`. The one exception is
  a control row whose control has focus. So a `render` must be able to run any
  number of times, and anything that has to survive a redraw (a banner in the
  middle of an action, a preview someone is typing in, an open menu) must live
  outside the row and be put back by it.
- **Nothing refreshes by itself.** Opening the tab draws the tree the last
  `update()` stored; it does not ask for a new one. The tab has to call
  `update()` whenever something the tree shows changes, even while the window
  is closed.
- **`visible` and `disabled`** are worked out on every draw and again by
  `refreshDomState()`, which only toggles them in place. A group whose rows
  are all hidden hides too. `disabled` reaches the row's components (on a
  render row too, though the typings do not say so). It is only an
  appearance: it does not stop a drag, the Delete key or Alt+arrows on a list.
- **Hidden still counts for spacing.** A hidden row or box is only
  `display: none`, and app.css finds "the first row" and "the first box" with
  `:first-child`. So a box whose first rows are hidden draws the line between
  rows above its first shown row, and the box after a hidden first box keeps
  the 24px gap between boxes. The main page starts both ways (the notices'
  box, the callouts box), and `styles.css` corrects the two
  (`.cs-banners[style*="display: none"] + .setting-group`, `.cs-callouts-box`).
- **A row with nothing to draw is left out.** A row without a name, a
  `render`, a control or an action is dropped before drawing (`M4`), so a
  row that is only a description never shows. A page's opening sentence is
  therefore a render row: `pageIntroBox(id, text)` in `rowParts.ts` draws
  Obsidian's own `p.setting-page-desc`, in a box whose `cs-page-intro` class
  takes the box's and the row's look away.
- **Lists** (`type: "list"`) add, when asked: an empty-state row; `addItem`, a
  `+` in the heading on a computer and a last `+ Name` row on mobile; `onDelete`,
  a ✕ on every row and the Delete key; `onReorder`, a drag handle and
  Alt+↑/↓. The heading buttons, the search field and these handlers are made
  once, when the box is first drawn, and read the newest definition when used.
- **A box's own search field** (`search`, 1.13.1) appears only if the box had
  rows when first drawn. Rows marked `searchable: false` are never filtered by
  it. Its `match` is the one of the box's *first* draw, called with the
  *newest* row definitions, so it must read everything from the row it is
  given, never from the list it was built with.
- **Pages.** A `page` row opens a sub-page. With `items`, Obsidian draws the
  page from the tree and redraws it on `update()`. With `page: () => new
  SomePage()`, the plugin draws the page itself, Obsidian never redraws it, and
  nothing on it is in the settings search.
- **The settings search** indexes every visible row that is not
  `searchable: false`, inside boxes and `items` pages, by name, description
  text and `aliases`; a query matches when every word in it is found. Pages are
  found by name.
- **Nothing is caught.** An error while building the tree, or in a `render`,
  is not caught by Obsidian (§ Never throwing).

## The plugin's own types

[`declarative/types.ts`](../../src/settings/declarative/types.ts) defines the
tree as `CsItem` (`CsRender`, `CsAction`, `CsControl`, `CsGroup`, `CsList`,
`CsPage` …). They are Obsidian's definition types plus three fields its
renderer reads but its typings leave out: `id` everywhere, `icon` on a plain
or action row in a list, and `disabled` on a render row. `toObsidianItems()`
converts the finished tree, once, with a cast.

## Saving a control: never `saveData`

Obsidian's default `setControlValue(key, value)` writes `plugin.settings[key]`
and then calls `plugin.saveData(plugin.settings)`. In this plugin that would
overwrite `data.json` (callouts, sync stamps, everything) with the settings
object alone. The tab therefore overrides both halves, through
[`declarative/controlBinding.ts`](../../src/settings/declarative/controlBinding.ts):

- **`getControlValue(key)`** reads a dotted path into the live settings
  (`"globalStyle.block.alignContentWithTitle"`), every time, never from a copy.
- **`setControlValue(key, value)`** refuses while saving is paused (with the
  usual notice, `pausedGuard.ts`) and redraws the page to put the control
  back; otherwise it writes the value and announces it with
  `registry.settingsChanged()`, as every direct settings write in the plugin
  does. That change round repaints everything that reads the settings (the
  stylesheet, the theme's styles switch, the outline, reading view) and saves
  with `saveSettings()`; re-injecting the CSS alone would leave the rest
  stale. A key the settings do not have is a mistake in the tree: nothing is
  written or saved, and the console says so.

`tests/declarativeControlBinding.test.ts` draws a real control row through the
test renderer and checks that `saveData` is never reached.

## Keeping the tree current

Every `update()` redraws every row of the open page, so the tab never calls it
directly for a change; it asks
[`declarative/treeUpdater.ts`](../../src/settings/declarative/treeUpdater.ts)
(`TreeUpdater.request()`), which makes updates rare and harmless:

- **Coalesced:** any number of requests before the next frame make one update,
  and a request made while a row is drawing waits for that frame too.
- **Skipped when nothing shown changed:** the tab supplies a signature, one
  string covering everything the pages show; a request whose signature equals
  the one last drawn is dropped unless it is forced (`request(true)`, for a
  change the signature cannot see, such as an icon finishing its download).
- **Held while the user is busy:** an open Obsidian `.menu`, an open picker
  list (`.cs-combobox-menu` / `.cs-palette-menu` without their closed class), a
  drag (`body.is-grabbing`), a field of a settings page with the focus (a text
  field, a slider, the style pages' preview editor: Obsidian keeps a focused
  *control* row through a redraw, but not a render row), or a row's ⋮ menu
  that is still waiting for its counts (`isRowMenuActive(app)` in
  `calloutRowMenu.ts`). The update waits a
  tick at a time, for at most about ten seconds, then runs anyway.
- **Delivered when the settings window is hidden or closed:** the wait is the
  next frame of the window showing the tab *or* a 250 ms timer, whichever comes
  first (`nextFrameOrSoon`). This matters because opening the settings draws
  the last stored tree; it does not ask for a new one.

## The tab and its tree

`SettingsTab.getSettingDefinitions()` makes, once, a
[`DeclarativeSettings`](../../src/settings/declarative/declarativeSettings.ts)
and returns its `definitions()`. That object lives as long as the plugin and
holds everything the tree is built with:

- **The context** (`TreeContext`): the plugin, the row registry, the parts
  store, `display()` (a forced `TreeUpdater` request: "draw the settings
  again", for a change the signature may not see, such as a scan starting),
  `revealCallout` (a forced request, then a jump to the callout's row) and
  `jumpTo` (`jumpToRow` with the tab's id, the row registry and
  `nextFrameOrSoon`).
- **The tree's order**, in
  [`declarative/settingsTree.ts`](../../src/settings/declarative/settingsTree.ts):
  the notices; the callouts box (`callouts`: Callouts from your theme, Use your
  theme's callout styles, My callout types, Add new callout, Built-in
  callouts, Default fallback callout, Language); Callout style; Menus and
  commands (`menus-and-commands`: Customize right-click menu, Commands and
  shortcuts); Import and export; Version history; Danger zone; About. The
  file only puts the parts in order; each is built in its own module.
- **The signals.** The first `definitions()` call (which `addSettingTab`
  makes while the plugin loads) wires, for the plugin's whole life, the old
  page's four (`subscribeSettingsTab`: the registry, the editor's preview, an
  icon download, `css-change`), the saving status, and the language's
  download, all into the `TreeUpdater`. `plugin.register` undoes them on
  unload. They stay wired while the settings are closed because opening the
  settings draws the stored tree; the cost while closed is one signature, about
  0.1 ms (0.36 ms to build the whole tree; measured in Obsidian 1.14.5 with the
  author's test vault).
- **The signature** is one JSON string: the three callout lists'
  (`calloutListsSignature`, as the old page drew them), the whole
  `plugin.settings` (so a field added later cannot be missed; the uploaded
  pictures are left out, being large and drawn through the callouts and the
  icon signal), whether saving is paused and why, the language download, a scan
  running, and the plugins the import offer names.
- **The visit.** Obsidian has no "the tab opened" hook. The notices' box
  starts with a hidden row (`settings-visit`) whose `render` Obsidian runs
  whenever it draws the main page, which it does on every opening of the tab;
  its first run starts the visit: one version in the history per visit
  (`openVisit`), the theme's styles switch applied in the settings window
  (Obsidian 1.14 opens the settings in a window of their own), and Escape
  closing the plugin's own pickers first (`registerMenuScopeHost`, on the
  content area, beside which sub-pages are drawn). `SettingsTab.hide()` ends
  it, runs what the parts registered and disposes the kept parts.

**Measured** with 500 extra callouts (computer): opening My callout types took
260 ms and a redraw of it 320 ms; with the CPU slowed four times (a phone),
1.1 s and 0.4 s. With the usual tens of callouts both are instant.

## Parts that survive a redraw

A redraw runs a render row's cleanup, empties it and draws it again. A part
with state of its own (the "Saving is paused" banner in the middle of a
restore, a style page's preview someone is typing in) would lose it. Such parts
live in [`declarative/persistentParts.ts`](../../src/settings/declarative/persistentParts.ts):

```ts
render: guardRender("saving notice", (setting) => {
	ctx.parts.mount("saving-notice", setting.settingEl, () => buildSavingNotice(ctx));
	return () => ctx.parts.releaseLater("saving-notice");
}),
```

`mount` builds the part the first time, straight into the row (its builder
is given the parent, so an editor in it is made on the page, as it expects),
and puts the same element back on every redraw, moving it only if it is not
already there: Obsidian's redraw empties a row's controls but leaves what is
beside them, so a part kept there never moves and keeps its focus. It returns
the part itself, typed as its builder made it, so a part can carry more than
its element: the fallback picker's part holds the picker, which every draw
shows the saved value in. `get(id)` hands a kept part to another row (the
heading page's gap slider drives the preview). The cleanup
cannot tell a redraw from the user leaving the page, so it calls
`releaseLater`: 300 ms later (longer than Obsidian's 150 ms page slide), a part
whose element is back on the page is kept, and any other is disposed. Leaving
the settings calls `disposeAll()`.

## Jumping to a row

Obsidian finds a definition's element only through a private method. Rows the
plugin jumps to (the import prompt's **Import**, **Go to version history**, a
callout just duplicated) register their element under a stable name while they
are drawn, [`declarative/rowRegistry.ts`](../../src/settings/declarative/rowRegistry.ts),
and their cleanup removes it. `get(id)` answers only while the element is on
the page. A part that leads somewhere calls `ctx.jumpTo(rowId, fromKeyboard,
pagePath?)` (on `TreeContext`) and never looks for the row itself.

The jump is [`declarative/jumpToRow.ts`](../../src/settings/declarative/jumpToRow.ts),
the way Obsidian shows a settings search result:

- **The page** is opened by `app.setting.openPagePath(tabId, pagePath)`
  (Obsidian's own, since 1.13; declared optional in `src/types.ts` because it is
  not in the typings, and checked for: without it the reader stays where they
  are).
- **The row** is looked up at once and then on the next frames, for about half
  a second: a page that slides in, or a callout duplicated a moment ago, is
  drawn a little later.
- **The flash** is Obsidian's: `scrollIntoView({ block: "center" })`,
  `is-flashing` for 750 ms (app.css highlights it), and the focus on the row
  only when the jump came from a key press.

Callout rows register themselves (`calloutRowId(def)`), so
`revealCalloutRow(ctx, def)` takes the reader to a callout just made, in My
callout types (where a duplicate lands, even one of a theme's callouts).

## The main page, part by part

Each part of the tree is a function returning a box (or a row), built from a
`TreeContext` (the old page's `SettingsSectionContext` plus the row registry,
the parts store and `jumpTo`). Most rows are "name, sentence, one button":
[`declarative/rowParts.ts`](../../src/settings/declarative/rowParts.ts)'s
`buttonRow` builds them the way every blockable button in the plugin works
(ui/blockedButton.ts): while it cannot act it is dimmed (`aria-disabled`), and a
press says why instead of doing nothing. Obsidian's own `disabled` would leave
it silently dead. `pausedReason(writer)` is the usual reason.

| Box (`id`) | Rows | While saving is paused |
|---|---|---|
| Import and export (`import-export`) | Import callouts (`import-callouts`, a jump target), Export callouts | Import dimmed; Export works |
| Version history (`version-history`) | Earlier versions (`earlier-versions`, a jump target) | works; the box shows only on a host with a recovery service |
| Danger zone (`danger-zone`) | Convert to standard Markdown, Reset everything (red) | Reset dimmed; the conversion review works (it changes notes, not settings) |
| About (`about`) | About Callout Studio (action), the contact sentence (a nameless row, not searchable), Icon licenses (action), Version (the project's links; the version links to its release notes) | all work |

Manage icon libraries is an action row of its own (`icon-libraries`), placed
with the style rows; it opens the same window as Pick an icon's **Manage
libraries**, after loading the libraries and their icon counts itself
(`iconpicker/openIconLibraries.ts`).
Search words that are names (Admonition, Callout Manager, the icon libraries)
are `aliases` and are not translated. Every button calls the flow the old page
calls (`resetEverything.ts`, the import and export windows, …), so the two
pages cannot drift apart while both exist.

## The notices at the top

[`declarative/bannerRows.ts`](../../src/settings/declarative/bannerRows.ts)'s
`bannersGroup` is the first box on the main page (`banners`): one box without
a heading and two nameless render rows, which the settings search skips
(`searchable: false`). When neither shows, Obsidian hides the box.

- **Saving is paused** (`saving-notice`) shows while saving is paused or a save
  failed (`savingNeedsAttention`). It is the same notice as on the old page
  (`renderSaveStatusBanner`, with the actions `recoveryActionsOf` builds), kept
  in the parts store: while one of its actions runs its buttons are disabled,
  and a redraw must not enable them again. **Go to version history** jumps to
  `earlier-versions`.
- **The import offer** (`import-offer`) shows while `competitorsToOffer` names
  a plugin. **Import** jumps to `import-callouts`; ✕ stops offering and redraws.
  It holds no state, so it is built again on every draw, and the row's cleanup
  removes it (it sits outside the controls `setting.clear()` empties).

Both keep the plugin's own markup and look (`.cs-readonly-banner`,
`.cs-competitor-import-banner`, GAP-08), never a real `.callout`: the plugin
styles every `.callout[data-callout]` on screen, so the notice would wear the
user's own `[!warning]`. The `.cs-banners` rules in `styles.css` make the box
and the two rows invisible, so only the notices show, with the box's gap
between them.

## Fallback, language and the theme's styles

[`declarative/generalRows.ts`](../../src/settings/declarative/generalRows.ts)
draws the plugin-wide rows of the main page's first box. Each draws the old
page's controls from the old page's code (`FallbackSection.ts` and
`LanguageSection.ts` export their steps: `createFallbackPicker`,
`setFallbackCallout`, `addFallbackReset`, `drawLanguageControls`,
`applyLanguagePreference`, `missingLanguageName`, `languageDownloading`,
`retryLanguageDownload`).

| Row (`id`) | Kind | Notes |
|---|---|---|
| Default fallback callout (`fallback-callout`) | render | the callout picker is a kept part; ↺ back to the default |
| Language (`language`) | render | Obsidian's menu (`SelectDropdown`); aliases are every language's own name, so "Deutsch" finds it; says "Downloading…" and goes grey while the chosen language downloads |
| *Language* is not downloaded yet (`language-missing`) | button | shown while the chosen language is missing; Retry shows Obsidian's spinner during the download (`busy`); not searchable |
| Use your theme's callout styles (`theme-callout-styles`) | control (toggle) | key `themeCalloutStyles.enabled`; shown while the theme styles a callout or the switch is off in a community theme |

- **A plugin control as an Obsidian component.** Obsidian disables a row by
  calling `setDisabled` on each component the row made. The pickers are the
  plugin's own, so `addControlComponent(setting, control)` (`rowParts.ts`)
  registers them as components; the row's `disabled` then greys them like a
  toggle.
- **The theme's switch is on the main page** (a decision taken for the plan's
  review): the page its callouts open on is drawn by the plugin (a `page()`
  factory, GAP-15), and nothing on it is in the settings search.
- **What redraws these rows:** the signature holds the fallback id, the
  language and its download, the switch's value and what the theme styles;
  `LocaleStore.onChange` and the registry ask for the update.

`ctx.display()` in the tree means "draw the settings again": a forced
`TreeUpdater` request (§ The tab and its tree).

## The callout pages

[`declarative/calloutPages.ts`](../../src/settings/declarative/calloutPages.ts)
holds the one callout row every list uses, and the user's own callouts.

- **A callout row** (`calloutRow`) is a render row keyed `callout-<id>`, named
  by the display name, with every id the callout answers to as `aliases`, so
  the settings search finds `[!quote2]` by `quote2`. Its `render` is
  `drawCalloutRow` (the old page's row, same ✎ and ⋮), and the undo it returns
  is the row's cleanup. `calloutRowHandlers(ctx)` gives ✎ and ⋮ their flows:
  ✎ opens the editor (`openCalloutEditorFor`, which saves the callout itself,
  built-ins too) and redraws; ⋮ opens the old page's menus.
- **My callout types** (`callouts-mine`, with "12 callouts" at its end) is one
  of Obsidian's lists (`callouts-mine-list`): its own search
  (`rowMatchesQuery`: name or any id), a `+` (`addItem`: the editor for a new
  callout), the grey row while there is none, and below it a box with **Scan
  for callouts** (`scan-callouts`), a row the whole of which is the button. It
  says "Scanning…" while a scan runs (`scanRunning`, shared with the old
  page's button) and draws again when it starts and ends.
- **Add new callout** (`add-callout`) is the same action as `+`, on the main
  page.
- **Built-in callouts** (`callouts-builtin`) and **Callouts from your theme**
  (`callouts-theme`) are *lazy* pages
  ([`declarative/calloutListPage.ts`](../../src/settings/declarative/calloutListPage.ts)):
  their rows give Obsidian a factory, `page: () => new CalloutListPage(ctx,
  kind)`, a `SettingPage` that draws itself, so their callouts are not in the
  settings search and a search for "note" finds Obsidian's settings, not a
  built-in callout (GAP-15; `searchable: false` would also have taken the rows
  out of the page's own search). The page draws one `mod-list` box of the same
  callout rows, with its own search field (name or any id,
  `calloutMatchesQuery`), and on the theme page a description naming the theme
  (`p.setting-page-desc`, as Obsidian's own list pages have).
  Obsidian never draws such a page again, so while it is open it listens to
  the settings tab's own signals (`subscribeSettingsTab`) and draws its rows
  again through a `TreeUpdater` of its own (the tab's signature, held while a
  menu is open); the search field keeps its text. `hide()` stops it all. With
  no rows, Built-in says every built-in is the theme's, and the theme page
  that its theme styles none right now. The theme page's row shows only while
  the theme styles a callout; the switch beside it on the main page stays for
  when the switch itself took them away.
- **While saving is paused** the rows stay as they are and only ✎ is dimmed
  (it says why); ⋮ still opens, so Find callouts works, and the menu's own
  changes refuse with a reason. `+`, Scan and Add new callout say why.
- **What redraws them:** the callouts (the registry's change round), the
  fallback (its Default flair), light or dark mode (`css-change`), an icon
  finishing its download (a forced request) and a scan starting or ending
  (`ctx.display()`). A change that arrives while the page is open, a sync for
  instance, redraws it in place (checked in Obsidian: a callout added from
  outside appeared on the open page).

## The Saved color palettes page

[`declarative/palettesPage.ts`](../../src/settings/declarative/palettesPage.ts):
`palettesPage(ctx)` is the row that opens the page (`palettes`), with the
count at its end (`displayValue`: "4 palettes", "1 palette", nothing at
none). The page is one of Obsidian's lists (`palette-list`), so it gets, from
Obsidian, a ✕ on every row and the Delete key (`onDelete`), a `+`
(`addItem`, a last row on mobile) and the grey row while there is none
(`emptyState`). The flows are the old page's (`createPalette`, `editPalette`,
`deletePalette` in `CustomPalettesSection.ts`), so ✕ still asks, and says how
many callouts link to the palette.

- **A palette row** is a render row keyed `palette-<id>` (a rename keeps the
  key): the palette's colours first, where a list row's icon goes (Obsidian
  hides the icon slot of a list whose rows declare no `icon`, so the colours
  are their own element), then the name, then ✎ (`addBlockableIconButton`, ui/blockedButton.ts) and
  Obsidian's ✕. The colours sit outside the controls a redraw empties, so the
  row's cleanup removes them.
- **Rows are A→Z** (`sortedPalettes`), and `onDelete`'s index is a place in
  that order.
- **While saving is paused** `+`, ✕ and the Delete key say why
  (`refuseWhilePaused`), and ✎ is dimmed to Obsidian's 40% and says why
  (`addBlockableIconButton` with `pausedReason`).
- **The settings search** finds a palette by its name, under this page.
- **What redraws it:** the palettes (in the settings the signature holds), and
  light or dark mode (`css-change`; the colours are the mode on screen).

## The style pages

[`declarative/stylePages.ts`](../../src/settings/declarative/stylePages.ts):
the main page's **Callout style** box (`callout-style`) opens Heading
callout, Inline callout and Block callout (`style-heading`, `style-inline`,
`style-block`), then Saved color palettes. Each page replaces that role's
style window and is built from the same pieces (`StylePreview`, the slider
definitions of `styleSpecs.ts`, `wireStyleSlider`):

| Box | Block | Heading | Inline |
|---|---|---|---|
| (preview) | the live preview, pinned | same | same |
| (no heading) | Corner rounding, Align content with title | Corner rounding, Show fold arrow | Corner rounding, Font scale |
| Borders ↺ | Top, Right, Bottom, Left, Border thickness | same | same |
| … ↺ | Font scale: Title, Content | Title spacing: Vertical spacing, Spacing between headers | - |

- **The preview** is a kept part in a box of its own (`cs-style-preview-group`),
  pinned under the page's title bar while the controls scroll (sticky,
  `--cs-sticky-top`; not on a phone). The bar's height is measured by a
  `ResizeObserver` of the row's own window, which watches the row and looks
  the bar up on its first call: Obsidian draws a row before it puts the row's
  box on the page, so while the row draws there is no page to find the bar in
  (looking then left the preview pinned over the bar, found in Obsidian). It
  holds the demo callout (and `settingsEditOpen`) until the page is left. The heading page's preview follows the registry's change round
  itself, so the fold-arrow switch and the spacing reach its demo.
- **Switches** are Obsidian's control rows, keyed into the settings
  (`globalStyle.borderSides.top`, `headingCallouts.showFoldArrow`, …), saved by
  the tab's control binding. Border thickness shows while a side has a border.
- **Sliders** are render rows, so a drag repaints every frame; the release
  announces through `registry.settingsChanged()`, like a switch. Each has its
  own ↺ before its value, and a box of several controls has ↺ in its heading
  (made once, as Obsidian makes a box's heading buttons, so it reads the
  settings anew when pressed). A ↺ with nothing to reset is dimmed
  (`aria-disabled`, which Obsidian draws at 40%).
- **The settings search** finds every control by its name and by words in the
  slider definitions ("radius", "border", "title size").
- **While saving is paused** every control's row is `disabled` (greyed), and a
  box's ↺ says why.

## Commands and shortcuts

[`declarative/commandsPage.ts`](../../src/settings/declarative/commandsPage.ts):
`commandsPage(ctx)` is the row that opens the page (`commands`), in place of
the window of the same name. The page opens with a sentence about ⊕
(`commands-intro`, `pageIntroBox`; left out on a phone, which hides ⊕), then:

- **Your commands** (`commands-mine`), one of Obsidian's lists: `+` (the
  command editor), Obsidian's ✕ and Delete key (`deleteCommand` asks first),
  the grey row while there is none. A row (`command-<id>`) is the callout's
  icon (our element before the row, removed by the row's cleanup), the
  command's name, its shortcuts, ⊕ and ✎; a command whose callout the theme
  suspended, or which is gone, says so in its description.
- **Built-in commands** (`commands-builtin`): a row per built-in command
  (`command-<fixed id>`) with its shortcuts, ⊕ and a switch
  (`setFixedCommandEnabled`, which registers or unregisters it), and ↺ in the
  heading that turns them all back on (dimmed while all are on). A command
  switched off keeps its row as it is (S8-21): only its shortcuts and ⊕ go.
- **Shortcuts** are drawn as Obsidian's Hotkeys page draws them
  (`addObsidianHotkeyChips`: `div.setting-command-hotkeys >
  span.setting-hotkey`, "Blank" as `mod-empty`), without the ✕ each has there
  (S8-19). ⊕ (`addHotkeyExtraButton`) opens the Hotkeys page searched for the
  command, and wears `mod-hotkeys`, which Obsidian hides on a phone (S8-20).
- **The flows** are the window's own (`command/commandFlows.ts`).
- **While saving is paused** `+`, ✕ and ↺ say why, ✎ is dimmed and says why,
  and the built-in rows are greyed.
- **What redraws it:** the commands and the built-ins' switches (in the
  settings), and the registry (a callout gone or taken by the theme). A
  shortcut bound on the Hotkeys page needs nothing: coming back to the tab
  draws its rows again, and the chips are read as they are drawn.

## Customize right-click menu

[`declarative/menuPage.ts`](../../src/settings/declarative/menuPage.ts):
`menuPage(ctx)` is the row that opens the page (`right-click-menu`), laid out
like Obsidian's Ribbon settings: an opening sentence (`menu-intro`,
`pageIntroBox`), then for each role (heading, inline, block) two of
Obsidian's lists:

- **The role's menu** (`menu-<role>`): the items it shows, in order, each a
  plain row with its icon (`ITEM_ICON`; Obsidian draws a list row's icon only
  on plain and action rows, and hides every icon slot in a box whose rows have
  none), Obsidian's drag handle and Alt+↑/↓ (`onReorder`), and ✕ (`onDelete`),
  which hides it. ↺ in the heading puts the role back as shipped. It is not
  dimmed: Obsidian makes a box's heading buttons once, and plain rows have no
  `render` to repaint it, so a press with nothing to reset changes nothing.
- **Hidden from the … menu** (`menu-<role>-hidden`), shown only while the
  role hides something: the hidden items as action rows (Obsidian's accent
  text); a press brings one back at the end of the menu. Each role's heading is
  its own (M6), so no two boxes share a key.
- **Rows are not searchable** (decision 12): the settings search finds the
  page by its name only.
- **Every change** goes through `menuItems.ts` (`setMenuItemEnabled`,
  `moveMenuItem`, `defaultMenuItems`), the same as the window's, reads the live
  settings when pressed, and is saved at once.
- **While saving is paused** ✕, a hidden item and ↺ say why, and a drag says
  why and draws the page again, which puts the row Obsidian moved back.

## Read-only while saving is paused

While saving is paused a change would live only in memory, so the page takes
none. Obsidian's `disabled` only changes the look, and a list's drag, Delete
key and Alt+↑/↓ still reach their callbacks, so
[`declarative/pausedGuards.ts`](../../src/settings/declarative/pausedGuards.ts)
offers two pieces, used together:

- `disabledWhilePaused(writer)` as a row's `disabled`, for the look;
- `refuseWhilePaused(writer, callback, putBack?)` around every callback that
  changes something. While paused it shows the usual notice (`pausedGuard.ts`)
  and runs `putBack` instead, to undo what is already on screen: after a
  pointer drag Obsidian has moved the row before `onReorder` is called.

A button row does neither: it dims and explains (`buttonRow`, above).

## Never throwing

[`declarative/safeTree.ts`](../../src/settings/declarative/safeTree.ts):

- `buildTreeSafely(build, fallback)` - `addSettingTab` calls `update()` while
  the plugin loads, so an error while building the tree would stop the plugin
  from loading. On an error it logs and returns `fallback` (`[]` while
  `display()` still exists, which makes Obsidian draw the old tab).
- `guardRender(name, render)` - an error in one `render` would stop the rest of
  the page drawing. Every render row is wrapped; a failing row keeps its name,
  and the console names it.

## Testing the tree

[`tests/support/declarativeRenderer.ts`](../../tests/support/declarativeRenderer.ts)
is Obsidian's renderer, rebuilt step for step with the stub's `Setting` and
`SettingGroup` (each function names the app.js function it copies), and
`tests/declarativeRenderer.test.ts` pins its behaviour. Use it like this:

```ts
const tab = new CalloutStudioSettingsTab(app, plugin);
const harness = new DeclarativeHarness(tab); // update() now also draws
tab.update();
harness.row("Default fallback callout");     // a drawn row
harness.openPage(["callouts-mine"]);          // a sub-page, by page ids
searchSettings(tab.settingItems, "palette");  // what Search settings… finds
```

What it leaves out: the pointer drag engine, control types other than toggle
and slider, animations and focus moves. Those are checked in the real app.
