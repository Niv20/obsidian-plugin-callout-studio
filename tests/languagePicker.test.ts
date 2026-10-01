/**
 * tests/languagePicker.test.ts — the Language row: its width, what it shows,
 * when its reset arrow appears, what a pick saves, and the warning it shows
 * for a language that has not downloaded.
 *
 * The width rule is the one that regressed: the menu is exactly as wide as the
 * picker, so a column that shrank, or gave its room to the reset arrow, cut the
 * longest names short ("Bahasa Indone…"). The fake DOM has no layout, so the
 * geometry below is invented, and only the arithmetic and the order of the
 * reads are checked here. Whether the labels fit in Obsidian's real cascade was
 * checked in headless Chrome.
 *
 * There is no Automatic row. Following Obsidian (`"auto"`, still the saved
 * default) shows as the language Obsidian is in, and the arrow shows only
 * while the language on screen differs from it. `__CS_LANGUAGE__` plays
 * Obsidian's own language setting (see the obsidian stub).
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { getSelectableLocales, setLocale } from "../src/i18n";
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

type Mounted = { host: FakeElement; settings: { language: string }; calls: string[] };

function mount(language: string, ready = true): Mounted {
	const host = el();
	const settings = { language };
	const calls: string[] = [];
	const ctx = {
		app: {},
		display: () => calls.push("display"),
		registerDisposer: () => {},
		plugin: {
			settings,
			saveSettings: () => { calls.push("save"); return Promise.resolve(); },
			locales: { isReady: () => ready },
			ensureLocale: () => { calls.push("ensureLocale"); return Promise.resolve(false); },
			applyLocaleChange: () => calls.push("applyLocaleChange"),
		},
	} as unknown as SettingsSectionContext;
	renderLanguageSection(ctx, asEl(host));
	return { host, settings, calls };
}

function render(language: string, ready = true): FakeElement {
	return mount(language, ready).host;
}

/** Run `body` with Obsidian's own interface set to `language`. */
async function withObsidianIn(language: string, body: () => void | Promise<void>): Promise<void> {
	const seams = globalThis as { __CS_LANGUAGE__?: string };
	seams.__CS_LANGUAGE__ = language;
	try {
		await body();
	} finally {
		delete seams.__CS_LANGUAGE__;
		setLocale("en");
	}
}

function controlWidth(host: FakeElement): string {
	const control = host.querySelector(".cs-language-setting .setting-item-control");
	assert.ok(control);
	return control.style.getPropertyValue("--cs-language-control-width");
}

/** The closed picker's text. */
function face(host: FakeElement): string | undefined {
	return host.querySelector(".cs-combobox-input")?.value;
}

function resetOf(host: FakeElement): FakeElement {
	const reset = host.querySelector(".clickable-icon");
	assert.ok(reset);
	return reset;
}

const arrowShows = (host: FakeElement): boolean => !resetOf(host).hasClass("cs-hidden");

function openMenu(host: FakeElement): FakeElement[] {
	const control = host.querySelector(".cs-combobox-control");
	assert.ok(control);
	control.fire("mousedown");
	control.fire("click");
	return host.querySelectorAll(".cs-combobox-option");
}

function pick(host: FakeElement, name: string): void {
	const row = openMenu(host).find((option) => option.textContent === name);
	assert.ok(row, `${name} is offered`);
	row.fire("mousedown");
	row.fire("click");
}

