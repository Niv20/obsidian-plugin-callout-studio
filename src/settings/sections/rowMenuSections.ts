/**
 * settings/sections/rowMenuSections.ts — the four groups of a callout row's
 * `⋯` menu, top to bottom.
 *
 * - **find** — *Find callouts*, on its own: the one item that leaves Settings.
 * - **notes** — *Replace in vault…* and *Convert uses to plain text*, the two
 *   that rewrite notes, directly under the count they act on.
 * - **callout** — *Duplicate*, *Reset to default* and *Use default fallback
 *   style*: the callout's own definition.
 * - **danger** — *Delete*, red and last.
 *
 * Obsidian draws a divider between two sections and keeps no section that has
 * no items, so a row that offers nothing in a group gets no stray line. Two
 * rules come with that. Obsidian orders sections by the first item added to
 * each, so every builder adds its items in this order. And a plain
 * `addSeparator()`, like an item with no section, sinks below every section,
 * so neither is used in these menus.
 */
export const ROW_MENU_SECTION = {
	find: "find",
	notes: "notes",
	callout: "callout",
	danger: "danger",
} as const;
