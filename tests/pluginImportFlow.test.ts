/**
 * tests/pluginImportFlow.test.ts — the rule behind the plugin import window's
 * one Import button, and the two sources that feed it.
 *
 * The window used to show an Import inside the "This vault" row beside a footer
 * Import that only read the paste box. pluginImportFlow.ts now decides, from
 * plain state, which of the window's options is active — the vault, or the
 * source's one fallback — and so what the single footer Import acts on. These
 * cases state that rule from the user's side — the option wearing the ring is
 * the one Import imports — rather than restating the implementation, so a
 * change that lets Import reach something the user did not choose fails here.
 * tests/pluginImportModal.test.ts checks the same rule on the real window.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { en } from "../src/i18n/en";
import { ADMONITION_IMPORT } from "../src/settings/pluginImport/admonitionImportSource";
import { CALLOUT_MANAGER_IMPORT } from "../src/settings/pluginImport/calloutManagerImportSource";
import {
	activeOption,
	canImport,
	initialFlow,
	isFilled,
	vaultOffered,
	type ImportFlow,
	type ImportOption,
	type ProbeState,
} from "../src/settings/pluginImport/pluginImportFlow";
import { probeVault } from "../src/settings/pluginImport/pluginImportSource";

const PROBES: ProbeState[] = ["checking", "found", "empty", "notInstalled", "unreadable"];
const OPTIONS: ImportOption[] = ["vault", "manual"];

function everyFlow(): ImportFlow[] {
	const out: ImportFlow[] = [];
	for (const probe of PROBES)
		for (const chosen of [null, ...OPTIONS])
			for (const hasManual of [false, true])
				for (const busy of [false, true])
					out.push({ probe, chosen, hasManual, busy });
	return out;
}

describe("the import flow", () => {
	it("opens with the vault on offer and nothing to import yet", () => {
		const flow = initialFlow();
		assert.equal(vaultOffered(flow.probe), true);
		assert.equal(activeOption(flow), null);
		assert.equal(canImport(flow), false);
	});

	it("offers the vault while it is looked for and once it is found, and not once it holds nothing", () => {
		assert.deepEqual(
			PROBES.map((probe) => [probe, vaultOffered(probe)]),
			[
				["checking", true],
				["found", true],
				["empty", false],
				["notInstalled", false],
				["unreadable", false],
			],
		);
	});

	it("makes the vault the default once its data is found", () => {
		assert.equal(activeOption({ ...initialFlow(), probe: "found" }), "vault");
	});

	it("follows the user's choice between two filled options", () => {
		const both = { ...initialFlow(), probe: "found" as const, hasManual: true };
		assert.equal(activeOption({ ...both, chosen: "manual" }), "manual");
		assert.equal(activeOption({ ...both, chosen: "vault" }), "vault");
	});

	it("falls back to the vault when the chosen fallback no longer holds anything", () => {
		// The text box emptied again after it was typed in.
		const emptied = { ...initialFlow(), probe: "found" as const, chosen: "manual" as const };
		assert.equal(activeOption(emptied), "vault");
	});

	it("imports the fallback alone when the vault holds nothing, whatever was chosen", () => {
		for (const flow of everyFlow().filter((f) => !vaultOffered(f.probe))) {
			assert.equal(activeOption(flow), flow.hasManual ? "manual" : null, JSON.stringify(flow));
		}
	});

	it("lets the fallback be used while the vault is still being looked for", () => {
		// A probe that never settles must not lock the window.
		const looking = { ...initialFlow(), chosen: "manual" as const, hasManual: true };
		assert.equal(activeOption(looking), "manual");
		assert.equal(activeOption({ ...looking, probe: "found" }), "manual", "and the probe settling leaves the choice alone");
	});

	it("only ever imports an option that holds something", () => {
		for (const flow of everyFlow()) {
			const active = activeOption(flow);
			if (active !== null) assert.equal(isFilled(flow, active), true, JSON.stringify(flow));
		}
	});

	it("never leaves Import idle while something on screen could be imported", () => {
		for (const flow of everyFlow()) {
			const something = OPTIONS.some((option) => isFilled(flow, option));
			assert.equal(activeOption(flow) !== null, something, JSON.stringify(flow));
		}
	});

	it("is never ready while busy", () => {
		for (const flow of everyFlow().filter((f) => f.busy)) {
			assert.equal(canImport(flow), false, JSON.stringify(flow));
		}
	});

	it("is ready exactly when it is idle and some option is active", () => {
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

	it("each offers one fallback: a file for Admonition, pasted text for Callout Manager", () => {
		assert.deepEqual(ADMONITION_IMPORT.manual, { kind: "file", accept: ".json" });
		assert.deepEqual(CALLOUT_MANAGER_IMPORT.manual, { kind: "paste", placeholder: "import.cmPlaceholder" });
		assert.ok("import.cmPlaceholder" in en, "the paste box's placeholder is an English key");
	});

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
