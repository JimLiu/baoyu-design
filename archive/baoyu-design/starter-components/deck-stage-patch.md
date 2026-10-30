# deck-stage.js local patches

`deck-stage.js` is wholesale-overwritten whenever Claude Design ships an upgrade. This file records the local patches we layer on top of it, so they can be reapplied after each upgrade.

Per-upgrade flow:
1. Overwrite `deck-stage.js` with the new upstream version.
2. Reapply each patch below, locating it by its "anchor" string (so it still works even if upstream shifts line numbers).
3. Run `node --check deck-stage.js` to confirm there are no syntax errors.

---

## Patch 1: native fullscreen auto-hides the thumbnail rail

**Motivation**: the component only hides the rail when the host enters presentation mode via `postMessage({__omelette_presenting:true})`. It does **not** listen for native browser fullscreen. So when the deck is deployed standalone — or when fullscreen is entered with F11 / `element.requestFullscreen()` — the rail does not auto-hide.

**Approach**: add an independent `_fullscreen` flag and listen for `fullscreenchange`. Use a separate flag rather than reusing `_presenting`, so it doesn't clobber the host's presentation-mode messages (both paths can coexist).

Four edits.

### 1.1 `connectedCallback` — register the fullscreenchange listener

**Anchor** (immediately after the beforeprint/afterprint registration):

```js
      window.addEventListener('beforeprint', this._onBeforePrint);
      window.addEventListener('afterprint', this._onAfterPrint);
```

**Insert after it**:

```js
      // Native browser fullscreen (F11 / element.requestFullscreen) hides the
      // rail the same way host-driven presenting does. Independent flag so it
      // doesn't clobber _presenting when both paths are in play.
      this._onFsChange = () => {
        this._fullscreen = !!document.fullscreenElement;
        this._syncRailHidden();
        this._fit();
        this._scaleThumbs();
      };
      document.addEventListener('fullscreenchange', this._onFsChange);
```

### 1.2 `disconnectedCallback` — unbind the listener

**Anchor**:

```js
      window.removeEventListener('afterprint', this._onAfterPrint);
```

**Insert after it**:

```js
      if (this._onFsChange) document.removeEventListener('fullscreenchange', this._onFsChange);
```

### 1.3 `_railWidth()` — return 0 in fullscreen (let the canvas fill)

**Anchor / before**:

```js
      if (!this._railEnabled || !this._railVisible || this.hasAttribute('no-rail')
          || this.hasAttribute('noscale') || this._presenting || this._previewMode
          || NARROW_MQ.matches) return 0;
```

**After** (add `|| this._fullscreen`):

```js
      if (!this._railEnabled || !this._railVisible || this.hasAttribute('no-rail')
          || this.hasAttribute('noscale') || this._presenting || this._previewMode
          || this._fullscreen || NARROW_MQ.matches) return 0;
```

### 1.4 `_syncRailHidden()` — count fullscreen as a hard hide (display:none)

**Anchor / before**:

```js
      const hard = !this._railEnabled || this._presenting || this._previewMode;
```

**After** (add `|| this._fullscreen`):

```js
      const hard = !this._railEnabled || this._presenting || this._previewMode || this._fullscreen;
```

---

## Patch 2: Fullscreen toggle button + `F` shortcut in the overlay toolbar

**Motivation**: give the deck a one-click way into native fullscreen presenting, with a discoverable `F` shortcut, reusing Patch 1's rail-hide. (`requestFullscreen()` needs a user gesture — both a button click and a keydown satisfy that.)

**Builds on Patch 1 — apply that first.** Seven edits.

### 2.1 `stylesheet` — style the toolbar button and its `F` badge

First broaden the keycap rule so the new button's badge is styled too. **Before**:

```css
    .btn.reset .kbd {
```

**After**:

```css
    .btn .kbd {
```

Then add the fullscreen-button rules. **Anchor** (the closing brace of that `.kbd` rule, just before `.count`):

```css
      border-radius: 4px;
    }

    .count {
```

