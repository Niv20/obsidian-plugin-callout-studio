import { Menu, Notice, type App } from "obsidian";
import { t } from "../i18n";
import { PortableCustomReplacementError, type PortableReplacement } from "../utils/portableCalloutCustom";
import { retainPortableCalloutReplacements, reviewPortableCalloutSelection, type PortableCalloutConversionPlan } from "../utils/portableCalloutVault";
import { createPortableReplacementEditor } from "./portableReplacementEditor";
import { PortableInlineReplacement } from "./portableInlineReplacement";

interface ReviewState { ready: boolean; plan?: PortableCalloutConversionPlan; selected: ReadonlySet<string> }

/** Custom text belongs to a reviewed source snapshot, never just a path/line. */
export class PortableConversionCustom {
	private replacements = new Map<string, PortableReplacement>();
	private base?: PortableCalloutConversionPlan;
	private editor?: { id: string; base: PortableCalloutConversionPlan; view: PortableInlineReplacement };
	private root?: HTMLElement;
	private refocus?: HTMLElement;
	private openingEvent?: Event;
	constructor(private readonly app: App, private readonly state: () => ReviewState,
		private readonly commit: (plan: PortableCalloutConversionPlan) => void, private readonly redraw: () => void,
		private readonly clearSourceHighlight: () => void) {}
	get editing(): boolean { return Boolean(this.editor); }
	get editingId(): string | undefined { return this.editor?.id; }
	get resetEnabled(): boolean { return this.editor?.view.customized ?? false; }
	close(): void { this.editor?.view.unload(); this.editor = undefined; this.refocus = undefined; this.openingEvent = undefined; }
	clear(): void { this.close(); this.replacements.clear(); this.base = undefined; }
	beforeRender(): void {
		const focused = this.root?.ownerDocument.activeElement as HTMLElement | null;
		this.refocus = focused && this.editor?.view.element.contains(focused) ? focused : undefined;
		if (!this.state().ready) this.close();
	}
	render(root: HTMLElement): void {
		this.root = root;
		const editor = this.editor;
		if (!editor) return;
		const slot = this.slot(editor.id);
		if (!slot || !this.state().ready || editor.base !== this.base) { this.close(); return; }
		slot.empty(); slot.appendChild(editor.view.element);
		editor.view.refreshLabels();
		this.refocus?.focus({ preventScroll: true });
		this.syncReset();
	}
	edit(id: string | undefined, event?: Event): void {
		if (this.editor && this.editor.id === id) {
			this.clearSourceHighlight(); this.openingEvent = event; this.editor.view.focus(true); return;
		}
		this.finish();
		const { plan, ready } = this.state();
		const row = plan?.changes.find(change => change.id === id);
		const base = this.base?.changes.find(change => change.id === id);
		const slot = id && this.slot(id);
		if (!ready || !plan || plan.recovery || !row || !base || !slot) return;
		const editor = createPortableReplacementEditor(base, row, this.replacements.get(row.id));
		if (!editor) { new Notice(t("portable.customInvalid")); return; }
		this.clearSourceHighlight();
		this.close(); slot.empty();
		const snapshot = this.base;
		const view = new PortableInlineReplacement(slot, editor.fields[0]!, (value, refocus) => {
			const current = this.state();
			if (snapshot !== this.base || !current.ready || !current.plan) return t("portable.customStale");
			try { return this.save(current.plan, row.id, editor.compose([value]), refocus); }
			catch { return t("portable.customInvalid"); }
		}, refocus => { this.close(); this.redraw(); if (refocus) this.focusEdit(row.id); }, () => this.syncReset());
		this.editor = { id: row.id, base: this.base!, view };
		// The opening click can still bubble after its original preview button is detached.
		this.openingEvent = event;
		this.redraw(); view.focus(true);
	}
	/** Commit after a click, so removing the field cannot swallow the clicked control. */
	outsideClick(event: MouseEvent): void {
		if (event === this.openingEvent) { this.openingEvent = undefined; return; }
		this.openingEvent = undefined;
		const editor = this.editor;
		const target = event.target as HTMLElement | null;
		if (!editor || !target || editor.view.element.contains(target)) return;
		const action = target.closest<HTMLElement>("button[data-action]");
		if (action?.dataset.action === "edit" && action.closest<HTMLElement>("[data-row-id]")?.dataset.rowId === `source:${editor.id}`) return;
		this.finish();
	}
	finish(): void {
		const message = this.editor?.view.submit(false);
		if (message) { new Notice(message); this.close(); this.redraw(); }
	}
	private syncReset(): void {
		const editor = this.editor;
		const button = editor && this.slot(editor.id)?.closest<HTMLElement>("[data-row-id]")?.querySelector<HTMLButtonElement>('button[data-action="restore"]');
		if (!button || !editor) return;
		button.hidden = !editor.view.customized;
		button.setAttribute("aria-label", t(editor.view.changed ? "portable.cancelEdit" : "portable.restoreDefault"));
	}
	restore(id: string | undefined): void {
		const { plan, ready } = this.state();
		const row = plan?.changes.find(change => change.id === id);
		if (!ready || !plan || plan.recovery || !row) return;
		// The same icon discards a draft first, without losing a previously saved override.
		if (this.editor?.id === row.id && this.editor.view.changed) { this.close(); this.redraw(); this.focusEdit(row.id); return; }
		if (!row.custom) return;
		const error = this.save(plan, row.id);
		if (error) new Notice(error);
	}
	private slot(id: string): HTMLElement | undefined {
		return Array.from(this.root?.querySelectorAll<HTMLElement>("[data-replacement]") ?? []).find(el => el.dataset.replacement === id);
	}
	private focusEdit(id: string): void {
		this.slot(id)?.querySelector<HTMLButtonElement>("button[data-action='edit']")?.focus({ preventScroll: true });
	}
	scan(plan: PortableCalloutConversionPlan): { invalidated: ReadonlySet<string>; relocated: ReadonlyMap<string, readonly string[]> } {
		const previous = this.replacements, relocated = new Map<string, string[]>(), invalidated = new Set<string>();
		this.replacements = retainPortableCalloutReplacements(this.app, this.base, plan, previous, (oldId, newId) => {
			const targets = relocated.get(oldId) ?? []; targets.push(newId); relocated.set(oldId, targets);
		}, oldId => invalidated.add(oldId));
		for (const id of previous.keys()) if (!relocated.has(id)) invalidated.add(id);
		this.base = plan;
		if (invalidated.size) new Notice(t("portable.customDiscarded", { count: invalidated.size }));
		return { invalidated, relocated };
	}
	review(selected: ReadonlySet<string>, refreshed = false): PortableCalloutConversionPlan {
		try { return reviewPortableCalloutSelection(this.app, this.base!, selected, this.replacements); }
		catch (error) {
			if (!refreshed || !(error instanceof PortableCustomReplacementError)) throw error;
			// Keep unchanged custom text visible, but require another choice when an
			// edit elsewhere makes its delimiters consume neighbouring Markdown.
			const safe = new Set(selected);
			for (const [id, text] of this.replacements) if (safe.has(id)) {
				try { reviewPortableCalloutSelection(this.app, this.base!, new Set([id]), new Map([[id, text]])); }
				catch { safe.delete(id); }
			}
			let plan: PortableCalloutConversionPlan;
			try { plan = reviewPortableCalloutSelection(this.app, this.base!, safe, this.replacements); }
			catch {
				for (const id of this.replacements.keys()) safe.delete(id);
				plan = reviewPortableCalloutSelection(this.app, this.base!, safe, this.replacements);
			}
			new Notice(t("portable.customInvalid"));
			return plan;
		}
	}
	contextMenu(event: MouseEvent): void {
		const target = event.target as HTMLElement | null;
		if (target?.closest(".cs-portable-inline")) return;
		const button = target?.closest<HTMLElement>("[data-row-id]");
		const { plan, ready } = this.state();
		const id = button?.dataset.rowId?.replace(/^source:/, "");
		const row = plan?.changes.find(change => change.id === id);
		if (!ready || !row || !plan || plan.recovery) return;
		event.preventDefault();
		const menu = new Menu().setUseNativeMenu(false);
		menu.addItem(item => item.setTitle(t(row.custom ? "portable.editCustom" : "portable.customize")).setIcon("pencil").onClick(event => {
			if (!this.current(plan)) return;
			this.edit(row.id, event);
		}));
		const editing = this.editor?.id === row.id ? this.editor.view : undefined;
		if (editing ? editing.customized : row.custom) menu.addItem(item => item.setTitle(t(editing?.changed ? "portable.cancelEdit" : "portable.restoreDefault")).setIcon("rotate-ccw").onClick(() => {
			if (this.current(plan)) this.restore(row.id);
		}));
		menu.showAtMouseEvent(event);
	}
	private current(plan: PortableCalloutConversionPlan): boolean {
		const state = this.state();
		return state.ready && state.plan === plan && !plan.recovery;
	}
	private save(plan: PortableCalloutConversionPlan, id: string, value?: PortableReplacement, refocus = true): string | undefined {
		if (!this.current(plan) || !this.base) return t("portable.customStale");
		const replacements = new Map(this.replacements);
		if (value === undefined) replacements.delete(id); else replacements.set(id, value);
		let selected = this.state().selected;
		try {
			// Validate even an unchecked row, and never silently discard another
			// selected heading to make a new custom heading acceptable.
			const requested = value === undefined ? selected : new Set([...selected, id]);
			let trial = reviewPortableCalloutSelection(this.app, this.base, requested, replacements);
			if (value === undefined && [...selected].some(chosen => !trial.selectedIds.includes(chosen))) {
				selected = new Set([...selected].filter(chosen => chosen !== id));
				trial = reviewPortableCalloutSelection(this.app, this.base, selected, replacements);
			} else if ([...requested].some(chosen => !trial.selectedIds.includes(chosen))) return t("portable.customUnsafe");
			const reviewed = reviewPortableCalloutSelection(this.app, this.base, selected, replacements);
			this.replacements = replacements;
			if (this.editor?.id === id) this.close();
			this.commit(reviewed);
			if (refocus) this.focusEdit(id);
		} catch (error) {
			return t(error instanceof PortableCustomReplacementError ? "portable.customInvalid" : "portable.errorChanged");
		}
		return undefined;
	}
}
