import { ItemView, Notice, type WorkspaceLeaf } from "obsidian";
import { t } from "../i18n";
import { PORTABLE_CONVERSION_ICON_ID } from "../icons/uiIcons";
import { ConfirmModal } from "../utils/ConfirmModal";
import {
	applyPortableCalloutConversion, preparePortableCalloutConversion,
	PortableCalloutPreviewCache, PortableCalloutVaultError, type PortableCalloutConversionPlan,
} from "../utils/portableCalloutVault";
import { createPortableConversionFrame, updatePortableSelection, PORTABLE_PAGE_SIZE, PortableConversionBusy,
	type PortableConversionFrame } from "./portableConversionFrame";
import { PortableConversionCustom } from "./portableConversionCustom";
import { PortableCustomReplacementError } from "../utils/portableCalloutCustom";
import { PortableConversionWatch } from "./portableConversionWatch";
import { PortableConversionNavigation } from "./portableConversionNavigation";

export const PORTABLE_CONVERSION_VIEW = "callout-studio-portable-conversion";

/** In-memory review choices never survive in a saved workspace layout. */
export class PortableConversionView extends ItemView {
	private readonly watch: PortableConversionWatch;
	private readonly custom: PortableConversionCustom;
	private readonly resultNavigation: PortableConversionNavigation;
	private readonly busy: PortableConversionBusy;
	private readonly cache = new PortableCalloutPreviewCache();
	private frame?: PortableConversionFrame;
	private basePlan?: PortableCalloutConversionPlan;
	private plan?: PortableCalloutConversionPlan;
	private selected = new Set<string>();
	private hasReviewed = false;
	private opened = false;
	private stale = true;
	private failed = false;
	private scanning = false;
	private confirming = false;
	private applying = false;
	private pending = false;
	private unrecoverable = false;
	private revision = 0;
	private limit = PORTABLE_PAGE_SIZE;
	private timer?: number;
	private abort?: AbortController;
	private status: () => string = () => "";

