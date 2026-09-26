/**
 * tests/admonitionImport.test.ts — "what should happen to this callout?"
 *
 * The planner reads the registry and mutates nothing, which is what lets the
 * import modal show a report before anything changes. Two things about it are
 * easy to break and expensive when broken:
 *
 * - **Update and create are genuinely different plans, not one shape with
 *   optional halves.** An update must never rename a callout the file said
 *   nothing about, and must never repaint one whose admonition carried no
 *   colour; a create always has a colour, because a callout cannot be drawn
 *   without one and the planner supplies the default rather than upstream's
 *   random pick — which would give the same file two different looks on two
 *   imports.
 * - **Every reason to reject an entry comes before any mapping.** Converting a
 *   picture is the one step with a side effect the plan carries out of here, so
 *   an entry that is about to be skipped must not leave artwork behind in the
 *   user's own pictures. The ordering test at the bottom is the whole point of
 *   that rule.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { planAdmonitionImport } from "../src/utils/admonitionImport";
import type { AdmonitionRaw } from "../src/utils/admonitionFormat";
import { MAX_DISPLAY_NAME } from "../src/utils/importValidator";
import type { CalloutDefinition } from "../src/types";
import type { CalloutRegistry } from "../src/manager/CalloutRegistry";

/** Obsidian's Note blue — bland on purpose, and stable across two imports. */
const DEFAULT_IMPORT_COLOR = "#448aff";

function def(over: Partial<CalloutDefinition> = {}): CalloutDefinition {
	return {
		id: "existing",
		displayName: "Existing",
		icon: { type: "lucide", value: "star" },
		colorLight: "#112233",
		colorDark: "#112233",
		foldable: true,
		defaultFolded: false,
		builtIn: false,
		source: "user",
		...over,
	};
}

/** The two lookups the planner performs, and nothing else. */
function registry(opts: {
	byAttrId?: Record<string, CalloutDefinition>;
	byAlias?: Record<string, CalloutDefinition>;
} = {}): CalloutRegistry {
	return {
		findByAttrId: (id: string) => opts.byAttrId?.[id],
		findByAlias: (id: string) => opts.byAlias?.[id],
	} as unknown as CalloutRegistry;
}

const plan = (
	entries: AdmonitionRaw[],
	reg: CalloutRegistry = registry(),
): ReturnType<typeof planAdmonitionImport> =>
	planAdmonitionImport(entries, reg, []);

const keys = (issues: { messageKey: string }[]): string[] =>
	issues.map((i) => i.messageKey);

/** A name no library answers to, so the "no such icon" path is reachable. */
const NO_SUCH_ICON = "zzz-definitely-not-an-icon-name";

describe("planAdmonitionImport — nothing to plan", () => {
	it("reports an empty file as an error rather than an empty success", () => {
		const result = plan([]);
		return result.then((r) => {
			assert.deepStrictEqual(keys(r.issues), ["import.err.admNoEntries"]);
			assert.deepStrictEqual(r.toApply, []);
			assert.deepStrictEqual(r.newImages, []);
			assert.equal(r.issues[0]?.index, -1);
		});
	});
});

