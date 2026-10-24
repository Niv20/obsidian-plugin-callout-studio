/**
 * portable/portableConversionFrame.ts — the fixed parts of the Review
 * conversion sidebar: the Convert button, the selection line, and the
 * scrolling area the results go in.
 *
 * Who calls it. portable/PortableConversionView.ts, and the guide scenes.
 *
 * The main idea (finding S10-05). The pane's top is laid out as Obsidian's
 * panes lay theirs out: the help button is in the view's nav header
 * (ui/sidebarFrame.ts, added by the view), Convert selected spans the pane in
 * a row of its own, and the selection line (with its select-all box) is the
 * muted count over a single line, Obsidian's `.search-results-info`. Until
 * 2026-10-24 the pane began with a bold title holding the help button and a
 * sentence beside the Convert button; that sentence is now the first line of
 * the help window.
 */
import { t } from "../i18n";
import { DESTRUCTIVE_BUTTON_CLASSES } from "../ui/destructiveButton";
import { createSidebarSummary, createSidebarToolbar } from "../ui/sidebarFrame";
import type { PortableCalloutConversionPlan } from "../utils/portableCalloutPlan";

export const PORTABLE_PAGE_SIZE = 100;
export interface PortableConversionFrame {
	status: HTMLElement;
	summary: HTMLElement;
	convert: HTMLButtonElement;
	all: HTMLInputElement;
	retry: HTMLButtonElement;
	hint: HTMLElement;
	shell: HTMLElement;
	scroll: HTMLElement;
	overlay: HTMLElement;
	results: HTMLElement;
}

export function createPortableConversionFrame(root: HTMLElement): PortableConversionFrame {
	root.empty();
	const toolbar = createSidebarToolbar(root);
	// Convert selected, across the pane in a row of its own.
	const actions = toolbar.createDiv({ cls: "cs-portable-convert-row" });
	const convert = actions.createEl("button", {
		text: t("portable.convertSelected"), cls: DESTRUCTIVE_BUTTON_CLASSES, attr: { "data-action": "convert" },
	});
	const summaryRow = createSidebarSummary(toolbar, "cs-portable-review-summary");
	const all = summaryRow.createEl("input", { type: "checkbox", attr: {
		"data-action": "toggle-all", "aria-label": t("portable.selectAll"),
	} });
	const summary = summaryRow.createSpan({ cls: "cs-portable-summary-text" });
	const shell = root.createDiv({ cls: "cs-portable-results-shell" });
	const scroll = shell.createDiv({ cls: "cs-portable-results-scroll" });
	const hint = scroll.createEl("p", { cls: "cs-portable-hint" });
	const status = scroll.createDiv({ cls: "cs-portable-review-status", attr: { role: "status", "aria-live": "polite" } });
	const retry = scroll.createEl("button", {
		text: t("portable.retry"), cls: "cs-portable-retry", attr: { "data-action": "retry" },
	});
	const results = scroll.createDiv({ cls: "cs-portable-change-list" });
	const overlay = shell.createDiv({ cls: "cs-portable-refresh-overlay", attr: { role: "status", "aria-live": "polite" } });
	overlay.hidden = true;
	return { convert, summary, status, all, retry, hint, shell, scroll, overlay, results };
}

/**
 * Paint what the plan alone decides: the summary, the Convert label and the
 * select-all box. Whether Convert can act is not here — that also depends on
 * the review being open, scanning, failed or mid-edit, so the view decides it
 * and dims the button itself (`PortableConversionView.convertBlockedReason`).
 */
export function updatePortableSelection(frame: PortableConversionFrame, plan: PortableCalloutConversionPlan | undefined, ready: boolean): void {
	// No heading link to update is no news: the summary drops that half rather than say "0".
	frame.summary.setText(plan ? t(plan.linkCount ? "portable.selectionSummary" : "portable.selectionSummaryNoLinks", {
		selected: plan.selectedIds.length, total: plan.changes.length, links: plan.linkCount,
	}) : "");
	frame.convert.setText(t(plan?.recovery ? "portable.finishConversion" : "portable.convertSelected"));
	const selected = plan?.selectedIds.length ?? 0, total = plan?.changes.length ?? 0;
	frame.all.checked = total > 0 && selected === total;
	frame.all.indeterminate = selected > 0 && selected < total;
	frame.all.disabled = !ready || !plan?.changes.length || Boolean(plan.recovery);
	const action = t(frame.all.checked ? "portable.selectNone" : "portable.selectAll");
	frame.all.setAttribute("aria-label", action);
}

/** Brief scans never insert status text or shift the controls. */
export class PortableConversionBusy {
	private timer?: number;
	private frame?: PortableConversionFrame;
	private visible = false;
	private message: () => string = () => t("portable.scanning");
	constructor(private readonly delay: number) {}
	update(frame: PortableConversionFrame, stale: boolean, busy: boolean): void {
		this.frame = frame;
		frame.shell.toggleClass("is-stale", stale);
		frame.results.setAttribute("aria-busy", String(busy));
		if (!busy) this.stop();
		else if (!this.visible && this.timer === undefined) this.timer = window.setTimeout(() => {
			this.timer = undefined;
			this.visible = true;
			this.paint();
		}, this.delay);
		this.paint();
	}
	setMessage(key: string, vars: Record<string, string | number> = {}): void {
		this.message = () => t(key, vars);
		this.paint();
	}
	stop(): void {
		if (this.timer !== undefined) window.clearTimeout(this.timer);
		this.timer = undefined;
		this.visible = false;
		this.paint();
	}
	private paint(): void {
		if (!this.frame) return;
		this.frame.shell.toggleClass("is-busy", this.visible);
		this.frame.overlay.hidden = !this.visible;
		this.frame.overlay.setText(this.visible ? this.message() : "");
	}
}
