# Resetting callouts and settings

Sooner or later you'll want to undo something - a color you didn't mean to change, an icon that isn't working out, or a whole setup you want to start over. Callout Studio actually gives you three separate "undo" tools, each covering a different amount of ground, and picking the right one matters: reach for too big a reset and you'll lose work you meant to keep.

## Three levels, three scopes

Think of it as a ladder, from smallest to biggest:

1. **One field, while editing** - undo a single change you just made, before you've even saved it.
2. **One built-in callout type** - undo your customization of one of the 13 built-in callout types, restoring it to how Callout Studio ships it.
3. **Everything** - wipe the plugin back to its factory state: every callout type, every style setting, all in one action.

The rest of this chapter walks through each one.

## Level 1: undo a field inside the callout editor

While you're editing a callout type, you'll notice small revert buttons next to the icon field and next to the color field. These are the narrowest kind of undo Callout Studio offers.

- Clicking the revert button next to the icon field discards only your unsaved change to the icon, putting it back to whatever was last saved for that callout type.
- Clicking the revert button next to the color field does the same for color.

Each button only affects its own field, in your current editing session. It doesn't touch any other field, it doesn't touch the rest of the callout type, and it doesn't write anything to your vault. If you close the editor without saving, none of your unsaved changes take effect anyway - these buttons are simply a quick way to back out of one field while you're still deciding.

## Level 2: reset one built-in callout type

Callout Studio ships with 13 built-in callout types. As soon as you customize one of them - changing its color or icon away from the factory default - its **⋯** menu gains a new action: **Reset to default**.

Choosing **Reset to default** restores that one built-in callout type's look to exactly what Callout Studio ships by default, discarding whatever color or icon changes you made to it. Nothing else is affected: your other callout types, whether built-in or your own, are left exactly as they are.

Note that this action only shows up once a built-in callout type has actually been changed. An untouched built-in has nothing to reset, so you won't see the option on it.

## Level 3: reset everything

For a genuinely clean slate, open **Settings → Import / export** and use **Reset everything**.

This single action returns the whole plugin to its factory state in one step:

- Every callout type you created yourself is removed.
- Every built-in callout type is restored to its default look.
- The global style settings covered earlier in this guide are reset.
- Cached icon artwork is cleared.

Because this affects the entire plugin at once, use it only when you genuinely want to start fresh - not when you only meant to undo one field or one callout type. If you're unsure which level you need, it's worth pausing: **Reset everything** cannot be limited to part of your setup, so it's the one to reach for last, not first.

## If your callout types disappear

Everything above is a reset you asked for. This section is about the one you didn't.

Callout Studio keeps your callout types in a single settings file inside your vault. If you sync your vault, that file travels like any other - and a sync client can be caught mid-delivery, with the file briefly missing or only half-written. A phone is the most common place to notice, because it often opens a vault while the sync is still catching up.

When Callout Studio starts and finds its settings file missing or unreadable, it does **not** treat that as an empty setup. It shows a notice, leaves the file completely alone, and stops writing. Your callout types will be missing from the list while that notice is up, but the file on disk still has them.

**What to do:** let the sync finish. Callout Studio keeps watching for the file, and picks it up on its own the moment it lands — on desktop as soon as it changes, on mobile the next time you come back to the app. Your callout types reappear and saving starts working again, so anything you change from then on is kept. Reloading Obsidian also works and is never wrong, but it is usually not needed.

The one case where the file really is gone for good is when you deleted it yourself to start over. For that, the notice offers **Start fresh on this device**, which lets Callout Studio save again from that point on. Only use it if you know the file isn't coming back - once Callout Studio starts writing, it writes what it currently has, which is the built-in callout types and nothing else.

### If your callout types were already lost

If a sync has already replaced your settings with the defaults, stop and check these before changing anything, in this order.

1. **Don't open Obsidian on your other devices yet.** The most complete copy of your setup lives on a device that hasn't loaded the plugin since the loss.
2. **Copy your settings file somewhere safe** from `.obsidian/plugins/callout-studio/data.json`. Even when the callout types are gone from it, it can still hold your saved icon artwork and color palettes - and that goes away the moment you save any callout type.
3. **Look for an exported backup.** If you ever used **Settings → Import / export**, you may have `callout-studio-export.json` in your Downloads folder, or a `callout-studio-custom.css` in your vault's `.obsidian/snippets/` folder. Either one restores a great deal.
4. **Check your sync tool's file history.** Obsidian Sync keeps version history, and Syncthing keeps replaced files in a `.stversions` folder. A settings file from before the loss can be restored from there.
5. **If you came from Callout Manager or Admonition** and haven't deleted their folders, **Settings → Import / export → Import** still reads them directly, even with those plugins disabled.

---
**Next:** [Icons in depth](14-icons-in-depth.md)
