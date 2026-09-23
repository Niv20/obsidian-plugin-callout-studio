/** Read-only aggregate counts remain shared by sidebar metrics and usage surfaces. */
import assert from "node:assert";
import { after, before, describe, it } from "node:test";
import { scanVaultCalloutStatistics } from "../src/utils/vaultCalloutStats";
import type { VaultCalloutStatistics } from "../src/utils/vaultCalloutStats";
import type { App } from "obsidian";

// Async index scheduling needs real timers even when no browser DOM is installed.
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
before(() => { Object.defineProperty(globalThis, "window", { configurable: true, value: globalThis }); });
after(() => {
	if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
	else Reflect.deleteProperty(globalThis, "window");
});

/** The slice of `App` the report touches: list the files, read one. */
function fakeApp(files: Record<string, string>): App {
	const store = new Map(Object.entries(files));
	const handles = Array.from(store.keys()).map((path) => ({ path }));
	return {
		vault: {
			getMarkdownFiles: () => handles,
			cachedRead: (file: { path: string }) =>
				Promise.resolve(store.get(file.path) ?? ""),
		},
	} as unknown as App;
}

const scan = (files: Record<string, string>): Promise<VaultCalloutStatistics> =>
	scanVaultCalloutStatistics(fakeApp(files));

/** The entry for one id, or a failure naming what the report did find. */
function typeOf(
	stats: VaultCalloutStatistics,
	id: string,
): VaultCalloutStatistics["types"][number] {
	const entry = stats.types.find((t) => t.id === id);
	assert.ok(
		entry,
		`no entry for "${id}" — found ${stats.types.map((t) => t.id).join(", ")}`,
	);
	return entry;
}

describe("scanVaultCalloutStatistics — per-role counts", () => {
	it("attributes each role to the token that carries it", async () => {
		const stats = await scan({
			"a.md": [
				"> [!note] A block",
				"> body",
				"",
				"### [!note] A heading",
				"",
				"Prose with a [!note] pill in it.",
			].join("\n"),
		});

		assert.deepStrictEqual(typeOf(stats, "note").roles, {
			regular: 1,
			heading: 1,
			inline: 1,
		});
		assert.strictEqual(typeOf(stats, "note").totalCount, 3);
	});

	it("counts a heading and the pill inside its own title separately", async () => {
		const stats = await scan({ "a.md": "## [!tip] see [!warning] first" });

		assert.deepStrictEqual(typeOf(stats, "tip").roles, {
			regular: 0,
			heading: 1,
			inline: 0,
		});
		assert.deepStrictEqual(typeOf(stats, "warning").roles, {
			regular: 0,
			heading: 0,
			inline: 1,
		});
	});

	it("counts a block header once, however long its body is", async () => {
		const stats = await scan({
			"a.md": ["> [!note] Title", "> one", "> two", "> three"].join("\n"),
		});

		assert.strictEqual(typeOf(stats, "note").totalCount, 1);
		assert.deepStrictEqual(stats.roleTotals, {
			regular: 1,
			heading: 0,
			inline: 0,
		});
	});

	it("keeps the roles summing to totalCount, nested payloads included", async () => {
		// `[!tip]{…}` is a content pill, and the tokenizer deliberately still
		// reports a token written inside its payload — everything that COUNTS
		// has to see it, or the numbers move when a payload is added.
		const stats = await scan({
			"a.md": [
				"> [!note] Block",
				"# [!success] Heading",
				"Text [!tip]{holding a [!bug] pill} more text.",
				"An unclosed [!quote]{payload",
			].join("\n"),
		});

		let summed = 0;
		for (const entry of stats.types) {
			const { regular, heading, inline } = entry.roles;
			assert.strictEqual(
				regular + heading + inline,
				entry.totalCount,
				`roles do not sum to totalCount for "${entry.id}"`,
			);
			summed += entry.totalCount;
		}
		assert.strictEqual(summed, stats.totalCount);

		const { regular, heading, inline } = stats.roleTotals;
		assert.strictEqual(regular + heading + inline, stats.totalCount);
		// The nested `[!bug]` and the unclosed `[!quote]` are both real.
		assert.strictEqual(typeOf(stats, "bug").roles.inline, 1);
		assert.strictEqual(typeOf(stats, "quote").roles.inline, 1);
	});

	it("skips frontmatter and fenced code, in every role", async () => {
		const stats = await scan({
			"a.md": [
				"---",
				"title: > [!note] not a callout",
				"---",
				"```",
				"> [!note] not a callout",
				"## [!note] not a callout",
				"```",
				"> [!note] the only one",
			].join("\n"),
		});

		assert.strictEqual(stats.totalCount, 1);
		assert.deepStrictEqual(typeOf(stats, "note").roles, {
			regular: 1,
			heading: 0,
			inline: 0,
		});
	});

	it("counts `[!note|purple]` under `note`, in the block role", async () => {
		const stats = await scan({ "a.md": "> [!note|purple] Tinted" });

		assert.deepStrictEqual(
			stats.types.map((t) => t.id),
			["note"],
		);
		assert.strictEqual(typeOf(stats, "note").roles.regular, 1);
	});

	it("reports files and role totals across the whole vault", async () => {
		const stats = await scan({
			"a.md": "> [!note] one\n\n### [!note] two",
			"b.md": "a [!note] pill",
			"c.md": "nothing here",
		});

		assert.strictEqual(stats.markdownFileCount, 3);
		assert.strictEqual(stats.filesWithCallouts, 2);
		assert.strictEqual(typeOf(stats, "note").fileCount, 2);
		assert.deepStrictEqual(stats.roleTotals, {
			regular: 1,
			heading: 1,
			inline: 1,
		});
	});
});
