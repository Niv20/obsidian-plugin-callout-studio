/**
 * tests/pluginImportModal.test.ts — the Admonition and Callout Manager import
 * window, which both importers now share.
 *
 * It used to show two Import buttons at once — one inside the "This vault" row,
 * one in the footer that only read the paste box — and Admonition's "Choose
 * file…" imported the moment a file was picked. Later it split into two views
 * behind a Back arrow. What this file pins on the real window is the one screen
 * that replaced both: three options, each keeping what it was given, exactly
 * one of them active, and exactly one Import, in the footer, acting on that
 * one. The rule itself, as pure state, is tests/pluginImportFlow.test.ts.
 *
 * Each option is a single box that is its own button: the Choose file…, Paste
 * and Remove buttons that once sat on its edge are gone, and so is the "Import
 * from" tooltip the group's `aria-label` popped up over every box. A click on
 * a box chooses it when it holds something, and fills it — the picker, the
 * clipboard — when it is empty or already the active one.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Modal } from "obsidian";
import { getLocale, registerLocale, setLocale, t } from "../src/i18n";
import { en } from "../src/i18n/en";
import { he } from "../src/i18n/he";
import { ADMONITION_IMPORT } from "../src/settings/pluginImport/admonitionImportSource";
import { CALLOUT_MANAGER_IMPORT } from "../src/settings/pluginImport/calloutManagerImportSource";
import { fakeDom, type FakeElement } from "./support/fakeDom";
import {
	IMPORT,
	OPTIONS,
	active,
	announcer,
	assertOneImport,
	clipboard,
	fileInput,
	group,
	harness,
	importButton,
	option,
	optionTitle,
	paste,
	press,
	ready,
	recordingPlan,
	recordingSource,
	settle,
	stage,
	status,
	stubReport,
	type Harness,
} from "./support/pluginImportHarness";
import { savingWriter } from "./support/importSafetyStubs";

const FOUND = { dataJson: "[1, 2, 3]" };
const COPY = ADMONITION_IMPORT.copy;

/** A `text()` that resolves only when the suite says so. */
function deferredText(): { text: () => Promise<string>; resolve: (value: string) => void } {
	let resolve: (value: string) => void = () => {};
	const promise = new Promise<string>((r) => {
		resolve = r;
	});
	return { text: () => promise, resolve: (value) => resolve(value) };
}

/** The parts of a browser drag event the file option uses. */
function dragEvent(
	files: Array<{ name: string; text: () => Promise<string> }> = [],
	types: string[] = ["Files"],
	relatedTarget: FakeElement | null = null,
) {
	let prevented = false;
	return {
		dataTransfer: { files, types },
		relatedTarget,
		preventDefault: () => { prevented = true; },
		get defaultPrevented() { return prevented; },
	};
}

function badge(h: Harness, name: "vault" | "file" | "paste") {
	return option(h, name).querySelector(".cs-recommended-badge");
}

function classes(els: FakeElement[]): string[] {
	return els.map((el) => `${el.tagName}.${el.className}`);
}

/**
 * The boxes are the only thing in the options to press, and nothing there
 * pops up a tooltip. Obsidian shows any `[aria-label]` the pointer is inside as
 * a tooltip (it walks up with `matchParent("[aria-label]")`), which is how the
 * group's "Import from" came to hover over every box — so no `aria-label` on
 * or inside the options, nor on anything above them, and no `title` either,
 * the browser's own tooltip.
 */
function assertBoxesOnly(h: Harness, state: string): void {
	const options = group(h);
	assert.deepEqual(
		classes(options.querySelectorAll('button, [role="button"]')),
		[],
		`${state}: no button on any box`,
	);
	assert.deepEqual(
		classes(options.querySelectorAll("[aria-label], [title]")),
		[],
		`${state}: nothing inside the options shows a tooltip`,
	);
	for (let el: FakeElement | null = options; el; el = el.parentElement) {
		assert.equal(el.hasAttribute("aria-label"), false, `${state}: no aria-label above the boxes`);
	}
}

describe("the plugin import window: one Import", () => {
	it("keeps one Import, in the footer, through every state", async () => {
		const h = harness(FOUND);
		try {
			h.modal.onOpen();
			assert.equal(ready(assertOneImport(h)), false, "checking: nothing to import yet");

			await settle();
			assert.equal(ready(assertOneImport(h)), true, "found: Import is the vault's");

			await paste(h, "x");
			assert.equal(ready(assertOneImport(h)), true, "pasted");
			stage(h, "admonitions.json", () => Promise.resolve("y"));
			assert.equal(ready(assertOneImport(h)), true, "file staged");
		} finally {
			h.destroy();
		}
	});

	it("imports the vault's data, with no second click anywhere", async () => {
		const h = harness(FOUND);
		try {
			h.modal.onOpen();
			await settle();
			assert.equal(active(h), "vault");
			assert.equal(status(h, "vault").textContent, t(COPY.vaultFound, { count: 3 }));
			const btn = importButton(h);
			assert.ok(
				btn.getAttribute("aria-describedby")!.split(" ").includes(status(h, "vault").id),
				"Import is described by what it would import",
			);

			btn.fire("click");
			await settle();
			assert.deepEqual(h.rec.applied, ["vault"]);
			assert.equal(h.rec.after, 1, "afterApply runs once the window is closed");
			assert.ok(h.isClosed());
			assert.equal(h.displays(), 1);
		} finally {
			h.destroy();
		}
	});

	it("does nothing when a disabled Import is pressed", async () => {
		const h = harness();
		try {
			h.modal.onOpen();
			await settle();
			assert.equal(active(h), null);
			importButton(h).fire("click");
			await paste(h, "   ");
			importButton(h).fire("click");
			await settle();
			assert.deepEqual(h.rec.fromText, [], "whitespace is not something to import");
		} finally {
			h.destroy();
		}
	});

	it("starts one import however often Import is pressed", async () => {
		const h = harness(FOUND);
		try {
			h.modal.onOpen();
			await settle();
			const btn = importButton(h);
			btn.fire("click");
			btn.fire("click");
			btn.fire("click");
			await settle();
			assert.deepEqual(h.rec.planned, ["vault"]);
		} finally {
			h.destroy();
		}
	});
});

