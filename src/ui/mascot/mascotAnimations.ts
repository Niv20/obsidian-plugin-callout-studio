/**
 * ui/mascot/mascotAnimations.ts — every expression the brush mascot can make,
 * written as data.
 *
 * Who uses it. The engine (brushMascot.ts) plays these by name; the places in
 * the plugin that show the mascot (mascotPlaces.ts) choose which.
 *
 * The main idea. An animation is a list of steps, and a step says "move to
 * this pose over this many milliseconds". The steps come in up to four parts:
 *
 * - `intro` brings the face out: the eyes rise from the stripe and the stripe
 *   bends into a mouth. When the mascot is already showing another face, the
 *   same steps start from that face instead.
 * - `body` is the expression itself, played once.
 * - `loop` repeats for as long as the animation is held (while the pointer
 *   is over something, or while a window is open). Without one, `body` repeats.
 * - `outro`, if there is one, plays after letting go.
 *
 * After that the engine always adds the same last step back to the plain
 * icon, so no animation can forget to end where it started. Adding an
 * animation is adding one entry to {@link ANIMATIONS}.
 */
import { type EyeName, type PoseSpec, type Vec, EYE_OUT, toIcon } from "./mascotFace";

/**
 * How a step's movement speeds up and slows down. Each takes how far through
 * the step we are (0 to 1) and says how far along the movement is.
 */
export const EASES = {
	linear: (k: number) => k,
	in: (k: number) => k * k * k,
	out: (k: number) => 1 - (1 - k) ** 3,
	inOut: (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2),
	/** Goes a little past the end and settles back: the "pop" of a face appearing. */
	outBack: (k: number) => 1 + 2.4 * (k - 1) ** 3 + 1.4 * (k - 1) ** 2,
};

/** The name of one of the eases above. */
export type EaseName = keyof typeof EASES;

/**
 * A drop of paint thrown off the brush: a tear, a splash, a bead of sweat.
 * Every drop is drawn in the theme's accent colour.
 *
 * Positions are in icon coordinates before the body moves. The engine moves
 * the starting point along with the body, then lets the drop fly on its own,
 * so it falls straight down whatever the brush does next.
 */
export interface Spawn {
	from: Vec;
	/** Starting speed, in icon units per second. */
	vel: Vec;
	/** Pull downward, in icon units per second squared. */
	gravity: number;
	/** Milliseconds until it has faded away. */
	life: number;
	radius: number;
}

/** One step: where to go, how long to take, and what to throw on the way. */
export interface Step {
	ms: number;
	to?: PoseSpec;
	ease?: EaseName;
	/** Drops thrown the moment the step starts. */
	spawn?: Spawn[];
	/** Start a fresh paint stroke under the brush. */
	stroke?: true;
}

/** One animation; see the module comment for what each part is for. */
export interface MascotAnimation {
	intro: Step[];
	body: Step[];
	loop?: Step[];
	outro?: Step[];
	/** How long the way back to the plain icon takes, in milliseconds. */
	exitMs?: number;
	/**
	 * Played once with nothing held, the animation to carry straight on with
	 * instead of going home first. A plain string, because a type made of the
	 * animations' names cannot be used inside the thing it is made from;
	 * tests/brushMascot.test.ts checks that it names a real animation.
	 */
	then?: string;
}

/** The last step of every animation lasts this long unless the animation says otherwise. */
export const DEFAULT_EXIT_MS = 320;

/**
 * The face of a search that found nothing, held for as long as nothing
 * matches, and the one `lookTwice` carries on with. One name for every place
 * that has one (the searches, Find callouts), so they cannot disagree.
 */
export const NO_RESULTS_MOOD = "sad";

// ---- Building blocks ---------------------------------------------------------

const crouch: Step = { ms: 110, to: { x: 0, y: 0.25, rot: 0, sx: 1.02, sy: 0.97 } };
const face = (to: PoseSpec, ms = 280): Step => ({ ms, to, ease: "outBack" });
const wait = (ms: number): Step => ({ ms });
const blink = (open: EyeName): Step[] => [
	{ ms: 70, to: { eyes: "shut" } },
	{ ms: 90, to: { eyes: open }, ease: "out" },
];

/** The end of the handle: confetti goes up from here, clear of the face. */
const HANDLE_END: Vec = [19.9, 4.1];
/** Just outside the bristles' upper-left curve, where a bead of sweat would sit. */
const TEMPLE: Vec = [5.0, 9.1];

