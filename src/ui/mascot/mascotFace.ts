/**
 * ui/mascot/mascotFace.ts — the geometry the brush mascot is drawn from.
 *
 * Who uses it. The engine (brushMascot.ts) draws every frame from here, and
 * the animation list (mascotAnimations.ts) names the shapes defined here.
 *
 * The main idea. The mascot is the plugin's own icon, Lucide's "paintbrush",
 * and its face is "born from the stripe": while the brush is the plain icon,
 * both eyes wait inside the stripe across the bristles (a dot as wide as the
 * line is invisible on it), and the stripe itself is the mouth. Every
 * expression starts by pulling the eyes up out of the line and bending the
 * line into a mouth, and ends by putting both back.
 *
 * Everything an animation can move is a number in a `Pose`, so moving from
 * one expression to another is only ever "move each number a little closer".
 * Nothing in this file touches the page.
 */

/** A point or a direction: `[x, y]`. */
export type Vec = [number, number];

// Lucide "paintbrush" (ISC licence), exactly as Obsidian draws it.
export const HANDLE_D =
	"M18.376 2.622a1 1 0 1 1 3.002 3.002L17.36 9.643a.5.5 0 0 0 0 .707l.944.944a2.41 2.41 0 0 1 0 3.408l-.944.944a.5.5 0 0 1-.707 0L8.354 7.348a.5.5 0 0 1 0-.707l.944-.944a2.41 2.41 0 0 1 3.408 0l.944.944a.5.5 0 0 0 .707 0z";
export const BRISTLES_D =
	"M9 8c-1.804 2.71-3.97 3.46-6.583 3.948a.507.507 0 0 0-.302.819l7.32 8.883a1 1 0 0 0 1.185.204C12.735 20.405 16 16.792 16 15";
export const STRIPE_D = "m14.622 17.897-10.68-2.913";

/*
 * Face coordinates. `s` runs along the stripe from its left end (0) to its
 * right end (STRIPE_LEN); `t` is at a right angle to it and grows away from
 * the handle, so a negative `t` is "up" on the face. Shapes written in this
 * frame stay level with the stripe at whatever angle the icon draws it.
 */
const ORIGIN: Vec = [3.942, 14.984];
const END: Vec = [14.622, 17.897];
const STRIPE_LEN = Math.hypot(END[0] - ORIGIN[0], END[1] - ORIGIN[1]);
/** One unit along the stripe, in icon coordinates. */
const U: Vec = [(END[0] - ORIGIN[0]) / STRIPE_LEN, (END[1] - ORIGIN[1]) / STRIPE_LEN];

/** Face coordinates to the icon's own 24 × 24 coordinates. */
export function toIcon(s: number, t: number): Vec {
	return [ORIGIN[0] + s * U[0] - t * U[1], ORIGIN[1] + s * U[1] + t * U[0]];
}

/**
 * A direction on the icon (right, down) as a direction on the face: how far
 * along the stripe it goes, and how far across it. The way back from
 * {@link toIcon}, for a face that looks at the pointer.
 */
export function toFace(dx: number, dy: number): Vec {
	return [dx * U[0] + dy * U[1], -dx * U[1] + dy * U[0]];
}

/** Where each eye waits inside the stripe, and where it sits once it is out. */
const EYE_HOME: [Vec, Vec] = [[3.9, 0], [7.3, 0]];
export const EYE_OUT: [Vec, Vec] = [[3.9, -2.9], [7.3, -2.9]];

/** The two cheeks for blushing, one either side of the mouth. */
export const CHEEKS: [Vec, Vec] = [[2.3, -1.0], [9.0, -1.2]];

/**
 * One eye: its centre (s, t), its stroke width, then three points relative
 * to the centre, drawn as a line of two segments. All three points on the
 * centre make a dot (a line of no length, with round ends); spread out they
 * make a dash, a ^ or a >. Since every shape has the same three points, any
 * eye can turn into any other one, point by point.
 *
 * (The `[s: number, …]` labels only name the positions for the reader; to
 * TypeScript it is a list of nine numbers.)
 */
export type Eye = [s: number, t: number, width: number, x0: number, y0: number, x1: number, y1: number, x2: number, y2: number];

/** An eye's stroke width and its three points, without the centre. */
type EyeShape = [width: number, x0: number, y0: number, x1: number, y1: number, x2: number, y2: number];

// The last point sits a hair off the centre: some renderers skip the round
// ends of a line that has no length at all, and the dot would vanish.
const DOT = [0, 0, 0, 0, 0.001, 0];
const both = (shape: EyeShape): [EyeShape, EyeShape] => [shape, shape];

