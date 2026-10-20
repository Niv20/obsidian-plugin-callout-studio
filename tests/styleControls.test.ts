/**
 * tests/styleControls.test.ts — the shared slider row, and the live-update
 * contract every global style control follows.
 *
 * Three things here are easy to break without noticing, and each shows up as
 * something other than an error:
 *
 * - **The readout's width.** It shares a flex row with a track that takes
 *   whatever width it leaves, so a readout that grows by a character shrinks
 *   the slider *under the user's cursor* mid-drag. That is why the format is a
 *   fixed decimal count plus a constant unit, and why `decimals` is not merely
 *   a rounding setting.
 * - **The order of `setLimits` and `setValue`.** Nothing in this module clamps.
 *   The `<input type="range">` does, which means the limits have to be in place
 *   before a value is handed to it — get that backwards and a stored value
 *   outside the range survives into the control.
 * - **One inject per frame.** The per-move reflow is coalesced through
 *   `requestAnimationFrame`, so a fast drag repaints every frame (~60fps)
 *   instead of stalling behind a debounce until the thumb stops. A missing
 *   latch is not a wrong picture, only a slow one, and only on a fast drag.
 *
 * The drag lifecycle is the fourth: several DOM events can each signal a start
 * or an end (pointer vs. keyboard), and a caller swapping in a bespoke preview
 * for the duration must see exactly one start and one end per drag.
 */
import {
	asEl,
	fakeDom,
	FakeDocument,
	FakeWindow,
	type FakeElement,
} from "./support/fakeDom";
import assert from "node:assert";
import { describe, it } from "node:test";
import { createdSliders } from "./support/obsidianStub";
import type { SliderComponent } from "obsidian";
import {
	addStyleSlider,
	createSliderRow,
	setSliderDisplay,
	type StyleSliderSpec,
} from "../src/settings/styleControls";
import type { SettingsTabPlugin } from "../src/settings/sections/types";

/* -------------------------------------------------------------------------- */
/* Harness                                                                    */
/* -------------------------------------------------------------------------- */

type Harness = {
	/**
	 * Cast once here rather than at each of the three dozen call sites below:
	 * `addStyleSlider` and `createSliderRow` are typed against the real DOM, and
	 * nothing in this suite asks the parent for anything a real `HTMLElement`
	 * could not answer — it is passed straight through, compared for identity,
	 * and read via `children` / `querySelector`.
	 */
	parent: HTMLElement;
	plugin: SettingsTabPlugin;
	/** Every `cssInjector.inject(...)` argument, in order. */
	injects: Array<boolean | undefined>;
	saves: number;
	slider: () => SliderComponent;
	sliderEl: () => FakeElement;
	/** Move the thumb the way a pointer drag does. */
	drag: (value: number) => void;
};

/**
 * A parent element, a plugin, and a way to reach whatever slider gets built
 * into it. Clears the shared state first — the document, any frame the last
 * case left queued, and the stub's list of constructed sliders — so every test
 * starts from the same screen. Called first by every case here, which is what
 * lets the suite go without setup hooks like the rest of `tests/`.
 */
function harness(): Harness {
	createdSliders.length = 0;
	fakeDom.window.flushFrames();
	fakeDom.document.body.empty();

	const parent = asEl(fakeDom.document.body.createDiv({}));
	const injects: Array<boolean | undefined> = [];
	const state = { saves: 0 };

	const plugin = {
		cssInjector: {
			inject: (rerender?: boolean) => {
				injects.push(rerender);
			},
		},
		saveSettings: () => {
			state.saves++;
			return Promise.resolve();
		},
	} as unknown as SettingsTabPlugin;

	const slider = (): SliderComponent => {
		const built = createdSliders.at(-1);
		assert.ok(built, "no slider was built");
		return built as unknown as SliderComponent;
	};
	const sliderEl = (): FakeElement =>
		(slider() as unknown as { sliderEl: FakeElement }).sliderEl;

	return {
		parent,
		plugin,
		injects,
		get saves() {
			return state.saves;
		},
		slider,
		sliderEl,
		drag: (value: number) => {
			const el = sliderEl();
			el.value = String(value);
			el.fire("input");
		},
	};
}

