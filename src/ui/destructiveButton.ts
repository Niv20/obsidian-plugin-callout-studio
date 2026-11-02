/**
 * ui/destructiveButton.ts — the one red a "this cannot be undone" button wears.
 *
 * Obsidian's quiet destructive button is `mod-destructive` alone, which is what
 * `ButtonComponent.setDestructive()` adds: red words on a light red wash, the
 * look of Obsidian's own Log out button in Settings → General → Account. Every
 * red button of ours wears it — Reset everything, a window's confirm button,
 * Replace in vault, Convert selected, Restore — on every device, in the same
 * look whether the button is lit or locked (a locked one is dimmed by
 * Obsidian's own `aria-disabled` rule, like any other button).
 *
 * `mod-destructive mod-cta`, the solid red, is not used any more, and neither is
 * the older `mod-warning`: under `.is-mobile` Obsidian paints it grey with bold
 * red text, so the same button used to be red on a desktop and grey on a phone.
 *
 * A raw `<button>` takes {@link DESTRUCTIVE_BUTTON_CLASSES}; a `ButtonComponent`
 * calls `setDestructive()`. Neither ever uses `setCta()` beside it,
 * `mod-warning` or `ButtonComponent.setWarning()` (`tests/dangerButtons.test.ts`).
 */
export const DESTRUCTIVE_BUTTON_CLASSES = ["mod-destructive"];
