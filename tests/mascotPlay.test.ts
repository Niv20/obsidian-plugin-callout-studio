/**
 * tests/mascotPlay.test.ts — what the brush mascot does when the pointer plays
 * with it (ui/mascot/mascotPlay.ts).
 *
 * Coming near makes a mascot that is only the icon blink; a press dents it and
 * screws its eyes shut; four quick presses make it angry. All of that holds for
 * every mascot, whatever mood it holds (sad, scared): the squint and the
 * glare go on top of the mood and it comes back when they are over. A notice's
 * mascot is not played with at all. The mascot runs on its manual clock, so each
 * test says when time passes.
 */
// First, so the fake DOM exists before anything that needs a page is loaded.
import { asEl, el, fakeDom, type FakeElement } from "./support/fakeDom";
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { BrushMascot } from "../src/ui/mascot/brushMascot";
import { addMascot } from "../src/ui/mascot/mascotPlaces";

const globals = globalThis as Record<string, unknown>;

beforeEach(() => {
	const createEl = globals.createEl as (tag: string, options?: unknown) => FakeElement;
	globals.createSvg = (tag: string, options?: unknown) => createEl(tag, options);
});
afterEach(() => {
	delete globals.createSvg;
});

/** A 48px mascot at the page's top left, played with through its own box. */
function setup(options: { interactive?: boolean } = {}) {
	const zone = el();
	const mascot = new BrushMascot(asEl(zone), { manual: true, ...options });
	(mascot.svg as unknown as { getBoundingClientRect: () => object }).getBoundingClientRect = () => ({
		left: 0,
		top: 0,
		width: 48,
		height: 48,
	});
	const svg = mascot.svg as unknown as FakeElement;
	const body = svg.children[1]!;
	/** A pointer event at (x, y) on the page, 2px to the pixel on the 24-unit icon. */
	const fire = (type: string, extra: object = {}): void =>
		zone.fire(type, { type, pointerType: "mouse", button: 0, clientX: 24, clientY: 24, ...extra });
	const run = (ms: number): void => {
		for (let t = 0; t < ms; t += 16) mascot.advance(16);
	};
	return { zone, mascot, svg, body, fire, run };
}

