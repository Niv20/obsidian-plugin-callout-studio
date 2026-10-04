/** Real table markup and preview controls for the optional browser layout check. */
import { Component } from "obsidian";
import { DEFAULT_SETTINGS } from "../../src/constants";
import { renderRecoveryComparison } from "../../src/settings/recoveryComparisonTable";
import { renderRecoveryPreview } from "../../src/settings/recoveryPreview";
import type { RecoveryItem, RecoveryReport } from "../../src/settings/recoveryModel";
import type { CalloutDefinition, PluginData } from "../../src/types";

/** Only Obsidian's small DOM convenience layer; layout remains the real browser's. */
function installDomHelpers(): void {
	Object.assign(Node.prototype, {
		createEl<K extends keyof HTMLElementTagNameMap>(this: Node, tag: K, options: DomElementInfo | string = {}): HTMLElementTagNameMap[K] {
			const info = typeof options === "string" ? { cls: options } : options;
			const element = document.createElement(tag);
			if (info.cls) element.className = Array.isArray(info.cls) ? info.cls.join(" ") : info.cls;
			if (typeof info.text === "string") element.textContent = info.text;
			for (const [key, value] of Object.entries(info.attr ?? {})) element.setAttribute(key, String(value));
			this.appendChild(element);
			return element;
		},
		createDiv(this: Node, options?: DomElementInfo | string): HTMLDivElement { return this.createEl("div", options); },
		createSpan(this: Node, options?: DomElementInfo | string): HTMLSpanElement { return this.createEl("span", options); },
	});
	Object.assign(HTMLElement.prototype, {
		addClass(this: HTMLElement, cls: string): void { this.classList.add(cls); },
		removeClass(this: HTMLElement, cls: string): void { this.classList.remove(cls); },
		hasClass(this: HTMLElement, cls: string): boolean { return this.classList.contains(cls); },
		toggleClass(this: HTMLElement, cls: string, force: boolean): void { this.classList.toggle(cls, force); },
		setCssProps(this: HTMLElement, props: Record<string, string>): void {
			for (const [key, value] of Object.entries(props)) this.style.setProperty(key, value);
		},
		hide(this: HTMLElement): void { this.setCssProps({ display: "none" }); },
		show(this: HTMLElement): void { this.style.removeProperty("display"); },
	});
}

const preview: CalloutDefinition = {
	id: "comparison-example", displayName: "Saved callout", icon: { type: "emoji", value: "🌿" },
	colorLight: "#185fca", colorDark: "#76b9fa", foldable: true, defaultFolded: false, builtIn: false, source: "user",
};

const savedImages: Partial<PluginData> = {
	settings: { ...DEFAULT_SETTINGS, userImages: [{
		id: "img-fixture", name: "diamond.svg", format: "svg", width: 24, height: 24, monochrome: true, rev: 1, addedAt: 1,
		svg: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M12 2 22 12 12 22 2 12Z"/></svg>',
	}] },
};

function item(key: string, summary: boolean, fields: boolean): RecoveryItem {
	return {
		key, title: `Callout ${key}`, kind: "changed",
		summary: summary ? (parent, side, component) => renderRecoveryPreview(parent, savedImages,
			side === "before" ? preview : { ...preview, icon: { type: "image", value: "img-fixture", recolor: true } }, component) : undefined,
		fields: fields ? ["Color", "Title"].map(label => ({
			label, before: "Current value", after: "Earlier value",
			render: (parent: HTMLElement, value: unknown) => { parent.createSpan({ text: String(value) }); },
		})) : [],
	};
}

