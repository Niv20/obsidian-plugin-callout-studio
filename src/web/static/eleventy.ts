/**
 * web/static/eleventy.ts — the host that runs the renderer inside a Digital
 * Garden build.
 *
 * Digital Garden is an Eleventy site with one markdown-it instance, and a
 * garden plugin may hook that instance (`setupMarkdown`). This host wraps its
 * `render`: the HTML markdown-it makes of a note comes through here and leaves
 * with its heading and inline callouts drawn.
 *
 * That early, rather than as an Eleventy transform on the finished page,
 * because of who else reads a note's HTML. The garden's feed and its search
 * index are both built from the rendered note *before* the page layout and its
 * transforms run. Drawing the callouts in `render` puts them in all three; a
 * transform would have fixed the page and left `[!tip]` in the feed.
 *
 * It also means running before the garden converts block callouts, which it
 * does later still, by finding `[!tip]` at the top of a `<blockquote>`. The
 * renderer leaves exactly that token alone (`isBlockCalloutLead` in
 * `web/core.ts`), so the garden's own callouts are untouched.
 *
 * Heading ids are assigned on markdown-it's tokens, before any HTML exists, so
 * they are still derived from the text the author wrote and links to a heading
 * keep working.
 *
 * A build must never fail because of us: anything thrown is logged once and
 * the note goes out as markdown-it made it.
 */
import type * as Core from "../core";
import type { WebBundleData } from "../webBundleData";
import { parseFragment, parseIconNodes, serializeFragment } from "./htmlFragment";

type CoreApi = typeof Core;

/** As much of a markdown-it instance as this host touches. */
export interface MarkdownIt {
	render: (...args: unknown[]) => string;
	__calloutStudio?: boolean;
}

/** What a garden plugin's hooks file exports, plus the pass itself for tests. */
export interface EleventyHost {
	/** Draw the callouts in one note's rendered HTML. */
	render(html: string): string;
	/** The garden plugin hook: called once with the site's markdown-it. */
	setupMarkdown(md: MarkdownIt): void;
}

export function eleventy(core: CoreApi, data: WebBundleData): EleventyHost {
	const renderer = core.createWebRenderer(data, {
		parseIcon: (markup) => parseIconNodes(markup) as unknown as Node[],
	});
	let warned = false;

	const render = (html: string): string => {
		if (typeof html !== "string" || html.indexOf("[!") === -1) return html;
		try {
			const root = parseFragment(html);
			renderer.process(root as unknown as HTMLElement);
			return serializeFragment(root);
		} catch (error) {
			if (!warned) {
				warned = true;
				console.warn("[Callout Studio] could not draw the callouts in a note; it is left as it was.", error);
			}
			return html;
		}
	};

	return {
		render,
		setupMarkdown(md) {
			// Hooks can be applied more than once in a watch build.
			if (!md || typeof md.render !== "function" || md.__calloutStudio) return;
			md.__calloutStudio = true;
			const inner = md.render;
			md.render = function (this: unknown, ...args: unknown[]): string {
				return render(inner.apply(this, args));
			};
		},
	};
}