	constructor(leaf: WorkspaceLeaf, private readonly debounceMs = 350, busyDelayMs = 600) {
		super(leaf);
		this.busy = new PortableConversionBusy(busyDelayMs);
		this.custom = new PortableConversionCustom(this.app, () => ({ ready: this.ready(), plan: this.plan, selected: this.selected }), plan => {
			this.revision++; this.plan = plan; this.selected = new Set(plan.selectedIds); this.setStatus(""); this.render();
		});
		this.resultNavigation = new PortableConversionNavigation(this.app, ref => this.registerEvent(ref),
			() => this.render(), () => this.invalidate(), limit => { this.limit = limit; this.render(); });
		this.watch = new PortableConversionWatch(this.app, ref => this.registerEvent(ref), (path, old) => this.invalidate(path, old));
		this.registerDomEvent(this.contentEl, "click", event => this.onClick(event));
		this.registerDomEvent(this.contentEl, "change", event => this.onChange(event));
		this.registerDomEvent(this.contentEl, "contextmenu", event => this.custom.contextMenu(event));
		this.register(() => this.stop());
	}
	getViewType(): string { return PORTABLE_CONVERSION_VIEW; }
	getDisplayText(): string { return t("portable.reviewTitle"); }
	getIcon(): string { return PORTABLE_CONVERSION_ICON_ID; }
	refreshLabels(): void {
		if (!this.opened) return;
		this.frame = undefined;
		this.render();
	}
	async onOpen(): Promise<void> {
		this.opened = true;
		this.revision++;
		this.unrecoverable = false;
		if (this.plan?.recovery) this.stale = false;
		this.contentEl.addClass("cs-portable-view");
		this.watch.open();
		this.resultNavigation.open();
		this.render();
		await this.scan();
	}
	onClose(): Promise<void> {
		this.stop();
		this.contentEl.empty();
		this.frame = undefined;
		return Promise.resolve();
	}
	private stop(): void {
		this.opened = false;
		this.revision++;
		this.stale = true;
		this.pending = false;
		this.abort?.abort();
		this.clearTimer();
		this.watch.close();
		this.resultNavigation.close();
		this.busy.stop();
		this.custom.close();
		this.cache.invalidate();
	}
	private clearTimer(): void {
		if (this.timer !== undefined) window.clearTimeout(this.timer);
		this.timer = undefined;
	}
	private invalidate(path?: string, oldPath?: string): void {
		if (!this.opened || this.applying || this.unrecoverable) return;
		this.resultNavigation.invalidate();
		this.cache.invalidate(path);
		if (oldPath) this.cache.invalidate(oldPath);
		this.revision++;
		if (this.plan?.recovery) {
			this.setStatus("portable.recoveryChanged");
			this.render();
			return;
		}
		this.stale = true;
		this.failed = false;
		this.abort?.abort();
		this.setStatus("");
		this.render();
		this.scheduleScan();
	}
	private scheduleScan(): void {
		this.pending = true;
		this.clearTimer();
		this.timer = window.setTimeout(() => {
			this.timer = undefined;
			void this.scan();
		}, this.debounceMs);
	}
	private async scan(): Promise<void> {
		if (!this.opened || this.applying || this.plan?.recovery) return;
		if (this.scanning) { this.pending = true; return; }
		this.clearTimer();
		this.pending = false;
		this.scanning = true;
		this.stale = true;
		this.failed = false;
		const revision = this.revision;
		const abort = this.abort = new AbortController();
		this.busy.setMessage("portable.scanning");
		this.render();
		try {
			const plan = await preparePortableCalloutConversion(this.app, {
				signal: abort.signal, cache: this.cache,
				onProgress: (done, total) => {
					if (this.opened && revision === this.revision) this.busy.setMessage("portable.progress", { done, total });
				},
			});
			if (!this.opened || revision !== this.revision || abort.signal.aborted) return;
			this.basePlan = plan;
			const custom = this.custom.scan(plan);
			const retained = new Set([...this.selected].filter(id => !custom.invalidated.has(id)).flatMap(id => custom.relocated.get(id) ?? [id]));
			// An edited/moved/new line needs another explicit choice; only byte-exact
			// unchanged source identities carry their previous selection forward.
			this.selected = new Set(this.hasReviewed ? plan.changes.filter(row => retained.has(row.id) && !custom.invalidated.has(row.id)).map(row => row.id) : plan.selectedIds);
			this.plan = plan.recovery ? plan : this.custom.review(this.selected, true);
			this.selected = new Set(this.plan.selectedIds);
			this.hasReviewed = true;
			this.stale = false;
			this.setStatus(plan.recovery ? "portable.recovery" : plan.changes.length ? "" : "portable.empty");
		} catch (error) {
			if (!this.opened || revision !== this.revision || abort.signal.aborted) return;
			this.failed = true;
			this.status = () => portableConversionErrorText(error);
		} finally {
			this.scanning = false;
			if (this.abort === abort) this.abort = undefined;
			if (this.opened) {
				this.render();
				if (this.pending && this.timer === undefined) this.scheduleScan();
			}
		}
	}
	private onClick(event: MouseEvent): void {
		const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>("button[data-action]");
		if (!button || button.disabled) return;
		const action = button.dataset.action;
		if (action === "more") { this.limit += PORTABLE_PAGE_SIZE; this.render(); return; }
		if (action === "retry") { this.invalidate(); return; }
		if (action === "convert") { void this.convert(); return; }
		if (action === "file") { void this.resultNavigation.navigateFile(button.dataset.path, event.metaKey || event.ctrlKey); return; }
		if (action === "result") {
			if (this.ready()) void this.resultNavigation.navigate(button.dataset.rowId, event.metaKey || event.ctrlKey);
			return;
		}
	}
	private onChange(event: Event): void {
		const input = event.target as HTMLInputElement | null;
		if (input?.dataset.action === "toggle-all") {
			if (!input.disabled && this.ready() && this.basePlan && !this.plan?.recovery)
				this.select(new Set(input.checked ? this.basePlan.changes.map(row => row.id) : []));
			return;
		}
		const id = input?.dataset.changeId;
		if (!id || input.disabled || !this.ready() || this.plan?.recovery || !this.plan?.changes.some(row => row.id === id)) return;
		const selected = new Set(this.selected);
		if (input.checked) selected.add(id); else selected.delete(id);
		this.select(selected);
	}
	private select(selected: Set<string>): void {
		if (!this.basePlan) return;
		this.revision++;
		let reviewed: PortableCalloutConversionPlan;
		try { reviewed = this.custom.review(selected); }
		catch (error) { this.setStatus(error instanceof PortableCustomReplacementError ? "portable.customInvalid" : "portable.errorChanged"); this.render(); return; }
		if (selected.size > this.selected.size && [...this.selected].some(id => !reviewed.selectedIds.includes(id))) {
			this.setStatus("portable.selectionConflict");
			this.render();
			return;
		}
		this.plan = reviewed;
		this.selected = new Set(this.plan.selectedIds);
		this.setStatus("");
		this.render();
	}
	private ready(): boolean {
		return this.opened && !this.stale && !this.scanning && !this.confirming && !this.applying;
	}
	private setStatus(key: string, vars: Record<string, string | number> = {}): void {
		this.status = () => key ? t(key, vars) : "";
		this.frame?.status.setText(this.status());
	}
	private render(): void {
		if (!this.opened) return;
		const scrollTop = this.frame?.scroll.scrollTop ?? 0;
		const focused = this.contentEl.ownerDocument.activeElement as HTMLElement | null;
		const focusedId = this.contentEl.contains(focused) ? focused?.dataset.changeId : undefined;
		const focusedRow = this.contentEl.contains(focused) ? focused?.dataset.rowId : undefined;
		const frame = this.frame ??= createPortableConversionFrame(this.contentEl);
		const plan = this.plan;
		updatePortableSelection(frame, plan, this.ready());
		frame.status.setText(this.status());
		frame.hint.setText(plan?.recovery ? t("portable.recovery") : "");
		frame.retry.hidden = !this.failed || this.unrecoverable;
		frame.retry.disabled = this.scanning || this.confirming || this.applying;
		this.busy.update(frame, this.stale, !this.failed && !this.unrecoverable && (this.stale || this.scanning || this.applying));
		this.resultNavigation.renderRows(frame.results, plan, this.limit, !this.ready() || Boolean(plan?.recovery));
		if (focusedId) Array.from(frame.results.querySelectorAll<HTMLInputElement>("input[data-change-id]"))
			.find(input => input.dataset.changeId === focusedId && !input.disabled)?.focus({ preventScroll: true });
		if (focusedRow) Array.from(frame.results.querySelectorAll<HTMLButtonElement>("button[data-row-id]"))
			.find(button => button.dataset.rowId === focusedRow)?.focus({ preventScroll: true });
		frame.scroll.scrollTop = scrollTop;
		this.resultNavigation.sync(!this.stale, this.failed);
	}
	private async convert(): Promise<void> {
		const plan = this.plan;
		if (!this.ready() || !plan || !(plan.count || plan.linkCount)) return;
		const revision = this.revision;
		this.confirming = true;
		this.resultNavigation.invalidate();
		this.render();
		try {
			const confirmed = await new ConfirmModal(this.app, t("portable.confirmTitle"),
				t("portable.confirmBody", { count: plan.count, files: plan.files, links: plan.linkCount }), t("portable.confirmAction")).confirm();
			if (!confirmed || !this.opened || this.stale || revision !== this.revision) return;
			this.applying = true;
			this.stale = true;
			this.busy.setMessage("portable.converting");
			this.render();
			const result = await applyPortableCalloutConversion(this.app, plan);
			const message = result.status === "complete"
				? t("portable.complete", { count: result.count, files: result.files, links: result.linkCount })
				: t("portable.stopped", { count: result.count, files: result.files, links: result.linkCount }) + " " + portableConversionErrorText(result.error);
			const duration = result.status === "complete" ? undefined : 12000;
			new Notice(message, duration);
			this.plan = this.basePlan = result.remainingPlan;
			if (result.status === "complete" || result.files || result.remainingPlan) this.custom.clear();
			this.pending = !result.remainingPlan;
			this.stale = !result.remainingPlan;
			this.cache.invalidate();
			if (result.remainingPlan) this.status = () => portableConversionErrorText(result.error) + " " + t("portable.recovery");
			else if (result.status === "stopped" && result.files > 0) {
				this.pending = false;
				this.unrecoverable = true;
				this.setStatus("portable.recoveryUnavailable");
			}
		} catch (error) {
			this.stale = this.failed = true;
			this.status = () => portableConversionErrorText(error);
			new Notice(this.status());
		} finally {
			this.confirming = this.applying = false;
			if (this.opened) {
				this.render();
				if (this.pending) this.scheduleScan();
			}
		}
	}
}

function portableConversionErrorText(error: unknown): string {
	const code = error instanceof PortableCalloutVaultError ? error.code
		: error && typeof error === "object" && "code" in error ? error.code : "";
	if (code === "editor-changed") return t("portable.errorEditor");
	if (code === "changed" || code === "invalid-plan") return t("portable.errorChanged");
	if (code === "busy") return t("portable.errorBusy");
	return t("portable.error");
}
