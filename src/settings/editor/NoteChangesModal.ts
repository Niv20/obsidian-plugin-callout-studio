/**
 * settings/editor/NoteChangesModal.ts — "Update your notes?", asked by the
 * callout editor's Save before anything in a note changes.
 *
 *   ┌ Update your notes? ──────────────────────────────────────────┐
 *   │ • You changed the display name from "Idea" to "Insight", so  │
 *   │   the main ID changes from "idea" to "insight".              │
 *   │ • You removed the ID "test".                                 │
 *   │ This affects 16 callouts in 7 notes.                         │
 *   │ What should happen to those callouts?                        │
 *   │ ┌──────────────────────────────────────────────────────────┐ │
 *   │ │ Leave them as they are                                (●)│ │
 *   │ │ They keep their old IDs and fall back to the default …   │ │
 *   │ └──────────────────────────────────────────────────────────┘ │
 *   │ ┌──────────────────────────────────────────────────────────┐ │
 *   │ │ Change them to                   [insight          ▾] ( )│ │
 *   │ │ Every old ID in your notes becomes [!insight].           │ │
 *   │ └──────────────────────────────────────────────────────────┘ │
 *   │                                   [Cancel] [Save changes]    │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * One question for everything Save would change (see noteChangeQuestion.ts
 * for what is listed), in the frame the palette editor's question shares
 * (../noteQuestion.ts): the changes — one line, or a list when there are
 * several — then how many callouts they reach and the question, then two
 * answer cards. **Leave them as they are** comes first and is chosen on
 * opening: no note changes unless the user picks Change. Change
 * offers only this callout's own ids; giving an id to another callout is that
 * callout's **move it here** (./idMoves.ts). With more than one id to pick
 * from, the dropdown sits at the card's trailing edge, before the dot, where
 * the import card keeps its button.
 *
 * Cancel, Escape or the close button go back to the editor with nothing saved;
 * only Save changes saves, with the answer showing.
 *
 * A built-in's **Reset to default** asks the same question about the ids it
 * takes off the callout (../sections/builtInResetAction.ts), in its own words
 * for them and with its own button — `action`.
 */
import { Modal, type App } from "obsidian";
import { t } from "../../i18n";
import type { CalloutDefinition } from "../../types";
import { SelectDropdown } from "../../ui/selectDropdown";
import { calloutIdentity } from "../../utils/calloutId";
import { applyModalChrome } from "../modalChrome";
import { renderNoteQuestion, type NoteQuestion } from "../noteQuestion";
import type { FoldMark, NoteChoices, PendingNoteChanges } from "./noteChanges";
import { choicesFor, type NoteChangeQuestion } from "./noteChangeQuestion";

export interface NoteChangesModalInput {
	question: NoteChangeQuestion;
	pending: PendingNoteChanges;
	/** The callout as Save will leave it: its ids are what Change offers. */
	saved: CalloutDefinition;
	/**
	 * When the question stands before something other than the editor's Save:
	 * how the removed ids are said (see removedIdsLine), and the button that
	 * goes ahead.
	 */
	action?: { removed: (ids: readonly string[]) => string; confirm: string };
}

/** Removed ids in one line: one quoted in `one`, several listed after `many`'s colon. */
export function removedIdsLine(ids: readonly string[], one: string, many: string): string {
	return ids.length === 1 ? t(one, { id: ids[0]! }) : t(many, { ids: ids.join(", ") });
}

/** The label the fold setting wears in the editor. */
function foldLabel(mark: FoldMark): string {
	if (mark === "") return t("editor.foldOff");
	return mark === "-" ? t("editor.foldClosed") : t("editor.foldOpen");
}

/** One line per change Save would make to the notes, the main id's first. */
function changeLines({ question, pending, saved, action }: NoteChangesModalInput): string[] {
	const lines: string[] = [];
	const main = question.ids.find(({ leaving }) => leaving.wasPrimary);
	if (main) {
		const ids = { oldId: main.leaving.id, newId: saved.id };
		lines.push(pending.name
			? t("noteChanges.changeRenamed", { old: pending.name.from, new: pending.name.to, ...ids })
			: t("noteChanges.changeMainId", ids));
	} else if (question.name) {
		lines.push(t("noteChanges.changeName", { old: question.name.from, new: question.name.to }));
	}
	const removed = question.ids.filter(({ leaving }) => !leaving.wasPrimary).map(({ leaving }) => leaving.id);
	if (removed.length > 0) {
		lines.push(action
			? action.removed(removed)
			: removedIdsLine(removed, "noteChanges.changeRemoved", "noteChanges.changeRemovedMany"));
	}
	if (question.fold !== null) lines.push(t("noteChanges.changeFold"));
	return lines;
}

