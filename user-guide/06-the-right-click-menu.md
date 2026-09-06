# The right-click menu

Every callout you create with Callout Studio comes with quick actions built right into Obsidian's normal right-click menu. Instead of opening settings and hunting for the callout you want to change, you can just right-click it wherever it appears and act on it immediately.

## How it works

Right-click on any callout - a Block Callout, a Heading Callout, or an Inline Callout - and Callout Studio adds its own actions into Obsidian's native context menu, alongside the usual options you already see there.

![Right-click context menu](https://github.com/user-attachments/assets/4100cbe6-ba6f-45ce-986f-f3d7d17fdbac)

## Actions available on every callout

No matter which form of callout you right-click, you'll always see:

- **Edit callout settings** - opens that callout type directly in the editor, ready to change its name, icon, or colors.
- **Open Callout Studio settings** - jumps straight to the plugin's settings tab.

## Extra actions on a Block Callout

When you right-click a Block Callout, the menu also gives you:

- Copy the callout's markdown, so you can paste it elsewhere as-is.
- Set its fold state - open, closed, or non-collapsible.

## Extra actions on a Heading Callout

When you right-click a Heading Callout, the menu offers whole-section actions that apply to the heading and everything under it:

- Cut the heading section.
- Copy the heading section.
- Delete the heading section entirely - the heading plus everything nested beneath it.

**Cut** removes text only after it reaches the clipboard. If copying fails or the note changes while copying, the note stays unchanged and a notice explains what happened.

Section actions keep fenced code blocks whole: a line such as `# a shell comment` inside a code example does not end the section. The next heading of the same or a higher level stays in the note.

## Customizing the menu

You don't have to keep every action visible. Head to Settings → Customize menu items to choose exactly which actions appear for each of the three callout forms - Block Callout, Heading Callout, and Inline Callout - and to reorder them however you like.

---
**Next:** [Commands, wrap/unwrap, and hotkeys](07-commands-wrap-unwrap-and-hotkeys.md)
