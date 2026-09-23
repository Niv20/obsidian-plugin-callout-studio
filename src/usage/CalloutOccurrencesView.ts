import { ItemView, type WorkspaceLeaf, type ViewStateResult } from "obsidian";
import { t } from "../i18n";
import { registerMenuScopeHost } from "../ui/menuEscape";
import { STATISTICS_ICON_ID } from "../icons/uiIcons";
import type { CalloutRegistry } from "../manager/CalloutRegistry";
import { CalloutCombobox } from "../settings/calloutCombobox";
import type { CalloutDefinition, CalloutRenderRole } from "../types";
import { getCalloutOccurrenceIndex, type CalloutOccurrenceIndex } from "./CalloutOccurrenceIndex";
import type { CalloutOccurrence, CalloutOccurrenceQuery } from "./occurrenceTypes";
import { OccurrenceTypeChoices } from "./occurrenceTypeChoices";
import { navigateToCalloutOccurrence } from "./navigation";
import { createOccurrencesFrame, occurrenceButton, occurrenceRoleLabel, OCCURRENCE_ROLES,
	renderOccurrenceMetrics, type OccurrencesFrame } from "./occurrencesViewFrame";

export const CALLOUT_OCCURRENCES_VIEW = "callout-studio-occurrences";
const PAGE_SIZE = 100;
const BUSY_STATUS_DELAY_MS = 2_000;
const occurrenceKey = (item: CalloutOccurrence): string =>
	JSON.stringify([item.path, item.line, item.from, item.identity]);

/** The saved layout owns filters only; occurrences and counts stay in memory. */
export class CalloutOccurrencesView extends ItemView {
	private readonly index: CalloutOccurrenceIndex;
	private readonly typeChoices: OccurrenceTypeChoices;
	private ids: string[] = [];
	private selectedType = "";
	private role: CalloutRenderRole | undefined;
	private limit = PAGE_SIZE;
	private selected: string | null = null;
	private results: readonly CalloutOccurrence[] = [];
	private unsubscribe: (() => void) | null = null;
	private opened = false;
	private handlersRegistered = false;
	private failed = false;
	private navigating = false;
	private busyStatusVisible = false;
	private busyStatusTimer: number | null = null;
	private busyStatusGeneration = 0;
	private busyStatusKind: "loading" | "stale" | null = null;
	private frame: OccurrencesFrame | null = null;
	private disposeMenuHost?: () => void;
	private picker: CalloutCombobox | null = null;
	private lastIndexState = "";
	private lastChoicesRevision = -1;
	private lastResultsState = "";
	private cachedQuery: { revision: number; key: string; result: CalloutOccurrenceQuery } | null = null;
	private fileCounts = new Map<string, number>();
	private readonly registryChanged = (): void => {
		const before = JSON.stringify(this.ids);
		this.typeChoices.invalidate();
		this.syncChoices(true);
		if (JSON.stringify(this.ids) !== before) this.resetResults();
		if (this.opened) this.render();
	};

