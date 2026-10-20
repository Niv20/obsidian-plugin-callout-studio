import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { setTimeout as wait } from "node:timers/promises";
import { t } from "../src/i18n";
import { fingerprintCalloutContent } from "../src/usage/contentFingerprint";
import { resolvePortableSourcePosition } from "../src/portable/portableConversionNavigation";
import { portableConversionViewHarness as harness } from "./support/portableConversionViewHarness";
import { deferred } from "./support/portableVaultHarness";
import { notifySidebarEditorSelection } from "../src/ui/sidebarSelection";

const saved = (before: string, content = before, line = 1) =>
	({ before, line, contentFingerprint: fingerprintCalloutContent(content) });

describe("conversion source navigation", () => {
	it("selects just the inline token and its payload, revalidating the complete source line", async () => {
		const sourceLine = "Before [!tip]{word} after [!note]";
		const before = "[!tip]{word}", from = sourceLine.indexOf(before), to = from + before.length;
		const change = { ...saved(before, sourceLine), sourceLine, from, to };
		assert.deepEqual(await resolvePortableSourcePosition(change, `Added\n${sourceLine}`),
			{ from: { line: 1, ch: from }, to: { line: 1, ch: to } });
		assert.equal(await resolvePortableSourcePosition({ ...change, to: to + 1 }, sourceLine), null);
		assert.equal(await resolvePortableSourcePosition(change, sourceLine.replace("Before", "Edited")), null);
	});
	it("retains exact duplicate coordinates in unchanged notes, including normalized CRLF", async () => {
		const before = "[!note]";
		assert.deepEqual(await resolvePortableSourcePosition(saved(before, `${before}\r\n${before}`, 2), `${before}\n${before}`),
			{ from: { line: 1, ch: 0 }, to: { line: 1, ch: before.length } });
	});
	it("only relocates uniquely unchanged lines and refuses ambiguous or edited source", async () => {
		const before = "[!note]";
		assert.equal((await resolvePortableSourcePosition(saved(before), `Added\n${before}`))?.from.line, 1);
		assert.equal(await resolvePortableSourcePosition(saved(before), `${before}\n${before}`), null);
		assert.equal(await resolvePortableSourcePosition(saved(before), `${before} edited`), null);
		assert.equal(await resolvePortableSourcePosition(saved(before), before, () => false), null);
	});
	it("yields and cancels during large-note validation", async () => {
		const content = "[!note]\n" + "Long ordinary line\n".repeat(10000);
		let active = true;
		const resolving = resolvePortableSourcePosition(saved("[!note]", content), content, () => active);
		active = false;
		assert.equal(await resolving, null);
	});
});

