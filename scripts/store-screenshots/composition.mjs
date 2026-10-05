/** Store artwork around the production UI. All geometry stays editable SVG. */
const escape = value => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const text = (x, y, value, size, fill = "#F5F2FF", extra = "") => `<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" fill="${fill}" ${extra}>${escape(value)}</text>`;
const rect = (x, y, w, h, fill, radius = 0, extra = "") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" ${extra}/>`;
const bar = (x, y, width, opacity = .55) => rect(x, y, width, 6, "#514B60", 3, `opacity="${opacity}"`);

export const captions = {
	"01-settings": ["Your callouts, all together."],
	"02-notes": ["Make your notes stand out."],
	"03-create": ["Create a callout that’s yours."],
	"04-icons": ["Find the perfect icon."],
};

const frame = { x: 28, y: 98, width: 1144, height: 688 };
const centerY = frame.y + frame.height / 2;

function backdrop() {
	return `<defs>
		<radialGradient id="ambient" cx="50%" cy="55%" r="72%"><stop stop-color="#392565"/><stop offset=".5" stop-color="#211932"/><stop offset="1" stop-color="#111016"/></radialGradient>
		<linearGradient id="rim" x2="1" y2="1"><stop stop-color="#75628F" stop-opacity=".5"/><stop offset=".45" stop-color="#43384F" stop-opacity=".25"/><stop offset="1" stop-color="#8B6DD0" stop-opacity=".3"/></linearGradient>
		<clipPath id="workspace">${rect(frame.x, frame.y, frame.width, frame.height, "white", 14)}</clipPath>
	</defs>
	${rect(0, 0, 1200, 800, "url(#ambient)")}`;
}

function workspace() {
	const { x, y, width, height } = frame;
	let svg = rect(x, y, width, height, "#18161E", 14, 'stroke="url(#rim)"');
	svg += '<g clip-path="url(#workspace)">';
	svg += rect(x, y, width, 39, "#211D2B");
	for (let i = 0; i < 3; i++) svg += `<circle cx="${x + 22 + i * 16}" cy="${y + 20}" r="4" fill="#51485F"/>`;
	svg += rect(x + 217, y + 9, 179, 30, "#292332", 7);
	svg += bar(x + 242, y + 22, 87, .8) + bar(x + 418, y + 22, 74, .35);
	svg += rect(x, y + 39, 39, height - 39, "#1B1822") + rect(x + 39, y + 39, 168, height - 39, "#201C28");
	for (let i = 0; i < 7; i++) svg += rect(x + 13, y + 59 + 32 * i, 12, 12, "none", 3, 'stroke="#51475E" stroke-width="1.3"');
	svg += rect(x + 52, y + 58, 142, 28, "#2C2538", 5) + bar(x + 64, y + 69, 85, .6);
	for (let i = 0; i < 15; i++) {
		const indent = i % 4 === 0 ? 0 : 11;
		if (indent === 0) {
			const arrowX = x + 57, arrowY = y + 111 + i * 31;
			svg += `<path d="M${arrowX} ${arrowY}l4 4 4-4" fill="none" stroke="#514B60" opacity="0.42" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>`;
		}
		svg += bar(x + 74 + indent, y + 110 + i * 31, 66 + (i * 19 % 39), .42);
	}
	svg += bar(x + 268, y + 74, 150, .45);
	for (let row = 0; row < 16; row++) {
		svg += bar(x + 268, y + 126 + row * 32, 300 + (row * 67 % 344), .19);
	}
	svg += '</g>';
	return svg;
}

function vectorContent(svg, prefix) {
	const dimensions = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
	if (!dimensions) throw new Error("Source scene needs a numeric viewBox");
	let content = svg.replace(/^<svg\b[^>]*>/, "").replace(/<\/svg>\s*$/, "");
	content = content.replace(/\bid="([^"]+)"/g, (_, id) => `id="${prefix}-${id}"`)
		.replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${prefix}-${id})`);
	return { content, width: Number(dimensions[1]), height: Number(dimensions[2]) };
}

export function compose(name, source, metadata) {
	const [headline] = captions[name];
	const scene = vectorContent(source, name);
	let body = backdrop();
	body += text(600, 61, headline, 36, "#F7F3FF", 'font-weight="700" letter-spacing="-1" text-anchor="middle"');
	body += workspace();
	if (name === "02-notes") body += `<g clip-path="url(#workspace)">${rect(frame.x + 207, frame.y + 39, frame.width - 207, frame.height - 39, "#1e1e1e")}</g>`;
	let scale, x, y;
	if (name === "01-settings") {
		scale = Math.min(948 / scene.width, 664 / scene.height);
		x = 600 - (scene.width * scale + 146) / 2 + 146;
		y = centerY - scene.height * scale / 2;
		const left = x - 146, width = scene.width * scale + 146, height = scene.height * scale;
		body += rect(left, y, width, height, "#252329", 11, 'stroke="#514958"');
		body += text(left + 20, y + 35, "Settings", 16, "#D7D1E0", 'font-weight="700"');
		for (let i = 0; i < 5; i++) body += bar(left + 20, y + 64 + i * 29, [80, 65, 90, 72, 81][i], .6);
		body += rect(left + 10, y + 218, 126, 31, "#49346A", 5);
		body += text(left + 20, y + 238, "Callout Studio", 13, "#E3D7FA", 'font-weight="600"');
		for (let i = 0; i < 4; i++) body += bar(left + 20, y + 276 + i * 29, [75, 91, 67, 84][i], .45);
	} else if (name === "02-notes") {
		scale = Math.min(820 / scene.width, 609 / scene.height);
		x = frame.x + 207 + (frame.width - 207 - scene.width * scale) / 2;
		y = frame.y + 39 + (frame.height - 39 - scene.height * scale) / 2;
	} else {
		scale = Math.min(1000 / scene.width, 664 / scene.height);
		x = 600 - scene.width * scale / 2;
		y = centerY - scene.height * scale / 2;
	}
	if (name === "01-settings") {
		body += `<defs><clipPath id="settings-window">${rect(x, y, scene.width * scale, scene.height * scale, "white", 9)}</clipPath></defs><g clip-path="url(#settings-window)">`;
	}
	body += `<g transform="translate(${x} ${y}) scale(${scale})">${scene.content}</g>`;
	if (name === "01-settings") {
		body += '</g>';
		const trackHeight = scene.height * scale - 28;
		const thumbHeight = trackHeight * metadata.geometry.height / metadata.geometry.scrollHeight;
		body += rect(x + scene.width * scale - 7, y + 14, 3, trackHeight, "#39363D", 1.5);
		body += rect(x + scene.width * scale - 7, y + 14, 3, thumbHeight, "#6D6479", 1.5);
	}
	return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800" role="img" aria-labelledby="title description"><title id="title">${escape(headline)} — Callout Studio</title><desc id="description">${escape(metadata.description)} Purple promotional frame with a simplified Obsidian workspace. Desktop store artwork, 1200 by 800 pixels.</desc>${body}</svg>\n`;
}
