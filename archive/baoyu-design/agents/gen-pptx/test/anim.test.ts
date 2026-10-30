import { test } from "node:test";
import assert from "node:assert/strict";
import { effectiveDurationMs, parseAnimAttrs, parseAnimPath, pathToOoxml } from "../src/core/anim.ts";
import type { AnimPathSeg } from "../src/types.ts";

const attrs =
  (map: Record<string, string>) =>
  (name: string): string | null =>
    name in map ? map[name] : null;

test("parseAnimAttrs: full valid attribute set", () => {
  const { def, warnings } = parseAnimAttrs(
    attrs({
      "data-anim": "fly-in",
      "data-anim-trigger": "click",
      "data-anim-delay": "250",
      "data-anim-duration": "800",
      "data-anim-order": "3",
      "data-anim-dir": "left",
    }),
    7,
  );
  assert.deepEqual(warnings, []);
  assert.deepEqual(def, {
    effect: "fly-in",
    trigger: "click",
    delayMs: 250,
    durationMs: 800,
    order: 3,
    index: 7,
    dir: "left",
  });
});

test("parseAnimAttrs: per-effect defaults", () => {
  const fade = parseAnimAttrs(attrs({ "data-anim": "fade-in" }), 0).def;
  assert.equal(fade?.trigger, "after");
  assert.equal(fade?.delayMs, 0);
  assert.equal(fade?.durationMs, 500);
  assert.equal(fade?.order, 0);

  const spin = parseAnimAttrs(attrs({ "data-anim": "spin" }), 0).def;
  assert.equal(spin?.durationMs, 2000);
  assert.equal(spin?.rotateDeg, 360);

  const grow = parseAnimAttrs(attrs({ "data-anim": "grow" }), 0).def;
  assert.equal(grow?.scale, 1.5);
  const shrink = parseAnimAttrs(attrs({ "data-anim": "shrink" }), 0).def;
  assert.equal(shrink?.scale, 0.67);

  const fly = parseAnimAttrs(attrs({ "data-anim": "fly-in" }), 0).def;
  assert.equal(fly?.dir, "bottom");
});

test("parseAnimAttrs: unknown effect rejected, element stays static", () => {
  const { def, warnings } = parseAnimAttrs(attrs({ "data-anim": "spiral" }), 0);
  assert.equal(def, null);
  assert.match(warnings[0], /unknown data-anim effect "spiral"/);
});

test("parseAnimAttrs: bad trigger/dir fall back with warnings", () => {
  const { def, warnings } = parseAnimAttrs(
    attrs({ "data-anim": "fly-in", "data-anim-trigger": "hover", "data-anim-dir": "diagonal" }),
    0,
  );
  assert.equal(def?.trigger, "after");
  assert.equal(def?.dir, "bottom");
  assert.equal(warnings.length, 2);
});

test("parseAnimAttrs: delay/duration clamping and validation", () => {
  const a = parseAnimAttrs(
    attrs({ "data-anim": "fade-in", "data-anim-delay": "-5", "data-anim-duration": "999999" }),
    0,
  );
  assert.equal(a.def?.delayMs, 0); // negative → default with warning
  assert.equal(a.def?.durationMs, 60000); // clamped
  assert.equal(a.warnings.length, 1);

  // appear ignores duration entirely.
  const b = parseAnimAttrs(attrs({ "data-anim": "appear", "data-anim-duration": "700" }), 0);
  assert.equal(b.def?.durationMs, 1);
  assert.match(b.warnings[0], /ignored/);
});

test("parseAnimAttrs: no-op spin/scale dropped", () => {
  assert.equal(parseAnimAttrs(attrs({ "data-anim": "spin", "data-anim-rotate": "0" }), 0).def, null);
  assert.equal(parseAnimAttrs(attrs({ "data-anim": "grow", "data-anim-scale": "1" }), 0).def, null);
});

test("parseAnimAttrs: path requires data-anim-path", () => {
  const { def, warnings } = parseAnimAttrs(attrs({ "data-anim": "path" }), 0);
  assert.equal(def, null);
  assert.match(warnings[0], /requires data-anim-path/);
});

