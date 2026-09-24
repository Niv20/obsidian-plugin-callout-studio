import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PortableCustomReplacementError } from "../src/utils/portableCalloutCustom";
import { applyPortableCalloutConversion as apply, preparePortableCalloutConversion as prepare,
	reviewPortableCalloutSelection as select, retainPortableCalloutReplacements as retain } from "../src/utils/portableCalloutVault";
import { portableVault } from "./support/portableVaultHarness";

describe("custom portable replacements remain approved source-unit edits", () => {
	it("replans wiki, embedded and Markdown heading references from a custom title", async () => {
		const h = portableVault({ "a.md": "# [!note] Title", "b.md": "[[a#note Title|alias]] ![[a#note Title]] [Read](a.md#note%20Title)" });
		const base = await prepare(h.app), row = base.changes[0]!;
		const overrides = new Map([[row.id, "# New **title**"]]);
		const plan = select(h.app, base, new Set(base.selectedIds), overrides);
		overrides.set(row.id, "# Mutated after review");
		assert.equal(plan.changes[0]!.after, "# New **title**");
		assert.equal(plan.changes[0]!.custom, true);
		assert.equal(plan.linkCount, 3);
		assert.equal(base.changes[0]!.custom, false);
		assert.equal((await apply(h.app, plan)).status, "complete");
		assert.equal(h.contents.get("a.md"), "# New **title**");
		assert.equal(h.contents.get("b.md"), "[[a#New **title**|alias]] ![[a#New **title**]] [Read](a.md#New%20**title**)");
	});
	it("preserves custom replacements across selection without freezing automatic links into the editable text", async () => {
		const h = portableVault({ "a.md": "# [!tip] Heading", "b.md": "[!note] [[a#tip Heading]]" });
		const base = await prepare(h.app), inline = base.changes.find(row => row.path === "b.md")!;
		const plan = select(h.app, base, new Set(base.selectedIds), new Map([[inline.id, "Custom"]]));
		assert.equal(plan.changes.find(row => row.id === inline.id)!.replacement, "Custom");
		assert.equal(plan.changes.find(row => row.id === inline.id)!.after, "Custom");
		assert.equal(plan.linkChanges[0]!.after, "Custom [[a#Heading]]");
		const justInline = select(h.app, plan, new Set([inline.id]));
		assert.equal(justInline.changes.find(row => row.id === inline.id)!.after, "Custom");
		assert.equal(justInline.linkChanges.length, 0);
		const restored = select(h.app, plan, new Set(base.selectedIds), new Map());
		assert.equal(restored.changes.find(row => row.id === inline.id)!.after, "note");
		assert.equal(restored.changes.find(row => row.id === inline.id)!.custom, false);
	});
	it("keeps CRLF, empty inline output, and literal HTML bytes", async () => {
		const h = portableVault({ "a.md": "[!note]\r\n[!tip]\r\n" });
		const base = await prepare(h.app);
		const plan = select(h.app, base, new Set(base.selectedIds), new Map([
			[base.changes[0]!.id, ""], [base.changes[1]!.id, '<img src="x" onerror="alert(1)">'],
		]));
		assert.equal((await apply(h.app, plan)).status, "complete");
		assert.equal(h.contents.get("a.md"), '\r\n<img src="x" onerror="alert(1)">\r\n');
	});
	it("rejects multiline and control text even for an unchecked override", async () => {
		const h = portableVault({ "a.md": "[!note]" });
		const base = await prepare(h.app);
		for (const text of ["first\nsecond", "first\rsecond", "nul\0byte", "first\u2028second", "first\u2029second"]) {
			assert.throws(() => select(h.app, base, new Set(), new Map([[base.changes[0]!.id, text]])), PortableCustomReplacementError);
		}
		assert.deepEqual(h.written, []);
	});
	it("rejects fenced code, comments, frontmatter, math and HTML consuming neighbouring lines", async () => {
		for (const text of ["```", "~~~", "%%", "<!--", "---", "$$", "<div>", "`code"]) {
			const h = portableVault({ "a.md": "[!note]\nordinary text\n[!tip] end`" });
			const base = await prepare(h.app);
			assert.throws(() => select(h.app, base, new Set(base.selectedIds), new Map([[base.changes[0]!.id, text]])), PortableCustomReplacementError, text);
		}
	});
	it("does not allow adding, removing or changing the level of headings", async () => {
		for (const [source, text] of [["# [!note] Title", "plain"], ["# [!note] Title", "## Changed"], ["[!note]", "# New"]]) {
			const h = portableVault({ "a.md": source! });
			const base = await prepare(h.app);
			assert.throws(() => select(h.app, base, new Set(base.selectedIds), new Map([[base.changes[0]!.id, text!]])), PortableCustomReplacementError);
		}
	});
	it("allows balanced formatting without changing protected neighbouring text", async () => {
		const h = portableVault({ "a.md": "[!note]\n`[!keep]`\n$$[!math]$$" });
		const base = await prepare(h.app);
		const plan = select(h.app, base, new Set(base.selectedIds), new Map([[base.changes[0]!.id, "**Bold** `code` $x$ %%hidden%%"]]));
		assert.equal((await apply(h.app, plan)).status, "complete");
		assert.equal(h.contents.get("a.md"), "**Bold** `code` $x$ %%hidden%%\n`[!keep]`\n$$[!math]$$");
	});
	it("retains unchanged unique source segments across edits, insertion and rename", async () => {
		const h = portableVault({ "a.md": "[!note]\nOther text", "b.md": "[!tip]" });
		const base = await prepare(h.app), changes = new Map(base.changes.map(row => [row.id, "Custom"]));
		assert.deepEqual(retain(h.app, base, await prepare(h.app), changes), changes);
		h.edit("a.md", "[!note]\nChanged outside row", false);
		const next = await prepare(h.app), kept = retain(h.app, base, next, changes);
		assert.deepEqual(kept, changes);
		assert.equal(retain(portableVault({}).app, base, next, changes).size, 0);
		h.rename("b.md", "renamed.md");
		const renamed = await prepare(h.app);
		assert.equal(retain(h.app, next, renamed, kept).size, 2);
		h.edit("a.md", "Inserted\n[!note]\nChanged outside row");
		const moved = await prepare(h.app);
		assert.equal(retain(h.app, renamed, moved, retain(h.app, next, renamed, kept)).size, 2);
	});
	it("rejects foreign rows and stale approved input before any write", async () => {
		const h = portableVault({ "a.md": "[!note]" });
		const base = await prepare(h.app);
		assert.throws(() => select(h.app, base, new Set(base.selectedIds), new Map([["foreign", "text"]])), { code: "invalid-plan" });
		const plan = select(h.app, base, new Set(base.selectedIds), new Map([[base.changes[0]!.id, "Custom"]]));
		h.edit("a.md", "User's new text", false);
		assert.equal((await apply(h.app, plan)).error?.code, "changed");
		assert.deepEqual(h.written, []);
	});
	it("keeps exactly approved custom link repairs after a partial write and forbids changing recovery", async () => {
		const h = portableVault({ "a.md": "# [!note] Title", "b.md": "[[a#note Title]]" });
		const base = await prepare(h.app);
		const custom = new Map([[base.changes[0]!.id, "# Custom title"]]);
		const plan = select(h.app, base, new Set(base.selectedIds), custom);
		h.hooks.beforeProcess = path => { if (path === "b.md") throw new Error("Disk unavailable"); };
		const pending = (await apply(h.app, plan)).remainingPlan!;
		assert.equal(h.contents.get("a.md"), "# Custom title");
		assert.throws(() => select(h.app, pending, new Set(pending.selectedIds), new Map()), { code: "invalid-plan" });
		delete h.hooks.beforeProcess;
		assert.equal((await apply(h.app, pending)).status, "complete");
		assert.equal(h.contents.get("b.md"), "[[a#Custom title]]");
	});
});
