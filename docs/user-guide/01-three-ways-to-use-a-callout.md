# Three ways to use a callout

Every callout type you create or customize can appear in three forms: Block Callout, Heading Callout, and Inline Callout. Each form has its own vault-wide style controls. This chapter shows how all three work.

![Three ways to use a callout](https://github.com/user-attachments/assets/3cf88262-184d-42e6-b810-d43889629afb)

## Block Callout

This is Obsidian's own original callout syntax: a blockquote whose first line carries the callout token.

```
> [!note]
> Your content goes here.
```

If you've used callouts in Obsidian before, this is the form you already know.

## Heading Callout

Put the token right after the heading marks, and the whole heading turns into a colored, foldable bar:

```
## [!note] My heading title
```

Everything after the token becomes the title, just as it would in a normal heading. You get a callout-styled section header without wrapping the section in a blockquote.

## Inline Callout

Drop the token in the middle of a sentence to get a small colored pill, without breaking the paragraph:

```
Remember to check the settings [!note] before you continue.
```

The pill sits inline with your text, so you can flag a word or phrase without interrupting the flow of a paragraph.

### Giving the pill its own text

Add text in curly braces straight after the token, and it goes **inside** the pill:

```
Want an [!note]{Inline Callout}? Just add [!type]{text} right in a sentence.
```

The `{` must touch the `]`. With a space, `[!note] {text}` becomes an ordinary pill followed by the literal text ` {text}`. Braces can be nested, so `{a {b} c}` is treated as one piece of text.

Curly braces do not support backslash escapes. If you need a literal brace after a pill, put it in backticks. Inline code is ignored when Callout Studio determines the pill text.

To show a token as literal text, escape its opening bracket: `\[!note]` or `\[!note]{literal text}`. Reading view preserves that escape for both ordinary pills and pills with their own text.

## The same look everywhere

All three forms render consistently in Live Preview, Reading view, and PDF exports.

## Metadata and callout type

Obsidian lets you attach metadata to a callout after a pipe character, for example `> [!note|purple]`. That's the **note** callout carrying the metadata **purple**, which themes and CSS snippets can use to style it separately.

Callout Studio ignores metadata when identifying the callout type. As a result, `[!note]`, `[!note|purple]`, and `[!note|green]` all refer to the same **Note** callout and share one row in your callout list. Block, Heading, and Inline callouts can all carry metadata this way.

---
**Next:** [Creating your first callout](02-creating-your-first-callout.md)
