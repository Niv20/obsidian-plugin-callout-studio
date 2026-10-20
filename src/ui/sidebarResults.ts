import { t } from "../i18n";
import { appendHeadingCount } from "./headingCount";
import { scrollToReveal } from "./scrollToReveal";

/** Air between a revealed card and the sticky file heading above it, or the list's bottom: the grid's own gap. */
const CARD_REVEAL_GAP_PX = 8;

/** Shared, full-width file heading and row-major card grid for both result panes. */
export function createSidebarFileGroup(host: HTMLElement, options: {
	path: string;
	count: number;
	cls?: string;
}): { section: HTMLElement; heading: HTMLHeadingElement; grid: HTMLElement } {
	const section = host.createEl("section", { cls: "cs-sidebar-file" });
	if (options.cls) section.addClass(options.cls);
	section.dataset.path = options.path;
	const heading = section.createEl("h3", { cls: "cs-sidebar-file-heading" });
	const link = heading.createEl("button", { cls: "cs-sidebar-file-link", attr: {
		type: "button", "data-action": "file", "data-path": options.path,
	} });
	link.createSpan({ cls: "cs-sidebar-file-name", text: options.path });
	appendHeadingCount(link, options.count);
	const grid = section.createDiv({ cls: "cs-sidebar-grid" });
	return { section, heading, grid };
}

/** The file name belongs to its group; each card shows just its kind and line. */
export function renderSidebarLocation(host: HTMLElement, options: {
	role: string;
	/** One-based Markdown source line. */
	line: number;
	cls?: string;
}): HTMLElement {
	const location = host.createSpan({ cls: "cs-sidebar-location", text: t("usage.location", options) });
	if (options.cls) location.addClass(options.cls);
	return location;
}

/**
 * Scroll the list only as far as it takes to show a card the caret moved into;
 * focus never moves. The card's file heading sticks to the top of the list
 * and hides what scrolls under it, so a card is only in view below that heading.
 */
export function revealSidebarCard(scroller: HTMLElement | null, card: HTMLElement): void {
	// A hidden sidebar tab lays out at zero height; there is nothing to scroll.
	if (!scroller || scroller.clientHeight === 0) return;
	const heading = card.closest(".cs-sidebar-file")?.querySelector<HTMLElement>(".cs-sidebar-file-heading");
	scrollToReveal(scroller, card, CARD_REVEAL_GAP_PX, heading?.offsetHeight ?? 0);
}
