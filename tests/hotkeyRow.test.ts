import { fakeDom } from "./support/fakeDom";
import assert from "node:assert";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { addHotkeyButton } from "../src/settings/command/hotkeyRow";

function buildButton(disabled: boolean): {
	button: HTMLButtonElement;
	log: string[];
} {
	const log: string[] = [];
	const app = {
		setting: {
			open: () => log.push("open"),
			openTabById: (id: string) => {
				log.push(`openTabById:${id}`);
				return { setQuery: (query: string) => log.push(`setQuery:${query}`) };
			},
		},
	} as unknown as App;
	const container = fakeDom.document.createElement("div");
	const button = addHotkeyButton(
		app,
		"Callout Studio",
		() => log.push("close"),
		container as unknown as HTMLElement,
		"Insert callout",
		disabled,
	);
	return { button, log };
}

const openedHotkeys = [
	"close",
	"open",
	"openTabById:hotkeys",
	"setQuery:Callout Studio: Insert callout",
];

describe("command hotkey button — changing enabled state in place", () => {
	it("opens the matching hotkey settings after an initially disabled button is enabled", () => {
		const { button, log } = buildButton(true);
		assert.strictEqual(button.disabled, true);
		button.dispatchEvent(new Event("click"));
		assert.deepStrictEqual(log, []);

		button.disabled = false;
		button.dispatchEvent(new Event("click"));
		assert.deepStrictEqual(log, openedHotkeys);
	});

	it("stops opening settings while disabled and works again when re-enabled", () => {
		const { button, log } = buildButton(false);
		assert.strictEqual(button.disabled, false);
		button.dispatchEvent(new Event("click"));
		assert.deepStrictEqual(log, openedHotkeys);
		log.length = 0;

		button.disabled = true;
		button.dispatchEvent(new Event("click"));
		assert.deepStrictEqual(log, []);

		button.disabled = false;
		button.dispatchEvent(new Event("click"));
		assert.deepStrictEqual(log, openedHotkeys);
	});
});