describe("planAdmonitionImport — creating a callout", () => {
	it("plans a create for a type the vault does not have", async () => {
		const r = await plan([{ type: "my-type", title: "My Type", color: "200, 50, 50" }]);
		assert.deepStrictEqual(r.toApply, [
			{
				action: "create",
				entry: {
					id: "my-type",
					displayName: "My Type",
					icon: undefined,
					color: "#c83232",
				},
			},
		]);
	});

	it("normalizes the id but titles from the RAW type", async () => {
		// So the generated name reads the same as what Obsidian itself would
		// show for the identical raw text.
		const r = await plan([{ type: "  My-Type  ", color: "#ff0000" }]);
		const item = r.toApply[0];
		assert.equal(item?.action, "create");
		assert.equal(item?.entry.id, "my-type");
		assert.equal(item?.entry.displayName, "My type");
	});

	it("falls back to Obsidian's own default title when none was given", async () => {
		const r = await plan([{ type: "multi-word-type", color: "#ff0000" }]);
		assert.equal(r.toApply[0]?.entry.displayName, "Multi word type");
	});

	it("supplies a stable default colour, and says it did", async () => {
		// Upstream picks a random colour here, which would give the same file
		// two different looks on two imports.
		const r = await plan([{ type: "colourless" }]);
		const item = r.toApply[0];
		assert.equal(item?.action, "create");
		assert.equal(item?.action === "create" ? item.entry.color : null, DEFAULT_IMPORT_COLOR);
		assert.deepStrictEqual(keys(r.issues), ["import.warn.admNoColor"]);
		assert.equal(r.issues[0]?.level, "warning");
	});

	it("treats an unparseable colour as no colour at all", async () => {
		const r = await plan([{ type: "x", color: "chartreuse" }]);
		const item = r.toApply[0];
		assert.equal(item?.action === "create" ? item.entry.color : null, DEFAULT_IMPORT_COLOR);
		assert.ok(keys(r.issues).includes("import.warn.admNoColor"));
	});

	it("reads every colour spelling parseCssColorToHex knows", async () => {
		const r = await plan([
			{ type: "a", color: "200, 50, 50" },
			{ type: "b", color: "rgb(255, 0, 0)" },
			{ type: "c", color: "#f00" },
		]);
		assert.deepStrictEqual(
			r.toApply.map((i) => (i.action === "create" ? i.entry.color : null)),
			["#c83232", "#ff0000", "#ff0000"],
		);
	});
});

describe("planAdmonitionImport — updating a callout the vault already has", () => {
	const reg = registry({ byAttrId: { existing: def({ id: "existing" }) } });

	it("plans an update, keyed by the definition's own id", async () => {
		const r = await plan([{ type: "existing", title: "Renamed", color: "#ff0000" }], reg);
		assert.deepStrictEqual(r.toApply, [
			{
				action: "update",
				existingId: "existing",
				entry: {
					id: "existing",
					displayName: "Renamed",
					icon: undefined,
					color: "#ff0000",
				},
			},
		]);
	});

	it("never renames a callout whose admonition carried no title", async () => {
		const r = await plan([{ type: "existing", color: "#ff0000" }], reg);
		assert.equal(r.toApply[0]?.entry.displayName, undefined);
	});

	it("never repaints a callout whose admonition carried no colour", async () => {
		// And no admNoColor warning either — there is nothing to warn about.
		const r = await plan([{ type: "existing" }], reg);
		assert.equal(r.toApply[0]?.entry.color, undefined);
		assert.deepStrictEqual(keys(r.issues), []);
	});

	it("matches through the attribute form, so dash and space are one callout", async () => {
		const spaced = registry({ byAttrId: { "my type": def({ id: "my type" }) } });
		const r = await plan([{ type: "my type" }], spaced);
		assert.equal(r.toApply[0]?.action, "update");
	});

	it("skips the alias-conflict check for a type that already exists", async () => {
		// The conflict only matters for a NEW id; an existing callout is being
		// updated, not competing for a name.
		const both = registry({
			byAttrId: { existing: def({ id: "existing" }) },
			byAlias: { existing: def({ id: "other" }) },
		});
		const r = await plan([{ type: "existing" }], both);
		assert.equal(r.toApply[0]?.action, "update");
		assert.deepStrictEqual(keys(r.issues), []);
	});
});

