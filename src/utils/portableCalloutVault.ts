/** A byte-exact, single-use approval plan for the irreversible Markdown export. */
import { MarkdownView, type App, type TFile } from "obsidian";
import { portableCalloutApprovals } from "./portableCalloutApproval";
import { copyPortableReplacements, portableReplacementText, type PortableReplacements } from "./portableCalloutCustom";
import { convertPortableCallouts, type PortableCalloutLineChange } from "./portableCallouts";
import {
	buildPortableCalloutPlan, emptyPortableCounts, remainingPortableCalloutPlan,
	type PortableCalloutConversionPlan, type PortableCalloutCounts,
	type PortableCalloutSnapshot as Snapshot, type PortableCalloutOutput,
} from "./portableCalloutPlan";
import { cachePortableSnapshots, cachedPortableSnapshot, portableHeadingPreviewCache, type PortableCalloutPreviewCache } from "./portableCalloutPreviewCache";
export { retainPortableCalloutReplacements } from "./portableCalloutRetention";
export { PortableCalloutPreviewCache } from "./portableCalloutPreviewCache";
export type { PortableCalloutConversionPlan, PortableCalloutConversionExample,
	PortableCalloutConversionChange, PortableCalloutLinkChange, PortableCalloutBlockedChange } from "./portableCalloutPlan";

export type PortableCalloutErrorCode = "busy" | "aborted" | "changed" | "editor-changed" |
	"read-failed" | "write-failed" | "unavailable" | "invalid-plan";

export class PortableCalloutVaultError extends Error {
	constructor(readonly code: PortableCalloutErrorCode, readonly path?: string) {
		super(`Portable callout conversion: ${code}${path ? ` (${path})` : ""}`);
		this.name = "PortableCalloutVaultError";
	}
}

export interface PortableCalloutConversionResult extends PortableCalloutCounts {
	status: "complete" | "stopped";
	error?: { code: PortableCalloutErrorCode; path?: string };
	remainingPlan?: PortableCalloutConversionPlan;
}
const pendingRecoveries = new WeakMap<App, PortableCalloutConversionPlan>();
const running = new WeakSet<App>();

function assertAvailable(app: App): void {
	if (typeof app.vault.process !== "function" ||
		typeof app.workspace?.getLeavesOfType !== "function") {
		throw new PortableCalloutVaultError("unavailable");
	}
}

function assertIdentity(app: App, entry: Pick<Snapshot, "file" | "path" | "mtime" | "size">, metadata = true): void {
	if (entry.file.path !== entry.path || app.vault.getAbstractFileByPath(entry.path) !== entry.file ||
		(metadata && (entry.file.stat.mtime !== entry.mtime || entry.file.stat.size !== entry.size))) {
		throw new PortableCalloutVaultError("changed", entry.path);
	}
}

function assertSnapshot(app: App, entries: Snapshot[], metadata = true): void {
	const current = app.vault.getMarkdownFiles();
	if (current.length !== entries.length) throw new PortableCalloutVaultError("changed");
	const identities = new Set(current);
	for (const entry of entries) {
		assertIdentity(app, entry, metadata);
		if (!identities.has(entry.file)) throw new PortableCalloutVaultError("changed", entry.path);
	}
}

/** Every duplicate tab must agree; none may silently save stale text over a conversion. */
function assertEditors(app: App, file: TFile, source: string): void {
	const expected = source.replace(/\r\n/g, "\n");
	for (const leaf of app.workspace.getLeavesOfType("markdown")) {
		const view = leaf.view;
		if (!(view instanceof MarkdownView) || view.file !== file || !view.editor) continue;
		if (view.editor.getValue().replace(/\r\n/g, "\n") !== expected) {
			throw new PortableCalloutVaultError("editor-changed", file.path);
		}
	}
}

async function read(app: App, file: TFile): Promise<string> {
	try { return await app.vault.read(file); }
	catch { throw new PortableCalloutVaultError("read-failed", file.path); }
}

function addCounts(counts: PortableCalloutCounts, output: PortableCalloutOutput): void {
	counts.files++;
	counts.count += output.count;
	counts.headings += output.headings;
	counts.inline += output.inline;
	counts.linkCount += output.linkCount;
}

