/**
 * settings/declarative/footerGroup.ts — the foot of the main settings page: one
 * box with a row of small tiles, each an icon and its name.
 *
 *   🌐 English   🐞 Open an issue   </> Source code   ⚖ License   v2.18.0
 *
 * Who calls it. The settings tab, as the last box of the main page
 * (settingsTree.ts).
 *
 * The main idea. Everything that is about the plugin rather than its settings
 * lives in this one row, each as a tile with an icon and its name beside it
 * (the name is the tile's accessible name, so there is no tooltip), where it
 * used to be a box of its own each:
 *
 * - the language: a globe and the name of the language shown, which opens
 *   Obsidian's menu of languages (sections/languagePicker.ts), where a Language
 *   row used to stand alone;
 * - the project: an issue on GitHub, its source code;
 * - License, which opens a window with the plugin's license and the icons';
 * - the version, in words, linking to its release notes.
 *
 * The tiles are native-looking buttons (styles.css); a link is an `a` so it
 * can be opened in a new tab or copied, and a window opener is a `button`.
 *
 * Nothing in it is a setting, so it is left out of the settings search. The
 * words and addresses are in aboutLinks.ts.
 */
import { setIcon } from "obsidian";
import { t } from "../../i18n";
import type { SelectDropdown } from "../../ui/selectDropdown";
import { LicenseModal } from "../LicenseModal";
import { projectLinks, releaseNotesUrl, type ProjectLink } from "../aboutLinks";
import { drawLanguageMenu, languageDownloading } from "../sections/languagePicker";
import { languageChooser } from "./generalRows";
import { guardRender } from "./safeTree";
import type { CsGroup, CsRender, TreeContext } from "./types";

/** Marks the footer's row, whose own look is only the tiles (styles.css). */
const ROW_CLASS = "cs-footer-row";

/** Holds the tiles inside the row. */
const TILES_CLASS = "cs-footer-tiles";

/** Every tile (styles.css). */
const TILE_CLASS = "cs-footer-tile";

/** The footer, as the last box of the page. */
export function footerGroup(ctx: TreeContext): CsGroup {
	return { type: "group", id: "footer", items: [tilesRow(ctx)] };
}

/** The one row: all the tiles, in the middle. */
function tilesRow(ctx: TreeContext): CsRender {
	return {
		id: "footer-tiles",
		name: "",
		searchable: false,
		render: guardRender("footer tiles", (setting) => {
			setting.setClass(ROW_CLASS);
			// The tiles go straight into the row, whose own name and control
			// column are hidden (styles.css): like the page intro (rowParts.ts),
			// this row has nothing of the usual kind to show.
			const tiles = setting.settingEl.createDiv({ cls: TILES_CLASS });
			const language = drawLanguageTile(ctx, tiles);
			for (const link of projectLinks()) drawLinkTile(tiles, link);
			drawButtonTile(tiles, "scale", t("license.title"), () => new LicenseModal(ctx.app).open());
			drawVersionTile(tiles, ctx.plugin.manifest.version);
			// Obsidian keeps the row when it draws the page again, so the tiles
			// go before the next ones are made.
			return () => {
				language.destroy();
				tiles.remove();
			};
		}),
	};
}

/**
 * The globe and the language shown: the language menu, as a tile. It is dimmed while saving is paused
 * (a choice could not be saved) and while a language downloads (one is on its
 * way). The page is drawn again whenever either changes.
 */
function drawLanguageTile(ctx: TreeContext, parent: HTMLElement): SelectDropdown {
	const plugin = ctx.plugin;
	const picker = drawLanguageMenu(parent, plugin, languageChooser(ctx));
	picker.controlEl.addClass(TILE_CLASS);
	picker.setDisabled(plugin.settingsWriter.isFrozen || languageDownloading(plugin));
	return picker;
}

/** A tile that opens one of the plugin's own windows. */
function drawButtonTile(parent: HTMLElement, icon: string, label: string, open: () => void): void {
	const tile = parent.createEl("button", { cls: TILE_CLASS, attr: { type: "button" } });
	drawTileContent(tile, icon, label);
	tile.addEventListener("click", open);
}

/** A tile that opens a page on the web. */
function drawLinkTile(parent: HTMLElement, link: ProjectLink): void {
	const tile = drawAnchor(parent, link.href);
	drawTileContent(tile, link.icon, link.label);
}

/** The version, in words alone: the one tile with no icon. */
function drawVersionTile(parent: HTMLElement, version: string): void {
	const tile = drawAnchor(parent, releaseNotesUrl(version));
	tile.setText(`v${version}`);
}

/** The `a` under a tile: the pages open in the browser, never in Obsidian's window. */
function drawAnchor(parent: HTMLElement, href: string): HTMLAnchorElement {
	return parent.createEl("a", { cls: TILE_CLASS, href, attr: { target: "_blank", rel: "noopener noreferrer" } });
}

/**
 * Put `icon` in `tile` and `label` after it. The words are the tile's name for
 * a screen reader as well, so nothing else names it.
 */
function drawTileContent(tile: HTMLElement, icon: string, label: string): void {
	// `setIcon` empties what it draws into, so the icon gets a span of its own.
	setIcon(tile.createSpan({ cls: "cs-footer-tile-icon" }), icon);
	tile.createSpan({ cls: "cs-footer-tile-label", text: label });
}
