/**
 * settings/recoveryDetailsView.ts — the body of the Version details window.
 *
 * A compact panel with the change count and comparison
 * context. The date is in the window title. Then the comparison itself: one
 * pinned, foldable table per settings section, built by recoverySections.ts
 * and laid out by recoveryComparisonTable.ts.
 */
import type { Component } from "obsidian";
import { getLocale, t } from "../i18n";
import type { RecoverySource } from "../manager/settingsRecoveryService";
import type { SetupDetails } from "../manager/setupDetails";
import { renderRecoveryComparison } from "./recoveryComparisonTable";
import { recoveryReport } from "./recoverySections";

export function recoverySourceTime(source: RecoverySource): string {
	if (source.time === null) return t("recovery.details.unknownTime");
	try { return new Date(source.time).toLocaleString(getLocale()); }
	catch { return new Date(source.time).toLocaleString(); }
}

export async function renderRecoveryDetails(
	parent: HTMLElement, details: SetupDetails, component: Component,
	isCurrent: () => boolean = () => true,
): Promise<void> {
	const report = parent.createDiv({ cls: "cs-recovery-detail-report" });
	const summary = report.createDiv({ cls: "cs-recovery-detail-summary" });
	const outcome = summary.createDiv({ cls: "cs-recovery-detail-outcome" });
	outcome.createDiv({ text: t("recovery.details.changesTitle"), cls: "cs-recovery-change-title" });
	if (!details.source.data) {
		renderChangeDivider(outcome, t("versions.details.comparisonUnavailable"));
		outcome.createEl("p", { text: t("recovery.details.unreadable"), cls: "cs-recovery-detail-prose" });
		return;
	}
	const comparison = recoveryReport(details);
	const items = comparison.sections.flatMap(section => section.items);
	if (items.length === 0) {
		renderChangeDivider(outcome, t("recovery.same"));
		return;
	}
	renderChangeDivider(outcome, t(items.length === 1 ? "versions.details.difference" : "versions.details.differences", { count: items.length }));
	const counts = outcome.createDiv({ cls: "cs-recovery-change-counts" });
	for (const kind of ["removed", "changed", "added"] as const) {
		const count = items.filter(item => item.kind === kind).length;
		if (count) counts.createSpan({ text: t(`recovery.details.count.${kind}`, { count }), cls: `cs-recovery-state is-${kind}` });
	}
	await renderRecoveryComparison(report, comparison, component, isCurrent);
}

function renderChangeDivider(parent: HTMLElement, label: string): void {
	const divider = parent.createDiv({ cls: "cs-recovery-change-divider" });
	divider.createSpan({ text: label, cls: "cs-recovery-count-total" });
}
