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
with the same Lucide `paintbrush` icon. Import's chooser sets its two other
plugins under a **From another plugin** caption (`renderOptionGroupLabel`, a
plain `div.cs-option-group-label` inside the same list, in the small capitals
a combobox group wears), so the window reads as "your own backup, or somebody
else's data" rather than as three equal rows. Export
marks its backup with the shared grey **Recommended** pill (`settings/recommendedBadge.ts`) on its title line rather
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
icon, title, description and badge. A box comes in two forms, told apart by
whether it is given an `onActivate`:

- **A choice** — a chooser's box. The whole box is the control
  (`role="button"`, `tabindex="0"`, a chevron at its trailing edge) with click,
  Enter, and Space handling. Only the first click of a double-click and the
  first keydown of a held key activate it, so one gesture cannot open the file
  picker twice or start a second export.
- **A card** — no `onActivate`: the box alone, with no role, no focus stop,
  no chevron and no listeners. The plugin import window builds its two
  options on it and adds what is its own to say — a radio dot, a button, a
  text box (see [the plugin import window](#the-plugin-import-window)).
  `renderOptionBox()` returns the card's `titleEl` and `descEl` so that window
  can rewrite them in place.

### How an option box is drawn

A box is drawn as the settings lists draw a callout row
(`.callout-studio-row`), so the three windows read as part of the same plugin
rather than as dialogs of their own:

- **A borderless pill on the raised surface.** `border-radius: 8px`, no border,
  and `var(--cs-surface-raised, var(--background-secondary))` as its fill. The
  icon sits on a 36px tile painted `var(--cs-surface, var(--background-primary))`
  — the window's own colour, as a row's syntax chip is — and so does the
  **Recommended** pill. Those two tokens are the pair
  [Settings UI and modals](16-settings-ui-and-modals.md) describes, and nothing
  else may be used here: on mobile dark `--background-secondary` *is* the
  window, and a box painted with it directly disappears.
- **Chrome stays grey-lit.** The icon is `--text-muted`, Obsidian's own icon
  grey, not `--text-accent`, and it stays that grey whatever the box comes to
  hold: nothing on a box turns green. The accent is spent on exactly one thing,
  the active card of the plugin import window (and the dashed outline a dragged
  file lands in, `is-drop-target`). `tests/importBoxStyles.test.ts` fails on
  any other option-box or import-card rule that names the accent, and on any
  `.cs-option-*` or `.cs-import-*` rule that names a success colour.
- **The mark at the trailing edge says what a click does.**
  `.cs-option-box-mark` is `aria-hidden` decoration with no role and no focus
  stop: a `chevron-right` in `--text-faint` (Obsidian mirrors it under
  `.mod-rtl`), drawn on a choice only, because the click opens something. A
  plugin import card ends in a radio dot instead, because a click there only
  chooses.
- **Hover.** A choice steps its own fill 7% toward `--text-normal` — darker
  over a light window, lighter over a dark one — and its chevron goes from
  `--text-faint` to `--text-muted`. (A callout row hovers to
  `--background-secondary-alt` instead, which on a light desktop is nearly the
  window's white: fine for a row whose buttons carry the feedback, too faint
  for a box that is itself the button.) A plugin import card takes the same
  step only while a click would change something (`is-choosable`: it holds
  something and is not the active one). All hover rules sit inside
  `@media (hover: hover)`, as Obsidian guards its own button hovers, so a
  tapped box on a phone doesn't stay lit.
- **Type.** The title is `--font-ui-medium` semibold; the status line is
  `--font-ui-smaller` in `--text-muted`, the size of a settings description.

The three windows share one `max-width` (520px), so stepping from Import's
chooser into a plugin import window doesn't resize the window under the pointer.

### Two export formats

Neither export format records device history or creates a vault settings backup.
JSON serializes the displayed registry and passes it to `downloadText()`; CSS
writes the snippet. Neither invokes the settings writer or recovery service.

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

The Callout Manager importer's paste route can parse a limited subset from
either Callout Manager CSS or a Callout Studio snapshot, pasted from the
clipboard. This is a partial recovery/migration path, not a restore of the
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
applyPaletteMerge(registry, mergePalettes(registry.settings.customPalettes, customPalettes));  // by id AND by name
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
> changes nothing at all. Palettes layer a name match on top of this rule —
> see below.
>
> **The rule generalizes to any *new* settings-level list**: it must merge
> by id on import, or it will silently wipe the user's own list the same
> way. See also [Data model § `PluginSettings`](04-data-model.md#pluginsettings)
> for the three places a new settings field has to be registered.

**Palettes are also matched by name.** They use
[`mergePalettes`](../../src/utils/mergePalettes.ts) rather than plain
`mergeById`, because the palette editor treats the *name* as the
palette's identity (it refuses a second palette under a taken name,
case-insensitively) and its auto-suggested name for any blue is "Blue 2". Two
vaults that each made a blue palette therefore carry a "Blue 2" apiece under
different ids, and merging by id alone left both in the list — twins no
dropdown could tell apart.

- An incoming palette whose **id or name** (`normalizeName`: trimmed,
  case-insensitive) matches palettes the vault already had **replaces them in
  place, keeping the vault's id**. Local callouts therefore stay linked, and the
  palette keeps its place in the list. A vault holding several palettes under
  that name (the state the older merge left behind) has them all rewritten to
  the file's version, which makes them identical for the consolidation below to
  fold — so importing the file again repairs such a vault.
- A palette the file has itself written is never matched by name again, so a
  file that carries two same-named palettes brings both across instead of one
  eating the other.
- `PaletteMerge.remap` records file id → vault id for the name matches, and
  `applyPaletteMerge` re-points the callouts the file brought for it with
  `registry.relinkPalette`. `PaletteMerge.restyled` lists the palettes whose
  *colours* changed; `applyPaletteMerge` repaints their linked callouts with
  `registry.applyPaletteColors`, the call editing a palette makes, so a
  callout the file does not carry follows its palette instead of keeping the old
  look under the same name. Nothing is repainted when the colours are the ones
  the vault already had, which is also what keeps re-importing a file inert.
  This applies to an id match as well as a name match.

A palette merge can also produce **cross-vault duplicate colours** — two
vaults independently making the same colour under different names and ids — so
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
where its `data.json` lives), the window's per-plugin class, its one fallback
(`manual`), its i18n keys, and two readers: `fromDataJson` for the
probed file, and `fromText` for the fallback's text. Each reader returns a
`PluginImportBatch`, which holds the entries in a closure together with the
plugin's planner and `apply` method. That lets the modal import without ever
seeing an entry type. It also keeps the modal class free of type parameters,
which `tests/modalChrome.test.ts`'s chrome scan requires. A third importer is
one more source object and one more row in `ImportSourceModal`.

**One screen, at most two options, exactly one Import.** The window used to
show an Import inside the "This vault" row as well as a footer Import that only
read the paste box, and Admonition's "Choose file…" imported the moment a file
was picked. Later versions split it into views behind a header Back arrow,
made each option a box that was its own button — one of which read the
clipboard the moment it was clicked, which nothing on screen announced — and
then showed one option at a time behind a small text link, which hid the
choice. Now both options are on one screen:

- **This vault** — a card saying what was found. On screen while the probe is
  still looking and once it has found something.
- **The source's one fallback** — always on screen, and alone when the vault
  holds nothing to import.

The fallback is the source's to name —

```ts
type PluginImportManual =
  | { kind: "file"; accept: string }        // Admonition: `.json`
  | { kind: "paste"; placeholder: string }; // Callout Manager
```

— matching what each plugin hands its users: Admonition's export button writes
a file, so its window takes an uploaded file; Callout Manager's Copy button
fills the clipboard, so its window has a text box and a Paste button. The
footer Import is the only import control. Which option is active, and so what
Import acts on, is decided in one place,
[`pluginImportFlow.ts`](../../src/settings/pluginImport/pluginImportFlow.ts),
as pure functions of the window's state. The flow knows the fallback only as
`manual`; whether that is a file or pasted text is the window's and the
source's business, which is what makes a third route structurally impossible
rather than merely not drawn:

| Option | Holds something when | How it is filled |
| --- | --- | --- |
| `vault` | the probe found entries | the probe, on open |
| `manual` (a file) | a file is staged | **Upload** opens the file picker; dropping a file onto the card stages it |
| `manual` (pasted text) | the text box holds something other than whitespace | the user pastes or types into it, or presses **Paste** |

`vaultOffered()` is true while the probe is `checking` or `found`.
`activeOption()` is the user's last choice (`flow.chosen`) while that option
still holds something; otherwise the vault once found, as the recommended
default; and otherwise whatever the fallback holds, being the only thing on
screen. Filling the fallback — a file staged, text typed or pasted — chooses
it; a click on the vault card, or on its radio dot, chooses the vault. Each
option keeps what it was given while the other is active, and Import only ever
reads the active one.

- **The cards** (`renderOptions`,
  [`pluginImportViews.ts`](../../src/settings/pluginImport/pluginImportViews.ts))
  are option boxes drawn as cards (`.cs-import-vault`, `.cs-import-manual`),
  built **once** per open. `update()` writes everything that changes in place —
  the count, the Recommended pill, a staged file's name, which card is active —
  so nothing the user is in is ever replaced: the Upload button that becomes
  Replace is the same button, typing never moves the caret, and the probe
  settling touches neither the text box nor focus.
- **Choosing.** While both cards are there, the list is a
  `role="radiogroup"` named by the window's title (`aria-labelledby`, never an
  `aria-label`, which Obsidian would pop up as a tooltip over every card), and
  each card ends in a radio dot, `.cs-import-radio`: `role="radio"`,
  `aria-checked`, `aria-labelledby` its card's title line, `aria-describedby`
  its status line. The dot, not the card, is the radio, because a radio may
  hold no control and the fallback's card holds a button and, for a paste, a
  text box. The whole card is still one pointer target for the same thing: a
  click anywhere on it chooses it — except on its own button or text box
  (`closest("button, textarea")`), which does what it says instead. Enter and
  Space on a dot choose it; a held key is claimed but counted once. A dot is a
  focus stop only while its card holds something; an empty fallback's dot is
  `aria-disabled` and faded, and a click on the empty card or its dot chooses
  nothing — it waits to be filled by its own button or box, and a notice says
  which: `import.uploadFirst` (Admonition) or `import.pasteFirst` (Callout
  Manager), picked by `source.manual.kind`. Going back into a text box that
  holds text (`focus`) chooses it; focus entering an *empty* box is silent,
  since the user is about to paste (`onPasteFocus` rather than `onChoose`). Choosing flips `is-selected` and
  `aria-checked` in place.
