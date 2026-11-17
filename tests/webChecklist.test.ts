/**
 * tests/webChecklist.test.ts — the steps of each service, and what the vault
 * says about them (`src/manager/web/webChecklist.ts`).
 *
 * The Publish to the web panel is this function with words on it, so what the
 * panel promises is promised here:
 *
 * - **The panel says only what the vault says.** The files are seen, and so
 *   is Quartz's configuration where the file is in the vault. Nothing else is
 *   claimed done: there is no tick of the user's (until 2026-11-16 night there
 *   were "I installed it" and "I published it" boxes), and no "done" for a
 *   service as a whole.
 * - **No step is held back.** Until 2026-11-16 night a step whose time had
 *   not come waited, dimmed, with its Copy buttons off; until 2026-11-17
 *   Quartz's configuration step still said, while its plugin folder was
 *   missing, that its lines would break the build. The Quartz plugin is
 *   installed from its own repository now, and harms no build without the
 *   vault's file.
 * - **Something wrong is a warning**, and makes the service's verdict
 *   "attention".
 * - **Quartz has nothing to publish by hand**, in either generation.
 * - **The last step says what happens from then on**, with nothing to do.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checklistFor, type ChecklistInput, type ChecklistRow, type RowKind } from "../src/manager/web/webChecklist";

/** A service with nothing in the vault. */
const fresh = (id: ChecklistInput["id"], over: Partial<ChecklistInput> = {}): ChecklistInput => ({
	id,
	files: "missing",
	quartzConfig: null,
	notePublishes: true,
	needsDomain: true,
	...over,
});

const row = (input: ChecklistInput, kind: RowKind): ChecklistRow => {
	const found = checklistFor(input).rows.find((entry) => entry.kind === kind);
	assert.ok(found, `no ${kind} row`);
	return found;
};

const marks = (input: ChecklistInput): string[] =>
	checklistFor(input).rows.map((entry) => `${entry.kind}:${entry.mark}`);

describe("every service starts the same way", () => {
	for (const id of ["publish", "quartz", "garden"] as const) {
		it(`${id}: nothing in the vault is "not set up", with the files first and "all done" last`, () => {
			const list = checklistFor(fresh(id));
			assert.equal(list.verdict, "none");
			// Quartz publishes nothing by hand, so it has no step for it.
			assert.equal(list.rows.length, id === "quartz" ? 3 : 4);
			assert.deepEqual(list.rows[0], { kind: "files", mark: "todo", status: "missing" });
			assert.deepEqual(list.rows.at(-1), { kind: "done", mark: "clear" });
		});

		it(`${id}: the files are seen, and any other state of them is a warning`, () => {
			assert.equal(row(fresh(id, { files: "current" }), "files").mark, "seen");
			for (const files of ["stale", "edited", "elsewhere"] as const) {
				const found = row(fresh(id, { files }), "files");
				assert.equal(found.mark, "warning", files);
				assert.equal(found.status, files);
			}
		});

		it(`${id}: "all done" has nothing to do, whatever the files are`, () => {
			for (const files of ["missing", "current", "stale", "edited", "elsewhere"] as const) {
				assert.deepEqual(
					checklistFor(fresh(id, { files })).rows.at(-1),
					{ kind: "done", mark: "clear" },
					files,
				);
			}
		});

		it(`${id}: no step carries a tick of the user's or waits, and no verdict says it is all done`, () => {
			for (const files of ["missing", "current", "edited"] as const) {
				for (const notePublishes of [true, false]) {
					const list = checklistFor(fresh(id, { files, notePublishes, quartzConfig: "ok" }));
					for (const entry of list.rows) {
						const where = `${entry.kind}: ${files}`;
						assert.equal("tick" in entry, false, where);
						assert.equal("waitFor" in entry, false, where);
						assert.notEqual(entry.mark, "waiting", where);
						assert.notEqual(entry.mark, "marked", where);
					}
					assert.notEqual(list.verdict, "done");
				}
			}
		});
	}
});

describe("Digital Garden", () => {
	const written = (over: Partial<ChecklistInput> = {}): ChecklistInput =>
		fresh("garden", { files: "current", ...over });

	it("leaves the garden plugin to the user, as a step that never waits", () => {
		// It does no harm on a site with no note, so it can come first.
		assert.deepEqual(row(fresh("garden"), "gardenPlugin"), { kind: "gardenPlugin", mark: "todo" });
		assert.deepEqual(row(written(), "gardenPlugin"), { kind: "gardenPlugin", mark: "todo" });
	});

	it("lets the note be published once it is in the vault, as it is", () => {
		assert.deepEqual(marks(written()), ["files:seen", "gardenPlugin:todo", "site:todo", "done:clear"]);
		assert.equal(checklistFor(written()).verdict, "ok");
	});

	it("never holds publishing back, with or without the note", () => {
		for (const files of ["missing", "edited"] as const) {
			assert.deepEqual(row(fresh("garden", { files }), "site"), { kind: "site", mark: "todo" }, files);
		}
	});

	it("warns of a note that is switched off on the note's own step", () => {
		const off = checklistFor(written({ notePublishes: false }));
		assert.deepEqual(off.rows[2], { kind: "site", mark: "todo" });
		// The note itself is current, and still a warning: nothing will publish it.
		assert.deepEqual(off.rows[0], { kind: "files", mark: "warning", status: "current", switchedOff: true });
		assert.equal(off.verdict, "attention");
	});
});

