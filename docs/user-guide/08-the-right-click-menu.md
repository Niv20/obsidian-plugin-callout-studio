# The right-click menu

Right-click a callout in a note to open actions for that callout. The available items depend on whether it is a Heading, Inline, or Block callout.

The callout-type action adapts to the token under the pointer. A saved type
shows **Edit callout settings**. An unknown type shows **Create callout** and
opens a new editor with that token's ID already filled in.

![Right-click context menu](https://github.com/user-attachments/assets/4100cbe6-ba6f-45ce-986f-f3d7d17fdbac)

## Heading callouts

A heading callout's actions can work on the entire section below that heading:

- Cut the section.
- Copy the section.
- Delete the section.
- Create or edit the callout type.
- Open the main Callout Studio settings.

The section ends at the next heading of the same or a higher level.

## Inline callouts

An inline callout keeps the menu simple:

- Create or edit the callout type.
- Open the main Callout Studio settings.

## Block callouts

A block callout offers:

- Copy the callout's Markdown.
- Change its folding state between open, closed, and non-collapsible.
- Create or edit the callout type.
- Open the main Callout Studio settings.

## Customize the menu

Open **Settings → Callout Studio → Context menu**, then click **Customize menu items**. Toggle individual actions on or off and drag their handles into your preferred order. You can keep dragging the same row or another row without waiting for it to settle. Every change is saved immediately.

**Create or edit callout** is a single action here. At most one of its two
runtime labels appears in a note: **Edit callout settings** for a saved type or
**Create callout** for an unknown one.

Enabled actions stay above the divider and disabled actions stay below it. Drag within either group; use the toggle to move an action between groups. Turning an action off sends it to the bottom, and turning it on places it after the other enabled actions.

To reorder with the keyboard, focus a drag handle and press **↑** or **↓**. The action moves within its group, and focus follows it.

---
**Next:** [Commands & hotkeys](09-commands-and-hotkeys.md)
