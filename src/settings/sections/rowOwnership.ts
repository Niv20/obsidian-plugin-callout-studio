/**
 * settings/sections/rowOwnership.ts — which of the three groups a callout row
 * belongs in, and what its destructive action may honestly claim to do.
 *
 * ## The group is the label
 *
 * Rows used to carry a `Theme` / `Studio` pill because the list was grouped by
 * *origin* — where a callout came from — while the thing a reader actually
 * needs to know is *who paints it*. Two facts, one row, so one of them had to
 * be spelled out in text.
 *
 * They are one fact now, and it is not a setting: a callout appears under
 * *Callouts from your theme* exactly when the active theme names its id, which
 * is also exactly when this plugin emits nothing for it. Switch theme and rows
 * move; there is no state to migrate because there is no state.
 *
 * {@link isThemeStyled} is that rule, and it is one clause — `themeOwns`. The
 * three-clause version it replaced existed to support a manual mode that no
 * longer exists, and each clause it lost is worth recording:
 *
 * - `standsDown` also answers true for a callout the user handed to **their
 *   own CSS**, and those rows stay in the user's own section wearing an
 *   *External CSS* label. Grouping them under the theme would name the wrong
 *   owner.
 * - *"…or it is a built-in"* let a built-in be filed under the theme merely
 *   because nobody had configured it. A built-in now moves only when the theme
 *   genuinely names it — which, measured across the 257 themes in the dev
 *   vault, 48 of them do, 27 of those for every single built-in id.
 * - *"the theme styles callouts at all"* was a guard against exactly that
 *   over-reach and is now implied: an id cannot be named by a theme that says
 *   nothing about callouts.
 *
 * Its own module because `CalloutRowActions.ts` sits at the line cap the
 * repo's ratchet freezes it at.
 */
import { Menu } from "obsidian";
import { t } from "../../i18n";
import {
	handleCalloutDelete,
	handleClearCalloutUsages,
} from "./calloutVaultActions";
import type { CalloutDefinition } from "../../types";
import type { SettingsSectionContext } from "./types";

/** Which list a row is being drawn in. Decides the row's whole control set. */
export type RowKind = "theme" | "user" | "builtin";

/** The one fact {@link isThemeStyled} needs, gathered once per render. */
export interface StyleOwnerFacts {
	themeOwns: (def: CalloutDefinition) => boolean;
}

/** Read the facts off the live plugin. */
export function styleOwnerFacts(ctx: SettingsSectionContext): StyleOwnerFacts {
	return { themeOwns: (def) => ctx.plugin.registry.themeOwns(def) };
}

/** {@link isThemeStyled}, asked of the live plugin. */
export function isThemeSupplied(
	ctx: SettingsSectionContext,
	def: CalloutDefinition,
): boolean {
	return ctx.plugin.registry.themeOwns(def);
}

/** Whether this row belongs under *Callouts from your theme*. */
export function isThemeStyled(
	facts: StyleOwnerFacts,
	def: CalloutDefinition,
): boolean {
	return facts.themeOwns(def);
}

/**
 * Split every row into the three lists. Taking all of them at once is what
 * makes "appears exactly once" true by construction rather than by agreement
 * between three separate filters.
 */
export function partitionByStyleOwner(
	facts: StyleOwnerFacts,
	rows: readonly CalloutDefinition[],
): {
	fromTheme: CalloutDefinition[];
	own: CalloutDefinition[];
	builtIn: CalloutDefinition[];
} {
	const fromTheme: CalloutDefinition[] = [];
	const own: CalloutDefinition[] = [];
	const builtIn: CalloutDefinition[] = [];
	for (const def of rows) {
		if (isThemeStyled(facts, def)) fromTheme.push(def);
		else if (def.builtIn) builtIn.push(def);
		else own.push(def);
	}
	return { fromTheme, own, builtIn };
}

/**
 * Whether Delete can really remove this callout, or only clear its usages.
 *
 * Three of the five sources cannot be removed at all, for the same underlying
 * reason: something outside this plugin keeps declaring the id, so the row
 * would come straight back. A built-in is one of Obsidian's thirteen and the
 * registry always seeds it; a callout the active theme names is re-minted by
 * the next theme sweep. What Delete can honestly do in those cases is what it
 * has always done for built-ins — turn the existing `[!id]` usages into plain
 * paragraphs and leave the type where it is.
 */
export function deleteRemovesRow(
	ctx: SettingsSectionContext,
	def: CalloutDefinition,
): boolean {
	return !def.builtIn && !isThemeSupplied(ctx, def);
}

/**
 * The `⋯` item that clears a theme callout's uses from the vault.
 *
 * Split from {@link addDeleteItem} because the *word* has to differ here. On a
 * row the plugin owns, "Delete" is what happens; on a theme row nothing is
 * deleted — the type is the theme's and survives — and calling it Delete is
 * the single most misleading thing this menu could say. The confirmation goes
 * on to explain that nothing belonging to the theme was touched, but the menu
 * has to be true before the user clicks it.
 */
export function addClearUsesItem(
	menu: Menu,
	ctx: SettingsSectionContext,
	def: CalloutDefinition,
	usage: { fileCount: number; totalCount: number },
): void {
	if (usage.fileCount === 0) return;
	menu.addItem((item) =>
		item
			.setTitle(t("settings.clearUsesAction"))
			.setIcon("eraser")
			.onClick(() => {
				void handleClearCalloutUsages(ctx, def, usage);
			}),
	);
}

/**
 * Fill a row menu's destructive slot with whichever Delete is truthful here.
 *
 * Both branches are labelled *Delete*: which one it is is not something a user
 * should have to learn from a menu, it is something the confirmation spells out
 * at the moment it matters. A row whose definition survives shows the item only
 * when the callout is actually written somewhere — with nothing to clear there
 * is no operation left to offer at all.
 */
export function addDeleteItem(
	menu: Menu,
	ctx: SettingsSectionContext,
	def: CalloutDefinition,
	usage: { fileCount: number; totalCount: number },
): void {
	const removes = deleteRemovesRow(ctx, def);
	if (!removes && usage.fileCount === 0) return;
	menu.addItem((item) =>
		item
			.setTitle(t("settings.deleteAction"))
			.setIcon("trash-2")
			.onClick(() => {
				void (removes
					? handleCalloutDelete(ctx, def, usage)
					: handleClearCalloutUsages(ctx, def, usage));
			}),
	);
}
