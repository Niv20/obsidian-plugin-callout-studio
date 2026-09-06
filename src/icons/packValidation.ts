import type { IconPackId } from "../types";
import { PACK_FORMAT, type PackManifestEntry } from "./data/packManifest";
import { parsePackFile, type PackFile } from "./packData";

export async function verifyPackText(
	text: string,
	expected: PackManifestEntry,
	source: string,
	active: () => boolean,
): Promise<boolean> {
	if (!active()) return false;
	const bytes = new TextEncoder().encode(text);
	if (bytes.byteLength !== expected.bytes) {
		console.warn(
			`[CalloutStudio] pack size mismatch from ${source}: ` +
				`${bytes.byteLength} != ${expected.bytes}`,
		);
		return false;
	}
	const digest = await crypto.subtle.digest("SHA-256", bytes);
	if (!active()) return false;
	const hex = Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
	if (hex !== expected.sha256) {
		console.warn(`[CalloutStudio] pack checksum mismatch from ${source}`);
		return false;
	}
	return true;
}


/** Parse validated text without publishing to the shared artwork store. */
export function parseVerifiedPack(id: IconPackId, text: string, source: string): PackFile | null {
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		console.warn(`[CalloutStudio] pack "${id}" from ${source} is not JSON`);
		return null;
	}
	const result = parsePackFile(raw, id, PACK_FORMAT);
	if (!result.ok) {
		console.warn(
			`[CalloutStudio] pack "${id}" from ${source} rejected: ${result.reason}`,
		);
		return null;
	}
	return result.file;
}
