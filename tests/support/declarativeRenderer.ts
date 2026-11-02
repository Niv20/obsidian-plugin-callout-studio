/**
 * tests/support/declarativeRenderer.ts — Obsidian's declarative settings
 * renderer, rebuilt for the tests.
 *
 * Why it exists. Since 1.13 Obsidian draws a settings tab from the tree
 * `getSettingDefinitions()` returns. That drawing code lives in app.js and
 * cannot run here. To test what Callout Studio's tree does once drawn (which
 * rows appear, what survives a redraw, what a settings search finds) this file
 * does what Obsidian 1.14.4 does, step for step, with the stub's `Setting` and
 * `SettingGroup`. Every function names the app.js function it copies, by its
 * minified name in square brackets (read on 2026-10-24 from the 1.14.4 asar),
 * so the two can be checked against each other.
 *
 * What it copies:
 * - drawing a tab or a page: loose rows wrapped into boxes [x4]; boxes keyed
 *   and reused [E4, T4]; rows keyed and reused [C4, D4]; each row drawn [O4];
 * - a redraw: a reused row's cleanup runs, then `setting.clear()`, then the row
 *   is drawn again, except a control row whose control has focus [D4];
 * - `visible` and `disabled` [w4, k4], which is `refreshDomState()`;
 * - lists: the empty-state row [I4], `addItem` (a + button on a computer, a
 *   last row on mobile), `onDelete` (a ✕ per row and the Delete key),
 *   `onReorder` (Alt+↑/↓);
 * - a box's own search field [T4];
 * - the settings search [loe.search, coe, uoe]: which rows a query finds, by
 *   name, description or alias, and which pages it finds by name;
 * - pages: opening one by its path [u4, l4, s4], including a page drawn by
 *   its own factory (`page: () => new SomePage()`).
 *
 * What it leaves out: the pointer drag engine, control types other than toggle
 * and slider, animations, and where focus goes.
 *
 * The user guide's scenes draw settings pages with it too
 * (scripts/user-guide/settingsPage.mjs), on a runtime whose `Setting` and
 * `SettingGroup` build Obsidian's real DOM, so the icons and the page title
 * bar below are Obsidian's, not just the structure.
 */
import { Platform, Setting, SettingGroup, SettingPage, setIcon, type ButtonLike } from "./obsidianStub";

/* -------------------------------------------------------------------------- */
/* The tree, as the renderer reads it                                         */
/* -------------------------------------------------------------------------- */

/** A yes/no, or a function that works it out when asked. */
type Predicate = boolean | (() => boolean);

/**
 * Every field a definition may carry, all optional: the renderer, like
 * Obsidian's, looks at which fields are present to decide what a definition is.
 */
export interface LooseDef {
	type?: "group" | "list" | "page";
	id?: string;
	name?: string;
	desc?: string | DocumentFragment;
	aliases?: string[];
	searchable?: Predicate;
	visible?: Predicate;
	disabled?: Predicate;
	icon?: string;
	control?: {
		key: string;
		type: string;
		defaultValue?: unknown;
		disabled?: Predicate;
		min?: number;
		max?: number;
		step?: number;
	};
	action?: (el: HTMLElement, index: number) => void;
	render?: (setting: Setting, group: SettingGroup) => void | (() => void);
	items?: LooseDef[];
	heading?: string;
	cls?: string;
	search?: { placeholder?: string; match: (def: LooseDef, query: string) => boolean };
	extraButtons?: ((button: ButtonLike) => unknown)[];
	emptyState?: string | DocumentFragment;
	onReorder?: (from: number, to: number) => void;
	onDelete?: (index: number) => void;
	addItem?: { name: string; action: (el: HTMLElement) => void };
	displayValue?: string | (() => string);
	status?: "warning" | null | (() => "warning" | null);
	page?: () => SettingPage;
}

/** What the renderer needs from a settings tab. */
export interface TabLike {
	settingItems: unknown[];
	containerEl: HTMLElement;
	update(): void;
	refreshDomState(): void;
	getControlValue(key: string): unknown;
	setControlValue(key: string, value: unknown): void | Promise<void>;
}

