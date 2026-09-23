import { t, getLocale } from "../i18n";
import type { CalloutRenderRole } from "../types";
import type { CalloutOccurrenceIndex } from "./CalloutOccurrenceIndex";
import { getOccurrenceMetrics } from "./occurrenceMetrics";

export const OCCURRENCE_ROLES: CalloutRenderRole[] = ["regular", "heading", "inline"];
export const occurrenceRoleLabel = (role: CalloutRenderRole): string => t({
	regular: "vaultStats.roleBlock", heading: "vaultStats.roleHeading", inline: "vaultStats.roleInline",
}[role]);

export function occurrenceButton(container: HTMLElement, action: string, label: string): HTMLButtonElement {
	return container.createEl("button", { text: label, attr: { type: "button", "data-action": action } });
}

/** Stable controls let an in-progress picker search survive index updates. */
export function createOccurrencesFrame(content: HTMLElement) {
	content.createEl("h2", { text: t("usage.title") });
	content.createEl("hr");
	const metrics = content.createDiv({ cls: "cs-occurrences-metrics" });
	const controls = content.createDiv({ cls: "cs-occurrences-controls" });
	const pickerHost = controls.createDiv({ cls: "cs-occurrences-picker" });
	const roleSelect = controls.createEl("select", { attr: { "data-action": "role", "aria-label": t("usage.filterRole") } });
	roleSelect.createEl("option", { text: t("usage.allRoles"), value: "" });
	for (const role of OCCURRENCE_ROLES) roleSelect.createEl("option", { text: occurrenceRoleLabel(role), value: role });
	const summary = content.createDiv({ cls: "cs-occurrences-summary", attr: { role: "status", "aria-live": "polite" } });
	const status = content.createDiv({ cls: "cs-occurrences-status", attr: { role: "status", "aria-live": "polite" } });
	const failures = content.createDiv({ cls: "cs-occurrences-failures" });
	const results = content.createDiv({ cls: "cs-occurrences-results" });
	return { metrics, pickerHost, roleSelect, summary, status, failures, results };
}
export type OccurrencesFrame = ReturnType<typeof createOccurrencesFrame>;

export function renderOccurrenceMetrics(host: HTMLElement, index: CalloutOccurrenceIndex): void {
	const metrics = getOccurrenceMetrics(index);
	const waiting = index.status === "idle" || index.status === "loading" && metrics.scannedFileCount === 0;
	const values = [
		["vaultStats.totalCallouts", metrics.totalCount], ["vaultStats.typesFound", metrics.typeCount],
		["vaultStats.filesWithCallouts", metrics.fileCount], ["usage.markdownFiles", metrics.scannedFileCount],
	] as const;
	host.empty();
	for (const [label, value] of values) {
		const metric = host.createDiv({ cls: "cs-occurrences-metric" });
		metric.createSpan({ cls: "cs-occurrences-metric-value", text: waiting ? "—" : value.toLocaleString(getLocale()) });
		metric.createSpan({ cls: "cs-occurrences-metric-label", text: t(label) });
	}
}
