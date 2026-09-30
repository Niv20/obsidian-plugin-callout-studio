/**
 * settings/pluginImport/pluginImportViews.ts — the plugin import window's
 * options, drawn once and then kept in line with state.
 *
 * Builders only: no state, and above all no Import button. The window's one
 * Import lives in its footer (PluginImportModal), and nothing here may grow a
 * second — the vault card states what was found, the file card's button says
 * "Upload" and then "Replace", and the paste card's says "Paste".
 *
 * Both options are on one screen, stacked:
 *
 * - **This vault** — a card saying what was found. Drawn while the probe is
 *   still looking and once it has found something; taken away, without a word,
 *   when it finds nothing.
 * - **The source's one fallback** — a file card with an Upload button, or a
 *   paste card with a text box and a Paste button. Always there, and alone
 *   when the vault holds nothing.
 *
 * While both are there, each card ends in a radio dot and the active one wears
 * the ring: that is the one Import acts on. Alone, the fallback has nothing to
 * be chosen against, and so has neither.
 *
 * Nothing is ever redrawn. `update()` writes what changed in place — a count,
 * a file name, which card is active — so the Upload button that becomes
 * Replace is the same button, and typing never moves the caret.
 */
import { setIcon } from "obsidian";
import { t } from "../../i18n";
import { optionBoxId, renderOptionBox, renderOptionList, type OptionBox } from "../optionBox";
import { renderRecommendedBadge } from "../recommendedBadge";
import {
	activeOption,
	isFilled,
	vaultOffered,
	type ImportFlow,
	type ImportOption,
} from "./pluginImportFlow";
import type { PluginImportCopy, PluginImportManual } from "./pluginImportSource";

export interface ViewState {
	flow: ImportFlow;
	vaultCount: number;
	/** The staged file's name; null while none is staged, and in a paste window. */
	fileName: string | null;
}

export interface ViewHandlers {
	/** A card, or its radio dot, was pressed. */
	onChoose: (option: ImportOption) => void;
	/** The paste box took focus: a quiet choice, never a reason for a notice. */
	onPasteFocus: () => void;
	/** Upload, or Replace, was pressed. */
	onUpload: () => void;
	/** Paste was pressed. */
	onPaste: () => void;
	/** The paste box's text changed. */
	onPasteInput: (text: string) => void;
}

export interface OptionsView {
	/** Bring every card in line with `state`, in place. */
	update(state: ViewState): void;
	/** The lines that say what `option` holds, as an `aria-describedby` value. */
	describedBy(option: ImportOption): string;
	/** The fallback's card: where a dragged file is dropped. */
	manualEl: HTMLElement;
	/** The text box, in a paste window. */
	pasteInput: HTMLTextAreaElement | null;
}

/** One option's card, and the radio dot at its trailing edge. */
interface Card {
	box: OptionBox;
	radio: HTMLElement;
}

/**
 * Draw the options. `label` is the window's own title, which names the group
 * by reference: an `aria-label` would do the same for a screen reader, but
 * Obsidian pops up any `aria-label` as a tooltip over whatever the pointer is
 * on inside it.
 */
export function renderOptions(
	parent: HTMLElement,
	label: HTMLElement,
	copy: PluginImportCopy,
	manual: PluginImportManual,
	handlers: ViewHandlers,
): OptionsView {
	if (!label.id) label.id = optionBoxId("group");
	const list = renderOptionList(parent);

	const vault = renderCard(list, "vault", "vault", handlers);
	vault.box.titleEl.setText(t(copy.fromVault));
	let recommended = false;

	const file = manual.kind === "file";
	const card = renderCard(list, "manual", file ? "file-json" : "clipboard-paste", handlers);
	const action = card.box.el.createEl("button", {
		cls: "cs-import-action",
		text: file ? "" : t("import.pasteButton"),
		// What the button fills, and then what it would replace.
		attr: { "aria-describedby": card.box.describedBy },
	});
	action.addEventListener("click", () => (file ? handlers.onUpload() : handlers.onPaste()));
	// The dot stays the card's last mark, after its button.
	card.box.el.appendChild(card.radio);
	const pasteInput = manual.kind === "paste"
		? renderPasteInput(card, t(manual.placeholder), handlers)
		: null;
	if (!file) {
		card.box.titleEl.setText(t(copy.manual));
		card.box.descEl.setText(t(copy.manualDesc));
	}

	const update = (state: ViewState): void => {
		const { flow } = state;
		const two = vaultOffered(flow.probe);
		const active = activeOption(flow);

		if (two) {
			list.setAttribute("role", "radiogroup");
			list.setAttribute("aria-labelledby", label.id);
			// A fast probe should never flash the card — see styles.css.
			vault.box.el.toggleClass("is-checking", flow.probe === "checking");
			vault.box.descEl.setText(
				t(flow.probe === "found" ? copy.vaultFound : copy.vaultChecking, { count: state.vaultCount }),
			);
			// The one route that carries everything, so it is the one recommended.
			if (flow.probe === "found" && !recommended) {
				renderRecommendedBadge(vault.box.titleEl.parentElement ?? vault.box.el);
				recommended = true;
			}
		} else {
			// Nothing in this vault to import: the option goes, and with it
			// everything that said there was a choice to make.
			list.removeAttribute("role");
			list.removeAttribute("aria-labelledby");
			vault.box.el.remove();
			card.radio.remove();
		}

		if (file) showStagedFile(card.box, action, copy, state.fileName);

		for (const [option, { box, radio }] of [["vault", vault], ["manual", card]] as const) {
			const on = two && option === active;
			const filled = isFilled(flow, option);
			box.el.toggleClass("is-selected", on);
			// What a click on the card would change.
			box.el.toggleClass("is-choosable", two && filled && !on);
			radio.setAttribute("aria-checked", on ? "true" : "false");
			// A dot is a focus stop only while its card has something to choose.
			if (filled) {
				radio.setAttribute("tabindex", "0");
				radio.removeAttribute("aria-disabled");
			} else {
				radio.removeAttribute("tabindex");
				radio.setAttribute("aria-disabled", "true");
			}
		}
	};

	return {
		update,
		describedBy: (option) => (option === "vault" ? vault : card).box.describedBy,
		manualEl: card.box.el,
		pasteInput,
	};
}

