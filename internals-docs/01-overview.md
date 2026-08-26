# Overview and terminology

Callout Studio is an Obsidian plugin for creating, restyling and managing callout
types. It bundles `src/main.ts` into `main.js` with esbuild and ships three
release artifacts: `main.js`, `manifest.json` and `styles.css`.

The plugin id is `callout-studio`. That string is the vault folder name and the
community-plugin registry key, so it can never change — `tests/repoRelease.test.ts`
pins it.

## What the plugin actually does

Obsidian has 13 built-in callout types and no UI for changing them. Callout
Studio adds:

- A **registry** of callout definitions — the 13 built-ins plus anything the user
  creates, imports, or the plugin discovers in the vault.
- **Generated CSS** derived from that registry, injected at runtime, that restyles
  Obsidian's own block callouts.
- **Two render roles Obsidian does not have** — heading callouts and inline
  callouts — which the plugin parses and renders itself in both Live Preview and
  Reading view.
- Editor affordances built on top: autocomplete, a right-click menu, commands,
  vault-wide replace/convert, import/export.

## The three render roles

One `CalloutDefinition` can be written in three places, and each place is a
**render role** (`CalloutRenderRole` in [`src/types.ts`](../src/types.ts)):

| Role | Markdown | Who renders it |
| --- | --- | --- |
| `regular` (block callout) | `> [!note] Title` | **Obsidian.** The plugin only supplies CSS. |
| `heading` (heading callout) | `## [!note] Title` | The plugin, in Live Preview and Reading view. |
| `inline` (inline callout) | `text [!note] text` | The plugin, in Live Preview and Reading view. |

This split is the single most load-bearing distinction in the codebase, and it
explains a lot of otherwise surprising behaviour:

- The block role's DOM belongs to Obsidian. The plugin styles it through
  `.callout[data-callout="…"]` selectors and repaints its icon, but it never
  builds the box.
- The heading and inline roles are the plugin's own invented syntax. Nothing else
  in the ecosystem understands them, so when a callout is handed to the theme
  (see **Theme style** below) those two roles render **nothing at all** — the
  `[!id]` stays as literal text, because there is no external styling for them to
  fall back to.
- The CSS snippet export only carries the block role, for the same reason: a
  stylesheet can style an element, but it cannot create one.

The roles also matter to icon artwork: a pack may draw the same icon differently
per role (Octicons ships 16px and 24px drawings), so the icon cache is keyed per
role. See [Icons](12-icons.md).

> [!NOTE]
> `CALLOUT_RENDER_ROLES` (in `src/types.ts`) exists specifically so code that has
> to consider all three at once cannot silently handle only the block callout.
> The icon-cache sweep is the main consumer.

## Vocabulary used throughout this guide

These are the project's own terms, taken from the source, the UI strings, the
README and the video scripts. Use them; don't invent synonyms.

| Term | Meaning |
| --- | --- |
| **Callout definition** | One row in the registry — `CalloutDefinition`. The unit the user edits. |
| **Callout ID** | The token you type: `note` in `> [!note]`. May contain spaces. |
| **Alias** | An alternative ID resolving to the same definition (`tldr` → `abstract`). |
| **Built-in** | One of the 13 types Obsidian ships. `builtIn: true`, `source: "builtin"`. |
| **Fallback row** | A row auto-created by discovery for an ID found in the vault. `source: "fallback"`. |
| **Default fallback callout** | The definition unknown IDs are styled from — `settings.fallbackCalloutId`. |
| **Customized** | `customized: true` — the user explicitly created or edited this row. Makes it sticky against pruning. |
| **Theme-owned** | The active theme names this callout's id, so the theme paints it and the plugin emits nothing aimed at `.callout`. Derived from the theme's stylesheet, never stored — see `manager/theme/ThemeFacts.ts`. |
| **External CSS** | The user styles this one in their own snippet. Persisted as `externalStyle: true`, and the only styling choice still theirs to make. |
| **Callout Studio style** | The plugin owns every property it supports, with `!important` at a weight derived from the active theme. Not persisted — it is what applies whenever neither of the two above does. |
| **Render role** | `regular` / `heading` / `inline`, as above. |
| **Icon source** | A library as the user meets it — one row in the picker's source menu (`IconSourceId`, 8 of them). |
| **Icon pack** | One body of artwork — one downloaded file, one cache key (`IconPackId`, 11 of them). |
| **Custom palette** | A user-saved colour set (`CustomPalette`), baked onto callouts when applied. |
| **Custom command** | A command the user built for one callout + role (`CustomCommand`). |
| **Your images** | The `image` icon source: pictures the user uploaded, stored in settings. |

Two terms that appear in older material and mean something else now:

- **"Popup"** — the pre-1.2.2 name for the context menu. It survives only in
  `LegacyPopupSettings` and in the settings-merge migration.
- **"Startup CSS snippet"** — versions ≤ 2.5.0 wrote an auto-enabled snippet into
  the vault. That is gone; `legacyStartupSnippet.ts` deletes leftovers. The
  *user-initiated* CSS snippet export is a different, current feature.

## Callout IDs, metadata and the pipe

Obsidian splits a callout header at the **first `|`**: everything before it is the
type, everything after is `data-callout-metadata`. So `> [!note|purple]` is the
`note` callout carrying the metadata `purple` — not a callout named `note|purple`.

Every path that turns raw markdown into an ID funnels through
`normalizeCalloutId` / `splitCalloutMetadata` in
[`src/utils/calloutId.ts`](../src/utils/calloutId.ts), which is what makes a piped
ID structurally unreachable by the registry. Full treatment in
[Callout IDs and normalization](04-data-model.md#callout-ids-and-the-three-normalizers).

---
Next chapter: [02-architecture.md](02-architecture.md)
