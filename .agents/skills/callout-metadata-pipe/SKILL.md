---
name: callout-metadata-pipe
description: >-
    Explains how Obsidian splits a callout header at the first "|" into id
    + metadata, and how splitCalloutMetadata/normalizeCalloutId make a
    piped id structurally unreachable by the registry. Use when touching
    utils/calloutId.ts, obsidianCalloutAttrId, the tokenizer's
    rawId/from/to, vault rewriters, autocomplete insertion, import
    validation, or CalloutRegistry.stripMetadataFromIds - or debugging a
    callout named like "note|purple" or a stray id such as "notegreen".
    Also covers what the metadata MEANS now: colour words
    (utils/calloutMetadata.ts, css/metadataColorCSS.ts) and the `|`
    dropdown (CalloutMetadataSuggest, metadataSuggestions.ts).
---

# Callout metadata (`[!type|metadata]`)

Obsidian splits a callout header at the **first `|`**: the part before it is the type, everything after is metadata, emitted as `data-callout-metadata` (verified in its bundled parser - `type.trim().toLowerCase().replace(/\s+/g,"-")`, `data: e.substr(i+1)`, untrimmed, further pipes included). So `> [!note|purple]` is the `note` callout, not a callout named `note|purple`.

**`splitCalloutMetadata` (`utils/calloutId.ts`) is where that rule lives, and `normalizeCalloutId` calls it** - which is what makes it structurally impossible for a piped id to reach the registry, since every path from raw markdown to a definition already funnels through that one function. `obsidianCalloutAttrId` deliberately does *not* strip: Obsidian removed the metadata before that attribute existed, so stripping there could only take a stray stored id and collapse it onto a real callout's CSS rule.

The tokenizer carries `rawId` (type alone) and `metadata` separately while **`from`/`to` keep spanning the whole `[!…]`** - every vault rewriter and Live Preview decoration is built from those offsets, so nothing may derive a length from `rawId`. Anything that rewrites a token must put the metadata back (`replaceCalloutIdsInVault`, every autocomplete insertion path); the plugin's own heading/inline DOM stamps `data-callout-metadata` so themes get the same hook Obsidian gives blockquotes. Import **rejects** a piped id rather than folding it onto the base - importing `note|purple` as `note` would repaint the reader's real `note`.

`CalloutRegistry.stripMetadataFromIds()` retires rows left behind by builds that predate all this - renamed to the base when it's free, dropped when it isn't (the base is usually a built-in, and merging would silently restyle a callout nobody asked to change). It touches **only the piped id** (`note|green`), because that spelling was never reachable: Obsidian split the pipe off before the plugin ever saw the token, so renaming can't orphan a `[!…]` anyone wrote. It deliberately does *not* retire the pipe-eaten `notegreen` an old editor save could also leave behind - that one **is** a real id, and the only test for it (id equals the old sanitizer's reading of its own display name) matches every user callout ever named with a pipe, since the old editor pinned id to display name. `Pros|Cons` → `proscons` would have been renamed to `pros`. An unused `notegreen` is swept up by `CalloutDiscovery.pruneUnused()` anyway.

`calloutIdentity` is the fourth helper and the newest: `obsidianCalloutAttrId(normalizeCalloutId(x))`, the one answer to "are these two ids the same callout?" - used for every comparison, lookup, insertion, discovery pass and import. It folds the pipe *and* the dash *and* a repeated space, which is right for uniqueness and wrong for both of the functions it composes: `normalizeCalloutId` must keep the space (the plugin's own token DOM carries that form) and `obsidianCalloutAttrId` must keep the pipe (a selector that folded it would hijack a real callout's rule). See docs/internals-docs/04-data-model.md § *Callout IDs and the normalizers*.

`sanitizeCalloutIdInput` is the one id helper that does **not** split on the pipe: its callers derive an id from a *display name* or an alias, never from a token body, so a `|` there is a character the user typed and is dropped by the character filter rather than treated as a separator.

## What the metadata means: colour words

The metadata is never part of the type, but it is no longer ignored: a colour word paints that one callout (`> [!mark|pink]`). Four invariants hold it together, and each is pinned by a suite:

- **Words split on whitespace AND `|`** (`metadataWords`, `utils/calloutMetadata.ts`): `pink wide` ≡ `pink|wide`, for ITS Theme users and Callout Metadata plugin users alike. Comparison folds **ASCII** case only (`foldMetadataCase`) because that is all the stylesheet's `i` flag folds — print must agree with the screen.
- **Painting is pure CSS** on `data-callout-metadata` (`css/metadataColorCSS.ts`), one rule set per colour, emitted LAST and weakest colour first at one specificity (light rules scoped `:root` so they weigh what `.theme-dark` does). So two colours resolve by a **fixed order** (saved palette > Obsidian colour > extra preset), never by position — CSS cannot see position. `resolveMetadataColor` walks the same list for PDF export's baked colours. Don't add per-element script to "fix" the order; the `|` dropdown swaps a colour instead of stacking one.
- **Words are ids, not names**: built-ins answer to their preset id (every one of Obsidian's colour names is one: `purple`, `pink`, `yellow`, …), the one alias `grey` folds into `gray`, and a preset's `legacyIds` (`violet`, `bubblegum`, `note`, …) are never words. A saved palette answers to `paletteMetadataKey(name)` — derived, never stored, so renaming offers a vault rewrite (`replaceMetadataWordInVault`) and Delete never touches notes.
- **The two dropdowns never overlap**: the type dropdown owns the cursor up to the end of the id, `CalloutMetadataSuggest` past the first `|` — both through `readCalloutTrigger`. Tab/`|` accept via the popover scope + Obsidian's private `suggestions.useSelectedItem` (read optionally). The hint line under the metadata dropdown hangs on the undeclared `onSelectedChange` hook — same rule: without it the line stays empty, nothing breaks. Every write path still closes the popover first (Admonition) and still puts back what was in the bracket.

The hidden switch is `settings.metadataColors.enabled` (no UI by decision; `activeMetadataColorEntries` returns `[]` when off).