describe("the plugin import window: one screen", () => {
	it("shows all three options at once, with no Back and no second view", async () => {
		const h = harness(FOUND);
		try {
			h.modal.onOpen();
			await settle();
			assert.equal(optionTitle(h, "vault"), t(COPY.fromVault));
			assert.equal(optionTitle(h, "file"), t(COPY.fromFile));
			assert.equal(optionTitle(h, "paste"), t(COPY.fromPaste));
			assert.equal(h.headerEl.querySelector("button"), null, "nothing in the header but the title");
			assert.equal(h.contentEl.querySelector("textarea"), null, "the paste box reads the clipboard; there is no text field");
			assert.equal(h.contentEl.querySelector(".cs-link-btn"), null, "no way to another view");
			assert.equal(group(h).getAttribute("role"), "radiogroup");
		} finally {
			h.destroy();
		}
	});

	it("leaves Escape and the back gesture to Obsidian: there is no view to step back from", () => {
		const h = harness(FOUND);
		try {
			assert.equal("onHistoryBack" in h.modal, false);
			assert.equal("onEscapeKey" in h.modal, false);
		} finally {
			h.destroy();
		}
	});

	it("recommends the vault once its data is found, and makes it the active option", async () => {
		const h = harness(FOUND);
		try {
			h.modal.onOpen();
			assert.equal(badge(h, "vault"), null, "no recommendation before there is anything to recommend");
			assert.equal(option(h, "vault").getAttribute("aria-disabled"), "true", "not choosable while checking");
			assert.equal(option(h, "vault").hasClass("is-disabled"), false, "but not greyed out either");
			assert.equal(status(h, "vault").textContent, t(COPY.vaultChecking));
			option(h, "vault").fire("click");
			assert.equal(active(h), null, "clicking it while checking chooses nothing");

			await settle();
			const pill = badge(h, "vault");
			assert.ok(pill, "Recommended sits on the vault option");
			assert.equal(pill.textContent, t("settings.recommended"));
			// The word has a span of its own: that is what styles.css trims to
			// cap height, so it sits centred in the pill in a deep-descender face.
			assert.equal(
				pill.querySelector(".cs-recommended-badge-text")?.textContent,
				t("settings.recommended"),
			);
			assert.ok(pill.parentElement?.hasClass("cs-option-box-head"), "on its title line");
			assert.equal(badge(h, "file"), null);
			assert.equal(badge(h, "paste"), null);
			assert.equal(option(h, "vault").getAttribute("tabindex"), "0");
			assert.equal(active(h), "vault");
		} finally {
			h.destroy();
		}
	});

	it("keeps the vault disabled and says whether the plugin is missing, empty or unreadable", async () => {
		for (const base of [ADMONITION_IMPORT, CALLOUT_MANAGER_IMPORT]) {
			for (const [folderExists, dataJson, key] of [
				[false, undefined, base.copy.vaultNotInstalled],
				[true, undefined, base.copy.vaultEmpty],
				[true, "[]", base.copy.vaultEmpty],
				[true, "{}", base.copy.vaultEmpty],
				[true, "{not json", base.copy.vaultUnreadable],
				[true, '{"other": 1}', base.copy.vaultUnreadable],
			] as const) {
				const h = harness({ folderExists, dataJson, source: (rec) => recordingSource(rec, base) });
				try {
					h.modal.onOpen();
					await settle();
					const vault = option(h, "vault");
					assert.ok(vault.hasClass("is-disabled"), `${base.pluginId}: ${dataJson}: greyed out`);
					assert.ok(vault.querySelector(".cs-option-box-title"), "the title uses the shared disabled styling");
					assert.ok(vault.querySelector(".cs-option-box-desc"), "the status uses the shared disabled styling");
					assert.equal(vault.getAttribute("aria-disabled"), "true");
					assert.equal(vault.hasAttribute("tabindex"), false, "not a focus stop");
					assert.equal(status(h, "vault").textContent, t(key), "says why");
					assert.equal(announcer(h).textContent, t(key), "announces the same reason");
					assert.equal(status(h, "vault").hasClass("is-warning"), key === base.copy.vaultUnreadable);
					assert.equal(badge(h, "vault"), null, "nothing to recommend");
					vault.fire("click");
					assert.equal(active(h), null, "clicking it chooses nothing");
					for (const key of ["Enter", " "]) {
						assert.equal(press(vault, key), false, `${key}: disabled keys are not claimed`);
						assert.equal(active(h), null, `${key}: chooses nothing`);
					}
					assert.equal(ready(assertOneImport(h)), false);
					importButton(h).fire("click");
					await settle();
					assert.deepEqual(h.rec.applied, [], "disabled vault never imports");
				} finally {
					h.destroy();
				}
			}
		}
	});

	it("still imports a file or clipboard text when the plugin is not installed or its folder is empty", async () => {
		for (const base of [ADMONITION_IMPORT, CALLOUT_MANAGER_IMPORT]) {
			for (const folderExists of [false, true]) {
				for (const route of ["file", "paste"] as const) {
					const h = harness({ folderExists, source: (rec) => recordingSource(rec, base) });
					try {
						h.modal.onOpen();
						await settle();
						assert.equal(option(h, route).hasClass("is-disabled"), false);
						assert.equal(option(h, route).getAttribute("tabindex"), "0");
						if (route === "file") {
							option(h, "file").fire("click");
							assert.equal(h.pickerOpens(), 1);
							stage(h, "saved.json", () => Promise.resolve("saved"));
						} else {
							await paste(h, "saved");
						}
						assert.equal(active(h), route);
						assert.equal(ready(assertOneImport(h)), true);
						option(h, "vault").fire("click");
						assert.equal(active(h), route, "disabled vault does not steal the manual selection");
						importButton(h).fire("click");
						await settle();
						assert.deepEqual(h.rec.applied, ["text:saved"]);
					} finally {
						h.destroy();
					}
				}
			}
		}
	});

	it("falls back to English for a missing locale key while preserving translated messages", async () => {
		const previous = getLocale();
		try {
			const partial = { ...he };
			delete partial[ADMONITION_IMPORT.copy.vaultNotInstalled];
			delete partial[CALLOUT_MANAGER_IMPORT.copy.vaultNotInstalled];
			registerLocale("he", partial);
			setLocale("he");
			for (const base of [ADMONITION_IMPORT, CALLOUT_MANAGER_IMPORT]) {
				for (const folderExists of [false, true]) {
					const h = harness({ folderExists, source: (rec) => recordingSource(rec, base) });
					try {
						h.modal.onOpen();
						await settle();
						const expected = folderExists ? he[base.copy.vaultEmpty] : en[base.copy.vaultNotInstalled];
						assert.equal(status(h, "vault").textContent, expected);
						assert.equal(announcer(h).textContent, expected);
					} finally {
						h.destroy();
					}
				}
			}
		} finally {
			registerLocale("he", he);
			setLocale(previous);
		}
	});

	it("announces what the probe found", async () => {
		const h = harness({ dataJson: "[1, 2]" });
		try {
			h.modal.onOpen();
			assert.equal(announcer(h).getAttribute("aria-live"), "polite");
			assert.equal(announcer(h).textContent, "");
			await settle();
			assert.equal(announcer(h).textContent, t(COPY.vaultFound, { count: 2 }));
		} finally {
			h.destroy();
		}
	});
});

