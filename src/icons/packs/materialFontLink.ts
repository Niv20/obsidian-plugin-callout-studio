/** Browser-owned Google Fonts stylesheet loading, scoped to a plugin lifetime. */
import type { MaterialFontSession } from "./materialFontSession";

const LINK_TIMEOUT_MS = 15_000;
const WOFF2_IN_CSS = /url\(["']?(https:\/\/fonts\.gstatic\.com\/[^)"']+?\.woff2)["']?\)/;

/** Google returns the variable FILL font only to the browser's user-agent. */
export function loadMaterialFontLink(doc: Document, family: string, session: MaterialFontSession): Promise<boolean> {
	if (!session.active) return Promise.resolve(false);
	return new Promise<boolean>(resolve => {
		let settled = false;
		let timer = 0;
		let release = () => {};
		const link = createEl("link");
		const finish = (ok: boolean) => {
			if (settled) return;
			settled = true;
			window.clearTimeout(timer);
			link.onload = null;
			link.onerror = null;
			if (!ok) { link.remove(); release(); }
			resolve(ok && session.active);
		};
		release = session.own(() => { link.remove(); finish(false); });
		const verify = async () => {
			if (settled || !session.active) return;
			try {
				await doc.fonts.load(`24px "${family}"`);
				finish(session.active && isFamilyLoaded(doc, family));
			} catch { finish(false); }
		};
		// Replace stale module-owned links: a non-null sheet can still be a failed
		// cross-origin request whose cssRules throws, so sheet alone proves nothing.
		doc.head.querySelectorAll<HTMLLinkElement>(`link[data-cs-material-font="${family}"]`)
			.forEach(stale => stale.remove());
		link.rel = "stylesheet";
		link.href = cssUrl(family);
		link.setAttribute("data-cs-material-font", family);
		link.onload = () => void verify();
		link.onerror = () => finish(false);
		timer = window.setTimeout(() => finish(false), LINK_TIMEOUT_MS);
		doc.head.appendChild(link);
	});
}

/**
 * A second, CORS-enabled stylesheet lets cssRules expose the browser-selected
 * woff2 URL. media="not all" keeps it from supplying a second font; a failure
 * only skips disk caching and cannot affect the already-loaded picker font.
 */
export function resolveMaterialWoff2Url(doc: Document, family: string, session: MaterialFontSession): Promise<string | undefined> {
	if (!session.active) return Promise.resolve(undefined);
	return new Promise<string | undefined>(resolve => {
		let settled = false;
		let timer = 0;
		let release = () => {};
		const link = createEl("link");
		const finish = (url?: string) => {
			if (settled) return;
			settled = true;
			window.clearTimeout(timer);
			link.onload = null;
			link.onerror = null;
			link.remove();
			release();
			resolve(session.active ? url : undefined);
		};
		release = session.own(() => finish());
		link.rel = "stylesheet";
		link.href = cssUrl(family);
		link.media = "not all";
		link.crossOrigin = "anonymous";
		link.onload = () => {
			if (settled || !session.active) return;
			try {
				const css = Array.from(link.sheet?.cssRules ?? []).map(rule => rule.cssText).join("");
				finish(WOFF2_IN_CSS.exec(css)?.[1]);
			} catch { finish(); }
		};
		link.onerror = () => finish();
		timer = window.setTimeout(() => finish(), LINK_TIMEOUT_MS);
		doc.head.appendChild(link);
	});
}

function cssUrl(family: string): string {
	return `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:opsz,wght,FILL,GRAD@24,100..700,0..1,0`;
}

/** fonts.check is true even for an absent family; inspect loaded faces instead. */
export function isFamilyLoaded(doc: Document, family: string): boolean {
	let loaded = false;
	try {
		doc.fonts.forEach(face => {
			if (face.family.replace(/^["']|["']$/g, "") === family && face.status === "loaded") loaded = true;
		});
	} catch { return false; }
	return loaded;
}
