# Heading callouts, the Outline, and links

A Heading Callout is a regular Obsidian heading with a callout style. It still appears in the Outline pane and works in links like any other heading.

## It's your heading, styled

When you write `## [!tip] My title`, Callout Studio styles a normal Obsidian heading. Elsewhere in Obsidian, its title remains simply **My title**.

## It still shows up in the Outline

Heading Callouts appear in Obsidian's Outline pane. Callout Studio hides the raw `[!tip]` token there, so the Outline shows only the heading title.

## It still works with links

Link to a Heading Callout with the usual `[[#heading]]` syntax. Obsidian's link suggestions show the clean title without the raw callout token.

## Headings that start with a link are left alone

If a heading begins with a normal markdown link, such as `# [some link](url)`, Callout Studio correctly recognizes that this is not a callout token and leaves the heading untouched.

## The takeaway

In the note, a Heading Callout appears as a colored bar. In the Outline and link suggestions, it behaves and reads like an ordinary heading.

---
**Next:** [The right-click menu](06-the-right-click-menu.md)
