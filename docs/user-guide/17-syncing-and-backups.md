# Syncing & backups

Callout Studio stores its setup in Obsidian's plugin settings. A synced vault can move those settings between devices, but only if the sync service includes the vault's configuration folder and keeps the files available to Obsidian.

## Export a complete backup

Choose the Callout Studio backup format to save your full setup as JSON, including callout definitions, saved color palettes, and plugin settings. This is the recommended portable backup for restoring a setup through **Import** or transferring it to another vault where the plugin is installed.

The export captures the setup currently displayed, even when settings saving is paused. Keep it somewhere separate from the plugin folder. Its format differs from the plugin's internal `data.json`: do not rename an export to `data.json`.

When importing a Callout Studio backup, matching entries are updated and valid saved palettes are merged into the destination setup without overwriting unrelated palettes. [Import a Callout Studio backup](10-import-export-and-sharing.md#import-a-callout-studio-backup) explains what the confirmation shows.

**Import**, **Reset everything** and deleting a custom callout are unavailable while saving is paused; resolve the saving problem first.

## Restore an earlier setup

Open **Settings → Callout Studio**, and under **Earlier setups** choose **Restore an earlier setup**. The window lists every earlier version of your setup that Callout Studio can find. **Saved on this device**, **Backups**, and **Other copies of the settings file** can each be collapsed or expanded; available groups start expanded. The groups differ in where and why the copies are saved:

| Group | When a copy is saved | Where it lives | What happens on another device or after uninstalling |
| --- | --- | --- | --- |
| **Saved on this device** | When this device successfully saves settings or accepts settings from the vault, including settings received through sync. | Obsidian's app storage on this device, outside the vault. | It does not sync. It can survive plugin removal, but clearing app data or the operating system removing app storage can erase it. |
| **Backups** | Before an operation could replace or lose the current setup, as described under [Automatic backups](#automatic-backups). | The plugin's `backups` folder inside the vault. | It can sync with the plugin folder, so this group can include backups from other devices. Removing the plugin folder removes these copies too. |
| **Other copies of the settings file** | When a sync service leaves an extra file, such as `data 2.json` or a conflicted copy. | Next to the plugin's settings file. | The sync service controls how these files move between devices. Callout Studio does not automatically delete them. |

**Saved on this device** can contain a setup that originally arrived from another device: the label says where this history is kept, not where every setting was first edited. These versions and the files under **Backups** can overlap because the same setup can be protected in both places.

Each entry shows how many callout types and setting groups differ from your current setup. **Restore** asks first, saves a backup of your current setup, then makes the earlier version your setup on every synced device. Changes made on another device that this device hadn't received yet are kept. Restoring is unavailable while saving is paused. This window offers inspection, deletion and restoration; to export the setup currently displayed, use **Export → Callout Studio backup** in settings.

Select the trash button, **Delete**, to permanently remove one entry after a warning confirmation — the saved copy itself, not your current setup, and not any other entry. This cannot be undone. Unlike **Restore**, deleting works on an entry that can't be read as settings and while saving is paused, because it never touches your settings file.

### View a version before restoring it

Select the eye button, **View details**, beside any entry to open **Setup details**. A summary card at the top shows when the version was saved (when known), what it is compared with and how many differences there are; the counts are listed as removed, changed, then added, and changed items are marked in yellow, added in green and removed in red. This is a read-only window: opening it does not restore the version, change your settings, create a backup, or contact a server. It remains available while saving is paused.

The window shows only what would change if you restored the selected version, compared with the setup currently displayed when you open it. It is split into the sections of the settings page, in the same order: **My callout types**, **Built-in callouts**, **Custom Icons** and **Icon picker defaults**, **Default fallback callout**, **Saved color palettes**, the global style options, **Context menu**, **Commands & Hotkeys** and **Language**. Anything saved by a newer version of Callout Studio appears last, under **Other settings**. Only sections with a difference appear.

Each section is a table with four columns: **No.**, **Item**, **Current setup** and **After restoring this version**. Select a section's title to fold the section or open it again. While you scroll through a section, its title and column headings stay pinned at the top of the window.

Every change has its own number, counted on across all sections. A change is one thing you would name, such as a callout type, palette, custom icon or command. It is matched between the two versions by its identifier, so everything that differs about it stays together in one numbered row: its name, a picture of it on each side where one can be drawn, then one line per changed setting with the setting's name in the **Item** column. A callout that would be added shows *Not present in the current setup* on the current side; one that would be removed shows *Removed when this version is restored* on the restored side. Resetting a customized built-in callout to its default is shown as a change, not a deletion.

Values are drawn rather than printed: colors as swatches with their hex codes, icons as the icon with its library and style, gradients as gradients, border choices as a small frame, orders as numbered lists, and switches as **On** or **Off**. Long text shows its beginning and its total length. The window never shows raw saved data.

A change to the global style options appears once, in its own section, with a sample callout drawn in each version's style. It is not repeated on every callout type it affects. A callout type is listed only when its own settings or its stored icon artwork differ. The refresh button compares the same saved version with your latest displayed setup again. A loading message appears if building the comparison takes a moment.

Callout previews show a regular block with sample content in the current light or dark mode, using that side's saved colors, styling, and artwork; the global style section also draws a heading callout and an inline callout. Previews do not recreate an older Obsidian theme or the contents of a note. Artwork missing from a version shows a placeholder; opening a preview does not download it or substitute an image from your current setup.

The comparison uses the setup as the current plugin understands it, including defaults and migrations. The list's difference count tracks callout types and setting groups, while the window numbers each changed item, so the window can show more changes than the list: one setting group, such as the global style, can hold several items. Picker memory, onboarding flags and other internal bookkeeping are not part of the comparison. An unreadable or unsupported version still has **View details**, but shows that a comparison is unavailable and cannot be restored.

Changed values can include your callout names, command settings, and uploaded artwork, so review the comparison before sharing it.

### How much device history is kept?

**Saved on this device** keeps the twenty most recent distinct setups, plus the newest setup from each of the last fourteen days and eight weeks in which a setup was recorded. These groups overlap: they are not twenty plus fourteen plus eight guaranteed separate versions. Days and Monday-to-Sunday weeks are grouped in UTC, and days or weeks without a saved setup do not use a slot. Returning to the same setup refreshes its date instead of adding a duplicate.

History also has an estimated 24 MiB storage budget per vault, configuration folder, and plugin on this device. Older versions can be removed sooner to stay within that budget; the newest version is kept even if it alone exceeds the budget. Large uploaded images or stored icon artwork can reduce the number of older versions retained.

Cleanup happens when another setup is recorded, not on a timer. A version does not expire just because fourteen days or eight weeks have passed, and the newest twenty are retained regardless of age unless the size budget removes older ones. This history is bounded, but recording is best effort: a storage failure can leave fewer versions available.

## Automatic backups

Callout Studio saves a copy of your setup to its `backups` folder before a change that could lose it:

- before settings arriving from another device remove or replace callouts or preferences on this one
- before **Restore these settings** replaces this device's recovery copy
- before restoring an earlier setup
- before **Reset everything**
- before any import

The folder is inside the plugin's folder, usually `.obsidian/plugins/callout-studio/backups/`. Each new copy is checked after it is saved. When a verified copy with identical content already exists, that copy is reused.

After writing and verifying a new backup, each device keeps its own newest ten copies, plus its newest copy from each of the last fourteen days on which it saved one. These groups overlap, and they use recorded UTC days rather than a fourteen-day expiry date. Copies needed together for one recovery operation are also protected. Reusing an existing copy does not run cleanup, and no cleanup runs on a timer.

Copies from other devices are left alone while those devices are still producing backups. When another device's newest backup is more than ninety days older than a new backup from this device, cleanup keeps only that other device's newest copy. A device can still be in use without producing backups, so this is based on backup dates rather than device activity.

There is no single file-count or size limit for the whole folder. It can contain copies from many devices, and some files are never removed automatically:

- Backups written by Callout Studio 2.14 or earlier are listed for recovery but are not pruned by current versions.
- Exact copies of settings files or device recovery copies replaced because they could not be read are named `unreadable-….txt` and `recovery-copy-….txt`. These are preservation files, not ordinary restorable entries in the earlier-setups list.
- Files whose names are not recognized as current automatic backups are left alone.

To bring back a readable backup, use [Restore an earlier setup](#restore-an-earlier-setup). Routine backup copies are thinned automatically, but those exceptions mean the folder is not guaranteed to remain a fixed size.

The folder syncs with the rest of the plugin's settings, and uninstalling the plugin removes it. Keep an exported backup somewhere else as well.

## Recover paused saving

Callout Studio pauses saving when it cannot safely use its settings file. Your displayed setup may still be available from memory or a recovery copy kept on this device. Uninstalling the plugin on a synced device can remove the shared settings file on other devices too. A temporarily unavailable cloud file can look similar, so the plugin does not assume that missing settings should be reset.

While saving is paused, desktop shows **Saving paused** in the status bar, and mobile shows a notice that stays until you dismiss it. Select either to open Callout Studio settings, where a banner explains the cause and offers the way out. While the app is open, Callout Studio also checks for the file again every minute.

While saving is paused, the settings page can't be changed, so nothing you change there is lost when Obsidian closes. You can still look through your callouts, export your current setup, and browse, inspect and delete earlier setups. Resume saving before restoring an earlier setup.

1. If your setup is still displayed, use **Export → Callout Studio backup** to keep a separate JSON copy.
2. Check that the vault is downloaded, the sync service is running, and the device has storage space and permission to write. Let pending synchronization finish, then select **Check again**. This checks for returned settings; it does not create a missing file.
3. Then choose the action the banner offers:
   - **The settings file is missing:** if the displayed setup is the one you want, select **Restore these settings** and review the confirmation. This creates a settings file from that setup and resumes saving after a successful local write. If no previous setup is available, the action says **Create settings file**.
   - **The settings file can't be read:** the banner says why. If the file is still downloading, or this device can't open it, wait for sync and check again. If the file is empty, damaged, has Git merge conflict markers, or was combined from two versions by a sync service, select **Replace settings file**. Callout Studio saves an exact copy of the current file in the backups folder, then writes a readable settings file. If the settings inside the file were intact, they are kept.
   - **This device's recovery copy can't be read:** select **Discard recovery copy**. An exact copy is saved in the backups folder first, and your settings file isn't changed.
   - **The settings file or recovery copy is from a newer version of Callout Studio:** update the plugin on this device. Neither is replaced, even if the settings file is missing or damaged.
4. Once saving resumes, select **Restore an earlier setup** if you want to go back to an earlier version.

These actions work the same on desktop and mobile, including when the problem starts while Obsidian is open, and you don't need to recover from a particular device. Each one checks the file again before writing, and stops if it changed in the meantime. A failed write leaves saving paused so you can retry. A successful local save does not mean cloud synchronization has finished; let it finish before editing the setup on another device.

If changes you made on this device couldn't be saved, and newer settings from another device then replace them, a notice tells you. Your version is saved in the backups folder, and **Restore an earlier setup** lists it.

Don't copy files into the plugin folder by hand to recover. Other devices merge their newer settings back over a file copied in from an old backup, so the rollback wouldn't stick. **Restore an earlier setup** makes the old version an ordinary change that every device accepts.

The device recovery copy can survive plugin removal, but clearing Obsidian's app data can remove it. It is not a substitute for a separate backup. If this device can't update its recovery copy, for example because its storage is full, Callout Studio still saves your settings. It tells you once, and tries again with each later change.

## Use a synced vault

When you add Callout Studio to a new device, or reinstall it, let your sync service finish before you change anything. Your callouts and settings appear once they arrive. Until you change a setting yourself, the new device doesn't save a settings file, so its defaults can't replace your setup on other devices.

Use one sync service for the vault, and check that it includes your configuration folder and plugin settings. Syncing notes alone does not guarantee that settings sync. Different configuration folders can intentionally keep devices' settings separate. Follow [Obsidian's sync guidance](https://obsidian.md/help/sync-notes).

| Method | What to check |
| --- | --- |
| iCloud | On iPhone/iPad, the vault must be inside **iCloud Drive → Obsidian**. On macOS 15 and later, select **Keep Downloaded** for the Obsidian folder; on macOS 14 and earlier, Obsidian recommends disabling **Optimize Mac Storage**, which affects all iCloud storage. Deleting a file propagates to other devices; removing its download is different. [Obsidian](https://obsidian.md/help/sync-notes), [Apple](https://support.apple.com/en-ca/104953). |
| Obsidian Sync | Check vault configuration sync on each device. Plugin settings have their own sync behavior, including JSON conflict merging. [Sync settings](https://obsidian.md/help/sync/settings), [conflicts](https://obsidian.md/help/sync/troubleshoot). |
| OneDrive, Google Drive, Dropbox | Keep the whole vault available locally: **Always keep on this device** in OneDrive, **Available offline** or mirroring in Drive, and **Make available offline** in Dropbox. Cloud placeholders may be inaccessible while offline. [OneDrive](https://support.microsoft.com/en-US/onedrive/save-disk-space-with-onedrive-files-on-demand-for-windows), [Drive](https://support.google.com/drive/answer/13401938?hl=en), [Dropbox](https://help.dropbox.com/sync/access-files-offline). |
| Syncthing, Git / Working Copy | Allow devices to finish exchanging changes. Syncthing can create separate conflict copies; Git conflicts can leave markers in JSON that must be resolved. [Syncthing](https://docs.syncthing.net/users/syncing.html), [Git](https://git-scm.com/docs/git-merge#_how_conflicts_are_presented). |
| Remotely Save, LiveSync | Verify configuration-folder syncing separately. Remotely Save excludes it by default and syncs while Obsidian is open; LiveSync has customization/hidden-file options. Do not combine these with another vault sync service. [Remotely Save](https://github.com/remotely-save/remotely-save#config-folder--files-and-bookmarks), [LiveSync](https://github.com/vrtmrz/obsidian-livesync). |

These recovery safeguards work with the files visible to Obsidian; they cannot control a provider's exclusions, connectivity, delayed deletions or conflict policy. They are not a guarantee of compatibility with every service or mobile setup.

---
**Next:** [Back to the guide overview](README.md)
