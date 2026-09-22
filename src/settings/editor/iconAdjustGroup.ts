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
import {
	Setting,
	setIcon,
	setTooltip,
	type SliderComponent,
} from "obsidian";
import { t } from "../../i18n";
import type { CalloutRenderRole } from "../../types";
import {
	equalIconAdjust,
	ICON_ADJUST_LIMITS,
	type ResolvedIconAdjust,
} from "../../utils/iconAdjust";
import { setSliderDisplay } from "../styleControls";

/** Compose a role-specific header from strings every locale already has. */
function groupHeader(role: CalloutRenderRole): string {
	const roleLabels: Record<CalloutRenderRole, string> = {
		regular: t("settings.calloutTypeRegular"),
		heading: t("settings.calloutTypeHeading"),
		inline: t("settings.calloutTypeInline"),
	};
	return `${t("editor.iconAdjustment")} — ${roleLabels[role]}`;
}

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
	role: CalloutRenderRole,
	adjust: ResolvedIconAdjust,
	onChange: () => void,
	defaults?: ResolvedIconAdjust,
): HTMLElement {
	const box = parent.createDiv({ cls: "callout-studio-adjust-section" });
	const header = groupHeader(role);
	const headerEl = box.createDiv({
		cls: "callout-studio-adjust-header cs-icon-adjust-header",
	});
	headerEl.createSpan({ text: header });
	const resetLabel = `${t("settings.resetAction")}: ${header}`;
	const resetBtn = defaults
		? headerEl.createEl("button", {
				cls: "clickable-icon cs-icon-adjust-reset cs-hidden",
				attr: { type: "button", "aria-label": resetLabel },
			})
		: null;
	if (resetBtn) {
		setIcon(resetBtn, "rotate-ccw");
		setTooltip(resetBtn, resetLabel);
	}

	const { offset, size } = ICON_ADJUST_LIMITS;

	// Size is stored as a factor but shown as a percentage, so it converts on
	// the way in and out; the offsets are already px and pass straight through.
	const controls: {
		label: string;
		suffix: string;
		limits: [number, number, number];
		get: () => number;
		getDefault: () => number;
		set: (value: number) => void;
		slider?: SliderComponent;
	}[] = [
		{
			label: t("editor.size"),
			suffix: "%",
			limits: [size.min * 100, size.max * 100, 5],
			get: () => Math.round(adjust.size * 100),
			getDefault: () => Math.round((defaults?.size ?? adjust.size) * 100),
			set: (value) => {
				adjust.size = value / 100;
			},
		},
		{
			label: t("editor.horizontalOffset"),
			suffix: "px",
			limits: [offset.min, offset.max, offset.step],
			get: () => adjust.offsetX,
			getDefault: () => defaults?.offsetX ?? adjust.offsetX,
			set: (value) => {
				adjust.offsetX = value;
			},
		},
		{
			label: t("editor.verticalOffset"),
			suffix: "px",
			limits: [offset.min, offset.max, offset.step],
			get: () => adjust.offsetY,
			getDefault: () => defaults?.offsetY ?? adjust.offsetY,
			set: (value) => {
				adjust.offsetY = value;
			},
		},
	];
	const syncReset = (): void => {
		resetBtn?.toggleClass(
			"cs-hidden",
			!defaults || equalIconAdjust(adjust, defaults),
		);
	};

	for (const control of controls) {
		const row = box.createDiv({ cls: "callout-studio-slider-row" });
		const label = row.createDiv({ cls: "callout-studio-slider-label" });
		label.createSpan({ text: control.label });
		// The number beside the track is Obsidian's own — SliderComponent keeps
		// it in sync, so this only says how to spell it. All three values are
		// whole numbers, so there are no decimals to pad.
		new Setting(row).addSlider((slider: SliderComponent) => {
			control.slider = slider;
			setSliderDisplay(slider, (v) => `${v}${control.suffix}`);
			slider
				.setLimits(...control.limits)
				.setValue(control.get())
				.setInstant(true)
				.onChange((value: number) => {
					control.set(value);
					syncReset();
					onChange();
				});
		});
	}

	resetBtn?.addEventListener("click", () => {
		if (!defaults) return;
		Object.assign(adjust, defaults);
		for (const control of controls) {
			control.slider?.setValue(control.getDefault());
		}
		syncReset();
		onChange();
	});
	syncReset();

	return box;
}
