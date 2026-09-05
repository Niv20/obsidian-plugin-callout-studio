# Creating your first callout

Create a callout type through the editor, opened either from autocomplete or from **Add new callout** in settings. You can also add types already used in your saved notes with the explicit **Discover now** button beside **My callout types**. Typing or opening a note never creates a saved definition by itself.

## The fastest way: type it in a note

The quickest path to a new callout starts wherever you're already writing. Open a blockquote and start typing `[!`. Callout Studio immediately shows a suggestion list of every callout type you already have, filtered as you keep typing.

![autocomplete](https://github.com/user-attachments/assets/f3fd6c6c-e5de-4847-b46f-c7b42856d2fc)

From here you have two options:

- **Pick a suggestion** from the list, and Callout Studio inserts a complete callout header for you — no need to remember the exact syntax.
- **Type a brand-new name** and choose **Create new callout** in the suggestions. This opens the editor with that name filled in. Choose its appearance and press **Create callout** to save it; dismissing the editor creates nothing.

This is the easiest way to get going, especially when a new callout idea occurs to you mid-sentence.

## Building it first: the callout editor

If you'd rather design a callout type before you write a word about it, use the command **Create new callout type** from the command palette. This opens the callout editor directly, where you set the callout's name, icon and colors before it appears anywhere in a note.

Inside the callout editor you:

1. Name the callout.
2. Pick its icon.
3. Choose its light and dark colors.

The cursor starts in the **Name** field, so you can begin typing straight away — on a phone or tablet the keyboard comes up with it, and the window stays where it is rather than scrolling. This happens only when you're creating something new: opening an existing callout to edit it leaves the cursor alone, so the keyboard doesn't cover the form you came to look at.

As you make each choice, a live, real preview shows exactly how the callout will render. This chapter won't go deep on colors or icons — for the full picture, see [Colors and color palettes](03-colors-and-color-palettes.md) and [Icons in depth](14-icons-in-depth.md).

The editor waits for the settings file to be saved before it reports success and closes. If saving fails or a synchronized file has changed underneath it, the editor stays open and shows a notice. Keep your work open while checking storage and sync; an appearance visible in a live preview is not proof that it was saved. If incoming settings need to load, close the editor after preserving your work, let synchronization finish, and retry the edit. A recovery copy is made before incoming settings replace local definitions.

Renaming a type or changing its standard title/fold behavior can also update existing notes. Those changes start only after its settings save succeeds. If a note cannot be updated, keep the editor open and press **Save changes** again after resolving the file problem. The retry continues the unfinished update before applying further edits. During a rename, the old IDs remain saved as aliases until all affected notes are updated. If Obsidian closes midway, those aliases preserve the styling of notes that still use an old ID; you can complete the rename later by editing the type and removing the old alias. A settings save and changes to many note files cannot be one atomic operation.

## Using your new callout type

However you created it — typed on the fly or built in the editor — a callout type behaves the same way from then on. Once it exists, you can use it in any of the three forms covered in the previous chapter: as a Block Callout, a Heading Callout, or an Inline Callout.

---
**Next:** [Colors and color palettes](03-colors-and-color-palettes.md)
