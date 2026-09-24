import { ItemView, type WorkspaceLeaf, type ViewStateResult } from "obsidian";
import { t } from "../i18n";
import { registerMenuScopeHost } from "../ui/menuEscape";
import { STATISTICS_ICON_ID } from "../icons/uiIcons";
import type { CalloutRegistry } from "../manager/CalloutRegistry";
import { CalloutCombobox } from "../settings/calloutCombobox";
import type { CalloutRenderRole } from "../types";
import { getCalloutOccurrenceIndex, type CalloutOccurrenceIndex } from "./CalloutOccurrenceIndex";
import { SidebarActiveFile } from "../ui/sidebarActiveFile";
import { navigateToSidebarFile } from "../ui/sidebarNavigation";
import { SidebarSourceSelection } from "../ui/sidebarSelection";
import type { CalloutOccurrence, CalloutOccurrenceQuery } from "./occurrenceTypes";
import { ALL_TYPES_ID, OccurrenceTypeChoices, occurrencePickerChoices } from "./occurrenceTypeChoices";
import { OccurrenceResults } from "./occurrenceResults";
import { navigateToCalloutOccurrence } from "./navigation";
import { createOccurrencesFrame, OCCURRENCE_ROLES, type OccurrencesFrame } from "./occurrencesViewFrame";

export const CALLOUT_OCCURRENCES_VIEW = "callout-studio-occurrences";
const PAGE_SIZE = 100;
const BUSY_STATUS_DELAY_MS = 2_000;

/** The saved layout owns filters only; occurrences and counts stay in memory. */
export class CalloutOccurrencesView extends ItemView {
	private readonly index: CalloutOccurrenceIndex;
	private readonly typeChoices: OccurrenceTypeChoices;
	private readonly activeFile: SidebarActiveFile;
	private ids: string[] = [];
	private selectedType = ALL_TYPES_ID;
	private allTypes = true;
	private role: CalloutRenderRole | undefined;
	private limit = PAGE_SIZE;
	private readonly resultCards = new OccurrenceResults(PAGE_SIZE);
	private readonly sourceSelection = new SidebarSourceSelection();
	private results: readonly CalloutOccurrence[] = [];
	private unsubscribe: (() => void) | null = null;
	private opened = false;
	private handlersRegistered = false;
	private failed = false;
	private navigating = false;
	private navigationGeneration = 0;
	private busyStatusVisible = false;
	private busyStatusTimer: number | null = null;
	private busyStatusGeneration = 0;
	private busyStatusKind: "loading" | "stale" | null = null;
	private frame: OccurrencesFrame | null = null;
	private disposeMenuHost?: () => void;
	private picker: CalloutCombobox | null = null;
	private lastIndexState = "";
	private lastChoicesRevision = -1;
	private cachedQuery: { revision: number; key: string; result: CalloutOccurrenceQuery } | null = null;
	private readonly registryChanged = (): void => {
		const before = JSON.stringify(this.ids);
		this.typeChoices.invalidate();
		this.syncChoices(true);
		if (JSON.stringify(this.ids) !== before) this.resetResults();
		if (this.opened) this.render();
	};

