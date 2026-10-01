/**
 * manager/theme/defaultThemeClass.ts — `cs-default-theme` on `<body>`, for as
 * long as Obsidian's Default theme is the one in use.
 *
 * The plugin's windows wear their own light palette (see "The light palette" in
 * `styles.css`), and a community theme outranks it: a theme that has been
 * installed on purpose is the user's statement about how every window should
 * look, and ours must not paint over it. The palette therefore applies only
 * while the Default theme is active.
 *
 * That one fact is not something CSS can ask. Obsidian marks the colour scheme
 * on `<body>` (`theme-light` / `theme-dark`) but never the community theme: a
 * theme is a name inside `app.customCss` plus a `<style>` element, and neither
 * is a selector. So the plugin mirrors the fact as a class, and the palette's
 * one gate is written against it.
 *
 * **The class is the positive statement, on purpose.** It is present when the
 * Default theme is *known* to be in use and absent otherwise — including when
 * `app.customCss` is missing or has been renamed (see `usesDefaultTheme`). If
 * this module never ran, or Obsidian changed the field, the failure is the
 * windows keeping the look they had before the palette existed, not the plugin
 * painting over a theme it could not see.
 *
 * Only the main window's `<body>` is touched. Obsidian copies the main body's
 * classes onto every pop-out window's own `<body>` and keeps them in step, so
 * the palette follows the theme into a pop-out without a second listener.
 *
 * `css-change` is the right moment: Obsidian writes `customCss.theme` first and
 * triggers the event only once the new theme's CSS is in place, so the name read
 * in the handler is already the new one.
 */
import type { App, EventRef } from "obsidian";
import { usesDefaultTheme } from "./customCssApi";

/** The `<body>` class the light palette is gated on. */
export const DEFAULT_THEME_CLASS = "cs-default-theme";

export interface DefaultThemeHost {
	app: App;
	registerEvent(ref: EventRef): void;
	register(cb: () => void): void;
}

/** Keep `cs-default-theme` on `<body>` in step with the active theme. */
export function registerDefaultThemeClass(host: DefaultThemeHost): void {
	// The main renderer document, the same way `CSSInjector` finds it — not
	// `activeDocument`, which is whichever window has focus and may be a pop-out
	// whose classes Obsidian is about to overwrite from the main body.
	const body = host.app.workspace.containerEl.ownerDocument.body;
	const sync = (): void => {
		body.toggleClass(DEFAULT_THEME_CLASS, usesDefaultTheme(host.app));
	};

	sync();
	host.registerEvent(host.app.workspace.on("css-change", sync));
	host.register(() => body.removeClass(DEFAULT_THEME_CLASS));
}
