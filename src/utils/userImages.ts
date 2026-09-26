/**
 * utils/userImages.ts — Validation and bookkeeping for the user's own pictures.
 *
 * `PluginSettings.userImages` is read from `data.json` and from import files,
 * both of which are untrusted, so everything that reaches the pack goes through
 * `sanitizeUserImages` first — the same defensive posture as
 * `sanitizeCustomPalettes` for palettes.
 *
 * The artwork is re-filtered through `sanitizeUserSvg` on every read, not just
 * when it was first added. `data.json` is an ordinary file that syncs between
 * devices and can be hand-edited or arrive in an import, so trusting a check
 * that happened on some other machine would be trusting nothing at all — the
 * same reasoning that makes PackDataStore re-verify its checksums on each load.
 */
import { sanitizeUserSvg, type SanitizedUserSvg } from "../icons/svg";
import type { UserImageIcon } from "../types";
import { MAX_RASTER_PIXELS } from "../icons/rasterSafety";

/** Prefix for a picture's stable id, stored as `CalloutIcon.value`. */
const ID_PREFIX = "img-";

const FORMATS = new Set<UserImageIcon["format"]>([
	"svg",
	"png",
	"jpeg",
	"webp",
]);

/** Long enough for any sane filename; a guard, not a style rule. */
const MAX_NAME_LENGTH = 60;
/** Bound the complete picture collection, not only each individual SVG. */
export const MAX_USER_IMAGE_ELEMENTS = 50_000;

/**
 * Extensions a name may already end in, so the legacy migration below can tell
 * a filename that carries one from a bare name that needs one.
 */
const KNOWN_EXTENSIONS = [".svg", ".png", ".jpg", ".jpeg", ".webp"];

/** What a stored picture's name should end in, if it does not end in anything. */
const EXTENSION_OF: Record<UserImageIcon["format"], string> = {
	svg: ".svg",
	png: ".png",
	jpeg: ".jpg",
	webp: ".webp",
};

/** A fresh id. Short on purpose — it is stored in every callout that uses it. */
export function newUserImageId(): string {
	const bytes = new Uint8Array(4);
	crypto.getRandomValues(bytes);
	const hex = Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
	return `${ID_PREFIX}${hex}`;
}

/**
 * What a picture is filed under: the filename exactly as the operating system
 * shows it, extension and all.
 *
 * Nothing is prettified. A name the user did not choose is a name they have to
 * re-learn to recognize in the grid, and the extension is half of what tells
 * two pictures apart — `logo.svg` and `logo.png` are two pictures, while two
 * `logo.png` are the same one twice.
 */
export function userImageNameFromFilename(filename: string): string {
	const name = filename.trim();
	if (name.length === 0) return "Image";
	if (name.length <= MAX_NAME_LENGTH) return name;
	// Shorten the stem, never the extension: the extension is what the
	// duplicate rule reads, and dropping it would merge two distinct pictures.
	const dot = name.lastIndexOf(".");
	const extension = dot > 0 ? name.slice(dot) : "";
	const stem = dot > 0 ? name.slice(0, dot) : name;
	const room = Math.max(1, MAX_NAME_LENGTH - extension.length);
	return `${stem.slice(0, room).trimEnd()}${extension}`;
}

/**
 * The form two names are compared in.
 *
 * Case-insensitive, because the file systems these names come from (macOS,
 * Windows) are: `Logo.png` and `logo.png` are one file there, so offering them
 * as two pictures here would invent a distinction the user cannot see.
 */
export function normalizeUserImageName(name: string): string {
	return name.trim().toLowerCase();
}

/**
 * The names a collection has already spoken for, ready to test an incoming
 * file against.
 *
 * Uniqueness is enforced here, where a file is added, and nowhere else — an
 * import merges by id and a hand-edited `data.json` can say anything, and
 * dropping a picture on read because its name collides would delete artwork
 * that callouts are pointing at.
 */
