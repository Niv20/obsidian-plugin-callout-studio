# Icons

Covers the whole icon subsystem: [`src/icons/`](../../src/icons/) - the service
layer (fetching, caching, resolving), the pack registry (what each library
looks like as data), rendering, and the "Your images" user-upload source.

## Plugin UI icons

[`src/icons/uiIcons.ts`](../../src/icons/uiIcons.ts) bundles three Lucide-derived
SVG composites: `callout-studio-quick-insert` combines a paintbrush with
Lucide's plain plus at the lower right, and `callout-studio-statistics` combines
the paintbrush with a search badge in that corner. The conversion sidebar uses
`callout-studio-portable-conversion`, with Lucide's split badge. Each small
symbol occupies part of the full-size brush, whose paths stop short to leave a
transparent gap around it. The cutout is part of the geometry: no
background-coloured cover or SVG mask IDs are needed, so repeated icons and
different backgrounds render alike. The shapes use `currentColor` and inherit
the host's icon colour. All three use a 24px canvas with rounded 2px brush
strokes. The split badge is half of the original Lucide coordinates, translated
by `(11.5, 11)` while retaining its 2px stroke; its nearest brush endpoints
leave about 1.6px of transparent space.

Quick insert scales Lucide's plus to half its original coordinates and moves it
to the lower right: `M15 18.5h7` and `M18.5 15v7`, with a 2px stroke. The brush
is trimmed around these two lines rather than around a circle.

[`registerUiIcons.ts`](../../src/icons/registerUiIcons.ts) registers all three with
Obsidian's `addIcon()` synchronously at the start of `onload()`, before any view,
command or ribbon consumer. A plugin-registered cleanup calls `removeIcon()` on
unload. These assets require no runtime fetch or icon-pack download.

### Authoring another composite UI icon

Keep the new drawing as a standalone SVG in [`assets/ui-icons/`](../../assets/ui-icons/)
and put the identical inner SVG markup in `UI_ICON_CONTENT` in
[`src/icons/uiIcons.ts`](../../src/icons/uiIcons.ts). The standalone file is an
editable export; the TypeScript markup is what `addIcon()` receives at runtime.
`registerUiIcons.ts` scales the 24 × 24 drawing into Obsidian's 100 × 100 icon
viewBox. Use `fill="none"`, `stroke="currentColor"`, round caps and joins, and
explicit stroke widths so Obsidian can recolour it.

