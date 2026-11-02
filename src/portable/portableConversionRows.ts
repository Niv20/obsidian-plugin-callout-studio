import { setIcon } from "obsidian";
import { t } from "../i18n";
import { SidebarFold } from "../ui/sidebarFold";
import { createSidebarFileGroup, renderSidebarLocation } from "../ui/sidebarResults";
import type { PortableCalloutConversionPlan } from "../utils/portableCalloutVault";
import type { PortableCalloutConversionChange, PortableCalloutLinkChange } from "../utils/portableCalloutPlan";
import { PORTABLE_PAGE_SIZE } from "./portableConversionFrame";
import { canLoadOnScroll, LOAD_MORE_SENTINEL } from "../ui/loadOnScroll";

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

/**
 * Which boxes each list showed ticked when it was last drawn, by change id.
 * The rows are drawn again from nothing on every change, so a box that is new
 * has no memory of how it was a moment ago; this does. (What was *drawn*, not
 * what the page says now: a click has already turned the old box over before
 * this runs.)
 */
const tickedWhenDrawn = new WeakMap<HTMLElement, Map<string, boolean>>();

/**
 * Draw the first `limit` rows, grouped by note.
 *
 * @param fold Which notes' groups are folded away; the view keeps one across
 *   its redraws, and each group's fold button writes to it.
 * A box whose answer changed since the last draw is drawn as it was and then
 * turned over once the browser has seen it that way, so that styles.css can
 * animate the tick being drawn or taken back.
 *
 * @returns The empty marker the list ends in while more rows are left, for
 *   the view's `LoadOnScroll` to watch (finding S10-07); null when every row
 *   is drawn, or when the window cannot watch it (the list then ends in the
 *   old Show more button).
 */
