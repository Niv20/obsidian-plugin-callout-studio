import type { App } from "obsidian";
import { navigateToSidebarResult, type SidebarSourceSelected } from "../ui/sidebarNavigation";
import type { CalloutOccurrence } from "./occurrenceTypes";
import { scanCalloutOccurrences, scanCalloutOccurrencesAsync } from "./scanCalloutOccurrences";

/** Revalidate against the whole current document, including its exclusion context. */
export function resolveOccurrencePosition(
	occurrence: CalloutOccurrence,
	content: string,
): CalloutOccurrence | null {
	return resolveParsedOccurrence(occurrence, scanCalloutOccurrences(occurrence.path, content));
}

function resolveParsedOccurrence(
	occurrence: CalloutOccurrence,
	candidates: readonly CalloutOccurrence[],
): CalloutOccurrence | null {
	const bracket = occurrence.lineText.slice(occurrence.from, occurrence.to);
	const matches = candidates.filter((candidate) =>
		candidate.identity === occurrence.identity && candidate.role === occurrence.role &&
		candidate.lineText === occurrence.lineText &&
		candidate.from === occurrence.from && candidate.to === occurrence.to &&
		candidate.lineText.slice(candidate.from, candidate.to) === bracket,
	);
	const unchanged = matches.find((candidate) =>
		candidate.contentFingerprint === occurrence.contentFingerprint &&
		candidate.line === occurrence.line && candidate.from === occurrence.from,
	);
	if (unchanged) return unchanged;
	// A unique original source line can safely move when lines are inserted above.
	// Repeated lines or edited source have no reliable anchor: let the caller refresh.
	return matches.length === 1 ? matches[0]! : null;
}

/** Opens a document leaf, never the results sidebar, and selects the exact token. */
export async function navigateToCalloutOccurrence(
	app: App,
	occurrence: CalloutOccurrence,
	newTab = false,
	isCurrent: () => boolean = () => true,
	onSelected?: SidebarSourceSelected,
): Promise<boolean> {
	return navigateToSidebarResult(app, occurrence.path, async (content, stillOpen) => {
		const candidates = await scanCalloutOccurrencesAsync(occurrence.path, content, stillOpen);
		const current = candidates && resolveParsedOccurrence(occurrence, candidates);
		return current ? {
			from: { line: current.line, ch: current.from },
			to: { line: current.line, ch: current.to },
		} : null;
	}, newTab, isCurrent, onSelected);
}
