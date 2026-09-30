/**
 * tests/support/pluginImportHarness.ts — the plugin import window, opened on
 * the fake DOM over a vault and a clipboard the suite describes.
 *
 * The window runs with a *recording* source: Admonition's or Callout Manager's
 * real copy and file types, but planning and applying that only write down what
 * they were asked to do, so no registry is needed and a suite can assert which
 * input the one Import actually acted on.
 *
 * The window draws its options on one screen: "This vault" while the other
 * plugin's data is there (or still being looked for), and the source's one
 * fallback, always. `harness()` opens Admonition's window, whose fallback is a
 * file card with an Upload button; `pasteHarness()` opens Callout Manager's,
 * whose fallback is a paste card with a text box and a Paste button. A suite
 * names the fallback by what it is — `"file"` or `"paste"` — and `option()`
 * refuses the one the window does not draw.
 *
 * Importing this module replaces `navigator` for the whole test file (Node's
 * own is a getter-only accessor, so it is redefined rather than assigned; each
 * test file runs in its own process, so nothing leaks). `clipboard` sets what
 * the next `readText()` gives back, and counts the reads: only the Paste
 * button may cause one.
 */
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import type { App } from "obsidian";
import { t } from "../../src/i18n";
import { ImportReportModal } from "../../src/utils/ImportReportModal";
import { PluginImportModal } from "../../src/settings/pluginImport/PluginImportModal";
import { ADMONITION_IMPORT } from "../../src/settings/pluginImport/admonitionImportSource";
import { CALLOUT_MANAGER_IMPORT } from "../../src/settings/pluginImport/calloutManagerImportSource";
import type {
	PluginImportBatch,
	PluginImportPlan,
	PluginImportSource,
} from "../../src/settings/pluginImport/pluginImportSource";
import type { SettingsSectionContext } from "../../src/settings/sections/types";
import { fakeDom, type FakeElement } from "./fakeDom";
import { TestKeymap, TestScope } from "./fakeKeymap";
import { memoryVault, PLUGIN_MANIFEST, savingWriter } from "./importSafetyStubs";

/** What the next `navigator.clipboard.readText()` resolves to, or rejects with. */
let clipboardNext: string | Error = "";
let clipboardReads = 0;

Object.defineProperty(globalThis, "navigator", {
	configurable: true,
	value: {
		clipboard: {
			readText: () => {
				clipboardReads++;
				const next = clipboardNext;
				return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
			},
		},
	},
});

export const clipboard = {
	set(next: string | Error): void {
		clipboardNext = next;
	},
	reads: (): number => clipboardReads,
};

export interface Recorder {
	fromText: string[];
	planned: string[];
	applied: string[];
	after: number;
}

/** A batch that records what planning and applying it did, by its label. */
export function recordingBatch(label: string, size: number, rec: Recorder): PluginImportBatch {
	return {
		size,
		plan: () => {
			rec.planned.push(label);
			return Promise.resolve(recordingPlan(label, size, rec));
		},
	};
}

export function recordingPlan(label: string, size: number, rec: Recorder): PluginImportPlan {
	return {
		issues: [],
		applyCount: size,
		apply: () => {
			rec.applied.push(label);
			return { created: size, updated: 0 };
		},
		afterApply: () => {
			rec.after++;
		},
	};
}

/**
 * `base`'s copy and fallback with a recording data path. A data.json that
 * is a JSON array is "found" with that many entries; the text "bad" does not
 * parse.
 */
export function recordingSource(rec: Recorder, base: PluginImportSource = ADMONITION_IMPORT): PluginImportSource {
	return {
		...base,
		fromDataJson: (raw) =>
			Array.isArray(raw) ? recordingBatch("vault", raw.length, rec) : null,
		fromText: (text) => {
			rec.fromText.push(text);
			if (text === "bad") return { errorKey: "import.err.parseFailed" };
			return { batch: recordingBatch(`text:${text}`, 1, rec) };
		},
	};
}