- **The active card** wears `is-selected`: a 2px `--interactive-accent` ring
  (an inset `box-shadow`, so nothing shifts) over an 8% accent tint of the
  card's own fill, and its radio dot fills with `--checkbox-color` and shows
  its check. A card a click would change wears `is-choosable` and steps its
  fill on hover, like a chooser's box.
- **Nothing in the vault.** When the probe settles on `notInstalled`, `empty`,
  or `unreadable`, the vault card is removed, and with it the radiogroup role
  and the fallback's radio dot: alone, it has nothing to be chosen against, and
  wears no ring, and a click on its card says nothing. **Nothing says why** —
  no greyed-out card, no line saying the plugin isn't installed, and nothing
  announced. The three probe results stay
  distinct in `probeVault` and the flow; the window simply treats them alike.
  Their sentences are retired keys.
- **The instructions** above the cards — what comes over and what is left
  behind — are a caption (`.cs-import-instructions`: `--font-ui-small`,
  `--text-muted`), set as the Restore window sets its own intro.
- **The probe.** `probeVault` reads the file rather than asking
  `app.plugins`, because a plugin being migrated off is often already
  disabled. If `data.json` is missing, it checks the plugin folder: a missing
  folder is `notInstalled`; a folder without a settings file is `empty`.
  A file with no custom entries and an empty `{}` are also `empty`.
  A file that can't be read, parsed, or recognized is `unreadable`. Once
  found, the vault card carries the shared grey **Recommended** pill
  (`settings/recommendedBadge.ts`, also used by `ExportFormatModal`'s backup
  row) on its title line. While the probe is still checking, the vault card
  says "Looking for…", its dot takes no focus, and the card
  (`.cs-import-vault.is-checking`) is held back 250ms, so a fast probe never
  flashes it before it goes or before the count replaces it. The fallback is
  usable from the start, so a probe that never settles cannot lock the window;
  a probe that settles after the user filled the fallback leaves their choice
  alone. A `role="status"` live region, created before the probe starts,
  announces the count once found (and nothing otherwise). Its text-only box
  uses `opacity: 0` and `pointer-events: none` to remain unpainted and ignore
  pointer hits while keeping its geometry and accessibility.
