# Vault insights

Vault insights shows source references to callouts across your Markdown notes.

## Open the sidebar

Run **Callout Studio: Callout occurrences** from the Command palette, or select
**Find usages** from a callout's three-dot menu. The sidebar combines navigation
and vault statistics; there is no separate statistics window in Settings.
The sidebar tab and **Find usages** share a paintbrush icon with an overlapping magnifying
glass at its lower right.

The compact metrics at the top share the available width evenly. Narrow panes
show **Total callouts** and **Types found**; wider panes also show **Files with
callouts**, then **Markdown files** as space allows. These totals cover the whole
vault, independent of the selected type and format. A subtle divider separates
the metrics from the filters below. Several inline callouts on one line count as
separate occurrences.

Use the searchable **Callout type** picker to choose a saved type or an
unregistered type found in your notes. **Registered callouts** appear first,
followed by a divider and **Unregistered callouts**, using the same group styling
as the color picker. Searching keeps this order and hides groups with no matches.
It shows the selected ID; saved types include their aliases in the results. Equivalent source spellings share one
option, and a registered alias does not create a duplicate option. Unregistered
options update as notes change and are available **only in this sidebar**.
Selecting one never saves or registers it, or adds it to any other settings
picker. Use **My callout types → Scan for callouts** to register it.

Built-ins and saved definitions are available even without occurrences. A type
provided only by a theme is offered here when it occurs in a note; an unsaved
editor preview alone does not add an option.

If the last occurrence of the selected type is removed, the sidebar keeps that
selection and shows zero matches. It does not switch to another type while you
are editing. Once you select a different type, an unused unregistered type drops
out of the picker.

## Navigate through occurrences

Results are grouped by note, with a bordered card for each occurrence. The file
heading includes its matching count in parentheses, including matches not yet
revealed by **Show more**. Each card shows its format, line number, and at most
two lines of raw Markdown, including syntax such as `> [!info]`. Block previews
include a line of body text when available. Choose **All formats**, **Block**,
**Heading**, or **Inline** to filter the selected type. The type and format
controls sit side by side when the pane is wide enough. With a mouse or trackpad,
hovering a result subtly brightens its border; keyboard focus keeps its stronger
outline.

A summary below the controls shows the matching occurrences and files, such as
**131 occurrences in 15 files**. The whole sidebar scrolls together. Select a
card to navigate; Ctrl-click (Command-click on macOS) opens a new tab. The list
initially shows up to 100 results; **Show more** reveals another page.

Navigation opens the note in editing mode and selects the exact callout token.
Locations are revalidated against the current editor. Missing or ambiguous
occurrences trigger an automatic update instead of selecting unrelated text.
On hosts where Settings cannot be dismissed automatically, close Settings to
reach the opened sidebar.

## Usage counts in menus

A callout's three-dot menu shows **Find usages**, with its total across all three
formats and the number of distinct files. Select it to open those results.
Definition menus include the type's aliases; a file containing both the primary
ID and an alias still counts as one file.

A first scan displays **counting…**. Incomplete scans are labelled rather than
reported as zero. Actions that change notes check current contents separately.

## Scanning behavior and exclusions

There is no automatic discovery or unconditional startup scan. Opening a usage
surface, including a restored occurrences sidebar, builds an in-memory index. Subsequent requests reuse it, and
saved-note changes and edits in open Markdown editors are reflected automatically after a short delay. There is no manual Refresh button. Nothing is uploaded
or written to plugin settings by this index. Brief scans and updates stay quiet;
if one remains in progress for two seconds, its status appears above the results.

Fenced and indented code, inline code (including multiple-backtick and multiline
spans), YAML frontmatter, and Obsidian `%%` comments are excluded. Escaped tokens,
Markdown-link labels that match callout syntax, and wikilink references are not
usages. Whitespace and indentation are interpreted in their Markdown context.

Counts describe source references, not the number of visible widgets. Existing
incomplete inline content payloads and nested payload tokens remain source
references even when a renderer does not show a pill. Theme-owned heading/inline
syntax is also counted as source, regardless of whether that format is rendered.

Open editors contribute their current text, including changes not yet saved;
closed notes use saved Markdown. If files cannot be read, the sidebar labels
the available results as incomplete and lists the affected notes. Later source
changes or reopening the sidebar trigger another attempt; failures do not start
an endless retry loop.

---
**Next:** [Reset everything](13-reset-everything.md)