describe("a mascot the pointer can play with", () => {
	it("is marked, so styles.css gives it room around the icon", () => {
		const { zone } = setup();
		assert.ok(zone.hasClass("is-playful"));
	});

	it("blinks when the pointer comes near, and goes back to the icon when it leaves", () => {
		const { mascot, fire, run } = setup();
		fire("pointerenter");
		run(60);
		assert.equal(mascot.current, "notice");
		run(4000);
		assert.equal(mascot.current, "notice", "it stays as long as the pointer does");
		fire("pointerleave");
		run(1500);
		assert.equal(mascot.current, null);
	});

	it("does not blink for a finger: a touch has no hover", () => {
		const { mascot, fire, run } = setup();
		fire("pointerenter", { pointerType: "touch" });
		run(100);
		assert.equal(mascot.current, null);
	});

	it("turns its eyes toward the pointer, and back when it leaves", () => {
		const { mascot, svg, fire, run } = setup();
		const eyePath = () => svg.children[1]!.children[3]!.getAttribute("d");
		fire("pointerenter", { clientX: 24, clientY: 24 });
		run(700);
		const straight = eyePath();
		fire("pointermove", { clientX: 60, clientY: 24 }); // well to the right
		run(400);
		assert.notEqual(eyePath(), straight, "the eyes moved");
		fire("pointerleave");
		run(1500);
		assert.equal(mascot.current, null);
	});

	it("dents where it was pressed, keeps the dent while pressed, and springs back", () => {
		const { mascot, body, fire, run } = setup();
		fire("pointerdown", { clientX: 46, clientY: 26 }); // the right edge
		run(300);
		const dented = body.getAttribute("transform") ?? "";
		assert.match(dented, /matrix\(/);
		run(1000);
		assert.equal(body.getAttribute("transform")?.includes("matrix(") ?? false, true, "still pressed in");
		fire("pointerup");
		run(2500);
		assert.equal(mascot.current, null);
		assert.equal(body.hasAttribute("transform"), false, "flat again");
	});

	it("screws its eyes shut while it is pressed, and opens them when it is let go", () => {
		const { mascot, fire, run } = setup();
		fire("pointerdown");
		run(100);
		assert.equal(mascot.current, "ouch");
		fire("pointerup");
		run(1500);
		assert.equal(mascot.current, null);
	});

	it("lets go when the pointer leaves with the button still down", () => {
		const { mascot, fire, run } = setup();
		fire("pointerdown");
		run(100);
		fire("pointerleave");
		run(2500);
		assert.equal(mascot.current, null);
	});

	describe("a tap with a finger", () => {
		beforeEach(() => fakeDom.window.clearTimers());
		afterEach(() => fakeDom.window.clearTimers());

		it("stays squinting and dented for a moment after the finger lifts, then lets go", () => {
			const { mascot, body, fire, run } = setup();
			fire("pointerdown", { pointerType: "touch", clientX: 46, clientY: 26 });
			run(100);
			fire("pointerup", { pointerType: "touch" });
			fire("pointerleave", { pointerType: "touch" }); // a finger leaves right after it lifts
			run(1500);
			assert.equal(mascot.current, "ouch", "the squint outlasts the tap");
			assert.match(body.getAttribute("transform") ?? "", /matrix\(/, "and so does the dent");
			fakeDom.window.flushTimers();
			run(2500);
			assert.equal(mascot.current, null);
			assert.equal(body.hasAttribute("transform"), false, "flat again");
		});

		it("lets go at once when the finger went on to scroll", () => {
			const { mascot, fire, run } = setup();
			fire("pointerdown", { pointerType: "touch" });
			run(100);
			fire("pointercancel", { pointerType: "touch" });
			fire("pointerleave", { pointerType: "touch" });
			run(1500);
			assert.equal(mascot.current, null);
			assert.equal(fakeDom.window.pendingTimers(), 0);
		});

		it("carries on from where it is when tapped again during the afterglow", () => {
			const { mascot, fire, run } = setup();
			fire("pointerdown", { pointerType: "touch" });
			run(100);
			fire("pointerup", { pointerType: "touch" });
			fire("pointerdown", { pointerType: "touch" });
			assert.equal(fakeDom.window.pendingTimers(), 0, "the first tap's timer is gone");
			run(1500);
			assert.equal(mascot.current, "ouch", "pressed, so it stays pressed");
			fire("pointerup", { pointerType: "touch" });
			fakeDom.window.flushTimers();
			run(2500);
			assert.equal(mascot.current, null);
		});

		it("lets go straight away for a mouse, as before", () => {
			const { mascot, fire, run } = setup();
			fire("pointerdown");
			run(100);
			fire("pointerup");
			assert.equal(fakeDom.window.pendingTimers(), 0);
			run(1500);
			assert.equal(mascot.current, null);
		});

		it("takes the afterglow away when the mascot is destroyed", () => {
			const { mascot, fire, run } = setup();
			fire("pointerdown", { pointerType: "touch" });
			run(100);
			fire("pointerup", { pointerType: "touch" });
			assert.equal(fakeDom.window.pendingTimers(), 1);
			mascot.destroy();
			assert.equal(fakeDom.window.pendingTimers(), 0);
		});
	});

	it("loses its temper at the fourth quick press", () => {
		const { mascot, fire, run } = setup();
		for (let press = 1; press <= 3; press++) {
			fire("pointerdown");
			run(60);
			fire("pointerup");
			run(60);
			assert.notEqual(mascot.current, "angry", `press ${press} is still just a poke`);
		}
		fire("pointerdown");
		run(100);
		assert.equal(mascot.current, "angry");
		fire("pointerup");
		run(5000);
		assert.equal(mascot.current, null, "and calms down again");
	});

	it("ignores a right click", () => {
		const { mascot, body, fire, run } = setup();
		fire("pointerdown", { button: 2 });
		run(100);
		assert.equal(mascot.current, null);
		assert.equal(body.hasAttribute("transform"), false);
	});

	it("keeps somebody else's mood when the pointer only comes near", () => {
		const { mascot, fire, run } = setup();
		const sad = mascot.hold("sad");
		run(200);
		fire("pointerenter");
		run(200);
		assert.equal(mascot.current, "sad", "no blinking over a mood");
		sad.release();
		run(3000);
		assert.equal(mascot.current, null);
	});

	it("squints when pressed over a mood, and goes back to the mood when let go", () => {
		const { mascot, body, fire, run } = setup();
		const mood = mascot.hold("sad");
		run(1500);
		fire("pointerdown");
		run(150);
		assert.equal(mascot.current, "ouch");
		assert.match(body.getAttribute("transform") ?? "", /matrix\(/, "and it sinks in as well");
		fire("pointerup");
		run(1500);
		assert.equal(mascot.current, "sad");
		mood.release();
		run(3000);
		assert.equal(mascot.current, null);
	});

	it("loses its temper over a mood too, and then goes back to the mood without the glare", () => {
		const { mascot, svg, fire, run } = setup();
		const cheeks = (): (string | null)[] =>
			[5, 6].map((i) => svg.children[1]!.children[i]!.getAttribute("opacity"));
		const mood = mascot.hold("sad");
		run(1500);
		for (let press = 1; press <= 4; press++) {
			fire("pointerdown");
			run(60);
			fire("pointerup");
			run(60);
		}
		assert.equal(mascot.current, "angry");
		// The squint comes first (90 ms) and then the crouch; the cheeks go red with the glare.
		run(200);
		assert.notDeepEqual(cheeks(), ["0", "0"], "red in the face");
		run(5000);
		assert.equal(mascot.current, "sad");
		assert.deepEqual(cheeks(), ["0", "0"], "the red is gone");
		mood.release();
		run(3000);
		assert.equal(mascot.current, null);
	});

	for (const mood of [null, "sad", "scared", "hello"] as const) {
		it(`squints on the way to anger on the fourth press, whatever it was showing (${mood ?? "the plain icon"})`, () => {
			const { mascot, svg, fire, run } = setup();
			const held = mood ? mascot.hold(mood) : null;
			run(1500);
			for (let press = 1; press <= 3; press++) {
				fire("pointerdown");
				run(60);
				fire("pointerup");
				run(1200);
			}
			// The fourth press: every frame from here on, how wide is the left eye's stroke
			// and is the mouth filled in (only the squint's open mouth is, of these faces)?
			fire("pointerdown");
			const widths: number[] = [];
			let openMouth = false;
			for (let t = 0; t < 400; t += 16) {
				mascot.advance(16);
				widths.push(Number(svg.children[1]!.children[3]!.getAttribute("stroke-width")));
				if (svg.children[1]!.children[2]!.getAttribute("fill") === "currentColor") openMouth = true;
			}
			assert.equal(mascot.current, "angry");
			assert.ok(Math.min(...widths) <= 1.55, "the eyes screw shut (> <) before they glare");
			assert.ok(openMouth, "and the mouth opens in the squint");
			fire("pointerup");
			held?.release();
		});
	}

	for (const name of ["sad", "scared", "hold", "hello", "look", "relief", "paint"] as const) {
		it(`comes back from a press with the closed mouth of "${name}", not the open mouth of the squint`, () => {
			const { mascot, svg, fire, run } = setup();
			const mood = mascot.hold(name);
			run(1500);
			fire("pointerdown");
			run(200);
			assert.equal(
				svg.children[1]!.children[2]!.getAttribute("fill"),
				"currentColor",
				"the squint's mouth is open",
			);
			fire("pointerup");
			run(1500);
			assert.equal(mascot.current, name);
			assert.equal(svg.children[1]!.children[2]!.getAttribute("fill"), "none");
			mood.release();
		});
	}

	it("is not played with when it is a notice's: nothing is added to the box", () => {
		const parent = el();
		const mascot = addMascot(asEl(parent), "notice");
		assert.ok(mascot);
		assert.equal(parent.querySelector(".cs-mascot-box")?.hasClass("is-playful"), false);
		const box = addMascot(asEl(parent), "medium");
		assert.ok(box);
		assert.equal(parent.querySelectorAll(".cs-mascot-box")[1]?.hasClass("is-playful"), true, "every other size is");
	});

	it("takes its marks and its listeners away when it is destroyed", () => {
		const { zone, mascot, fire, run } = setup();
		mascot.destroy();
		assert.equal(zone.hasClass("is-playful"), false);
		fire("pointerenter");
		run(100);
		assert.equal(mascot.current, null);
	});

	it("can be left alone on purpose", () => {
		const { zone, mascot, fire, run } = setup({ interactive: false });
		assert.equal(zone.hasClass("is-playful"), false);
		fire("pointerenter");
		fire("pointerdown");
		run(100);
		assert.equal(mascot.current, null);
	});
});
