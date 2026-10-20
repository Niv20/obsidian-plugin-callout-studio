/**
 * settings/noteQuestion.ts — the window every "Update your notes?" question
 * is drawn in: the callout editor's (./editor/NoteChangesModal.ts), and the
 * palette editor's when a new name changes the palette's word in callout
 * metadata (./PaletteNotesModal.ts).
 *
 *   ┌ Update your notes? ─────────────────────────────────┐
 *   │ What changed: one line, or a list when there are    │
 *   │ several.                                            │
 *   │ This affects 16 callouts in 7 notes.                │
 *   │ What should happen to those callouts?               │
 *   │ ┌─────────────────────────────────────────────────┐ │
 *   │ │ Leave them as they are                       (●)│ │
 *   │ └─────────────────────────────────────────────────┘ │
 *   │ ┌─────────────────────────────────────────────────┐ │
 *   │ │ Change them to …                             ( )│ │
 *   │ └─────────────────────────────────────────────────┘ │
 *   │                             [Cancel] [Save changes] │
 *   └─────────────────────────────────────────────────────┘
 *
 * One frame, so the two read as the same question: the changes, how far they
 * reach with the question on a line under it, then the answers as a radio
 * group of cards (./optionBox.ts) that repaint after every choice. Each window
 * still dresses itself — chrome and title, as every modal file must — then
 * adds its own answers (Leave first, and chosen on opening, so no note
 * changes unless the user says so) and decides what Save changes resolves
 * with. Cancel, Escape and the close button save nothing.
 */
import { t } from "../i18n";
import {
	addOptionRadio,
	optionBoxId,
	paintOptionRadio,
	renderOptionBox,
	renderOptionList,
	type OptionBox,
} from "./optionBox";

/** How many callouts, in how many notes, the change reaches. */
export interface NoteReach {
	callouts: number;
	notes: number;
}

export interface NoteAnswerSpec {
	title: string;
	desc: string;
	isChosen: () => boolean;
	choose: () => void;
}

export interface NoteQuestion {
	/** One answer card, below the ones added before it. */
	answer(spec: NoteAnswerSpec): { box: OptionBox; radio: HTMLElement };
	/** Show which card is chosen; run once the answers are in, and after a choice made elsewhere. */
	repaint(): void;
}

/** "3 callouts" and "1 note", for the `{{callouts}} in {{notes}}` of the count. */
function counted(reach: NoteReach): { callouts: string; notes: string } {
	return {
		callouts: reach.callouts === 1 ? t("noteChanges.calloutsOne") : t("noteChanges.callouts", { count: reach.callouts }),
		notes: reach.notes === 1 ? t("noteChanges.notesOne") : t("noteChanges.notes", { count: reach.notes }),
	};
}

/**
 * How many callouts the changes reach, then the question on a line of its own
 * — about that one callout, or about those, which is also how it is asked
 * when the notes could not be counted.
 */
function asked(reach: NoteReach | null): string {
	const count = reach ? t("noteChanges.affects", counted(reach)) : t("noteChanges.affectsUnknown");
	const question = reach?.callouts === 1 ? t("noteChanges.askCallout") : t("noteChanges.askCallouts");
	return `${count}\n${question}`;
}

/** Each `\n` of the text starts a new line of it. */
function writeLines(el: HTMLElement, text: string): void {
	el.empty();
	text.split("\n").forEach((line, i) => {
		if (i > 0) el.createEl("br");
		el.appendText(line);
	});
}

/**
 * Draw the question, all but its answers, into a window that already wears
 * the chrome: `el` is its content, `footer` the bar `applyModalChrome` built.
 */
export function renderNoteQuestion(
	el: HTMLElement,
	footer: HTMLElement,
	spec: {
		changes: readonly string[];
		reach: NoteReach | null;
		finish: (save: boolean) => void;
		/** The button that goes ahead: **Save changes**, unless the question stands before another action. */
		confirm?: string;
	},
): NoteQuestion {
	if (spec.changes.length === 1) {
		el.createEl("p", { cls: "cs-note-change-line", text: spec.changes[0] });
	} else {
		const listEl = el.createEl("ul", { cls: "cs-note-change-list" });
		for (const line of spec.changes) listEl.createEl("li", { text: line });
	}
	const askId = optionBoxId("note-change");
	writeLines(el.createEl("p", { cls: "cs-note-change-line", attr: { id: askId } }), asked(spec.reach));

	const list = renderOptionList(el);
	list.setAttribute("role", "radiogroup");
	list.setAttribute("aria-labelledby", askId);

	footer.createEl("button", { text: t("editor.cancel") })
		.addEventListener("click", () => spec.finish(false));
	footer.createEl("button", { text: spec.confirm ?? t("editor.saveChanges"), cls: "mod-cta" })
		.addEventListener("click", () => spec.finish(true));

	/** Each answer card's own repaint, run after every choice. */
	const paints: Array<() => void> = [];
	const repaint = (): void => {
		for (const paint of paints) paint();
	};
	return {
		answer(answer) {
			const box = renderOptionBox(list, { title: answer.title, desc: answer.desc });
			const radio = addOptionRadio(box, () => {
				answer.choose();
				repaint();
			});
			paints.push(() => {
				const chosen = answer.isChosen();
				paintOptionRadio(box, radio, { chosen, choosable: !chosen, enabled: true });
			});
			return { box, radio };
		},
		repaint,
	};
}
