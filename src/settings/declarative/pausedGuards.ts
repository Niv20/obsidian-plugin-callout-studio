/**
 * settings/declarative/pausedGuards.ts — keeping the settings page read-only
 * while saving is paused.
 *
 * Who calls it. Every part of the settings tree with a row or a list the user
 * can change.
 *
 * The main idea. While saving is paused, a change would live only in memory
 * and vanish when Obsidian closes, so the page takes none (settings/pausedGuard.ts).
 * Obsidian offers `disabled` for that, but it only changes how a row looks:
 * a list's drag handle, the Delete key and Alt+↑/↓ still reach their callbacks.
 * So both are used:
 *
 * - {@link disabledWhilePaused} as the row's `disabled`, for the look;
 * - {@link refuseWhilePaused} around every callback that changes something,
 *   which tells the user why and does nothing else.
 */
import { blockedWhilePaused } from "../pausedGuard";

/** The part of the settings writer these guards read. */
export interface PauseState {
	isFrozen: boolean;
}

/** A row's `disabled` predicate: true while saving is paused. */
export function disabledWhilePaused(writer: PauseState): () => boolean {
	return () => writer.isFrozen;
}

/**
 * Wrap `callback` so that, while saving is paused, it only explains why and
 * changes nothing.
 *
 * (`Args extends unknown[]` is a "generic": whatever arguments the callback
 * takes, the wrapper takes the same ones, so it fits `onDelete(index)` and
 * `onReorder(from, to)` alike.)
 *
 * @param putBack Run when a change is refused, to undo what is already on
 *   screen: by the time `onReorder` is called after a pointer drag, Obsidian
 *   has already moved the row, so the page must be drawn again.
 */
export function refuseWhilePaused<Args extends unknown[]>(
	writer: PauseState,
	callback: (...args: Args) => void,
	putBack?: () => void,
): (...args: Args) => void {
	return (...args) => {
		if (blockedWhilePaused(writer)) {
			putBack?.();
			return;
		}
		callback(...args);
	};
}