describe("Obsidian Publish", () => {
	const written = (over: Partial<ChecklistInput> = {}): ChecklistInput =>
		fresh("publish", { files: "current", ...over });

	it("leaves the custom domain to the user", () => {
		assert.deepEqual(row(written(), "publishDomain"), { kind: "publishDomain", mark: "todo" });
	});

	it("asks for no custom domain while heading and inline callouts are both off", () => {
		// Block callouts need only publish.css, which Publish loads on any address.
		const domain = row(written({ needsDomain: false }), "publishDomain");
		assert.deepEqual(domain, { kind: "publishDomain", mark: "clear", notNeeded: true });
		assert.deepEqual(marks(written({ needsDomain: false })), [
			"files:seen",
			"publishDomain:clear",
			"site:todo",
			"done:clear",
		]);
	});

	it("lets the files be published without waiting for the domain", () => {
		// Block callouts work on any address, so publishing is worth doing either way.
		assert.deepEqual(row(written(), "site"), { kind: "site", mark: "todo" });
		assert.equal(checklistFor(written()).verdict, "ok");
	});

	it("holds nothing back before the files are written", () => {
		assert.deepEqual(marks(fresh("publish")), ["files:todo", "publishDomain:todo", "site:todo", "done:clear"]);
	});
});

describe("Quartz", () => {
	const written = (over: Partial<ChecklistInput> = {}): ChecklistInput =>
		fresh("quartz", { files: "current", ...over });

	it("leaves installing the plugin to the user where the configuration is outside the vault", () => {
		const plugin = row(written(), "quartzPlugin");
		assert.deepEqual(plugin, { kind: "quartzPlugin", mark: "todo", config: null });
	});

	it("sees the plugin where it can read the configuration", () => {
		assert.equal(row(written({ quartzConfig: "ok" }), "quartzPlugin").mark, "seen");
	});

	it("holds nothing back, and warns of nothing, before the file is written", () => {
		// The plugin builds a site without the file as it did without the plugin,
		// so installing it first is no mistake, and neither is deleting the file.
		for (const quartzConfig of [null, "none", "ok", "noUse", "misplaced"] as const) {
			const list = checklistFor(fresh("quartz", { quartzConfig }));
			assert.deepEqual(list.rows[0], { kind: "files", mark: "todo", status: "missing" }, String(quartzConfig));
			assert.deepEqual(Object.keys(row(fresh("quartz", { quartzConfig }), "quartzPlugin")).sort(), [
				"config",
				"kind",
				"mark",
			]);
		}
	});

	it("has a step for publishing the note only where a plugin publishes the notes", () => {
		const list = checklistFor(written({ quartzConfig: "ok", publisher: true }));
		assert.deepEqual(
			list.rows.map((entry) => `${entry.kind}:${entry.mark}`),
			["files:seen", "quartzPlugin:seen", "site:todo", "done:clear"],
		);
		assert.equal(list.verdict, "ok");
	});

	it("warns on the note's step of a note that plugin will not publish, or does not look at", () => {
		const off = checklistFor(written({ publisher: true, notePublishes: false }));
		assert.deepEqual(off.rows[0], { kind: "files", mark: "warning", status: "current", switchedOff: true });
		assert.equal(off.verdict, "attention");
		const outside = checklistFor(written({ publisher: true, noteOutside: true }));
		assert.deepEqual(outside.rows[0], { kind: "files", mark: "warning", status: "current", outside: true });
		// Before the note is written there is nothing to warn about.
		assert.equal(checklistFor(fresh("quartz", { publisher: true, noteOutside: true })).rows[0]?.mark, "todo");
	});

	it("has nothing to publish by hand", () => {
		const list = checklistFor(written({ quartzConfig: "ok" }));
		assert.deepEqual(
			list.rows.map((entry) => entry.kind),
			["files", "quartzPlugin", "done"],
		);
		assert.deepEqual(list.rows.at(-1), { kind: "done", mark: "clear" });
		assert.equal(list.verdict, "ok");
	});

	it("Quartz 4: names a call in the wrong place as a warning, and a missing half as to do", () => {
		assert.equal(row(written({ quartzConfig: "misplaced" }), "quartzPlugin").mark, "warning");
		for (const state of ["none", "noImport", "noUse"] as const) {
			assert.equal(row(written({ quartzConfig: state }), "quartzPlugin").mark, "todo", state);
		}
	});

	it("Quartz 5: an entry that is switched off is a warning", () => {
		assert.equal(row(written({ quartzConfig: "off" }), "quartzPlugin").mark, "warning");
		assert.equal(checklistFor(written({ quartzConfig: "off" })).verdict, "attention");
	});

	it("says stale files are a warning, which the service's verdict carries", () => {
		const stale = checklistFor(fresh("quartz", { files: "stale", quartzConfig: "ok" }));
		assert.equal(stale.rows[0]?.mark, "warning");
		assert.equal(stale.verdict, "attention");
	});
});
