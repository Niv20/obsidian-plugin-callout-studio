/**
 * ui/ColorSwatchInput.ts — the palette editor's colour picker: Obsidian's own
 * round colour dot.
 *
 * Who calls it. The palette editor's colour rows (`PaletteEditorModal` and
 * `paletteBaseColorRow.ts`).
 *
 * The main idea. It is the very element Obsidian's `ColorComponent` makes, a
 * bare `<input type="color">`, so Obsidian's app.css draws it: a round 22px dot
 * (40px on a phone or tablet), a soft ring under the pointer and a grey ring on
 * keyboard focus (finding S6-11). It used to be a painted rectangle with the
 * real input invisible on top, which answered neither the pointer nor the
 * keyboard.
 *
 * It is made here rather than with `ColorComponent` because that reports a
 * colour only once the system picker closes (the `change` event), while the
 * live preview has to follow every move inside the picker (the `input` event).
 * Both are passed on: `onPick` for every move, `onCommit` once the pick has
 * settled.
 */

export interface ColorSwatchInput {
	/** The native colour input (read or write its `.value`). */
	input: HTMLInputElement;
}

/**
 * Add a colour dot to `parent`.
 *
 * @param parent Where the dot goes, usually a setting row's control column.
 * @param value The colour it starts on, as `#rrggbb`.
 * @param onPick Called with the colour on every move inside the picker.
 * @param onCommit Optional: called once the picker settles on a colour, for
 *   work that should not run mid-pick (a warning line that would make the
 *   rows below jump while the user is still choosing).
 */
export function createColorSwatchInput(
	parent: HTMLElement,
	value: string,
	onPick: (next: string) => void,
	onCommit?: (next: string) => void,
): ColorSwatchInput {
	const input = parent.createEl("input", {
		type: "color",
		value,
		// A hook for tests and the screenshot scripts; app.css draws the dot.
		cls: "callout-studio-color-input",
	});
	input.addEventListener("input", () => onPick(input.value));
	if (onCommit) input.addEventListener("change", () => onCommit(input.value));
	return { input };
}
