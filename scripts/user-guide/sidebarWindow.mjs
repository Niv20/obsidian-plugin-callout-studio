/**
 * The picture of a sidebar view: the slice of Obsidian's window it lives in.
 * A sidebar is narrow beside a note, so the view is drawn at its own width in
 * the right sidebar, under the row of tab icons Obsidian puts there, and the
 * rest of the window is the open note: placeholder text, cut off by the
 * window's left edge. The window is a card in the picture's frame, as a modal is. The page's CSS (`.guide-window`, in render-user-guide.mjs)
 * lays it out; the sidebar's own classes are Obsidian's, so its stylesheet draws
 * the tabs.
 */
import { setIcon } from "obsidian";
import { UI_ICON_CONTENT } from "../../src/icons/uiIcons.ts";

/** The tabs Obsidian's right sidebar opens with, before the view that is pictured. */
const NEIGHBOUR_TABS = ["links-coming-in", "links-going-out", "lucide-tag", "lucide-list"];

/** Widths of the placeholder lines, in px from the window's left edge, ending short of the sidebar: a paragraph is a run of them. */
const PARAGRAPHS = [
	[252, 267, 240, 148],
	[262, 227, 265, 245, 108],
	[244, 267, 205],
	[259, 237, 267, 252, 180],
	[265, 232, 126],
	[249, 267, 259, 220],
];

const NS = "http://www.w3.org/2000/svg";

/**
 * A tab's icon. The plugin's own icons are registered with Obsidian on a 100px
 * canvas (`registerUiIcons`), and are drawn from that here; the rest are
 * Obsidian's.
 */
function tabIcon(parent, id) {
	const content = UI_ICON_CONTENT[id];
	if (!content) return setIcon(parent, id);
	const svg = document.createElementNS(NS, "svg");
	for (const [key, value] of Object.entries({ xmlns: NS, viewBox: "0 0 100 100", width: "100", height: "100", class: `svg-icon ${id}` })) svg.setAttribute(key, value);
	svg.innerHTML = `<g transform="scale(${100 / 24})">${content}</g>`;
	parent.replaceChildren(svg);
}

/** The open note: no words, only lines, the first of each reaching back past the edge. */
function drawNote(clip) {
	const note = clip.createDiv({ cls: "guide-window-note" });
	note.createDiv({ cls: "guide-window-note-header" });
	const text = note.createDiv({ cls: "guide-window-text" });
	text.createDiv({ cls: "guide-window-line is-heading" }).style.width = "148px";
	for (const lines of PARAGRAPHS.concat(PARAGRAPHS)) {
		lines.forEach((width, index) => {
			const line = text.createDiv({ cls: `guide-window-line${index === lines.length - 1 ? " is-last" : ""}` });
			line.style.width = `${width}px`;
		});
	}
}

/**
 * Draw the picture and return the view's content element, which the scene fills.
 * `icon` is the pictured view's own tab icon, the one selected.
 */
export function sidebarWindow({ cls, icon, label, height }) {
	const frame = document.body.createDiv({ cls: "guide-window", attr: { id: "guide-scene" } });
	frame.style.height = `${height}px`;
	// The card's border is the frame's; the clip inside it rounds what it holds.
	const clip = frame.createDiv({ cls: "guide-window-clip" });
	drawNote(clip);
	// Obsidian's right sidebar: `mod-sidedock`, and `mod-secondary-split` as the second side.
	const split = clip.createDiv({ cls: "workspace-split mod-vertical mod-sidedock mod-right-split mod-secondary-split" });
	const tabs = split.createDiv({ cls: "workspace-tabs" });
	const header = tabs.createDiv({ cls: "workspace-tab-header-container" });
	const row = header.createDiv({ cls: "workspace-tab-header-container-inner", attr: { role: "tablist" } });
	for (const [id, active] of [...NEIGHBOUR_TABS.map(id => [id, false]), [icon, true]]) {
		const tab = row.createDiv({ cls: `workspace-tab-header tappable${active ? " is-active mod-active" : ""}`, attr: active ? { "aria-label": label } : {} });
		const inner = tab.createDiv({ cls: "workspace-tab-header-inner" });
		tabIcon(inner.createDiv({ cls: "workspace-tab-header-inner-icon" }), id);
		inner.createDiv({ cls: "workspace-tab-header-inner-title" });
		inner.createDiv({ cls: "workspace-tab-header-status-container" });
		setIcon(inner.createDiv({ cls: "workspace-tab-header-inner-close-button" }), "lucide-x");
	}
	// The spacer pushes the collapse button to the sidebar's outer edge.
	header.createDiv({ cls: "workspace-tab-header-spacer" });
	setIcon(header.createDiv({ cls: "sidebar-toggle-button mod-right" }).createDiv({ cls: "clickable-icon" }), "sidebar-toggle-button-icon");
	const leaf = tabs.createDiv({ cls: "workspace-tab-container" }).createDiv({ cls: "workspace-leaf" });
	const content = leaf.createDiv({ cls: "workspace-leaf-content" });
	return content.createDiv({ cls: `view-content ${cls}` });
}
