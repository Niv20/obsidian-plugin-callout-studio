import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { asEl, el, fakeDom } from "./support/fakeDom";
import { readRepoFile } from "./support/sourceScan";
import { buildFormatRow } from "../src/settings/command/commandRoles";
import { DEFAULT_SETTINGS } from "../src/constants";
import { dropdownOptions, dropdownValue, pickDropdown } from "./support/selectDropdown";
import { t } from "../src/i18n";
import { buildActionRow, buildHeadingLevelRow } from "../src/settings/command/optionRows";
import { buildFoldStateRow } from "../src/settings/command/foldStateRow";
import { CommandEditorModal } from "../src/settings/CommandEditorModal";
import type { CalloutDefinition, CustomCommand } from "../src/types";

const modalSource = readRepoFile("src/settings/CommandEditorModal.ts");
const css = readRepoFile("styles.css").replace(/\/\*[\s\S]*?\*\//g, "");

describe("command editor field layout", () => {
	it("puts Callout type before every format-dependent field", () => {
		const onOpen = modalSource.slice(
			modalSource.indexOf("\tonOpen(): void"),
			modalSource.indexOf("\tonClose(): void"),
		);
		const builders = [
			"buildCalloutRow(",
			"buildFormatRow(",
			"buildHeadingLevelRow(",
			"buildActionRow(",
			"buildFoldStateRow(",
		];
		const positions = builders.map((builder) => onOpen.indexOf(builder));
		assert.ok(positions.every((position) => position >= 0));
		assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
	});

	it("marks every control row with the shared width class", () => {
		const rows: ReadonlyArray<readonly [string, number]> = [
			["src/settings/command/calloutRow.ts", 1],
			["src/settings/command/commandRoles.ts", 1],
			["src/settings/command/optionRows.ts", 2],
			["src/settings/command/foldStateRow.ts", 1],
		];
		for (const [path, expected] of rows) {
			const matches = readRepoFile(path).match(
				/\.setClass\("cs-command-field"\)/g,
			);
			assert.equal(
				matches?.length ?? 0,
				expected,
				`${path} does not put every row in the shared command control column`,
			);
		}
	});

	it("fits each field to its current choice instead of one shared 180px column (S8-16)", () => {
		assert.doesNotMatch(css, /--cs-command-control-width/, "no shared column width any more");
		assert.doesNotMatch(css, /\.cs-command-field\s+\.setting-item-control\s*\{/, "the control column sizes to its content");
		assert.doesNotMatch(css, /\.cs-command-field[^{]*\.cs-combobox\s*\{/, "the callout picker has no width of its own here");
		// Obsidian's own caps, in every setting row: 400px for a <select>, 250px
		// for its combobox. Below them, a field is as wide as its words.
		assert.match(css, /\.setting-item-control \.cs-dropdown-field\s*\{[^}]*max-width:\s*400px;/);
		assert.match(css, /\.setting-item-control \.cs-combobox\s*\{[^}]*max-width:\s*250px;/);
	});

	it("puts the five choices in one grey setting group, like the plugin's other windows", () => {
		const onOpen = modalSource.slice(
			modalSource.indexOf("\tonOpen(): void"),
			modalSource.indexOf("\tonClose(): void"),
		);
		assert.match(onOpen, /const form = new SettingGroup\(contentEl\);/);
		for (const builder of ["buildCalloutRow", "buildFormatRow", "buildHeadingLevelRow", "buildActionRow", "buildFoldStateRow"]) {
			assert.match(
				onOpen,
				new RegExp(`${builder}\\(\\s*form\\.listEl,`),
				`${builder} builds into the group's box, not onto the bare window`,
			);
		}
		assert.match(onOpen, /form\.addClass\("cs-editor-group"\)/, "the same 16px inset as the other editors' groups");
	});

	it("shows the command's name in a box of its own, and a duplicate under it (S8-15)", () => {
		assert.match(
			modalSource,
			/const group = new SettingGroup\(parent\);\s*group\.addClass\("cs-editor-group"\);\s*this\.previewSetting = new Setting\(group\.listEl\)\s*\.setName\(t\("commandBuilder\.preview"\)\)\s*\.setClass\("cs-command-name"\)\s*\.addDisplayValue\(/,
		);
		assert.match(modalSource, /this\.previewSetting\?\.setErrorMessage\(/);
		assert.doesNotMatch(css, /\.cs-command-preview/, "no card of the plugin's");
		assert.doesNotMatch(css, /\.cs-command-role-notice/, "the format notice is Obsidian's warning text");
	});

	it("lets a row's description wrap before its choice does", () => {
		// Not a width: the choice keeps the width of its words and the row's
		// description gives way, in the group's box as in a bare window.
		const rule = css.match(/body:not\(\.is-phone\)\s+\.cs-command-field\s*>\s*\.setting-item-control\s*\{([^}]*)\}/)?.[1] ?? "";
		assert.match(rule, /flex-shrink:\s*0;/);
		assert.doesNotMatch(rule, /\bwidth\s*:/);
	});

	it("stacks the name row, so the name has the box's whole width", () => {
		// Beside the label the name had half a row at most, and an invalid row
		// (a duplicate) is held to half by Obsidian itself.
		const row = css.match(/\.setting-item\.cs-command-name\.cs-command-name\s*\{([^}]*)\}/)?.[1] ?? "";
		assert.match(row, /flex-direction:\s*column;/);
		assert.match(row, /align-items:\s*stretch;/);
		const control = css.match(/\.setting-item\.cs-command-name\.cs-command-name\s+\.setting-item-control\s*\{([^}]*)\}/)?.[1] ?? "";
		assert.match(control, /max-width:\s*none;/);
		assert.match(control, /justify-content:\s*flex-start;/);
		assert.match(css, /\.cs-command-name\s+\.setting-item-error\s*\{[^}]*text-align:\s*start;/);
	});

	it("draws the command's name in full, never cut with an ellipsis", () => {
		// Obsidian's own read-only value is one muted line cut with "…"; in a
		// narrow window that squeezed the row's label down to a letter and hid
		// the name.
		const rule = css.match(/\.cs-command-name\s+\.setting-item-value\s*\{([^}]*)\}/)?.[1] ?? "";
		assert.match(rule, /white-space:\s*normal;/);
		assert.match(rule, /overflow-wrap:\s*anywhere;/);
		assert.match(rule, /text-overflow:\s*clip;/);
		assert.match(rule, /color:\s*var\(--text-normal\);/);
		assert.match(rule, /font-size:\s*var\(--font-ui-medium\);/, "the size of a row's label, not Obsidian's small note");
		assert.match(rule, /text-align:\s*start;/);
	});
});

describe("dropdown field text", () => {
	it("sits where Obsidian's own token puts it: the plugin sets neither the token nor text-align", () => {
		// Obsidian's token is `start` (the left edge in English, the right in
		// Hebrew) everywhere but its macOS settings window. A field stretched
		// across a row, such as Find callouts' type field, keeps its icon and
		// name together at the start; until 2026-11-01 the field set `end` on
		// itself, and the icon stayed at one edge with the name at the other.
		for (const rule of css.matchAll(/[^{}]*\.cs-dropdown-field[^{}]*\{([^}]*)\}/g)) {
			assert.doesNotMatch(rule[1]!, /--dropdown-text-align\s*:/, rule[0].trim().split("{")[0]);
			assert.doesNotMatch(rule[1]!, /(^|[;\s])text-align\s*:/, "Obsidian's own rule does the aligning");
		}
	});

	it("leaves the rows of a list at the start, as Obsidian's menus are", () => {
		assert.match(css, /\.cs-combobox-popup\s*\{[^}]*text-align:\s*start;/);
	});
});

describe("custom dropdown overflow", () => {
	it("caps the popover's height, and scrolls the list inside it", () => {
		assert.match(
			css,
			/\.cs-combobox-popup\.suggestion-container\s*\{[^}]*max-height:\s*var\(--cs-combobox-menu-max-height,\s*320px\);[^}]*\}/,
		);
		// Obsidian's `.suggestion` scrolls; the list may shrink below its rows for it.
		assert.match(readRepoFile("src/ui/listboxPopupDom.ts"), /cls: "suggestion cs-combobox-menu"/);
		assert.match(css, /\.cs-combobox-menu\s*\{[^}]*min-height:\s*0;/);
	});

	it("leaves no hand-built dropdown: the callout editor's fold state is a plain choice", () => {
		const editor = readRepoFile("src/settings/CalloutEditor.ts");
		assert.doesNotMatch(editor, /cs-palette-menu|cs-fold-menu|cs-palette-trigger/);
		assert.match(editor, /new SelectDropdown\(foldControl,/);
	});

	it("keeps group headings pinned over a solid menu surface while scrolling", () => {
		assert.match(
			css,
			/\.cs-combobox-group-label\s*\{[^}]*position:\s*sticky;[^}]*top:\s*0;[^}]*background(?:-color)?:\s*var\(--cs-menu-face\);[^}]*\}/,
		);
	});
});

