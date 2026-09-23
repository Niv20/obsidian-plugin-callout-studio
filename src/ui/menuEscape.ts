import { Scope } from "obsidian";
import type { App, Modal } from "obsidian";

interface MenuHost {
	app: Pick<App, "keymap" | "scope">;
	parent: Scope;
	active: Set<() => void>;
}
const hosts = new WeakMap<Node, MenuHost>();
const modalHosts = new WeakMap<Modal, () => void>();

/** Supply public keymap access for descendant menus without changing callers. */
export function registerMenuScopeHost(
	root: HTMLElement,
	app: Pick<App, "keymap" | "scope">,
	parentScope: Scope = app.scope,
): () => void {
	for (const release of hosts.get(root)?.active ?? []) release();
	const host: MenuHost = { app, parent: parentScope, active: new Set() };
	hosts.set(root, host);
	return () => {
		for (const release of host.active) release();
		if (hosts.get(root) === host) hosts.delete(root);
	};
}

/** Install only while open: popping restores the host's actual previous scope. */
export function captureMenuEscape(
	root: HTMLElement,
	isOpen: () => boolean,
	close: () => void,
): () => void {
	let host: MenuHost | undefined;
	for (let node: Node | null = root; node && !host; node = node.parentNode) host = hosts.get(node);
	if (!host || !isOpen()) return () => {};
	const owner = host;
	const scope = new Scope(owner.parent);
	scope.register([], "Escape", (ev): false | undefined => {
		if (ev.isComposing) return undefined;
		ev.preventDefault();
		ev.stopPropagation();
		close();
		return false;
	});
	owner.app.keymap.pushScope(scope);
	let active = true;
	const release = (): void => {
		if (!active) return;
		active = false;
		owner.app.keymap.popScope(scope);
		owner.active.delete(release);
	};
	owner.active.add(release);
	return release;
}

/** Modal chrome owns only the host registration; it never pushes a scope. */
export function installModalMenuScope(modal: Modal): void {
	removeModalMenuScope(modal);
	modalHosts.set(modal, registerMenuScopeHost(modal.modalEl, modal.app, modal.scope));
}

export function removeModalMenuScope(modal: Modal): void {
	modalHosts.get(modal)?.();
	modalHosts.delete(modal);
}
