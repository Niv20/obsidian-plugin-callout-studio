/**
 * settings/declarative/persistentParts.ts — the pieces of the settings page
 * that must survive a redraw.
 *
 * Who calls it. The render rows that hold state of their own: the "Saving is
 * paused" banner (which may be in the middle of a restore), the style pages'
 * live preview (which someone may be typing in), and the like.
 *
 * The main idea. Obsidian redraws a settings row by running its cleanup,
 * emptying its controls and drawing it again (docs/internals-docs/26-declarative-settings.md).
 * A part built inside `render` would be built anew on every redraw and lose
 * what it was doing. So such a part is built once, kept here by name, and each
 * redraw puts the same element back into the row ({@link PersistentParts.mount}).
 *
 * A row's cleanup cannot tell a redraw (the row comes straight back) from the
 * user leaving the page (it does not). So the cleanup calls
 * {@link PersistentParts.releaseLater}: a moment later, a part whose element is
 * back on the page is kept, and one whose element is not is disposed. Leaving
 * the settings disposes everything ({@link PersistentParts.disposeAll}).
 */

/** One part: its element, and how to undo everything it set up. */
export interface PersistentPart {
	el: HTMLElement;
	dispose(): void;
}

/**
 * How long a released part waits before it is checked. Longer than Obsidian's
 * 150ms page slide, so a part on the page sliding in is already back.
 */
const RELEASE_DELAY_MS = 300;

/** Starts a delayed check; tests pass one that runs when they say so. */
export type Later = (run: () => void) => void;

export class PersistentParts {
	private readonly parts = new Map<string, PersistentPart>();

	/** @param later How to wait before checking a released part. */
	constructor(
		private readonly later: Later = (run) => {
			window.setTimeout(run, RELEASE_DELAY_MS);
		},
	) {}

	/**
	 * Put the part named `id` into `parent` and return it. The first call
	 * builds it with `create`, which builds it straight into `parent` (an
	 * editor in it is then made on the page, as it expects) or anywhere else,
	 * and returns it; later calls put the same element back, moving
	 * it only if it is not already there. (Obsidian's redraw empties a row's
	 * controls, but not what is beside them: a part kept there never moves,
	 * so an editor in it keeps its focus.)
	 *
	 * (`<Part extends PersistentPart>` is a "generic": a part that carries more
	 * than its element, such as the picker a row also has to reach, comes back
	 * with its own type. One name is always built by the same `create`, so the
	 * part kept under it has that type, which is what the `as` says.)
	 */
	mount<Part extends PersistentPart>(id: string, parent: HTMLElement, create: (parent: HTMLElement) => Part): Part {
		let part = this.parts.get(id) as Part | undefined;
		if (!part) {
			part = create(parent);
			this.parts.set(id, part);
		}
		if (part.el.parentElement !== parent) parent.appendChild(part.el);
		return part;
	}

	/**
	 * The part kept under `id`, for another row that works with it (a slider
	 * that drives the preview, say), or undefined while there is none.
	 * (The same `as` as in {@link mount}: one name, one kind of part.)
	 */
	get<Part extends PersistentPart>(id: string): Part | undefined {
		return this.parts.get(id) as Part | undefined;
	}

	/** Whether a part named `id` is being kept. */
	has(id: string): boolean {
		return this.parts.has(id);
	}

	/**
	 * The row showing part `id` is being taken down. If, a moment later, the
	 * part's element is not on the page again, dispose of it.
	 */
	releaseLater(id: string): void {
		this.later(() => {
			const part = this.parts.get(id);
			if (!part || part.el.isConnected) return;
			this.parts.delete(id);
			disposeQuietly(part);
		});
	}

	/** Dispose of every part: the user left the settings. */
	disposeAll(): void {
		const all = [...this.parts.values()];
		this.parts.clear();
		for (const part of all) disposeQuietly(part);
	}
}

/** Dispose a part; an error there must not stop the others from being disposed. */
function disposeQuietly(part: PersistentPart): void {
	try {
		part.dispose();
	} catch (error) {
		console.error("Callout Studio: could not dispose a settings part.", error);
	}
}
