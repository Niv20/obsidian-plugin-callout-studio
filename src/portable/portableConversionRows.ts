import { t } from "../i18n";
import { createSidebarFileGroup, renderSidebarLocation } from "../ui/sidebarResults";
import type { PortableCalloutConversionPlan } from "../utils/portableCalloutVault";
import type { PortableCalloutConversionChange, PortableCalloutLinkChange } from "../utils/portableCalloutPlan";
import { PORTABLE_PAGE_SIZE } from "./portableConversionFrame";

export interface PortableConversionRow {
	id: string;
	path: string;
	change: PortableCalloutConversionChange | PortableCalloutLinkChange;
	linkOnly: boolean;
}

/** A selected source row already contains its dependent link edits in its final output. */
export function portableConversionRows(plan?: PortableCalloutConversionPlan): PortableConversionRow[] {
	if (!plan) return [];
	const chosen = new Set(plan.selectedIds);
	const selectedLines = new Set(plan.changes.filter(row => row.headingLine && chosen.has(row.id)).map(row => JSON.stringify([row.path, row.line])));
	return [
		...plan.changes.map(change => ({ id: `source:${change.id}`, path: change.path, change, linkOnly: false })),
		...plan.linkChanges.filter(change => !selectedLines.has(JSON.stringify([change.path, change.line])))
			.map(change => ({ id: `link:${change.id}`, path: change.path, change, linkOnly: true })),
	].sort((a, b) => a.path.localeCompare(b.path) || a.change.line - b.change.line || Number(a.linkOnly) - Number(b.linkOnly));
}

export function renderPortableConversionRows(
	root: HTMLElement, plan: PortableCalloutConversionPlan | undefined, rows: readonly PortableConversionRow[],
	limit: number, disabled: boolean, current: string | undefined,
	onSection: (path: string, section: HTMLElement) => void,
): void {
	root.empty();
	if (!plan) return;
	if (plan.skipped) root.createEl("p", { text: t("portable.skipped", { count: plan.skipped }), cls: "cs-portable-change-note" });
	const selected = new Set(plan.selectedIds);
	const blocked = new Map(plan.blockedChanges.map(entry => [entry.id, entry.reason]));
	const counts = new Map<string, number>();
	for (const row of rows) counts.set(row.path, (counts.get(row.path) ?? 0) + 1);
	let path: string | undefined;
	let grid: HTMLElement | undefined;
	for (const row of rows.slice(0, limit)) {
		const { change, linkOnly } = row;
		if (!grid || path !== row.path) {
			path = row.path;
			const group = createSidebarFileGroup(root, { path, count: counts.get(path)!, cls: "cs-portable-file" });
			grid = group.grid;
			onSection(path, group.section);
		}
		const card = grid.createDiv({ cls: linkOnly ? "cs-portable-link-change" : "cs-portable-change cs-sidebar-selectable" });
		card.toggleClass("is-included", selected.has(change.id));
		if (!linkOnly) {
			const checkbox = card.createEl("input", { type: "checkbox", attr: {
				"data-change-id": change.id,
				"aria-label": t("portable.selectChange", { path: change.path, line: change.line }),
			} });
			checkbox.checked = selected.has(change.id);
			checkbox.disabled = disabled;
		}
		const body = card.createEl("button", { cls: "cs-sidebar-result cs-portable-change-body", attr: {
			type: "button", "data-action": "result", "data-row-id": row.id, "aria-current": String(current === row.id),
		} });
		const location = renderSidebarLocation(body, { role: rowRole(row), line: change.line, cls: "cs-portable-change-location" });
		if (!linkOnly && (change as PortableCalloutConversionChange).custom) location.createSpan({ cls: "cs-portable-custom-badge", text: t("portable.customBadge") });
		const diff = body.createSpan({ cls: "cs-portable-diff" });
		for (const which of ["before", "after"] as const) {
			const line = diff.createSpan({ cls: "cs-portable-diff-line" });
			line.createSpan({ text: t(`portable.${which}`), cls: "cs-portable-diff-label" });
			line.createEl("code", { text: change[which], cls: which === "before" ? "cs-portable-before" : "cs-portable-after", attr: { dir: "ltr" } });
		}
		const reason = blocked.get(change.id);
		if (reason) body.createSpan({ cls: "cs-portable-change-note", text: t(reason === "ambiguous-target"
			? "portable.blockedAmbiguous" : "portable.blockedTarget") });
		if (linkOnly) body.setAttribute("aria-description", t("portable.relatedLinksHint"));
	}
	if (rows.length > limit) root.createEl("button", {
		text: t("portable.showMore", { count: Math.min(PORTABLE_PAGE_SIZE, rows.length - limit) }),
		cls: "cs-portable-more", attr: { "data-action": "more" },
	});
}

function rowRole(row: PortableConversionRow): string {
	if (row.linkOnly) return t("portable.roleLink");
	const change = row.change as PortableCalloutConversionChange;
	return t(change.headingLine ? "vaultStats.roleHeading" : "vaultStats.roleInline");
}