describe("planAdmonitionImport — entries that are refused", () => {
	it("refuses a blank type", async () => {
		const r = await plan([{ type: "" }, { type: "   " }]);
		assert.deepStrictEqual(keys(r.issues), [
			"import.err.admTypeMissing",
			"import.err.admTypeMissing",
		]);
		assert.deepStrictEqual(r.toApply, []);
		// Labelled by position, since there is no name to label it by.
		assert.equal(r.issues[0]?.entryLabel, "#1");
		assert.equal(r.issues[1]?.entryLabel, "#2");
	});

	it("refuses a piped type through the shared id rules", async () => {
		const r = await plan([{ type: "note|purple" }]);
		assert.deepStrictEqual(keys(r.issues), ["import.err.idMetadata"]);
		assert.deepStrictEqual(r.toApply, []);
	});

	it("refuses a type carrying a bracket or a tab", async () => {
		const r = await plan([{ type: "[note]" }, { type: "a\tb" }]);
		assert.deepStrictEqual(keys(r.issues), [
			"import.err.idBadChar",
			"import.err.idBadChar",
		]);
		assert.deepStrictEqual(r.toApply, []);
	});

	it("refuses the second of two entries that normalize to one id", async () => {
		const r = await plan([{ type: "My Type" }, { type: "my   type" }]);
		assert.equal(r.toApply.length, 1);
		const duplicate = r.issues.find(
			(i) => i.messageKey === "import.err.duplicateInFile",
		);
		assert.ok(duplicate, JSON.stringify(r.issues));
		// Points back at the entry it collided with, by 1-based position.
		assert.deepStrictEqual(duplicate.params, { value: "my type", first: 1 });
	});

	it("refuses a new type that collides with an existing callout's alias", async () => {
		const reg = registry({ byAlias: { taken: def({ id: "owner" }) } });
		const r = await plan([{ type: "taken" }], reg);
		assert.deepStrictEqual(keys(r.issues), ["import.err.cmIdConflict"]);
		assert.deepStrictEqual(r.issues[0]?.params, { value: "taken", other: "owner" });
		assert.deepStrictEqual(r.toApply, []);
	});

	it("keeps planning the rest of the file after a refusal", async () => {
		const r = await plan([{ type: "" }, { type: "good", color: "#ff0000" }]);
		assert.deepStrictEqual(
			r.toApply.map((i) => i.entry.id),
			["good"],
		);
	});

	it("labels and indexes every issue by the entry it came from", async () => {
		const r = await plan([{ type: "ok" }, { type: "note|purple" }]);
		const piped = r.issues.find((i) => i.messageKey === "import.err.idMetadata");
		assert.equal(piped?.index, 1);
		assert.equal(piped?.entryLabel, "note|purple");
	});
});

describe("planAdmonitionImport — titles", () => {
	it("trims a title", async () => {
		const r = await plan([{ type: "x", title: "  Spaced  ", color: "#ff0000" }]);
		assert.equal(r.toApply[0]?.entry.displayName, "Spaced");
	});

	it("ignores a blank or non-string title", async () => {
		const r = await plan([
			{ type: "a", color: "#ff0000", title: "   " },
			{ type: "b", color: "#ff0000", title: 42 },
		]);
		// Both fall back to the derived default rather than carrying junk.
		assert.deepStrictEqual(
			r.toApply.map((i) => i.entry.displayName),
			["A", "B"],
		);
	});

	it("TRUNCATES a title over the limit instead of rejecting the entry", async () => {
		// Deliberately unlike the JSON importer, which errors: that file is our
		// own format, this one is another plugin's and the entry is still worth
		// having.
		const long = "n".repeat(MAX_DISPLAY_NAME + 20);
		const r = await plan([{ type: "x", title: long, color: "#ff0000" }]);
		assert.equal(r.toApply.length, 1);
		assert.equal(r.toApply[0]?.entry.displayName?.length, MAX_DISPLAY_NAME);
		const issue = r.issues.find(
			(i) => i.messageKey === "import.warn.admTitleTruncated",
		);
		assert.ok(issue, JSON.stringify(r.issues));
		assert.equal(issue.level, "warning");
		assert.deepStrictEqual(issue.params, {
			length: MAX_DISPLAY_NAME + 20,
			max: MAX_DISPLAY_NAME,
		});
	});

	it("keeps a title of exactly the limit, with no warning", async () => {
		const r = await plan([
			{ type: "x", title: "n".repeat(MAX_DISPLAY_NAME), color: "#ff0000" },
		]);
		assert.equal(r.toApply[0]?.entry.displayName?.length, MAX_DISPLAY_NAME);
		assert.deepStrictEqual(keys(r.issues), []);
	});

	it("does not leave a trailing space behind after truncating", async () => {
		const title = `${"n".repeat(MAX_DISPLAY_NAME - 1)} tail`;
		const r = await plan([{ type: "x", title, color: "#ff0000" }]);
		assert.ok(!r.toApply[0]?.entry.displayName?.endsWith(" "));
	});
});