/** Each expression's left and right eye. */
export const EYES = {
	/** Inside the stripe: the plain icon. */
	hidden: both([2, ...DOT] as EyeShape),
	dot: both([2, ...DOT] as EyeShape),
	/** Wide open, for fright and surprise. */
	big: both([2.75, ...DOT] as EyeShape),
	/** Shrunk to a pinpoint. */
	small: both([1.5, ...DOT] as EyeShape),
	/** Closed: a short level dash. */
	shut: both([1.4, -0.75, 0.15, 0, 0.15, 0.75, 0.15]),
	/**
	 * Narrowed, as if straining to see: a slit, wider than it is tall. Its middle
	 * point stays on the centre (unlike `shut`, which sits a little low), so it
	 * is the same eye, half closed, and not a blink.
	 */
	narrow: both([1.15, -0.5, 0, 0, 0, 0.5, 0]),
	/** Closed and smiling: ^ ^ */
	happy: both([1.5, -0.8, 0.45, 0, -0.35, 0.8, 0.45]),
	/** Screwed shut: > < */
	squint: [
		[1.5, -0.55, -0.7, 0.5, 0, -0.55, 0.7],
		[1.5, 0.55, -0.7, -0.5, 0, 0.55, 0.7],
	],
	/** Closed and sorry for itself, the inner ends lifted: / \ */
	weep: [
		[1.4, -0.75, 0.3, 0, 0, 0.75, -0.3],
		[1.4, -0.75, -0.3, 0, 0, 0.75, 0.3],
	],
	/**
	 * Furious: a heavy brow over each eye, the inner ends lowered: \ /
	 * The stripe the face is drawn along slopes down to the right, which tips
	 * both brows with it. So the left one is nearly level on the face and the
	 * right one steep, and on the screen they slope the same amount each way.
	 */
	glare: [
		[1.7, -0.8, -0.2, 0, 0, 0.8, 0.2],
		[1.7, -0.7, 0.55, 0, 0, 0.7, -0.55],
	],
} satisfies Record<string, [EyeShape, EyeShape]>;

/** The name of one of the shapes above ("dot", "happy", …). */
export type EyeName = keyof typeof EYES;

/** The eye `name` on one side (0 left, 1 right), at its place on the face. */
function eye(name: EyeName, side: 0 | 1): Eye {
	const [s, t] = name === "hidden" ? EYE_HOME[side] : EYE_OUT[side];
	return [s, t, ...EYES[name][side]];
}

/** A mouth is one cubic curve in face coordinates: four points, s and t each. */
export type Mouth = [number, number, number, number, number, number, number, number];

/**
 * Mouth shapes. The bristles narrow toward the left, so a mouth that dips
 * low has to stay right of about s = 4, or it runs into the outline.
 */
export const MOUTHS = {
	/** The stripe itself: a straight curve from end to end. */
	line: [0, 0, STRIPE_LEN / 3, 0, (2 * STRIPE_LEN) / 3, 0, STRIPE_LEN, 0],
	smile: [4.15, 0.15, 4.55, 1.3, 6.75, 1.3, 7.15, 0.15],
	/** Wider, corners higher. Filled in, it becomes a laugh. */
	grin: [3.9, -0.2, 4.35, 1.4, 6.95, 1.4, 7.4, -0.2],
	flat: [4.5, 0.4, 5.2, 0.4, 6.1, 0.4, 6.8, 0.4],
	frown: [4.6, 0.65, 5.05, -0.4, 6.45, -0.4, 6.9, 0.65],
	/** An S: the nervous, wobbly mouth. */
	wavy: [4.3, 0.45, 5.0, -0.55, 6.1, 1.35, 6.95, 0.3],
	/** A loop that starts and ends at one point; filled in, it is an "o". */
	oh: [5.65, -0.15, 4.6, 1.45, 6.7, 1.45, 5.65, -0.15],
	/** One corner up. */
	smirk: [4.7, 0.55, 5.4, 0.75, 6.5, 0.6, 7.15, -0.1],
	tiny: [5.4, 0.45, 5.55, 0.6, 5.75, 0.6, 5.9, 0.45],
} satisfies Record<string, Mouth>;

/** The name of one of the mouths above. */
export type MouthName = keyof typeof MOUTHS;

/** The whole brush's transform: x, y, rotation in degrees, scale x, scale y. */
export type Body = [x: number, y: number, rot: number, sx: number, sy: number];

/** One frame of the mascot. Animations move between poses number by number. */
export interface Pose {
	eyeL: Eye;
	eyeR: Eye;
	/** Moves both eyes (and the mouth a little) to look somewhere. */
	gaze: Vec;
	mouth: Mouth;
	/** 0 draws the mouth as a line; 1 fills it in as an open mouth. */
	fill: number;
	body: Body;
	/** How hard the whole brush shakes, in icon units. */
	tremble: number;
	/** How strongly the cheeks blush: 0 not at all, 1 fully. */
	blush: number;
	/** How visible the paint stroke under the brush is: 0 to 1. */
	ink: number;
}

