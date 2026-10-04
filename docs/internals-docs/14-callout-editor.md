# Callout editor

The edit/create modal consists of
[`src/settings/CalloutEditor.ts`](../../src/settings/CalloutEditor.ts), an explicit
exception to the [source file size limit](20-build-test-release.md#source-file-size),
plus its focused helper modules under `src/settings/editor/`. This is the most
state-heavy UI in the plugin, and understanding *why* is the point of this
document: a `CalloutDefinition` distinguishes "the user picked white" from
"nothing was picked, so it renders as Obsidian's default" via field
*presence* — but a form field always has to show *something* concrete. Nearly
every subtlety here traces back to reconciling those two facts.

## The core tension: concrete form state vs. optional definition fields

A colour swatch has to display a colour. So the moment the modal opens, its
constructor fills in concrete values for fields that might be **absent** on
the real definition:

- No `bgColorLight`/`bgColorDark` → the form derives a background tint from
  the accent (`bgTintFor`).
- No `textColorLight`/`textColorDark` → the form fills in
  `DEFAULT_TEXT_COLOR_LIGHT`/`DEFAULT_TEXT_COLOR_DARK`.
- No `iconAdjust` → the form starts every slider at `DEFAULT_ICON_ADJUST`.

But on a `CalloutDefinition`, **absence is meaningful**: no background means
Obsidian's own translucent fill keeps painting (the nesting invariant — see
[Colour system](12-color-system.md)); no text colour means the theme's
`--text-normal` keeps winning; no icon adjustment means the default
positioning. Writing a *default the user never actually picked* back onto the
definition would silently pin every built-in the user merely opened to a hex
forever, defeating `isUnmodifiedBuiltIn`.

### `authoredStyle.ts` — the shared answer

[`src/settings/editor/authoredStyle.ts`](../../src/settings/editor/authoredStyle.ts)
holds three predicates — `hasAuthoredBackground`, `hasAuthoredTextColors`,
`hasAuthoredIconAdjust` — each answering "did the user actually author this,
or is the form merely showing an invented default?" **Two entirely separate
call sites need the exact same answer**: the save pipeline (deciding what to
write to the definition) and the live preview (deciding what the in-progress
draft should render as). The file-header comment states the bug this fixes
explicitly: when only the save path had these predicates, *opening the
editor* — before any change — would restyle every callout of that type
vault-wide behind the modal, because the preview definition carried an
invented 18% background where the real row had none, and the extra fields
also flipped `isUnmodifiedBuiltIn`.

> [!WARNING]
> If you add a new field to `CalloutDefinition` that the editor form must
> always hold a concrete value for, it needs its own `hasAuthored…` predicate
> here, used identically by both the save pipeline and the live preview's
> `buildPreviewDefinition()`. Skipping this reintroduces the exact
> class of bug the module exists to prevent.

For the background specifically, `hasAuthoredBackground` doesn't compare
against one fixed tint strength — it calls `derivedBgAmount()` (see
[Colour system](12-color-system.md)) to check whether the current background
**solves** as *some* tint strength of the current accent, because the
palette editor's intensity slider produces tints at any strength between
`MIN_BG_COLOR_AMOUNT` and `MAX_BG_COLOR_AMOUNT`.

## Field-level reset for built-ins

The editor keeps a separate `builtInDefault` alongside `baselineDef`.
`baselineDef` is the possibly customized row the form opened on; using it as a
reset target would simply restore the customization. `builtInDefault` is the
pristine shipped definition returned by `CalloutRegistry.getBuiltInDefault()`
and is the target for the conditional return arrows on IDs, icon, color, and
each render role's icon-adjustment card.

The IDs reset restores `[default.id, ...default.aliases]`. Only those shipped
IDs are passed to `TagInput` as read-only: a custom alias saved during an
earlier session must still have a remove action when the editor reopens. The
reset first checks that every shipped ID is still available; an exact or
dasherized conflict leaves the draft unchanged and reports the problem on the
row. A successful reset changes form state only. On Save, the ordinary
removed-ID plan temporarily retains any dropped aliases, rewrites their vault
usages to the primary ID, and then releases them, so this path inherits the same
partial-failure safety as a manual alias removal.

