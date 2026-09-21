# The three callout types

Callout Studio includes Obsidian's thirteen built-in callouts. Open the plugin settings and look under **Built-in callouts** to browse them. Each row shows the callout's icon and name, its supported aliases, and its color.

Every built-in or custom callout can appear in three forms: Block, Heading, and Inline. One definition supplies the name, icon, and color for all three.

![Three ways to use a callout](https://github.com/user-attachments/assets/3cf88262-184d-42e6-b810-d43889629afb)

## Block callout

Use a block callout for a standalone box of information. Start the line with `>`, then place an exclamation mark and the callout ID inside square brackets:

```md
> [!note]
> Your content goes here.
```

Write a custom title immediately after the closing bracket. Start every additional content line with another `>`:

```md
> [!note] My custom title
> First paragraph.
>
> Second paragraph.
```

## Heading callout

Use a heading callout to make a section stand out while keeping it as a real heading. Type the usual heading marks, followed by the callout token and an optional custom title:

```md
## [!tip] My heading title
```

The heading becomes a colored bar but remains part of the document Outline and can still be linked like any other heading.

## Inline callout

Use an inline callout to highlight something without breaking the paragraph:

```md
Remember to check the settings [!warning] before you continue.
```

The token becomes a small colored pill. To put custom text inside the pill, add it in curly braces immediately after the token:

```md
Want an [!note]{inline callout}? Add [!type]{text} inside a sentence.
```

The `{` must touch the closing `]`.

## Metadata and callout IDs

Obsidian can attach metadata after a pipe, such as `[!note|purple]`. Callout Studio ignores that metadata when identifying the callout type, so `[!note]`, `[!note|purple]`, and `[!note|green]` all use the same **Note** definition. Heading, Inline, and Block callouts can all carry metadata.

All three formats render in Live Preview, Reading view, and PDF exports.

---
**Next:** [Create your first callout](02-create-your-first-callout.md)
