/**
 * scripts/user-guide/settingsPageLayout.mjs — the CSS that sizes the settings
 * window settingsPage.mjs draws a scene in.
 *
 * Who calls it. Every renderer whose scenes show a settings page: the user
 * guide's (render-user-guide.mjs) and the store's (render-store-*.mjs).
 *
 * The main idea. The frame is Obsidian's settings window, `.modal.mod-settings`,
 * which app.css sizes like any dialog: 560px wide, and at most 80% of a phone's
 * screen. That is narrower than any picture wants, and narrow enough to change
 * what is drawn (a callout row under 450px hides its colour dots, as it does
 * in a narrow tab). So each renderer gives the frame the size of its own
 * picture, and the rest is the same for all of them: the page fills the frame,
 * the main page keeps Obsidian's top and bottom padding, and a sub-page starts
 * at its title bar.
 */

/**
 * The frame's CSS for one renderer.
 *
 * - `width`: the window's width in pixels.
 * - `height`: a fixed height in pixels (the page scrolls inside it), or
 *   `"auto"` to fit the page.
 */
export function settingsPageCss({ width, height = "auto" }) {
	const frameHeight = typeof height === "number" ? `${height}px` : height;
	return `
.guide-settings-page { width:${width}px; max-width:none; height:${frameHeight}; display:flex; flex-direction:column; }
.guide-settings-page .modal-content { display:flex; flex:1 1 auto; min-height:0; padding:0; }
.guide-settings-page .vertical-tab-content-container { display:flex; flex:1 1 auto; min-height:0; }
.guide-settings-page .vertical-tab-content { flex:1 1 auto; height:auto; padding-top:var(--size-4-8); padding-bottom:var(--size-4-8); }
.guide-settings-page .setting-page.vertical-tab-content { padding-top:0; }
`;
}
