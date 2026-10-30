// data-anim-* attribute grammar, shared by the browser walk() and node-side
// tests. Pure and dependency-free (type-only imports) so the browser bundle can
// include it without pulling in the Node graph.

import type { AnimationDef, AnimDir, AnimEffect, AnimPathSeg, AnimTrigger } from "../types.ts";

export interface ParsedAnim {
  def: AnimationDef | null;
  warnings: string[];
}

// Defaults follow PowerPoint's own effect durations (float and pulse verified
// against real PowerPoint-authored XML; the rest are the UI defaults).
const DURATION_DEFAULT: Record<AnimEffect, number> = {
  appear: 1,
  disappear: 1,
  "fade-in": 500,
  "fade-out": 500,
  "fly-in": 500,
  "fly-out": 500,
  "wipe-in": 500,
  "wipe-out": 500,
  "float-in": 1000,
  "float-out": 1000,
  "split-in": 500,
  "split-out": 500,
  "bounce-in": 2000,
  "bounce-out": 2000,
  "zoom-in": 500,
  "zoom-out": 500,
  "wheel-in": 2000,
  "wheel-out": 2000,
  "random-bars-in": 500,
  "random-bars-out": 500,
  "blinds-in": 500,
  "blinds-out": 500,
  "checkerboard-in": 500,
  "checkerboard-out": 500,
  "dissolve-in": 500,
  "dissolve-out": 500,
  "box-in": 500,
  "box-out": 500,
  "circle-in": 500,
  "circle-out": 500,
  "diamond-in": 500,
  "diamond-out": 500,
  "plus-in": 500,
  "plus-out": 500,
  "strips-in": 500,
  "strips-out": 500,
  "wedge-in": 500,
  "wedge-out": 500,
  spin: 2000,
  grow: 2000,
  shrink: 2000,
  pulse: 500,
  teeter: 1000,
  path: 2000,
};

/** entr(ance)/exit/emph(asis)/path — drives the per-kind attribute rules
 *  (auto-reverse is emphasis/path-only) and the exporter's visibility sets. */
export const EFFECT_KIND: Record<AnimEffect, "entr" | "exit" | "emph" | "path"> = {
  appear: "entr",
  disappear: "exit",
  "fade-in": "entr",
  "fade-out": "exit",
  "fly-in": "entr",
  "fly-out": "exit",
  "wipe-in": "entr",
  "wipe-out": "exit",
  "float-in": "entr",
  "float-out": "exit",
  "split-in": "entr",
  "split-out": "exit",
  "bounce-in": "entr",
  "bounce-out": "exit",
  "zoom-in": "entr",
  "zoom-out": "exit",
  "wheel-in": "entr",
  "wheel-out": "exit",
  "random-bars-in": "entr",
  "random-bars-out": "exit",
  "blinds-in": "entr",
  "blinds-out": "exit",
  "checkerboard-in": "entr",
  "checkerboard-out": "exit",
  "dissolve-in": "entr",
  "dissolve-out": "exit",
  "box-in": "entr",
  "box-out": "exit",
  "circle-in": "entr",
  "circle-out": "exit",
  "diamond-in": "entr",
  "diamond-out": "exit",
  "plus-in": "entr",
  "plus-out": "exit",
  "strips-in": "entr",
  "strips-out": "exit",
  "wedge-in": "entr",
  "wedge-out": "exit",
  spin: "emph",
  grow: "emph",
  shrink: "emph",
  pulse: "emph",
  teeter: "emph",
  path: "path",
};

