# Data model

Every type referenced here lives in [`src/types.ts`](../src/types.ts) unless
noted. The 13 built-in seed values live in
[`src/constants.ts`](../src/constants.ts).

## `CalloutDefinition`

The core unit. One row = one callout type, in whichever of the three render
roles the user writes it.

```ts
interface CalloutDefinition {
  id: string;
  displayName: string;
  icon: CalloutIcon;
  hideIcon?: boolean;
  colorLight: string;
  colorDark: string;
  foldable: boolean;
  defaultFolded: boolean;
  builtIn: boolean;
  source: "user" | "theme" | "plugin" | "builtin" | "fallback";
  iconAdjust?: Partial<Record<CalloutRenderRole, IconAdjust>>;
  iconOffsetX?: number; iconOffsetY?: number; iconSize?: number; // legacy flat trio
  bgColorLight?: string; bgColorDark?: string;
  bgGradient?: BgGradient;
  transparentBg?: true;
  textColorLight?: string; textColorDark?: string;
  aliases?: string[];
  paletteId?: string;
  customized?: boolean;
  externalStyle?: true;
  metadata?: Record<string, string>;
}
```

Field-by-field notes on the ones that are not self-explanatory:

- **`id`** may contain spaces (`"my callout"`). Obsidian dasherizes it for the
  `data-callout` attribute; see [Callout IDs and the normalizers](#callout-ids-and-the-normalizers)
  below.
- **`source`** distinguishes provenance, not appearance. See the table in
  [Callout registry](05-callout-registry.md#sources).
- **`hideIcon`** is a *display flag*, not an icon. It is deliberately not a
  `"none"` member of `IconPackId` — see the "why" box below.
- **`iconAdjust`** is the current per-role icon nudge; `iconOffsetX` /
  `iconOffsetY` / `iconSize` are the legacy flat trio that predates it. A role
  missing from `iconAdjust` — or a single field missing inside one — falls back
  to the flat trio, which is exactly what the trio meant before `iconAdjust`
  existed. Always resolve through `resolveIconAdjust()` in
  `utils/iconAdjust.ts`, never by reading either layer directly.
- **`transparentBg`** and **`externalStyle`** are typed `true` (not `boolean`)
  on purpose — see the callout below.
- **`customized`** marks a row the user explicitly created or edited. It makes
  the row *sticky*: `CalloutDiscovery.pruneUnused` never removes a customized
  row even with zero vault usages. Auto-created fallback rows start with it
  unset.
- **`paletteId`** links a definition back to the `CustomPalette` its colors were
  last applied from, so a later edit to that palette can cascade. Left stale
  (pointing at nothing) when the palette is deleted — see
  [Colour system](11-color-system.md#custom-palettes-simple-vs-advanced-and-the-baking-contract).
- **`metadata`** here is a definition's own key/value bag — **not** the same
  thing as Obsidian's `data-callout-metadata` (the `|purple` after a pipe). Two
  different "metadata" concepts share the name; don't conflate them.

> [!NOTE]
> **Why `hideIcon` is a boolean flag and not `icon.type = "none"`.** `IconPackId`
> means *one body of artwork* — a pack manifest entry, a downloaded file, an
> SVG cache key. A `"none"` member would need a pack behind it that draws
> nothing, would have to overwrite `icon` (losing what the user actually
> picked), and would make every older plugin build reject the whole entry on
> import, since `validateIcon` only accepts a type it recognizes. Keeping
> `icon` untouched means turning the icon back on is instant and works offline
> — nothing overwrote it, and the icon-cache cleanup pass still counts it as
> in use.

> [!IMPORTANT]
> **Why `transparentBg`/`externalStyle` are `true`-or-absent, never `false`.**
> `CalloutRegistry.isModified()` compares
> `JSON.stringify(value ?? null)` between the current definition and the
> shipped built-in default. If the field could be written as literal `false`,
> an explicit `false` would read as *different* from a pristine `undefined` —
> and a built-in nobody actually edited would start being persisted to
> `data.json` and copied into every export forever. Every writer of these two
> fields omits the key to turn it off, rather than assigning `false`. If you
> add a new true-or-absent flag to `CalloutDefinition`, follow the same
> convention or `isModified` will silently misfire.

### `CalloutIcon`

```ts
interface CalloutIcon {
  type: IconPackId;      // which body of artwork
  value: string;          // icon name, or a UserImageIcon.id for type "image"
  style?: "outlined" | "filled" | "rounded" | "sharp"; // Material only
  weight?: number;         // Material only, 100–700
  recolor?: boolean;        // "image" only — tint like a library icon vs. keep own colours
}
```

See [Icons](12-icons.md) for the full pack model.

### `BgGradient`

Two-stop linear background gradient. Stop 1 is always the owner's existing
`bgColorLight`/`bgColorDark`; this object supplies the end colour per mode.
Absent = solid background. `textGradient` additionally sweeps the *title text*
of all three render roles, using a **separate** accent-strength pair
(`textToColorLight`/`textToColorDark`) rather than the pale background stops —
painting a pale tint through glyph text would be nearly invisible. See
[CSS generation § gradients](06-css-generation.md#gradients).

### `IconAdjust`

Per-role icon offset/scale. All fields optional; an absent field falls back to
the flat trio on the definition (see above).

## `CustomPalette`

```ts
interface CustomPalette {
  id: string;              // "cp-" prefix, never shown to the user
  name: string;
  colorLight: string; colorDark: string;
  bgColorLight: string; bgColorDark: string;
  textColorLight: string; textColorDark: string;
  bgGradient?: BgGradient;
  transparentBg?: true;
  bgIntensity?: number;     // 0..1, accent share mixed into the derived bg tint
  colorMode?: "simple" | "advanced"; // editor UI state only, never read by CSSInjector
}
```

All six colours are always concrete `#rrggbb` values — unlike a definition's
`transparentBg`, a palette's six hexes stay valid alongside the flag (the
editor keeps deriving them so switching back to Solid finds them ready; they
are simply not read while the flag is set). Editing a palette **cascades**
onto every linked callout (`CalloutRegistry.applyPaletteColors`); deleting one
leaves linked callouts with their last-baked colours, unlinked but with a
dangling `paletteId` the UI can offer to re-adopt. See
[Colour system](11-color-system.md#custom-palettes-simple-vs-advanced-and-the-baking-contract).

## `UserImageIcon`

```ts
interface UserImageIcon {
  id: string;        // "img-" prefix, = CalloutIcon.value
  name: string;       // filename incl. extension; also the uniqueness key
  format: "svg" | "png" | "jpeg" | "webp";
  svg: string;         // sanitized SVG markup, or an <svg><image href="data:…"> wrapper for raster
  width: number; height: number;
  monochrome: boolean;  // detected on import; seeds CalloutIcon.recolor's default
  rev: number;           // bumped on every edit; feeds the cache-key so a replace repaints
  addedAt: number;
}
```

Every uploaded picture — SVG or raster — is normalized to one representation
(SVG markup) so every render surface, the SVG cache, and the PDF-export path
need no special case. See the `user-image-icons` skill and
[Icons](12-icons.md#your-images--the-local-never-downloaded-source).

## `CustomCommand`

```ts
interface CustomCommand {
  id: string;                      // minted once, never derived from content
  calloutId: string;                // always canonical, never an alias
  role: CalloutRenderRole;
  headingLevel?: number;             // 1–6, only read when role === "heading"
  action?: CustomCommandAction;      // "wrap" | "insert", only read when role === "regular"
}
```

`id` is deliberately independent of the command's content — Obsidian keys the
user's hotkey by command id, and editing a command's callout/role/level must
not orphan that binding. See
[Editor integrations](09-editor-integrations.md#customcommandmanager--one-idempotent-sweep).

## `PluginSettings`

```ts
interface PluginSettings {
  globalStyle: GlobalStyleSettings;
  contextMenu: ContextMenuSettings;
  autocomplete: AutocompleteSettings;
  iconSources: IconSourceSettings;
  headingCallouts: HeadingCalloutSettings;
  inlineCallouts: InlineCalloutSettings;
  firstRunCompleted?: boolean;
  welcomeSeen?: boolean;
  fallbackCalloutId: string;
  language: string;                  // "auto" or a locale code
  customPalettes: CustomPalette[];
  userImages: UserImageIcon[];
  customCommands: CustomCommand[];
  disabledFixedCommands: string[];
}
```

`GlobalStyleSettings` holds vault-wide style for all three roles: border
sides/width/radius, title/content scale, "Align content with title" for the
block role; a nested `heading: HeadingFrameStyleSettings` (adds
`paddingTop`/`paddingBottom`/`marginTop`) and `inline: InlineFrameStyleSettings`
(adds `fontScale`) for the other two.

`HeadingCalloutSettings` and `InlineCalloutSettings` extend `RoleToggleSettings`
(`{ enabled: boolean }`) — either optional role can be switched off entirely.
`InlineCalloutSettings.allowContent` has **no settings UI** (flip it by hand in
`data.json`) — it governs whether `[!id]{text}` renders as a labeled pill or
stays literal markdown, and turning it off restores the exact pre-2.9 reading
of that syntax. It's a real switch rather than hard-coded because the brace
syntax claims characters a vault may already use for something else.

> [!IMPORTANT]
> **A new settings field must be registered in three places or it is silently
> dropped on load:** the `PluginSettings` interface (here), `DEFAULT_SETTINGS`
> (`src/constants.ts`), and `mergeSavedSettings()`
> (`src/utils/settingsMerge.ts`). Missing the third one is the common mistake:
> `mergeSavedSettings` builds every nested section **explicitly**, field by
> field, rather than spreading the saved object over the defaults — so an
> unmerged field is not merely un-migrated, it never reaches the in-memory
> settings object at all, however it round-trips through `toSaveData()`. See
> [Settings and storage](07-persistence-and-caching.md#settings-merge--never-a-raw-spread).

## `PluginData` — the shape of `data.json`

```ts
interface PluginData {
  version: number;                        // CURRENT_DATA_VERSION = 3
  callouts: CalloutDefinition[];            // only non-default rows — see below
  settings: PluginSettings;
  materialIconsCache?: unknown;              // legacy, ignored on save
  materialSvgCache?: MaterialSvgCacheEntry[]; // pre-2.4, read once by a load migration, never written again
  iconSvgCache?: IconSvgCacheEntry[];         // generic per-icon SVG cache, all packs
}
```

`version` is stamped for provenance only — every load-time migration in
`CalloutRegistry.load()` is keyed on whether a *field is present*, never on
this number, because an imported or hand-edited file can carry any version
number it likes while still needing the same repairs. See
[Callout registry](05-callout-registry.md#load-time-migrations).

`callouts` is **not** every callout the registry holds — see
[Callout registry § which rows are persisted](05-callout-registry.md#which-rows-are-persisted-the-built-in-rule).

## Callout IDs and the normalizers

Five helpers in [`src/utils/calloutId.ts`](../src/utils/calloutId.ts), each
with a distinct job. Confusing them is the single most common source of subtle
bugs in this codebase — every one of them exists because a plausible-looking
shortcut breaks a specific real case.

| Helper | Purpose | Splits `\|metadata`? |
| --- | --- | --- |
| `splitCalloutMetadata` | The one place the pipe rule is spelled out — splits `[!type\|metadata]` into `{id, metadata, hasMetadata}` | — |
| `normalizeCalloutId` | **Permissive.** Reading an ID out of markdown, or matching against the registry: drops metadata, collapses whitespace, trims, lowercases | Yes |
| `sanitizeCalloutIdInput` | **Restrictive.** The user *creating* an ID in the editor: keeps only letters/numbers/space/dash, folds dash runs into spaces | No — a pipe here is a character in a display name, not a token separator |
| `obsidianCalloutAttrId` | The form **Obsidian itself** writes into `data-callout` — `trim().toLowerCase().replace(/\s+/g, "-")`. Selectors only | No |
| `calloutIdentity` | **The one answer to "are these two IDs the same callout?"** — `obsidianCalloutAttrId(normalizeCalloutId(x))`. Every comparison, lookup, insertion, persistence check, discovery pass and import | Yes |

`normalizeCalloutId` is the funnel every raw-markdown-reading path goes
through — discovery, the vault scanners, `resolveCalloutDef`, the context menu,
the outline pane, the link-suggest popup — which is what makes a piped ID
**structurally unreachable** by the registry: nothing that reads markdown can
hand the registry an id containing `|`.

`obsidianCalloutAttrId` exists because Obsidian's own parser dasherizes
whitespace in both its reading-view and Live Preview parsers, so `data-callout`
on a block callout is always the dash form — even for a definition stored with
spaces in its `id`. Use it **only** for `.callout[data-callout=…]` selectors
and when reading that attribute back. The heading-callout / inline-callout /
ref-token DOM is the plugin's **own** markup and is stamped with the
space-preserving `normalizeCalloutId` form instead — mixing the two up is what
`utils/calloutSelector.ts`'s `calloutSel` vs. `tokenAttrSel` split exists to
prevent. See the `callout-metadata-pipe` skill for the full migration/edge-case
derivation.

`calloutIdentity` is the **uniqueness** question, which is a third thing again.
`[!banner icon]`, `[!banner   icon]`, `[!Banner Icon]` and `[!banner-icon]` are
four spellings of ONE callout — Obsidian renders them all as
`data-callout="banner-icon"` — so a second registry row for a second spelling is
never a second type. It is a duplicate that fights the first over a single CSS
rule, splits its usage count, and shows up twice in every list.

`CalloutRegistry.add()` and the rename branch of `update()` refuse a colliding
spelling themselves, so no ingestion path can create the pair: discovery, the
three importers, the theme sweep and the editor all go through one of them.
A pair already in `data.json` is folded on load by `reconcileIdCollisions`
([`manager/idCollisionMigration.ts`](../src/manager/idCollisionMigration.ts)),
which merges rather than halves — see
[Callout registry § reconcileIdCollisions](05-callout-registry.md#reconcileidcollisions--two-rows-that-are-one-callout).

It composes the two above rather than replacing either, because all three are
right about different questions. Identity has to fold a stray stored `|metadata`
onto its base; `obsidianCalloutAttrId` must *not*, or an emitted selector could
hijack a real callout's rule; and `normalizeCalloutId` must keep the space, or
the plugin's own token DOM stops matching `tokenAttrSel`. For every ID the
editor can actually produce — `sanitizeCalloutIdInput` emits neither a pipe nor
a whitespace run — `calloutIdentity` and `obsidianCalloutAttrId` are the same
function.

> [!TIP]
> Reuse these five helpers rather than writing a local regex. Several
> subsystems (discovery, the CSS injector, the vault scanner, import
> validation) depend on identical normalization behaviour to agree with each
> other about what counts as "the same callout."

---
Next chapter: [05-callout-registry.md](05-callout-registry.md)
