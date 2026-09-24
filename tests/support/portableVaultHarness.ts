import { MarkdownView, TFile, type App, type WorkspaceLeaf } from "obsidian";

/** In-memory note storage: no test in this harness accesses a real vault. */
export function portableVault(notes: Record<string, string>) {
	const contents = new Map<string, string>();
	const handles = new Map<string, TFile>();
	const leaves: { view: MarkdownView }[] = [];
	const reads: string[] = [];
	const processes: string[] = [];
	const written: string[] = [];
	const hooks: {
		beforeRead?: (path: string) => void | Promise<void>;
		afterRead?: (path: string) => void | Promise<void>;
		beforeProcess?: (path: string) => void | Promise<void>;
		afterProcess?: (path: string) => void | Promise<void>;
	} = {};
	function add(path: string, source: string): void {
		handles.set(path, Object.assign(new TFile(), {
			path, extension: path.split(".").pop(), stat: { mtime: 1, ctime: 1, size: source.length },
		}));
		contents.set(path, source);
	}
	function edit(path: string, source: string, touch = true): void {
		contents.set(path, source);
		if (touch) {
			const file = handles.get(path)!;
			file.stat.mtime++;
			file.stat.size = source.length;
		}
	}
	function open(path: string, source = contents.get(path)!): { text: string } {
		const state = { text: source };
		leaves.push({ view: Object.assign(new MarkdownView({} as WorkspaceLeaf), {
			file: handles.get(path), editor: { getValue: () => state.text },
		}) });
		return state;
	}
	function remove(path: string): void { handles.delete(path); contents.delete(path); }
	function rename(from: string, to: string): void {
		const file = handles.get(from)!;
		const source = contents.get(from)!;
		remove(from);
		file.path = to;
		handles.set(to, file);
		contents.set(to, source);
	}
	for (const [path, source] of Object.entries(notes)) add(path, source);
	const app = {
		workspace: { getLeavesOfType: () => leaves },
		metadataCache: {
			getFirstLinkpathDest: (linkpath: string, sourcePath: string) => {
				const path = linkpath.endsWith(".md") ? linkpath : `${linkpath}.md`;
				const folder = sourcePath.slice(0, sourcePath.lastIndexOf("/") + 1);
				return handles.get(path) ?? handles.get(folder + path) ?? null;
			},
		},
		vault: {
			getMarkdownFiles: () => [...handles.values()].filter((file) => file.extension === "md"),
			getAbstractFileByPath: (path: string) => handles.get(path) ?? null,
			read: async (file: TFile) => {
				reads.push(file.path);
				await hooks.beforeRead?.(file.path);
				if (!contents.has(file.path)) throw new Error("Missing note");
				const source = contents.get(file.path)!;
				await hooks.afterRead?.(file.path);
				return source;
			},
			cachedRead: () => { throw new Error("Conversion must not use cached reads"); },
			modify: () => { throw new Error("Conversion must not bypass atomic process"); },
			process: async (file: TFile, transform: (source: string) => string) => {
				processes.push(file.path);
				await hooks.beforeProcess?.(file.path);
				if (!contents.has(file.path)) throw new Error("Missing note");
				const converted = transform(contents.get(file.path)!);
				edit(file.path, converted);
				written.push(file.path);
				await hooks.afterProcess?.(file.path);
				return converted;
			},
		},
	} as unknown as App;
	return { app, contents, handles, leaves, reads, processes, written, hooks, add, edit, open, remove, rename };
}

export function deferred(): { promise: Promise<void>; resolve: () => void } {
	let resolve!: () => void;
	const promise = new Promise<void>((done) => { resolve = done; });
	return { promise, resolve };
}
