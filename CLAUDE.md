# CLAUDE.md

This file gives Claude Code, and other AI coding agents, the minimum orientation needed to work in this repository — it is a map, not the territory. For anything beyond the essentials below, follow the pointers to the real documentation; if it and this file ever disagree, the documentation wins.

Callout Studio is an Obsidian plugin for creating and managing custom callout types — icons, colors, and styles — with a settings UI, editor integrations, and a small read-only public API for other plugins. Its core loop is *mutate → CSS → repaint*: `CalloutRegistry` (`src/manager/`) is the single source of truth for callout definitions, `CSSInjector` reads it and writes one generated stylesheet, and everything else — settings UI, editor integrations, icon sources, discovery, import/export, theming — hangs off that registry and that stylesheet. It bundles `src/main.ts` → `main.js` via esbuild.

## Where the documentation lives

- **[`internals-docs/`](internals-docs/00-index.md)** is the authoritative source for architecture, internal behavior, data models, lifecycle, the CSS/theme system, icons, the public API, and everything else a programmer needs before changing source or preparing a PR. Start at [`00-index.md`](internals-docs/00-index.md) — it has a reading order and a full table of contents.
- **[`user-guide/`](user-guide/README.md)** is the authoritative source for user-visible behavior — features, settings, workflows, compatibility, limitations.
- A handful of narrow subsystems have their own `.claude/skills/` entry instead of an internals-docs chapter (Tabler's outline icons, the "Your images" source, callout colour nesting, the metadata-pipe id split) — see each skill's description for when it applies.

## Documentation maintenance

- Touch **`user-guide/`** when a change affects user-visible behavior, features, settings, workflows, compatibility, or limitations.
- Touch **`internals-docs/`** when a change affects architecture, internal behavior, data models, lifecycle, APIs, implementation details, migrations, or developer-facing integration guidance.
- Before treating a change as done, check both directories for pages it touches, update what's now wrong, and cut anything that's gone stale rather than leaving it to contradict the code.
- **Do not expand or routinely update `CLAUDE.md` when implementing changes.** Keep it short and stable. Update the relevant files in `internals-docs/` instead, and let `CLAUDE.md` point Claude to that directory. If a change affects users, update `user-guide/` as well. Only modify `CLAUDE.md` when its navigation, essential project-level instructions, or documentation paths themselves become inaccurate.

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

## Coding conventions

- Keep `src/main.ts` minimal — lifecycle and wiring only. All logic lives in sub-modules.
- Files over ~300 lines should be split by responsibility.
- All listeners and intervals must use `this.registerEvent` / `this.registerInterval` / `this.registerDomEvent` so they are cleaned up on unload.
- Command IDs are stable API — never rename after release. So is `manifest.json`'s `id`: changing it breaks every existing install, since both the vault folder name and the community-plugins registry key off it.
- Network calls must remain opt-graceful: always have an offline fallback, and never fetch without an explicit user action. No new network call without disclosure in the README's privacy section. The one existing exception — the background UI-translation fetch — is documented in [`internals-docs/16-i18n.md`](internals-docs/16-i18n.md). Never execute remote code or eval a fetched script; read/write only what's necessary inside the vault, never files outside it.
- `isDesktopOnly` is `false` (`manifest.json`) — avoid Node/Electron-only APIs.
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
