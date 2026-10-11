/**
 * settings/sections/rowOwnership.ts — which of the three groups a callout row
 * belongs in, and which of Delete and Convert uses to plain text it offers.
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
 * earlier multi-clause rule also filed a built-in under the theme merely
 * because nobody had configured it. A built-in now moves only when the theme
 * genuinely names it — which, measured across the 257 themes in the dev
 * vault, 48 of them do, 27 of those for every single built-in id.
 * The earlier *"the theme styles callouts at all"* guard is now implied: an id
 * cannot be named by a theme that says nothing about callouts.
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
 * Whether Delete can really remove this callout.
 *
 * Three of the five sources cannot be removed at all, for the same underlying
 * reason: something outside this plugin keeps declaring the id, so the row
 * would come straight back. A built-in is one of Obsidian's thirteen and the
 * registry always seeds it; a callout the active theme names is re-minted by
 * the next theme sweep. Those rows offer no Delete — only
 * {@link addConvertUsesItem}, which every row has.
 */
export function deleteRemovesRow(
	ctx: SettingsSectionContext,
	def: CalloutDefinition,
): boolean {
	return !def.builtIn && !isThemeSupplied(ctx, def);
}

/**
 * The `⋯` item that turns a callout's uses in the vault into plain text, on
 * every kind of row. Shown when the callout is written somewhere, or when the
 * menu does not know yet; the action recounts before it asks.
 *
 * Its own item rather than a branch of Delete because the two do opposite
 * things: Delete removes the type and leaves every note alone, this rewrites
 * the notes and leaves the type alone. On a theme row or a built-in, where
 * nothing can be deleted, it is the only one offered — and calling it Delete
 * there would be the single most misleading thing the menu could say.
 */
export function addConvertUsesItem(
	menu: Menu,
	ctx: SettingsSectionContext,
	def: CalloutDefinition,
	usage?: { fileCount: number; totalCount: number },
): void {
	if (usage?.fileCount === 0) return;
	menu.addItem((item) =>
		item
			.setTitle(t("settings.convertUsesAction"))
			.setIcon("eraser")
			.onClick(() => {
				void handleClearCalloutUsages(ctx, def);
			}),
	);
}

/**
 * The `⋯` item that deletes the callout's definition, on a row whose
 * definition can actually go. Shown whether or not the callout is in use:
 * Delete never touches a note, so there is always something it can do.
 */
export function addDeleteItem(
	menu: Menu,
	ctx: SettingsSectionContext,
	def: CalloutDefinition,
): void {
	if (!deleteRemovesRow(ctx, def)) return;
	menu.addItem((item) =>
		item
			.setTitle(t("settings.deleteAction"))
			.setIcon("trash-2")
			.onClick(() => {
				void handleCalloutDelete(ctx, def);
			}),
	);
}
