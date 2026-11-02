/**
 * Presentation helpers for the icon picker's source menu.
 *
 * Catalog sizes are intentionally approximate: the menu only needs to convey
 * scale, not expose release bookkeeping. User-owned collections can opt into
 * exact counts because every item there is meaningful to the reader.
 */
const APPROXIMATE_COUNT_STEP = 100;

export function formatIconCount(count: number, locale: string, exact: boolean): string {
	const format = (value: number, compact: boolean): string =>
		new Intl.NumberFormat(locale, {
			notation: compact ? "compact" : "standard",
			maximumFractionDigits: compact ? 1 : 0,
		}).format(value);

	if (exact || count < APPROXIMATE_COUNT_STEP) return format(count, false);
	const lowerBound = Math.floor(count / APPROXIMATE_COUNT_STEP) * APPROXIMATE_COUNT_STEP;
	return `${format(lowerBound, lowerBound >= 1_000)}+`;
}

export interface SourceMenuTitleOptions {
	label: string;
	description: string;
	count: number | undefined;
	locale: string;
	exactCount: boolean;
}

/**
 * One library's row: its name, and under it what it holds and how much.
 *
 * Nothing on a row says whether the library is downloaded. The menu lists only
 * libraries this device can draw from — plus, under its own heading, the
 * library of the icon being edited — so a status on every row would only ever
 * repeat the heading above it.
 *
 * Nor does it draw the ✓ beside the chosen library: the shared dropdown adds
 * that to whichever row is committed (`appendComboboxCheck` in
 * `ui/listboxPopupDom.ts`), as it does in every other list in the plugin.
 */
export function createSourceMenuTitle(options: SourceMenuTitleOptions): HTMLElement {
	const wrap = createDiv("cs-source-item");
	const text = wrap.createDiv("cs-source-text");
	text.createSpan({ cls: "cs-source-name", text: options.label });

	const count =
		options.count === undefined
			? ""
			: ` (\u2068${formatIconCount(options.count, options.locale, options.exactCount)}\u2069)`;
	text.createSpan({
		cls: "cs-source-desc",
		text: `${options.description}${count}`,
	});
	return wrap;
}
