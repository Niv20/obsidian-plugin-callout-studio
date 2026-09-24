# Callout Studio internals

This is a from-the-source guide to how Callout Studio actually works
underneath — the mechanisms, the data flow, and the reasons a given piece of
code looks the way it does. It's written for two audiences and no others:
someone reading the source to understand a subsystem before changing it, and
someone preparing a pull request who needs to know every place a change has
to land together. It documents the repository as it actually exists today;
where something looked intentional but the reason wasn't provable from the
code, that's said explicitly rather than guessed at.

**This is not a how-to for using the plugin.** There's no "how to create your
own callout" or "how to pick a colour" here — [`user-guide/`](../user-guide/README.md)
already covers that ground for end users, and duplicating it here would just
give it a second place to go stale. If you're looking for that, start there
instead.

Two chapters also serve readers outside the core contributor audience.
[18-theme-callout-discovery.md](18-theme-callout-discovery.md) ends with a
compatibility section for **Obsidian theme authors**: which CSS patterns Callout
Studio reads correctly, which ones hide a theme's callouts from it, and how to
check a theme against it. [25-privacy-and-permissions.md](25-privacy-and-permissions.md)
is the complete privacy reference for anyone who needs to audit vault access,
network requests, downloaded assets, and local storage.

It complements, rather than replaces, two other documents already in the
repo:

- **[`API.md`](../API.md)** — the public plugin API contract for other
  Obsidian plugins. [21-public-api.md](21-public-api.md) explains how the
  implementation enforces what that document promises.
- **`AGENTS.md`** (repo root) — a short entry point for AI coding assistants:
  a one-paragraph project summary, essential project-level conventions, and
  pointers into this guide and into [`user-guide/`](../user-guide/README.md).
  It deliberately carries none of the architectural detail itself — this
  guide is that detail, and is the one to trust and to update.

## Reading order

There isn't one required order, but if you're new to the codebase, reading
**01 through 10 in sequence** gives you the whole mental model: what the
plugin is, how its pieces fit together, what happens when it loads, how data
is shaped and stored, and how a callout actually gets from a definition to
pixels on screen. After that, the remaining files are largely independent
and can be read in whatever order matches what you're touching.

## Core concepts — read in order

The mental model: what the plugin is, how its pieces fit together, and the
mutate → CSS → repaint loop everything else builds on.

| File | What it covers |
| --- | --- |
| [01-overview.md](01-overview.md) | What the plugin does, the three callout render roles, and the project's own vocabulary — read this first. |
| [02-architecture.md](02-architecture.md) | The component map, who owns state vs. who operates on it, and the core mutate → CSS → repaint data-flow loop. |
| [03-plugin-lifecycle.md](03-plugin-lifecycle.md) | `onload()` walked step by step in its real order, and `onunload()` cleanup. |
| [04-data-model.md](04-data-model.md) | Every persisted type (`CalloutDefinition`, `PluginSettings`, …) and the callout-id normalization rules. |
| [05-callout-registry.md](05-callout-registry.md) | The single source of truth: CRUD, load-time migrations, the built-in-deference mechanism, the live-preview slot. |
| [06-css-generation.md](06-css-generation.md) | How the registry becomes a stylesheet: the injector's two write targets, icon painting, theme ownership and selector escaping. |
| [07-persistence-and-caching.md](07-persistence-and-caching.md) | What is stored in `data.json`, device storage and vault caches; what is runtime-only; the startup CSS snapshot. |
| [08-settings-sync-and-recovery.md](08-settings-sync-and-recovery.md) | Saving and sync authorization, the recovery incident and repair, causal merges, verified writes, checkpoints and backups, recovery UI, provider differences, and edge cases. |
| [09-render-roles.md](09-render-roles.md) | The token grammar, and how heading/inline callouts render in Live Preview and Reading view. |
| [10-editor-integrations.md](10-editor-integrations.md) | Autocomplete, wrap/unwrap, built-in command registration and availability, custom commands, the right-click menu, Outline/link cleanup. |

## Subsystems — reference, as needed

Independent of each other and of reading order. Go straight to the one
covering whatever you're touching.

| File | What it covers |
| --- | --- |
| [11-vault-discovery.md](11-vault-discovery.md) | Manual discovery, durable results, statistics, replace-in-vault, and the delete flow. |
| [12-color-system.md](12-color-system.md) | The translucent-tint nesting invariant, palette derivation and baking, the Obsidian 1.13 colour-format split. |
| [13-icons.md](13-icons.md) | The icon-pack model, fetch/cache/verify pipeline, rendering, SVG sanitization, and "Your images." |
| [14-callout-editor.md](14-callout-editor.md) | The edit/create modal: the concrete-form-vs-optional-field tension, the live preview, validation, and save pipeline. |
| [15-import-export.md](15-import-export.md) | The JSON backup format and validator, the CSS-snippet export, and the Callout Manager / Admonition importers. |
| [16-settings-ui-and-modals.md](16-settings-ui-and-modals.md) | The settings tab's composition, the shared modal chrome and autofocus, and the individual modals. |
| [17-i18n.md](17-i18n.md) | How `t()` resolves strings, the locale download/verification pipeline, and the contribution workflow. |
| [18-theme-callout-discovery.md](18-theme-callout-discovery.md) | How the active theme's callout types are found, read back and represented — and the compatibility guide for **theme authors**. |
| [19-upgrading-manual-discovery.md](19-upgrading-manual-discovery.md) | Released 2.12.x compatibility, verified one-time recovery archives, and safe removal of legacy local discovery state. |

## Shipping a change

Build/release mechanics, the public API's implementation guarantees,
step-by-step extension checklists, and a concentrated list of traps this
codebase has already been bitten by once.

| File | What it covers |
| --- | --- |
| [20-build-test-release.md](20-build-test-release.md) | Build tooling, the test harness and what it can't see, CI, and the release process. |
| [21-public-api.md](21-public-api.md) | How the read-only public API is actually enforced — real privacy, frozen copies, the committed-state guarantee. |
| [22-extending.md](22-extending.md) | Step-by-step checklists for adding a setting, a command, a callout field, a menu item, an icon source, and more. |
| [23-common-pitfalls.md](23-common-pitfalls.md) | Concentrated warnings: state sync, id normalization, helpers that must always be used, mobile quirks, backward compatibility. |
| [24-logging-and-diagnostics.md](24-logging-and-diagnostics.md) | Every `console.debug`/`warn`/`error` call site, the policy behind which one and when to use a `Notice` instead, and why there's no centralized logger. |
| [25-privacy-and-permissions.md](25-privacy-and-permissions.md) | Vault access, network requests, downloaded assets, local storage, and the privacy boundaries around each one. |

Opening a PR? [`CONTRIBUTING.md`](../CONTRIBUTING.md) has the
process — fork, branch, lint, test, commit style. This guide is what to read
*before* that, so the change itself lands right the first time.

---
Next chapter: [01-overview.md](01-overview.md)
