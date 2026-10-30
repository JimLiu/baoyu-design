/* BEGIN USAGE */
/**
 * <data-overlay> — paints views of product data onto a live UI.
 *
 * Wraps any rendered UI, tracks the live rect of every descendant carrying
 * the tracked attribute (default data-metric-id), and paints the active
 * VIEW on top: a colour wash + value tag on each of the view's listed
 * elements (interpolated into a single per-view spectrum), optional pinned
 * callout cards, spotlight rings, and every other tracked element faded
 * back (its own opacity drops) so the view's subjects stand out. The component ships ZERO built-in view
 * types — no default heat-map, no preset modes. The agent authors every
 * view in one static data file; the component just renders what's there.
 *
 * The one irreplaceable piece is the positioning engine — MutationObserver
 * + ResizeObserver + occlusion-tracked rects keeping every wash, tag and
 * callout pinned as the wrapped UI reflows. Washes, rings and pins follow
 * each element's computed border-radius and CSS transform (own or
 * inherited from ancestors inside the overlay) — a rotated card gets a
 * rotated wash, a pill chip a pill-shaped ring.
 *
 * Attributes (all three — there are no others):
 *   src       URL of the data file. .js → <script src>; assigns
 *             window.__overlays = { views: [...] }. .json → fetch()ed.
 *             Re-fetched on attribute change and on a 'overlay:reload'
 *             event (also accepted as a window postMessage
 *             {type:'overlay:reload'}). The global is a shared mailbox —
 *             one file-loading overlay per page (two overlays with
 *             different .js src race each other's loads); drive a second
 *             instance via el.setViews().
 *   id-attr   Name of the tracked attribute on wrapped descendants.
 *             Default 'data-metric-id'. Override for templates that
 *             already carry their own stable ids.
 *   controls  'on' | 'off'. Default 'off' — headless: no sentence row, no
 *             padding, no stage chrome, no buttons; just the painted view
 *             (legend/basis included). 'on' renders the sentence control:
 *             "Showing ⟨metric⟩ for ⟨cohort⟩ over ⟨window⟩" — each segment
 *             switches among the views present in the file (client-side,
 *             instant). A metric click with no exact match snaps to that
 *             metric's closest authored view; a cohort/window combination
 *             no view answers shows a plain "Ask Claude to fetch metrics"
 *             button — the ONE host round-trip (see below).
 *
 * With no src and no setViews() data the overlay is a true passthrough —
 * that is the tweak's off position. ALWAYS expose it via a tweaks-panel
 * toggle (on by default; the tweak maps the src attribute), never as an
 * always-on wrapper.
 *
 * Data file shape (suggest is optional; everything else per-view):
 *   window.__overlays = {
 *     suggest: { window: ['last 7 days', 'weekends only'],
 *                cohort: ['new users only'] },
 *                          // OPTIONAL suggested cuts per sentence field
 *                          // (metric/cohort/window). They rotate through
 *                          // the segment menus' free-type placeholder —
 *                          // an invitation to ask, NOT data: list cuts
 *                          // you could compute and a user would
 *                          // plausibly want next. Entries an authored
 *                          // view already answers are skipped; absent,
 *                          // the component falls back to generic ones.
 *     views: [
 *     { id: 'reach-28d',
 *       label: 'Where creation actually starts',
 *       asOf: '2026-06-24',
 *       basis: 'all workspace users, last 28 days',   // the denominator,
 *                          // in plain words. REQUIRED on any view whose
 *                          // elements carry values — it renders in the
 *                          // legend row; omitting it paints a visible
 *                          // "basis not stated" warning. Views with no
 *                          // values (pure callouts/spotlights) may omit.
 *       sentence: { metric: 'reach', cohort: 'all users',
 *                   window: 'last 28 days' },          // what the sentence
 *                          // control shows for this view; omitted fields
 *                          // fall back to label (metric) / '' (others)
 *       source: 'events.button_clicked grouped by target, unique users ÷
 *                active users, 28d window',            // the recorded
 *                          // query recipe. Load-bearing: a refresh re-runs
 *                          // THIS, re-anchored to today — write it
 *                          // precisely enough to re-run without guessing.
 *       refreshable: true,                             // show the ask
 *                          // button for this view when controls are on
 *       finding: 'Creation concentrates in the composer — the template
 *                 rail is reach, not output.',          // 1–2 sentence
 *                          // takeaway. Renders ABOVE the stage as the
 *                          // story's lead line — the first thing the
 *                          // user reads; the painted view backs it up.
 *                          // Derive it from the computed numbers (write
 *                          // it after computing values, never before).
 *       meta: { range: 'Jun 9 – Jul 7',    // the data's own date range,
 *               n: 128437,                  // the volume the query
 *               unit: 'card-open events',   // returned — the unit NAMES
 *                          // the exact thing counted ("card-open
 *                          // events", never a vague "events" or
 *                          // "rows"), and:
 *               about: 'events that led to shared projects' },
 *                          // a short plain-words description of the
 *                          // exact data cut shown — metrics, joins,
 *                          // filters in words, NOT a table name; for a
 *                          // derived metric, say what counts as one
 *                          // ("output = export, share, or publish");
 *                          // ≤100 chars, it's a subtitle. The goal of
 *                          // this line is to EARN TRUST in the data —
 *                          // specific beats generic. Optional
 *                          // (controls=on only): every element is
 *                          // independently optional, invalid values
 *                          // drop per-element, absent meta renders
 *                          // nothing. Compute range and n from the
 *                          // query you actually ran — a refresh
 *                          // recomputes them naturally via 'source'.
 *                          // While meta's subtitle is showing, the
 *                          // legend row drops its own basis/asOf text
 *                          // (the subtitle carries it) and keeps just
 *                          // the ramp keys and the Δ comparison.
 *       spectrum: {
 *         colors: ['#F0EEE6','#D97757'],  // ramp endpoints; 3 = diverging
 *         domain: [min, max],             // defaults to this view's range
 *         steps?: N,                      // quantize to N discrete bins
 *         scale?: 'linear'|'quantile',    // quantile = rank-based spacing
 *         baseline?: v,                   // divergence midpoint (3 colors);
 *                                         // when set, baseline WINS over
 *                                         // good:'low' and scale:'quantile'
 *         good?: 'high'|'low',            // flips the ramp
 *         fmt?: 'pct'|'n'|fn,
 *         // sugar: hue:'#X' ≡ colors:['#F6F4EF','#X']
 *         // Colour strings must be #rgb / #rrggbb / rgb() / rgba() —
 *         // hsl(), oklch() and named colours are NOT parsed; a ramp stop
 *         // in those formats silently falls back to the default ramp,
 *         // and an el.color override falls back to the ramp colour.
 *       },
 *       dim: 0.25,                         // non-subject fade: every
 *                          // unlisted tracked element drops to this
 *                          // opacity (element opacity — theme-agnostic,
 *                          // nothing painted over it). Default 0.25;
 *                          // 1 = leave non-subjects untouched. The fade
 *                          // writes the element's INLINE opacity (saved
 *                          // and restored) — pages that animate inline
 *                          // opacity on tracked elements will conflict
 *                          // with it; use dim: 1 there.
 *       deltaBasis: 'prior 28 days',       // what per-element delta is
 *                          // measured against. Deltas render ONLY when the
 *                          // view declares this — a delta without a stated
 *                          // comparison basis is a number without meaning.
 *       elements: [
 *         { id: 'composer-create', value: 0.37, delta: 0.04,
 *           callout: { pin: 1, head: 'Composer Create',
 *                      body: 'The only path that asks for a prompt.',
 *                      place?: 'above', dx?, dy? } },
 *         { id: 'tpl-rail', value: 0.28 },     // wash + tag only
 *         { id: 'special', value: 0.9, color: '#2A78D6' }, // ramp bypass
 *         { id: 'help', value: null },          // hatched: measured nothing
 *         { id: 'blank-link' },                 // spotlight only
 *       ],
 *       legend: true,                      // ramp swatch row (auto)
 *     },
 *   ]};
 *
 * Semantics:
 *   - Listed elements are the view's subjects. Every OTHER tracked element
 *     fades back: its own opacity drops to `dim` (default 0.25).
 *     `dim: 1` leaves non-subjects untouched (no treatment at all).
 *   - `value` → colour wash + value tag (fmt-formatted). `null` paints a
 *     hatched "measured, found nothing" square — visibly different from a
 *     low number. Absent value = plain spotlight ring.
 *   - `delta` → a small ▲/▼ suffix in the value tag, coloured by whether
 *     the move is good (spectrum.good:'low' flips it). Renders only when
 *     the view declares deltaBasis, which joins the legend row.
 *   - `callout` → pinned annotation card + leader line, laid out
 *     DETERMINISTICALLY: same data + same viewport → same layout. Cards
 *     sweep below / above / right / left, avoid covering other subjects,
 *     clamp to the stage; place/dx/dy fixes a card and the sweep routes
 *     the others around it. Pins auto-number in elements-array order.
 *   - The legend row carries the view's basis (and asOf) when the view
 *     paints values — the denominator travels with the picture — except
 *     while the meta subtitle is showing, which says it better; the
 *     legend then keeps the ramp keys and the Δ comparison only.
 *   - The sentence control NEVER re-slices data client-side. It switches
 *     among authored views; anything else is a chat turn. Each segment
 *     opens a menu of the authored values for its field (current one
 *     heavier), plus a free-type box whose placeholder rotates through
 *     suggested cuts — the file's optional 'suggest' field when
 *     authored, generic fallbacks otherwise. Picking an authored value
 *     switches views: a metric pick with no exact match snaps to that
 *     metric's closest authored view, and the sentence re-renders that
 *     view's full cohort + window — honest about what the stage now
 *     shows. Cohort and window picks stay exact-match. Submitting typed
 *     text (Enter or the ask pill) PRE-FILLS a chat turn for exactly
 *     that cut — the user sends it; nothing is auto-submitted.
 *   - View ids must be short and identifier-like ([A-Za-z0-9_.-], ≤64
 *     chars), and sentence field values must be short plain phrases
 *     (letters, digits, spaces, ,.%+/&()'- ; ≤64 chars): the fetch
 *     round-trip validates both host-side and silently drops anything
 *     else from the built prompt.
 *
 * The ONE host round-trip — 'data-overlay:fetch':
 *   Clicking "Ask Claude to fetch metrics" posts
 *     { type: 'data-overlay:fetch', src, mode: 'refresh'|'missing',
 *       view: activeViewId, want: {metric,cohort,window}|null,
 *       fallbackPrompt }
 *   to window.parent (and dispatches a same-named DOM CustomEvent). The
 *   host builds the real chat turn from the structured fields and
 *   PRE-FILLS the chat composer with it — the user's Send click submits
 *   it (never auto-sent: this message is iframe-originated and forgeable,
 *   so the host-side Send is the consent gate); fallbackPrompt is for
 *   hosts without their own builder and is NOT to be trusted verbatim. While waiting the stage shimmers and the
 *   button reads "Asked — Claude's on it" (clicking that reverts); if
 *   nothing lands in 90s the overlay reverts to the last view, marked
 *   stale. A 'refresh' re-runs the view's own recorded `source`; a
 *   'missing' authors a NEW view for the asked combination. Everything
 *   else — a different question, "why is this low?" — belongs in chat.
 *
 * Imperative API:
 *   el.views               — the loaded views array (getter)
 *   el.setViews(data)      — drive without a src file (array or {views})
 *   el.view / el.view = id — active view id (property, not an attribute)
 *   el.measure()           — re-measure rects now
 *
 *   <script src="data-overlay.js"></script>
 *   <data-overlay src="./overlay-data.js">
 *     …product UI with data-metric-id attrs…
 *   </data-overlay>
 */
/* END USAGE */

