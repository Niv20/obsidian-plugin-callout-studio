import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
	getLocale, isLocaleRegistered, registerLocaleFile,
	resolveLocaleCode, resolveLocaleFile, setLocale, t,
} from "../src/i18n";
import { en } from "../src/i18n/en";

afterEach(() => setLocale("en"));

describe("saved locale identities", () => {
	for (const name of ["__proto__", "constructor", "toString", "hasOwnProperty", "__proto__-US"]) {
		it(`falls back safely for inherited name ${name}`, () => {
			assert.equal(isLocaleRegistered(name), false);
			assert.equal(resolveLocaleCode(name), "en");
			assert.equal(resolveLocaleFile(name), null);
			setLocale(name);
			assert.equal(getLocale(), "en");
			assert.equal(t("settings.import"), en["settings.import"]);
			assert.doesNotThrow(() => new Intl.NumberFormat(getLocale()).format(1000));
		});
	}

	it("retains aliases and region fallback for actual translation tables", () => {
		registerLocaleFile("nb", { "settings.import": "Import test" });
		assert.equal(resolveLocaleFile("no-NO"), "nb");
		setLocale("no-NO");
		assert.equal(getLocale(), "no");
		assert.equal(t("settings.import"), "Import test");
	});
});
