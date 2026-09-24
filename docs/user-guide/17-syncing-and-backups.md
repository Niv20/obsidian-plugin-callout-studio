# Syncing & backups

Callout Studio stores its setup in Obsidian's plugin settings. A synced vault can move those settings between devices, but only if the sync service includes the vault's configuration folder and keeps the files available to Obsidian.

## Export a complete backup

Choose the Callout Studio backup format to save your full setup as JSON, including callout definitions, saved color palettes, and plugin settings. This is the recommended portable backup for restoring a setup through **Import** or transferring it to another vault where the plugin is installed.

The export captures the setup currently displayed, even when settings saving is paused. Keep it somewhere separate from the plugin folder. Its format differs from the plugin's internal `data.json`: do not rename an export to `data.json`.

When importing a Callout Studio backup, matching entries are updated and valid saved palettes are merged into the destination setup without overwriting unrelated palettes.

Ordinary import does not bypass paused saving; resolve the saving problem first.

## Recover paused saving

Callout Studio pauses saving when it cannot safely use its settings file. Your displayed setup may still be available from memory or a recovery copy kept on this device. Uninstalling the plugin on a synced device can remove the shared settings file on other devices too. A temporarily unavailable cloud file can look similar, so the plugin does not assume that missing settings should be reset.

1. If your setup is still displayed, use **Export → Callout Studio backup** to keep a separate JSON copy.
2. Check that the vault is downloaded, the sync service is running, and the device has storage space and permission to write. Let pending synchronization finish, then select **Check again**. This checks for returned settings; it does not create a missing file.
3. If the file remains missing and the displayed setup is the one you want, select **Restore these settings** and review the confirmation. This creates a settings file from that setup and resumes saving after a successful local write. The same action is available on desktop and mobile, including when the file disappears while Obsidian is open. There is no need to recover from a particular device. If no previous setup is available, the action says **Create settings file**.

Restoration checks again for an arriving settings file and preserves a readable previous recovery copy before writing. If the file returns during recovery, the plugin handles it through its normal recovery checks. A failed write leaves saving paused so you can retry. A successful local save does not mean cloud synchronization has finished; let it finish before editing the setup on another device.

If the message says the file is unreadable or invalid, resolve access or sync errors, or restore a valid original `data.json` from your backup or provider's version history, then use **Retry saving and recovery**. A file from a newer plugin version requires an update on this device. Missing-file restoration does not overwrite corrupt or unsupported files. Provider conflict copies and Git merge conflicts may need review in the sync tool. Keep the original files until recovery is complete.

The device recovery copy can survive plugin removal, but clearing Obsidian's app data can remove it. It is not a substitute for a separate backup.

## Use a synced vault

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
