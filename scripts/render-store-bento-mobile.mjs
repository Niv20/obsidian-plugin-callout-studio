/** Portrait image 05: reframe the desktop's exact vector fragments in two columns. */
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "assets/store-screenshots/mobile");
const source = readFileSync(path.join(root, "assets/store-screenshots/desktop/svg/05-more.svg"), "utf8");
assert.match(source, /viewBox="0 0 1200 800"/, "Expected the desktop image 05 canvas");

const escape = value => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const rect = (x, y, w, h, fill, r = 0, extra = "") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${extra}/>`;
const text = (x, y, value, size, extra = "") => `<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" fill="#F7F3FF" ${extra}>${escape(value)}</text>`;

// Source content is stored once. Local <use> references preserve paths, text,
// controls and colors exactly; every crop has one uniform scale on both axes.
const artwork = source.replace(/^<svg\b[^>]*>/, "").replace(/<\/svg>\s*$/, "")
    .replace(/<(title|desc)\b[^>]*>[\s\S]*?<\/\1>/g, "")
    // The new portrait frame supplies the background and tile shells. Removing
    // these avoids remnants of rounded desktop borders inside the wider tiles.
    .replace(/<rect x="0" y="0" width="1200" height="800"[^>]*\/>/, "")
    .replace(/(<g transform="translate\(\d+ \d+\)">)<rect[^>]+fill="#1C1C1C"[^>]*\/>/g, "$1")
    .replace(/\bid="([^"]+)"/g, (_, id) => `id="desktop-${id}"`)
    .replace(/url\(#([^)]+)\)/g, (_, id) => `url(#desktop-${id})`)
    .replace(/(href=")#([^"]+)"/g, (_, start, id) => `${start}#desktop-${id}"`);

const tiles = [
    { id: "find", title: "Find callouts", source: [28, 28, 277, 488], content: [58, 414], x: 50, y: 170, w: 390, h: 680 },
    { id: "palettes", title: "Saved color palettes", source: [317, 28, 277, 244], content: [58, 166], x: 460, y: 170, w: 390, h: 330 },
    { id: "quick", title: "Quick insert", source: [606, 28, 277, 244], content: [56, 180], x: 460, y: 520, w: 390, h: 330 },
    { id: "keys", title: "Custom shortcuts", source: [895, 28, 277, 244], content: [59, 159], x: 50, y: 870, w: 390, h: 330 },
    { id: "autocomplete", title: "Autocomplete", source: [895, 284, 277, 488], content: [58, 406], x: 460, y: 870, w: 390, h: 680 },
    { id: "context", title: "Right-click menu", source: [606, 528, 277, 244], content: [53, 165.5], x: 50, y: 1220, w: 390, h: 330 },
];

let body = `<defs>
<radialGradient id="ambient" cx="50%" cy="55%" r="72%"><stop stop-color="#392565"/><stop offset=".5" stop-color="#211932"/><stop offset="1" stop-color="#111016"/></radialGradient>
<g id="desktop-artwork">${artwork}</g>
</defs>${rect(0, 0, 900, 1600, "url(#ambient)")}`;
body += text(450, 121, "And so much more...", 60, 'font-weight="700" letter-spacing="-1.6" text-anchor="middle"');

for (const tile of tiles) {
    assert.ok(tile.x >= 50 && tile.y >= 170 && tile.x + tile.w <= 850 && tile.y + tile.h <= 1550, `${tile.id}: canvas containment`);
    const [sx, sy, sw, sh] = tile.source;
    assert.ok(source.includes(`transform="translate(${sx} ${sy})"`), `${tile.id}: source tile moved; review its crop`);
    assert.ok(source.includes(`id="clip-${tile.id}"><rect x="0" y="0" width="${sw}" height="${sh}"`), `${tile.id}: source tile resized; review its crop`);
    const scale = 1.3;
    // Crop to each component's actual vertical extent, then center it within
    // the space below the heading. Every tile uses the same horizontal center.
    const [top, contentHeight] = tile.content;
    assert.ok(top >= 50 && top + contentHeight < sh, `${tile.id}: source crop containment`);
    const crop = [sx + 1, sy + top, sw - 2, contentHeight];
    const width = crop[2] * scale, height = crop[3] * scale;
    const x = (tile.w - width) / 2, y = 72 + (tile.h - 72 - 24 - height) / 2;
    assert.ok(x >= 0 && y >= 72 && y + height <= tile.h - 24, `${tile.id}: crop containment`);
    body += `<g id="tile-${tile.id}" transform="translate(${tile.x} ${tile.y})">`
        + rect(0, 0, tile.w, tile.h, "#1C1C1C", 20, 'stroke="#484848" stroke-opacity=".6"')
        + text(tile.w / 2, 50, tile.title, 30, 'font-weight="700" letter-spacing="-.6" text-anchor="middle"')
        + `<svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="${crop.join(" ")}" preserveAspectRatio="xMidYMin meet" overflow="hidden"><use href="#desktop-artwork"/></svg></g>`;
}
for (const [index, tile] of tiles.entries()) for (const other of tiles.slice(index + 1)) {
    assert.ok(tile.x + tile.w <= other.x || other.x + other.w <= tile.x || tile.y + tile.h <= other.y || other.y + other.h <= tile.y, `${tile.id}/${other.id}: overlapping tiles`);
}

const description = "Six Callout Studio features in two columns beneath the single-line headline And so much more...: Find callouts, saved color palettes, Quick insert, custom shortcuts, autocomplete, and right-click menu. Tall tiles with centered headings and uniformly enlarged components leave balanced outer margins. Original desktop component illustrations use synthetic data; the ribbon, keyboard shortcut and context menu retain their desktop appearance.";
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1600" viewBox="0 0 900 1600" role="img" aria-labelledby="title description"><title id="title">And so much more... — Callout Studio</title><desc id="description">${description}</desc>${body}</svg>\n`;
assert.ok(!/<(?:image|script|foreignObject)\b/i.test(svg), "Vector-only artwork required");
assert.ok(!/\b(?:NaN|Infinity)\b/.test(svg), "Finite geometry required");
assert.ok(!/\son[a-z]+=/i.test(svg), "No active content");
const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, "Unique SVG IDs required");
for (const match of svg.matchAll(/url\(([^)]+)\)|\bhref="([^"]+)"/g)) {
    const reference = match[1] ?? match[2];
    assert.ok(reference.startsWith("#") && ids.includes(reference.slice(1)), `Nonlocal or missing reference: ${reference}`);
}
mkdirSync(path.join(output, "svg"), { recursive: true });
writeFileSync(path.join(output, "svg/05-more.svg"), svg);
console.log(`mobile/05-more.svg: ${(Buffer.byteLength(svg) / 1024).toFixed(1)} KiB, 900 × 1600, 6 centered feature tiles.`);
