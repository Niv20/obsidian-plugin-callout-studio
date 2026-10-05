/** Image 05 only: production UI fragments inside an independent bento frame. */
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { heroCrystal } from "./store-bento/hero-crystal.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "assets/store-screenshots/desktop");
const ink = "#F7F3FF";
// Obsidian's default dark settings pane: --background-primary / --color-base-00.
const settingsBackground = "#1C1C1C";
const escape = value => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const rect = (x, y, w, h, fill, r = 0, extra = "") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${extra}/>`;
const text = (x, y, value, size = 16, fill = ink, extra = "") => `<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" fill="${fill}" ${extra}>${escape(value)}</text>`;
const center = 'text-anchor="middle"';
const heading = (value, fill = ink) => text(22, 35, value, 21, fill, 'font-weight="700" letter-spacing="-.4"');
let serial = 0;

/** Preserve actual exported component paths, text and styling; only crop/scale. */
function component(name, box, x, y, width, height, radius = 5) {
    const filename = name.startsWith("05-")
        ? path.join(output, "components", `${name}.svg`)
        : path.join(root, "assets/user-guide", `${name}.svg`);
    const source = readFileSync(filename, "utf8");
    const prefix = `ui-${++serial}`;
    const body = source.replace(/^<svg\b[^>]*>/, "").replace(/<\/svg>\s*$/, "")
        .replace(/<(title|desc)\b[^>]*>[\s\S]*?<\/\1>/g, "")
        .replace(/\bid="([^"]+)"/g, (_, id) => `id="${prefix}-${id}"`)
        .replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${prefix}-${id})`)
        .replace(/(href=")#([^"]+)"/g, (_, start, id) => `${start}#${prefix}-${id}"`);
    return `<defs><clipPath id="${prefix}-viewport">${rect(x, y, width, height, "white", radius)}</clipPath></defs><g clip-path="url(#${prefix}-viewport)"><svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="${box.join(" ")}" preserveAspectRatio="xMinYMin meet" overflow="hidden">${body}</svg></g>`;
}

function quickInsert() {
    const source = readFileSync(path.join(output, "components/05-ribbon.svg"), "utf8");
    const [, width, height] = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(source);
    return heading("Quick insert")
        + component("05-ribbon", [0, 0, Number(width), Number(height)], 22, 56, 233, 180);
}
function shortcuts() {
    let svg = heading("Custom shortcuts")
        + rect(22, 59, 233, 69, "#282828", 10, 'stroke="#414141"')
        + text(37, 86, "Wrap this text in Idea", 15, "#E9E3F4", 'font-weight="500"')
        + text(37, 108, "block callout (collapsed)", 15, "#E9E3F4", 'font-weight="500"');
    for (const [index, label] of ["⌘", "⇧", "C"].entries()) {
        const x = 22 + index * 80;
        svg += rect(x, 152, 73, 66, "#111111", 12)
            + rect(x, 147, 73, 65, "url(#key-gradient)", 12, 'stroke="#505050"')
            + text(x + 36.5, 188, label, 29, "#E4DBFF", center);
    }
    return svg;
}
function find() {
    const source = readFileSync(path.join(output, "components/05-find.svg"), "utf8");
    const [, width, height] = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(source);
    return heading("Find callouts")
        + component("05-find", [0, 0, Number(width), Number(height)], 22, 58, 233, Number(height));
}
function hero() {
    let svg = rect(0, 0, 566, 232, "url(#hero-glow)");
    svg += heroCrystal();
    svg += text(283, 90, "Callout Studio has", 26, "#E3D8FC", `${center} font-weight="500"`);
    return svg + text(283, 151, "so much more to offer...", 44, "#FCF9FF", `${center} font-weight="700" letter-spacing="-1.5"`);
}
function history() {
    return heading("Version history")
        + component("version-history", [62, 172, 506, 17], 30, 59, 506, 17)
        + rect(89, 67.25, 1, 19.75, "#333333")
        + component("version-history", [62, 206, 506, 150], 30, 85, 506, 150)
        + rect(89, 235, 1, 9, "#333333");
}
function contextMenu() {
    return heading("Right-click menu")
        // The storefront's real Idea block sits behind its production menu.
        + component("05-context-menu", [57, 57, 280, 101], 74, 53, 280, 101)
        // Clip to the native menu shell, excluding the captured scene behind it.
        + component("05-context-menu", [405, 150, 215.53, 139.5], 30.5, 79, 215.53, 139.5, 8);
}
function savedPalettes() {
    return heading("Saved color palettes")
        + component("05-saved-palettes", [0, 0, 233, 166], 22, 58, 233, 166);
}
function autocomplete() {
    const svg = readFileSync(path.join(output, "components/05-autocomplete.svg"), "utf8");
    const [, width, height] = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
    return heading("Autocomplete")
        + component("05-autocomplete", [0, 0, Number(width), Number(height)], 22, 58, 233, Number(height));
}