describe("the plugin import window: each box is its own button", () => {
	it("puts no button on any box, and nothing that shows a tooltip, whatever the boxes hold", async () => {
		const found = harness(FOUND);
		try {
			found.modal.onOpen();
			assertBoxesOnly(found, "checking");
			await settle();
			assertBoxesOnly(found, "vault found");
			stage(found, "a.json", () => Promise.resolve("file"));
			assertBoxesOnly(found, "file staged");
			await paste(found, "pasted");
			assertBoxesOnly(found, "pasted");
		} finally {
			found.destroy();
		}

		const absent = harness();
		try {
			absent.modal.onOpen();
			await settle();
			assertBoxesOnly(absent, "vault absent");
			await paste(absent, " ");
			assert.ok(status(absent, "paste").hasClass("is-warning"));
			assertBoxesOnly(absent, "clipboard empty");
			await paste(absent, new Error("NotAllowedError"));
			assertBoxesOnly(absent, "clipboard unreadable");
		} finally {
			absent.destroy();
		}

		const unreadable = harness({ dataJson: "{not json" });
		try {
			unreadable.modal.onOpen();
			await settle();
			assertBoxesOnly(unreadable, "vault unreadable");
		} finally {
			unreadable.destroy();
		}
	});

	it("names the options by the window's title, by reference rather than with an aria-label", async () => {
		for (const base of [ADMONITION_IMPORT, CALLOUT_MANAGER_IMPORT]) {
			const h = harness({ ...FOUND, source: (rec) => recordingSource(rec, base) });
			try {
				h.modal.onOpen();
				await settle();
				const options = group(h);
				assert.equal(options.hasAttribute("aria-label"), false, `${base.pluginId}: no "Import from" tooltip`);
				const id = options.getAttribute("aria-labelledby");
				assert.ok(id, `${base.pluginId}: the group is still named`);
				assert.deepEqual(h.modalEl.querySelectorAll(`#${id}`), [h.titleEl], "by the title, and only by it");
				assert.equal(h.titleEl.textContent, t(base.copy.title));

				// A redraw keeps the title's id rather than minting a second one.
				stage(h, "a.json", () => Promise.resolve("file"));
				assert.equal(group(h).getAttribute("aria-labelledby"), id);
				assert.equal(h.titleEl.id, id);
			} finally {
				h.destroy();
			}
		}
	});

	it("makes each box the radio itself: a focus stop while it can be chosen, disabled while it cannot", async () => {
		for (const [data, vaultChoosable] of [
			[FOUND.dataJson, true],
			[undefined, false],
			["{not json", false],
		] as const) {
			const h = harness({ dataJson: data });
			try {
				h.modal.onOpen();
				assert.equal(option(h, "vault").getAttribute("aria-disabled"), "true", `${data}: checking`);
				assert.equal(option(h, "vault").hasAttribute("tabindex"), false, `${data}: checking`);
				await settle();
				stage(h, "a.json", () => Promise.resolve("file"));
				for (const name of OPTIONS) {
					const box = option(h, name);
					const choosable = name !== "vault" || vaultChoosable;
					const what = `${data}: ${name}`;
					assert.equal(box.getAttribute("role"), "radio", what);
					assert.equal(box.getAttribute("tabindex"), choosable ? "0" : null, what);
					assert.equal(box.getAttribute("aria-disabled"), choosable ? null : "true", what);
					assert.ok(["true", "false"].includes(box.getAttribute("aria-checked") ?? ""), what);
					// Named by its own title line, described by its own status line.
					const head = box.querySelector(".cs-option-box-head");
					assert.ok(head && head.id !== "", what);
					assert.equal(box.getAttribute("aria-labelledby"), head.id, what);
					assert.equal(box.getAttribute("aria-describedby"), status(h, name).id, what);
					// The old inner radio wrapper is gone: nothing inside the box
					// takes a role or a focus stop of its own.
					assert.deepEqual(classes(box.querySelectorAll("[role], [tabindex]")), [], what);
				}
			} finally {
				h.destroy();
			}
		}
	});

	it("does from the keyboard what a click does: Enter and Space both fill and both choose", async () => {
		const h = harness(FOUND);
		try {
			h.modal.onOpen();
			await settle();

			// Fill: Enter on the empty file box opens the picker.
			assert.equal(press(option(h, "file"), "Enter"), true, "Enter is claimed");
			assert.equal(h.pickerOpens(), 1);
			assert.equal(active(h), "vault", "nothing picked yet");

			// Fill: Space on the empty paste box reads the clipboard.
			clipboard.set("typed");
			const reads = clipboard.reads();
			assert.equal(press(option(h, "paste"), " "), true, "Space is claimed, so it does not scroll the window");
			await settle();
			assert.equal(clipboard.reads(), reads + 1);
			assert.equal(active(h), "paste");

			// Choose: Enter on a filled box that is not active, Space on another.
			stage(h, "a.json", () => Promise.resolve("file"));
			assert.equal(active(h), "file");
			press(option(h, "paste"), "Enter");
			assert.equal(active(h), "paste");
			press(option(h, "vault"), " ");
			assert.equal(active(h), "vault");
			assert.equal(h.pickerOpens(), 1, "choosing opened no picker");
			assert.equal(clipboard.reads(), reads + 1, "and read no clipboard");

			// Enter on the file box chooses it; Space on it, now active, fills it
			// again — reopens the picker.
			press(option(h, "file"), "Enter");
			assert.equal(active(h), "file");
			assert.equal(h.pickerOpens(), 1);
			press(option(h, "file"), " ");
			assert.equal(h.pickerOpens(), 2);

			// Any other key is left alone.
			for (const key of ["a", "Tab", "ArrowDown", "Escape"]) {
				assert.equal(press(option(h, "vault"), key), false, key);
				assert.equal(press(option(h, "file"), key), false, key);
			}
			assert.equal(active(h), "file");
			assert.equal(h.pickerOpens(), 2);
		} finally {
			h.destroy();
		}
	});

	it("counts a double-click and a held key once, so switching back never fills the box again", async () => {
		const h = harness(FOUND);
		try {
			h.modal.onOpen();
			await settle();
			await paste(h, "held");
			stage(h, "a.json", () => Promise.resolve("file"));
			assert.equal(active(h), "file");

			// A double-click on the paste box: the first click chooses it, and the
			// second, landing on a box that is now active, must not read the
			// clipboard over the paste the user was switching back to.
			clipboard.set("copied later");
			const reads = clipboard.reads();
			const opens = h.pickerOpens();
			option(h, "paste").fire("click", { type: "click", detail: 1 });
			option(h, "paste").fire("click", { type: "click", detail: 2 });
			await settle();
			assert.equal(active(h), "paste");
			assert.equal(clipboard.reads(), reads, "the second click read nothing");

			// The same on the file box: chosen, and the picker not reopened.
			option(h, "file").fire("click", { type: "click", detail: 1 });
			option(h, "file").fire("click", { type: "click", detail: 2 });
			assert.equal(active(h), "file");
			assert.equal(h.pickerOpens(), opens, "the second click opened no picker");

			// Enter held down on the paste box: the first press chooses it; the
			// repeats are still claimed, so they don't scroll, but do nothing.
			assert.equal(press(option(h, "paste"), "Enter"), true);
			assert.equal(press(option(h, "paste"), "Enter", true), true, "a repeat is claimed");
			await settle();
			assert.equal(active(h), "paste");
			assert.equal(clipboard.reads(), reads, "no repeat read the clipboard");

			importButton(h).fire("click");
			await settle();
			assert.deepEqual(h.rec.fromText, ["held"], "Import took the paste the user switched back to");
		} finally {
			h.destroy();
		}
	});

	it("ignores every box while an import is running", async () => {
		const h = harness(FOUND);
		try {
			h.modal.onOpen();
			await settle();
			await paste(h, "held");
			const file = deferredText();
			stage(h, "slow.json", file.text);
			importButton(h).fire("click");

			const reads = clipboard.reads();
			for (const name of OPTIONS) {
				option(h, name).fire("click");
				press(option(h, name), "Enter");
			}
			await settle();
			assert.equal(h.pickerOpens(), 0, "no picker mid-import");
			assert.equal(clipboard.reads(), reads, "no clipboard read mid-import");
			assert.equal(active(h), "file", "and no change of choice under the running import");

			file.resolve("from-file");
			await settle();
			assert.deepEqual(h.rec.fromText, ["from-file"]);
			assert.deepEqual(h.rec.applied, ["text:from-file"]);
		} finally {
			h.destroy();
		}
	});

	it("puts focus back on the same box when the options are redrawn", async () => {
		const h = harness(FOUND);
		try {
			h.modal.onOpen();
			// The probe redraws the options when it settles.
			const before = option(h, "file");
			before.focus();
			await settle();
			assert.notEqual(option(h, "file"), before, "redrawn");
			assert.equal(fakeDom.document.activeElement, option(h, "file"), "the probe keeps focus on the file box");
			assert.equal(option(h, "file").lastFocusOptions?.preventScroll, true);

			// So does a first paste that brings nothing back.
			const box = option(h, "paste");
			box.focus();
			await paste(h, "");
			assert.notEqual(option(h, "paste"), box, "redrawn, to show why");
			assert.equal(fakeDom.document.activeElement, option(h, "paste"), "and focus is still on the paste box");
		} finally {
			h.destroy();
		}
	});
});