describe("command editor choices", () => {
	it("offers registered types, starts on Note, and preserves a saved legacy choice", () => {
		const choices = [
			{ id: "-", displayName: " ", source: "fallback" },
			{ id: "note", displayName: "Note", source: "builtin" },
			{ id: "theme-only", displayName: "Theme", source: "theme" },
		] as CalloutDefinition[];
		const host = {
			registry: {
				getBuiltIn: () => choices.filter((def) => def.source === "builtin"),
				getUserDefined: () => choices.filter((def) => def.source === "fallback"),
				getThemeProvided: () => choices.filter((def) => def.source === "theme"),
				get: (id: string) => choices.find((def) => def.id === id),
			},
		} as ConstructorParameters<typeof CommandEditorModal>[1];
		const app = {} as ConstructorParameters<typeof CommandEditorModal>[0];
		const selected = (modal: CommandEditorModal) =>
			(modal as unknown as { calloutId: string }).calloutId;

		const available = (modal: CommandEditorModal) =>
			(modal as unknown as { getChoices(): CalloutDefinition[] }).getChoices().map((def) => def.id);
		const fresh = new CommandEditorModal(app, host);
		assert.equal(selected(fresh), "note");
		assert.deepEqual(available(fresh), ["-", "note"]);
		const existing: CustomCommand = { id: "saved", calloutId: "-", role: "regular" };
		assert.equal(selected(new CommandEditorModal(app, host, { existing })), "-");
		const legacy = new CommandEditorModal(app, host, { existing: { ...existing, calloutId: "theme-only" } });
		assert.equal(selected(legacy), "theme-only");
		assert.deepEqual(available(legacy), ["-", "note", "theme-only"]);
	});

	it("uses the shared plain choice, opening Obsidian's menu, for heading, action, and fold state", () => {
		fakeDom.light();
		const host = el();
		const before = fakeDom.document.listeners.get("click")?.length ?? 0;
		const headingValues: number[] = [];
		const actionValues: string[] = [];
		const foldValues: string[] = [];
		const heading = buildHeadingLevelRow(asEl(host), 3, (value) => headingValues.push(value));
		const action = buildActionRow(asEl(host), "insert", (value) => actionValues.push(value));
		const fold = buildFoldStateRow(asEl(host), "none", (value) => foldValues.push(value));
		try {
			const controls = host.querySelectorAll(".cs-select-dropdown").map((control) => asEl(control));
			assert.equal(controls.length, 3);
			assert.equal(host.querySelectorAll("select").length, 0);
			assert.equal(host.querySelectorAll("input").length, 0, "plain choices are Obsidian's dropdown, not text fields");

			assert.equal(dropdownValue(controls[0]!), "H3");
			assert.deepEqual(dropdownOptions(controls[0]!).map((option) => option.title), ["H1", "H2", "H3", "H4", "H5", "H6"]);
			pickDropdown(controls[0]!, "H2");
			assert.deepEqual(headingValues, [2]);

			pickDropdown(controls[1]!, t("commandBuilder.actionWrap"));
			assert.deepEqual(actionValues, ["wrap"]);

			fold.sync("heading");
			assert.ok(asEl(host).querySelectorAll(".setting-item")[2]?.hasClass("cs-row-hidden"));
			fold.sync("regular");
			assert.ok(!asEl(host).querySelectorAll(".setting-item")[2]?.hasClass("cs-row-hidden"));
			pickDropdown(controls[2]!, t("commandBuilder.foldCollapsed"));
			assert.deepEqual(foldValues, ["collapsed"]);
		} finally {
			heading.dropdown.destroy();
			action.dropdown.destroy();
			fold.destroy();
		}
		assert.equal(fakeDom.document.listeners.get("click")?.length ?? 0, before);
	});

	it("explains Wrap and Insert for the format the command writes, one sentence a line", () => {
		fakeDom.light();
		const host = el();
		const action = buildActionRow(asEl(host), "wrap", () => {});
		const description = () => host.querySelector(".setting-item-description");
		try {
			for (const [role, key] of [
				["regular", "commandBuilder.actionDesc"],
				["heading", "commandBuilder.actionDescHeading"],
				["inline", "commandBuilder.actionDescInline"],
			] as const) {
				action.describe(role);
				assert.equal(description()?.textContent, t(key).replace(/\n/g, ""), role);
				assert.equal(description()?.querySelectorAll("br").length, t(key).split("\n").length - 1, role);
			}
		} finally {
			action.dropdown.destroy();
		}
	});

	it("starts a new command on Wrap, and an old one on what it always did", () => {
		const host = {
			registry: { getBuiltIn: () => [], getUserDefined: () => [], getThemeProvided: () => [], get: () => undefined },
		} as unknown as ConstructorParameters<typeof CommandEditorModal>[1];
		const app = {} as ConstructorParameters<typeof CommandEditorModal>[0];
		const actionOf = (existing?: CustomCommand) =>
			(new CommandEditorModal(app, host, existing ? { existing } : {}) as unknown as { action: string }).action;
		assert.equal(actionOf(), "wrap");
		assert.equal(actionOf({ id: "a", calloutId: "note", role: "regular" }), "insert");
		assert.equal(actionOf({ id: "b", calloutId: "note", role: "heading", headingLevel: 2 }), "wrap");
		assert.equal(actionOf({ id: "c", calloutId: "note", role: "inline" }), "wrap");
		assert.equal(actionOf({ id: "d", calloutId: "note", role: "inline", action: "insert" }), "insert");
	});

	it("refreshes the open format list when theme ownership narrows its options", () => {
		const host = el();
		const before = fakeDom.document.listeners.get("click")?.length ?? 0;
		let themeOwned = false;
		const registry = {
			get: () => ({ id: "note" } as CalloutDefinition),
			themeOwns: () => themeOwned,
		};
		const picked: string[] = [];
		const row = buildFormatRow(asEl(host), (value) => picked.push(value));
		try {
			assert.equal(row.sync(registry, DEFAULT_SETTINGS, "note", "heading"), "heading");
			assert.equal(dropdownValue(asEl(host)), t("commandBuilder.formatHeading"));
			const openMenu = dropdownOptions(asEl(host));
			assert.equal(openMenu.length, 3);
			themeOwned = true;
			assert.equal(row.sync(registry, DEFAULT_SETTINGS, "note", "heading"), "regular");
			// The narrowed options close the open menu; a fresh one offers only Block.
			const options = dropdownOptions(asEl(host));
			assert.deepEqual(options.map((option) => option.title), [t("commandBuilder.formatBlock")]);
			assert.ok(options[0]?.checked);
			pickDropdown(asEl(host), t("commandBuilder.formatBlock"));
			assert.deepEqual(picked, [], "a programmatic fallback and same-value click do not synthesize changes");
			themeOwned = false;
			row.sync(registry, DEFAULT_SETTINGS, "note", "regular");
			pickDropdown(asEl(host), t("commandBuilder.formatHeading"));
			assert.deepEqual(picked, ["heading"]);
		} finally {
			row.destroy();
		}
		assert.equal(fakeDom.document.listeners.get("click")?.length ?? 0, before);
	});
});