const tiles = [
    { id: "find", x: 28, y: 28, w: 277, h: 488, draw: find },
    { id: "palettes", x: 317, y: 28, w: 277, h: 244, draw: savedPalettes },
    { id: "quick", x: 606, y: 28, w: 277, h: 244, draw: quickInsert },
    { id: "keys", x: 895, y: 28, w: 277, h: 244, draw: shortcuts },
    { id: "hero", x: 317, y: 284, w: 566, h: 232, draw: hero },
    { id: "autocomplete", x: 895, y: 284, w: 277, h: 488, draw: autocomplete },
    { id: "history", x: 28, y: 528, w: 566, h: 244, draw: history },
    { id: "context", x: 606, y: 528, w: 277, h: 244, draw: contextMenu },
];
const defs = `<defs>
<radialGradient id="ambient" cx="50%" cy="55%" r="72%"><stop stop-color="#392565"/><stop offset=".5" stop-color="#211932"/><stop offset="1" stop-color="#111016"/></radialGradient>
<linearGradient id="hero-gradient" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#925DF0"/><stop offset=".44" stop-color="#6844C0"/><stop offset="1" stop-color="#343D8F"/></linearGradient>
<radialGradient id="hero-glow" cx="12%" cy="0%" r="105%"><stop stop-color="#B299FF" stop-opacity=".35"/><stop offset=".7" stop-color="#5830AD" stop-opacity="0"/></radialGradient>
<linearGradient id="key-gradient" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#353535"/><stop offset="1" stop-color="#262626"/></linearGradient>
${tiles.map(t => `<clipPath id="clip-${t.id}">${rect(0, 0, t.w, t.h, "white", 20)}</clipPath>`).join("")}
</defs>`;
let body = defs + rect(0, 0, 1200, 800, "url(#ambient)");
for (const tile of tiles) {
    assert.ok(tile.x >= 28 && tile.y >= 28 && tile.x + tile.w <= 1172 && tile.y + tile.h <= 772);
    const fill = tile.id === "hero" ? "url(#hero-gradient)" : settingsBackground;
    body += `<g transform="translate(${tile.x} ${tile.y})">` + rect(0, 0, tile.w, tile.h, fill, 20, `stroke="${tile.id === "hero" ? "#A385DC" : "#484848"}" stroke-opacity=".6"`)
        + `<g clip-path="url(#clip-${tile.id})">${tile.draw()}</g></g>`;
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800" role="img" aria-labelledby="title description"><title id="title">Callout Studio has so much more to offer...</title><desc id="description">Seven feature tiles surround a purple-blue central message with two smaller, partially cropped Obsidian-inspired faceted crystals and five sparse geometric shards. Find callouts is a tall left panel with type and format filters, a normal-weight occurrence summary, and grouped heading, block, and inline source results. Custom shortcuts pairs a collapsed Idea command with illustrative user-assigned Command, Shift and C keys. Quick insert shows the real ribbon icon and tooltip beside nearby abstract file rows. Saved color palettes shows Coral, transparent Mint glass, and violet-blue Twilight with native color circles and edit/delete actions. Production autocomplete fills a tall right panel. Version history spans the lower left with a spaced date and a timeline continuing to the tile edge, beside a right-click menu over the edge of a Violet Idea block, raised with extra space below the menu. All feature tiles use Obsidian's default dark settings background. Production components use synthetic data.</desc>${body}</svg>\n`;
assert.ok(!/<(?:image|script|foreignObject)\b/i.test(svg), "Vector-only artwork required");
assert.ok(!/\b(?:NaN|Infinity)\b/.test(svg), "Finite geometry required");
const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, "Unique SVG ids required");
for (const match of svg.matchAll(/url\(#([^)]+)\)/g)) assert.ok(ids.includes(match[1]), `Missing definition: ${match[1]}`);
mkdirSync(path.join(output, "svg"), { recursive: true });
writeFileSync(path.join(output, "svg/05-more.svg"), svg);
console.log(`05-more.svg: ${(Buffer.byteLength(svg) / 1024).toFixed(1)} KiB, 1200 × 800, 7 feature tiles.`);
