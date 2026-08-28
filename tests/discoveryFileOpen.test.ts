/**
 * tests/discoveryFileOpen.test.ts — opening a note is a discovery trigger.
 *
 * Two reported failures, one missing trigger. Discovery ran on
 * `metadataCache.on("changed")` and `vault.on("create")`, and both of those
 * mean *the file was written*:
 *
 * 1. **The settings list did not move when a note was opened.** Pasting a
 *    callout into a note worked, because pasting is a write; opening a note that
 *    already contained one produced no event at all, so nothing scanned and
 *    nothing repainted.
 * 2. **Only the last note's callout was ever found.** The settings tab's own
 *    open-buffer sweep was the only thing standing in for a trigger, and it
 *    reads `getLeavesOfType("markdown")` — one *visible* note per leaf. Open
 *    five notes in one tab and four of them had already been replaced in the
 *    only leaf that ever existed by the time settings opened.
 *
 * `workspace.on("file-open")` fixes both: each opened note is its own scan, and
 * the registry is what accumulates them. The assertions below are written
 * against that pair of symptoms directly — including, in §98, the exact
 * one-tab arrangement that made the old sweep report a single callout.
 *
 * A live settings list is `registry.onChange` and nothing else (see
 * `SettingsTab.scheduleListRefresh`), so `h.changes()` is what "the list
 * updates immediately" means here.
 *
 * The virtual clock is documented in tests/support/discoveryHarness.ts; note
 * that `advance()` only fires the timer callback, so every assertion about what
 * the resulting async scan *did* comes after an `await settle()`.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { discoveryHarness, settle } from "./support/discoveryHarness";

/** `DiscoveryScheduler`'s per-file debounce, which is a private literal. */
const FILE_SCAN_MS = 300;
/** `CalloutPrune.PRUNE_DELAY_MS` on desktop (`Platform.isMobile` is false). */
const PRUNE_MS = 1500;

/** A harness with the triggers already subscribed, as `onLayoutReady` leaves them. */
function watching(
	files: Record<string, string>,
	openTabs: string[] = [],
): ReturnType<typeof discoveryHarness> {
	const h = discoveryHarness(files);
	h.workspace.leaves(openTabs);
	h.discovery.registerIncrementalWatchers();
	return h;
}

/* ========================================================================== */
/* 97. Opening a note discovers its callouts                                  */
/* ========================================================================== */

describe("opening a note", () => {
	it("discovers a callout the registry has never seen", async () => {
		// The reported bug: this found nothing at all, because no event fired.
		const h = watching({ "note.md": "> [!alpha] x" });

		h.workspace.open("note.md");
		h.clock.advance(FILE_SCAN_MS);
		await settle();

		assert.ok(h.registry.get("alpha"));
	});

	it("discovers one the cursor happens to be sitting on", async () => {
		// The second half of the reported bug, and the half that survived
		// adding the trigger. Opening a note makes it `workspace.activeEditor`
		// with the cursor at line 0 — so for the ordinary note, one that
		// *starts* with its callout, the id sits on the cursor's line through
		// no act of the user's. The half-typed filter read that as "mid-type"
		// and dropped it: the scan ran, found `alpha`, and threw it away.
		const h = watching({ "note.md": "> [!alpha] x" });
		h.editor.typing("note.md", "> [!alpha] x");

		h.workspace.open("note.md");
		h.clock.advance(FILE_SCAN_MS);
		await settle();

		assert.ok(h.registry.get("alpha"));
	});

	it("still withholds a half-typed id on the write path", async () => {
		// The filter's actual job, which the fix above must not undo: you type
		// `[!alp`, Obsidian saves, and the id under the cursor must not be fed
		// back into the autocomplete dropdown you are typing into.
		const h = watching({ "note.md": "> [!alp] x" });
		h.editor.typing("note.md", "> [!alp] x");

		h.workspace.change("note.md");
		h.clock.advance(FILE_SCAN_MS);
		await settle();

		assert.strictEqual(h.registry.get("alp"), undefined);
	});

	it("notifies the open settings list, which is what repaints it", async () => {
		// `SettingsTab` refreshes on `registry.onChange` and on nothing else, so
		// a discovery that fires no notification is a list that stays stale even
		// though the row exists.
		const h = watching({ "note.md": "> [!alpha] x" });
		const before = h.changes();

		h.workspace.open("note.md");
		h.clock.advance(FILE_SCAN_MS);
		await settle();

		assert.ok(h.changes() > before, "the list was told");
	});

	it("still discovers on a write — the path that always worked", async () => {
		// The control for the report's own comparison: pasting a callout into a
		// note was the one thing that did work, and it must keep working.
		const h = watching({ "note.md": "plain" });
		h.vault.write("note.md", "> [!beta] x");

		h.workspace.change("note.md");
		h.clock.advance(FILE_SCAN_MS);
		await settle();

		assert.ok(h.registry.get("beta"));
	});

	it("registers the open trigger alongside the two write triggers", () => {
		const h = watching({});
		assert.strictEqual(h.registrations(), 3);
	});

	it("ignores the null core sends when the last tab closes", async () => {
		const h = watching({ "note.md": "> [!alpha] x" });
		h.workspace.open(null);
		h.clock.advance(FILE_SCAN_MS);
		await settle();
		assert.strictEqual(h.vault.reads(), 0);
	});
});

