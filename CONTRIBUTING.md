# Contributing to Callout Studio

Thank you so much for taking an interest in this project! This is a one-person plugin developed and maintained in my spare time, but I do my absolute best to respond to and handle every issue, suggestion, and pull request as quickly as possible.

Contributions of any kind and size are warmly welcomed - whether you found a bug, want to fix a translation, or have an idea for a new feature. You don't need to be an expert developer to get involved; simple feedback and bug reports are just as valuable to me as code contributions!

I am always looking for ways to expand and improve the plugin. At the same time, I want to keep it clean and easy to use without overloading it with too many features. Finding the right balance is key! Because of this, I apologize in advance if a specific feature suggestion doesn't end up making it into the plugin - but I would still love to chat, hear your thoughts, and read your feedback either way.

Every piece of feedback, bug report, or pull request is a wonderful gift to this project. As a small token of my gratitude for taking your time to help improve it, I would be honored to add your name to my [💖 Special Thanks](https://github.com/Niv20/obsidian-plugin-callout-studio#-special-thanks) list!

## Setup

```bash
npm install
npm run dev     # watch build, esbuild with inline sourcemaps
```

You'll need a current Node LTS.

```bash
npm test        # every tests/*.test.ts, bundled by esbuild and run by node:test
```

The suite covers the pure utilities, the registry, the CSS it generates, both editor surfaces, the public API and the repo's own rules. It runs in CI on every push and PR, so a failure there is a failure here. `tsconfig.json` includes `tests/` as well as `src/`, so `npm run build` typechecks the suites too — a test that no longer compiles fails the build.

What it deliberately cannot see is Obsidian: the DOM is a stand-in (`tests/support/fakeDom.ts`) and the `obsidian` module is a stub (`tests/support/obsidianStub.ts`). So anything that has to *look* right is still checked by hand — build, copy `main.js`, `manifest.json`, and `styles.css` into `<Vault>/.obsidian/plugins/callout-studio/`, and reload Obsidian.

## Reporting a bug

Open an issue with:
- Steps to reproduce
- What you expected vs. what actually happened
- The plugin version from `manifest.json`, and your Obsidian version if it might matter
- A screenshot for anything visual — callouts are visual, so this saves a lot of back-and-forth

## Suggesting a feature

Describe the problem you're trying to solve rather than a finished spec. There's often already a mechanism (transforms, aliases, the public API) that covers it, or a reason something was left out on purpose.

## Submitting a change

1. Fork the repo, branch off `master` (`feature/short-description` or `fix/short-description`).
2. Make your change. [`internals-docs/00-index.md`](internals-docs/00-index.md) is the architecture reference — read [03-plugin-lifecycle.md](internals-docs/03-plugin-lifecycle.md) and [06-css-generation.md](internals-docs/06-css-generation.md) for the registry → CSS injector → re-render loop before touching anything under `src/manager/`; a couple of real bugs here have come from missing one of those steps. It also has step-by-step checklists for adding a setting/command/callout field/icon source ([19-extending.md](internals-docs/19-extending.md)). [CLAUDE.md](CLAUDE.md) is just the short entry point that links here.
3. Run `npm run lint`, `npm run build` and `npm test` before pushing. CI runs the same three commands on every push and PR, so anything that fails locally will fail there too. A `todo` entry in a suite is a known bug someone wrote down, not a test that's allowed to stay red.
4. Add or extend a test where the change is testable without Obsidian — that's the first place a change is proved. Then check it in Obsidian too (see Setup above), and say how you tested it in the PR description; for anything visual that's the only signal a reviewer has.

Keep PRs to one change. A fix bundled with an unrelated refactor just makes both harder to review. A husky pre-commit hook also lints staged files automatically, so most style issues get caught before you even push.

## Code conventions

Full list in [CLAUDE.md](CLAUDE.md). The ones that bite most often:
- Strict TypeScript — no `any` without an ESLint-disable comment explaining why.
- Split files once they pass ~300 lines.
- Listeners and intervals go through `this.registerEvent` / `registerInterval` / `registerDomEvent`, not raw `addEventListener` or `setInterval`, so they don't leak past plugin unload.
- Command IDs don't change once released — they're part of the public surface.
- User-facing text goes through `t()`, with the key added to `src/i18n/en.ts`.

## Localization

The UI ships in 32 languages. English is the canonical, hand-written source — every other file under `src/i18n/` was machine-translated and almost certainly has rough edges somewhere. If you speak one of the supported languages, fixing a wrong or awkward string in its file (e.g. `fr.ts`) is a genuinely useful, low-effort PR — no code required. You don't need to translate a new string into the other 31 languages when you add it; `en.ts` is the fallback for anything missing elsewhere.

## Commit messages

Most of the history loosely follows `feat:` / `fix:` / `chore:` prefixes. Match that if it's natural, but a plain, clear sentence works too.

## Versioning

Don't bump `manifest.json`, `package.json`, or `versions.json` in a feature or fix PR — releases are cut separately by the maintainer (`npm version <bump>` syncs all three, and tags are bare semver like `1.5.0`, no `v` prefix). Pushing such a tag is all it takes: GitHub Actions builds the plugin and publishes the release. If your PR is specifically about a release, say so in the description.

## License

A permissive [license](LICENSE) — free to use, copy, modify, and distribute, with no conditions attached. By submitting a change you agree it's licensed under the same terms.

There is one informal ask, and it is not a license term: please don't repackage this code and publish it as a new plugin in Obsidian's Community Plugins directory. Reuse it, learn from it, build on it — just not that.
