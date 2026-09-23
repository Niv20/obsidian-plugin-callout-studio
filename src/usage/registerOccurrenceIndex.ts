import { TFile, type Plugin, type TAbstractFile } from "obsidian";
import { getCalloutOccurrenceIndex } from "./occurrenceService";

/** No startup scan. After first use, coalesce source changes into incremental reads. */
export function registerOccurrenceIndex(plugin: Plugin): void {
	const index = getCalloutOccurrenceIndex(plugin.app);
	let timer: number | undefined;
	let observedChange = index.changeRevision;
	let retriedChange = -1;
	const refresh = (): void => {
		if (index.status === "idle" || index.status === "disposed") return;
		if (timer !== undefined) window.clearTimeout(timer);
		timer = window.setTimeout(() => {
			timer = undefined;
			const requestedChange = index.changeRevision;
			void index.ensureFresh().then(() => {
				// Joining an older pass may leave this change unapplied. Retry once
				// per source revision; new changes keep scheduling their own pass.
				if (index.status === "stale" && retriedChange !== requestedChange) {
					retriedChange = requestedChange;
					refresh();
				}
			}).catch(() => {});
		}, 150);
	};
	const unsubscribe = index.subscribe(() => {
		if (observedChange === index.changeRevision) return;
		observedChange = index.changeRevision;
		refresh();
	});
	const changed = (file: TAbstractFile): void => {
		if (file instanceof TFile) {
			if (file.extension.toLowerCase() !== "md") return;
			index.invalidate(file.path);
		} else index.invalidate(); // Folder changes may move/delete several notes.
	};
	plugin.registerEvent(plugin.app.vault.on("create", changed));
	plugin.registerEvent(plugin.app.vault.on("modify", (file) => {
		if (file instanceof TFile && file.extension.toLowerCase() === "md") index.invalidateEditor(file.path);
	}));
	plugin.registerEvent(plugin.app.vault.on("delete", changed));
	plugin.registerEvent(plugin.app.vault.on("rename", (file, oldPath) => {
		if (file instanceof TFile) {
			if (oldPath.toLowerCase().endsWith(".md")) index.invalidate(oldPath);
			changed(file);
		} else index.invalidate();
	}));
	plugin.registerEvent(plugin.app.workspace.on("editor-change", (editor, info) => {
		if (info.file?.extension.toLowerCase() === "md") index.trackEditorChange(info.file, editor);
	}));
	plugin.registerEvent(plugin.app.workspace.on("file-open", () => index.editorsChanged()));
	plugin.registerEvent(plugin.app.workspace.on("layout-change", () => index.editorsChanged()));
	plugin.register(() => {
		if (timer !== undefined) window.clearTimeout(timer);
		unsubscribe();
		index.dispose();
	});
}
