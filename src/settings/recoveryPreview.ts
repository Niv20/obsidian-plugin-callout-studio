import { setIcon, type Component } from "obsidian";
import { t } from "../i18n";
import { renderIconInto } from "../icons/renderIcon";
import { packFor } from "../icons/registry";
import { followsCalloutColor } from "../icons/packs/userImages";
import { sanitizeUserSvg, svgToDataUri } from "../icons/svg";
import type { IconResolver } from "../icons/types";
import { bgProps } from "../manager/css/backgroundProps";
import { iconBoxWidth } from "../manager/css/iconBox";
import type { CalloutDefinition, CalloutIcon, PluginData, UserImageIcon } from "../types";
import { bgGradientCss, isValidHexColor, sanitizeBgGradient } from "../utils/colorUtils";
import { mergeGlobalStyle } from "../utils/globalStyleMerge";
import { resolveIconAdjust } from "../utils/iconAdjust";
import { clampGlobalStyle } from "../utils/settingsGuards";

/** Snapshot-only lookup: a missing saved drawing must not borrow today's pack. */
export function recoveryIconResolver(data: Partial<PluginData>): IconResolver {
	return {
		resolveSvg(icon, role) {
			if (icon.type === "image") return null;
			const pack = packFor(icon);
			if (!pack) return null;
			const variant = pack.cacheVariant(icon, role);
			const cached = data.iconSvgCache?.find(entry => entry.pack === icon.type &&
				entry.name === icon.value && entry.variant === variant);
			if (cached) return cached.svg;
			if (icon.type !== "material") return null;
			return data.materialSvgCache?.find(entry => entry.name === icon.value &&
				`${entry.style}|${entry.weight}` === variant)?.svg ?? null;
		},
		hasFailed: () => false,
	};
}

/** Revalidate visual values even when showing an older, only partially readable setup. */
export function previewDefinition(definition: CalloutDefinition): CalloutDefinition {
	const color = (value: unknown): string | undefined => isValidHexColor(value) ? value : undefined;
	return {
		...definition,
		colorLight: color(definition.colorLight) ?? "#7d7d7d",
		colorDark: color(definition.colorDark) ?? "#7d7d7d",
		bgColorLight: color(definition.bgColorLight),
		bgColorDark: color(definition.bgColorDark),
		textColorLight: color(definition.textColorLight),
		textColorDark: color(definition.textColorDark),
		bgGradient: sanitizeBgGradient(definition.bgGradient) ?? undefined,
		transparentBg: definition.transparentBg === true ? true : undefined,
	};
}

function safeArtwork(svg: string): ReturnType<typeof sanitizeUserSvg> {
	try { return sanitizeUserSvg(svg); } catch { return null; }
}

function unavailable(parent: HTMLElement): void {
	parent.createSpan({ cls: "cs-recovery-preview-unavailable", text: t("recovery.details.previewUnavailable") });
}

/** An image document isolates saved SVG styles/ids from both the modal and its other side. */
export function renderRecoveryImage(parent: HTMLElement, image: UserImageIcon): void {
	const artwork = safeArtwork(image.svg);
	if (!artwork) { unavailable(parent); return; }
	parent.createEl("img", {
		cls: "cs-recovery-image",
		attr: {
			src: `data:image/svg+xml,${encodeURIComponent(artwork.svg)}`,
			alt: image.name,
			loading: "lazy",
		},
	});
}

/**
 * One icon drawn from a snapshot's own saved artwork, never from the live packs.
 * Shared by the block preview and by the comparison's icon values, so both
 * sides of a row always agree on what an icon looked like in that setup.
 */
export function renderRecoveryIcon(parent: HTMLElement, data: Partial<PluginData>, value: CalloutIcon): HTMLElement {
	const icon = parent.createSpan({ cls: "cs-recovery-preview-icon", attr: { "aria-hidden": "true" } });
	if (value.type !== "image") {
		const result = renderIconInto(icon, value, recoveryIconResolver(data), {
			role: "regular", fill: "currentColor", missing: { kind: "placeholder", lucideId: "image-off" },
		});
		if (result !== "painted") icon.setAttribute("aria-label", t("recovery.details.previewUnavailable"));
		return icon;
	}
	// The shared painter reads the live image pack. A recovery side must instead
	// resolve and recolor its own saved image without replacing that global pack.
	const picture = data.settings?.userImages?.find(image => image.id === value.value);
	const artwork = picture ? safeArtwork(picture.svg) : null;
	if (!picture || !artwork) {
		setIcon(icon, "image-off");
		icon.setAttribute("aria-label", t("recovery.details.previewUnavailable"));
		return icon;
	}
	icon.setCssProps({ width: iconBoxWidth({ ...picture, width: artwork.width, height: artwork.height }) });
	if (followsCalloutColor(value, picture)) {
		icon.addClass("is-mask");
		icon.setCssProps({ "--cs-recovery-icon-mask": svgToDataUri(artwork.svg) });
	} else {
		icon.createEl("img", { attr: { src: `data:image/svg+xml,${encodeURIComponent(artwork.svg)}`, alt: "" } });
	}
	return icon;
}

