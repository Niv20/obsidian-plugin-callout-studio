import { normalizePath, type App } from "obsidian";

/** Keep exact legacy snippet bytes before cleanup, including any personal edits. */
export async function archiveLegacySnippet(app: App, source: string, isActive: () => boolean = () => true): Promise<void> {
	if (!isActive()) return;
	const adapter = app.vault.adapter;
	const text = await adapter.read(source);
	if (!isActive()) return;
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
	if (!isActive()) return;
	const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
	const dir = normalizePath(`${app.vault.configDir}/snippets/callout-studio-recovery`);
	const dirExists = await adapter.exists(dir);
	if (!isActive()) return;
	if (!dirExists) await adapter.mkdir(dir);
	if (!isActive()) return;
	let verified = false;
	for (let copy = 0; copy < 16; copy++) {
		// .txt copies cannot be enabled as CSS snippets. Never overwrite an
		// existing partial/different copy; leave it available for inspection.
		const path = normalizePath(`${dir}/legacy-startup-${hash}${copy ? `-${copy}` : ""}.txt`);
		const exists = await adapter.exists(path);
		if (!isActive()) return;
		if (!exists) await adapter.write(path, text);
		if (!isActive()) return;
		const archived = await adapter.read(path);
		if (!isActive()) return;
		if (archived === text) { verified = true; break; }
	}
	if (!verified) throw new Error("Legacy snippet archive could not be verified");
	// A sync/edit that landed during archival is not the version we preserved.
	const current = await adapter.read(source);
	if (!isActive()) return;
	if (current !== text) throw new Error("Legacy snippet changed during archival; retry next launch");
}
