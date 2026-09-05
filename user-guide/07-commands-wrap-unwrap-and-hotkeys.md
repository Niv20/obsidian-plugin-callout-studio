# Commands, wrap/unwrap & hotkeys

Callout Studio works with Obsidian's command palette instead of adding buttons or menus everywhere, so you can insert, wrap, and unwrap callouts entirely from the keyboard. This chapter covers the five built-in commands, how to give them shortcuts, and how to build your own commands for the callout types you use most.

## The five built-in commands

Callout Studio adds exactly five commands to Obsidian's command palette. None of them has a keyboard shortcut assigned by default.

- **Open settings** — opens the Callout Studio settings tab.
- **Create new callout type** — opens the callout editor so you can design a new callout type.
- **Insert empty callout** — starts a new callout at the cursor, then shows the same suggestion list you'd get by typing `[!`, so you can pick the type right away.
- **Wrap in callout** — wraps the current paragraph or selection in a callout, then shows that same suggestion list.
- **Unwrap from callout** — removes one callout level around the cursor or selection.

## Assigning shortcuts

To give any of these commands a keyboard shortcut:

1. Go to **Settings → Keyboard shortcuts → Manage commands**.
2. Find the command in the list. Each row shows whatever shortcut is currently bound to it, or the word **Blank** if none is set.
3. Select the shortcut to open Obsidian's own hotkey settings, already focused on that exact command.

From there you assign the key combination the same way you would for any other Obsidian command.

## Why there isn't one command per callout type

Callout Studio deliberately does not add a separate command for every callout type — with dozens of types in play, that would flood the command palette with hundreds of entries. Instead, the same **Manage commands** window lets you build your own specific commands, tailored to exactly the callout types you use.

To build one, you pick:

- A **format** — heading, inline, or block.
- A **callout type** — any callout type you've defined.
- Where the format offers a choice — a **heading level**, or whether the command **wraps a selection** or **inserts a new callout**.

## Custom commands

Each custom command you build gets registered with Obsidian just like any other command. That means it shows up in the command palette and in **Settings → Hotkeys**, ready for you to assign a shortcut. A few examples of what a custom command might be named:

- Wrap in Warning callout
- Insert H2 Note heading callout
- Insert Important inline callout

Custom commands behave exactly like the five generic commands above — the same handling of selections, cursor position, nesting, code blocks, and frontmatter. The only difference is that the callout type is already chosen, so there's no suggestion-list step; the command does its job immediately.

## Custom commands stay in sync

Custom commands stay tied to the callout type they were built around, so they never go stale:

- **Renaming a callout** updates the command's name automatically, and your assigned shortcut stays put.
- **Deleting a callout** removes any commands that depended on it, so nothing broken is left sitting in the command palette.
- **Editing a command's target** always keeps its shortcut, so you never have to reassign it after a change.

---
**Next:** [Fallback callouts and manual discovery](08-fallback-callouts-and-manual-discovery.md)
