/* BEGIN USAGE */
/**
 * <reddit-shell> — finished Reddit-style mobile post UI, attribute-driven.
 *
 * A complete, pre-designed post-detail screen inside an iPhone (composes
 * the ios-shell starter — load ios-shell.js and image-slot.js alongside).
 * No logos or wordmarks: neutral chrome that reads as the platform
 * without naming it. Claude fills attributes; never hand-build this.
 *
 * Attributes:
 *   image-credit / image-credit-href   Attribution for a stock photo in
 *               image-src (REQUIRED for Unsplash results — the host shows
 *               an error tile without it); forwarded to the internal slot.
 *   image-src   Prefill for the post image (image-slot underneath; give
 *               the ELEMENT an id so drops persist).
 *   community   e.g. "r/design". Default "r/yourcommunity".
 *   username    e.g. "u/yourbrand". Default "u/yourbrand".
 *   time        e.g. "5h". Default "5h".
 *   title       The post title (the main text — bold, above the image).
 *   upvotes     e.g. "2.4k". Default "1.2k".
 *   comments    e.g. "128". Default "84".
 *   aspect      "wide" (default, 1200×675) | "square" (1080×1080) —
 *               sets the image area's ratio AND the export label.
 *   image-only  Presence (or "true", e.g. a DC-bound image-only="{{ imagesOnly }}")
 *               strips the phone and all app chrome, showing JUST the
 *               asset frame — the "[images only / product shells]" tweak.
 *               Pure CSS: toggles live with no rebuild, export identical.
 *   width       Phone outer width px (default 428).
 *
 * The image area IS the export frame (data-om-frame-export, labeled
 * "Reddit post · W×H") — inside a <social-frames> board it gets the
 * label bar + exact-size download automatically.
 */
/* END USAGE */