Each icon-adjustment card owns one return arrow for its Size / Horizontal /
Vertical trio. It resets only that render role and calls the preview once;
other roles keep their values. The target is
`resolveIconAdjust(builtInDefault, role)`, not hard-coded `0 / 0 / 1`, so a
future built-in with a non-neutral shipped adjustment remains correct.
The compact header reset shares the settings-wide layout rule: showing it must
preserve the colored header's natural height. See
[settings resets](16-settings-ui-and-modals.md#scoped-reset-controls).

There is a storage trap here: moving every thumb back to its shipped position
does not by itself reset the definition. A customized baseline already carried
adjustment fields, so `hasAuthoredIconAdjust()` would preserve explicit neutral
numbers, leaving `isBuiltInModified()` true. `definitionIconAdjust.ts`,
shared by preview and save, compares the resolved result in all three roles.
When it render-matches the built-in default, it copies the default's four raw
fields (`iconAdjust`, `iconOffsetX`, `iconOffsetY`, `iconSize`) exactly,
including `undefined`. This is what restores theme deference and removes an
otherwise-pristine built-in from persisted data. While even one role still
differs, normal `buildIconAdjust()` output is retained; that preserves explicit
neutral overrides needed to stop a reset Heading or Inline role from inheriting
a still-nudged Regular role.

## The live preview: a real embedded Obsidian editor

[`src/settings/LiveCalloutPreview.ts`](../../src/settings/LiveCalloutPreview.ts)
hosts a genuine **embedded Obsidian markdown editor**
(`EmbeddableMarkdownEditor` — an undocumented Obsidian internal), not a mock
render. Because editor extensions registered via `registerEditorExtension`
apply to **every** markdown editor in the workspace, the embedded instance
automatically inherits: Obsidian's native block-callout rendering, this
plugin's heading/inline `ViewPlugin`, and the currently-injected per-callout
CSS. The preview is therefore genuinely 1:1 with how the callout would render
in a real note, in whatever theme is active — not an approximation.

- **Pinned to Live Preview regardless of the vault's "Default editing mode."**
  A vault set to Source mode would otherwise show raw markdown in the
  preview pane, defeating its purpose.
- **Read-only, but interactive** — clicking reveals raw source (the normal
  Live Preview affordance) but an actual edit attempt is blocked and
  surfaces a throttled Notice (`READ_ONLY_NOTICE_THROTTLE_MS = 1500` —
  throttled so rapid attempted keystrokes don't spam notices). What
  "blocked" means is
  [`src/settings/previewReadOnly.ts`](../../src/settings/previewReadOnly.ts),
  and it is worth reading before touching it — see below.
- **Graceful degradation**: the embed API is explicitly undocumented and may
  change out from under the plugin. If constructing it throws, the preview
  falls back to a static (non-editable) `MarkdownRenderer.render()` pass —
  still full-fidelity (the reading-view post-processors give it the same
  three roles and painted icons), just not click-to-reveal.
- **`beforeRender`** runs before every construction *and* every refresh — this
  is the hook the callout editor uses to push its in-progress draft into the
  registry's preview slot and re-inject CSS **before** the editor's
  decorations are built, so the very first paint already reflects the
  in-progress edit.

### Why "read-only" needed two layers

`EditorState.readOnly.of(true)` is **advisory**. CodeMirror's own
documentation says it "is consulted by commands and extensions that implement
editing functionality" — it does not reject a programmatic
`dispatch({changes})`. So it stopped typing, and stopped nothing that called
the editor API directly.

That was not a theoretical gap. An embedded editor gets Obsidian's *real*
editor context menu, whose **Format**, **Paragraph** and **Insert** submenus
call `toggleBulletList()`, `setHeading()`, `toggleBlockquote()`,
`insertTable()`, `insertCallout()`, `insertHorizontalRule()`,
`insertCodeblock()` and `insertMathBlock()` on the editor. Every one of them
landed in a "read-only" preview, silently and with no notice. So did this
plugin's own fold-marker and cut/delete-section items, which write through
`editor.replaceRange`.

Two layers now, and only the first is a guarantee:

1. **`EditorState.transactionFilter`** in
   [`previewReadOnly.ts`](../../src/settings/previewReadOnly.ts) drops any
   transaction with `docChanged` and reports it through `onEditAttempt`. Every
   route converges on `cm.dispatch`, so this sees all of them — menu commands,
   `Editor.*` writes, other plugins' editor commands, raw dispatches. Selection
   moves and effect-only transactions pass untouched, which is what keeps
   click-to-reveal-source, `parkCursor()` and `calloutStudioRefresh` working.
   The `beforeinput` / `paste` / `drop` handlers stay, at `Prec.highest`, to
   stop the browser's own default and to cover the Electron context-menu paths
   (cut, spellcheck replacement) that mutate the DOM without a CodeMirror
   command.
2. **Menu filtering** in
   [`editor/contextmenu/readOnlyPreview.ts`](../../src/editor/contextmenu/readOnlyPreview.ts)
   removes the editing-only sections so the menu stops *offering* commands
   whose only remaining effect is a notice. See
   [Editor integrations](10-editor-integrations.md#the-context-menu-inside-a-read-only-preview).

`EditorView.editable.of(false)` is deliberately **not** used: with no caret
there is no cursor position, and Live Preview reveals a line's raw markdown by
cursor position. It would turn the preview into a static render with extra
steps.

**The write gate.** `setValue()` reseeds the whole document when the form the
preview mirrors changes, and that reseed is a doc-changing transaction like any
other. `readOnlyPreviewExtensions()` therefore returns a `PreviewWriteGate`
alongside its extensions; `setValue` wraps its `instance.set()` in
`gate.allow(…)`, which opens synchronously and closes in a `finally`. Anything
else that needs to write the preview must go through the same gate — do not
loosen the filter instead.

## Registering the in-progress draft: the preview slot, from the editor's side

```ts
this.preview = new LiveCalloutPreview(this.app, previewCol, {
  beforeRender: () => {
    this.plugin.registry.setPreviewDefinition(
      this.buildPreviewDefinition(),
      this.existingId === null,               // isDemo
      this.previewColorOverride === null,       // notifyLists
    );
    this.plugin.cssInjector.inject(false);
    this.scheduleNoteDecorationRefresh();
  },
  onDestroy: () => {
    this.plugin.registry.setPreviewDefinition(null);
    this.plugin.cssInjector.inject(false);
    refreshAllCalloutEditors();
  },
});
```

This is the editor-side half of `CalloutRegistry`'s preview mechanism (full
mechanics in [Callout registry](05-callout-registry.md#the-transient-live-preview-slot)):

- **`isDemo = this.existingId === null`** — a brand-new callout with no ID yet
  registers as a *demo* (hidden from settings lists, since there's no real row
  it stands in for); editing an existing callout registers as a live,
  list-visible preview of that row.
- **`notifyLists = this.previewColorOverride === null`** — while the user is
  merely *hovering* a colour in the palette dropdown (not yet committed), the
  settings-list row swatches deliberately do **not** repaint — they should
  keep showing the colour the user actually clicked, not a hover preview.
  Every *other* kind of edit (icon, name, sliders, a click-committed palette)
  does notify.
- **`onDestroy` clears the preview and forces a synchronous editor refresh**
  — this is what makes closing the modal (save, cancel, or dismiss) instantly
  revert every open note's rendering back to committed state, with no
  leftover draft styling lingering until the next unrelated change.
- `PREVIEW_PLACEHOLDER_ID = "new-callout-preview"` is the id a brand-new
  callout's demo preview registers under before the user has typed a name —
  see [Data model](04-data-model.md) for why it can't be a real callout id
  like the old `"example"` placeholder.

## Deleted saved colours

The editor keeps the deleted-palette state when its colours resolve to no
saved palette. It retains the dangling `paletteId` so a restoration can
relink the group, while the **Color** row shows the current form's colour
circles, **Deleted color**, and “This callout's saved color was deleted.”
The inline **Restore** action opens `PaletteEditorModal` seeded from those
same colours. The warning has no linked-callout count.

The picker must retain the label even when there is no selected palette
entry: opening and dismissing the search, losing focus, or cancelling the
restore popup must leave the deleted label, warning, and colour circles
intact. Choosing a palette or completing restoration clears this state.
An already-saved palette with identical colours can be adopted directly
instead of creating a duplicate.

## Validation

[`src/settings/editor/CalloutEditorValidation.ts`](../../src/settings/editor/CalloutEditorValidation.ts)
holds pure functions used by both the form's live "is Save enabled" state and
the save pipeline's final gate.

```ts
canUseCalloutId(input): boolean          // exact id/alias collision check
findAttrIdCollision(input): string | null  // dasherized-form collision with a DIFFERENT callout
isStateValid(input): boolean
buildStateSnapshot(input): string          // JSON snapshot for dirty-checking
hasStateChanges(initial, current): boolean
```

> [!NOTE]
> **`findAttrIdCollision` is a separate check from `canUseCalloutId`,
> reported separately.** `my note` and `my-note` both dasherize to
> `data-callout="my-note"` — they'd fight over one CSS rule and the block
> callout could only ever show one of them, so this is treated as a hard
> block on saving, exactly like an exact id clash — even though heading and
> inline callouts (which keep the space-form attribute) would stay distinct.
> Shipping a type that's half-broken for one of three roles isn't worth it.

### The dirty-check snapshot includes fields that "don't visibly change anything else"

`SnapshotInput` explicitly documents why `hideIcon` and `transparentBg` are
included in the JSON snapshot compared for "has anything changed": both are
edits that leave **every other form field untouched** (removing the icon
doesn't clear the `icon` field — see [Data model](04-data-model.md) — and
switching to "None" background doesn't clear the colour fields either). Without
including these two flags explicitly, toggling either one would leave the
Save button disabled on the one and only change the user came to make.

### `isOverwritingAutoFallbackRow` — the token-based create special case

When a callout is created for a token already present in a note — through
autocomplete's **Create new** result or the right-click menu's adaptive
create/edit action — the editor opens with `createFromToken: true`. If a
background vault scan files an **existing, uncustomized fallback row** for that
id while the editor is open, saving may overwrite the row in place rather than
refusing it as a duplicate: the user is effectively adopting the discovered
id. `shouldSaveNewTokenCalloutAsFallback` additionally decides that a new
token-created callout with **no style changes at all** saves as
`source: "fallback"` rather than `"user"`; opening the editor and saving the
inherited appearance is not yet a customization.

## Save pipeline

[`src/settings/editor/CalloutEditorSave.ts`](../../src/settings/editor/CalloutEditorSave.ts)'s
`performCalloutEditorSave()` is the single function every save (new, edit,
rename, "mirror the fallback") goes through.

`EditorSaveSession` owns one in-flight attempt. `persistEditorSettings` awaits
the writer and checks that the canonical current registry matches the writer's
last successful file state; a resolved frozen/stale save is not success.
The editor resolves and closes only after this confirmation and the required
note updates. Failed attempts retain the form and allow retry, repeated Save
clicks are ignored, and newer form edits made during the wait keep the editor
open. Background saves use `settingsSaveFeedback` to report errors without
leaking an unhandled promise rejection; awaiting callers still receive failure.

Persistence errors share the writer's English error reporter, including frozen and
stale saves. A failed required vault rewrite reports once through `EditorSaveSession`
and explicitly says that the definition was saved while note updates remain pending.
The low-level required rewrite rejects without issuing a second popup. Successful
rename/title phases are summarized together only after all note phases finish.

The persistent saving banner is shared with settings. The canonical
[editor recovery contract](08-settings-sync-and-recovery.md#editors-and-unfinished-note-operations)
describes guarded adoption, missing-file restoration eligibility, and the distinction
between a retained form and a durable settings write. Editor-specific note work
retains the definition snapshot it requires; a conflicting recovery must not run
that plan against a different definition. Banner subscriptions are released on close.


### The `fallbackBase` mirroring path

When `saveAsFallback` is true, nearly every field is taken from
`getFallbackBase()` (the current default-fallback callout's definition)
**instead of** the form state — icon, colours, background, gradient, text
colours, fold behaviour, icon adjustment, palette link, all overridden
wholesale. This is what "adopt this row and let it follow the fallback
style" means concretely: the row's *identity* (id, aliases) is the user's,
but its *look* is entirely borrowed and stays borrowed until customized.

### Rename: `remove` + `add`, batched, with command migration inside the batch

```ts
saved = plugin.registry.batch(() => {
  plugin.registry.remove(existingId);
  const added = plugin.registry.add(def);
  if (added) plugin.customCommands.migrateCalloutId(existingId, def.id);
  return added;
});
```

> [!IMPORTANT]
> Migration stays inside the batch, so the single `onChange` sees commands
> already pointing to the new id. Missing targets are now paused and retained,
> rather than deleted, but observers must still see a consistent rename.

### Vault side effects that ride along with a save

After the definition is written, three vault-wide operations may run,
**each gated on something actually having changed**:

1. **ID change** → `replaceCalloutIdsInVault` rewrites every vault usage of
   the *removed* id forms to the new one (only if there was actual vault
   usage — `countCalloutUsages` checked first).
2. **Display-name change** → `replaceCalloutTitlesInVault` rewrites titles,
   but **only where the existing title exactly matched the old display
   name** — a title the user wrote themselves is never touched.
3. **Fold-behaviour change** (`foldable`/`defaultFolded`) →
   `normalizeFoldMarkersInVault` rewrites every existing header's fold mark to
   match the new default.

The editor retains an unfinished, idempotent note-update plan in its save
session. It confirms durable settings before running that plan, requests
strict failure reporting from the shared rewrite helpers, and retries the
unfinished old operation before applying a subsequent edit. This preserves an
original A→B rename even after the in-memory editor identity became B. Closing
the modal during a save keeps edit ownership until the attempt settles, so
external settings cannot replace the registry midway through note updates.
The plan is session-only. Before a rename begins, removed IDs are persisted as
temporary aliases; they are removed only after all note-update phases succeed.
A process crash can therefore leave a partial text rename but preserves how
both old and new spellings resolve after restart. Removing a retained alias in
a later edit can finish its remaining note updates. Settings plus multiple
Markdown files still have no shared transaction.

### Material icons fetch on save, not on pick

```ts
if (def.hideIcon !== true && packFor(def.icon)?.kind === "perIconRemote") {
  onMaterialDownloadStart?.();
  await plugin.ensureIconArtwork(def.icon);
}
```

A `perIconRemote` icon (Material Symbols) is requested at save time so available
artwork reaches the saved cache. Download failure is caught: the chosen icon
identity remains in the definition, and the ordinary missing-artwork fallback
can render until artwork becomes available. Bundled-pack icons return
immediately. Network availability is not a prerequisite for keeping a callout.

## The icon picker

[`src/settings/iconpicker/`](../../src/settings/iconpicker/) — `IconPickerModal`
(source menu, search, preview, confirm), `PackPanel` (one source's toolbar +
grid, driven entirely by its `IconPack`), `IconGrid` (paging + keyboard
navigation), `ImagePanel` ("Your images" upload/manage), `allSources.ts` (the
pooled cross-source search), `IconLibrariesModal` (the **Manage icon libraries**
window — see [Settings UI and modals](16-settings-ui-and-modals.md#iconlibrariesmodal--libraries-in-two-bands)).

The source menu lists only what can be picked from right now:
`icons/iconLibraries.ts` decides it (`menuLibraries()`,
[Icons](13-icons.md#icon-libraries--what-the-picker-offers)), and
`sourcePicker.ts` lays it out in up to three groups, each the listbox's own
`groupOf` heading (`.cs-combobox-group-label`, sticky at the top of the
scrolling menu, each held inside its own `.cs-combobox-group`), always shown —
there is no `hideSingleGroup` here:

| Heading (key) | Rows | When |
| --- | --- | --- |
| **Deleted library** (`iconPicker.groupDeleted`) | the edited icon's downloadable library | only while the device does not fully have it |
| **Current icon** (`iconPicker.groupCurrent`) | the edited icon's hidden built-in library | only while the picker does not offer it |
| **Search** (`iconPicker.groupSearch`) | All sources | always |
| **Libraries** (`iconPicker.groupLibraries`) | `pickerSources()`, in the user's order | always |

All sources has a heading of its own because it is a search, not a library. A
downloadable library this device lacks is not a row at all — not even a dimmed
one — so no row carries a download status and the old **Not downloaded** badge
is gone (`iconPicker.notDownloaded` is left unread, as is every key a locale
still carries). Instead `footerNote`, a `ListboxPopup` option, closes the list
with plain text — "3 more libraries available for download"
(`iconPicker.moreToDownload`, or `…One` for one) — counting `toDownload`, or
nothing when it is empty. It is `div.cs-combobox-footer-note`: no role, no
listener, not in `rowEls`, so the arrow keys stop at the last library and a
press on it is swallowed by the menu's `mousedown` (the menu stays open). The
libraries are downloaded in the window the button beside the menu opens.

**The edited icon's library is the exception** (`MenuLibraries.current`). A
callout keeps its icon when its library is deleted, and one synced from
another device can use a library this device never downloaded; editing it
opens the picker on that library (`activeSource` is the icon's own source), so
the closed menu has to name it. It is listed first, under **Deleted library** —
apart from the libraries on offer rather than among them — with the check while
it is on screen, and it stays there after the person looks elsewhere, as the
way back. Choosing it shows the panel's download prompt; downloading from there
moves it under **Libraries** on the next build of the menu, and the heading
goes. The closing line counts it until every pack file is downloaded, even
while it has its own row: the saved icon does not supply the full library.
The heading also covers libraries never or only partly downloaded on this
device, since pack state records availability rather than deletion history.
A hidden built-in library of the edited icon goes under **Current icon**, so
**Libraries** is always exactly what the picker offers — the **Available
libraries** band of the window.

`menuLibraries()` in the modal withholds `toDownload` until `packStatesLoaded`:
before `loadAllFromDisk()` finishes, a library downloaded in an earlier session
reads as missing and the line would quote a number about to drop. The menu is
redrawn the moment the read finishes (before the first panel, which can wait on
Material's webfont), so an open menu catches up.

A text button, **Manage libraries** (`iconPicker.manageLibraries`), ends the
source row and opens the **Manage icon libraries** window on top. It replaced a
gear: it is where libraries are downloaded now, which an icon left people to
guess. It wears the shared grey face (`--cs-btn-face`, held by
`secondaryButtons.test.ts` like the window footer's Cancel) and the field
rule's own height, so it stands level with the menu; its label never wraps, and
it has no `aria-label`, since its words name it and Obsidian would turn the
attribute into a tooltip. The editor opens the
picker as `new IconPicker(plugin, this.icon, { id: this.existingId, name })`:
`this.icon` is a draft until **Save**, so the registry does not know it, and the
picker hands the window the callout being edited (`EditedCallout`: that id and
name plus the icon it was opened on) so deleting a library the draft uses
asks first — see [Icons](13-icons.md#the-callout-being-edited-counts-as-a-user).
`openLibraries()` first awaits `packs.loadAllFromDisk()`, the same read the picker
does before its first paint (free once done): a library downloaded in an earlier
session reads as missing until its file is read back, and a quick press on
**Manage libraries** would otherwise list it under **Libraries to download** for
a moment.
When that window closes
having changed something, `openLibraries()` takes it in: a library that was
offered and no longer is (deleted, or hidden) gives way to All sources, and an
icon picked from it stops being the selection, since confirming it would
download that library again — except the edited icon's own library, whose
drawings are already saved with the callout. The panel is rebuilt **only when
what it shows changed** (`panelContents()`: the pool's members in order, or
how much of the active library is still to download). Rebuilding sends the grid
back to the selected icon or to the top, so doing it after every change — which
this once did — made the icon list jump whenever someone hid an unrelated
library. On a phone the row drops its **Choose source** caption from view so
the menu keeps room for the library's name beside **Manage libraries**.

A library's panel (`PackPanel`, marked `.icon-picker-pack-panel`; the Custom
Icons panel has its own layout) fills the room under the source row: the panel
is a flex column with `min-height: 100%` of the scroller, and its body takes
what the toolbar leaves. The trademark notice and the credit line sit together
in `.icon-picker-pack-footer`, pushed to the bottom by `margin-top: auto`, so
under a short grid — a search with few results — the credit stays at the bottom
of the picker instead of floating up beneath the last icons; with more icons
than fit, the footer simply follows the grid at the end of the scroll. When the
grid holds a message instead of cells (`IconGrid.showMessage`: the download
prompt, its progress line, its failure), it carries `has-message`, grows into
the free height and centres the message there with `align-content: center` —
between the toolbar and the footer. Cells are never stretched that way:
`setEntries` takes the class off again.

`ImagePanel` keeps its file-upload control beside search as an icon-only
button with a localized accessible name. Each uploaded icon exposes its delete
action as an **X** over the tile on hover or keyboard focus; deletion still
uses the confirmation and in-use warning. The panel centers its empty message
within the grid as a title, upload-or-drop instruction, and subdued list of
accepted formats. Its extra tile spacing keeps the delete targets clear.

### "All sources" is itself an `IconPack`

[`src/settings/iconpicker/allSources.ts`](../../src/settings/iconpicker/allSources.ts)
pools every **currently drawable** source's index into one searchable list,
and — notably — **is itself shaped as an `IconPack`** (borrowing the
interface without being a real library), specifically so the picker panel
needs **no special case** to render it; it's just another source as far as
`PackPanel` is concerned.

The pool is built from `pickerSources()` — the libraries the picker offers,
in the user's order — so its result groups come in that order too. A
downloadable source counts only when **every** file it draws from is present —
not "any": Font Awesome pools names across three separate files
(Solid/Regular/Brands), and a missing file would silently drop every name only
that file can draw, producing an inconsistent pooled list. A library that is
not downloaded, or that the user hid, is simply not in the pool — the same list
the menu shows under **Libraries**; the old "not included yet" hint under the
pool is gone, since the menu's closing line counts what is left to download and
the Manage icon libraries window lists it. Fixed
catalog sizes use locale-aware, hundred-icon lower bounds (compact where the
locale supports them); the user-owned **Custom Icons** count remains exact.

The source list uses `listboxPopupLayout.ts` to cap its border-box height at
320px or the remaining space below the trigger, whichever is smaller. The
visible viewport and the clipping modal body both limit that space; resize,
zoom and layout changes refresh the cap while open, with observers removed on
close. Pointer highlights clear on row/menu exit without clearing committed
selection; arrow-key highlights persist until navigation or dismissal.

The icon grid scrolls below the fixed source row. `alignIconPickerRows()`
measures its scrollbar and gives the source row and grid content matching
start-side insets, so the source control and search field stay aligned with
equal visible space on both sides. The grid reserves its scrollbar gutter while
results are filtered, preventing the controls from resizing when the grid is
empty. The extra inset is zero when scrollbars overlay the content.

### Downloads happen on confirm, not on browse

Consistent with the network-disclosure policy stated throughout the codebase:
opening the picker, browsing, and searching are always offline (the search
index is bundled). Only pressing **Download** for a `bundledRemote` source — in
its panel or in the Icon libraries window — or confirming a pick from a
`perIconRemote`/`bundledRemote` source whose artwork is not already saved, ever
touches the network. See [Icons](13-icons.md) for the fetch/cache mechanics
this triggers.

---
Next chapter: [15-import-export.md](15-import-export.md)
