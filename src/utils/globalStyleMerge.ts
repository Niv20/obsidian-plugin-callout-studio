/**
 * utils/globalStyleMerge.ts — rebuilding `globalStyle` from saved or imported
 * data.
 *
 * The shape half of the two-step `mergeSavedSettings` runs on the style tree:
 * this settles which fields exist, then `clampGlobalStyle` (`settingsGuards.ts`)
 * settles whether their numbers are sane. Split out of `settingsMerge.ts`
 * because it is the one section with a tree under it — three frame styles, each
 * with its own four border booleans — and spelling all of that out is most of
 * the file it came from.
 *
 * Every field is named, and that is the whole design. These were built by
 * spreading the saved object over the defaults, which is total in *shape* and
 * blind to anything extra the file carried: an unknown key rode straight
 * through, and since settings are written back wholesale by `toSaveData()` and
 * `exportToJSONv2()`, it was then re-saved forever and copied into every export
 * made afterwards. A retired field was `delete`d by name, which only ever
 * worked for the one field somebody remembered to name.
 */
import { DEFAULT_SETTINGS } from "../constants";
import { booleanPreference } from "./settingsGuards";
import type {
	BorderSidesSettings,
	GlobalStyleSettings,
	HeadingFrameStyleSettings,
	InlineFrameStyleSettings,
} from "../types";

/**
 * Merge the four per-side border booleans over a role's defaults.
 *
 * Shared by all three frame styles, which is the only reason it is a helper —
 * the point is the same one the rest of this file makes: the sides are named,
 * so a fifth key a file happens to carry is not one of them.
 */
function mergeBorderSides(
	saved: Partial<BorderSidesSettings> | undefined,
	defaults: BorderSidesSettings,
): BorderSidesSettings {
	return {
		top: booleanPreference(saved?.top, defaults.top),
		right: booleanPreference(saved?.right, defaults.right),
		bottom: booleanPreference(saved?.bottom, defaults.bottom),
		left: booleanPreference(saved?.left, defaults.left),
	};
}

/**
 * Merge a saved heading frame style over the defaults, field by field.
 *
 * Naming the fields is what retires `paddingStart` — the "Icon indent" slider,
 * a static 10px in styles.css since 2.7.0 — and, unlike the `delete` it
 * replaced, everything else a future version drops too.
 */
function mergeHeadingStyle(
	saved: Partial<HeadingFrameStyleSettings> | undefined,
): HeadingFrameStyleSettings {
	const defaults = DEFAULT_SETTINGS.globalStyle.heading;
	return {
		borderSides: mergeBorderSides(saved?.borderSides, defaults.borderSides),
		borderWidth: saved?.borderWidth ?? defaults.borderWidth,
		borderRadius: saved?.borderRadius ?? defaults.borderRadius,
		paddingTop: saved?.paddingTop ?? defaults.paddingTop,
		paddingBottom: saved?.paddingBottom ?? defaults.paddingBottom,
		marginTop: saved?.marginTop ?? defaults.marginTop,
	};
}

/** Merge a saved inline frame style over the defaults. See mergeHeadingStyle. */
function mergeInlineStyle(
	saved: Partial<InlineFrameStyleSettings> | undefined,
): InlineFrameStyleSettings {
	const defaults = DEFAULT_SETTINGS.globalStyle.inline;
	return {
		borderSides: mergeBorderSides(saved?.borderSides, defaults.borderSides),
		borderWidth: saved?.borderWidth ?? defaults.borderWidth,
		borderRadius: saved?.borderRadius ?? defaults.borderRadius,
		fontScale: saved?.fontScale ?? defaults.fontScale,
	};
}

/**
 * Merge a saved global (block callout) style, and the two role frame styles
 * nested under it, over the defaults.
 */
export function mergeGlobalStyle(
	saved: Partial<GlobalStyleSettings> | undefined,
): GlobalStyleSettings {
	const defaults = DEFAULT_SETTINGS.globalStyle;
	return {
		borderSides: mergeBorderSides(saved?.borderSides, defaults.borderSides),
		borderWidth: saved?.borderWidth ?? defaults.borderWidth,
		titleScale: saved?.titleScale ?? defaults.titleScale,
		contentScale: saved?.contentScale ?? defaults.contentScale,
		borderRadius: saved?.borderRadius ?? defaults.borderRadius,
		alignContentWithTitle:
			booleanPreference(saved?.alignContentWithTitle, defaults.alignContentWithTitle),
		heading: mergeHeadingStyle(saved?.heading),
		inline: mergeInlineStyle(saved?.inline),
	};
}
