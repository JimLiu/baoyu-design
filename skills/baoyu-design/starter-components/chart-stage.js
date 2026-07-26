/* BEGIN USAGE */
/**
 * <chart-stage> — interactive chart shell for d3 visualizations.
 *
 * The stage owns the chart chrome so every chart gets it for free:
 * container-driven sizing (the chart redraws from its container's size),
 * wheel / drag / pinch zoom and pan with a reset control, a tooltip that
 * works for mouse and touch, a labeled empty state, an error state, data
 * transitions, and a toolbar that downloads the current chart as PNG or
 * SVG. You write only the draw function.
 *
 * d3 loads from the page, version-pinned with integrity hashes. Include
 * these EXACT tags in <head>, BEFORE chart-stage.js (same tags the "Data
 * visualization" skill mandates; the d3-sankey tag only when the chart
 * uses d3.sankey — it attaches to the same global):
 *
 *   <script src="https://unpkg.com/d3@7.9.0/dist/d3.min.js" integrity="sha384-CjloA8y00+1SDAUkjs099PVfnY2KmDC2BZnws9kh8D/lX1s46w6EPhpXdqMfjK6i" crossorigin="anonymous"></script>
 *   <script src="https://unpkg.com/d3-sankey@0.12.3/dist/d3-sankey.min.js" integrity="sha384-SM54CE5h+qdDI046d2Y5ym7wq1kq4uxcQ1cqGq5/+5jrE5tPLeDJSq711Q8sIska" crossorigin="anonymous"></script>
 *
 * Usage:
 *   <style>chart-stage:not(:defined){visibility:hidden}</style>
 *   <chart-stage name="revenue-by-month" zoom="x" style="height:70vh"></chart-stage>
 *   <script src="chart-stage.js"></script>
 *   <script>
 *     const stage = document.querySelector('chart-stage');
 *     stage.ready.then(({ d3 }) => {
 *       stage.draw(({ svg, width, height, view, layer, t, tips, esc }) => {
 *         if (!rows.length) return stage.showEmpty('No rows in this range');
 *         const m = { top: 16, right: 24, bottom: 36, left: 48 };
 *         const x = view.x(d3.scaleUtc(d3.extent(rows, r => r.date), [m.left, width - m.right]));
 *         const y = d3.scaleLinear([0, d3.max(rows, r => r.value)], [height - m.bottom, m.top]).nice();
 *         layer('grid').call(...); layer('x-axis').call(...); layer('y-axis').call(...);
 *         t(layer('marks').selectAll('circle').data(rows, r => r.id).join('circle'))
 *           .attr('cx', r => x(r.date)).attr('cy', r => y(r.value));
 *         tips(layer('marks').selectAll('circle'), r => ({ html: '<b>' + esc(r.label) + '</b> ' + fmt(r.value) }));
 *       });
 *     });
 *   </script>
 *
 * The contract:
 *   stage.ready — Promise of { d3 }; rejects (and shows an in-stage error)
 *     when the pinned d3 script is missing from <head>.
 *   stage.draw(fn) — registers the draw function and renders. fn draws THE
 *     WHOLE CHART and runs again on every container resize, zoom gesture,
 *     and stage.refresh() — so it must be idempotent: put every group
 *     through layer(name) and every mark through a keyed .join(), never a
 *     bare .append() at draw level (bare appends duplicate on the second
 *     run). fn receives:
 *       d3      — the d3 global
 *       svg     — the stage's <svg> root d3-selection, sized to the stage
 *       width, height — the current pixel size; derive scale ranges from
 *         these every run, never from fixed numbers
 *       view    — the current zoom: view.x(scale) / view.y(scale) take the
 *         UNZOOMED scale you built and return the zoom-adjusted one
 *         (continuous scales rescale; band/point scales get their range
 *         mapped). Build axes and position marks from the returned scales
 *         and the whole chart follows the zoom. Which axes respond is the
 *         zoom attribute, not a code choice.
 *       layer(name) — a keyed <g> created on first use, same node on every
 *         later run ("x-axis", "marks", "grid"…). Draw order = first-use
 *         order; put grid first, marks later, axes last.
 *       t(selection) — the stage's data transition: 250ms ease on a
 *         refresh, instant during zoom and resize (so gestures track the
 *         pointer) and on first paint (no entrance theater). Route every
 *         position/size change through it and updates animate exactly when
 *         they should.
 *       tips(selection, d => content) — binds the stage tooltip to the
 *         marks: hover and touch, positioned and edge-flipped for you, and
 *         hidden on every re-render so it can't go stale across a data
 *         refresh. Return a STRING and it renders as plain text (safe by
 *         default). Return { html: '…' } when the tooltip needs markup —
 *         then esc() every data value inside it, and the stage strips
 *         active content as a backstop: tooltip markup is for inert text
 *         formatting and relative-path images only — style it with classes
 *         and page CSS (never inline styles), no links, no svg. Name the
 *         mark and give the exact values behind it (include anything an
 *         axis truncated).
 *       esc(value) — escape a data value for { html } tooltip markup; use
 *         it on every string you didn't author (CSV cells, connector
 *         fields, user input).
 *   stage.refresh() — re-render after the underlying data changes (draw
 *     runs with transitions enabled).
 *   stage.showEmpty(message) — labeled empty state instead of a blank svg;
 *     call it (with a reason) and return early when there is nothing to
 *     plot. It hides the previous chart; the next render restores it.
 *
 * Attributes:
 *   name     — download file basename (default "chart")
 *   zoom     — "xy" | "x" | "y" | "none" (default "xy"): which axes the
 *     wheel/drag/pinch gesture rescales. "x" suits time series (zoom into
 *     a date range), "y" suits horizontal bars, "none" removes zoom and
 *     the reset control entirely.
 *   max-zoom — upper zoom factor (default 32)
 *
 * Appearance: the stage's own chrome (tooltip, buttons, empty state) reads
 * the custom properties --chart-font, --chart-ink, --chart-muted,
 * --chart-surface, --chart-grid (set them once on chart-stage from the
 * bound design system's tokens; neutral fallbacks otherwise). Data ink is
 * yours — style marks and axes in the draw function.
 *
 * Size the stage with ordinary CSS (default 100% wide, 420px tall). PNG
 * downloads render at 2x the on-screen size on --chart-surface.
 */
