/**
 * settings/recoveryComparisonTable.ts — the setup comparison, laid out as one
 * table per settings section.
 *
 * Every section is a table with four columns: **No.**, **Item**, **Current
 * setup** and **After restoring this version**. Its head is two rows — the
 * section's title, which folds the section away when pressed, and the column
 * headings — and the whole head pins to the top of the window while the
 * section's rows scroll under it. One sticky head rather than a pinned title
 * with pinned headings under it: every sticky layer in this plugin sits at
 * `top: 0` (see tests/modalBodyLayers.test.ts), and a head that is one block
 * cannot come apart.
 *
 * Each item is one `<tbody>`: a first row holding its number, its title and —
 * where there is one — a drawing of the whole item on each side, then one row
 * per changed field with the field's name in the Item column. The number cell
 * spans all of the item's rows, which is what shows that a title and the rows
 * under it are one change. Numbers run on across sections, so every change in
 * the window has its own.
 *
 * Nothing here decides what differs or how a value looks; that is
 * recoverySections.ts and recoveryValues.ts.
 */
import { setIcon, type Component } from "obsidian";
import { t } from "../i18n";
import type { RecoveryItem, RecoveryReport, RecoverySection, RecoverySideName } from "./recoveryModel";
import { keepHeadingInPlace } from "./sections/foldAnchor";
import { appendHeadingCount } from "../ui/headingCount";

/** Give the loading state and input events a turn between batches. */
export function yieldRecoveryRender(component: Component, delay = 0): Promise<void> {
	return new Promise(resolve => {
		const timer = window.setTimeout(resolve, delay);
		component.register(() => { window.clearTimeout(timer); resolve(); });
	});
}

const SIDES: readonly RecoverySideName[] = ["before", "after"];
/** Items drawn between yields; each can hold two full callout previews. */
const BATCH = 8;

/** One section's table with its head: the folding title row, then the column headings. */
function sectionTable(parent: HTMLElement, section: RecoverySection, component: Component): HTMLTableElement {
	const table = parent.createEl("table", { cls: "cs-recovery-comparison", attr: { "data-recovery-section": section.id } });
	const columns = table.createEl("colgroup");
	for (const cls of ["is-number", "is-item", "is-side", "is-side"]) columns.createEl("col", { cls });
	const head = table.createEl("thead");
	const heading = head.createEl("tr", { cls: "cs-recovery-section-row" }).createEl("th", {
		cls: "cs-recovery-section-heading cs-collapsible-heading",
		attr: { colspan: "4", scope: "colgroup" },
	});
	const toggle = heading.createEl("button", { cls: "cs-recovery-section-toggle", attr: { type: "button", "aria-expanded": "true" } });
	setIcon(toggle.createSpan({ cls: "cs-disclosure-chevron", attr: { "aria-hidden": "true" } }), "chevron-right");
	toggle.createSpan({ cls: "cs-recovery-section-title", text: section.title });
	// Its own flex item rather than inside the title, so a title cut short
	// with an ellipsis still shows how many changes it holds.
	appendHeadingCount(toggle, section.items.length);
	const labels = head.createEl("tr", { cls: "cs-recovery-column-row" });
	labels.createEl("th", { cls: "cs-recovery-column-number", text: t("recovery.details.column.number"), attr: { scope: "col" } });
	labels.createEl("th", { cls: "cs-recovery-column-item", text: t("recovery.details.column.item"), attr: { scope: "col" } });
	for (const key of ["recovery.details.current", "recovery.details.restored"]) {
		labels.createEl("th", { cls: "cs-recovery-column-side", text: t(key), attr: { scope: "col" } });
	}
	// Folding keeps the title row; a pinned title stays where it was pressed.
	component.registerDomEvent(toggle, "click", () => keepHeadingInPlace(heading, () => {
		const collapsed = !table.hasClass("is-collapsed");
		table.toggleClass("is-collapsed", collapsed);
		heading.toggleClass("is-collapsed", collapsed);
		toggle.setAttribute("aria-expanded", String(!collapsed));
	}));
	return table;
}

/** Whether the item exists in that setup; an added one has no current side, a removed one no restored side. */
function exists(item: RecoveryItem, side: RecoverySideName): boolean {
	return side === "before" ? item.kind !== "added" : item.kind !== "removed";
}

function renderItem(
	table: HTMLTableElement, item: RecoveryItem, number: number, report: RecoveryReport, component: Component,
): void {
	const group = table.createEl("tbody", {
		cls: `cs-recovery-item is-${item.kind}`,
		attr: { "data-recovery-item": item.key },
	});
	const first = group.createEl("tr", { cls: "cs-recovery-item-row" });
	first.createEl("th", {
		cls: "cs-recovery-number",
		text: String(number),
		attr: { scope: "rowgroup", rowspan: String(1 + item.fields.length) },
	});
	const title = first.createEl("th", { cls: "cs-recovery-item-title", attr: { scope: "row" } });
	title.createSpan({ cls: "cs-recovery-item-name", text: item.title });
	if (item.code) title.createEl("code", { cls: "cs-recovery-code", text: item.code });
	if (item.note) title.createSpan({ cls: "cs-recovery-item-note", text: item.note });
	title.createSpan({ cls: `cs-recovery-state is-${item.kind}`, text: t(`recovery.details.calloutState.${item.kind}`) });
	if (item.summary) {
		for (const side of SIDES) {
			const cell = first.createEl("td", { cls: "cs-recovery-side" });
			if (exists(item, side)) item.summary(cell, side, component);
			else cell.createSpan({ cls: "cs-recovery-muted", text: t(side === "before" ? "recovery.details.onlySaved" : "recovery.details.willRemove") });
		}
	} else {
		// Nothing to draw for the item as a whole: its title heads the row instead.
		title.setAttribute("colspan", "3");
	}
	for (const field of item.fields) {
		const row = group.createEl("tr", { cls: "cs-recovery-field-row" });
		row.createEl("th", { cls: "cs-recovery-field-label", text: field.label, attr: { scope: "row" } });
		SIDES.forEach((side, index) => {
			const cell = row.createEl("td", { cls: "cs-recovery-side" });
			const value = side === "before" ? field.before : field.after;
			if (value === undefined) cell.createSpan({ cls: "cs-recovery-muted", text: field.absent ?? t("recovery.details.value.notSet") });
			else field.render(cell, value, report.sides[side], field.owners?.[index]);
		});
	}
}

/** Every section of `report`, in batches; stops as soon as `isCurrent` says the window moved on. */
export async function renderRecoveryComparison(
	parent: HTMLElement, report: RecoveryReport, component: Component, isCurrent: () => boolean,
): Promise<void> {
	let number = 0;
	for (const section of report.sections) {
		const table = sectionTable(parent, section, component);
		for (const item of section.items) {
			if (number > 0 && number % BATCH === 0) {
				await yieldRecoveryRender(component);
				if (!isCurrent()) return;
			}
			renderItem(table, item, ++number, report, component);
		}
	}
}
