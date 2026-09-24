import { t } from "../i18n";
import { SelectDropdown } from "../ui/selectDropdown";
import { createSidebarSummary, createSidebarToolbar } from "../ui/sidebarFrame";
import type { CalloutRenderRole } from "../types";

export const OCCURRENCE_ROLES: CalloutRenderRole[] = ["regular", "heading", "inline"];
export const occurrenceRoleLabel = (role: CalloutRenderRole): string => t({
	regular: "vaultStats.roleBlock", heading: "vaultStats.roleHeading", inline: "vaultStats.roleInline",
}[role]);

export function occurrenceButton(container: HTMLElement, action: string, label: string): HTMLButtonElement {
	return container.createEl("button", { text: label, attr: { type: "button", "data-action": action } });
}

/** Stable controls let an in-progress picker search survive index updates. */
export function createOccurrencesFrame(content: HTMLElement) {
	const toolbar = createSidebarToolbar(content, t("usage.title"), t("usage.subtitle"));
	const controls = toolbar.createDiv({ cls: "cs-occurrences-controls" });
	const typeField = controls.createDiv({ cls: "cs-sidebar-filter" });
	const pickerHost = typeField.createDiv({ cls: "cs-occurrences-picker" });
	const roleField = controls.createDiv({ cls: "cs-sidebar-filter" });
	const roleSelect = new SelectDropdown(roleField, t("commandBuilder.format"))
		.addOption("", t("usage.allRoles"));
	roleSelect.inputEl.dataset.action = "role";
	for (const role of OCCURRENCE_ROLES) roleSelect.addOption(role, occurrenceRoleLabel(role));
	const summary = createSidebarSummary(toolbar, "cs-occurrences-summary");
	const scroll = content.createDiv({ cls: "cs-occurrences-scroll" });
	const status = scroll.createDiv({ cls: "cs-occurrences-status", attr: { role: "status", "aria-live": "polite" } });
	const failures = scroll.createDiv({ cls: "cs-occurrences-failures" });
	const results = scroll.createDiv({ cls: "cs-occurrences-results" });
	return { pickerHost, roleSelect, summary, scroll, status, failures, results };
}
export type OccurrencesFrame = ReturnType<typeof createOccurrencesFrame>;
