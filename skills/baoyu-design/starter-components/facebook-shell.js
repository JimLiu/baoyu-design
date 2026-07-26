/* BEGIN USAGE */
/**
 * <facebook-shell> — finished Facebook-style feed post UI, attribute-
 * driven. A complete, pre-designed feed screen inside an iPhone
 * (composes the ios-shell starter — load ios-shell.js and image-slot.js
 * alongside). No logos or wordmarks. Claude fills attributes; never
 * hand-build this chrome.
 *
 * Attributes:
 *   image-credit / image-credit-href   Attribution for a stock photo in
 *               image-src (REQUIRED for Unsplash results — the host shows
 *               an error tile without it); forwarded to the internal slot.
 *   image-src   Prefill for the media (image-slot underneath; give the
 *               ELEMENT an id so drops persist).
 *   name        Page/author name. Default "Your brand".
 *   time        e.g. "2h". Default "2h" (renders "2h · 🌐").
 *   avatar-src  Avatar image URL (else a neutral gradient disc).
 *   text        The post copy (above the media).
 *   likes       Reaction count, e.g. "1.2K". Default "1.2K".
 *   comments    e.g. "84 comments". Default "84 comments".
 *   shares      e.g. "23 shares". Default "23 shares".
 *   aspect      "wide" (default, 1200×630) | "square" (1080×1080).
 *   image-only  Presence (or "true", e.g. a DC-bound image-only="{{ imagesOnly }}")
 *               strips the phone and all app chrome, showing JUST the
 *               asset frame — the "[images only / product shells]" tweak.
 *               Pure CSS: toggles live with no rebuild, export identical.
 *   width       Phone outer width px (default 428).
 *
 * Attributes are read ONCE at build; only image-only toggles live (it's
 * pure CSS). To change copy/counts, re-author the element.
 *
 * The media area IS the export frame (labeled "Facebook post · W×H").
 */
/* END USAGE */

