# Callout editor

The edit/create modal — [`src/settings/CalloutEditor.ts`](../src/settings/CalloutEditor.ts)
(~2,330 lines, one of the frozen oversized-file exceptions) plus its three
focused helper modules under `src/settings/editor/`. This is the most
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
[Colour system](11-color-system.md)); no text colour means the theme's
`--text-normal` keeps winning; no icon adjustment means the default
positioning. Writing a *default the user never actually picked* back onto the
definition would silently pin every built-in the user merely opened to a hex
forever, defeating `isUnmodifiedBuiltIn`.

### `authoredStyle.ts` — the shared answer

[`src/settings/editor/authoredStyle.ts`](../src/settings/editor/authoredStyle.ts)
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
[Colour system](11-color-system.md)) to check whether the current background
**solves** as *some* tint strength of the current accent, because the
palette editor's intensity slider produces tints at any strength between
`MIN_BG_COLOR_AMOUNT` and `MAX_BG_COLOR_AMOUNT`.

## The live preview: a real embedded Obsidian editor

[`src/settings/LiveCalloutPreview.ts`](../src/settings/LiveCalloutPreview.ts)
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
  [`src/settings/previewReadOnly.ts`](../src/settings/previewReadOnly.ts),
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
   [`previewReadOnly.ts`](../src/settings/previewReadOnly.ts) drops any
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
   [`editor/contextmenu/readOnlyPreview.ts`](../src/editor/contextmenu/readOnlyPreview.ts)
   removes the editing-only sections so the menu stops *offering* commands
   whose only remaining effect is a notice. See
   [Editor integrations](09-editor-integrations.md#the-context-menu-inside-a-read-only-preview).

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

## Validation

[`src/settings/editor/CalloutEditorValidation.ts`](../src/settings/editor/CalloutEditorValidation.ts)
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

### `isOverwritingAutoFallbackRow` — the autocomplete "create new" special case

When a callout is created via autocomplete's "Create new" flow
(`createFromAutocomplete: true`) and the typed name happens to collide with
an **existing, uncustomized fallback row**, saving is allowed to overwrite
that row in place rather than refusing as a duplicate — the user is
effectively "adopting" a discovered id. `shouldSaveNewAutocompleteCalloutAsFallback`
additionally decides that a brand-new autocomplete-created callout with **no
style changes at all** should save as `source: "fallback"` rather than
`"user"` — picking a suggestion from the dropdown and saving immediately with
no edits is not really "customizing" anything.

## Save pipeline

[`src/settings/editor/CalloutEditorSave.ts`](../src/settings/editor/CalloutEditorSave.ts)'s
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

[`src/settings/iconpicker/`](../src/settings/iconpicker/) — `IconPickerModal`
(source menu, search, preview, confirm), `PackPanel` (one source's toolbar +
grid, driven entirely by its `IconPack`), `IconGrid` (paging + keyboard
navigation), `ImagePanel` ("Your images" upload/manage), `allSources.ts` (the
pooled cross-source search).

### "All sources" is itself an `IconPack`

[`src/settings/iconpicker/allSources.ts`](../src/settings/iconpicker/allSources.ts)
pools every **currently drawable** source's index into one searchable list,
and — notably — **is itself shaped as an `IconPack`** (borrowing the
interface without being a real library), specifically so the picker panel
needs **no special case** to render it; it's just another source as far as
`PackPanel` is concerned.

`availableSources(packs)` filters to sources where **every** file a source
draws from is present — not "any": Font Awesome pools names across three
separate files (Solid/Regular/Brands), and a missing file would silently drop
every name only that file can draw, producing an inconsistent pooled list.
`missingSources(packs)` is the complement, used to show a "Some sources
aren't downloaded yet" hint.

### Downloads happen on confirm, not on browse

Consistent with the network-disclosure policy stated throughout the codebase:
opening the picker, browsing, and searching are always offline (the search
index is bundled). Only pressing **Download** for a `bundledRemote` source,
or confirming a pick from a `perIconRemote`/`bundledRemote` source, ever
touches the network. See [Icons](12-icons.md) for the fetch/cache mechanics
this triggers.

---
Next chapter: [14-import-export.md](14-import-export.md)
