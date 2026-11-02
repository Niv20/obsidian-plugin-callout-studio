/**
 * ui/mascot/brushMascot.ts — the brush mascot: the plugin's paintbrush icon
 * with a face that comes and goes.
 *
 * Who uses it. The places in the plugin that show the mascot, through the
 * helpers in mascotPlaces.ts, which also decide which animation plays where.
 *
 * The main idea. At rest the mascot draws Lucide's own three paintbrush
 * paths, character for character, so it looks exactly like the icon. When
 * asked, it plays one of the animations in mascotAnimations.ts and always
 * settles back on the plain icon:
 *
 *     const mascot = new BrushMascot(containerEl);
 *     mascot.play("nod");                       // once, then back to the icon
 *     const worry = mascot.hold("scared");      // keeps going…
 *     worry.release();                          // …until let go
 *     const unbind = mascot.hover(button, "excited"); // held while the pointer is on the button
 *     mascot.hover(button, "wink", "once");     // or played once each time it comes
 *
 * Holds stack: hold "scared" while a window is open and "cry" while the
 * pointer is on its Delete button, and letting go of "cry" goes back to
 * "scared", not to the icon. A one-shot played during a hold hands back to
 * the hold when it ends.
 *
 * A hold can be still: `hold("sad", "still")` plays the way in and the body
 * once, then rests on that face, asking for no more frames until something
 * moves it again (a one-shot, the pointer, letting go). A place that can stay
 * open for hours holds its mood that way, so a face left on screen costs
 * nothing (KeptMascot in mascotPlaces.ts).
 *
 * The pointer can play with it too (mascotPlay.ts): coming near makes it blink
 * and look, a press dents it where it was pressed (mascotDent.ts) and springs
 * back, and too many presses make it angry. Every mascot but a notice's has
 * that, over whatever mood it holds.
 *
 * Frames are drawn by setting SVG attributes on every animation frame, not
 * with CSS animations, because CSS cannot change the shape of a path in
 * Safari, which is what Obsidian runs on on iPhone and iPad. The colours are
 * the stylesheet's: the brush is `.cs-mascot`, every drop of paint is
 * `.cs-mascot-paint` (styles.css).
 */
import { cancelFrame, requestFrameFor, type FrameHandle } from "../../utils/elementFrame";
import { Dent } from "./mascotDent";
import { hoverMood, playWith } from "./mascotPlay";
import {
	type Eye,
	type Pose,
	type Vec,
	BRISTLES_D,
	CHEEKS,
	HANDLE_D,
	REST,
	STRIPE_D,
	applySpec,
	bodyPoint,
	bodyTransform,
	lerpPose,
	num,
	pt,
	toIcon,
} from "./mascotFace";
import {
	type MascotAnimation,
	type MascotAnimationName,
	type Spawn,
	type Step,
	ANIMATIONS,
	DEFAULT_EXIT_MS,
	EASES,
} from "./mascotAnimations";

/** How big a cheek is when it blushes fully, in icon units. */
const CHEEK_RADIUS = 0.85;
/** The paint stroke the "paint" animation lays down under the brush, and the stretch it covers. */
const STROKE_D = "M6.4 24.2C9.2 23.4 12.4 25 15.2 24";
const STROKE_FROM_X = 6.4;
const STROKE_TO_X = 15.2;
const BRISTLE_TIP: Vec = [10.6, 21.9];
/** How long the ring of paint spreading from a press takes to fade, and how far it reaches. */
const RIPPLE_MS = 420;
const RIPPLE_REACH = 3.2;

/**
 * Whether this window can draw the mascot: Obsidian's `createSvg` helper is
 * there. It always is in Obsidian; most test suites run without it, and a
 * place that shows the mascot then simply shows its text alone.
 */
export function canDrawMascot(): boolean {
	return typeof createSvg === "function";
}

/** A held animation, from {@link BrushMascot.hold}. */
export interface MascotHold {
	/** Let go. Letting go twice, or after the mascot stopped, does nothing. */
	release(): void;
	/** Whether it is still held: false once released, or once the mascot stopped. */
	readonly active: boolean;
}

