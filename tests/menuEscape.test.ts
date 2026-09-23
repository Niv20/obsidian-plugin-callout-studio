import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App, Modal } from "obsidian";
import { captureMenuEscape, installModalMenuScope, registerMenuScopeHost, removeModalMenuScope } from "../src/ui/menuEscape";
import { asEl, FakeDocument } from "./support/fakeDom";
import { TestKeymap, TestScope } from "./support/fakeKeymap";

function mount(keymap = new TestKeymap()) {
	const doc = new FakeDocument();
	const modalEl = doc.createElement("div");
	const root = modalEl.createDiv();
	const input = root.createEl("input");
	const scope = new TestScope();
	let modalCloses = 0;
	scope.register([], "Escape", () => { modalCloses++; return false; });
	keymap.pushScope(scope);
	const modal = { modalEl, app: { keymap }, scope } as unknown as Modal;
	installModalMenuScope(modal);
	let open = true;
	let menuCloses = 0;
	let unregister = (): void => {};
	const reopen = (): void => {
		open = true;
		unregister = captureMenuEscape(asEl(root), () => open, () => {
			open = false;
			menuCloses++;
			unregister();
		});
	};
	reopen();
	return {
		modal, input, modalEl, keymap, doc, scope, reopen, unregister: () => unregister(),
		menuCloses: () => menuCloses,
		modalCloses: () => modalCloses,
		press: (target: unknown = input, additions: Partial<KeyboardEvent> = {}) => {
			let prevented = false;
			let stopped = false;
			keymap.handle({
				key: "Escape", target, ...additions,
				preventDefault: () => { prevented = true; },
				stopPropagation: () => { stopped = true; },
			} as KeyboardEvent);
			return { prevented, stopped };
		},
		dispose: () => { unregister(); removeModalMenuScope(modal); keymap.popScope(scope); },
	};
}

describe("popup Escape within Obsidian's keymap", () => {
	it("consumes an open menu before the modal's Escape and inherits modal Escape after closing", () => {
		const h = mount();
		try {
			assert.deepEqual(h.press(), { prevented: true, stopped: true });
			assert.equal(h.menuCloses(), 1);
			assert.equal(h.modalCloses(), 0);
			h.press();
			assert.equal(h.menuCloses(), 1);
			assert.equal(h.modalCloses(), 1);
		} finally { h.dispose(); }
	});

	it("does not consume other keys, shortcuts, or IME input", () => {
		const h = mount();
		try {
			for (const additions of [{ key: "Enter" }, { ctrlKey: true }, { metaKey: true }, { altKey: true }, { isComposing: true }])
				assert.deepEqual(h.press(h.input, additions), { prevented: false, stopped: false });
			assert.equal(h.menuCloses(), 0);
		} finally { h.dispose(); }
	});

	it("reinstalls without duplicate scopes and removes the child scope on close", () => {
		const h = mount();
		assert.equal(h.keymap.scopes.length, 2);
		installModalMenuScope(h.modal);
		assert.equal(h.keymap.scopes.length, 1, "replacing the host releases its open menu scope");
		h.reopen();
		assert.equal(h.keymap.scopes.length, 2);
		h.dispose();
		assert.equal(h.keymap.scopes.length, 0);
		assert.deepEqual(h.press(), { prevented: false, stopped: false });
		assert.equal(h.menuCloses(), 0);
	});

	it("stops handling destroyed menus while preserving the modal binding", () => {
		const h = mount();
		try {
			h.unregister();
			h.press();
			assert.equal(h.menuCloses(), 0);
			assert.equal(h.modalCloses(), 1);
		} finally { h.dispose(); }
	});

	it("keeps stacked modal scopes isolated and restores the underlying modal on dismissal", () => {
		const lower = mount();
		const upper = mount(lower.keymap);
		try {
			upper.press();
			assert.equal(upper.menuCloses(), 1);
			assert.equal(lower.menuCloses(), 0);
			upper.dispose();
			lower.press();
			assert.equal(lower.menuCloses(), 1);
			assert.equal(lower.modalCloses(), 0);
		} finally { upper.dispose(); lower.dispose(); }
	});

	it("restores the actual Settings scope even when the popup inherits the public app scope", () => {
		const doc = new FakeDocument();
		const root = doc.createElement("div");
		const input = root.createEl("input");
		const appScope = new TestScope();
		const settingsScope = new TestScope(appScope);
		const keymap = new TestKeymap();
		let settingsCloses = 0;
		settingsScope.register([], "Escape", () => { settingsCloses++; return false; });
		keymap.pushScope(settingsScope);
		const app = { scope: appScope, keymap } as unknown as App;
		const unregisterHost = registerMenuScopeHost(asEl(root), app);
		let open = true;
		const releaseMenu = captureMenuEscape(asEl(root), () => open, () => { open = false; releaseMenu(); });
		const event = { key: "Escape", target: input, preventDefault() {}, stopPropagation() {} } as unknown as KeyboardEvent;
		keymap.handle(event);
		assert.equal(open, false);
		assert.equal(settingsCloses, 0);
		assert.deepEqual(keymap.scopes, [settingsScope]);
		keymap.handle(event);
		assert.equal(settingsCloses, 1);
		unregisterHost();
	});
});
