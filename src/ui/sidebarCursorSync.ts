/**
 * ui/sidebarCursorSync.ts — a results sidebar follows the caret.
 *
 * Find callouts and Review conversion both mark the card for what is under the
 * caret, as the core Outline marks the heading under the caret (in editing
 * mode it follows the selection, not the scroll position). Following the caret
 * costs no listener of its own: the Live Preview view plugin already forwards
 * every selection change and edit (notifySidebarEditorSelection). Scroll would
 * mean a listener per editor firing on every frame of a fling, geometry reads
 * while scrolling, and no single answer when several callouts are on screen.
 *
 * Work per caret move is one frame-coalesced lookup, done by the sidebar's
 * `follow`, which writes the DOM only when the marked card actually changes.
 */
import type { MarkdownView } from "obsidian";
import { onSidebarEditorSelection, SidebarSourceSelection } from "./sidebarSelection";

export class SidebarCursorSync {
	private unsubscribe: (() => void) | null = null;
	private frame: number | null = null;
	/** A clicked card, or one being opened, holds its mark over the caret's. */
	private held = false;
	private readonly landed = new SidebarSourceSelection();

	constructor(
		private readonly currentView: () => MarkdownView | null,
		/** Mark the card under this view's caret, or none when there is no view. */
		private readonly follow: (view: MarkdownView | null) => void,
	) {}

	open(): void {
		this.unsubscribe ??= onSidebarEditorSelection((editor) => {
			if (editor === this.currentView()?.editor) this.schedule();
		});
	}

	close(): void {
		this.unsubscribe?.();
		this.unsubscribe = null;
		this.reset();
	}

	/**
	 * A result is opening: keep the caret from marking another card meanwhile.
	 * An earlier click's watch goes, or the note loading into its editor would end the hold.
	 */
	hold(): void {
		this.landed.clear();
		this.held = true;
		this.cancelFrame();
	}

	/** The clicked card stays current until the user selects or types in its editor. */
	landedIn(editor: MarkdownView["editor"]): void {
		this.hold();
		this.landed.watch(editor, () => this.release());
	}

	/** Let the caret lead again, starting now. */
	release(): void {
		this.landed.clear();
		this.held = false;
		this.schedule();
	}

	/** Forget any clicked card without re-reading the caret yet. */
	reset(): void {
		this.landed.clear();
		this.held = false;
		this.cancelFrame();
	}

	/** Re-read the caret on the next frame; any number of calls before it cost one lookup. */
	schedule(): void {
		if (this.frame !== null || this.held || !this.unsubscribe) return;
		this.frame = window.requestAnimationFrame(() => {
			this.frame = null;
			this.sync();
		});
	}

	private sync(): void {
		if (this.held || !this.unsubscribe) return;
		this.follow(this.currentView());
	}

	private cancelFrame(): void {
		if (this.frame !== null) window.cancelAnimationFrame(this.frame);
		this.frame = null;
	}
}
