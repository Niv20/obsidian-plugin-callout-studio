# Declarative settings - the tab as a tree Obsidian draws

Since Obsidian 1.13 a settings tab can describe itself as data instead of
drawing itself: `getSettingDefinitions()` returns a tree of rows, boxes, lists
and pages, and Obsidian draws it, keeps it up to date, and indexes every row
for the **Search settings…** field. Callout Studio is moving its whole tab to
that tree, so that a search for "palette", "fallback" or one of the user's own
callouts lands on the right row (the plan's *Searchable Settings* stage).

**Status.** The tree is being built, one part at a time, under
[`src/settings/declarative/`](../../src/settings/declarative/). Until the switch
`getSettingDefinitions()` still returns `[]`, so Obsidian keeps drawing the
tab through `display()` (see
[16 § `getSettingDefinitions()` returns `[]`](16-settings-ui-and-modals.md#getsettingdefinitions-returns----deliberately-and-only-for-now)),
and nothing under `declarative/` is imported by the plugin yet except the
control binding below. Each part is tested through a copy of Obsidian's
renderer (§ Testing the tree).

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
- **Lists** (`type: "list"`) add, when asked: an empty-state row; `addItem`, a
  `+` in the heading on a computer and a last `+ Name` row on mobile; `onDelete`,
  a ✕ on every row and the Delete key; `onReorder`, a drag handle and
  Alt+↑/↓. The heading buttons, the search field and these handlers are made
  once, when the box is first drawn, and read the newest definition when used.
- **A box's own search field** (`search`, 1.13.1) appears only if the box had
  rows when first drawn. Rows marked `searchable: false` are never filtered by
  it.
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
  back; otherwise it writes the value, paints (`cssInjector.inject()`), and
  saves with `saveSettings()`. A key the settings do not have is a mistake in
  the tree: nothing is written or saved, and the console says so.

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
  drag (`body.is-grabbing`), or a row's ⋮ menu that is still waiting for its
  counts (`isRowMenuActive(app)` in `calloutRowMenu.ts`). The update waits a
  tick at a time, for at most about ten seconds, then runs anyway.
- **Delivered when the settings window is hidden or closed:** the wait is the
  next frame of the window showing the tab *or* a 250 ms timer, whichever comes
  first (`nextFrameOrSoon`). This matters because opening the settings draws
  the last stored tree; it does not ask for a new one.

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

`mount` builds the part the first time and moves the same element back into
the row on every redraw. The cleanup cannot tell a redraw from the user
leaving the page, so it calls `releaseLater`: 300 ms later (longer than
Obsidian's 150 ms page slide), a part whose element is back on the page is
kept, and any other is disposed. Leaving the settings calls `disposeAll()`.

## Jumping to a row

Obsidian finds a definition's element only through a private method. Rows the
plugin jumps to (the import prompt's **Import**, **Go to version history**, a
callout just duplicated) register their element under a stable name while they
are drawn, [`declarative/rowRegistry.ts`](../../src/settings/declarative/rowRegistry.ts),
and their cleanup removes it. `get(id)` answers only while the element is on
the page. A part that leads somewhere calls `ctx.jumpTo(rowId, fromKeyboard)`
(on `TreeContext`) and never looks for the row itself; the jump (open the
page, scroll, flash) is the deep-links unit's work.

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
