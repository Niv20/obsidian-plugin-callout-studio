import { renderSaveStatusBanner } from "../saveStatusBanner";
import { SettingsRecoveryModal } from "../SettingsRecoveryModal";
import type { SettingsSectionContext } from "./types";

/** Recovery stays accessible even after the startup notice is dismissed. */
export function renderReadOnlyBanner(ctx: SettingsSectionContext, containerEl: HTMLElement): void {
	const recovery = ctx.plugin.recovery;
	ctx.registerDisposer(renderSaveStatusBanner(ctx.plugin, containerEl, {
		retry: ctx.plugin.retrySettingsRecovery ? () => ctx.plugin.retrySettingsRecovery!() : undefined,
		startFresh: ctx.plugin.startFreshSettings ? () => ctx.plugin.startFreshSettings!() : undefined,
		diagnose: recovery ? () => recovery.diagnose() : undefined,
		replaceUnreadable: recovery ? () => recovery.replaceUnreadable() : undefined,
		discardRecoveryCopy: recovery ? () => recovery.discardRecoveryCopy() : undefined,
		openRecovery: recovery ? () => new SettingsRecoveryModal(ctx.app, ctx.plugin).open() : undefined,
		pausedNote: true,
	}));
}
