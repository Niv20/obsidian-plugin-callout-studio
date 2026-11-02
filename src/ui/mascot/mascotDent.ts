/**
 * ui/mascot/mascotDent.ts — the dent a poke leaves in the brush mascot.
 *
 * Who uses it. The engine (brushMascot.ts) keeps one `Dent` while the mascot
 * is being poked, moves it on every frame and draws it as one extra transform
 * on the brush. It knows nothing about the page: numbers in, a `transform`
 * string out.
 *
 * The main idea. A poke is a spring. While the pointer is down the spring is
 * pulled toward 1 ("pressed in"); the moment it lets go it is pulled toward 0,
 * and because the spring is bouncy the brush pops back out a little past where
 * it started before it settles. `depth` is where the spring is now, and the
 * picture only ever reads it.
 *
 * What "pressed in" looks like. The brush is squashed toward the side away from
 * the poke, so the side that was touched goes in and the far side stays where
 * it was, as when a finger presses a soft toy. It is also shoved a little the
 * way the poke went and leans away from it, about its feet. A poke in the very
 * middle has no side to go in from, so it squashes the brush evenly.
 */
import { num, type Vec } from "./mascotFace";

/** The brush's visual middle in icon coordinates, and how far its edge is from it. */
const MIDDLE: Vec = [12, 13];
const REACH = 11;
/** The brush's feet: what it leans about, as in `bodyTransform`. */
const FEET: Vec = [12, 22];

/** A poke further than this from the middle counts as fully at the edge. */
const EDGE_AT = 8;
/** The spring's two moods: stiff and well damped while pressing, loose and bouncy when let go. */
const PRESS = { stiffness: 1100, damping: 2 * 0.75 * Math.sqrt(1100) };
const RELEASE = { stiffness: 900, damping: 2 * 0.26 * Math.sqrt(900) };
/** The spring is worked out in steps this short, so a slow frame cannot make it explode. */
const SUBSTEP_S = 0.004;

export class Dent {
	/** How far in: 0 flat, 1 fully pressed. It goes a little below 0 on the way back (the pop out). */
	depth = 0;
	private speed = 0;
	/** Where the spring is heading: 1 while pressed, 0 once let go. */
	private goal = 1;
	/** How hard this poke is: more than 1 for a poke that follows quickly on another. */
	private force = 1;
	/** The way the poke pushes: a unit vector from the poke through the middle. */
	private push: Vec = [0, 1];
	/** 0 for a poke in the middle, 1 at the edge: how much of the squash is sideways. */
	private edge = 0;

	constructor(at: Vec, force: number) {
		this.press(at, force);
	}

	/** Pressed again, at `at`, while still springing from the last one: only the aim changes. */
	press(at: Vec, force: number): void {
		this.goal = 1;
		this.force = force;
		const dx = MIDDLE[0] - at[0];
		const dy = MIDDLE[1] - at[1];
		const distance = Math.hypot(dx, dy);
		// A poke dead in the middle pushes straight down, which squashes the brush toward its feet.
		this.push = distance < 0.01 ? [0, 1] : [dx / distance, dy / distance];
		this.edge = Math.min(1, distance / EDGE_AT);
	}

	/** The pointer let go: spring back. */
	release(): void {
		this.goal = 0;
	}

	/**
	 * Move the spring on by `ms`. Returns whether there is anything left to
	 * draw: false once it is let go and lying flat again.
	 */
	step(ms: number): boolean {
		const { stiffness, damping } = this.goal === 1 ? PRESS : RELEASE;
		for (let left = ms / 1000; left > 0; left -= SUBSTEP_S) {
			const dt = Math.min(left, SUBSTEP_S);
			this.speed += (stiffness * (this.goal - this.depth) - damping * this.speed) * dt;
			this.depth += this.speed * dt;
		}
		return this.goal === 1 || Math.abs(this.depth) > 0.004 || Math.abs(this.speed) > 0.05;
	}

	/**
	 * The dent as an SVG `matrix(a b c d e f)`: squash along the push, stretch
	 * across it a little, both about the far edge; then lean about the feet and
	 * shove away. Worked out by moving three points through it (the corner and
	 * the two unit steps), which is all a matrix is.
	 */
	matrix(): string {
		const d = this.depth * this.force;
		const e = this.edge;
		const [ax, ay] = this.push;
		const along = 1 - d * (0.08 + 0.08 * e);
		const across = 1 - d * (0.08 - 0.12 * e);
		// Leans away from a poke at the side, clockwise or not; about 4 degrees at the edge.
		const lean = (ax * 4 * d * e * Math.PI) / 180;
		const shove = 0.9 * d * e;
		// The far edge: where the brush stays put while the touched side goes in.
		const px = MIDDLE[0] + ax * REACH;
		const py = MIDDLE[1] + ay * REACH;
		const [cos, sin] = [Math.cos(lean), Math.sin(lean)];

		const move = ([x, y]: Vec): Vec => {
			const rx = x - px;
			const ry = y - py;
			// `a` is the push; the sideways direction is `a` turned a quarter turn.
			const a = rx * ax + ry * ay;
			const s = -rx * ay + ry * ax;
			const sx = px + ax * a * along - ay * s * across;
			const sy = py + ay * a * along + ax * s * across;
			const lx = sx - FEET[0];
			const ly = sy - FEET[1];
			return [FEET[0] + lx * cos - ly * sin + ax * shove, FEET[1] + lx * sin + ly * cos + ay * shove];
		};
		const [e0, f0] = move([0, 0]);
		const [x1, y1] = move([1, 0]);
		const [x2, y2] = move([0, 1]);
		return `matrix(${num(x1 - e0)} ${num(y1 - f0)} ${num(x2 - e0)} ${num(y2 - f0)} ${num(e0)} ${num(f0)})`;
	}
}
