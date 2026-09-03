# Deleting and replacing callouts

Sooner or later you'll want to retire a callout type or swap one for another across your notes. Callout Studio gives you safe, guided ways to do both, whether the callout is one you created yourself or one of the built-in types.

## Finding the menu

Every callout row in **My callout types** and **Built-in callouts** has a **⋯** menu. Open it to see the actions available for that row, including replacing it or removing it.

Rows under **Callouts from your theme** carry their actions as buttons on the row itself instead, because there are only ever three of them - see [Using Callout Studio with your theme](12-using-callout-studio-with-your-theme.md).

## Replacing a callout everywhere

Use **Replace in vault** when you want every occurrence of one callout type to become another type, all at once:

1. Open the **⋯** menu on the callout you want to replace.
2. Choose **Replace in vault**.
3. Pick the callout type you want it replaced with.
4. Confirm.

Callout Studio then goes through your whole vault in a single pass and swaps every occurrence of the original callout for the one you picked.

## Deleting a callout you created

If the callout is one you created yourself, choosing **Delete** first tells you how many notes currently use it. From there you can:

- **Cancel** and leave everything as it is.
- **Replace it with another callout instead** - this hands you off to the same replace flow described above, so you don't lose the content.
- **Go ahead and delete it.** If the callout is used anywhere, those existing occurrences are converted into plain ordinary paragraphs first - they keep their text, they just lose the callout styling. Only after that does the row disappear from your list.

## Deleting a callout Callout Studio didn't create

Two kinds of callout can't really be deleted: **one of Obsidian's 13 built-ins**, and **a callout type your theme supplies**. In both cases something outside Callout Studio keeps declaring the type, so removing the row would only bring it straight back.

Because of that, the action only appears on those once the callout is actually in use somewhere in your vault, and what it does is narrower: it converts those existing occurrences into plain paragraphs and leaves the type itself alone. The confirmation says so before you commit, and for a theme callout it says the other half too — **nothing belonging to your theme is read, changed or removed.** Callout Studio only ever writes to notes inside your vault.

On a callout your theme supplies, the menu item is called **Clear uses in your notes** rather than *Delete*, because that is what happens. On a built-in it is still called Delete, and the confirmation explains that the type stays.

Afterwards the row is still in your list, ready to use again.

Turning a customized built-in callout back to its original look, without touching any of its usages in your notes, is a different action - see [Resetting callouts and settings](13-resetting-callouts-and-settings.md). Which callouts your theme owns in the first place is explained in [Using Callout Studio with your theme](12-using-callout-studio-with-your-theme.md).

## While your notes are being updated

Renaming, replacing and deleting all rewrite the notes that use the callout, and on a large vault that takes a moment. You can keep working while it runs — each note is updated as one atomic step against whatever is on disk at that instant, so a paragraph you type mid-way through is not overwritten by the update.

Notes that don't use the callout are not touched at all, and are never even opened for writing — so nothing needless is handed to Sync.

If a note genuinely can't be updated — it was deleted moments earlier, or Sync has it locked — that note is skipped and the rest still go through. You'll get a notice saying how many were left alone, and those notes keep their original text; re-running the same action later picks them up.

---
**Next:** [Vault insights and maintenance](10-vault-insights-and-maintenance.md)
