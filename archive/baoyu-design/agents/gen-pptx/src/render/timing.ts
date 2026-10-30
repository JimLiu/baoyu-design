// Builds the <p:timing> tree for one slide from the animation manifest. Pure
// string assembly — no zip, no DOM — so the exact OOXML is unit-testable. The
// output slots into the slide XML via VENDOR PATCH 1 (vendor/pptxgenjs).
//
// Structure (PowerPoint's own shape for a main-sequence build):
//   tmRoot par → mainSeq seq → one par per CLICK GROUP → one par per ANIMATION
//   (start offset within the group) → one "effect par" per target SHAPE
//   (presetID/presetClass/nodeType + the concrete behaviors).
// Every p:cTn carries a document-unique id; duplicate ids or an spTgt pointing
// at a nonexistent shape id make PowerPoint show its repair dialog.

import type { AnimationDef, AnimDir, AnimPathSeg } from "../types.ts";
import { effectiveDurationMs, pathToOoxml } from "../core/anim.ts";

/**
 * Bake auto-reverse (+ repeat) into the motion path itself: each cycle is the
 * forward segments followed by the same segments reversed (Bézier control
 * points swapped), landing back at the origin; repeat concatenates cycles.
 * PowerPoint's handling of repeatCount/autoRev on animMotion is unreliable,
 * but a longer continuous path plays everywhere. Only for auto-reversed
 * paths — a repeat-only path teleports back to its start each pass (SMIL
 * restart semantics), which a continuous path can't draw.
 */
export const unrollPathSegs = (segs: AnimPathSeg[], repeat: number): AnimPathSeg[] => {
  const starts: Array<[number, number]> = [];
  let cur: [number, number] = [0, 0];
  for (const s of segs) {
    starts.push(cur);
    cur = s.c === "L" ? [s.p[0], s.p[1]] : [s.p[4], s.p[5]];
  }
  const reversed: AnimPathSeg[] = [];
  for (let i = segs.length - 1; i >= 0; i--) {
    const s = segs[i];
    const [sx, sy] = starts[i];
    reversed.push(
      s.c === "L"
        ? { c: "L", p: [sx, sy] }
        : { c: "C", p: [s.p[2], s.p[3], s.p[0], s.p[1], sx, sy] },
    );
  }
  const cycle = [...segs, ...reversed];
  const out: AnimPathSeg[] = [];
  for (let k = 0; k < Math.max(1, repeat); k++) out.push(...cycle);
  return out;
};

export interface TimingAnim {
  def: AnimationDef;
  spids: number[];
}

/** The four edge values data-anim-dir can hold for fly/wipe/float effects
 *  (the parser guarantees the family per effect, so casts from AnimDir are safe). */
type EdgeDir = "left" | "right" | "top" | "bottom";
type AxisDir = "horizontal" | "vertical";
type ShapeDir = "in" | "out";
type CornerDir = "down-right" | "down-left" | "up-right" | "up-left";

