import { Menu, Notice, type App } from "obsidian";
import { t } from "../i18n";
import { PortableCustomReplacementError, type PortableReplacement } from "../utils/portableCalloutCustom";
import { retainPortableCalloutReplacements, reviewPortableCalloutSelection, type PortableCalloutConversionPlan } from "../utils/portableCalloutVault";
import { createPortableReplacementEditor } from "./portableReplacementEditor";
import { PortableCustomReplacementModal } from "./PortableCustomReplacementModal";

interface ReviewState { ready: boolean; plan?: PortableCalloutConversionPlan; selected: ReadonlySet<string> }

/** Custom text belongs to a reviewed source snapshot, never just a path/line. */
export class PortableConversionCustom {
	private replacements = new Map<string, PortableReplacement>();
	private base?: PortableCalloutConversionPlan;
	private modal?: PortableCustomReplacementModal;
	constructor(private readonly app: App, private readonly state: () => ReviewState,
		private readonly commit: (plan: PortableCalloutConversionPlan) => void) {}
	close(): void { this.modal?.close(); this.modal = undefined; }
	clear(): void { this.replacements.clear(); this.base = undefined; }
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
		const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>("button[data-row-id]");
		const { plan, ready } = this.state();
		const id = button?.dataset.rowId?.replace(/^source:/, "");
		const row = plan?.changes.find(change => change.id === id);
		if (!ready || !row || !plan || plan.recovery) return;
		event.preventDefault();
		const menu = new Menu().setUseNativeMenu(false);
		menu.addItem(item => item.setTitle(t(row.custom ? "portable.editCustom" : "portable.customize")).setIcon("pencil").onClick(() => {
			if (!this.current(plan)) return;
			const base = this.base?.changes.find(change => change.id === row.id);
			const editor = base && createPortableReplacementEditor(base, row, this.replacements.get(row.id));
			if (!editor) { new Notice(t("portable.customInvalid")); return; }
			this.modal = new PortableCustomReplacementModal(this.app, editor.fields, values => {
				try { return this.save(plan, row.id, editor.compose(values)); }
				catch { return t("portable.customInvalid"); }
			});
			this.modal.open();
		}));
		if (row.custom) menu.addItem(item => item.setTitle(t("portable.restoreDefault")).setIcon("rotate-ccw").onClick(() => {
			const error = this.save(plan, row.id);
			if (error) new Notice(error);
		}));
		menu.showAtMouseEvent(event);
	}
	private current(plan: PortableCalloutConversionPlan): boolean {
		const state = this.state();
		return state.ready && state.plan === plan && !plan.recovery;
	}
	private save(plan: PortableCalloutConversionPlan, id: string, value?: PortableReplacement): string | undefined {
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
			this.commit(reviewed);
		} catch (error) {
			return t(error instanceof PortableCustomReplacementError ? "portable.customInvalid" : "portable.errorChanged");
		}
		return undefined;
	}
}
