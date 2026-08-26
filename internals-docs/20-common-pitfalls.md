# Common pitfalls

A concentrated list of non-obvious traps this codebase has already hit once
— each backed by a comment or a migration in the source that exists
specifically because the trap was real. Read this before making a change
that feels like it "should just work."

## State synchronization

> [!WARNING]
> **A registry mutation without a matching CSS re-inject leaves the
> settings UI and the rendered vault disagreeing.** `registry.onChange` is
> what triggers `CSSInjector.inject()` — if you mutate `registry.callouts`
> or `registry.settings` through anything other than the registry's own
> methods (`add`/`update`/`remove`/`batch`/`setUserImages`/etc.), nothing
> will repaint. There is no other path. See
> [Architecture § the data-flow loop](02-architecture.md#the-data-flow-loop).

> [!WARNING]
> **Registry edits don't touch the document, so CodeMirror won't rebuild
> Live Preview decorations on its own.** After any registry change that
> should be visible in an open note's heading/inline rendering, either rely
> on the standard `onChange → inject() → refreshAllCalloutEditors()` chain,
> or — if you bypassed the normal inject path (a preview, for instance) —
> call `refreshAllCalloutEditors()` explicitly. See
> [Render roles § refreshAllCalloutEditors](08-render-roles.md#refreshallcallouteditors--why-registry-edits-need-an-explicit-nudge).

> [!WARNING]
> **`cleanupUnusedIconSvgs()` does not call `notifyChange()`.** It mutates
> `registry.iconSvgCache` directly. Any caller that runs it must
> **explicitly** `await saveSettings()` afterward, or the trimmed cache only
> reaches disk whenever some unrelated future save happens to occur. See the
> delete flow in [Vault discovery](10-vault-discovery.md#delete-flow) for
> the canonical example.

## IDs that require normalization

> [!IMPORTANT]
> **Never write a local regex to parse a `[!id]` token or compare two
> callout ids.** Four helpers in `utils/calloutId.ts` exist precisely
> because "obviously correct" ad-hoc handling breaks on real cases:
> multi-word ids, `|metadata`, dash/space equivalence in Obsidian's own
> `data-callout` attribute. See
> [Data model § the three normalizers](04-data-model.md#callout-ids-and-the-three-normalizers).
> Using the wrong one of the four in a new call site is the single most
> common way a feature works for the common case and silently breaks on an
> id with a space, a pipe, or a stray quote in it.

> [!WARNING]
> **A `"` or `\` can reach a callout id without the user ever typing an
> unusual character intentionally** — vault discovery's own header regex and
> the JSON importer's `ID_BAD_CHAR_RE` both permit them. Any new code that
> interpolates a callout id into a CSS selector string **must** go through
> `calloutSel`/`tokenAttrSel` (`utils/calloutSelector.ts`), which escape via
> `cssAttrValue`. A raw interpolation can corrupt the entire generated
> stylesheet from that rule onward. See
> [CSS generation § selector escaping](06-css-generation.md#calloutsel-vs-tokenattrsel--the-selector-escaping-rule).

## Data that should never be mutated directly

> [!WARNING]
> **Never write to a `CalloutDefinition` object read from the registry in
> place.** Always go through `registry.update(id, partial)` (which spreads
> a fresh object) — a direct mutation bypasses `notifyChange()` entirely and
> also risks corrupting shared references. `discoveredRow.ts`'s explicit
> deep-cloning of `icon`/`bgGradient`/`iconAdjust` exists specifically
> because a naive `{...fallback}` spread shares the *same* `CalloutIcon`
> object across every discovered row and the live fallback definition — a
> single future in-place write anywhere would then silently propagate to
> every row that shares it.

> [!WARNING]
> **Never mutate an array or object returned from the public API
> (`plugin.api`).** Everything it returns is frozen at every depth
> specifically to prevent this — but if you're the one *implementing* a new
> API mapper, remember to freeze it too. See
> [Public API § nothing live escapes](18-public-api.md#nothing-live-escapes).

## Helpers that must always be used

- **`resolveIconAdjust(def, role)`** — never read `iconAdjust` or the legacy
  flat trio directly; the two-layer fallback is required for old data to
  keep rendering correctly. See [Colour system](11-color-system.md#globalstylemergets-and-iconadjustts).
- **`resolveCalloutDef(registry, rawId)`** (`renderShared.ts`) — the one
  resolution ladder every renderer must use; `CSSInjector` mirrors it
  independently and the two must never diverge, or DOM icons and generated
  CSS colours disagree about which definition a token means.
- **`shouldRenderToken(resolved)`** — call this before building **any** DOM
  for the heading/inline/ref roles. Skipping it for a new render surface
  means an `externalStyle` callout gets painted anyway, defeating the whole
  point of handing it to the theme.
- **`buildCalloutTokenDom` / `buildContentPillDom`** (`renderShared.ts`) —
  the one place heading/inline/ref token DOM is built. A new rendering
  surface that builds its own competing DOM shape breaks the icon-repaint
  sweep, which targets these exact classes.
- **`renderIconInto`** (`renderIcon.ts`) — the only "icon → DOM" painter.
  Never reach into `iconSvgCache` directly from a new renderer; go through
  an `IconResolver`. See [Icons § renderIcon.ts](12-icons.md#rendericonts--the-only-icon--dom-painter).

## Registration/unregistration pairs

> [!IMPORTANT]
> Every listener, timer, and DOM event handler must be registered through
> `this.registerEvent` / `this.registerInterval` / `this.registerDomEvent` /
> `this.register`, **or** manually torn down in `onunload()`. This is
> mechanically enforced by `tests/repoSourceRules.test.ts` ("every
> workspace/vault/metadataCache listener is registered or offref'd,"
> "nothing listens on a document or window without taking it back," "no
> interval runs outside registerInterval"). A raw `addEventListener` or
> `setInterval` that isn't caught by that scan will leak past plugin unload
> — most visibly on a disable/re-enable cycle, where a leaked listener from
> the *previous* instance keeps firing alongside the new one.

`CalloutDiscovery.destroy()`, `CSSInjector.destroy()`,
`OutlineDecorator.destroy()`, and the context-menu's
`monkey-around` uninstall (via `plugin.register(uninstallPatch)`) are the
concrete examples to follow for anything that isn't a plain Obsidian event
subscription.

## UI strings that must go through i18n

Every user-facing string goes through `t()`. This is enforced mechanically
(`tests/repoSourceRules.test.ts`: "no text setter is handed a bare English
literal," "no Notice is raised with a bare literal," "aria-labels go through
t() too"). A string interpolated into a translated value must use the
**object** form (`t(key, {name: value})`), never manual string
concatenation — see [Localization § t()](16-i18n.md#t--the-translation-function)
for why a plain string `.replace()` on user-typed content is a real bug, not
just a style nit.

## Settings that require a runtime refresh, not just a save

Saving `settings.<field>` to disk is necessary but frequently **not
sufficient**. Common cases that also need an explicit follow-up call:

| Change | Also requires |
| --- | --- |
| Anything affecting generated CSS | `cssInjector.inject()` (usually automatic via `onChange`, but a **preview-only** or **out-of-band** mutation must call it explicitly with `inject(false)`) |
| `headingCallouts.enabled` / `inlineCallouts.enabled` toggled | `plugin.refreshRenderModes()` — re-runs reading-view post-processors so already-baked DOM is added/stripped immediately, not just on next file open |
| `externalStyle` toggled on a callout | Both `refreshCallouts()` **and** `refreshRenderModes()` — the reading-view heading/inline DOM is baked, not live-CSS-driven, and needs the post-processor to re-run |
| Language changed, or a locale download lands mid-session | `plugin.applyLocaleChange()` — re-renders the three surfaces that snapshot translated text (see [Localization § three surfaces](16-i18n.md#three-surfaces-that-snapshot-translated-text-and-need-a-manual-refresh)) |
| Fallback callout id changed | `restyleUncustomizedFallbackRows()` before saving, or every uncustomized fallback row keeps its stale look until some unrelated edit happens to trigger a re-mirror |

## CSS ordering/specificity assumptions

- **The global rules' `externalExclusion()` uses `:not(:where(...))`
  specifically to keep specificity flat** regardless of how many callouts
  opt out — using a plain `:not()` chain there would make the vault-wide
  rules progressively harder for a theme to override as more callouts
  become external-styled. See
  [CSS generation § standing down](06-css-generation.md#standing-down--why-emit-nothing-needs-three-separate-mechanisms).
- **The fallback block's `:not()` chain does the opposite on purpose** —
  its growing specificity (one class-unit per known id/alias) is what lets
  it outrank every per-callout rule and correctly restyle truly unknown
  callouts, at the cost of also needing `!important` won't save you if you
  add a new per-callout rule that isn't equally specific.
- **A callout's own accent variables (`--callout-color`) are deliberately
  *omitted*, not set to a theme value, for an untouched built-in.** Setting
  it to `var(--callout-info)` explicitly instead of omitting it would work
  visually but would defeat the actual mechanism a theme relies on to
  override core's own rule at its own specificity. See
  [Colour system § built-ins](11-color-system.md#built-ins-no---callout-color-at-all-until-edited).

## Obsidian APIs with special lifecycle requirements

- **`app.hotkeyManager`, `app.customCss`, `app.setting`** are all
  undocumented internals. Every access to them in this codebase is guarded
  structurally (optional chaining, a fallback that reads as "unassigned" or
  "not available" rather than throwing) — follow that pattern for any new
  internal-API access, never assume the shape is stable across Obsidian
  versions.
- **A block callout's icon element is resolved by Obsidian exactly once,
  ever**, the first time it renders — its post-processor bails early on an
  element that already has a child. Any code that wants to "undo" this
  plugin's icon painting (handing a callout to the theme) must actively
  **re-derive and re-paint** what core would have drawn
  (`CSSInjector.restoreCoreIcon`), because there is no way to make core
  "look again."
- **`EmbeddableMarkdownEditor` is an undocumented internal API and may
  change or disappear.** Every construction of it is wrapped in a
  `try/catch` with a full-fidelity static-render fallback
  (`LiveCalloutPreview`'s `buildFallback`). Don't add a second call site
  that assumes it will always succeed.

## Mobile-specific behaviour

- **The prune-scan debounce is 10 seconds on mobile vs. 1.5 seconds on
  desktop** (`CalloutDiscovery.PRUNE_DELAY_MS`) — a whole-vault synchronous
  scan reads as the editor freezing on a phone with thousands of notes.
  Don't shorten this without re-reading the reasoning in
  [Vault discovery](10-vault-discovery.md#the-debounce-delay-is-tuned-for-mobile-not-just-feels-responsive).
- **The Live Preview mousedown-freeze window is much wider on mobile** —
  core arms the same flag on every caret move with a 700ms debounce, not
  just on an actual mouse hold. See
  [Render roles § the raw-syntax reveal](08-render-roles.md#the-raw-syntax-reveal-and-the-mousedown-freeze).
- **`.is-mobile.theme-dark` repoints `--modal-background` onto
  `--background-secondary`** — this is precisely what broke the modal
  surface tokens once and required the `color-mix()`-based re-derivation.
  See [Settings UI § two theme-aware surface tokens](15-settings-ui-and-modals.md#two-theme-aware-surface-tokens).
- **`isDesktopOnly` is `false`** — any new feature must avoid Node/Electron-
  only APIs. The startup CSS-snapshot cache exists specifically to soften
  slow mobile launches (see [Persistence and caching](07-persistence-and-caching.md#the-startup-css-snapshot)).

## Backward compatibility constraints

- **Command ids are permanent.** The five fixed command ids, and every
  minted custom-command id once created, can never be renamed —
  hotkeys are bound to them.
- **`manifest.json`'s `id`** (`callout-studio`) can never change — it's the
  vault folder name and the community-plugin registry key.
- **Every load-time migration in `CalloutRegistry.load()` must stay
  idempotent and content-keyed**, never version-keyed — an imported or
  hand-edited file can carry any version stamp. See
  [Callout registry § load-time migrations](05-callout-registry.md#load-time-migrations).
- **A field retired from `CalloutDefinition` needs an entry in both
  `RETIRED_FIELDS` (importValidator) and, if old `data.json` data could
  still carry it, a load-time cleanup migration** (see
  `dropSolidBackgroundFlags` for the pattern) — otherwise it's silently
  re-written forever by every subsequent save/export.

## Import/export compatibility

- **The legacy flat-array export shape must keep working** — it's public
  API surface (`registry.exportToJSON()`), not just an internal format.
- **A settings-level list that merges by id must actually merge, never
  `Object.assign`** — see
  [Import and export § the three exceptions](14-import-export.md#settings-import-replace-wholesale-except-three-lists-that-merge-by-id).
  This is the single most-cited rule in `CLAUDE.md` for a reason: it's easy
  to add a new list field and forget this step, and the failure mode
  (silent data loss on import) is severe and easy to miss in testing.

## Behaviours that look redundant but are intentionally defensive

- **Every internal-API read (`app.hotkeyManager`, `app.customCss`) is
  guarded even though the current Obsidian build always has it.** This is
  forward-compatibility insurance for an undocumented surface, not dead
  code.
- **SVG artwork is re-sanitized on every disk/settings read, not just on
  first import.** `data.json` syncs between devices and can be hand-edited;
  trusting a check that happened on some other machine is trusting nothing.
  Same reasoning applies to `PackDataStore`'s re-verification of pack
  checksums on every disk read, not just on download.
- **`isModified()`'s `?? null` normalization** (treating absent and
  explicit-`undefined` as equal) looks unnecessary until you remember a
  JSON round-trip through `data.json` produces exactly that ambiguity —
  removing it would make a built-in read as "modified" after any save/load
  cycle even with no real change.

---
Next chapter: [21-theme-callout-discovery.md](21-theme-callout-discovery.md)
