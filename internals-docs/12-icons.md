# Icons

Covers the whole icon subsystem: [`src/icons/`](../src/icons/) — the service
layer (fetching, caching, resolving), the pack registry (what each library
looks like as data), rendering, and the "Your images" user-upload source.

## Two id spaces (recap)

From [Architecture](02-architecture.md#two-id-spaces-for-icons):
`IconSourceId` (8 members) is a library as the picker shows it; `IconPackId`
(11 members) is one body of downloadable/cacheable artwork. They coincide
except for Font Awesome (`fa` → `fa-solid`/`fa-regular`/`fa-brands`) and
Tabler (`tabler` → `tabler-outline`/`tabler-filled`).
[`src/icons/registry.ts`](../src/icons/registry.ts) holds both mappings as
**total, frozen `Record`s** — declaring a member on one union without a line
in the corresponding record is a compile error, not a silently-blank grid.

```ts
ICON_SOURCES: Record<IconSourceId, IconPack>       // the 8 libraries
SOURCE_OF_TYPE: Record<IconPackId, IconSourceId>    // which source owns each body of artwork
packFor(icon: CalloutIcon): IconPack | undefined     // undefined ⟺ icon.type unknown to this build
iconCacheKey(pack, name, variant): string             // "pack name variant" — pack-scoped, never source-scoped
```

> [!IMPORTANT]
> **Cache keys and pack-store calls always use `icon.type` (an `IconPackId`),
> never `pack.id` (an `IconSourceId`).** Using the source id would collapse
> Font Awesome's three styles onto one cache entry and one download state —
> picking a Brands icon would look "ready" for Solid too, and vice versa.

## The `IconPack` contract

[`src/icons/types.ts`](../src/icons/types.ts) defines the interface every
library implements — **pure data and pure functions, no I/O**. Downloading is
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
  buildSvg?(icon, role): string | null;                  // synchronous — a render path cannot wait
}
```

### `IconPackKind` — five supply models

| Kind | Members | How artwork reaches the screen |
| --- | --- | --- |
| `builtin` | Lucide | Obsidian's own `setIcon()`. No data, no network, ever. |
| `glyph` | Emoji | A text glyph drawn as a text node. No SVG at all. |
| `perIconRemote` | Material Symbols | One SVG fetched per icon, from Google, on choice — see below. |
| `bundledRemote` | Tabler, Font Awesome, Octicons, RPG Awesome | One file per pack downloaded once, then fully offline. |
| `local` | Your images | Held in `settings.userImages`. Never fetched, ever. |

### `cacheVariant` — everything besides the name that changes the drawing

Must cover **every** axis that changes the *artwork itself*, or two visually
different drawings collide on one cache entry:

- Material encodes `style` + `weight` (100,000+ combinations, hence
  `perIconRemote`).
- Octicons encodes the **pixel height it drew at** — it ships two sizes (16px
  for small surfaces, 24px for large) and `entryMatches`/role dispatch pick
  between them.
- "Your images" encodes the picture's `rev` (bumped on every edit — this is
  what makes replacing a picture repaint every open note that uses it,
  because otherwise the render key would be unchanged before and after) plus
  a `c` suffix when `icon.recolor` is set — two callouts sharing one picture
  with different recolour settings must not share a cache entry, or one
  would keep the other's paint.
- Packs with a single drawing per icon (Tabler, Font Awesome, RPG Awesome)
  use `""`.

## `IconService` — the one entry point

[`src/icons/IconService.ts`](../src/icons/IconService.ts) is what `main.ts`
and every other consumer talks to; it composes two very different fetch
strategies behind one interface.

```ts
initialize(): Promise<void>          // startup — see below
ensureArtwork(icon): Promise<void>     // the picker's "Confirm" button
ensureArtworkFor(icons): Promise<void>  // the ONLY repair path — batches
hasFailed(icon, role): boolean
```

### `initialize()` — startup order matters

```text
1. Filter registry.getAll() to icons whose callout actually shows one (hideIcon !== true)
2. packs.loadUsed(types)     — read from DISK only the packs this vault references
3. cssInjector.inject()       — repaint with whatever was already on disk
4. fetch.ensureAll()           — Material's per-icon sweep FIRST (one attempt per icon)
5. ensureArtworkFor(icons)      — repair whatever the packs would still need
```

> [!NOTE]
> **Material runs before the general repair pass, deliberately.** Material's
> `ensureAll()` is built for exactly this moment — one attempt per missing
> icon, no retries. Running the general `ensureArtworkFor` first would send
> every missing Material icon through `cacheOne`'s full three-attempt retry
> loop (with waits between attempts) on a vault that may simply be offline —
> multiplying startup latency for no benefit.

A callout with `hideIcon: true` is explicitly excluded from this whole
sweep — nothing paints it, so pulling its pack off disk (or worse, the
network) would be pure waste. Its cached SVG is left untouched by cleanup
passes, so turning the icon back on later needs neither a re-download nor a
re-fetch.

### `ensureArtworkFor(icons)` — the only repair path

This is the function called from **both** places an icon can arrive without
having gone through the picker: **import** (a file names icons this vault may
not have) and **startup** (an icon a callout uses whose artwork went missing
or failed its checksum). It:

1. Filters to icons not already fully cached and not already known-failed
   this session.
2. Groups by `icon.type` (never by source) — so twenty Font Awesome Brands
   icons cost **one** download, not twenty.
3. Fetches **sequentially within a group** — "parallel requests to one CDN
   gain nothing and make a failure harder to attribute," per the source
   comment; the first icon in a group triggers the pack download, the rest
   just copy artwork out of the now-present pack.
4. Announces what was restored **once, for the whole batch** — anything that
   failed has already announced itself individually (a per-icon Notice from
   `IconFetchManager`, or a permanent error state via `hasFailed`).

### `isFullyCached(icon)` — checked per render role, not just the one on screen

A pack can draw the same icon differently per role (Octicons' two sizes), and
`copyPackArtwork` stores **every** role's drawing when an icon is first
committed — not just the block-callout drawing. `isFullyCached` mirrors this:
it checks all three `CALLOUT_RENDER_ROLES`, which is what lets a user enable
the (previously disabled) inline-callout role later without needing the
source pack to still be downloaded.

## `PackDataStore` — bundled-file download and verification

[`src/icons/PackDataStore.ts`](../src/icons/PackDataStore.ts) handles the
`bundledRemote` packs (Tabler, Font Awesome, Octicons, RPG Awesome).

```ts
loadFromDisk(id): Promise<PackDiskResult>   // "ready" | "missing" | "corrupt" — NEVER fetches
download(id): Promise<boolean>               // fetches, verifies, persists
```

**Every read — download or disk — is SHA-256-verified against
`PACK_MANIFEST` baked into the build.** Two URLs are tried in order
(`packUrls(id)` — jsDelivr first, `raw.githubusercontent.com` fallback), each
pinned to the **`packs-v2`** immutable tag (see
[Adding or modifying features](19-extending.md#refreshing-icon-pack-artwork)
for what "refreshing" a pack actually requires).

> [!CAUTION]
> **A checksum mismatch on disk is treated as `"corrupt"` — rejected
> outright, unlike a locale file's staleness handling.** This is a
> deliberate difference from `LocaleStore` (see
> [Localization](16-i18n.md#locale-file-staleness-vs-a-corrupt-icon-pack)):
> an icon pack's checksum only ever changes when the pack's *contents*
> change (a refresh with a new tag), so a mismatch here means edited or
> damaged data, not "an older but still-valid copy." A locale mismatch, in
> contrast, is nearly always just an older-but-fine translation missing a
> few newer keys — hence that one is accepted as "stale" rather than
> discarded.

`persist()` is best-effort — a read-only vault or a suspended mobile app must
not cost the user the download they just completed, so a write failure only
downgrades the pack to session-only availability (with a one-time warning
Notice, `diskWriteBroken`, so the user isn't nagged on every subsequent
failure).

**Manual install**: dropping a correctly-named file into `icon-packs/` by
hand works — it's read and verified on the next launch exactly like a
downloaded one. This is intentionally undocumented in the picker UI itself
(README: "a path for someone who already knows to look, not an option worth
putting in front of everyone downloading an icon set").

## `IconFetchManager` — Material Symbols, one icon at a time

[`src/icons/IconFetchManager.ts`](../src/icons/IconFetchManager.ts) is the
`perIconRemote` counterpart, needed because Material's 3,870 icons × 4 styles
× 7 weights is over 100,000 combinations — no bulk file could cover it.

- **3 attempts, 2-second delay between them** (`MAX_ATTEMPTS`,
  `RETRY_DELAY_MS`), then permanent failure for the session
  (`failed: Set<string>`, **in-memory only** — every launch is a fresh
  chance, which is what makes it safe for the startup sweep to record
  failures for a vault that simply happened to be offline at that moment).
- **Each HTTP attempt has a 30-second deadline.** A stalled request becomes
  an ordinary failure, so startup can advance to the next icon and the picker
  can finish its bounded retries. The underlying Obsidian request cannot be
  aborted; late results are ignored and the deadline timer is always cleared.
- **Concurrent requests for the same drawing share one promise**
  (`inFlight`), keyed identically to the cache — so the picker's "Confirm"
  and the callout editor's save both asking for the same icon at once cost
  one fetch, not two racing to write the same bytes.
- **Deliberately does not run `cleanupUnusedIconSvgs()`** after a successful
  fetch — the icon may have just been picked in the picker and not yet
  attached to any callout; a cleanup sweep at that moment would delete
  exactly what was just fetched.

## `IconResolver` — the read-only, synchronous view every renderer uses

[`src/icons/resolver.ts`](../src/icons/resolver.ts) is what stands between
"an icon might need fetching" and "a render path that cannot wait":

```ts
resolveSvg(icon, role): string | null   // data.json cache first, then pack.buildSvg() — never fetches
hasFailed(icon, role): boolean
```

Resolution order: **whatever was already copied into `data.json`** wins
first (that's the copy that syncs across devices, so it renders correctly
even where the pack was never downloaded), falling back to
`pack.buildSvg(icon, role)` for artwork the pack can construct from data it
already holds locally (bundled path data, or a locally-held user image).
Neither step ever touches the network — a resolver is purely synchronous.

`createIconResolver` memoizes the no-failure-tracking variant per lookup
object (`WeakMap`) because a full-document repaint sweep requests one per
token; `createStatusIconResolver` is the failure-aware variant used only by
the two surfaces that need to distinguish "still downloading" from "gave up"
— the settings callout list and the editor's icon preview. Every other
surface (block/heading/inline rendering, autocomplete, PDF export) just
shows a placeholder either way.

## `renderIcon.ts` — the only "icon → DOM" painter

[`src/icons/renderIcon.ts`](../src/icons/renderIcon.ts) is explicitly the
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

`renderIconInto` is wrapped in a `try/catch` — `setIcon` and `DOMParser` can
both be missing in "exotic render realms" (a PDF-export clone, a pop-out
window mid-teardown), and a missing icon there is always preferable to a
crash mid-render.

`renderNoIcon(target)` is the **separate** function for a callout the user
explicitly set to `hideIcon`, and it is used **only** on surfaces that
*manage* callouts (settings list, autocomplete popup, statistics/replace
modals) — those are columns of rows where a genuinely empty slot would both
break the column layout and look identical to "still downloading." It draws
a faint dashed ring instead. Content surfaces (the actual rendered callout,
heading/inline tokens, PDF export) draw **nothing at all** and let the flex
gap collapse — see [Render roles § hideIcon](08-render-roles.md#hideicon-and-flex-gap-collapse).

## SVG sanitization — two sanitizers, two threat models

[`src/icons/svg.ts`](../src/icons/svg.ts) makes the distinction explicit and
deliberate:

| Function | Input | Model | Approach |
| --- | --- | --- | --- |
| `sanitizeSVG` | Material Symbols, fetched individually from Google | One known vendor, one known output shape | **Deny-list** of the obviously executable (`<script>`, event handlers, `javascript:`/`data:text/html` URLs) |
| `sanitizeUserSvg` | A file the user picked off their own disk | Could be *anything*, and it's inserted into the live DOM | **Allow-list** — unknown elements and unknown attributes simply do not survive |

Downloadable bundled packs (Tabler, FA, Octicons, RPG Awesome) ship **bare
path data**, not full SVG documents, and need no sanitization at all — there
is no markup to sanitize.

The user-image allow-list (`USER_SVG_ELEMENTS`) permits shapes, grouping,
gradients, and clipping — enough to draw any icon — and explicitly excludes
`<use>` and `<foreignObject>` (both pull in content by reference),
`<animate>`/`<set>` (can assign event-handler attributes at runtime), and any
nested `<svg>` (would re-open the whole attack surface one level down).

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
> import — trusting a check that happened on some *other* machine would be
> trusting nothing at all. This is the same defensive posture
> `PackDataStore` takes toward its own checksums.

## "Your images" — the local, never-downloaded source

[`src/icons/userImageImport.ts`](../src/icons/userImageImport.ts) +
[`src/icons/packs/userImages.ts`](../src/icons/packs/userImages.ts).

- **One stored representation for everything uploaded.** An SVG stays SVG
  (sanitized, kept as vector — sharp at any size). A PNG/JPEG/WebP is
  **decoded, scaled so its longest side is ≤128px** (`MAX_RENDITION_PX` —
  chosen so a 3× device-pixel-ratio render at the icon-size slider's 150%
  maximum still has headroom), drawn onto a canvas, and re-encoded, then
  wrapped in `<svg><image href="data:…"></svg>`. **This is the security
  story for rasters too**: what's stored is decoded pixels, so nothing of
  the original file's structure survives to be interpreted by anything
  later.
- **Format detection reads file bytes, not the extension** (`detectFormat`)
  — a mislabeled `.png` that's actually a JPEG is routine, and trusting the
  filename would reject perfectly good pictures.
- **Uniqueness key is the filename**, compared case-insensitively (matching
  how macOS/Windows filesystems already treat names) — `logo.svg` and
  `logo.png` are two pictures; two `logo.png` uploads are the same one
  twice, and adding the second is refused. This check happens **only** at
  upload time — an import (which merges by id) or a hand-edited
  `data.json` can still end up with colliding names, and nothing on the
  read side drops a picture over it, because that would delete artwork
  callouts are actively pointing at.
- **`monochrome` is detected on import** (a flat one-colour SVG drawing) and
  seeds `CalloutIcon.recolor`'s default — only an SVG is offered as
  recolourable at all; a raster never is, because a mask is a stencil and
  running a photograph through one would flatten it to a silhouette.
  `followsCalloutColor(icon, image)` — `image.format === "svg" && icon.recolor
  === true` — is the single predicate both `CSSInjector` (mask vs.
  background-image) and `renderIconInto` (stencil vs. keep-own-colour) read,
  so the two paths can't drift apart.
- **`rev`** is bumped on every edit and folded into the pack's `cacheVariant`
  — this is what makes replacing a picture repaint every open note using it;
  without it, the render key would be identical before and after the
  replace, and nothing would know to redraw.
- **Storage is `settings.userImages`, inside `data.json`** — not a file on
  disk — specifically so it syncs with the rest of settings and travels
  inside a plain JSON export without the export having to become an
  archive.

`icons/packs/userImages.ts` keeps a **module-level snapshot**
(`setUserImages()`, called by `CalloutRegistry` on load and on every edit)
rather than reading `settings` directly, because `buildSvg()` is synchronous
by contract and is called from render paths that have no route back to the
plugin instance.

## Search indexes are bundled; artwork is not

Every pack's **search index** (names, keywords, categories) ships inside
`main.js`, encoded via [`src/icons/data/codec.ts`](../src/icons/data/codec.ts)
— this is what makes searching every source work fully offline from install,
before any artwork download. **Artwork itself is never bundled** (beyond
Lucide, which Obsidian already ships). Regeneration is a deliberately
separate, manual step — `npm run icons:generate` — **never** part of
`npm run build`, and its output **is committed to the repo**. See
[Build, test, and release](17-build-test-release.md#regenerating-icon-and-locale-data)
and [Adding or modifying features](19-extending.md#refreshing-icon-pack-artwork).

---
Next chapter: [13-callout-editor.md](13-callout-editor.md)
