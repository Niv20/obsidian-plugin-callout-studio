/**
 * manager/css/iconBox.ts — the width of a regular callout icon box.
 *
 * Shared by the per-id CSS pseudo-element painter and the unknown-fallback DOM
 * painter. Keeping the aspect calculation in one leaf makes those two live
 * paths agree for wide uploaded pictures.
 */
import type { UserImageIcon } from "../../types";

/**
 * How far off square a picture may be drawn before it is squeezed back.
 *
 * Icon boxes are square, and `contain` inside one shrinks a wide logo until its
 * *width* fits — a 3:1 banner would render a third of the height of every other
 * callout's icon. Widening the box instead keeps the height constant, which is
 * what makes a row of callouts line up. The clamp stops a pathological ratio
 * from pushing the title clean off the line.
 */
const MAX_ICON_ASPECT = 4;

/** A picture's icon-box width, or the plain square for a glyph. */
export function iconBoxWidth(picture: UserImageIcon | undefined): string {
	const size = "var(--icon-size, 1.2em)";
	if (!picture || picture.height <= 0) return size;
	const aspect = Math.min(
		Math.max(picture.width / picture.height, 1 / MAX_ICON_ASPECT),
		MAX_ICON_ASPECT,
	);
	// Within a hair of square, the multiplication is noise in the output CSS.
	if (Math.abs(aspect - 1) < 0.01) return size;
	return `calc(${size} * ${aspect.toFixed(3)})`;
}