/** The spec `addStyleSlider` is normally handed, over a mutable value. */
function spec(over: Partial<StyleSliderSpec> = {}): StyleSliderSpec & {
	written: number[];
} {
	const written: number[] = [];
	let value = 2;
	return {
		label: "Border width",
		min: 1,
		max: 4,
		step: 0.5,
		decimals: 1,
		suffix: "px",
		get: () => value,
		set: (v: number) => {
			value = v;
			written.push(v);
		},
		written,
		...over,
	};
}

/* -------------------------------------------------------------------------- */
/* setSliderDisplay                                                           */
/* -------------------------------------------------------------------------- */

describe("setSliderDisplay", () => {
	it("installs the formatter on a build that has the readout", () => {
		const h = harness();
		addStyleSlider(h.plugin, h.parent, spec());
		const format = (
			h.slider() as unknown as { displayFormat: (v: number) => string }
		).displayFormat;
		assert.strictEqual(typeof format, "function");
	});

	it("is a no-op on a build that does not", () => {
		// `setDisplayFormat` arrived in Obsidian 1.13. It is in neither the
		// 1.10.3 typings this repo builds against nor the runtime of the older
		// builds the manifest still supports, so it is reached optionally — and
		// those builds simply show the slider alone, exactly as before.
		const older = { setValue: () => {} } as unknown as SliderComponent;
		assert.doesNotThrow(() => setSliderDisplay(older, (v) => `${v}`));
	});

	it("passes the formatter through unchanged", () => {
		const format = (v: number): string => `~${v}~`;
		const captured: Array<(v: number) => string> = [];
		const component = {
			setDisplayFormat: (f: (v: number) => string) => captured.push(f),
		} as unknown as SliderComponent;
		setSliderDisplay(component, format);
		assert.deepStrictEqual(captured, [format]);
	});
});

/* -------------------------------------------------------------------------- */
/* createSliderRow                                                            */
/* -------------------------------------------------------------------------- */

describe("createSliderRow", () => {
	it("appends a row to the parent and hands it back", () => {
		const h = harness();
		const row = createSliderRow(h.parent, "Radius");
		assert.ok(row.hasClass("callout-studio-slider-row"));
		assert.strictEqual(row.parentElement, h.parent);
	});

	it("puts the label in its own element above the track", () => {
		// Its own element because Obsidian's value readout goes beside it, and
		// styles.css reserves a width there so the readout cannot squeeze the
		// track as it changes.
		const row = createSliderRow(harness().parent, "Radius");
		const label = row.querySelector(".callout-studio-slider-label");
		assert.ok(label);
		assert.strictEqual(label.textContent, "Radius");
	});

	it("returns the row, not the label — a Setting is built into it", () => {
		// The palette editor's Intensity slider uses this without the
		// live-update contract below, and fills the row itself.
		const row = createSliderRow(harness().parent, "Radius");
		assert.strictEqual(row.hasClass("callout-studio-slider-label"), false);
	});

	it("gives each call its own row", () => {
		const h = harness();
		const a = createSliderRow(h.parent, "A");
		const b = createSliderRow(h.parent, "B");
		assert.notStrictEqual(a, b);
		assert.strictEqual(h.parent.children.length, 2);
	});
});

/* -------------------------------------------------------------------------- */
/* addStyleSlider — setup                                                     */
/* -------------------------------------------------------------------------- */

