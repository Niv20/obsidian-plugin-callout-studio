import assert from "node:assert";
import { describe, it } from "node:test";
import { GlobalStyleModal } from "../src/settings/GlobalStyleModal";
import { STYLE_DEMO_ID } from "../src/constants";
import { scanLineForCalloutTokens, tokenEnd } from "../src/editor/calloutTokens";
import { registerLocale, setLocale } from "../src/i18n";
import { he } from "../src/i18n/he";
import type { SettingsTabPlugin } from "../src/settings/sections/types";

describe("global inline style preview", () => {
	it("selects a separate localized title for each style role", () => {
		const plugin = { app: {} } as unknown as SettingsTabPlugin;
		const cases = [
			["regular", "settings.globalStyleRegularTitle"],
			["heading", "settings.globalStyleHeadingTitle"],
			["inline", "settings.globalStyleInlineTitle"],
		] as const;

		for (const [role, expectedKey] of cases) {
			const modal = new GlobalStyleModal(plugin, role);
			assert.strictEqual(modal["titleKey"](), expectedKey);
		}
	});

	it("shows a content pill between two Lorem ipsum sentences", () => {
		// The sample uses the same token grammar as an ordinary note. Testing the
		// modal's actual markdown catches a preview that silently falls back to
		// the bare `[!id]` pill and leaves `{Example}` as plain text.
		const modal = new GlobalStyleModal(
			{ app: {} } as unknown as SettingsTabPlugin,
			"inline",
		);
		const markdown = modal["buildSampleText"]();
		const tokens = scanLineForCalloutTokens(markdown).filter(
			(token) => token.role === "inline",
		);
		assert.strictEqual(tokens.length, 1);
		const [pill] = tokens;
		assert.ok(pill);
		assert.strictEqual(pill.rawId, STYLE_DEMO_ID);
		assert.strictEqual(pill.content?.text, "Example");
		assert.strictEqual(
			markdown.slice(pill.from, tokenEnd(pill)),
			`[!${STYLE_DEMO_ID}]{Example}`,
		);
		assert.match(markdown.slice(0, pill.from), /^Lorem ipsum .+\. $/);
		assert.match(markdown.slice(tokenEnd(pill)), /^ .+\.$/);
	});

	it("reveals the localized Example syntax in Hebrew too", () => {
		registerLocale("he", he);
		setLocale("he");
		try {
			const modal = new GlobalStyleModal(
				{ app: {} } as unknown as SettingsTabPlugin,
				"inline",
			);
			assert.match(
				modal["buildSampleText"](),
				/\[!global-style-demo\]\{דוגמה\}/,
			);
		} finally {
			setLocale("en");
		}
	});
});
