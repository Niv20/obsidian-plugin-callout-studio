/**
 * settings/editor/iconAdjustGroup.ts — the Size / Horizontal offset / Vertical
 * offset trio that nudges one render role's icon.
 *
 * Who calls it. `CalloutEditor`, once for each render role (heading, inline,
 * block), into the column beside the live preview.
 *
 * The main idea. Each role is one Obsidian `SettingGroup`, the same parts an
 * Obsidian settings page is made of: a heading ("Heading icon adjustments"),
 * one rounded box, and one row per slider with a thin line between the rows
 * (finding S5-14). For a built-in callout the heading also holds a ↺ button
 * that puts all three sliders back to the values the callout ships with. The
 * ↺ stays invisible until one of the sliders has moved.
 *
 * The group writes straight into the `ResolvedIconAdjust` object it is handed
 * and reports every move through `onChange`, so the caller owns both the state
 * and what to do about a change (in the editor: redraw the live preview).
 */
import { SettingGroup, type SliderComponent } from "obsidian";
import { t } from "../../i18n";
import type { CalloutRenderRole } from "../../types";
import {
	equalIconAdjust,
	ICON_ADJUST_LIMITS,
	type ResolvedIconAdjust,
} from "../../utils/iconAdjust";
import { setSliderDisplay } from "../styleControls";
import { paintResetIdle } from "../../ui/resetArrow";
import { settingGroupEl } from "../../ui/settingGroupEl";

/** Translate the complete heading so each locale controls its word order. */
function groupHeader(role: CalloutRenderRole): string {
	const roleLabels: Record<CalloutRenderRole, string> = {
		regular: t("editor.blockIconAdjustments"),
		heading: t("editor.headingIconAdjustments"),
		inline: t("editor.inlineIconAdjustments"),
	};
	return roleLabels[role];
}

/**
 * Everything one slider row needs to know: what to call it, how to spell its
 * value, its range, and how to read and write the field it controls.
 */
interface SliderControl {
	label: string;
	/** Written after the number Obsidian draws beside the track: "%" or "px". */
	suffix: string;
	/** `[min, max, step]`, in the units the slider shows. */
	limits: [number, number, number];
	/** The current value, in the units the slider shows. */
	get: () => number;
	/** The value the ↺ button goes back to, in the units the slider shows. */
	getDefault: () => number;
	/** Store a value the slider reports. */
	set: (value: number) => void;
	/** Filled in once the row is built, so the ↺ button can move the thumb. */
	slider?: SliderComponent;
}

/**
 * Build one role's adjustment group into `parent`.
 *
 * @param parent The column the group goes into.
 * @param role Which render role's icon this group moves.
 * @param adjust The values to show, and to write each slider move into.
 * @param onChange Called after every move and after a reset.
 * @param defaults The shipped values of a built-in callout. When given, the
 *   heading gets a ↺ that restores them; without it there is nothing to
 *   restore, so there is no ↺.
 * @returns The group's outer element, so the caller can hide the whole group
 *   when the callout draws no icon at all.
 */
export function renderIconAdjustGroup(
	parent: HTMLElement,
	role: CalloutRenderRole,
	adjust: ResolvedIconAdjust,
	onChange: () => void,
	defaults?: ResolvedIconAdjust,
): HTMLElement {
	const header = groupHeader(role);
	const group = new SettingGroup(parent)
		.setHeading(header)
		.addClass("cs-editor-group");

	const { offset, size } = ICON_ADJUST_LIMITS;

	// The three sliders are identical in every respect but which field they
	// write, so they come from a small table rather than three near-copies.
	// Size is stored as a factor (1 = 100%) but shown as a percentage, so it
	// converts on the way in and out; the offsets are already px.
	const controls: SliderControl[] = [
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

	// The ↺ button's element, or `null` when there are no defaults to restore.
	// It is filled in inside the `addExtraButton` callback further down; the
	// `syncReset` closure reads it later, when it already exists.
	let resetEl: HTMLElement | null = null;

	/**
	 * Show the ↺ only while the values differ from the defaults.
	 *
	 * Invisible (`cs-reset-idle`, `visibility: hidden`) rather than removed: an
	 * invisible button still takes its room, so the heading keeps one height and
	 * the sliders below do not jump the moment it appears. It cannot be reached
	 * with Tab or by a screen reader while it is invisible (ui/resetArrow.ts).
	 */
	const syncReset = (): void => {
		if (resetEl) paintResetIdle(resetEl, !defaults || equalIconAdjust(adjust, defaults));
	};

	for (const control of controls) {
		group.addSetting((setting) => {
			// Obsidian's usual row: the name on the left, the track beside it.
			setting
				.setName(control.label)
				.addSlider((slider: SliderComponent) => {
					control.slider = slider;
					// The number beside the track is Obsidian's own, kept in sync
					// by the SliderComponent; this only says how to spell it. All
					// three values are whole numbers, so there are no decimals.
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
		});
	}

	if (defaults) {
		const resetLabel = `${t("settings.resetAction")}: ${header}`;
		// Obsidian puts a group's extra buttons at the end of its heading.
		group.addExtraButton((button) => {
			button
				.setIcon("rotate-ccw")
				.setTooltip(resetLabel)
				.onClick(() => {
					Object.assign(adjust, defaults);
					for (const control of controls) {
						control.slider?.setValue(control.getDefault());
					}
					syncReset();
					onChange();
				});
			resetEl = button.extraSettingsEl;
			resetEl.addClass("cs-icon-adjust-reset");
			// `setTooltip` also names the button for screen readers, but only
			// in Obsidian; stating it keeps the name whatever draws the tooltip.
			resetEl.setAttribute("aria-label", resetLabel);
		});
	}
	syncReset();

	return settingGroupEl(group);
}
