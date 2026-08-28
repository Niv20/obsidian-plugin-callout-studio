# Build, test, and release

## npm scripts

```bash
npm run dev       # i18n:generate, then esbuild watch mode (inline sourcemaps)
npm run build      # i18n:generate (prebuild), tsc -noEmit -skipLibCheck, then esbuild production (minified)
npm run lint       # eslint . (obsidianmd recommended config + project rules)
npm test           # scripts/run-tests.mjs
npm run icons:generate    # regenerate icon pack search indexes + manifest — NEVER auto-run
npm run i18n:generate      # regenerate locales/*.json + localeManifest.ts — runs as `prebuild`
```

> [!IMPORTANT]
> **`repo-is-live-plugin-folder`**: this repository *is* the plugin's
> installed folder inside the vault (`.obsidian/plugins/obsidian-Plugin-Callout-Studio`).
> `npm run build`/`dev` write `main.js` straight into place — there is no
> separate "install" or copy step. When a fix "doesn't seem to work" after a
> rebuild, check `main.js`'s modification time and check for a duplicate
> plugin folder with the same id before assuming the code is wrong.

## Build (`esbuild.config.mjs`)

```js
entryPoints: ["src/main.ts"]
bundle: true
external: ["obsidian", "electron", "@codemirror/*", "@lezer/*", ...builtinModules]
format: "cjs"
target: "es2018"
outfile: "main.js"
minify: prod
sourcemap: prod ? false : "inline"
```

Obsidian and CodeMirror packages are externals — the app itself supplies
them at runtime, so bundling them would both bloat `main.js` and risk a
duplicate/mismatched CodeMirror instance. Production builds strip
sourcemaps entirely (dev builds inline them for fast iteration).

## TypeScript config

```json
{ "target": "ES6", "moduleResolution": "bundler", "strictNullChecks": true,
  "noUncheckedIndexedAccess": true, "include": ["src/**/*.ts", "tests/**/*.ts"] }
```

> [!IMPORTANT]
> **`tests/` is included in the same typecheck as `src/`.** `npm run
> build`'s `tsc -noEmit` gate checks both trees together — a test suite that
> no longer compiles fails the *build*, not just `npm test`. This is
> deliberate: the suites assert against real production signatures, and one
> that's drifted off them is worth stopping the build for.
>
> **`target: ES6` rules out top-level `await` in a test file** — a dynamic
> import has to be awaited *inside* a test body instead.
> `tests/repoTestGate.test.ts` holds both of these rules to account
> mechanically (see below).

## Test runner (`scripts/run-tests.mjs`)

`npm test` **bundles** every `tests/*.test.ts` with esbuild into `.test-out/`
before handing the result to Node's built-in test runner — it does not run
the TypeScript source directly. Two reasons, both structural:

1. `tsconfig.json` uses `moduleResolution: "bundler"`, so the whole codebase
   imports without file extensions (`../utils/calloutId`). Node's own ESM
   resolver requires them, and the flag that used to relax that requirement
   was removed in Node 20.
2. Several modules under test transitively import `obsidian`, which only
   exists inside the running app. esbuild's `alias` config swaps in
   [`tests/support/obsidianStub.ts`](../tests/support/obsidianStub.ts)
   instead — a minimal, hand-maintained stand-in kept in `tests/` rather than
   inlined, specifically because it needs to import `@codemirror/state` for
   `editorLivePreviewField` to be a real `StateField`.

Test files are named **explicitly**, not discovered via `--test <dir>` or a
glob — Node's test walker silently skips dot-prefixed directories
(`.test-out`) and then mistakes the directory itself for a single test file;
glob arguments to `node --test` only arrived in Node 22, while CI also runs
20. Naming every bundled file avoids all three failure modes at once.

## What the test harness can and cannot see

