/** ID chips wear the IDs field's corners on mobile and keep their own on desktop. */
import assert from "node:assert";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(process.cwd(), "styles.css"), "utf8").replace(
	/\/\*[\s\S]*?\*\//g,
	"",
);
const rules: { selectors: string[]; body: string }[] = [];
const pattern = /([^{}]+)\{([^{}]*)\}/g;
let match: RegExpExecArray | null;
while ((match = pattern.exec(css)) !== null) {
	rules.push({
		selectors: (match[1] ?? "").trim().split(/,\s*\n/).map((s) => s.trim().replace(/\s+/g, " ")),
		body: match[2] ?? "",
	});
}
function ruleFor(selector: string) {
	const hits = rules.filter((rule) => rule.selectors.includes(selector));
	assert.strictEqual(hits.length, 1, `expected one rule for ${selector}`);
	return hits[0]!;
}
function declarationOf(body: string, property: string): string | undefined {
	return body
		.split(";")
		.map((d) => d.trim())
		.find((d) => d.startsWith(`${property}:`));
}

const FIELD = ".cs-text-control.cs-text-control.cs-text-control.cs-text-control";

describe("ID chips under the IDs field", () => {
	it("keep the small desktop radius by default", () => {
		assert.strictEqual(
			declarationOf(ruleFor(".cs-tag-chip").body, "border-radius"),
			"border-radius: var(--radius-s)",
		);
	});

	it("take the field's own corner tokens wherever Obsidian makes fields pills", () => {
		// Obsidian sets `--input-radius` to a pill under `.is-mobile` (phone and
		// tablet), so the chips must read the very same declarations as the field.
		const field = rules.find((rule) => rule.selectors.includes(FIELD));
		assert.ok(field, "the shared field base must exist");
		const chip = ruleFor(".is-mobile .cs-tag-chip");
		for (const property of ["border-radius", "corner-shape"]) {
			const expected = declarationOf(field.body, property);
			assert.ok(expected, `the field declares ${property}`);
			assert.strictEqual(declarationOf(chip.body, property), expected, property);
		}
	});
});
