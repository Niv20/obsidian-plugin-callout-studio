/**
 * editor/CalloutMetadataSuggest.ts — the dropdown after `[!type|`.
 *
 * Opens once the cursor is past a token's first `|` and still inside it: the
 * colours a callout can take from its metadata, then the words the active
 * theme and snippets react to (`metadataSuggestions.ts` decides which, and
 * what each pick writes).
 *
 * ## Keys, mirroring the type dropdown
 *
 * - **Tab** writes the word and stays inside the brackets: type a space or a
 *   `|` and the dropdown opens again for the next word.
 * - **Enter** writes the word and finishes the header — exactly the landing
 *   Enter on a type gives (`autoCompleteCursor.ts`): a new callout's body
 *   line, or the end of a line that already had a title.
 *
 * ## Opening, and not re-opening
 *
 * Obsidian asks every suggest on each keystroke, so this opens right after the
 * first `|`, after each later separator (with **Done** on top, so Enter there
 * finishes rather than splitting the line inside `[!…]`), and while a word is
 * typed. A pick of ours is not a keystroke, but a pick that leaves the cursor
 * inside the token would still match the very next check, offering the word
 * just written back to the user — so the spot a Tab pick leaves is remembered
 * and passed over until the line or the cursor moves.
 *
 * ## Looks
 *
 * One line per row: a colour's word in its own colour beside the same circles
 * the callout editor's colour menu draws (a third for a gradient), a theme's
 * word in code type. When the rows come from more than one place, each group
 * sits under a sticky heading — **Colors**, the theme's name, a snippet's.
 * What a row needs to work (spaces, first or last, which colour it replaces)
 * is said once, on a line at the bottom, for the highlighted row only.
 *
 * Closes itself before writing, as the type dropdown does: Admonition's own
 * `> [!` suggest can still claim a rewritten line, and Obsidian's manager only
 * closes a popover nobody claims (see `AutoComplete.selectSuggestion`).
 */
import {
	Editor,
	EditorPosition,
	EditorSuggest,
	EditorSuggestContext,
	EditorSuggestTriggerInfo,
	TFile,
	setIcon,
} from "obsidian";
import type CalloutStudioPlugin from "../main";
import { getLocale, t } from "../i18n";
import { readCalloutTrigger, triggerInCode } from "./calloutTriggerContext";
import {
	landAfterInlineToken,
	parkCursor,
	placeCursorAfterPick,
} from "./autoCompleteCursor";
import { acceptOnKey, pickKeyOf } from "./suggestKeys";
import {
	applyMetadataPick,
	buildMetadataSuggestions,
	metadataRowHeadings,
	slotAt,
	type MetadataRowHeading,
	type MetadataSlot,
	type MetadataSuggestion,
} from "./metadataSuggestions";
import { resolveCalloutDef } from "./renderShared";
import { renderColorCircles, resolveCurrentModeColors } from "../ui/ColorCircles";
import {
	buildBlockHeaderToken,
	buildHeadingToken,
	metadataSuffixOf,
	splitFoldMark,
} from "./calloutWriter";
import { scanLineForCalloutTokens, tokenEnd } from "./calloutTokens";
import type { CalloutRenderRole } from "../types";

/** Fewer than Obsidian's 100: flexcyon alone reacts to ~700 words. */
const ROW_LIMIT = 50;

/** What `onTrigger` read, kept for the pick that follows it. */
interface OpenSlot extends MetadataSlot {
	line: number;
	/** The line's text when it was read — a pick refuses a line that moved. */
	text: string;
	/** `ch` where the metadata starts: just past the first `|`. */
	metaStart: number;
	triggerCh: number;
	role: CalloutRenderRole;
	calloutId: string;
}

export class CalloutMetadataSuggest extends EditorSuggest<MetadataSuggestion> {
	private readonly plugin: CalloutStudioPlugin;
	private slot: OpenSlot | null = null;
	/** Where a Tab pick left the cursor, and the line as it left it. */
	private lastPick: { line: number; ch: number; text: string } | null = null;
	/** The heading above a row that starts a group, from the last `getSuggestions`. */
	private headings = new Map<MetadataSuggestion, MetadataRowHeading>();
	/** What the hint line says for each row of that list. */
	private hints = new Map<MetadataSuggestion, string>();
	private hintEl: HTMLElement | null = null;

	constructor(plugin: CalloutStudioPlugin) {
		super(plugin.app);
		this.plugin = plugin;
		this.limit = ROW_LIMIT;
		acceptOnKey(this, [], "Tab");
	}

