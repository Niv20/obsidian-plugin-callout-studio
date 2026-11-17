# Declarative settings - the tab as a tree Obsidian draws

Since Obsidian 1.13 a settings tab can describe itself as data instead of
drawing itself: `getSettingDefinitions()` returns a tree of rows, boxes, lists
and pages, and Obsidian draws it, keeps it up to date, and indexes every row
for the **Search settings…** field. Callout Studio's whole tab is that tree,
so a search for "palette", "fallback" or one of the user's own callouts lands
on the right row (the plan's *Searchable Settings* stage).

**Status.** The tab draws from the tree, built under
[`src/settings/declarative/`](../../src/settings/declarative/)
(§ The tab and its tree). The tab has no `display()` of its own any more
(the old page drawn section by section was deleted in the *Clean Sweep*):
Obsidian's base `display()` draws the tree too, and a tree that failed to
build is replaced by one row that says so (§ Never throwing). Each part is
tested through a copy of Obsidian's renderer (§ Testing the tree), and the
whole was checked in Obsidian 1.14.5 on a computer and in phone and tablet
emulation.

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
- **A cleanup also runs when the reader leaves the page, and the page is still
  on screen.** `closePage` runs every row's cleanup first and only then slides
  the page away (150 ms). So a cleanup must not take anything visible off its
  row: an icon removed there vanished from every row of My callout types the
  moment the back arrow was pressed, for the length of the slide plus the time
  the hundreds of cleanups took. What a row adds beside its controls is reused
  by the next draw instead (the callout row's icon, `rowIconElement` in
  `CalloutRowRenderer.ts`), or kept alive by `releaseLater`
  ([parts that survive a redraw](#parts-that-survive-a-redraw)).
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
  takes the box's and the row's look away. Called without `text` it is the
  same box with nothing in it, which the right-click menu page fills with its
  repainting row. No page opens with a sentence now.
- **Lists** (`type: "list"`) add, when asked: an empty-state row; `addItem`, a
  `+` in the heading on a computer and a last `+ Name` row on mobile; `onDelete`,
  a ✕ on every row and the Delete key; `onReorder`, a drag handle and
  Alt+↑/↓. The heading buttons, the search field and these handlers are made
  once, when the box is first drawn, and read the newest definition when used.
- **A box's own search field** (`search`, 1.13.1) appears only if the box had
  rows when first drawn, and an `update()` that finds the box under the same
  key (`type:id:<id>`) changes it in place and never adds one (read in app.js
  1.14.5: the field is made only where a box is created). A list that can go
  from no rows to some while the tab is open (My callout types, after a scan)
  must therefore change its `id` with that, so Obsidian draws a new box.
  Rows marked `searchable: false` are never filtered by
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
hands the finished tree over, once, with no cast: a type with extra fields is
accepted where Obsidian's is asked for, and TypeScript still checks the rest.

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
  list (`.cs-combobox-popup` without its closed class), a
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
  the notices; the callouts box (`callouts`: Callouts from your theme, My
  callout types, Built-in callouts, Default fallback callout); Colors and icons
  (`colors-and-icons`: Saved color palettes and Icon libraries, two pages);
  Global styling (the three style pages);
  Editor (`menus-and-commands`, the id from when it was called Menus and
  commands: Autocomplete and metadata, Customize right-click menu, Commands and
  shortcuts); Website (`website`: its one row, Publish to the web); Import
  and export; Danger zone (its first row is
  Restore an earlier version); the language notice (`language-box`, hidden
  while nothing is missing); the footer (`footer`: the language and the links,
  as tiles of an icon and a name). The file only puts the parts in order; each is built in its own
  module. It also gives every box of the finished tree, at every depth, the
  plugin's box class (`cs-box`, `PLUGIN_BOX_CLASS` in `rowParts.ts`,
  `markBoxes`), which the rules that should reach only the plugin's rows are
  keyed on (no rule uses it for alignment: rows in such a box are laid out as core lays them out). Before
  2026-10-27 the first box also held the theme's switch and Add new callout, and
  Language was its last row.
- **The signals.** The first `definitions()` call (which `addSettingTab`
  makes while the plugin loads) wires, for the plugin's whole life, the old
  page's four (`subscribeSettingsTab`: the registry, the editor's preview, an
  icon download, `css-change`), the saving status, the language's
  download, and the icon pack store's `onChange` (the Icon libraries row's
  count), all into the `TreeUpdater`. `plugin.register` undoes them on
  unload. They stay wired while the settings are closed because opening the
  settings draws the stored tree; the cost while closed is one signature, about
  0.1 ms (0.36 ms to build the whole tree; measured in Obsidian 1.14.5 with the
  author's test vault).
- **The signature** is one JSON string: the three callout lists'
  (`calloutListsSignature`), the whole
  `plugin.settings` (so a field added later cannot be missed; the uploaded
  pictures are left out, being large and drawn through the callouts and the
  icon signal), whether saving is paused and why, the language download, a scan
  running, the plugins the import offer names, the services the website offer
  names, and the Icon libraries row's count.
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
  (Obsidian's own, since 1.14; declared optional in `src/types.ts` because it is
  not in the typings, and checked for). On 1.13.x, which the plugin still
  supports, the reader stays on the page that is open: the notices' jumps work,
  because their rows are on the main page with them, but a callout duplicated
  from another page is not shown. Checked on a real 1.13.4 (2026-10-25).
- **The row** is looked up at once and then on the next frames, for about half
  a second: a page that slides in, or a callout duplicated a moment ago, is
  drawn a little later.
- **The flash** is Obsidian's: `scrollIntoView({ block: "center" })`,
  `is-flashing` for 750 ms (app.css highlights it), and the focus on the row
  only when the jump came from a key press.

Callout rows register themselves (`calloutRowId(def)`), so
`revealCalloutRow(ctx, def)` takes the reader to a callout just made, in My
callout types (where a duplicate lands, even one of a theme's callouts).

**A page's row cannot register itself**: Obsidian draws it from the `page`
definition, which has no `render` and hands out no element. No page's row is
a jump target now. Until 2026-11-16 the Publish to the web row was one (it
opened a page), and a row with nothing on screen after it (`pageRowAnchor`:
`visible: false`, not searchable) registered the element before its own:
rows are drawn in order and a hidden row is still drawn. That row now opens a
sidebar panel, so it is an ordinary button row and registers itself
(`MAIN_PAGE_ROWS.website`); the website offer's **Show me** scrolls to it.

## The main page, part by part

Each part of the tree is a function returning a box (or a row), built from a
`TreeContext` (the shared `SettingsContext` of
[`sections/types.ts`](../../src/settings/sections/types.ts) plus the row
registry, the parts store and `jumpTo`). Most rows are "name, sentence, one button":
[`declarative/rowParts.ts`](../../src/settings/declarative/rowParts.ts)'s
`buttonRow` builds them the way every blockable button in the plugin works
(ui/blockedButton.ts): while it cannot act it is dimmed (`aria-disabled`), and a
press says why instead of doing nothing. Obsidian's own `disabled` would leave
it silently dead. `pausedReason(writer)` is the usual reason. A row can carry a
small grey tag after its name (`tag`, drawn by `betaBadge.ts`; Publish to the web
has **Beta**), which the row's cleanup takes away before the next draw.

| Box (`id`) | Rows | While saving is paused |
|---|---|---|
| Website (`website`) | Publish to the web (`publish-to-web`, a jump target): opens the Publish to the web panel in the sidebar ([below](#the-website-row)) | works |
| Import and export (`import-export`) | Import callouts (`import-callouts`, a jump target), Export callouts | Import dimmed; Export works |
| Danger zone (`danger-zone`) | Restore an earlier version (`earlier-versions`): a page, `versionHistoryPage.ts`, drawn by the plugin; the saving notice's **Go to version history** opens it (`openPagePath`, so not on 1.13.x, where the button is left out); the row shows only on a host with a recovery service. Convert to standard Markdown, Reset everything (Obsidian's Log out look: `setDestructive()`, the red every red button wears) | The version page works (browsing); Reset dimmed; the conversion review works (it changes notes, not settings) |
| Footer (`footer`, no heading) | one render row, not searchable (`footerGroup.ts`): a line of tiles (`footer-tiles`, `cs-footer-row`), each an icon with its name beside it and no tooltip: the language (a globe and the language in use, which opens the menu), Open an issue, Source code, License (opens `LicenseModal`), and the version | the globe is disabled; the rest works |

The icon libraries are one list
([`iconpicker/IconLibrariesView.ts`](../../src/settings/iconpicker/IconLibrariesView.ts),
16 § `IconLibrariesModal`) in two frames: the **Manage icon libraries** window
that Pick an icon's **Manage libraries** opens, and the **Icon libraries** page
of the Colors and icons box (below). The window stays with the picker, because
the picker and the callout editor under it are windows that cover the settings.
The shapes tried before this one:

- A settings row that opened the window, until 2026-10-27, removed as a second
  door to the same window.
- A settings **page** (`icon-libraries`, 2026-10-29) and no window, which could
  in practice be reached only from the picker: touching the page meant closing
  the picker and the editor under it, and with them the icon the person had
  just chosen and not yet saved.
- The row again (2026-11-02 to 2026-11-17), opening the same window through
  the picker's opener, refused while a callout editor was open. It gave way to
  the page at Niv's ask: the settings show a page, as every other box of them
  does, and the picker keeps its window. Unlike the 2026-10-29 page, this one is
  drawn by the code the window draws with, so the two cannot disagree.

Search words that are names (Admonition, Callout Manager)
are `aliases` and are not translated. Every button calls a flow of its own
module (`resetEverything.ts`, the import and export windows, …), never a copy.

## The notices at the top

[`declarative/bannerRows.ts`](../../src/settings/declarative/bannerRows.ts)'s
`bannersGroup` is the first box on the main page (`banners`): one box without
a heading and three nameless render rows, which the settings search skips
(`searchable: false`). When none shows, Obsidian hides the box.

- **Saving is paused** (`saving-notice`) shows while saving is paused or a save
  failed (`savingNeedsAttention`). It is the notice the callout editor shows too
  (`renderSaveStatusBanner`, with the actions `recoveryActionsOf` builds), kept
  in the parts store: while one of its actions runs its buttons are disabled,
  and a redraw must not enable them again. **Go to version history** jumps to
  `earlier-versions`.
- **The import offer** (`import-offer`) shows while `competitorsToOffer` names
  a plugin. **Import** jumps to `import-callouts`; ✕ stops offering and redraws.
  It holds no state, so it is built again on every draw, and the row's cleanup
  removes it (it sits outside the controls `setting.clear()` empties).
- **The website offer** (`web-offer`) shows while `webServicesToOffer` names a
  service the vault looks published with
  ([Import & export § The offer on the settings page](15-import-export.md#the-offer-on-the-settings-page)).
  **Show me** jumps to `publish-to-web`, the Publish to the web row, as **Import**
  jumps to its row; ✕ stops offering and redraws. It is drawn like the import
  offer, by the same builder
  ([`offerBanner.ts`](../../src/settings/offerBanner.ts)).

**One offer at a time** (`webOfferShows`). An offer is an invitation, and two
invitations at once are a queue the reader has to sort. So the website offer
waits while saving needs attention - a problem comes before an invitation -
and while the import offer is up, since callouts are brought in before they
are published. And one offer speaks for everything of its kind: several
plugins to import from, or several services, are one sentence with a list
(`nameList`), never a notice each. The saving notice and the import offer may
still show together, as they always have: the first is a problem, not an
offer.

All three are drawn in the same box, built by `createBanner`
([`bannerBox.ts`](../../src/settings/bannerBox.ts)) and styled by the one
`.cs-banner` rule, so the box changes in one place
([Settings UI § Saving-status banner](16-settings-ui-and-modals.md#saving-status-banner)).
Inside the box each keeps its own layout class (`.cs-readonly-banner`, or
`.cs-competitor-import-banner` - the class both offers wear, named when the
import offer was the only one - GAP-08). None is a real `.callout`: the plugin
styles every `.callout[data-callout]` on screen, so the notice would wear the
user's own `[!warning]`. The `.cs-banners` rules in `styles.css` make the box
and its rows invisible, so only the notices show, with the box's gap between
them.

## Fallback, language and the theme's styles

[`declarative/generalRows.ts`](../../src/settings/declarative/generalRows.ts)
draws the plugin-wide row of the main page's first box, and what goes with the
language. The controls come from `sections/` (`fallbackPicker.ts` and
`languagePicker.ts` export their steps: `createFallbackPicker`,
`setFallbackCallout`, `addFallbackReset`, `drawLanguageMenu`,
`applyLanguagePreference`, `languageDownloading`). The language itself is not a
row: `drawLanguageMenu` draws the footer's globe (`footerGroup.ts`) and
`languageChooser(ctx)` is the paused-guarded pick it calls. A language that has
to be downloaded adds nothing to the page: it is told in notices (see
[Localization § what happens when a translation download fails](17-i18n.md#what-happens-when-a-translation-download-fails)).

| Row (`id`) | Kind | Notes |
|---|---|---|
| Default fallback callout (`fallback-callout`) | render | the callout picker is a kept part; ↺ back to the default |
- **A plugin control as an Obsidian component.** Obsidian disables a row by
  calling `setDisabled` on each component the row made. The pickers are the
  plugin's own, so `addControlComponent(setting, control)` (`rowParts.ts`)
  registers them as components; the row's `disabled` then greys them like a
  toggle.
- **The fallback picker is as wide as the callout's name.** Like every
  dropdown (see [Settings UI § How an input field focuses](16-settings-ui-and-modals.md#how-an-input-field-focuses)),
  it fits its words, up to Obsidian's 250px cap for a combobox, and its reset
  arrow follows it at the row's end (`.cs-reset-setting` keeps the arrow from
  shrinking). Until 2026-11-01 rows with a picker and a reset arrow shared a
  fixed 260px column, and the fallback row a 200px one (`cs-fallback-setting`).
  A row too narrow for its label and its picker stacks them, and the picker
  then takes the line.
- **The theme's switch is not here any more.** It was a `control` row on the
  main page, because the page its callouts open on is drawn by the plugin (a
  `page()` factory, GAP-15) and nothing on such a page is in the settings
  search. Since 2026-10-27 it is the top row of that page
  ([`themeStylesSwitch.ts`](../../src/settings/declarative/themeStylesSwitch.ts),
  § The callout pages), at Niv's ask; the cost is that the settings search no
  longer finds the switch itself, only the page, by its name (the search reads
  `name`, `desc` and `aliases` of the definitions inside pages, never those of
  a page's own entry, so an alias on the entry would do nothing; read in
  app.js 1.14.5, `coe`/`uoe`).
- **What redraws these rows:** the signature holds the fallback id, the
  language and its download, the switch's value and what the theme styles;
  `LocaleStore.onChange` and the registry ask for the update.

`ctx.redraw()` in the tree means "draw the settings again": a forced
`TreeUpdater` request (§ The tab and its tree).

## The callout pages

[`declarative/calloutPages.ts`](../../src/settings/declarative/calloutPages.ts)
holds the one callout row every list uses, and the user's own callouts.

- **A callout row** (`calloutRow`) is a render row keyed `callout-<id>`, named
  by the display name, with every id the callout answers to as `aliases`, so
  the settings search finds `[!quote2]` by `quote2`. Its `render` is
  `drawCalloutRow` (with its ✎ and ⋮), and the undo it returns
  is the row's cleanup. `calloutRowHandlers(ctx)` gives ✎ and ⋮ their flows:
  ✎ opens the editor (`openCalloutEditorFor`, which saves the callout itself,
  built-ins too) and redraws once it closes, but only when it saved or the
  registry changed while it was open (`redrawAfterEditor`, the `+` too): a
  redraw rebuilds every row of the page, every callout the user has on My
  callout types, so an editor closed without a change used to close slowly
  there and at once over the built-ins. ⋮ opens the row menus
  (`CalloutRowActions.ts`, `themeRowActions.ts`).
- **My callout types** (`callouts-mine`, with "12 callouts" at its end, or
  "None") is one of Obsidian's lists (`callouts-mine-list`): its own search
  (`rowMatchesQuery`: name or any id), a `+` (`addItem`: the editor for a new
  callout; the main page has no Add new callout of its own since 2026-10-27),
  the grey row while there is none, and below it a box with **Scan for
  callouts** (`scan-callouts`), a row the whole of which is the button. It
  says "Scanning…" while a scan runs (`scanRunning`, shared with the old
  page's button) and draws again when it starts and ends. Every count at the
  end of a row that opens a page (`countValue`) says "None" at none, with the
  word the version comparison already uses
  (`recovery.details.value.none`), so no row ends in a blank.
- **A search that finds nothing says so, with the brush mascot.** Obsidian's
  list search only hides the rows that do not match (read in app.js 1.14.5:
  the box's `onChange` toggles each row by `match`, and the list's
  `emptyState` shows only for a list with no rows at all), so a search for
  something that is not there left an empty box. The list's last row,
  `callouts-mine-no-matches`, is a nameless render row with `visible: false`
  (hidden after every draw, and kept out of the settings search, which skips
  an invisible row), and the list's `match` (`matchesSearch`) answers `true`
  for it exactly when something is searched for and no callout of the user's
  matches: Obsidian then shows it, as it shows any row `match` accepts, and
  hides it again when the query matches something or is emptied. After a draw
  with a query typed Obsidian runs the search again, which shows the row
  again. It reads the live callouts, not the ones of the draw its `match` came
  from (Obsidian keeps the first draw's `match`). Its `render`
  (`drawNoMatchesRow`) puts [`NoMatchesRow`](../../src/settings/declarative/noMatchesRow.ts)
  in it: Obsidian's grey empty-list row (`mod-empty-state`) with the words "No
  callout matches “query”." (the callout picker's own sentence,
  `calloutPicker.noMatches`) and the mascot above them, sad, looking around
  while the query changes (`SearchMascot`, as in the icon picker); a listener on
  the list's search input, which runs after Obsidian's own, shows or puts
  away the words and the mascot by whether Obsidian showed the row. The row
  exists only while the user has a callout of their own: with none the list
  has no search, and its grey row is the empty state. The list's `id` is
  `callouts-mine-list` while there are callouts and `callouts-mine-list-empty`
  while there are none (`CALLOUT_PAGES.mineList`, `mineListEmpty`): the first
  callout, from **Scan for callouts** for instance, then makes a new box that
  has its search field, and the last one going takes the field away with the
  box, so the page never needs to be left and opened again to get it.
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
  (`p.setting-page-desc`, as Obsidian's own list pages have). A search that
  finds nothing shows the same `NoMatchesRow`, the last row of the box,
  hidden until then (the page filters its own rows, so it simply shows or
  hides it). The search field is shown only while there are rows to search.
  Obsidian never draws such a page again, so while it is open it listens to
  the settings tab's own signals (`subscribeSettingsTab`) and draws its rows
  again through a `TreeUpdater` of its own (the tab's signature, held while a
  menu is open); the search field keeps its text. `hide()` stops it all. With
  no rows, Built-in says every built-in is the theme's, and the theme page
  that its theme styles none right now. While the switch is off the theme page
  is the switch alone: the box of rows is hidden and no line explains why.
- **The theme page starts with the switch.** "Use your theme's callout
  styles" is the page's top row, in a box of its own above the description and
  the list ([`themeStylesSwitch.ts`](../../src/settings/declarative/themeStylesSwitch.ts)):
  Obsidian's own toggle, saved the way the tab saves a declarative control
  (`writeControlValue` with the registry's `settingsChanged()`, never
  `saveData`), refused with the paused notice while saving is paused, and put
  back when refused. The page's signature includes the setting and the paused
  state, so a change from another device redraws it. The description (the
  sentence naming the theme) is taken out of the page, not hidden, while there
  are no rows, because Obsidian spaces two boxes by `.setting-group +
  .setting-group` and a hidden sentence between them would take the space away.
  The row that opens the page (`themeCalloutsPage`) shows while the theme
  styles a callout **or** while the switch is off in a community theme (the
  switch took the callouts away, and the page has to stay reachable to bring
  them back), with the count at its end, or **Off** (`recovery.details.value.off`)
  while the switch is off.
- **While saving is paused** the rows stay as they are and only ✎ is dimmed
  (it says why); ⋮ still opens, so Find callouts works, and the menu's own
  changes refuse with a reason. `+` and Scan say why.
- **What redraws them:** the callouts (the registry's change round), the
  fallback (its Default flair), light or dark mode (`css-change`), an icon
  finishing its download (a forced request) and a scan starting or ending
  (`ctx.redraw()`). A change that arrives while the page is open, a sync for
  instance, redraws it in place (checked in Obsidian: a callout added from
  outside appeared on the open page).

## The Saved color palettes page

[`declarative/palettesPage.ts`](../../src/settings/declarative/palettesPage.ts):
`palettesPage(ctx)` is the row that opens the page (`palettes`), with the
count at its end (`displayValue`: "4 palettes", "1 palette", nothing at
none). The page is one of Obsidian's lists (`palette-list`), so it gets, from
Obsidian, a ✕ on every row and the Delete key (`onDelete`), a `+`
(`addItem`, a last row on mobile) and the grey row while there is none
(`emptyState`). The flows are `createPalette`, `editPalette` and
`deletePalette` in `sections/paletteFlows.ts`, so ✕ asks first, and says how
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

## The Colors and icons box

`settingsTree.ts`'s `colorsAndIconsBox` (`colors-and-icons`, heading **Colors
and icons**) sits between the callouts box and Global styling and holds what a
callout's colour and icon come from: the **Saved color palettes** page above,
and the **Icon libraries** page. Before 2026-11-02 the palettes were a row of
the callouts box, above Default fallback callout; their ids (`palettes`,
`palette-list`) did not change with the move.

[`declarative/iconLibrariesPage.ts`](../../src/settings/declarative/iconLibrariesPage.ts):
`iconLibrariesPage(ctx)` is the row that opens the page (`icon-libraries`),
named **Icon libraries**, with no `desc`, like Saved color palettes above it
(until 2026-11-17 it had a sentence, which the row above lacked). At its end
(`displayValue`, `iconLibrariesValue`) is how many libraries Pick an icon
offers here out of all of them: "4 of 9 available", or "All 9 available" when
the two are equal. The word is the page's own (its first group is Available
libraries), and the total is every library the build knows, so a library a
later release adds shows at once as one more to download. The count is per
device. It is drawn from what the pack store knows without reading the
files (13 § Knowing what is on disk without reading it), and while that is not
known yet the row shows no count at all, never a guess that would change in
front of the reader. The signature reads the value and the pack store's
`onChange` is one of the tab's signals, so a download, a deletion or a look
that changes the count draws the row again, and nothing else does. Going back
from the page redraws the main page from the stored tree, so the count there
is already the new one. The page draws
itself (`page: () => new IconLibrariesPage(ctx)`, a `SettingPage`, like Built-in
callouts): its list drags, slides and follows a download as it runs, and
Obsidian drawing an `items` page again row by row on every `update()` would
undo all three. `display()` reads the pack files back from disk and counts the
icons of every library (`iconpicker/sourceCounts.ts`, the same counting the
picker does in the background as it opens), both at once, and only then draws
the list (`IconLibrariesView`) under Obsidian's page sentence
(`setting-page-desc`). A page left before that is done draws nothing
(`generation`); `hide()` takes the list away and stops it following the pack
files, and a deletion under way goes on by itself.

- **No callout is being edited behind it**, but one can be beside it: in
  Obsidian 1.14 the settings are a window of their own, and an editor can be
  opened from a note. Pick an icon hands the window the icon the editor holds
  unsaved (`editing`) so that deleting the library it came from asks first (13
  § The callout being edited counts as a user). The page has no way to learn
  it, so while `plugin.settingsEditOpen` is true (the flag the callout editor
  and the two previewing modals raise, also true for a moment after the editor
  closes while its save is still running) the list deletes no library and a
  press says **Finish with the callout editor first** (16 § `IconLibrariesModal`).
  Until 2026-11-17 the row refused to open the window at all then.
- **While saving is paused** the page opens as ever. The list guards what needs
  it (deleting a library callouts use) and says why, as it does in the window.
- **The settings search** finds the page by its name only. A page that draws
  itself is not indexed, and pages are found by name (§ How Obsidian draws the
  tree; an alias on a page's own entry does nothing, § Fallback, language and
  the theme's styles). Until 2026-11-17 the row
  was also found by a sentence of its own and the libraries' own names (Tabler, Font
  Awesome, and the rest); that is the cost of the page.
- **Not a jump target.** A page's row cannot register itself (§ Jumping to a
  row), and nothing jumped to the old row.
- **A count, per device.** Until 2026-11-17 the row had no end value, because
  which libraries are on this device differs between devices. It has one now,
  and it is just as per device: the guide says so.

## The style pages

[`declarative/stylePages.ts`](../../src/settings/declarative/stylePages.ts):
the main page's **Global styling** box (`callout-style`) opens Heading
callout, Inline callout and Block callout (`style-heading`, `style-inline`,
`style-block`). Each page replaces that role's
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
  `ResizeObserver` of the preview's own window, which watches the preview and
  finds its box and its page's bar each time it is called. Two things make
  that necessary, both found in Obsidian, where the preview ended up pinned
  over the bar: Obsidian draws a row before it puts the row's box on the page,
  so while the preview is built there is no page to find the bar in; and a
  kept preview moves into the new page's row when the reader comes back before
  it is let go, so the box and the bar it was first given are gone. It holds
  the demo callout (and `settingsEditOpen`) until the page is left. The heading page's preview follows the registry's change round
  itself, so the fold-arrow switch and the spacing reach its demo.
  - **It rests where it locks.** Obsidian leaves `--size-4-3` between the title
    bar and the first box (the margin of `.setting-page-content`). Outside the
    box that gap made the preview slide up 12px on the first scroll, before it
    stuck. The box takes the gap into itself instead (`margin-top: calc(-1 *
    var(--size-4-3))` plus the same as `padding-top`, opaque), so its resting
    top is its stuck top and nothing moves. A phone has no title bar, so the
    box is static there with neither. If Obsidian changes that margin, this
    pair has to follow it, or the slide comes back.
  - **Rows fade out under it.** A `::after` strip on the box (`top: 100%`, its
    full width, `--size-4-4` tall, `pointer-events: none`) runs from
    `--settings-background` to transparent, so rows scrolling up under the
    preview dissolve instead of being cut by its bottom edge. It is shorter
    than the `--size-4-6` gap to the next box, so at rest it lies over bare page
    and shows nothing. Off on a phone, where the preview is not pinned.
  - **It is only as tall as its sample.** The editor's `min-height`s (for a
    callout being edited) are zeroed under `.cs-style-preview`, the samples are
    one short line (`editor.loremIpsumShort`), the block sample's blank caret
    line is collapsed (`collapseTrailingBlankLine`, which
    `themeRowActions.test.ts` lists as the second file allowed to opt in), and
    `.cs-live-preview-container` is capped at `25vh` before it scrolls inside
    itself. Measured in Obsidian 1.14.5 at 900×700: heading 263 → 119px, block
    193 → 121px, inline 138 → 71px.
  - **The spacing demo takes the box's place, not more room.** `showGapDemo()`
    writes the box's current height into `--cs-style-preview-height` before the
    swap and `hideGapDemo()` removes it; the stacked headers scroll inside that
    height (`max-height: 100%`), so holding the slider never moves the page.
- **Switches** are Obsidian's control rows, keyed into the settings
  (`globalStyle.borderSides.top`, `headingCallouts.showFoldArrow`, …), saved by
  the tab's control binding. Border thickness shows while a side has a border.
- **Sliders** are render rows, so a drag repaints every frame; the release
  announces through `registry.settingsChanged()`, like a switch. Each has its
  own ↺ before its value, and a box of several controls has ↺ in its heading
  (made once, as Obsidian makes a box's heading buttons, so it reads the
  settings anew when pressed). A ↺ with nothing to reset is
  invisible (`paintResetIdle`, `ui/resetArrow.ts`: `cs-reset-idle`,
  `visibility: hidden`, so it keeps its room and a slider's track does not jump
  when it appears), as every ↺ in the plugin is (16 § Scoped reset controls);
  `aria-disabled` is still set. Until 2026-10-27 it was only dimmed (Obsidian
  draws `aria-disabled` at 40%).
- **The settings search** finds every control by its name and by words in the
  slider definitions ("radius", "border", "title size").
- **While saving is paused** every control's row is `disabled` (greyed), and a
  box's ↺ says why.

## Autocomplete and metadata

One page, [`declarative/autocompletePage.ts`](../../src/settings/declarative/autocompletePage.ts)
(page `autocomplete-and-metadata`), opened from the first row of the Editor
box. It holds two boxes, one for each place in a callout's first line. The two
lists that open while a callout is typed are switched on and off apart:

- **After `[!`** (box `callout-autocomplete-settings`, headed **Callouts**,
  [`declarative/autocompleteRows.ts`](../../src/settings/declarative/autocompleteRows.ts)):
  **Callout autocomplete** and **Include your theme's callouts**
  (`callout-autocomplete`, `suggest-theme-callouts`), saved at
  `suggestions.callouts` and `suggestions.themeCallouts`.
- **After `|`** (box `metadata-settings`, headed **Metadata**,
  [`declarative/metadataRows.ts`](../../src/settings/declarative/metadataRows.ts)):
  Metadata colors (`metadataColors.enabled`), Metadata autocomplete
  (`suggestions.metadata`), Include your theme's words
  (`suggestions.themeMetadata`), Your words.

The recovery details window shows all of these under one section of the same
name (`editorItems` in `recoverySections.ts`).

Common to both:

- **The switches** are `control` toggles built by `rowParts.ts`'s `toggleRow`,
  saved through the tab's `setControlValue` (controlBinding.ts), greyed while
  saving is paused. Every row is searchable.
- **`visible`**: a row that would change nothing now is hidden - a theme
  switch while its list is off, or while the theme adds no callouts
  (`registry.getThemeProvided()`) or reacts to no word (a `theme` source in
  `metadataCatalog.sourcesNow()`), and Your words while Metadata
  autocomplete is off. A theme switch that is off always shows (while its list
  is on), so it can be turned back on after a theme change. The tab redraws on
  `css-change`, so a theme switch comes and goes with the theme. Metadata
  colors always shows: it is about how notes look.
- **Your words** is a render row holding the callout editor's IDs field
  (`ui/TagInput.ts`) with its word options: `sanitize`
  (`sanitizeMetadataWordInput`), `separators` (whitespace, `|`, commas: a key
  among them commits the word, a paste and a committed text are split on
  them), `messages` (word wording instead of ID wording), the caps from
  `constants.ts`. It is a persistent part mounted in `setting.settingEl`,
  beside the controls, not in them: a redraw empties the controls, and a part
  kept there never moves, so a focused pill keeps the focus (the tree updater
  already waits while the text field has it). styles.css hides the empty
  controls and widens the field where Obsidian stacks the row
  (`.cs-metadata-words-setting`). A change is saved through
  `registry.settingsChanged()`; while saving is paused it is refused and the
  saved words are put back. A draw sets the pills again only when the saved
  list differs (another device's).

## Commands and shortcuts

[`declarative/commandsPage.ts`](../../src/settings/declarative/commandsPage.ts):
`commandsPage(ctx)` is the row that opens the page (`commands`), in place of
the window of the same name. The page is two boxes:

- **Your commands** (`commands-mine`), one of Obsidian's lists: `+` (the
  command editor), Obsidian's ✕ and Delete key (`deleteCommand` asks first),
  the grey row while there is none. A row (`command-<id>`) is the callout's
  icon (our element before the row, removed by the row's cleanup), the
  command's name, its shortcuts, ⊕ and ✎; a command whose callout the theme
  suspended, or which is gone, is dimmed (`is-command-paused`) and wears a
  short tag after its name (`cs-paused-tag`: "Paused by theme" or "Callout
  missing"); the full sentence is the tag's tooltip, and the row has no
  description - except on a touch screen (`Platform.isMobile`), which has no
  hover for the tooltip, where the sentence is the row's description too.
- **Built-in commands** (`commands-builtin`): a row per built-in command
  (`command-<fixed id>`) with its shortcuts, ⊕ and a switch
  (`setFixedCommandEnabled`, which registers or unregisters it), and ↺ in the
  heading that turns them all back on (invisible while all are on). A command
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
like Obsidian's Ribbon settings: a box that is not seen (`menu-intro`,
`pageIntroBox` without text) holding the row that repaints the ↺s, then for
each role (heading, inline, block) two of Obsidian's lists:

- **The role's menu** (`menu-<role>`): the items it shows, in order, each a
  plain row with its icon (`ITEM_ICON`; Obsidian draws a list row's icon only
  on plain and action rows, and hides every icon slot in a box whose rows have
  none), Obsidian's drag handle and Alt+↑/↓ (`onReorder`), and ✕ (`onDelete`),
  which hides it. ↺ in the heading puts the role back as shipped, and shows
  only while the role's menu differs from it (`isMenuRoleDefault`; invisible
  otherwise, as every ↺ is, `ui/resetArrow.ts`). Obsidian makes a box's heading
  buttons once, from the tree that first drew the box, and plain rows have no
  `render` to repaint it, so:
  - `boxResetButton`'s `onMade` hands each role's ↺ element over, and
    `menuPage.ts` keeps them under the tab's context (a `WeakMap` keyed by it:
    the one thing every tree shares), painting each as it is made;
  - `saveMenu` paints all three as soon as a change is saved, and a row with
    nothing on screen (`menu-resets-repaint`, in the intro box) paints them
    whenever Obsidian draws the page, which catches a change that arrived from
    another device. It is in the intro box and not in a list, because a list
    counts every row it draws as one of its items (`settings.indexOf(setting)`
    for ✕, the clamp of Alt+↓), and a hidden row at the end would be a place
    the last item could move onto.
  Until 2026-10-29 the arrow was always shown, and a press with nothing to
  reset changed nothing.
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

## The Website row

The **Website** box holds one row, **Publish to the web** (`websiteGroup` in
[`mainPageGroups.ts`](../../src/settings/declarative/mainPageGroups.ts)). Its
**Open** closes the settings and opens the Publish to the web panel in the
right sidebar (`webPanel/registerWebPanel.openWebPanel`), as the conversion
review's row does: the steps are done elsewhere in Obsidian, and the settings
would be in the way. The row stays usable while saving is paused, since the
panel changes no setting. It registers itself in `ctx.rows`
(`MAIN_PAGE_ROWS.website`), which is what the website offer's **Show me**
scrolls to and flashes.

Until 2026-11-16 the row opened a page of the settings (`declarative/webPage.ts`),
whose row Obsidian draws itself, so a hidden row beside it did the
registering. What the panel shows, and why, is in
[Import & export § The Publish to the web panel](15-import-export.md#the-publish-to-the-web-panel).

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
  from loading. On an error it logs and returns `fallback`: for the tab,
  `treeAfterFailure()`, one box with one row that says the settings could not
  be drawn (`settings.buildFailed`). An empty tree would leave the tab blank:
  with nothing to draw, Obsidian calls `display()`, and the base class's
  draws the (empty) tree.
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
