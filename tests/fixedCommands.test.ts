/**
 * tests/fixedCommands.test.ts — the built-in commands the plugin always ships.
 *
 * Command ids are stable API: Obsidian keys the user's hotkey by id, so a
 * renamed id is a silently unbound shortcut and a *drifted list* is worse — the
 * command builder deep-links the user to commands from `FIXED_COMMAND_IDS`, and
 * an entry there that `registerCalloutCommands` does not actually register
 * sends them to a command that isn't in the palette. So the first suite below
 * checks the declared list against what is really handed to `addCommand`, in
 * both directions, rather than checking the constant against itself.
 *
 * The other two decisions:
 *
 * - **Disabling tears the command down** (`removeCommand`) rather than hiding
 *   it, so it leaves the palette and the hotkeys pane too. Obsidian clears only
 *   a removed command's *default* keys, never the user's, which is what makes
 *   re-enabling at the same id give the binding back.
 * - **`refreshFixedCommandNames` re-adds at the same id, and only when the
 *   rendered name really changed.** Same id is what saves the hotkey when a
 *   translation lands after startup; "only when changed" is because `addCommand`
 *   mutates its argument and appends an unload callback, so a needless call
 *   accumulates both.
 *
 * `registeredNames` is module state shared by the whole file, exactly as it is
 * shared by a running plugin. Every test here starts from
 * `registerCalloutCommands`, which rewrites it, so no test inherits another's.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import type { Command } from "obsidian";
import {
	FIXED_COMMAND_IDS,
	FIXED_COMMAND_NAME_KEYS,
	isFixedCommandEnabled,
	refreshFixedCommandNames,
	registerCalloutCommands,
	setFixedCommandEnabled,
	type FixedCommandId,
} from "../src/editor/commands";
import { registerLocale, setLocale, t } from "../src/i18n";
import { DEFAULT_SETTINGS } from "../src/constants";
import type { PluginSettings } from "../src/types";
import { asEditor, editor, FakeEditor } from "./support/fakeEditor";

/* -------------------------------------------------------------------------- */
/* Harness                                                                    */
/* -------------------------------------------------------------------------- */

type Host = Parameters<typeof registerCalloutCommands>[0];

interface CommandHost {
	plugin: Host;
	/** Every `addCommand` payload, in call order. */
	added: Command[];
	/** Every id handed to `removeCommand`, in call order. */
	removed: string[];
	settings: PluginSettings;
	/** Editors the autocomplete popover was re-triggered in. */
	triggered: unknown[];
}

function host(over: Partial<PluginSettings> = {}): CommandHost {
	const added: Command[] = [];
	const removed: string[] = [];
	const triggered: unknown[] = [];
	const settings = { ...structuredClone(DEFAULT_SETTINGS), ...over };
	const plugin = {
		manifest: { id: "callout-studio" },
		settings,
		addCommand: (command: Command) => {
			added.push(command);
			return command;
		},
		removeCommand: (id: string) => void removed.push(id),
		autoComplete: {
			triggerNow: (ed: unknown) => void triggered.push(ed),
		},
		app: {
			setting: { open: () => undefined, openTabById: () => undefined },
			workspace: { getActiveFile: () => null },
		},
	};
	return { plugin: plugin as unknown as Host, added, removed, settings, triggered };
}

/**
 * The windows the commands are handed. Both throw: no test here presses the two
 * buttons that open one, so a call means a command opened a window it should
 * not have.
 */
const noEditor = (() => {
	throw new Error("the callout editor must not be constructed here");
}) as never;

/** Records quick-insert opens, so the one test that wants one can see it. */
let quickInsertOpens = 0;

const deps = (): Parameters<typeof registerCalloutCommands>[1] => ({
	openEditor: noEditor,
	openQuickInsert: () => void (quickInsertOpens += 1),
	openOccurrences: () => {},
});

const idsOf = (commands: Command[]): string[] => commands.map((c) => c.id);

/* -------------------------------------------------------------------------- */
/* 107 — the declared list vs. what is registered                              */
/* -------------------------------------------------------------------------- */

