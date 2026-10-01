import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Menu, Notice, type MenuItem } from "obsidian";
import { getLocale, registerLocale, setLocale, t } from "../src/i18n";
import { he } from "../src/i18n/he";
import { portableConversionViewHarness as harness } from "./support/portableConversionViewHarness";

function customHarness(notes?: Record<string, string>) {
	const h = harness(notes), items: { title: string; run: () => void }[] = [];
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
			onClick: (run: (event: MouseEvent) => void) => {
				record.run = () => {
					const event = { target: h.root.ownerDocument.createElement("button") };
					run(event as unknown as MouseEvent); h.root.ownerDocument.fire("click", event);
				}; return item;
			},
		} as unknown as MenuItem;
		build(item); items.push(record); return this;
	});
	patch(Menu.prototype, "showAtMouseEvent", () => {});
	function context(index = 0, link = false): void {
		items.length = 0;
		const target = h.root.querySelectorAll(link ? ".cs-portable-link-change button" : ".cs-portable-change-body")[index]!;
		h.root.fire("contextmenu", { target, preventDefault: () => {} });
	}
	function openEditor(index = 0, entry: "context" | "pencil" | "after" = "context") {
		if (entry === "context") { context(index); assert.ok(items[0]); items[0].run(); }
		else {
			const target = h.root.querySelectorAll(entry === "pencil" ? '.cs-portable-card-actions button[data-action="edit"]' : ".cs-portable-after-button")[index]!;
			const event = { target, preventDefault: () => {}, stopPropagation: () => {} };
			h.root.fire("click", event); h.root.ownerDocument.fire("click", event);
		}
		const card = h.root.querySelectorAll(".cs-portable-change")[index]!;
		const input = card.querySelector("textarea.cs-portable-custom-input"); assert.ok(input);
		const press = (key: string) => input.fire("keydown", { key, preventDefault: () => {}, stopPropagation: () => {} });
		return { card, input, press, value: input.value,
			fixed: () => card.querySelectorAll(".cs-portable-custom-editor .cs-portable-custom-markers").map(el => el.textContent),
			save: (value: string) => {
				input.value = value; input.fire("input"); press("Enter");
				return card.querySelector("[role=alert]")?.textContent || undefined;
			},
		};
	}
	return { ...h, items, context, openEditor,
		after: (index = 0) => h.root.querySelectorAll(".cs-portable-change .cs-portable-after")[index]!.textContent,
		badges: () => h.root.querySelectorAll(".cs-portable-custom-badge"),
		reset: (index = 0) => {
			const button = h.root.querySelectorAll(".cs-portable-change")[index]!.querySelector('button[data-action="restore"]');
			return button && !(button as typeof button & { hidden: boolean }).hidden ? button : null;
		},
		destroy: async () => {
			await h.destroy();
			for (const [target, name, descriptor] of patches.reverse()) {
				if (descriptor) Object.defineProperty(target, name, descriptor);
				else delete (target as Record<string, unknown>)[name];
			}
		},
	};
}

