# Commands & hotkeys

Callout Studio adds commands to Obsidian's Command Palette. Press `Ctrl+P` on Windows or Linux, or `Command+P` on macOS, then search for **Callout Studio**.

The built-in commands are:

- **Callout Studio: Open settings**
- **Callout Studio: Create new callout type**
- **Callout Studio: Insert empty callout**
- **Callout Studio: Wrap in callout**
- **Callout Studio: Unwrap from callout**
- **Callout Studio: Quick insert block callout**

No keyboard shortcut is assigned by default.

## Wrap text after writing it

Select text and run **Callout Studio: Wrap in callout**. Choose a callout type, and Callout Studio turns the selection into a block callout.

```md
> [!note]
> This is the idea I want to highlight.
> It can be one paragraph, a table, a code block, or a longer selection.
```

This lets you write first and decide on the callout later. It also handles tables and fenced code blocks without making you add every `>` manually.

To create nested callouts, write the inner content, wrap it once, select the result, and wrap it again:

```md
> [!tip]
> Here is the main explanation.
>
> > [!warning]
> > This smaller note is nested inside the first callout.
```

## Unwrap a callout

Place the cursor inside a callout, or select part of it, and run **Callout Studio: Unwrap from callout**. It removes one callout layer while keeping the content. Nested blocks can therefore be unwrapped one level at a time.

## Show, hide, and assign shortcuts

Open **Settings → Callout Studio → Commands & hotkeys**, then click **Manage commands**.

From this window you can:

- Turn built-in commands on or off.
- Click the plus button beside a command to open Obsidian's Hotkeys settings focused on that command.
- Review the shortcuts already assigned by Obsidian.

Obsidian owns the shortcut itself; Callout Studio provides the command.

## Create a custom command

Under **Your commands**, click **New command**. Choose the callout format and type, then configure the options for that format.

A Heading command can insert a chosen callout at a specific heading level. An Inline command inserts a chosen inline callout. A Block command can either insert a new block or wrap the current selection, and it can set the initial fold state:

| Fold state | Markdown |
| --- | --- |
| **Non-foldable** | `> [!note]` |
| **Foldable, expanded (+)** | `> [!note]+` |
| **Foldable, collapsed (-)** | `> [!note]-` |

For example, you can create a command that always wraps text in your favorite block callout, inserts a collapsed warning, or adds a summary as an H2 heading callout.

Each custom command appears in the Command Palette and can receive its own hotkey. Because its callout type is already selected, it runs without opening the suggestion list.

---
**Next:** [Import, export & sharing](10-import-export-and-sharing.md)