export function takenUserImageNames(
	images: readonly UserImageIcon[],
): Set<string> {
	return new Set(images.map((image) => normalizeUserImageName(image.name)));
}

/**
 * A free name close to `name`, marked as taken so the next caller gets another.
 *
 * The picker refuses a duplicate instead of renaming it, deliberately: someone
 * adding a file by hand knows which file they meant, and a silent `logo (2).svg`
 * would only look like the add had failed. An import has no one to ask — it is
 * a batch, it may run twice over the same source, and dropping an entry there
 * would quietly cost a callout its icon. So it renames.
 *
 * The loop is bounded, and `unique` is the way out: it is the picture's own id,
 * so it collides with nothing. That promise only holds because every candidate
 * is built by {@link withSuffix}, which makes room by shortening the *stem*.
 * Appending the suffix and truncating the result afterwards throws the suffix
 * away again whenever the stem is already at the cap — which handed back the
 * very name being avoided, id fallback included.
 */
export function claimUserImageName(
	name: string,
	taken: Set<string>,
	unique: string,
): string {
	const dot = name.lastIndexOf(".");
	const stem = dot > 0 ? name.slice(0, dot) : name;
	const extension = dot > 0 ? name.slice(dot) : "";

	let candidate = name;
	for (let n = 2; n < 100 && taken.has(normalizeUserImageName(candidate)); n++) {
		candidate = withSuffix(stem, String(n), extension);
	}
	if (taken.has(normalizeUserImageName(candidate))) {
		candidate = withSuffix(stem, unique, extension);
	}

	taken.add(normalizeUserImageName(candidate));
	return candidate;
}

/**
 * `stem (suffix).ext`, kept inside the cap by shortening the stem alone.
 *
 * The suffix is the only part that makes the name new and the extension is half
 * of what tells two pictures apart, so neither may be cut — which leaves the
 * stem, down to a single character if that is what it takes. A label the user
 * can still tell apart, however short, beats two rows reading the same.
 *
 * A pathological extension (a last dot near the end of a very long name) can
 * still push the result past the cap, exactly as it can in
 * {@link userImageNameFromFilename}: the cap is a guard, and losing the suffix
 * to honour it is the worse trade.
 */
function withSuffix(stem: string, suffix: string, extension: string): string {
	const tail = ` (${suffix})${extension}`;
	const room = Math.max(1, MAX_NAME_LENGTH - tail.length);
	return `${stem.slice(0, room).trimEnd()}${tail}`;
}

/**
 * Drop anything malformed from a saved or imported picture list.
 *
 * Entries are dropped rather than repaired: a picture with no artwork is not a
 * degraded picture, it is nothing, and leaving it in the list would put an
 * un-drawable cell in the picker.
 */
export function sanitizeUserImages(raw: unknown): UserImageIcon[] {
	if (!Array.isArray(raw)) return [];
	const result: UserImageIcon[] = [];
	const seenIds = new Set<string>();
	let rasterPixels = 0;
	let elements = 0;
	for (const entry of raw) {
		if (!entry || typeof entry !== "object") continue;
		const image = entry as Partial<UserImageIcon>;
		if (typeof image.id !== "string" || image.id.length === 0) continue;
		if (seenIds.has(image.id)) continue;
		if (typeof image.name !== "string" || image.name.length === 0) continue;
		if (typeof image.svg !== "string" || image.svg.length === 0) continue;
		if (!FORMATS.has(image.format as UserImageIcon["format"])) continue;

		// Re-filter rather than trust: this markup may have been written by an
		// older build, edited by hand, or handed over in an import file.
		const artwork = filterArtwork(image.svg);
		if (!artwork || rasterPixels + artwork.rasterPixels > MAX_RASTER_PIXELS ||
			elements + artwork.elementCount > MAX_USER_IMAGE_ELEMENTS) continue;
		rasterPixels += artwork.rasterPixels;
		elements += artwork.elementCount;

		const format = image.format as UserImageIcon["format"];

		seenIds.add(image.id);
		result.push({
			id: image.id,
			// Pictures added before names were filenames were stored stripped of
			// their extension, which would let one of them sit in the grid next
			// to a fresh copy of the very file it came from without the
			// duplicate rule seeing a collision.
			name: withExtension(image.name, format),
			format,
			svg: artwork.svg,
			// From the artwork itself rather than the saved numbers, which are a
			// claim about it that nothing keeps honest.
			width: artwork.width,
			height: artwork.height,
			// Only an SVG can be recoloured — a mask is a stencil, so tinting a
			// photo would flatten it to a silhouette. `recolor` is the field's
			// name in a vault written before the flag moved onto the callout;
			// droppable once this branch has shipped.
			monochrome:
				(image.monochrome ??
					(image as { recolor?: unknown }).recolor) === true &&
				format === "svg",
			rev: Number.isFinite(image.rev) ? Number(image.rev) : 1,
			addedAt: Number.isFinite(image.addedAt) ? Number(image.addedAt) : 0,
		});
	}
	return result;
}

