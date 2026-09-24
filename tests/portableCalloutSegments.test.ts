import assert from "node:assert/strict";
import { test } from "node:test";
import { convertPortableCallouts, type PortableCalloutLineChange } from "../src/utils/portableCallouts";
import { createPortableCustomFields as create, composePortableCustomFields as compose } from "../src/utils/portableCalloutSegments";
import { PortableCustomReplacementError } from "../src/utils/portableCalloutCustom";

function model(source: string) {
	const changes: PortableCalloutLineChange[] = [];
	convertPortableCallouts(source, change => changes.push(change));
	assert.equal(changes.length, 1);
	const row = changes[0]!;
	const result = create(row.before.replace(/\r$/, ""), row.after.replace(/\r$/, ""), row.edits);
	assert.ok(result, source);
	assert.equal(compose(result, result.fields.map(field => field.value)), row.after.replace(/\r$/, ""));
	return result;
}

test("inline fields expose one context word and replace only the approved source spans", () => {
	const result = model("Earlier word [!tip]{**Text**} after later.");
	assert.deepEqual(result.fields, [{ from: 13, to: 29, source: "[!tip]{**Text**}", before: "word", after: "after", value: "**Text**" }]);
	assert.equal(compose(result, ["New"]), "Earlier word New after later.");
});

test("separate fields preserve adjacent tokens, empty values and literal delimiter text", () => {
	const result = model("Start [!a][!b] middle [!c]{Text} end");
	assert.equal(result.fields.length, 3);
	assert.equal(compose(result, ["a middle b", "", " middle "]), "Start a middle b middle  middle  end");
	assert.deepEqual(result.fields.map(field => field.source), ["[!a]", "[!b]", "[!c]{Text}"]);
});

test("protected examples never become editable fields", () => {
	const result = model('`[!code]` $[!math]$ [[Page|[!link]]] <!-- [!comment] --> [!actual]');
	assert.equal(result.fields.length, 1);
	assert.equal(result.fields[0]!.source, "[!actual]");
	assert.equal(compose(result, ["Changed"]), '`[!code]` $[!math]$ [[Page|[!link]]] <!-- [!comment] --> Changed');
});

test("escaped bare labels and complete payload ownership follow the actual converter", () => {
	assert.equal(model("[!a*b]").fields[0]!.value, "a\\*b");
	assert.equal(model("before [!tip]{a {nested} value} after").fields[0]!.source, "[!tip]{a {nested} value}");
	const crlf = model("לפני [!סוג]{תוכן} אחרי\r\n");
	assert.equal(compose(crlf, ["חדש"]), "לפני חדש אחרי");
});

test("block-preserving escapes inside a replacement belong to the editable value", () => {
	for (const [source, expected] of [
		["[!tip]{# Heading}", "\\# Heading"],
		["[!tip]{1. Item}", "1\\. Item"],
		["[!tip]{    code}", "&#32;   code"],
		["[!tip]{\tcode}", "&#9;code"],
	]) {
		const result = model(source!);
		assert.equal(result.fields[0]!.value, expected);
		assert.equal(compose(result, ["Custom"]), "Custom");
	}
});

test("block-preserving escapes of untouched prose stay outside empty fields", () => {
	for (const [source, expected] of [
		["[!tip]{}# Heading", "Custom\\# Heading"],
		["[!tip]{}    code", "Custom&#32;   code"],
	]) {
		const result = model(source!);
		assert.equal(result.fields[0]!.value, "");
		assert.equal(compose(result, ["Custom"]), expected);
	}
	const adjacent = model("[!a]{}[!b]{# Heading}");
	assert.deepEqual(adjacent.fields.map(field => field.value), ["", "\\# Heading"]);
	assert.equal(compose(adjacent, ["First", "Second"]), "FirstSecond");
});

test("unapproved ranges or unmatched finalized output fail closed", () => {
	assert.equal(create("[!a]", "a", []), undefined);
	assert.equal(create("[!a]", "different", [{ from: 0, to: 4, text: "a" }]), undefined);
	assert.equal(create("[!a]", "a", [{ from: -1, to: 4, text: "a" }]), undefined);
	assert.equal(create("[!a]", "a", [{ from: 0, to: 9, text: "a" }]), undefined);
	assert.equal(create("[!a][!b]", "ab", [{ from: 0, to: 5, text: "a" }, { from: 4, to: 8, text: "b" }]), undefined);
});

test("composition rejects newlines, nulls and incorrect field counts", () => {
	const result = model("[!tip]");
	for (const values of [[], ["one", "two"], ["one\ntwo"], ["one\rtwo"], ["nul\0byte"]]) {
		assert.throws(() => compose(result, values), PortableCustomReplacementError);
	}
});