/**
 * `count` drops from one point, spread evenly across a fan of angles
 * (in degrees: 0 is to the right, -90 straight up).
 */
function fan(
	from: Vec,
	count: number,
	fromDeg: number,
	toDeg: number,
	speed: number,
	rest: Pick<Spawn, "gravity" | "life" | "radius">,
): Spawn[] {
	return Array.from({ length: count }, (_, i) => {
		const angle = ((fromDeg + ((toDeg - fromDeg) * i) / (count - 1)) * Math.PI) / 180;
		// Every other drop a little slower, so the spray is not a perfect arc.
		const v = speed * (i % 2 ? 0.8 : 1.1);
		return { from, vel: [Math.cos(angle) * v, Math.sin(angle) * v] as Vec, ...rest };
	});
}

/** One tear from each eye, thrown outward and a little up before it falls. */
function tears(): Spawn[] {
	return EYE_OUT.map(([s], side) => ({
		from: toIcon(s, -2.2),
		vel: [side ? 2.6 : -2.6, -2.5] as Vec,
		gravity: 34,
		life: 640,
		radius: 0.72,
	}));
}

const CONFETTI = fan(HANDLE_END, 10, -170, -10, 12, { gravity: 30, life: 950, radius: 0.62 });
const SWEAT: Spawn = { from: TEMPLE, vel: [-0.6, 1.4], gravity: 4, life: 1000, radius: 0.68 };
const SWEAT_FALL: Spawn = { from: TEMPLE, vel: [-2, 1], gravity: 26, life: 620, radius: 0.68 };
/** Two puffs of steam from above the shoulders. Their pull is upward, so they rise instead of falling. */
const STEAM: Spawn[] = [
	{ from: TEMPLE, vel: [-2.2, -5], gravity: -6, life: 700, radius: 0.7 },
	{ from: [8.4, 6.0], vel: [1.6, -5.4], gravity: -6, life: 760, radius: 0.62 },
];

const nodDown: Step = { ms: 150, to: { y: 0.6, sx: 1.02, sy: 0.96, gaze: [0, 0.4] } };
const nodUp: Step = { ms: 150, to: { y: -0.4, sx: 0.99, sy: 1.02, gaze: [0, -0.15] } };
const hopUp = (rot = 0): Step => ({ ms: 150, to: { y: -1.3, sx: 0.97, sy: 1.05, rot }, ease: "out" });
const hopDown: Step = { ms: 150, to: { y: 0, sx: 1.03, sy: 0.95 }, ease: "in" };
const headShake: Step[] = [
	{ ms: 120, to: { rot: -7, x: -0.3, gaze: [-0.6, 0] } },
	{ ms: 160, to: { rot: 7, x: 0.3, gaze: [0.6, 0] } },
	{ ms: 150, to: { rot: -6, x: -0.25, gaze: [-0.5, 0] } },
	{ ms: 140, to: { rot: 5, x: 0.2, gaze: [0.45, 0] } },
	{ ms: 130, to: { rot: 0, x: 0, gaze: [0, 0] } },
];
/**
 * One glance: the eyes open wide and flick to `gaze` (face units: along the
 * stripe, then across it, a negative number being up), slowing down as they
 * arrive, and then stare there: they creep on a tenth further and narrow slowly,
 * as if straining to make something out, until the next glance opens them again.
 * The head tilts away from the side looked at, and rises and dips a little with
 * the eyes. `flick` and `rest` are in milliseconds.
 */
const glance = (gaze: Vec, flick: number, rest: number): Step[] => [
	{ ms: flick, to: { eyes: "dot", gaze, rot: -4 * gaze[0], y: 0.25 + 0.6 * gaze[1] }, ease: "out" },
	{ ms: rest, to: { eyes: "narrow", gaze: [gaze[0] * 1.1, gaze[1] * 1.1] }, ease: "inOut" },
];
/**
 * Looking for something: up left, down right. Every glance has its
 * own speed and its own long stare, so it does not tick like a clock and it is
 * plain that it is looking, and the eyes sweep straight across the face from one
 * corner to the next instead of stopping in the middle. There is no glance up and
 * to the right: it pushes the right eye onto the lower edge of the handle. The
 * last stop is a corner, not the middle: whatever follows (a held face) takes the
 * eyes from there, and they are narrowed, which every face that can follow
 * (`sad`, `hold`…) opens again in its intro.
 */
