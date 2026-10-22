/**
 * Compose the website's nine Callout Studio images from the exported UI parts.
 * Palette and framing follow ~/Desktop/Callout Studio hero (hero-screen.svg).
 */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { partsDir } from "./paths.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(here, "../../..");
const OUT = process.env.OUT || path.resolve(here, "..");
mkdirSync(OUT, { recursive: true });

const LUCIDE_NOTICE = `<!-- Lucide icons: Copyright (c) 2026 Lucide Icons and Contributors. ISC License.
Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.
THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE. -->`;
const FONT = "ui-sans-serif, -apple-system, system-ui, &quot;Segoe UI&quot;, Roboto, &quot;Inter Variable&quot;, Inter, sans-serif";
const n = v => Math.round(v * 100) / 100;
const esc = v => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const rect = (x, y, w, h, fill, r = 0, extra = "") => `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${n(r)}" fill="${fill}" ${extra}/>`;

// Obsidian 1.14 dark surfaces, as the exported parts use them.
const OBS = { primary: "#1c1c1c", secondary: "#282828", border: "#333333", text: "#dadada", muted: "#b3b3b3", faint: "#666666" };

function part(name) {
	const file = name.includes("/") ? name : path.join(partsDir(), `${name}.svg`);
	const svg = readFileSync(file, "utf8");
	const [, w, h] = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
	return { svg, width: Number(w), height: Number(h) };
}

