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

/** The box DragSortList lays its drop placeholder over, read back from the box. */
export interface PlaceholderBox {
	top: number;
	left: number;
	width: number;
	height: number;
}

/** Class of DragSortList's drop placeholder. */
const PLACEHOLDER = "cs-drag-placeholder";

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
	const isPlaceholder = (child: FakeElement): boolean => child.hasClass(PLACEHOLDER);
	/** The list's children in layout order: the placeholder is positioned, out of the flow. */
	const flow = (): FakeElement[] => list.children.filter((child) => !isPlaceholder(child));
	/** The translation of `node`'s latest running animation, else of its inline transform. */
	const shift = (node: FakeElement): number => {
		const active = animations.filter((animation) => animation.row === node && animation.running).at(-1);
		return translation(active?.transform ?? node.style.transform);
	};
	/** What the FLIP needs of every element it may slide: its type, and animations. */
	const animatable = (node: FakeElement): void => {
		Object.assign(node, { instanceOf: (ctor: typeof FakeElement) => node instanceof ctor });
		asEl(node).animate = (frames) => {
			const first = (frames as Keyframe[])[0];
			const animation = new DragAnimation(node, String(first?.transform ?? ""));
			animations.push(animation);
			return animation as unknown as Animation;
		};
	};
	const rect = (top: number, left: number, width: number, height: number): DOMRect => ({
		x: left, y: top, top, bottom: top + height, left, right: left + width,
		width, height, toJSON: () => ({}),
	});
	const rows = model.map((id, index) => {
		const row = list.createDiv({ cls: "test-drag-row" });
		row.dataset.id = id;
		if (options.groups?.[index]) row.addClass("is-disabled");
		row.createDiv({ cls: "test-drag-handle" }).createEl("svg");
		Object.defineProperty(row, "nextElementSibling", {
			get: () => list.children[list.children.indexOf(row) + 1] ?? null,
		});
		row.style.removeProperty = (name: string) => { delete row.style[name]; };
		animatable(row);
		row.getBoundingClientRect = () => rect(flow().indexOf(row) * 40 + shift(row), 0, 240, 36);
		return row;
	});
	/** The placeholder's own box, as DragSortList placed it. */
	const slot = (box: FakeElement): PlaceholderBox => {
		const px = (name: string): number =>
			parseFloat(box.style.getPropertyValue(`--cs-drag-placeholder-${name}`));
		return { top: px("top"), left: px("left"), width: px("width"), height: px("height") };
	};
	/**
	 * A placeholder is drawn by DragSortList itself, so it gets the stand-ins a
	 * row gets above when it appears, and is laid out from what it was handed.
	 */
	const patched = new WeakSet<FakeElement>();
	const patchPlaceholder = (): void => {
		for (const box of list.children.filter(isPlaceholder)) {
			if (patched.has(box)) continue;
			patched.add(box);
			animatable(box);
			box.getBoundingClientRect = () => {
				const { top, left, width, height } = slot(box);
				return rect(top + shift(box), left, width, height);
			};
		}
	};
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
		patchPlaceholder();
	};
	return {
		list, rows, model, moves, animations, down, cleanup, slot,
		move: (y: number, id = 1) => list.fire("pointermove", event(id, y)),
		up: (id = 1) => list.fire("pointerup", event(id, 0)),
		cancel: (id = 1) => list.fire("pointercancel", event(id, 0)),
		loseCapture: (id = 1) => {
			captured = undefined;
			list.fire("lostpointercapture", event(id, 0));
		},
		captured: () => captured,
		order: () => flow().map((row) => row.dataset.id),
		/** Every drop placeholder in the list — there should never be two. */
		placeholders: () => list.children.filter(isPlaceholder),
		finishAnimations: () => {
			for (const animation of [...animations]) animation.finish();
		},
	};
}
