/**
 * One conditional return-arrow for a CalloutEditor setting row.
 *
 * Built-in IDs, icons and colours all use the same interaction: the action is
 * absent from the visual flow while the field matches the shipped definition,
 * appears once it diverges, and rechecks itself after restoring the field. The
 * field still owns the actual reset because only it knows which companion UI
 * (preview, picker label, validation) has to be refreshed.
 */
import type { Setting } from "obsidian";

export function addFieldResetButton(
	setting: Setting,
	tooltip: string,
	isDefault: () => boolean,
	reset: () => void,
): () => void {
	let buttonEl: HTMLElement | null = null;
	const sync = (): void => {
		buttonEl?.toggleClass("cs-hidden", isDefault());
	};

	setting.addExtraButton((button) => {
		buttonEl = button.extraSettingsEl;
		button
			.setIcon("rotate-ccw")
			.setTooltip(tooltip)
			.onClick(() => {
				reset();
				sync();
			});
	});
	sync();
	return sync;
}