describe("addStyleSlider — how the control starts out", () => {
	it("builds the same labelled row", () => {
		const h = harness();
		addStyleSlider(h.plugin, h.parent, spec());
		const row = h.parent.querySelector(".callout-studio-slider-row");
		assert.ok(row);
		assert.strictEqual(
			row.querySelector(".callout-studio-slider-label")?.textContent,
			"Border width",
		);
	});

	it("sets the limits BEFORE the value", () => {
		// Nothing in this module clamps — the range input does, and only once it
		// knows its own bounds. Reversed, a stored value outside the range would
		// survive into the control.
		const h = harness();
		addStyleSlider(h.plugin, h.parent, spec());
		const calls = (h.slider() as unknown as { calls: string[] }).calls;
		assert.deepStrictEqual(calls, ["setLimits", "setValue"]);
	});

	it("passes the spec's limits through as they are", () => {
		const h = harness();
		addStyleSlider(h.plugin, h.parent, spec());
		const s = h.slider() as unknown as {
			min: number;
			max: number;
			step: number;
		};
		assert.deepStrictEqual([s.min, s.max, s.step], [1, 4, 0.5]);
	});

	it("seeds the control from the value the settings hold now", () => {
		const h = harness();
		addStyleSlider(h.plugin, h.parent, spec({ get: () => 3 }));
		assert.strictEqual(h.sliderEl().value, "3");
	});

	it("writes nothing back, and repaints nothing, just for being built", () => {
		const h = harness();
		const s = spec();
		addStyleSlider(h.plugin, h.parent, s);
		assert.deepStrictEqual(s.written, []);
		assert.deepStrictEqual(h.injects, []);
	});
});

describe("addStyleSlider — the readout", () => {
	const readout = (over: Partial<StyleSliderSpec> = {}): ((v: number) => string) => {
		const h = harness();
		addStyleSlider(h.plugin, h.parent, spec(over));
		return (h.slider() as unknown as { displayFormat: (v: number) => string })
			.displayFormat;
	};

	it("appends the unit", () => {
		assert.strictEqual(readout()(2), "2.0px");
	});

	it("prepends a marker when one is given", () => {
		assert.strictEqual(
			readout({ prefix: "×", suffix: undefined, decimals: 2 })(1.5),
			"×1.50",
		);
	});

	it("keeps the digit count fixed, whatever the value", () => {
		// The whole reason `decimals` exists: a readout that gains a character
		// mid-drag shrinks the track under the cursor.
		const format = readout({ decimals: 2, suffix: "px" });
		for (const [value, expected] of [
			[1, "1.00px"],
			[1.5, "1.50px"],
			[1.25, "1.25px"],
		] as Array<[number, string]>) {
			assert.strictEqual(format(value), expected);
			assert.strictEqual(format(value).length, expected.length);
		}
	});

	it("draws a bare number when there is no unit or marker", () => {
		assert.strictEqual(
			readout({ suffix: undefined, decimals: 0 })(12),
			"12",
		);
	});
});

/* -------------------------------------------------------------------------- */
/* addStyleSlider — dragging                                                  */
/* -------------------------------------------------------------------------- */

describe("addStyleSlider — moving the thumb", () => {
	it("writes the value straight through to the setting", () => {
		const h = harness();
		const s = spec();
		addStyleSlider(h.plugin, h.parent, s);
		h.drag(3);
		assert.deepStrictEqual(s.written, [3]);
	});

	it("rounds to the spec's decimal count on the way", () => {
		const h = harness();
		const s = spec({ decimals: 1 });
		addStyleSlider(h.plugin, h.parent, s);
		h.drag(1.26);
		h.drag(1.24);
		assert.deepStrictEqual(s.written, [1.3, 1.2]);
	});

	it("rounds to whole numbers at zero decimals", () => {
		const h = harness();
		const s = spec({ decimals: 0 });
		addStyleSlider(h.plugin, h.parent, s);
		h.drag(2.5);
		h.drag(2.4);
		assert.deepStrictEqual(s.written, [3, 2]);
	});

	it("does NOT clamp — that is the range input's job", () => {
		// Documented rather than assumed. A real `<input type="range">` cannot
		// hand back a value outside the limits set above, which is why this
		// module never re-checks them; the assertion says where the clamp lives
		// so a change of harness cannot quietly make that untrue.
		const h = harness();
		const s = spec();
		addStyleSlider(h.plugin, h.parent, s);
		h.drag(999);
		assert.deepStrictEqual(s.written, [999]);
	});

	it("saves nothing while the thumb is still moving", () => {
		// Dragging previews; releasing commits.
		const h = harness();
		addStyleSlider(h.plugin, h.parent, spec());
		h.drag(3);
		fakeDom.window.flushFrames();
		assert.strictEqual(h.saves, 0);
	});
});

