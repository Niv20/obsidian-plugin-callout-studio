import { Component, Modal } from "obsidian";
import type { App } from "obsidian";
import { t } from "../i18n";
import type { SetupDetails } from "../manager/setupDetails";
import { applyModalChrome, removeModalChrome } from "./modalChrome";
import { recoverySourceTime, renderRecoveryDetails } from "./recoveryDetailsView";
import { yieldRecoveryRender } from "./recoveryComparisonTable";

/** A snapshot captured when View details was chosen; viewing never changes settings. */
export class SettingsRecoveryDetailsModal extends Modal {
	private component: Component | null = null;
	private generation = 0;

	constructor(app: App, private readonly details: SetupDetails) {
		super(app);
	}

	onOpen(): void {
		this.component?.unload();
		this.component = new Component();
		this.component.load();
		applyModalChrome(this, { wide: true });
		this.modalEl.addClass("cs-recovery-details-modal");
		this.setTitle(t("versions.details.title"));
		this.titleEl.createSpan({
			text: ` (${recoverySourceTime(this.details.source)})`, cls: "cs-version-detail-date", attr: { dir: "auto" },
		});
		this.contentEl.empty();
		const generation = ++this.generation;
		const loading = this.contentEl.createEl("p", { text: t("recovery.details.loading"), cls: "cs-recovery-detail-loading", attr: { role: "status" } });
		loading.hidden = true;
		const report = this.contentEl.createDiv();
		report.hidden = true;
		this.contentEl.setAttribute("aria-busy", "true");
		const component = this.component;
		const isCurrent = () => generation === this.generation;
		let shownAt: number | null = null;
		const loadingTimer = window.setTimeout(() => {
			if (!isCurrent()) return;
			shownAt = Date.now();
			loading.hidden = false;
		}, 250);
		component.register(() => window.clearTimeout(loadingTimer));
		void yieldRecoveryRender(component).then(async () => {
			if (!isCurrent()) return;
			await renderRecoveryDetails(report, this.details, component, isCurrent);
			if (!isCurrent()) return;
			window.clearTimeout(loadingTimer);
			if (shownAt !== null) await yieldRecoveryRender(component, Math.max(0, 250 - (Date.now() - shownAt)));
			if (!isCurrent()) return;
			loading.remove();
			report.hidden = false;
			this.contentEl.setAttribute("aria-busy", "false");
		}).catch((error: unknown) => {
			if (!isCurrent()) return;
			window.clearTimeout(loadingTimer);
			console.error("[callout-studio] could not render setup comparison", error);
			report.remove();
			loading.setText(t("recovery.details.renderFailed"));
			loading.hidden = false;
			this.contentEl.setAttribute("aria-busy", "false");
		});
	}

	onClose(): void {
		this.generation++;
		this.component?.unload();
		this.component = null;
		this.contentEl.empty();
		this.modalEl.removeClass("cs-recovery-details-modal");
		removeModalChrome(this);
	}
}
