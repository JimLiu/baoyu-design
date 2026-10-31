// claude-dashboard local host: globalThis.claude for the Dashboard runtime (prebuilt; do not edit).
"use strict";
(() => {
  var UNAVAILABLE = Object.freeze({ available: false });
  var user = { id: "local", name: "You" };
  var sessionReady = fetch("/_api/session", { cache: "no-store" }).then((r) => r.ok ? r.json() : null).then((s) => {
    if (s && typeof s.userName === "string" && s.userName) user.name = s.userName;
  }).catch(() => {
  });
  var clone = (v) => v === void 0 ? void 0 : JSON.parse(JSON.stringify(v));
  var dbError = (code, message) => Object.assign(new Error(message), { code, message });
  async function call(url, init) {
    let res;
    try {
      res = await fetch(url, { cache: "no-store", ...init });
    } catch {
      throw dbError("unavailable", "The local dashboard server is not running.");
    }
    const body = await res.json().catch(() => null);
    if (!res.ok) throw dbError(body && body.code || "unavailable", body && body.message || `HTTP ${res.status}`);
    return body;
  }
  var store = /* @__PURE__ */ new Map();
  var live = false;
  var subs = /* @__PURE__ */ new Set();
  var source = null;
  var parentOf = (path) => path.slice(0, path.lastIndexOf("/"));
  var idOf = (path) => path.slice(path.lastIndexOf("/") + 1);
  function deliver(sub, initial) {
    const changes = [];
    const seen = /* @__PURE__ */ new Set();
    for (const [path, text] of store) {
      if (parentOf(path) !== sub.collection) continue;
      seen.add(path);
      const before = sub.delivered.get(path);
      if (before === text) continue;
      sub.delivered.set(path, text);
      changes.push({ type: before === void 0 ? "added" : "modified", path, text });
    }
    for (const [path, text] of sub.delivered) {
      if (seen.has(path)) continue;
      sub.delivered.delete(path);
      changes.push({ type: "removed", path, text });
    }
    if (!initial && changes.length === 0) return;
    const docChanges = changes.map((c) => {
      const data = JSON.parse(c.text);
      return { type: c.type, doc: { id: idOf(c.path), data: () => clone(data) } };
    });
    try {
      sub.next({ docChanges: () => docChanges, metadata: { fromCache: false, hasPendingWrites: false } });
    } catch (error) {
      console.error("local host: snapshot listener threw", error);
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
    source = new EventSource("/_api/events");
    source.addEventListener("snapshot", (event) => {
      const { docs } = JSON.parse(event.data);
      store.clear();
      for (const [path, data] of Object.entries(docs)) store.set(path, JSON.stringify(data));
      live = true;
      flush();
    });
    source.addEventListener("change", (event) => {
      const { changes } = JSON.parse(event.data);
      for (const { path, data } of changes) {
        if (data === null) store.delete(path);
        else store.set(path, JSON.stringify(data));
      }
      flush();
    });
    source.addEventListener("error", () => {
      if (!live) return;
      live = false;
      const failed = [...subs];
      subs.clear();
      for (const sub of failed) {
        try {
          sub.error(dbError("unavailable", "Lost the local dashboard server; retrying."));
        } catch {
        }
      }
    });
  }
  function collection(path) {
    const ref = {
      limit: () => ref,
      onSnapshot(next, error) {
        const sub = { collection: path, next, error: error || (() => {
        }), delivered: /* @__PURE__ */ new Map(), started: false };
        subs.add(sub);
        connect();
        if (live) setTimeout(() => subs.has(sub) && !sub.started && (sub.started = true, deliver(sub, true)), 0);
        return () => subs.delete(sub);
      }
    };
    return ref;
  }
  function doc(path) {
    const write = (op, data) => call("/_api/write", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op, path, data }) }).then(() => void 0);
    return {
      async get() {
        const body = await call(`/_api/doc?path=${encodeURIComponent(path)}`);
        const data = body.exists ? body.data : void 0;
        return { exists: body.exists === true, data: () => clone(data), metadata: { fromCache: false, hasPendingWrites: false } };
      },
      set: (data) => write("set", data),
      update: (data) => write("update", data),
      delete: () => write("delete")
    };
  }
  var db = { doc, collection };
  var assets = {
    async upload(file) {
      const name = file && typeof file.name === "string" && file.name || "upload";
      const res = await fetch("/_api/upload", {
        method: "POST",
        headers: { "Content-Type": file && file.type || "application/octet-stream", "X-Filename": encodeURIComponent(name) },
        body: file
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body) throw dbError(body && body.code || "unavailable", body && body.message || `Upload failed (HTTP ${res.status}).`);
      return { id: body.id, url: body.url };
    },
    // Uploads are content-addressed and small; the agent removes one with `artifact.mjs delete-asset`.
    async delete() {
    }
  };
  var users = {
    id: async () => user.id,
    name: async () => (await sessionReady, user.name),
    canEdit: async () => true,
    can: async () => true
  };
  var downloads = {
    async save({ filename, data }) {
      const blob = data instanceof Blob ? data : new Blob([data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || "download";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 6e4);
    }
  };
  var self = { publish: async () => ({}) };
  var capabilities = { db, assets, user: users, downloads, self };
  globalThis.claude = {
    ...capabilities,
    use: async (name) => Object.hasOwn(capabilities, name) ? capabilities[name] : UNAVAILABLE
  };
  var NativeFontFace = globalThis.FontFace;
  if (typeof NativeFontFace === "function") {
    const LocalFontFace = function FontFace(family, src, descriptors) {
      if (typeof src === "string" && src.includes("/_runtime/")) {
        const face = new NativeFontFace(family, `local(${JSON.stringify(String(family))})`, descriptors);
        face.load = () => new Promise(() => {
        });
        return face;
      }
      return new NativeFontFace(family, src, descriptors);
    };
    LocalFontFace.prototype = NativeFontFace.prototype;
    globalThis.FontFace = LocalFontFace;
  }
})();