(function () {
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;';
    });
  }
  function fmtN(n) {
    if (n == null) return '–'; n = Number(n);
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + 'k';
    return String(Math.round(n));
  }
  function fmtPct(v) { return v == null ? '–' : (v * 100).toFixed(Math.abs(v) < 0.10 ? 1 : 0) + '%'; }
  function fmtOf(spec) {
    var f = spec && spec.fmt;
    if (typeof f === 'function') return f;
    if (f === 'n') return fmtN;
    return fmtPct;
  }
  function fmtDay(iso) {
    if (!iso) return '';
    var d = new Date(String(iso).indexOf('T') < 0 ? iso + 'T00:00:00' : iso);
    // Unparseable input renders as nothing rather than echoing the raw
    // string into the legend row (asOf is view data, not trusted markup).
    return isNaN(d) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  // Parse #rgb/#rrggbb/rgb()/rgba() → [r,g,b]. Returns null for unknown.
  function parseColor(c) {
    if (!c) return null;
    c = String(c).trim();
    var m = /^#([0-9a-f]{3})$/i.exec(c);
    if (m) return [0, 1, 2].map(function (i) { return parseInt(m[1][i] + m[1][i], 16); });
    m = /^#([0-9a-f]{6})$/i.exec(c);
    if (m) return [0, 2, 4].map(function (i) { return parseInt(m[1].slice(i, i + 2), 16); });
    m = /^rgba?\(([^)]+)\)$/i.exec(c);
    if (m) return m[1].split(',').slice(0, 3).map(function (n) { return Math.round(parseFloat(n)); });
    return null;
  }
  function rgbStr(c) { return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; }
  function lerpColor(a, b, t) {
    return [0, 1, 2].map(function (i) { return Math.round(a[i] + (b[i] - a[i]) * t); });
  }
  // Normalise an author colour string to a safe rgb() literal (colour
  // strings are the one unescaped sink into style attributes). Unparseable
  // → null so callers fall back to the ramp.
  function safeColor(c) { var p = parseColor(c); return p ? rgbStr(p) : null; }
  function accentOf(sp) { return sp && sp.hue ? safeColor(sp.hue) : null; }
  // ---- Element geometry: computed border-radius + accumulated transform.
  // Adornments painted over an element must follow its shape: its computed
  // border-radius and its full CSS transform — a rotated card gets a
  // rotated wash/ring, not its axis-aligned bounding box.
  //
  // Parse one computed corner radius ("8px", "50%", "8px 12px") into a
  // validated [horizontal, vertical] pair, or null when unreadable. The
  // values land in a style attribute, so anything but bare px/% numbers
  // is rejected outright.
  function cornerRad(v) {
    if (typeof v !== 'string' || !v) return null;
    var parts = v.trim().split(/\s+/);
    if (parts.length < 1 || parts.length > 2) return null;
    for (var i = 0; i < parts.length; i++) {
      if (!/^\d*\.?\d+(px|%)$/.test(parts[i])) return null;
    }
    return [parts[0], parts[1] || parts[0]];
  }
  // A border-radius shorthand from a computed style, or null when the
  // environment can't say (the stylesheet default applies then). "0px"
  // everywhere is a real answer — sharp corners are followed too.
  // Percentages stay faithful because the painted box always matches the
  // element's own box dimensions.
  function radiusOf(cs) {
    var tl = cornerRad(cs.borderTopLeftRadius), tr = cornerRad(cs.borderTopRightRadius);
    var br = cornerRad(cs.borderBottomRightRadius), bl = cornerRad(cs.borderBottomLeftRadius);
    if (!tl || !tr || !br || !bl) return null;
    var hh = [tl[0], tr[0], br[0], bl[0]], vv = [tl[1], tr[1], br[1], bl[1]];
    var same = hh[0] === vv[0] && hh[1] === vv[1] && hh[2] === vv[2] && hh[3] === vv[3];
    return hh.join(' ') + (same ? '' : ' / ' + vv.join(' '));
  }
  // The 2x2 linear part of a computed transform. Returns:
  //   null  — none / identity (nothing to do)
  //   false — not expressible as a 2D affine (perspective, z-mixing) —
  //           the caller falls back to the axis-aligned box
  //   [a,b,c,d] — CSS matrix() order. e/f are ignored on purpose: the
  //           translation is recovered exactly from the measured AABB
  //           (quadOffset below), which absorbs every intermediate
  //           translate, scroll and position offset.
  function linearOf(t) {
    if (!t || t === 'none') return null;
    var m = /^matrix\(([^)]+)\)$/.exec(t), v;
    if (m) {
      v = m[1].split(',').map(parseFloat);
      if (v.length !== 6 || v.some(function (n) { return !isFinite(n); })) return false;
      v = [v[0], v[1], v[2], v[3]];
    } else {
      m = /^matrix3d\(([^)]+)\)$/.exec(t);
      if (!m) return false;
      var w = m[1].split(',').map(parseFloat);
      if (w.length !== 16 || w.some(function (n) { return !isFinite(n); })) return false;
      if (w[2] || w[3] || w[6] || w[7] || w[8] || w[9] || w[11] || w[14] || w[10] !== 1 || w[15] !== 1) return false;
      v = [w[0], w[1], w[4], w[5]];
    }
    if (v[0] === 1 && v[1] === 0 && v[2] === 0 && v[3] === 1) return null;
    return v;
  }
  // The element's own full linear part: the independent translate/rotate/
  // scale properties compose with the transform property in spec order
  // (translate · rotate · scale · transform). translate never affects the
  // linear part; unsupported 3D forms (axis rotates, z-scales) return
  // false so the caller falls back to the axis-aligned box.
  function ownLinear(cs) {
    // CSS zoom rescales the element in a way none of this models — bail
    // to the axis-aligned box rather than paint a confidently wrong quad.
    var z = cs.zoom;
    if (z && z !== '1' && z !== 'normal' && parseFloat(z) !== 1) return false;
    var t = linearOf(cs.transform);
    if (t === false) return false;
    var out = t, m;
    var scl = cs.scale;
    if (scl && scl !== 'none') {
      var p = String(scl).trim().split(/\s+/).map(parseFloat);
      if (!p.length || p.length > 3 || p.some(function (n) { return !isFinite(n); }) || (p.length === 3 && p[2] !== 1)) return false;
      var S = [p[0], 0, 0, p.length >= 2 ? p[1] : p[0]];
      out = out ? mulLin(S, out) : S;
    }
    var rot = cs.rotate;
    if (rot && rot !== 'none') {
      m = /^(?:z\s+)?(-?[\d.]+(?:e[+-]?\d+)?)(deg|rad|grad|turn)$/i.exec(String(rot).trim());
      if (!m) return false;
      var a = parseFloat(m[1]), u = m[2].toLowerCase();
      var th = u === 'deg' ? a * Math.PI / 180 : u === 'rad' ? a : u === 'grad' ? a * Math.PI / 200 : a * 2 * Math.PI;
      var R = [Math.cos(th), Math.sin(th), -Math.sin(th), Math.cos(th)];
      out = out ? mulLin(R, out) : R;
    }
    if (out && out[0] === 1 && out[1] === 0 && out[2] === 0 && out[3] === 1) return null;
    return out;
  }
  // Compose 2x2 linear parts: apply B first, then A (CSS column-major).
  function mulLin(A, B) {
    return [
      A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1],
      A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3],
    ];
  }
  // Where the untransformed w×h box lands under L, as the min corner of
  // its mapped bounding box. Painting at (aabb.x - ox, aabb.y - oy) with
  // transform:matrix(a,b,c,d,0,0) and transform-origin:0 0 reproduces the
  // element's exact quad, whatever transform-origins and translations
  // produced it — the measured AABB implies the translation.
  function quadOffset(L, w, h) {
    var xs = [0, L[0] * w, L[2] * h, L[0] * w + L[2] * h];
    var ys = [0, L[1] * w, L[3] * h, L[1] * w + L[3] * h];
    return { ox: Math.min.apply(null, xs), oy: Math.min.apply(null, ys) };
  }
  // Style covering the element's true quad — falls back to the
  // axis-aligned rect when no usable transform was measured.
  function coverStyle(r) {
    if (r.tf) {
      return 'left:' + (r.x - r.tf.ox) + 'px;top:' + (r.y - r.tf.oy) + 'px;width:' + r.tf.w +
        'px;height:' + r.tf.h + 'px;transform:matrix(' + r.tf.a + ',' + r.tf.b + ',' + r.tf.c + ',' +
        r.tf.d + ',0,0);transform-origin:0 0';
    }
    return 'left:' + r.x + 'px;top:' + r.y + 'px;width:' + r.w + 'px;height:' + r.h + 'px';
  }
  function radStyle(r) { return r.rad ? ';border-radius:' + r.rad : ''; }
  // Build a value→colour function from a spectrum spec. Same contract as
  // the insight overlay this component descends from:
  //   colors: ['#F0EEE6','#D97757'] — true RGB interpolation; 3 colors =
  //     diverging around baseline. hue:'#X' is sugar for colors:[paper,X].
  //   domain:[min,max] (default = observed range across this view)
  //   steps:N quantizes t into N discrete bins
  //   scale:'quantile' maps each value to its rank position (separates
  //     tightly-clustered values)
  //   baseline:v — with 3 colors, the divergence midpoint
  //   good:'low' flips the ramp (lower value = colors[1] end)
  function buildRamp(spec, values) {
    spec = spec || {};
    // Normalise shape first — a bare string or an empty array would throw
    // below, and buildRamp runs on every measure tick.
    var raw = Array.isArray(spec.colors) && spec.colors.length ? spec.colors
      : (spec.hue ? ['#F6F4EF', spec.hue] : ['#F6F4EF', '#558A42']);
    if (raw.length === 1) raw = ['#F6F4EF', raw[0]];
    var cols = raw.map(parseColor);
    // Fall back to a safe paper→green ramp if any stop is unparseable, so
    // a typo in one colour string can't blank the whole view.
    if (cols.some(function (c) { return !c; })) cols = [parseColor('#F6F4EF'), parseColor('#558A42')];
    var dom = spec.domain, lo, hi;
    if (dom && dom.length >= 2) { lo = dom[0]; hi = dom[1]; }
    else {
      lo = Infinity; hi = -Infinity;
      for (var i = 0; i < values.length; i++) { var v = values[i]; if (v == null) continue; if (v < lo) lo = v; if (v > hi) hi = v; }
      if (lo === Infinity) { lo = 0; hi = 1; }
    }
    var flat = lo === hi;
    if (flat) hi = lo + 1;
    // quantile scale — rank among DISTINCT values, so ties (including a
    // tied maximum) land on the same t and the ramp's ends stay reachable.
    var sorted = null;
    if (spec.scale === 'quantile') {
      var seen = Object.create(null);
      sorted = values.filter(function (v) {
        if (v == null || seen[v]) return false; seen[v] = 1; return true;
      }).sort(function (a, b) { return a - b; });
    }
    var toT = function (v) {
      var t;
      if (flat) t = 0.5;  // one distinct value — mid-ramp, not palest tint
      else if (sorted && sorted.length > 1) {
        var r = 0; while (r < sorted.length && sorted[r] < v) r++;
        t = r / (sorted.length - 1);
      } else {
        t = (v - lo) / (hi - lo);
      }
      t = Math.max(0, Math.min(1, t));
      if (spec.good === 'low') t = 1 - t;
      if (spec.steps > 1) t = Math.round(t * (spec.steps - 1)) / (spec.steps - 1);
      return t;
    };
    var at = function (t) {
      if (cols.length >= 3) {
        // diverging around baseline → left half cols[1]→cols[0], right
        // half cols[1]→cols[2]. baseline maps to t=0.5 when inside [lo,hi].
        return t < 0.5 ? lerpColor(cols[1], cols[0], 1 - t * 2) : lerpColor(cols[1], cols[2], (t - 0.5) * 2);
      }
      return lerpColor(cols[0], cols[cols.length - 1], t);
    };
    // baseline shifts the midpoint so v=baseline lands at t=0.5 in the
    // diverging case. Done by piecewise re-scaling either side.
    var base = spec.baseline;
    // flat ranges short-circuit to mid-ramp in toT; the baseline path must
    // not activate against the synthetic +1 bound (flat) either.
    var toTb = (cols.length >= 3 && base != null && !flat && base > lo && base < hi)
      ? function (v) {
        var raw = v <= base ? 0.5 * (v - lo) / (base - lo) : 0.5 + 0.5 * (v - base) / (hi - base);
        raw = Math.max(0, Math.min(1, raw));
        if (spec.steps > 1) raw = Math.round(raw * (spec.steps - 1)) / (spec.steps - 1);
        return raw;
      }
      : toT;
    var baselineActive = toTb !== toT;
    return {
      lo: lo, hi: hi, cols: cols,
      flat: flat,
      // whether low values actually map to the saturated end — the legend
      // reverses its swatch row on this, not on spec.good alone (a
      // diverging baseline bypasses the good flip: "baseline wins").
      flipped: spec.good === 'low' && !baselineActive,
      color: function (v) { return rgbStr(at(toTb(v))); },
      swatch: function (t) { return rgbStr(at(t)); },
    };
  }

  // Stack colliding tags into vertical lanes so neighbouring elements'
  // value labels don't overlap. Each rect gets a .tag {cx, ty}.
  function layoutTags(rects) {
    var W = 44, H = 14, GAP = 4, LANE = H + GAP;
    var sorted = rects.slice().sort(function (a, b) { return (a.y - b.y) || (a.x - b.x); });
    var placed = [];
    sorted.forEach(function (r) {
      var cx = r.x + r.w / 2, below = r.y < 60, lane = 0;
      while (lane < 8) {
        var ty = below ? r.y + r.h + GAP + lane * LANE : r.y - H - GAP - lane * LANE;
        var hit = placed.some(function (p) { return Math.abs(p.cx - cx) < W && Math.abs(p.ty - ty) < H; });
        if (!hit || lane === 7) { r.tag = { cx: cx, ty: ty }; placed.push({ cx: cx, ty: ty }); break; }
        lane++;
      }
    });
  }

  // Deterministic collision layout for callout cards. Pure: same inputs →
  // same output, every render. items: [{id, ax, ay, aw, ah, cw, ch, gap,
  // dx, dy, place, fixed, order}] (a* = anchor rect, c* = card size,
  // order = elements-array index). Returns {id: {x, y}}.
  //
  // Fixed cards (author set place/dx/dy) are placed first at their explicit
  // spot and never move; the rest are swept in (anchor.top, anchor.left,
  // order) order, each taking the first free candidate from a fixed
  // preference list — below, above, right, left — preferring positions
  // that don't cover another callout's anchor, then shifting down past the
  // lowest conflicting card. Everything clamps inside the stage.
  function layoutCallouts(items, sw, sh, avoid) {
    var M = 8, out = Object.create(null), placed = [];
    avoid = avoid || [];
    function clamp(x, y, cw, ch) {
      return { x: Math.max(8, Math.min(x, sw - cw - 8)),
        y: Math.max(4, Math.min(y, sh - ch - 4)) };
    }
    function overlaps(x, y, w, h, p, m) {
      return x < p.x + p.w + m && p.x < x + w + m && y < p.y + p.h + m && p.y < y + h + m;
    }
    function hit(x, y, w, h) {
      for (var i = 0; i < placed.length; i++) if (overlaps(x, y, w, h, placed[i], M)) return placed[i];
      return null;
    }
    function subjectRects(selfId) {
      var rs = [];
      for (var a = 0; a < items.length; a++) {
        var o = items[a];
        if (o.id !== selfId) rs.push({ x: o.ax, y: o.ay, w: o.aw, h: o.ah });
      }
      return rs.concat(avoid);
    }
    function covers(x, y, w, h, selfId) {
      var rs = subjectRects(selfId);
      for (var v = 0; v < rs.length; v++) if (overlaps(x, y, w, h, rs[v], 0)) return true;
      return false;
    }
    // Area-weighted damage: how much of each subject this spot obliterates.
    // Covering a sliver of a big wash scores low; blotting out a small
    // button scores ~1. Used to pick the least-bad spot when every spot
    // covers something.
    function damage(x, y, w, h, selfId) {
      var rs = subjectRects(selfId), d = 0;
      for (var v = 0; v < rs.length; v++) {
        var r = rs[v];
        var ow = Math.min(x + w, r.x + r.w) - Math.max(x, r.x);
        var oh = Math.min(y + h, r.y + r.h) - Math.max(y, r.y);
        if (ow > 0 && oh > 0) d += (ow * oh) / Math.max(1, r.w * r.h);
      }
      return d;
    }
    var sorted = items.slice().sort(function (a, b) {
      return (a.ay - b.ay) || (a.ax - b.ax) || (a.order - b.order);
    });
    function put(it, x, y) {
      out[it.id] = { x: x, y: y };
      placed.push({ x: x, y: y, w: it.cw, h: it.ch });
    }
    // fixed first — author overrides anchor the sweep
    for (var f = 0; f < sorted.length; f++) {
      var it = sorted[f]; if (!it.fixed) continue;
      var fy = it.place === 'above' ? it.ay - it.gap - it.ch : it.ay + it.ah + it.gap;
      var fp = clamp(it.ax + (it.dx || 0), fy, it.cw, it.ch);
      put(it, fp.x, fp.y);
    }
    for (var i = 0; i < sorted.length; i++) {
      var c = sorted[i]; if (c.fixed) continue;
      var cands = [
        { x: c.ax, y: c.ay + c.ah + c.gap },            // below
        { x: c.ax, y: c.ay - c.gap - c.ch },            // above
        { x: c.ax + c.aw + 10, y: c.ay },               // right
        { x: c.ax - c.cw - 10, y: c.ay },               // left
      ].map(function (p) { return clamp(p.x, p.y, c.cw, c.ch); });
      // shift-down walk from below-anchor, past conflicting cards
      function walk(wantClean) {
        var y = c.ay + c.ah + c.gap, n = 0;
        while (n++ < 24) {
          var cp = clamp(c.ax, y, c.cw, c.ch);
          var conf = hit(cp.x, cp.y, c.cw, c.ch);
          if (!conf && (!wantClean || !covers(cp.x, cp.y, c.cw, c.ch, c.id))) return cp;
          if (cp.y >= sh - c.ch - 4) return null;  // hit the floor
          y = (conf ? conf.y + conf.h : cp.y + c.ch) + M;
        }
        return null;
      }
      var chosen = null, k;
      // 1) a candidate free of cards AND of every subject rect
      for (k = 0; k < cands.length && !chosen; k++) {
        var p1 = cands[k];
        if (!hit(p1.x, p1.y, c.cw, c.ch) && !covers(p1.x, p1.y, c.cw, c.ch, c.id)) chosen = p1;
      }
      // 2) a clean spot further down beats covering someone's element
      if (!chosen) chosen = walk(true);
      // 3) every spot covers something (subjects tile the stage) — take
      // the card-free spot that obliterates the least, area-weighted
      // (ties resolve in preference order, keeping this deterministic)
      if (!chosen) {
        var walked = walk(false);
        var pool = cands.concat(walked ? [walked] : []);
        var best = null, bestD = Infinity;
        for (k = 0; k < pool.length; k++) {
          var p3 = pool[k];
          if (hit(p3.x, p3.y, c.cw, c.ch)) continue;
          var d3 = damage(p3.x, p3.y, c.cw, c.ch, c.id);
          if (d3 < bestD - 1e-9) { best = p3; bestD = d3; }
        }
        chosen = best;
      }
      // 4) clamped last resort
      if (!chosen) chosen = clamp(c.ax, c.ay + c.ah + c.gap, c.cw, c.ch);
      put(c, chosen.x, chosen.y);
    }
    return out;
  }

  // The one "talk to the agent" button. Plain text, no icon, not bold —
  // the settled ask-chip idiom. busy → muted "Asked — Claude's on it"
  // (clicking that reverts the waiting state).
  function askBtn(busy) {
    return '<button type="button" class="dv-ask" data-ask' +
      (busy ? ' data-busy' : '') + '>' +
      (busy ? 'Asked — Claude\u2019s on it' : 'Ask Claude to fetch metrics') + '</button>';
  }

  var CSS =
    // Default (controls off) is a true passthrough: no padding, no chrome —
    // the wrapped UI renders byte-identical to having no wrapper at all.
    // font/colour live on the controls=on state, not :host — headless the
    // wrapped UI must inherit exactly what it would without the wrapper
    // (every shadow part declares its own font, so nothing inside needs it).
    ':host{display:block}' +
    // Text colors fall back to currentColor (the page's own inherited
    // text color) rather than a hardcoded light-theme ink, so the header
    // stays legible on hosts that define no theme tokens — dark included.
    ':host([controls=on]){padding:18px 20px;font-family:var(--font-ui,-apple-system,BlinkMacSystemFont,sans-serif);color:var(--text-primary,currentColor)}' +
    // sentence control — the serif clickable-sentence idiom
    '.dv-sent{display:none;font:420 19px/1.55 var(--font-display,ui-serif,Georgia,serif);letter-spacing:-0.2px;color:var(--text-secondary,color-mix(in srgb,currentColor 64%,transparent));margin:0 0 14px}' +
    ':host([controls=on]) .dv-sent{display:block}' +
    '.dv-tok{position:relative;display:inline-block;color:var(--text-primary,currentColor);border-bottom:1.5px dotted var(--border-strong,color-mix(in srgb,currentColor 32%,transparent));padding:0 2px 1px;cursor:default}' +
    '.dv-tok:hover{border-bottom-color:currentColor}' +
    '.dv-tcar{font-size:10px;margin-left:3px;color:var(--text-tertiary,color-mix(in srgb,currentColor 48%,transparent))}' +
    // segment menu — editorial: serif, warm surface, hairline rules; part
    // of the prose, not a form control. Plain positioned divs (no Popover
    // API) so it stays screenshottable and inside the shadow tree.
    '.dv-tok.dv-int{cursor:pointer}' +
    '.dv-tok.dv-int:focus-visible{outline:2px solid rgba(198,93,59,.55);outline-offset:2px;border-radius:3px}' +
    '.dv-menu{position:absolute;left:-8px;top:calc(100% + 8px);min-width:232px;background:var(--bg-surface,#FDFBF6);border:1px solid rgba(15,12,8,.13);border-radius:12px;box-shadow:0 12px 36px rgba(15,12,8,.16),0 2px 8px rgba(15,12,8,.06);padding:6px;z-index:130;white-space:nowrap;text-align:left;font:420 16.5px/1.45 var(--font-display,ui-serif,Georgia,serif);letter-spacing:-0.15px;color:var(--text-primary,rgba(15,12,8,.92))}' +
    '.dv-mi{display:block;padding:7px 12px;border-radius:8px;cursor:pointer}' +
    '.dv-mi:hover,.dv-mi:focus{background:rgba(217,119,87,.09);outline:none}' +
    // the current option reads by ink alone: a touch more weight, no marks
    '.dv-mi.dv-cur{font-weight:600}' +
    '.dv-mdiv{height:1px;margin:6px 10px;background:rgba(15,12,8,.09)}' +
    // free-type row — serif input whose placeholder rotates through
    // suggested cuts; Enter / the pill pre-fills the chat for exactly
    // what was typed (same consent path, never auto-sent)
    '.dv-min{position:relative;padding:4px 6px 3px}' +
    // quiet submit pill — mini version of the fetch pill's language, in
    // roman, no icons; appears only once the box is non-empty
    '.dv-mgo{position:absolute;right:12px;top:50%;transform:translateY(-50%);display:none;height:20px;padding:0 9px;border:0;border-radius:6px;background:var(--accent-primary,#D97757);color:#fff;font:400 11.5px/1 var(--font-ui,-apple-system,sans-serif);cursor:pointer}' +
    '.dv-mgo:hover{filter:brightness(0.94)}' +
    '.dv-min[data-filled] .dv-mgo{display:inline-flex;align-items:center}' +
    '.dv-min[data-filled] .dv-minp{padding-right:46px}' +
    '.dv-minp{width:100%;box-sizing:border-box;font:420 15.5px/1.4 var(--font-display,ui-serif,Georgia,serif);letter-spacing:-0.1px;color:var(--text-primary,rgba(15,12,8,.92));background:rgba(15,12,8,.03);border:1px solid rgba(15,12,8,.10);border-radius:8px;padding:6px 10px;outline:none}' +
    '.dv-minp:focus{border-color:rgba(198,93,59,.45);background:var(--bg-surface,#fff)}' +
    '.dv-minp[aria-invalid]{border-color:rgba(220,38,38,.55)}' +
    '.dv-minp::placeholder{color:rgba(15,12,8,.35);opacity:1;transition:opacity .35s ease}' +
    '.dv-minp.dv-phfade::placeholder{opacity:0}' +
    '.dv-minp::selection{background:rgba(217,119,87,.28)}' +
    // the ask button — plain, not bold, no icon (the one chat round-trip)
    '.dv-ask{display:inline-flex;align-items:center;justify-content:center;height:26px;padding:0 11px;margin-left:8px;border:0;border-radius:8px;background:var(--accent-primary,#D97757);color:#fff;font:400 12.5px/1 var(--font-ui,-apple-system,sans-serif);cursor:default;vertical-align:2px}' +
    '.dv-ask:not([data-busy]):hover{filter:brightness(0.94)}' +
    '.dv-ask[data-busy]{background:rgba(15,12,8,.08);color:var(--text-secondary,rgba(15,12,8,.64))}' +
    // stage + paint layer
    '.dv-stage{position:relative}' +
    ':host([controls=on]) .dv-stage{background:var(--bg-surface,#fff);border:1px solid var(--border-subtle,rgba(15,12,8,.08));border-radius:14px;box-shadow:var(--shadow-sm,0 1px 3px rgba(20,20,19,.06));overflow:hidden}' +
    '.dv-layer{position:absolute;inset:0;pointer-events:none;z-index:100}' +
    // waiting / doesn't-answer states
    '@keyframes dv-shimmer{from{background-position:200% 0}to{background-position:-200% 0}}' +
    ':host([data-state=loading]) .dv-layer{background:linear-gradient(90deg,rgba(15,12,8,.02) 0%,rgba(15,12,8,.07) 50%,rgba(15,12,8,.02) 100%);background-size:200% 100%;animation:dv-shimmer 1.4s linear infinite}' +
    '@media (prefers-reduced-motion:reduce){:host([data-state=loading]) .dv-layer{animation:none}}' +
    ':host([data-state=stale]) .dv-layer{opacity:.6;background:repeating-linear-gradient(45deg,rgba(15,12,8,.04) 0 6px,transparent 6px 12px)}' +
    // paint vocabulary
    '.dv-box{position:absolute;border-radius:6px}' +
    '.dv-wash{position:absolute;inset:-1px;border-radius:inherit;mix-blend-mode:multiply;opacity:.85}' +
    '.dv-wash.nil{background:repeating-linear-gradient(45deg,rgba(15,12,8,.10) 0 4px,transparent 4px 8px);outline:1px dashed rgba(15,12,8,.25);mix-blend-mode:normal}' +
    '.dv-tag{position:absolute;transform:translateX(-50%);min-width:28px;padding:2px 5px;border-radius:5px;color:#fff;font:700 9.5px/1 var(--font-ui,-apple-system,sans-serif);font-variant-numeric:tabular-nums;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.2);white-space:nowrap}' +
    // delta suffix — direction of change only; the comparison basis lives
    // in the legend row, never red/green inside a ramp-coloured tag
    '.dv-d{margin-left:4px;font-weight:600;opacity:.85}' +
    '.dv-spot{position:absolute;border:1.5px solid;border-radius:7px;box-sizing:border-box}' +
    // callout card + leader + numbered pin
    '.dv-co{position:absolute;width:200px;padding:9px 11px;background:var(--bg-surface,#fff);border-radius:10px;box-shadow:0 4px 16px rgba(15,12,8,.16);white-space:normal;z-index:103;pointer-events:auto}' +
    '.dv-coh{display:block;font:550 12px/1.3 var(--font-ui,-apple-system,sans-serif);color:var(--text-primary,rgba(15,12,8,.92));margin-bottom:3px}' +
    '.dv-cob{display:block;font:400 11px/1.4 var(--font-ui,-apple-system,sans-serif);color:var(--text-tertiary,rgba(15,12,8,.48))}' +
    '.dv-coleads{position:absolute;left:0;top:0;pointer-events:none;z-index:102}' +
    '.dv-colead{stroke:rgba(15,12,8,.45);stroke-width:1;opacity:.6}' +
    '.dv-pin{position:absolute;min-width:18px;height:18px;padding:0 4px;box-sizing:border-box;border-radius:9px;color:#fff;font:600 10px/18px var(--font-ui,-apple-system,sans-serif);text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.2);z-index:110}' +
    '.dv-pin.inl{position:static;display:inline-block;margin-right:6px;vertical-align:-1px;box-shadow:none}' +
    // hover-to-isolate: hovering a subject fades every other callout
    '.dv-co,.dv-colead{transition:opacity .12s ease-out}' +
    '.dv-layer[data-iso] .dv-co:not([data-hot]),.dv-layer[data-iso] .dv-colead:not([data-hot]){opacity:0}' +
    // meta subtitle — the data's own provenance (range · volume · about),
    // under the sentence row; renders only with controls on, and only when
    // the view carries meta
    '.dv-meta{display:none;font:400 11.5px/1.4 var(--font-ui,-apple-system,sans-serif);color:var(--text-tertiary,color-mix(in srgb,currentColor 55%,transparent));margin:-8px 0 14px}' +
    ':host([controls=on]) .dv-meta:not(:empty){display:block}' +
    // finding — the story's lead line: the takeaway reads FIRST, the stage
    // backs it up
    '.dv-finding{font:420 16.5px/1.5 var(--font-display,ui-serif,Georgia,serif);color:var(--text-primary,currentColor);padding:0 2px 12px;margin:0}' +
    '.dv-finding:empty{display:none;padding:0}' +
    // legend row — ramp swatches + the view's basis (the denominator
    // travels with the picture)
    '.dv-legend{display:flex;align-items:center;flex-wrap:wrap;gap:10px 18px;padding:10px 2px 0;font:400 11.5px/1.4 var(--font-ui,-apple-system,sans-serif);color:var(--text-secondary,rgba(15,12,8,.64))}' +
    '.dv-legend:empty{display:none;padding:0}' +
    '.dv-li{display:inline-flex;align-items:center;gap:7px}' +
    '.dv-lsw{width:13px;height:13px;border-radius:3px;display:inline-block}' +
    '.dv-basis{color:var(--text-tertiary,rgba(15,12,8,.48))}' +
    '.dv-basis.warn{color:#B0761A}' +
    '.dv-empty{position:absolute;inset:0;display:grid;place-items:center;font:500 13px/1.4 var(--font-ui,-apple-system,sans-serif);color:var(--text-tertiary,rgba(15,12,8,.48));text-align:center;padding:20px}';

  // Mirror of the host prompt builder's phrase() validator (sentence
  // field values: short plain phrases). The typed ask enforces this
  // client-side so the component never renders a cut — or arms the 90s
  // waiting state — for a field the host validator would silently drop
  // from the built prompt (same principle as the refresh degrade in
  // _ask: never arm a wait the arriving reload can't clear).
  function phraseOk(s) {
    return typeof s === 'string' && /^[\w ,.%+/&()'-]{1,64}$/.test(s);
  }

  function safeAttrName(a) {
    // The tracked-attribute name is interpolated into querySelectorAll and
    // the MutationObserver filter — gate it to a bare attribute-name shape
    // so a hostile id-attr can't become selector syntax.
    return typeof a === 'string' && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(a) ? a : 'data-metric-id';
  }

  class DataOverlay extends HTMLElement {
    static get observedAttributes() { return ['src', 'id-attr', 'controls']; }

    constructor() {
      super();
      var root = this.attachShadow({ mode: 'open' });
      root.innerHTML = '<style>' + CSS + '</style>' +
        '<div class="dv-sent" part="sentence"></div>' +
        '<div class="dv-meta" part="meta"></div>' +
        '<p class="dv-finding" part="finding"></p>' +
        '<div class="dv-stage" part="stage"><slot></slot><div class="dv-layer"></div></div>' +
        '<div class="dv-legend" part="legend"></div>';
      this._sent = root.querySelector('.dv-sent');
      this._meta = root.querySelector('.dv-meta');
      this._stage = root.querySelector('.dv-stage');
      this._layer = root.querySelector('.dv-layer');
      this._finding = root.querySelector('.dv-finding');
      this._legend = root.querySelector('.dv-legend');
      this._views = [];
      this._rects = [];
      this._faded = new Map();
      this._metaBits = null;
      this._loadGen = 0;
      this._isoId = null;
      this._viewId = '';
      // The sentence combination the user asked for that no view answers —
      // null whenever the active view answers the sentence.
      this._want = null;
      var self = this;
      // sentence delegated handlers (survive _renderSentence rebuilds)
      this._sent.addEventListener('click', function (e) {
        var mi = e.target.closest('[data-mi]');
        if (mi) { self._menuPick(mi); return; }
        // menu interior (the type box, its pill) handles itself — without
        // this, a click into the box falls through to the token toggle
        // below and closes the menu
        if (e.target.closest('.dv-menu')) return;
        var tokEl = e.target.closest('[data-tok]');
        if (tokEl) { self._tokOpen(tokEl); return; }
        if (!e.target.closest('[data-ask]')) return;
        // Clicking the muted "Asked…" chip reverts immediately (the chat
        // turn is already in flight — nothing to abort; this is the "I
        // changed my mind" / "it's been a while" reset).
        if (self.getAttribute('data-state') === 'loading') { self._revert(); return; }
        // No views at all is a 'missing' ask (author the first view) — a
        // 'refresh' needs an existing view to re-run.
        self._ask(self._want || !self._views.length ? 'missing' : 'refresh');
      });
      this._sent.addEventListener('keydown', function (e) {
        var tokEl = e.target.closest && e.target.closest('[data-tok]');
        if (!tokEl || e.target.closest('.dv-menu')) return;
        var open = tokEl.querySelector('.dv-menu');
        if (e.key === 'Escape') {
          if (open) { e.preventDefault(); self._closeMenu(true); }
          return;
        }
        if (e.key === 'ArrowDown' && open) {
          // into the menu, like a native select
          e.preventDefault();
          var first = open.querySelector('[data-mi]') || open.querySelector('.dv-minp');
          if (first) first.focus();
          return;
        }
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
          e.preventDefault();
          if (open) self._closeMenu(true);
          else self._openMenu(tokEl.getAttribute('data-tok'), tokEl, true);
        }
      });
      this._stage.addEventListener('mousemove', function (e) { self._isolate(e); });
      this._stage.addEventListener('mouseleave', function () { self._isolate(null); });
      this.addEventListener('overlay:reload', function () { self._load(); });
    }

    connectedCallback() {
      var self = this;
      // Positioning engine — slotted light-DOM rects, re-measured on any
      // mutation/resize. A single rAF isn't enough for late-mounting
      // content (popovers, transitions): the MutationObserver fires but on
      // that first frame new nodes are still sub-2px. So each schedule also
      // runs a short trailing chain while anything is still under-size.
      var schedule = this._schedule = function () {
        cancelAnimationFrame(self._raf); clearTimeout(self._trail);
        self._retries = 0;
        self._raf = requestAnimationFrame(function () { self._measure(); });
        self._trail = setTimeout(function trail() {
          if (self._measure() && self._retries < 3) { self._retries++; self._trail = setTimeout(trail, 80); }
        }, 80);
      };
      this._observe();
      this._ro = new ResizeObserver(schedule);
      this._ro.observe(this._stage);
      window.addEventListener('resize', this._onWin = schedule);
      // Host-pushed reload (the agent rewrote the data file in place).
      window.addEventListener('message', this._onMsg = function (e) {
        if (e.data && e.data.type === 'overlay:reload') self._load();
      });
      var n = 0; this._burst = setInterval(function () { self._measure(); if (++n > 12) clearInterval(self._burst); }, 120);
      this._load();
      this._render();
    }

    disconnectedCallback() {
      this._faded.forEach(function (orig, el) { el.style.opacity = orig; });
      this._faded = new Map();
      if (this._mo) this._mo.disconnect();
      if (this._ro) this._ro.disconnect();
      window.removeEventListener('resize', this._onWin);
      window.removeEventListener('message', this._onMsg);
      clearInterval(this._burst);
      cancelAnimationFrame(this._raf);
      clearTimeout(this._trail);
      clearTimeout(this._askT);
      // an open menu holds a placeholder interval and a capture-phase
      // document click listener — tear both down with the element
      this._closeMenu();
      if (this._scriptEl) this._scriptEl.remove();
      this._loadGen++;
    }

    attributeChangedCallback(name, prev, next) {
      if (!this.shadowRoot || prev === next) return;
      if (name === 'src') this._load();
      else if (name === 'id-attr') { this._observe(); this.measure(); }
      else this._render();
    }

    // (Re)attach the MutationObserver — the attribute filter bakes in the
    // tracked attribute name, so an id-attr change needs a fresh observer.
    _observe() {
      if (this._mo) this._mo.disconnect();
      if (!this._schedule) return;
      this._mo = new MutationObserver(this._schedule);
      this._mo.observe(this, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class', this._idAttr()] });
    }

    _idAttr() { return safeAttrName(this.getAttribute('id-attr')); }

    get views() { return this._views; }
    setViews(data) {
      this._views = Array.isArray(data) ? data : (data && Array.isArray(data.views)) ? data.views : [];
      this._suggest = !Array.isArray(data) && data && data.suggest && typeof data.suggest === 'object' ? data.suggest : null;
      this._render();
      return this;
    }
    // Active view id — a property, not an attribute: the embedding page or
    // host pins it programmatically; the sentence control sets it on
    // switch. Defaults to the first view in the file.
    get view() { var a = this._active(); return a ? a.id : ''; }
    set view(id) {
      this._viewId = String(id == null ? '' : id);
      this._want = null;
      clearTimeout(this._askT);
      if (this.getAttribute('data-state') === 'loading') this._setState('');
      this._render();
    }
    measure() { if (this._schedule) this._schedule(); else this._measure(); return this; }

    _active() {
      if (!this._views.length) return null;
      for (var i = 0; i < this._views.length; i++) if (this._views[i].id === this._viewId) return this._views[i];
      return this._views[0];
    }

    // A view's effective sentence triple. metric falls back to the view's
    // label/id so every view is reachable from the sentence; cohort and
    // window stay blank unless authored.
    _tripleOf(S) {
      var s = S.sentence || {};
      return {
        metric: String(s.metric || S.label || S.id || ''),
        cohort: String(s.cohort || ''),
        window: String(s.window || ''),
      };
    }

    _matchView(t) {
      for (var i = 0; i < this._views.length; i++) {
        var c = this._tripleOf(this._views[i]);
        if (c.metric === t.metric && c.cohort === t.cohort && c.window === t.window) return this._views[i];
      }
      return null;
    }

    // The closest authored view for a metric: the one matching the most
    // of the remaining segments (cohort, window); ties go to file order.
    // Null when no view authors the metric (a pending want's metric, say)
    // — the caller falls through to the ask path.
    _snapToMetric(metric, t) {
      var best = null, bestScore = -1;
      for (var i = 0; i < this._views.length; i++) {
        var c = this._tripleOf(this._views[i]);
        if (c.metric !== metric) continue;
        var score = (c.cohort === t.cohort ? 1 : 0) + (c.window === t.window ? 1 : 0);
        if (score > bestScore) { best = this._views[i]; bestScore = score; }
      }
      return best;
    }

    // A sentence segment changed. An authored combination switches views
    // client-side, instantly; anything else is a "want" — the stage goes
    // stale and the ask button appears. No client-side re-slicing, ever.
    // The metric segment is navigation: when no view answers the exact
    // combination, it snaps to that metric's closest authored view and
    // the sentence re-renders that view's full cohort + window. Cohort
    // and window are promises about the data, so they stay exact-match —
    // the only honest answer to an unauthored one is the ask turn.
    _pick(k, val) {
      var cur = this._want || this._tripleOf(this._active() || {});
      var t = { metric: cur.metric, cohort: cur.cohort, window: cur.window };
      t[k] = val;
      var hit = this._matchView(t);
      if (!hit && k === 'metric') hit = this._snapToMetric(val, t);
      // Moving the sentence abandons any in-flight ask — the turn may
      // still land (the reload handles it), but the UI follows the user.
      clearTimeout(this._askT);
      if (this.getAttribute('data-state') === 'loading') this._setState('');
      if (hit) { this._viewId = hit.id; this._want = null; }
      else this._want = t;
      this._render();
    }

    _load() {
      if (!this.isConnected) return;
      var src = this.getAttribute('src');
      var gen = ++this._loadGen, self = this;
      var done = function (got) {
        if (gen !== self._loadGen) return;
        // null = "nothing loaded" (no src, fetch failure) — keep whatever
        // is already set so setViews() before mount, and remounts, aren't
        // silently wiped.
        if (got != null) {
          self._views = Array.isArray(got) ? got : Array.isArray(got.views) ? got.views : [];
          // optional: Claude may author suggested cuts per sentence field
          // ({suggest: {window: [...], cohort: [...]}}) — rotated through
          // the ghost free-type row's placeholder, never shown as rows
          self._suggest = !Array.isArray(got) && got.suggest && typeof got.suggest === 'object' ? got.suggest : null;
          // A fresh file landing while the ask shimmer runs is the answer
          // arriving: a refresh rewrote the active view in place, or
          // _adopt() below switches to a new view matching the want.
          self._adopt();
          if (!self._want && self.getAttribute('data-state') === 'loading') {
            clearTimeout(self._askT);
            self._setState('');
          }
        }
        self._render();
      };
      if (!src) return done(null);
      var abs; try { abs = new URL(src, document.baseURI).href; } catch (e) { abs = src; }
      if (/\.json([?#]|$)/i.test(src)) {
        fetch(abs, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(done).catch(function () { done(null); });
      } else {
        var cur = window.__overlays;
        if (!this._views.length && cur && cur.__src === src) return done(cur);
        var pre = cur;
        window.__overlays = undefined;
        if (this._scriptEl) this._scriptEl.remove();
        var s = document.createElement('script');
        s.src = abs + (abs.indexOf('?') < 0 ? '?' : '&') + 't=' + Date.now();
        s.onload = function () {
          var got = window.__overlays;
          if (got) got.__src = src;
          done(got);
        };
        s.onerror = function () {
          if (gen !== self._loadGen) return;
          if (pre != null && window.__overlays === undefined) window.__overlays = pre;
          done(self._views.length ? self._views : pre || null);
        };
        this._scriptEl = s;
        try { document.head.appendChild(s); } catch (e) { done(null); }
      }
    }

    // After a reload, a pending want that a new view now answers adopts
    // that view — the asked-for combination became real.
    _adopt() {
      if (!this._want) return;
      var hit = this._matchView(this._want);
      if (!hit) return;
      this._viewId = hit.id;
      this._want = null;
      clearTimeout(this._askT);
      this._setState('');
    }

    _setState(s) {
      if (s) this.setAttribute('data-state', s);
      else this.removeAttribute('data-state');
    }

    // Resting state from current data: a want no view answers = stale; a
    // src that produced no views = empty; otherwise clean. Never demotes
    // an in-flight 'loading' — only _revert()/_adopt()/_load() end that.
    _restState() {
      if (this.getAttribute('data-state') === 'loading') return;
      if (this._want) this._setState('stale');
      else if (!this._views.length && this.getAttribute('src')) this._setState('empty');
      else this._setState('');
    }

    _revert() {
      clearTimeout(this._askT);
      this._setState('');
      this._restState();
      this._renderSentence();
    }

    // The ONE host round-trip. mode 'refresh' re-runs the active view's
    // recorded source; mode 'missing' asks for a view answering the
    // sentence combination no authored view matches. The host rebuilds the
    // chat turn from the structured fields — fallbackPrompt is a courtesy
    // for hosts without a builder, not a trusted instruction channel.
    _ask(mode) {
      var src = this.getAttribute('src') || '';
      var active = this._active();
      var vid = active ? String(active.id) : '';
      var want = this._want ? { metric: this._want.metric, cohort: this._want.cohort, window: this._want.window } : null;
      // A refresh needs a host-valid view id ([\w.-], ≤64). A view with an
      // odd authored id degrades to a missing-mode ask carrying its
      // sentence triple — the button must never arm a wait the host will
      // drop on arrival.
      if (mode === 'refresh' && !(active && /^[\w.-]{1,64}$/.test(vid))) {
        mode = 'missing';
        if (!want && active) want = this._tripleOf(active);
      }
      var fallbackPrompt;
      if (mode === 'refresh') {
        fallbackPrompt = 'Refresh view "' + vid + '" in ' + (src || 'the overlay data file') +
          ': re-run that view\'s recorded source query (its \'source\' field) for the same population and window, re-anchored to today; rewrite the view in place with fresh values, a new asOf, and recomputed meta (date range, row count, and a short plain-words \'about\' describing the data cut); after the values are written, update the view\'s \'finding\' to the takeaway the fresh numbers support; leave every other view unchanged; then reload the overlay.';
      } else {
        var w = want || { metric: '', cohort: '', window: '' };
        fallbackPrompt = 'Add a view to ' + (src || 'the overlay data file') + ' answering: ' +
          (w.metric ? 'metric "' + w.metric + '"' : 'the current question') +
          (w.cohort ? ' for cohort "' + w.cohort + '"' : '') +
          (w.window ? ' over "' + w.window + '"' : '') +
          '. Compute real numbers from the analytics source (never invent values), record the query in the view\'s \'source\' field, include basis, asOf, and meta (the data\'s date range, row count, and a short plain-words \'about\' describing the data cut), and — after the values are computed — a one-sentence \'finding\' derived from those numbers, then reload the overlay.';
      }
      var msg = { type: 'data-overlay:fetch', src: src, mode: mode, view: vid, want: want, fallbackPrompt: fallbackPrompt };
      try { window.parent.postMessage(msg, '*'); } catch (e) {}
      this.dispatchEvent(new CustomEvent('data-overlay:fetch', { detail: msg, bubbles: true, composed: true }));
      this._setState('loading');
      this._renderSentence();
      // Cap the waiting state — if the chat turn errors or never rewrites
      // the file, the shimmer would run forever. 90s, then back to stale.
      clearTimeout(this._askT);
      var self = this;
      this._askT = setTimeout(function () {
        if (self.getAttribute('data-state') === 'loading') self._revert();
      }, 90000);
    }

    // ───────────────────── the segment menu ─────────────────────
    // Each sentence segment opens an editorial menu: the authored views'
    // values for that field (the current one a touch heavier — marked by
    // ink alone), a hairline, then a free-type row whose placeholder
    // rotates through suggested cuts — the data file's optional 'suggest'
    // field when authored, generic per-field fallbacks otherwise. Picking
    // an authored option switches views client-side; submitting typed
    // text (Enter or the ask pill) goes through _ask('missing') → the
    // host pre-fills the chat composer and the user's Send is the
    // consent — NEVER auto-submitted. The menu is a plain positioned div
    // inside the shadow tree (no Popover API / top layer), and carries
    // the keyboard behavior the native selects this replaced had for
    // free: arrows move through options into the type box, Enter picks,
    // Escape closes and hands focus back to the segment.

    // Distinct authored values of one sentence field (blank joins only
    // when mixed, so every authored view stays reachable).
    _optsFor(k) {
      var self = this;
      var seen = Object.create(null), out = [], blank = false;
      var triples = this._views.map(function (v) { return self._tripleOf(v); });
      for (var i = 0; i < triples.length; i++) {
        var v = triples[i][k];
        if (!v) { blank = true; continue; }
        if (!seen[v]) { seen[v] = 1; out.push(v); }
      }
      if (blank && out.length) out.push('');
      return out;
    }

    _tryLabel(k) {
      return k === 'window' ? 'try another range…' :
        k === 'metric' ? 'try a different metric…' : 'try a different cut…';
    }

    // The free-type row: an exact authored match switches instantly;
    // anything else pre-fills the chat for exactly that cut.
    _wireMenuInput(inp, k) {
      var self = this;
      var row = inp.parentNode;
      var refocus = function () {
        var tk = self._sent.querySelector('[data-tok="' + k + '"]');
        if (tk) tk.focus({ preventScroll: true });
      };
      var go = function () {
        // normalize the auto-substitutions mobile keyboards make (curly
        // quotes, long dashes) into the host charset before validating
        var typed = inp.value.replace(/[‘’‛]/g, "'")
          .replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 64);
        if (!typed) return;
        var opts = self._optsFor(k), hit = null;
        for (var i = 0; i < opts.length; i++) if (opts[i].toLowerCase() === typed.toLowerCase()) hit = opts[i];
        if (hit) { self._closeMenu(); self._pick(k, hit); refocus(); return; }
        // A phrase the host validator would drop must not fire: the
        // built prompt would lose the typed field, while the sentence
        // renders the cut and arms the 90s shimmer for a want no reload
        // is likely to answer. Flag the box and keep focus for editing.
        if (!phraseOk(typed)) {
          inp.setAttribute('aria-invalid', 'true');
          inp.focus();
          return;
        }
        self._closeMenu();
        var cur = self._want || self._tripleOf(self._active() || {});
        var t = { metric: cur.metric, cohort: cur.cohort, window: cur.window };
        t[k] = typed;
        self._want = t;
        self._ask('missing');
        self._render();
        refocus();
      };
      inp.addEventListener('input', function () {
        inp.removeAttribute('aria-invalid');
        if (inp.value.trim()) row.setAttribute('data-filled', '');
        else row.removeAttribute('data-filled');
      });
      inp.addEventListener('keydown', function (e) {
        // an Enter that merely commits an IME composition is not a submit
        if (e.isComposing || e.keyCode === 229) return;
        if (e.key === 'Enter') go();
      });
      var btn = row.querySelector('.dv-mgo');
      if (btn) btn.addEventListener('click', function (e) { e.stopPropagation(); go(); });
    }

    // Rotate the free-type row's placeholder through suggested cuts.
    // Suggestions an authored option already answers are skipped, and
    // the rotation never swaps under the user's typing.
    _startPh(inp, k) {
      this._stopPh();
      var opts = this._optsFor(k);
      var authored = this._suggest && Array.isArray(this._suggest[k]) ? this._suggest[k] : null;
      var lowOpts = opts.map(function (o) { return o.toLowerCase(); });
      var list = (authored && authored.length ? authored : DataOverlay._SUGGEST[k] || []).filter(function (s) {
        return typeof s === 'string' && s && lowOpts.indexOf(s.toLowerCase()) < 0;
      });
      if (!list.length) return; // keep the generic _tryLabel placeholder
      inp.placeholder = list[0];
      if (list.length < 2) return;
      var i = 0, self = this;
      this._phT = setInterval(function () {
        if (inp.value) return;
        inp.classList.add('dv-phfade');
        self._phFadeT = setTimeout(function () {
          self._phFadeT = null;
          i = (i + 1) % list.length;
          inp.placeholder = list[i];
          inp.classList.remove('dv-phfade');
        }, 360);
      }, 3200);
    }

    _stopPh() {
      if (this._phT) { clearInterval(this._phT); this._phT = null; }
      // the fade swap is a second, inner timer — a menu closed (or an
      // element removed) mid-fade must not fire against a detached input
      if (this._phFadeT) { clearTimeout(this._phFadeT); this._phFadeT = null; }
    }

    _tokOpen(tokEl) {
      if (tokEl.querySelector('.dv-menu')) { this._closeMenu(); return; }
      this._openMenu(tokEl.getAttribute('data-tok'), tokEl);
    }

    _menuHtml(k) {
      var cur = (this._want || this._tripleOf(this._active() || {}))[k] || '';
      var opts = this._optsFor(k);
      var h = '';
      for (var i = 0; i < opts.length; i++) {
        h += '<div class="dv-mi' + (opts[i] === cur ? ' dv-cur' : '') + '" data-mi tabindex="-1" role="option"' +
          ' aria-selected="' + (opts[i] === cur ? 'true' : 'false') + '" data-k="' + k + '" data-v="' + esc(opts[i]) + '">' +
          (opts[i] ? esc(opts[i]) : '—') + '</div>';
      }
      h += (opts.length ? '<div class="dv-mdiv"></div>' : '') +
        '<div class="dv-min"><input class="dv-minp" type="text" maxlength="64" spellcheck="false" aria-label="ask for a different ' + k + '" placeholder="' + this._tryLabel(k) + '">' +
        '<button type="button" class="dv-mgo">ask</button></div>';
      return h;
    }

    // focusFirst: a keyboard-opened menu moves focus to its first option
    // (falling back to the type box), mirroring a native select.
    _openMenu(k, tokEl, focusFirst) {
      this._closeMenu();
      var m = document.createElement('div');
      m.className = 'dv-menu';
      m.setAttribute('role', 'listbox');
      m.innerHTML = this._menuHtml(k);
      tokEl.appendChild(m);
      tokEl.setAttribute('aria-expanded', 'true');
      this._menuEl = m;
      this._menuTok = tokEl;
      var minp = m.querySelector('.dv-minp');
      if (minp) { this._wireMenuInput(minp, k); this._startPh(minp, k); }
      var self = this;
      m.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { e.stopPropagation(); self._closeMenu(true); return; }
        var items = [].slice.call(m.querySelectorAll('[data-mi]'));
        if (minp) items.push(minp);
        var idx = items.indexOf(e.target);
        if (idx < 0) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); items[Math.min(idx + 1, items.length - 1)].focus(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); items[Math.max(idx - 1, 0)].focus(); }
        else if ((e.key === 'Enter' || e.key === ' ') && e.target !== minp) { e.preventDefault(); self._menuPick(e.target); }
      });
      this._docClose = function (e) {
        if (e.composedPath && e.composedPath().indexOf(self._sent) >= 0) return;
        self._closeMenu();
      };
      document.addEventListener('click', this._docClose, true);
      if (focusFirst) {
        var first = m.querySelector('[data-mi]') || minp;
        if (first) first.focus();
      }
    }

    // refocus: hand focus back to the segment token (keyboard close).
    _closeMenu(refocus) {
      this._stopPh();
      if (this._menuEl && this._menuEl.parentNode) this._menuEl.parentNode.removeChild(this._menuEl);
      this._menuEl = null;
      if (this._menuTok) {
        this._menuTok.setAttribute('aria-expanded', 'false');
        if (refocus && this._menuTok.isConnected) this._menuTok.focus({ preventScroll: true });
        this._menuTok = null;
      }
      if (this._docClose) { document.removeEventListener('click', this._docClose, true); this._docClose = null; }
    }

    _menuPick(mi) {
      var k = mi.getAttribute('data-k');
      var v = mi.getAttribute('data-v');
      this._closeMenu();
      this._pick(k, v);
      // _pick re-rendered the sentence; re-anchor focus on the segment so
      // a keyboard flow isn't dropped (invisible for mouse users —
      // the ring only shows on :focus-visible)
      var tok = this._sent.querySelector('[data-tok="' + k + '"]');
      if (tok) tok.focus({ preventScroll: true });
    }

    _render() {
      this._adopt();
      this._restState();
      this._renderSentence();
      this._renderMeta();
      this._renderLayer();
      this._renderFinding();
      this._renderLegend();
    }

    _renderSentence() {
      this._closeMenu();
      if ((this.getAttribute('controls') || 'off') !== 'on') { this._sent.innerHTML = ''; return; }
      var views = this._views;
      var state = this.getAttribute('data-state');
      if (!views.length) {
        this._sent.innerHTML = 'No data views yet.' +
          (state === 'loading' ? askBtn(true) : this.getAttribute('src') ? askBtn(false) : '');
        return;
      }
      var self = this;
      var active = this._active();
      var cur = this._want || this._tripleOf(active);
      // Each segment is a styled token that opens the segment menu —
      // keyboard-reachable (the native selects this replaced had keys
      // for free): Enter/Space/ArrowDown on a token opens its menu.
      var tok = function (k, val) {
        return '<span class="dv-tok dv-int" data-tok="' + k + '" tabindex="0" role="button"' +
          ' aria-haspopup="listbox" aria-expanded="false" aria-label="' + k + ': ' + (val ? esc(val) : 'none') + '">' +
          (val ? esc(val) : '—') + '<span class="dv-tcar">▾</span></span>';
      };
      var h = 'Showing ' + tok('metric', cur.metric);
      if (this._optsFor('cohort').length) h += ' for ' + tok('cohort', cur.cohort);
      if (this._optsFor('window').length) h += ' over ' + tok('window', cur.window);
      h += '.';
      // The ask button renders for a combination no view answers (stale),
      // while an ask is in flight (muted), and beside a refreshable view.
      if (state === 'loading') h += askBtn(true);
      else if (this._want || (active && active.refreshable)) h += askBtn(false);
      this._sent.innerHTML = h;
    }

    _measure() {
      var sb = this._stage.getBoundingClientRect();
      var idAttr = this._idAttr();
      // Accumulated linear transform from each node up to (excluding) the
      // host, memoized per pass — elements share ancestors. Transforms on
      // or above the host move the paint layer together with the content,
      // so translations need no compensation; a SCALE above the host is a
      // pre-existing limitation shared with the axis-aligned path (screen
      // deltas land in local px either way).
      var host = this, lin = new Map();
      function linUp(node) {
        if (!node || node === host) return null;
        if (lin.has(node)) return lin.get(node);
        var own = null;
        try { own = ownLinear(getComputedStyle(node)); } catch (e) {}
        var up = linUp(node.parentElement);
        var out = (own === false || up === false) ? false
          : !own ? up : !up ? own : mulLin(up, own);
        lin.set(node, out);
        return out;
      }
      // Null-prototype maps everywhere an author-controlled string is a
      // key — a tracked id of '__proto__' on a plain object returns
      // Object.prototype and kills the measure loop.
      var seen = Object.create(null), out = [], skipped = 0;
      var els = this.querySelectorAll('[' + idAttr + ']');
      for (var i = 0; i < els.length; i++) {
        var el = els[i], id = el.getAttribute(idAttr);
        if (!id) continue;
        var r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) { skipped++; continue; }
        // Occlusion — centre covered by a sibling modal/popover inside the
        // overlay? The paint layer sits at one z-index above all slotted
        // content; painting on an occluded element would render on top of
        // the occluder. elementFromPoint ignores the layer (pointer-events:
        // none) and retargets shadow hits to the host.
        var top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        var occ = !!(top && top !== this && top !== el && !el.contains(top) && !top.contains(el) && this.contains(top));
        var cs = null;
        try { cs = getComputedStyle(el); } catch (e) {}
        var tf = null, L = linUp(el);
        if (L && L !== false) {
          // offsetWidth/Height are the untransformed border-box (layout)
          // size — the box the transform applies to.
          var w0 = el.offsetWidth, h0 = el.offsetHeight;
          if (w0 > 0 && h0 > 0) {
            var qo = quadOffset(L, w0, h0);
            tf = { a: L[0], b: L[1], c: L[2], d: L[3], w: w0, h: h0, ox: qo.ox, oy: qo.oy };
          }
        }
        var rect = { id: id, x: r.left - sb.left, y: r.top - sb.top, w: r.width, h: r.height, occluded: occ, rad: cs ? radiusOf(cs) : null, tf: tf };
        var at = seen[id];
        if (at != null) { if (!occ && out[at].occluded) out[at] = rect; continue; }
        seen[id] = out.length;
        out.push(rect);
      }
      var prev = this._rects;
      function tfEq(p, r) {
        if (!p && !r) return true;
        if (!p || !r) return false;
        return Math.abs(p.a - r.a) < 0.001 && Math.abs(p.b - r.b) < 0.001 &&
          Math.abs(p.c - r.c) < 0.001 && Math.abs(p.d - r.d) < 0.001 &&
          p.w === r.w && p.h === r.h &&
          Math.abs(p.ox - r.ox) < 0.5 && Math.abs(p.oy - r.oy) < 0.5;
      }
      var same = prev.length === out.length && out.every(function (r, j) {
        var p = prev[j];
        return p && p.id === r.id && p.occluded === r.occluded && Math.abs(p.x - r.x) < 0.5 && Math.abs(p.y - r.y) < 0.5 && Math.abs(p.w - r.w) < 0.5 && Math.abs(p.h - r.h) < 0.5 && p.rad === r.rad && tfEq(p.tf, r.tf);
      });
      if (!same) { this._rects = out; this._renderLayer(); }
      else this._applyFade();
      return skipped;
    }

    _values(S) {
      var els = S.elements || [], out = [];
      for (var i = 0; i < els.length; i++) if (els[i] && 'value' in els[i]) out.push(els[i].value);
      return out;
    }

    _renderFinding() {
      var S = this._active();
      this._finding.textContent = (S && S.finding) ? String(S.finding) : '';
    }

    // The trust subtitle: the data's own provenance under the sentence
    // row — the date range the data covers, the volume the query
    // returned, and 'about': a short agent-written plain-words
    // description of the exact data cut shown (a phrase, not a table
    // name — "events that led to shared projects", say). Every element
    // is independently optional and invalid values drop per-element —
    // meta is additive garnish, so absence renders nothing (no
    // placeholder, no warning).
    _renderMeta() {
      var S = this._active();
      var m = S && S.meta;
      if (!m || typeof m !== 'object') { this._meta.innerHTML = ''; this._metaBits = null; return; }
      var bits = [];
      // Trimmed before validation: a whitespace-only value is truthy and
      // would otherwise claim a _metaBits slot (suppressing legend text)
      // while rendering nothing.
      var range = typeof m.range === 'string' ? m.range.trim() : '';
      range = /^[\w ,.%+/&()'–—→:-]{1,64}$/.test(range) && /\S/.test(range) ? range : '';
      if (range) bits.push(esc(range));
      // typeof-gated: Number('')===0, Number([])===0, Number(true)===1 —
      // falsy garbage must drop, not render as "0 rows".
      var nOk = typeof m.n === 'number' || (typeof m.n === 'string' && m.n.trim() !== '');
      var nv = Number(m.n);
      if (nOk && isFinite(nv) && nv >= 0) {
        // A present-but-invalid unit drops the whole count element —
        // substituting 'rows' would MISLABEL the number ("users/day"
        // silently becoming "rows"). Only an absent unit defaults.
        // The unit should NAME the thing counted — "card-open events",
        // not "events"; vagueness costs the trust the subtitle exists
        // to earn. Hyphens allowed for exactly that reason.
        var unit = m.unit == null ? 'rows'
          : (typeof m.unit === 'string' && /^[A-Za-z][A-Za-z -]{0,31}$/.test(m.unit) ? m.unit : null);
        if (unit) bits.push(esc(nv >= 1e4 ? fmtN(nv) : String(Math.round(nv)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')) + ' ' + esc(unit));
      }
      var about = typeof m.about === 'string' ? m.about.trim() : '';
      about = /^[\w ,.%+/&()'–—→:;=-]{1,100}$/.test(about) && /\S/.test(about) ? about : '';
      if (about) bits.push(esc(about));
      this._meta.innerHTML = bits.join(' · ');
      // Which elements actually rendered — the legend keys its drops on
      // these, element for element, so partial meta never suppresses
      // provenance that nothing replaced.
      this._metaBits = { range: !!range, about: !!about };
    }

    _renderLegend() {
      var S = this._active();
      if (!S) { this._legend.innerHTML = ''; return; }
      var h = '';
      var vals = this._values(S);
      if (S.legend && S.spectrum && vals.length) {
        var sp = S.spectrum, fmt = fmtOf(sp);
        var rmp = buildRamp(sp, vals);
        var n = sp.steps > 1 ? Math.min(sp.steps, 7) : 4;
        // Swatches read left→right as lo→hi. rmp.flipped (good:'low'
        // actually in effect — a diverging baseline overrides it) reverses
        // the row so the labels stay honest.
        var sw = '';
        for (var i = 0; i < n; i++) {
          var t = i / (n - 1);
          sw += '<span class="dv-lsw" style="background:' + rmp.swatch(rmp.flipped ? 1 - t : t) + '"></span>';
        }
        h += '<span class="dv-li"><b>' + esc(sp.name || S.label || '') + '</b></span>' +
          '<span class="dv-li">' + sw + ' ' + (rmp.flat ? fmt(rmp.lo) : fmt(rmp.lo) + ' → ' + fmt(rmp.hi)) + '</span>';
        for (var z = 0; z < vals.length; z++) {
          if (vals[z] == null) {
            h += '<span class="dv-li"><span class="dv-lsw" style="background:repeating-linear-gradient(45deg,rgba(15,12,8,.18) 0 3px,transparent 3px 6px);outline:1px dashed rgba(15,12,8,.3)"></span> measured, found nothing</span>';
            break;
          }
        }
      }
      // The basis line is the denominator travelling with the picture —
      // mandatory whenever the view paints values. A view that forgot its
      // basis says so visibly rather than implying the number is universal.
      // When the header subtitle is showing (controls on + meta), saying
      // the same thing twice costs trust — but each legend drop is keyed
      // to the SUBTITLE ELEMENT that replaces it (basis text yields to
      // the about phrase, asOf yields to the date range), so partial meta
      // never suppresses provenance nothing replaced. The missing-basis
      // WARNING is never gated at all: no date range or row count states
      // a denominator.
      var on = (this.getAttribute('controls') || 'off') === 'on';
      var mb = (on && this._metaBits) || {};
      var bits = [];
      if (vals.length && !S.basis) bits.push('<span class="dv-basis warn">basis not stated</span>');
      else if (S.basis && !mb.about) bits.push(esc(String(S.basis)));
      if (this._hasDeltas(S)) bits.push('Δ vs ' + esc(String(S.deltaBasis)));
      var asOf = fmtDay(S.asOf);
      if (asOf && (vals.length || S.basis) && !mb.range) bits.push('as of ' + esc(asOf));
      if (bits.length) h += '<span class="dv-li dv-basis">' + bits.join(' · ') + '</span>';
      this._legend.innerHTML = h;
    }

    _hasDeltas(S) {
      if (!S || !S.deltaBasis) return false;
      var els = S.elements || [];
      for (var i = 0; i < els.length; i++) if (els[i] && els[i].delta != null) return true;
      return false;
    }

    _renderLayer() {
      var S = this._active(), rects = this._rects;
      if (!S) {
        this._layer.innerHTML = this.getAttribute('src')
          ? '<div class="dv-empty">No data views at <code>' + esc(this.getAttribute('src')) + '</code></div>'
          : '';
        this._applyFade();
        return;
      }
      var laid = rects.map(function (r) { return Object.assign({}, r); });
      var byId = Object.create(null); for (var j = 0; j < laid.length; j++) byId[laid[j].id] = laid[j];
      // Lane layout runs only over rects that will actually render a value
      // tag — spotlights, callout-only subjects and dimmed non-subjects
      // shouldn't reserve phantom collision lanes.
      var willTag = Object.create(null);
      var selsPre = S.elements || [];
      for (var w = 0; w < selsPre.length; w++) if (selsPre[w] && 'value' in selsPre[w]) willTag[selsPre[w].id] = 1;
      layoutTags(laid.filter(function (r) { return willTag[r.id]; }));
      var sb = this._stage.getBoundingClientRect(), sh = sb.height;
      var sp = S.spectrum || {}, fmt = fmtOf(sp);
      var rmp = buildRamp(sp, this._values(S));
      // Accent for pins/spotlights/leaders/tags: always the ramp's far
      // stop — swatch(t) is direction-agnostic (good:'low' flips value→t
      // mapping, not the ramp itself), so swatch(1) is the saturated end
      // regardless of direction.
      var hue = accentOf(sp) || rmp.swatch(1);
      var subjects = Object.create(null), h = '';
      var hasTags = this._values(S).length > 0;
      var deltas = this._hasDeltas(S);
      var sels = S.elements || [];
      // Pin numbers resolve in a pre-pass over the elements array so they
      // are stable across renders (an occluded anchor keeps its number) and
      // auto numbers skip values explicit pins already claim.
      var pinOf = Object.create(null), takenPins = Object.create(null);
      for (var pp = 0; pp < sels.length; pp++) {
        var pc = sels[pp] && sels[pp].callout;
        if (pc && pc.pin != null) takenPins[pc.pin] = 1;
      }
      var nextPin = 1;
      for (var pq = 0; pq < sels.length; pq++) {
        var qc = sels[pq] && sels[pq].callout;
        if (!qc) continue;
        if (qc.pin != null) { pinOf[pq] = qc.pin; continue; }
        while (takenPins[nextPin]) nextPin++;
        pinOf[pq] = nextPin; takenPins[nextPin] = 1;
      }
      // Subjects: wash + tag (if value), callout (if set), spotlight ring
      // (if neither). Every other tracked element fades via _applyFade
      // (its own opacity — nothing is painted over non-subjects).
      for (var i = 0; i < sels.length; i++) {
        var el = sels[i];
        if (!el || el.id == null) continue;
        var r = byId[el.id];
        subjects[el.id] = 1;
        if (!r || r.occluded) continue;
        var box = coverStyle(r) + radStyle(r);
        if ('value' in el) {
          var v = el.value;
          var col = v == null ? null : ((el.color && safeColor(el.color)) || rmp.color(v));
          // Delta renders only when the view declares what it's measured
          // against (deltaBasis) — the arrow is direction of change, the
          // legend carries the comparison.
          var dtxt = '';
          if (deltas && el.delta != null && v != null) {
            var dv = Number(el.delta) || 0;
            dtxt = '<span class="dv-d">' + (dv > 0 ? '▲' : dv < 0 ? '▼' : '=') + (dv === 0 ? '' : fmt(Math.abs(dv))) + '</span>';
          }
          h += '<div class="dv-box" data-id="' + esc(el.id) + '" style="' + box + '">' +
            (col == null ? '<span class="dv-wash nil"></span>'
              : '<span class="dv-wash" style="background:' + col + '"></span>') +
            '</div>' +
            '<span class="dv-tag" style="left:' + r.tag.cx + 'px;top:' + r.tag.ty + 'px;background:' +
            (v == null ? 'transparent;border:1px dashed rgba(15,12,8,.3);color:var(--text-tertiary,rgba(15,12,8,.48))' : ((el.color && safeColor(el.color)) || hue)) +
            '">' + fmt(v) + dtxt + '</span>';
        } else if (!el.callout) {
          h += '<span class="dv-spot" style="' + box + ';border-color:' + hue + '"></span>';
        }
        var c = el.callout;
        if (c && r && !r.occluded) {
          var pinVal = pinOf[i];
          // The pin sits on the element's real top-left corner — for a
          // transformed element that's the mapped local (0,0), not the
          // corner of the axis-aligned bounding box.
          var px0 = r.tf ? r.x - r.tf.ox : r.x, py0 = r.tf ? r.y - r.tf.oy : r.y;
          h += '<span class="dv-pin" style="left:' + (px0 - 6) + 'px;top:' + (py0 - 6) + 'px;background:' + hue + '">' + esc(pinVal) + '</span>';
          var dy = Number(c.dy) || 0, dx = Number(c.dx) || 0;
          var gap = 10 + (hasTags ? 18 : 0) + dy;
          // The card renders unpositioned (visibility:hidden) — the
          // deterministic collision pass below measures real card sizes,
          // places every card, and draws the leaders.
          h += '<span class="dv-co" data-for="' + esc(el.id) + '" data-gap="' + gap + '" data-dx="' + dx + '"' +
            (c.place === 'above' || c.place === 'below' ? ' data-place="' + c.place + '"' : '') +
            ((c.place || c.dx != null || c.dy != null) ? ' data-fixed' : '') +
            ' data-order="' + i + '" style="visibility:hidden;left:0;top:0">' +
            '<span class="dv-coh">' +
            '<span class="dv-pin inl" style="background:' + hue + '">' + esc(pinVal) + '</span>' +
            esc(c.head || '') + '</span>' +
            (c.body ? '<span class="dv-cob">' + esc(c.body) + '</span>' : '') +
            '</span>';
        }
      }
      this._layer.innerHTML = h;
      this._applyFade();
      this._fixCallouts(byId, sb.width, sh);
      this._isoId = null; this._layer.removeAttribute('data-iso');
    }

    // The non-subject fade. Nothing is painted over non-subject elements
    // (the old approach painted a theme-blind white cover that bleached
    // them out); instead the element itself drops to opacity `dim` —
    // theme-agnostic, it fades whatever the page renders, light or dark.
    // dim >= 1 means leave non-subjects alone. Writes are change-guarded
    // so the style MutationObserver doesn't loop, and prior inline
    // opacity survives the round trip (restored on view switch, untrack,
    // and disconnect).
    _applyFade() {
      var S = this._active();
      var prev = this._faded, next = new Map();
      if (S) {
        var dimN = Number(S.dim);
        var dim = S.dim != null && isFinite(dimN) ? Math.max(0, Math.min(1, dimN)) : 0.25;
        if (dim < 1) {
          var subjects = Object.create(null), sels = S.elements || [];
          for (var i = 0; i < sels.length; i++) if (sels[i] && sels[i].id != null) subjects[sels[i].id] = 1;
          var idAttr = this._idAttr();
          var els = this.querySelectorAll('[' + idAttr + ']');
          // Two passes: collect the subjects' DOM nodes first, because a
          // non-subject ANCESTOR of a subject must not fade — opacity
          // multiplies down the tree and would fade the subject with it.
          var subjEls = [];
          for (var k = 0; k < els.length; k++) {
            var sid = els[k].getAttribute(idAttr);
            if (sid && subjects[sid]) subjEls.push(els[k]);
          }
          var holdsSubject = function (node) {
            for (var q = 0; q < subjEls.length; q++) if (node.contains(subjEls[q])) return true;
            return false;
          };
          // Elements this pass fades, in document order — ancestors come
          // before descendants in querySelectorAll, so a descendant can
          // check whether an ancestor is already fading.
          var fading = [];
          for (var j = 0; j < els.length; j++) {
            var el = els[j], id = el.getAttribute(idAttr);
            if (!id || subjects[id] || holdsSubject(el)) continue;
            // Ownership: elements inside a NESTED data-overlay belong to
            // that overlay's fade — two overlays writing the same inline
            // opacity would oscillate and corrupt each other's restores.
            var owner = el.parentElement && el.parentElement.closest &&
              el.parentElement.closest('data-overlay');
            if (owner && owner !== this) continue;
            // A tracked non-subject nested inside another fading
            // non-subject inherits the ancestor's fade — opacity
            // multiplies down the tree, so writing it here too would
            // render it at dim², not the documented dim.
            var nested = false;
            for (var fq = 0; fq < fading.length; fq++) {
              if (fading[fq].contains(el)) { nested = true; break; }
            }
            if (nested) continue;
            // Never RAISE an element the page itself keeps at or below
            // the fade level (stylesheet-hidden tab panels, slides,
            // dismissed toasts) — inline opacity would override the
            // page's hide and ghost it back into view. Elements already
            // in the fade set are exempt: their computed opacity IS the
            // fade.
            if (!prev.has(el)) {
              var co = NaN;
              try { co = parseFloat(getComputedStyle(el).opacity); } catch (e) {}
              if (isFinite(co) && co <= dim) {
                // The page already keeps it at/below the fade level — it
                // still joins the fading set so tracked DESCENDANTS
                // inherit its dimness instead of being faded on top of
                // it (dim × page-dim compounding).
                fading.push(el);
                continue;
              }
            }
            fading.push(el);
            next.set(el, prev.has(el) ? prev.get(el) : el.style.opacity);
            // Numeric compare: the engine's CSSOM serialization may
            // differ from String(dim) (1e-7 reads back as "0.0000001").
            // Engines already no-op a style write whose parsed value is
            // unchanged, so the string form wouldn't loop — this just
            // avoids the redundant write in the common case.
            if (parseFloat(el.style.opacity) !== dim) el.style.opacity = String(dim);
          }
        }
      }
      prev.forEach(function (orig, el) {
        if (!next.has(el) && el.style.opacity !== orig) el.style.opacity = orig;
      });
      this._faded = next;
    }

    // Post-layout pass: measure real card sizes, run the deterministic
    // collision layout (layoutCallouts), apply positions, and draw one SVG
    // of leader lines from each anchor to wherever its card landed.
    _fixCallouts(byId, sw, sh) {
      // A zero-size stage (headless DOM, display:none frame) still lays
      // out — a large synthetic stage keeps the sweep deterministic and
      // effectively unclamped until real geometry arrives.
      if (!sw) sw = 4096;
      if (!sh) sh = 4096;
      var cards = this._layer.querySelectorAll('.dv-co');
      if (!cards.length) return;
      var items = [], nodes = Object.create(null);
      for (var i = 0; i < cards.length; i++) {
        var card = cards[i], id = card.getAttribute('data-for');
        var r = byId[id]; if (!r) continue;
        nodes[id] = card;
        items.push({
          id: id, order: parseInt(card.getAttribute('data-order'), 10) || 0,
          ax: r.x, ay: r.y, aw: r.w, ah: r.h,
          // happy-dom (and a mid-transition browser frame) can measure 0 —
          // fall back to the CSS width and a representative height so the
          // sweep still separates cards instead of stacking "0×0" rects.
          cw: card.offsetWidth || 200, ch: card.offsetHeight || 80,
          gap: parseFloat(card.getAttribute('data-gap')) || 10,
          dx: parseFloat(card.getAttribute('data-dx')) || 0,
          place: card.getAttribute('data-place') || '',
          fixed: card.hasAttribute('data-fixed'),
        });
      }
      // Prefer not covering ANY of this view's subject elements (washes,
      // spotlights) — their rects join the soft-avoid set. Tag lane (~18px
      // under valued elements) included so cards don't sit on the numbers.
      var avoid = [];
      var avEls = (this._active() && this._active().elements) || [];
      for (var av = 0; av < avEls.length; av++) {
        if (!avEls[av]) continue;
        var ar = byId[avEls[av].id];
        if (!ar) continue;
        // Extend the rect over the value-tag band on the side layoutTags
        // actually uses (below for top-row elements, above otherwise).
        var tagPad = 'value' in avEls[av] ? 20 : 0; // null entries skipped above
        var tagBelow = ar.y < 60;
        avoid.push({ x: ar.x, y: ar.y - (tagBelow ? 0 : tagPad), w: ar.w, h: ar.h + tagPad });
      }
      var pos = layoutCallouts(items, sw, sh, avoid);
      var leads = '';
      for (var j = 0; j < items.length; j++) {
        var it = items[j], p = pos[it.id]; if (!p) continue;
        var node = nodes[it.id];
        node.style.left = p.x + 'px';
        node.style.top = p.y + 'px';
        node.style.bottom = '';
        node.style.visibility = '';
        // leader: straight line between the nearest edge midpoints of the
        // anchor and the card.
        var cw = it.cw, ch = it.ch;
        var acx = it.ax + it.aw / 2, acy = it.ay + it.ah / 2;
        var ccx = p.x + cw / 2, ccy = p.y + ch / 2;
        var dxl = ccx - acx, dyl = ccy - acy;
        var a1, a2, c1, c2;
        if (Math.abs(dyl) >= Math.abs(dxl)) {
          a1 = acx; a2 = dyl > 0 ? it.ay + it.ah : it.ay;
          c1 = ccx; c2 = dyl > 0 ? p.y : p.y + ch;
        } else {
          a1 = dxl > 0 ? it.ax + it.aw : it.ax; a2 = acy;
          c1 = dxl > 0 ? p.x : p.x + cw; c2 = ccy;
        }
        leads += '<line class="dv-colead" data-for="' + esc(it.id) + '" x1="' + a1 + '" y1="' + a2 + '" x2="' + c1 + '" y2="' + c2 + '"></line>';
      }
      var old = this._layer.querySelector('.dv-coleads');
      if (old) old.remove();
      if (leads) {
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'dv-coleads');
        svg.setAttribute('width', sw); svg.setAttribute('height', sh);
        svg.innerHTML = leads;
        this._layer.appendChild(svg);
      }
    }

    _isolate(e) {
      var rects = this._rects, id = null;
      if (e) {
        var sb = this._stage.getBoundingClientRect();
        var mx = e.clientX - sb.left, my = e.clientY - sb.top, hitA = Infinity;
        for (var i = 0; i < rects.length; i++) {
          var r = rects[i]; if (r.occluded) continue;
          if (mx >= r.x && mx < r.x + r.w && my >= r.y && my < r.y + r.h) {
            var a = r.w * r.h; if (a < hitA) { hitA = a; id = r.id; }
          }
        }
      }
      if (id === this._isoId) return;
      this._isoId = id;
      var cs = this._layer.querySelectorAll('.dv-co,.dv-colead'), hot = false;
      for (var j = 0; j < cs.length; j++) {
        if (cs[j].getAttribute('data-for') === id) { cs[j].setAttribute('data-hot', ''); hot = true; }
        else cs[j].removeAttribute('data-hot');
      }
      if (hot) this._layer.setAttribute('data-iso', ''); else this._layer.removeAttribute('data-iso');
    }
  }

  if (!customElements.get('data-overlay')) {
    customElements.define('data-overlay', DataOverlay);
  }
  // Fallback placeholder suggestions per segment kind, used only when
  // the data file authors no 'suggest' field of its own.
  DataOverlay._SUGGEST = {
    metric: ['bounce rate'],
    cohort: ['new users only', 'returning users'],
    window: ['last 7 days', 'weekends only'],
  };
  DataOverlay.layoutCallouts = layoutCallouts;
  DataOverlay.geom = { linearOf: linearOf, ownLinear: ownLinear, mulLin: mulLin, quadOffset: quadOffset, radiusOf: radiusOf, cornerRad: cornerRad };
  window.DataOverlay = DataOverlay;
})();

