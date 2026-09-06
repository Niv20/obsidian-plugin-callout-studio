import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TFile, type App } from "obsidian";
import {
	countCalloutUsages,
	countCalloutUsagesMap,
} from "../src/utils/vaultCalloutScanner";

function usageVault(
	notes: Record<string, string>,
	options: { unreadable?: string[]; deleted?: string[]; replaced?: string[] } = {},
) {
	const live = new Map(Object.keys(notes).map((path) => [path, Object.assign(new TFile(), { path })]));
	const reads: string[] = [];
	const state = { listings: 0 };
	const app = { vault: {
		getMarkdownFiles: () => {
			state.listings++;
			const snapshot = [...live.values()];
			// Sync can remove or recreate a note after the list was captured.
			for (const path of options.deleted ?? []) live.delete(path);
			for (const path of options.replaced ?? []) live.set(path, Object.assign(new TFile(), { path }));
			return snapshot;
		},
		getAbstractFileByPath: (path: string) => live.get(path) ?? null,
		cachedRead: async (file: TFile) => {
			reads.push(file.path);
			if (options.unreadable?.includes(file.path)) throw new Error(`EACCES: ${file.path}`);
			return notes[file.path]!;
		},
	} } as unknown as App;
	return { app, reads, state };
}

describe("callout usage counts", () => {
	const notes = {
		"a.md": "> [!my-note] Title\n## [!my note] Heading\nA [!alias] pill\n`[!my-note]`",
		"b.md": "A [!MY-NOTE] pill\n```markdown\n> [!alias] Example\n```",
		"c.md": "No callout references here.",
	};

	it("counts matching files once across aliases and dash/space spellings", async () => {
		const h = usageVault(notes);
		assert.deepEqual(await countCalloutUsages(h.app, ["my note", "my-note", "alias"]), {
			fileCount: 2, totalCount: 4,
		});
		assert.equal(h.state.listings, 1);
		assert.deepEqual(h.reads, Object.keys(notes));
	});

	it("counts each canonical id in one pass, including requested ids with no uses", async () => {
		const h = usageVault(notes);
		assert.deepEqual(await countCalloutUsagesMap(h.app, ["my note", "my-note", "alias", "unused"]), new Map([
			["my-note", { fileCount: 2, totalCount: 3 }],
			["alias", { fileCount: 1, totalCount: 1 }],
			["unused", { fileCount: 0, totalCount: 0 }],
		]));
		assert.equal(h.state.listings, 1);
		assert.deepEqual(h.reads, Object.keys(notes));
	});
});

const counters: {
	name: string;
	run: (app: App, ids: string[]) => Promise<unknown>;
	oneUse: unknown;
	empty: unknown;
}[] = [
	{ name: "countCalloutUsages", run: countCalloutUsages, oneUse: { fileCount: 1, totalCount: 1 }, empty: { fileCount: 0, totalCount: 0 } },
	{ name: "countCalloutUsagesMap", run: countCalloutUsagesMap, oneUse: new Map([["note", { fileCount: 1, totalCount: 1 }]]), empty: new Map() },
];

for (const counter of counters) {
	describe(`${counter.name} crosses the vault safely`, () => {
		it("does not list or read notes when no ids were requested", async () => {
			const h = usageVault({ "a.md": "> [!note] Title" });
			assert.deepEqual(await counter.run(h.app, []), counter.empty);
			assert.equal(h.state.listings, 0);
			assert.deepEqual(h.reads, []);
		});

		it("skips deleted and replaced handles before trying to read them", async () => {
			const h = usageVault({
				"deleted.md": "> [!note] Deleted",
				"replaced.md": "> [!note] Replaced",
				"live.md": "> [!note] Live",
			}, { deleted: ["deleted.md"], replaced: ["replaced.md"] });
			assert.deepEqual(await counter.run(h.app, ["note"]), counter.oneUse);
			assert.deepEqual(h.reads, ["live.md"]);
		});

		for (const readableMatches of [true, false]) {
			it(`finishes visiting notes before rejecting ${readableMatches ? "a partial count" : "a misleading zero count"}`, async (context) => {
				context.mock.method(console, "warn", () => undefined);
				const h = usageVault({
					"a.md": readableMatches ? "> [!note] Readable" : "Unrelated text.",
					"b.md": "> [!note] Unreadable",
					"c.md": readableMatches ? "A [!note] pill" : "More unrelated text.",
					"d.md": "> [!note] Also unreadable",
					"e.md": "The final note still has to be visited.",
				}, { unreadable: ["b.md", "d.md"] });
				const seams = globalThis as { __CS_NOTICES__?: string[] };
				const previousNotices = seams.__CS_NOTICES__;
				const notices: string[] = [];
				seams.__CS_NOTICES__ = notices;
				try {
					await assert.rejects(counter.run(h.app, ["note"]), /Vault scan incomplete: 2 files could not be read/);
					assert.deepEqual(h.reads, ["a.md", "b.md", "c.md", "d.md", "e.md"]);
					assert.equal(notices.length, 1, "one scan notice covers every unreadable note");
					assert.match(notices[0]!, /2/);
					assert.match(notices[0]!, /read/i);
					assert.doesNotMatch(notices[0]!, /updated|b\.md|d\.md/);
				} finally {
					if (previousNotices === undefined) delete seams.__CS_NOTICES__;
					else seams.__CS_NOTICES__ = previousNotices;
				}
			});
		}
	});
}
