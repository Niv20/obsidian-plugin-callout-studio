# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. For a fuller derivation of any section here — full reasoning, edge cases, cross-links — see [`internals-docs/00-index.md`](internals-docs/00-index.md), which expands on this file for the same audience: programmers reading the source or preparing a PR, not end users.

## Commands

```bash
npm run dev       # watch-mode build (esbuild, inline sourcemaps)
npm run build     # production build (typecheck + minify)
npm run lint      # ESLint across src/
npm test          # every tests/*.test.ts, bundled by esbuild and run by node:test
```

`npm test` is a gate, not a courtesy — CI runs it beside the lint (`.github/workflows/lint.yml`), and it covers the pure utilities, the registry, the CSS it generates, both editor surfaces, the public API and the repo's own rules. Take it as the first place a change is proved, and add to it: a `todo` entry in a suite is a known bug someone wrote down, not a test that is allowed to stay red.

The suites are also **inside** the build's typecheck rather than beside it: `tsconfig.json` includes `tests/` as well as `src/`, so `npm run build` compiles them too — a test that no longer typechecks fails the build, and `target: ES6` rules out top-level `await` in a test file. `tests/repoTestGate.test.ts` holds both to it.

What it deliberately cannot see is Obsidian. The DOM is the stand-in in `tests/support/fakeDom.ts` and the `obsidian` module is a stub (`tests/support/obsidianStub.ts`), so anything that has to *look* right is still checked by hand: copy `main.js`, `manifest.json`, and `styles.css` to `<Vault>/.obsidian/plugins/callout-studio/` and reload Obsidian.

Versions: bump `manifest.json` + `versions.json` together. Tag must match `manifest.json` version exactly (no leading `v`).

Releases are cut with the `/release` skill (`.claude/skills/release/SKILL.md`) — it bumps all four version files, tags, pushes, waits for the build, and publishes. Don't bump or tag by hand.

## Architecture

Callout Studio is an Obsidian plugin that lets users create and manage custom callout types with icons, colors, and styles. It bundles `src/main.ts` → `main.js` via esbuild.

### Core managers (`src/manager/`)

