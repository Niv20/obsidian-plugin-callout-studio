/**
 * editor/contextmenu/readOnlyPreview.ts — Keeping the editing commands out of a
 * read-only preview's right-click menu.
 *
 * The settings previews host a *real* embedded Obsidian editor, which means
 * they get Obsidian's real editor context menu — Format, Paragraph and Insert
 * included. Every one of those items calls the editor API directly, so none of
 * them was ever stopped by `EditorState.readOnly` (see
 * `settings/previewReadOnly.ts`). `readOnlyPreviewExtensions` now drops the
 * transactions, which is the guarantee; this module is the other half, so the
 * menu stops *offering* twelve commands that would only produce a notice.
 *
 * ## Why filtering `menu.items` works, and when
 *
 * `Menu` collects items into a flat `items` array as they are added, and only
 * sorts them into sections — building the DOM — inside `showAtPosition()`. The
 * plugin already patches `showAtMouseEvent` and `showAtPosition` and runs
 * *before* delegating to the original, so at that moment the array is complete
 * and nothing has been rendered yet. Removing entries is therefore enough: no
 * DOM surgery, and a section left empty takes its submenu header with it,
 * because the header is synthesised during the same sort. `showAtPosition` also
 * bails on an empty `items`, so over-filtering degrades to "no menu" rather
 * than to a broken one.
 *
 * ## What is dropped, and what is deliberately kept
 *
 * The section names below are Obsidian's own, declared where it builds the
 * editor menu. They are stable identifiers rather than user-visible titles, so
 * this survives translation; a rename in a future Obsidian version degrades to
 * the menu showing items that no longer do anything, never to a crash.
 *
 * Kept on purpose:
 * - `clipboard` — Copy and Select all are exactly the harmless actions a
 *   read-only preview should keep. Cut and Paste stay visible and are now
 *   inert: the transaction filter drops them and shows "The live preview can't
 *   be edited", which tells the user more than a greyed-out row would.
 * - `selection` — Edit link / Edit tag only move the selection.
 * - `title`, `open`, `info`, `info.copy`, `view`, `action` — lookup and link
 *   handling, which is what makes the splash screen's **Learn more** link work.
 */
import type { Menu } from "obsidian";

/**
 * The class `LiveCalloutPreview` adds to the editor body — and only on the
 * embedded-editor path, never on the static fallback and never on a note. It is
 * the whole test for "is this a preview", which is what keeps every rule in
 * this module off the user's real editors.
 */
export const PREVIEW_BODY_CLASS = "cs-live-preview-editable";

/**
 * Sections that exist only to change the document.
 *
 * Exact matches; {@link EDITING_SECTION_PREFIXES} covers the nested ones, so a
 * future `selection.format.advanced` needs no edit here.
 */
const EDITING_SECTIONS: ReadonlySet<string> = new Set([
	// Insert link / Insert external link.
	"selection-link",
	// The top-level Insert group, where core files anything not nested under
	// `selection.insert`.
	"insert",
	// Spellcheck replacements — these mutate through Electron rather than
	// through a command, so they are worth removing rather than leaving to be
	// blocked: a suggestion that visibly does nothing reads as a bug.
	"correction",
	"spellcheck",
]);

/** Section prefixes whose whole subtree is editing-only. */
const EDITING_SECTION_PREFIXES: readonly string[] = [
	// Bold, italic, strikethrough, highlight, inline code.
	"selection.format",
	// Lists, headings, block quote.
	"selection.paragraph",
	// Footnote, table, callout, horizontal rule, code block, math block.
	"selection.insert",
];

/** The sliver of `Menu` this module touches, all of it internal. */
interface MenuInternals {
	items?: Array<{ section?: string }>;
}

/** True when `el` sits inside an embedded read-only preview. */
export function isReadOnlyPreviewTarget(el: Element): boolean {
	return el.closest(`.${PREVIEW_BODY_CLASS}`) !== null;
}

/** True for a section whose items exist only to change the document. */
export function isEditingSection(section: string): boolean {
	if (EDITING_SECTIONS.has(section)) return true;
	return EDITING_SECTION_PREFIXES.some(
		(prefix) => section === prefix || section.startsWith(`${prefix}.`),
	);
}

/**
 * Remove every editing-only item from `menu`, in place.
 *
 * Tolerant of a `Menu` that does not look the way this expects: an absent or
 * non-array `items` is left alone rather than replaced, because the transaction
 * filter is the guarantee and a menu that still offers a dead command is a much
 * smaller problem than a menu this function broke.
 */
export function stripEditingItems(menu: Menu): void {
	const internals = menu as unknown as MenuInternals;
	const { items } = internals;
	if (!Array.isArray(items)) return;
	internals.items = items.filter((item) => {
		const section = item?.section;
		return typeof section !== "string" || !isEditingSection(section);
	});
}
