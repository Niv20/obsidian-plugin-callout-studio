/**
 * manager/theme/ThemeMetadataCatalog.ts — the metadata words the loaded
 * styling reacts to, cached per styling.
 *
 * The `[!type|…]` suggestions ask on every keystroke; a theme can be a
 * megabyte. So the scan (`themeMetadataScan.ts`) runs once per
 * `stylingSignature` — theme, version and enabled snippets — exactly the
 * freshness rule `ThemeCalloutStore` uses for the callout scan beside it.
 */
import type { App } from "obsidian";
import {
	activeThemeName,
	enabledSnippetCss,
	enabledSnippetNames,
	stylingSignature,
	themeCss,
} from "./customCssApi";
import { scanMetadataWords, type ThemeMetadataWord } from "./themeMetadataScan";

/** The words one stylesheet reacts to, labelled with where they come from. */
export interface MetadataWordSource {
	/** The theme's or the snippet's name, as Obsidian shows it. */
	label: string;
	words: ThemeMetadataWord[];
}

export class ThemeMetadataCatalog {
	private signature: string | null = null;
	private sources: MetadataWordSource[] = [];

	constructor(private readonly app: App) {}

	/** The active theme's words first, then each enabled snippet's. */
	sourcesNow(): MetadataWordSource[] {
		const signature = stylingSignature(this.app);
		if (signature === this.signature) return this.sources;
		this.signature = signature;
		const sources: MetadataWordSource[] = [];
		const theme = activeThemeName(this.app);
		if (theme) {
			const words = scanMetadataWords(themeCss(this.app));
			if (words.length > 0) sources.push({ label: theme, words });
		}
		const names = enabledSnippetNames(this.app);
		enabledSnippetCss(this.app).forEach((css, i) => {
			const words = scanMetadataWords(css);
			if (words.length > 0) sources.push({ label: names[i] ?? "", words });
		});
		this.sources = sources;
		return sources;
	}
}
