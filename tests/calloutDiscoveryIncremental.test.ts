/**
 * tests/calloutDiscoveryIncremental.test.ts — the per-file scan and the
 * half-typed-id filter.
 *
 * Two debounces meet here, and they are sized for opposite reasons:
 *
 * - **The file scan waits 300 ms.** It is cheap — one cached read and one
 *   tokenizer pass — so it only has to outlast a keystroke burst.
 * - **The prune waits 1500 ms on desktop and 10 s on mobile.** It reads EVERY
 *   markdown file in the vault through `cachedRead` and tokenizes it, on the
 *   main thread. A short debounce puts that whole pass right where the user
 *   stops typing and looks at the screen, which on a phone reads as the editor
 *   freezing. Nothing about it is urgent: the only visible cost of waiting is
 *   an orphaned row lingering in the settings list a few seconds longer.
 *
 * On top of them sits the typing filter. `scanFileNow` reads the file from
 * cache, but `getActiveTypingCalloutIds` reads the *live CodeMirror buffer* line
 * under the cursor — and every callout token on it is treated as still being
 * typed. Auto-creating those would feed a half-finished name straight back into
 * the autocomplete dropdown the user is typing into. Committing is modelled as
 * the cursor leaving the line.
 *
 * The virtual clock is documented in tests/support/discoveryHarness.ts; note
 * that `advance()` only fires the timer callback, so every assertion about what
 * the resulting async scan *did* comes after an `await settle()`.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { activeTypingCalloutIds } from "../src/editor/activeTypingIds";
import {
	discovered,
	discoveryHarness,
	settle,
} from "./support/discoveryHarness";

/** `CalloutDiscovery.scheduleFileScan`'s debounce, which is a private literal. */
const FILE_SCAN_MS = 300;
/** `CalloutDiscovery.PRUNE_DELAY_MS` on desktop (`Platform.isMobile` is false). */
const PRUNE_MS = 1500;
/** `CalloutPrune.PRUNE_MIN_INTERVAL_MS` — the floor under two automatic passes. */
const PRUNE_MIN_GAP_MS = 10000;

/* ========================================================================== */
/* 93. getActiveTypingCalloutIds                                              */
/* ========================================================================== */

describe("getActiveTypingCalloutIds — when it has no answer", () => {
	it("is null when no editor is active at all", () => {
		const h = discoveryHarness({ "note.md": "> [!half]" });
		h.editor.none();
		assert.strictEqual(
			activeTypingCalloutIds(h.app, h.vault.file("note.md")),
			null,
		);
	});

	it("is null when the active editor is on a different file", () => {
		// The cursor is in another note; nothing about this file is in progress.
		const h = discoveryHarness({ "note.md": "> [!half]", "other.md": "" });
		h.editor.typing("other.md", "> [!half]");
		assert.strictEqual(
			activeTypingCalloutIds(h.app, h.vault.file("note.md")),
			null,
		);
	});

	it("is null when the cursor's line carries no callout token", () => {
		const h = discoveryHarness({ "note.md": "> [!half]" });
		h.editor.typing("note.md", "just some prose");
		assert.strictEqual(
			activeTypingCalloutIds(h.app, h.vault.file("note.md")),
			null,
		);
	});

	it("is null for an empty line", () => {
		const h = discoveryHarness({ "note.md": "> [!half]" });
		h.editor.idle("note.md");
		assert.strictEqual(
			activeTypingCalloutIds(h.app, h.vault.file("note.md")),
			null,
		);
	});
});