/** One animation being played: where it is, and how it was asked for. */
interface Run {
	name: MascotAnimationName;
	anim: MascotAnimation;
	/** "once" plays straight through; "hold" repeats its loop until let go. */
	mode: "once" | "hold";
	/** A still hold: after the body it rests on its last pose instead of looping. */
	still: boolean;
	/** "rest": a still hold resting on its face, with no step and no frames. */
	phase: "intro" | "body" | "loop" | "rest" | "outro" | "exit";
	/** The steps of this phase not started yet. */
	queue: Step[];
	step: Step | null;
	/** When the current step started, on the mascot's own clock. */
	stepStart: number;
	from: Pose;
	to: Pose;
	/** Let go of while still in the intro or the loop: skip ahead to going home. */
	letGo: boolean;
	settle: () => void;
	finished: Promise<void>;
}

/** A drop of paint in flight. */
interface Drop {
	el: SVGCircleElement;
	born: number;
	spawn: Spawn;
	/** Where it started, in icon coordinates, after the body's move. */
	origin: Vec;
}

export interface BrushMascotOptions {
	/** Don't run on animation frames; the caller moves time on with `advance()`. For tests. */
	manual?: boolean;
	/** Let the pointer play with it (mascotPlay.ts). On unless said otherwise; a notice's mascot says otherwise. */
	interactive?: boolean;
}

export class BrushMascot {
	/** The mascot's own `<svg>`, already inside the parent it was made in. */
	readonly svg: SVGSVGElement;
	/** Playback rate: 1 is normal, 0.25 is slow motion. */
	speed = 1;

	private readonly body: SVGGElement;
	private readonly stripe: SVGPathElement;
	private readonly eyes: [SVGPathElement, SVGPathElement];
	private readonly cheeks: [SVGCircleElement, SVGCircleElement];
	private readonly strokeEl: SVGPathElement;
	private readonly dropLayer: SVGGElement;
	private readonly rippleEl: SVGCircleElement;

	private live: Pose = REST;
	private run: Run | null = null;
	/** Every animation held now, the newest last; the newest is the one showing. */
	private holds: { id: number; name: MascotAnimationName; still: boolean }[] = [];
	private lastHoldId = 0;
	private drops: Drop[] = [];
	/** How far right the current paint stroke has reached, 0 to 1. */
	private strokeReach = 0;
	/** The dent of a press, while it is pressed or springing back. */
	private dent: Dent | null = null;
	/** The ring of paint spreading from the last press: where, and when. */
	private ripple: { at: Vec; born: number } | null = null;
	/** Where the eyes are turned to look at the pointer, and where they are heading. */
	private look: Vec = [0, 0];
	private lookGoal: Vec | null = null;
	/** Takes the pointer's play away again; undefined where there is none. */
	private readonly stopPlay?: () => void;
	/** The mascot's own clock in milliseconds; runs at `speed` times real time. */
	private clock = 0;
	private lastFrame = 0;
	private frame: FrameHandle | null = null;
	/** Whether the mascot has been on the page; see `wake()`. */
	private wasConnected = false;
	private readonly manual: boolean;
	private readonly reducedMotion: boolean;

