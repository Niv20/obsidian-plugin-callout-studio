import type { App, TFile } from "obsidian";
import type { PortableCalloutSnapshot } from "./portableCalloutPlan";
import { PortableHeadingLinkCache } from "./portableHeadingLinks";

interface CachedPreview { app?: App; entries: Map<string, PortableCalloutSnapshot>; headings: PortableHeadingLinkCache }
const caches = new WeakMap<PortableCalloutPreviewCache, CachedPreview>();

/** Short-lived review-session cache. Approval always rereads every note from disk. */
export class PortableCalloutPreviewCache {
	constructor() { caches.set(this, { entries: new Map(), headings: new PortableHeadingLinkCache() }); }
	/** Call for modify/delete/rename events; omit the path to invalidate everything. */
	invalidate(path?: string): void {
		const cache = caches.get(this)!;
		if (path === undefined) { cache.entries.clear(); cache.headings.clear(); }
		else cache.entries.delete(path);
	}
}

/** Exact-content parses are shared by checkbox revisions and automatic rescans. */
export function portableHeadingPreviewCache(cache: PortableCalloutPreviewCache | undefined, app: App): PortableHeadingLinkCache {
	if (!cache) return new PortableHeadingLinkCache();
	const state = caches.get(cache)!;
	if (state.app && state.app !== app) {
		state.entries.clear(); state.headings.clear();
	}
	state.app = app;
	return state.headings;
}

export function cachedPortableSnapshot(
	cache: PortableCalloutPreviewCache | undefined, app: App, file: TFile,
): PortableCalloutSnapshot | undefined {
	if (!cache) return;
	const state = caches.get(cache);
	if (!state || state.app !== app) return;
	const entry = state.entries.get(file.path);
	if (!entry || entry.file !== file || entry.mtime !== file.stat.mtime || entry.size !== file.stat.size) return;
	return { ...entry };
}

export function cachePortableSnapshots(
	cache: PortableCalloutPreviewCache | undefined, app: App, entries: readonly PortableCalloutSnapshot[],
): void {
	if (cache) caches.set(cache, { app, entries: new Map(entries.map(entry => [entry.path, { ...entry }])),
		headings: portableHeadingPreviewCache(cache, app) });
}
