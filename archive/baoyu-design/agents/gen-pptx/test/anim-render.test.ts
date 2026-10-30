// Animated subtrees must not be folded into a merged text box or a one-box
// list — the timing tree can only target shapes that actually exist.

import { test } from "node:test";
import assert from "node:assert/strict";
import { detectList } from "../src/render/list.ts";
import { extractTextRuns } from "../src/render/text-runs.ts";
import type { AnimationDef, SlideNode } from "../src/types.ts";

const fadeIn: AnimationDef = {
  effect: "fade-in",
  trigger: "after",
  delayMs: 0,
  durationMs: 500,
  order: 0,
  index: 0,
};

const el = (tag: string, over: Partial<SlideNode> = {}): SlideNode => ({
  tag,
  rect: { x: 0, y: 0, w: 100, h: 40 },
  style: {},
  children: [],
  ...over,
});

test("detectList: animated <li> disables the one-box list shortcut", () => {
  const li = (text: string): SlideNode => el("li", { text, style: { listStyleType: "disc" } });
  const plain = el("ul", { children: [li("one"), li("two")] });
  assert.deepEqual(detectList(plain), ["one", "two"]);

  const animated = el("ul", { children: [li("one"), { ...li("two"), anim: fadeIn }] });
  assert.equal(detectList(animated), null);
});

test("extractTextRuns: animated inline child is not absorbed as a run", () => {
  const span = (text: string): SlideNode => el("span", { text, style: { display: "inline" } });
  const plain = el("p", { children: [span("hello"), span("world")] });
  assert.equal(plain.children.length, extractTextRuns(plain).consumed.size);

  const animated = el("p", { children: [span("hello"), { ...span("world"), anim: fadeIn }] });
  const { consumed } = extractTextRuns(animated);
  assert.equal(consumed.size, 0, "no child may be consumed when a sibling subtree animates");
});

test("extractTextRuns: anim deeper in a child subtree also blocks absorption", () => {
  const inner = el("b", { text: "deep", style: { display: "inline" }, anim: fadeIn });
  const wrap = el("span", { style: { display: "inline" }, children: [inner] });
  const parent = el("p", { children: [wrap] });
  assert.equal(extractTextRuns(parent).consumed.size, 0);
});

test("merge gates fire for new effects and repeat/auto-reverse defs alike", () => {
  // The gates key off `anim` presence, not the effect — a teeter with repeat
  // and auto-reverse must block merging exactly like fade-in does.
  const teeter: AnimationDef = {
    effect: "teeter",
    trigger: "click",
    delayMs: 0,
    durationMs: 1000,
    order: 0,
    index: 2,
    rotateDeg: 5,
    repeat: 3,
    autoReverse: true,
  };
  const li = (text: string): SlideNode => el("li", { text, style: { listStyleType: "disc" } });
  assert.equal(detectList(el("ul", { children: [li("one"), { ...li("two"), anim: teeter }] })), null);

  const span = (text: string): SlideNode => el("span", { text, style: { display: "inline" } });
  const parent = el("p", { children: [span("hello"), { ...span("world"), anim: teeter }] });
  assert.equal(extractTextRuns(parent).consumed.size, 0);
});
