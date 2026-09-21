/**
 * icons/userImageImport.ts — Turning a file off the user's disk into an icon.
 *
 * Two routes in, one shape out. An SVG is filtered through the allow-list and
 * kept as vector, because a drawing that stays a drawing is crisp at every zoom
 * and every icon size. A PNG/JPEG/WebP is decoded, scaled down and re-encoded
 * through a canvas, then wrapped in `<svg><image href="data:…"></svg>` so that
 * it too is SVG markup by the time anything else sees it — which is what lets
 * the resolver, every render surface and the PDF-export path stay unaware that
 * user images exist at all.
 *
 * Re-encoding is also the security story for rasters: what gets stored is
 * decoded pixels drawn onto a canvas, so nothing of the original file's
 * structure survives to be interpreted by anything later.
 */
import { sanitizeUserSvg } from "./svg";
import {
	newUserImageId,
	userImageNameFromFilename,
} from "../utils/userImages";
import type { LocaleKey } from "../i18n";
import type { UserImageIcon } from "../types";

/**
 * Longest side of a stored raster, in pixels.
 *
 * A callout icon is about 20 CSS px; at a 3× device pixel ratio and the icon
 * size slider's 150 % maximum that is 90 px, so 128 leaves headroom and still
 * keeps a picture down in the low tens of kilobytes. (Admonition stores 24 px,
 * which is why its uploaded icons look soft on any modern display.)
 */
const MAX_RENDITION_PX = 128;

/** Refuse to even decode anything larger; nothing sane is an icon at this size. */
const MAX_SOURCE_BYTES = 5 * 1024 * 1024;

/**
 * Above this, a PNG rendition is a photograph rather than a logo, and JPEG will
 * store the same picture several times smaller — worth switching to whenever
 * there is no transparency to lose.
 */
const PNG_SIZE_THRESHOLD = 48 * 1024;
const JPEG_QUALITY = 0.85;

export type UserImageImportResult =
	| { ok: true; image: UserImageIcon }
	| { ok: false; reason: LocaleKey };

/** Extensions offered in the file picker, and accepted from a drop. */
export const USER_IMAGE_ACCEPT = ".svg,.png,.jpg,.jpeg,.webp";

/**
 * Read one file into a storable picture, or say why it cannot be one.
 *
 * Never throws: a bad file is an outcome the picker reports, not an error that
 * should abandon the rest of a multi-file drop.
 */
export async function importImageFile(
	file: File,
): Promise<UserImageImportResult> {
	if (file.size > MAX_SOURCE_BYTES) {
		return { ok: false, reason: "iconPicker.customTooLarge" };
	}

	try {
		const format = await detectFormat(file);
		if (!format) return { ok: false, reason: "iconPicker.customUnsupported" };

		const artwork =
			format === "svg"
				? await readSvg(file)
				: await readRaster(file, format);
		if (!artwork) {
			return {
				ok: false,
				reason:
					format === "svg"
						? "iconPicker.customInvalidSvg"
						: "iconPicker.customDecodeFailed",
			};
		}

		return {
			ok: true,
			image: {
				id: newUserImageId(),
				// The filename as it stands on disk. The name is also the
				// collection's uniqueness key, so it is derived in one place —
				// see utils/userImages.
				name: userImageNameFromFilename(file.name),
				format,
				svg: artwork.svg,
				width: artwork.width,
				height: artwork.height,
				// Only a flat one-colour drawing is worth offering as
				// recolourable. A raster never is — a mask is a stencil, so it
				// would come out a silhouette.
				monochrome: format === "svg" && isMonochrome(artwork.svg),
				rev: 1,
				addedAt: Date.now(),
			},
		};
	} catch {
		return { ok: false, reason: "iconPicker.customDecodeFailed" };
	}
}

/* ------------------------------------------------------------------ *
 * Format detection
 * ------------------------------------------------------------------ */

/**
 * What this file actually is, read from its first bytes rather than its name.
 *
 * An extension is a claim by whoever named the file; the signature is the file
 * itself, and the two disagree often enough (a `.png` that is really a JPEG is
 * routine) that trusting the name would reject perfectly good pictures.
 */
async function detectFormat(
	file: File,
): Promise<UserImageIcon["format"] | undefined> {
	const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
	if (startsWith(head, [0x89, 0x50, 0x4e, 0x47])) return "png";
	if (startsWith(head, [0xff, 0xd8, 0xff])) return "jpeg";
	// "RIFF" .... "WEBP"
	if (
		startsWith(head, [0x52, 0x49, 0x46, 0x46]) &&
		startsWith(head.subarray(8), [0x57, 0x45, 0x42, 0x50])
	) {
		return "webp";
	}
	// SVG is text, and may open with a BOM, a declaration, a doctype or a
	// comment before the root element ever appears.
	const text = new TextDecoder().decode(head).replace(/^\uFEFF/, "").trimStart();
	if (text.startsWith("<?xml") || text.startsWith("<svg") || text.startsWith("<!--")) {
		return "svg";
	}
	return undefined;
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
	return signature.every((byte, i) => bytes[i] === byte);
}

