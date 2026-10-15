/**
 * settings/editor/idMoves.ts — taking an id from another callout.
 *
 * An id belongs to one callout. Typing one that another callout already has
 * used to end in "This ID conflicts with an existing callout" and nothing to
 * do about it but go and find that callout. Now the editor names it and, when
 * it can, offers **Move here**: on Save the other callout gives the id up and
 * this one takes it. No note changes — `[!test]` simply starts looking like
 * this callout — which is the whole appeal over deleting and rewriting.
 *
 * ## What may move
 *
 * - An extra id of another callout. That callout keeps everything else.
 * - The only id of a discovered row nobody has styled (`source: "fallback"`,
 *   not `customized`): that row is a placeholder a scan made for an id found in
 *   the notes, and taking its id is the point of it. The row goes.
 *
 * What may not: an id Obsidian ships for a built-in (it would come straight
 * back), one the theme draws, and another callout's main id — that callout
 * would be left without one; it can be deleted first, which also leaves its
 * notes alone. The Default fallback callout stays put for the same reason.
 *
 * ## The other callout changes in the same batch
 *
 * The registry cannot hold two callouts with one id, so the source has to give
 * it up before this callout is saved, inside one `registry.batch`. A batch only
 * holds back change events — it undoes nothing — so the caller keeps the
 * snapshots taken here and puts them back if its own save is then refused.
 *
 * ## And the other way: moving an id away
 *
 * Removing an id the notes still use asks what to do with them, and one answer
 * is to move the id to another callout (NoteChangesModal). That is
 * {@link giveIds}: the same batch, after this callout is saved without the
 * id, so the two never hold it at once. No note changes there either.
 */
import { MAX_TAGS_COUNT } from "../../constants";
import type { CalloutRegistry } from "../../manager/CalloutRegistry";
import type { CalloutDefinition } from "../../types";
import { calloutIdentity } from "../../utils/calloutId";
import { builtInDefaultIds } from "./builtInIdReset";
import type { GivenId } from "./noteChangeQuestion";

/** An id this Save takes from another callout. */
export interface IdMove {
	/** As it is written in this callout's id field. */
	id: string;
	/** The callout that has it now. */
	from: string;
	/** `from` is a discovered placeholder whose only id this is: the row goes. */
	removeRow: boolean;
}

/** Who has an id this callout wants, and whether it can move here. */
export type IdOwnership =
	| { kind: "free" }
	| { kind: "movable"; owner: CalloutDefinition; removeRow: boolean }
	/** One of the ids Obsidian ships for a built-in. */
	| { kind: "stock"; owner: CalloutDefinition }
	/** The active theme draws it. */
	| { kind: "theme"; owner: CalloutDefinition }
	/** Another callout's main id. */
	| { kind: "main"; owner: CalloutDefinition };

type OwnershipRegistry = Pick<
	CalloutRegistry,
	"findAttrIdConflict" | "getBuiltInDefault" | "themeOwns" | "settings"
>;

/** Who has `id`, apart from the callout being edited (`existingId`). */
export function idOwnership(
	registry: OwnershipRegistry,
	id: string,
	existingId: string | null,
): IdOwnership {
	const owner = registry.findAttrIdConflict(id, existingId);
	if (!owner) return { kind: "free" };
	if (owner.source === "theme" || registry.themeOwns(owner)) return { kind: "theme", owner };
	const key = calloutIdentity(id);
	if (owner.builtIn) {
		const stock = registry.getBuiltInDefault(owner.id);
		const stockIds = stock ? builtInDefaultIds(stock) : [owner.id];
		return stockIds.some((stockId) => calloutIdentity(stockId) === key)
			? { kind: "stock", owner }
			: { kind: "movable", owner, removeRow: false };
	}
	if (calloutIdentity(owner.id) !== key) return { kind: "movable", owner, removeRow: false };
	const placeholder =
		owner.source === "fallback" &&
		owner.customized !== true &&
		(owner.aliases?.length ?? 0) === 0 &&
		registry.settings.fallbackCalloutId !== owner.id;
	return placeholder ? { kind: "movable", owner, removeRow: true } : { kind: "main", owner };
}

type MoveRegistry = Pick<
	CalloutRegistry,
	"findAttrIdConflict" | "getReal" | "update" | "remove" | "add" | "settings" | "restyleUncustomizedFallbackRows"
>;

/**
 * Take every moved id from the callout that has it, as one step of the
 * caller's `registry.batch`. Returns what puts it all back, or null — having
 * changed nothing — when an id has found a different owner since the user
 * chose to move it.
 */
export function takeMovedIds(
	registry: MoveRegistry,
	moves: readonly IdMove[],
	existingId: string | null,
): (() => void) | null {
	if (moves.length === 0) return () => undefined;
	const sources = new Map<string, CalloutDefinition>();
	for (const move of moves) {
		const owner = registry.findAttrIdConflict(move.id, existingId);
		// Already free: whoever had it gave it up. Nothing to take.
		if (!owner) continue;
		if (owner.id !== move.from) return null;
		if (!sources.has(owner.id)) sources.set(owner.id, structuredClone(owner));
	}
	const fallbackId = registry.settings.fallbackCalloutId;

	for (const [id, before] of sources) {
		const leaving = new Set(
			moves.filter((move) => move.from === id).map((move) => calloutIdentity(move.id)),
		);
		if (moves.some((move) => move.from === id && move.removeRow)) {
			registry.remove(id);
			continue;
		}
		const aliases = (before.aliases ?? []).filter((alias) => !leaving.has(calloutIdentity(alias)));
		registry.update(id, { aliases: aliases.length > 0 ? aliases : undefined });
	}

	return () => {
		for (const [id, before] of sources) {
			if (registry.getReal(id)) registry.update(id, { aliases: before.aliases });
			else registry.add(before);
		}
		if (registry.settings.fallbackCalloutId !== fallbackId) {
			registry.settings.fallbackCalloutId = fallbackId;
			registry.restyleUncustomizedFallbackRows();
		}
	};
}

type GiveRegistry = Pick<CalloutRegistry, "findAttrIdConflict" | "getReal" | "update">;

/**
 * Hand each given id to the callout the user picked, as one step of the
 * caller's `registry.batch` — after the callout giving them up was saved
 * without them. Returns the ones that could not go: the callout picked was
 * deleted or filled up while the question was open, or something else has
 * the id now. Those stay with nobody, which is where Leave would have left
 * them, and the caller says so.
 */
export function giveIds(registry: GiveRegistry, gives: readonly GivenId[]): GivenId[] {
	const failed: GivenId[] = [];
	for (const gift of gives) {
		const to = registry.getReal(gift.to);
		const aliases = to?.aliases ?? [];
		if (!to || 1 + aliases.length >= MAX_TAGS_COUNT || registry.findAttrIdConflict(gift.id, null)) {
			failed.push(gift);
			continue;
		}
		registry.update(to.id, { aliases: [...aliases, gift.id] });
	}
	return failed;
}
