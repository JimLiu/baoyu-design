/* BEGIN USAGE */
// watercolor-kit.js — the code-painted watercolor engine as a page component.
//
// THE MODEL: a painting is a deterministic JavaScript function that lays washes,
// ink, splatter, and a caption onto a paper object (the same kit the
// paint_watercolor tool runs — same API, same pigments, same seeded randomness,
// so the same function always produces the same picture). This file adds two
// page-side ways to SHOW a painting being painted:
//
// 1. <watercolor-kit> — a custom element that paints live, stroke by stroke:
//
//      <script src="./watercolor-kit.js"></script>
//      <watercolor-kit id="fox" width="900" height="1200" duration="14" controls></watercolor-kit>
//      <script>
//        document.getElementById('fox').painting = function (p) {
//          p.wash(['blob', 450, 520, 240, 210, {wobble: 0.25, seed: 2}], 'aqua',
//                 {load: 0.5, deckle: 7, feather: 2.5, edgePool: 1.2, edgeWidth: 6, seed: 5});
//          // ... more washes / reserve / ink / splatter ...
//          p.caption('a small watercolour fox');
//        };
//      </script>
//
//    Assigning .painting starts an autoplay reveal (washes bloom in, ink draws
//    tip to tail, in painting order). Attributes: width/height (logical sheet
//    units; the canvas renders at device resolution), seed (paper grain),
//    duration (seconds,
//    default 12), autoplay (default on; set autoplay="false" to wait), loop,
//    controls (a small replay button). Methods: el.play(), el.pause(),
//    el.seek(u) with u in 0..1; el.progress reads the current position;
//    'watercolor-done' fires when the reveal completes.
//
// 2. window.WatercolorKit — the raw engine for custom uses:
//      WatercolorKit.paper(W, H, opts)  — the full painting API (wash, gradedWash,
//        glaze, reserve, ink, hatch, splatter, dryStroke, caption, render; plus
//        ops / seek(u) / renderUpTo(i, t) / resetSheet for progressive replay).
//      WatercolorKit.frame(paintFn, {width, height, scale, seed, at, type,
//        quality}) — paints paintFn at progress 'at' (0..1) and returns an image
//        data URL (PNG unless type/quality say otherwise); a backward jump
//        re-paints from the clean sheet, so random scrubbing is costly.
//      WatercolorKit.bake(paintFn, {width, height, scale, seed, steps, type,
//        quality}, onFrame) — resolves to steps+1 compressed image data URLs
//        (JPEG by default), painting progressively and yielding between frames
//        so the page stays responsive; bake ONCE, then swap images per frame —
//        this is how smooth, scrubbable, exportable reveals are driven.
//      WatercolorKit.layers(paintFn, {width, height, scale, seed, quality}) — takes the
//        painting apart into its strokes: one layer per paint call, in
//        painting order. Returns {count, paper, width, height, kind(i),
//        box(i), src(i, t), span(i)}: paper is the bare sheet's image;
//        src(i, t) is stroke i's own image at its painting progress t in 0..1
//        (an ink line draws tip to tail, a wash blooms in; t omitted = the
//        finished stroke), cached per call; box(i) is where that image
//        sits on the sheet as {x, y, w, h} fractions of width/height; kind(i)
//        is the paint call ('wash', 'ink', 'reserve', ...); span(i) is the
//        stroke's {from, to} share of the painting's 0..1 timeline (washes
//        take longer than ink lines); warm() pre-renders every FINISHED
//        stroke in the background (yielding between strokes) and resolves
//        when done — call it once after load; a stroke's partial-progress
//        images render on use, so a play-through of a wide wash can drop
//        frames (finished strokes stay cached; only a bounded handful of
//        recent partial frames do, so scrubbing back into mid-stroke may
//        re-render — export just waits per frame and is unaffected). Stack
//        the images over the paper with
//        CSS mix-blend-mode: multiply (paint multiplies) — except 'reserve'
//        layers (lifted paper), which blend normally — and the stack equals
//        the flat render (within encode noise at the default quality;
//        quality: 1 tightens that to within 8-bit rounding), so each
//        stroke can be placed, timed and moved as its own element.
//    In an animations_v3 composition, use the WatercolorPainting component
//    (strokes assembled as scene layers) or WatercolorReveal (a flat baked
//    image) from the Animated video skill rather than calling these directly
//    — they render elements as a pure function of the timeline, which is
//    what the video exporter serializes.
//
// The painting function must not redeclare OUTPUT_PATH, paper, or the kit's
// helper names, and it runs synchronously (no await inside).
/* END USAGE */