describe("conversion file groups and cards", () => {
	it("keeps the purple highlight on only the newly edited card", async () => {
		const h = harness({ "a.md": "[!note]\n[!tip]" });
		try {
			await h.view.onOpen();
			h.root.fire("click", { target: h.root.querySelectorAll('button[data-action="result"]')[0] });
			await h.settle();
			assert.equal(h.root.querySelectorAll('[aria-current="true"]').length, 1);
			const opened = [...h.opened], revealed = [...h.revealed];
			h.root.fire("click", { target: h.root.querySelectorAll(".cs-portable-after-button")[1] });
			assert.equal(h.root.querySelector('[aria-current="true"]'), null);
			assert.equal(h.root.querySelectorAll(".is-editing").length, 1);
			assert.ok(h.root.querySelectorAll(".cs-portable-change")[1]!.hasClass("is-editing"));
			assert.deepEqual(h.opened, opened);
			assert.deepEqual(h.revealed, revealed);
		} finally { await h.destroy(); }
	});
	it("switches inline editors without opening or selecting a source", async () => {
		const h = harness({ "a.md": "[!note]\n[!tip]" });
		try {
			await h.view.onOpen();
			h.root.fire("click", { target: h.root.querySelectorAll(".cs-portable-after-button")[0] });
			const first = h.root.querySelector("textarea")!;
			first.value = "First custom"; first.fire("input");
			h.root.fire("click", { target: h.root.querySelectorAll('.cs-portable-card-actions button[data-action="edit"]')[1] });
			const latest = h.root.querySelector("textarea")!; assert.notEqual(latest, first);
			await h.settle();
			assert.equal(h.root.ownerDocument.activeElement, latest);
			assert.deepEqual([latest.selectionStart, latest.selectionEnd], [0, 3]);
			assert.deepEqual(h.opened, []);
			assert.deepEqual(h.revealed, []);
			assert.equal(h.root.querySelectorAll(".is-editing").length, 1);
			assert.equal(h.root.querySelectorAll(".cs-portable-after")[0]!.textContent, "First custom");
			assert.deepEqual(h.written, []);
		} finally { await h.destroy(); }
	});
	it("does not move the note after an inline editor closes", async () => {
		const h = harness({ "a.md": "[!note]" });
		const outside = h.root.ownerDocument.body.createEl("button");
		let loads = 0;
		h.documentLeaf.loadIfDeferred = async () => { loads++; };
		try {
			await h.view.onOpen();
			h.root.fire("click", { target: h.root.querySelector(".cs-portable-after-button") });
			outside.focus(); h.root.ownerDocument.fire("click", { target: outside });
			await h.settle();
			assert.equal(h.root.querySelector("textarea"), null);
			assert.equal(h.root.ownerDocument.activeElement, outside);
			assert.equal(h.root.querySelector('[aria-current="true"]'), null);
			assert.equal(loads, 0);
			assert.deepEqual(h.opened, []); assert.deepEqual(h.revealed, []); assert.deepEqual(h.written, []);
		} finally { outside.remove(); await h.destroy(); }
	});
	it("opens a clicked file heading while an inline edit is active", async () => {
		const h = harness({ "a.md": "[!note]", "b.md": "[!tip]" });
		try {
			await h.view.onOpen();
			h.root.fire("click", { target: h.root.querySelector(".cs-portable-after-button") });
			const target = h.root.querySelectorAll('button[data-action="file"]').find(button => button.dataset.path === "b.md");
			assert.ok(target);
			h.root.fire("click", { target }); h.root.ownerDocument.fire("click", { target });
			await h.settle();
			assert.deepEqual(h.opened, ["b.md"]);
			assert.deepEqual(h.revealed, ["top"]);
			assert.equal(h.documentView.file?.path, "b.md");
			assert.equal(h.root.querySelector("textarea"), null);
			assert.equal(h.root.querySelector('[aria-current="true"]'), null);
			assert.deepEqual(h.written, []);
		} finally { await h.destroy(); }
	});
	it("groups source and linked changes by file using shared grids and localized row roles", async () => {
		const h = harness({ "a.md": "# Report [!note]\n[!tip]", "b.md": "[[a#Report note]]" });
		try {
			await h.view.onOpen();
			const groups = h.root.querySelectorAll(".cs-sidebar-file");
			assert.deepEqual(groups.map(group => group.dataset.path), ["a.md", "b.md"]);
			assert.deepEqual(groups.map(group => group.querySelector(".cs-sidebar-file-link")?.textContent), ["a.md (2)", "b.md (1)"]);
			for (const group of groups) {
				const link = group.querySelector(".cs-sidebar-file-link")!;
				assert.equal(link.getAttribute("aria-label"), null, "file names rely on visible text without a hover popup");
				assert.equal(link.getAttribute("title"), null);
				assert.equal(link.querySelector(".cs-heading-count")?.getAttribute("aria-hidden"), null);
			}
			assert.deepEqual(groups.map(group => group.querySelectorAll(".cs-sidebar-result").length), [2, 1]);
			assert.equal(groups[0]!.querySelectorAll(".cs-sidebar-grid").length, 1);
			const locations = h.root.querySelectorAll(".cs-portable-change-location");
			assert.ok(locations[0]!.textContent.includes(t("vaultStats.roleHeading")));
			assert.ok(locations[1]!.textContent.includes(t("vaultStats.roleInline")));
			assert.ok(locations[2]!.textContent.includes(t("portable.roleLink")));
			assert.ok(locations.every(location => !location.textContent.includes(".md")));
			assert.equal(h.root.querySelectorAll(".cs-portable-diff-arrow").length, 0);
			assert.deepEqual(h.root.querySelectorAll(".cs-portable-diff-label").slice(0, 2).map(el => el.textContent),
				[t("portable.before"), t("portable.after")]);
			assert.deepEqual(h.root.querySelectorAll(".cs-portable-before").map(el => el.textContent), ["# Report [!note]", "[!tip]", "[[a#Report note]]"]);
			assert.deepEqual(h.root.querySelectorAll(".cs-portable-after").map(row => row.textContent), ["# Report", "tip", "[[a#Report]]"]);
		} finally { await h.destroy(); }
	});
	it("card clicks reveal the exact source line without toggling its independent checkbox or jumping its group", async () => {
		const h = harness();
		try {
			await h.view.onOpen();
			let groupScrolls = 0;
			h.root.querySelector(".cs-sidebar-file")!.scrollIntoView = () => { groupScrolls++; };
			const card = h.root.querySelectorAll('button[data-action="result"]')[1]!;
			h.root.fire("click", { target: card }); await h.settle();
			assert.deepEqual(h.opened, ["a.md"]);
			assert.deepEqual(h.revealed, [[{ line: 1, ch: 2 }, { line: 1, ch: 14 }]]);
			assert.ok(h.inputs().every(input => input.checked));
			assert.equal(groupScrolls, 0);
			assert.equal(h.root.querySelectorAll('[aria-current="true"]').length, 1);
			h.choose(1, false);
			h.root.fire("click", { target: h.inputs()[1] }); await h.settle();
			assert.equal(h.inputs()[1]!.checked, false);
			assert.deepEqual(h.opened, ["a.md"]);
		} finally { await h.destroy(); }
	});
	it("keeps a clicked card current until the user moves the caret, then follows the caret", async () => {
		const h = harness();
		try {
			await h.view.onOpen();
			h.root.fire("click", { target: h.root.querySelectorAll('button[data-action="result"]')[1] }); await h.settle();
			assert.deepEqual(h.current(), ["[!tip]{word}"]);
			// Navigation leaves the caret on the heading's line; a restore onto it is not a move.
			notifySidebarEditorSelection(h.documentView.editor); h.flushFrames();
			assert.deepEqual(h.current(), ["[!tip]{word}"]);
			h.moveCaret(1, 0);
			assert.deepEqual(h.current(), [], "the text before the inline callout is in no card");
			h.moveCaret(0, 4);
			assert.deepEqual(h.current(), ["# [!note] Heading"]);
			h.root.fire("click", { target: h.root.querySelector('button[data-action="file"]'), metaKey: true }); await h.settle();
			assert.deepEqual(h.opened, ["a.md", "a.md"]);
			assert.deepEqual(h.revealed.at(-1), "top");
			h.flushFrames();
			assert.deepEqual(h.current(), ["# [!note] Heading"], "opening the note at the top leaves the caret's card marked");
		} finally { await h.destroy(); }
	});
	it("marks the card under the caret: an inline callout it touches, else the line's heading link", async () => {
		const h = harness({ "a.md": "# Report [!note]\n[!tip]{word} and [[#Report note]]\nplain" });
		try {
			await h.view.onOpen();
			await h.documentLeaf.openFile(h.handles.get("a.md")!);
			h.moveCaret(1, 12);
			assert.deepEqual(h.current(), ["[!tip]{word}"], "the payload belongs to the inline callout");
			h.moveCaret(1, 20);
			assert.deepEqual(h.current(), ["[!tip]{word} and [[#Report note]]"]);
			h.moveCaret(2, 2);
			assert.deepEqual(h.current(), []);
			h.moveCaret(1, 3);
			assert.deepEqual(h.current(), ["[!tip]{word}"]);
			h.setLiveText("# Report [!note]\n[!tip]{word} edited\nplain");
			h.moveCaret(1, 4);
			assert.deepEqual(h.current(), [], "a line typed since the scan matches nothing until the rescan");
		} finally { await h.destroy(); }
	});
	it("leaves heading links out of the summary when there are none to update", async () => {
		const summary = (h: ReturnType<typeof harness>): string => h.root.querySelector(".cs-portable-summary-text")!.textContent;
		const plain = harness({ "a.md": "[!note]\n[!tip]" });
		try {
			await plain.view.onOpen();
			assert.equal(summary(plain), t("portable.selectionSummaryNoLinks", { selected: 2, total: 2 }));
			assert.ok(!summary(plain).includes("0"));
		} finally { await plain.destroy(); }
		const linked = harness({ "a.md": "# Report [!note]", "b.md": "[[a#Report note]]" });
		try {
			await linked.view.onOpen();
			assert.equal(summary(linked), t("portable.selectionSummary", { selected: 1, total: 1, links: 1 }));
		} finally { await linked.destroy(); }
	});
	it("ignores the caret while a replacement draft holds the highlight", async () => {
		const h = harness({ "a.md": "[!note]\n[!tip]" });
		try {
			await h.view.onOpen();
			await h.documentLeaf.openFile(h.handles.get("a.md")!);
			h.moveCaret(0, 2);
			assert.deepEqual(h.current(), ["[!note]"]);
			h.root.fire("click", { target: h.root.querySelectorAll(".cs-portable-after-button")[1] });
			h.moveCaret(1, 2);
			assert.deepEqual(h.current(), []);
			assert.equal(h.root.querySelectorAll(".is-editing").length, 1);
		} finally { await h.destroy(); }
	});
	it("opening another note reveals its file group and loads a later page when needed", async () => {
		const h = harness({ "a.md": Array.from({ length: 101 }, () => "[!note]").join("\n"), "b.md": "[!tip]" });
		try {
			await h.view.onOpen();
			assert.equal(h.root.querySelectorAll(".cs-sidebar-file").length, 1);
			await h.documentLeaf.openFile(h.handles.get("b.md")!);
			assert.equal(h.root.querySelectorAll(".cs-sidebar-file").length, 2);
			assert.equal(h.root.querySelector(".is-active-file")?.dataset.path, "b.md");
			assert.equal(h.inputs().length, 102);
		} finally { await h.destroy(); }
	});
	it("validates the current editor and declines an unannounced edited source", async () => {
		const h = harness();
		try {
			await h.view.onOpen(); h.setLiveText("An unrelated line");
			h.root.fire("click", { target: h.root.querySelector('button[data-action="result"]') }); await h.settle();
			assert.deepEqual(h.revealed, []);
			assert.equal(h.blocked("convert"), true);
		} finally { await h.destroy(); }
	});
	it("shows adjacent link repairs separately from a token-only source row", async () => {
		const h = harness({ "a.md": "# Report [!note]\n[!tip] [[#Report note]]" });
		try {
			await h.view.onOpen();
			assert.equal(h.root.querySelectorAll(".cs-sidebar-result").length, 3);
			assert.equal(h.root.querySelectorAll(".cs-portable-after")[1]!.textContent, "tip");
			assert.ok(h.root.querySelectorAll(".cs-portable-after")[2]!.textContent.endsWith("[[#Report]]"));
			h.choose(1, false);
			assert.equal(h.root.querySelectorAll(".cs-sidebar-result").length, 3, "deselected source still shows its automatic link repair separately");
		} finally { await h.destroy(); }
	});
});

