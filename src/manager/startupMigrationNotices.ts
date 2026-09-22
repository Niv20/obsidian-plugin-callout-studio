import { trackAutocompleteEnablement } from "./autocompleteEnablementNotice";
import { trackExternalCssRetirement } from "./externalCssRetirementNotice";

type Host = Parameters<typeof trackAutocompleteEnablement>[0] &
	Parameters<typeof trackExternalCssRetirement>[0];

/** Subscribe all migration notices before load and release them together. */
export function trackStartupMigrationNotices(host: Host): () => void {
	const showAutocomplete = trackAutocompleteEnablement(host);
	const showExternalCss = trackExternalCssRetirement(host);
	return () => {
		showAutocomplete();
		showExternalCss();
	};
}