/** A drawn row. */
export interface RenderedRow {
	type: "def";
	key: string;
	def: LooseDef;
	settingEl: HTMLElement;
	setting: Setting;
	cleanup?: () => void;
}

/** A drawn box (`group` or `list`) and its rows. */
export interface RenderedBox {
	type: "group" | "list";
	key: string;
	def: LooseDef;
	groupEl: HTMLElement;
	settingGroup: SettingGroup;
	children: RenderedRow[];
	searchInputEl?: HTMLInputElement;
	emptyStateEl?: HTMLElement;
	addItemEl?: HTMLElement;
}

/* -------------------------------------------------------------------------- */
/* Small rules                                                                */
/* -------------------------------------------------------------------------- */

/** A predicate's value; a function that throws counts as the fallback [g4]. */
function evaluate<T>(value: T | (() => T) | undefined, fallback: T): T {
	if (value === undefined) return fallback;
	if (typeof value !== "function") return value;
	try {
		return (value as () => T)();
	} catch {
		return fallback;
	}
}

/** A box: `group` or `list` [r4]. */
function isBox(def: LooseDef): boolean {
	return def.type === "group" || def.type === "list";
}

/** A page's id in a page path: its `id`, else its name [c4]. */
function pageId(def: LooseDef): string {
	return def.id ?? def.name ?? "";
}

/** A box's key: `type:id:…`, `type:heading`, or its position [E4]. */
function boxKey(def: LooseDef, index: number): string {
	if (def.id) return `${def.type}:id:${def.id}`;
	if (def.heading) return `${def.type}:${def.heading}`;
	return `${def.type}#${index}`;
}

/** A row's key: a page's id, else `id`, the control's key, the name, or the position [C4]. */
function rowKey(def: LooseDef, index: number): string {
	if (def.type === "page") return `page:${pageId(def) || index}`;
	if (def.id) return `id:${def.id}`;
	if (def.control) return `ctrl:${def.control.key}`;
	if (def.name) return `name:${def.name}`;
	return `item#${index}`;
}

/** Whether a row has anything to draw [M4]. */
function isDrawable(def: LooseDef): boolean {
	if (def.type === "page") return Boolean(def.items || def.page);
	return Boolean(def.name || def.render || def.control || def.action);
}

/** The icon a plain or action row shows in a list [L4]. */
function listIcon(def: LooseDef): string | undefined {
	if (def.type || def.control || def.render) return undefined;
	return def.icon;
}

/** The page definition at `path` (a list of page ids), or null [u4]. */
export function findPage(items: LooseDef[], path: string[]): LooseDef | null {
	if (path.length === 0) return null;
	const [first, ...rest] = path;
	for (const item of items) {
		if (item.type === "page" && pageId(item) === first) {
			if (rest.length === 0) return item;
			return item.items ? findPage(item.items, rest) : null;
		}
		if (item.type && isBox(item) && item.items) {
			const found = findPage(item.items, path);
			if (found) return found;
		}
	}
	return null;
}

/**
 * Keyed reconciliation [tx]: turn `current` into one entry per `next` key, in
 * `next`'s order, reusing an old entry where `reuse` accepts it and making a new
 * one with `create` otherwise. Old entries not reused are dropped.
 */
function reconcile<Old, New>(
	current: Old[],
	next: New[],
	reuse: (old: Old, item: New) => boolean,
	create: (item: New) => Old,
): void {
	const pool = current.slice();
	const result = next.map((item) => {
		const at = pool.findIndex((old) => reuse(old, item));
		if (at < 0) return create(item);
		return pool.splice(at, 1)[0]!;
	});
	current.length = 0;
	current.push(...result);
}

/* -------------------------------------------------------------------------- */
/* Drawing                                                                    */
/* -------------------------------------------------------------------------- */

/** Draws definitions the way Obsidian does, and remembers what it drew. */
export class DeclarativeHarness {
	/** The boxes on the page drawn now, as Obsidian keeps them (`renderedItems`). */
	rendered: RenderedBox[] = [];
	/** Every "duplicate setting key" Obsidian would log [S4]. */
	readonly duplicateKeys: string[] = [];
	/** The path of the page drawn now: `[]` for the tab's own page. */
	pagePath: string[] = [];
	/** A page drawn by its own factory, while one is open. */
	customPage: SettingPage | null = null;
	/** The element the current page is drawn into. */
	pageEl: HTMLElement;
	/** The open page's outer element: its title bar and content, or the tab's own element. */
	pageRootEl: HTMLElement;

