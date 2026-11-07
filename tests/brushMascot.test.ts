/**
 * tests/brushMascot.test.ts — the brush mascot (src/ui/mascot).
 *
 * The promise the mascot makes is that it is the plugin's icon, exactly, every
 * time it is not moving: every animation, however it was started or stopped,
 * ends on Lucide's own paths with nothing left over. Around that: how holds
 * stack and hand over, how hover holds and lets go, and that every helper
 * leaves the screen exactly as it was where the mascot cannot be drawn.
 *
 * The fake DOM has no `createSvg` (most suites run without one, and the
 * mascot then stays out of their way), so the suites that draw it install a
 * stand-in for the length of the test.
 */
import { fakeDom, asEl, el, type FakeDocumentFragment, type FakeElement } from "./support/fakeDom";
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { Notice, type App } from "obsidian";
import { BrushMascot, canDrawMascot, type MascotHold } from "../src/ui/mascot/brushMascot";
import {
	ANIMATIONS,
	NO_RESULTS_MOOD,
	type MascotAnimation,
	type MascotAnimationName,
} from "../src/ui/mascot/mascotAnimations";
import { STRIPE_D } from "../src/ui/mascot/mascotFace";
import { NOTICE_MOODS, showNotice, WORK_ONE_PASS_MS, workNotice } from "../src/ui/mascot/mascotNotices";
import {
	addMascot,
	emptyListState,
	KeptMascot,
	SearchMascot,
	watchEmptyListMascots,
} from "../src/ui/mascot/mascotPlaces";
import { ConfirmModal } from "../src/utils/ConfirmModal";
import { TestKeymap, TestScope } from "./support/fakeKeymap";

const globals = globalThis as Record<string, unknown>;

/** Give the fake DOM Obsidian's `createSvg`, built on its own `createEl`. */
function installSvg(): void {
	const createEl = globals.createEl as (tag: string, options?: unknown) => FakeElement;
	globals.createSvg = (tag: string, options?: unknown) => createEl(tag, options);
}

function removeSvg(): void {
	delete globals.createSvg;
}

/** A mascot that only moves when the test says so. */
function mascot(): BrushMascot {
	return new BrushMascot(asEl(el()), { manual: true });
}

/** Run `ms` of animation, a frame at a time. */
function run(m: BrushMascot, ms: number): void {
	for (let t = 0; t < ms; t += 16) m.advance(16);
}

/** The parts the engine changes, found by their place in the drawing. */
function parts(m: BrushMascot) {
	const svg = m.svg as unknown as FakeElement;
	const body = child(svg, 1);
	return {
		body,
		stripe: child(body, 2),
		eyes: [child(body, 3), child(body, 4)] as const,
		drops: child(svg, 2),
	};
}

/** The element at `index` among `parent`'s children, which must be there. */
function child(parent: FakeElement, index: number): FakeElement {
	const found = parent.children[index];
	assert.ok(found, `child ${index} of <${parent.tagName.toLowerCase()}>`);
	return found;
}

/** Whether the mascot is exactly the plain icon, with nothing left over. */
function isIcon(m: BrushMascot): boolean {
	const p = parts(m);
	return (
		m.current === null &&
		p.stripe.getAttribute("d") === STRIPE_D &&
		p.stripe.getAttribute("fill") === "none" &&
		!p.eyes[0].hasAttribute("d") &&
		!p.eyes[1].hasAttribute("d") &&
		!p.body.hasAttribute("transform") &&
		p.drops.children.length === 0
	);
}

/** Where the left eye is on the icon, read from its path (its second point: the centre of an open eye). */
function eyePoint(m: BrushMascot): [number, number] {
	const d = parts(m).eyes[0].getAttribute("d") ?? "";
	const match = /^M[-\d.]+ [-\d.]+L([-\d.]+) ([-\d.]+)/.exec(d);
	return [Number(match?.[1]), Number(match?.[2])];
}

/** Which corner of the face the eye at `at` has been turned to from `middle` ("NE", "SW"…), or null near the middle. */
function corner(at: [number, number], middle: [number, number]): string | null {
	const dx = at[0] - middle[0];
	const dy = at[1] - middle[1];
	if (Math.abs(dx) < 0.3 || Math.abs(dy) < 0.15) return null;
	return `${dy < 0 ? "N" : "S"}${dx > 0 ? "E" : "W"}`;
}

/** The corners the eyes turn to, in order, as `m` plays from `from` to `to` ms; also how often they sat still in the middle. */
function corners(
	m: BrushMascot,
	middle: [number, number],
	from: number,
	to: number,
): { seen: string[]; stoppedInMiddle: number } {
	const seen: string[] = [];
	let stoppedInMiddle = 0;
	let last = eyePoint(m);
	for (let t = from; t < to; t += 16) {
		m.advance(16);
		const at = eyePoint(m);
		const where = corner(at, middle);
		if (where && seen[seen.length - 1] !== where) seen.push(where);
		// Passing the middle at the speed of a sweep does not count; easing to a stop there does.
		if (
			Math.hypot(at[0] - middle[0], at[1] - middle[1]) < 0.2 &&
			Math.hypot(at[0] - last[0], at[1] - last[1]) < 0.02
		)
			stoppedInMiddle++;
		last = at;
	}
	return { seen, stoppedInMiddle };
}

