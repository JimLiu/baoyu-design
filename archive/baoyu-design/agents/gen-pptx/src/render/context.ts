import { pxToInches, clamp } from "../core/units.ts";
import type { AnimationDef, Rect, MediaCache } from "../types.ts";

// Minimal structural view of a PptxGenJS slide — the renderer builds dynamic
// option bags (faithful to the original), so option args stay loosely typed.
// _slideObjects/_timingXml reach into the vendored library: the object list
// gives deterministic shape ids (cNvPr id = index + 2), and _timingXml is the
// hook VENDOR PATCH 1 splices into the slide XML (see vendor/pptxgenjs/VENDOR.md).
export interface PptxSlide {
  addText(text: unknown, opts: Record<string, unknown>): void;
  addShape(shapeName: string, opts: Record<string, unknown>): void;
  addImage(opts: Record<string, unknown>): void;
  addNotes(notes: string): void;
  background?: { color: string };
  _slideObjects?: unknown[];
  _timingXml?: string;
}

/** One data-anim element's manifest: its def + every PPTX shape it emitted. */
export interface SlideAnimEntry {
  def: AnimationDef;
  spids: number[];
  shapeNames: string[];
  /** Names handed out (a failed add* burns a name without recording it). */
  minted: number;
}

export interface RenderContext {
  slide: PptxSlide;
  slideW: number;
  slideH: number;
  originX: number;
  originY: number;
  mediaCache: MediaCache;
  warnings: string[];
  /** 1-based slide number (debuggability of minted shape names). */
  slideNo: number;
  /** Per-slide animation manifest, filled as the renderer emits shapes. */
  animEntries: SlideAnimEntry[];
  /** Optional from→to font swap map (usually unused; capture already resolved). */
  fontMap?: Record<string, string>;
}

// Mint the objectName for the next shape of an animated node — set it in the
// option bag BEFORE the add* call so it lands in p:cNvPr/@name.
export function mintAnimName(ctx: RenderContext, entry: SlideAnimEntry): string {
  return `anim-s${ctx.slideNo}-n${entry.def.index}-k${entry.minted++}`;
}

// Record a successfully added shape: the vendored library appends one object
// per add* call, so its cNvPr id is (index + 2) = (_slideObjects.length + 1)
// right after the push. Call this only after add* returned without throwing.
export function recordAnimShape(ctx: RenderContext, entry: SlideAnimEntry, name: string): void {
  const objs = ctx.slide._slideObjects;
  if (!Array.isArray(objs) || objs.length === 0) return; // contract broken — entry stays unresolved
  entry.shapeNames.push(name);
  entry.spids.push(objs.length + 1);
}

// Page rect → slide-relative inches, clamped to a sane band around the slide. (←Ae)
export function rectToPptx(rect: Rect, ctx: RenderContext): Rect {
  const x = rect.x - ctx.originX;
  const y = rect.y - ctx.originY;
  return {
    x: pxToInches(clamp(x, -ctx.slideW, ctx.slideW * 2)),
    y: pxToInches(clamp(y, -ctx.slideH, ctx.slideH * 2)),
    w: pxToInches(Math.max(clamp(rect.w, 0, ctx.slideW * 2), 1)),
    h: pxToInches(Math.max(clamp(rect.h, 0, ctx.slideH * 2), 1)),
  };
}
