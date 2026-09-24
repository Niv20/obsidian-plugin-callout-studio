/**
 * tests/repoLicenseDocs.test.ts — the licence the repo grants and the licence
 * its documents describe are the same licence.
 *
 * They were not, for a while. A carve-out ("may not be used to build another
 * Obsidian plugin") was added to LICENSE and then reverted, leaving the file
 * plain 0BSD — but `CONTRIBUTING.md` kept describing the restricted version, so
 * the repository told a contributor one thing and the file they were agreeing
 * to said another. Nothing catches that: LICENSE has no tests, prose has no
 * compiler, and the two are edited months apart.
 *
 * What follows is deliberately about *contradiction*, not wording. A doc may
 * describe the licence however it likes, and may ask for whatever it likes on
 * top — the README's "please don't repackage this and publish it as a new
 * plugin" is a request the author is entitled to make. What it may not do is
 * present that ask as a term of a licence that has no terms. So the rule is:
 * the word "restriction", and the phrasing that grants-with-conditions uses,
 * may not appear attached to *this* licence in any document while LICENSE
 * itself grants unconditionally.
 *
 * The third-party icon licences are a different matter entirely and are
 * genuinely conditional (Font Awesome's CC BY attribution, above all).
 * THIRD-PARTY-NOTICES.md is therefore out of scope, and the scan below is
 * anchored on the link to LICENSE so a sentence about somebody else's terms
 * cannot trip it.
 */
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const read = (name: string): string =>
	readFileSync(join(process.cwd(), name), "utf8");

const LICENSE = read("LICENSE");

/** Every document that describes the plugin's own licence to a reader. */
const DOCS = ["README.md", "docs/CONTRIBUTING.md", "docs/API.md"];

/**
 * Words that turn a grant into a conditional grant. `provided that` and
 * `subject to` are how a real conditional licence is written; `restriction`
 * and `may not` are how the reverted carve-out was written.
 */
const CONDITION_WORDS = /\b(restriction|restricted|may not|provided that|subject to)\b/i;

/**
 * The sentences in `text` that talk about the plugin's own licence — those
 * carrying a link to LICENSE at the root or from docs/. Split only where
 * punctuation ends a sentence, so the dots in ../LICENSE stay in the link.
 *
 * Matched rather than split on a lookbehind: `obsidianmd/regex-lookbehind` bans
 * those repo-wide, because iOS before 16.4 cannot parse one at all and this
 * plugin ships to phones.
 */
function licenceSentences(text: string): string[] {
	const sentences = text.split(/[.!?](?:\s+|$)/);
	return sentences.filter((s) => /\]\((?:\.\.\/)?LICENSE\)/.test(s));
}

describe("LICENSE grants without conditions", () => {
	it("is the 0BSD grant, with nothing hung off it", () => {
		assert.match(
			LICENSE,
			/for any purpose with or without fee is hereby granted/i,
			"LICENSE no longer carries the unconditional 0BSD grant",
		);
	});

	it("attaches no condition of its own", () => {
		// If this ever fails on purpose — the author really did add a term —
		// then it is the *docs* that have to be brought into line, and this
		// suite becomes the check that they were.
		const grant = LICENSE.split(/\n\s*\n/).find((p) =>
			p.includes("hereby granted"),
		);
		assert.ok(grant, "no grant paragraph in LICENSE");
		assert.doesNotMatch(grant, CONDITION_WORDS);
	});
});

describe("no document invents a term LICENSE does not have", () => {
	for (const doc of DOCS) {
		it(`${doc} describes the licence it links to`, () => {
			const offenders = licenceSentences(read(doc)).filter((s) =>
				CONDITION_WORDS.test(s),
			);
			assert.deepStrictEqual(
				offenders,
				[],
				`${doc} attaches a condition to a licence that has none:\n  ${offenders.join("\n  ")}`,
			);
		});
	}

	it("finds the licence sentences it is meant to be scanning", () => {
		// A guard on the guard: rename the LICENSE file or drop the links and
		// every assertion above passes vacuously.
		for (const doc of DOCS.filter((d) => d !== "docs/API.md")) {
			assert.ok(
				licenceSentences(read(doc)).length > 0,
				`${doc} no longer links to LICENSE — the scan above is empty`,
			);
		}
	});
});

describe("the no-repackaging ask is an ask", () => {
	it("README and CONTRIBUTING both say it is not a licence term", () => {
		// The ask itself is fine and stays. What is not fine is a reader coming
		// away thinking it binds them, which is exactly what CONTRIBUTING used
		// to do — and a contributor is the reader most likely to care.
		for (const doc of ["README.md", "docs/CONTRIBUTING.md"]) {
			const text = read(doc);
			assert.match(text, /repackage/i, `${doc} no longer carries the ask`);
			assert.match(
				text,
				/not a licen[cs]e term/i,
				`${doc} states the ask without saying it is not binding`,
			);
		}
	});
});
