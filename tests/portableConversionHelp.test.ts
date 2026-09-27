import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { setImmediate } from "node:timers/promises";
import { Setting, type App, type ButtonComponent } from "obsidian";
import { getLocale, registerLocale, setLocale, t } from "../src/i18n";
import { he } from "../src/i18n/he";
import { PortableConversionHelpModal } from "../src/portable/PortableConversionHelpModal";
import { renderPortableRules } from "../src/settings/portableCalloutExamples";
import { renderResetSection } from "../src/settings/sections/DataManagementSection";
import type { SettingsSectionContext } from "../src/settings/sections/types";
import { convertPortableCallouts } from "../src/utils/portableCallouts";
import { fakeDom } from "./support/fakeDom";
import { TestKeymap, TestScope } from "./support/fakeKeymap";

function harness() {
	fakeDom.light();
	const calls: string[] = [];
	const leaf = { loadIfDeferred: async () => {}, setViewState: async () => {} };
	const app = {
		keymap: new TestKeymap(), scope: new TestScope(),
		setting: { close: () => calls.push("close-settings") },
		workspace: {
			ensureSideLeaf: async (type: string, side: string) => { calls.push(`${type}:${side}`); return leaf; },
			revealLeaf: async () => { calls.push("reveal"); },
		},
		vault: {
			getMarkdownFiles: () => { throw new Error("Help must not read notes"); },
			process: () => { throw new Error("Help must not write notes"); },
		},
	} as unknown as App;
	const modal = new PortableConversionHelpModal(app);
	const containerEl = fakeDom.document.body.createDiv({ cls: "modal-container" });
	const modalEl = containerEl.createDiv({ cls: "modal" });
	const titleEl = modalEl.createDiv({ cls: "modal-title" });
	const contentEl = modalEl.createDiv({ cls: "modal-content" });
	Object.assign(modal, { containerEl, modalEl, titleEl, contentEl, app, scope: app.scope,
		setTitle: (title: string) => { titleEl.setText(title); return modal; }, close: () => modal.onClose() });
	return { app, modal, modalEl, contentEl, calls,
		destroy: () => { modal.onClose(); containerEl.remove(); },
	};
}

describe("portable conversion entry and help", () => {
	it("shows guidance without scanning, changing notes or offering a second conversion entry point", () => {
		const h = harness();
		try {
			h.modal.onOpen();
			assert.equal(h.modalEl.querySelector(".modal-title")?.textContent, t("portable.help"));
			assert.ok(h.contentEl.textContent.includes(t("portable.helpIntro")));
			assert.equal(h.contentEl.querySelectorAll("table").length, 1);
			assert.equal(h.contentEl.querySelectorAll("h1, h2, h3, h4, h5, h6").length, 0);
			assert.equal(h.contentEl.querySelectorAll("tbody tr").length, 4);
			assert.equal(h.contentEl.querySelector(".cs-portable-preview"), null);
			assert.equal(h.contentEl.querySelector(".cs-collapsible-heading"), null);
			assert.equal(h.contentEl.querySelectorAll("svg").length, 0);
			assert.deepEqual(h.calls, []);
			assert.equal(h.modalEl.querySelector(".cs-modal-footer"), null);
		} finally { h.destroy(); }
	});

	it("opens the right sidebar directly from Review conversion in settings", async () => {
		const h = harness();
		const root = fakeDom.document.body.createDiv();
		const original = Object.getOwnPropertyDescriptor(Setting.prototype, "addButton")!;
		let review: (() => unknown) | undefined;
		try {
			Setting.prototype.addButton = function (callback): Setting {
				let label = "";
				const button = {
					buttonEl: root.createEl("button"),
					setButtonText(text: string) { label = text; return this; },
					setWarning() { return this; },
					onClick(action: () => unknown) { if (label === t("portable.review")) review = action; return this; },
				} as unknown as ButtonComponent;
				callback(button);
				return this;
			};
			renderResetSection({ app: h.app } as SettingsSectionContext, root as unknown as HTMLElement);
			assert.ok(review);
			review();
			await setImmediate();
			assert.equal(h.calls.filter(call => call.endsWith(":right")).length, 1);
			assert.ok(h.calls.includes("close-settings"));
			assert.ok(h.calls.includes("reveal"));
			assert.equal(h.contentEl.children.length, 0);
		} finally { Object.defineProperty(Setting.prototype, "addButton", original); root.remove(); h.destroy(); }
	});

	it("combines actual heading and inline conversion rules in one localized comparison table", () => {
		const root = fakeDom.document.body.createDiv(), locale = getLocale();
		try {
			registerLocale("he", he);
			for (const language of ["en", "he"]) {
				setLocale(language); root.empty();
				renderPortableRules(root as unknown as HTMLElement);
				const sections = root.querySelectorAll(".cs-portable-rules");
				assert.equal(sections.length, 1);
				assert.equal(root.querySelectorAll("table").length, 1);
				assert.deepEqual(root.querySelectorAll("th").map(cell => cell.textContent), [t("portable.before"), t("portable.after")]);
				assert.equal(root.querySelectorAll("tbody tr").length, 4);
				assert.deepEqual(root.querySelectorAll("tbody tr").map(row => row.querySelector("code")!.textContent.startsWith("# ")),
					[true, true, false, false]);
				for (const row of root.querySelectorAll("tbody tr")) {
					const [before, after] = row.querySelectorAll("code");
					assert.equal(convertPortableCallouts(before!.textContent).content, after!.textContent);
					assert.equal(before!.getAttribute("dir"), "ltr");
					assert.equal(after!.getAttribute("dir"), "ltr");
					assert.equal(row.querySelectorAll("td").length, 2);
				}
			}
		} finally { setLocale(locale); root.remove(); }
	});
});
