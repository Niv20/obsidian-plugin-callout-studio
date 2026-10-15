/**
 * settings/editor/NoteChangesModal.ts — "Update your notes?", asked by the
 * callout editor's Save before anything in a note changes.
 *
 *   ┌ Update your notes? ──────────────────────────────────────────┐
 *   │ You removed "test" from Abstract, but it's still used by 12  │
 *   │ callouts in 5 notes. What should happen to those callouts?   │
 *   │ ┌──────────────────────────────────────────────────────────┐ │
 *   │ │ Leave them as they are                                (●)│ │
 *   │ │ They keep [!test] and fall back to the default style.    │ │
 *   │ └──────────────────────────────────────────────────────────┘ │
 *   │ ┌──────────────────────────────────────────────────────────┐ │
 *   │ │ Move "test" to another callout   [Search callouts… ▾] ( )│ │
 *   │ │ Your notes don't change. …                               │ │
 *   │ └──────────────────────────────────────────────────────────┘ │
 *   │ ┌──────────────────────────────────────────────────────────┐ │
 *   │ │ Change them in your notes        [▣ Abstract       ▾] ( )│ │
 *   │ │ Every [!test] in your notes becomes [!abstract].         │ │
 *   │ └──────────────────────────────────────────────────────────┘ │
 *   │ ──────────────────────────────────────────────────────────── │
 *   │ (the next part, when Save changes more than one thing)       │
 *   │                                   [Cancel] [Save changes]    │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * One part per thing the notes hold (see noteChangeQuestion.ts for which):
 * a line saying what the user changed and what the notes still hold, ending in
 * the question, then the answers — drawn as the import window draws its
 * options, on the same card, dot and painting (../optionBox.ts). A card's
 * picker sits at its trailing edge, before the dot, where the import card keeps
 * its button. Parts are set apart by a rule. Every answer stays in view, and
 * the one preselected is the one that changes the least — except where Save
 * always changed the notes, a rename and a fold change, which open on doing
 * what they always did.
 *
 * Cancel, Escape or the close button go back to the editor with nothing saved;
 * only Save changes saves, with the answers showing.
 */
import { Modal, type App } from "obsidian";
import { MAX_TAGS_COUNT } from "../../constants";
import { t } from "../../i18n";
import type { CalloutRegistry } from "../../manager/CalloutRegistry";
import type { CalloutDefinition } from "../../types";
import { calloutIdentity } from "../../utils/calloutId";
import type { IdNoteStats, NoteTally } from "../../utils/idNoteStats";
import { CalloutCombobox, type CalloutComboboxOptions } from "../calloutCombobox";
import { applyModalChrome } from "../modalChrome";
import {
	addOptionRadio,
	optionBoxId,
	paintOptionRadio,
	renderOptionBox,
	renderOptionList,
	type OptionBox,
} from "../optionBox";
import type { FoldMark, LeavingId, NoteChoices, PendingNoteChanges } from "./noteChanges";
import {
	choicesFromAnswers,
	defaultAnswers,
	foldTally,
	idsEndingHere,
	titleTally,
	type GivenId,
	type IdAnswer,
	type NoteChangeQuestion,
} from "./noteChangeQuestion";

export interface NoteChangesAnswer {
	choices: NoteChoices;
	/** Old ids to keep on the callout, so their notes need nothing. */
	keep: string[];
	/** Old ids to hand to another callout, so their notes need nothing either. */
	give: GivenId[];
}

export interface NoteChangesModalInput {
	question: NoteChangeQuestion;
	pending: PendingNoteChanges;
	stats: ReadonlyMap<string, IdNoteStats> | null;
	/** The callout as Save will leave it — the "this callout" of every answer. */
	saved: CalloutDefinition;
	/** Ids the callout can still take, for "Keep as another ID". */
	roomForIds: number;
	registry: CalloutRegistry;
	/** Callouts a removed id's notes may be rewritten to; `saved` among them. */
	targets: () => readonly CalloutDefinition[];
	/** Callouts a removed id may move to: room for another id, not `saved`. */
	moveTargets: () => readonly CalloutDefinition[];
}

