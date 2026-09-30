/**
 * tests/pluginImportModal.test.ts — the Admonition and Callout Manager import
 * window, which both importers share.
 *
 * It used to show two Import buttons at once — one inside the "This vault" row,
 * one in the footer that only read the paste box — and Admonition's "Choose
 * file…" imported the moment a file was picked. Later it split into views
 * behind a Back arrow, became boxes that were their own buttons (one of which
 * read the clipboard the moment it was clicked), and then one view at a time
 * behind a small link. What this file pins on the real window is what it is
 * now:
 *
 * - **One screen.** "This vault" and the source's one fallback — a file card
 *   for Admonition, a paste card for Callout Manager — are both there whenever
 *   the other plugin's data is found. When it is not, the vault card is simply
 *   gone: no greyed-out card, and no line saying the plugin isn't installed.
 * - **Exactly one Import**, in the footer, acting on the active option — the
 *   one wearing the ring. The rule itself, as pure state, is
 *   tests/pluginImportFlow.test.ts.
 * - **Every action has a button that says what it does.** A file is uploaded
 *   with Upload, which is the same button that then reads Replace, and a
 *   notice — not a green icon — says which happened. The text box is filled by
 *   the user, or by the Paste button: the only thing that reads the clipboard.
 *
 * `harness()` is Admonition's window (a file); `pasteHarness()` is Callout
 * Manager's (pasted text).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Modal } from "obsidian";
import { t } from "../src/i18n";
import { en } from "../src/i18n/en";
import { ADMONITION_IMPORT } from "../src/settings/pluginImport/admonitionImportSource";
import { CALLOUT_MANAGER_IMPORT } from "../src/settings/pluginImport/calloutManagerImportSource";
import { fakeDom, type FakeElement } from "./support/fakeDom";
import {
	IMPORT,
	actionButton,
	active,
	announcer,
	assertOneImport,
	clipboard,
	fileInput,
	group,
	harness,
	importButton,
	option,
	options,
	optionTitle,
	pasteBox,
	pasteHarness,
	pasteSource,
	press,
	pressPaste,
	radio,
	ready,
	recordingPlan,
	recordingSource,
	settle,
	stage,
	status,
	stubReport,
	typeText,
	type Harness,
	type HarnessOptions,
} from "./support/pluginImportHarness";
import { savingWriter } from "./support/importSafetyStubs";

const FOUND = { dataJson: "[1, 2, 3]" };
/** Admonition's copy: the window `harness()` opens. */
const COPY = ADMONITION_IMPORT.copy;
/** Callout Manager's copy: the window `pasteHarness()` opens. */
const PASTE_COPY = CALLOUT_MANAGER_IMPORT.copy;

/**
 * Both windows, each with the way its fallback is filled: a file uploaded for
 * Admonition's, text typed into the box for Callout Manager's. `text` is what
 * Import then hands to the source.
 */
const WINDOWS: ReadonlyArray<{
	name: "file" | "paste";
	base: typeof ADMONITION_IMPORT;
	open: (options?: HarnessOptions) => Harness;
	fill: (h: Harness, text: string) => void;
}> = [
	{
		name: "file",
		base: ADMONITION_IMPORT,
		open: harness,
		fill: (h, text) => stage(h, "a.json", () => Promise.resolve(text)),
	},
	{
		name: "paste",
		base: CALLOUT_MANAGER_IMPORT,
		open: pasteHarness,
		fill: (h, text) => typeText(h, text),
	},
];

/** The vault turning up nothing, the three ways it can, as the probe sees them. */
const NOTHING = [
	[false, undefined],
	[true, undefined],
	[true, "[]"],
	[true, "{}"],
	[true, "{not json"],
	[true, '{"other": 1}'],
] as const;

/** Every sentence the window once used to say why the vault had nothing. */
const REASONS = [
	"Callout Manager isn't installed in this vault.",
	"No customized callouts were found in this vault.",
	"Callout Manager's settings file in this vault could not be read.",
	"Admonition isn't installed in this vault.",
	"No custom admonitions were found in this vault.",
	"Admonition's settings file in this vault could not be read.",
];

/** A `text()` that resolves only when the suite says so. */
function deferredText(): { text: () => Promise<string>; resolve: (value: string) => void } {
	let resolve: (value: string) => void = () => {};
	const promise = new Promise<string>((r) => {
		resolve = r;
	});
	return { text: () => promise, resolve: (value) => resolve(value) };
}

/** The parts of a browser drag event the file card uses. */
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

/** A click as the card's listener sees it when it landed on `target`, inside it. */
function clickOn(card: FakeElement, target: FakeElement): void {
	card.fire("click", { type: "click", target });
}

/** Collect every notice raised while `run` is running. */
async function notices(run: (seen: string[]) => void | Promise<void>): Promise<void> {
	const seams = globalThis as { __CS_NOTICES__?: string[] };
	const seen: string[] = [];
	seams.__CS_NOTICES__ = seen;
	try {
		await run(seen);
	} finally {
		delete seams.__CS_NOTICES__;
	}
}

/**
 * Nothing in the options pops up a tooltip. Obsidian shows any `[aria-label]`
 * the pointer is inside as a tooltip (it walks up with
 * `matchParent("[aria-label]")`), which is how a group's "Import from" once
 * came to hover over every box — so no `aria-label` in the options, nor on
 * anything above them, and no `title` either, the browser's own tooltip.
 */
