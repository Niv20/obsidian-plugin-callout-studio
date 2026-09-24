# Danger zone

Open **Settings → Callout Studio** and scroll to **Danger zone**. It contains
two separate actions: **Convert to standard Markdown** first, then **Reset
everything**. Both ask for confirmation because they can make lasting changes.

## Convert to standard Markdown

Use this when moving notes to an app without Callout Studio, or when you want
to stop using the plugin's heading and inline formats. Choose **Review
conversion** for a short explanation and examples. The red **Convert vault…**
button opens **Callout Studio conversion** in the sidebar; it does not edit
notes.

### What gets converted

| Before | After |
| --- | --- |
| `# [!type]` | `# type` |
| `# [!type] Title` | `# Title` |
| `Word [!type] word` | `Word type word` |
| `Word [!type]{Text} word` | `Word Text word` |

The rules apply to every type, including unknown types and aliases. A bare
token keeps the type written in the note; it does not look up a configured
display name. Inline content and its Markdown formatting stay. Icons, colors,
and metadata are removed. Empty `{}` becomes empty text. Where needed, special
characters are escaped so the replacement does not create new Markdown
structure.

Native block callout headers such as `> [!note]` stay as written. Inline
callouts inside their bodies can still be converted. This operation does not
reset settings, remove callout definitions, or uninstall Callout Studio. It
removes the plugin's additional syntax; other Obsidian-specific features in
your vault may remain.

### What is left for review

Code blocks, inline code, frontmatter, comments, math, raw HTML, and callout-like
text inside link syntax are protected. If removing a token would expose a raw
HTML block, that occurrence stays unchanged. Incomplete or unsupported nested
inline syntax is also left unchanged; for example, `[!note]{unfinished` has no
closing brace, and `[!note]{outer [!tip]{inner}}` nests one payload inside
another. The converter cannot safely infer the intended text in those cases.

A heading needs a space after its `#` marks; `#Title` is not repaired. Literal
`+` and `-` in heading text stay. Braces immediately after a leading heading
type count as heading text, not as an inline payload.

### Review the proposed changes

The sidebar groups results by file and shows the number of changes beside each
file name. Select a file to open its note. Each card shows the format and line
number, followed by **Before** and **After**. Heading cards show the complete
heading because its title affects the replacement. Each inline callout gets a
separate card showing its `[!type]` token and optional `{content}` payload, even
when several are on one line. Long text wraps in full.

Select a card to open and select its exact source in the editor. Its highlight
lasts while that source remains selected. Only the card's checkbox includes or
excludes that replacement. The summary checkbox selects all changes, clears
them all, or shows a dash when only some are selected. **Show more** reveals
additional results; switching notes scrolls to that file's results.

To change a proposed replacement, right-click its card and choose **Custom
replacement…**. For inline callouts, the editor also shows up to three nearby
words on each side; for headings, the heading-level `#` marks stay read-only.
Custom replacements must fit on one line. A heading title can be renamed, but
not removed, moved to another level, or changed to introduce another heading
or protected syntax. Saving changes the preview only; you still need to select
and confirm the conversion. If a replacement is unsafe or conflicts with a
link, it is rejected or deselected for review.

Custom text stays available while the sidebar is open as you edit other parts
of a note. If its source changes, disappears, or becomes ambiguous, that
customization is discarded and the affected change is cleared for review.

### Links to changed headings

Links and embeds that point to a changed heading are updated, including wiki
links and internal Markdown links. This also covers same-note links, relative
paths, parent or child headings, custom heading titles, and reference-style
Markdown links. Link labels and optional titles stay the same. The sidebar
shows these as **Heading link** cards, and updates them automatically when you
change a heading replacement.

If a heading change would make an existing reference ambiguous, that change is
excluded and the review explains why. Incomplete links, missing targets, and
unrecognized syntax stay as written; the converter does not guess. External
web links and block references are not rewritten.

The preview refreshes after note edits. New or changed proposals are deselected
until reviewed, and conversion is unavailable while the preview is stale or an
editor has unsaved changes.

### Apply the conversion

**Back up the entire vault first.** A Callout Studio settings export does not
back up notes. Conversion edits the original Markdown files directly. It has
no automatic backup and no undo in Callout Studio.

Save open notes, then pause editing and sync until conversion finishes. Choose
**Convert selected…** in the sidebar, review the separate irreversible-action
warning, and choose **Convert permanently**. Cancelling before that
confirmation leaves notes unchanged. Closing the sidebar after conversion
starts does not stop it.

Before writing, the converter checks that the vault still matches the preview.
Changed, moved, deleted, or unreadable notes, and unsaved editor text, prevent
conversion. If a problem occurs after some notes have been written, conversion
stops and reports what was completed. The sidebar keeps the remaining changes
as a pending plan and offers **Finish conversion…**. The finish step checks the
expected content again and will not overwrite later edits. Finish it before
restarting or disabling the plugin; the plan is kept in memory, not saved as a
recovery file.

## Reset everything

Use **Reset everything** to return Callout Studio to a clean state. It removes
or restores:

- Every custom callout you created.
- Customizations to Obsidian's built-in callouts.
- Global styles, including borders, font scale, shape, spacing, and alignment.
- Saved color palettes.
- Right-click menu customization.
- Downloaded Material Symbols artwork and other resettable cached data.

Callouts supplied by the active theme are not deleted from the theme. They
remain available while that theme is active.

Before the reset runs, Callout Studio shows a confirmation and any relevant
warning about custom types used in your notes. **Reset everything cannot be
undone.** Export a [complete backup](10-import-export-and-sharing.md) first if
you may want to restore your setup later.

To undo just one icon or color, use the return arrow in the callout editor. To
restore one customized built-in callout, choose **Reset to default** from its
three-dot menu.

---
**Next:** [Quick insert](14-quick-insert.md)
