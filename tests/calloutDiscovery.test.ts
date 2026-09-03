/**
 * tests/calloutDiscovery.test.ts — auto-creation, pruning and the vault scan.
 *
 * Discovery is the one subsystem that writes to the registry without the user
 * asking, and prunes from it without the user asking either. Both directions
 * are only safe because of a short list of guards, and every one of them was
 * added after the failure it prevents had already shipped:
 *
 * - **A batch is one notification.** `onChange` costs a full stylesheet
 *   regeneration, a document-wide icon repaint, an editor refresh in every leaf
 *   and a `data.json` write. A template carrying six unknown ids used to pay all
 *   of that six times over, synchronously — which on mobile reads as the view
 *   jumping. So both the add loop and the prune loop are wrapped in
 *   `registry.batch()`, and "how many events" is a real assertion here.
 * - **A prune must not take a claim with it.** A row is only a candidate while
 *   the user has shown no interest in it: not customized, not handed back to a
 *   theme, and — the case that cost a hotkey — not referenced by a command the
 *   user built. `CustomCommandManager.syncAll()` drops any command whose callout
 *   `registry.has()` cannot find, so pruning the row deletes the command and the
 *   binding under it.
 * - **A row owns every spelling that renders as it does.** Obsidian dasherizes
 *   `data-callout`, so `a b` and `a-b` are one callout on screen. `buildKnownIds`
 *   registers both forms so a hand-written `[!a-b]` is not "unknown", and the
 *   prune counts both forms so a row written only in the dash spelling does not
 *   read as unused and delete itself.
 *
 * Item 90 (rediscovery suppression) lives in calloutDiscoverySuppression.test.ts
 * and items 93–94 (the incremental per-file scan) in
 * calloutDiscoveryIncremental.test.ts; the virtual clock they all share is
 * documented in tests/support/discoveryHarness.ts.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import {
	definition,
	discovered,
	discoveryHarness,
	settle,
} from "./support/discoveryHarness";
import { DEFAULT_CALLOUTS } from "../src/constants";
import { scanStringForUnknownCallouts } from "../src/utils/vaultCalloutScanner";
import { filterUsableCallouts } from "../src/utils/usableCallouts";
import type { CalloutDefinition } from "../src/types";

const noteDefault = DEFAULT_CALLOUTS.find(
	(c) => c.id === "note",
) as CalloutDefinition;
const warningDefault = DEFAULT_CALLOUTS.find(
	(c) => c.id === "warning",
) as CalloutDefinition;

/** Narrow away the `undefined` an id lookup carries, with a useful message. */
function row(
	def: CalloutDefinition | undefined,
	id: string,
): CalloutDefinition {
	if (!def) throw new Error(`expected a row for "${id}"`);
	return def;
}

/* ========================================================================== */
/* 88. addUnknownCalloutsAsFallback                                           */
/* ========================================================================== */

describe("addUnknownCalloutsAsFallback — how many rows get created", () => {
	it("returns 0 and notifies nobody for an empty list", () => {
		const h = discoveryHarness();
		const before = h.changes();
		assert.strictEqual(h.discovery.addUnknownCalloutsAsFallback([]), 0);
		assert.strictEqual(h.changes(), before);
	});

	it("creates one row per unknown id and returns that count", () => {
		const h = discoveryHarness();
		assert.strictEqual(
			h.discovery.addUnknownCalloutsAsFallback(["alpha", "beta", "gamma"]),
			3,
		);
		assert.deepStrictEqual(
			h.registry.getUserDefined().map((d) => d.id),
			["alpha", "beta", "gamma"],
		);
	});

	it("announces the whole batch with exactly one onChange", () => {
		// The reason the loop is wrapped in `registry.batch()` at all: one event
		// per row means one stylesheet regeneration, icon repaint, editor
		// refresh and `css-change` per row, all in one synchronous burst.
		const h = discoveryHarness();
		const before = h.changes();
		h.discovery.addUnknownCalloutsAsFallback(["alpha", "beta", "gamma"]);
		assert.strictEqual(h.changes() - before, 1);
	});

	it("fires no event at all when every id was rejected", () => {
		// `batch()` only flushes if something inside it actually mutated, so a
		// batch that added nothing must stay silent.
		const h = discoveryHarness();
		const before = h.changes();
		assert.strictEqual(
			h.discovery.addUnknownCalloutsAsFallback(["note", "warning"]),
			0,
		);
		assert.strictEqual(h.changes(), before);
	});

	it("counts only the ids it really added", () => {
		const h = discoveryHarness();
		// `note` is a built-in and `alpha` is created by this same call, so only
		// two of the four ids are new.
		assert.strictEqual(
			h.discovery.addUnknownCalloutsAsFallback([
				"note",
				"alpha",
				"alpha",
				"beta",
			]),
			2,
		);
	});
});

