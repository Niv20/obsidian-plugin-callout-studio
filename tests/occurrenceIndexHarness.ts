import { TFile, type App } from "obsidian";

export function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason: Error) => void;
	const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
	return { promise, resolve, reject };
}

export function occurrenceVault(initial: Record<string, string>) {
	const files = new Map<string, TFile>();
	const contents = new Map<string, string>();
	const reads: string[] = [];
	const failures = new Set<string>();
	const held = new Map<string, Promise<string>>();
	let clock = 0;
	function put(path: string, content: string) {
		const file = files.get(path) ?? Object.assign(new TFile(), { path });
		file.stat = { mtime: ++clock, ctime: 1, size: content.length };
		files.set(path, file);
		contents.set(path, content);
		return file;
	}
	function remove(path: string) { files.delete(path); contents.delete(path); }
	function rename(from: string, to: string) {
		const file = files.get(from)!;
		const content = contents.get(from)!;
		remove(from);
		file.path = to;
		files.set(to, file);
		contents.set(to, content);
	}
	for (const [path, content] of Object.entries(initial)) put(path, content);
	const app = { vault: {
		getMarkdownFiles: () => [...files.values()],
		getAbstractFileByPath: (path: string) => files.get(path) ?? null,
		cachedRead: async (file: TFile) => {
			reads.push(file.path);
			if (failures.has(file.path)) throw new Error("Unreadable file");
			return held.get(file.path) ?? contents.get(file.path)!;
		},
	} } as unknown as App;
	return { app, files, contents, reads, failures, held, put, remove, rename };
}
