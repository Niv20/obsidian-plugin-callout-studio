# Adding or modifying features

"I want to add a feature — where do I start?" This document walks through
the extension paths that actually apply to this codebase, and for each one,
every place a change needs to land together. Missing one of these is the
most common way a change looks finished but isn't — the classic failure
mode is "I updated the UI but forgot persistence/i18n/cleanup/export/
migration/runtime-refresh."

## Adding a new setting

1. **`src/types.ts`** — add the field to `PluginSettings` (or a nested
   settings interface it contains).
2. **`src/constants.ts`** — add a default value to `DEFAULT_SETTINGS`.
3. **`src/utils/settingsMerge.ts`** — add an **explicit** line in
   `mergeSavedSettings()` that reads the saved value with a fallback to the
   default. See
   [Persistence and caching § settings merge](07-persistence-and-caching.md#settings-merge--never-a-raw-spread)
   for why a spread doesn't substitute for this — it must be a *named*
   field, or the value is silently dropped on every load.
4. If the field needs bounds-checking on untrusted data, add a clamp in
   `src/utils/settingsGuards.ts` (see `clampGlobalStyle` for the pattern).
5. If it belongs to a **list the user builds up** (like `customPalettes`,
   `userImages`, `customCommands`), it must also be added to `mergeById`
   handling in the JSON importer
   (`DataManagementSection.processImportedJSON`) — see
   [Import and export § the three exceptions](14-import-export.md#settings-import-replace-wholesale-except-three-lists-that-merge-by-id).
   A brand-new such list needs a fourth stop: register it in `mergeById`'s
   call site the same way the existing three are handled.
6. Add the UI control in the relevant `src/settings/sections/*.ts` module
   (or a modal), reading/writing `ctx.plugin.settings.<field>` and calling
   `ctx.plugin.saveSettings()` on change — every settings write in this
   codebase saves immediately (no OK/Cancel convention).
7. If the setting affects generated CSS, make sure `CSSInjector.inject()`
   actually reads it (see [CSS generation](06-css-generation.md)) and that
   whatever changed it calls `plugin.refreshCallouts()` or triggers a
   registry `onChange` so the inject actually runs.
8. Add a test in `tests/settingsMerge.test.ts` (round-trip through
   `mergeSavedSettings`) and, if relevant, `tests/settingsGuards.test.ts`.

## Adding a command

**Do not add a sixth fixed command.** The plugin deliberately caps itself at
five (`FIXED_COMMAND_IDS` in `src/editor/commands.ts`) specifically to avoid
flooding the command palette with a per-callout entry — see
[Editor integrations § the five fixed commands](09-editor-integrations.md#the-five-fixed-commands).
A genuinely new *kind* of user-facing action belongs there only if it's a
generic action independent of any specific callout; anything tied to "wrap
this callout type" belongs in the **custom command** system instead
(`CustomCommandManager` — users build these themselves via
`CommandBuilderModal`; there's nothing for a contributor to add here beyond
new *roles/actions* the builder can offer, which would touch
`CustomCommandAction`/`CustomCommand.role` in `src/types.ts`,
`src/utils/customCommands.ts`'s `describeCommand`, and
`CustomCommandManager.run()`'s dispatch).

If you're modifying an *existing* fixed command's behaviour: never change its
`id` (it's a stable API users have hotkeys bound to — enforced by
`repoRelease.test.ts`), and route the actual editor manipulation through
[`CalloutBlockTools.ts`](../src/editor/CalloutBlockTools.ts) so the fixed
command and any custom command sharing the same operation can't drift apart.

## Adding a callout-related behaviour (new field on `CalloutDefinition`)

1. **`src/types.ts`** — add the field.
2. **`src/manager/CalloutRegistry.ts`** — add it to `COMPARED_FIELDS` (the
   `isModified` comparison — a field missing here silently never triggers a
   built-in save, see
   [Callout registry § isModified](05-callout-registry.md#ismodified-and-the-built-in-deference-mechanism)),
   and decide whether it belongs in `COLOUR_NEUTRAL_FIELDS` too.
3. If the field must always hold a *concrete* value in the editor form but
   is meaningfully *optional* on the definition (like backgrounds, text
   colours, icon adjustment), add a predicate to
   `src/settings/editor/authoredStyle.ts` and use it from **both**
   `CalloutEditorSave.ts` and the live-preview build path — see
   [Callout editor § the core tension](13-callout-editor.md#the-core-tension-concrete-form-state-vs-optional-definition-fields).
   Skipping this reintroduces the exact "opening the editor restyles the
   vault behind the modal" bug class documented there.
4. If it's `true`-or-absent (not a real boolean), follow the
   `transparentBg`/`externalStyle` convention: writers must **omit the key**
   to turn it off, never write `false` — see
   [Data model](04-data-model.md#calloutdefinition).
5. **`src/utils/importValidator.ts`** — add the field to `KNOWN_FIELD_MAP`
   (a total `Record`, so this is a compile error if skipped) and add
   validation logic if the field needs it.
6. **`CSSInjector.ts`** — if the field affects rendering, read it in the
   relevant generator method.
7. Add a UI control in `CalloutEditor.ts`, wired through
   `CalloutEditorSave.ts`.
8. Consider whether the field needs a **load-time migration** for existing
   data (see [Callout registry § load-time migrations](05-callout-registry.md#load-time-migrations)
   for the pattern — content-keyed, idempotent, sets
   `pendingLoadMigrationSave`).

## Adding a context-menu item

1. **`src/types.ts`** — add the id to `ContextMenuItemId`.
2. **`src/constants.ts`** — add it to `DEFAULT_CONTEXT_MENU_ITEMS` for
   whichever role(s) it applies to.
3. **`src/editor/contextmenu/items.ts`** — write the `ItemBuilder` function
   and register it in `BUILDERS[role]`. An id with no builder for a given
   role is simply skipped, so the same `ContextMenuItemConfig` shape can
   carry role-specific ids safely.
4. **`src/i18n/en.ts`** — add the label key (`menuItem.<id>` convention, see
   `MenuCustomizationModal.ITEM_LABEL_KEY`) and the menu-item's own display
   string.
5. **`src/settings/MenuCustomizationModal.ts`** — add it to
   `ITEM_LABEL_KEY` so it appears in the drag-sortable customization list.
6. `mergeMenuItems()` in `settingsMerge.ts` already handles new-id-appended
   automatically for upgrading users — no change needed there unless the
   new item needs a specific *default position* rather than appended last.

## Adding a translation string

1. **Add the key only to `src/i18n/en.ts`.** Do not touch the other 31
   locale files for a routine addition — `t()` already falls back to
   English for any key missing elsewhere, by design.
2. Wait until the English wording is settled before offering to translate
   into other locales — see [Localization](16-i18n.md), don't re-translate
   on every small edit.
3. `npm run i18n:generate` runs automatically as `prebuild` — you don't need
   to run it by hand, but if you do touch a *non-English* locale file, run
   it and commit the regenerated `locales/*.json` +
   `src/i18n/localeManifest.ts`, or CI's `git diff --exit-code` check fails
   the build. See [Localization](16-i18n.md) and
   [Build, test, and release](17-build-test-release.md).
4. **Never hardcode UI-facing text.** `tests/repoSourceRules.test.ts`
   ("no hardcoded UI copy") enforces this mechanically — a bare English
   literal handed to a text setter, `Notice`, or `aria-label` fails the
   build.

## Adding a new style option (global style, per-role frame style)

Follows the same shape as [adding a setting](#adding-a-new-setting) above,
but specifically through `GlobalStyleSettings` /
`HeadingFrameStyleSettings` / `InlineFrameStyleSettings` in `src/types.ts`,
with the merge logic in **`src/utils/globalStyleMerge.ts`** (its own module,
not `settingsMerge.ts` directly, because this section is deep enough to
warrant one — see [Colour system](11-color-system.md#globalstylemergets-and-iconadjustts)).
The UI lives in `GlobalStyleModal.ts`'s per-role popups, driven by
`styleControls.ts`'s shared slider/toggle builders. Remember: a new numeric
style field almost certainly needs a clamp in `clampGlobalStyle`
(`settingsGuards.ts`) so a hand-edited or imported `data.json` can't set it
to something absurd.

## Adding import/export behaviour

- **A new field on `CalloutDefinition`**: see the callout-behaviour section
  above; the validator changes (`KNOWN_FIELD_MAP`) are mandatory, not
  optional.
- **A new foreign-plugin importer** (a third "Import from X"): follow the
  `calloutManagerImport.ts` / `admonitionImport.ts` split exactly — a pure
  `format.ts` that shape-reads the foreign data, a pure `<name>Import.ts`
  that **plans** (reads the registry, decides update-vs-create per entry,
  never mutates), and a single `CalloutRegistry.apply<Name>Import()` method
  that actually mutates, inside one `batch()`. This is what lets the import
  modal show a report **before** anything changes — see
  [Import and export](14-import-export.md#import-from-callout-manager).
- **A new export format**: add a row inside `ExportFormatModal`, not a new
  top-level settings-tab row — the project's stated rationale is that a
  second top-level row would leave Import and Export shaped inconsistently.

## Refreshing icon pack artwork

This is **not** a code change in the usual sense — it's a data-publishing
step with real consequences if done wrong:

1. Regenerate locally: `npm run icons:generate` (reads from `node_modules`,
   writes `src/icons/data/*.index.ts` and `packs/*.json`).
2. **Mint a new git tag** for the pack files — do **not** push new pack
   content to the existing `packs-v2` tag. jsDelivr caches a tag's contents
   **permanently**; overwriting an existing tag's blobs would leave every
   already-cached CDN edge serving stale bytes forever to some users while
   others get the new ones, an inconsistency with no clean recovery.
3. Update the checksums (SHA-256 + byte count) in
   `src/icons/data/packManifest.ts` to match the new tag and new file
   bytes.
4. Commit both the regenerated index files and the manifest checksums
   together — `tests/repoGenerated.test.ts` enforces that the committed
   index files regenerate byte-for-byte from source.

See [Icons § PackDataStore](12-icons.md#packdatastore--bundled-file-download-and-verification)
for why the checksum has to match exactly (a mismatch on disk is treated as
`"corrupt"` and rejected, not accepted-as-stale the way a locale file is).

## Adding a new icon source/pack

1. **`src/types.ts`** — add a member to `IconPackId` and, if it's a new
   library rather than a new style of an existing one, `IconSourceId` too.
2. **`src/icons/registry.ts`** — add an entry to `ICON_SOURCES` and
   `SOURCE_OF_TYPE` (both **total `Record`s**, so a missing entry is a
   compile error, not a silently blank grid).
3. **`src/icons/packs/<name>.ts`** — implement the `IconPack` interface (see
   [Icons § the `IconPack` contract](12-icons.md#the-iconpack-contract)).
   Decide `IconPackKind` carefully — it drives the fetch strategy end to
   end.
4. If it's `bundledRemote`, add its file(s) to `scripts/generate-icon-packs.mjs`
   and follow the pack-refresh process above for publishing.
5. Add its search index type to `src/icons/data/` and wire `loadIndex()`
   through `codec.ts`'s decode.
6. Add its i18n label/description keys to `en.ts`.

## Common gotcha checklist for any feature touching the registry

Before considering a registry-touching change done, verify:

- [ ] Does this mutation need to be inside `registry.batch()` to avoid
      firing `onChange` multiple times for one logical operation?
- [ ] Does this preserve manual discovery's additive transaction and the
      persisted definitions on another device?
- [ ] Does this preserve commands whose targets may be temporarily absent?
- [ ] Does a rename need `customCommands.migrateCalloutId()` called
      **inside** the same batch, before the batched `onChange` fires?
- [ ] Does the icon cache need `cleanupUnusedIconSvgs()` — and if so, is the
      resulting write actually `await`ed into a save, since that method
      doesn't itself call `notifyChange()`?

---
Next chapter: [20-common-pitfalls.md](20-common-pitfalls.md)
