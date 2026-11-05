/**
 * scripts/user-guide/mascotStill.mjs - the brush mascot, held still for a picture.
 *
 * The mascot moves on animation frames from the real clock, so a picture taken
 * of one would catch a different pose each time it is drawn. A guide scene
 * must draw the same SVG twice, so here the mascot never asks for a frame: it
 * stays on whatever it is told, and a scene that wants a mood moves its clock
 * on by a fixed amount (`settleMascots`) and takes the picture there. A
 * mascot nobody settles stays the plain paintbrush icon, as at rest.
 *
 * Importing this file is what installs the change; scenes.mjs does it once.
 */
import { BrushMascot } from "../../src/ui/mascot/brushMascot.ts";

/** Every mascot that asked for frames, in the order it asked. */
const waiting = new Set();

// `wake` is the mascot's request for the next frame (a private method in the
// source, an ordinary one on the prototype once built).
BrushMascot.prototype.wake = function () {
	waiting.add(this);
};

/** One frame of a 60 Hz screen. */
const FRAME_MS = 1000 / 60;

/**
 * Move every mascot's own clock on by `ms`, frame by frame, as the real
 * clock would have, and draw where it ends. A held mood that rests on its last
 * pose (a still hold) is there for good after its way in; one that loops
 * (the window's scared face) is wherever its loop is at `ms`.
 */
export function settleMascots(ms) {
	for (let elapsed = 0; elapsed < ms; elapsed += FRAME_MS) {
		for (const mascot of waiting) mascot.advance(FRAME_MS);
	}
}
