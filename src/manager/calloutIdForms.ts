/**
 * manager/calloutIdForms.ts — which spellings of a callout id belong to which
 * definition.
 *
 * Obsidian writes only the dasherized form into `data-callout`, so `> [!a b]`
 * and `> [!a-b]` render as the same callout — while the registry keys rows by
 * the id the user typed. Every question that crosses that gap lives here: which
 * definition a given attribute form belongs to, and which raw forms a
 * definition may claim in the vault.
 *
 * Split out of `CalloutRegistry` because it is one concern with two entry
 * points, needs nothing from the registry but a way to walk its definitions,
 * and is the kind of arithmetic worth reading on its own — the "no other owner"
 * rule below is subtle and was a real bug before it existed.
 */
import { obsidianCalloutAttrId } from "../utils/calloutId";
import type { CalloutDefinition } from "../types";

/** How the caller supplies the definitions to search. */
export type DefinitionSource = () => Iterable<CalloutDefinition>;

/**
 * The definition that would collide with `rawId` once Obsidian dasherizes it,
 * or `undefined`.
 *
 * `excludeId` skips one row — the callout being edited, which may legitimately
 * already own the form. Skipping it wholesale also stops one of its own aliases
 * from conflicting with its ID.
 */
export function findAttrIdConflict(
	definitions: DefinitionSource,
	rawId: string,
	excludeId: string | null,
): CalloutDefinition | undefined {
	const key = obsidianCalloutAttrId(rawId);
	if (!key) return undefined;
	for (const def of definitions()) {
		if (def.id === excludeId) continue;
		if (obsidianCalloutAttrId(def.id) === key) return def;
		if (def.aliases?.some((a) => obsidianCalloutAttrId(a) === key)) {
			return def;
		}
	}
	return undefined;
}

/**
 * Every raw ID form that may appear in the vault for `def` and belongs to `def`
 * alone: its ID and aliases, plus each one's `data-callout` attribute form when
 * that differs and no OTHER definition owns it.
 *
 * Callers that rewrite or count usages across the vault (rename, delete, usage
 * counts, the discovery prune pass) must use this rather than
 * `[def.id, ...aliases]`, or `> [!a-b]` written by hand is orphaned when the
 * `a b` row is renamed away — the same class of bug as leaving heading and
 * inline usages behind.
 *
 * The "no other owner" condition is what keeps a legacy vault safe: where `a b`
 * and `a-b` both exist as separate rows, neither claims the other's usages.
 *
 * `forms` narrows the question to a subset of what `def` owns — the built-in
 * reset flow asks only about the aliases it is about to drop.
 */
export function vaultIdFormsFor(
	definitions: DefinitionSource,
	def: CalloutDefinition,
	forms: string[] = [def.id, ...(def.aliases ?? [])],
): string[] {
	const out = [...forms];
	for (const form of forms) {
		const attrForm = obsidianCalloutAttrId(form);
		if (!attrForm || attrForm === form) continue;
		if (out.includes(attrForm)) continue;
		if (findAttrIdConflict(definitions, attrForm, def.id)) continue;
		out.push(attrForm);
	}
	return out;
}
