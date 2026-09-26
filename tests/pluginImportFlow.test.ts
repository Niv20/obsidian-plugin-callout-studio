/**
 * tests/pluginImportFlow.test.ts — the rule behind the plugin import window's
 * one Import button, and the two sources that feed it.
 *
 * The window used to show an Import inside the "This vault" row beside a footer
 * Import that only read the paste box. pluginImportFlow.ts now decides, from
 * plain state, which of the three options is active and so what the single
 * footer Import acts on. These cases state that rule from the user's side —
 * which box wears the accent border — rather than restating the
 * implementation, so a change that lets Import reach an option the user did
 * not choose fails here. tests/pluginImportModal.test.ts checks the same rule
 * on the real window.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { en } from "../src/i18n/en";
import { ADMONITION_IMPORT } from "../src/settings/pluginImport/admonitionImportSource";
import { CALLOUT_MANAGER_IMPORT } from "../src/settings/pluginImport/calloutManagerImportSource";
import {
	IMPORT_OPTIONS,
	activeOption,
	canImport,
	initialFlow,
	isFilled,
	vaultUnavailable,
	type ImportFlow,
	type ProbeState,
} from "../src/settings/pluginImport/pluginImportFlow";
import { probeVault } from "../src/settings/pluginImport/pluginImportSource";

const PROBES: ProbeState[] = ["checking", "found", "empty", "notInstalled", "unreadable"];

function everyFlow(): ImportFlow[] {
	const out: ImportFlow[] = [];
	for (const probe of PROBES)
		for (const chosen of [null, ...IMPORT_OPTIONS])
			for (const hasFile of [false, true])
				for (const hasPaste of [false, true])
					for (const busy of [false, true])
						out.push({ probe, chosen, hasFile, hasPaste, busy });
	return out;
}

describe("the import flow", () => {
	it("opens with nothing active and nothing to import", () => {
		const flow = initialFlow();
		assert.equal(activeOption(flow), null);
		assert.equal(canImport(flow), false);
	});

	it("makes the vault the active option once found, until the user chooses another", () => {
		const found = { ...initialFlow(), probe: "found" as const };
		assert.equal(activeOption(found), "vault");
		assert.equal(activeOption({ ...found, hasFile: true }), "vault", "a staged file alone does not take over");
		assert.equal(activeOption({ ...found, hasFile: true, chosen: "file" }), "file");
		assert.equal(activeOption({ ...found, hasPaste: true, chosen: "paste" }), "paste");
	});

	it("only ever makes active an option that holds something", () => {
		for (const flow of everyFlow()) {
			const active = activeOption(flow);
			if (active !== null) assert.ok(isFilled(flow, active), JSON.stringify(flow));
		}
	});

	it("honours the user's choice while it holds something, whatever else is filled", () => {
		for (const flow of everyFlow()) {
			if (flow.chosen === null || !isFilled(flow, flow.chosen)) continue;
			assert.equal(activeOption(flow), flow.chosen, JSON.stringify(flow));
		}
	});

	it("falls back to the vault, or to nothing, when the chosen option is emptied", () => {
		for (const flow of everyFlow()) {
			if (flow.chosen !== null && isFilled(flow, flow.chosen)) continue;
			assert.equal(
				activeOption(flow),
				flow.probe === "found" ? "vault" : null,
				JSON.stringify(flow),
			);
		}
	});

	it("never picks a filled file or paste on the user's behalf", () => {
		// Keeping what an option was given is only safe if holding something
		// is never enough to become what Import acts on.
		for (const flow of everyFlow().filter((f) => f.chosen === null)) {
			assert.notEqual(activeOption(flow), "file", JSON.stringify(flow));
			assert.notEqual(activeOption(flow), "paste", JSON.stringify(flow));
		}
	});

	it("greys the vault out only once the probe has settled on nothing", () => {
		assert.equal(vaultUnavailable("checking"), false);
		assert.equal(vaultUnavailable("found"), false);
		assert.equal(vaultUnavailable("empty"), true);
		assert.equal(vaultUnavailable("notInstalled"), true);
		assert.equal(vaultUnavailable("unreadable"), true);
	});

	it("is never ready while busy", () => {
		for (const flow of everyFlow().filter((f) => f.busy)) {
			assert.equal(canImport(flow), false, JSON.stringify(flow));
		}
	});

	it("is ready exactly when it is idle and an option is active", () => {
		for (const flow of everyFlow().filter((f) => !f.busy)) {
			assert.equal(canImport(flow), activeOption(flow) !== null, JSON.stringify(flow));
		}
	});
});

describe("the Admonition and Callout Manager sources", () => {
	for (const source of [ADMONITION_IMPORT, CALLOUT_MANAGER_IMPORT]) {
		it(`${source.pluginId}: every copy key exists in en.ts`, () => {
			for (const key of Object.values(source.copy)) {
				assert.ok(key in en, `${key} is not an English key`);
			}
		});
	}

	it("Callout Manager tells a data.json from copied styles by the first character", () => {
		assert.deepEqual(CALLOUT_MANAGER_IMPORT.fromText("{not json"), { errorKey: "import.err.parseFailed" });
		assert.deepEqual(CALLOUT_MANAGER_IMPORT.fromText('{"x": 1}'), { errorKey: "import.err.cmNotRecognized" });
		const css = CALLOUT_MANAGER_IMPORT.fromText(
			'.callout[data-callout="note-x"] { --callout-color: 255, 0, 0; }',
		);
		assert.ok("batch" in css && css.batch.size === 1);
	});

	it("Admonition rejects what is not JSON, and what is JSON but not admonitions", () => {
		assert.deepEqual(ADMONITION_IMPORT.fromText("nope"), { errorKey: "import.err.parseFailed" });
		assert.deepEqual(ADMONITION_IMPORT.fromText("42"), { errorKey: "import.err.admNotRecognized" });
	});

	for (const [source, empty, populated] of [
		[ADMONITION_IMPORT, '{"userAdmonitions":{}}', '{"userAdmonitions":{"idea":{"type":"idea"}}}'],
		[CALLOUT_MANAGER_IMPORT, '{"callouts":{"custom":[],"settings":{}}}', '{"callouts":{"custom":["idea"],"settings":{}}}'],
	] as const) {
		it(`${source.pluginId}: distinguishes a missing folder from an installed plugin with nothing to import`, async () => {
			for (const [folderExists, dataJson, expected] of [
				[false, undefined, "notInstalled"],
				[true, undefined, "empty"],
				[true, "{}", "empty"],
				[true, empty, "empty"],
				[true, "{not json", "unreadable"],
				[true, '{"other":1}', "unreadable"],
			] as const) {
				const paths: string[] = [];
				const reads: string[] = [];
				const folder = `.vault-config/plugins/${source.pluginId}`;
				const path = `${folder}/data.json`;
				const app = {
					vault: {
						configDir: ".vault-config",
						adapter: {
							stat: () => Promise.resolve(null),
							exists: (candidate: string) => {
								paths.push(candidate);
								return Promise.resolve(candidate === path ? dataJson !== undefined : candidate === folder && folderExists);
							},
							read: (candidate: string) => {
								reads.push(candidate);
								return Promise.resolve(dataJson ?? "");
							},
						},
					},
				} as unknown as App;
				assert.deepEqual(await probeVault(app, source), { kind: expected }, `${folderExists}: ${dataJson}`);
				assert.deepEqual(paths, dataJson === undefined ? [path, folder] : [path]);
				assert.deepEqual(reads, dataJson === undefined ? [] : [path], "only read an existing settings file");
			}
		});

		it(`${source.pluginId}: finds saved callouts without relying on the plugin being enabled`, async () => {
			const app = {
				vault: {
					configDir: ".obsidian",
					adapter: {
						stat: () => Promise.resolve(null),
						exists: () => Promise.resolve(true),
						read: () => Promise.resolve(populated),
					},
				},
			} as unknown as App;
			const result = await probeVault(app, source);
			assert.equal(result.kind, "found");
			assert.ok(result.kind === "found" && result.batch.size === 1);
		});

		it(`${source.pluginId}: reports failed file reads and folder checks as unreadable`, async () => {
			for (const fileExists of [false, true]) {
				const app = {
					vault: {
						configDir: ".obsidian",
						adapter: {
							stat: () => Promise.resolve(null),
							exists: (path: string) => path.endsWith("/data.json")
								? Promise.resolve(fileExists)
								: Promise.reject(new Error("folder inaccessible")),
							read: () => Promise.reject(new Error("file inaccessible")),
						},
					},
				} as unknown as App;
				assert.deepEqual(await probeVault(app, source), { kind: "unreadable" });
			}
		});
	}
});
