# Upgrading from automatic discovery

Historical fixtures in `tests/fixtures/upgrade-2.12.{0,1,2}.json` were generated
by running the registry and device store from those exact local release tags.
All three wrote `data.version = 4`. Their device format was `v: 1`, containing
`discovered: string[]`, `firstRunCompleted`, `retiredThemeIds`, and section folds.
Customized fallback rows and command-owned rows were saved in `data.json`;
unclaimed rows were omitted. The device cache held ids only, never styles.

The released tags did **not** reject newer settings versions. Loading a version-5
file into each historical registry and saving it emits version 4 and drops an
unclaimed manual fallback row. The forward-version guard appeared after release
2.12.2. Both devices must be updated before sync/editing resumes; a new plugin
cannot prevent code on an old device from writing its own file.

`DeviceLocalStore.archiveLegacyDiscovery(manifest)` runs before settings loading
can generate fresh CSS. `legacyDiscoveryArchive.ts` writes a recovery-only JSON
containing the exact legacy raw blob and the exact app-scoped startup CSS. Its
SHA-256-based filename makes retries idempotent; read-back equality verifies the
file before local cleanup. `legacy-discovery-v1-*.json` is outside the normal
`data-*.json` backup-pruning pattern. It has no automatic import or registry path.

Both source keys are reread after the asynchronous backup. Changed, unreadable,
or unverifiable evidence is preserved, and UI preference writes cannot overwrite
it. `StartupStyleCache.persist` preserves the old CSS while the local marker is
still v1 or unrecognized. Rendering itself continues. A refused local v2 cleanup
also keeps that guard active until cleanup later succeeds. Corrupt/unknown local
data is treated as evidence of a previously used installation, never proof of a
fresh install whose missing `data.json` can safely be initialized.

Saved definitions remain authoritative; stale same-id cache observations never
override saved colors, icons, aliases or commands. A later manual scan can recover
ids still present in notes or a theme. Archived CSS is a limited recovery aid,
not a replacement for lost metadata or a complete settings backup.