	/** Draw the plain icon inside `parent`. */
	constructor(parent: Element, options: BrushMascotOptions = {}) {
		this.manual = options.manual ?? false;
		const win = parent.ownerDocument.defaultView ?? window;
		// Someone who asked their system for less motion still sees the faces,
		// but the brush itself never jumps, shakes or throws paint.
		this.reducedMotion =
			typeof win.matchMedia === "function" && win.matchMedia("(prefers-reduced-motion: reduce)").matches;

		this.svg = svgEl("svg", {
			class: "cs-mascot",
			viewBox: "0 0 24 24",
			fill: "none",
			stroke: "currentColor",
			"stroke-width": "2",
			"stroke-linecap": "round",
			"stroke-linejoin": "round",
			overflow: "visible",
			// Decoration: the words beside it say what is going on.
			"aria-hidden": "true",
		});
		this.strokeEl = add(this.svg, "path", {
			class: "cs-mascot-paint",
			d: STROKE_D,
			"stroke-width": "2.4",
			// Measuring the stroke as 1 long lets the dash below show "how much of it" directly.
			pathLength: "1",
			"stroke-dasharray": "1 1",
		});
		this.body = add(this.svg, "g", {});
		add(this.body, "path", { d: HANDLE_D });
		add(this.body, "path", { d: BRISTLES_D });
		this.stripe = add(this.body, "path", { d: STRIPE_D });
		this.eyes = [add(this.body, "path", {}), add(this.body, "path", {})];
		const cheek = { class: "cs-mascot-paint", r: String(CHEEK_RADIUS), stroke: "none", fill: "currentColor" };
		this.cheeks = [add(this.body, "circle", cheek), add(this.body, "circle", cheek)];
		this.dropLayer = add(this.svg, "g", { class: "cs-mascot-paint", stroke: "none", fill: "currentColor" });
		this.rippleEl = add(this.svg, "circle", {
			class: "cs-mascot-paint",
			fill: "none",
			"stroke-width": "0.7",
			r: "0",
			opacity: "0",
		});
		parent.appendChild(this.svg);
		this.draw();
		if (options.interactive ?? true) this.stopPlay = playWith(this, parent as HTMLElement);
	}

	/** The animation showing now, or null while the mascot is the plain icon. */
	get current(): MascotAnimationName | null {
		return this.run?.name ?? null;
	}

	/** How many animations are held now, whoever holds them. */
	get holdCount(): number {
		return this.holds.length;
	}

	/**
	 * Press the brush at `at`, on the icon's own 24 × 24 grid. It goes in on the
	 * side that was touched and stays in until the returned function is called,
	 * then springs back, a ring of paint spreading from the spot. A press while
	 * the last one is still springing carries on from where that one is, so quick
	 * pokes build up instead of starting over. Its face is not touched.
	 */
	poke(at: Vec, force = 1): () => void {
		// Someone who asked for less motion still sees faces, but nothing sinks or ripples.
		if (this.reducedMotion) return () => {};
		const dent = this.dent ?? (this.dent = new Dent(at, force));
		dent.press(at, force);
		this.ripple = { at, born: this.clock };
		this.wake();
		return () => dent.release();
	}

	/** Turn the eyes toward `goal` (face units, see `toFace`), or back to the middle with null. */
	lookToward(goal: Vec | null): void {
		this.lookGoal = goal;
		// A face resting on a still hold asks for no frames, so the turn asks
		// for its own. The plain icon has no eyes to turn.
		if (this.run) this.wake();
	}

	/**
	 * Play an animation once and settle back on the icon (or on whatever is
	 * being held). Asking for the one already playing does not restart it, so
	 * a twitchy pointer cannot make it stutter. The promise settles when the
	 * animation is over, or when another one replaced it.
	 */
	play(name: MascotAnimationName): Promise<void> {
		const run = this.run;
		if (run && run.mode === "once" && run.name === name && run.phase !== "exit") return run.finished;
		return this.start(name, "once").finished;
	}

	/**
	 * Keep an animation going until the hold it returns is released. With
	 * `"still"` it plays its way in and its body once and then rests on that
	 * face, with no frames, instead of repeating its loop.
	 */
	hold(name: MascotAnimationName, how: "loop" | "still" = "loop"): MascotHold {
		const id = this.pushHold(name, how === "still");
		// An arrow function keeps this mascot's `this`, so the getter below can ask it.
		const isHeld = (): boolean => this.holds.some((h) => h.id === id);
		return {
			release: () => this.letGo(id),
			get active() {
				return isHeld();
			},
		};
	}

