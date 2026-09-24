import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Menu, Notice, type MenuItem } from "obsidian";
import { t } from "../src/i18n";
import { PortableCustomReplacementModal } from "../src/portable/PortableCustomReplacementModal";
import { portableConversionViewHarness as harness } from "./support/portableConversionViewHarness";

function customHarness(notes?: Record<string, string>) {
	const h = harness(notes), items: { title: string; run: () => void }[] = [];
	const opened: PortableCustomReplacementModal[] = [];
	const patches: Array<[object, string, PropertyDescriptor | undefined]> = [];
	function patch(target: object, name: string, value: unknown): void {
		patches.push([target, name, Object.getOwnPropertyDescriptor(target, name)]);
		Object.defineProperty(target, name, { configurable: true, writable: true, value });
	}
	patch(Menu.prototype, "addItem", function (this: Menu, build: (item: MenuItem) => void) {
		const record = { title: "", run: () => {} };
		const item = {
			setTitle: (title: string) => { record.title = title; return item; },
			setIcon: () => item,
			onClick: (run: () => void) => { record.run = run; return item; },
		} as unknown as MenuItem;
		build(item); items.push(record); return this;
	});
	patch(Menu.prototype, "showAtMouseEvent", () => {});
	patch(PortableCustomReplacementModal.prototype, "open", function (this: PortableCustomReplacementModal) { opened.push(this); });
	patch(PortableCustomReplacementModal.prototype, "close", () => {});
	function context(index = 0, link = false): void {
		items.length = 0;
		const target = h.root.querySelectorAll(link ? ".cs-portable-link-change button" : ".cs-portable-change-body")[index]!;
		h.root.fire("contextmenu", { target, preventDefault: () => {} });
	}
	function openEditor(index = 0) {
		context(index); assert.ok(items[0]); items[0].run(); assert.ok(opened.length);
		const modal = opened[opened.length - 1] as unknown as { fields: { value: string; before?: string; after?: string; source: string; heading?: boolean }[]; save: (values: readonly string[]) => string | undefined };
		return { fields: modal.fields, value: modal.fields[0]!.value, save: (value: string | readonly string[]) => modal.save(typeof value === "string" ? [value] : value) };
	}
	return { ...h, items, context, openEditor,
		after: (index = 0) => h.root.querySelectorAll(".cs-portable-change .cs-portable-after")[index]!.textContent,
		badges: () => h.root.querySelectorAll(".cs-portable-custom-badge"),
		destroy: async () => {
			await h.destroy();
			for (const [target, name, descriptor] of patches.reverse()) {
				if (descriptor) Object.defineProperty(target, name, descriptor);
				else delete (target as Record<string, unknown>)[name];
			}
		},
	};
}

