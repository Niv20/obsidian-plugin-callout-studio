/**
 * A document-change discriminator, not a cryptographic digest. Two independent
 * 32-bit accumulators plus normalized length make accidental matches unlikely.
 * CRLF and LF are equivalent because Obsidian's editor normalizes line endings.
 */
export function* iterateContentFingerprint(content: string): Generator<void, string> {
	let first = 0x811c9dc5;
	let second = 0x9e3779b9;
	let length = 0;
	for (let at = 0; at < content.length; at++) {
		// Bound each next() call, including a huge single line with no callouts.
		if (at > 0 && at % 32768 === 0) yield;
		const character = content.charCodeAt(at);
		if (character === 13 && content.charCodeAt(at + 1) === 10) continue;
		first = Math.imul(first ^ character, 0x01000193);
		second = Math.imul(second + character, 0x5bd1e995);
		second ^= second >>> 13;
		length++;
	}
	return `${length}:${(first >>> 0).toString(16).padStart(8, "0")}:${(second >>> 0).toString(16).padStart(8, "0")}`;
}

/** Synchronous callers and cooperative callers use exactly the same algorithm. */
export function fingerprintCalloutContent(content: string): string {
	const iterator = iterateContentFingerprint(content);
	let step = iterator.next();
	while (!step.done) step = iterator.next();
	return step.value;
}
