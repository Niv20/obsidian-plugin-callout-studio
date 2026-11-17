/**
 * The Publish to the web panel's pictures: the production WebPanelView,
 * drawn in Obsidian's right sidebar beside placeholder note text
 * (sidebarWindow.mjs), reading a fixture vault. It was a page of the settings
 * until 2026-11-16, drawn by mountSettings.
 *
 * The fixture's Obsidian has no other plugins, no commands and no
 * `showInFolder`, so the buttons that lead to Digital Garden, Publish changes
 * or Finder are said in words, as they are where those are missing. The
 * Quartz scene gives itself a Mac's `showInFolder` and a vault named
 * `content`, the layout the guide describes: its terminal step then shows the
 * site's folder with Reveal in Finder, as it does on a computer.
 */
import { Platform } from "obsidian";
import { t } from "../../src/i18n/index.ts";
import { WEB_PANEL_ICON_ID } from "../../src/icons/uiIcons.ts";
import { WebPanelView } from "../../src/webPanel/WebPanelView.ts";
import { sidebarWindow } from "./sidebarWindow.mjs";

const metadata = (title, description) => ({ selector: "#guide-scene", title, description });

/**
 * The panel reads the vault and fingerprints files before it draws, so a
 * scene waits for what it shows rather than for a fixed frame.
 */
async function drawn(check, what) {
	for (let turn = 0; turn < 300; turn++) {
		if (check()) return;
		await new Promise(resolve => setTimeout(resolve, 10));
	}
	throw new Error(`web panel: the panel never showed ${what}`);
}

/**
 * A fingerprint for a scene that writes files. The render page is not a secure
 * context, so it has no Web Crypto; and the panel needs a fingerprint only to
 * tell whether a file is still what it wrote, which any function of the bytes
 * answers. Never the real SHA-256: nothing a scene writes leaves the page.
 */
function standInFingerprint() {
	if (globalThis.crypto.subtle) return;
	const digest = async (_algorithm, data) => {
		const out = new Uint8Array(32);
		let hash = 2166136261;
		new Uint8Array(data.buffer ?? data).forEach((byte, index) => {
			hash = Math.imul(hash ^ byte, 16777619);
			out[index % 32] ^= hash & 255;
		});
		return out.buffer;
	};
	Object.defineProperty(globalThis.crypto, "subtle", { configurable: true, value: { digest } });
}

/** The production panel, opened in the picture's sidebar. */
async function openPanel(plugin, height) {
	const root = sidebarWindow({ cls: "cs-web-view", icon: WEB_PANEL_ICON_ID, label: t("web.title"), height });
	const view = new WebPanelView({ app: plugin.app }, plugin, 0);
	// The view draws into the sidebar's own content element.
	view.contentEl = root;
	await view.onOpen();
	await drawn(() => root.querySelector(".cs-web-rows"), "its first reading");
	return root;
}

async function webSetup(plugin) {
	// A vault connected to a Publish site, so there is a service to detect.
	plugin.seedNote(".obsidian/publish.json", "{}");
	await openPanel(plugin, 660);
	return metadata(
		"Set up Obsidian Publish",
		"The production Publish to the web panel in Obsidian's right sidebar, beside placeholder note text. At the top, under the caption Website hosting service, the list of services shows Obsidian Publish with its icon, and a hairline the width of the pane ends the top. Under it, every step on one page, each a heading with its number and a period before its name over a rounded box of its own: 1. Create the files, with its Create files button, 2. Custom domain, with a button to Obsidian's help page, each on a line of its own with a hairline between them; then 3. Publish the two files and 4. All done. Nothing is dimmed, and nothing is written.",
	);
}

async function webSetupQuartz(plugin) {
	// Quartz 5: the version a new site is, and the shorter of the two steps.
	plugin.localState.webExport = { service: "quartz", quartzVersion: 5 };
	// This scene shows the panel after Create note, so its vault takes the
	// note: in memory, like every note a scene seeds. Nothing reaches a disk.
	Object.assign(plugin.app.vault.adapter, {
		write: async (path, text) => {
			plugin.seedNote(path, text);
		},
		mkdir: async () => {},
	});
	standInFingerprint();
	// The panel listens for automatic refreshes; none happens in a scene.
	plugin.webAutoUpdate = { onDidWrite: () => () => {} };
	// A Mac, for the length of the scene: the button shows nothing here. And
	// the vault is the site's content folder, so the site is the folder that
	// holds it, which the button can show.
	const platform = { isDesktopApp: Platform.isDesktopApp, isMacOS: Platform.isMacOS };
	Object.assign(Platform, { isDesktopApp: true, isMacOS: true });
	plugin.app.showInFolder = () => {};
	const vaultName = plugin.app.vault.getName;
	plugin.app.vault.getName = () => "content";
	try {
		const root = await openPanel(plugin, 704);
		// The real button, writing into the fixture's vault.
		root.querySelector(".cs-web-row button.mod-cta").click();
		await drawn(() => root.querySelector(".cs-web-row.is-seen"), "the note as written");
		await drawn(
			() => [...root.querySelectorAll(".cs-web-row button")].some(button => button.textContent === t("web.actionRevealFinder")),
			"Reveal in Finder",
		);
	} finally {
		Object.assign(Platform, platform);
		delete plugin.app.showInFolder;
		plugin.app.vault.getName = vaultName;
	}
	return metadata(
		"Set up Quartz",
		"The production Publish to the web panel with Quartz chosen, on a Mac, after Create note was pressed in the scene. Step 1, Create the note, has an Open note button and, under a hairline, a line asking to read the note, then a line saying to publish it too with a plugin that publishes only chosen notes. Step 2, Install the Quartz plugin, asks which Quartz the site is, set to Quartz 5, then has a Reveal in Finder button and, under a hairline, a line for each smaller step: open a terminal in the site's folder; run the command that adds the plugin, in a well with a Copy button at its end; commit and push quartz.config.yaml and quartz.lock.json. Step 3, All done, is below the picture's edge.",
	);
}

export const scenes = {
	"web-setup": webSetup,
	"web-setup-quartz": webSetupQuartz,
};
