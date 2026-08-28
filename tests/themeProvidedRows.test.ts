/**
 * tests/themeProvidedRows.test.ts — the callout types a theme invents.
 *
 * Two things are being pinned, and they fail in opposite directions.
 *
 * **Detection has to be narrow.** The scanner enumerates only the operators
 * that name one callout, so a theme writing `[data-callout*="column"]` must not
 * put a callout called *column* in the user's list. Over-detection is the
 * dangerous direction here: an invented row is one the user has to look at
 * forever, in a section that claims their theme provides it.
 *
 * **The sweep has to be safe.** It runs on every theme change, so a bug in it
 * deletes user data on an action nobody thinks of as destructive. Hence the
 * three properties below: it never touches a row it did not mint, it re-homes
 * rather than deletes a row the user adopted, and running it twice writes
 * nothing at all — which is also what keeps the `css-change` → inject →
 * `css-change` chain from cycling.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { DEFAULT_SETTINGS } from "../src/constants";
import { ThemeCalloutStore } from "../src/manager/theme/ThemeCalloutStore";
import { syncThemeProvidedRows as sweepRows } from "../src/manager/theme/themeProvidedRows";
import {
	isThemeStyled,
	partitionByStyleOwner,
	type StyleOwnerFacts,
} from "../src/settings/sections/rowOwnership";
import type { CalloutDefinition } from "../src/types";
import { obsidianCalloutAttrId } from "../src/utils/calloutId";

/** An `App` whose `customCss` reports one theme with the given stylesheet. */
function appWithTheme(css: string, name = "Nord"): App {
	return {
		customCss: {
			theme: name,
			themes: { [name]: { version: "1.0.0" } },
			styleEl: { textContent: css },
			snippets: [],
			enabledSnippets: new Set<string>(),
			extraStyleEls: [],
		},
	} as unknown as App;
}

function def(over: Partial<CalloutDefinition> = {}): CalloutDefinition {
	return {
		id: "x",
		displayName: "X",
		icon: { type: "lucide", value: "star" },
		colorLight: "#336699",
		colorDark: "#88bbee",
		foldable: true,
		defaultFolded: false,
		builtIn: false,
		source: "user",
		...over,
	};
}

function vault(): CalloutRegistry {
	const registry = new CalloutRegistry();
	registry.load(null);
	return registry;
}

/**
 * The retirement list the sweep writes to.
 *
 * It lives in `DeviceLocalStore` rather than in settings — which theme is
 * active is a property of a machine, not of a vault, so two devices on
 * different themes used to rewrite the same array in the same synced file.
 * A test that cares about retirements passes one of these across both sweeps;
 * every other test gets a scratch one it never looks at.
 */
const retirements = (): { retiredThemeIds: string[] } => ({
	retiredThemeIds: [],
});

const sweep = (
	registry: CalloutRegistry,
	store: ThemeCalloutStore,
	holder = retirements(),
): number => sweepRows(registry, store, holder);

const ids = (defs: CalloutDefinition[]): string[] =>
	defs.map((d) => d.id).sort();