(function () {
  'use strict';

  function createCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }




var WC_PIGMENTS = {
  ultramarine: [0.30, 0.36, 0.78], cobalt: [0.34, 0.48, 0.80], cerulean: [0.38, 0.62, 0.82],
  indigo: [0.20, 0.24, 0.42], navy: [0.26, 0.30, 0.48], night: [0.14, 0.16, 0.30],
  burnt_sienna: [0.72, 0.42, 0.24], sienna: [0.72, 0.42, 0.24], raw_umber: [0.52, 0.42, 0.32],
  umber: [0.45, 0.36, 0.28], yellow_ochre: [0.90, 0.74, 0.36], ochre: [0.90, 0.74, 0.36],
  quin_rose: [0.86, 0.36, 0.55], quin_gold: [0.93, 0.72, 0.30], perylene_green: [0.30, 0.42, 0.32],
  sap_green: [0.55, 0.70, 0.30], olive: [0.58, 0.66, 0.36], neutral_tint: [0.42, 0.40, 0.46],
  paynes_grey: [0.36, 0.40, 0.48], grey: [0.62, 0.62, 0.64], sepia: [0.45, 0.36, 0.28],
  ink: [0.30, 0.27, 0.28], pencil: [0.45, 0.43, 0.43],
  aqua: [0.66, 0.81, 0.85], mint: [0.74, 0.87, 0.76], sage: [0.74, 0.84, 0.70], butter: [0.97, 0.89, 0.64],
  straw: [0.94, 0.86, 0.64], rose: [0.93, 0.74, 0.76], dusty_rose: [0.92, 0.74, 0.74],
  lavender: [0.78, 0.74, 0.88], sky: [0.66, 0.78, 0.90], teal: [0.45, 0.70, 0.74],
  tan: [0.80, 0.64, 0.46], fawn: [0.86, 0.72, 0.55], rust: [0.80, 0.46, 0.28],
  salmon: [0.93, 0.55, 0.45], cream: [0.96, 0.94, 0.88], moss: [0.52, 0.62, 0.40],
  shadow_violet: [0.60, 0.55, 0.74], warm_dark: [0.30, 0.24, 0.22]
};

function wcRng(seed) {
  var a = (seed | 0) + 0x9E3779B9;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function wcColor(c) {
  if (typeof c === "string") {
    if (c.charAt(0) === "#") {
      var h = c.length === 4 ? c.slice(1).split("").map(function (x) { return x + x; }).join("") : c.slice(1);
      return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
    }
    var p = WC_PIGMENTS[c];
    if (!p) throw new Error("unknown pigment: " + c);
    return p;
  }
  return c;
}

function wcValueNoise(w, h, scale, rng) {
  var gw = Math.floor(w / scale) + 3, gh = Math.floor(h / scale) + 3;
  var g = new Float32Array(gw * gh);
  for (var i = 0; i < g.length; i++) g[i] = rng();
  var out = new Float32Array(w * h);
  for (var y = 0; y < h; y++) {
    var gy = y / scale, y0 = Math.floor(gy), fy = gy - y0;
    var sy = fy * fy * (3 - 2 * fy);
    var r0 = y0 * gw, r1 = (y0 + 1) * gw;
    for (var x = 0; x < w; x++) {
      var gx = x / scale, x0 = Math.floor(gx), fx = gx - x0;
      var sx = fx * fx * (3 - 2 * fx);
      var a = g[r0 + x0], b = g[r0 + x0 + 1], c2 = g[r1 + x0], d = g[r1 + x0 + 1];
      var top = a + (b - a) * sx, bot = c2 + (d - c2) * sx;
      out[y * w + x] = top + (bot - top) * sy;
    }
  }
  return out;
}

function wcFbm(w, h, scale, octaves, seed) {
  var acc = new Float32Array(w * h);
  var amp = 1, s = scale, total = 0;
  for (var i = 0; i < octaves; i++) {
    var n = wcValueNoise(w, h, Math.max(s, 1), wcRng(seed * 131 + i * 7 + 1));
    for (var k = 0; k < acc.length; k++) acc[k] += amp * n[k];
    total += amp; amp *= 0.5; s /= 2;
  }
  var lo = Infinity, hi = -Infinity;
  for (var k = 0; k < acc.length; k++) { acc[k] /= total; if (acc[k] < lo) lo = acc[k]; if (acc[k] > hi) hi = acc[k]; }
  var span = hi - lo || 1;
  for (var k = 0; k < acc.length; k++) acc[k] = (acc[k] - lo) / span;
  return acc;
}

function wcEdt1d(f, n, out, v, z) {
  var k = 0;
  v[0] = 0; z[0] = -1e20; z[1] = 1e20;
  for (var q = 1; q < n; q++) {
    var s;
    while (true) {
      var p = v[k];
      s = ((f[q] + q * q) - (f[p] + p * p)) / (2 * q - 2 * p);
      if (s <= z[k] && k > 0) k--; else break;
    }
    k++; v[k] = q; z[k] = s; z[k + 1] = 1e20;
  }
  k = 0;
  for (var q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    var p2 = v[k];
    out[q] = (q - p2) * (q - p2) + f[p2];
  }
}

function wcEdt(bin, w, h, invert) {
  var INF = 1e12;
  var grid = new Float64Array(w * h);
  for (var i = 0; i < w * h; i++) grid[i] = (invert ? bin[i] : !bin[i]) ? 0 : INF;
  var n = Math.max(w, h);
  var f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n + 1), z = new Float64Array(n + 2);
  for (var x = 0; x < w; x++) {
    for (var y = 0; y < h; y++) f[y] = grid[y * w + x];
    wcEdt1d(f, h, d, v, z);
    for (var y = 0; y < h; y++) grid[y * w + x] = d[y];
  }
  for (var y = 0; y < h; y++) {
    var row = y * w;
    for (var x = 0; x < w; x++) f[x] = grid[row + x];
    wcEdt1d(f, w, d, v, z);
    for (var x = 0; x < w; x++) grid[row + x] = d[x];
  }
  var out = new Float32Array(w * h);
  for (var i = 0; i < w * h; i++) out[i] = Math.sqrt(Math.min(grid[i], 1e10));
  return out;
}

function wcBoxBlur(src, w, h, r, passes) {
  r = Math.min(r, w - 1, h - 1);
  var a = src, b = new Float32Array(w * h);
  for (var p = 0; p < passes; p++) {
    for (var y = 0; y < h; y++) {
      var row = y * w, sum = 0, cnt = 0;
      for (var x = -r; x <= r; x++) if (x >= 0) { sum += a[row + x]; cnt++; }
      for (var x = 0; x < w; x++) {
        b[row + x] = sum / cnt;
        var add = x + r + 1, rem = x - r;
        if (add < w) { sum += a[row + add]; cnt++; }
        if (rem >= 0) { sum -= a[row + rem]; cnt--; }
      }
    }
    var c = new Float32Array(w * h);
    for (var x = 0; x < w; x++) {
      var sum = 0, cnt = 0;
      for (var y = -r; y <= r; y++) if (y >= 0) { sum += b[y * w + x]; cnt++; }
      for (var y = 0; y < h; y++) {
        c[y * w + x] = sum / cnt;
        var add = y + r + 1, rem = y - r;
        if (add < h) { sum += b[add * w + x]; cnt++; }
        if (rem >= 0) { sum -= b[rem * w + x]; cnt--; }
      }
    }
    a = c;
  }
  return a;
}

function paper(W, H, opts) {
  opts = opts || {};
  W = Math.round(W);
  H = Math.round(H);
  var ops = [];
  var defer = !!opts.defer;
  var opT0 = 0, opT1 = 1;
  var curOp = null;
  if (!(W > 0) || !(H > 0) || W * H > 12000000)
    throw new Error("paper: " + W + "x" + H + " is out of range - preview around 600x800, final around 1800x2400");
  var seed = opts.seed == null ? 7 : opts.seed;
  var S = opts.scale == null ? 1 : opts.scale;
  var rng = wcRng(seed);
  var N = W * H;
  var CREAM = opts.cream || [0.968, 0.952, 0.905];
  var buf = new Float32Array(N * 3);
  var canvasEl = createCanvas(W, H);
  var ctx = canvasEl.getContext("2d", { willReadFrequently: true });
  var mcan = createCanvas(W, H);
  var mctx = mcan.getContext("2d", { willReadFrequently: true });
  var PAD = 192;
  var mottleField = null, deckleField = null, fieldW = W + PAD, fieldH = H + PAD;

  var fine = new Float32Array(N);
  for (var i = 0; i < N; i++) fine[i] = rng();
  fine = wcBoxBlur(fine, W, H, 1, 2);
  var mid = wcFbm(W, H, 6 * S, 3, seed + 11);
  var big = wcFbm(W, H, 90 * S, 3, seed + 23);
  var tooth = new Float32Array(N);
  var lo = Infinity, hi = -Infinity;
  for (var i = 0; i < N; i++) { var t = 0.34 * fine[i] + 0.46 * mid[i] + 0.20 * big[i]; tooth[i] = t; if (t < lo) lo = t; if (t > hi) hi = t; }
  for (var i = 0; i < N; i++) tooth[i] = (tooth[i] - lo) / (hi - lo + 1e-6);
  var warm = wcFbm(W, H, 200 * S, 2, seed + 99);
  var grain = opts.grain == null ? 1.0 : opts.grain;
  for (var i = 0; i < N; i++) {
    var sh = 1 + 0.03 * grain * (tooth[i] - 0.5);
    var w2 = warm[i] - 0.5;
    buf[i * 3] = Math.min(1, (CREAM[0] + 0.010 * w2) * sh);
    buf[i * 3 + 1] = Math.min(1, CREAM[1] * sh);
    buf[i * 3 + 2] = Math.min(1, (CREAM[2] - 0.014 * w2) * sh);
  }
  var pristine = buf.slice();
  var granTooth = wcBoxBlur(tooth, W, H, 1, 1);

  function ensureFields() {
    if (!mottleField) {
      var mf1 = wcFbm(fieldW, fieldH, 110 * S, 3, seed + 501), mf2 = wcFbm(fieldW, fieldH, 45 * S, 3, seed + 603);
      mottleField = new Float32Array(fieldW * fieldH);
      for (var i = 0; i < mottleField.length; i++) mottleField[i] = 0.65 * mf1[i] + 0.35 * mf2[i];
      deckleField = wcFbm(fieldW, fieldH, 40 * S, 4, seed + 777);
    }
  }

  function buildPath(c, shape) {
    c.beginPath();
    addShape(c, shape);
  }

  function addShape(c, shape) {
    var kind = shape[0];
    if (kind === "union") { for (var u = 0; u < shape[1].length; u++) addShape(c, shape[1][u]); return; }
    if (kind === "ellipse") {
      c.moveTo(shape[1] + shape[3] * Math.cos((shape[5] || 0) * Math.PI / 180), shape[2] + shape[3] * Math.sin((shape[5] || 0) * Math.PI / 180));
      c.ellipse(shape[1], shape[2], shape[3], shape[4] == null ? shape[3] : shape[4], (shape[5] || 0) * Math.PI / 180, 0, Math.PI * 2);
    } else if (kind === "rect") {
      c.rect(shape[1], shape[2], shape[3], shape[4]);
    } else if (kind === "poly") {
      var pts = shape[1];
      c.moveTo(pts[0][0], pts[0][1]);
      for (var i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
      c.closePath();
    } else if (kind === "blob") {
      var cx = shape[1], cy = shape[2], rx = shape[3], ry = shape[4] == null ? shape[3] : shape[4];
      var o = shape[5] || {};
      var wob = o.wobble == null ? 0.18 : o.wobble;
      var brng = wcRng((o.seed == null ? 1 : o.seed) + 913);
      var harm = [];
      for (var k = 2; k <= 5; k++) harm.push([k, (brng() * 2 - 1) * wob / k, brng() * Math.PI * 2]);
      var rot = (o.rot || 0) * Math.PI / 180, cr = Math.cos(rot), sr = Math.sin(rot);
      var nPts = 90, pts2 = [];
      for (var i = 0; i < nPts; i++) {
        var th = i / nPts * Math.PI * 2, r = 1;
        for (var j = 0; j < harm.length; j++) r += harm[j][1] * Math.cos(harm[j][0] * th + harm[j][2]);
        var ex = rx * r * Math.cos(th), ey = ry * r * Math.sin(th);
        pts2.push([cx + ex * cr - ey * sr, cy + ex * sr + ey * cr]);
      }
      c.moveTo(pts2[0][0], pts2[0][1]);
      for (var i = 1; i <= nPts; i++) {
        var p0 = pts2[(i - 1) % nPts], p1 = pts2[i % nPts], p2 = pts2[(i + 1) % nPts];
        c.quadraticCurveTo(p1[0], p1[1], (p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2);
      }
      c.closePath();
    } else if (kind === "path") {
      shape[1](c);
    } else {
      throw new Error("unknown shape kind: " + kind);
    }
  }

  function rasterize(shape) {
    mctx.globalCompositeOperation = "source-over";
    mctx.fillStyle = "#000"; mctx.fillRect(0, 0, W, H);
    mctx.fillStyle = "#fff"; mctx.strokeStyle = "#fff";
    mctx.setTransform(S, 0, 0, S, 0, 0);
    buildPath(mctx, shape);
    mctx.fill();
    mctx.setTransform(1, 0, 0, 1, 0, 0);
    var img = mctx.getImageData(0, 0, W, H).data;
    var mask = new Float32Array(N);
    var x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (var i = 0; i < N; i++) {
      var v = img[i * 4] / 255;
      mask[i] = v;
      if (v > 0.002) {
        var x = i % W, y = (i - x) / W;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
    if (x1 < 0) return null;
    return { mask: mask, x0: x0, y0: y0, x1: x1, y1: y1 };
  }

  var opScaleOff = false;
  function glazeField(D, box, color) {
    var f = opScaleOff ? 1 : opT1 - opT0;
    var col = wcColor(color);
    var lr = Math.log(Math.max(col[0], 1e-3)), lg = Math.log(Math.max(col[1], 1e-3)), lb = Math.log(Math.max(col[2], 1e-3));
    for (var y = box.y0; y <= box.y1; y++) {
      for (var x = box.x0; x <= box.x1; x++) {
        var d = D[(y - box.y0) * box.w + (x - box.x0)] * f;
        if (d <= 0) continue;
        var i = (y * W + x) * 3;
        buf[i] *= Math.exp(lr * d); buf[i + 1] *= Math.exp(lg * d); buf[i + 2] *= Math.exp(lb * d);
      }
    }
    touch(box.x0, box.y0, box.x1, box.y1);
  }

  var touched = null, resAlpha = null;
  function touch(x0, y0, x1, y1) {
    if (!touched) touched = { x0: x0, y0: y0, x1: x1, y1: y1 };
    else {
      if (x0 < touched.x0) touched.x0 = x0;
      if (y0 < touched.y0) touched.y0 = y0;
      if (x1 > touched.x1) touched.x1 = x1;
      if (y1 > touched.y1) touched.y1 = y1;
    }
  }

  function densityField(r, o) {
    ensureFields();
    var pad = Math.ceil(((o.deckle || 0) * 3 + (o.feather || 0) * 3 + 8) * S);
    var x0 = Math.max(0, r.x0 - pad), y0 = Math.max(0, r.y0 - pad);
    var x1 = Math.min(W - 1, r.x1 + pad), y1 = Math.min(H - 1, r.y1 + pad);
    var bw = x1 - x0 + 1, bh = y1 - y0 + 1, bn = bw * bh;
    var bin = new Uint8Array(bn);
    for (var y = 0; y < bh; y++) for (var x = 0; x < bw; x++) bin[y * bw + x] = r.mask[(y + y0) * W + (x + x0)] > 0.5 ? 1 : 0;
    var srng = wcRng(o.seed || 0);
    var ox = Math.floor(srng() * PAD), oy = Math.floor(srng() * PAD);
    var deckle = (o.deckle == null ? 3 : o.deckle) * S;
    if (deckle > 0) {
      var din0 = wcEdt(bin, bw, bh, false), dout0 = wcEdt(bin, bw, bh, true);
      for (var y = 0; y < bh; y++) for (var x = 0; x < bw; x++) {
        var k = y * bw + x;
        var nz = deckleField[(y + y0 + oy) * fieldW + (x + x0 + ox)] - 0.5;
        bin[k] = (din0[k] - dout0[k] + nz * 2 * deckle) > 0 ? 1 : 0;
      }
    }
    var din = wcEdt(bin, bw, bh, false), dout = wcEdt(bin, bw, bh, true);
    var feather = (o.feather == null ? 1.5 : o.feather) * S;
    var load = o.load == null ? 1 : o.load;
    var edgePool = o.edgePool == null ? 0.9 : o.edgePool;
    var edgeWidth = (o.edgeWidth == null ? 4 : o.edgeWidth) * S;
    var granulation = o.granulation == null ? 0.18 : o.granulation;
    var mottle = o.mottle == null ? 0.35 : o.mottle;
    var D = new Float32Array(bn);
    for (var y = 0; y < bh; y++) for (var x = 0; x < bw; x++) {
      var k = y * bw + x;
      var sd = din[k] - dout[k];
      var inside = sd >= feather ? 1 : (sd <= -feather ? 0 : 0.5 + 0.5 * (sd / feather) * (1.5 - 0.5 * (sd / feather) * (sd / feather)));
      if (inside <= 0) continue;
      var dv = load;
      var gi = (y + y0) * W + (x + x0);
      if (edgePool > 0) dv += load * edgePool * Math.exp(-din[k] / edgeWidth) * (0.35 + 1.3 * mottleField[(y + y0 + oy) * fieldW + (x + x0 + ox)]);
      if (granulation > 0) dv *= 1 + granulation * (0.5 - granTooth[gi]) * 2;
      if (mottle > 0) dv *= 1 + mottle * 1.4 * (mottleField[(y + y0 + oy) * fieldW + (x + x0 + ox)] - 0.5);
      D[k] = Math.max(0, dv) * inside;
    }
    if (o.blooms) {
      for (var b = 0; b < o.blooms.length; b++) {
        var bl = o.blooms[b], bcx = bl[0] * S - x0, bcy = bl[1] * S - y0, br = bl[2] * S;
        for (var y = 0; y < bh; y++) for (var x = 0; x < bw; x++) {
          var k = y * bw + x;
          if (D[k] <= 0) continue;
          var dd = Math.sqrt((x - bcx) * (x - bcx) + (y - bcy) * (y - bcy));
          dd += (deckleField[((y + y0 + oy * 3) % fieldH) * fieldW + ((x + x0 + ox * 5) % fieldW)] - 0.5) * br * 0.55;
          var core = Math.max(0, Math.min(1, 1 - dd / br));
          var ring = Math.exp(-((dd - br) * (dd - br)) / (2 * (br * 0.10) * (br * 0.10)));
          D[k] = D[k] * (1 - 0.75 * core) + load * 0.9 * ring;
        }
      }
    }
    if (o.weight) {
      for (var y = 0; y < bh; y++) for (var x = 0; x < bw; x++) D[y * bw + x] *= o.weight((x + x0) / S, (y + y0) / S);
    }
    return { D: D, x0: x0, y0: y0, x1: x1, y1: y1, w: bw, h: bh };
  }

  function washP(shape, color, o) {
    o = o || {};
    var r = rasterize(shape);
    if (!r) return P;
    var f = densityField(r, o);
    glazeField(f.D, f, color);
    return P;
  }

  function rampLines(stops, n, gamma) {
    var ts = stops.map(function (s) { return s[0]; });
    var cs = stops.map(function (s) { var c = wcColor(s[1]); return [Math.pow(c[0], 1 / gamma), Math.pow(c[1], 1 / gamma), Math.pow(c[2], 1 / gamma)]; });
    var out = [];
    for (var i = 0; i < n; i++) {
      var t = n > 1 ? i / (n - 1) : 0;
      var j = 0;
      while (j < ts.length - 2 && t > ts[j + 1]) j++;
      var u = ts[j + 1] > ts[j] ? Math.max(0, Math.min(1, (t - ts[j]) / (ts[j + 1] - ts[j]))) : 0;
      var rr = [];
      for (var c = 0; c < 3; c++) rr.push(Math.pow(cs[j][c] + (cs[j + 1][c] - cs[j][c]) * u, gamma));
      out.push([Math.log(Math.max(rr[0], 1e-3)), Math.log(Math.max(rr[1], 1e-3)), Math.log(Math.max(rr[2], 1e-3))]);
    }
    return out;
  }

  function profileValue(profile, t) {
    if (!profile) return 1;
    var j = 0;
    while (j < profile.length - 2 && t > profile[j + 1][0]) j++;
    var a = profile[j], b = profile[j + 1];
    var u = b[0] > a[0] ? Math.max(0, Math.min(1, (t - a[0]) / (b[0] - a[0]))) : 0;
    return a[1] + (b[1] - a[1]) * u;
  }

  function rampWash(shape, stops, o) {
    o = o || {};
    var r = rasterize(shape);
    if (!r) return P;
    var f = densityField(r, o);
    var axis = o.axis || "y";
    var n = axis === "y" ? f.h : f.w;
    var lines = rampLines(stops, n, o.gamma || 1.9);
    for (var y = f.y0; y <= f.y1; y++) for (var x = f.x0; x <= f.x1; x++) {
      var d = f.D[(y - f.y0) * f.w + (x - f.x0)];
      if (d <= 0) continue;
      var li = axis === "y" ? (y - f.y0) : (x - f.x0);
      var t = li / Math.max(n - 1, 1);
      d *= profileValue(o.profile, t) * (opT1 - opT0);
      var L = lines[li];
      var i = (y * W + x) * 3;
      buf[i] *= Math.exp(L[0] * d); buf[i + 1] *= Math.exp(L[1] * d); buf[i + 2] *= Math.exp(L[2] * d);
    }
    touch(f.x0, f.y0, f.x1, f.y1);
    return P;
  }

  function gradedWashP(shape, colorA, colorB, o) {
    if (Array.isArray(colorA) && Array.isArray(colorA[0])) return rampWash(shape, colorA, colorB || {});
    o = o || {};
    var r = rasterize(shape);
    if (!r) return P;
    var f = densityField(r, o);
    var axis = o.axis || "y";
    var front = o.front == null ? 0.5 : o.front, soft = o.soft == null ? 0.18 : o.soft;
    var span = axis === "y" ? (f.y1 - f.y0) : (f.x1 - f.x0);
    var nz = wcFbm(f.w, f.h, 45, 4, (o.seed || 0) + 17);
    var Da = new Float32Array(f.w * f.h), Db = new Float32Array(f.w * f.h);
    for (var y = 0; y < f.h; y++) for (var x = 0; x < f.w; x++) {
      var k = y * f.w + x;
      var t = (axis === "y" ? y : x) / Math.max(span, 1);
      var ff = 1 / (1 + Math.exp(-((t - front) + 0.3 * (nz[k] - 0.5)) / soft));
      Da[k] = f.D[k] * (1 - ff); Db[k] = f.D[k] * ff;
    }
    glazeField(Da, f, colorA);
    glazeField(Db, f, colorB);
    return P;
  }

  function glazeP(shape, color, o) {
    o = o || {};
    var merged = { load: o.load == null ? 0.4 : o.load, edgePool: 0, deckle: o.deckle == null ? 1 : o.deckle, feather: o.feather == null ? 3 : o.feather, granulation: o.granulation == null ? 0.2 : o.granulation, mottle: o.mottle == null ? 0.15 : o.mottle, seed: o.seed };
    return washP(shape, color, merged);
  }

  function resamplePath(pts, step) {
    var out = [pts[0]];
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i];
      var dx = b[0] - a[0], dy = b[1] - a[1];
      var len = Math.sqrt(dx * dx + dy * dy);
      var n = Math.max(1, Math.round(len / step));
      for (var j = 1; j <= n; j++) out.push([a[0] + dx * j / n, a[1] + dy * j / n]);
    }
    return out;
  }

  function inkP(paths, o) {
    o = o || {};
    if (!paths.length) return P;
    if (typeof paths[0][0] === "number") paths = [paths];
    paths = paths.filter(function (pp) { return pp.length > 1; });
    if (!paths.length) return P;
    paths = paths.map(function (pp) { return pp.map(function (q) { return [q[0] * S, q[1] * S]; }); });
    var irng = wcRng(o.seed == null ? 31 : o.seed);
    var width = (o.width == null ? 1.6 : o.width) * S;
    var wobble = (o.wobble == null ? 0.9 : o.wobble) * S;
    var lost = o.lost == null ? 0.3 : o.lost;
    var load = o.load == null ? 1.3 : o.load;
    var taper = o.taper == null ? 0.35 : o.taper;
    mctx.globalCompositeOperation = "source-over";
    mctx.fillStyle = "#000"; mctx.fillRect(0, 0, W, H);
    mctx.globalCompositeOperation = "lighten";
    mctx.lineCap = "round";
    var x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (var pi = 0; pi < paths.length; pi++) {
      var pts = resamplePath(paths[pi], 3 * S);
      var n = pts.length;
      var total = 0;
      for (var i = 1; i < n; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      var arcHi = opT1 * total, arcAt = 0;
      var ph1 = irng() * 6.28, ph2 = irng() * 6.28, ph3 = irng() * 6.28, f1 = 0.9 + irng() * 1.6;
      var disp = [];
      var acc = 0;
      for (var i = 0; i < n; i++) {
        if (i > 0) acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        var u = acc / Math.max(total, 1e-6);
        var dn = wobble * (0.7 * Math.sin(u * total / (22 * S) * f1 + ph1) + 0.5 * Math.sin(u * total / (9 * S) + ph2));
        var vis = 0.5 + 0.5 * Math.sin(u * (2 + total / (140 * S)) * Math.PI + ph3) + 0.25 * Math.sin(u * 7 + ph2);
        var alpha = Math.max(0, Math.min(1, (vis + 0.15 - lost) / 0.3));
        var tap = Math.min(1, Math.min(acc, total - acc) / Math.max(total * taper * 0.5, 1e-6) + 0.25);
        var a0 = i > 0 ? Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]) : Math.atan2(pts[1][1] - pts[0][1], pts[1][0] - pts[0][0]);
        disp.push([pts[i][0] + Math.cos(a0 + Math.PI / 2) * dn, pts[i][1] + Math.sin(a0 + Math.PI / 2) * dn, alpha, tap]);
      }
      for (var i = 1; i < n; i++) {
        var A = disp[i - 1], B = disp[i];
        var segLen = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        var mid = arcAt + segLen / 2;
        arcAt += segLen;
        if (opT1 < 1 && mid >= arcHi) continue;
        var al = (A[2] + B[2]) / 2;
        if (al < 0.04) continue;
        var ww = width * ((A[3] + B[3]) / 2);
        var g = Math.round(80 + 175 * al);
        mctx.strokeStyle = "rgb(" + g + "," + g + "," + g + ")";
        mctx.lineWidth = Math.max(0.6, ww);
        mctx.beginPath(); mctx.moveTo(A[0], A[1]); mctx.lineTo(B[0], B[1]); mctx.stroke();
      }
      for (var i = 0; i < n; i++) {
        if (disp[i][0] < x0) x0 = disp[i][0]; if (disp[i][0] > x1) x1 = disp[i][0];
        if (disp[i][1] < y0) y0 = disp[i][1]; if (disp[i][1] > y1) y1 = disp[i][1];
      }
    }
    mctx.globalCompositeOperation = "source-over";
    var padw = Math.ceil(width * 2 + wobble + 3);
    x0 = Math.max(0, Math.floor(x0) - padw); y0 = Math.max(0, Math.floor(y0) - padw);
    x1 = Math.min(W - 1, Math.ceil(x1) + padw); y1 = Math.min(H - 1, Math.ceil(y1) + padw);
    if (x1 < x0 || y1 < y0) return P;
    var bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    var img = mctx.getImageData(x0, y0, bw, bh).data;
    var D = new Float32Array(bw * bh);
    var grain = o.grain == null ? 0.5 : o.grain;
    for (var y = 0; y < bh; y++) for (var x = 0; x < bw; x++) {
      var v = img[(y * bw + x) * 4] / 255;
      if (v <= 0) continue;
      var tt = tooth[(y + y0) * W + (x + x0)];
      D[y * bw + x] = v * load * (1 - grain + grain * 1.6 * tt);
    }
    if (curOp && (opT0 > 0 || opT1 < 1)) {
      var prev = curOp.inkD;
      var Dnew = D.slice();
      if (prev) for (var k2 = 0; k2 < D.length; k2++) D[k2] = Math.max(0, D[k2] - prev[k2]);
      if (opT1 < 1) curOp.inkD = Dnew;
    }
    opScaleOff = true;
    try {
      glazeField(D, { x0: x0, y0: y0, x1: x1, y1: y1, w: bw, h: bh }, o.color || "ink");
    } finally {
      opScaleOff = false;
    }
    return P;
  }

  function hatchP(shape, o) {
    o = o || {};
    var ang = (o.angle == null ? -55 : o.angle) * Math.PI / 180;
    var spacing = Math.max(0.25, o.spacing == null ? 7 : o.spacing);
    var hrng = wcRng(o.seed == null ? 5 : o.seed);
    var r = rasterize(shape);
    if (!r) return P;
    var cx = (r.x0 + r.x1) / 2 / S, cy = (r.y0 + r.y1) / 2 / S;
    var reach = Math.hypot(r.x1 - r.x0, r.y1 - r.y0) / 2 / S + 4;
    var dx = Math.cos(ang), dy = Math.sin(ang);
    var lines = [];
    for (var t = -reach; t <= reach; t += spacing * (0.8 + hrng() * 0.5)) {
      var px = cx - dy * t, py = cy + dx * t;
      var a = [px - dx * reach + hrng() * 3, py - dy * reach], b = [px + dx * reach, py + dy * reach + hrng() * 3];
      lines.push(clipSegment(a, b, r.mask));
    }
    lines = lines.filter(function (l) { return l; });
    return inkP(lines, { width: o.width == null ? 1.1 : o.width, color: o.color || "ink", wobble: o.wobble == null ? 0.5 : o.wobble, lost: o.lost == null ? 0.25 : o.lost, load: o.load == null ? 1.0 : o.load, seed: (o.seed || 5) + 3 });
  }

  function clipSegment(a, b, mask) {
    var steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2);
    var start = null, end = null;
    for (var i = 0; i <= steps; i++) {
      var x = a[0] + (b[0] - a[0]) * i / steps, y = a[1] + (b[1] - a[1]) * i / steps;
      var xi = Math.round(x * S), yi = Math.round(y * S);
      var inS = xi >= 0 && yi >= 0 && xi < W && yi < H && mask[yi * W + xi] > 0.5;
      if (inS && !start) start = [x, y];
      if (inS) end = [x, y];
      if (!inS && start) break;
    }
    if (!start || !end || Math.hypot(end[0] - start[0], end[1] - start[1]) < 6) return null;
    return [start, end];
  }

  function splatterP(cx, cy, radius, color, o) {
    o = o || {};
    var srng = wcRng(o.seed == null ? 11 : o.seed);
    var n = o.n == null ? 30 : o.n;
    var size = o.size || [1.2, 4.5];
    var drops = [];
    for (var i = 0; i < n; i++) {
      var a = srng() * Math.PI * 2, rr = radius * Math.sqrt(srng());
      drops.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a), size[0] + (size[1] - size[0]) * srng()]);
    }
    var shape = ["path", function (c) { for (var i = 0; i < drops.length; i++) { c.moveTo(drops[i][0] + drops[i][2], drops[i][1]); c.arc(drops[i][0], drops[i][1], drops[i][2], 0, Math.PI * 2); } }];
    return washP(shape, color, { load: o.load == null ? 1.2 : o.load, edgePool: 0.9, edgeWidth: 1.2, granulation: 0.3, mottle: 0.2, deckle: 0, feather: 0.7, seed: (o.seed || 11) + 1 });
  }

  function dryStrokeP(pts, color, o) {
    o = o || {};
    pts = pts.map(function (q) { return [q[0] * S, q[1] * S]; });
    var width = (o.width == null ? 6 : o.width) * S;
    var load = o.load == null ? 1.1 : o.load;
    var bias = o.toothBias == null ? 0.6 : o.toothBias;
    mctx.globalCompositeOperation = "source-over";
    mctx.fillStyle = "#000"; mctx.fillRect(0, 0, W, H);
    mctx.strokeStyle = "#fff"; mctx.lineWidth = width; mctx.lineCap = "round"; mctx.lineJoin = "round";
    mctx.beginPath(); mctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) mctx.lineTo(pts[i][0], pts[i][1]);
    mctx.stroke();
    var pad = Math.ceil(width + 4);
    var xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; });
    var x0 = Math.max(0, Math.floor(Math.min.apply(null, xs) - pad)), y0 = Math.max(0, Math.floor(Math.min.apply(null, ys) - pad));
    var x1 = Math.min(W - 1, Math.ceil(Math.max.apply(null, xs) + pad)), y1 = Math.min(H - 1, Math.ceil(Math.max.apply(null, ys) + pad));
    if (x1 < x0 || y1 < y0) return P;
    var bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    var img = mctx.getImageData(x0, y0, bw, bh).data;
    var D = new Float32Array(bw * bh);
    var last = pts[pts.length - 1];
    for (var y = 0; y < bh; y++) for (var x = 0; x < bw; x++) {
      var v = img[(y * bw + x) * 4] / 255;
      if (v <= 0) continue;
      var tt = tooth[(y + y0) * W + (x + x0)];
      var catchv = Math.max(0, Math.min(1, (tt - bias) / (1 - bias + 1e-6)));
      var tap = Math.min(1, Math.min(Math.hypot(x + x0 - pts[0][0], y + y0 - pts[0][1]), Math.hypot(x + x0 - last[0], y + y0 - last[1])) / (width * 4) + 0.1);
      D[y * bw + x] = v * load * tap * (0.12 + 2.4 * Math.sqrt(catchv));
    }
    glazeField(D, { x0: x0, y0: y0, x1: x1, y1: y1, w: bw, h: bh }, color);
    return P;
  }

  function reserveP(shape, o) {
    o = o || {};
    var alpha = o.alpha == null ? 1 : o.alpha;
    var r = rasterize(shape);
    if (!r) return P;
    var fe = (o.feather == null ? 2 : o.feather) * S;
    var padr = Math.ceil(fe * 3 + 4);
    var bw = r.x1 - r.x0 + 1 + padr * 2, bh = r.y1 - r.y0 + 1 + padr * 2, xs = Math.max(0, r.x0 - padr), ys = Math.max(0, r.y0 - padr);
    bw = Math.min(bw, W - xs); bh = Math.min(bh, H - ys);
    var sub = new Float32Array(bw * bh);
    for (var y = 0; y < bh; y++) for (var x = 0; x < bw; x++) sub[y * bw + x] = r.mask[(y + ys) * W + (x + xs)];
    if (fe > 0) sub = wcBoxBlur(sub, bw, bh, Math.max(1, Math.round(fe)), 2);
    for (var y = 0; y < bh; y++) for (var x = 0; x < bw; x++) {
      var s = Math.min(1, sub[y * bw + x] * alpha);
      var a0 = s * opT0;
      var a = a0 >= 1 ? 0 : (s * opT1 - a0) / (1 - a0);
      if (a <= 0) continue;
      var gi = (y + ys) * W + (x + xs), i = gi * 3;
      if (resAlpha) {
        if (a > resAlpha[gi]) resAlpha[gi] = a;
        continue;
      }
      buf[i] = buf[i] * (1 - a) + pristine[i] * a;
      buf[i + 1] = buf[i + 1] * (1 - a) + pristine[i + 1] * a;
      buf[i + 2] = buf[i + 2] * (1 - a) + pristine[i + 2] * a;
    }
    touch(xs, ys, xs + bw - 1, ys + bh - 1);
    return P;
  }

  function captionP(text, o) {
    o = o || {};
    var size = o.size == null ? Math.round(W / S * 0.013) : o.size;
    var spacing = o.spacing == null ? size * 0.55 : o.spacing;
    var y = o.y == null ? H / S - size * 2.2 : o.y;
    mctx.globalCompositeOperation = "source-over";
    mctx.fillStyle = "#000"; mctx.fillRect(0, 0, W, H);
    mctx.fillStyle = "#fff";
    mctx.font = (o.italic ? "italic " : "") + size + "px " + (o.font || "'Liberation Serif', Georgia, 'Times New Roman', serif");
    if (typeof mctx.letterSpacing !== "undefined") mctx.letterSpacing = spacing + "px";
    mctx.textAlign = "center"; mctx.textBaseline = "middle";
    var x = o.x == null ? W / S / 2 : o.x;
    mctx.setTransform(S, 0, 0, S, 0, 0);
    mctx.fillText(text, x, y);
    var metrics = mctx.measureText(text);
    mctx.setTransform(1, 0, 0, 1, 0, 0);
    var bw = Math.ceil(metrics.width * S) + 20;
    var x0 = Math.max(0, Math.floor(x * S - bw / 2)), y0 = Math.max(0, Math.floor((y - size * 1.2) * S));
    var x1 = Math.min(W - 1, Math.ceil(x * S + bw / 2)), y1 = Math.min(H - 1, Math.ceil((y + size * 1.2) * S));
    var iw = x1 - x0 + 1, ih = y1 - y0 + 1;
    var img = mctx.getImageData(x0, y0, iw, ih).data;
    var D = new Float32Array(iw * ih);
    var load = o.load == null ? 1.1 : o.load;
    for (var k = 0; k < iw * ih; k++) D[k] = img[k * 4] / 255 * load;
    glazeField(D, { x0: x0, y0: y0, x1: x1, y1: y1, w: iw, h: ih }, o.color || "sepia");
    return P;
  }

  function render() {
    var imgd = ctx.createImageData(W, H);
    var d = imgd.data;
    for (var i = 0, j = 0; i < N; i++, j += 4) {
      d[j] = Math.max(0, Math.min(255, buf[i * 3] * 255 + 0.5)) | 0;
      d[j + 1] = Math.max(0, Math.min(255, buf[i * 3 + 1] * 255 + 0.5)) | 0;
      d[j + 2] = Math.max(0, Math.min(255, buf[i * 3 + 2] * 255 + 0.5)) | 0;
      d[j + 3] = 255;
    }
    ctx.putImageData(imgd, 0, 0);
    return canvasEl;
  }

  var OP_FNS = { wash: washP, gradedWash: gradedWashP, glaze: glazeP, ink: inkP, hatch: hatchP, splatter: splatterP, dryStroke: dryStrokeP, reserve: reserveP, caption: captionP };
  var OP_WEIGHTS = { wash: 3, gradedWash: 3, glaze: 1.5, ink: 2, hatch: 2, splatter: 1.2, dryStroke: 1.5, reserve: 0.6, caption: 0.8 };

  function paint(op, t1, t0) {
    opT0 = t0 == null ? 0 : t0;
    opT1 = t1 == null ? 1 : t1;
    curOp = op;
    OP_FNS[op.k].apply(null, op.a);
    if (opT1 >= 1) delete op.inkD;
    curOp = null;
    opT0 = 0;
    opT1 = 1;
  }

  function doOp(k, args) {
    var op = { k: k, a: Array.prototype.slice.call(args) };
    ops.push(op);
    if (!defer) {
      paint(op, 1, 0);
      cursorI = ops.length;
      cursorT = 0;
    }
    return P;
  }

  function wash() { return doOp("wash", arguments); }
  function gradedWash() { return doOp("gradedWash", arguments); }
  function glaze() { return doOp("glaze", arguments); }
  function ink() { return doOp("ink", arguments); }
  function hatch() { return doOp("hatch", arguments); }
  function splatter() { return doOp("splatter", arguments); }
  function dryStroke() { return doOp("dryStroke", arguments); }
  function reserve() { return doOp("reserve", arguments); }
  function caption() { return doOp("caption", arguments); }

  var cursorI = 0, cursorT = 0;

  function resetSheet() {
    buf.set(pristine);
    for (var i = 0; i < ops.length; i++) delete ops[i].inkD;
    cursorI = 0;
    cursorT = 0;
    return P;
  }

  function timeline() {
    var tot = 0, cum = [];
    for (var i = 0; i < ops.length; i++) { tot += OP_WEIGHTS[ops[i].k] || 1; cum.push(tot); }
    return { total: tot, cum: cum };
  }

  function seek(u) {
    u = Math.max(0, Math.min(1, u));
    var tl = timeline();
    if (!ops.length) {
      render();
      return P;
    }
    var target = u * tl.total;
    var i = 0;
    while (i < ops.length && tl.cum[i] <= target) i++;
    var prev = i > 0 ? tl.cum[i - 1] : 0;
    var t = i < ops.length ? (target - prev) / (tl.cum[i] - prev) : 1;
    if (i < cursorI || (i === cursorI && t < cursorT)) resetSheet();
    while (cursorI < i) {
      paint(ops[cursorI], 1, cursorT);
      cursorI++;
      cursorT = 0;
    }
    if (i < ops.length && t > cursorT) {
      paint(ops[i], t, cursorT);
      cursorT = t;
    }
    render();
    return P;
  }

  function paintAlone(op, t, wantAlpha) {
    delete op.inkD;
    buf.fill(1);
    touched = null;
    if (wantAlpha) resAlpha = new Float32Array(N);
    paint(op, t, 0);
    delete op.inkD;
  }

  function layer(i, t) {
    var op = ops[i];
    if (!op) throw new Error("layer: no op at index " + i);
    var isLift = op.k === "reserve";
    t = t == null || !(t < 1) ? 1 : Math.max(0, t);
    try {
      if (t < 1 && !op.box) {
        paintAlone(op, 1, false);
        op.box = touched;
        if (!op.box) return null;
      }
      paintAlone(op, t, isLift);
      if (t >= 1) op.box = touched;
      var al = resAlpha;
      var b = op.box;
      if (!b) return null;
      var bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1;
      var lc = createCanvas(bw, bh);
      var lctx = lc.getContext("2d");
      var imgd = lctx.createImageData(bw, bh), d = imgd.data;
      for (var y = 0; y < bh; y++) for (var x = 0; x < bw; x++) {
        var gi = (y + b.y0) * W + (x + b.x0), j = (y * bw + x) * 4;
        var src = isLift ? pristine : buf;
        var R = Math.max(0, Math.min(255, src[gi * 3] * 255 + 0.5)) | 0;
        var G = Math.max(0, Math.min(255, src[gi * 3 + 1] * 255 + 0.5)) | 0;
        var B = Math.max(0, Math.min(255, src[gi * 3 + 2] * 255 + 0.5)) | 0;
        d[j] = R; d[j + 1] = G; d[j + 2] = B;
        d[j + 3] = isLift ? Math.max(0, Math.min(255, al[gi] * 255 + 0.5)) | 0 : (R === 255 && G === 255 && B === 255 ? 0 : 255);
      }
      lctx.putImageData(imgd, 0, 0);
      return { canvas: lc, kind: op.k, x: b.x0 / W, y: b.y0 / H, w: bw / W, h: bh / H };
    } finally {
      resAlpha = null;
      resetSheet();
    }
  }

  function renderUpTo(i, t) {
    resetSheet();
    i = Math.max(0, Math.min(i, ops.length));
    while (cursorI < i) { paint(ops[cursorI], 1, 0); cursorI++; }
    if (t > 0 && i < ops.length) { paint(ops[i], t, 0); cursorT = t; }
    render();
    return P;
  }

  var P = {
    canvas: canvasEl, width: W, height: H, scale: S, tooth: tooth, rng: rng,
    wash: wash, gradedWash: gradedWash, glaze: glaze, ink: ink, hatch: hatch,
    splatter: splatter, dryStroke: dryStroke, reserve: reserve, caption: caption, render: render,
    ops: ops, seek: seek, timeline: timeline, resetSheet: resetSheet, renderUpTo: renderUpTo,
    layer: layer, pigment: wcColor
  };
  return P;
}



  function buildSheet(paintFn, width, height, scale, seed) {
    // Cap the sheet under the kit's pixel limit: oversized paintings render downscaled.
    scale = Math.min(scale, Math.sqrt(11000000 / (width * height)));
    var p = paper(width * scale, height * scale, { seed: seed, scale: scale, defer: true });
    paintFn(p);
    return p;
  }

  var sheetCache = new WeakMap();

  function frame(paintFn, o) {
    o = o || {};
    var width = o.width || 900, height = o.height || 1200;
    var scale = o.scale || 1, at = o.at == null ? 1 : Math.max(0, Math.min(1, o.at));
    var key = width + 'x' + height + '@' + scale + '#' + o.seed;
    var perFn = sheetCache.get(paintFn);
    if (!perFn) {
      perFn = { keys: [], sheets: {} };
      sheetCache.set(paintFn, perFn);
    }
    if (!perFn.sheets[key]) {
      perFn.sheets[key] = buildSheet(paintFn, width, height, scale, o.seed);
      perFn.keys.push(key);
      if (perFn.keys.length > 2) delete perFn.sheets[perFn.keys.shift()];
    }
    perFn.sheets[key].seek(at);
    return perFn.sheets[key].canvas.toDataURL(o.type || 'image/png', o.quality);
  }

  var TEMPLATE =
    '<style>' +
    ':host{display:block;position:relative}' +
    'canvas{display:block;width:100%;height:auto}' +
    'button{position:absolute;right:10px;bottom:10px;border:none;border-radius:999px;' +
    'padding:6px 14px;font:500 12px system-ui,sans-serif;color:#6b6454;' +
    'background:rgba(255,255,255,0.82);box-shadow:0 1px 4px rgba(0,0,0,0.12);cursor:pointer;opacity:0;' +
    'transition:opacity .25s}button.shown{opacity:1}' +
    '</style>';

  var EASE = function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
  var EASE_INV = function (p) { return p < 0.5 ? Math.sqrt(p / 2) : 1 - Math.sqrt((1 - p) / 2); };

  class WatercolorKitElement extends HTMLElement {
    constructor() {
      super();
      this._u = 0;
      this._raf = 0;
      this._loopT = 0;
      this._onDone = null;
      this._sheet = null;
      this._paintFn = null;
      this.attachShadow({ mode: 'open' });
    }

    get painting() { return this._paintFn; }

    set painting(fn) {
      this._paintFn = fn;
      this._setup();
    }

    get progress() { return this._u; }

    _attr(name, fallback) {
      var v = parseFloat(this.getAttribute(name));
      return isFinite(v) ? v : fallback;
    }

    _setup() {
      if (!this._paintFn) return;
      var width = this._attr('width', 900);
      var height = this._attr('height', 1200);
      var scale = Math.min(1.5, window.devicePixelRatio || 1);
      this._sheet = buildSheet(this._paintFn, width, height, scale, this.hasAttribute('seed') ? this._attr('seed', 7) : undefined);
      var root = this.shadowRoot;
      root.innerHTML = TEMPLATE;
      root.appendChild(this._sheet.canvas);
      if (this.hasAttribute('controls')) {
        var btn = document.createElement('button');
        btn.textContent = 'paint again';
        var self2 = this;
        btn.addEventListener('click', function () { self2.play(0); btn.className = ''; });
        if (this._onDone) this.removeEventListener('watercolor-done', this._onDone);
        this._onDone = function () { btn.className = 'shown'; };
        this.addEventListener('watercolor-done', this._onDone);
        root.appendChild(btn);
      }
      this.seek(0);
      if (this.getAttribute('autoplay') !== 'false') this.play(0);
    }

    seek(u) {
      if (!this._sheet) return;
      this._u = Math.max(0, Math.min(1, u));
      this._sheet.seek(this._u);
    }

    play(fromU) {
      if (!this._sheet) return;
      var dur = this._attr('duration', 12) * 1000;
      var loop = this.hasAttribute('loop');
      if (fromU != null) this.seek(fromU);
      var startT = this._u >= 1 ? 0 : EASE_INV(this._u);
      var t0 = performance.now() - startT * dur;
      var self2 = this;
      this.pause();
      var step = function (now) {
        if (!self2.isConnected) return;
        var u = Math.min(1, (now - t0) / dur);
        self2._u = EASE(u);
        self2._sheet.seek(self2._u);
        if (u < 1) {
          self2._raf = requestAnimationFrame(step);
        } else {
          if (loop) self2._loopT = setTimeout(function () { self2.play(0); }, 1200);
          self2.dispatchEvent(new CustomEvent('watercolor-done'));
        }
      };
      this._raf = requestAnimationFrame(step);
    }

    pause() {
      cancelAnimationFrame(this._raf);
      clearTimeout(this._loopT);
    }

    disconnectedCallback() { this.pause(); }
  }

  if (!customElements.get('watercolor-kit')) {
    customElements.define('watercolor-kit', WatercolorKitElement);
  }

  function bake(paintFn, o, onFrame) {
    o = o || {};
    var steps = Math.max(1, Math.round(o.steps || 36));
    var type = o.type || 'image/jpeg', quality = o.quality == null ? 0.88 : o.quality;
    var sheet = buildSheet(paintFn, o.width || 900, o.height || 1200, o.scale || 1, o.seed);
    var frames = new Array(steps + 1);
    return new Promise(function (resolve, reject) {
      var i = 0;
      var step = function () {
        try {
          sheet.seek(i / steps);
          frames[i] = sheet.canvas.toDataURL(type, quality);
          if (onFrame) onFrame(i, steps, frames[i]);
        } catch (e) {
          return reject(e);
        }
        if (++i > steps) return resolve(frames);
        setTimeout(step, 0);
      };
      setTimeout(step, 0);
    });
  }

  var layerCache = new WeakMap();
  var layerCacheBySrc = new Map();
  var LAYER_STEPS = 48;
  var LAYER_PARTIALS_KEPT = 8;

  function layers(paintFn, o) {
    o = o || {};
    var width = o.width || 900, height = o.height || 1200;
    var scale = o.scale || 1;
    var q = o.quality == null ? 0.92 : o.quality;
    var key = width + 'x' + height + '@' + scale + '#' + o.seed + '/' + q;
    var perFn = layerCache.get(paintFn);
    if (!perFn) {
      var srcKey = String(paintFn);
      var bySrc = srcKey.indexOf('[native code]') < 0;
      perFn = bySrc ? layerCacheBySrc.get(srcKey) : undefined;
      if (perFn && !perFn.warned) {
        perFn.warned = true;
        console.warn('watercolor layers(): painting function identity changed between renders; define it once at module scope. Reusing the cached decomposition by source text - closures capturing different data will collide.');
      }
      if (!perFn) {
        perFn = { keys: [], sets: {} };
        if (bySrc) {
          layerCacheBySrc.set(srcKey, perFn);
          if (layerCacheBySrc.size > 4) layerCacheBySrc.delete(layerCacheBySrc.keys().next().value);
        }
      }
      layerCache.set(paintFn, perFn);
    }
    if (!perFn.sets[key]) {
      var sheet = buildSheet(paintFn, width, height, scale, o.seed);
      sheet.resetSheet();
      sheet.render();
      var tl = sheet.timeline();
      var fmt = 'image/webp';
      if (document.createElement('canvas').toDataURL(fmt).indexOf('data:' + fmt) !== 0) fmt = 'image/png';
      var enc = function (c) { return c.toDataURL(fmt, q); };
      perFn.sets[key] = { sheet: sheet, paper: enc(sheet.canvas), tl: tl, enc: enc, srcs: {}, meta: {}, partials: {} };
      perFn.keys.push(key);
      if (perFn.keys.length > 2) delete perFn.sets[perFn.keys.shift()];
    }
    var set = perFn.sets[key];
    function ensure(i) {
      if (!set.meta[i]) {
        var L = set.sheet.layer(i, 1);
        set.meta[i] = L ? { kind: L.kind, box: { x: L.x, y: L.y, w: L.w, h: L.h } } : { kind: (set.sheet.ops[i] || {}).k, box: null };
        if (L) set.srcs[i + ':1'] = set.enc(L.canvas);
      }
      return set.meta[i];
    }
    return {
      width: width, height: height, count: set.sheet.ops.length, paper: set.paper,
      kind: function (i) { return ensure(i).kind; },
      box: function (i) { return ensure(i).box; },
      span: function (i) {
        var tot = set.tl.total || 1;
        return { from: (i > 0 ? set.tl.cum[i - 1] : 0) / tot, to: set.tl.cum[i] / tot };
      },
      warm: function () {
        if (set.warming) return set.warming;
        set.warming = new Promise(function (resolve) {
          var i = 0;
          var step = function () {
            if (i >= set.sheet.ops.length) return resolve();
            try { ensure(i); } catch (e) { }
            i++;
            setTimeout(step, 0);
          };
          setTimeout(step, 0);
        });
        return set.warming;
      },
      src: function (i, t) {
        ensure(i);
        var q = t == null || !(t < 1) ? 1 : Math.max(0, Math.round(t * LAYER_STEPS)) / LAYER_STEPS;
        var k = i + ':' + q;
        if (set.srcs[k] === undefined) {
          if (q <= 0) set.srcs[k] = null;
          else {
            var L = set.sheet.layer(i, q);
            set.srcs[k] = L ? set.enc(L.canvas) : null;
            if (q < 1) {
              var part = set.partials[i] || (set.partials[i] = []);
              part.push(k);
              if (part.length > LAYER_PARTIALS_KEPT) delete set.srcs[part.shift()];
            }
          }
        }
        return set.srcs[k];
      }
    };
  }

  window.WatercolorKit = { paper: paper, frame: frame, bake: bake, layers: layers, pigment: wcColor };

})();
