import { TFile, type App, type EventRef, type TAbstractFile } from "obsidian";

/** Subscribe only for the lifetime of an open review; no background polling. */
export class PortableConversionWatch {
	private vaultRefs: EventRef[] = [];
	private editorRef?: EventRef;
	constructor(private readonly app: App, private readonly register: (ref: EventRef) => void,
		private readonly invalidate: (path?: string, oldPath?: string) => void) {}
	open(): void {
		this.close();
		const changed = (file: TAbstractFile, oldPath?: string): void => {
			if (!(file instanceof TFile)) this.invalidate();
			else if (file.extension.toLowerCase() === "md" || oldPath?.toLowerCase().endsWith(".md")) this.invalidate(file.path, oldPath);
		};
		this.vaultRefs = [this.registerEvent(this.app.vault.on("create", changed)),
			this.registerEvent(this.app.vault.on("modify", changed)),
			this.registerEvent(this.app.vault.on("delete", changed)),
			this.registerEvent(this.app.vault.on("rename", changed))];
		this.editorRef = this.app.workspace.on("editor-change", (_editor, info) => this.invalidate(info.file?.path));
		this.register(this.editorRef);
	}
	private registerEvent(ref: EventRef): EventRef {
		this.register(ref);
		return ref;
	}
	close(): void {
		for (const ref of this.vaultRefs) this.app.vault.offref(ref);
		this.vaultRefs = [];
		if (this.editorRef) this.app.workspace.offref(this.editorRef);
		this.editorRef = undefined;
	}
}
