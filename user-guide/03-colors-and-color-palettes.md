# Colors and color palettes

Every callout type in Callout Studio can look exactly the way you want in both light and dark mode, without any manual switching. Whether you pick a single color or build a whole reusable palette, Callout Studio takes care of contrast and theme-following for you.

## Light and dark colors, automatically

Each callout has a separate **Light color** and **Dark color**. Callout Studio automatically follows Obsidian's current theme, so whichever one matches your active appearance is used without you doing anything - switch your vault from light to dark and your callouts switch with it.

![Per-mode colors](https://github.com/user-attachments/assets/8a37477c-2323-4464-9494-f3ed35e56f18)

## Choosing a color

When you open the color picker for a callout type, you'll find ready-made presets to choose from:

- **Obsidian's original callout palette** - the classic colors you already know from Obsidian's built-in callouts.
- **Extra curated presets** - additional colors curated by Callout Studio for more variety.

Pick any preset and it's applied instantly to the callout type you're editing.

## Building your own custom palettes

If you want a color scheme you can reuse across multiple callout types, create your own palette from **Settings → Saved color palettes**. Once saved, your palette appears in the color dropdown on any callout, right alongside the built-in presets.

The **Saved color palettes** heading works exactly like the callout lists above it in the settings tab: it shows your total palette count in parentheses, folds shut when you click it (or reach it with `Tab` and press `Enter` or `Space`) — remembered across a settings-tab reopen and a plugin reload — and, past twenty saved palettes, shows the first twenty with a **Load more** button that reveals the rest in one click. It also stays with you while you scroll: reach a long palette list and the heading stops at the top of the settings pane so you can always see which group you're in, then scrolls away with its own last row once you're past it. (On iPhone it scrolls normally, the same as the callout list headings.)

As in the callout editor, a **new** palette opens with the cursor already in its **Name** field — ready to type, with the window held still while a phone keyboard opens. Reopening a saved palette to change its colors leaves the cursor alone.

You can build a palette in two ways:

### Simple mode

In **Simple** mode, you choose one base color and Callout Studio automatically derives matching light and dark backgrounds and accents for you. It also auto-corrects contrast so your callout text stays readable in both modes - no extra work required.

### Advanced mode

In **Advanced** mode, you fine-tune all four colors by hand:

- Light accent
- Dark accent
- Light background
- Dark background

As you adjust each one, live contrast warnings let you know if a combination would be hard to read, so you can catch readability issues before you save.

## Palettes and your existing callouts are independent

When you pick a saved palette for a callout, its colors are copied onto that callout right away. This means editing or deleting a palette later never changes callouts you already colored with it - your callouts keep the colors they were given the moment you applied the palette, and are never left dangling if you touch the palette afterward.

---
**Next:** [Global callout style](04-global-callout-style.md)
