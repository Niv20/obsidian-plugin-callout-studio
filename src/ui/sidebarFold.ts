/**
 * ui/sidebarFold.ts — which notes' results are folded away in a sidebar.
 *
 * Who uses it. Find callouts (usage/occurrenceResults.ts) and Review
 * conversion (portable/portableConversionNavigation.ts), each with one of its
 * own; ui/sidebarResults.ts reads it when it draws a note's group and writes it
 * when the fold button is pressed.
 *
 * The main idea. Both sidebars draw every note's results again from scratch
 * whenever anything changes (a rescan, a new selection), so a group cannot
 * remember by itself that it was folded. The memory is here, outside the
 * drawing, keyed by the note's path: a note stays folded through every redraw
 * until the user unfolds it, as Obsidian's own Search pane keeps a folded file
 * folded while its results refresh. It is gone when the sidebar closes; it is
 * never saved with the layout.
 */
export class SidebarFold {
	/** The paths of the notes whose results are folded away. */
	private readonly folded = new Set<string>();

	/** Whether `path`'s results are folded away. */
	isFolded(path: string): boolean {
		return this.folded.has(path);
	}

	/**
	 * Fold `path`'s results if they are showing, show them if they are folded.
	 *
	 * @returns Whether they are folded now.
	 */
	toggle(path: string): boolean {
		if (this.folded.delete(path)) return false;
		this.folded.add(path);
		return true;
	}

	/** Forget every fold: a new search starts with everything showing. */
	clear(): void {
		this.folded.clear();
	}
}
