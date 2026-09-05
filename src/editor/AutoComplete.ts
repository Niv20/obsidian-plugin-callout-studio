/**
 * editor/AutoComplete.ts — In-editor autocomplete for callout IDs.
 *
 * Extends Obsidian's EditorSuggest to show a dropdown of known callout types
 * whenever the user types `[!` in any of the three role positions: after a
 * blockquote prefix (`> [!` — block callout), after heading hashes
 * (`## [!` — heading callout), or mid-line (inline callout). Selecting a
 * suggestion inserts role-appropriate markdown, and Enter placement differs
 * per role (see close()/selectSuggestion). The "Create new" row opens the
 * CalloutEditor pre-filled with the typed query in all three contexts.
 */
import {
	Editor,
	EditorPosition,
	EditorSuggest,
	EditorSuggestContext,
	EditorSuggestTriggerInfo,
	MarkdownView,
	Notice,
	TFile,
	setIcon,
} from "obsidian";
import type CalloutStudioPlugin from "../main";
import type { CalloutDefinition, CalloutRenderRole } from "../types";
import { CalloutEditor } from "../settings/CalloutEditor";
import { paintCalloutListIcon } from "../manager/theme/calloutListIcon";
import { getLocale, t } from "../i18n";
import { splitCalloutMetadata } from "../utils/calloutId";
import { suggestableCallouts } from "../utils/usableCallouts";
import { calloutMatchesQuery } from "../utils/calloutSearch";
import { isCalloutTokenInCode } from "./calloutCodeContext";
import {
	moveCursorToLineBelow,
	placeCursorAfterPick,
} from "./autoCompleteCursor";
import {
	buildBlockHeaderToken,
	buildHeadingToken,
	buildInlineToken,
	metadataSuffixOf,
	splitFoldMark,
} from "./calloutWriter";
import {
	getSortedCalloutIds,
	sortCalloutsByDisplayName,
} from "../utils/sorting";

/** Heading hashes + whitespace and nothing else before the `[!` trigger. */
const HEADING_TRIGGER_PREFIX_REGEX = /^#{1,6}[ \t]+$/;

interface CreateNewSuggestion {
	__createNew: true;
	query: string;
}

type CalloutSuggestion = CalloutDefinition | CreateNewSuggestion;

function isCreateNew(s: CalloutSuggestion): s is CreateNewSuggestion {
	return (s as CreateNewSuggestion).__createNew === true;
}

export class CalloutAutoComplete extends EditorSuggest<CalloutSuggestion> {
	private plugin: CalloutStudioPlugin;
	private pendingEditor: Editor | null = null;
	private pendingLine = -1;
	/** Role of the pending post-close cursor placement. */
	private pendingRole: CalloutRenderRole = "regular";
	/** Role classified by the latest onTrigger; read by selectSuggestion. */
	private triggerRole: CalloutRenderRole = "regular";

	constructor(plugin: CalloutStudioPlugin) {
		super(plugin.app);
		this.plugin = plugin;
	}

	close(): void {
		const editor = this.pendingEditor;
		const line = this.pendingLine;
		const role = this.pendingRole;
		this.pendingEditor = null;
		this.pendingLine = -1;
		this.pendingRole = "regular";
		super.close();

		if (editor && line >= 0) placeCursorAfterPick(editor, line, role);
	}

	/**
	 * Opens the suggest popover for a `[!` that was inserted programmatically
	 * (by the "Insert empty callout" / "Wrap in callout" commands). Obsidian's
	 * suggest manager only re-evaluates `onTrigger` on real keystrokes, so
	 * those commands otherwise leave the cursor after `[!` with no popup.
	 *
	 * We route through the workspace's internal EditorSuggests manager rather
	 * than calling `open()` ourselves. That is what registers us as the
	 * manager's `currentSuggest`, so the popover then behaves exactly like a
	 * natively-typed `!`: it follows the editor on scroll and auto-closes when
	 * the `!` is deleted. Calling `open()` directly produces a detached popover
	 * that ignores scroll, never closes on delete, and stays stuck on screen.
	 *
	 * The `true` third argument forces the manager to fetch suggestions and set
	 * itself as the current suggest even though we aren't already open. Deferred
	 * a frame so CM6 has flushed the insert and (when run from the command
	 * palette) focus has returned to the editor — the manager no-ops unless the
	 * editor is focused, hence the explicit `focus()`.
	 */
	triggerNow(editor: Editor, file: TFile | null): void {
		if (!file) return;
		window.requestAnimationFrame(() => {
			editor.focus();
			const manager = (
				this.app.workspace as unknown as {
					editorSuggest?: {
						trigger?: (
							editor: Editor,
							file: TFile,
							manual: boolean,
						) => void;
					};
				}
			).editorSuggest;
			manager?.trigger?.(editor, file, true);
		});
	}