	constructor(private readonly tab: TabLike) {
		this.pageEl = tab.containerEl;
		this.pageRootEl = tab.containerEl;
		// Obsidian's `update()` stores the tree and redraws the open page;
		// `refreshDomState()` re-applies `visible` and `disabled`. The stub's
		// methods only do the first part, so the harness adds the rest.
		const storeTree = tab.update.bind(tab);
		tab.update = () => {
			storeTree();
			this.redraw();
		};
		const countRefresh = tab.refreshDomState.bind(tab);
		tab.refreshDomState = () => {
			countRefresh();
			this.applyDomState();
		};
	}

	/** The tab's tree, as the renderer reads it. */
	private get tree(): LooseDef[] {
		return this.tab.settingItems as LooseDef[];
	}

	/** Draw the tab's own page (after `update()` has stored the tree). */
	draw(): this {
		this.pagePath = [];
		this.customPage = null;
		this.pageEl = this.tab.containerEl;
		this.pageRootEl = this.tab.containerEl;
		this.redraw();
		return this;
	}

	/** Draw the open page again, as `refreshCurrentPage` does. Factory pages are left alone. */
	redraw(): void {
		if (this.customPage) return;
		const items = this.pagePath.length === 0 ? this.tree : (findPage(this.tree, this.pagePath)?.items ?? []);
		this.drawBoxes(items, this.pageEl);
		this.applyDomState();
	}

	/** Open the page at `path` (page ids from the top), as `openPage` does [l4, s4]. */
	openPage(path: string[]): this {
		const def = findPage(this.tree, path);
		if (!def) throw new Error(`no page at ${path.join(" › ")}`);
		this.cleanupAll(this.rendered);
		this.rendered = [];
		this.pagePath = path;
		if (def.page) {
			const page = def.page();
			page.title = def.name ?? "";
			this.customPage = page;
			this.showPage(page);
			page.display();
			return this;
		}
		this.customPage = null;
		const page = new SettingPage();
		page.title = def.name ?? "";
		this.showPage(page);
		this.redraw();
		return this;
	}

	/** A page's title bar, ‹ and its title, as Obsidian fills it when the page opens. */
	private showPage(page: SettingPage): void {
		page.titlebarEl.empty();
		const backEl = page.titlebarEl.createDiv({ cls: "clickable-icon setting-page-back-button" });
		setIcon(backEl, "lucide-chevron-left");
		page.titlebarEl.createDiv({ cls: "setting-page-title", text: page.title });
		this.pageEl = page.containerEl;
		this.pageRootEl = page.rootEl;
	}

	/** Leave the open page for the one above it, as `closePage` does. */
	closePage(): this {
		this.customPage?.hide();
		this.cleanupAll(this.rendered);
		this.rendered = [];
		const parent = this.pagePath.slice(0, -1);
		return parent.length === 0 ? this.draw() : this.openPage(parent);
	}

	/** Every drawn row, box by box. */
	rows(): RenderedRow[] {
		return this.rendered.flatMap((box) => box.children);
	}

	/** The drawn row with this name, if any. */
	row(name: string): RenderedRow | undefined {
		return this.rows().find((row) => row.def.name === name);
	}

	/** The drawn box with this heading, if any. */
	box(heading: string): RenderedBox | undefined {
		return this.rendered.find((box) => box.def.heading === heading);
	}

	/* ---- [x4] boxes ---- */

	private drawBoxes(items: LooseDef[], containerEl: HTMLElement): void {
		if (this.rendered.length === 0) containerEl.empty();
		// Loose rows in a row of their own are wrapped into one box without a heading.
		const boxes: LooseDef[] = [];
		let loose: LooseDef[] | null = null;
		for (const item of items) {
			if (isBox(item)) {
				boxes.push(item);
				loose = null;
			} else {
				if (!loose) {
					loose = [];
					boxes.push({ type: "group", items: loose });
				}
				loose.push(item);
			}
		}
		const keyed = boxes.map((def, index) => ({ def, key: boxKey(def, index) }));
		this.reportDuplicates(keyed, "tab");
		const before = this.rendered.slice();
		reconcile(
			this.rendered,
			keyed,
			(old, next) => {
				if (old.key !== next.key || old.type !== next.def.type) return false;
				this.redrawBox(old, next.def);
				return true;
			},
			(next) => this.createBox(next.def, containerEl, next.key),
		);
		this.cleanupAll(before.filter((box) => !this.rendered.includes(box)));
		for (const box of this.rendered) containerEl.appendChild(box.groupEl);
	}