describe("FIXED_COMMAND_IDS — no drift", () => {
	it("registers exactly the declared ids, in the declared order", () => {
		const h = host();
		registerCalloutCommands(h.plugin, deps());

		assert.deepStrictEqual(idsOf(h.added), [...FIXED_COMMAND_IDS]);
	});

	it("registers nothing the list does not declare", () => {
		const h = host();
		registerCalloutCommands(h.plugin, deps());

		const declared = new Set<string>(FIXED_COMMAND_IDS);
		for (const command of h.added) {
			assert.ok(declared.has(command.id), `stray command "${command.id}"`);
		}
	});

	it("declares unique command ids", () => {
		assert.ok(FIXED_COMMAND_IDS.length >= 7);
		assert.strictEqual(new Set(FIXED_COMMAND_IDS).size, FIXED_COMMAND_IDS.length);
	});

	it("carries a name key for every id and an id for every name key", () => {
		// A total record either way: a new fixed command cannot be declared
		// without a name, and a name key cannot outlive its command.
		assert.deepStrictEqual(
			Object.keys(FIXED_COMMAND_NAME_KEYS).sort(),
			[...FIXED_COMMAND_IDS].sort(),
		);
	});

	it("names every command from a key English actually defines", () => {
		for (const id of FIXED_COMMAND_IDS) {
			const key = FIXED_COMMAND_NAME_KEYS[id];
			assert.notStrictEqual(
				t(key),
				key,
				`"${key}" falls through to the raw key`,
			);
		}
	});

	it("gives each registered command that key's translation", () => {
		const h = host();
		registerCalloutCommands(h.plugin, deps());

		for (const command of h.added) {
			const key = FIXED_COMMAND_NAME_KEYS[command.id as FixedCommandId];
			assert.strictEqual(command.name, t(key));
		}
	});

	it("gives them distinct names, so the palette can tell them apart", () => {
		const h = host();
		registerCalloutCommands(h.plugin, deps());

		assert.strictEqual(
			new Set(h.added.map((c) => c.name)).size,
			FIXED_COMMAND_IDS.length,
		);
	});

	it("splits them into the two callback kinds Obsidian offers", () => {
		// The three that need no editor are plain callbacks, so they stay
		// available with no note open; the three that edit text are
		// editorCallbacks. Quick insert is in the first group on purpose: the
		// window browses and edits callouts too, and it resolves its own target
		// editor rather than being handed one at the moment the palette opened.
		const h = host();
		registerCalloutCommands(h.plugin, deps());
		const byId = new Map(h.added.map((c) => [c.id, c]));

		for (const id of ["open-settings", "create-callout", "open-quick-insert", "show-callout-occurrences"]) {
			assert.strictEqual(typeof byId.get(id)?.callback, "function", id);
			assert.strictEqual(byId.get(id)?.editorCallback, undefined, id);
		}
		for (const id of ["insert-empty-callout", "callout-wrap", "callout-unwrap"]) {
			assert.strictEqual(typeof byId.get(id)?.editorCallback, "function", id);
			assert.strictEqual(byId.get(id)?.callback, undefined, id);
		}
	});
});

describe("open-quick-insert", () => {
	it("opens the window it was handed, and touches no editor", () => {
		const h = host();
		const before = quickInsertOpens;
		registerCalloutCommands(h.plugin, deps());

		const command = h.added.find((c) => c.id === "open-quick-insert");
		assert.ok(command?.callback, "registered without a callback");
		command.callback();

		assert.strictEqual(quickInsertOpens, before + 1);
		// The window resolves its own target editor when the user presses
		// Insert; the command must not pre-empt that by re-triggering the
		// autocomplete popover the way the two writing commands do.
		assert.deepStrictEqual(h.triggered, []);
	});

	it("appends Callout occurrences after the existing built-ins", () => {
		assert.deepStrictEqual(FIXED_COMMAND_IDS.slice(0, 6), [
			"open-settings", "create-callout", "insert-empty-callout",
			"callout-wrap", "callout-unwrap", "open-quick-insert",
		]);
		assert.equal(FIXED_COMMAND_IDS.at(-1), "show-callout-occurrences");
	});
});

describe("show-callout-occurrences", () => {
	it("opens the occurrence view through its injected owner", () => {
		const h = host();
		let opens = 0;
		registerCalloutCommands(h.plugin, { ...deps(), openOccurrences: () => { opens += 1; } });
		const command = h.added.find((item) => item.id === "show-callout-occurrences");
		assert.ok(command?.callback);
		command.callback();
		assert.equal(opens, 1);
	});
});

/* -------------------------------------------------------------------------- */
/* What the three editor commands do                                           */
/* -------------------------------------------------------------------------- */

