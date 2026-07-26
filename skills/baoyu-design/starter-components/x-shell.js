/* BEGIN USAGE */
/**
 * <x-shell> — finished X-style post-detail UI, attribute-driven.
 *
 * A complete, pre-designed post screen inside an iPhone (composes the
 * ios-shell starter — load ios-shell.js and image-slot.js alongside).
 * No logos or wordmarks. Claude fills attributes; never hand-build this.
 *
 * Attributes:
 *   image-credit / image-credit-href   Attribution for a stock photo in
 *               image-src (REQUIRED for Unsplash results — the host shows
 *               an error tile without it); forwarded to the internal slot.
 *   image-src   Prefill for the media (image-slot underneath; give the
 *               ELEMENT an id so drops persist).
 *   name        Author display name. Default "Your brand".
 *   handle      e.g. "@yourbrand". Default "@yourbrand".
 *   avatar-src  Avatar image URL (else a neutral gradient disc).
 *   text        The post copy (above the media).
 *   time        e.g. "2:14 PM · Jul 6, 2026". Default "9:41 AM · Today".
 *   views       e.g. "48.1K". Default "12.4K".
 *   replies / reposts / likes   Counts. Defaults "88" / "340" / "1.2K".
 *   aspect      "wide" (default, 1200×675) | "square" (1080×1080).
 *   image-only  Presence (or "true", e.g. a DC-bound image-only="{{ imagesOnly }}")
 *               strips the phone and all app chrome, showing JUST the
 *               asset frame — the "[images only / product shells]" tweak.
 *               Pure CSS: toggles live with no rebuild, export identical.
 *   width       Phone outer width px (default 428).
 *
 * Attributes are read ONCE at build; only image-only toggles live (it's
 * pure CSS). To change copy/counts, re-author the element.
 *
 * The media area IS the export frame (labeled "X post · W×H").
 */
/* END USAGE */