describe("addUnknownCalloutsAsFallback — the shape of a created row", () => {
	it("marks the row auto-created, not built-in, and not customized", () => {
		const h = discoveryHarness();
		h.discovery.addUnknownCalloutsAsFallback(["alpha"]);
		const def = row(h.registry.get("alpha"), "alpha");
		assert.strictEqual(def.source, "fallback");
		assert.strictEqual(def.builtIn, false);
		assert.notStrictEqual(def.customized, true);
		// Aliases are cleared rather than inherited: an alias is an identity the
		// fallback callout owns, and two rows claiming it would collide.
		assert.deepStrictEqual(def.aliases, []);
	});

	it("names the row the way Obsidian would title it", () => {
		// Obsidian's own default title is `type.replace(/-/g," ")` capitalized,
		// so a discovered row reads identically to what the untouched callout
		// already rendered as — see obsidianDefaultTitle.
		const h = discoveryHarness();
		h.discovery.addUnknownCalloutsAsFallback([
			"multi-word-id",
			"my note",
			"x",
		]);
		assert.strictEqual(
			row(h.registry.get("multi-word-id"), "multi-word-id").displayName,
			"Multi word id",
		);
		assert.strictEqual(
			row(h.registry.get("my note"), "my note").displayName,
			"My note",
		);
		assert.strictEqual(row(h.registry.get("x"), "x").displayName, "X");
	});

	it("mirrors the configured fallback callout's icon and colours", () => {
		const h = discoveryHarness();
		h.settings.fallbackCalloutId = "warning";
		h.discovery.addUnknownCalloutsAsFallback(["alpha"]);
		const def = row(h.registry.get("alpha"), "alpha");
		assert.deepStrictEqual(def.icon, warningDefault.icon);
		assert.strictEqual(def.colorLight, warningDefault.colorLight);
		assert.strictEqual(def.colorDark, warningDefault.colorDark);
	});

	it("treats an empty fallback id as `note`, and follows the user's edits to it", () => {
		const h = discoveryHarness();
		h.registry.update("note", { colorLight: "#010203" });
		h.settings.fallbackCalloutId = "";
		h.discovery.addUnknownCalloutsAsFallback(["alpha"]);
		assert.strictEqual(
			row(h.registry.get("alpha"), "alpha").colorLight,
			"#010203",
		);
	});

	it("does not inherit the fallback callout's `customized` flag", async () => {
		// The row is built by spreading the fallback definition whole, and the
		// keys overridden after it are this row's own identity. `customized`
		// used not to be among them, so the moment the user pointed **Fallback
		// callout** at one of their own callouts — every user-created callout
		// is saved with `customized: true` — every row discovery created from
		// then on was born claiming to have been edited by hand.
		//
		// Two things followed, and both were silent: `pruneUnused` skipped the
		// row forever, so auto-created rows accumulated and never cleaned
		// themselves up; and `filterUsableCallouts` read it as adopted, so it
		// kept being offered in autocomplete long after its last usage was
		// gone.
		//
		// `restyleUncustomizedFallbackRows` — the *other* place a fallback row
		// is made to mirror the fallback callout — copies only the style fields
		// and never this flag. Both assertions below are on the consequences
		// rather than the flag alone, because the flag is only ever read
		// through them.
		const h = discoveryHarness({ "note.md": "plain" });
		h.registry.add(
			definition({ id: "mystyle", source: "user", customized: true }),
		);
		h.settings.fallbackCalloutId = "mystyle";
		h.discovery.addUnknownCalloutsAsFallback(["alpha"]);

		const alpha = row(h.registry.get("alpha"), "alpha");
		assert.notStrictEqual(alpha.customized, true);
		// Autocomplete: a row a scan has confirmed is unused must not survive
		// the filter as if the user had adopted it.
		assert.deepStrictEqual(filterUsableCallouts([alpha], () => true), []);
		// The prune: `note.md` never mentions `[!alpha]`, so the row is unused
		// and must go.
		assert.strictEqual(await h.discovery.pruneUnused(), 1);
		assert.strictEqual(h.registry.get("alpha"), undefined);
	});

	it("does not inherit the fallback callout's `externalStyle` flag", async () => {
		// The same spread, and a sharper consequence: `externalStyle` means
		// "this callout's styling belongs to the theme", so a row born with it
		// was skipped by `restyleUncustomizedFallbackRows` as well as by the
		// prune — it could never follow the fallback again, and the CSS that
		// would have painted it was suppressed.
		const h = discoveryHarness({ "note.md": "plain" });
		h.registry.add(
			definition({ id: "themed", source: "user", externalStyle: true }),
		);
		h.settings.fallbackCalloutId = "themed";
		h.discovery.addUnknownCalloutsAsFallback(["alpha"]);

		assert.notStrictEqual(
			row(h.registry.get("alpha"), "alpha").externalStyle,
			true,
		);
		// The consequence the flag would have cost it: pointing the setting
		// somewhere else must still re-style the row.
		h.settings.fallbackCalloutId = "warning";
		assert.strictEqual(h.discovery.restyleUncustomizedFallbackRows(), 1);
		assert.strictEqual(
			row(h.registry.get("alpha"), "alpha").colorLight,
			warningDefault.colorLight,
		);
		// And the prune must still be able to take it.
		assert.strictEqual(await h.discovery.pruneUnused(), 1);
		assert.strictEqual(h.registry.get("alpha"), undefined);
	});

	it("gives every row its own icon object", () => {
		// `{ ...fallback, icon: fallback.icon, … }` restated a key the spread
		// had already copied, and restated it as the *same reference* — so
		// every row a scan created, and the live fallback definition in the
		// registry, all shared one `CalloutIcon`. Nothing mutates an icon in
		// place today, which is exactly why it stayed invisible; the sibling
		// path `restyleUncustomizedFallbackRows` clones it rather than rely on
		// that, and so does this one now.
		const h = discoveryHarness();
		h.discovery.addUnknownCalloutsAsFallback(["alpha", "beta"]);
		const alpha = row(h.registry.get("alpha"), "alpha");
		const beta = row(h.registry.get("beta"), "beta");
		const note = row(h.registry.get("note"), "note");

		assert.deepStrictEqual(alpha.icon, note.icon, "same drawing");
		assert.notStrictEqual(alpha.icon, beta.icon, "shared between rows");
		assert.notStrictEqual(alpha.icon, note.icon, "shared with the source");
		// A write through one row must not be visible through any other — the
		// failure the identity assertions above are standing in for.
		alpha.icon.value = "lucide-anchor";
		assert.notStrictEqual(beta.icon.value, "lucide-anchor");
		assert.notStrictEqual(note.icon.value, "lucide-anchor");
	});

	it("clones the other objects the fallback hands over by reference", () => {
		// `icon` is not the only one the spread aliases: a gradient and a
		// per-role icon-adjust map are objects too, and the sibling path clones
		// both (`{ ...bgGradient }`, `structuredClone(iconAdjust)`).
		const h = discoveryHarness();
		h.registry.add(
			definition({
				id: "fancy",
				source: "user",
				bgColorLight: "#101010",
				bgColorDark: "#202020",
				bgGradient: {
					angleDeg: 45,
					toColorLight: "#303030",
					toColorDark: "#404040",
				},
				iconAdjust: { regular: { offsetX: 2 } },
			}),
		);
		h.settings.fallbackCalloutId = "fancy";
		h.discovery.addUnknownCalloutsAsFallback(["alpha"]);
		const alpha = row(h.registry.get("alpha"), "alpha");
		const fancy = row(h.registry.get("fancy"), "fancy");

		assert.deepStrictEqual(alpha.bgGradient, fancy.bgGradient);
		assert.notStrictEqual(alpha.bgGradient, fancy.bgGradient);
		assert.deepStrictEqual(alpha.iconAdjust, fancy.iconAdjust);
		assert.notStrictEqual(alpha.iconAdjust, fancy.iconAdjust);
		// Nested one level down as well, which a shallow spread would miss.
		assert.notStrictEqual(alpha.iconAdjust?.regular, fancy.iconAdjust?.regular);
	});

	it("falls back to the SHIPPED note when the configured fallback is gone", () => {
		// `registry.get(fallbackId) ?? noteDefault` reaches past the registry to
		// `constants.ts`, so a stale `fallbackCalloutId` pointing at a deleted
		// callout still produces a styled row rather than a crash — and
		// deliberately not the user's edited `note`, which is what distinguishes
		// this path from the one above.
		const h = discoveryHarness();
		h.registry.update("note", { colorLight: "#010203" });
		h.settings.fallbackCalloutId = "deleted-long-ago";
		h.discovery.addUnknownCalloutsAsFallback(["alpha"]);
		assert.strictEqual(
			row(h.registry.get("alpha"), "alpha").colorLight,
			noteDefault.colorLight,
		);
	});
});