	/**
	 * Hold `name` while the pointer is over `target`, or while it has keyboard
	 * focus. Touch has no hover, so taps are left to the caller. Returns what
	 * unbinds it again.
	 *
	 * With `"once"` the animation is played one time each time the pointer
	 * comes onto `target`, instead of being held: it does not repeat while the
	 * pointer stays, and it is not tied to keyboard focus.
	 */
	hover(target: HTMLElement, name: MascotAnimationName, how: "hold" | "once" = "hold"): () => void {
		return hoverMood(this, target, name, how);
	}

	/** Back to the plain icon at once, letting go of every hold. */
	stop(): void {
		this.frame = cancelFrame(this.frame);
		this.holds = [];
		const run = this.run;
		this.run = null;
		run?.settle();
		for (const drop of this.drops) drop.el.remove();
		this.drops = [];
		this.dent = null;
		this.ripple = null;
		this.rippleEl.setAttribute("opacity", "0");
		this.look = [0, 0];
		this.live = REST;
		this.draw();
	}

	/** Stop, and take the mascot off the page. */
	destroy(): void {
		this.stopPlay?.();
		this.stop();
		this.svg.remove();
	}

	/** Move time on by `ms` of real time and draw the result. Called every frame. */
	advance(ms: number): void {
		this.clock += ms * this.speed;
		let run = this.run;
		while (run) {
			if (!run.step && !this.nextStep(run, run.stepStart)) {
				if (this.run !== run) {
					// The run handed over to a hold: carry on with that one.
					run = this.run;
					continue;
				}
				// A still hold rests on the pose its body ended on, until something moves it.
				if (run.phase !== "rest") this.finish(run);
				break;
			}
			// `as Step`: nextStep has just set it, which TypeScript cannot see.
			const step = run.step as Step;
			const elapsed = this.clock - run.stepStart;
			if (elapsed < step.ms) {
				this.live = lerpPose(run.from, run.to, EASES[step.ease ?? "inOut"](elapsed / step.ms));
				break;
			}
			// This step is over: the next one starts where it ended, even within one frame.
			this.live = run.to;
			run.stepStart += step.ms;
			run.step = null;
		}
		this.moveDrops();
		this.moveRipple();
		if (this.dent && !this.dent.step(ms * this.speed)) this.dent = null;
		// The eyes ease toward where they are told to look, and back to the middle when told nothing.
		const [lookX, lookY] = this.lookGoal ?? [0, 0];
		const ease = Math.min(1, ms / 90);
		this.look = [this.look[0] + (lookX - this.look[0]) * ease, this.look[1] + (lookY - this.look[1]) * ease];
		this.draw();
	}

	// ---- Runs ----------------------------------------------------------------

	/** Add a hold and show it, unless a one-shot is playing (it picks the hold up when it ends). */
	private pushHold(name: MascotAnimationName, still: boolean): number {
		const id = ++this.lastHoldId;
		this.holds.push({ id, name, still });
		const run = this.run;
		const busy = run?.mode === "once" && run.phase !== "exit";
		const same = run?.mode === "hold" && run.name === name && !run.letGo;
		if (!busy && !same) this.start(name, "hold", still);
		return id;
	}

	/** Start playing `name`, from wherever the mascot is now: the icon or another face. */
	private start(name: MascotAnimationName, mode: Run["mode"], still = false): Run {
		this.run?.settle();
		let settle = (): void => {};
		const finished = new Promise<void>((resolve) => (settle = resolve));
		const anim: MascotAnimation = ANIMATIONS[name];
		this.run = {
			name,
			anim,
			mode,
			still,
			phase: "intro",
			queue: [...anim.intro],
			step: null,
			stepStart: this.clock,
			from: this.live,
			to: this.live,
			letGo: false,
			settle,
			finished,
		};
		this.wake();
		return this.run;
	}

