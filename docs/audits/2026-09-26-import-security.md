# Import compatibility and hostile-input audit — 26 September 2026

Scope: Callout Studio's current working tree, its native backup importer, and
the file, clipboard, and vault routes for Callout Manager and Admonition.
Pre-existing settings-window and translation changes were preserved. This is
a source audit with regression tests, not a claim that every browser, mobile
device, third-party plugin, or possible payload has been exhaustively tested.

## Upstream snapshots

Both repositories were downloaded as source and examined without executing their
plugins or installing their dependencies.

- **Callout Manager**, manifest version **1.1.2**, commit
  [`bfdf6969baf0d273cd9cae2816aa77267512209e`](https://github.com/eth-p/obsidian-callout-manager/tree/bfdf6969baf0d273cd9cae2816aa77267512209e).
- **Admonition**, manifest version **12.0.7**, commit
  [`2394a8978b6b371f7da33d05cbd6f070c0c8c15c`](https://github.com/ebullient/obsidian-admonition/tree/2394a8978b6b371f7da33d05cbd6f070c0c8c15c).

These identify the inspected source snapshots, not an assertion about the
latest published release on every distribution channel.

## Compatibility

### Callout Manager

Its saved state contains custom IDs and ordered per-ID appearance settings.
Its **Copy** button exports generated CSS already resolved for the current
theme and light/dark scheme; it is not a complete settings backup.
[Saved schema](https://github.com/eth-p/obsidian-callout-manager/blob/bfdf6969baf0d273cd9cae2816aa77267512209e/src/settings.ts#L8),
[Copy implementation](https://github.com/eth-p/obsidian-callout-manager/blob/bfdf6969baf0d273cd9cae2816aa77267512209e/src/panes/manage-plugin-pane.ts#L113),
[CSS resolution](https://github.com/eth-p/obsidian-callout-manager/blob/bfdf6969baf0d273cd9cae2816aa77267512209e/src/main.ts#L313).

| Capability | Callout Studio result |
| --- | --- |
| Custom types and saved overrides of existing types | Imported from `data.json` |
| Separate light/dark accent colors | Read from JSON; colors pass through Studio's palette and contrast rules |
| Created types with no explicit style | Imported with default gray and fallback icon |
| Copied CSS | Recognized IDs, icon, and one accent color; partial recovery only |
| Multiple declarations in one CSS rule | Last recognized declaration wins after this fix |
| Icons registered by another plugin | Work only while that icon provider exists in the destination vault |
| Different icons per color scheme | One icon retained; loss is reported |
| Theme-specific conditions | Flattened; unconditional values are preferred, with a warning |
| Arbitrary `customStyles` | Not executed or imported; warning shown |
| Full CSS cascade, variables, named/OKLCH colors | Outside this limited CSS reader |
| Theme/snippet types with no saved override | Not carried by the source file/export and cannot be reconstructed from it |

The ordered declarations and raw CSS come directly from
[upstream's stylesheet generator](https://github.com/eth-p/obsidian-callout-manager/blob/bfdf6969baf0d273cd9cae2816aa77267512209e/src/callout-settings.ts#L47).
Its inspected `and`/`or` evaluator compares `findIndex()` with `undefined`,
which makes OR always true and AND always false. Studio uses ordinary Boolean
semantics instead; exotic manually authored conditions can therefore differ
visually from this upstream version.
[Evaluator](https://github.com/eth-p/obsidian-callout-manager/blob/bfdf6969baf0d273cd9cae2816aa77267512209e/src/callout-settings.ts#L84).

### Admonition

Admonition exports definitions as JSON and can import multiple selected files.
Studio accepts its exported array, a single definition, a `userAdmonitions`
record, or the full `data.json`, while deliberately selecting only definitions.
[Schema](https://github.com/ebullient/obsidian-admonition/blob/2394a8978b6b371f7da33d05cbd6f070c0c8c15c/src/%40types/index.d.ts#L3),
[import/export implementation](https://github.com/ebullient/obsidian-admonition/blob/2394a8978b6b371f7da33d05cbd6f070c0c8c15c/src/settings.ts#L225).

| Capability | Callout Studio result |
| --- | --- |
| Type, explicit title, color | Imported; missing colors use stable blue rather than a random color |
| Obsidian, Font Awesome, Octicons, RPG Awesome icons | Supported; missing names warn and fall back or preserve the existing icon |
| Legacy RPG names | `montains` → `mountains`; `perspective-dice-six-two` → `perspective-dice-two` |
| Uploaded inline pictures | Converted, sanitized, and stored in Your images, subject to resource limits |
| External image URLs | Not fetched |
| `iconWithCss` / custom CSS | Appearance not transferred; warning shown |
| Generated Admonition CSS | Not accepted by its JSON import route; use JSON for migration |
| Enabled `command`, `copy`, `noTitle`; disabled `injectColor` | Not migrated; now explicitly reported |
| Global collapse, shadow, title parsing, hide-empty options | Not restored by the definition importer |
| `ad-*` fenced blocks in notes | Not converted or rendered by importing definitions |

The icon-name corpus comparison found all 1,422 Font Awesome Solid, 163 Regular,
550 Brands, and 378 Octicons names in Studio's corresponding sources. RPG
matched 493/495 before the two spelling corrections; all 495 now map. This
checks name coverage, not pixel-identical artwork between library versions.
Names without an explicit library remain ambiguous because upstream searches
downloaded libraries in installation order.
[Upstream icon inference](https://github.com/ebullient/obsidian-admonition/blob/2394a8978b6b371f7da33d05cbd6f070c0c8c15c/src/icons/manager.ts#L93).

Upstream reduces uploaded pictures to 24px PNG, so migration cannot recreate
detail already lost there.
[Picture conversion](https://github.com/ebullient/obsidian-admonition/blob/2394a8978b6b371f7da33d05cbd6f070c0c8c15c/src/modal/callout.ts#L267).
Admonition's generated CSS may embed entire quoted SVG drawings as icon values;
those are not portable icon-library names for Studio's limited CSS reader.
[CSS generation](https://github.com/ebullient/obsidian-admonition/blob/2394a8978b6b371f7da33d05cbd6f070c0c8c15c/src/callout/manager.ts#L205).
Its copy button and conditional title hiding affect native callouts too;
they are real missing capabilities, not just code-block settings.
[Native callout behavior](https://github.com/ebullient/obsidian-admonition/blob/2394a8978b6b371f7da33d05cbd6f070c0c8c15c/src/callout/manager.ts#L77).

## Confirmed bugs and hardening

| Finding | Evidence / consequence | Resolution |
| --- | --- | --- |
| Deep Callout Manager conditions | Original parser threw `RangeError: Maximum call stack size exceeded` on valid 100,088-byte JSON with 10,000 nested `and` conditions | Bound JSON complexity before parsing and at direct validator/format entry points |
| Unbounded shallow JSON allocation | A 150,004-byte array of 50,001 empty arrays reached `JSON.parse` before the initial post-parse guard | Preflight counts values and per-container items before allocation; regression proves zero parser calls |
| CSS regex backtracking | Brace-free input or repeated unterminated comment openers could cause superlinear work | Forward-only scans and work budgets |
| Invalid selector merged before validation | A piped or multiline ID could donate its appearance to a valid base ID | Validate raw IDs before canonical merging |
| Admonition prototype-name lookup | `__proto__`, `constructor`, or `toString` could resolve inherited members as icon libraries | Own-property checks and regression tests |
| Native picker setting type confusion | `materialStyleDefault: {"toString":0,"valueOf":0}` survived settings import, then threw during picker string conversion | Rebuild enums and scalar settings using validated types; instantiate the picker in the regression |
| Ignored icon fields retained | Non-Material `style`/`weight` warned that they were ignored but remained in the definition | Actually drop the fields |
| Legacy missing-image reporting | Flat-array imports could reference absent pictures without the warning shown for v2 backups | Run the same missing-picture check for both formats |
| Raster decompression / SVG complexity | Small compressed data could request huge decoded pixel buffers; nesting and aggregate image work were insufficiently bounded | Check headers before decode, frame dimensions, SVG depth and collection budgets |
| Duplicate/raw-key handling | Canonically duplicate JSON IDs and trimmed-key lookups could lose or overwrite imported appearance | Keep original lookup keys, validate originals, reject duplicate canonical IDs |
| Incomplete appearance reporting | Custom-CSS-only rows could disappear from reports, and per-mode icons/theme overrides were silently flattened | Report the loss and do not count empty updates |
| Repainting every native imported definition | Accepted batches triggered growing stylesheet/repaint/save work once per row | Batch definition mutations into one notification |
| Image limits after merge | Separately acceptable existing and incoming pictures could exceed the combined budget or disappear on reload | Check the prospective merged collection during planning and again before applying; retain existing pictures |

Tests cover malformed types, extreme counts/depth, ordinary Unicode/escaping,
prototype-like names, invalid identifiers, unknown icons, CSS cascade subset,
image MIME/header consistency, APNG/GIF/WebP frames, dangerous SVG markup/styles,
file/paste/vault routes, report bounds, and preservation of existing data.
The image-budget browser cases also simulate sync changing the destination
while a report is open and verify that the apply-time check prevents mutation.

The text/file ceiling is 16 MiB; JSON allows at most 32 container levels,
50,000 values and 1,000 items per array/object. Reports render their first 200
issues and shorten long values. See
[import internals](../internals-docs/15-import-export.md) and
[image internals](../internals-docs/13-icons.md) for the maintained limits.

## What the security result does and does not mean

**Yes: before these fixes, deliberately crafted JSON could break an import or
leave state that broke later UI.** A stack-overflowing import is reproduced;
an operating-system process crash was not demonstrated. JSON need not execute
JavaScript to be harmful: its size, shape, and accepted field types matter.

No arbitrary-code-execution path was demonstrated. Imported JSON is parsed as
data; raw competitor CSS is not installed, and user SVG uses an allow-list.
Real Chromium checks exercise script/event removal and prohibit network
requests during sanitization/rendering. These results do not prove universal
immunity or rule out a browser-decoder defect.

The limits bound individual input and accepted image collections. They do not
promise that every accepted setup is fast on every phone, limit deliberate
repeated user-approved imports indefinitely, or make changes to the plugin's
own executable files safe. Reusing one complex vector icon across many visible
callouts can multiply rendering work even within the unique-image budget;
virtualizing previews and budgeting rendered geometry would be further work.
Clipboard contents are already delivered as a
string by the browser, and an adapter file can change between its size check
and read; actual text is therefore checked again before parsing.

## Useful additions, ranked separately from the fixes

1. **Migrate Admonition's native insertion command.** This can map onto Studio's
   existing custom commands. The two commands that write `ad-*` code blocks
   need separate behavior and should not be silently remapped.
   [Command implementations](https://github.com/ebullient/obsidian-admonition/blob/2394a8978b6b371f7da33d05cbd6f070c0c8c15c/src/main.ts#L655).
2. **Optional per-type copy button and hidden title.** These close meaningful
   Admonition migration gaps and require rendering/UI work before import can
   preserve them.
3. **A separately reviewed `ad-*` → native-callout conversion.** Show exact
   note edits and unsupported parameters before writing anything. Definition
   import alone cannot replace this workflow.
4. **Independent snippet discovery with origin filenames.** Callout Manager
   exposes a useful source inventory; Studio currently uses snippets for
   appearance/specificity without offering the same inventory.
   [Source information](https://github.com/eth-p/obsidian-callout-manager/blob/bfdf6969baf0d273cd9cae2816aa77267512209e/src/panes/edit-callout-pane/section-info.ts#L83).
5. **Search by icon, source, or snippet**, then multi-file JSON import and
   per-mode icons if users need them.
   [CM search fields](https://github.com/eth-p/obsidian-callout-manager/blob/bfdf6969baf0d273cd9cae2816aa77267512209e/src/callout-search.ts#L61).

These are product opportunities, not features added by this audit. Arbitrary
foreign CSS should not become executable styling merely to improve migration
fidelity.

## Verification and delivery

- `npm run build`: passed; production bundle 2,059,001 bytes, within the 2 MiB gate.
- `npm run lint`: passed.
- `npm test`: **6,411 passed**, zero failures, skips, or TODOs.
- Chromium SVG/security suite: **50 checks passed**, with no network requests.
- Independent JSON preflight review: 10,000 generated valid inputs and exact
  budget boundaries, including proof that oversized structures never reach
  `JSON.parse`.
- `git diff --check`: passed; `graphify update .`: completed.
- Non-English source/generated locale hashes match the pre-audit baseline.

New UI keys are English-only. At audit time, no version bump, commit, push, or
release had been performed. Manual Obsidian/mobile visual and performance
testing was not part of these checks; Chromium tests use the actual
DOM/CSS/image APIs while the Node suites use the repository's Obsidian stand-in.