function assertNoTooltips(h: Harness, state: string): void {
	assert.deepEqual(
		classes(group(h).querySelectorAll("[aria-label], [title]")),
		[],
		`${state}: nothing in the options shows a tooltip`,
	);
	for (let el: FakeElement | null = group(h); el; el = el.parentElement) {
		assert.equal(el.hasAttribute("aria-label"), false, `${state}: no aria-label above the options`);
	}
}

describe("the plugin import window: one Import", () => {
	it("keeps one Import, in the footer, through every state", async () => {
		for (const { name, open, fill } of WINDOWS) {
			const h = open(FOUND);
			try {
				h.modal.onOpen();
				assert.equal(ready(assertOneImport(h)), false, `${name}: checking: nothing to import yet`);

				await settle();
				assert.equal(ready(assertOneImport(h)), true, `${name}: found: Import is the vault's`);

				fill(h, "x");
				assert.equal(ready(assertOneImport(h)), true, `${name}: filled`);
			} finally {
				h.destroy();
			}
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

	it("imports nothing when a disabled Import is pressed, and says what to fill first", async () => {
		for (const { name, open } of WINDOWS) {
			await notices(async (seen) => {
				const h = open();
				try {
					h.modal.onOpen();
					importButton(h).fire("click");
					assert.deepEqual(seen, [], `${name}: nothing said while the vault may yet turn up`);
					await settle();
					assert.equal(ready(importButton(h)), false);
					assert.equal(importButton(h).hasAttribute("aria-describedby"), false, "nothing to describe yet");
					importButton(h).fire("click");
					if (name === "paste") {
						typeText(h, "   ");
						importButton(h).fire("click");
					}
					await settle();
					const first = t(name === "file" ? "import.uploadFirst" : "import.pasteFirst");
					assert.deepEqual(seen, name === "file" ? [first] : [first, first], `${name}: one notice per press`);
					assert.deepEqual(h.rec.fromText, [], "whitespace is not something to import");
					assert.deepEqual(h.rec.planned, []);
				} finally {
					h.destroy();
				}
			});
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
	it("shows the vault and the fallback together when the vault has data, with no way to another view", async () => {
		for (const { name, base, open } of WINDOWS) {
			const h = open(FOUND);
			try {
				h.modal.onOpen();
				await settle();
				assert.deepEqual(options(h), ["vault", name], `${name}: both, the vault first`);
				assert.equal(optionTitle(h, "vault"), t(base.copy.fromVault));
				assert.equal(status(h, "vault").textContent, t(base.copy.vaultFound, { count: 3 }));
				assert.equal(optionTitle(h, name), t(base.copy.manual));
				assert.equal(status(h, name).textContent, t(base.copy.manualDesc));
				assert.equal(h.headerEl.querySelector("button"), null, "nothing in the header but the title");
				assert.equal(h.contentEl.querySelector(".cs-link-btn"), null, "no link to a second view");
				assert.equal(active(h), "vault", "the vault is what Import would act on");
				assertNoTooltips(h, `${name}: found`);
			} finally {
				h.destroy();
			}
		}
	});

	it("recommends the vault once its data is found, and holds its card back while still looking", async () => {
		const h = harness(FOUND);
		try {
			h.modal.onOpen();
			const vault = option(h, "vault");
			assert.ok(vault.hasClass("is-checking"), "held back, so a fast probe never flashes it");
			assert.equal(status(h, "vault").textContent, t(COPY.vaultChecking));
			assert.equal(badge(h, "vault"), null, "no recommendation before there is anything to recommend");
			vault.fire("click");
			assert.equal(active(h), null, "clicking it while checking chooses nothing");

			await settle();
			assert.equal(option(h, "vault"), vault, "the same card, written in place");
			assert.equal(vault.hasClass("is-checking"), false);
			const pill = badge(h, "vault");
			assert.ok(pill, "Recommended sits on the vault option");
			assert.equal(pill.textContent, t("settings.recommended"));
			assert.ok(pill.parentElement?.hasClass("cs-option-box-head"), "on its title line");
			assert.equal(badge(h, "file"), null);
			assert.equal(active(h), "vault");

			// Another change of state does not stack a second pill.
			stage(h, "a.json", () => Promise.resolve("x"));
			assert.equal(option(h, "vault").querySelectorAll(".cs-recommended-badge").length, 1);
		} finally {
			h.destroy();
		}
	});

	it("shows only the fallback, and says nothing about the vault, when the plugin is missing, empty or unreadable", async () => {
		for (const { name, base, open } of WINDOWS) {
			for (const [folderExists, dataJson] of NOTHING) {
				const what = `${base.pluginId}: ${folderExists}: ${dataJson}`;
				const h = open({ folderExists, dataJson });
				try {
					h.modal.onOpen();
					await settle();
					assert.deepEqual(options(h), [name], `${what}: the vault card is gone, not greyed out`);
					assert.equal(h.contentEl.querySelector(".is-disabled"), null, what);
					for (const reason of REASONS) {
						assert.equal(h.modalEl.textContent.includes(reason), false, `${what}: does not say "${reason}"`);
					}
					assert.equal(h.modalEl.textContent.includes(t(base.copy.vaultChecking)), false, what);
					assert.equal(announcer(h).textContent, "", `${what}: and announces nothing either`);

					// Alone, there is nothing to choose between.
					assert.equal(radio(h, name), null, `${what}: no radio dot`);
					assert.equal(group(h).hasAttribute("role"), false, `${what}: not a radio group`);
					assert.equal(option(h, name).hasClass("is-selected"), false, what);
					assert.equal(ready(assertOneImport(h)), false);
					assertNoTooltips(h, what);

					importButton(h).fire("click");
					await settle();
					assert.deepEqual(h.rec.applied, [], `${what}: an empty fallback never imports`);
				} finally {
					h.destroy();
				}
			}
		}
	});

	it("still imports an uploaded file or pasted text when the vault holds nothing", async () => {
		for (const { name, open, fill } of WINDOWS) {
			for (const folderExists of [false, true]) {
				const h = open({ folderExists });
				try {
					h.modal.onOpen();
					await settle();
					fill(h, "saved");
					assert.equal(ready(assertOneImport(h)), true);
					assert.equal(option(h, name).hasClass("is-selected"), false, "no ring on the only option");
					importButton(h).fire("click");
					await settle();
					assert.deepEqual(h.rec.applied, ["text:saved"]);
				} finally {
					h.destroy();
				}
			}
		}
	});

	it("offers a file for Admonition and a text box for Callout Manager, and never both", async () => {
		assert.deepEqual(ADMONITION_IMPORT.manual, { kind: "file", accept: ".json" });
		assert.deepEqual(CALLOUT_MANAGER_IMPORT.manual, { kind: "paste", placeholder: "import.cmPlaceholder" });
		assert.equal(COPY.manual, "import.admFromFile");
		assert.equal(PASTE_COPY.manual, "import.cmFromPaste");

		const file = harness(FOUND);
		try {
			file.modal.onOpen();
			await settle();
			assert.equal(file.contentEl.querySelector("textarea"), null, "no text box in the file window");
			assert.equal(actionButton(file).textContent, t("import.upload"));
			const reads = clipboard.reads();
			actionButton(file).fire("click");
			await settle();
			assert.equal(file.pickerOpens(), 1);
			assert.equal(clipboard.reads(), reads, "a file window leaves the clipboard alone");
		} finally {
			file.destroy();
		}

		const pasted = pasteHarness(FOUND);
		try {
			pasted.modal.onOpen();
			await settle();
			assert.equal(pasted.contentEl.querySelector('input[type="file"]'), null, "no file input at all");
			assert.equal(actionButton(pasted).textContent, t("import.pasteButton"));
			await pressPaste(pasted, "styles");
			assert.equal(pasted.pickerOpens(), 0);
		} finally {
			pasted.destroy();
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

	it("draws everything once: nothing the user is in is ever replaced", async () => {
		for (const { name, open, fill } of WINDOWS) {
			for (const data of [FOUND.dataJson, undefined]) {
				const h = open({ dataJson: data });
				try {
					h.modal.onOpen();
					const card = option(h, name);
					const button = actionButton(h);
					// Before the probe answers, the fallback is already usable.
					fill(h, "early");
					if (name === "paste") pasteBox(h).focus();
					await settle();
					assert.equal(option(h, name), card, `${name}: ${data}: the probe settling redraws nothing`);
					assert.equal(actionButton(h), button);
					if (name === "paste") {
						assert.equal(pasteBox(h).value, "early");
						assert.equal(fakeDom.document.activeElement, pasteBox(h), "the caret stays in the box");
					} else assert.equal(optionTitle(h, "file"), "a.json");
					assert.equal(ready(importButton(h)), true);

					importButton(h).fire("click");
					await settle();
					assert.deepEqual(h.rec.applied, ["text:early"], `${name}: ${data}: what the user filled, not the vault`);
				} finally {
					h.destroy();
				}
			}
		}
	});
});

describe("the plugin import window: choosing between the two", () => {
	it("names the group by the window's title, by reference rather than with an aria-label", async () => {
		for (const { base, open, fill } of WINDOWS) {
			const h = open(FOUND);
			try {
				h.modal.onOpen();
				await settle();
				const boxes = group(h);
				assert.equal(boxes.getAttribute("role"), "radiogroup");
				assert.equal(boxes.hasAttribute("aria-label"), false, `${base.pluginId}: no "Import from" tooltip`);
				const id = boxes.getAttribute("aria-labelledby");
				assert.ok(id, `${base.pluginId}: the group is still named`);
				assert.deepEqual(h.modalEl.querySelectorAll(`#${id}`), [h.titleEl], "by the title, and only by it");
				assert.equal(h.titleEl.textContent, t(base.copy.title));

				fill(h, "held");
				assert.equal(group(h).getAttribute("aria-labelledby"), id);
				assert.equal(h.titleEl.id, id);
			} finally {
				h.destroy();
			}
		}
	});

	it("ends each card in a radio dot: a focus stop while its card holds something, disabled while it does not", async () => {
		for (const { name, open, fill } of WINDOWS) {
			const h = open(FOUND);
			try {
				h.modal.onOpen();
				for (const which of options(h)) {
					const dot = radio(h, which);
					assert.ok(dot, which);
					assert.equal(dot.getAttribute("aria-disabled"), "true", `${which}: nothing to choose while checking`);
					assert.equal(dot.hasAttribute("tabindex"), false, which);
				}
				await settle();

				for (const [filled, state] of [[false, "empty"], [true, "filled"]] as const) {
					if (filled) fill(h, "held");
					for (const which of options(h)) {
						const what = `${name}: ${state}: ${which}`;
						const card = option(h, which);
						const dot = radio(h, which);
						assert.ok(dot, what);
						const choosable = which === "vault" || filled;
						assert.equal(dot.getAttribute("role"), "radio", what);
						assert.equal(dot.getAttribute("tabindex"), choosable ? "0" : null, what);
						assert.equal(dot.getAttribute("aria-disabled"), choosable ? null : "true", what);
						assert.ok(["true", "false"].includes(dot.getAttribute("aria-checked") ?? ""), what);
						// Named by its card's title line, described by its status line.
						const head = card.querySelector(".cs-option-box-head");
						assert.ok(head && head.id !== "", what);
						assert.equal(dot.getAttribute("aria-labelledby"), head.id, what);
						assert.equal(dot.getAttribute("aria-describedby"), status(h, which).id, what);
						// The card is a pointer target only: a radio may hold no
						// control, and the fallback's card holds a button.
						for (const attr of ["role", "tabindex", "aria-checked"]) {
							assert.equal(card.hasAttribute(attr), false, `${what}: ${attr} on the card`);
						}
						assert.equal(dot.querySelector("button, textarea"), null, what);
					}
				}
				assertNoTooltips(h, name);
			} finally {
				h.destroy();
			}
		}
	});

	it("makes what was just filled the active option, and Import follows", async () => {
		for (const { name, open, fill } of WINDOWS) {
			const h = open(FOUND);
			try {
				h.modal.onOpen();
				await settle();
				assert.equal(active(h), "vault");
				fill(h, "mine");
				assert.equal(active(h), name, `${name}: the one just filled is chosen`);
				assert.ok(
					importButton(h).getAttribute("aria-describedby")!.split(" ").includes(status(h, name).id),
					"Import is described by what it would import",
				);

				importButton(h).fire("click");
				await settle();
				assert.deepEqual(h.rec.fromText, ["mine"]);
				assert.deepEqual(h.rec.applied, ["text:mine"], `${name}: the fallback, not the vault`);
			} finally {
				h.destroy();
			}
		}
	});

	it("keeps what the fallback holds while the vault is chosen, and imports only the active one", async () => {
		for (const { name, open, fill } of WINDOWS) {
			const h = open(FOUND);
			try {
				h.modal.onOpen();
				await settle();
				fill(h, "held");
				const card = option(h, name);

				option(h, "vault").fire("click");
				assert.equal(active(h), "vault", `${name}: a click on the vault card chooses it`);
				assert.equal(option(h, name), card, "in place — nothing redrawn");
				if (name === "paste") assert.equal(pasteBox(h).value, "held", "the text survives");
				else assert.equal(optionTitle(h, "file"), "a.json", "the file is still staged");

				importButton(h).fire("click");
				await settle();
				assert.deepEqual(h.rec.fromText, [], `${name}: what the fallback holds is not read`);
				assert.deepEqual(h.rec.applied, ["vault"], `${name}: the vault, not the fallback`);
			} finally {
				h.destroy();
			}
		}
	});

	it("chooses a filled fallback again from its card, without opening the picker or reading the clipboard", async () => {
		for (const { name, open, fill } of WINDOWS) {
			const h = open(FOUND);
			try {
				h.modal.onOpen();
				await settle();
				fill(h, "held");
				option(h, "vault").fire("click");
				assert.equal(active(h), "vault");
				const reads = clipboard.reads();

				option(h, name).fire("click");
				await settle();
				assert.equal(active(h), name);
				assert.equal(h.pickerOpens(), 0, "chosen, not replaced");
				assert.equal(clipboard.reads(), reads, "chosen, not pasted over");
				assert.deepEqual(h.rec.fromText, [], "and choosing reads nothing");
			} finally {
				h.destroy();
			}
		}
	});

	it("does from the keyboard what a click does: Enter and Space on a radio dot choose its card", async () => {
		const h = harness(FOUND);
		try {
			h.modal.onOpen();
			await settle();
			stage(h, "a.json", () => Promise.resolve("file"));
			assert.equal(active(h), "file");

			assert.equal(press(radio(h, "vault")!, " "), true, "Space is claimed, so it does not scroll the window");
			assert.equal(active(h), "vault");
			assert.equal(press(radio(h, "file")!, "Enter"), true);
			assert.equal(active(h), "file");
			assert.equal(h.pickerOpens(), 0, "choosing opened no picker");

			// A held key is claimed and chooses nothing new; other keys are left alone.
			assert.equal(press(radio(h, "vault")!, " ", true), true, "a repeat is still claimed");
			assert.equal(active(h), "file");
			for (const key of ["a", "Tab", "ArrowDown", "Escape"]) {
				assert.equal(press(radio(h, "vault")!, key), false, key);
			}
			assert.equal(active(h), "file");
		} finally {
			h.destroy();
		}
	});

	it("cannot choose an empty fallback: its card waits to be filled, and a notice says how", async () => {
		for (const { name, open } of WINDOWS) {
			await notices(async (seen) => {
				const h = open(FOUND);
				try {
					h.modal.onOpen();
					await settle();
					// A click on the dot, as the card's listener sees it.
					clickOn(option(h, name), radio(h, name)!);
					option(h, name).fire("click");
					press(radio(h, name)!, "Enter");
					assert.equal(active(h), "vault", `${name}: still the vault`);
					assert.equal(option(h, name).hasClass("is-choosable"), false, "and it does not offer itself to the pointer");
					assert.equal(h.pickerOpens(), 0, "a click on the card is not a click on Upload");
					assert.equal(ready(importButton(h)), true);
					const first = t(name === "file" ? "import.uploadFirst" : "import.pasteFirst");
					assert.deepEqual(seen, [first, first, first], `${name}: one notice per press`);
				} finally {
					h.destroy();
				}
			});
		}
	});

	it("says nothing when the lone fallback's card is clicked: there is nothing to choose it over", async () => {
		for (const { name, open } of WINDOWS) {
			await notices(async (seen) => {
				const h = open();
				try {
					h.modal.onOpen();
					await settle();
					option(h, name).fire("click");
					assert.deepEqual(seen, [], name);
				} finally {
					h.destroy();
				}
			});
		}
	});

	it("marks only the card a click would change as choosable", async () => {
		const h = harness(FOUND);
		try {
			h.modal.onOpen();
			await settle();
			const choosable = () => options(h).filter((name) => option(h, name).hasClass("is-choosable"));
			assert.deepEqual(choosable(), [], "the vault is already active, the file card is empty");
			stage(h, "a.json", () => Promise.resolve("x"));
			assert.deepEqual(choosable(), ["vault"]);
			option(h, "vault").fire("click");
			assert.deepEqual(choosable(), ["file"]);
		} finally {
			h.destroy();
		}
	});

	it("treats a click on a card's own button or text box as that control's, not as a choice", async () => {
		const file = harness(FOUND);
		try {
			file.modal.onOpen();
			await settle();
			stage(file, "a.json", () => Promise.resolve("x"));
			option(file, "vault").fire("click");
			clickOn(option(file, "file"), actionButton(file));
			assert.equal(active(file), "vault", "Replace is not a vote for the file");
		} finally {
			file.destroy();
		}

		// An empty text box clicked into: nothing to choose yet, and nothing
		// to tell the user, who is about to paste.
		await notices(async (seen) => {
			const pasted = pasteHarness(FOUND);
			try {
				pasted.modal.onOpen();
				await settle();
				clickOn(option(pasted, "paste"), pasteBox(pasted));
				pasteBox(pasted).fire("focus");
				assert.equal(active(pasted), "vault");
				assert.deepEqual(seen, []);
			} finally {
				pasted.destroy();
			}
		});
	});

	it("chooses the text box again when the user goes back into it, and hands Import to the vault when it is emptied", async () => {
		const h = pasteHarness(FOUND);
		try {
			h.modal.onOpen();
			await settle();
			typeText(h, "held");
			option(h, "vault").fire("click");
			assert.equal(active(h), "vault");

			pasteBox(h).fire("focus");
			assert.equal(active(h), "paste", "back in a box that holds text");

			typeText(h, "  ");
			assert.equal(active(h), "vault", "nothing left to import from the box");
			assert.equal(ready(importButton(h)), true);
			typeText(h, "again");
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
			assert.equal(active(h), "file", "but the file the user uploaded stays active");
			assert.equal(optionTitle(h, "file"), "early.json");
		} finally {
			h.destroy();
		}
	});

	it("ignores every card, dot and button while an import is running", async () => {
		// The file window, held up by a file that is slow to read.
		const file = harness(FOUND);
		try {
			file.modal.onOpen();
			await settle();
			const slow = deferredText();
			stage(file, "slow.json", slow.text);
			importButton(file).fire("click");

			for (const name of options(file)) {
				option(file, name).fire("click");
				press(radio(file, name)!, "Enter");
			}
			actionButton(file).fire("click");
			await settle();
			assert.equal(file.pickerOpens(), 0, "no picker mid-import");
			assert.equal(active(file), "file", "and no change of choice under the running import");

			slow.resolve("from-file");
			await settle();
			assert.deepEqual(file.rec.fromText, ["from-file"]);
			assert.deepEqual(file.rec.applied, ["text:from-file"]);
		} finally {
			file.destroy();
		}

		// The paste window, held up by a plan that is slow to settle.
		let release: () => void = () => {};
		const pasted = pasteHarness({
			...FOUND,
			source: (rec) => ({
				...pasteSource(rec),
				fromText: (text) => {
					rec.fromText.push(text);
					return {
						batch: {
							size: 1,
							plan: () =>
								new Promise((resolve) => {
									release = () => resolve(recordingPlan(`text:${text}`, 1, rec));
								}),
						},
					};
				},
			}),
		});
		try {
			pasted.modal.onOpen();
			await settle();
			typeText(pasted, "held");
			importButton(pasted).fire("click");
			await settle();

			clipboard.set("copied mid-import");
			const reads = clipboard.reads();
			option(pasted, "vault").fire("click");
			actionButton(pasted).fire("click");
			await settle();
			assert.equal(clipboard.reads(), reads, "no clipboard read mid-import");
			assert.equal(active(pasted), "paste", "and no change of choice under the running import");
			assert.equal(pasteBox(pasted).value, "held");

			release();
			await settle();
			assert.deepEqual(pasted.rec.fromText, ["held"]);
			assert.deepEqual(pasted.rec.applied, ["text:held"]);
		} finally {
			pasted.destroy();
		}
	});
});

describe("the plugin import window: pasting", () => {
	it("draws a plain text box on the paste card, named and described by the card's own lines", async () => {
		const h = pasteHarness();
		try {
			h.modal.onOpen();
			await settle();
			const box = pasteBox(h);
			assert.equal(box.tagName, "TEXTAREA");
			assert.ok(box.hasClass("cs-text-control"), "painted like every other text field");
			assert.equal(box.getAttribute("placeholder"), t("import.cmPlaceholder"));
			assert.equal(box.value, "");
			assert.equal(optionTitle(h, "paste"), t(PASTE_COPY.manual));
			assert.equal(status(h, "paste").textContent, t(PASTE_COPY.manualDesc));
			assert.equal(box.getAttribute("aria-labelledby"), option(h, "paste").querySelector(".cs-option-box-head")?.id);
			assert.equal(box.getAttribute("aria-describedby"), status(h, "paste").id);
			assert.equal(box.hasAttribute("aria-label"), false, "no tooltip over the box");

			const button = actionButton(h);
			assert.equal(button.tagName, "BUTTON");
			assert.equal(button.textContent, t("import.pasteButton"), "a button that says what it does");
			assert.equal(button.hasClass("mod-cta"), false, "not a second primary button");
		} finally {
			h.destroy();
		}
	});

	it("reads the clipboard only when Paste is pressed, and never otherwise", async () => {
		const h = pasteHarness(FOUND);
		try {
			h.modal.onOpen();
			await settle();
			const before = clipboard.reads();
			clipboard.set("must not be read");
			option(h, "paste").fire("click");
			press(radio(h, "paste")!, "Enter");
			pasteBox(h).fire("click");
			pasteBox(h).fire("focus");
			typeText(h, "typed");
			option(h, "vault").fire("click");
			option(h, "paste").fire("click");
			importButton(h).fire("click");
			await settle();
			assert.deepEqual(h.rec.applied, ["text:typed"]);
			assert.equal(clipboard.reads(), before, "no card, dot, box or Import reads the clipboard");
		} finally {
			h.destroy();
		}
	});

	it("puts the clipboard's text in the box when Paste is pressed, and makes it the active option", async () => {
		await notices(async (seen) => {
			const h = pasteHarness(FOUND);
			try {
				h.modal.onOpen();
				await settle();
				assert.equal(active(h), "vault");
				await pressPaste(h, ".callout { }\n");
				assert.equal(pasteBox(h).value, ".callout { }\n", "there to see, exactly as copied");
				assert.deepEqual(h.rec.planned, [], "pasting imports nothing");
				assert.equal(active(h), "paste");
				assert.equal(fakeDom.document.activeElement, importButton(h), "focus lands on the next step");
				assert.equal(importButton(h).lastFocusOptions?.preventScroll, true);
				assert.equal(actionButton(h).textContent, t("import.pasteButton"), "still Paste: it can be pressed again");
				assert.deepEqual(seen, [], "the text in the box is the confirmation");

				importButton(h).fire("click");
				await settle();
				assert.deepEqual(h.rec.fromText, [".callout { }\n"]);
				assert.deepEqual(h.rec.applied, ["text:.callout { }\n"]);
			} finally {
				h.destroy();
			}
		});
	});

	it("replaces what the box held when Paste is pressed again", async () => {
		const h = pasteHarness();
		try {
			h.modal.onOpen();
			await settle();
			typeText(h, "typed first");
			await pressPaste(h, "new");
			assert.equal(pasteBox(h).value, "new");
			importButton(h).fire("click");
			await settle();
			assert.deepEqual(h.rec.fromText, ["new"], "only the latest text is imported");
		} finally {
			h.destroy();
		}
	});

	it("says so in a notice when the clipboard is empty or cannot be read, and leaves the box as it was", async () => {
		for (const [failure, key] of [
			[" \n ", "import.clipboardEmpty"],
			[new Error("NotAllowedError"), "import.clipboardBlocked"],
		] as const) {
			for (const held of ["", "original"]) {
				await notices(async (seen) => {
					const h = pasteHarness(FOUND);
					try {
						h.modal.onOpen();
						await settle();
						if (held) typeText(h, held);
						const was = active(h);
						pasteBox(h).focus();

						await pressPaste(h, failure);
						assert.deepEqual(seen, [t(key)], `${key}: said once`);
						assert.equal(pasteBox(h).value, held, `${key}: the box keeps what it held`);
						assert.equal(active(h), was, `${key}: the choice does not move`);
						assert.equal(fakeDom.document.activeElement, pasteBox(h), `${key}: nor does focus`);
						assert.equal(status(h, "paste").textContent, t(PASTE_COPY.manualDesc), `${key}: no warning on the card`);

						// A second press tries again.
						await pressPaste(h, "second try");
						assert.equal(pasteBox(h).value, "second try");
						assert.equal(active(h), "paste");
					} finally {
						h.destroy();
					}
				});
			}
		}
	});

	it("never sends the user to a file option this window does not have", () => {
		// The retired wording said to save the data as a file and choose that.
		assert.doesNotMatch(en["import.clipboardBlocked"]!, /\bfile\b/i);
	});

	it("changes nothing when the clipboard answers after the window closed", async () => {
		await notices(async (seen) => {
			const h = pasteHarness(FOUND);
			try {
				h.modal.onOpen();
				await settle();
				for (const late of ["late", new Error("NotAllowedError"), ""]) {
					clipboard.set(late);
					actionButton(h).fire("click");
				}
				h.modal.close();
				await settle();
				assert.equal(h.contentEl.children.length, 0);
				assert.deepEqual(seen, [], "and says nothing");
				assert.deepEqual(h.rec.fromText, []);
			} finally {
				h.destroy();
			}
		});
	});

	it("arms Import while the box holds text, and imports it as typed", async () => {
		const h = pasteHarness();
		try {
			h.modal.onOpen();
			await settle();
			const box = pasteBox(h);
			box.focus();

			typeText(h, "sty");
			assert.equal(ready(importButton(h)), true);
			assert.equal(pasteBox(h), box, "typing redraws nothing");
			assert.equal(fakeDom.document.activeElement, box, "and the caret stays in the box");

			typeText(h, " \n ");
			assert.equal(ready(importButton(h)), false, "whitespace alone is nothing to import");
			typeText(h, "");
			assert.equal(ready(importButton(h)), false);
			assert.deepEqual(h.rec.planned, [], "typing imports nothing");

			typeText(h, "  styles\n");
			importButton(h).fire("click");
			await settle();
			assert.deepEqual(h.rec.fromText, ["  styles\n"], "only the latest text, exactly as it stands");
			assert.deepEqual(h.rec.applied, ["text:  styles\n"]);
		} finally {
			h.destroy();
		}
	});

	it("takes no dropped file", async () => {
		const h = pasteHarness(FOUND);
		try {
			h.modal.onOpen();
			await settle();
			let reads = 0;
			const drop = dragEvent([{ name: "styles.css", text: () => {
				reads++;
				return Promise.resolve("dropped");
			} }]);
			for (const el of [pasteBox(h), option(h, "paste"), option(h, "vault")]) {
				const over = dragEvent();
				el.fire("dragover", over);
				assert.equal(over.defaultPrevented, false, "not offered as a drop target");
				assert.equal(el.hasClass("is-drop-target"), false);
				el.fire("drop", drop);
			}
			await settle();
			assert.equal(drop.defaultPrevented, false);
			assert.equal(active(h), "vault", "the drop stages nothing");
			assert.equal(reads, 0);
		} finally {
			h.destroy();
		}
	});
});

describe("the plugin import window: uploading a file", () => {
	it("gives Admonition a standard Upload button on its file card, and a .json picker behind it", async () => {
		const h = harness();
		try {
			h.modal.onOpen();
			assert.equal(fileInput(h).getAttribute("accept"), ".json");
			await settle();
			const button = actionButton(h);
			assert.equal(button.tagName, "BUTTON");
			assert.equal(button.textContent, t("import.upload"));
			assert.equal(button.hasClass("mod-cta"), false, "not a second primary button");
			assert.equal(button.parentElement, option(h, "file"), "on the card it fills");
			assert.equal(optionTitle(h, "file"), t(COPY.manual));
			assert.equal(status(h, "file").textContent, t(COPY.manualDesc));
			// The button says what it uploads.
			assert.ok(button.getAttribute("aria-describedby")!.split(" ").includes(status(h, "file").id));

			button.fire("click");
			assert.equal(h.pickerOpens(), 1, "Upload opens the picker");
			option(h, "file").fire("click");
			assert.equal(h.pickerOpens(), 1, "and only Upload does: the card is not a button");
			assert.equal(ready(importButton(h)), false, "nothing picked yet");
		} finally {
			h.destroy();
		}
	});

	it("stages an uploaded file instead of importing it, and says so with a notice", async () => {
		await notices(async (seen) => {
			const h = harness();
			try {
				h.modal.onOpen();
				await settle();
				const box = option(h, "file");
				const button = actionButton(h);
				stage(h, "admonitions.json", () => Promise.resolve("from-file"));
				await settle();
				assert.deepEqual(h.rec.planned, [], "uploading a file imports nothing");
				assert.deepEqual(seen, [t("import.fileUploaded", { name: "admonitions.json" })]);

				assert.equal(option(h, "file"), box, "the card is rewritten in place");
				assert.equal(actionButton(h), button, "the very same button");
				assert.equal(button.textContent, t("import.replace"), "which now reads Replace");
				const name = box.querySelector(".cs-option-box-name")!;
				assert.equal(name.textContent, "admonitions.json");
				assert.equal(name.getAttribute("dir"), "auto");
				assert.equal(status(h, "file").textContent, t("import.fileReady"));
				assert.equal(box.hasClass("is-filled"), false, "no green success state: the notice is the confirmation");
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
	});

	it("replaces the file from the same button, with a notice of its own, and never opens the old one", async () => {
		await notices(async (seen) => {
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

				const button = actionButton(h);
				button.fire("click");
				assert.equal(h.pickerOpens(), 1, "Replace opens the picker");
				// A picker closed without a pick fires nothing: the first file stays.
				assert.equal(optionTitle(h, "file"), "first.json");
				assert.deepEqual(seen, [t("import.fileUploaded", { name: "first.json" })], "and nothing is announced");

				stage(h, "second.json", () => Promise.resolve("second"));
				assert.equal(optionTitle(h, "file"), "second.json");
				assert.equal(actionButton(h), button);
				assert.equal(button.textContent, t("import.replace"));
				assert.equal(h.contentEl.querySelectorAll(".cs-option-box-name").length, 1, "one file staged, not two");
				assert.deepEqual(seen, [
					t("import.fileUploaded", { name: "first.json" }),
					t("import.fileReplaced", { name: "second.json" }),
				]);

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

	it("stages a dropped file, then imports it only from the footer", async () => {
		const name = "admonitions.json";
		const contents = '{"admonitions":[]}';
		await notices(async (seen) => {
			const h = harness(FOUND);
			try {
				h.modal.onOpen();
				await settle();
				assert.equal(active(h), "vault");
				let reads = 0;
				const event = dragEvent([{ name, text: () => {
					reads++;
					return Promise.resolve(contents);
				} }]);
				const title = option(h, "file").querySelector(".cs-option-box-title");
				assert.ok(title);
				title.dispatchEvent(Object.assign(event, { type: "drop", bubbles: true }));
				assert.equal(event.defaultPrevented, true, "the browser must not open the file");
				assert.equal(h.pickerOpens(), 0, "dropping does not open the picker");
				assert.equal(active(h), "file", "the dropped file becomes active");
				assert.equal(optionTitle(h, "file"), name);
				assert.equal(status(h, "file").textContent, t("import.fileReady"));
				assert.equal(actionButton(h).textContent, t("import.replace"));
				assert.deepEqual(seen, [t("import.fileUploaded", { name })], "a drop is an upload like any other");
				assert.equal(fakeDom.document.activeElement, importButton(h));
				assert.equal(reads, 0, "dropping only stages");
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
		});
	});

	it("shows a file drop target only while a file is over its card", async () => {
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
			assert.equal(box.hasClass("is-drop-target"), false, "leaving the card clears the highlight");
		} finally {
			h.destroy();
		}
	});

	it("takes no drop on the vault card", async () => {
		const h = harness(FOUND);
		try {
			h.modal.onOpen();
			await settle();
			const over = dragEvent();
			option(h, "vault").fire("dragover", over);
			assert.equal(over.defaultPrevented, false);
			const drop = dragEvent([{ name: "a.json", text: () => Promise.resolve("dropped") }]);
			option(h, "vault").fire("drop", drop);
			assert.equal(drop.defaultPrevented, false);
			assert.equal(active(h), "vault");
			assert.equal(optionTitle(h, "file"), t(COPY.manual), "nothing was staged");
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

	it("a dropped file replaces an uploaded one without reading the old file", async () => {
		await notices(async (seen) => {
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
				assert.equal(seen.at(-1), t("import.fileReplaced", { name: "dropped.json" }));
				importButton(h).fire("click");
				await settle();
				assert.equal(firstReads, 0);
				assert.deepEqual(h.rec.fromText, ["dropped"]);
			} finally {
				h.destroy();
			}
		});
	});

	it("prevents a file drop during import without replacing the file being read", async () => {
		await notices(async (seen) => {
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
				assert.equal(seen.length, 1, "and nothing claims the file was replaced");
				pending.resolve("in-progress");
				await settle();
				assert.deepEqual(h.rec.fromText, ["in-progress"]);
			} finally {
				h.destroy();
			}
		});
	});
});

describe("the plugin import window: errors", () => {
	it("reports unreadable pasted text and keeps it in the box", async () => {
		const report = stubReport();
		const h = pasteHarness();
		try {
			h.modal.onOpen();
			await settle();
			typeText(h, "bad");
			importButton(h).fire("click");
			await settle();
			assert.deepEqual(report.seen, [{ fatal: true, keys: ["import.err.parseFailed"] }]);
			assert.equal(h.isClosed(), false);
			assert.equal(pasteBox(h).value, "bad", "still there to correct");
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
			assert.equal(optionTitle(h, "file"), "gone.json", "the file stays staged, to be replaced");
			assert.equal(actionButton(h).textContent, t("import.replace"));
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

	it("reopens clean: no staged file, no text, the vault active again", async () => {
		for (const { name, base, open, fill } of WINDOWS) {
			const h = open(FOUND);
			try {
				h.modal.onOpen();
				await settle();
				fill(h, "old");
				assert.equal(active(h), name);
				h.modal.onClose();
				h.modal.onOpen();
				await settle();
				assert.equal(active(h), "vault", `${name}: nothing held over`);
				assert.equal(option(h, "vault").querySelectorAll(".cs-recommended-badge").length, 1);
				if (name === "paste") assert.equal(pasteBox(h).value, "");
				else {
					assert.equal(optionTitle(h, "file"), t(base.copy.manual));
					assert.equal(actionButton(h).textContent, t("import.upload"));
				}
			} finally {
				h.destroy();
			}
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
		await notices(async (seen) => {
			const h = harness({ ...FOUND, writer: { ...savingWriter(), isFrozen: true } });
			try {
				h.modal.onOpen();
				await settle();
				importButton(h).fire("click");
				await settle();
				assert.deepEqual(h.rec.applied, []);
				assert.equal(h.backups().length, 0);
				assert.ok(seen.includes(en["notice.blockedWhilePaused"]!));
				assert.equal(h.isClosed(), false);
				assert.equal(ready(importButton(h)), true);
			} finally {
				h.destroy();
			}
		});
	});
});