describe("themeDefinedIds — what counts as a callout the theme adds", () => {
	it("names an id the theme matches exactly", () => {
		const store = new ThemeCalloutStore(
			appWithTheme('.callout[data-callout="definition"] { color: red; }'),
		);
		assert.deepStrictEqual([...store.themeDefinedIds()], ["definition"]);
	});

	it("invents nothing from a pattern match", () => {
		// `*=` says "everything containing this". Turning that into a callout
		// type would put an id in the user's list that neither their vault nor
		// their theme ever declared.
		const store = new ThemeCalloutStore(
			appWithTheme('.callout[data-callout*="column"] { color: red; }'),
		);
		assert.deepStrictEqual([...store.themeDefinedIds()], []);
	});

	it("ignores the user's own snippets", () => {
		// The section is called "Callouts from your theme" and has to mean it —
		// a snippet the user wrote is their own work, and belongs in their list.
		const app = appWithTheme('.callout[data-callout="fromtheme"] {}');
		const css = (app as unknown as { customCss: Record<string, unknown> })
			.customCss;
		css.snippets = ["mine"];
		css.enabledSnippets = new Set(["mine"]);
		css.extraStyleEls = [
			{ textContent: '.callout[data-callout="fromsnippet"] {}' },
		];
		const store = new ThemeCalloutStore(app);
		assert.deepStrictEqual([...store.themeDefinedIds()], ["fromtheme"]);
	});

	it("counts snippets for the weight it has to clear, though", () => {
		// Studio mode has to outrank whatever is actually on the page, whoever
		// wrote it — a different question from whose callout type it is.
		const app = appWithTheme(".callout[data-callout='a'] { color: red; }");
		const css = (app as unknown as { customCss: Record<string, unknown> })
			.customCss;
		css.snippets = ["mine"];
		css.enabledSnippets = new Set(["mine"]);
		css.extraStyleEls = [
			{
				textContent:
					".a.b.c.d.e.f.callout[data-callout='a'] { color: blue !important; }",
			},
		];
		// Six classes plus `.callout` plus the attribute selector.
		assert.strictEqual(new ThemeCalloutStore(app).maxImportantClasses(), 8);
	});

	it("counts only rules that carry !important", () => {
		// An ordinary theme rule loses to importance at any specificity, so
		// climbing over it would lengthen every selector in the sheet to win a
		// contest already won.
		const store = new ThemeCalloutStore(
			appWithTheme(
				".a.b.c.d.callout[data-callout='a'] { color: red; }" +
					".callout[data-callout='b'] { color: blue !important; }",
			),
		);
		assert.strictEqual(store.maxImportantClasses(), 2);
	});
});

describe("syncThemeProvidedRows — minting", () => {
	it("gives every theme-declared id a row of its own", () => {
		const registry = vault();
		const store = new ThemeCalloutStore(
			appWithTheme(
				'.callout[data-callout="definition"] {}' +
					'.callout[data-callout="proof"] {}',
			),
		);

		assert.strictEqual(sweep(registry, store), 2);
		assert.deepStrictEqual(ids(registry.getThemeProvided()), [
			"definition",
			"proof",
		]);
	});

	it("leaves the row to the theme, emitting nothing for it", () => {
		const registry = vault();
		const store = new ThemeCalloutStore(
			appWithTheme('.callout[data-callout="definition"] {}'),
		);
		sweep(registry, store);

		const row = registry.get("definition");
		assert.ok(row);
		assert.strictEqual(registry.standsDown(row), true);
		// No explicit field at all: ownership is derived from the theme, so
		// switching theme gives the callout back with nothing to unwrite.
		assert.strictEqual(row.externalStyle, undefined);
	});

	it("skips a built-in the theme merely repaints", () => {
		// Repainting `[!note]` is not adding a callout type, and a section
		// listing all thirteen would say nothing about this theme.
		const registry = vault();
		const store = new ThemeCalloutStore(
			appWithTheme('.callout[data-callout="note"] { color: red; }'),
		);

		assert.strictEqual(sweep(registry, store), 0);
		assert.deepStrictEqual(registry.getThemeProvided(), []);
	});

	it("never touches a row the user already owns", () => {
		// The settings tab still groups it under the theme — grouping asks
		// `themeDefinedIds`, not `source` — but the row stays the user's.
		const registry = vault();
		registry.add(def({ id: "proof", displayName: "My Proof" }));
		const store = new ThemeCalloutStore(
			appWithTheme('.callout[data-callout="proof"] {}'),
		);

		assert.strictEqual(sweep(registry, store), 0);
		const row = registry.get("proof");
		assert.strictEqual(row?.source, "user");
		assert.strictEqual(row.displayName, "My Proof");
		assert.deepStrictEqual(ids(registry.getUserDefined()), ["proof"]);
		assert.deepStrictEqual(registry.getThemeProvided(), []);
	});

	it("never collides with an alias somebody else claims", () => {
		const registry = vault();
		registry.add(def({ id: "mine", aliases: ["proof"] }));
		const store = new ThemeCalloutStore(
			appWithTheme('.callout[data-callout="proof"] {}'),
		);

		assert.strictEqual(sweep(registry, store), 0);
	});

	it("writes nothing at all on a second identical run", () => {
		// The property the css-change chain's termination rests on.
		const registry = vault();
		const store = new ThemeCalloutStore(
			appWithTheme('.callout[data-callout="definition"] {}'),
		);
		sweep(registry, store);

		let events = 0;
		registry.onChange(() => events++);
		assert.strictEqual(sweep(registry, store), 0);
		assert.strictEqual(events, 0, "an idempotent sweep must fire no event");
	});
});

