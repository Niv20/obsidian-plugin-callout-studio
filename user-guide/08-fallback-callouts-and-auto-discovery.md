# Fallback callouts & auto-discovery

Callout Studio keeps its callout list in sync with what your vault actually uses, without any manual bookkeeping on your part. Type a new callout ID into a note and Callout Studio notices, adds it to your list, and gives it a look right away — so you never end up with an unstyled or broken-looking callout.

## How new callout IDs are picked up

- When a note uses a callout ID that isn't in your list yet, it gets added on its own.
- New callout IDs typed into any open note are picked up automatically as you write — you don't need to save the note first.
- **Opening a note is enough.** A note you open — including the tabs Obsidian restores when you reopen the vault — is scanned for callout IDs you don't have yet, so you don't have to edit it for its callouts to appear. Open several notes in a row and every one of them is scanned, not just the last: each note's new callouts are added to your list alongside the others.
- If the settings tab is open while this happens, the list updates in place — you don't need to close and reopen it.
- Opening the settings tab also scans any unsaved text sitting in your currently open editor tabs for new IDs, so a callout type you just typed shows up in the list even before you save the note.

Re-opening a note that hasn't changed since it was last looked at costs nothing — Callout Studio remembers it has already seen that version, so moving between tabs stays fast.

## The default fallback callout

Any callout ID that Callout Studio doesn't recognize yet is styled using the default fallback callout. This gives every unrecognized callout type a consistent, presentable appearance instead of leaving it unstyled. You can choose which callout acts as this fallback from Settings.

## Scanning your whole vault

Auto-discovery normally works note by note, as you open and edit files. If you want Callout Studio to check your entire vault in one pass, use the **Scan now** button. This runs a one-time full scan of the vault, adding any unrecognized callout IDs it finds as new rows so you can see and customize them.

On very large vaults — 500 or more markdown files — Callout Studio asks permission before doing a full initial scan. If you decline, files are scanned individually as you open them instead, so nothing is ever scanned without at least implicit action from you opening it.

## Turning auto-discovery off

If you would rather add every callout type by hand, switch off **Automatically discover callouts in your vault** in Settings → Vault insights & maintenance. Nothing is taken away when you do: every callout already in your list stays exactly as it is, **Scan now** still works whenever you want it, and you can create callout types yourself as usual. Switching it back on takes effect immediately.

## Automatic cleanup

Rows that were auto-created this way, and that you never used again and never customized, are quietly cleaned up in the background over time. This keeps your callout list free of clutter from typos or one-off experiments, so it stays focused on the callout types you actually use.

## If you sync your vault across devices

Auto-discovered callouts are remembered **on each device separately**, and never written into the settings file that syncs. That is deliberate: when a note travels to your other device before your settings do, that device would otherwise invent its own plain-looking version of the new callout and save it — and your two devices would end up arguing over the same file, which is how sync tools produce `data.json.sync-conflict-…` copies.

In practice this means:

- Creating or customizing a callout on one device still syncs to the other, exactly as you would expect.
- Simply *reading* a synced note never changes your settings file on the other device.
- Each device builds its own list of discovered callouts from your notes, so the two lists agree without either device having to tell the other anything.
- A brand-new device — or one where you have cleared Obsidian's local data — scans the vault once to build that list, the same way a fresh install does.

- When settings arrive from your other device, Callout Studio adopts them without writing anything back. Two devices that agree stay silent, so there is nothing for a sync tool to reconcile and no conflict copies to clean up.
- If your settings file is ever half-written or unreadable — a sync still in progress, most likely — Callout Studio leaves it completely alone rather than replacing it. Your callouts may be missing for a moment, and it will tell you so, but the file itself is never overwritten with an empty one.

On desktop, Callout Studio notices when your settings file is updated by a sync tool while Obsidian is open, and picks up the change without you having to restart. Obsidian gives plugins no way to be told about that on mobile, so there Callout Studio checks each time you come back to the app — which is usually just after your sync tool has run. Either way, once your real settings turn up they are adopted and everything works normally again, including saving: you do not have to restart, and any callout you make after that point is kept.

---
**Next:** [Deleting and replacing callouts](09-deleting-and-replacing-callouts.md)
