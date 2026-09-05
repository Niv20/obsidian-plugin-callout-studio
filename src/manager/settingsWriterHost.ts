/**
 * manager/settingsWriterHost.ts — what the plugin hands `SettingsWriter`.
 *
 * Four small functions, and one of them is a policy rather than a wire.
 * `build` and `write` are the obvious pair; `readCurrent` and `onStaleWrite`
 * are the pre-write freshness check (`manager/staleWriteGuard.ts`), and what
 * to *do* about a divergence is a decision — re-read and adopt, and tell the
 * user their change did not land — not lifecycle.
 *
 * Its own module because `main.ts` is wiring, and because the answer to "why
 * does a save sometimes not save" should be findable without reading the
 * plugin class.
 */
import { Notice } from "obsidian";
import { SettingsWriter } from "./SettingsWriter";
import { readSettingsFile, type SettingsFileHost } from "./settingsFile";
import { t } from "../i18n";

/** What building the writer needs from the plugin. */
export interface SettingsWriterOwner extends SettingsFileHost {
	registry: { toSaveData(): unknown };
	/** Obsidian's `Plugin.saveData`. */
	saveData(data: unknown): Promise<void>;
	/** @see CalloutStudioPlugin.onExternalSettingsChange */
	onExternalSettingsChange(): Promise<void>;
}

/**
 * The one writer this plugin has.
 *
 * `readCurrent` answers with the file exactly as `SaveGuard` would have
 * adopted it, so the comparison is between two normalized strings rather than
 * between one of ours and whatever whitespace Obsidian last wrote. Anything
 * that is not a readable file answers `null`, which the check reads as "not my
 * business" — a missing or unparseable `data.json` is `freeze()`'s to handle,
 * and refusing to write here would stop a genuine fresh install ever creating
 * one.
 *
 * `onStaleWrite` does the only two things worth doing: adopt the file that
 * turned up, and say plainly that the change just made was not saved. Saying
 * so matters more than it looks — the alternative is a user who watches a
 * colour revert with no explanation, which is exactly how a sync problem gets
 * reported as "the plugin resets my callouts".
 */
export function createSettingsWriter(
	owner: SettingsWriterOwner,
): SettingsWriter {
	return new SettingsWriter({
		build: () => owner.registry.toSaveData(),
		write: (data) => owner.saveData(data),
		readCurrent: async () => {
			const read = await readSettingsFile(owner);
			return read.kind === "loaded" ? read.json : null;
		},
		onStaleWrite: () => {
			new Notice(t("notice.settingsChangedElsewhere"), 10000);
			void owner.onExternalSettingsChange();
		},
		// Once per freeze, and worth the interruption exactly because it is
		// once: the launch notice that announced the freeze was shown before
		// the user had looked at the screen, and this fires at the moment their
		// first change stops being real.
		onFrozenSave: () => {
			new Notice(t("notice.settingsNotSaved"), 10000);
		},
	});
}
