# Syncing & backups

Callout Studio stores its setup in Obsidian's plugin settings. A synced vault can move those settings between devices, but only if the sync service includes the vault's configuration folder and keeps the files available to Obsidian.

## Export a complete backup

Choose the Callout Studio backup format to save your full setup as JSON, including callout definitions, saved color palettes, and plugin settings. This is the recommended portable backup for restoring a setup through **Import** or transferring it to another vault where the plugin is installed.

The export captures the setup currently displayed, even when settings saving is paused. Keep it somewhere separate from the plugin folder. Its format differs from the plugin's internal `data.json`: do not rename an export to `data.json`.

When importing a Callout Studio backup, matching entries are updated and valid saved palettes are merged into the destination setup without overwriting unrelated palettes. [Import a Callout Studio backup](10-import-export-and-sharing.md#import-a-callout-studio-backup) explains what the confirmation shows.

**Import**, **Reset everything** and deleting a custom callout are unavailable while saving is paused; resolve the saving problem first.

## Restore an earlier setup

Open **Settings → Callout Studio**, and under **Earlier setups** choose **Restore an earlier setup**. The window lists every earlier version of your setup that Callout Studio can find:

- **Saved on this device**: recent versions of your setup, kept on this device outside the vault. History keeps the twenty most recent versions, plus the newest version from each of the last fourteen days and eight weeks in which a version was recorded. A storage limit can remove older versions sooner; the newest one is always kept. This history survives uninstalling the plugin, but clearing Obsidian's app data removes it.
- **Backups**: the copies in the plugin's [backups folder](#automatic-backups), including ones saved by your other devices.
- **Other copies of the settings file**: copies a sync service left next to the settings file, such as `data 2.json` or a conflicted copy. A copy that can't be read is listed but can't be restored.

Each entry shows how many differences it has from your current setup. **Restore** asks first, saves a backup of your current setup, then makes the earlier version your setup on every synced device. Changes made on another device that this device hadn't received yet are kept. **Export copy** saves an entry as a Callout Studio backup file, which works even while saving is paused. Restoring is unavailable while saving is paused.

## Automatic backups

Callout Studio saves a copy of your setup to its `backups` folder before a change that could lose it:

- before settings arriving from another device remove or replace callouts or preferences on this one
- before **Restore these settings** replaces this device's recovery copy
- before **Reset everything**
- before any import

The folder is inside the plugin's folder, usually `.obsidian/plugins/callout-studio/backups/`. Each copy is checked after it's saved, and the same setup is never saved twice. Each device keeps its own newest ten copies, plus its newest copy from each of the last fourteen days on which it saved one. A device never removes copies that another device in use still keeps there. To bring one back, use [Restore an earlier setup](#restore-an-earlier-setup), which lists these copies, including ones saved by older versions. The folder also keeps an exact copy of any settings file or device recovery copy that Callout Studio replaced because it couldn't be read. These are named `unreadable-….txt` and `recovery-copy-….txt` and are never removed automatically.

The folder syncs with the rest of the plugin's settings, and uninstalling the plugin removes it. Keep an exported backup somewhere else as well.

## Recover paused saving

Callout Studio pauses saving when it cannot safely use its settings file. Your displayed setup may still be available from memory or a recovery copy kept on this device. Uninstalling the plugin on a synced device can remove the shared settings file on other devices too. A temporarily unavailable cloud file can look similar, so the plugin does not assume that missing settings should be reset.

While saving is paused, desktop shows **Saving paused** in the status bar, and mobile shows a notice that stays until you dismiss it. Select either to open Callout Studio settings, where a banner explains the cause and offers the way out. While the app is open, Callout Studio also checks for the file again every minute.

While saving is paused, the settings page can't be changed, so nothing you change there is lost when Obsidian closes. You can still look through your callouts, export your setup, browse and export earlier setups, and copy sync diagnostics. Resume saving before restoring an earlier setup.

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

When reporting a sync problem, choose **Copy diagnostics** under **Sync diagnostics** in Callout Studio settings, and paste the result into your report. It describes how saving and syncing are working on this device and contains none of your callouts or settings.

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