describe("addUnknownCalloutsAsFallback — duplicates and id spellings", () => {
	it("never shadows a callout that already exists", () => {
		const h = discoveryHarness();
		h.registry.add(definition({ id: "quiet", colorLight: "#111111" }));
		const before = h.registry.getAll().length;
		assert.strictEqual(
			h.discovery.addUnknownCalloutsAsFallback(["note", "quiet"]),
			0,
		);
		assert.strictEqual(h.registry.getAll().length, before);
		// The existing rows are untouched — no restyle, no source change.
		assert.strictEqual(
			row(h.registry.get("quiet"), "quiet").colorLight,
			"#111111",
		);
		assert.strictEqual(row(h.registry.get("note"), "note").source, "builtin");
	});

	it("adds a repeated id once, because the guard reads live registry state", () => {
		// `batch()` changes only WHEN listeners hear about a mutation, never what
		// each mutation does — so the second pass through the loop already sees
		// the row the first one created.
		const h = discoveryHarness();
		assert.strictEqual(
			h.discovery.addUnknownCalloutsAsFallback([
				"alpha",
				"alpha",
				"alpha",
			]),
			1,
		);
		assert.strictEqual(
			h.registry.getUserDefined().filter((d) => d.id === "alpha").length,
			1,
		);
	});

	it("refuses a spelling an existing callout already owns through data-callout", () => {
		// `a b` and `a-b` render as the same `data-callout`, so a second row
		// would only fight the first over one CSS rule. buildKnownIds keeps the
		// discovery paths from ever reaching here; this guard covers the
		// first-run modal, which hands a user-approved list straight in.
		const h = discoveryHarness();
		h.registry.add(definition({ id: "a b" }));
		assert.strictEqual(h.discovery.addUnknownCalloutsAsFallback(["a-b"]), 0);
		assert.strictEqual(h.registry.get("a-b"), undefined);
	});

	it("refuses it in the other direction too", () => {
		// findAttrIdConflict is deliberately symmetric — a precedence ladder
		// would let the literal id win and hide the conflict one way round.
		const h = discoveryHarness();
		h.registry.add(definition({ id: "a-b" }));
		assert.strictEqual(h.discovery.addUnknownCalloutsAsFallback(["a b"]), 0);
		assert.strictEqual(h.registry.get("a b"), undefined);
	});

	it("refuses a spelling an existing callout owns through an ALIAS", () => {
		const h = discoveryHarness();
		h.registry.add(definition({ id: "quiet", aliases: ["hush hush"] }));
		assert.strictEqual(
			h.discovery.addUnknownCalloutsAsFallback(["hush-hush"]),
			0,
		);
	});

	it("stores the id exactly as handed in — normalization is the scanner's job", () => {
		// Deliberate division of labour, and worth pinning because it is easy to
		// misread as a gap: every discovery path funnels through
		// `scanStringForUnknownCallouts`, which already ran `normalizeCalloutId`
		// and `mergeDashSpaceVariants` over what it returns. This function trusts
		// that and re-normalizes only for the bookkeeping it owns (the
		// suppression lookup and the zero-usage set), so an id arrives here
		// already canonical.
		const h = discoveryHarness();
		h.discovery.addUnknownCalloutsAsFallback(["a b"]);
		assert.ok(h.registry.get("a b"), "canonical id stored verbatim");
		// And the round trip the real callers make is a no-op:
		assert.deepStrictEqual(
			scanStringForUnknownCallouts("> [!A   B] title", new Set()),
			["a b"],
		);
	});
});

