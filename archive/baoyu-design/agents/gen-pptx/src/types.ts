// Cross-cutting data contract shared by the Node side (render/validate/orchestrator)
// and the browser side (capture). Everything here is JSON-serializable so it can
// cross the page.evaluate() boundary unchanged.

export type Mode = "editable" | "screenshots";

export interface FontSwap {
  from: string;
  to: string;
}

export interface SlideSpec {
  /** Sync JS expression run inside the page to reveal slide N (e.g. "goToSlide(0)"). */
  showJs?: string;
  /** Selector matching the slide root once shown. */
  selector: string;
  /** ms to wait after showJs for transitions (default 600). */
  delay?: number;
}

export interface GenPptxInput {
  mode?: Mode;
  width: number;
  height: number;
  slides: SlideSpec[];
  hideSelectors?: string[];
  resetTransformSelector?: string;
  googleFontImports?: string[];
  fontSwaps?: FontSwap[];
  filename?: string;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type StyleMap = Record<string, string>;

export type AnimEffect =
  | "appear"
  | "disappear"
  | "fade-in"
  | "fade-out"
  | "fly-in"
  | "fly-out"
  | "wipe-in"
  | "wipe-out"
  | "float-in"
  | "float-out"
  | "split-in"
  | "split-out"
  | "bounce-in"
  | "bounce-out"
  | "zoom-in"
  | "zoom-out"
  | "wheel-in"
  | "wheel-out"
  | "random-bars-in"
  | "random-bars-out"
  | "blinds-in"
  | "blinds-out"
  | "checkerboard-in"
  | "checkerboard-out"
  | "dissolve-in"
  | "dissolve-out"
  | "box-in"
  | "box-out"
  | "circle-in"
  | "circle-out"
  | "diamond-in"
  | "diamond-out"
  | "plus-in"
  | "plus-out"
  | "strips-in"
  | "strips-out"
  | "wedge-in"
  | "wedge-out"
  | "spin"
  | "grow"
  | "shrink"
  | "pulse"
  | "teeter"
  | "path";

export type AnimTrigger = "click" | "with" | "after";
/** Edge dirs (fly/wipe: the side the element enters from / exits toward; float:
 *  top|bottom only), axis dirs (split/random-bars/blinds/checkerboard: the
 *  bar/seam axis), shape dirs (box/circle/diamond/plus: whether the pattern
 *  closes in on the center or grows out of it), and corner dirs (strips: the
 *  corner the diagonal sweep travels toward). */
export type AnimDir =
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "horizontal"
  | "vertical"
  | "in"
  | "out"
  | "down-right"
  | "down-left"
  | "up-right"
  | "up-left";

/** One motion-path segment, px offsets re-based so the path starts at (0,0). */
export interface AnimPathSeg {
  c: "L" | "C";
  /** L: [x,y]. C: [x1,y1,x2,y2,x,y]. */
  p: number[];
}

/** A parsed `data-anim-*` attribute set (see core/anim.ts for the grammar). */
export interface AnimationDef {
  effect: AnimEffect;
  trigger: AnimTrigger;
  delayMs: number;
  durationMs: number;
  /** data-anim-order (default 0); ties break on `index`. */
  order: number;
  /** Per-slide document order, assigned by walk(). */
  index: number;
  dir?: AnimDir;
  rotateDeg?: number;
  scale?: number;
  pathSegs?: AnimPathSeg[];
  /** data-anim-repeat (2–100); absent means play once. */
  repeat?: number;
  /** data-anim-auto-reverse — emphasis/path effects only; absent means off. */
  autoReverse?: boolean;
}

/** A captured DOM node. Mirrors the tree the in-page walk() emits. */
export interface SlideNode {
  tag: string;
  rect: Rect;
  style: StyleMap;
  children: SlideNode[];
  text?: string;
  href?: string;
  imageUrl?: string;
  svg?: string;
  /** CSS background gradient (linear/radial), rasterized to a transparent PNG. */
  gradient?: string;
  /** Uniform border-radius in px for the gradient box, when any. */
  gradientRadius?: number;
  /** Pre-transform AABB for rotated elements. */
  untransformedRect?: Rect;
  /** 1-based ordinal for <li> with a non-trivial list-style. */
  liIndex?: number;
  /** PowerPoint animation parsed from data-anim-* attributes, when present. */
  anim?: AnimationDef;
}

export interface CapturedSlide {
  rect: Rect;
  root: SlideNode;
  notes?: string;
}

export interface SetupResult {
  notes: string[];
  fontsReady: boolean;
  resetRect: Rect | null;
  fontSwapMisses: string[];
  /** Count of [data-anim] elements in the document (screenshots-mode advisory). */
  animCount: number;
}

export interface SlideCaptureResult {
  slide: CapturedSlide;
  hash: number;
  imagesWaited: number;
  imagesFailed: number;
}

export type WarningKind =
  | "duplicate_adjacent"
  | "duplicate_majority"
  | "slide_size_mismatch"
  | "reset_selector_miss"
  | "fonts_timeout"
  | "font_swap_failed"
  | "no_speaker_notes"
  | "notes_count_mismatch"
  | "notes_uniform_nonempty"
  | "images_failed"
  | "animation_invalid"
  | "animation_nested"
  | "animation_hidden_target"
  | "animations_ignored_screenshots";

export interface ValidationFlag {
  kind: WarningKind;
  message: string;
}

/** Resolved media entry — a base64 data URL plus intrinsic size when known. */
export interface MediaEntry {
  dataUrl: string;
  w?: number;
  h?: number;
}

export type MediaCache = Map<string, MediaEntry | null>;

/** A media reference collected from the captured tree, sent to the page to resolve. */
export type MediaRef =
  | { kind: "url"; key: string; url: string }
  | { kind: "svg"; key: string; svg: string; w: number; h: number }
  | { kind: "gradient"; key: string; css: string; w: number; h: number; radius: number };

/** Page's reply per ref: the resolved entry (or null) plus any warning to surface. */
export interface ResolvedMedia {
  key: string;
  value: MediaEntry | null;
  warnings: string[];
}

export interface GenPptxResult {
  bytes: number;
  slides: number;
  warnings: string[];
  validation: ValidationFlag[];
  speakerNotes: string[];
  /** Count of data-anim animations exported as native PPTX effects (0 in screenshots mode). */
  animations: number;
  savedPath?: string;
}
