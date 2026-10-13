# Theme integration

Callout Studio is designed to work with the active Obsidian theme without fighting its styles.

## Callouts from your theme

Some themes define their own callout types or restyle Obsidian's built-in types. Callout Studio detects them automatically and lists them under **Callouts from your theme**.

A built-in callout, or one you made, moves here only while the theme actually changes how it looks. A theme rule that changes nothing you can see - one behind a theme option that is off, or one that repeats Obsidian's own look - does not count, and Callout Studio keeps drawing that callout with your design. Turn such an option on in **Style Settings** and the callout moves here straight away; turn it off and it comes back. When Callout Studio can't check a theme rule from where it measures - one that applies only in notes with a certain `cssclasses` value, in embeds, on hover or on narrow windows - the callout stays with your theme, as it did before this check existed.

Callout types the theme adds are listed while the theme provides them. When the theme keeps a whole family of them behind one of its own options (Retroma's retro callouts, for example), they are listed only while that option is on.

Quick Insert gives the same rows their own source filter, labelled with the active theme's name (or **Theme callouts** when no name is available). This includes built-in and saved callouts that the theme restyles, not only new types invented by the theme. The filter is omitted when the active theme owns no available callouts.

If the theme styles a callout, the theme stays in complete control. Callout Studio does not override the theme's intended color, icon, border, or layout.

![Read-only callout rows detected from AnuPpuccin in dark Mocha mode.](../../assets/user-guide/theme-callouts.svg)

*The theme's callout rows are detected from its stylesheet. This example uses AnuPpuccin in dark Mocha mode.*

Older versions included a setting that let an individual callout yield to external CSS. That option has been removed: theme and snippet CSS already participate in Obsidian's normal cascade, and keeping a separate Callout Studio setting for the same job proved redundant and not useful in practice.

## Callout Studio's own windows

In light mode with Obsidian's **Default** theme, Callout Studio's windows - its settings, the callout editor, the pickers and the other dialogs - use their own light colors: white text boxes, dropdowns and lists with a soft outline that darkens when you point at or click one, white buttons, and a pale tint of your accent color on the chosen row. The colors are the same on macOS, Windows, Linux and phones. (Without this, macOS paints Obsidian's light-mode controls as flat grey slabs.)

If you choose a community theme under **Settings → Appearance → Themes**, the theme takes command instead: the windows follow its own button, text-box and border colors, just as they did before. Dark mode is not affected either way. Switching theme or color scheme updates open windows immediately; nothing needs to be reloaded.

![The Callout Studio editor with AnuPpuccin's dark controls and live previews.](../../assets/user-guide/theme-editor.svg)

*The editor follows AnuPpuccin's dark controls inside a window with a scrolling body.*

## Your callouts in a theme's callout layout

Callouts you create in Callout Studio follow the layout your theme gives callouts in general. When a theme or one of its **Style Settings** options draws callouts with a neutral body and the color on a title bar (for example AnuPpuccin's **Sleek** callout style), your callout's background - solid or gradient - moves to that title bar too, and a transparent callout shows no background anywhere. Switching the option in Style Settings updates open notes immediately; nothing needs to be reloaded. See [Background styles](03-custom-color-palettes.md#background-styles).

![A custom Project callout and a theme-owned Tip in AnuPpuccin's Sleek layout.](../../assets/user-guide/theme-layout.svg)

*Sleek places the custom callout's background on its title bar and keeps a neutral body.*

## Read-only theme callouts

Because the theme draws these callouts, their rows are read-only in Callout Studio. Click the eye icon to preview one; vault actions - **Replace in vault** and **Convert uses to plain text** - remain available from its three-dot menu, but you will not see Callout Studio's normal color picker or customization controls.

If the theme restyles a custom callout you saved in Callout Studio, its menu also offers **Duplicate**. This copies your saved style under a new ID; its appearance may differ from the theme's styling of the original ID. Callouts supplied only by the theme cannot be duplicated.

To change a theme-owned callout, use the community **Style Settings** plugin if the theme author provides a setting for it. Otherwise, the theme's CSS must be changed.

## When your theme uses only some of a callout's names

A callout can have several IDs, for example `[!описание]`, `[!вид]` and `[!description]`. If your theme defines only some of them, the callout stays yours. It stays in your own list and you can still edit it. Block callouts written with a name your theme defines look the way the theme draws them; every other name keeps your design. Heading and Inline callouts keep your design under every name, because themes don't style those formats. When you open such a callout in the editor, a note under **Callout IDs** lists the names your theme draws, and for a built-in callout also the extra names Obsidian keeps drawing itself. Blocks written with those names follow the theme whatever you set here; if you want your design there too, write those blocks with one of your other IDs.

Built-in callouts work the same way, with one difference: Obsidian's own extra names for a built-in, such as `[!cite]` for Quote or `[!tldr]` for Abstract, don't count. A theme that restyles `[!quote]` takes the whole Quote callout even if it never mentions `[!cite]`, and Obsidian keeps drawing `[!cite]` as it always has. That stays true if you add an ID of your own to Quote: your ID uses your design, and `[!quote]` and `[!cite]` look as they did.

## If a callout moved after an update

Callout Studio checks whether your theme really draws each built-in callout, and each callout you made, that its stylesheet mentions. After updating to a version with this check you may notice:

- **A callout left Callouts from your theme for your own list.** Your theme mentions it without changing how it looks, or only behind an option that is off. Callout Studio now draws it with your design, including changes you saved for it earlier that had no effect while the theme held it. To hand it back, turn the option on in **Style Settings**.
- **A callout with several IDs stayed in your list although your theme styles one of them.** See [When your theme uses only some of a callout's names](#when-your-theme-uses-only-some-of-a-callouts-names).
- **A theme type written in capital letters disappeared from Callouts from your theme.** Obsidian writes callout types in lower case, so a theme rule such as `[data-callout="I"]` never matched a note. Notes using that type are now treated like any other type Callout Studio doesn't know (see [Default fallback](#default-fallback)).
- **One change of look at the first start.** The check runs once after Obsidian starts and then remembers its answer on this device for the themes you use, so a callout may change look once, at the first start after the update or after switching to a theme for the first time.

## Default fallback

A callout type that exists only in the active theme cannot be selected as the **Default fallback callout**. Use a built-in type or create a Callout Studio callout with an ID the theme does not define if you need a fallback that remains available after switching themes.

## Block format only

Theme-controlled callouts support the standard Block format:

```md
> [!theme-callout]
> Content
```

Heading and Inline callouts are Callout Studio features, so they are unavailable for a type that exists only in the theme. Create a callout with a different ID if you want your own design in all three formats.

Switching themes updates the **Callouts from your theme** list and makes Quick Insert's theme filter appear, disappear, or change its label as needed, without changing note content.

---
**Next:** [Callout metadata](18-callout-metadata.md)
