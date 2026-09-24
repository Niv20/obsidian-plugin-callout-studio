import assert from "node:assert/strict";
import { setTimeout as scheduleTimer, clearTimeout as cancelTimer } from "node:timers";
import { MarkdownView, type EditorPosition, type TFile, type WorkspaceLeaf } from "obsidian";
import { PortableConversionView } from "../../src/portable/PortableConversionView";
import { ConfirmModal } from "../../src/utils/ConfirmModal";
import { FakeElement, installFakeDom } from "./fakeDom";
import { portableVault } from "./portableVaultHarness";

const dom = installFakeDom();
dom.window.setTimeout = (callback, delay) => Number(scheduleTimer(callback, delay));
dom.window.clearTimeout = (id) => cancelTimer(id);

function eventBus() {
	type Listener = (...args: unknown[]) => void;
	const refs = new Map<object, { name: string; listener: Listener }>();
	return {
		on: (name: string, listener: Listener) => { const ref = {}; refs.set(ref, { name, listener }); return ref; },
		offref: (ref: object) => { refs.delete(ref); },
		emit: (name: string, ...args: unknown[]) => { for (const row of refs.values()) if (row.name === name) row.listener(...args); },
		count: () => refs.size,
	};
}

export function portableConversionViewHarness(notes: Record<string, string> = { "a.md": "# [!note] Heading\nA [!tip]{word}." }, busyDelayMs = 600) {
	const h = portableVault(notes);
	const vaultEvents = eventBus(), workspaceEvents = eventBus();
	Object.assign(h.app.vault, vaultEvents);
	Object.assign(h.app.workspace, workspaceEvents);
	const mainRoot = {};
	const selections: Array<[EditorPosition, EditorPosition | undefined]> = [];
	const opened: string[] = [];
	let recent: WorkspaceLeaf | null = null;
	let liveText: string | undefined;
	const documentView = new MarkdownView({} as WorkspaceLeaf);
	Object.assign(documentView, { editor: {
		getValue: () => liveText ?? h.contents.get(documentView.file!.path)!,
		setSelection: (from: EditorPosition, to?: EditorPosition) => selections.push([from, to]),
		scrollIntoView: () => {}, focus: () => {},
	} });
	const documentLeaf = {
		view: documentView, getRoot: () => mainRoot,
		openFile: async (file: TFile) => {
			documentView.file = file; recent = documentLeaf as unknown as WorkspaceLeaf;
			opened.push(file.path);
			if (!h.leaves.includes(documentLeaf)) h.leaves.push(documentLeaf);
			workspaceEvents.emit("file-open", file);
			workspaceEvents.emit("active-leaf-change", documentLeaf);
		}, loadIfDeferred: async () => {}, setEphemeralState: () => {},
	};
	Object.assign(h.app.workspace, {
		rootSplit: mainRoot, getMostRecentLeaf: () => recent,
		getActiveViewOfType: () => recent?.view ?? null,
		getLeaf: () => documentLeaf,
	});
	const view = new PortableConversionView({ app: h.app } as unknown as WorkspaceLeaf, 1, busyDelayMs);
	const root = view.contentEl as unknown as FakeElement;
	dom.document.body.appendChild(root);
	const actions = view as unknown as {
		scan(): Promise<void>; convert(): Promise<void>; scanning: boolean; timer?: number;
	};
	const tasks: Promise<void>[] = [];
	for (const method of ["scan", "convert"] as const) {
		const run = actions[method].bind(view);
		actions[method] = () => { const task = run(); tasks.push(task); return task; };
	}
	const confirmations: ConfirmModal[] = [];
	const hooks = Object.assign(h.hooks, { confirm: async (): Promise<boolean> => false });
	const originalConfirm = Object.getOwnPropertyDescriptor(ConfirmModal.prototype, "confirm")!;
	ConfirmModal.prototype.confirm = function () { confirmations.push(this); return hooks.confirm(); };
	const button = (action: string): FakeElement & { hidden: boolean } => {
		const found = root.querySelector(`button[data-action="${action}"]`);
		assert.ok(found, action);
		return found as FakeElement & { hidden: boolean };
	};
	const inputs = (): (FakeElement & { checked: boolean })[] =>
		root.querySelectorAll("input[data-change-id]") as (FakeElement & { checked: boolean })[];
	const click = (action: string): void => { root.fire("click", { target: button(action) }); };
	const choose = (index: number, checked: boolean): void => {
		const input = inputs()[index]; assert.ok(input);
		Object.assign(input, { checked });
		root.fire("change", { target: input });
	};
	return { ...h, view, root, hooks, opened, selections, documentView, documentLeaf,
		setLiveText: (value: string | undefined) => { liveText = value; }, confirmations, tasks, vaultEvents, workspaceEvents, actions, inputs, button, click, choose,
		status: () => root.querySelector(".cs-portable-review-status")!.textContent,
		settle: async () => {
			for (let i = 0; i < 50; i++) {
				await new Promise(resolve => scheduleTimer(resolve, 3));
				if (!actions.scanning && actions.timer === undefined) return;
			}
			throw new Error("Sidebar did not settle");
		},
		destroy: async () => { await view.onClose(); view.unload(); root.remove(); Object.defineProperty(ConfirmModal.prototype, "confirm", originalConfirm); },
	};
}
