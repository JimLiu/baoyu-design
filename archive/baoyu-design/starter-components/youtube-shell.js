/* BEGIN USAGE */
/**
 * <youtube-shell> — finished YouTube-style mobile feed UI, attribute-
 * driven. A complete, pre-designed home-feed screen inside an iPhone
 * (composes the ios-shell starter — load ios-shell.js and image-slot.js
 * alongside). No logos or wordmarks. Claude fills attributes; never
 * hand-build this chrome.
 *
 * Attributes:
 *   image-credit / image-credit-href   Attribution for a stock photo in
 *               image-src (REQUIRED for Unsplash results — the host shows
 *               an error tile without it); forwarded to the internal slot.
 *   image-src   Prefill for the thumbnail (image-slot underneath; give
 *               the ELEMENT an id so drops persist).
 *   title       Video title (below the thumbnail). Default "Your video
 *               title".
 *   channel     Channel name. Default "Your brand".
 *   avatar-src  Channel avatar URL (else a neutral gradient disc).
 *   views       e.g. "48K views". Default "12K views".
 *   time        e.g. "3 days ago". Default "2 days ago".
 *   duration    Badge on the thumbnail, e.g. "12:34". Default "3:12".
 *               Export-hidden chrome: downloads ship just the thumbnail.
 *   image-only  Presence (or "true", e.g. a DC-bound image-only="{{ imagesOnly }}")
 *               strips the phone and all app chrome, showing JUST the
 *               asset frame — the "[images only / product shells]" tweak.
 *               Pure CSS: toggles live with no rebuild, export identical.
 *   width       Phone outer width px (default 428).
 *
 * Attributes are read ONCE at build; only image-only toggles live (it's
 * pure CSS). To change copy/counts, re-author the element.
 *
 * The thumbnail IS the export frame (16:9 only — labeled "YouTube
 * thumbnail · 1280×720").
 */
/* END USAGE */

