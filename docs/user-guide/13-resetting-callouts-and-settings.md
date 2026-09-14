# Resetting callouts and settings

When older settings contain callout definitions with overlapping aliases,
Callout Studio combines the connected definitions during startup. The surviving
type keeps the accepted names, fallback selections, and custom commands.

Callout Studio offers three levels of reset. Choose the smallest one that covers what you want to undo, so you keep the rest of your work.

## Three levels, three scopes

From smallest to largest:

1. **One field, while editing:** undo an unsaved change to an icon or color.
2. **One built-in callout type:** restore one of Obsidian's 13 built-in types to its default appearance.
3. **Everything:** return all callout types and style settings to their factory state.

The rest of this chapter walks through each one.

## Level 1: undo a field inside the callout editor

While you're editing a callout type, you'll notice small revert buttons next to the icon field and next to the color field. These are the narrowest kind of undo Callout Studio offers.

- Clicking the revert button next to the icon field discards only your unsaved change to the icon, putting it back to whatever was last saved for that callout type.
- Clicking the revert button next to the color field does the same for color.

Each button affects only its own field in the current editing session. It does not change other fields or write to the vault. Closing the editor without saving also discards all unsaved changes.

## Level 2: reset one built-in callout type

After you change the color or icon of one of the 13 built-in callout types, its **⋯** menu shows **Reset to default**.

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

Use **Reset everything** only when you want a clean start. It cannot be limited to part of your setup, so use one of the smaller reset options when possible.

## If your callout types disappear

The previous sections cover intentional resets. This section explains what to do when callout types disappear unexpectedly.

Callout Studio keeps your callout types in one settings file inside the vault. During sync, that file may briefly be missing or only partly written. This is most noticeable on phones, which often open a vault before sync has finished.

When Callout Studio starts and finds its settings file missing or unreadable, it does **not** treat that as an empty setup. It shows a notice, leaves the file completely alone, and stops writing. A valid local recovery copy may keep your callout types visible while saving is disabled. If no readable copy is available, the list may show only defaults; that is not permission to overwrite the unavailable file.

**What to do:** let sync finish. Callout Studio waits briefly for incoming settings to stop changing before loading them, and retries when desktop files change or you return to the app. Once a readable file is available, your callout types reappear and saving resumes. If sync takes longer than the automatic retries, return to the app or reload Obsidian after it finishes.

If you deleted the settings file intentionally, use **Open Callout Studio settings** in the startup notice. It opens the saving-status banner below the **Callout Studio** heading. Choose **Create a new settings file** to resume saving after confirmation, or **Retry saving and recovery** if the file may still return. The banner remains until the session can save again. Before creating a file, Callout Studio checks once more for incoming settings and backs up any readable local recovery copy. Create a new file only when you know the old one will not return, because Callout Studio will save its current state, including any types restored from local recovery.

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
write. It's headed **Saving is paused** while the session is not saving at all,
and **Settings were not saved** when a single save failed; its actions sit
together below the message, and stack to full width on a phone.
**Retry saving and recovery** checks again without restarting Obsidian. If the settings file is damaged, a
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
2. **Copy your settings file somewhere safe** from `.obsidian/plugins/callout-studio/data.json`. Even when its callout types are gone, it may still contain saved icon artwork and color palettes. Saving a callout can overwrite that remaining data.
3. **Look for an exported backup.** If you ever used **Settings → Import / export**, you may have `callout-studio-export.json` in your Downloads folder, or a `callout-studio-custom.css` in your vault's `.obsidian/snippets/` folder. Either one restores a great deal.
4. **Check your sync tool's file history.** Obsidian Sync keeps version history, and Syncthing keeps replaced files in a `.stversions` folder. A settings file from before the loss can be restored from there.
5. **If you came from Callout Manager or Admonition** and haven't deleted their folders, **Settings → Import / export → Import** still reads them directly, even with those plugins disabled.

---
**Next:** [Icons in depth](14-icons-in-depth.md)