/**
 * Raster allocation cost of a picture already accepted by the image boundary.
 * The fast path keeps vector-only imports independent of browser parsing.
 * Unknown raster markup consumes the whole budget rather than being trusted.
 */
export function userImageRasterPixels(image: Pick<UserImageIcon, "svg">): number {
	if (!/<(?:[A-Za-z_][\w.-]*:)?image(?:[\s/>])/i.test(image.svg)) return 0;
	return filterArtwork(image.svg)?.rasterPixels ?? MAX_RASTER_PIXELS + 1;
}

/** Count tags in already-sanitized markup; escaped text cannot become tags. */
export function userImageElementCount(image: Pick<UserImageIcon, "svg">): number {
	return image.svg.match(/<[A-Za-z_][\w:.-]*(?=[\s/>])/g)?.length ?? 0;
}

/** Check the prospective collection before import mutates pictures or callouts. */
export function userImagesFitResourceBudget(images: readonly UserImageIcon[]): boolean {
	let pixels = 0;
	let elements = 0;
	for (const image of images) {
		pixels += userImageRasterPixels(image);
		elements += userImageElementCount(image);
		if (pixels > MAX_RASTER_PIXELS || elements > MAX_USER_IMAGE_ELEMENTS) return false;
	}
	return true;
}

/**
 * `sanitizeUserSvg`, with a thrown error read the same way as a refusal.
 *
 * This filter runs on every read of `data.json`, from inside
 * `mergeSavedSettings` — the load path, before anything is on screen. So one
 * picture must not be able to throw here: that is not a missing icon, it is the
 * plugin failing to load and every callout in the vault losing its styling at
 * once. The filter also needs `DOMParser`, which Obsidian has and not every
 * realm this module can be evaluated in does (`renderIcon` guards the same way,
 * for the same reason).
 *
 * Dropping is the safe direction, and the only one: "the artwork could not be
 * checked" and "the artwork did not pass" have the same answer, so nothing
 * unfiltered is ever let through here.
 */
function filterArtwork(raw: string): SanitizedUserSvg | null {
	try {
		return sanitizeUserSvg(raw);
	} catch {
		return null;
	}
}

/**
 * A stored name brought up to date with the rule that names are filenames.
 *
 * Only the extension can be restored — the old naming also turned `-` and `_`
 * into spaces, and that is not reversible from what was kept. Re-adding the
 * file gives the exact name back; this at least makes every name in the grid
 * carry its type, and makes the duplicate rule see the collision.
 *
 * Idempotent, which matters because this runs on every read of `data.json`.
 */
function withExtension(name: string, format: UserImageIcon["format"]): string {
	const lower = name.toLowerCase();
	if (KNOWN_EXTENSIONS.some((extension) => lower.endsWith(extension))) {
		return name;
	}
	return `${name}${EXTENSION_OF[format]}`;
}
