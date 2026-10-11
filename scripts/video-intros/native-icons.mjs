/** Map the plugin's exact UI artwork into the finite documentation icon host. */
import { UI_ICON_CONTENT } from "../../src/icons/uiIcons.ts";

export function registerNativeUiIcons() {
	const table = globalThis.__CS_GUIDE_ICONS__;
	const tags = ["line","circle","polyline","polygon","ellipse","rect","path"];
	const attributes = [["x1","y1","x2","y2"],["cx","cy","r","fill"],["points"],["points"],["cx","cy","rx","ry"],["x","y","width","height","rx","ry"],["d","fill"]];
	for (const [id,markup] of Object.entries(UI_ICON_CONTENT)) {
		const svg = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${markup}</svg>`,"image/svg+xml");
		if (svg.querySelector("parsererror")) throw new Error(`Invalid source UI icon ${id}`);
		table[id] = [...svg.querySelectorAll(tags.join(","))].map(el => {
			const kind = tags.indexOf(el.localName);
			return [kind,...attributes[kind].map(name => el.hasAttribute(name) ? el.getAttribute(name) : undefined)];
		});
	}
}
