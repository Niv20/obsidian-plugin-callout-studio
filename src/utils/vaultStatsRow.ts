/**
 * utils/vaultStatsRow.ts — One type row of the vault statistics report: the
 * callout's icon and id, how it is written (block / heading / inline) and how
 * many files it appears in.
 *
 * Split out of VaultCalloutStatisticsModal so that window stays the composer
 * (chrome, summary, list, footer) — the same division as
 * settings/sections/CalloutRowRenderer against its list.
 *
 * **Resolution goes through `resolveCalloutDef`, never a map built from
 * `def.id`.** A scanned id keeps its dashes (`normalizeCalloutId`) while a
 * stored id has them folded to spaces (`sanitizeCalloutIdInput`), so a note
 * written `> [!ep-ep]` and the callout stored as `ep ep` are the same callout in
 * two spellings — and matching by string equality reported the user's own
 * callouts as "Unknown". The ladder's `findByAttrId` rung is the step that
 * closes that gap, exactly as it does for the three renderers; this file must
 * not re-derive it. Its fallback substitution is wanted here too: an id with no
 * definition is drawn with the icon and colour the note really renders it with.
 */
import { setIcon } from "obsidian";
import { t } from "../i18n";
import { normalizeCalloutId } from "./calloutId";
import { paintCalloutListIcon } from "../manager/theme/calloutListIcon";
import { resolveCalloutDef } from "../editor/renderShared";
import type { CalloutDefinition, CalloutRenderRole } from "../types";
import type { CalloutRegistry } from "../manager/CalloutRegistry";
import type {
	VaultCalloutRoleCounts,
	VaultCalloutTypeStatistics,
} from "./vaultCalloutStats";

/** Short role names for the chips. A total `Record`, so a fourth role won't
 * compile until it has a label. */
const ROLE_LABEL_KEY: Record<CalloutRenderRole, string> = {
	regular: "vaultStats.roleBlock",
	heading: "vaultStats.roleHeading",
	inline: "vaultStats.roleInline",
};

/**
 * The order the chips are laid out in — display order only, deliberately not
 * `CALLOUT_RENDER_ROLES`: that constant is what the CSS, cache and import
 * sweeps iterate, and reordering it to suit this table would move behaviour to
 * serve a layout. Same order, and the same reasoning, as the editor's
 * `ICON_ADJUST_ORDER`: the two token roles lead, and the block callout — the
 * one nearly every row has — closes.
 */
const CHIP_ORDER: readonly CalloutRenderRole[] = ["heading", "inline", "regular"];

export interface StatsRow {
	entry: VaultCalloutTypeStatistics;
	/** What the note renders with — the fallback callout when `undefinedId`. */
	def: CalloutDefinition | undefined;
	/** The id matched no definition, alias or attribute-form spelling. */
	undefinedId: boolean;
	/** It matched through one of `def`'s aliases rather than its own id. */
	isAlias: boolean;
}

/** Resolve every scanned type once, so a row is never resolved twice. */
export function resolveStatsRows(
	registry: CalloutRegistry,
	types: VaultCalloutTypeStatistics[],
): StatsRow[] {
	return types.map((entry) => {
		const { def, unknown } = resolveCalloutDef(registry, entry.id);
		// A match through the attribute form (`ep-ep` finding `ep ep`) is the
		// same callout in another spelling, not an alias of it — only a real
		// alias hit earns the "Alias of …" label.
		const isAlias =
			!unknown &&
			def !== undefined &&
			normalizeCalloutId(def.id) !== entry.id &&
			(def.aliases ?? []).some((a) => normalizeCalloutId(a) === entry.id);
		return { entry, def, undefinedId: unknown, isAlias };
	});
}

/** The ids in the report that no definition covers, in report order. */
export function undefinedRowIds(rows: StatsRow[]): string[] {
	return rows.filter((r) => r.undefinedId).map((r) => r.entry.id);
}

