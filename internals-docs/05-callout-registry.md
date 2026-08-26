# Callout registry

[`src/manager/CalloutRegistry.ts`](../src/manager/CalloutRegistry.ts) (~2,100
lines — one of the handful of files exempted from the 300-line rule, tracked in
`tests/repoSourceRules.test.ts`) is the single source of truth for every
callout definition and every setting. `CSSInjector`, `AutoComplete`,
`SettingsTab`, the public API, discovery — everything reads through it, and
every mutation of callout data goes through its methods.

## Shape

```ts
class CalloutRegistry {
  private callouts: Map<string, CalloutDefinition>;
  private builtInDefaults: Map<string, CalloutDefinition>;  // frozen copy of the 13 shipped defaults
  settings: PluginSettings;
  iconSvgCache: IconSvgCacheEntry[];
  // + a preview slot (previewActiveId / previewShadowedDef / previewIsDemo)
  // + a batch depth counter
}
```

`builtInDefaults` is a `structuredClone` of `DEFAULT_CALLOUTS`, built once in
the constructor, and is never mutated. It's the yardstick `isModified()` and
`isUnmodifiedBuiltIn()` compare against, and what `resetBuiltIn()` restores
from.

## Sources

`CalloutDefinition.source` records provenance, not appearance:

| Source | Meaning |
| --- | --- |
| `builtin` | One of the 13 defaults in `constants.ts` |
| `user` | User-created, or a foreign import (Callout Manager / Admonition) |
| `fallback` | Auto-created by discovery for an unknown ID |
| `theme` | A row minted from the **active theme's** stylesheet — an overlay, never persisted. See [21-theme-callout-discovery.md](21-theme-callout-discovery.md) |
| `plugin` | Injected by an older build's now-removed public API, or an import that carried that tag |

`builtIn: boolean` is a separate field that's redundant with
`source === "builtin"` in the common case — but `savedCalloutRows.ts`'s
reconciliation logic (below) is precisely the code that has to handle the two
disagreeing on data that predates or bypasses that invariant.

## Load

```ts
load(data: Partial<PluginData> | null): void
```

Order matters here — every step depends on the ones before it:

```text
1. clear the map
2. seed all 13 built-ins from builtInDefaults (unconditionally — this always happens)
3. if no data: return (fresh install; done)
4. fold each saved row over the matching seeded built-in via reconcileSavedRow()
5. merge settings via mergeSavedSettings()
6. restore iconSvgCache; fold pre-2.4 materialSvgCache into it (migration)
7. migrate any icon.type === "svg" (removed pack) → lucide pencil
8. migrate v2.7.0–2.7.1's over-eager "lucide-" prefixing (resolveLucideId)
9. migrate recolor from picture-level to per-callout (icon.recolor)
10. dropStaleTransparencyFlags()          — BEFORE step 12, see below
11. consolidateDuplicatePalettes()         — BEFORE step 12
12. adoptOrphansMatchingPalettes()
13. dropDerivedBackgrounds()
14. dropSolidBackgroundFlags()
15. stripMetadataFromIds()                 — BEFORE step 16
16. reconcileIdCollisions()               — manager/idCollisionMigration.ts
```

> [!IMPORTANT]
> **Step 2 always seeds all 13 built-ins, whether or not `data` exists.** This
> is the invariant `CalloutRegistry.getAll()` — and therefore `CSSInjector`,
> the public API, and every settings list — depends on: `note`, `abstract`,
> `info`… are *always* present, whether or not the user ever touched them.
> Nothing may displace a built-in id either — a saved row on a built-in id is
> **merged onto the default and re-stamped `builtIn: true`**, whatever its own
> flag says, because there is only ever one callout per id (see below).

### `reconcileSavedRow` — the "only one callout per id" repair

[`src/manager/savedCalloutRows.ts`](../src/manager/savedCalloutRows.ts) answers
one narrow question in isolation from registry state: given a saved row and
whether this version ships a built-in for that id, what should be stored?

```ts
function reconcileSavedRow(saved, seeded): { def, repaired: boolean }
```

Two repair cases, both instances of the same rule — *a row whose `builtIn` flag
disagrees with the shipped set is that callout with its flag wrong, never a
second callout to choose between*:

1. **A saved row claims an id this version ships as built-in, but doesn't
   claim to BE it** (an older build, hand-edited JSON, or a foreign importer
   wrote it). It used to overwrite the seed outright, which broke the "every
   built-in always present" invariant and made `isBuiltInModified("note")`
   answer about a row whose own `builtIn` was `false`. Now it's *merged* onto
   the seeded default (`{...seeded, ...saved, builtIn: true, source: "builtin"}`)
   — every edit the row carries survives, the flags are re-stamped rather than
   trusted.
