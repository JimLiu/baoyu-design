/* BEGIN USAGE */
/**
 * <chrome-shell> — Google Chrome browser window shell (vanilla web
 * component). Wraps its children in a Chrome macOS window: traffic
 * lights, tab with favicon + title, URL bar with padlock, nav buttons.
 * The children are the page body. For composing social-asset boards in
 * Design Components or any HTML page: all window dressing is marked
 * data-omelette-chrome, so omelette's PNG/frame export hides it and a
 * frame inside the window exports clean.
 *
 * Attributes:
 *   tab          Tab title text. Default 'New Tab'.
 *   url          URL-bar text. Default 'example.com'.
 *   fav          CSS color for the tab favicon square. Default '#D97757'.
 *   width        Window width in px. Default 780.
 *   image-only   Presence (or "true", e.g. image-only="{{ imagesOnly }}")
 *                strips all window chrome (lights, tab, url bar) — just
 *                the body content remains. Matches the family pattern.
 *
 * The window is a PHYSICAL WINDOW: one fixed width — the width
 * attribute (default 780) — structurally pinned with min/max clamps
 * plus flex:none, so a flex row, grid track, or narrow parent can
 * neither squeeze nor stretch it (it overflows instead, like a real
 * browser window on a small desk). Height hugs the content (and is
 * clamped to that, so stretch alignment can't inflate it). Don't size
 * it from outside with CSS: the width attribute is the only sizing
 * input. (Unlike ios-shell, image-only keeps the width pin — the
 * footprint-preservation rule below.)
 *
 * Usage: <chrome-shell tab="X" url="x.com"><div class="post">…</div></chrome-shell>
 * In a DC template, load this file from <helmet> with a plain
 * <script src="chrome-shell.js"></script> and use the tag directly.
 */
/* END USAGE */

