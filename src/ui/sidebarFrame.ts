/** The same fixed header and result count presentation for both vault sidebars. */
export function createSidebarToolbar(root: HTMLElement, title: string, subtitle: string): HTMLElement {
	const toolbar = root.createDiv({ cls: "cs-sidebar-toolbar" });
	toolbar.createEl("h2", { cls: "cs-sidebar-title", text: title });
	toolbar.createEl("p", { cls: "cs-sidebar-subtitle", text: subtitle });
	return toolbar;
}

export function createSidebarSummary(toolbar: HTMLElement, cls: string): HTMLElement {
	const summary = toolbar.createDiv({ cls: "cs-sidebar-summary", attr: { role: "status", "aria-live": "polite" } });
	summary.addClass(cls);
	return summary;
}
