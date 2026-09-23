import { makeDragSortable } from "../../src/ui/DragSortList";
import { asEl, el, type FakeElement } from "./fakeDom";

/** Animations stay pending until a test finishes them, exposing rapid gestures. */
export class DragAnimation extends EventTarget {
	running = true;
	cancelled = false;
	constructor(readonly row: FakeElement, readonly transform: string) {
		super();
	}
	cancel(): void {
		this.cancelled = true;
		this.running = false;
		this.dispatchEvent(new Event("cancel"));
	}
	finish(): void {
		if (!this.running) return;
		this.running = false;
		this.dispatchEvent(new Event("finish"));
	}
}

function translation(transform: unknown): number {
	return Number(/translateY\(([-\d.]+)px\)/.exec(String(transform))?.[1] ?? 0);
}

export function dragSortHarness(options: {
	reducedMotion?: boolean;
	groups?: boolean[];
} = {}) {
	Object.assign(window, {
		matchMedia: () => ({ matches: options.reducedMotion ?? false }),
	});
	const list = el();
	const animations: DragAnimation[] = [];
	const model = ["a", "b", "c", "d"];
	const moves: Array<[number, number]> = [];
	let captured: number | undefined;
	const listEl = asEl(list);
	listEl.setPointerCapture = (id) => { captured = id; };
	listEl.hasPointerCapture = (id) => captured === id;
	listEl.releasePointerCapture = (id) => {
		if (captured !== id) return;
		captured = undefined;
		list.fire("lostpointercapture", { pointerId: id });
	};
	const rows = model.map((id, index) => {
		const row = list.createDiv({ cls: "test-drag-row" });
		row.dataset.id = id;
		if (options.groups?.[index]) row.addClass("is-disabled");
		row.createDiv({ cls: "test-drag-handle" }).createEl("svg");
		Object.defineProperty(row, "nextElementSibling", {
			get: () => list.children[list.children.indexOf(row) + 1] ?? null,
		});
		Object.assign(row, { instanceOf: (ctor: typeof FakeElement) => row instanceof ctor });
		row.style.removeProperty = (name: string) => { delete row.style[name]; };
		asEl(row).animate = (frames) => {
			const first = (frames as Keyframe[])[0];
			const animation = new DragAnimation(row, String(first?.transform ?? ""));
			animations.push(animation);
			return animation as unknown as Animation;
		};
		row.getBoundingClientRect = () => {
			const active = animations.filter((animation) => animation.row === row && animation.running).at(-1);
			const offset = translation(active?.transform ?? row.style.transform);
			const top = list.children.indexOf(row) * 40 + offset;
			return {
				x: 0, y: top, top, bottom: top + 36, left: 0, right: 240,
				width: 240, height: 36, toJSON: () => ({}),
			};
		};
		return row;
	});
	const cleanup = makeDragSortable(listEl, {
		rowSelector: ".test-drag-row",
		handleSelector: ".test-drag-handle",
		groupOf: options.groups ? (row) => row.hasClass("is-disabled") : undefined,
		onReorder: (from, to) => {
			moves.push([from, to]);
			model.splice(to, 0, model.splice(from, 1)[0]!);
		},
	});
	const event = (pointerId: number, clientY: number, target: FakeElement = list) => ({
		pointerId, clientY, target, button: 0, preventDefault: () => {},
	});
	const down = (row: FakeElement, pointerId = 1) => {
		const y = row.getBoundingClientRect().top + 18;
		list.fire("pointerdown", event(pointerId, y, row.querySelector("svg")!));
	};
	return {
		list, rows, model, moves, animations, down, cleanup,
		move: (y: number, id = 1) => list.fire("pointermove", event(id, y)),
		up: (id = 1) => list.fire("pointerup", event(id, 0)),
		cancel: (id = 1) => list.fire("pointercancel", event(id, 0)),
		loseCapture: (id = 1) => {
			captured = undefined;
			list.fire("lostpointercapture", event(id, 0));
		},
		captured: () => captured,
		order: () => list.children.map((row) => row.dataset.id),
		finishAnimations: () => {
			for (const animation of [...animations]) animation.finish();
		},
	};
}
