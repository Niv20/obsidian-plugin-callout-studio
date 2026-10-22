/**
 * ui/destructiveButton.ts — the one red a "this cannot be undone" button wears.
 *
 * Obsidian's current destructive confirmations are `mod-destructive mod-cta`,
 * which is what `ButtonComponent.setDestructive().setCta()` adds: a solid red
 * button on every device. The older `mod-warning` class is not that — under
 * `.is-mobile` Obsidian paints it grey with bold red text — so the same button
 * used to be red on a desktop and grey on a phone.
 *
 * A raw `<button>` takes these classes; a `ButtonComponent` calls
 * `setDestructive().setCta()`. Neither ever uses `mod-warning` or
 * `ButtonComponent.setWarning()` (`tests/dangerButtons.test.ts`).
 */
export const DESTRUCTIVE_BUTTON_CLASSES = ["mod-destructive", "mod-cta"];
