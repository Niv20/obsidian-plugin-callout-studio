/**
 * web/static/webNote.ts — a note that carries a user's callouts to a site
 * built somewhere else: its body, how it is read back, and its properties.
 *
 * Two services get one: Digital Garden (`gardenNote.ts`) and Quartz
 * (`quartzNote.ts`). Each names its own property and says its own words; the
 * shape is this one, so both read and write alike:
 *
 * - **The body** is a heading that asks to be read, three callouts that say
 *   what the note is, then a code block holding the data, base64-encoded, its
 *   fingerprint on the first line. Publishing tools rewrite a note on its way
 *   to a site (links, embeds, comments, block ids, properties), and every one
 *   of them leaves a code block alone; base64 has nothing any of those steps
 *   could match even if one did not. The fingerprint makes a note edited by
 *   hand, or damaged on the way, recognisable as such on both sides instead of
 *   being drawn wrong.
 * - **The property** marks the note in the vault, where Obsidian finds it in
 *   its metadata cache wherever the user moved it. Its value is the note's
 *   format, so a site's plugin can refuse one a later Callout Studio wrote
 *   rather than misread it. The code block's info string is the same word,
 *   which is how a site that never saw the property (a publishing tool may
 *   drop properties it does not know) still recognises the note.
 *
 * Every byte of the body is fixed for a given set of callouts: no timestamp,
 * no language. Two devices with the same callouts write the same note, and a
 * sync never sees a change that is not one.
 *
 * Pure, like everything in `web/static/`: the site plugins are built from
 * this folder, so no Obsidian, no Node, no `require()`.
 */

/** One kind of note: its property, which is also its code block's info string, and its words. */
export interface WebNoteKind {
	/** The property that marks the note in the vault, and the info string of its code block. */
	key: string;
	/** What this version writes as the property's value, and the newest it reads. */
	format: number;
	/** What the note says to whoever opens it, above the data. */
	intro: readonly string[];
}

const FINGERPRINT_PREFIX = "sha256:";
const BASE64_LINE = 76;

/* --- base64, the same in a browser, in Obsidian and in Node ---------------- */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function encodeBase64(bytes: Uint8Array): string {
	let out = "";
	for (let i = 0; i < bytes.length; i += 3) {
		const a = bytes[i] ?? 0;
		const b = bytes[i + 1] ?? 0;
		const c = bytes[i + 2] ?? 0;
		const n = (a << 16) | (b << 8) | c;
		out += ALPHABET.charAt((n >> 18) & 63) + ALPHABET.charAt((n >> 12) & 63);
		out += i + 1 < bytes.length ? ALPHABET.charAt((n >> 6) & 63) : "=";
		out += i + 2 < bytes.length ? ALPHABET.charAt(n & 63) : "=";
	}
	return out;
}

/** `null` for anything that is not well-formed base64. */
function decodeBase64(text: string): Uint8Array | null {
	if (text.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(text)) return null;
	const padding = text.endsWith("==") ? 2 : text.endsWith("=") ? 1 : 0;
	const bytes = new Uint8Array((text.length / 4) * 3 - padding);
	let at = 0;
	for (let i = 0; i < text.length; i += 4) {
		const n =
			(ALPHABET.indexOf(text.charAt(i)) << 18) |
			(ALPHABET.indexOf(text.charAt(i + 1)) << 12) |
			((Math.max(ALPHABET.indexOf(text.charAt(i + 2)), 0) & 63) << 6) |
			(Math.max(ALPHABET.indexOf(text.charAt(i + 3)), 0) & 63);
		if (at < bytes.length) bytes[at++] = (n >> 16) & 255;
		if (at < bytes.length) bytes[at++] = (n >> 8) & 255;
		if (at < bytes.length) bytes[at++] = n & 255;
	}
	return bytes;
}

/* --- The body ------------------------------------------------------------- */

/**
 * The body Callout Studio owns: the words, then the data. `json` is the data
 * as text and `fingerprint` its SHA-256 — computed by the caller, because
 * Obsidian has only an asynchronous digest and a site's build only a Node one.
 */
export function buildNoteBody(kind: WebNoteKind, fingerprint: string, json: string): string {
	const encoded = encodeBase64(new TextEncoder().encode(json));
	const lines: string[] = [];
	for (let i = 0; i < encoded.length; i += BASE64_LINE) lines.push(encoded.slice(i, i + BASE64_LINE));
	return [...kind.intro, "", "```" + kind.key, FINGERPRINT_PREFIX + fingerprint, ...lines, "```", ""].join("\n");
}

