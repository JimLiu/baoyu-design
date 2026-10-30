/* BEGIN USAGE */
/**
 * <tiktok-shell> — finished TikTok-style video post UI, attribute-driven.
 *
 * A complete, pre-designed For-You-feed screen inside an iPhone (composes
 * the ios-shell starter internally — load ios-shell.js and image-slot.js
 * alongside this file). The video canvas is letterboxed at 9:16 on a
 * black screen, so the phone keeps the family's fixed device size and
 * the exported asset is always exactly the video aspect — never
 * stretched, never cropped, no white gap. No logos or wordmarks: neutral
 * viewer chrome (Following/For You tabs, right-rail action stack with
 * like/comment/save/share counts, caption + sound rows, bottom nav) that
 * reads unmistakably as a short-video post without naming the platform;
 * everything that overlaps the canvas is export-hidden
 * (data-omelette-chrome), so the downloaded asset is the bare frame.
 * Claude fills attributes; never hand-build this chrome.
 *
 * Attributes (all optional except image handling):
 *   image-credit / image-credit-href   Attribution for a stock photo in
 *                 image-src (REQUIRED for Unsplash results — error tile
 *                 without it); forwarded to the internal slot.
 *   image-src     Prefill for the video still (image-slot underneath —
 *                 users can drop/replace; give the ELEMENT an id so the
 *                 drop persists: the slot id derives from it).
 *   username      e.g. "wild.remedy" (an @ is prefixed for display).
 *                 Default "yourbrand".
 *   caption       The post copy under the username (hidden when empty).
 *   sound         The sound row text. Default "Original sound · " +
 *                 username.
 *   avatar-src    Avatar image URL (else a neutral gradient disc).
 *   likes / comments / saves / shares   Right-rail counts. Defaults
 *                 "24.5K" / "482" / "1,208" / "3,407".
 *   image-only    Presence (or "true", e.g. a DC-bound
 *                 image-only="{{ imagesOnly }}") strips the phone and all
 *                 viewer chrome, showing JUST the video canvas at its
 *                 exact frame size — the "[images only / product shells]"
 *                 tweak. Pure CSS: toggles live with no rebuild, export
 *                 identical.
 *   width         Phone outer width px (default 428 — a 402px screen at
 *                 reference proportions).
 *
 * Attributes are read ONCE at build; only image-only toggles live (it's
 * pure CSS). To change copy/counts, re-author the element.
 *
 * The video canvas IS the export frame (data-om-frame-export with
 * "TikTok · 1080×1920" baked in) — inside a <social-frames>
 * board it gets the label bar + exact-size download automatically.
 * Children of <tiktok-shell> land INSIDE the canvas (headline plates,
 * scrims, stickers) — size overlay text to the RENDERED frame (~402px
 * wide), not the 1080 canvas, and keep scrims pointer-events:none so the
 * photo's hover controls stay reachable.
 */
/* END USAGE */

