import type { Menu } from "obsidian";

const hideCallbacks = new WeakMap<Menu, Array<() => void>>();

/** Obsidian's onHide replaces its callback; compose independent menu owners. */
export function onMenuHide(menu: Menu, callback: () => void): void {
	const existing = hideCallbacks.get(menu);
	if (existing) {
		existing.push(callback);
		return;
	}
	const callbacks = [callback];
	hideCallbacks.set(menu, callbacks);
	menu.onHide(() => {
		hideCallbacks.delete(menu);
		for (const dispose of callbacks.splice(0)) dispose();
	});
}
