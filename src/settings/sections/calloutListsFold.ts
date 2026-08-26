/**
 * settings/sections/calloutListsFold.ts — the three list-heading folds,
 * backed by `settings.calloutListsExpanded` instead of a closure that dies
 * with the settings tab.
 *
 * `sectionDisclosure.ts` stays settings-agnostic — a plain foldable heading,
 * reusable anywhere — so this is the one place that ties a fold's *identity*
 * (`theme` / `user` / `builtin`, the same `RowKind` the lists themselves
 * partition by) to where its state is read and written.
 * `attachPersistedFold` is what `CalloutListsSection` calls once per heading,
 * in place of a bare `attachSectionDisclosure` plus hand-rolled settings
 * plumbing at each of the three call sites.
 */
import type { Setting } from "obsidian";
import { attachSectionDisclosure } from "./sectionDisclosure";
import type { SectionDisclosure } from "./sectionDisclosure";
import type { RowKind } from "./rowOwnership";
import type { CalloutListsFoldState } from "../../types";

type FoldHost = {
	settings: { calloutListsExpanded: CalloutListsFoldState };
	saveSettings: () => Promise<void>;
};

export function attachPersistedFold(
	setting: Setting,
	bodyEl: HTMLElement,
	kind: RowKind,
	plugin: FoldHost,
): SectionDisclosure {
	return attachSectionDisclosure(
		setting,
		bodyEl,
		plugin.settings.calloutListsExpanded[kind],
		(expanded) => {
			plugin.settings.calloutListsExpanded[kind] = expanded;
			void plugin.saveSettings();
		},
	);
}
