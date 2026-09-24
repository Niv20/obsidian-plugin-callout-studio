# Convert to standard Markdown

Use this when moving your notes to an app without Callout Studio, or before
stopping use of the plugin's heading and inline formats.

Open **Settings → Callout Studio → Danger zone**. The first row is
**Convert to standard Markdown**; **Reset everything** is the second row.
Choose **Review conversion** for a short explanation about moving away from the
plugin and two example tables: headings first, then inline text. The red
**Convert vault…** button opens **Callout Studio conversion** in the sidebar
without editing any notes.

### Headings

| Before | After |
| --- | --- |
| `# [!type]` | `# type` |
| `# [!type] Title` | `# Title` |

### Inline text

| Before | After |
| --- | --- |
| `Word [!type] word` | `Word type word` |
| `Word [!type]{Text} word` | `Word Text word` |

The rules apply to all types, including unknown types and aliases. A bare token
keeps its type as written, rather than looking up a configured display name.
Inline content keeps its text and Markdown formatting. Empty `{}` becomes empty
text. Where needed, special characters are escaped to prevent the replacement
from turning into a new Markdown structure, including a reference-link definition
at the start of a line. If removing a token would expose a raw HTML block, that
occurrence stays unchanged for manual review. Icons, colors and metadata disappear.

Code blocks, inline code, frontmatter, comments, math, raw HTML and link syntax
are protected. Incomplete or unsupported nested inline syntax is left unchanged
for manual review; for example, `[!note]{unfinished` has no closing brace and
`[!note]{outer [!tip]{inner}}` nests one inline payload inside another. The
converter cannot reliably infer the intended text in these cases. A space must
follow the `#` marks to make a heading: the converter does not repair `#Title`.
Literal `+` and `-` in heading text stay. Braces immediately after a leading
heading type are heading text, not an inline payload.

Native block callout headers (`> [!type]`) and their titles stay as written;
inline callouts in their bodies can be converted. This operation does not reset
your settings, remove definitions or uninstall Callout Studio. It removes the
plugin's additional syntax, not every Obsidian-specific feature in your vault.

**We recommend backing up the entire vault first.** A Callout Studio settings export does not
back up your notes. The conversion edits original Markdown files, creates no
automatic backup and has no undo in Callout Studio.

The sidebar groups changes by file, with the number of changes in parentheses
after each file name. Click a file name to open the note. Each file heading stays
visible while you scroll through its results; each card shows the format and line
number, followed by **Before** and **After**. A heading card shows its complete
heading line. Each inline callout gets its own card, showing only its `[!type]`
token and any `{content}` payload, even when several appear on the same line.
Long headings and inline content wrap and remain visible in full.

Click a card to open and select its exact source in the Markdown editor. The card
stays highlighted only while that source remains selected; clicking elsewhere in
the note clears its highlight. Only the card's checkbox includes or excludes that
replacement. Heading tokens are reviewed as one complete heading because their
conversion depends on the rest of its title.

To change a proposed replacement, right-click its source card and choose
**Custom replacement…**. The menu includes icons for editing and restoring a
replacement. The popup shows a read-only **Before** row and an **After** row with
one editable replacement. For an inline callout, up to three words before and
after it provide read-only context; the rest of the sentence stays untouched.
Context stays on one line, shortening when space is limited or text is enlarged.
For a heading, edit its title while the heading-level `#` marks stay read-only.
The field accepts a single line;
Enter and multiline paste cannot introduce new source lines. Save to update the
preview. **Save replacement** is available only when the text differs from what
was shown when you opened the popup; restoring that text disables it again.
The card gains a **Custom** label; its checkbox keeps its current state.
Right-click it again to edit the custom text or choose **Restore default**.
Saving here changes only the proposal, and still requires the final conversion
confirmation before any note is written. Automatically generated **Heading link**
cards follow their source heading and cannot be customized independently.

