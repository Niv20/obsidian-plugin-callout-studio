/**
 * settings/sections/stickySection.ts — one wrapped, pinnable settings section.
 *
 * The three callout lists ("Callouts from your theme", "My callout types",
 * "Built-in callouts") each pin their heading to the top of the settings pane
 * while their own rows scroll under it, hand over to the next section's heading,
 * and let go with the last of their own rows rather than hanging over the eight
 * sections below them.
 *
 * All of that is the wrapper this file makes, and none of it is JavaScript. A
 * sticky box cannot be shifted outside its containing block, so a heading
 * wrapped together with its own rows is pinned for exactly as long as those rows
 * last. The three used to be flat siblings of each other and of everything under
 * them — one containing block between them, which is the one arrangement that
 * cannot work: all three would pin at the same offset, stack on top of one
 * another, and none would ever let go.
 *
 * The two classes are a pair and both are load-bearing, so they are written once
 * here rather than three times at the call site: `styles.css` hangs the paint
 * and the trailing space off the wrapper, and the pinning off the heading.
 */
import { Setting } from "obsidian";

export type StickySection = {
	/** The wrapper. Rows go in here, and so do `cs-hidden` / `cs-section-divider`. */
	wrapEl: HTMLElement;
	/** The heading row, already carrying `cs-sticky-heading`. */
	setting: Setting;
};

export function createStickySection(
	containerEl: HTMLElement,
	name: string,
): StickySection {
	const wrapEl = containerEl.createDiv({ cls: "cs-sticky-section" });
	const setting = new Setting(wrapEl).setName(name).setHeading();
	setting.settingEl.addClass("cs-sticky-heading");
	return { wrapEl, setting };
}
