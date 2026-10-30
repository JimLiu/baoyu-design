/* BEGIN USAGE */
/**
 * <linkedin-shell> — finished LinkedIn-style mobile feed UI, attribute-
 * driven. A complete, pre-designed feed screen inside an iPhone
 * (composes the ios-shell starter — load ios-shell.js and image-slot.js
 * alongside). No logos or wordmarks. Claude fills attributes; never
 * hand-build this chrome.
 *
 * Attributes:
 *   image-src   Prefill for the media (image-slot underneath; give the
 *               ELEMENT an id so drops persist).
 *   image-credit / image-credit-href   Attribution for a stock photo in
 *               image-src (REQUIRED for Unsplash results — error tile
 *               without it); forwarded to the internal slot.
 *   name        Author/page name. Default 'Your brand'.
 *   headline    The line under the name (role/company tagline).
 *   time        e.g. "2h". Default '2h' (renders with the globe).
 *   text        The post copy above the media.
 *   reactions   e.g. "847". Default '847'.
 *   comments    e.g. "63 comments". Default '63 comments'.
 *   reposts     e.g. "12 reposts". Default '12 reposts'.
 *   avatar-src  Avatar image URL (else a neutral disc).
 *   aspect      "wide" (default, 1200×627) | "square" (1080×1080).
 *   image-only  Family tweak: strips phone and chrome to the bare asset.
 *   width       Phone outer width px (default 428; uniform height).
 *
 * Attributes are read ONCE at build; only image-only toggles live.
 * The media area IS the export frame (labeled "LinkedIn post · W×H").
 */
/* END USAGE */