/** The label the fold setting wears in the editor. */
function foldLabel(mark: FoldMark): string {
	if (mark === "") return t("editor.foldOff");
	return mark === "-" ? t("editor.foldClosed") : t("editor.foldOpen");
}

/** "3 callouts" and "1 note", for the `{{callouts}} in {{notes}}` of a part's line. */
function counted(tally: NoteTally): { callouts: string; notes: string } {
	const files = tally.files.size;
	return {
		callouts: tally.count === 1 ? t("noteChanges.calloutsOne") : t("noteChanges.callouts", { count: tally.count }),
		notes: files === 1 ? t("noteChanges.notesOne") : t("noteChanges.notes", { count: files }),
	};
}

/**
 * A part's line: what the user changed and what the notes still hold, then
 * the question — about that one callout (or title), or about those, which is
 * also how it is asked when the notes could not be counted.
 */
function asked(statement: string, tally: NoteTally | null, of: "callouts" | "titles"): string {
	const one = tally?.count === 1;
	const question = of === "titles"
		? (one ? t("noteChanges.askTitle") : t("noteChanges.askTitles"))
		: (one ? t("noteChanges.askCallout") : t("noteChanges.askCallouts"));
	return `${statement} ${question}`;
}

/** One answer card, as {@link NoteChangesModal} builds it. */
interface AnswerSpec {
	title: string;
	desc: string;
	isChosen: () => boolean;
	choose: () => void;
	/** Drawn greyed and out of reach while true. */
	blocked?: () => boolean;
}

export class NoteChangesModal extends Modal {
	private resolve: (answer: NoteChangesAnswer | null) => void = () => undefined;
	private settled = false;
	private readonly ids: Map<string, IdAnswer>;
	private titles: boolean;
	private fold: boolean;
	/** Each answer card's own repaint, run after every choice. */
	private readonly paints: Array<() => void> = [];
	private readonly pickers: CalloutCombobox[] = [];

	constructor(app: App, private readonly input: NoteChangesModalInput) {
		super(app);
		const start = defaultAnswers(input.question);
		this.ids = new Map(start.ids);
		this.titles = start.titles;
		this.fold = start.fold;
	}

	ask(): Promise<NoteChangesAnswer | null> {
		return new Promise((resolve) => {
			this.resolve = resolve;
			this.open();
		});
	}

	onOpen(): void {
		const footer = applyModalChrome(this, { footer: true });
		this.setTitle(t("noteChanges.title"));
		const { question } = this.input;
		for (const { leaving, uses } of question.ids) {
			if (leaving.wasPrimary) this.renderRename(leaving, uses);
			else this.renderRemoved(leaving, uses);
		}
		if (question.titles) this.renderTitles(question.titles);
		if (question.fold !== null) this.renderFold(question.fold);

		footer.createEl("button", { text: t("editor.cancel") })
			.addEventListener("click", () => this.finish(false));
		footer.createEl("button", { text: t("editor.saveChanges"), cls: "mod-cta" })
			.addEventListener("click", () => this.finish(true));
		this.repaint();
	}

	onClose(): void {
		if (!this.settled) {
			this.settled = true;
			this.resolve(null);
		}
		for (const picker of this.pickers) picker.destroy();
		this.contentEl.empty();
	}

	private finish(save: boolean): void {
		if (this.settled) return;
		this.settled = true;
		const { ids, titles, fold } = this;
		this.resolve(save ? choicesFromAnswers(this.input.question, { ids, titles, fold }) : null);
		this.close();
	}

	private repaint(): void {
		for (const paint of this.paints) paint();
	}

	/** One part of the question: the line saying what changed and asking, then its answers. */
	private part(line: string): { el: HTMLElement; lineEl: HTMLElement; list: HTMLElement } {
		const el = this.contentEl.createDiv({ cls: "cs-note-change" });
		const lineId = optionBoxId("note-change");
		const lineEl = el.createEl("p", { cls: "cs-note-change-line", text: line, attr: { id: lineId } });
		const list = renderOptionList(el);
		list.setAttribute("role", "radiogroup");
		list.setAttribute("aria-labelledby", lineId);
		return { el, lineEl, list };
	}

