/** A JSON tree with ID-keyed lists, so unrelated rows and fields can merge. */
import { stableKeyOrder } from "../utils/stableJson";

export type Atom = ["object"] | ["list", string[]] | ["value", unknown];
export type Tree = Map<string, Atom>;
export const SYNC_KEY = "calloutStudioSync";
export const canonical = (value: unknown): string => JSON.stringify(stableKeyOrder(value));

export function content(data: unknown): Record<string, unknown> {
	const copy = JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
	delete copy[SYNC_KEY];
	return copy;
}

function itemKey(path: string[], value: unknown): string | undefined {
	if (!value || typeof value !== "object") return undefined;
	const row = value as Record<string, unknown>;
	if (path.length === 1 && path[0] === "iconSvgCache") {
		return canonical([row.pack, row.name, row.variant, row.style, row.weight]);
	}
	const name = path.join("/");
	if (name === "callouts" || ["customPalettes", "userImages", "customCommands"].some(key => name === `settings/${key}`) ||
		/^settings\/contextMenu\/items\/(regular|heading|inline)$/.test(name)) {
		return typeof row.id === "string" ? row.id : undefined;
	}
	return undefined;
}

function keyedList(path: string[], values: unknown[]): string[] | null {
	// Empty lists need the same representation as populated ones.
	if (values.length === 0) {
		return itemKey(path, { id: "", pack: "", name: "" }) !== undefined ? [] : null;
	}
	const keys = values.map(value => itemKey(path, value));
	return keys.every((key): key is string => key !== undefined) && new Set(keys).size === keys.length ? keys : null;
}

export function flatten(data: unknown): Tree {
	const tree: Tree = new Map();
	function visit(value: unknown, path: string[]): void {
		const key = JSON.stringify(path);
		// Pack, name and variant form one icon identity; mixing their fields
		// across devices can create an icon that exists in neither pack.
		if (path.length === 3 && path[0] === "callouts" && path[2] === "icon") {
			tree.set(key, ["value", value]); return;
		}
		if (Array.isArray(value)) {
			const ids = keyedList(path, value);
			if (ids) {
				tree.set(key, ["list", ids]);
				value.forEach((row, i) => visit(row, [...path, ids[i]!]));
			} else tree.set(key, ["value", value]);
		} else if (typeof value === "object" && value !== null) {
			tree.set(key, ["object"]);
			for (const [name, child] of Object.entries(value)) visit(child, [...path, name]);
		} else tree.set(key, ["value", value]);
	}
	visit(content(data), []);
	return tree;
}

export function inflate(tree: Tree): Record<string, unknown> {
	const children = new Map<string, string[]>();
	for (const key of tree.keys()) {
		const path = JSON.parse(key) as string[];
		if (!path.length) continue;
		const name = path.pop()!;
		const parent = JSON.stringify(path);
		const names = children.get(parent) ?? [];
		names.push(name); children.set(parent, names);
	}
	function visit(path: string[]): unknown {
		const key = JSON.stringify(path), atom = tree.get(key);
		if (!atom) return undefined;
		if (atom[0] === "value") return atom[1];
		const names = children.get(key) ?? [];
		if (atom[0] === "object") {
			return Object.fromEntries(names.sort().map(name => [name, visit([...path, name])]));
		}
		const order = atom[1];
		const sorted = [...order.filter(name => names.includes(name)), ...names.filter(name => !order.includes(name)).sort()];
		return sorted.map(name => visit([...path, name]));
	}
	return visit([]) as Record<string, unknown>;
}