	private letGo(id: number): void {
		const index = this.holds.findIndex((h) => h.id === id);
		if (index === -1) return;
		this.holds.splice(index, 1);
		// Letting go of a hold underneath another changes nothing on screen.
		if (index !== this.holds.length) return;
		const run = this.run;
		// A one-shot is playing; it looks at what is still held when it ends.
		if (!run || run.mode !== "hold") return;
		const next = this.holds[this.holds.length - 1];
		if (next) {
			if (next.name !== run.name) this.start(next.name, "hold", next.still);
			return;
		}
		run.letGo = true;
		if (run.phase === "body" || run.phase === "loop" || run.phase === "rest") {
			// Cut the expression short and head home from exactly where it is.
			run.queue = [];
			run.step = null;
			run.stepStart = this.clock;
			run.to = this.live;
			// A resting face has no frames coming: the way home needs them.
			this.wake();
		}
	}

	/** Start the run's next step at time `at`; false when the run has nothing left. */
	private nextStep(run: Run, at: number): boolean {
		while (run.queue.length === 0) if (!this.nextPhase(run)) return false;
		const step = run.queue.shift() as Step;
		run.step = step;
		run.stepStart = at;
		run.from = this.live;
		run.to = run.phase === "exit" ? REST : applySpec(run.to, step.to ?? {});
		if (step.stroke) {
			// A fresh stroke shows at once, under the brush, and grows from there.
			this.strokeReach = 0;
			run.from = { ...run.from, ink: 1 };
		}
		for (const spawn of step.spawn ?? []) this.throwDrop(spawn, at);
		return true;
	}

	/** Move the run on to its next part; false once it is over, or has handed over to a hold. */
	private nextPhase(run: Run): boolean {
		const { anim } = run;
		switch (run.phase) {
			case "intro":
				run.phase = run.letGo ? "outro" : "body";
				run.queue = [...(run.letGo ? (anim.outro ?? []) : anim.body)];
				return true;
			case "body":
			case "loop":
				if (run.mode === "hold" && !run.letGo) {
					if (run.still) {
						// Rest on the face the body ended on; nothing more to play.
						run.phase = "rest";
						return false;
					}
					run.phase = "loop";
					run.queue = [...(anim.loop ?? anim.body)];
				} else {
					run.phase = "outro";
					run.queue = [...(anim.outro ?? [])];
				}
				return true;
			case "rest":
				// Still resting, until it is let go of: then the way home, as from a loop.
				if (!run.letGo) return false;
				run.phase = "outro";
				run.queue = [...(anim.outro ?? [])];
				return true;
			case "outro": {
				// A one-shot played over a hold goes back to the hold instead of home.
				const held = this.holds[this.holds.length - 1];
				if (run.mode === "once" && held) {
					this.start(held.name, "hold", held.still);
					return false;
				}
				// One that names what follows it goes straight there, not home first.
				if (run.mode === "once" && anim.then) {
					this.start(anim.then as MascotAnimationName, "once");
					return false;
				}
				run.phase = "exit";
				run.queue = [{ ms: anim.exitMs ?? DEFAULT_EXIT_MS }];
				return true;
			}
			case "exit":
				return false;
		}
	}

	private finish(run: Run): void {
		this.run = null;
		this.live = REST;
		run.settle();
	}

	/** Keep frames coming while there is anything to draw. */
	private wake(): void {
		if (this.manual || this.frame) return;
		this.lastFrame = 0;
		const onFrame = (): void => {
			this.frame = null;
			if (this.svg.isConnected) this.wasConnected = true;
			else if (this.wasConnected) {
				// Taken off the page (a closed window, a list drawn again): nothing to animate.
				this.stop();
				return;
			}
			const now = performance.now();
			// After a hidden window, do not jump ahead by the whole time it was away.
			const elapsed = this.lastFrame ? Math.min(now - this.lastFrame, 100) : 16;
			this.lastFrame = now;
			this.advance(elapsed);
			if (this.moving()) this.frame = requestFrameFor(this.svg, onFrame);
		};
		// The window that shows the mascot, not the main one: see utils/elementFrame.ts.
		this.frame = requestFrameFor(this.svg, onFrame);
	}

