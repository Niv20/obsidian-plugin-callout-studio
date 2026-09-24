import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { preparePortableCalloutConversion as prepare, reviewPortableCalloutSelection as select, applyPortableCalloutConversion as apply,
	retainPortableCalloutReplacements as retain } from "../src/utils/portableCalloutVault";
import { PortableCustomReplacementError } from "../src/utils/portableCalloutCustom";
import { portableVault } from "./support/portableVaultHarness";
import { createPortableReplacementEditor } from "../src/portable/portableReplacementEditor";

describe("independent inline review units", () => {
	it("gives every full token its own exact source range and distinct identity", async () => {
		const source = "A [!note] B [!note] C [!tip|red]{text {nested} value} D";
		const h = portableVault({ "a.md": source }), plan = await prepare(h.app);
		assert.equal(plan.changes.length, 3);
		assert.deepEqual(plan.changes.map(row => row.before), ["[!note]", "[!note]", "[!tip|red]{text {nested} value}"]);
		assert.deepEqual(plan.changes.map(row => row.after), ["note", "note", "text {nested} value"]);
		assert.equal(new Set(plan.changes.map(row => row.id)).size, 3);
		for (const row of plan.changes) {
			assert.equal(row.sourceLine, source); assert.equal(row.sourceLine.slice(row.from, row.to), row.before);
			assert.equal(row.headingLine, false); assert.equal(row.count, 1);
		}
	});
	it("applies each possible subset without touching another token or surrounding bytes", async () => {
		const tokens = ["[!note]", "[!tip]{text}", "[!note]"], converted = ["note", "text", "note"];
		for (let mask = 0; mask < 8; mask++) {
			const source = `Start ${tokens.join(" / ")} end\r\n`;
			const h = portableVault({ "a.md": source }), base = await prepare(h.app);
			const ids = base.changes.filter((_, index) => mask & (1 << index)).map(row => row.id);
			const plan = select(h.app, base, new Set(ids));
			assert.equal(plan.count, ids.length); assert.equal(plan.selectedIds.length, ids.length);
			assert.equal((await apply(h.app, plan)).status, "complete");
			assert.equal(h.contents.get("a.md"), `Start ${tokens.map((token, index) => mask & (1 << index) ? converted[index] : token).join(" / ")} end\r\n`);
		}
	});
	it("recomputes block-preserving escapes for adjacent selected or excluded tokens", async () => {
		for (const [chosen, expected, after] of [
			[[0, 1], "\\# Heading", "\\# Heading"], [[1], "[!a]{}# Heading", "# Heading"], [[0], "[!b]{# Heading}", ""],
		] as const) {
			const h = portableVault({ "a.md": "[!a]{}[!b]{# Heading}" }), base = await prepare(h.app);
			const plan = select(h.app, base, new Set(chosen.map(index => base.changes[index]!.id)));
			assert.equal(plan.changes[chosen[chosen.length - 1]!]!.after, after);
			await apply(h.app, plan); assert.equal(h.contents.get("a.md"), expected);
		}
	});
	it("edits the actual subset replacement and treats saving it unchanged as the default", async () => {
		const h = portableVault({ "a.md": "[!a]{}[!b]{# Heading}" }), base = await prepare(h.app);
		const row = base.changes[1]!, ids = new Set([row.id]);
		const subset = select(h.app, base, ids), current = subset.changes[1]!;
		assert.equal(current.after, "# Heading"); assert.equal(current.replacement, "# Heading");
		const editor = createPortableReplacementEditor(row, current)!;
		assert.equal(editor.fields[0]!.value, "# Heading"); assert.equal(editor.compose(["# Heading"]), undefined);
		const custom = new Map([[row.id, editor.compose(["Custom"])!]]);
		const customRow = select(h.app, base, ids, custom).changes[1]!;
		assert.equal(customRow.replacement, "Custom"); assert.equal(customRow.defaultReplacement, "# Heading");
		assert.equal(createPortableReplacementEditor(row, customRow, custom.get(row.id))!.compose(["# Heading"]), undefined);
	});
	it("keeps every heading line together, including interior inline-style payloads", async () => {
		const h = portableVault({ "a.md": "## Title [!tip]{content} and [!note]\n[!a][!b]" });
		const plan = await prepare(h.app);
		assert.equal(plan.changes.length, 3);
		assert.equal(plan.changes[0]!.headingLine, true);
		assert.equal(plan.changes[0]!.before, "## Title [!tip]{content} and [!note]");
		assert.equal(plan.changes[0]!.after, "## Title content and");
	});
	it("never exposes protected or ambiguous spans as independent units", async () => {
		const h = portableVault({ "a.md": '`[!code]` $[!math]$ <!-- [!comment] --> [!yes] [!open]{unfinished' });
		const plan = await prepare(h.app);
		assert.deepEqual(plan.changes.map(row => row.before), ["[!yes]"]);
		assert.equal(plan.skipped, 1);
	});
	it("projects automatic wiki and Markdown link repairs inside a converted payload", async () => {
		const h = portableVault({ "a.md": "# [!tip] Title", "b.md": "Before [!note]{[[a#tip Title]] [read](a.md#tip%20Title)} after [!info]" });
		const base = await prepare(h.app), payload = base.changes.find(row => row.path === "b.md")!;
		assert.equal(payload.after, "[[a#Title]] [read](a.md#Title)");
		assert.equal(base.linkChanges[0]!.after, "Before [[a#Title]] [read](a.md#Title) after info");
		const inlineOnly = select(h.app, base, new Set([payload.id]));
		assert.equal(inlineOnly.changes.find(row => row.id === payload.id)!.after, "[[a#tip Title]] [read](a.md#tip%20Title)");
		await apply(h.app, inlineOnly);
		assert.equal(h.contents.get("b.md"), "Before [[a#tip Title]] [read](a.md#tip%20Title) after [!info]");
	});
	it("edits only the chosen token and retains independent custom selections", async () => {
		const h = portableVault({ "a.md": "Before [!note] middle [!tip] after" }), base = await prepare(h.app);
		const chosen = base.changes[1]!, custom = new Map([[chosen.id, "Custom"]]);
		const plan = select(h.app, base, new Set([chosen.id]), custom);
		assert.equal(plan.changes[1]!.after, "Custom");
		await apply(h.app, plan);
		assert.equal(h.contents.get("a.md"), "Before [!note] middle Custom after");
	});
	it("rejects a custom delimiter that consumes unchanged neighbouring text on the same line", async () => {
		for (const [source, replacement] of [["[!note] plain text`", "`open"], ["[!note] plain %% tail", "%%"], ["[!note] plain --> tail", "<!--"]]) {
			const h = portableVault({ "a.md": source! }), base = await prepare(h.app);
			assert.throws(() => select(h.app, base, new Set(base.selectedIds), new Map([[base.changes[0]!.id, replacement!]])), PortableCustomReplacementError);
		}
	});
	it("rejects custom text that turns surrounding prose into a quote, list or nested container", async () => {
		for (const [source, replacement] of [
			["[!note] unchanged prose", "> quoted"], ["[!note] unchanged prose", "- listed"],
			["[!note] unchanged prose", "1. numbered"], ["[!note] unchanged prose", "    indented"],
			["- [!note] unchanged prose", "- nested"],
		]) {
			const h = portableVault({ "a.md": source! }), base = await prepare(h.app);
			assert.throws(() => select(h.app, base, new Set(base.selectedIds), new Map([[base.changes[0]!.id, replacement!]])), PortableCustomReplacementError);
		}
	});
	it("never transfers a deleted duplicate token override to its surviving sibling", async () => {
		const h = portableVault({ "a.md": "[!note][!note]" }), base = await prepare(h.app);
		const custom = new Map(base.changes.map((row, index) => [row.id, `Custom ${index}`]));
		h.edit("a.md", "[!note]");
		assert.equal(retain(h.app, base, await prepare(h.app), custom).size, 0);
	});
	it("retains both repeated tokens when an unrelated line changes", async () => {
		const h = portableVault({ "a.md": "[!note][!note]\nOther" }), base = await prepare(h.app);
		const custom = new Map(base.changes.map((row, index) => [row.id, `Custom ${index}`]));
		h.edit("a.md", "[!note][!note]\nChanged");
		assert.deepEqual(retain(h.app, base, await prepare(h.app), custom), custom);
	});
});
