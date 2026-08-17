# Using Callout Studio with your theme

Many Obsidian themes come with their own callout styling built in, and Callout Studio's styling normally takes priority over it. When a theme styles callouts assertively enough to win anyway, Callout Studio tells you which ones - and gives you two ways to settle it: override the theme, or hand the callout to it.

## Why Callout Studio usually wins - and when it doesn't

Some Obsidian themes - ITS, Border, AnuPpuccin, and others - ship elaborate callout styling of their own. Callout Studio's CSS is applied last, so wherever the two write rules of equal strength, Callout Studio's wins. This is why your callouts look the same across themes unless you decide otherwise.

That isn't the whole story, and it's worth knowing why. Load order only breaks ties - a rule written more specifically wins outright, whatever the order. Themes built around callouts tend to write very specifically indeed: measured against ITS Theme, 63% of its callout rules are stronger than the ones Callout Studio emits by default.

So with such a theme the usual result is neither side winning cleanly, but a split: some of your colors and icons apply and some don't. That reads as the plugin being broken, when it's really two stylesheets disagreeing.

## The Theme coexistence report

**Settings → Callout Studio** shows a **Theme coexistence** section whenever your theme has opinions about callouts you also style. It lists each one, names the properties the theme sets, and marks with **Theme wins** the ones where the theme is beating Callout Studio. If your theme leaves callouts alone, the section doesn't appear at all.

It also tells you when a property is marked `!important` by the theme, since that's the one case no amount of overriding can reach.

## Override the theme

To make Callout Studio win a callout your theme is currently taking:

1. Find the callout in your callout list.
2. Open its **⋯** menu.
3. Choose **Override the theme**.

The row is tagged **Overriding theme** from then on. This raises the strength of Callout Studio's rules for that one callout until they outrank what a theme realistically writes, so the colors, background and icon you picked apply.

Two limits are worth stating plainly. It wins the properties Callout Studio actually sets - it does not undo *layout* a theme adds, so a theme that turns a callout into a card grid keeps its grid. And it cannot beat a property the theme marked `!important`; the report tells you when that's the case rather than letting you find out by trying.

## Turning it off for one callout

If you'd rather go the other way and let your theme (or your own CSS) decide how a particular callout looks, External style hands that control over completely, one callout type at a time:

1. Find the callout in your callout list - this works for both built-in and custom callouts.
2. Open its **⋯** menu.
3. Choose **Use external style (theme or CSS)**.

From that point on, Callout Studio emits no CSS and no extra markup for that callout. That means no colors, no background, no icon, no border, no radius, and no text size coming from the global style - and no icon repainting either. Your theme, your own CSS snippet, or plain Obsidian's default styling decides how it looks instead.

## Two things worth knowing

**Heading Callout and Inline Callout stop rendering for that type.** Those two forms are entirely Callout Studio's own invented syntax, and there's no theme styling for them to fall back to. Once a callout is set to external style, its Heading Callout and Inline Callout forms no longer render - the raw `[!type]` text just stays as written on the page. The regular Block Callout form is unaffected, since that's the standard Obsidian callout your theme already knows how to style.

**The row stays in your list, clearly marked.** A callout set to external style doesn't disappear from your settings - it stays visible, tagged **External style**, with its icon and color swatches hidden, since they no longer describe anything you'd actually see. Opening it for editing shows a window explaining the situation, along with a live preview of how your theme actually renders it, and a single button to take control back whenever you want Callout Studio to style it again.

## One restriction

The default fallback callout can't be switched to External style. If you want to use external styling on what is currently your fallback, pick a different callout as your fallback first, then switch the old one.

---
**Next:** [Resetting callouts and settings](13-resetting-callouts-and-settings.md)
