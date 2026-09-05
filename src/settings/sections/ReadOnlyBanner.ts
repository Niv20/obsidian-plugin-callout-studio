/**
 * settings/sections/ReadOnlyBanner.ts — saying, where it cannot be missed, that
 * this session is not writing anything.
 *
 * A frozen session is the strangest state this plugin has. Everything still
 * works: callouts render, the editor opens, a colour picked in it repaints the
 * note behind the modal. Nothing reaches disk. The freeze is announced by a
 * `Notice` at launch (`manager/settingsNotices.ts`), and a `Notice` is exactly
 * the wrong surface to carry a fact that stays true for hours — it appears
 * before the user has looked at the screen, it is dismissed by clicking
 * anywhere near it, and it is gone by the time they open the settings tab and
 * start making changes that will not survive.
 *
 * So the settings page says it too, at the top, for as long as it is true. This
 * is the surface the user is on at the exact moment it matters.
 *
 * Rendered rather than kept: `display()` runs again whenever the state that
 * would clear a freeze changes — an adoption re-renders the tab — so the banner
 * appears and disappears on its own without anything subscribing.
 */
import { t } from "../../i18n";
import type { SettingsSectionContext } from "./types";

/** Draw the banner if this session has gone read-only, and nothing otherwise. */
export function renderReadOnlyBanner(
	ctx: SettingsSectionContext,
	containerEl: HTMLElement,
): void {
	if (!ctx.plugin.settingsWriter.isFrozen) return;
	const banner = containerEl.createDiv({ cls: "cs-readonly-banner" });
	banner.createEl("p", { text: t("settings.readOnly") });
}
