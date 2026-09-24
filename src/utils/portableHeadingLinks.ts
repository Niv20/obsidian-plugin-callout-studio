import { stripHeadingForLink, type App } from "obsidian";
import { isMarkdownEscaped } from "../editor/markdownExclusions";
import { portableHeadingChain, portableHeadingKey, type PortableHeading } from "./portableHeadingLinksHeadings";
import { PortableHeadingLinkCache } from "./portableHeadingLinksCache";
export { PortableHeadingLinkCache } from "./portableHeadingLinksCache";

export interface PortableHeadingLinkEdit {
	path: string;
	/** Ranges refer to the proposed content, after selected callout conversions. */
	from: number;
	to: number;
	text: string;
	line: number;
	before: string;
	after: string;
	targetPath: string;
	targetLine: number;
}
export interface PortableHeadingLinkIssue {
	path: string;
	line: number;
	targetPath: string;
	targetLine: number;
	reason: "ambiguous-target" | "unrepresentable-target";
}
export interface PortableHeadingLinkPlan {
	edits: PortableHeadingLinkEdit[];
	issues: PortableHeadingLinkIssue[];
}
interface Note { path: string; content: string }
interface Change { path: string; before: PortableHeading; after: PortableHeading; lines: number[] }

function missingHeadings(originals: readonly Note[], proposed: ReadonlyMap<string, string>, cache: PortableHeadingLinkCache): PortableHeadingLinkIssue[] {
	const issues: PortableHeadingLinkIssue[] = [];
	for (const note of originals) {
		const after = proposed.get(note.path) ?? note.content;
		if (after === note.content) continue;
		const targets = new Set(cache.headings(note.path, after).map(heading => heading.line));
		const originalLines = note.content.split("\n"), newLines = after.split("\n");
		for (const heading of cache.headings(note.path, note.content)) {
			if (targets.has(heading.line)) continue;
			for (let line = heading.line; line <= heading.endLine; line++) if (originalLines[line - 1] !== newLines[line - 1]) {
				issues.push({ path: note.path, line, targetPath: note.path, targetLine: line, reason: "unrepresentable-target" });
			}
		}
	}
	return issues;
}

function changes(originals: readonly Note[], proposed: ReadonlyMap<string, string>, cache: PortableHeadingLinkCache): Change[] {
	const result: Change[] = [];
	for (const note of originals) {
		const after = proposed.get(note.path) ?? note.content;
		if (after === note.content) continue;
		const originalLines = note.content.split("\n"), newLines = after.split("\n");
		const targets = new Map(cache.headings(note.path, after).map(heading => [heading.line, heading]));
		for (const before of cache.headings(note.path, note.content)) {
			const next = targets.get(before.line);
			if (!next || before.title === next.title) continue;
			const lines: number[] = [];
			for (let line = before.line; line <= before.endLine; line++) if (originalLines[line - 1] !== newLines[line - 1]) lines.push(line);
			result.push({ path: note.path, before, after: next, lines });
		}
	}
	return result;
}

function decode(text: string, wiki: boolean): string | null {
	if (wiki) return text.replace(/\u00A0/g, " ").normalize("NFC");
	try { return decodeURI(text.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~])/g, "$1")).normalize("NFC"); }
	catch { return null; }
}

