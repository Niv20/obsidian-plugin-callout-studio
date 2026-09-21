/**
 * utils/admonitionIcons.ts — Turning an Admonition icon into one of ours.
 *
 * Split out of `admonitionImport.ts` because it is the one genuinely fiddly
 * part of that import, and because the two halves answer different questions:
 * this file asks "what drawing did they mean?", while the planner asks "what
 * should happen to this callout?".
 *
 * The libraries line up better than they have any right to. Admonition offers
 * Obsidian's own icons plus five downloadable packs, and Callout Studio already
 * carries every one of them under the same upstream names — Octicons
 * `accessibility`, RPG Awesome `acid`, Font Awesome `star` are the same strings
 * on both sides. So the mapping below is a rename of the pack id and nothing
 * more; no name translation table is needed, and none should ever be added.
 *
 * What is not a rename is the guessing. Admonition's icon field has three
 * spellings in the wild — an object with a pack, an object without one, and a
 * bare string (its own `docs/import.md` shows `"icon": "globe"`) — and its
 * legacy `"font-awesome"` pack was split into three files upstream. All of
 * those come down to "try these packs in this order and take the first that has
 * a drawing by this name", which is what `iconCandidates` expresses.
 */
import type {
	CalloutIcon,
	FontAwesomeStyle,
	IconPackId,
	UserImageIcon,
} from "../types";
import { faTypeForName } from "../icons/packs/fontAwesome";
import { importImageFile } from "../icons/userImageImport";
import {
	claimUserImageName,
	userImageNameFromFilename,
} from "./userImages";

/** Admonition's icon field, once we have established it is one of its shapes. */
export interface AdmonitionIconRaw {
	/** Its `IconType`. Absent in the bare-string form and in older files. */
	type?: string;
	/** The icon name — or, for `type: "image"`, the picture itself as a data URI. */
	name: string;
}

/**
 * Admonition's pack ids, mapped onto ours. Every one of its packs is a pack we
 * have; the ids just spell them differently.
 *
 * `"font-awesome"` is deliberately absent — it named all three Font Awesome
 * styles at once before upstream split them into separate downloads, so it
 * resolves by probing rather than by lookup (see `iconCandidates`).
 */
const PACK_OF_ADMONITION_TYPE: Readonly<Record<string, IconPackId>> =
	Object.freeze({
		obsidian: "lucide",
		fas: "fa-solid",
		far: "fa-regular",
		fab: "fa-brands",
		octicons: "octicons",
		rpg: "rpg-awesome",
	});

/** The three files upstream's single `"font-awesome"` pack became, in its own lookup order. */
const FONT_AWESOME_PACKS: readonly IconPackId[] = Object.freeze([
	"fa-solid",
	"fa-regular",
	"fa-brands",
]);

/**
 * Where to look when the file does not say which pack a name came from.
 *
 * Obsidian's own icons first, then the downloadable packs, which is the order
 * Admonition's `getIconType()` uses to answer the same question — so a name
 * that is ambiguous (`globe` exists in both Lucide and Font Awesome) resolves
 * to the same drawing the user was looking at before they exported.
 */
const INFERENCE_ORDER: readonly IconPackId[] = Object.freeze([
	"lucide",
	...FONT_AWESOME_PACKS,
	"octicons",
	"rpg-awesome",
]);

/**
 * Read the icon field, whatever shape it is in, or undefined if there is no
 * icon to read. Never throws — this is untrusted JSON.
 */
export function readAdmonitionIcon(raw: unknown): AdmonitionIconRaw | undefined {
	if (typeof raw === "string") {
		const name = raw.trim();
		return name ? { name } : undefined;
	}
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
	const icon = raw as { type?: unknown; name?: unknown };
	const name = typeof icon.name === "string" ? icon.name.trim() : "";
	if (!name) return undefined;
	const type = typeof icon.type === "string" ? icon.type.trim() : undefined;
	return type ? { type, name } : { name };
}

/** Whether this icon is a picture the user uploaded into Admonition. */
export function isAdmonitionImage(icon: AdmonitionIconRaw): boolean {
	return icon.type === "image";
}

/**
 * Every drawing this icon could plausibly be, best first.
 *
 * Empty for a picture, which is not a name in any pack and travels its own way
 * (see `convertAdmonitionImage`). Otherwise always at least one candidate, so a
 * name that exists nowhere still produces a definite "no such icon" for the
 * report rather than silence.
 */
export function iconCandidates(icon: AdmonitionIconRaw): CalloutIcon[] {
	if (isAdmonitionImage(icon)) return [];

	const packs = packsToTry(icon.type);
	return packs.map((type) => ({ type, value: icon.name }));
}

function packsToTry(type: string | undefined): readonly IconPackId[] {
	if (!type) return INFERENCE_ORDER;
	// The legacy id, still accepted by upstream's own importer.
	if (type === "font-awesome") return FONT_AWESOME_PACKS;
	const mapped = PACK_OF_ADMONITION_TYPE[type];
	if (mapped) return [mapped];
	// A pack this build has never heard of — most likely one Admonition added
	// after this was written. Guessing beats refusing: the name is still a name,
	// and if nothing has it the report says so.
	return INFERENCE_ORDER;
}

