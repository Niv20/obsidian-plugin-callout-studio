/**
 * settings/pausedGuard.ts — refuse a change that could not be kept.
 *
 * While saving is paused, a settings change lives only in memory: closing
 * Obsidian (or iOS closing it in the background) discards it. That is tolerable
 * for a colour tweak and not for an action that also rewrites notes, deletes a
 * setup or imports one — those would half-happen, or look done and vanish. The
 * callout editor's Save already refuses; the other destructive actions ask here.
 */
import { Notice } from "obsidian";
import { t } from "../i18n";

/** True, after telling the user why, when saving is paused. */
export function blockedWhilePaused(writer: { isFrozen: boolean }): boolean {
	if (!writer.isFrozen) return false;
	new Notice(t("notice.blockedWhilePaused"), 10000);
	return true;
}