test("parseAnimAttrs: new-effect defaults", () => {
  const cases: Array<[string, number, string | undefined]> = [
    ["wipe-out", 500, "bottom"],
    ["float-in", 1000, "bottom"],
    ["float-out", 1000, "bottom"],
    ["split-in", 500, "vertical"],
    ["split-out", 500, "vertical"],
    ["bounce-in", 2000, undefined],
    ["bounce-out", 2000, undefined],
    ["wheel-in", 2000, undefined],
    ["wheel-out", 2000, undefined],
    ["random-bars-in", 500, "horizontal"],
    ["random-bars-out", 500, "horizontal"],
    ["blinds-in", 500, "horizontal"],
    ["blinds-out", 500, "horizontal"],
    ["checkerboard-in", 500, "horizontal"],
    ["checkerboard-out", 500, "horizontal"],
    ["dissolve-in", 500, undefined],
    ["dissolve-out", 500, undefined],
    ["box-in", 500, "in"],
    ["box-out", 500, "out"],
    ["circle-in", 500, "in"],
    ["circle-out", 500, "out"],
    ["diamond-in", 500, "in"],
    ["diamond-out", 500, "out"],
    ["plus-in", 500, "in"],
    ["plus-out", 500, "out"],
    ["strips-in", 500, "down-right"],
    ["strips-out", 500, "down-right"],
    ["wedge-in", 500, undefined],
    ["wedge-out", 500, undefined],
    ["pulse", 500, undefined],
    ["teeter", 1000, undefined],
  ];
  for (const [effect, dur, dir] of cases) {
    const { def, warnings } = parseAnimAttrs(attrs({ "data-anim": effect }), 0);
    assert.deepEqual(warnings, [], effect);
    assert.equal(def?.durationMs, dur, effect);
    assert.equal(def?.dir, dir, effect);
  }
  assert.equal(parseAnimAttrs(attrs({ "data-anim": "teeter" }), 0).def?.rotateDeg, 5);
  assert.equal(parseAnimAttrs(attrs({ "data-anim": "pulse" }), 0).def?.scale, 1.05);
});

test("parseAnimAttrs: per-family data-anim-dir validation", () => {
  // wipe-out takes all four edges like wipe-in.
  for (const d of ["left", "right", "top", "bottom"]) {
    const r = parseAnimAttrs(attrs({ "data-anim": "wipe-out", "data-anim-dir": d }), 0);
    assert.equal(r.def?.dir, d);
    assert.deepEqual(r.warnings, []);
  }
  // float is vertical-only: sides fall back with a family-specific warning.
  const f = parseAnimAttrs(attrs({ "data-anim": "float-in", "data-anim-dir": "left" }), 0);
  assert.equal(f.def?.dir, "bottom");
  assert.match(f.warnings[0], /for "float-in" \(top\|bottom\)/);
  // split takes axes, not edges.
  const s = parseAnimAttrs(attrs({ "data-anim": "split-in", "data-anim-dir": "horizontal" }), 0);
  assert.equal(s.def?.dir, "horizontal");
  assert.deepEqual(s.warnings, []);
  const bad = parseAnimAttrs(attrs({ "data-anim": "split-in", "data-anim-dir": "left" }), 0);
  assert.equal(bad.def?.dir, "vertical");
  assert.match(bad.warnings[0], /horizontal\|vertical/);
  const rb = parseAnimAttrs(attrs({ "data-anim": "random-bars-in", "data-anim-dir": "vertical" }), 0);
  assert.equal(rb.def?.dir, "vertical");
  // blinds/checkerboard share the axis family.
  const bl = parseAnimAttrs(attrs({ "data-anim": "blinds-in", "data-anim-dir": "vertical" }), 0);
  assert.equal(bl.def?.dir, "vertical");
  const cb = parseAnimAttrs(attrs({ "data-anim": "checkerboard-out", "data-anim-dir": "left" }), 0);
  assert.equal(cb.def?.dir, "horizontal");
  assert.match(cb.warnings[0], /horizontal\|vertical/);
  // box/circle/diamond/plus take in|out; entrance defaults in, exit out, and
  // either variant accepts the other's value.
  const bx = parseAnimAttrs(attrs({ "data-anim": "box-in", "data-anim-dir": "out" }), 0);
  assert.equal(bx.def?.dir, "out");
  assert.deepEqual(bx.warnings, []);
  const ci = parseAnimAttrs(attrs({ "data-anim": "circle-out", "data-anim-dir": "sideways" }), 0);
  assert.equal(ci.def?.dir, "out");
  assert.match(ci.warnings[0], /in\|out/);
  // strips takes the four corners.
  for (const d of ["down-right", "down-left", "up-right", "up-left"]) {
    const st = parseAnimAttrs(attrs({ "data-anim": "strips-in", "data-anim-dir": d }), 0);
    assert.equal(st.def?.dir, d);
    assert.deepEqual(st.warnings, []);
  }
  const sb = parseAnimAttrs(attrs({ "data-anim": "strips-out", "data-anim-dir": "left" }), 0);
  assert.equal(sb.def?.dir, "down-right");
  assert.match(sb.warnings[0], /down-right\|down-left\|up-right\|up-left/);
  // dir still means nothing on non-directional effects.
  const p = parseAnimAttrs(attrs({ "data-anim": "pulse", "data-anim-dir": "left" }), 0);
  assert.match(p.warnings[0], /no effect/);
  const wg = parseAnimAttrs(attrs({ "data-anim": "wedge-in", "data-anim-dir": "left" }), 0);
  assert.match(wg.warnings[0], /no effect/);
});