describe("addStyleSlider — one inject per frame", () => {
	it("does not repaint synchronously with the move", () => {
		const h = harness();
		addStyleSlider(h.plugin, h.parent, spec());
		h.drag(3);
		assert.deepStrictEqual(h.injects, []);
	});

	it("repaints once on the next frame", () => {
		const h = harness();
		addStyleSlider(h.plugin, h.parent, spec());
		h.drag(3);
		fakeDom.window.flushFrames();
		assert.deepStrictEqual(h.injects, [false]);
	});

	it("coalesces a burst of moves into that one repaint", () => {
		const h = harness();
		addStyleSlider(h.plugin, h.parent, spec());
		for (const v of [1.5, 2, 2.5, 3, 3.5]) h.drag(v);
		fakeDom.window.flushFrames();
		assert.deepStrictEqual(h.injects, [false]);
	});

	it("keeps the setting up to date on every one of them all the same", () => {
		// Coalescing the *paint* must not coalesce the value, or the callout
		// would settle on whichever move happened to win the frame.
		const h = harness();
		const s = spec();
		addStyleSlider(h.plugin, h.parent, s);
		for (const v of [1.5, 2, 2.5]) h.drag(v);
		assert.deepStrictEqual(s.written, [1.5, 2, 2.5]);
	});

	it("takes another frame for the next move", () => {
		const h = harness();
		addStyleSlider(h.plugin, h.parent, spec());
		h.drag(2);
		fakeDom.window.flushFrames();
		h.drag(3);
		fakeDom.window.flushFrames();
		assert.deepStrictEqual(h.injects, [false, false]);
	});

	it("asks the frame of the window the slider is in, not the main one", () => {
		// Obsidian 1.14 opens the settings as a window of their own. A frame
		// asked of the main window is held back while that window is hidden
		// behind them, so the drag would preview nothing until they closed.
		const h = harness();
		const settingsWindow = new FakeWindow();
		const parent = asEl(new FakeDocument(settingsWindow).body.createDiv({}));
		addStyleSlider(h.plugin, parent, spec());
		h.drag(3);
		fakeDom.window.flushFrames();
		assert.deepStrictEqual(h.injects, [], "the main window's frame ran the repaint");
		settingsWindow.flushFrames();
		assert.deepStrictEqual(h.injects, [false]);
	});

	it("skips the css-change re-render while dragging", () => {
		// `false` is the argument, and it is the reason a drag stays cheap:
		// geometry rides CSS variables and reflows when the stylesheet is
		// replaced, so forcing every open note to re-render would buy nothing.
		const h = harness();
		addStyleSlider(h.plugin, h.parent, spec());
		h.drag(3);
		fakeDom.window.flushFrames();
		assert.strictEqual(h.injects[0], false);
	});
});

describe("addStyleSlider — releasing the thumb", () => {
	it("repaints in full, and saves", async () => {
		const h = harness();
		const s = spec();
		addStyleSlider(h.plugin, h.parent, s);
		await (h.slider() as unknown as { commit(v: number): Promise<void> }).commit(
			3,
		);
		assert.deepStrictEqual(s.written, [3]);
		assert.strictEqual(h.saves, 1);
		// No argument this time: the commit DOES want the css-change re-render.
		assert.deepStrictEqual(h.injects, [undefined]);
	});

	it("repaints without waiting for the save", () => {
		// A save reads the file back, writes a recovery copy and queues behind
		// any save under way, and a failed one rejects. Painted after it, the
		// change waited on the disk — or never showed until something else
		// injected.
		const h = harness();
		(h.plugin as unknown as { saveSettings(): Promise<void> }).saveSettings = () =>
			new Promise<void>(() => {});
		addStyleSlider(h.plugin, h.parent, spec());
		void (h.slider() as unknown as { commit(v: number): Promise<void> }).commit(3);
		assert.deepStrictEqual(h.injects, [undefined]);
	});

	it("rounds the committed value too", async () => {
		const h = harness();
		const s = spec({ decimals: 1 });
		addStyleSlider(h.plugin, h.parent, s);
		await (h.slider() as unknown as { commit(v: number): Promise<void> }).commit(
			2.449,
		);
		assert.deepStrictEqual(s.written, [2.4]);
	});
});