describe("conversion refresh presentation", () => {
	it("only shows slow work in an overlay and never injects transient text under the toolbar", async () => {
		const h = harness(undefined, 15), read = deferred();
		try {
			await h.view.onOpen();
			h.hooks.beforeRead = () => read.promise;
			h.edit("a.md", "Changed [!note]"); h.vaultEvents.emit("modify", h.handles.get("a.md"));
			const shell = h.root.querySelector(".cs-portable-results-shell")!;
			const overlay = h.root.querySelector(".cs-portable-refresh-overlay")! as typeof shell & { hidden: boolean };
			assert.ok(shell.hasClass("is-stale"));
			assert.equal(h.status(), "");
			assert.equal(overlay.hidden, true);
			assert.equal(h.root.querySelector(".cs-sidebar-toolbar .cs-portable-review-status"), null);
			await wait(25);
			assert.equal(overlay.hidden, false);
			assert.ok(overlay.textContent.length > 0);
			assert.equal(h.status(), "");
			read.resolve(); await h.settle();
			assert.equal(overlay.hidden, true);
			assert.equal(shell.hasClass("is-stale"), false);
		} finally { read.resolve(); await h.destroy(); }
	});
	it("fast refreshes and closed views never show a delayed overlay", async () => {
		const h = harness(undefined, 15);
		try {
			await h.view.onOpen();
			h.edit("a.md", "Changed [!note]"); h.vaultEvents.emit("modify", h.handles.get("a.md"));
			await h.settle(); await wait(20);
			assert.equal(h.root.querySelectorAll(".is-busy").length, 0);
			const read = deferred(); h.hooks.beforeRead = () => read.promise;
			h.edit("a.md", "Changed again [!note]"); h.vaultEvents.emit("modify", h.handles.get("a.md"));
			await h.view.onClose(); read.resolve(); await wait(20);
			assert.equal(h.root.children.length, 0);
		} finally { await h.destroy(); }
	});
});