/* ========================================================================== */
/* 89. pruneUnused                                                            */
/* ========================================================================== */

describe("pruneUnused — what counts as a candidate", () => {
	it("removes an auto-created row with no usages left anywhere", async () => {
		const h = discoveryHarness({ "note.md": "plain text" });
		h.registry.add(discovered("orphan"));
		assert.strictEqual(await h.discovery.pruneUnused(), 1);
		assert.strictEqual(h.registry.get("orphan"), undefined);
	});

	it("keeps a row that is still written somewhere in the vault", async () => {
		const h = discoveryHarness({ "note.md": "> [!orphan] still here" });
		h.registry.add(discovered("orphan"));
		assert.strictEqual(await h.discovery.pruneUnused(), 0);
		assert.ok(h.registry.get("orphan"));
	});

	it("counts every spelling the row owns, not just its stored id", async () => {
		// The row is stored as `a b` but the vault only ever spells it `[!a-b]`.
		// Both render identically, so reading that as zero usage would have the
		// row prune itself out from under its own content.
		const h = discoveryHarness({ "note.md": "> [!a-b] hand written" });
		h.registry.add(discovered("a b"));
		assert.strictEqual(await h.discovery.pruneUnused(), 0);
		assert.ok(h.registry.get("a b"));
	});

	it("sees usages in every render role, not only block callouts", async () => {
		const h = discoveryHarness({
			"heading.md": "### [!alpha] Heading",
			"inline.md": "see [!beta] here",
		});
		h.registry.add(discovered("alpha"));
		h.registry.add(discovered("beta"));
		assert.strictEqual(await h.discovery.pruneUnused(), 0);
	});

	it("ignores a `[!id]` inside fenced code, like every other scanner does", async () => {
		const h = discoveryHarness({
			"note.md": ["```", "> [!orphan] not real", "```"].join("\n"),
		});
		h.registry.add(discovered("orphan"));
		assert.strictEqual(await h.discovery.pruneUnused(), 1);
	});

	it("never touches a user-created row, however unused", async () => {
		const h = discoveryHarness({ "note.md": "plain" });
		h.registry.add(definition({ id: "mine", source: "user" }));
		assert.strictEqual(await h.discovery.pruneUnused(), 0);
		assert.ok(h.registry.get("mine"));
	});

	it("never touches a built-in", async () => {
		const h = discoveryHarness({ "note.md": "plain" });
		assert.strictEqual(await h.discovery.pruneUnused(), 0);
		assert.strictEqual(h.registry.getBuiltIn().length, DEFAULT_CALLOUTS.length);
	});

	it("does not read the vault at all when nothing is prunable", async () => {
		const h = discoveryHarness({ "a.md": "x", "b.md": "y" });
		assert.strictEqual(await h.discovery.pruneUnused(), 0);
		assert.strictEqual(h.vault.reads(), 0);
	});
});