**Insert the `.btn.fs` rules between them**:

```css
      border-radius: 4px;
    }
    .btn.fs { padding: 0 8px; gap: 6px; }
    .btn.fs .fs-exit { display: none; }
    :host([data-fullscreen]) .btn.fs .fs-enter { display: none; }
    :host([data-fullscreen]) .btn.fs .fs-exit { display: block; }

    .count {
```

### 2.2 `_render` — add the button to the overlay markup

**Anchor** (the Reset button, last line of `overlay.innerHTML`):

```js
        <button class="btn reset" type="button" aria-label="Reset to first slide" title="Reset (R)">Reset<span class="kbd">R</span></button>
```

**Insert after it** (still inside the template literal). The two SVGs are the enter (corners-out) and exit (corners-in) icons; CSS from 2.1 shows one at a time based on `:host([data-fullscreen])`:

```js
        <button class="btn fs" type="button" aria-label="Enter fullscreen" title="Fullscreen (F)">
          <svg class="fs-enter" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4"/></svg>
          <svg class="fs-exit" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2v4H2M10 2v4h4M6 14v-4H2M10 14v-4h4"/></svg>
          <span class="kbd">F</span>
        </button>
```

### 2.3 `_render` — wire the click handler

**Anchor**:

```js
      overlay.querySelector('.reset').addEventListener('click', () => this._go(0, 'click'));
```

**Insert after it**:

```js
      overlay.querySelector('.fs').addEventListener('click', () => this._toggleFullscreen());
```

### 2.4 `_render` — keep a ref to the button (for the state-reflecting aria-label)

**Anchor**:

```js
      this._totalEl = overlay.querySelector('.total');
```

**Insert after it**:

```js
      this._fsBtn = overlay.querySelector('.fs');
```

### 2.5 Add the `_toggleFullscreen()` method

**Anchor** (the end of `_advance()`):

```js
      if (i < 0 || i >= this._slides.length) { this._flashOverlay(); return; }
      this._go(i, reason);
    }
```

**Insert after that closing brace**:

```js
    /** Toggle native fullscreen on the whole document. Must be called from a
     *  user gesture (button click or keydown) or requestFullscreen rejects.
     *  The fullscreenchange handler (Patch 1) hides the rail and swaps the
     *  button icon. Standard API only — F11 / webkit-prefixed flows are out
     *  of scope, matching Patch 1's listener. */
    _toggleFullscreen() {
      try {
        if (document.fullscreenElement) {
          if (document.exitFullscreen) document.exitFullscreen();
        } else if (document.documentElement.requestFullscreen) {
          const p = document.documentElement.requestFullscreen();
          if (p && p.catch) p.catch(() => {});
        }
      } catch (e) {}
    }
```

### 2.6 `_onKey` — add the `F` shortcut

**Anchor / before**:

```js
      } else if (key === 'r' || key === 'R') {
        this._go(0, 'keyboard');
      } else if (/^[0-9]$/.test(key)) {
```

**After** (insert an `f`/`F` branch — modifier-key combos already bail out earlier, so `Cmd/Ctrl+F` browser Find is untouched):

```js
      } else if (key === 'r' || key === 'R') {
        this._go(0, 'keyboard');
      } else if (key === 'f' || key === 'F') {
        this._toggleFullscreen();
      } else if (/^[0-9]$/.test(key)) {
```

### 2.7 `_onFsChange` — reflect state on the host + button (amends Patch 1.1)

**Anchor** (the first two lines of the Patch 1.1 handler):

```js
      this._onFsChange = () => {
        this._fullscreen = !!document.fullscreenElement;
```

**Insert immediately after the second line**:

```js
        this.toggleAttribute('data-fullscreen', this._fullscreen);
        if (this._fsBtn) {
          this._fsBtn.setAttribute('aria-label', this._fullscreen ? 'Exit fullscreen' : 'Enter fullscreen');
          this._fsBtn.setAttribute('title', this._fullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)');
        }
```