describe("the plugin import window: choosing an option", () => {
	it("keeps a staged file while another option is chosen, and imports only the active one", async () => {
		const h = harness(FOUND);
		try {
			h.modal.onOpen();
			await settle();
			stage(h, "mine.json", () => Promise.resolve("from-file"));
			assert.equal(active(h), "file");

			option(h, "vault").fire("click");
			assert.equal(active(h), "vault");
			assert.equal(optionTitle(h, "file"), "mine.json", "the file is still staged");
			assert.ok(option(h, "file").hasClass("is-filled"));

			option(h, "file").fire("click");
			assert.equal(active(h), "file");
			importButton(h).fire("click");
			await settle();
			assert.deepEqual(h.rec.fromText, ["from-file"]);
			assert.deepEqual(h.rec.applied, ["text:from-file"], "the file, not the vault");
		} finally {
			h.destroy();
		}
	});

	it("keeps a paste and a file side by side, and Import follows the choice", async () => {
		const h = harness();
		try {
			h.modal.onOpen();
			await settle();
			await paste(h, "pasted");
			stage(h, "a.json", () => Promise.resolve("file"));
			assert.equal(active(h), "file", "the latest one filled is chosen");
			assert.ok(option(h, "paste").hasClass("is-filled"), "the paste survives");

			option(h, "paste").fire("click");
			assert.equal(active(h), "paste");
			importButton(h).fire("click");
			await settle();
			assert.deepEqual(h.rec.fromText, ["pasted"]);
		} finally {
			h.destroy();
		}
	});

	it("chooses a filled box that is not active, without opening the picker or reading the clipboard", async () => {
		const h = harness(FOUND);
		try {
			h.modal.onOpen();
			await settle();
			stage(h, "a.json", () => Promise.resolve("file"));
			await paste(h, "pasted");
			assert.equal(active(h), "paste");
			const reads = clipboard.reads();
			clipboard.set("not this");

			const fileBox = option(h, "file");
			fileBox.fire("click");
			assert.equal(active(h), "file");
			assert.equal(h.pickerOpens(), 0, "the staged file is chosen, not replaced");
			assert.equal(option(h, "file"), fileBox, "in place — no redraw");

			option(h, "paste").fire("click");
			await settle();
			assert.equal(active(h), "paste");
			assert.equal(clipboard.reads(), reads, "the held paste is chosen, not re-read");

			option(h, "vault").fire("click");
			assert.equal(active(h), "vault");

			assert.equal(optionTitle(h, "file"), "a.json");
			assert.equal(optionTitle(h, "paste"), t("import.pasted"));
			assert.equal(h.pickerOpens(), 0);
			assert.equal(clipboard.reads(), reads);
			assert.deepEqual(h.rec.fromText, [], "and choosing reads neither");
		} finally {
			h.destroy();
		}
	});

	it("switches the active option in place, so focus stays on what was pressed", async () => {
		const h = harness(FOUND);
		try {
			h.modal.onOpen();
			await settle();
			stage(h, "a.json", () => Promise.resolve("file"));
			const vault = option(h, "vault");
			vault.focus();
			press(vault, " ");
			assert.equal(active(h), "vault");
			assert.equal(option(h, "vault"), vault, "the same element — no redraw");
			assert.equal(fakeDom.document.activeElement, vault);
		} finally {
			h.destroy();
		}
	});

	it("fills an empty option when its box is clicked, rather than choosing an empty one", async () => {
		const h = harness(FOUND);
		try {
			h.modal.onOpen();
			await settle();
			option(h, "file").fire("click");
			assert.equal(h.pickerOpens(), 1, "the file option opens the picker");
			assert.equal(active(h), "vault", "and stays unchosen until a file is picked");

			clipboard.set("from-box");
			const reads = clipboard.reads();
			option(h, "paste").fire("click");
			await settle();
			assert.equal(clipboard.reads(), reads + 1, "the paste option reads the clipboard");
			assert.equal(active(h), "paste");
		} finally {
			h.destroy();
		}
	});

	it("lets the user's choice stand when the probe settles after it", async () => {
		const h = harness(FOUND);
		try {
			h.modal.onOpen();
			stage(h, "early.json", () => Promise.resolve("early"));
			assert.equal(active(h), "file");
			await settle();
			assert.ok(badge(h, "vault"), "the vault is found and recommended");
			assert.equal(active(h), "file", "but the file the user picked stays active");
			assert.equal(optionTitle(h, "file"), "early.json");
		} finally {
			h.destroy();
		}
	});
});

