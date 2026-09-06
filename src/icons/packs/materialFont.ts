/**
 * icons/packs/materialFont.ts — The Material Symbols webfont, for the picker grid.
 *
 * Material is the one source whose grid is drawn from a font instead of from
 * artwork. 3,870 icons across 4 styles and 7 weights is over 100,000 distinct
 * drawings, so there is nothing to bundle and nothing to bulk-download; the
 * picker renders each cell as the icon's *name* and lets a ligature in Google's
 * variable font turn it into a glyph. That makes this file the single point of
 * failure for whether the grid shows icons or shows text, which is why it is
 * this careful.
 *
 * Every rule below exists because its absence was a bug:
 *
 * - **A failure is never remembered as a success.** The previous version
 *   resolved its promise from `link.onerror`, so one transient failure was
 *   cached as "loaded" for the rest of the session. Only `ready` is memoized
 *   here; a failure clears its entry so the next call genuinely retries.
 * - **Loading is verified, not assumed.** `doc.fonts.load()` resolves happily
 *   with an empty list when no matching face was ever registered, so success is
 *   confirmed afterwards by finding a loaded face — see `isFamilyLoaded`, and
 *   note that `doc.fonts.check()` cannot be used for this.
 * - **A dead `<link>` is replaced, not reused.** Links left by an older plugin
 *   instance may outlive its memo. This loader also owns and removes its links
 *   and cached FontFaces on unload, and cancels all delayed continuations.
 * - **State is per document.** `activeDocument` is the pop-out's document when
 *   one has focus, and a `FontFace` added to one document is unknown to the
 *   other, so a shared memo could report a font the window in front never got.
 * - **A hung request still ends.** Neither `onload` nor `onerror` fires on a
 *   connection that never answers, which left the picker awaiting forever.
 *
 * Outlined and Filled share one family (filled is that font at `FILL 1`), so
 * they share one entry here — the reason a failure always took both styles out
 * together while Rounded and Sharp, each its own family, carried on working.
 */
import { requestUrl } from "obsidian";
import type { MaterialIconStyle } from "../../types";
import { materialFontStore } from "../materialFontStore";
import { MaterialFontSession } from "./materialFontSession";
import { isFamilyLoaded, loadMaterialFontLink, resolveMaterialWoff2Url } from "./materialFontLink";

export type FontLoadResult = "ready" | "failed";

/**
 * `FontFaceSet` is `setlike` in the spec, but TypeScript's DOM lib models only
 * its query half — `add` and `delete` are missing from `lib.dom.d.ts`. Narrowed
 * here rather than cast through `any`, so the call stays type-checked; a realm
 * that genuinely lacks it throws, and `addFromCache` treats that as a miss.
 */
interface SetlikeFontFaceSet {
	add(font: FontFace): FontFaceSet;
	delete(font: FontFace): boolean;
}

/**
 * How long a failed family waits before the next unforced attempt.
 *
 * `CSSInjector.updateMaterialFontLinks` asks on every inject, and now that a
 * failure no longer sticks, without this a genuinely offline vault would retry
 * on each one. The Try again button passes `force` to skip the wait, because
 * that press *is* the user saying the connection changed.
 */
const FAILURE_COOLDOWN_MS = 60_000;

/** Per-document, keyed by family. Holds pending loads and successful ones. */
let loads = new WeakMap<Document, Map<string, Promise<FontLoadResult>>>();

/** When each family last failed, so the cooldown outlives the cleared memo. */
const failedAt = new Map<string, number>();
let session: MaterialFontSession | null = null;

/** Begin a fresh plugin lifetime. Safe to call again after disable/re-enable. */
export function startMaterialFontLoader(): void {
	stopMaterialFontLoader();
	session = new MaterialFontSession();
}

/** Discard font resources and retries while keeping this enabled loader usable. */
export function resetMaterialFontLoader(): void { startMaterialFontLoader(); }

/** Cancel waiters and remove only resources this loader registered. */
export function stopMaterialFontLoader(): void {
	const previous = session;
	session = null;
	previous?.destroy();
	loads = new WeakMap();
	failedAt.clear();
}

type FontStore = NonNullable<ReturnType<typeof materialFontStore>> & { readonly isDestroyed?: boolean };
function canUseStore(scope: MaterialFontSession, store: FontStore | null): store is FontStore {
	return scope.active && store !== null && !store.isDestroyed && materialFontStore() === store;
}

/** The CSS font-family each style renders under. */
export function materialFontFamily(style: MaterialIconStyle): string {
	switch (style) {
		case "outlined":
			return "Material Symbols Outlined";
		case "rounded":
			return "Material Symbols Rounded";
		case "sharp":
			return "Material Symbols Sharp";
		case "filled":
			// Filled is the same font at FILL 1, not a separate family.
			return "Material Symbols Outlined";
	}
}

/**
 * Whether this style's glyphs can be drawn right now.
 *
 * Cheap and synchronous, so the picker can re-check it after any await without
 * starting work — and it is the only honest answer, since a font can arrive or
 * (in a pop-out) never have arrived without this module being told.
 */
