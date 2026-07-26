/* BEGIN USAGE */
/**
 * <instagram-story> — finished Instagram-style story UI, attribute-driven.
 *
 * A complete, pre-designed story-viewer screen inside an iPhone (composes
 * the ios-shell starter internally — load ios-shell.js and image-slot.js
 * alongside this file). The story canvas is letterboxed at 9:16 on a
 * black screen, so the phone keeps the family's fixed device size and
 * the exported asset is always exactly the story aspect — never
 * stretched, never cropped, no white gap. No logos or wordmarks: neutral
 * viewer chrome (progress segments, avatar header, "Send message" reply
 * bar) that reads unmistakably as a story without naming the platform;
 * everything that overlaps the canvas is export-hidden
 * (data-omelette-chrome), so the downloaded asset is the bare story.
 * Claude fills attributes; never hand-build this chrome.
 *
 * Attributes (all optional except image handling):
 *   image-credit / image-credit-href   Attribution for a stock photo in
 *                 image-src (REQUIRED for Unsplash results — error tile
 *                 without it); forwarded to the internal slot.
 *   image-src     Prefill for the story photo (image-slot underneath —
 *                 users can drop/replace; give the ELEMENT an id so the
 *                 drop persists: the slot id derives from it).
 *   username      e.g. "wild.remedy". Default "yourbrand".
 *   avatar-src    Avatar image URL (else a neutral gradient disc).
 *   time          Story age next to the username, e.g. "3h". Default "2h".
 *   image-only    Presence (or "true", e.g. a DC-bound
 *                 image-only="{{ imagesOnly }}") strips the phone and all
 *                 viewer chrome, showing JUST the story canvas at its
 *                 exact frame size — the "[images only / product shells]"
 *                 tweak. Pure CSS: toggles live with no rebuild, export
 *                 identical.
 *   width         Phone outer width px (default 428 — a 402px screen at
 *                 reference proportions).
 *
 * Attributes are read ONCE at build; only image-only toggles live (it's
 * pure CSS). To change copy, re-author the element.
 *
 * The story canvas IS the export frame (data-om-frame-export with
 * "Instagram story · 1080×1920" baked in) — inside a <social-frames>
 * board it gets the label bar + exact-size download automatically.
 * Children of <instagram-story> land INSIDE the canvas (headline plates,
 * scrims, stickers) — size overlay text to the RENDERED frame (~402px
 * wide), not the 1080 canvas, and keep scrims pointer-events:none so the
 * photo's hover controls stay reachable.
 */
/* END USAGE */