/* -------------------------------------------------------------------------- */
/* addStyleSlider — the drag lifecycle                                        */
/* -------------------------------------------------------------------------- */

describe("addStyleSlider — start and end, exactly once each", () => {
	/** A spec that records the lifecycle callbacks in order. */
	function lifecycle(): { spec: StyleSliderSpec; log: string[] } {
		const log: string[] = [];
		return {
			spec: spec({
				onDragStart: () => log.push("start"),
				onDragEnd: () => log.push("end"),
			}),
			log,
		};
	}

	it("starts on pointer-down and ends on pointer-up", () => {
		const h = harness();
		const { spec: s, log } = lifecycle();
		addStyleSlider(h.plugin, h.parent, s);
		h.sliderEl().fire("pointerdown");
		h.sliderEl().fire("pointerup");
		assert.deepStrictEqual(log, ["start", "end"]);
	});

	it("ends on a cancelled pointer too", () => {
		const h = harness();
		const { spec: s, log } = lifecycle();
		addStyleSlider(h.plugin, h.parent, s);
		h.sliderEl().fire("pointerdown");
		h.sliderEl().fire("pointercancel");
		assert.deepStrictEqual(log, ["start", "end"]);
	});

	it("does not re-announce the start on every move", () => {
		// A pointer drag fires `input` continuously; a caller swapping in a
		// bespoke preview must not be told to swap it in again each time.
		const h = harness();
		const { spec: s, log } = lifecycle();
		addStyleSlider(h.plugin, h.parent, s);
		h.sliderEl().fire("pointerdown");
		for (const v of [2, 2.5, 3]) h.drag(v);
		assert.deepStrictEqual(log, ["start"]);
	});

	it("starts from a keyboard nudge, which fires no pointer event at all", () => {
		const h = harness();
		const { spec: s, log } = lifecycle();
		addStyleSlider(h.plugin, h.parent, s);
		h.drag(2.5);
		assert.deepStrictEqual(log, ["start"]);
	});

	it("treats the commit as the end of the drag", () => {
		const h = harness();
		const { spec: s, log } = lifecycle();
		addStyleSlider(h.plugin, h.parent, s);
		h.drag(2.5);
		void (h.slider() as unknown as { commit(v: number): unknown }).commit(2.5);
		assert.deepStrictEqual(log, ["start", "end"]);
	});

	it("does not announce an end that never began", () => {
		const h = harness();
		const { spec: s, log } = lifecycle();
		addStyleSlider(h.plugin, h.parent, s);
		h.sliderEl().fire("pointerup");
		void (h.slider() as unknown as { commit(v: number): unknown }).commit(2);
		assert.deepStrictEqual(log, []);
	});

	it("can be dragged again after it ended", () => {
		const h = harness();
		const { spec: s, log } = lifecycle();
		addStyleSlider(h.plugin, h.parent, s);
		h.sliderEl().fire("pointerdown");
		h.sliderEl().fire("pointerup");
		h.sliderEl().fire("pointerdown");
		h.sliderEl().fire("pointerup");
		assert.deepStrictEqual(log, ["start", "end", "start", "end"]);
	});

	it("gets by without either callback", () => {
		// Most sliders have no bespoke preview to swap in, and the pointer
		// listeners are only hung when one of the two is given.
		const h = harness();
		addStyleSlider(h.plugin, h.parent, spec());
		assert.doesNotThrow(() => {
			h.sliderEl().fire("pointerdown");
			h.sliderEl().fire("pointerup");
		});
	});
});
