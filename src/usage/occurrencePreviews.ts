import type { DocumentCalloutLine } from "../editor/documentCallouts";
import { calloutIdentity } from "../utils/calloutId";
import type { CalloutOccurrence } from "./occurrenceTypes";

function shorten(text: string, limit: number): string {
	return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

/** Build display excerpts without changing the exact source used for navigation. */
export class OccurrencePreviewCollector {
	readonly found: CalloutOccurrence[] = [];
	private pending: { at: number; quoteDepth: number; listIndent: number; header: string } | null = null;

	constructor(private readonly path: string, private readonly fingerprint: string) {}

	add(line: DocumentCalloutLine): void {
		if (this.pending) {
			const pending = this.pending;
			if (line.prefix.quoteDepth < pending.quoteDepth ||
				line.tokens.some((token) => token.role === "regular")) this.pending = null;
			else if (line.prefix.quoteDepth === pending.quoteDepth && line.prefix.listIndent >= pending.listIndent) {
				// Use the exclusion mask only to choose an actual content line. Display its
				// original Markdown, including quote/list prefixes and inline formatting.
				const visibleBody = line.visible.slice(line.prefix.from).replace(/\0+/g, " ").trim();
				if (visibleBody) {
					const entry = this.found[pending.at]!;
					const body = line.lineText.replace(/\r$/, "");
					this.found[pending.at] = Object.freeze({ ...entry,
						excerpt: `${shorten(pending.header, 90)}\n${shorten(body, 180)}` });
					this.pending = null;
				}
			}
		}
		for (const token of line.tokens) {
			const identity = calloutIdentity(token.rawId);
			if (!identity) continue;
			// Editors normalize CRLF to LF; UTF-16 token coordinates stay identical.
			const lineText = line.lineText.replace(/\r$/, "");
			const start = Math.max(0, token.from - 60);
			const excerpt = token.role === "regular" ? shorten(lineText, 180)
				: `${start ? "…" : ""}${shorten(lineText.slice(start), 180)}`;
			this.found.push(Object.freeze({
				path: this.path, rawId: token.rawId, identity, role: token.role,
				line: line.lineIndex, from: token.from, to: token.to, lineText,
				contentFingerprint: this.fingerprint, excerpt,
			}));
			if (token.role === "regular") this.pending = {
				at: this.found.length - 1, quoteDepth: line.prefix.quoteDepth,
				listIndent: line.prefix.listIndent, header: lineText,
			};
		}
	}
}
