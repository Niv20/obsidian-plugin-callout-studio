/** Public Scope/Keymap contract used by modal keyboard integration tests. */
interface TestHandler {
	modifiers: readonly string[] | null;
	key: string | null;
	callback: (ev: KeyboardEvent) => unknown;
}
export class TestScope {
	private handlers: TestHandler[] = [];
	constructor(readonly parent?: TestScope) {}
	register(modifiers: readonly string[] | null, key: string | null, callback: (ev: KeyboardEvent) => unknown): TestHandler {
		const handler = { modifiers, key, callback };
		this.handlers.push(handler);
		return handler;
	}
	unregister(handler: TestHandler): void {
		this.handlers = this.handlers.filter((entry) => entry !== handler);
	}
	handle(event: KeyboardEvent): boolean | undefined {
		const modifiers = [event.ctrlKey && "Ctrl", event.metaKey && "Meta", event.altKey && "Alt", event.shiftKey && "Shift"].filter(Boolean);
		for (const handler of this.handlers) {
			if (handler.key !== null && handler.key !== event.key) continue;
			if (handler.modifiers !== null && (handler.modifiers.length !== modifiers.length ||
				!handler.modifiers.every((modifier) => modifiers.includes(modifier)))) continue;
			// A matching binding consumes lookup even when its callback returns
			// undefined. Only a scope with no matching binding inherits a parent.
			return handler.callback(event) === false ? false : true;
		}
		return this.parent?.handle(event);
	}
}

export class TestKeymap {
	readonly scopes: TestScope[] = [];
	pushScope(scope: TestScope): void { this.scopes.push(scope); }
	popScope(scope: TestScope): void {
		const at = this.scopes.indexOf(scope);
		if (at >= 0) this.scopes.splice(at, 1);
	}
	handle(event: KeyboardEvent): boolean | undefined {
		const result = this.scopes[this.scopes.length - 1]?.handle(event);
		if (result === false) event.preventDefault();
		return result;
	}
}
