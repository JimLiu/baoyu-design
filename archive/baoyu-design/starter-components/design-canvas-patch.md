# design-canvas.jsx local patches

`design-canvas.jsx` is wholesale-overwritten whenever Claude Design ships an upgrade. This file records the local patches we layer on top of it, so they can be reapplied after each upgrade.

Per-upgrade flow:
1. Overwrite `design-canvas.jsx` with the new upstream version.
2. Reapply each patch below, locating it by its "anchor" string (so it still works even if upstream shifts line numbers).
3. Confirm it still parses: `node -e "require('../agents/vendor/babel.min.js').transform(require('fs').readFileSync('design-canvas.jsx','utf8'),{presets:['react']})"` (run from this directory).
4. Run `node --test ../agents/tests/project-types.test.mjs` — it asserts the patch markers are present.

---

## Patch 1: gentler mouse-wheel zoom, latched per wheel burst

**Motivation**: upstream zooms by a fixed `Math.exp(0.18)` (≈ ×1.197, ~20%) on every event it classifies as a notched mouse wheel. Two problems:

- **The step is too coarse.** 100% → 200% takes ~4 clicks, so a single flick of the wheel overshoots in either direction and there is no way to land on the size you wanted.
- **Classification is per event.** `isMouseWheel` treats any integer `deltaY ≥ 40` with `deltaX === 0` as a wheel click. A trackpad / Magic Mouse / smooth-scrolling-mouse stream (especially its momentum tail) routinely produces such events in the middle of what is otherwise a pan, and each one fires a full 20% zoom step — so one scroll gesture both pans and blows the canvas up several-fold.

**Approach**: halve the step to 10% per click (`WHEEL_ZOOM_STEP = Math.log(1.1)`), and decide once per burst — on the first plain wheel event after `WHEEL_BURST_MS` (200ms) of quiet — whether the burst may zoom, holding that until the stream goes quiet again. The latch only ever demotes: a burst that opens as a pan stays a pan (so a momentum tail can't zoom), and one that opens as a click still zooms only on click-shaped events (so a large coalesced first event can't turn a following trackpad stream into a zoom). Behaviour is therefore never zoomier than upstream. The window must outlast the finger-lift → momentum gap. ctrl/meta wheels (trackpad pinch, ctrl+wheel) always zoom, sit outside the latch, and reset it so the next plain wheel starts a fresh burst. The pinch formula (`Math.exp(-e.deltaY * 0.01)`, 1:1 with Chrome's synthesized pinch wheel) and the Safari `gesture*` path are unchanged.

Two edits, both inside `DCViewport`'s wheel `useEffect`.

### 1.1 Constants and latch state

**Anchor** (the mouse-wheel heuristic):

```js
    const isMouseWheel = (e) =>
      e.deltaMode !== 0 ||
      (e.deltaX === 0 && Number.isInteger(e.deltaY) && Math.abs(e.deltaY) >= 40);
```

**Insert after it**:

```js
    // Local patch (see design-canvas-patch.md): 10% per wheel click. Upstream's
    // 0.18 log step (≈20%) was too coarse — 100%→200% in ~4 clicks, so one
    // flick overshot in either direction.
    const WHEEL_ZOOM_STEP = Math.log(1.1);
    // Local patch: decide once per wheel burst (the first event after
    // WHEEL_BURST_MS of quiet) whether it may zoom, and hold that until the
    // stream goes quiet. Classifying each event let a trackpad / Magic Mouse
    // momentum tail — integer deltaY ≥ 40 with deltaX 0 — read as a run of
    // wheel clicks, each firing a full zoom step. The latch only ever demotes:
    // a burst that opens as a pan stays a pan, and one that opens as a click
    // still zooms only on click-shaped events. The window must outlast the
    // finger-lift → momentum gap. ctrl/meta wheels always zoom and sit
    // outside the latch.
    const WHEEL_BURST_MS = 200;
    let wheelZooms = false;
    let lastWheelAt = -Infinity;
```

### 1.2 `onWheel` — latch the mode and use the smaller step

**Anchor / before** (the dispatch after the `isGesturing` early return; everything above it — the deck-stage passthrough, `preventDefault`, the `isGesturing` guard — stays as is):

```js
      if (isGesturing) return; // Safari: gesture* owns the pinch — discard concurrent wheels
      if ((e.ctrlKey || e.metaKey) && !isMouseWheel(e)) {
        // trackpad pinch, or ctrl/cmd + smooth-scroll mouse. Notched
        // wheels fall through to the fixed-step branch below.
        zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.01));
      } else if (isMouseWheel(e)) {
        // notched mouse wheel — fixed-ratio step per click
        zoomAt(e.clientX, e.clientY, Math.exp(-Math.sign(e.deltaY) * 0.18));
```

**After**:

```js
      if (isGesturing) return; // Safari: gesture* owns the pinch — discard concurrent wheels
      const mod = e.ctrlKey || e.metaKey;
      if (mod) {
        lastWheelAt = -Infinity; // the next plain wheel starts a fresh burst
      } else {
        const now = performance.now();
        if (now - lastWheelAt > WHEEL_BURST_MS) wheelZooms = isMouseWheel(e);
        lastWheelAt = now;
      }
      if (mod && !isMouseWheel(e)) {
        // trackpad pinch, or ctrl/cmd + smooth-scroll mouse. Notched
        // wheels fall through to the fixed-step branch below.
        zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.01));
      } else if (mod || (wheelZooms && isMouseWheel(e))) {
        // notched mouse wheel — fixed-ratio step per click
        zoomAt(e.clientX, e.clientY, Math.exp(-Math.sign(e.deltaY) * WHEEL_ZOOM_STEP));
```

The trailing `else { /* trackpad two-finger scroll — pan */ … }` branch is unchanged.

### Verification

Dispatch synthetic `WheelEvent`s (bubbling, cancelable) on an artboard and read the world element's `scale(…)`:

| Input | Upstream | Patched |
|---|---|---|
| one `deltaY: -100` click | ×1.197 | ×1.100 |
| one `deltaMode: 1, deltaY: -3` (Firefox lines) | ×1.197 | ×1.100 |
| 10 rapid `-100` clicks | ×6.05 | ×2.59 |
| `-2.5`, then 8 × `-60` at 16ms (trackpad-like stream) | ×4.22 and pans | ×1.00, pans only |
| `-60`, then 30 × `-3` at 16ms (large coalesced first event) | ×1.197, then pans | ×1.100, then pans |
| `-60` after >200ms of quiet | ×1.197 | ×1.100 |
| `ctrlKey, deltaY: 3` (pinch) | ×0.9704 | ×0.9704 |
| `ctrlKey, deltaY: 100` (ctrl + notched wheel) | ×0.835 | ×0.909 |