- **Pasting** (Callout Manager's window). The paste card holds a plain
  `<textarea>` on a line of its own under the card's head (the card is
  `flex-wrap: wrap`; the box is `flex: 0 0 100%`), named and described by the
  card's own title and status lines (`aria-labelledby`/`aria-describedby`),
  with the source's `manual.placeholder`. It opts into `.cs-text-control` for
  the shared field face, and `.cs-import-paste-input` gives it **one fixed
  height** (132px) with `resize: none` and `overflow: auto`: it scrolls
  instead of growing with what is pasted, so the footer stays where it was. It
  is monospace and `direction: ltr`, since what goes in is CSS or JSON (in a
  right-to-left window a rule would otherwise read `} selector.`); only while
  `:placeholder-shown` does it take the window's own direction, for the
  translated placeholder. Its `input` handler keeps the text as typed
  (`setPaste()`), counts whitespace alone as nothing to import, and chooses
  the card. `fromText` runs on it only when Import is pressed, as a file's
  does, after `assertImportTextSize`; text that fails to parse is reported and
  stays in the box to correct.
- **The Paste button** (`pasteFromClipboard()`) is **the only clipboard read in
  the window**: `navigator.clipboard.readText()` from the button's own click,
  the same call Obsidian's mobile editor makes for its Paste menu item. It
  used to happen when the paste box itself was clicked, which looked like
  nothing had happened or, on a phone, raised a paste prompt nobody asked for;
  now a button says what it does and the result is there to see, in the box.
  Non-blank text replaces whatever the box held, chooses the card, and sends
  focus to Import. Blank text is an `import.clipboardEmpty` notice, a rejected
  read (or no clipboard API at all) an `import.clipboardBlocked` notice, and
  text over the import size limit that limit's own notice; each leaves the box,
  the choice and focus as they were. (`import.clipboardBlocked` is a new key
  rather than new words under the old, since removed, key that told the user
  to choose a file instead — advice this window can't honour, and that an
  older translation would keep giving.) A read that answers after the
  window was asked to close does nothing.
