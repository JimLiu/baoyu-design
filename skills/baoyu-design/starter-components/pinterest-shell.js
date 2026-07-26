/* BEGIN USAGE */
/**
 * <pinterest-shell> — finished Pinterest-style pin-detail UI, attribute-
 * driven. A complete, pre-designed mobile pin screen inside an iPhone
 * (composes the ios-shell starter — load ios-shell.js and image-slot.js
 * alongside). No logos or wordmarks. Claude fills attributes; never
 * hand-build this chrome.
 *
 * Attributes:
 *   image-src   Prefill for the pin image (image-slot underneath; give
 *               the ELEMENT an id so drops persist).
 *   image-credit / image-credit-href   Attribution for a stock photo in
 *               image-src (REQUIRED for Unsplash results — error tile
 *               without it); forwarded to the internal slot.
 *   title       Pin title under the image. Default ''.
 *   username    Board/author name. Default 'yourbrand'.
 *   followers   e.g. "12k followers". Default '12k followers'.
 *   site        The Visit-site pill text. Default 'Visit site'.
 *   image-only  Family tweak: presence (or "true") strips phone and all
 *               chrome, leaving just the asset frame.
 *   width       Phone outer width px (default 428; uniform height).
 *
 * The pin image area IS the export frame (labeled "Pinterest pin ·
 * 1000×1500"). The Save button and Visit-site pill OVERLAY the image as
 * SHELL CHROME (export-hidden): downloads ship just the image.
 */
/* END USAGE */

