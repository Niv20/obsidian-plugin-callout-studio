# Settings UI and modals

Covers the settings tab ([`src/settings/SettingsTab.ts`](../../src/settings/SettingsTab.ts)),
the flows its rows call (`src/settings/sections/`), the two vault sidebars, the
shared modal chrome, and the individual modals not already covered by
[Callout editor](14-callout-editor.md) or [Icons](13-icons.md). How the tab's
tree is built, kept current and drawn is [Declarative settings](26-declarative-settings.md);
this chapter covers what its rows are made of and everything outside the tab.

## The settings tab

```ts
getSettingDefinitions(): SettingDefinitionItem[] {
	this.declarative ??= new DeclarativeSettings(this);
	return this.declarative.definitions();
}
```

Obsidian draws the whole tab from a tree: this hook's answer. A **non-empty**
answer turns `display()` off for the whole tab (Obsidian 1.13+), so everything
on the tab, every page and every row, comes from the tree, and Obsidian indexes
it for **Search settings…**. How the tree is built, kept current and drawn is
all in [26-declarative-settings.md](26-declarative-settings.md).

The tab has no `display()` of its own. The page it used to draw section by
section, and the three windows that became pages (the per-role style windows,
Customize right-click menu, Commands and shortcuts), were deleted in the *Clean
Sweep* (2026-10-25). A tree that fails to build is replaced by one row that
says so (26 § Never throwing). What remains under `settings/sections/` are the
pieces the tree's rows are made of: the callout row and its menus, the
fallback and language controls, the palette flows, the backup import, the
scan, and the shared `SettingsContext` (`sections/types.ts`) every flow is
handed.

The main page, top to bottom: the notices (saving paused, the import offer);
the callouts box (Callouts from your theme, My callout types, Built-in
callouts, Default fallback callout); Colors and icons (Saved color palettes, a
page, and Icon libraries, a row whose button opens the Manage icon libraries
window - [`iconLibrariesRow.ts`](../../src/settings/declarative/iconLibrariesRow.ts));
Global styling (Heading, Inline and Block callout); Editor (Autocomplete and
metadata, the right-click menu, the commands); Import and export; Danger zone (first row: Restore an earlier version); the
language notice (a box that shows only while the chosen language is not
downloaded); and the footer, one row of tiles (the language, the project's
links, License, the version). The table in 26 § The main page, part by part says which module
builds each. There is no Add new callout on the main page (the **+** of My
callout types adds one), and the switch for the theme's styles is the top row
of the Callouts from your theme page, not a row of the main page (26 § The
callout pages). Every box of the tree, at every depth, carries the class
`cs-box` (`settingsTree.ts` `markBoxes`; the plugin's own pages add it to the
boxes they draw), the hook for any rule that should reach only the plugin's
rows and not the rows other plugins draw in the same window. No rule uses it
for alignment: a row in these boxes is laid out as core lays it out, its
control hanging from the top of the row (`align-items: flex-start`), exactly
as in the rest of Obsidian (see *Rows and slider values inside a window*).

The tab overrides `getControlValue` and `setControlValue`, so no declarative
control can ever reach Obsidian's default `saveData(plugin.settings)`, which
would overwrite `data.json` with the settings alone (26 § Saving a control).
`hide()` ends the visit the tree started (26 § The tab and its tree).

The tab also sets `icon` to `PLUGIN_ICON_ID` (Lucide `paintbrush`, the mark
that stands for Callout Studio). Obsidian draws a tab's icon beside its rows in
the settings search results, as it does for every core tab; the sidebar list
hides every community plugin's icon, so nothing changes there.

### Four signals, one coalesced redraw

They live in `settings/sections/tabSubscriptions.ts`. The settings tab wires
them once, for the plugin's whole life, into its `TreeUpdater`; an open
Built-in or theme callouts page wires them again into its own while it is open
(26 § The tab and its tree, § The callout pages).

```ts
registry.onChange(sub)          → request(false)
registry.onPreviewChange(sub)    → request(false)
plugin.onIconCacheChange(cb)      → request(true)
workspace.on("css-change", cb)     → request(false)  // theme-mode swatch colours
```

