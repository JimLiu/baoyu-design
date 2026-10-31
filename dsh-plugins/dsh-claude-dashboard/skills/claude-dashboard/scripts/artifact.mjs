#!/usr/bin/env node
// claude-dashboard: local Artifact tool (prebuilt; do not edit).

import { spawn as spawn2 } from "node:child_process";
import { createHash as createHash3 } from "node:crypto";
import fs6 from "node:fs";
import http from "node:http";
import path5 from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

import { createHash } from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
var STATE_FILE = ".artifact-server.json";
var LOG_FILE = ".artifact-server.log";
function readState(root) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, STATE_FILE), "utf8"));
  } catch {
    return null;
  }
}
function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}
async function runningServer(root, kind, probe) {
  const state = readState(root);
  if (!state || state.kind !== kind || !alive(state.pid)) return null;
  try {
    const response = await fetch(new URL(probe, state.url), { signal: AbortSignal.timeout(2e3) });
    return response.ok ? state : null;
  } catch {
    return null;
  }
}
function recordServer(state, close, signals = ["SIGINT", "SIGTERM"]) {
  const file = path.join(state.root, STATE_FILE);
  fs.writeFileSync(file, `${JSON.stringify(state, null, 2)}
`);
  const shutdown = () => {
    if (readState(state.root)?.pid === process.pid) fs.rmSync(file, { force: true });
    close();
    process.exit(0);
  };
  for (const signal of signals) process.on(signal, shutdown);
}
async function listen(server, port, host) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve());
  });
  const address = server.address();
  return typeof address === "object" && address ? address.port : port;
}
var DEFAULT_PORTS = { slides: 4710, design: 4720, "design-system": 4730, dashboard: 4740, docs: 4750, motion: 4760 };
var PORT_TRIES = 100;
var PortsTaken = class extends Error {
  code = "PORT_IN_USE";
  from;
  to;
  constructor(from, to) {
    super(`${from === to ? `Port ${from} is` : `Ports ${from} to ${to} are all`} in use; pick another --port (0 takes any free one).`);
    this.from = from;
    this.to = to;
  }
};
function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const entry of list ?? []) if (entry.family === "IPv4" && !entry.internal && !entry.address.startsWith("169.254.")) out.push(entry.address);
  }
  return [...new Set(out)];
}
function answers(host, port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (taken) => {
      socket.destroy();
      resolve(taken);
    };
    socket.setTimeout(300, () => done(true));
    socket.once("connect", () => done(true));
    socket.once("error", (error) => done(!["ECONNREFUSED", "EADDRNOTAVAIL", "ENETUNREACH", "EHOSTUNREACH"].includes(error.code ?? "")));
  });
}
async function listenFree(server, from, host, first) {
  if (from === 0) return listen(server, 0, host);
  const to = Math.min(from + PORT_TRIES - 1, 65535);
  const range = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const ports = first ? [first, ...range.filter((port) => port !== first)] : range;
  const wildcard = host === "0.0.0.0" || host === "::";
  const probes = [.../* @__PURE__ */ new Set([...wildcard ? [] : [host], "127.0.0.1", "::1", ...lanAddresses()])];
  for (const port of ports) {
    if ((await Promise.all(probes.map((address) => answers(address, port)))).some(Boolean)) continue;
    try {
      return await listen(server, port, host);
    } catch (error) {
      if (error.code !== "EADDRINUSE") throw error;
    }
  }
  throw new PortsTaken(from, to);
}
function serverOrigin(host, port) {
  const shown = host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host.includes(":") ? `[${host}]` : host;
  return `http://${shown}:${port}`;
}
var pagePathOf = (kind, root) => `/${kind}/${createHash("sha256").update(path.resolve(root)).digest("base64url").slice(0, 22)}/`;
function pageRoute(pathname, page) {
  if (pathname === "/" || pathname === "/index.html" || pathname === page.slice(0, -1)) return { redirect: page };
  return { path: pathname.startsWith(page) ? `/${pathname.slice(page.length)}` : pathname };
}
function sendJson(response, status, body, headers = {}) {
  const text = JSON.stringify(body);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(text),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers
  });
  response.end(text);
}
var TooLarge = class extends Error {
};
function readBody(request, limit) {
  return new Promise((resolve, reject) => {
    const declared = Number(request.headers["content-length"]);
    if (Number.isFinite(declared) && declared > limit) {
      reject(new TooLarge());
      request.resume();
      return;
    }
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new TooLarge());
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}
function sameOrigin(request) {
  const origin = request.headers.origin;
  if (origin === void 0) return true;
  const host = request.headers.host;
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
function sendFile(request, response, file, headers) {
  response.writeHead(200, headers);
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  const stream = fs.createReadStream(file);
  stream.on("error", () => response.destroy());
  response.on("close", () => stream.destroy());
  stream.pipe(response);
}

import { createHash as createHash2 } from "node:crypto";
import fs3 from "node:fs";
import os2 from "node:os";
import path3 from "node:path";

import crypto from "node:crypto";
import fs2 from "node:fs";
import path2 from "node:path";
var GUEST_ROLES = ["editor", "commenter", "viewer"];
var isGuestRole = (value) => typeof value === "string" && GUEST_ROLES.includes(value);
var SHARING_FILE = ".sharing.json";
var MAX_GUESTS = 200;
var MAX_NAME = 40;
var token = (bytes = 18) => crypto.randomBytes(bytes).toString("base64url");
var isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
function fresh() {
  return { lan: false, links: { editor: { token: token(), on: true }, commenter: { token: token(), on: true }, viewer: { token: token(), on: true } }, guests: [] };
}
function cleanName(raw) {
  const name = typeof raw === "string" ? raw.replace(/[\u0000-\u001f\u007f@<>]/g, "").replace(/\s+/g, " ").trim() : "";
  return [...name].slice(0, MAX_NAME).join("");
}
function guestUser(guest) {
  return { id: `guest-${guest.id}`, name: guest.name, email: `${guest.name}@${guest.id}.guest` };
}
function isLoopback(address) {
  if (!address) return false;
  const a = address.startsWith("::ffff:") ? address.slice(7) : address;
  return a === "::1" || a.startsWith("127.");
}
var Sharing = class _Sharing {
  file;
  state;
  constructor(root) {
    this.file = path2.join(root, SHARING_FILE);
    this.state = _Sharing.read(this.file);
  }
  static read(file) {
    let raw;
    try {
      raw = JSON.parse(fs2.readFileSync(file, "utf8"));
    } catch {
      return fresh();
    }
    const state = fresh();
    if (!isRecord(raw)) return state;
    state.lan = raw.lan === true;
    if (typeof raw.port === "number" && Number.isInteger(raw.port) && raw.port > 0 && raw.port < 65536) state.port = raw.port;
    if (isRecord(raw.links)) {
      for (const role of GUEST_ROLES) {
        const link = raw.links[role];
        if (isRecord(link) && typeof link.token === "string" && link.token.length >= 16) state.links[role] = { token: link.token, on: link.on !== false };
      }
    }
    if (Array.isArray(raw.guests)) {
      for (const g of raw.guests) {
        if (!isRecord(g) || typeof g.id !== "string" || typeof g.secret !== "string" || !isGuestRole(g.role) || typeof g.link !== "string") continue;
        state.guests.push({
          id: g.id,
          secret: g.secret,
          name: cleanName(g.name) || "Guest",
          role: g.role,
          link: g.link,
          joined: typeof g.joined === "string" ? g.joined : (/* @__PURE__ */ new Date(0)).toISOString(),
          ...typeof g.seen === "string" ? { seen: g.seen } : {}
        });
      }
    }
    return state;
  }
  save() {
    const tmp = `${this.file}.${process.pid}.tmp`;
    fs2.writeFileSync(tmp, `${JSON.stringify(this.state, null, 2)}
`, { mode: 384 });
    fs2.renameSync(tmp, this.file);
  }
  /** The role whose link has this token, while that link is on. */
  linkRole(tokenGiven) {
    for (const role of GUEST_ROLES) {
      const link = this.state.links[role];
      if (link.on && tokenGiven.length === link.token.length && crypto.timingSafeEqual(Buffer.from(tokenGiven), Buffer.from(link.token))) return role;
    }
    return null;
  }
  /** The guest a cookie names, if they still have access (their link on and not reset). */
  guest(secret) {
    if (!secret) return null;
    const guest = this.state.guests.find((g) => g.secret === secret);
    return guest && this.valid(guest) ? guest : null;
  }
  valid(guest) {
    const link = this.state.links[guest.role];
    return link.on && link.token === guest.link && this.state.guests.includes(guest);
  }
  join(role, name) {
    const guest = { id: token(4), secret: token(24), name: cleanName(name) || "Guest", role, link: this.state.links[role].token, joined: (/* @__PURE__ */ new Date()).toISOString() };
    this.state.guests.push(guest);
    if (this.state.guests.length > MAX_GUESTS) this.state.guests.splice(0, this.state.guests.length - MAX_GUESTS);
    this.save();
    return guest;
  }
  /** Marks a guest seen now (saved at most once a minute per guest). */
  seen(guest) {
    const now = /* @__PURE__ */ new Date();
    if (guest.seen && now.getTime() - Date.parse(guest.seen) < 6e4) return;
    guest.seen = now.toISOString();
    this.save();
  }
  setLan(on, port) {
    this.state.lan = on;
    if (on && port) this.state.port = port;
    this.save();
  }
  setLink(role, on) {
    this.state.links[role].on = on;
    this.save();
  }
  /** A new token for the link: the old link stops working and the guests who came through it are dropped. */
  resetLink(role) {
    const old = this.state.links[role].token;
    this.state.links[role] = { token: token(), on: this.state.links[role].on };
    this.state.guests = this.state.guests.filter((g) => g.link !== old);
    this.save();
  }
  /**
   * Gives a guest another role. They now hang on that role's link (turning it off or resetting it drops them), so a role
   * whose link is off would shut them out: false then, as for a guest who isn't there.
   */
  setRole(id, role) {
    const guest = this.state.guests.find((g) => g.id === id);
    if (!guest || !this.state.links[role].on) return false;
    guest.role = role;
    guest.link = this.state.links[role].token;
    this.save();
    return true;
  }
  removeGuest(id) {
    const before = this.state.guests.length;
    this.state.guests = this.state.guests.filter((g) => g.id !== id);
    if (this.state.guests.length === before) return false;
    this.save();
    return true;
  }
};

var NOUNS = {
  docs: { en: "doc", zh: "\u6587\u6863", zhThis: "\u8FD9\u7BC7\u6587\u6863" },
  slides: { en: "deck", zh: "\u6F14\u793A\u6587\u7A3F", zhThis: "\u8FD9\u4EFD\u6F14\u793A\u6587\u7A3F" },
  design: { en: "design", zh: "\u8BBE\u8BA1\u7A3F", zhThis: "\u8FD9\u4EFD\u8BBE\u8BA1\u7A3F" },
  "design-system": { en: "design system", zh: "\u8BBE\u8BA1\u7CFB\u7EDF", zhThis: "\u8FD9\u4E2A\u8BBE\u8BA1\u7CFB\u7EDF" },
  dashboard: { en: "dashboard", zh: "\u4EEA\u8868\u76D8", zhThis: "\u8FD9\u4E2A\u4EEA\u8868\u76D8" },
  motion: { en: "animation", zh: "\u52A8\u753B", zhThis: "\u8FD9\u4E2A\u52A8\u753B" }
};
var ShareError = class extends Error {
};
var canEditAs = (role) => role === "owner" || role === "editor";
function commentsViewer(viewer) {
  return {
    author: viewer.guest ? { kind: "user", name: viewer.user.name, principal: viewer.user.email } : { kind: "user", name: viewer.user.name },
    canComment: viewer.role !== "viewer",
    canSend: viewer.role === "owner",
    admin: viewer.role === "owner"
  };
}
var isRecord2 = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
var esc = (text) => text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var script = (value) => JSON.stringify(value).replace(/</g, "\\u003c");
function ownHosts(host, port) {
  const named = host === "0.0.0.0" || host === "::" ? [] : [host.includes(":") ? `[${host}]:${port}` : `${host}:${port}`];
  return [.../* @__PURE__ */ new Set([`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`, ...named])];
}
function localOwner() {
  let name = "You";
  try {
    name = os2.userInfo().username.trim() || name;
  } catch {
  }
  return { id: "local", name, email: `${name}@localhost` };
}
var guestCookieName = (kind, root) => `${kind.replace(/-/g, "_")}_guest_${createHash2("sha256").update(path3.resolve(root)).digest("hex").slice(0, 12)}`;
function dbAccess(viewer, segs, adminRead = /* @__PURE__ */ new Set()) {
  const admin = canEditAs(viewer.role);
  const read = segs[0] === "data" && segs[1] === "users" && segs.length > 2 ? segs[2] === viewer.user.id : admin || !adminRead.has(segs[0] ?? "");
  return { read, write: read && admin };
}
var ShareHost = class {
  sharing;
  options;
  /** The port the server listens on (set by `listening`); the LAN listeners take the same one. */
  port = 0;
  hosts = /* @__PURE__ */ new Set();
  /** One listener per LAN address while the artifact is open to the network. */
  lanServers = /* @__PURE__ */ new Map();
  live = /* @__PURE__ */ new Set();
  constructor(options) {
    this.options = options;
    this.sharing = new Sharing(options.root);
  }
  /**
   * Starts `server` on the first free port from `port` (a shared artifact tries the port its links were given out with
   * first, so they keep working, unless the port was given), shares it on the network with `lan` (or as it was left)
   * and answers the port taken. If this throws, the caller closes what it started.
   */
  async listen(server, { port, host, lan = false, portGiven = false }) {
    const { state } = this.sharing;
    const linksPort = !portGiven && (lan || state.lan) && state.port ? state.port : void 0;
    const taken = await listenFree(server, port, host, linksPort);
    if (linksPort && taken !== linksPort) this.options.log(`port ${linksPort} (the shared links') is in use; took ${taken}: give the new links out again`);
    else if (!linksPort && port && taken !== port) this.options.log(`port ${port} is in use; took ${taken}`);
    if (lan && !this.sharing.state.lan) this.sharing.setLan(true, taken);
    await this.listening(taken, ownHosts(host, taken));
    return taken;
  }
  /** The artifact at each LAN address it is shared on ([] while it is not). */
  lanUrls() {
    return [...this.lanServers.keys()].map((a) => `http://${a}:${this.port}/`);
  }
  /** The main listener is up on `port` (answering `hosts`): open to the network now if the artifact was left shared. */
  async listening(port, hosts) {
    this.port = port;
    this.hosts = new Set(hosts);
    if (this.sharing.state.lan) await this.setLan(true);
  }
  /** Open to the local network now. */
  get shared() {
    return this.lanServers.size > 0;
  }
  /** A Host header this server answers: its own names, and while shared, its LAN addresses and machine name. */
  hostAllowed(request) {
    const host = request.headers.host ?? "";
    if (this.hosts.has(host)) return true;
    if (!this.lanServers.size) return false;
    const suffix = `:${this.port}`;
    if (!host.endsWith(suffix)) return false;
    const name = host.slice(0, -suffix.length).toLowerCase();
    const machine = os2.hostname().toLowerCase();
    return this.lanServers.has(name) || name === machine || name === `${machine.replace(/\.local$/, "")}.local`;
  }
  /**
   * Opens the artifact to the local network (a listener on each LAN address, on the server's port) or closes it.
   * Returns the addresses it listens on. Guests already in keep their place for when it opens again.
   */
  async setLan(on) {
    if (!on) {
      this.closeLan();
      for (const live of [...this.live]) if (live.viewer.guest) live.close("unshared");
      if (this.sharing.state.lan) this.sharing.setLan(false);
      return [];
    }
    for (const address of lanAddresses()) {
      if (this.lanServers.has(address)) continue;
      const server = this.options.createServer();
      try {
        await listen(server, this.port, address);
        this.lanServers.set(address, server);
      } catch (error) {
        server.close();
        this.options.log(`not listening on ${address}:${this.port}: ${error.message}`);
      }
    }
    if (!this.sharing.state.lan || this.sharing.state.port !== this.port) this.sharing.setLan(true, this.port);
    this.options.log(`shared on the local network: ${[...this.lanServers.keys()].map((a) => `http://${a}:${this.port}/`).join(", ") || "(no LAN address)"}`);
    return [...this.lanServers.keys()];
  }
  closeLan() {
    for (const server of this.lanServers.values()) {
      server.close();
      server.closeAllConnections?.();
    }
    this.lanServers.clear();
  }
  /** Stops the LAN listeners (the server closes its own). */
  close() {
    this.closeLan();
  }
  // ---- who is asking ---------------------------------------------------------------------------------------------
  cookie(request) {
    for (const part of (request.headers.cookie ?? "").split(";")) {
      const eq = part.indexOf("=");
      if (eq > 0 && part.slice(0, eq).trim() === this.options.cookieName) return part.slice(eq + 1).trim();
    }
    return void 0;
  }
  /**
   * Who a request is: the owner over loopback, a guest by their cookie (while their link is on and the artifact is
   * shared), else nobody. Loopback is always the owner, so trying a link on this computer can't lock the owner out of
   * their own artifact; a guest comes over a LAN address (this computer's own included: that is how the owner sees
   * what a role sees).
   */
  viewerOf(request) {
    if (isLoopback(request.socket.remoteAddress)) return { role: "owner", user: this.options.owner };
    const guest = this.lanServers.size ? this.sharing.guest(this.cookie(request)) : null;
    if (!guest) return null;
    this.sharing.seen(guest);
    return { role: guest.role, user: guestUser(guest), guest };
  }
  /** Keeps track of a stream or socket `viewer` holds open; call the returned function when it closes. */
  attach(viewer, close) {
    const live = { viewer, close };
    this.live.add(live);
    return () => this.live.delete(live);
  }
  /** `attach` for an HTTP stream (server-sent events): it ends when its person loses access. */
  hold(viewer, response) {
    const detach = this.attach(viewer, () => response.end());
    response.on("close", detach);
  }
  /** Still allowed in: the owner, or a guest whose link is on and who was not removed. */
  stillIn(viewer) {
    return !viewer.guest || this.shared && this.sharing.valid(viewer.guest);
  }
  /** Ends the streams of guests who lost access (a link turned off or reset, a guest removed). */
  dropRevoked() {
    for (const live of [...this.live]) if (live.viewer.guest && !this.sharing.valid(live.viewer.guest)) live.close("revoked");
  }
  me(viewer) {
    return { role: viewer.role, id: viewer.user.id, name: viewer.user.name, email: viewer.user.email };
  }
  // ---- routes ----------------------------------------------------------------------------------------------------
  /** Answers the share link and /__share paths; false for any other path. */
  async route(request, response) {
    const p = new URL(request.url ?? "/", "http://local").pathname;
    const method = request.method ?? "GET";
    const link = /^\/s\/([A-Za-z0-9_-]{16,64})$/.exec(p);
    const ours = link || p === "/__share" || p.startsWith("/__share/");
    if (!ours) return false;
    if (method === "POST" && !sameOrigin(request)) {
      request.resume();
      sendJson(response, 403, { code: "not_granted", message: "Cross-origin write refused." });
      return true;
    }
    if (link) {
      if (method === "GET" || method === "POST") await this.join(request, response, method, link[1]);
      else response.writeHead(405, { Allow: "GET, POST" }).end();
      return true;
    }
    const viewer = this.viewerOf(request);
    if (!viewer) {
      this.denied(request, response);
      return true;
    }
    if (method === "GET" && p === "/__share/me") return sendJson(response, 200, this.me(viewer)), true;
    if (method === "GET" && p === "/__share/boot.js") {
      const body = this.bootScript(viewer);
      response.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8", "Content-Length": Buffer.byteLength(body), "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }).end(body);
      return true;
    }
    if (method === "GET" && p === "/__share/invite") return sendJson(response, 200, this.invites(viewer, request.headers.host ?? "")), true;
    if (method === "GET" && p === "/__share/ui.js") {
      fs3.stat(this.options.uiFile, (error, stat) => {
        if (error || !stat.isFile()) return sendJson(response, 404, { code: "not_found", message: "The Share panel is missing." });
        sendFile(request, response, this.options.uiFile, { "Content-Type": "text/javascript; charset=utf-8", "Content-Length": stat.size, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
      });
      return true;
    }
    if (viewer.role !== "owner") return sendJson(response, 403, { code: "not_granted", message: "Only the owner can do this." }), true;
    if (p === "/__share") return await this.shareApi(request, response, method), true;
    sendJson(response, 404, { code: "not_found", message: "Not found" });
    return true;
  }
  /** The tags a page puts first in its <head>: the boot script and the Share panel (the owner's, or a guest's). */
  headTags(_viewer) {
    let tags = '<script src="/__share/boot.js"></script>';
    if (fs3.existsSync(this.options.uiFile)) tags += '<script type="module" src="/__share/ui.js"></script>';
    return tags;
  }
  /** `html` with the head tags first in its <head>; null when it has none. */
  injectHead(html, viewer) {
    const at = html.search(/<head(\s[^>]*)?>/i);
    if (at < 0) return null;
    const end = html.indexOf(">", at) + 1;
    return html.slice(0, end) + this.headTags(viewer) + html.slice(end);
  }
  /** What the page runs before anything else (see SECURE_CONTEXT_SHIM and GUEST_WATCH). */
  bootScript(viewer) {
    const share2 = { ...this.me(viewer), noun: this.options.noun, title: this.options.title(), ...this.options.reactions ? { reactions: true } : {} };
    let js = `${SECURE_CONTEXT_SHIM}window.__baoyuShare=${script(share2)};`;
    for (const [name, value] of Object.entries(this.options.globals?.(viewer) ?? {})) js += `window[${script(name)}]=${script(value)};`;
    if (viewer.guest) js += GUEST_WATCH;
    return js;
  }
  /** Nobody's request: a page for a browser's navigation, JSON for anything else. */
  denied(request, response) {
    request.resume();
    const navigation = (request.method === "GET" || request.method === "HEAD") && /\btext\/html\b/.test(request.headers.accept ?? "");
    if (!navigation) return sendJson(response, 403, { code: "not_granted", message: `This ${this.options.noun.en} is not shared with you.` });
    const t = this.words(request);
    this.sendPage(response, 403, t.noAccessTitle, `<h1>${esc(t.noAccessTitle)}</h1><p>${esc(t.noAccess)}</p>${this.ownerHint(request, t)}`);
  }
  /** A small page of our own (the join form, the refusal), in the reader's language. */
  sendPage(response, status, title, body, headers = {}) {
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${PAGE_CSS}</style></head><body><main>${body}</main></body></html>`;
    response.writeHead(status, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'",
      ...headers
    }).end(html);
  }
  /** On the computer that shares the artifact, over its LAN address: the way back to the owner's page. */
  ownerHint(request, t) {
    const from = (request.socket.remoteAddress ?? "").replace(/^::ffff:/, "");
    if (!this.lanServers.has(from)) return "";
    const url = `http://127.0.0.1:${this.port}/`;
    return `<p class="note">${esc(t.ownerHere)} <a href="${esc(url)}">${esc(url)}</a></p>`;
  }
  /** GET /s/<token>: the name form (or straight in, for a guest already in through this link); POST: join. */
  async join(request, response, method, token2) {
    const t = this.words(request);
    const role = this.sharing.linkRole(token2);
    const local = isLoopback(request.socket.remoteAddress);
    const form = method === "POST" ? await readBody(request, 8 << 10).then((body) => body.toString("utf8"), () => "") : "";
    const title = this.options.title();
    if (!role || !local && !this.lanServers.size) return this.sendPage(response, 404, t.linkGoneTitle, `<h1>${esc(t.linkGoneTitle)}</h1><p>${esc(t.linkGone)}</p>`);
    if (local) {
      const lan = [...this.lanServers.keys()][0];
      const there = lan ? `http://${lan}:${this.port}/s/${token2}` : "";
      const tryIt = there ? `<p>${esc(t.tryRole(t.roles[role]))} <a href="${esc(there)}">${esc(there)}</a></p>` : "";
      return this.sendPage(response, 200, title, `<h1>${esc(title)}</h1><p>${esc(t.youOwn)} <a href="/">${esc(t.openAsOwner)}</a></p>${tryIt}`);
    }
    const current = this.sharing.guest(this.cookie(request));
    if (method === "GET" && current && current.link === this.sharing.state.links[role].token) {
      response.writeHead(303, { Location: "/", "Cache-Control": "no-store" }).end();
      return;
    }
    if (method === "GET") {
      return this.sendPage(
        response,
        200,
        title,
        `<h1>${esc(title)}</h1><p>${esc(t.invited(t.roles[role]))}</p><form method="post"><label for="n">${esc(t.yourName)}</label><input id="n" name="name" maxlength="${MAX_NAME}" value="${esc(current?.name ?? "")}" required autofocus autocomplete="name"><button type="submit">${esc(t.open)}</button></form><p class="note">${esc(t.nameNote)}</p>`
      );
    }
    const name = new URLSearchParams(form).get("name") ?? "";
    const guest = this.sharing.join(role, name);
    this.options.log(`share: ${guest.name} joined as ${role} (${request.socket.remoteAddress})`);
    const cookie = `${this.options.cookieName}=${guest.secret}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`;
    response.writeHead(303, { Location: "/", "Set-Cookie": cookie, "Cache-Control": "no-store" }).end();
  }
  /**
   * The links this person may pass on: their own role's and the ones below it that are on (the owner: every one on), at
   * the address they came by (`host`, a Host header hostAllowed let in). A guest could forward the link they joined
   * with anyway; a lower one gives no more than that. Who joins through one shows in the owner's panel like anyone else.
   */
  invites(viewer, host) {
    const { links } = this.sharing.state;
    const from = viewer.role === "owner" ? 0 : GUEST_ROLES.indexOf(viewer.role);
    return { links: GUEST_ROLES.slice(from).filter((role) => links[role].on).map((role) => ({ role, url: `http://${host}/s/${links[role].token}` })) };
  }
  /** Links, addresses and people, for the share panel and `artifact.mjs share`. */
  shareView() {
    const addresses = [...this.lanServers.keys()];
    const base = addresses.length ? `http://${addresses[0]}:${this.port}` : `http://127.0.0.1:${this.port}`;
    const online = /* @__PURE__ */ new Set();
    for (const live of this.live) if (live.viewer.guest) online.add(live.viewer.guest.id);
    const { links, guests } = this.sharing.state;
    return {
      title: this.options.title(),
      lan: this.lanServers.size > 0,
      port: this.port,
      addresses,
      local: `http://127.0.0.1:${this.port}/`,
      links: Object.fromEntries(GUEST_ROLES.map((role) => [role, { on: links[role].on, url: `${base}/s/${links[role].token}` }])),
      guests: guests.filter((g) => this.sharing.valid(g) || links[g.role].token === g.link).map((g) => ({ id: g.id, name: g.name, role: g.role, joined: g.joined, ...g.seen ? { seen: g.seen } : {}, online: online.has(g.id), active: this.sharing.valid(g) }))
    };
  }
  /**
   * The owner's sharing calls: `lan` {on}, `link` {role, on}, `reset` {role} (a new link: the old one and the guests
   * who came through it stop working), `role` {guest, role} (a guest's role, while that role's link is on), `remove`
   * {guest}. Answers the view after.
   */
  async share(action) {
    const role = action.role;
    switch (action.action) {
      case "lan": {
        const addresses = await this.setLan(action.on === true);
        if (action.on === true && !addresses.length) throw new ShareError("This computer has no local network address to share on.");
        break;
      }
      case "link":
        if (!isGuestRole(role)) throw new ShareError("role: editor, commenter or viewer");
        this.sharing.setLink(role, action.on === true);
        break;
      case "reset":
        if (!isGuestRole(role)) throw new ShareError("role: editor, commenter or viewer");
        this.sharing.resetLink(role);
        break;
      case "role": {
        if (!isGuestRole(role)) throw new ShareError("role: editor, commenter or viewer");
        if (typeof action.guest !== "string" || !this.sharing.state.guests.some((g) => g.id === action.guest)) throw new ShareError("no such guest");
        if (!this.sharing.setRole(action.guest, role)) throw new ShareError(`The ${role} link is off: turn it on first.`);
        for (const live of [...this.live]) if (live.viewer.guest?.id === action.guest) live.close("revoked");
        break;
      }
      case "remove":
        if (typeof action.guest !== "string" || !this.sharing.removeGuest(action.guest)) throw new ShareError("no such guest");
        break;
      default:
        throw new ShareError("action: lan, link, reset, role or remove");
    }
    this.options.log(`share: ${JSON.stringify(action)}`);
    this.dropRevoked();
    return this.shareView();
  }
  async shareApi(request, response, method) {
    if (method === "GET") return sendJson(response, 200, this.shareView());
    if (method !== "POST") return sendJson(response, 405, { code: "method_not_allowed", message: `${method} is not allowed here.` });
    let action;
    try {
      action = JSON.parse((await readBody(request, 64 << 10)).toString("utf8"));
    } catch {
      return sendJson(response, 400, { code: "invalid_argument", message: "The call is not JSON." });
    }
    if (!isRecord2(action)) return sendJson(response, 400, { code: "invalid_argument", message: "Expected {action, ...}." });
    try {
      return sendJson(response, 200, await this.share(action));
    } catch (error) {
      if (error instanceof ShareError) return sendJson(response, 400, { code: "invalid_argument", message: error.message });
      throw error;
    }
  }
  words(request) {
    const zh = /^zh\b/i.test(request.headers["accept-language"] ?? "");
    return (zh ? ZH : EN)(this.options.noun);
  }
};
var SECURE_CONTEXT_SHIM = "if(window.crypto&&!crypto.randomUUID)crypto.randomUUID=function(){var b=crypto.getRandomValues(new Uint8Array(16)),h='',i;b[6]=b[6]&15|64;b[8]=b[8]&63|128;for(i=0;i<16;i++){h+=(b[i]+256).toString(16).slice(1);if(i==3||i==5||i==7||i==9)h+='-'}return h};";
var GUEST_WATCH = "setInterval(function(){fetch('/__share/me',{cache:'no-store'}).then(function(r){if(r.status===403)return location.reload();return r.json().then(function(m){if(m&&m.role&&m.role!==window.__baoyuShare.role)location.reload()})},function(){})},5000);";
var PAGE_CSS = `
:root { color-scheme: light dark; --bg: #f7f6f3; --card: #fff; --fg: #1f1e1d; --muted: #6b6a66; --line: #e3e1dc; --accent: #c96442; }
@media (prefers-color-scheme: dark) { :root { --bg: #1f1e1d; --card: #2a2927; --fg: #f2f1ee; --muted: #a8a6a0; --line: #3a3936; } }
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: var(--bg); color: var(--fg); font: 15px/1.5 system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; padding: 16px; }
main { width: min(420px, 100%); background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 28px; }
h1 { font-size: 20px; margin: 0 0 8px; word-break: break-word; }
p { margin: 0 0 16px; color: var(--muted); }
label { display: block; font-size: 13px; margin: 0 0 6px; color: var(--muted); }
input { width: 100%; font: inherit; padding: 9px 11px; border: 1px solid var(--line); border-radius: 8px; background: transparent; color: inherit; margin: 0 0 14px; }
button { width: 100%; font: inherit; font-weight: 600; padding: 10px; border: 0; border-radius: 8px; background: var(--accent); color: #fff; cursor: pointer; }
.note { font-size: 12px; margin: 14px 0 0; }
a { color: var(--accent); overflow-wrap: anywhere; }
`;
var EN = (noun) => ({
  noAccessTitle: "No access",
  noAccess: `This ${noun.en} is not shared with you. Ask its owner for a link.`,
  linkGoneTitle: "This link does not work",
  linkGone: `The link was turned off or replaced, or the ${noun.en} is no longer shared. Ask its owner for a new one.`,
  invited: (what) => `You were invited to ${what} this ${noun.en}.`,
  yourName: "Your name (others see it on your comments and edits)",
  open: `Open the ${noun.en}`,
  nameNote: "This browser keeps your place; the owner can remove it at any time.",
  roles: { editor: "edit", commenter: "comment on", viewer: "view" },
  youOwn: `This is your ${noun.en}: on this computer you are its owner.`,
  openAsOwner: "Open it",
  tryRole: (what) => `To see it as someone invited to ${what} it does, open the link at the network address, here or on another device:`,
  ownerHere: `You are on the computer that shares this ${noun.en}. Open it as the owner at`
});
var ZH = (noun) => ({
  noAccessTitle: "\u65E0\u6743\u8BBF\u95EE",
  noAccess: `${noun.zhThis}\u6CA1\u6709\u5206\u4EAB\u7ED9\u4F60\u3002\u8BF7\u5411\u6240\u6709\u8005\u8981\u4E00\u4E2A\u94FE\u63A5\u3002`,
  linkGoneTitle: "\u94FE\u63A5\u5DF2\u5931\u6548",
  linkGone: `\u8FD9\u4E2A\u94FE\u63A5\u5DF2\u88AB\u5173\u95ED\u6216\u91CD\u7F6E\uFF0C\u6216\u8005${noun.zhThis}\u5DF2\u505C\u6B62\u5206\u4EAB\u3002\u8BF7\u5411\u6240\u6709\u8005\u8981\u4E00\u4E2A\u65B0\u94FE\u63A5\u3002`,
  invited: (what) => `\u4F60\u88AB\u9080\u8BF7${what}${noun.zhThis}\u3002`,
  yourName: "\u4F60\u7684\u540D\u5B57\uFF08\u522B\u4EBA\u4F1A\u5728\u4F60\u7684\u8BC4\u8BBA\u548C\u7F16\u8F91\u4E0A\u770B\u5230\u5B83\uFF09",
  open: `\u6253\u5F00${noun.zh}`,
  nameNote: "\u8FD9\u4E2A\u6D4F\u89C8\u5668\u4F1A\u8BB0\u4F4F\u4F60\u7684\u8EAB\u4EFD\uFF1B\u6240\u6709\u8005\u53EF\u4EE5\u968F\u65F6\u79FB\u9664\u3002",
  roles: { editor: "\u7F16\u8F91", commenter: "\u8BC4\u8BBA", viewer: "\u67E5\u770B" },
  youOwn: `\u8FD9\u662F\u4F60\u7684${noun.zh}\uFF1A\u5728\u8FD9\u53F0\u7535\u8111\u4E0A\u4F60\u662F\u6240\u6709\u8005\u3002`,
  openAsOwner: `\u6253\u5F00${noun.zh}`,
  tryRole: (what) => `\u60F3\u770B\u770B\u53D7\u9080${what}\u7684\u4EBA\u770B\u5230\u4EC0\u4E48\uFF0C\u7528\u5C40\u57DF\u7F51\u5730\u5740\u6253\u5F00\u8FD9\u4E2A\u94FE\u63A5\uFF08\u5728\u8FD9\u53F0\u7535\u8111\u6216\u522B\u7684\u8BBE\u5907\u4E0A\u90FD\u884C\uFF09\uFF1A`,
  ownerHere: `\u4F60\u5728\u5206\u4EAB${noun.zhThis}\u7684\u7535\u8111\u4E0A\u3002\u4EE5\u6240\u6709\u8005\u8EAB\u4EFD\u6253\u5F00\uFF1A`
});

async function shareCall(url, action, fail2) {
  const response = await fetch(new URL("/__share", url), action ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action) } : {});
  const body = await response.json().catch(() => ({}));
  if (!response.ok) fail2("SHARE_REFUSED", String(body.message ?? `the server answered ${response.status}`));
  return body;
}
function rolesOf(flags, key, fail2) {
  const given = flags.get(key);
  if (given === void 0) return [];
  const roles = given === "all" || given === "true" ? [...GUEST_ROLES] : given.split(",").map((r) => r.trim());
  for (const role of roles) if (!isGuestRole(role)) fail2("INVALID_ROLE", `--${key}: editor, commenter, viewer or all (got ${role}).`);
  return roles;
}
function guestRoles(flags, fail2) {
  const given = flags.get("role");
  if (given === void 0) return [];
  return given.split(",").map((pair) => {
    const [guest = "", role = ""] = pair.split("=").map((part) => part.trim());
    if (!guest || !isGuestRole(role)) fail2("INVALID_ROLE", `--role: <guest id>=editor|commenter|viewer, comma separated (got ${pair}).`);
    return { action: "role", guest, role };
  });
}
async function shareCommand(o) {
  const off = o.flags.has("off");
  const changes = [
    ...rolesOf(o.flags, "reset", o.fail).map((role) => ({ action: "reset", role })),
    ...rolesOf(o.flags, "enable", o.fail).map((role) => ({ action: "link", role, on: true })),
    ...rolesOf(o.flags, "disable", o.fail).map((role) => ({ action: "link", role, on: false })),
    ...guestRoles(o.flags, o.fail)
  ];
  let server = await o.running();
  if (!server) {
    const sharing = new Sharing(o.root);
    for (const change of changes) {
      if (change.action === "reset") sharing.resetLink(change.role);
      else if (change.action === "role") {
        if (!sharing.setRole(String(change.guest), change.role)) o.fail("SHARE_REFUSED", `No guest ${String(change.guest)}, or the ${String(change.role)} link is off.`);
      } else sharing.setLink(change.role, change.on === true);
    }
    if (off) {
      sharing.setLan(false);
      return { lan: false, message: "Not shared on the local network. Guests already in get their place back when it is shared again (unless their link was reset)." };
    }
    server = await o.startShared();
    if (!server) o.fail("SERVER_FAILED", `The server did not start. Run ${o.serveCommand} in the foreground to see why.`);
  }
  let view = await shareCall(server.url, null, o.fail);
  for (const change of changes) view = await shareCall(server.url, change, o.fail);
  if (off || !view.lan) view = await shareCall(server.url, { action: "lan", on: !off }, o.fail);
  const links = view.links;
  return {
    lan: view.lan,
    ...view.lan ? { addresses: lanUrls(view) } : {},
    links: Object.fromEntries(Object.entries(links).map(([role, link]) => [role, link.on ? link.url : "off"])),
    guests: view.guests,
    ...view.lan ? {
      note: "Send the link for the role you want to give: editor edits, commenter comments, viewer reads. Anyone on this network with a link joins under a name they type. The owner (this computer) shares from the Share button too.",
      stop: o.offCommand
    } : { note: "Not shared on the network: the links work on this computer only." }
  };
}
var lanUrls = (view) => (Array.isArray(view.addresses) ? view.addresses : []).map((a) => `http://${String(a)}:${String(view.port)}/`);
async function lanOn(url, flags, fail2) {
  if (!flags.has("lan")) return {};
  return { lan: lanUrls(await shareCall(url, { action: "lan", on: true }, fail2)) };
}

var COMMENTS_FILE = "comments.json";
var COMMENTS_VERSION = 1;
var LIMITS = { text: 1e4, label: 1e3, detail: 4e3, anchor: 2048, section: 200, name: 100 };
function sameAuthor(a, b) {
  return a.kind === "user" && b.kind === "user" && (a.principal ?? "") === (b.principal ?? "");
}
var AGENT_AUTHOR = { kind: "agent", name: "agent" };
var CommentsError = class extends Error {
  code;
  status;
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
};
var emptyDoc = () => ({ version: COMMENTS_VERSION, threads: [] });
function randomHex(bytes) {
  const buf = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}
var newId = (prefix) => `${prefix}_${randomHex(5)}`;
var isRecord3 = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var isText = (v, max) => typeof v === "string" && v.length <= max;
function cleanText(v) {
  if (typeof v !== "string") return null;
  const text = v.replace(/\r\n?/g, "\n").trim();
  return text !== "" && text.length <= LIMITS.text ? text : null;
}
function readNewThread(body) {
  if (!isRecord3(body)) return null;
  const text = cleanText(body.text);
  if (text === null || !isText(body.anchor, LIMITS.anchor) || body.anchor === "" || !isText(body.label, LIMITS.label)) return null;
  if (body.detail !== void 0 && !isText(body.detail, LIMITS.detail)) return null;
  if (body.section !== void 0 && (!isText(body.section, LIMITS.section) || body.section === "")) return null;
  if (body.area !== void 0 && typeof body.area !== "boolean") return null;
  if (body.send !== void 0 && typeof body.send !== "boolean") return null;
  return {
    anchor: body.anchor,
    label: body.label.trim() || "Comment",
    ...body.detail ? { detail: body.detail } : {},
    ...body.area ? { area: true } : {},
    ...body.section ? { section: body.section } : {},
    text,
    ...body.send ? { send: true } : {}
  };
}
function readReply(body) {
  if (!isRecord3(body)) return null;
  const text = cleanText(body.text);
  if (text === null) return null;
  if (body.send !== void 0 && typeof body.send !== "boolean") return null;
  return { text, ...body.send ? { send: true } : {} };
}
var readEdit = readReply;
function readStatus(body) {
  return isRecord3(body) && (body.status === "open" || body.status === "resolved") ? body.status : null;
}
function readAgentRequest(body) {
  if (!isRecord3(body)) return null;
  const text = cleanText(body.text);
  if (text === null) return null;
  if (body.label !== void 0 && !isText(body.label, LIMITS.label)) return null;
  if (body.selection !== void 0 && !isText(body.selection, LIMITS.detail)) return null;
  const label = typeof body.label === "string" ? body.label.trim() : "";
  const selection = typeof body.selection === "string" ? body.selection.trim() : "";
  return { text, ...label ? { label } : {}, ...selection ? { selection } : {} };
}
function parseDoc(text) {
  const data = JSON.parse(text);
  if (!isRecord3(data) || data.version !== COMMENTS_VERSION || !Array.isArray(data.threads)) {
    throw new CommentsError("COMMENTS_FILE_INVALID", `not a version ${COMMENTS_VERSION} comments file (expected {"version": 1, "threads": [...]})`, 500);
  }
  const threads = data.threads.filter(
    (t) => isRecord3(t) && typeof t.id === "string" && typeof t.anchor === "string" && typeof t.label === "string" && (t.status === "open" || t.status === "resolved") && Array.isArray(t.messages) && t.messages.every((m) => isRecord3(m) && typeof m.text === "string" && isRecord3(m.author) && (m.author.kind === "user" || m.author.kind === "agent"))
  );
  for (const t of threads) {
    if (!isRecord3(t.location)) t.location = {};
    for (const m of t.messages) if (m.author.principal !== void 0 && typeof m.author.principal !== "string") delete m.author.principal;
  }
  return { version: COMMENTS_VERSION, threads };
}
var formatDoc = (doc) => `${JSON.stringify(doc, null, 2)}
`;
function addThread(doc, input, location, author, now) {
  const thread = {
    id: uniqueId(doc),
    anchor: input.anchor,
    label: input.label,
    ...input.detail ? { detail: input.detail } : {},
    location: { ...location, ...input.section ? { section: input.section } : {}, ...input.area ? { area: true } : {} },
    status: "open",
    createdAt: now,
    updatedAt: now,
    messages: [{ id: newId("m"), author, text: input.text, at: now }]
  };
  if (input.send) sendToAgent(thread, now);
  doc.threads.push(thread);
  return thread;
}
function uniqueId(doc) {
  for (; ; ) {
    const id = newId("c");
    if (!doc.threads.some((t) => t.id === id)) return id;
  }
}
function addMessage(thread, author, text, now) {
  const message = { id: newId("m"), author, text, at: now };
  thread.messages.push(message);
  thread.updatedAt = now;
  if (author.kind === "agent") {
    if (thread.agent) thread.agent = { ...thread.agent, status: "replied", repliedAt: now };
  } else if (thread.status === "resolved") {
    thread.status = "open";
    delete thread.resolvedAt;
  }
  return message;
}
function editMessage(thread, messageId, text, now, by) {
  const message = thread.messages.find((m) => m.id === messageId);
  if (!message) throw new CommentsError("MESSAGE_NOT_FOUND", `No message ${messageId} in ${thread.id}.`, 404);
  if (message.author.kind !== "user" || by && !sameAuthor(message.author, by)) throw new CommentsError("MESSAGE_NOT_EDITABLE", "Only your own messages can be edited.", 403);
  if (message.text !== text) {
    message.text = text;
    message.editedAt = now;
    thread.updatedAt = now;
  }
  return message;
}
function canSendToAgent(thread) {
  const last = thread.messages.at(-1);
  if (thread.status !== "open" || !last || last.author.kind !== "user") return false;
  return !thread.agent || (last.editedAt ?? last.at) > thread.agent.sentAt;
}
function sendToAgent(thread, now) {
  thread.agent = { status: "pending", sentAt: now };
  thread.updatedAt = now;
}
function markDelivered(thread, now, via) {
  if (thread.agent?.status !== "pending") return;
  thread.agent = { ...thread.agent, status: "delivered", deliveredAt: now, via };
}
function setStatus(thread, status, now) {
  if (thread.status === status) return;
  thread.status = status;
  thread.updatedAt = now;
  if (status === "resolved") thread.resolvedAt = now;
  else delete thread.resolvedAt;
}
function findThread(doc, ref) {
  const exact = doc.threads.find((t) => t.id === ref);
  if (exact) return exact;
  const matches = ref.length >= 3 ? doc.threads.filter((t) => t.id.startsWith(ref)) : [];
  if (matches.length === 1) return matches[0];
  throw new CommentsError(
    matches.length ? "AMBIGUOUS_COMMENT" : "COMMENT_NOT_FOUND",
    matches.length ? `${ref} matches ${matches.length} comments; give more of the id.` : `No comment ${ref}.`,
    404
  );
}
function openThreads(doc) {
  return doc.threads.filter((t) => t.status === "open").sort((a, b) => a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0);
}
var pendingForAgent = (doc) => openThreads(doc).filter((t) => t.agent?.status === "pending");
function agentView(thread, n) {
  return {
    id: thread.id,
    ...n !== void 0 ? { n } : {},
    status: thread.status,
    ...thread.location.file ? { file: thread.location.file } : {},
    where: thread.label,
    ...thread.detail ? { detail: thread.detail } : {},
    location: thread.location,
    anchor: thread.anchor,
    ...thread.agent ? { agent: thread.agent } : {},
    messages: thread.messages.map((m) => ({ from: m.author.kind, name: m.author.name, text: m.text, at: m.at, ...m.editedAt ? { editedAt: m.editedAt } : {} }))
  };
}
function agentViews(doc, threads) {
  const open2 = openThreads(doc);
  return threads.map((t) => {
    const i = open2.indexOf(t);
    return agentView(t, i >= 0 ? i + 1 : void 0);
  });
}

import { spawn } from "node:child_process";
import fs5 from "node:fs";
import os3 from "node:os";

import fs4 from "node:fs";
import fsp from "node:fs/promises";
import path4 from "node:path";
var LOCK_STALE_MS = 1e4;
var LOCK_WAIT_MS = 5e3;
var LOCK_RETRY_MS = 20;
var commentsPath = (root) => path4.join(root, COMMENTS_FILE);
async function readComments(root) {
  let text;
  try {
    text = await fsp.readFile(commentsPath(root), "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return emptyDoc();
    throw error;
  }
  if (text.trim() === "") return emptyDoc();
  try {
    return parseDoc(text);
  } catch (error) {
    if (error instanceof CommentsError) throw new CommentsError(error.code, `${commentsPath(root)}: ${error.message}`, 500);
    throw new CommentsError("COMMENTS_FILE_INVALID", `${commentsPath(root)} is not valid JSON: ${error.message}`, 500);
  }
}
async function lock(root) {
  const file = `${commentsPath(root)}.lock`;
  const deadline = Date.now() + LOCK_WAIT_MS;
  for (; ; ) {
    try {
      const handle = await fsp.open(file, "wx");
      await handle.writeFile(`${process.pid}
`);
      await handle.close();
      return () => fsp.rm(file, { force: true });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
    const info = await fsp.stat(file).catch(() => null);
    if (info && Date.now() - info.mtimeMs > LOCK_STALE_MS) {
      await fsp.rm(file, { force: true });
      continue;
    }
    if (Date.now() > deadline) throw new CommentsError("COMMENTS_LOCKED", `${file} is held by another process; try again (or delete it if nothing is running).`, 503);
    await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_MS));
  }
}
async function writeAtomic(file, text) {
  const temp = path4.join(path4.dirname(file), `.${path4.basename(file)}.${process.pid}.${Date.now().toString(36)}.tmp`);
  await fsp.writeFile(temp, text);
  try {
    await fsp.rename(temp, file);
  } catch (error) {
    await fsp.rm(temp, { force: true });
    throw error;
  }
}
async function updateComments(root, change) {
  const unlock = await lock(root);
  try {
    const doc = await readComments(root);
    const before = formatDoc(doc);
    const result = await change(doc);
    const after = formatDoc(doc);
    const exists = fs4.existsSync(commentsPath(root));
    if (after !== before && (exists || doc.threads.length > 0)) await writeAtomic(commentsPath(root), after);
    return result;
  } finally {
    await unlock();
  }
}

var AGENT_GRACE_MS = 6e4;
var AGENT_BUSY_MS = 30 * 6e4;
var REQUEST_TTL_MS = 30 * 6e4;
var WAIT_DEFAULT_S = 300;
var WAIT_MAX_S = 3600;
var PRESENCE_CHECK_MS = 5e3;
var SSE_KEEPALIVE_MS = 25e3;
var WATCH_DEBOUNCE_MS = 100;
var POLL_MS = 2e3;
var MAX_BODY_BYTES = 256 * 1024;
var TooLarge2 = class extends Error {
};
function sendJson2(response, status, body) {
  const text = JSON.stringify(body);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(text),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(text);
}
function readJson(request) {
  return new Promise((resolve, reject) => {
    if (!/^application\/json\b/i.test(request.headers["content-type"] ?? "")) {
      request.resume();
      reject(new CommentsError("INVALID_CONTENT", "expected application/json", 415));
      return;
    }
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new TooLarge2());
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "null"));
      } catch {
        reject(new CommentsError("INVALID_CONTENT", "malformed JSON", 400));
      }
    });
    request.on("error", reject);
  });
}
function defaultUserName() {
  try {
    return os3.userInfo().username.trim() || "you";
  } catch {
    return "you";
  }
}
function createCommentsService(options) {
  const { root, log, agentHook } = options;
  const userName = (options.userName ?? defaultUserName()).slice(0, 100);
  const owner = { author: { kind: "user", name: userName }, canComment: true, canSend: true, admin: true };
  const viewerOf = options.viewer ?? (() => owner);
  const allowWrite = options.allowWrite ?? (() => true);
  const clients = /* @__PURE__ */ new Map();
  const waiters = [];
  const hookRunning = /* @__PURE__ */ new Set();
  const requests = [];
  let lastDoc = emptyDoc();
  let lastWaitEnded = 0;
  let lastSent = "";
  let lastPresence = "";
  let queue = Promise.resolve();
  let closed = false;
  const now = () => (/* @__PURE__ */ new Date()).toISOString();
  function presence() {
    const at = Date.now();
    const listening = waiters.length > 0;
    const busy = lastDoc.threads.some(
      (t) => t.status === "open" && t.agent?.status === "delivered" && at - Date.parse(t.agent.deliveredAt ?? t.agent.sentAt) < AGENT_BUSY_MS
    );
    const hook = Boolean(agentHook);
    return { available: listening || busy || hook || at - lastWaitEnded < AGENT_GRACE_MS, listening, busy, hook };
  }
  const meOf = (viewer) => ({
    name: viewer.author.name,
    ...viewer.author.principal ? { principal: viewer.author.principal } : {},
    canComment: viewer.canComment,
    canSend: viewer.canSend,
    admin: viewer.admin
  });
  async function shared() {
    lastDoc = await readComments(root);
    return { threads: lastDoc.threads, agent: presence() };
  }
  async function snapshot(viewer) {
    return { ...await shared(), me: meOf(viewer) };
  }
  const frame = (snap) => `event: comments
data: ${JSON.stringify(snap)}

`;
  function broadcast() {
    queue = queue.then(async () => {
      if (closed) return;
      let base;
      try {
        base = await shared();
      } catch (error) {
        log(`comments: reading ${COMMENTS_FILE} failed: ${error.message}`);
        return;
      }
      const text = JSON.stringify(base);
      lastPresence = JSON.stringify(base.agent);
      if (text === lastSent) return;
      lastSent = text;
      for (const [client, viewer] of clients) client.write(frame({ ...base, me: meOf(viewer) }));
    });
    return queue;
  }
  function finishWaiter(waiter, body) {
    if (waiter.done) return;
    waiter.done = true;
    clearTimeout(waiter.timer);
    const i = waiters.indexOf(waiter);
    if (i >= 0) waiters.splice(i, 1);
    if (!waiter.response.writableEnded) sendJson2(waiter.response, 200, body);
    lastWaitEnded = Date.now();
  }
  function dropStaleRequests() {
    const oldest = Date.now() - REQUEST_TTL_MS;
    while (requests.length > 0 && Date.parse(requests[0].sentAt) < oldest) {
      const dropped = requests.shift();
      log(`comments: dropped request ${dropped.id}: no agent took it in ${REQUEST_TTL_MS / 6e4} minutes`);
    }
  }
  async function deliver() {
    if (closed) return;
    dropStaleRequests();
    const waiter = waiters[0];
    if (waiter) {
      const views = await updateComments(root, (doc) => {
        const pending = pendingForAgent(doc);
        const at = now();
        for (const t of pending) markDelivered(t, at, "wait");
        return agentViews(doc, pending);
      });
      const handed = requests.splice(0);
      if (views.length === 0 && handed.length === 0) return;
      if (waiter.done) {
        requests.unshift(...handed);
        if (views.length > 0) {
          await updateComments(root, (doc) => {
            for (const t of doc.threads) if (views.some((v) => v.id === t.id) && t.agent?.via === "wait") t.agent = { status: "pending", sentAt: t.agent.sentAt };
          });
        }
        return;
      }
      finishWaiter(waiter, { threads: views, ...handed.length > 0 ? { requests: handed } : {} });
      log(`comments: sent to the agent (wait): ${[...views, ...handed].map((v) => v.id).join(", ")}`);
      await broadcast();
      return;
    }
    if (agentHook) await runHook(agentHook);
  }
  async function runHook(command) {
    const doc = await readComments(root);
    for (const thread of pendingForAgent(doc)) {
      if (hookRunning.has(thread.id)) continue;
      hookRunning.add(thread.id);
      const view = agentViews(doc, [thread])[0];
      const child = spawn(command, {
        shell: true,
        cwd: root,
        stdio: ["pipe", "ignore", "pipe"],
        env: { ...process.env, ARTIFACT_ROOT: root, COMMENT_ID: thread.id, COMMENTS_FILE: commentsPath(root) }
      });
      let stderr = "";
      child.stderr?.on("data", (chunk) => {
        stderr = (stderr + chunk.toString("utf8")).slice(-2e3);
      });
      child.stdin?.on("error", () => {
      });
      child.stdin?.end(`${JSON.stringify(view)}
`);
      child.on("error", (error) => {
        hookRunning.delete(thread.id);
        log(`comments: the agent hook failed to start: ${error.message}`);
      });
      child.on("exit", (code) => {
        hookRunning.delete(thread.id);
        if (code !== 0) {
          log(`comments: the agent hook exited with ${code} for ${thread.id}; the comment stays waiting${stderr ? `: ${stderr.trim()}` : ""}`);
          return;
        }
        void updateComments(root, (d) => {
          const t = d.threads.find((x) => x.id === thread.id);
          if (t) markDelivered(t, now(), "hook");
        }).then(() => {
          log(`comments: sent to the agent (hook): ${thread.id}`);
          return broadcast();
        }).catch((error) => log(`comments: ${error.message}`));
      });
    }
    for (const request of requests.splice(0)) {
      hookRunning.add(request.id);
      const child = spawn(command, {
        shell: true,
        cwd: root,
        stdio: ["pipe", "ignore", "pipe"],
        env: { ...process.env, ARTIFACT_ROOT: root, REQUEST_ID: request.id, COMMENTS_FILE: commentsPath(root) }
      });
      let stderr = "";
      child.stderr?.on("data", (chunk) => {
        stderr = (stderr + chunk.toString("utf8")).slice(-2e3);
      });
      child.stdin?.on("error", () => {
      });
      child.stdin?.end(`${JSON.stringify({ request })}
`);
      let settled = false;
      const failed = (why) => {
        if (settled) return;
        settled = true;
        hookRunning.delete(request.id);
        requests.unshift(request);
        log(`comments: the agent hook ${why} for ${request.id}; the request stays waiting${stderr ? `: ${stderr.trim()}` : ""}`);
      };
      child.on("error", (error) => failed(`failed to start (${error.message})`));
      child.on("exit", (code) => {
        if (code !== 0) return failed(`exited with ${code}`);
        settled = true;
        hookRunning.delete(request.id);
        log(`comments: sent to the agent (hook): ${request.id}`);
      });
    }
  }
  let debounce;
  const changed = () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => void broadcast(), WATCH_DEBOUNCE_MS);
  };
  let watcher = null;
  try {
    watcher = fs5.watch(root, (_event, name) => {
      if (name === null || name === COMMENTS_FILE) changed();
    });
    watcher.on("error", () => {
      watcher?.close();
      watcher = null;
    });
  } catch {
    watcher = null;
  }
  let lastStat = "";
  const poll = setInterval(() => {
    fs5.stat(commentsPath(root), (error, info) => {
      const stat = error ? "none" : `${info.mtimeMs}:${info.size}`;
      if (stat !== lastStat) {
        const first = lastStat === "";
        lastStat = stat;
        if (!first) changed();
      }
    });
    if (JSON.stringify(presence()) !== lastPresence && clients.size > 0) void broadcast();
  }, Math.min(POLL_MS, PRESENCE_CHECK_MS));
  poll.unref?.();
  void broadcast();
  async function afterChange(sent) {
    await broadcast();
    if (sent) await deliver();
  }
  function need(allowed, message) {
    if (!allowed) throw new CommentsError("NOT_ALLOWED", message, 403);
  }
  const ONLY_OWNER_SENDS = "Only the owner can send comments to the agent.";
  async function create(request, response, viewer) {
    const input = readNewThread(await readJson(request));
    if (!input) throw new CommentsError("INVALID_COMMENT", "expected {anchor, label, text} with a non-empty text");
    need(!input.send || viewer.canSend, ONLY_OWNER_SENDS);
    let location = {};
    try {
      location = await options.locate?.(input) ?? {};
    } catch (error) {
      log(`comments: could not resolve where a comment points: ${error.message}`);
    }
    const created = await updateComments(root, (doc) => addThread(doc, input, location, viewer.author, now()));
    log(`comments: ${created.id} added on ${created.label}${location.file ? ` (${location.file})` : ""}${input.send ? ", sent to the agent" : ""}`);
    sendJson2(response, 201, { thread: created });
    await afterChange(Boolean(input.send));
  }
  async function ask(request, response) {
    const input = readAgentRequest(await readJson(request));
    if (!input) throw new CommentsError("INVALID_REQUEST", "expected {text} with a non-empty text");
    if (!presence().available) throw new CommentsError("AGENT_UNAVAILABLE", "no agent is waiting: copy the request for the chat instead", 409);
    const queued = { id: newId("r"), ...input, sentAt: now() };
    requests.push(queued);
    log(`comments: request ${queued.id}${input.label ? ` (${input.label})` : ""} for the agent`);
    sendJson2(response, 202, { request: queued });
    await deliver();
  }
  async function events(request, response, viewer) {
    response.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });
    response.write(": connected\n\n");
    response.write(frame(await snapshot(viewer)));
    clients.set(response, viewer);
    const keepAlive = setInterval(() => response.write(": ping\n\n"), SSE_KEEPALIVE_MS);
    keepAlive.unref?.();
    response.on("close", () => {
      clearInterval(keepAlive);
      clients.delete(response);
    });
  }
  async function wait(request, response, url) {
    const asked = Number(url.searchParams.get("timeout") ?? WAIT_DEFAULT_S);
    const seconds = Number.isFinite(asked) && asked > 0 ? Math.min(asked, WAIT_MAX_S) : WAIT_DEFAULT_S;
    const waiter = { response, done: false };
    waiters.push(waiter);
    waiter.timer = setTimeout(() => {
      finishWaiter(waiter, { threads: [] });
      void broadcast();
    }, seconds * 1e3);
    const gone = () => {
      if (waiter.done) return;
      finishWaiter(waiter, { threads: [] });
      void broadcast();
    };
    response.on("close", gone);
    await broadcast();
    await deliver();
  }
  async function handle(request, response, rest) {
    const method = request.method ?? "GET";
    const url = new URL(request.url ?? "/", "http://localhost");
    const parts = rest.split("/").filter(Boolean);
    const reading = method === "GET" || method === "HEAD";
    try {
      if (!reading && !allowWrite(request)) {
        request.resume();
        throw new CommentsError("NOT_ALLOWED", "cross-origin request", 403);
      }
      const viewer = viewerOf(request);
      if (!viewer) {
        request.resume();
        throw new CommentsError("NOT_ALLOWED", "not shared with you", 403);
      }
      const commenting = !reading && parts[0] !== "agent" && parts[1] !== "send";
      if (commenting && !viewer.canComment) {
        request.resume();
        throw new CommentsError("NOT_ALLOWED", "You can read the comments here, not add or change them.", 403);
      }
      if (parts.length === 0) {
        if (reading) return sendJson2(response, 200, await snapshot(viewer));
        if (method === "POST") return await create(request, response, viewer);
      } else if (parts.length === 1 && parts[0] === "events") {
        if (reading) return await events(request, response, viewer);
      } else if (parts.length === 2 && parts[0] === "agent" && parts[1] === "wait") {
        need(viewer.canSend, "Only the owner's agent waits for comments.");
        if (reading) return await wait(request, response, url);
      } else if (parts.length === 2 && parts[0] === "agent" && parts[1] === "requests") {
        need(viewer.canSend, ONLY_OWNER_SENDS);
        if (method === "POST") return await ask(request, response);
      } else if (parts.length === 1) {
        const id = parts[0];
        if (method === "PATCH") {
          const status = readStatus(await readJson(request));
          if (!status) throw new CommentsError("INVALID_STATUS", 'expected {status: "open" | "resolved"}');
          const t = await updateComments(root, (doc) => {
            const found = findThread(doc, id);
            setStatus(found, status, now());
            return found;
          });
          log(`comments: ${id} ${status === "resolved" ? "resolved" : "reopened"}`);
          sendJson2(response, 200, { thread: t });
          return await afterChange(false);
        }
        if (method === "DELETE") {
          await updateComments(root, (doc) => {
            const found = findThread(doc, id);
            const first = found.messages[0];
            need(viewer.admin || first !== void 0 && sameAuthor(first.author, viewer.author), "Only the person who started this comment, or the owner, can delete it.");
            doc.threads.splice(doc.threads.indexOf(found), 1);
          });
          log(`comments: ${id} deleted`);
          sendJson2(response, 200, { deleted: id });
          return await afterChange(false);
        }
      } else if (parts.length === 2 && parts[1] === "messages") {
        if (method === "POST") {
          const id = parts[0];
          const input = readReply(await readJson(request));
          if (!input) throw new CommentsError("INVALID_COMMENT", "expected {text} with a non-empty text");
          need(!input.send || viewer.canSend, ONLY_OWNER_SENDS);
          const t = await updateComments(root, (doc) => {
            const found = findThread(doc, id);
            addMessage(found, viewer.author, input.text, now());
            if (input.send) sendToAgent(found, now());
            return found;
          });
          log(`comments: reply on ${id}${input.send ? ", sent to the agent" : ""}`);
          sendJson2(response, 200, { thread: t });
          return await afterChange(Boolean(input.send));
        }
      } else if (parts.length === 3 && parts[1] === "messages") {
        if (method === "PATCH") {
          const id = parts[0];
          const messageId = parts[2];
          const input = readEdit(await readJson(request));
          if (!input) throw new CommentsError("INVALID_COMMENT", "expected {text} with a non-empty text");
          need(!input.send || viewer.canSend, ONLY_OWNER_SENDS);
          const t = await updateComments(root, (doc) => {
            const found = findThread(doc, id);
            editMessage(found, messageId, input.text, now(), viewer.author);
            if (input.send && canSendToAgent(found)) sendToAgent(found, now());
            return found;
          });
          log(`comments: message edited on ${id}${input.send ? ", sent to the agent" : ""}`);
          sendJson2(response, 200, { thread: t });
          return await afterChange(Boolean(input.send));
        }
      } else if (parts.length === 2 && parts[1] === "send") {
        if (method === "POST") {
          const id = parts[0];
          request.resume();
          need(viewer.canSend, ONLY_OWNER_SENDS);
          const t = await updateComments(root, (doc) => {
            const found = findThread(doc, id);
            if (!canSendToAgent(found)) throw new CommentsError("NOTHING_TO_SEND", "the agent already has everything in this comment", 409);
            sendToAgent(found, now());
            return found;
          });
          log(`comments: ${id} sent to the agent`);
          sendJson2(response, 200, { thread: t });
          return await afterChange(true);
        }
      } else {
        return sendJson2(response, 404, { code: "NOT_FOUND", message: "no such comments route" });
      }
      request.resume();
      sendJson2(response, 405, { code: "METHOD_NOT_ALLOWED", message: `${method} is not allowed here` });
    } catch (error) {
      if (response.headersSent) throw error;
      if (error instanceof CommentsError) return sendJson2(response, error.status, { code: error.code, message: error.message });
      if (error instanceof TooLarge2) return sendJson2(response, 413, { code: "TOO_LARGE", message: "request body is too large" });
      throw error;
    }
  }
  function close() {
    closed = true;
    clearInterval(poll);
    clearTimeout(debounce);
    watcher?.close();
    for (const waiter of [...waiters]) finishWaiter(waiter, { threads: [], closed: true });
    for (const client of clients.keys()) client.end();
    clients.clear();
  }
  return { handle, presence, deliver, close };
}