async function yieldScan(index: number): Promise<void> {
	if (index % 25 === 0) await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
}

/** Reads saved Markdown only. Any missing/dirty/unreadable input rejects the entire preview. */
export async function preparePortableCalloutConversion(
	app: App,
	options: { signal?: AbortSignal; onProgress?: (done: number, total: number) => void; cache?: PortableCalloutPreviewCache } = {},
): Promise<PortableCalloutConversionPlan> {
	if (running.has(app)) throw new PortableCalloutVaultError("busy");
	if (options.signal?.aborted) throw new PortableCalloutVaultError("aborted");
	const pending = pendingRecoveries.get(app);
	if (pending) return pending;
	running.add(app);
	const checkCancelled = (): void => {
		if (options.signal?.aborted) throw new PortableCalloutVaultError("aborted");
	};
	try {
		assertAvailable(app);
		checkCancelled();
		const entries: Snapshot[] = [];
		const files = app.vault.getMarkdownFiles().map((file) => ({
			file, path: file.path, mtime: file.stat.mtime, size: file.stat.size,
		}));
		for (const file of files) {
			checkCancelled();
			assertIdentity(app, file);
			const cached = cachedPortableSnapshot(options.cache, app, file.file);
			const original = cached?.original ?? await read(app, file.file);
			assertIdentity(app, file);
			assertEditors(app, file.file, original);
			const changes: PortableCalloutLineChange[] = cached?.changes ?? [];
			const conversion = cached?.conversion ?? convertPortableCallouts(original, change => changes.push(change));
			const entry = { ...file, original, conversion, changes };
			entries.push(entry);
			options.onProgress?.(entries.length, files.length);
			await yieldScan(entries.length);
		}
		checkCancelled();
		assertSnapshot(app, entries);
		for (const entry of entries) assertEditors(app, entry.file, entry.original);
		const headings = portableHeadingPreviewCache(options.cache, app);
		const { plan, outputs } = buildPortableCalloutPlan(app, entries, undefined, [], headings);
		portableCalloutApprovals.set(plan, { app, entries, outputs, headings, replacements: new Map() });
		cachePortableSnapshots(options.cache, app, entries);
		return plan;
	} finally { running.delete(app); }
}

/** Review selection without rereading notes; final approval still verifies every byte. */
export function reviewPortableCalloutSelection(
	app: App, plan: PortableCalloutConversionPlan, selectedIds: ReadonlySet<string>,
	replacements?: PortableReplacements,
): PortableCalloutConversionPlan {
	if (running.has(app)) throw new PortableCalloutVaultError("busy");
	const approval = portableCalloutApprovals.get(plan);
	if (!approval || approval.app !== app) throw new PortableCalloutVaultError("invalid-plan");
	if (plan.recovery) {
		if (replacements && (replacements.size !== approval.replacements.size || [...replacements].some(([id, text]) => (!approval.replacements.has(id) || portableReplacementText(approval.replacements.get(id)!) !== portableReplacementText(text))))) throw new PortableCalloutVaultError("invalid-plan");
		if (selectedIds.size !== plan.selectedIds.length || plan.selectedIds.some(id => !selectedIds.has(id))) {
			throw new PortableCalloutVaultError("invalid-plan");
		}
		return plan;
	}
	const custom = copyPortableReplacements(replacements ?? approval.replacements);
	const ids = new Set(plan.changes.map(change => change.id));
	if ([...custom.keys()].some(id => !ids.has(id))) throw new PortableCalloutVaultError("invalid-plan");
	const result = buildPortableCalloutPlan(app, approval.entries, selectedIds, plan.blockedChanges, approval.headings, custom);
	portableCalloutApprovals.set(result.plan, { ...approval, outputs: result.outputs, replacements: custom });
	return result.plan;
}


/**
 * Validate the entire preview before the first write, then compare bytes again
 * inside each atomic process callback. A failure consumes the plan and stops;
 * successful earlier files remain converted and are counted, never rolled back.
 */