test("parseAnimAttrs: no-op pulse/teeter dropped like spin/grow", () => {
  assert.equal(parseAnimAttrs(attrs({ "data-anim": "teeter", "data-anim-rotate": "0" }), 0).def, null);
  assert.equal(parseAnimAttrs(attrs({ "data-anim": "pulse", "data-anim-scale": "1" }), 0).def, null);
});

test("parseAnimAttrs: data-anim-repeat matrix", () => {
  const spin = (extra: Record<string, string>) =>
    parseAnimAttrs(attrs({ "data-anim": "spin", ...extra }), 0);
  assert.equal(spin({}).def?.repeat, undefined); // absent
  assert.equal(spin({ "data-anim-repeat": "3" }).def?.repeat, 3);
  assert.equal(spin({ "data-anim-repeat": "1" }).def?.repeat, undefined); // 1 = play once
  assert.equal(spin({ "data-anim-repeat": "999" }).def?.repeat, 100); // clamped high, silent
  const zero = spin({ "data-anim-repeat": "0" });
  assert.equal(zero.def?.repeat, undefined);
  assert.match(zero.warnings[0], /invalid data-anim-repeat/);
  const junk = spin({ "data-anim-repeat": "x" });
  assert.equal(junk.def?.repeat, undefined);
  assert.equal(junk.warnings.length, 1);
  // Instant effects can't meaningfully repeat.
  const appear = parseAnimAttrs(attrs({ "data-anim": "appear", "data-anim-repeat": "3" }), 0);
  assert.equal(appear.def?.repeat, undefined);
  assert.match(appear.warnings[0], /ignored for "appear"/);
  // Repeat is fine on entrances/exits (setVis lands on the final iteration).
  assert.equal(
    parseAnimAttrs(attrs({ "data-anim": "fade-in", "data-anim-repeat": "2" }), 0).def?.repeat,
    2,
  );
});

