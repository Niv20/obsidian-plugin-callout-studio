/**
 * settings/paletteDirectionPicker.ts — the gradient's arrow direction picker.
 *
 * Who calls it. The palette editor's Gradient style, for the row that picks
 * which way the gradient sweeps.
 *
 * The main idea. Three preset angles, each an Obsidian icon button
 * (`.clickable-icon`, built as Obsidian builds its extra buttons: a `div` that
 * acts as a button), so app.css draws them: a plain arrow, Obsidian's hover
 * fill, and for the chosen one `.is-active`, an accent arrow on a pale accent
 * tint (finding S6-10). The picker keeps its own "which one is chosen" state.
 *
 * Split out of `PaletteEditorModal` as a plain function of its arguments: it
 * reads no modal state and writes none.
 */
import { setIcon } from "obsidian";

/** The preset linear-gradient directions, clockwise from "to top" (0°). */
const GRADIENT_DIRECTIONS: { deg: number; icon: string }[] = [
	{ deg: 45, icon: "arrow-up-right" },
	{ deg: 90, icon: "arrow-right" },
	{ deg: 135, icon: "arrow-down-right" },
];

/**
 * Draw the three direction buttons into `parent`.
 *
 * @param parent Where the row of buttons goes (a setting row's control).
 * @param initialDeg The angle chosen when the picker opens.
 * @param onPick Called with the new angle when the user picks one.
 */
export function renderDirectionPicker(parent: HTMLElement, initialDeg: number, onPick: (deg: number) => void): void {
	const dirWrap = parent.createDiv({
		cls: "cs-gradient-dir-row",
		attr: { role: "group" },
	});
	const buttons: HTMLElement[] = [];

	/** Mark `chosen` as the active button, and only it. */
	const markChosen = (chosen: HTMLElement): void => {
		for (const button of buttons) {
			const isChosen = button === chosen;
			button.toggleClass("is-active", isChosen);
			// aria-pressed tells a screen reader which of the three is on.
			button.setAttribute("aria-pressed", String(isChosen));
		}
	};

	for (const { deg, icon } of GRADIENT_DIRECTIONS) {
		// One name, as aria-label only: Obsidian turns it into the tooltip. A
		// `title` as well would draw a second, system tooltip on top.
		const button = dirWrap.createDiv({
			cls: "clickable-icon cs-gradient-dir-btn",
			attr: { role: "button", tabindex: "0", "aria-label": `${deg}°` },
		});
		setIcon(button, icon);
		buttons.push(button);

		const choose = (): void => {
			markChosen(button);
			onPick(deg);
		};
		button.addEventListener("click", (event) => {
			event.preventDefault();
			choose();
		});
		// A `div` acting as a button answers Enter and Space itself; a real
		// `<button>` would get them for free.
		button.addEventListener("keydown", (event) => {
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				choose();
			}
		});
	}

	const initial = buttons[GRADIENT_DIRECTIONS.findIndex(({ deg }) => deg === initialDeg)];
	if (initial) markChosen(initial);
	else for (const button of buttons) button.setAttribute("aria-pressed", "false");
}
