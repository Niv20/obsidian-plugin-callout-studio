/** Portrait storefront artwork around the actual phone UI, without a fake workspace. */
import { captions } from "./composition.mjs";

const escape = value => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const rect = (x, y, w, h, fill, r = 0, extra = "") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${extra}/>`;
const text = (x, y, value, size, fill = "#F7F3FF", extra = "") => `<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" fill="${fill}" ${extra}>${escape(value)}</text>`;
const headlines = {
	"01-settings": ["Your callouts,", "all together."],
	"02-notes": ["Make your notes", "stand out."],
	"03-create": ["Create a callout", "that’s yours."],
	"04-icons": ["Find the", "perfect icon."],
};

export function composeMobile(name, source, metadata) {
	const dimensions = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(source);
	if (!dimensions) throw new Error("Source scene needs a numeric viewBox");
	const width = Number(dimensions[1]), height = Number(dimensions[2]);
	if (width > 430 || height > 684) throw new Error(`Phone scene exceeds its frame: ${width} × ${height}`);
	let content = source.replace(/^<svg\b[^>]*>/, "").replace(/<\/svg>\s*$/, "");
	content = content.replace(/\bid="([^"]+)"/g, (_, id) => `id="${name}-${id}"`)
		.replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${name}-${id})`);
	const scale = 1.95, x = (900 - width * scale) / 2, y = 238 + (684 - height) * scale / 2;
	let body = `<defs>
	<radialGradient id="ambient" cx="50%" cy="55%" r="72%"><stop stop-color="#392565"/><stop offset=".5" stop-color="#211932"/><stop offset="1" stop-color="#111016"/></radialGradient>
	<clipPath id="phone-screen">${rect(x, y, width * scale, height * scale, "white", 20)}</clipPath>
	</defs>${rect(0, 0, 900, 1600, "url(#ambient)")}`;
	for (const [i, line] of headlines[name].entries()) body += text(450, 121 + i * 67, line, 60, "#F7F3FF", 'font-weight="700" letter-spacing="-1.6" text-anchor="middle"');
	body += '<g clip-path="url(#phone-screen)">';
	body += `<g transform="translate(${x} ${y}) scale(${scale})">${content}</g>`;
	if (name === "01-settings") {
		const trackHeight = height * scale - 36;
		const thumb = trackHeight * metadata.geometry.height / metadata.geometry.scrollHeight;
		body += rect(x + width * scale - 9, y + 18, 4, trackHeight, "#39363D", 2);
		body += rect(x + width * scale - 9, y + 18, 4, thumb, "#6D6479", 2);
	}
	body += '</g>';
	return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1600" viewBox="0 0 900 1600" role="img" aria-labelledby="title description"><title id="title">${escape(captions[name][0])} — Callout Studio</title><desc id="description">${escape(metadata.description)} Production components in phone layout with synthetic content on a purple promotional background, without a simulated Obsidian workspace. Mobile store artwork, 900 by 1600 pixels.</desc>${body}</svg>\n`;
}