export function renderPortableConversionRows(
	root: HTMLElement, plan: PortableCalloutConversionPlan | undefined, rows: readonly PortableConversionRow[],
	limit: number, disabled: boolean, current: string | undefined,
	onSection: (path: string, section: HTMLElement) => void,
	editingId?: string,
	resetEnabled = false,
	fold: SidebarFold = new SidebarFold(),
): HTMLElement | null {
	const before = tickedWhenDrawn.get(root);
	const nowTicked = new Map<string, boolean>();
	tickedWhenDrawn.set(root, nowTicked);
	root.empty();
	if (!plan) return null;
	const selected = new Set(plan.selectedIds);
	const blocked = new Map(plan.blockedChanges.map(entry => [entry.id, entry.reason]));
	const counts = new Map<string, number>();
	for (const row of rows) counts.set(row.path, (counts.get(row.path) ?? 0) + 1);
	let path: string | undefined;
	let box: HTMLElement | undefined;
	/** The turns-over to do once every box is on the page. */
	const turnOvers: (() => void)[] = [];
	for (const row of rows.slice(0, limit)) {
		const { change, linkOnly } = row;
		if (!box || path !== row.path) {
			path = row.path;
			const group = createSidebarFileGroup(root, { path, count: counts.get(path)!, cls: "cs-portable-file", fold });
			box = group.matches;
			onSection(path, group.section);
		}
		// A row of the file's box. Not Obsidian's `.search-result-file-match`,
		// whose hover tint would light up a row that is not itself a control.
		const card = box.createDiv({ cls: linkOnly ? "cs-portable-link-change cs-portable-row" : "cs-portable-change cs-portable-row cs-sidebar-selectable" });
		const editing = !linkOnly && change.id === editingId;
		card.toggleClass("is-editing", editing);
		// The row the caret is in (see portableConversionNavigation.ts `mark`).
		card.toggleClass("is-active", current === row.id);
		card.toggleClass("is-included", selected.has(change.id));
		if (!linkOnly) {
			const checkbox = card.createEl("input", { type: "checkbox", attr: {
				"data-change-id": change.id,
				"aria-label": t("portable.selectChange", { path: change.path, line: change.line }),
			} });
			const ticked = selected.has(change.id);
			const was = before?.get(change.id);
			nowTicked.set(change.id, ticked);
			checkbox.checked = was ?? ticked;
			if (was !== undefined && was !== ticked) turnOvers.push(() => { checkbox.checked = ticked; });
			checkbox.disabled = disabled;
		}
		const body = card.createDiv({ cls: "cs-sidebar-result cs-portable-change-body", attr: {
			"data-row-id": row.id, "aria-current": String(current === row.id),
		} });
		const source = body.createEl("button", { cls: "cs-portable-source", attr: {
			type: "button", "data-action": "result", "data-row-id": row.id,
		} });
		const location = renderSidebarLocation(source, { role: rowRole(row), line: change.line, cls: "cs-portable-change-location" });
		if (!linkOnly && (change as PortableCalloutConversionChange).custom) location.createSpan({ cls: "flair mod-flat cs-portable-custom-badge", text: t("portable.customBadge") });
		for (const which of ["before", "after"] as const) {
			const line = (which === "before" ? source : body).createSpan({ cls: "cs-portable-diff-line" });
			line.createSpan({ text: t(`portable.${which}`), cls: "cs-portable-diff-label" });
			const slot = which === "after" && !linkOnly
				? line.createSpan({ attr: { "data-replacement": change.id } }) : line;
			const text = which === "after" && !linkOnly
				? slot.createEl("button", { cls: "cs-portable-after-button", attr: {
					type: "button", "data-action": "edit", "aria-description": t("portable.editCustom"),
				} }) : slot;
			if (text !== slot) (text as HTMLButtonElement).disabled = disabled;
			if (text !== slot && !change.after.trim()) text.setAttribute("aria-label", t("portable.editCustom"));
			text.createEl("code", { text: change[which], cls: which === "before" ? "cs-portable-before" : "cs-portable-after", attr: { dir: "ltr" } });
		}
		const reason = blocked.get(change.id);
		if (reason) body.createSpan({ cls: "cs-portable-change-note", text: t(reason === "ambiguous-target"
			? "portable.blockedAmbiguous" : "portable.blockedTarget") });
		if (!linkOnly) {
			const actions = body.createDiv({ cls: "cs-portable-card-actions" });
			const reset = createCardAction(actions, "restore", "rotate-ccw",
				t(editing ? "portable.cancelEdit" : "portable.restoreDefault"), disabled);
			reset.hidden = !(editing ? resetEnabled : (change as PortableCalloutConversionChange).custom);
			createCardAction(actions, "edit", "pencil", t("portable.editCustom"), disabled);
		}
		if (linkOnly) source.setAttribute("aria-description", t("portable.relatedLinksHint"));
	}
	// Reading a measurement makes the browser work out how the boxes look as drawn
	// (once for all of them); turning them over after that starts their transitions.
	if (turnOvers.length > 0) void root.offsetWidth;
	for (const turnOver of turnOvers) turnOver();
	if (rows.length <= limit) return null;
	if (canLoadOnScroll(root.ownerDocument)) {
		return root.createDiv({ cls: LOAD_MORE_SENTINEL, attr: { "aria-hidden": "true" } });
	}
	root.createEl("button", {
		text: t("portable.showMore", { count: Math.min(PORTABLE_PAGE_SIZE, rows.length - limit) }),
		cls: "cs-portable-more", attr: { "data-action": "more" },
	});
	return null;
}

function rowRole(row: PortableConversionRow): string {
	if (row.linkOnly) return t("portable.roleLink");
	const change = row.change as PortableCalloutConversionChange;
	return t(change.headingLine ? "vaultStats.roleHeading" : "vaultStats.roleInline");
}

function createCardAction(host: HTMLElement, action: string, icon: string, label: string, disabled: boolean): HTMLButtonElement {
	const button = host.createEl("button", { cls: "clickable-icon", attr: {
		type: "button", "data-action": action, "aria-label": label,
	} });
	button.disabled = disabled;
	setIcon(button, icon);
	return button;
}
