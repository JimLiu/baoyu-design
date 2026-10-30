/* BEGIN USAGE */
/**
 * <ios-shell> — iOS phone presentation shell (vanilla web component).
 *
 * Wraps its children in a realistic iPhone: dark bezel, rounded screen,
 * dynamic island, status bar (9:41, signal/wifi/battery), home bar. The
 * children ARE the screen content. Designed for composing social-asset
 * boards in Design Components or any HTML page: the bezel and overlays
 * are presentation, marked data-omelette-chrome, so omelette's PNG/frame
 * export hides them and a frame inside the shell exports clean.
 *
 * Attributes:
 *   dark            Light status-bar text + home bar (for dark content,
 *                   e.g. full-bleed stories). Default: dark-on-light.
 *   width           Bezel outer width in px. Default 428 (the uniform
 *                   social-board phone). Screen content scales nothing —
 *                   size your content to the screen box (width - 26px
 *                   padding).
 *   screen-height   Screen box height in px. Default 874 (a 402×874
 *                   screen inside the 428×900 device).
 *   image-only      Presence (or "true", e.g. image-only="{{ imagesOnly }}")
 *                   strips bezel, status chrome, and rounding — just the
 *                   screen content (the asset) remains, at its exact size.
 *
 * The shell is a PHYSICAL DEVICE: one fixed outer size — width ×
 * (screen-height + 26px bezel) — structurally pinned with min/max clamps
 * plus flex:none, so a flex row, grid track, or narrow parent can
 * neither squeeze nor stretch it (it overflows instead, like a real
 * phone on a small desk). Don't size it from outside with CSS: the
 * width / screen-height attributes are the only sizing inputs.
 * (image-only mode is the exception — the bezel is gone, so the box
 * hugs the asset.)
 *
 * Usage: <ios-shell><div class="my-app">…</div></ios-shell>
 * In a DC template, load this file from <helmet> with a plain
 * <script src="ios-shell.js"></script> and use the tag directly.
 *
 * The status bar, island, and home bar are absolutely positioned and
 * z-indexed above the content; content that must export exactly (a
 * [data-om-frame-export] frame filling the screen) is unaffected at
 * capture because all three overlays are chrome-hidden, and hiding them
 * cannot reflow (absolute positioning).
 */
/* END USAGE */

