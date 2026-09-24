import { Modal, type App } from "obsidian";
import { t } from "../i18n";
import { openPortableConversionFromSettings } from "../portable/registerPortableConversionView";
import { applyModalChrome, removeModalChrome } from "./modalChrome";
import { renderPortableRules } from "./portableCalloutExamples";

/** A compact explanation; source review and confirmation live in the sidebar. */
export class PortableCalloutsModal extends Modal {
	private opening = false;
	private generation = 0;

	constructor(app: App) { super(app); }

	onOpen(): void {
		this.generation++;
		this.opening = false;
		this.contentEl.empty();
		this.modalEl.addClass("cs-portable-modal");
		const footer = applyModalChrome(this, { footer: true });
		this.setTitle(t("portable.title"));
		this.contentEl.createEl("p", { text: t("portable.intro") });
		renderPortableRules(this.contentEl);
		this.contentEl.createEl("p", { cls: "cs-portable-warning", text: t("portable.backup") });
		footer.createEl("button", { text: t("confirm.cancel") }).addEventListener("click", () => this.close());
		const review = footer.createEl("button", { text: t("portable.convert"), cls: "mod-warning" });
		const generation = this.generation;
		review.addEventListener("click", () => {
			if (this.opening || generation !== this.generation) return;
			this.opening = true;
			review.disabled = true;
			this.close();
			void openPortableConversionFromSettings(this.app);
		});
	}

	onClose(): void {
		this.generation++;
		this.contentEl.empty();
		removeModalChrome(this);
	}
}
