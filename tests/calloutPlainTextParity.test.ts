/**
 * tests/calloutPlainTextParity.test.ts — Convert uses to plain text and Review
 * conversion leave the same text behind.
 *
 * Both run their heading and inline tokens through convertCalloutLine. This
 * pins that they keep doing so: on a line with no block callout, converting
 * every type on it one way must give exactly what the other way gives.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calloutsToPlainText } from "../src/utils/calloutPlainText";
import { calloutIdentity } from "../src/utils/calloutId";
import { iterateDocumentCallouts } from "../src/editor/documentCallouts";
import { convertPortableCallouts } from "../src/utils/portableCallouts";

const lines: Array<[string, string]> = [
	["payload", "See [!warning]{be careful} here."],
	["Hebrew payload", "פרק [!מיקום]{פרק שני — לולאת ההרגל} כאן"],
	["bare pill", "See [!warning] here."],
	["metadata and source spelling", "[!  My TYPE |color|extra]"],
	["empty payload", "A[!note]{}B"],
	["payload spaces kept", "a [!note]{  inside  } z"],
	["payload cannot create a list", "[!note]{- item} at line start"],
	["payload cannot create a heading", "[!note]{# not a heading}"],
	["literal id formatting", "[!*bold*_&copy;|metadata]"],
	["heading with title", "### [!warning] Title"],
	["heading without title", "### [!warning]"],
	["trailing heading decoration", "# Title [!type]"],
	["heading payload", "# Title [!type]{payload}"],
	["closing heading hashes", "# [!type] ###"],
	["quoted body pill", "> Text [!inline]{body} and [!bare]"],
	["pill inside a payload stays", "[!a]{outer [!b]{inner}}"],
	["unclosed payload stays", "[!safe] [!open]{unfinished"],
];

describe("Convert uses to plain text matches Review conversion", () => {
	for (const [name, source] of lines) {
		it(name, () => {
			const ids = new Set(Array.from(iterateDocumentCallouts(source), ({ token }) => calloutIdentity(token.rawId)));
			const vault = calloutsToPlainText(source, ids)?.content ?? source;
			assert.equal(vault, convertPortableCallouts(source).content);
		});
	}

	it("a pill with text leaves only its text", () => {
		assert.equal(calloutsToPlainText("See [!warning]{be careful} here.", new Set(["warning"]))?.content, "See be careful here.");
	});
});
