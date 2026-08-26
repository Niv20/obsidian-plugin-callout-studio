# Using Callout Studio with your theme

One rule decides everything on this page, and it has no settings:

> **If your theme styles a callout, your theme keeps it.** Callout Studio will not override it, partly override it, or flash its own design before your theme wins.

You never have to look up who draws a callout, because it is the list the callout is in:

- **Callouts from your theme** — your theme draws these. Read-only here.
- **My callout types** — the ones you made. Callout Studio draws them.
- **Built-in callouts** — Obsidian's thirteen, minus any your theme restyles.

There is nothing to set. Change your theme and the lists rearrange themselves.

## Getting a long list out of the way

Each of the three headings folds its own list. Click the heading — or reach it with `Tab` and press `Enter` or `Space` — and the chevron turns and the rows tuck away. The other two sections stay exactly as you left them, and the count in the heading stays on screen while the section is folded, so you can still see how many are in there.

A list longer than twenty rows shows the first twenty and a **Load more** button that says how many are waiting: **Load more (14)**. One click brings the rest in and the button goes away — there is no second page. Nothing is faded or dimmed; every row you can see is a row you can use.

The count beside a heading is always the **total**. It does not change when you fold the section or when rows are still behind **Load more**.

Both are for the current visit. Close the settings tab and every section is open and complete again the next time you come back.

## Callouts from your theme

Two kinds of callout end up here, and the section says so:

**Callout types your theme invents.** Some themes don't only repaint `note` and `warning` — they add types of their own, with names Obsidian has never heard of. ITS Theme adds `recite`, `infobox`, `cards`, `timeline` and a dozen more. Those used to be invisible: you had to know the name and type it from memory. Now they get their own section, and they turn up in autocomplete and Quick insert like anything else.

**Built-in callouts your theme replaces.** If your theme restyles `[!note]`, then your theme is what you see, so `note` is listed here rather than under **Built-in callouts**. On a theme that restyles all thirteen — and a fair number do — the built-in section will be empty and say so.

Each row shows your theme's **real icon and colours**, read back from a callout your theme has actually drawn. Not the ones stored in Callout Studio; those describe a design you would never see.

### What you can do with one

A theme row has the same two controls as every other row.

**The pencil** opens a preview rather than an editor. It shows how your theme draws the callout and says plainly that Callout Studio won't override it. It changes nothing — there is no control in it, because there is nothing a control could change.

**The ⋯ menu** has only things that actually work, and they are all about your vault rather than about the design:

- how much your vault uses it
- **Replace in vault** — swap every use for another callout type
- **Clear uses in your notes** — turn those `[!type]` blocks into plain paragraphs. It is not called *Delete*, because nothing is deleted: your theme keeps supplying the type, and none of your theme's files are touched.

There is no *Customize* and no colour picker. The row itself is deliberately plain too — no *Default fallback* label, no use count beside the name — because both of those describe a callout you cannot act on.

### If you want a theme callout to look different

Make a new callout with a **different ID**. That is the honest answer: while your theme supplies `recite`, `recite` is your theme's. Create `my-recite`, style it however you like, and use **Replace in vault** if you want your existing notes to switch over.

Callout Studio will stop you creating a callout whose ID your theme already supplies, and tell you why — otherwise you would fill in a whole form and find the result read-only.

### Block callouts only

A callout your theme supplies has **one** format: the ordinary block callout, `> [!recite]`, drawn in your theme's own style.

Heading Callouts (`## [!recite] Title`) and Inline Callouts (`word [!recite] word`) are Callout Studio's own formats, and they are **not** available for a theme's callout types. Written anyway, they stay as plain text rather than rendering. Your theme has no design for them and no way to follow one, so drawing them would mean showing you two versions Callout Studio invented next to a third your theme drew — three looks for one callout.

For the same reason they are not offered where you would reach for them: the `[!` popup skips theme callouts when you are typing a heading or an inline one, and the command builder offers only **Block** for them. A heading or inline command you built earlier, on a callout your theme has since taken over, is **paused** rather than deleted — it leaves the command palette, says so in *Manage commands*, and comes back with your keyboard shortcut intact as soon as your theme stops supplying that callout.

Callouts of your own keep all three formats, of course.

## Styling a callout with your own CSS

Separate from all of the above, and still yours to decide: any callout in **My callout types** or **Built-in callouts** has **Style with my own CSS** in its ⋯ menu. Callout Studio then emits nothing for it and your snippet decides.

The row stays where it is and wears an **External CSS** label, so you can tell at a glance why it has no icon or colours here. Choose **Let Callout Studio style this again** to take it back — nothing you saved was thrown away, and it all comes straight back.

## Switching themes

Everything recalculates, and nothing of *yours* is lost, because none of it is stored.

There are two different things in that top section, and they behave differently when the theme goes away.

**A callout type your theme invented** — `recite`, `infobox`, whatever your theme added — belongs to that theme. Switch away and it is removed from Callout Studio completely: the row goes, and the callout stops being offered anywhere. **Your notes are not touched.** Any `> [!recite]` you already wrote is still there, word for word; it simply renders as an ordinary callout again, because nothing is styling it. Nor is the row quietly re-created from those notes — Callout Studio remembers that the type left with the theme. If you want to keep it, create a callout with that ID yourself and it is yours from then on. (**Re-scan vault**, in *Vault insights & maintenance*, also brings it back as an ordinary discovered row — that scan is you asking, so nothing is held back from it.)

**A callout that was already yours** is only *borrowed* while the theme claims the same ID. Switch away and it returns to **My callout types** exactly as it was: same name, colours, icon, aliases, everything — and its Heading and Inline formats work again. Built-ins behave the same way: ones your new theme leaves alone return to **Built-in callouts** wearing whatever you had saved on them. If you customised `[!note]` years ago and then switched to a theme that restyles it, your colours were kept the whole time, unused, and reappear the moment you switch away again.

Switching straight from one theme to another does all of this in one pass — including the case where both themes define the same ID, which simply stays where it is.

## If you already had one of your theme's callouts

Say you made a `recite` callout yourself, before you knew ITS Theme had one. It now appears under **Callouts from your theme**, because that is the truth: the theme is drawing it.

Nothing about it changed. It is still your row, with your name, aliases and colours saved on it, it still appears in your backups, and it appears exactly once.

## Why it works this way

Worth knowing if you have ever seen a callout come out half-right.

Callout Studio's CSS is applied after your theme's, so where the two write rules of equal strength, Callout Studio's wins. But that only settles ties — a rule written more *specifically* wins outright whatever the order, and themes built around callouts write very specifically indeed.

The old result was neither side winning cleanly, but a split: some colours and icons applied and some didn't. That reads as the plugin being broken, when it is really two stylesheets disagreeing. An in-between setting cannot fix it, because winning *some* properties **is** the failure.

So there is no in-between. For the callouts it does own, Callout Studio takes every property outright, and measures how hard it has to push from the theme you actually have on. For the callouts your theme owns, it takes nothing at all.

Two limits worth stating plainly. It wins the properties Callout Studio actually sets — it does not undo *layout* your theme adds, which is part of why a theme that names a callout keeps it entirely. And the colours shown for a theme callout are read from your **current** light/dark mode; switching mode re-reads them.

## Writing a theme yourself?

There is a compatibility guide for theme authors in the developer docs — which CSS patterns Callout Studio reads correctly, which ones hide your callouts from it, and how to check your theme against it: [Theme callout discovery](../internals-docs/21-theme-callout-discovery.md#for-theme-authors).

---
**Next:** [Resetting callouts and settings](13-resetting-callouts-and-settings.md)
