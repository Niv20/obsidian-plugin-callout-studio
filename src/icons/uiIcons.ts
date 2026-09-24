/*!
ISC License

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.

MIT License

Copyright (c) 2013-2023 Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
/**
 * Action icons composed from Lucide's paintbrush, plus, search and split.
 * Lucide / Feather licence notices: THIRD-PARTY-NOTICES.md.
 * The full-size brush is trimmed around each overlapping symbol at author time.
 * Plain paths avoid mask IDs colliding when Obsidian clones a registered icon.
 * Geometry uses a 24px canvas; registerUiIcons adapts it to Obsidian's 100px one.
 */
export const QUICK_INSERT_ICON_ID = "callout-studio-quick-insert";
export const STATISTICS_ICON_ID = "callout-studio-statistics";
export const PORTABLE_CONVERSION_ICON_ID = "callout-studio-portable-conversion";

// Keep Lucide's paintbrush contours up to the plain plus at (18.5, 18.5).
// Trim only their lower-right ends; the nearest 2px strokes stay about 1.3px apart.
const quickInsertBrush = `
  <path d="M11.9 17.154 3.942 14.984"/>
  <path d="M15.25 14.244 8.354 7.348a.5.5 0 0 1 0-.707l.944-.944a2.41 2.41 0 0 1 3.408 0l.944.944a.5.5 0 0 0 .707 0l4.019-4.019a1 1 0 1 1 3.002 3.002L17.36 9.643a.5.5 0 0 0 0 .707l.944.944"/>
  <path d="M9 8c-1.804 2.71-3.97 3.46-6.583 3.948a.507.507 0 0 0-.302.819l7.32 8.883a1 1 0 0 0 1.185.204C11.096 21.528 11.63 21.092 12.172 20.593"/>`;

// The search badge uses a 7.7px centerline cut around (16.5, 16.5), leaving
// about 1.7px beyond its 5px outer radius with the same 2px brush stroke.
const occurrencesBrush = `
  <path d="M8.802 16.31L3.942 14.984"/>
  <path d="M11.582 10.575L8.354 7.348C8.159 7.153 8.159 6.836 8.354 6.641L9.298 5.697C10.239 4.756 11.765 4.756 12.706 5.697L13.65 6.641C13.845 6.836 14.162 6.836 14.357 6.641L18.376 2.622C18.912 2.086 19.694 1.876 20.426 2.073C21.159 2.269 21.731 2.841 21.927 3.574C22.124 4.306 21.914 5.088 21.378 5.624L18.046 8.957"/>
  <path d="M9 8C7.196 10.71 5.03 11.46 2.417 11.948C2.241 11.98 2.094 12.103 2.032 12.271C1.97 12.44 2.002 12.628 2.115 12.767L9.435 21.65C9.74 21.974 10.224 22.058 10.62 21.854C10.688 21.807 10.757 21.758 10.828 21.707"/>`;

// Split keeps the same lower-right badge footprint. The handle's two open
// endpoints stay 3.6px from its arrowheads: 2px strokes leave a 1.6px clear gap.
// Coordinates scale Lucide's split by 1/2, then translate by (11.5, 11),
// without scaling its stroke or introducing per-instance SVG masks.
const conversionBrush = `
  <path d="M9.561 16.517L3.942 14.984"/>
  <path d="M10.722 9.715L8.354 7.348C8.159 7.153 8.159 6.836 8.354 6.641L9.298 5.697C10.239 4.756 11.765 4.756 12.706 5.697L13.65 6.641C13.845 6.836 14.162 6.836 14.357 6.641L18.376 2.622C18.912 2.086 19.694 1.876 20.426 2.073C21.159 2.269 21.731 2.841 21.927 3.574C22.124 4.306 21.914 5.088 21.378 5.624L17.503 9.5"/>
  <path d="M9 8C7.196 10.71 5.03 11.46 2.417 11.948C2.241 11.98 2.094 12.103 2.032 12.271C1.97 12.44 2.002 12.628 2.115 12.767L9.435 21.65C9.74 21.974 10.224 22.058 10.62 21.854C10.658 21.828 10.697 21.801 10.737 21.773"/>`;

const outline = (brush: string, badge: string): string =>
	`<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${brush}${badge}</g>`;

/** SVG inner markup, also used to export the editable standalone SVGs. */
export const UI_ICON_CONTENT: Readonly<Record<string, string>> = {
	[QUICK_INSERT_ICON_ID]: outline(quickInsertBrush, `
  <path d="M15 18.5h7M18.5 15v7"/>`),
	[STATISTICS_ICON_ID]: outline(occurrencesBrush, `
  <circle cx="16.5" cy="16.5" r="4"/>
  <path d="m19.3 19.3 2.7 2.7"/>`),
	[PORTABLE_CONVERSION_ICON_ID]: outline(conversionBrush, `
  <path d="M19.5 12.5H22V15"/>
  <path d="M15.5 12.5H13V15"/>
  <path d="M17.5 22v-4.15a2 2 0 0 0-.586-1.436L13 12.5"/>
  <path d="m19 15.5 3-3"/>`),
};