describe("pruneUnused — the claims that make a row stick", () => {
	it("keeps a row the user customized", async () => {
		const h = discoveryHarness({ "note.md": "plain" });
		h.registry.add(discovered("adopted", { customized: true }));
		assert.strictEqual(await h.discovery.pruneUnused(), 0);
		assert.ok(h.registry.get("adopted"));
	});

	it("keeps a row handed back to the theme", async () => {
		// `externalStyle` is as sticky as `customized`, and for a sharper reason:
		// pruning the row takes the flag with it, and the id falls straight back
		// under generateFallbackCSS's `!important` catch-all — so a theme callout
		// the user opted out of would silently start being repainted again.
		const h = discoveryHarness({ "note.md": "plain" });
		h.registry.add(discovered("themed", { externalStyle: true }));
		assert.strictEqual(await h.discovery.pruneUnused(), 0);
		assert.ok(h.registry.get("themed"));
	});

	it("keeps a row a custom command points at", async () => {
		// The item this whole test file exists for. A command is a deliberate
		// claim on a callout, exactly like customizing it — and
		// CustomCommandManager.syncAll() drops any command whose callout
		// `registry.has()` cannot find, so pruning the row would delete the
		// command and the hotkey bound to it the moment the last note using the
		// callout went away.
		const h = discoveryHarness({ "note.md": "plain" });
		h.registry.add(discovered("commanded"));
		h.settings.customCommands.push({
			id: "cc-1",
			calloutId: "commanded",
			role: "regular",
			action: "wrap",
		});
		assert.strictEqual(await h.discovery.pruneUnused(), 0);
		assert.ok(h.registry.get("commanded"));
	});

	it("protects only the row the command actually names", async () => {
		const h = discoveryHarness({ "note.md": "plain" });
		h.registry.add(discovered("commanded"));
		h.registry.add(discovered("orphan"));
		h.settings.customCommands.push({
			id: "cc-1",
			calloutId: "commanded",
			role: "inline",
		});
		assert.strictEqual(await h.discovery.pruneUnused(), 1);
		assert.ok(h.registry.get("commanded"));
		assert.strictEqual(h.registry.get("orphan"), undefined);
	});

	it("re-checks the row after the scan, so a mid-flight edit still wins", async () => {
		// The usage scan is async and the settings editor is not, so a row can be
		// adopted while the vault pass is in flight. The re-check inside the
		// batch is what stops the prune from deleting an edit the user has
		// already made.
		const h = discoveryHarness({ "note.md": "plain" });
		h.registry.add(discovered("racing"));
		const pruning = h.discovery.pruneUnused();
		h.registry.update("racing", { customized: true });
		assert.strictEqual(await pruning, 0);
		assert.ok(h.registry.get("racing"));
	});

	it("does nothing while pruning is suspended", async () => {
		// Set while the callout editor modal is open: the draft row in there is
		// unused by definition.
		const h = discoveryHarness({ "note.md": "plain" });
		h.registry.add(discovered("orphan"));
		h.discovery.pruneSuspended = true;
		assert.strictEqual(await h.discovery.pruneUnused(), 0);
		assert.strictEqual(h.vault.reads(), 0);
		assert.ok(h.registry.get("orphan"));
	});
});