const searchGlances: Step[] = [...glance([-0.55, -0.45], 200, 820), ...glance([0.55, 0.4], 250, 700)];
/**
 * The answer to the search: the eyes open and look straight ahead, there is a
 * beat, and the head shakes "no". What follows takes it from there (the sad face
 * the search holds).
 */
const answerNo: Step[] = [
	{ ms: 160, to: { eyes: "dot", gaze: [0, 0], rot: 0, y: 0.25 } },
	wait(180),
	...headShake,
	wait(160),
];
const sob: Step[] = [
	{ ms: 160, to: { sy: 0.96, y: 0.6 }, spawn: tears() },
	{ ms: 220, to: { sy: 1, y: 0.4 } },
];
const leap: Step[] = [
	{ ms: 230, to: { fill: 1, y: -2.9, sx: 0.95, sy: 1.07, rot: -8 }, ease: "out", spawn: CONFETTI },
	{ ms: 220, to: { y: 0.35, sx: 1.06, sy: 0.92, rot: 0 }, ease: "in" },
	{ ms: 170, to: { y: 0, sx: 1, sy: 1, fill: 0 }, ease: "outBack" },
];
const wink: Step[] = [
	{ ms: 130, to: { eyeR: "happy", rot: -8, x: -0.2 }, ease: "out" },
	wait(640),
	{ ms: 170, to: { eyeR: "dot", rot: -3, x: 0 } },
];

// ---- The animations ------------------------------------------------------------

/**
 * Every animation, by name. (`satisfies` checks each entry against
 * MascotAnimation while keeping the names themselves as the type of a name.)
 */