/**
 * The one thing about a row that isn't already on it, or null for the rows
 * where there is nothing to say.
 *
 * This is what is left of the Source column, and deliberately only these two
 * cases. "Built-in", "Custom", "Auto fallback" and "CSS snippet" told the user
 * nothing they could act on and cost a column on every row; "Not defined" is
 * the state the whole report exists to surface — the footer's *Define N
 * missing* button acts on exactly these rows, so without a mark on them the
 * count in the button points at nothing. "Alias of …" is kept for the same
 * reason: it is the only case where the id in the row is not the id the counts
 * are filed under.
 */
function rowNote(row: StatsRow): string | null {
	const def = row.def;
	if (row.undefinedId || !def) return t("vaultStats.sourceUnknown");
	if (row.isAlias) return t("vaultStats.sourceAlias", { id: def.id });
	return null;
}

/**
 * Draw the row's icon and return its accent, or null when there is nothing to
 * accent with — an undefined id borrows the fallback's *drawing* but must not
 * borrow its colour, or it would read as a callout the user set up.
 *
 * Both halves go through `paintCalloutListIcon`, so a callout the theme owns is
 * listed here wearing the theme's icon and colour rather than the pair stored
 * on its row. This surface had no ownership check at all before.
 */
function renderRowIcon(
	iconEl: HTMLElement,
	row: StatsRow,
	registry: CalloutRegistry,
): string | null {
	const def = row.def;
	if (!def) {
		setIcon(iconEl, "circle-help");
		return null;
	}
	const isDark = activeDocument.body.classList.contains("theme-dark");
	const accent = paintCalloutListIcon(iconEl, def, registry, isDark);
	return row.undefinedId ? null : accent;
}

/**
 * The exact numbers, one chip per role that occurs. These are a *column* of the
 * table, always on: the earlier design hid them behind hover and expanded the
 * row to show them, which read as the row jumping. A role at zero still gets no
 * chip — three chips reading "Heading 0" on every block-only type is noise, and
 * the column's header ("Written as") already says what an absent chip means.
 *
 * They are also the only picture of the split there is. A stacked proportion
 * bar stood beside them for a while, in the row and again over the vault total;
 * three numbers you can read beat a 48px line you have to interpret.
 */
export function renderRoleChips(
	parentEl: HTMLElement,
	roles: VaultCalloutRoleCounts,
	format: (value: number) => string,
): void {
	for (const role of CHIP_ORDER) {
		const count = roles[role];
		if (count <= 0) continue;
		parentEl.createSpan({
			cls: "cs-vault-stats-role-chip",
			text: `${t(ROLE_LABEL_KEY[role])} ${format(count)}`,
		});
	}
}

export interface StatsRowDeps {
	registry: CalloutRegistry;
	format: (value: number) => string;
}

export function renderStatsTypeRow(
	containerEl: HTMLElement,
	row: StatsRow,
	deps: StatsRowDeps,
): void {
	const { entry } = row;
	const rowEl = containerEl.createDiv({ cls: "cs-vault-stats-row" });

	const typeEl = rowEl.createDiv({ cls: "cs-vault-stats-type" });
	const iconEl = typeEl.createSpan({ cls: "cs-vault-stats-type-icon" });
	// Drawn first: the icon and its accent are one decision now, so the row
	// cannot end up with one callout's drawing and another's colour.
	const accent = renderRowIcon(iconEl, row, deps.registry);
	if (accent) iconEl.style.color = accent;
	else iconEl.addClass("is-unknown");
	// The id itself, which the cell's own header calls "Type" and which the
	// report never showed — leaving an unresolved row with no way to tell WHICH
	// `[!…]` the count belonged to. It also stands in for the display name the
	// row used to carry: a name is the id title-cased in all but a handful of
	// cases, so a whole column bought almost nothing.
	typeEl.createSpan({ cls: "cs-vault-stats-type-id", text: entry.id });
	const note = rowNote(row);
	if (note !== null) {
		typeEl.createSpan({ cls: "cs-vault-stats-type-note", text: note });
	}

	const rolesEl = rowEl.createDiv({ cls: "cs-vault-stats-roles" });
	renderRoleChips(rolesEl, entry.roles, deps.format);

	rowEl.createDiv({
		cls: "cs-vault-stats-files",
		text: deps.format(entry.fileCount),
	});
}
