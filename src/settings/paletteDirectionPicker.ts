/**
 * settings/paletteDirectionPicker.ts — the gradient's arrow direction picker.
 *
 * Three preset angles as a row of arrow buttons, managing their own
 * active-button state. Split out of `PaletteEditorModal` as a plain function of
 * its arguments: it reads no modal state and writes none, which makes it the
 * cheapest thing in that file to lift out and the easiest to reuse if a second
 * surface ever needs to pick a sweep direction.
 */
import { setIcon } from "obsidian";

/** The preset linear-gradient directions, clockwise from "to top" (0°). */
const GRADIENT_DIRECTIONS: { deg: number; icon: string }[] = [
	{ deg: 45, icon: "arrow-up-right" },
	{ deg: 90, icon: "arrow-right" },
	{ deg: 135, icon: "arrow-down-right" },
];

export function renderDirectionPicker(
	parent: HTMLElement,
	initialDeg: number,
	onPick: (deg: number) => void,
): void {
	const dirWrap = parent.createDiv({ cls: "cs-gradient-dir-row" });
	const dirBtns = new Map<number, HTMLButtonElement>();
	for (const { deg, icon } of GRADIENT_DIRECTIONS) {
		const btn = dirWrap.createEl("button", {
			cls: "cs-gradient-dir-btn",
			attr: { "aria-label": `${deg}°`, title: `${deg}°` },
		});
		setIcon(btn, icon);
		if (deg === initialDeg) btn.addClass("is-active");
		btn.addEventListener("click", (e) => {
			e.preventDefault();
			for (const b of dirBtns.values()) b.removeClass("is-active");
			btn.addClass("is-active");
			onPick(deg);
		});
		dirBtns.set(deg, btn);
	}
}
