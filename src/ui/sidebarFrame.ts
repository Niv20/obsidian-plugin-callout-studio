/**
 * ui/sidebarFrame.ts — the top of the Find callouts and Review conversion
 * sidebars, drawn as Obsidian draws the top of its own panes (Search,
 * Backlinks, Outline).
 *
 * Who calls it. usage/occurrencesViewFrame.ts for Find callouts, and
 * portable/portableConversionFrame.ts for Review conversion.
 *
 * The main idea (finding S10-05). A pane starts with its own fields, and a
 * muted count over a single line (`.search-results-info`), as under Search's
 * field. Each pane has one small icon button, which sits at the end of the
 * pane's first row, beside what it belongs to: the help button beside Convert
 * selected, the format filter beside the type field. Until 2026-10-27 the
 * button had a row of its own above the fields (Obsidian's nav header, the
 * slim row of icon buttons a pane of its own starts with), which was a whole
 * row for one icon. Until 2026-10-24 each pane started with a large bold
 * title, a sentence, and a count between two lines; the title is the tab's
 * name now (its tooltip on a computer, as for Search), and the sentences went
 * to the help window and the empty state.
 */
import { setIcon } from "obsidian";

/**
 * One small icon button, as Obsidian's icon buttons are: a `.clickable-icon`
 * whose `aria-label` is also its tooltip. Obsidian's are bare divs; this one
 * also takes a Tab stop, and Enter or Space, so a keyboard can reach it.
 *
 * @param parent The row the button goes at the end of.
 * @param options The Lucide `icon`, the `label` (read out, and shown as the
 *   tooltip), and what a press does (`onPress`, given the button).
 */
export function addSidebarIconButton(parent: HTMLElement, options: {
	icon: string;
	label: string;
	onPress: (button: HTMLElement) => void;
}): HTMLElement {
	const button = parent.createDiv({
		cls: "clickable-icon cs-sidebar-icon-button",
		attr: { "aria-label": options.label, role: "button", tabindex: "0" },
	});
	setIcon(button, options.icon);
	button.addEventListener("click", () => options.onPress(button));
	button.addEventListener("keydown", (evt) => {
		if (evt.key !== "Enter" && evt.key !== " ") return;
		// Claimed, so Space does not also scroll the pane.
		evt.preventDefault();
		options.onPress(button);
	});
	return button;
}

/** The part of a pane's top that stays put above its scrolling results. */
export function createSidebarToolbar(root: HTMLElement): HTMLElement {
	return root.createDiv({ cls: "cs-sidebar-toolbar" });
}

/**
 * The muted count over a single line, Obsidian's `.search-results-info` (the
 * line under Search's field). The returned element is the count itself,
 * a live region, so a screen reader hears it change.
 */
export function createSidebarSummary(toolbar: HTMLElement, cls: string): HTMLElement {
	const info = toolbar.createDiv({ cls: "search-results-info cs-sidebar-summary-row" });
	const summary = info.createDiv({
		cls: "search-results-result-count",
		attr: { role: "status", "aria-live": "polite" },
	});
	summary.addClass(cls);
	return summary;
}
