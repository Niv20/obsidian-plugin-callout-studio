/**
 * Collapse the editor's concrete icon-adjustment form state back into the four
 * optional fields a CalloutDefinition stores. Shared by live preview and save:
 * the two must agree or the callout changes appearance when Save is pressed.
 */
import type { CalloutDefinition } from "../../types";
import {
	cloneIconAdjustFields,
	iconAdjustSourcesEqual,
	type IconAdjustSource,
} from "../../utils/iconAdjust";
import { hasAuthoredIconAdjust } from "./authoredStyle";

type ConcreteIconAdjustSource = IconAdjustSource & {
	iconOffsetX: number;
	iconOffsetY: number;
	iconSize: number;
};

export function definitionIconAdjustFields(
	state: ConcreteIconAdjustSource,
	baseline: CalloutDefinition | undefined,
	fallback: CalloutDefinition | undefined,
	builtInDefault: CalloutDefinition | undefined,
): IconAdjustSource {
	if (fallback) return cloneIconAdjustFields(fallback);
	if (builtInDefault && iconAdjustSourcesEqual(state, builtInDefault)) {
		// Render-equivalent is not storage-equivalent: explicit 0 / 0 / 1 still
		// marks a built-in modified. Restore the shipped raw shape exactly.
		return cloneIconAdjustFields(builtInDefault);
	}

	const authored = hasAuthoredIconAdjust(baseline, {
		offsetX: state.iconOffsetX,
		offsetY: state.iconOffsetY,
		size: state.iconSize,
	});
	return {
		iconAdjust: state.iconAdjust,
		iconOffsetX: authored ? state.iconOffsetX : undefined,
		iconOffsetY: authored ? state.iconOffsetY : undefined,
		iconSize: authored ? state.iconSize : undefined,
	};
}