export interface HarnessOptions {
	/** The other plugin's data.json; `undefined` for no file at all. */
	dataJson?: string;
	/** Defaults to whether data.json exists; true models a folder with no settings. */
	folderExists?: boolean;
	source?: (rec: Recorder) => PluginImportSource;
	/**
	 * Leave the modal's own `close()` in place, so a suite can model a phone,
	 * where Obsidian calls `onClose` only after the window has slid out. The
	 * suite must then give the `obsidian` stub's `Modal` a `close` itself.
	 */
	nativeClose?: boolean;
	/** This plugin's writer; saving normally unless a suite pauses it. */
	writer?: ReturnType<typeof savingWriter>;
}

export interface Harness {
	modal: PluginImportModal;
	/** The fallback this window falls back to: a file, or pasted text. */
	manual: "file" | "paste";
	modalEl: FakeElement;
	headerEl: FakeElement;
	titleEl: FakeElement;
	contentEl: FakeElement;
	rec: Recorder;
	displays: () => number;
	isClosed: () => boolean;
	/** How often the window has asked its file input to open the picker. */
	pickerOpens: () => number;
	/** The backups of this plugin's own settings written so far, by path. */
	backups: () => string[];
	destroy: () => void;
}

/**
 * The window as Obsidian builds it — `modalEl > (.modal-header > .modal-title,
 * .modal-content)` — not yet opened.
 */
export function harness(options: HarnessOptions = {}): Harness {
	const { dataJson } = options;
	fakeDom.light();
	const rec: Recorder = { fromText: [], planned: [], applied: [], after: 0 };
	const app = {
		keymap: new TestKeymap(),
		scope: new TestScope(),
		vault: {
			configDir: ".obsidian",
			adapter: {
				stat: () => Promise.resolve(null),
				exists: (path: string) => Promise.resolve(
					path.endsWith("/data.json")
						? dataJson !== undefined
						: (options.folderExists ?? dataJson !== undefined),
				),
				read: () => Promise.resolve(dataJson ?? ""),
			},
		},
	} as unknown as App;
	let displays = 0;
	// This plugin's own folder, where an import saves a backup before applying.
	const own = memoryVault();
	const settings = { competitorImportBannerHandled: true };
	const ctx = {
		app,
		plugin: {
			app: own.app,
			manifest: PLUGIN_MANIFEST,
			settingsWriter: options.writer ?? savingWriter(),
			localState: { hasHandledImportBanner: false, markImportBannerHandled: () => {} },
			registry: { settings, toSaveData: () => ({ settings }) },
			saveSettings: () => Promise.resolve(),
		},
		display: () => {
			displays++;
		},
	} as unknown as SettingsSectionContext;

	const source = (options.source ?? recordingSource)(rec);
	const manual = source.manual.kind;
	const modal = new PluginImportModal(ctx, source);
	const containerEl = fakeDom.document.body.createDiv({ cls: "modal-container" });
	const modalEl = containerEl.createDiv({ cls: "modal" });
	const headerEl = modalEl.createDiv({ cls: "modal-header" });
	const titleEl = headerEl.createDiv({ cls: "modal-title" });
	const contentEl = modalEl.createDiv({ cls: "modal-content" });
	let closed = false;
	Object.assign(modal, {
		containerEl,
		modalEl,
		titleEl,
		contentEl,
		app,
		scope: app.scope,
		setTitle: (title: string) => {
			titleEl.setText(title);
			return modal;
		},
	});
	if (!options.nativeClose) {
		Object.assign(modal, {
			close: () => {
				if (closed) return;
				closed = true;
				modal.onClose();
			},
		});
	}
	// A real file input's `click()` opens the system file chooser, which a test
	// can only count; the fake DOM has no `click()` at all. The input is built
	// afresh by every `onOpen`, so every open gets the counter. A window whose
	// fallback is pasted text has no picker, and so no input to build.
	let pickerOpens = 0;
	const open = modal.onOpen.bind(modal);
	Object.assign(modal, {
		onOpen: () => {
			open();
			const input = contentEl.querySelector(".cs-import-file-input");
			if (manual === "paste") {
				assert.equal(input, null, "a paste window builds no file input");
				return;
			}
			assert.ok(input, "onOpen attaches the file input");
			Object.assign(input, { click: () => pickerOpens++ });
		},
	});
	return {
		modal,
		manual,
		modalEl,
		headerEl,
		titleEl,
		contentEl,
		rec,
		displays: () => displays,
		isClosed: () => closed,
		pickerOpens: () => pickerOpens,
		backups: () => [...own.files.keys()].filter((path) => path.includes("/backups/")),
		destroy: () => {
			if (!closed) modal.onClose();
			containerEl.remove();
		},
	};
}

