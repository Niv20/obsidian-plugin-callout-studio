# Creating your first callout

You can create a callout type from autocomplete or with **Add new callout** in settings. To save types that already appear in your notes, use **Scan for callouts** beside **My callout types**. Simply typing or opening a note never saves a new definition.

## The fastest way: type it in a note

The quickest path to a new callout starts wherever you're already writing. Open a blockquote and start typing `[!`. Callout Studio immediately shows a suggestion list of every callout type you already have, filtered as you keep typing.

![autocomplete](https://github.com/user-attachments/assets/f3fd6c6c-e5de-4847-b46f-c7b42856d2fc)

From here you have two options:

- **Pick a suggestion** to insert a complete callout header without memorizing the syntax.
- **Type a brand-new name** and choose **Create new callout** in the suggestions. This opens the editor with that name filled in. Choose its appearance and press **Create callout** to save it; dismissing the editor creates nothing.

This is the easiest way to get going, especially when a new callout idea occurs to you mid-sentence.

Creating a type from an existing block or heading token keeps the title you already wrote after that token.

## Building it first: the callout editor

If you'd rather design a callout type before you write a word about it, use the command **Create new callout type** from the command palette. This opens the callout editor directly, where you set the callout's name, icon and colors before it appears anywhere in a note.

Inside the callout editor you:

1. Name the callout.
2. Pick its icon.
3. Choose its light and dark colors.

On a computer the cursor starts in the **Name** field, so you can begin typing straight away. This happens only when you're creating something new: opening an existing callout to edit it leaves the cursor alone, so nothing you came to look at is disturbed.

On a phone or tablet, no field is focused and the keyboard stays closed. Tap **Name** when you're ready to type. This keeps the editor from jumping as the on-screen keyboard opens.

A live preview updates as you work. For more about appearance, see [Colors and color palettes](03-colors-and-color-palettes.md) and [Icons in depth](14-icons-in-depth.md).

The editor waits for the settings file to be saved before it reports success and closes. If saving fails or a synchronized file has changed underneath it, the editor stays open and shows a notice. Keep your work open while checking storage and sync; an appearance visible in a live preview is not proof that it was saved. If incoming settings need to load, close the editor after preserving your work, let synchronization finish, and retry the edit. A recovery copy is made before incoming settings replace local definitions.

Renaming a type or changing its standard title/fold behavior can also update existing notes. Those changes start only after its settings save succeeds. If a note cannot be updated, keep the editor open and press **Save changes** again after resolving the file problem. The retry continues the unfinished update before applying further edits. During a rename, the old IDs remain saved as aliases until all affected notes are updated. If Obsidian closes midway, those aliases preserve the styling of notes that still use an old ID; you can complete the rename later by editing the type and removing the old alias. A settings save and changes to many note files cannot be one atomic operation.

## Using your new callout type

Once saved, every callout type works the same way, whether you created it from autocomplete or in the editor. You can use it as a Block Callout, Heading Callout, or Inline Callout.

---
**Next:** [Colors and color palettes](03-colors-and-color-palettes.md)
