/*
 * claude-dashboard local host: the `globalThis.claude` object the Dashboard runtime asks for on claude.ai,
 * answered by `scripts/artifact.mjs serve` over same-origin HTTP. Hand-written; loaded before the runtime.
 *
 *   db         doc(path).get/set/update/delete      -> GET /_api/doc, POST /_api/write
 *              collection(path).limit(n).onSnapshot -> one EventSource on /_api/events, fanned out per collection
 *   assets     upload(blob) -> POST /_api/upload -> {id, url: "/_blob/<id>"}; delete(id) keeps the file (no-op)
 *   user       one local user who can edit (id "local")
 *   downloads  save({filename, data}) -> a browser download
 *   self       publish() is a stub (the runtime checks it exists; store mode never calls it)
 *
 * Not provided (the runtime takes its own "unavailable" path): mcp (connectors), permissions, room, chat, comments.
 */
(() => {
  'use strict';
  const UNAVAILABLE = Object.freeze({ available: false });
  const user = { id: 'local', name: 'You' };
  const sessionReady = fetch('/_api/session', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((s) => {
      if (s && typeof s.userName === 'string' && s.userName) user.name = s.userName;
    })
    .catch(() => {});

  const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const dbError = (code, message) => Object.assign(new Error(message), { code, message });

  async function call(url, init) {
    let res;
    try {
      res = await fetch(url, { cache: 'no-store', ...init });
    } catch {
      throw dbError('unavailable', 'The local dashboard server is not running.');
    }
    const body = await res.json().catch(() => null);
    if (!res.ok) throw dbError((body && body.code) || 'unavailable', (body && body.message) || `HTTP ${res.status}`);
    return body;
  }

  // ---- live store: path -> JSON text, filled by the event stream ----
  const store = new Map();
  let live = false; // a snapshot from the server is in `store`
  const subs = new Set();
  let source = null;

  const parentOf = (path) => path.slice(0, path.lastIndexOf('/'));
  const idOf = (path) => path.slice(path.lastIndexOf('/') + 1);

  function deliver(sub, initial) {
    const changes = [];
    const seen = new Set();
    for (const [path, text] of store) {
      if (parentOf(path) !== sub.collection) continue;
      seen.add(path);
      const before = sub.delivered.get(path);
      if (before === text) continue;
      sub.delivered.set(path, text);
      changes.push({ type: before === undefined ? 'added' : 'modified', path, text });
    }
    for (const [path, text] of sub.delivered) {
      if (seen.has(path)) continue;
      sub.delivered.delete(path);
      changes.push({ type: 'removed', path, text });
    }
    if (!initial && changes.length === 0) return;
    const docChanges = changes.map((c) => {
      const data = JSON.parse(c.text);
      return { type: c.type, doc: { id: idOf(c.path), data: () => clone(data) } };
    });
    try {
      sub.next({ docChanges: () => docChanges, metadata: { fromCache: false, hasPendingWrites: false } });
    } catch (error) {
      console.error('local host: snapshot listener threw', error);
    }
  }

  function flush() {
    for (const sub of subs) {
      const initial = !sub.started;
      sub.started = true;
      deliver(sub, initial);
    }
  }

  function connect() {
    if (source) return;
    source = new EventSource('/_api/events');
    source.addEventListener('snapshot', (event) => {
      const { docs } = JSON.parse(event.data);
      store.clear();
      for (const [path, data] of Object.entries(docs)) store.set(path, JSON.stringify(data));
      live = true;
      flush();
    });
    source.addEventListener('change', (event) => {
      const { changes } = JSON.parse(event.data);
      for (const { path, data } of changes) {
        if (data === null) store.delete(path);
        else store.set(path, JSON.stringify(data));
      }
      flush();
    });
    source.addEventListener('error', () => {
      if (!live) return;
      // The server went away: the runtime backs off and resubscribes; new subscribers wait for the next snapshot.
      live = false;
      const failed = [...subs];
      subs.clear();
      for (const sub of failed) {
        try {
          sub.error(dbError('unavailable', 'Lost the local dashboard server; retrying.'));
        } catch {}
      }
    });
  }

  function collection(path) {
    const ref = {
      limit: () => ref,
      onSnapshot(next, error) {
        const sub = { collection: path, next, error: error || (() => {}), delivered: new Map(), started: false };
        subs.add(sub);
        connect();
        if (live) setTimeout(() => subs.has(sub) && !sub.started && ((sub.started = true), deliver(sub, true)), 0);
        return () => subs.delete(sub);
      },
    };
    return ref;
  }

  function doc(path) {
    const write = (op, data) =>
      call('/_api/write', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op, path, data }) }).then(() => undefined);
    return {
      async get() {
        const body = await call(`/_api/doc?path=${encodeURIComponent(path)}`);
        const data = body.exists ? body.data : undefined;
        return { exists: body.exists === true, data: () => clone(data), metadata: { fromCache: false, hasPendingWrites: false } };
      },
      set: (data) => write('set', data),
      update: (data) => write('update', data),
      delete: () => write('delete'),
    };
  }

  const db = { doc, collection };

  const assets = {
    async upload(file) {
      const name = (file && typeof file.name === 'string' && file.name) || 'upload';
      const res = await fetch('/_api/upload', {
        method: 'POST',
        headers: { 'Content-Type': (file && file.type) || 'application/octet-stream', 'X-Filename': encodeURIComponent(name) },
        body: file,
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body) throw dbError((body && body.code) || 'unavailable', (body && body.message) || `Upload failed (HTTP ${res.status}).`);
      return { id: body.id, url: body.url };
    },
    // Uploads are content-addressed and small; the agent removes one with `artifact.mjs delete-asset`.
    async delete() {},
  };

  const users = {
    id: async () => user.id,
    name: async () => (await sessionReady, user.name),
    canEdit: async () => true,
    can: async () => true,
  };

  const downloads = {
    async save({ filename, data }) {
      const blob = data instanceof Blob ? data : new Blob([data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'download';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    },
  };

  // Only the runtime's page-storage mode publishes; this page runs in store mode, so nothing calls it.
  const self = { publish: async () => ({}) };

  const capabilities = { db, assets, user: users, downloads, self };
  globalThis.claude = {
    ...capabilities,
    use: async (name) => (Object.hasOwn(capabilities, name) ? capabilities[name] : UNAVAILABLE),
  };

  // The serif face is fetched from claude.ai's /_runtime/, which isn't here: let the CSS fall back without a 404.
  const NativeFontFace = globalThis.FontFace;
  if (typeof NativeFontFace === 'function') {
    const LocalFontFace = function FontFace(family, src, descriptors) {
      if (typeof src === 'string' && src.includes('/_runtime/')) {
        const face = new NativeFontFace(family, `local(${JSON.stringify(String(family))})`, descriptors);
        face.load = () => new Promise(() => {});
        return face;
      }
      return new NativeFontFace(family, src, descriptors);
    };
    LocalFontFace.prototype = NativeFontFace.prototype;
    globalThis.FontFace = LocalFontFace;
  }
})();