describe("pruneUnused — reporting and side effects", () => {
	it("announces a multi-row prune with exactly one onChange", async () => {
		const h = discoveryHarness({ "note.md": "plain" });
		h.registry.add(discovered("a"));
		h.registry.add(discovered("b"));
		h.registry.add(discovered("c"));
		const before = h.changes();
		assert.strictEqual(await h.discovery.pruneUnused(), 3);
		assert.strictEqual(h.changes() - before, 1);
	});

	it("persists exactly once, and only when something was removed", async () => {
		const h = discoveryHarness({ "note.md": "plain" });
		h.registry.add(discovered("a"));
		h.registry.add(discovered("b"));
		assert.strictEqual(await h.discovery.pruneUnused(), 2);
		assert.strictEqual(h.saves(), 1);
		// Nothing prunable left: no second write.
		assert.strictEqual(await h.discovery.pruneUnused(), 0);
		assert.strictEqual(h.saves(), 1);
	});

	it("removes nothing when the usage scan fails", async () => {
		// An unreadable file must not be read as "this callout is unused" — that
		// would delete a row over a transient I/O error.
		const h = discoveryHarness({ "note.md": "> [!orphan] here" });
		h.vault.breakRead("note.md");
		h.registry.add(discovered("orphan"));
		assert.strictEqual(await h.discovery.pruneUnused(), 0);
		assert.ok(h.registry.get("orphan"));
		assert.strictEqual(h.saves(), 0);
	});
});

/* ========================================================================== */
/* 91. isKnownZeroUsageFallback                                               */
/* ========================================================================== */