`tests/support/fakeDom.ts` and `tests/support/obsidianStub.ts` stand in for
the DOM and the `obsidian` module respectively. This is explicitly the
boundary of the automated test suite — anything that has to *look* right
(actual rendering, real theme interaction, real Obsidian internals like
`app.hotkeyManager` or `app.customCss`) is **not** covered and must be
verified by hand: copy `main.js`, `manifest.json`, `styles.css` into
`<Vault>/.obsidian/plugins/callout-studio/` and reload Obsidian. `npm test`
is a gate, not a substitute for that — it covers the pure utilities, the
registry, the CSS it generates, both editor surfaces, the public API, and
the repo's own conventions (below).

## Repo-convention tests — the automated rules that hold the codebase together

Several test files check the **repository itself**, not runtime behaviour —
these are the project's coding conventions turned into assertions rather
than left as unenforced prose in `CLAUDE.md`. Notable ones, by what they
check (not exhaustive — see each file directly for the full list):

| File | Enforces |
| --- | --- |
| `repoSourceRules.test.ts` | No bare English UI-copy literal handed to a text setter or `Notice`; every `workspace`/`vault`/`metadataCache` listener is `registerEvent`'d or `offref`'d; nothing listens on `document`/`window` without an unregister; no interval outside `registerInterval`; no `any` without an explicit ESLint-disable; `main.ts` stays lifecycle-only; the network surface is exactly what the README discloses; **no file outside a frozen exception list crosses 300 lines** (and no exception grows further) |
| `repoStyles.test.ts` | Every CSS custom property read with a fallback has a writer somewhere in `src/`; every class the code applies has a matching rule in `styles.css` and vice versa; no rule scoped to `.cs-modal` paints a raw `--background-primary` (see [Settings UI § surface tokens](15-settings-ui-and-modals.md)) |
| `repoGenerated.test.ts` | `locales/*.json` and `src/icons/data/*` regenerate **byte-for-byte** identical to what's committed |
| `repoRelease.test.ts` | `manifest.json`/`package.json`/`versions.json` agree on one version; the plugin id can never change; `manifest.json` has every required field and no unknown ones; the five fixed command ids match what's actually registered; bundle-size limit is still declared where CI reads it |
| `repoTestGate.test.ts` | `tsconfig.json` includes `tests/`; the build actually runs that typecheck; no test file uses top-level `await`; test setup/teardown hooks run in the right order |
| `repoLicenseDocs.test.ts` | `LICENSE` is the plain 0BSD grant with no conditions attached; README/CONTRIBUTING both state the "don't republish as a new plugin" ask is *not* a license term |
| `repoTestGate.test.ts` ("CLAUDE.md describes the checks that exist") | `CLAUDE.md` doesn't claim the repo is untested, lists `npm test`, and still describes what the suite structurally cannot see |

> [!TIP]
> `npm run test`'s output is the single source of truth for whether a
> proposed change violates one of these conventions — don't try to
> re-derive "is this file over 300 lines" or "is this listener registered
> correctly" by inspection when the corresponding repo test will simply tell
> you.

## Regenerating icon and locale data

Both are code-generation steps with **opposite** automation policies, and
mixing them up is a real trap:

- **`npm run i18n:generate` is automatic** (`prebuild`), fast (local, no
  network, sub-second), and CI-enforced on every push (`git diff --exit-code`
  against `locales/` and `localeManifest.ts`).
