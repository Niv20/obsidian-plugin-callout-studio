---
name: ci-quality-gates
description: >-
    Diagnose and harden Callout Studio's local-to-CI verification path. Use
    when GitHub Actions reports a generic failure or exit code 1, when changing
    npm verification scripts or Husky hooks, when adding a pre-push gate, or
    when configuring PR checks and protection for master. Release versioning
    and publishing remain the release skill's responsibility.
---

# CI quality gates

Keep local verification and GitHub Actions equivalent enough that a push does
not discover a failure that could have been caught beforehand.

Before changing this path, read
[`docs/internals-docs/20-build-test-release.md`](../../../docs/internals-docs/20-build-test-release.md)
and the relevant workflow under [`.github/workflows/`](../../../.github/workflows/).
The workflow is the source of truth if prose or a hook disagrees with it.

## Diagnose a red run

`Process completed with exit code 1` is only the runner's summary. Identify the
first failing workflow step and its assertion or command output before proposing
a fix.

Reproduce the **pushed commit**, not an unrelated dirty working tree. Preserve
the user's uncommitted work; use a clean worktree, archive, or other isolated
snapshot when local changes would alter the result. Report separately which
gates passed and which failed.

For the normal push workflow, local parity is:

```bash
npm run build
git diff --exit-code -- locales src/i18n/localeManifest.ts
npm run lint
npm test
```

The generated-locale diff is a real gate, not bookkeeping: `build` runs
`i18n:generate`, and a resulting diff means the source translations and shipped
downloads/checksums were not committed together. CI repeats the sequence on
Node 20 and Node 22, so keep version-dependent failures in mind even when one
local Node version passes.

## Harden the path before push

When the user asks to prevent red pushes, prefer these mutually reinforcing
layers:

1. Add one repository script such as `npm run check` that mirrors the push
   workflow's build → generated-locale diff → lint → test order. Inspect the
   workflow when adding or changing it; do not let the convenience script
   become a second, weaker definition of success.
2. Add a Husky `pre-push` hook that invokes that single script. Keep the existing
   `pre-commit` hook fast and focused on staged lint. A staged-only lint hook
   cannot catch failing assertions, generated-file drift, or type errors in
   untouched tests.
3. Be explicit that an ordinary pre-push hook tests the current working tree,
   not necessarily the exact commits being pushed. Either require a clean tree
   or run verification in an isolated snapshot; never claim commit-level
   coverage while uncommitted changes are influencing the result.
4. Use feature branches and pull requests for changes destined for `master`.
   Configure `master` protection to require the repository's Actions status
   checks before merge and disallow bypasses where appropriate. Branch
   protection is external repository state: inspect the current settings and
   obtain the user's authorization before changing it.

Do not treat hooks as security boundaries: they can be skipped. Required remote
checks are what keep a failing commit from merging; local hooks shorten the
feedback loop.

## Handoff

After changing a script, hook, or workflow, run the resulting local gate and
verify that its commands and order still match the workflow. Name the exact
failed step if verification is not green; never summarize a generic exit code
as the cause.