	/* ---- [T4] one box ---- */

	private createBox(def: LooseDef, containerEl: HTMLElement, key: string): RenderedBox {
		const group = new SettingGroup(containerEl as never);
		if (def.heading) group.setHeading(def.heading);
		if (def.type === "list") group.addClass("mod-list");
		if (def.cls) group.addClass(...def.cls.split(" ").filter(Boolean));
		for (const extra of def.extraButtons ?? []) group.addExtraButton(extra);
		const box: RenderedBox = {
			type: def.type === "list" ? "list" : "group",
			key,
			def,
			groupEl: group.groupEl as unknown as HTMLElement,
			settingGroup: group,
			children: [],
		};
		// A box's own search field exists only if it had rows when first drawn.
		if (def.search && def.items && def.items.length > 0) {
			const { placeholder, match } = def.search;
			group.addSearch((search) => {
				box.searchInputEl = search.inputEl;
				if (placeholder) search.setPlaceholder(placeholder);
				search.onChange((query) => {
					for (const row of box.children) {
						if ("searchable" in row.def && !evaluate(row.def.searchable, true)) continue;
						row.settingEl.toggle(match(row.def, query));
					}
				});
			});
		}
		this.drawRows(def.items ?? [], box);
		if (box.type === "list") this.addListExtras(box, group);
		this.orderChildren(box);
		return box;
	}

	private redrawBox(box: RenderedBox, def: LooseDef): void {
		box.settingGroup.setHeading(def.heading ?? "");
		box.def = def;
		this.drawRows(def.items ?? [], box);
		if (box.type === "list") this.syncEmptyState(box);
		this.orderChildren(box);
	}

	/** A list's add button (or mobile row), Delete key and Alt+arrows, made once. */
	private addListExtras(box: RenderedBox, group: SettingGroup): void {
		const addItem = box.def.addItem;
		if (addItem) {
			if (Platform.isMobile) {
				const row = new Setting(group.listEl);
				row.settingEl.addClass?.("mod-add-item");
				row.setIcon("lucide-plus");
				row.setName(addItem.name);
				row.setAction(() => box.def.addItem?.action(row.settingEl as unknown as HTMLElement));
				box.addItemEl = row.settingEl as unknown as HTMLElement;
			} else {
				group.addExtraButton((button) => {
					button
						.setIcon("lucide-plus")
						.setTooltip(addItem.name)
						.onClick(() => box.def.addItem?.action(button.extraSettingsEl as unknown as HTMLElement));
				});
			}
		}
		if (box.def.onDelete) group.onDeleteItem((index) => box.def.onDelete?.(index));
		if (box.def.onReorder) {
			group.onReorderItem((from, to) => {
				box.def.onReorder?.(from, to);
				group.focusNearestItem(to);
			});
		}
		this.syncEmptyState(box);
	}

	/* ---- [D4] the rows of a box ---- */

	private drawRows(items: LooseDef[], box: RenderedBox): void {
		const group = box.settingGroup;
		const keyed = items.filter(isDrawable).map((def, index) => ({ def, key: rowKey(def, index) }));
		this.reportDuplicates(keyed, "box");
		if (box.type === "list") {
			(group.groupEl as unknown as HTMLElement).toggleClass("mod-no-icon", !items.some((def) => listIcon(def)));
		}
		const focused = (group.listEl as unknown as HTMLElement).ownerDocument?.activeElement ?? null;
		const before = box.children.slice();
		reconcile(
			box.children,
			keyed,
			(old, next) => {
				if (old.key !== next.key) return false;
				old.def = next.def;
				const controlEl = old.setting.controlEl as unknown as HTMLElement;
				const controlHasFocus =
					Boolean(next.def.control) &&
					focused !== null &&
					controlEl.contains(focused) &&
					controlEl !== focused;
				if (!controlHasFocus) {
					this.runCleanup(old);
					old.setting.clear();
					this.drawRow(old, box);
				}
				return true;
			},
			(next) => {
				const setting = new Setting(group.listEl);
				const row: RenderedRow = {
					type: "def",
					key: next.key,
					def: next.def,
					settingEl: setting.settingEl as unknown as HTMLElement,
					setting,
				};
				this.drawRow(row, box);
				return row;
			},
		);
		this.cleanupAll(before.filter((row) => !box.children.includes(row)));
		group.settings = box.children.map((row) => row.setting);
	}