describe("the editor commands", () => {
	function run(id: FixedCommandId, buffer: string): { h: CommandHost; ed: FakeEditor } {
		const h = host();
		registerCalloutCommands(h.plugin, deps());
		const command = h.added.find((c) => c.id === id);
		assert.ok(command?.editorCallback);
		const ed = editor(buffer);
		command.editorCallback(asEditor(ed), {} as never);
		return { h, ed };
	}

	it("inserts an open header and re-opens the popover on it", () => {
		// The header is left unfinished on purpose — the popover finishes it —
		// which is why the command has to re-trigger it by hand: Obsidian only
		// re-evaluates onTrigger on real keystrokes.
		const { h, ed } = run("insert-empty-callout", "");
		assert.strictEqual(ed.getValue(), "> [!");
		assert.strictEqual(h.triggered.length, 1);
	});

	it("wraps the current line and re-opens the popover", () => {
		const { h, ed } = run("callout-wrap", "hello");
		assert.strictEqual(ed.getValue(), "> [!\n> hello");
		assert.strictEqual(h.triggered.length, 1);
	});

	it("unwraps without re-opening it — there is no header to finish", () => {
		const { h, ed } = run("callout-unwrap", "> [!note] Note\n> body");
		assert.strictEqual(ed.getValue(), "body");
		assert.strictEqual(h.triggered.length, 0);
	});
});

/* -------------------------------------------------------------------------- */
/* 108 — enabling and disabling                                                */
/* -------------------------------------------------------------------------- */

describe("isFixedCommandEnabled", () => {
	it("treats an unlisted command as on — the empty list means all five", () => {
		for (const id of FIXED_COMMAND_IDS) {
			assert.strictEqual(
				isFixedCommandEnabled({ disabledFixedCommands: [] }, id),
				true,
			);
		}
	});

	it("treats a listed command as off", () => {
		const settings = { disabledFixedCommands: ["callout-wrap"] };
		assert.strictEqual(isFixedCommandEnabled(settings, "callout-wrap"), false);
		assert.strictEqual(isFixedCommandEnabled(settings, "callout-unwrap"), true);
	});
});

describe("registerCalloutCommands — skipping the disabled", () => {
	it("does not register a command the user turned off", () => {
		const h = host({ disabledFixedCommands: ["callout-wrap", "open-settings"] });
		registerCalloutCommands(h.plugin, deps());

		assert.deepStrictEqual(idsOf(h.added), [
			"create-callout",
			"insert-empty-callout",
			"callout-unwrap",
			"open-quick-insert",
			"show-callout-occurrences",
		]);
	});

	it("registers nothing at all when every one is off", () => {
		const h = host({ disabledFixedCommands: [...FIXED_COMMAND_IDS] });
		registerCalloutCommands(h.plugin, deps());

		assert.deepStrictEqual(h.added, []);
	});
});

describe("setFixedCommandEnabled", () => {
	it("tears a command down rather than hiding it", () => {
		const h = host();
		registerCalloutCommands(h.plugin, deps());
		setFixedCommandEnabled(h.plugin, deps(), "callout-wrap", false);

		assert.deepStrictEqual(h.removed, ["callout-wrap"]);
		assert.deepStrictEqual(h.settings.disabledFixedCommands, ["callout-wrap"]);
	});

	it("re-registers under the SAME id, which is what returns the hotkey", () => {
		const h = host({ disabledFixedCommands: ["callout-wrap"] });
		registerCalloutCommands(h.plugin, deps());
		assert.ok(!idsOf(h.added).includes("callout-wrap"));

		setFixedCommandEnabled(h.plugin, deps(), "callout-wrap", true);

		assert.strictEqual(h.added.at(-1)?.id, "callout-wrap");
		assert.strictEqual(h.added.at(-1)?.name, t("cmd.calloutWrap"));
		assert.deepStrictEqual(h.settings.disabledFixedCommands, []);
	});

	it("builds the re-registered command from the same definition as startup", () => {
		const fresh = host();
		registerCalloutCommands(fresh.plugin, deps());
		const atStartup = fresh.added.find((c) => c.id === "callout-unwrap");

		const h = host({ disabledFixedCommands: ["callout-unwrap"] });
		registerCalloutCommands(h.plugin, deps());
		setFixedCommandEnabled(h.plugin, deps(), "callout-unwrap", true);
		const reEnabled = h.added.at(-1);

		assert.strictEqual(reEnabled?.name, atStartup?.name);
		assert.strictEqual(typeof reEnabled?.editorCallback, "function");
		assert.strictEqual(reEnabled?.callback, atStartup?.callback);
	});

	it("does not list a command twice when disabled twice", () => {
		const h = host();
		registerCalloutCommands(h.plugin, deps());
		setFixedCommandEnabled(h.plugin, deps(), "callout-wrap", false);
		setFixedCommandEnabled(h.plugin, deps(), "callout-wrap", false);

		assert.deepStrictEqual(h.settings.disabledFixedCommands, ["callout-wrap"]);
	});

	it("leaves the list alone when enabling one that was never off", () => {
		const h = host();
		registerCalloutCommands(h.plugin, deps());
		setFixedCommandEnabled(h.plugin, deps(), "callout-wrap", true);

		assert.deepStrictEqual(h.settings.disabledFixedCommands, []);
	});

	it("survives a disable/enable round trip with the same id and name", () => {
		const h = host();
		registerCalloutCommands(h.plugin, deps());
		const before = h.added.find((c) => c.id === "callout-wrap");

		setFixedCommandEnabled(h.plugin, deps(), "callout-wrap", false);
		setFixedCommandEnabled(h.plugin, deps(), "callout-wrap", true);

		assert.deepStrictEqual(h.settings.disabledFixedCommands, []);
		assert.strictEqual(h.added.at(-1)?.id, before?.id);
		assert.strictEqual(h.added.at(-1)?.name, before?.name);
	});
});