describe("isKnownZeroUsageFallback", () => {
	it("is false for an id no scan has ever reached a verdict on", () => {
		// "Unknown" must read as "might be real", not as "gone": a row that is
		// genuinely in use but was never adopted has to stay offerable in
		// autocomplete. See filterUsableCallouts.
		const h = discoveryHarness();
		assert.strictEqual(h.discovery.isKnownZeroUsageFallback("alpha"), false);
		assert.strictEqual(h.discovery.isKnownZeroUsageFallback("note"), false);
	});

	it("records the verdict a completed prune reached", async () => {
		const h = discoveryHarness({ "note.md": "plain" });
		h.registry.add(discovered("orphan"));
		await h.discovery.pruneUnused();
		assert.strictEqual(h.discovery.isKnownZeroUsageFallback("orphan"), true);
	});

	it("records it for a row the prune kept, which is the case that matters", async () => {
		// A command-claimed row survives the prune but is genuinely unused, so it
		// is filtered out of the offerable list — which is exactly why
		// CommandEditorModal re-pins the callout an existing command already
		// names before rendering its dropdown.
		const h = discoveryHarness({ "note.md": "plain" });
		h.registry.add(discovered("commanded"));
		h.settings.customCommands.push({
			id: "cc-1",
			calloutId: "commanded",
			role: "regular",
		});
		await h.discovery.pruneUnused();
		assert.ok(h.registry.get("commanded"));
		assert.strictEqual(
			h.discovery.isKnownZeroUsageFallback("commanded"),
			true,
		);
	});

	it("stays false for a row the scan found in use", async () => {
		const h = discoveryHarness({ "note.md": "> [!used] here" });
		h.registry.add(discovered("used"));
		await h.discovery.pruneUnused();
		assert.strictEqual(h.discovery.isKnownZeroUsageFallback("used"), false);
	});

	it("clears the verdict when the id turns up in the vault again", async () => {
		const h = discoveryHarness({ "note.md": "plain" });
		h.registry.add(discovered("commanded"));
		h.settings.customCommands.push({
			id: "cc-1",
			calloutId: "commanded",
			role: "regular",
		});
		await h.discovery.pruneUnused();
		assert.strictEqual(
			h.discovery.isKnownZeroUsageFallback("commanded"),
			true,
		);

		h.vault.write("note.md", "> [!commanded] back again");
		await h.discovery.pruneUnused();
		assert.strictEqual(
			h.discovery.isKnownZeroUsageFallback("commanded"),
			false,
		);
	});

	it("clears the verdict when discovery re-creates the row", async () => {
		// Being re-discovered means the id appears in file content right now, so
		// any earlier "confirmed gone" verdict no longer applies.
		const h = discoveryHarness({ "note.md": "plain" });
		h.registry.add(discovered("orphan"));
		await h.discovery.pruneUnused();
		assert.strictEqual(h.discovery.isKnownZeroUsageFallback("orphan"), true);

		h.discovery.addUnknownCalloutsAsFallback(["orphan"]);
		assert.strictEqual(h.discovery.isKnownZeroUsageFallback("orphan"), false);
	});

	it("answers on the canonical id, whatever spelling the caller has", async () => {
		const h = discoveryHarness({ "note.md": "plain" });
		h.registry.add(discovered("a b"));
		await h.discovery.pruneUnused();
		assert.strictEqual(h.discovery.isKnownZeroUsageFallback("a b"), true);
		assert.strictEqual(h.discovery.isKnownZeroUsageFallback("  A   B "), true);
		// Including the dash spelling. The verdict is about a CALLOUT, and `a b`
		// and `a-b` are one callout — Obsidian renders both as
		// `data-callout="a-b"` — so a per-spelling key would let autocomplete
		// answer "confirmed gone" and "might be real" about the same row
		// depending on which way the caller happened to spell it.
		assert.strictEqual(h.discovery.isKnownZeroUsageFallback("a-b"), true);
	});
});

/* ========================================================================== */
/* 92. buildKnownIds                                                          */
/* ========================================================================== */

describe("buildKnownIds", () => {
	it("carries every built-in id and alias", () => {
		const h = discoveryHarness();
		const known = h.discovery.buildKnownIds();
		for (const def of DEFAULT_CALLOUTS) {
			assert.ok(known.has(def.id), `missing built-in "${def.id}"`);
			for (const alias of def.aliases ?? []) {
				assert.ok(known.has(alias), `missing alias "${alias}"`);
			}
		}
	});

	it("registers a multi-word id under both spellings", () => {
		const h = discoveryHarness();
		h.registry.add(definition({ id: "a b" }));
		const known = h.discovery.buildKnownIds();
		assert.ok(known.has("a b"), "space form");
		assert.ok(known.has("a-b"), "data-callout form");
	});

	it("registers aliases under both spellings too", () => {
		const h = discoveryHarness();
		h.registry.add(definition({ id: "quiet", aliases: ["hush hush"] }));
		const known = h.discovery.buildKnownIds();
		assert.ok(known.has("hush hush"));
		assert.ok(known.has("hush-hush"));
	});

	it("lowercases and trims both forms", () => {
		const h = discoveryHarness();
		h.registry.add(definition({ id: "  Mixed   Case  " }));
		const known = h.discovery.buildKnownIds();
		assert.ok(known.has("mixed case"));
		assert.ok(known.has("mixed-case"));
	});

	it("contributes one entry for an id that is already dash-spelled", () => {
		// obsidianCalloutAttrId is identity for anything without whitespace, so
		// the two forms coincide and the Set folds them together.
		const h = discoveryHarness();
		const before = h.discovery.buildKnownIds().size;
		h.registry.add(definition({ id: "a-b" }));
		assert.strictEqual(h.discovery.buildKnownIds().size, before + 1);
	});

	it("is what stops a hand-written `[!a-b]` from being discovered twice", () => {
		// The payoff, spelled as the scanner sees it: a second row for the dash
		// spelling would only fight the first one over a single CSS rule.
		const h = discoveryHarness();
		h.registry.add(definition({ id: "a b" }));
		const known = h.discovery.buildKnownIds();
		assert.deepStrictEqual(
			scanStringForUnknownCallouts("> [!a-b] hand written", known),
			[],
		);
		assert.deepStrictEqual(
			scanStringForUnknownCallouts("> [!note] built in", known),
			[],
		);
		assert.deepStrictEqual(
			scanStringForUnknownCallouts("> [!brand new] x", known),
			["brand new"],
		);
	});

	it("re-reads the registry on every call", () => {
		const h = discoveryHarness();
		assert.ok(!h.discovery.buildKnownIds().has("later"));
		h.registry.add(definition({ id: "later" }));
		assert.ok(h.discovery.buildKnownIds().has("later"));
	});
});

