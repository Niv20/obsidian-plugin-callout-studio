/** Keep a spaced ellipsis inside the description's CSS line limit. */
export function observeWelcomeDescriptions(list: HTMLElement, idPrefix: string): () => void {
	const descriptions = Array.from(list.querySelectorAll<HTMLElement>(".cs-welcome-video-description"))
		.map(element => ({ element, text: element.textContent ?? "" }));
	const view = list.ownerDocument.defaultView;
	if (!view || typeof view.ResizeObserver !== "function") return () => {};
	for (const [index, { element, text }] of descriptions.entries()) {
		const button = element.closest("button");
		if (!button) continue;
		const id = `${idPrefix}-description-${index}`;
		// The visible copy can shorten without losing the accessible description.
		button.createSpan({ text, attr: { id, hidden: "" } });
		button.setAttribute("aria-describedby", id);
		element.setAttribute("aria-hidden", "true");
	}
	const segmenter = typeof Intl.Segmenter === "function"
		? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : undefined;
	const sync = (): void => {
		for (const { element, text } of descriptions) {
			// A detached or hidden modal has no usable layout yet.
			if (!element.clientWidth || !element.clientHeight) continue;
			element.setText(text);
			const fits = (): boolean => element.scrollHeight <= element.clientHeight
				&& element.scrollWidth <= element.clientWidth;
			if (fits()) continue;
			const characters = segmenter
				? Array.from(segmenter.segment(text), part => part.segment) : Array.from(text);
			const shortened = (count: number): string => characters.slice(0, count).join("").trimEnd() + "\u00a0…";
			let low = 0, high = characters.length;
			while (low < high) {
				const middle = Math.ceil((low + high) / 2);
				element.setText(shortened(middle));
				if (fits()) low = middle;
				else high = middle - 1;
			}
			element.setText(shortened(low));
		}
	};
	const observer = new view.ResizeObserver(sync);
	for (const { element } of descriptions) observer.observe(element);
	sync();
	return () => observer.disconnect();
}