describe("syncThemeProvidedRows — when the theme changes", () => {
	it("retires a row nobody adopted", () => {
		const registry = vault();
		sweep(
			registry,
			new ThemeCalloutStore(appWithTheme('.callout[data-callout="gone"] {}')),
		);
		assert.strictEqual(registry.getThemeProvided().length, 1);

		sweep(
			registry,
			new ThemeCalloutStore(appWithTheme("", "Other")),
		);
		assert.strictEqual(registry.get("gone"), undefined);
	});

	it("re-homes a row the user adopted instead of deleting it", () => {
		// Switching theme must never cost the user work. The row keeps its id,
		// its colours and everything else — it simply becomes theirs.
		const registry = vault();
		sweep(
			registry,
			new ThemeCalloutStore(appWithTheme('.callout[data-callout="kept"] {}')),
		);
		registry.update("kept", { customized: true, colorLight: "#ff0000" });

		sweep(
			registry,
			new ThemeCalloutStore(appWithTheme("", "Other")),
		);

		const row = registry.get("kept");
		assert.ok(row, "an adopted row survives a theme switch");
		assert.strictEqual(row.source, "user");
		assert.strictEqual(row.colorLight, "#ff0000");
		assert.deepStrictEqual(ids(registry.getUserDefined()), ["kept"]);
	});

	it("hands a re-homed row to Callout Studio, since the theme is gone", () => {
		// `defaultStyleMode` answers "theme" only for `source: "theme"`. Once
		// the row is the user's there is nothing left to defer to, so the
		// colours they adopted actually render.
		const registry = vault();
		sweep(
			registry,
			new ThemeCalloutStore(appWithTheme('.callout[data-callout="kept"] {}')),
		);
		registry.update("kept", { customized: true });
		sweep(
			registry,
			new ThemeCalloutStore(appWithTheme("", "Other")),
		);

		assert.strictEqual(registry.standsDown(registry.get("kept")!), false);
	});

	it("is never written to data.json", () => {
		// The overlay is the whole lifecycle model: a theme row is re-derived
		// from the active theme on every launch, so persisting one would let it
		// outlive the theme that justified it. Nothing has to delete it later
		// because nothing wrote it down.
		const registry = vault();
		sweep(
			registry,
			new ThemeCalloutStore(
				appWithTheme('.callout[data-callout="definition"] {}'),
			),
		);
		assert.ok(registry.get("definition"), "minted in memory");
		assert.deepStrictEqual(
			(registry.toSaveData().callouts ?? []).map((d) => d.id),
			[],
		);
	});

	it("does not write a measured colour or icon down either", () => {
		// The probe now reads more of the rendered callout than it used to, and
		// every extra signal it learns is another thing that must not reach
		// `data.json`. It cannot: an appearance is published to `ThemeFacts`,
		// which is keyed by attribute id and holds no `CalloutDefinition` — so
		// the row the theme invented is still absent from the save, and the
		// built-in the theme borrowed is still exactly as it shipped.
		const registry = vault();
		sweep(
			registry,
			new ThemeCalloutStore(
				appWithTheme(
					'.callout[data-callout="definition"] {} .callout[data-callout="note"] {}',
				),
			),
		);
		const measured = {
			accent: "rgb(224, 108, 117)",
			background: "rgba(224, 108, 117, 0.1)",
			icon: { kind: "mask", image: "url(theme-stencil)" },
		} as const;
		registry.setThemeAppearances(
			new Map([
				["definition", measured],
				["note", measured],
			]),
		);
		// It really is in effect on both rows — otherwise this proves nothing.
		assert.strictEqual(
			registry.themeAppearanceOf(registry.get("definition")!).accent,
			"rgb(224, 108, 117)",
		);
		assert.strictEqual(
			registry.themeAppearanceOf(registry.get("note")!).icon.kind,
			"mask",
		);

		assert.deepStrictEqual(
			(registry.toSaveData().callouts ?? []).map((d) => d.id),
			[],
			"neither the invented row nor the borrowed built-in is persisted",
		);
		assert.strictEqual(registry.isBuiltInModified("note"), false);
		// And the stored artwork is untouched, so the row's own design comes
		// straight back the moment the theme stops claiming it.
		assert.strictEqual(registry.get("note")?.icon.type, "lucide");
	});

	it("is re-minted by the next launch's sweep, exactly once", () => {
		const registry = vault();
		const store = new ThemeCalloutStore(
			appWithTheme('.callout[data-callout="definition"] {}'),
		);
		sweep(registry, store);

		const reloaded = new CalloutRegistry();
		reloaded.load(registry.toSaveData());
		assert.strictEqual(reloaded.get("definition"), undefined);
		// Not yet owned either: `load()` cannot see a theme, and the empty set
		// is the fail-safe. The sweep is what publishes ownership.
		assert.strictEqual(reloaded.themeOwns(def({ id: "definition" })), false);

		sweep(reloaded, store);
		assert.strictEqual(reloaded.get("definition")?.source, "theme");
		assert.strictEqual(reloaded.standsDown(reloaded.get("definition")!), true);
		assert.strictEqual(
			reloaded.getAll().filter((d) => d.id === "definition").length,
			1,
		);
	});

	it("keeps a pre-existing callout intact, field for field", () => {
		// The other half of the lifecycle, and the one that must lose nothing.
		// A callout that existed before the theme claimed the id is not the
		// sweep's to touch: it is only *owned* for a while.
		const registry = vault();
		registry.add(
			def({
				id: "mine",
				displayName: "Mine",
				colorLight: "#ff0000",
				colorDark: "#00ff00",
				aliases: ["m"],
				customized: true,
			}),
		);
		const before = structuredClone(registry.get("mine"));

		const claimed = new ThemeCalloutStore(
			appWithTheme('.callout[data-callout="mine"] {}'),
		);
		sweep(registry, claimed);
		assert.strictEqual(registry.themeOwns(registry.get("mine")!), true);
		assert.deepStrictEqual(registry.get("mine"), before, "untouched while owned");

		sweep(
			registry,
			new ThemeCalloutStore(appWithTheme("", "Other")),
		);
		assert.deepStrictEqual(registry.get("mine"), before, "and after");
		assert.strictEqual(registry.themeOwns(registry.get("mine")!), false);
		assert.deepStrictEqual(ids(registry.getUserDefined()), ["mine"]);
	});

	it("records a theme-only id it retired, so discovery leaves it alone", () => {
		const registry = vault();
		const retired = retirements();
		sweep(
			registry,
			new ThemeCalloutStore(appWithTheme('.callout[data-callout="recite"] {}')),
			retired,
		);
		sweep(
			registry,
			new ThemeCalloutStore(appWithTheme("", "Other")),
			retired,
		);
		assert.deepStrictEqual(retired.retiredThemeIds, ["recite"]);
	});

	it("records nothing for a pre-existing callout it merely let go of", () => {
		// Its row is still there, so there is nothing for discovery to re-create
		// and nothing to hold back.
		const registry = vault();
		const retired = retirements();
		registry.add(def({ id: "mine" }));
		sweep(
			registry,
			new ThemeCalloutStore(appWithTheme('.callout[data-callout="mine"] {}')),
			retired,
		);
		sweep(
			registry,
			new ThemeCalloutStore(appWithTheme("", "Other")),
			retired,
		);
		assert.deepStrictEqual(retired.retiredThemeIds, []);
	});

	it("forgets a retired id the moment anything claims it again", () => {
		const registry = vault();
		const retired = retirements();
		sweep(
			registry,
			new ThemeCalloutStore(appWithTheme('.callout[data-callout="recite"] {}')),
			retired,
		);
		sweep(
			registry,
			new ThemeCalloutStore(appWithTheme("", "Other")),
			retired,
		);
		// A later theme brings it back.
		sweep(
			registry,
			new ThemeCalloutStore(
				appWithTheme('.callout[data-callout="recite"] {}', "Third"),
			),
			retired,
		);
		assert.deepStrictEqual(retired.retiredThemeIds, []);
	});

	it("re-homes a `theme` row that predates the two-mode model", () => {
		// Before that release `source: "theme"` was inert and only ever arrived
		// from a long-removed registration API. Such a row's provenance is
		// genuinely ambiguous — it may be a callout the user made — so it is
		// preserved rather than dropped with the sweep's own leftovers.
		const legacy = new CalloutRegistry();
		legacy.load({ callouts: [def({ id: "imported", source: "theme" })] });
		assert.strictEqual(legacy.get("imported")?.source, "user");
	});

	it("switches straight from one theme to another", () => {
		// Three outcomes in one sweep, and the shared id is the one that has to
		// be a non-event: it is in neither the stale list nor the fresh one, so
		// nothing deletes and re-mints it and ownership never lapses.
		const registry = vault();
		const retired = retirements();
		sweep(
			registry,
			new ThemeCalloutStore(
				appWithTheme(
					'.callout[data-callout="recite"] {}' +
						'.callout[data-callout="shared"] {}',
					"ITS",
				),
			),
			retired,
		);
		const sharedBefore = registry.get("shared");
		assert.deepStrictEqual(ids(registry.getThemeProvided()), [
			"recite",
			"shared",
		]);

		sweep(
			registry,
			new ThemeCalloutStore(
				appWithTheme(
					'.callout[data-callout="shared"] {}' +
						'.callout[data-callout="aside"] {}',
					"AnuPpuccin",
				),
			),
			retired,
		);

		assert.strictEqual(registry.get("recite"), undefined, "only A's is gone");
		assert.ok(registry.get("aside"), "only B's has arrived");
		assert.strictEqual(
			registry.get("shared"),
			sharedBefore,
			"the shared row is the same object — never deleted and re-minted",
		);
		assert.strictEqual(registry.themeOwns(registry.get("shared")!), true);
		assert.deepStrictEqual(retired.retiredThemeIds, ["recite"]);
	});

	it("drops a `theme` row this build's own sweep left behind", () => {
		// Version 4 or later means it can only have come from the sweep, which
		// no longer writes one. Dropping is safe *because* it is re-minted a
		// moment later if the theme still declares the id.
		const stale = new CalloutRegistry();
		stale.load({
			version: 4,
			settings: { ...DEFAULT_SETTINGS },
			callouts: [def({ id: "recite", source: "theme" })],
		});
		assert.strictEqual(stale.get("recite"), undefined);
	});

	it("keeps a customized one rather than dropping it", () => {
		// Nothing can reach this state any more, which is exactly why the branch
		// stays: being wrong by preserving a row beats being wrong by deleting
		// a user's work.
		const kept = new CalloutRegistry();
		kept.load({
			version: 4,
			settings: { ...DEFAULT_SETTINGS },
			callouts: [def({ id: "recite", source: "theme", customized: true })],
		});
		assert.strictEqual(kept.get("recite")?.source, "user");
	});
});

