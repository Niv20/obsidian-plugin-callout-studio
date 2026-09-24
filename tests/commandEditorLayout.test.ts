import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { asEl, el, fakeDom } from "./support/fakeDom";
import { readRepoFile } from "./support/sourceScan";
import { buildFormatRow } from "../src/settings/command/commandRoles";
import { DEFAULT_SETTINGS } from "../src/constants";
import { dropdownOptions } from "./support/selectDropdown";
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

	it("keeps all five command fields the same width", () => {
		const commandFieldAt = css.indexOf(".cs-command-field {");
		const phoneOverrideAt = css.indexOf(
			".is-phone .cs-command-field {",
			commandFieldAt,
		);
		const narrowMediaAt = css.indexOf(
			"@media (max-width: 600px)",
			commandFieldAt,
		);
		assert.match(
			css,
			/\.cs-command-field\s*\{[^}]*--cs-command-control-width:\s*180px;[^}]*\}/,
		);
		assert.doesNotMatch(css, /\.cs-command-field\.cs-command-callout-setting\s*\{/);
		assert.match(
			css,
			/\.cs-command-field\s+\.setting-item-control\s*\{[^}]*flex:\s*0\s+0\s+auto;[^}]*width:\s*var\(--cs-command-control-width\);[^}]*\}/,
		);
		assert.match(
			css,
			/\.cs-command-field\s+\.setting-item-control\s*>\s*\.cs-combobox\s*\{[^}]*width:\s*100%;[^}]*min-width:\s*0;[^}]*\}/,
		);
		assert.match(css, /\.cs-select-dropdown\s+\.cs-combobox-lead\s*\{[^}]*display:\s*none;[^}]*\}/);
		assert.match(
			css,
			/\.is-phone\s+\.cs-command-field\s*\{[^}]*--cs-command-control-width:\s*100%;[^}]*\}/,
		);
		assert.ok(
			commandFieldAt >= 0 &&
				phoneOverrideAt > commandFieldAt &&
				phoneOverrideAt < narrowMediaAt,
			"the phone width must override the shared desktop width outside a viewport breakpoint",
		);
	});
});

describe("custom dropdown overflow", () => {
	it("uses one scrollable maximum-height contract", () => {
		assert.match(
			css,
			/\.cs-scrollable-dropdown-menu\s*\{[^}]*max-height:\s*var\(--cs-combobox-menu-max-height,\s*320px\);[^}]*overflow-y:\s*auto;[^}]*\}/,
		);
	});

	it("applies the contract to every custom dropdown implementation", () => {
		for (const path of [
			"src/ui/listboxPopupDom.ts",
			"src/settings/CalloutEditor.ts",
		]) {
			assert.match(
				readRepoFile(path),
				/\bcs-scrollable-dropdown-menu\b/,
				`${path} has a custom dropdown without the shared overflow class`,
			);
		}
	});

	it("keeps group headings pinned over a solid menu surface while scrolling", () => {
		assert.match(
			css,
			/\.cs-combobox-group-label\s*\{[^}]*position:\s*sticky;[^}]*top:\s*0;[^}]*background(?:-color)?:\s*var\(--cs-surface,\s*var\(--background-primary\)\);[^}]*\}/,
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

	it("uses the shared noneditable picker for heading, action, and fold state", () => {
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
			const controls = host.querySelectorAll(".cs-select-dropdown");
			assert.equal(controls.length, 3);
			assert.equal(host.querySelectorAll("select").length, 0);
			assert.ok(controls.every((control) => control.querySelector(".cs-combobox-input")?.readOnly));

			const headingInput = controls[0]?.querySelector(".cs-combobox-input");
			assert.equal(headingInput?.value, "H3");
			dropdownOptions(asEl(controls[0]!));
			const headingOptions = controls[0]?.querySelectorAll(".cs-combobox-option") ?? [];
			assert.deepEqual(headingOptions.map((option) => option.textContent), ["H1", "H2", "H3", "H4", "H5", "H6"]);
			headingOptions[1]?.fire("click");
			assert.deepEqual(headingValues, [2]);

			dropdownOptions(asEl(controls[1]!));
			controls[1]?.querySelectorAll(".cs-combobox-option")[0]?.fire("click");
			assert.deepEqual(actionValues, ["wrap"]);

			fold.sync("heading");
			assert.ok(asEl(host).querySelectorAll(".setting-item")[2]?.hasClass("cs-row-hidden"));
			fold.sync("regular");
			assert.ok(!asEl(host).querySelectorAll(".setting-item")[2]?.hasClass("cs-row-hidden"));
			dropdownOptions(asEl(controls[2]!));
			controls[2]?.querySelectorAll(".cs-combobox-option")[2]?.fire("click");
			assert.deepEqual(foldValues, ["collapsed"]);
		} finally {
			heading.dropdown.destroy();
			action.dropdown.destroy();
			fold.destroy();
		}
		assert.equal(fakeDom.document.listeners.get("click")?.length ?? 0, before);
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
			const input = host.querySelector(".cs-combobox-input");
			assert.equal(input?.value, t("commandBuilder.formatHeading"));
			dropdownOptions(asEl(host));
			themeOwned = true;
			assert.equal(row.sync(registry, DEFAULT_SETTINGS, "note", "heading"), "regular");
			const options = host.querySelectorAll(".cs-combobox-option");
			assert.deepEqual(options.map((option) => option.textContent), [t("commandBuilder.formatBlock")]);
			assert.ok(options[0]?.hasClass("is-selected"));
			options[0]?.fire("click");
			assert.deepEqual(picked, [], "a programmatic fallback and same-value click do not synthesize changes");
			themeOwned = false;
			row.sync(registry, DEFAULT_SETTINGS, "note", "regular");
			dropdownOptions(asEl(host))[0]?.fire("click");
			assert.deepEqual(picked, ["heading"]);
		} finally {
			row.destroy();
		}
		assert.equal(fakeDom.document.listeners.get("click")?.length ?? 0, before);
	});
});