	constructor(leaf: WorkspaceLeaf, private readonly registry: CalloutRegistry,
		private readonly busyStatusDelayMs = BUSY_STATUS_DELAY_MS) {
		super(leaf);
		this.index = getCalloutOccurrenceIndex(this.app);
		this.typeChoices = new OccurrenceTypeChoices(registry, this.index);
		this.activeFile = new SidebarActiveFile(this.app,
			(ref) => this.registerEvent(ref),
			(path) => {
				this.sourceSelection.clear();
				this.resultCards.setActiveFile(path);
				if (this.opened && this.frame) this.activeFile.sync(this.results, this.limit, this.index.status, this.failed);
			},
			(limit) => { this.limit = limit; this.render(); }, PAGE_SIZE);
	}
	getViewType(): string { return CALLOUT_OCCURRENCES_VIEW; }
	getDisplayText(): string { return t("usage.title"); }
	getIcon(): string { return STATISTICS_ICON_ID; }
	refreshAppearance(): void {
		if (this.opened) this.registryChanged();
	}
	refreshLabels(): void {
		if (!this.opened) return;
		this.clearFrame();
		this.render();
	}
	getState(): Record<string, unknown> { return { ids: [...this.ids], role: this.role, ...(this.allTypes ? { allTypes: true } : {}) }; }
	async setState(state: unknown, result: ViewStateResult): Promise<void> {
		const input = typeof state === "object" && state !== null ? state as Record<string, unknown> : {};
		const ids = Array.isArray(input.ids)
			? input.ids.filter((id): id is string => typeof id === "string" && id.length > 0) : this.ids;
		if (input.allTypes === true || Array.isArray(input.ids) && ids.length === 0 && input.allTypes !== false) {
			this.allTypes = true;
			this.selectedType = ALL_TYPES_ID;
			this.ids = [];
		} else if (Array.isArray(input.ids) || input.allTypes === false) this.resolveType(ids);
		this.role = OCCURRENCE_ROLES.includes(input.role as CalloutRenderRole) ? input.role as CalloutRenderRole : undefined;
		this.limit = PAGE_SIZE;
		this.navigationGeneration++;
		this.resultCards.select(null); this.sourceSelection.clear();
		if (this.frame) this.frame.scroll.scrollTop = 0;
		this.activeFile.cancelReveal();
		this.picker?.setValue(this.selectedType);
		this.frame?.roleSelect.setValue(this.role ?? "");
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
		this.activeFile.open();
		this.render();
		await this.refresh();
	}
	onClose(): Promise<void> {
		this.opened = false;
		this.navigationGeneration++;
		this.resultCards.select(null); this.sourceSelection.clear();
		this.resetBusyStatus();
		this.unsubscribe?.();
		this.unsubscribe = null;
		this.registry.offChange(this.registryChanged);
		this.activeFile.close();
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
		this.resultCards.clear();
		this.activeFile.clearSections();
		this.contentEl.empty();
	}
	private resolveType(ids: readonly string[] = []): void {
		this.allTypes = false;
		const selection = this.typeChoices.resolve(ids);
		this.selectedType = selection.id;
		this.ids = selection.ids;
	}
	private syncChoices(refreshSelection = false): void {
		const previous = this.selectedType;
		if (!this.allTypes) this.resolveType(this.ids);
		if (this.picker && (refreshSelection || previous !== this.selectedType)) {
			const input = this.frame?.pickerHost.querySelector<HTMLInputElement>("input");
			const query = input?.getAttribute("aria-expanded") === "true" ? input.value : undefined;
			this.picker.setValue(this.selectedType);
			if (input && query !== undefined) input.value = query;
		}
		this.picker?.setChoices(() => occurrencePickerChoices(this.typeChoices, this.selectedType));
		this.lastChoicesRevision = this.index.dataRevision;
	}
	private resetResults(): void {
		this.limit = PAGE_SIZE;
		this.navigationGeneration++;
		this.resultCards.select(null); this.sourceSelection.clear();
		// render() preserves the current scroll offset after a picker commit.
		this.activeFile.cancelReveal();
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
		if (action === "file" && button.dataset.path) { void this.openResult(button.dataset.path, event.metaKey || event.ctrlKey); return; }
		if (action !== "result") return;
		const occurrence = this.resultCards.getOccurrence(button);
		if (occurrence) void this.openResult(occurrence, event.metaKey || event.ctrlKey);
	}
	private async openResult(occurrence: CalloutOccurrence | string, newTab: boolean): Promise<void> {
		if (this.navigating) return;
		this.navigating = true;
		const path = typeof occurrence === "string" ? occurrence : occurrence.path;
		const generation = this.navigationGeneration;
		const isCurrent = (): boolean => this.opened && generation === this.navigationGeneration;
		this.activeFile.beginResultNavigation(path);
		let opened = false;
		let trackSelection: (() => void) | undefined;
		try { opened = await (typeof occurrence === "string"
			? navigateToSidebarFile(this.app, path, newTab, isCurrent)
			: navigateToCalloutOccurrence(this.app, occurrence, newTab, isCurrent,
				(editor, range) => { trackSelection = () => this.sourceSelection.watch(editor, range, () => this.resultCards.select(null)); })); }
		finally { this.activeFile.endResultNavigation(path); this.navigating = false; }
		if (!isCurrent()) return;
		if (opened) {
			this.activeFile.openedResult(path); trackSelection?.();
			if (typeof occurrence === "string") this.sourceSelection.clear();
			this.resultCards.select(typeof occurrence === "string" ? null : occurrence);
		} else {
			this.index.invalidate(path);
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
			registry: this.registry, choices: () => occurrencePickerChoices(this.typeChoices, this.selectedType), value: this.selectedType,
			ariaLabel: t("vaultStats.columnType"), labelOf: (def) => def.id === ALL_TYPES_ID ? t("usage.allTypes") : def.id,
			iconlessOptionId: ALL_TYPES_ID,
			hideSingleGroup: true,
			showSingleGroupKey: "browse",
			groupOf: (def) => def.id === ALL_TYPES_ID
				? { key: "browse", label: t("usage.browse"), order: -1 }
				: this.typeChoices.isRegistered(def)
				? { key: "registered", label: t("usage.registeredCallouts"), order: 0 }
				: { key: "unregistered", label: t("usage.unregisteredCallouts"), order: 1 },
			onChange: (id) => {
				if (id === ALL_TYPES_ID) { this.allTypes = true; this.ids = []; this.selectedType = ALL_TYPES_ID; }
				else this.resolveType([id]);
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
		const key = JSON.stringify([this.allTypes, this.ids, this.role]);
		if (this.cachedQuery?.revision !== index.dataRevision || this.cachedQuery.key !== key) {
			this.cachedQuery = { revision: index.dataRevision, key, result: index.query(this.allTypes ? undefined : this.ids, this.role) };
		}
		this.results = this.cachedQuery.result.occurrences;
		const complete = index.status === "ready" && !this.failed;
		const scrollTop = this.frame?.scroll.scrollTop ?? 0;
		const frame = this.ensureFrame();
		frame.roleSelect.setValue(this.role ?? "");
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
		this.resultCards.render(frame.results, this.results, this.limit, complete,
			(path, section) => this.activeFile.addSection(path, section), () => this.activeFile.clearSections());
		frame.scroll.scrollTop = scrollTop;
		this.activeFile.sync(this.results, this.limit, index.status, this.failed);
	}
	private indexState(): string { return `${this.index.dataRevision}:${this.index.status}:${this.index.failures.length}`; }
}