var SCRIPT = fileURLToPath(import.meta.url);
var SKILL_DIR = path5.dirname(path5.dirname(SCRIPT));
var EDITOR_DIR = path5.join(path5.dirname(SCRIPT), "editor");
var LOCAL_USER_ID = "local";
var MAX_DOC_BYTES = 256 * 1024;
var MAX_FILE_CHARS = 262144;
var MAX_DATA_BYTES = 8 * 1024 * 1024;
var MAX_BATCH_WRITES = 50;
var MAX_BATCH_BYTES = 1024 * 1024;
var SEGMENT = /^(?!\.\.?$)[A-Za-z0-9_\-.~:@+]{1,200}$/;
var DATASET_ID = /^[A-Za-z0-9_-]{1,64}$/;
var FILE_NAME = /^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,63}$/;
var PARAM_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
var RESERVED = /* @__PURE__ */ new Set(["__proto__", "constructor", "prototype"]);
var BLOB_URL = /^\/?_blob\/([0-9a-f]{32})$/;
var BLOB_ID = /^[0-9a-f]{32}$/;
var CONTENT_TYPES = {
  csv: "text/csv; charset=utf-8",
  tsv: "text/tab-separated-values; charset=utf-8",
  tab: "text/tab-separated-values; charset=utf-8",
  json: "application/json; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  woff2: "font/woff2",
  pdf: "application/pdf"
};
var CliError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
};
var isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var bytesOf = (value) => Buffer.byteLength(JSON.stringify(value), "utf8");
var kb = (n) => n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`;
var extOf = (name) => path5.extname(name).slice(1).toLowerCase();
var contentTypeOf = (name) => CONTENT_TYPES[extOf(name)] ?? "application/octet-stream";
var quote = (s) => /^[A-Za-z0-9_./:@%+=-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`;
var cmd = (name, ...args) => ["node", quote(SCRIPT), name, ...args.map(quote)].join(" ");
function print(value, compact = false) {
  process.stdout.write(`${compact ? JSON.stringify(value) : JSON.stringify(value, null, 2)}
`);
}
var SWITCHES = /* @__PURE__ */ new Set(["text", "json", "wait", "all", "resolve", "reopen", "lan", "off"]);
function parseArgs(argv) {
  const positional = [];
  const flags = /* @__PURE__ */ new Map();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      if (eq > 0) flags.set(arg.slice(2, eq), arg.slice(eq + 1));
      else if (i + 1 < argv.length && !argv[i + 1].startsWith("--") && !SWITCHES.has(arg.slice(2))) flags.set(arg.slice(2), argv[++i]);
      else flags.set(arg.slice(2), "true");
    } else positional.push(arg);
  }
  return { positional, flags };
}
function writeFileAtomic(file, data) {
  fs6.mkdirSync(path5.dirname(file), { recursive: true });
  const tmp = path5.join(path5.dirname(file), `.tmp-${process.pid}-${Date.now()}-${path5.basename(file)}`);
  fs6.writeFileSync(tmp, data);
  fs6.renameSync(tmp, file);
}
function resolveRoot(given, { create = false } = {}) {
  if (!given) throw new CliError("MISSING_ROOT", "Give the dashboard folder (for example designs/<slug>).");
  const root = path5.resolve(given);
  const stat = fs6.statSync(root, { throwIfNoEntry: false });
  if (stat && !stat.isDirectory()) throw new CliError("NOT_A_FOLDER", `${given} is a file; the dashboard is a folder.`);
  if (!stat) {
    if (!create) throw new CliError("NOT_FOUND", `${root} does not exist. Write the dashboard first: ${cmd("write-db", given, "batch.json")}.`);
    fs6.mkdirSync(root, { recursive: true });
  }
  return root;
}
function splitPath(p, what) {
  const clean = String(p ?? "").replace(/^\/+|\/+$/g, "");
  const segs = clean === "" ? [] : clean.split("/");
  if (segs.length === 0 || segs.length > 16 || !segs.every((s) => SEGMENT.test(s))) {
    throw new CliError("INVALID_PATH", `${JSON.stringify(p)} is not a ${what} path: "/"-separated segments of letters, digits and _ - . ~ : @ +.`);
  }
  if (segs[0] === "data" && segs[1] === "users" && segs[2] === "me") segs[2] = LOCAL_USER_ID;
  return segs;
}
function docSegments(p) {
  const segs = splitPath(p, "document");
  if (segs.length % 2 !== 0) throw new CliError("INVALID_PATH", `${p} names a collection; a document path is collection/doc_id (for example datasets/sales).`);
  return segs;
}
var docFile = (root, segs) => path5.join(root, "db", ...segs.slice(0, -1), `${segs.at(-1)}.json`);
function listDocFiles(root) {
  const out = /* @__PURE__ */ new Map();
  const base = path5.join(root, "db");
  const walk = (dir, rel) => {
    let entries;
    try {
      entries = fs6.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith(".")) continue;
      const full = path5.join(dir, e.name);
      if (e.isDirectory()) walk(full, [...rel, e.name]);
      else if (e.isFile() && e.name.endsWith(".json")) {
        const segs = [...rel, e.name.slice(0, -5)];
        if (segs.length % 2 !== 0 || !segs.every((s) => SEGMENT.test(s))) continue;
        out.set(segs.join("/"), { file: full });
      }
    }
  };
  walk(base, []);
  return out;
}
function readDoc(root, p) {
  const segs = docSegments(p);
  const file = docFile(root, segs);
  let text;
  try {
    text = fs6.readFileSync(file, "utf8");
  } catch {
    return { path: segs.join("/"), exists: false, file };
  }
  try {
    const data = JSON.parse(text);
    if (!isObject(data)) throw new Error("not an object");
    return { path: segs.join("/"), exists: true, data, file, bytes: Buffer.byteLength(text) };
  } catch (error) {
    throw new CliError("DAMAGED_DOCUMENT", `${file} is not a JSON object (${error.message}). Rewrite it with set.`);
  }
}
function readAllDocs(root) {
  const docs = /* @__PURE__ */ new Map();
  const damaged = [];
  for (const [p, { file }] of listDocFiles(root)) {
    try {
      const data = JSON.parse(fs6.readFileSync(file, "utf8"));
      if (isObject(data)) docs.set(p, data);
      else damaged.push(p);
    } catch {
      damaged.push(p);
    }
  }
  return { docs, damaged };
}
var isDeleteMarker = (v) => v === null || isObject(v) && v.__delete__ === true && Object.keys(v).length === 1;
function mergePatch(target, patch) {
  const out = isObject(target) ? { ...target } : {};
  for (const [k, v] of Object.entries(patch)) {
    if (k === "__proto__") continue;
    if (isDeleteMarker(v)) delete out[k];
    else if (isObject(v)) out[k] = mergePatch(out[k], v);
    else out[k] = v;
  }
  return out;
}
function hasDeleteMarker(v) {
  if (Array.isArray(v)) return v.some(hasDeleteMarker);
  if (!isObject(v)) return false;
  if (v.__delete__ === true) return true;
  return Object.values(v).some(hasDeleteMarker);
}
function documentProblem(segs, data) {
  const p = segs.join("/");
  const bytes = bytesOf(data);
  if (bytes > MAX_DOC_BYTES) return `${p} would be ${kb(bytes)}; the store refuses any document over 256 KB.`;
  const [collection, id] = segs;
  if (segs.length === 2 && collection === "datasets" && (!DATASET_ID.test(id) || RESERVED.has(id))) {
    return `datasets/${id}: a dataset id is 1\u201364 of A\u2013Z a\u2013z 0\u20139 _ - (the page ignores any other).`;
  }
  if (segs.length === 2 && collection === "files") {
    if (!FILE_NAME.test(id) || RESERVED.has(id)) return `files/${id}: a file name is letters, digits, _ - . (up to 64, no folders).`;
    if (typeof data.text !== "string") return `files/${id} needs {text}: the whole file as a string.`;
    if (data.text.length > MAX_FILE_CHARS) return `files/${id} is ${data.text.length} characters; a page file over 262,144 is refused. Split it: a <script src> or <link href> naming another files/<name> loads it.`;
  }
  return null;
}
function resolveFileRefs(value, where) {
  if (Array.isArray(value)) return value.map((v, i) => resolveFileRefs(v, `${where}[${i}]`));
  if (!isObject(value)) return value;
  const keys = Object.keys(value);
  if (keys.length === 1 && keys[0] === "$file") {
    const file = path5.resolve(String(value.$file));
    try {
      return fs6.readFileSync(file, "utf8");
    } catch {
      throw new CliError("FILE_NOT_FOUND", `${where}: {"$file": ${JSON.stringify(value.$file)}} \u2014 no such file (paths are relative to ${process.cwd()}).`);
    }
  }
  return Object.fromEntries(keys.map((k) => [k, resolveFileRefs(value[k], `${where}.${k}`)]));
}
function applyWrites(root, writes, { agent = true } = {}) {
  if (!Array.isArray(writes) || writes.length === 0) throw new CliError("EMPTY_BATCH", "The batch has no writes.");
  if (writes.length > MAX_BATCH_WRITES) throw new CliError("BATCH_TOO_LARGE", `${writes.length} writes; a batch is at most ${MAX_BATCH_WRITES}. Split it.`);
  const planned = [];
  const seen = /* @__PURE__ */ new Set();
  let total = 0;
  writes.forEach((w, i) => {
    const where = `writes[${i}]`;
    if (!isObject(w)) throw new CliError("INVALID_WRITE", `${where} is not an object.`);
    const op = w.op;
    if (!["set", "update", "delete"].includes(op)) throw new CliError("INVALID_WRITE", `${where}.op is ${JSON.stringify(op)}; use set, update or delete.`);
    const given = w.path ?? (w.collection !== void 0 && w.doc_id !== void 0 ? `${w.collection}/${w.doc_id}` : void 0);
    if (given === void 0) throw new CliError("INVALID_WRITE", `${where} names no document: give "path": "collection/doc_id" (or "collection" and "doc_id").`);
    let segs;
    try {
      segs = docSegments(given);
    } catch (error) {
      throw new CliError(error.code, `${where}: ${error.message}`);
    }
    const p = segs.join("/");
    if (agent && segs[0] === "data" && segs[1] === "users") throw new CliError("READ_ONLY_PATH", `${where}: ${p} is written by the open page; you only read it.`);
    if (seen.has(p)) throw new CliError("DUPLICATE_DOCUMENT", `${where}: ${p} appears twice; address each document once per batch.`);
    seen.add(p);
    let data;
    if (op !== "delete") {
      if (w.data === void 0 === (w.file_path === void 0)) throw new CliError("INVALID_WRITE", `${where} (${op}) needs exactly one of "data" or "file_path".`);
      if (w.file_path !== void 0) {
        try {
          data = JSON.parse(fs6.readFileSync(path5.resolve(String(w.file_path)), "utf8"));
        } catch (error) {
          throw new CliError("INVALID_WRITE", `${where}.file_path ${JSON.stringify(w.file_path)}: ${error.code === "ENOENT" ? "no such file" : `not JSON (${error.message})`}.`);
        }
      } else data = w.data;
      if (!isObject(data)) throw new CliError("INVALID_WRITE", `${where}.data must be a JSON object (the document's fields).`);
      data = agent ? resolveFileRefs(data, `${where}.data`) : data;
      if (op === "set" && hasDeleteMarker(data)) throw new CliError("INVALID_WRITE", `${where}: {"__delete__": true} works only in an update; set writes the whole document.`);
    }
    const file = docFile(root, segs);
    const existing = fs6.existsSync(file) ? readDoc(root, p) : { exists: false };
    let next = null;
    if (op === "set") next = data;
    else if (op === "update") next = mergePatch(existing.exists ? existing.data : {}, data);
    if (next !== null) {
      const problem = documentProblem(segs, next);
      if (problem) throw new CliError("REFUSED", `${where}: ${problem}`);
      total += bytesOf(next);
    }
    planned.push({ op, path: p, file, next, created: !existing.exists && op !== "delete", existed: existing.exists });
  });
  if (total > MAX_BATCH_BYTES) throw new CliError("BATCH_TOO_LARGE", `The batch writes ${kb(total)}; a batch is at most 1 MB. Split it.`);
  for (const w of planned) {
    if (w.op === "delete") fs6.rmSync(w.file, { force: true });
    else writeFileAtomic(w.file, `${JSON.stringify(w.next, null, 2)}
`);
  }
  return planned.map((w) => ({
    op: w.op,
    path: w.path,
    ...w.next !== null ? { bytes: bytesOf(w.next) } : {},
    ...w.created ? { created: true } : {},
    ...w.op === "delete" && !w.existed ? { note: "there was no such document" } : {}
  }));
}
var blobFile = (root, id) => path5.join(root, "_blobs", id);
function readBlobMeta(root, id) {
  try {
    return JSON.parse(fs6.readFileSync(`${blobFile(root, id)}.json`, "utf8"));
  } catch {
    return null;
  }
}
function putBlob(root, bytes, name, contentType) {
  const id = createHash3("sha256").update(bytes).digest("hex").slice(0, 32);
  const file = blobFile(root, id);
  if (!fs6.existsSync(file)) writeFileAtomic(file, bytes);
  const meta = { name, contentType, bytes: bytes.length, uploadedAt: (/* @__PURE__ */ new Date()).toISOString() };
  writeFileAtomic(`${file}.json`, `${JSON.stringify(meta, null, 2)}
`);
  return { url: `/_blob/${id}`, id, name, bytes: bytes.length, contentType };
}
function upload(root, given, flags) {
  if (!given) throw new CliError("MISSING_FILE", "Give the file to attach (CSV, TSV or JSON).");
  const file = path5.resolve(given);
  const stat = fs6.statSync(file, { throwIfNoEntry: false });
  if (!stat) throw new CliError("FILE_NOT_FOUND", `No such file: ${given}`);
  if (!stat.isFile()) throw new CliError("NOT_A_FILE", `${given} is not a regular file.`);
  if (stat.size > MAX_DATA_BYTES) {
    throw new CliError("FILE_TOO_LARGE", `${given} is ${kb(stat.size)}; a file dataset over 8 MB is refused. Keep only the columns and rows the dashboard shows, or aggregate first.`);
  }
  const name = flags.get("name") ?? path5.basename(file);
  const type = flags.get("type") ?? contentTypeOf(name);
  const result = putBlob(root, fs6.readFileSync(file), name, type);
  const ext = extOf(name);
  return {
    ...result,
    next: `Write source {kind: "file", url: ${JSON.stringify(result.url)}, name: ${JSON.stringify(name)}${["csv", "tsv", "tab", "json"].includes(ext) ? "" : ', format: "csv" | "tsv" | "json"'}} and updated {at: <ISO time>, by: <who>} into the dataset (set it, or one update of source.url, source.name and updated), then run check.`
  };
}
function referencesTo(root, id) {
  const { docs } = readAllDocs(root);
  const users = [];
  for (const [p, data] of docs) {
    if (p.startsWith("data/")) continue;
    if (JSON.stringify(data).includes(id)) users.push(p);
  }
  return users;
}
function deleteAsset(root, given) {
  const id = BLOB_URL.exec(String(given ?? ""))?.[1] ?? (BLOB_ID.test(String(given ?? "")) ? given : null);
  if (!id) throw new CliError("INVALID_ASSET", "Give the attached file as its url (/_blob/<id>) or id (32 hex).");
  if (!fs6.existsSync(blobFile(root, id))) throw new CliError("NOT_FOUND", `No attached file ${id} in ${root}/_blobs.`);
  const users = referencesTo(root, id);
  if (users.length > 0) throw new CliError("IN_USE", `${id} is still named by ${users.join(", ")}; change or delete those first.`);
  fs6.rmSync(blobFile(root, id), { force: true });
  fs6.rmSync(`${blobFile(root, id)}.json`, { force: true });
  return { deleted: `/_blob/${id}` };
}
function readDb(root, given, flags) {
  if (!given) {
    const files = listDocFiles(root);
    return {
      root,
      documents: [...files.keys()].sort().map((p) => ({ path: p, bytes: fs6.statSync(files.get(p).file).size }))
    };
  }
  const segs = splitPath(given, "collection or document");
  if (segs.length % 2 === 1) {
    const prefix = `${segs.join("/")}/`;
    const docs = [];
    for (const p of [...listDocFiles(root).keys()].sort()) {
      if (!p.startsWith(prefix) || p.slice(prefix.length).includes("/")) continue;
      docs.push({ id: p.slice(prefix.length), data: readDoc(root, p).data });
    }
    return { collection: segs.join("/"), docs };
  }
  const doc = readDoc(root, segs.join("/"));
  if (flags.has("text")) {
    if (!doc.exists) throw new CliError("NOT_FOUND", `No document ${doc.path}.`);
    if (typeof doc.data.text !== "string") throw new CliError("NO_TEXT", `${doc.path} has no text field.`);
    return { raw: doc.data.text };
  }
  return doc.exists ? { path: doc.path, exists: true, data: doc.data } : { path: doc.path, exists: false };
}
function sanitizeText(s) {
  return typeof s === "string" ? s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, " ") : "";
}
function normalizeColumns(header) {
  const out = [];
  header.forEach((h, i) => {
    let name = sanitizeText(typeof h === "number" || typeof h === "boolean" ? String(h) : h).replace(/\s+/g, " ").trim() || `column_${i + 1}`;
    while (out.includes(name)) name += "_";
    out.push(name);
  });
  return out;
}
function parseDelimited(text, sep) {
  const input = text.charCodeAt(0) === 65279 ? text.slice(1) : text;
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c !== '"') cell += c;
      else if (input[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = false;
      continue;
    }
    if (c === '"' && cell === "") quoted = true;
    else if (c === sep) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && input[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  const kept = rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
  if (kept.length === 0) return null;
  const columns = normalizeColumns(kept[0]);
  const data = kept.slice(1).map((r) => Object.fromEntries(columns.map((c, i) => [c, sanitizeText((r[i] ?? "").trim()) || null])));
  return { columns, rows: data };
}
function parseJsonTable(text) {
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  let rows = value;
  let declared = [];
  if (isObject(value)) {
    rows = ["rows", "data", "results"].map((k) => Object.hasOwn(value, k) ? value[k] : void 0).find(Array.isArray);
    if (Array.isArray(value.columns)) declared = value.columns.filter((c) => typeof c === "string");
  }
  if (!Array.isArray(rows)) return null;
  const records = rows.filter(isObject);
  const found = /* @__PURE__ */ new Set();
  for (const r of records) for (const k of Object.keys(r)) found.add(k);
  const columns = [.../* @__PURE__ */ new Set([...declared.filter((c) => found.has(c)), ...found])];
  return { columns, rows: records };
}
function inferFormat(name) {
  const n = String(name ?? "").toLowerCase();
  if (n.endsWith(".tsv") || n.endsWith(".tab")) return "tsv";
  if (n.endsWith(".json")) return "json";
  return "csv";
}
function cellText(v) {
  if (v === null || v === void 0) return "";
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}
var VOID = /* @__PURE__ */ new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (m, e) => {
    const k = e.toLowerCase();
    if (k === "amp") return "&";
    if (k === "lt") return "<";
    if (k === "gt") return ">";
    if (k === "quot") return '"';
    if (k === "apos") return "'";
    if (k === "nbsp") return "\xA0";
    const code = k.startsWith("#x") ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : m;
  });
}
function parseAttrs(src) {
  const attrs = {};
  const re = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m;
  while (m = re.exec(src)) attrs[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
  return attrs;
}
function scanHtml(html) {
  const elements = [];
  const scripts = [];
  const styles = [];
  const texts = [];
  const stack = [];
  const lineAt = (i2) => html.slice(0, i2).split("\n").length;
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    const textEnd = lt === -1 ? html.length : lt;
    if (textEnd > i) {
      const t = html.slice(i, textEnd);
      if (t.trim()) texts.push({ text: decodeEntities(t), el: stack.at(-1) ?? -1, line: lineAt(i) });
    }
    if (lt === -1) break;
    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt + 4);
      i = end === -1 ? html.length : end + 3;
      continue;
    }
    if (html[lt + 1] === "/") {
      const end = html.indexOf(">", lt);
      const name = html.slice(lt + 2, end === -1 ? html.length : end).trim().toLowerCase();
      for (let k = stack.length - 1; k >= 0; k--) {
        if (elements[stack[k]].tag === name) {
          stack.length = k;
          break;
        }
      }
      i = end === -1 ? html.length : end + 1;
      continue;
    }
    const m = /^<([A-Za-z][A-Za-z0-9:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/.exec(html.slice(lt));
    if (!m) {
      i = lt + 1;
      continue;
    }
    const tag = m[1].toLowerCase();
    const rawAttrs = m[2];
    const selfClosing = /\/\s*$/.test(rawAttrs);
    const el = { tag, attrs: parseAttrs(rawAttrs.replace(/\/\s*$/, "")), line: lineAt(lt), parent: stack.at(-1) ?? -1 };
    elements.push(el);
    const index = elements.length - 1;
    i = lt + m[0].length;
    if (tag === "script" || tag === "style") {
      const close = html.toLowerCase().indexOf(`</${tag}`, i);
      const body = html.slice(i, close === -1 ? html.length : close);
      (tag === "script" ? scripts : styles).push({ el: index, text: body, line: el.line });
      const end = close === -1 ? html.length : html.indexOf(">", close);
      i = end === -1 ? html.length : end + 1;
      continue;
    }
    if (!selfClosing && !VOID.has(tag)) stack.push(index);
  }
  return { elements, scripts, styles, texts };
}
var runtimeTokens = null;
function definedRuntimeTokens() {
  if (runtimeTokens) return runtimeTokens;
  runtimeTokens = /* @__PURE__ */ new Set();
  try {
    for (const name of fs6.readdirSync(path5.join(EDITOR_DIR, "assets"))) {
      if (!name.endsWith(".css")) continue;
      const css = fs6.readFileSync(path5.join(EDITOR_DIR, "assets", name), "utf8");
      for (const m of css.matchAll(/(--[A-Za-z0-9_-]+)\s*:/g)) runtimeTokens.add(m[1]);
    }
  } catch {
  }
  return runtimeTokens;
}
var FIGURE = /(?<![\w.#-])(?:[$€£¥]\s?\d[\d,.]*|\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?\s?%|\d+\.\d+|\d{3,})(?![\w.-])/;
var YEAR_OR_DATE = /^(?:19|20)\d{2}$|\d{4}-\d{2}/;
var EMPTY_DRAWING = /^[\s–—−\-·.…]*$|^n\/?a$/i;
var CHECK_ABANDONED_MS = 3e4;
var CHECK_OUTPUT_WORDS = {
  not_a_number: "NaN",
  empty_chart: "a blank chart",
  labels_overlap: "labels over each other",
  labels_cut: "labels cut off"
};
var CHECK_DRAWING_WORDS = {
  not_empty: "a drawing stored holding more than a \u2014",
  nested: "a drawing inside another",
  no_function: "a data-draw with no dash.draw function",
  stray_write: "a script writing outside a drawing (there it sets only class, style, hidden, disabled, checked, value or aria-*)"
};
var LOOK_KEYS = /* @__PURE__ */ new Set(["system", "light", "dark", "corners", "sizes", "fonts"]);
var LOOK_SET_KEYS = /* @__PURE__ */ new Set(["ground", "card", "text", "muted", "border", "good", "warning", "bad", "charts"]);
var LOOK_STATUSES = ["good", "warning", "bad"];
var LOOK_SIZES = { caption: [9, 18], body: [11, 22], heading: [12, 32], title: [16, 64] };
var LOOK_MAX_CORNERS = 32;
var LOOK_MAX_CHARTS = 8;
var LOOK_MAX_FONTS = 12;
var LOOK_MAX_STACK = 200;
var LOOK_GROUND_LUMINANCE = { light: 0.82, dark: 0.04 };
var LOOK_CARD_LUMINANCE = { light: 0.6, dark: 0.08 };
var LOOK_TEXT_FALLBACK = { light: "#000000", dark: "#ffffff" };
var LOOK_TEXT_CONTRAST = 4.5;
var LOOK_MUTED_CONTRAST = 3;
var LOOK_CHART_CONTRAST = 1.5;
var LOOK_CHART_DISTANCE = 7;
var LOOK_LENGTH = /^(\d{1,4}(?:\.\d{1,4})?)(px|rem)$/i;
var LOOK_FONT_NAME = /^[\p{L}\p{N}][\p{L}\p{N} _.-]{0,59}$/u;
var GENERIC_FONT = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-serif|ui-sans-serif|ui-monospace|ui-rounded|emoji|math|fangsong|-apple-system|blinkmacsystemfont)$/i;
var clampUnit = (x) => Math.max(0, Math.min(1, x));
var hexByte = (x) => Math.round(clampUnit(x) * 255).toString(16).padStart(2, "0");
var encodeSrgb = (x) => x <= 31308e-7 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
var decodeSrgb = (x) => x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
var rgbOfHex = (hex) => [parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255];
function cssNumber(text, scale) {
  if (text === "none") return 0;
  const m = /^(-?\d*\.?\d+(?:e-?\d+)?)(%?)$/.exec(text);
  if (!m) return void 0;
  return m[2] === "%" ? Number(m[1]) / 100 * scale : Number(m[1]);
}
function cssAngle(text) {
  const m = /^(-?\d*\.?\d+)(deg|rad|grad|turn)?$/.exec(text === "none" ? "0" : text);
  if (!m) return void 0;
  const unit = m[2] === "rad" ? 180 / Math.PI : m[2] === "grad" ? 0.9 : m[2] === "turn" ? 360 : 1;
  return (Number(m[1]) * unit % 360 + 360) % 360;
}
function colorArguments(text, fn) {
  const m = new RegExp(`^${fn}\\((.*)\\)$`).exec(text);
  if (!m) return void 0;
  const parts = m[1].trim().split(/\s*[,/]\s*|\s+/);
  return parts.length === 3 || parts.length === 4 ? parts : void 0;
}
function oklabToRgb(l, a, b) {
  const lms = [(l + 0.3963377774 * a + 0.2158037573 * b) ** 3, (l - 0.1055613458 * a - 0.0638541728 * b) ** 3, (l - 0.0894841775 * a - 1.291485548 * b) ** 3];
  return [
    encodeSrgb(4.0767416621 * lms[0] - 3.3077115913 * lms[1] + 0.2309699292 * lms[2]),
    encodeSrgb(-1.2684380046 * lms[0] + 2.6097574011 * lms[1] - 0.3413193965 * lms[2]),
    encodeSrgb(-0.0041960863 * lms[0] - 0.7034186147 * lms[1] + 1.707614701 * lms[2])
  ];
}
function labToRgb(l, a, b) {
  const fy = (l + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const inverse = (t) => t ** 3 > 0.008856451679035631 ? t ** 3 : (116 * t - 16) / 903.2962962962963;
  const [x, y, z] = [inverse(fx) * 0.96422, l > 8 ? fy ** 3 : l / 903.2962962962963, inverse(fz) * 0.82521];
  const [dx, dy, dz] = [0.9555766 * x - 0.0230393 * y + 0.0631636 * z, -0.0282895 * x + 1.0099416 * y + 0.0210077 * z, 0.0122982 * x - 0.020483 * y + 1.3299098 * z];
  return [encodeSrgb(3.2404542 * dx - 1.5371385 * dy - 0.4985314 * dz), encodeSrgb(-0.969266 * dx + 1.8760108 * dy + 0.041556 * dz), encodeSrgb(0.0556434 * dx - 0.2040259 * dy + 1.0572252 * dz)];
}
function parseLookColor(value) {
  const text = value.trim().toLowerCase();
  if (text.length > 96) return void 0;
  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(text)?.[1];
  if (hex !== void 0) {
    const full = hex.length <= 4 ? [...hex].map((c) => c + c).join("") : hex;
    return `#${full.endsWith("ff") && full.length === 8 ? full.slice(0, 6) : full}`;
  }
  const fn = /^(rgba?|hsla?|oklch|oklab|lab|lch)\(/.exec(text)?.[1];
  const args = fn !== void 0 ? colorArguments(text, fn) : void 0;
  if (fn === void 0 || args === void 0) return void 0;
  const alpha = args[3] !== void 0 ? cssNumber(args[3], 1) : 1;
  let rgb;
  if (fn === "rgb" || fn === "rgba") {
    const [r, g, b] = [cssNumber(args[0], 255), cssNumber(args[1], 255), cssNumber(args[2], 255)];
    if (r !== void 0 && g !== void 0 && b !== void 0) rgb = [r / 255, g / 255, b / 255];
  } else if (fn === "hsl" || fn === "hsla") {
    const [h, s, l] = [cssAngle(args[0]), cssNumber(args[1].replace(/%$/, ""), 100), cssNumber(args[2].replace(/%$/, ""), 100)];
    if (h !== void 0 && s !== void 0 && l !== void 0) {
      const [sat, light] = [clampUnit(s / 100), clampUnit(l / 100)];
      const channel = (n) => {
        const k = (n + h / 30) % 12;
        return light - sat * Math.min(light, 1 - light) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
      };
      rgb = [channel(0), channel(8), channel(4)];
    }
  } else if (fn === "oklab" || fn === "oklch") {
    const l = cssNumber(args[0], 1);
    let a = cssNumber(args[1], 0.4);
    let b = fn === "oklab" ? cssNumber(args[2], 0.4) : void 0;
    if (fn === "oklch") {
      const h = cssAngle(args[2]);
      if (a !== void 0 && h !== void 0) [a, b] = [Math.max(0, a) * Math.cos(h * Math.PI / 180), Math.max(0, a) * Math.sin(h * Math.PI / 180)];
    }
    if (l !== void 0 && a !== void 0 && b !== void 0) rgb = oklabToRgb(clampUnit(l), a, b);
  } else {
    const l = cssNumber(args[0], 100);
    let a = cssNumber(args[1], fn === "lab" ? 125 : 150);
    let b = fn === "lab" ? cssNumber(args[2], 125) : void 0;
    if (fn === "lch") {
      const h = cssAngle(args[2]);
      if (a !== void 0 && h !== void 0) [a, b] = [Math.max(0, a) * Math.cos(h * Math.PI / 180), Math.max(0, a) * Math.sin(h * Math.PI / 180)];
    }
    if (l !== void 0 && a !== void 0 && b !== void 0) rgb = labToRgb(Math.max(0, Math.min(100, l)), a, b);
  }
  if (rgb === void 0 || alpha === void 0 || rgb.some((x) => !Number.isFinite(x))) return void 0;
  const color = `#${hexByte(rgb[0])}${hexByte(rgb[1])}${hexByte(rgb[2])}`;
  return alpha >= 1 ? color : color + hexByte(alpha);
}
var luminance = (hex) => {
  const [r, g, b] = rgbOfHex(hex).map(decodeSrgb);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
var contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
var mixHex = (a, b, t) => {
  const [x, y] = [rgbOfHex(a), rgbOfHex(b)];
  return `#${[0, 1, 2].map((i) => Math.round((x[i] * (1 - t) + y[i] * t) * 255).toString(16).padStart(2, "0")).join("")}`;
};
function oklabOfHex(hex) {
  const [r, g, b] = rgbOfHex(hex).map(decodeSrgb);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
var colorDistance = (a, b) => {
  const [x, y] = [oklabOfHex(a), oklabOfHex(b)];
  return 100 * Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
};
var inLuminanceBand = (hex, theme, band) => theme === "light" ? luminance(hex) >= band.light : luminance(hex) <= band.dark;
function readLookColor(value, under) {
  const color = typeof value === "string" ? parseLookColor(value) : void 0;
  if (color === void 0 || color.length === 7) return color;
  if (under === void 0) return void 0;
  const alpha = color.slice(7);
  return alpha === "ff" ? color.slice(0, 7) : mixHex(under, color.slice(0, 7), parseInt(alpha, 16) / 255);
}
function readLookLength(value, min, max) {
  const m = typeof value === "string" ? LOOK_LENGTH.exec(value.trim()) : null;
  const px = typeof value === "number" ? value : m ? Number(m[1]) * (m[2].toLowerCase() === "rem" ? 16 : 1) : NaN;
  if (!Number.isFinite(px)) return void 0;
  const kept = Math.round(Math.min(max, Math.max(min, px)) * 100) / 100;
  return { px: kept, held: kept !== Math.round(px * 100) / 100 };
}
function isLookFontStack(value) {
  if (typeof value !== "string" || value.length > LOOK_MAX_STACK) return false;
  const names = value.split(",").map((n) => n.trim().replace(/^(["'])(.*)\1$/, "$2"));
  return names.length <= LOOK_MAX_FONTS && names.every((n) => GENERIC_FONT.test(n) || LOOK_FONT_NAME.test(n));
}
function checkLookSet(value, theme, issue, warn) {
  if (value === void 0) return false;
  if (!isObject(value)) {
    issue(`${theme} is an object of colors ({ground, card, text, \u2026}); the ${theme} set is dropped.`);
    return false;
  }
  for (const key of Object.keys(value)) if (!LOOK_SET_KEYS.has(key)) warn(`${theme}.${key} isn\u2019t read (a set has ${[...LOOK_SET_KEYS].join(", ")}).`);
  const form = "a hex, or rgb(), hsl(), oklch(), oklab(), lab() or lch(): no name, var() or gradient";
  const ground = readLookColor(value.ground);
  if (ground === void 0) {
    issue(value.ground === void 0 ? `${theme}.ground is missing: a set needs its ground, so the ${theme} set is dropped.` : `${theme}.ground ${JSON.stringify(value.ground)} isn\u2019t a color the dashboard reads (${form}; no alpha on a ground): the ${theme} set is dropped.`);
    return false;
  }
  if (!inLuminanceBand(ground, theme, LOOK_GROUND_LUMINANCE)) {
    issue(`${theme}.ground ${value.ground} is too ${theme === "light" ? "dark" : "light"} (a ${theme} ground is as ${theme} as ${theme === "light" ? "#eaeaea or lighter" : "#383838 or darker"}, as that gray): the whole ${theme} set is dropped and its readers see the dashboard\u2019s own colors.`);
    return false;
  }
  const unread = (key) => value[key] !== void 0 && readLookColor(value[key], ground) === void 0;
  for (const key of ["card", "text", "muted", "border", ...LOOK_STATUSES]) if (unread(key)) issue(`${theme}.${key} ${JSON.stringify(value[key])} isn\u2019t a color the dashboard reads (${form}); it is dropped.`);
  const cardColor = readLookColor(value.card, ground);
  const card = cardColor !== void 0 && inLuminanceBand(cardColor, theme, LOOK_CARD_LUMINANCE) ? cardColor : ground;
  if (cardColor !== void 0 && card !== cardColor) warn(`${theme}.card ${value.card} is ${theme === "light" ? "darker than #cccccc" : "lighter than #4f4f4f"}; the ground stands in.`);
  const reads = (color2, ratio) => color2 !== void 0 && contrast(color2, ground) >= ratio && contrast(color2, card) >= ratio;
  const color = (key) => readLookColor(value[key], card);
  const given = color("text");
  const text = [given, LOOK_TEXT_FALLBACK[theme]].find((c) => reads(c, LOOK_TEXT_CONTRAST)) ?? LOOK_TEXT_FALLBACK[theme];
  if (given !== void 0 && given !== text) warn(`${theme}.text ${value.text} is under 4.5:1 on the ground or the card; ${theme === "light" ? "black" : "white"} stands in.`);
  const muted = color("muted");
  if (muted !== void 0 && !reads(muted, LOOK_MUTED_CONTRAST)) warn(`${theme}.muted ${value.muted} is under 3:1 on the ground or the card; one is mixed from text and ground instead.`);
  for (const key of LOOK_STATUSES) {
    const status = color(key);
    if (status !== void 0 && !reads(status, LOOK_MUTED_CONTRAST)) warn(`${theme}.${key} ${value[key]} is under 3:1 on the ground or the card; the dashboard\u2019s own shows.`);
  }
  if (value.charts !== void 0) {
    if (!Array.isArray(value.charts)) issue(`${theme}.charts is a list of colors, the brand color first; it is dropped.`);
    else {
      if (value.charts.length > LOOK_MAX_CHARTS) warn(`${theme}.charts has ${value.charts.length} colors; only the first ${LOOK_MAX_CHARTS} are read.`);
      const kept = [];
      value.charts.slice(0, LOOK_MAX_CHARTS).forEach((entry, i) => {
        const chart = readLookColor(entry, card);
        const near = chart === void 0 ? -1 : kept.findIndex((k) => k !== void 0 && colorDistance(k, chart) < LOOK_CHART_DISTANCE);
        const ok = reads(chart, LOOK_CHART_CONTRAST) && near === -1;
        kept.push(ok ? chart : void 0);
        if (chart === void 0) issue(`${theme}.charts[${i}] ${JSON.stringify(entry)} isn\u2019t a color the dashboard reads (${form}); that slot keeps the dashboard\u2019s color.`);
        else if (!reads(chart, LOOK_CHART_CONTRAST)) warn(`${theme}.charts[${i}] ${entry} is under 1.5:1 on the ground or the card; that slot keeps the dashboard\u2019s color.`);
        else if (near !== -1) warn(`${theme}.charts[${i}] ${entry} is too close to charts[${near}]; that slot keeps the dashboard\u2019s color.`);
      });
    }
  }
  return true;
}
function checkLook(look, issue, warn) {
  const doc = "dash/look";
  const lookIssue = (message) => issue(doc, message);
  const lookWarn = (message) => warn(doc, message);
  for (const key of Object.keys(look)) if (!LOOK_KEYS.has(key)) lookWarn(`${key} isn\u2019t read (dash/look has ${[...LOOK_KEYS].join(", ")}).`);
  const light = checkLookSet(look.light, "light", lookIssue, lookWarn);
  const dark = checkLookSet(look.dark, "dark", lookIssue, lookWarn);
  if (!light && !dark) lookIssue("has no set the dashboard can use (light or dark, each with its ground), so nothing of the look applies.");
  else if (!light || !dark) lookWarn(`only the ${light ? "light" : "dark"} set is used: readers in the other theme${light ? "" : ", and print,"} see the dashboard\u2019s own colors. Fill both sets.`);
  const length = (where, value, min, max) => {
    if (value === void 0) return;
    const read = readLookLength(value, min, max);
    if (read === void 0) lookIssue(`${where} ${JSON.stringify(value)} isn\u2019t a length the dashboard reads (px or rem, as "12px" or "0.75rem"); it is dropped.`);
    else if (read.held) lookWarn(`${where} ${value} is held to ${read.px}px (${min} to ${max}px).`);
  };
  length("corners", look.corners, 0, LOOK_MAX_CORNERS);
  if (look.sizes !== void 0) {
    if (!isObject(look.sizes)) lookIssue("sizes is an object: {caption, body, heading, title}.");
    else {
      for (const key of Object.keys(look.sizes)) if (!(key in LOOK_SIZES)) lookWarn(`sizes.${key} isn\u2019t read (sizes are ${Object.keys(LOOK_SIZES).join(", ")}).`);
      for (const [key, [min, max]] of Object.entries(LOOK_SIZES)) length(`sizes.${key}`, look.sizes[key], min, max);
    }
  }
  if (look.fonts !== void 0) {
    if (!isObject(look.fonts)) lookIssue("fonts is an object: {text, display}.");
    else {
      for (const key of Object.keys(look.fonts)) if (key !== "text" && key !== "display") lookWarn(`fonts.${key} isn\u2019t read (fonts are text and display).`);
      for (const key of ["text", "display"]) {
        const stack = look.fonts[key];
        if (stack !== void 0 && !isLookFontStack(stack)) lookIssue(`fonts.${key} ${JSON.stringify(stack)} is dropped: up to ${LOOK_MAX_FONTS} names, ${LOOK_MAX_STACK} characters in all, each a generic or up to 60 letters, digits, spaces, _ . -.`);
      }
    }
  }
}
function check(root) {
  const issues = [];
  const warnings = [];
  const issue = (doc, message) => issues.push({ doc, message });
  const warn = (doc, message) => warnings.push({ doc, message });
  const { docs, damaged } = readAllDocs(root);
  for (const p of damaged) issue(p, "is not a JSON object; the page can\u2019t read it. Rewrite it with set.");
  for (const [p, data] of docs) {
    const bytes = bytesOf(data);
    if (bytes > MAX_DOC_BYTES) issue(p, `is ${kb(bytes)}; the store refuses any document over 256 KB.`);
    const top = p.split("/")[0];
    if (top === "drafts") warn(p, "is a Remix draft: Remix and its drafts need the claude.ai page, so the local editor never shows it. Change the dashboard\u2019s own documents instead.");
    else if (!["dash", "datasets", "files", "data", "versions", "version-docs"].includes(top)) warn(p, "is in a collection the dashboard doesn\u2019t read.");
  }
  const meta = docs.get("dash/meta");
  let title = null;
  if (!meta) issue("dash/meta", "is missing: write {title} first, what the user calls it.");
  else if (typeof meta.title !== "string" || meta.title.trim() === "") issue("dash/meta", "needs a title (what the user calls it).");
  else {
    title = meta.title;
    if (/^dashboard$/i.test(meta.title.trim())) warn("dash/meta", 'title is "Dashboard"; use what the user calls it.');
  }
  const params = docs.get("dash/params");
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      const scalar = (x) => x === null || typeof x === "boolean" || typeof x === "number" && Number.isFinite(x) || typeof x === "string" && !/[\x00-\x1f\x7f\u2028\u2029]/.test(x);
      if (!PARAM_NAME.test(k) || RESERVED.has(k)) issue("dash/params", `${JSON.stringify(k)} is not a parameter name (letters, digits, _; not starting with a digit).`);
      else if (!(scalar(v) || Array.isArray(v) && v.every((x) => x !== null && scalar(x)))) issue("dash/params", `${k}: a default is text on one line, a number, a boolean, null, or a list of them.`);
    }
  }
  const look = docs.get("dash/look");
  if (look) checkLook(look, issue, warn);
  const datasets = /* @__PURE__ */ new Map();
  for (const [p, data] of docs) {
    const m = /^datasets\/([^/]+)$/.exec(p);
    if (!m) continue;
    const id = m[1];
    if (!DATASET_ID.test(id) || RESERVED.has(id)) {
      issue(p, "has an id the page ignores: 1\u201364 of A\u2013Z a\u2013z 0\u20139 _ -.");
      continue;
    }
    const info = { id, kind: null, table: null };
    datasets.set(id, info);
    if (typeof data.title !== "string" || !data.title.trim()) issue(p, "needs a title: a short name that stands alone in a list of sources.");
    else if (data.title.length > 40) warn(p, `title is ${data.title.length} characters; about 30 reads best in Sources (the detail goes in description).`);
    if (data.description !== void 0 && typeof data.description !== "string") issue(p, "description must be text.");
    const source = isObject(data.source) ? data.source : null;
    if (!source) {
      issue(p, 'needs source: {kind: "file", url, name, format?}.');
      continue;
    }
    const kind = typeof source.kind === "string" ? source.kind : typeof source.tool === "string" ? "query" : typeof source.url === "string" ? "file" : Array.isArray(source.rows) ? "rows" : null;
    info.kind = kind;
    if (kind === "query") {
      issue(p, "is a live query: there are no connectors in the local page, so it never loads. Run the query yourself, attach its rows as a file (upload), and set the dataset with a file source.");
      continue;
    }
    if (kind === "rows") {
      issue(p, 'is an old rows dataset (it shows "Didn\u2019t load"): make its rows a JSON file, upload it, then set the document with a file source and updated.');
      continue;
    }
    if (kind !== "file") {
      issue(p, `source.kind ${JSON.stringify(source.kind)} isn\u2019t one the page loads; use "file".`);
      continue;
    }
    if (data.fixed !== void 0 && data.fixed !== true) issue(p, `fixed is true or left out; the page ignores ${JSON.stringify(data.fixed)}.`);
    const leftovers = ["lastAttempt", "pausedBy"].filter((k) => data[k] !== void 0);
    if (leftovers.length) warn(p, `${leftovers.join(" and ")} ${leftovers.length > 1 ? "are" : "is"} left from a paused query, which the page no longer has; remove ${leftovers.length > 1 ? "them" : "it"}.`);
    const blob = BLOB_URL.exec(String(source.url ?? ""))?.[1];
    if (!blob) {
      issue(p, `source.url ${JSON.stringify(source.url)} isn\u2019t an attached file: give the url upload printed (/_blob/<id>), as it came.`);
      continue;
    }
    const file = blobFile(root, blob);
    const stat = fs6.statSync(file, { throwIfNoEntry: false });
    if (!stat) {
      issue(p, `source.url ${source.url}: no such attached file in _blobs/. Upload the file again and use the url it prints.`);
      continue;
    }
    if (stat.size > MAX_DATA_BYTES) {
      issue(p, `its file is ${kb(stat.size)}; the page refuses a file over 8 MB.`);
      continue;
    }
    if (typeof source.name !== "string" || !source.name.trim()) issue(p, "source.name: the file\u2019s own name (it sets the format when format is left out).");
    if (source.format !== void 0 && !["csv", "tsv", "json"].includes(source.format)) issue(p, 'source.format is "csv", "tsv" or "json" (only when the name\u2019s extension doesn\u2019t say).');
    const format = ["csv", "tsv", "json"].includes(source.format) ? source.format : inferFormat(source.name);
    const text = fs6.readFileSync(file, "utf8");
    const table = format === "json" ? parseJsonTable(text) : parseDelimited(text, format === "tsv" ? "	" : ",");
    if (!table || table.columns.length === 0) {
      issue(p, `the file has no rows the page can read as ${format}${format === "json" ? " (an array of row objects, or one under rows/data/results)" : ""}.`);
      continue;
    }
    info.table = table;
    info.format = format;
    const updated = isObject(data.updated) ? data.updated : null;
    if (!updated || typeof updated.at !== "string" || Number.isNaN(Date.parse(updated.at))) issue(p, "needs updated: {at: <ISO time>, by: <who>} on every file write; without it the file shows a warning.");
    else if (typeof updated.by !== "string" || !updated.by.trim()) warn(p, "updated.by is empty: say who wrote it.");
    if (data.staleAfterHours !== void 0 && !(Number.isInteger(data.staleAfterHours) && data.staleAfterHours >= 1)) issue(p, "staleAfterHours is a whole number of hours, 1 or more.");
    if (data.schedule !== void 0 && data.staleAfterHours === void 0) warn(p, "has a schedule but no staleAfterHours (about twice the cadence).");
  }
  const files = /* @__PURE__ */ new Map();
  for (const [p, data] of docs) {
    const m = /^files\/([^/]+)$/.exec(p);
    if (!m) continue;
    if (!FILE_NAME.test(m[1]) || RESERVED.has(m[1])) issue(p, "has a name the page ignores: letters, digits, _ - . (up to 64, no folders).");
    else if (typeof data.text !== "string") issue(p, "needs {text}: the whole file.");
    else if (data.text.length > MAX_FILE_CHARS) issue(p, `is ${data.text.length} characters; a page file over 262,144 is refused.`);
    else files.set(m[1], data.text);
  }
  const index = files.get("index.html");
  if (index === void 0 && !issues.some((x) => x.doc === "files/index.html")) issue("files/index.html", "is missing: the page is files/index.html {text}.");
  const calcs = /* @__PURE__ */ new Map();
  const loaders = /* @__PURE__ */ new Set();
  const reads = /* @__PURE__ */ new Map();
  const marked = /* @__PURE__ */ new Set();
  const js = [];
  const css = [];
  if (index !== void 0) {
    const page = scanHtml(index);
    const doc = "files/index.html";
    const isOneWriterMeta = (el) => el.tag === "meta" && el.attrs.name === "dash-one-writer";
    const oneWriter = page.elements.some(isOneWriterMeta);
    for (const el of page.elements) {
      if (["meta", "base", "form", "iframe", "frame", "frameset", "object", "embed", "portal", "fencedframe"].includes(el.tag) && !isOneWriterMeta(el)) {
        warn(doc, `line ${el.line}: <${el.tag}> is dropped${el.tag === "form" ? " with everything in it" : ""}.`);
      }
      const priority = el.attrs["data-fetchpriority"];
      if (priority !== void 0 && !["high", "low"].includes(priority.trim().toLowerCase())) warn(doc, `line ${el.line}: data-fetchpriority="${priority}" reads as auto; it is high or low.`);
      for (const name of Object.keys(el.attrs)) if (name.startsWith("on") && name.length > 2) warn(doc, `line ${el.line}: ${name}= doesn\u2019t run; add a listener in a script.`);
      if (el.tag === "link" && /(^|\s)stylesheet(\s|$)/i.test(el.attrs.rel ?? "")) {
        const name = (el.attrs.href ?? "").trim().replace(/^\.\//, "");
        if (files.has(name)) css.push({ doc: `files/${name}`, text: files.get(name) });
        else warn(doc, `line ${el.line}: <link href="${el.attrs.href ?? ""}"> names no files/<name>, so it is dropped.`);
      }
    }
    for (const s of page.scripts) {
      const el = page.elements[s.el];
      const type = (el.attrs.type ?? "").trim().toLowerCase();
      if (!["", "text/javascript", "application/javascript"].includes(type)) {
        if (type === "module") warn(doc, `line ${el.line}: <script type="module"> doesn\u2019t run here; no modules.`);
        continue;
      }
      if (el.attrs.src !== void 0) {
        const name = el.attrs.src.trim().replace(/^\.\//, "");
        if (files.has(name)) js.push({ doc: `files/${name}`, text: files.get(name), line: 1 });
        else warn(doc, `line ${el.line}: <script src="${el.attrs.src}"> names no files/<name>, so it is dropped (d3 is already the global d3).`);
      } else js.push({ doc, text: s.text, line: s.line });
    }
    for (const s of page.styles) css.push({ doc, text: s.text });
    for (const s of js) {
      try {
        new vm.Script(s.text, { filename: s.doc, lineOffset: s.line - 1 });
      } catch (error) {
        let ok = false;
        try {
          new Function(s.text);
          ok = true;
        } catch {
        }
        if (!ok) issue(s.doc, `a script doesn\u2019t parse (from line ${s.line}): ${error.message}`);
      }
      for (const m of s.text.matchAll(/dash\.calc\(\s*(['"`])([^'"`]+)\1/g)) {
        const after = s.text.slice(m.index, m.index + 600);
        const inputs = /inputs\s*:\s*\[([^\]]*)\]/.exec(after)?.[1];
        calcs.set(m[2], inputs ? [...inputs.matchAll(/(['"`])([^'"`]+)\1/g)].map((x) => x[2]) : []);
      }
      for (const m of s.text.matchAll(/dash\.loader\(\s*(['"`])([^'"`]+)\1/g)) loaders.add(m[2]);
      for (const m of s.text.matchAll(/dash\.(?:data|refresh)\(\s*(['"`])([^'"`]+)\1/g)) if (!reads.has(m[2])) reads.set(m[2], s.doc);
      for (const m of s.text.matchAll(/var\(--(?:cds|color)-[A-Za-z0-9_-]*\$\{/g)) warn(s.doc, `${m[0]}\u2026: write token names in full; a built name hides a typo.`);
      if (/\.innerHTML\s*=|\.html\(/.test(s.text)) warn(s.doc, "uses innerHTML / .html(): data values are untrusted text; show them with textContent / .text().");
      if (/\b(?:localStorage|sessionStorage|document\.cookie|indexedDB)\b/.test(s.text)) warn(s.doc, "uses storage or cookies, which the dashboard doesn\u2019t have.");
      if (/\bfetch\(|XMLHttpRequest|new WebSocket|import\(/.test(s.text)) warn(s.doc, "reaches the network or imports a module; the page has no network: data comes from dash.data.");
    }
    for (const [id, inputs] of calcs) {
      if (datasets.has(id)) issue("files", `dash.calc("${id}") uses a dataset\u2019s id; a calc takes an id no dataset has.`);
      for (const input of inputs) if (!datasets.has(input) && !calcs.has(input)) issue("files", `dash.calc("${id}") reads input "${input}", which is no dataset or calc.`);
    }
    for (const id of loaders) warn("files", `dash.loader("${id}") is for a live query\u2019s answer; file datasets load as rows without one.`);
    const draws = /* @__PURE__ */ new Set();
    let drawsByName = true;
    for (const s of js) {
      for (const m of s.text.matchAll(/dash\.draw\(\s*(['"`])([^'"`]+)\1/g)) draws.add(m[2]);
      if (/dash\.draw\(\s*[^'"`\s)]/.test(s.text)) drawsByName = false;
    }
    const insideDrawing = (k) => {
      for (k = page.elements[k].parent; k !== -1; k = page.elements[k].parent) if (page.elements[k].attrs["data-draw"] !== void 0) return true;
      return false;
    };
    const drawn = /* @__PURE__ */ new Set();
    page.elements.forEach((el, k) => {
      const name = el.attrs["data-draw"];
      if (name === void 0) return;
      drawn.add(name);
      const where = `line ${el.line} <${el.tag} data-draw="${name}">`;
      if (drawsByName && !draws.has(name)) warn(doc, `${where}: no dash.draw("${name}", fn) fills it, so it keeps its \u2014.`);
      if (!oneWriter) return;
      if (insideDrawing(k)) warn(doc, `${where} sits inside another drawing; the outer one\u2019s function draws all of it.`);
      else {
        const holds = page.elements.some((e) => e.parent === k) || !EMPTY_DRAWING.test(page.texts.filter((t) => t.el === k).map((t) => t.text).join(""));
        if (holds) warn(doc, `${where} is stored holding more than a \u2014; a drawing\u2019s function writes all of it.`);
      }
    });
    for (const name of draws) if (!drawn.has(name)) warn("files", `dash.draw("${name}") has no element marked data-draw="${name}" to draw.`);
    const defined = definedRuntimeTokens();
    const own = /* @__PURE__ */ new Set();
    for (const c of [...css, ...js]) for (const m of c.text.matchAll(/(--[A-Za-z0-9_-]+)\s*:/g)) own.add(m[1]);
    for (const el of page.elements) for (const m of (el.attrs.style ?? "").matchAll(/(--[A-Za-z0-9_-]+)\s*:/g)) own.add(m[1]);
    const unknown = /* @__PURE__ */ new Set();
    const scan = (text) => {
      for (const m of text.matchAll(/var\(\s*(--(?:cds|color|font-anthropic)-[A-Za-z0-9_-]+)/g)) if (defined.size > 0 && !defined.has(m[1]) && !own.has(m[1])) unknown.add(m[1]);
    };
    for (const c of [...css, ...js]) scan(c.text);
    for (const el of page.elements) scan(el.attrs.style ?? "");
    for (const t of unknown) issue("files", `var(${t}) is no token of the dashboard (a typo?): use the names in artifact-type/reference/design-defaults.md.`);
    const sourceOf = (id) => datasets.has(id) ? "dataset" : calcs.has(id) ? "calc" : null;
    const closestTable = (el) => {
      for (let k = el.parent; k !== -1; k = page.elements[k].parent) {
        const t = page.elements[k];
        if (t.tag === "table" && t.attrs["data-source"] !== void 0) return t;
      }
      return null;
    };
    const columnCheck = (where, ds, field) => {
      if (ds?.table && !ds.table.columns.includes(field)) issue(doc, `${where}: data-field="${field}" is no column of ${ds.id} (columns: ${ds.table.columns.join(", ")}).`);
    };
    for (const el of page.elements) {
      const where = `line ${el.line} <${el.tag}${el.attrs.id ? ` id="${el.attrs.id}"` : ""}>`;
      const src = el.attrs["data-source"];
      if (src === void 0) {
        if (el.tag === "th" && el.attrs["data-field"] !== void 0) {
          const table = closestTable(el);
          if (!table) warn(doc, `${where}: a <th data-field> outside a marked <table data-source data-row-key>.`);
          else {
            const ids2 = table.attrs["data-source"].trim().split(/\s+/);
            if (ids2.length === 1) columnCheck(where, datasets.get(ids2[0]), el.attrs["data-field"]);
          }
        } else if (["data-field", "data-where", "data-row"].some((a) => el.attrs[a] !== void 0)) {
          warn(doc, `${where}: data-field/data-where/data-row without data-source on the same element.`);
        }
        continue;
      }
      const ids = src.trim().split(/\s+/).filter(Boolean);
      if (ids.length === 0) {
        issue(doc, `${where}: data-source is empty.`);
        continue;
      }
      for (const id of ids) {
        marked.add(id);
        if (!sourceOf(id)) issue(doc, `${where}: data-source="${id}" names no dataset or dash.calc (datasets: ${[...datasets.keys()].join(", ") || "none"}${calcs.size ? `; calcs: ${[...calcs.keys()].join(", ")}` : ""}).`);
      }
      if (el.tag === "svg") warn(doc, `${where}: mark a chart on its container, not the <svg> itself.`);
      const one = ids.length === 1 ? datasets.get(ids[0]) : null;
      const field = el.attrs["data-field"];
      if (field !== void 0) {
        if (ids.length > 1) issue(doc, `${where}: data-field with several data-source ids; a cell comes from one source.`);
        else if (el.tag === "th" && datasets.has(ids[0])) {
          const table = closestTable(el);
          if (table) warn(doc, `${where}: a computed column\u2019s <th> names a calc, not a dataset.`);
          columnCheck(where, one, field);
        } else columnCheck(where, one, field);
      }
      const whereAttr = el.attrs["data-where"];
      let picked = null;
      if (whereAttr !== void 0 && one?.table) {
        const pairs = whereAttr.split("&").filter(Boolean).map((part) => {
          const eq = part.indexOf("=");
          const dec = (s) => {
            try {
              return decodeURIComponent(s);
            } catch {
              return s;
            }
          };
          return eq < 0 ? [dec(part), ""] : [dec(part.slice(0, eq)), dec(part.slice(eq + 1))];
        });
        const missing = pairs.filter(([c]) => !one.table.columns.includes(c));
        if (missing.length) issue(doc, `${where}: data-where names ${missing.map(([c]) => `"${c}"`).join(", ")}, no column of ${one.id}.`);
        else {
          picked = one.table.rows.filter((r) => pairs.every(([c, v]) => cellText(r[c]) === v));
          if (picked.length === 0) issue(doc, `${where}: data-where="${whereAttr}" matches no row of ${one.id}.`);
        }
      }
      const rowAttr = el.attrs["data-row"];
      if (rowAttr !== void 0 && one?.table) {
        const n = Number(rowAttr);
        if (!Number.isInteger(n) || n < 0 || n >= one.table.rows.length) issue(doc, `${where}: data-row="${rowAttr}" is outside ${one.id}\u2019s ${one.table.rows.length} rows (0-based).`);
      }
      const key = el.attrs["data-row-key"];
      if (key !== void 0) {
        if (el.tag !== "table") warn(doc, `${where}: data-row-key goes on the <table>.`);
        if (ids.length > 1) issue(doc, `${where}: a table is marked with one data-source.`);
        else if (one?.table) {
          const cols = key.split(",").map((c) => c.trim()).filter(Boolean);
          const missing = cols.filter((c) => !one.table.columns.includes(c));
          if (missing.length) issue(doc, `${where}: data-row-key names ${missing.join(", ")}, no column of ${one.id}.`);
          else {
            const keys = one.table.rows.map((r) => cols.map((c) => cellText(r[c])).join("\0"));
            if (new Set(keys).size !== keys.length) issue(doc, `${where}: data-row-key="${key}" doesn\u2019t tell ${one.id}\u2019s rows apart (repeated values); add a column ("a,b").`);
          }
        }
      }
    }
    const insideMarkOrScript = (k) => {
      for (; k !== -1; k = page.elements[k].parent) {
        const e = page.elements[k];
        if (["script", "style", "template"].includes(e.tag) || e.attrs["data-source"] !== void 0 || e.attrs["data-literal"] !== void 0 || e.attrs["data-draw"] !== void 0) return true;
      }
      return false;
    };
    let figures = 0;
    for (const t of page.texts) {
      if (insideMarkOrScript(t.el)) continue;
      const m = FIGURE.exec(t.text);
      if (!m || YEAR_OR_DATE.test(m[0].trim())) continue;
      if (++figures <= 8) warn(doc, `line ${t.line}: "${t.text.trim().slice(0, 60)}" holds a figure (${m[0].trim()}) outside any mark. Every figure comes from a dataset; a fixed reference the user chose is fine.`);
    }
  }
  for (const [id, info] of datasets) {
    if (!marked.has(id) && !reads.has(id)) warn(`datasets/${id}`, 'nothing on the page names it; Sources labels it "Unused".');
    else if (!marked.has(id) && reads.has(id)) issue(`datasets/${id}`, `${reads.get(id)} reads it, but no element is marked data-source="${id}". Mark every dataset your scripts read.`);
    void info;
  }
  for (const [id, doc] of reads) if (!datasets.has(id) && !calcs.has(id)) issue(doc, `dash.data("${id}") reads no dataset or calc.`);
  let pageReport;
  const runs = docs.get(`data/users/${LOCAL_USER_ID}/runs`);
  if (runs) {
    const runsFile = docFile(root, ["data", "users", LOCAL_USER_ID, "runs"]);
    const writtenAt = fs6.statSync(runsFile).mtime;
    const pageChanged = [...docs.keys()].some((p) => /^(files|datasets)\//.test(p) && fs6.statSync(docFile(root, p.split("/"))).mtime > writtenAt);
    const failedSources = Object.entries(isObject(runs.datasets) ? runs.datasets : {}).filter(([, d]) => isObject(d) && d.status !== "ok");
    pageReport = {
      writtenAt: writtenAt.toISOString(),
      ...pageChanged ? { stale: "files or datasets changed after the page wrote this; it is rewritten (or removed) when the page next runs them" } : {},
      ...failedSources.length ? { sources: Object.fromEntries(failedSources) } : {},
      ...Array.isArray(runs.marks) && runs.marks.length ? { marks: runs.marks, flagged: runs.flagged } : {},
      ...Array.isArray(runs.errors) && runs.errors.length ? { errors: runs.errors } : {}
    };
  }
  if (pageReport) {
    const report = pageReport.stale ? warn : issue;
    const doc = "data/users/me/runs";
    for (const [id, d] of Object.entries(pageReport.sources ?? {})) report(doc, `the open page says ${id} ${d.status}${d.message ? `: ${String(d.message).slice(0, 160)}` : ""}.`);
    for (const m of pageReport.marks ?? []) {
      const at = `${m.mark} (${[m.source, m.field, m.where ?? (m.row !== void 0 ? `row ${m.row}` : void 0)].filter(Boolean).join(" \xB7 ")})`;
      report(doc, m.reason ? `the open page flagged ${at}: ${String(m.reason).slice(0, 120)}.` : `the open page flagged ${at}: it shows ${JSON.stringify(m.shown)}, the data holds ${m.inData}.`);
    }
    for (const e of pageReport.errors ?? []) report(doc, `the page's code threw (${e.kind}) ${e.name}: ${String(e.message).slice(0, 160)}${e.file ? ` in ${e.file}` : ""}${e.count > 1 ? ` (${e.count} times)` : ""}.`);
  }
  const server = readState(root);
  const running = server && server.kind === "dashboard" && alive(server.pid) ? server.url : null;
  let pageCheck;
  const checkDoc = docs.get(`data/users/${LOCAL_USER_ID}/check`);
  if (checkDoc) {
    const writtenAt = fs6.statSync(docFile(root, ["data", "users", LOCAL_USER_ID, "check"])).mtime;
    const changedSince = (re) => [...docs.keys()].some((p) => re.test(p) && fs6.statSync(docFile(root, p.split("/"))).mtime > writtenAt);
    const stale = changedSince(/^files\//) ? "a page file changed after the page wrote this; the open page checks again when it picks the change up, then rewrites or removes it" : changedSince(/^(datasets|dash)\//) ? "a dataset or dash document changed after the page wrote this; only a page-file write (or opening the page again) checks again" : checkDoc.status === "checking" && Date.now() - writtenAt.getTime() > CHECK_ABANDONED_MS ? "it has said checking for over 30 seconds: the page was closed while it checked; it checks again when it is opened" : void 0;
    pageCheck = {
      status: checkDoc.status,
      ...checkDoc.at !== void 0 ? { at: checkDoc.at } : {},
      writtenAt: writtenAt.toISOString(),
      ...stale ? { stale } : {},
      ...Array.isArray(checkDoc.page) ? { page: checkDoc.page.filter(isObject) } : {}
    };
    if (checkDoc.status === "failed") {
      const doc = "data/users/me/check";
      const report = stale ? warn : issue;
      for (const e of pageCheck.page ?? []) {
        const times = typeof e.count === "number" && e.count > 1 ? ` (${e.count})` : "";
        if (e.kind === "output") {
          warn(doc, `the open page shows ${CHECK_OUTPUT_WORDS[String(e.what)] ?? String(e.what)}${times}: fix it unless a filter or the data explains it.`);
        } else if (e.kind === "drawing") {
          report(doc, `the open page found ${CHECK_DRAWING_WORDS[String(e.what)] ?? String(e.what)}${times}.`);
        } else {
          const did = e.kind === "stopped" ? "stopped" : e.kind === "rejection" ? "left a promise rejected" : "threw";
          report(doc, `the page's code ${did}: ${e.name} (${e.what})${e.file ? ` in ${e.file}` : ""}${times}; errors in data/users/me/runs hold its words.`);
        }
      }
    }
  } else if (running) {
    pageCheck = {
      status: null,
      note: "No check document. Open in a browser, the page checks itself when it opens and after each page-file write (it takes about 10 seconds), writes what failed here, and removes the document when it passes. None after one more check: it passed, its data came too late, or no browser has it open."
    };
  }
  const problems = issues.length;
  const checking = pageCheck?.status === "checking" && !pageCheck.stale;
  return {
    problems,
    result: {
      root,
      title,
      problems,
      ...issues.length ? { issues } : {},
      ...warnings.length ? { warnings } : {},
      datasets: [...datasets.values()].map((d) => ({
        id: d.id,
        kind: d.kind,
        ...d.table ? { format: d.format, rows: d.table.rows.length, columns: d.table.columns } : {}
      })),
      ...calcs.size ? { calcs: [...calcs.keys()] } : {},
      ...pageReport ? { page: pageReport } : {},
      ...pageCheck ? { pageCheck } : {},
      notChecked: "Nothing is rendered here: whether scripts run, values shown match the data, and the layout are checked by the page itself while a browser has it open (pageCheck after a page write; page for what its readers ran into).",
      next: problems > 0 ? "Fix each issue (doc names the document; files/index.html lines are lines of its text), write it with write-db, and run check again until problems is 0. Warnings are worth a look; they don\u2019t block." : checking ? "No problems so far. The open page is checking itself: run check again in a few seconds." : running ? `No problems. The editor is open at ${running} and shows each change as it is written; where a browser has it open, the page checks itself after each page write: run check one more time in about 10 seconds to read pageCheck (still none then: it passed, or no browser has it open).` : `No problems. Start the editor (it keeps running in the background): ${cmd("open", root)}, then give the person the url it prints and the folder.`
    }
  };
}
var runningServer2 = (root) => runningServer(root, "dashboard", "/_api/session");
function serverFlags(flags) {
  const out = [];
  if (flags.has("port")) out.push("--port", flags.get("port"));
  if (flags.has("host")) out.push("--host", flags.get("host"));
  if (flags.has("agent-hook")) out.push("--agent-hook", flags.get("agent-hook"));
  if (flags.has("lan")) out.push("--lan");
  return out;
}
var COMMENTS_ROUTE = "/__comments";
var COMMENT_FILE = "files/index.html";
var ADMIN_READ = /* @__PURE__ */ new Set(["versions", "version-docs", "drafts"]);
var access = (viewer, p) => dbAccess(viewer, p.split("/"), ADMIN_READ);
var ownPath = (p, viewer) => String(p ?? "").replace(/^\/*data\/users\/me(?=\/|$)/, `data/users/${viewer.user.id}`);
async function serve(root, flags) {
  if (!["index.html", "local-host.js", "comments.js"].every((name) => fs6.existsSync(path5.join(EDITOR_DIR, name)))) {
    throw new CliError("EDITOR_MISSING", `The editor page is missing (${EDITOR_DIR}); reinstall the skill.`);
  }
  const existing = await runningServer2(root);
  if (existing && existing.pid !== process.pid) {
    print({ url: existing.url, root, pid: existing.pid, reused: true, ...await lanOn2(existing.url, flags) }, true);
    return false;
  }
  const host = flags.get("host") ?? "127.0.0.1";
  const port = flags.has("port") ? Number(flags.get("port")) : DEFAULT_PORTS.dashboard;
  const agentHook = flags.get("agent-hook");
  if (agentHook === "true") throw new CliError("INVALID_AGENT_HOOK", '--agent-hook takes a command: --agent-hook "<command>".');
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new CliError("INVALID_PORT", "--port is a number from 0 to 65535.");
  const log = (line) => process.stderr.write(`[${(/* @__PURE__ */ new Date()).toISOString()}] ${line}
`);
  const dbDir = path5.join(root, "db");
  fs6.mkdirSync(dbDir, { recursive: true });
  const known = /* @__PURE__ */ new Map();
  const clients = /* @__PURE__ */ new Map();
  const send = (res, event, data) => res.write(`event: ${event}
data: ${JSON.stringify(data)}

`);
  const snapshot = (viewer) => Object.fromEntries([...known].filter(([p]) => access(viewer, p).read).map(([p, k]) => [p, JSON.parse(k.text)]));
  function rescan() {
    const files = listDocFiles(root);
    const changes = [];
    for (const [p, { file }] of files) {
      let stat;
      try {
        stat = fs6.statSync(file);
      } catch {
        continue;
      }
      const prev = known.get(p);
      if (prev && prev.mtimeMs === stat.mtimeMs && prev.size === stat.size) continue;
      let data;
      try {
        data = JSON.parse(fs6.readFileSync(file, "utf8"));
        if (!isObject(data)) throw new Error("not an object");
      } catch {
        continue;
      }
      const text = JSON.stringify(data);
      known.set(p, { text, mtimeMs: stat.mtimeMs, size: stat.size });
      if (!prev || prev.text !== text) changes.push({ path: p, data });
    }
    for (const p of [...known.keys()]) {
      if (!files.has(p)) {
        known.delete(p);
        changes.push({ path: p, data: null });
      }
    }
    if (changes.length) {
      for (const [res, viewer] of clients) {
        const seen = changes.filter((c) => access(viewer, c.path).read);
        if (seen.length) send(res, "change", { changes: seen });
      }
      log(`changed: ${changes.map((c) => c.path).join(", ")}`);
    }
  }
  rescan();
  let timer = null;
  const soon = () => {
    clearTimeout(timer);
    timer = setTimeout(rescan, 40);
  };
  let watcher = null;
  try {
    watcher = fs6.watch(dbDir, { recursive: true }, soon);
    watcher.on("error", () => {
    });
  } catch (error) {
    log(`file watching unavailable (${error.message}); polling instead`);
  }
  const poll = setInterval(rescan, watcher ? 2e3 : 700);
  const owner = localOwner();
  const page = pagePathOf("dashboard", root);
  const share2 = new ShareHost({
    root,
    cookieName: guestCookieName("dashboard", root),
    owner,
    noun: NOUNS.dashboard,
    title: () => dashboardTitle(root),
    log,
    createServer: () => http.createServer(handle),
    uiFile: path5.join(EDITOR_DIR, "share-ui.js")
  });
  const comments = createCommentsService({
    root,
    log,
    userName: owner.name,
    locate: () => ({ file: COMMENT_FILE }),
    ...agentHook ? { agentHook } : {},
    allowWrite: sameOrigin,
    viewer: (req) => {
      const viewer = share2.viewerOf(req);
      return viewer ? commentsViewer(viewer) : null;
    }
  });
  const json = (res, status, body) => sendJson(res, status, body);
  const serveFile = (req, res, file, type, cache) => {
    fs6.stat(file, (error, stat) => {
      if (error || !stat.isFile()) return json(res, 404, { code: "not_found", message: "Not found" });
      sendFile(req, res, file, { "Content-Type": type, "Content-Length": stat.size, "Cache-Control": cache, "X-Content-Type-Options": "nosniff" });
    });
  };
  const servePage = (res, viewer) => {
    let html;
    try {
      html = fs6.readFileSync(path5.join(EDITOR_DIR, "index.html"), "utf8");
    } catch {
      return json(res, 404, { code: "not_found", message: "The editor page is missing." });
    }
    const body = Buffer.from(share2.injectHead(html, viewer) ?? html);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Content-Length": body.length, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }).end(body);
  };
  async function handle(req, res) {
    try {
      if (!share2.hostAllowed(req)) return json(res, 421, { code: "invalid_argument", message: "Unexpected Host header." });
      const url2 = new URL(req.url ?? "/", "http://local");
      if (url2.pathname === "/favicon.ico") {
        res.writeHead(204).end();
        return;
      }
      if (await share2.route(req, res)) return;
      const viewer = share2.viewerOf(req);
      if (!viewer) return share2.denied(req, res);
      const at = pageRoute(url2.pathname, page);
      if ("redirect" in at) {
        req.resume();
        res.writeHead(302, { Location: `${at.redirect}${url2.search}`, "Cache-Control": "no-store" }).end();
        return;
      }
      const p = at.path;
      if (req.method === "POST" && !sameOrigin(req)) return json(res, 403, { code: "not_granted", message: "Cross-origin write refused." });
      const editing = canEditAs(viewer.role);
      if (req.method === "GET" && (p === "/" || p === "/index.html")) return servePage(res, viewer);
      if (req.method === "GET" && (p === "/local-host.js" || p === "/comments.js")) return serveFile(req, res, path5.join(EDITOR_DIR, p.slice(1)), "text/javascript; charset=utf-8", "no-store");
      if (p === COMMENTS_ROUTE || p.startsWith(`${COMMENTS_ROUTE}/`)) {
        const sub = p.slice(COMMENTS_ROUTE.length);
        if (sub === "/events") share2.hold(viewer, res);
        return await comments.handle(req, res, sub);
      }
      if (req.method === "GET" && /^\/assets\/[A-Za-z0-9_.-]+$/.test(p)) return serveFile(req, res, path5.join(EDITOR_DIR, p), contentTypeOf(p), "public, max-age=31536000, immutable");
      const blob = /^\/_blob\/([0-9a-f]{32})$/.exec(p);
      if (req.method === "GET" && blob) {
        const meta = readBlobMeta(root, blob[1]);
        return serveFile(req, res, blobFile(root, blob[1]), meta?.contentType ?? "application/octet-stream", "private, max-age=31536000, immutable");
      }
      if (req.method === "GET" && p === "/_api/session") {
        const session = { ok: true, kind: "dashboard", ...viewer.guest ? {} : { root }, userId: viewer.user.id, userName: viewer.user.name, role: viewer.role, canEdit: editing };
        return json(res, 200, session);
      }
      if (req.method === "GET" && p === "/_api/events") {
        res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" });
        res.write("retry: 1500\n\n");
        rescan();
        send(res, "snapshot", { docs: snapshot(viewer) });
        clients.set(res, viewer);
        share2.hold(viewer, res);
        const ping = setInterval(() => res.write(": ping\n\n"), 25e3);
        req.on("close", () => {
          clearInterval(ping);
          clients.delete(res);
        });
        return;
      }
      if (req.method === "GET" && p === "/_api/doc") {
        let doc;
        try {
          doc = readDoc(root, ownPath(url2.searchParams.get("path"), viewer));
        } catch (error) {
          return json(res, 400, { code: "invalid_argument", message: error.message });
        }
        return json(res, 200, doc.exists && access(viewer, doc.path).read ? { exists: true, data: doc.data } : { exists: false });
      }
      if (req.method === "POST" && p === "/_api/write") {
        let body;
        try {
          body = JSON.parse((await readBody(req, MAX_BATCH_BYTES + 4096)).toString("utf8"));
        } catch (error) {
          const tooLarge = error instanceof TooLarge;
          return json(res, tooLarge ? 413 : 400, { code: "invalid_argument", message: tooLarge ? "The write is over 1 MB." : "The write is not JSON." });
        }
        const given = ownPath(body.path, viewer);
        let segs;
        try {
          segs = docSegments(given);
        } catch (error) {
          return json(res, 400, { code: "invalid_argument", message: error.message });
        }
        if (!editing) return json(res, 403, { code: "invalid_argument", message: `You can view this dashboard but not change it.` });
        if (!access(viewer, segs.join("/")).write) return json(res, 403, { code: "invalid_argument", message: `${segs.join("/")} is another person's own: only they read and write it.` });
        try {
          const done = applyWrites(root, [{ op: body.op, path: given, ...body.op === "delete" ? {} : { data: body.data } }], { agent: false });
          rescan();
          return json(res, 200, { ok: true, writes: done });
        } catch (error) {
          return json(res, 400, { code: "invalid_argument", message: error.message });
        }
      }
      if (req.method === "POST" && p === "/_api/upload") {
        if (!editing) {
          req.resume();
          return json(res, 403, { code: "not_granted", message: "You can view this dashboard but not add files to it." });
        }
        let bytes;
        try {
          bytes = await readBody(req, MAX_DATA_BYTES);
        } catch (error) {
          const tooLarge = error instanceof TooLarge;
          return json(res, tooLarge ? 413 : 400, { code: "invalid_argument", message: tooLarge ? "The file is over 8 MB." : error.message });
        }
        let name = "upload";
        try {
          name = decodeURIComponent(String(req.headers["x-filename"] ?? "upload")).replace(/[\\/]/g, "_").slice(0, 200) || "upload";
        } catch {
        }
        const type = String(req.headers["content-type"] ?? "") || contentTypeOf(name);
        const result = putBlob(root, bytes, name, type);
        log(`uploaded ${name} as ${result.url}${viewer.guest ? ` (${viewer.user.name})` : ""}`);
        return json(res, 200, result);
      }
      return json(res, 404, { code: "not_found", message: "Not found" });
    } catch (error) {
      log(`error: ${error.stack ?? error}`);
      if (!res.headersSent) json(res, 500, { code: "unavailable", message: String(error.message ?? error) });
    }
  }
  const server = http.createServer(handle);
  const close = () => {
    clearInterval(poll);
    watcher?.close();
    comments.close();
    for (const c of clients.keys()) c.end();
    share2.close();
    server.close();
    server.closeAllConnections?.();
  };
  const actualPort = await share2.listen(server, { port, host, lan: flags.has("lan"), portGiven: flags.has("port") }).catch((error) => {
    close();
    throw error.code === "PORT_IN_USE" ? new CliError("PORT_IN_USE", error.message) : error;
  });
  const url = `${serverOrigin(host, actualPort)}${page}`;
  const state = { kind: "dashboard", pid: process.pid, url, port: actualPort, root, startedAt: (/* @__PURE__ */ new Date()).toISOString() };
  recordServer(state, close, ["SIGINT", "SIGTERM", "SIGHUP"]);
  const lan = share2.lanUrls();
  print({ url, root, pid: process.pid, ...lan.length ? { lan } : {} }, true);
  log(`serving ${root} at ${url}`);
  return true;
}
var fail = (code, message) => {
  throw new CliError(code, message);
};
var shareCall2 = (url, action) => shareCall(url, action, fail);
var lanOn2 = (url, flags) => lanOn(url, flags, fail);
async function open(root, flags) {
  const existing = await runningServer2(root);
  if (existing) {
    print({ url: existing.url, root, pid: existing.pid, reused: true, ...await lanOn2(existing.url, flags), log: path5.join(root, LOG_FILE), stop: cmd("stop", root) }, true);
    return;
  }
  const state = await startBackground(root, flags);
  const view = await shareCall2(state.url, null).catch(() => null);
  const empty = !fs6.existsSync(docFile(root, ["files", "index.html"]));
  print({ url: state.url, root, pid: state.pid, ...view?.lan ? { lan: lanUrls(view) } : {}, log: path5.join(root, LOG_FILE), stop: cmd("stop", root), ...empty ? { note: "files/index.html is not written yet: the page is empty until it is." } : {} }, true);
}
async function startBackground(root, flags) {
  const logFile = path5.join(root, LOG_FILE);
  const fd = fs6.openSync(logFile, "a");
  const child = spawn2(process.execPath, [SCRIPT, "serve", root, ...serverFlags(flags)], { detached: true, stdio: ["ignore", "ignore", fd] });
  child.unref();
  fs6.closeSync(fd);
  let exited = false;
  child.once("exit", () => exited = true);
  const deadline = Date.now() + 15e3;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 120));
    const state = readState(root);
    if (state && state.pid === child.pid) return state;
    if (exited) break;
  }
  const tail = fs6.existsSync(logFile) ? fs6.readFileSync(logFile, "utf8").split("\n").slice(-12).join("\n") : "";
  throw new CliError("SERVER_FAILED", `The editor server did not start. Run ${cmd("serve", root)} in the foreground to see why.${tail ? `
${tail}` : ""}`);
}
function stop(root) {
  const state = readState(root);
  if (!state || !alive(state.pid)) {
    fs6.rmSync(path5.join(root, STATE_FILE), { force: true });
    print({ stopped: false, message: "No editor server is running for this folder." }, true);
    return;
  }
  process.kill(state.pid, "SIGTERM");
  print({ stopped: true, pid: state.pid }, true);
}
async function share(root, flags) {
  print(
    await shareCommand({
      root,
      flags,
      running: () => runningServer2(root),
      startShared: () => startBackground(root, new Map([...flags, ["lan", "true"]])),
      offCommand: cmd("share", root, "--off"),
      serveCommand: cmd("serve", root, "--lan"),
      fail
    })
  );
}
var WAIT_CHUNK_S = 300;
function commentHints(root) {
  return { reply: cmd("comment-reply", root, "<id>", "<text>"), resolve: cmd("comment-resolve", root, "<id>") };
}
async function listComments(root, all) {
  const doc = await readComments(root);
  const threads = all ? [...doc.threads].sort((x, y) => x.createdAt.localeCompare(y.createdAt)) : openThreads(doc);
  const resolved = doc.threads.filter((t) => t.status === "resolved").length;
  return {
    root,
    file: commentsPath(root),
    threads: agentViews(doc, threads),
    ...all || !resolved ? {} : { resolved: `${resolved} resolved, not shown (--all shows them)` },
    ...threads.length ? commentHints(root) : {}
  };
}
function dashboardTitle(root) {
  let title;
  try {
    const meta = readDoc(root, "dash/meta");
    title = meta.exists ? meta.data?.title : void 0;
  } catch {
  }
  return typeof title === "string" && title.trim() ? title.trim() : path5.basename(root);
}
async function waitComments(root, flags) {
  const timeout = flags.has("timeout") ? Number(flags.get("timeout")) : Infinity;
  if (!(timeout > 0)) throw new CliError("INVALID_TIMEOUT", "--timeout is a number of seconds above 0.");
  const deadline = Date.now() + timeout * 1e3;
  let failures = 0;
  for (; ; ) {
    const state = await runningServer2(root);
    if (!state) throw new CliError("NO_SERVER", `No editor server is running for this folder: start it with ${cmd("open", root)}, then wait again.`);
    const left = Math.min(WAIT_CHUNK_S, (deadline - Date.now()) / 1e3);
    if (left <= 0) return { root, threads: [], timedOut: true, next: cmd("comments", root, "--wait") };
    let body;
    try {
      const response = await fetch(new URL(`__comments/agent/wait?timeout=${Math.max(1, Math.round(left))}`, state.url), {
        signal: AbortSignal.timeout((left + 30) * 1e3)
      });
      if (response.status === 404) {
        throw new CliError(
          "SERVER_OUTDATED",
          `The running editor server has no comments (an older version started it). Restart it: ${cmd("stop", root)}, then ${cmd("open", root)}.`
        );
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      body = await response.json();
      failures = 0;
    } catch (error) {
      if (error instanceof CliError) throw error;
      if (++failures >= 3) throw new CliError("SERVER_GONE", `Lost the editor server: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 1e3));
      continue;
    }
    if (body.closed) continue;
    const threads = body.threads ?? [];
    if (threads.length) {
      return {
        root,
        url: state.url,
        title: dashboardTitle(root),
        file: commentsPath(root),
        threads,
        ...commentHints(root),
        next: cmd("comments", root, "--wait")
      };
    }
  }
}
async function readStdin() {
  if (process.stdin.isTTY) return "";
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}
async function replyComment(root, id, words, resolve) {
  if (!id) throw new CliError("MISSING_ID", `Give the comment id: ${cmd("comment-reply", root, "<id>", "<text>")}`);
  const given = words.join(" ");
  const text = (given === "" || given === "-" ? await readStdin() : given).replace(/\r\n?/g, "\n").trim();
  if (!text) throw new CliError("EMPTY_REPLY", "The reply is empty: pass it as an argument, or as - with the text on stdin.");
  if (text.length > LIMITS.text) throw new CliError("REPLY_TOO_LONG", `A reply is at most ${LIMITS.text} characters.`);
  const thread = await updateComments(root, (doc) => {
    const found = findThread(doc, id);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    addMessage(found, AGENT_AUTHOR, text, now);
    if (resolve) setStatus(found, "resolved", now);
    return found;
  });
  return { replied: thread.id, status: thread.status, file: commentsPath(root) };
}
async function resolveComment(root, id, reopen) {
  if (!id) throw new CliError("MISSING_ID", `Give the comment id: ${cmd("comment-resolve", root, "<id>")}`);
  const thread = await updateComments(root, (doc) => {
    const found = findThread(doc, id);
    setStatus(found, reopen ? "open" : "resolved", (/* @__PURE__ */ new Date()).toISOString());
    return found;
  });
  return { id: thread.id, status: thread.status, file: commentsPath(root) };
}
var USAGE = `claude-dashboard \u2014 local Artifact tool for the Dashboard type

Usage:
  node scripts/artifact.mjs write-db <root> <batch.json | ->     write documents (set / update / delete), all or nothing
  node scripts/artifact.mjs read-db  <root> [<collection>[/<doc_id>]] [--text]
                                                                  read the store; --text prints a document's text raw
  node scripts/artifact.mjs upload   <root> <file> [--name n]    attach a CSV/TSV/JSON file; prints its /_blob/<id> url
  node scripts/artifact.mjs delete-asset <root> <url|id>         remove an attached file nothing names any more
  node scripts/artifact.mjs check    <root>                      check documents, files and marks; exit 1 on problems
  node scripts/artifact.mjs open     <root> [--port n] [--lan]   start the editor in the background; prints {"url"}
  node scripts/artifact.mjs serve    <root> [--port n] [--lan]   the same server, in the foreground
                                     [--agent-hook "<command>"]  open/serve: run this for each comment sent to the agent
                                                                  (the comment as JSON on stdin); --lan: shared too
  node scripts/artifact.mjs stop     <root>                      stop the background editor
  node scripts/artifact.mjs share    <root>                      share on the local network; prints a link per role
                                     [--off] [--reset R] [--enable R] [--disable R]
                                                                  R: editor, commenter, viewer, a comma list, or all
                                     [--role G=R,...]            give guest G (an id it prints) role R
  node scripts/artifact.mjs comments <root> [--all]              the open comments people left in the page (--all: resolved too)
  node scripts/artifact.mjs comments <root> --wait [--timeout s] wait for a comment sent to the agent from the open page
  node scripts/artifact.mjs comment-reply <root> <id> <text|->   reply as the agent (-: text on stdin) [--resolve]
  node scripts/artifact.mjs comment-resolve <root> <id> [--reopen]  mark a comment resolved (or open again)

<root> is the dashboard's folder: documents at <root>/db/<collection>/<doc_id>.json, attached files in <root>/_blobs/,
comments in <root>/comments.json.
A batch is a JSON array (or {"writes": [...]}) of {op, path: "collection/doc_id" (or collection + doc_id), data | file_path};
in data, {"$file": "path"} is replaced by that file's text. update merges fields; null or {"__delete__": true} removes one.
Paths in a batch are relative to the current directory. Skill: ${SKILL_DIR}`;
async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const { positional, flags } = parseArgs(rest);
  switch (command) {
    case "write-db": {
      const root = resolveRoot(positional[0], { create: true });
      const from = positional[1];
      if (!from) throw new CliError("MISSING_BATCH", "Give the batch: a JSON file, or - to read it from stdin.");
      let text;
      try {
        text = from === "-" ? fs6.readFileSync(0, "utf8") : fs6.readFileSync(path5.resolve(from), "utf8");
      } catch {
        throw new CliError("FILE_NOT_FOUND", `No such batch file: ${from}`);
      }
      let batch;
      try {
        batch = JSON.parse(text);
      } catch (error) {
        throw new CliError("INVALID_BATCH", `The batch is not JSON: ${error.message}`);
      }
      const writes = Array.isArray(batch) ? batch : Array.isArray(batch?.writes) ? batch.writes : isObject(batch) && batch.op ? [batch] : null;
      if (!writes) throw new CliError("INVALID_BATCH", 'A batch is an array of writes, or {"writes": [...]}.');
      const written = applyWrites(root, writes);
      const server = readState(root);
      print({ root, written, next: `Run ${cmd("check", root)}.${server && alive(server.pid) ? " The open editor picks the change up by itself." : ""}` });
      return 0;
    }
    case "read-db": {
      const result = readDb(resolveRoot(positional[0]), positional[1], flags);
      if ("raw" in result) process.stdout.write(result.raw.endsWith("\n") ? result.raw : `${result.raw}
`);
      else print(result);
      return 0;
    }
    case "upload":
      print(upload(resolveRoot(positional[0], { create: true }), positional[1], flags));
      return 0;
    case "delete-asset":
      print(deleteAsset(resolveRoot(positional[0]), positional[1]));
      return 0;
    case "check": {
      const { result, problems } = check(resolveRoot(positional[0]));
      print(result);
      return problems > 0 ? 1 : 0;
    }
    case "open":
      await open(resolveRoot(positional[0]), flags);
      return 0;
    case "serve":
      return await serve(resolveRoot(positional[0]), flags) ? -1 : 0;
    case "stop":
      stop(resolveRoot(positional[0]));
      return 0;
    case "share":
      await share(resolveRoot(positional[0]), flags);
      return 0;
    case "comments": {
      const root = resolveRoot(positional[0]);
      print(flags.has("wait") ? await waitComments(root, flags) : await listComments(root, flags.has("all")));
      return 0;
    }
    case "comment-reply":
      print(await replyComment(resolveRoot(positional[0]), positional[1], positional.slice(2), flags.has("resolve")), true);
      return 0;
    case "comment-resolve":
      print(await resolveComment(resolveRoot(positional[0]), positional[1], flags.has("reopen")), true);
      return 0;
    case void 0:
    case "help":
    case "--help":
    case "-h":
      process.stdout.write(`${USAGE}
`);
      return command === void 0 ? 2 : 0;
    default:
      process.stderr.write(`Unknown command: ${command}

${USAGE}
`);
      return 2;
  }
}
main().then(
  (code) => {
    if (code >= 0) process.exitCode = code;
  },
  (error) => {
    process.stderr.write(`${JSON.stringify({ error: error.code ?? "ERROR", message: error.message })}
`);
    process.exitCode = 2;
  }
);