	onTrigger(
		cursor: EditorPosition,
		editor: Editor,
		_file: TFile | null,
	): EditorSuggestTriggerInfo | null {
		if (!this.plugin.settings.autocomplete.enabled) return null;

		const line = editor.getLine(cursor.line);
		// Look for the `[!` trigger by scanning backward from the cursor. Its
		// position on the line decides which render role is being typed.
		const textBefore = line.slice(0, cursor.ch);
		const triggerIdx = textBefore.lastIndexOf("[!");

		if (triggerIdx === -1) return null;

		// Never trigger for escaped tokens (`\[!`) or wikilinks (`[[!`).
		const charBefore = triggerIdx > 0 ? textBefore[triggerIdx - 1] : "";
		if (charBefore === "\\" || charBefore === "[") return null;

		// Classify the trigger position into a render role.
		const rawPrefix = textBefore.slice(0, triggerIdx);
		const trimmedPrefix = rawPrefix.trimStart();
		const { headingCallouts, inlineCallouts } = this.plugin.settings;
		let role: CalloutRenderRole;
		if (/^>[\s>]*$/.test(trimmedPrefix)) {
			// "> [!", ">> [!", … — a native block callout header.
			role = "regular";
		} else if (HEADING_TRIGGER_PREFIX_REGEX.test(rawPrefix)) {
			// "## [!" — heading callout; no popup while the role is off.
			if (!headingCallouts.enabled) return null;
			role = "heading";
		} else if (trimmedPrefix === "") {
			// Bare "[!" at line start: an inline callout when the role is on;
			// otherwise keep the legacy block-callout behavior.
			role = inlineCallouts.enabled ? "inline" : "regular";
		} else {
			// Any other text before the token — inline callout mid-line.
			if (!inlineCallouts.enabled) return null;
			role = "inline";
		}

		// Capture the full token body (from `[!` to the next `]`, or end of
		// line), independent of where the cursor sits within it. Reading only up
		// to the cursor would mis-filter a mid-token cursor (e.g. `[!dang⎸aaaaa]`
		// would match "Danger" instead of offering "Create new: dangaaaaa").
		const afterTrigger = line.slice(triggerIdx + 2);
		const closeIdx = afterTrigger.indexOf("]");
		const body =
			closeIdx === -1 ? afterTrigger : afterTrigger.slice(0, closeIdx);

		// Only the type is a callout name; anything past the first `|` is
		// Obsidian metadata. Matching on the body whole would offer
		// "Create new: note|purple" for a perfectly ordinary `note` callout.
		const { id: query } = splitCalloutMetadata(body);

		// Stop once the cursor moves past the id — into the metadata, the fold
		// mark, or the title. All three are things the type dropdown has no say
		// over, so the popup closes rather than filtering on them.
		const idEndCh = triggerIdx + 2 + query.length;
		if (cursor.ch > idEndCh) return null;

		// A `[!` in code is code, exactly as every other reader of this syntax
		// already has it. Asked last, deliberately: it is the only check that
		// reads past this line, and by here the cursor is known to sit inside a
		// token — a handful of keystrokes, not every one.
		const inCode = isCalloutTokenInCode({
			line,
			tokenIndex: triggerIdx,
			lineIndex: cursor.line,
			lineAt: (index) => editor.getLine(index),
		});
		if (inCode) return null;

		this.triggerRole = role;

		return {
			start: { line: cursor.line, ch: triggerIdx },
			end: cursor,
			query,
		};
	}

