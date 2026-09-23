import { iterateDocumentCalloutLines, iterateDocumentCalloutSteps } from "../editor/documentCallouts";
import type { CalloutOccurrence } from "./occurrenceTypes";
import { fingerprintCalloutContent, iterateContentFingerprint } from "./contentFingerprint";
import { OccurrencePreviewCollector } from "./occurrencePreviews";

/** Navigation revalidation uses precisely the same source grammar as the index. */
export function scanCalloutOccurrences(path: string, content: string): CalloutOccurrence[] {
	const fingerprint = fingerprintCalloutContent(content);
	const previews = new OccurrencePreviewCollector(path, fingerprint);
	for (const line of iterateDocumentCalloutLines(content)) previews.add(line);
	return previews.found;
}

export const yieldOccurrenceScan = (): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, 0));

/** Yield by lines, including lines without tokens, so ordinary long notes stay responsive. */
export async function scanCalloutOccurrencesAsync(
	path: string,
	content: string,
	isCurrent: () => boolean,
): Promise<CalloutOccurrence[] | null> {
	if (!isCurrent()) return null;
	const hashSteps = iterateContentFingerprint(content);
	let hash = hashSteps.next();
	while (!hash.done) {
		await yieldOccurrenceScan();
		if (!isCurrent()) return null;
		hash = hashSteps.next();
	}
	const fingerprint = hash.value;
	const previews = new OccurrencePreviewCollector(path, fingerprint);
	let budgetStart = Date.now();
	let steps = 0;
	for (const step of iterateDocumentCalloutSteps(content)) {
		if (!isCurrent()) return null;
		if (step) previews.add(step);
		if (++steps >= 256 || (steps >= 32 && Date.now() - budgetStart >= 8)) {
			await yieldOccurrenceScan();
			budgetStart = Date.now();
			steps = 0;
		}
	}
	return isCurrent() ? previews.found : null;
}
