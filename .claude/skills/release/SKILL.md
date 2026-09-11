---
name: release
description: >-
    Cut and publish a new version of the Callout Studio plugin — bump the
    version files, tag, push, wait for the GitHub Actions build, write
    user-facing release notes, and publish the GitHub release. Triggers:
    "release", "cut a release", "ship a version", "new version", "publish
    version", "תשחרר גרסה", "גרסה חדשה", "תוציא גרסה", "לשחרר".
---

# Skill: Release a new plugin version

## Overview

One command, one approval, one published release.

Most of the work already happens in CI. `.github/workflows/release.yml` triggers on
any bare-semver tag push (`2.3.5`, never `v2.3.5`), builds the plugin, attests
`main.js` and `styles.css`, and creates a **draft** release named exactly after the
tag with `main.js` + `styles.css` + `manifest.json` attached.

This skill owns everything around that: deciding the version, syncing the four
version files in a single commit, pushing the tag onto that exact commit, watching
the run, and turning the draft into a published release with real release notes.

**The hard requirement:** the git tag, the GitHub release title, and
`manifest.json`'s `version` must all be the identical bare semver string. No `v`
prefix, ever. The workflow now fails loudly if they drift apart.

---

## Arguments

| Invocation | Meaning |
|---|---|
| `/release` | Infer the bump from the commits since the last tag |
| `/release patch` / `minor` / `major` | Force the bump level |
| `/release 2.4.0` | Use this exact version |
| `/release --dry-run` | Run steps 0–4 only. Nothing is committed, tagged, or pushed |

`--dry-run` combines with any of the above.

---

## Step 0 — Gather state

Run these first and keep the results; every later step reads from them.

```bash
git fetch origin --tags --prune
git rev-parse --abbrev-ref HEAD          # expect: master
git status --porcelain                   # expect: empty
git rev-list --left-right --count origin/master...HEAD   # expect: 0 <n>
git describe --tags --abbrev=0           # last released tag
jq -r .version manifest.json package.json
gh auth status
```

## Step 1 — Preflight gates

Every one of these is a hard stop. If a gate fails, report exactly which one and
what to do about it, then **end the turn** — do not attempt a workaround.

1. **Branch is `master`.** Releases are only cut from master.
2. **Working tree is clean.** No staged, unstaged, or untracked changes. Uncommitted
   work would silently not be in the release.
3. **Not behind `origin/master`.** The left number from the `rev-list` above must be
   `0`. Being behind means the release would drop someone else's commits.
4. **There is something to release.** At least one commit since the last tag.
5. **Version files are consistent.** `manifest.json`, `package.json`, and the newest
   key in `versions.json` all agree with each other right now. If they don't, a
   previous release was interrupted — say so and stop.
6. **The target tag does not exist**, locally or on the remote:
   ```bash
   git rev-parse -q --verify "refs/tags/$VERSION"        # must fail
   git ls-remote --exit-code --tags origin "$VERSION"    # must fail
   ```
7. **Lint and build pass locally:**
   ```bash
   npm run lint && npm run build
   ```
   This runs before anything is tagged. A failure here costs seconds; a failure
   after the tag is pushed means a red Actions run against a tag that already
   exists in the cloud.

## Step 2 — Decide the version

If the user gave an explicit version or bump level, use it. Otherwise infer from
the commit subjects since the last tag:

```bash
git log --format='%s%n%b' "$(git describe --tags --abbrev=0)"..HEAD
```

- Any `BREAKING CHANGE:` in a body, or a `!` before the colon (`feat!:`) → **major**
- Any `feat:` → **minor**
- Otherwise → **patch**

`chore:`/`docs:`/`style:`-only ranges still get a patch — but mention that the range
contains no user-visible changes so the user can cancel if they'd rather wait.

## Step 3 — Draft the release notes

Read the full subjects **and bodies** of the commits in the range. Rewrite them as
release notes aimed at plugin users, not at developers.

**House style — every release, no exceptions (standardized 2026-08-14 across all
past releases too; see git history of this file if you need the old, inconsistent
rule):**

- English, plain sentences. Past tense: "Fixed…", "Added…", "Improved…".
- No bold lead-in on list items. Just the sentence — "Fixed the icon picker
  losing its scroll position when reopened," not "**Icon picker:** Fixed …".
- **One change total** → a single plain sentence paragraph. No bullet, no header.
- **Several changes, all one kind** (all fixes, or all new things) → a `-` bullet
  list, one line per change, no header.