describe("the plugin import window: pasting", () => {
	it("reads the clipboard when its box is clicked, shows it pasted, and makes it the active option", async () => {
		const h = harness(FOUND);
		try {
			h.modal.onOpen();
			await settle();
			assert.equal(active(h), "vault");
			await paste(h, "styles");
			assert.deepEqual(h.rec.planned, [], "pasting imports nothing");
			assert.equal(active(h), "paste");
			assert.ok(option(h, "paste").hasClass("is-filled"), "drawn as the success state");
			assert.equal(optionTitle(h, "paste"), t("import.pasted"));
			assert.equal(status(h, "paste").textContent, t("import.fileReady"));
			assert.equal(fakeDom.document.activeElement, importButton(h), "focus lands on the next step");

			importButton(h).fire("click");
			await settle();
			assert.deepEqual(h.rec.fromText, ["styles"]);
			assert.deepEqual(h.rec.applied, ["text:styles"]);
		} finally {
			h.destroy();
		}
	});

	it("says so when the clipboard is empty, and stages nothing", async () => {
		const h = harness(FOUND);
		try {
			h.modal.onOpen();
			await settle();
			await paste(h, " \n ");
			assert.equal(active(h), "vault");
			assert.equal(option(h, "paste").hasClass("is-filled"), false);
			assert.equal(optionTitle(h, "paste"), t(COPY.fromPaste));
			assert.equal(status(h, "paste").textContent, t("import.clipboardEmpty"));
			assert.ok(status(h, "paste").hasClass("is-warning"));
			assert.equal(announcer(h).textContent, t("import.clipboardEmpty"));
		} finally {
			h.destroy();
		}
	});

	it("says so when the clipboard cannot be read, and a second click tries again", async () => {
		const h = harness();
		try {
			h.modal.onOpen();
			await settle();
			await paste(h, new Error("NotAllowedError"));
			assert.equal(active(h), null);
			assert.equal(status(h, "paste").textContent, t("import.clipboardUnreadable"));
			assert.equal(announcer(h).textContent, t("import.clipboardUnreadable"));
			await paste(h, "second try");
			assert.equal(active(h), "paste");
			assert.equal(status(h, "paste").hasClass("is-warning"), false, "the error goes once a paste works");
		} finally {
			h.destroy();
		}
	});

	it("reads the clipboard again from the active paste box, and the new text replaces the old", async () => {
		const h = harness();
		try {
			h.modal.onOpen();
			await settle();
			await paste(h, "old");
			assert.equal(active(h), "paste");
			await paste(h, "new");
			assert.equal(active(h), "paste");
			assert.ok(option(h, "paste").hasClass("is-filled"));
			assert.equal(status(h, "paste").textContent, t("import.fileReady"));
			assert.equal(fakeDom.document.activeElement, importButton(h), "focus lands on the next step again");

			importButton(h).fire("click");
			await settle();
			assert.deepEqual(h.rec.fromText, ["new"], "only the latest paste is imported");
			assert.deepEqual(h.rec.applied, ["text:new"]);
		} finally {
			h.destroy();
		}
	});

	it("keeps the paste it holds when reading the clipboard again brings nothing back", async () => {
		// An emptied clipboard, or a phone's paste prompt dismissed: there is
		// no way to empty the option on purpose any more, so neither may do it
		// by accident. The failure is only announced.
		for (const [failure, key] of [
			[" \n ", "import.clipboardEmpty"],
			[new Error("NotAllowedError"), "import.clipboardUnreadable"],
		] as const) {
			const h = harness(FOUND);
			try {
				h.modal.onOpen();
				await settle();
				await paste(h, "original");
				const box = option(h, "paste");
				box.focus();

				await paste(h, failure);
				assert.equal(active(h), "paste", `${key}: still the active option`);
				assert.equal(option(h, "paste"), box, `${key}: nothing redrawn`);
				assert.equal(fakeDom.document.activeElement, box, `${key}: focus stays on the box`);
				assert.ok(box.hasClass("is-filled"), key);
				assert.equal(optionTitle(h, "paste"), t("import.pasted"), key);
				assert.equal(status(h, "paste").textContent, t("import.fileReady"), `${key}: still ready`);
				assert.equal(status(h, "paste").hasClass("is-warning"), false, `${key}: no warning on the box`);
				assert.equal(announcer(h).textContent, t(key), `${key}: but it is announced`);
				assert.equal(ready(importButton(h)), true, key);

				importButton(h).fire("click");
				await settle();
				assert.deepEqual(h.rec.fromText, ["original"], `${key}: the held paste is what imports`);
			} finally {
				h.destroy();
			}
		}
	});

	it("draws nothing when the clipboard answers after the window closed", async () => {
		const h = harness(FOUND);
		try {
			h.modal.onOpen();
			await settle();
			clipboard.set("late");
			option(h, "paste").fire("click");
			h.modal.close();
			await settle();
			assert.equal(h.contentEl.children.length, 0);
		} finally {
			h.destroy();
		}
	});
});

