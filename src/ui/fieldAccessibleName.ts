/** Screen-reader field names without Obsidian's aria-label hover tooltip. */
let fieldLabelSequence = 0;
const labels = new WeakMap<HTMLElement, HTMLElement>();

export function setFieldAccessibleName(field: HTMLElement, name: string): void {
	let label = labels.get(field);
	if (!label) {
		label = field.parentElement?.createSpan({
			cls: "cs-field-accessible-label",
			attr: { id: `cs-field-label-${fieldLabelSequence++}`, hidden: "" },
		});
		if (!label) return;
		labels.set(field, label);
	}
	label.setText(name);
	field.setAttribute("aria-labelledby", label.id);
	field.removeAttribute("aria-label");
	field.removeAttribute("title");
}