describe("partitionByStyleOwner — which group a row belongs in", () => {
	/**
	 * The grouping rule is one clause now, and that is the whole point of this
	 * round: rows used to carry a `Theme` / `Studio` pill because the group was
	 * about *origin* while the pill was about *who paints it*. The group is who
	 * paints it, and who paints it is a fact about the active theme rather than
	 * a setting — so there is nothing left to label, and these assertions are
	 * the only thing standing between the user and a list that silently says
	 * the wrong thing.
	 */
	const facts = (owned: string[] = ["definition", "proof"]): StyleOwnerFacts => {
		const set = new Set(owned);
		return {
			themeOwns: (d) =>
				[d.id, ...(d.aliases ?? [])].some((form) =>
					set.has(obsidianCalloutAttrId(form)),
				),
		};
	};

	it("puts a callout the theme names in the theme's group", () => {
		const { fromTheme, own } = partitionByStyleOwner(facts(), [
			def({ id: "definition", source: "theme" }),
			def({ id: "mine" }),
		]);
		assert.deepStrictEqual(ids(fromTheme), ["definition"]);
		assert.deepStrictEqual(ids(own), ["mine"]);
	});

	it("moves a user-created row whose id the theme also supplies", () => {
		// The upgrade case the user asked about by name: they created `proof`
		// in an older version, and their theme really does declare it. It
		// belongs under the theme's heading — exactly once, and still theirs.
		// `source` never changes, so it keeps its place in exports, the reset
		// sweep and the public API. No stored migration.
		const mine = def({
			id: "proof",
			displayName: "My Proof",
			customized: true,
		});
		const { fromTheme, own } = partitionByStyleOwner(facts(), [mine]);
		assert.deepStrictEqual(ids(fromTheme), ["proof"]);
		assert.deepStrictEqual(own, []);
		assert.strictEqual(fromTheme[0], mine, "the very same row, not a copy");
		assert.strictEqual(fromTheme[0]?.source, "user");
		assert.strictEqual(fromTheme[0]?.displayName, "My Proof");
	});

	it("leaves a callout the theme does not name with the user, even in their own CSS", () => {
		// `rec_k` in the user's own words: they pointed it at a CSS snippet of
		// their own, and the theme has never heard of it. Filing it under the
		// theme would name the wrong owner — the *External CSS* label is what
		// says this instead.
		const { fromTheme, own } = partitionByStyleOwner(facts(), [
			def({ id: "rec_k", externalStyle: true }),
		]);
		assert.deepStrictEqual(fromTheme, []);
		assert.deepStrictEqual(ids(own), ["rec_k"]);
	});

	it("moves a built-in the theme restyles out of Built-in callouts", () => {
		// 27 of the 257 installed themes name every built-in id, which empties
		// the section entirely — the accepted consequence of the absolute rule.
		const rows = [
			def({ id: "note", builtIn: true, source: "builtin" }),
			def({ id: "tip", builtIn: true, source: "builtin" }),
		];
		const { fromTheme, builtIn } = partitionByStyleOwner(
			facts(["note", "tip"]),
			rows,
		);
		assert.deepStrictEqual(ids(fromTheme), ["note", "tip"]);
		assert.deepStrictEqual(builtIn, []);
	});

	it("keeps built-ins put when the theme names none of them", () => {
		// 135 of the 257 themes have no callout CSS at all, and another 55
		// style `.callout` generically without naming an id. In all 190 the
		// built-ins stay Callout Studio's, which is what stops this model
		// making the plugin inert on most of the corpus.
		const rows = [
			def({ id: "note", builtIn: true, source: "builtin" }),
			def({ id: "tip", builtIn: true, source: "builtin" }),
		];
		const { fromTheme, builtIn } = partitionByStyleOwner(facts([]), rows);
		assert.deepStrictEqual(fromTheme, []);
		assert.deepStrictEqual(ids(builtIn), ["note", "tip"]);
	});

	it("gives a built-in back when the theme stops naming it", () => {
		const row = def({ id: "note", builtIn: true, source: "builtin" });
		assert.deepStrictEqual(
			ids(partitionByStyleOwner(facts(["note"]), [row]).fromTheme),
			["note"],
		);
		assert.deepStrictEqual(
			ids(partitionByStyleOwner(facts([]), [row]).builtIn),
			["note"],
		);
	});

	it("puts every row in exactly one group", () => {
		const rows = [
			def({ id: "definition", source: "theme" }),
			def({ id: "proof" }),
			def({ id: "mine" }),
			def({ id: "note", builtIn: true, source: "builtin" }),
			def({ id: "tip", builtIn: true, source: "builtin", externalStyle: true }),
		];
		const { fromTheme, own, builtIn } = partitionByStyleOwner(facts(), rows);
		const seen = [...ids(fromTheme), ...ids(own), ...ids(builtIn)].sort();
		assert.deepStrictEqual(seen, [
			"definition",
			"mine",
			"note",
			"proof",
			"tip",
		]);
		assert.strictEqual(new Set(seen).size, rows.length);
	});

	it("matches on the attribute form Obsidian writes, not the raw id", () => {
		// A theme writes `[data-callout="two-words"]`; the registry stores the
		// space-preserving spelling. Comparing them raw would miss every
		// multi-word callout a theme adds.
		assert.strictEqual(
			isThemeStyled(facts(["two-words"]), def({ id: "two words" })),
			true,
		);
	});
});