describe("the plugin import window: files", () => {
	it("gives both plugins a file picker, and Callout Manager's takes copied styles as .css", () => {
		for (const [base, accept] of [
			[ADMONITION_IMPORT, ".json"],
			[CALLOUT_MANAGER_IMPORT, ".json,.css"],
		] as const) {
			const h = harness({ source: (rec) => recordingSource(rec, base) });
			try {
				h.modal.onOpen();
				assert.equal(fileInput(h).getAttribute("accept"), accept, base.pluginId);
			} finally {
				h.destroy();
			}
		}
	});

	it("stages a picked file instead of importing it", async () => {
		const h = harness();
		try {
			h.modal.onOpen();
			await settle();
			stage(h, "admonitions.json", () => Promise.resolve("from-file"));
			await settle();
			assert.deepEqual(h.rec.planned, [], "picking a file imports nothing");
			assert.equal(active(h), "file");
			const name = option(h, "file").querySelector(".cs-option-box-name")!;
			assert.equal(name.textContent, "admonitions.json");
			assert.equal(name.getAttribute("dir"), "auto");
			assert.equal(status(h, "file").textContent, t("import.fileReady"));
			assert.ok(importButton(h).getAttribute("aria-describedby")!.split(" ").includes(status(h, "file").id));
			assert.equal(fakeDom.document.activeElement, importButton(h), "focus lands on the next step, not the page");

			importButton(h).fire("click");
			await settle();
			assert.deepEqual(h.rec.fromText, ["from-file"]);
			assert.deepEqual(h.rec.applied, ["text:from-file"]);
		} finally {
			h.destroy();
		}
	});

	it("stages a dropped file for either plugin, then imports it only from the footer", async () => {
		for (const [base, name, contents] of [
			[ADMONITION_IMPORT, "admonitions.json", '{"admonitions":[]}'],
			[CALLOUT_MANAGER_IMPORT, "styles.css", ".callout[data-callout='tip'] { color: red; }"],
		] as const) {
			const h = harness({ ...FOUND, source: (rec) => recordingSource(rec, base) });
			try {
				h.modal.onOpen();
				await settle();
				assert.equal(active(h), "vault");
				let reads = 0;
				const box = option(h, "file");
				const event = dragEvent([{ name, text: () => {
					reads++;
					return Promise.resolve(contents);
				} }]);
				const title = box.querySelector(".cs-option-box-title");
				assert.ok(title);
				title.dispatchEvent(Object.assign(event, { type: "drop", bubbles: true }));
				assert.equal(event.defaultPrevented, true, `${base.pluginId}: the browser must not open the file`);
				assert.equal(h.pickerOpens(), 0, `${base.pluginId}: dropping does not open the picker`);
				assert.equal(active(h), "file", `${base.pluginId}: the dropped file becomes active`);
				assert.equal(optionTitle(h, "file"), name);
				assert.equal(status(h, "file").textContent, t("import.fileReady"));
				assert.equal(fakeDom.document.activeElement, importButton(h));
				assert.equal(reads, 0, `${base.pluginId}: dropping only stages`);
				assert.deepEqual(h.rec.fromText, []);
				assert.deepEqual(h.rec.planned, []);

				importButton(h).fire("click");
				await settle();
				assert.equal(reads, 1);
				assert.deepEqual(h.rec.fromText, [contents]);
				assert.deepEqual(h.rec.applied, [`text:${contents}`]);
			} finally {
				h.destroy();
			}
		}
	});

	it("shows a file drop target only while a file is over its box", async () => {
		const h = harness();
		try {
			h.modal.onOpen();
			await settle();
			const box = option(h, "file");
			const textDrag = dragEvent([], ["text/plain"]);
			box.fire("dragover", textDrag);
			assert.equal(textDrag.defaultPrevented, false, "a text drag is not a file");
			assert.equal(box.hasClass("is-drop-target"), false);

			const fileDrag = dragEvent();
			box.fire("dragover", fileDrag);
			assert.equal(fileDrag.defaultPrevented, true, "allow dropping a file");
			assert.equal(box.hasClass("is-drop-target"), true);
			box.fire("dragleave", dragEvent([], ["Files"], box.querySelector(".cs-option-box-title")));
			assert.equal(box.hasClass("is-drop-target"), true, "moving across children keeps the target highlighted");
			box.fire("dragleave", dragEvent([], ["Files"]));
			assert.equal(box.hasClass("is-drop-target"), false, "leaving the box clears the highlight");
		} finally {
			h.destroy();
		}
	});

	it("ignores non-file drops and stages only the first file from a multi-file drop", async () => {
		const h = harness(FOUND);
		try {
			h.modal.onOpen();
			await settle();
			const box = option(h, "file");
			const textDrop = dragEvent([], ["text/plain"]);
			box.fire("drop", textDrop);
			assert.equal(textDrop.defaultPrevented, false);
			assert.equal(active(h), "vault", "text cannot replace the vault choice");

			let secondReads = 0;
			const filesDrop = dragEvent([
				{ name: "first.json", text: () => Promise.resolve("first") },
				{ name: "second.json", text: () => {
					secondReads++;
					return Promise.resolve("second");
				} },
			]);
			box.fire("drop", filesDrop);
			assert.equal(filesDrop.defaultPrevented, true);
			assert.equal(optionTitle(h, "file"), "first.json");
			importButton(h).fire("click");
			await settle();
			assert.deepEqual(h.rec.fromText, ["first"]);
			assert.equal(secondReads, 0);
		} finally {
			h.destroy();
		}
	});

	it("a dropped file replaces a picked one without reading the old file", async () => {
		const h = harness();
		try {
			h.modal.onOpen();
			await settle();
			let firstReads = 0;
			stage(h, "picked.json", () => {
				firstReads++;
				return Promise.resolve("picked");
			});
			const drop = dragEvent([{ name: "dropped.json", text: () => Promise.resolve("dropped") }]);
			option(h, "file").fire("drop", drop);
			assert.equal(drop.defaultPrevented, true);
			assert.equal(optionTitle(h, "file"), "dropped.json");
			importButton(h).fire("click");
			await settle();
			assert.equal(firstReads, 0);
			assert.deepEqual(h.rec.fromText, ["dropped"]);
		} finally {
			h.destroy();
		}
	});

	it("prevents a file drop during import without replacing the file being read", async () => {
		const h = harness();
		try {
			h.modal.onOpen();
			await settle();
			const pending = deferredText();
			stage(h, "in-progress.json", pending.text);
			importButton(h).fire("click");
			const drop = dragEvent([{ name: "later.json", text: () => Promise.resolve("later") }]);
			option(h, "file").fire("drop", drop);
			assert.equal(drop.defaultPrevented, true, "the browser must not open a drop during import");
			assert.equal(optionTitle(h, "file"), "in-progress.json");
			pending.resolve("in-progress");
			await settle();
			assert.deepEqual(h.rec.fromText, ["in-progress"]);
		} finally {
			h.destroy();
		}
	});

	it("opens the picker again from the active file box, and a second file replaces the first", async () => {
		const h = harness(FOUND);
		try {
			h.modal.onOpen();
			await settle();
			let firstRead = 0;
			stage(h, "first.json", () => {
				firstRead++;
				return Promise.resolve("first");
			});
			assert.equal(fileInput(h).value, "", "cleared, so picking the same file again still fires change");
			assert.equal(active(h), "file");

			option(h, "file").fire("click");
			assert.equal(h.pickerOpens(), 1, "the active file box opens the picker");
			// A picker closed without a pick fires nothing: the first file stays.
			assert.equal(optionTitle(h, "file"), "first.json");
			assert.equal(active(h), "file");

			stage(h, "second.json", () => Promise.resolve("second"));
			assert.equal(optionTitle(h, "file"), "second.json");
			assert.equal(h.contentEl.querySelectorAll(".cs-option-box-name").length, 1, "one file staged, not two");
			assert.equal(active(h), "file");

			importButton(h).fire("click");
			await settle();
			assert.deepEqual(h.rec.fromText, ["second"]);
			assert.deepEqual(h.rec.applied, ["text:second"]);
			assert.equal(firstRead, 0, "the replaced file is never opened");
		} finally {
			h.destroy();
		}
	});
});

