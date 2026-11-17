/**
 * tests/webOffer.test.ts — which services the settings page offers to set up
 * (`src/manager/web/webOffer.ts`).
 *
 * The offer is an invitation nobody asked for, so its promises are about when
 * it keeps quiet:
 *
 * - **Nothing before the vault was looked at, and nothing in a vault that
 *   points nowhere.**
 * - **One answer names every service**, the convincing ones first.
 * - **Each service is offered once**: not after it was dismissed, not after
 *   its screen was seen, and not when its files are in the vault already.
 * - **A service that turns up later is offered then** — a site started long
 *   after the plugin was installed.
 *
 * The row that shows the offer is in declarativeBannerRows.test.ts; the window
 * it opens, in webSetupModal.test.ts.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import type { WebExportMemory } from "../src/manager/DeviceLocalStore";
import { GARDEN_NOTE_KEY, QUARTZ_NOTE_KEY, QUARTZ_NOTE_NAME } from "../src/manager/web/targets";
import {
	markWebOfferHandled,
	refreshWebOffer,
	webServicesToOffer,
	type WebOfferHost,
} from "../src/manager/web/webOffer";

interface VaultOptions {
	files?: Record<string, string>;
	/** Community plugins switched on in the vault. */
	plugins?: string[];
	/** Notes the metadata cache knows, by path, with their properties. */
	notes?: Record<string, Record<string, unknown>>;
}

/** A vault as the look reads it. */
function vault(options: VaultOptions = {}) {
	const files = new Map(Object.entries(options.files ?? {}));
	if (options.plugins) files.set(".obsidian/community-plugins.json", JSON.stringify(options.plugins));
	const app = {
		vault: {
			configDir: ".obsidian",
			getName: () => "Notes",
			getMarkdownFiles: () => Object.keys(options.notes ?? {}).map((path) => ({ path })),
			adapter: {
				exists: (path: string) => Promise.resolve(files.has(path)),
				read: (path: string) => Promise.resolve(files.get(path) ?? ""),
			},
		},
		metadataCache: {
			getFileCache: (file: { path: string }) => {
				const frontmatter = options.notes?.[file.path];
				return frontmatter ? { frontmatter } : null;
			},
		},
	};
	return { app: app as unknown as App, files };
}

/** A plugin's device memory, as far as the offer reads and writes it. */
function host(memory: WebExportMemory = {}): WebOfferHost & { memory: { value: WebExportMemory } } {
	const state = { value: memory };
	return {
		memory: state,
		localState: {
			get webExport(): WebExportMemory {
				return { ...state.value };
			},
			setWebExport(next: WebExportMemory): void {
				state.value = next;
			},
		},
	};
}

describe("the website offer's services", () => {
	it("offers nothing before the first look, and nothing in a vault that points nowhere", async () => {
		const plugin = host();
		assert.deepEqual(webServicesToOffer(plugin), []);
		assert.equal(await refreshWebOffer(vault().app, plugin), false, "nothing changed: nothing to draw again");
		assert.deepEqual(webServicesToOffer(plugin), []);
		assert.equal(plugin.memory.value.offered, undefined, "and nothing was remembered");
	});

	it("names every service the vault points at in one answer, the convincing ones first", async () => {
		const plugin = host();
		const { app } = vault({
			plugins: ["quartz-syncer"],
			files: { "publish.css": "" },
			// Only a hint: a property the Digital Garden plugin reads.
			notes: { "Home.md": { "dg-publish": true } },
		});
		assert.equal(await refreshWebOffer(app, plugin), true);
		assert.deepEqual(webServicesToOffer(plugin), ["quartz", "publish", "garden"]);
		assert.equal(await refreshWebOffer(app, plugin), false, "the same answer is not a reason to draw again");
	});

	it("offers each service once: what was dismissed stays dismissed, on this device", async () => {
		const plugin = host();
		const { app } = vault({ plugins: ["quartz-syncer"], files: { "publish.css": "" } });
		await refreshWebOffer(app, plugin);
		assert.equal(markWebOfferHandled(plugin, ["quartz"]), true);
		assert.deepEqual(webServicesToOffer(plugin), ["publish"]);
		assert.deepEqual(plugin.memory.value.offered, ["quartz"]);
		assert.equal(
			markWebOfferHandled(plugin, ["quartz"]),
			false,
			"a second time changes nothing and writes nothing",
		);
		// What else the device remembers about the website export is kept.
		const other = host({ service: "quartz", quartzVersion: 5 });
		markWebOfferHandled(other, ["garden"]);
		assert.deepEqual(other.memory.value, { service: "quartz", quartzVersion: 5, offered: ["garden"] });
	});

	it("offers a service that turns up later", async () => {
		const plugin = host();
		const { app, files } = vault({ plugins: ["quartz-syncer"] });
		await refreshWebOffer(app, plugin);
		markWebOfferHandled(plugin, webServicesToOffer(plugin));
		assert.deepEqual(webServicesToOffer(plugin), []);
		// A year on, the vault is connected to a Publish site as well.
		files.set(".obsidian/publish.json", "{}");
		assert.equal(await refreshWebOffer(app, plugin), true);
		assert.deepEqual(webServicesToOffer(plugin), ["publish"]);
	});

	it("does not offer a service whose files are in the vault already", async () => {
		// Written on another device, or before the offer existed.
		const quartz = host();
		await refreshWebOffer(
			vault({ plugins: ["quartz-syncer"], notes: { "site/callouts.md": { [QUARTZ_NOTE_KEY]: 1 } } }).app,
			quartz,
		);
		assert.deepEqual(webServicesToOffer(quartz), []);
		assert.deepEqual(quartz.memory.value.offered, ["quartz"]);

		// A vault that is the Quartz repository keeps the note under content/,
		// found there even before the metadata cache has it.
		const repository = host();
		const note = `---\n${QUARTZ_NOTE_KEY}: 1\n---\n`;
		await refreshWebOffer(
			vault({ files: { "quartz.config.ts": "", [`content/${QUARTZ_NOTE_NAME}`]: note } }).app,
			repository,
		);
		assert.deepEqual(webServicesToOffer(repository), []);

		const garden = host();
		await refreshWebOffer(
			vault({ plugins: ["digitalgarden"], notes: { "site/callouts.md": { [GARDEN_NOTE_KEY]: 1 } } }).app,
			garden,
		);
		assert.deepEqual(webServicesToOffer(garden), []);

		const publish = host();
		await refreshWebOffer(vault({ files: { "publish.js": "/* callout-studio:start — … */" } }).app, publish);
		assert.deepEqual(webServicesToOffer(publish), []);
	});

	it("still offers Publish when publish.js is the user's own, with nothing of ours in it", async () => {
		const plugin = host();
		await refreshWebOffer(vault({ files: { "publish.js": "console.log('mine')" } }).app, plugin);
		assert.deepEqual(webServicesToOffer(plugin), ["publish"]);
	});

	it("never rejects, whatever it is given to look at", async () => {
		assert.equal(await refreshWebOffer({} as App, host()), false);
		assert.equal(await refreshWebOffer(vault().app, {} as WebOfferHost), false);
	});
});
