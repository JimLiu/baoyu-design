/* BEGIN USAGE */
/**
 * <instagram-shell> — finished Instagram-style post UI, attribute-driven.
 *
 * A complete, pre-designed photo-feed post screen inside an iPhone
 * (composes the ios-shell starter internally — load ios-shell.js and
 * image-slot.js alongside this file). No logos or wordmarks: neutral
 * app chrome that reads unmistakably as the platform without naming it.
 * Claude fills attributes; never hand-build this chrome.
 *
 * Attributes (all optional except image handling):
 *   image-credit / image-credit-href   Attribution for a stock photo in
 *                 image-src (REQUIRED for Unsplash results — error tile
 *                 without it); forwarded to the internal slot.
 *   image-src     Prefill for the photo (image-slot underneath — users
 *                 can drop/replace; give the ELEMENT an id so the drop
 *                 persists: the slot id derives from it).
 *   username      e.g. "wild.remedy". Default "yourbrand".
 *   location      Subtitle under the username (place or context).
 *   avatar-src    Avatar image URL (else a neutral gradient disc).
 *   caption       Post caption (plain text; leading username bold is
 *                 automatic).
 *   likes         e.g. "2,418 likes". Default "1,024 likes".
 *   comments      e.g. "View all 92 comments" (hidden when empty).
 *   time          e.g. "14 hours ago". Default "2 hours ago".
 *   aspect        "square" (default, 1080×1080) | "portrait" (1080×1350)
 *                 — sets the photo area's ratio AND the export label. The
 *                 phone height is FIXED (uniform across a board); portrait
 *                 fits by compressing the caption block, like a real feed.
 *   image-only  Presence (or "true", e.g. a DC-bound image-only="{{ imagesOnly }}")
 *               strips the phone and all app chrome, showing JUST the
 *               asset frame — the "[images only / product shells]" tweak.
 *               Pure CSS: toggles live with no rebuild, export identical.
 *   width         Phone outer width px (default 428 — a 402px screen at
 *                 reference proportions; portrait raises the screen
 *                 height automatically so nothing crams).
 *
 * Attributes are read ONCE at build; only image-only toggles live (it's
 * pure CSS). To change copy/counts, re-author the element.
 *
 * The photo area IS the export frame (data-om-frame-export with the
 * aspect's label baked in) — inside a <social-frames> board it gets the
 * label bar + exact-size download automatically.
 */
/* END USAGE */