describe("the plugin import window: errors", () => {
	it("reports an unreadable paste and keeps it", async () => {
		const report = stubReport();
		const h = harness();
		try {
			h.modal.onOpen();
			await settle();
			await paste(h, "bad");
			importButton(h).fire("click");
			await settle();
			assert.deepEqual(report.seen, [{ fatal: true, keys: ["import.err.parseFailed"] }]);
			assert.equal(h.isClosed(), false);
			assert.equal(active(h), "paste");
			assert.equal(importButton(h).textContent, IMPORT, "Importing… only while importing");
			assert.equal(ready(importButton(h)), true);
		} finally {
			report.restore();
			h.destroy();
		}
	});

	it("reports a file that cannot be read", async () => {
		const report = stubReport();
		const h = harness();
		try {
			h.modal.onOpen();
			await settle();
			stage(h, "gone.json", () => Promise.reject(new Error("evicted")));
			importButton(h).fire("click");
			await settle();
			assert.deepEqual(report.seen, [{ fatal: true, keys: ["import.err.fileUnreadable"] }]);
		} finally {
			report.restore();
			h.destroy();
		}
	});
});

describe("the plugin import window: work that outlives it", () => {
	it("draws nothing when the probe settles after the window closed", async () => {
		const h = harness(FOUND);
		try {
			h.modal.onOpen();
			h.modal.close();
			await settle();
			assert.equal(h.contentEl.children.length, 0);
		} finally {
			h.destroy();
		}
	});

	it("reports nothing when a file is read after the window closed", async () => {
		const report = stubReport();
		const h = harness();
		try {
			h.modal.onOpen();
			await settle();
			const file = deferredText();
			stage(h, "slow.json", file.text);
			importButton(h).fire("click");
			h.modal.close();
			file.resolve("bad");
			await settle();
			assert.deepEqual(report.seen, []);
		} finally {
			report.restore();
			h.destroy();
		}
	});

	it("applies nothing when the window is closed while the import is planning", async () => {
		let release: () => void = () => {};
		const h = harness({
			...FOUND,
			source: (rec) => ({
				...recordingSource(rec),
				fromDataJson: () => ({
					size: 1,
					plan: () =>
						new Promise((resolve) => {
							release = () => resolve(recordingPlan("late", 1, rec));
						}),
				}),
			}),
		});
		try {
			h.modal.onOpen();
			await settle();
			importButton(h).fire("click");
			await settle();
			h.modal.close();
			release();
			await settle();
			assert.deepEqual(h.rec.applied, []);
		} finally {
			h.destroy();
		}
	});

	it("reopens clean: no staged file, no paste, nothing chosen", async () => {
		const h = harness(FOUND);
		try {
			h.modal.onOpen();
			await settle();
			stage(h, "old.json", () => Promise.resolve("old"));
			await paste(h, "old");
			h.modal.onClose();
			h.modal.onOpen();
			await settle();
			assert.equal(optionTitle(h, "file"), t(COPY.fromFile));
			assert.equal(optionTitle(h, "paste"), t(COPY.fromPaste));
			assert.equal(active(h), "vault");
		} finally {
			h.destroy();
		}
	});
});