export async function applyPortableCalloutConversion(
	app: App,
	plan: PortableCalloutConversionPlan,
): Promise<PortableCalloutConversionResult> {
	const result: PortableCalloutConversionResult = { ...emptyPortableCounts(), status: "stopped" };
	if (running.has(app)) return { ...result, error: { code: "busy" } };
	const approval = portableCalloutApprovals.get(plan);
	if (!approval || approval.app !== app) return { ...result, error: { code: "invalid-plan" } };
	if (pendingRecoveries.has(app) && pendingRecoveries.get(app) !== plan) return { ...result, error: { code: "invalid-plan" } };
	portableCalloutApprovals.delete(plan);
	pendingRecoveries.delete(app);
	// Related selection plans must keep their own immutable expected snapshots.
	const operation = { ...approval, entries: approval.entries.map(entry => ({ ...entry })) };
	running.add(app);
	let currentPath: string | undefined;
	let writeAttempted = false;
	try {
		assertAvailable(app);
		const { entries, outputs } = operation;
		assertSnapshot(app, entries, !plan.recovery);
		let checked = 0;
		for (const entry of entries) {
			currentPath = entry.path;
			const identity = { ...entry, mtime: entry.file.stat.mtime, size: entry.file.stat.size };
			const current = await read(app, entry.file);
			const output = outputs.get(entry.path)!;
			if (current !== entry.original) {
				// An adapter can reject after persisting bytes. Recognize exactly the
				// approved output on retry, never derive fresh edits from unknown text.
				if (!plan.recovery || current !== output.content) throw new PortableCalloutVaultError("changed", entry.path);
				entry.original = current;
				addCounts(result, output);
			}
			assertIdentity(app, plan.recovery ? identity : entry);
			if (plan.recovery) { entry.mtime = identity.mtime; entry.size = identity.size; }
			assertEditors(app, entry.file, current);
			await yieldScan(++checked);
		}
		assertSnapshot(app, entries);
		for (const entry of entries) assertEditors(app, entry.file, entry.original);
		result.skipped = plan.skipped;
		for (const entry of entries) {
			const output = outputs.get(entry.path)!;
			if (output.content === entry.original) continue;
			currentPath = entry.path;
			assertSnapshot(app, entries);
			assertEditors(app, entry.file, entry.original);
			writeAttempted = true;
			await app.vault.process(entry.file, (current) => {
				assertSnapshot(app, entries);
				assertEditors(app, entry.file, entry.original);
				if (current !== entry.original) throw new PortableCalloutVaultError("changed", entry.path);
				return output.content;
			});
			addCounts(result, output);
			// Subsequent snapshot guards accept exactly this operation's writes.
			entry.mtime = entry.file.stat.mtime;
			entry.size = entry.file.stat.size;
			entry.original = output.content;
			// Do not repair links to a heading another writer changed immediately
			// after process completed. Keep the exact approved remainder for retry.
			const committed = await read(app, entry.file);
			if (committed !== output.content) throw new PortableCalloutVaultError("changed", entry.path);
			assertIdentity(app, entry);
			await yieldScan(result.files);
		}
		assertSnapshot(app, entries);
		result.status = "complete";
		pendingRecoveries.delete(app);
	} catch (error) {
		result.error = error instanceof PortableCalloutVaultError
			? { code: error.code, path: error.path }
			: { code: "write-failed", path: currentPath };
		let preservePending = result.files > 0 || plan.recovery;
		if (!preservePending && writeAttempted) {
			const attempted = operation.entries.find(entry => entry.path === currentPath)!;
			try {
				const current = await read(app, attempted.file);
				preservePending = current !== attempted.original && current === operation.outputs.get(attempted.path)!.content;
			} catch { preservePending = true; }
		}
		if (preservePending) {
			const remaining = remainingPortableCalloutPlan(plan, operation.entries, operation.outputs);
			if (remaining) {
				portableCalloutApprovals.set(remaining, operation);
				pendingRecoveries.set(app, remaining);
				result.remainingPlan = remaining;
			}
		}
	} finally { running.delete(app); }
	return result;
}