describe("inline custom replacement review", () => {
	it("exposes replacement text to assistive technology and labels empty replacements", async () => {
		const h = customHarness({ "a.md": "Before [!note] after" });
		try {
			await h.view.onOpen();
			const after = h.root.querySelector(".cs-portable-after-button")!;
			assert.equal(after.textContent, "note");
			assert.equal(after.getAttribute("aria-label"), null, "the edit instruction must not override replacement text");
			assert.equal(after.getAttribute("aria-description"), t("portable.editCustom"));
			assert.equal(h.openEditor().save(""), undefined);
			const empty = h.root.querySelector(".cs-portable-after-button")!;
			assert.equal(empty.textContent, "");
			assert.equal(empty.getAttribute("aria-label"), t("portable.editCustom"));
			assert.equal(h.openEditor(0, "after").value, "");
		} finally { await h.destroy(); }
	});
	it("opens the replacement immediately without moving the note for pencil, After or menu clicks", async () => {
		for (const entry of ["pencil", "after", "context"] as const) {
			const h = customHarness({ "a.md": "Before [!note] after" });
			try {
				await h.view.onOpen(); h.choose(0, false);
				const editor = h.openEditor(0, entry);
				assert.equal(editor.value, "note");
				assert.deepEqual([editor.input.selectionStart, editor.input.selectionEnd], [0, 4]);
				assert.equal(h.root.ownerDocument.activeElement, editor.input);
				assert.deepEqual(h.opened, []);
				assert.deepEqual(h.selections, []);
				await h.settle();
				assert.ok(editor.card.hasClass("is-editing"));
				assert.equal(h.root.querySelector('[aria-current="true"]'), null);
				assert.equal(h.root.ownerDocument.activeElement, editor.input);
				assert.deepEqual(h.opened, []);
				assert.deepEqual(h.selections, []);
				assert.equal(h.blocked("convert"), true);
				assert.equal(editor.card.querySelector('[data-action="save-replacement"]'), null);
				assert.equal(editor.card.querySelector('[data-action="cancel-replacement"]'), null);
				editor.input.value = "Unsaved"; editor.input.fire("input");
				editor.press("Escape");
				assert.equal(h.root.querySelector("textarea.cs-portable-custom-input"), null);
				assert.equal(h.after(), "note"); assert.equal(h.badges().length, 0);
				assert.equal(h.inputs()[0]!.checked, false);
				assert.deepEqual(h.written, []);
			} finally { await h.destroy(); }
		}
	});
	it("discards a draft with the reset icon or context menu while preserving any saved custom text", async () => {
		for (const saved of [undefined, "Saved custom"] as const) for (const entry of ["icon", "context"] as const) {
			const h = customHarness({ "a.md": "[!note]" });
			try {
				await h.view.onOpen(); h.choose(0, false);
				if (saved) assert.equal(h.openEditor().save(saved), undefined);
				const editor = h.openEditor(0, "pencil");
				editor.input.value = "Unsaved draft"; editor.input.fire("input");
				const reset = h.reset(); assert.ok(reset);
				assert.equal(reset.getAttribute("aria-label"), t("portable.cancelEdit"));
				if (entry === "icon") h.root.fire("click", { target: reset });
				else {
					h.context();
					const discard = h.items.find(item => item.title === t("portable.cancelEdit")); assert.ok(discard);
					discard.run();
				}
				assert.equal(h.root.querySelector("textarea"), null);
				assert.equal(h.after(), saved ?? "note"); assert.equal(h.badges().length, saved ? 1 : 0);
				assert.equal(h.inputs()[0]!.checked, false);
				const restore = h.reset();
				if (saved) {
					assert.ok(restore); assert.equal(restore.getAttribute("aria-label"), t("portable.restoreDefault"));
					h.root.fire("click", { target: restore });
					assert.equal(h.after(), "note"); assert.equal(h.badges().length, 0);
				} else assert.equal(restore, null);
				assert.equal(h.inputs()[0]!.checked, false);
				assert.deepEqual(h.written, []);
			} finally { await h.destroy(); }
		}
	});
	it("ends an unchanged edit with Enter and leaves the previous replacement intact", async () => {
		const h = customHarness({ "a.md": "[!note]" });
		try {
			await h.view.onOpen();
			h.openEditor().press("Enter");
			assert.equal(h.root.querySelector("textarea"), null); assert.equal(h.after(), "note");
			assert.equal(h.badges().length, 0);
			assert.equal(h.openEditor().save("Saved custom"), undefined);
			h.openEditor().press("Enter");
			assert.equal(h.root.querySelector("textarea"), null); assert.equal(h.after(), "Saved custom");
			assert.equal(h.badges().length, 1); assert.equal(h.inputs()[0]!.checked, true);
			assert.deepEqual(h.written, []);
		} finally { await h.destroy(); }
	});
	it("shows reset only while the visible replacement differs from its default", async () => {
		const h = customHarness({ "a.md": "[!note]" });
		try {
			await h.view.onOpen(); const editor = h.openEditor(0, "pencil");
			assert.equal(h.reset(), null);
			h.context(); assert.equal(h.items.length, 1, "an unchanged field has no reset context action");
			editor.input.value = "Custom"; editor.input.fire("input");
			assert.ok(h.reset());
			editor.input.value = "note"; editor.input.fire("input");
			assert.equal(h.reset(), null);
			assert.equal(h.root.querySelector("textarea"), editor.input, "typing never replaces the focused field");
			h.context(); assert.equal(h.items.length, 1);
			assert.equal(editor.save("Saved custom"), undefined);
			const custom = h.openEditor(0, "pencil");
			const restore = h.reset(); assert.ok(restore);
			assert.equal(restore.getAttribute("aria-label"), t("portable.restoreDefault"));
			custom.input.value = "note"; custom.input.fire("input");
			assert.equal(h.reset(), null, "returning to the default hides reset before saving");
			custom.press("Enter");
			assert.equal(h.after(), "note"); assert.equal(h.badges().length, 0);
			assert.equal(h.reset(), null); assert.deepEqual(h.written, []);
		} finally { await h.destroy(); }
	});
	it("restores the default from an unchanged custom field rather than keeping the override", async () => {
		const h = customHarness({ "a.md": "[!note]" });
		try {
			await h.view.onOpen(); assert.equal(h.openEditor().save("Saved custom"), undefined);
			h.openEditor(0, "pencil");
			const restore = h.reset(); assert.ok(restore);
			h.root.fire("click", { target: restore });
			assert.equal(h.root.querySelector("textarea"), null);
			assert.equal(h.after(), "note"); assert.equal(h.badges().length, 0);
			assert.equal(h.reset(), null); assert.deepEqual(h.written, []);
		} finally { await h.destroy(); }
	});
	it("saves a valid draft when clicking outside and keeps focus on the clicked control", async () => {
		const h = customHarness({ "a.md": "[!note]" });
		const outside = h.root.ownerDocument.body.createEl("button");
		try {
			await h.view.onOpen(); const editor = h.openEditor(); await h.settle();
			editor.input.value = "Outside saved"; editor.input.fire("input");
			outside.focus(); h.root.ownerDocument.fire("click", { target: outside });
			await h.settle();
			assert.equal(h.root.querySelector("textarea"), null);
			assert.equal(h.root.querySelector(".is-editing"), null);
			assert.equal(h.after(), "Outside saved"); assert.equal(h.badges().length, 1);
			assert.equal(h.root.ownerDocument.activeElement, outside);
			assert.deepEqual(h.written, []);
		} finally { outside.remove(); await h.destroy(); }
	});
	it("closes an unchanged field on an outside click without creating a customization", async () => {
		const h = customHarness({ "a.md": "[!note]" });
		try {
			await h.view.onOpen(); h.openEditor(); await h.settle();
			h.root.ownerDocument.fire("click", { target: h.root }); await h.settle();
			assert.equal(h.root.querySelector("textarea"), null);
			assert.equal(h.after(), "note"); assert.equal(h.badges().length, 0);
			assert.equal(h.reset(), null); assert.deepEqual(h.written, []);
		} finally { await h.destroy(); }
	});
	it("preserves a clicked checkbox action while finishing the field it moves away from", async () => {
		const h = customHarness({ "a.md": "[!note]\n[!tip]" });
		try {
			await h.view.onOpen(); const editor = h.openEditor(); await h.settle();
			editor.input.value = "Custom note"; editor.input.fire("input");
			const target = h.inputs()[1]!;
			target.checked = false; target.focus();
			h.root.fire("click", { target });
			h.root.ownerDocument.fire("click", { target });
			const change = { type: "change", target, bubbles: true };
			target.dispatchEvent(change);
			await h.settle();
			assert.equal(h.root.querySelector("textarea"), null);
			assert.equal(h.after(), "Custom note");
			assert.deepEqual(h.inputs().map(input => input.checked), [true, false]);
			assert.deepEqual(h.written, []);
		} finally { await h.destroy(); }
	});
	it("does not let an outside click finish a detached draft after source refresh or closure", async () => {
		const h = customHarness({ "a.md": "[!note]" });
		try {
			await h.view.onOpen(); const editor = h.openEditor(); await h.settle();
			editor.input.value = "Stale draft"; editor.input.fire("input");
			h.edit("a.md", "Changed [!note]"); h.vaultEvents.emit("modify", h.handles.get("a.md"));
			h.root.ownerDocument.fire("click", { target: h.root }); await h.settle();
			assert.equal(h.after(), "note"); assert.equal(h.badges().length, 0);
			const closing = h.openEditor(); closing.input.value = "Closed draft"; closing.input.fire("input");
			await h.view.onClose(); h.root.ownerDocument.fire("click", { target: h.root }); await h.settle();
			assert.equal(h.badges().length, 0); assert.deepEqual(h.written, []);
		} finally { await h.destroy(); }
	});
	it("restores a custom heading from its card and rebuilds dependent links", async () => {
		const h = customHarness({ "a.md": "# [!note] Title", "b.md": "[[a#note Title]]" });
		try {
			await h.view.onOpen();
			assert.equal(h.reset(), null);
			assert.equal(h.openEditor(0, "pencil").save("Custom"), undefined);
			assert.equal(h.root.querySelector(".cs-portable-link-change .cs-portable-after")!.textContent, "[[a#Custom]]");
			const restore = h.reset(); assert.ok(restore);
			assert.equal(restore.getAttribute("aria-label"), t("portable.restoreDefault"));
			h.root.fire("click", { target: restore, preventDefault: () => {}, stopPropagation: () => {} });
			assert.equal(h.after(), "# Title"); assert.equal(h.badges().length, 0);
			assert.equal(h.reset(), null);
			assert.equal(h.root.querySelector(".cs-portable-link-change .cs-portable-after")!.textContent, "[[a#Title]]");
			assert.equal(h.inputs()[0]!.checked, true);
			assert.deepEqual(h.written, []);
		} finally { await h.destroy(); }
	});
	it("saves the current draft when another card is restored without losing that reset action", async () => {
		const h = customHarness({ "a.md": "[!note]\n[!tip]" });
		try {
			await h.view.onOpen(); assert.equal(h.openEditor(1).save("Custom tip"), undefined);
			const editor = h.openEditor(0, "pencil");
			editor.input.value = "Unsaved note"; editor.input.fire("input");
			const restore = h.root.querySelectorAll(".cs-portable-change")[1]!.querySelector('button[data-action="restore"]'); assert.ok(restore);
			h.root.fire("click", { target: restore });
			h.root.ownerDocument.fire("click", { target: restore }); await h.settle();
			assert.equal(h.root.querySelector("textarea"), null);
			assert.equal(h.root.querySelectorAll(".cs-portable-change")[1]!.querySelector(".cs-portable-after")!.textContent, "tip");
			assert.equal(h.badges().length, 1); assert.equal(h.blocked("convert"), false);
			assert.equal(h.after(), "Unsaved note"); assert.equal(h.after(1), "tip");
			assert.deepEqual(h.inputs().map(input => input.checked), [true, true]);
			assert.deepEqual(h.written, []);
		} finally { await h.destroy(); }
	});
	it("keeps the draft reset control focused across locale redraws", async () => {
		const h = customHarness({ "a.md": "[!note]" }), previousLocale = getLocale();
		try {
			await h.view.onOpen(); const editor = h.openEditor();
			editor.input.value = "Unsaved"; editor.input.fire("input");
			const control = editor.card.querySelector('button[data-action="restore"]')!;
			control.focus();
			registerLocale("he", he); setLocale("he"); h.view.refreshLabels();
			const current = h.root.querySelector('button[data-action="restore"]'); assert.ok(current);
			assert.equal(h.root.ownerDocument.activeElement, current);
			assert.equal(current.getAttribute("aria-label"), t("portable.cancelEdit"));
			h.root.fire("click", { target: current });
			assert.equal(h.after(), "note"); assert.equal(h.root.querySelector("textarea"), null);
			assert.deepEqual(h.written, []);
		} finally { setLocale(previousLocale); await h.destroy(); }
	});
	it("preserves a focused draft across locale redraw and blocks conversion until it is saved", async () => {
		const h = customHarness({ "a.md": "[!note]" }), previousLocale = getLocale();
		try {
			await h.view.onOpen(); const editor = h.openEditor(0, "after");
			editor.input.value = "Unsaved draft"; editor.input.fire("input");
			editor.input.focus(); editor.input.setSelectionRange(2, 6);
			const reads = h.reads.length;
			registerLocale("he", he); setLocale("he"); h.view.refreshLabels();
			const input = h.root.querySelector("textarea.cs-portable-custom-input");
			assert.equal(input, editor.input); assert.equal(input.value, "Unsaved draft");
			assert.equal(input.ownerDocument.activeElement, input);
			assert.deepEqual([input.selectionStart, input.selectionEnd], [2, 6]);
			assert.equal(h.reads.length, reads); assert.equal(h.blocked("convert"), true);
			h.click("convert"); assert.equal(h.confirmations.length, 0);
			assert.equal(editor.save("Custom"), undefined);
			assert.equal(h.after(), "Custom"); assert.equal(h.blocked("convert"), false);
			assert.deepEqual(h.written, []);
		} finally { setLocale(previousLocale); await h.destroy(); }
	});
	it("preserves conversion choices while editing and restoring the default", async () => {
		const h = customHarness({ "a.md": "[!note]" });
		try {
			await h.view.onOpen(); h.choose(0, false);
			const editor = h.openEditor();
			assert.equal(editor.value, "note");
			assert.equal(h.items[0]!.title, t("portable.customize"));
			assert.equal(editor.save("**Custom**"), undefined);
			assert.equal(h.after(), "**Custom**");
			assert.equal(h.inputs()[0]!.checked, false);
			assert.equal(h.badges().length, 1);
			assert.deepEqual(h.written, []);
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
	it("does not let detached draft controls reapply an override after refresh or close", async () => {
		const h = customHarness({ "a.md": "[!note]" });
		try {
			await h.view.onOpen(); const old = h.openEditor();
			h.edit("a.md", "Changed [!note]"); h.vaultEvents.emit("modify", h.handles.get("a.md"));
			old.save("Stale"); assert.equal(h.badges().length, 0);
			assert.equal(h.root.querySelector("textarea.cs-portable-custom-input"), null);
			await h.settle(); old.save("Still stale");
			assert.equal(h.after(), "note"); assert.equal(h.badges().length, 0);
			const latest = h.openEditor(); await h.view.onClose(); latest.save("Closed");
			assert.equal(h.badges().length, 0);
			assert.deepEqual(h.written, []);
		} finally { await h.destroy(); }
	});
	it("rejects ambiguous custom headings without changing another selected row", async () => {
		const h = customHarness({ "a.md": "# [!a] One\n# [!b] Two\n[[#a One]] [[#b Two]]" });
		try {
			await h.view.onOpen(); const editor = h.openEditor();
			assert.equal(editor.save("Two"), t("portable.customUnsafe"));
			assert.equal(editor.input.value, "Two"); assert.equal(h.badges().length, 0);
			assert.deepEqual(h.inputs().map(input => input.checked), [true, true]);
			assert.deepEqual(editor.fixed(), ["# "]);
			assert.equal(editor.value, "One");
			assert.equal(editor.save("One\nNew"), t("portable.customInvalid"));
			assert.equal(editor.save("Safe"), undefined);
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
	it("edits only the replacement without displaying surrounding source words", async () => {
		const h = customHarness({ "a.md": "Long beginning before [!note]{one} between two [!tip] after ending." });
		try {
			await h.view.onOpen(); const editor = h.openEditor();
			assert.equal(editor.value, "one");
			assert.deepEqual(editor.fixed(), []);
			assert.equal(editor.card.querySelector(".cs-portable-before")!.textContent, "[!note]{one}");
			assert.deepEqual(editor.card.querySelectorAll(".cs-portable-diff-label").map(el => el.textContent),
				[t("portable.before"), t("portable.after")]);
			assert.equal(h.root.querySelectorAll("textarea.cs-portable-custom-input").length, 1);
			assert.equal(editor.save("Custom"), undefined);
			assert.equal(h.after(), "Custom");
			assert.equal(h.after(1), "tip");
			h.edit("a.md", "Changed beginning before [!note]{one} between two [!warning] after NEW ending.");
			h.vaultEvents.emit("modify", h.handles.get("a.md")); await h.settle();
			assert.equal(h.after(), "Custom"); assert.equal(h.after(1), "warning");
			assert.equal(h.inputs()[0]!.checked, true);
			assert.equal(h.openEditor().value, "Custom");
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