	getSuggestions(context: EditorSuggestContext): CalloutSuggestion[] {
		const query = context.query.toLowerCase();
		// Exclude auto-created fallback rows only once Discovery's prune scan
		// has actually confirmed they're unused nowhere in the vault — e.g. a
		// token typed and abandoned before the async prune catches up. A
		// fallback row genuinely used elsewhere still autocompletes normally.
		// The role narrows it again — see onTrigger, which classified it.
		const all = suggestableCallouts(this.plugin.registry, this.triggerRole);

		// Filter — the same predicate the quick-insert window matches with, so
		// the two lists can never disagree about what a typed word finds.
		const filtered = all.filter((d) => calloutMatchesQuery(d, query));

		const sorted = sortCalloutsByDisplayName(filtered, getLocale());

		const result: CalloutSuggestion[] = [...sorted];
		// Append "Create new" if query is non-empty and no exact match
		const trimmed = context.query.trim();
		if (trimmed.length > 0) {
			const exact = all.some(
				(d) =>
					d.id.toLowerCase() === query ||
					(d.aliases ?? []).some((a) => a.toLowerCase() === query),
			);
			if (!exact) {
				result.push({ __createNew: true, query: trimmed });
			}
		}
		return result;
	}

	renderSuggestion(item: CalloutSuggestion, el: HTMLElement): void {
		if (isCreateNew(item)) {
			el.addClass("callout-studio-suggestion");
			el.addClass("callout-studio-suggestion-create-new");
			const iconEl = el.createDiv({
				cls: "callout-studio-suggestion-icon",
			});
			setIcon(iconEl, "plus");
			const textEl = el.createDiv({
				cls: "callout-studio-suggestion-text",
			});
			textEl.createDiv({
				cls: "callout-studio-suggestion-name",
				text: t("autocomplete.createNew", { name: item.query }),
			});
			return;
		}
		const def = item;
		el.addClass("callout-studio-suggestion");

		const isDark = activeDocument.body.classList.contains("theme-dark");

		// A callout the theme owns keeps its place in the list — it is still a
		// real id worth inserting — but wears the theme's icon and colour, not
		// the ones stored on its row. Naming an appearance here that the callout
		// will not have on the page is the one thing the entry must not do, and
		// this line used to do it: it tested the raw `externalStyle` field,
		// which a theme-owned callout never carries.
		const iconEl = el.createDiv({
			cls: "callout-studio-suggestion-icon",
		});
		const color = paintCalloutListIcon(iconEl, def, this.plugin.registry, isDark);
		iconEl.style.color = color;

		// Text container
		const textEl = el.createDiv({ cls: "callout-studio-suggestion-text" });
		const nameEl = textEl.createDiv({
			cls: "callout-studio-suggestion-name",
			text: def.displayName,
		});
		nameEl.style.color = color;

		// Second line: id + aliases. When the user has typed something, show
		// only the ids/aliases that contain the query, keeping the matched
		// characters at the normal color — wherever they fall, not only at the
		// start — and fading the rest. With no query (or when only the display
		// name matched), show them all unfaded.
		const query = (this.context?.query ?? "").toLowerCase();
		const allIds = getSortedCalloutIds(def, getLocale());
		const matches =
			query.length > 0
				? allIds.filter((id) => id.toLowerCase().includes(query))
				: [];
		const toShow = matches.length > 0 ? matches : allIds;
		const highlight = query.length > 0 && matches.length > 0;

		const idEl = textEl.createDiv({
			cls: "callout-studio-suggestion-id",
		});
		const fade = (text: string) => {
			if (text)
				idEl.createSpan({
					cls: "callout-studio-suggestion-id-dim",
					text,
				});
		};
		toShow.forEach((id, i) => {
			if (i > 0) idEl.appendText(", ");
			if (highlight) {
				// Matched run stays normal; everything around it fades out.
				const at = id.toLowerCase().indexOf(query);
				fade(id.slice(0, at));
				idEl.appendText(id.slice(at, at + query.length));
				fade(id.slice(at + query.length));
			} else {
				idEl.appendText(id);
			}
		});
	}

	/**
	 * The `|metadata` suffix (pipe included) of the `[!…]` token opening at
	 * `startCh` on `line`, or "" when it carried none.
	 *
	 * Every rewrite path below replaces the whole bracket span, so it has to put
	 * back what the user already wrote there: metadata belongs to the
	 * occurrence, not to the callout type, and picking a different type from the
	 * dropdown is no reason to drop it.
	 */
	private tokenMetadataSuffix(line: string, startCh: number): string {
		return metadataSuffixOf(line, startCh);
	}

