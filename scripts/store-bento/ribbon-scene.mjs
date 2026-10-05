/** Production ribbon registration inside an offline Obsidian-styled shell. */
import { installDomHelpers, setIcon } from "obsidian";
import { registerQuickInsertRibbon, registerUiIcons } from "../../src/icons/registerUiIcons.ts";
import { QUICK_INSERT_ICON_ID } from "../../src/icons/uiIcons.ts";
import { setLocale } from "../../src/i18n/index.ts";

export async function mountRibbon() {
	installDomHelpers();
	setLocale("en");
	document.body.className = "theme-dark is-desktop show-ribbon";
	const panel = document.body.createDiv({ attr: { id: "bento-ribbon" } });
	const files = panel.createDiv({ cls: "bento-files" });
	for (const width of [105, 86, 98, 116, 83]) {
		const file = files.createDiv({ cls: "bento-file" });
		const name = file.createSpan({ cls: "bento-file-name" });
		name.style.width = `${width}px`;
	}
	const ribbon = panel.createDiv({ cls: "workspace-ribbon" });
	const actions = ribbon.createDiv({ cls: "side-dock-actions" });
	let opened = false;
	const plugin = {
		register() {},
		openQuickInsert() { opened = true; },
		addRibbonIcon(id, title, callback) {
			const item = actions.createDiv({ cls: "side-dock-ribbon-action clickable-icon", attr: { "aria-label": title, "data-icon": id } });
			setIcon(item, id);
			item.addEventListener("click", callback);
			return item;
		},
	};
	registerUiIcons(plugin);
	for (const [id, name] of [["file-search", "Open quick switcher"], ["git-fork", "Open graph view"]]) plugin.addRibbonIcon(id, name, () => {});
	registerQuickInsertRibbon(plugin);
	for (const [id, name] of [["calendar", "Open today's daily note"], ["square-terminal", "Open command palette"]]) plugin.addRibbonIcon(id, name, () => {});
	const selected = actions.querySelector(`[data-icon="${QUICK_INSERT_ICON_ID}"]`);
	selected.classList.add("is-active");
	const tooltip = panel.createDiv({ cls: "tooltip mod-right", text: selected.getAttribute("aria-label") });
	// Native CSS border triangles export as rectangular border strips. Use the
	// slightly enlarged 6 × 12 left-pointing arrow as vector geometry here.
	const arrow = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	for (const [key, value] of Object.entries({ class: "tooltip-arrow", viewBox: "0 0 6 12", width: "6", height: "12", "aria-hidden": "true" })) {
		arrow.setAttribute(key, value);
	}
	const triangle = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
	triangle.setAttribute("points", "6,0 0,6 6,12");
	triangle.style.fill = "var(--background-modifier-message)";
	arrow.appendChild(triangle);
	tooltip.appendChild(arrow);
	await document.fonts.ready;
	await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
	const parentBox = panel.getBoundingClientRect();
	const selectedBox = selected.getBoundingClientRect();
	tooltip.style.top = `${selectedBox.top + selectedBox.height / 2 - parentBox.top}px`;
	globalThis.__BENTO_RIBBON_VERIFY__ = () => {
		selected.click();
		const style = getComputedStyle(ribbon);
		return { fileCount: files.children.length, fileText: files.textContent, expandedFolders: files.querySelectorAll('.is-folder[aria-expanded="true"]').length, corners: [style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomRightRadius, style.borderBottomLeftRadius], opened, count: actions.children.length, selectedIndex: [...actions.children].indexOf(selected), tooltip: tooltip.textContent };
	};
	return {
		selector: "#bento-ribbon", title: "Quick insert from the Obsidian ribbon",
		description: "The production Callout Studio ribbon registration supplies its real brush-and-plus icon and Quick insert block callout tooltip. The highlighted plugin button sits between two core Obsidian icons above and two below, with installed Obsidian ribbon and tooltip styles. The surrounding native ribbon shell and subdued abstract file rows without folder arrows are an offline documentation fixture.",
	};
}
