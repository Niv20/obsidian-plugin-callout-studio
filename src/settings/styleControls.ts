/**
 * settings/styleControls.ts — Shared builders for the global style controls
 * (titled group boxes, slider rows, border-side buttons).
 *
 * Extracted from the old GlobalStyleSection so the three per-role "Global
 * callout style" popups (regular / heading / inline) compose the same control
 * groups. Every control follows the same live-update contract: dragging
 * previews the change via cssInjector.inject(false), coalesced to one pass per
 * animation frame (see scheduleLiveInject) and skipping the css-change
 * re-render; releasing commits it via saveSettings() + cssInjector.inject().
 * There is no scheduleInject — the injector has no debounce at all.
 */
import { Setting, type SliderComponent } from "obsidian";
import { t } from "../i18n";
import type { BorderSidesSettings } from "../types";
import type { SettingsTabPlugin } from "./sections/types";
import { addHeaderResetButton } from "./headerResetButton";

/**
 * `setDisplayFormat` arrived with the value readout in Obsidian 1.13. It is in
 * neither the 1.10.3 typings this repo builds against nor the runtime of the
 * older builds the manifest still supports, which is why it is declared here
 * and reached optionally rather than called outright.
 */
type SliderWithDisplayFormat = SliderComponent & {
	setDisplayFormat?: (format: (value: number) => string) => unknown;
};

/**
 * Put a unit on the number Obsidian draws beside a slider — "12px" rather than
 * a bare "12".
 *
 * A no-op below 1.13, where there is no readout to format: those builds show
 * the slider alone, exactly as they did before. Keep the formatted string's
 * length stable (a fixed decimal count, a unit that never changes) — it shares
 * a flex row with a track that takes the width it leaves, so a readout that
 * grows by a character shrinks the slider under the cursor. styles.css reserves
 * a width for the same reason.
 */
export function setSliderDisplay(
	slider: SliderComponent,
	format: (value: number) => string,
): void {
	(slider as SliderWithDisplayFormat).setDisplayFormat?.(format);
}

/** A titled control group box (bordered section with a muted header). */
export function createControlGroup(
	parentEl: HTMLElement,
	title: string,
	extraCls = "",
): HTMLElement {
	const groupEl = parentEl.createDiv({
		cls: `callout-studio-adjust-section cs-settings-group${
			extraCls ? " " + extraCls : ""
		}`,
	});
	groupEl.createDiv({
		cls: "callout-studio-adjust-header cs-settings-group-header",
		text: title,
	});
	return groupEl;
}

export interface StyleGroupReset {
	isModified(): boolean;
	reset(): void;
	afterReset?(): void;
}

/** Defaults for a group's scalar settings, never touching another group. */
export function styleFieldsReset<T, K extends keyof T>(
	values: T,
	defaults: T,
	keys: readonly K[],
): StyleGroupReset {
	return {
		isModified: () => keys.some((key) => values[key] !== defaults[key]),
		reset: () => {
			for (const key of keys) values[key] = defaults[key];
		},
	};
}

/** Keep group resets, live values and visible controls in step without rebuilding. */
export function createResettableControlGroup(
	plugin: SettingsTabPlugin,
	parentEl: HTMLElement,
	title: string,
	defaults: StyleGroupReset,
	extraCls = "",
): {
	el: HTMLElement;
	syncReset(): void;
	addSync(sync: () => void): void;
	addSlider(spec: StyleSliderSpec): void;
	addToggle(label: string, get: () => boolean, set: (value: boolean) => void,
		afterCommit?: () => void): void;
} {
	const el = createControlGroup(parentEl, title, extraCls);
	const controls: (() => void)[] = [];
	const reset = addHeaderResetButton(
		el.querySelector<HTMLElement>(".cs-settings-group-header")!,
		{
			label: `${t("settings.resetAction")}: ${title}`,
			isModified: () => defaults.isModified(),
			reset: async () => {
				defaults.reset();
				for (const sync of controls) sync();
				reset.sync();
				await plugin.saveSettings();
				plugin.cssInjector.inject();
				defaults.afterReset?.();
			},
		},
	);
	return {
		el,
		syncReset: () => reset.sync(),
		addSync: (sync) => controls.push(sync),
		addSlider: (spec) => {
			controls.push(addStyleSlider(plugin, el, {
				...spec,
				set: (value) => {
					spec.set(value);
					reset.sync();
				},
			}));
		},
		addToggle: (label, get, setValue, afterCommit) => {
			new Setting(el).setName(label).addToggle((toggle) => {
				controls.push(() => { toggle.setValue(get()); });
				toggle.setValue(get()).onChange(async (value) => {
					setValue(value);
					reset.sync();
					await plugin.saveSettings();
					plugin.cssInjector.inject();
					afterCommit?.();
				});
			});
		},
	};
}