	/** Whether a title is just some callout's display name, not the user's own. */
	private isKnownDisplayName = (title: string): boolean =>
		this.plugin.registry
			.getAll()
			.some((d) => d.displayName.toLowerCase() === title.toLowerCase());

	selectSuggestion(
		item: CalloutSuggestion,
		evt: MouseEvent | KeyboardEvent,
	): void {
		if (!this.context) return;
		if (evt instanceof KeyboardEvent) {
			evt.preventDefault();
			evt.stopPropagation();
		}

		// Handle "Create new" — open editor pre-filled with the typed query
		if (isCreateNew(item)) {
			const ctx = this.context;
			void this.openCreateForQuery(item.query, ctx);
			return;
		}

		const def = item;
		const { editor, start, end, query } = this.context;

		const line = editor.getLine(start.line);

		// If the user typed an alias, use that alias as the ID
		const queryLower = query.toLowerCase();
		const allIds = [def.id, ...(def.aliases ?? [])];
		const matchedId =
			allIds.find((id) => id.toLowerCase() === queryLower) ??
			allIds.find((id) => id.toLowerCase().startsWith(queryLower)) ??
			def.id;

		// Inline pill: only the token itself is written; Enter continues on
		// the same line (see insertInlineToken).
		if (this.triggerRole === "inline") {
			this.insertInlineToken(editor, start, end, line, def, matchedId);
			return;
		}

		// Parse what already exists after the `[!...]` on the line, starting from
		// the header (not the cursor) so a mid-token cursor doesn't truncate the
		// title detection.
		const afterTrigger = line.slice(start.ch + 2);
		const closeIdx = afterTrigger.indexOf("]");
		const afterHeader =
			closeIdx === -1 ? "" : afterTrigger.slice(closeIdx + 1);
		const metaSuffix = this.tokenMetadataSuffix(line, start.ch);

		// Replace from trigger start to end of line
		const lineEnd: EditorPosition = {
			line: end.line,
			ch: line.length,
		};

		// Heading callout: the rendered token already shows the display name,
		// so no title text is inserted; a custom title the user already wrote
		// is preserved — everything after `]` is title, this role has no fold
		// syntax of its own. Enter then moves to the start of the next line (no
		// `>` prefix — heading callouts have no body), via close().
		if (this.triggerRole === "heading") {
			const replacement = buildHeadingToken(def, {
				matchedId,
				metaSuffix,
				existingTitle: afterHeader,
			});
			editor.replaceRange(replacement, start, lineEnd);
			this.pendingEditor = editor;
			this.pendingLine = start.line;
			this.pendingRole = "heading";
			return;
		}

		// Regular callout header: an optional fold mark after the `]`, then the
		// title. The role is the splitter's argument, not the caller's position.
		const existingTitle = splitFoldMark(
			afterHeader,
			this.triggerRole,
		).title.trim();

		// Detect if this is a brand-new callout (no title text after the header)
		const isNewCallout = existingTitle === "";

		const replacement = buildBlockHeaderToken(def, {
			matchedId,
			metaSuffix,
			existingTitle,
			isKnownDisplayName: this.isKnownDisplayName,
		});
		editor.replaceRange(replacement, start, lineEnd);

		if (isNewCallout) {
			this.pendingEditor = editor;
			this.pendingLine = start.line;
			this.pendingRole = "regular";
		}
	}