All four funnel into one request a frame (`TreeUpdater`), so a burst of
related events (a registry mutation that *also* triggers `css-change`) costs
one redraw. The frame is the **tab's own window's** (`nextFrameOrSoon`): in
Obsidian 1.14 the settings are a window of their own, and a frame asked of the
main window is held back while it is hidden behind them. The `onPreviewChange`
subscription is what keeps a row in step with a preview that stands over it,
without the preview reaching `saveSettings()` or forcing a document-wide
re-render - see
[Callout registry § the transient live-preview slot](05-callout-registry.md#the-transient-live-preview-slot).
The callout editor does not send this signal: its draft is a demo the lists
never see, which is what keeps every row on the saved callout until Save (see
[Callout editor § Who sees the draft before Save](14-callout-editor.md#who-sees-the-draft-before-save)).

#### `force`, and why only one of the four carries it

A request compares a signature of everything the pages show and skips the
redraw when nothing moved. Three of the four signals describe changes that
signature reads for itself; the icon download describes one it structurally
**cannot** see, and passes `force`:

| Signal | `force` | Why |
| --- | --- | --- |
| `registry.onChange` | no | A real mutation, read straight off the registry |
| `workspace.on("css-change")` | no | Moves the colour scheme, the theme's name and its measured appearances - all in the signature |
| `registry.onPreviewChange` | no | Registered without a registry mutation, but the signature is built from the registry's list views (`partitionCallouts`), which show a draft in place of the callout it stands over and leave out one on an id of its own - so a draft that changes a row changes the signature. `tests/settingsTabWriteSilence.test.ts` pins both halves. (Forced until 2026-11-06.) |
| `plugin.onIconCacheChange` | **yes** | Artwork lives in a download cache keyed by icon name, so a definition naming a not-yet-downloaded icon is byte-identical to the one naming it a second later - guarding this would leave every spinner spinning for good |

`force` is sticky across the coalescing frame: a frame that coalesced an icon
landing with an unrelated `css-change` still honours the icon.

The callout lists' part of the signature (`sections/calloutListsSignature.ts`)
serialises **whole definitions**, not the fields a row happens to read today,
and the module says why at length: a curated list is how the tenth field added
later goes stale on screen. Both directions of failure are named there too - a
signature that changes when nothing did costs one redraw, while one that fails
to change leaves a stale row with nothing to catch it, so it errs toward
including more.

### Changes from outside redraw the open page

`manager/settingsBoot.ts`'s `adoptExternalSettings` runs whenever another
device's `data.json` lands - on every sync round trip - and `applyLocaleChange`
when a locale finishes downloading; the two recovery services run after a
restore. All four ask `settingsTab.update()`, with no check of their own:
Obsidian draws the tab again only while it is the open tab, and only the page
that is open in it, keeping its scroll. The check they used to make,
`containerEl.isConnected`, was false while a sub-page was open, so a sync
landing then was never drawn (review B2).

### Opening settings does not discover callouts

Opening the tab builds the tree and starts a visit (26 § The tab and its tree).
It neither scans open editors for unknown types nor schedules pruning. The
occurrence sidebar owns read-only statistics and navigation; Settings has no
separate statistics modal.

### Scan for callouts

The one scan is the **Scan for callouts** row under the list on My callout
types (`declarative/calloutPages.ts`), which calls `runManualScan` in
`sections/manualScan.ts`. A scan is per plugin: `scanRunning(plugin)` is true
while one runs (a `WeakSet`), so a second press does nothing, and the row says
**Scanning…** for as long as it runs, from any page that draws it. The row is
in the signature through `scanRunning`, so it redraws when the scan starts and
ends. Failures are caught and reported; the scan never focuses a control when
it finishes. The registry's own change signal redraws the rows and counts it
added (`tests/manualScan.test.ts`).

The scan is "running" until its result notice is shown, not only while the
vault is read. The **Scanning…** notice is a `workNotice` with a minimum of two
seconds (`SCAN_MIN_MS`) and a gap (`BEFORE_RESULT_MS`) before the result, so a
scan that takes a blink still shows the brush painting and the two notices
never land on each other.

**Why the minimum is deliberate.** The floor makes a fast scan slower than it
needs to be, on purpose. A result that appears instantly after pressing a button
that "searches the whole vault" reads as shallow or untrustworthy, while visible
work (the painting brush) reads as proof the scan really looked. Two studies
back this up. Buell & Norton (2011), "The Labor Illusion": users valued and
preferred systems (flight search, dating sites) that showed longer waits with
operational transparency, such as animations or the steps being taken, over
systems returning identical results instantly. Adar, Tan & Teevan (2013),
"Benevolent Deception in Human-Computer Interaction": systems sometimes use
artificial delays to match the user's mental model of the task, because a
response that is too fast (under about 100 ms for something expected to take
work) can cause cognitive dissonance and suspicion. The delay is a floor, not an
addition: a scan that already takes longer than `SCAN_MIN_MS` is never delayed
further. Keep the number small; the aim is a believable pause, not a slow
feature. A work notice's brush does not keep still first, as
the other notices' does: it moves from the first frame. `done()` resolves when
the next notice may be shown, and a second call returns the same wait; a caller
with no notice after it (the conversion) does not wait for it.

**Scanning…** covers only the reading of the notes. `runManualScan` hands
`work.done()` to the scan as its `beforeSave` wait
([chapter 11](11-vault-discovery.md#one-discovery-entry-point)), so the notice
is gone before the new rows are built, saved and drawn, and the result notice
comes right after the list shows them. The brush is drawn frame by frame on the
page's one thread: with hundreds of new callouts, building them, saving them and
redrawing the list held that thread for most of a second (measured 2026-11-01:
753 new rows, about 900 ms), and the brush stood still while that ran. Done
between the two notices, the work leaves nothing frozen on screen; the row
still says **Scanning…** until the list is drawn. One redraw remains under a
notice: the row's name changing to **Scanning…** redraws the whole page, which
with a long list (766 rows: about 300–500 ms) stalls the brush as it starts.

### Danger zone and the footer

The language and the project's links are not rows of the page: they are the
tiles of the footer (below). The Language row, the About row and the footer's
two text rows were each a box of their own until 2026-10-29. The About Callout
Studio tile, which opened the welcome window, was taken out of the footer the
same day. The window still opens on a fresh install
(`maybeShowWelcomeOnLaunch`); the only other way in is `openWelcome()` in the
DevTools console, since there is no command for it.

**Danger zone** has **Convert to standard Markdown** first and **Reset
everything** second (`declarative/mainPageGroups.ts`). The reset's whole flow
(the question listing what goes, the backup first, the reset, the notice) is
[`settings/resetEverything.ts`](../../src/settings/resetEverything.ts).
**Reset everything** is red words on a light red wash, `setDestructive()`
without `setCta()`: the look of Obsidian's own **Log out** button (Settings →
General → Account, read in app.js 1.14.5: `setButtonText(…).setClass("mod-destructive")`).
It is the one red every red button of the plugin wears, a window's confirm
button included (§ below, `ui/destructiveButton.ts`); `buttonRow`'s
`destructive` flag is how a settings row asks for it.
**Convert to standard Markdown** opens the registered `PortableConversionView`
directly in the right sidebar and closes settings (see the sidebars below).

The page ends with the **footer** (`declarative/footerGroup.ts`): one box with
one nameless render row, `footer-tiles`, whose single child is a flex line of
tiles (`cs-footer-tiles`, centred, wrapping in a narrow pane). A tile is an icon
with its name beside it. Everything that is about the plugin rather than its
settings is a tile, in this order:

| Tile | Icon | What it does |
| --- | --- | --- |
| Language (shows the language in use, e.g. `English`) | `globe` | opens Obsidian's `Menu` of languages (below) |
| Open an issue, Source code | `bug`, `github` | the repository pages (`projectLinks()`) |
| License | `scale` | opens `LicenseModal`: the open-source promise with a link to the plugin's license, and the icons' licenses |
| `v2.18.0` | no icon, words only | the release notes of the installed version |

A tile is a native-looking button: the height of a field (`--input-height`)
with the field's face (`--interactive-normal`, hover and focus ring from the
same tokens as Obsidian's buttons and dropdowns), side padding, and the icon and its name
(`.cs-footer-tile-label`, one line) side by side, written once as
`.cs-footer-tile` at four classes so it outweighs Obsidian's `button` rules and
the browser's link colours, and a link (`a`) and a window opener (`button`)
look the same. The name is real text, so it is also the tile's name for a
screen reader, and **no tile has a tooltip** (`drawTileContent` calls no
`setTooltip`); the first version of the footer was icons alone with the name as
the tooltip, and the words replaced it on 2026-10-29. The language tile shows
the language in use, not the word "Language": `SelectDropdown` with
`{ icon: "globe", showValue: true }` (`ui/selectDropdown.ts`; without
`showValue` the words are hidden and the name is a tooltip). The labels are the
existing strings (`footer.openIssue`, "Open an issue", and `footer.sourceCode`),
and one new key for the License tile, `license.title`, which is also the
window's title. (The About, email and Contribute tiles were taken away on
2026-10-29, and the Icon licenses tile was folded into License; their keys, and
the old `footer.prompt` sentence, were deleted from every locale table on
2026-10-31. `credits.title` is no longer read either, but the locale files still
carry it until the next translation pass.) The row's own name and control columns are hidden
(`.cs-footer-row > :not(.cs-footer-tiles)`), as the page-intro box hides its
row's (`cs-page-intro`): the tiles are drawn straight into `setting.settingEl`
and removed in the row's cleanup, because Obsidian keeps a row when it draws the
page again. The footer is not a setting, so it is not in the settings search;
neither are the language and About any more (they were rows that a search for
"language" or "about" found). The words and addresses come from
[`settings/aboutLinks.ts`](../../src/settings/aboutLinks.ts).

Under the footer the page ends 24px below it, the gap between two boxes, not
Obsidian's 64px of bottom padding for a tab (`.vertical-tab-content`). The tab
puts `cs-settings-tab` on its `containerEl` in the constructor
(`SettingsTab.ts`) and `styles.css` overrides the padding for that class (a class
the code sets, because the stylesheet takes no `:has()`). Only the main page is
shortened: a sub-page is its own `.setting-page.vertical-tab-content` element.

**The language tile** is a `SelectDropdown` given an `icon`
(`ui/selectDropdown.ts`): the same button-plus-`Menu` adapter every plain choice
uses, minus the words and the caret (the `SelectDropdown` section, below). The current
language's name stays in the page, visually hidden (`cs-visually-hidden`), so
the button's accessible name still reads "Language, English". The menu lists
every language under its own name with a ✓ on the one shown. There is no reset
arrow and no Automatic row: **picking Obsidian's own language follows Obsidian
again** (it saves `"auto"`), which is the way back to the default
(`languagePicker.ts`, `preferenceFor`). While saving is paused, or a language
downloads, the tile is disabled (read at every draw; the page is drawn again
whenever either changes), and `languageChooser` (`generalRows.ts`) only explains
if a pick still gets through. When the chosen language is not on the device it is
fetched under **notices**, not in the page (a row that appeared above the footer
mid-switch moved the page under the pointer): a "Downloading translation…"
work notice with the painting brush, then "Translation downloaded." or, if it
failed, "Could not download עברית…" with **Retry**. See
[Localization § what happens when a translation download fails](17-i18n.md#what-happens-when-a-translation-download-fails).

**License** opens `LicenseModal`: a sentence that the plugin is open source and
will stay that way, ending in a link to the license on GitHub (`LICENSE_URL` in
`aboutLinks.ts`), then the icons' part. The sentence is two strings, the words
before the link (`license.openSourceBeforeLink`) and the link's own words
(`license.openSourceLink`, "here"), with the full stop added in code, so a
language can word the end of its sentence as it needs. Until 2026-10-29 the
window began with the brush mascot and a row "Plugin license"
(`footer.license`, deleted from every locale table on 2026-10-31). The window renders the registry-backed icon attributions
and links to the full third-party notices. The attributions are one Obsidian
setting group (finding S8-17), a row per library as Installed plugins lists
plugins: the name as a link with the version beside it in Obsidian's
`u-muted u-small u-numeric` type, and a line per licence, then the
modifications and any notice, as the row's description. The rows keep
`role="list"`/`listitem`. They were seven bordered cards in small grey text
until 2026-10-23.

## The two vault sidebars: Find callouts and Review conversion

**Find callouts** is a right-sidebar tab, added once on first install; a
built-in command opens it, and a callout row's ⋮ menu opens it on that
callout. **Review conversion** opens only from the Danger zone's **Convert to
standard Markdown**, in the right sidebar. Both live in workspace panes, not
windows.

In Review conversion, the question-mark button is the small icon button at the
end of the **Convert selected** row. It opens `PortableConversionHelpModal`: an **About conversion** explanation
with one four-row **Before**/**After** table, isolated LTR source text, and a
backup recommendation. Heading and inline examples share the table without
separate subheadings. The table is one rounded box with a line between rows, as
a settings group is drawn, and the recommendation is a line of the window's
text rather than a box, set bold in Obsidian's warning colour
(`p.mod-warning.cs-portable-backup`) because it is the one thing that cannot
be taken back.
The help modal performs no vault reads and has no conversion action.
The **Review conversion** tab is created only by this action, rather than at
startup. A tab restored by Obsidian from an earlier session is closed during
plugin startup, so the review does not remain open across launches.

**Review conversion** groups before/after replacements and dependent
link repairs by file, using the shared `ui/sidebarResults.ts` components. It
lists only what will change: tokens the converter leaves alone are not counted
or mentioned there (see
[Portable Markdown conversion](11-vault-discovery.md#portable-markdown-conversion)). Each
card shows its format and line number, with muted interface-font labels beside
the monospace **Before** source and **After** replacement. Only the separate
checkbox changes inclusion; the format/line label and **Before** text form the
source-navigation button, while **After** starts inline editing. Source and link
changes on the same selected heading line share one card. Each inline token,
including its optional payload, has a separate card and selection; headings show
their complete source line. Both previews wrap without truncation. Rows are drawn 100 at a time, and
the next 100 load as the list scrolls (`ui/loadOnScroll.ts`, finding S10-07):
the list ends in an empty marker (`.cs-load-more-sentinel`) that an
`IntersectionObserver`, rooted in the list's scroller with a screen of margin
below, watches; when it comes into reach the view raises its limit and
redraws, and the observer moves to the new marker. A zero-height scroller (a
hidden sidebar tab) never loads, and the view stops watching on every redraw
and on close. Where the window has no `IntersectionObserver` (the tests' fake
DOM) the list keeps its **Show 100 more** button. Search does the same with a
private virtual scroller; there was always a button until 2026-10-24. A long
list does not slow the editor down, because a file group far from the screen is
parked, drawn as an empty box of the same height
([Vault discovery § Parking far groups](11-vault-discovery.md#parking-far-groups)).

**The top of both sidebars is drawn as Obsidian draws the top of its own panes**
(`ui/sidebarFrame.ts`, finding S10-05). Each pane has one small icon button,
`addSidebarIconButton`: a `.clickable-icon.cs-sidebar-icon-button` (Obsidian's
icon button, its `aria-label` also its tooltip) plus a Tab stop and Enter/Space,
at the **end of the pane's first row**, beside what it belongs to. Find
callouts has the format filter (`filter`), at the end of the type field's
`.search-row`: it opens Obsidian's HTML menu (All formats, then each format, a ✓
on the current one) under the button, as Search's sort button does, and is
lit (`.is-active`) while a format is chosen; the view closes an open menu when
it closes. Review conversion has help, at the end of the Convert row. Each view
draws its button with the rest of its frame (`createOccurrencesFrame(content,
onFilter)`, `createPortableConversionFrame(root, onHelp)`), so a language
change, which draws the frame again, relabels it, and closing the view takes it
away with the content. Until 2026-10-27 the button had a row of its own above
the fields, Obsidian's nav header (`createSidebarNavHeader` prepended
`.nav-header > .nav-buttons-container` to the view's `containerEl`, where
Search, Backlinks and Outline put theirs, so that Obsidian's phone rules moved
the buttons to the bottom of the drawer): a whole row for one icon. Under it,
the content's fixed part: Find callouts' type field in Obsidian's `.search-row`;
Review conversion's **Convert selected** across the pane in a row of its own
(`.cs-portable-convert-row`, with help at its end); and in both, the count over
a single line, Obsidian's `.search-results-info >
.search-results-result-count` (a live region). Until 2026-10-24 each pane began
with a large bold title (now only the tab's name, its tooltip on a computer, as
for Search), a sentence (the conversion one says what **About conversion**
already opens with; neither is shown now), the format as a second field beside
the type field, and the count between two lines.

**A note's group can be folded** (`ui/sidebarResults.ts`, `ui/sidebarFold.ts`).
The title row is Obsidian's tree row (`.tree-item-self.search-result-file-title`)
holding two controls: the fold triangle, a bare `div.tree-item-icon.collapse-icon`
with `role="button"`, a Tab stop, Enter/Space and `aria-expanded`, named by the
note's name (`aria-labelledby`, never `aria-label`, which would also be a
tooltip over the triangle), and the note's name, the `button[data-action="file"]`
that opens the note. The row gives its padding to the name button so the whole
row is one click target; the triangle sits over the start of it. Folding
toggles `is-collapsed` on the group, the triangle and `aria-expanded` **in
place**: nothing is drawn again, so nothing flickers and the list keeps its
scroll. The memory of which notes are folded is a `SidebarFold`, one per
sidebar (`OccurrenceResults.fold`, `PortableConversionNavigation`), keyed by the
note's path, because both sidebars draw every group again from scratch on every
change; a group is drawn folded again while its path is in it. Find callouts
clears it when a new search starts (`resetResults`: a new type or format);
Review conversion keeps it through a rescan. It is never saved with the layout.
`revealSidebarCard` scrolls to the **title row** when the row it was asked to
show is inside a folded group (it has no size), and never unfolds anything.
**Right-to-left:** the triangle is Obsidian's own, and Obsidian turns it by
`.collapse-icon.is-collapsed svg.svg-icon { transform: rotate(calc(var(--direction)
* -1 * 90deg)) }`, where `--direction` is 1, or -1 under `.mod-rtl` / `[dir=rtl]`:
folded points right in a left-to-right window and left in a right-to-left one,
with nothing of the plugin's to turn it. The row's padding is written with logical
sides (`padding-inline: 24px 8px`), so the room for the triangle is on the side
the triangle is on. (Two traps found drawing it: `--direction` is set on
`body`/`.mod-rtl`, so a `dir` on `<html>` alone leaves the body's 1 in force; and
Obsidian also mirrors every other `svg.svg-icon` under `.mod-rtl`, which is how
the ? is mirrored in Arabic and Persian and not in Hebrew, by Obsidian's own
`[lang="he"]` exception.)

On Review conversion's count line, a master checkbox before the
summary has empty, indeterminate and checked states. Clicking an empty or partial
selection selects all; clicking the fully checked state clears all choices.
The indeterminate dash uses Obsidian's checkbox fill and marker colors so it
matches the checked mark across themes.

**Every change between those states is animated** (styles.css, "Review
conversion's boxes"; the same boxes are on every row). The tick is two thin bars
(`::before` the short stroke, `::after` the long one) that grow from the end they
start at, the minus is a `background-size` that grows from the middle, and the
fill is a colour transition. Order is carried by the delays, written on the state
a change arrives at (a transition takes its timing from the new state): empty →
tick fills, then draws the short stroke, then the long one; tick → empty takes
the long stroke back, then the short one, then fades the fill; empty → minus
fills and grows the bar; minus ⇄ tick shrinks the bar as the tick is drawn, and
takes the tick back before the bar grows. Obsidian's own tick (a data-URI mask on
`:checked::after`) is replaced, since a pseudo-element that vanishes with
`:checked` cannot be animated away, and the stylesheet carries no data URIs.
Reduced motion turns all of it into an instant change. The select-all box is a
single element, so its properties animate by themselves; a row's box is drawn
again with every change (`portableConversionRows.ts` empties the list), so
`renderPortableConversionRows` remembers what each box showed when it was last
drawn (`tickedWhenDrawn`, by change id and not read from the page, because a
click has already turned the old box over), draws a box whose answer changed as
it was, reads `offsetWidth` once so the browser works that look out for all of
them, and then turns them over (`tests/portableTickAnimation.test.ts`). The
selection takes **two lines** beside
the box: "74 of 74 replacements selected" and, under it, "3 heading links to
update", the second only while there are links (`frame.summary` and
`frame.links`, `hidden` when empty). The two halves are one translated sentence
cut at its ` · ` (`splitSelectionSummary`), which every language's sentence has
(`tests/sidebarFrames.test.ts` reads all 31); the box lines up with the first
line, which is given the box's height.

**The icons of a row, and a clicked row.** A Review conversion row's pencil and
reset arrow show while the pointer is on the row, while one of them has the focus
(`.cs-portable-card-actions:focus-within`, so Tab can find them) and while the
row is being edited. They used to show while *anything* in the row had the focus
(`.cs-portable-change:focus-within`); a click on a row focuses its source button,
so the icons stayed lit on the last row clicked after the pointer had moved to
another. And clicking a row no longer draws every row again:
`PortableConversionNavigation.navigate` marks the clicked row in place (`mark`),
drawing again only if that row is no longer on the page. Drawing again built the
row under the pointer anew, whose icons start hidden, so they vanished and faded
in again a moment after the click. (Any other redraw, a changed selection, still
does.)
Occurrence filters have localized accessible names without visible labels.
Each fixed toolbar sits outside its own results scrollport, so controls
stay visible without a measured sticky offset. Keyboard focus has a ring; a
pointer press adds none.
The shared summary owns equal block padding between its top rule and the toolbar's
bottom rule; the toolbar adds no trailing padding. The conversion checkbox shares
the summary's center alignment and clears the host's positional checkbox offset.
**Both sidebars draw a note's results as Obsidian's Search pane draws a file**
(`ui/sidebarResults.ts`, findings S10-03, S10-04 and S10-V1): the group is
`section.tree-item.search-result`, its title row a
`button.tree-item-self.search-result-file-title.is-clickable` (the path without
`.md`, then the count in a faint `.tree-item-flair`; the open note's row takes
`.is-active`, Obsidian's active-item fill), and its results sit in one
`.search-result-file-matches` box with a thin line between rows. A Find
callouts row is a `button.search-result-file-match` (the whole row jumps to the
callout; Obsidian's hover and tap tint); a Review conversion row is a plain
`.cs-portable-row` with the same padding and line but no hover, because it is
not a control itself. Both title and Find rows are real buttons, so styles.css
takes Obsidian's button face off them and restates the tints that face would
otherwise cover (`button:not(.clickable-icon)` paints at (0,1,1)). The title
does not stick, and the list spans the pane with Obsidian's 12px side inset.
Every note's group is set off from the one before it by the 8px under that box
(`.search-result-file-matches`' bottom margin), and the first group takes the
same 8px as a top margin (`.cs-sidebar-file:first-child`), so its title row does
not sit flush under the line above the list. It is a margin on the group, not
padding on the scroller, so a list with no group in it (the centred "nothing
found" line) stays in the middle. Until
2026-10-24 each result was a bordered card, the cards stood in a two-column grid
at 680px, the list was a centred 1000px column, and each file heading was a
grey band that stuck to the top.

`portableConversionNavigation.ts` shares active-file tracking and source opening
with occurrences via `ui/sidebarActiveFile.ts` and `ui/sidebarNavigation.ts`.
Fingerprint plus source-line validation preserves repeated-line identity;
changed documents may relocate only a unique unchanged line. Navigation never
modifies text or conversion choices, and stale asynchronous selections cancel.
Both sidebars open a note at its beginning when its file heading is clicked;
its count appears as a faint number at the end of the file's line, drawn like
every other count (see [Faint counts](#faint-counts---how-many-as-obsidians-search-shows-it)). The
shared file-heading button uses its visible name and count as its accessible
label, without a redundant hover tooltip. Navigation scrolls a source into view
and flashes it without selecting it or focusing the editor (see the occurrence
navigation notes in [Vault discovery](11-vault-discovery.md)); the conversion
leaf passes itself as the `origin`, so its drawer closes on a phone. The shared
`ui/sidebarSelection.ts` keeps the clicked card current until the editor's
selection differs from the one it landed on, or the document changes, without
polling. Subscriptions are released when the active card changes or the sidebar
closes. Both sidebars follow the caret through the shared `ui/sidebarCursorSync.ts`
(see "Cursor-follow" in [Vault discovery](11-vault-discovery.md#cursor-follow));
Review conversion's lookup is `portable/portableRowAtCursor.ts`, and
`PortableConversionNavigation` owns its hold, its drawn-rows map and the mark.
The summary line drops its heading-link half when `plan.linkCount` is 0
(`portable.selectionSummaryNoLinks`), rather than saying "0 heading links".

`portableConversionWatch.ts` listens only while open, debounces changes by 350 ms
and invalidates affected cache entries. Stale previews immediately disable
conversion. Progress shows only after 600 ms, so brief refreshes show nothing:
then Obsidian's thin loading bar (`.is-loading` on the results shell, drawn by
app.css) runs across the top of the results while the list stays sharp, and the
overlay's words go only to a screen reader (it is a visually hidden live region;
until 2026-10-24 it covered a faded, blurred list). Persistent errors and
recovery guidance have their own line in the result scrollport, in the warning
colour with no box; "nothing to convert" instead wears Obsidian's quiet
`.search-empty-state` (finding S10-08). Exact unchanged row identities preserve
selection; new or edited rows require fresh selection. Closing releases events,
timers and preview state. Locale changes redraw the view without losing choices.

Each editable source row has a pencil at the end of its first line, an
Obsidian icon button at a list row's icon size (`--icon-xs`, larger on mobile;
finding S10-11, it was forced to 12px until 2026-10-24). It fades in on hover or
focus within the row and remains visible for touch input. The
pencil, the replacement text, and the source card's icon-bearing Obsidian context
menu all start the same inline edit through `portableConversionCustom.ts`.
The `rotate-ccw` restore button beside the pencil is available only when the
current replacement differs from the automatic default. During editing its
visibility follows each keystroke, so returning to the default immediately
hides it. It discards a dirty draft and restores the last saved value, or
restores the default when the current value is already saved.
`portableInlineReplacement.ts` edits **After** inside the card and keeps the
read-only **Before** row visible, without separate Save or Cancel buttons.
Entry selects all editable text and keeps the field focused without opening or
scrolling the note. The row being edited takes Obsidian's selected-item tint
(`--nav-item-background-selected`, the accent at 15%); the previous
source-navigation mark clears, so only one row is marked. The current row - the
one the caret is in, or the one just clicked - takes the grey fill and normal
text Obsidian's Outline gives its current heading (`--nav-item-background-active`,
finding S10-09): on a Find callouts row through its `aria-current`, on a Review
conversion row through `.is-active`, which `PortableConversionNavigation.mark`
sets beside the body's `aria-current` so the fill takes in the checkbox. Until
2026-10-24 both were an accent outline over an accent tint. Replace in vault's
rows are `.tappable`, so a phone shows Obsidian's grey press on them (S10-V2).
Checkbox inclusion is unchanged. Source navigation remains on the format/line
label and **Before** text.
The monospace input inherits the row background and removes the host's input
border, shadow and outline. Both diff rows use the same explicit font sizing
and label column so their source text aligns. Under the pointer, **After**
takes the neutral fill Obsidian gives an editable property value; while it is
edited, the field looks like a file being renamed in the File explorer - a thin
`--background-modifier-border-focus` ring that turns accent while it has the
keyboard, with no tint. Keyboard focus on the source and After buttons is
Obsidian's grey ring. (Until 2026-10-24 hover and editing were accent tints with
a glow.)
`portableReplacementEditor.ts` exposes one value for the selected inline token,
without surrounding source words. Replacement text wraps in full; heading rows
expose only the title for editing, keeping the visible container prefix, heading
level, and closing markers fixed. These fixed markers cannot shrink away.

Enter or clicking outside saves, and Escape cancels. Enter and Escape are ignored
while an input method is composing; clicking outside commits the final composed
input before closing the field.
Newline insertion and multiline pastes are blocked; save validates the values
again before rebuilding the reviewed proposal. The editor snapshots the opening
value; finishing an unchanged draft exits editing without mutating the review.
Escape or the active card's return-arrow button on a dirty draft restores its
last saved/default preview. An outside click closes an invalid draft and shows
a notice rather than leaving the input's editing appearance active. Convert
stays dimmed until the active draft is saved or cancelled; pressing it says so
and leaves the draft open (see [Blocked main buttons say why](#blocked-main-buttons-say-why)).
Drafts survive redraws; they are cancelled when the current review becomes stale or closes.
A **Custom** tag sits beside the format/line label. It is Obsidian's flat flair (`.flair.mod-flat`), the same tag as **Default** on callout rows. Outside an
active edit, the return-arrow button restores the default replacement, as does
the context-menu action; both rebuild dependent heading-link repairs. Saved
edits remain in the review until the separate conversion confirmation is accepted.

A separate `ConfirmModal` describes irreversible changes and partial-failure
behavior. Revision guards prevent a stale or reopened view's confirmation from
writing. Closing after conversion starts does not cancel writes; a notice still
reports the outcome. Partial writes retain an exact recovery plan with fixed
choices, including pending link-only changes. See
[the conversion contract](11-vault-discovery.md#portable-markdown-conversion).

## Callout rows in the settings

### A callout row is an Obsidian setting row

Every row of the three callout lists is an Obsidian `Setting`
(`.setting-item.cs-callout-row`), filled by `drawCalloutRow` in
[`CalloutRowRenderer.ts`](../../src/settings/sections/CalloutRowRenderer.ts)
(finding S2-14). The pages hand it the `Setting` Obsidian made for the row
(`calloutRow` in `declarative/calloutPages.ts`) and may draw it again, so it
returns what undoes the two things it puts outside the row's controls (the
icon at its start and the right-click listener). Its ✎ takes an optional `editBlockedReason`: while there
is one, ✎ is dimmed and a press says it (`addBlockableIconButton`).

| Part of the row | What it holds |
|---|---|
| First child | The callout's icon, `.callout-studio-row-icon`: our own element, muted at Obsidian's small icon size, because `Setting.setIcon` takes Lucide names only and a callout's icon can be an emoji, a picture or another library's glyph. It is not Obsidian's `.setting-item-icon`, which a box whose rows declare no icon (`.mod-no-icon`) hides. Its 16px to the name is the row's `gap` (see *What a narrow row gives up*); its own `margin-inline-end: 0`, on a selector with an extra class, outweighs Obsidian's `.setting-item > *:first-child` margin, which would add a second 16px on a phone, where that gap is already Obsidian's. The element is reused by the next draw of the row (`rowIconElement`), never removed by the row's cleanup, which Obsidian also runs while a page it is leaving is still sliding away. It also keeps its drawing when the icon did not change (`paintRowIcon`, the same key and memo as the icon sweep's, `icons/iconPaintMemo.ts`): Obsidian draws every row of the page again on each update, 755 of them in a large vault, for a change to one. A download in progress, a failure and a picture of the user's own are drawn every time. |
| `nameEl` | The display name, then the tag as Obsidian's `span.flair.mod-flat`: **Default** on the callout that is the vault's fallback and **Auto** on a callout that follows the default fallback style (`settings.fallbackTag`, `settings.fallbackTagAuto`; the second is one short word in every language, [Localization](17-i18n.md)). The name element is a flex row on **one line** (`display: flex; align-items: baseline; gap`). The words are a `span.cs-row-name`, because only a box can end in "…" and a flex row wraps loose text in a box nobody can style: `min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap`, and `unicode-bidi: plaintext`, which is what Obsidian gives a name, kept so that a Hebrew name in an English window is cut at its own end. The tag is `flex: none`. So the name takes the room the tag leaves and ends in "…" when it needs more, and the tag is never pushed under it; a row's height does not depend on its name, and a long name is cut rather than made room for, on purpose. The tag keeps the baseline alignment raised 1px (`top: -1px`, which puts its capitals level with the name's letters), `margin-inline-start: 0` (Obsidian's `.flair` margin is the row's gap now) and a vertical padding of 1px, not 2px, which is as tall as an inline tag looks and keeps a flex item from making its line taller than the name. No tag on a theme's row. |
| `descEl` | Every spelling as `code.callout-studio-row-syntax` (`[!id]`), sorted, in a flex row (`display: flex`, `gap` where the space between two ids was; the space text nodes stay in the DOM but a flex row draws none). One line (`white-space: nowrap`); each chip is shown or hidden whole. **The ids are what gives way first, and a whole id at a time.** `fitIdsLine` (`idsLineFit.ts`) shows the ids that fit and a `+N` chip for the rest, rather than leaving the browser's own "…", which says nothing about how many are missing and has no element to carry a tooltip. **An id is never shown cut in half:** the first id that does not fit goes into the count with every id after it, and when not even the first fits beside the chip the line is the chip alone (`+3`). The one exception is a row with a single id, which has no count to go into: it gets `cs-id-lone` when drawn (`flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis`), so the **page** shortens it with "…" when the row is too narrow, and the fitter only gives it an `aria-label` with the whole id while its text is wider than its box (`scrollWidth > clientWidth`). It is not measured like the other ids because shortened, its box is no longer as wide as the id is, and the observer would report the shortened width: the fit read a lone id fitting, took the class off, read the natural width, put it on again, and a window resized live disagreed with one drawn fresh. **The `+N`** is a `code` with **both** `callout-studio-row-syntax` and `callout-studio-row-more` (the first class gives it the ids' look, with no copy of their CSS to drift; the second only `user-select: none`). It is there from the start, in the `cs-id-cut` state while it counts nothing, and every id and the chip use that state rather than `display: none`: `position: absolute; visibility: hidden`, out of the line's flow (no room, no gap) and invisible, but with a box at its natural width, which `display: none` does not have. The line is `position: relative`, so it is the containing block of those boxes and clips them, and they add nothing to the page's scroll width (checked in the real settings window). While the chip counts nothing its text is the widest count it can be asked to show (`+9` for ten ids, since ids per callout are capped at `MAX_TAGS_COUNT`, ten, and one digit is all a count beside a shown id ever has), so its width does not depend on what it said before. Tooltips are `aria-label`s (Obsidian shows the nearest): the chip's lists the hidden ids, each in a left-to-right isolate so a right-to-left tooltip cannot turn `[!id]` into `[id!]`; an id that is all there has none. **The fit is arithmetic on sizes the observer reports.** `countShownIds` takes each id's natural width, the `gap` (read once per call from the line's computed `column-gap`), the line's width and the chip's, and says how many ids show; direction does not matter because only widths count. The fitter keeps, per line, the width the observer last gave for the line, for each id and for the chip, and a fit is arithmetic on those: nothing is read from the layout. The observer reports a box's size once when it is first shown and again only when it changes, so a resize (only the lines change width) is one call with all the rows and no id is measured again, while a change of font (the window becomes a phone's) makes the ids report new widths and the line is fitted to them. A box that is not shown reports 0, which says nothing about its width, so the last width is kept (a hidden row is not fitted, and is when shown). A line decides from its sizes alone and writes nothing when the result is what it already shows (`line.showing`), so most rows on most resizes cost an addition. All lines of one call are decided before any is written, the lone ids' `scrollWidth` being the one read. The row's text column is `flex: 1 1 0` and its buttons `flex: 0 1 auto` (Obsidian sizes both `1 1 auto`, which makes the text as wide as its content plus half the spare room), so that the line's width is the room the buttons leave and does not depend on what is in it. **Which window watches it** (found in Obsidian 1.14.5): the settings are a popout window, and a row is drawn by the main window and moved there afterwards, so asked at draw time the row's window is the main one, and a `ResizeObserver` made by the main window never hears the popout being resized (an observer on the same element made by the settings window heard every resize, one made by the main window none; the line was fitted once, when the page opened, and never again, which showed as ids cut in half and a `+N` pushed out of sight until the page was drawn again). So there is **one observer per window** (`IdsFitter`, in a `WeakMap` by window, taken down with its last line), a line is registered with the window that shows it, and `followWindow` (`utils/elementWindow.ts`, Obsidian's `onWindowMigrated`) moves it to the new window's fitter when Obsidian says it has moved. |
| `controlEl` | The two colour circles (the accent in front, the background behind, a third for a gradient), then ✎ (👁 on a theme's row) and ⋮ (`addRowMenuButton` in `calloutRowMenu.ts`), both `addExtraButton`: a `div.clickable-icon.extra-setting-button` with `tabindex=0`, whose tooltip is its label. The circles are what a **computer** shows; on a phone or an iPad (`.is-mobile`) they are `display: none` at every width and the colour is in the icon and the name (*One line each, and where the colour goes*). |

Being a setting row is what gives Obsidian's keyboard walk (↑/↓ or j/k
between `.setting-item`s, Enter into the row's first control) and its inset
focus ring. A right-click anywhere on the row still opens its ⋮ menu at the
pointer.

**One line, because the rows are in a list box.** Two Obsidian rules turn a
lone `.setting-item` into a column, `@container (max-width: 400px)` in a narrow
tab and `.is-phone .modal .setting-item` on a phone, and both leave rows in a
`.setting-group.mod-list` alone. Every callout row is in one: My callout types
is a `type: "list"` box, to which Obsidian adds `mod-list`, and the Built-in
and theme pages draw their own `mod-list` box. Obsidian's list rules then give
the row one centred line, the control column at its own width, and the
list-row padding (8px 16px, 12px 20px on a phone). Until 2026-10-25 styles.css
copied those rules for the old page's rows, which sat in no box; the copies
are gone. What styles.css still adds: the row's `gap`, its one-line name and
ids and its colour rules (below), and the iPadOS paint workaround on its icon
buttons (`translateZ(0)`, kept from when the row was a size container, since
nothing here can run on an iPad to show the bug gone) sits in `:where()`, so
Obsidian's own icon transforms win: on macOS and iOS ⋮ is turned on its side,
as in Obsidian's More options. The colour dots' ring takes the box's colour
(`--cs-surface` is `--setting-items-background` inside a settings box, finding
S7-03). `tests/calloutSettingRow.test.ts` holds the shape and the CSS; the page
tests check that the rows are in a `mod-list` box.

**Only the rows on screen are laid out.** Obsidian draws every row of a list
before it slides the page in, and nothing in its API defers that (an `items`
page has no lazy or virtual mode in 1.13). My callout types holds whatever a
scan found, and a big vault's was 754 rows. The row is therefore
`content-visibility: auto` with `contain-intrinsic-size: auto 53px` (57px under
`.is-mobile`), the row's real height measured on 2026-11-02. In Chromium with
Obsidian 1.14.5's stylesheet the layout of 754 rows went from ~55 ms to ~5 ms;
a row stands at that height until it nears the screen, then at the one it was
last drawn at. This works here, where it did not for the Quick insert window
([Editor integrations](10-editor-integrations.md)), because every row of a list
is one height, so nothing jumps. A row's ids line is fitted as it comes in: its
boxes report their sizes once they are laid out, and Chromium does that before
the frame that first shows the row. **Not on iOS or iPadOS** (`.is-ios`
sets `content-visibility: visible`): WebKit saved nothing (~80 ms of layout
either way) and lays a row out one frame after it comes on screen, so the ids
would be fitted a frame late. The rule does nothing for the cost of each key
press in the editor, which is what the sidebars' lists needed ([Common
pitfalls](23-common-pitfalls.md#everything-drawn-in-the-window-slows-the-editor)).

### One line each, and where the colour goes

A row is three parts, the icon, the text and the buttons, and each of the two
text lines is one line, at every width. The same few rules everywhere (the same
list heads the *Callout List Rows* block of `styles.css`):

1. **The name** is one line. It ends in "…" when it does not fit, and its tag
   stays beside it.
2. **The ids** are whole ids, as many as fit, then a `+N` for the rest
   (`fitIdsLine`, above). An id is never cut in half; only a row with a single
   id shortens it.
3. **The colour is shown by device, not by width.** On a computer, as the two
   circles before the buttons. On a phone or an iPad (`.is-mobile`, which
   Obsidian also sets for its desktop mobile emulation, so "phone mode" on a
   computer is covered) the circles are gone at every width, and the colour is
   in the row itself: the icon is drawn in the accent on a `--radius-m` tile of
   the background with the circles' ring (a small callout, as it looks in a
   note), and the **name is in the accent**, as a callout's title is in a note.
   `drawCalloutRow` sets `--cs-row-accent` and `--cs-row-bg` on the row
   (`renderColors`: the same two colours the circles show, so a Studio row's
   stored colours, a theme row's measured ones, none for an unmeasured theme
   row, and no `--cs-row-bg` for a callout that paints no background), and the
   `.is-mobile` rules paint with them. An icon that failed to load keeps its red
   (`:not(.is-error)`). The variables are set or removed on every draw, because
   the same row element is drawn again. A computer's row has no colour in its
   text.

Until 2026-10-31 the circles gave way by width instead (under 450px of
container). That hid them on every phone, and a rule that depends on width
makes the same callout look different from one window to the next, so the
colour now follows the device. The row was a size
container for it and is not any more, which also retires the pitfall of [a row
that meets Obsidian's unnamed container
queries](23-common-pitfalls.md). The name in the accent was Niv's choice after
both were drawn. A pale accent (`#ffe066` on white, a light grey on white) is
hard to read as text, and the tile alone already carries both colours, so the
name is the first thing to drop if that bothers someone.

The name is cut, not wrapped, because a long name is not something the list
should make room for. Before 2026-10-31 it wrapped (a row could be five lines
tall) and its tag dropped under it, standing hard against the lines above and
below. The editor does not limit the length of a display name (an import does:
`MAX_DISPLAY_NAME`, 80). The tag is also one word now, so it leaves the name
most of the line even on a phone: `settings.fallbackTagAuto` was "Default
fallback" and is "Auto" in English and one short word in each language
([Localization](17-i18n.md)).

The row's `gap` is `12px 16px`: 16px between the icon, the text and the buttons
on every device. Obsidian gives a phone's rows this gap and a computer's none,
so an id ran right up to the circles there; and the icon's own
`margin-inline-end` is `0`, because Obsidian's margin after a row's first child
would add a second 16px on a phone. (`column-gap` is not available: the repo
rule that keeps multi-column properties out of `styles.css` also forbids it.)

How it was checked, in two places.

*In the real Obsidian 1.14.5*, a second, isolated instance driven over the
debugging port (the recipe is in the project's memory notes): the plugin's real
build, with 40 and with 600 test callouts (some with ten ids, one very long id,
a lone id of 90 characters), the settings window resized for real with
`electronWindow.setSize`. Before the fix: no observer call at all after the page
opened, ids cut in half and `+N` out of sight at 600px. After it: one observer
call per resize for all the rows, in both directions, and the page equal to a
freshly drawn one. The cost with 603 callouts, dragging 900px to 600px in 31
steps: 30 calls of 603 entries each, median 0.5 ms, average 0.85 ms, slowest
3.1 ms, about 26 ms of the plugin's time for the whole drag. (The first version
of the fix, which read every box's width on each call, took 7-8 ms a call: one
call for all the rows, but still about 4,000 reads. The design before it never
got to run in the real window, and read and wrote row by row, which is what
makes a long list's resize heavy.) A jump of all 600 rows at once (900px to
600px) takes 3.5-5.5 ms. No element in the window scrolls sideways, and the page
screenshots at 600, 700 and 900px show the names ending in "…", the ids whole,
and the `+N`. A second audit wrapped `ResizeObserver` in both windows and listed,
page by page, every observer the plugin makes and whether the elements it
watches are in the window that made it; it is what found the style preview's
pin (below).

*In headless Chromium* with Obsidian 1.14.5's `app.css` (the guide's offline
runtime), sixteen awkward callouts (one id, many ids, very long ids, a long name,
a one-word name longer than the row, a Default tag and an Auto tag, Hebrew, CJK,
no icon, a pale accent, a lone very long id) at every width from 800px down to a
280px row, on a computer in light and dark, on an iPad, on a phone in light and
dark, in a right-to-left window, and in Spanish (928 rows), asserting that
nothing overflows its row, every name is one line, every row is as tall as the
others, the tag is beside the name and never over it, no id with others beside it
is cut, the `+N` is whole, inside the line and counts the hidden ids, a lone
shortened id says what it is, the text is at least 8px from the buttons, a
computer shows circles and no tile, a phone or an iPad shows the tile, the accent
name and no circles, and that a window resized to a width draws what a fresh
draw at that width does. That last check is what found the lone id's feedback
loop. A row narrower than about 280px (a 320px phone's is 288) is best effort: the
text column is under 100px. `tests/idsLineFit.test.ts`,
`tests/elementWindow.test.ts`, `tests/calloutSettingRow.test.ts` and
`tests/rowTagLocales.test.ts` hold what that check found; the fake DOM has no
layout, so `tests/support/fakeWindows.ts` gives a window an observer that a suite
calls with sizes, and a second window to move an element into.

The same mistake was in `pinBelowTitlebar` (`declarative/stylePages.ts`), which
keeps a style preview's box under its page's title bar: its comment said the
observer was made by the preview's own window, and it was made by the main one.
It uses `followWindow` now. (The other observers on those pages that the audit
lists as made by the main window are CodeMirror's own, inside the embedded
editors, and are not the plugin's.)

### List rows and hover

A list row is not clickable; only its buttons are. So, as in every Obsidian
list, the row itself never changes on hover: no fill, and no transition to one.

That holds for Obsidian's own list rows, and for the plugin's two row kinds,
both Obsidian setting rows: callout rows (`.cs-callout-row`) and Version
history rows (`.cs-recovery-row`).

Pointing anywhere on one of those two only sharpens that row's own icon
buttons, through one shared rule. It sets
`--icon-opacity: var(--icon-opacity-hover)` on the row's `.clickable-icon`s and
drag handle, and skips any that are disabled or `aria-disabled`. Obsidian's
own `.clickable-icon svg` already reads `--icon-opacity`, and the drag-handle
svg reads it too.

Every hover in `styles.css`, the button fills and the red delete included,
sits behind `@media (hover: hover)`, as Obsidian's do. On touch, WebKit replays
the last tap's hover onto whatever row lands under it after a re-render, which
is how a dragged row on an iPhone used to light up. `tests/rowHoverStyles.test.ts`
holds the rows; `tests/styleGuards.test.ts` holds the gate for the whole file,
with two more of Obsidian's habits (finding GAP-04): focus rings are grey,
never the accent colour (one exception, Review conversion's After field, which
copies Obsidian's file rename), and a disabled control dims to Obsidian's value
for its kind: a button 70%, an icon button 40%, a field or switch 50%. The
plugin's dropdowns are drawn as Obsidian's `.combobox-button`, a `<button>`,
so they take 70% (50% until 2026-10-25).

The callout and palette rows' buttons are Obsidian's own icon buttons:
a callout row's are `addExtraButton`s (`div.clickable-icon`, see above), and a
palette row's are `<button class="clickable-icon">`. Obsidian supplies their
size, corners, colour, gated hover, 3px focus ring and dimmed state.

- **The menu button** is `more-vertical` (⋮), Obsidian's "More options" icon.
- **The drag handle** of the menu and library lists is a `.clickable-icon` too,
  and so are the library action and the image panel's add button.
- **Quick insert's source filter** is a funnel (`filter`), an icon-only
  `SelectDropdown` whose button is a `.clickable-icon`, lit
  (`--icon-color-active`) while the list is narrowed to one source, as the format
  filter beside Find callouts' type field is.
- **Quick insert's Edit and Insert** are `.clickable-icon`s too. A blocked
  Insert wears Obsidian's dimmed icon state. Its keyboard- or pointer-active row
  is ringed the way Obsidian rings a focused setting row (2px of
  `--background-modifier-border-focus`), and its cursor is Obsidian's
  `--cursor`.

### Corners

The plugin rounds its chrome the way Obsidian does: from tokens, never from px.
A box, card, row, banner or panel takes `--radius-m`, and a small chip or
badge takes `--radius-s`. A plain button takes `--button-radius` with
`--button-corner-shape`, and a field keeps the input tokens. Every rule with a
radius also sets a `corner-shape` (`--corner-shape` unless the component has
its own). That gives superellipse corners on macOS, and the touch radii on
mobile.

A few things are exempt:
- 0 and 50% (circles);
- callout rendering in notes;
- Obsidian's own literal 5px drop slot;
- the two chips that later become Obsidian's own components.

`tests/cornerShapeStyles.test.ts` holds this. Its exception list can only
shrink.

### Callout row menu groups

All three row menus are built by plain functions: `buildBuiltInRowMenu` and
`buildUserRowMenu` in `CalloutRowActions.ts`, and `buildThemeRowMenu` in
`themeRowActions.ts`. Every item carries one of the four sections in
`rowMenuSections.ts`, in this order:

| Section | Items |
| --- | --- |
| `find` | **Find callouts** with its faint count, alone: the one item that leaves Settings |
| `notes` | **Replace in vault…**, **Convert uses to plain text** |
| `callout` | **Duplicate**, **Reset to default**, **Use default fallback style** |
| `danger` | **Delete**, with `setWarning(true)` |

Obsidian's `Menu.sort()` (read from 1.14.4) draws a divider between two
top-level sections and keeps no empty section, so a row that offers nothing in
a group gets no stray line. It orders sections by the first item added to
each, so the builders add items in drawing order. A plain `addSeparator()` and
an item with no section both land in an unsectioned bucket that sorts below
every section, with no divider before it. That is why these menus use no
`addSeparator()` and why `tests/calloutRowMenuGroups.test.ts` fails on an item
without a section.

When a finished scan shows that no note uses the callout, the usage item is
greyed out with `setDisabled(true)`, keeping its "(0)" readable. A partial scan
never counts as unused. **Replace in vault…** and **Convert uses to plain text**
are left out when the count is already known to be zero. When they were added
while the count was still unknown, `disableWhenUnused` (`usageMenuItem.ts`)
attaches them to the usage item's subscription, which greys them out if the
count lands on zero and lights them again if a use appears. Nothing is ever
removed or regrouped once the menu is shown.

The row's **Use default fallback style** action uses the Lucide `rotate-ccw`
icon, matching the built-in **Reset to default** action. It calls
`CalloutRegistry.convertToFallback()` to follow the current fallback and
subsequent changes to its style. The action asks nothing first, so
`settings/sections/fallbackStyleAction.ts` ends it with a notice carrying
**Undo**, as Delete does. Undo restores a clone of the row taken before the
conversion. Because `registry.update` merges, it clears by name every field the
fallback brought that the old row lacked, such as a gradient or text colors.
It does nothing while saving is paused, and nothing once the row has moved on:
deleted, renamed, edited (`customized`), or made the fallback itself.

### Callout row menu lifetime

Custom, built-in and theme row actions all use
`settings/sections/calloutRowMenu.ts`. `openCalloutRowMenu(ctx, trigger, build)`
takes a `RowMenuTrigger`, which says how the menu was asked for and so where it
opens (findings S2-11, S2-12):

- **`{ kind: "button", button }`** - the row's ⋮ was pressed (mouse, Enter or
  Space). The menu opens as Obsidian opens **More options** in Installed
  plugins: `menu.setParentElement(button).showAtPosition({ x: rect.x, y:
  rect.bottom, width: rect.width, overlap: true, left: true })`. Obsidian then
  marks the button `has-active-menu` (the pressed look of a `.clickable-icon`)
  while the menu is open, and ignores a press on it as a click outside. So a
  second press is a toggle: the opener sees `has-active-menu` and returns, and
  Obsidian's own click handling closes the menu. Without `setParentElement` the
  press closed the menu and the click opened a new one, a visible flicker.
- **`{ kind: "pointer", row, x, y }`** - the row was right-clicked
  (`contextmenu` on `.cs-callout-row`, with `preventDefault`). The menu opens
  at the pointer with `showAtPosition({ x, y })`, as on Obsidian's Community
  plugins rows, and has no parent element.

The opener captures the anchor (the button or the row) and its owner
document/window synchronously, before `prepareUsageMenu(app, anchor, …)` can
await the usage index. One temporary `Component` owns both the pending opening and
the visible menu. A newer row-menu request closes the previous one for that app;
Settings hide/redraw also disposes it.

The document's passive capture listener observes non-bubbling scroll events,
but only changed scroll offsets on the trigger's captured ancestors dismiss
the menu. A scroll event queued before opening, the menu's own scroll area,
submenus and unrelated scrollports do not close it. No wheel/touch gesture is
cancelled, and dismissal never focuses or scrolls the trigger back into view.
This uses actual scroll movement for mouse, touch, trackpad and keyboard alike,
including horizontal/RTL scrolling and momentum. Window resize and
visual-viewport resize/pan also cancel a pending opening or dismiss an open
popup on desktop and tablet. A temporary child-list observer detects a
detached, reparented or moved trigger during incremental list refreshes. The
trigger is rechecked immediately before showing a delayed menu.

On `Platform.isPhone` none of the positional checks exist, for a pending
opening or a shown menu: Obsidian presents a bottom sheet that ignores the tap
position, so nothing positional can make it stale. The scroll, resize and
visual-viewport listeners are not registered, and the trigger is compared by
structure only, never by its rectangle. A real scroll of the list starts with a
touch, and that `pointerdown` already cancels a pending opening
(`prepareUsageMenu`). The phone presentation also hides the keyboard, which
resizes/pans the viewport and moves the trigger. Earlier the checks were only
skipped once the sheet was shown, so a sheet still waiting for its counts could
be cancelled by the keyboard closing under it.

Window blur cancels a pending opening and closes a desktop or tablet popup, but
not a phone sheet once `showAtPosition` has begun. The phone branch of
Obsidian's `Menu.showAtPosition` calls Capacitor's `Keyboard.hide()` (only when
`Platform.isMobileApp`). On iOS that ends editing in the web view, the web view
gives up first responder, and WebKit blurs the window while the sheet is still
sliding in; closing on that made the sheet vanish a moment after it opened on a
real iPhone. Desktop mobile emulation is not `isMobileApp`, never calls
`Keyboard.hide()`, and cannot reproduce it - check on a device. Structural
removal or reparenting of the trigger, orientation changes, pagehide, Settings
disposal and a newer menu request still close the sheet.

Cleanup is idempotent and immediate on explicit dismissal. Obsidian's `Menu`
unloads its old component lifetime while showing, so the unload cleanup is
registered **after** `showAtPosition`. `ui/menuOnHide.ts` also composes cleanup
with the usage item's index unsubscribe: Obsidian's public `onHide` setter
replaces its callback rather than adding one. That callback covers dismissal
before the menu's deferred component load; the unload hook handles normal
closure immediately even when phone hide animations delay `onHide`. Closed
sessions release their references from the Settings disposer and cannot close
a later menu. A stable local menu reference and an active-session check also
allow the host to dismiss synchronously during presentation without dereferencing
the cleared session reference or registering cleanup on a closed menu. No custom
mobile presentation replaces Obsidian's menu.

### Duplicating a saved custom callout

The row's three-dot menu offers **Duplicate** with the Lucide `copy` icon for
persisted, non-built-in definitions. Theme-only definitions are excluded; a
saved custom definition remains eligible when the theme controls its preview.
Duplication reads the stored definition, not the theme's rendered appearance
or a reconstructed editor form, and deep-copies its complete state. Apart from
the new display name, primary ID and aliases, nested styling, flags, metadata
and palette references remain unchanged. In particular, a stale `paletteId`
and its baked colors survive, preserving the editor's **Deleted color** state.

New IDs pass through `sanitizeCalloutIdInput`, so suffixes are `copy`,
`copy 2`, and so on with spaces rather than hyphens. The generated primary ID
and aliases must not collide with any existing primary ID, alias or equivalent
Obsidian attribute spelling, or with one another. Display names are also
unique. Base text is truncated before adding the suffix to stay within the
200-code-unit ID limit and 80-code-unit display-name limit without splitting
a surrogate pair.

The action validates and commits an isolated settings snapshot through
`SettingsWriter.commit`, publishing the registry definition only from its
after-write callback. A completed commit triggers the success `Notice` and
`revealCallout`, which opens My callout types, scrolls to the new row and
flashes it ([26 § Jumping to a row](26-declarative-settings.md#jumping-to-a-row)).
Validation and pre-write failures leave the registry unchanged and show an
error `Notice`. If a final recovery-checkpoint failure occurs after the valid
copy has reached disk and the registry, the action keeps that durable copy,
refreshes the list and shows the error `Notice`. No vault tokens are rewritten.

## Faint counts - how many, as Obsidian's Search shows it

Every heading or line that counts what it holds ends the same way, the way
Obsidian's Search pane ends a file's line with its match count
(`.tree-item-flair`): a small number in faint text at the end of the row, with
no brackets. Niv asked on 2026-10-22 for this everywhere in the plugin (item 57
of the native-look plan); until 2026-10-23 these were a muted "(N)" just after
the title. The places:

- the section titles of the setup comparison in **Version details**;
- the file headings of the **Find callouts** and **Review conversion** sidebars;
- the library headings in Pick an icon's **All sources** grid ("Lucide", with
  its matches after it);
- **Find callouts** in a callout row's menu.

The settings' page rows (My callout types, Built-in callouts, Saved color
palettes) say how many in Obsidian's own way instead: the row's value at its
end, "12 callouts" (`countValue`, `declarative/rowParts.ts`).

[`ui/faintCount.ts`](../../src/ui/faintCount.ts) builds all of them, and
`.cs-faint-count` in `styles.css` is the one rule that places and colours them:

- `appendFaintCount(parent, count)` appends `<span class="cs-faint-count"> N</span>`,
  the number formatted with `toLocaleString(getLocale())`. The space before
  the number is part of the text, so the heading reads - and is announced as -
  "Backups 3".
- The rule is Obsidian's `.tree-item-flair-outer` + `.tree-item-flair`:
  `margin-inline-start: auto` (to the end of a heading that is a flex row; in
  running text it simply follows the words), `padding-inline-start:
  var(--size-4-1)`, `--text-faint`, `--font-ui-smaller`, `line-height: 1`,
  `tabular-nums`, `flex-shrink: 0`, and `white-space: pre` (keeps the leading
  space in a flex row, and the number on one line).
- In a menu row the count floats to the end of Obsidian's `.menu-item-title`
  (`float: inline-end`), which is a block, not a row. The row menu's title is a
  fragment (`usageTitle` in `usage/usageMenuItem.ts`): "Find callouts" and the
  count; a count that arrives after the menu opened fades in
  (`cs-usage-menu-count`). The old `usage.menuCount` key is no longer used.
- Pick an icon's grid takes `groupLabelFor` → `{ name, count }`
  (`GridGroupHeading` in `IconGrid.ts`) and draws the count with the same
  helper; the old `iconPicker.sourceGroup` key ("{{name}} ({{count}})") is no
  longer used.
- The setup comparison's title row keeps the count as its own flex item beside
  `.cs-recovery-section-title`, so a title cut short with an ellipsis still
  shows its count. That row has no flex `gap` - its chevron carries
  `margin-inline-end: var(--cs-disclosure-gap)` instead.

Not every count is drawn this way. **Import valid only (3)** and the icon total
in an icon source's description are part of a button's or a line's own words,
and stay plain text in that label's colour. `tests/faintCount.test.ts` pins the
helper and the rule; each surface's own suite checks that it goes through them.

## Modal chrome - the one shell every window wears

[`src/settings/modalChrome.ts`](../../src/settings/modalChrome.ts) dresses
every Callout Studio window in **Obsidian's own shell for long dialogs**, the
one Obsidian uses for Publish, the attachment cleanup and Keychain. Before the
module existed, different windows had reinvented a sticky title, a pinned
button bar, or neither.

```ts
applyModalChrome(modal, { footer?: boolean }): HTMLElement | null
addCancelButton(bar, label, onClick): HTMLButtonElement
removeModalChrome(modal): void
markStackedWindow(modal): void   // the stacking mark alone, for ConfirmModal
scrollBodyOnly(modal): void      // mod-scrollable-content alone, for ConfirmModal
```

```text
┌───────────────────────────────┐
│ title                       ✕ │  header - fixed, no line under it
│ content …                     │  body - the ONLY scroll container
│                               │
│              [Cancel] [Save]  │  button bar - fixed, no line over it; optional
└───────────────────────────────┘
```

Two of Obsidian's classes do all of it, so the look comes from Obsidian's
stylesheet (and a theme's):

- **`mod-scrollable-content`** on `.modal` takes the window's padding off,
  gives the title `16px 16px 0`, makes `.modal-content` the one scroller with
  `0 16px 16px`, and pins the bar under the body. Obsidian also draws a
  `border-top` on the bar here; the plugin takes it off (below).
- **`modal-button-container`** is the button bar, built as a child of `.modal`
  after `.modal-content`, as `ConfirmationModal` builds it. On a computer it
  lines the buttons up at the end. On a phone or tablet (`.is-mobile`) it
  stacks them full-width in reverse: the main action on top, then Cancel
  (`mod-cancel`, `order: -1`), then a `mod-secondary` item (`order: -2`). On a
  phone it also clears the home indicator.

**Every Cancel is made by `addCancelButton`**, which adds `mod-cancel` (what
Obsidian's own `setCancel()` does). A hand-made Cancel would miss it and stack
above the main action on a phone; `tests/modalChrome.test.ts` fails if a
source file builds one itself. Pick an icon's preview ("Lucide: book-open")
shares the bar as its `mod-secondary` item: at the start on a computer, under
the buttons on a phone.

**No line over the bar.** Obsidian's `.modal.mod-scrollable-content
.modal-button-container` carries `border-top` (and `padding: 16px`). Its short
dialogs - the yes/no question, Settings' pop-ups - are not
`mod-scrollable-content` and draw none, so a plugin window with the line stood
out beside them. styles.css sets `border-top: none` on the bar of a window that
wears `cs-modal` (`applyModalChrome`) or `cs-scroll-body` (`scrollBodyOnly`,
the long **Reset everything** question), at one class more than Obsidian's rule
so the order of the stylesheets does not matter. Both classes are the plugin's
own, so Obsidian's and other plugins' long dialogs keep their line, and the
padding stays as the gap above the buttons. The lines the plugin draws inside
popups - between a picker's groups, above a suggestion list's footer note -
are separators in a list, not this one, and stay.

**The width is Obsidian's dialog width** (`--dialog-width`, 560px, capped by
`--dialog-max-width`) for every window except the callout and palette editors,
whose two columns need 720px (`.callout-studio-editor-modal`, off phones
only), and the welcome splash, which keeps its own. (Commands and shortcuts and
the style windows kept theirs until they became settings pages.) The import chooser, the
export chooser, the plugin import window, the import report, the icon credits
and the conversion help used to set 520-700px each (finding S9-V3, GAP-06); their
classes stay as hooks a user's snippet may target.

**On a phone, the two editors are Obsidian's large-form sheet.** They carry
`mod-lg`, Obsidian's mark for a large form: on a phone its stylesheet makes
the window full width and full height, rounded only at the top, as its own
large forms (Keychain, Publish) are, and keeps the side safe areas. On a
computer or a tablet the class changes nothing (finding S5-09,
`tests/editorPhoneSheet.test.ts`).

**The buttons are Obsidian's**, with no size, padding, outline or dim of the
plugin's own: Obsidian's `button` height and padding, its grey 3px focus ring,
and for a blocked button (`aria-disabled`, see
[Blocked main buttons say why](#blocked-main-buttons-say-why)) its 70% dim.

**What the plugin adds** is only what Obsidian leaves to each dialog
(`styles.css`, "Modal chrome"):

- the surface tokens `--cs-surface` / `--cs-surface-raised` on `.modal.cs-modal`
  (see [Two theme-aware surface tokens](#two-theme-aware-surface-tokens));
- `--cs-modal-inset` (16px, Obsidian's), read by the few bands inside a body
  that reach the window's sides (Pick an icon's source row and grid), and
  narrowed by the setup-details window on a phone;
- **room for the first row's focus ring.** Obsidian's long dialog starts its
  body with no top padding, and a focused field's ring is drawn outside the
  field (2px; 3px for a dropdown), so a scroller would clip it. 4px of the
  title's 12px margin moves inside the body
  (`margin-bottom: calc(0.75em - var(--size-2-2))` on `.modal-header`,
  `padding-top: var(--size-2-2)` on `.modal-content`): the gap stays Obsidian's
  12px and the ring has room. Windows with a sticky band at the top of the
  body (Quick insert, the setup details) set it back to 0 and put it on their
  first child instead, with a selector that repeats the shell's classes to
  outrank it. Pick an icon turns the body's padding and scrolling off
  altogether, since its own grid scrolls under a fixed source row.

**History.** Until 2026-10-23 the plugin drew its own shell: a title band with a
line under it, a wider inset (34-40px) in the editors through a `wide` option,
its own `cs-modal-footer` row whose buttons it resized, outlined in purple and
dimmed to 40% when blocked. Decision 15 of the native-look plan (findings
S5-16, S5-06, S5-03, S6-01, S6-V4) replaced all of it with Obsidian's. The
callout editor's preview panel now gives its preview column `1fr`, so the
adjustment column ends flush with the 16px inset under the control column.
The editor's four form rows are one Obsidian `SettingGroup` box above it, and
the preview's title and the adjustments beside it are Obsidian group headings
and groups too (see
[Callout editor](14-callout-editor.md#the-form-box-and-the-groups-beside-the-preview)).

> [!IMPORTANT]
> **Every window wearing this chrome must set a title, with no opt-out.**
> The two windows that used to skip it (a generic confirmation dialog and the
> replace-callout picker) read as unlabelled boxes. This is enforced
> structurally, not just by convention: `ConfirmModal`'s constructor takes
> `title` as a **required** parameter specifically because it's a generic,
> reusable dialog - only the caller knows what's being confirmed, and a
> compiler-enforced parameter is what keeps a future caller from shipping a
> headerless one. `ReplaceCalloutModal` defaults its title to **Replace in
> vault** for the same reason.
>
> **`WelcomeModal` is one deliberate exception** - it's a splash screen,
> opts out of the chrome entirely (`this.titleEl.remove()`), and carries its
> own name as a hero heading in a dedicated left column instead of a
> generic title bar.
>
> **`ConfirmModal` is the other** - it is Obsidian's own `ConfirmationModal`
> (see [`ConfirmModal`](#confirmmodal---the-generic-yesno-dialog)), which builds
> its own title, body and button bar, so it never calls `applyModalChrome` and
> wears no `cs-modal`. It takes the two pieces it still needs from this module
> one at a time: `markStackedWindow` (the backdrop mark below) and, for a long
> message, `scrollBodyOnly`. Going through the module keeps the test that only
> `modalChrome.ts` writes `mod-scrollable-content` true.

`applyModalChrome` is safe to call again on a reopened modal - Obsidian
reuses `modalEl` across open/close cycles, so a stale button bar from a
previous open is detached rather than duplicated. It also installs the
window's keyboard scope, so an open dropdown gets the first Escape
(`ui/menuEscape.ts`), and (through `markStackedWindow`) stamps
`cs-modal-stacked` on the container when
another modal is already open underneath it (used by `styles.css` to paint the
correct backdrop dimming for stacked modals on mobile, where Obsidian's own
backdrop layering can't be relied on) - the open count check is reliable
specifically because `Modal.open()` appends `containerEl` to the document
**before** calling `onOpen()`, so this modal is already counted by the time the
check runs.

### Rows and slider values inside a window

- **Rows sit at the top, as Obsidian's do.** Core 1.14 lays a `.setting-item`
  out with `align-items: flex-start`; only headings, navigable rows, action
  rows and list rows are centred. The plugin pins nothing on top of that, in
  the windows or in the settings tab's boxes (`cs-box`). Both used to: the
  windows were pinned to `center` "against themes that top-align", which by
  1.14 meant against core itself, and adding an ID in the callout editor
  pushed the **Callout IDs** label down to stay centred against the growing
  chips; the settings tab's boxes were pinned the same way. Centring was tried
  again on both and dropped on purpose: it puts a one-line label level with
  the middle of its field, but beside a multi-line description it drops the
  field to the middle of the whole block, and the same row then looks
  different from its neighbours. The result is core's: a one-line label sits
  about 6px above the middle of a 30px field (4.6px for a colour swatch).
  The IDs row's reset arrow keeps its own `align-self: flex-start`, because it
  sits inside `.setting-item-control`, which core centres. The rows that
  still set their own alignment are specific layouts, each with its reason in
  `styles.css`: the choice rows' button, the version history's cards, the
  command-name row and the stacked slider row.
- **A slider's value is Obsidian's readout.** `span.slider-value` takes core's
  face, size and weight. The plugin adds only a `min-width: 7ch` reserve
  (`flex: 0 0 auto`, `text-align: end`) and restates `tabular-nums`, so a value
  that gains or loses a digit does not resize the track and jump the thumb.
  The reserve used to be exact because the value was monospace; now the digits
  are 1ch each and only `-`, `.`, `e`, `m` and `×` are proportional. Measured
  in the macOS UI font at 13px, every value spans 6.5ch or less and "0.75em",
  the longest, 6.5ch to within a fifth of a pixel - hence 7ch, so a wider UI
  face still fits. After a UI font or theme change, drag "0.75em", "×1.25" and
  "-4px" and watch the track.

### A link inside a sentence takes the sentence's colour

A hint's link (`renderInlineLinkHint`: **Restore**, "move it here",
"use it instead") is a `<button>` that is part of a sentence, so it takes the
sentence's colour (`color: inherit`) and is told apart by its underline
(`--link-decoration`) alone. In a muted setting description it is muted, in the
IDs field's warning (`.cs-tag-message`) and the palette editor's duplicate-colour
line (`.cs-palette-color-error`) it is the warning's colour. Hover moves that
colour a quarter of the way to `--text-normal`
(`color-mix(in srgb, currentColor 75%, var(--text-normal))`): `--text-normal`
is dark in a light theme and light in a dark one, so the same rule darkens the
colour in one and lightens it in the other. There is one rule for all three
callers (`.cs-inline-hint .cs-link-btn`), and no caller sets `--link-color` to
bring back an accent: until 2026-10-31 the palette editor's link kept the
accent and the IDs field's was muted, so a link in a warning was a different
colour from its sentence. The inline variant resets the width and padding that
Obsidian's phone rules give every button in a row's control column, at 0,5,0.
The reset that strips Obsidian's button face also strips its focus ring, so the
link gets back the 2px `--background-modifier-border-focus` ring Obsidian draws
on a link in a setting row.

The credits window and Pick an icon's credit line use plain `<a>`s with no
colour or underline of their own. The credits window's links sit in setting
rows now, where Obsidian draws the ring itself; only the one in its first
sentence, and the credit line's, get that same keyboard ring from the plugin. (The settings
footer's tiles are not text links at all: they are bordered buttons with their own
ring; see the footer above.)

### How long a notice stays

Obsidian's own default is four seconds for any notice. The plugin used to name
10, 12 or 15 seconds by hand at about thirty call sites, which kept a
three-word message up as long as a paragraph. A caller that names no duration
now gets one worked out from the words of the sentence it shows
(`noticeDuration` in [`ui/noticeDuration.ts`](../../src/ui/noticeDuration.ts),
called by `showNotice`):

- 1.5 s to notice it, plus 0.3 s a word (about 200 words a minute);
- never under 4 s (Obsidian's default, so a short notice feels as it always
  did) and never over 10 s;
- text without spaces (Japanese, Chinese, Thai) is counted at 2.5 characters
  to a word, found by an average "word" of 12 characters or more.

The count is made on the translated sentence, so every language gets about the
same time as English for the same notice (`tests/noticeDuration.test.ts`
checks all 31). It is one `split` per notice, made when the notice is created;
nothing runs while it is up. Obsidian keeps a notice up while the pointer is on
it and for one second after, which is the reader's own way to ask for more.

Two things do not follow the sentence. A notice with a button (`Undo`, `Retry`)
stays `ACTION_NOTICE_MS`, ten seconds, because the reader has to decide as well
as read. And a caller can pass its own number of milliseconds, `0` meaning
"until it is clicked": the two paused-saving notices do, and `workNotice`
(which lasts as long as the work). Prefer the default, and name a number only
when the reading time is the wrong answer.

### Notices with an action

Three notices offer one thing to do: **Undo** after a note rewrite or a delete
(`settings/rewriteUndoNotice.ts`, ten seconds), and **Open Callout Studio
settings** when saving pauses (`settings/pausedIndicator.ts`) or the settings
file is missing (`manager/settingsNotices.ts`), both up until clicked. All
three go through `showActionNotice(kind, message, { label, run }, duration)` in
[`ui/noticeAction.ts`](../../src/ui/noticeAction.ts), which draws what
Obsidian draws for its own Undo after it updates links (findings S9-14, S9-V1,
S10-12): the message as plain text in `.notice-message`, then
`div.notice-button-container > div.notice-cta` in the notice's public
`containerEl` - accent text, no underline, brighter under the pointer, and on a
phone at the end of the notice's line, all from app.css. Obsidian builds these
with `Notice.addButton`, which its typings do not declare, so the helper builds
the same elements by hand. The button also gets `role="button"`, a Tab stop and
Enter/Space, which Obsidian's bare div lacks.
The notice itself comes from `showNotice` (`ui/mascot/mascotNotices.ts`), as
every notice does, so the mascot sits beside the words and the button under
them (a grid in styles.css; [chapter 27](27-brush-mascot.md#notices)). The
first argument is the kind of notice, which decides the mascot: `"success"`
for Undo, `"paused"` for the two paused-saving notices.

Obsidian hides a notice on any click on it, the button included, so the action
runs with the notice already gone; a notice cannot stay up after its button is
pressed. The missing-file notice keeps its button (`buttonEl`) and rewrites it,
and the message through `setMessage`, when a translation arrives late.

Until 2026-10-24 each was a `<p>` and an underlined, semibold white
`a.cs-notice-action` in a fragment: a line of empty space taller than
Obsidian's notices. `cs-notice-action` stays on the button as a hook for tests.

## Where the cursor lands when a window opens

[`src/settings/modalAutofocus.ts`](../../src/settings/modalAutofocus.ts)
centralizes the rule for text fields when a window opens:
`autofocusOnDesktop(input)` focuses only when `Platform.isMobile` is false.
That flag covers phones and tablets. A null or undefined field is a no-op, so
a caller can reach through an optional field. Focus uses
`{ preventScroll: true }` to refuse the DOM's own scroll-into-view. There is
nothing to dispose of.

### Rule 1: only a *new* name field takes the cursor in a create/edit window

A **new** callout or palette opens on an empty name that must be filled in
before anything can be saved, so on desktop the cursor belongs there. An **edit** opens on
a filled-in form the user came to change some other part of; taking the name
field there costs a tap to get back out, and on a phone would throw the keyboard
over the form they opened the window to look at.

The gate is the caller's, and is deliberately the **same expression the window's
own title asks**:

| Window | Gate | Title |
| --- | --- | --- |
| `CalloutEditor` | `!this.existingId` | `editor.newCallout` / `editor.editCallout` |
| `PaletteEditorModal` | `!this.existing` | `palette.newTitle` / `palette.editTitle` |

> [!IMPORTANT]
> `CalloutEditor` used to ask **`!this.isBuiltIn`**, which is a different
> question - whether the name field is *editable*, not whether the window is
> *creating* anything. Every edit of a custom callout therefore grabbed the name
> field too. `tests/modalAutofocus.test.ts` pins the guard against the title key
> so the two cannot drift apart again.

For `PaletteEditorModal` the gate is `existing`, **not** the seeded state: the
`seed` option pre-fills every colour but stays a *new* palette (it rebuilds one
deleted out from under a callout, so the user "only has to type a name") - which
is the case that most wants the cursor.

`CommandEditorModal` is the third create/edit window and is deliberately *not*
wired up: its first control is a dropdown, not a text field, so there is no
keyboard to raise and nothing to focus.

### Rule 2: no window automatically focuses a text field on mobile

`autofocusOnDesktop` returns without doing anything when `Platform.isMobile`,
which is true for phones **and** tablets. Create windows, Quick Insert, the
replacement picker, and every icon-picker search leave their text fields
unfocused there. The user taps a field when ready to type. On desktop, Quick
Insert and the replacement picker focus search on open. The icon picker focuses
the enabled search field after its source panel loads; the Custom Icons panel
does the same when selected. A source awaiting download has a disabled search
field and cannot focus it.

The reason is the jump, and it is not a scroll the plugin asks for, so
`preventScroll` has no say over it: the WebView shrinks the visual viewport as
the keyboard slides up, then scrolls to keep the caret inside what is left. A
window the user has not read yet moves while they are looking at it.

> [!IMPORTANT]
> An earlier implementation focused a create window on mobile, then held the
> scroller's `scrollTop` at its pre-focus value
> for `KEYBOARD_SETTLE_MS` (400ms, covering the ~250-300ms iOS slide-in),
> releasing early on `pointerdown`, `touchstart` or `wheel`. It did not work
> well - it read as a delayed, clunky lurch rather than as no jump at all - and
> it cost every window a scroll listener plus a disposer to run from `onClose()`,
> for a problem no desktop user has. **It has been removed rather than tuned;
> don't reach for it again.** `tests/modalAutofocus.test.ts` fails if a timer, a
> listener or a `scrollTop` reappears in `modalAutofocus.ts`.

### Search windows use the same device rule

`QuickInsertModal`, `ReplaceCalloutModal`, `PackPanel`, and `ImagePanel` focus
their search fields on desktop only. They have no create/edit gate, but opening
them on a phone or tablet must not summon the soft keyboard. This applies to
an icon source change and to asynchronous panel loading as well as the first
open. Tests in `modalAutofocus.test.ts` and `iconPickerLifecycle.test.ts` cover
the platform behavior.

`hotkeyLink.ts` can also open Obsidian's Hotkeys settings. Its DOM fallback
fills the search query and dispatches input/change on every device; it focuses
and selects the text only on desktop. The normal `setQuery` path is supplied by
Obsidian, so this plugin does not programmatically focus a field there.

`ReplaceCalloutModal` is a search field over a list, and each callout in the list
is drawn as a row of the settings' *Built-in callouts* list: a `Setting`
(`.setting-item.cs-callout-row`) in Obsidian's list box
(`new SettingGroup(listEl).addClass("mod-list")`), with the icon, the name, the
`[!id]` spellings (`renderIdLine` and `fitIdsLine`, exported from
`CalloutRowRenderer.ts` and `idsLineFit.ts`) and the colour circles, so the two
lists read alike and take their CSS from the same place ("Callout List Rows" in
styles.css). The icon and accent come from `paintCalloutListIcon`, which asks
whoever paints the callout (the theme's measured pair when the theme owns the
id), and the circles follow it. A row keeps `data-callout-id` for tests and
the screenshot scripts; `cs-row-name`'s "…" and the phone's accent tile are
the settings rows' own.

What the window adds: the box scrolls inside its own border (`max-height: 300px`
on `.setting-items`), because the search field above has to stay in view; a row
is the thing to press, so it has a pointer and a hover (the settings' rows have
neither); and the chosen row wears Obsidian's selected-item tint
(`--nav-item-background-selected`, a tree row's `.is-selected`) and, at its end,
the check Obsidian's menus put beside the current value. Every row draws the
check and `.is-selected` shows it. A hover is plain grey, mouse only, so the
choice still reads under the pointer. Each redraw (every keystroke) stops the
previous rows' ids watchers before it replaces them.

The search field's keyboard handling is also why `ReplaceCalloutModal`'s **Enter only chooses**
(the top row, when nothing is chosen yet) and never confirms. Confirming rewrites
every note that uses the callout, and its Undo is brief and in memory only, so it takes the confirm button,
which is Obsidian's red destructive button (`mod-destructive`, see
[Red and purple buttons are Obsidian's](#red-and-purple-buttons-are-obsidians)) on
every device. `tests/replaceCalloutModal.test.ts` pins both.

> The window was tried with the shared `CalloutCombobox` (a closed field opening a
> list under it) instead, and that was dropped: a picker's list is cut
> to the room between its field and the edge of the window's scrolling body
> (`ui/listboxPopupLayout.ts`), and this body is a sentence and a row tall, so
> the list opened one or two rows high, at the width of a field stretched across
> the window.

## Two theme-aware surface tokens

Defined in **two** places only (never per modal or per device): on
`.modal.cs-modal`, and inside one of Obsidian's settings boxes. Every call site
names its half's fallback, so anywhere else each half falls through to the
colour Obsidian itself uses there:

```css
.modal.cs-modal { --cs-surface: var(--modal-background); --cs-surface-raised: var(--setting-items-background); }
.setting-group .setting-items { --cs-surface: var(--setting-items-background); --cs-surface-raised: var(--background-secondary); }
```

Inside a box the surface is the box (finding S7-03), so a colour dot's ring,
which repaints the surface behind it, matches the box it sits on rather than
the window. The raised half moves with it, to the window's grey, a step off
the box on every device; nothing raised is drawn inside a box today.

- **`--cs-surface`** (fallback `--background-primary`) - anything meant to
  read as flush with the modal window itself: fixed bands, panels, the ring
  cut around an icon tile's ✕. Not a picker's list: that is Obsidian's own
  popover, on its own ground (see
  [A picker's popover](#a-pickers-popover)).
- **`--cs-surface-raised`** (fallback `--setting-items-background`) - anything
  meant to read as *raised off* that surface: a group-box header strip, a
  card, a control, a row pill. It is Obsidian's own settings-box colour, so a
  plugin box and an Obsidian `SettingGroup` box in the same window, or on the
  settings tab, are one grey.

Obsidian steps that box colour off the window on every device by itself:

| Where | Window / pane | Box (`--setting-items-background`) |
|---|---|---|
| Desktop | `--background-primary` | `--background-primary-alt` |
| Mobile, light | `--background-primary` (a window), `--background-secondary` (the settings pane) | `--background-primary` |
| Mobile, dark | `--background-secondary` | `--color-secondary-2` (4% white over `--background-secondary`) |

So on a phone or tablet in light mode a box inside a window is white on white,
exactly like Obsidian's own grouped rows in a window: the lines and headings
carry the shape. A borderless plugin pill (`.callout-studio-row`,
`.cs-option-box`) reads faint there until it is drawn as a box with lines.

> [!IMPORTANT]
> **The two tokens are a pair and must always move together.** Setting one
> alone is precisely how the group boxes broke once: the body moved onto
> `--cs-surface` while the header strip stayed pinned to
> `--background-secondary`, and `.is-mobile.theme-dark` (phone and tablet)
> repoints `--modal-background` **onto** `--background-secondary` itself, so
> the strip landed on the exact surface it was meant to sit *above* and
> disappeared. The plugin used to answer that with its own `color-mix()` step
> off `--cs-surface` on mobile dark. Obsidian's box colour already makes that
> step (`--color-secondary-2`), so the override is gone; a raw
> `--background-secondary` inside a window is still a bug
> (`tests/modalSurfaces.test.ts`).

**Vault sidebars are not settings.** Find callouts and Review conversion live
in workspace panes, not windows, so they never use the raised half: a result
card is `--search-result-background`, Obsidian's colour for a Search pane's
file box, and the sticky file heading and the refresh overlay name the pane's
own `--background-secondary` (listed, with that reason, in
`KNOWN_RAW_SECONDARY` in `tests/modalSurfaces.test.ts`).

**Deliberately not covered**: `.cs-live-preview-body` and `.cs-gap-demo`,
which are meant to emulate an actual **note** surface inside the modal (the
callout editor's live preview, the spacing-demo widget) - those genuinely
want `--background-primary` regardless of what the surrounding modal chrome
is doing.

> [!TIP]
> Any sticky element must sit at `top: 0`, never a positive offset - a
> positive offset parks an opaque layer *below* the header's rule, which
> visually eats scrolling text passing behind it. See
> `.callout-studio-preview-col` in `styles.css` for the enforced example, and
> `STICKY_LAYERS` in `tests/modalBodyLayers.test.ts`, which every sticky rule
> in the stylesheet has to be registered in with the scroller it sticks
> inside.
>
> Two things the settings-tab band added to that contract. The offset is
> measured from the scrollport's **content** box, so a scroller with its own
> `padding-top` needs that padding moved onto the content before `top: 0`
> means the top of the pane - and where that scroller is Obsidian's rather
> than this plugin's, the rule doing the moving has to outrank the active
> theme, which is a second question and the one that actually regressed. And
> `background-color: inherit` is the third sanctioned paint beside the two
> surface tokens - it is the only one available to a band sitting *on* a pane
> whose colour the plugin does not choose. The band went with the old settings
> page in the *Clean Sweep*; [23](23-common-pitfalls.md) keeps the lesson.
>
> Quick Insert applies the same padding rule inside the modal chrome: its
> `.modal-content` top padding is zero, the introductory paragraph owns the
> resting inset that scrolls away, and the toolbar owns a painted top inset that
> gives the search field breathing room while stuck and contains its focus ring.
> Putting the inset back on the scroller reopens a transparent strip above the
> sticky toolbar, allowing list rows to show through it.

## How an input field focuses

**Search boxes are Obsidian's search field.** Quick Insert, Replace in vault,
and every icon source's search (libraries and pictures) are built with
`createSearchField` (`ui/searchField.ts`), a thin wrapper around Obsidian's
public `SearchComponent` (findings S6-15, S4-10): `div.search-input-container`
holding an `input[type=search]` and a clear button, drawn by app.css with the
magnifier, the × (shown once something is typed) and the pill shape on macOS.
The wrapper hands back the outer `div`, which is the element a toolbar lays
out (it is not in Obsidian's typings; it is the input's parent), and routes
both typing and the × through `onChange` - the × empties the field without an
`input` event, so a plain `input` listener would leave the list filtered by
text that is gone. Each input keeps its old class (`cs-quick-insert-search`,
`callout-studio-replace-search`, `icon-picker-search-input`) as a hook for
tests and the screenshot scripts; the layout classes are on the outer `div`
(`cs-quick-insert-search-field`, `callout-studio-replace-search-field`,
`icon-picker-search`). Quick Insert's "No callouts found" is Obsidian's
`.suggestion-empty` line. Until 2026-10-23 these were plain text fields.

**Text fields are Obsidian's own.** A field marked `cs-text-control` - the
callout editor's **Display name** and **Callout IDs**, the palette editor's
**Name**, and the paste box on the plugin import window - gets no face, edge,
size or focus ring from the plugin. Obsidian's own
`input[type='text']` and `textarea` rules draw them, so they look and answer
exactly like the fields in Obsidian's own Settings, and a theme that restyles
those restyles these (decision 14 of the native-look plan). The class stays as
the opt-in hook for per-screen layout: widths, the IDs field's **+** cap, and
the paste box's fixed height. It must never style Obsidian's editor or the
transparent input inside a combobox.

| State | A text field (Obsidian's rules) |
| --- | --- |
| Rest | `--background-modifier-form-field` (white in light on every desktop, `#2e2e2e` in dark); 1px `--background-modifier-border`; `--input-height` (30px) |
| Pointer hover (mouse only) | `--background-modifier-form-field-hover`, edge `--background-modifier-border-hover` |
| Focus, also after a click | edge `--background-modifier-border-focus` plus a 2px ring in the same colour |
| Disabled | Obsidian's field at half opacity |
| Phone and tablet | a borderless pill in `--interactive-normal` (`#f6f6f6` in light) |

The focus ring on a click is deliberate. An earlier version of the plugin drew
one thin edge for every engaged state so that a click changed nothing; Niv
chose Obsidian's behaviour instead (decision 14, 2026-10-22).

**Dropdowns are Obsidian's own dropdown.** Every field that opens a list (a
plain choice, `SelectDropdown`, and a picker, `ListboxPopup`) is
`ui/dropdownField.ts`: a `div` wearing app.css's own class, `.dropdown`, so
Obsidian draws all of it, in every state, from the tokens its
`<select class="dropdown">` reads (2026-11-01):

| State | A dropdown field (Obsidian's rules) |
| --- | --- |
| Rest | `--dropdown-background` (= `--interactive-normal`: white on Windows/Linux light, `#e4e4e4` on macOS light, `#333` in dark); no border; `--input-shadow`; `--input-height`; `--dropdown-padding` (0.8em before the words, 2.4em after them for the chevron) |
| Chevron | a background image, 1em wide, 0.65em from the end; on `--dropdown-icon-background`, a round disc in a 2em box (≈18px), which is `transparent` except in the macOS settings look below |
| Pointer hover (mouse only), and a press (`.mobile-tap`) | `--dropdown-background-hover` and `--input-shadow-hover` |
| Focus from the keyboard | the 3px `--background-modifier-border-focus` ring (`:focus-visible`) |
| Focus from a mouse press | no ring: `mouse-focus`, which the field keeps from a `mousedown` until its `blur`, exactly as Obsidian's `DropdownComponent` does |
| Open | nothing of its own, as a `<select>` shows nothing while its list is open |
| Disabled | `.mod-disabled`: half opacity, no hover (plus `aria-disabled` and `tabindex="-1"`) |

**Why a `div`.** Obsidian's `DropdownComponent` is a real `<select>`, whose
list is the operating system's (no icons, no search box, and the look Niv
did not want), and which cannot hold a callout's icon in the field. A
`<button>` cannot wear the class: Obsidian's `button`,
`button:not(.clickable-icon)` and `button:hover` rules (0,1,1) beat `.dropdown`
(0,1,0) and repaint the face and the padding. Obsidian's own combobox is a
`div[tabindex=0]` for the same reason. So the field is a `div` with
`role="button"` (`combobox` for a select-only picker, see "The shared callout
picker"), `aria-haspopup` and `aria-expanded`, named through a hidden label plus
its words ("Callout format, Block"), and it opens on Enter, Space, ↓ and ↑.

**styles.css paints none of it.** `.cs-dropdown-field.dropdown` only lays the
words out the way a `<select>` holds them on its own (`inline-flex`, one line
cut with "…", `cursor: var(--cursor)`), and `tests/dropdownField.test.ts`
fails on any plugin rule that sets a background, shadow, border, outline,
padding, corners, height, colour, opacity or `text-align` on the field. Until
2026-11-01 a block of rules (`.cs-dropdown-control`, with a hand-made state
ladder and three padding variables) copied Obsidian's combobox button instead,
and it had drifted: its chevron disc was drawn on the 14px caret, so it came
out half the size of Obsidian's; its padding was the combobox's; and it drew
the ring after a mouse click and while a list was open.

**Width: the words.** A field is exactly as wide as its current words plus
Obsidian's padding, as Obsidian's `<select>` is (`resizeToFit` measures the
selected option). It grows when a longer value is chosen. In a setting row it
is capped where Obsidian caps its own controls: 400px for a plain choice, 250px
for a picker (Obsidian's `.combobox-button`), cut with "…" beyond. A row too
narrow for its label and control stacks them (Obsidian's
`@container (max-width: 400px)`), and there the field takes the whole line, as
Obsidian's `<select>` does. Until 2026-11-01 a plain choice was as wide as its
longest option, through a hidden "width sizer" (finding S8-16: steadier than
Obsidian's), and stretched to `width: 100%` of its column. A short description
let Obsidian's control column grow, which is why "Callout format" in the
command editor showed a field far wider than "Block" on hover.

**Words where Obsidian puts them, rows at the start.** The plugin sets neither
`--dropdown-text-align` nor `text-align` on the field: Obsidian's token is
`start` (the left edge in English, the right in Hebrew) everywhere but its
macOS settings window, which sets `end`. With the width fitted to the words
this shows only where the field is stretched, such as Find callouts' type field,
which reads like Search's text box: the chosen type's icon and name sit together
at the start, the chevron alone at the end. Until 2026-11-01 the field set `end`
on itself in every window (2026-10-28, to match the macOS settings window), and
in that stretched field the icon stayed at one edge and the name was pushed to
the other. The rows of the list stay at the start, as in Obsidian's menus, which
turn `direction: rtl` under `.mod-rtl`.

**The macOS settings look, in the plugin's windows.** Obsidian's settings
window on a Mac (`.mod-macos:not(.is-mobile) .mod-settings`) draws a dropdown
with no face until hovered, its chevron on a round grey disc. The plugin's
settings page is inside that window, so it gets the look from Obsidian. The
plugin's own windows are forms of setting rows too, so
`.mod-macos:not(.is-mobile) .cs-modal .setting-item-control` sets the same three
tokens (`--dropdown-background: transparent`,
`--dropdown-background-hover: var(--interactive-hover)`,
`--dropdown-icon-background: var(--interactive-normal)`). A toolbar or the
sidebar keeps Obsidian's ordinary face, as Obsidian's own toolbars do. This
replaces the command editor's "bare fields" (`cs-bare-fields`, 2026-10-28),
which drew its own transparent fields, wrapped long choices onto two lines and
sized the searchable picker's text input with a hidden copy of its text.
A colour swatch is Obsidian's own `input[type="color"]` (`ui/ColorSwatchInput.ts`,
finding S6-11): app.css draws it as a round dot with a hover ring and a focus
ring, 40px on a phone or tablet, and the plugin paints nothing on it. It
reports every move inside the picker (`input`, for the live preview and the
warning triangles) and the settled pick (`change`, `onCommit`) separately: the
palette editor's low-contrast line waits for the settled pick, because it takes
room and the modal is as tall as its content and centred, so a line that came
and went mid-drag would move the whole window under the cursor. Until 2026-10-23 it was a painted rectangle
with the real input invisible on top, which answered neither the pointer nor
the keyboard.

An invalid value draws nothing on the field itself. Obsidian says it under
the field - `Setting.setErrorMessage`, a line in the warning colour, end-aligned
- and draws no red edge or ring on the field of an invalid setting row, so the
plugin's fields do the same: the palette name (finding S7-06), the IDs field
(S5-V1, see [Callout editor](14-callout-editor.md)) and the palette editor's
low-contrast colours (S6-12), which Obsidian's line would have squeezed into half
a row beside a swatch and so draw as a full-width line of their own, plus a
triangle on the swatch itself (see `PaletteEditorModal`, below). Until 2026-10-23 an invalid field kept a red edge
and a 1px red ring at `(0,5,1)` (`cs-input-invalid`), and the message faded in
under the label.

There is one cascade constraint left (a dropdown's states are app.css's own
since 2026-11-01):
- **The Callout IDs field and its + cap stay one colour.** `cs-tag-add-slot`
  lies over the field's trailing edge and paints `--cs-tag-field-bg`, which the
  row declares as Obsidian's `--background-modifier-form-field` and moves to
  `--background-modifier-form-field-hover` while the pointer is on the row, as
  Obsidian does to the field itself. The row also repeats Obsidian's hover edge
  while the pointer is over the **+** button (the button takes the pointer, so
  the input's own `:hover` would let go), except on a focused field, which
  keeps Obsidian's focus edge, and an invalid one, which keeps its red.

Text fields and dropdown triggers do not show hover tooltips. Their accessible
names still identify the controls to assistive technology; suppressing hover
popups must not remove those names. Obsidian turns `aria-label` into a tooltip,
so `buildComboboxSkeleton` uses a unique hidden text node referenced through
`aria-labelledby`. Tooltips on unrelated action buttons keep their own behavior.

`tests/inputPointerStability.test.ts` pins both contracts. Check them against
the actual cascade too, in light and dark, with invalid and disabled fields and
the IDs field with its **+** visible: the harness in [Checking a theme against
the real cascade](18-theme-callout-discovery.md#checking-a-theme-against-the-real-cascade)
explains how to compare `styles.css` with Obsidian's `app.css`; reading either
stylesheet alone does not prove the computed result.

### Field corners follow Obsidian's input tokens

The dropdown chrome takes its corners from `var(--input-radius, var(--radius-s))`
and `var(--input-corner-shape, round)`, never from a fixed `--radius-s` and
`round`. Those are the tokens behind Obsidian's own `input`, `select` and
`.dropdown` rules, and they are platform- and theme-dependent (Obsidian 1.13):

| Environment | `--input-radius` (= `--button-radius`) | `--corner-shape` |
| --- | --- | --- |
| Default (Windows, Linux) | 5px | `round` |
| `.mod-macos` | `--radius-m`, 8px | `superellipse(1.33)` |
| `.is-mobile` | `--touch-radius-m`, 44px (a pill) | as the desktop above |

A native `textarea` reads `--textarea-radius` first and only mobile defines it
(24px), so the import window's paste box, which is Obsidian's own textarea,
never becomes a pill 132px tall. Native `button` rules read `--button-radius`, which
is `var(--input-radius)` unless a theme splits the two; plain buttons are left
to Obsidian, so they and the fields match by construction.

Two things draw a corner inside a field and must follow it: the **+** end-cap
(`.cs-tag-add-slot`) rounds one pixel *inside* the field's radius with the same
`corner-shape`, and its button inherits both, so a hover tint cannot square off
the field's corner. Both subtract `--input-border-width` (1px on the desktop, 0
on mobile, where Obsidian's fields have no border). Anything new that overlays
a field edge should derive its radius from `--input-radius` the same way. The combobox's inner input stays at
`border-radius: 0`; its wrapper owns the corner.

The IDs under the IDs field are Obsidian's own pills, on every device
(finding S5-11, decision 16): `TagInput.renderTag` builds the DOM Obsidian
builds for a list value in Properties (`div.multi-select-pill[tabindex=0] >
.multi-select-pill-content + .multi-select-pill-remove-button`), and app.css
draws them from the `--pill-*` tokens: an outline, round ends (`2em`), muted
text, a small x that turns accent on hover. The plugin adds three things only:
the focus ring re-aimed onto the pill's border (`--pill-focus-width: 100%`,
`--pill-focus-left-adjust: 0`; Obsidian's default suits the borderless pills
of a property value), end room for a pill without an x (a built-in's own IDs),
and the 140px ellipsis cap. The pinned ID's lock sits in the x's slot. A theme
that restyles `.multi-select-pill` for Properties restyles these too, which is
the point.

The keys are Obsidian's multi-select keys: Backspace (and Delete) removes the
focused pill and focuses the one before it, or the field when none is left;
←/→ move in reading order (flipped in a right-to-left language), ↑ goes to
the first pill, ↓ and Escape back to the field; Backspace in the empty field
steps onto the last pill. Enter (edit in place, in Properties) is not offered.
The pinned pill answers Backspace with the same Notice as its lock; a
built-in's own ID does nothing, as it has no x. Until 2026-10-23 the IDs were
small grey-filled chips (`--radius-s` on the desktop, the field's pill under
`.is-mobile`) with a bold × that only the mouse could reach.
`tests/idPills.test.ts` covers the DOM, the keys and the CSS.

`tests/inputPointerStability.test.ts` pins the declarations. To confirm the
computed numbers, render a native `button`, `input`, `select` and `textarea`
beside the plugin's fields under the harness linked above, with body classes
`mod-macos`, `mod-windows` and `is-mobile is-phone`, and compare
`border-top-left-radius` and `corner-shape`.

### The one control that is not a field but focuses like one

The **icon tile** in the callout editor (`.cs-icon-tile` - the 44px box that
*is* the icon picker's button, with the ⓧ badge straddling its corner) stays
as it was (decision 16 of the native-look plan): a box the user edits without
typing into, it answers the pointer with one thin edge: hover, `:focus-visible` and
press all set `border-color` to `--cs-field-border-hover` and `box-shadow: none`,
and the fill never changes. (It used to take a 3px focus border and a
`--background-modifier-hover` fill, which read as a darker box with a heavy
edge next to its neighbours.)

Three things about it are easy to get wrong a second time:

- **The box needs four classes.** `box-shadow` is contested
  three ways - `button:not(.clickable-icon)` (0,1,1) sets `--input-shadow`,
  `button:hover` (0,1,1) sets `--input-shadow-hover`, and
  `button:not(.clickable-icon).mobile-tap` (0,2,1) sets it again the moment a
  finger lands - so `box-shadow: none` is written at (0,4,1), the same count and
  the same reason as the ⓧ badge. The fill is not repainted at all, so the
  empty state's transparent "add one" box stays hollow under the pointer.
- **`border-color`, never the `border` shorthand.** The empty state swaps
  `border-style` to dashed at (0,2,0); a shorthand at (0,4,1) would silently
  solidify it.
- **The resting shadow is still Obsidian's.** `.cs-icon-tile` declares
  `box-shadow: none` at (0,1,0) and loses to `button:not(.clickable-icon)`, so
  at rest the tile wears `--input-shadow` while the fields above it wear
  nothing. That is left as it was.

#### Hover is desktop-only, and the press is the touch half

Every hover-driven change the tile makes - the edge, fading the
artwork out, revealing the swap arrows, the ⓧ badge appearing - lives in one
`@media (hover: hover) and (pointer: fine)` block. The `hover: hover` half is
old and load-bearing: iOS Safari applies `:hover` on the first tap of an element
that has hover styles ("sticky hover"), which here blanked the artwork and left
the arrows showing on the way into the picker. `pointer: fine` is the newer
half, and it excludes the stylus and the hybrid laptops that answer
`hover: hover` from a touchscreen.

Touch gets the complement, written as `@media (hover: none), (pointer: coarse)`
rather than `not ((hover: hover) and (pointer: fine))` - Safari only learned
that boolean form in 16.4, and this is the block whose whole job is the phone.
There the press carries the box instead: the same thin edge on `:active`
**and** on `.mobile-tap`, Obsidian's own press class (it adds it to every
`a, button, .tappable, …` on touchstart and removes it on release), which is the
dependable half on iOS where `:active` fires only for elements the engine has
already decided are tappable. Both are self-clearing, so nothing stays lit
behind a tap that opened a picker on top of it. The artwork is deliberately
*not* swapped for the arrows on touch: a finger has nothing to reveal with, only
something to commit with, and the drawing is the content.

The ⓧ badge's own pair moved with it, and has to stay its exact complement - a
coarse pointer that also reports `hover: hover` must land in one of the two
blocks, and the one it should land in is the permanent, 22px, tappable badge.

#### The swap arrows drift

The glyph revealed on hover is Lucide's `arrow-left-right`, and Obsidian builds
a lucide icon as bare shape children of the `<svg>` with no `<g>` wrapper - for
this one, four `<path>`s in drawing order: the top arrow's head and shaft
(pointing left), then the bottom arrow's head and shaft (pointing right). That
is what lets a plain `:nth-child(-n + 2)` / `:nth-child(n + 3)` split hand one
arrow to each of two keyframe sets and slide them apart, each in the direction
it already points, and back - 3.5 user units on a 24-unit viewBox drawn at
18px, about 2.6 device pixels, on a 1.05s `ease-in-out infinite` loop.

- It is scoped off `.is-empty` because the glyph there is `plus`, whose two
  paths would take the same split as one arrow each and pull the `+` apart.
- `translateX` on an SVG child resolves in that child's own user coordinate
  system, so there is no `transform-box` or `transform-origin` to get wrong; a
  pure translation has no origin.
- Reduced motion is handled by putting `prefers-reduced-motion: no-preference`
  **in the query** rather than an `animation: none` in the `reduce` block beside
  it. Those selectors are (0,6,1) and an override would have to restate every
  one of them to outrank it. A loop that never starts needs no stopping.

## How a secondary button paints

**Obsidian paints every grey button.** A window's Cancel (a
`<button class="mod-cancel">` in Obsidian's `.modal-button-container`), the
settings' buttons (Import, Export, Reset everything, …), Pick an icon's
**Manage libraries** and the import window's Upload/Paste get no face, edge,
hover or focus ring from the plugin: Obsidian's `button` rules draw them, so
they look exactly like Obsidian's own buttons (decision 14 of the native-look
plan). On macOS that is a flat grey (`#e4e4e4` light, `#333` dark) that does not
change under the pointer, which is how Cancel looks in Obsidian's own dialogs
there; on Windows and Linux it is white with Obsidian's hairline shadow and a
small hover step.

**No button wears a face of the plugin's any more.** The last one, the style
windows' segmented row of border sides (`.cs-border-side-btn`), went with those
windows: the style pages use Obsidian's four switches (finding S7-10). The
tokens it read, `--cs-btn-face` and `--cs-btn-face-hover`, went with it on
2026-10-25. The palette's gradient direction arrows had already become
Obsidian icon buttons (`div.clickable-icon` with `role=button`, `.is-active` on
the chosen one, finding S6-10), drawn by app.css alone; they keep their
physical direction in a right-to-left Obsidian (a `.mod-rtl` rule undoes
app.css's icon mirroring, since a gradient's angle does not flip). If a control
ever needs a button again, build it as Obsidian's button.

### Never `--background-modifier-hover` on a button face

That token is not a colour. It is a translucent mono overlay,
`rgba(var(--mono-rgb-100), 0.067)`: black at 6.7% under `.theme-light`, white at
6.7% under `.theme-dark`. On a face it went wrong twice. It composites against
what is *behind* the button, so a grey button on a dark pane hovered by 0.3%
luminance, no hover at all; and its direction flips with the theme, so the
segmented row darkened under the pointer in dark mode. The plugin's own face
then mixed its step into the resting fill (`color-mix` with `--mono-rgb-100`),
until there was no face of its own left.

> [!NOTE]
> The overlay is still right for a **list row, an icon button or a chip** -
> anything that sits on the surface behind it rather than owning a face - so
> `--background-modifier-hover` is deliberately untouched on
> `.cs-combobox-option`, `.callout-studio-row-buttons button`, `.cs-icon-tile`,
> `.cs-drag-handle` and friends. The rule is about which of the two a control
> is, not about banning a variable.

A cautionary tale from the arrows, before they became icon buttons: Obsidian
1.13's `.is-phone .modal .setting-item-control button:not(.clickable-icon)
{ width: 100% }` is **(0,4,1)**, and a four-class override (0,4,0) lost
`width: 26px` on the element tie-break. Chrome hid the loss - a `flex-basis`
still sized the buttons - but WebKit sized the shrink-wrapped control column
from `width` and the last arrow spilled out of the card on iOS. A
`.clickable-icon` is outside that rule altogether, which is one more reason to
build a small control as Obsidian's icon button. Check a phone override in
WebKit as well as Chrome (see "Checking a theme against the real cascade" in
`21-theme-callout-discovery.md` for the harness).

`tests/secondaryButtons.test.ts` pins it: no rule of the plugin's paints the
plain grey buttons, and neither `.cs-settings-neutral-btn` nor the
`--cs-btn-face` family comes back.

### Red and purple buttons are Obsidian's

**One red.** A destructive action is Obsidian's quiet destructive button,
`mod-destructive` alone: `setDestructive()` on a `ButtonComponent`,
`DESTRUCTIVE_BUTTON_CLASSES` (`ui/destructiveButton.ts`) on a raw `<button>`.
Obsidian paints it as red words on a light red wash (10% of
`--background-modifier-error`) on every device, which is how it draws its own
**Log out** button. Every red button of the plugin wears it, so a settings row
and a window agree: every `ConfirmModal` yes that destroys something (its
default `confirmKind`, `"destructive"`; a yes that loses nothing passes
`"cta"`), **Replace in vault**, the paused-saving banner's **Replace settings
file** and **Discard recovery copy**, **Convert selected**, a version's
**Restore** and **Reset everything**. The solid red (`mod-destructive
mod-cta`, which is what `setDestructive().setCta()` adds) was this plugin's red
for windows until 2026-10-28 and is gone; nothing pairs the two calls now.

**Locked and lit.** The red button has no state of its own. A locked one
(`aria-disabled`, see [Blocked main buttons say
why](#blocked-main-buttons-say-why), or `disabled` while busy, as the paused
banner's two are) is Obsidian's 70% dim of the same face, which fades both the
words and the wash and reads as locked in light and dark mode alike; a lit one
is the resting face. The acknowledged **Reset everything** window starts locked
and lights when its tick is set, with no class changed (`tests/confirmAcknowledge.test.ts`).

Never the older `mod-warning`. Obsidian still styles it, but under
`.is-mobile` it is a grey button with bold red text, so the same button was red
on a desktop and grey on a phone or tablet. Never `ButtonComponent.setWarning()`
either: 1.13 deprecates it, and it is only `setDestructive().setCta()` anyway.
(`MenuItem.setWarning(true)`, a red menu item, is a different API and stays.)

**No hover of ours.** Obsidian's quiet red keeps its wash under the pointer (its
own `button.mod-destructive` rule comes after `button:hover`), so a red button
does not change colour when hovered, like Obsidian's own **Log out**. A
purple button (`mod-cta`) hovers to `--interactive-accent-hover`, a lighter
purple in both modes. The plugin used to override both: a solid red stepped
darker in light and lighter in dark (`--cs-btn-danger-face-hover`), and a purple
derived from the resting accent, darker in light (`--cs-btn-accent-face-hover`).
Both tokens and their rules are gone, so these buttons look and behave exactly
like Obsidian's.

`tests/dangerButtons.test.ts` fails on a `mod-warning` string in `src/`, an
argument-less `.setWarning()`, a `setDestructive().setCta()` pair, any
`styles.css` rule that names `.mod-warning` or selects `.mod-destructive`, the
old red token, and a solid red, white glyph or hover colour on the two ✕ badges.
`tests/accentButtons.test.ts` fails on any rule that repaints a `.mod-cta`
under the pointer.

> [!NOTE]
> `.cs-icon-tile-clear` (the small ✕ on an icon tile) and
> `.icon-picker-image-delete` (the one on a custom image) are red buttons too,
> and the only red `styles.css` paints. They are circles straddling a corner,
> so they take Obsidian's quiet red by its tokens instead of the class: the ✕ in
> `--text-error` on a `--background-modifier-error` wash at 10%, laid over a
> solid `--cs-surface` (a translucent wash would let the tile's own border show
> through the badge). Until 2026-10-28 they were the palette's solid
> `--color-red` with a hardcoded white glyph and a hover that mixed toward
> `black`; all three are deleted, and they have no hover colour, like the
> buttons above.

## Controls take Obsidian's colours

The plugin's fields, dropdowns, buttons and lists take their colours from
Obsidian's own tokens in every theme and both colour schemes. On macOS in light
mode that means Obsidian's grey (`#e4e4e4`) on buttons and dropdowns, as
Obsidian's own Settings show them.

Until refactor-1.13 there was a **light palette**: seven swatches of white and
grey lines, applied only in light mode under the Default theme, behind a
`cs-default-theme` class that `main.ts` kept on `<body>`. It was deleted on
purpose (decision 14 of the native-look plan), together with that class, its
module and its two test suites, so the windows look like Obsidian's own in every
case. Do not bring it back to fix one control: restyle that control from
Obsidian's tokens instead.

## Blocked main buttons say why

A button that cannot act must not go quiet. A `disabled` button swallows the
click, so the user is left looking at a dimmed control that never says what it
is waiting for - a name still to be typed, a row still to be chosen, a draft
still to be confirmed with Enter. Every *main* button that can be blocked for a
reason the screen does not already show is therefore **dimmed instead of
disabled**, and answers a press with a notice naming the one thing in the way.

[`ui/blockedButton.ts`](../../src/ui/blockedButton.ts) is the whole mechanism:
two functions over one reason string.

- **`paintBlocked(button, reason)`** sets `aria-disabled` and `cs-btn-disabled`
  while `reason` is non-null and clears both otherwise. Obsidian's own
  stylesheet draws `button[aria-disabled="true"]` exactly like
  `button[disabled]` (`opacity: 0.7`, `cursor: not-allowed`);
  `cs-btn-disabled` is a hook for tests; no rule of the plugin's styles it.
  (Until 2026-10-23 a window's footer dimmed it further, to `opacity: 0.4`,
  fainter than any disabled button in Obsidian; finding S6-01 removed that.)
- **`explainIfBlocked(reason)`** is the first line of the click handler:
  `if (explainIfBlocked(this.saveBlockedReason())) return;`. It returns true
  after showing the reason, so the handler stops. The notice stays up as long
  as any notice does, by the length of the sentence (see "How long a notice
  stays" below), and a second press *replaces* it rather than stacking
  another.

Each button owns a private `…BlockedReason(): string | null` that returns the
translated sentence for the first thing in the way, or `null`. The same method
paints and answers, so the dimmed look and the words cannot disagree, and the
click recomputes it instead of trusting the last paint - a state that changed
without a redraw is still answered truthfully. The sentences name what to do
(*Choose a replacement callout…*), not the button; a sentence that has to name
another control takes its label as a `{{placeholder}}` so it cannot drift from
the label.

| Button | Reason method | Blocked while → notice |
| --- | --- | --- |
| **Convert selected** / **Finish conversion** (Review conversion) | `PortableConversionView.convertBlockedReason()` | a conversion is running → `portable.blockedConverting`; pending link updates unrecoverable → `portable.recoveryUnavailable`; the review failed → the error already on its status line; the review is updating → `portable.blockedUpdating`; a replacement draft is open → `portable.blockedEditing`; every replacement unchecked → `portable.blockedNothingSelected`; nothing eligible → `portable.empty` |
| **Save** (command editor) | `CommandEditorModal.saveBlockedReason()` | no callout exists or is chosen → `commandBuilder.noCallouts` / `commandBuilder.noCalloutChosen`; the same command already exists → `commandBuilder.duplicate` |
| **Save** (palette editor) | `PaletteEditorModal.saveBlockedReason()` | the name is taken → `palette.saveBlockedName`; the colours duplicate another palette → `palette.colorExists` |
| **Replace** / **Confirm** (replacement picker) | `ReplaceCalloutModal.confirmBlockedReason()` | no row chosen → `replaceModal.chooseFirstReplace` |
| **Import valid only (N)** (import report) | `ImportReportModal` | N is 0 → `import.nothingValid` |
| **Confirm** (icon picker) | `IconPicker.confirmBlockedReason()` | no icon selected, which is also what switching source does → `iconPicker.chooseFirst` |
| **Restore** (Version history) | `VersionHistoryPage.restoreBlockedReason()` | saving is paused → `notice.blockedWhilePaused`; the version equals the current setup → `versions.restoreSame` |

The callout editor's **Save** (`showSaveBlockedNotice`), the quick-insert
**Insert** (`quickInsertNotice`) and the plugin import's **Import**
(`noticeFillFirst`) were the first three to work this way and keep their own
copy; **Reset everything**'s acknowledgement answers a press with a nudge on
the checkbox instead (see [`ConfirmModal`](#confirmmodal---the-generic-yesno-dialog)).

**Where `disabled` stays right.** A button that is merely *busy* and already
says so: **Importing…**, the discovery button's **Scanning…**, the saving
banner's **Working on it…**, and the ones that show Obsidian's own busy
button, `mod-loading` (a spinner in place of the label, at the same width, with
`aria-busy`), all through `setButtonBusy` in
[`ui/busyButton.ts`](../../src/ui/busyButton.ts): the icon picker's Confirm
while its artwork downloads, the callout editor's Save while a save runs (it
used to read **Saving…**, finding S5-V3). Pressing one of those teaches nothing.

**Two consequences to keep.** A dimmed button is focusable, so Enter and Space
answer too. And a press on one is *not* "clicking away": while a Review
conversion replacement draft is open, a document-level handler commits it on
any outside click, so `PortableConversionCustom.outsideClick` ignores a press
on an `aria-disabled` control, and the view puts the caret back in the draft
(`focusDraft`) - the notice says *press Enter*, and focus would otherwise sit
on the very button that just refused.

## Button labels and the ellipsis

A trailing `…` on a button or menu item says one thing: **pressing this does not
act yet, and the next step asks for a detail the label does not name.** The reader
learns to trust it - a plain label acts, a dotted one asks first - so it only works
if it is spent narrowly. Before it was written down, four labels out of some sixty
carried it, and two of those for the wrong reason: **Convert selected…** opened
only a yes/no confirmation, like **Delete** and **Reset everything**, which had
none, while **Import**, **Export** and **Replace in vault** each opened a step that
asks for a source, a format or a replacement, and had none either.

Ask three questions, in order:

1. **Does pressing it act at once?** No dots. (**Duplicate**, **Scan for
   callouts**, **Retry**.)
2. **Is the next step only "sure?", or the form or window the label already
   names?** No dots. (**Delete**, **Reset everything**, **Convert selected**,
   **Add new callout**, **New palette**, **Manage commands**, **Review
   conversion**.)
3. **Does the next step ask for something the label does not say** - a source, a
   format, a file, a replacement, the text itself? Dots. (**Import…**,
   **Export…**, **Upload…**, **Replace in vault…**, **Custom replacement…**.)

The boundary cases, and why they fall where they do:

- **A confirmation is not a missing detail.** A destructive button's red styling
  and its dialog already carry the weight; dots on **Delete…** would add noise,
  not information. Obsidian's own **Delete** has none either.
- **A window that is the destination is not a missing detail.** **Manage
  commands**, **Customize**, **Review conversion** and **Restore an earlier
  setup** open the thing the label names; nothing is left to ask. (The last is
  the closest call: its window lists setups to choose from, but it carries the
  label's own title and is as often opened to compare as to restore.)
- **A form the label names is not a missing detail.** **Add new callout** opens
  the callout editor, which is what it said.
- **The last step of a dialog never has dots.** **Replace**, **Import** and
  **Delete** inside their dialogs are the action itself. Their keys are often
  shared with the button that opened the dialog, so a trigger that needs dots
  gets a key of its own first.
- **Icon-only buttons never have dots.** Their string is an `aria-label`, not a
  visible label. A button that opens a dropdown wears the chevron instead.

Other `…` in the strings keep their own meaning and are not action labels:
progress text (**Scanning…**, **Importing…**), placeholders (**Search callouts…**)
and a cut-short list (*…and 3 more*). A busy button may show progress dots where
its action label had none, or in its place: **Importing…** stands in for **Import…**
while the work runs.

Three habits go with the rule:

- **One character.** The mark is `…` (U+2026), never `...` and never preceded by a
  space; GNOME's and KDE's guidelines ask for the same, and all of `en.ts`
  already did it. (Obsidian's own strings use three ASCII periods; this plugin
  deliberately does not follow.)
- **Documentation names a button without its dots**: **Import**, not *Import…*.
  The label can change; the instruction should not.
- **Translations mirror English.** A locale ends a label in its language's
  ellipsis exactly when the English label does. A dots-only edit leaves every
  translation true, so none needs retiring (see [Localization](17-i18n.md)).

[`tests/uiCopyEllipsis.test.ts`](../../tests/uiCopyEllipsis.test.ts) is the
executable form. Every English string with a `…` must be filed under what its dots
mean (asks for a detail, in progress, placeholder, cut-short list);
the asking actions must end in it; a list of the near misses must not; and `...`
is rejected. Adding a dotted string therefore means choosing a meaning, which is
the step that used to be skipped.

## Help text: one short sentence per line

Longer help is written as short sentences, each on a line of its own, kept in
one translated string separated by `\n`, so a translator sees the whole text
at once. HTML shows a `\n` as a space, so the text is drawn with
[`ui/textLines.ts`](../../src/ui/textLines.ts): `appendLines(el, text)` into an
element, or `linesFragment(text)` for a `Setting`'s description. Windows keep
this style. A row on the settings pages, and a page's opening sentence, get
one short sentence, as Obsidian's do (decision 6). The ten that had two or more
were cut to one in English (2026-10-25, Q1); the other languages keep their
longer wording, still true, until they are translated again.

## Notable individual modals

### `ConfirmModal` - the generic yes/no dialog

Resolves `Promise<boolean>`. Required `title` (see above), optional
`confirmLabel`/`cancelLabel`/`confirmKind` (`"destructive"` by default, Obsidian's
red `mod-destructive` - a destructive action reads as one by default
unless the caller passes `"cta"`, the accent, for a yes that loses nothing). Used throughout for anything destructive that isn't
specific enough to warrant its own modal (bulk vault edits, full reset).

**It is Obsidian's own `ConfirmationModal`** (1.13, finding S9-06), the dialog
Obsidian asks **Delete file?** with. The constructor puts `mod-confirmation` on
the container and builds `buttonContainerEl` under `.modal-content`;
`ConfirmModal` sets the title, writes one `<p>` per line of a plain message (or
appends a fragment), then calls `addCancelButton` and `addButton` - in that
order, so Cancel comes first and the confirm button sits at the end of the bar.
What that gives for free, with no CSS of the plugin's:

- **Focus.** The confirm button is `setInitialFocus()`. Obsidian picks the
  button to focus inside `open()`, *before* `onOpen()`, so the buttons are
  built in `confirm()` before `open()` is called. With a keyboard, Enter
  confirms and Escape cancels; on a touch device nothing takes focus.
- **Phone.** `mod-confirmation` hides the ✕, centres the title, and the bar
  stacks full-width with the red button on top and Cancel under it.
- **Answering.** A press runs the `onClick` handler, which Obsidian awaits, and
  then closes the dialog unless the handler returned something truthy.
  `onClose` (which must call `super.onClose()`) answers `false` when no button
  answered, so Cancel, Escape and a click outside all resolve `false`.

`withMascot(subtitle)` is asked for by every red question. It gives the window
a two-line heading: the title, and under it `subtitle` (a `div.cs-confirm-subtitle`
in the header row, which gets `cs-confirm-heading`), with the brush mascot beside
both, except on a phone. The subtitle is a required argument, so a question with
the mascot cannot go without one, and it is already translated: the name of the
item in quotes (`confirm.subtitleName`, `“{{name}}”`, the quotes in the string so
each language can use its own) or a short sentence of what it costs. The message
under the heading says what the heading does not. See
[The brush mascot](27-brush-mascot.md#where-it-appears).

An optional last argument, `acknowledgement`, is for a confirmation that
cannot be taken back. It is `ConfirmationModal.addCheckbox`, the box Obsidian
puts **Don't ask again** in: `label.mod-checkbox` at the start of the button
bar, drawn by app.css (finding S9-07). It replaces a bordered box at the end
of the message, which a long list pushed off screen. Two changes to
Obsidian's checkbox, both on `.cs-confirm-acknowledge`:

- **Tab reaches it.** Obsidian builds the input with `tabindex=-1`, since its
  tick is an optional preference; this one is a required gate, so it is set to
  `0`.
- **On mobile it goes on top of the bar** (`order: 1`). The bar is
  `column-reverse` there, with Cancel at `order: -1`, so in DOM order the tick
  would land between the two buttons. Obsidian has no precedent: it does not
  offer its own tick on mobile (`Platform.isMobile || addCheckbox(...)` in
  app.js).

The confirm button stays locked until the box is ticked: `aria-disabled`, not
`disabled`, so it still receives the click, and Obsidian's
`button[aria-disabled="true"]` dims it to 70%. Pressing it while locked returns
`true` from the handler, which keeps the dialog open, and restarts `cs-nudge`
on the label: the label shakes and its text and the empty tick square's
outline turn red, then fade back (its weight never changes; under reduced
motion only the colour fade plays). Nothing scrolls: the bar is pinned, so the
tick is always on screen. **Reset everything** is the only caller that passes
it (`confirm.acknowledge`), and its long message also gets `scrollBodyOnly`, so
only the body scrolls, between a title and a bar that stay put.

Its message is built from `settings/resetInventory.ts`, which reads the
registry and returns two lists: what the reset deletes (custom callouts,
pictures, commands, palettes, each with a count) and what it puts back to
defaults (changed built-ins with a count, then each setting group that differs
from `DEFAULT_SETTINGS`). A row that would change nothing is left out. Each
list is drawn as a plain `<ul>` with no rules between the lines, and each
counted row's sentence opens with its number (`{{count}} custom callout
type(s)`). Reading the registry cannot say how many notes use the custom types
that go, so the button handler scans the vault and appends that as the last
row of `deleted` (`settings.resetItemReferences`, just the count) rather than
as a paragraph above the lists. The first list is introduced by a lead-in
paragraph (`settings.resetDeletes`), drawn only when something is deleted. The
reminder that used to open the message (`settings.resetIntro`) is the heading's
second line now, and when nothing is deleted the second line says what happens
instead (`settings.resetSubtitleDefaults`). Blocks are spaced by `--p-spacing`,
with the lead-in kept close to its list. An empty
inventory means there is nothing to reset, and the button answers with a notice
(`settings.resetNothing`) instead of opening the window. The inventory mirrors
`CalloutRegistry.resetAll()`: a group added to one belongs in the other.

### Delete and Convert uses to plain text - two items, two plain dialogs

Covered in depth in [Vault discovery § delete flow](11-vault-discovery.md#delete-flow)
and [§ convert flow](11-vault-discovery.md#convert-flow).

There used to be a `DeleteCalloutModal` with three outcomes: Cancel, "Replace
instead…" and "Delete (convert to plain text)". It existed because Delete did
two things at once, and the in-use dialog had to offer a way out of the
destructive half.

Splitting the action removed the reason for it:

- **Delete** removes only the definition.
- **Convert uses to plain text** only rewrites notes. It is its own `⋮` item
  (`addConvertUsesItem` in `rowOwnership.ts`).
- **Replace in vault…** was already in the same menu (`addReplaceItem`, next to
  it in the `notes` group; see
  [Callout row menu groups](#callout-row-menu-groups)).

Each is now a two-button `ConfirmModal`: Cancel plus a red **Delete** or
**Convert**. The heading names the callout in quotes (`confirm.subtitleName`;
`deleteModal.subtitleFallback` when it is also the default fallback;
`convertModal.subtitle`, "Every “Project note” in your vault", for Convert). The
body is short sentences, one per line, joined with `\n`; `ConfirmModal` turns
each into its own `<p>`.

A callout nothing uses, unless it is the default fallback, is deleted with no
dialog at all. The notice's **Undo** stands in for the question.

### `NoteChangesModal` - "Update your notes?"

Asked by the callout editor's Save, before anything is saved, when the save
would change something notes hold: an id leaving the callout, titles reading
its old name, fold marks after a **Foldable** change. The rule and the flow are
in [Callout editor](14-callout-editor.md#notes-change-only-after-asking); this is
the window.

- **One question**: the changes Save would make - one line, or a `<ul>` when
  there are several - then how many callouts they reach and the question, one
  sentence per line (`\n` in the string, `<br>` in the window), over a
  `role="radiogroup"` of two answer cards: **Leave them as they are**, first and
  preselected, and **Change them to**, which rewrites every old id to one of
  this callout's own ids.
- **One frame for both questions**: each window wears the chrome and sets its
  title itself (every modal file must, see `tests/modalChrome.test.ts`), then
  `renderNoteQuestion` (`noteQuestion.ts`) draws the changes, the count and
  question, the radiogroup and the footer's two buttons, and hands back
  `answer()` for each card and `repaint()`. The palette
  editor's question (`PaletteNotesModal`, below) is drawn by it too, so the two
  cannot drift apart. Each window adds its own answers and decides what Save
  changes resolves with.
- **The cards are the plugin import window's**: `renderOptionBox` without an
  icon, `addOptionRadio` for Obsidian's radio at the start of each card (the
  question's id is the group's `name`) and `paintOptionRadio` for the chosen
  one, all from `optionBox.ts` and shared with the import window: an outline,
  the chosen card's in the accent (see
  [How an option box is drawn](15-import-export.md#how-an-option-box-is-drawn)).
  With more than one id to pick from, Change carries a `SelectDropdown` at its
  trailing edge - where the import card keeps its button
  (`.cs-note-change-picking`; on a narrow window the dropdown wraps to a line
  of its own, still at the trailing edge). Here a click anywhere on a
  card chooses it, a click into its dropdown included; the import window
  exempts its own buttons and text box.
- **Footer**: **Cancel** and **Save changes** (`mod-cta`). Cancel, Escape and
  the close button resolve `null` - back to the editor, nothing saved. The
  promise resolves exactly once; `onClose` destroys the dropdown.
- **Another action**: a built-in row's **Reset to default** opens this window
  too (`sections/builtInResetAction.ts`). `input.action` gives it its own line
  for the removed ids (`noteChanges.changeResetRemoved`, or `…RemovedMany`
  listing several in one line) and its own button
  (`settings.resetAction` in place of **Save changes**). Everything else is the
  editor's: the count, Leave first and preselected, Change to one of the
  built-in's own ids.

### `PaletteNotesModal` - the palette editor's "Update your notes?"

Asked by the palette editor's Save, through its `beforeSave` hook, when a new
name changes the palette's word in callout metadata and notes still use the old
word (the rule is in [Colour system](12-color-system.md)). The same frame as
`NoteChangesModal`: one line saying what changed (`palette.renameNotesChange`),
the count and question, then **Leave them as they are** (preselected) and
**Change them to "new-word"**. No dropdown: there is only one word to change
to. It resolves `false` for Leave, `true` for Change, and `null` for Cancel,
Escape or the close button, which keep the palette editor open with nothing
saved. The title, count, question and answer titles reuse the `noteChanges.*`
strings; only the change line and the two descriptions are the palette's own.

### `PaletteEditorModal` - simple vs. advanced, two background styles

Two-column layout: a sticky live preview on the left (an Obsidian group
heading above its box), and on the right two Obsidian setting groups,
**Palette** and **Colors** (`SettingGroup`: a heading, one rounded box, inset
dividers, 24px between them; finding S7-05), with the editors' 16px row inset
(`cs-editor-group`). Until 2026-10-23 they were two plugin-drawn cards with a
grey title strip (`createControlGroup`), and the stylesheet fought Obsidian's
modal row flattening to put dividers back; a grouped row is outside that rule,
so the fight is gone. The Colors rows are still torn down and rebuilt on every
switch rather than hidden: Obsidian leaves the divider off the box's first
child only, so a hidden first row would hand a stray divider to the first one
on screen. **Intensity** is a stacked setting row (`cs-stacked-slider`, as
the callout editor's icon adjustments): the name above, the readout and a
full-width track below. The duplicate-colour message is the first line inside
the Colors box while there is a clash, in the warning colour, and out of the
DOM otherwise (`renderColorError`). **Simple mode**: one
base colour, and the full six-value palette (light/dark accent, background,
text) is auto-derived with contrast correction
(`derivePaletteFromColor` - see [Colour system](12-color-system.md)); the Base
color row is a bare swatch with no description line (`paletteBaseColorRow.ts`).
**Advanced mode** exposes accent/background/text rows for the mode Obsidian is
showing (`shownDark`), and only while the background style is **Solid**; a
Gradient palette has no advanced per-colour view. Light and dark each keep
their own three colours: an edit writes only the shown mode's key. Both start
from what Base color derived, so the mode not yet edited is still a sensible
one. Until 2026-11-01 every edit overwrote the other mode with a guess that
mirrored the lightness (`inferOppositeModeColor`, removed): a white background
came back black, a pale blue near black, and two hand-picked modes could not
both be kept.

**The mode button** (`paletteModeButton.ts`) is a second extra button at the
very end of the Colors heading, after the view button, so it keeps its place
while that one comes and goes. It is offered under every style. A sun in dark
mode, a moon in light mode; a press shows all of Obsidian in the other mode
(`showMode`) and rebuilds the rows for it. The preview needs nothing: it is
the real CSS in the real mode. `onClose` puts the mode back, and every way out
reaches it (Cancel, Escape, closing Settings, closing the Settings window
itself - all measured). A `css-change` listener follows a mode Obsidian sets
by itself while the editor is open (its light/dark command, a theme that
follows the system) and makes that the mode to go back to; this plugin's own
css-change after every inject leaves the mode as it was and costs one
comparison.

Why the whole app and not just the preview. Obsidian's public API only reads
the mode (`app.isDarkMode()`); it switches by putting `theme-dark` or
`theme-light` on the main window's body (`updateTheme`, its own "Toggle
light/dark mode" command under a system theme, and the PDF export's print
window all do exactly that). A pop-out window - Settings, where this editor
usually opens - copies the main body's classes on every class or style change
of that body and on `focuschange`, so classes put on the pop-out alone are
undone at the next copy; they go on the main window. And a light box inside a
dark window still matches every `.theme-dark …` rule, this plugin's dark
blocks and most themes' variables, so a scoped preview would show colours the
note never gets. The body flip was compared with Obsidian's real
`changeTheme` in the default theme, Minimal, AnuPpuccin, Things, Vanilla
AMOLED and Nord: the page colour, the callout background pixel, the title and
the text came out identical, with or without a `css-change`, and identical
again after switching back. No `css-change` is fired, so anything that caches
a mode-dependent value (the graph view, Style Settings) keeps the old one
behind the modal until the mode comes back.

The switch between the two is one icon button at the end of the **Colors**
heading (`paletteColorViewButton.ts`, a `SettingGroup.addExtraButton`), not a
sentence with a link under Base color: that sentence ("...you can control it
separately by clicking here") was too long for the column and wrapped on every
line. The sliders icon opens the separate colors and the undo icon (`undo-2`,
not the ↺ that means "back to the default") reverts to the single base color,
re-deriving all six from it; the tooltip says which. It hides (`cs-hidden`)
under Gradient and Transparent, which have no separate colors.
`renderColorSection` repaints it on every rebuild. The low-contrast warning is
not the row's `setErrorMessage`, which gives the line half a row beside a
swatch. It is said twice, because each half is bad at the other's job
(`paletteContrastLine.ts`):

- **A triangle** (`contrastBadgeIn`, `span.cs-contrast-badge`, the
  `triangle-alert` icon) is the first child of the control column of the Accent
  and the Text row, ahead of the swatch, shown when *that* colour is under its
  limit (Accent 3:1, Text 4.5:1). It says *which* colour; its tooltip is the
  sentence, and it carries `role="img"` so a screen reader reads that label.
  It takes no room - the control is aligned to the row's end, so what arrives
  at its start does not move the swatch - so it follows every `input` event of
  the picker.
- **A line** (`contrastLineAfter`, `div.cs-palette-contrast-line`) says *why*, in
  words that read on a phone, where a tooltip has no hover. It is one line for
  all three colours, placed right after the last colour row (Text), shown when
  the Accent or the Text falls short, and wears the same icon as the triangles
  so the two read as one warning. It draws a divider of its own - Obsidian's
  hairline, the `::before` that sits above every row but the first - because
  without one it hung under the Text row like that row's caption, as if the
  Text colour were always the one at fault. It waits for the settled pick
  (`change`): it takes room, and the window is as tall as its content and
  centred, so one that came and went mid-drag would move the whole window. It
  is registered with the card's teardown list because a rebuild removes the row
  but not what merely sits after it.

Background style is a further 3-way choice: Solid, Gradient (two-stop linear,
preset direction, an off-by-default "Gradient title text" toggle), or None
(transparent - see [Colour system](12-color-system.md#preset-palettes---hue-named-not-role-named)
for why this is the *only* route to a transparent palette).

The Palette group keeps **Name** and **Style** at the same control-column
width. Name is Obsidian's own text field; Style is a `SelectDropdown`, a field
drawn like Obsidian's dropdown that opens Obsidian's own `Menu` (see "Shared
dropdown controls"). Both are `--input-height` tall with Obsidian's field
corners. The dropdown is destroyed when the modal closes.

The preview renders on a **reserved demo id** (`PALETTE_DEMO_ID =
"palette-demo"`), registered through the same registry preview slot the
callout editor uses - and, notably, **deliberately not**
`PREVIEW_PLACEHOLDER_ID` (the callout editor's own reserved id), because two
concurrently-open demo previews (opening the palette editor from inside the
callout editor) must not collide on one registry slot.

**`beforeSave`** is an optional hook the caller passes: Save builds the result,
then awaits `beforeSave(draft, stillOpen)` before it closes. `false` keeps the
window open with nothing saved; that is how the settings list asks
`PaletteNotesModal` first, and how its Cancel comes back here. A second press
while the hook is still answering is the same Save (`confirming`). Closing the
window meanwhile resolves `null` as usual; `stillOpen()` then turns false, so
the question is not opened, and a late `true` saves nothing.

### Scoped reset controls

The conditional `rotate-ccw` controls use the shared `settings.resetAction`
label. They are hidden when their scope already matches its canonical default.
Settings resets save immediately through the usual settings path; the built-in
callout editor's field resets still change its draft until Save.

**One rule for every ↺.** An arrow is there only while something differs from
the default. It is never dimmed (a grey arrow is clutter) and never live with
nothing to reset. Two ways keep it out of sight, and a screen uses the one its
layout needs:

| Hidden by | Keeps its room | Used where |
| --- | --- | --- |
| `cs-reset-idle` (`paintResetIdle`, [`ui/resetArrow.ts`](../../src/ui/resetArrow.ts)): `visibility: hidden` | yes | The style pages' sliders and box headings, the Commands and right-click menu pages' headings, the editor's icon adjustments, Manage icon libraries |
| `cs-hidden` (`addFieldResetButton`, `editor/fieldResetButton.ts`): `display: none` | no | Beside a field that grows into its place: Default fallback callout, Language, and the editor's IDs, Icon and Color. (The conversion review's card arrow uses the `hidden` attribute, the same way.) |

- **Why not `opacity: 0`.** A transparent element is still on the page: the
  pointer reaches it (its tooltip shows over nothing, a click lands on it), Tab
  stops on it and a screen reader reads it. `visibility: hidden` has none of
  that, and keeps the room, so nothing beside the arrow moves when it appears.
  A slider's track must not jump under the pointer in the middle of a drag.
- **Nothing is redrawn to show it.** The arrow is made once and a class says
  whether it shows. Measured in headless Chrome with Obsidian 1.14.5's
  `app.css` and the plugin's stylesheet, style and layout recalculated after
  each toggle: `cs-reset-idle` 10 µs, `cs-hidden` 34 µs, an inline
  `opacity` 26 µs. Drawing a whole settings page again (what `ctx.redraw()`
  does) costs 0.9 ms for a style page (12 rows), 1.3 ms for the right-click
  menu page (18 rows) and 4.4 ms for the main page (27 rows): cheap, but
  a hundred times a toggle, so a ↺ is painted in place wherever its box can
  say when (the style pages' rows, the commands' rows, the menu page's
  repainting row) and not by a redraw.
- **The guard.** `declarativeSettingsTree.test.ts` draws every page of the tab
  with nothing changed and fails on a ↺ that shows. A new screen with a ↺ goes
  through `paintResetIdle`, or through `addFieldResetButton` beside a field.
  Until 2026-10-29 the right-click menu page's three arrows were always shown
  and a press with nothing to reset did nothing.

**Default fallback callout** restores `DEFAULT_SETTINGS.fallbackCalloutId`
(`note`). **Language** restores `DEFAULT_SETTINGS.language` (`auto`), following
Obsidian's language through the same locale-change path as a manual selection.
Their reset buttons occupy the trailing edge of the existing control column;
the picker shrinks to make room, as in the callout editor's color row.

The **Language** column is sized from its content, not the fixed 260px the other
reset rows use. The picker's menu is exactly as wide as the picker, so the
column has to fit the longest option. `languagePicker` measures a hidden stack
of every language name and adds the reset arrow's width plus the gap.
It un-hides the arrow for that one synchronous read, because a picker showing
Obsidian's language keeps it `display: none`. The sum becomes
`--cs-language-control-width`. The column never shrinks (`flex: 0 0 auto`): in
a narrow pane the description wraps, and Obsidian stacks the row below 400px.
Before this, a shrinking column and an arrow that took its room from the picker
cut "Bahasa Indonesia" short.

The menu lists languages only, each under its own native name, with no flags
and no regional grouping. Flags stand for countries, not languages (W3C i18n
Best Practice 16), and Windows' emoji font draws flag emoji as two letters.
There is **no Automatic row**. The saved value still has two kinds, `"auto"` to
follow Obsidian and a locale code to pin one, but the picker never names the
first. It shows the language a preference renders in instead (`shownLanguage`,
matched by locale *file*):

- `"auto"` shows Obsidian's language, or English when the plugin lacks it.
- An alias (`no`, `zh-hk`) shows the row that serves it.
- A code no row offers shows English, since that is what renders. That covers
  a value from another version on a synced device, or one typed by hand.

The arrow shows exactly while that language differs from Obsidian's
(`showsObsidianLanguage`). A pick saves by these rules (`preferenceFor`):

| Picked row | Saved |
| --- | --- |
| The row already shown | Nothing. No save, no redraw; if its file has not downloaded, the pick retries it. |
| Obsidian's language | `"auto"`, exactly as the reset arrow does. |
| Any other row | That code, pinned. |

**Nothing is migrated, and "the same as Obsidian" is never written back.**
Obsidian's language belongs to the device, while `data.json` syncs. Take a
pin saved under the old Automatic row that equals Obsidian's language here.
It loads unchanged and shows no arrow. On a synced device whose Obsidian is in
another language, it is still a pin, with the arrow. Rewriting it to `"auto"`
on load, or on a re-pick of the row already shown, would silently change that
other device. Older versions read the same two kinds of value, so mixed
versions across devices keep working.

When the language a preference asks for has not downloaded, the notice that
tells so names it after the row the picker shows, so `zh-hk` reads as 繁體中文.

Colored option headers reserve space at their trailing edge for the compact
reset control without increasing the header's original height. (The callout
editor's icon-adjustment groups no longer have such headers: they are Obsidian
`SettingGroup`s whose ↺ is the heading's extra button; see
[Callout editor](14-callout-editor.md#the-form-box-and-the-groups-beside-the-preview).) Menu-category and
built-in-command resets sit at the trailing edge of their headings, above the
toggle rows.

### The style pages' preview and sliders

The Heading, Inline and Block callout pages (26 § The style pages) show their
effect on a real rendered callout as a slider moves. They use a reserved demo
id (`STYLE_DEMO_ID = "global-style-demo"`) and the same
live-preview-on-a-registered-row pattern as the palette editor. The preview
(and the heading role's stacked gap demo) is
[`stylePreview.ts`](../../src/settings/stylePreview.ts)'s `StylePreview`, and
every slider's range, step and readout is one entry in
[`styleSpecs.ts`](../../src/settings/styleSpecs.ts). `styleControls.ts`'s
`wireStyleSlider` is the live-drag contract for a slider a page row makes.
Showing a value again (after a reset) commits nothing: Obsidian's
`SliderComponent.setValue` calls the change callback when the value differs,
which used to save once per slider on top of the reset's own save.

Each ↺ restores only the fields it stands for from `DEFAULT_SETTINGS`,
including nested border-side flags and the heading-fold setting outside
`globalStyle`. Resets refresh the generated styles and the preview; heading
settings that affect decorations also refresh open callout editors. Default
objects remain unchanged so subsequent edits cannot alter a later reset target.

The inline sample places a localized content pill between two localized sample
sentences. In the embedded Live Preview, clicking the pill reveals its source
syntax for inspection. The callout id stays fixed across locales; its visible
label follows the selected language. The inline corner-radius slider reaches
25px for the 1.5× text scale. The settings guard still accepts previously saved
values up to 64px.

### Customize right-click menu

A settings page since 2026-10-25 (26 § Customize right-click menu), built on
Obsidian's own lists and drag engine. The items' labels and icons, and the
moves it makes (show, hide, move, back to shipped), are
[`menuItems.ts`](../../src/settings/menuItems.ts), shared with the version
comparison. The saved `edit` item is labelled **Create or edit callout**
because it is one item for both runtime outcomes, not two mutually visible
actions.

### `DragSortList` - reorder without replacing a grabbed row

[`ui/DragSortList.ts`](../../src/ui/DragSortList.ts) is the plugin's own drag
engine, used by Manage icon libraries (its Available libraries list). It moves
the existing row nodes as the pointer crosses their neighbours. On release it
reports the final indices synchronously, and the window keeps those nodes:
rebuilding them after a drop could detach the target of the next drag. The
row's short settling animation is cosmetic and never owns a delayed model
update or list rebuild. A new gesture cancels that settle and any FLIP slide on
its row through `cancelReorderAnimation`, preserving the row's current visual
position before pointer tracking takes over. Otherwise the Web Animations
transform can override the pointer-following transform, making a row appear
stuck even though its handle shows the drag cursor.

Pointer capture belongs to the stable container. Move/end events must match
the active pointer, and release, cancellation, or lost capture detach the
gesture listeners and clear its state before releasing capture. Closing the
window also cancels settle/slide animations and removes transient drag styles.
Reduced motion skips the visual animations without changing when a move is
committed. Since pointer moves preserve rows and their handlers, a handle's
ArrowUp/ArrowDown listener looks up the item's current index on every key
press; a render-time index would become stale after the first drag.

#### The drop placeholder

While a row is dragged, `DragSortList.ts` marks the slot it lands in if let go
now: an empty `div.cs-drag-placeholder` (`aria-hidden`), the row's exact size.
It is Obsidian's own drop slot (`.drag-ghost-hidden:before`): the accent at 30%
(`color-mix(in oklch, var(--interactive-accent) 30%, transparent)`) with 5px
corners, as when a ribbon item is dragged in Settings → Appearance.

The lifted row is Obsidian's drag ghost: a solid card on `--drag-item-background`
with `--drag-item-shadow`. For the length of the gesture `DragSortList` puts
Obsidian's own `is-grabbing` class on the window's `body`, which gives a grabbing
cursor everywhere and keeps tooltips from opening. Every way a gesture ends
clears it: a drop, a cancel, a lost capture, or the window closing. The handle
ends the row (after the row's own control) and draws Obsidian's three-bar icon
(`menu`, with `mod-drag-handle`). ↑/↓ on it moves the row, and so does Alt+↑/↓,
Obsidian's key, because no modifier is checked.

- **The slot is the dragged row's own box.** The row never leaves the flow -
  it sits in its slot with a `translateY` floating it under the pointer - so
  `coverSlot()` reads its `getBoundingClientRect()` less `currentTransform`,
  relative to the list's, and hands top, left, width and height over as
  `--cs-drag-placeholder-*` properties, which `styles.css` turns into an
  absolutely positioned box. The list (Available libraries' `.setting-items`)
  is `position: relative` for that. Measured rather than styled, so a taller library row gets a taller
  slot.
- **It moves inside the FLIP.** When the row changes slot, the placeholder is
  re-covered within the same `animateReorder` mutation that moves the row, so
  the FLIP slides it to the new slot in step with the neighbours trading places
  with it (the same slide, Obsidian's 300ms `cubic-bezier(0.2, 0, 0, 1)` from
  `ui/flip.ts`, and the same cancel-and-restart on a fast drag). It is
  placed with `top`, never `transform`, because the slide is a `transform`
  animation.
- **Paint order.** It is the list's first child, so a row sliding past it is
  painted after it and passes over it, and the dragged row's `z-index: 1` lifts
  that row above everything. The list is deliberately not made a stacking
  context (`isolation`, a `z-index`): that would confine the dragged row's
  z-index to its own list, and a later list in the same window would paint over
  a row dragged onto it. Being absolutely positioned, the box takes no flex
  `gap` and no row index - `rows()` matches `rowSelector` and never sees it.
- **Entrance.** It fades in and opens out from 97% over 200ms
  (`cs-drag-placeholder-in`, behind `prefers-reduced-motion: no-preference`),
  mostly under the lifted row. The keyframes animate the `scale` property,
  not `transform`, so a slide that starts mid-entrance is not overridden.
- **It leaves with the settle.** A released row keeps its placeholder until
  its settle finishes, is cut short by the next grab, or the window closes;
  then the `is-dragging` look and the placeholder go together, unseen, since
  the row now covers the box exactly. A row let go in its own slot loses both
  at once. A rebuild that lands mid-settle - the libraries window's deferred
  refresh - takes the placeholder out with the old rows; the later removal is
  a no-op.
- **Reduced motion draws none.** The row never leaves its slot then, so it
  marks the slot itself.

#### Why the libraries window does not use Obsidian's list

Obsidian's own reorderable list (a declarative `type: "list"`, as on Settings →
Appearance → Ribbon menu configuration, and on this plugin's Customize
right-click menu page) is reachable only through `getSettingDefinitions()` or a
settings page's items: nothing public renders definitions into a `Modal`, and
its drag engine is a function inside `app.js`, not one of the `obsidian`
module's exports (`SettingGroup.onDeleteItem`, `onReorderItem` and
`focusNearestItem` exist at runtime but not in the typings). So the libraries
window, a `Modal`, keeps `DragSortList`. The two also behave differently:
Obsidian's touch drag starts only after a 250 ms press-and-hold, its keyboard
reorder is Alt+↑/↓ on a focused row (rows and handles are `tabIndex -1`), and
neither `app.js` nor `app.css` mentions `prefers-reduced-motion`.
`DragSortList`'s handle starts a touch drag at once (`touch-action: none`), is
a Tab stop that moves its row with ↑/↓ (Alt+↑/↓ too), and honours reduced
motion. Like Obsidian's engine it scrolls while a row is held near the edge
when it is handed a `scroller` (finding S4-12): within 50px of the scroller's
top or bottom edge (or a third of its height, if less), a frame loop scrolls it
up to 15px a frame and finds the slot again, and a wheel scroll mid-drag
re-tracks the row too. It keeps scrolling under reduced motion, which only
removes the slides. Manage icon libraries passes its window body.

### `IconLibrariesModal` - libraries in three Obsidian groups

Opened by the **Manage libraries** text button at the end of Pick an icon's
source row, and by the **Icon libraries** row of the settings' Colors and icons
box (26 § The Colors and icons box). Both go through
[`iconpicker/openIconLibraries.ts`](../../src/settings/iconpicker/openIconLibraries.ts),
which reads the pack files back from disk before the window opens and takes
from the door the icon counts and, from the picker, the callout being edited
(`editing`). Titled **Manage icon libraries** - the button's words with "icon"
put back, since the button is read inside a window already about icons and the
title has to stand on its own
([`iconpicker/IconLibrariesModal.ts`](../../src/settings/iconpicker/IconLibrariesModal.ts)).
The libraries are three Obsidian setting groups (`SettingGroup` with
`mod-list`, finding S4-13): a heading over one rounded box of rows, thin lines
between the rows, 24px between the groups, rows a little tighter and kept on
one line on a phone. Each row is an Obsidian `Setting`: the library's emblem
in a `setting-item-icon` (what `Setting.setIcon` builds; not in the typings, so
built by hand), its name, the line of facts as its description, its one button
as an extra button, and - in Available libraries only - the drag handle at the
very end. Nothing is faded. Until 2026-10-23 it was one banded list of grey
pills, with hand-drawn headings, captions and rules matched to Built-in
commands.

This window is also the only place a new library is downloaded: the Choose
source menu lists only the libraries the picker offers (see
[Callout editor](14-callout-editor.md#the-icon-picker)), and closes with a line
counting the ones left to download here.

The groups' headings are keyed `iconPicker.librariesAvailable` and
`iconPicker.librariesToDownload` - keys the Choose source menu shared until it
stopped listing libraries to download; they are now this page's alone:

| Heading | Holds | Order |
| --- | --- | --- |
| **Available libraries** | what the picker offers here | the user's order; the only draggable rows |
| **Libraries to download** | downloadable libraries this device lacks | catalog order |
| **Hidden libraries** | built-in libraries the person hid | catalog order |

A hidden library cannot sit under *Libraries to download* - there is nothing to
download - and the page has to list it to offer **Show**, hence the third
group. A group with no row is not shown (`cs-hidden` on the group), except
Available libraries, which never empties - the last library cannot leave the
picker - and holds the reset arrow. `computeRows()` returns the shown
libraries, then the downloadable ones not offered, then the hidden ones, and
`groupOf(row)` sorts each into its box; because the Available rows come first,
a drag's indexes in that box are indexes in `rows` too. Each group carries
`data-cs-group` for tests and the screenshot scripts; only the Available group
has a class of its own (`cs-icon-library-available`), for the drag's
placeholder.

The headings are Obsidian's group headings, drawn by app.css alone: nothing in
`styles.css` sizes or colours them (`iconLibrariesModal.test.ts` holds that).
The reset arrow is the Available group's extra button
(`SettingGroup.addExtraButton`), built once with the group - only the rows are
rebuilt - so `syncReset` always holds the arrow on screen. It is invisible
(`cs-reset-idle`, `visibility: hidden`) while nothing differs from the default,
and overhangs the heading's line by its own padding, as the callout editor's
heading arrows do, so the heading keeps one height.

The row's button is an extra button rather than a `<button>`: Obsidian's phone
rule pads every `button` in a row's control by 10px, which made the action
40px beside a 28px handle. As a `div.clickable-icon` it is the handle's size
everywhere, reachable with Tab, and dimmed by Obsidian's
`.clickable-icon[aria-disabled='true']` when it is blocked.

During a drag the placeholder is the Available box's first child, so the first
row is not, and Obsidian's row divider (`.setting-item::before`, left off the
first child only) would draw along the top of the box;
`.cs-drag-placeholder + .setting-item::before { content: none }` keeps it off.
The lifted row wears the same card as a callout row (`.is-dragging`), since a
grouped row is transparent in its box.

The description is a single translated string with one `\n` per sentence,
rendered by `descriptionLines()` as text and `<br>` in a fragment (the Callout
IDs row in the editor does the same), so each sentence sits on its own line and
a translation keeps the breaks by keeping the `\n`. It says three things: drag
to reorder, that some libraries can be downloaded and deleted, and that Lucide,
Emoji and Material come with the plugin so they can only be hidden. That
deleting a library leaves its callouts alone is told by the delete dialog, where
it matters, and not repeated here.

Each row has exactly one icon button, and which one says what kind of library
it is:

| Library | In Available libraries | In the other groups |
| --- | --- | --- |
| Downloadable: Tabler, Font Awesome, Octicons, RPG Awesome, Simple Icons | `trash-2`: delete its files | `download` |
| Ships with the plugin: Lucide, Material, Emoji, Custom Icons | `eye-off`: hide | `eye`: show |

The line under each name says what the library costs: its icon count and, for a
downloadable library, its size - in Available libraries the space it takes, elsewhere
what a download would fetch (only the missing files, so Font Awesome with Brands
already on disk quotes Solid and Regular). Built-in libraries say "no download
needed"; Material says "each icon downloads when picked". The count and the
size sit in FSI…PDI isolates, as the source menu's counts do, so a
right-to-left interface keeps "1.6K+" whole, and a size keeps a no-break space
between number and unit so a phone row never parts "625" from "KB".

Behaviour to keep in mind before changing it:

- **Rows are recomputed, not kept.** Hiding, showing, a deletion, or a
  download finishing - here or in the picker's own prompt, heard through
  `packs.onChange` - rebuilds every group from settings and pack state inside
  `animateAvailable()`. Only the Available rows slide (`animateReorder` on that
  box); a row that changes group moves there at once, as a row does between
  two of Obsidian's lists - a slide across the gap would carry a transparent
  row's text over the next heading. A change that arrives
  mid-drag waits for the drag's `pointerup`, `pointercancel` or
  `lostpointercapture`: rebuilding under the pointer would detach the dragged
  row.
- **The page scrolls by itself in exactly one case: the library whose button
  was pressed changed group and landed out of view.** Then the list scrolls with the
  row, just far enough to show where it went - down to **Libraries to download**
  or **Hidden libraries** for a delete or a hide, up into **Available
  libraries** for a download that has *finished* or a show. Nothing else moves
  it: not a drag, an arrow key, the reset arrow, a download still running
  (the row only shows its spinner in place), a press that was refused, declined
  or failed, a library that arrives from the picker's own prompt, or a move
  that lands in view anyway. The page keeps a set, `following`, of the
  libraries whose button is being pressed through (`run()` adds the id and
  removes it in a `finally`, so a press that ends without the row moving is
  forgotten and a later move of that library by someone else scrolls nothing).
  Every refresh asks `takeMovedFollowed()` whether one of them has changed group
  since the last rows - a hide at once, a delete when its first file is gone, a
  download when its last file has arrived - and hands that key to
  `animateAvailable(change, follow)`. There, after the rebuild and before the
  slide is measured, `scrollToReveal()` (`ui/scrollToReveal.ts`) moves the page's
  root - `rootEl`, the `.vertical-tab-content` that is a settings page's one
  scroll container - by the least that puts the row inside it with
  `REVEAL_MARGIN_PX` (40px, room for a group's heading above its first row) to
  spare, and not at all when it is already in. Because the scroll is instant
  and happens *before* `animateReorder` reads where the rows now are, the
  Available rows slide from where each was on screen to where it now is.
  Reduced motion skips the slide but still scrolls. (A drag scrolls the page
  too, when the row is held near its edge - that is the drag's own doing, see
  the `DragSortList` section above.)
- **A rebuild never leaves a box empty.** `render()` builds each group's rows
  in a detached element and puts them in with one `replaceChildren()` per box;
  the list used to be `empty()`-ed and appended to. The row whose button was just pressed has
  focus, and Chromium lays the page out on the spot when it takes focus off a
  node being removed - with the rows after it already gone, since Obsidian's
  `empty()` removes from the last child. The scroller is then too short for
  where it was scrolled, clamps, and stays clamped once the rows are back: with
  this page's list being most of its content, pressing a button on a row near
  the top threw the whole page to the top (measured 196px → 0; a press on the
  last row lost nothing, which is why it looked erratic). `replaceChildren`
  removes and inserts in one step, so the layout it forces sees the full list.
  `.click()` from a script never reproduces this, because it does not focus the
  button - use real pointer input. Customize menu items shares the list and was
  checked too; its lists are short next to the rest of its window, so the same
  press there never clamped.
- **A download writes no settings.** The library lands in its saved slot.
  Hiding, showing, reordering and the reset each save at once, like the menu
  customization.
- **The last library cannot leave the picker.** Its button is dimmed with
  `paintBlocked` and explains itself through `explainIfBlocked`.
- **Deleting asks only when something uses the library.** The `ConfirmModal`
  names the callouts - up to ten, then "and N more" - and says they keep their
  icons, which `IconService.deleteLibrary` makes true
  ([Icons](13-icons.md#deleting-a-library-keeps-its-callouts-icons)). "Something"
  includes the callout being edited whose picked-but-unsaved icon is from the
  library (`host.editing`, [Icons](13-icons.md#the-callout-being-edited-counts-as-a-user)):
  the registry cannot see it, and it is exactly what someone has just
  downloaded and applied. The users are worked out when the button is pressed,
  not when the page opens. An unused library is deleted at once; one in use
  is refused while saving is paused (`blockedWhilePaused`), and the editor's
  icon is passed to `deleteLibrary` so its drawings are sealed too.
- **The reset arrow** sits at the end of the **Available libraries** heading,
  as that group's extra button. It puts everything back the way the plugin
  came, so it shows while *any* of three things differs: the order, a hidden
  built-in library, or a downloadable library with any file on the device
  (`isInstalled`, so a partial download counts). Pressing it restores the order
  and the hidden list at once, then deletes the installed libraries one by one
  through the same `deleteFiles()` a row's trash button uses, each row showing
  its spinner and moving to Libraries to download as its files go. It never downloads.
  When something would be deleted it asks first, naming the libraries and
  saying callouts keep their icons; with nothing to delete it does not ask. It
  is refused while saving is paused if a callout - or the edit - uses one of
  the libraries (the same seal as a single delete), and a library that cannot
  be deleted raises its own notice, leaves the arrow showing, and does not stop
  the rest.
- **`openAndWait()` resolves with whether anything changed** when the window
  closes, which is what tells the picker to take it in: it rebuilds its menu
  and, only if what the panel shows changed, the panel
  ([The icon picker](14-callout-editor.md#the-icon-picker)). A deletion still
  running when the window is closed - a reset's last libraries included - is
  seen through first (`deletions`), because the picker reads the pack files
  when it hears back and a half-deleted library would still look downloaded.

### Commands and shortcuts

A settings page since 2026-10-25 (26 § Commands and shortcuts): the user's own
commands (add, edit, delete) and the built-in commands (a switch each). The
flows behind add, edit, delete and re-enabling the built-ins are
[`command/commandFlows.ts`](../../src/settings/command/commandFlows.ts). Both
kinds show two things side by side, deliberately kept separate:

- **Shortcut chips** that only *read* what Obsidian has bound
  (`hotkeyLink.ts`'s `hotkeysForCommand`), drawn as Obsidian's Hotkeys page
  draws them, because a shortcut is a fact about the row, not something this
  page can set directly. A switched-off built-in shows none until it is on
  again; the saved Obsidian binding itself is preserved.
- **⊕**, which *opens* Obsidian's own hotkeys pane, filtered to that command
  (`openHotkeySettings`), because binding a key is Obsidian's job.

The **Built-in commands** ↺ is lit while any `FIXED_COMMAND_IDS` entry is off.
It re-enables those commands through the existing command-registration path and
leaves custom commands untouched. Assigned hotkeys are preserved: Obsidian
exposes no public API for deleting user bindings, and this reset does not write
its undocumented hotkey store.

Deleting a callout from another surface (a row's ⋮ menu) prunes any command
depending on it (via `CustomCommandManager.syncAll()`, see
[Editor integrations](10-editor-integrations.md#customcommandmanager---one-idempotent-sweep)),
and the registry's change signal redraws the page in the same moment, so it
never offers a dead row. Everything here **saves itself immediately** on every
change - there's no separate OK/Cancel, matching the plugin's general
save-on-change convention.

#### `CommandEditorModal` - the rows, and where each one's rule lives

The form is *Callout type*, *Callout format*, *Heading level*, *Action*, *Fold
state*, then **Command name**. The five choices are the rows of one Obsidian
`SettingGroup` (the grey rounded box the plugin's other windows put their rows
in; until 2026-10-31 they were bare rows on the window's background), built
into its `listEl`, and the group carries `cs-editor-group` for the editors'
shared 16px inset. Every row is built unconditionally and hidden
with `cs-row-hidden`; one `syncVisibility()` decides all of it, so the controls
can never disagree about the current format. **Command name** (finding S8-15)
is the generated name as Obsidian's read-only value (`addDisplayValue`), and a
command the user already has said under it through the row's `setErrorMessage`.
It is the form's result, so it is a second `SettingGroup` of one row rather than
one more row of the first. Until 2026-10-23 the name sat in a bordered card
under the form, with a red line that slid in for a duplicate. The row carries
`cs-command-name` (2026-10-28, restyled 2026-10-31): Obsidian's read-only value
is a muted, one-line note cut with "…", which hid the name and, in a narrow
desktop window, squeezed the row's own label down to a letter (a phone stacks
the row, so it never had that). The stylesheet now stacks the row on every
platform, label then name across the box's full width, and draws the name at
the size of a row's label, in the normal text colour, a little heavier, and
wrapping. The stacking rules are doubled in class weight because Obsidian
holds the control of an `is-invalid` row (a duplicate) to half the row, and
puts the error text at the end rather than the start. The row has no
description line on purpose: the name is the line.

Every configuration row carries `cs-command-field`, a hook. Each field is as
wide as its current choice, at the end of its row, as every dropdown is (see
[How an input field focuses](#how-an-input-field-focuses)); they shared one
180px column until finding S8-16, and a plain choice was as wide as its longest
option until 2026-11-01. Beside its words the control column does not shrink
(`flex-shrink: 0`), so the row's description wraps rather than the choice being
cut. On a Mac the five are drawn as in Obsidian's settings window: words and a
chevron on a round grey disc, with no face until hovered. They take a line of
their own when Obsidian stacks rows on a phone. With no callout to choose from,
the window opens on Obsidian's warning text (`p.mod-warning`), since that
blocks Save.

New commands select the built-in `note` type when available, then the first
registered type with a visible name. This avoids selecting a discovered fallback
whose display name contains only whitespace. Choices come from committed
definitions, excluding theme-only rows and transient previews; persisted
scan-created definitions are registered choices too. Existing commands retain
their saved callout id and can still edit a pinned legacy theme choice.

The choice rows live under `settings/command/` rather than in the modal, which
keeps each control beside its option rule and supplies one popup teardown path:

- **`commandRoles.ts`** - the format list refills itself per callout
  (a theme-owned callout has only Block), with a line explaining the absence:
  Obsidian's warning text (`p.mod-warning`) under the description, which
  simply appears and goes.
- **`calloutRow.ts`** - the *Callout type* picker, over the shared
  [combobox](#the-shared-callout-picker). This was a `<select>` whose every
  option read `Abstract (abstract)`; the id is now shown only on a row it
  actually explains. Registered choices form one flat list without headings.
- **`optionRows.ts`** - the fixed Heading level and Action choices.
- **`foldStateRow.ts`** - the three fold states, shown only for Block. Heading
  and inline are not narrower versions of the same choice, they have no fold
  syntax at all, so the row hides rather than greying out. Both block *actions*
  show it: Wrap selection and Insert new write the same header line.

`SelectDropdown` builds the four plain lists as Obsidian menus (see
[Shared dropdown controls](#shared-dropdown-controls)). It exposes selection and
option refresh methods so the modal can sync dependent rows, and a `destroy()`
for every field. Heading level shows Lucide's `heading-1` … `heading-6` beside
each level, and Fold state the fold icons of a note's right-click menu.

`draft()` mirrors the sanitizer's shape, including omitting `fold` when it is
`"none"` - otherwise a command saved from this window and the same command
reloaded would differ by a key that means nothing. See
[`CustomCommand`](04-data-model.md#customcommand).

### Shared dropdown controls

Every field that opens a list is Obsidian's dropdown
([`ui/dropdownField.ts`](../../src/ui/dropdownField.ts), see
[How an input field focuses](#how-an-input-field-focuses)): the searchable
callout and colour pickers; the select-only icon-source and skin-tone pickers;
and the plain choices in commands, palettes, the icon picker, the callout
editor's (hidden) fold state and "Update your notes?". Text-entry fields are
Obsidian's own fields.

What opens differs by kind, and is the rule since 2026-10-23 (decision 25 of
the native-look plan: "every menu should look the same as Obsidian's"):

| Kind | The list | Why |
| --- | --- | --- |
| A plain choice (`SelectDropdown`) | Obsidian's own `Menu`, drawn as HTML | a few fixed options: exactly what Obsidian's menus are for |
| A picker you search in (`ListboxPopup`) | Obsidian's combobox popover, with a search box at the top (see the next section) | a menu cannot hold a search field |
| The icon-source and skin-tone pickers (`ListboxPopup`, select-only) | the same popover, with no search box | their rows carry what a menu item cannot: a second line with a count, and emoji samples |

None of them uses the operating system's `<select>` list.

**`SelectDropdown`** ([`ui/selectDropdown.ts`](../../src/ui/selectDropdown.ts))
is the field itself (`el` and `controlEl` are the same `div.dropdown`, which
also wears `cs-select-dropdown` for its callers' layout rules), showing the
current option's words. (Given `{ icon }` as a third constructor argument it is
a bare icon button instead, a `<button class="cs-select-button">` inside a
`.cs-select-dropdown` wrapper: the icon in a `cs-select-icon` span, the words
(`.cs-select-value`) kept hidden with `cs-visually-hidden` so the accessible
name still ends with the current value, and the name also set as a tooltip with
`setTooltip`. The settings footer's language globe and Quick insert's funnel are
the two; the caller adds its own class to `controlEl`.) A click, or Enter,
Space, ↓ or ↑, builds a `Menu`:

- `setUseNativeMenu(false)`, so it is drawn as HTML and can show icons (and is
  the same on every platform; on a phone it is Obsidian's bottom sheet);
- one item per option, `setChecked(true)` on the current one;
- an option's `icon` when **every** option has one, otherwise `setNoIcon()`, so
  the words start at the row's edge. Today only *Heading level* (`heading-1` …
  `heading-6`) and *Fold state* (`ban`, `plus`, `minus`, the icons of the fold
  choices in a note's right-click menu) carry icons;
- `setParentElement(field)`: Obsidian marks the field `has-active-menu`,
  treats a press on it as not "outside" (so a second click closes the menu
  instead of reopening it) and closes the menu if the field disappears;
- `showAtPosition({ x, y: bottom, width, overlap: true, left: rtl })`, the
  position Obsidian itself uses for a menu under a button.

**A long list scrolls with the wheel** ([`ui/menuScroll.ts`](../../src/ui/menuScroll.ts),
called right after `showAtPosition`). Obsidian's desktop menu is `overflow:
hidden`: it cannot be scrolled with the wheel at all, and instead a `mousemove`
listener on its `.menu-scroll` (`ME()` in app.js) sets the scroll position from
the pointer's height in the menu, so the 32 languages ran along under a moving
mouse; `Menu.select` also pulls a half-hidden row into view the moment the
pointer lands on it. Neither can be switched off, so the menu gets the class
`cs-wheel-menu` (styles.css: `overflow-y: auto`), and around `mousemove` and
`pointerover` the helper writes the scroll position down in the capture phase
(before Obsidian's listeners) and puts it back in the bubble phase (after them,
since it was added later). Both happen inside one event, so nothing is painted
in between; a wheel step or an arrow key, which are other events, still scroll.
The menu also opens with the current choice in the middle. Nothing is done where
Obsidian drew no list (a native menu, a test's stand-in).

**Scrolling the page behind it closes the menu**
([`ui/menuAnchorScroll.ts`](../../src/ui/menuAnchorScroll.ts), called after the
menu is shown). `showAtPosition` places the menu once, at window coordinates, and
nothing moves it afterwards, so a scroll of the settings page or the modal would
leave it hanging where the field used to be. The helper records the scroll
position of every ancestor of the field, listens for `scroll` on the document in
the capture phase (a scroll does not bubble), and closes the menu when an
ancestor, or the page (`scrollingElement`), is at a different position than when
the menu opened. Comparing positions ignores a scroll event queued before the
click; the menu's own list is not an ancestor, so the wheel scroll above is
untouched. On a phone, where the menu is a bottom sheet that ignores the
position, nothing is watched. `onHide` takes the listener back. This is the same
rule as a callout row's menu (`openCalloutRowMenu`), which keeps its own copy
because its lifetime also covers the wait for the callout counts.

While open the field says `aria-expanded="true"` and shows nothing else, as
Obsidian's `<select>` shows nothing (an icon button keeps its ring, `is-open`);
`onHide` clears it. If a click on a menu row left focus nowhere, focus returns
to the field. Inside the menu the keyboard is Obsidian's: its arrows, Enter and
Escape come from the menu's own key scope, so the plugin's Escape handling
(`ui/menuEscape.ts`) is not involved. The field's accessible name is a hidden
label plus the value (`aria-labelledby="<label> <value>"`), because the field
has no value of its own to announce, and `aria-label` would show as an
Obsidian tooltip.

The adapter owns the options and the value: `setValue` is silent, `onChange`
fires only for a user's pick of a different option, and `onPick` for every pick
(the language menu retries a pending download when its own language is picked
again). `setOptions` keeps a still-valid value or takes the first option, and
closes an open menu, which would otherwise offer the old options; a pick of an
option that is gone is ignored. The field is as wide as the current option's
words, as Obsidian's `<select>` is. Callers destroy the adapter when its row or
owner goes; `destroy()` closes an open menu and disables the field for good.

### A picker's popover

A picker (`ListboxPopup`) opens Obsidian's own popover under its field: the one
Obsidian's combobox opens in Bases and in the file pickers of its Settings
(2026-11-01). Its markup is Obsidian's, so app.css draws it:

- `div.suggestion-container.cs-combobox-popup`, with `combobox` added when the
  picker is searchable: Obsidian's popover frame (`--suggestion-background`,
  the ground; a 1px `--background-modifier-border` edge; `--radius-m` corners;
  `--shadow-s`);
- at the top, a searchable picker's search box: Obsidian's `SearchComponent`
  (`ui/searchField.ts`), which app.css draws flat inside a `.combobox`, with its
  magnifier and its ×;
- under it the list, `div.suggestion.cs-combobox-menu[role=listbox]`: Obsidian's
  `.suggestion`, which gives it its 6px padding and its scrolling.

styles.css paints none of the frame (`tests/dropdownPopupSurface.test.ts`). It
only names the ground once, `--cs-menu-face: var(--suggestion-background,
var(--background-primary))`, for what must repaint it, and places the popover:
it hangs under the field from the field's **end** edge (`inset-inline-end: 0`:
the right in English, the left in Hebrew), since a field sits at the end of its
row, so it opens toward the row's middle. It is at least as wide as the field
(and 220px), grows with its rows, and stops at 320px wide and 320px tall;
`ui/listboxPopupLayout.ts` lowers both caps and shifts it sideways
(`--cs-dropdown-menu-*`) to keep it inside the window and every clipping box,
and flips it above the field when there is more room there.

A plain choice opens a real Obsidian `Menu` instead (see
[Shared dropdown controls](#shared-dropdown-controls)): Obsidian's own from end
to end, so it needs no rule here.

**The rows.** `.cs-combobox-option` is laid out like `.menu-item`: flex,
an 8px gap, `4px 8px` of padding, `--radius-s` corners, Obsidian's `--cursor`,
13px text on a computer and 15px under `.is-mobile`. The size lives on the row;
the words inside inherit it. The row under the pointer or the arrow keys
(`.is-active`) is `--background-modifier-hover`, as `.menu-item.selected` is,
so the highlight is a rounded pill inside the list's padding.

**The chosen row has no fill.** It carries a ✓ at the end of the row instead,
which is what Obsidian's `MenuItem.setChecked(true)` draws.
`appendComboboxCheck()` in `ui/listboxPopupDom.ts` appends
`span.cs-combobox-check` (Lucide `check`, `aria-hidden`, since the row's
`aria-selected` already says it is chosen). `renderComboboxRows` calls it for the
committed row of every list after the caller's `renderRow`, so the ✓ always
lands last. The check is
muted and at `--icon-s`, as `.menu-item-icon` is, and `margin-inline-start:
auto` pushes it to the end even when the row's content is short. The icon-source
menu's own smaller check (`.cs-source-check`) is gone: it uses the shared one.

**Groups.** A `.cs-combobox-group` reaches across the list's 6px side padding
(negative margin, the same padding put back inside), so that:

- the line between two groups spans the whole list, as `.menu-separator` does:
  one `--background-modifier-border` line with 6px of air on each side;
- the sticky heading (`.cs-combobox-group-label`) can span it too, edge to edge,
  and hide the rows scrolling under it. It paints the opaque `--cs-menu-face`.
  Its padding puts its words where the
  rows' words start, 14px from the edge. Its type is the S6-05 one: small,
  semibold, `--text-muted`, sentence case.

The source menu's closing note (`.cs-combobox-footer-note`) draws the same
full-width line above it.

**Things that repaint the ground** read `--cs-menu-face`: the sticky heading,
the ring cut around overlapping colour circles, and the transparent swatch's
checkerboard.

**History.** Until 2026-10-23 the lists wore their control's grey face
(`--cs-btn-face`) with a field-coloured edge, a heavy two-layer shadow and a
filled stripe behind the chosen row; from then until 2026-11-01 they were drawn
by hand like Obsidian's `.menu` (`--menu-*` tokens, kept at the field's width).
They are Obsidian's combobox popover now, because the picker is Obsidian's
combobox. Please do not paint the frame again.

`tests/dropdownPopupSurface.test.ts` pins the popover's classes, that no plugin
rule paints its frame, the row layout, the absence of any fill on a chosen row,
the ✓, the separators and every repaint of the ground.
`tests/listboxPresentationState.test.ts` checks that only the committed row
carries the ✓, as its last child, and that it moves with the choice.
`tests/modalBodyLayers.test.ts` allows the sticky heading to paint
`--cs-menu-face`, and `tests/modalSurfaces.test.ts` lists the ground's
`--background-primary` fallback as reviewed.

### Option rows are padded once

Every row of a popup list is padded in one place: the shared row rule
(`.cs-combobox-option`), `4px 8px` as on Obsidian's `.menu-item`. The plain choices draw no rows at all any more:
their list is Obsidian's `Menu`.

Until 2026-10-23 a plain choice's label owned the padding (`6px 12px`). Before that, the
command editor's four selects and the palette editor's **Style** select also
added `padding: 8px 12px` to the *row*, on top of the label's, which put their
text 25px in and made their rows 45px tall. The icon picker's filters, its skin
tone picker, its source menu and the Find callouts "every type" row each padded
their rows themselves too; all of those rules are gone.
`tests/dropdownOptionRows.test.ts` fails if the old label rules come back, or if
any rule reaches a row through another class and pads it a second time.

### The id line under a callout's name

`renderCalloutIdLine` (shared by the picker and the `[!` popover) draws one
`.callout-studio-suggestion-id-item` per id, each carrying its own trailing
`", "` (the last has none), inside `.callout-studio-suggestion-id`, which is
also Obsidian's `.suggestion-note`. The part of an id that matches what was
typed is Obsidian's `.suggestion-highlight` (bold); until 2026-10-24 the rest
of the id was faded instead. The line is
cut by the browser and by nothing else: `text-overflow: ellipsis` on the line
hides atomic inline boxes whole, so a line that does not fit always ends
`abstract, …` - cut between ids, the native `…` after a comma and a space,
identical on every row. A single id longer than the whole line ellipsizes inside
its own item.

It used to work out how many ids fit with a canvas measurement and append a
literal `...`, *and* carried the native ellipsis as a fallback. The measurement
ran while the rows were being built, before the list overflowed and a scrollbar
(12 - 17px) narrowed every row, so rows that had just fit now overflowed and got
the browser's `…` on top of the typed `...` - in one list, `check, ...`
(three monospace cells wide), a glued `…` and the two overlapping. Never measure
this line. The id line is also `direction: ltr` in any window, right-aligned under
`.mod-rtl` so it lines up with the name above it: ids are code, and in an RTL
window the bidi algorithm reordered the run and stranded the commas.

### The shared callout picker

Every place the user picks one callout out of a list is the same control:
[`calloutCombobox.ts`](../../src/settings/calloutCombobox.ts), over
[`ui/listboxPopup.ts`](../../src/ui/listboxPopup.ts). It replaced two native
`<select>`s - *Default fallback callout*
([`fallbackPicker.ts`](../../src/settings/sections/fallbackPicker.ts)) and
*Callout type* above - neither of which could be searched or showed a callout's
icon or colour, while the `[!` popover in the editor had done both for a long
time.

**It is Obsidian's combobox** (2026-11-01), the shape Obsidian uses in Bases and
for the file pickers in its Settings: the field is Obsidian's dropdown (see
[How an input field focuses](#how-an-input-field-focuses)), showing the
committed callout's icon in its colour before its name, and a click, Enter,
Space, ↓ or ↑ opens [Obsidian's popover](#a-pickers-popover) with a search box
at the top and the list under it. A letter typed on the closed field opens it
too, with that letter already in the search box, as Obsidian's does. Until
2026-11-01 the field *was* a text input you typed into; it could never look or
behave like the dropdowns beside it (a text cursor, a ring whenever it had
focus, a width that had to be faked from a hidden copy of its text).

Who has the keys and the ARIA:

| | Searchable (callout, colour) | Select-only (icon source, skin tone) |
| --- | --- | --- |
| The field | `role="button"`, `aria-haspopup="listbox"`, `aria-expanded`; opens the list | `role="combobox"` with `aria-controls` and `aria-activedescendant`; opens, moves, types ahead, commits (a `<select>`'s keys) |
| The search box | Obsidian's `SearchComponent`, `role="combobox"`, `aria-autocomplete="list"`, `aria-controls`, `aria-activedescendant`; takes the focus on opening (not on a phone or tablet, where that would raise the keyboard every time: a tap does it): ↓/↑ move, Enter commits, Escape and Tab close | none |

Escape and a pick give the focus back to the field (a pick made with the mouse
marks it `mouse-focus`, so no keyboard ring is drawn); Tab in the search box
closes the list and puts the focus on the field, and the browser's own Tab then
moves on from there, as in Obsidian's combobox. A blur closes the list only when
the focus leaves the picker: moving between the field and its search box is not
leaving.

The rows are literally the popover's rows: `AutoComplete.renderSuggestion`
calls [`calloutComboboxRow.ts`](../../src/settings/calloutComboboxRow.ts)'s
`renderCalloutComboboxRow` itself, so a callout cannot describe itself one way
in the editor and another way in settings. Both are built by
[`ui/suggestionRow.ts`](../../src/ui/suggestionRow.ts) in Obsidian's suggestion
anatomy (`.suggestion-icon > .suggestion-flair`, `.suggestion-content` with
`.suggestion-title` and `.suggestion-note`; see doc 10). In a picker the row is
a `.cs-combobox-option`, not a `.suggestion-item`, so Obsidian's suggestion
rules do not reach it and the menu-row rules lay it out (4px 8px, 8px gap).
The one Obsidian rule that does reach it, the end margin `.is-mobile
.suggestion-flair` gives every flair, is zeroed for a picker's row, where the
gap already spaces the icon. The icon is in the callout's colour; the name is
in the row's normal text and wraps when long (until 2026-10-24 it wore the
callout's colour and was cut with "…"). The matched run of the name and of
each id is bold. Matching goes through the same `calloutMatchesQuery` - id,
display name and **aliases**, substring rather than fuzzy - ordered by
`matchRank`'s four tiers (exact, name-prefix, id/alias-prefix, anywhere) so that
typing `no` answers `Note` rather than `Annotation`.

An optional `groupOf` callback supplies a stable group key, translated label,
and numeric order. When supplied, groups take priority over search ranking,
while rows within each group keep the normal match/name order. Only the
**Find callouts** picker enables this for registered and unregistered
choices; other callout pickers keep their existing flat lists and choices.
Headings and dividers reuse the palette picker's rendering, and filtering out
all rows in a group removes its heading too. Each contiguous group is wrapped
in a `role="group"` element with `cs-combobox-group`; its opaque
`cs-combobox-group-label` is sticky at the menu's top until the next group
replaces it. Group containment handles the handoff without scroll listeners.
The occurrence picker sets `hideSingleGroup` to suppress redundant headings,
while `showSingleGroupKey` keeps the Browse heading when All types is the only
matching group.
The type follows Obsidian's own suggestions. A group heading is small,
semibold and muted in sentence case, like `.search-suggest-item.mod-group`
(Obsidian uppercases only badges). A name takes its row's size: the field's
13px (`--font-ui-small`) in a picker, as `.combobox .suggestion-item` is, and
Obsidian's 15px suggestion size in the `[!` popover in a note. No rule sizes
the name itself. A query that matches nothing
reads upright and centred, like `.suggestion-empty`.
The All types scope is iconless and remains separate from registry definitions.
Color pickers retain their headings even with only one matching group.
`renderComboboxRows()` sets `cs-combobox-menu-grouped` only when it actually
creates a group, clearing it before every rebuild. That class owns the menu's
top padding and sticky-heading scroll allowance, including transitions to
ungrouped, empty, or create-only results.

One option adds something after the rows. `footerNote()` is information -
plain text asked on every rebuild, nothing when it returns `""` - drawn last as
`cs-combobox-footer-note` with no role and no listener, outside `rowEls`, so
nothing highlights it and a press on it is swallowed by the menu's
`mousedown`. A rule above it, the same as between groups, marks the end of the
list. Pick an icon's source menu uses it to count the libraries left to
download.

The occurrence **Format** filter and the command editor's Format, Heading level,
Action and Fold state rows are not this picker: they are `SelectDropdown`s,
which open Obsidian's own menu (see
[Shared dropdown controls](#shared-dropdown-controls)).

A query that matches nothing does **not** dead-end. When the call site supplies
`onCreate`, the empty state is replaced by a real, keyboard-reachable row
offering to create the callout under that name - the same offer, and the same
markup (`createSuggestionRow` with a plus, `callout-studio-suggestion-create-new`
kept as a hook), as the `[!` popover. It is a plain row like the others; until
2026-10-24 it was italic accent text. The picker
then adopts what comes back, which is why `choices` is a *function*: the list is
re-read after the editor closes, so the new row is simply there.

Two rules in `listboxPopup.ts` carry the searchable mode and are worth reading
before changing it:

- **The query is separate state from the committed choice.** Every opening
  starts with an empty search box and the whole list (searching for the
  committed label would list exactly one row), and the field goes on showing the
  committed choice while you search.
- **Blur never commits.** Leaving with half a word typed reverts. `fallbackCalloutId`
  is persisted *and* synced, so a picker that guessed "probably the first match"
  would write an id the user never chose onto every device.

`setSelected(key, missingLabel)` can supply a display label when no list item
resolves. The value remains `undefined`, but the field retains that label and
keeps its leading swatches visible; dismissing a search leaves the same label.
`PaletteCombobox.setSelection` uses this for **Deleted color**, so a missing
palette does not mark the control `is-empty`. Opening that unresolved selection leaves every option inactive;
once open, pointer hover or keyboard navigation establishes the active row.
This prevents the first saved colour from looking preselected when none is
selected.

Pointer highlights and keyboard highlights have separate origins. Leaving a
row or the menu clears a pointer highlight and the temporary colour preview;
the committed value stays unchanged. Arrow-key highlights survive pointer
exit. The last active input method owns the one visual highlight: an arrow key
suppresses `:hover` on a stationary pointer row, and actual pointer movement
returns the highlight to the row beneath it, even without another `mouseenter`.
Hover never scrolls a row into view; keyboard navigation does. The icon-source
menu and pack filters use this same component. Quick Insert follows the same pointer/keyboard
distinction through its single `is-active` highlight. A row that is both
`is-selected` and `is-active` shows the ordinary highlight under its ✓: a
chosen row has no fill of its own, so hovering the committed option never looks
inert.

Callers **must** call `destroy()` - a modal from `onClose`, a settings section
through `registerDisposer` - because the popup holds a document-level click
listener. Destruction also disables the detached input permanently so stale
DOM events cannot reopen a menu and attach new listeners.

`ui/menuEscape.ts` registers a keyboard host at each plugin modal and settings
surface. A menu pushes a temporary public Obsidian `Scope` only while open and
pops it on close; the first Escape dismisses the menu, while the next reaches
the original host. A DOM key listener alone is too late for Obsidian's keymap,
and a permanent child scope would swallow Escape even when the menu is closed.
The icon-source menu shares this lifecycle. No global app lookup is needed.

Every popover is capped at 320px tall, and `listboxPopupLayout.ts` fits it to
the visual viewport and all clipping ancestors, including inner scroll bodies
and sidebar panes. It normally opens below the field; when its content will not
fit and there is more room above, it opens above. Horizontally it hangs from
the field's end edge and is shifted back inside the window, in either
direction. Its natural height is the list's `scrollHeight` plus everything
around the list (the edge, the search box), so a capped popover does not flip
back and forth. Layout runs after rendering/filtering and updates on viewport
resize, surrounding scroll, and control/container resizing. Closing removes
these listeners, observers, and temporary layout properties.

One detail in [`listboxPopupEvents.ts`](../../src/ui/listboxPopupEvents.ts) is
load-bearing and has already been a bug: the popover's `mousedown`
`preventDefault()` (on everything but the search box itself) is what lets a
mouse selection commit at all - a click on a row is also a blur, and blur lands
first.

Field names are assigned by `fieldAccessibleName.ts`, using a hidden sibling
label referenced through `aria-labelledby`. The label has the `hidden`
attribute, with `opacity: 0` and `pointer-events: none` as a CSS fallback if a
theme overrides its display. This keeps accessible names without the hover
tooltip Obsidian derives from `aria-label`.

The Color row uses the same popup through
[`paletteCombobox.ts`](../../src/settings/paletteCombobox.ts), which adds group
headings (*Custom* / *Obsidian* / *Presets*, emitted per run so a group filtered
to nothing leaves no stranded heading). A query with no match offers a
keyboard-reachable action to create a color under that name.
Only the *control* moved out of `CalloutEditor`: which palette the form's colours
resolve to, the "Deleted color" state when they resolve to none, and the
save-state baseline that feeds all stayed, because they read and write editor
state.

### `hotkeyLink.ts` - reading a binding Obsidian doesn't expose a public API for

`printHotkeyForCommand` goes through the undocumented `app.hotkeyManager`,
guarded structurally (an unreadable binding reads as `""`/unassigned rather
than throwing - every internal API access in this codebase follows this
pattern). Because that helper only ever formats the **first** binding on a
command bound to more than one shortcut, showing every binding means
re-implementing Obsidian's own key-formatting tables by hand
(`MODIFIER_GLYPHS`, platform-specific: `⌘⌃⌥⇧` stacked with no separator on
macOS, `Ctrl + Alt + Shift` spelled out with `+` elsewhere) - duplicated
rather than simplified, specifically so the same shortcut can never read two
different ways in two different windows of this plugin.

### `WelcomeModal` - the one chrome opt-out

Covered above under Modal chrome. The hero name takes the size and weight
Obsidian gives a plugin's name in its details window (`--h2-size`, semibold,
`--line-height-tight`). The removed title leaves an empty `.modal-header`, and
it is kept on purpose: its 0.75em bottom margin on the desktop (its padding on a
phone) is what holds the columns clear of the absolutely positioned close
button. Hidden, the ✕ lands on the corner of the preview box. The
left column aligns to `start`, so it mirrors under a right-to-left interface. Automatic onboarding requires confirmed
fresh-install eligibility and checks both `settings.welcomeSeen` and the
device-local welcome marker. An absent `data.json` alone is insufficient; see
the [startup decisions](08-settings-sync-and-recovery.md#launch-decision-table).
The welcome screen can be reopened via the info icon in settings or the
dev-convenience protocol handler `obsidian://callout-studio-welcome`
registered in `main.ts`.

The sample's **Learn more** link uses `USER_GUIDE_URL` in `WelcomeModal.ts`,
passed through the existing `repoUrl` translation placeholder. It targets
`docs/user-guide` on GitHub at revision `fa1c8e29aa1f9a40b7a90226d12197c6fe96f1f4`.

Only the automatic first-launch welcome (`new WelcomeModal(plugin, true)`) adds
`welcome.syncNote` below the tagline: a user joining from another device should
let sync finish, and their setup appears once it arrives. It is informational;
the [genesis rule](08-settings-sync-and-recovery.md#a-devices-first-file-and-the-shipped-defaults)
is what keeps this device's defaults from overwriting that setup.

#### It demonstrates itself with a demo callout of its own

The right column is a real `LiveCalloutPreview` rendering `welcome.sample`,
which shows all three render roles at once. It used to show them with the real
built-ins `tip`, `warning` and `note`, and that was wrong twice over:

- Those are exactly the ids a theme restyles **by name**, so on several popular
  themes the heading and inline examples were unreadable.
- For an *unmodified* built-in, `CSSInjector` deliberately hands the accent to
  Obsidian's own `--callout-tip` variable rather than a hex (see
  [CSS generation](06-css-generation.md)) - so the splash was advertising the
  theme's colours rather than the plugin's.

It now uses `WELCOME_DEMO_ID` (`demo`) and registers its own violet definition
into the registry's transient preview slot via `beforeRender` -
[`welcomeDemo.ts`](../../src/settings/welcomeDemo.ts).

##### Why this one id is *not* reserved

`demo` is deliberately **absent** from `RESERVED_DEMO_IDS`, and that is the
single respect in which it differs from the other two demo ids. The splash
sample is copy a user reads, and `> [!global-style-demo]` puts plumbing in the
middle of the one screen whose whole job is to teach the syntax - so this id is
spelled the way a person would write it.

The price is exactly what reservation buys, and it is not worth paying here.
`new-callout-preview` and `global-style-demo` are spelled with a dash, which
`sanitizeCalloutIdInput` folds to a space, so **no user can mint them** and
reserving them costs nothing. `demo` is an ordinary word the editor does
produce (`"Demo"` → `demo`), so reserving it would quietly cripple a callout
somebody legitimately named "Demo": filtered out of the autocomplete, dropped
from their export, rejected by their own re-import - with nothing in the editor
telling them the name was taken. A reserved id has to be one nobody can reach.

What stands in for reservation is that the definition exists **only while the
splash is open**, which is all the isolation it needs: `setPreviewDefinition`
never persists and never notifies, `definitionsForLists()` hides it from every
settings list, and if the user *does* own a real `demo` the preview slot
shadows it and hands the real row back on close (`previewShadowedDef`). The one
residue is cosmetic and transient - their own `[!demo]` callouts in a note
behind the modal repaint violet until it closes. `tests/welcomeSample.test.ts`
pins the non-reservation so a later tidy-up cannot undo the reasoning.

Two halves are needed, and only together:

1. **The id**, which removes the by-name attack - no theme has a rule for an id
   it has never heard of.
2. **A scoped hardening block in `styles.css`**, which handles what an id change
   structurally cannot: a theme's *generic* selectors. `.callout { … !important }`
   still reaches the block role, and plain heading rules still reach the heading
   role - the injected `.cs-heading-callout` / `.cs-inline-callout` rules carry
   no `!important` at all, on purpose, so a theme wins those without a fight.
   The block restates the same values under `.cs-welcome-modal`, keyed on the
   demo id, with repeated compounds for weight (the trick
   `manager/theme/studioWeight.ts` uses). Among `!important` author declarations
   the higher specificity wins, so it survives; and because it is scoped to the
   modal and the id, it can reach nothing else - load-bearing here rather than
   tidiness, since a user may own a real `demo`.

   It restates, and does not invent. All three roles carry
   `color-mix(in oklch, <accent> 12%, transparent)`, which is
   `.cs-heading-callout`'s and `.cs-inline-callout`'s own default formula copied
   verbatim: the hardening changes the *weight* of the plugin's answer, never
   the answer. That is also why the inline example is a tint and not the solid
   violet lozenge it was for one revision - a solid pill is a look the plugin
   gives no other inline callout, so the splash was demonstrating something
   users could not reproduce.

`onDestroy` clears the slot and re-injects. That inject is not just tidying: on
a fresh install this modal holds a preview definition during the very first
launch, and `injectNow` skips the startup CSS snapshot for as long as one is
live - so this is the inject that writes it.

The demo never becomes a real callout. `isDemo` keeps it out of the settings
lists and out of `data.json`, and the slot is cleared on close - see
[Callout registry](05-callout-registry.md#reserved-demo-ids) for the permanent
guarantees the other two demo ids get on top of that, and the section above for
why this one does not take them.

## Saving-status banner

`saveStatusBanner.ts` is shared by the settings and the callout editor. It
subscribes to `SettingsWriter.status` and redraws only its own slot, preserving
scroll position and form fields.

In the settings it is a row of the notices box, the first box of the main page
(`declarative/bannerRows.ts`), since it is the reason nothing below it will be
saved. The notice is a persistent part (26 § Parts that survive a redraw), so
the page can redraw around it without it forgetting an action under way.

Each redraw builds the same three parts: a header (the brush mascot, or `alert-triangle` where it cannot be drawn,
plus a title row), the message paragraphs, and `.cs-readonly-banner-actions` holding whatever
actions apply. The title is chosen from the writer, not from the message -
`isFrozen || status.frozenReason` reads as *Saving is paused*, a bare
`status.failure` as *Settings were not saved* - so a frozen session that also
fails a retry still says it is paused. The action row is `flex-start`-aligned
with the prose and stacks full width under 600px.

**It looks like the warning box Obsidian's Keychain settings show** (finding
GAP-08), and so does the first-install import prompt, in the accent instead of
the warning colour: Obsidian's callout corners and padding (`--callout-radius`,
`--callout-padding`, which core mirrors for right-to-left), the title in
`--text-warning` and `--callout-title-weight`, and a 10% tint mixed as Obsidian
mixes a callout's (`color-mix(in oklch, var(--text-warning) 10%, transparent)`).
Both stay the plugin's own markup rather than a real
`.callout[data-callout=warning]`: the plugin styles every such callout and
paints icons into it, so the user's own Warning callout design would have
reached the banner. The colour is `--text-warning` (or `--interactive-accent`),
never `--callout-warning`, which some themes still declare as an RGB triplet,
and never `rgba(var(--callout-…))`, invalid since Obsidian 1.13 made those full
colours. There is no outline, as Obsidian's box has none; until 2026-10-24 the
card was outlined on all four sides (rather than barred down one edge, so it
read the same in an RTL locale). `tests/statusBannerLook.test.ts` holds all of
this.

The action choices, before/after behavior, confirmation policy, failure reasons
and editor restrictions are owned by
[Saving status and recovery actions](08-settings-sync-and-recovery.md#saving-status-and-recovery-actions).
Keep this UI as a subscriber to that state rather than inferring write authority
from a label or from whether callouts happen to be visible.

Buttons are disabled while their action is running. A completed missing-file
check leaves explicit feedback in the same slot. The settings' notice is
disposed of when the visit ends, the editor's when it closes. Action text uses `t()`, and so does the paused
copy below; a one-off failure's message uses the shared saving-message contract
described in the canonical chapter.

For an unreadable file the banner asks `actions.diagnose()` once per paused
episode, and again after each action. **Replace settings file** appears only
for causes waiting cannot fix, and **Discard recovery copy** only for a
`recovery-read` freeze. Both are red (`mod-destructive`) and run only after a
`ConfirmModal`. The one exception to the red is a `combined` file: replacing
it keeps every setting, so **Replace settings file** is the main button
(`mod-cta`), its confirmation's button is too, and after the yes the banner
diagnoses the file once more and replaces nothing if it is no longer `combined`
(or readable), because keeping everything was the promise. The retry button
reads **Try again** (**Check again** for a missing file). **Go to version history**
is offered in every state in the settings (below). The settings pass
`recoveryActionsOf(plugin)` and their own **Go to version history** in
`declarative/bannerRows.ts`; the callout editor passes only its retry.

### What a paused banner says

Whoever reads a paused banner has usually just seen "missing" next to their
settings and assumed the worst, so every paused state - frozen for `missing`,
`unreadable`, `recovery-read` or `newer-version` - reads the same way, in two
or three short paragraphs chosen by `pausedCopy()` in
[`saveStatusCopy.ts`](../../src/settings/saveStatusCopy.ts):

1. **Calm.** "First of all, take a deep breath - everything is going to be
   okay", then what is safe, then why the page is read-only (`pausedNote`:
   while saving is paused the pages' rows are disabled and every change
   refuses with its reason, 26 § Read-only while saving is paused). The editor
   gets the same paragraph without the page sentence.
2. **What happened**, from `status.reason` (latest failure, else the frozen
   reason). After a manual **Check again** finds the file still missing, it
   gets more specific and names the cloud-storage "keep it downloaded" setting
   that most often keeps a synced file away.
3. **What to do**, from `status.frozenReason` - the field that decides the
   buttons. A known cause of an unreadable file goes here, as the existing
   `saveStatus.diagnosis.*` text.

While an action runs, the calm paragraph stays and "Working on it…" replaces
the other two, so the card does not collapse. A one-off
*Settings were not saved* failure (not frozen) keeps its single message and,
for an unreadable file, the diagnosis as a muted `.cs-readonly-banner-detail`.

Two rules keep the words honest, and `tests/saveStatusCopy.test.ts` checks both
across every paused state, failure, surface and diagnosis:

- **A sentence that names a button appears only with that button.** The banner
  decides its buttons once (`PausedButtons`) and passes the same answers to
  `pausedCopy()`, and each "choose X" sentence is a key of its own. A reason
  whose usual message names a button the paused banner may be labelling
  differently gets paused wording of its own: `changed`'s message names
  **Try again**, which reads **Check again** for a missing file.
- **A comforting claim needs a fact.** "Your callouts are still here on this
  device" only when `writer.hasRecoveryState`, never over a page of built-ins.
  "Checks again every minute" only where `rechecksWhilePaused()` - the same
  function `pausedRecheck.ts` runs on - says the timer covers the state.

### Guided order for a missing file

With a missing file on the settings page, the next step is the main button:

| When | Buttons |
| --- | --- |
| Nobody has checked yet | **Check again** (`mod-cta`) · **Restore these settings** / **Create settings file** · **Go to version history** |
| A manual check came back empty | **Restore these settings** (`mod-cta`) or **Create settings file** · **Check again** · **Go to version history** |

`checkedMissing` holds the second state for the rest of the missing episode, so
the order does not flip back while an action runs or after a cancelled
confirmation; `stillMissing`, which only colours the message after a check, is
separate. **Create settings file** is never the main button: what is shown may
be only the built-ins. Every other state, and the editor, keep one order.

### Go to version history, and scrolling to a row

**Go to version history** (`showBackup`) opens the Version history **page**
(`ctx.jumpTo("earlier-versions", fromKeyboard, ["earlier-versions"])`), the way
the first-install import prompt takes the reader to the **Import callouts** row.
Both use the settings' jump (`declarative/jumpToRow.ts`, 26 § Jumping to a row),
which does what a settings search result does: Obsidian's own page path, and
(for a row) the row scrolled to the centre and flashed with Obsidian's
`is-flashing`, and focus on it only after a key press (the buttons report a click
with `event.detail === 0`, Enter or Space, as from the keyboard). A page is
opened by `app.setting.openPagePath`, which arrived in 1.14: on 1.13.x the
button is **left out** (`canOpenSettingsPage`, `bannerRows.ts`), since a button
that cannot go anywhere is worse than none, and the page stays one row away on
the main page. Until 2026-10-25 the old page scrolled there itself and pulsed
the row in the accent colour.

## `VersionHistoryPage` - Version history

A page of the settings, not a window (until 2026-10-27 it was a window,
`SettingsRecoveryModal`, opened by a **View versions** button). Its row on the
main page is `versionHistoryRow` (`declarative/versionHistoryPage.ts`): a page
named **Restore an earlier version** with the description *settings.versionsDesc*, as
the first row of the Danger zone, shown only on a host with a recovery service.
The page is a lazy `SettingPage` like Built-in callouts
(`calloutListPage.ts`): Obsidian calls `display()` when it opens and `hide()`
when it is left, never draws it again, and leaves it out of the settings search.
`display()` asks `recovery.listVersions()` once per open (a generation counter,
bumped by `hide()` and every reload, drops a late answer) and draws the versions
newest first; a delete or a restore draws the list again (a restore does not
leave the page: the comparisons with "now" are simply new). Each draw compares
every row through one `recovery.differences()`, which reads the setup shown now
once (`differencesFrom`, `setupDifference.ts`), rather than once per row as
`difference()` would; that halved the comparison on a 754-callout setup. The
service keeps what it has read, so a second open and the list after a delete
or a restore come back faster ([Settings sync and
recovery](08-settings-sync-and-recovery.md)).
The saving banner's **Go to version history** opens this page (see above).

**A timeline.** The look it had before the 1.13 rewrite, from the 2.x releases,
restored on 2026-10-27 after a short life as one Obsidian group per day
(finding S9-05). A rail (`.cs-recovery-rows`, `padding-inline-start` of a 6rem
gutter, a 1px line made of the `::before` of every day heading and card) runs
down the start side. Each version is a card (`.cs-recovery-row`: Obsidian's own
`.setting-item`, which already is a raised rounded box on a page, plus
`cs-row-inline` so the buttons stay beside the text on a phone) with a `<time>`
in the gutter (`cs-recovery-time`, the time only: the date is the heading's) and
a decorative dot on the rail (`renderVersionMarker`, `cs-version-marker`,
`aria-hidden`). Each local calendar day has a heading, an `<h3
class="cs-recovery-day">` that joins the rail with a short connector. The rows
are directly on the rail, not in a `SettingGroup`; the cards sit 2px apart.
Two Obsidian rules reach the rows and are cleared on specificity. A heading
after a `.setting-item` gets 24px of margin (`.vertical-tab-content
.setting-item ~ :is(h1, h2, h3, …)`); that margin lies outside the heading's
box, where the rail's segment does not reach, so the line used to break off
above every day but the first. The day's own padding is its whole separation, so
the margin is 0 (the class is doubled). And `.setting-item` is `align-items:
flex-start`, which left the buttons at the top of a three-line card; the card is
`center`, so they sit level with the time and the dot (when they wrap under the
words on a phone they stay at the end of their own line).
The page's box (`.cs-recovery-page`, the `.setting-page-content`) is
`isolation: isolate`. Obsidian's sticky `.setting-page-titlebar` is `z-index: 1`
and a sibling just before that box; the times are `position: absolute;
z-index: 1` (above the row's hover area), the same level and later in the
document, so without the isolation the clock digits were painted over the bar
while the cards scrolled behind it. As its own stacking context the whole page
counts as level 0, under the bar.
`versionRowLayout.ts` (a `ResizeObserver`) puts `cs-recovery-controls-wrapped`
on a card whose buttons dropped under its words, which is when the two counts
share a line (`.cs-recovery-summary-counts`). The text column keeps a 12rem
floor (`min-width: min(12rem, 100%)`, with `flex: 1 1 0`) so a name and its
summary never shrink to a letter per line. The floor is deliberately not a
flex-basis: Obsidian's narrow-row rule turns the card into a **column**, and a
basis of 12rem there is a height, which left a blank gap between the text and
the buttons below it (a flex item's `min-width` still counts when the row is
broken into lines, so the card wraps at the same width). The card is not a size
container (`callout-studio-row` is not used),
because Obsidian's unnamed `@container (max-width: 400px)` settings rules would
then pin the controls to the full width of the card. **Restore** is red again
(`setDestructive()`, Obsidian's red button; the deprecated `setWarning`
is not used): it replaces the whole setup on every synced device. The heading
starts with the localized date (`dateStyle: "long"`), then **today**,
**yesterday** or **N days ago** in parentheses, including for versions older
than a week. Relative wording uses `Intl.RelativeTimeFormat`, with
`numeric: "auto"` for today and yesterday and `"always"` for earlier days; day
differences use local calendar dates so DST and time of day cannot shift the
age. Future dates have no relative suffix. Unknown dates have their own final
heading, and no time is invented for them. This display grouping does not change
stored timestamps or retention rules. **Loading…** and **No versions were
found** are one quiet line (`cs-recovery-status`), the latter under the dozing
mascot.

A setup kept in two places is one row; the merge rule and where the reasons
behind its automatic name are stored are in
[Recovery without file surgery](08-settings-sync-and-recovery.md#recovery-without-file-surgery).

Each row is a `Setting` added to its day's group (`cs-recovery-row`, and
deliberately not `callout-studio-row`, whose pill, padding and size container
would draw inside the box):

- **Time:** a `<time>` element (`.cs-recovery-time`, with a `datetime`) starts
  the row's name: the short time in the interface locale, muted, digits one
  width (`tabular-nums`), and `unicode-bidi: isolate` so a right-to-left
  interface does not reorder it with the name. The group heading provides the
  date. On a phone (`.is-phone`) the time takes a line of its own above the
  name, since the row is narrow beside the two icons and Restore. An unknown
  time is left out.
- **Name** (`renderVersionName()` in [`versionRow.ts`](../../src/settings/versionRow.ts)):
  plain text naming why the version was kept. If the reason is absent or unknown,
  `versionCategory()` selects **Automatic backup** when any `history` or `backup`
  source is present, or **Sync copy** for a version made entirely of `copy`
  sources. This category is only a fallback title; known reason titles are
  unchanged. The name has no edit button or field.
- **Summary** (the description): "Same as your current setup", "Can't be read
  as settings", or the callout-type and difference counts, a line each. Sync-copy
  filenames are not displayed.
- **Controls:** **View details** (eye; every row, including a version identical
  to now, which shows **Same as your current setup**), **Delete** (trash, red only on hover or focus) and, for a
  readable version, **Restore**. Hovering a row only sharpens its icon buttons
  (see "List rows and hover"). On a phone or tablet Restore stays compact
  beside the icons rather than taking Obsidian's full-width, 10px-padded phone
  button, and the icons and gaps tighten, so the name keeps as much of the row
  as it can.

**Delete** confirms removal of the available copies once, adding a warning about
file deletion syncing only when the version includes backup or sync-copy files.
Another device's private history may retain the version. Then
`recovery.removeVersion()` deletes every available copy; the list is read again
either way. **Restore** is red, in the same quiet red as the confirmation it opens
(it was a plain button under finding S9-04, and red again since the 1.13
rewrite). It is dimmed (not disabled - a press says
why, see [Blocked main buttons say why](#blocked-main-buttons-say-why)) while
saving is paused or when the version equals the current setup, and confirms
before calling `recovery.restore()`; both confirmations and their notices quote
the version's name. There is no per-entry export action; the settings page's
ordinary **Export** continues to export the displayed setup.

`SettingsRecoveryDetailsModal` (**Version details**) opens over that list as a
read-only report, including while saving is paused. The source's saved date and
time appear in parentheses beside the modal title, in smaller, muted text within
the same header; a missing time uses localized `recovery.details.unknownTime`. The
version's automatic name remains in the history list rather than appearing again
in this window. Details starts directly with **What changed**, without a category
badge, source explanation, storage card, or sync-copy filenames. Underlying source
metadata, dates, grouping, retention, and deletion behavior are unchanged.

**What changed** has no frame (finding S9-12: Obsidian's windows have no boxed
info panels; it was a bordered card until 2026-10-24). It has a smaller, muted
heading on a full-width row. Below the heading, the
difference total and comparison context (such as **24 differences from your
current setup**) and removed/changed/added pill badges share one row where
space allows. The flex layout wraps on narrower screens or with longer translations.
The total uses smaller, muted text; the pills retain their red/yellow/green fills.
An equal version uses **Same as your current setup** with no counters.
An unreadable version uses **Comparison unavailable**, with its explanation
on a full-width row below.
`recovery.details(source, version)` captures the source and current setup when opened;
rendering does not load that version into the active registry. The report stays
on that snapshot until closed; reopening details captures a new comparison.

`recoveryComparisonTable.ts` lays the report out as one table per settings section,
in the settings page's order, each with four columns: **No.**, **Item**, **Current
setup** and **After restoring this version**. A table's head has two rows - the
section title, a `<button>` that folds the section down to that row, and the column
headings - and the whole `<thead>` is the sticky layer at `top: 0`, so the two pin
as one block and let go with the section's last row. The window body's top padding
moves into the report, so nothing shows above a pinned head (the rules are in
`tests/modalBodyLayers.test.ts`). The section title folds with Obsidian's own
triangle (`span.collapse-icon` holding `right-triangle`, which app.css sizes and
turns while it carries `is-collapsed`), as its file explorer and Sync's version
list draw it; the plugin's bold chevron is used only by the settings lists now.

Every line in the tables is Obsidian's table line (`--table-border-width`,
`--table-border-color`), solid, and the column headings take
`--table-header-weight` and `--table-header-color`, so a theme that restyles
tables restyles these. The fields of one change used to be separated by dashed
lines; Obsidian draws no dashed separators, so they are solid now, and the
shaded number column spanning the change is what keeps its rows together.
Obsidian's `--table-header-background` is not used (it is transparent, and a
pinned head must be opaque, so the head keeps the `--cs-surface` pair), nor
`--table-text-size` (the editor's text size). The narrow number column has a
smaller side padding and keeps **No.** on one line. Tables use the theme's
`--radius-m` for their outer corners. An opaque `mask-image: linear-gradient(#fff, #fff)` uses the
default `mask-clip: border-box` to clip the table and cell backgrounds to that
rounded frame. The prefixed `-webkit-mask-image` declaration preserves this on
older iOS versions supported by earlier Obsidian builds. The mask creates no
scroll container, so the modal body remains the sticky header's scrollport;
`overflow: hidden` on the table would break that relationship. The same rule
applies when the table becomes a block on narrow screens. Masking changes painting
rather than pointer hit-testing: the full-width heading button remains clickable
in the tiny transparent areas inside its rectangular bounds at the rounded corners.
Each item is one `<tbody>`: a number cell spanning
all of its rows (numbers run on across sections), its title with a
Changed/Added/Removed badge, a drawing of the whole item per side where one exists,
then one row per changed field with the label in the Item column. An absent side
says so explicitly. Below 600px the rows become two-column grids: number and title
on one line, the two sides beneath, each field's label on a line of its own.

`recoverySections.ts` and `recoveryCollections.ts` build the sections from
`SetupDetails`, matching each callout type, palette, custom icon, command and
context-menu entry by id so all of its changes stay in one item;
`recoveryModel.ts` holds the shapes and the shared `recordFields()` diff. Effective
definitions include shipped built-ins, so resetting a built-in override is a change
to its default rather than a deletion. A global style change appears once, as
heading/inline/block items with previews from `recoveryRolePreview.ts`, not on
every callout it restyles. The comparison has no row cap.

Rendering yields between batches of eight items. A loading message is delayed
by 250 ms and, once shown, stays visible for at least 250 ms to avoid a flash on
fast comparisons. A generation check and component-owned timers stop stale work
after close or reopen. The comparison is published only when the current render
finishes; a rendering failure leaves an error message instead of a partial table.

`recoveryPreview.ts` provides `renderRecoveryPreview()` for a representative regular
block and `renderRecoveryImage()` for an uploaded image. Both sides use their own
snapshot's artwork; missing cached artwork gets a placeholder. Blocks use sample
content in the current light/dark mode, not historical theme CSS or real note
Markdown. The renderer does not change the live registry or image pack and does
not install a generated stylesheet. Snapshot images are sanitized and isolated as
data images or stencil masks. Folding events belong to the modal's component and
are removed when the report is rebuilt or closed.

`recoveryValues.ts` draws every value: colors as swatches, icons from that side's
own saved artwork with their library and style, gradients, border frames, orders as
numbered lists, switches as On/Off, and palette or callout references as what they
name on that side. Known labels use `t()`; unknown field names remain literal and
unknown values render as nested labelled lists. Nothing sits behind a disclosure:
text over 160 characters shows an excerpt and its length. Values are inserted as
text, including SVG and other markup; visual previews use sanitized artwork
separately. There are no full-setup, provenance, retention or
raw-data sections, and an unreadable source shows that comparison is unavailable.
The details window makes no network, save or restore calls and has no restore
button.

## Reduced motion

The plugin has no setting for this and never stores a choice. It reads the
operating system's preference, which Obsidian's Chromium exposes as the
`prefers-reduced-motion` media feature (macOS **Reduce motion**, Windows
**Animation effects** off). Obsidian itself has no reduced-motion option and
most of its own animations ignore the preference, so everything below is the
plugin's own doing. To test without changing the system setting, use the
developer tools' **Rendering → Emulate CSS media feature
prefers-reduced-motion**.

There are two entry points, and a new animation uses whichever matches how it
is driven.

**From JavaScript** - `prefersReducedMotion()` in
[`ui/flip.ts`](../../src/ui/flip.ts) is the only function; it is a fresh
`matchMedia` read on every call, so a change in the system setting applies to
the next animation without a reload. It is exported from `flip.ts` for
historical reasons, not because the check belongs to FLIP. Its callers:

- `flip.ts` itself - row reorders skip the FLIP animation and just land.
- `DragSortList.ts` - read once when a drag starts; the settle and slide
  animations are skipped and no drop placeholder is drawn (see the drag section
  above).

A jump to a settings row (26 § Jumping to a row) is Obsidian's own scroll and
flash, as a settings search result's is, and does what Obsidian does.

The brush mascot reads the same media feature itself, once per mascot and
guarded for a host without `matchMedia` (the test DOM): under reduced motion
its faces still change but the brush never moves, throws paint or paints a
stroke ([27 - The brush mascot](27-brush-mascot.md)).

**From CSS** - `@media (prefers-reduced-motion: …)` blocks in
[`styles.css`](../../styles.css). They take two shapes:

- **`reduce` blocks** turn something off: `transition: none` on the portable
  cards' actions, `animation-duration: 1ms` on the plugin
  import window's "checking" vault card, the icon tile transitions, and the heading callout's entrance
  transition (which also never animates into a print or PDF snapshot).
- **`no-preference` queries** switch something on only when motion is
  allowed: the usage menu's count fade, the drop placeholder's entrance, and
  the icon swap arrows' drift loop with its hover trigger. Use this shape when the selectors are so specific
  that an `animation: none` in a `reduce` block could not outrank them; a
  loop that never starts needs no stopping. The `reduce` block beside the
  icon tiles says so and deliberately leaves the arrows alone.

The vault-scan fade is the same idea, documented with its feature in
[Vault discovery](11-vault-discovery.md).

---
Next chapter: [17-i18n.md](17-i18n.md)
