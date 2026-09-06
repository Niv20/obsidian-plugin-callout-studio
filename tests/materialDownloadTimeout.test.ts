import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { downloadMaterialSvg } from "../src/icons/packs/material";
import { IconFetchManager } from "../src/icons/IconFetchManager";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import type { CSSInjector } from "../src/manager/CSSInjector";
import type { CalloutIcon } from "../src/types";

const seams = globalThis as unknown as {
 window: unknown;
 __CS_REQUEST_URL__?: (url: string) => Promise<{ text: string }>;
 __CS_NOTICES__?: string[];
};
const timers = new Map<number, { callback: () => void; delay: number }>();
let previousWindow: unknown;
let nextTimer = 0;
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));
function advanceTimer(delay: number): void {
 const entry = [...timers].find(([, timer]) => timer.delay === delay);
 assert.ok(entry, `expected a ${delay}ms timer`);
 timers.delete(entry[0]); entry[1].callback();
}
function icon(value: string): CalloutIcon { return { type: "material", value }; }
function host(names: string[]) {
 const registry = new CalloutRegistry(); registry.load(null);
 for (const name of names) registry.add({ id: name, displayName: name, icon: icon(name),
  colorLight: "#3b82f6", colorDark: "#3b82f6", foldable: true, defaultFolded: false,
  builtIn: false, source: "user",
 });
 let saves = 0; let injects = 0;
 const manager = new IconFetchManager({ registry,
  cssInjector: { inject: () => { injects++; } } as unknown as CSSInjector,
  saveSettings: async () => { saves++; },
 });
 return { manager, registry, effects: () => ({ saves, injects }) };
}

beforeEach(() => {
 previousWindow = seams.window; timers.clear(); nextTimer = 0;
 seams.window = {
  setTimeout: (callback: () => void, delay: number) => { const id = ++nextTimer; timers.set(id, { callback, delay }); return id; },
  clearTimeout: (id: number) => timers.delete(id),
 };
 seams.__CS_NOTICES__ = [];
});
afterEach(() => {
 seams.window = previousWindow;
 delete seams.__CS_REQUEST_URL__; delete seams.__CS_NOTICES__;
 timers.clear();
});

describe("Material download deadlines", () => {
 it("rejects a hung request and ignores its late response", async () => {
  let finish!: (value: { text: string }) => void;
  seams.__CS_REQUEST_URL__ = () => new Promise((resolve) => { finish = resolve; });
  const pending = downloadMaterialSvg("star", "outlined");
  const rejected = assert.rejects(pending, /timed out/);
  advanceTimer(30_000); await rejected;
  finish({ text: "late bytes must never be parsed" }); await settle();
  assert.equal(timers.size, 0);
 });
 it("clears the deadline when the request rejects before it", async () => {
  seams.__CS_REQUEST_URL__ = async () => { throw new Error("offline"); };
  await assert.rejects(downloadMaterialSvg("star", "outlined"), /offline/);
  assert.equal(timers.size, 0);
 });
 it("moves the startup sweep past a hung first icon", async () => {
  const requests: string[] = [];
  seams.__CS_REQUEST_URL__ = (url) => {
   requests.push(url);
   return requests.length === 1 ? new Promise(() => {}) : Promise.reject(new Error("offline"));
  };
  const { manager, effects } = host(["first", "second"]);
  const pending = manager.ensureAll(); advanceTimer(30_000); await pending;
  assert.equal(requests.length, 2);
  assert.ok(manager.hasFailed(icon("first"))); assert.ok(manager.hasFailed(icon("second")));
  assert.deepEqual(effects(), { saves: 0, injects: 0 }); assert.equal(timers.size, 0);
 });
 it("bounds all three picker attempts and allows a later retry", async () => {
  let requests = 0;
  seams.__CS_REQUEST_URL__ = () => { requests++; return new Promise(() => {}); };
  const { manager, effects } = host([]);
  const pending = manager.cacheOne(icon("star"));
  for (let attempt = 0; attempt < 3; attempt++) {
   advanceTimer(30_000); await settle();
   if (attempt < 2) { advanceTimer(2_000); await settle(); }
  }
  await pending;
  assert.equal(requests, 3); assert.ok(manager.hasFailed(icon("star")));
  assert.equal(seams.__CS_NOTICES__?.length, 1); assert.equal(timers.size, 0);
  assert.deepEqual(effects(), { saves: 0, injects: 0 });
  seams.__CS_REQUEST_URL__ = async () => { requests++; throw new Error("offline"); };
  const retry = manager.cacheOne(icon("star")); await settle();
  for (let attempt = 0; attempt < 2; attempt++) { advanceTimer(2_000); await settle(); }
  await retry; assert.equal(requests, 6); assert.equal(timers.size, 0);
 });
});