class Canvas {
	/** backdrop: false leaves the canvas transparent, for images that sit straight on the page. */
	constructor(width, height, { scale, title, description, glow = [0.5, 0.42], backdrop = true }) {
		Object.assign(this, { width, height, scale, title, description, backdrop });
		this.defs = [];
		this.body = [];
		this.serial = 0;
		if (!backdrop) {
			// Blur regions span the whole canvas, so no shadow is cut off before the edge.
			const blur = (id, sd) => `<filter id="${id}" filterUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}"><feGaussianBlur stdDeviation="${sd}"/></filter>`;
			this.defs.push(blur("contact", 3), blur("shadow", 22));
			return;
		}
		const [gx, gy] = glow;
		this.defs.push(
			`<linearGradient id="bg" gradientUnits="userSpaceOnUse" x1="0" y1="${n(-height * 0.08)}" x2="${width}" y2="${n(height * 1.08)}"><stop stop-color="#14101e"/><stop offset="1" stop-color="#1c142b"/></linearGradient>`,
			`<radialGradient id="glow" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(${n(width * gx)} ${n(height * gy)}) scale(${n(width * 0.69)} ${n(height * 0.67)})"><stop stop-color="#39265f"/><stop offset="0.68" stop-color="#39265f" stop-opacity="0"/></radialGradient>`,
			`<filter id="shadow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${n(Math.max(width, height) * 0.04)}"/></filter>`,
		);
		this.body.push(rect(0, 0, width, height, "url(#bg)"), rect(0, 0, width, height, "url(#glow)"));
	}
	id(prefix) { return `${prefix}-${++this.serial}`; }
	/** A soft violet bloom behind a panel, like hero-screen's panel-glow. */
	bloom(cx, cy, rx, ry, opacity = 0.45) {
		const id = this.id("bloom");
		this.defs.push(`<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(${n(cx)} ${n(cy)}) scale(${n(rx)} ${n(ry)})"><stop stop-color="#6b47c2" stop-opacity="${opacity}"/><stop offset="1" stop-color="#6b47c2" stop-opacity="0"/></radialGradient>`);
		this.body.push(rect(0, 0, this.width, this.height, `url(#${id})`));
	}
	/** Embed an exported part, ids prefixed, cropped to box, at (x, y) and scale. */
	embed(name, { box, x, y, scale = 1 }) {
		const src = part(name);
		const [bx, by, bw, bh] = box ?? [0, 0, src.width, src.height];
		const prefix = this.id("ui");
		const inner = src.svg.replace(/^<svg\b[^>]*>/, "").replace(/<\/svg>\s*$/, "")
			.replace(/<(title|desc)\b[^>]*>[\s\S]*?<\/\1>/g, "")
			.replace(/\bid="([^"]+)"/g, (_, id) => `id="${prefix}-${id}"`)
			.replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${prefix}-${id})`)
			.replace(/(href=")#([^"]+)"/g, (_, start, id) => `${start}#${prefix}-${id}"`)
			.replace(/&quot;\?\?&quot;, /g, "");
		return `<svg x="${n(x)}" y="${n(y)}" width="${n(bw * scale)}" height="${n(bh * scale)}" viewBox="${[bx, by, bw, bh].map(n).join(" ")}" overflow="hidden">${inner}</svg>`;
	}
	/** Rim + drop shadow + clipped content: the hero's floating-panel treatment, or a plain neutral one without a backdrop. */
	panel(x, y, w, h, content, { radius = 12, fade } = {}) {
		const clip = this.id("clip");
		this.defs.push(`<clipPath id="${clip}">${rect(x, y, w, h, "white", radius)}</clipPath>`);
		let shadow, edge;
		if (this.backdrop) {
			const rim = this.id("rim");
			this.defs.push(`<linearGradient id="${rim}" gradientUnits="userSpaceOnUse" x1="${n(x)}" y1="${n(y)}" x2="${n(x + w)}" y2="${n(y + h)}"><stop stop-color="#9d84d6" stop-opacity="0.55"/><stop offset="0.45" stop-color="#4b3f5c" stop-opacity="0.35"/><stop offset="1" stop-color="#8b6dd0" stop-opacity="0.45"/></linearGradient>`);
			shadow = rect(x + w * 0.03, y + h * 0.05, w * 0.94, h * 0.97, "#07050c", radius, 'opacity="0.7" filter="url(#shadow)"');
			edge = `stroke="url(#${rim})"`;
		} else {
			// A tight contact shadow under a soft lifted one; the faint light edge keeps the window apart from a black page.
			shadow = rect(x, y + 2, w, h, "#000", radius, 'opacity="0.2" filter="url(#contact)"')
				+ rect(x + w * 0.03, y + 18, w * 0.94, h, "#000", radius, 'opacity="0.32" filter="url(#shadow)"');
			edge = 'stroke="#fff" stroke-opacity="0.12"';
		}
		let group = shadow
			+ `<g clip-path="url(#${clip})">${rect(x, y, w, h, OBS.primary)}${content}</g>`
			+ rect(x + 0.5, y + 0.5, w - 1, h - 1, "none", radius, `${edge} stroke-width="1.2"`);
		if (fade) {
			const [from, to] = fade, grad = this.id("fade"), mask = this.id("mask");
			this.defs.push(`<linearGradient id="${grad}" gradientUnits="userSpaceOnUse" x1="0" y1="${n(from)}" x2="0" y2="${n(to)}"><stop stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`);
			this.defs.push(`<mask id="${mask}" maskUnits="userSpaceOnUse" x="0" y="0" width="${this.width}" height="${this.height}">${rect(0, 0, this.width, this.height, `url(#${grad})`)}</mask>`);
			// WebKit masks each element of a masked group on its own, so whatever sits under a window
			// shows through it in the fade. An opacity group makes it mask one flattened layer instead.
			group = `<g mask="url(#${mask})"><g opacity="0.999">${group}</g></g>`;
		}
		this.body.push(group);
	}
	toString() {
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${n(this.width * this.scale)}" height="${n(this.height * this.scale)}" viewBox="0 0 ${this.width} ${this.height}" role="img" aria-labelledby="title description"><title id="title">${esc(this.title)}</title><desc id="description">${esc(this.description)}</desc>`+LUCIDE_NOTICE+`<defs>${this.defs.join("")}</defs>${this.body.join("")}</svg>\n`;
		assert.ok(!/<(?:image|script|foreignObject)\b/i.test(svg), "vector only");
		assert.ok(!/\b(?:NaN|Infinity|undefined)\b/.test(svg), "finite geometry");
		const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
		assert.equal(new Set(ids).size, ids.length, "unique ids");
		for (const m of svg.matchAll(/url\(#([^)]+)\)/g)) assert.ok(ids.includes(m[1]), `missing def ${m[1]}`);
		return svg;
	}
}

/** Obsidian's tab bar, drawn at scale: muted window dots and one active tab. */
function titleBar(x, y, w, s, title, { ribbon = false } = {}) {
	const h = 36 * s;
	let svg = rect(x, y, w, h, OBS.secondary);
	for (let i = 0; i < 3; i++) svg += `<circle cx="${n(x + (18 + i * 17) * s)}" cy="${n(y + h / 2)}" r="${n(5.2 * s)}" fill="#4a4553"/>`;
	const tabX = x + 84 * s, tabW = Math.min(210 * s, w - 100 * s);
	svg += `<path d="M${n(tabX)} ${n(y + h)} V${n(y + 9 * s)} q0 ${n(-4 * s)} ${n(4 * s)} ${n(-4 * s)} H${n(tabX + tabW - 4 * s)} q${n(4 * s)} 0 ${n(4 * s)} ${n(4 * s)} V${n(y + h)} Z" fill="${OBS.primary}"/>`;
	svg += `<text x="${n(tabX + 14 * s)}" y="${n(y + 24.5 * s)}" font-family="${FONT}" font-size="${n(13 * s)}" fill="${OBS.text}">${esc(title)}</text>`;
	// The tab's close cross, as Obsidian draws it on the active tab.
	const cx = tabX + tabW - 17 * s, cy = y + 20.5 * s, d = 3.6 * s;
	svg += `<path d="M${n(cx - d)} ${n(cy - d)}l${n(2 * d)} ${n(2 * d)}M${n(cx + d)} ${n(cy - d)}l${n(-2 * d)} ${n(2 * d)}" stroke="${OBS.muted}" stroke-width="${n(1.3 * s)}" stroke-linecap="round" opacity="0.7"/>`;
	svg += rect(x, y + h - 1 * s, w, 1 * s, OBS.border, 0, 'opacity="0"');
	return { svg, height: h };
}

/** A note window: tab bar + one exported part below it. */
function noteWindow(c, name, { x, y, s, title, box, fade, glow = true }) {
	const src = part(name);
	const [, , bw, bh] = box ?? [0, 0, src.width, src.height];
	const w = bw * s, bar = titleBar(x, y, w, s, title), h = bar.height + bh * s;
	if (glow) c.bloom(x + w / 2, y, w * 0.85, h * 0.55);
	c.panel(x, y, w, h, bar.svg + c.embed(name, { box, x, y: y + bar.height, scale: s }), { fade });
	return { w, h };
}

const scenes = {};

// The two section images sit straight on the page: no backdrop, only the window's shadow,
// with room left below and beside it for the shadow to fade out before the edge.
const PAGE = { side: 30, top: 24, bottom: 62 };

// ─── Section 1: one note, three forms ───────────────────────────────────────
scenes["three-forms"] = () => {
	const p = part("three-forms"), s = 1;
	const c = new Canvas(p.width + PAGE.side * 2, p.height + 36 + PAGE.top + PAGE.bottom, {
		scale: 3, title: "One callout, three forms", backdrop: false,
		description: "An Obsidian note titled The Three Callout Types shows the same purple Idea callout as a heading bar, as a small inline pill inside a sentence, and as a classic block callout.",
	});
	noteWindow(c, "three-forms", { x: PAGE.side, y: PAGE.top, s, title: "The Three Callout Types", glow: false });
	return c;
};

// ─── Section 2: the callout editor ──────────────────────────────────────────
scenes["callout-editor"] = () => {
	const p = part("editor");
	const c = new Canvas(p.width + PAGE.side * 2, p.height + PAGE.top + PAGE.bottom, {
		scale: 2.5, title: "The Callout Studio editor", backdrop: false,
		description: "The Callout Studio New callout window designing an Idea callout: display name, IDs idea and spark, the Purple color, the Lucide lightbulb icon, and live previews of the heading, inline and block formats beside the icon adjustment sliders.",
	});
	c.panel(PAGE.side, PAGE.top, p.width, p.height, c.embed("editor", { x: PAGE.side, y: PAGE.top }));
	return c;
};

// ─── Carousel (620 × 480) ───────────────────────────────────────────────────
const CW = 620, CH = 480, CS = 3;
const carousel = (title, description) => new Canvas(CW, CH, { scale: CS, title, description, glow: [0.5, 0.36] });

scenes["carousel_autocomplete"] = () => {
	const c = carousel("Autocomplete", "Typing > [! in an Obsidian note opens Callout Studio's suggestion list: Abstract, Bug, Danger, Example, Failure, Idea, Info and Meeting, each with its own icon, color and IDs.");
	const s = 0.84, w = part("autocomplete").width * s;
	noteWindow(c, "autocomplete", { x: (CW - w) / 2, y: 34, s, title: "Weekly review", fade: [CH - 120, CH - 22] });
	return c;
};

scenes["carousel_quick-insert"] = () => {
	const c = carousel("Quick Insert", "The Quick insert block callout window, opened from Callout Studio's ribbon button, lists rendered previews of every callout: Abstract, Bug, Danger, Example, Failure, Idea, Info, Meeting and more, each with edit and wrap actions.");
	const x = 26, y = 32, w = CW - 52, h = CH, s = 1;
	const bar = titleBar(x, y, w, 0.86, "Weekly review");
	let inner = bar.svg;
	const top = y + bar.height;
	inner += rect(x, top, 47, h, OBS.secondary) + rect(x + 46, top, 1, h, OBS.border);
	inner += c.embed(`${REPO}/assets/store-screenshots/desktop/components/05-ribbon.svg`, { box: [3, 2, 40, 174], x, y: top + 4 });
	// The note behind the window, as abstract text lines.
	const lines = [[150, 0], [300, 1], [262, 1], [284, 1], [190, 1], [0, 0], [120, 0], [296, 1], [240, 1], [270, 1], [0, 0], [280, 1], [210, 1]];
	let ly = top + 40;
	for (const [lw, body] of lines) {
		if (lw) inner += rect(x + 72, ly, lw, body ? 7 : 11, body ? "#4a4a4a" : "#5a5a5a", 3.5);
		ly += body ? 24 : 30;
	}
	inner += rect(x + 47, top, w - 47, h, "rgba(10, 10, 10, 0.4)");
	const qi = part("quick-insert"), qs = 0.76, qw = qi.width * qs;
	const qx = x + 47 + (w - 47 - qw) / 2 + 6, qy = top + 26;
	c.bloom(x + w / 2, y, w * 0.85, CH * 0.5);
	// The modal casts its own shadow onto the window.
	const shadowId = c.id("qishadow");
	c.defs.push(`<filter id="${shadowId}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="10"/></filter>`);
	inner += rect(qx, qy + 10, qw, qi.height * qs, "#000", 12 * qs, `opacity="0.55" filter="url(#${shadowId})"`);
	inner += c.embed("quick-insert", { x: qx, y: qy, scale: qs });
	c.panel(x, y, w, h, inner, { fade: [CH - 120, CH - 22] });
	return c;
};

scenes["carousel_wrap"] = () => {
	const c = carousel("Wrap in callout", "An Obsidian note with a Markdown table selected, and the command palette searching wrap: Callout Studio's Wrap in callout, Wrap in Idea block callout (collapsed) with a custom Command-Shift-C shortcut, and Unwrap from callout.");
	const p = part("wrap"), s = 0.86, w = p.width * s, h = (36 + p.height) * s;
	noteWindow(c, "wrap", { x: (CW - w) / 2, y: (CH - h) / 2, s, title: "Sprint plan" });
	return c;
};

scenes["carousel_context-menu"] = () => {
	const c = carousel("Right-click menu", "Two Callout Studio right-click menus in Obsidian. On a block callout: Copy callout Markdown, Set callout closed, Make callout non-collapsible, Edit callout settings and Open Callout Studio settings. On a heading callout: Cut, Copy and Delete heading section, plus the same two settings actions.");
	const s = 0.84;
	const a = part("menu-block"), b = part("menu-heading");
	const ax = 30, ay = 34, bx = CW - 30 - b.width * s, by = CH - 34 - b.height * s;
	c.bloom(ax + a.width * s / 2, ay, a.width * s * 0.8, 200);
	c.bloom(bx + b.width * s / 2, by + b.height * s, b.width * s * 0.8, 200, 0.35);
	c.panel(ax, ay, a.width * s, a.height * s, c.embed("menu-block", { x: ax, y: ay, scale: s }));
	c.panel(bx, by, b.width * s, b.height * s, c.embed("menu-heading", { x: bx, y: by, scale: s }));
	return c;
};

scenes["carousel_find-callouts"] = () => {
	const c = carousel("Find callouts", "Obsidian with the Find callouts sidebar open beside a note: All types and All formats filters, 6 occurrences in 3 files, and result cards for each heading, inline and block callout with its line number.");
	const s = 0.78, w = part("find").width * s;
	noteWindow(c, "find", { x: (CW - w) / 2, y: 32, s, title: "Weekly review", fade: [CH - 110, CH - 20] });
	return c;
};

scenes["carousel_outline"] = () => {
	const c = carousel("Headings that stay headings", "An Obsidian note with Idea, Meeting and Research heading callouts. The Outline pane and the [[# link suggestions list the same headings with their icon and color, and no raw [!type] text.");
	const s = 0.78, w = part("outline").width * s;
	noteWindow(c, "outline", { x: (CW - w) / 2, y: 32, s, title: "Launch plan", fade: [CH - 110, CH - 20] });
	return c;
};

scenes["carousel_version-history"] = () => {
	const c = carousel("Version history", "Callout Studio's Version history window: saved setups from today and yesterday along a timeline, such as Changes saved, Before an import and Before Reset everything, each with a compare button, a delete button and Restore.");
	const p = part("history"), s = 0.86, w = p.width * s, h = p.height * s;
	const x = (CW - w) / 2, y = (CH - h) / 2;
	c.bloom(CW / 2, y, w * 0.85, h * 0.55);
	c.panel(x, y, w, h, c.embed("history", { x, y, scale: s }));
	return c;
};

const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(scenes);
for (const name of names) {
	const svg = scenes[name]().toString();
	writeFileSync(path.join(OUT, `${name}.svg`), svg);
	console.log(`${name}.svg ${Math.round(Buffer.byteLength(svg) / 1024)} KiB`);
}
