import { setIcon, setTooltip } from "obsidian";

/** A trailing header action whose size never participates in header layout. */
export function addHeaderResetButton(
	headerEl: HTMLElement,
	options: {
		label: string;
		isModified(): boolean;
		reset(): void | Promise<void>;
	},
): { sync(): void } {
	headerEl.addClass("cs-reset-header");
	const button = headerEl.createEl("button", {
		cls: "clickable-icon cs-header-reset cs-hidden",
		attr: { type: "button", "aria-label": options.label },
	});
	setIcon(button, "rotate-ccw");
	setTooltip(button, options.label);
	const sync = (): void => {
		button.toggleClass("cs-hidden", !options.isModified());
	};
	button.addEventListener("click", () => {
		if (!options.isModified()) return;
		void options.reset();
		sync();
	});
	sync();
	return { sync };
}
