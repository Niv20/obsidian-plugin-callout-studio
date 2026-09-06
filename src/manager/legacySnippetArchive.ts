import { normalizePath, type App } from "obsidian";

/** Keep exact legacy snippet bytes before cleanup, including any personal edits. */
export async function archiveLegacySnippet(app: App, source: string): Promise<void> {
	const adapter = app.vault.adapter;
	const text = await adapter.read(source);
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
	const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
	const dir = normalizePath(`${app.vault.configDir}/snippets/callout-studio-recovery`);
	if (!await adapter.exists(dir)) await adapter.mkdir(dir);
	let verified = false;
	for (let copy = 0; copy < 16; copy++) {
		// .txt copies cannot be enabled as CSS snippets. Never overwrite an
		// existing partial/different copy; leave it available for inspection.
		const path = normalizePath(`${dir}/legacy-startup-${hash}${copy ? `-${copy}` : ""}.txt`);
		if (!await adapter.exists(path)) await adapter.write(path, text);
		if (await adapter.read(path) === text) { verified = true; break; }
	}
	if (!verified) throw new Error("Legacy snippet archive could not be verified");
	// A sync/edit that landed during archival is not the version we preserved.
	if (await adapter.read(source) !== text) throw new Error("Legacy snippet changed during archival; retry next launch");
}