/** The plain icon. */
export const REST: Pose = {
	eyeL: eye("hidden", 0),
	eyeR: eye("hidden", 1),
	gaze: [0, 0],
	mouth: MOUTHS.line,
	fill: 0,
	body: [0, 0, 0, 1, 1],
	tremble: 0,
	blush: 0,
	ink: 0,
};

/**
 * The parts of a pose one step of an animation changes; everything it leaves
 * out carries over from the step before. (Every field ends in `?`, which
 * means "may be left out".)
 */
export interface PoseSpec {
	/** Both eyes at once… */
	eyes?: EyeName;
	/** …or one of them. */
	eyeL?: EyeName;
	eyeR?: EyeName;
	gaze?: Vec;
	mouth?: MouthName;
	fill?: number;
	x?: number;
	y?: number;
	rot?: number;
	sx?: number;
	sy?: number;
	tremble?: number;
	blush?: number;
	ink?: number;
}

/** `base`, with what `spec` names changed. `base` itself is left as it was. */
export function applySpec(base: Pose, spec: PoseSpec): Pose {
	const [x, y, rot, sx, sy] = base.body;
	// `a ?? b` reads "a, or b when a is missing".
	const left = spec.eyeL ?? spec.eyes;
	const right = spec.eyeR ?? spec.eyes;
	return {
		eyeL: left ? eye(left, 0) : base.eyeL,
		eyeR: right ? eye(right, 1) : base.eyeR,
		gaze: spec.gaze ?? base.gaze,
		mouth: spec.mouth ? MOUTHS[spec.mouth] : base.mouth,
		fill: spec.fill ?? base.fill,
		body: [spec.x ?? x, spec.y ?? y, spec.rot ?? rot, spec.sx ?? sx, spec.sy ?? sy],
		tremble: spec.tremble ?? base.tremble,
		blush: spec.blush ?? base.blush,
		ink: spec.ink ?? base.ink,
	};
}

/**
 * The list of numbers `k` of the way from `a` to `b` (0 is `a`, 1 is `b`).
 * (`<T extends …>` lets it hand back the same kind of list it was given: an
 * `Eye` in, an `Eye` out.)
 */
function lerpList<T extends readonly number[]>(a: T, b: T, k: number): T {
	// Both lists always have the same length; `?? v` only tells TypeScript so.
	return a.map((v, i) => v + ((b[i] ?? v) - v) * k) as unknown as T;
}

const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;

/** The pose `k` of the way from `a` to `b`, every number on its own. */
export function lerpPose(a: Pose, b: Pose, k: number): Pose {
	return {
		eyeL: lerpList(a.eyeL, b.eyeL, k),
		eyeR: lerpList(a.eyeR, b.eyeR, k),
		gaze: lerpList(a.gaze, b.gaze, k),
		mouth: lerpList(a.mouth, b.mouth, k),
		fill: lerp(a.fill, b.fill, k),
		body: lerpList(a.body, b.body, k),
		tremble: lerp(a.tremble, b.tremble, k),
		blush: lerp(a.blush, b.blush, k),
		ink: lerp(a.ink, b.ink, k),
	};
}

/**
 * Where an icon point lands once the body transform is applied: the same
 * maths as the `transform` attribute {@link bodyTransform} writes. Scale about
 * the bristle tip's baseline, so a squash keeps the brush on the ground, then
 * turn about the middle, then move.
 */
export function bodyPoint([px, py]: Vec, [x, y, rot, sx, sy]: Body): Vec {
	const scaledX = 12 + (px - 12) * sx;
	const scaledY = 22 + (py - 22) * sy;
	const a = (rot * Math.PI) / 180;
	const dx = scaledX - 12;
	const dy = scaledY - 13;
	return [12 + dx * Math.cos(a) - dy * Math.sin(a) + x, 13 + dx * Math.sin(a) + dy * Math.cos(a) + y];
}

/** The body as an SVG `transform` attribute (read right to left: scale, turn, move). */
export function bodyTransform([x, y, rot, sx, sy]: Body): string {
	return `translate(${num(x)} ${num(y)}) rotate(${num(rot)} 12 13) translate(12 22) scale(${num(sx)} ${num(sy)}) translate(-12 -22)`;
}

/** A number for an SVG attribute: three decimals at most, no trailing zeros. */
export const num = (v: number): string => String(Math.round(v * 1000) / 1000);
/** A point for an SVG path: "x y". */
export const pt = ([x, y]: Vec): string => `${num(x)} ${num(y)}`;
