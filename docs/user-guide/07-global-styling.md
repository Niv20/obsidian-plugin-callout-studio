# Global styling

Global styling gives every Callout Studio callout a consistent shape and layout. Open the plugin settings and find **Global settings**. Changes apply immediately across the vault.

![Global callout style](https://github.com/user-attachments/assets/7558c077-1396-43de-9715-6538b4ca8297)

Each callout format has its own controls, so changing one format does not force the others to use the same geometry.

## Heading callouts

For heading callouts, you can:

- Show borders on selected sides.
- Set the exact border thickness.
- Adjust vertical padding and the spacing between headings.
- Control corner rounding and related heading geometry.

## Inline callouts

For inline callouts, you can:

- Scale the pill text independently of the rest of the note.
- Adjust corner rounding up to 25px to keep the pill rounded at larger text sizes.
- Choose border sides and thickness.

The icon and spacing scale with the pill text. At every inline text scale, the
entire pill stays centered vertically in the surrounding line instead of
shrinking toward the text baseline.

The Inline preview shows an **Example** pill between two Lorem ipsum
sentences. Click **Example** to reveal its `[!global-style-demo]{Example}`
syntax in the preview editor.

## Block callouts

Block callouts include the broadest set of controls:

- Border sides, thickness, and corner rounding.
- Separate title and content scale.
- **Align content with title**, which starts the content text at the same inline edge as the title text, in both left-to-right and right-to-left layouts. The spacing follows the icon's width, including wider images.

These settings shape callouts drawn by Callout Studio. If your active theme owns a callout, the theme keeps control of its appearance; see [Theme integration](16-theme-integration.md).

---
**Next:** [The right-click menu](08-the-right-click-menu.md)