// presetID/presetClass label the effect in PowerPoint's Animation Pane;
// playback comes from the behaviors. IDs verified against LibreOffice's
// oox preset table and ONLYOFFICE sdkjs (float 42/47 and split subtypes from
// real PowerPoint-authored XML). float's pid is dir-dependent — resolved in
// effectPar() — so its table rows carry the dir=bottom value.
const PRESET: Record<string, { pid: number; cls: string }> = {
  appear: { pid: 1, cls: "entr" },
  disappear: { pid: 1, cls: "exit" },
  "fade-in": { pid: 10, cls: "entr" },
  "fade-out": { pid: 10, cls: "exit" },
  "fly-in": { pid: 2, cls: "entr" },
  "fly-out": { pid: 2, cls: "exit" },
  "wipe-in": { pid: 22, cls: "entr" },
  "wipe-out": { pid: 22, cls: "exit" },
  "float-in": { pid: 42, cls: "entr" },
  "float-out": { pid: 42, cls: "exit" },
  "split-in": { pid: 16, cls: "entr" },
  "split-out": { pid: 16, cls: "exit" },
  "bounce-in": { pid: 26, cls: "entr" },
  "bounce-out": { pid: 26, cls: "exit" },
  "zoom-in": { pid: 23, cls: "entr" },
  "zoom-out": { pid: 23, cls: "exit" },
  "wheel-in": { pid: 21, cls: "entr" },
  "wheel-out": { pid: 21, cls: "exit" },
  "random-bars-in": { pid: 14, cls: "entr" },
  "random-bars-out": { pid: 14, cls: "exit" },
  "blinds-in": { pid: 3, cls: "entr" },
  "blinds-out": { pid: 3, cls: "exit" },
  "checkerboard-in": { pid: 5, cls: "entr" },
  "checkerboard-out": { pid: 5, cls: "exit" },
  "dissolve-in": { pid: 9, cls: "entr" },
  "dissolve-out": { pid: 9, cls: "exit" },
  "box-in": { pid: 4, cls: "entr" },
  "box-out": { pid: 4, cls: "exit" },
  "circle-in": { pid: 6, cls: "entr" },
  "circle-out": { pid: 6, cls: "exit" },
  "diamond-in": { pid: 8, cls: "entr" },
  "diamond-out": { pid: 8, cls: "exit" },
  "plus-in": { pid: 13, cls: "entr" },
  "plus-out": { pid: 13, cls: "exit" },
  "strips-in": { pid: 18, cls: "entr" },
  "strips-out": { pid: 18, cls: "exit" },
  "wedge-in": { pid: 20, cls: "entr" },
  "wedge-out": { pid: 20, cls: "exit" },
  spin: { pid: 8, cls: "emph" },
  grow: { pid: 6, cls: "emph" },
  shrink: { pid: 6, cls: "emph" },
  pulse: { pid: 26, cls: "emph" },
  teeter: { pid: 32, cls: "emph" },
  path: { pid: 0, cls: "path" },
};

// Fly/wipe presetSubtype direction flags (UI label only; motion comes from the
// behaviors): top=1 right=2 bottom=4 left=8.
const DIR_FLAG: Record<EdgeDir, number> = { top: 1, right: 2, bottom: 4, left: 8 };

// Split presetSubtypes (PowerPoint's Effect Options labels; verified from
// ONLYOFFICE's preset table): in { vertical 21, horizontal 26 },
// out { vertical 37, horizontal 42 }.
const SPLIT_SUBTYPE: Record<"split-in" | "split-out", Record<AxisDir, number>> = {
  "split-in": { vertical: 21, horizontal: 26 },
  "split-out": { vertical: 37, horizontal: 42 },
};

// Axis presetSubtypes shared by random-bars, blinds and checkerboard
// (horizontal/across 10, vertical/down 5 — ONLYOFFICE sdkjs apiDefines.js).
const AXIS_SUBTYPE: Record<AxisDir, number> = { horizontal: 10, vertical: 5 };

// Box/circle/diamond/plus presetSubtypes: the pattern closing in on the
// center is 16, growing out of it 32.
const SHAPE_SUBTYPE: Record<ShapeDir, number> = { in: 16, out: 32 };

// Strips presetSubtypes reuse the edge bitmask (top 1, right 2, bottom 4,
// left 8) summed per corner.
const CORNER_SUBTYPE: Record<CornerDir, number> = {
  "up-right": 3,
  "down-right": 6,
  "up-left": 9,
  "down-left": 12,
};

// Strips filter tokens by the corner the sweep travels toward.
const STRIPS_FILTER: Record<CornerDir, string> = {
  "down-right": "strips(downRight)",
  "down-left": "strips(downLeft)",
  "up-right": "strips(upRight)",
  "up-left": "strips(upLeft)",
};