2. **A saved row claims `builtIn: true` on an id this version does NOT ship** —
   a built-in retired in a later version. It used to be skipped entirely,
   which deleted the user's customization of a type their notes might still
   write. Now it's demoted: `builtIn: false`, and `source` becomes `"user"`
   (unless it already claimed something else, like `"fallback"` from
   discovery — the only thing definitely wrong about it is the `builtin`
   claim).

## Load-time migrations

All ten migrations below are **content-keyed, not version-keyed** — each one
checks the shape of the data itself rather than trusting `data.version`. This
is deliberate and stated repeatedly in the source: an imported or hand-edited
file can carry any version number it likes, and a migration that trusted the
stamp would skip work the data genuinely needs. It also makes every migration
**idempotent** — running it twice on already-clean data is a no-op, which
matters because `load()` runs on every plugin start, every disable/re-enable,
and every JSON import.

| Migration | What it fixes |
| --- | --- |
| `svg` icon type → `lucide-pencil` | The removed `"svg"` icon pack; keeps old data rendering instead of crashing |
| `resolveLucideId` repair | v2.7.0–2.7.1 over-eagerly prefixed every bare Lucide value with `lucide-`, which broke ids belonging to *other* plugins' `addIcon()` calls or Obsidian's own internal icons (`dice`, `discord`, `help`) |
| `recolor` migration | Moved from being shared per-*picture* to being per-*callout*, seeded from the picture's own `monochrome` flag so nothing changes appearance |
| `dropStaleTransparencyFlags` | Retires a `transparentBg` flag left standing beside real background hexes — see below |
| `consolidateDuplicatePalettes` | Enforces "no two saved palettes with identical colours," relinking affected callouts |
| `adoptOrphansMatchingPalettes` | Links a callout whose baked colours exactly match a saved palette but whose `paletteId` names nothing |
| `dropDerivedBackgrounds` | Drops a background the plugin *derived* rather than the user *chose* — see below |
| `dropSolidBackgroundFlags` | Removes the retired `solidBackground` field entirely (nesting invariant) |
| `stripMetadataFromIds` | Retires rows whose stored id itself carries `\|metadata` — see below |
| `reconcileIdCollisions` | Merges rows that are one callout in two spellings — dash/space, repeated whitespace, case. Lives in `manager/idCollisionMigration.ts`; see below |

Three of these are worth understanding in more depth because the reasoning is
genuinely non-obvious:

### `dropDerivedBackgrounds` — the nesting invariant, retroactively

Obsidian gives nested callouts their stacked look purely by compositing
translucent layers — every `.callout` paints a ~10% tint of its own accent, so
each nesting level lays another translucent layer over the one beneath it. An
**opaque** background hides everything behind it, and under `mix-blend-mode:
darken`, a colour composited over itself is `min(x, x) = x` — a step of
exactly zero. Vaults accumulated opaque-looking backgrounds without anyone
asking for them: opening the editor on a callout used to *materialize* a
derived tint into the form fields, saving wrote it back regardless of what the
user actually meant to change, and `restyleUncustomizedFallbackRows` then
copied that derived value onto every auto-discovered row that mirrored it.

Both write sites are fixed now (see [Colour system](11-color-system.md)); this
migration retires what they already wrote to `data.json`. A background is
dropped only when `derivedBgAmount` can prove it IS the accent at some tint
strength, in **both** light and dark modes simultaneously — such a value
carries no information the accent doesn't already carry. Anything else (picked
by hand, or from a palette) is kept, because `CSSInjector` re-expresses
*every* background as a translucent tint of the rendered colour regardless —
so a hand-picked background nests correctly too, without being altered.

A definition with `bgGradient` set is skipped outright, before the
accent-match check even runs: a gradient is authored, never derived, and its
start colour is the stop the sweep would otherwise mistake for a derived
tint — removing it would delete the gradient.

### `stripMetadataFromIds` — retiring pre-understanding rows

Before `splitCalloutMetadata` was understood, discovery read a callout's whole
bracket body as its ID and auto-created a separate `fallback` row per metadata
value seen in the vault — `note|green`, `note|purple`, `note|yellow` alongside
the real `note`. Those rows also styled nothing that mattered: their selector
was `.callout[data-callout="note|green"]`, and Obsidian actually writes
`data-callout="note"`.

The migration renames a row to its base ID **when that base is free** (a
genuinely customized row keeps its styling and starts matching the callout it
always meant). When the base is already taken — the common case, since the
base is usually a built-in — the row is **dropped**: it's unreachable by any
spelling, and merging it into the survivor would silently restyle a callout the
user never asked to touch. This is safe specifically because the retired
spelling was never a real callout ID to begin with — Obsidian split the pipe
off before this plugin ever saw the token.

