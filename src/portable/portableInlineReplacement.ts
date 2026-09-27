import { Component } from "obsidian";
import { t } from "../i18n";
import { assertPortableCustomLine } from "../utils/portableCalloutCustom";
import type { PortableReplacementField } from "./portableReplacementEditor";

/** A wrapping editor for one replacement; heading markers stay read-only. */
export class PortableInlineReplacement extends Component {
	readonly element: HTMLElement;
	readonly input: HTMLTextAreaElement;
	private readonly error: HTMLElement;
	private readonly mirror: HTMLElement;
	private active = true;
	constructor(host: HTMLElement, private readonly field: PortableReplacementField,
		private readonly save: (value: string, refocus: boolean) => string | undefined,
		private readonly cancel: (refocus: boolean) => void, private readonly onChange: () => void = () => {}) {
		super();
		this.load();
		this.element = host.createDiv({ cls: "cs-portable-inline" });
		const row = this.element.createDiv({ cls: "cs-portable-custom-editor", attr: { dir: "ltr" } });
		if (field.heading && field.before) renderHeadingMarkers(row, field.before);
		const grow = row.createDiv({ cls: "cs-portable-input-grow" });
		this.mirror = grow.createDiv({ cls: "cs-portable-input-mirror", attr: { "aria-hidden": "true" } });
		this.input = grow.createEl("textarea", { cls: "cs-portable-custom-input", attr: {
			rows: "1", dir: "auto", spellcheck: "false", autocomplete: "off", enterkeyhint: "done",
			"aria-keyshortcuts": "Enter Escape",
		} });
		this.input.value = field.value;
		if (field.heading && field.after) renderHeadingMarkers(row, field.after);
		this.error = this.element.createDiv({ cls: "cs-portable-custom-error", attr: { role: "alert" } });
		this.refreshLabels();
		this.sync();
		this.registerDomEvent(this.input, "input", () => {
			this.error.setText(""); this.input.removeAttribute("aria-invalid"); this.sync(); this.onChange();
		});
		this.registerDomEvent(this.input, "paste", event => {
			if (/[\r\n\0\u2028\u2029]/.test(event.clipboardData?.getData("text/plain") ?? "")) {
				event.preventDefault(); this.showError(t("portable.customInvalid"));
			}
		});
		this.registerDomEvent(this.input, "beforeinput", event => {
			if (event.inputType === "insertLineBreak" || event.inputType === "insertParagraph") {
				event.preventDefault();
				// Some mobile keyboards emit only beforeinput for their Enter/Done key.
				if (!event.isComposing) this.submit();
			}
		});
		this.registerDomEvent(this.input, "keydown", event => {
			if (event.isComposing) return;
			if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); this.submit(); }
			if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); this.dismiss(); }
		});
		this.register(() => { this.active = false; this.element.remove(); });
	}
	refreshLabels(): void {
		this.input.setAttribute("aria-label", t("portable.replacement"));
	}
	get changed(): boolean { return this.input.value !== this.field.value; }
	get customized(): boolean { return this.input.value !== (this.field.defaultValue ?? this.field.value); }
	focus(selectAll = false): void {
		this.input.focus({ preventScroll: true });
		if (selectAll) this.input.select();
	}
	private sync(): void {
		// An invisible mirror grows with wrapped text without changing the stored line.
		this.mirror.setText(this.input.value + " ");
	}
	private showError(message: string): void {
		this.error.setText(message); this.input.setAttribute("aria-invalid", "true");
	}
	submit(refocus = true): string | undefined {
		if (!this.active) return;
		if (!this.changed) { this.dismiss(refocus); return; }
		try { assertPortableCustomLine(this.input.value); }
		catch { const message = t("portable.customInvalid"); this.showError(message); return message; }
		const message = this.save(this.input.value, refocus);
		if (message) this.showError(message);
		return message;
	}
	private dismiss(refocus = true): void { if (this.active) this.cancel(refocus); }
}

function renderHeadingMarkers(host: HTMLElement, text: string): void {
	host.createSpan({ cls: "cs-portable-custom-markers", text });
}