	/** One answer card. */
	private answer(list: HTMLElement, spec: AnswerSpec): { box: OptionBox; radio: HTMLElement } {
		const blocked = spec.blocked ?? (() => false);
		const box = renderOptionBox(list, { title: spec.title, desc: spec.desc });
		const radio = addOptionRadio(box, () => {
			if (blocked()) return;
			spec.choose();
			this.repaint();
		});
		this.paints.push(() => {
			const chosen = spec.isChosen();
			const off = blocked();
			box.el.toggleClass("is-blocked", off);
			paintOptionRadio(box, radio, { chosen, choosable: !chosen && !off, enabled: !off });
		});
		return { box, radio };
	}

	/**
	 * A callout picker at a card's trailing edge, just before its dot — where
	 * the import window's card keeps its button. A click anywhere on the card,
	 * the picker included, still answers for the card.
	 */
	private picker(card: { box: OptionBox; radio: HTMLElement }, options: CalloutComboboxOptions): CalloutCombobox {
		card.box.el.addClass("cs-note-change-picking");
		const host = card.box.el.createDiv({ cls: "cs-note-change-target" });
		// The dot stays the card's last mark, after its picker.
		card.box.el.appendChild(card.radio);
		const picker = new CalloutCombobox(host, options);
		this.pickers.push(picker);
		return picker;
	}

	private renderRename(leaving: LeavingId, uses: NoteTally | null): void {
		const key = calloutIdentity(leaving.id);
		const { saved, pending, roomForIds } = this.input;
		const name = pending.name;
		const ids = { oldId: leaving.id, newId: saved.id };
		let line: string;
		if (name) {
			const names = { old: name.from, new: name.to, ...ids };
			line = uses
				? t("noteChanges.renamedLine", { ...names, ...counted(uses) })
				: t("noteChanges.renamedLineUnknown", names);
		} else {
			line = uses
				? t("noteChanges.idChangedLine", { ...ids, ...counted(uses) })
				: t("noteChanges.idChangedLineUnknown", ids);
		}
		const { list } = this.part(asked(line, uses, "callouts"));
		this.answer(list, {
			title: t("noteChanges.renameChange", { id: saved.id }),
			desc: name
				? t("noteChanges.renameFollowDesc", { ...ids, old: name.from, new: name.to })
				: t("noteChanges.renameFollowDescIdOnly", ids),
			isChosen: () => this.ids.get(key)?.kind === "rewrite",
			choose: () => this.ids.set(key, { kind: "rewrite", target: { kind: "self" } }),
		});
		this.answer(list, {
			title: t("noteChanges.renameKeep", { id: leaving.id }),
			desc: roomForIds > 0
				? t("noteChanges.renameKeepDesc")
				: t("noteChanges.renameKeepFull", { max: MAX_TAGS_COUNT }),
			isChosen: () => this.ids.get(key)?.kind === "keep",
			choose: () => this.ids.set(key, { kind: "keep" }),
			blocked: () => roomForIds <= 0,
		});
	}

