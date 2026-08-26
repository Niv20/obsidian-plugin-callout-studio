/**
 * settings/editor/iconAdjustGroup.ts — the size / horizontal / vertical trio
 * that nudges one render role's icon.
 *
 * Extracted from `CalloutEditor` when a second window needed it: the theme
 * callout preview offers this and nothing else, because moving the icon inside
 * Callout Studio's own heading and inline DOM is the one appearance change that
 * is still the plugin's to make for a callout the theme owns. Two copies of
 * three sliders would have drifted on the first change to the limits.
 *
 * Writes straight into the `ResolvedIconAdjust` it is handed and reports every
 * move through `onChange`, so the caller owns both the state and what to do
 * about it — a live preview in one window, a save in the other.
 */
import { Setting, type SliderComponent } from "obsidian";
import { t } from "../../i18n";
import {
	ICON_ADJUST_LIMITS,
	type ResolvedIconAdjust,
} from "../../utils/iconAdjust";
import { setSliderDisplay } from "../styleControls";

/**
 * Build one role's adjustment box into `parent` and return it, so the caller
 * can hide it when the callout draws no icon at all.
 *
 * The three sliders are identical in every respect but which field they write,
 * so they come from a small table rather than three near-copies — the shape
 * this had before it was written once and called per role.
 */
export function renderIconAdjustGroup(
	parent: HTMLElement,
	header: string,
	adjust: ResolvedIconAdjust,
	onChange: () => void,
): HTMLElement {
	const box = parent.createDiv({ cls: "callout-studio-adjust-section" });
	box.createDiv({ cls: "callout-studio-adjust-header", text: header });

	const { offset, size } = ICON_ADJUST_LIMITS;

	// Size is stored as a factor but shown as a percentage, so it converts on
	// the way in and out; the offsets are already px and pass straight through.
	const controls: {
		label: string;
		suffix: string;
		limits: [number, number, number];
		get: () => number;
		set: (value: number) => void;
	}[] = [
		{
			label: t("editor.size"),
			suffix: "%",
			limits: [size.min * 100, size.max * 100, 5],
			get: () => Math.round(adjust.size * 100),
			set: (value) => {
				adjust.size = value / 100;
			},
		},
		{
			label: t("editor.horizontalOffset"),
			suffix: "px",
			limits: [offset.min, offset.max, offset.step],
			get: () => adjust.offsetX,
			set: (value) => {
				adjust.offsetX = value;
			},
		},
		{
			label: t("editor.verticalOffset"),
			suffix: "px",
			limits: [offset.min, offset.max, offset.step],
			get: () => adjust.offsetY,
			set: (value) => {
				adjust.offsetY = value;
			},
		},
	];

	for (const control of controls) {
		const row = box.createDiv({ cls: "callout-studio-slider-row" });
		const label = row.createDiv({ cls: "callout-studio-slider-label" });
		label.createSpan({ text: control.label });
		// The number beside the track is Obsidian's own — SliderComponent keeps
		// it in sync, so this only says how to spell it. All three values are
		// whole numbers, so there are no decimals to pad.
		new Setting(row).addSlider((slider: SliderComponent) => {
			setSliderDisplay(slider, (v) => `${v}${control.suffix}`);
			slider
				.setLimits(...control.limits)
				.setValue(control.get())
				.setInstant(true)
				.onChange((value: number) => {
					control.set(value);
					onChange();
				});
		});
	}

	return box;
}