	/** Rows first, then a list's empty-state and add rows [A4]. */
	private orderChildren(box: RenderedBox): void {
		const listEl = box.settingGroup.listEl as unknown as HTMLElement;
		const order = box.children.map((row) => row.settingEl);
		if (box.emptyStateEl) order.push(box.emptyStateEl);
		if (box.addItemEl) order.push(box.addItemEl);
		for (const el of order) listEl.appendChild(el);
	}

	/** The empty-state row, made when a list has no rows and dropped when it has [I4]. */
	private syncEmptyState(box: RenderedBox): void {
		const empty = box.children.length === 0;
		if (empty && box.def.emptyState && !box.emptyStateEl) {
			const row = new Setting(box.settingGroup.listEl);
			row.setName(
				typeof box.def.emptyState === "string"
					? box.def.emptyState
					: (box.def.emptyState.cloneNode(true) as DocumentFragment),
			);
			row.settingEl.addClass?.("mod-empty-state");
			box.emptyStateEl = row.settingEl as unknown as HTMLElement;
		} else if (!empty && box.emptyStateEl) {
			box.emptyStateEl.remove();
			box.emptyStateEl = undefined;
		}
	}

	/* ---- [O4] one row ---- */

	private drawRow(row: RenderedRow, box: RenderedBox): void {
		const { setting, def } = row;
		const list = box.type === "list" ? box.def : null;
		if (list) setting.setIcon(listIcon(def) ?? null);
		if (def.type === "page") {
			setting.setName(def.name ?? "");
			setting.setDesc(def.desc ? copyOf(def.desc) : "");
			const value = typeof def.displayValue === "function" ? def.displayValue() : def.displayValue;
			const status = evaluate(def.status, null);
			if (value || status) {
				setting.addDisplayValue((display) => display.setValue(value ?? ""));
				if (status) setting.settingEl.addClass?.("cs-test-status-warning");
			}
			const path = [...this.pagePath, pageId(def)];
			setting.setNavigable(() => this.openPage(path));
			return;
		}
		setting.setName(def.name ?? "");
		setting.setDesc(def.desc ? copyOf(def.desc) : "");
		if (def.action) {
			const action = def.action;
			setting.setAction(() => action(row.settingEl, box.settingGroup.settings.indexOf(setting)));
		} else if (def.render) {
			const cleanup = def.render(setting, box.settingGroup);
			if (cleanup) row.cleanup = cleanup;
		} else if (def.control) {
			this.drawControl(setting, def.control);
		}
		if (list?.onDelete) {
			setting.addExtraButton((button) => {
				button
					.setIcon("lucide-x")
					.setTooltip("Delete")
					.onClick(() => {
						const index = box.settingGroup.settings.indexOf(setting);
						if (index >= 0) list.onDelete?.(index);
					});
				button.extraSettingsEl.addClass?.("cs-test-delete");
			});
		}
		if (list?.onReorder) {
			setting.addExtraButton((button) => {
				button.setIcon("lucide-menu").setTooltip("Drag to rearrange");
				button.extraSettingsEl.addClass?.("mod-drag-handle");
			});
		}
	}