// data-anim-dir families: fly/wipe take the four edges (the side the element
// enters from / exits toward); float is vertical-only; split/random-bars/
// blinds/checkerboard take the bar/seam axis (split default matches
// PowerPoint's "Vertical In"); box/circle/diamond/plus take in|out (the
// pattern closes on the center or grows out of it — entrances default in,
// exits default out, PowerPoint's own pairings); strips takes the corner the
// diagonal sweep travels toward.
const EDGE_DIRS: Record<string, AnimDir> = { left: "left", right: "right", top: "top", bottom: "bottom" };
const VERT_DIRS: Record<string, AnimDir> = { top: "top", bottom: "bottom" };
const AXIS_DIRS: Record<string, AnimDir> = { horizontal: "horizontal", vertical: "vertical" };
const SHAPE_DIRS: Record<string, AnimDir> = { in: "in", out: "out" };
const CORNER_DIRS: Record<string, AnimDir> = {
  "down-right": "down-right",
  "down-left": "down-left",
  "up-right": "up-right",
  "up-left": "up-left",
};
const AXIS = { allowed: AXIS_DIRS, label: "horizontal|vertical" };
const SHAPE = { allowed: SHAPE_DIRS, label: "in|out" };
const CORNER = { allowed: CORNER_DIRS, def: "down-right" as AnimDir, label: "down-right|down-left|up-right|up-left" };
const DIR_FAMILY: Partial<Record<AnimEffect, { allowed: Record<string, AnimDir>; def: AnimDir; label: string }>> = {
  "fly-in": { allowed: EDGE_DIRS, def: "bottom", label: "left|right|top|bottom" },
  "fly-out": { allowed: EDGE_DIRS, def: "bottom", label: "left|right|top|bottom" },
  "wipe-in": { allowed: EDGE_DIRS, def: "bottom", label: "left|right|top|bottom" },
  "wipe-out": { allowed: EDGE_DIRS, def: "bottom", label: "left|right|top|bottom" },
  "float-in": { allowed: VERT_DIRS, def: "bottom", label: "top|bottom" },
  "float-out": { allowed: VERT_DIRS, def: "bottom", label: "top|bottom" },
  "split-in": { ...AXIS, def: "vertical" },
  "split-out": { ...AXIS, def: "vertical" },
  "random-bars-in": { ...AXIS, def: "horizontal" },
  "random-bars-out": { ...AXIS, def: "horizontal" },
  "blinds-in": { ...AXIS, def: "horizontal" },
  "blinds-out": { ...AXIS, def: "horizontal" },
  "checkerboard-in": { ...AXIS, def: "horizontal" },
  "checkerboard-out": { ...AXIS, def: "horizontal" },
  "box-in": { ...SHAPE, def: "in" },
  "box-out": { ...SHAPE, def: "out" },
  "circle-in": { ...SHAPE, def: "in" },
  "circle-out": { ...SHAPE, def: "out" },
  "diamond-in": { ...SHAPE, def: "in" },
  "diamond-out": { ...SHAPE, def: "out" },
  "plus-in": { ...SHAPE, def: "in" },
  "plus-out": { ...SHAPE, def: "out" },
  "strips-in": CORNER,
  "strips-out": CORNER,
};
const TRIGGERS: Record<string, 1> = { click: 1, with: 1, after: 1 };

const clampNum = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/**
 * Parse one element's data-anim-* attributes. `get` is el.getAttribute (or a
 * plain map lookup in tests); `index` is the per-slide document order assigned
 * by the caller. A null def means the effect was rejected — the element still
 * exports, just statically.
 */