- **Uploading a file** (Admonition's window). The file card carries a
  standard `<button class="cs-import-action">` before its radio dot that reads
  **Upload**, `aria-describedby` the card's two lines. Picking a file, or
  dropping one onto the card, only stages it (`stageFile()`): the card is
  rewritten in place — its title becomes the file's name
  (`cs-option-box-name`, `dir="auto"`), its status line "Ready to import.",
  and **the same button now reads Replace** — and the file becomes the active
  option. Its icon does not change and nothing turns green; the confirmation
  is an Obsidian `Notice` — `import.fileUploaded` for a first file,
  `import.fileReplaced` for one that replaces a file already staged, each
  naming the file. Focus goes to Import. A picker closed without a file
  changes nothing and says nothing. The file is read when Import is pressed,
  not when it is staged, so a file staged and then replaced is never opened.
  A read that fails (an evicted cloud file, for example) is reported as
  `import.err.fileUnreadable`, and the file stays staged to be replaced. The
  file input and the drop handlers exist only in a window whose fallback is a
  file: Callout Manager's builds no `<input type="file">`, and neither its
  cards nor its text box are drop targets.
- **A card's own button** (Upload/Replace, Paste) takes the shared neutral face
  and border explicitly (`.cs-option-box .cs-import-action`), as a footer's
  Cancel does: on a phone Obsidian's own button face is the card's colour, and
  the border is what keeps it a button there. Hovering a choosable card shifts
  its one action button toward the window's surface; hovering the button itself
  uses its usual hover face. The card-hover selector targets
  `.cs-import-action:not(:hover)` directly, without querying the parent's
  descendants with `:has()`.
- **Replacing, never emptying.** A file is swapped with **Replace** or by
  dropping another onto the card; pasted text is edited in its box or replaced
  with **Paste**. A staged file lasts until it is replaced or the window is
  closed and reopened (`onOpen` resets both). That is safe because Import only
  ever acts on the active option.
- **No Back, no Escape handling of its own.** With one screen there is nothing
  to step back to, so the window does not override `onHistoryBack` or
  `onEscapeKey`; Escape and the back gesture close it as they close any
  Obsidian modal.
- **The footer.** Import is soft-disabled with `aria-disabled` and
  `cs-btn-disabled`, like the callout editor's Save, rather than with
  `disabled`. It stays focusable, and Obsidian can return focus to it when the
  stacked `ImportReportModal` closes. Pressed with nothing to import, it
  raises the same `import.uploadFirst` / `import.pasteFirst` notice — except
  while the probe is still `checking`, when the vault may yet arm it. Its
  `aria-describedby` points at the active card's title line and status line. While an import runs, its label
  reads "Importing…" and choosing, Upload, Paste and a drop are no-ops.
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
+ `calloutManagerFormat.ts`. **Two entry routes, one shape, one planner** —
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
   pasted into the window's text box (by hand, or with its **Paste** button)
   and parsed directly
   (`.callout[data-callout="test"] { --callout-icon: ...; --callout-color:
   ... }`). A `data.json` copied as text works too; the first character
   tells the two apart (`{` or `[` is JSON), so a JSON syntax error is
   reported as one instead of being retried as CSS. That is also how a
   `data.json` from *another* vault comes over now that the window has no
   file option: opened, copied, and pasted.

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

Two entry routes: Admonition's own `data.json` read straight out of the
vault (again: nothing exported first, nothing written back), or an uploaded
file — an `admonitions.json` its export button wrote, a shared pack, or a
`data.json` taken from another vault.

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
