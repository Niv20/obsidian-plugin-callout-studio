import { renderSaveStatusBanner } from "../saveStatusBanner";
import { createTargetHighlighter } from "../targetHighlighter";
import type { SettingsSectionContext } from "./types";

/**
 * Recovery stays accessible even after the startup notice is dismissed.
 *
 * `backupTarget` is the Backup section's **Earlier setups** row, or `null` on a
 * host without recovery. **Go to backups** scrolls there and highlights it, the
 * same way the import prompt takes the reader to Import, instead of opening the
 * earlier-setups window on top of the banner: while saving is paused that
 * window can only be browsed, and the banner is what says why.
 */
export function renderReadOnlyBanner(
	ctx: SettingsSectionContext,
	containerEl: HTMLElement,
	backupTarget: HTMLElement | null,
): void {
	const recovery = ctx.plugin.recovery;
	const backup = backupTarget ? createTargetHighlighter(backupTarget) : null;
	if (backup) ctx.registerDisposer(backup.dispose);
	ctx.registerDisposer(renderSaveStatusBanner(ctx.plugin, containerEl, {
		retry: ctx.plugin.retrySettingsRecovery ? () => ctx.plugin.retrySettingsRecovery!() : undefined,
		startFresh: ctx.plugin.startFreshSettings ? () => ctx.plugin.startFreshSettings!() : undefined,
		diagnose: recovery ? () => recovery.diagnose() : undefined,
		replaceUnreadable: recovery ? () => recovery.replaceUnreadable() : undefined,
		discardRecoveryCopy: recovery ? () => recovery.discardRecoveryCopy() : undefined,
		showBackup: backup ? (fromKeyboard) => { backup.run(fromKeyboard); } : undefined,
		pausedNote: true,
	}));
}
