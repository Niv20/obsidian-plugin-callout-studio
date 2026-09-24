---
name: localization-change-safety
description: >-
    Safely add, change, rename, translate, or retire Callout Studio UI strings
    and preview/sample copy. Use when touching src/i18n, generated locale JSON,
    localeManifest.ts, t() call sites, or locale-sensitive tests, especially
    when a translation changes a previously fixed English literal.
---

# Localization change safety

Read
[`docs/internals-docs/17-i18n.md`](../../../docs/internals-docs/17-i18n.md)
before changing locale data. For generated files and CI behavior, also read the
localization and CI sections of
[`docs/internals-docs/20-build-test-release.md`](../../../docs/internals-docs/20-build-test-release.md).

## Establish the text contract first

Decide whether the text is:

- user-facing copy that should follow the active locale; or
- a deliberately fixed literal that demonstrates syntax, an identifier, file
  format, command, or other contract.

Do not translate a fixed literal accidentally. Conversely, do not preserve an
English assertion merely because an older test hard-coded it. When product
intent changes from fixed to localized (or the reverse), update code, tests,
test names, comments, and documentation as one change.

## Trace the old value before editing

Search for both the translation key and the old visible text across `src/`,
`tests/`, and the documentation. Tests often encode copy indirectly in a regex,
snapshot, parser expectation, or phrase such as “stays English across locales.”
Repeat the search after editing so stale expectations do not survive the
change.

For routine new UI copy, add the canonical key to `src/i18n/en.ts`; the other
locales are allowed to fall back to English. Touch all non-English tables only
for an intentional translation pass or when an existing translation has become
false and must be corrected or retired. User-facing strings still go through
`t()`.

## Write locale-aware tests

Keep structural expectations structural: assert the callout role, id, token
boundaries, and interpolation shape independently from the translated words.
When the active locale should control visible text, derive the expected value
from that locale's table rather than hard-coding the old English word. When an
English literal must remain fixed, assert it explicitly and leave a short
reason explaining why localization must not change it.

Any test that changes the global locale must restore it in `finally`, even when
the assertion fails.

## Generate and verify the shipped data

`npm run build` runs `i18n:generate` automatically. Afterward:

```bash
git diff --exit-code -- locales src/i18n/localeManifest.ts
npm run lint
npm test
```

If the generated-file check reports a diff, inspect it and commit the intended
`locales/*.json` and `src/i18n/localeManifest.ts` changes with their source
translation change. Never repair checksum or byte-count fields by hand.

Run the most relevant focused test while iterating, but finish with the full
suite: copy changes can break a test file that did not otherwise change.
