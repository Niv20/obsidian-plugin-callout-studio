/**
 * tests/calloutDiscoverySuppression.test.ts — an explicit delete beats discovery.
 *
 * This is the narrowest rule in the manager and the one with the least obvious
 * failure. Deleting a callout rewrites its usages across the vault with
 * `vault.modify`, but an open editor's CodeMirror buffer catches up with those
 * writes *asynchronously* — and `SettingsTab.display()`, which the delete calls
 * synchronously on the very next line, scans exactly those buffers for unknown
 * ids. Without a hold, the row is re-created one tick after it was removed and
 * arrives back as a fresh *uncustomized* fallback row: from the user's side, a
 * customized callout survived being deleted with its styling reset.
 *
 * So the hold has to be:
 *
 * - **checked in one place.** The guard sits with the other per-id guards inside
 *   `addUnknownCalloutsAsFallback`, which is what makes it cover the incremental
 *   file scan, the settings tab's open-buffer scan and the first-run modal
 *   alike.
 * - **keyed per spelling.** `normalizeCalloutId` lowercases and collapses
 *   whitespace; it does *not* dasherize. A leftover `[!my-id]` is therefore a
 *   different key from `my id`, which is precisely why the doc tells callers to
 *   pass `CalloutRegistry.vaultIdFormsFor`.
 * - **time-bounded, not permanent.** It answers a race, not a policy: an id the
 *   user genuinely writes again later deserves its row back, because that is
 *   discovery's whole job.
 * - **dropped entirely by a user-requested scan.** `runVaultScan` is the user
 *   asking for these rows, so nothing may be held back from it.
 *
 * The same guard now answers a second, unrelated question — a callout type the
 * active theme stopped supplying, which must not come back from notes that
 * still mention it. That one is a policy rather than a race, so it has no
 * expiry; the last suite here is what keeps the two apart.
 *
 * The virtual clock driving `Date.now()` here is documented in
 * tests/support/discoveryHarness.ts.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import {
	definition,
	discoveryHarness,
	settle,
} from "./support/discoveryHarness";

/** Mirrors `CalloutDiscovery.REDISCOVERY_SUPPRESS_MS`, which is private. */
const WINDOW_MS = 5000;

describe("suppressRediscovery — holding a just-deleted id off", () => {
	it("stops discovery from re-creating the row", () => {
		const h = discoveryHarness();
		h.discovery.suppressRediscovery(["gone"]);
		assert.strictEqual(h.discovery.addUnknownCalloutsAsFallback(["gone"]), 0);
		assert.strictEqual(h.registry.get("gone"), undefined);
	});

	it("holds only the ids it was given", () => {
		const h = discoveryHarness();
		h.discovery.suppressRediscovery(["gone"]);
		assert.strictEqual(h.internals.hold.holds("gone"), true);
		assert.strictEqual(h.internals.hold.holds("other"), false);
	});

	it("lets the rest of the batch through", () => {
		// A suppressed id must not cost the other unknown ids in the same scan
		// their rows — the guard is per-id, inside the loop.
		const h = discoveryHarness();
		h.discovery.suppressRediscovery(["gone"]);
		assert.strictEqual(
			h.discovery.addUnknownCalloutsAsFallback(["gone", "alpha", "beta"]),
			2,
		);
		assert.deepStrictEqual(
			h.registry.getUserDefined().map((d) => d.id),
			["alpha", "beta"],
		);
	});

	it("ignores ids that normalize to nothing", () => {
		const h = discoveryHarness();
		h.discovery.suppressRediscovery(["", "   ", "\t"]);
		assert.strictEqual(h.internals.hold.holds(""), false);
		assert.strictEqual(h.internals.hold.holds("   "), false);
	});

	it("keys the hold on the normalized id, on write and on read alike", () => {
		const h = discoveryHarness();
		h.discovery.suppressRediscovery(["  GONE  "]);
		assert.strictEqual(h.internals.hold.holds("gone"), true);
		assert.strictEqual(h.internals.hold.holds("GONE"), true);
		assert.strictEqual(h.internals.hold.holds(" gone "), true);
	});

	it("collapses a whitespace run the same way an id lookup does", () => {
		const h = discoveryHarness();
		h.discovery.suppressRediscovery(["a   b"]);
		assert.strictEqual(h.internals.hold.holds("a b"), true);
	});

	it("does NOT cover the dash spelling — which is why callers pass every form", () => {
		// normalizeCalloutId does not dasherize, so `a b` and `a-b` are two keys.
		// A leftover `[!a-b]` in an open buffer would otherwise walk straight
		// past the hold and re-create the row under the dash form.
		const h = discoveryHarness();
		h.discovery.suppressRediscovery(["a b"]);
		assert.strictEqual(h.internals.hold.holds("a-b"), false);
		assert.strictEqual(h.discovery.addUnknownCalloutsAsFallback(["a-b"]), 1);
	});

	it("covers both once the caller passes what vaultIdFormsFor returns", () => {
		const h = discoveryHarness();
		const def = definition({ id: "a b" });
		h.registry.add(def);
		const forms = h.registry.vaultIdFormsFor(def);
		assert.deepStrictEqual(forms, ["a b", "a-b"]);

		h.registry.remove("a b");
		h.discovery.suppressRediscovery(forms);
		assert.strictEqual(
			h.discovery.addUnknownCalloutsAsFallback(["a b", "a-b"]),
			0,
		);
	});
});

