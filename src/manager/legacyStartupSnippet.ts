/**
 * manager/legacyStartupSnippet.ts — removes the startup CSS snippet that
 * Callout Studio versions up to 2.5.0 wrote into the vault.
 *
 * Those versions kept a second copy of the generated CSS at
 * `.obsidian/snippets/callout-studio-do-not-delete.css` and switched it on
 * through Obsidian's internal `app.customCss`, so callout colours were already
 * correct in the frame before community plugins loaded. Nothing ever removed
 * it: uninstalling the plugin left a ~100KB orphan file that kept styling the
 * vault forever, plus a dangling name in `appearance.json`. The snippet layer
 * is gone (see {@link StartupStyleCache}, which now keeps only the per-device
 * localStorage snapshot); this undoes what it left behind.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * DELETE THIS FILE IN 3.0.0, together with its import and its single
 * `onLayoutReady` call site in main.ts. By then every vault will have launched
 * a version that cleans up, and the check is dead weight.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Runs on EVERY launch rather than once behind a flag in `data.json`. A flag
 * would sync: it could reach a second device before the snippet file itself
 * does, and that device would then never clean up. Running every time also
 * covers a device still on 2.5.0 re-creating and re-syncing the file. The cost
 * is one `exists()` stat, off the startup path — see the call site.
 */
import { normalizePath } from "obsidian";
import type { App } from "obsidian";
import { archiveLegacySnippet } from "./legacySnippetArchive";

/**
 * The only name this snippet ever had, across every released version — so
 * there are no older names to migrate from.
 */
const LEGACY_SNIPPET_NAME = "callout-studio-do-not-delete";

/**
 * The undocumented subset of Obsidian's `app.customCss` needed to switch a
 * snippet off. Every member is probed before use: if the internal API ever
 * changes, the file is still deleted, and Obsidian ignores an
 * `enabledCssSnippets` entry whose file is missing.
 */
interface CustomCssApi {
	setCssEnabledStatus?: (snippetName: string, enabled: boolean) => void;
	requestLoadSnippets?: () => void;
	enabledSnippets?: Set<string>;
}

/**
 * Delete the legacy startup snippet and take its name out of the enabled list.
 * Never throws — a vault that refuses the write is not a reason to fail load.
 */
export async function removeLegacyStartupSnippet(app: App, isActive: () => boolean = () => true): Promise<void> {
	if (!isActive()) return;
	try {
		const adapter = app.vault.adapter;
		const path = normalizePath(
			`${app.vault.configDir}/snippets/${LEGACY_SNIPPET_NAME}.css`,
		);
		const customCss = (app as App & { customCss?: CustomCssApi }).customCss;

		const wasEnabled =
			customCss?.enabledSnippets?.has?.(LEGACY_SNIPPET_NAME) ?? false;
		const exists = await adapter.exists(path);
		if (!isActive()) return;
		// The normal path on every launch after the first cleanup.
		if (!exists && !wasEnabled) return;
		// The historical filename does not prove its contents are still generated.
		// Preserve and verify personal edits before disabling or deleting anything.
		if (exists) await archiveLegacySnippet(app, path, isActive);
		if (!isActive()) return;

		// Disable before deleting. This does two jobs at once — it drops the
		// snippet's <style> out of the live cascade and takes the name out of
		// appearance.json — and doing it first means a delete that fails (vault
		// open read-only, sync holding the file) still leaves the stale rules
		// switched off. appearance.json is never edited by hand: Obsidian owns
		// that file and writes it on its own schedule.
		if (wasEnabled) {
			customCss?.setCssEnabledStatus?.(LEGACY_SNIPPET_NAME, false);
		}
		if (!isActive()) return;

		// The file lives under configDir, so it is not a TFile and `vault.delete`
		// cannot see it — the adapter is the only way in. Removed outright rather
		// than trashed: `.trash` sits inside the vault, so trashing would just
		// move the orphan. A verified, inactive .txt recovery copy now preserves
		// the exact bytes, even if the user edited the historical generated file.
		if (exists) await adapter.remove(path);
		if (!isActive()) return;

		customCss?.requestLoadSnippets?.();
	} catch (e) {
		if (!isActive()) return;
		console.warn(
			"[CalloutStudio] failed to remove the legacy startup CSS snippet — " +
				`delete "${LEGACY_SNIPPET_NAME}.css" from your snippets folder manually`,
			e,
		);
	}
}