The same sweep also strips any piped entry out of a *surviving* row's
`aliases` array, not just primary ids — an alias is reachable the same way an
id is, so a piped alias is exactly as unreachable. And when the dropped or
renamed row was the configured `settings.fallbackCalloutId`,
`releaseFallbackTarget()` repoints it to the row's replacement (or back to the
default) in the same pass — otherwise `generateFallbackCSS` would bail on a
fallback id that no longer resolves, and every unrecognized callout in the
vault would silently lose its styling.

> [!IMPORTANT]
> **Only the piped ID itself is retired — not the "pipe-eaten" spelling an old
> editor may also have produced** (`notegreen` from `Pros|Cons` in a pre-2.x
> editor that pinned ID to display name). An earlier draft of this migration
> tried to retire that too, by matching an id that equalled the old sanitizer's
> reading of its own display name — that test has zero false negatives but
> plenty of false positives: it would have renamed *every* user callout ever
> named with a pipe, silently breaking any `[!proscons]` already written in
> the vault. `notegreen`-style ids are left alone; an uncustomized one is
> already swept up by `pruneUnused`, and a customized one is the user's own to
> delete.

### `reconcileIdCollisions` — two rows that are one callout

Obsidian reduces a callout header to
`type.trim().toLowerCase().replace(/\s+/g, "-")` before a plugin sees it, so
`[!banner icon]`, `[!banner   icon]`, `[!Banner Icon]` and `[!banner-icon]` all
render as `data-callout="banner-icon"`. Two rows for that one callout would
forever fight over a single CSS rule, split the usage count and appear twice in
every list.

Creating the pair is refused at the seam now — `add()` and the rename branch of
`update()` both consult `findAttrIdConflict`, so no caller can forget (the JSON
backup importer was the one that did). This migration is the other half: the
pairs already sitting in `data.json`.

The whole rule, and the reasoning behind each clause, is in
[`manager/idCollisionMigration.ts`](../src/manager/idCollisionMigration.ts).
In short:

