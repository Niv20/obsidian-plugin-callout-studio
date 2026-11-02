/**
 * settings/declarative/rowRegistry.ts — which element shows which settings
 * row, so the plugin can scroll to a row and flash it.
 *
 * Who calls it. Render rows register themselves while they draw; the jumps to a
 * row (from the import prompt, from "Go to version history", after Duplicate)
 * look rows up here.
 *
 * The main idea. Obsidian finds a row's element only through a private method.
 * Instead, each row the plugin may jump to registers its element under a stable
 * name while it is drawn, and its cleanup takes the entry away again. A redraw
 * runs the cleanup and then draws the row again, so the entry is always the
 * element on screen now.
 */
export class RowRegistry {
	private readonly rows = new Map<string, HTMLElement>();

	/**
	 * Note that row `id` is drawn as `el`. Returns the call that undoes it,
	 * meant to be part of the row's cleanup.
	 */
	register(id: string, el: HTMLElement): () => void {
		this.rows.set(id, el);
		return () => {
			// Only if it is still this element: a newer draw may have replaced it.
			if (this.rows.get(id) === el) this.rows.delete(id);
		};
	}

	/** The element showing row `id`, if it is on the page now. */
	get(id: string): HTMLElement | undefined {
		const el = this.rows.get(id);
		return el?.isConnected ? el : undefined;
	}
}
