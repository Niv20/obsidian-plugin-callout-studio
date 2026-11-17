/**
 * Captures the note's content area of both built pages, at the same size.
 *
 * Offline: each page is served from its `dist` folder by a route. The
 * template's pages also ask CDNs for scripts (Alpine, Prism, search, graph);
 * those requests fail, and the content area does not need them. The one that
 * shows is Lucide, which Digital Garden uses to draw a block callout's icon on
 * load: it is answered with a stand-in that draws the same Lucide icon from
 * Obsidian's table (the one the documentation renders read).
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ORIGIN = "http://garden.test";
const LUCIDE = "https://unpkg.com/lucide@latest";

const TYPES = {
	".html": "text/html",
	".css": "text/css",
	".js": "text/javascript",
	".mjs": "text/javascript",
	".json": "application/json",
	".svg": "image/svg+xml",
	".png": "image/png",
	".ico": "image/x-icon",
	".woff2": "font/woff2",
	".woff": "font/woff",
	".ttf": "font/ttf",
	".xml": "application/xml",
	".webmanifest": "application/manifest+json",
};

/**
 * Lucide's `createIcons`, as the template calls it: every non-SVG element with
 * `data-lucide` becomes Lucide's SVG. The shape notation is the one in
 * scripts/user-guide/obsidian-runtime.ts.
 */
function lucideStandIn(icons) {
	return `(() => {
const icons = ${JSON.stringify(icons)};
const NS = "http://www.w3.org/2000/svg";
const tags = ["line", "circle", "polyline", "polygon", "ellipse", "rect", "path"];
const attributes = [["x1", "y1", "x2", "y2"], ["cx", "cy", "r", "fill"], ["points"], ["points"], ["cx", "cy", "rx", "ry"], ["x", "y", "width", "height", "rx", "ry"], ["d", "fill"]];
const base = { xmlns: NS, width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" };
function createIcons({ attrs = {} } = {}) {
	const { class: extra, ...rest } = attrs;
	for (const el of document.querySelectorAll("[data-lucide]")) {
		if (el.namespaceURI === NS) continue;
		const name = el.getAttribute("data-lucide");
		const shapes = icons[name];
		if (!shapes) continue;
		const svg = document.createElementNS(NS, "svg");
		for (const [key, value] of Object.entries({ ...base, ...rest })) svg.setAttribute(key, String(value));
		svg.setAttribute("data-lucide", name);
		svg.setAttribute("class", ["lucide", "lucide-" + name, el.getAttribute("class"), ...[].concat(extra ?? [])].filter(Boolean).join(" "));
		for (const [kind, ...values] of shapes) {
			const shape = document.createElementNS(NS, tags[Number(kind)]);
			attributes[Number(kind)].forEach((attr, index) => { if (values[index] !== undefined) shape.setAttribute(attr, String(values[index])); });
			svg.appendChild(shape);
		}
		el.replaceWith(svg);
	}
}
window.lucide = { createIcons };
})();`;
}

function serve(route, dist, standIn, blocked) {
	const url = new URL(route.request().url());
	if (url.href === LUCIDE) return route.fulfill({ contentType: "text/javascript", body: standIn });
	if (url.origin !== ORIGIN) {
		blocked.add(`${url.origin}${url.pathname}`);
		return route.abort();
	}
	let file = path.join(dist, decodeURIComponent(url.pathname));
	if (!file.startsWith(dist)) return route.fulfill({ status: 403, body: "" });
	if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, "index.html");
	if (!existsSync(file)) return route.fulfill({ status: 404, body: "" });
	return route.fulfill({ contentType: TYPES[path.extname(file)] ?? "application/octet-stream", body: readFileSync(file) });
}

/** Both pages' content, from the note's title to its last block, as PNG buffers at 2x. */
export async function capturePanels(browser, dists, { title, icons, width = 500 }) {
	const standIn = lucideStandIn(icons);
	const blocked = new Set();
	const opened = {};
	for (const [variant, dist] of Object.entries(dists)) {
		const context = await browser.newContext({ viewport: { width, height: 1400 }, deviceScaleFactor: 2, colorScheme: "light" });
		const page = await context.newPage();
		await page.route("**/*", (route) => serve(route, dist, standIn, blocked));
		await page.goto(`${ORIGIN}/`, { waitUntil: "load" });
		await page.evaluate(() => document.fonts.ready);
		// The theme's colors fade in after load: a capture taken mid-transition paints them grey.
		await page.evaluate(() =>
			Promise.all(
				document
					.getAnimations()
					.filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity)
					.map((animation) => animation.finished.catch(() => undefined)),
			),
		);
		await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve())));
		const box = await page.evaluate((title) => {
			const heading = [...document.querySelectorAll("h1")].find((h) => h.textContent.trim() === title);
			const last = document.querySelector(".content")?.lastElementChild;
			if (!heading || !last) return null;
			return {
				top: heading.getBoundingClientRect().top + scrollY,
				bottom: last.getBoundingClientRect().bottom + scrollY,
				background: getComputedStyle(document.body).backgroundColor,
				undrawn: [...document.querySelectorAll(".content i[data-lucide]")].map((el) => el.getAttribute("data-lucide")),
			};
		}, title);
		if (!box) throw new Error(`The "${variant}" page has no title "${title}" or no content`);
		if (box.undrawn.length > 0) throw new Error(`Icons Obsidian's Lucide table lacks: ${box.undrawn.join(", ")}`);
		opened[variant] = { context, page, box };
	}

	const above = 22;
	const below = 30;
	const height = Math.ceil(Math.max(...Object.values(opened).map(({ box }) => box.bottom - box.top))) + above + below;
	const panels = {};
	for (const [variant, { context, page, box }] of Object.entries(opened)) {
		panels[variant] = await page.screenshot({ clip: { x: 0, y: Math.floor(box.top - above), width, height } });
		await context.close();
	}
	return { panels, width, background: opened.with.box.background, blocked: [...blocked] };
}
