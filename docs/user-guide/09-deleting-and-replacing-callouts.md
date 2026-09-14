# Deleting and replacing callouts

You can remove a callout type or replace every use of it across your notes. The available action depends on whether the callout is custom, built into Obsidian, or supplied by your theme.

## Finding the menu

Every callout row in **My callout types** and **Built-in callouts** has a **⋯** menu. Open it to see the actions available for that row, including replacing it or removing it.

Rows under **Callouts from your theme** show their three available actions directly on the row. See [Using Callout Studio with your theme](12-using-callout-studio-with-your-theme.md).

## Replacing a callout everywhere

Use **Replace in vault** when you want every occurrence of one callout type to become another type, all at once:

1. Open the **⋯** menu on the callout you want to replace.
2. Choose **Replace in vault**.
3. Pick the replacement callout type. Use the search box to match its name, ID, or aliases.
4. Confirm.

Callout Studio then goes through your whole vault in a single pass and swaps every occurrence of the original callout for the one you picked.

## Deleting a callout you created

If the callout is one you created yourself, choosing **Delete** first tells you how many notes currently use it. From there you can:

- **Cancel** and leave everything as it is.
- **Replace it with another callout instead.** This opens the replacement flow described above and keeps the content.
- **Delete it.** Existing uses are converted to ordinary paragraphs before the type is removed. The text stays in place, but the callout styling is removed.

## Deleting a callout Callout Studio didn't create

Two kinds of callout can't really be deleted: **one of Obsidian's 13 built-ins**, and **a callout type your theme supplies**. In both cases something outside Callout Studio keeps declaring the type, so removing the row would only bring it straight back.

For those callouts, the action appears only when the type is used in your vault. It converts existing uses to plain paragraphs but leaves the type itself available. For theme callouts, the confirmation also explains that Callout Studio does not read, change, or remove theme files. It writes only to notes in your vault.

On a callout your theme supplies, the menu item is called **Clear uses in your notes** rather than *Delete*, because that is what happens. On a built-in it is still called Delete, and the confirmation explains that the type stays.

Afterward, the row remains in the list and can be used again.

To restore a customized built-in callout without changing your notes, see [Resetting callouts and settings](13-resetting-callouts-and-settings.md). To learn which callouts your theme controls, see [Using Callout Studio with your theme](12-using-callout-studio-with-your-theme.md).

## While your notes are being updated

Renaming, replacing, and deleting can rewrite every note that uses a callout, which may take a moment in a large vault. You can keep working while the update runs. Each note is changed as a single operation based on its current contents, so new work is not overwritten.

Notes that do not use the callout are never opened for writing, so they do not create unnecessary sync activity.

If a note cannot be updated because it was deleted or locked by sync, Callout Studio skips it and continues with the rest. A notice reports how many notes were skipped. Run the action again later to update them.

For **Delete**, an incomplete conversion keeps the callout type in your list and
preserves its styling for the remaining notes. Notes already converted stay
converted. Resolve the file problem and run **Delete** again to finish; the type
is removed only after the complete conversion succeeds.

Conversion also handles matching nested callouts and matching tokens in a
converted block's title or body. Escaped examples, inline code and fenced code
keep their literal text; removing a blockquote wrapper does not make those
examples eligible for conversion.

---
**Next:** [Vault insights and maintenance](10-vault-insights-and-maintenance.md)
