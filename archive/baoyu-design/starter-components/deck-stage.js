/* BEGIN USAGE */
/**
 * <deck-stage> — reusable web component for HTML decks.
 *
 * Handles:
 *  (a) speaker notes — reads <script type="application/json" id="speaker-notes">
 *      and posts {slideIndexChanged: N} to the parent window on nav.
 *  (b) keyboard navigation — ←/→ and ↑/↓, PgUp/PgDn, Space, Home/End,
 *      number keys.
 *      On touch devices, tapping the left/right half of the stage goes
 *      prev/next — taps on links, buttons and other interactive slide
 *      content are left alone.
 *  (c) press R to reset to slide 0 (with a tasteful keyboard hint).
 *  (d) bottom-center overlay showing slide count + hints, fades out on
 *      idle; hovering or focusing its controls pins it visible until the
 *      pointer/focus leaves. While presenting it is pointer-summoned only:
 *      mouse movement (or hover/focus) shows it, slide changes never do.
 *  (e) auto-scaling — inner canvas is a fixed design size (default 1920×1080)
 *      scaled with `transform: scale()` to fit the viewport, letterboxed.
 *      Set the `noscale` attribute to render at authored size (1:1) — the
 *      PPTX exporter sets this so its DOM capture sees unscaled geometry.
 *  (f) print — `@media print` lays every slide out as its own page at the
 *      design size, so the browser's Print → Save as PDF produces a clean
 *      one-page-per-slide PDF with no extra setup.
 *  (g) thumbnail rail — resizable left-hand column of per-slide thumbnails
 *      (static clones). Click to navigate — the clicked slide becomes the
 *      selected (highlighted) slide; shift-click selects a range and
 *      cmd/ctrl-click toggles slides in and out of the selection
 *      (Escape collapses it back to the current slide); ↑/↓ with a
 *      thumbnail focused to step between slides; Delete/Backspace with a
 *      thumbnail focused to delete the selection (one confirm dialog,
 *      one undoable operation); drag to reorder (dragging collapses a
 *      multi-selection); right-click for
 *      Skip / Move up / Move down / Duplicate / Delete — over a
 *      multi-selection the menu offers "Delete N slides". Drag the rail's right edge to resize;
 *      width persists to
 *      localStorage. Skipped slides carry `data-deck-skip`, are dimmed in
 *      the rail, omitted from prev/next navigation, and hidden at print.
 *      They also carry no rail number and are excluded from the overlay's
 *      slide count: the remaining slides are numbered contiguously
 *      (Keynote-style), and a skipped CURRENT slide (reachable by rail
 *      click or deep link, never by prev/next) shows '–' as its position.
 *      The rail is suppressed in presenting mode, in the host's Preview
 *      mode (ViewerMode='none'), on `noscale`, on narrow viewports
 *      (≤640px), and via the `no-rail` attribute. Rail mutations dispatch
 *      a `dc-op` CustomEvent on the element (see docs/dc-ops.md) and do
 *      NOT touch the DOM: the host applies the op and re-renders;
 *      structural rail input is locked until the host posts
 *      {__dc_op_ack: true, applied}.
 *  (h) build animations — slide elements carrying data-anim (fade-in/out,
 *      fly-in/out, wipe-in/out, float-in/out, split-in/out, bounce-in/out,
 *      zoom-in/out, wheel-in/out, random-bars-in/out, blinds-in/out,
 *      checkerboard-in/out, dissolve-in/out, box-in/out, circle-in/out,
 *      diamond-in/out, plus-in/out, strips-in/out, wedge-in/out,
 *      appear/disappear, spin, grow/shrink, pulse, teeter, path) play with
 *      the Web Animations API and export as native PowerPoint animations
 *      via the PPTX exporter. Timing attrs: data-anim-trigger
 *      click|with|after (default after — chained autoplay on slide
 *      arrival), data-anim-delay, data-anim-duration, data-anim-order,
 *      data-anim-repeat, data-anim-auto-reverse (spin/grow/shrink/path
 *      only), plus per-effect data-anim-dir/-rotate/-scale/-path.
 *      data-anim-dir families: fly/wipe take left|right|top|bottom, float
 *      takes top|bottom, split/random-bars/blinds/checkerboard take
 *      horizontal|vertical, box/circle/diamond/plus take in|out (entrances
 *      default in, exits out), and strips takes
 *      down-right|down-left|up-right|up-left.
 *      →/Space/tap play pending click steps before advancing (a `deckstep`
 *      CustomEvent fires per step); ← and direct jumps (number keys,
 *      Home/End, rail clicks) bypass them. Arriving backward shows the
 *      slide fully built. Print, thumbnails and noscale capture see the
 *      authored base state; reduced-motion plays every effect instantly
 *      but keeps click-step gating (build order is content, not motion).
 *  (i) typographic defaults — a zero-specificity stylesheet injected into
 *      the document gives headings `text-wrap: balance` and body text
 *      (p, li, blockquote, figcaption) `text-wrap: pretty`, so slides
 *      avoid widowed/orphaned words by default. Any text-wrap declaration
 *      you author on those elements wins over these defaults.
 *
 * Slides are HIDDEN, not unmounted. Non-active slides stay in the DOM with
 * `visibility: hidden` + `opacity: 0`, so their state (videos, iframes,
 * form inputs, React trees) is preserved across navigation.
 *
 * Lifecycle event — the component dispatches a `slidechange` CustomEvent on
 * itself whenever the active slide changes (including the initial mount).
 * The event bubbles and composes out of shadow DOM, so you can listen on
 * the <deck-stage> element or on document:
 *
 *   document.querySelector('deck-stage').addEventListener('slidechange', (e) => {
 *     e.detail.index         // new 0-based index
 *     e.detail.previousIndex // previous index, or -1 on init
 *     e.detail.total         // total slide count
 *     e.detail.slide         // the new active slide element
 *     e.detail.previousSlide // the prior slide element, or null on init
 *     e.detail.reason        // 'init' | 'keyboard' | 'click' | 'tap' | 'api'
 *   });
 *
 * Persistence: none at the deck level. The host app keeps the current slide
 * in its own URL (?slide=) and re-delivers it via location.hash on load, so a
 * bare load with no hash always starts at slide 1.
 *
 * Usage:
 *   <style>deck-stage:not(:defined){visibility:hidden}</style>
 *   <deck-stage width="1920" height="1080">
 *     <section data-label="Title">...</section>
 *     <section data-label="Agenda">...</section>
 *   </deck-stage>
 *   <script src="deck-stage.js"></script>
 *
 * The :not(:defined) rule prevents a flash of the first slide at its
 * authored styles before this script runs and attaches the shadow root.
 *
 * Slides are the direct element children of <deck-stage>. Each slide is
 * automatically tagged with:
 *   - data-screen-label="NN Label"   (1-indexed, for comment flow)
 *   - data-om-validate="no_overflowing_text,no_overlapping_text,slide_sized_text"
 *
 * Speaker notes stay in sync because the component posts {slideIndexChanged: N}
 * to the parent — just include the #speaker-notes script tag if asked for notes.
 *
 * Authoring guidance:
 *   - Write slide bodies as static HTML inside <deck-stage>, with sizing via
 *     CSS custom properties in a <style> block rather than JS constants.
 *     Static slide markup is what lets the user click a heading in edit mode
 *     and retype it directly; a slide rendered through <script type="text/babel">,
 *     React, or a loop over a JS array has to round-trip every tweak through a
 *     chat message instead. Reach for script-generated slides only when the
 *     content genuinely needs interactive behaviour static HTML can't express.
 *   - Do NOT set position/inset/width/height on the slide <section> elements —
 *     the component absolutely positions every slotted child for you.
 *   - Entrance/build animations: prefer the data-anim attributes (see (h))
 *     — they play in the browser AND export as native PowerPoint builds.
 *     Author the slide at its final visible layout (the base state) and
 *     let the engine hide/reveal; the default trigger "after" autoplays on
 *     slide arrival, so `data-anim="fade-in"` alone just works. Print,
 *     thumbnails and PPTX capture all see the base state with zero extra
 *     work (reduced-motion is instant but click steps still gate).
 *     Hand-written CSS animations gated on
 *     [data-deck-active] and the motion query still work for pure
 *     decoration but do NOT export to PPTX, e.g.
 *     `@media (prefers-reduced-motion:no-preference){ [data-deck-active] .x{animation:fade-in .5s both} }`.
 *     Don't mix data-anim and a [data-deck-active] animation on the same
 *     element. Avoid infinite decorative loops on slide content.
 */
/* END USAGE */

