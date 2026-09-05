# Architecture

## Component map

```text
main.ts (CalloutStudioPlugin) — lifecycle and wiring only
├── CalloutRegistry           — single source of truth: Map<id, CalloutDefinition> + PluginSettings
├── CSSInjector                — reads the registry, writes generated CSS + paints icon DOM
├── ManualCalloutDiscovery      — one explicit additive scan; no watchers or pruning
├── IconService                  — icon artwork: fetch, cache, disk storage
│   ├── IconFetchManager          (Material's per-icon fetches)
│   └── PackDataStore             (whole-pack downloads, SHA-256 verified)
├── CustomCommandManager        — syncs settings.customCommands ↔ registered Obsidian commands
├── OutlineDecorator             — cleans heading-callout titles in the Outline pane
├── LinkSuggestDecorator         — cleans them in the [[ link popup
├── LocaleStore                  — downloads/caches non-English UI translations
├── CalloutStudioAPI            — read-only public surface at `plugin.api`
│
├── editor/                     — markdown-side integrations
│   ├── AutoComplete              (EditorSuggest on `[!`)
│   ├── CalloutBlockTools         (wrap/unwrap/insert)
│   ├── calloutTokens              (the token grammar — parses everything)
│   ├── calloutWriter               (the only place a definition becomes markdown)
│   ├── commands.ts                (5 fixed commands)
│   ├── contextmenu/                (right-click menu)
│   └── livepreview/                 (CodeMirror ViewPlugin + StateField rendering)
│
├── reading/                     — Reading-view post-processors (heading/inline roles, gradient text)
├── outline/                      — OutlineDecorator implementation
├── icons/                        — icon pack registry, per-source implementations, resolver, renderer
├── settings/                     — the settings tab, all modals, the callout editor, the icon picker
├── utils/                        — pure helpers: colour math, id normalization, import validation, …
└── api/                           — public API types and implementation
```

`src/main.ts` is deliberately thin: lifecycle and wiring only, per the project's
own coding convention ("Keep `src/main.ts` minimal"). Every file over ~300 lines
is expected to be split by responsibility — this is enforced by
`tests/repoSourceRules.test.ts`'s "no new oversized files" check, which freezes a
list of pre-existing exceptions (`CalloutRegistry.ts`, `CSSInjector.ts`,
`CalloutEditor.ts`, the i18n locale files, `emojiData.ts`, …) and fails if a file
outside that list crosses 300 lines, or if a frozen exception grows further.

## Who owns state, who operates on it

Only a handful of classes actually **own** state:

| Owner | State | Persisted? |
| --- | --- | --- |
| `CalloutRegistry` | `Map<id, CalloutDefinition>`, `PluginSettings`, `iconSvgCache` | Yes, via `toSaveData()` → `data.json` |
| `ManualCalloutDiscovery` | one in-flight manual scan | No — only its successfully saved definitions persist |
| `CSSInjector` | the adopted stylesheet, the `<style>` element, `lastCssText` | No (but mirrors to `StartupStyleCache` → localStorage) |
| `IconService` / `PackDataStore` | in-flight fetches, failure flags | Artwork lands in the registry's `iconSvgCache` (persisted); pack files live on disk under `icon-packs/` |
| `LocaleStore` | per-locale load state, in-flight downloads | Locale files live on disk under `translations/`; the *table* is registered into `i18n/index.ts`'s module-level map (runtime only) |
| `CustomCommandManager` | nothing of its own — re-derives from `settings.customCommands` on every registry change | `settings.customCommands` is persisted by the registry |

Everything else — `renderShared.ts`, the icon renderer, the settings sections,
the modals — **reads** the registry and **calls its mutators**; none of it holds
authoritative state of its own. This matters for a simple reason: if you find
yourself caching a `CalloutDefinition` anywhere outside the registry's map, you
are one edit away from it going stale. The public API guards against exactly this
(see [Public API](18-public-api.md)) by handing out frozen copies rather than
live references.

## The data-flow loop

This is the loop the whole plugin is built around, and it's worth memorizing
because almost every bug report traces back to a step being skipped:

```text
Something mutates the registry
        │  (registry.add/update/remove/batch(...), or a preview via setPreviewDefinition)
        ▼
registry.onChange fires (coalesced — see CalloutRegistry.batch)
        │
        ├──► CSSInjector.inject()            — regenerates CSS, swaps the stylesheet
        │        │  (only if the text actually changed — see "Coalescing" below)
        │        ├──► paintIcons()            — repaints DOM icons in every open window
        │        ├──► refreshAllCalloutEditors() — asks CodeMirror to rebuild its widgets
        │        └──► workspace.trigger("css-change") — forces every open editor/reading view to re-render
        │
        ├──► OutlineDecorator.refreshAll()    — repaints outline items
        └──► plugin.saveSettings()             — writes data.json
```

`main.ts` wires exactly two `registry.onChange` listeners (see
[Plugin lifecycle](03-plugin-lifecycle.md)): one for `customCommands.syncAll()`,
one that does the inject + outline-refresh + save. Order matters — the command
sync is subscribed first, so a delete's command pruning is folded into the same
settings snapshot the save writes, rather than racing it.

> [!IMPORTANT]
> **`onChange` carries no payload.** Every listener re-derives what it needs from
> current registry state rather than being told what changed. This is deliberate
> — an id rename is really `remove()` followed by `add()`, so no listener could
> tell a rename from a delete-then-create anyway. `CustomCommandManager.syncAll()`
> is designed entirely around this: it recomputes the whole desired command set
> from scratch every time, which is what makes it converge correctly regardless
> of *how* the registry changed. See [Editor integrations](09-editor-integrations.md).

### Coalescing: why a single edit is not four full passes

A single `onChange` round is expensive — full stylesheet regeneration, every
open document's icons repainted, every CodeMirror editor's widgets refreshed, a
`data.json` write, and (if the CSS actually moved) a `css-change` event that
makes Obsidian core rebuild every open editor's cache. Three mechanisms exist
purely to keep that cost tied to real work:

1. **`CalloutRegistry.batch(fn)`** coalesces multiple mutations inside `fn` into
   at most one `onChange` at the end (none at all if nothing actually changed).
   Used for the rename pair (`remove` + `add`), for palette cascades, for
   multi-row imports, and for the fallback-mirroring pass.
2. **`CSSInjector.inject()` short-circuits on byte-identical output.** The
   generated CSS text is compared against `lastCssText`; if nothing moved, the
   stylesheet swap, the `localStorage` snapshot write, and the `css-change`
   trigger are all skipped. Icon painting and the CodeMirror widget refresh
   still run, because artwork can land (a download completing) while the
   generated *text* stays identical.
3. **`main.ts` has no separate debounced inject.** An earlier version scheduled
   a debounced `inject()` *and* let the `css-change` trigger re-enter the same
   listener — which ran the whole pass twice per mutation. `inject()` now emits
   `css-change` itself, once, only when text actually changed; there is no
   second path.

See [CSS generation](06-css-generation.md) for the injector's internals and
[Callout registry](05-callout-registry.md) for `batch()`.

## Two id spaces for icons

A second architecture worth knowing before touching icon code: `IconSourceId`
(8 members — one row in the picker's source menu) and `IconPackId` (11 members
— one body of downloaded/cached artwork) are deliberately different types, kept
apart in [`src/icons/registry.ts`](../src/icons/registry.ts). They coincide for
every library except Font Awesome (one source, three files: solid/regular/brands)
and Tabler (one source, two files: outline/filled). Cache keys and pack-store
calls always use `icon.type` (an `IconPackId`) — using the source id would
collapse both Font Awesome styles onto one cache entry. Full treatment in
[Icons](12-icons.md).

---
Next chapter: [03-plugin-lifecycle.md](03-plugin-lifecycle.md)
