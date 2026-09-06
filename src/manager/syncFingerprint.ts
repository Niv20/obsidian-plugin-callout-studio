/** Detect accidental mixing of a JSON body and another revision's metadata.
 * This is a corruption checksum, not authentication of untrusted writers.
 */
import { canonical, content } from "./syncTree";
export function syncFingerprint(data: unknown, stamps: unknown): string {
	const json = canonical({ body: content(data), stamps });
	let a = 0x811c9dc5, b = 0x9e3779b9;
	for (let i = 0; i < json.length; i++) {
		const code = json.charCodeAt(i);
		a = Math.imul(a ^ code, 0x01000193);
		b = Math.imul(b ^ code, 0x85ebca6b);
		b ^= b >>> 13;
	}
	return `${(a >>> 0).toString(16).padStart(8, "0")}${(b >>> 0).toString(16).padStart(8, "0")}`;
}
