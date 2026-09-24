import type { App } from "obsidian";
import type { PortableHeadingLinkCache } from "./portableHeadingLinks";
import type { PortableReplacements } from "./portableCalloutCustom";
import type { PortableCalloutConversionPlan, PortableCalloutSnapshot, PortableCalloutOutput } from "./portableCalloutPlan";

interface PortableCalloutApproval {
	app: App;
	entries: PortableCalloutSnapshot[];
	outputs: Map<string, PortableCalloutOutput>;
	headings: PortableHeadingLinkCache;
	replacements: PortableReplacements;
}

/** Internal provenance; a reconstructed public preview never authorizes a write. */
export const portableCalloutApprovals = new WeakMap<PortableCalloutConversionPlan, PortableCalloutApproval>();