describe("planAdmonitionImport — icons", () => {
	it("preserves Admonition's two legacy RPG drawings with or without a named pack", async () => {
		for (const type of ["rpg", undefined]) {
			const result = await plan([
				{ type: "mountain", icon: { type, name: "montains" }, color: "1,2,3" },
				{ type: "dice", icon: { type, name: "perspective-dice-six-two" }, color: "1,2,3" },
			]);
			assert.deepStrictEqual(result.toApply.map((item) => item.entry.icon), [
				{ type: "rpg-awesome", value: "mountains" },
				{ type: "rpg-awesome", value: "perspective-dice-two" },
			]);
			assert.deepStrictEqual(result.issues, []);
		}
	});

	it("never persists inherited lookup members supplied as JSON pack names", async () => {
		for (const type of ["__proto__", "constructor", "toString", "valueOf", "hasOwnProperty"]) {
			const payload = JSON.parse(JSON.stringify([{ type: "safe-callout", icon: { type, name: "star" } }])) as AdmonitionRaw[];
			const result = await plan(payload);
			assert.equal(result.toApply.length, 1, type);
			assert.deepStrictEqual(result.toApply[0]?.entry.icon, { type: "fa-solid", value: "star" }, type);
			assert.deepStrictEqual(JSON.parse(JSON.stringify(result.toApply[0]?.entry.icon)), { type: "fa-solid", value: "star" });
		}
	});

	it("resolves a named icon into one of ours", async () => {
		const r = await plan([
			{ type: "x", color: "#ff0000", icon: { type: "rpg", name: "acid" } },
		]);
		assert.deepStrictEqual(r.toApply[0]?.entry.icon, {
			type: "rpg-awesome",
			value: "acid",
		});
		assert.deepStrictEqual(keys(r.issues), []);
	});

	it("plans no icon at all when the file named none", async () => {
		const r = await plan([{ type: "x", color: "#ff0000" }]);
		assert.equal(r.toApply[0]?.entry.icon, undefined);
		assert.deepStrictEqual(keys(r.issues), []);
	});

	it("warns, but still creates, when no library has that name", async () => {
		const r = await plan([
			{ type: "x", color: "#ff0000", icon: { type: "rpg", name: NO_SUCH_ICON } },
		]);
		assert.equal(r.toApply.length, 1);
		assert.equal(r.toApply[0]?.entry.icon, undefined);
		const issue = r.issues.find(
			(i) => i.messageKey === "import.warn.admIconUnknown",
		);
		assert.ok(issue, JSON.stringify(r.issues));
		assert.deepStrictEqual(issue.params, { value: NO_SUCH_ICON, id: "x" });
	});

	it("says something different when the callout already exists", async () => {
		// The outcomes really do differ: an existing callout keeps the icon it
		// has, a new one has nothing to keep.
		const reg = registry({ byAttrId: { existing: def({ id: "existing" }) } });
		const r = await plan(
			[{ type: "existing", icon: { type: "rpg", name: NO_SUCH_ICON } }],
			reg,
		);
		const issue = r.issues.find(
			(i) => i.messageKey === "import.warn.admIconUnknownExisting",
		);
		assert.ok(issue, JSON.stringify(r.issues));
		assert.deepStrictEqual(issue.params, { value: NO_SUCH_ICON, id: "existing" });
	});

	it("warns when a picture cannot be decoded, and adds no artwork", async () => {
		const r = await plan([
			{ type: "x", color: "#ff0000", icon: { type: "image", name: "not-a-data-uri" } },
		]);
		assert.equal(r.toApply.length, 1);
		assert.equal(r.toApply[0]?.entry.icon, undefined);
		assert.deepStrictEqual(r.newImages, []);
		assert.deepStrictEqual(keys(r.issues), ["import.warn.admImageSkipped"]);
	});
});

describe("planAdmonitionImport — iconWithCss", () => {
	it("warns, because the whole appearance lives in a snippet that is not coming", async () => {
		const r = await plan([{ type: "x", color: "#ff0000", iconWithCss: true }]);
		assert.deepStrictEqual(keys(r.issues), ["import.warn.admIconWithCss"]);
		assert.equal(r.toApply.length, 1);
	});

	it("stays silent for any other value", async () => {
		const r = await plan([
			{ type: "a", color: "#ff0000", iconWithCss: false },
			{ type: "b", color: "#ff0000", iconWithCss: "true" },
			{ type: "c", color: "#ff0000" },
		]);
		assert.deepStrictEqual(keys(r.issues), []);
	});
});

