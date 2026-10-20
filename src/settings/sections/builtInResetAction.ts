/**
 * settings/sections/builtInResetAction.ts — a built-in row's **Reset to
 * default**.
 *
 * Reset puts back the definition Obsidian ships, ids included, so an id the
 * user added to a built-in leaves it. Notes still written with one are asked
 * about first, the way the callout editor asks when an id is removed there:
 * "Update your notes?" (../editor/NoteChangesModal.ts), on **Leave them as
 * they are**, or **Change them to** one of the built-in's own ids — with
 * **Reset to default** as its button. Nothing is asked when no note uses an
 * added id.
 *
 * Only the ids are asked about. A built-in's name cannot be changed, and Reset
 * has never rewritten fold marks, so the question is put as if the name and
 * fold setting stayed as they are.
 *
 * The notes go first. A note rewritten to the built-in's own id is right
 * whether the reset follows or not, so a rewrite that stops part-way leaves
 * the callout as it was — its other notes still on the added id, for the next
 * Reset to ask about again.
 */
import { Notice } from "obsidian";
import { t } from "../../i18n";
import type { CalloutDefinition } from "../../types";
import { askNoteChanges } from "../editor/askNoteChanges";
import { createCalloutVaultSavePlan } from "../editor/calloutVaultSavePlan";
import { NoteChangesModal, removedIdsLine, type NoteChangesModalInput } from "../editor/NoteChangesModal";
import {
	noteRewritesFor,
	pendingNoteChangesFor,
	type NoteChangeFormState,
	type NoteChoices,
} from "../editor/noteChanges";
import type { SettingsSectionContext } from "./types";

export async function handleBuiltInReset(
	ctx: SettingsSectionContext,
	def: CalloutDefinition,
	/** Opens the question; a test answers in its place. */
	open: (input: NoteChangesModalInput) => Promise<NoteChoices | null> = (input) => new NoteChangesModal(ctx.app, input).ask(),
): Promise<void> {
	const { registry } = ctx.plugin;
	const original = registry.getBuiltInDefault(def.id);
	const current = registry.getReal(def.id);
	if (!original || !current) return;

	const state: NoteChangeFormState = {
		calloutId: original.id,
		aliases: original.aliases ?? [],
		displayName: current.displayName,
		foldable: current.foldable,
		defaultFolded: current.defaultFolded,
	};
	// Read before the reset: once it lands, the added ids are no longer the
	// callout's, and their spellings are no longer its to rewrite.
	const pending = pendingNoteChangesFor(registry, def.id, state);
	const choices = await askNoteChanges({
		app: ctx.app,
		registry,
		existingId: def.id,
		state,
		moves: [],
		stillWanted: () => true,
		open: (input) => open({
			...input,
			action: {
				removed: (ids) => removedIdsLine(ids, "noteChanges.changeResetRemoved", "noteChanges.changeResetRemovedMany"),
				confirm: t("settings.resetAction"),
			},
		}),
	});
	if (!choices) return;

	const plan = createCalloutVaultSavePlan({
		app: ctx.app,
		rewrites: noteRewritesFor(pending, choices, original, current.displayName),
		titles: null,
		fold: null,
	});
	if (plan) {
		try {
			await plan();
		} catch (error) {
			console.error("[callout-studio] note updates before a reset failed", error);
			new Notice(t("vault.resetNotesFailed"), 10000);
			return;
		}
	}
	registry.resetBuiltIn(def.id);
	ctx.display();
}
