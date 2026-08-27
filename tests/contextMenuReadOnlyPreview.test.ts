/**
 * tests/contextMenuReadOnlyPreview.test.ts — the right-click menu inside a
 * read-only preview.
 *
 * The settings previews host a *real* embedded Obsidian editor, which is what
 * makes them 1:1 with a note — and what gave them a real editor context menu,
 * Format / Paragraph / Insert included. Those items call the editor API
 * directly, so none of them was ever stopped by `EditorState.readOnly`: a user
 * could right-click the "read-only" splash screen and turn its sample into a
 * bulleted list, an H1, a table, a code block or a callout.
 *
 * `settings/previewReadOnly.ts` is the guarantee — its transaction filter drops
 * the change whatever triggered it. This is the other half: the menu should
 * stop *offering* a dozen commands whose only effect is now a notice.
 *
 * The section names asserted below are Obsidian's own — the identifiers it
 * declares when building the editor menu, not the user-visible titles, so this
 * holds in every language. Two things follow from that and are pinned here:
 * the set of sections that must go, and the set that must stay, because
 * over-filtering is the failure mode that would quietly cost the user Copy.
 */
import "./support/fakeDom";
import assert from "node:assert";
import { describe, it } from "node:test";
import type { Menu } from "obsidian";
import { asEl, el } from "./support/fakeDom";
import {
	PREVIEW_BODY_CLASS,
	isEditingSection,
	isReadOnlyPreviewTarget,
	stripEditingItems,
} from "../src/editor/contextmenu/readOnlyPreview";

/**
 * Every section Obsidian's editor context menu declares, in its own order.
 *
 * Copied verbatim from the `addSections([...])` call that builds it, so this
 * suite is testing against the real menu rather than a convenient subset. `""`
 * is core's placeholder for "unsectioned", which is why it is in the list.
 */
const EDITOR_MENU_SECTIONS = [
	"title",
	"correction",
	"spellcheck",
	"open",
	"selection-link",
	"selection",
	"selection.format",
	"selection.paragraph",
	"selection.paragraph.list",
	"selection.paragraph.heading",
	"selection.paragraph.block",
	"selection.insert.basic",
	"selection.insert.advanced",
	"insert",
	"clipboard",
	"info",
	"info.copy",
	"action",
	"view",
	"",
	"danger",
] as const;

/** The sections that exist only to change the document. */
const MUST_GO = [
	"correction",
	"spellcheck",
	"selection-link",
	"selection.format",
	"selection.paragraph",
	"selection.paragraph.list",
	"selection.paragraph.heading",
	"selection.paragraph.block",
	"selection.insert.basic",
	"selection.insert.advanced",
	"insert",
];

/**
 * The sections a read-only preview must keep.
 *
 * `clipboard` is the interesting one. It holds Cut, Copy, Paste, Paste as
 * plain text and Select all — a mix — and it stays whole on purpose: Copy and
 * Select all are exactly what a read-only preview should still offer, and Cut
 * and Paste are now inert, so they explain themselves with the notice instead
 * of sitting greyed out. `selection` holds Edit link / Edit tag, which only
 * move the selection. The rest is lookup and link handling — which is what
 * makes the splash screen's "Learn more" link work.
 */
const MUST_STAY = [
	"title",
	"open",
	"selection",
	"clipboard",
	"info",
	"info.copy",
	"action",
	"view",
	"",
	"danger",
];

/** A `Menu` stand-in: core builds `items` as a flat array, and so does this. */
function fakeMenu(sections: readonly string[]): Menu & {
	items: Array<{ section?: string }>;
} {
	return {
		items: sections.map((section) => ({ section })),
	} as unknown as Menu & {
		items: Array<{ section?: string }>;
	};
}

const sectionsOf = (menu: { items: Array<{ section?: string }> }): string[] =>
	menu.items.map((i) => i.section ?? "");

/* -------------------------------------------------------------------------- */
/* Which sections count as editing                                            */
/* -------------------------------------------------------------------------- */

describe("isEditingSection", () => {
	it("names every editing-only section of the real editor menu", () => {
		for (const section of MUST_GO) {
			assert.ok(isEditingSection(section), section);
		}
	});

	it("names none of the sections a preview must keep", () => {
		for (const section of MUST_STAY) {
			assert.ok(!isEditingSection(section), section);
		}
	});

	it("covers a section nested under one it already knows", () => {
		// Matched by prefix rather than enumerated, so an Obsidian release that
		// adds `selection.format.advanced` needs no edit here.
		assert.ok(isEditingSection("selection.format.advanced"));
		assert.ok(isEditingSection("selection.insert.something-new"));
		assert.ok(isEditingSection("selection.paragraph.callout"));
	});

	it("does not swallow a sibling that merely shares a prefix", () => {
		// `selection` is the parent of the three editing subtrees and is NOT
		// itself one — Edit link and Edit tag live there and only move the
		// selection. A naive `startsWith("selection")` would take them.
		assert.ok(!isEditingSection("selection"));
		assert.ok(!isEditingSection("selection-link-preview"));
	});
});

