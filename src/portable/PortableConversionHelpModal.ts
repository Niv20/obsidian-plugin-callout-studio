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
		// Advice, so a line of the window's own text rather than a box. It is the
		// one thing here that cannot be taken back, so it is bold and in
		// Obsidian's warning colour (`p.mod-warning`) rather than plain text.
		this.contentEl.createEl("p", { cls: "mod-warning cs-portable-backup", text: t("portable.backup") });
	}

	onClose(): void {
		this.contentEl.empty();
		removeModalChrome(this);
	}
}