describe("getActiveTypingCalloutIds — what it reports", () => {
	const idsOn = (line: string): string[] => {
		const h = discoveryHarness({ "note.md": "" });
		h.editor.typing("note.md", line);
		const found = activeTypingCalloutIds(h.app, 
			h.vault.file("note.md"),
		);
		return found ? [...found].sort() : [];
	};

	it("reports a block callout header's id", () => {
		assert.deepStrictEqual(idsOn("> [!half] Title"), ["half"]);
	});

	it("reports a heading callout's id", () => {
		assert.deepStrictEqual(idsOn("### [!half] Title"), ["half"]);
	});

	it("reports every inline pill on the line", () => {
		assert.deepStrictEqual(idsOn("a [!alpha] and [!beta] pill"), [
			"alpha",
			"beta",
		]);
	});

	it("normalizes exactly as the vault scanner does", () => {
		// Same normalization on both sides is what lets `scanFileNow` filter one
		// list with the other — a multi-word id has to match identically.
		assert.deepStrictEqual(idsOn("> [!  My   ID  ] Title"), ["my id"]);
	});

	it("sees through |metadata", () => {
		// Obsidian splits the header at the first pipe, so `[!half|purple]` is
		// the `half` callout carrying metadata — and it is `half` the user is
		// still typing.
		assert.deepStrictEqual(idsOn("> [!half|purple] Title"), ["half"]);
	});

	it("ignores a token inside inline code", () => {
		assert.deepStrictEqual(idsOn("prose `[!half]` prose"), []);
	});
});

describe("the typing filter, through scanFileNow", () => {
	it("does not create a row for the id under the cursor", async () => {
		const h = discoveryHarness({
			"note.md": "> [!half]\n\n> [!settled] committed",
		});
		h.editor.typing("note.md", "> [!half]");
		await h.internals.scanFileNow(h.vault.file("note.md"));
		assert.strictEqual(h.registry.get("half"), undefined);
		// Everything the user already committed elsewhere in the file still
		// lands — the filter is per-line, not per-file.
		assert.ok(h.registry.get("settled"));
	});

	it("creates it once the cursor leaves the line", async () => {
		const h = discoveryHarness({ "note.md": "> [!half]" });
		h.editor.typing("note.md", "> [!half]");
		await h.internals.scanFileNow(h.vault.file("note.md"));
		assert.strictEqual(h.registry.get("half"), undefined);

		h.editor.typing("note.md", "a new paragraph");
		await h.internals.scanFileNow(h.vault.file("note.md"));
		assert.ok(h.registry.get("half"));
	});

	it("creates it when the user switches to another file", async () => {
		const h = discoveryHarness({ "note.md": "> [!half]", "other.md": "" });
		h.editor.typing("other.md", "");
		await h.internals.scanFileNow(h.vault.file("note.md"));
		assert.ok(h.registry.get("half"));
	});

	it("still schedules a prune when the filter emptied the list", async () => {
		// Everything unknown was in progress, so nothing was added — but an
		// earlier edit may still have orphaned a row, so the prune has to run.
		const h = discoveryHarness({ "note.md": "> [!half]" });
		h.editor.typing("note.md", "> [!half]");
		await h.internals.scanFileNow(h.vault.file("note.md"));
		assert.strictEqual(h.clock.pending(), 1);
	});
});

/* ========================================================================== */
/* 94. scheduleFileScan (debounce) + scanFileNow                              */
/* ========================================================================== */

