# Editing, replacing & deleting

Changes to a callout's color, icon, name, or ID take effect across the vault. Callout Studio updates the definition and, when necessary, rewrites matching note tokens so existing notes keep working.

## Edit a callout

Click the pencil beside a callout to open its editor. Save the new color, icon, name, IDs, or icon adjustments when you are finished.

When you customize one of Obsidian's thirteen built-in callouts, small return arrows appear beside changed IDs, icons, and colors. Each icon-adjustment card also gets its own return arrow when its sliders change; it resets the size and both offsets for that callout format without touching the other two formats. To undo every customization on that built-in type at once, open its three-dot menu and choose **Reset to default**.

Resetting **Callout IDs** restores Obsidian's original ID and aliases. Any custom aliases it removes are rewritten to the primary ID in your notes when you save, so existing callouts keep working. If another callout already uses one of the original aliases, the draft stays unchanged and the IDs field shows the conflict.

## Duplicate a custom callout

Open a saved custom callout's three-dot menu and choose **Duplicate**. The copy keeps the original's complete saved appearance and settings, including its icon adjustments and any link to a deleted color palette. A deleted palette stays marked as **Deleted color** in the copy's editor.

The copy receives a new name and ID ending in `copy`, then `copy 2`, `copy 3`, and so on when needed. Additional IDs receive their own unique copy suffixes. Long names and IDs are shortened to leave room for the suffix. Existing callouts in your notes keep using the original.

After the copy is saved, its section opens and the list shows enough items to reveal it immediately, with a notification confirming success. If duplication fails, an error notification appears. No incomplete copy is added; if a later saving step fails after the complete copy has reached storage, that valid copy is kept.

**Duplicate** is available for saved custom callouts; Obsidian's built-in callouts and callouts supplied only by a theme do not offer it.

## Replace a callout across the vault

Use **Replace in vault** when every use of one type should become another:

1. Open the callout's three-dot menu.
2. Choose **Replace in vault**.
3. Select the replacement callout. You can type to filter the list; pressing **Enter** selects the top match.
4. Choose **Replace**.

**Replace** stays dimmed until you have chosen the callout to replace it with. Press it and a message says what to choose.

On desktop, the replacement search is ready for typing when the window opens. On a phone or tablet, tap it to bring up the keyboard.

Callout Studio updates matching Block, Heading, and Inline callouts throughout the vault while keeping their content. The change edits your notes directly, so **Enter** never starts it; only the **Replace** button does.

When it finishes, the notice offers **Undo** for a few seconds. Undo puts back every note the replacement changed, unless you've edited that note since; those are left as they are, and the message says how many. Only the most recent replacement or deletion can be undone, and only until Obsidian is closed.

## Delete a custom callout

Choose **Delete** from the same three-dot menu.

- If the custom callout is not used in any note, it is removed from the list immediately.
- If it is in use, Callout Studio shows the number of affected occurrences and asks what should happen next.
- **Delete (convert to plain text)** removes the callout styling but keeps the note content. Each callout's title stays as a line of its own. If text sat right above a callout with no blank line between them, a blank line is added so the two stay separate paragraphs.
- **Replace instead** changes every occurrence to another callout before removing the old definition.

Obsidian's built-in callout types are permanent and cannot be removed from the list. You can reset their appearance or replace their uses, but the underlying type remains available.

If some notes cannot be updated, Callout Studio reports the incomplete work and keeps the definition needed by the remaining notes. Resolve the file or sync problem and run the action again.

After a deletion that converted notes, the notice offers **Undo** too. It puts the notes back, and the deleted callout type with them.

While saving is paused, deleting a custom callout is unavailable and no note is changed: the removal could not be saved, so the type would return on the next launch after its notes had already been converted.

---
**Next:** [Global styling](07-global-styling.md)
