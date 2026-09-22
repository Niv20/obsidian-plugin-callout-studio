/**
 * Presentation helpers for the icon picker's source menu.
 *
 * Catalog sizes are intentionally approximate: the menu only needs to convey
 * scale, not expose release bookkeeping. User-owned collections can opt into
 * exact counts because every item there is meaningful to the reader.
 */
import { setIcon } from "obsidian";

const APPROXIMATE_COUNT_STEP = 100;

export function formatIconCount(
	count: number,
	locale: string,
	exact: boolean,
): string {
	const format = (value: number, compact: boolean): string =>
		new Intl.NumberFormat(locale, {
			notation: compact ? "compact" : "standard",
			maximumFractionDigits: compact ? 1 : 0,
		}).format(value);

	if (exact || count < APPROXIMATE_COUNT_STEP) return format(count, false);
	const lowerBound =
		Math.floor(count / APPROXIMATE_COUNT_STEP) * APPROXIMATE_COUNT_STEP;
	return `${format(lowerBound, lowerBound >= 1_000)}+`;
}

export interface SourceMenuTitleOptions {
	label: string;
	description: string;
	count: number | undefined;
	locale: string;
	exactCount: boolean;
	notDownloaded: boolean;
	notDownloadedLabel: string;
	selected: boolean;
}

export function createSourceMenuTitle(
	options: SourceMenuTitleOptions,
): HTMLElement {
	const wrap = createDiv("cs-source-item");
	const text = wrap.createDiv("cs-source-text");
	const nameRow = text.createDiv("cs-source-name-row");
	nameRow.createSpan({ cls: "cs-source-name", text: options.label });

	if (options.notDownloaded) {
		nameRow.createSpan({
			cls: "cs-source-download-badge",
			text: options.notDownloadedLabel,
		});
	}

	const count =
		options.count === undefined
			? ""
			: ` · \u2068${formatIconCount(
					options.count,
					options.locale,
					options.exactCount,
				)}\u2069`;
	text.createSpan({
		cls: "cs-source-desc",
		text: `(${options.description}${count})`,
	});

	if (options.selected) {
		const check = wrap.createSpan({ cls: "cs-source-check" });
		setIcon(check, "check");
	}
	return wrap;
}
