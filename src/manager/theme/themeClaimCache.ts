/**
 * manager/theme/themeClaimCache.ts — the claim check's verdicts, remembered on
 * this device from one launch to the next.
 *
 * `ThemeClaimCheck` measures, a render and a task after the plugin starts,
 * whether the theme really draws the built-ins and the user's callouts it
 * names. Until it has, every one of them counts as the theme's, so a callout
 * the theme names without drawing (Catppuccin restates core's icon for every
 * built-in) lost this plugin's design for a moment at every launch and came
 * back when the check landed - a visible flash in any open note. Seeding the
 * verdicts from the last launch's answer for the same theme makes the first
 * stylesheet the right one; the check still runs and corrects anything that
 * moved.
 *
 * Kept like the startup CSS snapshot (`StartupStyleCache`): vault-scoped
 * `localStorage`, device only, never in the vault and never synced. It holds
 * callout ids and theme names, nothing else, for the last few themes used, so
 * switching between two of them does not flash either. Every read and write
 * degrades to "nothing remembered".
 */
import type { App } from "obsidian";

export const THEME_CLAIMS_STORAGE_KEY = "callout-studio-theme-claims-v1";

/** How many themes' verdicts are kept; the least recently measured goes first. */
const MAX_THEMES = 8;

/** Per attribute-form id: does the theme visibly draw it? */
export type ClaimVerdicts = Map<string, boolean>;

export interface ClaimVerdictStore {
	/** The verdicts last saved for `theme` (`themeSignature`), or `null`. */
	load(theme: string): ClaimVerdicts | null;
	save(theme: string, verdicts: ReadonlyMap<string, boolean>): void;
}

interface Stored {
	v: 1;
	/** Oldest first. */
	themes: Array<[string, Array<[string, boolean]>]>;
}

function parse(raw: string | null): Stored {
	const empty: Stored = { v: 1, themes: [] };
	if (!raw) return empty;
	try {
		const data = JSON.parse(raw) as Partial<Stored> | null;
		if (data?.v !== 1 || !Array.isArray(data.themes)) return empty;
		const themes = data.themes.filter(
			(entry): entry is [string, Array<[string, boolean]>] =>
				Array.isArray(entry) &&
				typeof entry[0] === "string" &&
				Array.isArray(entry[1]) &&
				entry[1].every(
					(pair) =>
						Array.isArray(pair) &&
						typeof pair[0] === "string" &&
						typeof pair[1] === "boolean",
				),
		);
		return { v: 1, themes };
	} catch {
		return empty;
	}
}

/**
 * The `localStorage` store. Mirrors `StartupStyleCache.scopedKey`: the
 * `${appId}-${key}` convention of `App.loadLocalStorage`, which needs a newer
 * Obsidian than this plugin's minimum.
 */
export function localClaimVerdicts(app: App): ClaimVerdictStore {
	const key = (): string | null => {
		try {
			const appId = (app as App & { appId?: string }).appId;
			const scope = appId ?? app.vault?.getName?.();
			return scope ? `${scope}-${THEME_CLAIMS_STORAGE_KEY}` : null;
		} catch {
			return null;
		}
	};
	const raw = (k: string): string | null => {
		try {
			return window.localStorage.getItem(k);
		} catch {
			return null;
		}
	};
	return {
		load(theme) {
			const k = key();
			if (!k) return null;
			const themes = parse(raw(k)).themes;
			// A version not read yet (`Name@`, before Obsidian has loaded the
			// theme's manifest) takes the newest entry for the same name; the
			// check that follows corrects it if the theme has moved on.
			const found = theme.endsWith("@")
				? [...themes].reverse().find(([name]) => name.startsWith(theme))
				: themes.find(([name]) => name === theme);
			return found ? new Map(found[1]) : null;
		},
		save(theme, verdicts) {
			const k = key();
			if (!k) return;
			const before = raw(k);
			const entry: [string, Array<[string, boolean]>] = [
				theme,
				[...verdicts].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
			];
			const themes = parse(before).themes.filter(([name]) => name !== theme);
			themes.push(entry);
			const text = JSON.stringify({ v: 1, themes: themes.slice(-MAX_THEMES) });
			// A re-check that found what the last one found writes nothing.
			if (text === before) return;
			try {
				window.localStorage.setItem(k, text);
			} catch {
				/* full or blocked storage: the next launch measures, as it would anyway */
			}
		},
	};
}
