/**
 * manager/theme/ThemeFacts.ts — what the active theme does, held where every
 * renderer can reach it.
 *
 * Two facts, both **derived and never stored on a callout**, both published
 * from the theme layer and read back through `CalloutRegistry`:
 *
 * - **which ids the theme claims**, from `themeCalloutScan`'s text pass;
 * - **what it draws for them**, from `ThemeAppearanceProbe`'s live read.
 *
 * ## Why they live behind the registry
 *
 * Because every surface that draws a callout already has the registry, and
 * threading a theme store through the eight that draw an icon is eight chances
 * for one of them to keep drawing the stored one — which is exactly the bug
 * this replaced (`AutoComplete` tested the raw `externalStyle` field and so
 * missed every theme-owned callout). Holding them here rather than inside
 * `CalloutRegistry` keeps that file from growing a second responsibility, and
 * keeps this one honest: it never touches the DOM, it is handed plain data.
 *
 * ## Why the empty state is the right default
 *
 * `CalloutRegistry` takes no `App` and cannot see the theme when `load()` runs
 * — the first theme scan is dozens of lines later in `main.ts`. So for the
 * first moments of a session, and forever in a test, an import or a headless
 * run, nothing is owned. Standing **down** on that blank would silently strip
 * the styling from every callout the user has configured; standing up cannot
 * hurt anyone, because the worst case is the plugin painting a callout the
 * theme would also have painted, for one frame.
 */
import { obsidianCalloutAttrId } from "../../utils/calloutId";
import {
	sameThemeAppearances,
	UNKNOWN_APPEARANCE,
	type ThemeAppearance,
} from "./themeAppearance";
import type { CalloutDefinition } from "../../types";

export class ThemeFacts {
	private ownedIds: ReadonlySet<string> = new Set();
	private appearances: ReadonlyMap<string, ThemeAppearance> = new Map();

	/**
	 * Publish the ids the active theme claims, in attribute form.
	 *
	 * Returns `true` when the set actually moved, so the caller can skip a
	 * re-inject — which is a whole CSS regeneration plus a `localStorage` write.
	 */
	setOwnedIds(ids: ReadonlySet<string>): boolean {
		if (ids.size === this.ownedIds.size) {
			let same = true;
			for (const id of ids) {
				if (!this.ownedIds.has(id)) {
					same = false;
					break;
				}
			}
			if (same) return false;
		}
		this.ownedIds = new Set(ids);
		return true;
	}

	/**
	 * Publish a fresh set of measurements. Called by the probe.
	 *
	 * Returns `true` when the readings actually moved, exactly as
	 * {@link setOwnedIds} does and for the same reason: publishing is now an
	 * announced change, and announcing one that changed nothing costs a CSS
	 * regeneration, a settings save and a full settings-tab repaint. The
	 * `css-change → inject → sweep` chain terminates on this comparison —
	 * see the termination note in `themeRowSync.ts`.
	 */
	setAppearances(map: ReadonlyMap<string, ThemeAppearance>): boolean {
		if (sameThemeAppearances(this.appearances, map)) return false;
		this.appearances = map;
		return true;
	}

	/**
	 * Does the active theme supply or style this callout?
	 *
	 * Matches on **every id form** the callout answers to, aliases included. A
	 * theme that styles `[data-callout="tldr"]` but not `abstract` owns the
	 * whole callout: letting the two halves render differently is precisely the
	 * split this model exists to abolish.
	 */
	owns(def: CalloutDefinition, forms: readonly string[]): boolean {
		if (this.ownedIds.size === 0) return false;
		for (const form of forms) {
			if (this.ownedIds.has(obsidianCalloutAttrId(form))) return true;
		}
		return false;
	}

	/**
	 * How the theme paints `def`, or the unknown appearance when nothing has
	 * been measured for it.
	 *
	 * Callers must draw the unknown answer as a neutral placeholder. Falling
	 * back to `def.icon` or `def.colorLight` there would confidently show a
	 * design that is not on screen, which is the whole failure this replaces.
	 */
	appearanceOf(forms: readonly string[]): ThemeAppearance {
		for (const form of forms) {
			const found = this.appearances.get(obsidianCalloutAttrId(form));
			if (found) return found;
		}
		return UNKNOWN_APPEARANCE;
	}
}