- **Several changes of more than one kind** → exactly two possible `##` headers,
  in this order, only the ones that have content:
  - `## What's new` — new features and improvements
  - `## Bug fixes` — fixes
  Each header's items are a `-` bullet list underneath it. Never invent other
  section names (no "Improvements", no emoji in headers, no per-feature bold
  sub-headers).
- Describe the **effect the user sees**, not the code that changed. `fix: renaming a
  callout only rewrote its blockquote usages` becomes "Fixed renaming a callout type
  so heading and inline callouts are updated too, instead of being left with a dead
  id."
- Drop conventional-commit prefixes, commit hashes, file paths, and internal
  symbol names.
- Collapse several commits that fix one user-facing problem into one line.
- Skip pure `chore:` noise (lockfile bumps, formatting) unless it's the whole release.
- Never add a "Full Changelog" line — GitHub already appends that to the draft
  automatically; a manual one duplicates it.

Write the result to a temp file — `notes=$(mktemp)` — and keep the path.

## Step 4 — The approval gate

Show the user, in one message:

- the resolved version number and the bump level
- the commit subjects included in the range
- the drafted release notes, verbatim

Then ask with `AskUserQuestion`: **publish** / **edit the notes** / **change the
version** / **cancel**. If they choose to edit, revise and ask again.

Nothing is committed, tagged, or pushed before this gate returns approval. If the
invocation was `--dry-run`, stop here and report what *would* have happened.

## Step 5 — Bump, commit, tag, push

```bash
npm version <patch|minor|major|X.Y.Z> \
  -m "chore: bump version numbers to %s in manifest, package, package-lock, and versions files"
```

That single command does all of it: the `version` lifecycle script runs
[version-bump.mjs](../../../scripts/version-bump.mjs), which writes `manifest.json` and adds
the `versions.json` entry; npm updates `package.json` and `package-lock.json`,
commits all four, and creates the tag **on that same commit**. `.npmrc` sets
`tag-version-prefix=""`, which is what keeps the tag bare.

The husky pre-commit hook runs `nano-staged`, which only matches `*.{ts,mts}` — a
no-op for this commit.

Then push the commit first and the tag second, so the tag never points at a commit
GitHub hasn't seen:

```bash
git push origin master
git push origin "$VERSION"
```

## Step 6 — Watch the build

The run takes a few seconds to appear. Poll for it, matching on the tag name
(`headBranch` is the tag for a tag push):

```bash
gh run list --workflow=release.yml --limit 10 \
  --json databaseId,headBranch,status \
  --jq ".[] | select(.headBranch == \"$VERSION\") | .databaseId"
```

Retry every few seconds for up to a minute. Once found:

```bash
gh run watch "$RUN_ID" --exit-status
```

If the run fails, print the failing step's log (`gh run view "$RUN_ID" --log-failed`),
report it, and **stop without publishing**. Then follow step 8.

## Step 7 — Publish and confirm

```bash
gh release edit "$VERSION" --notes-file "$notes" --draft=false --latest
gh release view "$VERSION" --json url,name,isDraft,assets \
  --jq '{url, name, isDraft, assets: [.assets[].name]}'
```

Confirm all four before reporting success:

- `name` equals `$VERSION` exactly
- `isDraft` is `false`
- assets are exactly `main.js`, `styles.css`, `manifest.json`
- `git show "$VERSION" --stat` shows the tag sitting on the bump commit

Report the release URL to the user.

## Step 8 — If something fails after the tag was pushed

Do not silently retry, and do not run any of these on your own. Show the user the
situation and the exact recovery commands, and ask before running them.

Tag pushed but the build failed, nothing published yet:

```bash
gh release delete "$VERSION" --yes --cleanup-tag   # removes draft + remote tag
git tag -d "$VERSION"                              # remove the local tag
git reset --hard HEAD~1                            # drop the bump commit
git push --force-with-lease origin master          # only if the bump was pushed
```

If the release was already **published**, do not delete it — users may have pulled
it. Cut a follow-up patch release instead.

---

## Notes

- Never create the tag by hand. `npm version` is what guarantees the tag and the
  version files land on the same commit — the drift that happened with `2.3.4`.
- Never add a `v` prefix. The workflow's tag filter (`[0-9]+.[0-9]+.[0-9]+`) simply
  won't fire for `v2.3.5`, and the push would look like it succeeded.
- `minAppVersion` lives in `manifest.json` and is copied into `versions.json`
  automatically. Only change it deliberately, in its own commit, before releasing.
