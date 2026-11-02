/**
 * settings/sections/duplicateCallout.ts — Duplicate, in a callout row's ⋮ menu.
 *
 * Who calls it. The row menus of the user's own callouts (CalloutRowActions.ts)
 * and of the theme's (themeRowActions.ts) add the item.
 *
 * The main idea. The copy is written to the settings file first and joins the
 * registry only once that write has succeeded, so a failed save never leaves a
 * callout on screen that is not on disk. Then the settings show the new row
 * (`revealCallout`: My callout types, flashed).
 */
import { type Menu } from "obsidian";
import { t } from "../../i18n";
import { createDuplicateCalloutDefinition, displayNameIdentity } from "../../manager/duplicateCalloutDefinition";
import { stableKeyOrder } from "../../utils/stableJson";
import type { CalloutDefinition } from "../../types";
import type { SettingsContext } from "./types";
import { ROW_MENU_SECTION } from "./rowMenuSections";
import { showNotice } from "../../ui/mascot/mascotNotices";

/** Add Duplicate to a row's menu; built-in callouts have none. */
export function addDuplicateItem(
	menu: Menu,
	ctx: SettingsContext,
	def: CalloutDefinition,
): void {
	if (def.builtIn || def.source === "builtin" || def.source === "theme") return;
	menu.addItem((item) => item
		.setTitle(t("settings.duplicateAction"))
		.setIcon("copy")
		.setSection(ROW_MENU_SECTION.callout)
		.onClick(() => handleCalloutDuplicate(ctx, def.id)));
}

/** Keep the candidate out of the live registry until its settings write succeeds. */
export async function handleCalloutDuplicate(
	ctx: SettingsContext,
	id: string,
): Promise<void> {
	const { plugin } = ctx;
	const { registry, settingsWriter } = plugin;
	let published = false;
	let publicationConflict = false;
	try {
		if (plugin.settingsEditOpen || settingsWriter.isFrozen || settingsWriter.isDestroyed) {
			throw new Error("Settings are unavailable or being edited");
		}
		const source = registry.getReal(id);
		if (!source) throw new Error("The source callout no longer exists");
		const candidate = createDuplicateCalloutDefinition(source, registry.getAll());
		const data = structuredClone(registry.toSaveData());
		const before = JSON.stringify(stableKeyOrder(data));
		data.callouts.push(candidate);
		const canPublish = (): boolean =>
			!registry.findAttrIdConflict(candidate.id, null) &&
			!(candidate.aliases ?? []).some(alias => registry.findAttrIdConflict(alias, null)) &&
			!registry.getAll().some(def =>
				displayNameIdentity(def.displayName) === displayNameIdentity(candidate.displayName));
		const current = (): boolean => !plugin.settingsEditOpen &&
			JSON.stringify(stableKeyOrder(registry.toSaveData())) === before && canPublish();
		const saved = await settingsWriter.commit(data, current, () => {
			// A local edit can arrive while the adapter write is in flight. Add
			// only this row, never replace the registry or overwrite that edit.
			published = canPublish() && registry.add(candidate);
			publicationConflict = !published;
		});
		if (!saved || !published) throw new Error("The duplicate could not be committed");
		plugin.refreshCallouts();
		if (ctx.revealCallout) ctx.revealCallout(candidate);
		else ctx.redraw();
		showNotice("success", t("notice.calloutDuplicated", { name: candidate.displayName }));
	} catch (error) {
		console.error("[Callout Studio] callout duplication failed", error);
		showNotice("problem", t("notice.calloutDuplicateFailed"));
		// A failure after publication leaves a valid row on disk and in the
		// registry. Keep that durable row and refresh it. On an in-flight ID
		// conflict, reconcile disk with the newer local edit.
		if (publicationConflict) {
			try { await plugin.saveSettings(); }
			catch { /* The writer already exposes the saving failure. */ }
		}
		if (published) {
			plugin.refreshCallouts();
			ctx.redraw();
		}
	}
}