	private renderRemoved(leaving: LeavingId, uses: NoteTally | null): void {
		const key = calloutIdentity(leaving.id);
		const { id } = leaving;
		const { saved, registry, targets, moveTargets } = this.input;
		const name = saved.displayName;
		const { list } = this.part(asked(uses
			? t("noteChanges.removedLine", { id, name, ...counted(uses) })
			: t("noteChanges.removedLineUnknown", { id, name }), uses, "callouts"));

		this.answer(list, {
			title: t("noteChanges.leave"),
			desc: t("noteChanges.leaveDesc", { id }),
			isChosen: () => (this.ids.get(key)?.kind ?? "leave") === "leave",
			choose: () => this.ids.set(key, { kind: "leave" }),
		});

		// Where the id or its notes go is remembered apart from whether they
		// go, so choosing Leave and coming back finds the callout picked before.
		// The move starts on nothing picked: there is no callout it is likelier
		// to be than any other, and a guess would read as a suggestion.
		let moveTo = "";
		const noRoom = (): boolean => moveTargets().length === 0;
		const move = this.answer(list, {
			title: t("noteChanges.moveTo", { id }),
			desc: noRoom() ? t("noteChanges.moveNoRoom", { max: MAX_TAGS_COUNT }) : t("noteChanges.moveToDesc"),
			isChosen: () => this.ids.get(key)?.kind === "move",
			choose: () => {
				if (moveTo) this.ids.set(key, { kind: "move", to: moveTo });
				// Nothing to move it to yet: open the list instead. After this
				// click has finished, or the document's own click handler would
				// close the list again as a click outside it.
				else window.setTimeout(() => { if (!this.settled) movePicker.focus(); }, 0);
			},
			blocked: noRoom,
		});
		const movePicker = this.picker(move, {
			registry,
			choices: moveTargets,
			value: "",
			ariaLabel: t("noteChanges.moveToLabel", { id }),
			onChange: (to) => {
				moveTo = to;
				this.ids.set(key, { kind: "move", to });
				this.repaint();
			},
		});

		let target = saved.id;
		const send = (): void => {
			const def = targets().find((one) => one.id === target);
			this.ids.set(key, target === saved.id || !def
				? { kind: "rewrite", target: { kind: "self" } }
				: { kind: "rewrite", target: { kind: "callout", id: def.id, name: def.displayName } });
		};
		const rewrite = this.answer(list, {
			title: t("noteChanges.rewrite"),
			desc: t("noteChanges.rewriteDesc", { id, to: target }),
			isChosen: () => this.ids.get(key)?.kind === "rewrite",
			choose: send,
		});
		this.picker(rewrite, {
			registry,
			choices: targets,
			value: saved.id,
			ariaLabel: t("noteChanges.changeToLabel", { id }),
			onChange: (to) => {
				target = to;
				rewrite.box.descEl.setText(t("noteChanges.rewriteDesc", { id, to }));
				send();
				this.repaint();
			},
		});
	}

	private renderTitles(titles: NonNullable<NoteChangeQuestion["titles"]>): void {
		const names = { old: titles.from, new: titles.to };
		const { el, lineEl, list } = this.part("");
		// Like the fold part below: the count covers the ids that end up here.
		this.paints.push(() => {
			const { pending, stats } = this.input;
			const tally = titleTally(pending, stats, idsEndingHere({ ids: this.ids, titles: this.titles, fold: this.fold }));
			lineEl.setText(asked(tally
				? t("noteChanges.titlesLine", { ...names, ...counted(tally) })
				: t("noteChanges.titlesLineUnknown", names), tally, "titles"));
			el.toggleClass("cs-row-hidden", tally !== null && tally.count === 0);
		});
		this.answer(list, {
			title: t("noteChanges.titlesChange", { new: titles.to }),
			desc: t("noteChanges.titlesChangeDesc", names),
			isChosen: () => this.titles,
			choose: () => { this.titles = true; },
		});
		this.answer(list, {
			title: t("noteChanges.leave"),
			desc: t("noteChanges.titlesLeaveDesc", { old: titles.from }),
			isChosen: () => !this.titles,
			choose: () => { this.titles = false; },
		});
	}

	private renderFold(mark: FoldMark): void {
		const { el, lineEl, list } = this.part("");
		this.answer(list, {
			title: t("noteChanges.foldChange", { state: foldLabel(mark) }),
			desc: t("noteChanges.foldChangeDesc"),
			isChosen: () => this.fold,
			choose: () => { this.fold = true; },
		});
		this.answer(list, {
			title: t("noteChanges.leave"),
			desc: t("noteChanges.foldLeaveDesc"),
			isChosen: () => !this.fold,
			choose: () => { this.fold = false; },
		});
		// The count covers the ids that stay this callout's after the answers
		// above — sent here, or kept as another id — so it is read again
		// whenever an answer changes, and the part goes away while nothing it
		// would change is left.
		this.paints.push(() => {
			const { pending, stats } = this.input;
			const tally = foldTally(pending, stats, idsEndingHere({ ids: this.ids, titles: this.titles, fold: this.fold }));
			lineEl.setText(asked(
				tally ? t("noteChanges.foldLine", counted(tally)) : t("noteChanges.foldLineUnknown"),
				tally,
				"callouts",
			));
			el.toggleClass("cs-row-hidden", tally !== null && tally.count === 0);
		});
	}
}
