import { MarkdownView, type App, type Editor, type TFile } from "obsidian";

/** Select open editor sources without reading buffers on layout changes. */
export function openOccurrenceEditors(app: App, recent: Map<TFile, Editor>): Map<TFile, Editor> {
	const sources = new Map<TFile, Editor>();
	const workspace = app.workspace;
	if (!workspace || typeof workspace.getLeavesOfType !== "function") return sources;
	const active = typeof workspace.getActiveViewOfType === "function"
		? workspace.getActiveViewOfType(MarkdownView) : null;
	const editors = new Map<TFile, Editor[]>();
	for (const leaf of workspace.getLeavesOfType("markdown")) {
		const view = leaf.view;
		if (view instanceof MarkdownView && view.file?.extension.toLowerCase() === "md" && view.editor) {
			const candidates = editors.get(view.file) ?? [];
			candidates.push(view.editor); editors.set(view.file, candidates);
		}
	}
	for (const [file, candidates] of editors) {
		const latest = recent.get(file);
		if (latest && !candidates.includes(latest)) recent.delete(file);
		const preferred = latest && candidates.includes(latest) ? latest
			: active?.file === file && candidates.includes(active.editor) ? active.editor : candidates[candidates.length - 1]!;
		sources.set(file, preferred);
	}
	for (const file of recent.keys()) if (!editors.has(file)) recent.delete(file);
	return sources;
}