---

## Verification

- `node --check deck-stage.js` passes.
- Open any deck in the browser and enter fullscreen via the **Fullscreen API** — e.g. `document.documentElement.requestFullscreen()` from a user gesture (button/keypress). The rail and its right-edge resize handle both disappear (`.rail[data-presenting]{display:none}` plus the adjacent-sibling selector that hides the resize handle), and the canvas re-fits to fill the viewport; exiting fullscreen restores the rail.
  - Note: the browser's own F11 fullscreen does **not** fire `fullscreenchange` or set `document.fullscreenElement`, so it won't hide the rail — only the Fullscreen API does. This matches how a "present" button (which calls `requestFullscreen()`) behaves.
  - Quick check without a real gesture: in devtools, `const d = document.querySelector('deck-stage'); d._fullscreen = true; d._syncRailHidden(); d._fit(); d._scaleThumbs();` should hide the rail; set `d._fullscreen = false` and rerun to restore.
- Host presentation mode (`__omelette_presenting`) is unaffected — the two flags are independent.
- Patch 2: press `F` (or click the ⛶ button in the overlay toolbar) — the deck enters fullscreen, the rail hides (Patch 1), and the button swaps to the exit icon with an "Exit fullscreen" label; pressing `F` / clicking again, or Esc, exits and restores everything. `Cmd/Ctrl+F` still opens the browser's Find (modifier-key combos bail out of `_onKey` before the shortcut).

---

## Patch 3: data-anim build animations

**Motivation**: the deck skill's `data-anim` authoring contract (see `built-in-skills/make-a-deck.md`) gives slides per-element build animations that export as **native PowerPoint animations** via gen-pptx. Upstream deck-stage has no per-element animation support, so this patch adds the preview half: a Web Animations API (WAAPI) engine that plays the same attributes in the browser, with PowerPoint-style click stepping.

**Approach / invariants**:

- WAAPI only, animating the independent `translate` / `rotate` / `scale` properties plus `opacity` / `clip-path` — **never** the `transform` shorthand (authors use transform for centering). Wheel/split/random-bars approximate PowerPoint's filters with a gradient `mask-image` driven by one registered custom property (`--deck-anim-t`; see `MASK_OK` in the constants hunk). Both the mask string and the property live only inside keyframes, so `cancel()` cleans everything; browsers without `CSS.registerProperty` fall back to a plain fade.
- Effect timing follows PowerPoint's defaults (see `ANIM_EFFECTS`); `data-anim-repeat` and `data-anim-auto-reverse` (spin/grow/shrink/path only) map to WAAPI `iterations`/`direction:'alternate'`, and `_animSteps` counts the full repeated/reversed length when chaining `after` steps — the same formula gen-pptx's timing.ts uses, so preview and export stay in step.
- No inline styles; the only DOM writes are `data-deck-anim-*` runtime attrs, which the rail's `MutationObserver` already ignores (`OWN_ATTRS` matches every `data-deck-*` except `data-deck-skip`), so playback never re-clones thumbnails. End states are held by kept-alive `fill:'both'` Animation objects (cancelled on slide deactivation); persistent hidden states are the `data-deck-anim-hidden` attr plus one injected head rule.
- Base-state invariant: authored CSS **is** the finished layout. The head rule is scoped `@media screen` (print sees base state) and `deck-stage:not([noscale])` (PPTX capture sees base state); thumbnail clones live in nested shadow roots the descendant combinator can't reach.
- Navigation policy (stateless): forward arrival → reset + autoplay the pre-click auto step; backward arrival → fully built instantly; leaving → cancel + strip (only the active slide carries runtime state); →/Space/tap play pending click steps before advancing (`deckstep` CustomEvent per step); ←, number keys, Home/End and rail clicks bypass steps; reduced-motion plays instantly but keeps click gating; `noscale` / `?_snthumb=` disable the engine outright.
- `_onAfterPrint` needs **no edit**: it already re-runs `_applyIndex` at the same index, which `_animOnNav` (edit 3.8) treats as "restore fully built without replaying" (`_onBeforePrint` cleared the state in edit 3.5).
- Decks without `[data-anim]` build an empty model and keep a null `_animState` — behaviour is unchanged.

