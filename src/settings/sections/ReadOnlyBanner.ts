import { renderSaveStatusBanner } from "../saveStatusBanner";
import type { SettingsSectionContext } from "./types";

/** Recovery stays accessible even after the startup notice is dismissed. */
export function renderReadOnlyBanner(ctx: SettingsSectionContext, containerEl: HTMLElement): void {
	ctx.registerDisposer(renderSaveStatusBanner(ctx.plugin, containerEl, {
		retry: ctx.plugin.retrySettingsRecovery ? () => ctx.plugin.retrySettingsRecovery!() : undefined,
		startFresh: ctx.plugin.startFreshSettings ? () => ctx.plugin.startFreshSettings!() : undefined,
	}));
}