/* ========================================================================== */
/* 98. Every opened note, not just the last one                               */
/* ========================================================================== */

describe("several notes opened before the settings tab", () => {
	const NOTES = {
		"a.md": "> [!alpha] x",
		"b.md": "> [!beta] x",
		"c.md": "> [!gamma] x",
	};

	it("accumulates a callout from each of them", async () => {
		const h = watching(NOTES);

		for (const path of ["a.md", "b.md", "c.md"]) h.workspace.open(path);
		h.clock.advance(FILE_SCAN_MS);
		await settle();

		assert.deepStrictEqual(
			["alpha", "beta", "gamma"].map((id) => !!h.registry.get(id)),
			[true, true, true],
		);
	});

	it("accumulates them as the cursor really lands — on each callout", async () => {
		// The reported run, faithfully. Every note starts with its callout, so
		// opening it makes that note the active editor with the cursor on that
		// very line. Under the half-typed filter all three were dropped, and
		// the only id that ever reached the list was whichever one the settings
		// tab's own sweep happened to see — the last note opened.
		const h = watching(NOTES);
		const opened: [string, string][] = [
			["a.md", "> [!alpha] x"],
			["b.md", "> [!beta] x"],
			["c.md", "> [!gamma] x"],
		];

		for (const [path, line] of opened) {
			h.editor.typing(path, line);
			h.workspace.open(path);
			h.clock.advance(FILE_SCAN_MS);
			await settle();
		}

		assert.deepStrictEqual(
			[...h.registry.getUserDefined()].map((d) => d.id).sort(),
			["alpha", "beta", "gamma"],
		);
	});

	it("accumulates them when all three shared one tab", async () => {
		// The reported arrangement, exactly: the notes were opened one after
		// another in a single tab, so by the time the settings tab ran its
		// open-buffer sweep the only leaf held `c.md`. That sweep reported one
		// callout; these three scans report three.
		const h = watching(NOTES, ["c.md"]);

		for (const path of ["a.md", "b.md", "c.md"]) h.workspace.open(path);
		h.clock.advance(FILE_SCAN_MS);
		await settle();

		assert.deepStrictEqual(
			[...h.registry.getUserDefined()].map((d) => d.id).sort(),
			["alpha", "beta", "gamma"],
		);
	});

	it("remembers all of them for the next launch", async () => {
		// The rows are not written to data.json; the index is what survives a
		// restart, so an accumulation that misses it is lost anyway. See
		// manager/discoveredRowPersistence.ts.
		const h = watching(NOTES);

		for (const path of ["a.md", "b.md", "c.md"]) h.workspace.open(path);
		h.clock.advance(FILE_SCAN_MS);
		await settle();

		assert.deepStrictEqual(
			[...h.localState.discovered].sort(),
			["alpha", "beta", "gamma"],
		);
	});

	it("debounces per file, so three opens are three scans", async () => {
		// One shared timer would collapse them into a single scan of whichever
		// note was opened last — which is the bug, rebuilt out of a debounce.
		const h = watching(NOTES);

		for (const path of ["a.md", "b.md", "c.md"]) h.workspace.open(path);
		h.clock.advance(FILE_SCAN_MS);
		await settle();

		assert.strictEqual(h.vault.reads(), 3);
	});
});

/* ========================================================================== */
/* 99. The tabs a restored session leaves open                                */
/* ========================================================================== */

describe("the catch-up sweep at registration", () => {
	it("scans the notes already on screen", async () => {
		// Watchers are registered in `onLayoutReady`, which is after the
		// workspace has restored last session's tabs — so those notes' own
		// `file-open` events have already been and gone.
		const h = watching(
			{ "a.md": "> [!alpha] x", "b.md": "> [!beta] x" },
			["a.md", "b.md"],
		);

		h.clock.advance(FILE_SCAN_MS);
		await settle();

		assert.ok(h.registry.get("alpha"));
		assert.ok(h.registry.get("beta"));
	});

	it("scans a deferred tab, which carries no loaded view", async () => {
		// Obsidian 1.7.2+ restores a tab without loading its view: it reports as
		// a markdown leaf but has no `view.file` at all. Reading that field
		// alone skipped exactly the tabs this sweep exists for, so the note a
		// restarted Obsidian puts you back in front of went unscanned until you
		// clicked it. `getViewState()` answers for those.
		const h = discoveryHarness({ "a.md": "> [!alpha] x" });
		h.workspace.leaves(["a.md"], true);
		h.discovery.registerIncrementalWatchers();

		h.clock.advance(FILE_SCAN_MS);
		await settle();

		assert.ok(h.registry.get("alpha"));
	});

	it("scans nothing when no tab is open", async () => {
		const h = discoveryHarness({ "a.md": "> [!alpha] x" });
		h.workspace.leaves([]);
		h.discovery.registerIncrementalWatchers();

		h.clock.advance(FILE_SCAN_MS);
		await settle();

		assert.strictEqual(h.vault.reads(), 0);
	});
});

