/* BEGIN USAGE */
/**
 * <post-card> — social feed post card (vanilla web component). The
 * platform-authentic "post around the asset": author row, post text,
 * media area, reaction bar. Compose it inside <chrome-shell> (desktop
 * feeds) or <ios-shell> (mobile) on a social-asset board; your export
 * frame (the element carrying data-om-frame-export) goes in as the
 * card's child and becomes the media. image-only (presence or "true")
 * strips everything but the media — the family's tweak pattern. Structure conditionals OUTSIDE the
 * card (toggle the whole unit), not inside it: children are re-slotted
 * into the media box once at build, so later structural inserts land
 * outside it.
 *
 * Attributes:
 *   platform     'x' | 'linkedin' | 'facebook' | 'reddit'. Sets the
 *                reaction bar, typography details, and (reddit) the vote
 *                column. Default 'x'.
 *   name         Author display name. Default 'Your brand'.
 *   sub          The line under the name (handle · time, community,
 *                etc). Default per platform.
 *   text         The post copy above the media. Default ''.
 *   avatar       Optional image URL for the author avatar (else a
 *                neutral disc).
 *   link-domain / link-title   facebook only: the link-preview footer
 *                under the media (uppercase domain + bold title).
 *
 * Children: the media. Typically one element with
 * data-om-frame-export="" + data-om-frame-label="…" sized by
 * aspect-ratio, containing an <image-slot> and/or designed overlay
 * content. The media box gets a hairline border and rounded corners;
 * the media box's own radius is squared by an always-on rule on the
 * export frame; rounded ANCESTORS are squared by the host at capture.
 *
 * All card dressing renders INSIDE the card but OUTSIDE the export
 * frame, so exports stay clean without any chrome marking; the card is
 * context, the frame is the asset.
 */
/* END USAGE */

