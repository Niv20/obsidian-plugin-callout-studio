/**
 * settings/sections/pausedReadOnly.ts — a settings page that cannot save does
 * not take edits.
 *
 * While saving is paused, a change lives only in memory. The page used to
 * accept one anyway: it looked applied, one notice per pause said it was not
 * saved, and closing Obsidian (or iOS closing it in the background) discarded
 * it. Now everything that would change a setting is `inert`: not clickable,
 * not focusable, not typeable, and faded to say so. What stays usable is what
 * cannot lose anything: the title, the banner with its way out, folding the
 * lists to look through them, and the rows marked {@link PAUSED_ALLOWED}
 * (Export, Earlier setups, Review conversion). The tab redraws when saving
 * pauses or resumes, so this is applied to a fresh page each time.
 */

/** Marks a settings row that stays usable while saving is paused. */
export const PAUSED_ALLOWED = "cs-paused-allowed";

/** Make every edit on the page inert, keeping `keep` (the banner slot) and allowed rows. */
export function makePausedReadOnly(containerEl: HTMLElement, keep: readonly (HTMLElement | null)[]): void {
	containerEl.addClass("cs-settings-paused");
	for (const child of Array.from(containerEl.children) as HTMLElement[]) {
		if (keep.includes(child) || child.hasClass(PAUSED_ALLOWED) || child.hasClass("cs-header-row")) continue;
		if (!child.hasClass("cs-sticky-section")) { child.setAttribute("inert", ""); continue; }
		// A list section: its heading still folds, but its rows and the
		// heading's own buttons (Add new callout, discovery) do not act.
		for (const inner of Array.from(child.children) as HTMLElement[]) {
			if (inner.hasClass("cs-sticky-heading")) inner.querySelector(".setting-item-control")?.setAttribute("inert", "");
			else inner.setAttribute("inert", "");
		}
	}
}
