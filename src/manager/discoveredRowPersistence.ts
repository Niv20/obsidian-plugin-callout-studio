/**
 * manager/discoveredRowPersistence.ts — which rows `data.json` is allowed to hold.
 *
 * The file is the user's **configuration**, and until issue #41 it also held an
 * observation: every id automatic discovery had ever seen written in a note,
 * stored as a complete, fallback-styled callout record indistinguishable from
 * one the user made by hand. A second device that merely *opened* a synced note
 * therefore edited the settings file — differently on each device — and the sync
 * client was left reconciling two concurrent modifications of one file.
 *
 * So a row discovery minted and nobody has claimed is **ephemeral**: it lives in
 * the registry for as long as the session does, its ids are remembered by
 * `DeviceLocalStore` so a restart can rebuild it without re-reading the vault,
 * and its appearance is resolved from the current fallback rather than copied.
 * This is the treatment `source: "theme"` rows already get, and
 * `manager/theme/ThemeFacts.ts` already states the principle it follows:
 * ownership is derived, never stored.
 *
 * Three claims make a discovered row real, and each of them is somebody
 * deciding something rather than something being observed:
 *
 * - `customized` — the user opened it in the editor and saved.
 * - `externalStyle` — the user handed its styling to their own CSS. Sticky for
 *   a sharper reason than "they chose it": drop the row and the id falls back
 *   under `generateFallbackCSS`'s `!important` catch-all, so a callout the user
 *   explicitly handed off would silently start being repainted again.
 * - a **custom command** built for it — a deliberate claim carrying a hotkey
 *   binding, and exactly the rule `CalloutDiscovery.pruneUnused` already
 *   applies. Persistence agreeing with the prune is the point: a row the prune
 *   refuses to delete is a row the file has to keep.
 *
 * What is deliberately NOT consulted is `themeOwns` — the other half of
 * `standsDown`. It is derived from the theme active on **this** device, so
 * letting it decide what gets written would put per-device state straight back
 * into the synced file, which is the whole failure being fixed.
 */
import type { CalloutDefinition, CustomCommand } from "../types";
import { calloutIdentity } from "../utils/calloutId";
import { isCalloutModified } from "./calloutCompare";

/**
 * True when `def` is a discovered row nobody has claimed — so the registry
 * should carry it, `DeviceLocalStore` should remember its id, and `data.json`
 * should say nothing about it at all.
 */
export function isEphemeralDiscoveredRow(
	def: CalloutDefinition,
	customCommands: readonly CustomCommand[],
): boolean {
	if (def.source !== "fallback") return false;
	if (def.customized === true) return false;
	if (def.externalStyle === true) return false;
	const identity = calloutIdentity(def.id);
	return !customCommands.some(
		(command) => calloutIdentity(command.calloutId) === identity,
	);
}

/** What {@link selectPersistedRows} needs beyond the rows themselves. */
export interface PersistedRowContext {
	/** @see CalloutRegistry.setPreviewDefinition */
	previewActiveId: string | null;
	previewShadowedDef: CalloutDefinition | null;
	customCommands: readonly CustomCommand[];
	/** The shipped default for `id`, or undefined when there is no built-in. */
	builtInDefault(id: string): CalloutDefinition | undefined;
}

/**
 * The rows `toSaveData()` writes, in map order.
 *
 * Four exclusions, in the order they are asked:
 *
 * 1. The transient settings-preview definition is never persisted. When it
 *    shadows a real callout (an in-progress edit of an existing type) the
 *    original is written instead, so a background save mid-edit can neither
 *    drop the real definition nor leak the draft.
 * 2. A `source: "theme"` row is an overlay re-derived every launch.
 * 3. An unclaimed discovered row — see {@link isEphemeralDiscoveredRow}.
 * 4. A built-in is written only once it differs from its shipped default.
 */
export function selectPersistedRows(
	callouts: ReadonlyMap<string, CalloutDefinition>,
	ctx: PersistedRowContext,
): CalloutDefinition[] {
	const out: CalloutDefinition[] = [];
	for (const [id, entry] of callouts) {
		let def = entry;
		if (id === ctx.previewActiveId) {
			if (!ctx.previewShadowedDef) continue;
			def = ctx.previewShadowedDef;
		}
		if (def.source === "theme") continue;
		if (isEphemeralDiscoveredRow(def, ctx.customCommands)) continue;
		if (def.builtIn) {
			const original = ctx.builtInDefault(id);
			if (original && isCalloutModified(def, original)) out.push(def);
			continue;
		}
		out.push(def);
	}
	return out;
}
