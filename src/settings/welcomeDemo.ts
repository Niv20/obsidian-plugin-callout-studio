/**
 * settings/welcomeDemo.ts — The callout the welcome splash demonstrates itself
 * with.
 *
 * The splash shows all three render roles at once, and it used to show them
 * with three real built-ins: `tip`, `warning` and `note`. That is exactly the
 * set a theme restyles by name, and the plugin hands an *unmodified* built-in
 * straight to Obsidian's own `--callout-tip` variable rather than a hex (see
 * `manager/accentDeclarations.ts`), so a theme won outright — on some themes
 * the heading and inline examples were unreadable, and on all of them the
 * splash advertised the theme's colours rather than the plugin's.
 *
 * So the splash registers its own definition into the registry's transient
 * preview slot under an id of its own, `WELCOME_DEMO_ID`. No theme has a rule
 * for an id it has never heard of, which removes the by-name attack;
 * `styles.css` then pins the result inside `.cs-welcome-modal` against a
 * theme's *generic* callout selectors, which is the half an id change cannot
 * fix.
 *
 * That id is `demo` and is **not** in `RESERVED_DEMO_IDS`, unlike the one the
 * per-role style popups use — the splash sample is copy a user reads, so it is
 * spelled the way a person would write it, and the constant's own comment has
 * the trade that buys.
 *
 * The definition is still never persisted, never listed and never exported:
 * `setPreviewDefinition`'s `isDemo` flag covers all three, and it only exists
 * while this modal is open.
 */
import { PLUGIN_ICON_ID, WELCOME_DEMO_ID } from "../constants";
import { t } from "../i18n";
import type { CalloutDefinition } from "../types";

/**
 * The splash's violet, one shade per theme mode.
 *
 * Two shades rather than one because the demo has to stay legible against both
 * `--background-primary` extremes, and a single mid-violet fails one of them:
 * the light value is dark enough to read as text on white, the dark value light
 * enough to read on near-black, and both clear 4.5:1 against the surface the
 * modal actually paints on. The plugin's tint maths (`utils/colorUtils.ts`)
 * derives the translucent background from whichever one is live, so only the
 * accent needs stating.
 */
export const WELCOME_DEMO_LIGHT = "#7C3AED";
export const WELCOME_DEMO_DARK = "#A78BFA";

/**
 * The splash's demo definition.
 *
 * Deliberately shaped like `GlobalStyleModal.buildDemoDefinition()` — same
 * "not a real row" fields — and different in three places: its own id, the
 * colour (violet, not the popups' neutral gray) and the icon (the plugin's own
 * `PLUGIN_ICON_ID`, not the popups' solid square).
 *
 * `foldable: false` because a splash that can be collapsed into a bare header
 * has stopped demonstrating anything.
 */
export function buildWelcomeDemoDefinition(): CalloutDefinition {
	return {
		id: WELCOME_DEMO_ID,
		displayName: t("welcome.demoName"),
		icon: { type: "lucide", value: PLUGIN_ICON_ID },
		colorLight: WELCOME_DEMO_LIGHT,
		colorDark: WELCOME_DEMO_DARK,
		foldable: false,
		defaultFolded: false,
		builtIn: false,
		source: "user",
		aliases: [],
	};
}
