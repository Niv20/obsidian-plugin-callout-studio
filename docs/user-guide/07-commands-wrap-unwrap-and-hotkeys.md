# Commands, wrap/unwrap & hotkeys

Callout Studio uses Obsidian's command palette, so you can insert, wrap, and unwrap callouts from the keyboard. It includes five built-in commands, and you can create commands for the callout types you use most.

## The five built-in commands

Callout Studio adds exactly five commands to Obsidian's command palette. None of them has a keyboard shortcut assigned by default.

- **Open settings:** opens the Callout Studio settings tab.
- **Create new callout type:** opens the editor for a new callout type.
- **Insert empty callout:** starts a callout at the cursor and opens the same suggestions you see after typing `[!`.
- **Wrap in callout:** wraps the current paragraph or selection, then opens the callout suggestions.
- **Unwrap from callout:** removes one callout level around the cursor or selection.

## Assigning shortcuts

Quick Insert always writes to the note from which you opened it. If that note
closes or the pane switches to another file, reopen Quick Insert from the
intended note. The existing window will not change the replacement note.

To give any of these commands a keyboard shortcut:

1. Go to **Settings → Keyboard shortcuts → Manage commands**.
2. Find the command in the list. Each row shows whatever shortcut is currently bound to it, or the word **Blank** if none is set.
3. Select the shortcut to open Obsidian's own hotkey settings, already focused on that exact command.

From there you assign the key combination the same way you would for any other Obsidian command.

## Why there isn't one command per callout type

Adding a command for every callout type would quickly clutter the command palette. Instead, **Manage commands** lets you create only the specific commands you need.

To build one, you pick:

- A **format:** heading, inline, or block.
- A **callout type:** any callout type you've defined.
- A **heading level**, or whether the command **wraps a selection** or **inserts a new callout**, when the selected format supports that choice.
- A **fold state** for block callouts, as described below.

### Fold state

Block callouts can be foldable, and a command can set the initial state. The **Fold state** option applies both when wrapping a selection and when inserting a new callout:

| Choice | What the command writes |
| --- | --- |
| **Non-foldable** | `> [!note]`; the callout is always open. |
| **Foldable, expanded (+)** | `> [!note]+`; the callout can fold and starts open. |
| **Foldable, collapsed (-)** | `> [!note]-`; the callout can fold and starts closed. |

So a command set to *Foldable, collapsed* turns a selected paragraph straight into:

```md
> [!note]-
> Selected content
```

Heading and inline callouts do not have a fold option. In `### [!note]- Title`, the `-` is simply the first character of the heading title.

Existing commands are unaffected. Every command built before this option existed is **Non-foldable**, keeps the exact name it had, and keeps whatever shortcut you assigned to it.

## Custom commands

Each custom command you build gets registered with Obsidian just like any other command. That means it shows up in the command palette and in **Settings → Hotkeys**, ready for you to assign a shortcut. A few examples of what a custom command might be named:

- Wrap in Warning callout
- Wrap in Note block callout (collapsed)
- Insert H2 Note heading callout
- Insert Important inline callout

Custom commands handle selections, cursor position, nesting, code blocks, and frontmatter in the same way as the built-in commands. Because the callout type is already selected, they run immediately without opening suggestions.

In a note containing only properties, a heading command adds the heading below the properties and keeps their closing delimiter intact.

## Custom commands stay in sync

Custom commands stay tied to the callout type they were built around, so they never go stale:

- **Renaming a callout** updates the command's name automatically, and your assigned shortcut stays put.
- **Deleting a callout** removes any commands that depended on it, so nothing broken is left sitting in the command palette.
- **Editing a command's target** always keeps its shortcut, so you never have to reassign it after a change.

---
**Next:** [Fallback callouts and manual discovery](08-fallback-callouts-and-manual-discovery.md)