/** The ids Change can send the notes to: this callout's own, its main id first. */
function ownIds(saved: CalloutDefinition): string[] {
	const seen = new Set<string>();
	return [saved.id, ...(saved.aliases ?? [])].filter((id) => {
		const key = calloutIdentity(id);
		if (!key || seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

export class NoteChangesModal extends Modal {
	private resolve: (choices: NoteChoices | null) => void = () => undefined;
	private settled = false;
	/** The id Change sends the notes to; null while Leave is chosen. */
	private to: string | null = null;
	private dropdown: SelectDropdown | null = null;

	constructor(app: App, private readonly input: NoteChangesModalInput) {
		super(app);
	}

	ask(): Promise<NoteChoices | null> {
		return new Promise((resolve) => {
			this.resolve = resolve;
			this.open();
		});
	}

	onOpen(): void {
		const footer = applyModalChrome(this, { footer: true });
		this.setTitle(t("noteChanges.title"));
		const { affected } = this.input.question;
		const ask = renderNoteQuestion(this.contentEl, footer, {
			changes: changeLines(this.input),
			reach: affected ? { callouts: affected.count, notes: affected.files.size } : null,
			finish: (save) => this.finish(save),
			confirm: this.input.action?.confirm,
		});
		this.renderLeave(ask);
		this.renderChange(ask);
		ask.repaint();
	}

	onClose(): void {
		if (!this.settled) {
			this.settled = true;
			this.resolve(null);
		}
		this.dropdown?.destroy();
		this.contentEl.empty();
	}

	private finish(save: boolean): void {
		if (this.settled) return;
		this.settled = true;
		this.resolve(save ? choicesFor(this.input.question, this.to) : null);
		this.close();
	}

	private renderLeave(ask: NoteQuestion): void {
		const { ids, name } = this.input.question;
		let desc: string;
		if (ids.length === 1) desc = t("noteChanges.leaveDesc", { id: ids[0]!.leaving.id });
		else if (ids.length > 1) desc = t("noteChanges.leaveManyDesc");
		else if (name) desc = t("noteChanges.titlesLeaveDesc", { old: name.from });
		else desc = t("noteChanges.foldLeaveDesc");
		ask.answer({
			title: t("noteChanges.leave"),
			desc,
			isChosen: () => this.to === null,
			choose: () => { this.to = null; },
		});
	}

	private renderChange(ask: NoteQuestion): void {
		const { question, pending, saved } = this.input;
		const { ids, name, fold } = question;
		// Nothing to rewrite: only titles or fold marks would change.
		if (ids.length === 0) {
			ask.answer({
				title: name ? t("noteChanges.titlesChange", { new: name.to }) : t("noteChanges.foldChange", { state: foldLabel(fold ?? "") }),
				desc: name ? t("noteChanges.titlesChangeDesc", { old: name.from, new: name.to }) : t("noteChanges.foldChangeDesc"),
				isChosen: () => this.to !== null,
				choose: () => { this.to = saved.id; },
			});
			return;
		}

		const describe = (to: string): string => {
			if (ids.length > 1) return t("noteChanges.rewriteManyDesc", { to });
			const { leaving } = ids[0]!;
			// A rename followed back to the main id: its titles follow too.
			if (leaving.wasPrimary && pending.name && to === saved.id) {
				return t("noteChanges.renameFollowDesc", { oldId: leaving.id, newId: to, old: pending.name.from, new: pending.name.to });
			}
			return t("noteChanges.rewriteDesc", { id: leaving.id, to });
		};
		const choices = ownIds(saved);
		let picked = saved.id;
		const card = ask.answer({
			title: choices.length > 1 ? t("noteChanges.changeTo") : t("noteChanges.renameChange", { id: saved.id }),
			desc: describe(picked),
			isChosen: () => this.to !== null,
			choose: () => { this.to = picked; },
		});
		if (choices.length < 2) return;

		// The dropdown at the card's trailing edge, the dot still its last mark.
		// A click on it answers for the card, as a click anywhere on it does.
		card.box.el.addClass("cs-note-change-picking");
		const host = card.box.el.createDiv({ cls: "cs-note-change-target" });
		card.box.el.appendChild(card.radio);
		this.dropdown = new SelectDropdown(host, t("noteChanges.changeToIdLabel"))
			.setOptions(choices.map((id) => ({ value: id, label: id })))
			.setValue(picked)
			.onChange((to) => {
				picked = to;
				card.box.descEl.setText(describe(to));
				this.to = to;
				ask.repaint();
			});
	}
}