// Checkerboard filter tokens: our axis dirs map to PowerPoint's across/down.
const CHECKER_FILTER: Record<AxisDir, string> = {
  horizontal: "checkerboard(across)",
  vertical: "checkerboard(down)",
};

// Wipe filter: named by the direction the reveal travels, so entering "from
// bottom" wipes upward. Exits reuse the same token with transition="out"
// (the reveal played backwards — the element erases toward data-anim-dir).
const WIPE_FILTER: Record<EdgeDir, string> = {
  bottom: "wipe(up)",
  top: "wipe(down)",
  left: "wipe(right)",
  right: "wipe(left)",
};

// Split ("barn door") filters — the long spellings are the only ones OOXML
// consumers recognize (barn(inVert) matches nothing).
const BARN_FILTER: Record<"split-in" | "split-out", Record<AxisDir, string>> = {
  "split-in": { vertical: "barn(inVertical)", horizontal: "barn(inHorizontal)" },
  "split-out": { vertical: "barn(outVertical)", horizontal: "barn(outHorizontal)" },
};

// Offscreen start coordinates for fly (normalized slide fractions; #ppt_x/#ppt_y
// are the shape's own resting center, #ppt_w/#ppt_h its size).
const FLY_FROM: Record<EdgeDir, { x: string; y: string }> = {
  left: { x: "0-#ppt_w/2", y: "#ppt_y" },
  right: { x: "1+#ppt_w/2", y: "#ppt_y" },
  top: { x: "#ppt_x", y: "0-#ppt_h/2" },
  bottom: { x: "#ppt_x", y: "1+#ppt_h/2" },
};

// Float drifts 0.1 slide-heights while fading (the offset PowerPoint itself
// writes for Float In); dir is the side the element drifts in from / out to.
const FLOAT_FROM: Record<"top" | "bottom", string> = {
  bottom: "#ppt_y+.1",
  top: "#ppt_y-.1",
};

// Bounce is approximated compositionally (PowerPoint's own preset is a page of
// sine formulas): enter from the left quarter with damped parabolic hops of
// 1/3, 1/9, 1/27, 1/81 slide heights (control-y = apex·4/3 makes each cubic a
// parabola); exit hops the same shape reversed, then plunges off the bottom.
const BOUNCE_IN_PATH =
  "M -0.25 -0.33333 C -0.195 -0.21 -0.14 -0.075 -0.085 0 C -0.064 -0.14815 -0.042 -0.14815 -0.021 0" +
  " C -0.0165 -0.04933 -0.012 -0.04933 -0.0075 0 C -0.005 -0.0164 -0.0025 -0.0164 0 0 E";
const BOUNCE_OUT_PATH =
  "M 0 0 C 0.0025 -0.0164 0.005 -0.0164 0.0075 0 C 0.012 -0.04933 0.0165 -0.04933 0.021 0" +
  " C 0.042 -0.14815 0.064 -0.14815 0.085 0 C 0.14 0.09 0.195 0.45 0.25 1.1 E";

