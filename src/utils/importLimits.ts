/** Resource budgets for untrusted imports, before format-specific validation. */
export const MAX_IMPORT_BYTES = 16 * 1024 * 1024;
export const MAX_IMPORT_DEPTH = 32;
export const MAX_IMPORT_VALUES = 50_000;
export const MAX_IMPORT_COLLECTION = 1_000;

export class ImportLimitError extends Error {
	constructor(readonly messageKey: "import.err.tooLarge" | "import.err.tooComplex" | "import.err.imageBudget") {
		super(messageKey);
		this.name = "ImportLimitError";
	}
}

export function assertImportSize(bytes: number): void {
	if (bytes > MAX_IMPORT_BYTES) throw new ImportLimitError("import.err.tooLarge");
}

/** Count UTF-8 bytes without allocating a second, potentially huge buffer. */
export function assertImportTextSize(text: string): void {
	assertImportSize(text.length);
	let bytes = 0;
	for (let i = 0; i < text.length; i++) {
		const code = text.charCodeAt(i);
		if (code < 0x80) bytes++;
		else if (code < 0x800) bytes += 2;
		else if (code >= 0xd800 && code <= 0xdbff &&
			i + 1 < text.length && text.charCodeAt(i + 1) >= 0xdc00 && text.charCodeAt(i + 1) <= 0xdfff) {
			bytes += 4;
			i++;
		} else bytes += 3;
		assertImportSize(bytes);
	}
}

/** Bound allocation before parsing, including millions of shallow empty arrays. */
function preflightJson(text: string): void {
	const frames: { object: boolean; key: boolean; items: number }[] = [];
	let values = 0;
	let quoted = false;
	let escaped = false;
	let primitive = false;
	const complex = () => { throw new ImportLimitError("import.err.tooComplex"); };
	const value = () => {
		if (++values > MAX_IMPORT_VALUES) complex();
		const parent = frames[frames.length - 1];
		if (parent && !parent.object && ++parent.items > MAX_IMPORT_COLLECTION) complex();
	};
	for (const char of text) {
		if (quoted) {
			if (escaped) escaped = false;
			else if (char === "\\") escaped = true;
			else if (char === '"') quoted = false;
			continue;
		}
		const parent = frames[frames.length - 1];
		if (char === '"') {
			if (parent?.object && parent.key) {
				if (++parent.items > MAX_IMPORT_COLLECTION) complex();
			} else value();
			quoted = true;
		} else if (char === "{" || char === "[") {
			value();
			frames.push({ object: char === "{", key: char === "{", items: 0 });
			if (frames.length > MAX_IMPORT_DEPTH) complex();
		} else if (char === "}" || char === "]") frames.pop();
		else if (char === ":") { if (parent) parent.key = false; }
		else if (char === ",") { if (parent?.object) parent.key = true; }
		else if (char !== " " && char !== "\n" && char !== "\r" && char !== "\t" && char !== "\uFEFF") {
			if (!primitive) value();
			primitive = true;
			continue;
		}
		primitive = false;
	}
}

/** Braces/commas inside strings are data; JSON.parse still owns syntax checking. */
export function parseImportJson(text: string): unknown {
	assertImportTextSize(text);
	preflightJson(text);
	// A BOM from a text editor is harmless, unlike malformed JSON syntax.
	const raw: unknown = JSON.parse(text.replace(/^\uFEFF/, ""));
	assertImportStructure(raw);
	return raw;
}

/**
 * Iterative and bounded even for direct callers. JSON has no getters or cycles;
 * reject them here rather than executing a getter or recursing indefinitely.
 */
export function assertImportStructure(raw: unknown): void {
	const pending = [{ value: raw, depth: 0 }];
	let values = 0;
	let characters = 0;
	while (pending.length) {
		const { value, depth } = pending.pop()!;
		if (++values > MAX_IMPORT_VALUES) throw new ImportLimitError("import.err.tooComplex");
		if (typeof value === "string") characters += value.length;
		if (value !== null && typeof value === "object") {
			// Depth bounds terminate cycles, while harmless shared references remain
			// valid for callers passing objects rather than JSON text.
			if (depth >= MAX_IMPORT_DEPTH) throw new ImportLimitError("import.err.tooComplex");
			if (Array.isArray(value) && value.length > MAX_IMPORT_COLLECTION) throw new ImportLimitError("import.err.tooComplex");
			const keys = Object.keys(value);
			if (keys.length > MAX_IMPORT_COLLECTION) throw new ImportLimitError("import.err.tooComplex");
			for (const key of keys) {
				characters += key.length;
				const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
				if (!("value" in descriptor)) throw new ImportLimitError("import.err.tooComplex");
				pending.push({ value: descriptor.value as unknown, depth: depth + 1 });
			}
		}
		assertImportSize(characters);
	}
}
