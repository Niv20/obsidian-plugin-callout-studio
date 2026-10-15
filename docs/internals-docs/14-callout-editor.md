# Callout editor

The edit/create modal consists of
[`src/settings/CalloutEditor.ts`](../../src/settings/CalloutEditor.ts), an explicit
exception to the [source file size limit](20-build-test-release.md#source-file-size),
plus its focused helper modules under `src/settings/editor/`. This is the most
state-heavy UI in the plugin, and understanding *why* is the point of this
document: a `CalloutDefinition` distinguishes "the user picked white" from
"nothing was picked, so it renders as Obsidian's default" via field
*presence* - but a form field always has to show *something* concrete. Nearly
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
Obsidian's own translucent fill keeps painting (the nesting invariant - see
[Colour system](12-color-system.md)); no text colour means the theme's
`--text-normal` keeps winning; no icon adjustment means the default
positioning. Writing a *default the user never actually picked* back onto the
definition would silently pin every built-in the user merely opened to a hex
forever, defeating `isUnmodifiedBuiltIn`.

### `authoredStyle.ts` - the shared answer

[`src/settings/editor/authoredStyle.ts`](../../src/settings/editor/authoredStyle.ts)
holds three predicates - `hasAuthoredBackground`, `hasAuthoredTextColors`,
`hasAuthoredIconAdjust` - each answering "did the user actually author this,
or is the form merely showing an invented default?" **Two entirely separate
call sites need the exact same answer**: the save pipeline (deciding what to
write to the definition) and the live preview (deciding what the in-progress
draft should render as). The file-header comment states the bug this fixes
explicitly: when only the save path had these predicates, *opening the
editor* - before any change - would restyle every callout of that type
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
against one fixed tint strength - it calls `derivedBgAmount()` (see
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

`iconAdjustGroup.ts` translates each complete card header through
`editor.blockIconAdjustments`, `editor.headingIconAdjustments`, or
`editor.inlineIconAdjustments`. All 32 languages have these short headers,
with word order controlled by each locale rather than a joined prefix and role.

The IDs reset restores `[default.id, ...default.aliases]`. Only those shipped
IDs are passed to `TagInput` as read-only: a custom alias saved during an
earlier session must still have a remove action when the editor reopens. The
reset first checks that every shipped ID is still available; an exact or
dasherized conflict leaves the draft unchanged and reports the problem on the
row. That check goes through the same `idLookups()` as the rest of the form, so
an ID already [moving here](#moving-an-id-here) counts as free, but the reset
never offers a move itself: its message is plain text. A successful reset
changes form state only. On Save, the custom aliases it dropped are leaving IDs
like any alias removed by hand: when notes use them, **Update your notes?**
asks, and they stay in those notes unless the user picks a callout to rewrite
them to (see [Notes change only after asking](#notes-change-only-after-asking)).

## How many IDs a callout can have

`MAX_TAGS_COUNT` in `constants.ts` is the only copy of the number, and three
limits read it. `TagInput` stops taking IDs at that count, whether they are
typed, pasted, moved here (`addTagUnchecked`), or arrive as the name-linked
primary (a rename replaces the pinned ID in place), and shows `editor.maxIds`
with the cap filled in. **Keep "old" as another ID** in
[Update your notes?](#what-the-window-asks) adds an alias, so `askNoteChanges`
passes the room left (`MAX_TAGS_COUNT - 1 - aliases`), and with none left that
answer is drawn blocked (`noteChanges.renameKeepFull`). The import validator
rejects an entry with more (`import.err.tooManyIds`, primary ID included), so
anything the editor can save, an export of it can bring back.

Nothing trims a callout that already has more. A restored backup keeps both
sides' spellings (`importedCallout.ts`) and the collision migration folds a
loser's IDs into the survivor, so such a callout keeps every ID; its field just
refuses another until it is under the cap. Exporting it produces a file the
validator rejects for that entry.

`tests/calloutIdLimit.test.ts` reads the constant everywhere, so changing it
needs no test edit, and holds it above the largest built-in ID set so every
built-in can still take an alias. More IDs cost the stylesheet little: the
icon's artwork is written once per callout, not once per name (see
[Icon painting](06-css-generation.md#icon-painting)).

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
(`EmbeddableMarkdownEditor` - an undocumented Obsidian internal), not a mock
render. Because editor extensions registered via `registerEditorExtension`
apply to **every** markdown editor in the workspace, the embedded instance
automatically inherits: Obsidian's native block-callout rendering, this
plugin's heading/inline `ViewPlugin`, and the currently-injected per-callout
CSS. The preview is therefore genuinely 1:1 with how the callout would render
in a real note, in whatever theme is active - not an approximation.

- **Pinned to Live Preview regardless of the vault's "Default editing mode."**
  A vault set to Source mode would otherwise show raw markdown in the
  preview pane, defeating its purpose.
- **Read-only, but interactive** - clicking reveals raw source (the normal
  Live Preview affordance) but an actual edit attempt is blocked and
  surfaces a throttled Notice (`READ_ONLY_NOTICE_THROTTLE_MS = 1500` -
  throttled so rapid attempted keystrokes don't spam notices). What
  "blocked" means is
  [`src/settings/previewReadOnly.ts`](../../src/settings/previewReadOnly.ts),
  and it is worth reading before touching it - see below.
- **Graceful degradation**: the embed API is explicitly undocumented and may
  change out from under the plugin. If constructing it throws, the preview
  falls back to a static (non-editable) `MarkdownRenderer.render()` pass -
  still full-fidelity (the reading-view post-processors give it the same
  three roles and painted icons), just not click-to-reveal.
- **`beforeRender`** runs before every construction *and* every refresh - this
  is the hook the callout editor uses to push its in-progress draft into the
  registry's preview slot and re-inject CSS **before** the editor's
  decorations are built, so the very first paint already reflects the
  in-progress edit.

### Why "read-only" needed two layers

`EditorState.readOnly.of(true)` is **advisory**. CodeMirror's own
documentation says it "is consulted by commands and extensions that implement
editing functionality" - it does not reject a programmatic
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
   route converges on `cm.dispatch`, so this sees all of them - menu commands,
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
else that needs to write the preview must go through the same gate - do not
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

- **`isDemo = this.existingId === null`** - a brand-new callout with no ID yet
  registers as a *demo* (hidden from settings lists, since there's no real row
  it stands in for); editing an existing callout registers as a live,
  list-visible preview of that row.
- **`notifyLists = this.previewColorOverride === null`** - while the user is
  merely *hovering* a colour in the palette dropdown (not yet committed), the
  settings-list row swatches deliberately do **not** repaint - they should
  keep showing the colour the user actually clicked, not a hover preview.
  Every *other* kind of edit (icon, name, sliders, a click-committed palette)
  does notify.
- **`onDestroy` clears the preview and forces a synchronous editor refresh**
 - this is what makes closing the modal (save, cancel, or dismiss) instantly
  revert every open note's rendering back to committed state, with no
  leftover draft styling lingering until the next unrelated change.
- **Save clears the slot itself, but only once the notes question is
  answered** - see [From the click to the save](#from-the-click-to-the-save).
  Until then the draft stays registered, so anything on the save path that
  needs the committed row reads it with `registry.getReal()`.
- `PREVIEW_PLACEHOLDER_ID = "new-callout-preview"` is the id a brand-new
  callout's demo preview registers under before the user has typed a name -
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
> `data-callout="my-note"` - they'd fight over one CSS rule and the block
> callout could only ever show one of them, so this is treated as a hard
> block on saving, exactly like an exact id clash - even though heading and
> inline callouts (which keep the space-form attribute) would stay distinct.
> Shipping a type that's half-broken for one of three roles isn't worth it.

The editor hands all of these the same lookups, `CalloutEditor.idLookups()`:
`registry.getReal`, `findByAlias` and `findAttrIdConflict` (the edited callout
excluded), except that an ID in `idMoves` - one the user chose to
[move here](#moving-an-id-here) - answers as nobody's, since by the end of Save
it will be. The Save button, the field's messages and the save's own
`canUseCalloutId` gate therefore agree; the move itself is checked again inside
the save's batch.

### The dirty-check snapshot includes fields that "don't visibly change anything else"

`SnapshotInput` explicitly documents why `hideIcon` and `transparentBg` are
included in the JSON snapshot compared for "has anything changed": both are
edits that leave **every other form field untouched** (removing the icon
doesn't clear the `icon` field - see [Data model](04-data-model.md) - and
switching to "None" background doesn't clear the colour fields either). Without
including these two flags explicitly, toggling either one would leave the
Save button disabled on the one and only change the user came to make.

### `isOverwritingAutoFallbackRow` - the token-based create special case

When a callout is created for a token already present in a note - through
autocomplete's **Create new** result or the right-click menu's adaptive
create/edit action - the editor opens with `createFromToken: true`. If a
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
The editor resolves and closes only after this confirmation and the note
updates the user agreed to (see
[Notes change only after asking](#notes-change-only-after-asking)). Failed
attempts retain the form and allow retry, repeated Save clicks are ignored, and
newer form edits made during the wait keep the editor open. Background saves use `settingsSaveFeedback` to report errors without
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
**instead of** the form state - icon, colours, background, gradient, text
colours, fold behaviour, icon adjustment, palette link, all overridden
wholesale. This is what "adopt this row and let it follow the fallback
style" means concretely: the row's *identity* (id, aliases) is the user's,
but its *look* is entirely borrowed and stays borrowed until customized.

### Rename: `remove` + `add`, batched, with command migration inside the batch

```ts
const saved = registry.batch(() => {
  const restoreMoves = takeMovedIds(registry, moves, existingId); // see "Moving an ID here"
  if (!restoreMoves) return false;
  const before = registry.getReal(existingId);
  registry.remove(existingId);
  let applied = registry.add(mutationDef);
  if (applied) plugin.customCommands.migrateCalloutId(existingId, def.id);
  else if (before) registry.add(before);            // put the callout back
  if (!applied) restoreMoves();
  return applied;
});
```

> [!IMPORTANT]
> Migration stays inside the batch, so the single `onChange` sees commands
> already pointing to the new id. Missing targets are now paused and retained,
> rather than deleted, but observers must still see a consistent rename.

A batch only holds back change events; it undoes nothing. A refused `add`
used to leave the callout removed - and the deletion reached `data.json` with
the event the batch then fired. The save now re-adds the row it removed (and
puts back `fallbackCalloutId` if `remove` had reset it), and gives back any id
it took from another callout, before the batch closes. The same rollback covers
every save path, not only a rename.

## Notes change only after asking

The editor's Save used to rewrite notes on its own in three cases: an id that
left the callout (a removed alias, or the old main id after a rename, since
the main id mirrors the display name), titles that read the old display name,
and every block callout's `+`/`-` after a **Foldable** change. None of it was
announced before the fact, and none of it could be undone. Delete, Reset to
default and a renamed palette already left notes alone or asked first; the
editor now does the same. The rule: **Save changes a note only when the user
said so in the window it shows first.**

| Module | Role |
|---|---|
| [`editor/noteChanges.ts`](../../src/settings/editor/noteChanges.ts) | Pure: what Save would change (`pendingNoteChanges` / `pendingNoteChangesFor`), the answers (`NoteChoices`, `LEAVE_NOTES`, `defaultNoteChoices`), and the id rewrites they turn into (`noteRewritesFor`) |
| [`utils/idNoteStats.ts`](../../src/utils/idNoteStats.ts) | One vault pass counting, per id: uses, block callouts whose fold mark differs, titles reading the old name - each with the notes it was found in |
| [`editor/noteChangeQuestion.ts`](../../src/settings/editor/noteChangeQuestion.ts) | Pure: which parts the window asks, their preselected answers, the live fold count, answers → `NoteChoices` |
| [`editor/askNoteChanges.ts`](../../src/settings/editor/askNoteChanges.ts) | The step between the click and the save: count, then open the window only when something would change |
| [`editor/NoteChangesModal.ts`](../../src/settings/editor/NoteChangesModal.ts) | **Update your notes?** - draws the question and resolves once |

### Ids are compared by identity

`pendingNoteChanges` decides which ids leave by `calloutIdentity`, the same
rule `calloutIdForms.ts` uses everywhere. Comparing raw strings, as the save
once did, produced two silent rewrites: an alias re-spelled from `a b` to `a-b`
counted as removed, and - because `vaultIdFormsFor` lists the dashed spelling
of every spaced id - **every save** of a callout with a space in an id rewrote
its `[!my-note]` usages. A fold change is decided by `foldMarkFor(old)` against
`foldMarkFor(new)`, so flipping **Default folded** on a callout that cannot fold
(both write no mark) is no change; the old boolean comparison stripped every
mark. `keptForms` is asked of the row as it stands before the save (it still
owns every spelling); ids moved in from another callout are left out of it.

### From the click to the save

1. `save()` captures the form state, `hasStyleChanges`, the fallback flags and
   the moves **at the click**. Counting can take a moment on a large vault, and
   an edit made meanwhile belongs to the next Save.
2. Inside `EditorSaveSession.run` - so a second click is ignored and an
   unfinished earlier plan resumes first - the editor's `askNoteChanges`
   *instance method* calls `askNoteChanges()`. It is a method so a test can
   answer in the window's place (`editorSaveRecovery.test.ts` does).
3. `askNoteChanges()` reads nothing when the edit cannot reach a note: no id
   leaving, no name change, no fold change. Otherwise one `scanIdNoteStats`
   pass covers every leaving spelling and every kept one. A read failure is
   not taken for "unused": the window is asked without numbers.
4. `stillWanted()` is checked after the count: a form edited meanwhile cancels
   this Save (the user presses it again); a closed editor still asks, since
   closing never cancelled a save.
5. Nothing in use → `LEAVE_NOTES`, no window. Otherwise the window's answer, or
   `null` for Cancel / Escape / close - back to the editor, nothing saved.
6. Only now does the save clear the live-preview slot, so the window was drawn
   over the callout as edited and going back finds the preview still standing.
   **Keep "old" as another ID** is applied here: the editor appends the old id to
   the state's aliases, so it is not leaving at all. **Move "id" to another
   callout** travels as the answer's `give` list, passed to the save as `gives`.

### What the window asks

`noteChangeQuestion` asks only about what the notes hold:

| Part | When | Answers (preselected first) |
|---|---|---|
| Removed id | the id is used (or counting failed) | **Leave them as they are** · **Move "id" to another callout** [callout picker, nothing picked] · **Change them in your notes** [callout picker, this callout by default] |
| Rename | the old main id is used | **Change them to "new"** (titles reading the old name follow) · **Keep "old" as another ID** (blocked with no room: `MAX_TAGS_COUNT - 1 - aliases`) |
| Titles | the name changed, no rename part covers it, titles read the old name | **Change them to "new"** · **Leave them as they are** |
| Fold | the fold mark changed and a block callout differs | **Set them to "state"** · **Leave them as they are** |

Each part opens on a line that says what the user changed and what the notes
still hold, then asks - "What should happen to that callout?" for one, "…to
those callouts?" for several or for counts that could not be read ("title"
for the titles part). Counts read "3 callouts in 1 note", singular and plural
from their own keys, and the sentences are built so no verb has to agree with
a count.

> [!NOTE]
> The fold part is dormant for now: the editor's **Foldable** section is hidden
> (`foldSection.hide()` in `CalloutEditor`), so the form's fold state always
> equals the saved one and `pending.fold` stays `null`. It is wired and tested
> so that showing the section again needs nothing more - the user guide leaves
> it out until then.

The preselected answer is the one that changes least, except where Save always
changed the notes - a rename and a fold change - which open on doing what they
always did. The fold count is `foldTally` over the kept ids **plus** every
leaving id whose notes stay this callout's after the answers (`idsEndingHere`):
one rewritten to it (the rewrite runs first, then the fold pass covers it) or
one kept as another id. Leaving a kept id out of the count would hide notes the
fold pass still changes. The part repaints on every answer and hides while its
count is 0. The rewrite picker's choices are the committed callouts minus the
edited row and the demo ids, with a stand-in for "this callout as it will be
saved" first; it has no **Create new** entry, since a nested editor's close
would release `settingsEditOpen` mid-save. The move picker offers the same
callouts minus the stand-in, and minus any that cannot hold another id: theme
rows, unstyled discovered placeholders, and callouts already at
`MAX_TAGS_COUNT` (counting ids this same Save moves out of them). With none
left, the answer is blocked. It starts on nothing picked; a click on the card
then opens the list rather than choosing a move to nowhere, and picking a
callout chooses the card.

### What Save then runs

`performCalloutEditorSave` takes a **required** `noteChoices` - `LEAVE_NOTES`
changes nothing, so no caller can reach the notes by leaving it out - and
optional `moves` and `gives`. Inside the registry batch, once this callout is
saved without them, `giveIds` (`idMoves.ts`) adds each given id to its
target's aliases; one the target can no longer take (deleted, full, or the id
owned elsewhere) is left with nobody - Leave's outcome - and a Notice says so
(`editor.idGiveFailed`). After the registry batch:

- `stageRenameAliases` keeps, as temporary aliases, only the leaving ids that
  are being **rewritten**: one the user left in its notes goes at once, and
  staging it would keep it on the callout for good, since nothing would finish
  to release it.
- `plugin.refreshCallouts()` runs when ids left or moved: those notes look
  different without having changed, exactly as after Delete.
- `createCalloutVaultSavePlan` gets the id rewrites grouped by target
  (`noteRewritesFor`), the title pass (`noteChoices.titles`, over the kept
  spellings) and the fold pass (`noteChoices.fold`, likewise). A rewritten note
  takes its new callout's name as its title when the old title was one the plugin
  would have written (`isGeneratedTitle`'s rule): the callout's old name for its
  main id, an alias's default title or the old name for an alias. A rewrite back
  onto this same callout swaps only an alias's default title - the old name is
  the title pass's question, answered once.

The editor retains this unfinished, idempotent plan in its save session. It
confirms durable settings before running it, requests strict failure reporting
from the shared rewrite helpers, and retries the unfinished old operation before
applying a subsequent edit. This preserves an original A→B rename even after the
in-memory editor identity became B. Closing the modal during a save keeps edit
ownership until the attempt settles, so external settings cannot replace the
registry midway through note updates. The plan is session-only. Temporary
aliases persist until all note-update phases succeed, so a process crash can
leave a partial text rename but preserves how both spellings resolve after
restart. Settings plus multiple Markdown files still have no shared transaction.

Every pass records into **one** `NoteRewriteJournal`, created with the plan so it
outlives a failed attempt; the journal chains the passes over one note (see
[Vault discovery](11-vault-discovery.md)). The plan announces once, after the
last pass and never after a failed attempt, through an injectable `announce`
that defaults to `noticeWithUndo` - so the retry that finishes the work offers
**Undo** for all of it. Undo restores notes only: an id that was removed stays
removed, and notes put back to `[!old]` take the fallback look until it is added
again.

## Moving an ID here

Typing an id another callout has used to end in "This ID conflicts with an
existing callout", with the typed text cleared. Now the IDs field names the
owner and, when the id can come here, offers **move it here**. On Save the
other callout gives the id up and this one takes it; no note changes -
`[!test]` simply starts drawing as this callout.

`idOwnership` ([`editor/idMoves.ts`](../../src/settings/editor/idMoves.ts))
classifies the owner, found by identity through `registry.findAttrIdConflict`:

| Kind | Owner | Offer |
|---|---|---|
| `movable` | an extra id of another callout, including one the user added to a built-in | **move it here**; the owner keeps everything else |
| `movable`, `removeRow` | the only id of an unstyled discovered row (`source: "fallback"`, not `customized`, no aliases, not the Default fallback) | **move it here**; the placeholder row goes and its commands migrate here |
| `stock` | an id Obsidian ships for a built-in | none - it would come straight back (`editor.idBuiltInStock`) |
| `theme` | a theme overlay row, or a row `themeOwns` | none (`editor.idFromTheme`) |
| `main` | another callout's main id | none - that callout would be left without one; delete it first (`editor.idOwnedByMain`) |

The editor keeps accepted moves in `idMoves` (identity → `IdMove`), treats them
as free in `idLookups()`, drops one as soon as its id leaves the field
(`pruneIdMoves`), and while any are pending shows the muted note "On save,
"test" moves here from X." The offer also appears for the name-derived main id
of a new callout: naming a new callout "Test" over another callout's `test` is
how an alias becomes a callout of its own.

`takeMovedIds` runs first inside the save's batch: it re-checks each owner by
identity (refusing, having changed nothing, if one has changed since), snapshots
the sources, strips the ids (or removes the placeholder row), and returns the
restore the save calls if its own `add`/`update` is refused. Moved ids are left
out of the title and fold passes: their notes belonged to another callout until
this Save, and nobody was asked about them.

`TagInput` carries the field's messages. A refused id stays in the field. A
`validate` result may be a `TagMessage` renderer - an **offer**, drawn over
whatever lasting message was showing, kept until the typed text changes, then
the lasting message comes back. `showExternalNote` draws a lasting message in
the muted colour, and `addTagUnchecked` adds the moved id without asking
`validate` again. The link keeps the field's focus on `mousedown`, as the + does:
a blur would commit the typed id again and redraw the message under the pointer.

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

[`src/settings/iconpicker/`](../../src/settings/iconpicker/) - `IconPickerModal`
(source menu, search, preview, confirm), `PackPanel` (one source's toolbar +
grid, driven entirely by its `IconPack`), `IconGrid` (paging + keyboard
navigation), `ImagePanel` ("Your images" upload/manage), `allSources.ts` (the
pooled cross-source search), `IconLibrariesModal` (the **Manage icon libraries**
window - see [Settings UI and modals](16-settings-ui-and-modals.md#iconlibrariesmodal---libraries-in-two-bands)).

The source menu lists only what can be picked from right now:
`icons/iconLibraries.ts` decides it (`menuLibraries()`,
[Icons](13-icons.md#icon-libraries---what-the-picker-offers)), and
`sourcePicker.ts` lays it out in up to three groups, each the listbox's own
`groupOf` heading (`.cs-combobox-group-label`, sticky at the top of the
scrolling menu, each held inside its own `.cs-combobox-group`), always shown -
there is no `hideSingleGroup` here:

| Heading (key) | Rows | When |
| --- | --- | --- |
| **Deleted library** (`iconPicker.groupDeleted`) | the edited icon's downloadable library | only while the device does not fully have it |
| **Current icon** (`iconPicker.groupCurrent`) | the edited icon's hidden built-in library | only while the picker does not offer it |
| **Search** (`iconPicker.groupSearch`) | All sources | always |
| **Libraries** (`iconPicker.groupLibraries`) | `pickerSources()`, in the user's order | always |

All sources has a heading of its own because it is a search, not a library. A
downloadable library this device lacks is not a row at all - not even a dimmed
one - so no row carries a download status and the old **Not downloaded** badge
is gone (`iconPicker.notDownloaded` is left unread, as is every key a locale
still carries). Instead `footerNote`, a `ListboxPopup` option, closes the list
with plain text - "3 more libraries available for download"
(`iconPicker.moreToDownload`, or `…One` for one) - counting `toDownload`, or
nothing when it is empty. It is `div.cs-combobox-footer-note`: no role, no
listener, not in `rowEls`, so the arrow keys stop at the last library and a
press on it is swallowed by the menu's `mousedown` (the menu stays open). The
libraries are downloaded in the window the button beside the menu opens.

**The edited icon's library is the exception** (`MenuLibraries.current`). A
callout keeps its icon when its library is deleted, and one synced from
another device can use a library this device never downloaded; editing it
opens the picker on that library (`activeSource` is the icon's own source), so
the closed menu has to name it. It is listed first, under **Deleted library** -
apart from the libraries on offer rather than among them - with the check while
it is on screen, and it stays there after the person looks elsewhere, as the
way back. Choosing it shows the panel's download prompt; downloading from there
moves it under **Libraries** on the next build of the menu, and the heading
goes. The closing line counts it until every pack file is downloaded, even
while it has its own row: the saved icon does not supply the full library.
The heading also covers libraries never or only partly downloaded on this
device, since pack state records availability rather than deletion history.
A hidden built-in library of the edited icon goes under **Current icon**, so
**Libraries** is always exactly what the picker offers - the **Available
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
asks first - see [Icons](13-icons.md#the-callout-being-edited-counts-as-a-user).
`openLibraries()` first awaits `packs.loadAllFromDisk()`, the same read the picker
does before its first paint (free once done): a library downloaded in an earlier
session reads as missing until its file is read back, and a quick press on
**Manage libraries** would otherwise list it under **Libraries to download** for
a moment.
When that window closes
having changed something, `openLibraries()` takes it in: a library that was
offered and no longer is (deleted, or hidden) gives way to All sources, and an
icon picked from it stops being the selection, since confirming it would
download that library again - except the edited icon's own library, whose
drawings are already saved with the callout. The panel is rebuilt **only when
what it shows changed** (`panelContents()`: the pool's members in order, or
how much of the active library is still to download). Rebuilding sends the grid
back to the selected icon or to the top, so doing it after every change - which
this once did - made the icon list jump whenever someone hid an unrelated
library. A necessary rebuild carries the panel's `searchQuery` into the new
`PackPanel` or `ImagePanel` constructor, so its input and filtered results keep
the typed query, including when a removed active library gives way to All
sources. An explicit source selection still starts with an empty query.
On a phone the row drops its **Choose source** caption from view so
the menu keeps room for the library's name beside **Manage libraries**.

A library's panel (`PackPanel`, marked `.icon-picker-pack-panel`; the Custom
Icons panel has its own layout) fills the room under the source row: the panel
is a flex column with `min-height: 100%` of the scroller, and its body takes
what the toolbar leaves. The trademark notice and the credit line sit together
in `.icon-picker-pack-footer`, pushed to the bottom by `margin-top: auto`, so
under a short grid - a search with few results - the credit stays at the bottom
of the picker instead of floating up beneath the last icons; with more icons
than fit, the footer simply follows the grid at the end of the scroll. When the
grid holds a message instead of cells (`IconGrid.showMessage`: the download
prompt, its progress line, its failure), it carries `has-message`, grows into
the free height and centres the message there with `align-content: center` -
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
and - notably - **is itself shaped as an `IconPack`** (borrowing the
interface without being a real library), specifically so the picker panel
needs **no special case** to render it; it's just another source as far as
`PackPanel` is concerned.

The pool is built from `pickerSources()` - the libraries the picker offers,
in the user's order - so its result groups come in that order too. A
group heading uses `iconPicker.sourceGroup` to show the library name followed
by its exact filtered result count in parentheses, in every locale. A
downloadable source counts only when **every** file it draws from is present -
not "any": Font Awesome pools names across three separate files
(Solid/Regular/Brands), and a missing file would silently drop every name only
that file can draw, producing an inconsistent pooled list. A library that is
not downloaded, or that the user hid, is simply not in the pool - the same list
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
index is bundled). Only pressing **Download** for a `bundledRemote` source - in
its panel or in the Icon libraries window - or confirming a pick from a
`perIconRemote`/`bundledRemote` source whose artwork is not already saved, ever
touches the network. See [Icons](13-icons.md) for the fetch/cache mechanics
this triggers.

---
Next chapter: [15-import-export.md](15-import-export.md)