	constructor(
		leaf: WorkspaceLeaf,
		private readonly registry: CalloutRegistry,
		private readonly busyStatusDelayMs = BUSY_STATUS_DELAY_MS,
	) {
		super(leaf);
		this.index = getCalloutOccurrenceIndex(this.app);
		this.typeChoices = new OccurrenceTypeChoices(registry, this.index);
		this.resolveType();
	}
	getViewType(): string { return CALLOUT_OCCURRENCES_VIEW; }
	getDisplayText(): string { return t("usage.title"); }
	getIcon(): string { return STATISTICS_ICON_ID; }
	refreshLabels(): void {
		if (!this.opened) return;
		this.clearFrame();
		this.render();
	}
	getState(): Record<string, unknown> { return { ids: [...this.ids], role: this.role }; }
	async setState(state: unknown, result: ViewStateResult): Promise<void> {
		const input = typeof state === "object" && state !== null ? state as Record<string, unknown> : {};
		const ids = Array.isArray(input.ids)
			? input.ids.filter((id): id is string => typeof id === "string" && id.length > 0) : this.ids;
		this.resolveType(ids);
		this.role = OCCURRENCE_ROLES.includes(input.role as CalloutRenderRole) ? input.role as CalloutRenderRole : undefined;
		this.limit = PAGE_SIZE;
		this.selected = null;
		this.picker?.setValue(this.selectedType);
		if (this.opened) this.render();
		await super.setState(state, result);
	}
	async onOpen(): Promise<void> {
		this.opened = true;
		this.typeChoices.invalidate();
		this.lastChoicesRevision = -1;
		this.contentEl.addClass("cs-occurrences-view");
		if (!this.handlersRegistered) {
			this.handlersRegistered = true;
			this.registerDomEvent(this.contentEl, "click", (event) => this.onClick(event));
		}
		this.unsubscribe?.();
		this.unsubscribe = this.index.subscribe(() => {
			if (this.opened && this.indexState() !== this.lastIndexState) this.render();
		});
		this.registry.offChange(this.registryChanged);
		this.registry.onChange(this.registryChanged);
		this.render();
		await this.refresh();
	}
	onClose(): Promise<void> {
		this.opened = false;
		this.resetBusyStatus();
		this.unsubscribe?.();
		this.unsubscribe = null;
		this.registry.offChange(this.registryChanged);
		this.clearFrame();
		this.cachedQuery = null;
		return Promise.resolve();
	}
	private clearFrame(): void {
		this.picker?.destroy();
		this.picker = null;
		this.frame?.roleSelect.destroy();
		this.disposeMenuHost?.(); this.disposeMenuHost = undefined;
		this.frame = null;
		this.lastResultsState = "";
		this.contentEl.empty();
	}
	private choices(): readonly CalloutDefinition[] {
		return this.typeChoices.definitions(this.selectedType);
	}
	private resolveType(ids: readonly string[] = []): void {
		const selection = this.typeChoices.resolve(ids);
		this.selectedType = selection.id;
		this.ids = selection.ids;
	}
	private syncChoices(refreshSelection = false): void {
		const previous = this.selectedType;
		this.resolveType(this.ids);
		if (this.picker && (refreshSelection || previous !== this.selectedType)) {
			const input = this.frame?.pickerHost.querySelector<HTMLInputElement>("input");
			const query = input?.getAttribute("aria-expanded") === "true" ? input.value : undefined;
			this.picker.setValue(this.selectedType);
			if (input && query !== undefined) input.value = query;
		}
		this.picker?.setChoices(() => this.choices());
		this.lastChoicesRevision = this.index.dataRevision;
	}
	private resetResults(): void {
		this.limit = PAGE_SIZE;
		this.selected = null;
		this.contentEl.scrollTop = 0;
		this.app.workspace.requestSaveLayout();
	}
	private syncBusyStatus(busy: boolean): void {
		if (!busy || !this.opened) {
			this.resetBusyStatus();
			return;
		}
		this.busyStatusKind ??= this.index.status === "stale" || this.results.length > 0 ? "stale" : "loading";
		if (this.busyStatusVisible || this.busyStatusTimer !== null) return;
		const generation = ++this.busyStatusGeneration;
		this.busyStatusTimer = window.setTimeout(() => {
			if (generation !== this.busyStatusGeneration) return;
			this.busyStatusTimer = null;
			const status = this.index.status;
			if (!this.opened || status !== "idle" && status !== "loading" && status !== "stale") return;
			this.busyStatusVisible = true;
			this.render();
		}, this.busyStatusDelayMs);
	}
	private resetBusyStatus(): void {
		this.busyStatusGeneration++;
		if (this.busyStatusTimer !== null) window.clearTimeout(this.busyStatusTimer);
		this.busyStatusTimer = null;
		this.busyStatusVisible = false;
		this.busyStatusKind = null;
	}
	private async refresh(): Promise<void> {
		this.failed = false;
		try { await this.index.ensureFresh(); }
		catch { this.failed = true; }
		if (this.opened) this.render();
	}
	private onClick(event: MouseEvent): void {
		const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>("button[data-action]");
		if (!button || button.disabled) return;
		const action = button.dataset.action;
		if (action === "more") { this.limit += PAGE_SIZE; this.render(); return; }
		if (action !== "result") return;
		const occurrence = this.results[Number(button.dataset.result)];
		if (occurrence) void this.openResult(occurrence, event.metaKey || event.ctrlKey);
	}
	private async openResult(occurrence: CalloutOccurrence, newTab: boolean): Promise<void> {
		if (this.navigating) return;
		this.navigating = true;
		const opened = await navigateToCalloutOccurrence(this.app, occurrence, newTab);
		this.navigating = false;
		if (opened) {
			this.selected = occurrenceKey(occurrence);
		} else {
			this.index.invalidate(occurrence.path);
			await this.refresh();
		}
		if (this.opened) this.render();
	}
	private ensureFrame(): OccurrencesFrame {
		if (this.frame) return this.frame;
		this.disposeMenuHost = registerMenuScopeHost(this.contentEl, this.app);
		const frame = this.frame = createOccurrencesFrame(this.contentEl);
		frame.roleSelect.onChange((value) => {
			this.role = OCCURRENCE_ROLES.includes(value as CalloutRenderRole) ? value as CalloutRenderRole : undefined;
			this.resetResults();
			this.render();
		});
		this.picker = new CalloutCombobox(frame.pickerHost, {
			registry: this.registry, choices: () => this.choices(), value: this.selectedType,
			ariaLabel: t("usage.selectType"), labelOf: (def) => def.id,
			groupOf: (def) => this.typeChoices.isRegistered(def)
				? { key: "registered", label: t("usage.registeredCallouts"), order: 0 }
				: { key: "unregistered", label: t("usage.unregisteredCallouts"), order: 1 },
			onChange: (id) => {
				this.resolveType([id]);
				this.resetResults();
				this.render();
			},
		});
		return frame;
	}
	private render(): void {
		const index = this.index;
		if (this.lastChoicesRevision !== index.dataRevision) this.syncChoices();
		this.lastIndexState = this.indexState();
		const key = JSON.stringify([this.ids, this.role]);
		if (this.cachedQuery?.revision !== index.dataRevision || this.cachedQuery.key !== key) {
			this.cachedQuery = { revision: index.dataRevision, key, result: index.query(this.ids, this.role) };
			this.fileCounts.clear();
			for (const occurrence of this.cachedQuery.result.occurrences) {
				this.fileCounts.set(occurrence.path, (this.fileCounts.get(occurrence.path) ?? 0) + 1);
			}
		}
		this.results = this.cachedQuery.result.occurrences;
		const complete = index.status === "ready" && !this.failed;
		const scrollTop = this.contentEl.scrollTop;
		const focused = this.contentEl.ownerDocument.activeElement as HTMLElement | null;
		const focusAction = focused && this.contentEl.contains(focused) ? focused.dataset.action : undefined;
		const focusResult = focused?.dataset.result;
		const frame = this.ensureFrame();
		frame.roleSelect.setValue(this.role ?? "");
		renderOccurrenceMetrics(frame.metrics, index);
		const busy = !this.failed && (index.status === "idle" || index.status === "loading" || index.status === "stale");
		this.syncBusyStatus(busy);
		frame.status.setText(this.failed || index.status === "disposed" ? t("usage.failed")
			: busy && this.busyStatusVisible && this.busyStatusKind === "loading" ? t("usage.loading")
			: index.status === "partial" ? t("usage.partial", { count: index.failures.length })
			: busy && this.busyStatusVisible ? t("usage.stale") : "");
		frame.failures.empty();
		if (index.failures.length > 0) {
			const details = frame.failures.createEl("details");
			details.createEl("summary", { text: t("usage.failedFiles") });
			for (const failure of index.failures.slice(0, PAGE_SIZE)) details.createDiv({ text: failure.path || t("usage.vaultReadFailed") });
		}
		frame.summary.setText(complete || this.results.length > 0
			? t("usage.summary", { count: this.results.length, files: this.cachedQuery.result.fileCount }) : "");
		const resultsState = JSON.stringify([index.dataRevision, key, this.limit, this.selected, complete && this.results.length === 0]);
		if (resultsState !== this.lastResultsState) {
			this.lastResultsState = resultsState;
			frame.results.empty();
			if (complete && this.results.length === 0) frame.results.createEl("p", { text: t("usage.empty") });
			this.renderResults(frame.results);
			const remaining = this.results.length - this.limit;
			if (remaining > 0) occurrenceButton(frame.results, "more", t("usage.more", { count: Math.min(PAGE_SIZE, remaining) }));
		}
		this.contentEl.scrollTop = scrollTop;
		if (focusAction === "result" || focusAction === "more") {
			const selector = focusAction === "result"
				? `button[data-action="result"][data-result="${focusResult}"]` : '[data-action="more"]';
			this.contentEl.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true });
		}
	}
	private indexState(): string {
		return `${this.index.dataRevision}:${this.index.status}:${this.index.failures.length}`;
	}
	private renderResults(content: HTMLElement): void {
		let path = "";
		let group: HTMLElement | null = null;
		for (const [offset, occurrence] of this.results.slice(0, this.limit).entries()) {
			if (occurrence.path !== path || !group) {
				path = occurrence.path;
				group = content.createEl("section", { cls: "cs-occurrences-file" });
				group.createEl("h3", { text: t("usage.fileCount", { path, count: this.fileCounts.get(path) ?? 0 }) });
			}
			const row = occurrenceButton(group, "result", "");
			row.addClass("cs-occurrences-result");
			row.dataset.result = String(offset);
			row.setAttribute("aria-current", String(occurrenceKey(occurrence) === this.selected));
			row.createSpan({ cls: "cs-occurrences-location", text: t("usage.location", { line: occurrence.line + 1, role: occurrenceRoleLabel(occurrence.role) }) });
			const excerpt = row.createSpan({ cls: "cs-occurrences-excerpt" });
			if (occurrence.role === "regular" && occurrence.excerpt.includes("\n")) {
				excerpt.addClass("cs-occurrences-excerpt-split");
				for (const line of occurrence.excerpt.split("\n", 2)) excerpt.createSpan({ cls: "cs-occurrences-excerpt-line", text: line });
			} else excerpt.setText(occurrence.excerpt);
		}
	}
}
