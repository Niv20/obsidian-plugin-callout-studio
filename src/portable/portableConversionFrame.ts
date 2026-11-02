/**
 * portable/portableConversionFrame.ts — the fixed parts of the Review
 * conversion sidebar: the Convert button with the help button beside it, the
 * selection lines, and the scrolling area the results go in.
 *
 * Who calls it. portable/PortableConversionView.ts, and the guide scenes.
 *
 * The main idea (finding S10-05). The pane's top is laid out as Obsidian's
 * panes lay theirs out: Convert selected spans the pane in a row of its own,
 * with the small help button at the row's end, and under it the selection
 * (with its select-all box) is the muted count, Obsidian's
 * `.search-results-info`. The selection takes two lines, "74 of 74
 * replacements selected" and under it "3 heading links to update", the second
 * only while there are links to update. Until 2026-10-27 the help button was
 * in a row of its own above (Obsidian's nav header), and the two halves of the
 * selection shared one line. Until 2026-10-24 the pane began with a bold title
 * holding the help button and a sentence beside the Convert button; that
 * sentence is now the first line of the help window.
 */
import { HELP_ICON_ID } from "../constants";
import { t } from "../i18n";
import { DESTRUCTIVE_BUTTON_CLASSES } from "../ui/destructiveButton";
import { addSidebarIconButton, createSidebarSummary, createSidebarToolbar } from "../ui/sidebarFrame";
import type { PortableCalloutConversionPlan } from "../utils/portableCalloutPlan";

export const PORTABLE_PAGE_SIZE = 100;
export interface PortableConversionFrame {
	status: HTMLElement;
	/** The first line of the selection: how many replacements are selected. */
	summary: HTMLElement;
	/** The second line: how many heading links will be updated; hidden when none. */
	links: HTMLElement;
	convert: HTMLButtonElement;
	/** The small help button at the end of the Convert row. */
	help: HTMLElement;
	all: HTMLInputElement;
	retry: HTMLButtonElement;
	hint: HTMLElement;
	shell: HTMLElement;
	scroll: HTMLElement;
	overlay: HTMLElement;
	results: HTMLElement;
}

/**
 * Draw the pane's fixed parts into `root`.
 *
 * @param onHelp What the help button does (open the help window).
 */
export function createPortableConversionFrame(root: HTMLElement, onHelp: () => void): PortableConversionFrame {
	root.empty();
	const toolbar = createSidebarToolbar(root);
	// Convert selected, across the pane in a row of its own, with help at its end.
	const actions = toolbar.createDiv({ cls: "cs-portable-convert-row" });
	const convert = actions.createEl("button", {
		text: t("portable.convertSelected"),
		cls: DESTRUCTIVE_BUTTON_CLASSES,
		attr: { "data-action": "convert" },
	});
	const help = addSidebarIconButton(actions, { icon: HELP_ICON_ID, label: t("portable.help"), onPress: onHelp });
	help.setAttribute("aria-haspopup", "dialog");
	const summaryRow = createSidebarSummary(toolbar, "cs-portable-review-summary");
	const all = summaryRow.createEl("input", {
		type: "checkbox",
		attr: {
			"data-action": "toggle-all",
			"aria-label": t("portable.selectAll"),
		},
	});
	// The selection's two lines, one under the other, beside the select-all box.
	const lines = summaryRow.createDiv({ cls: "cs-portable-summary-text" });
	const summary = lines.createDiv({ cls: "cs-portable-summary-line" });
	const links = lines.createDiv({ cls: "cs-portable-summary-line" });
	const shell = root.createDiv({ cls: "cs-portable-results-shell" });
	const scroll = shell.createDiv({ cls: "cs-portable-results-scroll" });
	const hint = scroll.createEl("p", { cls: "cs-portable-hint" });
	const status = scroll.createDiv({
		cls: "cs-portable-review-status",
		attr: { role: "status", "aria-live": "polite" },
	});
	const retry = scroll.createEl("button", {
		text: t("portable.retry"),
		cls: "cs-portable-retry",
		attr: { "data-action": "retry" },
	});
	const results = scroll.createDiv({ cls: "cs-portable-change-list" });
	const overlay = shell.createDiv({
		cls: "cs-portable-refresh-overlay",
		attr: { role: "status", "aria-live": "polite" },
	});
	overlay.hidden = true;
	return { convert, help, summary, links, status, all, retry, hint, shell, scroll, overlay, results };
}

/**
 * What every language puts between the two halves of the selection sentence
 * ("74 of 74 replacements selected · 3 heading links to update"): a middle dot
 * with a space on each side.
 */
const SUMMARY_SEPARATOR = " · ";

/**
 * The selection sentence cut into the two lines the pane shows. A sentence
 * with no separator (only the first half, as when there are no links to
 * update) is all first line.
 */
export function splitSelectionSummary(text: string): [first: string, second: string] {
	const at = text.indexOf(SUMMARY_SEPARATOR);
	return at < 0 ? [text, ""] : [text.slice(0, at), text.slice(at + SUMMARY_SEPARATOR.length)];
}

/**
 * Paint what the plan alone decides: the summary, the Convert label and the
 * select-all box. Whether Convert can act is not here — that also depends on
 * the review being open, scanning, failed or mid-edit, so the view decides it
 * and dims the button itself (`PortableConversionView.convertBlockedReason`).
 */
export function updatePortableSelection(
	frame: PortableConversionFrame,
	plan: PortableCalloutConversionPlan | undefined,
	ready: boolean,
): void {
	// No heading link to update is no news: the summary drops that half rather than say "0".
	const [selection, links] = splitSelectionSummary(
		plan
			? t(plan.linkCount ? "portable.selectionSummary" : "portable.selectionSummaryNoLinks", {
					selected: plan.selectedIds.length,
					total: plan.changes.length,
					links: plan.linkCount,
				})
			: "",
	);
	frame.summary.setText(selection);
	frame.links.setText(links);
	frame.links.hidden = links === "";
	frame.convert.setText(t(plan?.recovery ? "portable.finishConversion" : "portable.convertSelected"));
	const selected = plan?.selectedIds.length ?? 0,
		total = plan?.changes.length ?? 0;
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
		else if (!this.visible && this.timer === undefined)
			this.timer = window.setTimeout(() => {
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
		// Obsidian's thin bar across the top of the results (finding S10-08);
		// the overlay's words are only read out (styles.css).
		this.frame.shell.toggleClass("is-loading", this.visible);
		this.frame.overlay.hidden = !this.visible;
		this.frame.overlay.setText(this.visible ? this.message() : "");
	}
}