(function () {
  if (typeof HTMLElement !== 'function' || customElements.get('post-card')) return;

  var CSS =
    'post-card{display:block;padding:22px 26px;color:#14130f;background:#fff;' +
    'font-family:system-ui,-apple-system,sans-serif}' +
    'post-card .pc-head{display:flex;align-items:center;gap:12px;margin-bottom:12px}' +
    'post-card .pc-av{width:48px;height:48px;border-radius:50%;background:#cfd4da;flex:none;' +
    'background-size:cover;background-position:center}' +
    'post-card .pc-name{font-size:16px;font-weight:700;line-height:1.25}' +
    'post-card .pc-sub{font-size:14px;color:#77726a}' +
    'post-card .pc-text{font-size:16px;line-height:1.5;margin:0 0 14px}' +
    'post-card .pc-media{position:relative;border:1px solid rgba(15,12,8,.1);border-radius:16px;overflow:hidden}' +
    'post-card [data-om-frame-export]{border:0 !important;border-radius:0 !important}' +
    'post-card .pc-linkfoot{border:1px solid rgba(15,12,8,.1);border-top:0;padding:13px 16px;background:#faf9f7}' +
    'post-card .pc-linkdom{font-size:12px;color:#8b8578;text-transform:uppercase;letter-spacing:.04em}' +
    'post-card .pc-linktitle{font-size:16px;font-weight:700;margin-top:3px}' +
    'post-card .pc-bar{display:flex;gap:34px;padding:14px 2px 2px;color:#57534a;font-weight:600;font-size:14px}' +
    'post-card .pc-bar span{display:flex;align-items:center;gap:7px;white-space:nowrap}' +
    'post-card .pc-row{display:flex;gap:14px}' +
    'post-card .pc-votes{display:flex;flex-direction:column;align-items:center;gap:3px;' +
    'color:#878a8c;font-size:13px;font-weight:700}' +
    'post-card .pc-votes svg{display:block}' +
    // image-only (dual-selector contract — DC binds "false" when off):
    // strip author row, copy, reaction bar, link footer, vote column.
    'post-card[image-only=""],post-card[image-only="true"]{padding:0;background:transparent}' +
    'post-card[image-only=""] .pc-head,post-card[image-only="true"] .pc-head,' +
    'post-card[image-only=""] .pc-text,post-card[image-only="true"] .pc-text,' +
    'post-card[image-only=""] .pc-bar,post-card[image-only="true"] .pc-bar,' +
    'post-card[image-only=""] .pc-linkfoot,post-card[image-only="true"] .pc-linkfoot,' +
    'post-card[image-only=""] .pc-votes,post-card[image-only="true"] .pc-votes' +
    '{display:none}' +
    'post-card[image-only=""] .pc-media,post-card[image-only="true"] .pc-media' +
    '{border:0;border-radius:0}';

  function ensureCss() {
    if (document.getElementById('post-card-css')) return;
    var s = document.createElement('style');
    s.id = 'post-card-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  var DEFAULTS = {
    x:        { sub: '@yourbrand · 2h', bar: ['♡ 1.2K', '↺ 340', '💬 88'] },
    linkedin: { sub: 'Company · 2h',    bar: ['👍 847', '💬 63', '↗ Share'] },
    facebook: { sub: '2h · 🌐', bar: ['👍 Like', '💬 Comment', '↗ Share'] },
    reddit:   { sub: 'r/design · Posted by u/yourbrand · 5h', bar: ['💬 128 Comments', '↗ Share', '⭐ Award'] },
  };

  customElements.define('post-card', class extends HTMLElement {
    connectedCallback() {
      // Never build inside a raw DC template: <x-dc>'s children are live DOM
      // that the DC runtime snapshots and re-renders — building there bakes
      // serialized card guts into the compiled template and later
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
      ensureCss();
      if (this.querySelector(':scope > .pc-head, :scope > .pc-row')) return;
      var platform = this.getAttribute('platform') || 'x';
      var d = DEFAULTS[platform] || DEFAULTS.x;

      // Media wrapper takes the author's children (the export frame).
      var media = document.createElement('div');
      media.className = 'pc-media';
      [].slice.call(this.childNodes).forEach(function (n) {
        if (n.nodeType === 1 && n.hasAttribute('data-omelette-chrome')) return;
        media.appendChild(n);
      });

      var head = document.createElement('div');
      head.className = 'pc-head';
      var av = document.createElement('div');
      av.className = 'pc-av';
      if (this.getAttribute('avatar')) {
        av.style.backgroundImage = 'url(' + this.getAttribute('avatar') + ')';
      }
      var names = document.createElement('div');
      names.style.flex = '1';
      var nm = document.createElement('div');
      nm.className = 'pc-name';
      nm.textContent = this.getAttribute('name') || 'Your brand';
      var sub = document.createElement('div');
      sub.className = 'pc-sub';
      sub.textContent = this.getAttribute('sub') || d.sub;
      names.appendChild(nm);
      names.appendChild(sub);
      head.appendChild(av);
      head.appendChild(names);

      var text = document.createElement('p');
      text.className = 'pc-text';
      text.textContent = this.getAttribute('text') || '';
      if (!text.textContent) text.style.display = 'none';

      var bar = document.createElement('div');
      bar.className = 'pc-bar';
      d.bar.forEach(function (t) {
        var s = document.createElement('span');
        s.textContent = t;
        bar.appendChild(s);
      });

      var foot = null;
      if (platform === 'facebook' && (this.getAttribute('link-domain') || this.getAttribute('link-title'))) {
        foot = document.createElement('div');
        foot.className = 'pc-linkfoot';
        var dom = document.createElement('div');
        dom.className = 'pc-linkdom';
        dom.textContent = this.getAttribute('link-domain') || '';
        var ti = document.createElement('div');
        ti.className = 'pc-linktitle';
        ti.textContent = this.getAttribute('link-title') || '';
        foot.appendChild(dom);
        foot.appendChild(ti);
      }

      if (platform === 'reddit') {
        // Vote column to the left of everything (reddit anatomy).
        var row = document.createElement('div');
        row.className = 'pc-row';
        var votes = document.createElement('div');
        votes.className = 'pc-votes';
        votes.innerHTML =
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5l7 7H5z"></path></svg>' +
          '<span style="color:#14130f">2.4k</span>' +
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l-7-7h14z"></path></svg>';
        var main = document.createElement('div');
        main.style.flex = '1';
        nm.style.cssText = 'font-size:18px;margin:5px 0 12px';
        main.appendChild(sub);
        main.appendChild(nm);
        main.appendChild(text);
        main.appendChild(media);
        main.appendChild(bar);
        row.appendChild(votes);
        row.appendChild(main);
        this.appendChild(row);
      } else {
        this.appendChild(head);
        this.appendChild(text);
        this.appendChild(media);
        if (foot) this.appendChild(foot);
        this.appendChild(bar);
      }
    }
  });
})();