/* -------------------------------------------------------------------------- */
/* Stripping                                                                  */
/* -------------------------------------------------------------------------- */

describe("stripEditingItems", () => {
	// >>> REGRESSION: Format / Paragraph / Insert edited the read-only preview <<<
	it("removes exactly the editing sections from the real menu", () => {
		const menu = fakeMenu(EDITOR_MENU_SECTIONS);
		stripEditingItems(menu);
		assert.deepStrictEqual(sectionsOf(menu), MUST_STAY);
	});

	it("keeps the clipboard section, so Copy survives", () => {
		// Stated on its own because it is the one a tighter filter would take
		// by accident, and losing it would make the splash screen's text
		// unselectable in practice.
		const menu = fakeMenu(EDITOR_MENU_SECTIONS);
		stripEditingItems(menu);
		assert.ok(sectionsOf(menu).includes("clipboard"));
	});

	it("removes every item of a section, not just the first", () => {
		const menu = fakeMenu([
			"clipboard",
			"selection.paragraph.heading",
			"selection.paragraph.heading",
			"selection.paragraph.heading",
			"clipboard",
		]);
		stripEditingItems(menu);
		assert.deepStrictEqual(sectionsOf(menu), ["clipboard", "clipboard"]);
	});

	it("leaves an item with no section alone", () => {
		// Separators arrive as entries with no `section` at all. Dropping them
		// on a `typeof` mismatch would silently restructure the menu.
		const menu = {
			items: [{}, { section: "insert" }, {}],
		} as unknown as Menu & {
			items: Array<{ section?: string }>;
		};
		stripEditingItems(menu);
		assert.strictEqual(menu.items.length, 2);
	});

	it("leaves a menu it does not recognise completely untouched", () => {
		// The transaction filter is the guarantee, so a menu that still offers
		// a dead command is a far smaller problem than a menu this function
		// broke. An absent or non-array `items` must therefore be a no-op.
		const noItems = {} as unknown as Menu;
		assert.doesNotThrow(() => stripEditingItems(noItems));
		assert.strictEqual((noItems as { items?: unknown }).items, undefined);

		const wrongShape = { items: "nope" } as unknown as Menu;
		assert.doesNotThrow(() => stripEditingItems(wrongShape));
		assert.strictEqual(
			(wrongShape as unknown as { items: string }).items,
			"nope",
		);
	});

	it("is idempotent", () => {
		const menu = fakeMenu(EDITOR_MENU_SECTIONS);
		stripEditingItems(menu);
		const once = sectionsOf(menu);
		stripEditingItems(menu);
		assert.deepStrictEqual(sectionsOf(menu), once);
	});
});

/* -------------------------------------------------------------------------- */
/* Scope — the half that keeps notes safe                                     */
/* -------------------------------------------------------------------------- */

describe("isReadOnlyPreviewTarget", () => {
	it("is true for an element inside a preview body", () => {
		const body = el({ cls: `cs-live-preview-body ${PREVIEW_BODY_CLASS}` });
		const line = el({ cls: "cm-line" });
		const span = el({ cls: "cs-inline-callout" });
		asEl(line).appendChild(asEl(span));
		asEl(body).appendChild(asEl(line));
		assert.strictEqual(isReadOnlyPreviewTarget(asEl(span)), true);
		assert.strictEqual(isReadOnlyPreviewTarget(asEl(body)), true);
	});

	it("is false inside an ordinary note", () => {
		// The whole reason the check is a container class rather than "is this
		// editor read-only": a note's right-click menu has to come back
		// completely untouched, Format submenu and all.
		const view = el({ cls: "markdown-source-view cm-s-obsidian" });
		const line = el({ cls: "cm-line" });
		asEl(view).appendChild(asEl(line));
		assert.strictEqual(isReadOnlyPreviewTarget(asEl(line)), false);
	});

	it("is false in the preview's static-render fallback", () => {
		// When the undocumented embed API is unavailable the preview degrades
		// to `MarkdownRenderer.render`, which is not an editor at all — there
		// is no editor menu to strip and nothing to protect.
		const body = el({ cls: "cs-live-preview-body markdown-preview-view" });
		const rendered = el({
			cls: "markdown-rendered cs-live-preview-render",
		});
		asEl(body).appendChild(asEl(rendered));
		assert.strictEqual(isReadOnlyPreviewTarget(asEl(rendered)), false);
	});
});
