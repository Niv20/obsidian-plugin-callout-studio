/** Read installed Obsidian assets as data; never evaluate its application code. */
import { readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import ts from "typescript";

function readAsarFile(archive, name) {
	const headerSize = archive.readUInt32LE(4);
	const jsonSize = archive.readUInt32LE(12);
	const header = JSON.parse(archive.subarray(16, 16 + jsonSize).toString("utf8"));
	const entry = header.files[name];
	if (!entry || entry.unpacked || entry.files) throw new Error(`Missing bundled Obsidian asset: ${name}`);
	const start = 8 + headerSize + Number(entry.offset);
	return archive.subarray(start, start + entry.size).toString("utf8");
}

function literal(node) {
	if (ts.isStringLiteral(node)) return node.text;
	if (ts.isNumericLiteral(node)) return Number(node.text);
	if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) return -literal(node.operand);
	if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal);
	throw new Error("The installed Obsidian icon table contains an unsupported expression");
}

function readLucideTable(source) {
	const firstIcon = source.indexOf('{"a-arrow-down":');
	if (firstIcon < 0) throw new Error("Cannot locate the installed Obsidian Lucide table; supply OBSIDIAN_ICON_DATA instead");
	const end = source.indexOf("};", firstIcon);
	const file = ts.createSourceFile("icons.js", `(${source.slice(firstIcon, end + 1)})`, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
	const expression = file.statements[0]?.expression?.expression;
	if (!expression || !ts.isObjectLiteralExpression(expression)) throw new Error("Cannot parse the installed Obsidian Lucide table");
	const icons = {};
	for (const property of expression.properties) {
		if (!ts.isPropertyAssignment(property)) throw new Error("Unsupported Obsidian icon property");
		icons[property.name.text] = literal(property.initializer);
	}
	return icons;
}

export function loadObsidianAssets() {
	const archivePath = process.env.OBSIDIAN_ASAR || installedArchive();
	const cssPath = process.env.OBSIDIAN_APP_CSS;
	const iconsPath = process.env.OBSIDIAN_ICON_DATA;
	const archive = !cssPath || !iconsPath ? readFileSync(archivePath) : null;
	return {
		appCss: cssPath ? readFileSync(cssPath, "utf8") : readAsarFile(archive, "app.css"),
		icons: iconsPath ? JSON.parse(readFileSync(iconsPath, "utf8")) : readLucideTable(readAsarFile(archive, "app.js")),
		version: process.env.OBSIDIAN_VERSION || (archive ? JSON.parse(readAsarFile(archive, "package.json")).version : null),
	};
}

function installedArchive() {
	const updates = path.join(homedir(), "Library/Application Support/obsidian");
	try {
		const names = readdirSync(updates).filter(name => /^obsidian-\d+\.\d+\.\d+\.asar$/.test(name));
		names.sort((a, b) => b.localeCompare(a, "en", { numeric: true }));
		if (names[0]) return path.join(updates, names[0]);
	} catch { /* A fresh install has only the bundled archive. */ }
	return "/Applications/Obsidian.app/Contents/Resources/obsidian.asar";
}