	/**
	 * Insert an inline `[!id]` pill token: replaces only the typed token
	 * (never the rest of the line), guarantees one space after the `]`, and
	 * parks the cursor after that space so the user keeps writing on the
	 * SAME line — pressing Enter on a pill suggestion must not break the
	 * paragraph.
	 */
	private insertInlineToken(
		editor: Editor,
		start: EditorPosition,
		contextEnd: EditorPosition,
		line: string,
		def: CalloutDefinition,
		insertId: string,
	): void {
		const afterTrigger = line.slice(start.ch + 2);
		const closeIdx = afterTrigger.indexOf("]");
		const tokenEnd: EditorPosition =
			closeIdx === -1
				? contextEnd
				: { line: start.line, ch: start.ch + 2 + closeIdx + 1 };
		const token = buildInlineToken(def, {
			matchedId: insertId,
			metaSuffix: this.tokenMetadataSuffix(line, start.ch),
		});
		editor.replaceRange(token, start, tokenEnd);

		const afterCh = start.ch + token.length;
		const newLine = editor.getLine(start.line);
		if (newLine[afterCh] !== " ") {
			editor.replaceRange(" ", { line: start.line, ch: afterCh });
		}
		editor.setCursor({ line: start.line, ch: afterCh + 1 });
	}

	/**
	 * The live text of the line the trigger was typed on, or null when it is no
	 * longer the line we started from.
	 *
	 * Every position `openCreateForQuery` captured is a snapshot taken before an
	 * unbounded wait: the user can sit in CalloutEditor for minutes while the
	 * note is edited from another pane, rewritten by sync, or swapped out of the
	 * leaf entirely. Writing a captured range then would run past the end of a
	 * line that shrank, clobber text typed after the trigger, or land in a
	 * different note. Same principle the context-menu handlers already follow —
	 * recompute from the live document and compare against what was expected.
	 */
	private liveTriggerLine(
		editor: Editor,
		file: TFile,
		start: EditorPosition,
	): string | null {
		// Did this editor's leaf move to another note while the modal was open?
		// Compared against the editor's OWN view rather than the active one, so
		// a write into an unfocused-but-unchanged pane is not refused.
		for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
			const view = leaf.view;
			if (view instanceof MarkdownView && view.editor === editor) {
				if (view.file !== file) return null;
				break;
			}
		}
		if (start.line >= editor.lineCount()) return null;
		const line = editor.getLine(start.line);
		// onTrigger anchors `start` on the `[!` it matched (see its return), so
		// anything else there means the token moved or is gone.
		return line.startsWith("[!", start.ch) ? line : null;
	}

	private async openCreateForQuery(
		query: string,
		ctx: EditorSuggestContext,
	): Promise<void> {
		// Snapshot the role now: close() and the modal round-trip may let
		// another onTrigger run and overwrite triggerRole.
		const role = this.triggerRole;
		this.close();
		const editor = ctx.editor;
		const file = ctx.file;
		const start = ctx.start;
		const end = ctx.end;
		const modal = new CalloutEditor(this.plugin, undefined, {
			seedDisplayName: query,
			createFromAutocomplete: true,
		});
		const result = await modal.openAndWait();
		if (!result) return;

		// Nothing below may trust a position captured before that await.
		const line = this.liveTriggerLine(editor, file, start);
		if (line === null) {
			new Notice(t("notice.autocompleteTargetMoved"));
			return;
		}
		// Both ends are re-derived from the line as it stands now. `end` was the
		// cursor at trigger time and only matters for an unterminated token (no
		// `]` to close it), where it stops the insert from eating the rest of
		// the line — so it is clamped rather than replaced.
		const lineEnd: EditorPosition = { line: start.line, ch: line.length };
		const tokenEnd: EditorPosition = {
			line: start.line,
			ch: Math.min(Math.max(end.ch, start.ch), line.length),
		};

		if (role === "inline") {
			editor.focus();
			this.insertInlineToken(
				editor,
				start,
				tokenEnd,
				line,
				result,
				result.id,
			);
			return;
		}

		// The token the user typed is still on the line, metadata included, and
		// every branch below replaces it.
		const metaSuffix = this.tokenMetadataSuffix(line, start.ch);

		if (role === "heading") {
			// No title text — the rendered token shows the display name.
			editor.replaceRange(
				buildHeadingToken(result, { metaSuffix }),
				start,
				lineEnd,
			);
			// close() already ran (before the modal), so place the cursor
			// directly rather than via the pending mechanism.
			editor.focus();
			moveCursorToLineBelow(editor, start.line);
			return;
		}

		const replacement = buildBlockHeaderToken(result, { metaSuffix });
		editor.replaceRange(replacement, start, lineEnd);
		this.pendingEditor = editor;
		this.pendingLine = start.line;
		this.pendingRole = "regular";
	}
}