/** Callout Manager's window: this vault, or pasted text. */
export function pasteSource(rec: Recorder): PluginImportSource {
	return recordingSource(rec, CALLOUT_MANAGER_IMPORT);
}

/** {@link harness} over Callout Manager's window instead of Admonition's. */
export function pasteHarness(options: HarnessOptions = {}): Harness {
	return harness({ source: pasteSource, ...options });
}

/** Let the file/folder probe and any plan settle. */
export async function settle(): Promise<void> {
	for (let i = 0; i < 5; i++) await setImmediate();
}

export const IMPORT = t(ADMONITION_IMPORT.copy.importButton);

export function importButton(h: Harness): FakeElement {
	const cta = h.modalEl.querySelectorAll(".mod-cta");
	assert.equal(cta.length, 1, "exactly one primary button in the window");
	assert.ok(cta[0]!.parentElement?.hasClass("cs-modal-footer"), "and it is in the footer");
	return cta[0]!;
}

/**
 * The invariant itself: one control in the whole window reads as Import, it is
 * the footer's, and nothing in the body is a primary button.
 */
export function assertOneImport(h: Harness): FakeElement {
	const btn = importButton(h);
	const importish = h.modalEl
		.querySelectorAll("button")
		.filter((b) => b.textContent === IMPORT || b.textContent === t("import.importing"));
	assert.deepEqual(importish, [btn], "no second button labelled Import");
	return btn;
}

export function ready(btn: FakeElement): boolean {
	return btn.getAttribute("aria-disabled") === "false" && !btn.hasClass("cs-btn-disabled");
}

export type Option = "vault" | "file" | "paste";

/** The column that holds the cards; a `role="radiogroup"` while there are two. */
export function group(h: Harness): FakeElement {
	const el = h.contentEl.querySelector(".cs-option-list");
	assert.ok(el, "the options are drawn");
	return el;
}

/** The options on screen, top to bottom: the vault while it is offered, then the fallback. */
export function options(h: Harness): readonly Option[] {
	const cards = group(h).querySelectorAll(".cs-option-box");
	const vault = cards.filter((el) => el.hasClass("cs-import-vault"));
	const manual = cards.filter((el) => el.hasClass("cs-import-manual"));
	assert.equal(manual.length, 1, "the fallback is always there, once");
	assert.equal(cards.length, vault.length + 1, "and nothing else but the vault");
	assert.ok(vault.length <= 1);
	if (vault.length === 0) return [h.manual];
	assert.deepEqual(cards, [vault[0], manual[0]], "the vault comes first");
	return ["vault", h.manual];
}

/** The option's card. */
export function option(h: Harness, name: Option): FakeElement {
	if (name !== "vault") assert.equal(name, h.manual, `this window's fallback is "${h.manual}"`);
	const el = group(h).querySelector(name === "vault" ? ".cs-import-vault" : ".cs-import-manual");
	assert.ok(el, `the ${name} option is on screen`);
	return el;
}

export function optionTitle(h: Harness, name: Option): string {
	return option(h, name).querySelector(".cs-option-box-title")?.textContent ?? "";
}

/** The card's status line. */
export function status(h: Harness, name: Option): FakeElement {
	const el = option(h, name).querySelector(".cs-option-box-desc");
	assert.ok(el);
	return el;
}

/** The radio dot at the card's trailing edge; null when the card stands alone. */
export function radio(h: Harness, name: Option): FakeElement | null {
	return option(h, name).querySelector(".cs-import-radio");
}

