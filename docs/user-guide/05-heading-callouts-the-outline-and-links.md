# Heading callouts, the Outline, and links

A Heading Callout is still a completely real Obsidian heading underneath its colored bar. Turning a heading into a callout does not cost you anything about how that heading behaves elsewhere in Obsidian - it keeps working in the Outline pane and in links exactly as it always did.

## It's your heading, styled

When you write something like `## [!tip] My title`, you are not creating a special separate object - you are writing a normal Obsidian heading and giving it a callout style. Everywhere else in Obsidian, it is simply a heading with that title.

## It still shows up in the Outline

Because a Heading Callout is a real heading, it appears in Obsidian's Outline pane on the right side of the window, exactly like any other heading in your note. Callout Studio automatically keeps the raw `[!tip]` token out of the Outline - what you see there is your clean heading title, never the plugin's own bracket syntax.

## It still works with links

Other notes can link to a Heading Callout the same way they'd link to any heading, using a normal `[[#heading]]` style link. When Obsidian shows you the popup of matching headings while you type that kind of link, it displays the same clean title instead of the raw token - so the link suggestion reads like an ordinary heading, not like plugin markup.

## Headings that start with a link are left alone

If a heading begins with a normal markdown link, such as `# [some link](url)`, Callout Studio correctly recognizes that this is not a callout token and leaves the heading untouched.

## The takeaway

Outside of the note itself - where it renders as a colored bar - a Heading Callout reads like an ordinary heading everywhere in Obsidian: in the Outline pane, and in every link suggestion pointing to it. You get the callout's styling in the note without losing anything about how the heading behaves elsewhere.

---
**Next:** [The right-click menu](06-the-right-click-menu.md)