Thirteen edits.

### 3.1 Usage header — feature bullet `(h)`

**Anchor** (end of the `(g)` thumbnail-rail bullet):

```js
 *      structural rail input is locked until the host posts
 *      {__dc_op_ack: true, applied}.
```

**Insert after it**:

```js
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
```

### 3.2 Usage header — rewrite the entrance-animation authoring bullet

**Before** (last bullet of "Authoring guidance"):

```js
 *   - Entrance animations: make the visible end-state the base style and
 *     animate *from* hidden, so print and reduced-motion show content.
 *     Gate the animation on [data-deck-active] and the motion query, e.g.
 *     `@media (prefers-reduced-motion:no-preference){ [data-deck-active] .x{animation:fade-in .5s both} }`.
 *     Avoid infinite decorative loops on slide content.
```

**After**:

```js
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
```

### 3.3 Constants — reduced-motion query, runtime attr, effect table

**Anchor**:

```js
  const INTERACTIVE_SEL = 'a[href], button, input, select, textarea, summary, label, video[controls], audio[controls], [role="button"], [onclick], [tabindex]:not([tabindex^="-"]), [contenteditable]:not([contenteditable="false" i])';
```

**Insert after it** (before the `pad2` helper):

```js
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
```

### 3.4 `connectedCallback` — inject the document-level hidden-state rule

**Anchor**:

```js
      this._render();
      this._loadNotes();
      this._syncPrintPageRule();
```

**Insert after it**:

```js
      this._injectAnimRule();
```

### 3.5 `_onBeforePrint` — cancel + strip before the freeze logic

**Anchor** (first line of the handler body):

```js
      this._onBeforePrint = () => {
        if (this._freezeStyle) this._freezeStyle.remove();
```

**After** (insert the clear between the two lines):

```js
      this._onBeforePrint = () => {
        // data-anim state would print mid-build — cancel + strip first so
        // the sheets show the authored base state (the hidden-attr rule is
        // @media screen scoped, but WAAPI end states are not). afterprint's
        // _applyIndex re-enters at the same index, which _animOnNav treats
        // as "restore fully built without replaying".
        if (this._animState) this._animClear(this._animState.slide);
        if (this._freezeStyle) this._freezeStyle.remove();
```

### 3.6 `attributeChangedCallback` — clear all animation state when `noscale` appears

**Before**:

```js
    attributeChangedCallback() {
      if (this._canvas) {
```

**After** (adds the `name` param — `noscale` is already in `observedAttributes`):

```js
    attributeChangedCallback(name) {
      // noscale is the PPTX exporter's capture context — its DOM snapshot
      // must see the authored base state, so drop every slide's animation
      // state the moment the attribute appears.
      if (name === 'noscale' && this.hasAttribute('noscale')) {
        (this._slides || []).forEach((s) => this._animClear(s));
      }
      if (this._canvas) {
```

### 3.7 `_fit` — store the current scale (fly-distance math)

Two one-line inserts. **Anchor A** (the noscale branch):

```js
      if (this.hasAttribute('noscale')) {
        this._canvas.style.transform = 'none';
```

**Insert after it**:

```js
        this._scale = 1;
```

**Anchor B**:

```js
      const s = Math.min(vw / this.designWidth, vh / this.designHeight);
```

**Insert after it** (before the `transform` write):

```js
      // Fly-distance math needs design-space px; element rects come back
      // viewport-scaled, so _animFlyOffset divides by this.
      this._scale = s;
```

### 3.8 `_applyIndex` — arrival/departure policy hook

**Anchor** (the data-deck-active loop):

```js
      this._slides.forEach((s, i) => {
        if (i === curr) s.setAttribute('data-deck-active', '');
        else s.removeAttribute('data-deck-active');
      });
```