/* ========================================================================== */
/* 100. What keeps the new trigger cheap                                      */
/* ========================================================================== */

describe("the open-scan memo", () => {
	it("re-reads nothing when an unchanged note is re-opened", async () => {
		// Every tab switch is an open. Without the memo each one is a cached
		// read and a tokenizer pass over a file that cannot have changed.
		const h = watching({ "note.md": "> [!alpha] x" });
		h.workspace.open("note.md");
		h.clock.advance(FILE_SCAN_MS);
		await settle();
		const after = h.vault.reads();

		h.workspace.open("note.md");
		h.clock.advance(FILE_SCAN_MS);
		await settle();

		assert.strictEqual(h.vault.reads(), after, "not even a queued timer");
	});

	it("re-reads once the note has actually been edited", async () => {
		const h = watching({ "note.md": "> [!alpha] x" });
		h.workspace.open("note.md");
		h.clock.advance(FILE_SCAN_MS);
		await settle();

		// A write moves the mtime the memo keys on.
		h.clock.advance(1000);
		h.vault.write("note.md", "> [!alpha] x\n> [!beta] y");
		h.workspace.open("note.md");
		h.clock.advance(FILE_SCAN_MS);
		await settle();

		assert.ok(h.registry.get("beta"));
	});

	it("does not memoize a scan that held a half-typed id back", async () => {
		// The cursor is on the line during a save, so `delta` is withheld. The
		// file has not been settled, and the open that follows the commit must
		// still look — memoizing here made that the one open which never does.
		const h = watching({ "note.md": "> [!delta] x" });
		h.editor.typing("note.md", "> [!delta] x");
		h.workspace.change("note.md");
		h.clock.advance(FILE_SCAN_MS);
		await settle();
		assert.strictEqual(h.registry.get("delta"), undefined);

		h.workspace.open("note.md");
		h.clock.advance(FILE_SCAN_MS);
		await settle();

		assert.ok(h.registry.get("delta"));
	});

	it("is cleared when the user deletes a row", async () => {
		// The rediscovery hold lasts five seconds and is then meant to lapse —
		// the note still naming the id brings it back. A memoized note is one
		// the next open never re-reads, which would make the deletion permanent.
		const h = watching({ "note.md": "> [!alpha] x" });
		h.workspace.open("note.md");
		h.clock.advance(FILE_SCAN_MS);
		await settle();

		h.registry.remove("alpha");
		h.discovery.suppressRediscovery(["alpha"]);
		h.clock.advance(60000); // well past the hold

		h.workspace.open("note.md");
		h.clock.advance(FILE_SCAN_MS);
		await settle();

		assert.ok(h.registry.get("alpha"));
	});

	it("obeys the automatic-discovery toggle", async () => {
		const h = watching({ "note.md": "> [!alpha] x" });
		h.settings.autoDiscoverCallouts = false;

		h.workspace.open("note.md");
		h.clock.advance(FILE_SCAN_MS);
		await settle();

		assert.strictEqual(h.vault.reads(), 0);
		assert.strictEqual(h.registry.get("alpha"), undefined);
	});
});

/* ========================================================================== */
/* 101. An open is not an edit                                                */
/* ========================================================================== */

describe("what an open does not do", () => {
	/** Two notes, so a whole-vault prune pass is told from a per-file scan by count. */
	const NOTES = { "note.md": "> [!alpha] x", "other.md": "plain" };

	it("schedules no whole-vault prune", async () => {
		// A prune answers "did that edit remove the last usage of a row", and an
		// open removes nothing. Notes are opened far more often than they are
		// written, so pruning here would put a whole-vault read behind every tab
		// switch.
		const h = watching(NOTES);
		h.workspace.open("note.md");
		h.clock.advance(FILE_SCAN_MS);
		await settle();
		const after = h.vault.reads();

		h.clock.advance(PRUNE_MS);
		await settle();

		assert.strictEqual(h.vault.reads(), after);
	});

	it("still prunes after a write", async () => {
		const h = watching(NOTES);
		h.workspace.change("note.md");
		h.clock.advance(FILE_SCAN_MS);
		await settle();
		const after = h.vault.reads();

		h.clock.advance(PRUNE_MS);
		await settle();

		assert.strictEqual(h.vault.reads() - after, 2, "both files");
	});

	it("keeps the prune when a write and an open race", async () => {
		// The write is owed a prune however the two arrive within the debounce.
		const h = watching(NOTES);
		h.workspace.change("note.md");
		h.workspace.open("note.md");
		h.clock.advance(FILE_SCAN_MS);
		await settle();
		const after = h.vault.reads();

		h.clock.advance(PRUNE_MS);
		await settle();

		assert.strictEqual(h.vault.reads() - after, 2, "both files");
	});

	it("writes nothing to data.json", async () => {
		// The whole of issue #41: opening a synced note must not edit the
		// settings file on a second device.
		const h = watching({ "note.md": "> [!alpha] x" });
		h.workspace.open("note.md");
		h.clock.advance(FILE_SCAN_MS);
		await settle();

		assert.strictEqual(h.saves(), 0);
	});
});
