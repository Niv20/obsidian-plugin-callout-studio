# The right-click menu

Callout Studio adds useful actions to Obsidian's right-click menu, so you can work with a callout without first finding it in settings.

## How it works

Right-click any Block, Heading, or Inline Callout to see Callout Studio's actions alongside Obsidian's usual menu items.

![Right-click context menu](https://github.com/user-attachments/assets/4100cbe6-ba6f-45ce-986f-f3d7d17fdbac)

## Actions available on every callout

No matter which form of callout you right-click, you'll always see:

- **Edit callout settings:** opens the callout type in the editor, where you can change its name, icon, or colors.
- **Open Callout Studio settings:** opens the plugin's settings tab.

## Extra actions on a Block Callout

When you right-click a Block Callout, the menu also gives you:

- Copy the callout's markdown, so you can paste it elsewhere as-is.
- Set its fold state: open, closed, or non-collapsible.

## Extra actions on a Heading Callout

When you right-click a Heading Callout, the menu offers whole-section actions that apply to the heading and everything under it:

- Cut the heading section.
- Copy the heading section.
- Delete the heading and everything nested beneath it.

**Cut** removes text only after it reaches the clipboard. If copying fails or the note changes while copying, the note stays unchanged and a notice explains what happened.

Section actions keep fenced code blocks whole: a line such as `# a shell comment` inside a code example does not end the section. The next heading of the same or a higher level stays in the note.

## Customizing the menu

Open **Settings → Customize menu items** to choose which actions appear for Block, Heading, and Inline Callouts, and to change their order.

---
**Next:** [Commands, wrap/unwrap, and hotkeys](07-commands-wrap-unwrap-and-hotkeys.md)
