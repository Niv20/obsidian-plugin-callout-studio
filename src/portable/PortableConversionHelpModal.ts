import { Modal, type App } from "obsidian";
import { t } from "../i18n";
import { applyModalChrome, removeModalChrome } from "../settings/modalChrome";
import { renderPortableRules } from "../settings/portableCalloutExamples";

/** Optional guidance for the review sidebar; never reads or changes notes. */
export class PortableConversionHelpModal extends Modal {
	constructor(app: App) { super(app); }

	onOpen(): void {
		this.contentEl.empty();
		this.modalEl.addClass("cs-portable-modal");
		applyModalChrome(this);
		this.setTitle(t("portable.help"));
		this.contentEl.createEl("p", { text: t("portable.intro") });
		this.contentEl.createEl("p", { text: t("portable.helpIntro") });
		renderPortableRules(this.contentEl);
		// Advice, so a line of the window's own text rather than a box.
		this.contentEl.createEl("p", { text: t("portable.backup") });
	}

	onClose(): void {
		this.contentEl.empty();
		removeModalChrome(this);
	}
}
