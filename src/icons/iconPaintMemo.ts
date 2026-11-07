/**
 * icons/iconPaintMemo.ts — what a sweep last painted into an icon slot, so the
 * next sweep can leave a slot that already shows it.
 *
 * Who uses it. `CSSInjector.paintIcons`, which runs after every stylesheet
 * pass — every save, every icon download, and every `css-change` in the vault,
 * each step of a Style Settings drag included — over every callout and every
 * token in every open window. It used to replace each icon's DOM with an
 * identical copy every time: one DOM write per callout on screen per pass, and
 * the restyle and relayout of every callout title that followed, for nothing.
 *
 * The main idea. A slot is left alone only when two things hold: the key is
 * the one it was painted with, and the node that paint put there is still its
 * only child. The second is what keeps this honest — whatever else rewrites
 * the slot (a re-render, core restoring its own icon, another painter) leaves
 * a different node, and the slot is painted as before. The keys come from the
 * functions the Live Preview widgets already trust to say when their icon DOM
 * is current (`iconRenderKey`, `tokenIconKey`), plus whatever else the caller
 * bakes in (a colour, a size).
 *
 * A paint that left nothing checkable — a placeholder, a failure, an icon
 * drawn as a class on the slot rather than a child — records nothing, so it is
 * tried again on the next sweep, as every slot used to be.
 */
export class IconPaintMemo {
	private readonly painted = new WeakMap<HTMLElement, { key: string; node: ChildNode }>();

	/** Whether `slot` still shows what painting it with `key` would. */
	holds(slot: HTMLElement, key: string): boolean {
		const last = this.painted.get(slot);
		return last !== undefined && last.key === key && slot.childNodes.length === 1 && slot.firstChild === last.node;
	}

	/**
	 * Note what `slot` shows now that it has been painted with `key`, or, with
	 * `null` (the paint did not finish, or its result is not to be trusted),
	 * forget it so the next sweep paints it again.
	 */
	record(slot: HTMLElement, key: string | null): void {
		const node = slot.childNodes.length === 1 ? slot.firstChild : null;
		if (key === null || node === null) this.painted.delete(slot);
		else this.painted.set(slot, { key, node });
	}

	/** Forget `slot`: someone other than these painters is drawing it now. */
	forget(slot: HTMLElement): void {
		this.painted.delete(slot);
	}
}
