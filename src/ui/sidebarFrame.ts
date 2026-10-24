/**
 * ui/sidebarFrame.ts — the top of the Find callouts and Review conversion
 * sidebars, drawn as Obsidian draws the top of its own panes (Search,
 * Backlinks, Outline).
 *
 * Who calls it. usage/CalloutOccurrencesView.ts with usage/occurrencesViewFrame.ts,
 * and portable/PortableConversionView.ts with portable/portableConversionFrame.ts.
 *
 * The main idea (finding S10-05). A pane starts with a slim row of small icon
 * buttons, Obsidian's nav header (`.nav-header > .nav-buttons-container`),
 * which sits in the view itself, above its scrolling content, exactly where
 * Obsidian's own panes put theirs; on a phone Obsidian moves it to the bottom
 * of the drawer as large touch buttons. Under it come the pane's own fields,
 * and a muted count over a single line (`.search-results-info`), as under
 * Search's field. Until 2026-10-24 each pane started with a large bold title,
 * a sentence, and a count between two lines; the title is the tab's name now
 * (its tooltip on a computer, as for Search), and the sentences went to the
 * help window and the empty state.
 */
import { setIcon } from "obsidian";

/**
 * Put Obsidian's nav header at the top of a view, outside its scrolling
 * content, and return the row its buttons go in.
 *
 * @param viewContainer The view's own `containerEl` (`.workspace-leaf-content`),
 *   not its `contentEl`: Obsidian's panes put the header there, before the
 *   content, and its phone rules expect it there.
 */
export function createSidebarNavHeader(viewContainer: HTMLElement): { header: HTMLElement; buttons: HTMLElement } {
	const header = createDiv({ cls: "nav-header" });
	viewContainer.insertBefore(header, viewContainer.firstChild);
	const buttons = header.createDiv({ cls: "nav-buttons-container" });
	return { header, buttons };
}

/**
 * One icon button in the nav header, as Obsidian's `addNavButton` makes it: a
 * `.clickable-icon.nav-action-button` whose `aria-label` is also its tooltip.
 * Obsidian's are bare divs; this one also takes a Tab stop, and Enter or
 * Space, so a keyboard can reach it.
 *
 * @param buttons The row from {@link createSidebarNavHeader}.
 * @param options The Lucide `icon`, the `label` (read out, and shown as the
 *   tooltip), and what a press does (`onPress`, given the button).
 */
export function addSidebarNavButton(buttons: HTMLElement, options: {
	icon: string;
	label: string;
	onPress: (button: HTMLElement) => void;
}): HTMLElement {
	const button = buttons.createDiv({
		cls: "clickable-icon nav-action-button",
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
