/**
 * manager/foreignFields.ts — carrying a newer build's settings through an
 * older one untouched.
 *
 * `utils/settingsMerge.ts` names every field it understands and drops the rest,
 * deliberately and at depth: that is what makes `settingsValidator`'s "unknown
 * fields are dropped" promise true for an import file, and what stops a field
 * retired three versions ago riding along forever.
 *
 * On a **synced vault** the same rule is a permanent write loop. Two devices
 * routinely run different versions of this plugin — a desktop updates itself,
 * a phone updates a week later — and:
 *
 * 1. the newer device writes `data.json` with a setting the older one has
 *    never heard of;
 * 2. the older device loads it, drops the field, and its next save writes the
 *    file back without it;
 * 3. the newer device loads *that*, puts the field back, and writes;
 * 4. go to 1.
 *
 * Neither device is wrong and neither stops. `SaveGuard` cannot suppress it,
 * because the difference is real — this is the same shape as the `iconSvgCache`
 * ordering bug (`manager/iconSvgCacheOrder.ts`), which was the last thing
 * keeping issue #41's conflict copies coming after the reload loop was closed.
 * It is what a reporter on a Syncthing vault saw as "file-sync tennis" after
 * upgrading one device and not the other, and every future release that adds a
 * settings field would start it again.
 *
 * So a field this build does not recognise is **quarantined**, not dropped: put
 * aside at load and written back out verbatim, in a position `utils/stableJson.ts`
 * then makes irrelevant. This build never reads it, never renders it and never
 * lets it reach `PluginSettings`.
 *
 * Two lists decide what that means, and the second is the load-bearing one:
 *
 * - **Known** is `DEFAULT_SETTINGS`' own keys, read at module load rather than
 *   written out again, so a field added to the settings can never be
 *   quarantined by a build that in fact owns it.
 * - **Retired** is the fields this plugin removed *on purpose*. Without it,
 *   quarantining would resurrect every one of them: `firstRunCompleted` and
 *   `retiredThemeIds` moved to `DeviceLocalStore` precisely because they are
 *   per-device and must not travel, and carrying them back into `data.json`
 *   would undo the whole of v2.12.0.
 *
 * Deliberately **not** applied to imports. An import file is a document this
 * version is being asked to read, not a file two versions share, and dropping
 * what it does not understand is the right answer there.
 */
import { CURRENT_DATA_VERSION, DEFAULT_SETTINGS } from "../constants";
import type { PluginData, PluginSettings } from "../types";

/** Everything `mergeSavedSettings` names. Derived, so the two cannot drift. */
const KNOWN_SETTINGS_KEYS: ReadonlySet<string> = new Set(
	Object.keys(DEFAULT_SETTINGS),
);

/**
 * Settings fields removed on purpose, which must stay removed.
 *
 * A field is here because a *past* version of this plugin wrote it and this one
 * decided it should not exist — as opposed to a field a *future* version writes
 * and this one has simply not learned yet. The two are indistinguishable by
 * shape, which is why the list has to be written down.
 */
const RETIRED_SETTINGS_KEYS: ReadonlySet<string> = new Set([
	// Both moved to DeviceLocalStore in 2.12.0: they are claims about a machine,
	// not about a vault, and syncing them is what told a second device it had
	// already scanned when it never had.
	"firstRunCompleted",
	"retiredThemeIds",
	// The 1.x name for the context menu, folded into `contextMenu` by
	// `mergeSavedSettings`' legacy pass. Carrying it would keep a shape the
	// merge has already read and translated.
	"popup",
]);

/** Top-level `data.json` keys this build writes or knowingly leaves behind. */
const KNOWN_DATA_KEYS: ReadonlySet<string> = new Set([
	"version",
	"callouts",
	"settings",
	"iconSvgCache",
	// Read once on load and never written again — see PluginData. Dropping it
	// is the point, so it must not be quarantined back in.
	"materialSvgCache",
	"materialIconsCache",
]);

/** What a load put aside for the next save to hand back. */
export interface ForeignFields {
	/** Unrecognised top-level keys of `data.json`. */
	data: Record<string, unknown>;
	/** Unrecognised keys of `data.json`'s `settings` object. */
	settings: Record<string, unknown>;
}

export const NO_FOREIGN_FIELDS: ForeignFields = { data: {}, settings: {} };

/** Own enumerable keys of `value`, or none when it is not a plain object. */
function entriesOf(value: unknown): [string, unknown][] {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return [];
	}
	return Object.entries(value as Record<string, unknown>);
}

function unrecognised(
	value: unknown,
	known: ReadonlySet<string>,
	retired: ReadonlySet<string> = new Set(),
): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [key, entry] of entriesOf(value)) {
		if (known.has(key) || retired.has(key)) continue;
		// An explicit `undefined` is not a value another build is keeping — it
		// does not survive `JSON.stringify` either way, and reproducing the key
		// would only make the two files look different.
		if (entry === undefined) continue;
		out[key] = entry;
	}
	return out;
}

/**
 * Set aside whatever in `saved` belongs to a build other than this one.
 *
 * Tolerates arbitrary junk: `data.json` is read before anything has validated
 * it, and a `settings` that is an array or a number simply has no fields to
 * quarantine.
 */
export function collectForeignFields(
	saved: Partial<PluginData> | null,
): ForeignFields {
	if (!saved) return NO_FOREIGN_FIELDS;
	return {
		data: unrecognised(saved, KNOWN_DATA_KEYS),
		settings: unrecognised(
			saved.settings,
			KNOWN_SETTINGS_KEYS,
			RETIRED_SETTINGS_KEYS,
		),
	};
}

/**
 * This build's settings with the quarantined fields alongside them.
 *
 * Ours win on every key they share, which they only can if a field stopped
 * being foreign between the load and the save — an upgrade mid-session cannot
 * happen, but a defensive order costs nothing and the alternative silently
 * prefers stale data.
 */
export function withForeignSettings(
	settings: PluginSettings,
	foreign: ForeignFields,
): PluginSettings {
	return { ...foreign.settings, ...settings };
}

/**
 * Whether `saved` was written by a build newer than this one.
 *
 * The quarantine above handles the ordinary case — a version that added a
 * field — without anybody having to notice. `version` is for the case it
 * cannot: a release that changes what an existing field *means*, or how the
 * rows are shaped. There the older build's reading is wrong rather than merely
 * incomplete, and writing that reading back is how a downgrade destroys a
 * vault. So the session goes read-only instead, and says why.
 *
 * A missing or non-numeric `version` is not newer. Every file this plugin has
 * ever written carries one, and a hand-edited file without one is far more
 * likely to be old than to be from the future.
 */
export function isFromNewerBuild(saved: Partial<PluginData> | null): boolean {
	const version = saved?.version;
	return typeof version === "number" && version > CURRENT_DATA_VERSION;
}