- **CalloutRegistry** — single source of truth for all callout definitions. Owns the `Map<id, CalloutDefinition>`, serializes to/from `data.json`, runs CRUD and data migrations, fires `onChange` callbacks on every mutation.
- **CSSInjector** — reads the registry and generates dynamic CSS custom properties per callout (colors, icons, light/dark overrides). Uses `adoptedStyleSheets` (one global per window). Injects synchronously, guarded by a re-entrancy latch. Calls `app.workspace.trigger("css-change")` after inject to force Obsidian re-render. **Every `[data-callout="…"]` it writes goes through `utils/calloutSelector.ts`** — `calloutSel` for Obsidian's own DOM (dasherized id), `tokenAttrSel` for the heading/pill/ref DOM (space-preserving id), both escaping through `cssAttrValue`. A `"` or `\` reaches an id without the user typing it (vault discovery's header regex allows both; import's `ID_BAD_CHAR_RE` only rejects pipes and brackets), and concatenating one corrupts the sheet from that rule onward.
- **CalloutDiscovery** — watches file-open/modify events and scans markdown for unknown `[!id]` patterns. Auto-creates "fallback" rows for new IDs. Prunes unused auto-created rows in a background debounced pass. **An explicit delete wins over discovery**: `suppressRediscovery()` holds an id off for a few seconds, because the delete's `vault.modify` reaches open CodeMirror buffers asynchronously and `SettingsTab.display()` — called on the very next line — scans exactly those buffers, so without it the row returns one tick later as an *uncustomized* fallback row and the delete reads as a style reset. `runVaultScan` clears the hold; a user-requested scan may bring anything back.
- **cssSnippetExport** (`src/manager/`) — the *user-initiated* CSS snippet, at `<configDir>/snippets/callout-studio-custom.css`. Its sibling `legacyStartupSnippet.ts` deletes the *automatic* one versions ≤2.5.0 wrote, and the difference is the whole design: this file is written only on request and **never enabled**. Enabling it would make it a second, frozen generation of the live sheet's rules, and since the generator skips a `.theme-dark` override whenever it would duplicate the unscoped one, a stale, more-specific dark block would outrank the fresh unscoped rule for as long as the file sat there. It reuses `CSSInjector.generateCalloutCSS`/`generateGlobalStyleCSS` through their `standalone` flag, which drops the `.cs-*` token rules — that DOM is ours, so nothing carries those classes once the plugin is gone. The header carries a SHA-256 of its own body, which is the only way to tell "the settings changed" from "the user edited this file"; a byte-identical re-export writes nothing at all, because every vault write is a sync event.
- **IconService** (`src/icons/`) — the one entry point to icon artwork. Owns `IconFetchManager` (Material's per-icon fetches from fonts.gstatic.com) and `PackDataStore` (whole-pack downloads, SHA-256 verified on download *and* on every disk read, cached under `<plugin-dir>/icon-packs/`). Notifies listeners when artwork lands so CSS can re-inject. `ensureArtwork()` covers one icon (the picker); **`ensureArtworkFor()` is the only repair path** — it takes a batch, skips anything already drawable from `iconSvgCache`, groups the rest by `icon.type` so a pack downloads once, and is what import and startup both call.

### Data flow

1. User edits a callout → `registry.update()` → `onChange` fires  
2. `onChange` → `cssInjector.inject()`, which emits the Obsidian CSS-change trigger itself. There is no `scheduleInject` and no debounce: scheduling one *and* triggering `css-change` ran the whole pass twice per mutation (see `main.ts`). Repeat work is collapsed by output instead — an inject whose text is byte-identical to the last stops before the stylesheet swap, the `localStorage` write and the trigger.  
3. `CSSInjector.inject()` → new CSS in `adoptedStyleSheets` + DOM icon refresh  
4. User opens a note → `CalloutDiscovery` scans → auto-creates fallback rows if needed  
5. Icon selected → `IconService.ensureArtwork()` → fetch if needed → copy into `iconSvgCache` → re-inject  

### Settings UI (`src/settings/`)

**Every modal wears the same chrome, and `modalChrome.ts` is the only way to put it on.** `applyModalChrome(modal, {footer?, wide?})` gives the window three bands — a fixed header whose rule runs edge to edge, `.modal-content` as the *one* scroll container, and (when `footer` is set) the returned pinned button bar. It works by taking Obsidian's own 16px off `.modal` and handing it to the bands as `--cs-modal-inset`, so a new window must never re-add padding to `.modal` or `.modal-content`. Buttons go in the returned footer, not in a `modal-button-container` inside the content. **Every window wearing the chrome sets a title, and there is no opt-out** — the option that used to hide the header band is gone, along with the `.cs-modal-no-title` rule, because hiding the band is precisely what let two unlabelled windows ship unnoticed. This is why `ConfirmModal` takes its title as a *required* constructor argument: it is generic, so only the caller knows what is being confirmed, and a compiler-enforced parameter is what keeps the invariant true. `ReplaceCalloutModal` defaults its title from its `mode`. The one deliberate exception is `WelcomeModal`, which is a splash, opts out of the chrome entirely, and carries its name as a hero heading in its own left column instead. **Anything sticky inside the body must sit at `top: 0`** — a positive offset parks an opaque layer below the header rule and eats the text scrolling behind it (see `.callout-studio-preview-col`).

**Inside a modal, a surface meant to read as flush with the window paints `var(--cs-surface, var(--background-primary))`, never `--background-primary` directly.** The chrome defines `--cs-surface: var(--modal-background)` on `.modal.cs-modal` and nowhere else, so the fallback keeps the settings tab (which Obsidian itself paints `--background-primary`) unchanged. The two are the same variable on the desktop, which is what hid the bug for so long: mobile dark redefines `--color-base-00` to a true `#000` for OLED, and `.is-mobile.theme-dark` (phone *and* tablet) moves `--modal-background` onto `--background-secondary` — so every band painted `--background-primary` came out as a pure-black stripe across an iPad in dark mode. This covers fixed bands, panels, popup menus, and the ring cut out around the icon tile's ⓧ (`box-shadow`, so it must move with whatever is behind it). Deliberately *not* covered: `.cs-live-preview-body` and `.cs-gap-demo`, which emulate a **note** surface and so really do want `--background-primary`.

**Its companion is `var(--cs-surface-raised, var(--background-secondary))` — anything that must read as *raised off* that surface: a group box's header strip, a card, a control, a row pill.** The two are one pair and must always move together; setting one alone is precisely how the group boxes broke. `--background-secondary` is the raised shade only while `--modal-background` is `--background-primary`, and mobile dark is where that stops being true — it repoints `--modal-background` **onto** `--background-secondary`, so a strip painted with it lands exactly on the surface it is meant to sit above and disappears. `.is-mobile.theme-dark .modal.cs-modal` therefore re-derives it as a step *off* `--cs-surface` (`color-mix` with `--mono-100`) rather than naming a replacement colour, which reproduces the desktop's own step (`#1C1C1C` → `#282828`) on whatever the window turns out to be and survives a theme that repoints `--modal-background` again. Everything else — desktop both themes, mobile light, the settings tab, where the token is undefined — falls through to `--background-secondary` unchanged.

`SettingsTab.ts` composes 11 section modules under `settings/sections/`. **Import and Export are each one row opening a chooser** — `ImportSourceModal` picks a source, `ExportFormatModal` picks a format (backup `.json` vs CSS snippet) and owns both handlers; a second top-level row for a new format would leave the two halves of one section shaped differently. Both windows are a column of clickable rows and share one set of rules in `styles.css` as selector lists. `CalloutEditor.ts` is the edit/create modal with a real, editable Live Preview via `LiveCalloutPreview.ts`, which hosts an embedded Obsidian markdown editor (`EmbeddableMarkdownEditor.ts`) so callouts render 1:1 with a note in the active theme; it falls back to a static `MarkdownRenderer` render if the (undocumented) embed API is unavailable. `settings/iconpicker/` is the icon picker: `IconPickerModal` (source menu + preview + confirm), `PackPanel` (one source's toolbar and grid, driven entirely by its `IconPack`), `IconGrid` (paging and key nav), `allSources` (the pooled cross-source search).

### Editor integrations (`src/editor/`)

- **AutoComplete** — `EditorSuggest` triggered by `> [!`; shows callout list + "Create new" option.
- **ContextMenu** — right-click menu on callout blocks (edit, copy, settings).
- **Commands** — the 6 fixed commands: open settings, create new type, insert empty, wrap selection, unwrap block, open quick insert. Deliberately *not* one per callout type — that would flood the palette. The two that only open a window get their opener injected as `FixedCommandDeps`, so `commands.ts` never imports the settings tree.
- **QuickInsertModal** (`src/settings/`) — the ribbon's *Quick insert block callout* window: one alphabetical list of every usable callout, a search box, a source filter persisted as `settings.quickInsertSource`, and per row an Edit button (`openCalloutEditorFor`, which stacks the real editor above and refreshes this list when it closes) and an Insert button. **Each row *is* the callout**: `quickInsertPreview.ts` feeds `buildBlockHeaderToken(def)` — the very line Insert writes — to `MarkdownRenderer.render`, so the row is drawn by Obsidian's own callout renderer under `.markdown-preview-view > .markdown-rendered`, styled by core CSS, the injected per-callout rules and the theme, with the registered post-processor baking the icons in. Nothing draws a callout by hand, so nothing can drift from the note; `externalStyle` rows and `hideIcon` come out right for free. One render for the whole list, cached by id, so filtering stays synchronous. The two buttons sit *outside* the rendered box — inside it they would read as content — and the preview is `pointer-events: none` and `aria-hidden`, so a foldable callout shows its real chevron without behaving like one. **Block callouts only** — the title says so because one definition also renders as a heading and an inline callout. It writes nothing itself: Insert calls `wrapSelectionInCallout(editor, { def })`, the same function `callout-wrap` and every user-built wrap command call, so the three cannot drift. The editor it writes into comes from `editor/targetMarkdownEditor.ts` — `getActiveViewOfType(MarkdownView)`, **never `workspace.activeEditor`**, which can be the embedded live-preview editor inside this plugin's own modals; captured when the window opens and re-checked when Insert is pressed. That resolver answers a *result*, not a `null`: "nowhere to insert" is three situations with three different ways out (`no-note`, `reading-view`, `no-cursor`), and `quickInsertMessages.ts` turns each into its own sentence. Two things there are load-bearing. `getActiveViewOfType` reads `activeLeaf`, which **a click in the sidebar takes over** — so a note open in Live Preview stops being the "active view" the moment the user touches the file explorer, and `getMostRecentLeaf()` (Obsidian's own fallback, as in its `editor:focus` command) is what finds it again. And that fallback **identifies the note without authorizing a write**: `Editor.getCursor()` cannot report "no cursor" — CodeMirror 6 always has a selection, at `{line: 0, ch: 0}` in an untouched editor — so provenance is the only evidence there is, and writing to something reached that way put callouts on line 1 of notes nobody was typing in.
- **calloutWriter** — the only place a `CalloutDefinition` becomes token markdown, per role. Both AutoComplete and the custom commands write through it so the fold mark, the title policy and the `|metadata` carry-over can't drift apart.
- **CustomCommandManager** — the commands the user builds in *Settings → Keyboard shortcuts → Manage commands*, stored in `settings.customCommands`. That one window is the whole section: `CommandBuilderModal` puts the user's own list first and the fixed commands under it (same row, minus the icon column and the buttons — there is nothing to edit), and both carry the shortcut chip from `settings/hotkeyLink.ts`. `commands.ts` exports `FIXED_COMMAND_IDS`/`FIXED_COMMAND_NAME_KEYS` so that list can't drift from what is really registered.

  **Its whole design is one idempotent sweep, `syncAll()`, subscribed to `registry.onChange`.** That event carries no payload and an id rename is really `remove()` + `add()`, so no listener can tell a delete from an update; re-deriving the desired set from the registry converges from any state instead, which is what makes delete, auto-prune, edit, import, startup and re-enable all one code path. Three things follow, and each had to be true:
  - **A command's `id` is minted identity, never derived from its content** — Obsidian keys the user's hotkey by the command id, and `Commands.removeCommand` clears only `defaultKeys`, so re-registering at the same id keeps the binding. Editing a command must not change it.
  - **Only a changed rendered *name* triggers re-registration.** An icon or colour edit leaves it identical (no churn); a `displayName` edit changes it (label stays accurate). `addCommand` also mutates its argument and appends an unload callback, so it must get a fresh object and must not be called needlessly.
  - **Rename is the one case a sweep can't infer.** `CalloutEditorSave` wraps its remove/add pair in `registry.batch()` and calls `migrateCalloutId()` inside, so the single event that follows sees a consistent world. Subscribed *before* `main.ts`'s save listener, so a prune lands before either save snapshots settings.

  `CalloutDiscovery`'s prune skips ids a command references — a command is a claim on a callout, like customizing it.

### Icon sources (`src/icons/`)

Two id spaces, kept apart in `icons/registry.ts`, both total `Record`s so declaring an id without the thing behind it is a compile error:

- **`IconSourceId`** (8) — a library as the user meets it: one row in the picker's source menu, one toolbar, one Download button. `ICON_SOURCES` maps it to the `IconPack` (`icons/types.ts`).
- **`IconPackId`** (11) — one body of artwork: one `CalloutIcon.type`, one pack manifest entry, one downloaded file, one SVG cache key. `SOURCE_OF_TYPE` maps it to its source, which is what `packFor(icon)` walks.

They differ only for Font Awesome (one source, three files — `fa-solid`/`fa-regular`/`fa-brands`) and Tabler (one source, two — `tabler-outline`/`tabler-filled`), each chosen by its style control. **Cache keys and pack-store calls use `icon.type`, never `pack.id`** — using the source id would collapse the styles onto one entry and orphan everything already cached.

`IconPackKind` decides how artwork reaches the screen: `builtin` (Lucide, via `setIcon`), `glyph` (emoji), `perIconRemote` (Material — 100,000+ style/weight variants, so fetched one at a time), `bundledRemote` (Tabler, Font Awesome, Octicons, RPG Awesome — files downloaded on request, listed per source in `dataPacks`), `local` (**Your images** — the user's own files, held in `settings.userImages`, never fetched).

Two subsystems are narrow enough to live in their own skill rather than here: Tabler's stroked outline drawings (`tabler-outline-stroke` skill) and the **Your images** user-upload source (`user-image-icons` skill).

A pack's optional `entryMatches` filters the grid by variant (Font Awesome's style and Tabler's pick *which* icons exist, not just how they look — only 1,054 of Tabler's 5,130 have a filled drawing), and `pickerNotice` scopes a standing notice to certain variants (the Brands trademark note).

`renderIcon.ts` is the **only** code that turns an icon into DOM; every surface calls `renderIconInto`. Never reach into the SVG cache from a renderer — go through `IconResolver`.

Search indexes are bundled (packed by `icons/data/codec.ts`); artwork is not. Regenerate with `npm run icons:generate` — never part of `npm run build`, and its output is committed. Pack files are served from the `packs-v2` tag; refreshing them means a **new tag** plus updated checksums in `icons/data/packManifest.ts`, because jsDelivr caches tags permanently.

### Callout colour and the nesting invariant

**Backgrounds are painted as translucent tints, never the authored hex — there is no opt-out.** Obsidian's nested-callout stepping only works by compositing translucent layers; an opaque fill hides everything behind it and breaks nesting for anything stacked inside. This is why the old `solidBackground` flag was retired rather than kept as a toggle. `translucentTintFor` (`utils/colorUtils.ts`) does the actual color-mix math, and an unmodified built-in still gets no `--callout-color` at all so theme overrides keep deciding its accent.

**Which alpha that math is run at is a second, separate decision, and `utils/bgTintAlpha.ts` owns it.** Every alpha at or above the minimum renders the callout *itself* identically — the source colour is re-solved along with it — so the choice decides only what shows *through*: a nested stack converges on the solved source, which sits `‖bg − backdrop‖ / alpha` from the page. Taking the smallest viable alpha, as this plugin once did unconditionally, is what let a red callout's nesting pile up into a red nobody picked. `accentAnchorAlpha` raises the floor so the source is never more intense than the callout's own accent — measured as **one distance** from the backdrop, never per channel — and it is a **preference, not a constraint**: a cap that cannot be met is dropped, because feeding it to `resolveTintAlpha` as a constraint returns null, and null is the opaque fallback, i.e. the very failure the cap exists to prevent. Nothing here bounds nesting *depth*, deliberately: doing that means diluting every level with `--background-primary`, which desaturates nested callouts instead of keeping them themselves. See the `callout-color-nesting` skill for the full derivation and the two migrations that clean up old data.

### Key types (`src/types.ts`)

`CalloutDefinition` is the core data model: `id`, `displayName`, `icon`, `hideIcon`, `colorLight`, `colorDark`, `aliases`, `iconAdjust`, `source` (`"builtin" | "user" | "fallback" | "theme" | "plugin"`), `metadata`.

**`hideIcon` is a display flag, not an icon.** It is deliberately not a `"none"` member of `IconPackId`: that union means *one body of artwork* (pack manifest entry, downloaded file, SVG cache key), a sentinel there would have to overwrite `icon` and lose the user's pick, and every older build would reject the whole entry on import since `validateIcon` only accepts a type it knows. So `icon` keeps holding the last drawing — turning the icon back on is instant and offline, because `cleanupUnusedIconSvgs` still counts it as in use. `true`-or-absent, like `transparentBg`/`externalStyle`. Three seams: `CSSInjector.iconHiddenCSS` (`display: none` on `.callout-icon`, outside `@media screen` so it holds in print, plus the per-callout reset of the global *Align content with title* indent); `buildCalloutTokenDom` builds no icon span at all (flex `gap` collapses with it, same trick as `refShowIcon`); and `renderNoIcon` draws a muted dashed ring on the surfaces that *manage* callouts, where a blank slot would read as a stalled download. `CalloutRegistry.COLOUR_NEUTRAL_FIELDS` is why hiding a built-in's icon persists without costing it the theme's `--callout-*` deference.

`PluginSettings` holds global style (border, radius, scale), feature toggles (autocomplete, context menu, icon source preferences), and the three lists the user builds up: `customPalettes`, `userImages` and `customCommands`. All live in settings rather than on `PluginData` precisely so `exportToJSONv2()` carries them — and all must therefore be **merged by id** on import, never `Object.assign`ed, or importing a file without them wipes the user's own. A new list also needs registering in **three** places or it is silently dropped on load: the `PluginSettings` interface, `DEFAULT_SETTINGS`, and `mergeSavedSettings()` (`utils/settingsMerge.ts` — its own module because the registry's `load()` and the import validator both ask it the same question).

