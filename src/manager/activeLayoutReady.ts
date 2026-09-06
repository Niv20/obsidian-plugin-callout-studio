import type { App } from "obsidian";

interface LayoutHost {
 app: App;
 settingsWriter: { readonly isDestroyed: boolean };
}

/** Obsidian queues this callback without a disposable EventRef. */
export function onActiveLayoutReady(host: LayoutHost, callback: () => void): void {
 host.app.workspace.onLayoutReady(() => {
  if (!host.settingsWriter.isDestroyed) callback();
 });
}
