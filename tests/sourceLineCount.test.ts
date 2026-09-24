import assert from "node:assert";
import { describe, it } from "node:test";
import { codeLineCount } from "./support/sourceScan";

describe("source size counts code without penalizing documentation", () => {
	it("ignores blank and comment-only lines while keeping code beside comments", () => {
		const text = [
			"// A heading",
			"",
			"  ",
			"/* A block",
			" * with several lines",
			" */",
			"run(); // An explanation",
			"/* Before */ run(); /* After */",
			"/** A documentation comment */",
		].join("\n");
		assert.equal(codeLineCount(text), 2);
	});

	it("keeps multiline literal text but ignores comments inside interpolation", () => {
		const text = [
			"const template = `",
			"// Literal text",
			"/* Also literal text */",
			"",
			"${",
			"  /* An actual comment */",
			'  "https://example.com/*data*/"',
			"}tail",
			"`;",
		].join("\n");
		assert.equal(codeLineCount(text), 7);
	});

	it("does not interpret regex or quoted comment markers as comments", () => {
		const text = String.raw`const pattern = /\/\*[a-z]+\*\//;
const url = "https://example.com";
run();`;
		assert.equal(codeLineCount(text), 3);
	});

	it("counts empty files and trailing newlines consistently for LF and CRLF", () => {
		for (const newline of ["\n", "\r\n"]) {
			assert.equal(codeLineCount(`  ${newline}// Comment${newline}`), 0);
			assert.equal(codeLineCount(`run();${newline}${newline}`), 1);
		}
		assert.equal(codeLineCount(""), 0);
		assert.equal(codeLineCount("run();"), 1);
	});
});