/**
 * On a phone Obsidian's `Modal.close()` slides the window out and calls
 * `onClose` only afterwards, so the window has to count as closed from
 * `close()` itself. The stub's `Modal` has no `close`; these give it one that,
 * like the phone, does not call `onClose` yet.
 */
describe("the plugin import window: closing on a phone", () => {
	function slideOutClose(): { calls: () => number; restore: () => void } {
		const saved = Object.getOwnPropertyDescriptor(Modal.prototype, "close");
		let calls = 0;
		Object.defineProperty(Modal.prototype, "close", {
			configurable: true,
			writable: true,
			value() {
				calls++;
			},
		});
		return {
			calls: () => calls,
			restore: () => {
				if (saved) Object.defineProperty(Modal.prototype, "close", saved);
				else Reflect.deleteProperty(Modal.prototype, "close");
			},
		};
	}

	it("applies nothing that finishes planning while the window slides out", async () => {
		const phone = slideOutClose();
		let release: () => void = () => {};
		const h = harness({
			...FOUND,
			nativeClose: true,
			source: (rec) => ({
				...recordingSource(rec),
				fromDataJson: () => ({
					size: 1,
					plan: () =>
						new Promise((resolve) => {
							release = () => resolve(recordingPlan("late", 1, rec));
						}),
				}),
			}),
		});
		try {
			h.modal.onOpen();
			await settle();
			importButton(h).fire("click");
			await settle();
			h.modal.close();
			release();
			await settle();
			assert.deepEqual(h.rec.applied, []);
		} finally {
			phone.restore();
			h.destroy();
		}
	});

	it("does not re-arm Import while the window slides out after a successful import", async () => {
		const phone = slideOutClose();
		const h = harness({ ...FOUND, nativeClose: true });
		try {
			h.modal.onOpen();
			await settle();
			importButton(h).fire("click");
			await settle();
			assert.deepEqual(h.rec.applied, ["vault"]);
			assert.equal(phone.calls(), 1);
			assert.equal(importButton(h).textContent, t("import.importing"));
			assert.equal(ready(importButton(h)), false);
			importButton(h).fire("click");
			await settle();
			assert.deepEqual(h.rec.applied, ["vault"], "a second tap imports nothing");
		} finally {
			phone.restore();
			h.destroy();
		}
	});
});

describe("the plugin import window: keeping a way back", () => {
	it("saves a backup of this plugin's settings before applying", async () => {
		const h = harness(FOUND);
		try {
			h.modal.onOpen();
			await settle();
			importButton(h).fire("click");
			await settle();
			assert.deepEqual(h.rec.applied, ["vault"]);
			assert.equal(h.backups().length, 1);
		} finally {
			h.destroy();
		}
	});

	it("applies nothing while saving is paused, and keeps the window open to try again", async () => {
		const notices: string[] = [];
		(globalThis as { __CS_NOTICES__?: string[] }).__CS_NOTICES__ = notices;
		const h = harness({ ...FOUND, writer: { ...savingWriter(), isFrozen: true } });
		try {
			h.modal.onOpen();
			await settle();
			importButton(h).fire("click");
			await settle();
			assert.deepEqual(h.rec.applied, []);
			assert.equal(h.backups().length, 0);
			assert.ok(notices.includes(en["notice.blockedWhilePaused"]!));
			assert.equal(h.isClosed(), false);
			assert.equal(ready(importButton(h)), true);
		} finally {
			delete (globalThis as { __CS_NOTICES__?: string[] }).__CS_NOTICES__;
			h.destroy();
		}
	});
});