/**
 * The shell of a slider row: a muted label (and room for Obsidian's value
 * readout beside it) above a track that takes the row's full width.
 *
 * Split out of {@link addStyleSlider} so a caller that does NOT commit to
 * settings can still get the same row — the palette editor's Intensity slider
 * only re-derives colours and refreshes its preview, so it cannot use the
 * live-update contract `addStyleSlider` is built around. Fill the returned
 * element with `new Setting(row).addSlider(…)`; styles.css hides that Setting's
 * info column and stretches its control to 100%.
 *
 * @returns the row element, ready to take a Setting.
 */
export function createSliderRow(
	parentEl: HTMLElement,
	label: string,
): HTMLElement {
	const row = parentEl.createDiv({ cls: "callout-studio-slider-row" });
	const labelEl = row.createDiv({ cls: "callout-studio-slider-label" });
	labelEl.createSpan({ text: label });
	return row;
}

export interface StyleSliderSpec {
	label: string;
	min: number;
	max: number;
	step: number;
	/**
	 * Decimal places kept when rounding slider values, and the count the readout
	 * is padded to — always the same number of digits, so the readout's width
	 * cannot change mid-drag.
	 */
	decimals: number;
	/** Unit appended to the readout, e.g. `"px"`. */
	suffix?: string;
	/** Marker prepended to the readout, e.g. `"×"` for a scale factor. */
	prefix?: string;
	get(): number;
	set(value: number): void;
	/**
	 * Fired once when the user begins dragging the thumb (pointer down, or the
	 * first keyboard nudge). Lets a caller swap in a bespoke preview for the
	 * duration of the drag. Optional — sliders that omit it behave as before.
	 */
	onDragStart?(): void;
	/** Fired once when the drag ends (pointer up / cancel, or the slider's
	 * `change` on release). Pairs with {@link onDragStart} to restore. */
	onDragEnd?(): void;
}

/**
 * A labelled slider row: label + animated value readout above a full-width
 * slider, wired to the live-update contract described in the module header.
 */
export function addStyleSlider(
	plugin: SettingsTabPlugin,
	parentEl: HTMLElement,
	spec: StyleSliderSpec,
): () => void {
	const row = createSliderRow(parentEl, spec.label);
	let syncValue = (): void => {};

	const factor = Math.pow(10, spec.decimals);
	const round = (v: number): number => Math.round(v * factor) / factor;

	// Coalesce the per-move live reflow to at most one inject per animation
	// frame, so even a fast drag updates the preview every frame (~60fps)
	// instead of stalling behind a debounce until the thumb stops.
	let rafId: number | null = null;
	const scheduleLiveInject = (): void => {
		if (rafId !== null) return;
		rafId = window.requestAnimationFrame(() => {
			rafId = null;
			// `false` = skip the css-change re-render: geometry rides CSS
			// variables and reflows on stylesheet replace, so this stays cheap.
			plugin.cssInjector.inject(false);
		});
	};

	// Drag-lifecycle notifications for callers that swap in a bespoke preview
	// while the thumb is held. `dragging` dedupes the several DOM events that
	// can each signal a start/end (pointer vs. keyboard) into one start + one
	// end per drag.
	let dragging = false;
	const beginDrag = (): void => {
		if (dragging) return;
		dragging = true;
		spec.onDragStart?.();
	};
	const endDrag = (): void => {
		if (!dragging) return;
		dragging = false;
		spec.onDragEnd?.();
	};

	new Setting(row).addSlider((slider) => {
		syncValue = () => {
			if (rafId !== null) window.cancelAnimationFrame(rafId);
			rafId = null;
			slider.setValue(spec.get());
			endDrag();
		};
		// The number beside the track is Obsidian's own — SliderComponent keeps it
		// in sync, so this only says how to spell it.
		setSliderDisplay(
			slider,
			(v) =>
				`${spec.prefix ?? ""}${v.toFixed(spec.decimals)}${spec.suffix ?? ""}`,
		);
		slider.setLimits(spec.min, spec.max, spec.step).setValue(spec.get());
		slider.sliderEl.addEventListener("input", () => {
			// Covers keyboard nudges, which fire `input` without a pointerdown.
			beginDrag();
			const v = round(parseFloat(slider.sliderEl.value));
			spec.set(v);
			scheduleLiveInject();
		});
		if (spec.onDragStart || spec.onDragEnd) {
			slider.sliderEl.addEventListener("pointerdown", beginDrag);
			slider.sliderEl.addEventListener("pointerup", endDrag);
			slider.sliderEl.addEventListener("pointercancel", endDrag);
		}
		slider.onChange(async (v) => {
			// `change` marks the end of a drag (release) as well as commit.
			endDrag();
			spec.set(round(v));
			await plugin.saveSettings();
			plugin.cssInjector.inject();
		});
	});
	return () => syncValue();
}