(function () {
  if (typeof HTMLElement !== 'function' || customElements.get('instagram-shell')) return;

  var CSS =
    'instagram-shell{display:block}' +
    'instagram-shell .igs{display:flex;flex-direction:column;height:100%;background:#fff;' +
    'font-family:-apple-system,system-ui,sans-serif;color:#000}' +
    'instagram-shell .igs-top{display:flex;align-items:center;justify-content:space-between;' +
    'padding:58px 16px 8px}' +
    'instagram-shell .igs-home{font-size:22px;font-weight:700;letter-spacing:-.4px}' +
    'instagram-shell .igs-icons{display:flex;gap:20px;align-items:center}' +
    'instagram-shell .igs-head{display:flex;align-items:center;gap:10px;padding:8px 14px}' +
    'instagram-shell .igs-av{width:34px;height:34px;border-radius:50%;padding:2px;box-sizing:border-box;' +
    'background:linear-gradient(45deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5);flex:none}' +
    'instagram-shell .igs-avi{width:100%;height:100%;border-radius:50%;box-sizing:border-box;' +
    'border:2px solid #fff;background:linear-gradient(135deg,#e8e0d8 0%,#c9c2ba 100%) center/cover no-repeat}' +
    'instagram-shell .igs-un{font-size:13px;font-weight:600;line-height:1.25}' +
    'instagram-shell .igs-loc{font-size:11px;line-height:1.25}' +
    'instagram-shell .igs-photo{position:relative;width:100%}' +
    'instagram-shell .igs-acts{display:flex;align-items:center;gap:15px;padding:8px 14px 4px}' +
    'instagram-shell .igs-acts .igs-sp{margin-left:auto}' +
    'instagram-shell .igs-meta{padding:0 14px;display:flex;flex-direction:column;gap:5px;' +
    'flex:0 1 auto;min-height:0;overflow:hidden}' +
    'instagram-shell .igs-likes{font-size:13px;font-weight:600}' +
    'instagram-shell .igs-cap{font-size:13px;line-height:1.4}' +
    'instagram-shell .igs-cap b{font-weight:600;margin-right:4px}' +
    'instagram-shell .igs-cmt{font-size:13px;color:#8e8e8e;margin-top:2px}' +
    'instagram-shell .igs-time{font-size:10px;color:#8e8e8e;letter-spacing:.3px;' +
    'text-transform:uppercase;margin-top:4px}' +
    'instagram-shell .igs-tabs{margin-top:auto;display:flex;align-items:center;' +
    'justify-content:space-between;padding:12px 22px 30px;border-top:.5px solid #dbdbdb}' +
    'instagram-shell .igs-tabav{width:26px;height:26px;border-radius:50%;box-sizing:border-box;' +
    'border:1.5px solid #000;background:linear-gradient(135deg,#e8e0d8 0%,#c9c2ba 100%) center/cover no-repeat}';

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
    'instagram-shell[image-only=""] > ios-shell[data-composed-phone],instagram-shell[image-only="true"] > ios-shell[data-composed-phone]' + '{background:transparent;padding:0;border-radius:0;box-shadow:none;width:auto !important}' +
    'instagram-shell[image-only=""] > ios-shell[data-composed-phone] > .ios-screen,instagram-shell[image-only="true"] > ios-shell[data-composed-phone] > .ios-screen' + '{height:auto !important;border-radius:0;overflow:visible;background:transparent}' +
    'instagram-shell[image-only=""] > ios-shell[data-composed-phone] > .ios-screen > .ios-island,instagram-shell[image-only="true"] > ios-shell[data-composed-phone] > .ios-screen > .ios-island' + ',' + 'instagram-shell[image-only=""] > ios-shell[data-composed-phone] > .ios-screen > .ios-statusbar,instagram-shell[image-only="true"] > ios-shell[data-composed-phone] > .ios-screen > .ios-statusbar' + ',' + 'instagram-shell[image-only=""] > ios-shell[data-composed-phone] > .ios-screen > .ios-homebar,instagram-shell[image-only="true"] > ios-shell[data-composed-phone] > .ios-screen > .ios-homebar' + '{display:none}' +
    'instagram-shell[image-only=""] > ios-shell[data-composed-phone] > .ios-screen > .ios-content,instagram-shell[image-only="true"] > ios-shell[data-composed-phone] > .ios-screen > .ios-content' + '{position:static !important}' +
    'instagram-shell[image-only=""] .igs-top,instagram-shell[image-only="true"] .igs-top' + '{display:none}' +
    'instagram-shell[image-only=""] .igs-head,instagram-shell[image-only="true"] .igs-head' + '{display:none}' +
    'instagram-shell[image-only=""] .igs-acts,instagram-shell[image-only="true"] .igs-acts' + '{display:none}' +
    'instagram-shell[image-only=""] .igs-meta,instagram-shell[image-only="true"] .igs-meta' + '{display:none}' +
    'instagram-shell[image-only=""] .igs-tabs,instagram-shell[image-only="true"] .igs-tabs' + '{display:none}' +
    'instagram-shell[image-only=""] .igs,instagram-shell[image-only="true"] .igs' + '{width:var(--shell-inner-w,402px);background:transparent}' +
    '';

  function ensureCss() {
    if (document.getElementById('instagram-shell-css')) return;
    var s = document.createElement('style');
    s.id = 'instagram-shell-css';
    s.textContent = CSS + IO_CSS;
    document.head.appendChild(s);
  }

  var LINE = 'fill="none" stroke="#000" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
  var HEART = '<svg width="25" height="25" viewBox="0 0 24 24" ' + LINE + '><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"></path></svg>';
  var BUBBLE = '<svg width="25" height="25" viewBox="0 0 24 24" ' + LINE + '><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 20.5l1.4-4.2A8.4 8.4 0 0 1 3.6 7.5 8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z"></path></svg>';
  var PLANE = '<svg width="25" height="25" viewBox="0 0 24 24" ' + LINE + '><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"></path></svg>';
  var SAVE = '<svg class="igs-sp" width="25" height="25" viewBox="0 0 24 24" ' + LINE + '><path d="M6 3h12v18l-6-4.5L6 21V3z"></path></svg>';
  var DOTS = '<svg width="22" height="22" viewBox="0 0 24 24" fill="#000"><circle cx="5" cy="12" r="1.8"></circle><circle cx="12" cy="12" r="1.8"></circle><circle cx="19" cy="12" r="1.8"></circle></svg>';
  var PLUS = '<svg width="24" height="24" viewBox="0 0 24 24" ' + LINE + '><path d="M12 4v16M4 12h16"></path></svg>';
  var TABS =
    '<svg width="26" height="26" viewBox="0 0 24 24" fill="#000"><path d="M3 10 12 2.5 21 10v11h-6.6v-6.8H9.6V21H3V10z"></path></svg>' +
    '<svg width="25" height="25" viewBox="0 0 24 24" ' + LINE + '><circle cx="11" cy="11" r="7"></circle><path d="M21 21l-4.5-4.5"></path></svg>' +
    '<svg width="25" height="25" viewBox="0 0 24 24" ' + LINE + '><rect x="3" y="3" width="18" height="18" rx="5"></rect><path d="M12 8v8M8 12h8"></path></svg>' +
    HEART.replace('width="25" height="25"', 'width="26" height="26"');

  customElements.define('instagram-shell', class extends HTMLElement {
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
      var un = a(this, 'username', 'yourbrand');
      var portrait = a(this, 'aspect', 'square') === 'portrait';
      var label = portrait
        ? 'Instagram portrait · 1080×1350'
        : 'Instagram post · 1080×1080';
      var slotId = (this.id || 'ig') + '-photo';

      var app = document.createElement('div');
      app.className = 'igs';

      var top = document.createElement('div');
      top.className = 'igs-top';
      // Neutral, wordmark-free top bar: a bold "Home" title reads as a
      // feed without naming the platform.
      top.innerHTML = '<div class="igs-home">Home</div><div class="igs-icons">' + PLUS + HEART.replace(/25/g, '24') + PLANE.replace(/25/g, '24') + '</div>';

      var head = document.createElement('div');
      head.className = 'igs-head';
      // Avatar URL is author/user input: NEVER concatenate into innerHTML
      // (attribute breakout = HTML injection). Style property API only,
      // with CSS-string escaping of backslash and quote.
      var avatarSrc = a(this, 'avatar-src', '');
      function setAv(node) {
        if (avatarSrc && node) {
          node.style.backgroundImage =
            'url("' + avatarSrc.replace(/[\\"]/g, function (ch) { return String.fromCharCode(92) + ch; }) + '")';
        }
      }
      head.innerHTML =
        '<div class="igs-av"><div class="igs-avi"></div></div>' +
        '<div style="flex:1"><div class="igs-un"></div><div class="igs-loc"></div></div>' + DOTS;
      setAv(head.querySelector('.igs-avi'));
      head.querySelector('.igs-un').textContent = un;
      var loc = a(this, 'location', '');
      head.querySelector('.igs-loc').textContent = loc;
      if (!loc) head.querySelector('.igs-loc').style.display = 'none';

      var photo = document.createElement('div');
      photo.className = 'igs-photo';
      photo.style.aspectRatio = portrait ? '1080/1350' : '1/1';
      photo.setAttribute('data-om-frame-export', '');
      photo.setAttribute('data-om-frame-label', label);
      var slot = document.createElement('image-slot');
      slot.setAttribute('id', slotId);
      slot.setAttribute('fit', 'cover');
      slot.setAttribute('shape', 'rect');
      slot.setAttribute('radius', '0');
      slot.setAttribute('placeholder', 'Drop the post photo');
      if (a(this, 'image-src', '')) slot.setAttribute('src', a(this, 'image-src', ''));
      // Stock photos require attribution: without credit attrs the host
      // renders an error tile over the image (product behavior). Forward
      // them whenever the image came from search_stock_photos.
      if (a(this, 'image-credit', '')) slot.setAttribute('credit', a(this, 'image-credit', ''));
      if (a(this, 'image-credit-href', '')) slot.setAttribute('credit-href', a(this, 'image-credit-href', ''));
      slot.style.cssText = 'display:block;position:absolute;inset:0;width:100%;height:100%';
      photo.appendChild(slot);
      // Author-extras slot: any children of <instagram-shell> land INSIDE
      // the photo frame (overlays, stickers) — total control stays possible.
      var extras = [].slice.call(this.childNodes);

      var acts = document.createElement('div');
      acts.className = 'igs-acts';
      acts.innerHTML = HEART + BUBBLE + PLANE + SAVE;

      var meta = document.createElement('div');
      meta.className = 'igs-meta';
      var likes = document.createElement('div');
      likes.className = 'igs-likes';
      likes.textContent = a(this, 'likes', '1,024 likes');
      var cap = document.createElement('div');
      cap.className = 'igs-cap';
      var capb = document.createElement('b');
      capb.textContent = un;
      cap.appendChild(capb);
      cap.appendChild(document.createTextNode(a(this, 'caption', '').replace(/^\s+/, '')));
      var cmt = document.createElement('div');
      cmt.className = 'igs-cmt';
      cmt.textContent = a(this, 'comments', '');
      if (!cmt.textContent) cmt.style.display = 'none';
      var time = document.createElement('div');
      time.className = 'igs-time';
      time.textContent = a(this, 'time', '2 hours ago');
      meta.appendChild(likes);
      meta.appendChild(cap);
      meta.appendChild(cmt);
      meta.appendChild(time);

      var tabs = document.createElement('div');
      tabs.className = 'igs-tabs';
      tabs.innerHTML = TABS + '<div class="igs-tabav"></div>';
      setAv(tabs.querySelector('.igs-tabav'));

      app.appendChild(top);
      app.appendChild(head);
      app.appendChild(photo);
      app.appendChild(acts);
      app.appendChild(meta);
      app.appendChild(tabs);

      extras.forEach(function (n) { photo.appendChild(n); });

      // Compose the phone: ios-shell wraps the app screen ("inherits" the
      // bezel/status chrome). ios-shell.js must be loaded.
      var phone = document.createElement('ios-shell');
      phone.setAttribute('data-composed-phone', '');
      var outerW = parseInt(a(this, 'width', '428'), 10) || 428;
      phone.setAttribute('width', String(outerW));
      this.style.setProperty('--shell-inner-w', (outerW - 26) + 'px');
      // Reference proportions: 402×874 screen. Portrait photos are 25%
      // taller than square, so raise the screen by that delta — otherwise
      // the meta block crams into the tab bar and the home indicator
      // strikes through the tab icons.
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