describe("scheduleFileScan — the debounce", () => {
	it("has not read anything before the delay elapses", async () => {
		const h = discoveryHarness({ "note.md": "> [!alpha] x" });
		h.internals.scheduleFileScan(h.vault.file("note.md"));
		h.clock.advance(FILE_SCAN_MS - 1);
		await settle();
		assert.strictEqual(h.vault.reads(), 0);
		assert.strictEqual(h.registry.get("alpha"), undefined);
	});

	it("scans once the delay elapses", async () => {
		const h = discoveryHarness({ "note.md": "> [!alpha] x" });
		h.internals.scheduleFileScan(h.vault.file("note.md"));
		h.clock.advance(FILE_SCAN_MS);
		await settle();
		assert.strictEqual(h.vault.reads(), 1);
		assert.ok(h.registry.get("alpha"));
	});

	it("collapses a burst of edits into a single scan", async () => {
		const h = discoveryHarness({ "note.md": "> [!alpha] x" });
		const file = h.vault.file("note.md");
		for (let i = 0; i < 3; i++) {
			h.internals.scheduleFileScan(file);
			h.clock.advance(FILE_SCAN_MS - 100);
		}
		await settle();
		assert.strictEqual(h.vault.reads(), 0, "nothing fired mid-burst");

		h.clock.advance(FILE_SCAN_MS);
		await settle();
		assert.strictEqual(h.vault.reads(), 1);
	});

	it("debounces each file on its own timer", async () => {
		const h = discoveryHarness({
			"a.md": "> [!alpha] x",
			"b.md": "> [!beta] y",
		});
		h.internals.scheduleFileScan(h.vault.file("a.md"));
		h.clock.advance(200);
		h.internals.scheduleFileScan(h.vault.file("b.md"));
		h.clock.advance(100);
		await settle();
		assert.ok(h.registry.get("alpha"), "a.md fired at its own 300ms");
		assert.strictEqual(h.registry.get("beta"), undefined);

		h.clock.advance(200);
		await settle();
		assert.ok(h.registry.get("beta"));
	});

	it("forgets a fired timer, so the next edit schedules cleanly", async () => {
		const h = discoveryHarness({ "note.md": "> [!alpha] x" });
		const file = h.vault.file("note.md");
		h.internals.scheduleFileScan(file);
		h.clock.advance(FILE_SCAN_MS);
		await settle();

		h.vault.write("note.md", "> [!alpha] x\n\n> [!beta] y");
		h.internals.scheduleFileScan(file);
		h.clock.advance(FILE_SCAN_MS);
		await settle();
		assert.ok(h.registry.get("beta"));
	});

	it("is cancelled wholesale by destroy()", async () => {
		// Every timer the manager owns is its own to clean up — main.ts calls
		// destroy() in onunload, and a scan firing after that would touch a
		// registry nobody is listening to any more.
		const h = discoveryHarness({ "note.md": "> [!alpha] x" });
		h.internals.scheduleFileScan(h.vault.file("note.md"));
		h.discovery.schedulePrune();
		assert.strictEqual(h.clock.pending(), 2);

		h.discovery.destroy();
		assert.strictEqual(h.clock.pending(), 0);

		h.clock.advance(60_000);
		await settle();
		assert.strictEqual(h.vault.reads(), 0);
		assert.strictEqual(h.registry.get("alpha"), undefined);
	});
});

describe("schedulePrune — the other debounce", () => {
	it("waits the full desktop delay", async () => {
		const h = discoveryHarness({ "note.md": "plain" });
		h.registry.add(discovered("orphan"));
		h.discovery.schedulePrune();

		h.clock.advance(PRUNE_MS - 1);
		await settle();
		assert.ok(h.registry.get("orphan"), "not yet");

		h.clock.advance(1);
		await settle();
		assert.strictEqual(h.registry.get("orphan"), undefined);
	});

	it("collapses repeated requests into one pass", () => {
		const h = discoveryHarness({ "note.md": "plain" });
		h.discovery.schedulePrune();
		h.discovery.schedulePrune();
		h.discovery.schedulePrune();
		assert.strictEqual(h.clock.pending(), 1);
	});

	it("honours an explicit delay", async () => {
		const h = discoveryHarness({ "note.md": "plain" });
		h.registry.add(discovered("orphan"));
		h.discovery.schedulePrune(2000);
		h.clock.advance(PRUNE_MS);
		await settle();
		assert.ok(h.registry.get("orphan"));
		h.clock.advance(500);
		await settle();
		assert.strictEqual(h.registry.get("orphan"), undefined);
	});

	it("schedules nothing at all while pruning is suspended", () => {
		const h = discoveryHarness({ "note.md": "plain" });
		h.discovery.pruneSuspended = true;
		h.discovery.schedulePrune();
		assert.strictEqual(h.clock.pending(), 0);
	});
});