/**
 * The "Borders" group: an All + per-side toggle button row, plus a thickness
 * slider that stays hidden while no side is active. Mutates `frame` in place
 * (the caller passes the live settings object).
 */
export function renderBordersGroup(
	plugin: SettingsTabPlugin,
	parentEl: HTMLElement,
	frame: { borderSides: BorderSidesSettings; borderWidth: number },
	defaults: { borderSides: BorderSidesSettings; borderWidth: number },
): void {
	const keys: (keyof BorderSidesSettings)[] = ["top", "right", "bottom", "left"];
	const group = createResettableControlGroup(plugin, parentEl, t("settings.border"), {
		isModified: () => frame.borderWidth !== defaults.borderWidth ||
			keys.some((key) => frame.borderSides[key] !== defaults.borderSides[key]),
		reset: () => {
			Object.assign(frame.borderSides, defaults.borderSides);
			frame.borderWidth = defaults.borderWidth;
		},
	});
	const groupEl = group.el;
	const sidesRow = groupEl.createDiv({ cls: "cs-border-sides-row" });

	const sides: { key: keyof BorderSidesSettings; label: string }[] = [
		{ key: "top", label: t("settings.borderTop") },
		{ key: "right", label: t("settings.borderRight") },
		{ key: "bottom", label: t("settings.borderBottom") },
		{ key: "left", label: t("settings.borderLeft") },
	];

	const isAll = (): boolean => sides.every((s) => frame.borderSides[s.key]);
	const isAny = (): boolean => sides.some((s) => frame.borderSides[s.key]);

	const allBtn = sidesRow.createEl("button", {
		cls: `cs-border-side-btn${isAll() ? " is-active" : ""}`,
		text: t("settings.borderAll"),
	});

	const sideButtons = new Map<string, HTMLButtonElement>();

	const commit = async (): Promise<void> => {
		syncUI();
		await plugin.saveSettings();
		plugin.cssInjector.inject();
		syncUI();
	};

	allBtn.addEventListener("click", () => {
		void (async () => {
			const newVal = !isAll();
			for (const s of sides) frame.borderSides[s.key] = newVal;
			await commit();
		})();
	});

	for (const side of sides) {
		const btn = sidesRow.createEl("button", {
			cls: `cs-border-side-btn${
				frame.borderSides[side.key] ? " is-active" : ""
			}`,
			text: side.label,
		});
		sideButtons.set(side.key, btn);
		btn.addEventListener("click", () => {
			void (async () => {
				frame.borderSides[side.key] = !frame.borderSides[side.key];
				await commit();
			})();
		});
	}

	const widthRow = groupEl.createDiv({ cls: isAny() ? "" : "cs-hidden" });
	const syncWidth = addStyleSlider(plugin, widthRow, {
		label: t("settings.borderWidth"),
		min: 1,
		max: 4,
		step: 0.5,
		decimals: 1,
		suffix: "px",
		get: () => frame.borderWidth,
		set: (v) => {
			frame.borderWidth = v;
			group.syncReset();
		},
	});

	const syncUI = (): void => {
		group.syncReset();
		allBtn.toggleClass("is-active", isAll());
		for (const side of sides) {
			sideButtons
				.get(side.key)
				?.toggleClass("is-active", frame.borderSides[side.key]);
		}
		widthRow.toggleClass("cs-hidden", !isAny());
	};
	group.addSync(syncWidth);
	group.addSync(syncUI);
}
