import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { setImmediate } from "node:timers/promises";
import type { App } from "obsidian";
import { getLocale, registerLocale, setLocale, t } from "../src/i18n";
import { he } from "../src/i18n/he";
import { PortableCalloutsModal } from "../src/settings/PortableCalloutsModal";
import { renderPortableRules } from "../src/settings/portableCalloutExamples";
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
			getMarkdownFiles: () => { throw new Error("The introduction must not read notes"); },
			process: () => { throw new Error("The introduction must not write notes"); },
		},
	} as unknown as App;
	const modal = new PortableCalloutsModal(app);
	const containerEl = fakeDom.document.body.createDiv({ cls: "modal-container" });
	const modalEl = containerEl.createDiv({ cls: "modal" });
	const titleEl = modalEl.createDiv({ cls: "modal-title" });
	const contentEl = modalEl.createDiv({ cls: "modal-content" });
	Object.assign(modal, { containerEl, modalEl, titleEl, contentEl, app, scope: app.scope,
		setTitle: (title: string) => { titleEl.setText(title); return modal; }, close: () => modal.onClose() });
	return { modal, modalEl, contentEl, calls,
		destroy: () => { modal.onClose(); containerEl.remove(); },
	};
}

describe("portable conversion introduction", () => {
	it("opens without scanning or changing notes; preview and execution belong to the sidebar", () => {
		const h = harness();
		try {
			h.modal.onOpen();
			assert.equal(h.contentEl.querySelectorAll("table").length, 2);
			assert.equal(h.contentEl.querySelectorAll("tbody tr").length, 4);
			assert.equal(h.contentEl.querySelector(".cs-portable-preview"), null);
			assert.equal(h.contentEl.querySelector(".cs-collapsible-heading"), null);
			assert.equal(h.contentEl.querySelectorAll("svg").length, 0);
			assert.deepEqual(h.calls, []);
			assert.equal(h.modalEl.querySelectorAll(".cs-modal-footer button").length, 2);
		} finally { h.destroy(); }
	});

	it("opens the right sidebar once even if its detached button is clicked twice", async () => {
		const h = harness();
		try {
			h.modal.onOpen();
			const button = h.modalEl.querySelector(".cs-modal-footer .mod-warning")!;
			button.fire("click"); button.fire("click");
			await setImmediate();
			assert.equal(h.calls.filter(call => call.endsWith(":right")).length, 1);
			assert.ok(h.calls.includes("close-settings"));
			assert.ok(h.calls.includes("reveal"));
			assert.equal(h.contentEl.children.length, 0);
		} finally { h.destroy(); }
	});

	it("advertises actual conversion rules in two ordered tables in English and Hebrew", () => {
		const root = fakeDom.document.body.createDiv(), locale = getLocale();
		try {
			registerLocale("he", he);
			for (const language of ["en", "he"]) {
				setLocale(language); root.empty();
				renderPortableRules(root as unknown as HTMLElement);
				const sections = root.querySelectorAll(".cs-portable-rules");
				assert.equal(sections.length, 2);
				assert.equal(sections[0]!.querySelector("h3")!.textContent, t("portable.headingsTable"));
				assert.equal(sections[1]!.querySelector("h3")!.textContent, t("portable.inlineTable"));
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