describe("suppressRediscovery — the time window", () => {
	it("still holds one millisecond before it expires", () => {
		const h = discoveryHarness();
		h.discovery.suppressRediscovery(["gone"]);
		h.clock.advance(WINDOW_MS - 1);
		assert.strictEqual(h.internals.hold.holds("gone"), true);
		assert.strictEqual(h.discovery.addUnknownCalloutsAsFallback(["gone"]), 0);
	});

	it("is over exactly at the deadline", () => {
		const h = discoveryHarness();
		h.discovery.suppressRediscovery(["gone"]);
		h.clock.advance(WINDOW_MS);
		assert.strictEqual(h.internals.hold.holds("gone"), false);
	});

	it("gives the row back once the window has passed", () => {
		// Deliberately time-bounded rather than permanent: an id the user
		// genuinely writes again later deserves its row, and that is discovery's
		// whole job.
		const h = discoveryHarness();
		h.discovery.suppressRediscovery(["gone"]);
		h.clock.advance(WINDOW_MS + 1);
		assert.strictEqual(h.discovery.addUnknownCalloutsAsFallback(["gone"]), 1);
		assert.ok(h.registry.get("gone"));
	});

	it("stays expired, and can be re-armed", () => {
		// The map is swept on read rather than by a timer of its own, so the
		// expired entry is dropped the first time it is asked about. Re-arming
		// must still work afterwards.
		const h = discoveryHarness();
		h.discovery.suppressRediscovery(["gone"]);
		h.clock.advance(WINDOW_MS);
		assert.strictEqual(h.internals.hold.holds("gone"), false);
		assert.strictEqual(h.internals.hold.holds("gone"), false);

		h.discovery.suppressRediscovery(["gone"]);
		assert.strictEqual(h.internals.hold.holds("gone"), true);
	});

	it("re-arming restarts the clock rather than extending the old deadline", () => {
		const h = discoveryHarness();
		h.discovery.suppressRediscovery(["gone"]);
		h.clock.advance(WINDOW_MS - 1);
		h.discovery.suppressRediscovery(["gone"]);
		h.clock.advance(WINDOW_MS - 1);
		assert.strictEqual(h.internals.hold.holds("gone"), true);
	});

	it("expires each id on its own schedule", () => {
		const h = discoveryHarness();
		h.discovery.suppressRediscovery(["first"]);
		h.clock.advance(WINDOW_MS - 1);
		h.discovery.suppressRediscovery(["second"]);
		h.clock.advance(1);
		assert.strictEqual(h.internals.hold.holds("first"), false);
		assert.strictEqual(h.internals.hold.holds("second"), true);
	});
});

describe("clearRediscoverySuppression", () => {
	it("drops every hold at once", () => {
		const h = discoveryHarness();
		h.discovery.suppressRediscovery(["one", "two", "three"]);
		h.discovery.clearRediscoverySuppression();
		assert.strictEqual(h.internals.hold.holds("one"), false);
		assert.strictEqual(h.internals.hold.holds("two"), false);
		assert.strictEqual(h.internals.hold.holds("three"), false);
		assert.strictEqual(
			h.discovery.addUnknownCalloutsAsFallback(["one", "two", "three"]),
			3,
		);
	});

	it("is harmless when nothing is held", () => {
		const h = discoveryHarness();
		h.discovery.clearRediscoverySuppression();
		assert.strictEqual(h.internals.hold.holds("anything"), false);
	});
});

describe("runVaultScan clears the hold", () => {
	it("brings a suppressed id straight back", async () => {
		// The user asked for this scan, so nothing may be held back from it.
		const h = discoveryHarness({ "note.md": "> [!gone] leftover" });
		h.discovery.suppressRediscovery(["gone"]);
		assert.strictEqual(await h.discovery.runVaultScan(), 1);
		assert.ok(h.registry.get("gone"));
		assert.strictEqual(h.internals.hold.holds("gone"), false);
	});

	it("clears the hold even when the scan itself finds nothing", async () => {
		const h = discoveryHarness({ "note.md": "plain text" });
		h.discovery.suppressRediscovery(["gone"]);
		assert.strictEqual(await h.discovery.runVaultScan(), 0);
		assert.strictEqual(h.internals.hold.holds("gone"), false);
	});
});