/** A pointer event the fake DOM can deliver. */
const pointer = (type: string, pointerType: string) => ({ type, pointerType }) as unknown as { type: string };

describe("the brush mascot", () => {
	beforeEach(installSvg);
	afterEach(removeSvg);

	it("is the plain paintbrush icon until it is asked to move", () => {
		const m = mascot();
		assert.ok(isIcon(m));
		assert.equal((m.svg as unknown as FakeElement).getAttribute("aria-hidden"), "true");
	});

	for (const name of Object.keys(ANIMATIONS) as MascotAnimationName[]) {
		it(`plays "${name}" once and ends on the exact icon, every drop of paint gone`, () => {
			const m = mascot();
			void m.play(name);
			run(m, 50);
			assert.equal(m.current, name);
			run(m, 8000);
			assert.ok(isIcon(m));
		});
	}

	it("keeps a held animation going until it is let go", () => {
		const m = mascot();
		const happy = m.hold("happy");
		run(m, 6000);
		assert.equal(m.current, "happy");
		assert.equal(happy.active, true);
		happy.release();
		assert.equal(happy.active, false);
		run(m, 1500);
		assert.ok(isIcon(m));
	});

	describe("a still hold", () => {
		/** Whether `m` has asked its window for another frame. */
		const framePending = (m: BrushMascot): boolean => (m as unknown as { frame: unknown }).frame !== null;

		/** A mascot that asks for frames, on the page, resting on a still "sad". */
		function resting(): { m: BrushMascot; sad: MascotHold } {
			const m = new BrushMascot(asEl(el()), { interactive: false });
			(m.svg as unknown as FakeElement).isConnected = true;
			const sad = m.hold("sad", "still");
			assert.ok(framePending(m), "the way in is drawn frame by frame");
			run(m, 6000);
			// The frame asked for earlier comes, finds nothing moving, and asks for no other.
			fakeDom.window.flushFrames();
			return { m, sad };
		}

		it("plays its way in and its body once, then rests on that face with no frames", () => {
			const { m } = resting();
			assert.equal(framePending(m), false);
			assert.equal(m.current, "sad");
			assert.ok(!isIcon(m), "the face stays");
			const face = parts(m).stripe.getAttribute("d");
			run(m, 3000);
			assert.equal(parts(m).stripe.getAttribute("d"), face, "and does not move");
		});

		it("asks for frames again to go home when it is let go", () => {
			const { m, sad } = resting();
			sad.release();
			assert.ok(framePending(m));
			run(m, 1500);
			assert.ok(isIcon(m));
		});

		it("takes a one-shot played over it back to its resting face", () => {
			const { m } = resting();
			void m.play("no");
			assert.ok(framePending(m));
			run(m, 4000);
			assert.equal(m.current, "sad");
			fakeDom.window.flushFrames();
			assert.equal(framePending(m), false, "and rests again");
		});

		it("turns its eyes toward the pointer, asking for frames only until they get there", () => {
			const { m } = resting();
			const before = eyePoint(m);
			m.lookToward([0.6, -0.3]);
			assert.ok(framePending(m));
			run(m, 1500);
			assert.notDeepEqual(eyePoint(m), before);
			fakeDom.window.flushFrames();
			assert.equal(framePending(m), false);
		});
	});

	it("goes back to the hold underneath when the top one is let go", () => {
		const m = mascot();
		const scared = m.hold("scared");
		run(m, 800);
		const cry = m.hold("cry");
		run(m, 800);
		assert.equal(m.current, "cry");
		cry.release();
		run(m, 300);
		assert.equal(m.current, "scared");
		scared.release();
		run(m, 2000);
		assert.ok(isIcon(m));
	});

	it("changes nothing on screen when a hold underneath is let go", () => {
		const m = mascot();
		const scared = m.hold("scared");
		const cry = m.hold("cry");
		run(m, 600);
		scared.release();
		run(m, 300);
		assert.equal(m.current, "cry");
		cry.release();
		run(m, 2000);
		assert.ok(isIcon(m));
	});

	it("stops trembling once relief takes over from a scared face", () => {
		const m = mascot();
		/** The brush's sideways position this frame (the tremble is what moves it). */
		const sideways = (): number => {
			const transform = parts(m).body.getAttribute("transform") ?? "";
			return Number(/^translate\((-?[\d.]+) /.exec(transform)?.[1]);
		};
		const scared = m.hold("scared");
		run(m, 800);
		// Scared really does shake, or the check below proves nothing.
		const shaking = new Set<number>();
		for (let i = 0; i < 40; i++) {
			m.advance(16);
			shaking.add(sideways());
		}
		assert.ok(shaking.size > 1, "scared trembles");
		const relief = m.hold("relief");
		// Past relief's way in, into its calm breathing.
		run(m, 1500);
		assert.equal(m.current, "relief");
		const still = new Set<number>();
		for (let i = 0; i < 40; i++) {
			m.advance(16);
			still.add(sideways());
		}
		assert.equal(still.size, 1, "relief holds still sideways");
		relief.release();
		scared.release();
		run(m, 2000);
		assert.ok(isIcon(m));
	});

	it("hands a one-shot over to what is still held, then goes home when that is let go", () => {
		const m = mascot();
		const excited = m.hold("excited");
		run(m, 700);
		void m.play("hello");
		run(m, 100);
		assert.equal(m.current, "hello");
		run(m, 1500);
		assert.equal(m.current, "excited");
		excited.release();
		run(m, 1500);
		assert.ok(isIcon(m));
	});

	it("lets a one-shot finish before a hold that arrives during it", () => {
		const m = mascot();
		void m.play("hello");
		run(m, 300);
		const happy = m.hold("happy");
		run(m, 100);
		assert.equal(m.current, "hello");
		run(m, 1500);
		assert.equal(m.current, "happy");
		happy.release();
		run(m, 1500);
		assert.ok(isIcon(m));
	});

	it("goes home within a second when let go during its intro", () => {
		const m = mascot();
		const happy = m.hold("happy");
		run(m, 120);
		happy.release();
		run(m, 900);
		assert.ok(isIcon(m));
	});

	it("does not restart a one-shot asked for again while it plays", () => {
		const m = mascot();
		const first = m.play("wink");
		run(m, 200);
		assert.equal(m.play("wink"), first);
	});

	it("settles its promises when an animation ends and when it is stopped", async () => {
		const m = mascot();
		let ended = 0;
		void m.play("hello").then(() => ended++);
		run(m, 2000);
		await Promise.resolve();
		assert.equal(ended, 1);
		const sad = m.hold("sad");
		let stopped = 0;
		void m.play("nod").then(() => stopped++);
		m.stop();
		await Promise.resolve();
		assert.equal(stopped, 1);
		assert.equal(sad.active, false, "stop() lets go of every hold");
		assert.ok(isIcon(m));
	});

	it("names a real animation in every `then`", () => {
		for (const [name, anim] of Object.entries<MascotAnimation>(ANIMATIONS)) {
			if (anim.then) assert.ok(anim.then in ANIMATIONS, `${name} carries on as ${anim.then}`);
		}
	});

	it("hands a one-shot straight over to the animation it names, never passing through the icon", () => {
		const m = mascot();
		void m.play("lookTwice");
		const seen: (MascotAnimationName | null)[] = [];
		const at: Record<number, MascotAnimationName | null> = {};
		for (let t = 0; t <= 12000; t += 16) {
			m.advance(16);
			if (seen[seen.length - 1] !== m.current) seen.push(m.current);
			at[t] = m.current;
		}
		// Looking, then the face of a search that found nothing, and the plain icon
		// only once that is over.
		assert.deepEqual(seen, ["lookTwice", NO_RESULTS_MOOD, null]);
		assert.ok(isIcon(m));
		// Two glances of 1.02 and 0.95 s (a flick and a stare each) and the 1.2 s
		// of the head shake, after a 0.39 s face: 3.56 s.
		assert.equal(at[3440], "lookTwice");
		assert.equal(at[3680], NO_RESULTS_MOOD);
	});

	it('shakes its head "no" after the two glances, with its eyes open again, and only then goes on as sad', () => {
		const m = mascot();
		void m.play("lookTwice");
		const tilt = (): number =>
			Number(/rotate\((-?[\d.]+) 12 13\)/.exec(parts(m).body.getAttribute("transform") ?? "")?.[1] ?? 0);
		const eyeWidth = (): number => Number(parts(m).eyes[0].getAttribute("stroke-width"));
		let whileLooking = 0;
		for (let t = 0; t < 2600; t += 16) {
			m.advance(16);
			whileLooking = Math.max(whileLooking, Math.abs(tilt()));
		}
		assert.ok(whileLooking < 4, `only a slight tilt while it looks around: ${whileLooking}`);
		let leftmost = 0;
		let rightmost = 0;
		for (let t = 2600; t < 3500; t += 16) {
			m.advance(16);
			leftmost = Math.min(leftmost, tilt());
			rightmost = Math.max(rightmost, tilt());
		}
		assert.ok(leftmost < -5 && rightmost > 5, `the head turns both ways: ${leftmost} to ${rightmost}`);
		assert.equal(m.current, "lookTwice", "still its own animation until the shake is over");
		assert.ok(eyeWidth() > 1.9, "the eyes are open again, not narrowed");
		assert.ok(Math.abs(tilt()) < 1, "and the head is straight again");
	});

	it("looks up left, down right in turn, never up and to the right, never coming to rest in the middle", () => {
		const m = mascot();
		void m.play("lookTwice");
		// The face is up at 390 ms and the first glance has not begun: that is the middle.
		run(m, 380);
		const middle = eyePoint(m);
		// Up to the end of the second stare (2.36 s): after it the eyes come back to the middle for the answer.
		const { seen, stoppedInMiddle } = corners(m, middle, 380, 2320);
		// No "NE": looking up and to the right pushes the right eye onto the handle's lower edge.
		assert.deepEqual(seen, ["NW", "SE"]);
		assert.equal(stoppedInMiddle, 0, "the eyes sweep across, they do not stop there");
	});

	it("narrows its eyes while it stares in each direction, and opens them to look somewhere else", () => {
		const m = mascot();
		void m.play("lookTwice");
		const width = (): number => Number(parts(m).eyes[0].getAttribute("stroke-width"));
		// Each glance is a flick (the eyes wide, a plain dot) and then a stare (narrowing): the
		// first flick ends at 590 ms and its stare at 1410 ms, then the next flick opens them.
		run(m, 600);
		assert.ok(width() > 1.9, `wide as it arrives: ${width()}`);
		run(m, 800);
		assert.ok(width() < 1.3, `narrowed by the end of the stare: ${width()}`);
		run(m, 200);
		assert.ok(width() > 1.9, `open again for the next glance: ${width()}`);
	});

	it("looks round in the same two directions for as long as it is held, blinking between the rounds", () => {
		const m = mascot();
		const look = m.hold("look");
		run(m, 380);
		const middle = eyePoint(m);
		// The body (1.97 s) and one trip round the loop (1.97 s, a blink and a beat); the third round has begun by 6 s.
		const { seen, stoppedInMiddle } = corners(m, middle, 380, 6000);
		assert.deepEqual(seen.slice(0, 6), ["NW", "SE", "NW", "SE", "NW", "SE"]);
		assert.equal(stoppedInMiddle, 0);
		look.release();
		run(m, 2000);
		assert.ok(isIcon(m));
	});

	it("brings the red cheeks in and takes them out gradually, growing from nothing, never with a pop", () => {
		const m = mascot();
		void m.play("angry");
		const cheek = child(parts(m).body, 5);
		const opacity: number[] = [];
		const radius: number[] = [];
		for (let t = 0; t < 3000; t += 16) {
			m.advance(16);
			opacity.push(Number(cheek.getAttribute("opacity")));
			radius.push(Number(cheek.getAttribute("r")));
		}
		// Full is 0.6. The biggest change in one 16 ms frame is a twelfth of that: it was a whole
		// 0.5 in 80 ms before.
		const jumps = opacity.slice(1).map((v, i) => Math.abs(v - (opacity[i] ?? v)));
		assert.ok(Math.max(...jumps) < 0.05, `biggest change in a frame: ${Math.max(...jumps)}`);
		// Most of the frames the cheeks are on the way in or out, not full or gone: about 230 ms in, 420 ms out.
		const onTheWay = opacity.filter((v) => v > 0.03 && v < 0.57).length;
		assert.ok(onTheWay >= 30, `${onTheWay} frames on the way`);
		assert.ok(
			radius.some((r) => r > 0.1 && r < 0.8),
			"they grow rather than appear at full size",
		);
		assert.equal(Math.max(...radius), 0.85);
	});

	it("goes on as the held mood after looking twice, not through the icon", () => {
		const m = mascot();
		const sad = m.hold("sad");
		void m.play("lookTwice");
		const seen: (MascotAnimationName | null)[] = [];
		for (let t = 0; t <= 12000; t += 16) {
			m.advance(16);
			if (seen[seen.length - 1] !== m.current) seen.push(m.current);
		}
		assert.deepEqual(seen, ["lookTwice", "sad"]);
		assert.equal(sad.active, true);
	});

	it("draws every drop of paint in the accent colour's class", () => {
		const m = mascot();
		void m.play("celebrate");
		run(m, 250);
		const { drops } = parts(m);
		assert.ok(drops.children.length > 0, "the confetti is in flight");
		assert.ok(drops.hasClass("cs-mascot-paint"));
	});

	it("holds while a mouse is over the target, not for a touch, and again after a stop", () => {
		const m = mascot();
		const button = el({ tag: "button" });
		const unbind = m.hover(asEl(button), "excited");
		button.dispatchEvent(pointer("pointerenter", "touch"));
		run(m, 200);
		assert.equal(m.current, null, "a touch has no hover");
		button.dispatchEvent(pointer("pointerenter", "mouse"));
		run(m, 200);
		assert.equal(m.current, "excited");
		button.dispatchEvent(pointer("pointerleave", "mouse"));
		run(m, 1500);
		assert.ok(isIcon(m));
		button.dispatchEvent(pointer("pointerenter", "mouse"));
		m.stop();
		button.dispatchEvent(pointer("pointerleave", "mouse"));
		button.dispatchEvent(pointer("pointerenter", "mouse"));
		run(m, 200);
		assert.equal(m.current, "excited", "stop() does not leave hover thinking it still holds");
		unbind();
		run(m, 1500);
		assert.ok(isIcon(m));
	});

	it("plays once each time a mouse comes onto the target, and never loops", () => {
		const m = mascot();
		const button = el({ tag: "button" });
		const unbind = m.hover(asEl(button), "wink", "once");
		button.dispatchEvent(pointer("pointerenter", "touch"));
		run(m, 200);
		assert.equal(m.current, null, "a touch has no hover");
		button.dispatchEvent(pointer("pointerenter", "mouse"));
		run(m, 200);
		assert.equal(m.current, "wink");
		// The pointer stays on it: the wink ends, and nothing starts it again.
		run(m, 6000);
		assert.ok(isIcon(m), "one wink, then the plain icon, with the pointer still there");
		button.dispatchEvent(pointer("pointerleave", "mouse"));
		button.dispatchEvent(pointer("pointerenter", "mouse"));
		run(m, 200);
		assert.equal(m.current, "wink", "and again for the next visit");
		unbind();
		run(m, 6000);
		button.dispatchEvent(pointer("pointerenter", "mouse"));
		run(m, 200);
		assert.ok(isIcon(m), "unbound");
	});
});

describe("the animation of a notice", () => {
	it("is an animation that exists, for every kind", () => {
		for (const [kind, name] of Object.entries(NOTICE_MOODS)) {
			assert.ok(name in ANIMATIONS, `${kind}: ${name} is an animation`);
		}
	});

	it("is a different one for every kind, so the faces tell the news apart", () => {
		const names = Object.values(NOTICE_MOODS);
		assert.equal(new Set(names).size, names.length, `two kinds share an animation: ${names.join(", ")}`);
		// "paint" is what a work notice does while it runs; no kind takes it.
		assert.ok(!(names as string[]).includes("paint"));
	});
});

describe("the mascot's places", () => {
	describe("where the mascot cannot be drawn", () => {
		it("leave the screen exactly as it was", () => {
			assert.equal(canDrawMascot(), false);
			const parent = el();
			assert.equal(addMascot(asEl(parent), "large"), null);
			assert.equal(parent.children.length, 0);
			assert.equal(
				emptyListState("No custom callouts for now.", "Add new callout"),
				"No custom callouts for now.",
			);
			const kept = new KeptMascot("medium");
			assert.equal(kept.attach(asEl(parent)), null);
			kept.setMood("sad");
			assert.equal(parent.children.length, 0);
		});

		it("keep a notice plain, and add no notice for work in progress", () => {
			const notice = showNotice("success", "Imported 3 callout types.");
			assert.equal((notice.containerEl as unknown as FakeElement).children.length, 0);
			const before = (Notice as unknown as { last: unknown }).last;
			void workNotice("Scanning…").done();
			assert.equal((Notice as unknown as { last: unknown }).last, before);
		});
	});

	describe("where it can", () => {
		beforeEach(installSvg);
		afterEach(removeSvg);

		it("puts a notice's mascot beside its words", () => {
			const notice = showNotice("success", "Imported 3 callout types.");
			const container = notice.containerEl as unknown as FakeElement;
			assert.ok(container.hasClass("cs-mascot-notice"));
			assert.ok(container.children[0]?.hasClass("cs-mascot-box"));
		});

		describe("a notice's mascot", () => {
			/** The notice's mascot drawing, which the suite says is on the page. */
			function onPage(notice: Notice): FakeElement {
				const svg = child(child(notice.containerEl as unknown as FakeElement, 0), 0);
				svg.isConnected = true;
				return svg;
			}

			beforeEach(() => fakeDom.window.clearTimers());
			afterEach(() => fakeDom.window.clearTimers());

			it("keeps still at first, moves once the moment has passed, and stops with the notice", () => {
				const notice = showNotice("notFound", "Nothing to wrap.");
				const svg = onPage(notice);
				assert.equal(fakeDom.window.pendingFrames(), 0, "no frame is asked for while it keeps still");
				assert.equal(fakeDom.window.pendingTimers(), 1);
				fakeDom.window.flushTimers();
				assert.equal(fakeDom.window.pendingFrames(), 1, "now it moves");
				// Frames keep coming for as long as the notice is on the page...
				fakeDom.window.flushFrames();
				assert.equal(fakeDom.window.pendingFrames(), 1);
				// ...and the first frame after it has gone is the last.
				svg.isConnected = false;
				fakeDom.window.flushFrames();
				assert.equal(fakeDom.window.pendingFrames(), 0);
			});

			it("stays still when the notice is gone before the moment has passed", () => {
				const notice = showNotice("notFound", "Nothing to wrap.");
				// Not on the page: clicked away at once.
				assert.equal(child(child(notice.containerEl as unknown as FakeElement, 0), 0).isConnected, false);
				fakeDom.window.flushTimers();
				assert.equal(fakeDom.window.pendingFrames(), 0);
			});

			/** The notice shown last, which these cases only ever look at after making it. */
			const lastNotice = () => (Notice as unknown as { last: Notice & { hidden: boolean } }).last;

			/**
			 * The notice leaves the page: the mascot's engine sees it go on its
			 * next frame and stops, leaving no frame behind for the next case.
			 */
			function leavePage(notice: Notice): void {
				const svg = onPage(notice);
				fakeDom.window.flushFrames();
				svg.isConnected = false;
				fakeDom.window.flushFrames();
			}

			it("moves from the first frame in a work notice, and is put away with it", () => {
				const work = workNotice("Scanning…");
				const notice = lastNotice();
				assert.equal(fakeDom.window.pendingTimers(), 0, "no moment of stillness to wait out");
				assert.equal(fakeDom.window.pendingFrames(), 1, "it moves at once");
				void work.done();
				assert.equal(notice.hidden, true);
				leavePage(notice);
				assert.equal(fakeDom.window.pendingFrames(), 0);
			});

			it("stays up for its minimum when the work ends at once, then waits out its gap", async () => {
				const settle = () => new Promise((resolve) => setImmediate(resolve));
				const work = workNotice("Scanning…", { minMs: WORK_ONE_PASS_MS, gapMs: 800 });
				const notice = lastNotice();
				let finished = false;
				void work.done().then(() => {
					finished = true;
				});
				await settle();
				assert.equal(notice.hidden, false, "the work took no time, yet the notice stays");
				// The minimum has passed: the notice goes, and the gap begins.
				fakeDom.window.flushTimers();
				await settle();
				assert.equal(notice.hidden, true);
				assert.equal(finished, false, "the next notice has to wait for the gap");
				fakeDom.window.flushTimers();
				await settle();
				assert.equal(finished, true);
				leavePage(notice);
			});

			it("takes the notice away at once when no minimum is left to wait out", async () => {
				const work = workNotice("Scanning…", { minMs: 0, gapMs: 0 });
				const notice = lastNotice();
				const done = work.done();
				assert.equal(notice.hidden, true);
				await done;
				leavePage(notice);
			});

			it("ends once, however often done() is called", async () => {
				const work = workNotice("Scanning…", { minMs: 0, gapMs: 0 });
				const notice = lastNotice();
				const first = work.done();
				assert.equal(work.done(), first, "a second call gets the same wait");
				assert.equal(notice.hidden, true);
				await first;
				leavePage(notice);
			});

			it("is one whole pass of the painting: getting ready, then a whole stroke", () => {
				const { intro, body } = ANIMATIONS.paint;
				assert.equal(
					WORK_ONE_PASS_MS,
					[...intro, ...body].reduce((total, step) => total + step.ms, 0),
				);
			});
		});

		it("keeps one mascot across redraws, and holds its mood again after it was stopped", () => {
			const kept = new KeptMascot("medium");
			const first = el();
			const m = kept.attach(asEl(first));
			assert.ok(m);
			kept.setMood("sad");
			assert.equal(m.current, "sad");
			// A redraw: a new parent, the same mascot, still sad.
			const second = el();
			assert.equal(kept.attach(asEl(second)), m);
			assert.equal(first.children.length, 0);
			kept.setMood("sad");
			assert.equal(m.current, "sad");
			// Taken off the page, the engine stops itself; asking again holds again.
			m.stop();
			kept.setMood("sad");
			assert.equal(m.current, "sad");
			kept.detach();
			assert.equal(second.children.length, 0);
			assert.ok(isIcon(m));
		});

		it("keeps its mood still: once the face has come, it asks for no frames while it stays", () => {
			const kept = new KeptMascot("medium");
			const m = kept.attach(asEl(el()));
			assert.ok(m);
			(m.svg as unknown as FakeElement).isConnected = true;
			kept.setMood("sad");
			run(m, 6000);
			fakeDom.window.flushFrames();
			assert.equal((m as unknown as { frame: unknown }).frame, null);
			assert.equal(m.current, "sad");
			kept.detach();
		});

		describe("a search that found nothing", () => {
			beforeEach(() => fakeDom.window.clearTimers());
			afterEach(() => fakeDom.window.clearTimers());

			/** The mascot inside a SearchMascot, which keeps it private. */
			function mascotOf(search: SearchMascot): BrushMascot {
				const kept = (search as unknown as { kept: KeptMascot }).kept;
				const found = kept.attach(asEl(el()));
				assert.ok(found);
				return found;
			}

			it("looks around twice when it turns empty, then is sad, and does not look again on the next key", () => {
				const search = new SearchMascot();
				search.showEmpty(asEl(el()));
				const m = mascotOf(search);
				assert.equal(m.current, "lookTwice");
				run(m, 12000);
				assert.equal(m.current, NO_RESULTS_MOOD);
				// The next key, the search still empty: the same mascot, not looking again.
				search.showEmpty(asEl(el()));
				assert.equal(m.current, NO_RESULTS_MOOD);
				// Something matched, then nothing does again: it looks around again.
				search.hide();
				assert.ok(isIcon(m));
				search.showEmpty(asEl(el()));
				assert.equal(m.current, "lookTwice");
			});

			/** A search that has turned empty and gone through its first round (glances and shake), now sad. */
			async function afterTheFirstRound(): Promise<{ search: SearchMascot; m: BrushMascot }> {
				const search = new SearchMascot();
				search.showEmpty(asEl(el()));
				const m = mascotOf(search);
				(m.svg.parentElement as unknown as FakeElement).isConnected = true;
				run(m, 12000);
				// The first round's promise settles on a microtask, which is when the search stops waiting for it.
				await Promise.resolve();
				assert.equal(m.current, NO_RESULTS_MOOD);
				return { search, m };
			}

			it("shakes its head again when it keeps searching and the typing pauses with nothing found, then is sad again", async () => {
				const { search, m } = await afterTheFirstRound();
				search.typed();
				search.showEmpty(asEl(el()));
				(m.svg.parentElement as unknown as FakeElement).isConnected = true;
				run(m, 300);
				assert.equal(m.current, "look", "it looks around while the keys come");
				run(m, 400);
				fakeDom.window.flushTimers();
				assert.equal(m.current, "no", "the typing paused, and still nothing: it shakes its head");
				run(m, 3000);
				assert.equal(m.current, NO_RESULTS_MOOD, "and is sad again");
			});

			it("shakes its head again for an owner that only draws the empty state again and never says `typed` (Quick insert)", async () => {
				const { search, m } = await afterTheFirstRound();
				search.showEmpty(asEl(el()));
				(m.svg.parentElement as unknown as FakeElement).isConnected = true;
				run(m, 700);
				fakeDom.window.flushTimers();
				assert.equal(m.current, "no");
				run(m, 3000);
				assert.equal(m.current, NO_RESULTS_MOOD);
			});

			it("waits for the typing to pause: every key starts the wait again", async () => {
				const { search } = await afterTheFirstRound();
				search.typed();
				search.showEmpty(asEl(el()));
				search.typed();
				search.showEmpty(asEl(el()));
				// Two keys, one timer: the first key's wait did not stay behind to fire early.
				assert.equal(fakeDom.window.pendingTimers(), 1);
			});

			it("does not shake its head when something matched while it waited", async () => {
				const { search, m } = await afterTheFirstRound();
				search.typed();
				search.showEmpty(asEl(el()));
				search.hide();
				fakeDom.window.flushTimers();
				assert.ok(isIcon(m), "the mascot was put away and nothing brought it back");
			});

			it("is not cut short by a key typed while it is looking, and ends sad", () => {
				const search = new SearchMascot();
				search.showEmpty(asEl(el()));
				const m = mascotOf(search);
				// `typed()` only does anything for a mascot that is on the page.
				(m.svg.parentElement as unknown as FakeElement).isConnected = true;
				search.typed();
				assert.equal(m.current, "lookTwice", "the key's glance waits its turn");
				assert.equal(m.holdCount, 2);
				// The key's own glance lasts 700 ms and is let go of while the long look goes on.
				run(m, 700);
				fakeDom.window.flushTimers();
				assert.equal(m.holdCount, 1);
				assert.equal(m.current, "lookTwice");
				run(m, 12000);
				assert.equal(m.current, NO_RESULTS_MOOD);
			});
		});

		it("gives an empty settings list a slot, and brings it to life once it is drawn", () => {
			const state = emptyListState("No custom callouts for now.", "Add new callout");
			assert.notEqual(typeof state, "string");
			const fragment = state as unknown as FakeDocumentFragment;
			assert.equal(fragment.textContent, "No custom callouts for now.");

			// Obsidian's list: a heading with the + named after the add action, then the rows.
			const root = el();
			const group = root.createDiv({ cls: "setting-group" });
			group.createDiv({ cls: "setting-item-heading" }).createDiv({ attr: { "aria-label": "Add new callout" } });
			const row = group.createDiv({ cls: "setting-items" }).createDiv({ cls: "setting-item mod-empty-state" });
			// Obsidian puts the empty state in the row's name, which it clips (`overflow: hidden`).
			const name = row.createDiv({ cls: "setting-item-info" }).createDiv({ cls: "setting-item-name" });
			// What inserting a fragment does: its children move in.
			for (const node of fragment.drain()) name.appendChild(node);
			const slot = row.querySelector(".cs-mascot-slot");
			assert.ok(slot);
			assert.equal(slot.getAttribute("data-add-label"), "Add new callout");

			const stop = watchEmptyListMascots(asEl(root));
			assert.ok(slot.hasClass("is-awake"));
			assert.equal(slot.children.length, 1, "a mascot in the slot");
			assert.ok(name.hasClass("cs-paint-room"), "the name lets the ring of a press show, not clip it");
			stop();
			assert.equal(slot.hasClass("is-awake"), false);
			assert.equal(slot.children.length, 0, "put back to sleep when the visit ends");
			assert.equal(name.hasClass("cs-paint-room"), false, "and clips as Obsidian does again");
		});

		it("puts a scared mascot beside a confirmation's two-line heading, and takes it down when it closes", () => {
			fakeDom.light();
			const app = { keymap: new TestKeymap(), scope: new TestScope() } as unknown as App;
			const modal = new ConfirmModal(app, "Delete callout", "Notes keep their text.").withMascot(
				"“Project note”",
			);
			void modal.confirm();
			const header = modal.titleEl.parentElement as unknown as FakeElement;
			const box = child(header, 0);
			assert.ok(box.hasClass("cs-mascot-box"), "the mascot comes first");
			assert.ok(child(header, 1).hasClass("modal-title"), "the title follows it");
			assert.ok(child(header, 2).hasClass("cs-confirm-subtitle"), "and the subtitle goes under the title");
			assert.equal(child(header, 2).textContent, "“Project note”");
			assert.ok(box.hasClass("is-medium"));
			assert.ok(header.hasClass("cs-mascot-header"));
			assert.ok(header.hasClass("cs-confirm-heading"));
			assert.equal(
				(modal.contentEl as unknown as FakeElement).querySelector(".cs-mascot-box"),
				null,
				"nothing above the message",
			);
			modal.close();
			assert.equal(header.querySelector(".cs-mascot-box"), null);
			assert.equal(header.querySelector(".cs-confirm-subtitle"), null);
			assert.equal(header.hasClass("cs-mascot-header"), false);
			assert.equal(header.hasClass("cs-confirm-heading"), false);
		});

		it("breathes out in relief over the ✕ as over Cancel, and cries over the confirm button", () => {
			fakeDom.light();
			const app = { keymap: new TestKeymap(), scope: new TestScope() } as unknown as App;
			const modal = new ConfirmModal(app, "Delete callout", "Notes keep their text.").withMascot(
				"“Project note”",
			);
			// The window's own ✕, as the stand-in builds it like Obsidian does.
			const closeX = (modal.modalEl as unknown as FakeElement).querySelector(".modal-header-button");
			assert.ok(closeX, "the stand-in window has a ✕");
			// What each target is made to hold while the pointer is on it.
			const hovers: { target: unknown; name: MascotAnimationName }[] = [];
			// eslint-disable-next-line @typescript-eslint/unbound-method -- called back with its own `this` below
			const realHover = BrushMascot.prototype.hover;
			BrushMascot.prototype.hover = function (target, name) {
				hovers.push({ target, name });
				return realHover.call(this, target, name);
			};
			try {
				void modal.confirm();
			} finally {
				BrushMascot.prototype.hover = realHover;
			}
			const buttons = (modal.buttonContainerEl as unknown as FakeElement).querySelectorAll("button");
			assert.equal(buttons.length, 2, "Cancel and the confirm button");
			const reaction = (target: unknown) => hovers.find((h) => h.target === target)?.name;
			assert.equal(reaction(closeX), "relief", "the ✕ closes at once, like Cancel");
			assert.equal(reaction(buttons[0]), "relief");
			assert.equal(reaction(buttons[1]), "cry");
			assert.equal(hovers.length, 3, "nothing else in the window is watched");
			modal.close();
		});

		it("draws the same size of mascot in every confirmation", () => {
			fakeDom.light();
			const app = { keymap: new TestKeymap(), scope: new TestScope() } as unknown as App;
			const sizes = ["Delete callout?", "Delete palette?", "Reset everything?"].map((title) => {
				const modal = new ConfirmModal(app, title, "Sure?").withMascot("Sunset");
				void modal.confirm();
				const header = modal.titleEl.parentElement as unknown as FakeElement;
				const classes = child(header, 0).className;
				modal.close();
				return classes;
			});
			assert.equal(new Set(sizes).size, 1);
		});

		it("leaves a confirmation without withMascot exactly as it was", () => {
			fakeDom.light();
			const app = { keymap: new TestKeymap(), scope: new TestScope() } as unknown as App;
			const modal = new ConfirmModal(app, "Replace the file?", "Sure?");
			void modal.confirm();
			const header = modal.titleEl.parentElement as unknown as FakeElement;
			assert.equal(header.children.length, 1, "the title alone");
			assert.equal(header.hasClass("cs-mascot-header"), false);
			modal.close();
		});
	});
});