/**
 * The active option, checked two ways that must agree: the accent ring on its
 * card, and `aria-checked` on its radio dot. Null when none is active — and
 * when the fallback stands alone, with nothing to be chosen against.
 */
export function active(h: Harness): Option | null {
	const ringed = options(h).filter((name) => option(h, name).hasClass("is-selected"));
	const checked = options(h).filter((name) => radio(h, name)?.getAttribute("aria-checked") === "true");
	assert.deepEqual(ringed, checked, "the ring and aria-checked agree");
	assert.ok(ringed.length <= 1, "at most one active option");
	return ringed[0] ?? null;
}

/** The fallback card's own button: Upload, then Replace — or Paste. */
export function actionButton(h: Harness): FakeElement {
	const buttons = option(h, h.manual).querySelectorAll("button");
	assert.equal(buttons.length, 1, "one button on the fallback's card");
	return buttons[0]!;
}

/** The text box of the paste card. */
export function pasteBox(h: Harness): FakeElement {
	const box = option(h, "paste").querySelector("textarea");
	assert.ok(box, "the paste card holds a text box");
	return box;
}

/**
 * A key pressed on `el`, as its keydown listener sees it — or, with `repeat`,
 * one of the keydowns a key held down sends after the first. Returns whether
 * the key was claimed (`preventDefault`) — for Space, what stops it scrolling
 * the window as well as choosing.
 */
export function press(el: FakeElement, key: string, repeat = false): boolean {
	let claimed = false;
	el.fire("keydown", {
		type: "keydown",
		key,
		repeat,
		preventDefault: () => {
			claimed = true;
		},
	});
	return claimed;
}

/** The screen-reader-only live region: what the probe found. */
export function announcer(h: Harness): FakeElement {
	const el = h.contentEl.querySelector(".cs-import-announcer");
	assert.ok(el);
	return el;
}

export function fileInput(h: Harness): FakeElement {
	const input = h.contentEl.querySelector(".cs-import-file-input");
	assert.ok(input, "the file input is attached for the window's whole life");
	return input;
}

/**
 * What the picker hands back once a file is picked: the input's `files`, its
 * `value` (the browser's fake path), and `change`. Needs no click on Upload
 * first — the picker is modelled only by its result.
 */
export function stage(h: Harness, name: string, text: () => Promise<string>): void {
	const input = fileInput(h);
	Object.assign(input, { files: [{ name, text }], value: `C:\\fakepath\\${name}` });
	input.fire("change");
}

/**
 * What the user does in the text box themselves: its whole text becomes
 * `text`, as typing, or a keyboard paste over everything, leaves it.
 */
export function typeText(h: Harness, text: string): void {
	const box = pasteBox(h);
	box.value = text;
	box.fire("input");
}

/** Put `next` on the clipboard and press the Paste button; waits for the read. */
export async function pressPaste(h: Harness, next: string | Error): Promise<void> {
	clipboard.set(next);
	const reads = clipboard.reads();
	actionButton(h).fire("click");
	await settle();
	assert.equal(clipboard.reads(), reads + 1, "Paste read the clipboard, once");
}

export interface ReportSeen {
	fatal: boolean;
	keys: string[];
}

/**
 * Stand in for the report's prompt, which would otherwise open a real window;
 * every report is answered "cancel". Returns what was shown and the undo.
 */
export function stubReport(): { seen: ReportSeen[]; restore: () => void } {
	const saved = Object.getOwnPropertyDescriptor(ImportReportModal.prototype, "prompt");
	assert.ok(saved);
	const seen: ReportSeen[] = [];
	Object.defineProperty(ImportReportModal.prototype, "prompt", {
		configurable: true,
		writable: true,
		value(this: ImportReportModal) {
			const report = this as unknown as {
				fatal: boolean;
				issues: { messageKey: string }[];
			};
			seen.push({ fatal: report.fatal, keys: report.issues.map((issue) => issue.messageKey) });
			return Promise.resolve("cancel" as const);
		},
	});
	return {
		seen,
		restore: () => Object.defineProperty(ImportReportModal.prototype, "prompt", saved),
	};
}