describe("the race this exists for", () => {
	it("keeps a stale open-buffer scan from resurrecting a deleted row", () => {
		// The real sequence: the user deletes a customized callout, the delete
		// rewrites the vault, and SettingsTab.display() immediately rescans the
		// open CodeMirror buffers — which still hold the pre-rewrite text.
		const h = discoveryHarness();
		const def = definition({
			id: "my id",
			source: "fallback",
			customized: true,
			colorLight: "#abcdef",
		});
		h.registry.add(def);

		const forms = h.registry.vaultIdFormsFor(def);
		h.registry.remove("my id");
		h.discovery.suppressRediscovery(forms);

		// The stale buffer still spells it both ways.
		const staleScan = ["my id", "my-id"];
		assert.strictEqual(
			h.discovery.addUnknownCalloutsAsFallback(staleScan),
			0,
		);
		assert.strictEqual(h.registry.get("my id"), undefined);
		assert.strictEqual(h.registry.get("my-id"), undefined);
	});

	it("still lets the id come back if the user really writes it again", async () => {
		const h = discoveryHarness({ "note.md": "plain" });
		h.discovery.suppressRediscovery(["my id", "my-id"]);
		h.clock.advance(WINDOW_MS + 1);

		h.vault.write("note.md", "> [!my id] I want it back");
		assert.strictEqual(await h.discovery.runVaultScan(), 1);
		const back = h.registry.get("my id");
		assert.ok(back);
		// And it comes back as what it is now — a fresh, unadopted row.
		assert.strictEqual(back.source, "fallback");
		assert.notStrictEqual(back.customized, true);
		await settle();
	});

	it("covers the incremental file scan through the very same guard", async () => {
		const h = discoveryHarness({ "note.md": "> [!gone] leftover" });
		h.discovery.suppressRediscovery(["gone"]);
		await h.internals.scanFileNow(h.vault.file("note.md"));
		assert.strictEqual(h.registry.get("gone"), undefined);

		h.clock.advance(WINDOW_MS + 1);
		await h.internals.scanFileNow(h.vault.file("note.md"));
		assert.ok(h.registry.get("gone"));
	});
});

describe("a callout type the theme stopped supplying", () => {
	/**
	 * The other reason discovery is held back, and the opposite kind of reason:
	 * not a race that resolves in five seconds, but a standing fact about the
	 * vault. When a theme is switched away from, its own callout types leave
	 * with it — and the notes, which still say `> [!recite]`, would otherwise
	 * hand them straight back as fallback rows.
	 */

	it("is not re-created from notes that still use it", () => {
		const h = discoveryHarness();
		h.settings.retiredThemeIds = ["recite"];
		assert.strictEqual(h.discovery.addUnknownCalloutsAsFallback(["recite"]), 0);
		assert.strictEqual(h.registry.get("recite"), undefined);
	});

	it("does not expire the way a delete does", () => {
		// Five seconds later the delete hold is gone and this one is not: an id
		// the theme no longer supplies is not going to start existing again on
		// its own.
		const h = discoveryHarness();
		h.settings.retiredThemeIds = ["recite"];
		h.clock.advance(WINDOW_MS * 100);
		assert.strictEqual(h.internals.hold.holds("recite"), true);
	});

	it("holds every spelling the notes might use", () => {
		const h = discoveryHarness();
		h.settings.retiredThemeIds = ["recite"];
		assert.strictEqual(h.internals.hold.holds("Recite"), true);
		assert.strictEqual(h.internals.hold.holds("  recite "), true);
	});

	it("still lets the user create the id explicitly", () => {
		// The list gates automatic discovery and nothing else. Creating the
		// callout is how you take the id over once the theme has let go of it.
		const h = discoveryHarness();
		h.settings.retiredThemeIds = ["recite"];
		assert.strictEqual(h.registry.add(definition({ id: "recite" })), true);
		assert.ok(h.registry.get("recite"));
	});

	it("is dropped by a user-requested vault scan", async () => {
		const h = discoveryHarness();
		h.settings.retiredThemeIds = ["recite"];
		await h.discovery.runVaultScan();
		assert.deepStrictEqual(h.settings.retiredThemeIds, []);
	});

	it("lets the rest of the batch through", () => {
		const h = discoveryHarness();
		h.settings.retiredThemeIds = ["recite"];
		assert.strictEqual(
			h.discovery.addUnknownCalloutsAsFallback(["recite", "keeper"]),
			1,
		);
		assert.ok(h.registry.get("keeper"));
	});
});
