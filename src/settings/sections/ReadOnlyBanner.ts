import { recoveryActionsOf, renderSaveStatusBanner } from "../saveStatusBanner";
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
	const backup = backupTarget ? createTargetHighlighter(backupTarget) : null;
	if (backup) ctx.registerDisposer(backup.dispose);
	ctx.registerDisposer(renderSaveStatusBanner(ctx.plugin, containerEl, {
		...recoveryActionsOf(ctx.plugin),
		showBackup: backup ? (fromKeyboard) => { backup.run(fromKeyboard); } : undefined,
	}));
}
