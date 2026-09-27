# Import and export

Covers the JSON backup format, the validator, the CSS-snippet export (recap
— full mechanics in [Persistence and caching](07-persistence-and-caching.md#the-user-requested-css-snippet-export)),
and the two foreign-plugin importers (Callout Manager, Admonition).

## Export

`ImportSourceModal` and `ExportFormatModal` are each a single settings row
opening a chooser — one picks a source, the other picks a format — rather
than one top-level row per option, per the project's own stated design
rationale ("a second top-level row for a new format would leave the two
halves of one section shaped differently"). Both choosers show the backup
with the same Lucide `paintbrush` icon. Export
marks it with the shared grey **Recommended** pill (`settings/recommendedBadge.ts`) on its title line rather
than a "(recommended)" written into the title. The pill's word
(`.cs-recommended-badge-text`) is centred on its capitals, not on the font's
line box: inside `@supports (text-box: trim-both cap alphabetic)` the word is
trimmed to cap height and baseline, so the pill's 4px block padding and its
10px icon, not the font's line box, set the space above and below it. A UI font whose line box runs deep below the baseline
(most Hebrew faces, which keep room there for vowel points) otherwise set the
word visibly high. An installer without `text-box` keeps the line box.

`assets/ui-icons/braces.svg` is retained as an unused repository asset for
possible future UI use; it is not bundled or shown in these choosers.

Both choosers and the plugin import window use `settings/optionBox.ts`:
`renderOptionList()` provides the column and `renderOptionBox()` provides the
icon, title, description, badge, and interaction. Chooser boxes have
`role="button"`; plugin import options have `role="radio"`. They share the
same `.cs-option-box` styling and click, Enter, and Space handling. Only the
first click of a double-click and the first keydown of a held key activate a
box, so choosing an option cannot also refill it through a repeated event.

### Two export formats

1. **Callout Studio backup (`.json`)** — `registry.exportToJSONv2()`:
   ```json
   {
     "format": "callout-studio",
     "formatVersion": 2,
     "callouts": [ /* getExportableDefinitions() */ ],
     "settings": { /* full PluginSettings */ }
   }
   ```
   `getExportableDefinitions()` is `getUserDefined()` **plus every modified
   built-in** — see [Callout registry](05-callout-registry.md#which-rows-are-persisted-the-built-in-rule).
   The v2 JSON backup is the **only supported full-fidelity restore and
   cross-vault transfer format** for Callout Studio. It is the format users
   should choose when the destination vault also has the plugin installed.
   A legacy `exportToJSON()` (flat array, no envelope, no settings) still
   exists and is kept **because it's part of the public plugin API surface**
   — the importer accepts both shapes, but the legacy array is not a complete
   setup backup because it carries no settings.
2. **CSS snippet (`.css`)** — see
   [Persistence and caching](07-persistence-and-caching.md#the-user-requested-css-snippet-export)
   for the full write/overwrite/fingerprint mechanics. In short: block-role
   callouts only, a snapshot (not live-linked), byte-identical re-export
   writes nothing, and a foreign/hand-edited file at the target path prompts
   before overwriting. This is a **one-way deployment artifact, not a backup**:
   the backup importer never reads the generated CSS file, and no importer
   scans the snippets folder.

The Callout Manager importer's file and paste routes can parse a limited subset
from either Callout Manager CSS or a Callout Studio snapshot, chosen as a file
or pasted. This is a partial recovery/migration path, not a restore of the
backup format or a full-fidelity one: CSS cannot carry the complete definitions,
settings, palettes, commands, or stored image data in the JSON backup.

## Import — the JSON backup

This is the matching restore path for Callout Studio's own exported state.
Users select a JSON backup explicitly; the plugin does not infer an import from
a CSS file placed in the vault or from anything in the snippets folder.

[`src/utils/importValidator.ts`](../../src/utils/importValidator.ts) (~1,250
lines) is the gate every import file passes through before a single
`registry.add()`/`update()` call happens. `validateImportPayload(raw,
registry)` accepts **both** the legacy flat-array shape and the v2 envelope,
never bails early on one bad entry, and collects **every** issue across the
whole file in one pass — so `ImportReportModal` can show the complete
picture at once rather than one error at a time across repeated attempts.

### Resource limits and hostile input

All three importers share `utils/importLimits.ts`. Files are checked against a
16 MiB ceiling before reading (`File.size` or the vault adapter's `stat`), and
their text is checked again in UTF-8 bytes. Clipboard text has the same ceiling.
JSON depth, per-container counts, and total value counts are checked before
`JSON.parse` can allocate the tree; an iterative pass checks the parsed structure
again. The limits are 32 container levels, 50,000 values, and 1,000 entries in any array
or object. Native validation and both foreign format readers also check parsed
objects, so a non-UI caller cannot bypass the structural limits. Rejection is
fatal and happens before registry mutation. A UTF-8 BOM is accepted.

Callout Manager CSS uses forward-only comment/block/selector scanning with
work and entry budgets; unmatched braces or comment openers cannot trigger
the previous unanchored regex's quadratic backtracking.

The report retains the complete issue count but renders only the first 200
issues, shortening untrusted labels, fields and string parameters to 500
characters. All output remains text nodes, not HTML. Unexpected failures in the
foreign-plugin import window are reported and release its busy state.

Settings scalars are reconstructed by type, and icon-picker enum values are
allow-listed. An object cannot be retained as a style name, fallback id, or
boolean and later break a picker or a saved-file reload. SVG/image constraints
are described in [Icons](13-icons.md); a JSON size cap alone cannot bound the
decoded size of an embedded compressed picture.

Prospective image collection budgets are checked again immediately before
applying either native or Admonition imports: sync can change the destination
while the user reviews the report. A changed budget produces a fatal report
before definitions or pictures are mutated.

Corrected warning copy uses new English keys so an older translation cannot
override it with a false claim about what was imported. The previous warning
keys remain in the locale tables for a later translation cleanup; no non-English
table is changed by this hardening.

### Per-field validation

- **IDs**: `ID_BAD_CHAR_RE` rejects pipes, brackets, and non-space
  whitespace (tabs/newlines) — but explicitly **permits** spaces (multi-word
  labels are valid) and, notably, permits `"` and `\`. This is exactly the
  gap [CSS generation § selector escaping](06-css-generation.md#calloutsel-vs-tokenattrsel--the-selector-escaping-rule)
  exists to cover — an imported id can carry those characters into the
  registry with nothing here to stop it.
- **Colours**: `HEX_COLOR_RE` — `#rgb` or `#rrggbb` only.
- **Icons**: `type` checked against `ICON_PACK_IDS` (derived from the pack
  registry, never hand-duplicated — so adding a new pack can never leave the
  validator rejecting icons the plugin itself now produces); Material
  `style` checked against the four known values; `weight` range-checked.
  **Icon *name* validity is checked separately and asynchronously**
  (`unknownIconNameIssues`) — after the rest of an entry validates, because
  the packs' search indexes decode on demand and it isn't worth failing an
  otherwise-fine entry over one bad icon name. A name that exists in no pack
  is replaced with `FALLBACK_ICON` (the Lucide pencil) and reported as a
  **warning**, not an error.
- **Tags/aliases**: length-capped at `MAX_TAG_LENGTH` (200 — a generous
  safety net on *imported*, untrusted data only; the editor itself imposes
  no length limit), count-capped at `MAX_TAGS_COUNT`.
- **Metadata**: every value must be a string. Keys such as `__proto__`,
  `constructor`, and `prototype` remain literal data properties through import
  and export; safe object construction avoids invoking inherited setters or
  silently discarding a metadata entry.
- **Unknown top-level fields** are reported as warnings via `KNOWN_FIELD_MAP`
  — a **total `Record`** over `keyof CalloutDefinition`, so adding a field
  to the type without adding it here is a compile error, which is what stops
  the plugin from warning about its *own* export the moment a new field
  ships.
- **`RETIRED_FIELDS`** (`solidBackground`, `styleMode`, and `externalStyle`) are dropped
  **silently**, with no warning — an export from an older build of the
  plugin itself carrying a since-retired field isn't a file the plugin
  "doesn't understand," so it doesn't get the generic unknown-field warning.
  In particular, an old `externalStyle: true` does not restore the removed
  personal-CSS ownership mode: the imported callout uses its stored appearance
  normally, and an import does not trigger the load-migration notice.

### `missingImageIssues` — pictures that didn't travel with their callout

This check runs for both the v2 envelope and legacy flat arrays. A legacy array
cannot carry pictures itself, so its image ids must already exist in the target
vault or the user sees a warning before importing.

An ordinary export carries the user's pictures inside `settings.userImages`,
so this normally finds nothing. It fires specifically when someone
hand-edits a file, or pastes one vault's exported *callouts* array beside
another vault's *settings* — without this check, a callout referencing a
picture id nobody has would simply render blank with no explanation. A
picture the target vault **already holds** under that id is fine — the id
alone is enough, and re-importing a callout back onto the device that first
made the picture is the ordinary, expected case.

### Applying: add-or-update, never a blind overwrite

```ts
for (const def of defs) {
  if (registry.has(def.id)) { applyImportedCallout(registry, def); overwritten++; }
  else { const added = registry.add(def); if (added) imported++; }
}
```

An id already in the registry is **updated in place**, not skipped or
duplicated — this is what makes re-importing the same backup, or importing
one vault's export into another that shares some built-in customizations,
converge rather than error.

Native definition imports use `registry.batch()` like the two foreign importers,
so a large accepted file triggers one change notification instead of one
stylesheet rebuild, repaint, and save request per definition.

`applyImportedCallout` clears optional appearance, palette-link, customization
and metadata fields omitted by a backup before merging the validated definition.
Thus restoring a backup does not retain later text colors, icon adjustments or
palette links. Aliases are the intentional exception: importing does not rewrite
notes, so incoming and existing aliases are united by canonical identity. Removing
an old alias remains an editor action, whose save plan protects its note usages.

### Before anything is applied

`processImportedJSON` asks, backs up and checks saving before its first
registry mutation:

1. A file with no issues shows a `ConfirmModal` summarizing what it will do:
   callout types added, existing ones replaced by the file's version, and
   setting groups restored. A file with issues has already been through
   `ImportReportModal`, which is its confirmation.
2. `blockedWhilePaused()` refuses the import while the settings writer is
   frozen. An import that cannot be saved would look done and vanish on
   restart. The **Import** button checks this too, before a file is chosen.
3. `writeSettingsBackup()` saves the current setup to `<plugin-dir>/backups/`
   and reads it back. No verified copy means no import.
4. After applying, the import awaits `saveSettings()` and asks
   `settingsWriter.persists()` whether the settings file holds the result.
   If not, it says the import is shown but not saved, instead of reporting
   success.

The foreign-plugin window (`PluginImportModal.apply`) takes steps 2–4 as well;
its report or its explicit **Import** click is the confirmation.

### Settings import: restore the groups the file carries; three lists merge by id

```ts
const present = presentSettingGroups(parsed);  // the settings keys the file itself carries
const restored = Object.keys(result.settings).filter(key => present.has(key) && !LIST_GROUPS.has(key));
Object.assign(registry.settings, pick(restSettings, restored));  // ← only those groups
registry.settings.customPalettes = mergeById(registry.settings.customPalettes, customPalettes);
registry.setUserImages(mergeById(registry.getUserImages(), userImages));
registry.settings.customCommands = mergeById(registry.settings.customCommands, customCommands);
```

`sanitizeImportedSettings()` returns a complete `PluginSettings`, filling every
group the file lacks with its default. Applying all of it made an older export
reset every setting group it predates. Only groups present in the file are
restored; 1.x files that carry `popup` restore `contextMenu`, which the merge
reads it into.

> [!IMPORTANT]
> **`customPalettes`, `userImages`, and `customCommands` are the three
> exceptions to "settings import restores the group," and this is
> deliberate, not an oversight.** Every other settings field (global style,
> context-menu config, fallback id, language) is a single value with no id
> of its own — "keep both" has no meaning for a border width, so an import
> *is* a restore for those. But these three are **lists the user builds up
> over time**, and `Object.assign`ing them from an import file would
> silently **wipe** the user's existing palettes/pictures/commands the
> moment they imported a file that predates one of them (an old export
> naming zero custom commands would delete every command built since). See
> [`mergeById`](../../src/utils/mergeById.ts): a repeated id overwrites in
> place (so re-importing the same backup rewrites, not duplicates, without
> reshuffling the list), a new id is appended, and an empty incoming list
> changes nothing at all.
>
> **The rule generalizes to any *new* settings-level list**: it must merge
> by id on import, or it will silently wipe the user's own list the same
> way. See also [Data model § `PluginSettings`](04-data-model.md#pluginsettings)
> for the three places a new settings field has to be registered.

A palette merge can produce **cross-vault duplicate colours** — two vaults
independently naming the same colour under different ids — so
`consolidateDuplicatePalettes()` runs immediately after the palette merge,
folding duplicates and re-pointing any callout that referenced the
now-merged-away id, with a one-time notice.

An import that adds callouts also triggers `ensureIconArtworkFor()` for
every imported icon whose callout doesn't hide it — see
[Icons § the only repair path](13-icons.md#ensureartworkforicons--the-only-repair-path).

## The plugin import window

Both foreign-plugin importers are one window,
[`src/settings/pluginImport/PluginImportModal.ts`](../../src/settings/pluginImport/PluginImportModal.ts),
configured by a `PluginImportSource`
([`admonitionImportSource.ts`](../../src/settings/pluginImport/admonitionImportSource.ts),
[`calloutManagerImportSource.ts`](../../src/settings/pluginImport/calloutManagerImportSource.ts)).
A source never touches the DOM. It supplies the other plugin's id (and so
where its `data.json` lives), the window's per-plugin class, the file picker's
`accept`, its i18n keys, and two readers: `fromDataJson` for the probed file,
and `fromText` for a chosen file's text or a paste. Each reader returns a
`PluginImportBatch`, which holds the entries in a closure together with the
plugin's planner and `apply` method. That lets the modal import without ever
seeing an entry type. It also keeps the modal class free of type parameters,
which `tests/modalChrome.test.ts`'s chrome scan requires. A third importer is
one more source object and one more row in `ImportSourceModal`.

**One screen, three options, exactly one Import.** The window used to show an
Import inside the "This vault" row as well as a footer Import that only read
the paste box, and Admonition's "Choose file…" imported the moment a file was
picked. A later version split the window into a vault view and a file-or-paste
view behind a header Back arrow. Now it is one screen: three option boxes
stacked in a `role="radiogroup"` (`pluginImportViews.ts`), and the footer
Import is the only import control. Which box is active, and so what Import
acts on, is decided in one place,
[`pluginImportFlow.ts`](../../src/settings/pluginImport/pluginImportFlow.ts),
as pure functions of the window's state:

| Option | Holds something when | How it is filled |
| --- | --- | --- |
| `vault` | the probe found entries | the probe, on open |
| `file` | a file is staged | clicking the empty or active box opens the file picker; dropping a file onto the box stages it |
| `paste` | the clipboard gave non-blank text | a click on the box, while empty or active: a clipboard read |

`activeOption()` is the user's last choice (`flow.chosen`) while that option
still holds something. Otherwise it is the vault once found, as the
recommended default, and otherwise nothing. Holding something is never enough
on its own: a staged file or a paste becomes active only when the user fills
or clicks it. That is what makes it safe for every option to keep what it was
given while another is active.

- **Choosing.** Each box, `.cs-option-box`, is itself the `role="radio"`:
  `aria-checked`, `aria-labelledby` its title line, `aria-describedby` its
  status line, and `tabindex="0"` while it can be chosen. Nothing sits on it.
  The **Choose file…** and **Paste** buttons that once sat at its edge, and
  the **×** that replaced them once filled, are gone, so the whole face is the
  one click target and `OptionsHandlers` is a single `onActivate`. What a
  click, Enter or Space means is decided in `PluginImportModal.activate()`.
  While an import runs, nothing. A file or paste box that is empty, or that is
  already the active one, is filled (again): the file picker opens, or the
  clipboard is read. A box that holds something but isn't active becomes
  active, and `markActive()` flips `is-selected` and `aria-checked` in place
  without a redraw, so focus stays where it was. The vault box can only be
  chosen: it takes clicks once the probe has found something, and never if it
  finds nothing.
- **The group is named by the window's title.** `renderOptions` takes the
  modal's title element as `label`, gives it an id if it has none, and points
  the radiogroup's `aria-labelledby` at it. It used to be an `aria-label`, but
  Obsidian turns any `aria-label` into a hover tooltip, looking it up from the
  hovered element with `matchParent("[aria-label]")`, so the group's "Import
  from …" popped up over every box.
- **The active box** wears `is-selected`: a 2px `--interactive-accent`
  border (the border plus a 1px inset shadow, so nothing shifts) and an 8%
  accent wash. A box that holds something but isn't active shows only its
  success state (`is-filled`: `file-check`/`clipboard-check`, the file name or
  "Pasted from the clipboard", and "Ready to import.").
- **Hover.** Every selectable box that isn't active gets a subtle neutral
  `--background-modifier-hover` wash and a clearer
  `--background-modifier-border-focus` border, in all three windows. The active box
  lightens its wash a step with `--interactive-accent-hover`, the lighter
  accent in both themes: 12% under `.theme-dark` and 4% under `.theme-light`,
  since lighter means more of it over a dark window and less over a light one.
  On an enabled, unselected box, the shared **Recommended** pill also deepens
  its fill to `--background-modifier-border-focus`, keeping it distinct from
  the row wash. A selected box keeps the pill's resting fill.
  All hover rules sit inside `@media (hover: hover)`, as Obsidian guards its own
  button hovers, so a tapped box on a phone doesn't stay lit.
- **The probe.** `probeVault` reads the file rather than asking
  `app.plugins`, because a plugin being migrated off is often already
  disabled. If `data.json` is missing, it checks the plugin folder: a missing
  folder is `notInstalled`; a folder without a settings file is `empty`.
  A file with no custom entries and an empty `{}` are also `empty`.
  A file that can't be read, parsed, or recognized is
  `unreadable`. Once found, the vault box carries the shared grey
  **Recommended** pill (`settings/recommendedBadge.ts`, also used by
  `ExportFormatModal`'s backup row) on its title line. Once `notInstalled`,
  `empty`, or `unreadable`, it stays on screen with `is-disabled`,
  `aria-disabled`, no activation handlers, and no tab stop. The icon, title,
  and empty-state description use `--text-faint`; unreadable-file descriptions
  retain their warning color. The cursor is `not-allowed`, and the disabled
  box receives no hover wash. The new not-installed messages live only in
  `en.ts`; other locales use the existing per-key English fallback.
  While the probe is still checking, the vault box can't be chosen
  but isn't greyed, and its "Looking for…" line is held back 250ms so a fast
  probe never flashes it. A `role="status"` live region, created before the
  probe starts, announces the result. A probe that settles after the user
  staged a file leaves the file active.
- **Paste reads the clipboard at the click.** `navigator.clipboard.readText()`
  runs from the paste box's own click handler, through `activate()`. It is the
  same call Obsidian's own mobile editor makes for its Paste menu item. There
  is no text box. Non-blank text replaces any paste already held, makes the
  option active, and sends focus to Import. Blank text is
  `import.clipboardEmpty` and a rejected read is `import.clipboardUnreadable`;
  either is announced, and neither stages anything. With no paste held, the
  error also shows in the box's status line as a warning. With one held (the
  active box clicked again after the clipboard was emptied, or a phone's paste
  prompt dismissed), the error is only announced: the held paste stays,
  still "Ready to import." and still active, and nothing is redrawn. The text
  is kept as it was read, and `fromText` runs on it only when Import is
  pressed, as a file's does.
- **Staging a file.** Choosing a file in the picker or dropping one onto the
  file box only stages it. Either action replaces any file staged before,
  makes the file option active, and sends focus to Import. A picker closed
  without a file changes nothing. The file is read when Import is pressed,
  not when it is staged, so a file staged and then replaced is never opened.
  A read that fails (an evicted cloud file, for example) is reported as
  `import.err.fileUnreadable`.
- **Filling again, never emptying.** A file is swapped by clicking the active
  box again or dropping another file onto it; a paste is brought up to date by
  clicking its active box again. Nothing can empty an option:
  there is no Remove or Clear, and a staged file or a paste lasts until it is
  replaced or the window is closed and reopened (`onOpen` resets both). That
  is safe because Import only ever acts on the active option. Whatever an
  inactive box still holds is never read, and it becomes active only when the
  user clicks it or drops a new file onto the file box. That first click on an
  inactive filled box only chooses it,
  so switching back to a file or a paste never reopens the picker or reads the
  clipboard again.
- **No Back, no view state, no Escape handling of its own.** With a single
  screen there is nothing to step back to, so the window no longer overrides
  `onHistoryBack` or `onEscapeKey`. Escape and the back gesture close it as
  they close any Obsidian modal.
- **Redraws.** Filling an option, a paste that fails with none held, and the
  probe settling redraw the three boxes. Focus goes to Import after a file is
  staged or a paste lands; otherwise it goes back to whichever option's box
  had it (`focusInView()`). Choosing between filled options only re-syncs, and
  a failed re-read over a held paste touches nothing but the live region.
- **The footer.** Import is soft-disabled with `aria-disabled` and
  `cs-btn-disabled`, like the callout editor's Save, rather than with
  `disabled`. It stays focusable, and Obsidian can return focus to it when the
  stacked `ImportReportModal` closes. Its `aria-describedby` points at the
  active box's title line and status line. While an import runs, its label
  reads "Importing…" and every handler is a no-op.
- **Stale work is dropped.** A generation counter bumps on every open, in
  `close()` and in `onClose()`. The `close()` bump matters on a phone, where
  Obsidian slides the window out before it calls `onClose`. A probe, a
  clipboard read, a file read, a plan, or a report that finishes after the
  window was asked to close writes nothing to the DOM and applies nothing.
  After a successful import, Import stays on "Importing…" while the window
  leaves, so a second tap can't import again.

Every route then ends in the same sequence: plan, then `ImportReportModal`
when there are issues or no entries at all, then apply, then
`markCompetitorImportBannerHandled`, then a notice, then `ctx.display()`, then
close. The source's `afterApply` runs last; Admonition uses it for
`ensureIconArtworkFor`.

## Import from Callout Manager

[`src/utils/calloutManagerImport.ts`](../../src/utils/calloutManagerImport.ts)
+ `calloutManagerFormat.ts`. **Three entry routes, one shape, one planner** —
whichever route data arrives by, it becomes a `CalloutManagerEntry[]` and
goes through the same `planCalloutManagerImport`:

1. **Read Callout Manager's own `data.json` straight out of this vault.**
   Nothing is exported from that plugin first, and nothing is written back
   to it. This route brings over **more** than the clipboard route: colours
   Callout Manager stored **separately per light/dark scheme** arrive as
   both (`colorLight`/`colorDark`), and callouts the user created but never
   restyled (`declared: true`, no colour) come across too — neither of
   which the CSS-copy route can see at all, since a copied stylesheet is
   already flattened to whichever scheme was active when it was copied.
2. **Paste the CSS the plugin's own "Copy" button puts on the clipboard** —
   read by a click on the window's paste box and parsed directly
   (`.callout[data-callout="test"] { --callout-icon: ...; --callout-color:
   ... }`). A `data.json` copied as text works too; the first character
   tells the two apart (`{` or `[` is JSON), so a JSON syntax error is
   reported as one instead of being retried as CSS.
3. **Choose a file** (`.json` or `.css`) — Callout Manager's `data.json` from
   another vault, or its copied styles saved as a file. The file's text goes
   through exactly the same reader as a paste.

`declared` is the flag that lets one planner serve both doors without either
route needing to know which one is calling: a copied stylesheet never sets
it (so a colourless block is correctly treated as noise, since a plain CSS
rule with no colour teaches nothing), while a callout genuinely created in
Callout Manager (even one that plugin stored no colour for) is still worth
importing, because it exists in the user's notes either way.

An unstyled callout defaults to `#9e9e9e` — deliberately matching Callout
Manager's own default grey (its `default_colors.json`, "light gray") rather
than this plugin's own house colour, because fidelity to what the user was
actually looking at beats consistency with this plugin's conventions here.

The CM apply path keeps the resolved accents and palette link but explicitly
clears `bgColorLight` and `bgColorDark`: the source supplies an accent, so block
callouts must use core/the theme's translucent background instead of baking the
palette's stronger default tint. The shared palette resolver and Admonition
import are unchanged. This applies to new rows and color-bearing updates;
icon-only updates preserve the existing colors and background.

Re-importing repairs old CM imports in place. A load-time migration cannot
safely identify them: old imports have no provenance marker and can be identical
to manually styled, palette-linked rows. Existing palettes and unrelated rows
are therefore left intact. Opening/saving the callout editor does not recreate
the background; explicitly choosing or editing a palette still applies that
palette's authored appearance.

**Per-theme styling and custom CSS have no equivalent and are left behind**
— reported to the user before the import runs, same as the JSON importer's
report modal.

Callout Studio has one icon per definition, so scheme-dependent icons are
flattened with a warning. A custom-CSS-only entry reports its lost styling
without falsely counting an existing callout as updated. Duplicate incoming
JSON ids are compared by canonical identity and skipped with a report instead
of silently letting a later spelling overwrite an earlier one.

## Import from Admonition

[`src/utils/admonitionImport.ts`](../../src/utils/admonitionImport.ts) +
`admonitionFormat.ts`, structured identically to the Callout Manager
importer for the same reason: **planning is read-only against the registry;
`CalloutRegistry.applyAdmonitionImport` is the only mutator**, so a report
can be shown before anything changes.

Three entry routes: Admonition's own `data.json` read straight out of the
vault (again: nothing exported first, nothing written back), an
`admonitions.json` file, or JSON read from the clipboard by a click on the
window's paste box.

- **Every icon library Admonition offers maps to one this plugin already
  has** — its own bundled set, Font Awesome, Octicons, and RPG Awesome are
  all libraries this plugin also carries. Pictures the user uploaded into
  Admonition come across into **Your images**
  (`convertAdmonitionImage` — same re-encode-through-canvas pipeline as a
  fresh upload, see [Icons § Your images](13-icons.md#your-images--the-local-never-downloaded-source)).
- **A missing colour** defaults to `#448aff` (Obsidian's own Note blue) —
  deliberately **not** Admonition's own behaviour of picking a random colour
  per import, which the source comment calls out as "friendly in the moment
  and unrepeatable afterwards": importing the same file twice would
  otherwise give the same callout two different looks each time.
- **Behavior that does not migrate is reported** when `command`, `copy`, or
  `noTitle` is enabled or `injectColor` is false. `iconWithCss` also warns:
  its appearance depends on CSS that does not come with the import. Global
  Admonition settings are not restored, and importing definitions does not
  convert any `ad-*` code blocks in notes.
- **Icon lookup uses own properties**, including Admonition's historical icon
  aliases: prototype names cannot become a library object. Its RPG Awesome
  names `montains` and `perspective-dice-six-two` map to this plugin's corrected
  `mountains` and `perspective-dice-two`. An explicit pack is the faithful
  choice for ambiguous names: upstream inference depends on its loaded pack
  order, while this importer uses a deterministic order.
- **An update never renames a callout unless the admonition explicitly
  stated a title** — `AdmonitionEntry.displayName` is only set on an update
  branch when the source file carried an explicit `title` field, so
  re-importing a file that predates a rename the user made locally doesn't
  clobber it.

---
Next chapter: [16-settings-ui-and-modals.md](16-settings-ui-and-modals.md)