/* END USAGE */
(() => {
  if (customElements.get('chart-stage')) return;

  const CSS_ID = 'chart-stage-css';
  if (!document.getElementById(CSS_ID)) {
    const st = document.createElement('style');
    st.id = CSS_ID;
    st.textContent = [
      'chart-stage{display:block;position:relative;width:100%;height:420px;',
      'font-family:var(--chart-font,system-ui,sans-serif);',
      'background:var(--chart-surface,#fff)}',
      'chart-stage svg{display:block;overflow:hidden}',
      'chart-stage .cs-tip{position:absolute;pointer-events:none;z-index:4;',
      'max-width:260px;padding:6px 9px;border-radius:6px;font-size:12px;line-height:1.45;overflow:hidden;',
      'background:var(--chart-ink,#1a1a18);color:var(--chart-surface,#fff);',
      'opacity:0;transition:opacity 120ms}',
      'chart-stage .cs-tools{position:absolute;top:8px;right:8px;z-index:3;display:flex;',
      'gap:6px;opacity:0;transition:opacity 150ms}',
      'chart-stage:hover .cs-tools,chart-stage .cs-tools:focus-within{opacity:1}',
      'chart-stage .cs-tools button{font:inherit;font-size:11px;padding:3px 9px;',
      'border-radius:999px;cursor:pointer;color:var(--chart-ink,#1a1a18);',
      'background:var(--chart-surface,#fff);border:1px solid var(--chart-grid,#d9d9d4)}',
      'chart-stage .cs-tools button:hover{border-color:var(--chart-ink,#1a1a18)}',
      'chart-stage .cs-note{position:absolute;inset:0;z-index:2;display:none;',
      'align-items:center;justify-content:center;text-align:center;padding:24px;',
      'font-size:13px;color:var(--chart-muted,#6e6e68)}',
      'chart-stage .cs-note.cs-on{display:flex}',
    ].join('');
    document.head.appendChild(st);
  }

  const TIP_PAD = 12;
  const STYLE_PROPS = [
    'fill',
    'fill-opacity',
    'stroke',
    'stroke-width',
    'stroke-opacity',
    'stroke-dasharray',
    'stroke-linecap',
    'stroke-linejoin',
    'opacity',
    'font-family',
    'font-size',
    'font-weight',
    'font-style',
    'letter-spacing',
    'text-anchor',
    'dominant-baseline',
    'paint-order',
    'shape-rendering',
    'visibility',
    'display',
    'mix-blend-mode',
  ];

  class ChartStage extends HTMLElement {
    constructor() {
      super();
      this._drawFn = null;
      this._layers = new Map();
      this._zt = null;
      this._reason = 'mount';
      this._raf = 0;
      this._ready = null;
    }

    get ready() {
      if (!this._ready) {
        this._ready = new Promise((res, rej) => {
          const probe = () => {
            if (window.d3) return res({ d3: window.d3 });
            const msg =
              'chart-stage: window.d3 is missing - include the pinned d3 <script> tags from the usage block in <head>, before chart-stage.js';
            this._note(msg, true);
            rej(new Error(msg));
          };
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', probe, {
              once: true,
            });
          } else {
            probe();
          }
        });
      }
      return this._ready;
    }

    connectedCallback() {
      if (this._built) {
        if (this._ro) this._ro.observe(this);
        this._schedule('resize');
        return;
      }
      this._built = true;

      this._svgEl = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'svg'
      );
      this.appendChild(this._svgEl);

      this._tip = document.createElement('div');
      this._tip.className = 'cs-tip';
      this.appendChild(this._tip);

      this._noteEl = document.createElement('div');
      this._noteEl.className = 'cs-note';
      this.appendChild(this._noteEl);

      this._tools = document.createElement('div');
      this._tools.className = 'cs-tools';
      this.appendChild(this._tools);
      this._resetBtn = this._button('Reset view', () => this._resetZoom());
      this._resetBtn.style.display = 'none';
      this._button('\u2193 PNG', () => this._download('png'));
      this._button('\u2193 SVG', () => this._download('svg'));

      this._ro = new ResizeObserver(() => this._schedule('resize'));
      this._ro.observe(this);

      this.ready.then(
        ({ d3 }) => {
          this._d3 = d3;
          const mode = this._zoomMode();
          if (mode !== 'none') {
            this._zt = d3.zoomIdentity;
            const maxZoom = +(this.getAttribute('max-zoom') || 32);
            this._zoom = d3
              .zoom()
              .scaleExtent([1, maxZoom > 1 ? maxZoom : 32])
              .on('start', () => this._hideTip())
              .on('zoom', (e) => {
                this._zt = e.transform;
                const zoomed =
                  e.transform.k !== 1 ||
                  (mode !== 'y' && e.transform.x !== 0) ||
                  (mode !== 'x' && e.transform.y !== 0);
                this._resetBtn.style.display = zoomed ? '' : 'none';
                this._schedule('zoom');
              });
            d3.select(this._svgEl).call(this._zoom);
          }
          this._schedule('mount');
        },
        () => undefined
      );
    }

    disconnectedCallback() {
      if (this._ro) this._ro.disconnect();
      cancelAnimationFrame(this._raf);
    }

    draw(fn) {
      this._drawFn = fn;
      this._schedule(this._everDrawn ? 'refresh' : 'mount');
    }

    refresh() {
      this._schedule('refresh');
    }

    showEmpty(message) {
      this._svgEl.style.visibility = 'hidden';
      this._hideTip();
      this._note(message || 'Nothing to show yet', false);
    }

    _button(label, onClick) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.addEventListener('click', onClick);
      this._tools.appendChild(b);
      return b;
    }

    _zoomMode() {
      const z = (this.getAttribute('zoom') || 'xy').toLowerCase();
      return z === 'x' || z === 'y' || z === 'none' ? z : 'xy';
    }

    _resetZoom() {
      if (!this._zoom) return;
      this._d3
        .select(this._svgEl)
        .transition()
        .duration(250)
        .call(this._zoom.transform, this._d3.zoomIdentity);
    }

    _schedule(reason) {
      if (reason === 'refresh' || reason === 'mount') this._reason = reason;
      else if (this._reason !== 'refresh' && this._reason !== 'mount')
        this._reason = reason;
      cancelAnimationFrame(this._raf);
      this._raf = requestAnimationFrame(() => this._render());
    }

    _render() {
      const d3 = this._d3;
      const fn = this._drawFn;
      const reason = this._reason;
      this._reason = 'idle';
      if (!d3 || !fn) return;

      const width = this.clientWidth;
      const height = this.clientHeight;
      if (!width || !height) return;
      this._svgEl.setAttribute('width', width);
      this._svgEl.setAttribute('height', height);
      this._svgEl.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
      if (this._zoom) {
        this._zoom
          .extent([
            [0, 0],
            [width, height],
          ])
          .translateExtent([
            [0, 0],
            [width, height],
          ]);
      }
      this._noteEl.classList.remove('cs-on');
      this._svgEl.style.removeProperty('visibility');

      this._hideTip();
      const svg = d3.select(this._svgEl);
      const mode = this._zoomMode();
      const zt = this._zt || d3.zoomIdentity || null;
      const rescale = (scale, axis) => {
        if (!zt || (zt.k === 1 && !zt.x && !zt.y)) return scale;
        if (mode !== 'xy' && mode !== axis) return scale;
        const apply = axis === 'x' ? (v) => zt.applyX(v) : (v) => zt.applyY(v);
        if (typeof scale.invert === 'function') {
          return axis === 'x' ? zt.rescaleX(scale) : zt.rescaleY(scale);
        }
        const c = scale.copy();
        return c.range(scale.range().map(apply));
      };
      const stage = this;
      const ctx = {
        d3: d3,
        svg: svg,
        width: width,
        height: height,
        reason: reason,
        view: {
          x: (s) => rescale(s, 'x'),
          y: (s) => rescale(s, 'y'),
          transform: zt,
        },
        layer: (name) => {
          let g = stage._layers.get(name);
          if (!g || g.ownerSVGElement !== stage._svgEl) {
            g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('data-layer', name);
            stage._svgEl.appendChild(g);
            stage._layers.set(name, g);
          }
          return d3.select(g);
        },
        t: (sel) => {
          if (reason === 'refresh') {
            return sel.transition('chart-stage').duration(250);
          }
          sel.interrupt('chart-stage');
          return sel;
        },
        tips: (sel, html) => stage._bindTips(sel, html),
        esc: (v) => stage.esc(v),
      };

      try {
        fn(ctx);
        this._everDrawn = true;
      } catch (err) {
        console.error('chart-stage draw failed:', err);
        this._svgEl.style.visibility = 'hidden';
        this._note(
          'This chart hit an error while rendering - details in the console.',
          true
        );
      }
    }

    _bindTips(sel, html) {
      const stage = this;
      sel
        .on('pointerenter.cstip pointermove.cstip', function (e, d) {
          let out;
          try {
            out = html.call(this, d, e);
          } catch (err) {
            console.error('chart-stage tooltip failed:', err);
            return;
          }
          if (out == null || out === false) return stage._hideTip();
          if (typeof out === 'object' && 'html' in out) {
            stage._showTip(String(out.html), e, true);
          } else {
            stage._showTip(String(out), e, false);
          }
        })
        .on('pointerleave.cstip pointercancel.cstip', () => stage._hideTip());
    }

    _showTip(content, ev, isHtml) {
      const tip = this._tip;
      if (!isHtml) {
        tip.textContent = content;
      } else {
        try {
          const tpl = document.createElement('template');
          tpl.innerHTML = content;
          this._stripActiveContent(tpl.content);
          tip.textContent = '';
          tip.appendChild(tpl.content);
        } catch (err) {
          console.error('chart-stage tooltip sanitize failed:', err);
          return this._hideTip();
        }
      }
      tip.style.opacity = '1';
      tip.style.left = '0px';
      tip.style.top = '0px';
      const host = this.getBoundingClientRect();
      const x = ev.clientX - host.left;
      const y = ev.clientY - host.top;
      const tw = tip.offsetWidth;
      const th = tip.offsetHeight;
      let left = x + TIP_PAD;
      let top = y + TIP_PAD;
      if (left + tw > host.width - 4) left = x - tw - TIP_PAD;
      if (top + th > host.height - 4) top = y - th - TIP_PAD;
      tip.style.left = Math.max(4, left) + 'px';
      tip.style.top = Math.max(4, top) + 'px';
    }

    _hideTip() {
      this._tip.textContent = '';
      this._tip.style.opacity = '0';
    }

    _stripActiveContent(root) {
      // DOM calls go through prototypes throughout: a named form control
      // (<input name="remove">) shadows the instance method and would abort the strip.
      const rm = Element.prototype.remove;
      for (const el of root.querySelectorAll(
        'script,iframe,object,embed,link,meta,style,form,base,template,' +
          'svg,animate,set,animateTransform,animateMotion'
      ))
        rm.call(el);
      const names = Element.prototype.getAttributeNames;
      const get = Element.prototype.getAttribute;
      const drop = Element.prototype.removeAttribute;
      const uriAttrs =
        /^(src|formaction|action|poster|ping|cite|data|background)$/;
      // Any scheme or protocol-relative prefix means a non-relative URL;
      // the URL parser treats \ like /, so two of either slash counts.
      const badUri = (v) => {
        // oxlint-disable-next-line no-control-regex -- intentional: strips control chars an attacker could embed to obfuscate the scheme
        const s = v.replace(/[\x00-\x20]/g, '');
        return /^[a-z][a-z0-9+.-]*:/i.test(s) || /^[/\\]{2}/.test(s);
      };
      for (const el of root.querySelectorAll('*')) {
        if (el.tagName.includes('-')) {
          rm.call(el);
          continue;
        }
        for (const name of names.call(el)) {
          const lower = name.toLowerCase();
          const value = String(get.call(el, name) ?? '');
          if (
            lower.startsWith('on') ||
            lower === 'style' ||
            lower === 'pointer-events' ||
            lower === 'tabindex' ||
            lower === 'name' ||
            lower === 'id' ||
            lower === 'href' ||
            lower === 'xlink:href' ||
            lower === 'is' ||
            (uriAttrs.test(lower) && badUri(value)) ||
            (lower === 'srcset' &&
              value.split(',').some((c) => badUri(c.trim())))
          ) {
            drop.call(el, name);
          }
        }
      }
    }

    esc(value) {
      return String(value).replace(/[&<>"']/g, (c) =>
        c === '&'
          ? '&amp;'
          : c === '<'
            ? '&lt;'
            : c === '>'
              ? '&gt;'
              : c === '"'
                ? '&quot;'
                : '&#39;'
      );
    }

    _note(message, isError) {
      this._noteEl.textContent = message;
      this._noteEl.classList.add('cs-on');
      if (isError) this._noteEl.style.color = '#b3261e';
      else this._noteEl.style.removeProperty('color');
    }

    _surfaceColor() {
      const v = getComputedStyle(this)
        .getPropertyValue('--chart-surface')
        .trim();
      return v || '#ffffff';
    }

    _exportClone() {
      const src = this._svgEl;
      const clone = src.cloneNode(true);
      const a = src.querySelectorAll('*');
      const b = clone.querySelectorAll('*');
      const inline = (from, to) => {
        const cs = getComputedStyle(from);
        for (const p of STYLE_PROPS) {
          const v = cs.getPropertyValue(p);
          if (v) to.setAttribute(p, v);
        }
      };
      inline(src, clone);
      for (let i = 0; i < a.length; i++) inline(a[i], b[i]);
      const rect = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'rect'
      );
      rect.setAttribute('width', '100%');
      rect.setAttribute('height', '100%');
      rect.setAttribute('fill', this._surfaceColor());
      clone.insertBefore(rect, clone.firstChild);
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      return clone;
    }

    _filename(ext) {
      const base = (this.getAttribute('name') || 'chart').replace(
        /[^\w.-]+/g,
        '-'
      );
      return base + '.' + ext;
    }

    _save(blob, filename) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 30000);
    }

    async _download(format) {
      if (!this._everDrawn || this._noteEl.classList.contains('cs-on')) return;
      try {
        const ser = new XMLSerializer().serializeToString(this._exportClone());
        const svgBlob = new Blob([ser], {
          type: 'image/svg+xml;charset=utf-8',
        });
        if (format === 'svg') return this._save(svgBlob, this._filename('svg'));
        const url = URL.createObjectURL(svgBlob);
        try {
          const img = new Image();
          await new Promise((res, rej) => {
            img.onload = res;
            img.onerror = () => rej(new Error('could not rasterize the chart'));
            img.src = url;
          });
          const scale = 2;
          const canvas = document.createElement('canvas');
          canvas.width = this.clientWidth * scale;
          canvas.height = this.clientHeight * scale;
          const g = canvas.getContext('2d');
          g.fillStyle = this._surfaceColor();
          g.fillRect(0, 0, canvas.width, canvas.height);
          g.drawImage(img, 0, 0, canvas.width, canvas.height);
          const png = await new Promise((res) =>
            canvas.toBlob(res, 'image/png')
          );
          if (png) this._save(png, this._filename('png'));
        } finally {
          URL.revokeObjectURL(url);
        }
      } catch (err) {
        console.error('chart-stage download failed:', err);
      }
    }
  }

  customElements.define('chart-stage', ChartStage);
})();
