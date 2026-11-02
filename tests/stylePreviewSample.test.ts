/**
 * tests/stylePreviewSample.test.ts — the sample note the style pages' preview
 * draws (settings/stylePreview.ts, `sampleText`).
 *
 * What is checked: the inline sample is a real inline callout between two
 * sentences, and its label follows the interface language.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { sampleText } from "../src/settings/stylePreview";
import { STYLE_DEMO_ID } from "../src/constants";
import { scanLineForCalloutTokens, tokenEnd } from "../src/editor/calloutTokens";
import { registerLocale, setLocale } from "../src/i18n";
import { he } from "../src/i18n/he";

describe("the inline style preview's sample", () => {
	it("shows a content pill between two Lorem ipsum sentences", () => {
		// The sample uses the same token grammar as an ordinary note. Testing the
		// actual markdown catches a preview that silently falls back to the bare
		// `[!id]` pill and leaves `{Example}` as plain text.
		const markdown = sampleText("inline");
		const tokens = scanLineForCalloutTokens(markdown).filter((token) => token.role === "inline");
		assert.strictEqual(tokens.length, 1);
		const [pill] = tokens;
		assert.ok(pill);
		assert.strictEqual(pill.rawId, STYLE_DEMO_ID);
		assert.strictEqual(pill.content?.text, "Example");
		assert.strictEqual(markdown.slice(pill.from, tokenEnd(pill)), `[!${STYLE_DEMO_ID}]{Example}`);
		assert.match(markdown.slice(0, pill.from), /^Lorem ipsum .+\. $/);
		assert.match(markdown.slice(tokenEnd(pill)), /^ .+\.$/);
	});

	it("reveals the localized Example syntax in Hebrew too", () => {
		registerLocale("he", he);
		setLocale("he");
		try {
			assert.match(sampleText("inline"), /\[!global-style-demo\]\{דוגמה\}/);
		} finally {
			setLocale("en");
		}
	});
});