	/** A control row: its value comes from, and goes to, the tab's binding. */
	private drawControl(setting: Setting, control: NonNullable<LooseDef["control"]>): void {
		const value = this.tab.getControlValue(control.key) ?? control.defaultValue;
		const save = async (next: unknown): Promise<void> => {
			await this.tab.setControlValue(control.key, next);
			this.tab.refreshDomState();
		};
		if (control.type === "toggle") {
			setting.addToggle((toggle) => toggle.setValue(Boolean(value)).onChange((next) => save(next)));
		} else if (control.type === "slider") {
			setting.addSlider((slider) =>
				slider
					.setLimits(control.min ?? 0, control.max ?? 100, control.step ?? 1)
					.setValue(Number(value))
					.onChange((next) => save(next)),
			);
		} else {
			throw new Error(`the test renderer does not draw "${control.type}" controls`);
		}
	}

	/* ---- [w4, k4] visible and disabled ---- */

	applyDomState(): void {
		for (const box of this.rendered) {
			let hasRows = false;
			let anyShown = false;
			for (const row of box.children) {
				hasRows = true;
				if (this.applyRowState(row)) anyShown = true;
			}
			const boxVisible = evaluate(box.def.visible, true);
			// A group whose rows are all hidden hides too; a list does not.
			const shown = box.type === "group" ? boxVisible && (!hasRows || anyShown) : boxVisible;
			box.groupEl.toggle(shown);
		}
	}

	private applyRowState(row: RenderedRow): boolean {
		const visible = evaluate(row.def.visible, true);
		row.settingEl.toggle(visible);
		const disabled = "disabled" in row.def ? row.def.disabled : row.def.control?.disabled;
		if (disabled !== undefined) row.setting.setDisabled(evaluate(disabled, false));
		return visible;
	}

	/* ---- [P4, b4] cleanups ---- */

	private runCleanup(row: RenderedRow): void {
		const cleanup = row.cleanup;
		row.cleanup = undefined;
		cleanup?.();
	}

	private cleanupAll(boxesOrRows: Array<RenderedBox | RenderedRow>): void {
		for (const item of boxesOrRows) {
			if (item.type === "def") this.runCleanup(item);
			else this.cleanupAll(item.children);
		}
	}

	private reportDuplicates(keyed: Array<{ key: string }>, where: string): void {
		const seen = new Set<string>();
		for (const { key } of keyed) {
			if (seen.has(key)) this.duplicateKeys.push(`${where}: ${key}`);
			seen.add(key);
		}
	}
}

/** A description is copied into each row, so a fragment is cloned [cM]. */
function copyOf(desc: string | DocumentFragment): string | DocumentFragment {
	return typeof desc === "string" ? desc : (desc.cloneNode(true) as DocumentFragment);
}

/* -------------------------------------------------------------------------- */
/* The settings search [loe.search, coe, uoe]                                 */
/* -------------------------------------------------------------------------- */

/** One thing a settings search found. */
export interface SearchHit {
	/** The row's name, or the page's name for a page hit. */
	name: string;
	/** Page ids from the tab down to where the hit lives. */
	pagePath: string[];
	kind: "row" | "page";
}

/**
 * What typing `query` into Obsidian's "Search settings…" finds in this tab:
 * rows by name, description or alias, and pages by name. A query matches when
 * every word in it appears somewhere in the text, ignoring case.
 */
export function searchSettings(items: unknown[], query: string): SearchHit[] {
	const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
	if (words.length === 0) return [];
	const matches = (text: string | undefined): boolean => {
		const lower = (text ?? "").toLowerCase();
		return words.every((word) => lower.includes(word));
	};
	const hits: SearchHit[] = [];
	const walk = (defs: LooseDef[], path: string[]): void => {
		for (const def of defs) {
			if (def.type === "page") {
				if (!evaluate(def.visible, true)) continue;
				const pagePath = [...path, pageId(def)];
				if (matches(def.name)) hits.push({ name: def.name ?? "", pagePath, kind: "page" });
				if (def.items) walk(def.items, pagePath);
			} else if (isBox(def)) {
				if (!evaluate(def.visible, true)) continue;
				walk(def.items ?? [], path);
			} else {
				if (!evaluate(def.visible, true) || !evaluate(def.searchable, true)) continue;
				const desc = typeof def.desc === "string" ? def.desc : (def.desc?.textContent ?? undefined);
				if (matches(def.name) || matches(desc) || (def.aliases ?? []).some(matches)) {
					hits.push({ name: def.name ?? "", pagePath: path, kind: "row" });
				}
			}
		}
	};
	walk(items as LooseDef[], []);
	return hits;
}
