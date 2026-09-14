# Using Callout Studio with your theme

One rule explains how Callout Studio works with themes:

> **If your theme styles a callout, the theme stays in control.** Callout Studio does not override any part of that design or briefly show a different style while the note loads.

You can tell which stylesheet controls a callout from the list it appears in:

- **Callouts from your theme:** drawn by your theme and read-only in Callout Studio.
- **My callout types:** created by you and drawn by Callout Studio.
- **Built-in callouts:** Obsidian's thirteen built-in types, except those restyled by your theme.

The lists update automatically when you change themes.

## Getting a long list out of the way

Each heading can collapse its own list. Click it, or focus it with `Tab` and press `Enter` or `Space`. The other sections keep their current state, and the heading continues to show the total number of items while collapsed.

A list with more than twenty rows initially shows the first twenty. **Load more** includes the number of hidden rows, such as **Load more (14)**, and reveals all of them with one click.

The count beside a heading is always the **total**. It does not change when you fold the section or when rows are still behind **Load more**.

Callout Studio remembers which sections are folded when you close settings or restart Obsidian. The **Load more** state resets when you leave the tab, but remains in place while the tab is open, even if a theme change or incoming sync refreshes the settings page.

## The heading stays with you while you scroll

When you scroll through a long list, its heading stays at the top of the settings pane. In **My callout types**, this also keeps **Add new callout** within reach. The next section replaces the pinned heading when it reaches the top, and the final heading scrolls away after the built-in list ends.

The pinned heading uses the background of your theme's settings pane. If that pane uses a window-wide gradient or is partly transparent, the heading falls back to the theme's window color so rows do not show through it. Themes that intentionally make every surface transparent keep the heading transparent as well.

Folding a section while its heading is parked at the top leaves the heading under your pointer instead of letting the page jump.

The note naming your active theme scrolls with the rows under **Callouts from your theme**; it is not part of the pinned heading.

The heading stays flush with the top of the pane, including in themes such as ITS Theme that add their own settings-page padding.

On iPhone, headings scroll normally to avoid Obsidian's back and close buttons. They remain pinned on iPad and desktop.

## Callouts from your theme

Two kinds of callout end up here, and the section says so:

**Callout types created by your theme.** Some themes do more than restyle `note` and `warning`; they add new types. ITS Theme, for example, adds `recite`, `infobox`, `cards`, `timeline`, and others. These types appear automatically while the theme is active and are available in autocomplete and Quick Insert. The theme continues to draw them.

Theme types are listed but not saved. They are not written to settings, backups, or exports, and **Reset everything** does not affect them. Switching to a theme that does not provide those types removes them from the list without changing your notes. Switching back restores the list.

Each device lists the types provided by its own active theme. Because theme-only types are not saved, devices with different themes do not create sync conflicts over them.

**Saving a theme type.** Press **Scan for callouts** if you want to keep a theme type after changing themes or use your own colors on a device without that theme. The saved type then syncs, appears in backups, and keeps its saved appearance when the theme no longer controls it.

**Built-in callouts restyled by your theme.** If a theme restyles `[!note]`, `note` appears here instead of under **Built-in callouts**. The built-in section is empty when a theme restyles all thirteen types.

Each row shows the icon and colors from a callout actually drawn by your theme, rather than any unused values stored in Callout Studio.

### What you can do with one

A theme row has the same two controls as every other row.

**The pencil** opens a read-only preview of the theme's design. It does not offer editing controls because Callout Studio does not override the theme.

**The ⋯ menu** contains actions that affect uses in your vault:

- how much your vault uses it
- **Replace in vault:** replace every use with another callout type.
- **Clear uses in your notes:** turn `[!type]` blocks into plain paragraphs. The theme continues to provide the type, and its files are not changed.

Theme rows do not include **Customize**, a color picker, a **Default fallback** label, or a use count beside the name because those controls would not change the theme's design.

### If you want a theme callout to look different

Create a new callout with a **different ID**. If your theme supplies `recite`, you could create `my-recite`, style it yourself, and use **Replace in vault** to update existing notes.

Callout Studio prevents you from creating a callout with an ID already supplied by the theme and explains the conflict before you fill in the form.

### Block callouts only

A callout your theme supplies has **one** format: the ordinary block callout, `> [!recite]`, drawn in your theme's own style.

Heading Callouts (`## [!recite] Title`) and Inline Callouts (`word [!recite] word`) are Callout Studio formats, so they are **not** available for theme-only types. If you write them anyway, they remain plain text. Rendering them would require Callout Studio to invent heading and inline styles that might not match the theme's block style.

The `[!` popup therefore skips theme types for heading and inline callouts, and the command builder offers only **Block**. If a theme takes over a type used by an existing heading or inline command, Callout Studio pauses the command instead of deleting it. The command disappears from the palette, shows as paused in **Manage commands**, and returns with its shortcut intact when the theme stops supplying that type.

Callouts of your own keep all three formats, of course.

## Styling a callout with your own CSS

For any type under **My callout types** or **Built-in callouts**, choose **Style with my own CSS** from the ⋯ menu to let your CSS snippet control its appearance. Callout Studio then stops generating styles for that type.

The row stays in place with an **External CSS** label. Choose **Let Callout Studio style this again** to restore its saved icon and colors.

## Switching themes

When you switch themes, the lists and active styles update without deleting saved callout data.

There are three different things in that top section, and they behave differently when the theme goes away.

