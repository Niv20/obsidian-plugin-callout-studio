import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { DEFAULT_SETTINGS } from "../src/constants";
import { setLocale, t } from "../src/i18n";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { renderFallbackSection } from "../src/settings/sections/FallbackSection";
import { renderLanguageSection } from "../src/settings/sections/LanguageSection";
import type { SettingsSectionContext } from "../src/settings/sections/types";
import { asEl, el, type FakeElement } from "./support/fakeDom";

const previousStyle = Object.getOwnPropertyDescriptor(globalThis, "getComputedStyle");
const previousObserver = Object.getOwnPropertyDescriptor(globalThis, "ResizeObserver");
before(() => {
	Object.defineProperty(globalThis, "getComputedStyle", {
		configurable: true, value: () => ({ flexDirection: "row" }),
	});
	Object.defineProperty(globalThis, "ResizeObserver", {
		configurable: true, value: class { observe(): void {} disconnect(): void {} },
	});
});
after(() => {
	for (const [key, descriptor] of [["getComputedStyle", previousStyle], ["ResizeObserver", previousObserver]] as const) {
		if (descriptor) Object.defineProperty(globalThis, key, descriptor);
		else Reflect.deleteProperty(globalThis, key);
	}
});

function harness(fallback = "warning", language = "en", ready = true) {
	const registry = new CalloutRegistry();
	registry.load(null);
	const settings = { fallbackCalloutId: fallback, language };
	const calls: string[] = [];
	const disposers: (() => void)[] = [];
	const ctx = {
		app: {},
		display: () => calls.push("display"),
		registerDisposer: (dispose: () => void) => disposers.push(dispose),
		plugin: {
			registry, settings,
			restyleUncustomizedFallbackRows: () => calls.push("restyle"),
			saveSettings: () => { calls.push("save"); return Promise.resolve(); },
			refreshCallouts: () => calls.push("refresh"),
			locales: { isReady: () => ready },
			ensureLocale: () => { calls.push("ensureLocale"); return Promise.resolve(false); },
			applyLocaleChange: () => calls.push("applyLocaleChange"),
		},
	} as unknown as SettingsSectionContext;
	return { ctx, settings, calls, dispose: () => disposers.forEach((dispose) => dispose()) };
}

function resetButton(host: FakeElement): FakeElement {
	const button = host.querySelectorAll(".setting-item-control")
		.flatMap((control) => control.children)
		.find((child) => child.hasClass("clickable-icon"));
	assert.ok(button, "reset is in the setting's trailing control column");
	return button;
}

describe("settings row resets", () => {
	it("restores the fallback picker and repaints through the normal saved-change path", async () => {
		const h = harness();
		const host = el();
		try {
			renderFallbackSection(h.ctx, asEl(host));
			const reset = resetButton(host);
			assert.equal(reset.hasClass("cs-hidden"), false);
			reset.fire("click");
			assert.equal(h.settings.fallbackCalloutId, DEFAULT_SETTINGS.fallbackCalloutId);
			assert.equal(host.querySelector(".cs-combobox-input")?.value, "Note");
			assert.equal(reset.hasClass("cs-hidden"), true);
			await Promise.resolve();
			assert.deepEqual(h.calls, ["restyle", "save", "refresh"]);
		} finally { h.dispose(); }
	});

	it("opens default settings without a reset in the layout or a write", () => {
		const h = harness("note", "auto");
		try {
			for (const render of [renderFallbackSection, renderLanguageSection]) {
				const host = el();
				render(h.ctx, asEl(host));
				assert.equal(resetButton(host).hasClass("cs-hidden"), true);
			}
			assert.deepEqual(h.calls, []);
		} finally { h.dispose(); }
	});

	for (const ready of [true, false]) {
		it(`restores automatic language using the ${ready ? "cached" : "download"} locale path`, async () => {
			const h = harness("note", "en", ready);
			const host = el();
			try {
				renderLanguageSection(h.ctx, asEl(host));
				const reset = resetButton(host);
				assert.equal(reset.hasClass("cs-hidden"), false);
				reset.fire("click");
				assert.equal(h.settings.language, DEFAULT_SETTINGS.language);
				assert.equal(host.querySelector(".cs-combobox-input")?.value, t("settings.languageAuto"));
				assert.equal(reset.hasClass("cs-hidden"), true);
				await Promise.resolve();
				await Promise.resolve();
				assert.deepEqual(h.calls, ready
					? ["save", "display", "applyLocaleChange"]
					: ["save", "ensureLocale", "display"]);
			} finally { h.dispose(); setLocale("en"); }
		});
	}
});