/**
 * A card and its radio dot. The dot is the option's radio — named by the
 * card's title line, described by its status line — and the card around it is
 * one large pointer target for the same thing. The card cannot be the radio
 * itself: a radio may hold no control of its own, and the fallback's card
 * holds a button and, for a paste, a text box.
 */
function renderCard(
	list: HTMLElement,
	option: ImportOption,
	icon: string,
	handlers: ViewHandlers,
): Card {
	const box = renderOptionBox(list, { icon, title: "", desc: "" });
	box.el.addClass(option === "vault" ? "cs-import-vault" : "cs-import-manual");
	const [headId, descId] = box.describedBy.split(" ");
	const radio = box.el.createDiv({
		cls: "cs-import-radio",
		attr: {
			role: "radio",
			"aria-checked": "false",
			"aria-labelledby": headId ?? "",
			"aria-describedby": descId ?? "",
		},
	});
	setIcon(radio, "check");
	radio.addEventListener("keydown", (evt) => {
		if (evt.key !== "Enter" && evt.key !== " ") return;
		// Claimed even when repeated, so a held Space never scrolls the window.
		evt.preventDefault();
		if (!evt.repeat) handlers.onChoose(option);
	});
	// Anywhere on the card chooses it — except on a control of its own, which
	// does what it says instead.
	box.el.addEventListener("click", (evt) => {
		if ((evt.target as Element | null)?.closest("button, textarea")) return;
		handlers.onChoose(option);
	});
	return { box, radio };
}

/**
 * Write a staged file's name onto its card, or take it back to the empty card.
 * The one place the card's three changing parts are written.
 */
function showStagedFile(
	box: OptionBox,
	button: HTMLElement,
	copy: PluginImportCopy,
	fileName: string | null,
): void {
	const staged = fileName !== null;
	box.titleEl.setText(fileName ?? t(copy.manual));
	// A file name rather than a label: it breaks anywhere, and an LTR name
	// keeps its order inside RTL text (a Hebrew one still reads correctly in an
	// LTR window).
	box.titleEl.toggleClass("cs-option-box-name", staged);
	if (staged) box.titleEl.setAttribute("dir", "auto");
	else box.titleEl.removeAttribute("dir");
	box.descEl.setText(t(staged ? "import.fileReady" : copy.manualDesc));
	button.setText(t(staged ? "import.replace" : "import.upload"));
}

/**
 * The paste card's text box, on a line of its own under the card's head. A
 * fixed height, and it scrolls — styles.css — rather than growing with what is
 * pasted, so the footer's Import stays where it was. The user pastes into it
 * themselves, or presses Paste; either way the text is there to see.
 */
function renderPasteInput(
	card: Card,
	placeholder: string,
	handlers: ViewHandlers,
): HTMLTextAreaElement {
	const [headId, descId] = card.box.describedBy.split(" ");
	const input = card.box.el.createEl("textarea", {
		cls: "cs-import-paste-input cs-text-control",
		attr: {
			placeholder,
			// Named by reference — never an `aria-label`, which Obsidian would
			// pop up as a tooltip.
			"aria-labelledby": headId ?? "",
			"aria-describedby": descId ?? "",
			// Code, not prose: no red underlines, no capital put on a selector.
			spellcheck: "false",
			autocapitalize: "off",
			autocorrect: "off",
		},
	});
	input.addEventListener("input", () => handlers.onPasteInput(input.value));
	// Going back into a box that holds text is choosing it.
	input.addEventListener("focus", () => handlers.onPasteFocus());
	return input;
}
