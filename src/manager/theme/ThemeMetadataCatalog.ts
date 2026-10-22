/**
 * manager/theme/ThemeMetadataCatalog.ts — the metadata words the loaded
 * styling reacts to, cached per styling.
 *
 * Two readers. The `[!type|…]` suggestions list the words, and they ask on
 * every keystroke while a theme can be a megabyte. The metadata colours stand
 * down on every word the user's own snippets already style, so a snippet that
 * colours `[!note|red]` keeps doing so (`snippetWords`).
 *
 * So the scan (`themeMetadataScan.ts`) runs once per styling: the theme and
 * its version, which snippets are on, and how long each of their texts is — a
 * snippet edited in place keeps its name, and the words it styles are exactly
 * what may have changed.
 *
 * Callout Studio's own exported snippet (`callout-studio-custom`) is skipped:
 * its words are this plugin's colours written out for other places, not the
 * user's styling, and reading them back would stand the plugin down on its own
 * colours.
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
import { SNIPPET_BASENAME } from "../cssSnippetExport";
import { foldMetadataCase } from "../../utils/calloutMetadata";

/** The words one stylesheet reacts to, labelled with where they come from. */
export interface MetadataWordSource {
	/** The theme's or the snippet's name, as Obsidian shows it. */
	label: string;
	words: ThemeMetadataWord[];
}

export class ThemeMetadataCatalog {
	private signature: string | null = null;
	private sources: MetadataWordSource[] = [];
	private reserved: ReadonlySet<string> = new Set();

	/**
	 * `themeOff`: the theme's callout styling is switched off
	 * (`themeCalloutsOff.ts`), its metadata rules with it, so none of its words
	 * is offered. The snippets' words stay — the switch leaves the user's CSS
	 * alone.
	 */
	constructor(
		private readonly app: App,
		private readonly themeOff: () => boolean = () => false,
	) {}

	/** The active theme's words first, then each enabled snippet's. */
	sourcesNow(): MetadataWordSource[] {
		this.refresh();
		return this.sources;
	}

	/** Every word an enabled snippet of the user's own reacts to, ASCII case folded. */
	snippetWords(): ReadonlySet<string> {
		this.refresh();
		return this.reserved;
	}

	private refresh(): void {
		const snippetCss = enabledSnippetCss(this.app);
		const off = this.themeOff();
		const signature = `${stylingSignature(this.app)}|${snippetCss.map((css) => css.length).join(",")}${off ? "|theme callouts off" : ""}`;
		if (signature === this.signature) return;
		this.signature = signature;
		const sources: MetadataWordSource[] = [];
		const reserved = new Set<string>();
		const theme = activeThemeName(this.app);
		if (theme && !off) {
			const words = scanMetadataWords(themeCss(this.app));
			if (words.length > 0) sources.push({ label: theme, words });
		}
		const names = enabledSnippetNames(this.app);
		snippetCss.forEach((css, i) => {
			const label = names[i] ?? "";
			if (label === SNIPPET_BASENAME) return;
			const words = scanMetadataWords(css);
			if (words.length === 0) return;
			sources.push({ label, words });
			for (const { word } of words) reserved.add(foldMetadataCase(word));
		});
		this.sources = sources;
		this.reserved = reserved;
	}
}
