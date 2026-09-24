import { getLocale, t } from "../i18n";

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
	link.createSpan({ cls: "cs-sidebar-file-count", text: ` (${options.count.toLocaleString(getLocale())})` });
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