**Insert after it** (before the `_countEl` update):

```js
      // data-anim builds: forward arrival resets + autoplays the auto step,
      // backward arrival lands fully built, same-index re-entry (afterprint,
      // host re-renders) restores built state; the outgoing slide is
      // stripped so only the active slide carries runtime animation state.
      this._animOnNav(prev, curr);
```

### 3.9 `_advance` — click steps gate forward navigation

**Before**:

```js
    /** Step forward/back skipping any slide marked data-deck-skip. Falls
     *  back to _go's clamp-at-ends behaviour (flash overlay) when there's
     *  nothing further in that direction. */
    _advance(dir, reason) {
      if (!this._slides.length) return;
      let i = this._index + dir;
```

**After**:

```js
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
```

### 3.10 `_materialize` — strip runtime attrs from thumbnail clones

**Anchor**:

```js
      let clone = entry.slide.cloneNode(true);
      clone.removeAttribute('id');
      clone.removeAttribute('data-deck-active');
```

**Insert after it**:

```js
      // Runtime anim state stays out of thumbs — double safety, since the
      // hidden-attr rule's deck-stage ancestor combinator can't match
      // inside this nested shadow root anyway.
      this._stripAnimAttrs(clone);
```

### 3.11 `_duplicateSlide` — strip runtime attrs from the copy

**Anchor**:

```js
      const copy = slide.cloneNode(true);
      copy.removeAttribute('id');
      copy.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
```

**Insert after it**:

```js
      this._stripAnimAttrs(copy);
```

### 3.12 Engine block

**Anchor**:

```js
    // Public API ------------------------------------------------------------
```

**Insert before it** (the whole engine — one block):

```js
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
```

### 3.13 Public API — `stepsRemaining` getter

**Anchor**:

```js
    /** Programmatically navigate. */
    goTo(i) { this._go(i, 'api'); }
```

**Insert before it**:

```js
    /** Unplayed click-gated build steps left on the current slide. */
    get stepsRemaining() {
      const st = this._animState;
      return st && st.slide === this._slides[this._index]
        ? Math.max(0, st.steps.length - 1 - st.played) : 0;
    }
```

### Verification

- A deck with `data-anim` elements: forward arrival autoplays the pre-click chain; →/Space/tap play remaining `trigger="click"` steps before the deck advances (each fires a `deckstep` CustomEvent with `{index, step, totalSteps}`); ← leaves immediately; number keys / Home/End / rail clicks jump directly; returning backward shows the slide fully built (entrances visible, exits hidden, emphasis/path at end state).
- `document.head` contains `<style id="deck-stage-anim">` with the `@media screen { deck-stage:not([noscale]) [data-deck-anim-hidden] … }` rule; Cmd+P shows every slide at its authored base state and cancelling print restores the built state without replaying.
- Rail thumbnails never flash during playback (only `data-deck-anim-*` attrs are written — `OWN_ATTRS` filters them) and always render the finished layout.
- With "reduce motion" emulated, arrivals and steps apply instantly but the click gating still consumes →/Space/tap.
- Setting `noscale` (or loading with `?_snthumb=`) shows the pure authored base state — no hidden attrs, no animations.
- A deck with no `[data-anim]`, or one using the old `[data-deck-active]` CSS-animation convention, behaves exactly as before.
- A slide carrying every effect (`appear`/`disappear`, `fade`/`fly`/`wipe`/`float`/`split`/`bounce`/`zoom`/`wheel`/`random-bars` in/out, `spin`/`grow`/`shrink`/`pulse`/`teeter`, `path`) steps through cleanly; wheel/split/random-bars sweep their masks (or fade where `CSS.registerProperty` is unavailable) and leave no inline styles after `_animClear`.
- A `data-anim-repeat="3"` emphasis followed by a `trigger="after"` element delays the follower by 3× the duration (2× more with `data-anim-auto-reverse`), matching the exported PPTX timing.
- `node --check deck-stage.js` passes.