### Callout sources

| Source | Meaning |
|--------|---------|
| `builtin` | One of the 13 defaults in `src/constants.ts` |
| `user` | User-created or customized |
| `fallback` | Auto-created by discovery for unknown IDs |
| `theme`/`plugin` | Injected by an import or an older build's API |

Built-in callouts are never stored unless modified — `toSaveData()` only persists modified built-ins and all user callouts. That rule is about `data.json` alone: `load()` seeds all 13 into the in-memory map unconditionally, so `getAll()` always returns every built-in. Nothing may displace one either — a saved row on a built-in id is merged onto the default and re-stamped `builtIn: true` whatever its own flag says, because there is only ever one callout per id, so such a row is that built-in's customization with its flag lost.

### Callout metadata (`[!type|metadata]`)

Obsidian splits a callout header at the **first `|`**: everything before it is the type, everything after is metadata (`data-callout-metadata`) — so `> [!note|purple]` is the `note` callout, not one named `note|purple`. **`splitCalloutMetadata`/`normalizeCalloutId` (`utils/calloutId.ts`) is the one funnel every raw-markdown path goes through**, which is what makes a piped id structurally unreachable by the registry — token `from`/`to` still span the whole `[!…]`, so nothing may derive a length from `rawId` alone, and anything that rewrites a token must put the metadata back. See the `callout-metadata-pipe` skill for the migration/edge-case reasoning (`stripMetadataFromIds`, the `notegreen` case, import rejection).