	/**
	 * Whether the next frame would draw anything new: an animation playing (not a
	 * face resting on a still hold), paint in flight, a dent, a ripple, or the
	 * eyes still turning toward the pointer.
	 */
	private moving(): boolean {
		const run = this.run;
		if (run && run.phase !== "rest") return true;
		if (this.drops.length > 0 || this.dent || this.ripple) return true;
		if (!run || this.reducedMotion) return false;
		const [goalX, goalY] = this.lookGoal ?? [0, 0];
		return Math.abs(this.look[0] - goalX) > 0.001 || Math.abs(this.look[1] - goalY) > 0.001;
	}

	// ---- Drops of paint ---------------------------------------------------------

	private throwDrop(spawn: Spawn, at: number): void {
		if (this.reducedMotion) return;
		const el = add(this.dropLayer, "circle", {});
		this.drops.push({ el, born: at, spawn, origin: bodyPoint(spawn.from, this.live.body) });
	}

	/** Move every drop in flight, and take away the ones that have faded. */
	private moveDrops(): void {
		this.drops = this.drops.filter((drop) => {
			const age = this.clock - drop.born;
			const { vel, gravity, life, radius } = drop.spawn;
			if (age >= life) {
				drop.el.remove();
				return false;
			}
			const seconds = age / 1000;
			const k = age / life;
			drop.el.setAttribute("cx", num(drop.origin[0] + vel[0] * seconds));
			drop.el.setAttribute("cy", num(drop.origin[1] + vel[1] * seconds + 0.5 * gravity * seconds * seconds));
			drop.el.setAttribute("r", num(radius * (1 - 0.35 * k)));
			// Fully there for most of its life, fading out over the last 30%.
			drop.el.setAttribute("opacity", num(k < 0.7 ? 1 : (1 - k) / 0.3));
			return true;
		});
	}

	/** Spread the ring of paint from the last press, and take it away once it has faded. */
	private moveRipple(): void {
		const ripple = this.ripple;
		if (!ripple) return;
		const k = (this.clock - ripple.born) / RIPPLE_MS;
		if (k >= 1) {
			this.ripple = null;
			this.rippleEl.setAttribute("opacity", "0");
			return;
		}
		this.rippleEl.setAttribute("cx", num(ripple.at[0]));
		this.rippleEl.setAttribute("cy", num(ripple.at[1]));
		// Fast at first, slowing as it spreads.
		this.rippleEl.setAttribute("r", num(0.8 + RIPPLE_REACH * (1 - (1 - k) ** 2)));
		this.rippleEl.setAttribute("opacity", num(0.8 * (1 - k)));
	}

	// ---- Drawing --------------------------------------------------------------

	private draw(): void {
		if (!this.run) {
			this.drawRest();
			return;
		}
		const p = this.live;
		// Where the face looks: what the animation says, plus a turn toward the pointer.
		const gaze: Vec = this.reducedMotion ? p.gaze : [p.gaze[0] + this.look[0], p.gaze[1] + this.look[1]];
		const [gs, gt] = gaze;

		// `[...p.body]` copies the list, so the tremble below does not change the pose itself.
		const body: Pose["body"] = this.reducedMotion ? [0, 0, 0, 1, 1] : [...p.body];
		if (!this.reducedMotion && p.tremble) {
			body[0] += p.tremble * Math.sin(this.clock * 0.088);
			body[1] += p.tremble * 0.6 * Math.sin(this.clock * 0.069 + 1);
		}
		this.body.setAttribute("transform", `${this.dentTransform()} ${bodyTransform(body)}`.trim());

		// The mouth follows the eyes' gaze a little, as if the head turned.
		const m = p.mouth;
		const ms = gs * 0.4;
		const mt = gt * 0.4;
		this.stripe.setAttribute(
			"d",
			`M${pt(toIcon(m[0] + ms, m[1] + mt))}C${pt(toIcon(m[2] + ms, m[3] + mt))} ${pt(toIcon(m[4] + ms, m[5] + mt))} ${pt(toIcon(m[6] + ms, m[7] + mt))}`,
		);
		// SVG fills an open curve as if a straight line closed it, which turns a smile into an open mouth.
		this.stripe.setAttribute("fill", p.fill > 0.01 ? "currentColor" : "none");
		this.stripe.setAttribute("fill-opacity", num(p.fill));

		drawEye(this.eyes[0], p.eyeL, gaze);
		drawEye(this.eyes[1], p.eyeR, gaze);

		// Each cheek with its place on the face, left then right.
		const cheeks: [SVGCircleElement, Vec][] = [
			[this.cheeks[0], CHEEKS[0]],
			[this.cheeks[1], CHEEKS[1]],
		];
		for (const [cheek, [cs, ct]] of cheeks) {
			const [x, y] = toIcon(cs + gs * 0.5, ct + gt * 0.5);
			cheek.setAttribute("cx", num(x));
			cheek.setAttribute("cy", num(y));
			// They grow out of nothing as they fade in, and shrink as they fade out.
			cheek.setAttribute("r", num(CHEEK_RADIUS * p.blush));
			cheek.setAttribute("opacity", num(p.blush * 0.6));
		}

		this.drawStroke(p, body);
	}