describe("planAdmonitionImport — unsupported behavior", () => {
	it("reports enabled behavior that the imported callout cannot reproduce", async () => {
		const result = await plan([{
			type: "x", color: "1,2,3", command: true, copy: true, noTitle: true, injectColor: false,
		}]);
		assert.equal(result.toApply.length, 1);
		assert.deepStrictEqual(result.issues, [{
			index: 0, entryLabel: "x", level: "warning",
			messageKey: "import.warn.admUnsupportedOptions",
			params: { fields: "command, copy, noTitle, injectColor" },
		}]);
	});

	it("does not warn for missing, disabled, or nonboolean behavior flags", async () => {
		for (const value of [undefined, false, "true", 1, {}]) {
			const result = await plan([{
				type: "x", color: "1,2,3", command: value, copy: value, noTitle: value, injectColor: true,
			}]);
			assert.deepStrictEqual(result.issues, []);
		}
	});
});

describe("planAdmonitionImport — bounded strings", () => {
	it("bounds oversized id labels and rejects the entry before icon conversion", async () => {
		const result = await plan([{
			type: "x".repeat(100_000), icon: { type: "image", name: "data:image/png;base64,AAAA" },
		}]);
		assert.deepStrictEqual(result.toApply, []);
		assert.deepStrictEqual(result.newImages, []);
		assert.equal(result.issues[0]?.entryLabel.length, 200);
		assert.equal(result.issues[0]?.params?.length, 100_000);
		assert.equal(String(result.issues[0]?.params?.value).length, 200);
	});

	it("rejects oversized color input before parsing and bounds icon warning text", async () => {
		const result = await plan([{
			type: "x", color: `rgb(1,2,3${" ".repeat(100_000)})`,
			icon: { type: "fas", name: "x".repeat(100_000) },
		}]);
		assert.equal(result.toApply[0]?.entry.color, DEFAULT_IMPORT_COLOR);
		assert.equal(result.toApply[0]?.entry.icon, undefined);
		const warning = result.issues.find((issue) => issue.messageKey === "import.warn.admIconUnknown");
		assert.equal(String(warning?.params?.value).length, 200);
	});
});

describe("planAdmonitionImport — a refused entry leaves nothing behind", () => {
	it("does not decode a picture for an entry it is about to skip", async () => {
		// The ordering rule spelled out in the source: converting a picture is
		// the one step with a side effect the plan carries out of here. If the
		// conflict check ever moved below the icon mapping, this would report
		// admImageFailed instead of the conflict — and, with a decodable URI,
		// would leave artwork in the user's own pictures for a callout that was
		// never created.
		const reg = registry({ byAlias: { taken: def({ id: "owner" }) } });
		const r = await plan(
			[{ type: "taken", icon: { type: "image", name: "not-a-data-uri" } }],
			reg,
		);
		assert.deepStrictEqual(keys(r.issues), ["import.err.cmIdConflict"]);
		assert.deepStrictEqual(r.newImages, []);
		assert.deepStrictEqual(r.toApply, []);
	});

	it("does not decode a picture for a duplicate id either", async () => {
		const r = await plan([
			{ type: "dup", color: "#ff0000" },
			{ type: "dup", icon: { type: "image", name: "not-a-data-uri" } },
		]);
		assert.deepStrictEqual(r.newImages, []);
		assert.ok(!keys(r.issues).includes("import.warn.admImageSkipped"));
	});
});

describe("planAdmonitionImport — the plan as a whole", () => {
	it("mutates neither the registry nor the entries it was given", async () => {
		const entries: AdmonitionRaw[] = [
			{ type: "x", title: "X", color: "#ff0000", icon: "star" },
		];
		const snapshot = JSON.parse(JSON.stringify(entries)) as unknown;
		await plan(entries);
		assert.deepStrictEqual(JSON.parse(JSON.stringify(entries)), snapshot);
	});

	it("keeps the file's order", async () => {
		const r = await plan([
			{ type: "c", color: "#ff0000" },
			{ type: "a", color: "#ff0000" },
			{ type: "b", color: "#ff0000" },
		]);
		assert.deepStrictEqual(
			r.toApply.map((i) => i.entry.id),
			["c", "a", "b"],
		);
	});

	it("plans creates and updates side by side in one pass", async () => {
		const reg = registry({ byAttrId: { existing: def({ id: "existing" }) } });
		const r = await plan(
			[{ type: "existing" }, { type: "brand-new", color: "#ff0000" }],
			reg,
		);
		assert.deepStrictEqual(
			r.toApply.map((i) => i.action),
			["update", "create"],
		);
	});
});