	onTrigger(
		cursor: EditorPosition,
		editor: Editor,
		_file: TFile | null,
	): EditorSuggestTriggerInfo | null {
		const text = editor.getLine(cursor.line);
		const trigger = readCalloutTrigger(text, cursor.ch, this.plugin.settings);
		if (!trigger || trigger.pipeCh === -1) return null;
		// Inside the metadata: past the first `|`, not past the `]`.
		if (cursor.ch <= trigger.pipeCh || cursor.ch > trigger.bodyEndCh) return null;

		const last = this.lastPick;
		if (last && last.line === cursor.line && last.ch === cursor.ch && last.text === text) {
			return null;
		}
		this.lastPick = null;

		if (triggerInCode(editor, cursor, trigger)) return null;

		const metaStart = trigger.pipeCh + 1;
		const slot = slotAt(text.slice(metaStart, trigger.bodyEndCh), cursor.ch - metaStart);
		this.slot = {
			...slot,
			line: cursor.line,
			text,
			metaStart,
			triggerCh: trigger.triggerCh,
			role: trigger.role,
			calloutId: trigger.id,
		};
		return {
			start: { line: cursor.line, ch: metaStart + slot.wordFrom },
			end: cursor,
			query: slot.query,
		};
	}

	getSuggestions(_context: EditorSuggestContext): MetadataSuggestion[] {
		const slot = this.slot;
		if (!slot) return [];
		const resolved = resolveCalloutDef(this.plugin.registry, slot.calloutId);
		// The injector's, so a colour its stylesheet stands down on (a word the
		// user's own snippet styles) is never offered as one.
		const injector = this.plugin.cssInjector;
		const rows = buildMetadataSuggestions({
			slot,
			calloutId: slot.calloutId,
			themeOwned: !resolved.unknown && resolved.themeOwned,
			colors: injector.metadataColorEntries(),
			sources: injector.metadataCatalog.sourcesNow(),
			locale: getLocale(),
		}).slice(0, ROW_LIMIT);
		// Headings over the rows that will actually show, not the ones cut off.
		const headings = metadataRowHeadings(rows);
		const withHeadings = headings.some((h) => h !== null);
		this.headings = new Map();
		this.hints = new Map();
		rows.forEach((row, i) => {
			const heading = headings[i];
			if (heading) this.headings.set(row, heading);
			this.hints.set(row, hintOf(row, withHeadings));
		});
		return rows;
	}

	/**
	 * Obsidian's suggestion list calls this on its owner whenever the
	 * highlighted row changes — by arrow key, by hover, and once on opening.
	 * Undeclared in the API, like `suggestions`: a version that never calls it
	 * just never shows the hint line.
	 */
	onSelectedChange(item: MetadataSuggestion | undefined): void {
		this.hintEl?.setText((item && this.hints.get(item)) ?? "");
	}

	/**
	 * The one line at the bottom of the popup that says what the highlighted
	 * row needs — where its word may stand, which colour it replaces — instead
	 * of every row repeating it. Always there, empty when the row needs
	 * nothing, so the popup keeps its height while the arrow keys move.
	 */
	private ensureHintLine(listEl: HTMLElement | null): void {
		const container = listEl?.parentElement;
		if (!container) return;
		if (this.hintEl?.parentElement === container) return;
		this.hintEl = container.createDiv({ cls: "cs-meta-suggestion-footer" });
	}

	renderSuggestion(item: MetadataSuggestion, el: HTMLElement): void {
		const listEl = el.closest<HTMLElement>(".suggestion");
		listEl?.addClass("callout-studio-suggestion-list");
		listEl?.addClass("cs-meta-suggestion-list");
		listEl?.toggleClass("cs-meta-suggestion-grouped", this.headings.size > 0);
		this.ensureHintLine(listEl);
		const heading = this.headings.get(item);
		const parent = el.parentElement;
		if (heading && parent) {
			// A sibling of the rows, never a row: Obsidian's list only walks the
			// elements it made, so arrow keys pass the heading by.
			const headingEl = parent.createDiv({
				cls: "cs-meta-suggestion-heading",
				text: heading.kind === "colors" ? t("metadataSuggest.colors") : heading.label,
			});
			parent.insertBefore(headingEl, el);
		}
		el.addClass("callout-studio-suggestion");
		const iconEl = el.createDiv({ cls: "callout-studio-suggestion-icon" });
		const textEl = el.createDiv({ cls: "callout-studio-suggestion-text" });
		const name = (text: string) =>
			textEl.createDiv({ cls: "callout-studio-suggestion-name", text });

		switch (item.kind) {
			case "finish":
				setIcon(iconEl, "corner-down-left");
				name(t("metadataSuggest.finish"));
				return;
			case "typed":
				el.addClass("callout-studio-suggestion-create-new");
				setIcon(iconEl, "text-cursor-input");
				name(t("metadataSuggest.useTyped", { text: item.text }));
				return;
			case "theme":
				setIcon(iconEl, "brush");
				name(item.word.word).addClass("cs-meta-suggestion-word");
				return;
			case "color": {
				// The word alone, in its colour: it is what gets written, and the
				// palette's display name would only say it twice.
				const colors = resolveCurrentModeColors(item.entry.palette);
				renderColorCircles(iconEl, colors, { size: 14 });
				const nameEl = name(item.entry.key);
				nameEl.addClass("cs-meta-suggestion-word");
				nameEl.style.color = colors.accent;
				if (item.viaAlias) {
					nameEl.createSpan({ cls: "cs-meta-suggestion-alias", text: ` · ${item.viaAlias}` });
				}
				return;
			}
		}
	}

