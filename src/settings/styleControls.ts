/**
 * settings/styleControls.ts — how a style slider updates the callouts while it
 * is dragged, and saves when it is let go.
 *
 * Who calls it. The style pages (declarative/stylePages.ts) wire every slider
 * with {@link wireStyleSlider}; the callout editor's icon adjustments use
 * {@link setSliderDisplay} for their readout.
 *
 * The main idea: the live-update contract. Dragging previews the change via
 * cssInjector.inject(false), coalesced to one pass per animation frame (see
 * scheduleLiveInject) and skipping the css-change re-render; releasing commits
 * it, by default via cssInjector.inject() + saveSettings(). There is no
 * scheduleInject — the injector has no debounce at all.
 *
 * Paint first, then save, at every commit. A save reads the file back, writes
 * a recovery copy and queues behind any save already under way, so painting
 * after it made the change wait on the disk — and a failed save rejects, which
 * skipped the repaint altogether until something else injected.
 *
 * The animation frame is the control's own window's (utils/elementFrame.ts):
 * in Obsidian 1.14 the settings are a window of their own, and a frame asked
 * of the main window never arrives while it is hidden behind them.
 */
import type { SliderComponent } from "obsidian";
import { t } from "../i18n";
import type { SettingsTabPlugin } from "./sections/types";
import type { StyleSliderDef } from "./styleSpecs";
import { cancelFrame, requestFrameFor, type FrameHandle } from "../utils/elementFrame";

/**
 * Put a unit on the number Obsidian draws beside a slider — "12px" rather than
 * a bare "12".
 *
 * Keep the formatted string's length stable (a fixed decimal count, a unit
 * that never changes) — it shares a flex row with a track that takes the width
 * it leaves, so a readout that grows by a character shrinks the slider under
 * the cursor. styles.css reserves a width for the same reason.
 */
export function setSliderDisplay(
	slider: SliderComponent,
	format: (value: number) => string,
): void {
	slider.setDisplayFormat(format);
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
 * The {@link StyleSliderSpec} of one of the shared slider definitions
 * (styleSpecs.ts): it reads and writes the live settings every time.
 *
 * @param hooks Extra steps: after each value is set (`afterSet`), and when a
 *   drag starts and ends.
 */
export function specFromDef(
	plugin: SettingsTabPlugin,
	def: StyleSliderDef,
	hooks: Pick<StyleSliderSpec, "onDragStart" | "onDragEnd"> & { afterSet?(value: number): void } = {},
): StyleSliderSpec {
	return {
		label: t(def.label),
		min: def.min,
		max: def.max,
		step: def.step,
		decimals: def.decimals,
		prefix: def.prefix,
		suffix: def.suffix,
		get: () => def.get(plugin.settings),
		set: (value) => {
			def.set(plugin.settings, value);
			hooks.afterSet?.(value);
		},
		onDragStart: hooks.onDragStart,
		onDragEnd: hooks.onDragEnd,
	};
}

/** What a released slider does by default: paint the change, then save it. */
async function paintAndSave(plugin: SettingsTabPlugin): Promise<void> {
	plugin.cssInjector.inject();
	await plugin.saveSettings();
}

/**
 * Wire `slider` to the live-update contract described in the module header:
 * a drag paints at most once a frame, and the release commits.
 *
 * @param frameEl The element whose window gives the animation frames.
 * @param commit What a release does once the value is in the settings; by
 *   default it paints and saves.
 * @returns The function that shows the saved value again (after a reset, say).
 */
export function wireStyleSlider(
	plugin: SettingsTabPlugin,
	slider: SliderComponent,
	frameEl: HTMLElement,
	spec: StyleSliderSpec,
	commit: () => void | Promise<void> = () => paintAndSave(plugin),
): () => void {
	const factor = Math.pow(10, spec.decimals);
	const round = (v: number): number => Math.round(v * factor) / factor;

	// Coalesce the per-move live reflow to at most one inject per animation
	// frame, so even a fast drag updates the preview every frame (~60fps)
	// instead of stalling behind a debounce until the thumb stops. The frame
	// is the slider's own window's (see the file header).
	let frame: FrameHandle | null = null;
	const scheduleLiveInject = (): void => {
		if (frame !== null) return;
		frame = requestFrameFor(frameEl, () => {
			frame = null;
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

	// The number beside the track is Obsidian's own — SliderComponent keeps it
	// in sync, so this only says how to spell it.
	setSliderDisplay(
		slider,
		(v) => `${spec.prefix ?? ""}${v.toFixed(spec.decimals)}${spec.suffix ?? ""}`,
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
	// Obsidian's `setValue` calls the change callback when the value differs,
	// so showing a value again (below) would commit it a second time. While
	// `syncing`, the callback lets that call pass.
	let syncing = false;
	slider.onChange(async (v) => {
		if (syncing) return;
		// `change` marks the end of a drag (release) as well as commit.
		endDrag();
		spec.set(round(v));
		await commit();
	});
	return () => {
		frame = cancelFrame(frame);
		syncing = true;
		slider.setValue(spec.get());
		syncing = false;
		endDrag();
	};
}
