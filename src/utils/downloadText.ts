/**
 * utils/downloadText.ts — hand text to the browser's download dialog, so it
 * lands wherever the user keeps their files rather than inside the vault.
 */
export function downloadText(text: string, filename: string, type = "application/json"): void {
	const blob = new Blob([text], { type });
	const url = URL.createObjectURL(blob);
	const a = createEl("a");
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}
