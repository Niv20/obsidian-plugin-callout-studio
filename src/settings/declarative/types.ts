/**
 * settings/declarative/types.ts — the shapes of the settings tree this plugin
 * hands Obsidian, as Obsidian 1.13+ really reads them.
 *
 * Who uses it. Every module under settings/declarative/ that builds part of
 * the tree, and the settings tab, which returns the finished tree from
 * `getSettingDefinitions()`.
 *
 * The main idea. Since 1.13 a settings tab can describe itself as data — rows,
 * groups, lists and pages ("definitions") — and Obsidian draws it, indexes it
 * for the settings search, and keeps it up to date. Obsidian's typings
 * (`SettingDefinitionItem` and friends) leave out three fields its renderer
 * reads anyway (read from app.js 1.14.4, see the research notes):
 *
 * - `id` on any row, group or page: the key Obsidian uses to reuse a row's
 *   element across updates, and the name of a page in a page path. Without it
 *   the key is the row's name, which changes when a callout is renamed, and two
 *   rows with the same name log "duplicate setting key".
 * - `icon` on a plain or action row in a list: the icon at the start of the row.
 * - `disabled` on a render row: Obsidian disables the row's components with it.
 *
 * Writing those fields on a typed object literal fails TypeScript's
 * excess-property check, so the plugin builds its tree with these local types
 * (prefixed `Cs`) and converts it once, in {@link toObsidianItems}.
 */
import type { SettingsContext } from "../sections/types";
import type { PersistentParts } from "./persistentParts";
import type { RowRegistry } from "./rowRegistry";
import type {
	SettingDefinitionAction,
	SettingDefinitionControl,
	SettingDefinitionEmpty,
	SettingDefinitionGroup,
	SettingDefinitionItem,
	SettingDefinitionList,
	SettingDefinitionPage,
	SettingDefinitionRender,
} from "obsidian";

/** A `true`/`false` that may also be worked out when Obsidian asks, as Obsidian allows. */
export type Predicate = boolean | (() => boolean);

/** The fields every part of the tree may carry that Obsidian's typings leave out. */
interface WithId {
	/**
	 * A key that stays the same while the thing it names stays the same: a
	 * callout's id rather than its display name, for example.
	 */
	id?: string;
}

/** A row drawn by the plugin's own code (`render(setting, group)`). */
export type CsRender = SettingDefinitionRender & WithId & {
	/** Disables the row's components; Obsidian reads it, its typings do not declare it. */
	disabled?: Predicate;
};

/** A row the whole of which is a button (Obsidian's `setAction`). */
export type CsAction = SettingDefinitionAction & WithId & {
	/** A Lucide icon at the start of the row, in a list. */
	icon?: string;
};

/** A row with a name and a description and nothing to change. */
export type CsEmpty = SettingDefinitionEmpty & WithId & {
	/** A Lucide icon at the start of the row, in a list. */
	icon?: string;
};

/** A row Obsidian draws a control for (toggle, slider, …), bound through the tab. */
export type CsControl = SettingDefinitionControl & WithId;

/** One row: any of the four kinds above. */
export type CsSetting = CsRender | CsAction | CsEmpty | CsControl;

/**
 * A row that opens a sub-page. `items` holds the page's own tree; `page`, a
 * factory, draws the page imperatively instead (its rows are then not part of
 * the settings search).
 */
export type CsPage = Omit<SettingDefinitionPage, "items"> & WithId & {
	items?: CsItem[];
};

/** A box of rows, with an optional heading (`type: "group"`). */
export type CsGroup = Omit<SettingDefinitionGroup, "items"> & WithId & {
	type: "group";
	items?: (CsSetting | CsPage)[];
};

/** A box of entries the user adds, deletes or reorders (`type: "list"`). */
export type CsList = Omit<SettingDefinitionList, "items"> & WithId & {
	type: "list";
	items?: (CsSetting | CsPage)[];
};

/** Anything that may stand in the tree: a row, a box or a page. */
export type CsItem = CsSetting | CsGroup | CsList | CsPage;

/**
 * What every part of the tree is built with: the settings context
 * (sections/types.ts: the app, the plugin, a way to redraw), plus the stores
 * and jumps the pages need.
 */
export interface TreeContext extends SettingsContext {
	/** Rows the plugin can scroll to and flash (rowRegistry.ts). */
	rows: RowRegistry;
	/** Parts that keep their state through a redraw (persistentParts.ts). */
	parts: PersistentParts;
	/**
	 * Open the page the row is on, scroll to the row registered as `rowId`
	 * and flash it, as Obsidian shows a settings search result (jumpToRow.ts).
	 * `fromKeyboard`: the jump was asked for with a key, so the row also takes
	 * the focus. `pagePath`: the page's ids from the tab down; the tab's own
	 * page when left out.
	 */
	jumpTo(rowId: string, fromKeyboard: boolean, pagePath?: readonly string[]): void;
}

/**
 * Hand the finished tree to Obsidian.
 *
 * The one place the local types become Obsidian's: the extra fields are real
 * to Obsidian's renderer but missing from its typings, so the conversion is a
 * cast (`as unknown as`: "trust me, this is that type"), done once, here.
 */
export function toObsidianItems(items: CsItem[]): SettingDefinitionItem[] {
	return items as unknown as SettingDefinitionItem[];
}
