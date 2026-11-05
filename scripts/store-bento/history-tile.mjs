/**
 * The "Version history" tile body shared by the store bento (image 05) and the
 * README feature grid: today's heading on the timeline and its first two
 * versions, with their times, dots and buttons, cut from the guide's Version
 * history page picture and scaled to the tile's width. A third version follows
 * the second and is cut off by the tile's bottom edge, with the timeline running
 * on beside it, so the list reads as continuing. (The guide puts a "yesterday"
 * heading between the second and third versions; it would push the third one out
 * of the tile.)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

/** The part of the guide picture both tiles show, in the guide's own coordinates. */
const CROP = { x: 100, y: 176, w: 700, h: 195 };

/**
 * @param {string} root Repository root.
 * @param {(name: string, box: number[], x: number, y: number, width: number, height: number, radius?: number) => string} component The caller's crop-and-embed helper.
 * @param {(x: number, y: number, w: number, h: number, fill: string) => string} rect The caller's rectangle helper.
 * @param {{ x: number, y: number, w: number }} view Where the crop lands in the tile; its height follows from the width.
 */
export function historyTile(root, component, rect, view) {
    const source = readFileSync(path.join(root, "assets/user-guide/version-history.svg"), "utf8");
    // The guide's version boxes and timeline dots, in its own coordinates.
    const boxes = [...source.matchAll(/<rect x="195" y="([\d.]+)" width="604" height="([\d.]+)" rx="12"/g)]
        .map(match => ({ top: Number(match[1]), bottom: Number(match[1]) + Number(match[2]) }));
    const dots = [...source.matchAll(/<rect x="175" y="([\d.]+)" width="8" height="8" rx="4"/g)].map(match => Number(match[1]) + 4);
    assert.ok(boxes.length >= 3 && dots.length >= 3, "Version history needs at least three versions in the guide picture");
    const scale = view.w / CROP.w;
    // The third version starts where the guide's third group of rows does, one
    // gap below the second box - the same gap the first two boxes have. The crop
    // is taller than what shows; the tile's own clip cuts it.
    const gap = boxes[1].top - boxes[0].bottom;
    const next = { y: boxes[2].top - gap, h: 60, tileY: view.y + (boxes[1].bottom - CROP.y) * scale };
    // The guide ends the last version's timeline at its dot; carry it to the cut.
    const lineTop = next.tileY + (dots[2] - next.y) * scale;
    const lineX = view.x + (179 - CROP.x) * scale;
    return component("version-history", [CROP.x, CROP.y, CROP.w, CROP.h], view.x, view.y, view.w, CROP.h * scale)
        + component("version-history", [CROP.x, next.y, CROP.w, next.h], view.x, next.tileY, view.w, next.h * scale, 0)
        + rect(lineX, lineTop, scale, next.tileY + next.h * scale - lineTop, "rgb(51, 51, 51)");
}