(function () {
  if (typeof HTMLElement !== 'function' || customElements.get('tiktok-shell')) return;

  var CSS =
    'tiktok-shell{display:block}' +
    // The app screen: video canvas vertically centered on black — the
    // 9:16 letterbox. The canvas is IN-FLOW (an aspect-ratio box, not
    // inset:0), which is what lets image-only hug it exactly.
    'tiktok-shell .tts{position:relative;display:flex;flex-direction:column;' +
    'justify-content:center;height:100%;background:#000;' +
    'font-family:-apple-system,system-ui,sans-serif}' +
    'tiktok-shell .tts-stage{position:relative;width:100%;aspect-ratio:1080/1920;' +
    'overflow:hidden;background:#111}' +
    // Viewer chrome. Tabs, rail, and meta sit INSIDE the canvas (the feed
    // overlays chrome on the video), absolutely positioned and
    // chrome-marked, so hiding them at export cannot reflow the frame.
    'tiktok-shell .tts-tabs{position:absolute;top:14px;left:0;right:0;' +
    'display:flex;justify-content:center;gap:18px;z-index:40;color:#fff;' +
    'font-size:15px;text-shadow:0 1px 4px rgba(0,0,0,.45)}' +
    'tiktok-shell .tts-tab{font-weight:400;opacity:.7}' +
    'tiktok-shell .tts-tab.tts-on{font-weight:700;opacity:1;position:relative}' +
    'tiktok-shell .tts-tab.tts-on:after{content:"";position:absolute;left:50%;' +
    'transform:translateX(-50%);bottom:-7px;width:28px;height:3px;border-radius:2px;' +
    'background:#fff}' +
    'tiktok-shell .tts-rail{position:absolute;right:8px;bottom:16px;' +
    'display:flex;flex-direction:column;align-items:center;gap:17px;z-index:40;' +
    'color:#fff}' +
    'tiktok-shell .tts-act{display:flex;flex-direction:column;align-items:center;' +
    'gap:3px;font-size:12px;font-weight:600;text-shadow:0 1px 4px rgba(0,0,0,.45)}' +
    'tiktok-shell .tts-act svg{display:block;filter:drop-shadow(0 1px 3px rgba(0,0,0,.4))}' +
    'tiktok-shell .tts-railav{position:relative;width:42px;height:42px;margin-bottom:4px}' +
    'tiktok-shell .tts-av{display:block;width:42px;height:42px;border-radius:50%;' +
    'background:linear-gradient(135deg,#e8e0d8 0%,#c9c2ba 100%) center/cover no-repeat;' +
    'border:1.5px solid #fff;box-sizing:border-box}' +
    'tiktok-shell .tts-plus{position:absolute;left:50%;bottom:-8px;transform:translateX(-50%);' +
    'width:18px;height:18px;border-radius:50%;background:#FE2C55;color:#fff;' +
    'display:flex;align-items:center;justify-content:center;font-size:13px;' +
    'font-weight:700;line-height:1}' +
    'tiktok-shell .tts-disc{width:38px;height:38px;border-radius:50%;margin-top:2px;' +
    'background:radial-gradient(circle at center,#e8e0d8 0 9px,#1c1c1e 9px 15px,#3a3a3c 15px)}' +
    'tiktok-shell .tts-meta{position:absolute;left:12px;right:76px;bottom:16px;' +
    'display:flex;flex-direction:column;gap:7px;z-index:40;color:#fff;' +
    'text-shadow:0 1px 4px rgba(0,0,0,.45)}' +
    'tiktok-shell .tts-un{font-size:16px;font-weight:700;line-height:1.2}' +
    'tiktok-shell .tts-cap{font-size:14px;line-height:1.35;display:-webkit-box;' +
    '-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}' +
    'tiktok-shell .tts-sound{display:flex;align-items:center;gap:7px;font-size:13px;' +
    'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    'tiktok-shell .tts-sound svg{flex:none}' +
    'tiktok-shell .tts-sound span{overflow:hidden;text-overflow:ellipsis}' +
    // Bottom nav: in the BOTTOM letterbox band (below the canvas, where
    // the real app keeps it), never over the video content.
    'tiktok-shell .tts-nav{position:absolute;left:0;right:0;bottom:14px;' +
    'display:flex;align-items:center;justify-content:space-around;' +
    'padding:0 10px;z-index:40;color:rgba(255,255,255,.62)}' +
    'tiktok-shell .tts-nit{display:flex;flex-direction:column;align-items:center;' +
    'gap:2px;font-size:10px}' +
    'tiktok-shell .tts-nit.tts-on{color:#fff;font-weight:600}' +
    'tiktok-shell .tts-nit svg{display:block}' +
    'tiktok-shell .tts-create{position:relative;width:42px;height:28px;margin:0 4px}' +
    'tiktok-shell .tts-create:before{content:"";position:absolute;inset:0;' +
    'border-radius:8px;background:#25F4EE;transform:translateX(-4px)}' +
    'tiktok-shell .tts-create:after{content:"";position:absolute;inset:0;' +
    'border-radius:8px;background:#FE2C55;transform:translateX(4px)}' +
    'tiktok-shell .tts-create b{position:absolute;inset:0;z-index:1;border-radius:8px;' +
    'background:#fff;color:#000;display:flex;align-items:center;justify-content:center;' +
    'font-size:19px;font-weight:600;line-height:1}';

  // IMPORTANT: the image-only selectors below match ONLY [image-only=""]
  // (authored presence) and [image-only="true"] — never bare [image-only].
  // A DC binding image-only="{{ imagesOnly }}" renders the string "false"
  // when off, which a bare attribute selector would match, locking the
  // shell in image-only mode. Don't "simplify" these.
  var IO_CSS =
    // image-only mode: strip ALL presentation (phone bezel + viewer
    // chrome), leaving just the video canvas — the asset alone, at its
    // exact frame size. Pure CSS, so a DC tweak flipping the attribute
    // toggles instantly with no rebuild and no state loss; exports are
    // identical in both modes (same frame, same label, same slot).
    'tiktok-shell[image-only=""] > ios-shell[data-composed-phone],tiktok-shell[image-only="true"] > ios-shell[data-composed-phone]' + '{background:transparent;padding:0;border-radius:0;box-shadow:none;width:auto !important}' +
    'tiktok-shell[image-only=""] > ios-shell[data-composed-phone] > .ios-screen,tiktok-shell[image-only="true"] > ios-shell[data-composed-phone] > .ios-screen' + '{height:auto !important;border-radius:0;overflow:visible;background:transparent}' +
    'tiktok-shell[image-only=""] > ios-shell[data-composed-phone] > .ios-screen > .ios-island,tiktok-shell[image-only="true"] > ios-shell[data-composed-phone] > .ios-screen > .ios-island' + ',' + 'tiktok-shell[image-only=""] > ios-shell[data-composed-phone] > .ios-screen > .ios-statusbar,tiktok-shell[image-only="true"] > ios-shell[data-composed-phone] > .ios-screen > .ios-statusbar' + ',' + 'tiktok-shell[image-only=""] > ios-shell[data-composed-phone] > .ios-screen > .ios-homebar,tiktok-shell[image-only="true"] > ios-shell[data-composed-phone] > .ios-screen > .ios-homebar' + '{display:none}' +
    'tiktok-shell[image-only=""] > ios-shell[data-composed-phone] > .ios-screen > .ios-content,tiktok-shell[image-only="true"] > ios-shell[data-composed-phone] > .ios-screen > .ios-content' + '{position:static !important}' +
    'tiktok-shell[image-only=""] .tts-tabs,tiktok-shell[image-only="true"] .tts-tabs' + '{display:none}' +
    'tiktok-shell[image-only=""] .tts-rail,tiktok-shell[image-only="true"] .tts-rail' + '{display:none}' +
    'tiktok-shell[image-only=""] .tts-meta,tiktok-shell[image-only="true"] .tts-meta' + '{display:none}' +
    'tiktok-shell[image-only=""] .tts-nav,tiktok-shell[image-only="true"] .tts-nav' + '{display:none}' +
    'tiktok-shell[image-only=""] .tts,tiktok-shell[image-only="true"] .tts' + '{width:var(--shell-inner-w,402px);background:transparent}' +
    '';

  function ensureCss() {
    if (document.getElementById('tiktok-shell-css')) return;
    var s = document.createElement('style');
    s.id = 'tiktok-shell-css';
    s.textContent = CSS + IO_CSS;
    document.head.appendChild(s);
  }

  var F = 'fill="#fff"';
  var HEART = '<svg width="32" height="32" viewBox="0 0 24 24" ' + F + '><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"></path></svg>';
  var BUBBLE = '<svg width="30" height="30" viewBox="0 0 24 24" ' + F + '><path d="M12 2.5c-5.5 0-10 3.9-10 8.7 0 2.8 1.5 5.2 3.9 6.8L5 21.5l4-1.6c1 .2 2 .4 3 .4 5.5 0 10-3.9 10-8.8S17.5 2.5 12 2.5z"></path></svg>';
  var BOOK = '<svg width="28" height="28" viewBox="0 0 24 24" ' + F + '><path d="M6 2.5h12a1 1 0 0 1 1 1v18l-7-5-7 5v-18a1 1 0 0 1 1-1z"></path></svg>';
  var SHARE = '<svg width="30" height="30" viewBox="0 0 24 24" ' + F + '><path d="M13.5 4.2v4C7.6 8.7 4 12.4 3 17.8c2.5-3.5 6-5.2 10.5-5.2v4.2L21 10l-7.5-5.8z"></path></svg>';
  var NOTE = '<svg width="14" height="14" viewBox="0 0 24 24" ' + F + '><path d="M9 3v11.3a3.8 3.8 0 1 0 2 3.4V7.5l8-1.8V12a3.8 3.8 0 1 0 2 3.4V1.5L9 3z"></path></svg>';
  var L = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
  var HOME = '<svg width="23" height="23" viewBox="0 0 24 24" fill="currentColor"><path d="M3 10 12 2.5 21 10v11h-6.6v-6.8H9.6V21H3V10z"></path></svg>';
  var FRIENDS = '<svg width="23" height="23" viewBox="0 0 24 24" ' + L + '><circle cx="9" cy="8" r="3.5"></circle><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16.5 4.7a3.5 3.5 0 0 1 0 6.6M15.5 13.7a6.5 6.5 0 0 1 6 6.3"></path></svg>';
  var INBOX = '<svg width="23" height="23" viewBox="0 0 24 24" ' + L + '><rect x="3" y="4.5" width="18" height="15" rx="2"></rect><path d="m3 8 7.6 5a2.5 2.5 0 0 0 2.8 0L21 8"></path></svg>';
  var PERSON = '<svg width="23" height="23" viewBox="0 0 24 24" ' + L + '><circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path></svg>';

  customElements.define('tiktok-shell', class extends HTMLElement {
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
    _build() {
      if (this.closest && this.closest('x-dc')) return;
      if (this.querySelector(':scope > ios-shell[data-composed-phone]')) return;
      ensureCss();

      var a = function (host, n, d) { return host.getAttribute(n) || d; };
      var un = a(this, 'username', 'yourbrand');
      if (un.charAt(0) === '@') un = un.slice(1);
      var slotId = (this.id || 'tiktok') + '-photo';

      var app = document.createElement('div');
      app.className = 'tts';

      // The video canvas: the one export frame, letterboxed by the flex
      // centering above.
      var stage = document.createElement('div');
      stage.className = 'tts-stage';
      stage.setAttribute('data-om-frame-export', '');
      stage.setAttribute('data-om-frame-label', 'TikTok · 1080×1920');
      var slot = document.createElement('image-slot');
      slot.setAttribute('id', slotId);
      slot.setAttribute('fit', 'cover');
      slot.setAttribute('shape', 'rect');
      slot.setAttribute('radius', '0');
      slot.setAttribute('placeholder', 'Drop the video still');
      if (a(this, 'image-src', '')) slot.setAttribute('src', a(this, 'image-src', ''));
      // Stock photos require attribution: without credit attrs the host
      // renders an error tile over the image (product behavior). Forward
      // them whenever the image came from search_stock_photos.
      if (a(this, 'image-credit', '')) slot.setAttribute('credit', a(this, 'image-credit', ''));
      if (a(this, 'image-credit-href', '')) slot.setAttribute('credit-href', a(this, 'image-credit-href', ''));
      slot.style.cssText = 'display:block;position:absolute;inset:0;width:100%;height:100%';
      stage.appendChild(slot);
      // Author-extras slot: any children of <tiktok-shell> land INSIDE
      // the canvas (overlays, stickers) — total control stays possible.
      var extras = [].slice.call(this.childNodes);

      // Feed tabs (For You active) — viewer chrome, export-hidden.
      var tabs = document.createElement('div');
      tabs.className = 'tts-tabs';
      tabs.setAttribute('data-omelette-chrome', '');
      tabs.innerHTML = '<span class="tts-tab">Following</span>' +
        '<span class="tts-tab tts-on">For You</span>';

      // Right-rail action stack — viewer chrome, export-hidden.
      var rail = document.createElement('div');
      rail.className = 'tts-rail';
      rail.setAttribute('data-omelette-chrome', '');
      rail.innerHTML =
        '<span class="tts-railav"><span class="tts-av"></span><span class="tts-plus">+</span></span>' +
        '<span class="tts-act">' + HEART + '<span class="tts-l"></span></span>' +
        '<span class="tts-act">' + BUBBLE + '<span class="tts-c"></span></span>' +
        '<span class="tts-act">' + BOOK + '<span class="tts-b"></span></span>' +
        '<span class="tts-act">' + SHARE + '<span class="tts-s"></span></span>' +
        '<span class="tts-disc"></span>';
      // Avatar URL is author/user input: NEVER concatenate into innerHTML
      // (attribute breakout = HTML injection). Style property API only,
      // with CSS-string escaping of backslash and quote.
      var avatarSrc = a(this, 'avatar-src', '');
      if (avatarSrc) {
        rail.querySelector('.tts-av').style.backgroundImage =
          'url("' + avatarSrc.replace(/[\\"]/g, function (ch) { return String.fromCharCode(92) + ch; }) + '")';
      }
      rail.querySelector('.tts-l').textContent = a(this, 'likes', '24.5K');
      rail.querySelector('.tts-c').textContent = a(this, 'comments', '482');
      rail.querySelector('.tts-b').textContent = a(this, 'saves', '1,208');
      rail.querySelector('.tts-s').textContent = a(this, 'shares', '3,407');

      // Username + caption + sound rows — viewer chrome, export-hidden.
      var meta = document.createElement('div');
      meta.className = 'tts-meta';
      meta.setAttribute('data-omelette-chrome', '');
      meta.innerHTML =
        '<span class="tts-un"></span>' +
        '<span class="tts-cap"></span>' +
        '<span class="tts-sound">' + NOTE + '<span class="tts-snd"></span></span>';
      meta.querySelector('.tts-un').textContent = '@' + un;
      var cap = a(this, 'caption', '');
      meta.querySelector('.tts-cap').textContent = cap;
      if (!cap) meta.querySelector('.tts-cap').style.display = 'none';
      meta.querySelector('.tts-snd').textContent =
        a(this, 'sound', 'Original sound · ' + un);

      // Bottom nav in the bottom letterbox band — viewer chrome, export-
      // hidden (absolute, so hiding cannot reflow).
      var nav = document.createElement('div');
      nav.className = 'tts-nav';
      nav.setAttribute('data-omelette-chrome', '');
      nav.innerHTML =
        '<span class="tts-nit tts-on">' + HOME + 'Home</span>' +
        '<span class="tts-nit">' + FRIENDS + 'Friends</span>' +
        '<span class="tts-create"><b>+</b></span>' +
        '<span class="tts-nit">' + INBOX + 'Inbox</span>' +
        '<span class="tts-nit">' + PERSON + 'Profile</span>';

      stage.appendChild(tabs);
      stage.appendChild(rail);
      stage.appendChild(meta);
      app.appendChild(stage);
      app.appendChild(nav);

      extras.forEach(function (n) { stage.appendChild(n); });

      // Compose the phone: ios-shell wraps the app screen ("inherits" the
      // bezel/status chrome and the fixed physical-device size).
      // ios-shell.js must be loaded. dark: white status text over the
      // black video screen.
      var phone = document.createElement('ios-shell');
      phone.setAttribute('data-composed-phone', '');
      phone.setAttribute('dark', '');
      var outerW = parseInt(a(this, 'width', '428'), 10) || 428;
      phone.setAttribute('width', String(outerW));
      this.style.setProperty('--shell-inner-w', (outerW - 26) + 'px');
      var innerW = outerW - 26;
      // ONE height for every shell (product direction: phones are uniform
      // across the board — reference proportions 402×874 screen).
      var screenH = Math.round(innerW * 874 / 402);
      phone.setAttribute('screen-height', String(screenH));
      phone.appendChild(app);
      this.appendChild(phone);
      if (phone._build && customElements.get('ios-shell')) phone._build();
    }
  });
})();