describe("scanFileNow", () => {
	it("adds the unknown ids it finds", async () => {
		const h = discoveryHarness({ "note.md": "> [!alpha] x\n\n[!beta] pill" });
		await h.internals.scanFileNow(h.vault.file("note.md"));
		assert.ok(h.registry.get("alpha"));
		assert.ok(h.registry.get("beta"));
	});

	it("remembers them on this device instead of writing data.json", async () => {
		// The heart of issue #41: a second device that merely OPENS a synced
		// note must not edit the settings file, or two devices are modifying
		// one file seconds apart and the sync client can only pick a winner.
		// The ids go to the device-local index, which cannot conflict; the
		// rows are rebuilt from it at startup.
		const h = discoveryHarness({ "note.md": "> [!alpha] x\n\n[!beta] pill" });
		await h.internals.scanFileNow(h.vault.file("note.md"));

		assert.strictEqual(h.saves(), 0, "no settings write for a discovery");
		assert.deepStrictEqual([...h.localState.discovered], ["alpha", "beta"]);
		assert.deepStrictEqual(h.registry.toSaveData().callouts, []);
	});

	it("keeps the index to ids it actually created a row for", async () => {
		// A spelling an existing callout already owns is refused by `add`, and
		// remembering it anyway would have the next launch try, and fail, to
		// rebuild a row for it forever.
		const h = discoveryHarness({ "note.md": "> [!note] x\n\n> [!alpha] y" });
		await h.internals.scanFileNow(h.vault.file("note.md"));

		assert.deepStrictEqual([...h.localState.discovered], ["alpha"]);
	});

	it("never refreshes the editors itself", async () => {
		// The batch's single onChange already injected — and that ends in
		// refreshAllCalloutEditors — so a second pass would only regenerate
		// identical CSS.
		const h = discoveryHarness({ "note.md": "> [!alpha] x" });
		await h.internals.scanFileNow(h.vault.file("note.md"));
		assert.strictEqual(h.refreshes(), 0);
		assert.strictEqual(h.changes(), 1);
	});

	it("schedules a prune whether or not it added anything", async () => {
		const h = discoveryHarness({ "note.md": "> [!alpha] x" });
		await h.internals.scanFileNow(h.vault.file("note.md"));
		assert.strictEqual(h.clock.pending(), 1, "after an add");

		h.clock.reset();
		h.vault.write("note.md", "> [!note] only known ids now");
		await h.internals.scanFileNow(h.vault.file("note.md"));
		assert.strictEqual(h.clock.pending(), 1, "after finding nothing new");
	});

	it("writes nothing when there was nothing new", async () => {
		const h = discoveryHarness({ "note.md": "> [!note] known" });
		await h.internals.scanFileNow(h.vault.file("note.md"));
		assert.strictEqual(h.saves(), 0);
		assert.strictEqual(h.changes(), 0);
	});

	it("ignores a file that has since moved away from its path", async () => {
		// The debounce means the scan runs 300ms after the edit, and the file may
		// have been renamed or deleted in between; the queued handle would then
		// read a path that now belongs to something else.
		const h = discoveryHarness({ "note.md": "> [!alpha] x" });
		const file = h.vault.file("note.md");
		h.vault.detach("note.md");
		await h.internals.scanFileNow(file);
		assert.strictEqual(h.vault.reads(), 0);
		assert.strictEqual(h.registry.get("alpha"), undefined);
		assert.strictEqual(h.clock.pending(), 0, "no prune either");
	});

	it("swallows a read failure without adding or pruning", async () => {
		const h = discoveryHarness({ "note.md": "> [!alpha] x" });
		h.vault.breakRead("note.md");
		await h.internals.scanFileNow(h.vault.file("note.md"));
		assert.strictEqual(h.registry.get("alpha"), undefined);
		assert.strictEqual(h.saves(), 0);
		// A failed read is not evidence that anything became unused, so the
		// prune is skipped along with the add.
		assert.strictEqual(h.clock.pending(), 0);
	});

	it("drives the whole loop from a scheduled scan", async () => {
		// The end-to-end shape: an edit introduces an id, the debounced scan
		// creates its row, the edit that removes it again lets the prune take
		// the row back out.
		const h = discoveryHarness({ "note.md": "> [!alpha] x" });
		const file = h.vault.file("note.md");

		h.internals.scheduleFileScan(file);
		h.clock.advance(FILE_SCAN_MS);
		await settle();
		assert.ok(h.registry.get("alpha"));

		h.vault.write("note.md", "the callout is gone now");
		h.internals.scheduleFileScan(file);
		h.clock.advance(FILE_SCAN_MS);
		await settle();
		assert.ok(h.registry.get("alpha"), "still there until the prune runs");

		h.clock.advance(PRUNE_MS);
		await settle();
		assert.strictEqual(h.registry.get("alpha"), undefined);
	});
});