/** What a note's code block says: the data as text, and the fingerprint it claims. */
export interface WebNoteData {
	json: string;
	fingerprint: string;
}

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The line that opens a note's code block, as `buildNoteBody` writes it or a formatter rewrote its fence. */
export const noteFenceRe = (key: string): RegExp => new RegExp(`^(\`{3,}|~{3,})[ \\t]*${escapeRegExp(key)}[ \\t]*$`);

/**
 * The data block of a note's body, decoded — or `null` when there is none, or
 * it is not what {@link buildNoteBody} writes. Whether the fingerprint is the
 * data's is the caller's question, for the reason given there.
 */
export function readNoteBody(key: string, body: string): WebNoteData | null {
	const lines = body.split(/\r?\n/);
	const opener = noteFenceRe(key);
	const open = lines.findIndex((line) => opener.test(line));
	if (open < 0) return null;
	const fence = /^(`{3,}|~{3,})/.exec(lines[open] ?? "")?.[1] ?? "```";
	const close = lines.findIndex((line, i) => i > open && line.trim() === fence);
	if (close < 0) return null;
	const [first = "", ...rest] = lines.slice(open + 1, close).map((line) => line.trim());
	if (!first.startsWith(FINGERPRINT_PREFIX)) return null;
	const fingerprint = first.slice(FINGERPRINT_PREFIX.length);
	if (!/^[0-9a-f]{64}$/.test(fingerprint)) return null;
	const bytes = decodeBase64(rest.join(""));
	if (!bytes) return null;
	try {
		return { json: new TextDecoder("utf-8", { fatal: true }).decode(bytes), fingerprint };
	} catch {
		return null;
	}
}

/* --- The properties ------------------------------------------------------- */

/**
 * A note's properties block, with its fences and the line break after them,
 * and the rest. `frontmatter` is `null` when the note has none.
 */
export function splitFrontmatter(text: string): { frontmatter: string | null; body: string } {
	const open = /^---[ \t]*\r?\n/.exec(text);
	if (!open) return { frontmatter: null, body: text };
	const close = /^---[ \t]*(\r?\n|$)/m;
	const rest = text.slice(open[0].length);
	const end = close.exec(rest);
	if (!end) return { frontmatter: null, body: text };
	const cut = open[0].length + end.index + end[0].length;
	const frontmatter = text.slice(0, cut);
	return { frontmatter: frontmatter.endsWith("\n") ? frontmatter : `${frontmatter}\n`, body: text.slice(cut) };
}

/** A property's value as a format number; one we cannot read counts as `fallback`. */
const formatOf = (value: unknown, fallback: number): number => {
	const text = typeof value === "string" ? value.trim().replace(/^["']|["']$/g, "") : value;
	const n = typeof text === "number" ? text : typeof text === "string" && /^\d+$/.test(text) ? Number(text) : NaN;
	return Number.isInteger(n) && n > 0 ? n : fallback;
};

/**
 * The note's format, read off its properties block — `null` when the block
 * does not carry `kind`'s property, which means the note is not that kind's.
 *
 * Two spellings reach here. In the vault the block is YAML, as Obsidian and
 * the user write it. In a garden's repository it is the Digital Garden
 * plugin's JSON on one line, with the user's own properties nested under
 * `dg-note-properties` (or at the top, when the garden passes them through).
 */
export function noteFormat(kind: Pick<WebNoteKind, "key" | "format">, frontmatter: string | null): number | null {
	if (frontmatter === null) return null;
	const { key, format } = kind;
	const inner = frontmatter
		.replace(/^---[ \t]*\r?\n/, "")
		.replace(/\r?\n?---[ \t]*\r?\n?$/, "")
		.trim();
	if (inner.startsWith("{")) {
		try {
			const value = JSON.parse(inner) as Record<string, unknown>;
			const nested = value["dg-note-properties"];
			const own = nested && typeof nested === "object" ? (nested as Record<string, unknown>)[key] : undefined;
			const found = own !== undefined ? own : value[key];
			return found === undefined ? null : formatOf(found, format);
		} catch {
			// Not JSON after all: read it as YAML below.
		}
	}
	const line = new RegExp(`^["']?${escapeRegExp(key)}["']?[ \\t]*:[ \\t]*(.*?)[ \\t]*$`, "m").exec(inner);
	return line ? formatOf(line[1] ?? "", format) : null;
}
