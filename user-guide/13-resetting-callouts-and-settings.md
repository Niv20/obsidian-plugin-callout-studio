# Resetting callouts and settings

When older settings contain several callout definitions connected by overlapping
aliases, startup consolidates the entire group in one load. The surviving type
keeps the accepted names, and fallback selections and custom commands follow it.

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

Callouts supplied by your active theme remain listed, including ones you had
previously scanned, imported or edited on another device. Reset removes their
saved customization and keeps only the local theme entry. On another device
without that theme, the saved entry disappears after sync; notes stay untouched.

Because this affects the entire plugin at once, use it only when you genuinely want to start fresh - not when you only meant to undo one field or one callout type. If you're unsure which level you need, it's worth pausing: **Reset everything** cannot be limited to part of your setup, so it's the one to reach for last, not first.

## If your callout types disappear

Everything above is a reset you asked for. This section is about the one you didn't.

Callout Studio keeps your callout types in a single settings file inside your vault. If you sync your vault, that file travels like any other - and a sync client can be caught mid-delivery, with the file briefly missing or only half-written. A phone is the most common place to notice, because it often opens a vault while the sync is still catching up.

When Callout Studio starts and finds its settings file missing or unreadable, it does **not** treat that as an empty setup. It shows a notice, leaves the file completely alone, and stops writing. A valid local recovery copy may keep your callout types visible while saving is disabled. If no readable copy is available, the list may show only defaults; that is not permission to overwrite the unavailable file.

**What to do:** let the sync finish. Callout Studio briefly checks that incoming settings have stopped changing before loading them. Desktop file changes and returning to the app also trigger a few automatic retries if the file is temporarily missing or unreadable. Your callout types reappear and saving starts working again after a readable file is loaded. If synchronization takes longer than those retries, return to the app again or reload Obsidian after it finishes.

The one case where the file really is gone for good is when you deleted it yourself to start over. For that, the notice offers **Create a new settings file**, which lets Callout Studio save again after confirmation. The same action remains available in the saving-status banner at the top of Callout Studio settings, even after the startup notice is dismissed. A new-file action rechecks for settings that arrived while the confirmation was open and preserves a readable local recovery copy in a backup before replacing it. Only use it if you know the file isn't coming back - once Callout Studio starts writing, it writes what it currently has, including any callout types restored from the local recovery copy.

## Editing on more than one device

Use the same updated Callout Studio build on both devices. Changes to different
callouts or different fields of the same callout merge automatically when the
plugin receives the other device's settings. Additions to palettes, images and
custom commands also merge. If both devices change the same field, a consistent
logical ordering chooses one value and the replaced version is kept in the
`backups` folder. This ordering does not depend on the devices' clock settings.
Deleting a callout wins over a concurrent edit to that callout; a later explicit
recreation is allowed. Older delivered settings do not undo a recorded deletion.

Incoming changes wait while an editor or preview is open. If Save reports that
settings changed elsewhere, use **Retry saving and recovery** in the editor.
Incoming settings are checked and merged while your form stays open and unchanged.
Review your draft and save again. Background sync continues to wait while an editor
is open. If unfinished note updates need a definition that conflicts with the incoming
settings, recovery keeps both the draft and pending work rather than applying unsafe
changes. Wait for a successful save before quitting Obsidian.

The plugin also keeps a recovery copy in the app's local storage, separate from
the synced vault. If sync replaces `data.json` while the plugin is closed, the next
launch merges that copy with the incoming file. An unreadable recovery store
stops saving until it is available again. The banner distinguishes that problem
from an unreadable settings file, a failed recovery write, and a failed settings
write. It is headed **Saving is paused** while the session is not saving at all,
and **Settings were not saved** when a single save failed; its actions sit
together below the message, and stack to full width on a phone.
**Retry saving and recovery** checks again without restarting Obsidian. If the settings file is damaged, an
available recovery copy is displayed read-only and the damaged file is preserved.
Saving errors are shown in English and identify the failed step. A full drive,
denied write access, unavailable local recovery storage, and an incoming sync change
have different messages. Technical file paths stay in the developer console, and
one failed save produces one error notification. A recovery operation that stops
responding times out so it can be retried.

If the definition was saved but updating existing notes failed, the message says so.
Keep the editor open and choose **Save** again to resume the unfinished note updates.

After fixing the storage problem, use **Retry saving and recovery**, return to the app, or reload the plugin. Recovery data that could not be read is never silently discarded.

Recognized `data.sync-conflict-...json` and `data (Conflicted copy ...).json` files
in the plugin folder are checked at startup and during external/foreground checks.
Intact copies that carry synchronization metadata are merged even if the main
settings file is unchanged. Conflict files are not deleted. Unversioned, malformed
or unrecognized copies stay untouched for manual recovery. An incoming JSON file
whose data and revision metadata do not match is also preserved without adoption.

These protections cannot recover data removed from every copy or bypass a sync
service's exclusions, offline devices or file-size limits. Both devices must receive
the relevant files and run the updated build. Lists such as aliases are resolved as
one field, and an icon's pack and value stay together. This feature merges plugin
settings, not note text. The automatic vault backups keep the latest five copies;
they complement the device-local recovery copy and your sync service's history.

## If your callout types were already lost

If a sync has already replaced your settings with the defaults, stop and check these before changing anything, in this order.

1. **Don't open Obsidian on your other devices yet.** The most complete copy of your setup lives on a device that hasn't loaded the plugin since the loss.
2. **Copy your settings file somewhere safe** from `.obsidian/plugins/callout-studio/data.json`. Even when the callout types are gone from it, it can still hold your saved icon artwork and color palettes - and that goes away the moment you save any callout type.
3. **Look for an exported backup.** If you ever used **Settings → Import / export**, you may have `callout-studio-export.json` in your Downloads folder, or a `callout-studio-custom.css` in your vault's `.obsidian/snippets/` folder. Either one restores a great deal.
4. **Check your sync tool's file history.** Obsidian Sync keeps version history, and Syncthing keeps replaced files in a `.stversions` folder. A settings file from before the loss can be restored from there.
5. **If you came from Callout Manager or Admonition** and haven't deleted their folders, **Settings → Import / export → Import** still reads them directly, even with those plugins disabled.

---
**Next:** [Icons in depth](14-icons-in-depth.md)