export function parseAnimAttrs(
  get: (name: string) => string | null,
  index: number,
): ParsedAnim {
  const warnings: string[] = [];
  const effect = (get("data-anim") ?? "").trim().toLowerCase();
  if (!(effect in DURATION_DEFAULT)) {
    warnings.push(`unknown data-anim effect "${effect}" — element exported without animation`);
    return { def: null, warnings };
  }
  const eff = effect as AnimEffect;

  const rawTrigger = get("data-anim-trigger");
  let trigger: AnimTrigger = "after";
  if (rawTrigger !== null) {
    const t = rawTrigger.trim().toLowerCase();
    if (t in TRIGGERS) trigger = t as AnimTrigger;
    else warnings.push(`invalid data-anim-trigger "${rawTrigger}" — using "after"`);
  }

  const intAttr = (name: string, fallback: number, lo: number, hi: number): number => {
    const raw = get(name);
    if (raw === null) return fallback;
    const v = parseInt(raw, 10);
    if (Number.isNaN(v) || v < lo) {
      warnings.push(`invalid ${name} "${raw}" — using ${fallback}`);
      return fallback;
    }
    return clampNum(v, lo, hi);
  };

  const delayMs = intAttr("data-anim-delay", 0, 0, 60000);
  let durationMs: number;
  if (eff === "appear" || eff === "disappear") {
    if (get("data-anim-duration") !== null) {
      warnings.push(`data-anim-duration is ignored for "${eff}" (instant effect)`);
    }
    durationMs = 1;
  } else {
    durationMs = intAttr("data-anim-duration", DURATION_DEFAULT[eff], 1, 60000);
  }

  const rawOrder = get("data-anim-order");
  let order = 0;
  if (rawOrder !== null) {
    const v = parseInt(rawOrder, 10);
    if (Number.isNaN(v)) warnings.push(`invalid data-anim-order "${rawOrder}" — using document order`);
    else order = v;
  }

  const def: AnimationDef = { effect: eff, trigger, delayMs, durationMs, order, index };

  const rawDir = get("data-anim-dir");
  const fam = DIR_FAMILY[eff];
  if (fam) {
    let dir = fam.def;
    if (rawDir !== null) {
      const d = rawDir.trim().toLowerCase();
      if (d in fam.allowed) dir = fam.allowed[d];
      else warnings.push(`invalid data-anim-dir "${rawDir}" for "${eff}" (${fam.label}) — using "${fam.def}"`);
    }
    def.dir = dir;
  } else if (rawDir !== null) {
    warnings.push(`data-anim-dir has no effect on "${eff}"`);
  }

  if (eff === "spin" || eff === "teeter") {
    const raw = get("data-anim-rotate");
    // spin: total turn (default one full turn); teeter: peak rock tilt
    // (default 5° — PowerPoint's own preset rocks ±2°, bumped for
    // back-of-the-room legibility; override with data-anim-rotate).
    let deg = eff === "spin" ? 360 : 5;
    if (raw !== null) {
      const v = parseFloat(raw);
      if (Number.isNaN(v)) warnings.push(`invalid data-anim-rotate "${raw}" — using ${deg}`);
      else deg = clampNum(v, -3600, 3600);
    }
    if (deg === 0) {
      warnings.push(`data-anim-rotate 0 ${eff === "spin" ? "spins" : "rocks"} nowhere — animation dropped`);
      return { def: null, warnings };
    }
    def.rotateDeg = deg;
  }

  if (eff === "grow" || eff === "shrink" || eff === "pulse") {
    const raw = get("data-anim-scale");
    // pulse peak matches PowerPoint's 105%.
    let scale = eff === "grow" ? 1.5 : eff === "shrink" ? 0.67 : 1.05;
    if (raw !== null) {
      const v = parseFloat(raw);
      if (Number.isNaN(v)) warnings.push(`invalid data-anim-scale "${raw}" — using ${scale}`);
      else scale = clampNum(v, 0.1, 5);
    }
    if (scale === 1) {
      warnings.push(`data-anim-scale 1 changes nothing — animation dropped`);
      return { def: null, warnings };
    }
    def.scale = scale;
  }

  if (eff === "path") {
    const raw = get("data-anim-path");
    if (raw === null || !raw.trim()) {
      warnings.push(`data-anim="path" requires data-anim-path — animation dropped`);
      return { def: null, warnings };
    }
    const parsed = parseAnimPath(raw);
    if (typeof parsed === "string") {
      warnings.push(`${parsed} — animation dropped`);
      return { def: null, warnings };
    }
    if (parsed.truncated) warnings.push(`data-anim-path exceeds 32 points — truncated`);
    def.pathSegs = parsed.segs;
  }

  const rawRepeat = get("data-anim-repeat");
  if (rawRepeat !== null) {
    const v = parseInt(rawRepeat, 10);
    if (Number.isNaN(v) || v < 1) {
      warnings.push(`invalid data-anim-repeat "${rawRepeat}" — playing once`);
    } else if (eff === "appear" || eff === "disappear") {
      warnings.push(`data-anim-repeat is ignored for "${eff}" (instant effect)`);
    } else {
      const r = clampNum(v, 1, 100);
      if (r > 1) def.repeat = r;
    }
  }

  const rawAutoRev = get("data-anim-auto-reverse");
  if (rawAutoRev !== null) {
    const b = rawAutoRev.trim().toLowerCase();
    if (b === "" || b === "true" || b === "1") {
      // A reversed entrance ends back at hidden and snaps visible; a reversed
      // exit ends visible and then the re-hide pops it; pulse and teeter
      // already return to base on their own — only the emphasis effects that
      // end away from base (and motion paths) can meaningfully reverse.
      if (eff === "spin" || eff === "grow" || eff === "shrink" || eff === "path") def.autoReverse = true;
      else warnings.push(`data-anim-auto-reverse only applies to spin/grow/shrink/path — ignored for "${eff}"`);
    } else if (b !== "false" && b !== "0") {
      warnings.push(`invalid data-anim-auto-reverse "${rawAutoRev}" — ignored`);
    }
  }

  return { def, warnings };
}