/* ------------------------------------------------------------------ *
 * SVG
 * ------------------------------------------------------------------ */

async function readSvg(
	file: File,
): Promise<{ svg: string; width: number; height: number } | null> {
	return sanitizeUserSvg(await file.text());
}

/**
 * Whether a drawing is a single flat colour, and so a candidate for being
 * painted in the callout's colour like every library icon.
 *
 * Counts the distinct concrete colours the file names anywhere — attributes,
 * inline styles and any surviving stylesheet. Keywords that are not a colour
 * (`none`, `transparent`, `currentColor`) are ignored, and a shape with no fill
 * at all is black by default, which is still one colour. A `url(#…)` paint means
 * a gradient or pattern, which is by definition not flat.
 */
function isMonochrome(svg: string): boolean {
	const colors = new Set<string>();
	for (const match of svg.matchAll(PAINT_RE)) {
		const value = match[1]?.toLowerCase();
		if (!value) continue;
		if (value === "none" || value === "transparent" || value === "currentcolor") {
			continue;
		}
		// A gradient or pattern reference is more than one colour by construction.
		if (value.startsWith("url(")) return false;
		colors.add(value);
	}
	return colors.size <= 1;
}

/**
 * A paint declaration and the colour it names, in an attribute (`fill="#f00"`)
 * or in CSS (`fill:#f00`).
 *
 * The value alternatives are spelled out rather than "everything up to the next
 * delimiter", because CSS has no delimiter a loose pattern can rely on: run two
 * rules together as `.a{fill:#f00}.b{fill:#0f0}` and a permissive class happily
 * swallows both as one value, making a two-colour drawing look flat.
 *
 * `fill-opacity` and `stroke-width` do not match, because the keyword has to be
 * followed by the separator and they are followed by a hyphen.
 */
const PAINT_RE =
	/(?:fill|stroke|stop-color|color)\s*[:=]\s*["']?\s*(#[0-9a-f]{3,8}|[a-z-]+\([^)]*\)|[a-z]+)/gi;

/* ------------------------------------------------------------------ *
 * Raster
 * ------------------------------------------------------------------ */

async function readRaster(
	file: File,
	format: UserImageIcon["format"],
): Promise<{ svg: string; width: number; height: number } | null> {
	const source = await decodeImage(file);
	const { width, height } = fitWithin(
		source.naturalWidth,
		source.naturalHeight,
		MAX_RENDITION_PX,
	);

	const canvas = createEl("canvas");
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext("2d");
	if (!context) return null;
	context.drawImage(source, 0, 0, width, height);

	const dataUri = encodeCanvas(canvas, context, format, width, height);

	// Straight into the same door a hand-written file goes through: it validates
	// the wrapper, normalizes the viewBox and enforces the size ceiling, so a
	// picture too big to store is caught in exactly one place.
	return sanitizeUserSvg(
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">` +
			`<image href="${dataUri}" width="${width}" height="${height}"/>` +
			`</svg>`,
	);
}

/**
 * Pick the encoding that stores this picture smallest without losing anything
 * that matters: PNG keeps transparency, which logos need; JPEG is dramatically
 * smaller for photographs, which have no transparency to keep.
 */
function encodeCanvas(
	canvas: HTMLCanvasElement,
	context: CanvasRenderingContext2D,
	format: UserImageIcon["format"],
	width: number,
	height: number,
): string {
	if (format === "jpeg") return canvas.toDataURL("image/jpeg", JPEG_QUALITY);

	const png = canvas.toDataURL("image/png");
	if (png.length <= PNG_SIZE_THRESHOLD) return png;
	if (hasTransparency(context, width, height)) return png;
	return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

function hasTransparency(
	context: CanvasRenderingContext2D,
	width: number,
	height: number,
): boolean {
	// At most 128×128, so a full scan is trivial — and sampling could easily
	// miss the one transparent corner that made the picture worth keeping.
	const { data } = context.getImageData(0, 0, width, height);
	for (let i = 3; i < data.length; i += 4) {
		if (data[i] !== 255) return true;
	}
	return false;
}

/** Load a file into an `<img>`, resolving once the browser has decoded it. */
function decodeImage(file: File): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(file);
		const image = new Image();
		image.onload = () => {
			URL.revokeObjectURL(url);
			resolve(image);
		};
		image.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error(`Could not decode ${file.name}`));
		};
		image.src = url;
	});
}

/** Scale a size down to fit a square of `max`, keeping its proportions. */
function fitWithin(
	width: number,
	height: number,
	max: number,
): { width: number; height: number } {
	const longest = Math.max(width, height);
	if (longest <= 0) return { width: max, height: max };
	if (longest <= max) return { width, height };
	const scale = max / longest;
	return {
		width: Math.max(1, Math.round(width * scale)),
		height: Math.max(1, Math.round(height * scale)),
	};
}