### Public API (`src/api/PluginAPI.ts`)

**Read-only, five members, and it stays that way.** `version`, `getCallouts()`, `getCalloutsDetailed()`, `getCallout(id)`, `onChange(cb)` — exposed at `app.plugins.plugins['callout-studio'].api` and documented for third parties in `API.md`, which is the contract. Treat it as stable: don't rename or change the meaning of a member without bumping `version`; new members may be added freely, since consumers are told to feature-detect those.

Two rules the implementation exists to enforce, both of which had been broken before:

- **Nothing live escapes.** Every return value is a frozen copy built by the mappers at the bottom of the file. The registry hands out real objects the renderer reads on every paint, so a consumer holding one could change styling with no re-inject and no save.
- **`usableDefinitions()` is the only list, and it is committed state.** It unions `getBuiltIn()` + `getUserDefined()` (both read through the registry's list view, so the transient live-preview *row* can't leak), reads every row through `getReal()` so the *values* can't either, and then drops unused discovered rows with the same predicate AutoComplete uses. The `getReal()` step is not redundant: a preview standing in for a callout the user already has passes through the list view as-is — the settings rows are meant to track the open editor live — but a preview fires no `onChange`, so a consumer reading during that window would cache a draft title and never hear that it was cancelled. `getCallout(id)` resolves through the registry ladder but then re-finds the result *in that list by id*, which is what keeps a lookup from returning something the list won't show.