(function () {
  if (typeof HTMLElement !== 'function' || customElements.get('pinterest-shell')) return;

  var CSS =
    'pinterest-shell{display:block}' +
    'pinterest-shell .pns{display:flex;flex-direction:column;height:100%;background:#fff;' +
    'font-family:-apple-system,system-ui,sans-serif;color:#111}' +
    'pinterest-shell .pns-top{display:flex;align-items:center;justify-content:space-between;' +
    'padding:58px 14px 8px}' +
    'pinterest-shell .pns-pinwrap{position:relative;margin:4px 12px 0;border-radius:24px;overflow:hidden}' +
    'pinterest-shell .pns-save{position:absolute;top:14px;right:14px;background:#e60023;color:#fff;' +
    'border:0;border-radius:999px;padding:12px 20px;font-size:15px;font-weight:700;z-index:5}' +
    // Real-Pinterest placement (product owner: keep the buttons where the
    // platform puts them; the photo-credit chip may sit obscured behind in
    // shell mode — it shows unobscured in images-only mode, where all
    // overlays hide).
    'pinterest-shell .pns-visit{position:absolute;bottom:14px;left:14px;' +
    'background:rgba(255,255,255,.95);color:#111;border:0;border-radius:999px;padding:11px 18px;' +
    'font-size:14px;font-weight:600;z-index:5}' +
    'pinterest-shell .pns-share{position:absolute;bottom:14px;right:14px;display:flex;gap:8px;z-index:5}' +
    'pinterest-shell .pns-share span{width:40px;height:40px;border-radius:50%;' +
    'background:rgba(255,255,255,.95);display:flex;align-items:center;justify-content:center;color:#111}' +
    'pinterest-shell .pns-meta{padding:14px 18px 10px}' +
    'pinterest-shell .pns-title{font-size:17px;font-weight:700;line-height:1.3}' +
    'pinterest-shell .pns-head{display:flex;align-items:center;gap:10px;padding:2px 18px 10px}' +
    'pinterest-shell .pns-av{width:36px;height:36px;border-radius:50%;flex:none;' +
    'background:linear-gradient(135deg,#e8e0d8 0%,#c9c2ba 100%) center/cover no-repeat}' +
    'pinterest-shell .pns-un{font-size:14px;font-weight:600;line-height:1.3}' +
    'pinterest-shell .pns-fl{font-size:12.5px;color:#767676;line-height:1.3}' +
    'pinterest-shell .pns-follow{margin-left:auto;background:#efefef;color:#111;border:0;' +
    'border-radius:999px;padding:9px 16px;font-size:13.5px;font-weight:700}' +
    'pinterest-shell .pns-tabs{margin-top:auto;display:flex;align-items:center;' +
    'justify-content:space-around;padding:12px 10px 30px;border-top:.5px solid #eee;color:#111}' +
    // image-only (dual-selector contract — DC binds "false" when off)
    'pinterest-shell[image-only=""] > ios-shell[data-composed-phone],pinterest-shell[image-only="true"] > ios-shell[data-composed-phone]' +
    '{background:transparent;padding:0;border-radius:0;box-shadow:none;width:auto !important}' +
    'pinterest-shell[image-only=""] > ios-shell[data-composed-phone] > .ios-screen,pinterest-shell[image-only="true"] > ios-shell[data-composed-phone] > .ios-screen' +
    '{height:auto !important;border-radius:0;overflow:visible;background:transparent}' +
    'pinterest-shell[image-only=""] > ios-shell[data-composed-phone] > .ios-screen > .ios-island,pinterest-shell[image-only="true"] > ios-shell[data-composed-phone] > .ios-screen > .ios-island,' +
    'pinterest-shell[image-only=""] > ios-shell[data-composed-phone] > .ios-screen > .ios-statusbar,pinterest-shell[image-only="true"] > ios-shell[data-composed-phone] > .ios-screen > .ios-statusbar,' +
    'pinterest-shell[image-only=""] > ios-shell[data-composed-phone] > .ios-screen > .ios-homebar,pinterest-shell[image-only="true"] > ios-shell[data-composed-phone] > .ios-screen > .ios-homebar' +
    '{display:none}' +
    'pinterest-shell[image-only=""] > ios-shell[data-composed-phone] > .ios-screen > .ios-content,pinterest-shell[image-only="true"] > ios-shell[data-composed-phone] > .ios-screen > .ios-content' +
    '{position:static !important}' +
    'pinterest-shell[image-only=""] .pns,pinterest-shell[image-only="true"] .pns' +
    '{width:var(--shell-inner-w,402px);background:transparent}' +
    'pinterest-shell[image-only=""] .pns-top,pinterest-shell[image-only="true"] .pns-top,' +
    'pinterest-shell[image-only=""] .pns-save,pinterest-shell[image-only="true"] .pns-save,' +
    'pinterest-shell[image-only=""] .pns-visit,pinterest-shell[image-only="true"] .pns-visit,' +
    'pinterest-shell[image-only=""] .pns-share,pinterest-shell[image-only="true"] .pns-share,' +
    'pinterest-shell[image-only=""] .pns-meta,pinterest-shell[image-only="true"] .pns-meta,' +
    'pinterest-shell[image-only=""] .pns-head,pinterest-shell[image-only="true"] .pns-head,' +
    'pinterest-shell[image-only=""] .pns-tabs,pinterest-shell[image-only="true"] .pns-tabs' +
    '{display:none}' +
    'pinterest-shell[image-only=""] .pns-pinwrap,pinterest-shell[image-only="true"] .pns-pinwrap' +
    '{margin:0;border-radius:0}';

  function ensureCss() {
    if (document.getElementById('pinterest-shell-css')) return;
    var s = document.createElement('style');
    s.id = 'pinterest-shell-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  var L = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
  var BACK = '<svg width="22" height="22" viewBox="0 0 24 24" ' + L + '><path d="M15 19 8 12l7-7"></path></svg>';
  var DOTS = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.7"></circle><circle cx="12" cy="12" r="1.7"></circle><circle cx="19" cy="12" r="1.7"></circle></svg>';
  var SHARE = '<svg width="17" height="17" viewBox="0 0 24 24" ' + L + '><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 15V3M7.5 7.5 12 3l4.5 4.5"></path></svg>';
  var TABS =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M3 10 12 2.5 21 10v11h-6.6v-6.8H9.6V21H3V10z"></path></svg>' +
    '<svg width="24" height="24" viewBox="0 0 24 24" ' + L + '><circle cx="11" cy="11" r="7"></circle><path d="M21 21l-4.5-4.5"></path></svg>' +
    '<svg width="24" height="24" viewBox="0 0 24 24" ' + L + '><path d="M12 5v14M5 12h14"></path></svg>' +
    '<svg width="24" height="24" viewBox="0 0 24 24" ' + L + '><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 20.5l1.4-4.2A8.4 8.4 0 0 1 3.6 7.5 8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z"></path></svg>';

  customElements.define('pinterest-shell', class extends HTMLElement {
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
      var slotId = (this.id || 'pin') + '-photo';
      var extras = [].slice.call(this.childNodes);

      var app = document.createElement('div');
      app.className = 'pns';

      var top = document.createElement('div');
      top.className = 'pns-top';
      top.innerHTML = BACK + DOTS;

      var wrap = document.createElement('div');
      wrap.className = 'pns-pinwrap';
      var frame = document.createElement('div');
      frame.style.cssText = 'position:relative;width:100%';
      frame.style.aspectRatio = '1000/1500';
      frame.setAttribute('data-om-frame-export', '');
      frame.setAttribute('data-om-frame-label', 'Pinterest pin · 1000×1500');
      var slot = document.createElement('image-slot');
      slot.setAttribute('id', slotId);
      slot.setAttribute('fit', 'cover');
      slot.setAttribute('shape', 'rect');
      slot.setAttribute('radius', '0');
      slot.setAttribute('placeholder', 'Drop the pin image');
      if (a(this, 'image-src', '')) slot.setAttribute('src', a(this, 'image-src', ''));
      if (a(this, 'image-credit', '')) slot.setAttribute('credit', a(this, 'image-credit', ''));
      if (a(this, 'image-credit-href', '')) slot.setAttribute('credit-href', a(this, 'image-credit-href', ''));
      slot.style.cssText = 'display:block;position:absolute;inset:0;width:100%;height:100%';
      frame.appendChild(slot);
      extras.forEach(function (n) { frame.appendChild(n); });
      // Save / Visit / share OVERLAY the image but are SHELL CHROME: marked
      // so exports hide them — downloads ship just the image.
      var save = document.createElement('button');
      save.className = 'pns-save';
      save.textContent = 'Save';
      save.setAttribute('data-omelette-chrome', '');
      var visit = document.createElement('button');
      visit.className = 'pns-visit';
      visit.textContent = a(this, 'site', 'Visit site');
      visit.setAttribute('data-omelette-chrome', '');
      var share = document.createElement('div');
      share.className = 'pns-share';
      share.setAttribute('data-omelette-chrome', '');
      share.innerHTML = '<span>' + SHARE + '</span><span>' + DOTS + '</span>';
      wrap.appendChild(frame);
      wrap.appendChild(save);
      wrap.appendChild(visit);
      wrap.appendChild(share);

      var meta = document.createElement('div');
      meta.className = 'pns-meta';
      var title = document.createElement('div');
      title.className = 'pns-title';
      title.textContent = a(this, 'title', '');
      if (!title.textContent) meta.style.display = 'none';
      meta.appendChild(title);

      var head = document.createElement('div');
      head.className = 'pns-head';
      head.innerHTML =
        '<div class="pns-av"></div>' +
        '<div style="flex:1"><div class="pns-un"></div><div class="pns-fl"></div></div>' +
        '<button class="pns-follow">Follow</button>';
      head.querySelector('.pns-un').textContent = a(this, 'username', 'yourbrand');
      head.querySelector('.pns-fl').textContent = a(this, 'followers', '12k followers');

      var tabs = document.createElement('div');
      tabs.className = 'pns-tabs';
      tabs.innerHTML = TABS + '<div class="pns-av" style="width:26px;height:26px"></div>';

      app.appendChild(top);
      app.appendChild(wrap);
      app.appendChild(meta);
      app.appendChild(head);
      app.appendChild(tabs);

      var phone = document.createElement('ios-shell');
      phone.setAttribute('data-composed-phone', '');
      var outerW = parseInt(a(this, 'width', '428'), 10) || 428;
      phone.setAttribute('width', String(outerW));
      this.style.setProperty('--shell-inner-w', (outerW - 26) + 'px');
      var innerW = outerW - 26;
      var screenH = Math.round(innerW * 874 / 402);
      phone.setAttribute('screen-height', String(screenH));
      phone.appendChild(app);
      this.appendChild(phone);
      if (phone._build && customElements.get('ios-shell')) phone._build();
    }
  });
})();
