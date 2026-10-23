/**
 * ui/ColorSwatchInput.ts — Native color input styled as a swatch box.
 *
 * The visible swatch is a wrapper whose background-color we fully control (so
 * it renders identically on desktop, iPhone and tablets); the native
 * <input type="color"> sits invisibly on top to keep the OS color-picker
 * behaviour. Used by the palette editor's colour rows. A low-contrast
 * warning is the row's business, not the swatch's: the editor writes it under
 * the colour with `Setting.setErrorMessage`.
 */

export interface ColorSwatchInput {
	/** The native color input (read/write its `.value` to sync the swatch). */
	input: HTMLInputElement;
	/** Grid-cell wrapper containing the swatch. */
	cell: HTMLElement;
}

export function createColorSwatchInput(
	parent: HTMLElement,
	value: string,
	onPick: (next: string) => void,
): ColorSwatchInput {
	const cell = parent.createDiv({ cls: "cs-color-cell" });
	const wrap = cell.createEl("label", {
		cls: "callout-studio-color-input-wrap",
	});
	wrap.style.backgroundColor = value;
	const input = wrap.createEl("input", {
		type: "color",
		value,
		cls: "callout-studio-color-input",
	});
	input.addEventListener("input", () => {
		wrap.style.backgroundColor = input.value;
		onPick(input.value);
	});
	return { input, cell };
}
