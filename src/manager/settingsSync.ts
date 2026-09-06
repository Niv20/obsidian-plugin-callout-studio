/** Lamport registers survive offline edits, reordered delivery and restarts. */
import { syncFingerprint } from "./syncFingerprint";
import { canonical, content, flatten, inflate, SYNC_KEY, type Tree } from "./syncTree";

type Stamp = [number, string];
interface Metadata { version: 1 | 2; stamps: Record<string, Stamp>; fingerprint?: string }
interface State { tree: Tree; stamps: Record<string, Stamp> }
const ZERO: Stamp = [0, ""];

export function validSyncMetadata(value: unknown): boolean {
	if (value === undefined) return true;
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	const meta = value as Metadata;
	if ((meta.version !== 1 && meta.version !== 2) || !meta.stamps || typeof meta.stamps !== "object" || Array.isArray(meta.stamps)) return false;
	if (meta.version === 2 && (typeof meta.fingerprint !== "string" || !/^[a-f0-9]{16}$/.test(meta.fingerprint))) return false;
	return Object.entries(meta.stamps).every(([key, stamp]) => {
		try {
			const path: unknown = JSON.parse(key);
			return Array.isArray(path) && JSON.stringify(path) === key && path.length <= 64 && path.every(part => typeof part === "string") &&
				Array.isArray(stamp) && stamp.length === 2 && Number.isSafeInteger(stamp[0]) && stamp[0] >= 0 &&
				typeof stamp[1] === "string" && stamp[1].length <= 128;
		} catch { return false; }
	});
}

export function validSyncEnvelope(data: Record<string, unknown>): boolean {
	const meta = data[SYNC_KEY] as Metadata | undefined;
	return validSyncMetadata(meta) && (meta?.version !== 2 || meta.fingerprint === syncFingerprint(data, meta.stamps));
}

function read(data: unknown): State {
	if (!validSyncEnvelope(data as Record<string, unknown>)) throw new Error("Settings sync envelope does not match its content");
	const meta = (data as Record<string, unknown>)[SYNC_KEY] as Metadata | undefined;
	const stamps = structuredClone(meta?.stamps ?? {});
	// Earlier snapshots stamped icon subfields independently. Fold their
	// newest stamp into the indivisible icon identity when reading them.
	for (const [key, stamp] of Object.entries(stamps)) {
		const path = JSON.parse(key) as string[];
		if (path.length > 3 && path[0] === "callouts" && path[2] === "icon") {
			const parent = JSON.stringify(path.slice(0, 3));
			if (compare(stamp, stamps[parent] ?? ZERO) > 0) stamps[parent] = stamp;
			delete stamps[key];
		}
	}
	return { tree: flatten(data), stamps };
}

function compare(a: Stamp, b: Stamp): number {
	return a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0);
}

function serialize(state: State): Record<string, unknown> {
	const body = inflate(state.tree);
	return { ...body, [SYNC_KEY]: { version: 2, stamps: state.stamps, fingerprint: syncFingerprint(body, state.stamps) } };
}

function clock(state: State): number {
	return Object.values(state.stamps).reduce((max, stamp) => Math.max(max, stamp[0]), 0);
}

/** Only changed atoms receive a new stamp; a read never becomes an edit. */
function edited(base: State, data: unknown, actor: string): State {
	const tree = flatten(data), stamps = { ...base.stamps };
	const next = clock(base) + 1;
	if (!Number.isSafeInteger(next)) throw new Error("Settings sync clock exhausted");
	for (const key of new Set([...tree.keys(), ...base.tree.keys()])) {
		if (canonical(tree.get(key)) !== canonical(base.tree.get(key))) {
			Object.defineProperty(stamps, key, { value: [next, actor], enumerable: true, configurable: true, writable: true });
		}
	}
	return { tree, stamps };
}

function joined(a: State, b: State): State {
	const tree: Tree = new Map(), stamps: Record<string, Stamp> = {};
	const keys = new Set([...a.tree.keys(), ...b.tree.keys(), ...Object.keys(a.stamps), ...Object.keys(b.stamps)]);
	for (const key of keys) {
		const left = a.stamps[key] ?? ZERO, right = b.stamps[key] ?? ZERO;
		const comparison = compare(left, right);
		// Equal stamps occur in initial legacy snapshots. A stable tie-break
		// avoids depending on which device receives a file first.
		const winner = comparison > 0 || (comparison === 0 && (canonical(a.tree.get(key)) ?? "") >= (canonical(b.tree.get(key)) ?? "")) ? a : b;
		const atom = winner.tree.get(key);
		if (atom) tree.set(key, atom);
		const stamp = winner.stamps[key];
		if (stamp) stamps[key] = stamp;
	}
	return { tree, stamps };
}

export class SettingsSync {
	private state: State | null = null;
	private hasMetadata = false;
	constructor(private readonly actor: string = crypto.randomUUID()) {}

	adopt(data: unknown): void {
		this.state = read(data);
		this.hasMetadata = (data as Record<string, unknown>)[SYNC_KEY] !== undefined;
	}

	prepare(data: unknown): unknown {
		// No load/save baseline: preserve the existing fresh-install guard.
		const base = this.state ?? { tree: new Map(), stamps: {} };
		if (!this.hasMetadata && this.matchesContent(data)) return content(data);
		return serialize(edited(base, data, this.actor));
	}

	merge(incoming: unknown, local: unknown): unknown {
		if (!this.state) return incoming;
		const current = edited(this.state, local, this.actor);
		const remoteHasMetadata = (incoming as Record<string, unknown>)[SYNC_KEY] !== undefined;
		if (!remoteHasMetadata) {
			if (this.hasMetadata) return serialize(joined(current, read(incoming)));
			if (this.matchesContent(local)) return incoming;
			// An unstamped snapshot cannot undo recorded edits or deletions.
			// Before either side has metadata, use the observed legacy baseline
			// to merge unsaved work, or adopt an ordinary incoming-only change.
			const remote = edited(this.state, incoming, "legacy");
			return serialize(joined(current, remote));
		}
		return serialize(joined(current, read(incoming)));
	}

	matchesContent(data: unknown): boolean {
		return this.state !== null && canonical(content(data)) === canonical(inflate(this.state.tree));
	}
}
