/**
 * manager/css/previewRepaint.ts — which preview's rules ride in the preview
 * layer rather than the main sheet, and how a step of that preview repaints.
 *
 * Who uses it. `CSSInjector`, which owns one. Its `repaintPreview` and
 * `releasePreview` hand over to {@link PreviewRepaint.repaint} and
 * {@link PreviewRepaint.release}, and every ordinary pass asks
 * {@link PreviewRepaint.beginPass} which preview to leave out of the main
 * sheet and tells {@link PreviewRepaint.endPass} once it has written it.
 *
 * The main idea. A settings window's preview — the palette editor's stand-in
 * on every step of a colour drag, the callout editor's draft on every step of a
 * slider and every letter of a name — changes the rules of one callout. The
 * ordinary pass writes the whole stylesheet twice (three quarters of a
 * megabyte in a vault with 750 callouts) and makes Obsidian copy it into every
 * pop-out window; so the preview's rules live in `PreviewLayer`, a small sheet
 * of their own, the main sheet is left without them, and a step rewrites a few
 * hundred bytes, about a millisecond instead of about thirty.
 *
 * Two kinds of preview qualify:
 *
 * - **A reserved demo** (on a `RESERVED_DEMO_IDS` id: the callout editor's
 *   draft of any callout, and the style pages' demo) is the cheapest, because
 *   the main sheet never holds it, up or down: every pass leaves out its rules
 *   and its share of the global rules, reads the metadata colours without it,
 *   and keeps the fallback off every reserved id at all times. So the main
 *   sheet is the same text with the demo up or down, and putting it up, every
 *   step, and taking it down touch the layer alone: no pass at all, not even on
 *   the first call. Nothing in the notes can show it, so only the caller's
 *   `iconRoot` is swept for painted icons. The callout editor's draft also
 *   borrows the rules the rest of the page aims at its name
 *   (`borrowedCalloutRules.ts`).
 * - **Any other demo on an id of its own** (the palette editor's stand-in) only
 *   moves its own rules: the main sheet keeps the fallback and metadata rules,
 *   which name the demo's id like every other. The first call records it and
 *   runs one ordinary pass that leaves it out; every later call writes the layer
 *   alone, once the layer already carries the id (`PreviewLayer.owner`), the
 *   proof that the main sheet was built without it.
 *
 * Anything else — no preview, or a demo standing on a real callout's id —
 * takes the ordinary pass, so a repaint is safe to ask of any preview.
 *
 * Release is automatic: the first pass that finds no matching preview clears
 * the layer, so a settings window that never says it is done cannot leave the
 * main sheet short a callout.
 */
import type { App } from "obsidian";
import { RESERVED_DEMO_IDS } from "../../constants";
import type { CalloutDefinition } from "../../types";
import { obsidianCalloutAttrId } from "../../utils/calloutId";
import type { CalloutRegistry } from "../CalloutRegistry";
import { SNIPPET_BASENAME } from "../cssSnippetExport";
import { LEGACY_SNIPPET_NAME } from "../legacyStartupSnippet";
import { enabledSnippetStyles } from "../theme/customCssApi";
import { borrowedRulesCss, collectCalloutAimedRules, type CalloutAimedRule } from "./borrowedCalloutRules";
import { PREVIEW_EL_ID, PreviewLayer } from "./PreviewLayer";

/** Which kind of preview the layer holds — see the file header. */
type PreviewKind = "demo" | "reserved";

/** The preview a pass leaves out of the main sheet, and which kind it is. */
export interface LiftedPreview {
	def: CalloutDefinition;
	kind: PreviewKind;
}

/** What {@link PreviewRepaint} needs of the injector that owns it. */
export interface PreviewRepaintHost {
	readonly app: App;
	readonly registry: CalloutRegistry;
	/** The ordinary pass. */
	inject(): void;
	/** Sweep the painted icons under `root`. */
	paintIcons(root: ParentNode): void;
	/**
	 * Run `write` outside a pass, with the pass state the generators read set
	 * up as a pass would and put back afterwards.
	 */
	outsidePass(write: () => void): void;
	/** One callout's own rules. */
	calloutCss(def: CalloutDefinition): string;
	/** The global style rules for `def` alone, without the role frames. */
	globalCssFor(def: CalloutDefinition): string;
	/** This plugin's own `<style>` element, never read for borrowed rules. */
	ownStyleEl(): unknown;
	/** The main sheet is whole again with no pass to say so: snapshot it. */
	persistMainSheet(): void;
}

export class PreviewRepaint {
	/** Where the preview's own rules go while the main sheet leaves them out. */
	private readonly layer: PreviewLayer;
	/**
	 * The preview the main sheet was last written without (its kind, and its
	 * id then), or null when none has asked for that. Cleared by the first
	 * pass that finds the preview gone.
	 */
	private layered: { kind: PreviewKind; id: string } | null = null;
	/**
	 * The rules of the page's other stylesheets that mention `data-callout`,
	 * read when the callout editor's draft first needs them and dropped by the
	 * next pass, since a pass is what follows a theme, snippet or plugin
	 * stylesheet changing. See {@link borrowedRules}.
	 */
	private aimedRules: CalloutAimedRule[] | null = null;

	constructor(private readonly host: PreviewRepaintHost) {
		this.layer = new PreviewLayer(host.app);
	}

	/** Repaint after the registry's demo preview changed. */
	repaint(iconRoot?: ParentNode): void {
		const demo = this.host.registry.getDemoPreview();
		if (demo && RESERVED_DEMO_IDS.has(demo.id)) this.repaintReserved(demo, iconRoot);
		else if (demo) this.repaintDemo(demo, iconRoot);
		else this.host.inject();
	}

