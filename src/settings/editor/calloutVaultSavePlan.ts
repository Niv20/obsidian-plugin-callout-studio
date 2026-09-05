import { Notice, type App } from "obsidian";
import { t } from "../../i18n";
import type { CalloutDefinition } from "../../types";
import type { CalloutRegistry } from "../../manager/CalloutRegistry";
import { calloutIdentity } from "../../utils/calloutId";
import {
	countCalloutUsages, normalizeFoldMarkersInVault,
	replaceCalloutIdsInVault, replaceCalloutTitlesInVault,
} from "../../utils/vaultCalloutScanner";

export type CalloutVaultSavePlan = () => Promise<void>;

/** Persist old spellings until every affected note has reached the new id. */
export function stageRenameAliases(def: CalloutDefinition, removedIds: string[]): {
	definition: CalloutDefinition;
	release(registry: CalloutRegistry): void;
} {
	const owned = new Set([def.id, ...(def.aliases ?? [])].map(calloutIdentity));
	const retained = removedIds.filter((id) => {
		const key = calloutIdentity(id);
		if (!key || owned.has(key)) return false;
		owned.add(key); return true;
	});
	const protectedIds = new Set(retained.map(calloutIdentity));
	return {
		definition: retained.length ? { ...def, aliases: [...(def.aliases ?? []), ...retained] } : def,
		release(registry) {
			if (retained.length === 0) return;
			const current = registry.getReal(def.id);
			if (!current) throw new Error("Renamed callout no longer exists");
			const aliases = current.aliases?.filter((id) => !protectedIds.has(calloutIdentity(id)));
			// A newer form preview may have arrived while file work awaited. Edit
			// the committed row beneath it without baking draft colors into disk.
			const preview = registry.getPreviewDefinition();
			const shadowed = preview?.id === def.id;
			const demo = registry.isPreviewDemo();
			registry.batch(() => {
				if (shadowed) registry.setPreviewDefinition(null, demo, false);
				try { registry.update(def.id, { aliases: aliases?.length ? aliases : undefined }); }
				finally { if (shadowed) registry.setPreviewDefinition(preview, demo, false); }
			});
		},
	};
}

interface VaultSavePlanInput {
	app: App;
	removedIds: string[];
	currentIds: string[];
	newId: string;
	oldTitle: string | null;
	newTitle: string;
	foldMarker: "" | "+" | "-" | null;
}

/** Idempotent phases: retain unfinished work when a file fails, then retry it. */
export function createCalloutVaultSavePlan(input: VaultSavePlanInput): CalloutVaultSavePlan | null {
	const { app, newId, oldTitle, newTitle, foldMarker } = input;
	const removedIds = [...input.removedIds];
	const currentIds = [...input.currentIds];
	let idsDone = removedIds.length === 0;
	let titleDone = oldTitle === null || oldTitle === newTitle;
	let foldDone = foldMarker === null;
	if (idsDone && titleDone && foldDone) return null;
	return async () => {
		if (!idsDone) {
			const { fileCount } = await countCalloutUsages(app, removedIds);
			if (fileCount > 0) {
				const replaced = await replaceCalloutIdsInVault(app, removedIds, newId, undefined, true);
				if (replaced > 0) new Notice(t("vault.idsUpdated", {
					count: String(replaced), oldIds: removedIds.join(", "), newId,
				}));
			}
			idsDone = true;
		}
		if (!titleDone && oldTitle !== null) {
			const replaced = await replaceCalloutTitlesInVault(app, currentIds, oldTitle, newTitle, true);
			if (replaced > 0) new Notice(t("vault.titlesUpdated", {
				count: String(replaced), oldTitle, newTitle,
			}));
			titleDone = true;
		}
		if (!foldDone && foldMarker !== null) {
			await normalizeFoldMarkersInVault(app, currentIds, foldMarker, true);
			foldDone = true;
		}
	};
}