/* ========================================================================== */
/* 95. runVaultScan                                                           */
/* ========================================================================== */

describe("runVaultScan", () => {
	it("creates a row for every unknown id across the whole vault", async () => {
		const h = discoveryHarness({
			"a.md": "> [!alpha] one",
			"b.md": "### [!beta] two",
			"c.md": "a [!gamma] pill and a [!note] built-in",
		});
		assert.strictEqual(await h.discovery.runVaultScan(), 3);
		assert.deepStrictEqual(
			h.registry
				.getUserDefined()
				.map((d) => d.id)
				.sort(),
			["alpha", "beta", "gamma"],
		);
	});

	it("merges dash and space spellings seen in different files into one row", async () => {
		// One callout on screen, so one row — and the spaced spelling wins,
		// because that is the form the editor's id field produces.
		const h = discoveryHarness({
			"a.md": "> [!a b] spaced",
			"b.md": "> [!a-b] dashed",
		});
		assert.strictEqual(await h.discovery.runVaultScan(), 1);
		assert.deepStrictEqual(
			h.registry.getUserDefined().map((d) => d.id),
			["a b"],
		);
	});

	it("refreshes when it found nothing, but writes nothing", async () => {
		// The user pressed a button, so the settings list has to redraw either
		// way — that was always this test's point. The save is the part that
		// changed: a scan that added no row has nothing to tell `data.json`,
		// and everything else the scan touches (the discovered-id index, the
		// first-run flag) lives in localStorage. On a synced vault an empty
		// write is still a file event, which is what issue #41 is made of.
		const h = discoveryHarness({ "a.md": "> [!note] known" });
		assert.strictEqual(await h.discovery.runVaultScan(), 0);
		assert.strictEqual(h.saves(), 0);
		assert.strictEqual(h.refreshes(), 1);
	});

	it("leaves firstRunCompleted alone unless asked", async () => {
		const h = discoveryHarness({ "a.md": "> [!alpha] x" });
		await h.discovery.runVaultScan();
		assert.strictEqual(h.localState.firstRunCompleted, false);
	});

	it("marks the first run as done when asked", async () => {
		const h = discoveryHarness({ "a.md": "> [!alpha] x" });
		await h.discovery.runVaultScan(true);
		assert.strictEqual(h.localState.firstRunCompleted, true);
	});

	it("keeps the flag off the settings file entirely", async () => {
		// It is a claim about a MACHINE, not about a vault. Synced, it told a
		// second device it had already scanned when it never had — and an
		// imported profile carrying `true` suppressed that device's first run
		// permanently. See manager/DeviceLocalStore.ts.
		const h = discoveryHarness();
		await h.discovery.runVaultScan(true);
		assert.ok(
			!("firstRunCompleted" in h.registry.toSaveData().settings),
		);
	});

	it("does not re-add ids the registry already knows in either spelling", async () => {
		const h = discoveryHarness({ "a.md": "> [!a-b] x\n\n> [!note] y" });
		h.registry.add(definition({ id: "a b" }));
		assert.strictEqual(await h.discovery.runVaultScan(), 0);
	});

	it("survives an empty vault", async () => {
		const h = discoveryHarness();
		assert.strictEqual(await h.discovery.runVaultScan(), 0);
		await settle();
	});
});