/** All terminal row shapes, with enough preceding items to pin and release the head. */
export async function mountRecoveryTableFixture(): Promise<void> {
	installDomHelpers();
	const container = document.body.createDiv({ cls: "modal-container cs-modal-container" });
	const modal = container.createDiv({ cls: "modal cs-modal cs-modal-wide cs-recovery-details-modal" });
	modal.createDiv({ cls: "modal-header" }).createDiv({ cls: "modal-title", text: "Version details" });
	const scroller = modal.createDiv({ cls: "modal-content" });
	const report = scroller.createDiv({ cls: "cs-recovery-detail-report" });
	const component = new Component(); component.load();
	const model: RecoveryReport = {
		sides: { before: { data: {}, callouts: new Map() }, after: { data: {}, callouts: new Map() } },
		sections: ["summary", "fields", "title-only"].map(id => ({
			id, title: `Section ending with ${id}`,
			items: [
				...Array.from({ length: 6 }, (_, index) => item(`${id}-${index}`, true, true)),
				item(`${id}-last`, id !== "title-only", id === "fields"),
			],
		})),
	};
	await renderRecoveryComparison(report, model, component, () => true);
	if (!report.querySelector(".cs-recovery-preview-icon.is-mask") ||
		!Array.from(report.querySelectorAll(".cs-recovery-preview-icon")).some(icon => icon.textContent === "🌿")) {
		throw new Error("Fixture failed to render its emoji and nested image-mask previews");
	}
	// The shared module stub intentionally draws no icons. Give controls the
	// same SVG box as Obsidian so this remains a representative layout fixture.
	for (const parent of Array.from(report.querySelectorAll(".cs-disclosure-chevron, .cs-recovery-preview-fold"))) {
		const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		svg.setAttribute("class", "svg-icon"); svg.setAttribute("viewBox", "0 0 24 24");
		const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
		path.setAttribute("d", "m9 6 6 6-6 6"); path.setAttribute("fill", "none");
		path.setAttribute("stroke", "currentColor"); path.setAttribute("stroke-width", "2");
		svg.appendChild(path); parent.appendChild(svg);
	}
	// Let the final table release its sticky head without hitting the modal's
	// maximum scroll offset first. This represents later report sections.
	report.createDiv({ attr: { style: "height: 600px" } });
}

function required<T extends Element>(selector: string): T {
	const element = document.querySelector<T>(selector);
	if (!element) throw new Error(`Missing fixture element: ${selector}`);
	return element;
}

export function scrollRecoveryTable(section: string, position: "top" | "middle" | "bottom" | "end"): void {
	const scroller = required<HTMLElement>(".modal-content");
	const table = required<HTMLTableElement>(`[data-recovery-section="${section}"]`);
	const origin = table.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
	const head = table.tHead!.getBoundingClientRect().height;
	const height = table.getBoundingClientRect().height;
	scroller.scrollTop = position === "top" ? origin - 16
		: position === "middle" ? origin + height / 2
			: position === "bottom" ? origin + height - scroller.clientHeight + 16
				: origin + height - head / 2;
}

/** Geometry and hit testing catch accidental scroll containers and clipped controls. */
export function recoveryTableSnapshot(section: string) {
	const table = required<HTMLTableElement>(`[data-recovery-section="${section}"]`);
	const scroller = required<HTMLElement>(".modal-content");
	const head = table.tHead!;
	const toggle = head.querySelector<HTMLButtonElement>("button")!;
	const rect = (element: Element) => {
		const bounds = element.getBoundingClientRect();
		return [bounds.x, bounds.y, bounds.width, bounds.height].map(value => Math.round(value * 100) / 100);
	};
	const h = head.getBoundingClientRect(), t = toggle.getBoundingClientRect();
	const hit = (x: number, y: number) => {
		const target = document.elementFromPoint(x, y);
		return { table: target?.closest("table") === table, toggle: target?.closest("button") === toggle };
	};
	return {
		table: rect(table), head: rect(head), scroller: rect(scroller), toggle: rect(toggle),
		rows: Array.from(table.querySelectorAll("tr")).map(rect),
		scrollHeight: scroller.scrollHeight, scrollWidth: scroller.scrollWidth,
		expanded: toggle.getAttribute("aria-expanded"),
		center: hit(t.x + t.width / 2, t.y + t.height / 2),
		corners: [hit(h.left + 1, h.top + 1), hit(h.right - 1, h.top + 1)],
		focus: document.activeElement === toggle,
		outline: getComputedStyle(toggle).outlineStyle,
	};
}
