/**
 * settings/PaletteNotesModal.ts — "Update your notes?", asked by the palette
 * editor's Save when a new name changes the word the palette answers to in
 * callout metadata and notes still use the old one.
 *
 *   ┌ Update your notes? ──────────────────────────────────────────┐
 *   │ You renamed the palette from "Comic Red" to "Comic Blue", so │
 *   │ its word in callout metadata changes from "comic-red" to     │
 *   │ "comic-blue".                                                │
 *   │ This affects 16 callouts in 7 notes.                         │
 *   │ What should happen to those callouts?                        │
 *   │ ┌──────────────────────────────────────────────────────────┐ │
 *   │ │ Leave them as they are                                (●)│ │
 *   │ │ They keep "comic-red" and go back to their own color.    │ │
 *   │ └──────────────────────────────────────────────────────────┘ │
 *   │ ┌──────────────────────────────────────────────────────────┐ │
 *   │ │ Change them to "comic-blue"                           ( )│ │
 *   │ │ Every |comic-red in your notes becomes |comic-blue.      │ │
 *   │ └──────────────────────────────────────────────────────────┘ │
 *   │                                   [Cancel] [Save changes]    │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * The callout editor's question (./editor/NoteChangesModal.ts), in the same
 * frame (./noteQuestion.ts), about the one thing a palette's notes hold: its
 * word. **Leave them as they are** is chosen on opening. Cancel, Escape or the
 * close button go back to the palette editor with nothing saved; Save changes
 * saves the palette, and rewrites the notes only with Change showing.
 */
import { Modal, type App } from "obsidian";
import { t } from "../i18n";
import { applyModalChrome } from "./modalChrome";
import { renderNoteQuestion, type NoteReach } from "./noteQuestion";

export interface PaletteNotesModalInput {
	/** The palette's name before the edit, and the one Save gives it. */
	name: { from: string; to: string };
	/** The word it answers to in callout metadata, before and after. */
	word: { from: string; to: string };
	/** The callouts that use the old word, and the notes they are in. */
	reach: NoteReach;
}

export class PaletteNotesModal extends Modal {
	private resolve: (change: boolean | null) => void = () => undefined;
	private settled = false;
	/** Whether Change is the answer showing; Leave is, on opening. */
	private change = false;

	constructor(app: App, private readonly input: PaletteNotesModalInput) {
		super(app);
	}

	/** True: change the notes. False: leave them. Null: back to the palette editor. */
	ask(): Promise<boolean | null> {
		return new Promise((resolve) => {
			this.resolve = resolve;
			this.open();
		});
	}

	onOpen(): void {
		const footer = applyModalChrome(this, { footer: true });
		this.setTitle(t("noteChanges.title"));
		const { name, word, reach } = this.input;
		const ask = renderNoteQuestion(this.contentEl, footer, {
			changes: [t("palette.renameNotesChange", { old: name.from, new: name.to, oldWord: word.from, newWord: word.to })],
			reach,
			finish: (save) => this.finish(save),
		});
		ask.answer({
			title: t("noteChanges.leave"),
			desc: t("palette.renameNotesLeaveDesc", { word: word.from }),
			isChosen: () => !this.change,
			choose: () => { this.change = false; },
		});
		ask.answer({
			title: t("noteChanges.renameChange", { id: word.to }),
			desc: t("palette.renameNotesChangeDesc", { old: word.from, new: word.to }),
			isChosen: () => this.change,
			choose: () => { this.change = true; },
		});
		ask.repaint();
	}

	onClose(): void {
		if (!this.settled) {
			this.settled = true;
			this.resolve(null);
		}
		this.contentEl.empty();
	}

	private finish(save: boolean): void {
		if (this.settled) return;
		this.settled = true;
		this.resolve(save ? this.change : null);
		this.close();
	}
}