export function isMaterialFontReady(
	style: MaterialIconStyle,
	doc: Document = activeDocument,
): boolean {
	return session?.active === true && isFamilyLoaded(doc, materialFontFamily(style));
}

/**
 * Make a style's glyphs drawable, from disk if it has been cached and from
 * Google otherwise. Never rejects — an unreachable font must not stop the user
 * browsing — but the outcome is returned so the caller can say so on screen.
 */
export function ensureMaterialFontLoaded(
	style: MaterialIconStyle,
	opts?: { force?: boolean; doc?: Document },
): Promise<FontLoadResult> {
	const scope = session;
	if (!scope?.active) return Promise.resolve("failed");
	const family = materialFontFamily(style);
	// A caller with a surface to paint passes the document that surface is in.
	// Defaulting to `activeDocument` alone would put the <link> in whichever
	// window happens to have focus, which for a font added per document means
	// the grid asking for it could be left in the one that never got it.
	const doc = opts?.doc ?? activeDocument;

	// Already drawable in this document: nothing to do, whoever put it there.
	if (isFamilyLoaded(doc, family)) {
		return Promise.resolve<FontLoadResult>("ready");
	}

	const memo = memoFor(doc);
	const pending = memo.get(family);
	if (pending) return pending;

	const last = failedAt.get(family);
	if (
		!opts?.force &&
		last !== undefined &&
		Date.now() - last < FAILURE_COOLDOWN_MS
	) {
		return Promise.resolve<FontLoadResult>("failed");
	}

	const attempt = loadFamily(doc, family, scope).catch((): FontLoadResult => "failed");
	const load = Promise.race([attempt, scope.cancelled]).then((result) => {
		if (!scope.active) return "failed";
		if (result === "ready") {
			failedAt.delete(family);
		} else {
			// Drop the entry, not just the timestamp: keeping a resolved
			// "failed" promise memoized is exactly the bug this file exists to
			// prevent. The cooldown above is what stops the retry storm.
			failedAt.set(family, Date.now());
			memo.delete(family);
		}
		return result;
	});
	memo.set(family, load);
	return load;
}

async function loadFamily(
	doc: Document,
	family: string,
	scope: MaterialFontSession,
): Promise<FontLoadResult> {
	if (await addFromCache(doc, family, scope)) return "ready";
	if (!scope.active || !(await loadMaterialFontLink(doc, family, scope))) return "failed";
	if (!scope.active) return "failed";
	// The grid is already painted; this only buys the next launch its offline
	// start, so it is deliberately not awaited.
	void cacheToDisk(doc, family, scope);
	return "ready";
}

/**
 * Register a previously cached font. Zero network, and the whole reason the
 * reported bug cannot come back once a vault has loaded Material even once.
 */
async function addFromCache(doc: Document, family: string, scope: MaterialFontSession): Promise<boolean> {
	const store = materialFontStore();
	if (!canUseStore(scope, store)) return false;
	try {
		const bytes = await store.read(family);
		if (!bytes || !canUseStore(scope, store)) return false;
		// The weight range spans the variable font's whole axis. Without it the
		// descriptor defaults to 400, and every other weight the toolbar offers
		// would be matched against a face that claims not to cover it.
		const face = new FontFace(family, bytes, {
			weight: "100 700",
			style: "normal",
		});
		await face.load();
		if (!canUseStore(scope, store)) return false;
		(doc.fonts as FontFaceSet & SetlikeFontFaceSet).add(face);
		scope.own(() => (doc.fonts as FontFaceSet & SetlikeFontFaceSet).delete(face));
		return true;
	} catch (e) {
		if (scope.active) console.warn(`[CalloutStudio] cached "${family}" webfont unusable`, e);
		return false;
	}
}

/**
 * Keep the bytes the browser just drew with, so later launches skip the network.
 *
 * Entirely best-effort: every failure here is silent, because the grid the user
 * is looking at has already been painted by the path above. All this can cost
 * is the next launch's head start.
 */
async function cacheToDisk(doc: Document, family: string, scope: MaterialFontSession): Promise<void> {
	const store = materialFontStore();
	if (!canUseStore(scope, store)) return;
	try {
		if (await store.has(family)) return;
		if (!canUseStore(scope, store)) return;
		const url = await resolveMaterialWoff2Url(doc, family, scope);
		if (!url || !canUseStore(scope, store)) return;
		// The font file is a plain static asset — unlike the stylesheet naming
		// it, nothing about the caller changes what comes back — so the actual
		// megabyte goes through the sanctioned API.
		const response = await requestUrl({ url });
		if (canUseStore(scope, store)) await store.write(family, response.arrayBuffer);
	} catch (e) {
		if (scope.active) console.warn(`[CalloutStudio] could not cache the "${family}" webfont`, e);
	}
}

function memoFor(doc: Document): Map<string, Promise<FontLoadResult>> {
	const existing = loads.get(doc);
	if (existing) return existing;
	const created = new Map<string, Promise<FontLoadResult>>();
	loads.set(doc, created);
	return created;
}