**A theme type you never saved** is listed only while that theme is active. Switching themes removes it from the list but leaves your notes untouched. A theme change never adds or removes saved definitions.

**A type your theme invented that you kept with Scan for callouts** stays saved when you switch themes. It moves to the appropriate list and uses its saved fallback appearance when the new theme does not own it. Your notes remain unchanged.

**A callout that was already yours** is temporarily controlled by the theme when both use the same ID. Switch away and it returns to **My callout types** with its saved name, colors, icon, and aliases, and its Heading and Inline formats work again. Built-ins behave the same way. Saved customizations remain available while a theme's version is active and return when the theme stops controlling the type.

Switching directly between themes applies these changes in one pass. A type defined by both themes stays in the theme list.

## Different themes on different devices

Each device lists the callouts supplied by its own active theme. A theme-only
`X` on device A is not automatically listed on device B without that theme.
Notes using `X` still sync normally; on B they use the fallback appearance until
you scan for callouts or create/import a saved definition for `X`.

Once saved, edits to `X` sync to both devices. If B changes its colour or icon,
A stores those changes too, but A's theme still controls the appearance. Switch
A to a theme that does not own `X` and the saved design takes effect. If both
devices have different themes defining `X`, each theme controls its local look.

Theme changes during a settings sync use the latest local theme when the incoming
settings are adopted. Changing themes does not copy a theme's colours into the
shared settings. Reset removes the saved customizations on all synced devices,
while callouts supplied by each device's current theme remain listed.

## If you already had one of your theme's callouts

Say you made a `recite` callout yourself, before you knew ITS Theme had one. It now appears under **Callouts from your theme**, because that is the truth: the theme is drawing it.

Your saved name, aliases, and colors remain in settings and backups, and the type appears only once.

## Why it works this way

The details below explain why Callout Studio gives complete control to one stylesheet at a time.

Callout Studio's CSS loads after the theme, so it wins when both stylesheets use selectors of equal strength. A more specific selector still wins regardless of load order, and callout-heavy themes often use highly specific selectors.

When both stylesheets compete, some colors and icons may apply while others do not. Giving one side full control avoids this inconsistent result.

Callout Studio therefore controls all supported properties for the callouts it owns and none of the properties for callouts owned by your theme.

Two limits apply. Callout Studio controls only the properties it sets; it does not undo extra layout added by your theme. Also, colors shown for theme callouts are read from the current light or dark mode and update when the mode changes.

## Themes written for an older Obsidian

Obsidian changed the way callout colors are defined in version 1.13. Updated themes use the new format, while some themes still use the old one. The formats are not interchangeable: using the wrong format can make a background or colored border disappear without showing an error.

Callout Studio detects the format expected by your theme and checks again whenever you switch themes. No setting is required.

What you should see:

- A callout you made uses the theme's callout design, including its background treatment, side accents, and title bar, in the color you chose.
- Changing a callout option in **Style Settings** takes effect on your callouts immediately, the same as it does on your theme's own callouts. No restart, no reopening the note.
- If your theme deliberately paints callout backgrounds itself, it keeps doing that. Callout Studio only fills in a background where nothing else is providing one.

Colors from **Saved color palettes** include a background chosen by you, so that background overrides the theme. A preset supplies only a color; the theme's background design still applies where available. Save a palette if you want a callout to keep a specific background across themes.

Light and dark mode are evaluated separately because some themes define callout colors for only one mode. A built-in callout uses the theme's color where one is defined and Obsidian's color in the other mode.

Callout Studio cannot work around three cases:

1. A theme mixes both color formats in one stylesheet. The less-used format may fail, and the theme must correct it.
2. A type appears in your notes but has never been added to Callout Studio. It receives the theme's design but has no background of its own until you add it.
3. A theme places callout colors behind one of its **Style Settings** options. Callout Studio cannot tell from the stylesheet whether that option is enabled, so built-in types use Obsidian's colors instead. In a survey of 257 themes, this affected Aura's **Origin** layout and TerraFlow's **Academia** palette. Your own types still use the colors you chose.

## Themes that give callouts no background

Some themes intentionally draw callouts without a background fill, using color only in the icon, title, border, or frame. **GitHub Theme** does this when **GitHub callout style** is enabled; **Minimal** and **Oxygen** use the same approach under **Outlined callouts**. **Prism**, **Cybertron**, and several other themes also support it.

Callout Studio follows. On those themes a callout you made drops its background and sits flat like the theme's own, while keeping the things that make it yours: your icon, and your colour on the icon, the title, and any frame the theme draws.

Three details worth knowing:

- **It follows the theme's setting.** Turn **GitHub callout style** or **Outlined callouts** on to remove the fill, and turn it off to restore the background. The change is immediate.
- **A background you chose is set aside, not forgotten.** If your callout came from a Saved palette with a background or a gradient, that background is what gets stood down. Switch to a theme that fills callouts, or switch the theme's option off, and it returns exactly as you saved it. Nothing is rewritten.
- **Default text color comes from the theme.** Callout Studio shows a readable default in the editor, but background-free themes use their own text color. A text color you chose yourself is preserved.

Themes that normally fill callout backgrounds are unaffected. This was true for 240 of the 257 themes surveyed.

## Writing a theme yourself?

Theme authors can find supported CSS patterns, discovery limitations, and testing steps in [Theme callout discovery](../internals-docs/17-theme-callout-discovery.md#for-theme-authors).

---
**Next:** [Resetting callouts and settings](13-resetting-callouts-and-settings.md)