describe("custom replacement context menus", () => {
	it("edits without selecting, navigating or writing, then restores the default", async () => {
		const h = customHarness({ "a.md": "[!note]" });
		try {
			await h.view.onOpen(); h.choose(0, false);
			const modal = h.openEditor();
			assert.equal(modal.value, "note");
			assert.equal(h.items[0]!.title, t("portable.customize"));
			assert.equal(modal.save("**Custom**"), undefined);
			assert.equal(h.after(), "**Custom**");
			assert.equal(h.inputs()[0]!.checked, false);
			assert.equal(h.badges().length, 1);
			assert.deepEqual(h.opened, []); assert.deepEqual(h.written, []);
			h.context();
			assert.deepEqual(h.items.map(item => item.title), [t("portable.editCustom"), t("portable.restoreDefault")]);
			h.items[1]!.run();
			assert.equal(h.after(), "note");
			assert.equal(h.badges().length, 0);
		} finally { await h.destroy(); }
	});
	it("repairs references to a custom heading and preserves choices across unrelated-note refresh", async () => {
		const h = customHarness({ "a.md": "# [!note] Title", "b.md": "[[a#note Title]]" });
		try {
			await h.view.onOpen(); assert.equal(h.openEditor().save("Custom"), undefined);
			assert.equal(h.root.querySelector(".cs-portable-link-change .cs-portable-after")!.textContent, "[[a#Custom]]");
			h.edit("b.md", "New paragraph\n[[a#note Title]]");
			h.vaultEvents.emit("modify", h.handles.get("b.md")); await h.settle();
			assert.equal(h.after(), "# Custom"); assert.equal(h.badges().length, 1);
			assert.equal(h.inputs()[0]!.checked, true);
		} finally { await h.destroy(); }
	});
	it("retains a custom override when another line of the same file changes or moves the source", async () => {
		const h = customHarness({ "a.md": "[!note]\nUnrelated" });
		try {
			await h.view.onOpen(); assert.equal(h.openEditor().save("Custom"), undefined);
			h.edit("a.md", "[!note]\nChanged");
			h.vaultEvents.emit("modify", h.handles.get("a.md")); await h.settle();
			assert.equal(h.after(), "Custom"); assert.equal(h.badges().length, 1);
			assert.equal(h.inputs()[0]!.checked, true);
			h.edit("a.md", "Inserted\n[!note]\nChanged");
			h.vaultEvents.emit("modify", h.handles.get("a.md")); await h.settle();
			assert.equal(h.after(), "Custom"); assert.equal(h.badges().length, 1);
			assert.equal(h.inputs()[0]!.checked, true);
		} finally { await h.destroy(); }
	});
	it("clears and deselects only a changed or ambiguously relocated custom segment with a native notice", async () => {
		for (const changed of ["Edited [!warning]\nOther", "[!note]\n[!note]\nOther"]) {
			const h = customHarness({ "a.md": "[!note]\nOther", "b.md": "[!tip]" });
			try {
				await h.view.onOpen(); assert.equal(h.openEditor().save("Custom"), undefined);
				h.edit("a.md", changed); h.vaultEvents.emit("modify", h.handles.get("a.md")); await h.settle();
				assert.equal(h.badges().length, 0);
				assert.ok(h.inputs().slice(0, -1).every(input => !input.checked));
				assert.equal(h.inputs()[h.inputs().length - 1]!.checked, true);
				assert.equal((Notice as unknown as { last: { message: string } }).last.message, t("portable.customDiscarded", { count: 1 }));
			} finally { await h.destroy(); }
		}
	});
	it("retains custom text but deselects it if a new delimiter elsewhere makes it unsafe", async () => {
		const h = customHarness({ "a.md": "[!note]\nOrdinary" });
		try {
			await h.view.onOpen(); assert.equal(h.openEditor().save("`open"), undefined);
			h.edit("a.md", "[!note]\nOrdinary `close"); h.vaultEvents.emit("modify", h.handles.get("a.md")); await h.settle();
			assert.equal(h.after(), "`open"); assert.equal(h.badges().length, 1);
			assert.equal(h.inputs()[0]!.checked, false);
			assert.equal(h.openEditor().save("Safe custom"), undefined);
		} finally { await h.destroy(); }
	});
	it("does not let a stale modal reapply a custom override after refresh or close", async () => {
		const h = customHarness({ "a.md": "[!note]" });
		try {
			await h.view.onOpen(); const old = h.openEditor();
			h.edit("a.md", "Changed [!note]"); h.vaultEvents.emit("modify", h.handles.get("a.md"));
			assert.equal(old.save("Stale"), t("portable.customStale"));
			await h.settle(); assert.equal(old.save("Stale"), t("portable.customStale"));
			const latest = h.openEditor(); await h.view.onClose();
			assert.equal(latest.save("Closed"), t("portable.customStale"));
			assert.deepEqual(h.written, []);
		} finally { await h.destroy(); }
	});
	it("rejects ambiguous custom headings without changing another selected row", async () => {
		const h = customHarness({ "a.md": "# [!a] One\n# [!b] Two\n[[#a One]] [[#b Two]]" });
		try {
			await h.view.onOpen(); const modal = h.openEditor();
			assert.equal(modal.save("Two"), t("portable.customUnsafe"));
			assert.equal(h.after(), "# One"); assert.equal(h.badges().length, 0);
			assert.deepEqual(h.inputs().map(input => input.checked), [true, true]);
			assert.equal(modal.fields[0]!.before, "# ");
			assert.equal(modal.value, "One");
			assert.equal(modal.save("One\nNew"), t("portable.customInvalid"));
			assert.equal(modal.save("Safe"), undefined);
		} finally { await h.destroy(); }
	});
	it("allows restoring a blocked default while retaining the other chosen heading", async () => {
		const h = customHarness({ "a.md": "# [!a] Same\n# [!b] Same\n[[#a Same]] [[#b Same]]" });
		try {
			await h.view.onOpen(); assert.equal(h.openEditor().save("Custom"), undefined);
			h.choose(0, true); h.choose(1, true);
			assert.deepEqual(h.inputs().map(input => input.checked), [true, true]);
			h.context(); h.items[1]!.run();
			assert.equal(h.after(), "# Same"); assert.equal(h.badges().length, 0);
			assert.deepEqual(h.inputs().map(input => input.checked), [false, true]);
		} finally { await h.destroy(); }
	});
	it("opens only the selected inline, with up to three read-only context words", async () => {
		const h = customHarness({ "a.md": "Long beginning before [!note]{one} between two [!tip] after ending." });
		try {
			await h.view.onOpen(); const modal = h.openEditor();
			assert.deepEqual(modal.fields.map(field => [field.before, field.source, field.value, field.after]), [
				["Long beginning before", "[!note]{one}", "one", "between two [!tip]"],
			]);
			assert.equal(modal.save("Custom"), undefined);
			assert.equal(h.after(), "Custom");
			assert.equal(h.after(1), "tip");
			h.edit("a.md", "Changed beginning before [!note]{one} between two [!warning] after NEW ending.");
			h.vaultEvents.emit("modify", h.handles.get("a.md")); await h.settle();
			assert.equal(h.after(), "Custom"); assert.equal(h.after(1), "warning");
			assert.equal(h.inputs()[0]!.checked, true);
			assert.deepEqual(h.openEditor().fields.map(field => field.value), ["Custom"]);
		} finally { await h.destroy(); }
	});
	it("retains an unchanged custom token and deselects only the other changed token", async () => {
		const h = customHarness({ "a.md": "A [!note] B [!tip] C" });
		try {
			await h.view.onOpen(); assert.equal(h.openEditor(0).save("First"), undefined);
			assert.equal(h.openEditor(1).save("Second"), undefined);
			h.edit("a.md", "A [!note] B [!warning] C"); h.vaultEvents.emit("modify", h.handles.get("a.md")); await h.settle();
			assert.equal(h.after(), "First"); assert.equal(h.after(1), "warning");
			assert.deepEqual(h.inputs().map(input => input.checked), [true, false]);
			assert.equal(h.badges().length, 1);
			assert.equal((Notice as unknown as { last: { message: string } }).last.message, t("portable.customDiscarded", { count: 1 }));
		} finally { await h.destroy(); }
	});
	it("retains a repeated token when its distinct source line or surrounding edit proves its location", async () => {
		const h = customHarness({ "a.md": "Alpha [!note] ending\nBeta [!note] ending\nOther" });
		try {
			await h.view.onOpen(); assert.equal(h.openEditor().save("Custom"), undefined);
			h.edit("a.md", "Alpha [!note] ending\nBeta [!note] ending\nChanged"); h.vaultEvents.emit("modify", h.handles.get("a.md")); await h.settle();
			assert.equal(h.after(), "Custom"); assert.equal(h.inputs()[0]!.checked, true);
			h.edit("a.md", "Changed Alpha [!note] ending\nBeta [!note] ending\nChanged"); h.vaultEvents.emit("modify", h.handles.get("a.md")); await h.settle();
			assert.equal(h.after(), "Custom"); assert.equal(h.inputs()[0]!.checked, true);
			h.edit("a.md", "Both Alpha [!note] changed\nBeta [!note] ending\nChanged"); h.vaultEvents.emit("modify", h.handles.get("a.md")); await h.settle();
			assert.equal(h.after(), "Custom"); assert.equal(h.inputs()[0]!.checked, true);
		} finally { await h.destroy(); }
	});
	it("never transfers a deleted duplicate token's customization to the surviving token", async () => {
		const h = customHarness({ "a.md": "[!note]\n[!note]" });
		try {
			await h.view.onOpen(); assert.equal(h.openEditor(0).save("First"), undefined);
			assert.equal(h.openEditor(1).save("Second"), undefined);
			h.edit("a.md", "[!note]"); h.vaultEvents.emit("modify", h.handles.get("a.md")); await h.settle();
			assert.equal(h.after(), "note"); assert.equal(h.badges().length, 0);
			assert.equal(h.inputs()[0]!.checked, false);
			assert.equal((Notice as unknown as { last: { message: string } }).last.message, t("portable.customDiscarded", { count: 2 }));
		} finally { await h.destroy(); }
	});
	it("preserves custom text after a failed first write and writes it only after confirmation succeeds", async () => {
		const h = customHarness({ "a.md": "Before [!note] after" });
		try {
			await h.view.onOpen(); assert.equal(h.openEditor().save("Custom"), undefined);
			h.hooks.confirm = async () => true;
			h.hooks.beforeProcess = () => { throw new Error("Disk unavailable"); };
			h.click("convert"); await h.tasks[h.tasks.length - 1]; await h.settle();
			assert.equal(h.after(), "Custom"); assert.equal(h.inputs()[0]!.checked, true);
			assert.deepEqual(h.written, []);
			delete h.hooks.beforeProcess;
			h.click("convert"); await h.tasks[h.tasks.length - 1]; await h.settle();
			assert.equal(h.contents.get("a.md"), "Before Custom after");
			assert.equal(h.badges().length, 0);
		} finally { await h.destroy(); }
	});
	it("provides no custom action for automatic links, stale results or a confirmation in progress", async () => {
		const h = customHarness({ "a.md": "# [!note] Title", "b.md": "[[a#note Title]]" });
		try {
			await h.view.onOpen(); h.context(0, true); assert.equal(h.items.length, 0);
			h.click("convert"); h.context(); assert.equal(h.items.length, 0);
			await h.tasks[h.tasks.length - 1];
			h.vaultEvents.emit("modify", h.handles.get("a.md"));
			h.context(); assert.equal(h.items.length, 0);
		} finally { await h.destroy(); }
	});
});