`src/api/types.ts` holds the public shapes, deliberately separate from `src/types.ts` — `CalloutDefinition` moves whenever a feature lands, and this surface must not. Mutation, modals, icon artwork and wrap/unwrap are all intentionally absent; the earlier `registerCallout`/`unregisterCallout` pair was removed rather than fixed because it had no ownership model and leaked `source: "plugin"` rows into `data.json` forever.

### Localization (`src/i18n/`)

`t()` for all user-facing strings — never hardcode UI text. 32 locales live here (see `index.ts` for the loading/fallback-to-English logic). When adding or changing a string, only touch `en.ts`; don't re-translate the rest on every small edit — wait until the user confirms they're happy with the wording, then offer to translate it into the other locale files.

**Only `en.ts` is bundled.** The other 31 are generated into `locales/*.json`, served from the plugin's own release tag and cached at `<plugin-dir>/translations/`. That took `main.js` from 3.70 MiB to 1.70 MiB — esbuild emits ASCII-only output, so every non-Latin character was a 6-byte `\uXXXX` escape. Four things hold it together:

- **The checksum in the generated `localeManifest.ts` is also the staleness signal.** A cached file that hashes to what this build expects is *fresh* and nothing is fetched — so a release that didn't touch a locale re-downloads nothing even though the URL changed. One that doesn't is *stale*: registered and used anyway, so the user keeps their language offline while `t()` fills new keys from English, and refreshed in the background. Strict rejection is for the network only. A file is overwritten only after its replacement verifies, which is what makes an update unable to cost someone their translation.
- **The URL pins to `manifest.version`, not to a frozen tag.** The release tag already exists, so publishing new strings needs no tag work at all. The opposite choice in `packManifest.ts` is right for *its* case and wrong here: packs are megabytes that never change, locales are kilobytes that change most releases.
- **A locale *code* is not a locale *file*.** 34 codes map onto 31 files via `LOCALE_FILES` (`zh-hk`→`zhTW`, `no`→`nb`), so `registerLocaleFile` registers a table under every code it serves — registering under the file id alone would leave `zh-hk` resolving to English with the translation in memory. `setLocale` and `resolveLocaleFile` share one `resolve()` helper so the file downloaded and the table rendered can never disagree.
- **Generation is not optional.** `npm run i18n:generate` runs as `prebuild` (unlike `icons:generate`, it is local and sub-second), and both CI workflows re-run it and `git diff --exit-code`. A stale manifest would fail every download for that version.

