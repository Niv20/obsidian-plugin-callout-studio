/** README feature grid: the bento's production UI fragments in a transparent 4-column frame. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const components = path.join(root, "assets/store-screenshots/desktop/components");
const ink = "#F7F3FF";
// Obsidian's default dark settings pane: --background-primary / --color-base-00.
const settingsBackground = "#1C1C1C";
const escape = value => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const rect = (x, y, w, h, fill, r = 0, extra = "") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${extra}/>`;
const text = (x, y, value, size = 16, fill = ink, extra = "") => `<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" fill="${fill}" ${extra}>${escape(value)}</text>`;
const center = 'text-anchor="middle"';
const heading = value => text(22, 35, value, 21, ink, 'font-weight="700" letter-spacing="-.4"');
let serial = 0;

/** Preserve actual exported component paths, text and styling; only crop/scale. */
function component(name, box, x, y, width, height, radius = 5) {
    const filename = name.startsWith("05-")
        ? path.join(components, `${name}.svg`)
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

// The same fragments as desktop image 05, cropped to the shorter tiles.
const find = () => heading("Find callouts") + component("05-find", [0, 0, 233, 152], 22, 58, 233, 152);
const savedPalettes = () => heading("Saved color palettes") + component("05-saved-palettes", [0, 0, 233, 166], 22, 58, 233, 166);
const quickInsert = () => heading("Quick insert") + component("05-ribbon", [0, 0, 233, 180], 22, 56, 233, 180);
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
const autocomplete = () => heading("Autocomplete") + component("05-autocomplete", [0, 0, 233, 186], 22, 58, 233, 186);
/** Today's heading and its first two versions, cut from the guide's Version history picture. */
const history = () => heading("Version history") + component("version-history", [100, 176, 700, 195], 22, 58, 536, 150);
const contextMenu = () => heading("Right-click menu")
    // The Idea block behind the menu, then the production menu itself, clipped to its shell.
    + component("05-context-menu", [57, 57, 241, 101], 37, 53, 241, 101)
    + component("05-context-menu", [405, 150, 227.53, 151.5], 30.5, 80, 227.53, 151.5, 8);

const tiles = [
    { id: "find", x: 8, y: 22, w: 278, h: 244, draw: find },
    { id: "palettes", x: 310, y: 22, w: 278, h: 244, draw: savedPalettes },
    { id: "quick", x: 612, y: 22, w: 278, h: 244, draw: quickInsert },
    { id: "keys", x: 914, y: 22, w: 278, h: 244, draw: shortcuts },
    { id: "autocomplete", x: 914, y: 290, w: 278, h: 244, draw: autocomplete },
    { id: "history", x: 8, y: 290, w: 580, h: 244, draw: history },
    { id: "context", x: 612, y: 290, w: 278, h: 244, draw: contextMenu },
];
const defs = `<defs>
<linearGradient id="key-gradient" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#353535"/><stop offset="1" stop-color="#262626"/></linearGradient>
${tiles.map(t => `<clipPath id="clip-${t.id}">${rect(0, 0, t.w, t.h, "white", 20)}</clipPath>`).join("")}
</defs>`;
// No backdrop: the grid sits on the page, light or dark.
let body = defs;
for (const tile of tiles) {
    assert.ok(tile.x >= 8 && tile.y >= 22 && tile.x + tile.w <= 1192 && tile.y + tile.h <= 534);
    body += `<g transform="translate(${tile.x} ${tile.y})">` + rect(0, 0, tile.w, tile.h, settingsBackground, 20, 'stroke="rgb(64, 56, 78)"')
        + `<g clip-path="url(#clip-${tile.id})">${tile.draw()}</g></g>`;
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="556" viewBox="0 0 1200 556" role="img" aria-labelledby="title description"><title id="title">Callout Studio features at a glance</title><desc id="description">A two-row grid of seven Callout Studio features: Find callouts, Saved color palettes, Quick insert, Custom shortcuts, Version history, Right-click menu, and Autocomplete. The central promotional tile is omitted.</desc>${body}</svg>\n`;
assert.ok(!/<(?:image|script|foreignObject)\b/i.test(svg), "Vector-only artwork required");
assert.ok(!/\b(?:NaN|Infinity)\b/.test(svg), "Finite geometry required");
const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, "Unique SVG ids required");
for (const match of svg.matchAll(/url\(#([^)]+)\)/g)) assert.ok(ids.includes(match[1]), `Missing definition: ${match[1]}`);
writeFileSync(path.join(root, "assets/readme/03-more-features.svg"), svg);
console.log(`03-more-features.svg: ${(Buffer.byteLength(svg) / 1024).toFixed(1)} KiB, 1200 × 556, 7 feature tiles.`);
