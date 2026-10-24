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
