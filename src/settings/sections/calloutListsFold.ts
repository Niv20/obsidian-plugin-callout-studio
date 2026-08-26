/**
 * settings/sections/calloutListsFold.ts — the settings tab's collapsible
 * headings, backed by `settings.calloutListsExpanded` instead of a closure
 * that dies with the settings tab.
 *
 * `sectionDisclosure.ts` stays settings-agnostic — a plain foldable heading,
 * reusable anywhere — so this is the one place that ties a fold's *identity*
 * (a key of `CalloutListsFoldState`: `theme` / `user` / `builtin`, the same
 * `RowKind` the callout lists partition by, plus `palettes` for the Saved
 * color palettes section) to where its state is read and written.
 * `attachPersistedFold` is what `CalloutListsSection` and
 * `CustomPalettesSection` call once per heading, in place of a bare
 * `attachSectionDisclosure` plus hand-rolled settings plumbing at each call
 * site.
 */
import type { Setting } from "obsidian";
import { attachSectionDisclosure } from "./sectionDisclosure";
import type { SectionDisclosure } from "./sectionDisclosure";
import type { CalloutListsFoldState } from "../../types";

type FoldHost = {
	settings: { calloutListsExpanded: CalloutListsFoldState };
	saveSettings: () => Promise<void>;
};

export function attachPersistedFold(
	setting: Setting,
	bodyEl: HTMLElement,
	kind: keyof CalloutListsFoldState,
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