(function () {
  if (typeof HTMLElement !== 'function' || customElements.get('instagram-story')) return;

  var CSS =
    'instagram-story{display:block}' +
    // The app screen: story canvas vertically centered on black — the
    // 9:16 letterbox. The canvas is IN-FLOW (an aspect-ratio box, not
    // inset:0), which is what lets image-only hug it exactly.
    'instagram-story .igst{position:relative;display:flex;flex-direction:column;' +
    'justify-content:center;height:100%;background:#000;' +
    'font-family:-apple-system,system-ui,sans-serif}' +
    'instagram-story .igst-stage{position:relative;width:100%;aspect-ratio:1080/1920;' +
    'overflow:hidden;background:#111}' +
    // Viewer chrome. Progress + header sit INSIDE the canvas (stories
    // overlay chrome on the content), absolutely positioned and
    // chrome-marked, so hiding them at export cannot reflow the frame.
    'instagram-story .igst-prog{position:absolute;top:10px;left:10px;right:10px;' +
    'display:flex;gap:4px;z-index:40}' +
    'instagram-story .igst-prog i{flex:1;height:2.5px;border-radius:2px;' +
    'background:rgba(255,255,255,.35)}' +
    'instagram-story .igst-prog i.igst-on{background:#fff}' +
    'instagram-story .igst-head{position:absolute;top:22px;left:14px;right:12px;' +
    'display:flex;align-items:center;gap:10px;z-index:40;color:#fff;' +
    'text-shadow:0 1px 4px rgba(0,0,0,.45)}' +
    'instagram-story .igst-av{width:34px;height:34px;border-radius:50%;flex:none;' +
    'background:linear-gradient(135deg,#e8e0d8 0%,#c9c2ba 100%) center/cover no-repeat;' +
    'border:1px solid rgba(255,255,255,.4);box-sizing:border-box}' +
    'instagram-story .igst-un{font-size:14px;font-weight:600;line-height:1.25}' +
    'instagram-story .igst-time{font-size:14px;font-weight:400;opacity:.75}' +
    'instagram-story .igst-x{margin-left:auto;display:flex;align-items:center;gap:16px}' +
    'instagram-story .igst-x svg{display:block}' +
    // Reply bar: in the BOTTOM letterbox band (below the canvas, like the
    // real viewer), never over the story content.
    'instagram-story .igst-reply{position:absolute;left:14px;right:14px;bottom:24px;' +
    'display:flex;align-items:center;gap:14px;z-index:40;color:#fff}' +
    'instagram-story .igst-field{flex:1;height:44px;border:1px solid rgba(255,255,255,.55);' +
    'border-radius:22px;display:flex;align-items:center;padding:0 18px;font-size:14px;' +
    'color:rgba(255,255,255,.75);box-sizing:border-box}' +
    'instagram-story .igst-reply svg{display:block;flex:none}';

  // IMPORTANT: the image-only selectors below match ONLY [image-only=""]
  // (authored presence) and [image-only="true"] — never bare [image-only].
  // A DC binding image-only="{{ imagesOnly }}" renders the string "false"
  // when off, which a bare attribute selector would match, locking the
  // shell in image-only mode. Don't "simplify" these.
  var IO_CSS =
    // image-only mode: strip ALL presentation (phone bezel + viewer
    // chrome), leaving just the story canvas — the asset alone, at its
    // exact frame size. Pure CSS, so a DC tweak flipping the attribute
    // toggles instantly with no rebuild and no state loss; exports are
    // identical in both modes (same frame, same label, same slot).
    'instagram-story[image-only=""] > ios-shell[data-composed-phone],instagram-story[image-only="true"] > ios-shell[data-composed-phone]' + '{background:transparent;padding:0;border-radius:0;box-shadow:none;width:auto !important}' +
    'instagram-story[image-only=""] > ios-shell[data-composed-phone] > .ios-screen,instagram-story[image-only="true"] > ios-shell[data-composed-phone] > .ios-screen' + '{height:auto !important;border-radius:0;overflow:visible;background:transparent}' +
    'instagram-story[image-only=""] > ios-shell[data-composed-phone] > .ios-screen > .ios-island,instagram-story[image-only="true"] > ios-shell[data-composed-phone] > .ios-screen > .ios-island' + ',' + 'instagram-story[image-only=""] > ios-shell[data-composed-phone] > .ios-screen > .ios-statusbar,instagram-story[image-only="true"] > ios-shell[data-composed-phone] > .ios-screen > .ios-statusbar' + ',' + 'instagram-story[image-only=""] > ios-shell[data-composed-phone] > .ios-screen > .ios-homebar,instagram-story[image-only="true"] > ios-shell[data-composed-phone] > .ios-screen > .ios-homebar' + '{display:none}' +
    'instagram-story[image-only=""] > ios-shell[data-composed-phone] > .ios-screen > .ios-content,instagram-story[image-only="true"] > ios-shell[data-composed-phone] > .ios-screen > .ios-content' + '{position:static !important}' +
    'instagram-story[image-only=""] .igst-prog,instagram-story[image-only="true"] .igst-prog' + '{display:none}' +
    'instagram-story[image-only=""] .igst-head,instagram-story[image-only="true"] .igst-head' + '{display:none}' +
    'instagram-story[image-only=""] .igst-reply,instagram-story[image-only="true"] .igst-reply' + '{display:none}' +
    'instagram-story[image-only=""] .igst,instagram-story[image-only="true"] .igst' + '{width:var(--shell-inner-w,402px);background:transparent}' +
    '';

  function ensureCss() {
    if (document.getElementById('instagram-story-css')) return;
    var s = document.createElement('style');
    s.id = 'instagram-story-css';
    s.textContent = CSS + IO_CSS;
    document.head.appendChild(s);
  }

  var LINE = 'fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
  var DOTS = '<svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><circle cx="5" cy="12" r="1.8"></circle><circle cx="12" cy="12" r="1.8"></circle><circle cx="19" cy="12" r="1.8"></circle></svg>';
  var X = '<svg width="22" height="22" viewBox="0 0 24 24" ' + LINE + '><path d="M6 6l12 12M18 6 6 18"></path></svg>';
  var HEART = '<svg width="26" height="26" viewBox="0 0 24 24" ' + LINE + '><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"></path></svg>';
  var PLANE = '<svg width="26" height="26" viewBox="0 0 24 24" ' + LINE + '><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"></path></svg>';

  customElements.define('instagram-story', class extends HTMLElement {
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
      var slotId = (this.id || 'igstory') + '-photo';

      var app = document.createElement('div');
      app.className = 'igst';

      // The story canvas: the one export frame, letterboxed by the flex
      // centering above.
      var stage = document.createElement('div');
      stage.className = 'igst-stage';
      stage.setAttribute('data-om-frame-export', '');
      stage.setAttribute('data-om-frame-label', 'Instagram story · 1080×1920');
      var slot = document.createElement('image-slot');
      slot.setAttribute('id', slotId);
      slot.setAttribute('fit', 'cover');
      slot.setAttribute('shape', 'rect');
      slot.setAttribute('radius', '0');
      slot.setAttribute('placeholder', 'Drop the story photo');
      if (a(this, 'image-src', '')) slot.setAttribute('src', a(this, 'image-src', ''));
      // Stock photos require attribution: without credit attrs the host
      // renders an error tile over the image (product behavior). Forward
      // them whenever the image came from search_stock_photos.
      if (a(this, 'image-credit', '')) slot.setAttribute('credit', a(this, 'image-credit', ''));
      if (a(this, 'image-credit-href', '')) slot.setAttribute('credit-href', a(this, 'image-credit-href', ''));
      slot.style.cssText = 'display:block;position:absolute;inset:0;width:100%;height:100%';
      stage.appendChild(slot);
      // Author-extras slot: any children of <instagram-story> land INSIDE
      // the canvas (overlays, stickers) — total control stays possible.
      var extras = [].slice.call(this.childNodes);

      // Progress segments (first active) — viewer chrome, export-hidden.
      var prog = document.createElement('div');
      prog.className = 'igst-prog';
      prog.setAttribute('data-omelette-chrome', '');
      prog.innerHTML = '<i class="igst-on"></i><i></i><i></i>';

      // Avatar + username + time + dots/close — viewer chrome, export-hidden.
      var head = document.createElement('div');
      head.className = 'igst-head';
      head.setAttribute('data-omelette-chrome', '');
      head.innerHTML =
        '<div class="igst-av"></div>' +
        '<span class="igst-un"></span><span class="igst-time"></span>' +
        '<span class="igst-x">' + DOTS + X + '</span>';
      // Avatar URL is author/user input: NEVER concatenate into innerHTML
      // (attribute breakout = HTML injection). Style property API only,
      // with CSS-string escaping of backslash and quote.
      var avatarSrc = a(this, 'avatar-src', '');
      if (avatarSrc) {
        head.querySelector('.igst-av').style.backgroundImage =
          'url("' + avatarSrc.replace(/[\\"]/g, function (ch) { return String.fromCharCode(92) + ch; }) + '")';
      }
      head.querySelector('.igst-un').textContent = un;
      head.querySelector('.igst-time').textContent = a(this, 'time', '2h');

      // Reply bar in the bottom letterbox band — viewer chrome, export-
      // hidden (absolute, so hiding cannot reflow).
      var reply = document.createElement('div');
      reply.className = 'igst-reply';
      reply.setAttribute('data-omelette-chrome', '');
      reply.innerHTML = '<div class="igst-field">Send message</div>' + HEART + PLANE;

      stage.appendChild(prog);
      stage.appendChild(head);
      app.appendChild(stage);
      app.appendChild(reply);

      extras.forEach(function (n) { stage.appendChild(n); });

      // Compose the phone: ios-shell wraps the app screen ("inherits" the
      // bezel/status chrome and the fixed physical-device size).
      // ios-shell.js must be loaded. dark: white status text over the
      // black story screen.
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