/**
 * Wall-clock length of one animation including repeats and the auto-reverse
 * return leg — what `after` chaining and click-step ends must count. Mirrored
 * inline by deck-stage.js's _animSteps.
 */
export const effectiveDurationMs = (def: AnimationDef): number =>
  def.durationMs * (def.repeat ?? 1) * (def.autoReverse ? 2 : 1);

const MAX_PATH_POINTS = 32;

/**
 * Parse a data-anim-path value: optional leading `M x y`, then `L x y` /
 * `C x1 y1 x2 y2 x y` segments; px offsets in slide space, +y down. All
 * coordinates are re-based so the path starts at (0,0) — the element's
 * authored position. Returns an error string on bad input.
 */
export function parseAnimPath(spec: string): { segs: AnimPathSeg[]; truncated: boolean } | string {
  const tokens = spec.trim().split(/[\s,]+/).filter(Boolean);
  let i = 0;
  const nums = (n: number, cmd: string): number[] | string => {
    const out: number[] = [];
    for (let k = 0; k < n; k++) {
      const v = parseFloat(tokens[i] ?? "");
      if (!Number.isFinite(v)) return `data-anim-path: "${cmd}" needs ${n} numbers`;
      out.push(v);
      i++;
    }
    return out;
  };

  let baseX = 0;
  let baseY = 0;
  if ((tokens[i] ?? "").toUpperCase() === "M") {
    i++;
    const m = nums(2, "M");
    if (typeof m === "string") return m;
    [baseX, baseY] = m;
  }

  const segs: AnimPathSeg[] = [];
  let points = 0;
  let truncated = false;
  while (i < tokens.length) {
    const cmd = tokens[i].toUpperCase();
    i++;
    let seg: AnimPathSeg;
    if (cmd === "L") {
      const p = nums(2, "L");
      if (typeof p === "string") return p;
      seg = { c: "L", p: [p[0] - baseX, p[1] - baseY] };
      points += 1;
    } else if (cmd === "C") {
      const p = nums(6, "C");
      if (typeof p === "string") return p;
      seg = { c: "C", p: p.map((v, k) => v - (k % 2 === 0 ? baseX : baseY)) };
      points += 3;
    } else {
      return `data-anim-path: unsupported command "${cmd}" (only M, L, C)`;
    }
    if (points > MAX_PATH_POINTS) {
      truncated = true;
      break;
    }
    segs.push(seg);
  }
  if (segs.length === 0) return `data-anim-path has no L/C segments`;
  return { segs, truncated };
}

// Fixed 5 decimals, no exponent notation, no negative zero.
const frac = (n: number): string => {
  const s = n.toFixed(5);
  return s === "-0.00000" ? "0.00000" : s;
};

/**
 * Convert re-based px segments to the OOXML animMotion path string: slide-size
 * fractions, `M 0 0` start, `E` end (stop at the final point).
 */
export function pathToOoxml(segs: AnimPathSeg[], slideWpx: number, slideHpx: number): string {
  let out = "M 0 0";
  for (const seg of segs) {
    const vals = seg.p.map((v, k) => frac(v / (k % 2 === 0 ? slideWpx : slideHpx)));
    out += ` ${seg.c} ${vals.join(" ")}`;
  }
  return out + " E";
}