	selectSuggestion(item: MetadataSuggestion, evt: MouseEvent | KeyboardEvent): void {
		const slot = this.slot;
		const ctx = this.context;
		if (!slot || !ctx) return;
		if (evt instanceof KeyboardEvent) {
			evt.preventDefault();
			evt.stopPropagation();
		}
		const key = pickKeyOf(evt);
		this.close();

		const { editor } = ctx;
		// Read and written in the same tick as the trigger, but a line that
		// moved anyway is not ours to rewrite.
		if (editor.getLine(slot.line) !== slot.text) return;

		const edit = applyMetadataPick(slot, item);
		if (edit.metadata !== slot.metadata) {
			editor.replaceRange(
				edit.metadata,
				{ line: slot.line, ch: slot.metaStart },
				{ line: slot.line, ch: slot.metaStart + slot.metadata.length },
			);
		}

		if (key === "tab" && item.kind !== "finish") {
			const ch = slot.metaStart + edit.cursor;
			this.lastPick = { line: slot.line, ch, text: editor.getLine(slot.line) };
			parkCursor(editor, { line: slot.line, ch });
			return;
		}
		this.finishHeader(editor, slot);
	}

	/**
	 * Close the token and land the cursor the way Enter on a type does —
	 * rebuilding a block or heading header through the same writer, so a fold
	 * mark the definition asks for and its title arrive here too, while a title
	 * or mark the user already wrote is kept.
	 */
	private finishHeader(editor: Editor, slot: OpenSlot): void {
		const lineNo = slot.line;
		const trigger = readCalloutTrigger(
			editor.getLine(lineNo),
			slot.triggerCh + 2,
			this.plugin.settings,
		);
		if (!trigger || trigger.triggerCh !== slot.triggerCh) return;
		if (trigger.closeCh === -1) {
			editor.replaceRange("]", { line: lineNo, ch: trigger.bodyEndCh });
		}
		const line = editor.getLine(lineNo);
		const closeCh = line.indexOf("]", slot.triggerCh + 2);

		if (slot.role === "inline") {
			// Past a `{…}` payload too, when the pill carries one.
			const token = scanLineForCalloutTokens(line, {
				inlineContent: this.plugin.settings.inlineCallouts.allowContent,
			}).find((tok) => tok.from === slot.triggerCh);
			landAfterInlineToken(editor, lineNo, token ? tokenEnd(token) : closeCh + 1);
			return;
		}

		const role = slot.role;
		const afterHeader = line.slice(closeCh + 1);
		const resolved = resolveCalloutDef(this.plugin.registry, trigger.id);
		const def = resolved.unknown ? undefined : resolved.def;
		if (!def) {
			placeCursorAfterPick(editor, lineNo, role, afterHeader.trim() === "");
			return;
		}
		const metaSuffix = metadataSuffixOf(line, slot.triggerCh);
		const lineEnd = { line: lineNo, ch: line.length };
		const start = { line: lineNo, ch: slot.triggerCh };
		if (role === "heading") {
			editor.replaceRange(
				buildHeadingToken(def, { matchedId: trigger.id, metaSuffix, existingTitle: afterHeader }),
				start,
				lineEnd,
			);
			placeCursorAfterPick(editor, lineNo, "heading", afterHeader.trim() === "");
			return;
		}
		const { foldMark, title } = splitFoldMark(afterHeader, "regular");
		const existingTitle = title.trim();
		editor.replaceRange(
			buildBlockHeaderToken(def, {
				matchedId: trigger.id,
				metaSuffix,
				existingTitle,
				// The mark the user wrote stays; none written → the definition's.
				foldMark: foldMark === "" ? undefined : foldMark,
				isKnownDisplayName: (text) =>
					this.plugin.registry
						.getAll()
						.some((d) => d.displayName.toLowerCase() === text.toLowerCase()),
			}),
			start,
			lineEnd,
		);
		placeCursorAfterPick(editor, lineNo, "regular", existingTitle === "");
	}
}

/**
 * What the hint line says while `row` is highlighted. Without headings, a
 * theme's word also names its source there, since nothing else would. A
 * colour with nothing more pressing to say answers what a theme's word
 * answers — where it may stand — since beside one that must be spaced, a
 * colour saying nothing reads as the same rule.
 */
function hintOf(row: MetadataSuggestion, withHeadings: boolean): string {
	const parts: string[] = [];
	if (row.kind === "theme") {
		if (!withHeadings) parts.push(row.source);
		const placement = placementHint(row.word.placement);
		if (placement) parts.push(placement);
	} else if (row.kind === "color") {
		if (row.replaces) parts.push(t("metadataSuggest.replaces", { word: row.replaces.text }));
		if (row.themeAlso) parts.push(t("metadataSuggest.themeAlso"));
		if (parts.length === 0) parts.push(t("metadataSuggest.anySeparator"));
	}
	return parts.join(" · ");
}

/** The one-line warning a styling word carries about where it may stand. */
function placementHint(placement: string): string | null {
	switch (placement) {
		case "spaced": return t("metadataSuggest.needsSpace");
		case "first": return t("metadataSuggest.mustBeFirst");
		case "last": return t("metadataSuggest.mustBeLast");
		case "alone": return t("metadataSuggest.alone");
		default: return null;
	}
}