/* ========================================================================== */
/* 95. The floor under two automatic prune passes                             */
/* ========================================================================== */

describe("the prune's minimum interval", () => {
	/**
	 * Two notes, so the two kinds of read are told apart by count: a per-file
	 * scan reads one, a whole-vault prune pass reads both.
	 */
	const vault = () =>
		discoveryHarness({ "note.md": "> [!alpha] x", "other.md": "plain" });

	/** Type, pause — the pattern the debounce alone cannot collapse. */
	const drafting = async (h: ReturnType<typeof discoveryHarness>) => {
		const before = h.vault.reads();
		await h.internals.scanFileNow(h.vault.file("note.md"));
		h.clock.advance(PRUNE_MS);
		await settle();
		return h.vault.reads() - before;
	};

	it("runs the first pass on the ordinary delay", async () => {
		const h = vault();
		assert.strictEqual(await drafting(h), 3, "one file scan, then both files");
	});

	it("does not run a second whole-vault pass moments later", async () => {
		// Every pause longer than the debounce used to buy another full read.
		const h = vault();
		await drafting(h);
		assert.strictEqual(await drafting(h), 1, "the file scan, and nothing else");
	});

	it("runs again once the gap has actually passed", async () => {
		const h = vault();
		await drafting(h);
		const after = h.vault.reads();

		await h.internals.scanFileNow(h.vault.file("note.md"));
		h.clock.advance(PRUNE_MIN_GAP_MS);
		await settle();
		assert.strictEqual(h.vault.reads() - after, 3);
	});

	it("never throttles a pass the user is standing in front of", async () => {
		// `schedulePrune(0)` comes from opening the settings tab or closing the
		// callout editor — the moments the list has to be right.
		const h = vault();
		await drafting(h);
		const after = h.vault.reads();

		h.discovery.schedulePrune(0);
		h.clock.advance(0);
		await settle();
		assert.strictEqual(h.vault.reads() - after, 2, "both files, right away");
	});
});

/* ========================================================================== */
/* 96. The automatic-discovery toggle                                         */
/* ========================================================================== */

describe("automatic discovery, switched off", () => {
	it("does not scan a changed file at all", async () => {
		const h = discoveryHarness({ "note.md": "> [!alpha] x" });
		h.settings.autoDiscoverCallouts = false;

		h.internals.scheduleFileScan(h.vault.file("note.md"));
		h.clock.advance(FILE_SCAN_MS);
		await settle();

		assert.strictEqual(h.vault.reads(), 0, "not even a cached read");
		assert.strictEqual(h.registry.get("alpha"), undefined);
	});

	it("takes effect immediately when switched back on", async () => {
		// The listener stays subscribed either way, so there is no registration
		// to redo and no launch to wait for.
		const h = discoveryHarness({ "note.md": "> [!alpha] x" });
		h.settings.autoDiscoverCallouts = false;
		h.internals.scheduleFileScan(h.vault.file("note.md"));
		h.clock.advance(FILE_SCAN_MS);
		await settle();

		h.settings.autoDiscoverCallouts = true;
		h.internals.scheduleFileScan(h.vault.file("note.md"));
		h.clock.advance(FILE_SCAN_MS);
		await settle();

		assert.ok(h.registry.get("alpha"));
	});

	it("leaves a vault scan the user asked for alone", async () => {
		// The toggle gates the automatic passes, never an action the user took.
		const h = discoveryHarness({ "note.md": "> [!alpha] x" });
		h.settings.autoDiscoverCallouts = false;

		assert.strictEqual(await h.discovery.runVaultScan(), 1);
		assert.ok(h.registry.get("alpha"));
	});

	it("leaves the rows already discovered exactly where they are", async () => {
		const h = discoveryHarness({ "note.md": "> [!alpha] x" });
		await h.internals.scanFileNow(h.vault.file("note.md"));

		h.settings.autoDiscoverCallouts = false;
		assert.ok(h.registry.get("alpha"), "nothing is taken away");
		assert.deepStrictEqual([...h.localState.discovered], ["alpha"]);
	});
});