(function () {
  if (typeof HTMLElement !== 'function' || customElements.get('youtube-shell')) return;

  var CSS =
    'youtube-shell{display:block}' +
    'youtube-shell .yts{display:flex;flex-direction:column;height:100%;background:#fff;' +
    'font-family:-apple-system,system-ui,sans-serif;color:#0f0f0f}' +
    'youtube-shell .yts-top{display:flex;align-items:center;justify-content:space-between;' +
    'padding:58px 16px 8px}' +
    'youtube-shell .yts-home{font-size:20px;font-weight:700;letter-spacing:-.3px}' +
    'youtube-shell .yts-icons{display:flex;gap:18px;align-items:center;color:#0f0f0f}' +
    'youtube-shell .yts-icons svg{display:block}' +
    'youtube-shell .yts-chips{display:flex;gap:8px;padding:8px 16px 12px;overflow:hidden}' +
    'youtube-shell .yts-chip{background:#f2f2f2;border-radius:8px;padding:6px 12px;' +
    'font-size:13.5px;font-weight:500;white-space:nowrap}' +
    'youtube-shell .yts-chip.on{background:#0f0f0f;color:#fff}' +
    'youtube-shell .yts-media{position:relative;width:100%;background:#f0f0f0}' +
    'youtube-shell .yts-dur{position:absolute;right:8px;bottom:8px;background:rgba(0,0,0,.75);' +
    'color:#fff;font-size:12px;font-weight:500;line-height:1;padding:3px 5px;' +
    'border-radius:4px;z-index:5}' +
    'youtube-shell .yts-meta{display:flex;align-items:flex-start;gap:12px;padding:12px 16px 10px}' +
    'youtube-shell .yts-av{width:36px;height:36px;border-radius:50%;flex:none;' +
    'background:linear-gradient(135deg,#e8e0d8 0%,#c9c2ba 100%) center/cover no-repeat}' +
    'youtube-shell .yts-title{font-size:15px;font-weight:600;line-height:1.35}' +
    'youtube-shell .yts-sub{font-size:12.5px;color:#606060;line-height:1.3;margin-top:4px}' +
    'youtube-shell .yts-kebab{flex:none;color:#0f0f0f;margin-top:2px}' +
    'youtube-shell .yts-tabs{margin-top:auto;display:flex;align-items:center;' +
    'justify-content:space-around;padding:10px 10px 30px;border-top:.5px solid #e5e5e5;' +
    'color:#0f0f0f}';

  // IMPORTANT: the image-only selectors below match ONLY [image-only=""]
  // (authored presence) and [image-only="true"] — never bare [image-only].
  // A DC binding image-only="{{ imagesOnly }}" renders the string "false"
  // when off, which a bare attribute selector would match, locking the
  // shell in image-only mode. Don't "simplify" these.
  var IO_CSS =
    // image-only mode: strip ALL presentation (phone bezel + app chrome +
    // the duration badge over the thumbnail), leaving just the export
    // frame — the asset alone. Pure CSS, so a DC tweak flipping the
    // attribute toggles instantly with no rebuild and no state loss;
    // exports are identical in both modes (same frame, same label, same
    // slot).
    'youtube-shell[image-only=""] > ios-shell[data-composed-phone],youtube-shell[image-only="true"] > ios-shell[data-composed-phone]' + '{background:transparent;padding:0;border-radius:0;box-shadow:none;width:auto !important}' +
    'youtube-shell[image-only=""] > ios-shell[data-composed-phone] > .ios-screen,youtube-shell[image-only="true"] > ios-shell[data-composed-phone] > .ios-screen' + '{height:auto !important;border-radius:0;overflow:visible;background:transparent}' +
    'youtube-shell[image-only=""] > ios-shell[data-composed-phone] > .ios-screen > .ios-island,youtube-shell[image-only="true"] > ios-shell[data-composed-phone] > .ios-screen > .ios-island' + ',' + 'youtube-shell[image-only=""] > ios-shell[data-composed-phone] > .ios-screen > .ios-statusbar,youtube-shell[image-only="true"] > ios-shell[data-composed-phone] > .ios-screen > .ios-statusbar' + ',' + 'youtube-shell[image-only=""] > ios-shell[data-composed-phone] > .ios-screen > .ios-homebar,youtube-shell[image-only="true"] > ios-shell[data-composed-phone] > .ios-screen > .ios-homebar' + '{display:none}' +
    'youtube-shell[image-only=""] > ios-shell[data-composed-phone] > .ios-screen > .ios-content,youtube-shell[image-only="true"] > ios-shell[data-composed-phone] > .ios-screen > .ios-content' + '{position:static !important}' +
    'youtube-shell[image-only=""] .yts-top,youtube-shell[image-only="true"] .yts-top' + '{display:none}' +
    'youtube-shell[image-only=""] .yts-chips,youtube-shell[image-only="true"] .yts-chips' + '{display:none}' +
    'youtube-shell[image-only=""] .yts-dur,youtube-shell[image-only="true"] .yts-dur' + '{display:none}' +
    'youtube-shell[image-only=""] .yts-meta,youtube-shell[image-only="true"] .yts-meta' + '{display:none}' +
    'youtube-shell[image-only=""] .yts-tabs,youtube-shell[image-only="true"] .yts-tabs' + '{display:none}' +
    'youtube-shell[image-only=""] .yts,youtube-shell[image-only="true"] .yts' + '{width:var(--shell-inner-w,402px);background:transparent}' +
    '';

  function ensureCss() {
    if (document.getElementById('youtube-shell-css')) return;
    var s = document.createElement('style');
    s.id = 'youtube-shell-css';
    s.textContent = CSS + IO_CSS;
    document.head.appendChild(s);
  }

  var L = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
  var CAST = '<svg width="20" height="20" viewBox="0 0 24 24" ' + L + '><path d="M3 17a4 4 0 0 1 4 4M3 13a8 8 0 0 1 8 8M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-7M3 5v4"></path></svg>';
  var BELL = '<svg width="20" height="20" viewBox="0 0 24 24" ' + L + '><path d="M18 9a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7M10.3 20a2 2 0 0 0 3.4 0"></path></svg>';
  var SEARCH = '<svg width="20" height="20" viewBox="0 0 24 24" ' + L + '><circle cx="11" cy="11" r="7"></circle><path d="M21 21l-4.5-4.5"></path></svg>';
  var KEBAB = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.6"></circle><circle cx="12" cy="12" r="1.6"></circle><circle cx="12" cy="19" r="1.6"></circle></svg>';
  var TABS =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M3 10 12 2.5 21 10v11h-6.6v-6.8H9.6V21H3V10z"></path></svg>' +
    '<svg width="24" height="24" viewBox="0 0 24 24" ' + L + '><rect x="6.5" y="3.5" width="11" height="17" rx="3.5"></rect><path d="m10.5 9.5 4 2.5-4 2.5v-5z"></path></svg>' +
    '<svg width="28" height="28" viewBox="0 0 24 24" ' + L + '><circle cx="12" cy="12" r="9"></circle><path d="M12 8.5v7M8.5 12h7"></path></svg>' +
    '<svg width="24" height="24" viewBox="0 0 24 24" ' + L + '><rect x="3" y="7" width="18" height="13" rx="2"></rect><path d="M7 4h10M10 11.5l4 2.5-4 2.5v-5z"></path></svg>' +
    '<svg width="24" height="24" viewBox="0 0 24 24" ' + L + '><circle cx="12" cy="8.5" r="3.5"></circle><path d="M5 20a7 7 0 0 1 14 0"></path></svg>';

  customElements.define('youtube-shell', class extends HTMLElement {
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
      var label = 'YouTube thumbnail · 1280×720';
      var slotId = (this.id || 'yt') + '-photo';
      var extras = [].slice.call(this.childNodes);

      var app = document.createElement('div');
      app.className = 'yts';

      var top = document.createElement('div');
      top.className = 'yts-top';
      // Neutral: a plain "Home" title (the family's wordmark-free move).
      top.innerHTML = '<div class="yts-home">Home</div><div class="yts-icons">' +
        CAST + BELL + SEARCH + '</div>';

      var chips = document.createElement('div');
      chips.className = 'yts-chips';
      chips.innerHTML =
        '<span class="yts-chip on">All</span><span class="yts-chip">Music</span>' +
        '<span class="yts-chip">Live</span><span class="yts-chip">Gaming</span>';

      var media = document.createElement('div');
      media.className = 'yts-media';
      media.style.aspectRatio = '1280/720';
      media.setAttribute('data-om-frame-export', '');
      media.setAttribute('data-om-frame-label', label);
      var slot = document.createElement('image-slot');
      slot.setAttribute('id', slotId);
      slot.setAttribute('fit', 'cover');
      slot.setAttribute('shape', 'rect');
      slot.setAttribute('radius', '0');
      slot.setAttribute('placeholder', 'Drop the thumbnail image');
      if (a(this, 'image-src', '')) slot.setAttribute('src', a(this, 'image-src', ''));
      // Stock photos require attribution: without credit attrs the host
      // renders an error tile over the image (product behavior). Forward
      // them whenever the image came from search_stock_photos.
      if (a(this, 'image-credit', '')) slot.setAttribute('credit', a(this, 'image-credit', ''));
      if (a(this, 'image-credit-href', '')) slot.setAttribute('credit-href', a(this, 'image-credit-href', ''));
      slot.style.cssText = 'display:block;position:absolute;inset:0;width:100%;height:100%';
      media.appendChild(slot);
      // The duration badge overlaps the thumbnail — export-hidden chrome
      // (downloads ship just the image), hidden in image-only mode too.
      var dur = document.createElement('span');
      dur.className = 'yts-dur';
      dur.setAttribute('data-omelette-chrome', '');
      dur.textContent = a(this, 'duration', '3:12');
      media.appendChild(dur);
      extras.forEach(function (n) { media.appendChild(n); });

      var meta = document.createElement('div');
      meta.className = 'yts-meta';
      meta.innerHTML =
        '<div class="yts-av"></div>' +
        '<div style="flex:1;min-width:0"><div class="yts-title"></div>' +
        '<div class="yts-sub"><span class="yts-ch"></span> · <span class="yts-v"></span> · <span class="yts-t"></span></div></div>' +
        '<span class="yts-kebab">' + KEBAB + '</span>';
      // Avatar URL: style property API only (never innerHTML concat —
      // attribute breakout), CSS-string escaped.
      var avatarSrc = a(this, 'avatar-src', '');
      if (avatarSrc) {
        meta.querySelector('.yts-av').style.backgroundImage =
          'url("' + avatarSrc.replace(/[\\"]/g, function (ch) { return String.fromCharCode(92) + ch; }) + '")';
      }
      meta.querySelector('.yts-title').textContent = a(this, 'title', 'Your video title');
      meta.querySelector('.yts-ch').textContent = a(this, 'channel', 'Your brand');
      meta.querySelector('.yts-v').textContent = a(this, 'views', '12K views');
      meta.querySelector('.yts-t').textContent = a(this, 'time', '2 days ago');

      var tabs = document.createElement('div');
      tabs.className = 'yts-tabs';
      tabs.innerHTML = TABS;

      app.appendChild(top);
      app.appendChild(chips);
      app.appendChild(media);
      app.appendChild(meta);
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
