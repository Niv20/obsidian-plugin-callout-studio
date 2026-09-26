/**
 * tests/support/pluginImportHarness.ts — the plugin import window, opened on
 * the fake DOM over a vault and a clipboard the suite describes.
 *
 * The window runs with a *recording* source: Admonition's or Callout Manager's
 * real copy and file types, but planning and applying that only write down what
 * they were asked to do, so no registry is needed and a suite can assert which
 * input the one Import actually acted on.
 *
 * Each option is one box, and the box is the whole control: there is no button
 * on it. A click on it chooses it, or fills it (the picker, the clipboard) —
 * which of the two is the window's call, so the helpers here say which one a
 * suite is relying on rather than leaving it to the state they happen to be in.
 *
 * Importing this module replaces `navigator` for the whole test file (Node's
 * own is a getter-only accessor, so it is redefined rather than assigned; each
 * test file runs in its own process, so nothing leaks). `clipboard` sets what
 * the next `readText()` gives back.
 */
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import type { App } from "obsidian";
import { t } from "../../src/i18n";
import { ImportReportModal } from "../../src/utils/ImportReportModal";
import { PluginImportModal } from "../../src/settings/pluginImport/PluginImportModal";
import { ADMONITION_IMPORT } from "../../src/settings/pluginImport/admonitionImportSource";
import type {
	PluginImportBatch,
	PluginImportPlan,
	PluginImportSource,
} from "../../src/settings/pluginImport/pluginImportSource";
import type { SettingsSectionContext } from "../../src/settings/sections/types";
import { fakeDom, type FakeElement } from "./fakeDom";
import { TestKeymap, TestScope } from "./fakeKeymap";

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
 * `base`'s copy and file types with a recording data path. A data.json that is
 * a JSON array is "found" with that many entries; the text "bad" does not parse.
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
}

export interface Harness {
	modal: PluginImportModal;
	modalEl: FakeElement;
	headerEl: FakeElement;
	titleEl: FakeElement;
	contentEl: FakeElement;
	rec: Recorder;
	displays: () => number;
	isClosed: () => boolean;
	/** How often the window has asked its file input to open the picker. */
	pickerOpens: () => number;
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
	const ctx = {
		app,
		plugin: {
			registry: { settings: { competitorImportBannerHandled: true } },
			saveSettings: () => Promise.resolve(),
		},
		display: () => {
			displays++;
		},
	} as unknown as SettingsSectionContext;

	const modal = new PluginImportModal(ctx, (options.source ?? recordingSource)(rec));
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
	// afresh by every `onOpen`, so every open gets the counter.
	let pickerOpens = 0;
	const open = modal.onOpen.bind(modal);
	Object.assign(modal, {
		onOpen: () => {
			open();
			const input = contentEl.querySelector(".cs-import-file-input");
			assert.ok(input, "onOpen attaches the file input");
			Object.assign(input, { click: () => pickerOpens++ });
		},
	});
	return {
		modal,
		modalEl,
		headerEl,
		titleEl,
		contentEl,
		rec,
		displays: () => displays,
		isClosed: () => closed,
		pickerOpens: () => pickerOpens,
		destroy: () => {
			if (!closed) modal.onClose();
			containerEl.remove();
		},
	};
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

export const OPTIONS: readonly Option[] = ["vault", "file", "paste"];

/** The `role="radiogroup"` that holds the three boxes. */
export function group(h: Harness): FakeElement {
	const el = h.contentEl.querySelector(".cs-option-list");
	assert.ok(el, "the options are drawn");
	return el;
}

/**
 * The option's box — itself the option's radio, and the one thing on it to
 * click. The window always draws all three, in this order.
 */
export function option(h: Harness, name: Option): FakeElement {
	const rows = h.contentEl.querySelectorAll(".cs-option-box");
	assert.equal(rows.length, 3, "three options, always");
	return rows[{ vault: 0, file: 1, paste: 2 }[name]]!;
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

export function optionTitle(h: Harness, name: Option): string {
	return option(h, name).querySelector(".cs-option-box-title")?.textContent ?? "";
}

export function status(h: Harness, name: Option): FakeElement {
	const el = option(h, name).querySelector(".cs-option-box-desc");
	assert.ok(el);
	return el;
}

/** The screen-reader-only live region: what the probe found, why a paste failed. */
export function announcer(h: Harness): FakeElement {
	const el = h.contentEl.querySelector(".cs-import-announcer");
	assert.ok(el);
	return el;
}

/**
 * The active option, checked two ways that must agree: the accent border, and
 * `aria-checked` on its box. Null when none is active.
 */
export function active(h: Harness): Option | null {
	const bordered = OPTIONS.filter((name) => option(h, name).hasClass("is-selected"));
	const checked = OPTIONS.filter((name) => option(h, name).getAttribute("aria-checked") === "true");
	assert.deepEqual(bordered, checked, "the border and aria-checked agree");
	assert.ok(bordered.length <= 1, "at most one active option");
	return bordered[0] ?? null;
}

export function fileInput(h: Harness): FakeElement {
	const input = h.contentEl.querySelector(".cs-import-file-input");
	assert.ok(input, "the file input is attached for the window's whole life");
	return input;
}

/**
 * What the picker hands back once a file is picked: the input's `files`, its
 * `value` (the browser's fake path), and `change`. Needs no click on the file
 * box first — the picker is modelled only by its result.
 */
export function stage(h: Harness, name: string, text: () => Promise<string>): void {
	const input = fileInput(h);
	Object.assign(input, { files: [{ name, text }], value: `C:\\fakepath\\${name}` });
	input.fire("change");
}

/**
 * Put `text` on the clipboard and click the paste box; waits for the read.
 *
 * Only for a click that *fills* the box: an empty one, or the active one, which
 * a click fills again. A box that holds a paste but is not the active one is
 * only chosen by a click and never reads the clipboard — asserted here, so a
 * test cannot quietly mistake one for the other.
 */
export async function paste(h: Harness, text: string | Error): Promise<void> {
	const box = option(h, "paste");
	assert.ok(
		!box.hasClass("is-filled") || active(h) === "paste",
		"paste(): a click on this box would only choose it; click it directly instead",
	);
	clipboard.set(text);
	const reads = clipboard.reads();
	box.fire("click");
	await settle();
	assert.equal(clipboard.reads(), reads + 1, "the click read the clipboard");
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