(function () {
  if (typeof HTMLElement !== 'function' || customElements.get('x-shell')) return;

  var CSS =
    'x-shell{display:block}' +
    'x-shell .xs{display:flex;flex-direction:column;height:100%;background:#fff;' +
    'font-family:-apple-system,system-ui,sans-serif;color:#0f1419}' +
    'x-shell .xs-top{display:flex;align-items:center;gap:22px;padding:58px 16px 10px}' +
    'x-shell .xs-topt{font-size:17px;font-weight:700}' +
    'x-shell .xs-head{display:flex;align-items:center;gap:10px;padding:12px 16px 4px}' +
    'x-shell .xs-av{width:40px;height:40px;border-radius:50%;flex:none;' +
    'background:linear-gradient(135deg,#e8e0d8 0%,#c9c2ba 100%) center/cover no-repeat}' +
    'x-shell .xs-name{font-size:15px;font-weight:700;line-height:1.25}' +
    'x-shell .xs-handle{font-size:14px;color:#536471;line-height:1.25}' +
    'x-shell .xs-follow{margin-left:auto;background:#0f1419;color:#fff;border:0;' +
    'border-radius:999px;padding:7px 16px;font-size:14px;font-weight:700}' +
    'x-shell .xs-text{padding:8px 16px 12px;font-size:16.5px;line-height:1.4}' +
    'x-shell .xs-media{position:relative;margin:0 16px;border-radius:16px;overflow:hidden;' +
    'border:1px solid #e1e8ed;background:#f0f0f0}' +
    'x-shell .xs-media [data-om-frame-export]{border:0 !important;border-radius:0 !important}' +
    'x-shell .xs-time{padding:14px 16px 12px;font-size:14px;color:#536471;' +
    'border-bottom:.5px solid #e1e8ed}' +
    'x-shell .xs-time b{color:#0f1419;font-weight:700}' +
    'x-shell .xs-acts{display:flex;align-items:center;justify-content:space-around;' +
    'padding:10px 10px;border-bottom:.5px solid #e1e8ed;color:#6b7580}' +
    'x-shell .xs-act{display:flex;align-items:center;gap:5px;font-size:13px}' +
    'x-shell .xs-act svg{display:block}' +
    'x-shell .xs-tabs{margin-top:auto;display:flex;align-items:center;' +
    'justify-content:space-around;padding:12px 10px 30px;border-top:.5px solid #e1e8ed;color:#0f1419}';

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
    'x-shell[image-only=""] > ios-shell[data-composed-phone],x-shell[image-only="true"] > ios-shell[data-composed-phone]' + '{background:transparent;padding:0;border-radius:0;box-shadow:none;width:auto !important}' +
    'x-shell[image-only=""] > ios-shell[data-composed-phone] > .ios-screen,x-shell[image-only="true"] > ios-shell[data-composed-phone] > .ios-screen' + '{height:auto !important;border-radius:0;overflow:visible;background:transparent}' +
    'x-shell[image-only=""] > ios-shell[data-composed-phone] > .ios-screen > .ios-island,x-shell[image-only="true"] > ios-shell[data-composed-phone] > .ios-screen > .ios-island' + ',' + 'x-shell[image-only=""] > ios-shell[data-composed-phone] > .ios-screen > .ios-statusbar,x-shell[image-only="true"] > ios-shell[data-composed-phone] > .ios-screen > .ios-statusbar' + ',' + 'x-shell[image-only=""] > ios-shell[data-composed-phone] > .ios-screen > .ios-homebar,x-shell[image-only="true"] > ios-shell[data-composed-phone] > .ios-screen > .ios-homebar' + '{display:none}' +
    'x-shell[image-only=""] > ios-shell[data-composed-phone] > .ios-screen > .ios-content,x-shell[image-only="true"] > ios-shell[data-composed-phone] > .ios-screen > .ios-content' + '{position:static !important}' +
    'x-shell[image-only=""] .xs-top,x-shell[image-only="true"] .xs-top' + '{display:none}' +
    'x-shell[image-only=""] .xs-head,x-shell[image-only="true"] .xs-head' + '{display:none}' +
    'x-shell[image-only=""] .xs-text,x-shell[image-only="true"] .xs-text' + '{display:none}' +
    'x-shell[image-only=""] .xs-time,x-shell[image-only="true"] .xs-time' + '{display:none}' +
    'x-shell[image-only=""] .xs-acts,x-shell[image-only="true"] .xs-acts' + '{display:none}' +
    'x-shell[image-only=""] .xs-tabs,x-shell[image-only="true"] .xs-tabs' + '{display:none}' +
    'x-shell[image-only=""] .xs,x-shell[image-only="true"] .xs' + '{width:var(--shell-inner-w,402px);background:transparent}' +
    'x-shell[image-only=""] .xs-media,x-shell[image-only="true"] .xs-media' + '{margin:0;border:0;border-radius:0}' +
    '';

  function ensureCss() {
    if (document.getElementById('x-shell-css')) return;
    var s = document.createElement('style');
    s.id = 'x-shell-css';
    s.textContent = CSS + IO_CSS;
    document.head.appendChild(s);
  }

  var L = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
  var BACK = '<svg width="22" height="22" viewBox="0 0 24 24" ' + L + '><path d="M15 19 8 12l7-7"></path></svg>';
  var REPLY = '<svg width="18" height="18" viewBox="0 0 24 24" ' + L + '><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 20.5l1.4-4.2A8.4 8.4 0 0 1 3.6 7.5 8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z"></path></svg>';
  var RT = '<svg width="18" height="18" viewBox="0 0 24 24" ' + L + '><path d="M17 2.5 21 7l-4 4.5M21 7H8a4 4 0 0 0-4 4v1M7 21.5 3 17l4-4.5M3 17h13a4 4 0 0 0 4-4v-1"></path></svg>';
  var HEART = '<svg width="18" height="18" viewBox="0 0 24 24" ' + L + '><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"></path></svg>';
  var BOOK = '<svg width="18" height="18" viewBox="0 0 24 24" ' + L + '><path d="M6 3h12v18l-6-4.5L6 21V3z"></path></svg>';
  var SHARE = '<svg width="18" height="18" viewBox="0 0 24 24" ' + L + '><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 15V3M7.5 7.5 12 3l4.5 4.5"></path></svg>';
  var TABS =
    '<svg width="25" height="25" viewBox="0 0 24 24" fill="currentColor"><path d="M3 10 12 2.5 21 10v11h-6.6v-6.8H9.6V21H3V10z"></path></svg>' +
    '<svg width="24" height="24" viewBox="0 0 24 24" ' + L + '><circle cx="11" cy="11" r="7"></circle><path d="M21 21l-4.5-4.5"></path></svg>' +
    '<svg width="24" height="24" viewBox="0 0 24 24" ' + L + '><path d="M18 9a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7M10.3 20a2 2 0 0 0 3.4 0"></path></svg>' +
    '<svg width="24" height="24" viewBox="0 0 24 24" ' + L + '><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="m3 7 9 6 9-6"></path></svg>';

  customElements.define('x-shell', class extends HTMLElement {
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
      var square = a(this, 'aspect', 'wide') === 'square';
      var label = square ? 'X post · 1080×1080' : 'X post · 1200×675';
      var slotId = (this.id || 'x') + '-photo';
      var extras = [].slice.call(this.childNodes);

      var app = document.createElement('div');
      app.className = 'xs';

      var top = document.createElement('div');
      top.className = 'xs-top';
      top.innerHTML = BACK + '<span class="xs-topt">Post</span>';

      var head = document.createElement('div');
      head.className = 'xs-head';
      head.innerHTML =
        '<div class="xs-av"></div>' +
        '<div style="flex:1"><div class="xs-name"></div><div class="xs-handle"></div></div>' +
        '<button class="xs-follow">Follow</button>';
      // Avatar URL: style property API only (never innerHTML concat —
      // attribute breakout), CSS-string escaped.
      var avatarSrc = a(this, 'avatar-src', '');
      if (avatarSrc) {
        head.querySelector('.xs-av').style.backgroundImage =
          'url("' + avatarSrc.replace(/[\\"]/g, function (ch) { return String.fromCharCode(92) + ch; }) + '")';
      }
      head.querySelector('.xs-name').textContent = a(this, 'name', 'Your brand');
      head.querySelector('.xs-handle').textContent = a(this, 'handle', '@yourbrand');

      var text = document.createElement('div');
      text.className = 'xs-text';
      text.textContent = a(this, 'text', '');
      if (!text.textContent) text.style.display = 'none';

      var media = document.createElement('div');
      media.className = 'xs-media';
      var frame = document.createElement('div');
      frame.style.cssText = 'position:relative;width:100%';
      frame.style.aspectRatio = square ? '1/1' : '1200/675';
      frame.setAttribute('data-om-frame-export', '');
      frame.setAttribute('data-om-frame-label', label);
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
      frame.appendChild(slot);
      media.appendChild(frame);

      var time = document.createElement('div');
      time.className = 'xs-time';
      time.innerHTML = '<span class="xs-t"></span> · <b class="xs-v"></b> Views';
      time.querySelector('.xs-t').textContent = a(this, 'time', '9:41 AM · Today');
      time.querySelector('.xs-v').textContent = a(this, 'views', '12.4K');

      var acts = document.createElement('div');
      acts.className = 'xs-acts';
      acts.innerHTML =
        '<span class="xs-act">' + REPLY + '<span class="xs-r"></span></span>' +
        '<span class="xs-act">' + RT + '<span class="xs-rt"></span></span>' +
        '<span class="xs-act">' + HEART + '<span class="xs-l"></span></span>' +
        '<span class="xs-act">' + BOOK + '</span>' +
        '<span class="xs-act">' + SHARE + '</span>';
      acts.querySelector('.xs-r').textContent = a(this, 'replies', '88');
      acts.querySelector('.xs-rt').textContent = a(this, 'reposts', '340');
      acts.querySelector('.xs-l').textContent = a(this, 'likes', '1.2K');

      var tabs = document.createElement('div');
      tabs.className = 'xs-tabs';
      tabs.innerHTML = TABS;

      app.appendChild(top);
      app.appendChild(head);
      app.appendChild(text);
      app.appendChild(media);
      app.appendChild(time);
      app.appendChild(acts);
      app.appendChild(tabs);
      extras.forEach(function (n) { frame.appendChild(n); });

      var phone = document.createElement('ios-shell');
      phone.setAttribute('data-composed-phone', '');
      var outerW = parseInt(a(this, 'width', '428'), 10) || 428;
      phone.setAttribute('width', String(outerW));
      this.style.setProperty('--shell-inner-w', (outerW - 26) + 'px');
      var innerW = outerW - 26;
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
