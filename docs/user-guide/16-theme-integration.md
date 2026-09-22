# Theme integration

Callout Studio is designed to work with the active Obsidian theme without fighting its styles.

## Callouts from your theme

Some themes define their own callout types or restyle Obsidian's built-in types. Callout Studio detects them automatically and lists them under **Callouts from your theme**.

If the theme styles a callout, the theme stays in complete control. Callout Studio does not override the theme's intended color, icon, border, or layout.

## Read-only theme callouts

Because the theme draws these callouts, their rows are read-only in Callout Studio. Click the eye icon to preview one; vault actions remain available from its three-dot menu, but you will not see Callout Studio's normal color picker or customization controls.

To change a theme-owned callout, use the community **Style Settings** plugin if the theme author provides a setting for it. Otherwise, the theme's CSS must be changed.

## Block format only

Theme-controlled callouts support the standard Block format:

```md
> [!theme-callout]
> Content
```

Heading and Inline callouts are Callout Studio features, so they are unavailable for a type that exists only in the theme. Create a callout with a different ID if you want your own design in all three formats.

Switching themes updates the **Callouts from your theme** list without changing note content.

---
**Next:** [Back to the guide overview](README.md)
