# Three ways to use a callout

Welcome to Callout Studio. Every callout type you create or customize can show up in your notes in three different forms — Block Callout, Heading Callout, and Inline Callout — and each one has its own vault-wide style controls. This chapter introduces all three, since they're the foundation everything else in this guide builds on.

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

Everything after the token becomes the heading's own title text, exactly like a normal heading. This lets you turn any heading in your note into a callout-styled section header without wrapping content in a blockquote.

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

The `{` has to touch the `]` — `[!note] {text}` with a space is an ordinary pill followed by the literal words ` {text}`. Braces nest, so `{a {b} c}` is one piece of text, and the first `}` that closes the outer brace ends it.

There's no backslash escape. If you need a literal brace right after a pill, put it in backticks — inline code is ignored when the pill's text is worked out.

## The same look everywhere

All three forms render the same way in Live Preview, Reading view, and PDF export — so however you choose to write a callout, it will look consistent no matter how your note is viewed or exported.

## Metadata and callout type

Obsidian lets you attach metadata to a callout after a pipe character, for example `> [!note|purple]`. That's the **note** callout carrying the metadata **purple**, which themes and CSS snippets can use to style it separately.

Callout Studio ignores that metadata when deciding which callout type you meant. That means `[!note]`, `[!note|purple]`, and `[!note|green]` are all treated as the same single **Note** callout type, with just one row in your callout list. This holds true across all three forms — Block, Heading, and Inline callouts can all carry metadata this way.

---
**Next:** [Creating your first callout](02-creating-your-first-callout.md)