function linkTitle(heading: PortableHeading): string {
	const title = stripHeadingForLink(heading.title);
	// A source entity must not be decoded by Markdown's destination parser into
	// a different native anchor. The normalized spelling identifies the same heading.
	return /&(?:#\d+|#x[\da-f]+|[a-z][a-z\d]+);/i.test(title) ? stripHeadingForLink(heading.key) : title;
}

function issueFor(change: Change, reason: PortableHeadingLinkIssue["reason"], path = change.path, line = change.before.line): PortableHeadingLinkIssue[] {
	return change.lines.map(targetLine => ({ path, line, targetPath: change.path, targetLine, reason }));
}

function apply(content: string, edits: readonly PortableHeadingLinkEdit[]): string {
	let output = content;
	for (const edit of [...edits].sort((a, b) => b.from - a.from)) output = output.slice(0, edit.from) + edit.text + output.slice(edit.to);
	return output;
}

/** One pass always scans the immutable selected proposal; transitive repairs are recalculated. */
function planPass(app: App, originals: readonly Note[], base: ReadonlyMap<string, string>, current: ReadonlyMap<string, string>, cache: PortableHeadingLinkCache): PortableHeadingLinkPlan {
	const changed = changes(originals, current, cache);
	const result: PortableHeadingLinkPlan = { edits: [], issues: missingHeadings(originals, current, cache) };
	if (!changed.length) return result;
	const oldHeadings = new Map(originals.map(note => [note.path, cache.headings(note.path, note.content)]));
	const newHeadings = new Map(originals.map(note => [note.path, cache.headings(note.path, current.get(note.path) ?? note.content)]));
	const byTarget = new Map(changed.map(change => [`${change.path}\0${change.before.line}`, change]));
	const counts = (headings: Map<string, PortableHeading[]>): Map<string, number> => {
		const keys = new Map<string, number>();
		for (const [path, entries] of headings) for (const heading of entries) {
			const key = `${path}\0${heading.key}`;
			keys.set(key, (keys.get(key) ?? 0) + 1);
		}
		return keys;
	};
	const oldCounts = counts(oldHeadings), newCounts = counts(newHeadings);
	for (const change of changed) {
		const oldMatches = oldCounts.get(`${change.path}\0${change.before.key}`) ?? 0;
		const newMatches = newCounts.get(`${change.path}\0${change.after.key}`) ?? 0;
		if (change.before.key !== change.after.key && (oldMatches > 1 || newMatches > 1)) result.issues.push(...issueFor(change, "ambiguous-target"));
		const target = linkTitle(change.after);
		if (!target || portableHeadingKey(target) !== change.after.key) result.issues.push(...issueFor(change, "unrepresentable-target"));
	}
	for (const note of originals) {
		const source = base.get(note.path) ?? note.content;
		for (const destination of cache.destinations(note.path, source)) {
			const raw = source.slice(destination.from, destination.to);
			const hash = raw.indexOf("#");
			if (hash < 0) continue;
			const pathEnd = hash - (!destination.wiki && isMarkdownEscaped(raw, hash) ? 1 : 0);
			const linkpath = decode(raw.slice(0, pathEnd), destination.wiki);
			const fragment = decode(raw.slice(hash + 1), destination.wiki);
			if (linkpath === null || fragment === null || !fragment || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(linkpath) || /^[\^]|^\[\^/.test(fragment)) continue;
			const path = linkpath ? app.metadataCache?.getFirstLinkpathDest?.(linkpath, note.path)?.path : note.path;
			if (!path) continue;
			const headings = oldHeadings.get(path);
			const parts = fragment.split("#").filter(Boolean);
			if (!headings || !parts.length) continue;
			const chain = portableHeadingChain(headings, parts);
			if (!chain) continue;
			const affected = chain.map(heading => byTarget.get(`${path}\0${heading.line}`));
			const first = affected.find((change): change is Change => Boolean(change));
			if (!first) continue;
			const replacement = parts.map((part, index) => affected[index] ? linkTitle(affected[index].after) : part);
			const targetChain = portableHeadingChain(newHeadings.get(path)!, replacement);
			const line = source.slice(0, destination.from).split("\n").length;
			if (!targetChain || targetChain.some((heading, index) => heading.line !== chain[index]!.line)) {
				for (const change of affected) if (change) result.issues.push(...issueFor(change, "ambiguous-target", note.path, line));
				continue;
			}
			const encoded = replacement.map(part => destination.wiki ? part : encodeURI(part).replace(/[()]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)).join("#");
			const text = raw.slice(0, hash + 1) + encoded;
			if (text !== raw) result.edits.push({ path: note.path, from: destination.from, to: destination.to, text, line,
				before: raw, after: text, targetPath: path, targetLine: first.lines[0] ?? first.before.line });
		}
	}
	return result;
}

/**
 * Repair selected heading changes across all saved Markdown notes. File resolution
 * delegates to Obsidian, heading matching uses its public normalization helpers.
 * No I/O occurs here. Link-only notes remain part of the caller's atomic approval.
 */
export function planPortableHeadingLinks(
	app: App, originals: readonly Note[], proposed: ReadonlyMap<string, string>, cache = new PortableHeadingLinkCache(),
): PortableHeadingLinkPlan {
	cache.retainPaths(new Set(originals.map(note => note.path)));
	const missing = missingHeadings(originals, proposed, cache);
	if (missing.length) return { edits: [], issues: missing };
	const roots = changes(originals, proposed, cache);
	if (!roots.length) return { edits: [], issues: [] };
	let current = proposed;
	for (let pass = 0; pass < 12; pass++) {
		const plan = planPass(app, originals, proposed, current, cache);
		if (plan.issues.length) {
			const issues = plan.issues.flatMap(issue => roots.some(root => root.path === issue.targetPath && root.lines.includes(issue.targetLine))
				? [issue] : roots.flatMap(root => issueFor(root, issue.reason, issue.path, issue.line)));
			return { edits: plan.edits, issues };
		}
		const byPath = new Map<string, PortableHeadingLinkEdit[]>();
		for (const edit of plan.edits) {
			const edits = byPath.get(edit.path) ?? [];
			edits.push(edit); byPath.set(edit.path, edits);
		}
		const next = new Map(originals.map(note => [note.path, apply(proposed.get(note.path) ?? note.content, byPath.get(note.path) ?? [])]));
		if (originals.every(note => next.get(note.path) === (current.get(note.path) ?? note.content))) return plan;
		current = next;
	}
	// Cyclic links embedded in headings can recursively change each other's anchors.
	return { edits: [], issues: roots.flatMap(root => issueFor(root, "unrepresentable-target")) };
}
