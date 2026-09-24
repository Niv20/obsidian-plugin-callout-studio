import { Modal, type App } from "obsidian";
import { t } from "../i18n";
import { applyModalChrome, removeModalChrome } from "../settings/modalChrome";
import { autofocusOnDesktop } from "../settings/modalAutofocus";
import { assertPortableCustomLine } from "../utils/portableCalloutCustom";

export interface PortableReplacementField {
	value: string;
	source: string;
	before?: string;
	after?: string;
	heading?: boolean;
}

/** Only replacement text is editable; context and heading markers stay immutable. */
export class PortableCustomReplacementModal extends Modal {
	private opened = false;
	constructor(app: App, private readonly fields: readonly PortableReplacementField[],
		private readonly save: (values: readonly string[]) => string | undefined) { super(app); }
	onOpen(): void {
		this.opened = true;
		const initialValues = this.fields.map(field => field.value);
		this.contentEl.empty();
		this.modalEl.addClass("cs-portable-custom-modal");
		const footer = applyModalChrome(this, { footer: true });
		this.setTitle(t("portable.customTitle"));
		const fields = this.contentEl.createDiv({ cls: "cs-portable-custom-fields" });
		const error = this.contentEl.createEl("p", { cls: "cs-portable-custom-error", attr: { role: "alert" } });
		const showError = (message: string, input?: HTMLInputElement): void => {
			error.setText(message);
			input?.setAttribute("aria-invalid", "true");
		};
		const inputs = this.fields.map((field, index) => {
			const group = fields.createDiv({ cls: "cs-portable-custom-field" });
			const before = group.createDiv({ cls: "cs-portable-custom-row" });
			before.createSpan({ cls: "cs-portable-custom-label", text: t("portable.before") });
			const source = before.createDiv({ cls: "cs-portable-custom-context", attr: { dir: "ltr" } });
			if (!field.heading && field.before) renderFixedContext(source, field.before, "before");
			source.createEl("code", { text: field.source, attr: { dir: "ltr" } });
			if (!field.heading && field.after) renderFixedContext(source, field.after, "after");
			const label = group.createEl("label", { cls: "cs-portable-custom-row" });
			label.createSpan({ cls: "cs-portable-custom-label", text: t("portable.after") });
			const row = label.createSpan({ cls: "cs-portable-custom-editor", attr: { dir: "ltr" } });
			if (field.before) renderFixedContext(row, field.before, "before", field.heading, true);
			const input = row.createEl("input", { cls: "cs-portable-custom-input", type: "text",
				attr: { dir: "auto", spellcheck: "false", autocomplete: "off" } });
			input.value = initialValues[index]!;
			if (field.after) renderFixedContext(row, field.after, "after", field.heading, true);
			input.addEventListener("paste", event => {
				if (/[\r\n\0\u2028\u2029]/.test(event.clipboardData?.getData("text/plain") ?? "")) {
					event.preventDefault(); showError(t("portable.customInvalid"), input);
				}
			});
			input.addEventListener("keydown", event => {
				// IME Enter commits a composed character; the text input still cannot add a line.
				if (event.key === "Enter" && !event.isComposing) event.preventDefault();
			});
			input.addEventListener("beforeinput", event => {
				if (event.inputType === "insertLineBreak" || event.inputType === "insertParagraph") event.preventDefault();
			});
			return input;
		});
		const hasChanges = (): boolean => inputs.some((input, index) => input.value !== initialValues[index]);
		footer.createEl("button", { text: t("confirm.cancel") }).addEventListener("click", () => this.close());
		const saveButton = footer.createEl("button", { text: t("portable.customSave"), cls: "mod-cta" });
		saveButton.disabled = true;
		for (const input of inputs) input.addEventListener("input", () => {
			error.setText(""); input.removeAttribute("aria-invalid");
			saveButton.disabled = !hasChanges();
		});
		saveButton.addEventListener("click", () => {
			if (!this.opened || !hasChanges()) return;
			const values = inputs.map(input => input.value);
			try { values.forEach(assertPortableCustomLine); }
			catch { showError(t("portable.customInvalid")); return; }
			const message = this.save(values);
			if (message) showError(message);
			else this.close();
		});
		autofocusOnDesktop(inputs[0]);
	}
	onClose(): void { this.opened = false; this.contentEl.empty(); removeModalChrome(this); }
}

/** Keep nearby context; a narrow editor hides only the farthest third word. */
function renderFixedContext(host: HTMLElement, text: string, side: "before" | "after", heading = false, hidden = false): void {
	const span = host.createSpan({ cls: "cs-portable-custom-fixed" });
	if (hidden) span.setAttribute("aria-hidden", "true");
	if (heading) { span.addClass("cs-portable-custom-markers"); span.setText(text); return; }
	const words = text.trim().split(/\s+/);
	for (const [index, word] of words.entries()) {
		if (index) span.appendText(" ");
		const part = span.createSpan({ text: word });
		if (words.length >= 3 && index === (side === "before" ? 0 : words.length - 1)) part.addClass("cs-portable-custom-outer-word");
	}
}
