import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_SETTINGS } from "../src/constants";
import { getSource, ICON_SOURCE_IDS } from "../src/icons/registry";
import type { IconIndex } from "../src/icons/types";
import { IconPicker, type IconPickerPlugin } from "../src/settings/iconpicker/IconPickerModal";
import type { IconSourceId } from "../src/types";
import { fakeDom } from "./support/fakeDom";
import { TestKeymap, TestScope } from "./support/fakeKeymap";

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => { resolve = done; });
	return { promise, resolve };
}

const emptyIndex: IconIndex = { entries: [], categories: [] };

function harness(
	loadDisk: () => Promise<void>,
	loadIndex: (id: IconSourceId) => Promise<IconIndex> = async () => emptyIndex,
) {
	fakeDom.light();
	const originals = ICON_SOURCE_IDS.map((id) => {
		const pack = getSource(id);
		const descriptor = Object.getOwnPropertyDescriptor(pack, "loadIndex")!;
		pack.loadIndex = () => loadIndex(id);
		return { pack, descriptor };
	});
	const plugin = {
		app: { keymap: new TestKeymap(), scope: new TestScope() }, settings: structuredClone(DEFAULT_SETTINGS),
		registry: { getUserImages: () => [], getAll: () => [] },
		icons: { packs: { loadAllFromDisk: loadDisk, onChange: () => () => {}, state: () => "missing" } },
	} as unknown as IconPickerPlugin;
	const modal = new IconPicker(plugin, { type: "lucide", value: "star" });
	const containerEl = fakeDom.document.body.createDiv({ cls: "modal-container" });
	const modalEl = containerEl.createDiv({ cls: "modal" });
	const titleEl = modalEl.createDiv({ cls: "modal-title" });
	const contentEl = modalEl.createDiv({ cls: "modal-content" });
	Object.assign(modal, { containerEl, modalEl, titleEl, contentEl, app: plugin.app, scope: plugin.app.scope });
	const tasks: Promise<void>[] = [];
	const startup = modal as unknown as {
		openInitialPanel(generation: number): Promise<void>;
		loadSourceCounts(generation: number): Promise<void>;
	};
	for (const method of ["openInitialPanel", "loadSourceCounts"] as const) {
		const run = startup[method].bind(modal);
		startup[method] = (generation) => {
			const task = run(generation);
			tasks.push(task);
			return task;
		};
	}
	const listenerCount = () => fakeDom.document.listeners.get("click")?.length ?? 0;
	const beforeListeners = listenerCount();
	return {
		modal, contentEl, tasks, listenerCount, beforeListeners,
		destroy: () => {
			modal.onClose();
			containerEl.remove();
			for (const { pack, descriptor } of originals) Object.defineProperty(pack, "loadIndex", descriptor);
		},
	};
}

describe("icon picker asynchronous lifecycle", () => {
	it("does not create toolbar listeners after closing during disk loading", async () => {
		const disk = deferred<void>();
		const h = harness(() => disk.promise);
		try {
			h.modal.onOpen();
			assert.equal(h.listenerCount(), h.beforeListeners + 1);
			h.modal.onClose();
			disk.resolve();
			await Promise.all(h.tasks);
			assert.equal(h.contentEl.children.length, 0);
			assert.equal(h.listenerCount(), h.beforeListeners);
		} finally { h.destroy(); }
	});

	it("keeps the reopened panel when an older disk load finishes", async () => {
		const disk = deferred<void>();
		let loads = 0;
		const h = harness(() => ++loads === 1 ? disk.promise : Promise.resolve());
		try {
			h.modal.onOpen();
			h.modal.onClose();
			h.modal.onOpen();
			await Promise.all(h.tasks.slice(2));
			const search = h.contentEl.querySelector(".icon-picker-search-input");
			assert.ok(search);
			assert.equal(h.contentEl.children.length, 1);
			const listeners = h.listenerCount();
			disk.resolve();
			await Promise.all(h.tasks);
			assert.equal(h.contentEl.querySelector(".icon-picker-search-input"), search);
			assert.equal(h.listenerCount(), listeners);
		} finally { h.destroy(); }
		assert.equal(h.listenerCount(), h.beforeListeners);
	});

	it("does not overwrite reopened source counts with a previous open's late result", async () => {
		const index = deferred<IconIndex>();
		let lucideLoads = 0;
		const currentIndex: IconIndex = {
			entries: Array.from({ length: 42 }, (_, i) => ({ name: `icon-${i}`, categories: [], keywords: [] })), categories: [],
		};
		const h = harness(async () => {}, (id) => {
			if (id !== "lucide") return Promise.resolve(emptyIndex);
			lucideLoads++;
			return lucideLoads === 1 ? index.promise
				: Promise.resolve(lucideLoads === 2 ? currentIndex : emptyIndex);
		});
		try {
			h.modal.onOpen();
			h.modal.onClose();
			h.modal.onOpen();
			await Promise.all(h.tasks.slice(2));
			const input = h.contentEl.querySelector(".icon-picker-source-dropdown .cs-combobox-input");
			assert.ok(input);
			input.fire("keydown", { key: "ArrowDown", preventDefault: () => {}, stopPropagation: () => {} });
			const row = h.contentEl.querySelectorAll(".icon-picker-source-menu-item")[1];
			assert.match(row?.textContent ?? "", /42/);
			index.resolve(emptyIndex);
			await Promise.all(h.tasks);
			assert.equal(h.contentEl.querySelectorAll(".icon-picker-source-menu-item")[1], row,
				"an old count task must not repaint the current source menu");
		} finally { h.destroy(); }
	});
});
