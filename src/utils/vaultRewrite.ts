/**
 * utils/vaultRewrite.ts — how a bulk rewrite of the user's notes is walked.
 *
 * Split from `vaultCalloutScanner.ts`, which owns *what* each rewrite does to a
 * line. This file owns the part that has nothing to do with callouts: crossing
 * the whole vault safely. It is the only place in the plugin that writes
 * arbitrary user content, and the rules below are what keep that write honest.
 *
 * A whole-vault pass is not a single-file edit repeated. It runs for seconds on
 * a large vault, with the user free to keep typing and Sync free to land a
 * remote change throughout, so three things that never matter for one file all
 * become likely at once — a stale handle, an unreadable note, and a note that
 * changed underneath the read. Each has its own answer here.
 */
import { Notice } from "obsidian";
import type { App, TFile } from "obsidian";
import { t } from "../i18n";

/**
 * Visit every markdown file in the vault, isolating each one.
 *
 * Two hazards, both specific to the length of the walk:
 *
 * - **The file list is a snapshot.** `getMarkdownFiles()` answers once, up
 *   front; by the time the loop reaches entry 3,000 a note may have been
 *   deleted, or deleted and recreated at the same path as a different `TFile`.
 *   The identity check is the same one `CalloutDiscovery` makes before acting
 *   on a queued scan, and for the same reason: a stale handle writes to the
 *   wrong place, or throws.
 *
 * - **One unreadable file must not abort the rest.** A bare loop over `await`s
 *   unwinds on the first rejection, which for a rename means notes before the
 *   failure are rewritten on disk, notes after it are not, and the caller —
 *   which updates the registry only once this resolves — is left holding a
 *   promise that never does. The vault ends up half-renamed with nothing said.
 *   Failures are collected per file and reported once at the end: a
 *   `console.warn` carries the detail, a single `Notice` tells the user some
 *   notes were left alone. See `internals-docs/22-logging-and-diagnostics.md` —
 *   a swallowed failure with no user-visible trace is what that doc rules out.
 */
async function forEachVaultFile(
	app: App,
	visit: (file: TFile) => Promise<void>,
): Promise<void> {
	const files = app.vault.getMarkdownFiles();
	const failed: string[] = [];

	for (const file of files) {
		// Gone, or replaced by a different handle at the same path, since the
		// snapshot above. Either way this is not the file we set out to rewrite.
		if (app.vault.getAbstractFileByPath(file.path) !== file) continue;
		try {
			await visit(file);
		} catch (error) {
			console.warn(
				`[callout-studio] vault rewrite skipped ${file.path}`,
				error,
			);
			failed.push(file.path);
		}
	}

	if (failed.length > 0) {
		new Notice(t("notice.vaultRewritePartial", { count: failed.length }), 10000);
	}
}

/**
 * Apply one rewrite atomically to every markdown file that needs it.
 *
 * `transform` is a pure function of a file's content: the rewritten text and
 * how many occurrences changed, or null when the file needs no change.
 *
 * It is called twice for a file that does change, and the split is the point:
 *
 * - **The probe** runs against `cachedRead`, and answers only "is this file
 *   affected at all". Most notes in a vault mention none of the ids, and a file
 *   that needs no change must take no write — every write is a vault
 *   modification, which syncs, which re-renders — so that decision has to be
 *   settled *before* `process` is opened, because `process` writes whatever its
 *   callback returns.
 *
 * - **The rewrite** runs inside `process`, which hands the callback the
 *   authoritative on-disk text and commits the result under the vault's own
 *   lock. This is what closes the read-modify-write race that a `read()`-then-
 *   `modify()` pair leaves open: an edit landing between the probe and the
 *   commit is rewritten on top of, rather than overwritten with, the stale copy
 *   the probe saw. That window is the difference between a rename the user can
 *   keep typing through and one that silently eats the paragraph they were
 *   writing.
 *
 * The counts that reach the caller are always the ones the *committed* pass
 * produced, never the probe's, so a file that changed underneath us reports
 * what actually happened to it — including reporting nothing when the change
 * that landed had already removed the last occurrence.
 *
 * Returns how many files were rewritten and how many occurrences changed across
 * all of them. A file skipped by either guard above counts towards neither.
 */
export async function rewriteVaultFiles(
	app: App,
	transform: (content: string) => { content: string; count: number } | null,
): Promise<{ files: number; count: number }> {
	let files = 0;
	let total = 0;

	await forEachVaultFile(app, async (file) => {
		if (!transform(await app.vault.cachedRead(file))) return;

		let count = 0;
		await app.vault.process(file, (content) => {
			const result = transform(content);
			count = result?.count ?? 0;
			return result ? result.content : content;
		});
		if (count > 0) {
			files++;
			total += count;
		}
	});

	return { files, count: total };
}