(function () {
  if (typeof HTMLElement !== 'function' || customElements.get('linkedin-shell')) return;

  var CSS =
    'linkedin-shell{display:block}' +
    'linkedin-shell .lis{display:flex;flex-direction:column;height:100%;background:#f3f2ef;' +
    'font-family:-apple-system,system-ui,sans-serif;color:#1d1d1d}' +
    'linkedin-shell .lis-top{display:flex;align-items:center;gap:10px;padding:58px 14px 10px;background:#fff}' +
    'linkedin-shell .lis-avs{width:32px;height:32px;border-radius:50%;flex:none;' +
    'background:linear-gradient(135deg,#e8e0d8 0%,#c9c2ba 100%) center/cover no-repeat}' +
    'linkedin-shell .lis-search{flex:1;background:#eef3f8;border-radius:6px;padding:8px 12px;' +
    'font-size:14px;color:#5b6770;display:flex;align-items:center;gap:8px}' +
    'linkedin-shell .lis-card{background:#fff;margin-top:8px}' +
    'linkedin-shell .lis-head{display:flex;align-items:flex-start;gap:9px;padding:12px 14px 8px}' +
    'linkedin-shell .lis-av{width:44px;height:44px;border-radius:50%;flex:none;' +
    'background:linear-gradient(135deg,#e8e0d8 0%,#c9c2ba 100%) center/cover no-repeat}' +
    'linkedin-shell .lis-name{font-size:14.5px;font-weight:600;line-height:1.3}' +
    'linkedin-shell .lis-sub{font-size:12.5px;color:#666;line-height:1.35}' +
    'linkedin-shell .lis-time{font-size:12.5px;color:#666;display:flex;align-items:center;gap:4px}' +
    'linkedin-shell .lis-follow{margin-left:auto;color:#0a66c2;font-size:14.5px;font-weight:600;' +
    'background:none;border:0;display:flex;align-items:center;gap:4px}' +
    'linkedin-shell .lis-text{padding:0 14px 10px;font-size:14.5px;line-height:1.4}' +
    'linkedin-shell .lis-media{position:relative;width:100%;background:#f0f0f0}' +
    'linkedin-shell .lis-counts{display:flex;align-items:center;justify-content:space-between;' +
    'padding:9px 14px;font-size:12.5px;color:#666;border-bottom:.5px solid #e8e8e8;margin:0 0 2px}' +
    'linkedin-shell .lis-blob{width:16px;height:16px;border-radius:50%;background:#378fe9;' +
    'display:inline-flex;align-items:center;justify-content:center;color:#fff;margin-right:4px}' +
    'linkedin-shell .lis-bar{display:flex;align-items:center;padding:2px 6px 6px}' +
    'linkedin-shell .lis-act{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;' +
    'padding:7px 0;font-size:12px;font-weight:600;color:#5b6770;white-space:nowrap}' +
    'linkedin-shell .lis-act svg{display:block}' +
    'linkedin-shell .lis-tabs{margin-top:auto;display:flex;align-items:center;' +
    'justify-content:space-around;padding:12px 10px 30px;background:#fff;' +
    'border-top:.5px solid #e8e8e8;color:#5b6770}' +
    // image-only (dual-selector contract — DC binds "false" when off)
    'linkedin-shell[image-only=""] > ios-shell[data-composed-phone],linkedin-shell[image-only="true"] > ios-shell[data-composed-phone]' +
    '{background:transparent;padding:0;border-radius:0;box-shadow:none;width:auto !important}' +
    'linkedin-shell[image-only=""] > ios-shell[data-composed-phone] > .ios-screen,linkedin-shell[image-only="true"] > ios-shell[data-composed-phone] > .ios-screen' +
    '{height:auto !important;border-radius:0;overflow:visible;background:transparent}' +
    'linkedin-shell[image-only=""] > ios-shell[data-composed-phone] > .ios-screen > .ios-island,linkedin-shell[image-only="true"] > ios-shell[data-composed-phone] > .ios-screen > .ios-island,' +
    'linkedin-shell[image-only=""] > ios-shell[data-composed-phone] > .ios-screen > .ios-statusbar,linkedin-shell[image-only="true"] > ios-shell[data-composed-phone] > .ios-screen > .ios-statusbar,' +
    'linkedin-shell[image-only=""] > ios-shell[data-composed-phone] > .ios-screen > .ios-homebar,linkedin-shell[image-only="true"] > ios-shell[data-composed-phone] > .ios-screen > .ios-homebar' +
    '{display:none}' +
    'linkedin-shell[image-only=""] > ios-shell[data-composed-phone] > .ios-screen > .ios-content,linkedin-shell[image-only="true"] > ios-shell[data-composed-phone] > .ios-screen > .ios-content' +
    '{position:static !important}' +
    'linkedin-shell[image-only=""] .lis,linkedin-shell[image-only="true"] .lis' +
    '{width:var(--shell-inner-w,402px);background:transparent}' +
    'linkedin-shell[image-only=""] .lis-top,linkedin-shell[image-only="true"] .lis-top,' +
    'linkedin-shell[image-only=""] .lis-head,linkedin-shell[image-only="true"] .lis-head,' +
    'linkedin-shell[image-only=""] .lis-text,linkedin-shell[image-only="true"] .lis-text,' +
    'linkedin-shell[image-only=""] .lis-counts,linkedin-shell[image-only="true"] .lis-counts,' +
    'linkedin-shell[image-only=""] .lis-bar,linkedin-shell[image-only="true"] .lis-bar,' +
    'linkedin-shell[image-only=""] .lis-tabs,linkedin-shell[image-only="true"] .lis-tabs' +
    '{display:none}' +
    'linkedin-shell[image-only=""] .lis-card,linkedin-shell[image-only="true"] .lis-card' +
    '{margin:0;background:transparent}';

  function ensureCss() {
    if (document.getElementById('linkedin-shell-css')) return;
    var s = document.createElement('style');
    s.id = 'linkedin-shell-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  var L = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
  var SEARCH = '<svg width="15" height="15" viewBox="0 0 24 24" ' + L + '><circle cx="11" cy="11" r="7"></circle><path d="M21 21l-4.5-4.5"></path></svg>';
  var GLOBE = '<svg width="11" height="11" viewBox="0 0 24 24" ' + L.replace('1.8','2') + '><circle cx="12" cy="12" r="9"></circle><path d="M3 12h18M12 3a13.5 13.5 0 0 1 0 18 13.5 13.5 0 0 1 0-18z"></path></svg>';
  var PLUS = '<svg width="14" height="14" viewBox="0 0 24 24" ' + L + '><path d="M12 5v14M5 12h14"></path></svg>';
  var THUMBF = '<svg width="9" height="9" viewBox="0 0 24 24" fill="#fff"><path d="M7 11l4.2-7.4A2.2 2.2 0 0 1 13.4 6l-.8 3.4h6a1.8 1.8 0 0 1 1.8 2.2l-1.3 5.6a1.8 1.8 0 0 1-1.8 1.4H7z"></path></svg>';
  var LIKE = '<svg width="18" height="18" viewBox="0 0 24 24" ' + L + '><path d="M7 11v9M7 11l4-7a2.4 2.4 0 0 1 2.3 3l-.8 3h5.6a2 2 0 0 1 2 2.4l-1.2 5a2 2 0 0 1-2 1.6H7M7 11H4a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h3"></path></svg>';
  var COMMENT = '<svg width="18" height="18" viewBox="0 0 24 24" ' + L + '><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 20.5l1.4-4.2A8.4 8.4 0 0 1 3.6 7.5 8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z"></path></svg>';
  var REPOST = '<svg width="18" height="18" viewBox="0 0 24 24" ' + L + '><path d="M17 2.5 21 7l-4 4.5M21 7H8a4 4 0 0 0-4 4v1M7 21.5 3 17l4-4.5M3 17h13a4 4 0 0 0 4-4v-1"></path></svg>';
  var SEND = '<svg width="18" height="18" viewBox="0 0 24 24" ' + L + '><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"></path></svg>';
  var TABS =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M3 10 12 2.5 21 10v11h-6.6v-6.8H9.6V21H3V10z"></path></svg>' +
    '<svg width="24" height="24" viewBox="0 0 24 24" ' + L + '><circle cx="9" cy="8" r="3.2"></circle><path d="M3.5 20c.6-3.4 2.8-5.2 5.5-5.2s4.9 1.8 5.5 5.2"></path><circle cx="17.5" cy="9" r="2.4"></circle><path d="M15.4 14.6c2.5.1 4.3 1.7 4.9 4.6"></path></svg>' +
    '<svg width="24" height="24" viewBox="0 0 24 24" ' + L + '><rect x="4" y="4" width="16" height="16" rx="3"></rect><path d="M12 8v8M8 12h8"></path></svg>' +
    '<svg width="24" height="24" viewBox="0 0 24 24" ' + L + '><path d="M18 9a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7M10.3 20a2 2 0 0 0 3.4 0"></path></svg>' +
    '<svg width="24" height="24" viewBox="0 0 24 24" ' + L + '><rect x="3" y="8" width="18" height="12" rx="2"></rect><path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';

  customElements.define('linkedin-shell', class extends HTMLElement {
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
      var label = square ? 'LinkedIn post · 1080×1080' : 'LinkedIn post · 1200×627';
      var slotId = (this.id || 'li') + '-photo';
      var extras = [].slice.call(this.childNodes);

      var app = document.createElement('div');
      app.className = 'lis';

      var top = document.createElement('div');
      top.className = 'lis-top';
      top.innerHTML = '<div class="lis-avs"></div><div class="lis-search">' + SEARCH + 'Search</div>';

      var card = document.createElement('div');
      card.className = 'lis-card';

      var head = document.createElement('div');
      head.className = 'lis-head';
      var avStyle = a(this, 'avatar-src', '');
      head.innerHTML =
        '<div class="lis-av"></div>' +
        '<div style="flex:1;min-width:0"><div class="lis-name"></div>' +
        '<div class="lis-sub"></div>' +
        '<div class="lis-time"><span class="lis-t"></span> · ' + GLOBE + '</div></div>' +
        '<button class="lis-follow">' + PLUS + 'Follow</button>';
      if (avStyle) {
        head.querySelector('.lis-av').style.backgroundImage =
          'url("' + avStyle.replace(/[\\"]/g, function (ch) { return String.fromCharCode(92) + ch; }) + '")';
      }
      head.querySelector('.lis-name').textContent = a(this, 'name', 'Your brand');
      head.querySelector('.lis-sub').textContent = a(this, 'headline', '');
      head.querySelector('.lis-t').textContent = a(this, 'time', '2h');

      var text = document.createElement('div');
      text.className = 'lis-text';
      text.textContent = a(this, 'text', '');
      if (!text.textContent) text.style.display = 'none';

      var media = document.createElement('div');
      media.className = 'lis-media';
      media.style.aspectRatio = square ? '1/1' : '1200/627';
      media.setAttribute('data-om-frame-export', '');
      media.setAttribute('data-om-frame-label', label);
      var slot = document.createElement('image-slot');
      slot.setAttribute('id', slotId);
      slot.setAttribute('fit', 'cover');
      slot.setAttribute('shape', 'rect');
      slot.setAttribute('radius', '0');
      slot.setAttribute('placeholder', 'Drop the post image');
      if (a(this, 'image-src', '')) slot.setAttribute('src', a(this, 'image-src', ''));
      if (a(this, 'image-credit', '')) slot.setAttribute('credit', a(this, 'image-credit', ''));
      if (a(this, 'image-credit-href', '')) slot.setAttribute('credit-href', a(this, 'image-credit-href', ''));
      slot.style.cssText = 'display:block;position:absolute;inset:0;width:100%;height:100%';
      media.appendChild(slot);
      extras.forEach(function (n) { media.appendChild(n); });

      var counts = document.createElement('div');
      counts.className = 'lis-counts';
      counts.innerHTML =
        '<span><span class="lis-blob">' + THUMBF + '</span><span class="lis-rx"></span></span>' +
        '<span><span class="lis-cm"></span> · <span class="lis-rp"></span></span>';
      counts.querySelector('.lis-rx').textContent = a(this, 'reactions', '847');
      counts.querySelector('.lis-cm').textContent = a(this, 'comments', '63 comments');
      counts.querySelector('.lis-rp').textContent = a(this, 'reposts', '12 reposts');

      var bar = document.createElement('div');
      bar.className = 'lis-bar';
      bar.innerHTML =
        '<span class="lis-act">' + LIKE + 'Like</span>' +
        '<span class="lis-act">' + COMMENT + 'Comment</span>' +
        '<span class="lis-act">' + REPOST + 'Repost</span>' +
        '<span class="lis-act">' + SEND + 'Send</span>';

      card.appendChild(head);
      card.appendChild(text);
      card.appendChild(media);
      card.appendChild(counts);
      card.appendChild(bar);

      var tabs = document.createElement('div');
      tabs.className = 'lis-tabs';
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
      var screenH = Math.round(innerW * 874 / 402);
      phone.setAttribute('screen-height', String(screenH));
      phone.appendChild(app);
      this.appendChild(phone);
      if (phone._build && customElements.get('ios-shell')) phone._build();
    }
  });
})();
