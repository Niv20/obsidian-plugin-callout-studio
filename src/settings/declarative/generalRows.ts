/**
 * settings/declarative/generalRows.ts — the plugin-wide parts of the main
 * page: the Default fallback callout row, the guarded choice the footer's
 * globe makes for the language, and Use your theme's callout styles.
 *
 * Who calls it. The settings tab, when it builds the main page: the fallback
 * row goes in the first box (settingsTree.ts), and the footer draws the globe
 * (footerGroup.ts).
 *
 * The main idea. The controls themselves are drawn by sections/fallbackPicker.ts
 * and sections/languagePicker.ts; this module puts them in rows:
 * - The fallback row's `disabled` greys it while saving is paused, and every
 *   callback that changes something is also guarded (pausedGuards.ts), since
 *   `disabled` alone does not stop a list that is already open.
 * - The fallback picker is kept across redraws (persistentParts.ts): it holds
 *   its list and a listener on the document, and has no reason to be rebuilt.
 * - The language has no row of its own: it is the globe in the footer. A
 *   language that has to be downloaded is told in notices
 *   (sections/languagePicker.ts), not in a row that would appear mid-switch.
 * - The theme's styles switch is a plain control row: Obsidian draws the
 *   toggle, and the tab saves it (controlBinding.ts).
 */
import { t } from "../../i18n";
import type { CalloutCombobox } from "../calloutCombobox";
import {
	addFallbackReset,
	createFallbackPicker,
	setFallbackCallout,
} from "../sections/fallbackPicker";
import { applyLanguagePreference } from "../sections/languagePicker";
import { partitionCallouts, themeStylesSwitchedOff } from "../sections/rowOwnership";
import { disabledWhilePaused, refuseWhilePaused } from "./pausedGuards";
import type { PersistentPart } from "./persistentParts";
import { addControlComponent } from "./rowParts";
import { guardRender } from "./safeTree";
import type { CsControl, CsRender, TreeContext } from "./types";

/** The rows' ids: they key the rows, so they never change. */
export const GENERAL_ROWS = {
	fallback: "fallback-callout",
	themeStyles: "theme-callout-styles",
} as const;

/** Where the theme's styles switch saves, as a dotted path into the settings. */
const THEME_STYLES_KEY = "themeCalloutStyles.enabled";

/* ---- Default fallback callout ---- */

/** The name the fallback picker is kept under in the parts store. */
const FALLBACK_PICKER = "fallback-picker";

/** The kept picker: its element, the picker itself, and how to take it down. */
interface FallbackPickerPart extends PersistentPart {
	picker: CalloutCombobox;
}

/** Default fallback callout: the callout picker, and ↺ back to the default. */
export function fallbackRow(ctx: TreeContext): CsRender {
	return {
		id: GENERAL_ROWS.fallback,
		name: t("settings.fallbackCallout"),
		desc: t("settings.fallbackCalloutDesc"),
		disabled: disabledWhilePaused(ctx.plugin.settingsWriter),
		render: guardRender("fallback callout", (setting) => {
			setting.setClass("cs-reset-setting");
			const { picker } = ctx.parts.mount(FALLBACK_PICKER, setting.controlEl, (parent) => buildFallbackPicker(ctx, parent));
			// Another device's settings may have changed it since the last draw.
			picker.setValue(ctx.plugin.settings.fallbackCalloutId);
			addControlComponent(setting, picker);
			addFallbackReset(setting, ctx.plugin, picker);
			return () => ctx.parts.releaseLater(FALLBACK_PICKER);
		}),
	};
}

/** Build the picker once, into the row's controls; every draw puts it back there. */
function buildFallbackPicker(ctx: TreeContext, parent: HTMLElement): FallbackPickerPart {
	const pick = (id: string): void => {
		void setFallbackCallout(ctx.plugin, id);
		// Drawn again for the reset arrow, which shows once another fallback is chosen.
		ctx.redraw();
	};
	// Refused while paused; the redraw then puts the saved fallback back.
	const onChange = refuseWhilePaused(ctx.plugin.settingsWriter, pick, () => ctx.redraw());
	const picker = createFallbackPicker(ctx.plugin, parent, onChange);
	return { el: picker.el, picker, dispose: () => picker.destroy() };
}

/* ---- Language ---- */

/**
 * What the footer's globe does with a pick: save the language and bring the
 * page to it, downloading it first when this device does not have it. While
 * saving is paused it only says why (the page is drawn again, so the globe's
 * menu shows the saved language).
 */
export function languageChooser(ctx: TreeContext): (pref: string) => void {
	const plugin = ctx.plugin;
	return refuseWhilePaused(
		plugin.settingsWriter,
		(pref: string) => { void applyLanguagePreference(plugin, pref, () => ctx.redraw()); },
		() => ctx.redraw(),
	);
}

/* ---- Use your theme's callout styles ---- */

/**
 * The switch that turns the active theme's callout styles off
 * (manager/theme/themeCalloutsOff.ts). On the main page, below the row that
 * opens the theme's callouts: that page is drawn by the plugin, so a row on it
 * would not be found by the settings search.
 *
 * Shown while the theme's section is: while the theme styles any callout,
 * and while the switch is off (it took the rows away and must stay to bring
 * them back).
 */
export function themeStylesRow(ctx: TreeContext): CsControl {
	return {
		id: GENERAL_ROWS.themeStyles,
		name: t("settings.themeCalloutStyles"),
		desc: t("settings.themeCalloutStylesDesc"),
		visible: () => partitionCallouts(ctx).fromTheme.length > 0 || themeStylesSwitchedOff(ctx),
		control: {
			type: "toggle",
			key: THEME_STYLES_KEY,
			disabled: disabledWhilePaused(ctx.plugin.settingsWriter),
		},
	};
}