(function () {
  if (typeof HTMLElement !== 'function' || customElements.get('facebook-shell')) return;

  var CSS =
    'facebook-shell{display:block}' +
    'facebook-shell .fbs{display:flex;flex-direction:column;height:100%;background:#f0f2f5;' +
    'font-family:-apple-system,system-ui,sans-serif;color:#050505}' +
    'facebook-shell .fbs-top{display:flex;align-items:center;justify-content:space-between;' +
    'padding:58px 16px 10px;background:#fff}' +
    'facebook-shell .fbs-home{font-size:22px;font-weight:800;letter-spacing:-.4px;color:#050505}' +
    'facebook-shell .fbs-icons{display:flex;gap:12px;align-items:center}' +
    'facebook-shell .fbs-icb{width:36px;height:36px;border-radius:50%;background:#e4e6eb;' +
    'display:flex;align-items:center;justify-content:center;color:#050505}' +
    'facebook-shell .fbs-card{background:#fff;margin-top:8px}' +
    'facebook-shell .fbs-head{display:flex;align-items:center;gap:9px;padding:12px 14px 8px}' +
    'facebook-shell .fbs-av{width:40px;height:40px;border-radius:50%;flex:none;' +
    'background:linear-gradient(135deg,#e8e0d8 0%,#c9c2ba 100%) center/cover no-repeat}' +
    'facebook-shell .fbs-name{font-size:15px;font-weight:600;line-height:1.25}' +
    'facebook-shell .fbs-sub{font-size:12.5px;color:#65676b;line-height:1.25;' +
    'display:flex;align-items:center;gap:4px}' +
    'facebook-shell .fbs-text{padding:0 14px 10px;font-size:15px;line-height:1.35}' +
    'facebook-shell .fbs-media{position:relative;width:100%;background:#f0f0f0}' +
    'facebook-shell .fbs-counts{display:flex;align-items:center;justify-content:space-between;' +
    'padding:10px 14px;font-size:13.5px;color:#65676b}' +
    'facebook-shell .fbs-reacts{display:flex;align-items:center;gap:5px}' +
    'facebook-shell .fbs-blob{width:18px;height:18px;border-radius:50%;background:#1877f2;' +
    'display:inline-flex;align-items:center;justify-content:center;color:#fff}' +
    'facebook-shell .fbs-blob.love{background:#f33e58;margin-left:-6px}' +
    'facebook-shell .fbs-bar{display:flex;align-items:center;border-top:.5px solid #e4e6eb;' +
    'margin:0 10px;padding:2px 0}' +
    'facebook-shell .fbs-act{flex:1;display:flex;align-items:center;justify-content:center;gap:7px;' +
    'padding:9px 0;font-size:14px;font-weight:600;color:#65676b}' +
    'facebook-shell .fbs-act svg{display:block}' +
    'facebook-shell .fbs-tabs{margin-top:auto;display:flex;align-items:center;' +
    'justify-content:space-around;padding:12px 10px 30px;background:#fff;' +
    'border-top:.5px solid #e4e6eb;color:#65676b}';

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
    'facebook-shell[image-only=""] > ios-shell[data-composed-phone],facebook-shell[image-only="true"] > ios-shell[data-composed-phone]' + '{background:transparent;padding:0;border-radius:0;box-shadow:none;width:auto !important}' +
    'facebook-shell[image-only=""] > ios-shell[data-composed-phone] > .ios-screen,facebook-shell[image-only="true"] > ios-shell[data-composed-phone] > .ios-screen' + '{height:auto !important;border-radius:0;overflow:visible;background:transparent}' +
    'facebook-shell[image-only=""] > ios-shell[data-composed-phone] > .ios-screen > .ios-island,facebook-shell[image-only="true"] > ios-shell[data-composed-phone] > .ios-screen > .ios-island' + ',' + 'facebook-shell[image-only=""] > ios-shell[data-composed-phone] > .ios-screen > .ios-statusbar,facebook-shell[image-only="true"] > ios-shell[data-composed-phone] > .ios-screen > .ios-statusbar' + ',' + 'facebook-shell[image-only=""] > ios-shell[data-composed-phone] > .ios-screen > .ios-homebar,facebook-shell[image-only="true"] > ios-shell[data-composed-phone] > .ios-screen > .ios-homebar' + '{display:none}' +
    'facebook-shell[image-only=""] > ios-shell[data-composed-phone] > .ios-screen > .ios-content,facebook-shell[image-only="true"] > ios-shell[data-composed-phone] > .ios-screen > .ios-content' + '{position:static !important}' +
    'facebook-shell[image-only=""] .fbs-top,facebook-shell[image-only="true"] .fbs-top' + '{display:none}' +
    'facebook-shell[image-only=""] .fbs-head,facebook-shell[image-only="true"] .fbs-head' + '{display:none}' +
    'facebook-shell[image-only=""] .fbs-text,facebook-shell[image-only="true"] .fbs-text' + '{display:none}' +
    'facebook-shell[image-only=""] .fbs-counts,facebook-shell[image-only="true"] .fbs-counts' + '{display:none}' +
    'facebook-shell[image-only=""] .fbs-bar,facebook-shell[image-only="true"] .fbs-bar' + '{display:none}' +
    'facebook-shell[image-only=""] .fbs-tabs,facebook-shell[image-only="true"] .fbs-tabs' + '{display:none}' +
    'facebook-shell[image-only=""] .fbs,facebook-shell[image-only="true"] .fbs' + '{width:var(--shell-inner-w,402px);background:transparent}' +
    'facebook-shell[image-only=""] .fbs-card,facebook-shell[image-only="true"] .fbs-card' + '{margin:0;background:transparent}' +
    '';

  function ensureCss() {
    if (document.getElementById('facebook-shell-css')) return;
    var s = document.createElement('style');
    s.id = 'facebook-shell-css';
    s.textContent = CSS + IO_CSS;
    document.head.appendChild(s);
  }

  var L = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
  var SEARCH = '<svg width="19" height="19" viewBox="0 0 24 24" ' + L + '><circle cx="11" cy="11" r="7"></circle><path d="M21 21l-4.5-4.5"></path></svg>';
  var MSG = '<svg width="19" height="19" viewBox="0 0 24 24" ' + L + '><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 20.5l1.4-4.2A8.4 8.4 0 0 1 3.6 7.5 8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z"></path></svg>';
  var GLOBE = '<svg width="12" height="12" viewBox="0 0 24 24" ' + L.replace('1.8', '2') + '><circle cx="12" cy="12" r="9"></circle><path d="M3 12h18M12 3a13.5 13.5 0 0 1 0 18 13.5 13.5 0 0 1 0-18z"></path></svg>';
  var LIKE = '<svg width="18" height="18" viewBox="0 0 24 24" ' + L + '><path d="M7 11v9M7 11l4-7a2.4 2.4 0 0 1 2.3 3l-.8 3h5.6a2 2 0 0 1 2 2.4l-1.2 5a2 2 0 0 1-2 1.6H7M7 11H4a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h3"></path></svg>';
  var THUMB = '<svg width="11" height="11" viewBox="0 0 24 24" fill="#fff"><path d="M7 11l4.2-7.4A2.2 2.2 0 0 1 13.4 6l-.8 3.4h6a1.8 1.8 0 0 1 1.8 2.2l-1.3 5.6a1.8 1.8 0 0 1-1.8 1.4H7z"></path></svg>';
  var HEARTF = '<svg width="10" height="10" viewBox="0 0 24 24" fill="#fff"><path d="M12 21 4.2 13.4a5.5 5.5 0 0 1 7.8-7.8 5.5 5.5 0 0 1 7.8 7.8z"></path></svg>';
  var COMMENT = MSG.replace(/19/g, '18');
  var SHARE = '<svg width="18" height="18" viewBox="0 0 24 24" ' + L + '><path d="M13 5.5 20 12l-7 6.5V14c-5 0-8 1.6-10 5 .6-5.7 3.4-9.3 10-10V5.5z"></path></svg>';
  var TABS =
    '<svg width="25" height="25" viewBox="0 0 24 24" fill="#1877f2"><path d="M3 10 12 2.5 21 10v11h-6.6v-6.8H9.6V21H3V10z"></path></svg>' +
    '<svg width="25" height="25" viewBox="0 0 24 24" ' + L + '><rect x="3" y="4" width="18" height="14" rx="2"></rect><path d="m10 8.5 5 3-5 3v-6z"></path></svg>' +
    '<svg width="25" height="25" viewBox="0 0 24 24" ' + L + '><path d="M4 9h16M4 9l1-4h14l1 4M4 9c0 1.4 1 2.5 2.3 2.5S8.5 10.4 8.5 9m0 0c0 1.4 1.1 2.5 2.4 2.5S13 10.4 13 9m0 0c0 1.4 1.1 2.5 2.4 2.5S17.7 10.4 17.7 9M5.5 11.5V20h13v-8.5M9.5 20v-5h5v5"></path></svg>' +
    '<svg width="25" height="25" viewBox="0 0 24 24" ' + L + '><path d="M18 9a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7M10.3 20a2 2 0 0 0 3.4 0"></path></svg>' +
    '<svg width="25" height="25" viewBox="0 0 24 24" ' + L + '><path d="M4 7h16M4 12h16M4 17h16"></path></svg>';

  customElements.define('facebook-shell', class extends HTMLElement {
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
      var label = square ? 'Facebook post · 1080×1080' : 'Facebook post · 1200×630';
      var slotId = (this.id || 'fb') + '-photo';
      var extras = [].slice.call(this.childNodes);

      var app = document.createElement('div');
      app.className = 'fbs';

      var top = document.createElement('div');
      top.className = 'fbs-top';
      // Neutral: a plain "Feed" title (black, like the family's "Home"
      // move) — Santiago explicitly dropped the blue.
      top.innerHTML = '<div class="fbs-home">Feed</div><div class="fbs-icons">' +
        '<span class="fbs-icb">' + SEARCH + '</span><span class="fbs-icb">' + MSG + '</span></div>';

      var card = document.createElement('div');
      card.className = 'fbs-card';

      var head = document.createElement('div');
      head.className = 'fbs-head';
      head.innerHTML =
        '<div class="fbs-av"></div>' +
        '<div style="flex:1"><div class="fbs-name"></div>' +
        '<div class="fbs-sub"><span class="fbs-t"></span> · ' + GLOBE + '</div></div>';
      // Avatar URL: style property API only (never innerHTML concat —
      // attribute breakout), CSS-string escaped.
      var avatarSrc = a(this, 'avatar-src', '');
      if (avatarSrc) {
        head.querySelector('.fbs-av').style.backgroundImage =
          'url("' + avatarSrc.replace(/[\\"]/g, function (ch) { return String.fromCharCode(92) + ch; }) + '")';
      }
      head.querySelector('.fbs-name').textContent = a(this, 'name', 'Your brand');
      head.querySelector('.fbs-t').textContent = a(this, 'time', '2h');

      var text = document.createElement('div');
      text.className = 'fbs-text';
      text.textContent = a(this, 'text', '');
      if (!text.textContent) text.style.display = 'none';

      var media = document.createElement('div');
      media.className = 'fbs-media';
      media.style.aspectRatio = square ? '1/1' : '1200/630';
      media.setAttribute('data-om-frame-export', '');
      media.setAttribute('data-om-frame-label', label);
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
      media.appendChild(slot);

      var counts = document.createElement('div');
      counts.className = 'fbs-counts';
      counts.innerHTML =
        '<span class="fbs-reacts"><span class="fbs-blob">' + THUMB + '</span>' +
        '<span class="fbs-blob love">' + HEARTF + '</span><span class="fbs-lk"></span></span>' +
        '<span><span class="fbs-cm"></span> · <span class="fbs-sh"></span></span>';
      counts.querySelector('.fbs-lk').textContent = a(this, 'likes', '1.2K');
      counts.querySelector('.fbs-cm').textContent = a(this, 'comments', '84 comments');
      counts.querySelector('.fbs-sh').textContent = a(this, 'shares', '23 shares');

      var bar = document.createElement('div');
      bar.className = 'fbs-bar';
      bar.innerHTML =
        '<span class="fbs-act">' + LIKE + 'Like</span>' +
        '<span class="fbs-act">' + COMMENT + 'Comment</span>' +
        '<span class="fbs-act">' + SHARE + 'Share</span>';

      card.appendChild(head);
      card.appendChild(text);
      card.appendChild(media);
      card.appendChild(counts);
      card.appendChild(bar);
      extras.forEach(function (n) { media.appendChild(n); });

      var tabs = document.createElement('div');
      tabs.className = 'fbs-tabs';
      tabs.innerHTML = TABS;

      app.appendChild(top);
      app.appendChild(card);
      app.appendChild(tabs);

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