(function () {
  if (typeof HTMLElement !== 'function' || customElements.get('chrome-shell')) return;

  var CSS =
    // The window is a physical window: ONE fixed width, never scaling.
    // width alone doesn't guarantee that — a flex row shrinks items below
    // their width (min-width:auto floors at min-content), and stretch
    // alignment inflates cross-axis heights — so the box is pinned with
    // min/max clamps plus flex:none (the ios-shell device-pin pattern).
    // The width pin rides a CSS var that _sync sets from the width
    // attribute; height stays content-driven but is clamped to
    // fit-content on both sides, so it can neither be squeezed nor
    // stretched either.
    'chrome-shell{display:block;border-radius:12px;overflow:hidden;background:#fff;' +
    'box-shadow:0 24px 70px rgba(15,12,8,.22);box-sizing:border-box;' +
    'width:var(--cr-outer-w,780px);min-width:var(--cr-outer-w,780px);max-width:var(--cr-outer-w,780px);' +
    'height:fit-content;min-height:fit-content;max-height:fit-content;' +
    'flex:none;' +
    'font-family:system-ui,-apple-system,sans-serif}' +
    // Tab strip deliberately SIMPLE: the corner-cutout "feet" pseudo-
    // elements and the phantom inactive tab produced visual artifacts in
    // real product renders (product-owner report, baked back from his
    // project's in-product fix) — plain rounded tab, lights, one + button.
    'chrome-shell .cr-top{background:#dee1e6;padding:10px 10px 0;display:flex;align-items:center;gap:0}' +
    'chrome-shell .cr-lights{display:flex;gap:8px;padding:0 10px 0 6px}' +
    'chrome-shell .cr-lights i{width:12px;height:12px;border-radius:50%;display:block}' +
    'chrome-shell .cr-tab{background:#fff;border-radius:8px 8px 0 0;' +
    'padding:9px 10px 9px 12px;display:flex;align-items:center;gap:8px;font-size:13px;' +
    'font-weight:400;line-height:1.3;color:#3c4043;max-width:230px;min-width:120px;' +
    'white-space:nowrap}' +
    'chrome-shell .cr-tab-title-wrap{flex:1;overflow:hidden;text-overflow:ellipsis}' +
    'chrome-shell .cr-x{flex:none;width:16px;height:16px;border-radius:50%;display:flex;' +
    'align-items:center;justify-content:center;color:#5f6368}' +
    'chrome-shell .cr-x:hover{background:#e8eaed}' +
    'chrome-shell .cr-newtab{flex:none;width:28px;height:28px;border-radius:50%;display:flex;' +
    'align-items:center;justify-content:center;color:#5f6368;margin-left:8px}' +
    'chrome-shell .cr-fav{width:16px;height:16px;border-radius:4px;flex:none}' +
    'chrome-shell .cr-url{background:#fff;padding:12px 14px;display:flex;align-items:center;gap:14px}' +
    'chrome-shell .cr-urlbar{flex:1;background:#f1f3f4;border-radius:999px;padding:8px 16px;' +
    'font-size:13px;font-weight:400;line-height:1.3;color:#5f6368;display:flex;align-items:center;gap:9px}' +
    'chrome-shell .cr-btns{display:flex;gap:16px;color:#5f6368;align-items:center}' +
    'chrome-shell .cr-btns svg{display:block}' +
    'chrome-shell .cr-body{background:#fff}' +
    // image-only: dual-selector contract (a DC binding renders "false" when
    // off; bare [image-only] would match it — don't "simplify").
    // Footprint is PRESERVED in image-only (product owner: "preserve their
    // size, just lose the shell") — the window chrome hides but the host
    // keeps its authored width, so the card inside renders at exactly the
    // size it had in the window. width:auto here halved desktop assets.
    'chrome-shell[image-only=""],chrome-shell[image-only="true"]' +
    '{border-radius:0;box-shadow:none}' +
    'chrome-shell[image-only=""] .cr-top,chrome-shell[image-only="true"] .cr-top,' +
    'chrome-shell[image-only=""] .cr-url,chrome-shell[image-only="true"] .cr-url' +
    '{display:none}';

  function ensureCss() {
    if (document.getElementById('chrome-shell-css')) return;
    var s = document.createElement('style');
    s.id = 'chrome-shell-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  var NAV_SVG =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"></path></svg>' +
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.4"><path d="M5 12h14M12 5l7 7-7 7"></path></svg>' +
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"></path><path d="M21 3v5h-5"></path></svg>';
  var LOCK_SVG =
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#5f6368" stroke-width="2.2"><rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg>';

  customElements.define('chrome-shell', class extends HTMLElement {
    connectedCallback() {
      // Never build inside a raw DC template: <x-dc>'s children are live DOM
      // that the DC runtime snapshots and re-renders — building there bakes
      // serialized shell guts into the compiled template and later
      // crashes React's reconcile (NotFoundError on removeChild). Rendered
      // DOM never sits inside <x-dc>; plain HTML pages have no <x-dc>.
      if (this.closest && this.closest('x-dc')) return;
      if (document.readyState === 'loading') {
        var self = this;
        document.addEventListener('DOMContentLoaded', function () { self._build(); });
      } else this._build();
    }
    attributeChangedCallback() {
      if (this.isConnected && document.readyState !== 'loading' && this._built) this._sync();
    }
    static get observedAttributes() { return ['tab', 'url', 'fav', 'width', 'image-only']; }
    _sync() {
      // Width is mode-independent: image-only keeps the authored footprint.
      // Sizing flows ONLY through the pinned var — an inline width would
      // invite out-cascading the clamps.
      this.style.setProperty('--cr-outer-w', (parseInt(this.getAttribute('width') || '', 10) || 780) + 'px');
      var t = this.querySelector(':scope > .cr-top .cr-tab-title');
      if (t) t.textContent = this.getAttribute('tab') || 'New Tab';
      var u = this.querySelector(':scope > .cr-url .cr-urlbar-text');
      if (u) u.textContent = this.getAttribute('url') || 'example.com';
      var f = this.querySelector(':scope > .cr-top .cr-fav');
      if (f) f.style.background = this.getAttribute('fav') || '#D97757';
    }
    _build() {
      if (this.closest && this.closest('x-dc')) return;
      ensureCss();
      this._built = true;
      var body = this.querySelector(':scope > .cr-body');
      if (!body) {
        body = document.createElement('div');
        body.className = 'cr-body';
        [].slice.call(this.childNodes).forEach(function (n) {
          if (n.nodeType === 1 && n.hasAttribute('data-omelette-chrome')) return;
          body.appendChild(n);
        });

        var top = document.createElement('div');
        top.className = 'cr-top';
        top.setAttribute('data-omelette-chrome', '');
        top.innerHTML =
          '<div class="cr-lights">' +
          '<i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i>' +
          '</div>' +
          '<div class="cr-tab"><span class="cr-fav"></span>' +
          '<span class="cr-tab-title-wrap"><span class="cr-tab-title"></span></span>' +
          '<span class="cr-x"><svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M1 1l8 8M9 1l-8 8"></path></svg></span></div>' +
          '<span class="cr-newtab"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"></path></svg></span>';
        var url = document.createElement('div');
        url.className = 'cr-url';
        url.setAttribute('data-omelette-chrome', '');
        url.innerHTML =
          '<div class="cr-btns">' + NAV_SVG + '</div>' +
          '<div class="cr-urlbar">' + LOCK_SVG + '<span class="cr-urlbar-text"></span></div>';

        this.appendChild(top);
        this.appendChild(url);
        this.appendChild(body);
      }
      this._sync();
    }
  });
})();