Three surfaces snapshot translated text and need `plugin.applyLocaleChange()` when a locale arrives late: the open settings tab, `refreshRenderModes()` for the fold-chevron tooltip, and `refreshFixedCommandNames()` — which re-`addCommand`s at the **same id**, so the user's hotkey survives (same reasoning as `CustomCommandManager.syncAll()`).

## Coding conventions

- Keep `src/main.ts` minimal — lifecycle and wiring only. All logic lives in sub-modules.
- Files over ~300 lines should be split by responsibility.
- All listeners and intervals must use `this.registerEvent` / `this.registerInterval` / `this.registerDomEvent` so they are cleaned up on unload.
- Command IDs are stable API — never rename after release. So is `manifest.json`'s `id`: changing it breaks every existing install, since both the vault folder name and the community-plugins registry key off it.
- Network calls must remain opt-graceful: always have an offline fallback, and never fetch without an explicit user action. No new network calls without disclosure in the README's *Network usage and privacy* section. **One deliberate exception, and it is meant to stay the only one: the UI translation** (`i18n/LocaleStore.ts`), fetched in the background when the language the user already reads is not on disk. Shipping all 32 locales was what made `main.js` 3.70 MiB, and a button would have to be pressed in a language the user cannot read. It stays defensible only because every other property holds — English is bundled so the failure mode is an untranslated UI rather than a broken one, nothing is requested when the file is present, and it is disclosed in the README. Never execute remote code or eval a fetched script; read/write only what's necessary inside the vault, never files outside it.
- `isDesktopOnly` is `false` (`manifest.json`) — avoid Node/Electron-only APIs. The startup CSS-snapshot cache (see README's *What is stored locally*) exists specifically to soften slow mobile launches.
- TypeScript strict mode is enforced. No `any` without explicit ESLint disable comment.
- UI copy: sentence case for headings/buttons; **bold** for UI labels; arrow notation (`Settings → Hotkeys`) for navigation.

## References

- Obsidian API docs: https://docs.obsidian.md
- Developer policies: https://docs.obsidian.md/Developer+policies
- Plugin guidelines: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
- Manifest validation rules (canonical): https://github.com/obsidianmd/obsidian-releases/blob/master/.github/workflows/validate-plugin-entry.yml

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