Custom replacements must stay on one line. They may rename a heading but cannot
remove it, change its level, introduce another heading, or open protected syntax
such as an unfinished code block or comment across unchanged neighboring lines. Heading links
are recalculated after a custom title is saved, and a conflicting or unsafe title
is rejected without replacing the previous preview. Restoring a default that now
conflicts with another selected change can deselect that row for review.
Custom text is kept during the open review session. Editing another part of the
note preserves it; surrounding words continue to come from the current note.
An unchanged customized segment can also be relocated after an insertion above
it or a file rename when its identity remains unambiguous. If that source segment
changes, disappears, or becomes impossible to identify safely among duplicates,
only that customization is discarded and its choice is cleared
for review. Obsidian shows a notice explaining the discarded customization.
Other custom replacements remain intact. An already-open customization popup
cannot save into an outdated preview. If changed surrounding Markdown makes a
retained replacement unsafe, the custom text remains available but its replacement is
deselected for another review.

Switching to another note scrolls to that file's results, revealing more rows if
necessary. Clicking a result keeps your place in the sidebar. **Show more** also
reveals further batches manually. The title, description, red conversion button
and selection summary remain visible above the scrolling results. The checkbox
beside the summary is empty when none are selected, shows a dash for a partial
selection, and is checked when all are selected. Click an empty or partial state
to select all; click the checked state to clear the selection. The summary counts
replacements, so separate inline callouts on one line count separately.
Widen either this sidebar or **Callout Studio occurrences** to get two
columns within each file, ordered left to right and then onto the next row. File
headings keep their full width. The content stops growing at a comfortable width
and stays centered in wider panes.

Links and embeds targeting changed headings are updated too, including wiki links,
internal Markdown links and reference-style Markdown links. For example,
`[[Note#Report note|Read more]]` becomes `[[Note#Report|Read more]]`, and
`[Read more](Note.md#Report%20note)` becomes `[Read more](Note.md#Report)` when
the selected heading becomes `Report`. Same-note links, relative paths and
parent/child heading links are handled too, including custom heading titles.
Their labels and optional titles
stay unchanged. These changes appear under their files as **Heading link** cards
and follow the selected headings automatically. If a selected replacement also
contains a link repair, its **After** text includes both edits. Obsidian's normal file-writing API does not
perform this heading-reference repair, so Callout Studio plans it explicitly.
If a heading change would make an existing reference ambiguous, that conversion
is excluded and explained in the review. You can try a smaller selection.
Incomplete links, missing targets and unrecognized syntax stay as written;
the converter never guesses where they should point. External web links and
block references are not rewritten.

The sidebar refreshes automatically after note changes, with a short delay to
combine rapid edits. Brief updates do not show progress text or move the controls.
If an update takes longer than 600 ms, a progress overlay softens the results until
they are ready. Conversion is disabled while its preview is stale. Saved content
is cached while the sidebar is open; unchanged notes are not repeatedly read.
New or edited replacements are deselected so
you can review them again. Unsaved editor changes prevent conversion. Closing the
sidebar stops the preview listeners and clears its cache.

Save open notes, then pause editing and sync until conversion finishes. Choose
**Convert selected…** in the sidebar's top bar, review the separate
irreversible-action warning, and choose **Convert permanently**. Cancelling
before confirmation leaves the notes unchanged. Once conversion starts, closing
the sidebar does not stop it.

The converter checks that the vault still matches the preview. Changed, moved,
deleted or unreadable notes and unsaved editor text prevent conversion. If a
problem occurs after some notes were written, conversion stops and reports how
many notes and occurrences were already converted. Those edits remain. The sidebar
retains the exact remaining changes, including links whose headings were already
converted, and offers **Finish conversion…**. Retrying checks the expected content
again and refuses to overwrite later edits. This pending plan stays in memory if
you close and reopen the sidebar; finish it before restarting or disabling the
plugin, because it is not a persistent recovery file.