/** Long enough for `setLanguage` to get past both of its awaits. */
async function settle(): Promise<void> {
	for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe("language picker", () => {
	it("reserves the reset arrow's room whether or not the arrow shows", () => {
		const host = render("auto");
		const labels = host.querySelector(".cs-language-width-sizer")?.children ?? [];
		assert.equal(labels.length > 1, true);
		const widest = Math.max(...labels.map(labelWidth));
		const expected = `${Math.ceil(widest + RESET_WIDTH + GAP)}px`;

		assert.equal(controlWidth(host), expected);
		// Measured, then put back: following Obsidian still shows no arrow.
		assert.equal(arrowShows(host), false);
		// One width for both states, so the arrow appearing never squeezes a label.
		assert.equal(controlWidth(render("he")), expected);
	});

	it("offers languages and nothing else, in the menu and in the sizer", () => {
		const host = render("auto");
		const names = getSelectableLocales().map((locale) => locale.name);
		assert.deepEqual(openMenu(host).map((row) => row.textContent), names);
		const sized = host.querySelector(".cs-language-width-sizer")?.children ?? [];
		assert.deepEqual(sized.map((label) => label.textContent), names);
	});

	it("shows the language Obsidian is in while following it", () =>
		withObsidianIn("he", () => {
			const { host, calls } = mount("auto");
			assert.equal(face(host), "עברית");
			assert.equal(arrowShows(host), false);
			assert.deepEqual(calls, [], "opening the tab writes nothing");
		}));

	it("shows English when Obsidian speaks a language the plugin lacks", () =>
		withObsidianIn("kl", () => {
			const host = render("auto");
			assert.equal(face(host), "English");
			assert.equal(arrowShows(host), false);
		}));

	it("shows an alias of Obsidian's language under the row that serves it", () =>
		withObsidianIn("zh-HK", () => {
			assert.equal(face(render("auto")), "繁體中文");
			assert.equal(arrowShows(render("zh-tw")), false);
		}));

	it("keeps a pinned language and offers the way back to Obsidian's", () =>
		withObsidianIn("he", () => {
			const { host, settings } = mount("fr");
			assert.equal(face(host), "Français");
			assert.equal(arrowShows(host), true);

			resetOf(host).fire("click");
			assert.equal(settings.language, "auto");
			assert.equal(face(host), "עברית");
			assert.equal(arrowShows(host), false);
		}));

	it("upgrades a pin of Obsidian's own language without an arrow or a rewrite", async () => {
		// Pinned back when the menu had an Automatic row. Nothing on screen tells
		// the two apart here, so there is nothing to reset.
		await withObsidianIn("he", () => {
			const { host, settings, calls } = mount("he");
			assert.equal(face(host), "עברית");
			assert.equal(arrowShows(host), false);
			assert.equal(settings.language, "he");
			assert.deepEqual(calls, []);
		});
		// The same synced value on a device whose Obsidian is in English.
		await withObsidianIn("en", () => {
			const host = render("he");
			assert.equal(face(host), "עברית");
			assert.equal(arrowShows(host), true);
		});
		await withObsidianIn("no", () => assert.equal(arrowShows(render("nb")), false));
	});

	it("follows Obsidian again when Obsidian's language is picked", () =>
		withObsidianIn("he", () => {
			const { host, settings } = mount("fr");
			pick(host, "עברית");
			assert.equal(settings.language, "auto");
			assert.equal(arrowShows(host), false);
		}));

	it("pins any other language and shows the arrow", () =>
		withObsidianIn("he", () => {
			for (const [name, code] of [["Français", "fr"], ["English", "en"]] as const) {
				const { host, settings } = mount("auto");
				pick(host, name);
				assert.equal(settings.language, code);
				assert.equal(face(host), name);
				assert.equal(arrowShows(host), true);
			}
		}));

	it("saves nothing when the language already shown is picked again", () =>
		withObsidianIn("he", () => {
			for (const saved of ["auto", "he"]) {
				const { host, settings, calls } = mount(saved);
				pick(host, "עברית");
				// A pin must not quietly become "follow Obsidian": a synced device
				// whose Obsidian is in another language would see the change.
				assert.equal(settings.language, saved);
				assert.deepEqual(calls, []);
			}
		}));

	it("retries a language still waiting for its download when it is picked again", async () => {
		const { host, settings, calls } = mount("fr", false);
		pick(host, "Français");
		await settle();
		assert.equal(settings.language, "fr");
		assert.deepEqual(calls, ["save", "ensureLocale", "display"]);
	});

	it("shows a saved value no row offers as English, and can reset it", () =>
		withObsidianIn("he", () => {
			// Written by a newer version on another device, or by hand.
			for (const saved of ["xx", "", "__proto__", "EN-gb"]) {
				const { host, settings, calls } = mount(saved);
				assert.equal(face(host), "English", saved);
				assert.equal(arrowShows(host), true, saved);
				assert.deepEqual(calls, [], saved);
				resetOf(host).fire("click");
				assert.equal(settings.language, "auto", saved);
			}
		}));

	it("names the missing language when following Obsidian into one not yet downloaded", () =>
		withObsidianIn("zh-HK", () => {
			const warning = render("auto", false).querySelector(".callout-studio-locale-warning");
			assert.ok(warning);
			// zh-hk is served by the Traditional Chinese file, listed as 繁體中文.
			assert.match(warning.textContent, /^繁體中文 /);
		}));
});