	private drawStroke(p: Pose, body: Pose["body"]): void {
		if (p.ink < 0.01 || this.reducedMotion) {
			this.strokeEl.setAttribute("opacity", "0");
			return;
		}
		// The stroke reaches as far right as the bristle tip has been since it started.
		const tipX = bodyPoint(BRISTLE_TIP, body)[0];
		const reach = Math.min(1, Math.max(0, (tipX - STROKE_FROM_X) / (STROKE_TO_X - STROKE_FROM_X)));
		this.strokeReach = Math.max(this.strokeReach, reach);
		this.strokeEl.setAttribute("stroke-dashoffset", num(1 - this.strokeReach));
		this.strokeEl.setAttribute("opacity", num(p.ink));
	}

	/** The press's dent as a transform for the body, or "" when nothing is pressed. */
	private dentTransform(): string {
		return this.dent && !this.reducedMotion ? this.dent.matrix() : "";
	}

	/** The plain icon: Lucide's own paths, nothing else showing. */
	private drawRest(): void {
		const dent = this.dentTransform();
		if (dent) this.body.setAttribute("transform", dent);
		else this.body.removeAttribute("transform");
		this.stripe.setAttribute("d", STRIPE_D);
		this.stripe.setAttribute("fill", "none");
		for (const eye of this.eyes) eye.removeAttribute("d");
		for (const cheek of this.cheeks) cheek.setAttribute("opacity", "0");
		this.strokeEl.setAttribute("opacity", "0");
	}
}

/** An eye is three points drawn as a line of two segments; see `Eye` in mascotFace.ts. */
function drawEye(path: SVGPathElement, e: Eye, [gs, gt]: Vec): void {
	const s = e[0] + gs;
	const t = e[1] + gt;
	path.setAttribute(
		"d",
		`M${pt(toIcon(s + e[3], t + e[4]))}L${pt(toIcon(s + e[5], t + e[6]))}L${pt(toIcon(s + e[7], t + e[8]))}`,
	);
	path.setAttribute("stroke-width", num(e[2]));
}

/** Make an SVG element with `attrs` and put it at the end of `parent`. */
function add<K extends keyof SVGElementTagNameMap>(
	parent: Element,
	tag: K,
	attrs: Record<string, string>,
): SVGElementTagNameMap[K] {
	const el = svgEl(tag, attrs);
	parent.appendChild(el);
	return el;
}

/**
 * Make an SVG element with `attrs`, through Obsidian's own helper. A `class`
 * among them goes in as Obsidian's `cls`, its usual way of adding classes.
 */
function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string>): SVGElementTagNameMap[K] {
	// Take `class` out of the attributes; `...attr` collects the rest.
	const { class: cls, ...attr } = attrs;
	return createSvg(tag, { cls, attr });
}
