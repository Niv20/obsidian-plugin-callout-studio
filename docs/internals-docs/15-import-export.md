# Import and export

Covers the JSON backup format, the validator, the CSS-snippet export (recap
 - full mechanics in [Persistence and caching](07-persistence-and-caching.md#the-user-requested-css-snippet-export)),
the website export (one target per publishing service), and the two
foreign-plugin importers (Callout Manager, Admonition).

## Export

`ImportSourceModal` and `ExportFormatModal` are each a single settings row
opening a chooser - one picks a source, the other picks a format - rather
than one top-level row per option, per the project's own stated design
rationale ("a second top-level row for a new format would leave the two
halves of one section shaped differently").

**Each choice is a row with its own button** (`settings/choiceRow.ts`,
`addChoiceRow`, finding S9-09), in Obsidian's setting groups, so a chooser
looks like a page of Obsidian settings: the option's icon
(`setting-item-icon`, which `Setting.setIcon` builds but the typings do not
declare), its name, a line about it, and a button at the end of the row. Only
the button acts; the row takes no click, hover or focus. Import's window is two
groups: the Callout Studio backup (**Upload…**), then **Callout Manager** and
**Admonition** (**Import…** each) under the group heading **From another
plugin**, so it reads as "your own backup, or somebody else's data" rather than
as three equal rows. Export's is one group: the backup (**Export…**, since the
save dialog asks where) and the CSS snapshot (**Export**, written at once).
Both show the backup with the same Lucide `paintbrush` icon. Each button is
named by its words and its row's name (`aria-labelledby`, never an
`aria-label`, which Obsidian would pop up as a tooltip), so two **Import…**
buttons differ for a screen reader. Only a double-click's first click acts, so
one gesture cannot open the file picker twice or start a second export. On a
phone Obsidian stacks each row (name, description, full-width button), and the
icon is hidden there rather than left alone on a line. Until 2026-10-24 each
choice was a raised grey card with an icon tile and a chevron, the whole card
one button.

Export marks its backup with the shared grey **Recommended** tag
(`settings/recommendedBadge.ts`) after its name rather than a "(recommended)"
written into the title. The tag is Obsidian's own flat flair
(`.flair.mod-flat`), the tag Obsidian prints after "Regex", so Obsidian paints
it. It is not core's green onboarding variant, because nothing in these
windows is green.

`assets/ui-icons/braces.svg` is retained as an unused repository asset for
possible future UI use; it is not bundled or shown in these choosers.

The plugin import window and the "Update your notes?" questions use
`settings/optionBox.ts`: `renderOptionList()` provides the column and
`renderOptionBox()` a card with the icon, title, description and badge.
(The Publish to the web page built its services on the same card, as a row
of tabs, until it became a sidebar panel on 2026-11-16, where they are a
dropdown: [The Publish to the web panel](#the-publish-to-the-web-panel).)
The card alone has no role, no focus stop and no listeners. The plugin import
window builds its two options on it and adds what is its own to say - a radio
dot, a button, a text box (see [the plugin import window](#the-plugin-import-window)).
`renderOptionBox()` returns the card's `titleEl` and `descEl` so that window
can rewrite them in place.

### How an option box is drawn

A card is drawn as Obsidian draws the radio cards it asks with when you set up
a vault on a phone (`.mobile-onboarding-radio-option`, finding S9-10), so the
plugin import window and "Update your notes?" ask the way Obsidian asks:

- **An outline, no fill.** `border: 2px solid var(--background-modifier-border)`,
  `border-radius: var(--radius-m)` with `corner-shape: var(--corner-shape)`,
  padding `--size-4-3`, cards `--size-4-4` apart. Nothing under the pointer:
  only a card's own controls answer it, as in Obsidian.
- **The chosen card** (`is-selected`) changes only its outline, to
  `--interactive-accent`. No ring, no wash.
- **The radio is Obsidian's own,** an `input[type=radio]` at the card's leading
  edge (`addOptionRadio`), drawn by app.css: an accent disc with a centre dot
  when checked, Obsidian's focus ring with a keyboard. The radios of a window
  share a `name`, so the group is one Tab stop and the arrow keys move the
  choice, as in any radio group. Only its margin is the plugin's (the card's
  gap spaces it), and a disabled one fades and takes no pointer, so a click on
  it reaches its card.
- **Chrome stays grey-lit.** The icon is `--text-muted`, Obsidian's own icon
  grey, with no tile, and it stays that grey whatever the card comes to hold:
  nothing on a card turns green. The accent is spent on the chosen card's
  outline and on the card a dragged file lands on (`is-drop-target`, which takes
  Obsidian's drop target: a 10% accent tint laid over the card in a `::after`,
  so it shows on the chosen card too). `tests/importBoxStyles.test.ts` fails on
  any other option-box or import-card rule that names the accent, on any
  `.cs-option-*` or `.cs-import-*` rule that names a success colour, and on any
  hover rule for a card but the one for a card drawn as a tab (`.cs-web-tabs`),
  whose own rules the same file holds: no outline, the shown tab raised and
  never in the accent, the radio out of sight yet in the keyboard's reach.
- **Type.** The title is `--font-ui-medium` semibold; the status line is
  `--font-ui-smaller` in `--text-muted`, the size of a settings description.

Until 2026-10-24 a card was a raised grey pill (the callout row's fill) with
its icon on a tile, a hand-made round "radio" with a check mark at its far end,
a hover step, and a 2px accent ring with an 8% accent wash when chosen.

The three windows open at Obsidian's own dialog width (`--dialog-width`, 560px),
so stepping from Import's chooser into a plugin import window doesn't resize the
window under the pointer. (They shared a 520px cap until 2026-10-23, 40px
narrower than Obsidian's dialogs.)

### Three export formats

No export format records device history or creates a vault settings backup.
JSON serializes the displayed registry and passes it to `downloadText()`; the
CSS snippet and the website export write files into the vault. None invokes
the settings writer or recovery service.

1. **Callout Studio backup (`.json`)** - `registry.exportToJSONv2()`:
   ```json
   {
     "format": "callout-studio",
     "formatVersion": 2,
     "callouts": [ /* getExportableDefinitions() */ ],
     "settings": { /* full PluginSettings */ }
   }
   ```
   `getExportableDefinitions()` is `getUserDefined()` **plus every modified
   built-in** - see [Callout registry](05-callout-registry.md#which-rows-are-persisted-the-built-in-rule).
   The v2 JSON backup is the **only supported full-fidelity restore and
   cross-vault transfer format** for Callout Studio. It is the format users
   should choose when the destination vault also has the plugin installed.
   A legacy `exportToJSON()` (flat array, no envelope, no settings) still
   exists and is kept **because it's part of the public plugin API surface**
 - the importer accepts both shapes, but the legacy array is not a complete
   setup backup because it carries no settings.
2. **CSS snippet (`.css`)** - see
   [Persistence and caching](07-persistence-and-caching.md#the-user-requested-css-snippet-export)
   for the full write/overwrite/fingerprint mechanics. In short: block-role
   callouts only, a snapshot (not live-linked), byte-identical re-export
   writes nothing, and a foreign/hand-edited file at the target path prompts
   before overwriting. This is a **one-way deployment artifact, not a backup**:
   the backup importer never reads the generated CSS file, and no importer
   scans the snippets folder.
3. **Website** - [`manager/web/`](../../src/manager/web/). The other half of
   the snippet's answer: a block callout is Obsidian's element, so CSS can
   carry it elsewhere; a heading bar and an inline pill are elements this
   plugin *builds*, so carrying them takes something that runs. Where it can
   run differs per service, so this format is a set of **targets** - see
   [The website export](#the-website-export) below. It carries the block
   callout too, as CSS written for that service's own element. Like the
   snippet it is a **one-way deployment artifact, not a backup**. It is the
   one format that is not a row of `ExportFormatModal`: it has a box of its
   own on the main page (below). That is also what the snippet's row is
   described by now - another vault without the plugin, or a site other than
   the three services - since for those three the website export does more
   and does it in each site's own terms.

## The website export

The export is set up in a sidebar panel, **Publish to the web**
([`webPanel/`](../../src/webPanel/); see
[The Publish to the web panel](#the-publish-to-the-web-panel) below). Its
settings row is the one row of the **Website** box (`websiteGroup` in
`mainPageGroups.ts`), above Import and export, and the panel has a command
of its own (`open-publish-to-web`). Until 2026-11-16 the row was the Import
and export box's last, and `ExportFormatModal` had a **Website** row leading
to it too; both went when the box was made. Nothing is written until the
panel's own button is pressed. The row carries a grey **Beta** tag after its
name (`ButtonRowSpec.tag`, drawn by
[`settings/betaBadge.ts`](../../src/settings/betaBadge.ts) as Obsidian's flat
flair, and shown in capitals by Obsidian's own `.flair` rule): the feature is
new, and the tag says it may still change. It is on the row, not on the panel,
whose tab carries only the feature's name.

The **Share Note** plugin is not a service of the panel, and has no target: it
uploads a note's reading view with the window's own stylesheets, so there is
no file to write and nothing for the user to set up. What it needs - drawings
for the icons it cannot name - rides in the live stylesheet while Share Note
is on ([CSS generation § A page shared with Share Note](06-css-generation.md#a-page-shared-with-share-note)).

### The Publish to the web panel

[`WebPanelView.ts`](../../src/webPanel/WebPanelView.ts), a view in the right
sidebar. It was a page of the settings from 2026-11-14
(`declarative/webPage.ts`, a row of service tabs over a rail of three steps)
until 2026-11-16: the settings are a window, and nearly every step is done
somewhere else in Obsidian, so the instructions had to be closed to be
followed. Before that it was a window of two screens, `WebSetupModal`.

- **Opened when asked for, closed when done.** Its settings row (which closes
  the settings first, `registerWebPanel.openWebPanel`) and its command open
  it; closing its tab removes it; a tab left open is closed at the next
  launch (`ui/initializeSidebarTabs.ts`), as the conversion review's is. Nothing
  is lost: all it shows is read from the vault and from this device's memory
  each time it opens.
- **The service is a dropdown at the top**, detected services first
  (`detectService.ts`). It is the plugin's `SelectDropdown`
  ([`ui/selectDropdown.ts`](../../src/ui/selectDropdown.ts)): Obsidian's
  dropdown face opening Obsidian's `Menu`, not a `<select>`, so each service
  carries its icon (`webPanelCopy.SERVICE_ICON`: `send` for Publish, the icon
  Obsidian gives its own Publish changes; `gem` for Quartz; `sprout` for
  Digital Garden) and a sign after its name (`SelectOption.badge`,
  `webPanelFrame.drawServiceBadge`): the warning triangle while the service's
  verdict is `attention`, nothing otherwise. Until 2026-11-16 night a done
  tick stood there too, once the verdict was `done`, a verdict that is gone.
  The field shows the chosen service's icon (`fieldIcon`) and sign too, and
  **Choose your service…** (`placeholder`) until one is chosen; the menu
  offers only the services. Until 2026-11-16 night it was a `<select>` of
  words (**Detected** before a service had files, "· All done" after, and
  earlier still a count of the steps left). Three names do not fit across a
  sidebar, and nearly every vault has one service. A panel never opened
  before opens on the likeliest service, which writes no file; the choice is
  remembered in `DeviceLocalStore.webExport.service`. The line under the list
  that said why the vault points at a service (`web.reason*`) went that night
  too: `Detection.reason` is still computed, and only ordering uses it.
- **A caption over the list, a hairline under it, and a mascot while none is
  chosen** (2026-11-17). The top (`.cs-web-top`) starts with a small muted
  caption, **Website hosting service** (`web.serviceLabel`, also the list's own
  accessible name, so the caption is `aria-hidden`), and ends in a hairline the
  width of the pane: `border-bottom: var(--border-width) solid
  var(--background-modifier-border)`, the rule Obsidian's `.search-results-info`
  draws under the field row of Find callouts and Review conversion. Until then
  the list ran into the steps. Before a service is chosen (nothing detected and
  nothing remembered) the steps' place holds the mascot over one quiet line
  (`web.intro`, `drawChoose`), centred in the height the pane has left
  (`.cs-web-scroll.is-choosing`), as Find callouts draws a search that found
  nothing; the face is `hello` held still, since nothing is wrong. It was the
  line alone, at the top of the steps' column, until then. The mascot is a
  `KeptMascot` of the view, put away when a service is chosen and when the
  panel closes.
- **Numbered steps, with no sign of which are done and none held back**
  ([`manager/web/webChecklist.ts`](../../src/manager/web/webChecklist.ts)):
  each row's heading is its number (1., 2., 3., in the order they are done)
  and its name, and every row can be done at any time. The number has a
  period after it, the way Obsidian draws a numbered list: its stylesheet sets
  `--list-numbered-style: decimal`, which the browser draws as a figure and a
  period, and Markdown's marker is `1.` too. It is the only precedent there
  is: read in Obsidian 1.15.1, `app.css` has no counters and the text of its
  settings and dialogs has no numbered steps. The period is text in the
  heading's number (`webPanelFrame.drawRow`), not CSS-generated, so the tests,
  a screen reader and the guide's pictures all read the same "1.". Until
  2026-11-16 night the number stood alone. A row is still *seen*
  (the plugin looked: the files, and Quartz's configuration where it is in
  the vault), *clear* (nothing to do), *to do* or a *warning*, but only a
  warning shows: said in the row's box, and a triangle after the service's
  name. The last row is `done` (**All done**), which says what happens from
  then on; Quartz has no row for publishing, since every build reads the
  file. The service's verdict is `none`, `attention` or `ok`. Until
  2026-11-17 one caution was left of the old locking: Quartz's configuration
  row said, while the plugin folder was missing, that its lines would break
  the build (`ChecklistRow.beforeFiles`, `web.quartzWaits`), and the files
  row warned of a folder deleted while the configuration still loaded it
  (`orphaned`, `web.quartzOrphaned`). The Quartz plugin is installed from its
  own repository now and builds a site without the file as it did without
  the plugin, so both went.
  Until 2026-11-16 night each heading started with a sign (a filled tick for
  done, a ring to do, a grey ring waiting, a triangle); the steps the plugin
  cannot see ended with a checkbox of the user's ("I installed it", "My site
  has a custom domain", "I added this to my configuration", "I published
  it"), kept per device in `DeviceLocalStore.webExport.ticks`; a
  "published" tick carried a fingerprint of the files
  (`siteFacts.publishedStamp`), so it cleared itself when they were
  rewritten and the row said the callouts had changed; **All done** was
  ticked once every row was; and a row whose time had not come (*waiting*)
  was dimmed, with its Copy buttons off. The user found the signs and the
  boxes more to read than the steps, asked for numbers instead, and then for
  nothing to be locked. What that gave up: the note's publishing row no
  longer waits for the note or for the garden plugin (a note published
  before the plugin is installed becomes a page; the order of the numbers,
  and the user guide, say to install the plugin first), and a configuration
  outside the vault is no longer taken to load the folder, so a deleted
  folder is "to do" there rather than a warning.
  The words for each row are [`webPanelCopy.ts`](../../src/webPanel/webPanelCopy.ts)'s;
  the drawing is [`webPanelFrame.ts`](../../src/webPanel/webPanelFrame.ts)'s.
- **Every row on one page** (`WebPanelView.drawService`), in order. Until 2026-11-16 night the panel showed one
  phase at a time (`webChecklist.setupDone`, `siteShown`, a `group` on each
  row): the setup's rows, the site's row joining them only once it had
  something to do, and then the site's row alone once the setup was done. The
  user found publishing the note belongs on the page with the steps before
  it, and a finished step should stay where it was.
- **A row says the same before and after it is done**
  ([`webPanelCopy.ts`](../../src/webPanel/webPanelCopy.ts)). Only its button
  changes: **Create note** becomes **Open note**, **Create files** becomes
  **Reveal in Finder**. What is added is only something wrong (out of date,
  changed by hand, switched off). Until that night a done row dropped its
  instructions for what was found ("Saved as …", "You ticked this on …"),
  and the row that publishes renamed itself ("… again", "Nothing to
  publish"); later that night the line on it that said the callouts changed
  since it was ticked went with the ticks.
- **Each row is a heading over a box, and nothing folds**
  (`WebPanelView.drawRow`, `webPanelFrame.drawRow`). The heading is the row's
  number and name and is plain text: no arrow, no `role="button"`, no
  `tabindex`, no `aria-expanded`, no `data-cs-key`, so it is not a stop for the
  keyboard either. Every box is always open. Until 2026-11-16 night a press,
  Enter or Space on the heading folded the box (`WebPanelView.folds`, kept in
  memory by service and row), with a slide in `styles.css` that used
  Obsidian's tree-item timing (100 ms, `cubic-bezier(.3, .2, .5, 1)` opening
  and `cubic-bezier(.02, .01, .47, 1)` shutting, read from Obsidian 1.15.1's
  app.js), and before that a done row folded away by itself. The user asked
  for folding to be taken out altogether, so the fold arrow, the wrapper
  (`.cs-web-row-fold` and `.cs-web-row-clip`, the one-row grid that slid), the
  `is-collapsed` and `inert` toggling and the fold memory are gone. Nothing
  else in the panel folds either.
- **Drawn as a group of settings** ([`webPanelFrame.ts`](../../src/webPanel/webPanelFrame.ts),
  `styles.css`): each row's heading is in Obsidian's settings-heading style,
  over a rounded box of lines with Obsidian's hairline between two lines
  (`--setting-items-*` tokens), the words starting at the box's own edge. The
  words can be selected and copied (`user-select: text` on
  `.cs-web-row-text`, against Obsidian's `body { user-select: none }`), as
  the lines of configuration always could. The box cannot take Obsidian's settings-box colour
  (`--background-primary-alt`), which is a desktop sidebar's grey give or take
  a shade, so it takes `--search-result-background`, the colour of a
  sidebar's own cards (Backlinks' matches); on mobile, where that token is the
  drawer's own colour, it is the settings box in dark mode and
  `--background-secondary` in light mode (the drawer is white there; listed in
  `tests/modalSurfaces.test.ts`); in the main area it is the settings box. The
  heading's number stands where the words in the box start. **Not
  set up** is only read out (`cs-visually-hidden`, a live region), and
  nothing is said for a service on its way; **All done** was read out too
  while there was a verdict for it. Until 2026-11-16 night the steps were a
  bare list on the sidebar's grey under small uppercase headings. Nothing is
  drawn under the steps: the line that said which ticks were the plugin's and
  which the user's (`web.legend`), and the one that linked to the guide and
  the issue tracker (`web.help`), went that night.
- **A narrow pane wraps its words, buttons too** (2026-11-17). Obsidian's
  `button` is one line at a fixed height (`white-space: nowrap`,
  `height: var(--input-height)`), so the row's `flex-wrap` only moved whole
  buttons: one whose label was wider than the pane (a long or translated one,
  **How to set up a custom domain**) stuck out of it from about 240px, and
  from about 200px **Reveal in Finder**, **Open note** and **Create files**
  did too. `.cs-web-row-actions > button` may shrink and wrap its own words,
  with the height as a minimum (a one-line button looks as before);
  `.cs-web-version` (Quartz version and its dropdown) wraps as a row. The
  same fix is on **Convert selected** (`.cs-portable-convert-row`) and on the
  count over both other sidebars, which Obsidian does not let shrink
  (`.search-results-result-count { flex-shrink: 0 }`;
  `.cs-sidebar-summary-row > .search-results-result-count` undoes it). Checked
  from 340px down to 100px in Chromium with Obsidian's own `app.css`
  (`scripts/render-user-guide.mjs`' page with the sidebar's width set), not in
  Obsidian itself.
- **Short steps, a line each.** A row's instructions are smaller steps, one
  action each (`RowPart` `steps`), each a line of the box with a hairline
  above it, unnumbered (`WebPanelView.drawLines`); the parts that follow one
  another outside them share a line, and what is only good to know is a
  quiet line after them. Until 2026-11-16 night they were numbered 1, 2, 3.
- **A note's step has its sentence under its buttons** (Digital Garden,
  and Quartz since 2026-11-17; `filesWords` returns `steps` lines): the button
  first (**Create note**, then **Open note**, or **Update now** and **Open
  note**), then, after a hairline, a line of its own that says the note is
  required for the callouts to work and asks to read it (`web.filesNote`,
  `web.filesGarden` until then; the note starts
  with READ THIS and opens when it is written). What is wrong
  with the note (out of date, changed by hand, switched off, other notes with
  the property) stays above the buttons. Until 2026-11-16 night the sentence
  was above the button and said only that the garden reads the callouts from
  the note. The other services' files keep their sentence above: nobody is
  asked to read them. The last step's words for a note that is published by
  hand (`web.doneNote`: Digital Garden, and Quartz where a plugin publishes
  the notes) say the note is updated by itself, and that to see a change on
  the site it has to be published again; Quartz's otherwise (`web.doneQuartz`)
  say the next build picks it up. Quartz with no publishing plugin found has
  a third line under the button, `web.noteChooseToo`, for a plugin the panel
  does not know.
- **Quartz's steps follow the plugin that publishes the notes**
  (`notePublisher.ts`). None: the note, the Quartz plugin, All done. Quartz
  Syncer or Enveloppe: a **Publish the note** step before All done
  (`webChecklist`'s `site` row with `publisher`): Quartz Syncer's
  Publication Center by a button (`quartz-syncer:open-publish-modal`,
  `siteActions` `syncerCenter`) or in words, Enveloppe's command in words
  under **Open note**. The note's step warns of the plugin's property off
  (`web.noteNotMarked`) or a folder it does not publish from
  (`web.noteOutsideFolder`, `web.noteExcludedFolder`).
- **Digital Garden not installed is a box with no number, not a step.**
  `actionsHere().gardenInstalled` (the plugin object, or its Publication
  Center command, is there) is read at every drawing; where it is false,
  `prerequisiteWords` / `drawPrerequisite` draw **Before you start** above the
  list. It is not a row of `webChecklist.ts` and not counted, so **Create the
  note** stays 1 whether or not the plugin is installed, and installing it
  while the panel is open renumbers nothing. `NO_ACTIONS` says
  `gardenInstalled: true`, so a failed lookup never tells anyone to install.
- **A button wherever a step can be done by one**
  ([`siteActions.ts`](../../src/webPanel/siteActions.ts)): **Open garden
  plugins** (the Digital Garden plugin's own `openGardenPlugins`, which its
  deep link `obsidian://digital-garden?open=plugins` runs: **Site → Plugins →
  Browse & install**, with our garden plugin selected once it is listed),
  **Open Publication Center** (its `activatePublicationCenter({ tab:
  "notes" })`, or else its command `digitalgarden:dg-open-publish-modal`),
  **Open Publish changes** (`publish:view-changes`), **Reveal in Finder** /
  **Show in system explorer** (`app.showInFolder`, desktop only), **Open
  note**, and a help page. None of these is in Obsidian's typings, and two
  belong to another plugin, so each is looked for at every drawing and
  offered only where it is there; where it is not, the step says it in words.
  A button whose plugin went away after the drawing says so
  (`web.actionFailed`) and the panel is drawn again. None of them writes.
- **Quartz's site folder gets a button only where Obsidian can lead to it**
  (`webPanelCopy.quartzTerminalStep`): the first of the Quartz plugin's
  smaller steps is a terminal in the site's folder, the one with the
  configuration file. In the vault (the vault is the repository), **Reveal
  in Finder** selects the configuration file. In a vault named `content`
  (`detectService.isContentVault`), it shows the vault's own folder,
  `showInFolder("")` (`siteActions.VAULT_FOLDER`), as Obsidian's list of
  vaults does: the file manager opens the folder that holds the vault, which
  is the site. Anywhere else (a vault Quartz reaches through a link, or
  Quartz Syncer) nothing in the vault says where the site is, and the step
  is words. Read 2026-11-16 in Obsidian 1.15.1's app.js: `showInFolder`
  returns at once unless `Platform.isDesktopApp`; both it and
  `openWithDefaultApp` throw on a path with `..` in it ("is outside the
  vault"), so a file beside a `content` vault cannot be reached without
  Electron's own `shell`, which this plugin does not use (`isDesktopOnly` is
  false, and nothing outside the vault is touched); and a phone or tablet has
  `openWithDefaultApp` for one file (the system's share sheet) and nothing
  that opens its Files app at a folder. Quartz's note gets **Open note**, as
  the garden's does.
- **Quartz installs its plugin, as a garden does** (2026-11-17, asked for by
  the user: the plugin "in the air"). The step is **Install the Quartz
  plugin** (`web.rowQuartzPlugin`): a terminal in the site's folder; `npx
  quartz plugin add github:Callout-Studio/quartz` on Quartz 5,
  or `npm install` of the same on Quartz 4 followed by its two lines in
  `quartz.config.ts`; and the files to commit, so the build that publishes
  the site installs the plugin too. Quartz 5.1's build installs every
  enabled Git plugin `quartz.config.yaml` lists (`config-loader.ts`), even
  where the host skips `npx quartz plugin install` or no `quartz.lock.json`
  was pushed; the lockfile only pins the commit. Quartz 4's host installs it
  from `package-lock.json` (`npm ci`, or the host's own install). The panel
  only says to commit and push them; the user guide explains why. A build
  that never got the configuration file goes on without a word,
  with the callouts as text, since the `[Callout Studio]` log lines come
  from the plugin itself. On Quartz 4, `quartz.config.ts` pushed without
  the package files stops the build instead (`Cannot find package`, or
  `npm ci`'s lockfile mismatch). Until then the vault held the plugin, as a
  folder `callout-studio-quartz/` Callout Studio wrote, and the step was a
  `source:` entry to paste into `quartz.config.yaml` (or an `import` from
  `./content/callout-studio-quartz/index.js`) and a line for
  `ignorePatterns` to keep the folder's three files off the site. What
  replaced the folder keeps itself off the site
  ([Quartz: the snapshot as a note](#quartz-the-snapshot-as-a-note)), so that
  line and its checks (`quartzFolderIgnored`, `web.quartzNotIgnored`,
  `web.stepQuartzIgnore`) are gone. The
  `order: 65` the user used to paste is now the plugin's own
  `defaultOrder`, which `plugin add` writes into the entry.
- **It follows the vault while it is open.** It listens (through
  `registerEvent`, released when Obsidian unloads the view before its
  `onClose`) for the files it is about - our files, Quartz's configuration,
  and any note that appears, moves or goes, since a note is found by its
  property - and reads them again a moment after the last change. An
  automatic refresh that rewrote something tells it too
  (`WebAutoUpdate.onDidWrite`), and so does its window getting the focus
  back (`registerDomEvent(win, "focus")`): a plugin switched on or off in
  Settings, a window of its own in Obsidian 1.15, tells the vault nothing.
  It never writes because something changed.
- **Writing a note opens it** (Digital Garden, Quartz)
  ([`openWebNote.ts`](../../src/webPanel/openWebNote.ts)), beside the panel,
  in Reading view, as the active tab without the keyboard; its `create`
  event is waited for, for up to 3 seconds, since the writer goes through the
  adapter.
- **Opening the panel ends the website offer** for every service the vault
  points at ([The offer on the settings page](#the-offer-on-the-settings-page)).
- **Drawn whole each time**, which keeps every row in step with one reading
  of the vault; the keyboard's place (`data-cs-key`) and the scroll position
  are put back, and a generation counter drops answers that arrive after it
  closed. Where the control that had the keyboard went (a button pressed,
  such as **Create note**), the first control of the steps gets it.

### One snapshot, three targets

[`webData.ts`](../../src/manager/web/webData.ts) builds the snapshot every
target carries, from one registry read:

- **the callouts**: the built-ins and the user's own - untouched built-ins
  included - each reduced to id, name, aliases and its own icon baked to
  markup by `paintOwnRoleIcon`;
- **the stylesheet**: the structural heading/inline rules cut out of
  `styles.css` between its `@cs-web` markers, then
  `CSSInjector.generateWebTokenCSS(defs)` - the role frames
  (`css/roleFrameCSS.ts`), each callout's `generateTokenColorCSS` and icon
  adjustment for the two roles, the fallback's token rules, and the metadata
  colours' token cut. It runs with `emitThemeOff` set, so an untouched
  built-in is written in its stored colour rather than deferring to
  `--callout-default`, which a published site does not define. Then
  `CSSInjector.generateWebBlockCSS(defs, site, artwork)`: the block callout,
  for the site the target is - see
  [Block callouts](#block-callouts-a-stylesheet-in-each-sites-own-terms)
  below. This last part is why the snapshot is built for a target
  (`buildWebBundleData(plugin, target)`); everything before it is the same for
  all three.

**The snapshot reads nothing of the active theme or of this device's
snippets.** Both are readings of one device at one moment, and neither is on
the published site. A row the theme adds (`source: "theme"`) is minted when the
theme's stylesheet is scanned; which callouts the theme owns, and the artwork it
draws, are measured after startup; and the metadata colours stand down, in the
vault, on every word an enabled snippet styles. Taking any of it into the files
would make them differ between devices, and on one device between a launch and
the moment its theme was measured - and with the automatic refresh on, each
difference is a rewrite of the site's files. So a callout only the theme
defines is unknown to the site (drawn with the fallback's look), a built-in the
theme restyles is drawn as its own definition says (`paintOwnRoleIcon`, not
`paintRoleIcon`), and the metadata colours' web cut takes every word
(`activeMetadataColorEntries` without the snippet set). `webExport.test.ts`
holds all three.

[`targets.ts`](../../src/manager/web/targets.ts) joins that snapshot with the
renderer and a host ([Render roles § A published site](09-render-roles.md#a-published-site-one-renderer-three-hosts))
into each service's files. A target is only the joining - which host, which
module format, where the stylesheet travels:

| Target | Files (vault-relative) | Renderer runs | Stylesheet |
| --- | --- | --- | --- |
| `quartz` | one note, `callout-studio-quartz.md` at the top of the vault (found by its property wherever it was moved) | in the Quartz build, by the Callout Studio Quartz plugin | inside the note, with `.theme-dark` rewritten to `[saved-theme="dark"]` and the heading band's rule weighed up; the plugin puts it in every page's head |
| `garden` | one note, `callout-studio-web.md` at the top of the vault (found by its property wherever it was moved) | in the Digital Garden build, by the Callout Studio garden plugin | inside the note; the garden plugin serves it as `/plugins/callout-studio/callout-studio.css` |
| `publish` | a block in `publish.js` and one in `publish.css` | in the reader's browser | the block in `publish.css` |

When the vault is the Quartz repository itself (`quartzInVault`), a new
Quartz note is written under `content/`, where Quartz looks for content. See
[Quartz: the snapshot as a note](#quartz-the-snapshot-as-a-note) for the note.
For `publish.js` the snapshot is serialised as JSON with `</` written `<\/`,
since a site may inline a script in a `<script>` element.

Adding a service is a new entry in `targetFiles` and, if it runs somewhere
new, a host. The renderer does not change. A new service also needs its own
entry in `webBlockCSS.ts`, described next.

A fourth target, `script` - one file, `callout-studio-web.js`, for any other
site - was taken out on 2026-11-16: hardly anyone hosts notes that way, and
its tab and its stylesheet guess cost more than they served. How it worked,
and every place that would take it back, is in
[The Another site target](web-target-another-site.md).

### Block callouts: a stylesheet in each site's own terms

A published site builds `> [!tip]` itself, and the export first left it at
that. It was not enough: a site ships Obsidian's thirteen callouts and nobody
else's, so a callout the user made came out as a plain note - Quartz's rule for
"any other type" is the note's blue and the note's pencil - and a built-in the
user restyled kept the site's look. The heading bar and the pill beside it,
which this plugin builds, were right.

So the stylesheet ends with the block role, from
[`css/webBlockCSS.ts`](../../src/manager/css/webBlockCSS.ts). **It is CSS and
nothing else**, on purpose: the element is the site's, a stylesheet reaches
all three services the way it already did, and Obsidian Publish loads
`publish.js` on a custom domain only, while `publish.css` loads everywhere.
The renderer and its hosts are unchanged.

What differs is how a site reads a colour and where it keeps an icon, which is
what `WebBlockSite` names. `webData.ts` maps each target to one:

| Target | Site | Colour | Icon |
| --- | --- | --- | --- |
| `quartz` | `quartz` | `--color`, `--border`, `--bg`, plus `--callout-color` and the fill and frame set outright | `--callout-icon`, the URL Quartz masks an empty box with; a picture or an emoji switches the mask off and paints the box |
| `publish` | `publish` | `--callout-color`, a colour | the site's `<svg>` hidden, the artwork drawn on `.callout-icon::after` - the vault's own three rules (`iconOverrides.ts`) |
| `garden` | `garden` | `--callout-color`, a bare `r, g, b` | the same; the slot is one Digital Garden's own script adds on load |

Things worth knowing before changing it:

- **Quartz is two sites.** Stock Quartz reads its three variables. A Quartz 5
  site made from the `obsidian` template also wears a converted Obsidian theme,
  in cascade layers above Quartz's own rules: its title reads
  `--callout-color`, and a callout it has no rule for gets a quotation's
  background. Hence both spellings, and `background-color: var(--bg)` said
  directly. Layers are also why nothing there can outweigh this sheet: an
  unlayered rule beats a layered one whatever the selector.
- **Digital Garden's stylesheet is Obsidian's from before 1.13**, where the
  variable is a triplet read as `rgb(var(--callout-color))`. Publish's is the
  current one, where it is a colour. One variable cannot be both, which is why
  they are two sites.
- **Every icon is drawn here, Lucide included.** A site resolves a Lucide name
  with whatever Lucide it has (Digital Garden: the latest from a CDN, at page
  load), so a name that draws in the vault may draw nothing there.
  `webData.blockArtwork` hands over the SVG itself: stored artwork as stored,
  an Obsidian icon read back from the painter as the token roles read theirs.
  Where neither gives a drawing, the site's icon stays (`kind: "site"`).
- **`data-callout` is spelled per site.** Obsidian, Publish and Digital Garden
  dasherize `my callout`; Quartz 5 keeps the space. A name with a space gets
  both selectors (`attrForms`).
- **An untouched built-in, and an unknown id, are the site's.** The first gets
  only `--cs-accent` pointed at the site's colour. The second is reached only
  when a fallback callout is set, by one rule whose `:not(:where(…))` names
  every callout the vault defines.
- **Global callout style** is written only where a setting left its default,
  so a site keeps its own radius and frame until the user chose others.
  **Align content with title** needs the title's geometry: Obsidian's on
  Publish and Digital Garden (`blockAlignmentCSS`, without its importance),
  and Quartz's 18px box and 5px gap.

The artwork is the cost. A callout's block icon is in the stylesheet once per
callout, beside the copy the token roles carry in `defs`; four uploaded
photographs took a Quartz module from 93 KB to 179 KB.

What CSS cannot reach: a site whose regex never made the blockquote a callout.
Quartz and Digital Garden both take a callout's type as `[\w-]+`, so an id in
another script (`[!הערה]`) stays a quotation there.

### Quartz: the snapshot as a note

Quartz builds a site from its `content` folder. Until 2026-11-17 Callout
Studio wrote the whole plugin there: a folder, `callout-studio-quartz/`, with
the renderer, the Quartz host and the user's snapshot baked into one
`index.js`, an `index.d.ts` and a `package.json` with a `quartz` manifest,
which the site's configuration pointed at and kept off the site with
`ignorePatterns`. The user pasted three lines into a configuration file by
hand, Quartz 5 printed `Skipping callout-studio-quartz: no dist/index.d.ts
found` on every install, and the plugin's code was rewritten whenever a
callout changed. Quartz 5 installs plugins from Git repositories (`npx quartz
plugin add github:owner/repo`, which clones into `.quartz/plugins/`, uses a
committed `dist/` as it is, writes the entry into `quartz.config.yaml` with
the manifest's `defaultOrder`, and pins the commit in `quartz.lock.json`),
and npm installs a Git repository as a package on Quartz 4. So Quartz is
split as Digital Garden is:

- **The renderer and its host** are the Callout Studio Quartz plugin, one for
  every site, holding nobody's callouts, built by `npm run quartz:build`
  (`scripts/lib/quartzPlugin.mjs`) and published from a repository of its own,
  `QUARTZ_PLUGIN_REPO_URL`. Both installers take a whole repository, so it
  cannot be this one. See
  [Build, test & release](20-build-test-release.md#the-quartz-plugin).
- **The snapshot** is a note, `callout-studio-quartz.md`, the same shape as the
  garden's ([`web/static/webNote.ts`](../../src/web/static/webNote.ts), with
  Quartz's name, property and words in
  [`quartzNote.ts`](../../src/web/static/quartzNote.ts)): a `# READ THIS`
  heading over three callouts, then the snapshot (`WebBundleData`, its
  `version` the format, stylesheet included) base64 in a
  `` ```callout-studio-quartz `` block under its fingerprint.

**Why a note.** For one day it was a file, `.callout-studio/quartz.json`, in a
folder whose name starts with a period, which Quartz neither publishes nor
needs `ignorePatterns` for. That reached the build only where the vault *is*
the content folder (a terminal, Git, Obsidian Git, GitHub Desktop). Read in
their sources and documentation on 2026-11-17, the other ways notes reach a
Quartz site carry no such file: Quartz Syncer (about 14,000 downloads) and
Enveloppe (about 78,000) publish only the notes the user marked, and Quartz
Syncer's "custom file" option picks from `vault.getFiles()`, which has no
dot folder, and writes it outside `content/`; Pressroom, Private Quartz
Publish and GitHub Publish publish chosen notes or one folder; and Obsidian
Sync, which Obsidian Headless (`ob sync`) brings to a server that builds the
site, never syncs a file or folder whose name starts with a period. A note
reaches the build on every one of them. The user chose the note, with no JSON
left (2026-11-17).

**How the site finds it.** Quartz Syncer keeps only the properties it knows
(title, description, draft, tags, aliases, permalink and a few more), and
Pressroom only the ones listed in its settings, so the property cannot be
what the site looks for. The code block's info string is the property's
name, and every publishing tool leaves a code block alone (Quartz Syncer
re-parses the whole note with remark and prints it again, which changes the
text but not a code block's value). The plugin
([`quartz.ts`](../../src/web/static/quartz.ts)) walks the content folder the
build was given (`ctx.argv.directory`), skipping names that start with a
period and `node_modules`, following a linked folder once; takes the notes
named `callout-studio-quartz.md` that carry the block, and only where there
is none, reads every note for it (a renamed note). Several: the one at the top
of the content folder, then the first by path - the order Obsidian's side
keeps current in - and the build log names the others. The note is read
from disk, so `ignorePatterns` on it changes nothing.

**How it stays off the site.** Three ways, so no one of them holds alone:

- the note says `draft: true`, which Quartz 4 (`RemoveDrafts`) and 5
  (`configuration.drafts`) drop by default, before the plugin is installed
  too, and which Quartz Syncer passes through;
- the transformer marks it, as it passes, `draft: true`, `publish: false`
  and its property again, for a tool that dropped them (Pressroom) and for a
  Quartz 4 site with `ExplicitPublish`, which Quartz Syncer's own `publish:
  true` would otherwise satisfy;
- the plugin is a filter too (`shouldPublish`, the manifest's `category:
  ["transformer", "filter"]`; Quartz 5 uses the default export for both),
  which drops a page carrying the property even where drafts are published on
  purpose. Quartz 4 has no plugin manifest: a Quartz 4 site that publishes its
  drafts adds `CalloutStudio()` to `filters` (the README and the user guide
  say so).

**Where a new note goes.** At the top of the vault; under `content/` where
the vault is the Quartz repository (`quartzInVault`); in the folder Quartz
Syncer publishes from where it is on (`TargetOptions.noteFolder`). It is
created with `draft: true`, the publishing plugin's property set to `true`
(`noteMarkers`), and its own. After that its properties are the user's.

**The plugin that publishes the notes**
([`notePublisher.ts`](../../src/manager/web/notePublisher.ts)) is read from
its settings file in the vault's configuration folder: Quartz Syncer's
`publishFrontmatterKey`, `vaultPath` and `allNotesPublishableByDefault`,
Enveloppe's `plugin.shareKey`, `plugin.excludedFolder` and
`plugin.shareAll`, with each plugin's own defaults. Quartz Syncer wins where
both are on. The panel then adds the step to publish the note, and warns of a
note switched off for that plugin or where it does not publish from
(`siteFacts.readQuartzFacts`). The others are not named; a line under the
note's step covers them.

**What is checked before drawing.** A note whose fingerprint does not match,
whose data is not a snapshot of a format the plugin knows, or that is missing,
is not drawn from: the site keeps `[!tip]` as text, and the build log says why
in one line from `externalResources` (Quartz asks for it once for the pages,
while the rehype plugins are asked for once per worker). Nothing throws into
the build. It is looked for each time Quartz asks, not once per process, so a
preview server that rebuilds reads the current note.

**The heading band against Quartz 4 themes.** Quartz Themes installs a theme on
Quartz 4 as one `_index.scss`, which styles headings in dark mode as
`html[saved-theme="dark"] body h2` and so outweighed the band's plain
`.cs-heading-callout` rule: the tint and the corners went in dark mode.
`targets.quartzCss` weighs that one rule up (`QUARTZ_HEADING_BASE`, one class
and five elements), still under every rule of a single callout. Checked with
Minimal and Tokyo Night on Quartz 4, and `@quartz-themes/core` on Quartz 5.

### Digital Garden: the snapshot as a note

Digital Garden's renderer is not written into the vault either (nor, since
2026-11-17, Quartz's). A garden is built on a server from the garden's repository, and the
Digital Garden plugin carries exactly two things there: notes marked
`dg-publish` (with their pictures), and what its own settings write. A folder
of `.js` and `.css` is neither, which is why the first version of this export
asked the user to upload a folder to GitHub by hand after every change.

So the two halves travel separately:

- **The renderer and its host** are the Callout Studio garden plugin: one
  plugin, the same for every garden, holding nobody's callouts. It is built by
  `npm run garden:build` (`scripts/lib/gardenPlugin.mjs`) and published from a
  repository of its own, `GARDEN_PLUGIN_REPO_URL` - the Digital Garden plugin's
  installer copies *every* file in the repository it is pointed at, so it
  cannot be this one. The user installs it once from the Digital Garden
  plugin's own list (**Publication Center → Site → Plugins → Browse &
  install**, by searching for it; the panel's **Open garden plugins** opens
  that list with ours selected), and updates it from the same list. Until it
  is in Digital Garden's community list it can be installed by pasting the
  repository's address under **Install from GitHub**; the panel stopped
  showing that address on 2026-11-16 night, at the user's request. See
  [Build, test & release](20-build-test-release.md#the-digital-garden-plugin).
- **The snapshot** is a note, which the user publishes like any other. Its
  format is [`web/static/gardenNote.ts`](../../src/web/static/gardenNote.ts),
  imported by both readers:

```markdown
---
dg-publish: true
callout-studio-web: 1
---
# READ THIS

> [!question] What does this file contain?
> …

> [!failure] What not to do
> …

> [!success] What you can do
> …

```callout-studio-web
sha256:<SHA-256 of the JSON>
<the snapshot as JSON, UTF-8, base64, 76 characters a line>
```
```

- **The property is the identity**, on both sides. Obsidian finds the note in
  the metadata cache wherever it was moved
  ([`webNoteLocation.ts`](../../src/manager/web/webNoteLocation.ts), which
  finds the Quartz note the same way by its own property);
  the Digital Garden plugin publishes every property the user set, nested
  under `dg-note-properties` in a one-line JSON front matter, and the garden
  plugin reads the same key there. Its value is the note's format, so a garden
  plugin refuses a note a later Callout Studio wrote instead of misreading it.
  Several notes with the property: the one at `GARDEN_NOTE_PATH` wins, then
  the first by path - the same rule on both sides - and the others are
  reported. Those of them that carry a data block of ours are copies a sync
  service left, and a conflict copy ("… (Conflicted copy …)") can sort before
  the note it copies, so they are kept current along with the note
  (`webNoteLocation.webNoteCopies`, `TargetFile.copy`): never created,
  never asked about. A note with the property and no data block is not one
  this plugin wrote, and is never written.
- **Base64 in a code block** because Digital Garden rewrites a note on its way
  to the repository (links, embeds, comments, block ids, highlights). Its
  compiler is AST-based and leaves code blocks alone, and base64 contains
  nothing any of those steps could match even if one did not. The fingerprint
  catches what is left: a note edited by hand, or damaged.
- **Byte-stable**, like every other export: no timestamp, and the text at
  its top is English in every language.
- **What the note says to whoever opens it** is a `# READ THIS` heading
  (2026-11-16) over three callouts, in the user's own words (2026-11-15):
  *What does this file contain?*, *What not to do*, *What you can do*
  (`GARDEN_NOTE_INTRO`). The Publish to the web panel opens the note when it
  writes it by hand ([The Publish to the web panel](#the-publish-to-the-web-panel)),
  so the heading is the first thing seen. Callouts, because a `%%` comment
  does not survive Digital Garden. It was one `[!warning]` before, which said
  not to edit and left out what the reader may do: rename the note, move it,
  delete the folder. The "don't edit" line says when an edit is undone - the
  next time Obsidian starts or a callout changes - since that is when the
  refresh looks ([Keeping files up to date](#keeping-files-up-to-date)); it
  first said "any changes you make in the settings", which the user found
  was not the whole of it. The garden plugin never reads this text, so
  changing it needs no release of the garden plugin.

The garden plugin's side - finding, checking, drawing, keeping the note off the
site - is [Render roles § Digital Garden](09-render-roles.md#digital-garden).

### Writing

[`writeTarget.ts`](../../src/manager/web/writeTarget.ts) decides, file by file,
what to do about whatever is already at each path. A target's files come in
two kinds:

- **`block`** - the file is the user's, and we own a marked section of it.
  `publish.js` and `publish.css` are the only two files Obsidian Publish
  loads, and a site that has them is likely to keep its own things there. See
  [`managedBlock.ts`](../../src/manager/web/managedBlock.ts): a start marker
  whose comment carries a fingerprint of the body, the body, an end marker.
  Everything outside the markers is handed back unchanged. A start marker with
  no end is refused rather than guessed at.

  The header comment of every block answers the note's three questions for
  that file (`targets.fileProse`): what it contains, with "It updates
  automatically whenever you add, edit, or delete a callout" and what is then
  left to do; what not to do; what one can do. The answers differ where the
  rules do. An edit to one of these files is *kept* - the refresh stops for
  that file, and writing by hand asks first - so they say that, not the
  note's "it is overwritten anyway". They cannot be renamed or moved in the
  vault, since they are found by path, where the note is found by its
  property. And each says that deleting it is how to stop.
- **`json`**, Quartz's `.callout-studio/quartz.json` with its fingerprint in a
  key of its own, was a third kind for a day (2026-11-17), and **`whole`**
  (`index.js` and `index.d.ts` under the snippet's header comment) a fourth
  before it, for the Quartz plugin folder. No target writes either any more.
- **`note`** - the Digital Garden note and the Quartz note (`TargetFile.note`
  says which: its property, words, and the properties a new one gets). Its
  properties block is the user's and is kept byte for byte; its body is ours.
  A note *with* its property (`callout-studio-web`, `callout-studio-quartz`)
  is ours whatever its body says, so an edited
  body is replaced - by hand and automatically, without asking. That is the one
  deliberate exception to "never replace an edit": the body holds nothing but
  the encoded snapshot under a text saying so, and an edit to it only stops
  the site reading it. A note *without* the property at the usual path is
  somebody else's and is foreign like any other file.

and there are two ways of being asked:

| | By hand (the window's button) | Automatically (`auto`) |
| --- | --- | --- |
| Missing file | created | left missing |
| Ours, unchanged | not written | not written |
| Ours, as this device left it, callouts changed | replaced | replaced |
| Ours, another device's version ([Two devices](#two-devices)) | replaced | skipped |
| Edited or foreign | one confirmation naming every such file; a no writes **nothing** | skipped |
| `publish.js` with no block | block appended (adding is not replacing, so nobody is asked) | left alone |

Exports run one at a time across all targets, and nothing throws. There is no
"nothing to write": with heading and inline callouts both switched off the
renderer turns no token, and the stylesheet still carries the block callouts.
`webTargetStatus` answers "missing / current / stale" for the
window without writing, "edited" for a Digital Garden note whose data no
longer matches its fingerprint - the one state in which the garden cannot read
it - and "elsewhere" for files that are another device's version, which an
automatic refresh here leaves alone. A stand-in plugin with no memory says
"stale" there instead: it recognises nothing, which says nothing about whose
the files are.

### Keeping files up to date

[`autoUpdate.ts`](../../src/manager/web/autoUpdate.ts). A website export is a
snapshot, and for two of the services a current file is all that stands
between a change and the site: the Quartz plugin reads its file out of the
vault on every build, and Obsidian Publish lists `publish.js` under *Publish
changes* like any note.

- **Always on, for every target, and for nothing that is not there.**
  Writing a target by hand in the Publish to the web panel is what asks for
  it. Until 2026-11-15 it was a switch per target, off by default (on for the
  Digital Garden note); the user asked for it to go, since a file that had to
  be remembered was a site that fell behind. The panel's site step and the
  text at the top of every file say that the rewriting is automatic.
- A registry change schedules one `auto` export per place a target's files
  can be - a note is found by its property, and Quartz's usual place is
  looked at both at the top of the vault and under `content/`, for the moment
  the metadata cache lags a write - debounced 2 seconds, and a device runs one when its
  workspace is ready, for changes that arrived as synced settings while it
  was closed. A device that is running is told by the repaint every wholesale
  replacement of the registry ends in (`main.ts`'s `refreshCallouts`:
  settings adopted from another device, an earlier setup restored), because
  `registry.load` announces no change.
- **A vault with none of the files pays a few `exists` calls.** An `auto`
  export first asks whether any of the target's paths is there
  (`targets.targetPaths`, the same paths `targetFiles` then writes), and
  returns before the snapshot is built when none is.
- Because it is an `auto` export, it never creates a file and never replaces
  one the user edited - except the Digital Garden note's body, as above.
  Deleting a file opts that file out, and is the only way to.
- A refresh that rewrote something tells its listeners
  (`WebAutoUpdate.onDidWrite`): the Publish to the web panel, while open, reads
  the files again, so it does not go on saying "Out of date" about a change
  made two seconds before it opened.
- **It waits for icons.** While a callout's library artwork is still on its
  way to the device (`webData.pendingIcons`: a remote pack's icon that
  resolves to nothing and has not failed), an `auto` export returns `waiting`
  and writes nothing; the icon service's change signal schedules it again.
  Otherwise a site could be sent the pencil placeholder a note shows for a
  moment. An icon whose fetch failed is not waited for - the note draws its
  fallback for good, and so does the site. A write by hand does not wait: it
  writes what the note shows.
- **No setting says which targets are kept current.** What is in the vault is
  the answer, so a device that never opened the panel keeps the files it was
  synced as current as the device that wrote them, and a backup restored into
  a vault without the files writes nothing there. `DeviceLocalStore.webExport`
  holds where the panel was left - the service chosen last and the Quartz
  version (the user's ticks were there until 2026-11-16 night) -
  and the services the settings page no longer offers
  ([The offer on the settings page](#the-offer-on-the-settings-page)); its
  `auto` list of switched-on targets is gone, and a stored one is dropped at
  the next write. What a device remembers about the files themselves is
  below.
- **Never while saving is paused** (`WebAutoUpdateOptions.held`, which
  `main.ts` answers with `SettingsWriter.isFrozen`). The registry then holds
  the defaults or a recovery copy, not the user's settings, and a plugin that
  writes no settings writes no website files either: they would carry what
  this device could not read to every device and to the site. Asked when a
  refresh runs; the adoption that ends the pause schedules one.

The output is a function of what syncs - the settings, the plugin's version -
and of Obsidian's own icon set, which `setIcon` draws Lucide icons from. So two
synced devices with the same callouts write identical files, and the second
write is skipped as unchanged; a refresh after a theme measurement settles, or
after a theme switch, finds nothing to write.

### Two devices

[`fileMemory.ts`](../../src/manager/web/fileMemory.ts). The files sync, and
the refresh runs on every device that has them. Until 2026-11-15 a file that
was ours and differed from what this device would write was reason enough to
replace it, and a simulation of two devices over one vault showed what that
does. A device with other callouts - the plugin installed there with its own
settings, which is how Obsidian Sync leaves a community plugin unless asked,
while the Digital Garden note, being a note, does sync - rewrote every file
with its callouts at each start, and the first device rewrote them back at its
next one. A device that started before its `data.json` had arrived put the
previous callouts back. Two builds of the plugin replaced each other's files
at every start. Nothing in a file says which of two versions is the newer, so
each device answers only for itself:

- `DeviceLocalStore.webFiles` holds, per file, a SHA-256 of what this device
  last wrote there or last found there identical to what it would write. The
  name is `TargetFile.slot`, not the path: the note is the same note wherever
  it was moved. The Quartz note's slot is `quartz` (it was `quartz/data` for
  the JSON file).
  It is a field of its own, not part of `webExport`, which the page writes
  whole from a copy it took when it opened.
- **An automatic refresh replaces a file only when what is on disk carries
  that hash** (`writeTarget.refreshVerdict`). Anything else is another
  device's version, and is left alone; the page says **Written on another
  device** (`elsewhere`). **Update now** replaces it, and from then on this
  device answers for the file and the other stands back, until it agrees
  again.
- **Nobody has to be told.** Two devices with the same callouts and the same
  build find each other's files identical to their own, so both come to
  answer for them; whichever sees a change first writes it, and the other
  finds it already there.
- **The settings can arrive before the files.** A device that leaves another
  device's file alone remembers for the session what it would have written
  there (`passedOver`). A file arriving runs nothing, so without that the
  next change made here would find a file it never agreed with, and leave it
  for good.
- **The Digital Garden note is compared by its data first**, by fingerprint,
  since that is all a garden reads: data its own fingerprint does not vouch
  for (a merge, an edit) is put back by a device that has answered for the
  note before; other data is another device's callouts, unless it is what
  this device left there; the same data under other words - another build's
  wording, a formatter - is current, and only the device that wrote those
  words replaces them, or two builds would trade wordings for ever.

What it costs: a device whose local storage was cleared, or a vault opened in
a new installation, answers for nothing until its files are what it would
write or it writes them by hand, and until then its panel says they were
written elsewhere. Two devices whose output differs anyway - different
Obsidian versions whose Lucide drawings differ, different versions of this
plugin - no longer trade files at every start: the files follow the device
that wrote them by hand last, or that last answered for them, until the other
is updated. `tests/webTwoDevices.test.ts` holds each case, the devices that
adopt settings being real launches (`tests/support/launchWorld.ts`).

**The same callouts must be the same bytes, every time they are asked for** -
`webTargetStatus` and every `auto` export compare the file with what would be
written now. A picture the user uploaded broke that until 2026-11-15: a copy
of an SVG that brings ids or a `<style>` is fenced with a tag
(`icons/isolateSvg.ts`), on screen a running number, and `webData.bakeIcon`
reads the painted copy back as markup. So each snapshot differed from the one
before it, the page said "Out of date" straight after **Update now**, and
every refresh rewrote the files. `bakeIcon` now paints inside
`withSvgCopyToken`, with a token fixed by the callout's place in the sorted
list (and a second one for a heading drawing that differs from the inline
one, since those are two drawings on one page). `tests/svgCopyToken.test.ts`
holds the fence to it. Writing a website file changes no setting, so
it schedules nothing: there is no loop. Where two devices' bytes differ
anyway, see [Two devices](#two-devices).

### Guessing the service

[`detectService.ts`](../../src/manager/web/detectService.ts) lets the page
put the likely service first, with the reason. It is a guess and is used as
one: nothing is chosen, written or switched on because of it.

Only the vault is read - its top folder, its notes' properties, its own
configuration folder - through the vault adapter:

| Service | Strong sign | Hint |
| --- | --- | --- |
| Obsidian Publish | `publish.js` or `publish.css` in the top folder; `publish.json` in the configuration folder | the Publish core plugin is on |
| Digital Garden | `digitalgarden` in `community-plugins.json` | a note with a `dg-publish` property |
| Quartz | `quartz-syncer` in `community-plugins.json`; `quartz.config.yaml` (Quartz 5) or `quartz.config.ts` (Quartz 4) in the top folder | the vault is named `content` |

Quartz is the hard one: a Quartz site usually keeps the vault *inside* its
repository, so the file that would settle it sits one level above anything
this plugin may read. `readServiceSignals` (reading) is kept apart from
`rankServices` (judging), so the judgement is a pure function.

### The offer on the settings page

The page is one row near the foot of a long settings page, and the people it
is for are the ones least likely to go looking: they already have a site that
works. So when the vault looks published, the settings page says so once, in
the notices' box
([Declarative settings § The notices at the top](26-declarative-settings.md#the-notices-at-the-top)):
*It looks like this vault is published with Quartz. Would you like your
callouts to look the same on your site?*, with **Show me** and ✕.
[`webOffer.ts`](../../src/manager/web/webOffer.ts) decides which services it
names.

- **When it looks.** Once each time the settings tab opens (the visit, in
  `declarativeSettings.ts`), never while the plugin loads. The look is the
  same guess as above and takes file reads, while a row's `visible` cannot
  wait; so the answer is kept for the session and the page is drawn again only
  if it changed. On the very first opening the offer therefore arrives a frame
  or two after the page.
- **Hints count.** Unlike the panel's list, which only puts a detected
  service first, the offer is not asked
  for, which argues for strong signs only. But the commonest Quartz layout -
  the vault is the site's `content` folder - leaves nothing but a hint, and a
  wrong guess costs one press on ✕. The sentence says *looks like* for that
  reason.
- **It only shows the way.** **Show me** scrolls to the **Publish to the web**
  row and flashes it (`ctx.jumpTo(MAIN_PAGE_ROWS.website)`), exactly as the
  import offer's **Import** does with the Import row, and opens nothing. The
  reader learns where the page is and not only that it exists, and the next
  time needs no offer. (For a day, 2026-11-14, it opened the setup window
  itself; the user asked for the import offer's way instead.)
- **Each service is offered once.** A service stops being offered when the
  offer is dismissed (✕ ends it for every service it names), when the Publish
  to the web panel is opened - it shows every service the vault points at,
  tagged, so `WebPanelView.firstRead` ends the offer for all of them - or when its files
  are already in the vault (`isSetUp`: the Quartz note and the Digital Garden
  note, each by its property, our block's start marker in
  `publish.js`), which is the second device of someone who set it up on the
  first. **Show me** alone ends nothing: being shown a row is not an answer.
- **A service that turns up later is offered then.** This is what "the first
  time after the site is built" means in practice: a vault that starts being
  published a year after the plugin was installed gets the offer on the next
  visit to the settings. So does a vault that adds a second service.
- **Several services are one offer.** It names them all, the convincing ones
  first, in one sentence; the page they lead to shows them side by side.
- **Remembered per device** (`DeviceLocalStore.webExport.offered`), with the
  rest of the export's memory and for the same reason: a backup restored into
  another vault says nothing about how that vault is published. The price is
  that a second device asks once more, unless the files are there already.

The Callout Manager importer's paste route can parse a limited subset from
either Callout Manager CSS or a Callout Studio snapshot, pasted from the
clipboard. This is a partial recovery/migration path, not a restore of the
backup format or a full-fidelity one: CSS cannot carry the complete definitions,
settings, palettes, commands, or stored image data in the JSON backup.

## Import - the JSON backup

This is the matching restore path for Callout Studio's own exported state.
Users select a JSON backup explicitly; the plugin does not infer an import from
a CSS file placed in the vault or from anything in the snippets folder.

[`src/utils/importValidator.ts`](../../src/utils/importValidator.ts) (~1,250
lines) is the gate every import file passes through before a single
`registry.add()`/`update()` call happens. `validateImportPayload(raw,
registry)` accepts **both** the legacy flat-array shape and the v2 envelope,
never bails early on one bad entry, and collects **every** issue across the
whole file in one pass - so `ImportReportModal` can show the complete
picture at once rather than one error at a time across repeated attempts.

`ImportReportModal` draws that picture as Obsidian settings (finding S9-08):
problems with the file as a whole first, in a `SettingGroup` with no heading,
then one group per entry headed **Entry 3 — idea**, all with `mod-list`. Each
problem is a row (`cs-import-issue cs-import-issue-<level>`): the message as the
row's name, coloured through Obsidian's `--setting-item-name-color` (error red
for an error, which skips the entry; warning orange for a warning, which drops
one value), and the field it concerns as `code` in the description, which
app.css draws in small monospace. The window body is the only scroller. Until
2026-10-24 the list was a grey box with a 50vh scrollbar of its own inside the
scrolling window, with dashed lines between entries and a bold lead line.

### Resource limits and hostile input

All three importers share `utils/importLimits.ts`. Files are checked against a
16 MiB ceiling before reading (`File.size` or the vault adapter's `stat`), and
their text is checked again in UTF-8 bytes. Clipboard text has the same ceiling.
JSON depth, per-container counts, and total value counts are checked before
`JSON.parse` can allocate the tree; an iterative pass checks the parsed structure
again. The limits are 32 container levels, 50,000 values, and 1,000 entries in any array
or object. Native validation and both foreign format readers also check parsed
objects, so a non-UI caller cannot bypass the structural limits. Rejection is
fatal and happens before registry mutation. A UTF-8 BOM is accepted.

Callout Manager CSS uses forward-only comment/block/selector scanning with
work and entry budgets; unmatched braces or comment openers cannot trigger
the previous unanchored regex's quadratic backtracking.

The report retains the complete issue count but renders only the first 200
issues, shortening untrusted labels, fields and string parameters to 500
characters. All output remains text nodes, not HTML. Unexpected failures in the
foreign-plugin import window are reported and release its busy state.

Settings scalars are reconstructed by type, and icon-picker enum values are
allow-listed. An object cannot be retained as a style name, fallback id, or
boolean and later break a picker or a saved-file reload. SVG/image constraints
are described in [Icons](13-icons.md); a JSON size cap alone cannot bound the
decoded size of an embedded compressed picture.

Prospective image collection budgets are checked again immediately before
applying either native or Admonition imports: sync can change the destination
while the user reviews the report. A changed budget produces a fatal report
before definitions or pictures are mutated.

Corrected warning copy uses new English keys so an older translation cannot
override it with a false claim about what was imported. The previous warning
keys remain in the locale tables for a later translation cleanup; no non-English
table is changed by this hardening.

### Per-field validation

- **IDs**: `ID_BAD_CHAR_RE` rejects pipes, brackets, and non-space
  whitespace (tabs/newlines) - but explicitly **permits** spaces (multi-word
  labels are valid) and, notably, permits `"` and `\`. This is exactly the
  gap [CSS generation § selector escaping](06-css-generation.md#calloutsel-vs-tokenattrsel---the-selector-escaping-rule)
  exists to cover - an imported id can carry those characters into the
  registry with nothing here to stop it.
- **Colours**: `HEX_COLOR_RE` - `#rgb` or `#rrggbb` only.
- **Icons**: `type` checked against `ICON_PACK_IDS` (derived from the pack
  registry, never hand-duplicated - so adding a new pack can never leave the
  validator rejecting icons the plugin itself now produces); Material
  `style` checked against the four known values; `weight` range-checked.
  **Icon *name* validity is checked separately and asynchronously**
  (`unknownIconNameIssues`) - after the rest of an entry validates, because
  the packs' search indexes decode on demand and it isn't worth failing an
  otherwise-fine entry over one bad icon name. A name that exists in no pack
  is replaced with `FALLBACK_ICON` (the Lucide pencil) and reported as a
  **warning**, not an error.
- **Tags/aliases**: length-capped at `MAX_TAG_LENGTH` (200 - a generous
  safety net on *imported*, untrusted data only; the editor itself imposes
  no length limit), count-capped at `MAX_TAGS_COUNT`, primary ID included -
  the same constant the editor's IDs field stops at (see
  [How many IDs a callout can have](14-callout-editor.md#how-many-ids-a-callout-can-have)).
- **Metadata**: every value must be a string. Keys such as `__proto__`,
  `constructor`, and `prototype` remain literal data properties through import
  and export; safe object construction avoids invoking inherited setters or
  silently discarding a metadata entry.
- **Unknown top-level fields** are reported as warnings via `KNOWN_FIELD_MAP`
 - a **total `Record`** over `keyof CalloutDefinition`, so adding a field
  to the type without adding it here is a compile error, which is what stops
  the plugin from warning about its *own* export the moment a new field
  ships.
- **`RETIRED_FIELDS`** (`solidBackground`, `styleMode`, and `externalStyle`) are dropped
  **silently**, with no warning - an export from an older build of the
  plugin itself carrying a since-retired field isn't a file the plugin
  "doesn't understand," so it doesn't get the generic unknown-field warning.
  In particular, an old `externalStyle: true` does not restore the removed
  personal-CSS ownership mode: the imported callout uses its stored appearance
  normally, and an import does not trigger the load-migration notice.

### `missingImageIssues` - pictures that didn't travel with their callout

This check runs for both the v2 envelope and legacy flat arrays. A legacy array
cannot carry pictures itself, so its image ids must already exist in the target
vault or the user sees a warning before importing.

An ordinary export carries the user's pictures inside `settings.userImages`,
so this normally finds nothing. It fires specifically when someone
hand-edits a file, or pastes one vault's exported *callouts* array beside
another vault's *settings* - without this check, a callout referencing a
picture id nobody has would simply render blank with no explanation. A
picture the target vault **already holds** under that id is fine - the id
alone is enough, and re-importing a callout back onto the device that first
made the picture is the ordinary, expected case.

### Applying: add-or-update, never a blind overwrite

```ts
for (const def of defs) {
  if (registry.has(def.id)) { applyImportedCallout(registry, def); overwritten++; }
  else { const added = registry.add(def); if (added) imported++; }
}
```

An id already in the registry is **updated in place**, not skipped or
duplicated - this is what makes re-importing the same backup, or importing
one vault's export into another that shares some built-in customizations,
converge rather than error.

Native definition imports use `registry.batch()` like the two foreign importers,
so a large accepted file triggers one change notification instead of one
stylesheet rebuild, repaint, and save request per definition.

`applyImportedCallout` clears optional appearance, palette-link, customization
and metadata fields omitted by a backup before merging the validated definition.
Thus restoring a backup does not retain later text colors, icon adjustments or
palette links. Aliases are the intentional exception: importing does not rewrite
notes, so incoming and existing aliases are united by canonical identity. Removing
an old alias remains an editor action, whose save plan protects its note usages.

### Before anything is applied

`processImportedJSON` asks, backs up and checks saving before its first
registry mutation:

1. A file with no issues shows a `ConfirmModal` summarizing what it will do:
   callout types added, existing ones replaced by the file's version, and
   setting groups restored. A file with issues has already been through
   `ImportReportModal`, which is its confirmation.
2. `blockedWhilePaused()` refuses the import while the settings writer is
   frozen. An import that cannot be saved would look done and vanish on
   restart. The **Import** button checks this too, before a file is chosen.
3. `writeSettingsBackup()` saves the current setup to `<plugin-dir>/backups/`
   and reads it back. No verified copy means no import.
4. After applying, the import awaits `saveSettings()` and asks
   `settingsWriter.persists()` whether the settings file holds the result.
   If not, it says the import is shown but not saved, instead of reporting
   success.

The foreign-plugin window (`PluginImportModal.apply`) takes steps 2 - 4 as well;
its report or its explicit **Import** click is the confirmation.

### Settings import: restore the groups the file carries; three lists merge by id

```ts
const present = presentSettingGroups(parsed);  // the settings keys the file itself carries
const restored = Object.keys(result.settings).filter(key => present.has(key) && !LIST_GROUPS.has(key));
Object.assign(registry.settings, pick(restSettings, restored));  // ← only those groups
applyPaletteMerge(registry, mergePalettes(registry.settings.customPalettes, customPalettes));  // by id AND by name
registry.setUserImages(mergeById(registry.getUserImages(), userImages));
registry.settings.customCommands = mergeById(registry.settings.customCommands, customCommands);
```

`sanitizeImportedSettings()` returns a complete `PluginSettings`, filling every
group the file lacks with its default. Applying all of it made an older export
reset every setting group it predates. Only groups present in the file are
restored; 1.x files that carry `popup` restore `contextMenu`, which the merge
reads it into.

> [!IMPORTANT]
> **`customPalettes`, `userImages`, and `customCommands` are the three
> exceptions to "settings import restores the group," and this is
> deliberate, not an oversight.** Every other settings field (global style,
> context-menu config, fallback id, language) is a single value with no id
> of its own - "keep both" has no meaning for a border width, so an import
> *is* a restore for those. But these three are **lists the user builds up
> over time**, and `Object.assign`ing them from an import file would
> silently **wipe** the user's existing palettes/pictures/commands the
> moment they imported a file that predates one of them (an old export
> naming zero custom commands would delete every command built since). See
> [`mergeById`](../../src/utils/mergeById.ts): a repeated id overwrites in
> place (so re-importing the same backup rewrites, not duplicates, without
> reshuffling the list), a new id is appended, and an empty incoming list
> changes nothing at all. Palettes layer a name match on top of this rule -
> see below.
>
> **The rule generalizes to any *new* settings-level list**: it must merge
> by id on import, or it will silently wipe the user's own list the same
> way. See also [Data model § `PluginSettings`](04-data-model.md#pluginsettings)
> for the three places a new settings field has to be registered.

**Palettes are also matched by name.** They use
[`mergePalettes`](../../src/utils/mergePalettes.ts) rather than plain
`mergeById`, because the palette editor treats the *name* as the
palette's identity (it refuses a second palette under a taken name,
case-insensitively) and its auto-suggested name for any blue is "Blue 2". Two
vaults that each made a blue palette therefore carry a "Blue 2" apiece under
different ids, and merging by id alone left both in the list - twins no
dropdown could tell apart.

- An incoming palette whose **id or name** (`normalizeName`: trimmed,
  case-insensitive) matches palettes the vault already had **replaces them in
  place, keeping the vault's id**. Local callouts therefore stay linked, and the
  palette keeps its place in the list. A vault holding several palettes under
  that name (the state the older merge left behind) has them all rewritten to
  the file's version, which makes them identical for the consolidation below to
  fold - so importing the file again repairs such a vault.
- A palette the file has itself written is never matched by name again, so a
  file that carries two same-named palettes brings both across instead of one
  eating the other.
- `PaletteMerge.remap` records file id → vault id for the name matches, and
  `applyPaletteMerge` re-points the callouts the file brought for it with
  `registry.relinkPalette`. `PaletteMerge.restyled` lists the palettes whose
  *colours* changed; `applyPaletteMerge` repaints their linked callouts with
  `registry.applyPaletteColors`, the call editing a palette makes, so a
  callout the file does not carry follows its palette instead of keeping the old
  look under the same name. Nothing is repainted when the colours are the ones
  the vault already had, which is also what keeps re-importing a file inert.
  This applies to an id match as well as a name match.

A palette merge can also produce **cross-vault duplicate colours** - two
vaults independently making the same colour under different names and ids - so
`consolidateDuplicatePalettes()` runs immediately after the palette merge,
folding duplicates and re-pointing any callout that referenced the
now-merged-away id, with a one-time notice.

An import that adds callouts also triggers `ensureIconArtworkFor()` for
every imported icon whose callout doesn't hide it - see
[Icons § the only repair path](13-icons.md#ensureartworkforicons---the-only-repair-path).

## The plugin import window

Both foreign-plugin importers are one window,
[`src/settings/pluginImport/PluginImportModal.ts`](../../src/settings/pluginImport/PluginImportModal.ts),
configured by a `PluginImportSource`
([`admonitionImportSource.ts`](../../src/settings/pluginImport/admonitionImportSource.ts),
[`calloutManagerImportSource.ts`](../../src/settings/pluginImport/calloutManagerImportSource.ts)).
A source never touches the DOM. It supplies the other plugin's id (and so
where its `data.json` lives), the window's per-plugin class, its one fallback
(`manual`), its i18n keys, and two readers: `fromDataJson` for the
probed file, and `fromText` for the fallback's text. Each reader returns a
`PluginImportBatch`, which holds the entries in a closure together with the
plugin's planner and `apply` method. That lets the modal import without ever
seeing an entry type. It also keeps the modal class free of type parameters,
which `tests/modalChrome.test.ts`'s chrome scan requires. A third importer is
one more source object and one more row in `ImportSourceModal`.

**One screen, at most two options, exactly one Import.** The window used to
show an Import inside the "This vault" row as well as a footer Import that only
read the paste box, and Admonition's "Choose file…" imported the moment a file
was picked. Later versions split it into views behind a header Back arrow,
made each option a box that was its own button - one of which read the
clipboard the moment it was clicked, which nothing on screen announced - and
then showed one option at a time behind a small text link, which hid the
choice. Now both options are on one screen:

- **This vault** - a card saying what was found. On screen while the probe is
  still looking and once it has found something.
- **The source's one fallback** - always on screen, and alone when the vault
  holds nothing to import.

The fallback is the source's to name -

```ts
type PluginImportManual =
  | { kind: "file"; accept: string }        // Admonition: `.json`
  | { kind: "paste"; placeholder: string }; // Callout Manager
```

 - matching what each plugin hands its users: Admonition's export button writes
a file, so its window takes an uploaded file; Callout Manager's Copy button
fills the clipboard, so its window has a text box and a Paste button. The
footer Import is the only import control. Which option is active, and so what
Import acts on, is decided in one place,
[`pluginImportFlow.ts`](../../src/settings/pluginImport/pluginImportFlow.ts),
as pure functions of the window's state. The flow knows the fallback only as
`manual`; whether that is a file or pasted text is the window's and the
source's business, which is what makes a third route structurally impossible
rather than merely not drawn:

| Option | Holds something when | How it is filled |
| --- | --- | --- |
| `vault` | the probe found entries | the probe, on open |
| `manual` (a file) | a file is staged | **Upload** opens the file picker; dropping a file onto the card stages it |
| `manual` (pasted text) | the text box holds something other than whitespace | the user pastes or types into it, or presses **Paste** |

`vaultOffered()` is true while the probe is `checking` or `found`.
`activeOption()` is the user's last choice (`flow.chosen`) while that option
still holds something; otherwise the vault once found, as the recommended
default; and otherwise whatever the fallback holds, being the only thing on
screen. Filling the fallback - a file staged, text typed or pasted - chooses
it; a click on the vault card, or on its radio, chooses the vault. Each
option keeps what it was given while the other is active, and Import only ever
reads the active one.

- **The cards** (`renderOptions`,
  [`pluginImportViews.ts`](../../src/settings/pluginImport/pluginImportViews.ts))
  are option boxes drawn as cards (`.cs-import-vault`, `.cs-import-manual`),
  built **once** per open. `update()` writes everything that changes in place -
  the count, the Recommended tag, a staged file's name, which card is active -
  so nothing the user is in is ever replaced: the Upload button that becomes
  Replace is the same button, typing never moves the caret, and the probe
  settling touches neither the text box nor focus.
- **Choosing.** While both cards are there, the list is a
  `role="radiogroup"` named by the window's title (`aria-labelledby`, never an
  `aria-label`, which Obsidian would pop up as a tooltip over every card), and
  each card starts with Obsidian's radio, `input.cs-option-radio`: one `name`
  per window (the title's id), `aria-labelledby` its card's title line,
  `aria-describedby` its status line. The radio, not the card, is the
  control, because a radio may hold no control and the fallback's card holds
  a button and, for a paste, a text box. The whole card is still one pointer
  target for the same thing: a click anywhere on it chooses it - except on its
  own button or text box (`closest("button, textarea")`), which does what it
  says instead. Space on a radio, or the arrow keys moving the check onto it,
  choose it (`change`). A radio is enabled only while its card holds
  something, so the arrow keys pass over an empty fallback; a click on the
  empty card (its disabled radio lets the click through) chooses nothing - it
  waits to be filled by its own button or box, and a notice says which:
  `import.uploadFirst` (Admonition) or `import.pasteFirst` (Callout Manager),
  picked by `source.manual.kind`. The browser checks a radio before the window
  hears of it, so after every choice `addOptionRadio` puts each radio of the
  group back to what `paintOptionRadio` last painted: a choice the window
  takes has just been repainted, one it refuses (an empty card, an import
  already running) leaves the check where it was. Going back into a text box that
  holds text (`focus`) chooses it; focus entering an *empty* box is silent,
  since the user is about to paste (`onPasteFocus` rather than `onChoose`). Choosing flips `is-selected` and
  `checked` in place.
- **The active card** wears `is-selected`: its outline turns
  `--interactive-accent`, and its radio is checked.
- **Nothing in the vault.** When the probe settles on `notInstalled`, `empty`,
  or `unreadable`, the vault card is removed, and with it the radiogroup role
  and the fallback's radio: alone, it has nothing to be chosen against, and
  wears no accent outline, and a click on its card says nothing. **Nothing says why** -
  no greyed-out card, no line saying the plugin isn't installed, and nothing
  announced. The three probe results stay
  distinct in `probeVault` and the flow; the window simply treats them alike.
  Their sentences are retired keys.
- **The instructions** above the cards - what comes over and what is left
  behind - are a caption (`.cs-import-instructions`: `--font-ui-small`,
  `--text-muted`), set as the Restore window sets its own intro.
- **The probe.** `probeVault` reads the file rather than asking
  `app.plugins`, because a plugin being migrated off is often already
  disabled. If `data.json` is missing, it checks the plugin folder: a missing
  folder is `notInstalled`; a folder without a settings file is `empty`.
  A file with no custom entries and an empty `{}` are also `empty`.
  A file that can't be read, parsed, or recognized is `unreadable`. Once
  found, the vault card carries the shared grey **Recommended** flair
  (Obsidian's `flair mod-flat`, `settings/recommendedBadge.ts`, also used by `ExportFormatModal`'s backup
  row) on its title line. While the probe is still checking, the vault card
  says "Looking for…", its radio is disabled, and the card
  (`.cs-import-vault.is-checking`) is held back 250ms, so a fast probe never
  flashes it before it goes or before the count replaces it. The fallback is
  usable from the start, so a probe that never settles cannot lock the window;
  a probe that settles after the user filled the fallback leaves their choice
  alone. A `role="status"` live region, created before the probe starts,
  announces the count once found (and nothing otherwise). Its text-only box
  uses `opacity: 0` and `pointer-events: none` to remain unpainted and ignore
  pointer hits while keeping its geometry and accessibility.
- **Pasting** (Callout Manager's window). The paste card holds a plain
  `<textarea>` on a line of its own under the card's head (the card is
  `flex-wrap: wrap`; the box is `flex: 0 0 100%`), named and described by the
  card's own title and status lines (`aria-labelledby`/`aria-describedby`),
  with the source's `manual.placeholder`. It is Obsidian's own `textarea` (the
  `.cs-text-control` hook adds no face of its own), and `.cs-import-paste-input`
  gives it **one fixed height** (132px) with `resize: none` and `overflow: auto`: it scrolls
  instead of growing with what is pasted, so the footer stays where it was. It
  is monospace and `direction: ltr`, since what goes in is CSS or JSON (in a
  right-to-left window a rule would otherwise read `} selector.`); only while
  `:placeholder-shown` does it take the window's own direction, for the
  translated placeholder. Its `input` handler keeps the text as typed
  (`setPaste()`), counts whitespace alone as nothing to import, and chooses
  the card. `fromText` runs on it only when Import is pressed, as a file's
  does, after `assertImportTextSize`; text that fails to parse is reported and
  stays in the box to correct.
- **The Paste button** (`pasteFromClipboard()`) is **the only clipboard read in
  the window**: `navigator.clipboard.readText()` from the button's own click,
  the same call Obsidian's mobile editor makes for its Paste menu item. It
  used to happen when the paste box itself was clicked, which looked like
  nothing had happened or, on a phone, raised a paste prompt nobody asked for;
  now a button says what it does and the result is there to see, in the box.
  Non-blank text replaces whatever the box held, chooses the card, and sends
  focus to Import. Blank text is an `import.clipboardEmpty` notice, a rejected
  read (or no clipboard API at all) an `import.clipboardBlocked` notice, and
  text over the import size limit that limit's own notice; each leaves the box,
  the choice and focus as they were. (`import.clipboardBlocked` is a new key
  rather than new words under the old, since removed, key that told the user
  to choose a file instead - advice this window can't honour, and that an
  older translation would keep giving.) A read that answers after the
  window was asked to close does nothing.
- **Uploading a file** (Admonition's window). The file card carries a
  standard `<button class="cs-import-action">` at its trailing edge that reads
  **Upload**, `aria-describedby` the card's two lines. Picking a file, or
  dropping one onto the card, only stages it (`stageFile()`): the card is
  rewritten in place - its title becomes the file's name
  (`cs-option-box-name`, `dir="auto"`), its status line "Ready to import.",
  and **the same button now reads Replace** - and the file becomes the active
  option. Its icon does not change and nothing turns green; the confirmation
  is an Obsidian `Notice` - `import.fileUploaded` for a first file,
  `import.fileReplaced` for one that replaces a file already staged, each
  naming the file. Focus goes to Import. A picker closed without a file
  changes nothing and says nothing. The file is read when Import is pressed,
  not when it is staged, so a file staged and then replaced is never opened.
  A read that fails (an evicted cloud file, for example) is reported as
  `import.err.fileUnreadable`, and the file stays staged to be replaced. The
  file input and the drop handlers exist only in a window whose fallback is a
  file: Callout Manager's builds no `<input type="file">`, and neither its
  cards nor its text box are drop targets.
- **A card's own button** (Upload/Replace, Paste) takes the shared neutral face
  and border explicitly (`.cs-option-box .cs-import-action`), as a footer's
  Cancel does: on a phone Obsidian's own button face is the card's colour, and
  the border is what keeps it a button there. Hovering a choosable card shifts
  its one action button toward the window's surface; hovering the button itself
  uses its usual hover face. The card-hover selector targets
  `.cs-import-action:not(:hover)` directly, without querying the parent's
  descendants with `:has()`.
- **Replacing, never emptying.** A file is swapped with **Replace** or by
  dropping another onto the card; pasted text is edited in its box or replaced
  with **Paste**. A staged file lasts until it is replaced or the window is
  closed and reopened (`onOpen` resets both). That is safe because Import only
  ever acts on the active option.
- **No Back, no Escape handling of its own.** With one screen there is nothing
  to step back to, so the window does not override `onHistoryBack` or
  `onEscapeKey`; Escape and the back gesture close it as they close any
  Obsidian modal.
- **The footer.** Import is soft-disabled with `aria-disabled` and
  `cs-btn-disabled`, like the callout editor's Save, rather than with
  `disabled`. It stays focusable, and Obsidian can return focus to it when the
  stacked `ImportReportModal` closes. Pressed with nothing to import, it
  raises the same `import.uploadFirst` / `import.pasteFirst` notice - except
  while the probe is still `checking`, when the vault may yet arm it. Its
  `aria-describedby` points at the active card's title line and status line. While an import runs, its label
  reads "Importing…" and choosing, Upload, Paste and a drop are no-ops.
- **Stale work is dropped.** A generation counter bumps on every open, in
  `close()` and in `onClose()`. The `close()` bump matters on a phone, where
  Obsidian slides the window out before it calls `onClose`. A probe, a
  clipboard read, a file read, a plan, or a report that finishes after the
  window was asked to close writes nothing to the DOM and applies nothing.
  After a successful import, Import stays on "Importing…" while the window
  leaves, so a second tap can't import again.

Every route then ends in the same sequence: plan, then `ImportReportModal`
when there are issues or no entries at all, then apply, then
`markCompetitorImportBannerHandled`, then a notice, then `ctx.redraw()`, then
close. The source's `afterApply` runs last; Admonition uses it for
`ensureIconArtworkFor`.

## Import from Callout Manager

[`src/utils/calloutManagerImport.ts`](../../src/utils/calloutManagerImport.ts)
+ `calloutManagerFormat.ts`. **Two entry routes, one shape, one planner** -
whichever route data arrives by, it becomes a `CalloutManagerEntry[]` and
goes through the same `planCalloutManagerImport`:

1. **Read Callout Manager's own `data.json` straight out of this vault.**
   Nothing is exported from that plugin first, and nothing is written back
   to it. This route brings over **more** than the clipboard route: colours
   Callout Manager stored **separately per light/dark scheme** arrive as
   both (`colorLight`/`colorDark`), and callouts the user created but never
   restyled (`declared: true`, no colour) come across too - neither of
   which the CSS-copy route can see at all, since a copied stylesheet is
   already flattened to whichever scheme was active when it was copied.
2. **Paste the CSS the plugin's own "Copy" button puts on the clipboard** -
   pasted into the window's text box (by hand, or with its **Paste** button)
   and parsed directly
   (`.callout[data-callout="test"] { --callout-icon: ...; --callout-color:
   ... }`). A `data.json` copied as text works too; the first character
   tells the two apart (`{` or `[` is JSON), so a JSON syntax error is
   reported as one instead of being retried as CSS. That is also how a
   `data.json` from *another* vault comes over now that the window has no
   file option: opened, copied, and pasted.

`declared` is the flag that lets one planner serve both doors without either
route needing to know which one is calling: a copied stylesheet never sets
it (so a colourless block is correctly treated as noise, since a plain CSS
rule with no colour teaches nothing), while a callout genuinely created in
Callout Manager (even one that plugin stored no colour for) is still worth
importing, because it exists in the user's notes either way.

An unstyled callout defaults to `#9e9e9e` - deliberately matching Callout
Manager's own default grey (its `default_colors.json`, "light gray") rather
than this plugin's own house colour, because fidelity to what the user was
actually looking at beats consistency with this plugin's conventions here.

The CM apply path keeps the resolved accents and palette link but explicitly
clears `bgColorLight` and `bgColorDark`: the source supplies an accent, so block
callouts must use core/the theme's translucent background instead of baking the
palette's stronger default tint. The shared palette resolver and Admonition
import are unchanged. This applies to new rows and color-bearing updates;
icon-only updates preserve the existing colors and background.

Re-importing repairs old CM imports in place. A load-time migration cannot
safely identify them: old imports have no provenance marker and can be identical
to manually styled, palette-linked rows. Existing palettes and unrelated rows
are therefore left intact. Opening/saving the callout editor does not recreate
the background; explicitly choosing or editing a palette still applies that
palette's authored appearance.

**Per-theme styling and custom CSS have no equivalent and are left behind**
 - reported to the user before the import runs, same as the JSON importer's
report modal.

Callout Studio has one icon per definition, so scheme-dependent icons are
flattened with a warning. A custom-CSS-only entry reports its lost styling
without falsely counting an existing callout as updated. Duplicate incoming
JSON ids are compared by canonical identity and skipped with a report instead
of silently letting a later spelling overwrite an earlier one.

## Import from Admonition

[`src/utils/admonitionImport.ts`](../../src/utils/admonitionImport.ts) +
`admonitionFormat.ts`, structured identically to the Callout Manager
importer for the same reason: **planning is read-only against the registry;
`CalloutRegistry.applyAdmonitionImport` is the only mutator**, so a report
can be shown before anything changes.

Two entry routes: Admonition's own `data.json` read straight out of the
vault (again: nothing exported first, nothing written back), or an uploaded
file - an `admonitions.json` its export button wrote, a shared pack, or a
`data.json` taken from another vault.

- **Every icon library Admonition offers maps to one this plugin already
  has** - its own bundled set, Font Awesome, Octicons, and RPG Awesome are
  all libraries this plugin also carries. Pictures the user uploaded into
  Admonition come across into **Your images**
  (`convertAdmonitionImage` - same re-encode-through-canvas pipeline as a
  fresh upload, see [Icons § Your images](13-icons.md#your-images---the-local-never-downloaded-source)).
- **A missing colour** defaults to `#448aff` (Obsidian's own Note blue) -
  deliberately **not** Admonition's own behaviour of picking a random colour
  per import, which the source comment calls out as "friendly in the moment
  and unrepeatable afterwards": importing the same file twice would
  otherwise give the same callout two different looks each time.
- **Behavior that does not migrate is reported** when `command`, `copy`, or
  `noTitle` is enabled or `injectColor` is false. `iconWithCss` also warns:
  its appearance depends on CSS that does not come with the import. Global
  Admonition settings are not restored, and importing definitions does not
  convert any `ad-*` code blocks in notes.
- **Icon lookup uses own properties**, including Admonition's historical icon
  aliases: prototype names cannot become a library object. Its RPG Awesome
  names `montains` and `perspective-dice-six-two` map to this plugin's corrected
  `mountains` and `perspective-dice-two`. An explicit pack is the faithful
  choice for ambiguous names: upstream inference depends on its loaded pack
  order, while this importer uses a deterministic order.
- **An update never renames a callout unless the admonition explicitly
  stated a title** - `AdmonitionEntry.displayName` is only set on an update
  branch when the source file carried an explicit `title` field, so
  re-importing a file that predates a rename the user made locally doesn't
  clobber it.

---
Next chapter: [16-settings-ui-and-modals.md](16-settings-ui-and-modals.md)