(() => {
  const DESIGN_W_DEFAULT = 1920;
  const DESIGN_H_DEFAULT = 1080;
  const OVERLAY_HIDE_MS = 1800;
  const VALIDATE_ATTR = 'no_overflowing_text,no_overlapping_text,slide_sized_text';
  const FINE_POINTER_MQ = matchMedia('(hover: hover) and (pointer: fine)');
  const NARROW_MQ = matchMedia('(max-width: 640px)');
  // Slide-authored controls that should keep a tap instead of it navigating.
  const INTERACTIVE_SEL = 'a[href], button, input, select, textarea, summary, label, video[controls], audio[controls], [role="button"], [onclick], [tabindex]:not([tabindex^="-"]), [contenteditable]:not([contenteditable="false" i])';
  const REDUCED_MQ = matchMedia('(prefers-reduced-motion: reduce)');

  // Gradient-mask effects (wheel/split/random-bars) drive one registered
  // custom property from WAAPI keyframes. Registration can only fail where
  // @property is unsupported — those browsers get a plain fade instead — or
  // because a second copy of this script already registered it, which is
  // success. Both the mask string and the animated --deck-anim-t live inside
  // keyframes, so cancel() cleans everything (no inline styles).
  let MASK_OK = false;
  try {
    if (window.CSS && CSS.registerProperty) {
      CSS.registerProperty({ name: '--deck-anim-t', syntax: '<number>', inherits: false, initialValue: '0' });
      MASK_OK = true;
    }
  } catch (err) { MASK_OK = true; }

  // data-anim build-animation contract, shared with the PPTX exporter
  // (gen-pptx turns the same attributes into native PowerPoint timing).
  // kind: entr(ance) effects start hidden and reveal; exit effects hide;
  // emph(asis) and path leave visibility alone. dur is the default ms when
  // data-anim-duration is absent (PowerPoint's own effect defaults) —
  // appear/disappear are instant and ignore it. Runtime playback state is
  // data-deck-anim-* attrs only, which the rail's MutationObserver already
  // ignores (OWN_ATTRS), so playing an animation never re-clones a thumbnail.
  const ANIM_HIDDEN_ATTR = 'data-deck-anim-hidden';
  const ANIM_MASK_ATTR = 'data-deck-anim-mask';
  const ANIM_EFFECTS = {
    'appear':          { kind: 'entr', dur: 1 },
    'disappear':       { kind: 'exit', dur: 1 },
    'fade-in':         { kind: 'entr', dur: 500 },
    'fade-out':        { kind: 'exit', dur: 500 },
    'fly-in':          { kind: 'entr', dur: 500 },
    'fly-out':         { kind: 'exit', dur: 500 },
    'wipe-in':         { kind: 'entr', dur: 500 },
    'wipe-out':        { kind: 'exit', dur: 500 },
    'float-in':        { kind: 'entr', dur: 1000 },
    'float-out':       { kind: 'exit', dur: 1000 },
    'split-in':        { kind: 'entr', dur: 500 },
    'split-out':       { kind: 'exit', dur: 500 },
    'bounce-in':       { kind: 'entr', dur: 2000 },
    'bounce-out':      { kind: 'exit', dur: 2000 },
    'zoom-in':         { kind: 'entr', dur: 500 },
    'zoom-out':        { kind: 'exit', dur: 500 },
    'wheel-in':        { kind: 'entr', dur: 2000 },
    'wheel-out':       { kind: 'exit', dur: 2000 },
    'random-bars-in':  { kind: 'entr', dur: 500 },
    'random-bars-out': { kind: 'exit', dur: 500 },
    'blinds-in':       { kind: 'entr', dur: 500 },
    'blinds-out':      { kind: 'exit', dur: 500 },
    'checkerboard-in': { kind: 'entr', dur: 500 },
    'checkerboard-out':{ kind: 'exit', dur: 500 },
    'dissolve-in':     { kind: 'entr', dur: 500 },
    'dissolve-out':    { kind: 'exit', dur: 500 },
    'box-in':          { kind: 'entr', dur: 500 },
    'box-out':         { kind: 'exit', dur: 500 },
    'circle-in':       { kind: 'entr', dur: 500 },
    'circle-out':      { kind: 'exit', dur: 500 },
    'diamond-in':      { kind: 'entr', dur: 500 },
    'diamond-out':     { kind: 'exit', dur: 500 },
    'plus-in':         { kind: 'entr', dur: 500 },
    'plus-out':        { kind: 'exit', dur: 500 },
    'strips-in':       { kind: 'entr', dur: 500 },
    'strips-out':      { kind: 'exit', dur: 500 },
    'wedge-in':        { kind: 'entr', dur: 500 },
    'wedge-out':       { kind: 'exit', dur: 500 },
    'spin':            { kind: 'emph', dur: 2000 },
    'grow':            { kind: 'emph', dur: 2000 },
    'shrink':          { kind: 'emph', dur: 2000 },
    'pulse':           { kind: 'emph', dur: 500 },
    'teeter':          { kind: 'emph', dur: 1000 },
    'path':            { kind: 'path', dur: 2000 },
  };

  // Effects that must run on a LINEAR effect-level timing function: multi-
  // frame effects carry their pacing in keyframe offsets (an eased iteration
  // would warp the schedule — teeter's rocks would rush then crawl), and the
  // filter approximations mirror PowerPoint's constant-rate transitions.
  const ANIM_LINEAR = {
    'path': 1, 'bounce-in': 1, 'bounce-out': 1, 'pulse': 1, 'teeter': 1,
    'wipe-in': 1, 'wipe-out': 1, 'split-in': 1, 'split-out': 1,
    'wheel-in': 1, 'wheel-out': 1, 'random-bars-in': 1, 'random-bars-out': 1,
    'blinds-in': 1, 'blinds-out': 1, 'checkerboard-in': 1, 'checkerboard-out': 1,
    'dissolve-in': 1, 'dissolve-out': 1, 'box-in': 1, 'box-out': 1,
    'circle-in': 1, 'circle-out': 1, 'diamond-in': 1, 'diamond-out': 1,
    'plus-in': 1, 'plus-out': 1, 'strips-in': 1, 'strips-out': 1,
    'wedge-in': 1, 'wedge-out': 1,
  };

  // Wipe clip-path insets by data-anim-dir (the side the element enters from
  // / exits toward): wipe-in animates FROM these to inset(0), wipe-out the
  // reverse.
  const WIPE_INSET = {
    left: 'inset(0 100% 0 0)',
    right: 'inset(0 0 0 100%)',
    top: 'inset(0 0 100% 0)',
    bottom: 'inset(100% 0 0 0)',
  };

  const pad2 = (n) => String(n).padStart(2, '0');

  // Label precedence: data-label → data-screen-label (number stripped) → first heading → "Slide".
  const getSlideLabel = (el) => {
    const explicit = el.getAttribute('data-label');
    if (explicit) return explicit;

    const existing = el.getAttribute('data-screen-label');
    if (existing) return existing.replace(/^\s*\d+\s*/, '').trim() || existing;

    const h = el.querySelector('h1, h2, h3, [data-title]');
    const t = h && (h.textContent || '').trim().slice(0, 40);
    if (t) return t;

    return 'Slide';
  };

  const stylesheet = `
    :host {
      position: fixed;
      inset: 0;
      display: block;
      background: #000;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif;
      overflow: hidden;
      -webkit-tap-highlight-color: transparent;
    }
    /* connectedCallback holds this until document.fonts.ready (capped 2s) so
     * the first visible paint has the deck's real typography + final rail
     * layout. opacity (not visibility) so the active slide can't un-hide
     * itself via the ::slotted([data-deck-active]) visibility:visible rule.
     * Only the stage/rail hide — the black :host background stays, so the
     * iframe doesn't flash the page's default white. */
    :host([data-fonts-pending]) .stage,
    :host([data-fonts-pending]) .rail { opacity: 0; pointer-events: none; }

    .stage {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .canvas {
      position: relative;
      transform-origin: center center;
      flex-shrink: 0;
      background: #fff;
      will-change: transform;
      /* Slide edge on the black stage. Dark decks override the canvas
       * fill toward the stage's own black, leaving nothing to mark where
       * the slide ends — the faint white ring keeps the boundary legible
       * there while disappearing into the white of light decks. A
       * box-shadow, not outline/border: it follows any canvas rounding
       * and adds no layout size. */
      box-shadow: 0 0 0 1.5px rgba(255, 255, 255, 0.12);
    }

    /* Slides live in light DOM (via <slot>) so authored CSS still applies.
       We absolutely position each slotted child to stack them. */
    ::slotted(*) {
      position: absolute !important;
      inset: 0 !important;
      width: 100% !important;
      height: 100% !important;
      box-sizing: border-box !important;
      overflow: hidden;
      opacity: 0;
      pointer-events: none;
      visibility: hidden;
    }
    ::slotted([data-deck-active]) {
      opacity: 1;
      pointer-events: auto;
      visibility: visible;
    }

    .overlay {
      position: fixed;
      left: 50%;
      bottom: 22px;
      transform: translate(-50%, 6px) scale(0.92);
      filter: blur(6px);
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px;
      background: #000;
      color: #fff;
      border-radius: 999px;
      font-size: 12px;
      font-feature-settings: "tnum" 1;
      letter-spacing: 0.01em;
      opacity: 0;
      pointer-events: none;
      transition: opacity 260ms ease, transform 260ms cubic-bezier(.2,.8,.2,1), filter 260ms ease;
      transform-origin: center bottom;
      z-index: 2147483000;
      user-select: none;
    }
    .overlay[data-visible] {
      opacity: 1;
      pointer-events: auto;
      transform: translate(-50%, 0) scale(1);
      filter: blur(0);
    }

    .btn {
      appearance: none;
      -webkit-appearance: none;
      background: transparent;
      border: 0;
      margin: 0;
      padding: 0;
      color: inherit;
      font: inherit;
      cursor: default;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 28px;
      min-width: 28px;
      border-radius: 999px;
      color: rgba(255,255,255,0.72);
      transition: background 140ms ease, color 140ms ease;
      -webkit-tap-highlight-color: transparent;
    }
    .btn:hover { background: rgba(255,255,255,0.12); color: #fff; }
    .btn:active { background: rgba(255,255,255,0.18); }
    .btn:focus { outline: none; }
    .btn:focus-visible { outline: none; }
    .btn::-moz-focus-inner { border: 0; }
    .btn svg { width: 14px; height: 14px; display: block; }
    .btn.reset {
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.02em;
      padding: 0 10px 0 12px;
      gap: 6px;
      color: rgba(255,255,255,0.72);
    }
    .btn.reset .kbd {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 16px;
      height: 16px;
      padding: 0 4px;
      font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
      font-size: 10px;
      line-height: 1;
      color: rgba(255,255,255,0.88);
      background: rgba(255,255,255,0.12);
      border-radius: 4px;
    }

    .count {
      font-variant-numeric: tabular-nums;
      color: #fff;
      font-weight: 500;
      padding: 0 8px;
      min-width: 42px;
      text-align: center;
      font-size: 12px;
    }
    .count .sep { color: rgba(255,255,255,0.45); margin: 0 3px; font-weight: 400; }
    .count .total { color: rgba(255,255,255,0.55); }

    .divider {
      width: 1px;
      height: 14px;
      background: rgba(255,255,255,0.18);
      margin: 0 2px;
    }

    /* ── Thumbnail rail ──────────────────────────────────────────────────
       Fixed column on the left; each thumbnail is a static deep-clone of
       the light-DOM slide scaled into a 16:9 (or design-aspect) frame. The
       stage re-fits around it (see _fit); hidden during present / noscale
       / print so capture geometry and fullscreen output are unchanged. */
    .rail {
      position: fixed;
      left: 0;
      top: 0;
      bottom: 0;
      width: var(--deck-rail-w, 188px);
      background: #141414;
      border-right: 1px solid rgba(255,255,255,0.08);
      overflow-y: auto;
      overflow-x: hidden;
      padding: 12px 10px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 12px;
      z-index: 2147482500;
      scrollbar-width: thin;
      scrollbar-color: rgba(255,255,255,0.18) transparent;
    }
    .rail::-webkit-scrollbar { width: 8px; }
    .rail::-webkit-scrollbar-track { background: transparent; margin: 2px; }
    .rail::-webkit-scrollbar-thumb {
      background: rgba(255,255,255,0.18);
      border-radius: 4px;
      border: 2px solid transparent;
      background-clip: content-box;
    }
    .rail::-webkit-scrollbar-thumb:hover {
      background: rgba(255,255,255,0.28);
      border: 2px solid transparent;
      background-clip: content-box;
    }
    :host([no-rail]) .rail,
    :host([noscale]) .rail { display: none; }
    .rail[data-presenting] { display: none; }
    @media (max-width: 640px) {
      .rail, .rail-resize { display: none; }
    }
    /* User-driven show/hide (the TweaksPanel toggle) slides instead of
       popping. Transitions are gated on :host([data-rail-anim]) — set only
       for the 200ms around the toggle — so window-resize and rail-width
       drag (which also call _fit) don't lag behind the cursor. */
    .rail[data-user-hidden] { transform: translateX(-100%); }
    :host([data-rail-anim]) .rail { transition: transform 200ms cubic-bezier(.3,.7,.4,1); }
    :host([data-rail-anim]) .stage { transition: left 200ms cubic-bezier(.3,.7,.4,1); }
    :host([data-rail-anim]) .canvas { transition: transform 200ms cubic-bezier(.3,.7,.4,1); }
    /* transition shorthand replaces rather than merges — repeat the base
       .overlay opacity/transform/filter transitions so visibility changes
       during the 200ms toggle window still fade instead of popping. */
    :host([data-rail-anim]) .overlay {
      transition: margin-left 200ms cubic-bezier(.3,.7,.4,1),
                  opacity 260ms ease,
                  transform 260ms cubic-bezier(.2,.8,.2,1),
                  filter 260ms ease;
    }

    .thumb {
      position: relative;
      display: flex;
      align-items: flex-start;
      gap: 8px;
      cursor: pointer;
      user-select: none;
    }
    .thumb .num {
      width: 16px;
      flex-shrink: 0;
      font-size: 11px;
      font-weight: 500;
      text-align: right;
      color: rgba(255,255,255,0.55);
      padding-top: 2px;
      font-variant-numeric: tabular-nums;
    }
    .thumb .frame {
      position: relative;
      flex: 1;
      min-width: 0;
      aspect-ratio: var(--deck-aspect);
      background: #fff;
      border-radius: 4px;
      outline: 2px solid transparent;
      outline-offset: 0;
      overflow: hidden;
      transition: outline-color 120ms ease;
    }
    .thumb:hover .frame { outline-color: rgba(255,255,255,0.25); }
    .thumb { outline: none; }
    .thumb:focus-visible .frame { outline-color: rgba(255,255,255,0.5); }
    .thumb[data-selected] .num { color: #fff; }
    .thumb[data-selected] .frame {
      outline-color: rgba(217,119,87,0.65);
      box-shadow: 0 0 0 4px rgba(217,119,87,0.18);
    }
    .thumb[data-current] .num { color: #fff; }
    .thumb[data-current] .frame {
      outline-color: #D97757;
      box-shadow: 0 0 0 4px rgba(217,119,87,0.25);
    }
    /* While dragging, the thumb itself is the drag visual (the native drag
       image is suppressed in dragstart so the snapshot can't wander off the
       rail horizontally): elevate it rather than dim it, and let hit-testing
       ignore it so dragover reaches the sibling thumb under the pointer
       instead of the moving element itself. */
    .thumb[data-dragging] { opacity: 0.9; z-index: 30; pointer-events: none; }
    .thumb[data-dragging] .frame {
      outline-color: rgba(255,255,255,0.5);
      box-shadow: 0 6px 24px rgba(0,0,0,0.5);
    }
    .thumb::before {
      content: '';
      position: absolute;
      left: 24px;
      right: 0;
      height: 3px;
      border-radius: 2px;
      background: #D97757;
      opacity: 0;
      pointer-events: none;
    }
    .thumb[data-drop="before"]::before { top: -8px; opacity: 1; }
    .thumb[data-drop="after"]::before { bottom: -8px; opacity: 1; }
    .thumb[data-skip] .frame { opacity: 0.35; }
    .thumb[data-skip] .frame::after {
      content: 'Skipped';
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,0.45);
      color: #fff;
      font-size: 10px;
      font-weight: 500;
      letter-spacing: 0.04em;
    }

    .ctxmenu {
      position: fixed;
      min-width: 150px;
      padding: 4px;
      background: #242424;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 7px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.45);
      z-index: 2147483100;
      display: none;
      font-size: 12px;
    }
    .ctxmenu[data-open] { display: block; }
    .ctxmenu button {
      display: block;
      width: 100%;
      appearance: none;
      border: 0;
      background: transparent;
      color: #e8e8e8;
      font: inherit;
      text-align: left;
      padding: 6px 10px;
      border-radius: 4px;
      cursor: pointer;
    }
    .ctxmenu button:hover:not(:disabled) { background: rgba(255,255,255,0.08); }
    .ctxmenu button:disabled { opacity: 0.35; cursor: default; }
    .ctxmenu hr {
      border: 0;
      border-top: 1px solid rgba(255,255,255,0.1);
      margin: 4px 2px;
    }

    .rail-resize {
      position: fixed;
      left: calc(var(--deck-rail-w, 188px) - 3px);
      top: 0;
      bottom: 0;
      width: 6px;
      cursor: col-resize;
      z-index: 2147482600;
      touch-action: none;
    }
    .rail-resize:hover,
    .rail-resize[data-dragging] { background: rgba(255,255,255,0.12); }
    :host([no-rail]) .rail-resize,
    :host([noscale]) .rail-resize,
    .rail[data-presenting] + .rail-resize,
    .rail[data-user-hidden] + .rail-resize { display: none; }

    /* Delete-confirm popup — matches the SPA's ConfirmDialog layout
       (title + message body, depressed footer with Cancel / Delete). */
    .confirm-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.45);
      z-index: 2147483200;
      display: none;
      align-items: center;
      justify-content: center;
    }
    .confirm-backdrop[data-open] { display: flex; }
    .confirm {
      width: 320px;
      max-width: calc(100vw - 32px);
      background: #2a2a2a;
      color: #e8e8e8;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 12px;
      box-shadow: 0 12px 32px rgba(0,0,0,0.5);
      overflow: hidden;
      font-family: inherit;
      animation: deck-confirm-in 0.18s ease;
    }
    @keyframes deck-confirm-in {
      from { opacity: 0; transform: scale(0.96); }
      to { opacity: 1; transform: scale(1); }
    }
    .confirm .body { padding: 20px 20px 16px; }
    .confirm .title { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
    .confirm .msg { font-size: 13px; line-height: 1.5; color: rgba(255,255,255,0.65); }
    .confirm .footer {
      padding: 14px 20px;
      background: #1f1f1f;
      border-top: 1px solid rgba(255,255,255,0.08);
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    .confirm button {
      appearance: none;
      font: inherit;
      font-size: 13px;
      font-weight: 500;
      padding: 8px 16px;
      border-radius: 8px;
      cursor: pointer;
    }
    .confirm .cancel {
      background: transparent;
      border: 0;
      color: rgba(255,255,255,0.8);
    }
    .confirm .cancel:hover { background: rgba(255,255,255,0.08); }
    .confirm .danger {
      background: #c96442;
      border: 1px solid rgba(0,0,0,0.15);
      color: #fff;
      box-shadow: 0 1px 3px rgba(166,50,68,0.3), 0 2px 6px rgba(166,50,68,0.18);
    }
    .confirm .danger:hover { background: #b5563a; }

    /* ── Print: one page per slide, no chrome ────────────────────────────
       The screen layout stacks every slide at inset:0 inside a scaled
       canvas; for print we want them in document flow at the authored
       design size so the browser paginates one slide per sheet. The
       @page size is set from the width/height attributes via the inline
       <style id="deck-stage-print-page"> that _syncPrintPageRule appends
       to the document (the @page at-rule has no effect inside shadow DOM). */
    @media print {
      :host {
        position: static;
        inset: auto;
        background: none;
        overflow: visible;
        color: inherit;
      }
      .stage { position: static; display: block; }
      .canvas {
        transform: none !important;
        width: auto !important;
        height: auto !important;
        background: none;
        will-change: auto;
      }
      ::slotted(*) {
        position: relative !important;
        inset: auto !important;
        width: var(--deck-design-w) !important;
        height: var(--deck-design-h) !important;
        box-sizing: border-box !important;
        /* Size containment: slotted content that overflows the design box
         * (an image-slot's aspect-ratio-derived width, say) must not count
         * toward Chromium's print document width — without this, an
         * abs-positioned child past the page edge shrinks the whole PDF
         * to fit (~75%). Containment is safe here because the definite
         * width/height above size the slide regardless of content.
         * (Absorbed from PR #2619 with its owner's agreement.) */
        contain: size !important;
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto;
        break-after: page;
        page-break-after: always;
        break-inside: avoid;
        overflow: hidden;
      }
      /* :last-child alone isn't enough once data-deck-skip hides the
         trailing slide(s) — the last *visible* slide still carries
         break-after:page and prints a blank sheet. _markLastVisible()
         maintains data-deck-last-visible on the last non-skipped slide. */
      ::slotted(*:last-child),
      ::slotted([data-deck-last-visible]) {
        break-after: auto;
        page-break-after: auto;
      }
      ::slotted([data-deck-skip]) { display: none !important; }
      .overlay, .rail, .rail-resize, .ctxmenu, .confirm-backdrop { display: none !important; }
    }
  `;

  class DeckStage extends HTMLElement {
    static get observedAttributes() { return ['width', 'height', 'noscale', 'no-rail']; }

    constructor() {
      super();
      this._root = this.attachShadow({ mode: 'open' });
      this._index = 0;
      this._slides = [];
      // Explicit multi-selection (slide elements). Empty means the
      // selection is implicitly the current slide, so Delete always has
      // a well-defined target while the rail has focus.
      this._selected = new Set();
      this._selAnchor = null;
      this._notes = [];
      this._hideTimer = null;
      this._mouseIdleTimer = null;
      this._menuIndex = -1;
      // Overlay pinning: while the pointer is over the controls toolbar or
      // a control has keyboard focus, the idle-hide timeout must not
      // dismiss it (a pointer parked ON the controls doesn't generate
      // mousemove, so without the pin the toolbar vanishes under the
      // user's cursor after OVERLAY_HIDE_MS). Read by _flashOverlay's
      // hide timeout; cleared by mouseleave/focusout, which resume the
      // normal idle fade.
      this._overlayHover = false;
      this._overlayFocus = false;
      // Capability marker for the host's injected guest bundle. Copies
      // WITHOUT _navArrowsUpDown are frozen per-project builds that
      // predate native ArrowUp/ArrowDown slide nav — the bundle translates
      // Up/Down to Right/Left for those (installDeckArrowKeyTranslator in
      // apps/web/src/guest/edit-mode.ts) and must stand down here or every
      // press would advance twice. A marker, not a version number, so a
      // future capability can add its own independent probe.
      this._navArrowsUpDown = true;
      // Same contract for rail Delete/Backspace: copies WITHOUT
      // _railDeleteKey predate the thumbs' own Delete/Backspace binding,
      // and the bundle opens the delete confirm for them
      // (installDeckRailDeleteFallback in apps/web/src/guest/edit-mode.ts).
      // Current builds consume the key at the thumb (stopPropagation), so
      // the marker is belt-and-braces — it keeps the fallback standing
      // down even if a future build lets the key bubble past the thumb.
      this._railDeleteKey = true;
      // Same contract for skip-aware numbering: copies WITHOUT
      // _railSkipNumbers number every thumb 1..N and count skipped slides
      // in the overlay total — the bundle rewrites both for those
      // (installDeckSkipNumberingFallback in apps/web/src/guest/edit-mode.ts).
      // Here the component renumbers natively, so the fallback stands down.
      this._railSkipNumbers = true;

      this._onKey = this._onKey.bind(this);
      this._onResize = this._onResize.bind(this);
      this._onSlotChange = this._onSlotChange.bind(this);
      this._onMouseMove = this._onMouseMove.bind(this);
      this._onTap = this._onTap.bind(this);
      this._onMessage = this._onMessage.bind(this);
      // Capture-phase close so a click anywhere dismisses the menu, but
      // ignore clicks that land inside the menu itself — otherwise the
      // capture handler runs before the menu's own (bubble) handler and
      // clears _menuIndex out from under it.
      this._onDocClick = (e) => {
        if (this._menu && e.composedPath && e.composedPath().includes(this._menu)) return;
        this._closeMenu();
      };
    }

    get designWidth() {
      return parseInt(this.getAttribute('width'), 10) || DESIGN_W_DEFAULT;
    }
    get designHeight() {
      return parseInt(this.getAttribute('height'), 10) || DESIGN_H_DEFAULT;
    }

    connectedCallback() {
      // Presenter-view popup loads deckUrl?_snthumb=...#N for its prev/cur/
      // next thumbnails — the rail has no business rendering inside those
      // (wrong scale, and it offsets the stage so the thumb shows a gutter).
      if (/[?&]_snthumb=/.test(location.search)) this.setAttribute('no-rail', '');
      this._render();
      this._loadNotes();
      this._syncPrintPageRule();
      this._ensurePrintSizingMeta();
      this._ensureTextWrapDefaults();
      this._injectAnimRule();
      window.addEventListener('keydown', this._onKey);
      window.addEventListener('resize', this._onResize);
      window.addEventListener('mousemove', this._onMouseMove, { passive: true });
      window.addEventListener('message', this._onMessage);
      window.addEventListener('click', this._onDocClick, true);
      this.addEventListener('click', this._onTap);
      // Print lays every slide out as its own page, so [data-deck-active]-
      // gated entrance styles need the attribute on every slide (not just
      // the current one) or their content prints at the hidden base style.
      // The transient freeze style lands BEFORE the attributes so any
      // attribute-keyed transition fires at 0s (changing transition-
      // duration after a transition has started doesn't affect it).
      this._onBeforePrint = () => {
        this._syncPrintPageRule();
        // Self-heal: a departed doc-page may have removed the page-global
        // print-sizing meta this deck deferred to at connect time.
        this._ensurePrintSizingMeta();
        // Cancel runtime animation state before printing so every sheet
        // captures the authored base state. afterprint re-enters the same
        // slide and restores the fully-built preview state.
        if (this._animState) this._animClear(this._animState.slide);
        if (this._freezeStyle) this._freezeStyle.remove();
        this._freezeStyle = document.createElement('style');
        this._freezeStyle.textContent = '*,*::before,*::after{transition-duration:0s !important}';
        document.head.appendChild(this._freezeStyle);
        this._slides.forEach((s) => s.setAttribute('data-deck-active', ''));
      };
      this._onAfterPrint = () => {
        this._applyIndex({ showOverlay: false, broadcast: false });
        if (this._freezeStyle) { this._freezeStyle.remove(); this._freezeStyle = null; }
      };
      window.addEventListener('beforeprint', this._onBeforePrint);
      window.addEventListener('afterprint', this._onAfterPrint);
      // Initial collection + layout happens via slotchange, which fires on mount.
      this._enableRail();
      // Hold the stage hidden until webfonts are ready so the first visible
      // paint has the deck's real typography — the :not(:defined) guard in
      // the page HTML only covers custom-element upgrade, not font load.
      // Capped so a 404'd font URL can't blank the deck indefinitely.
      this.setAttribute('data-fonts-pending', '');
      const reveal = () => this.removeAttribute('data-fonts-pending');
      // Unconditional cap — rAF can be suspended in a hidden iframe, which
      // would strand the one inside the rAF callback.
      setTimeout(reveal, 2000);
      // rAF first: fonts.ready is a pre-resolved promise until layout has
      // resolved the slotted text's font-family and pushed a FontFace into
      // 'loading'. Reading it here in connectedCallback (parse-time) would
      // settle the race in a microtask before any font fetch starts.
      requestAnimationFrame(() => {
        Promise.race([
          document.fonts ? document.fonts.ready : Promise.resolve(),
          new Promise((r) => setTimeout(r, 2000)),
        ]).then(reveal, reveal);
      });
    }

    _enableRail() {
      // Idempotent — older host builds still post __omelette_rail_enabled.
      // no-rail guard keeps the observers/stylesheet walk off the cheap path
      // for presenter-popup thumbnail iframes (three per view — cur/prev/next).
      if (this._railEnabled || this.hasAttribute('no-rail')) return;
      this._railEnabled = true;
      // Per-viewer preference — restored alongside rail width. Default on;
      // only a stored '0' (from the TweaksPanel toggle) hides it.
      this._railVisible = true;
      try {
        if (localStorage.getItem('deck-stage.railVisible') === '0') this._railVisible = false;
      } catch (e) {}
      // Live thumbnail updates: watch the light-DOM slides for content
      // edits and re-clone just the affected thumb(s), debounced. Ignore
      // the data-deck-* / data-screen-label / data-om-validate attributes
      // this component itself writes so nav doesn't trigger spurious
      // refreshes — except data-deck-skip, which now arrives from the host
      // re-render and is what updates the rail badge, print bookkeeping,
      // and deckSkipped re-broadcast. Also ignore data-dc-tpl /
      // data-om-slide-id — host-reserved bookkeeping stamps (the host's
      // ATTR_RESERVED guard bounds them the same way) that structural
      // edits renumber/re-mint on slides whose content didn't change;
      // re-cloning on that churn is what made a slide move flash its
      // thumbnails.
      const OWN_ATTRS = /^data-(deck-(?!skip$)|screen-label$|om-(validate|slide-id)$|dc-tpl$)/;
      this._liveDirty = new Set();
      this._liveObserver = new MutationObserver((records) => {
        for (const r of records) {
          if (r.type === 'attributes' && OWN_ATTRS.test(r.attributeName || '')) continue;
          let n = r.target;
          while (n && n.parentElement !== this) n = n.parentElement;
          // Skip/unskip is handled below without re-cloning (the badge sits
          // on the thumb wrapper, not the clone) — don't mark the slide
          // dirty for an attr change whose only visible effect is the badge.
          if (n && this._slideSet && this._slideSet.has(n)
              && !(r.type === 'attributes' && r.attributeName === 'data-deck-skip')) {
            this._liveDirty.add(n);
          }
          // Host-driven skip toggle: sync the rail badge + print + presenter
          // skipped-list the way _toggleSkip used to do locally.
          if (r.type === 'attributes' && r.attributeName === 'data-deck-skip'
              && n && this._slideSet && this._slideSet.has(n)) {
            const i = this._slides.indexOf(n);
            if (this._thumbs && this._thumbs[i]) {
              if (n.hasAttribute('data-deck-skip')) this._thumbs[i].thumb.setAttribute('data-skip', '');
              else this._thumbs[i].thumb.removeAttribute('data-skip');
            }
            this._markLastVisible();
            this._renumberRail();
            this._syncCount();
            try { window.postMessage({ slideIndexChanged: this._index, deckTotal: this._slides.length, deckSkipped: this._skippedIndices() }, '*'); } catch (e) {}
          }
        }
        if (this._liveDirty.size && !this._liveTimer) {
          this._liveTimer = setTimeout(() => {
            this._liveTimer = null;
            this._liveDirty.forEach((s) => this._refreshThumb(s));
            this._liveDirty.clear();
          }, 200);
        }
      });
      this._liveObserver.observe(this, {
        subtree: true, childList: true, characterData: true, attributes: true,
      });
      // Lazy thumbnail materialization — clone the slide only when its
      // frame scrolls into (or near) the rail viewport. rootMargin gives
      // ~4 thumbs of pre-load so fast scrolling doesn't flash blanks.
      this._railObserver = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && e.target.__deckThumb) {
            this._materialize(e.target.__deckThumb);
          }
        });
      }, { root: this._rail, rootMargin: '400px 0px' });
      // Tweaks typically change CSS vars / attrs OUTSIDE <deck-stage>
      // (on <html>, <body>, a wrapper div, or a <style> tag), which
      // _liveObserver can't see. Re-snapshot author CSS (constructable
      // sheet is shared by reference, so one replaceSync updates every
      // thumb shadow root) and re-sync each thumb host's attrs + custom
      // properties. In-slide DOM mutations are _liveObserver's job.
      // Debounced so slider drags don't thrash.
      this._onTweakChange = () => {
        clearTimeout(this._tweakTimer);
        this._tweakTimer = setTimeout(() => {
          this._snapshotAuthorCss();
          // One getComputedStyle for the whole batch — each
          // getPropertyValue read below reuses the same computed style
          // as long as nothing invalidates layout between thumbs.
          const cs = getComputedStyle(this);
          (this._thumbs || []).forEach((t) => {
            if (t.host) this._syncThumbHostAttrs(t.host, cs);
          });
        }, 120);
      };
      window.addEventListener('tweakchange', this._onTweakChange);
      // Stylesheets that finish loading AFTER the snapshot below never
      // reach the thumbs on their own: a still-pending <link> contributes
      // nothing to document.styleSheets, and nothing re-reads it on load,
      // so the live slides restyle while every clone keeps the stale
      // sheet. dc-runtime's helmet mounts design-system <link>s at render
      // time, so a deck-stage that connects first snapshots before that
      // CSS exists. Funnel late arrivals into the same debounced resync:
      // hook load/error on every current <link>, and watch <head> for
      // links and styles mounted or rewritten later. Deliberately not
      // rAF- or fonts.ready-driven — rAF is throttled/suspended in hidden
      // iframes (thumbnail/presenter contexts), and a font-file load
      // doesn't change cssRules, so it needs no resync.
      this._hookedLinks = [];
      this._hookSheetLoad = (el) => {
        if (!el.matches || !el.matches('link[rel~="stylesheet" i]')) return;
        if (this._hookedLinks.indexOf(el) !== -1) return;
        this._hookedLinks.push(el);
        el.addEventListener('load', this._onTweakChange);
        el.addEventListener('error', this._onTweakChange);
      };
      document.querySelectorAll('link[rel~="stylesheet" i]')
        .forEach(this._hookSheetLoad);
      this._headObserver = new MutationObserver((records) => {
        let resync = false;
        for (const r of records) {
          if (r.type === 'characterData') {
            // Only <style> text is CSS — a ticking <title> shouldn't
            // wake the resync forever.
            const p = r.target.parentNode;
            if (p && p.nodeName === 'STYLE') resync = true;
            continue;
          }
          if (r.type === 'attributes') {
            // A late rel/href rewrite turns an inert <link> into a
            // stylesheet (hook it; its load fires even on cache hits);
            // a media/disabled flip changes effective rules with no
            // event. Resync only if this link is or ever was a
            // stylesheet — favicon/preload/canonical href churn isn't
            // a resync.
            if (r.target.nodeName === 'LINK') {
              this._hookSheetLoad(r.target);
              if (this._hookedLinks.indexOf(r.target) !== -1) resync = true;
            } else if (r.target.nodeName === 'STYLE') resync = true;
            continue;
          }
          // childList: only links and styles carry CSS. A new <link> has
          // no rules until it loads — hook it rather than resync now; a
          // <style> mount/unmount or text-node swap takes effect
          // immediately. _freezeStyle (our beforeprint helper) is skipped
          // on add only — no removal-side guard: _onAfterPrint nulls the
          // ref before the observer fires, so that check would be dead;
          // the one debounced no-op resync per print is harmless.
          if (r.target.nodeName === 'STYLE') resync = true;
          for (const n of r.addedNodes) {
            if (n.nodeName === 'LINK') this._hookSheetLoad(n);
            else if (n.nodeName === 'STYLE' && n !== this._freezeStyle) resync = true;
          }
          for (const n of r.removedNodes) {
            if (n.nodeName === 'LINK') {
              const hi = this._hookedLinks.indexOf(n);
              if (hi !== -1) {
                this._hookedLinks.splice(hi, 1);
                n.removeEventListener('load', this._onTweakChange);
                n.removeEventListener('error', this._onTweakChange);
                resync = true;
              }
            } else if (n.nodeName === 'STYLE') resync = true;
          }
        }
        if (resync) this._onTweakChange();
      });
      this._headObserver.observe(document.head, {
        childList: true, subtree: true, characterData: true,
        attributes: true, attributeFilter: ['rel', 'href', 'media', 'disabled'],
      });
      this._snapshotAuthorCss();
      // Re-snapshot once any still-loading stylesheet settles — it throws on
      // .cssRules above and silently contributes '' → unstyled thumbs on a
      // cold mount. {once:true}; routed through the debounced handler.
      document.querySelectorAll('link[rel~="stylesheet"]').forEach((l) => {
        try { if (l.sheet && l.sheet.cssRules) return; } catch (e) {}
        l.addEventListener('load', this._onTweakChange, { once: true });
        l.addEventListener('error', this._onTweakChange, { once: true });
      });
      if (document.fonts) document.fonts.ready.then(this._onTweakChange, this._onTweakChange);
      // Build the rail now that it's enabled — slotchange already fired,
      // so _renderRail's early-return skipped the initial build.
      this._syncRailHidden();
      this._renderRail();
      this._fit();
    }

    /** Snapshot document stylesheets into a constructable sheet that each
     *  thumbnail's nested shadow root adopts — so author CSS styles the
     *  cloned slide content without touching this component's chrome.
     *  Cross-origin sheets throw on .cssRules — skip them. Re-callable:
     *  the existing constructable sheet is reused via replaceSync so every
     *  already-adopted shadow root picks up the fresh CSS without re-adopt. */
    _snapshotAuthorCss() {
      // :root in an adopted sheet inside a shadow root matches nothing
      // (only the document root qualifies), so author rules like
      // `:root[data-voice="modern"] .serif` never reach the clones.
      // Rewrite :root → :host and mirror <html>'s data-*/class/lang onto
      // each thumb host (see _syncThumbHostAttrs) so the same selectors
      // match inside the thumbnail's shadow tree.
      const authorCss = Array.from(document.styleSheets).map((sh) => {
        try {
          return Array.from(sh.cssRules).map((r) => r.cssText).join('\n');
        } catch (e) { return ''; }
      }).join('\n')
        // The shadow host is featureless outside the functional :host(...)
        // form, so any compound on :root — [attr], .class, #id, :pseudo —
        // must become :host(<compound>) not :host<compound>. Same for the
        // html type selector (Tailwind class-strategy dark mode emits
        // html.dark; Pico uses html[data-theme]), which has nothing to
        // match inside the thumb's shadow tree.
        .replace(/:root((?:\[[^\]]*\]|[.#][-\w]+|:[-\w]+(?:\([^)]*\))?)+)/g, ':host($1)')
        .replace(/:root\b/g, ':host')
        .replace(/(^|[\s,>~+(}])html((?:\[[^\]]*\]|[.#][-\w]+|:[-\w]+(?:\([^)]*\))?)+)(?![-\w])/g, '$1:host($2)')
        .replace(/(^|[\s,>~+(}])html(?![-\w])/g, '$1:host');
      // Every custom property the author references. _syncThumbHostAttrs
      // mirrors each one's *computed* value at <deck-stage> onto the
      // thumb host so the live value wins over the :host default above
      // regardless of which ancestor the tweak wrote to (<html>, <body>,
      // a wrapper div, or the deck-stage element itself all inherit
      // down to getComputedStyle(this)).
      this._authorVars = new Set(authorCss.match(/--[\w-]+/g) || []);
      try {
        if (!this._adoptedSheet) this._adoptedSheet = new CSSStyleSheet();
        this._adoptedSheet.replaceSync(authorCss);
      } catch (e) {
        this._adoptedSheet = null;
        this._authorCss = authorCss;
      }
    }

    _syncThumbHostAttrs(host, cs) {
      const de = document.documentElement;
      // setAttribute overwrites but can't delete — an attr removed from
      // <html> (toggleAttribute off, classList emptied) would linger on
      // the host and :host([data-*]) / :host(.foo) rules would keep
      // matching. Remove stale mirrored attrs first; iterate backward
      // because removeAttribute mutates the live NamedNodeMap.
      for (let i = host.attributes.length - 1; i >= 0; i--) {
        const n = host.attributes[i].name;
        if ((n.startsWith('data-') || n === 'class' || n === 'lang')
            && !de.hasAttribute(n)) {
          host.removeAttribute(n);
        }
      }
      for (const a of de.attributes) {
        if (a.name.startsWith('data-') || a.name === 'class' || a.name === 'lang') {
          host.setAttribute(a.name, a.value);
        }
      }
      // The :root→:host rewrite in _snapshotAuthorCss pins each custom
      // property to its stylesheet default on the thumb host, shadowing
      // the live value that would otherwise inherit. Tweaks can write the
      // live value on any ancestor — <html>, <body>, a wrapper div, the
      // deck-stage element — so read it as the *computed* value at
      // <deck-stage> (which sees the whole inheritance chain) rather than
      // trying to guess which element the author wrote to. Inline on the
      // host beats the :host{} rule. remove-stale covers vars dropped
      // from the stylesheet between snapshots.
      const vars = this._authorVars || new Set();
      for (let i = host.style.length - 1; i >= 0; i--) {
        const p = host.style[i];
        if (p.startsWith('--') && !vars.has(p)) host.style.removeProperty(p);
      }
      const live = cs || getComputedStyle(this);
      vars.forEach((p) => {
        const v = live.getPropertyValue(p);
        if (v) host.style.setProperty(p, v.trim());
        else host.style.removeProperty(p);
      });
    }

    disconnectedCallback() {
      // A disconnect mid-drag never gets a dragend, so the document-level
      // drag tracker must be torn down here like every other global hook.
      this._stopDragTrack();
      window.removeEventListener('keydown', this._onKey);
      window.removeEventListener('resize', this._onResize);
      window.removeEventListener('mousemove', this._onMouseMove);
      window.removeEventListener('message', this._onMessage);
      window.removeEventListener('click', this._onDocClick, true);
      window.removeEventListener('beforeprint', this._onBeforePrint);
      window.removeEventListener('afterprint', this._onAfterPrint);
      if (this._freezeStyle) { this._freezeStyle.remove(); this._freezeStyle = null; }
      this.removeEventListener('click', this._onTap);
      if (this._hideTimer) clearTimeout(this._hideTimer);
      if (this._mouseIdleTimer) clearTimeout(this._mouseIdleTimer);
      if (this._liveTimer) clearTimeout(this._liveTimer);
      if (this._tweakTimer) clearTimeout(this._tweakTimer);
      if (this._railAnimTimer) clearTimeout(this._railAnimTimer);
      if (this._scaleRaf) cancelAnimationFrame(this._scaleRaf);
      if (this._liveObserver) this._liveObserver.disconnect();
      if (this._railObserver) this._railObserver.disconnect();
      if (this._headObserver) this._headObserver.disconnect();
      (this._hookedLinks || []).forEach((l) => {
        l.removeEventListener('load', this._onTweakChange);
        l.removeEventListener('error', this._onTweakChange);
      });
      this._hookedLinks = [];
      if (this._onTweakChange) window.removeEventListener('tweakchange', this._onTweakChange);
      // Drop the text-wrap defaults when the last deck-stage leaves, so a
      // deleted deck's typography can't restyle whatever replaces it.
      // (#deck-stage-print-page keeps its existing keep-forever lifecycle.)
      if (!document.querySelector('deck-stage')) {
        const tw = document.getElementById('deck-stage-text-wrap');
        if (tw) tw.remove();
        const ps = document.getElementById('deck-stage-print-sizing');
        if (ps) ps.remove();
      }
    }

    attributeChangedCallback(name) {
      // noscale is the PPTX exporter's capture context — its DOM snapshot
      // must see the authored base state, so drop every slide's animation
      // state the moment the attribute appears.
      if (name === 'noscale' && this.hasAttribute('noscale')) {
        (this._slides || []).forEach((s) => this._animClear(s));
      }
      if (this._canvas) {
        this._canvas.style.width = this.designWidth + 'px';
        this._canvas.style.height = this.designHeight + 'px';
        this._canvas.style.setProperty('--deck-design-w', this.designWidth + 'px');
        this._canvas.style.setProperty('--deck-design-h', this.designHeight + 'px');
        if (this._rail) {
          this._rail.style.setProperty('--deck-aspect', this.designWidth + '/' + this.designHeight);
        }
        this._fit();
        this._scaleThumbs();
        this._syncPrintPageRule();
      }
    }

    _render() {
      const style = document.createElement('style');
      style.textContent = stylesheet;

      const stage = document.createElement('div');
      stage.className = 'stage';

      const canvas = document.createElement('div');
      canvas.className = 'canvas';
      canvas.style.width = this.designWidth + 'px';
      canvas.style.height = this.designHeight + 'px';
      canvas.style.setProperty('--deck-design-w', this.designWidth + 'px');
      canvas.style.setProperty('--deck-design-h', this.designHeight + 'px');

      const slot = document.createElement('slot');
      slot.addEventListener('slotchange', this._onSlotChange);
      canvas.appendChild(slot);
      stage.appendChild(canvas);

      // Overlay: compact, solid black, with clickable controls.
      const overlay = document.createElement('div');
      overlay.className = 'overlay export-hidden';
      overlay.setAttribute('role', 'toolbar');
      overlay.setAttribute('aria-label', 'Deck controls');
      overlay.setAttribute('data-omelette-chrome', '');
      overlay.innerHTML = `
        <button class="btn prev" type="button" aria-label="Previous slide" title="Previous (←)">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3L5 8l5 5"/></svg>
        </button>
        <span class="count" aria-live="polite"><span class="current">1</span><span class="sep">/</span><span class="total">1</span></span>
        <button class="btn next" type="button" aria-label="Next slide" title="Next (→)">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3l5 5-5 5"/></svg>
        </button>
        <span class="divider"></span>
        <button class="btn reset" type="button" aria-label="Reset to first slide" title="Reset (R)">Reset<span class="kbd">R</span></button>
      `;

      overlay.querySelector('.prev').addEventListener('click', () => this._advance(-1, 'click'));
      overlay.querySelector('.next').addEventListener('click', () => this._advance(1, 'click'));
      overlay.querySelector('.reset').addEventListener('click', () => this._go(0, 'click'));

      // Pin the controls while the user is interacting with them —
      // hovering, or keyboard focus on a control. The hidden overlay is
      // pointer-events:none, so these only ever engage while it's already
      // visible. 'pointer' source: these are user-interaction paths, so
      // they may show/refresh the overlay even while presenting (see
      // _flashOverlay).
      overlay.addEventListener('mouseenter', () => {
        this._overlayHover = true;
        this._flashOverlay('pointer');
      });
      overlay.addEventListener('mouseleave', () => {
        const hadPin = this._overlayHover;
        this._overlayHover = false;
        // Resume the idle fade — never summon. Without the guard, a
        // mouseleave that fires because the overlay was force-hidden
        // (presenting entry flips it to pointer-events:none under the
        // cursor) would pop the controls right back up.
        if (hadPin || overlay.hasAttribute('data-visible'))
          this._flashOverlay('pointer');
      });
      overlay.addEventListener('focusin', (e) => {
        // Keyboard-origin focus only (:focus-visible): a mouse click also
        // focuses the clicked button, and pinning on that would hold the
        // controls open indefinitely after a single click — the hover pin
        // already covers the mouse case. Engines without :focus-visible
        // fall back to pinning on any focus (the safe direction).
        var kb = true;
        try {
          var t = e.target;
          kb = !(t && t.matches && !t.matches(':focus-visible'));
        } catch (err) { kb = true; }
        if (!kb) return;
        this._overlayFocus = true;
        this._flashOverlay('pointer');
      });
      overlay.addEventListener('focusout', (e) => {
        // Only unpin when focus truly left the toolbar — tabbing between
        // its buttons stays pinned. relatedTarget is null when focus
        // leaves the document entirely; treat that as leaving.
        if (e.relatedTarget && overlay.contains(e.relatedTarget)) return;
        const hadPin = this._overlayFocus;
        this._overlayFocus = false;
        // Resume-the-fade only (see mouseleave): a click-focused button
        // losing focus to a later stage click must not summon the
        // controls mid-presentation.
        if (hadPin || overlay.hasAttribute('data-visible'))
          this._flashOverlay('pointer');
      });

      // Thumbnail rail + context menu. Thumbnails are populated in
      // _renderRail() after _collectSlides().
      const rail = document.createElement('div');
      rail.className = 'rail export-hidden';
      rail.setAttribute('data-omelette-chrome', '');
      // Edit mode hooks wheel to pan the canvas; this opts the rail's own
      // scrollview out so thumbnails stay scrollable while editing.
      rail.setAttribute('data-dc-wheel-passthru', '');
      rail.style.setProperty('--deck-aspect', this.designWidth + '/' + this.designHeight);
      // Edge auto-scroll while dragging a thumb near the rail's top/bottom
      // so off-screen drop targets are reachable. Native dragover fires
      // continuously while the pointer is stationary, so a per-event nudge
      // (ramped by edge proximity) is enough — no rAF loop needed.
      rail.addEventListener('dragover', (e) => {
        if (this._dragFrom == null) return;
        const r = rail.getBoundingClientRect();
        const EDGE = 40;
        const dt = e.clientY - r.top;
        const db = r.bottom - e.clientY;
        if (dt < EDGE) rail.scrollTop -= Math.ceil((EDGE - dt) / 3);
        else if (db < EDGE) rail.scrollTop += Math.ceil((EDGE - db) / 3);
      });

      const menu = document.createElement('div');
      menu.className = 'ctxmenu export-hidden';
      menu.setAttribute('data-omelette-chrome', '');
      menu.innerHTML = `
        <button type="button" data-act="skip">Skip slide</button>
        <button type="button" data-act="up">Move up</button>
        <button type="button" data-act="down">Move down</button>
        <button type="button" data-act="duplicate">Duplicate slide</button>
        <hr>
        <button type="button" data-act="delete">Delete slide</button>
      `;
      menu.addEventListener('click', (e) => {
        const act = e.target && e.target.getAttribute && e.target.getAttribute('data-act');
        if (!act) return;
        const i = this._menuIndex;
        const list = this._menuIndices;
        this._closeMenu();
        if (act === 'skip') this._toggleSkip(i);
        else if (act === 'up') this._moveSlide(i, i - 1);
        else if (act === 'down') this._moveSlide(i, i + 1);
        else if (act === 'duplicate') this._duplicateSlide(i);
        else if (act === 'delete') this._openConfirm(list && list.length ? list : [i]);
      });
      menu.addEventListener('contextmenu', (e) => e.preventDefault());

      // Rail resize handle — drag to set --deck-rail-w, persisted to
      // localStorage so the width survives reloads.
      const resize = document.createElement('div');
      resize.className = 'rail-resize export-hidden';
      resize.setAttribute('data-omelette-chrome', '');
      resize.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        resize.setPointerCapture(e.pointerId);
        resize.setAttribute('data-dragging', '');
        const move = (ev) => this._setRailWidth(ev.clientX);
        const up = () => {
          resize.removeEventListener('pointermove', move);
          resize.removeEventListener('pointerup', up);
          resize.removeEventListener('pointercancel', up);
          resize.removeAttribute('data-dragging');
          try { localStorage.setItem('deck-stage.railWidth', String(this._railPx)); } catch (err) {}
        };
        resize.addEventListener('pointermove', move);
        resize.addEventListener('pointerup', up);
        resize.addEventListener('pointercancel', up);
      });

      // Delete-confirm dialog — mirrors the SPA's ConfirmDialog layout.
      const confirm = document.createElement('div');
      confirm.className = 'confirm-backdrop export-hidden';
      confirm.setAttribute('data-omelette-chrome', '');
      confirm.innerHTML = `
        <div class="confirm" role="dialog" aria-modal="true">
          <div class="body">
            <div class="title">Delete slide?</div>
            <div class="msg">This slide will be removed from the deck.</div>
          </div>
          <div class="footer">
            <button type="button" class="cancel">Cancel</button>
            <button type="button" class="danger">Delete</button>
          </div>
        </div>
      `;
      confirm.addEventListener('click', (e) => {
        if (e.target === confirm) {
          this._closeConfirm();
          this._focusCurrentThumb();
        }
      });
      confirm.querySelector('.cancel').addEventListener('click', () => {
        this._closeConfirm();
        this._focusCurrentThumb();
      });
      confirm.querySelector('.danger').addEventListener('click', () => {
        // Re-resolve at click time — the elements are the user's actual
        // selection; their indices may have shifted since confirm-open.
        const list = (this._confirmEls || [])
          .map((el) => this._slides.indexOf(el))
          .filter((i) => i >= 0);
        this._closeConfirm();
        this._deleteSlides(list);
        this._focusCurrentThumb();
      });

      this._root.append(style, rail, resize, stage, overlay, menu, confirm);
      this._canvas = canvas;
      this._stage = stage;
      this._slot = slot;
      this._overlay = overlay;
      this._rail = rail;
      this._resize = resize;
      this._menu = menu;
      this._confirm = confirm;
      this._countEl = overlay.querySelector('.current');
      this._totalEl = overlay.querySelector('.total');

      // Restore persisted rail width.
      let rw = 188;
      try {
        const s = localStorage.getItem('deck-stage.railWidth');
        if (s) rw = parseInt(s, 10) || rw;
      } catch (err) {}
      this._setRailWidth(rw);
      this._syncRailHidden();
    }

    _setRailWidth(px) {
      const w = Math.max(120, Math.min(360, Math.round(px)));
      this._railPx = w;
      this.style.setProperty('--deck-rail-w', w + 'px');
      this._fit();
      // _scaleThumbs forces a sync layout (frame.offsetWidth) then writes
      // N transforms. During a resize drag this runs per-pointermove;
      // coalesce to one per frame.
      if (!this._scaleRaf) {
        this._scaleRaf = requestAnimationFrame(() => {
          this._scaleRaf = null;
          this._scaleThumbs();
        });
      }
    }

    /** @page must live in the document stylesheet — it's a no-op inside
     *  shadow DOM. (Re-)append so any author @page landing later in
     *  source order can't reintroduce a margin and push each slide onto
     *  two sheets; called again from beforeprint. */
    _syncPrintPageRule() {
      const id = 'deck-stage-print-page';
      let tag = document.getElementById(id);
      if (!tag) {
        tag = document.createElement('style');
        tag.id = id;
      }
      (document.body || document.head).appendChild(tag);
      tag.textContent =
        '@page { size: ' + this.designWidth + 'px ' + this.designHeight + 'px; margin: 0; } ' +
        '@media print { html, body { margin: 0 !important; padding: 0 !important; background: none !important; overflow: visible !important; height: auto !important; } ' +
        '* { -webkit-print-color-adjust: exact; print-color-adjust: exact; ' +
        'backdrop-filter: none !important; -webkit-backdrop-filter: none !important; } ' +
        // Jump authored animations/transitions to their end state so print
        // never captures mid-entrance — pairs with the beforeprint handler
        // in connectedCallback that sets data-deck-active on every slide.
        '*, *::before, *::after { animation-delay: -99s !important; animation-duration: .001s !important; ' +
        'animation-iteration-count: 1 !important; animation-fill-mode: both !important; ' +
        'animation-play-state: running !important; transition-duration: 0s !important; } }';
    }

    /** Announces the deck's print-sizing mode to the host app:
     *  meta[name="omelette-print-sizing"] content "default-landscape" — a
     *  deck prints one slide per page on the user's paper size, landscape.
     *  The export path probes the meta to decide what true paper size to
     *  inject at print time (the @page px rule above stays as the
     *  standalone-print fallback; an injected later rule overrides it).
     *  Never overrides an authored meta or another component's; removed
     *  when the last deck-stage leaves. data-omelette-injected keeps it
     *  out of serialized source. */
    _ensurePrintSizingMeta() {
      if (document.querySelector('meta[name="omelette-print-sizing"]')) return;
      const tag = document.createElement('meta');
      tag.id = 'deck-stage-print-sizing';
      tag.name = 'omelette-print-sizing';
      tag.content = 'default-landscape';
      tag.setAttribute('data-omelette-injected', '');
      document.head.appendChild(tag);
    }

    /** Typographic defaults for slide text: balance headings, avoid
     *  widowed/orphaned words in body copy (browsers without text-wrap
     *  support drop the declarations). Zero-specificity via :where() so
     *  any text-wrap authored on those elements wins. Lives in the document,
     *  not the shadow root, for two reasons: document rules reach the
     *  slotted (light DOM) slides, and _snapshotAuthorCss copies document
     *  stylesheets into each thumbnail's shadow root, so the thumbs wrap
     *  the same way — a deck-stage-scoped selector would match nothing
     *  there. data-omelette-injected marks the tag for the host editor
     *  to strip at serialize, so it is never written back as authored
     *  source. */
    _ensureTextWrapDefaults() {
      if (document.getElementById('deck-stage-text-wrap')) return;
      const tag = document.createElement('style');
      tag.id = 'deck-stage-text-wrap';
      tag.setAttribute('data-omelette-injected', '');
      tag.textContent =
        ':where(h1,h2,h3,h4,h5,h6){text-wrap:balance}' +
        ':where(p,li,blockquote,figcaption){text-wrap:pretty}';
      document.head.appendChild(tag);
    }

    _onSlotChange() {
      // Self-mutate path already reconciled synchronously and emitted
      // slidechange; skip the async slotchange it caused.
      if (this._squelchSlotChange) { this._squelchSlotChange = false; return; }
      // Primary lock-clear is the host's __deck_rail_ack; this clears on a
      // dropped ack so the rail can't stay dead.
      this._railLock = false;
      this._collectSlides();
      this._restoreIndex();
      this._applyIndex({ showOverlay: false, broadcast: true, reason: 'init' });
      this._fit();
      // The deck just changed under any open rail surface — an open
      // confirm or menu is a question about the OLD deck (its labels and
      // counts may now lie), so close them rather than let a stale
      // answer fire. The element-held selection re-resolves, but the
      // user should re-read what they're deleting.
      if (this._confirm && this._confirm.hasAttribute('data-open')) {
        this._closeConfirm();
        // The dialog held focus (danger button); hand it back to the rail.
        this._focusCurrentThumb(true);
      }
      if (this._menu && this._menu.hasAttribute('data-open')) this._closeMenu();
      // Editor-mode deletes rebuild the rail through here; a confirmed
      // delete that started from the keyboard still owes focus to the
      // (new) current thumb.
      if (this._pendingRailRefocus) this._focusCurrentThumb(true);
    }

    _collectSlides() {
      const assigned = this._slot.assignedElements({ flatten: true });
      this._slides = assigned.filter((el) => {
        // Skip template/style/script nodes even if someone slots them.
        const tag = el.tagName;
        return tag !== 'TEMPLATE' && tag !== 'SCRIPT' && tag !== 'STYLE';
      });
      this._slideSet = new Set(this._slides);
      // Selection is element-keyed: drop entries whose slide is gone
      // (deleted, or replaced wholesale by a host re-render).
      if (this._selected && this._selected.size) {
        this._selected.forEach((s) => {
          if (!this._slideSet.has(s)) this._selected.delete(s);
        });
      }
      if (this._selAnchor && !this._slideSet.has(this._selAnchor)) this._selAnchor = null;

      this._slides.forEach((slide, i) => {
        const n = i + 1;
        slide.setAttribute('data-screen-label', `${pad2(n)} ${getSlideLabel(slide)}`);

        // Validation attribute for comment flow / auto-checks.
        if (!slide.hasAttribute('data-om-validate')) {
          slide.setAttribute('data-om-validate', VALIDATE_ATTR);
        }

        slide.setAttribute('data-deck-slide', String(i));
      });

      if (this._index >= this._slides.length) this._index = Math.max(0, this._slides.length - 1);
      this._markLastVisible();
      this._syncCount();
      this._renderRail();
    }

    /** Tag the last non-skipped slide so print CSS can drop its
     *  break-after (see the @media print comment above — :last-child
     *  alone matches a hidden skipped slide). */
    _markLastVisible() {
      let last = null;
      this._slides.forEach((s) => {
        s.removeAttribute('data-deck-last-visible');
        if (!s.hasAttribute('data-deck-skip')) last = s;
      });
      if (last) last.setAttribute('data-deck-last-visible', '');
    }

    _loadNotes() {
      // Per-slide data-speaker-notes is authoritative when present (attrs
      // travel with the element on reorder/dup/delete); a slide without
      // the attr falls through to the legacy #speaker-notes JSON array
      // PER SLIDE so a single attr on a JSON-authored deck doesn't blank
      // the rest.
      const tag = document.getElementById('speaker-notes');
      let json = null;
      if (tag) try {
        const p = JSON.parse(tag.textContent || '[]');
        if (Array.isArray(p)) json = p;
      } catch (e) {
        console.warn('[deck-stage] Failed to parse #speaker-notes JSON:', e);
      }
      this._notes = this._slides.map((s, i) => {
        const a = s.getAttribute('data-speaker-notes');
        return a !== null ? a : (json && typeof json[i] === 'string' ? json[i] : '');
      });
    }

    _restoreIndex() {
      // The host's ?slide= param is delivered as a #<int> hash (1-indexed) on
      // the iframe src. No hash → slide 1; the deck itself keeps no position
      // state across loads.
      const h = (location.hash || '').match(/^#(\d+)$/);
      if (h) {
        const n = parseInt(h[1], 10) - 1;
        if (n >= 0 && n < this._slides.length) this._index = n;
      }
    }

    _applyIndex({ showOverlay = true, broadcast = true, reason = 'init' } = {}) {
      if (!this._slides.length) return;
      const prev = this._prevIndex == null ? -1 : this._prevIndex;
      const curr = this._index;
      // Keep the iframe's own hash in sync so an in-iframe location.reload()
      // (reload banner path in viewer-handle.ts) lands on the current slide,
      // not the stale deep-link hash from initial load.
      try { history.replaceState(null, '', '#' + (curr + 1)); } catch (e) {}
      this._slides.forEach((s, i) => {
        if (i === curr) s.setAttribute('data-deck-active', '');
        else s.removeAttribute('data-deck-active');
      });
      // Forward arrival resets and autoplays the automatic step; backward
      // arrival lands fully built. Direct/same-index re-entry restores the
      // built state without replaying.
      this._animOnNav(prev, curr);
      this._syncCount();
      // Follow-scroll on every navigation (init deep-link, keyboard, click,
      // tap, external goTo) — the only time we *don't* want the rail to
      // track current is after a rail-internal mutation, where _renderRail
      // has already restored the user's scroll position and yanking back to
      // current would undo it.
      this._syncRail(reason !== 'mutation');

      if (broadcast) {
        // (1) Legacy: host-window postMessage for speaker-notes renderers.
        try { window.postMessage({ slideIndexChanged: curr, deckTotal: this._slides.length, deckSkipped: this._skippedIndices() }, '*'); } catch (e) {}

        // (2) In-page CustomEvent on the <deck-stage> element itself.
        //     Bubbles and composes out of shadow DOM so slide code can listen:
        //       document.querySelector('deck-stage').addEventListener('slidechange', e => {
        //         e.detail.index, e.detail.previousIndex, e.detail.total, e.detail.slide, e.detail.reason
        //       });
        const detail = {
          index: curr,
          previousIndex: prev,
          total: this._slides.length,
          slide: this._slides[curr] || null,
          previousSlide: prev >= 0 ? (this._slides[prev] || null) : null,
          reason: reason, // 'init' | 'keyboard' | 'click' | 'tap' | 'api'
        };
        this.dispatchEvent(new CustomEvent('slidechange', {
          detail,
          bubbles: true,
          composed: true,
        }));
      }

      this._prevIndex = curr;
      if (showOverlay) this._flashOverlay();
    }

    _flashOverlay(source) {
      // Host posts __omelette_presenting while in fullscreen/tab
      // presentation mode. While presenting, the overlay is
      // pointer-summoned only: it appears on mouse movement and while the
      // user hovers/focuses the controls (source 'pointer'), but never
      // flashes on slide changes or nav-key presses (the default 'auto'
      // source) — a keyboard-driven advance must not blink chrome at the
      // audience. Outside presenting, both sources flash as before.
      if (!this._overlay) return;
      if (this._presenting && source !== 'pointer') return;
      this._overlay.setAttribute('data-visible', '');
      if (this._hideTimer) clearTimeout(this._hideTimer);
      this._hideTimer = setTimeout(() => {
        // Pinned by hover or focus on the controls — keep them up. The
        // matching mouseleave/focusout re-flashes, so the idle fade
        // resumes from that moment.
        if (this._overlayHover || this._overlayFocus) return;
        this._overlay.removeAttribute('data-visible');
      }, OVERLAY_HIDE_MS);
    }

    _railWidth() {
      // State-based, no offsetWidth: the first _fit() can run before the
      // rail has had layout on some load paths, and a 0 there paints the
      // slide full-width for one frame before the post-slotchange _fit()
      // corrects it.
      if (!this._railEnabled || !this._railVisible || this.hasAttribute('no-rail')
          || this.hasAttribute('noscale') || this._presenting || this._previewMode
          || NARROW_MQ.matches) return 0;
      return this._railPx || 0;
    }

    _fit() {
      if (!this._canvas) return;
      const stage = this._canvas.parentElement;
      // PPTX export sets noscale so the DOM capture sees authored-size
      // geometry — the scaled canvas is in shadow DOM, so the exporter's
      // resetTransformSelector can't reach .canvas.style.transform directly.
      if (this.hasAttribute('noscale')) {
        this._canvas.style.transform = 'none';
        this._scale = 1;
        if (stage) stage.style.left = '0';
        if (this._overlay) this._overlay.style.marginLeft = '0';
        return;
      }
      const rw = this._railWidth();
      if (stage) stage.style.left = rw + 'px';
      // Overlay is centred on the viewport via left:50% + translate(-50%);
      // marginLeft shifts the centre by rw/2 so it lands in the middle of
      // the [rw, innerWidth] stage region.
      if (this._overlay) this._overlay.style.marginLeft = (rw / 2) + 'px';
      const vw = window.innerWidth - rw;
      const vh = window.innerHeight;
      const s = Math.min(vw / this.designWidth, vh / this.designHeight);
      // Fly-distance math needs design-space px; element rects come back
      // viewport-scaled, so _animFlyOffset divides by this.
      this._scale = s;
      this._canvas.style.transform = `scale(${s})`;
    }

    _onResize() {
      this._fit();
      // Crossing the narrow-viewport breakpoint reveals the rail — rerun the
      // thumbnail scale the same way _setRailWidth does.
      if (!this._scaleRaf) {
        this._scaleRaf = requestAnimationFrame(() => {
          this._scaleRaf = null;
          this._scaleThumbs();
        });
      }
    }

    _onMouseMove() {
      // Keep overlay visible while mouse moves; hide after idle. 'pointer'
      // source: mouse movement summons the controls even while presenting.
      this._flashOverlay('pointer');
    }

    _onMessage(e) {
      const d = e.data;
      if (d && typeof d.__omelette_presenting === 'boolean') {
        // Unchanged value → idempotent re-delivery (the guest bundle
        // re-posts when a deck mounts mid-presentation, and host + bundle
        // can both deliver at entry). Skip the resets: re-running the
        // entry work on every delivery would dismiss the pointer-summoned
        // overlay under a hovering cursor and close menus on every slide
        // change. Mirrors the preview_mode branch's unchanged-value guard
        // below.
        if (d.__omelette_presenting !== !!this._presenting) {
          this._presenting = d.__omelette_presenting;
          // A presenting transition invalidates interaction pins: carried
          // across the flip, a stale pin would hold the first summoned
          // overlay open with no pointer anywhere near it. Hide on BOTH
          // transitions: entry cleans the audience's screen, and on exit a
          // pin-skipped hide timeout may have left data-visible set with
          // no timer armed — without this, the footer would linger in the
          // editor until the next mousemove. The next interaction
          // re-summons it either way.
          this._overlayHover = false;
          this._overlayFocus = false;
          if (this._overlay) {
            this._overlay.removeAttribute('data-visible');
            if (this._hideTimer) clearTimeout(this._hideTimer);
          }
          this._syncRailHidden();
          this._closeMenu();
          this._closeConfirm();
          this._fit();
          this._scaleThumbs();
        }
      }
      // Host's Preview segment (ViewerMode='none'): the rail's drag-reorder /
      // right-click skip-delete affordances are editing chrome, so hide it
      // while the user is just looking at the deck. Same hard-hide path as
      // presenting; independent of the user's _railVisible preference so
      // returning to Edit restores whatever they had.
      if (d && typeof d.__omelette_preview_mode === 'boolean') {
        if (d.__omelette_preview_mode === this._previewMode) return;
        this._previewMode = d.__omelette_preview_mode;
        this._syncRailHidden();
        this._closeMenu();
        this._closeConfirm();
        this._fit();
        this._scaleThumbs();
      }
      // Host has processed a dc-op; rail input is safe again. Not tied to
      // slotchange — setAttr and refusal don't fire one. On refusal,
      // revert the optimistic _index/hash adjustment so the next nav
      // starts from what's actually on screen.
      if (d && d.__dc_op_ack) {
        this._railLock = false;
        if (d.applied === false && this._indexBeforeEmit != null) {
          this._index = this._indexBeforeEmit;
          try { history.replaceState(null, '', '#' + (this._index + 1)); } catch (e) {}
        }
        this._indexBeforeEmit = null;
        // A refused op never re-renders, so slotchange won't restore the
        // keyboard flow's focus — do it here. (Applied ops refocus in
        // _onSlotChange, after the rail has been rebuilt.)
        if (d.applied === false && this._pendingRailRefocus) {
          this._focusCurrentThumb(true);
        }
      }
      // Per-viewer show/hide, driven by the TweaksPanel's auto-injected
      // "Thumbnail rail" toggle (or any author script). Independent of
      // whether the Tweaks panel itself is open — closing the panel
      // doesn't change rail visibility. Persists alongside rail width.
      if (d && d.type === '__deck_rail_visible' && typeof d.on === 'boolean') {
        if (d.on === this._railVisible) return;
        this._railVisible = d.on;
        try { localStorage.setItem('deck-stage.railVisible', d.on ? '1' : '0'); } catch (e) {}
        // Arm the transition, commit it, then flip state — otherwise the
        // browser coalesces both writes and nothing animates on show.
        this.setAttribute('data-rail-anim', '');
        void (this._rail && this._rail.offsetHeight);
        this._syncRailHidden();
        this._fit();
        this._scaleThumbs();
        clearTimeout(this._railAnimTimer);
        this._railAnimTimer = setTimeout(() => this.removeAttribute('data-rail-anim'), 220);
      }
      if (d && d.type === '__omelette_rail_enabled') this._enableRail();
    }

    _syncRailHidden() {
      if (!this._rail) return;
      // data-presenting is the hard hide (display:none) for flag-off,
      // presentation mode, and the host's Preview segment — instant, no
      // transition. data-user-hidden is the soft hide (translateX(-100%))
      // for the viewer's rail toggle, so show/hide slides under
      // :host([data-rail-anim]).
      const hard = !this._railEnabled || this._presenting || this._previewMode;
      if (hard) this._rail.setAttribute('data-presenting', '');
      else this._rail.removeAttribute('data-presenting');
      if (!this._railVisible) this._rail.setAttribute('data-user-hidden', '');
      else this._rail.removeAttribute('data-user-hidden');
      // translateX hide leaves thumbs (tabIndex=0) in the tab order —
      // inert keeps them unfocusable while the rail is off-screen.
      this._rail.inert = hard || !this._railVisible;
    }

    _onTap(e) {
      // Touch-only — keyboard + the overlay toolbar cover nav on desktop.
      if (FINE_POINTER_MQ.matches) return;
      // Only taps that land on the stage (slide content or letterbox); the
      // overlay / rail / menus are siblings with their own click handlers.
      const path = e.composedPath();
      if (!this._stage || !path.includes(this._stage)) return;
      // Let interactive slide content keep the tap. composedPath (not
      // e.target.closest) so we see through open shadow roots — a <button>
      // inside a slide-authored custom element retargets e.target to the
      // host but still appears in the composed path.
      if (e.defaultPrevented) return;
      for (const n of path) {
        if (n === this._stage) break;
        if (n.matches && n.matches(INTERACTIVE_SEL)) return;
      }
      e.preventDefault();
      const rw = this._railWidth();
      const mid = rw + (window.innerWidth - rw) / 2;
      this._advance(e.clientX < mid ? -1 : 1, 'tap');
    }

    _onKey(e) {
      // Ignore when the user is typing. composedPath()[0], not e.target: a
      // window-level keydown retargets e.target to the shadow host, which
      // would miss an <input> or contenteditable inside a web component on
      // a slide (same reason _onTap uses composedPath).
      const t = (e.composedPath ? e.composedPath()[0] : e.target);
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      // Confirm dialog swallows nav keys while open; Escape cancels. Enter
      // is left to the focused button's native activation so Tab→Cancel
      // →Enter activates Cancel, not the window-level confirm path.
      if (this._confirm && this._confirm.hasAttribute('data-open')) {
        if (e.key === 'Escape') {
          this._closeConfirm();
          this._focusCurrentThumb();
          e.preventDefault();
        }
        return;
      }
      if (e.key === 'Escape' && this._menu && this._menu.hasAttribute('data-open')) {
        this._closeMenu();
        e.preventDefault();
        return;
      }
      if (e.key === 'Escape' && this._selected.size) {
        // Collapse the multi-selection back to the current slide (the
        // implicit selection), not to nothing.
        this._clearSelection();
        e.preventDefault();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key;
      let handled = true;

      if (key === 'ArrowRight' || key === 'PageDown' || key === ' ' || key === 'Spacebar') {
        this._advance(1, 'keyboard');
      } else if (key === 'ArrowLeft' || key === 'PageUp') {
        this._advance(-1, 'keyboard');
      } else if (key === 'ArrowDown' && !e.defaultPrevented) {
        // ↓/↑ page slides like →/← (Keynote/PowerPoint parity). Window
        // level only: rail thumbs keep their own ↑/↓ walk (their handler
        // stops propagation before this one), and the typing guard above
        // already covers inputs and contenteditable slide content.
        // Deliberate tradeoff: like Space/PageDown before them, these are
        // scroll keys — slide content that wants keyboard scrolling claims
        // them with preventDefault, which this branch honors (checked here
        // and not for the long-standing keys above, so ←/→/Space behavior
        // is unchanged and ↑/↓ behave identically on frozen copies, whose
        // translator in the guest bundle applies the same guard).
        this._advance(1, 'keyboard');
      } else if (key === 'ArrowUp' && !e.defaultPrevented) {
        this._advance(-1, 'keyboard');
      } else if (key === 'Home') {
        this._go(0, 'keyboard');
      } else if (key === 'End') {
        this._go(this._slides.length - 1, 'keyboard');
      } else if (key === 'r' || key === 'R') {
        this._go(0, 'keyboard');
      } else if (/^[0-9]$/.test(key)) {
        // 1..9 jump to that slide; 0 jumps to 10.
        const n = key === '0' ? 9 : parseInt(key, 10) - 1;
        if (n < this._slides.length) this._go(n, 'keyboard');
      } else {
        handled = false;
      }

      if (handled) {
        e.preventDefault();
        this._flashOverlay();
      }
    }

    _go(i, reason = 'api') {
      // User-initiated navigation collapses a multi-selection down to
      // the (implicit) current slide, like Keynote's arrow keys. 'click'
      // handles its own selection; programmatic reasons leave it alone.
      if (reason === 'keyboard' || reason === 'tap') this._clearSelection();
      if (!this._slides.length) return;
      const clamped = Math.max(0, Math.min(this._slides.length - 1, i));
      if (clamped === this._index) {
        this._flashOverlay();
        return;
      }
      this._index = clamped;
      this._applyIndex({ showOverlay: true, broadcast: true, reason });
    }

    /** Step forward/back skipping any slide marked data-deck-skip. Falls
     *  back to _go's clamp-at-ends behaviour (flash overlay) when there's
     *  nothing further in that direction. Unplayed click-gated data-anim
     *  steps consume forward advances first (PowerPoint semantics) —
     *  backward and every direct jump (_go: number keys, Home/End, rail
     *  clicks) bypass the step model. */
    _advance(dir, reason) {
      if (!this._slides.length) return;
      if (dir > 0 && this._animPendingStep()) { this._animPlayStep(); return; }
      let i = this._index + dir;
      while (i >= 0 && i < this._slides.length && this._slides[i].hasAttribute('data-deck-skip')) {
        i += dir;
      }
      if (i < 0 || i >= this._slides.length) { this._flashOverlay(); return; }
      this._go(i, reason);
    }

    // ── Thumbnail rail ────────────────────────────────────────────────────
    //
    // Thumbs are keyed by slide element and reused across _renderRail()
    // calls, so a reorder/delete is an O(changed) DOM shuffle instead of an
    // O(N) teardown-and-re-clone. Each thumb starts as a lightweight shell
    // (num + empty frame); the clone is materialized lazily by an
    // IntersectionObserver when the frame scrolls into (or near) view, so
    // only visible-ish slides pay the clone + image-decode cost.

    _renderRail() {
      if (!this._rail || !this._railEnabled) { this._thumbs = []; return; }
      // FLIP: record each *materialized* thumb's top before the reconcile.
      // Off-screen (non-materialized) thumbs don't need the animation and
      // skipping their getBoundingClientRect saves a forced layout per
      // off-screen thumb on large decks.
      const prevTops = new Map();
      (this._thumbs || []).forEach(({ thumb, slide, host }) => {
        if (host) prevTops.set(slide, thumb.getBoundingClientRect().top);
      });
      const st = this._rail.scrollTop;

      // Reconcile: reuse thumbs that already exist for a slide, create
      // shells for new slides, drop thumbs for removed slides.
      const bySlide = new Map();
      (this._thumbs || []).forEach((t) => bySlide.set(t.slide, t));
      const next = [];
      this._slides.forEach((slide) => {
        let t = bySlide.get(slide);
        if (t) bySlide.delete(slide);
        else t = this._makeThumb(slide);
        next.push(t);
      });
      // Orphans — slides removed since last render.
      bySlide.forEach((t) => {
        if (this._railObserver) this._railObserver.unobserve(t.frame);
        t.thumb.remove();
      });
      // Put thumbs into document order to match _slides. insertBefore on
      // an already-correctly-placed node is a no-op, so this is cheap
      // when nothing moved.
      next.forEach((t, i) => {
        const want = t.thumb;
        const at = this._rail.children[i];
        if (at !== want) this._rail.insertBefore(want, at || null);
        t.i = i;
        if (t.slide.hasAttribute('data-deck-skip')) t.thumb.setAttribute('data-skip', '');
        else t.thumb.removeAttribute('data-skip');
        if (this._selected.has(t.slide)) t.thumb.setAttribute('data-selected', '');
        else t.thumb.removeAttribute('data-selected');
      });
      this._thumbs = next;
      this._renumberRail();

      this._rail.scrollTop = st;
      if (prevTops.size) {
        const moved = [];
        this._thumbs.forEach(({ thumb, slide }) => {
          // The live-dragged thumb is positioned by the drag tracker; a
          // FLIP transform+transition here would clobber it mid-drag.
          if (thumb === this._dragThumb) return;
          const old = prevTops.get(slide);
          if (old == null) return;
          const dy = old - thumb.getBoundingClientRect().top;
          if (Math.abs(dy) < 1) return;
          thumb.style.transition = 'none';
          thumb.style.transform = `translateY(${dy}px)`;
          moved.push(thumb);
        });
        if (moved.length) {
          // Commit the inverted positions before flipping the transition
          // on — otherwise the browser coalesces both style writes and
          // nothing animates.
          void this._rail.offsetHeight;
          moved.forEach((t) => {
            t.style.transition = 'transform 180ms cubic-bezier(.2,.7,.3,1)';
            t.style.transform = '';
          });
          setTimeout(() => moved.forEach((t) => { t.style.transition = ''; }), 220);
        }
      }
      requestAnimationFrame(() => this._scaleThumbs());
      this._syncRail(false);
    }

    /** Create a lightweight thumb shell for one slide. The clone is
     *  materialized later by the IntersectionObserver. Event handlers
     *  look up the thumb's *current* index (via _thumbs.indexOf) so the
     *  same element can be reused across reorders. */
    _makeThumb(slide) {
      const thumb = document.createElement('div');
      thumb.className = 'thumb';
      thumb.tabIndex = 0;
      const num = document.createElement('div');
      num.className = 'num';
      const frame = document.createElement('div');
      frame.className = 'frame';
      thumb.append(num, frame);

      const entry = { thumb, num, frame, slide, clone: null, host: null, i: -1 };
      // entry.i is refreshed on every _renderRail reconcile pass, so
      // handlers read the thumb's current position without an O(N) scan.
      const idx = () => entry.i;

      thumb.addEventListener('click', (e) => {
        const i = idx();
        const slide = this._slides[i];
        // WebKit doesn't focus a plain element on click — focus
        // explicitly so Delete/Backspace works right after selecting a
        // slide by mouse. preventScroll: _syncRail owns the rail's
        // scroll position.
        thumb.focus({ preventScroll: true });
        if (e.shiftKey || e.metaKey || e.ctrlKey) {
          // Multi-select gestures adjust the selection without
          // navigating (Keynote/Figma convention).
          e.preventDefault();
          if (e.shiftKey) {
            // Range from the anchor (last plain/cmd-clicked slide;
            // falls back to the current slide) to here, replacing any
            // previous range.
            let a = this._selAnchor ? this._slides.indexOf(this._selAnchor) : -1;
            if (a < 0) {
              a = this._index;
              this._selAnchor = this._slides[a] || null;
            }
            this._selected.clear();
            for (let j = Math.min(a, i); j <= Math.max(a, i); j++) {
              this._selected.add(this._slides[j]);
            }
          } else if (slide) {
            // Toggle. An empty explicit selection implicitly holds the
            // current slide — materialize it first so cmd-clicking a
            // second slide selects both.
            if (!this._selected.size && i !== this._index && this._slides[this._index]) {
              this._selected.add(this._slides[this._index]);
            }
            if (this._selected.has(slide)) this._selected.delete(slide);
            else {
              this._selected.add(slide);
              this._selAnchor = slide;
            }
          }
          this._syncSelection();
          return;
        }
        this._clearSelection();
        this._selAnchor = slide || null;
        this._go(i, 'click');
      });
      // ↑/↓ step through the rail when a thumb has focus. _go clamps at the
      // ends and _applyIndex→_syncRail scrolls the new current thumb into
      // view; we move focus to it (preventScroll — _syncRail already
      // scrolled) so a held key walks the whole list. stopPropagation keeps
      // this out of the window-level _onKey nav handler.
      thumb.addEventListener('keydown', (e) => {
        // Delete/Backspace with the rail focused deletes this thumb's
        // slide through the same confirm dialog as the menu item.
        // Listening on the thumb (never window-level) is what keeps
        // typing in the notes panel / slide inputs from ever landing
        // here; the target check is belt-and-braces for anything
        // focusable that ends up inside a thumb.
        if ((e.key === 'Delete' || e.key === 'Backspace') && !e.metaKey && !e.ctrlKey && !e.altKey) {
          const t = e.target;
          if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
          e.preventDefault();
          e.stopPropagation();
          // Same refusals as the menu item: never every slide, never
          // while a prior structural op is waiting on its ack. The
          // whole-deck refusal is announced (the menu greys its item
          // out; a silently dead key reads as breakage). The rail-lock
          // refusal stays silent: it lasts one ack round-trip and
          // matches the existing single-delete behavior.
          if (this._railLock) return;
          // Explicit selection wins; otherwise the focused thumb (which
          // plain click and ↑/↓ keep equal to the current slide).
          const sel = this._selected.size ? this._selectionIndices() : [idx()];
          if (sel.length >= this._slides.length) {
            this._showNotice(sel.length === 1
              ? 'The last slide can’t be deleted.'
              : 'At least one slide has to stay — the whole deck can’t be deleted.');
            return;
          }
          this._openConfirm(sel);
          return;
        }
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        e.preventDefault();
        e.stopPropagation();
        this._go(idx() + (e.key === 'ArrowDown' ? 1 : -1), 'keyboard');
        const cur = this._thumbs && this._thumbs[this._index];
        if (cur) cur.thumb.focus({ preventScroll: true });
      });
      thumb.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this._openMenu(idx(), e.clientX, e.clientY);
      });
      thumb.draggable = true;
      thumb.addEventListener('dragstart', (e) => {
        // v1: dragging moves ONE slide, so a multi-selection would lie
        // about what's about to move — collapse it. (Group drag would
        // instead keep it and emit a batched move.)
        this._clearSelection();
        this._dragFrom = idx();
        // Deferred to the next frame: the [data-dragging] rule sets
        // pointer-events:none on the drag SOURCE, and applying that
        // synchronously inside dragstart makes Chromium (and WebKit) cancel
        // the drag — dragstart then an immediate dragend, no dragover or
        // drop, so thumbnails could not be reordered by dragging at all.
        // One frame is invisible and lands before the first dragover needs
        // the source to be hit-test-transparent. Guarded twice so the
        // attribute can never strand on a thumb that is no longer being
        // dragged (pointer-events:none would leave it unclickable for the
        // session): the pending frame is cancelled in dragend
        // (_cancelDragAttr), and the callback itself re-checks that THIS
        // thumb is still the live drag source (a new drag on another thumb
        // re-points the drag state). Deliberately NOT cancelled in
        // _stopDragTrack — _startDragTrack calls it at the start of every
        // drag, which would kill the mark this dragstart just scheduled
        // (see _cancelDragAttr).
        this._dragAttrRaf = requestAnimationFrame(() => {
          this._dragAttrRaf = null;
          if (this._dragFrom != null && this._dragThumb === thumb) {
            thumb.setAttribute('data-dragging', '');
          }
        });
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', String(this._dragFrom)); } catch (err) {}
        // Constrain the drag visual to the rail's vertical axis. The
        // browser's default drag image is a free-floating snapshot that
        // follows the OS cursor in BOTH axes and the DnD API offers no way
        // to constrain it — so swap it for a transparent stand-in and move
        // the thumb itself along Y instead (_startDragTrack). The drop
        // logic below always read only clientY; this makes the visual
        // match it.
        try { e.dataTransfer.setDragImage(this._dragBlank(), 0, 0); } catch (err) {}
        this._startDragTrack(thumb, e.clientY);
      });
      thumb.addEventListener('dragend', () => {
        this._cancelDragAttr();
        thumb.removeAttribute('data-dragging');
        this._stopDragTrack();
        this._clearDrop();
        this._dragFrom = null;
      });
      thumb.addEventListener('dragover', (e) => {
        if (this._dragFrom == null) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const r = thumb.getBoundingClientRect();
        this._setDrop(idx(), e.clientY < r.top + r.height / 2 ? 'before' : 'after');
      });
      thumb.addEventListener('drop', (e) => {
        if (this._dragFrom == null) return;
        e.preventDefault();
        const i = idx();
        const r = thumb.getBoundingClientRect();
        let to = e.clientY >= r.top + r.height / 2 ? i + 1 : i;
        if (this._dragFrom < to) to--;
        const from = this._dragFrom;
        this._clearDrop();
        this._dragFrom = null;
        if (to !== from) this._moveSlide(from, to);
      });

      if (this._railObserver) this._railObserver.observe(frame);
      frame.__deckThumb = entry;
      return entry;
    }

    /** Lazily build the clone for a thumb that has scrolled into view. */
    _materialize(entry) {
      if (entry.host) return;
      const dw = this.designWidth, dh = this.designHeight;
      let clone = entry.slide.cloneNode(true);
      // The clone participates in the document's flat tree, so the
      // templates' position-based CSS page counters (.slide
      // { counter-increment: page }) would count every materialized
      // thumb before the real slides — folios print offset by the
      // thumb count (slide 2 reading "7" on a five-slide deck).
      // Neutralize the counter on the clone and drop its folio pill:
      // a thumbnail's own page number is unreadable at thumb scale
      // anyway, and the real slides' numbers stay truthful.
      clone.style.counterIncrement = 'none';
      clone.querySelectorAll('.page-foot').forEach((pf) => pf.remove());
      // Canvas bitmaps don't clone — swap each cloned canvas for an <img>
      // of the live pixels. Best-effort: tainted canvases throw (left
      // as-is); zero-size are skipped; WebGL without preserveDrawingBuffer
      // reads back blank and the thumb gets a blank img (same as before).
      const liveCanvases = entry.slide.querySelectorAll('canvas');
      const cloneCanvases = clone.querySelectorAll('canvas');
      cloneCanvases.forEach((cv, i) => {
        const live = liveCanvases[i];
        if (!live || !live.width || !live.height) return;
        try {
          const img = document.createElement('img');
          img.src = live.toDataURL();
          img.alt = '';
          img.style.cssText = cv.style.cssText;
          img.className = cv.className;
          img.width = live.width;
          img.height = live.height;
          // Author CSS that sized the <canvas> via tag selector won't match
          // the <img> — pin the live canvas's laid-out box on the snapshot.
          if (live.clientWidth) {
            img.style.width = live.clientWidth + 'px';
            img.style.height = live.clientHeight + 'px';
          }
          cv.replaceWith(img);
        } catch (e) {}
      });
      // Neuter heavy media; replace <video> with its poster so the box
      // keeps a visual. <iframe>/<audio> become empty placeholders.
      // Parity with _inertify: transient top-layer UI never belongs in a
      // static thumb.
      clone.querySelectorAll('[popover], dialog').forEach((el) => el.remove());
      clone.querySelectorAll('iframe, audio, object, embed').forEach((el) => {
        el.removeAttribute('src');
        el.removeAttribute('srcdoc');
        el.removeAttribute('data');
        el.innerHTML = '';
      });
      clone.querySelectorAll('video').forEach((el) => {
        if (!el.poster) { el.removeAttribute('src'); el.innerHTML = ''; return; }
        const img = document.createElement('img');
        img.src = el.poster;
        img.alt = '';
        img.style.cssText = el.style.cssText + ';object-fit:cover;width:100%;height:100%;';
        img.className = el.className;
        el.replaceWith(img);
      });
      // Images: defer decode and let the browser pick the smallest
      // srcset candidate for the ~140px thumb. Same-URL clones reuse the
      // slide's decoded bitmap (URL-keyed cache), so the remaining cost
      // is paint/composite — lazy+async keeps that off the main thread.
      clone.querySelectorAll('img').forEach((el) => {
        el.loading = 'lazy';
        el.decoding = 'async';
        if (el.srcset) el.sizes = (this._railPx || 188) + 'px';
      });
      // Custom elements inside the slide would have their
      // connectedCallback fire when the clone is appended. Replace them
      // with inert boxes (_neuter) so a component-heavy deck doesn't run
      // N copies of each component's mount logic in the rail. Children
      // are preserved so layout-wrapper elements (<my-column><h2>…</h2>)
      // still show their authored content, and a shadow tree cloned along
      // via attachShadow({clonable:true}) (e.g. <image-slot>) moves onto
      // the box so the thumb shows the component's rendered content. The
      // querySelectorAll NodeList is static, so nested custom elements in
      // the moved subtree are still visited on later iterations.
      // querySelectorAll('*') returns descendants only — a custom-element
      // slide root (<my-slide>…</my-slide>) would slip through and upgrade
      // on append. Swap the root first.
      if (clone.tagName.includes('-')) clone = this._neuter(clone);
      clone.querySelectorAll('*').forEach((el) => {
        if (el.tagName.includes('-')) el.replaceWith(this._neuter(el));
      });
      // Strip ids only now: a defined custom element upgrades synchronously
      // during cloneNode and re-renders on attribute callbacks, so removing
      // 'id' any earlier resets components (e.g. <image-slot> falls back to
      // its author src). Post-neuter, only inert boxes and plain elements
      // remain, where the strip is just the usual duplicate-id hygiene.
      clone.removeAttribute('id');
      clone.removeAttribute('data-deck-active');
      // Runtime anim state stays out of thumbs — double safety, since the
      // hidden-attr rule's deck-stage ancestor combinator can't match
      // inside this nested shadow root anyway.
      this._stripAnimAttrs(clone);
      clone.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
      clone.style.cssText += ';position:absolute;top:0;left:0;transform-origin:0 0;' +
        'pointer-events:none;width:' + dw + 'px;height:' + dh + 'px;' +
        'box-sizing:border-box;overflow:hidden;visibility:visible;opacity:1;';
      const host = document.createElement('div');
      host.style.cssText = 'position:absolute;inset:0;';
      // Clones are display-only: inert removes anything focusable inside
      // them from the tab order, so the rail's Delete/Backspace handler
      // can never see a (retargeted) key press from cloned content.
      host.inert = true;
      this._syncThumbHostAttrs(host);
      const sr = host.attachShadow({ mode: 'open' });
      if (this._adoptedSheet) sr.adoptedStyleSheets = [this._adoptedSheet];
      else {
        const st = document.createElement('style');
        st.textContent = this._authorCss || '';
        sr.appendChild(st);
      }
      sr.appendChild(clone);
      entry.frame.appendChild(host);
      entry.host = host;
      entry.clone = clone;
      if (this._thumbScale) clone.style.transform = 'scale(' + this._thumbScale + ')';
      // Once materialized the IO callback is a no-op early-return —
      // unobserve so scroll doesn't keep firing it.
      if (this._railObserver) this._railObserver.unobserve(entry.frame);
    }

    /** Replace a cloned custom element with an inert box (see the comment
     *  in _materialize). A shadow tree cloned along via {clonable:true}
     *  moves onto the box, so the thumb shows the component's real content
     *  with zero component logic; :host rules in the moved <style> match
     *  the box, and the preserved data-* attrs keep :host([data-…])
     *  selectors working. */
    _neuter(el) {
      // Adopt the shadow only when the cloned root carries renderable
      // content. A constructor-attach / connectedCallback-render component
      // clones into an empty (or style-only) slotless root — adopting that
      // would hide the light children the box is about to receive and drop
      // the placeholder chrome. Such components fall back to the plain box.
      let sr = el.shadowRoot;
      if (sr) {
        let renderable = false;
        for (let n = sr.firstElementChild; n; n = n.nextElementSibling) {
          const t = n.tagName;
          if (t !== 'STYLE' && t !== 'LINK') { renderable = true; break; }
        }
        if (!renderable) sr = null;
      }
      const box = document.createElement('div');
      box.style.cssText = (el.getAttribute('style') || '') + (sr ? '' :
        ';background:rgba(0,0,0,0.06);border:1px dashed rgba(0,0,0,0.15);');
      box.className = el.className;
      // Preserve theming/i18n hooks so [data-*] / :lang() / [dir]
      // descendant selectors still match the neutered root — but not
      // pointer-interaction transients (a mid-reframe/mid-drag re-clone
      // would render the interaction chrome statically in the thumb).
      for (const a of el.attributes) {
        const n = a.name;
        if (n === 'data-reframe' || n === 'data-panning' || n === 'data-over') continue;
        if (n.startsWith('data-') || n.startsWith('aria-') ||
            n === 'lang' || n === 'dir' || n === 'role' || n === 'title') {
          box.setAttribute(n, a.value);
        }
      }
      while (el.firstChild) box.appendChild(el.firstChild);
      if (sr) this._adoptShadow(box, sr);
      return box;
    }

    /** Move a cloned shadow tree onto a neutered thumbnail box: attach an
     *  open root on the box, carry adoptedStyleSheets, move the children,
     *  then make the content inert. */
    _adoptShadow(box, sr) {
      let root;
      try { root = box.attachShadow({ mode: 'open' }); } catch (e) { return; }
      // Engine-cloned shadow roots never carry adoptedStyleSheets, but a
      // defined component's clone is upgrade-rebuilt (constructor runs
      // during cloneNode), so sheets it adopts there are present and
      // shared by reference — carry them.
      if (sr.adoptedStyleSheets && sr.adoptedStyleSheets.length) {
        try {
          root.adoptedStyleSheets = Array.prototype.slice.call(sr.adoptedStyleSheets);
        } catch (e) {}
      }
      // Clone rather than move: moving preserves listeners an upgraded
      // clone's constructor attached inside its shadow; cloning sheds
      // them, keeping thumbs free of component logic categorically.
      for (let n = sr.firstChild; n; n = n.nextSibling) {
        root.appendChild(n.cloneNode(true));
      }
      this._inertify(root);
    }

    /** Strip anything executable from copied shadow content and apply the
     *  same custom-element/media/img policy as the light-DOM clone.
     *  (Canvases inside copied shadow content stay blank — there is no
     *  live↔clone pairing across shadow boundaries to snapshot from.) */
    _inertify(root) {
      root.querySelectorAll('script').forEach((s) => s.remove());
      // Transient top-layer UI can never belong in a static thumb. (A
      // cloned [popover] is display:none anyway — open state doesn't
      // clone — this just makes it categorical.)
      root.querySelectorAll('[popover], dialog').forEach((el) => el.remove());
      // Same heavy-media policy as the light-DOM clone above.
      root.querySelectorAll('iframe, audio, object, embed').forEach((el) => {
        el.removeAttribute('src');
        el.removeAttribute('srcdoc');
        el.removeAttribute('data');
        el.innerHTML = '';
      });
      root.querySelectorAll('video').forEach((el) => {
        if (!el.poster) { el.removeAttribute('src'); el.innerHTML = ''; return; }
        const img = document.createElement('img');
        img.src = el.poster;
        img.alt = '';
        img.style.cssText = el.style.cssText + ';object-fit:cover;width:100%;height:100%;';
        img.className = el.className;
        el.replaceWith(img);
      });
      root.querySelectorAll('*').forEach((el) => {
        for (let i = el.attributes.length - 1; i >= 0; i--) {
          if (/^on/i.test(el.attributes[i].name)) {
            el.removeAttribute(el.attributes[i].name);
          }
        }
      });
      root.querySelectorAll('img').forEach((el) => {
        el.loading = 'lazy';
        el.decoding = 'async';
        if (el.srcset) el.sizes = (this._railPx || 188) + 'px';
      });
      // Nested custom elements inside copied shadow content would upgrade
      // on append — same treatment as the light DOM. querySelectorAll is
      // static, so boxes created mid-walk don't re-enter this loop.
      root.querySelectorAll('*').forEach((el) => {
        if (el.tagName.includes('-')) el.replaceWith(this._neuter(el));
      });
    }

    /** Re-clone a single thumb (live-update path). No-op if the thumb
     *  hasn't been materialized yet — it'll pick up current content when
     *  it scrolls into view. */
    _refreshThumb(slide) {
      const entry = (this._thumbs || []).find((t) => t.slide === slide);
      if (!entry || !entry.host) return;
      entry.host.remove();
      entry.host = entry.clone = null;
      this._materialize(entry);
    }

    _scaleThumbs() {
      if (!this._thumbs || !this._thumbs.length) return;
      // Every frame is the same width; if it reads 0 the rail is
      // display:none (noscale / no-rail / presenting / print) — leave the
      // clones as-is and re-run when the rail is revealed.
      const fw = this._thumbs[0].frame.offsetWidth;
      if (!fw) return;
      this._thumbScale = fw / this.designWidth;
      this._thumbs.forEach(({ clone }) => {
        if (clone) clone.style.transform = 'scale(' + this._thumbScale + ')';
      });
    }

    _setDrop(i, where) {
      // dragover fires at pointer-event rate; touch only the previous
      // and new target rather than sweeping all N thumbs.
      const t = this._thumbs && this._thumbs[i];
      if (this._dropOn && this._dropOn !== t) {
        this._dropOn.thumb.removeAttribute('data-drop');
      }
      if (t) t.thumb.setAttribute('data-drop', where);
      this._dropOn = t || null;
    }

    _clearDrop() {
      if (this._dropOn) this._dropOn.thumb.removeAttribute('data-drop');
      this._dropOn = null;
    }

    /** 1×1 transparent stand-in for setDragImage. Kept attached (offscreen
     *  in the shadow root) because some engines ignore a drag image that
     *  isn't in a rendered tree. Created lazily, reused for every drag. */
    _dragBlank() {
      if (!this._dragBlankEl) {
        const c = document.createElement('canvas');
        c.width = 1;
        c.height = 1;
        c.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;';
        this._root.appendChild(c);
        this._dragBlankEl = c;
      }
      return this._dragBlankEl;
    }

    /** Vertical-only drag tracking: translate the dragged thumb along Y to
     *  follow the pointer, clamped to the rail, ignoring X entirely. A
     *  document-level capture listener is used because native dragover
     *  fires wherever the pointer is — so the thumb keeps tracking even
     *  while the pointer wanders over the stage — and it is removed the
     *  moment the drag ends. getBoundingClientRect already reflects the
     *  current transform, so the layout position is recovered by
     *  subtracting the translation applied so far (rail auto-scroll moves
     *  the layout position mid-drag; see the rail dragover handler). */
    _startDragTrack(thumb, startY) {
      // A lost dragend (the dragged thumb removed mid-drag by a remote
      // edit's re-render — browsers fire no dragend on a disconnected
      // source) would otherwise leave the previous listener installed
      // forever once this overwrite lands.
      this._stopDragTrack();
      this._dragThumb = thumb;
      // The FLIP reorder animation drives transform through a transition;
      // the live drag must not inherit one, or the thumb rubber-bands.
      // Killed BEFORE the grab-offset read: mid-FLIP the rect includes the
      // interpolated transform, which would bake a constant offset into
      // the whole drag.
      thumb.style.transition = 'none';
      this._dragGrab = startY - thumb.getBoundingClientRect().top;
      this._dragTy = 0;
      this._onDragTrack = (e) => {
        const t = this._dragThumb;
        if (!t) return;
        const rail = this._rail.getBoundingClientRect();
        const r = t.getBoundingClientRect();
        // A transformed ancestor (author wraps the deck in a CSS scale;
        // canvas-mode pan/zoom) scales viewport deltas: translateY(N)
        // moves the rect by s·N. Measure s from the thumb itself (rect is
        // scaled, offsetHeight is layout px) so the feedback loop stays
        // exact instead of oscillating at s ≥ 2. offsetHeight is 0 only
        // when unrendered — nothing to track then, treat as unscaled.
        const s = t.offsetHeight ? r.height / t.offsetHeight : 1;
        const layoutTop = r.top - s * this._dragTy;
        let want = e.clientY - this._dragGrab;
        want = Math.max(rail.top, Math.min(want, rail.bottom - r.height));
        this._dragTy = (want - layoutTop) / s;
        t.style.transform = 'translateY(' + this._dragTy + 'px)';
      };
      document.addEventListener('dragover', this._onDragTrack, true);
    }

    /** Cancel the thumb's deferred data-dragging mark if its frame has not
     *  fired yet — see the dragstart deferral. Called from dragend only:
     *  _stopDragTrack is the wrong home for it, because _startDragTrack
     *  defensively calls _stopDragTrack at the START of every drag (its
     *  lost-dragend reset), so a cancel there kills the mark the same
     *  dragstart just scheduled. The strand that matters — pointer-
     *  events:none left on a CONNECTED thumb that is no longer being
     *  dragged — is closed two ways: dragend cancels the pending frame
     *  here, and the frame callback re-checks that THIS thumb is still the
     *  live drag source (_dragFrom and _dragThumb, both cleared/re-pointed
     *  by dragend or by a new drag). The remaining lost-dragend case — the
     *  source slide removed mid-drag, so no dragend fires — ends with that
     *  thumb discarded by the rail reconcile (thumbs are keyed by slide
     *  element and a removed slide's thumb is not reused), so a mark landing
     *  on it is on a discarded node. The risk this defer adds over the old
     *  synchronous set is therefore the narrow rAF-after-dragend window,
     *  which the dragend cancel covers. */
    _cancelDragAttr() {
      if (this._dragAttrRaf != null) {
        cancelAnimationFrame(this._dragAttrRaf);
        this._dragAttrRaf = null;
      }
    }

    _stopDragTrack() {
      if (this._onDragTrack) {
        document.removeEventListener('dragover', this._onDragTrack, true);
        this._onDragTrack = null;
      }
      const t = this._dragThumb;
      if (t) {
        t.style.transform = '';
        t.style.transition = '';
      }
      this._dragThumb = null;
      this._dragTy = 0;
    }

    _syncRail(follow) {
      if (!this._thumbs) return;
      this._thumbs.forEach(({ thumb }, i) => {
        if (i === this._index) {
          thumb.setAttribute('data-current', '');
          if (follow && typeof thumb.scrollIntoView === 'function') {
            thumb.scrollIntoView({ block: 'nearest' });
          }
        } else {
          thumb.removeAttribute('data-current');
        }
      });
    }

    _openMenu(i, x, y) {
      if (!this._menu) return;
      this._menuIndex = i;
      const slide = this._slides[i];
      // Right-clicking a thumb OUTSIDE the selection collapses the
      // selection to that thumb (platform convention) — the menu then
      // always targets exactly what's highlighted.
      if (this._selected.size && slide && !this._selected.has(slide)) {
        this._selected.clear();
        this._selected.add(slide);
        this._selAnchor = slide;
        this._syncSelection();
      }
      const sel = this._selectionIndices();
      const bulk = sel.length > 1;
      this._menuIndices = bulk ? sel : [i];
      // Bulk mode offers only the one batched op that exists (delete);
      // the single-slide items address one index and stay hidden.
      this._menu.querySelectorAll('[data-act="skip"], [data-act="up"], [data-act="down"], [data-act="duplicate"], hr').forEach((el) => {
        el.style.display = bulk ? 'none' : '';
      });
      const skip = slide && slide.hasAttribute('data-deck-skip');
      this._menu.querySelector('[data-act="skip"]').textContent = skip ? 'Unskip slide' : 'Skip slide';
      this._menu.querySelector('[data-act="up"]').disabled = i <= 0;
      this._menu.querySelector('[data-act="down"]').disabled = i >= this._slides.length - 1;
      const del = this._menu.querySelector('[data-act="delete"]');
      del.textContent = bulk ? 'Delete ' + sel.length + ' slides' : 'Delete slide';
      del.disabled = bulk ? sel.length >= this._slides.length : this._slides.length <= 1;
      // Place, then clamp to viewport after it's measurable.
      this._menu.style.left = x + 'px';
      this._menu.style.top = y + 'px';
      this._menu.setAttribute('data-open', '');
      const r = this._menu.getBoundingClientRect();
      const nx = Math.min(x, window.innerWidth - r.width - 4);
      const ny = Math.min(y, window.innerHeight - r.height - 4);
      this._menu.style.left = Math.max(4, nx) + 'px';
      this._menu.style.top = Math.max(4, ny) + 'px';
    }

    _closeMenu() {
      if (this._menu) this._menu.removeAttribute('data-open');
      this._menuIndex = -1;
      this._menuIndices = null;
    }

    _openConfirm(sel) {
      if (!this._confirm) return;
      const list = Array.isArray(sel) ? sel : [sel];
      // Hold the slide ELEMENTS: the deck can re-render while the dialog
      // is open (collaborator/agent edit), and a frozen index list would
      // then address the wrong slides — a same-count reorder even passes
      // the host's witness guard. Elements re-resolve at danger-click.
      this._confirmEls = list.map((i) => this._slides[i]).filter(Boolean);
      // Title uses the rail's skip-aware label, so the confirm names the
      // number the user right-clicked (a raw index would disagree with the
      // rail whenever a skipped slide precedes the target).
      const lbl = list.length === 1 ? this._slideLabel(list[0]) : '';
      this._confirm.querySelector('.title').textContent = list.length === 1
        ? (lbl ? 'Delete slide ' + lbl + '?' : 'Delete skipped slide?')
        : 'Delete ' + list.length + ' slides?';
      this._confirm.querySelector('.msg').textContent = list.length === 1
        ? 'This slide will be removed from the deck.'
        : 'These slides will be removed from the deck.';
      this._confirm.setAttribute('data-open', '');
      const btn = this._confirm.querySelector('.danger');
      if (btn && btn.focus) btn.focus();
    }

    _closeConfirm() {
      if (this._confirm) this._confirm.removeAttribute('data-open');
      this._confirmEls = null;
    }

    /** Return focus to the current slide's thumb so the keyboard flow
     *  (Delete → Enter → Delete …) survives the confirm dialog closing.
     *  Without 'force', skipped while a structural op is in flight
     *  (_railLock): _index is then an optimistic post-op value that
     *  doesn't address the pre-op thumb list — _pendingRailRefocus stays
     *  armed and the ack/slotchange paths call back with force once the
     *  rail reflects the op. Skipped (and disarmed) while the rail is
     *  inert (hidden / presenting). */
    _focusCurrentThumb(force) {
      if (!force && this._railLock) return;
      this._pendingRailRefocus = false;
      // Never yank focus from content the user reached meanwhile (e.g.
      // an input inside a slide during the ack round-trip) — only
      // reclaim it from the rail's own surfaces, or from nowhere.
      const ae = this._root && this._root.activeElement;
      const ours = !ae ||
        (this._rail && this._rail.contains(ae)) ||
        (this._confirm && this._confirm.contains(ae)) ||
        (this._menu && this._menu.contains(ae));
      const lightAe = document.activeElement;
      const lightOk = !lightAe || lightAe === document.body || lightAe === this;
      if (!ours || !lightOk) return;
      const cur = this._thumbs && this._thumbs[this._index];
      if (cur && this._rail && !this._rail.inert) cur.thumb.focus({ preventScroll: true });
    }

    /** Selection as sorted slide indices. An empty explicit selection
     *  means the current slide (the rail's implicit selection). */
    _selectionIndices() {
      const out = [];
      this._slides.forEach((s, i) => {
        if (this._selected.has(s)) out.push(i);
      });
      if (!out.length && this._slides[this._index]) out.push(this._index);
      return out;
    }

    _clearSelection() {
      // Re-anchor before the early return: a plain click followed by
      // arrow/tap navigation leaves _selected empty but the anchor
      // pointing at the old slide, and a later shift-click would range
      // from there instead of the current slide.
      this._selAnchor = null;
      if (!this._selected.size) return;
      this._selected.clear();
      this._syncSelection();
    }

    _syncSelection() {
      (this._thumbs || []).forEach((t) => {
        if (this._selected.has(t.slide)) t.thumb.setAttribute('data-selected', '');
        else t.thumb.removeAttribute('data-selected');
      });
    }

    /** Rail mutations. When a dc-runtime is present (`window.__dcUpdate`)
     *  the host owns the light DOM — handlers emit a dc-op only and the
     *  host applies it (to the editor's model or to the source file) and
     *  re-renders via dc-runtime; slotchange catches the rail up.
     *  Structural ops lock rail input until the host acks so a rapid second
     *  click can't address a stale index; setAttr/removeAttr respect the
     *  lock but don't set it (indices unchanged; the host serializes).
     *  `newIndex` is written to location.hash so slotchange's
     *  _restoreIndex lands on the right slide.
     *
     *  With NO dc-runtime (a raw .html deck), there's no re-render path,
     *  so handlers self-mutate locally for an instant update and emit
     *  `emitOnly: false`; the host persists to disk without
     *  re-rendering over the already-mutated DOM.
     *
     *  See docs/dc-ops.md for the contract. */
    /** True when the page's DC runtime reports a live template stream for
     *  any component here (newer support.js bundles only — older bundles
     *  lack the signal and the HOST-side gate covers those decks). Rail
     *  mutations are refused for the duration: a mid-stream op addresses
     *  slide indices the stream is rewriting underneath the click. */
    _streamActive() {
      try {
        return !!window.__dcUpdate &&
          typeof window.__dcStreaming === 'function' &&
          window.__dcStreaming();
      } catch (e) { return false; }
    }

    /** Transient in-stage notice for a refused mid-stream rail op. */
    _showStreamNotice() {
      this._showNotice(
        'Claude is still updating this deck — try again when it finishes.'
      );
    }

    /** Transient bottom-center toast for a refused rail gesture. */
    _showNotice(text) {
      if (!this._root) return;
      let n = this._streamNotice;
      if (!n) {
        n = document.createElement('div');
        n.className = 'export-hidden';
        n.setAttribute('data-omelette-chrome', '');
        n.setAttribute('role', 'status');
        n.style.cssText =
          'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);' +
          'background:rgba(22,22,22,.94);color:#fff;' +
          'font:500 13px/1.4 system-ui,sans-serif;padding:8px 14px;' +
          'border-radius:8px;z-index:2147483646;pointer-events:none;' +
          'opacity:0;transition:opacity .15s ease';
        this._root.append(n);
        this._streamNotice = n;
      }
      n.textContent = text;
      n.style.opacity = '1';
      if (this._streamNoticeTimer) clearTimeout(this._streamNoticeTimer);
      this._streamNoticeTimer = setTimeout(() => { n.style.opacity = '0'; }, 2600);
    }

    _emitDcOp(op, slide, lock, newIndex) {
      // Mid-stream guard: refuse the gesture outright — no lock, no
      // optimistic index change, no emit, no self-mutation (returning
      // true short-circuits every caller). The host applies the same
      // gate for decks whose committed support.js predates the signal.
      if (this._streamActive()) {
        this._showStreamNotice();
        return true;
      }
      // Slide index (template/script/style filtered — same as
      // _collectSlides). deck-stage is a filtered-index dc-op emitter;
      // the host resolves against findDeckStage().slideTids. Callers
      // already pass `to` as a slide index.
      op.at = this._slides.indexOf(slide);
      op.witness = { childCount: this._slides.length };
      // dc-runtime wraps an <x-import>-mounted component in a
      // <div class="sc-host-x" data-dc-tpl="N"> host — the stamp is on the
      // WRAPPER, not this element. closest() finds it (or this element's
      // own stamp when directly templated).
      const host = this.closest('[data-dc-tpl]');
      const tid = host && host.getAttribute('data-dc-tpl');
      op.mount = { tid: tid !== null ? parseInt(tid, 10) : null, tag: 'deck-stage' };
      op.emitOnly = !!window.__dcUpdate;
      if (op.emitOnly) {
        if (lock) this._railLock = true;
        if (newIndex != null && newIndex !== this._index) {
          this._indexBeforeEmit = this._index;
          this._index = newIndex;
          try { history.replaceState(null, '', '#' + (newIndex + 1)); } catch (e) {}
        }
      }
      this.dispatchEvent(new CustomEvent('dc-op', {
        detail: op, bubbles: true, composed: true,
      }));
      return op.emitOnly;
    }

    /** Delete a set of slides (pre-op indices). One slide delegates to
     *  _deleteSlide — the plain 'remove' op — so single deletes keep
     *  working against hosts that predate 'removeMany'. A bulk delete is
     *  ONE op: one host write, one undo snapshot, and indices that all
     *  address the same pre-op deck (N acked single ops would each need
     *  a fresh witness). */
    _deleteSlides(list) {
      if (this._railLock || !list) return;
      const indices = [...new Set(list)]
        .filter((i) => this._slides[i])
        .sort((a, b) => a - b);
      if (!indices.length || indices.length >= this._slides.length) return;
      if (indices.length === 1) {
        this._deleteSlide(indices[0]);
        return;
      }
      // Mirrors _duplicateSlide: check the stream gate before doing any
      // work (_emitDcOp re-checks).
      if (this._streamActive()) {
        this._showStreamNotice();
        return;
      }
      const els = indices.map((i) => this._slides[i]);
      const del = new Set(indices);
      const cur = this._index;
      // New current index in post-op space: shift the kept slide left by
      // the deletions below it; if the current slide itself is deleted,
      // land on the nearest survivor (after, else before).
      const below = (n) => indices.reduce((k, x) => k + (x < n ? 1 : 0), 0);
      let ni;
      if (!del.has(cur)) {
        ni = cur - below(cur);
      } else {
        let s = -1;
        for (let j = cur + 1; j < this._slides.length; j++) {
          if (!del.has(j)) { s = j; break; }
        }
        if (s === -1) {
          for (let j = cur - 1; j >= 0; j--) {
            if (!del.has(j)) { s = j; break; }
          }
        }
        ni = s < 0 ? 0 : s - below(s);
      }
      // Emit-path deletes can't refocus until the host re-renders; arm
      // the flag at emit time (never on a refused/no-op path) so
      // ack/slotchange can finish the keyboard flow's focus hand-back.
      // The local path clears it via the caller's _focusCurrentThumb().
      this._pendingRailRefocus = true;
      if (this._emitDcOp({ op: 'removeMany', indices }, els[0], true, ni)) return;
      this._index = ni;
      this._squelchSlotChange = true;
      els.forEach((el) => el.remove());
      this._collectSlides();
      this._applyIndex({ showOverlay: true, broadcast: true, reason: 'mutation' });
    }

    _deleteSlide(i) {
      if (this._railLock) return;
      const slide = this._slides[i];
      if (!slide || this._slides.length <= 1) return;
      const cur = this._index;
      const ni = (i < cur || (i === cur && i === this._slides.length - 1)) ? cur - 1 : cur;
      this._pendingRailRefocus = true;
      if (this._emitDcOp({ op: 'remove' }, slide, true, ni)) return;
      this._index = ni;
      this._squelchSlotChange = true;
      slide.remove();
      this._collectSlides();
      this._applyIndex({ showOverlay: true, broadcast: true, reason: 'mutation' });
    }

    _duplicateSlide(i) {
      if (this._railLock) return;
      const slide = this._slides[i];
      if (!slide) return;
      // Mint ids + copy component state BEFORE emitting, so the op can
      // carry the id map — but never mint for an op the stream gate is
      // about to refuse (_emitDcOp re-checks; this avoids orphaned keys).
      if (this._streamActive()) {
        this._showStreamNotice();
        return;
      }
      const copy = slide.cloneNode(true);
      copy.removeAttribute('id');
      this._stripAnimAttrs(copy);
      const ids = this._remintDuplicateIds(copy);
      const op = { op: 'duplicate' };
      if (ids) op.ids = ids;
      if (this._emitDcOp(op, slide, true, i + 1)) return;
      this._index = i + 1;
      this._squelchSlotChange = true;
      this.insertBefore(copy, slide.nextSibling);
      this._collectSlides();
      this._applyIndex({ showOverlay: true, broadcast: true, reason: 'mutation' });
    }

    /** Duplicate id policy. Plain ids are stripped — two live slides must
     *  not share one id. But a component that KEYS persistent state by id
     *  (image-slot's sidecar photo) would silently lose that state with
     *  its id. Such a component opts out of the strip by exposing a
     *  static cloneSlot(fromId, isFree) that copies its stored state
     *  under a fresh id of its choosing and returns that id. The old→new
     *  map is returned (or null) and rides the dc-op so the host writes
     *  the SAME ids into source — without that, the copy's state would
     *  revert on reload (docs/dc-ops.md). */
    _remintDuplicateIds(copy) {
      const ids = {};
      let found = false;
      const used = new Set();
      const idOk = /^[A-Za-z][\w-]{0,63}$/;
      const isFree = (id) =>
        idOk.test(id) && !used.has(id) && !document.getElementById(id);
      copy.querySelectorAll('[id]').forEach((el) => {
        const tag = el.tagName.toLowerCase();
        const cls = tag.indexOf('-') >= 0 && customElements.get(tag);
        let next = null;
        if (el.id && cls && typeof cls.cloneSlot === 'function') {
          try { next = cls.cloneSlot(el.id, isFree); } catch (e) {}
        }
        // Re-checked here so a misbehaving static can't smuggle a dupe
        // or an unsafe value into the document / the emitted op.
        if (typeof next === 'string' && isFree(next)) {
          ids[el.id] = next;
          used.add(next);
          el.id = next;
          found = true;
        } else {
          el.removeAttribute('id');
        }
      });
      return found ? ids : null;
    }

    _toggleSkip(i) {
      if (this._railLock) return;
      const slide = this._slides[i];
      if (!slide) return;
      const on = !slide.hasAttribute('data-deck-skip');
      if (this._emitDcOp(
        on ? { op: 'setAttr', attr: 'data-deck-skip', value: '' }
           : { op: 'removeAttr', attr: 'data-deck-skip' },
        slide, false
      )) return;
      if (on) slide.setAttribute('data-deck-skip', '');
      else slide.removeAttribute('data-deck-skip');
    }

    _skippedIndices() {
      const out = [];
      for (let i = 0; i < this._slides.length; i++) {
        if (this._slides[i].hasAttribute('data-deck-skip')) out.push(i);
      }
      return out;
    }

    /** Rail numbering, skip-aware: a skipped slide shows no number and the
     *  rest stay contiguous (1..visible), so the labels match the positions
     *  the overlay counter reports. Cheap (text writes are diffed), safe to
     *  call after any reconcile or skip toggle. */
    _renumberRail() {
      let v = 0;
      (this._thumbs || []).forEach((t) => {
        const label = t.slide.hasAttribute('data-deck-skip') ? '' : String(++v);
        if (t.num.textContent !== label) t.num.textContent = label;
      });
    }

    /** Skip-aware label for slide i — the same numbering _renumberRail
     *  paints: '' for a skipped slide, else its 1-based position among
     *  non-skipped slides. Display surfaces (e.g. the delete confirm)
     *  use this so they never name a number the rail doesn't show. */
    _slideLabel(i) {
      const s = this._slides[i];
      if (!s || s.hasAttribute('data-deck-skip')) return '';
      let v = 0;
      for (let k = 0; k <= i; k++) {
        if (!this._slides[k].hasAttribute('data-deck-skip')) v++;
      }
      return String(v);
    }

    /** Overlay counter, skip-aware: position among non-skipped slides over
     *  the non-skipped total. A skipped CURRENT slide (reachable by rail
     *  click or deep link, never by _advance) shows '–' — its number is
     *  gone from the rail, so any digit here would lie. */
    _syncCount() {
      if (!this._countEl || !this._totalEl) return;
      // Empty deck: keep the overlay's initial "1 / 1" (it has nothing to
      // count and isn't visible without slides) — the guest fallback for
      // frozen copies leaves empty decks alone for the same rendering.
      if (!this._slides.length) {
        this._countEl.textContent = '1';
        this._totalEl.textContent = '1';
        return;
      }
      let pos = 0, total = 0;
      this._slides.forEach((s, i) => {
        if (!s.hasAttribute('data-deck-skip')) {
          total++;
          if (i <= this._index) pos = total;
        }
      });
      const cur = this._slides[this._index];
      const curSkipped = !cur || cur.hasAttribute('data-deck-skip');
      this._countEl.textContent = curSkipped ? '–' : String(pos);
      this._totalEl.textContent = String(total);
    }

    _moveSlide(i, j) {
      if (this._railLock || j < 0 || j >= this._slides.length || j === i) return;
      const cur = this._index;
      const ni = cur === i ? j
        : (i < cur && j >= cur) ? cur - 1
        : (i > cur && j <= cur) ? cur + 1
        : cur;
      const slide = this._slides[i];
      if (this._emitDcOp({ op: 'move', to: j }, slide, true, ni)) return;
      const ref = j < i ? this._slides[j] : this._slides[j].nextSibling;
      this._index = ni;
      this._squelchSlotChange = true;
      this.insertBefore(slide, ref);
      this._collectSlides();
      this._applyIndex({ showOverlay: false, broadcast: true, reason: 'mutation' });
    }

    // ── data-anim build animations ────────────────────────────────────────
    //
    // WAAPI-only playback of the data-anim contract (the same attributes
    // the PPTX exporter turns into native PowerPoint timing). Invariants:
    //   - Animate the independent translate / rotate / scale properties
    //     plus opacity / clip-path — NEVER the transform shorthand, which
    //     authors use for centering.
    //   - No inline styles and no DOM writes beyond data-deck-anim-* attrs
    //     (which OWN_ATTRS hides from the thumbnail observer). End states
    //     are held by fill:'both' Animation objects kept alive until the
    //     slide deactivates; persistent hidden states are the
    //     data-deck-anim-hidden attr + the head rule _injectAnimRule adds.
    //   - Only the active slide carries runtime state (this._animState =
    //     { slide, steps, played, anims }), so deactivation is one
    //     cancel-and-strip.
    //   - prefers-reduced-motion plays instantly but keeps click gating;
    //     noscale and _snthumb thumbnail iframes disable the engine
    //     outright (authored base state).

    /** Companion to _syncPrintPageRule — one document-level rule (shadow
     *  chrome styles can't reach light-DOM slide content) hiding pre-play
     *  entrance targets. @media screen keeps print on the base state;
     *  :not([noscale]) keeps the PPTX capture on it; thumbnail clones sit
     *  in nested shadow roots the descendant combinator can't reach, so
     *  the rail always shows finished layouts. */
    _injectAnimRule() {
      const id = 'deck-stage-anim';
      if (document.getElementById(id)) return;
      const tag = document.createElement('style');
      tag.id = id;
      // Mask-driven effects (wheel/split/random-bars): the gradient must live
      // in a stylesheet — a var() inside a WAAPI keyframe value is substituted
      // against the base style when the keyframe is parsed, so it would bake
      // the initial 0 and never sweep. Rules are keyed by the runtime
      // data-deck-anim-mask attr and read the keyframe-animated --deck-anim-t.
      let mask = '';
      if (MASK_OK) {
        const T = 'var(--deck-anim-t)';
        const wheel = 'conic-gradient(#000 0deg calc(' + T + '*1turn), transparent calc(' + T + '*1turn) 1turn)';
        // Wedge opens symmetrically from 12 o'clock, both directions at once.
        const wedge = 'conic-gradient(#000 0deg calc(' + T + '*180deg), transparent calc(' + T + '*180deg) calc(360deg - ' + T + '*180deg), #000 calc(360deg - ' + T + '*180deg) 360deg)';
        const split = (ang) => 'linear-gradient(' + ang + ', #000 0 calc(' + T + '*50%), transparent calc(' + T + '*50%) calc(100% - ' + T + '*50%), #000 calc(100% - ' + T + '*50%) 100%)';
        // Uniform slats growing to the full period — PowerPoint's Blinds.
        const blinds = (ang) => 'repeating-linear-gradient(' + ang + ', #000 0 calc(' + T + '*12px), transparent calc(' + T + '*12px) 12px)';
        // Random bars: four sub-stripes of one 17px period pop in over
        // staggered quarters of the timeline (clamp gates each), so thin
        // bars APPEAR in scrambled order instead of thickening in unison —
        // the closest gradient-mask read of PowerPoint's per-shape noise.
        const bar = (ang, at, w, from) => 'repeating-linear-gradient(' + ang + ', transparent 0 ' + at + 'px, #000 ' + at + 'px calc(' + at + 'px + clamp(0, (' + T + ' - ' + from + ')*4, 1)*' + w + 'px), transparent calc(' + at + 'px + clamp(0, (' + T + ' - ' + from + ')*4, 1)*' + w + 'px) 17px)';
        const bars = (ang) => [bar(ang, 0, 4, 0.5), bar(ang, 4, 5, 0), bar(ang, 9, 4, 0.75), bar(ang, 13, 4, 0.25)].join(', ');
        // Box "in": four edge bands close on the center ("out" is clip-path).
        const edge = (ang) => 'linear-gradient(' + ang + ', #000 0 calc(' + T + '*50%), transparent calc(' + T + '*50%))';
        const boxIn = [edge('90deg'), edge('270deg'), edge('180deg'), edge('0deg')].join(', ');
        // Diamond "in": four diagonal half-planes leave a shrinking
        // diamond-shaped hole ("out" is clip-path).
        const diamondIn = [edge('45deg'), edge('135deg'), edge('225deg'), edge('315deg')].join(', ');
        const circle = (isIn) => isIn
          ? 'radial-gradient(circle farthest-corner at 50% 50%, transparent 0 calc((1 - ' + T + ')*100%), #000 calc((1 - ' + T + ')*100%))'
          : 'radial-gradient(circle farthest-corner at 50% 50%, #000 0 calc(' + T + '*100%), transparent calc(' + T + '*100%))';
        // Plus "out": two center bands grow into a cross; "in": four corner
        // conic quadrants close on the center around a shrinking cross.
        const band = (ang) => 'linear-gradient(' + ang + ', transparent 0 calc(50% - ' + T + '*50%), #000 calc(50% - ' + T + '*50%) calc(50% + ' + T + '*50%), transparent calc(50% + ' + T + '*50%))';
        const plusOut = [band('180deg'), band('90deg')].join(', ');
        const quad = (fromDeg, x, y) => 'conic-gradient(from ' + fromDeg + ' at ' + x + ' ' + y + ', #000 0 90deg, transparent 90deg 360deg)';
        const near = 'calc(' + T + '*50%)';
        const far = 'calc(100% - ' + T + '*50%)';
        const plusIn = [quad('270deg', near, near), quad('0deg', far, near), quad('90deg', far, far), quad('180deg', near, far)].join(', ');
        // Strips: a hard diagonal front sweeping toward the named corner
        // (the staircase quantization is export-only).
        const strips = (ang) => 'linear-gradient(' + ang + ', #000 0 calc(' + T + '*100%), transparent calc(' + T + '*100%))';
        // Checkerboard: 12px rows (or columns) sweep across, odd lanes
        // lagging the even ones — the tile quadrant trick needs mask-size,
        // carried per variant below.
        const lag = 'calc(clamp(0, (' + T + ' - 0.15)/0.85, 1)*100%)';
        const lead = 'calc(' + T + '*100%)';
        const checkH = quad('270deg', lead, '12px') + ', ' + quad('270deg', lag, '24px');
        const checkV = quad('270deg', '12px', lead) + ', ' + quad('270deg', '24px', lag);
        // Dissolve: two offset dot lattices whose dots grow to cover their
        // tiles, the second gated to start late — a coarse dither.
        const dot = (r, from) => {
          const rr = from ? 'calc(clamp(0, (' + T + ' - ' + from + ')*1.4, 1)*' + r + 'px)' : 'calc(' + T + '*' + r + 'px)';
          return 'radial-gradient(circle at 50% 50%, #000 0 ' + rr + ', transparent ' + rr + ')';
        };
        const dissolve = dot(8, 0) + ', ' + dot(10, 0.25);
        const variants = {
          'wheel': wheel,
          'wedge': wedge,
          'split-v': split('90deg'),
          'split-h': split('180deg'),
          'bars-h': bars('180deg'),
          'bars-v': bars('90deg'),
          'blinds-h': blinds('180deg'),
          'blinds-v': blinds('90deg'),
          'checker-h': { i: checkH, s: '100% 24px, 100% 24px' },
          'checker-v': { i: checkV, s: '24px 100%, 24px 100%' },
          'dissolve': { i: dissolve, s: '11px 11px, 14px 14px', p: '0 0, 4px 7px' },
          'box-in': boxIn,
          'circle-in': circle(true),
          'circle-out': circle(false),
          'diamond-in': diamondIn,
          'plus-in': plusIn,
          'plus-out': plusOut,
          'strips-dr': strips('135deg'),
          'strips-dl': strips('225deg'),
          'strips-ur': strips('45deg'),
          'strips-ul': strips('315deg'),
        };
        mask = Object.keys(variants).map((k) => {
          const v = typeof variants[k] === 'string' ? { i: variants[k] } : variants[k];
          let decl = '-webkit-mask-image: ' + v.i + '; mask-image: ' + v.i + ';';
          if (v.s) decl += ' -webkit-mask-size: ' + v.s + '; mask-size: ' + v.s + ';';
          if (v.p) decl += ' -webkit-mask-position: ' + v.p + '; mask-position: ' + v.p + ';';
          return ' deck-stage:not([noscale]) [' + ANIM_MASK_ATTR + '="' + k + '"] { ' + decl + ' }';
        }).join('');
      }
      tag.textContent = '@media screen { deck-stage:not([noscale]) [' + ANIM_HIDDEN_ATTR + '] { visibility: hidden !important; opacity: 0 !important; }' + mask + ' }';
      document.head.appendChild(tag);
    }

    /** The engine is off wherever a capture must see the authored base
     *  state: noscale (the PPTX exporter sets it before any goTo) and the
     *  presenter popup's ?_snthumb= thumbnail iframes. */
    _animEnabled() {
      return !this.hasAttribute('noscale') && !/[?&]_snthumb=/.test(location.search);
    }

    /** Navigation policy (stateless, PowerPoint-style), called from
     *  _applyIndex: forward arrival resets to un-played and autoplays the
     *  auto step; backward arrival lands fully built; same-index re-entry
     *  (afterprint, host re-renders that swapped the slide element)
     *  restores built state without replaying — unless live state already
     *  sits on this element, which is left alone. The outgoing slide is
     *  cleared first so runtime state never outlives the active slide. */
    _animOnNav(prev, curr) {
      const slide = this._slides[curr] || null;
      if (this._animState && this._animState.slide !== slide) {
        this._animClear(this._animState.slide);
      }
      if (!slide || !this._animEnabled()) return;
      if (prev === curr) {
        if (!this._animState) this._animApplyBuilt(slide);
      } else if (prev >= 0 && curr < prev) {
        this._animApplyBuilt(slide);
      } else {
        this._animReset(slide);
      }
    }

    /** Parse a slide's [data-anim] elements into sorted entries. Unknown
     *  effects, path effects without a usable data-anim-path, zero-degree
     *  spins/teeters and scale-1 grow/shrink/pulses stay static — mirroring
     *  the exporter's fallbacks so preview and PPTX step math agree. Sort:
     *  data-anim-order (default 0) first, document order breaking ties. */
    _animModel(slide) {
      const out = [];
      slide.querySelectorAll('[data-anim]').forEach((el, i) => {
        const effect = (el.getAttribute('data-anim') || '').trim();
        const spec = ANIM_EFFECTS[effect];
        if (!spec) return;
        const num = (name, dflt) => {
          const v = parseFloat(el.getAttribute(name));
          return Number.isFinite(v) ? v : dflt;
        };
        const trig = (el.getAttribute('data-anim-trigger') || '').trim();
        const dirRaw = (el.getAttribute('data-anim-dir') || '').trim();
        // dir families (same fallbacks as the exporter): fly/wipe take the
        // four edges, float only top|bottom, split/random-bars/blinds/
        // checkerboard the bar/seam axis (split defaults to PowerPoint's
        // "Vertical In"), box/circle/diamond/plus in|out (entrances default
        // in, exits out), strips the corner the sweep travels toward.
        let dir = 'bottom';
        if (/^(split|random-bars|blinds|checkerboard)-/.test(effect)) {
          const dflt = effect.indexOf('split') === 0 ? 'vertical' : 'horizontal';
          dir = dirRaw === 'horizontal' || dirRaw === 'vertical' ? dirRaw : dflt;
        } else if (/^(box|circle|diamond|plus)-/.test(effect)) {
          const dflt = /-out$/.test(effect) ? 'out' : 'in';
          dir = dirRaw === 'in' || dirRaw === 'out' ? dirRaw : dflt;
        } else if (effect === 'strips-in' || effect === 'strips-out') {
          dir = dirRaw === 'down-left' || dirRaw === 'up-right' || dirRaw === 'up-left' ? dirRaw : 'down-right';
        } else if (effect === 'float-in' || effect === 'float-out') {
          dir = dirRaw === 'top' ? 'top' : 'bottom';
        } else if (dirRaw === 'left' || dirRaw === 'right' || dirRaw === 'top') {
          dir = dirRaw;
        }
        // Auto-reverse only means something on spin/grow/shrink/path (a
        // reversed entrance ends hidden; a reversed exit fights the re-hide;
        // pulse and teeter already return to base on their own).
        const revRaw = el.getAttribute('data-anim-auto-reverse');
        const revOk = effect === 'spin' || effect === 'grow' || effect === 'shrink' || effect === 'path';
        const e = {
          el,
          effect,
          kind: spec.kind,
          trigger: trig === 'click' || trig === 'with' ? trig : 'after',
          delay: Math.min(60000, Math.max(0, num('data-anim-delay', 0))),
          dur: spec.dur === 1 ? 1 : Math.min(60000, Math.max(1, num('data-anim-duration', spec.dur))),
          order: num('data-anim-order', 0),
          docIndex: i,
          dir,
          rotate: Math.max(-3600, Math.min(3600, num('data-anim-rotate', effect === 'teeter' ? 5 : 360))),
          scale: Math.max(0.1, Math.min(5, num('data-anim-scale',
            effect === 'shrink' ? 0.67 : effect === 'pulse' ? 1.05 : 1.5))),
          repeat: spec.dur === 1 ? 1
            : Math.max(1, Math.min(100, Math.floor(num('data-anim-repeat', 1)) || 1)),
          autoRev: revOk && revRaw !== null && /^(true|1)?$/i.test(revRaw.trim()),
          // Mask-rule variant for the gradient-mask effects (see _injectAnimRule).
          mask: null,
          path: null,
          baseOpacity: 1,
        };
        if (MASK_OK) {
          if (effect === 'wheel-in' || effect === 'wheel-out') e.mask = 'wheel';
          else if (effect === 'wedge-in' || effect === 'wedge-out') e.mask = 'wedge';
          else if (effect === 'split-in' || effect === 'split-out') e.mask = dir === 'horizontal' ? 'split-h' : 'split-v';
          else if (effect === 'random-bars-in' || effect === 'random-bars-out') e.mask = dir === 'vertical' ? 'bars-v' : 'bars-h';
          else if (effect === 'blinds-in' || effect === 'blinds-out') e.mask = dir === 'vertical' ? 'blinds-v' : 'blinds-h';
          else if (effect === 'checkerboard-in' || effect === 'checkerboard-out') e.mask = dir === 'vertical' ? 'checker-v' : 'checker-h';
          else if (effect === 'dissolve-in' || effect === 'dissolve-out') e.mask = 'dissolve';
          // box(out)/diamond(out) are clip-path keyframes, no mask needed.
          else if (effect === 'box-in' || effect === 'box-out') e.mask = dir === 'out' ? null : 'box-in';
          else if (effect === 'diamond-in' || effect === 'diamond-out') e.mask = dir === 'out' ? null : 'diamond-in';
          else if (effect === 'circle-in' || effect === 'circle-out') e.mask = dir === 'out' ? 'circle-out' : 'circle-in';
          else if (effect === 'plus-in' || effect === 'plus-out') e.mask = dir === 'out' ? 'plus-out' : 'plus-in';
          else if (effect === 'strips-in' || effect === 'strips-out') {
            e.mask = { 'down-right': 'strips-dr', 'down-left': 'strips-dl', 'up-right': 'strips-ur', 'up-left': 'strips-ul' }[dir];
          }
        }
        if (effect === 'path') {
          e.path = this._parseAnimPath(el.getAttribute('data-anim-path'));
          if (!e.path) return;
        }
        if ((effect === 'spin' || effect === 'teeter') && !e.rotate) return;
        if ((effect === 'grow' || effect === 'shrink' || effect === 'pulse') && e.scale === 1) return;
        // Fades and fade-composed effects must land on the author's opacity,
        // not a hard 1 — measured here, before _animReset applies the hidden
        // attr (whose opacity:0 !important would poison the read). The mask
        // effects need it only for their no-@property fade fallback.
        if (/^(fade|zoom|float|bounce)-/.test(effect) || effect === 'pulse'
            || (!MASK_OK && /^(wheel|wedge|split|random-bars|blinds|checkerboard|dissolve|box|circle|diamond|plus|strips)-/.test(effect))) {
          const o = parseFloat(getComputedStyle(el).opacity);
          if (Number.isFinite(o)) e.baseOpacity = o;
        }
        out.push(e);
      });
      return out.sort((a, b) => (a.order - b.order) || (a.docIndex - b.docIndex));
    }

    /** data-anim-path parser — the same SVG subset the exporter accepts:
     *  optional `M x y`, then `L x y` / `C x1 y1 x2 y2 x y` segments,
     *  comma/whitespace separated, slide-coordinate px offsets relative to
     *  the element's base position, +y down. Cubics are flattened to 16
     *  samples for the keyframe list; points are re-based so the first is
     *  0,0 (base-state invariant) and capped at 32. Null when unusable. */
    _parseAnimPath(str) {
      const toks = String(str || '').trim().split(/[\s,]+/).filter(Boolean);
      let i = 0;
      const num = () => parseFloat(toks[i++]);
      const pts = [{ x: 0, y: 0 }];
      if ((toks[i] || '').toUpperCase() === 'M') {
        i++;
        const x = num(), y = num();
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        pts[0] = { x, y };
      }
      while (i < toks.length && pts.length < 32) {
        const cmd = String(toks[i++]).toUpperCase();
        if (cmd === 'L') {
          const x = num(), y = num();
          if (!Number.isFinite(x) || !Number.isFinite(y)) break;
          pts.push({ x, y });
        } else if (cmd === 'C') {
          const x1 = num(), y1 = num(), x2 = num(), y2 = num(), x = num(), y = num();
          if (![x1, y1, x2, y2, x, y].every(Number.isFinite)) break;
          const p0 = pts[pts.length - 1];
          for (let k = 1; k <= 16 && pts.length < 32; k++) {
            const t = k / 16, u = 1 - t;
            pts.push({
              x: u * u * u * p0.x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x,
              y: u * u * u * p0.y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y,
            });
          }
        } else break;
      }
      if (pts.length < 2) return null;
      const bx = pts[0].x, by = pts[0].y;
      return pts.map((p) => ({ x: p.x - bx, y: p.y - by }));
    }

    /** Fold sorted entries into steps. steps[0] is the auto step (played
     *  on slide arrival); each trigger="click" opens a new click-gated
     *  step. Starts are ms from the step's own start: click = own delay,
     *  with = previous element's start + delay, after = end of everything
     *  already scheduled in the step + delay (PowerPoint's After Previous —
     *  must match the exporter's timing.ts grouping exactly). */
    _animSteps(entries) {
      const steps = [{ items: [] }];
      let prevStart = 0;
      let stepEnd = 0;
      entries.forEach((e) => {
        let start;
        if (e.trigger === 'click') {
          steps.push({ items: [] });
          prevStart = 0;
          stepEnd = 0;
          start = e.delay;
        } else if (e.trigger === 'with') {
          start = prevStart + e.delay;
        } else {
          start = stepEnd + e.delay;
        }
        steps[steps.length - 1].items.push({ e, start });
        prevStart = start;
        // `after` waits out repeats and the auto-reverse leg, not just one
        // pass — gen-pptx's timing.ts grouping mirrors this line.
        stepEnd = Math.max(stepEnd, start + e.dur * e.repeat * (e.autoRev ? 2 : 1));
      });
      return steps;
    }

    /** Forward arrival: entrance targets hidden, everything else at base,
     *  then autoplay the auto step. Anim-free slides keep a null state so
     *  every other path stays on today's behaviour. */
    _animReset(slide) {
      this._animClear(slide);
      const entries = this._animModel(slide);
      if (!entries.length) return;
      const steps = this._animSteps(entries);
      const st = { slide, steps, played: 0, anims: [] };
      this._animState = st;
      entries.forEach((e) => {
        if (e.kind === 'entr') e.el.setAttribute(ANIM_HIDDEN_ATTR, '');
      });
      this._animRun(st, steps[0], false);
    }

    /** Backward / same-index arrival: every step executed instantly —
     *  entrances visible, exits hidden, emphasis and path at their end
     *  states — with the click gating already spent. */
    _animApplyBuilt(slide) {
      this._animClear(slide);
      const entries = this._animModel(slide);
      if (!entries.length) return;
      const steps = this._animSteps(entries);
      const st = { slide, steps, played: steps.length - 1, anims: [] };
      this._animState = st;
      entries.forEach((e) => {
        if (e.kind === 'entr') e.el.setAttribute(ANIM_HIDDEN_ATTR, '');
      });
      steps.forEach((step) => this._animRun(st, step, true));
    }

    /** True when the current slide still has an unplayed click step. */
    _animPendingStep() {
      const st = this._animState;
      return !!(st && st.slide === this._slides[this._index]
        && st.played < st.steps.length - 1 && this._animEnabled());
    }

    /** Play the next click-gated step and announce it. Mirrors slidechange:
     *  bubbles + composes out of the shadow root so hosts can track build
     *  progress. step is 1-based across the slide's click steps. */
    _animPlayStep() {
      const st = this._animState;
      if (!st || st.played >= st.steps.length - 1) return;
      st.played += 1;
      this._animRun(st, st.steps[st.played], false);
      this.dispatchEvent(new CustomEvent('deckstep', {
        detail: { index: this._index, step: st.played, totalSteps: st.steps.length - 1 },
        bubbles: true,
        composed: true,
      }));
    }

    /** Start every animation in one step. Entrance targets lose the hidden
     *  attr here and ride the backwards fill of their own from-keyframe
     *  (visibility:hidden) through any delay — no timers. instant (or
     *  reduced-motion) jumps straight to the end state. Exits re-apply the
     *  hidden attr once finished so their hidden state is attribute-backed;
     *  the state-identity guard keeps a late finish from re-hiding an
     *  element on a slide that was cleared meanwhile. */
    _animRun(st, step, instant) {
      const inst = instant || REDUCED_MQ.matches;
      step.items.forEach(({ e, start }) => {
        if (e.kind === 'entr') e.el.removeAttribute(ANIM_HIDDEN_ATTR);
        // Attach the stylesheet mask (wheel/split/random-bars) — the
        // keyframes below only drive --deck-anim-t through it.
        if (e.mask) e.el.setAttribute(ANIM_MASK_ATTR, e.mask);
        let anim;
        try {
          anim = e.el.animate(this._animKeyframes(e), {
            duration: e.dur,
            delay: inst ? 0 : start,
            easing: ANIM_LINEAR[e.effect] ? 'linear' : 'ease',
            fill: 'both',
            // WAAPI 2N alternate iterations ≡ PowerPoint repeatCount N with
            // autoRev — each forward leg replays backwards.
            iterations: e.repeat * (e.autoRev ? 2 : 1),
            direction: e.autoRev ? 'alternate' : 'normal',
          });
        } catch (err) { return; }
        if (inst) { try { anim.finish(); } catch (err) {} }
        if (e.kind === 'exit') {
          anim.finished.then(() => {
            if (this._animState === st) e.el.setAttribute(ANIM_HIDDEN_ATTR, '');
          }, () => {});
        }
        st.anims.push(anim);
      });
    }

    /** Keyframes per effect. Entrance/exit frames carry visibility so the
     *  fill phases hide the element through delays without DOM writes —
     *  discrete interpolation shows it for any progress > 0 toward
     *  'visible'. wipe/split/wheel/random-bars are clip-path or
     *  gradient-mask approximations of PowerPoint's filters; data-anim-dir
     *  is the "from/toward" side (or bar axis) throughout. Multi-frame
     *  effects (bounce/pulse/teeter) bake their pacing into keyframe
     *  offsets and per-frame easing. */
    _animKeyframes(e) {
      switch (e.effect) {
        case 'appear':
          return [{ visibility: 'hidden' }, { visibility: 'visible' }];
        case 'disappear':
          return [{ visibility: 'visible' }, { visibility: 'hidden' }];
        case 'fade-in':
          return [{ opacity: 0, visibility: 'hidden' }, { opacity: e.baseOpacity, visibility: 'visible' }];
        case 'fade-out':
          return [{ opacity: e.baseOpacity, visibility: 'visible' }, { opacity: 0, visibility: 'hidden' }];
        case 'fly-in': {
          const o = this._animFlyOffset(e);
          return [{ translate: o.x + 'px ' + o.y + 'px', visibility: 'hidden' },
                  { translate: '0px 0px', visibility: 'visible' }];
        }
        case 'fly-out': {
          const o = this._animFlyOffset(e);
          return [{ translate: '0px 0px', visibility: 'visible' },
                  { translate: o.x + 'px ' + o.y + 'px', visibility: 'hidden' }];
        }
        case 'wipe-in':
          return [{ clipPath: WIPE_INSET[e.dir], visibility: 'hidden' },
                  { clipPath: 'inset(0 0 0 0)', visibility: 'visible' }];
        case 'wipe-out':
          // Time-reverse of wipe-in: the erase sweeps toward data-anim-dir,
          // matching the exporter's entrance filter with transition="out".
          return [{ clipPath: 'inset(0 0 0 0)', visibility: 'visible' },
                  { clipPath: WIPE_INSET[e.dir], visibility: 'hidden' }];
        case 'float-in': {
          const dy = this._animFloatOffset(e);
          return [{ translate: '0px ' + dy + 'px', opacity: 0, visibility: 'hidden' },
                  { translate: '0px 0px', opacity: e.baseOpacity, visibility: 'visible' }];
        }
        case 'float-out': {
          const dy = this._animFloatOffset(e);
          return [{ translate: '0px 0px', opacity: e.baseOpacity, visibility: 'visible' },
                  { translate: '0px ' + dy + 'px', opacity: 0, visibility: 'hidden' }];
        }
        case 'zoom-in':
          return [{ scale: '0.1', opacity: 0, visibility: 'hidden' },
                  { scale: '1', opacity: e.baseOpacity, visibility: 'visible' }];
        case 'zoom-out':
          return [{ scale: '1', opacity: e.baseOpacity, visibility: 'visible' },
                  { scale: '0.1', opacity: 0, visibility: 'hidden' }];
        case 'box-in':
        case 'box-out': {
          // dir=out grows/shrinks a centered rectangle — plain clip-path,
          // works even without @property. dir=in uses the edge-band mask.
          if (e.dir === 'out') {
            const from = { clipPath: 'inset(50% 50% 50% 50%)', visibility: 'hidden' };
            const to = { clipPath: 'inset(0 0 0 0)', visibility: 'visible' };
            return e.kind === 'entr' ? [from, to] : [to, from];
          }
          return this._animMaskFrames(e);
        }
        case 'diamond-in':
        case 'diamond-out': {
          // dir=out grows/shrinks a centered diamond polygon (vertices past
          // the box so the corners are covered at full size).
          if (e.dir === 'out') {
            const from = { clipPath: 'polygon(50% 50%, 50% 50%, 50% 50%, 50% 50%)', visibility: 'hidden' };
            const to = { clipPath: 'polygon(50% -50%, 150% 50%, 50% 150%, -50% 50%)', visibility: 'visible' };
            return e.kind === 'entr' ? [from, to] : [to, from];
          }
          return this._animMaskFrames(e);
        }
        case 'split-in':
        case 'split-out':
        case 'wheel-in':
        case 'wheel-out':
        case 'wedge-in':
        case 'wedge-out':
        case 'random-bars-in':
        case 'random-bars-out':
        case 'blinds-in':
        case 'blinds-out':
        case 'checkerboard-in':
        case 'checkerboard-out':
        case 'dissolve-in':
        case 'dissolve-out':
        case 'circle-in':
        case 'circle-out':
        case 'plus-in':
        case 'plus-out':
        case 'strips-in':
        case 'strips-out':
          return this._animMaskFrames(e);
        case 'bounce-in': {
          // Damped hops matching the exporter's motion path: in from the
          // left quarter, drop 1/3 of the slide, rebounds of 1/9, 1/27,
          // 1/81. Falls ease in (gravity), rises ease out.
          const c = this._animCanvasSize();
          const fx = [-0.25, -0.085, -0.053, -0.021, -0.014, -0.0075, -0.004, 0];
          const fy = [-0.33333, 0, -0.11111, 0, -0.037, 0, -0.0123, 0];
          const offs = [0, 0.36, 0.55, 0.73, 0.82, 0.91, 0.955, 1];
          return offs.map((off, k) => ({
            offset: off,
            translate: Math.round(fx[k] * c.w) + 'px ' + Math.round(fy[k] * c.h) + 'px',
            opacity: k === 0 ? 0 : e.baseOpacity,
            visibility: k === 0 ? 'hidden' : 'visible',
            easing: k % 2 === 0 ? 'ease-in' : 'ease-out',
          }));
        }
        case 'bounce-out': {
          // Growing hops, then the plunge off the bottom drifting right;
          // fades over the final fifth like the exporter's late fade.
          const c = this._animCanvasSize();
          const fx = [0, 0.004, 0.0075, 0.014, 0.021, 0.053, 0.085, 0.25];
          const fy = [0, -0.0123, 0, -0.037, 0, -0.111, 0, 1.1];
          const offs = [0, 0.045, 0.09, 0.185, 0.28, 0.46, 0.64, 1];
          const frames = offs.map((off, k) => ({
            offset: off,
            translate: Math.round(fx[k] * c.w) + 'px ' + Math.round(fy[k] * c.h) + 'px',
            opacity: e.baseOpacity,
            visibility: 'visible',
            easing: k % 2 === 0 ? 'ease-out' : 'ease-in',
          }));
          frames[frames.length - 2].easing = 'ease-in'; // the plunge
          frames[frames.length - 1].opacity = 0;
          frames[frames.length - 1].visibility = 'hidden';
          frames.splice(frames.length - 1, 0, { offset: 0.8, opacity: e.baseOpacity });
          return frames;
        }
        case 'spin':
          return [{ rotate: '0deg' }, { rotate: e.rotate + 'deg' }];
        case 'grow':
        case 'shrink':
          return [{ scale: '1' }, { scale: String(e.scale) }];
        case 'pulse':
          // Exactly the curve the exporter writes (and PowerPoint plays):
          // linear scale to the peak at the midpoint and back, opacity
          // dipping to 50% over the 20–80% window (the native tmFilter).
          return [
            { offset: 0, scale: '1', opacity: e.baseOpacity },
            { offset: 0.2, opacity: 0.5 * e.baseOpacity },
            { offset: 0.5, scale: String(e.scale) },
            { offset: 0.8, opacity: 0.5 * e.baseOpacity },
            { offset: 1, scale: '1', opacity: e.baseOpacity },
          ];
        case 'teeter': {
          // Rock +A −A +A −A and settle, holding the first tilt briefly —
          // the same five-step schedule the exporter writes, at the same
          // constant rate PowerPoint plays each rock.
          const A = e.rotate;
          const offs = [0, 0.1, 0.2, 0.4, 0.6, 0.8, 1];
          const rots = [0, A, A, -A, A, -A, 0];
          return offs.map((off, k) => ({ offset: off, rotate: rots[k] + 'deg' }));
        }
        case 'path':
          return e.path.map((p) => ({ translate: p.x + 'px ' + p.y + 'px' }));
      }
      return [{}, {}];
    }

    /** Shared frames for the gradient-mask effects (wheel/wedge/split/
     *  random-bars/blinds/checkerboard/dissolve/circle/plus/strips and the
     *  dir=in box/diamond variants). The gradient itself lives in the
     *  injected stylesheet, keyed by the data-deck-anim-mask attr _animRun
     *  sets — a var() inside a keyframe value would be substituted against
     *  the base style (t=0) at parse time and never sweep. Keyframes drive
     *  only the registered --deck-anim-t: 0 = fully hidden, 1 = fully
     *  shown. No @property support → honest fade at the same duration. */
    _animMaskFrames(e) {
      const isIn = e.kind === 'entr';
      if (!e.mask) {
        return isIn
          ? [{ opacity: 0, visibility: 'hidden' }, { opacity: e.baseOpacity, visibility: 'visible' }]
          : [{ opacity: e.baseOpacity, visibility: 'visible' }, { opacity: 0, visibility: 'hidden' }];
      }
      const hidden = { '--deck-anim-t': 0, visibility: 'hidden' };
      const shown = { '--deck-anim-t': 1, visibility: 'visible' };
      return isIn ? [hidden, shown] : [shown, hidden];
    }

    /** Design-space canvas size (viewport rects are scaled; divide it out). */
    _animCanvasSize() {
      const s = this._scale || 1;
      const cr = this._canvas.getBoundingClientRect();
      return { w: cr.width / s, h: cr.height / s };
    }

    /** Float drift in design-space px — 0.1 canvas heights, the same offset
     *  the exporter writes (#ppt_y±.1); dir is the side it drifts in from /
     *  out to. */
    _animFloatOffset(e) {
      const dy = 0.1 * this._animCanvasSize().h;
      return e.dir === 'top' ? -dy : dy;
    }

    /** Fly distance in design-space px — from the element's base rect to
     *  just past the canvas edge on the data-anim-dir side. Rects are
     *  viewport-scaled, so divide by the scale _fit stored. The slide's
     *  overflow:hidden clips the off-canvas position; the from-keyframe's
     *  visibility:hidden covers slides that override it. */
    _animFlyOffset(e) {
      const s = this._scale || 1;
      const cr = this._canvas.getBoundingClientRect();
      const r = e.el.getBoundingClientRect();
      switch (e.dir) {
        case 'left': return { x: -Math.max(0, r.right - cr.left) / s, y: 0 };
        case 'right': return { x: Math.max(0, cr.right - r.left) / s, y: 0 };
        case 'top': return { x: 0, y: -Math.max(0, r.bottom - cr.top) / s };
        default: return { x: 0, y: Math.max(0, cr.bottom - r.top) / s };
      }
    }

    /** Cancel the slide's Animation objects and strip runtime attrs so its
     *  subtree returns to the authored base state. Safe on detached or
     *  never-animated slides. */
    _animClear(slide) {
      if (!slide) return;
      if (this._animState && this._animState.slide === slide) {
        this._animState.anims.forEach((a) => { try { a.cancel(); } catch (e) {} });
        this._animState = null;
      }
      this._stripAnimAttrs(slide);
    }

    /** Remove every data-deck-anim-* runtime attr in a subtree — used by
     *  _animClear and as clone hygiene in _materialize/_duplicateSlide. */
    _stripAnimAttrs(root) {
      [ANIM_HIDDEN_ATTR, ANIM_MASK_ATTR].forEach((attr) => {
        if (root.removeAttribute) root.removeAttribute(attr);
        if (root.querySelectorAll) {
          root.querySelectorAll('[' + attr + ']').forEach((el) => el.removeAttribute(attr));
        }
      });
    }

    // Public API ------------------------------------------------------------

    /** Current slide index (0-based). */
    get index() { return this._index; }
    /** Total slide count. */
    get length() { return this._slides.length; }
    /** Unplayed click-gated build steps left on the current slide. */
    get stepsRemaining() {
      const st = this._animState;
      return st && st.slide === this._slides[this._index]
        ? Math.max(0, st.steps.length - 1 - st.played) : 0;
    }
    /** Programmatically navigate. */
    goTo(i) { this._go(i, 'api'); }
    next() { this._advance(1, 'api'); }
    prev() { this._advance(-1, 'api'); }
    reset() { this._go(0, 'api'); }
  }

  if (!customElements.get('deck-stage')) {
    customElements.define('deck-stage', DeckStage);
  }
})();