function renderSnapshotIcon(parent: HTMLElement, data: Partial<PluginData>, def: CalloutDefinition): void {
	const icon = renderRecoveryIcon(parent, data, def.icon);
	const adjust = resolveIconAdjust(def, "regular");
	icon.setCssProps({ transform: `translate(${adjust.offsetX}px, ${adjust.offsetY}px) scale(${adjust.size})` });
}

/**
 * Representative block preview, isolated from the running registry's selectors.
 * Snapshot colors/frame/artwork are rendered in the current light/dark mode;
 * theme-owned CSS and note-specific markdown are intentionally not reconstructed.
 */
export function renderRecoveryPreview(
	parent: HTMLElement,
	data: Partial<PluginData>,
	definition: CalloutDefinition,
	component: Component,
): void {
	const def = previewDefinition(definition);
	const mode = parent.closest(".theme-dark") ? "dark" : "light";
	const accent = mode === "dark" ? def.colorDark : def.colorLight;
	const style = clampGlobalStyle(mergeGlobalStyle(data.settings?.globalStyle));
	const preview = parent.createDiv("cs-recovery-preview");
	// These declarations come from the same pure background generator used by
	// real callouts; every interpolated saved color has been validated above.
	preview.setAttribute("style", bgProps(def, mode).join("\n"));
	preview.setCssProps({
		"--cs-recovery-accent": accent,
		"--cs-recovery-radius": `${style.borderRadius}px`,
		"--cs-recovery-border-color": def.transparentBg ? "transparent" : `color-mix(in srgb, ${accent} 25%, transparent)`,
		"--cs-recovery-border-width": ["top", "right", "bottom", "left"].map(side =>
			`${style.borderSides[side as keyof typeof style.borderSides] ? style.borderWidth : 0}px`).join(" "),
	});
	const title = preview.createDiv("cs-recovery-preview-title");
	title.setCssProps({ color: accent });
	if (def.hideIcon !== true) renderSnapshotIcon(title, data, def);
	const name = title.createSpan({ cls: "cs-recovery-preview-title-text", text: def.displayName || def.id });
	name.setCssProps({ "--cs-recovery-title-size": `${style.titleScale}em` });
	const gradient = def.bgGradient;
	const textEnd = mode === "dark" ? gradient?.textToColorDark : gradient?.textToColorLight;
	if (gradient?.textGradient && textEnd) {
		name.addClass("is-gradient");
		name.setCssProps({ "--cs-recovery-title-gradient": bgGradientCss(accent, textEnd, gradient) });
	}
	const content = preview.createDiv({ cls: "cs-recovery-preview-content", text: t("recovery.details.previewBody") });
	content.setCssProps({
		"--cs-recovery-content-color": (mode === "dark" ? def.textColorDark : def.textColorLight) ?? "var(--text-normal)",
		"--cs-recovery-content-size": `${style.contentScale}em`,
	});
	if (style.alignContentWithTitle && def.hideIcon !== true) {
		const picture = data.settings?.userImages?.find(image => def.icon.type === "image" && image.id === def.icon.value);
		const artwork = picture ? safeArtwork(picture.svg) : null;
		const width = iconBoxWidth(picture && artwork ? { ...picture, width: artwork.width, height: artwork.height } : undefined);
		content.setCssProps({ "--cs-recovery-content-indent": `calc(${width} + var(--cs-regular-icon-gap, 0.15em) + var(--size-4-1, 4px))` });
	}
	if (def.foldable !== true) return;
	const fold = title.createEl("button", { cls: "cs-recovery-preview-fold clickable-icon", attr: { type: "button", "aria-label": def.displayName || def.id } });
	setIcon(fold, "chevron-down");
	let collapsed = def.defaultFolded === true;
	const applyFold = (): void => {
		fold.setAttribute("aria-expanded", String(!collapsed));
		fold.setCssProps({ transform: collapsed ? "rotate(-90deg)" : "none" });
		if (collapsed) content.hide(); else content.show();
	};
	applyFold();
	component.registerDomEvent(fold, "click", () => { collapsed = !collapsed; applyFold(); });
}