	/**
	 * Repaint after a preview was taken down (`setPreviewDefinition(null)`).
	 * A reserved demo was never in the main sheet, so only its layer goes, and
	 * nothing in the notes changed back; anything else takes the ordinary pass.
	 */
	release(): void {
		const held = this.layered;
		if (this.host.registry.hasPreviewDefinition() || (held !== null && held.kind !== "reserved")) {
			this.host.inject();
			return;
		}
		this.layered = null;
		this.layer.clear();
		// No pass, so none persists the sheet: a change made while the preview
		// was up skipped the snapshot, and the main sheet is whole again now.
		this.host.persistMainSheet();
	}

	/**
	 * For a pass about to build the main sheet: the preview it must leave out,
	 * if any. A reserved demo is left out whether or not anything asked for it.
	 * Also forgets the borrowed rules read so far: the page's stylesheets may
	 * have moved since.
	 */
	beginPass(): LiftedPreview | null {
		this.aimedRules = null;
		const demo = this.host.registry.getDemoPreview();
		if (demo && RESERVED_DEMO_IDS.has(demo.id)) return { def: demo, kind: "reserved" };
		const held = this.layered;
		if (held?.kind !== "demo" || demo?.id !== held.id) return null;
		return { def: demo, kind: "demo" };
	}

	/**
	 * After the pass wrote the main sheet: the lifted preview's rules go to the
	 * layer, after the main sheet so they win a tie as they would have inside
	 * it; with none, the layer is cleared. Written on every pass, not only when
	 * the main text moved: a theme switch moves what the preview's rules should
	 * say while its definition stands still. The layer skips the write itself
	 * when the text is unchanged.
	 */
	endPass(lifted: LiftedPreview | null): void {
		if (lifted) {
			this.write(lifted);
			this.layered = { kind: lifted.kind, id: lifted.def.id };
		} else {
			this.layered = null;
			this.layer.clear();
		}
	}

	/** Switch the layer off until the returned function runs. */
	suspend(): () => void {
		return this.layer.suspend();
	}

	destroy(): void {
		this.layer.destroy();
	}

	private repaintReserved(demo: CalloutDefinition, iconRoot: ParentNode | undefined): void {
		// Every pass leaves a reserved demo out, so the main sheet is already
		// right — unless the last pass lifted another demo, which kept its share
		// of the global rules in the main sheet.
		const held = this.layered;
		if (held !== null && held.kind !== "reserved") {
			this.host.inject();
			return;
		}
		this.host.outsidePass(() => this.write({ def: demo, kind: "reserved" }));
		this.layered = { kind: "reserved", id: demo.id };
		if (iconRoot) this.host.paintIcons(iconRoot);
	}

	private repaintDemo(demo: CalloutDefinition, iconRoot: ParentNode | undefined): void {
		// The layer is the proof the main sheet already leaves this id out: a
		// pass writes the layer only after building a main text without it.
		const held = this.layered;
		if (held?.kind !== "demo" || held.id !== demo.id || this.layer.owner !== demo.id) {
			this.layered = { kind: "demo", id: demo.id };
			this.host.inject();
			return;
		}
		this.host.outsidePass(() => this.write({ def: demo, kind: "demo" }));
		if (iconRoot) this.host.paintIcons(iconRoot);
	}

	/**
	 * Install a lifted preview's rules in the layer: a reserved demo's with its
	 * share of the global rules, which the main sheet leaves out for it, after
	 * the rules it borrows from the rest of the page; any other demo's alone,
	 * whose share stays in the main sheet.
	 */
	private write(lifted: LiftedPreview): void {
		const { def } = lifted;
		const own =
			lifted.kind === "demo"
				? this.host.calloutCss(def)
				: [this.borrowedRules(def), this.host.globalCssFor(def), this.host.calloutCss(def)]
						.filter((part) => part.length > 0)
						.join("\n\n");
		this.layer.write(def.id, own);
	}

	/**
	 * For the callout editor's draft: the rules the rest of the page aims at
	 * the name the draft will carry — a snippet's, a theme's family selector,
	 * Obsidian's own for a built-in — copied onto the placeholder id the draft
	 * is previewed under (see `borrowedCalloutRules.ts`). They lead the layer,
	 * as those sheets come before this plugin's in the page.
	 *
	 * Never from this plugin's own sheets, nor from its exported snippet (or
	 * the legacy one): those carry the saved callout, which the draft
	 * replaces, so a field the draft took away would come back from them.
	 */
	private borrowedRules(def: CalloutDefinition): string {
		const id = this.host.registry.previewDraftId(def);
		if (id === null) return "";
		if (this.aimedRules === null) {
			const doc = this.host.app.workspace.containerEl.ownerDocument;
			const skip = new Set<unknown>([this.host.ownStyleEl(), doc.getElementById?.(PREVIEW_EL_ID)]);
			for (const { name, el } of enabledSnippetStyles(this.host.app)) {
				if (name === SNIPPET_BASENAME || name === LEGACY_SNIPPET_NAME) skip.add(el);
			}
			const sheets = Array.from(doc.styleSheets ?? []).filter(
				(sheet) => !sheet.disabled && !skip.has(sheet.ownerNode),
			);
			this.aimedRules = collectCalloutAimedRules(sheets);
		}
		return borrowedRulesCss(this.aimedRules, obsidianCalloutAttrId(id), def.id);
	}
}