1. Download the original SVGs from [Lucide](https://lucide.dev/icons/) for the
   large icon and the small symbol; Quick Insert uses
   [paintbrush](https://lucide.dev/icons/paintbrush) and
   [plus](https://lucide.dev/icons/plus). Scale and position the small symbol
   in the 24 × 24 coordinate system; retain its recognizable path shape,
   adjusting only the geometry needed to
   fit the smaller footprint. Do not cover the large icon with a fill matching
   the background.
2. Cut the large icon's paths where they approach the small symbol. Measure
   the closest distance **between the two stroke centreline segments**, not
   just between their endpoints. The visible transparent gap is that distance
   minus **half the large stroke width** and **half the small stroke width**.
   With two 2px strokes, a target of at least 1.2px of visible space requires
   at least 3.2px between centrelines (`1px + 1px + 1.2px`). This is the
   clearance target for Quick Insert's brush and plus; the rendered minimum is
   about 1.3px. The half-stroke subtraction also accounts for rounded caps at
   the path endpoints. For a circular badge, measure from its centre to the
   brush centreline, then
   subtract the circle's centreline radius and both half-stroke widths. For a
   plus or another open shape, check clearance to **each line segment**.
3. Change only the brush segments that enter that measured clearance area.
   Preserve the other Lucide curves and corners, and check the result at the
   small ribbon size as well as at 24px. The cutout should remain transparent
   on light and dark backgrounds, without a mask, clip path, filter, or SVG ID.
4. Give the composite a stable `callout-studio-*` ID and add it to
   `UI_ICON_CONTENT`. [`registerUiIcons.ts`](../../src/icons/registerUiIcons.ts)
   registers every entry before its consumers load and unregisters it on
   plugin unload. Keep the standalone SVG's `<g>` markup byte-for-byte
   aligned with the registered content; [`uiIcons.test.ts`](../../tests/uiIcons.test.ts)
   checks that parity and the shared SVG constraints. Add a geometry check for
   the measured clearance where another symbol comes close to the brush.
5. Preserve the source's licence notice in the SVG and source file, and update
   [`THIRD-PARTY-NOTICES.md`](../THIRD-PARTY-NOTICES.md#lucide) when adding or
   changing source artwork. Update the relevant user guide page when the
   visible control changes.

Quick insert uses its ID for the ribbon and command. Occurrences uses its ID
for the native **Find callouts** right-sidebar tab, **Find callouts** menus and
command. The tab is offered once on first install without opening the sidebar,
and is the only visible occurrences control. Obsidian's workspace preserves its
later presence and position; startup does not recreate a closed tab. The command
or a **Find callouts** action reopens the sidebar. The **Review conversion** tab uses
its own composite icon and is created only on demand; restored conversion tabs
are closed at startup. The welcome hero keeps
the stock `paintbrush` icon. Editable standalone exports live in
[`quick-insert.svg`](../../assets/ui-icons/quick-insert.svg),
[`statistics.svg`](../../assets/ui-icons/statistics.svg) and
[`conversion.svg`](../../assets/ui-icons/conversion.svg); keep them aligned with
the bundled definitions. Attribution is in
[`THIRD-PARTY-NOTICES.md`](../THIRD-PARTY-NOTICES.md#lucide).

## Two id spaces (recap)

From [Architecture](02-architecture.md#two-id-spaces-for-icons):
`IconSourceId` (9 members) is a library as the picker shows it; `IconPackId`
(12 members) is one body of downloadable/cacheable artwork. They coincide
except for Font Awesome (`fa` → `fa-solid`/`fa-regular`/`fa-brands`) and
Tabler (`tabler` → `tabler-outline`/`tabler-filled`).
[`src/icons/registry.ts`](../../src/icons/registry.ts) holds both mappings as
**total, frozen `Record`s** - declaring a member on one union without a line
in the corresponding record is a compile error, not a silently-blank grid.

```ts
ICON_SOURCES: Record<IconSourceId, IconPack>       // the 9 libraries
SOURCE_OF_TYPE: Record<IconPackId, IconSourceId>    // which source owns each body of artwork
packFor(icon: CalloutIcon): IconPack | undefined     // undefined ⟺ icon.type unknown to this build
iconCacheKey(pack, name, variant): string             // "pack name variant" - pack-scoped, never source-scoped
```

> [!IMPORTANT]
> **Cache keys and pack-store calls always use `icon.type` (an `IconPackId`),
> never `pack.id` (an `IconSourceId`).** Using the source id would collapse
> Font Awesome's three styles onto one cache entry and one download state -
> picking a Brands icon would look "ready" for Solid too, and vice versa.

## The `IconPack` contract

[`src/icons/types.ts`](../../src/icons/types.ts) defines the interface every
library implements - **pure data and pure functions, no I/O**. Downloading is
strictly `IconService`'s job, which is what keeps a pack trivially testable
and unable to stall a render:

```ts
interface IconPack {
  id: IconSourceId;
  kind: IconPackKind;
  labelKey, descriptionKey, emblemIcon, searchPlaceholderKey: ...  // picker chrome
  hasCategories: boolean;
  variants?: readonly IconVariantSpec[];        // extra toolbar controls (style/weight/skin-tone)
  dataPacks?: readonly IconPackId[];              // which downloaded file(s), bundledRemote only
  attribution: IconAttribution;

  loadIndex(): Promise<IconIndex>;                 // decode the bundled search index (memoized)
  makeIcon(entry, variants): CalloutIcon;            // grid selection → stored icon
  entryMatches?(entry, variants): boolean;            // filter the grid by variant (FA style, Tabler style)
  pickerNotice?(variants): LocaleKey | undefined;      // standing notice for some variant states
  cacheVariant(icon, role): string;                     // everything besides name that changes the drawing
  buildSvg?(icon, role): string | null;                  // synchronous - a render path cannot wait
}
```

### `IconPackKind` - five supply models

| Kind | Members | How artwork reaches the screen |
| --- | --- | --- |
| `builtin` | Lucide | Obsidian's own `setIcon()`. No data, no network, ever. |
| `glyph` | Emoji | A text glyph drawn as a text node. No SVG at all. |
| `perIconRemote` | Material Symbols | One SVG fetched per icon, from Google, on choice - see below. |
| `bundledRemote` | Tabler, Font Awesome, Octicons, RPG Awesome, Simple Icons | One file per pack downloaded once, then fully offline. |
| `local` | Your images | Held in `settings.userImages`. Never fetched, ever. |

### `cacheVariant` - everything besides the name that changes the drawing

Must cover **every** axis that changes the *artwork itself*, or two visually
different drawings collide on one cache entry:

- Material encodes `style` + `weight` (100,000+ combinations, hence
  `perIconRemote`).
- Octicons encodes the **pixel height it drew at** - it ships two sizes (16px
  for small surfaces, 24px for large) and `entryMatches`/role dispatch pick
  between them.
- "Your images" encodes the picture's `rev` (bumped on every edit - this is
  what makes replacing a picture repaint every open note that uses it,
  because otherwise the render key would be unchanged before and after) plus
  a `c` suffix when `icon.recolor` is set - two callouts sharing one picture
  with different recolour settings must not share a cache entry, or one
  would keep the other's paint.
- Packs with a single drawing per icon (Tabler, Font Awesome, RPG Awesome,
  Simple Icons) use `""`.

## `IconService` - the one entry point

[`src/icons/IconService.ts`](../../src/icons/IconService.ts) is what `main.ts`
and every other consumer talks to; it composes two very different fetch
strategies behind one interface.

```ts
initialize(): Promise<void>          // startup - see below
ensureArtwork(icon): Promise<void>     // the picker's "Confirm" button
ensureArtworkFor(icons): Promise<void>  // the ONLY repair path - batches
deleteLibrary(source, alsoKeep?): Promise<boolean> // the Manage icon libraries window's Delete
hasFailed(icon, role): boolean
```

### `initialize()` - startup order matters

```text
1. Filter registry.getAll() to icons whose callout actually shows one (hideIcon !== true)
2. packs.loadUsed(types) - read from DISK only the packs this vault references
3. cssInjector.inject() - repaint with whatever was already on disk
4. fetch.ensureAll() - Material's per-icon sweep FIRST (one attempt per icon)
5. ensureArtworkFor(icons) - repair whatever the packs would still need
```

> [!NOTE]
> **Material runs before the general repair pass, deliberately.** Material's
> `ensureAll()` is built for exactly this moment - one attempt per missing
> icon, no retries. Running the general `ensureArtworkFor` first would send
> every missing Material icon through `cacheOne`'s full three-attempt retry
> loop (with waits between attempts) on a vault that may simply be offline -
> multiplying startup latency for no benefit.

A callout with `hideIcon: true` is explicitly excluded from this whole
sweep - nothing paints it, so pulling its pack off disk (or worse, the
network) would be pure waste. Its cached SVG is left untouched by cleanup
passes, so turning the icon back on later needs neither a re-download nor a
re-fetch.

`IconService.destroy()` terminally closes both supply managers and clears their
listeners. `IconTaskScope` ends pending waits and clears retry/deadline timers;
every asynchronous continuation checks disposal before publishing artwork,
starting another cache write, injecting CSS, saving, or announcing a result.
An Obsidian request or adapter write that was already started cannot be aborted,
but its late completion cannot begin another operation or revive the old service.
`packValidation.ts` holds the verification/parsing helpers separately from this
lifecycle, and `iconArtworkCache.ts` holds the synchronous role-aware cache copy.

### `ensureArtworkFor(icons)` - the only repair path

This is the function called from **both** places an icon can arrive without
having gone through the picker: **import** (a file names icons this vault may
not have) and **startup** (an icon a callout uses whose artwork went missing
or failed its checksum). It:

1. Filters to icons not already fully cached and not already known-failed
   this session.
2. Groups by `icon.type` (never by source) - so twenty Font Awesome Brands
   icons cost **one** download, not twenty.
3. Fetches **sequentially within a group** - "parallel requests to one CDN
   gain nothing and make a failure harder to attribute," per the source
   comment; the first icon in a group triggers the pack download, the rest
   just copy artwork out of the now-present pack.
4. Announces what was restored **once, for the whole batch** - anything that
   failed has already announced itself individually (a per-icon Notice from
   `IconFetchManager`, or a permanent error state via `hasFailed`).

### `isFullyCached(icon)` - checked per render role, not just the one on screen

A pack can draw the same icon differently per role (Octicons' two sizes), and
`copyPackArtwork` stores **every** role's drawing when an icon is first
committed - not just the block-callout drawing. `isFullyCached` mirrors this:
it checks all three `CALLOUT_RENDER_ROLES`, which is what lets a user enable
the (previously disabled) inline-callout role later without needing the
source pack to still be downloaded.

## `PackDataStore` - bundled-file download and verification

[`src/icons/PackDataStore.ts`](../../src/icons/PackDataStore.ts) handles the
`bundledRemote` packs (Tabler, Font Awesome, Octicons, RPG Awesome, Simple
Icons).

```ts
loadFromDisk(id): Promise<PackDiskResult>   // "ready" | "missing" | "corrupt" - NEVER fetches
download(id): Promise<boolean>               // fetches, verifies, persists
remove(id): Promise<boolean>                 // deletes the file, forgets the artwork
```

**Every read - download or disk - is SHA-256-verified against
`PACK_MANIFEST` baked into the build.** Two URLs are tried in order
(`packUrls(id)` - jsDelivr first, `raw.githubusercontent.com` fallback), each
pinned to the **`packs-v3`** immutable tag (see
[Adding or modifying features](22-extending.md#refreshing-icon-pack-artwork)
for what "refreshing" a pack actually requires).

> [!CAUTION]
> **A checksum mismatch on disk is treated as `"corrupt"` - rejected
> outright, unlike a locale file's staleness handling.** This is a
> deliberate difference from `LocaleStore` (see
> [Localization](17-i18n.md#locale-file-staleness-vs-a-corrupt-icon-pack)):
> an icon pack's checksum only ever changes when the pack's *contents*
> change (a refresh with a new tag), so a mismatch here means edited or
> damaged data, not "an older but still-valid copy." A locale mismatch, in
> contrast, is nearly always just an older-but-fine translation missing a
> few newer keys - hence that one is accepted as "stale" rather than
> discarded.

`persist()` is best-effort - a read-only vault or a suspended mobile app must
not cost the user the download they just completed, so a write failure only
downgrades the pack to session-only availability (with a one-time warning
Notice, `diskWriteBroken`, so the user isn't nagged on every subsequent
failure).

**Manual install**: dropping a correctly-named file into `icon-packs/` by
hand works - it's read and verified on the next launch exactly like a
downloaded one. This is intentionally undocumented in the picker UI itself
(README: "a path for someone who already knows to look, not an option worth
putting in front of everyone downloading an icon set").

### The path-grammar check

A file that passes its checksum is then parsed by `parsePackFile`
([`packData.ts`](../../src/icons/packData.ts)), which is the whole sanitizer
these files get: every `d` string has to consist of path-data characters and
nothing else, and one bad path rejects the file, not the icon. The grammar is
the one the generator asserts when it writes the file,
`/^[MmLlHhVvCcSsQqTtAaZz0-9eE+\-.,\s]+$/`.

At load time that grammar is applied by `isPathData` - a 128-entry lookup table
and a loop - rather than by running the expression. The two accept exactly the
same strings; the loop is about eight times faster, which started to matter
with Simple Icons: 4.6 MB of path data cost some 55 ms through the expression
on a desktop, in one uninterrupted main-thread block, at startup for any vault
that uses one of its logos. `tests/iconPackData.test.ts` holds the loop to the
expression on all 65,536 code units, and to the generator's copy of it by
quoting the literal - edit one without the others and something fails.

## Icon libraries - what the picker offers

[`src/icons/iconLibraries.ts`](../../src/icons/iconLibraries.ts) is the one
reader of `settings.iconLibraries` (see [Data model](04-data-model.md#pluginsettings)).
The picker's source menu, its All sources pool and the **Manage icon libraries**
window all ask it which libraries this device offers, and in what order:

- A **downloadable** (`bundledRemote`) library is offered exactly when every
  file in its `dataPacks` is `"ready"`. Font Awesome with only Brands on disk is
  not offered: the same "all, not any" rule the pool has always applied.
- Every other library - Lucide, Material, Emoji, Custom Icons - ships with the
  plugin and is offered unless it is listed in `hidden`. A downloadable id in
  `hidden` is ignored: deleting its files is how it leaves.
- `libraryOrder()` completes the saved order. Unknown ids are skipped, and a
  library the list lacks (the list is still empty, or a later release added
  the library) goes right after its catalog predecessor, wherever that one sits.
- `pickerSources()` is never empty. Settings synced from a device with
  downloads can hide every built-in library on one without any; Lucide is then
  offered anyway, since it draws offline and cannot fail.
- `menuLibraries()` is the source menu. `libraries` is exactly
  `pickerSources()` - what the picker offers, which is also the All sources
  pool - so every library the menu lists can be drawn from right now.
  `toDownload` is every downloadable library the device does not fully have, in
  catalog order; the menu does not list them, it counts them in its closing
  line, and they are downloaded in the Manage icon libraries window. `current`
  is the one exception: the edited icon's own library when the picker does not
  offer it - deleted here, downloaded only on another device, partly
  downloaded, or a built-in one the user hid. The menu lists it apart, under its
  own heading, so re-editing that icon can always show where it lives. A missing
  downloadable `current` remains in `toDownload`: keeping its icon does not
  make its library downloaded, and the closing count must be independent of
  which callout is being edited. Its heading is **Deleted library**; a hidden
  built-in `current` keeps **Current icon**. Any other hidden built-in library
  is in none of the three.
- `isInstalled()` is the looser question - any file of the library on the
  device. A library with only some of its files is not offered, but it still
  takes up space, so Delete and the window's reset arrow have to see it.
- `reorderShown()` saves a drag by moving only the libraries this device shows,
  each into a slot one of them already held, so a library downloaded only on
  another device keeps the place it was given there. `savedLibraryOrder()`
  writes the catalog order back as `[]` and keeps a newer build's ids at the end.

A download keeps the library's saved slot and writes no settings. Downloads are
per device; one device's download must not reorder every other device's list.

The pooled pack records what it pools (`AllSourcesPack.memberIds`), and
`PackPanel` loads Material's Google webfont for the pool only while Material is
a member. Hiding Material therefore stops that request as well as the menu row.

### Deleting a library keeps its callouts' icons

`IconService.deleteLibrary(source, alsoKeep)` is the window's **Delete**:

1. **Seal.** Every committed callout using the library gets
   `copyIconPackArtwork` for all three roles, copied out of the still-loaded
   pack. `calloutsUsingLibrary()` runs over `registry.getCommitted()`, which
   leaves out theme rows and the callout editor's draft but includes callouts
   whose icon is turned off. `alsoKeep` is the editor's draft, handed in
   explicitly (below), and gets the same treatment.
2. If anything new was copied, one `publish()` - inject, save, notify.
3. `PackDataStore.remove(id)` for each file deletes `icon-packs/<id>.json`,
   forgets the parsed artwork (`forgetPackData`), clears the state and
   notifies. It refuses while that pack is downloading.

The seal is what makes "they keep their icons" true on every synced device, and
it is what keeps a deletion final: a callout left without its copy would send
the startup repair (`ensureArtworkFor`) to download the library straight back.
The window therefore refuses to delete a library callouts use while saving is
paused, because the copy has to reach the disk before the file goes.

#### The callout being edited counts as a user

The only road to the window is *callout editor → Pick an icon → Manage libraries*, so a
callout editor is always open behind it, and the icon the person just picked
sits in `CalloutEditor.icon` until **Save** - the registry knows nothing of it.
Download a library, pick one of its icons, open the window again and press
**Delete**: if "who uses this library?" were answered from the registry alone
there would be no users, no question, and the library would go without a word.
That was the bug behind a missing dialog, and it was never about timing -
`registry.getCommitted()` leaves the draft out by design, so no amount of waiting
would have put it in.

The fix keeps `getCommitted()` as it is and adds the draft from the one place
that really knows it. `CalloutEditor` opens the picker with
`{ id: existingId, name }`; the picker pairs that with the icon it was opened on
(`currentIcon`, which *is* the draft's icon, and cannot change while a modal sits
on top of the editor) into an `EditedCallout`; the window's host carries it as
`editing`. `iconLibraries.ts` then answers:

- `calloutNamesUsingLibrary(committed, id, edited)` - the committed callouts
  using the library, by name, plus the edit when its icon is from the library.
  One callout counts once however many of its versions use the library (matched
  by id), and a committed callout keeps counting after its edit moves to another
  library, because until **Save** the committed icon is what every note draws.
  An empty list is what lets the library be deleted without asking.
- `editedUsingLibrary(edited, id)` - the edit when its icon is from the
  library, which the window passes on as `alsoKeep`.

The registry's preview slot (`setPreviewDefinition`) is deliberately **not** the
source: it holds the half-typed callout under a placeholder id so it can be
*drawn*, it is cleared and restored by other modals, and a rename of the id
field would make it disagree with the real callout it shadows.

`fetchArtwork` returns early for an icon that `isIconFullyCached`, before it
looks at the pack. Confirming a callout's own icon in the picker - on a device
that never had its library, or after deleting it - used to download the whole
library for artwork that was already saved.

## Simple Icons - a pack decided logo by logo

Mechanically [`packs/simpleIcons.ts`](../../src/icons/packs/simpleIcons.ts) is
the simplest `bundledRemote` pack there is: one path per logo on a 24-unit
square, one drawing, no styles, no categories. It is `bundledRemote` rather
than `perIconRemote` for the opposite of Material's reason - there is exactly
one drawing of each logo, so a whole-library file exists, the picker grid can
draw from it, and one checksum vouches for all of it. What is different is the
artwork: every icon is somebody else's mark. Three consequences.

**The licence is decided per logo, by the generator.** Simple Icons releases
its collection under CC0 and states that this does not make every logo CC0;
where a brand published its logo under its own terms, upstream's
`data/simple-icons.json` records a `license` on that icon. `buildSimpleIcons()`
in [`scripts/generate-icon-packs.mjs`](../../scripts/generate-icon-packs.mjs)
sorts every logo one of three ways:

| Upstream licence | Outcome |
| --- | --- |
| none recorded | Shipped. |
| on `SI_SHIPPED_LICENSES` (CC0, Unlicense, Apache-2.0, MPL-2.0, CC BY, CC BY-SA) | Shipped, and credited by name in the generated notices. |
| matches `SI_WITHHELD_LICENSES` (`custom`, MIT and BSD-3-Clause, any `-NC`, any `-ND`, GPL/AGPL) | Left out of the pack file *and* the search index, and listed in the notices with the reason. |
| anything else | **The build stops.** A licence nobody has read is neither promised nor refused by default. |

The allow-list has one principle: everything the licence asks of someone
passing the logo on *unchanged* can be met with a notice. ShareAlike and MPL
qualify because their copyleft attaches to a modified logo, and the pack
carries every path exactly as published. The withheld ones each ask for
something a downloaded pack cannot promise on its users' behalf - see the
comments on the two lists for the reasoning per licence.

`SI_WITHDRAWN` is a third, manual list: slugs withdrawn at their owner's
request, ahead of upstream's own next major release. It is empty until someone
asks. Adding a slug is a pack refresh like any other - new tag, new checksums
 - because the old tag stays cached on the CDN.

**The credit is generated, and is an artefact of the build.** The same pass
that writes `packs/simple-icons.json` writes
[`docs/SIMPLE-ICONS-LICENSES.md`](../SIMPLE-ICONS-LICENSES.md): every shipped
logo that carries a licence, with its owner, licence and source, and every
logo left out, with why. It is the attribution those licences require, so it
must describe the pack file exactly - `tests/repoGenerated.test.ts` regenerates
it byte-for-byte, and `tests/simpleIconsPack.test.ts` re-derives the whole
policy from upstream's records independently of the generator and checks the
file, the index and the notices against it. The credits modal links that file
**at the packs tag** rather than on the default branch, because at the tag the
list and the pack were generated together.

**The trademark notice is never off.** Font Awesome raises its brand notice
for one style through `pickerNotice`; here `attribution.noticeKey` alone is
enough, because there is no toolbar state in which the grid is not brand
marks.

Two smaller things follow from upstream's naming. An icon's `value` is
upstream's **slug** (`nodedotjs`), its stable id and file name; the title
rides along as a label only where it says something the slug does not
(`Node.js`, `AT&T`) - fewer than one entry in twenty, and the first bundled
index to have a label column at all. And the search terms are upstream's aliases plus one
derived term, the title with its punctuation closed up (`nodejs`, `att`),
added only when the slug does not already contain it.

`tests/simpleIconsPack.test.ts` also asserts that every shipped path is
byte-identical to upstream's. "No outline is altered" is said in the credits
and in both notices files, and for a logo it is the claim that matters most.

## `IconFetchManager` - Material Symbols, one icon at a time

[`src/icons/IconFetchManager.ts`](../../src/icons/IconFetchManager.ts) is the
`perIconRemote` counterpart, needed because Material's 3,870 icons × 4 styles
× 7 weights is over 100,000 combinations - no bulk file could cover it.

- **3 attempts, 2-second delay between them** (`MAX_ATTEMPTS`,
  `RETRY_DELAY_MS`), then permanent failure for the session
  (`failed: Set<string>`, **in-memory only** - every launch is a fresh
  chance, which is what makes it safe for the startup sweep to record
  failures for a vault that simply happened to be offline at that moment).
- **Each HTTP attempt has a 30-second deadline.** A stalled request becomes
  an ordinary failure, so startup can advance to the next icon and the picker
  can finish its bounded retries. The underlying Obsidian request cannot be
  aborted; late results are ignored and the deadline timer is always cleared.
- **Concurrent requests for the same drawing share one promise**
  (`inFlight`), keyed identically to the cache - so the picker's "Confirm"
  and the callout editor's save both asking for the same icon at once cost
  one fetch, not two racing to write the same bytes.
- **Deliberately does not run `cleanupUnusedIconSvgs()`** after a successful
  fetch - the icon may have just been picked in the picker and not yet
  attached to any callout; a cleanup sweep at that moment would delete
  exactly what was just fetched.

## Material preview font lifetime

`packs/materialFont.ts` owns the preview font loader for one enabled plugin
lifetime. `main.ts` calls `startMaterialFontLoader()` on load and
`stopMaterialFontLoader()` on unload; `resetMaterialFontLoader()` starts a fresh
enabled session when its resources need rebuilding. Pending loads share a
per-document memo only within that session.

`materialFontSession.ts` cancels waiters and owns cached `FontFace` registrations,
stylesheet links, and link timers across the main document and pop-outs.
`materialFontLink.ts` clears link callbacks when they settle or are cancelled.
Every continuation after a cache read, face load, stylesheet verification, or
network response checks its captured session; cache work also checks that its
store is still current and alive. Browser requests already in progress cannot
be aborted through Obsidian's `requestUrl`, but their late results cannot add a
font, start another request, or write through a stale loader after disable.

## `IconResolver` - the read-only, synchronous view every renderer uses

[`src/icons/resolver.ts`](../../src/icons/resolver.ts) is what stands between
"an icon might need fetching" and "a render path that cannot wait":

```ts
resolveSvg(icon, role): string | null   // data.json cache first, then pack.buildSvg() - never fetches
hasFailed(icon, role): boolean
```

Resolution order: **whatever was already copied into `data.json`** wins
first (that's the copy that syncs across devices, so it renders correctly
even where the pack was never downloaded), falling back to
`pack.buildSvg(icon, role)` for artwork the pack can construct from data it
already holds locally (bundled path data, or a locally-held user image).
Neither step ever touches the network - a resolver is purely synchronous.

`createIconResolver` memoizes the no-failure-tracking variant per lookup
object (`WeakMap`) because a full-document repaint sweep requests one per
token; `createStatusIconResolver` is the failure-aware variant used only by
the two surfaces that need to distinguish "still downloading" from "gave up"
 - the settings callout list and the editor's icon preview. Every other
surface (block/heading/inline rendering, autocomplete, PDF export) just
shows a placeholder either way.

Resolution supplies artwork, not a trust guarantee. Before any cached or
pack-provided SVG enters a live document, `renderIcon.importSvg` applies the
same full element/attribute/CSS allow-list used for user images, then isolates
the sanitized copy. Edited or synchronized cache entries therefore cannot
bypass sanitization. Rejected markup follows the caller's existing missing-icon
behavior; sanitization does not rewrite the stored cache during a paint.

## `renderIcon.ts` - the only "icon → DOM" painter

[`src/icons/renderIcon.ts`](../../src/icons/renderIcon.ts) is explicitly the
**one** place that turns an icon into DOM; every render surface calls
`renderIconInto()`. The surfaces differ in exactly four ways, expressed as
options rather than duplicated logic:

```ts
renderIconInto(target, icon, resolver, {
  role,                       // which of a pack's per-size drawings to use
  fill,                        // "currentColor" (live view) vs. a baked literal (PDF export)
  followCalloutColor?,          // stencil a user image in `fill`, or keep its own colours
  missing,                       // placeholder / status(spinner+error) / leave
  className?, rootStyle?,          // caller-specific DOM marks
  errorText?, errorAriaLabel?,
}): RenderIconResult
```

> [!WARNING]
> **Never reach into the SVG cache directly from a renderer.** Go through
> `IconResolver`. This is the invariant that keeps every render surface
> agnostic to *where* an icon's artwork actually lives (cache vs. bundled vs.
> user-held) and to the packs' own async fetch machinery.

`renderIconInto` is wrapped in a `try/catch` - `setIcon` and `DOMParser` can
both be missing in "exotic render realms" (a PDF-export clone, a pop-out
window mid-teardown), and a missing icon there is always preferable to a
crash mid-render.

The "gave up" state draws a question mark, `HELP_ICON_ID` from
[`constants.ts`](../../src/constants.ts) - as does the **About conversion**
button in Review conversion. It is Lucide's older name, `help-circle`, not
`circle-help`, on purpose: the drawing is identical, but a right-to-left
interface mirrors every icon and Obsidian un-mirrors only `.lucide-help-circle`
when the language is Hebrew (where "?" is not reversed the way Arabic's "؟"
is). Under the newer name the "?" stayed backwards in Hebrew.
`tests/iconNames.test.ts` keeps `circle-help` out of the source.

`renderNoIcon(target)` is the **separate** function for a callout the user
explicitly set to `hideIcon`, and it is used **only** on surfaces that
*manage* callouts (settings list, autocomplete popup, statistics/replace
modals) - those are columns of rows where a genuinely empty slot would both
break the column layout and look identical to "still downloading." It draws
a faint dashed ring instead. Content surfaces (the actual rendered callout,
heading/inline tokens, PDF export) draw **nothing at all** and let the flex
gap collapse - see [Render roles § hideIcon](09-render-roles.md#hideicon-and-flex-gap-collapse).

## SVG sanitization - two sanitizers, two threat models

[`src/icons/svg.ts`](../../src/icons/svg.ts) makes the distinction explicit and
deliberate:

| Function | Input | Model | Approach |
| --- | --- | --- | --- |
| `sanitizeSVG` | Material Symbols, fetched individually from Google | One known vendor, one known output shape | **Deny-list** of the obviously executable (`<script>`, event handlers, `javascript:`/`data:text/html` URLs) |
| `sanitizeUserSvg` | A file the user picked off their own disk | Could be *anything*, and it's inserted into the live DOM | **Allow-list** - unknown elements and unknown attributes simply do not survive |

Downloadable bundled packs (Tabler, FA, Octicons, RPG Awesome, Simple Icons)
ship **bare path data**, not full SVG documents, and need no sanitization at
all - there is no markup to sanitize. What they get instead is
`parsePackFile`'s grammar check, described under
[PackDataStore](#packdatastore---bundled-file-download-and-verification).

The user-image allow-list (`USER_SVG_ELEMENTS`) permits shapes, grouping,
gradients, and clipping - enough to draw any icon - and explicitly excludes
`<use>` and `<foreignObject>` (both pull in content by reference),
`<animate>`/`<set>` (can assign event-handler attributes at runtime), and any
nested `<svg>` (would re-open the whole attack surface one level down).

The sanitizer rejects DTD/entity declarations and SVGs above 256 KiB,
5,000 elements, or 64 child levels. Embedded raster data URIs must have a
matching PNG/JPEG/GIF/WebP header and a bounded decoded size. `rasterSafety.ts`
checks dimensions before the browser decoder is used: no side above 16,384
pixels and at most 16,777,216 decoded pixels. APNG controls/chunk boundaries,
GIF frames and WebP frame/bitstream dimensions are checked as well as their outer
canvas. Animation costs count full composited canvases per frame, including an
APNG's separate default picture when present. Each SVG and the accepted `sanitizeUserImages` collection share the
same pixel ceiling, preventing many individually small files from multiplying
the decoded memory budget. The collection also has a 50,000-element SVG budget.
Malformed or over-budget artwork is omitted during sanitization. Before import,
the prospective merged collection is checked too: native backup import fails
without changes if the combined collection does not fit, and Admonition
reserves the existing collection's cost before admitting new pictures. Rejected
new pictures are reported; an import never evicts existing pictures to make room.

Header checks reduce resource-exhaustion risk; they do not replace the browser's
decoder or guarantee its behavior for every corrupt bitstream. Material's
separate vendor-specific `sanitizeSVG` is unchanged.

User SVG CSS is parsed with the browser's non-adopted, constructed stylesheet
parser (`svgCss.ts`); parsing never installs a sheet or loads its imports.
Only flat style rules and an allow-list of drawing declarations survive.
All at-rules, nested rules, custom properties, substitutions and external
references are discarded, including escaped CSS spellings. Safe class-based
colors, inline drawing styles and literal local gradient/clip references remain;
`isolateSvgCopy` scopes selectors and renames local references per displayed copy.
Every style element takes the same event/attribute cleanup as the shapes.
Render realms without constructable stylesheets omit style blocks safely and
retain ordinary presentation attributes.

`scripts/test-svg-security.mjs` exercises the actual DOMParser, XMLSerializer,
CSS parser and live DOM in Chromium, in addition to the Node grammar tests.
Run it with an existing Playwright installation, setting `PLAYWRIGHT_MODULE`
to its module path when it is outside the repository. Requests are intercepted
and fail the test; no package or browser download is part of the runner.

> [!IMPORTANT]
> **User SVG is re-sanitized on every read, not just when first added.**
> `data.json` syncs between devices and can be hand-edited or arrive via
> import - trusting a check that happened on some *other* machine would be
> trusting nothing at all. This is the same defensive posture
> `PackDataStore` takes toward its own checksums.

## "Your images" - the local, never-downloaded source

[`src/icons/userImageImport.ts`](../../src/icons/userImageImport.ts) +
[`src/icons/packs/userImages.ts`](../../src/icons/packs/userImages.ts).

- **One stored representation for everything uploaded.** An SVG stays SVG
  (sanitized, kept as vector - sharp at any size). A PNG/JPEG/WebP is
  **decoded, scaled so its longest side is ≤128px** (`MAX_RENDITION_PX` -
  chosen so a 3× device-pixel-ratio render at the icon-size slider's 150%
  maximum still has headroom), drawn onto a canvas, and re-encoded, then
  wrapped in `<svg><image href="data:…"></svg>`. **This is the security
  story for rasters too**: what's stored is decoded pixels, so nothing of
  the original file's structure survives to be interpreted by anything
  later.
- **Format detection reads file bytes, not the extension** (`detectFormat`)
 - a mislabeled `.png` that's actually a JPEG is routine, and trusting the
  filename would reject perfectly good pictures.
- **Dimensions are checked before decoding**, in addition to the 5 MiB source
  file limit. A highly compressed oversized PNG is rejected before assigning
  its object URL to an `Image`; a decoded-dimension check runs again after load.
- **Uniqueness key is the filename**, compared case-insensitively (matching
  how macOS/Windows filesystems already treat names) - `logo.svg` and
  `logo.png` are two pictures; two `logo.png` uploads are the same one
  twice, and adding the second is refused. This check happens **only** at
  upload time - an import (which merges by id) or a hand-edited
  `data.json` can still end up with colliding names, and nothing on the
  read side drops a picture over it, because that would delete artwork
  callouts are actively pointing at.
- **`monochrome` is detected on import** (a flat one-colour SVG drawing) and
  seeds `CalloutIcon.recolor`'s default - only an SVG is offered as
  recolourable at all; a raster never is, because a mask is a stencil and
  running a photograph through one would flatten it to a silhouette.
  `followsCalloutColor(icon, image)` - `image.format === "svg" && icon.recolor
  === true` - is the single predicate both `CSSInjector` (mask vs.
  background-image) and `renderIconInto` (stencil vs. keep-own-colour) read,
  so the two paths can't drift apart.
- **`rev`** is bumped on every edit and folded into the pack's `cacheVariant`
 - this is what makes replacing a picture repaint every open note using it;
  without it, the render key would be identical before and after the
  replace, and nothing would know to redraw.
- **Storage is `settings.userImages`, inside `data.json`** - not a file on
  disk - specifically so it syncs with the rest of settings and travels
  inside a plain JSON export without the export having to become an
  archive.

`icons/packs/userImages.ts` keeps a **module-level snapshot**
(`setUserImages()`, called by `CalloutRegistry` on load and on every edit)
rather than reading `settings` directly, because `buildSvg()` is synchronous
by contract and is called from render paths that have no route back to the
plugin instance.

## Search indexes and UI artwork

Every pack's **search index** (names, keywords, categories) ships inside
`main.js`, encoded via [`src/icons/data/codec.ts`](../../src/icons/data/codec.ts)
 - this is what makes searching every source work fully offline from install,
before any artwork download. Icon-pack artwork is not bundled: Lucide comes
from Obsidian, and the other SVG libraries are fetched as described above.
[`PackToolbarFilters`](../../src/settings/iconpicker/PackToolbarFilters.ts)
renders category and named variant filters through `SelectDropdown`, preserving
its intrinsic option sizing and change-only callbacks. The emoji skin tone filter
uses a selection-only `ListboxPopup` for its richer rows. Both share the same
popup engine. The source picker uses the same 36px control,
focus treatment and up/down chevron, so the toolbar reads as one family of
fields. Material's three-filter toolbar puts search on its own row at any
modal width, leaving the style, weight and category fields room to show their
selected labels; the fields wrap when they cannot fit together. On wider screens,
Tabler keeps search beside its two filters but gives it a smaller width so the
style and category choices have more room. Every source's filters share the
remaining width on their flex line, including when they wrap below search.
The toolbar's `flex-grow: 1` rule matches the specificity of the shared select
wrapper while preserving its intrinsic width basis, so Font Awesome's style and
category fields also fill the row without changing their wrapping threshold.
`sourcePicker.ts`
also measures the grid scroll gutter with a
`ResizeObserver`, keeping the fixed source row aligned with the toolbar
when a scrollbar appears; the modal disconnects it on close. An open-generation
guard invalidates pending startup and count loads after close or reopen, so
late work cannot create detached picker listeners or repaint a newer menu. The emoji control shows the chosen hand sample
beside its label and samples each option in the menu. `PackPanel` keeps the
search and filter controls disabled until a downloaded pack is ready, persists
committed filter choices through its host, and destroys the listboxes when the
source panel closes. A tone change repaints visible glyphs without resetting
the grid's scroll or pagination; other variants rebuild the filtered grid.
The toolbar mirrors each rendered select filter as `has-${key}-filter`, and
removes those classes when its filters are destroyed. Layout reads the Tabler
style and Material weight markers instead of querying child controls with
`:has()`. `IconGrid` similarly marks its body `icon-picker-grid-empty` only
while it renders the empty-collection message, clearing it for entries or
`showMessage()`. The image panel centers that state; search misses, download
prompts, loading, and errors keep their separate message layout.
The two plugin UI composites are the only bundled icon artwork. Regeneration
of search indexes and downloadable packs is a deliberately
separate, manual step - `npm run icons:generate` - **never** part of
`npm run build`, and its output **is committed to the repo**. See
[Build, test, and release](20-build-test-release.md#regenerating-icon-and-locale-data)
and [Adding or modifying features](22-extending.md#refreshing-icon-pack-artwork).

---
Next chapter: [14-callout-editor.md](14-callout-editor.md)