/** Admonition's three Font Awesome packs, as the style control names them here. */
const FA_STYLE_OF_ADMONITION_TYPE: Readonly<
	Record<string, FontAwesomeStyle | undefined>
> = Object.freeze({
	fas: "solid",
	far: "regular",
	fab: "brands",
});

/**
 * The drawing this icon means, or undefined when no library has one by that name.
 *
 * `exists` comes from `createIconNameCheck`, which answers true for anything it
 * cannot check — so an index that will not decode makes an icon import
 * optimistically rather than making it vanish.
 *
 * The Font Awesome step is the one thing `exists` cannot do. That check is
 * built per icon *type*, but Font Awesome's three types share one merged index,
 * so it answers "Font Awesome has this name" and never "Solid has it". The pack
 * is therefore asked which file actually holds the drawing, passing along
 * whichever style the file named as the preference. Without it `square-github`
 * — Brands only — would be stored as Solid and render as nothing.
 */
export async function resolveIcon(
	raw: AdmonitionIconRaw,
	exists: (icon: CalloutIcon) => boolean,
): Promise<CalloutIcon | undefined> {
	const match = iconCandidates(raw).find((candidate) => exists(candidate));
	if (!match) return undefined;

	if (FONT_AWESOME_PACKS.includes(match.type)) {
		const actual = await faTypeForName(
			match.value,
			FA_STYLE_OF_ADMONITION_TYPE[raw.type ?? ""],
		);
		if (actual) return { type: actual, value: match.value };
	}
	return match;
}

/* ------------------------------------------------------------------ *
 * Uploaded pictures
 * ------------------------------------------------------------------ */

/**
 * Longest data URI worth decoding. Admonition scales its uploads to 24px before
 * storing them, so anything remotely near this ceiling is not one of its icons.
 */
const MAX_DATA_URI_CHARS = 2 * 1024 * 1024;

/** What each media type should be called on disk, for the picture's name. */
const EXTENSION_OF_MIME: Readonly<Record<string, string>> = Object.freeze({
	"image/png": ".png",
	"image/jpeg": ".jpg",
	"image/jpg": ".jpg",
	"image/webp": ".webp",
	"image/svg+xml": ".svg",
	"image/gif": ".gif",
});

/**
 * Turn an Admonition picture icon into one of the user's own pictures.
 *
 * Admonition stores an uploaded icon inline as `canvas.toDataURL("image/png")`
 * — the picture itself, in the settings file, in the `name` field. That is
 * awkward but it does mean the artwork travels with the data, so a picture icon
 * survives the move instead of degrading to a placeholder.
 *
 * The bytes go in through `importImageFile`, the same door a file dropped on
 * the picker uses, which re-encodes rasters through a canvas and filters SVG
 * through the allow-list. Nothing here trusts the data URI's own claim about
 * what it contains: `importImageFile` reads the format from the decoded bytes.
 *
 * One caveat is worth knowing and is stated in the import report: Admonition
 * stores these at 24px, so they arrive soft. Re-adding the original file under
 * **Custom Icons** gives a crisp one.
 *
 * Returns null for anything that is not a decodable picture. Never throws.
 */
export async function convertAdmonitionImage(
	dataUri: string,
	label: string,
	takenNames: Set<string>,
): Promise<UserImageIcon | null> {
	const file = dataUriToFile(dataUri, label);
	if (!file) return null;

	const result = await importImageFile(file);
	if (!result.ok) return null;

	// Claimed after the fact rather than baked into the filename above, because
	// only now is there an id to fall back on when every numbered variant of the
	// name is somehow taken.
	result.image.name = claimUserImageName(
		result.image.name,
		takenNames,
		result.image.id,
	);
	return result.image;
}

/**
 * Decode a `data:` URI into a File, ready for `importImageFile`.
 *
 * Both encodings are accepted: base64 (what Admonition writes) and the
 * percent-encoded form a hand-written file may carry.
 */
function dataUriToFile(dataUri: string, label: string): File | null {
	const uri = dataUri.trim();
	if (uri.length > MAX_DATA_URI_CHARS) return null;

	const match = /^data:(image\/[a-z0-9.+-]+)\s*(;base64)?\s*,([\s\S]*)$/i.exec(
		uri,
	);
	if (!match) return null;
	const [, mime = "", base64, payload = ""] = match;
	if (!payload) return null;

	try {
		const bytes = base64
			? decodeBase64(payload)
			: new TextEncoder().encode(decodeURIComponent(payload));
		if (bytes.length === 0) return null;
		const extension = EXTENSION_OF_MIME[mime.toLowerCase()] ?? ".png";
		const name = userImageNameFromFilename(`${label}${extension}`);
		return new File([bytes], name, { type: mime });
	} catch {
		// Malformed base64, or a percent sequence that is not valid UTF-8.
		return null;
	}
}

function decodeBase64(payload: string): Uint8Array {
	const binary = atob(payload.replace(/\s+/g, ""));
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}