/* -------------------------------------------------------------------------- */
/* 109 — refreshing the names                                                  */
/* -------------------------------------------------------------------------- */

describe("refreshFixedCommandNames", () => {
	it("does nothing at all when no name changed", () => {
		const h = host();
		registerCalloutCommands(h.plugin, deps());
		const registered = h.added.length;

		refreshFixedCommandNames(h.plugin, deps());
		refreshFixedCommandNames(h.plugin, deps());

		assert.strictEqual(h.added.length, registered, "addCommand was called again");
		assert.deepStrictEqual(h.removed, []);
	});

	it("re-registers at the SAME id when a translation arrives", () => {
		const h = host();
		registerCalloutCommands(h.plugin, deps());
		const before = h.added.length;

		registerLocale("cs-test", {
			"cmd.openSettings": "Ouvrir les paramètres",
			"cmd.createCallout": "Créer un type",
			"cmd.insertEmptyCallout": "Insérer une callout",
			"cmd.calloutWrap": "Envelopper",
			"cmd.calloutUnwrap": "Désenvelopper",
			"cmd.openQuickInsert": "Insertion rapide",
			"usage.title": "Occurrences de callout",
		});
		setLocale("cs-test");
		try {
			refreshFixedCommandNames(h.plugin, deps());

			const again = h.added.slice(before);
			assert.deepStrictEqual(idsOf(again), [...FIXED_COMMAND_IDS]);
			assert.strictEqual(again[0]?.name, "Ouvrir les paramètres");
			// Never removed and re-added — Obsidian keys the hotkey by id, so
			// re-adding in place is exactly what preserves it.
			assert.deepStrictEqual(h.removed, []);
		} finally {
			setLocale("en");
		}
	});

	it("re-registers only the commands whose name really moved", () => {
		const h = host();
		registerCalloutCommands(h.plugin, deps());
		const before = h.added.length;

		// A partial table: everything else falls through to English unchanged.
		registerLocale("cs-partial", { "cmd.calloutWrap": "Envelopper" });
		setLocale("cs-partial");
		try {
			refreshFixedCommandNames(h.plugin, deps());
			assert.deepStrictEqual(idsOf(h.added.slice(before)), ["callout-wrap"]);
		} finally {
			setLocale("en");
		}
	});

	it("skips a command the user turned off", () => {
		const h = host({ disabledFixedCommands: ["callout-wrap"] });
		registerCalloutCommands(h.plugin, deps());
		const before = h.added.length;

		registerLocale("cs-partial2", { "cmd.calloutWrap": "Envelopper encore" });
		setLocale("cs-partial2");
		try {
			refreshFixedCommandNames(h.plugin, deps());
			assert.strictEqual(h.added.length, before);
		} finally {
			setLocale("en");
		}
	});

	it("hands addCommand a fresh object every time", () => {
		// It mutates what it is given (prefixing the id and the name in place),
		// so handing back the same object would compound the prefixes.
		const h = host();
		registerCalloutCommands(h.plugin, deps());
		const first = h.added.find((c) => c.id === "callout-wrap");

		registerLocale("cs-fresh", { "cmd.calloutWrap": "Envelopper à nouveau" });
		setLocale("cs-fresh");
		try {
			refreshFixedCommandNames(h.plugin, deps());
			assert.notStrictEqual(h.added.at(-1), first);
		} finally {
			setLocale("en");
		}
	});
});
