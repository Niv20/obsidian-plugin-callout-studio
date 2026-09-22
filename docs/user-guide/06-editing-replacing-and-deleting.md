# Editing, replacing & deleting

Changes to a callout's color, icon, name, or ID take effect across the vault. Callout Studio updates the definition and, when necessary, rewrites matching note tokens so existing notes keep working.

## Edit a callout

Click the pencil beside a callout to open its editor. Save the new color, icon, name, IDs, or icon adjustments when you are finished.

When you customize one of Obsidian's thirteen built-in callouts, small return arrows appear beside changed IDs, icons, and colors. Each icon-adjustment card also gets its own return arrow when its sliders change; it resets the size and both offsets for that callout format without touching the other two formats. To undo every customization on that built-in type at once, open its three-dot menu and choose **Reset to default**.

Resetting **Callout IDs** restores Obsidian's original ID and aliases. Any custom aliases it removes are rewritten to the primary ID in your notes when you save, so existing callouts keep working. If another callout already uses one of the original aliases, the draft stays unchanged and the IDs field shows the conflict.

## Replace a callout across the vault

Use **Replace in vault** when every use of one type should become another:

1. Open the callout's three-dot menu.
2. Choose **Replace in vault**.
3. Select the replacement callout.
4. Confirm the change.

Callout Studio updates matching Block, Heading, and Inline callouts throughout the vault while keeping their content.

## Delete a custom callout

Choose **Delete** from the same three-dot menu.

- If the custom callout is not used in any note, it is removed from the list immediately.
- If it is in use, Callout Studio shows the number of affected occurrences and asks what should happen next.
- **Delete (convert to plain text)** removes the callout styling but keeps the note content.
- **Replace instead** changes every occurrence to another callout before removing the old definition.

Obsidian's built-in callout types are permanent and cannot be removed from the list. You can reset their appearance or replace their uses, but the underlying type remains available.

If some notes cannot be updated, Callout Studio reports the incomplete work and keeps the definition needed by the remaining notes. Resolve the file or sync problem and run the action again.

---
**Next:** [Global styling](07-global-styling.md)