export const ANIMATIONS = {
	/** Only the eyes come out, blink, and go back; the stripe stays straight. The quietest one, for idling. */
	peek: {
		intro: [{ ms: 260, to: { eyes: "dot" }, ease: "outBack" }],
		body: [wait(300), ...blink("dot"), wait(350)],
		loop: [wait(1800), ...blink("dot")],
		exitMs: 260,
	},

	/** Eyes out, a smile, one blink. The friendly default. */
	hello: {
		intro: [
			crouch,
			face({ eyes: "dot", mouth: "smile", fill: 0, y: -0.55, rot: -3, sx: 0.99, sy: 1.02 }, 290),
			{ ms: 200, to: { y: -0.35, sx: 1, sy: 1 } },
		],
		body: [...blink("dot"), wait(220)],
		loop: [
			{ ms: 1000, to: { y: -0.6, sy: 1.015 } },
			{ ms: 1000, to: { y: -0.35, sy: 1 } },
			...blink("dot"),
			wait(500),
		],
	},

	/** A smile, held a moment, then one long wink and the smile again. Meant to be played once, never held. */
	wink: {
		intro: [crouch, face({ eyes: "dot", mouth: "smile", y: -0.4, rot: -3 })],
		body: [wait(380), ...wink, wait(420)],
	},

	/** Looks around in two directions, narrowing its eyes at each, then blinks and goes round again: for searching. */
	look: {
		intro: [crouch, face({ eyes: "dot", mouth: "flat", fill: 0 })],
		body: searchGlances,
		loop: [...searchGlances, ...blink("dot"), wait(200)],
	},

	/**
	 * One round of {@link searchGlances}, then the head shakes "no"
	 * ({@link answerNo}), then it carries straight on as {@link NO_RESULTS_MOOD}
	 * (or as whatever is held): for a search that found nothing. Never passing
	 * through the plain icon, or the middle of the face, on the way is the point.
	 * (The name is from when it was two rounds of left-right.)
	 */
	lookTwice: {
		intro: [crouch, face({ eyes: "dot", mouth: "flat", fill: 0 })],
		body: [...searchGlances, ...answerNo],
		then: NO_RESULTS_MOOD,
	},

	/** Yes: a double nod with a smile. */
	nod: {
		intro: [crouch, face({ eyes: "dot", mouth: "smile" })],
		body: [nodDown, nodUp, nodDown, { ms: 180, to: { y: 0, sx: 1, sy: 1, gaze: [0, 0] } }, wait(200)],
		loop: [wait(700), nodDown, nodUp, { ms: 180, to: { y: 0, sx: 1, sy: 1, gaze: [0, 0] } }],
	},

	/** No: a shake of the head. */
	no: {
		intro: [crouch, face({ eyes: "dot", mouth: "flat" })],
		body: [...headShake, wait(220)],
		loop: [...headShake, wait(500)],
	},

	surprised: {
		intro: [{ ms: 110, to: { eyes: "big", mouth: "oh", fill: 1, y: -1.1, sx: 0.96, sy: 1.06 }, ease: "out" }],
		body: [{ ms: 240, to: { y: 0, sx: 1, sy: 1 }, ease: "outBack" }, wait(380), ...blink("big"), wait(200)],
		loop: [wait(1200), ...blink("big")],
	},

	happy: {
		intro: [crouch, face({ eyes: "happy", mouth: "grin", y: -0.4, rot: -3 })],
		body: [
			{ ms: 200, to: { y: -1, sx: 0.98, sy: 1.03 }, ease: "out" },
			{ ms: 200, to: { y: 0, sx: 1.02, sy: 0.97 }, ease: "in" },
			{ ms: 160, to: { y: -0.3, sx: 1, sy: 1 }, ease: "outBack" },
			wait(160),
		],
		loop: [
			{ ms: 480, to: { rot: -7, y: -0.6 } },
			{ ms: 480, to: { rot: 1, y: -0.3 } },
		],
	},

	/** Wide eyes, mouth open, can't keep still: for hovering an "add" button. */
	excited: {
		intro: [crouch, face({ eyes: "big", mouth: "grin", fill: 1, y: -0.4 })],
		body: [hopUp(), hopDown, hopUp(), hopDown, { ms: 120, to: { sx: 1, sy: 1 } }],
		loop: [hopUp(-4), hopDown, hopUp(4), hopDown, wait(100)],
	},

	/** A high jump, confetti from the handle, a little dance. */
	celebrate: {
		intro: [{ ms: 150, to: { eyes: "happy", mouth: "grin", x: 0, y: 0.6, rot: 0, sx: 1.08, sy: 0.88 } }],
		body: [
			...leap,
			{ ms: 180, to: { rot: -6 } },
			{ ms: 180, to: { rot: 5 } },
			{ ms: 160, to: { rot: 0 } },
			wait(220),
		],
		loop: [{ ms: 150, to: { y: 0.6, sx: 1.08, sy: 0.88 } }, ...leap, wait(300)],
	},

	sad: {
		intro: [
			{ ms: 150, to: { y: 0.15 } },
			{ ms: 450, to: { eyes: "dot", gaze: [0, 0.35], mouth: "frown", fill: 0, rot: 6, y: 0.6, sy: 0.97 } },
		],
		body: [wait(250), { ms: 800, to: { sy: 0.95, y: 0.8 } }, { ms: 800, to: { sy: 0.98, y: 0.6 } }],
		loop: [
			{ ms: 1300, to: { sy: 0.95, y: 0.8, gaze: [-0.25, 0.4] } },
			{ ms: 1300, to: { sy: 0.98, y: 0.6, gaze: [0.1, 0.35] } },
			...blink("dot"),
		],
		exitMs: 420,
	},

	/** Sobs, and every sob throws a drop of paint from each eye. */
	cry: {
		intro: [
			{ ms: 120, to: { y: 0.2 } },
			{ ms: 300, to: { eyes: "weep", mouth: "frown", fill: 1, rot: 4, y: 0.4 } },
		],
		body: [...sob, ...sob, wait(260)],
		exitMs: 380,
	},

	/** Leans away and trembles, a bead of sweat at the temple: for "this can't be undone". */
	scared: {
		intro: [
			{ ms: 90, to: { eyes: "big", mouth: "wavy", fill: 0, y: -0.5, sx: 0.98, sy: 1.04 }, ease: "out" },
			{ ms: 240, to: { rot: 8, x: 0.5, y: 0.3, sx: 0.98, sy: 0.97, tremble: 0.18 }, ease: "out" },
		],
		body: [{ ms: 500, spawn: [SWEAT] }, { ms: 130, to: { sy: 0.94 } }, { ms: 170, to: { sy: 0.97 } }, wait(300)],
		loop: [{ ms: 900, spawn: [SWEAT] }, { ms: 130, to: { sy: 0.94 } }, { ms: 170, to: { sy: 0.97 } }, wait(400)],
	},

	/** Stands tall and still, eyes ahead, breathing slowly: for "paused, nothing is lost". */
	hold: {
		intro: [crouch, face({ eyes: "dot", mouth: "flat", fill: 0, gaze: [0, 0], y: -0.2 }, 320)],
		body: [
			{ ms: 900, to: { sy: 1.015, y: -0.3 } },
			{ ms: 900, to: { sy: 0.99, y: -0.1 } },
			...blink("dot"),
			wait(200),
		],
		exitMs: 380,
	},

	/** A long breath out, and the bead of sweat drops off: after backing out of something risky. */
	relief: {
		// A pose carries over from the face before it, and relief follows "scared"
		// (the pointer reaches Cancel while the window is still afraid): the shaking
		// has to be stopped here, or the brush breathes out while still trembling.
		intro: [
			{ ...crouch, to: { ...crouch.to, tremble: 0 } },
			face({ eyes: "shut", mouth: "smile", fill: 0, y: -0.3 }, 260),
		],
		body: [
			{ ms: 520, to: { sy: 0.93, sx: 1.03, y: 0.7 }, spawn: [SWEAT_FALL] },
			{ ms: 360, to: { sy: 1.01, sx: 1, y: -0.2 }, ease: "outBack" },
			{ ms: 160, to: { eyes: "dot" } },
			wait(320),
		],
		loop: [
			{ ms: 700, to: { sy: 0.96, y: 0.4 } },
			{ ms: 700, to: { sy: 1, y: 0 } },
		],
	},

	/** Paints a stroke underneath, lifts, goes back for the next one: for work in progress. */
	paint: {
		intro: [
			crouch,
			face({ eyes: "dot", gaze: [0.35, 0.35], mouth: "tiny", fill: 0 }),
			{ ms: 320, to: { x: -4.5, rot: -10 } },
		],
		body: [
			{ ms: 950, to: { x: 4.5, rot: 8, ink: 1 }, stroke: true },
			{ ms: 320, to: { y: -0.9 } },
			{ ms: 480, to: { x: -4.5, rot: -10, y: 0, ink: 0 } },
		],
	},

	/**
	 * The pointer is near: the eyes pop out, blink once, and blink again now
	 * and then for as long as it stays. What an icon at rest does when you
	 * come close.
	 */
	notice: {
		intro: [{ ms: 150, to: { eyes: "dot" }, ease: "outBack" }],
		body: [wait(90), ...blink("dot"), wait(120)],
		loop: [wait(2600), ...blink("dot")],
		exitMs: 220,
	},

	/** Poked: the eyes screw shut and the mouth opens, for as long as the press lasts. */
	ouch: {
		intro: [{ ms: 70, to: { eyes: "squint", mouth: "oh", fill: 1 }, ease: "out" }],
		body: [wait(120)],
		exitMs: 200,
	},

	/** Poked again and again: the squint, then a glare, red cheeks, two stamps, and a puff of steam from each. */
	angry: {
		intro: [
			// First the squint a press makes (`ouch`), whatever face it was showing. The
			// pointer asks for `ouch` and `angry` in the same moment, so without this
			// the face would jump from its mood straight to the glare.
			{ ms: 90, to: { eyes: "squint", mouth: "oh", fill: 1 }, ease: "out" },
			// The cheeks come up over these two steps, half in each and at one even speed
			// (both linear, about the same length): in one quick step they popped in.
			{ ...crouch, to: { ...crouch.to, blush: 0.5 }, ease: "linear" },
			{ ms: 120, to: { eyes: "glare", mouth: "frown", fill: 0, blush: 1, tremble: 0.2 }, ease: "linear" },
		],
		body: [
			{ ms: 130, to: { y: -1.2, sx: 0.97, sy: 1.05 }, ease: "out", spawn: STEAM },
			{ ms: 100, to: { y: 0.35, sx: 1.06, sy: 0.92 }, ease: "in" },
			{ ms: 130, to: { y: -1, sx: 0.97, sy: 1.05 }, ease: "out", spawn: STEAM },
			{ ms: 100, to: { y: 0.3, sx: 1.05, sy: 0.93 }, ease: "in" },
			{ ms: 140, to: { y: 0, sx: 1, sy: 1 } },
			wait(420),
		],
		// Played over a mascot that holds a mood, it hands back to that mood instead
		// of going home: the glare, the red cheeks and the shaking have to be put
		// away here, or the mood carries them on. The cheeks go slowly and evenly: with
		// the ease of the other steps they stayed full and then vanished in a blink.
		outro: [{ ms: 420, to: { blush: 0, tremble: 0 }, ease: "linear" }],
		exitMs: 360,
	},
} satisfies Record<string, MascotAnimation>;

/** The name of an animation: "hello", "scared", … */
export type MascotAnimationName = keyof typeof ANIMATIONS;
