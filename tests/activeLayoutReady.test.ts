import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { onActiveLayoutReady } from "../src/manager/activeLayoutReady";

describe("queued layout-ready work", () => {
 it("runs for an active plugin but cannot reinstall after unload", () => {
  const queued: (() => void)[] = [];
  const host = {
   app: { workspace: { onLayoutReady: (cb: () => void) => queued.push(cb) } } as unknown as App,
   settingsWriter: { isDestroyed: false },
  };
  let attachments = 0;
  onActiveLayoutReady(host, () => { attachments++; });
  queued.shift()!(); assert.equal(attachments, 1);
  onActiveLayoutReady(host, () => { attachments++; });
  host.settingsWriter.isDestroyed = true;
  queued.shift()!(); assert.equal(attachments, 1);
 });
 it("handles Obsidian invoking an already-ready callback synchronously", () => {
  const host = {
   app: { workspace: { onLayoutReady: (cb: () => void) => cb() } } as unknown as App,
   settingsWriter: { isDestroyed: false },
  };
  let runs = 0;
  onActiveLayoutReady(host, () => { runs++; }); assert.equal(runs, 1);
  host.settingsWriter.isDestroyed = true;
  onActiveLayoutReady(host, () => { runs++; }); assert.equal(runs, 1);
 });
});