(function () {
  if (typeof HTMLElement !== 'function' || customElements.get('reddit-shell')) return;

  var CSS =
    'reddit-shell{display:block}' +
    'reddit-shell .rds{display:flex;flex-direction:column;height:100%;background:#fff;' +
    'font-family:-apple-system,system-ui,sans-serif;color:#1a1a1b}' +
    'reddit-shell .rds-top{display:flex;align-items:center;gap:12px;padding:58px 16px 10px;' +
    'border-bottom:.5px solid #e0e0e0}' +
    'reddit-shell .rds-back{color:#1a1a1b}' +
    'reddit-shell .rds-topc{font-size:15px;font-weight:700;flex:1}' +
    'reddit-shell .rds-head{display:flex;align-items:center;gap:9px;padding:12px 14px 6px}' +
    'reddit-shell .rds-cav{width:32px;height:32px;border-radius:50%;flex:none;' +
    'background:linear-gradient(135deg,#ff6a3d 0%,#ff9b63 100%)}' +
    'reddit-shell .rds-cname{font-size:13px;font-weight:700;line-height:1.3}' +
    'reddit-shell .rds-sub{font-size:11.5px;color:#7c7c7c;line-height:1.3}' +
    'reddit-shell .rds-join{margin-left:auto;background:#ff4500;color:#fff;border:0;' +
    'border-radius:999px;padding:6px 14px;font-size:12.5px;font-weight:700}' +
    'reddit-shell .rds-title{padding:4px 14px 10px;font-size:16px;font-weight:600;line-height:1.35}' +
    'reddit-shell .rds-img{position:relative;width:100%;background:#f0f0f0}' +
    'reddit-shell .rds-bar{display:flex;align-items:center;gap:10px;padding:10px 14px}' +
    'reddit-shell .rds-chip{display:flex;align-items:center;gap:7px;border:1px solid #e0e0e0;' +
    'border-radius:999px;padding:7px 13px;font-size:13px;font-weight:600;color:#333}' +
    'reddit-shell .rds-chip svg{display:block}' +
    'reddit-shell .rds-spacer{flex:1}' +
    'reddit-shell .rds-tabs{margin-top:auto;display:flex;align-items:center;' +
    'justify-content:space-around;padding:12px 10px 30px;border-top:.5px solid #e0e0e0;color:#1a1a1b}';

  // IMPORTANT: the image-only selectors below match ONLY [image-only=""]
  // (authored presence) and [image-only="true"] — never bare [image-only].
  // A DC binding image-only="{{ imagesOnly }}" renders the string "false"
  // when off, which a bare attribute selector would match, locking the
  // shell in image-only mode. Don't "simplify" these.
  var IO_CSS =
    // image-only mode: strip ALL presentation (phone bezel + app chrome),
    // leaving just the export frame — the asset alone. Pure CSS, so a DC
    // tweak flipping the attribute toggles instantly with no rebuild and
    // no state loss; exports are identical in both modes (same frame,
    // same label, same slot).
    'reddit-shell[image-only=""] > ios-shell[data-composed-phone],reddit-shell[image-only="true"] > ios-shell[data-composed-phone]' + '{background:transparent;padding:0;border-radius:0;box-shadow:none;width:auto !important}' +
    'reddit-shell[image-only=""] > ios-shell[data-composed-phone] > .ios-screen,reddit-shell[image-only="true"] > ios-shell[data-composed-phone] > .ios-screen' + '{height:auto !important;border-radius:0;overflow:visible;background:transparent}' +
    'reddit-shell[image-only=""] > ios-shell[data-composed-phone] > .ios-screen > .ios-island,reddit-shell[image-only="true"] > ios-shell[data-composed-phone] > .ios-screen > .ios-island' + ',' + 'reddit-shell[image-only=""] > ios-shell[data-composed-phone] > .ios-screen > .ios-statusbar,reddit-shell[image-only="true"] > ios-shell[data-composed-phone] > .ios-screen > .ios-statusbar' + ',' + 'reddit-shell[image-only=""] > ios-shell[data-composed-phone] > .ios-screen > .ios-homebar,reddit-shell[image-only="true"] > ios-shell[data-composed-phone] > .ios-screen > .ios-homebar' + '{display:none}' +
    'reddit-shell[image-only=""] > ios-shell[data-composed-phone] > .ios-screen > .ios-content,reddit-shell[image-only="true"] > ios-shell[data-composed-phone] > .ios-screen > .ios-content' + '{position:static !important}' +
    'reddit-shell[image-only=""] .rds-top,reddit-shell[image-only="true"] .rds-top' + '{display:none}' +
    'reddit-shell[image-only=""] .rds-head,reddit-shell[image-only="true"] .rds-head' + '{display:none}' +
    'reddit-shell[image-only=""] .rds-title,reddit-shell[image-only="true"] .rds-title' + '{display:none}' +
    'reddit-shell[image-only=""] .rds-bar,reddit-shell[image-only="true"] .rds-bar' + '{display:none}' +
    'reddit-shell[image-only=""] .rds-tabs,reddit-shell[image-only="true"] .rds-tabs' + '{display:none}' +
    'reddit-shell[image-only=""] .rds,reddit-shell[image-only="true"] .rds' + '{width:var(--shell-inner-w,402px);background:transparent}' +
    '';

  function ensureCss() {
    if (document.getElementById('reddit-shell-css')) return;
    var s = document.createElement('style');
    s.id = 'reddit-shell-css';
    s.textContent = CSS + IO_CSS;
    document.head.appendChild(s);
  }

  var L = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
  var UP = '<svg width="17" height="17" viewBox="0 0 24 24" ' + L + '><path d="M12 20V5M5.5 11.5 12 5l6.5 6.5"></path></svg>';
  var DOWN = '<svg width="17" height="17" viewBox="0 0 24 24" ' + L + '><path d="M12 4v15M5.5 12.5 12 19l6.5-6.5"></path></svg>';
  var BUBBLE = '<svg width="16" height="16" viewBox="0 0 24 24" ' + L + '><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 20.5l1.4-4.2A8.4 8.4 0 0 1 3.6 7.5 8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z"></path></svg>';
  var SHARE = '<svg width="16" height="16" viewBox="0 0 24 24" ' + L + '><path d="M13 5.5 20 12l-7 6.5V14c-5 0-8 1.6-10 5 .6-5.7 3.4-9.3 10-10V5.5z"></path></svg>';
  var BACK = '<svg width="22" height="22" viewBox="0 0 24 24" ' + L + '><path d="M15 19 8 12l7-7"></path></svg>';
  var DOTS = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.7"></circle><circle cx="12" cy="12" r="1.7"></circle><circle cx="19" cy="12" r="1.7"></circle></svg>';
  var TABS =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M3 10 12 2.5 21 10v11h-6.6v-6.8H9.6V21H3V10z"></path></svg>' +
    '<svg width="24" height="24" viewBox="0 0 24 24" ' + L + '><circle cx="12" cy="12" r="7"></circle><ellipse cx="12" cy="12" rx="10.5" ry="4" transform="rotate(-18 12 12)"></ellipse></svg>' +
    '<svg width="24" height="24" viewBox="0 0 24 24" ' + L + '><path d="M12 5v14M5 12h14"></path></svg>' +
    BUBBLE.replace('width="16" height="16"', 'width="23" height="23"') +
    '<svg width="24" height="24" viewBox="0 0 24 24" ' + L + '><path d="M18 9a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7M10.3 20a2 2 0 0 0 3.4 0"></path><circle cx="18" cy="5" r="3" fill="#ff4500" stroke="none"></circle></svg>';

  customElements.define('reddit-shell', class extends HTMLElement {
    connectedCallback() {
      if (this.closest && this.closest('x-dc')) return;
      if (document.readyState === 'loading') {
        var self = this;
        document.addEventListener('DOMContentLoaded', function () { self._build(); });
      } else this._build();
    }
    _build() {
      if (this.closest && this.closest('x-dc')) return;
      if (this.querySelector(':scope > ios-shell[data-composed-phone]')) return;
      ensureCss();

      var a = function (host, n, d) { return host.getAttribute(n) || d; };
      var community = a(this, 'community', 'r/yourcommunity');
      var square = a(this, 'aspect', 'wide') === 'square';
      var label = square
        ? 'Reddit post · 1080×1080'
        : 'Reddit post · 1200×675';
      var slotId = (this.id || 'rd') + '-photo';
      var extras = [].slice.call(this.childNodes);

      var app = document.createElement('div');
      app.className = 'rds';

      var top = document.createElement('div');
      top.className = 'rds-top';
      top.innerHTML = '<span class="rds-back">' + BACK + '</span><span class="rds-topc"></span>' + DOTS;
      top.querySelector('.rds-topc').textContent = community;

      var head = document.createElement('div');
      head.className = 'rds-head';
      head.innerHTML =
        '<div class="rds-cav"></div>' +
        '<div style="flex:1"><div class="rds-cname"></div><div class="rds-sub"></div></div>' +
        '<button class="rds-join">Join</button>';
      head.querySelector('.rds-cname').textContent = community;
      head.querySelector('.rds-sub').textContent =
        a(this, 'username', 'u/yourbrand') + ' · ' + a(this, 'time', '5h');

      var title = document.createElement('div');
      title.className = 'rds-title';
      title.textContent = a(this, 'title', '');
      if (!title.textContent) title.style.display = 'none';

      var img = document.createElement('div');
      img.className = 'rds-img';
      img.style.aspectRatio = square ? '1/1' : '1200/675';
      img.setAttribute('data-om-frame-export', '');
      img.setAttribute('data-om-frame-label', label);
      var slot = document.createElement('image-slot');
      slot.setAttribute('id', slotId);
      slot.setAttribute('fit', 'cover');
      slot.setAttribute('shape', 'rect');
      slot.setAttribute('radius', '0');
      slot.setAttribute('placeholder', 'Drop the post image');
      if (a(this, 'image-src', '')) slot.setAttribute('src', a(this, 'image-src', ''));
      // Stock photos require attribution: without credit attrs the host
      // renders an error tile over the image (product behavior). Forward
      // them whenever the image came from search_stock_photos.
      if (a(this, 'image-credit', '')) slot.setAttribute('credit', a(this, 'image-credit', ''));
      if (a(this, 'image-credit-href', '')) slot.setAttribute('credit-href', a(this, 'image-credit-href', ''));
      slot.style.cssText = 'display:block;position:absolute;inset:0;width:100%;height:100%';
      img.appendChild(slot);

      var bar = document.createElement('div');
      bar.className = 'rds-bar';
      bar.innerHTML =
        '<span class="rds-chip">' + UP + '<span class="rds-up"></span>' + DOWN + '</span>' +
        '<span class="rds-chip">' + BUBBLE + '<span class="rds-cm"></span></span>' +
        '<span class="rds-spacer"></span>' +
        '<span class="rds-chip">' + SHARE + 'Share</span>';
      bar.querySelector('.rds-up').textContent = a(this, 'upvotes', '1.2k');
      bar.querySelector('.rds-cm').textContent = a(this, 'comments', '84');

      var tabs = document.createElement('div');
      tabs.className = 'rds-tabs';
      tabs.innerHTML = TABS;

      app.appendChild(top);
      app.appendChild(head);
      app.appendChild(title);
      app.appendChild(img);
      app.appendChild(bar);
      app.appendChild(tabs);
      extras.forEach(function (n) { img.appendChild(n); });

      var phone = document.createElement('ios-shell');
      phone.setAttribute('data-composed-phone', '');
      var outerW = parseInt(a(this, 'width', '428'), 10) || 428;
      phone.setAttribute('width', String(outerW));
      this.style.setProperty('--shell-inner-w', (outerW - 26) + 'px');
      var innerW = outerW - 26;
      // Post-detail screens are shorter than feeds; square images need more.
      // ONE height for every shell and aspect (product direction: phones are
      // uniform across the board; content fits via the compressible meta).
      var screenH = Math.round(innerW * 874 / 402);
      phone.setAttribute('screen-height', String(screenH));
      phone.appendChild(app);
      this.appendChild(phone);
      if (phone._build && customElements.get('ios-shell')) phone._build();
    }
  });
})();
