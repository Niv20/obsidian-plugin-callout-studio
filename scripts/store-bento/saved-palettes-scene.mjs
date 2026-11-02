/** Native saved-palette rows with synthetic solid, transparent and gradient colors. */
import { installDomHelpers } from "obsidian";
import { setLocale } from "../../src/i18n/index.ts";
import { PALETTES_PAGE } from "../../src/settings/declarative/palettesPage.ts";
import { derivePaletteFromColor } from "../../src/utils/colorUtils.ts";
import { makeHost } from "../user-guide/fixture-host.mjs";
import { mountSettingsPage } from "../user-guide/settingsPage.mjs";

export async function mountSavedPalettes() {
	installDomHelpers();
	setLocale("en");
	document.body.className = "theme-dark is-desktop";
	const plugin = makeHost();
	const palette = (id, name, baseColor, bgIntensity = 0.24) => ({
		id, name, baseColor, bgIntensity,
		...derivePaletteFromColor(baseColor, bgIntensity),
	});
	const twilight = palette("store-twilight", "Twilight", "#bb88ff", 0.55);
	const blue = derivePaletteFromColor("#639dff", 0.55);
	plugin.settings.customPalettes = [
		palette("store-coral", "Coral", "#f58e82"),
		{ ...palette("store-mint-glass", "Mint glass", "#7adbb7"), transparentBg: true },
		{
			...twilight,
			bgGradient: {
				angleDeg: 90, toColorLight: blue.bgColorLight, toColorDark: blue.bgColorDark,
				textToColorLight: blue.colorLight, textToColorDark: blue.colorDark,
				textGradient: true,
			},
		},
	];
	// The Saved color palettes page as Obsidian draws it; the tile is its list's
	// rows, the box Obsidian draws them in.
	mountSettingsPage(plugin, { path: [PALETTES_PAGE.page] });
	const panel = document.querySelector("#guide-scene .setting-group.mod-list .setting-items");
	panel.id = "bento-saved-palettes";
	// The shared vector exporter does not paint CSS conic gradients. Overlay an
	// equivalent inline checkerboard, using the native swatch's computed tones.
	const circle = panel.querySelector(".cs-color-circle.is-transparent");
	const image = getComputedStyle(circle).backgroundImage;
	const tones = [...new Set(image.match(/color\(srgb [^)]*\)|rgba?\([^)]*\)/g) ?? [])];
	if (tones.length !== 2) throw new Error(`Expected native transparency checkerboard tones: ${image}`);
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.setAttribute("viewBox", "0 0 16 16");
	svg.setAttribute("aria-hidden", "true");
	Object.assign(svg.style, { position: "absolute", inset: "0", width: "100%", height: "100%" });
	for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
		const square = document.createElementNS("http://www.w3.org/2000/svg", "rect");
		for (const [key, value] of Object.entries({ x: x * 4.5, y: y * 4.5, width: 4.5, height: 4.5, fill: tones[(x + y + 1) % 2] })) {
			square.setAttribute(key, String(value));
		}
		svg.appendChild(square);
	}
	circle.style.overflow = "hidden";
	circle.appendChild(svg);
	await document.fonts.ready;
	await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
	return {
		selector: "#bento-saved-palettes", title: "Saved color palettes",
		description: "The Saved color palettes page's list shows Coral with a solid tint, Mint glass with a transparent checkerboard, and Twilight with violet-blue gradient stops. Native color circles and pencil/delete actions use installed Obsidian styles. All palette data is synthetic and offline.",
	};
}
