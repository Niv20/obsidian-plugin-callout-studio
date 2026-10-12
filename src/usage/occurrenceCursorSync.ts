/**
 * usage/occurrenceCursorSync.ts — Find callouts follows the caret.
 *
 * The card for the callout under the caret is marked current, as the core
 * Outline marks the heading under the caret (in editing mode it follows the
 * selection, not the scroll position). Following the caret costs no listener of
 * its own: the Live Preview view plugin already forwards every selection change
 * and edit (notifySidebarEditorSelection). Scroll would mean a listener per
 * editor firing on every frame of a fling, geometry reads while scrolling, and
 * no single answer when several callouts are on screen.
 *
 * Work per caret move is one frame-coalesced lookup (occurrenceAtCursor), and
 * the DOM is written only when the marked card actually changes.
 */
import type { MarkdownView } from "obsidian";
import { onSidebarEditorSelection, SidebarSourceSelection } from "../ui/sidebarSelection";
import { occurrenceAtCursor } from "./occurrenceAtCursor";
import type { OccurrenceResults } from "./occurrenceResults";

export class OccurrenceCursorSync {
	private unsubscribe: (() => void) | null = null;
	private frame: number | null = null;
	/** A clicked card, or one being opened, holds its mark over the caret's. */
	private held = false;
	private readonly landed = new SidebarSourceSelection();

	constructor(
		private readonly currentView: () => MarkdownView | null,
		private readonly cards: OccurrenceResults,
		private readonly scroller: () => HTMLElement | null,
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

	/** A result is opening: keep the caret from marking another card meanwhile. */
	hold(): void {
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
		const view = this.currentView();
		const path = view?.file?.path;
		const found = view && path
			? occurrenceAtCursor(view.editor, view.editor.getCursor("head"), this.cards.linesOf(path))
			: null;
		this.cards.follow(found, this.scroller());
	}

	private cancelFrame(): void {
		if (this.frame !== null) window.cancelAnimationFrame(this.frame);
		this.frame = null;
	}
}
