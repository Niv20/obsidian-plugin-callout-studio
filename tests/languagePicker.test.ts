/**
 * tests/languagePicker.test.ts — the language menu behind the footer's globe:
 * what it lists, what it shows as chosen, what a pick saves, and how a
 * language that is not on the device is fetched: told in notices (Downloading…,
 * then the result, with Retry after a failure), never in the page.
 *
 * There is no Automatic row and no reset arrow. Following Obsidian (`"auto"`,
 * still the saved default) shows as the language Obsidian is in, and picking
 * Obsidian's language is the way back to following it. `__CS_LANGUAGE__` plays
 * Obsidian's own language setting (see the obsidian stub).
 *
 * (The globe as a tile of the footer is checked with the footer, in
 * declarativeMainPageGroups.test.ts; the width the old picker had to keep for
 * its longest name went with the Language row.)
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { getSelectableLocales, setLocale, t } from "../src/i18n";
import {
	applyLanguagePreference,
	drawLanguageMenu,
	tellMissingLanguage,
} from "../src/settings/sections/languagePicker";
import type { SettingsTabPlugin } from "../src/settings/sections/types";
import { WORK_ONE_PASS_MS } from "../src/ui/mascot/mascotNotices";
import { asEl, el, fakeDom, FakeElement } from "./support/fakeDom";
import { noticeButton } from "./support/noticeButton";
import { Notice, type MenuItemRecord } from "./support/obsidianStub";
import { dropdownButton, dropdownValue, openDropdownMenu, pickDropdown } from "./support/selectDropdown";

const notices: string[] = [];
(globalThis as unknown as { __CS_NOTICES__: string[] }).__CS_NOTICES__ = notices;
afterEach(() => {
	notices.length = 0;
});

type Mounted = { host: FakeElement; settings: { language: string }; calls: string[]; plugin: SettingsTabPlugin };

/** The language menu (the footer's globe, declarative/footerGroup.ts), drawn into `host`. */
function mount(language: string, ready = true): Mounted {
	const host = el();
	const settings = { language };
	const calls: string[] = [];
	const plugin = {
		settings,
		saveSettings: () => {
			calls.push("save");
			return Promise.resolve();
		},
		locales: { isReady: () => ready, prepare: () => Promise.resolve("missing") },
		settingsWriter: { isDestroyed: false },
		ensureLocale: () => {
			calls.push("ensureLocale");
			return Promise.resolve(false);
		},
		applyLocaleChange: () => calls.push("applyLocaleChange"),
	} as unknown as SettingsTabPlugin;
	drawLanguageMenu(asEl(host), plugin, (pref) => {
		void applyLanguagePreference(plugin, pref, () => calls.push("display"));
	});
	return { host, settings, calls, plugin };
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

/** The language shown as chosen (beside the globe). */
function face(host: FakeElement): string | undefined {
	return dropdownValue(asEl(host));
}

/** Open the language menu (Obsidian's `Menu`, recorded by the stub). */
function openMenu(host: FakeElement): MenuItemRecord[] {
	return openDropdownMenu(asEl(host)).items;
}

/** Click a language in the menu, as the user would. */
function pick(host: FakeElement, name: string): void {
	pickDropdown(asEl(host), name);
}

/** Long enough for everything already started to get past its awaits. */
function settle(): Promise<void> {
	return new Promise((resolve) => setImmediate(resolve));
}

describe("language menu", () => {
	it("is a globe with the language shown beside it, and no tooltip", () => {
		const host = render("auto");
		const button = dropdownButton(asEl(host));
		assert.equal(button.hasClass("cs-dropdown-control"), false, "not a field");
		assert.equal(button.querySelector(".dropdown-caret, .cs-dropdown-caret"), null, "no caret");
		assert.ok(button.querySelector(".cs-select-icon"), "an icon before the words");
		assert.equal(button.dataset.csTooltip, undefined, "the words are the name");
		assert.equal(host.querySelector(".cs-select-value")?.hasClass("cs-visually-hidden"), false);
		// An empty sizer would still take a gap's room beside the other tiles.
		assert.equal(host.querySelector(".cs-dropdown-width-sizer"), null);
	});

	it("offers languages and nothing else", () => {
		const host = render("auto");
		const names = getSelectableLocales().map((locale) => locale.name);
		assert.deepEqual(
			openMenu(host).map((item) => item.title),
			names,
		);
		// Obsidian's ✓ marks the language on screen: English, which the stub's
		// Obsidian speaks, while following it.
		assert.deepEqual(
			openMenu(host)
				.filter((item) => item.checked)
				.map((item) => item.title),
			["English"],
		);
	});

	it("shows the language Obsidian is in while following it", () =>
		withObsidianIn("he", () => {
			const { host, calls } = mount("auto");
			assert.equal(face(host), "עברית");
			assert.deepEqual(calls, [], "opening the tab writes nothing");
		}));

	it("shows English when Obsidian speaks a language the plugin lacks", () =>
		withObsidianIn("kl", () => {
			assert.equal(face(render("auto")), "English");
		}));

	it("shows an alias of Obsidian's language under the row that serves it", () =>
		withObsidianIn("zh-HK", () => {
			assert.equal(face(render("auto")), "繁體中文");
			assert.equal(face(render("zh-tw")), "繁體中文");
		}));

	it("keeps a pinned language as the one shown", () =>
		withObsidianIn("he", () => {
			const { host } = mount("fr");
			assert.equal(face(host), "Français");
			assert.deepEqual(
				openMenu(host)
					.filter((item) => item.checked)
					.map((item) => item.title),
				["Français"],
			);
		}));

	it("leaves a pin of Obsidian's own language alone, without a rewrite", async () => {
		// Pinned back when the menu had an Automatic row. Nothing on screen tells
		// the two apart here, and opening the tab must not turn it into "auto".
		await withObsidianIn("he", () => {
			const { host, settings, calls } = mount("he");
			assert.equal(face(host), "עברית");
			assert.equal(settings.language, "he");
			assert.deepEqual(calls, []);
		});
		// The same synced value on a device whose Obsidian is in English.
		await withObsidianIn("en", () => {
			assert.equal(face(render("he")), "עברית");
		});
	});

	it("follows Obsidian again when Obsidian's language is picked: the way back", () =>
		withObsidianIn("he", () => {
			const { host, settings } = mount("fr");
			pick(host, "עברית");
			assert.equal(settings.language, "auto");
			assert.equal(face(host), "עברית");
		}));

	it("pins any other language", () =>
		withObsidianIn("he", () => {
			for (const [name, code] of [
				["Français", "fr"],
				["English", "en"],
			] as const) {
				const { host, settings } = mount("auto");
				pick(host, name);
				assert.equal(settings.language, code);
				assert.equal(face(host), name);
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
		assert.deepEqual(
			notices,
			[t("locale.notDownloaded", { name: "Français" })],
			"told in a notice, not in the page",
		);
	});

	it("shows a saved value no row offers as English, and picking Obsidian's language puts it right", () =>
		withObsidianIn("he", () => {
			// Written by a newer version on another device, or by hand.
			for (const saved of ["xx", "", "__proto__", "EN-gb"]) {
				const { host, settings, calls } = mount(saved);
				assert.equal(face(host), "English", saved);
				assert.deepEqual(calls, [], saved);
				pick(host, "עברית");
				assert.equal(settings.language, "auto", saved);
			}
		}));
});

/** What a fetch of the chosen language is like, for {@link fetching}. */
interface FetchOptions {
	/** The language the plugin has saved, which is what the fetch is for. */
	language?: string;
	/** The language was cached on disk by an earlier session. */
	onDisk?: boolean;
	/** What `ensureLocale` settles to, one answer per call; the last one repeats. */
	ensures?: Array<boolean | Error>;
	/** The store is downloading the language (a launch fetch under way). */
	loading?: boolean;
}

/** A plugin whose language is not loaded yet, with a log of what it was asked. */
function fetching(options: FetchOptions = {}) {
	const calls: string[] = [];
	const answers = [...(options.ensures ?? [true])];
	let ready = false;
	const plugin = {
		settings: { language: options.language ?? "fr" },
		settingsWriter: { isDestroyed: false },
		saveSettings: () => {
			calls.push("save");
			return Promise.resolve();
		},
		locales: {
			isReady: () => ready,
			state: () => (options.loading ? "loading" : "absent"),
			// Reading the cache finds the language on disk, or does not.
			prepare: () => {
				calls.push("prepare");
				ready = options.onDisk ?? false;
				return Promise.resolve(ready ? "fresh" : "missing");
			},
		},
		ensureLocale: () => {
			calls.push("ensureLocale");
			const answer = answers.length > 1 ? answers.shift()! : answers[0]!;
			return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
		},
		applyLocaleChange: () => calls.push("applyLocaleChange"),
	};
	const asPlugin = plugin as unknown as SettingsTabPlugin;
	const apply = (pref: string): Promise<void> => applyLanguagePreference(asPlugin, pref, () => calls.push("display"));
	const open = (): void => tellMissingLanguage(asPlugin, () => calls.push("display"));
	return { plugin, calls, apply, open };
}

describe("a language that is not on the device", () => {
	it("is applied at once, with no notice, when an earlier session cached it", async () => {
		try {
			const { calls, apply } = fetching({ onDisk: true });
			await apply("fr");
			assert.deepEqual(
				calls,
				["save", "prepare", "display", "applyLocaleChange"],
				"read from disk, never fetched",
			);
			assert.deepEqual(notices, []);
		} finally {
			setLocale("en");
		}
	});

	it("is fetched under a notice that says it is downloaded", async () => {
		const { calls, apply } = fetching({ ensures: [true] });
		await apply("fr");
		assert.deepEqual(calls, ["save", "prepare", "ensureLocale", "display"]);
		assert.deepEqual(notices, [t("locale.downloaded")]);
	});

	it("says a failed fetch with the language's name and a Retry, which fetches again", async () => {
		const { calls, apply } = fetching({ ensures: [false, true] });
		await apply("fr");
		assert.deepEqual(notices, [t("locale.notDownloaded", { name: "Français" })]);
		// Long enough to reach the button.
		assert.ok((Notice.last?.duration ?? 0) >= 5000);
		noticeButton(Notice.last).fire("click", { type: "click", preventDefault: () => {} });
		await settle();
		assert.equal(calls.filter((call) => call === "ensureLocale").length, 2);
		assert.deepEqual(notices, [t("locale.notDownloaded", { name: "Français" }), t("locale.downloaded")]);
	});

	it("names a language Obsidian is followed into after the row the picker shows", () =>
		withObsidianIn("zh-HK", async () => {
			// zh-hk is served by the Traditional Chinese file, listed as 繁體中文.
			const { apply } = fetching({ language: "auto", ensures: [false] });
			await apply("auto");
			assert.deepEqual(notices, [t("locale.notDownloaded", { name: "繁體中文" })]);
		}));

	it("tells a fetch that threw as a failure, and keeps the console's record of it", async () => {
		const { apply } = fetching({ ensures: [new Error("disk full")] });
		const error = console.error;
		const logged: unknown[][] = [];
		console.error = (...args: unknown[]) => {
			logged.push(args);
		};
		try {
			await apply("fr");
		} finally {
			console.error = error;
		}
		assert.equal(logged.length, 1);
		assert.deepEqual(notices, [t("locale.notDownloaded", { name: "Français" })]);
	});

	it("is fetched once at a time: Retry pressed again while a fetch runs adds nothing", async () => {
		const { plugin, calls, apply } = fetching({ ensures: [false] });
		await apply("fr");
		const failed = Notice.last;
		// The retry's fetch is left waiting on its answer.
		let answer!: (arrived: boolean) => void;
		plugin.ensureLocale = () => {
			calls.push("ensureLocale");
			return new Promise<boolean>((resolve) => {
				answer = resolve;
			});
		};
		const press = () => noticeButton(failed).fire("click", { type: "click", preventDefault: () => {} });
		press();
		await settle();
		press();
		await settle();
		assert.equal(calls.filter((call) => call === "ensureLocale").length, 2, "the first try and one retry");
		answer(true);
		await settle();
		assert.deepEqual(notices, [t("locale.notDownloaded", { name: "Français" }), t("locale.downloaded")]);
	});

	it("keeps Downloading… up for one whole stroke of the brush, then tells the result after a pause", async () => {
		const globals = globalThis as Record<string, unknown>;
		const createEl = globals.createEl as (tag: string, options?: unknown) => FakeElement;
		// The mascot can only be drawn where Obsidian's `createSvg` is.
		globals.createSvg = (tag: string, options?: unknown) => createEl(tag, options);
		fakeDom.window.clearTimers();
		try {
			const { apply } = fetching({ ensures: [true] });
			const done = apply("fr");
			await settle();
			const downloading = Notice.last!;
			assert.equal(downloading.message, t("locale.downloading"));
			// The fetch was over at once, yet the notice stays for its minimum.
			assert.equal(downloading.hidden, false);
			assert.ok(WORK_ONE_PASS_MS > 0);
			fakeDom.window.flushTimers();
			await settle();
			assert.equal(downloading.hidden, true);
			assert.deepEqual(notices, [t("locale.downloading")], "the result waits for its pause");
			fakeDom.window.flushTimers();
			await done;
			assert.deepEqual(notices, [t("locale.downloading"), t("locale.downloaded")]);
		} finally {
			delete globals.createSvg;
			fakeDom.window.clearTimers();
			// The brush's frames end once its drawing has left the page, which it never was in.
			fakeDom.window.flushFrames();
		}
	});
});

describe("a language still missing when the settings open", () => {
	it("is told in a notice with Retry, which fetches it", async () => {
		const { calls, open } = fetching({ ensures: [true] });
		open();
		assert.deepEqual(notices, [t("locale.notDownloaded", { name: "Français" })]);
		noticeButton(Notice.last).fire("click", { type: "click", preventDefault: () => {} });
		await settle();
		assert.deepEqual(calls, ["ensureLocale", "display"], "fetched, with no cache read to repeat");
		assert.deepEqual(notices, [t("locale.notDownloaded", { name: "Français" }), t("locale.downloaded")]);
	});

	it("names the language Obsidian is followed into, after the row the picker shows", () =>
		withObsidianIn("zh-HK", () => {
			fetching({ language: "auto" }).open();
			assert.deepEqual(notices, [t("locale.notDownloaded", { name: "繁體中文" })]);
		}));

	it("says nothing while the launch's own fetch is still under way", () => {
		fetching({ loading: true }).open();
		assert.deepEqual(notices, []);
	});

	it("says nothing for English, which is always here", () => {
		fetching({ language: "en" }).open();
		assert.deepEqual(notices, []);
	});

	it("says nothing once the language is on the device", async () => {
		const { open, apply } = fetching({ onDisk: true });
		await apply("fr");
		open();
		assert.deepEqual(notices, []);
		setLocale("en");
	});
});