(function () {
  if (typeof HTMLElement !== 'function' || customElements.get('ios-shell')) return;

  var CSS =
    // The phone is a physical device: ONE fixed size, never scaling.
    // width/height alone don't guarantee that — a flex row shrinks items
    // below their width (min-width:auto floors at min-content, far below
    // the bezel), and stretch alignment inflates cross-axis heights — so
    // the outer box is pinned with min/max clamps plus flex:none. The
    // pins ride CSS vars that _build sets from the width/screen-height
    // attributes; the fallbacks are the uniform social-board device
    // (428×900 outer = 402×874 screen + 13px bezel all round).
    'ios-shell{display:block;position:relative;border-radius:56px;background:#0b0b0e;' +
    'padding:13px;box-shadow:0 28px 80px rgba(15,12,8,.3);box-sizing:border-box;' +
    'width:var(--ios-outer-w,428px);min-width:var(--ios-outer-w,428px);max-width:var(--ios-outer-w,428px);' +
    'height:var(--ios-outer-h,900px);min-height:var(--ios-outer-h,900px);max-height:var(--ios-outer-h,900px);' +
    'flex:none}' +
    'ios-shell>.ios-screen{position:relative;border-radius:43px;overflow:hidden;background:#fff}' +
    'ios-shell .ios-island{position:absolute;top:13px;left:50%;transform:translateX(-50%);' +
    'width:112px;height:33px;border-radius:20px;background:#0b0b0e;z-index:30}' +
    'ios-shell .ios-statusbar{position:absolute;top:0;left:0;right:0;height:54px;display:flex;' +
    'align-items:center;justify-content:space-between;padding:0 30px 0 34px;z-index:25;' +
    'color:#14130f;box-sizing:border-box;font-family:system-ui,-apple-system,sans-serif}' +
    'ios-shell .ios-statusbar .ios-time{font-size:16px;font-weight:600;line-height:1;letter-spacing:.2px}' +
    'ios-shell .ios-sbr{display:flex;gap:7px;align-items:center}' +
    'ios-shell .ios-sbr svg{fill:currentColor;display:block}' +
    'ios-shell .ios-homebar{position:absolute;bottom:8px;left:50%;transform:translateX(-50%);' +
    'width:134px;height:5px;border-radius:3px;background:rgba(0,0,0,.32);z-index:30}' +
    'ios-shell[dark] .ios-statusbar{color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.4)}' +
    'ios-shell[dark] .ios-homebar{background:rgba(255,255,255,.7)}' +
    // image-only mode: strip the bezel dressing (the "[images only /
    // product shells]" tweak). The screen height comes from _build: auto
    // (hugging in-flow content — the skill's letterboxed story pattern)
    // with a fallback to the explicit device height when the content is
    // an absolutely-positioned legacy story that has no flow height.
    // Selectors
    // deliberately match only [image-only=""] and [image-only="true"]: a
    // DC binding renders the string "false" when off, which a bare
    // attribute selector would match. Don't "simplify".
    'ios-shell[image-only=""],ios-shell[image-only="true"]' +
    '{background:transparent;padding:0;border-radius:0;box-shadow:none;' +
    'width:var(--ios-inner-w,402px) !important;' +
    'min-width:var(--ios-inner-w,402px) !important;max-width:var(--ios-inner-w,402px) !important;' +
    'height:auto !important;min-height:0 !important;max-height:none !important}' +
    // A semantic shell's composed phone strips its bezel when the PARENT
    // carries image-only (the composer's CSS sets width:auto on the
    // phone). min/max clamps beat width regardless of !important, so the
    // device pins must come off here too or the hug-the-asset mode would
    // stay clamped at device size. Generic parent selector: works for
    // every composer that marks its phone data-composed-phone.
    '[image-only=""]>ios-shell[data-composed-phone],[image-only="true"]>ios-shell[data-composed-phone]' +
    '{min-width:0 !important;max-width:none !important;' +
    'height:auto !important;min-height:0 !important;max-height:none !important}' +
    'ios-shell[image-only=""]>.ios-screen,ios-shell[image-only="true"]>.ios-screen' +
    '{border-radius:0}' +
    'ios-shell[image-only=""]>.ios-screen>.ios-island,ios-shell[image-only="true"]>.ios-screen>.ios-island,' +
    'ios-shell[image-only=""]>.ios-screen>.ios-statusbar,ios-shell[image-only="true"]>.ios-screen>.ios-statusbar,' +
    'ios-shell[image-only=""]>.ios-screen>.ios-homebar,ios-shell[image-only="true"]>.ios-screen>.ios-homebar' +
    '{display:none}';

  function ensureCss() {
    if (document.getElementById('ios-shell-css')) return;
    var s = document.createElement('style');
    s.id = 'ios-shell-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // Signal / wifi / battery glyphs (inline SVG, status-bar scale).
  var SB_SVG =
    '<svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="7.5" width="3" height="4.5" rx="1"></rect><rect x="4.5" y="5" width="3" height="7" rx="1"></rect><rect x="9" y="2.5" width="3" height="9.5" rx="1"></rect><rect x="13.5" y="0" width="3" height="12" rx="1"></rect></svg>' +
    '<svg width="17" height="12" viewBox="0 0 17 12"><path d="M8.5 3C10.7 3 12.7 3.9 14.2 5.3L15.3 4.2C13.5 2.5 11.1 1.4 8.5 1.4C5.9 1.4 3.5 2.5 1.7 4.2L2.8 5.3C4.3 3.9 6.3 3 8.5 3Z"></path><path d="M8.5 6.5C9.8 6.5 11 7 11.9 7.9L13 6.8C11.8 5.6 10.2 4.9 8.5 4.9C6.8 4.9 5.2 5.6 4 6.8L5.1 7.9C6 7 7.2 6.5 8.5 6.5Z"></path><circle cx="8.5" cy="10.3" r="1.4"></circle></svg>' +
    '<svg width="26" height="12" viewBox="0 0 26 12"><rect x="0.5" y="0.5" width="22" height="11" rx="3" fill="none" stroke="currentColor" stroke-opacity="0.35"></rect><rect x="2" y="2" width="19" height="8" rx="1.5"></rect><path d="M24 4v4c.8-.3 1.3-1 1.3-2S24.8 4.3 24 4Z" fill-opacity="0.5"></path></svg>';

  function chromeMark(n) {
    n.setAttribute('data-omelette-chrome', '');
    return n;
  }

  customElements.define('ios-shell', class extends HTMLElement {
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
      if (this.isConnected && document.readyState !== 'loading' && this._built) this._build();
    }
    static get observedAttributes() { return ['dark', 'width', 'screen-height', 'image-only']; }
    _build() {
      if (this.closest && this.closest('x-dc')) return;
      ensureCss();
      this._built = true;
      var outerW = parseInt(this.getAttribute('width') || '', 10) || 428;
      var screenH = parseInt(this.getAttribute('screen-height') || '', 10) || 874;
      // All sizing flows through the pinned CSS vars (see CSS above) — no
      // inline width, so nothing a board or composer sets on the element
      // can out-cascade the clamps. Outer height = screen + 13px bezel
      // top and bottom.
      this.style.setProperty('--ios-outer-w', outerW + 'px');
      this.style.setProperty('--ios-outer-h', (screenH + 26) + 'px');
      // image-only CSS swaps to the INNER width (bezel padding is zeroed in
      // that mode; keeping the outer width would stretch inset:0 frames ~6%).
      this.style.setProperty('--ios-inner-w', (outerW - 26) + 'px');

      // Re-slot: move (or re-move) the author's children into the screen box.
      var screen = this.querySelector(':scope > .ios-screen');
      var content;
      if (screen) {
        content = screen.querySelector(':scope > .ios-content');
      } else {
        content = document.createElement('div');
        content.className = 'ios-content';
        // Never slurp export chrome (a board wrapper's label bar) into the
        // screen — chrome stays outside the content.
        [].slice.call(this.childNodes).forEach(function (n) {
          if (n.nodeType === 1 && n.hasAttribute('data-omelette-chrome')) return;
          content.appendChild(n);
        });
        screen = document.createElement('div');
        screen.className = 'ios-screen';
        screen.appendChild(content);
        this.appendChild(screen);
      }
      var imgOnly = this.getAttribute('image-only') === '' || this.getAttribute('image-only') === 'true';
      if (imgOnly) {
        // image-only: the box hugs the actual asset — no forced device
        // height, no leftover blank space (product-owner direction; pairs
        // with the IO_CSS bezel strip). Story frames must be IN-FLOW
        // (aspect-ratio box, not inset:0) for this to size correctly —
        // the skill prescribes that pattern.
        screen.style.height = 'auto';
        content.style.cssText = 'position:static';
        // Legacy boards authored the story as an inset:0 ABSOLUTE frame,
        // which contributes no flow height — auto would collapse the unit
        // to 0 and drop its frame from exports. Fall back to the explicit
        // device height for that shape.
        if (!content.offsetHeight) {
          screen.style.height = screenH + 'px';
          content.style.cssText = 'position:absolute;inset:0';
        }
      } else {
        screen.style.height = screenH + 'px';
        content.style.cssText = 'position:absolute;inset:0';
      }

      // Overlays (idempotent): island + status bar + home bar, all chrome.
      if (!screen.querySelector(':scope > .ios-island')) {
        var island = chromeMark(document.createElement('div'));
        island.className = 'ios-island';
        var bar = chromeMark(document.createElement('div'));
        bar.className = 'ios-statusbar';
        var time = document.createElement('span');
        time.className = 'ios-time';
        time.textContent = '9:41';
        var right = document.createElement('span');
        right.className = 'ios-sbr';
        right.innerHTML = SB_SVG;
        bar.appendChild(time);
        bar.appendChild(right);
        var home = chromeMark(document.createElement('div'));
        home.className = 'ios-homebar';
        screen.appendChild(island);
        screen.appendChild(bar);
        screen.appendChild(home);
      }
    }
  });
})();
