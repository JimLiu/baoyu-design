/* BEGIN USAGE */
/**
 * <social-frames> — thin social-asset board wrapper (vanilla web
 * component). This is a COMPOSITION wrapper, not a generator: you author
 * the formats as its children (typically in a Design Component, one
 * format per <sc-if> so tweaks toggle them), composing the shell
 * starters (<ios-shell>, <chrome-shell>) and <image-slot>s; the wrapper
 * contributes everything repetitive:
 *
 *   - board layout: a wrapping flex row with generous gaps, pan/zoom
 *     friendly (pair with <meta name="design_doc_mode" content="canvas">);
 *   - a label bar above every unit, reading the frame's
 *     data-om-frame-label ("Instagram post · 1080×1080" style), with a
 *     per-frame "↓ PNG" button;
 *   - one "↓ Download all (zip)" toolbar;
 *   - the export wiring: buttons ask the omelette host to crop each
 *     frame out of one page capture at its EXACT nominal size, shells
 *     and labels hidden — assets ship clean, no adornments.
 *
 * Contract for each unit (direct child of <social-frames>):
 *   - the unit is a PLAIN container (a <div>) — not a shell: shells
 *     re-slot their children, so a shell as the direct child would
 *     swallow the injected label bar (the wrapper skips custom-element
 *     units rather than corrupt them);
 *   - somewhere inside it, exactly one export frame: an element with
 *     data-om-frame-export="" and data-om-frame-label="<Label> · <W>×<H>",
 *     sized to the platform's aspect (exports land at the nominal pixel
 *     size named in the label's W×H, however large the frame renders);
 *   - everything inside the frame box is exported; shell dressing that
 *     overlaps it must carry data-omelette-chrome (the shell starters
 *     already mark theirs);
 *   - don't hide frames with display:none or visibility:hidden directly —
 *     toggle whole units (sc-if around the child), and the wrapper
 *     re-numbers correctly (it counts frames exactly as the host's
 *     measurer does).
 *
 * The board must be the page's effective top-level content: no sibling
 * headings next to <social-frames> in the template — the host's frame
 * detection descends a single-child chain and stops at the first branch.
 *
 * The wrapper marks itself data-om-multi-frame (the host's multi-frame
 * classifier is opt-in) and tolerates children appearing/disappearing
 * (sc-if toggles re-scan via MutationObserver). Per-frame export needs
 * at least two visible frames; the download-all button hides below two.
 */
/* END USAGE */