- **Survivor**, first match wins: a built-in → a real row spelled without a dash
  (the spelling the editor's own ID field produces) → any real row → the first.
  "Real" means not an uncustomized `source: "fallback"` row, which is disposable
  auto-junk discovery would re-create anyway.
- **Merge**: survivor wins, loser fills gaps. The survivor keeps every field it
  authored; a field it never set is taken from the loser. `id`, `aliases`,
  `builtIn` and `source` are never taken — the first two are the identity being
  merged, the last two are provenance.
- **The loser's id and aliases** become aliases of the survivor, so no vault
  usage is orphaned. A disposable loser is dropped outright instead.
- **What else names an id by string moves too**: `settings.fallbackCalloutId`
  (dangling, `generateFallbackCSS` bails and every unrecognized callout loses its
  styling) and `settings.customCommands[].calloutId` (`syncAll()` drops a command
  whose callout `has()` cannot find, taking the user's hotkey with it).

Silent apart from a `console.debug`, like every other pass here, and a fixed
point once `needsSaveAfterLoad` flushes it: the loser survives only as an alias,
so the next load's grouping names one definition and nothing changes.

## `isModified` and the built-in-deference mechanism

```ts
private isModified(current, original, ignore?): boolean
```

A structural compare over `COMPARED_FIELDS` (every field except `id`,
`builtIn`, `source`) using `JSON.stringify(value ?? null)` per field — which is
what makes `undefined` and "absent" compare equal, matching how a JSON
round-trip through `data.json` treats them. `icon` is special-cased through
`iconsEqual()` rather than a raw string diff, because `constants.ts` spells a
built-in's icon bare (`"pencil"`) while the picker spells the same drawing
`"lucide-pencil"` — a raw diff would read an untouched built-in as customized
the moment its owner opened the icon picker once.

Two related but distinct questions:

- **`isBuiltInModified(id)`** — is this built-in different from its shipped
  default at all? Gates whether `toSaveData()` persists it.
- **`isUnmodifiedBuiltIn(def)`** — a *narrower* question, using
  `COLOUR_NEUTRAL_FIELDS = {"hideIcon"}` to ignore edits that are real but say
  nothing about colour. `CSSInjector` reads this one to decide whether to emit
  a hex `--callout-color` or defer to Obsidian's own `--callout-*` variable.
  Hiding a built-in's icon has to persist (or it reverts on reload) but must
  not cost the callout its theme deference — letting `hideIcon` count here
  would swap a theme's blue for a hard-coded hex the moment someone hides
  `[!note]`'s icon.

## Which rows are persisted (the built-in rule)

```ts
toSaveData(): PluginData
```

- The transient live-preview definition is **never** persisted — if it shadows
  a real callout, the *original shadowed row* is written instead (never the
  in-progress edit); if it occupies a fresh id, it's skipped entirely.
- A built-in is written **only if `isModified()` is true** against its shipped
  default.
- Every non-built-in row is always written.
- `materialSvgCache` is deliberately never written back — legacy entries were
  folded into `iconSvgCache` on load, and writing both would let them drift.

> [!CAUTION]
> A modified built-in and a user-created callout are equally "real, authored
> work" from the user's perspective. `getExportableDefinitions()` (used by
> `exportToJSONv2`) explicitly includes modified built-ins alongside
> `getUserDefined()` — leaving them out would make "export" quietly not mean
> "back up my callouts."

## CRUD and change notification

```ts
add(def): boolean       // false on id/alias collision
update(id, partial): boolean
remove(id): boolean     // false for a built-in — built-ins can never be removed
resetBuiltIn(id): boolean
```

`update()` handles the rename case (partial carries a different `id`) by
deleting the old key and setting the new one, inside `batch()` — because
renaming may also require re-mirroring uncustomized fallback rows that copy
the callout being renamed (if it's the active default fallback), and that
mirror pass fires its own notification unless batched together.

### `onChange` carries no payload

```ts
onChange(callback: () => void): void
offChange(callback): void
```

Every listener re-derives what it needs from current state. There is no diff,
no "what changed" argument — this is what makes `CustomCommandManager.syncAll()`
correct (it recomputes the whole desired command set from scratch every time,
converging regardless of *how* the registry changed) and it's also explicitly
called out in `API.md` as the contract external plugins get too: "Treat it as
a hint, not a precise event."

### `batch(fn)` — coalescing

```ts
batch<T>(body: () => T): T
```

Re-entrant (depth-counted), exception-safe (`finally`), and fires at most one
`notifyChange()` at the very end — none at all if nothing inside actually
mutated the registry. It deliberately does **not** change what each individual
mutation *does*, only when listeners hear about it — a per-call guard reading
live registry state from inside a batched loop keeps seeing exactly the state
it would without batching. Used for: the rename pair, `applyCalloutManagerImport`
/ `applyAdmonitionImport` (a whole import is one round, not one per row),
`applyPaletteColors`, `convertToFallback`, and every writer that might trigger
`mirrorFallbackRowsFor`.

## The transient live-preview slot

The settings tab's edit modals (`CalloutEditor`, the palette editor, the
global-style popups) need their preview pane to render through the **real**
CSS/rendering pipeline — so keystroke-by-keystroke edits actually show up in a
live embedded note, not a mocked-up preview widget. The registry supports this
via one reserved slot rather than a parallel rendering path:

```ts
setPreviewDefinition(def: CalloutDefinition | null, isDemo = false, notifyLists = true): void
hasPreviewDefinition(): boolean
getPreviewDefinition(): CalloutDefinition | null
isPreviewDemo(): boolean
getReal(id): CalloutDefinition | undefined   // sees through the shadow
```

The preview registers **under the real ID being edited**, so `> [!<real-id>]`
renders with in-progress styling. Bookkeeping:

- Setting a new preview always undoes the previous one first (restoring
  whatever it shadowed), so rapid typing while naming a new callout leaves no
  orphan rows.
- If the preview's id collides with an existing real callout, the shadowed
  original is remembered (`previewShadowedDef`) and restored the moment the
  preview clears.
- A preview that shadows a real callout **inherits that callout's identity**
  (`withIdentityOf`: `builtIn`, `source`, `customized`, `aliases`, `metadata`
  are taken from the real row, not the draft) — so an in-progress edit can
  restyle a row live but can never re-home it between settings-list sections,
  strip its aliases, or make a built-in look deletable while its editor is
  open.
- `isDemo` marks a placeholder preview with no real identity of its own (a
  brand-new unnamed draft, or the palette/global-style demo previews). Demo
  previews are **hidden from the settings lists entirely** — `definitionsForLists()`
  shows the *shadowed reality* in their place, or nothing if they shadow
  nothing — but they still render through `getAll()` / the CSS pipeline, which
  is exactly what makes the live preview pane live. This is why
  `PREVIEW_PLACEHOLDER_ID = "new-callout-preview"` had to stop being
  the built-in id `"example"`: a demo sharing an id with a real callout
  restyles that callout vault-wide for as long as the modal is open.
- `setPreviewDefinition` deliberately does **not** call `notifyChange()` — that
  would trigger `saveSettings()` and force every open note to re-render on
  every keystroke. It fires the separate `onPreviewChange` signal instead (see
  below), and the caller (`CalloutEditor`) explicitly requests a targeted
  `cssInjector.inject(false)`.

### `onPreviewChange` — a second, deliberately separate listener list

```ts
onPreviewChange(callback): void
offPreviewChange(callback): void
```

A preview update is **not a mutation** — it must never reach `saveSettings()`
or force a document-wide re-render. `SettingsTab` subscribes to this so its row
swatches track the editor modal's colour picker live, without either side
touching disk.

---
Next chapter: [06-css-generation.md](06-css-generation.md)
