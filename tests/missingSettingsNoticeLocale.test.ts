import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { registerLocaleFile, setLocale } from "../src/i18n";
import { he } from "../src/i18n/he";
import { en } from "../src/i18n/en";
import { LocaleStore } from "../src/i18n/LocaleStore";
import { registerMissingSettingsNotice } from "../src/manager/settingsNotices";
import { Notice } from "./support/obsidianStub";
import { FakeElement, type FakeDocumentFragment } from "./support/fakeDom";
import { recoveryActionHarness } from "./support/recoveryActionHarness";
import { readRepoFile } from "./support/sourceScan";

function noticeNodes(notice: Notice) {
	const nodes = (notice.message as FakeDocumentFragment).childNodes;
	return {
		text: nodes.find((node): node is FakeElement => node instanceof FakeElement && node.tagName.toLowerCase() === "p")!,
		action: nodes.find((node): node is FakeElement => node instanceof FakeElement && node.hasClass("cs-notice-action"))!,
	};
}

describe("the missing settings notice follows the UI language", () => {
	it("waits for recovery and the cached Hebrew locale before announcing missing settings", async () => {
		const h = recoveryActionHarness({ missing: true, legacy: true });
		const cleanups: (() => void)[] = [];
		const locales = new LocaleStore(h.host.app, h.host.manifest);
		setLocale("en");
		const before = Notice.last;
		h.state.checkpoint = { settings: { ...h.host.registry.settings, language: "he" }, callouts: [] };
		h.files.set(locales.filePath("he"), readRepoFile("locales/he.json"));
		try {
			await h.boot();
			assert.equal(Notice.last, before, "boot must not snapshot English before locale preparation");
			assert.equal(h.host.registry.settings.language, "he");
			await locales.prepare(h.host.registry.settings.language);
			setLocale(h.host.registry.settings.language);
			registerMissingSettingsNotice({ ...h.host, register: cleanup => { cleanups.push(cleanup); } });
			const nodes = noticeNodes(Notice.last!);
			assert.equal(nodes.text.textContent, he["saveStatus.missingNotice"]);
			assert.equal(nodes.action.textContent, he["saveStatus.openSettings"]);
			assert.equal(h.state.writes, 0);
			cleanups[0]!();
			assert.equal(Notice.last!.hidden, true, "unload must close the persistent notice");
		} finally {
			for (const cleanup of cleanups) cleanup();
			locales.destroy(); h.host.settingsWriter.destroy(); setLocale("en");
		}
	});

	it("updates both existing text nodes after a late locale arrives without reopening a dismissed notice", () => {
		const h = recoveryActionHarness();
		const cleanups: (() => void)[] = [];
		setLocale("en");
		try {
			h.host.settingsWriter.freeze("missing");
			const refresh = registerMissingSettingsNotice({ ...h.host, register: cleanup => { cleanups.push(cleanup); } });
			const notice = Notice.last!;
			const nodes = noticeNodes(notice);
			assert.equal(nodes.text.textContent, en["saveStatus.missingNotice"]);
			registerLocaleFile("he", he); setLocale("he"); refresh();
			assert.equal(Notice.last, notice);
			assert.equal(nodes.text.textContent, he["saveStatus.missingNotice"]);
			assert.equal(nodes.action.textContent, he["saveStatus.openSettings"]);
			notice.hide(); setLocale("en"); refresh();
			assert.equal(notice.hidden, true);
			assert.equal(Notice.last, notice);
		} finally {
			for (const cleanup of cleanups) cleanup();
			h.host.settingsWriter.destroy(); setLocale("en");
		}
	});

	it("does not announce a provisional pause, a file that already returned, or an unloaded session", () => {
		const h = recoveryActionHarness();
		let registrations = 0;
		const host = { ...h.host, register: () => { registrations++; } };
		const before = Notice.last;
		try {
			h.host.settingsWriter.freeze("missing", false); registerMissingSettingsNotice(host);
			h.host.settingsWriter.thaw(); registerMissingSettingsNotice(host);
			h.host.settingsWriter.freeze("missing"); h.host.settingsWriter.destroy(); registerMissingSettingsNotice(host);
			assert.equal(Notice.last, before);
			assert.equal(registrations, 0);
		} finally { h.host.settingsWriter.destroy(); }
	});

	it("wires announcement after cached locale selection and refreshes it with other locale surfaces", () => {
		const main = readRepoFile("src/main.ts");
		const prepare = main.indexOf("await this.locales.prepare(this.settings.language)");
		const select = main.indexOf("setLocale(this.settings.language)", prepare);
		const announce = main.indexOf("registerMissingSettingsNotice(this)");
		assert.ok(prepare >= 0 && select > prepare && announce > select);
		assert.match(main, /applyLocaleChange\(\): void \{\s*this\.refreshMissingSettingsNotice\(\)/);
	});
});