export function buildTimingXml(anims: TimingAnim[], slideWpx: number, slideHpx: number): string {
  const live = anims.filter((a) => a.spids.length > 0);
  if (live.length === 0) return "";
  // data-anim-order first, document order breaking ties.
  const sorted = [...live].sort((a, b) => a.def.order - b.def.order || a.def.index - b.def.index);

  let idCounter = 0;
  const nid = (): number => ++idCounter;
  nid(); // 1 → tmRoot
  nid(); // 2 → mainSeq

  const setVis = (spid: number, val: "visible" | "hidden", delay: number): string =>
    `<p:set><p:cBhvr><p:cTn id="${nid()}" dur="1" fill="hold">` +
    `<p:stCondLst><p:cond delay="${delay}"/></p:stCondLst></p:cTn>` +
    `<p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl>` +
    `<p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr>` +
    `<p:to><p:strVal val="${val}"/></p:to></p:set>`;

  // Optional per-behavior start offset within the effect (SMIL stCondLst) —
  // teeter's chained rocks and bounce-out's late fade start mid-effect.
  const bhvrCTn = (dur: number, delay?: number, extra = ""): string =>
    delay
      ? `<p:cTn id="${nid()}" dur="${dur}" fill="hold"${extra}><p:stCondLst><p:cond delay="${delay}"/></p:stCondLst></p:cTn>`
      : `<p:cTn id="${nid()}" dur="${dur}" fill="hold"${extra}/>`;

  const animEffect = (
    spid: number,
    dir: "in" | "out",
    filter: string,
    dur: number,
    opts: { tmFilter?: string; delay?: number; extra?: string } = {},
  ): string =>
    `<p:animEffect transition="${dir}" filter="${filter}">` +
    `<p:cBhvr${opts.tmFilter ? ` tmFilter="${opts.tmFilter}"` : ""}>` +
    (opts.delay
      ? `<p:cTn id="${nid()}" dur="${dur}"${opts.extra ?? ""}><p:stCondLst><p:cond delay="${opts.delay}"/></p:stCondLst></p:cTn>`
      : `<p:cTn id="${nid()}" dur="${dur}"${opts.extra ?? ""}/>`) +
    `<p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl></p:cBhvr></p:animEffect>`;

  const flyAnim = (spid: number, attr: "ppt_x" | "ppt_y", from: string, to: string, dur: number): string =>
    `<p:anim calcmode="lin" valueType="num">` +
    `<p:cBhvr additive="base"><p:cTn id="${nid()}" dur="${dur}" fill="hold"/>` +
    `<p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl>` +
    `<p:attrNameLst><p:attrName>${attr}</p:attrName></p:attrNameLst></p:cBhvr>` +
    `<p:tavLst><p:tav tm="0"><p:val><p:strVal val="${from}"/></p:val></p:tav>` +
    `<p:tav tm="100000"><p:val><p:strVal val="${to}"/></p:val></p:tav></p:tavLst></p:anim>`;

  const animScaleFromTo = (spid: number, from: number, to: number, dur: number): string =>
    `<p:animScale><p:cBhvr><p:cTn id="${nid()}" dur="${dur}" fill="hold"/>` +
    `<p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl></p:cBhvr>` +
    `<p:from x="${from}" y="${from}"/><p:to x="${to}" y="${to}"/></p:animScale>`;

  // Relative scale (grow/shrink/pulse); extra lands on the behavior cTn
  // (autoRev / repeatCount — where PowerPoint's own writer puts them).
  const animScaleBy = (spid: number, by: number, dur: number, extra = ""): string =>
    `<p:animScale><p:cBhvr>` +
    bhvrCTn(dur, undefined, extra) +
    `<p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl></p:cBhvr>` +
    `<p:by x="${by}" y="${by}"/></p:animScale>`;

  // Relative rotation in 60000ths of a degree (spin's one turn, teeter's rocks).
  const animRotBy = (spid: number, by: number, dur: number, delay?: number, extra = ""): string =>
    `<p:animRot by="${by}"><p:cBhvr>` +
    bhvrCTn(dur, delay, extra) +
    `<p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl>` +
    `<p:attrNameLst><p:attrName>r</p:attrName></p:attrNameLst></p:cBhvr></p:animRot>`;

  // Motion along an OOXML slide-fraction path (custom data-anim-path + bounce).
  const animMotionPath = (spid: number, path: string, dur: number, extra = ""): string =>
    `<p:animMotion origin="layout" path="${path}" pathEditMode="relative" ptsTypes="">` +
    `<p:cBhvr>` +
    bhvrCTn(dur, undefined, extra) +
    `<p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl>` +
    `<p:attrNameLst><p:attrName>ppt_x</p:attrName><p:attrName>ppt_y</p:attrName></p:attrNameLst>` +
    `</p:cBhvr></p:animMotion>`;

  // repeatCount is in 1000ths; autoRev replays the leg backwards. These sit
  // on the MAIN behavior's cTn for single-behavior effects (spin, grow,
  // shrink, pulse, path) — a repeatCount on a container without an explicit
  // dur has no resolved simple duration and PowerPoint ignores it. Composite
  // effects instead get an inner wrapper par WITH dur (see effectPar).
  const repAttrs = (def: AnimationDef): string =>
    (def.repeat ? ` repeatCount="${def.repeat * 1000}"` : "") +
    (def.autoReverse ? ` autoRev="1"` : "");

  // Behaviors for one animation applied to one shape. `secondary` marks the
  // ride-along shapes of a multi-shape element (a card's text on top of its
  // background): the pattern-seeded filters (wheel, random-bars, blinds,
  // checkerboard, dissolve, box/circle/diamond/plus, strips, wedge) are
  // seeded per shape box in PowerPoint, so stacked shapes running them
  // independently clash — secondaries fade in step with the primary instead.
  const behaviors = (def: AnimationDef, spid: number, secondary = false): string => {
    const d = def.durationMs;
    const edge = (def.dir ?? "bottom") as EdgeDir;
    const axis = def.dir as AxisDir;
    const hide = setVis(spid, "hidden", Math.max(d - 1, 0));
    switch (def.effect) {
      case "appear":
        return setVis(spid, "visible", 0);
      case "disappear":
        return setVis(spid, "hidden", 0);
      case "fade-in":
        return setVis(spid, "visible", 0) + animEffect(spid, "in", "fade", d);
      case "fade-out":
        return animEffect(spid, "out", "fade", d) + hide;
      case "fly-in": {
        const from = FLY_FROM[edge];
        return (
          setVis(spid, "visible", 0) +
          flyAnim(spid, "ppt_x", from.x, "#ppt_x", d) +
          flyAnim(spid, "ppt_y", from.y, "#ppt_y", d)
        );
      }
      case "fly-out": {
        const to = FLY_FROM[edge];
        return (
          flyAnim(spid, "ppt_x", "#ppt_x", to.x, d) +
          flyAnim(spid, "ppt_y", "#ppt_y", to.y, d) +
          hide
        );
      }
      case "wipe-in":
        return setVis(spid, "visible", 0) + animEffect(spid, "in", WIPE_FILTER[edge], d);
      case "wipe-out":
        return animEffect(spid, "out", WIPE_FILTER[edge], d) + hide;
      case "float-in":
        return (
          setVis(spid, "visible", 0) +
          animEffect(spid, "in", "fade", d) +
          flyAnim(spid, "ppt_y", FLOAT_FROM[edge as "top" | "bottom"], "#ppt_y", d)
        );
      case "float-out":
        return (
          animEffect(spid, "out", "fade", d) +
          flyAnim(spid, "ppt_y", "#ppt_y", FLOAT_FROM[edge as "top" | "bottom"], d) +
          hide
        );
      case "split-in":
        return setVis(spid, "visible", 0) + animEffect(spid, "in", BARN_FILTER["split-in"][axis], d);
      case "split-out":
        return animEffect(spid, "out", BARN_FILTER["split-out"][axis], d) + hide;
      case "bounce-in":
        return (
          setVis(spid, "visible", 0) +
          animEffect(spid, "in", "fade", Math.max(1, Math.round(d * 0.32))) +
          animMotionPath(spid, BOUNCE_IN_PATH, d)
        );
      case "bounce-out":
        return (
          animMotionPath(spid, BOUNCE_OUT_PATH, d) +
          animEffect(spid, "out", "fade", Math.max(1, Math.round(d * 0.2)), { delay: Math.round(d * 0.8) }) +
          hide
        );
      case "zoom-in":
        // from 10% (not 0) — matches the preview approximation and avoids
        // degenerate zero-scale frames in some renderers.
        return setVis(spid, "visible", 0) + animEffect(spid, "in", "fade", d) + animScaleFromTo(spid, 10000, 100000, d);
      case "zoom-out":
        return animEffect(spid, "out", "fade", d) + animScaleFromTo(spid, 100000, 10000, d) + hide;
      case "wheel-in":
        return setVis(spid, "visible", 0) + animEffect(spid, "in", secondary ? "fade" : "wheel(1)", d);
      case "wheel-out":
        return animEffect(spid, "out", secondary ? "fade" : "wheel(1)", d) + hide;
      case "random-bars-in":
        return setVis(spid, "visible", 0) + animEffect(spid, "in", secondary ? "fade" : `randombar(${axis})`, d);
      case "random-bars-out":
        return animEffect(spid, "out", secondary ? "fade" : `randombar(${axis})`, d) + hide;
      case "blinds-in":
        return setVis(spid, "visible", 0) + animEffect(spid, "in", secondary ? "fade" : `blinds(${axis})`, d);
      case "blinds-out":
        return animEffect(spid, "out", secondary ? "fade" : `blinds(${axis})`, d) + hide;
      case "checkerboard-in":
        return setVis(spid, "visible", 0) + animEffect(spid, "in", secondary ? "fade" : CHECKER_FILTER[axis], d);
      case "checkerboard-out":
        return animEffect(spid, "out", secondary ? "fade" : CHECKER_FILTER[axis], d) + hide;
      case "dissolve-in":
        return setVis(spid, "visible", 0) + animEffect(spid, "in", secondary ? "fade" : "dissolve", d);
      case "dissolve-out":
        return animEffect(spid, "out", secondary ? "fade" : "dissolve", d) + hide;
      case "box-in":
      case "circle-in":
      case "diamond-in":
      case "plus-in": {
        const name = def.effect.slice(0, -3);
        const f = `${name}(${(def.dir ?? "in") as ShapeDir})`;
        return setVis(spid, "visible", 0) + animEffect(spid, "in", secondary ? "fade" : f, d);
      }
      case "box-out":
      case "circle-out":
      case "diamond-out":
      case "plus-out": {
        const name = def.effect.slice(0, -4);
        const f = `${name}(${(def.dir ?? "out") as ShapeDir})`;
        return animEffect(spid, "out", secondary ? "fade" : f, d) + hide;
      }
      case "strips-in":
        return (
          setVis(spid, "visible", 0) +
          animEffect(spid, "in", secondary ? "fade" : STRIPS_FILTER[(def.dir ?? "down-right") as CornerDir], d)
        );
      case "strips-out":
        return animEffect(spid, "out", secondary ? "fade" : STRIPS_FILTER[(def.dir ?? "down-right") as CornerDir], d) + hide;
      case "wedge-in":
        return setVis(spid, "visible", 0) + animEffect(spid, "in", secondary ? "fade" : "wedge", d);
      case "wedge-out":
        return animEffect(spid, "out", secondary ? "fade" : "wedge", d) + hide;
      case "spin":
        return animRotBy(spid, Math.round((def.rotateDeg ?? 360) * 60000), d, undefined, repAttrs(def));
      case "grow":
      case "shrink":
        return animScaleBy(spid, Math.round((def.scale ?? (def.effect === "grow" ? 1.5 : 0.67)) * 100000), d, repAttrs(def));
      case "pulse":
        // PowerPoint's own Pulse: a mid-effect fade dip (tmFilter) plus an
        // auto-reversed scale to the peak and back. The scale's cycle (up
        // d/2 + back d/2) spans d, so a user repeatCount keeps both
        // behaviors in lockstep.
        return (
          animEffect(spid, "out", "fade", d, { tmFilter: "0,0; .2,.5; .8,.5; 1,0", extra: repAttrs(def) }) +
          animScaleBy(spid, Math.round((def.scale ?? 1.05) * 100000), Math.max(1, Math.round(d / 2)), ` autoRev="1"` + repAttrs(def))
        );
      case "teeter": {
        // Five chained rocks summing to zero net rotation (+R −2R +2R −2R +R).
        const r = Math.round((def.rotateDeg ?? 5) * 60000);
        const t = (f: number): number => Math.round(d * f);
        return (
          animRotBy(spid, r, Math.max(1, t(0.1))) +
          animRotBy(spid, -2 * r, Math.max(1, t(0.2)), t(0.2)) +
          animRotBy(spid, 2 * r, Math.max(1, t(0.2)), t(0.4)) +
          animRotBy(spid, -2 * r, Math.max(1, t(0.2)), t(0.6)) +
          animRotBy(spid, r, Math.max(1, t(0.2)), t(0.8))
        );
      }
      case "path": {
        const segs = def.pathSegs ?? [];
        if (def.autoReverse) {
          // Baked into the geometry (see unrollPathSegs) — one long behavior
          // covering every out-and-back cycle, no repeat attributes needed.
          const unrolled = unrollPathSegs(segs, def.repeat ?? 1);
          return animMotionPath(spid, pathToOoxml(unrolled, slideWpx, slideHpx), effectiveDurationMs(def));
        }
        return animMotionPath(spid, pathToOoxml(segs, slideWpx, slideHpx), d, repAttrs(def));
      }
    }
  };

  // Effects whose behaviors() already carry repeatCount/autoRev on the main
  // behavior. Everything else repeats via an inner wrapper par with an
  // explicit dur (chained/misaligned behaviors — teeter's rocks, bounce's
  // early/late fades — must repeat as one unit).
  const BEHAVIOR_LEVEL_REPEAT = new Set(["spin", "grow", "shrink", "pulse", "path"]);

  // One effect par per target shape: the first carries the animation's trigger
  // nodeType, extra shapes ride along as withEffect so a multi-shape element
  // animates as one.
  const presetSubtype = (def: AnimationDef): number => {
    switch (def.effect) {
      case "fly-in":
      case "fly-out":
      case "wipe-in":
      case "wipe-out":
        return DIR_FLAG[(def.dir ?? "bottom") as EdgeDir];
      case "split-in":
      case "split-out":
        return SPLIT_SUBTYPE[def.effect][def.dir as AxisDir];
      case "random-bars-in":
      case "random-bars-out":
      case "blinds-in":
      case "blinds-out":
      case "checkerboard-in":
      case "checkerboard-out":
        return AXIS_SUBTYPE[def.dir as AxisDir];
      case "box-in":
      case "circle-in":
      case "diamond-in":
      case "plus-in":
        return SHAPE_SUBTYPE[(def.dir ?? "in") as ShapeDir];
      case "box-out":
      case "circle-out":
      case "diamond-out":
      case "plus-out":
        return SHAPE_SUBTYPE[(def.dir ?? "out") as ShapeDir];
      case "strips-in":
      case "strips-out":
        return CORNER_SUBTYPE[(def.dir ?? "down-right") as CornerDir];
      case "wheel-in":
      case "wheel-out":
        return 1; // spoke count
      default:
        return 0;
    }
  };

  const effectPar = (def: AnimationDef, spid: number, nodeType: string, secondary = false): string => {
    const preset = PRESET[def.effect];
    // Float's Animation-pane label depends on the drift side: Float Up
    // (rise/ascend) = 42, Float Down (descend) = 47 — same pair on both the
    // entrance and exit classes with our "drifts in from / out to" dir.
    const pid =
      (def.effect === "float-in" || def.effect === "float-out") && def.dir === "top" ? 47 : preset.pid;
    const parId = nid(); // mint before behaviors so ids read top-down
    let body = behaviors(def, spid, secondary);
    if (def.repeat && !BEHAVIOR_LEVEL_REPEAT.has(def.effect)) {
      body =
        `<p:par><p:cTn id="${nid()}" dur="${def.durationMs}" repeatCount="${def.repeat * 1000}" fill="hold">` +
        `<p:stCondLst><p:cond delay="0"/></p:stCondLst>` +
        `<p:childTnLst>${body}</p:childTnLst></p:cTn></p:par>`;
    }
    return (
      `<p:par><p:cTn id="${parId}" presetID="${pid}" presetClass="${preset.cls}" ` +
      `presetSubtype="${presetSubtype(def)}" fill="hold" grpId="0" nodeType="${nodeType}">` +
      `<p:stCondLst><p:cond delay="0"/></p:stCondLst>` +
      `<p:childTnLst>${body}</p:childTnLst>` +
      `</p:cTn></p:par>`
    );
  };

  const NODE_TYPE: Record<string, string> = { click: "clickEffect", with: "withEffect", after: "afterEffect" };

  // Group the sorted animations into click groups and schedule starts (ms
  // offsets from the group start): click opens a group at its own delay, with
  // co-starts with the previous animation, after chains behind the group's end.
  interface Group {
    auto: boolean; // opens without a click (deck-entry lead-in)
    items: { def: AnimationDef; spids: number[]; start: number }[];
  }
  const groups: Group[] = [];
  let prevStart = 0;
  let groupEnd = 0;
  for (const a of sorted) {
    const opens = groups.length === 0 || a.def.trigger === "click";
    if (opens) {
      groups.push({ auto: a.def.trigger !== "click", items: [] });
      prevStart = 0;
      groupEnd = 0;
    }
    const g = groups[groups.length - 1];
    const start = opens
      ? a.def.delayMs
      : a.def.trigger === "with"
        ? prevStart + a.def.delayMs
        : groupEnd + a.def.delayMs;
    g.items.push({ def: a.def, spids: a.spids, start });
    prevStart = start;
    // `after` waits out repeats and the auto-reverse leg, not just one pass —
    // deck-stage.js's _animSteps mirrors this line.
    groupEnd = Math.max(groupEnd, start + effectiveDurationMs(a.def));
  }

  // Ids mint in document order (group → animation → effect → behaviors), like
  // PowerPoint's own writer. Only uniqueness is load-bearing.
  let groupsXml = "";
  for (const g of groups) {
    const gid = nid();
    let inner = "";
    for (const item of g.items) {
      const iid = nid();
      const nodeType = NODE_TYPE[item.def.trigger];
      const pars = item.spids
        .map((spid, i) => effectPar(item.def, spid, i === 0 ? nodeType : "withEffect", i > 0))
        .join("");
      inner +=
        `<p:par><p:cTn id="${iid}" fill="hold">` +
        `<p:stCondLst><p:cond delay="${item.start}"/></p:stCondLst>` +
        `<p:childTnLst>${pars}</p:childTnLst>` +
        `</p:cTn></p:par>`;
    }
    groupsXml +=
      `<p:par><p:cTn id="${gid}" fill="hold">` +
      `<p:stCondLst><p:cond delay="${g.auto ? "0" : "indefinite"}"/></p:stCondLst>` +
      `<p:childTnLst>${inner}</p:childTnLst>` +
      `</p:cTn></p:par>`;
  }

  const bldSpids = [...new Set(sorted.flatMap((a) => a.spids))];
  const bldLst = `<p:bldLst>${bldSpids.map((s) => `<p:bldP spid="${s}" grpId="0" animBg="1"/>`).join("")}</p:bldLst>`;

  return (
    `<p:timing><p:tnLst><p:par>` +
    `<p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>` +
    `<p:seq concurrent="1" nextAc="seek">` +
    `<p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>${groupsXml}</p:childTnLst></p:cTn>` +
    `<p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>` +
    `<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst>` +
    `</p:seq>` +
    `</p:childTnLst></p:cTn>` +
    `</p:par></p:tnLst>${bldLst}</p:timing>`
  );
}