(function () {
  if (typeof HTMLElement !== 'function' || customElements.get('social-frames')) return;

  var CSS =
    'social-frames{display:flex;flex-wrap:wrap;align-items:flex-start;gap:72px 60px;' +
    'padding:48px;box-sizing:border-box;font-family:system-ui,-apple-system,sans-serif}' +
    'social-frames>.sfb-toolbar{flex:0 0 100%;display:flex}' +
    'social-frames .sfb-dlall{cursor:pointer;border:0;border-radius:10px;padding:12px 20px;' +
    'background:#191915;color:#fff;font-size:14px;font-weight:600;line-height:1;box-shadow:0 2px 10px rgba(15,12,8,.12);' +
    'display:flex;align-items:center;gap:8px}' +
    'social-frames .sfb-dlall:hover{background:#2b2b26}' +
    'social-frames .sfb-label{display:flex;align-items:center;gap:8px;font-size:15px;font-weight:550;line-height:1.3;' +
    'color:#6b675c;width:100%;margin-bottom:16px}' +
    'social-frames .sfb-label .sfb-dim{color:#a5a095;font-weight:400}' +
    'social-frames .sfb-dl{margin-left:auto;cursor:pointer;border:0;border-radius:7px;padding:6px 12px;' +
    'background:#191915;color:#fff;font-size:12px;font-weight:600;line-height:1.4;display:flex;align-items:center;gap:6px}' +
    'social-frames .sfb-dl:hover{background:#2b2b26}';

  var HOSTED = (function () {
    try { return window.parent !== window; } catch (e) { return false; }
  })();

  function ensureCss() {
    if (document.getElementById('social-frames-css')) return;
    var s = document.createElement('style');
    s.id = 'social-frames-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // Mirrors the host measurer's visibility predicate (visOk + min-rect in
  // measure.ts): computed display/visibility/fixed plus a 2px floor. The
  // click-time index below MUST match the measurer's candidate list, or a
  // button downloads the wrong frame.
  function visibleFrames() {
    return [].slice.call(document.querySelectorAll('[data-om-frame-export]'))
      .filter(function (n) {
        var cs;
        try { cs = getComputedStyle(n); } catch (e) { return false; }
        if (!cs || cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') return false;
        var r = n.getBoundingClientRect();
        return r.width >= 2 && r.height >= 2;
      });
  }

  function requestExport(detail) {
    try {
      window.parent.postMessage(
        Object.assign({ type: 'omelette:request-frame-export' }, detail), '*');
    } catch (e) {}
  }

  customElements.define('social-frames', class extends HTMLElement {
    connectedCallback() {
      // Never build inside a raw DC template: <x-dc>'s children are live DOM
      // that the DC runtime snapshots and re-renders — building there bakes
      // serialized wrapper guts into the compiled template and later
      // crashes React's reconcile (NotFoundError on removeChild). Rendered
      // DOM never sits inside <x-dc>; plain HTML pages have no <x-dc>.
      if (this.closest && this.closest('x-dc')) return;
      this.setAttribute('data-om-multi-frame', '');
      var self = this;
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { self._build(); });
      } else this._build();
    }
    disconnectedCallback() {
      if (this._mo) { this._mo.disconnect(); this._mo = null; }
    }
    _build() {
      if (this.closest && this.closest('x-dc')) return;
      ensureCss();
      this._scan();
      if (!this._mo) {
        var self = this;
        // sc-if toggles add/remove whole units; re-scan to label new ones
        // and keep the download-all visibility honest. Scans are
        // idempotent and cheap (a class check per unit).
        this._mo = new MutationObserver(function (muts) {
          for (var i = 0; i < muts.length; i++) {
            if (muts[i].type === 'childList') { self._scan(); return; }
          }
        });
        this._mo.observe(this, { childList: true, subtree: true });
      }
    }
    _scan() {
      var self = this;
      var count = visibleFrames().length;

      // A serialized copy of injected chrome (e.g. a DC template snapshot
      // taken after this script ran on the raw DOM) has markup but no
      // listeners and no expando — replace it rather than skip it.
      [].slice.call(this.querySelectorAll('.sfb-toolbar, .sfb-label')).forEach(function (n) {
        if (!n.__sfbLive) n.parentNode.removeChild(n);
      });

      // Download-all toolbar (hosted only; needs >=2 visible frames).
      var bar = this.querySelector(':scope > .sfb-toolbar');
      if (HOSTED && !bar) {
        bar = document.createElement('div');
        bar.className = 'sfb-toolbar';
        bar.setAttribute('data-omelette-chrome', '');
        var all = document.createElement('button');
        all.className = 'sfb-dlall';
        all.textContent = '↓ Download all (zip)';
        all.addEventListener('click', function (e) {
          e.preventDefault();
          requestExport({ all: true });
        });
        bar.appendChild(all);
        bar.__sfbLive = true;
        this.insertBefore(bar, this.firstChild);
      }
      if (bar) bar.style.display = count >= 2 ? '' : 'none';

      // Label bar + per-frame download button on every unit that carries
      // an export frame and doesn't have its label yet.
      [].slice.call(this.children).forEach(function (unit) {
        if (unit === bar) return;
        // A custom-element unit (a shell as the DIRECT child) re-slots its
        // children into internal boxes and would swallow an injected label —
        // units must be plain containers (the USAGE contract); skip others.
        if (unit.tagName && unit.tagName.indexOf('-') >= 0) return;
        var frame = unit.querySelector ? unit.querySelector('[data-om-frame-export]') : null;
        if (!frame) return;
        var existing = unit.querySelector(':scope > .sfb-label');
        if (existing) {
          // Per-frame export needs >=2 visible frames host-side; keep the
          // button's visibility honest as formats toggle.
          var b0 = existing.querySelector('.sfb-dl');
          if (b0) b0.style.display = count >= 2 ? '' : 'none';
          return;
        }
        var label = document.createElement('div');
        label.className = 'sfb-label';
        label.setAttribute('data-omelette-chrome', '');
        var raw = frame.getAttribute('data-om-frame-label') || 'Frame';
        var parts = raw.split(' · ');
        label.appendChild(document.createTextNode(parts[0]));
        if (parts[1]) {
          var dim = document.createElement('span');
          dim.className = 'sfb-dim';
          dim.textContent = '· ' + parts[1];
          label.appendChild(dim);
        }
        if (HOSTED) {
          var btn = document.createElement('button');
          btn.className = 'sfb-dl';
          btn.textContent = '↓ PNG';
          btn.title = 'Download this frame as a PNG at its exact size';
          btn.addEventListener('click', function (e) {
            e.preventDefault();
            // Index by VISIBLE frames in document order — the same list
            // the host's measurer crops, so sc-if'd-off units never skew
            // the mapping.
            var idx = visibleFrames().indexOf(frame);
            if (idx >= 0) requestExport({ frame: idx });
          });
          btn.style.display = count >= 2 ? '' : 'none';
          label.appendChild(btn);
        }
        label.__sfbLive = true;
        unit.insertBefore(label, unit.firstChild);
      });
    }
  });
})();