- **`npm run icons:generate` is deliberately manual and never runs as part of
  `npm run build`.** It reads from `node_modules` (Tabler, Font Awesome,
  Octicons, RPG Awesome packages, plus generated Material/emoji data) and
  writes both the search-index files (`src/icons/data/*.index.ts`, committed
  and bundled into `main.js`) and the downloadable pack files
  (`packs/*.json`, committed — **this repo is the CDN origin** for those
  files, served via jsDelivr at the pinned `packs-v2` tag). Regenerating
  artwork content (not just the search index) requires **minting a new
  pinned tag** and updating the checksums in
  `src/icons/data/packManifest.ts` — jsDelivr caches a tag's contents
  permanently, so re-pushing to the *same* tag would not actually refresh
  anything a user's cached copy sees. See
  [Adding or modifying features](19-extending.md#refreshing-icon-pack-artwork).

## CI

Three workflows, `.github/workflows/`:

### `lint.yml` — every push, every branch, Node 20.x and 22.x

```text
npm ci → npm run build → verify locales/ has no diff → npm run lint → npm test
```

The locale-sync check runs **right after the build** (which already ran
`i18n:generate` as `prebuild`) — its whole purpose is catching a translation
edited without the regenerated output committed alongside it, which would
otherwise fail every download's checksum for the next release, discovered
only in users' vaults instead of here.

### `obsidian-lint.yml` — weekly (Mondays 06:00 UTC) and on demand

```text
npm ci → npm install --no-save eslint-plugin-obsidianmd@latest → npm run lint -- --max-warnings 0
```

`lint.yml` pins `eslint-plugin-obsidianmd` through the lockfile, so it only
re-checks when our own code changes. The Obsidian community-plugin scanner
runs whatever version of that plugin is current. This job re-runs the lint
against the **latest published ruleset** so a newly added rule surfaces
here instead of at the next submission — the same drift that forced the
`0.3.0 → 0.4.1` bump. `--max-warnings 0` so a rule that ships as a warning
still fails the run. `--no-save` keeps the bump out of `package.json` /
the lockfile; a real bump comes through the Dependabot PR below.

`.github/dependabot.yml` also watches `eslint-plugin-obsidianmd` (weekly)
and opens a PR on each new release, which `lint.yml` then runs against.

### `release.yml` — triggered by pushing a bare-semver tag (`[0-9]+.[0-9]+.[0-9]+`, no `v`)

```text
1. Verify manifest.json / package.json / versions.json all agree with the pushed tag exactly
2. npm ci, npm run build
3. Re-verify locales/ has no diff (same reasoning as lint.yml, but against the release build)
4. Check main.js is under the 2 MiB bundle-size budget
5. Attest build provenance for main.js and styles.css
6. Wait (poll, up to 15×2s) for the tag to be visible via the GitHub API
   — the tag-push webhook can fire before the tag itself propagates
7. Create a DRAFT GitHub release carrying main.js, styles.css, manifest.json
```

> [!CAUTION]
> **Step 1 is a hard gate**: Obsidian's own community-plugin update
> mechanism requires the release tag to equal `manifest.json`'s version
> **exactly** (no leading `v`), or the release ships a version Obsidian
> can't correctly resolve as an update.

> [!NOTE]
> **The bundle-size budget (2 MiB) is deliberately tight against the current
> size**, not generously padded — "a careless import trips it here rather
> than in users' vaults; raise it consciously when a feature earns it." The
> ceiling's own history is documented right in the workflow file: it moved
> from 3 MiB (added for Tabler's search indexes) up to 4 MiB (custom
> commands, Callout Manager import, Palette Editor work), then back **down**
> to 2 MiB the moment the 31 non-English locales moved out of the bundle
> entirely and became downloads — which alone took `main.js` from 3.70 MiB
> to 1.70 MiB.

> [!NOTE]
> **The release is created as a `draft`, on purpose.** The `/release` skill
> (`.claude/skills/release/SKILL.md`) is what writes the user-facing release
> notes and flips it public — a workflow failure partway through therefore
> leaves a harmless draft rather than a half-published, half-broken public
> release.

## Versioning

Bumping `manifest.json`/`package.json`/`versions.json` happens together, via
`npm version <bump>` (wired through `version-bump.mjs`, which reads the new
`npm_package_version` and syncs `manifest.json` and appends an entry to
`versions.json` keyed to the *current* `manifest.json`'s `minAppVersion`).

> [!IMPORTANT]
> **Never bump or tag by hand, and never do it inside a feature/fix PR.**
> Both `CLAUDE.md` and `CONTRIBUTING.md` say releases are cut separately —
> use the `/release` skill, which bumps all four version-bearing files
> together, tags, pushes, waits for the CI build, writes release notes, and
> publishes. Tags are bare semver (`1.5.0`), never `v1.5.0`.

## Husky / pre-commit

A single pre-commit hook (`.husky/pre-commit: npx nano-staged`) runs ESLint
against staged `*.ts`/`*.mts` files only — most style issues are caught
before a push ever reaches CI.

---
Next chapter: [18-public-api.md](18-public-api.md)
