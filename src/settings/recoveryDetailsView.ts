/**
 * settings/recoveryDetailsView.ts — the body of the Setup details window.
 *
 * A line saying what is compared with what,
 * the number of changes, then the comparison itself: one pinned, foldable
 * table per settings section, built by recoverySections.ts and laid out by
 * recoveryComparisonTable.ts.
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
	const source = summary.createDiv({ cls: "cs-recovery-detail-source" });
	source.createDiv({
		text: details.source.time === null ? recoverySourceTime(details.source) : t("recovery.details.savedOn", { date: recoverySourceTime(details.source) }),
		cls: "cs-recovery-detail-saved",
	});
	source.createEl("p", { text: t("recovery.details.comparingNow"), cls: "cs-recovery-detail-prose" });
	if (!details.source.data) {
		summary.createEl("p", { text: t("recovery.details.unreadable"), cls: "cs-recovery-detail-prose" });
		return;
	}
	const comparison = recoveryReport(details);
	const items = comparison.sections.flatMap(section => section.items);
	if (items.length === 0) {
		summary.createEl("p", { text: t("recovery.same"), cls: "cs-recovery-detail-prose" });
		return;
	}
	const counts = summary.createDiv({ cls: "cs-recovery-change-counts" });
	counts.createSpan({ text: t("recovery.details.count.total", { count: items.length }), cls: "cs-recovery-count-total" });
	for (const kind of ["removed", "changed", "added"] as const) {
		const count = items.filter(item => item.kind === kind).length;
		if (count) counts.createSpan({ text: t(`recovery.details.count.${kind}`, { count }), cls: `cs-recovery-state is-${kind}` });
	}
	await renderRecoveryComparison(report, comparison, component, isCurrent);
}