test("parseAnimAttrs: data-anim-auto-reverse matrix", () => {
  const of = (effect: string, val: string | null) => {
    const map: Record<string, string> = { "data-anim": effect };
    if (effect === "path") map["data-anim-path"] = "L 100 0";
    if (val !== null) map["data-anim-auto-reverse"] = val;
    return parseAnimAttrs(attrs(map), 0);
  };
  // Bare attribute / "true" / "1" all switch it on for spin/grow/shrink/path.
  assert.equal(of("spin", "").def?.autoReverse, true);
  assert.equal(of("grow", "true").def?.autoReverse, true);
  assert.equal(of("path", "1").def?.autoReverse, true);
  // Off forms are silent no-ops.
  assert.equal(of("spin", "false").def?.autoReverse, undefined);
  assert.equal(of("spin", "0").warnings.length, 0);
  // Entrances/exits reject it with a warning; so do pulse/teeter (they
  // already return to base on their own).
  const fade = of("fade-in", "true");
  assert.equal(fade.def?.autoReverse, undefined);
  assert.match(fade.warnings[0], /only applies to spin\/grow\/shrink\/path/);
  const teeter = of("teeter", "true");
  assert.equal(teeter.def?.autoReverse, undefined);
  assert.match(teeter.warnings[0], /only applies to spin\/grow\/shrink\/path/);
  // Junk value warns.
  assert.match(of("spin", "maybe").warnings[0], /invalid data-anim-auto-reverse/);
});

test("effectiveDurationMs counts repeats and the reverse leg", () => {
  const base = parseAnimAttrs(attrs({ "data-anim": "fade-in" }), 0).def!;
  assert.equal(effectiveDurationMs(base), 500);
  const spun = parseAnimAttrs(
    attrs({ "data-anim": "spin", "data-anim-duration": "500", "data-anim-repeat": "3", "data-anim-auto-reverse": "true" }),
    0,
  ).def!;
  assert.equal(effectiveDurationMs(spun), 3000);
});

test("parseAnimPath: implicit M 0 0 and explicit M re-basing", () => {
  const implicit = parseAnimPath("L 200 -100 L 400 0");
  assert.ok(typeof implicit !== "string");
  assert.deepEqual(implicit.segs, [
    { c: "L", p: [200, -100] },
    { c: "L", p: [400, 0] },
  ]);

  // Explicit M shifts everything so the path starts at the element.
  const rebased = parseAnimPath("M 50 20 L 250 -80 C 300 -100 350 -100 450 20");
  assert.ok(typeof rebased !== "string");
  assert.deepEqual(rebased.segs, [
    { c: "L", p: [200, -100] },
    { c: "C", p: [250, -120, 300, -120, 400, 0] },
  ]);
});

test("parseAnimPath: comma separators, bad commands, truncation", () => {
  const commas = parseAnimPath("L 240,0");
  assert.ok(typeof commas !== "string");
  assert.deepEqual(commas.segs[0], { c: "L", p: [240, 0] });

  assert.match(parseAnimPath("L 10 10 Z") as string, /unsupported command "Z"/);
  assert.match(parseAnimPath("Q 1 2 3 4") as string, /unsupported command "Q"/);
  assert.match(parseAnimPath("L 10") as string, /needs 2 numbers/);
  assert.match(parseAnimPath("M 0 0") as string, /no L\/C segments/);

  // 33 line points → truncated to 32 with the flag set.
  const long = "L " + Array.from({ length: 33 }, (_, i) => `${i + 1} 0`).join(" L ");
  const t = parseAnimPath(long);
  assert.ok(typeof t !== "string");
  assert.equal(t.truncated, true);
  assert.equal(t.segs.length, 32);
});

test("pathToOoxml: slide-fraction conversion, fixed notation", () => {
  const segs: AnimPathSeg[] = [{ c: "L", p: [120, -36] }];
  assert.equal(pathToOoxml(segs, 1280, 720), "M 0 0 L 0.09375 -0.05000 E");

  // Tiny offsets stay fixed-notation (no 1e-7 exponents) and no negative zero.
  const tiny: AnimPathSeg[] = [{ c: "L", p: [0.0001, -0.0000001] }];
  const s = pathToOoxml(tiny, 1920, 1080);
  assert.ok(!/e/i.test(s.replace(/ E$/, "")), s);
  assert.equal(s, "M 0 0 L 0.00000 0.00000 E");

  const curve: AnimPathSeg[] = [{ c: "C", p: [100, -200, 300, -200, 400, 0] }];
  assert.equal(
    pathToOoxml(curve, 1000, 1000),
    "M 0 0 C 0.10000 -0.20000 0.30000 -0.20000 0.40000 0.00000 E",
  );
});
