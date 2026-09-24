import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { type Plugin, type WorkspaceLeaf } from "obsidian";
import { getLocale, setLocale, registerLocale, t } from "../src/i18n";
import { he } from "../src/i18n/he";
import { PortableConversionView, PORTABLE_CONVERSION_VIEW } from "../src/portable/PortableConversionView";
import { openPortableConversionFromSettings, registerPortableConversionView,
	refreshPortableConversionViewLocale } from "../src/portable/registerPortableConversionView";
import { portableConversionViewHarness as harness } from "./support/portableConversionViewHarness";
import { deferred } from "./support/portableVaultHarness";

describe("portable conversion sidebar", () => {
	it("only previews on open and disables conversion while reading", async () => {
		const h = harness(), read = deferred();
		h.hooks.beforeRead = undefined;
		h.app.vault.read = async () => { await read.promise; return h.contents.get("a.md")!; };
		try {
			const opening = h.view.onOpen();
			assert.equal(h.button("convert").disabled, true);
			h.click("convert");
			assert.equal(h.confirmations.length, 0);
			read.resolve(); await opening;
			assert.equal(h.inputs().length, 2);
			assert.ok(h.inputs().every(input => input.checked));
			assert.equal(h.button("convert").disabled, false);
			assert.deepEqual(h.written, []);
			assert.equal(h.root.querySelector('button[data-action="refresh"]'), null);
		} finally { read.resolve(); await h.destroy(); }
	});
	it("gives each inline its own card and applies only selected tokens after a separate confirmation", async () => {
		const h = harness({ "a.md": "[!note] [!tip]\n[!warning]{Keep me}" });
		try {
			await h.view.onOpen();
			assert.equal(h.inputs().length, 3);
			assert.deepEqual(h.root.querySelectorAll(".cs-portable-before").map(el => el.textContent), ["[!note]", "[!tip]", "[!warning]{Keep me}"]);
			h.choose(1, false); h.choose(2, false);
			h.click("convert"); await h.tasks[h.tasks.length - 1];
			assert.equal(h.confirmations.length, 1);
			assert.deepEqual(h.written, []);
			h.hooks.confirm = async () => true;
			h.click("convert"); await h.tasks[h.tasks.length - 1]; await h.settle();
			assert.equal(h.contents.get("a.md"), "note [!tip]\n[!warning]{Keep me}");
			assert.equal(h.button("convert").disabled, true);
			assert.equal(h.inputs()[0]!.checked, false);
		} finally { await h.destroy(); }
	});
	it("makes every source line accessible and preserves scroll and checkbox focus", async () => {
		const h = harness({ "a.md": Array.from({ length: 125 }, (_, i) => `Line ${i} [!note]`).join("\n") });
		try {
			await h.view.onOpen();
			assert.equal(h.inputs().length, 100);
			h.click("more");
			assert.equal(h.inputs().length, 125);
			const scroll = h.root.querySelector(".cs-portable-results-scroll")!;
			scroll.scrollTop = 250;
			h.inputs()[124]!.focus(); h.choose(124, false);
			assert.equal(scroll.scrollTop, 250);
			assert.equal(h.root.ownerDocument.activeElement, h.inputs()[124]);
			assert.deepEqual(h.inputs()[124]!.lastFocusOptions, { preventScroll: true });
			const all = h.root.querySelector('input[data-action="toggle-all"]')! as unknown as HTMLInputElement;
			assert.equal(all.checked, false, "native checkbox activation will select all from a partial selection");
			assert.equal(all.indeterminate, true);
			assert.equal(all.getAttribute("aria-label"), t("portable.selectAll"));
			all.checked = true; all.indeterminate = false; h.root.fire("change", { target: all });
			assert.ok(h.inputs().every(input => input.checked));
			assert.equal(all.indeterminate, false);
			assert.equal(all.getAttribute("aria-label"), t("portable.selectNone"));
			all.checked = false; h.root.fire("change", { target: all });
			assert.ok(h.inputs().every(input => !input.checked));
			assert.equal(all.indeterminate, false);
			assert.equal(all.getAttribute("aria-label"), t("portable.selectAll"));
			all.checked = true; h.root.fire("change", { target: all });
			assert.ok(h.inputs().every(input => input.checked));
			assert.equal(all.getAttribute("aria-label"), t("portable.selectNone"));
		} finally { await h.destroy(); }
	});
	it("renders all source text literally without truncating long or HTML-looking lines", async () => {
		const source = `[!note]{Text <img src="x" onerror="alert(1)"> ${"x".repeat(500)}}`;
		const h = harness({ "a.md": source });
		try {
			await h.view.onOpen();
			assert.equal(h.root.querySelector("img"), null);
			const codes = h.root.querySelectorAll("code");
			assert.equal(codes[0]!.textContent, source);
			assert.equal(codes[1]!.textContent, source.slice("[!note]{".length, -1));
			assert.ok(codes.every(code => code.getAttribute("dir") === "ltr"));
		} finally { await h.destroy(); }
	});
	it("updates dependent links when their heading is deselected and keeps them coupled", async () => {
		const h = harness({ "a.md": "# Report [!note]\n[[#Report note]]", "b.md": "[[a#Report note]]" });
		try {
			await h.view.onOpen();
			assert.equal(h.root.querySelectorAll(".cs-portable-link-change").length, 2);
			assert.equal(h.root.querySelectorAll(".cs-portable-link-change input").length, 0);
			h.choose(0, false);
			assert.equal(h.root.querySelectorAll(".cs-portable-link-change").length, 0);
			h.choose(0, true);
			assert.equal(h.root.querySelectorAll(".cs-portable-link-change").length, 2);
		} finally { await h.destroy(); }
	});
	it("allows a safe subset of conflicting headings without dropping an existing valid choice", async () => {
		const h = harness({ "a.md": "# Same [!a]\n# Same [!b]\n[[#Same a]]\n[[#Same b]]" });
		try {
			await h.view.onOpen();
			assert.deepEqual(h.inputs().map(input => input.checked), [false, false]);
			assert.ok(h.inputs().every(input => !input.disabled));
			h.choose(0, true);
			assert.deepEqual(h.inputs().map(input => input.checked), [true, false]);
			h.choose(1, true);
			assert.deepEqual(h.inputs().map(input => input.checked), [true, false]);
			assert.equal(h.status(), t("portable.selectionConflict"));
			h.choose(0, false); h.choose(1, true);
			assert.deepEqual(h.inputs().map(input => input.checked), [false, true]);
			assert.equal(h.status(), "");
		} finally { await h.destroy(); }
	});
	it("localizes the sidebar after registration without rescanning or resetting exclusions", async () => {
		const h = harness(), previous = getLocale();
		const plugin = { app: h.app, registerView: () => {} } as unknown as Plugin;
		try {
			refreshPortableConversionViewLocale(new Proxy({}, { get: () => { throw new Error("No host access"); } }) as Plugin);
			registerPortableConversionView(plugin);
			await h.view.onOpen(); h.choose(1, false);
			const reads = h.reads.length;
			const beforeGetLeaves = h.app.workspace.getLeavesOfType.bind(h.app.workspace);
			h.app.workspace.getLeavesOfType = type => type === PORTABLE_CONVERSION_VIEW
				? [{ view: h.view } as unknown as WorkspaceLeaf] : beforeGetLeaves(type);
			registerLocale("he", he); setLocale("he"); refreshPortableConversionViewLocale(plugin);
			assert.equal(h.button("convert").textContent, t("portable.convertSelected"));
			assert.equal(h.inputs()[1]!.checked, false);
			assert.equal(h.reads.length, reads);
		} finally { setLocale(previous); await h.destroy(); }
	});
	it("opens and reveals the right sidebar from settings", async () => {
		const h = harness(), events: string[] = [];
		try {
			Object.assign(h.app, { setting: { close: () => events.push("close") } });
			const leaf = { loadIfDeferred: async () => { events.push("load"); } } as unknown as WorkspaceLeaf;
			Object.assign(h.app.workspace, {
				ensureSideLeaf: async (type: string, side: string) => { events.push(`${type}:${side}`); return leaf; },
				revealLeaf: async (value: WorkspaceLeaf) => { assert.equal(value, leaf); events.push("reveal"); },
			});
			await openPortableConversionFromSettings(h.app);
			assert.deepEqual(events, ["close", `${PORTABLE_CONVERSION_VIEW}:right`, "load", "reveal"]);
			assert.equal(new PortableConversionView({ app: h.app } as unknown as WorkspaceLeaf).getViewType(), PORTABLE_CONVERSION_VIEW);
		} finally { await h.destroy(); }
	});
});
