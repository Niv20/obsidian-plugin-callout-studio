/**
 * tests/languagePicker.test.ts — the Language row's width, its Automatic row,
 * and the warning it shows for a language that has not downloaded.
 *
 * The width rule is the one that regressed: the menu is exactly as wide as the
 * picker, so a column that shrank, or gave its room to the reset arrow, cut the
 * longest names short ("Bahasa Indone…"). The fake DOM has no layout, so the
 * geometry below is invented, and only the arithmetic and the order of the
 * reads are checked here. Whether the labels fit in Obsidian's real cascade was
 * checked in headless Chrome.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { setLocale } from "../src/i18n";
import { renderLanguageSection } from "../src/settings/sections/LanguageSection";
import type { SettingsSectionContext } from "../src/settings/sections/types";
import { asEl, el, FakeElement } from "./support/fakeDom";

const RESET_WIDTH = 26;
const GAP = 8;
/** A label's invented width: 7px a character plus the sizer's own padding. */
const labelWidth = (label: FakeElement): number => label.textContent.length * 7 + 44;

const saved = {
	rect: Object.getOwnPropertyDescriptor(FakeElement.prototype, "getBoundingClientRect"),
	style: Object.getOwnPropertyDescriptor(globalThis, "getComputedStyle"),
	observer: Object.getOwnPropertyDescriptor(globalThis, "ResizeObserver"),
};

before(() => {
	// `display: none` has no box, like the real thing: a hidden reset arrow
	// measures 0, so a picker sized without un-hiding it would reserve nothing.
	Object.defineProperty(FakeElement.prototype, "getBoundingClientRect", {
		configurable: true,
		value(this: FakeElement): DOMRect {
			let width = 240;
			if (this.hasClass("cs-hidden")) width = 0;
			else if (this.hasClass("clickable-icon")) width = RESET_WIDTH;
			else if (this.parentElement?.hasClass("cs-language-width-sizer")) width = labelWidth(this);
			return { width } as DOMRect;
		},
	});
	Object.defineProperty(globalThis, "getComputedStyle", {
		configurable: true, value: () => ({ flexDirection: "row", columnGap: `${GAP}px` }),
	});
	Object.defineProperty(globalThis, "ResizeObserver", {
		configurable: true, value: class { observe(): void {} disconnect(): void {} },
	});
});

after(() => {
	if (saved.rect) Object.defineProperty(FakeElement.prototype, "getBoundingClientRect", saved.rect);
	for (const [key, descriptor] of [["getComputedStyle", saved.style], ["ResizeObserver", saved.observer]] as const) {
		if (descriptor) Object.defineProperty(globalThis, key, descriptor);
		else Reflect.deleteProperty(globalThis, key);
	}
});

function render(language: string, ready = true): FakeElement {
	const host = el();
	const ctx = {
		app: {},
		display: () => {},
		registerDisposer: () => {},
		plugin: {
			settings: { language },
			saveSettings: () => Promise.resolve(),
			locales: { isReady: () => ready },
			ensureLocale: () => Promise.resolve(false),
			applyLocaleChange: () => {},
		},
	} as unknown as SettingsSectionContext;
	renderLanguageSection(ctx, asEl(host));
	return host;
}

function controlWidth(host: FakeElement): string {
	const control = host.querySelector(".cs-language-setting .setting-item-control");
	assert.ok(control);
	return control.style.getPropertyValue("--cs-language-control-width");
}

function openMenu(host: FakeElement): FakeElement[] {
	const control = host.querySelector(".cs-combobox-control");
	assert.ok(control);
	control.fire("mousedown");
	control.fire("click");
	return host.querySelectorAll(".cs-combobox-option");
}

describe("language picker", () => {
	it("reserves the reset arrow's room whether or not the arrow shows", () => {
		const host = render("auto");
		const labels = host.querySelector(".cs-language-width-sizer")?.children ?? [];
		assert.equal(labels.length > 1, true);
		const widest = Math.max(...labels.map(labelWidth));
		const expected = `${Math.ceil(widest + RESET_WIDTH + GAP)}px`;

		assert.equal(controlWidth(host), expected);
		// Measured, then put back: Automatic still shows no reset arrow.
		assert.equal(host.querySelector(".clickable-icon")?.hasClass("cs-hidden"), true);
		// One width for both states, so the arrow appearing never squeezes a label.
		assert.equal(controlWidth(render("he")), expected);
	});

	it("gives only the Automatic row an icon and a sizer entry with room for it", () => {
		const host = render("auto");
		const autoLabels = host.querySelectorAll(".cs-language-width-sizer-auto");
		assert.deepEqual(autoLabels.map((label) => label.textContent), ["Automatic"]);

		const [first, ...languages] = openMenu(host);
		assert.ok(first);
		assert.equal(first.hasClass("cs-language-option-auto"), true);
		assert.ok(first.querySelector(".cs-language-option-icon"));
		assert.equal(languages.length > 0, true);
		for (const row of languages) {
			assert.equal(row.hasClass("cs-language-option-auto"), false, row.textContent);
			assert.equal(row.querySelector(".cs-language-option-icon"), null, row.textContent);
		}
	});

	it("names the missing language when Automatic follows a language not yet downloaded", () => {
		const win = globalThis.window as unknown as { moment?: unknown };
		const previous = win.moment;
		win.moment = { locale: () => "zh-HK" };
		try {
			const warning = render("auto", false).querySelector(".callout-studio-locale-warning");
			assert.ok(warning);
			// zh-hk is served by the Traditional Chinese file, listed as 繁體中文.
			assert.match(warning.textContent, /^繁體中文 /);
		} finally {
			win.moment = previous;
			setLocale("en");
		}
	});
});
