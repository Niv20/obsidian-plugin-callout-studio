import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readRepoFile } from "./support/sourceScan";

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
		assert.match(
			readRepoFile("src/settings/command/calloutRow.ts"),
			/\.setClass\("cs-command-callout-setting"\)/,
			"Callout type does not carry its wider-field modifier",
		);
	});

	it("keeps configuration fields equal and Callout type wider", () => {
		const commandFieldAt = css.indexOf(".cs-command-field {");
		const calloutOverrideAt = css.indexOf(
			".cs-command-field.cs-command-callout-setting {",
			commandFieldAt,
		);
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
		assert.match(
			css,
			/\.cs-command-field\.cs-command-callout-setting\s*\{[^}]*--cs-command-control-width:\s*220px;[^}]*\}/,
		);
		assert.match(
			css,
			/\.cs-command-field\s+\.setting-item-control\s*\{[^}]*flex:\s*0\s+0\s+auto;[^}]*width:\s*var\(--cs-command-control-width\);[^}]*\}/,
		);
		assert.match(
			css,
			/\.cs-command-field\s+\.setting-item-control\s*>\s*\.cs-combobox\s*\{[^}]*width:\s*100%;[^}]*min-width:\s*0;[^}]*\}/,
		);
		assert.match(
			css,
			/\.is-phone\s+\.cs-command-field\s*\{[^}]*--cs-command-control-width:\s*100%;[^}]*\}/,
		);
		assert.ok(
			commandFieldAt >= 0 &&
				calloutOverrideAt > commandFieldAt &&
				phoneOverrideAt > calloutOverrideAt &&
				phoneOverrideAt < narrowMediaAt,
			"the phone width must override both desktop widths outside a viewport breakpoint",
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
			"src/settings/iconpicker/IconPickerModal.ts",
			"src/settings/CalloutEditor.ts",
		]) {
			assert.match(
				readRepoFile(path),
				/\bcs-scrollable-dropdown-menu\b/,
				`${path} has a custom dropdown without the shared overflow class`,
			);
		}
	});
});
