import assert from "node:assert/strict";
import { test } from "node:test";
import { TFile, type App } from "obsidian";
import { convertPortableCallouts } from "../src/utils/portableCallouts";
import { planPortableHeadingLinks, PortableHeadingLinkCache } from "../src/utils/portableHeadingLinks";
import { portableHeadingDestinations } from "../src/utils/portableHeadingLinksScan";

function prepare(notes: Record<string, string>, selected: string[] = Object.keys(notes)) {
	const originals = Object.entries(notes).map(([path, content]) => ({ path, content }));
	const proposed = new Map(originals.map(note => [note.path, selected.includes(note.path) ? convertPortableCallouts(note.content).content : note.content]));
	const resolutions: { linkpath: string; source: string }[] = [];
	const app = { metadataCache: {
		getFirstLinkpathDest: (linkpath: string, source: string) => {
			resolutions.push({ linkpath, source });
			let path = linkpath;
			if (/^\.\.?\//.test(path)) {
				const parts = source.split("/").slice(0, -1);
				for (const part of path.split("/")) { if (part === "..") parts.pop(); else if (part !== ".") parts.push(part); }
				path = parts.join("/");
			}
			path = path.replace(/^\//, "");
			const direct = Object.keys(notes).find(candidate => candidate === path || candidate === `${path}.md`);
			const basename = Object.keys(notes).filter(candidate => candidate.split("/").pop()?.replace(/\.md$/, "") === path);
			const resolved = direct ?? (basename.length === 1 ? basename[0] : undefined);
			return resolved ? Object.assign(new TFile(), { path: resolved }) : null;
		},
	} } as unknown as App;
	const plan = planPortableHeadingLinks(app, originals, proposed);
	const outputs = new Map(proposed);
	if (!plan.issues.length) for (const note of originals) {
		let content = outputs.get(note.path)!;
		for (const edit of plan.edits.filter(edit => edit.path === note.path).sort((a, b) => b.from - a.from)) {
			assert.equal(content.slice(edit.from, edit.to), edit.before);
			content = content.slice(0, edit.from) + edit.text + content.slice(edit.to);
		}
		outputs.set(note.path, content);
	}
	return { plan, outputs, proposed, resolutions, app, originals };
}

test("wiki links and embeds keep paths and aliases while repairing headings", () => {
	const { plan, outputs } = prepare({ "Note.md": "# Report [!note]", "Index.md": "[[Note#Report [!note]|My label]] ![[Note.md#Report [!note]]]" });
	assert.equal(outputs.get("Index.md"), "[[Note#Report|My label]] ![[Note.md#Report]]");
	assert.equal(plan.edits.length, 2);
	assert.equal(plan.edits[0]!.targetPath, "Note.md");
	assert.equal(plan.edits[0]!.targetLine, 1);
});

test("same-note links, URI fragments, Markdown images and titles keep surrounding bytes", () => {
	const original = '# Report [!note]\n[read](#Report%20%5B!note%5D "a title")\n![embed](<#Report [!note]> \'title\')\n[[#Report [!note]|local]]';
	const { outputs, plan } = prepare({ "Note.md": original });
	assert.deepEqual(plan.issues, []);
	assert.equal(outputs.get("Note.md"), '# Report\n[read](#Report "a title")\n![embed](<#Report> \'title\')\n[[#Report|local]]');
});

test("relative paths are resolved through Obsidian with the original source file", () => {
	const { outputs, resolutions } = prepare({ "Folder/My note.md": "## שלום [!tip]", "Elsewhere/Index.md": "[read](../Folder/My%20note.md#%D7%A9%D7%9C%D7%95%D7%9D%20%5B!tip%5D)" });
	assert.equal(outputs.get("Elsewhere/Index.md"), "[read](../Folder/My%20note.md#%D7%A9%D7%9C%D7%95%D7%9D)");
	assert.ok(resolutions.some(call => call.linkpath === "../Folder/My note.md" && call.source === "Elsewhere/Index.md"));
});

test("angle destinations with folder paths and Markdown reference definitions are repaired", () => {
	const { outputs } = prepare({ "Folder/Note.md": "# Report [!note]", "Index.md": '[report][r]\n[r]: <Folder/Note.md#Report [!note]> "title"\n[x](<Folder/Note.md#Report [!note]>)' });
	assert.equal(outputs.get("Index.md"), '[report][r]\n[r]: <Folder/Note.md#Report> "title"\n[x](<Folder/Note.md#Report>)');
});

test("Markdown destinations escape parentheses and preserve an escaped file path", () => {
	const { outputs } = prepare({ "My (note).md": "# A (heading) [!tip]", "Index.md": '[x](My%20\\(note\\).md#A%20(heading)%20%5B!tip%5D "title")' });
	assert.equal(outputs.get("Index.md"), '[x](My%20\\(note\\).md#A%20%28heading%29 "title")');
});

test("native punctuation and case normalization matches existing anchor spelling", () => {
	const { outputs } = prepare({ "Note.md": "# **HELLO**, world [!note]", "Index.md": "[[Note#hello world note]]" });
	assert.equal(outputs.get("Index.md"), "[[Note#**HELLO**, world]]");
});

test("metadata is part of the old heading anchor but is removed with decoration", () => {
	const { outputs } = prepare({ "Note.md": "# Report [!note|purple]", "Index.md": "[[Note#Report [!note purple]|label]]" });
	assert.equal(outputs.get("Index.md"), "[[Note#Report|label]]");
});

test("a converted heading's equivalent native anchor still gets plain source spelling", () => {
	const { outputs, plan } = prepare({ "Note.md": "# [!note]", "Index.md": "[[Note#[!note]]] [[Note#note]]" });
	assert.equal(outputs.get("Note.md"), "# note");
	assert.equal(plan.edits.length, 1);
	assert.equal(outputs.get("Index.md"), "[[Note#note]] [[Note#note]]");
});

test("unselected headings and unrelated headings never acquire repairs", () => {
	const { plan, outputs } = prepare({ "Note.md": "# Report [!note]", "Index.md": "[[Note#Report note]]\nword [!tip]" }, ["Index.md"]);
	assert.equal(plan.edits.length, 0);
	assert.equal(outputs.get("Index.md"), "[[Note#Report note]]\nword tip");
});

test("heading paths update parent and child components together", () => {
	const { outputs } = prepare({ "Note.md": "# Parent [!note]\n## Child [!tip]", "Index.md": "[[Note#Parent note#Child tip|label]] [x](Note.md#Parent%20note#Child%20tip)" });
	assert.equal(outputs.get("Index.md"), "[[Note#Parent#Child|label]] [x](Note.md#Parent#Child)");
});

test("renaming a parent repairs a path to an unchanged descendant", () => {
	const { outputs } = prepare({ "Note.md": "# Parent [!note]\n## Child", "Index.md": "[[Note#Parent note#Child]]" });
	assert.equal(outputs.get("Index.md"), "[[Note#Parent#Child]]");
});

test("setext headings including multiline paragraphs participate in repair", () => {
	const { outputs, plan } = prepare({ "Note.md": "Report\n[!note]{Details}\n===", "Index.md": "[[Note#Report note Details]]" });
	assert.deepEqual(plan.issues, []);
	assert.equal(outputs.get("Index.md"), "[[Note#Report Details]]");
	assert.equal(plan.edits[0]!.targetLine, 2);
});

test("CRLF and positions are preserved in source and link-only files", () => {
	const { outputs, plan } = prepare({ "Note.md": "# Report [!note]\r\nBody\r\n", "Index.md": "First\r\n[[Note#Report note]]\r\n" });
	assert.equal(outputs.get("Index.md"), "First\r\n[[Note#Report]]\r\n");
	assert.equal(plan.edits[0]!.line, 2);
});

test("code, YAML, comments, HTML, math and escaped wiki examples remain byte-exact", () => {
	const link = "[[Note#Report note]]";
	const protectedSource = `---\nexample: '${link}'\n---\n\n\`${link}\`\n\n\`\`\`md\n${link}\n\`\`\`\n\n    ${link}\n\n%% ${link} %%\n<!-- ${link} -->\n<div>${link}</div>\n\n$${link}$\n$$\n${link}\n$$\n\\${link}\n`;
	const { outputs, plan } = prepare({ "Note.md": "# Report [!note]", "Index.md": protectedSource + link });
	assert.equal(outputs.get("Index.md"), protectedSource + "[[Note#Report]]");
	assert.equal(plan.edits.length, 1);
});

test("external links, block links, missing notes and missing headings stay untouched", () => {
	const source = "[web](https://example.com/Note.md#Report%20note) [[Note#^block]] [[Missing#Report note]] [[Note#Other]]";
	const { outputs, plan } = prepare({ "Note.md": "# Report [!note]", "Index.md": source });
	assert.equal(outputs.get("Index.md"), source);
	assert.deepEqual(plan.issues, []);
});

test("headings inside quote, list, code, HTML and math do not create anchor changes", () => {
	const source = "> # Report [!note]\n\n- # Report [!note]\n\n```\n# Report [!note]\n```\n\n<div>\n# Report [!note]\n</div>\n\n$$\n# Report [!note]\n$$";
	const { plan, outputs } = prepare({ "Note.md": source, "Index.md": "[[Note#Report note]]" });
	assert.equal(plan.edits.length, 0);
	assert.equal(outputs.get("Index.md"), "[[Note#Report note]]");
});

test("conversion cannot create a duplicate destination with a pre-existing heading", () => {
	const { plan } = prepare({ "Note.md": "# Report\n# Report [!note]", "Index.md": "[[Note#Report note]]" });
	assert.ok(plan.issues.some(issue => issue.reason === "ambiguous-target" && issue.targetPath === "Note.md" && issue.targetLine === 2));
});

test("duplicate old headings are blocked instead of guessing which link was intended", () => {
	const { plan } = prepare({ "Note.md": "# Report [!note]\n# Report [!note]", "Index.md": "[[Note#Report note]]" });
	assert.deepEqual(new Set(plan.issues.map(issue => issue.targetLine)), new Set([1, 2]));
});

test("two conversions that collapse into one native anchor are both blocked", () => {
	const { plan } = prepare({ "Note.md": "# Report [!note]\n# Report [!tip]" });
	assert.deepEqual(new Set(plan.issues.map(issue => issue.targetLine)), new Set([1, 2]));
});

test("an ambiguous basename is delegated to Obsidian and never guessed by the converter", () => {
	const { outputs, plan } = prepare({ "A/Note.md": "# Report [!note]", "B/Note.md": "# Report [!tip]", "Index.md": "[[Note#Report note]]" });
	assert.equal(outputs.get("Index.md"), "[[Note#Report note]]");
	assert.equal(plan.edits.length, 0);
});

test("destinations within an outer Markdown link label are not active link edits", () => {
	const source = "[example [[Note#Report note]]](https://example.com)";
	const { outputs } = prepare({ "Note.md": "# Report [!note]", "Index.md": source });
	assert.equal(outputs.get("Index.md"), source);
});

test("table wiki aliases preserve their escaped separator", () => {
	const { outputs } = prepare({ "Note.md": "# Report [!note]", "Index.md": "| [[Note#Report note\\|label]] |\n| --- |" });
	assert.equal(outputs.get("Index.md"), "| [[Note#Report\\|label]] |\n| --- |");
});

test("malformed destinations do not turn into invented links", () => {
	const source = "[x](Note.md#Report%20note\n\n[[Note#Report%ZZnote]]\n[x](Note.md#Report%20note \"unterminated)";
	const { outputs } = prepare({ "Note.md": "# Report [!note]", "Index.md": source });
	assert.equal(outputs.get("Index.md"), source);
});

test("repair-induced heading changes update their incoming references transitively", () => {
	const { outputs, plan } = prepare({
		"Note.md": "# Report [!note]",
		"Middle.md": "# See [[Note#Report note]]",
		"Index.md": "[[Middle#See Note Report note]]",
	});
	assert.deepEqual(plan.issues, []);
	assert.equal(outputs.get("Middle.md"), "# See [[Note#Report]]");
	assert.equal(outputs.get("Index.md"), "[[Middle#See Note Report]]");
});

test("mask and destination scanner retain original offsets", () => {
	const content = "`[[No#Header]]`\n[x](<Folder/Note.md#Heading>)\n[[Yes#Heading|label]]";
	assert.deepEqual(portableHeadingDestinations(content).map(range => content.slice(range.from, range.to)), ["Folder/Note.md#Heading", "Yes#Heading"]);
});

test("literal percent sequences in wiki paths resolve as literal filenames", () => {
	const { outputs } = prepare({ "50%20.md": "# Progress 50% [!note]", "50 .md": "# Progress 50% [!tip]", "Index.md": "[[50%20#Progress 50% note]]" });
	assert.equal(outputs.get("Index.md"), "[[50%20#Progress 50%]]");
});

test("Markdown fragment punctuation keeps native decodeURI matching", () => {
	const { outputs } = prepare({ "Note.md": "# Ready? A&B [!note]", "Index.md": "[read](Note.md#Ready?%20A&B%20note)" });
	assert.equal(outputs.get("Index.md"), "[read](Note.md#Ready?%20A&B)");
});

test("converted entity spellings use a stable equivalent heading anchor", () => {
	const { outputs, plan } = prepare({ "Note.md": "# [!A&B]", "Index.md": "[[Note#A B]] [read](Note.md#A%20B)" });
	assert.deepEqual(plan.issues, []);
	assert.equal(outputs.get("Note.md"), "# A&amp;B");
	assert.equal(outputs.get("Index.md"), "[[Note#a amp b]] [read](Note.md#a%20amp%20b)");
});

test("a Markdown-escaped anchor separator preserves its source spelling", () => {
	const { outputs } = prepare({ "Note.md": "# Report [!note]", "Index.md": "[read](Note.md\\#Report%20note)" });
	assert.equal(outputs.get("Index.md"), "[read](Note.md\\#Report)");
});

test("code-only setext headings remain targets and prevent a redirecting collision", () => {
	const { plan } = prepare({ "Note.md": "# Code [!note]\n\n`Code`\n------", "Index.md": "[[Note#Code]]" });
	assert.ok(plan.issues.some(issue => issue.reason === "ambiguous-target" && issue.targetLine === 1));
});

test("inline-math-only setext headings remain targets and prevent a redirecting collision", () => {
	const { plan } = prepare({ "Note.md": "# Formula [!note]\n\n$Formula$\n------", "Index.md": "[[Note#Formula]]" });
	assert.ok(plan.issues.some(issue => issue.reason === "ambiguous-target" && issue.targetLine === 1));
});

test("fenced code and display math followed by dashes do not become setext targets", () => {
	const { plan } = prepare({ "Note.md": "# Formula [!note]\n\n```\nFormula\n```\n------\n\n$$\nFormula\n$$\n------" });
	assert.deepEqual(plan.issues, []);
});

test("session cache reuses exact parses, bounds variants and releases closed paths", () => {
	const cache = new PortableHeadingLinkCache();
	const first = cache.headings("Note.md", "# One");
	assert.equal(cache.headings("Note.md", "# One"), first);
	cache.headings("Note.md", "# Two"); cache.headings("Note.md", "# Three"); cache.headings("Note.md", "# Four");
	assert.notEqual(cache.headings("Note.md", "# One"), first);
	const existing = cache.headings("Note.md", "# One");
	cache.retainPaths(new Set(["Other.md"]));
	assert.notEqual(cache.headings("Note.md", "# One"), existing);
	const beforeClear = cache.headings("Note.md", "# One");
	cache.clear();
	assert.notEqual(cache.headings("Note.md", "# One"), beforeClear);
});

test("an empty payload cannot erase a setext heading and strand its incoming links", () => {
	const { plan } = prepare({ "Note.md": "[!note]{}\n===\n\n[[#note]]" });
	assert.deepEqual(plan.issues, [{ path: "Note.md", line: 1, targetPath: "Note.md", targetLine: 1, reason: "unrepresentable-target" }]);
});

test("removing the opening line of a multiline setext heading is blocked conservatively", () => {
	const { plan } = prepare({ "Note.md": "[!note]{}\nText\n===", "Index.md": "[[Note#note Text]]" });
	assert.ok(plan.issues.some(issue => issue.targetLine === 1 && issue.reason === "unrepresentable-target"));
});

test("reference destinations update while multiline titles remain byte-exact", () => {
	const source = '[read][r]\n[r]: Note.md#Report%20note\n  "A title with [[Note#Report note]]\nand [example]: Note.md#Report%20note"';
	const { outputs, plan } = prepare({ "Note.md": "# Report [!note]", "Index.md": source });
	assert.equal(outputs.get("Index.md"), source.replace("[r]: Note.md#Report%20note", "[r]: Note.md#Report"));
	assert.equal(plan.edits.length, 1);
});

test("malformed reference definitions and destinations are never guessed", () => {
	for (const source of [
		"[r]: Note.md#Report%20note extra prose",
		'[r]: <Note.md#Report note>"title without a separator"',
		'[r]: Note.md#Report%20note "unterminated title',
		'[r]: Note.md#Report%20note "title" trailing prose',
		"[r]:\n\nNote.md#Report%20note",
		'[read](<Note.md#Report note>"title without a separator")',
		"[read](Note.md#Report%20<note>)",
		"[read](Note.md#Report%20note\n \n)",
		'[read](Note.md#Report%20note "title\n \nwith a blank line")',
		'[read](Note.md#Report%20note "title"\n \n)',
	]) {
		assert.deepEqual(portableHeadingDestinations(source), [], source);
	}
});

test("reference destinations may start on the next line but not beyond a blank line", () => {
	const { outputs } = prepare({ "Note.md": "# Report [!note]", "Index.md": '[r]:\n  Note.md#Report%20note\n\n[[Note#Report note]]' });
	assert.equal(outputs.get("Index.md"), '[r]:\n  Note.md#Report\n\n[[Note#Report]]');
});

test("next-line angle destinations with folders are links rather than raw HTML", () => {
	const { outputs } = prepare({ "Folder/Note.md": "# Report [!note]", "Index.md": '[read](\n  <Folder/Note.md#Report note>)\n[r]:\n  <Folder/Note.md#Report note>' });
	assert.equal(outputs.get("Index.md"), '[read](\n  <Folder/Note.md#Report>)\n[r]:\n  <Folder/Note.md#Report>');
});

test("invalid next-line reference titles remain ordinary prose with active links", () => {
	const { outputs } = prepare({ "Note.md": "# Report [!note]", "Index.md": '[r]: Note.md#Report%20note\n"unfinished title [[Note#Report note]]' });
	assert.equal(outputs.get("Index.md"), '[r]: Note.md#Report\n"unfinished title [[Note#Report]]');
});
