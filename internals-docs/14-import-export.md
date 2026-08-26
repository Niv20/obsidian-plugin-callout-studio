# Import and export

Covers the JSON backup format, the validator, the CSS-snippet export (recap
— full mechanics in [Persistence and caching](07-persistence-and-caching.md#the-user-requested-css-snippet-export)),
and the two foreign-plugin importers (Callout Manager, Admonition).

## Export

`ImportSourceModal` and `ExportFormatModal` are each a single settings row
opening a chooser — one picks a source, the other picks a format — rather
than one top-level row per option, per the project's own stated design
rationale ("a second top-level row for a new format would leave the two
halves of one section shaped differently").

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
   A legacy `exportToJSON()` (flat array, no envelope, no settings) still
   exists and is kept **because it's part of the public plugin API surface**
   — the importer accepts both shapes.
2. **CSS snippet (`.css`)** — see
   [Persistence and caching](07-persistence-and-caching.md#the-user-requested-css-snippet-export)
   for the full write/overwrite/fingerprint mechanics. In short: block-role
   callouts only, a snapshot (not live-linked), byte-identical re-export
   writes nothing, and a foreign/hand-edited file at the target path prompts
   before overwriting.

## Import — the JSON backup

[`src/utils/importValidator.ts`](../src/utils/importValidator.ts) (~1,250
lines) is the gate every import file passes through before a single
`registry.add()`/`update()` call happens. `validateImportPayload(raw,
registry)` accepts **both** the legacy flat-array shape and the v2 envelope,
never bails early on one bad entry, and collects **every** issue across the
whole file in one pass — so `ImportReportModal` can show the complete
picture at once rather than one error at a time across repeated attempts.

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
- **Unknown top-level fields** are reported as warnings via `KNOWN_FIELD_MAP`
  — a **total `Record`** over `keyof CalloutDefinition`, so adding a field
  to the type without adding it here is a compile error, which is what stops
  the plugin from warning about its *own* export the moment a new field
  ships.
- **`RETIRED_FIELDS`** (currently just `solidBackground`) are dropped
  **silently**, with no warning — an export from an older build of the
  plugin itself carrying a since-retired field isn't a file the plugin
  "doesn't understand," so it doesn't get the generic unknown-field warning.

### `missingImageIssues` — pictures that didn't travel with their callout

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
  if (registry.has(def.id)) { registry.update(def.id, def); overwritten++; }
  else { const added = registry.add(def); if (added) imported++; }
}
```

An id already in the registry is **updated in place**, not skipped or
duplicated — this is what makes re-importing the same backup, or importing
one vault's export into another that shares some built-in customizations,
converge rather than error.

### Settings import: replace wholesale, except three lists that merge by id

```ts
const { customPalettes, userImages, customCommands, ...restSettings } = result.settings;
Object.assign(registry.settings, restSettings);   // ← wholesale replace
registry.settings.customPalettes = mergeById(registry.settings.customPalettes, customPalettes);
registry.setUserImages(mergeById(registry.getUserImages(), userImages));
registry.settings.customCommands = mergeById(registry.settings.customCommands, customCommands);
```

> [!IMPORTANT]
> **`customPalettes`, `userImages`, and `customCommands` are the three
> exceptions to "settings import replaces wholesale," and this is
> deliberate, not an oversight.** Every other settings field (global style,
> context-menu config, fallback id, language) is a single value with no id
> of its own — "keep both" has no meaning for a border width, so an import
> *is* a restore for those. But these three are **lists the user builds up
> over time**, and `Object.assign`ing them from an import file would
> silently **wipe** the user's existing palettes/pictures/commands the
> moment they imported a file that predates one of them (an old export
> naming zero custom commands would delete every command built since). See
> [`mergeById`](../src/utils/mergeById.ts): a repeated id overwrites in
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
[Icons § the only repair path](12-icons.md#ensureartworkforicons--the-only-repair-path).

## Import from Callout Manager

[`src/utils/calloutManagerImport.ts`](../src/utils/calloutManagerImport.ts)
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
   parsed directly (`.callout[data-callout="test"] { --callout-icon: ...;
   --callout-color: ... }`).

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

**Per-theme styling and custom CSS have no equivalent and are left behind**
— reported to the user before the import runs, same as the JSON importer's
report modal.

## Import from Admonition

[`src/utils/admonitionImport.ts`](../src/utils/admonitionImport.ts) +
`admonitionFormat.ts`, structured identically to the Callout Manager
importer for the same reason: **planning is read-only against the registry;
`CalloutRegistry.applyAdmonitionImport` is the only mutator**, so a report
can be shown before anything changes.

Two entry routes: Admonition's own `data.json` read straight out of the
vault (again: nothing exported first, nothing written back), or an
`admonitions.json` file / pasted JSON.

- **Every icon library Admonition offers maps to one this plugin already
  has** — its own bundled set, Font Awesome, Octicons, and RPG Awesome are
  all libraries this plugin also carries. Pictures the user uploaded into
  Admonition come across into **Your images**
  (`convertAdmonitionImage` — same re-encode-through-canvas pipeline as a
  fresh upload, see [Icons § Your images](12-icons.md#your-images--the-local-never-downloaded-source)).
- **A missing colour** defaults to `#448aff` (Obsidian's own Note blue) —
  deliberately **not** Admonition's own behaviour of picking a random colour
  per import, which the source comment calls out as "friendly in the moment
  and unrepeatable afterwards": importing the same file twice would
  otherwise give the same callout two different looks each time.
- **Settings with no equivalent are dropped in silence** (`command`, `copy`,
  `noTitle`, `injectColor`) — nothing useful to say about a concept this
  plugin doesn't have. **`iconWithCss` is the one exception that warns**,
  because it means the admonition's entire appearance actually lives in a
  CSS snippet that is *not* coming along with the import — silence there
  would leave the user wondering why an imported type looks unstyled.
- **An update never renames a callout unless the admonition explicitly
  stated a title** — `AdmonitionEntry.displayName` is only set on an update
  branch when the source file carried an explicit `title` field, so
  re-importing a file that predates a rename the user made locally doesn't
  clobber it.

---
Next chapter: [15-settings-ui-and-modals.md](15-settings-ui-and-modals.md)
